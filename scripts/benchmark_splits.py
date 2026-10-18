"""Isolated split-audit benchmark with known contamination and OS peak memory.

Only synthetic Parquet files in temporary directories are used. Timings exclude
fixture generation and process startup; peak memory includes the whole child run.
"""
import argparse
import ctypes
import json
import os
import platform
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import polars as pl

from datasetmedic import __version__
from datasetmedic.engine import audit, load_frame


def bounded_int(low, high):
    def parse(value):
        number = int(value)
        if not low <= number <= high:
            raise argparse.ArgumentTypeError(f"must be between {low} and {high}")
        return number
    return parse


def peak_memory():
    """OS lifetime high-water mark, not Python-only allocations or private bytes."""
    if sys.platform == "win32":
        from ctypes import wintypes

        class Counters(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD)] + [
                (name, ctypes.c_size_t) for name in (
                    "PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage", "QuotaPagedPoolUsage",
                    "QuotaPeakNonPagedPoolUsage", "QuotaNonPagedPoolUsage", "PagefileUsage", "PeakPagefileUsage")]

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        kernel.GetCurrentProcess.argtypes = []
        psapi = ctypes.WinDLL("psapi", use_last_error=True)
        psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
        psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
        counters = Counters()
        counters.cb = ctypes.sizeof(counters)
        if not psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
            raise ctypes.WinError(ctypes.get_last_error())
        return counters.PeakWorkingSetSize, "Windows PeakWorkingSetSize"
    if sys.platform in ("linux", "darwin"):
        import resource

        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return int(peak * (1 if sys.platform == "darwin" else 1024)), "ru_maxrss"
    raise RuntimeError("Peak memory measurement supports Windows, Linux and macOS only")


def synthetic_frame(rows, record_overlap=None, group_overlap=None):
    index = pl.int_range(0, rows, eager=True).alias("index")
    frame = pl.DataFrame(index)
    feature = pl.col("index")
    subject = pl.col("index")
    if record_overlap is not None:
        feature = pl.when(feature < record_overlap).then(feature).otherwise(feature + rows)
        subject = pl.when(subject < group_overlap).then(subject).otherwise(subject + rows)
    return frame.select(feature.alias("feature_id"), subject.alias("subject_id")).with_columns(
        pl.when(pl.col("feature_id") % 17 == 0).then(None).otherwise(pl.col("feature_id") % 1000).alias("value"),
        pl.concat_str(pl.lit("C"), (pl.col("feature_id") % 9).cast(pl.String)).alias("category"),
        (pl.col("feature_id") % 11 == 0).cast(pl.Int64).alias("label"),
    )


def trial(args):
    expected = {"split_overlap": args.rows * args.record_overlap // 100,
                "group_overlap": args.rows * args.group_overlap // 100}
    with tempfile.TemporaryDirectory(prefix="datasetmedic-benchmark-") as folder:
        train_path, test_path = Path(folder) / "train.parquet", Path(folder) / "test.parquet"
        synthetic_frame(args.rows).write_parquet(train_path)
        synthetic_frame(args.rows, expected["split_overlap"], expected["group_overlap"]).write_parquet(test_path)
        start = time.perf_counter()
        frames = {"train": load_frame(train_path), "test": load_frame(test_path)}
        loaded = time.perf_counter()
        result = audit(frames, {"roles": {"train": "train", "test": "test"}, "target": "label",
                                "groups": ["subject_id"], "features": ["feature_id", "value", "category"]})
        ended = time.perf_counter()
        observed = {kind: sum(f["count"] for f in result["findings"] if f["kind"] == kind) for kind in expected}
        if observed != expected:
            raise RuntimeError(f"Incorrect contamination evidence: expected {expected}, observed {observed}")
        peak, method = peak_memory()
        return {"load_seconds": loaded - start, "audit_seconds": ended - loaded,
                "peak_process_bytes": peak, "peak_memory_method": method,
                "loaded_frame_bytes": sum(frame.estimated_size() for frame in frames.values()),
                "parquet_bytes": train_path.stat().st_size + test_path.stat().st_size,
                "expected_counts": expected, "observed_counts": observed, "verified": True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=bounded_int(1, 2_000_000), default=100_000, help="Rows per split")
    parser.add_argument("--repeat", type=bounded_int(1, 10), default=3, help="Fresh child processes")
    parser.add_argument("--record-overlap", type=bounded_int(0, 100), default=10, help="Percent exact feature overlap")
    parser.add_argument("--group-overlap", type=bounded_int(0, 100), default=20, help="Percent shared subjects")
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker:
        print(json.dumps(trial(args)))
        return
    trials = []
    for _ in range(args.repeat):
        completed = subprocess.run(
            [sys.executable, str(Path(__file__).resolve()), "--worker", "--rows", str(args.rows),
             "--record-overlap", str(args.record_overlap), "--group-overlap", str(args.group_overlap)],
            capture_output=True, text=True, check=False,
        )
        if completed.returncode:
            raise RuntimeError(f"Benchmark worker failed:\n{completed.stderr}")
        trials.append(json.loads(completed.stdout))
    print(json.dumps({
        "rows_per_split": args.rows, "splits": 2, "columns": 5, "repeat": args.repeat,
        "record_overlap_percent": args.record_overlap, "group_overlap_percent": args.group_overlap,
        "median_load_seconds": statistics.median(t["load_seconds"] for t in trials),
        "median_audit_seconds": statistics.median(t["audit_seconds"] for t in trials),
        "max_peak_process_bytes": max(t["peak_process_bytes"] for t in trials),
        "python": platform.python_version(), "polars": pl.__version__, "datasetmedic": __version__,
        "platform": platform.platform(), "processor": platform.processor(), "logical_cpus": os.cpu_count(),
        "polars_threads": pl.thread_pool_size(),
        "timing_scope": "Parquet loading and engine audit only; excludes startup, generation, UI and export",
        "memory_scope": "Child lifetime peak, including imports, generation, writing, loading and audit; excludes parent, server and browser",
        "cache_scope": "Fresh processes; filesystem cache is not flushed",
        "trials": trials,
    }, indent=2))


if __name__ == "__main__":
    main()
