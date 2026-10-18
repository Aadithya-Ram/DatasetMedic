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
    assert result["max_peak_process_bytes"] > 0
    assert result["median_load_seconds"] >= 0
    assert result["median_audit_seconds"] >= 0
    for trial in result["trials"]:
        assert trial["verified"]
        assert trial["observed_counts"] == {"split_overlap": 31 * record // 100, "group_overlap": 31 * group // 100}
        assert trial["loaded_frame_bytes"] > 0
        assert trial["parquet_bytes"] > 0


@pytest.mark.parametrize("arguments", [["--rows", "0"], ["--rows", "2000001"],
                                       ["--repeat", "0"], ["--group-overlap", "101"]])
def test_benchmark_rejects_invalid_sizes(arguments):
    completed = subprocess.run([sys.executable, str(SCRIPT), *arguments], capture_output=True, text=True, check=False)
    assert completed.returncode == 2
    assert "must be between" in completed.stderr
