"""Isolated, cancellable work. Nothing user supplied is executed."""
import json
import platform
import traceback
import zipfile
from importlib.metadata import version
from pathlib import Path

from datasetmedic.engine import RecipeError, audit, fingerprint, load_frame, render_report, safe, transform


def run_job(root: str, spec: dict):
    folder = Path(root)

    def progress(message, percent):
        temp = folder / "progress.tmp"
        temp.write_text(json.dumps({"message": message, "percent": percent}), encoding="utf-8")
        temp.replace(folder / "progress.json")

    try:
        progress("Reading datasets", 5)
        inputs = spec["datasets"]
        frames = {d["id"]: load_frame(d["path"], d.get("options")) for d in inputs}
        request = spec["request"]
        config = request["config"]
        progress("Inspecting columns and comparing splits", 30)
        if request["kind"] == "audit":
            result = audit(frames, config)
        else:
            progress("Applying cleaning recipe", 35)
            cleaned, summary = transform(frames, request["recipe"], config["roles"])
            result = safe(summary)
            if request["kind"] == "export":
                progress("Preparing reproducible export", 60)
                output = folder / "bundle"
                output.mkdir()
                fmt = request["output_format"]
                manifest = []
                for i, d in enumerate(inputs, 1):
                    filename = f"dataset-{i}.{fmt}"
                    frame = cleaned[d["id"]]
                    if fmt == "csv":
                        frame.write_csv(output / filename)
                    else:
                        frame.write_parquet(output / filename)
                    manifest.append({"id": d["id"], "original_name": d["name"], "output": filename,
                                     "source_sha256": fingerprint(Path(d["path"]))})
                recipe = {"recipe": request["recipe"], "roles": config["roles"],
                          "options": {d["id"]: d.get("options", {}) for d in inputs}, "inputs": manifest,
                          "output_format": fmt, "fitted_values": summary["fitted_values"]}
                (output / "recipe.json").write_text(json.dumps(safe(recipe), indent=2), encoding="utf-8")
                requirements = "\n".join(f"{name}=={version(name)}" for name in ("datasetmedic", "polars")) + "\n"
                (output / "requirements.txt").write_text(requirements, encoding="utf-8")
                (output / "reproduce.py").write_text('''"""Run: python reproduce.py --output reproduced ORIGINAL_FILE_1 [ORIGINAL_FILE_2 ...]"""
import argparse
import json
from pathlib import Path
from datasetmedic.engine import execute_recipe, fingerprint

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("--output", required=True)
p.add_argument("inputs", nargs="+")
args = p.parse_args()
config = json.loads(Path(__file__).with_name("recipe.json").read_text(encoding="utf-8"))
if len(args.inputs) != len(config["inputs"]):
    p.error("Provide one original source file per recipe entry, in the recorded order.")
paths = {}
for entry, path in zip(config["inputs"], args.inputs):
    if fingerprint(Path(path)) != entry["source_sha256"]:
        p.error("Source fingerprint differs: " + path)
    paths[entry["id"]] = path
execute_recipe(paths, config["recipe"], config["roles"], args.output,
               config["options"], config["output_format"])
print("Reproduced datasets written to", args.output)
''', encoding="utf-8")
                names = {d["id"]: d["name"] for d in inputs}
                report = audit(cleaned, config)
                (output / "report.html").write_text(render_report(report, names, cleaned=True), encoding="utf-8")
                (output / "summary.json").write_text(json.dumps(safe(summary), indent=2), encoding="utf-8")
                (output / "README.txt").write_text(
                    "DatasetMedic export\n\nreport.html describes the CLEANED datasets.\n"
                    f"Install DatasetMedic {version('datasetmedic')} from its GitHub release wheel, then requirements.txt.\n"
                    "Run reproduce.py --output NEW_DIRECTORY with original source paths in recipe.json order.\n"
                    "Original sources are not included. Source fingerprints must match.\n"
                    "Cleaning can create nulls on failed conversions; inspect summary.json.\n"
                    f"Generated with Python {platform.python_version()}.\n", encoding="utf-8")
                with zipfile.ZipFile(folder / "export.zip", "w", zipfile.ZIP_DEFLATED) as archive:
                    for path in output.iterdir():
                        archive.write(path, path.name)
                result["download"] = True
        progress("Complete", 100)
        (folder / "result.tmp").write_text(json.dumps(safe(result), allow_nan=False), encoding="utf-8")
        (folder / "result.tmp").replace(folder / "result.json")
    except Exception as exc:  # noqa: BLE001 -- process boundary must return actionable errors to the UI.
        # Logs stay local. API exposes the useful message, not a traceback or local paths.
        (folder / "traceback.txt").write_text(traceback.format_exc(), encoding="utf-8")
        error = {"error": f"{type(exc).__name__}: {exc}"}
        if isinstance(exc, RecipeError):
            error.update(error=str(exc), error_step=exc.step, error_operation=exc.operation)
        (folder / "error.tmp").write_text(json.dumps(error), encoding="utf-8")
        (folder / "error.tmp").replace(folder / "error.json")
