# DatasetMedic 0.2.0

A local browser workbench for inspecting tabular datasets before training, with editable recipes and more reliable data evidence.

## New in this release

- Edit or reorder cleaning steps with keyboard controls and restored focus. Changes require a fresh preview before export; cancelling an edit preserves the approved recipe.
- Add a skip-to-workbench link and announce selected filters/columns and current navigation location.
- Fix boolean missing-value fills entered as text (`true`, `false`, `1`, `0`). Ambiguous values are rejected.
- Show large integer identifiers exactly in evidence, avoiding browser number rounding. Source/export numeric types are preserved.
- Expand regression coverage for hash collisions, row/column/upload limits, failed-import cleanup and export reproduction.

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
