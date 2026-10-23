# DatasetMedic 0.5.1

A performance patch for finding evidence in wide datasets.

## New in this release

- Select the first 12 matching row positions before gathering evidence, avoiding copies of all matching wide rows.
- Preserve exact example records, ordering, 1-based source row numbers, collision-safe labels and originals.
- In three controlled pairs on a synthetic 500-column fixture, median audit time decreased from 32.91 to 17.88 seconds. This is fixture-specific; no universal speedup or substantial memory reduction is claimed.
- Include equivalence tests and raw comparison results with reproducible worker code in the source archive.

The interface, cleaning recipes and exported data semantics remain unchanged. All v0.5.0 features and earlier releases remain available.

## Download and run

Requires Python 3.11+. Download the `.whl` asset and install it with `python -m pip install PATH_TO_WHEEL`, then run `datasetmedic`. The interface is bundled; Node and API keys are not needed.

## Included

- CSV/Parquet import with a synthetic demo.
- Missing values, constants, mixed numeric/text columns, duplicates and class counts.
- Exact feature overlap, shared subjects, schema differences and descriptive split summaries.
- Ordered cleaning recipes, training-only learned fills, failed-conversion evidence and previews.
- Cleaned data, HTML reports, source fingerprints and reproducible Python scripts.
- Responsive interface, scroll reveals, subtle ambient animation and reduced-motion support.
- Local cancellable jobs and session cleanup.

See the README for installation, screenshots, examples and limitations. SHA256SUMS.txt contains checksums for the wheel and source archive.

## Limitations

Flat tabular UTF-8 CSV/Parquet only. Exact comparison does not detect fuzzy similarity or prove freedom from leakage. No automatic model training. Three imported files per session; memory use still depends on data shape. Temporary data is local but unencrypted; graceful shutdown clears it. The Python package is distributed here on GitHub, not published to PyPI.
