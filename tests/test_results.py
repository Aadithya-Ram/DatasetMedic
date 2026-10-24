import json
from pathlib import Path

import pytest

from datasetmedic.results import read_findings, write_result


def findings(count):
    return [{"id": str(i), "title": f"Column Straße東京 {i}", "detail": "Missing values",
             "columns": [f"column_{i}"], "severity": "warning" if i % 2 else "info",
             "examples": [{"text": "東京\nquoted \"text\"", "flag": False, "missing": None}]} for i in range(count)]


@pytest.mark.parametrize("count", [0, 1, 45])
def test_indexed_findings_preserve_records_filters_and_byte_offsets(tmp_path, count):
    original = {"profiles": {}, "findings": findings(count), "notice": "No leakage guarantee."}
    before = json.dumps(original)
    write_result(tmp_path, original)
    stored = json.loads((tmp_path / "result.json").read_text(encoding='utf-8'))
    assert "findings" not in stored
    assert stored["finding_count"] == count
    for query, severity, offset, limit in [("", "all", 0, 20), ("STRASSE東京", "warning", 2, 3),
                                           ("no match", "all", 0, 20), ("", "all", 40, 100),
                                           ("", "all", -1, 0)]:
        assert read_findings(tmp_path, stored, offset, limit, query, severity) == read_findings(
            tmp_path, original, offset, limit, query, severity)
    assert json.dumps(original) == before


def test_reading_page_never_decodes_unselected_evidence(tmp_path):
    write_result(tmp_path, {"findings": findings(45)})
    index = json.loads((tmp_path / "findings-index.json").read_text(encoding='utf-8'))
    # Corrupt only an unselected record: page one must not read/decode it.
    with (tmp_path / "findings.jsonl").open("r+b") as stream:
        stream.seek(index[-1]["offset"])
        stream.write(b"!")
    result = {"finding_count": 45}
    assert read_findings(tmp_path, result, 0, 20, "", "all")["items"] == findings(45)[:20]
    with pytest.raises(json.JSONDecodeError):
        read_findings(tmp_path, result, 44, 1, "", "all")


def test_completion_marker_waits_for_all_storage_files(tmp_path, monkeypatch):
    replace = Path.replace

    def fail_index(path, target):
        if path.name == "index.tmp":
            raise OSError("injected write failure")
        return replace(path, target)

    monkeypatch.setattr(Path, "replace", fail_index)
    with pytest.raises(OSError, match="injected"):
        write_result(tmp_path, {"findings": findings(2)})
    assert not (tmp_path / "result.json").exists()


def test_preview_results_need_no_findings_storage(tmp_path):
    write_result(tmp_path, {"profiles": {}, "download": True})
    assert not (tmp_path / "findings.jsonl").exists()
    assert read_findings(tmp_path, {"profiles": {}}, 0, 20, "", "all") == {"total": 0, "items": []}
