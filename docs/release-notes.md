# DatasetMedic 0.5.2

More efficient finding pages and consistent missing-value handling.

## New in this release

- Store findings as indexed temporary records; summary and page requests decode only the selected evidence. Preserve ordering, filters, counts and complete sampled records.
- Exclude null/NaN targets from class counts and apply consistent missingness to constants and profile examples.
- Show numeric infinities explicitly in evidence while preserving numeric source and exported values.
- Reject null/NaN fill replacements, including undefined medians and numeric NaN constants after conversion. Failed previews and exports identify the recipe step; reproduction uses the same guard. Training-only fitting remains enforced.
- Include storage benchmarks and regression coverage. A synthetic 29.59 MiB finding fixture used 3.83 MiB peak traced Python allocations for an indexed page read versus 79.43 MiB for the former inline read. This measures page-read allocations, not total application memory or audit construction.

The responsive interface is unchanged. All earlier features and release assets remain available.

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
