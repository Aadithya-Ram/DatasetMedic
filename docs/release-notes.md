# DatasetMedic 0.5.3

A reproduction-safety patch.

## New in this release

- Check all generated output paths against every original input before creating directories or writing cleaned data.
- Reject resolved aliases and existing hard links to source files, including collisions at later output positions. A rejected destination leaves earlier cleaned outputs untouched.
- Reject invalid output formats before creating an output directory.
- Include CSV/Parquet collision and hard-link preservation regressions.

The interface and transformation results for valid destinations are unchanged. This preflight does not make writes transactional or protect against another process changing links after validation; use a separate output directory without concurrent writers. Earlier release assets remain available.

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
