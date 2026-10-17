"""Fail a release build that does not contain its complete production interface."""
import zipfile
from pathlib import Path

wheel = next(Path("dist").glob("*.whl"))
with zipfile.ZipFile(wheel) as archive:
    names = archive.namelist()
    assert "datasetmedic/static/index.html" in names, "Build the frontend before packaging."
    assert any(n.startswith("datasetmedic/static/assets/") and n.endswith(".js") for n in names)
    assert any(n.startswith("datasetmedic/static/assets/") and n.endswith(".css") for n in names)
    assert "datasetmedic/engine.py" in names
print("Wheel includes the analysis engine, launcher, and complete production interface.")
