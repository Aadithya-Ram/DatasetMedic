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

## Wider schemas — October 21, 2026

The source benchmark now accepts `--columns 5..500` (default 5). Columns beyond the original five are deterministic nullable Int64 values derived from the feature ID. They increase profiling, within-split row comparison and evidence width. Exact split matching deliberately keeps the same three selected features at every width; this does **not** measure hashing hundreds of selected features. Known exact/group overlap and every loaded/profiled column count are verified in each trial. The default five-column fixture is preserved.

```console
python scripts/benchmark_splits.py --rows 100000 --columns 5 --repeat 3
python scripts/benchmark_splits.py --rows 100000 --columns 50 --repeat 3
python scripts/benchmark_splits.py --rows 100000 --columns 100 --repeat 3
python scripts/benchmark_splits.py --rows 10000 --columns 500 --repeat 3
```

These four measurements were run sequentially on the same Windows 11/Python 3.14.4/Polars 1.44.2 environment described above, using the DatasetMedic 0.5.0 engine and the updated source benchmark. Each cell below is a median of three fresh-process trials except peak memory, which is the largest observed child high-water mark.

| Rows per split | Columns per split | Full audit | Profile calls inside audit | Other audit work | Peak child working set |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100,000 | 5 | 0.0971 s | 0.0178 s | 0.0773 s | 198.66 MiB |
| 100,000 | 50 | 0.8235 s | 0.3114 s | 0.5109 s | 409.47 MiB |
| 100,000 | 100 | 2.1912 s | 0.7155 s | 1.4757 s | 547.69 MiB |
| 10,000 | 500 | 37.0989 s | 2.2909 s | 34.8079 s | 801.67 MiB |

Raw JSON: [100k × 5](benchmarks/width-100k-5-windows.json), [100k × 50](benchmarks/width-100k-50-windows.json), [100k × 100](benchmarks/width-100k-100-windows.json), [10k × 500](benchmarks/width-10k-500-windows.json). Full audit ranges were 0.0911–0.1025 s, 0.8071–0.8386 s, 2.1207–2.3594 s and 29.7187–39.9660 s respectively. All runs verified the expected overlaps: 10,000 exact records/20,000 subjects for 100k-row splits, and 1,000/2,000 for 10k-row splits.

Profile durations come from a benchmark-only timer around the engine's two existing profile calls inside a **single** audit; no extra profiling pass warms the data. The original function is restored afterwards. Other audit time is the residual, including checks, evidence construction, split comparisons and timer overhead; it is not a measurement of any one of those tasks. Per-trial phase durations sum to the full audit duration, but separately computed medians need not sum. The production engine is unchanged.

The 500-column fixture has many nullable columns and wide example records. It took much longer despite fewer rows, and its retained frame estimate was only 77.36 MiB while child peak working set reached 801.67 MiB. These figures justify further investigation of work outside profiling; they do not identify its cause. In particular, this benchmark does not measure per-operation allocations, server result serialization, browser rendering, cancellation latency or HTML export. The lifetime peak still includes fixture generation and loading. All earlier timing/cache/memory limitations apply. Do not extrapolate the 100-column result to 500 columns or treat the row/column caps as capacity guarantees. A useful next experiment is to measure evidence construction and the remaining checks separately before changing their behavior.

## Evidence sampling improvement — October 22, 2026

Instrumenting the existing evidence function confirmed a substantial cost in the same 10,000-row-per-split, 500-column fixture. The previous implementation filtered a full-width dataframe before taking its first 12 rows. The source implementation now filters row positions first, limits them to 12 and gathers only those rows. Counts, example ordering, 1-based source row numbers, collision-safe labels and JSON values are preserved. Other audit logic is unchanged.

Three alternating pairs of fresh children compared the exact evidence function from release commit `8bd6d1f` with the new function, using the same current engine and benchmark for both. Each child timed all 992 evidence calls inside its one complete audit. Measurements ran sequentially before tests/builds.

| Measurement | Released evidence function | Row-position sampling |
| --- | ---: | ---: |
| Median full audit | 32.9077 s | 17.8829 s |
| Median evidence calls within audit | 22.6517 s | 7.6366 s |
| Maximum child peak working set | 835.34 MiB | 823.38 MiB |

Median audit duration decreased about **46% in this synthetic fixture**. This is not a universal speedup or a material memory-reduction claim: wide retained examples still consume substantial memory, and the peak difference is small. Both variants verified the same expected exact/group overlap counts; regression tests compare complete evidence records with the original algorithm for scalar/nullable masks, empty/short/truncated samples, Unicode, large integers, reserved-name collisions and unchanged source frames. All previous scope/cache/memory limitations still apply.

[Raw paired results and executable worker code](benchmarks/evidence-comparison-windows.json) record the measured working-file hash, control revision, per-trial timings, runtime and order. To reproduce a child from a source checkout containing both revisions, load `worker_code` from that JSON and run `[sys.executable, '-c', worker_code, 'legacy']` or the `optimized` variant. The legacy worker extracts only the original evidence function from the recorded commit; the optimized worker uses the checked-out function. Run multiple pairs sequentially and compare distributions. The improvement is included in v0.5.1; the original v0.5.0 release remains preserved.

## Indexed finding-page reads — October 24, 2026

`python scripts/benchmark_findings.py` creates 300 synthetic findings, each containing 12 rows × 100 text columns. It compares reading page one (20 findings) from a legacy inline result versus a small summary plus indexed records. Three alternating pairs use fresh child processes. All six complete response payloads have the same SHA256, as well as verified counts and IDs. The legacy JSON fixture is 29.59 MiB.

| Measurement | Inline result | Indexed records |
| --- | ---: | ---: |
| Median summary + page read | 0.2815 s | 0.0181 s |
| Largest traced Python allocation peak | 79.43 MiB | 3.83 MiB |

[Raw trials](benchmarks/findings-pages-windows.json) record Python 3.14.4 and Windows platform details. These are `tracemalloc` Python-allocation peaks during reading/filtering, **not OS working sets or total app RAM**. Fixture generation/writing, audit construction, worker publication, server response serialization, browser rendering and export are excluded. Filesystem cache is not flushed. Do not compare these peaks directly with the earlier OS-memory tables or assume the same savings for every dataset.

The new temporary format stores the full findings once, plus a small metadata index and result summary. Queries still filter the whole audit before reading the chosen records; metadata remains proportional to finding count. Wide retained evidence, disk usage and engine audit peaks remain relevant. Atomic-completion and byte-offset/Unicode regressions accompany the change. It is available on main for the next release; published v0.5.1 assets are preserved.
