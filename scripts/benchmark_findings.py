"""Synthetic persisted-page benchmark; Python allocation peaks exclude fixture writing."""
import argparse
import gc
import hashlib
import json
import platform
import subprocess
import sys
import tempfile
import time
import tracemalloc
from pathlib import Path

from datasetmedic.results import read_findings, write_result


def measure(mode):
    with tempfile.TemporaryDirectory(prefix="datasetmedic-pages-") as folder:
        root = Path(folder)
        findings = [{"id": str(index), "title": f"Missing values {index}", "detail": "Synthetic evidence",
                     "severity": "warning", "columns": ["value"],
                     "examples": [{f"field_{col}": f"row-{row}-" + "x" * 64 for col in range(100)}
                                  for row in range(12)]} for index in range(300)]
        write_result(root, {"profiles": {}, "findings": findings})
        legacy = root / "legacy.json"
        legacy.write_text(json.dumps({"findings": findings}), encoding="utf-8")
        del findings
        gc.collect()
        tracemalloc.start()
        start = time.perf_counter()
        result = json.loads((root / "result.json").read_text(encoding="utf-8")) if mode == "indexed" else json.loads(
            legacy.read_text(encoding="utf-8"))
        page = read_findings(root, result, 0, 20, "", "all")
        elapsed = time.perf_counter() - start
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        assert page["total"] == 300 and [item["id"] for item in page["items"]] == [str(i) for i in range(20)]
        return {"mode": mode, "seconds": elapsed, "peak_python_bytes": peak,
                "page_sha256": hashlib.sha256(json.dumps(page, sort_keys=True).encode()).hexdigest(),
                "legacy_bytes": legacy.stat().st_size, "verified": True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--worker", choices=["legacy", "indexed"], help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker:
        print(json.dumps(measure(args.worker)))
        return
    trials = []
    for _ in range(3):
        for mode in ("legacy", "indexed"):
            completed = subprocess.run([sys.executable, str(Path(__file__).resolve()), "--worker", mode],
                                       check=True, capture_output=True, text=True)
            trials.append(json.loads(completed.stdout))
    assert len({trial["page_sha256"] for trial in trials}) == 1
    print(json.dumps({"python": platform.python_version(), "platform": platform.platform(),
                      "fixture": "300 findings, each with 12 rows x 100 text columns; page size 20",
                      "scope": "Summary and page reads only; tracemalloc tracks Python allocations, not OS memory. "
                               "Excludes audit, writing, server, browser, export; filesystem cache not flushed.",
                      "trials": trials}, indent=2))


if __name__ == "__main__":
    main()
