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
    recipe = {"steps": [{"op": "deduplicate"}, {"op": "fill", "columns": ["age"], "method": "median"}]}
    req = {"kind": "preview", "config": config, "recipe": recipe}
    preview_id = client.post(base + "/jobs", json=req).json()["id"]
    assert wait(client, base, preview_id)["status"] == "complete"
    preview = client.get(f"{base}/jobs/{preview_id}/result").json()
    assert preview["profiles"][datasets[0]["id"]]["rows"] == 7
    req["kind"] = "export"
    export_id = client.post(base + "/jobs", json=req).json()["id"]
    assert wait(client, base, export_id)["status"] == "complete"
    download = client.get(f"{base}/jobs/{export_id}/download")
    assert download.status_code == 200
    bundle = tmp_path / "bundle"
    with zipfile.ZipFile(io.BytesIO(download.content)) as archive:
        assert {"reproduce.py", "recipe.json", "report.html", "requirements.txt"}.issubset(archive.namelist())
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
    assert client.get(f"{base}/jobs/{jid}/result").status_code == 409


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
