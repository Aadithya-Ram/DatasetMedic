# Changelog

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
