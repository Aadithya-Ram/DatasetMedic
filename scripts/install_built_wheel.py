"""Install the current build without shell-specific wildcard expansion."""
import subprocess
import sys
import tomllib
from pathlib import Path

root = Path(__file__).resolve().parents[1]
release_version = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"]
wheel = root / "dist" / f"datasetmedic-{release_version}-py3-none-any.whl"
if not wheel.is_file():
    raise SystemExit("Build the current release wheel before installing it.")
subprocess.run([sys.executable, "-m", "pip", "install", "--force-reinstall", "--no-deps", str(wheel)], check=True)
