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

## October 19, 2026 — browser startup race and CI evidence

The documentation-only commit 807a351 subsequently failed three Linux/Python 3.11 browser scenarios while its other three matrix jobs passed. The released v0.3.0 commit remained green. Logs showed wide-column selection, malformed import and large-ID tests waiting for an audit button after file selection. A gated-session experiment reproduced the cause: Playwright's `setInputFiles` can dispatch to the disabled input before the session ID arrives, so the app correctly ignores the selection and no dataset is imported. Human users cannot open that disabled picker.

All browser scenarios now wait for the enabled chooser after navigation. Added a deterministic delayed-session regression that checks disabled controls before readiness and successful import afterwards. No retries, fixed sleeps or timeout increases were added. CI is configured to retain failure screenshots, traces and error context for seven days using the official GitHub artifact action; fixtures remain synthetic. App behavior and published assets are unchanged.

Validation: all 41 Python tests, lint, production build and all 17 browser scenarios passed locally. The delayed-startup regression and the three formerly failing cases then passed three repetitions each (12 additional successful runs). The official artifact action's current v7 tag was verified. Remote CI will be checked after pushing. Community Wisdom: DevRelay tools remain unavailable; no community findings are claimed. Split-comparison and recipe-diagnostic improvements remain the next product work after restoring reliable checks.

## October 19–20, 2026 — clearer split comparisons

Confirmed commit 98094b3 passed all four Windows/Linux × Python 3.11/3.14 CI jobs, including the 17 browser scenarios. Updated split comparison tables to show named datasets, each split's row count, missing percentages with count/denominator evidence, explicit mean/median or most-frequent-value summaries, and type differences. The interface uses existing engine profiles; transformations, API shapes, exports and reproduction scripts are unchanged. Added table captions, row/column headers and keyboard-focusable horizontal scrolling for narrow screens.

Two end-to-end regressions cover unequal split sizes (2/8 = 25%, 2/4 = 50%), zero means/medians, missing categorical values, false values, incompatible types, mobile overflow and automated WCAG checks. Positive missing rates smaller than 0.1% remain visible. A final precision refinement uses scientific notation for very small/large summary statistics and verifies that 1E-9 is not displayed as zero. Numeric summaries and percentages explicitly disclose display rounding; descriptive comparisons still make no statistical-drift claim.

All 41 Python tests, lint, the production build and all 19 browser scenarios passed locally. Both comparison scenarios passed again after the precision refinement. Added and visually reviewed an actual demo comparison screenshot, refreshed captures and documented the source-only additions separately from the preserved v0.3.0 download. One screenshot navigation hit ERR_NETWORK_IO_SUSPENDED; a repeat capture completed successfully. The work continued into October 20. Remote CI will be verified after pushing. Community Wisdom: DevRelay tools remain unavailable; no community findings are claimed. Recipe diagnostics and wider-schema profiling remain useful next areas.

## October 20, 2026 — recipe recovery, worker completion and v0.4.0

Confirmed the comparison commit 8115250 passed all four remote matrix jobs, including 19 browser scenarios. Recipe validation and Polars operation errors now carry the one-based failing step and operation through the shared transformation engine. The worker exposes that context in typed job status; the interface offers an edit shortcut only for the unchanged failed recipe/config/dataset snapshot. Editing restores focus, successful repair enables a fresh preview, and changed recipes hide outdated shortcuts. Input-loading and unexpected-process failures have no recipe step. Failed jobs expose no result or download; originals remain unchanged in direct engine, execution and API tests.

Validation also exposed a worker-completion polling race: a terminal file could arrive after the first file check but before process exit was observed. A deterministic regression failed for both successful results and specific recipe errors before the fix, while a genuine crash case passed. Status now rechecks terminal files after observing exit, preserving completion/errors without masking a worker that stopped without either file. No sleeps, retries or timeout increases were added.

Prepared v0.4.0 to include these fixes with clearer split comparisons and the earlier browser-test reliability improvements. Updated shared API types, version sources, release notes and eight screenshots. The recovery image deliberately triggers an invalid trim on the numeric demo age column, as documented. All 52 Python tests passed from source and after installing the complete wheel in the separate Python 3.11 environment. All 21 browser scenarios, lint and the production build passed. The new browser cases cover keyboard repair, stale-shortcut protection, mobile layout and WCAG checks. Wheel content checks passed; release checksums, remote checks and publication follow from the final checked source. Community Wisdom: DevRelay tools remain unavailable; no community findings are claimed.

Release verified: commit eec7c1f passed all four Windows/Linux × Python 3.11/3.14 CI jobs, including the complete 21-scenario browser suite. Published [v0.4.0](https://github.com/Aadithya-Ram/DatasetMedic/releases/tag/v0.4.0), with its tag pointing to that checked commit. Public wheel/source/checksum downloads match the verified local assets, and the final wheel's package files match those installed for the 52-test Python 3.11 run. Prior releases remain intact. Next useful areas: wider-schema profiling, large finding/profile navigation and export-report accessibility.

## October 20, 2026 — accessible offline export reports

Confirmed the latest documentation and v0.4.0 release commits passed all four remote matrix jobs. Redesigned the standalone HTML report with a keyboard skip link, section navigation, semantic column profiles and evidence tables, dataset-specific missing-rate denominators, mobile scrolling and print styles. Examples wider than eight fields use vertical field/value tables. Missing values, false values and quoted text remain distinguishable; names and values are escaped. Reports load no scripts or external assets. Export reports explicitly describe the cleaned snapshot; direct audit reports retain an audit label. The public engine import remains compatible, and transformation/exported-data behavior is unchanged.

Validation: all 55 Python tests and all 22 browser scenarios passed, including keyboard navigation, automated WCAG checks, narrow-screen layout, no external requests, escaping, Unicode, tiny positive missing rates and wide evidence. The report scenario and three report unit tests passed again after final assertion refinements. Lint, production frontend build, source/wheel builds and bundled-content checks passed. Captured and visually reviewed a real report from a synthetic cleaned export ZIP. Documentation marks these additions as source-only for the next release; published v0.4.0 assets remain intact. Remote CI will be checked after push. Community Wisdom: DevRelay tools remain unavailable; no community findings are claimed. Wider-schema profiling and large profile/finding navigation remain useful next work.

## October 20, 2026 — wide-schema profile navigation

Confirmed report commit e66267a passed all four Windows/Linux × Python 3.11/3.14 jobs. Column profiles now offer case-insensitive name search, a missing-values filter, reset controls and 24-card pagination over the whole selected schema. Counts distinguish matches from total columns. Filters reset to page one when changed, and reset completely on dataset switches or a completed audit. These controls do not change audit configuration, cleaning selections, source samples or exported data. Small screens show one readable card per row; cards retain the existing statistics. Zero-row meter division is guarded.

A real 500-column CSV browser regression covers keyboard paging/focus, bounded card counts, Unicode, case-insensitive matching, all-null columns, no matches, pressed/disabled states, dataset and audit resets, source sample preservation, mobile overflow and automated WCAG checks. The test waits for the audit result response before asserting the profile; auditing 500 columns can exceed the normal short assertion window. Captured and visually reviewed the actual missing-values view from a separate synthetic 50-column audit. Documentation marks the feature as unreleased on main; published v0.4.0 assets remain intact.

All 55 Python tests, lint, production frontend build, source/wheel builds and bundled-content checks passed. The first full browser run passed 22 cases; recipe editing timed out while its preview-creation request took about 60 seconds. The new 500-column case passed. No retry policy or timeout increase was added; the complete rerun passed all 23 browser scenarios in 1.8 minutes, including recipe editing. Remote CI will be inspected after push. Community Wisdom: DevRelay tools remain unavailable; no community findings are claimed. Large finding navigation and measured wider-schema performance remain useful next areas.

## October 21, 2026 — full-audit finding search

Confirmed commit 065e3a8 passed all four remote Windows/Linux × Python 3.11/3.14 jobs. Findings search and severity filters now run over the full saved audit before pagination. Search covers titles, explanations and column names using trimmed Unicode case folding, with a 200-character limit. Example cell values and filenames are excluded. Default requests retain the original order/behavior, while filtered responses report the matching total. The workbench retains its independent overall audit count, resets paging on filter changes and resets filters after a completed audit.

Requests are cancellable and keyed to the current audit/filter/page/retry, preventing obsolete responses from replacing newer results. Loading hides old cards without claiming there are no matches; failures expose a local retry control. Audits, cleaning recipes, source samples and export contents are unchanged. OpenAPI and generated query types were refreshed. Added exact API coverage for filtering before offsets, Unicode/case/whitespace, boundaries, invalid filters, empty matches and unchanged stored results. Two browser cases cover later-page search, combined filters, mobile/WCAG checks, audit resets, gated obsolete responses, loading and injected request failure/retry.

Validation: all 56 Python tests, all 25 browser scenarios (1.3 minutes), lint, the production build, wheel build and bundled-content checks passed. Captured and visually reviewed an actual search in a synthetic 31-finding audit. An unrelated untracked presentation was preserved and excluded from commits and the wheel; no source archive was rebuilt from this mixed workspace. Documentation marks the additions as unreleased on main, preserving v0.4.0 assets. Remote CI will be inspected after push. Community Wisdom: DevRelay tools remain unavailable; no community findings are claimed. Next useful areas: release the accumulated report/navigation work after installation verification, and measure wider-schema performance before optimization.

## October 21, 2026 — v0.5.0 installation and release preparation

Confirmed search commit 231a9e3 passed all four remote Windows/Linux × Python 3.11/3.14 jobs. Prepared v0.5.0 to make offline report accessibility, searchable/paginated column profiles and full-audit finding search downloadable. Updated all version sources, OpenAPI, changelog, README installation link and release notes. Refreshed actual synthetic screenshots; visual review found capture timing could show the previous navigation selection. Capture now waits for the section's current-location indicator, and the repeated capture passed.

Validation: 56 source Python tests, all 25 browser scenarios, lint and the production build passed. Built both release archives in an isolated temporary copy of tracked project files plus the built interface, preserving and excluding the unrelated untracked presentation. Installed the complete v0.5.0 wheel in the separate Python 3.11 environment: all 56 tests passed there, and its bundled interface and health API served version 0.5.0. Archive inspection, final checksums, remote CI and public asset verification follow from the checked release source. Earlier releases will remain intact. Community Wisdom: DevRelay tools remain unavailable; no community findings are claimed. Wider-schema measurement remains useful next work before optimization.

Release verified: commit 8bd6d1f passed all four remote matrix jobs, including the 25 browser scenarios. Published [v0.5.0](https://github.com/Aadithya-Ram/DatasetMedic/releases/tag/v0.5.0) with its tag pointing to that checked commit. Direct public downloads of the wheel, source archive and checksum file all match the local verified assets. The final wheel's package files also match the installed Python 3.11 package that passed all 56 tests. Anonymous GitHub API metadata lookup was rate-limited; direct public asset verification succeeded and authenticated workflow inspection remained available. Prior release assets were not replaced. The unrelated presentation remains untouched and untracked. Next useful work: wider-schema profiling and measured memory/performance improvements.
