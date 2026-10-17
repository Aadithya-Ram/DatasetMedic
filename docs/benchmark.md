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

Each result is one warm local run, measured around engine calls with `perf_counter`; excludes process startup, file generation, interface rendering and export. These are baselines, not throughput guarantees. Results depend on hardware, storage, data shape, cardinality and cache state. The test does not measure peak memory or compare splits. Re-run the included script on your machine; wider-table, memory and split benchmarks remain on the development roadmap.
