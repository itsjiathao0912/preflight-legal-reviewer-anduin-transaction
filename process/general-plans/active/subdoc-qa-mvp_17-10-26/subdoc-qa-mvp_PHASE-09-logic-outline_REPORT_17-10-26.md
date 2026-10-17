---
phase: phase-09-logic-outline
date: 2026-10-17
status: COMPLETE
feature: subdoc-qa-mvp
plan: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-09-logic-outline_PLAN_17-10-26.md
---

# Phase 09 — Logic outline export: EXECUTE report

Phase 09 is implemented and every gate passes. Nothing is committed yet (as instructed). HEAD at start: 99c9cee.

## What Was Done

- 09-A core: `packages/core/src/outline/{version,schema,build,index}.ts`. `OutlineSchema` v1 (strict zod objects, fixed key order, no records, no `generatedAt`), `OutlineDraft` type, `maskOutlineName`, `outlineFilename`, `buildOutlineDraft`, `OUTLINE_SCHEMA_ID`, `OUTLINE_DISCLAIMER`. The barrel append in `packages/core/src/index.ts` adds only Phase 09 lines (re-read right before the edit; Phase 07c lines left as they were). Fixture `fixtures/outline/schema.v1.json` is generated from `z.toJSONSchema`. Tests: `logic-outline-export-contents` (11 cases) and `outline-schema-snapshot` (2 cases).
- 09-B web: optional `EngineResult.outline`. `engine.worker.ts` builds it right after `result.structure` is assigned, with its own try/catch, and leaves it out when there is no structure. E10 is handled in one place: `ocr.pages[].index + 1` becomes the page numbers. New `src/lib/download.ts` `downloadBlob(filename: string, data: string | Blob, mime: string): void` (Phase 08 had not created it); it revokes the object URL in a `setTimeout(0)`. New `features/outline/{finalizeOutline.ts,ExportOutlineButton.tsx,OutlinePreview.tsx}`. The button is mounted in the `StructureScreen` header outside the `view ?` block, and only when a document is open. `ALLOWED` gains the three names. `e2e-hook.ts` gains a `forceInvalidOutline` HookState field, the installer entry and an `e2eForceInvalidOutline()` reader, all inside `IS_E2E`. `no-e2e-hook-in-dist` now checks `forceInvalidOutline` is absent from the production build and present in the e2e build (positive control).
- 09-C: `e2e/logic-outline-export.spec.ts` with 3 tests: download + parse + schema check + counts vs Node-derived totals (preview `data-count` and the file's `counts`) + byte-stable text; blocked-on-invalid; disabled when there is no structure (`failStage('structure')`).

## What Was Skipped or Deferred

- Backlog stubs R1/R2/R3: the Exit Gate assigns them to UPDATE PROCESS, so EXECUTE did not write them. R1: investor-path correctness (heuristic). R2: real OCR confidence calibration. R3: `downloadBlob` revoke timing in real browsers.

## Test Gate Outcomes

| Gate | Result |
|---|---|
| core `logic-outline-export-contents` | 11/11 pass |
| core `outline-schema-snapshot` | 2/2 pass (red before the fixture existed) |
| core `test:golden` | 67/67 pass |
| core full | 73 files / 501 tests pass |
| web `download-blob` | 3/3 pass |
| web `no-e2e-hook-in-d` | 2/2 pass |
| web `import-graph` / `source-guard` | 4/4, 4/4 pass |
| web unit full | 18 files / 76 tests pass |
| e2e `logic-outline-export` | 3/3 pass |
| e2e `structure-view` / `engine-worker-split` / `a11y-smoke` | 4/4, 2/2, 1/1 pass |
| e2e full `test:e2e` | 109 pass, 1 skipped, 1 failed on the first run: `layout-vs-mockup` "computed styles … Findings, overlays and Compare". Re-run alone: 5/5 pass. This test does not cover the Structure screen. Most likely cause: Phase 07c was editing `compare.css` / `CompareScreen.tsx` during the run. EVL should re-run it. |
| `pnpm typecheck` | pass (all 4 projects) |
| eslint / prettier on touched files | clean |
| `guard:cf` / `secrets:scan` | OK / OK |

TDD note: the red-first step was seen on the snapshot gate. The contents and download-blob tests were written with their implementation and went green on the first run. I did not run the copied stub bodies one by one.

## Plan Deviations

These are also recorded in the plan's `## Deviations`. All are inside the blast radius:
- Added an `.outline-export` CSS block to `apps/web/src/styles/structure.css` (not in Touchpoints).
- The snapshot test compares parsed JSON with deep equality, not raw bytes, so prettier does not churn the fixture. Key-order drift in the JSON Schema text is therefore not caught there. Byte-stability of the outline itself is still asserted (core test and e2e).
- `references[]` lists internal references first, then external ones; each group is in document order.
- `fixtures/outline/.gitkeep` removed.

## Test Infra Gaps Found

- Running the full e2e suite while another agent edits the same app can cause flaky style checks (`layout-vs-mockup`).

## Closeout Packet

- Selected plan: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-09-logic-outline_PLAN_17-10-26.md`
- Finished: all of 09-A, 09-B and 09-C (A1–A4, B1–B5, C1–C2).
- Verified: every gate above. Unverified: the `layout-vs-mockup` re-run inside the full suite (EVL), and R1–R3 (named residuals).
- Remaining: EVL confirmation run, R1–R3 backlog stubs, registry update request (plan §Registry update request), commit.
- Classification: Ready for EVL, then UPDATE PROCESS archival.

## Forward Preview

### Test Infra Found
- `analyzed(n)` helper (core) and the `engineView()` Node-derived pattern (e2e) also work for outline counts.

### Blast Radius Changes
- New shared `apps/web/src/lib/download.ts`. Phase 08 must reuse it unchanged.

### Commands to Stay Green
- `pnpm --filter @aduin/core test logic-outline-export-contents`, `... test outline-schema-snapshot`, `pnpm --filter @aduin/web test download-blob`, `pnpm --filter @aduin/web test:e2e logic-outline-export`, `pnpm --filter @aduin/web test no-e2e-hook-in-d`.
- Regenerate the fixture only on a deliberate schema version bump.

### Dependency Changes
- None (zod 4.6 already pinned).
