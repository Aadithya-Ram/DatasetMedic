"""Loopback-only API and packaged frontend with isolated dataset sessions."""
from __future__ import annotations

import asyncio
import json
import multiprocessing as mp
import secrets
import shutil
import tempfile
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from datasetmedic import __version__
from datasetmedic.models import JobRequest
from datasetmedic.worker import run_job

MAX_FILE_BYTES = 250 * 1024 * 1024
MAX_SESSION_BYTES = 750 * 1024 * 1024
TTL = 30 * 60


def create_app(storage: str | None = None) -> FastAPI:
    root = Path(storage) if storage else Path(tempfile.mkdtemp(prefix="datasetmedic-"))
    root.mkdir(parents=True, exist_ok=True)
    sessions: dict = {}
    mutex = threading.RLock()

    def stop(job):
        process = job.get("process")
        if process and process.is_alive():
            process.terminate()
            process.join(timeout=5)
            if process.is_alive():
                process.kill()
                process.join(timeout=2)

    def remove(sid):
        with mutex:
            s = sessions.pop(sid, None)
            if s:
                for job in s["jobs"].values():
                    stop(job)
                shutil.rmtree(root / sid, ignore_errors=True)

    async def reap():
        while True:
            await asyncio.sleep(60)
            for sid, s in list(sessions.items()):
                if time.monotonic() - s["touched"] > TTL:
                    remove(sid)

    @asynccontextmanager
    async def lifespan(app):
        task = asyncio.create_task(reap())
        yield
        task.cancel()
        for sid in list(sessions):
            remove(sid)
        shutil.rmtree(root, ignore_errors=True)

    app = FastAPI(title="DatasetMedic", version=__version__, lifespan=lifespan)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])
    app.state.sessions = sessions
    app.state.root = root

    @app.middleware("http")
    async def local_only(request: Request, call_next):
        if request.url.path.startswith("/api/") and request.method not in ("GET", "HEAD", "OPTIONS"):
            origin = request.headers.get("origin")
            if origin and origin != str(request.base_url).rstrip("/"):
                return JSONResponse({"detail": "Cross-origin requests are not allowed."}, status_code=403)
            if request.method != "DELETE" and request.headers.get("x-datasetmedic") != "1":
                return JSONResponse({"detail": "Missing local app header."}, status_code=403)
        return await call_next(request)

    def session(sid):
        s = sessions.get(sid)
        if not s:
            raise HTTPException(404, "Session expired. Start a new session and import your files again.")
        s["touched"] = time.monotonic()
        return s

    def job_status(job):
        folder = job["folder"]
        if job.get("cancelled"):
            return {"status": "cancelled", "message": "Cancelled", "percent": 0}
        if (folder / "error.json").exists():
            return {"status": "failed", **json.loads((folder / "error.json").read_text(encoding="utf-8"))}
        if (folder / "result.json").exists():
            return {"status": "complete", "message": "Complete", "percent": 100}
        progress = {"message": "Starting local worker", "percent": 0}
        if (folder / "progress.json").exists():
            try:
                progress = json.loads((folder / "progress.json").read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                pass
        if not job["process"].is_alive():
            return {"status": "failed", "error": "The analysis worker stopped unexpectedly. Try a smaller dataset."}
        return {"status": "running", **progress}

    def get_job(sid, jid):
        job = session(sid)["jobs"].get(jid)
        if not job:
            raise HTTPException(404, "Job not found.")
        return job

    @app.get("/api/health")
    def health():
        return {"status": "ok", "version": __version__}

    @app.post("/api/sessions")
    def new_session():
        with mutex:
            if len(sessions) >= 8:
                raise HTTPException(429, "Close or clear another DatasetMedic tab before opening more sessions.")
            sid = secrets.token_urlsafe(24)
            (root / sid).mkdir()
            sessions[sid] = {"datasets": [], "jobs": {}, "touched": time.monotonic()}
            return {"id": sid}

    @app.post("/api/sessions/{sid}/heartbeat")
    def heartbeat(sid: str):
        session(sid)
        return {"ok": True}

    @app.delete("/api/sessions/{sid}")
    def delete_session(sid: str):
        remove(sid)
        return {"ok": True}

    @app.get("/api/sessions/{sid}/datasets")
    def datasets(sid: str):
        return [{k: v for k, v in d.items() if k != "path"} for d in session(sid)["datasets"]]

    @app.post("/api/sessions/{sid}/imports")
    async def upload(sid: str, file: Annotated[UploadFile, File()], separator: Annotated[str, Form()] = ","):
        s = session(sid)
        name = Path((file.filename or "dataset.csv").replace("\\", "/")).name
        suffix = Path(name).suffix.lower()
        if suffix not in (".csv", ".parquet") or separator not in [",", ";", "\t", "|"]:
            raise HTTPException(422, "Choose a CSV or Parquet file and a supported separator.")
        if len(s["datasets"]) >= 3:
            raise HTTPException(422, "Import up to three datasets per session. Clear the session to start again.")
        did = secrets.token_hex(8)
        path = root / sid / f"{did}{suffix}"
        size = 0
        try:
            with path.open("wb") as stream:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_FILE_BYTES or size + sum(d["size"] for d in s["datasets"]) > MAX_SESSION_BYTES:
                        raise HTTPException(413, "Import limit: 250 MiB per file and 750 MiB per session.")
                    stream.write(chunk)
            if not size:
                raise HTTPException(422, "This file is empty.")
            entry = {"id": did, "name": name, "path": str(path), "size": size, "options": {"separator": separator}}
            s["datasets"].append(entry)
            return {k: v for k, v in entry.items() if k != "path"}
        except BaseException:
            path.unlink(missing_ok=True)
            raise
        finally:
            await file.close()

    @app.post("/api/sessions/{sid}/demo")
    def demo(sid: str):
        s = session(sid)
        if s["datasets"]:
            raise HTTPException(409, "Clear the session before loading the demo.")
        fixtures = {
            "train.csv": "subject_id,age,income,city,label\nS01,23,42000,Delhi,0\nS02,31,58000,Mumbai,0\nS03,,61000,Pune,0\nS04,42,75000,Delhi,0\nS04,42,75000,Delhi,0\nS05,29,unknown, Chennai ,1\nS06,36,64000,Pune,0\nS07,51,82000,Delhi,0\n",
            "test.csv": "subject_id,age,income,city,label\nS01,23,42000,Delhi,0\nS08,28,51000,Mumbai,1\nS09,,69000,Pune,0\nS03,37,61000,Pune,0\n"}
        entries = []
        for name, data in fixtures.items():
            did = secrets.token_hex(8)
            path = root / sid / f"{did}.csv"
            path.write_text(data, encoding="utf-8")
            entry = {"id": did, "name": name, "path": str(path), "size": path.stat().st_size,
                     "options": {"separator": ","}}
            s["datasets"].append(entry)
            entries.append({k: v for k, v in entry.items() if k != "path"})
        return entries

    @app.post("/api/sessions/{sid}/jobs")
    def start_job(sid: str, request: JobRequest):
        with mutex:
            s = session(sid)
            if not s["datasets"]:
                raise HTTPException(422, "Import at least one dataset first.")
            if any(job_status(j)["status"] == "running" for j in s["jobs"].values()):
                raise HTTPException(409, "Wait for the current job or cancel it first.")
            known = {d["id"] for d in s["datasets"]}
            if set(request.config.roles) - known:
                raise HTTPException(422, "A dataset in the configuration is no longer available.")
            if sum(r == "train" for r in request.config.roles.values()) > 1:
                raise HTTPException(422, "Assign at most one training dataset.")
            jid = secrets.token_hex(12)
            folder = root / sid / jid
            folder.mkdir()
            process = mp.get_context("spawn").Process(target=run_job,
                args=(str(folder), {"datasets": s["datasets"], "request": request.model_dump()}), daemon=True)
            process.start()
            s["jobs"][jid] = {"folder": folder, "process": process, "kind": request.kind}
            # Bound retained results and exports; leave the newest 12 for this tab.
            while len(s["jobs"]) > 12:
                oldest = next(iter(s["jobs"]))
                old = s["jobs"].pop(oldest)
                stop(old)
                shutil.rmtree(old["folder"], ignore_errors=True)
            return {"id": jid, "status": "running"}

    @app.get("/api/sessions/{sid}/jobs/{jid}")
    def status(sid: str, jid: str):
        return job_status(get_job(sid, jid))

    @app.delete("/api/sessions/{sid}/jobs/{jid}")
    def cancel(sid: str, jid: str):
        with mutex:
            job = get_job(sid, jid)
            stop(job)
            job["cancelled"] = True
            shutil.rmtree(job["folder"], ignore_errors=True)
            return {"status": "cancelled"}

    def read_result(sid, jid):
        job = get_job(sid, jid)
        if job_status(job)["status"] != "complete":
            raise HTTPException(409, "The job has not completed successfully.")
        return json.loads((job["folder"] / "result.json").read_text(encoding="utf-8"))

    @app.get("/api/sessions/{sid}/jobs/{jid}/result")
    def result(sid: str, jid: str):
        data = read_result(sid, jid)
        if "findings" in data:
            data["finding_count"] = len(data.pop("findings"))
        return data

    @app.get("/api/sessions/{sid}/jobs/{jid}/findings")
    def findings(sid: str, jid: str, offset: int = 0, limit: int = 20):
        data = read_result(sid, jid).get("findings", [])
        offset, limit = max(0, offset), min(100, max(1, limit))
        return {"total": len(data), "items": data[offset:offset + limit]}

    @app.get("/api/sessions/{sid}/jobs/{jid}/download")
    def download(sid: str, jid: str):
        job = get_job(sid, jid)
        if job["kind"] != "export" or job_status(job)["status"] != "complete":
            raise HTTPException(409, "Create an export first.")
        return FileResponse(job["folder"] / "export.zip", filename="datasetmedic-export.zip")

    static = Path(__file__).parent / "static"
    if static.exists():
        app.mount("/", StaticFiles(directory=static, html=True), name="interface")
    return app
