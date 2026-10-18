"""Fail a release build that does not contain its complete production interface."""
import tomllib
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
release_version = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"]
wheel = root / "dist" / f"datasetmedic-{release_version}-py3-none-any.whl"
with zipfile.ZipFile(wheel) as archive:
    names = archive.namelist()
    assert "datasetmedic/static/index.html" in names, "Build the frontend before packaging."
    assert any(n.startswith("datasetmedic/static/assets/") and n.endswith(".js") for n in names)
    assert any(n.startswith("datasetmedic/static/assets/") and n.endswith(".css") for n in names)
    assert "datasetmedic/engine.py" in names
    assert f"datasetmedic-{release_version}.dist-info/METADATA" in names
print("Wheel includes the analysis engine, launcher, and complete production interface.")
