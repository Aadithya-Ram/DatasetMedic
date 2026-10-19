# DatasetMedic delivery journal

The 14-day development window is October 17–30, 2026. Scheduled work: 10:00, 16:00 and 21:00 Asia/Kolkata. Each run may produce several coherent, tested commits.

## Initial release

- [x] Local FastAPI launcher, React interface, session imports, synthetic demo
- [x] Missingness, constants, mixed numeric/text values, exact duplicates, class balance
- [x] Exact split overlap, verified feature equality, shared groups, schema comparisons
- [x] Ordered cleaning, before/after records, failed-conversion counts, training-only imputation
- [x] CSV/Parquet export, HTML report, pinned reproduction recipe, fingerprints
- [x] Local worker cancellation, session cleanup, upload limits, useful error messages
- [x] Responsive interface, scroll reveals, ambient illustration, reduced-motion support
- [x] Initial tests: 20 Python tests and 8 Chromium browser scenarios passed locally
- [x] Clean-wheel installation, screenshots, benchmark and final release review
- [x] GitHub Windows/Linux matrix passes and downloadable release published

## Continuing improvements

1. Review CI failures and installation reports before adding features.
2. Audit accessibility with automated checks plus keyboard-only workflows; improve readability and focus behavior.
3. Expand boundary fixtures for nulls, types, hashing collisions, malformed imports and resource limits.
4. Benchmark larger/split datasets; reduce memory use where measurements justify changes.
5. Improve import feedback and column selection for wider datasets.
6. Recipe editing/reordering shipped on `main` October 18; continue recipe diagnostics and clearer comparison summaries.
7. Add only well-tested diagnostics with evidence, documented limitations and a useful demo.
8. Refresh screenshots, changelog and release assets when behavior changes.

Do not mark an item complete based only on implementation. Record successful validation. Daily commits should represent real progress; there is no mandatory commit count.

## October 17, 2026 — initial implementation

Built the planned v1 workflow in the initial session. Confirmed GitHub account access and repository creation. Configured repository description/topics and a repository-local GitHub no-reply author address. Scheduled three work sessions daily through October 30. Twenty Python tests and six Chromium browser scenarios pass; automated WCAG A/AA checks report no violations in empty and populated workbenches. Built a wheel with the complete interface, installed it in a clean Python 3.11 environment, ran the package's Python tests, and served its interface/API successfully. Captured actual desktop/mobile screenshots and documented a 100,000-row synthetic benchmark. Remote CI verification and downloadable release publication are next.

Initial three commits were pushed and local/remote HEADs matched. The first clean Linux checkout exposed an editable-install failure caused by requiring generated assets before the frontend build. Replaced forced inclusion with optional build artifacts; full wheel validation still requires the interface. Also preserved literal text in constant fills (for example, `001`) instead of coercing it to a number in the browser. Re-running remote checks before release.

Added a browser regression for literal text fills; all seven browser scenarios pass across the full-suite run plus the focused regression. Reinstalled the latest wheel into clean Python 3.11 and all 20 Python tests passed. The one-million-row synthetic audit completed in 0.3444 seconds (engine only; see benchmark notes). Checked the exclusive work lock against a competing process; fixed its Windows length check and confirmed competing writers exit with BUSY without executing their command.

GitHub Actions completed successfully across Windows/Linux and Python 3.11/3.14 for commit df98db1. Final visual review found that the scroll observer's percentage threshold could keep very tall wide-dataset panels hidden. Changed entry detection to support oversized panels and verified the fix with a 500-column browser regression (eighth scenario). Release assets will be rebuilt from the final checked source.

Final commit 9bf5245 passed all four Windows/Linux × Python 3.11/3.14 CI jobs, including all eight browser scenarios on Linux. Latest wheel passed the 20 Python tests in a clean Python 3.11 environment. Published [v0.1.0](https://github.com/Aadithya-Ram/DatasetMedic/releases/tag/v0.1.0) with wheel, source archive and SHA256SUMS. GitHub recognizes the MIT license and attributes commits to Aadithya-Ram. Confirmed the heartbeat remains active for the three agreed daily slots. The first release is complete; scheduled sessions should now select substantive improvements from the continuing roadmap above.

## October 18, 2026 — editable recipes and keyboard navigation

All baseline remote checks were green at session start. Added editing/cancelling and earlier/later movement for recipe steps, with explicit ordered-list semantics, restored keyboard focus and live announcements. Saving or reordering invalidates earlier previews; unfinished edits block preview/export. Browser regressions verify that changing drop/deduplicate order changes row counts and that edited literal fills reach the resulting records. The request contract and engine are unchanged. Added a skip link and selected/current states for column chips, filters and navigation.

Final local validation: 20 Python tests, all 11 browser scenarios, lint, production build and complete-wheel checks passed. The new order test also runs on a 390px viewport and verifies no horizontal page overflow. Refreshed four screenshots and visually checked the new recipe controls. Added an unreleased changelog and a clear README note distinguishing `main` improvements from v0.1.0. All three commits subsequently passed every Windows/Linux CI job (latest: 8176d31). The feature was initially source-only and is included in the v0.2.0 release preparation below; v0.1.0 remains preserved.

The heartbeat arrived at 02:30 India time for the stored 21:00 recurrence. Updated the existing automation to encode the intended 10:00/16:00/21:00 India slots as 04:30/10:30/15:30 UTC, retaining the October 30 end date. The next run's actual delivery time should confirm the correction.

Community Wisdom: DevRelay tools were not available in this session; no community claims were used.

## October 18, 2026 — data boundaries and v0.2.0 preparation

All three previous commits passed every Windows/Linux CI job. Reproduced and fixed two data bugs: boolean columns rejected form text such as `true`, and integer IDs outside JavaScript's safe range could be rounded in browser evidence. Boolean fills now accept only unambiguous true/false/1/0 values; JSON evidence represents large integers as exact strings while exported numeric data remains unchanged. Added end-to-end export/reproduction coverage for both cases, forced hash-collision verification and import limit/cleanup tests.

Preparing v0.2.0 to include the earlier recipe editor and accessibility improvements with these fixes. Version consistency is checked across installed Python metadata, the engine, pyproject.toml and the interface. Release helpers now select the exact current version's build and validate its checksums before publishing; old release assets are preserved. Local Python validation has reached 34 passing tests; browser/package/remote checks and publication are in progress.

All 34 Python tests also passed after installing the v0.2.0 wheel into the clean Python 3.11 environment. All 13 browser scenarios passed, including exact large-ID rendering, boolean fills, keyboard navigation and mobile recipe ordering. Lint, production build and wheel-content checks passed. Verified that release preflight rejects stale checksums before creating a release. Refreshed screenshot capture to wait for a ready session rather than recording disabled startup buttons.

The next heartbeat was delivered at 11:13 India time, later than the intended 10:00 slot; the recurrence remains encoded for the intended India-time schedule. A delayed delivery alone does not establish another timezone offset, so no further shift was made.

Release complete: commit 738ff3d passed all four Windows/Linux × Python 3.11/3.14 CI jobs, including the full 13-scenario browser suite. Published [v0.2.0](https://github.com/Aadithya-Ram/DatasetMedic/releases/tag/v0.2.0) with the current wheel/source archive and SHA256SUMS. The public wheel download's SHA256 matches the locally verified build. All 34 Python tests passed both from source and the installed wheel. Earlier v0.1.0 assets remain intact. The working tree and remote HEAD were verified after pushing; the next useful areas remain import feedback for wide datasets, clearer comparisons, and memory/split benchmarking.

## October 18, 2026 — searchable wide-schema selection

Started with all four latest GitHub CI jobs passing. Added a shared searchable picker for subject groups, exact-match features and cleaning columns. Filtering preserves selections; selected-only review and explicit clearing help inspect them. Bounded scrolling keeps 500-column schemas compact. Counts, pressed states, Unicode search and keyboard controls are covered by a mobile browser regression that also verifies hidden selected columns reach the cleaning preview. Search state resets when changing datasets or cleaning operations. Refreshed real-app screenshots, added a selection screenshot and clearly marked the feature as source-only until the next release.

The browser test runner exposed an unquoted Windows Python path; quoting it restores automatic server startup. Initial validation passed all 34 Python tests, lint, the production build and all 14 browser scenarios, including automated WCAG checks. The final rebuilt interface also passed all 14 browser scenarios with automatic server startup on Windows. Wheel build and bundled-asset checks passed. Remote CI results will be checked after push.

This heartbeat arrived at 16:00 India time, matching the intended schedule after the earlier UTC recurrence correction. No further schedule change was needed. Community Wisdom: DevRelay tools remain unavailable; no community claims were used.

## October 18, 2026 — verified split and memory baselines

Confirmed commit 8ec554b passed all four Windows/Linux × Python 3.11/3.14 CI jobs, including all 14 browser scenarios. Added a separate synthetic split benchmark with independently controlled exact-feature and shared-subject overlap. Each repetition uses a fresh child process, temporary Parquet files and exact expected-count verification. JSON records include engine/load timings, OS peak memory, compressed file sizes, estimated retained frame sizes and runtime details. The historical single-frame fixture is preserved.

Recorded three trials each at 100,000 and 1,000,000 rows per split. For two one-million-row splits, median audit time was 0.8120 seconds; maximum child peak working set was 852.43 MiB. Every trial verified 100,000 distinct matching feature records and 200,000 shared subject IDs. Committed raw results and explicit scope: timings exclude generation/startup/UI/export, while process memory includes generation and imports through audit completion. This is a synthetic baseline, not a capacity guarantee or an audit-only allocation measurement. Future profiling should investigate wider tables and allocation hotspots before changing engine behavior.

Validation: all 41 Python tests passed on the source Python 3.14 environment, including seven new benchmark correctness/input-boundary cases. The seven benchmark tests also passed against the installed v0.2.0 engine in the clean Python 3.11 environment. Lint and the production frontend build passed. App behavior and screenshots are unchanged in this increment. Remote CI will be inspected after push. Community Wisdom: DevRelay tools remain unavailable; memory metric semantics were checked against the official Microsoft/Python references linked in the benchmark notes.

## October 19, 2026 — import feedback and v0.3.0

Confirmed the previous split-benchmark commit passed all four remote Windows/Linux jobs. Added whole-batch browser checks for unsupported extensions, empty files, per-file size and session capacity before any request is sent. Case-insensitive CSV/Parquet extensions remain supported. Imports announce the current filename, file size and position in the batch. A later request failure stops remaining requests, reports the failed file and preserves confirmed successful imports for retry. Browser checks complement the server's independent validation; analysis still checks file content and row/schema limits.

Two new browser scenarios verify that rejected batches send no uploads, existing imports survive, local progress remains accessible on mobile, an injected second-file failure retains only the successful first file, and retry imports the remaining files. Screenshot review found the general working indicator covering the local import card; it is now hidden during importing. A focused regression checks that behavior and exact small-file size display. Captures use synthetic data; the request is deliberately delayed only for the progress screenshot and documented as such.

Prepared v0.3.0 to make searchable columns and the new import workflow downloadable, retaining previous releases. Updated all version sources, OpenAPI, changelog, release notes and six actual screenshots. Validation: 41 source Python tests, all 16 browser scenarios, lint and production build passed. After the final indicator refinement, both import scenarios and job cancellation passed again. The complete wheel built successfully, all 41 Python tests passed against it in the separate Python 3.11 environment, and its interface/API served version 0.3.0. Checksums, remote CI and publication follow from this checked release source. Community Wisdom: DevRelay tools remain unavailable; no community claims were used.

Release verified: commit 85f67f0 passed all four Windows/Linux × Python 3.11/3.14 CI jobs, including the complete 16-scenario browser suite. Published [v0.3.0](https://github.com/Aadithya-Ram/DatasetMedic/releases/tag/v0.3.0); the tag points to that checked commit. Public downloads of the wheel, source archive and SHA256SUMS all match their local verified assets. Earlier releases remain intact. Next useful work: make split comparisons easier to interpret across unequal split sizes, improve recipe diagnostics, or profile wider schemas before attempting memory optimizations.
