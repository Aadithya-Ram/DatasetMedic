# Benchmark notes

## Initial local measurement — October 17, 2026

Command: `python scripts/benchmark.py --rows 100000`.

| Property | Result |
| --- | --- |
| Synthetic data | 100,000 rows × 4 columns, Parquet |
| Columns | Subject ID, numeric value with nulls, category, binary label |
| Load | 0.0035 seconds |
| Audit | 0.0247 seconds |
| Findings | 3 |
| Runtime | Python 3.14.4, Polars 1.44.2 |
| Platform | Windows 11, build 26300 |

## One-million-row follow-up

`python scripts/benchmark.py --rows 1000000` on the same environment: 1,000,000 rows × 4 columns; load **0.0391 seconds**, audit **0.3444 seconds**, 3 findings.

Each result above is one warm local run, measured around engine calls with `perf_counter`; excludes process startup, file generation, interface rendering and export. These are baselines, not throughput guarantees. Results depend on hardware, storage, data shape, cardinality and cache state. The original script does not measure peak memory or compare splits; the separate benchmark below covers those cases without changing the historical fixture.

## Split auditing and process memory — October 18, 2026

Run from a source checkout with DatasetMedic installed:

```console
python scripts/benchmark_splits.py --rows 100000 --repeat 3
python scripts/benchmark_splits.py --rows 1000000 --repeat 3
```

`--rows` is **per split**. Each fresh child process generates training and test Parquet files with five columns: a unique feature ID, a subject ID, a numeric value with nulls, a categorical value and a binary target. Exact feature overlap defaults to 10%; shared subjects independently default to 20%. The comparison uses feature ID, value and category, with null equality. Every trial checks both observed counts against the known fixture and fails on a mismatch. No timing threshold determines success.

| Measurement | 100,000 rows per split | 1,000,000 rows per split |
| --- | ---: | ---: |
| Total rows | 200,000 | 2,000,000 |
| Median load time | 0.0165 s | 0.0285 s |
| Median complete audit time | 0.1110 s | 0.8120 s |
| Audit range across three runs | 0.1065–0.1133 s | 0.8109–0.9122 s |
| Maximum child process peak working set | 192.59 MiB | 852.43 MiB |
| Estimated combined loaded frame buffers | 6.51 MiB | 65.09 MiB |
| Combined compressed Parquet size | 0.55 MiB | 4.17 MiB |
| Verified distinct matching feature records | 10,000 | 100,000 |
| Verified shared non-null subject IDs | 20,000 | 200,000 |

Raw per-trial JSON: [100k per split](benchmarks/splits-100k-windows.json), [1m per split](benchmarks/splits-1m-windows.json). Environment: Windows 11 build 26300, Python 3.14.4, Polars 1.44.2, DatasetMedic 0.2.0 engine, Intel Family 6 Model 183, 24 logical CPUs and 24 Polars threads. These runs used the current source checkout after the searchable-column update.

Times cover loading both Parquet files and the complete engine audit, including profiling, duplicates, class balance, exact split comparison, group comparison and descriptive summaries. They exclude process startup, synthetic generation, file writing, UI, server overhead and export. Each repetition uses a fresh process; the filesystem cache is **not** flushed. Do not label these cold-disk measurements or compare them directly with the older four-column, single-dataset fixture.

Memory is the OS high-water mark for the child through audit completion, including interpreter/library imports, synthetic generation, Parquet writing, loading and auditing. It excludes the parent runner, app server and browser. Windows uses [PeakWorkingSetSize](https://learn.microsoft.com/en-us/windows/win32/api/psapi/ns-psapi-process_memory_counters), which measures peak working set rather than private committed memory. Linux/macOS use [resource.getrusage](https://docs.python.org/3/library/resource.html); the platform-specific `ru_maxrss` units are normalized to bytes. OS memory metrics are not directly interchangeable across platforms. Polars frame-size estimates exclude temporary work buffers and the rest of the process.

The compressed file size and retained frame size both substantially understate process memory in this fixture. The application's row/file limits are guardrails; they do not promise a dataset fits available RAM. Wider schemas, longer strings, different cardinalities and multiple running programs can change memory and timing materially. This is a synthetic two-split baseline, not a measurement of every workflow. Future work should profile representative wider tables and identify allocation hotspots before changing engine behavior.

Adjust contamination independently with `--record-overlap 0..100` and `--group-overlap 0..100`; percentages are rounded down to whole rows. `--repeat` accepts 1–10 fresh processes. Files stay in temporary directories and are removed on normal completion. The script needs no extra dependency beyond the project's Polars installation. CI exercises small fixtures with zero, partial and complete overlap on Windows and Linux; it imposes no hardware-dependent performance threshold.
