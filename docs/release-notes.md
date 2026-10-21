# DatasetMedic 0.5.0

A local browser workbench for inspecting tabular datasets before training, with accessible offline reports and easier navigation through wide schemas and large audits.

## New in this release

- Search titles, explanations and column names across the entire audit before pagination. Combine severity filters with search, with matching and overall counts kept separate.
- Cancel obsolete finding requests, hide stale cards while loading, and offer retry controls for page errors.
- Search column profiles, show only columns with missing values, and browse 24 cards per page. Reset filters on dataset changes or completed audits.
- Export script-free, offline HTML reports with section navigation, keyboard support, semantic profile/evidence tables, responsive scrolling and print styles. Wide evidence uses field/value tables.
- Clearly label cleaned report snapshots and preserve distinguishable missing, boolean and quoted text evidence. Names and values remain escaped.

Recipe recovery, split comparisons, training-only imputation, import feedback, accessible controls and reproducible exports remain included. Prior releases are preserved.

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
