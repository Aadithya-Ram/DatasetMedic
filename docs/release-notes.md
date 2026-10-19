# DatasetMedic 0.3.0

A local browser workbench for inspecting tabular datasets before training, with easier column selection and clearer local imports.

## New in this release

- Search group, feature and cleaning columns by name, including Unicode. Review selected columns without losing choices when filtering. Scrollable lists stay compact with 500 columns.
- Check a complete import batch before copying: file extension, empty files, file size and session limits. The server continues to enforce its own checks.
- Show the current file and batch position during local copying. Explain partial failures, preserve confirmed successful imports and allow retrying remaining files.
- Add a source benchmark that verifies known exact/group contamination in fresh processes, with OS memory measurements and committed raw results.
- Fix automatic browser-test server startup on Windows by quoting the Python path.

The v0.2.0 recipe editor, keyboard navigation, boolean fill and exact large-ID display improvements remain included. Earlier releases are preserved.

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
