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

One warm local run, measured around the engine calls with `perf_counter`; excludes process startup, file generation, interface rendering and export. This is a small baseline, not a throughput guarantee. Results depend on hardware, storage, data shape, cardinality and cache state. The test does not measure peak memory or compare splits. Re-run the included script on your machine; larger/split benchmarks remain on the development roadmap.
