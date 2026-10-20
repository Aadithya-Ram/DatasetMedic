# DatasetMedic 0.4.0

A local browser workbench for inspecting tabular datasets before training, with clearer split comparisons and easier recovery from recipe mistakes.

## New in this release

- Show each split's row count and missing percentages with count/denominator evidence. Name dataset headers and label mean/median, most frequent values and type differences explicitly.
- Preserve tiny positive missing rates and very small summary statistics instead of displaying them as zero. Comparisons remain descriptive, with display rounding disclosed.
- Identify invalid recipe steps by number and operation, and offer an edit shortcut for the failed recipe snapshot. Changed recipes never reuse an outdated shortcut.
- Recheck terminal files after worker exit so completed results and specific errors survive a status-polling race. Failed jobs remain unavailable for download.
- Share typed job-status metadata between the API and interface. Python recipe callers receive a ValueError-compatible RecipeError with step context.
- Wait for session readiness in browser tests and preserve synthetic failure diagnostics in CI.

Searchable columns, import feedback, editable recipes, keyboard navigation and reproducible exports remain included. Earlier releases are preserved.

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
