# Changelog

## 0.3.0 — October 19, 2026

- Validate an entire import batch before copying: supported extension, non-empty files, file size and session limits.
- Show the current file and batch position during local copying. Explain partial failures and retain successfully imported files for retry.

- Add a reproducible split-audit benchmark with independently controlled contamination, fresh-process trials, OS peak memory and raw measurement records.

- Search group, exact-match feature and cleaning columns by name, including Unicode names.
- Review selected columns, clear selections, and keep selections across search filters. Scrollable column lists stay compact on wide datasets.
- Quote the browser test server's Python path so automatic startup works on Windows and paths with spaces.

## 0.2.0 — October 18, 2026

- Edit a cleaning step in place, save changes, or cancel without altering the approved recipe.
- Move steps earlier/later with explicit controls. Preview and export use the resulting order.
- Keep keyboard focus on moved or edited steps; announce recipe changes to screen readers.
- Require a fresh preview after a saved edit, reorder or removal. Block preview/export while editing an unfinished draft.
- Add a skip-to-workbench link and announce selected column/filter buttons and the current navigation section.

- Accept unambiguous text constants when filling boolean columns and reject ambiguous values.
- Preserve large integer identifiers as exact text in JSON evidence; original numeric types remain intact in exported data.
- Verify hash collisions against actual feature equality and cover import quotas and rejected-file cleanup.
- Keep package, API and interface versions aligned and select only the current version's files when publishing releases.

## 0.1.0 — October 17, 2026

Initial local CSV/Parquet workbench: data audits, exact split/group overlap evidence, ordered cleaning previews, training-only learned imputation, reproducible exports, responsive interface, scroll reveals and reduced-motion support.
