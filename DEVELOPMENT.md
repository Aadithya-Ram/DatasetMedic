# Development and scheduled work

## Architecture

React/TypeScript is built by Vite into the Python wheel. FastAPI serves it on a loopback socket. Each browser tab receives an unguessable session identifier. Imports are copied into a temporary session directory; each job runs in a spawned Python process. Cancelling terminates that process and removes its output. Session clearing and graceful server shutdown remove temporary copies. Inactive sessions expire after 30 minutes.

`engine.py` owns auditing and transformations. The interface never implements data transformations. Exported reproduction scripts call `execute_recipe` from the same package and require matching source fingerprints. The cleaning recipe is ordered; later steps see earlier results. For learned imputation, one training dataset fits the values; multiple datasets without a training assignment are rejected. A single dataset can fit its own values. Median filling widens integer columns when needed. Tied modes choose the first sorted value. All-null fitted columns produce an explicit error. Conversion failures produce nulls, visible in preview and requiring acknowledgement in the interface before export.

The recipe editor keeps unsaved form values separate from the applied ordered recipe. Save replaces the selected step; Cancel discards the draft. Moving/removing is disabled while editing or running a job. Any saved edit, move or removal invalidates prior preview/export approval. Focus returns to the edited/moved/remaining control, with a live status announcement. Request shapes and the Python engine remain unchanged.

## Local setup

Use Python 3.11+ and Node 22+. Install `.[dev]` in `.venv`, then run `npm ci` in `web`.

```powershell
.venv/Scripts/python scripts/generate_schema.py
cd web
npm run types
npm run build
cd ..
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -m ruff check src tests scripts
.venv/Scripts/python -m datasetmedic.cli --port 8765 --no-browser
```

In a second terminal, run `npm run test:e2e` in `web`. On Linux, set `DATASETMEDIC_PYTHON` to the virtual environment's Python path. Install Chromium once using `npm exec playwright -- install chromium`. Use `npm run dev` for UI iteration while the backend runs on port 8765. API mutations require the `X-DatasetMedic: 1` header and same-origin requests. The shared request types are generated from FastAPI OpenAPI; regenerate after changing the Pydantic models.

## Release checks

Build the interface first, then `python -m build` and `python scripts/check_wheel.py`. Install the wheel in a clean environment and check both `/` and `/api/health`. Run `python scripts/benchmark.py --rows 100000` for a synthetic benchmark. Capture accurate demo screenshots with `node web/scripts/capture.mjs` while the app runs on port 8765. Screenshots use synthetic fixtures only.

GitHub Actions checks Windows/Linux and Python 3.11/3.14, builds the wheel and performs a package smoke check. Linux/Python 3.11 additionally runs the browser suite.

## Work schedule and locking

The chat heartbeat runs at 10:00, 16:00 and 21:00 Asia/Kolkata through October 30, 2026. The computer must be awake, online, and the desktop app running. Sessions may make several meaningful commits; no empty commits, backdating, or artificial splitting. Do not defer completed work to create activity later.

On October 18 an observed 21:00 UTC trigger arrived at 02:30 India time. The stored recurrence was adjusted to 04:30, 10:30 and 15:30 UTC, corresponding to the intended local slots. Preserve the intended India-time schedule; verify the next actual trigger rather than assuming the recurrence is interpreted in the Windows timezone.

Before edits, start `python scripts/work_session.py` in a retained terminal tool session (TTY enabled). Wait for `LOCK ACQUIRED`; preserve its session ID and keep it alive through edits, checks and pushes. If it returns 75/BUSY, skip the run. Release by sending a newline to that session. This uses an OS-backed advisory lock: a crashed holder releases automatically. Every automated writer must participate in this convention.

Inspect status and remote history first. Preserve unrelated user edits; never reset or force-push. Validate the selected increment, commit by coherent behavior, push to `main`, then verify local and remote commit IDs. Git's configured credential manager handles authentication. `scripts/github_release.py --configure` configures repository metadata and the account-linked no-reply commit email. It never writes tokens to disk. `--publish` reads the version from pyproject.toml, validates SHA256SUMS against that version's wheel/source archive, tags the current committed revision, and uploads only those files. Never replace an existing asset silently.

For a new release, update Python's `__version__`, pyproject.toml and web/package.json together; refresh the npm lockfile and OpenAPI contract, reinstall the editable package and run the version consistency test. Build the interface before the wheel. `scripts/install_built_wheel.py` selects the current project version even if an older wheel is already installed. Prepare SHA256SUMS for only the current wheel/source archive and run `python scripts/github_release.py --check-release` before publishing. Preserve prior published tags/assets. JSON evidence stringifies integers outside JavaScript's safe integer range; this affects display/report values only, not numeric columns in source or cleaned exports.

Update ROADMAP.md with real results and the next useful work. Continue evidence-based improvements after v1: better diagnostics, accessibility, performance, error handling and documentation. Notify on meaningful progress, failures, necessary user action or completion; skip unchanged status updates.

## Boundaries

Three datasets per session, 250 MiB per file, 750 MiB combined, 2 million rows and 500 columns per file. These are guardrails, not a promise that every dataset within them fits available RAM. Polars operations may materialize data. Temporary storage is not encrypted. Closing a tab performs best-effort cleanup; browser crashes fall back to expiry or server shutdown. Force-killing the server can leave its temporary directory behind. Do not expose the server on a network or deploy it as a multi-user service. Nested Parquet types and non-UTF-8 CSV are not supported in v1. CSV export can lose type metadata and represents null as an empty field. Exported reports and datasets may contain sensitive values; treat them as you would the source.

Exact matching compares the selected feature values, including null equality, without normalization. Group checks ignore null group IDs. Split checks run only between different assigned split roles. Identifiers left in feature selection can hide duplicates; deliberately choose meaningful features. This tool cannot prove that data is leakage-free or decide whether a difference is appropriate for your research.
