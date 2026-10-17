"""Regenerate OpenAPI without starting a server or retaining session storage."""
import json
import shutil
from pathlib import Path

from datasetmedic.app import create_app

app = create_app()
try:
    Path("web/openapi.json").write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
finally:
    shutil.rmtree(app.state.root, ignore_errors=True)
