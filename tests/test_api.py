import io
import json
import subprocess
import sys
import time
import zipfile

import polars as pl
import pytest
from fastapi.testclient import TestClient

from datasetmedic.app import create_app

HEADERS = {"X-DatasetMedic": "1"}


@pytest.fixture
def client(tmp_path):
    app = create_app(str(tmp_path / "sessions"))
    with TestClient(app, headers=HEADERS) as client:
        yield client
    assert not app.state.root.exists()


def create_session(client):
    response = client.post("/api/sessions")
    assert response.status_code == 200
    return "/api/sessions/" + response.json()["id"]


def wait(client, base, jid):
    for _ in range(150):
        data = client.get(f"{base}/jobs/{jid}").json()
        if data["status"] != "running":
            return data
        time.sleep(0.1)
    pytest.fail("Worker failed to complete within 15 seconds")


def test_findings_filter_full_audit_before_pagination_and_preserve_snapshot(client):
    from datasetmedic.engine import audit

    base = create_session(client)
    sid = base.rsplit("/", 1)[1]
    frame = pl.DataFrame({**{f"field_{index:02}": [1, 1] for index in range(45)}, "Straße東京": [None, 1]})
    snapshot = audit({"source": frame}, {})
    folder = client.app.state.root / sid / "filtered"
    folder.mkdir()
    result_file = folder / "result.json"
    result_file.write_text(json.dumps(snapshot), encoding="utf-8")
    original = result_file.read_bytes()
    client.app.state.sessions[sid]["jobs"]["filtered"] = {"folder": folder, "kind": "audit"}
    url = base + "/jobs/filtered/findings"
    all_items = client.get(url, params={"limit": 100}).json()
    assert all_items["total"] == len(snapshot["findings"]) > 40
    expected = [finding for finding in snapshot["findings"] if finding["severity"] == "info"]
    page = client.get(url, params={"query": "COLUMN", "severity": "info", "offset": 20, "limit": 3}).json()
    assert page == {"total": len(expected), "items": expected[20:23]}
    unicode = client.get(url, params={"query": "  STRASSE東京  ", "severity": "warning"}).json()
    assert unicode["total"] == 1
    assert unicode["items"][0]["kind"] == "missing"
    assert client.get(url, params={"query": "no such column"}).json() == {"total": 0, "items": []}
    assert client.get(url, params={"offset": 10000}).json()["items"] == []
    assert client.get(url, params={"offset": -1, "limit": 0}).json()["items"] == snapshot["findings"][:1]
    assert client.get(url, params={"severity": "invalid"}).status_code == 422
    assert client.get(url, params={"query": "x" * 201}).status_code == 422
    assert result_file.read_bytes() == original


def test_nonfinite_evidence_is_strict_json_and_exports_keep_numeric_values(client):
    base = create_session(client)
    uploaded = client.post(base + "/imports", files={"file": ("special.csv", b"value,tag\ninf,a\n-inf,b\nNaN,c\n,d\n")}).json()
    jid = client.post(base + "/jobs", json={"kind": "audit", "config": {"target": "value"}}).json()["id"]
    assert wait(client, base, jid)["status"] == "complete"
    result = client.get(f"{base}/jobs/{jid}/result").json()
    assert [row["value"] for row in result["profiles"][uploaded["id"]]["sample"]] == ["Infinity", "-Infinity", None, None]
    items = client.get(f"{base}/jobs/{jid}/findings").json()["items"]
    balance = next(f for f in items if f["kind"] == "class_balance")
    assert balance["count"] == 2
    assert {row["label"] for row in balance["examples"]} == {"Infinity", "-Infinity"}
    export = client.post(base + "/jobs", json={"kind": "export", "output_format": "parquet"}).json()["id"]
    assert wait(client, base, export)["status"] == "complete"
    with zipfile.ZipFile(io.BytesIO(client.get(f"{base}/jobs/{export}/download").content)) as bundle:
        name = next(name for name in bundle.namelist() if name.endswith(".parquet"))
        cleaned = pl.read_parquet(io.BytesIO(bundle.read(name)))["value"]
        assert cleaned.to_list()[:2] == [float("inf"), float("-inf")]
        assert cleaned.is_nan().to_list()[2] is True
        assert cleaned.to_list()[3] is None


def test_demo_audit_preview_export_and_reproduce(client, tmp_path):
    base = create_session(client)
    datasets = client.post(base + "/demo").json()
    config = {"roles": {datasets[0]["id"]: "train", datasets[1]["id"]: "test"},
              "target": "label", "groups": ["subject_id"], "features": ["age", "city"]}
    jid = client.post(base + "/jobs", json={"kind": "audit", "config": config}).json()["id"]
    assert wait(client, base, jid)["status"] == "complete"
    result = client.get(f"{base}/jobs/{jid}/result").json()
    assert result["finding_count"] >= 5
    findings = client.get(f"{base}/jobs/{jid}/findings?limit=2").json()
    assert len(findings["items"]) == 2
    assert findings["total"] == result["finding_count"]
    folder = client.app.state.root / base.rsplit("/", 1)[1] / jid
    stored = json.loads((folder / "result.json").read_text(encoding="utf-8"))
    assert "findings" not in stored
    assert stored["finding_count"] == findings["total"]
    assert (folder / "findings-index.json").exists()
    first = findings["items"][0]
    filtered = client.get(f"{base}/jobs/{jid}/findings", params={"query": first["title"]}).json()
    assert first in filtered["items"]
    recipe = {"steps": [{"op": "deduplicate"}, {"op": "fill", "columns": ["age"], "method": "median"}]}
    req = {"kind": "preview", "config": config, "recipe": recipe}
    preview_id = client.post(base + "/jobs", json=req).json()["id"]
    preview_status = wait(client, base, preview_id)
    assert preview_status["status"] == "complete", preview_status
    preview = client.get(f"{base}/jobs/{preview_id}/result").json()
    assert preview["profiles"][datasets[0]["id"]]["rows"] == 7
    req["kind"] = "export"
    export_id = client.post(base + "/jobs", json=req).json()["id"]
    export_status = wait(client, base, export_id)
    assert export_status["status"] == "complete", export_status
    download = client.get(f"{base}/jobs/{export_id}/download")
    assert download.status_code == 200
    bundle = tmp_path / "bundle"
    with zipfile.ZipFile(io.BytesIO(download.content)) as archive:
        assert {"reproduce.py", "recipe.json", "report.html", "requirements.txt"}.issubset(archive.namelist())
        report = archive.read("report.html").decode("utf-8")
        assert "Cleaned export" in report
        assert "7 rows" in report
        assert "Column profile for train.csv" in report
        assert "<main id='report-main'" in report
        archive.extractall(bundle)
    manifest = json.loads((bundle / "recipe.json").read_text())
    sid = base.split("/")[-1]
    source_paths = [client.app.state.root / sid / (d["id"] + ".csv") for d in datasets]
    output = tmp_path / "reproduced"
    proc = subprocess.run([sys.executable, str(bundle / "reproduce.py"), "--output", str(output), *map(str, source_paths)],
                          text=True, capture_output=True, check=False)
    assert proc.returncode == 0, proc.stderr
    for entry in manifest["inputs"]:
        assert pl.read_parquet(bundle / entry["output"]).equals(pl.read_parquet(output / entry["output"]))
    bad = tmp_path / "changed.csv"
    bad.write_text("x\n1\n")
    proc = subprocess.run([sys.executable, str(bundle / "reproduce.py"), "--output", str(output), str(bad), str(source_paths[1])], capture_output=True, check=False)
    assert proc.returncode != 0


def test_import_session_isolation_cleanup_and_validation(client):
    first, other = create_session(client), create_session(client)
    response = client.post(first + "/imports", files={"file": ("../../test.csv", b"x,y\n1,2\n1,2\n", "text/csv")})
    assert response.status_code == 200
    assert response.json()["name"] == "test.csv"
    assert client.get(other + "/datasets").json() == []
    assert client.post(first + "/imports", files={"file": ("evil.exe", b"x")}).status_code == 422
    assert client.post(first + "/imports", files={"file": ("empty.csv", b"")}).status_code == 422
    sid = first.split("/")[-1]
    assert (client.app.state.root / sid).exists()
    assert client.delete(first).status_code == 200
    assert not (client.app.state.root / sid).exists()
    assert client.get(first + "/datasets").status_code == 404


def test_csrf_and_host_checks(client):
    assert client.post("/api/sessions", headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post("/api/sessions", headers={"X-DatasetMedic": ""}).status_code == 403
    assert client.get("/api/health", headers={"Host": "evil.example"}).status_code == 400


def test_failed_job_is_visible(client):
    base = create_session(client)
    client.post(base + "/imports", files={"file": ("empty.csv", b"x,y\n")})
    jid = client.post(base + "/jobs", json={"kind": "audit"}).json()["id"]
    status = wait(client, base, jid)
    assert status["status"] == "failed"
    assert "at least one data row" in status["error"]
    assert "error_step" not in status
    assert client.get(f"{base}/jobs/{jid}/result").status_code == 409


@pytest.mark.parametrize("artifact", ["result.json", "error.json", None])
def test_job_exit_rechecks_terminal_files_before_reporting_a_crash(client, artifact):
    base = create_session(client)
    sid = base.rsplit("/", 1)[1]
    folder = client.app.state.root / sid / "finishing"
    folder.mkdir()

    class FinishingProcess:
        def is_alive(self):
            # Deterministically publish between the first file check and exit check.
            if artifact:
                payload = {"error": "Step 2 (fill): invalid", "error_step": 2, "error_operation": "fill"}
                (folder / artifact).write_text(json.dumps(payload if artifact == "error.json" else {}), encoding="utf-8")
            return False

    client.app.state.sessions[sid]["jobs"]["finishing"] = {
        "folder": folder, "process": FinishingProcess(), "kind": "preview"}
    status = client.get(base + "/jobs/finishing").json()
    if artifact == "result.json":
        assert status["status"] == "complete"
    elif artifact == "error.json":
        assert status["error"] == "Step 2 (fill): invalid"
        assert status["error_step"] == 2
    else:
        assert status["status"] == "failed"
        assert "stopped unexpectedly" in status["error"]


@pytest.mark.parametrize("kind", ["preview", "export"])
def test_recipe_failure_metadata_and_original_import_survive(client, kind):
    base = create_session(client)
    dataset = client.post(base + "/imports", files={"file": ("source.csv", b"x,noise\n1,a\n2,b\n")}).json()
    recipe = {"steps": [{"op": "drop", "columns": ["noise"]},
                        {"op": "fill", "columns": ["noise"], "method": "constant", "value": "x"}]}
    jid = client.post(base + "/jobs", json={"kind": kind, "recipe": recipe}).json()["id"]
    status = wait(client, base, jid)
    assert status["status"] == "failed"
    assert status["error_step"] == 2
    assert status["error_operation"] == "fill"
    assert "Step 2 (fill)" in status["error"]
    assert status["error"].startswith("Step 2 (fill):")
    assert client.get(f"{base}/jobs/{jid}/download").status_code == 409
    assert client.get(f"{base}/jobs/{jid}/result").status_code == 409
    audit_id = client.post(base + "/jobs", json={"kind": "audit"}).json()["id"]
    assert wait(client, base, audit_id)["status"] == "complete"
    profile = client.get(f"{base}/jobs/{audit_id}/result").json()["profiles"][dataset["id"]]
    assert profile["sample"] == [{"x": 1, "noise": "a"}, {"x": 2, "noise": "b"}]


def test_cancel_worker_and_no_download(client):
    base = create_session(client)
    client.post(base + "/demo")
    jid = client.post(base + "/jobs", json={"kind": "audit"}).json()["id"]
    assert client.delete(f"{base}/jobs/{jid}").json()["status"] == "cancelled"
    assert client.get(f"{base}/jobs/{jid}").json()["status"] == "cancelled"
    assert client.get(f"{base}/jobs/{jid}/download").status_code == 409


def test_parquet_import_and_role_validation(client, tmp_path):
    base = create_session(client)
    path = tmp_path / "data.parquet"
    pl.DataFrame({"x": [1, 2], "city": ["東京", "Delhi"]}).write_parquet(path)
    d = client.post(base + "/imports", files={"file": ("input.parquet", path.read_bytes())}).json()
    assert client.post(base + "/jobs", json={"kind": "audit", "config": {"roles": {"unknown": "train"}}}).status_code == 422
    jid = client.post(base + "/jobs", json={"kind": "audit", "config": {"roles": {d["id"]: "train"}}}).json()["id"]
    assert wait(client, base, jid)["status"] == "complete"


def test_rejected_uploads_do_not_leave_files_or_entries(client, monkeypatch):
    import datasetmedic.app as app_module

    base = create_session(client)
    folder = client.app.state.root / base.split("/")[-1]
    monkeypatch.setattr(app_module, "MAX_FILE_BYTES", 4)
    assert client.post(base + "/imports", files={"file": ("too-big.csv", b"x\n123\n")}).status_code == 413
    assert list(folder.iterdir()) == []
    assert client.get(base + "/datasets").json() == []
    assert client.post(base + "/imports", files={"file": ("good.csv", b"x\n1\n")}).status_code == 200
    monkeypatch.setattr(app_module, "MAX_SESSION_BYTES", 7)
    assert client.post(base + "/imports", files={"file": ("combined.csv", b"x\n2\n")}).status_code == 413
    assert len(client.get(base + "/datasets").json()) == 1
    assert len(list(folder.iterdir())) == 1


def test_dataset_count_limit_preserves_first_three(client):
    base = create_session(client)
    for i in range(3):
        assert client.post(base + "/imports", files={"file": (f"{i}.csv", b"x\n1\n")}).status_code == 200
    assert client.post(base + "/imports", files={"file": ("fourth.csv", b"x\n1\n")}).status_code == 422
    assert len(client.get(base + "/datasets").json()) == 3


def test_boolean_export_reproduces_and_preserves_large_id_evidence(client, tmp_path):
    from datasetmedic import __version__

    source = tmp_path / "flags.parquet"
    original = pl.DataFrame({"subject": [2**53, 2**53 + 1, 2**53 + 2], "flag": [True, None, False]})
    original.write_parquet(source)
    base = create_session(client)
    entry = client.post(base + "/imports", files={"file": (source.name, source.read_bytes())}).json()
    recipe = {"steps": [{"op": "fill", "columns": ["flag"], "method": "constant", "value": "true"}]}
    jid = client.post(base + "/jobs", json={"kind": "export", "recipe": recipe}).json()["id"]
    assert wait(client, base, jid)["status"] == "complete"
    result = client.get(f"{base}/jobs/{jid}/result").json()
    assert result["profiles"][entry["id"]]["sample"][1]["subject"] == str(2**53 + 1)
    bundle = tmp_path / "bundle"
    with zipfile.ZipFile(io.BytesIO(client.get(f"{base}/jobs/{jid}/download").content)) as archive:
        archive.extractall(bundle)
    assert f"datasetmedic=={__version__}" in (bundle / "requirements.txt").read_text()
    output = tmp_path / "reproduced"
    proc = subprocess.run([sys.executable, str(bundle / "reproduce.py"), "--output", str(output), str(source)],
                          capture_output=True, text=True, check=False)
    assert proc.returncode == 0, proc.stderr
    exported = pl.read_parquet(bundle / "dataset-1.parquet")
    assert exported["subject"].to_list() == original["subject"].to_list()
    assert exported["flag"].to_list() == [True, True, False]
    assert exported.equals(pl.read_parquet(output / "dataset-1.parquet"))
    assert pl.read_parquet(source).equals(original)
