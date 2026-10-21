"""Exercise benchmark evidence and process isolation without timing thresholds."""
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "benchmark_splits.py"


@pytest.mark.parametrize(("record", "group"), [(10, 20), (0, 0), (100, 100)])
def test_split_benchmark_verifies_known_evidence(record, group):
    completed = subprocess.run(
        [sys.executable, str(SCRIPT), "--rows", "31", "--repeat", "2",
         "--record-overlap", str(record), "--group-overlap", str(group)],
        capture_output=True, text=True, check=True,
    )
    result = json.loads(completed.stdout)
    assert result["repeat"] == 2
    assert result["columns"] == 5
    assert result["max_peak_process_bytes"] > 0
    assert result["median_load_seconds"] >= 0
    assert result["median_audit_seconds"] >= 0
    for trial in result["trials"]:
        assert trial["verified"]
        assert trial["observed_counts"] == {"split_overlap": 31 * record // 100, "group_overlap": 31 * group // 100}
        assert trial["loaded_frame_bytes"] > 0
        assert trial["parquet_bytes"] > 0
        assert trial["observed_columns"] == {"train": 5, "test": 5}
        assert trial["profile_seconds"] >= 0
        assert trial["profile_seconds"] + trial["other_audit_seconds"] == pytest.approx(trial["audit_seconds"])


@pytest.mark.parametrize("columns", [50, 500])
def test_wide_benchmark_profiles_requested_width_and_keeps_overlap_evidence(columns):
    completed = subprocess.run([sys.executable, str(SCRIPT), "--rows", "31", "--repeat", "1",
                                "--columns", str(columns)], capture_output=True, text=True, check=True)
    result = json.loads(completed.stdout)
    assert result["columns"] == columns
    trial = result["trials"][0]
    assert trial["observed_columns"] == {"train": columns, "test": columns}
    assert trial["observed_counts"] == {"split_overlap": 3, "group_overlap": 6}
    assert trial["verified"]
    assert result["median_profile_seconds"] == trial["profile_seconds"]
    assert result["median_other_audit_seconds"] == trial["other_audit_seconds"]


@pytest.mark.parametrize("arguments", [["--rows", "0"], ["--rows", "2000001"],
                                       ["--repeat", "0"], ["--group-overlap", "101"],
                                       ["--columns", "4"], ["--columns", "501"]])
def test_benchmark_rejects_invalid_sizes(arguments):
    completed = subprocess.run([sys.executable, str(SCRIPT), *arguments], capture_output=True, text=True, check=False)
    assert completed.returncode == 2
    assert "must be between" in completed.stderr
