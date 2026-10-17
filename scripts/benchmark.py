"""Reproducible synthetic benchmark. Writes only temporary files, never user data."""
import argparse
import json
import platform
import tempfile
import time
from pathlib import Path

import polars as pl

from datasetmedic.engine import audit, load_frame


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=100_000)
    args = parser.parse_args()
    n = args.rows
    with tempfile.TemporaryDirectory() as folder:
        p = Path(folder) / "benchmark.parquet"
        pl.DataFrame({"subject": [f"S{i % 10000}" for i in range(n)],
                      "value": [None if i % 17 == 0 else i % 1000 for i in range(n)],
                      "category": [f"C{i % 9}" for i in range(n)], "label": [int(i % 11 == 0) for i in range(n)]}).write_parquet(p)
        start = time.perf_counter()
        frame = load_frame(p)
        loaded = time.perf_counter()
        result = audit({"synthetic": frame}, {"target": "label"})
        ended = time.perf_counter()
        print(json.dumps({"rows": n, "columns": 4, "load_seconds": round(loaded-start, 4),
                          "audit_seconds": round(ended-loaded, 4), "findings": len(result["findings"]),
                          "python": platform.python_version(), "polars": pl.__version__, "platform": platform.platform()}, indent=2))


if __name__ == "__main__":
    main()
