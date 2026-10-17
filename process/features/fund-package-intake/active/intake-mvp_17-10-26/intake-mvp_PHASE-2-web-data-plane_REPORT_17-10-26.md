---
phase: phase-2-web-data-plane
date: 2026-10-17
status: COMPLETE_WITH_GAPS
feature: fund-package-intake
plan: process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-2-web-data-plane_PLAN_17-10-26.md
---

# Phase 2 — Web data plane: EXECUTE report

**TL;DR:** Phase 2 is built and committed: the light read in the engine worker, Dexie v2, the `usePackage` store, the frozen `PackageView` contract, the multi-file Upload modal with a confirmation table, demo packages, and the same-firm baseline role. All of it matches the frozen contract with zero contract deviations. Web unit tests: 266 (was 227). Full preview e2e: 192 passed plus 1 opt-in skip (was 173 plus 1). Scripts: 156. Typecheck and lint pass. One deviation matters for Phase 3: four existing upload fixtures are high-confidence subscription agreements, so they become one-document packages (see Deviations 1). Next: EVL (independent vc-tester run).

## Entry state

- `P2_BASE` = `8503cded2be779e182118f271bdd4bf39a8ef796` (Phase 1 EVL green, local only).
- Baselines: web 227 tests at P2_BASE (231 after my first test file); `@aduin/web typecheck` and `@aduin/core typecheck` exit 0.
- Shared checkout: during the phase another session committed a0f4961 (worker plus core `ref-label-coherence`), 9ea0011 (`OpenDocumentDialog.tsx` and others), 1f5cfa5 (`review.ts` restore-on-reload, `last-doc.ts`, no-text gate) and 57043fc (docs). I re-read `review.ts` and `OpenDocumentDialog.tsx` from disk before editing and built on their versions. My commits hold only my hunks. I never ran stash, checkout, reset or restore.
- E15: every Phase 1 export name in the Public Contracts allow-list exists unchanged in `packages/core/src/package/index.ts`. Nothing was renamed or needed adapting.

## Commits (main, not pushed)

| sha | message |
|---|---|
| 8a52c72 | feat: package data plane in the engine worker and Dexie v2 |
| 496c0f9 | feat: multi-file upload modal with package confirmation table |
| 782d1fb | test: intake upload e2e specs |

## What Was Done

- **B** `engine/types.ts`: `EngineSettings.packageDefs?`, `packageFacts?`; `EngineResult.packageFacts?`; `ReadPackageDocResponse`; `EngineApi.readPackageDoc`. `engine.worker.ts`: `readPackageDoc` reuses `readInput` (with `checkFormat`) plus `buildPackageFacts`, never throws, and fails with a code only. In `analyze`, `applyPackageDefinitions` runs inside the checks stage before `toView`, AI candidates and the structure view. `extractPrimaryFacts` (with `suppressed`) runs only when asked. Without settings the output is byte-identical (tested). `client.ts`: `readPackageDocInWorker`.
- **C** `storage/db.ts`: `version(2)` adds `packages` and the `documents.packageId` index; `version(1)` is unchanged. Adds `StoredPackage` and `StoredPackageDoc`. `purgeExpired` now also purges `packages` at 24 h.
- **D** `features/package/{contract,package-persist,package-view}.ts` and `state/package.ts` cover all the actions in D3: `prepareDraft`, `setDraftField`, `setDraftTag`, `confirmDraftRow`, `removeDraftRow`, `addEarlierDocument`/`addEarlierToDraft`, `draftReadiness`, `runDraft`, `registerSingle`, `restore`, `listRecent`, `setRole`, `setType`, `confirmTarget`, `baselineDocs`, `clear`, `clearDraft`.
- **E** `review.ts` (additive): `DocMeta.packageId?`, `OpenPackageOption`, `openDocument` options `package` and `packageFacts`. With `reopen` set, `aiRunFresh` is skipped. Adds the E14 action `attachPackage(docId, packageId)`.
- **F** `validate-upload.ts`: `checkPackageFiles` and `PACKAGE_LIMITS_COPY`. `OpenDocumentDialog.tsx`: `multiple`, `File[]`, the N ≥ 2 draft path, step 2 rendered in the same modal, Demo packages and Recent packages lists. `PackageConfirmTable.tsx` and `package-intake.css` (tokens only; widened through `.od-pkg`). `demo-packages.ts` and `package-actions.ts`. `open-actions.ts` clears the package on sample, classic upload and reopen, registers a one-document package after render (S3), and restores a package on `reopenRecent`. `build-samples.ts` writes `packages.json` with design packages first, and warns plus writes an empty list if the source is missing. manifest.json sha256 was `187c24d4…99b19` both before and after (unchanged).
- **G** The allow-list got append-only additions (16 names). Playwright helpers are in `e2e/fixtures/package.ts`.
- **H** Nine `intake-*` specs.

Mid-implementation note (at about 50%, after Step D): 6 of 9 step groups were done with no hard-stop deviation; the classic-path premise (Deviation 1) was found at D6.

## Frozen P2→P3 contract conformance

| Item | Status |
|---|---|
| 1 `usePackageView()` rule: `doc.packageId === current.id` and phase ready, OR `refreshing` stale-while-reopen; sample, classic and reopen-without-package opens clear it; no network | matches (`package-view` cases 3, 4, 5, 6) |
| 2 `PackageView` fields: all 15 fields with the specified sort and order, plain data | matches (key-set and `structuredClone` assertion) |
| 3 Store actions and return shapes `{ok}` / `{ok:false, reason}` with the 4 reasons; re-open with `package.reopen: true`; `baselineDocs`; `addEarlierDocument` refuses cross-firm | matches |
| 4 `coverageLine` and `gateReasons[].text` come from core only | matches |
| 5 The 15 frozen test ids | all present. Additive non-frozen ids: `package-version-input`, `package-row-low-mark`, `package-row-remove`, row attribute `data-suggestion-source` |
| 6 The 6 helpers `uploadPackage`, `openDemoPackage`, `confirmAllRows`, `runPackage`, `restoreRecentPackage`, `waitForChecks` | present. Extras: `hartwellFile(s)`, `idbCounts`, `HARTWELL_DIR`, `RAW_DIR` |

Contract deviations: **none**.

## Test Gate Outcomes (one token per call, every gate ran more than 0 tests)

| Gate | Result |
|---|---|
| `pnpm --filter @aduin/web test engine-package-api` | 4 passed |
| `... test package-db-v2` | 2 passed |
| `... test package-store` | 15 passed |
| `... test package-view` | 8 passed |
| `... test package-confirm-table` | 4 passed |
| `... test import-graph` | 4 passed |
| `test:e2e intake-multi-upload / -limits-refusal / -firm-tagging / -scan-ocr-or-flag / -low-confidence-gate / -no-llm-run / -baseline-role-same-firm / -no-sub-agreement-held / -demo-packages` | 1 / 1 / 2 / 1 / 1 / 1 / 1 / 1 / 1 passed |
| I1b existing specs: upload-firm-tagging 4, upload-limits 5, privacy-notice 3, sample-picker-smoke 2, ingest-all-formats 2, ocr-unavailable 4, scan-set-smoke 1, hostile-html 1, engine-worker-split 2, investor-path-view 3, counsel-sheet 3, memory-prior-answer 3, fund-two-zero-hidden-zero-repeat 3, a11y-smoke 1, a11y-keyboard 3, turnstile-no-block 2, status-stages 4, perf-budget 2; also restore-and-no-text 2, mobile-shell 5 | all passed |
| `pnpm --filter @aduin/web test` | 37 files, 266 passed |
| `pnpm --filter @aduin/scripts test` | 17 files, 156 passed |
| `pnpm typecheck`, `pnpm lint` | exit 0 |
| `pnpm --filter @aduin/web test:e2e` (full, one invocation) | 192 passed, 1 skipped (opt-in design probe). Two of three runs were fully green; the first run failed `intake-demo-packages` under load, which was fixed by raising the helper wait to 60 s |
| `git diff --quiet P2_BASE -- apps/worker packages` | **exit 1, from a foreign commit only** (a0f4961, other session). `git diff --quiet HEAD -- apps/worker packages` exit 0. My 3 commits touch neither path |

High-risk inputs for Phase 4 `verification.json`: cross-firm refusal (store test and e2e with two firms and identical text); v1→v2 upgrade with rows intact; purge boundary (equal to cutoff purges, cutoff plus 1 ms stays); limits refusal stores nothing (unit and e2e IndexedDB counts); superseded run writes nothing. The `review-decision.json` input is the EVL code-reviewer pass (not yet run).

## Plan Deviations (within blast radius; no hard-stop class)

1. **S3 classic-path premise is false (D6).** The plan says no existing e2e upload fixture is a high-confidence `sub_agreement`. Measured: `packages/core/test/fixtures/sections-parts.html` (ingest-all-formats), sample #3 raw (restore-and-no-text), `fixtures/diff/sibling-A/B` and `identical-pair/a,b` (diff-pairs and Compare uploads) are high. Under the binding S3 rule they become one-document packages after render. Tiny snippets, hostile HTML, html-seeded fixtures and fund-I/II/Y stay classic. The D6 test pins both sets as measured. Phase 2 has no visible package UI, and every affected spec passes unchanged. **Phase 3 risk:** once the coverage line and lens ship, those specs will show package UI. Phase 3 should either accept that or tighten the rule (plan supplement needed).
2. `review.ts` `live()` now compares `doc.id` instead of the doc object, because `attachPackage` replaces the object. The `loadSeq` check still guards against supersede.
3. Run persistence waits one macrotask (`setTimeout 0`) before its first write, so a run superseded right away writes nothing. It is still fire-and-forget.
4. `readPackageDoc` sets `needsOcr` only when a PDF or OCR read gives no lines at all. A PDF that mixes text and scan pages keeps the facts from its text pages with `needsOcr: false`.
5. Demo-package and design-file primaries open as source `upload` with no `documents` row (bundled). Reopen goes through `reopenRecent → restore(packageId)`. The allowance is not counted for bundled primaries.
6. The S3 fallback light read was NOT used, so no `upload-limits` before/after timing was recorded and the `package-single-upload-light-read` backlog note is not needed.
7. `PACKAGE_TAGS` (demo titles, fund, version) lives in `build-samples.ts`, because `demo-packages.json` carries ids and members only.

## Test Infra Gaps Found / Known gaps

- **Restore-on-reload (1f5cfa5) drops `packageId`.** `parseLastDoc` keeps only the classic fields, so after a reload a package primary reopens classic with no package view. Nothing breaks. The fix is in `state/last-doc.ts` and `App.tsx`, which are outside my blast radius. Stub needed: `package-restore-on-reload`.
- AC-I7 zero-AI proof is vacuous in the preview build (no API). Stub: `package-no-llm-live-proof_NOTE_17-10-26.md`. The store test asserts the AI lane is not started with AI off (the mocked `aiOnOpen` returns `fresh: aiOn`).
- Live OCR text quality of a JPEG member: operator residual R2 (existing backlog).
- `package-db-v2` proves the upgrade in fake-indexeddb only.
- `intake-demo-packages` runs seven packages back to back (about 10 s alone); it is load-sensitive.

Follow-up stubs to register in UPDATE PROCESS: `package-restore-on-reload`, `package-no-llm-live-proof`, `package-single-file-high-sub-fixtures` (Deviation 1 for Phase 3).

CONTEXT_PARTIAL: none.

## Closeout Packet

- Selected plan: `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-2-web-data-plane_PLAN_17-10-26.md`
- Finished: Steps A to I (all checklist items).
- Verified by the execute agent (unconfirmed until EVL): every gate above.
- Unverified: independent EVL, the code-reviewer pass on persistence and the cross-firm guard, the Phase 4 evidence pack.
- Classification: Keep in active/testing (EVL next).

## Forward Preview

### Test Infra Found
- `e2e/fixtures/package.ts` (frozen helpers plus `idbCounts`). The `package-store` harness mocks the engine client by delegating to the real `engine.worker` `api` (real facts, no Worker).

### Blast Radius Changes
- New: `state/package.ts`, `features/package/*`, `open-document/{PackageConfirmTable.tsx,package-actions.ts,demo-packages.ts}`, `styles/package-intake.css`. `review.ts` gains `attachPackage` and `OpenPackageOption`. `DocMeta.packageId`.

### Commands to Stay Green
- The unit tokens above, the nine `intake-*` e2e tokens, and the full `pnpm --filter @aduin/web test:e2e`. Run build-samples before reading `public/samples/packages.json` (pretest:e2e does it).

### Dependency Changes
- None.
