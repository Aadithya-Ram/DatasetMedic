import json
import tomllib
from importlib.metadata import version
from pathlib import Path

from datasetmedic import __version__


def test_release_versions_are_consistent():
    root = Path(__file__).resolve().parents[1]
    project = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    frontend = json.loads((root / "web" / "package.json").read_text(encoding="utf-8"))
    assert project["project"]["version"] == frontend["version"] == __version__ == version("datasetmedic")
