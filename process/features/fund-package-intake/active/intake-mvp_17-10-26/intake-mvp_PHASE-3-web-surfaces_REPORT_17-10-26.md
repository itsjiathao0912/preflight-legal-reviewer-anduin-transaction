---
phase: phase-3-web-surfaces
date: 2026-10-17
status: COMPLETE_WITH_GAPS
feature: fund-package-intake
plan: process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-3-web-surfaces_PLAN_17-10-26.md
---

# Phase 3 — Web surfaces: EXECUTE report

**TL;DR:** All three tracks and the join are built and committed. The package now shows in existing screens only: a Package lens in Structure (3a), a coverage line in the Findings header and gate popover plus package gate reasons (3b), and a "For the GP" group with a request DOCX in Counsel questions (3c). A plain reload now reopens the whole package (J0). Every Phase 3 e2e spec and every regression spec passes, run one at a time. Full preview e2e: 214 passed plus 1 opt-in skip (was 192 plus 1). Web unit: 289 (was 266). Next: EVL (independent vc-tester run).

P3_BASE = `527cb68`.

## What Was Done

| Step | Commit | Content |
|---|---|---|
| 3b | `6fbe9a7` | `CoverageLine`, `PackageGateReasons`, merged gate in `GateButton` (spreads core gate, keeps `unreadable`), header line in `FindingsScreen`, unit `package-gate-ui`, 4 e2e specs |
| 3a | `2b3a4fe` | `lensesFor`, `StructureLensId`, Package tab with warning icon, `PackageLens` + Documents / References / Terms / Coverage, unit `package-lens` |
| 3c | `a0e23a8` | `GpRequestGroup`, `exportRequestDocx` (dedupe, masking), `CounselScreen` placement, units `gp-request-group` + `request-export-contents`, 2 e2e specs |
| Join | `c21cd72` | J0 package restore on reload; the six 3a e2e specs (written by the join); `intake-reload-restores-package`; source-guard fix; two 3c spec fixes; demo-packages wait |

J0 detail: `parseLastDoc` keeps `packageId` only when it passes `SAFE_REF` (a bad one is dropped, the row is kept). `restoreLastDocument` tries `restorePackage(packageId)` first, only when nothing is open. On false it falls through to the classic path, and the classic open no longer carries the stale package id. `App.tsx` wires `usePackage.getState().restore`. It also adds a small `useReview.subscribe` that re-saves the last-doc row when a one-document package attaches after its open. So the optional re-save was done, and the `package-single-restore-on-reload` stub is not needed. `review.ts` and `state/package.ts` were not edited.

## AC coverage (surface half)

| AC | Proven by (green) |
|---|---|
| AC-I8 | `intake-correction-persists`, `intake-reload-restores-package`, unit `restore-last-doc` |
| AC-I9 (lens) | `intake-package-lens` |
| AC-I12 (UI) | `intake-reference-confirm` (resolve and "None of these") |
| AC-I14 | `intake-crossdoc-terms-no-false-positive` |
| AC-I15 | `intake-crossdoc-terms-real-error` |
| AC-I16 | `intake-terms-unverified-without-lpa` |
| AC-I17 | `intake-coverage-visible`, `intake-package-lens` |
| AC-I18 | `intake-coverage-next-to-gate`, `intake-no-package-ui-on-samples` |
| AC-I19 | `intake-gate-warning-policy` (warn); unit `package-gate-ui` (block, G6) |
| AC-I20 | `intake-missing-docs-request-export`, `intake-gp-group-absent-without-package`, units `gp-request-group`, `request-export-contents` |

## Test Gate Outcomes

- Unit, one token per call: `package-lens` 6, `package-gate-ui` 7, `request-export-contents` 3, `gp-request-group` 3, `restore-last-doc` 10 (was 6), `source-guard` 4.
- Full `pnpm --filter @aduin/web test`: 41 files, 289 tests. `pnpm --filter @aduin/core test`: 3077 passed, 3 skipped.
- e2e, one token per call, serial on 4317. The 13 Phase 3 specs: `intake-package-lens` 3, `-crossdoc-terms-no-false-positive` 1, `-crossdoc-terms-real-error` 2, `-terms-unverified-without-lpa` 1, `-reference-confirm` 2, `-correction-persists` 1, `-coverage-visible` 1, `-coverage-next-to-gate` 1, `-gate-warning-policy` 1, `-no-package-ui-on-samples` 4, `-missing-docs-request-export` 2, `-gp-group-absent-without-package` 2, `-reload-restores-package` 1. Also `intake-demo-packages` 1.
- R1 and regression specs, all green with no edits: ingest-all-formats 2, restore-and-no-text 2, diff-pairs 10, sibling-clauses 1, compare-ai-summary 4, upload-limits 5, structure-view 4, gate-pill 5, counsel-gate 4, counsel-sheet 3, counsel-export 3, app-shell 8, layout-vs-mockup 5, investor-path-view 3, previously-handled-section 4, placeholder-routes 5.
- Full `pnpm --filter @aduin/web test:e2e`: 214 passed, 1 skipped (design-probe, opt-in).
- `pnpm typecheck`, `pnpm lint` (eslint + prettier), `pnpm guard:cf`, `pnpm secrets:scan`: all OK.
- J1 partition: `git diff --name-only 527cb68 HEAD -- apps scripts packages` lists exactly the 3a/3b/3c files plus the join files. `git diff --quiet 527cb68 HEAD -- apps/worker packages` exits 0.
- J1b grep gate over the new surface files: no matches (grep exit 1).

## Plan Deviations

1. 3c-D2 (accepted): a one-document package whose sub agreement names no outside document shows `gp-request-none`, with no LPA or PPM items, because requests come only from text references.
2. 3a location text is "<last sectionPath part>, paragraph <blockIndex+1>" (for example "3. ERISA, paragraph 17"), not "Section X, paragraph N".
3. The 3a track did not write its six e2e specs. The join wrote them with the same tokens and scope as 3a-D1..D6.
4. `intake-correction-persists`: when the LPA type changes away from `lpa`, the "Units" term row goes away instead of becoming `unverified`. Following E5, the spec asserts a stronger observable that still shows the effect: no "Units defined in package" row, and the "Units" undefined-term finding back in Findings, both before reload and after restore.
5. `intake-missing-docs-request-export` (3c, never run before) had two fixes. (a) The counsel sheet Download button is disabled when there are no questions, so the spec now marks one finding Needs counsel before the unchanged-sheet check. (b) For Northgate, rows are now set to the answer-key type and role before the run, because there are two sub agreements. No assertion was removed.
6. `intake-demo-packages` (a Phase 2 spec, edited on the orchestrator's instruction): the line 52 visibility wait was raised from 5 s to 30 s. No assertion was weakened.
7. `package-gate-ui.test.tsx`: `document.body.innerHTML = ''` was replaced with `document.body.replaceChildren()` to satisfy source-guard (E8).

## Test Infra Gaps Found / Known gaps

- G6: the package `block` path (no sub agreement) is proven by unit only. `counsel-gate-line` and `findings-meta` count core reasons only. Backlog stub to write at UPDATE PROCESS: `package-gate-block-e2e-reach_NOTE_17-10-26.md`.
- Manual keyboard and screen-reader pass: carried to Phase 4 `intake-a11y-keyboard`.
- One-document reload has no e2e (the re-save is in place; only the Hartwell reload is e2e-proven).

## Closeout Packet

- Plan: the selected Phase 3 plan (J0-J4 ticked).
- Verified: everything listed above, run by the execute agent. Still unverified: the independent EVL by vc-tester.
- Classification: Keep in active/testing until EVL is green, then Ready for UPDATE PROCESS archival.
- Next: EVL, then UPDATE PROCESS, then Phase 4 `intake-mvp_PHASE-4-closeout-deploy_PLAN_17-10-26.md`.

## Forward Preview

- **Test Infra Found:** The counsel export Download needs at least one question. A two-LPA package makes `lpa` references `unclear` (inline HTML buffer, type set by hand). Single-file Hartwell is a one-document package.
- **Blast Radius Changes:** `state/last-doc.ts` and `App.tsx` are now package-aware (restore on reload).
- **Commands to Stay Green:** the token list above, one per call; full e2e 214 + 1 skip.
- **Dependency Changes:** none.
