---
phase: variance-mvp-phase-02-web-findings
date: 2026-10-18
status: COMPLETE
feature: variance-management
plan: process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-02-web-findings_PLAN_17-10-26.md
---

# Phase 02 (V2 Web Findings) - EXECUTE report

**TL;DR:** Variance now shows inside the existing Findings screen (segment, change rows, baseline control and modal, cosmetic groups, muted lines, "Checking changes" pill). All 13 contract gates, the full regression block, the full web unit suite (338), typecheck, lint and the whole preview e2e suite (228 passed, 1 skip) are green. Three code commits, no push, no deploy, 0 model calls.

## What Was Done

Commits (main, local only): `8f4e6a4` feat (worker pass + accessor), `60a5507` feat (Findings UI, adapter, store, shared selector), `15aa796` test (unit + e2e gates, two derived repairs).

- **A (verifications):** A1 no pending treatment existed, added UI-only. A2 worker imports core variance JSON fine; the result is structured-clone safe (asserted). A3 `variance.css` imported per feature (like `memory.css`). A4 reused `e2e/fixtures/ai.ts`. A5 scan rule applied (scan baseline line, scanned-current line). A6 baseline before edits: counsel-gate 4, gate-pill 5, diff-pairs 10, turnstile-no-block 2, import-graph 4 (all green). A7 ripple predictions below.
- **B:** `readPackageMemberSource` (additive, pure; no existing export changed). `baseline-source.ts` (package role first via core `eligibleBaselines`, firm pointer second; same firm only; null-firm rows removed before the core call; synthetic `packageId`; never its own baseline; expired, gone and scan cases). `variance-store.ts` (status, run id stale drop, `VARIANCE_PENDING_TIMEOUT_MS` = 20 s, pointer written after a no-baseline upload review).
- **C:** worker `runVariance` reuses `prepare` for the baseline and the retained graph (`touch`) for the current document; maps rows through `toView` with `kind: 'change'`; adds `gatePolicy`, `rulesVersion`, `rulesHash8` from `loadVarianceRules()` inside the worker. E2E seam `varianceDelayMs` / `varianceFail` (IS_E2E only; proven absent from production). Trigger after findings render (D-S0-2: openDocument completion and package baseline-role changes). Gate sites in `state/review.ts` (`gateLine`, dismiss next-selection, dismiss toast) now use the shared merged-row gate that keeps `unreadable`.
- **D:** filters `kind` and `showCosmetic` (old persisted filters still load); segment `All / Errors N / Changes N` beside the kept `CoverageLine`; chips and `Errors N` count errors only; change rows (type chip, owner chip read-only, status icons, old above new with `del` strike-through and `ins` bold underline, impact lines "from the logic graph, deterministic", provenance `version (hash8)`, masked by `maskQuote`); "Mark as expected…" (Dismiss modal, reason required) and "Ask owner" (Needs counsel) write local triage only; cosmetic groups capped at 5 plus a muted overflow line; removed-unit rows create no mark; JumpMenu counts change rows under the Changes segment only.
- **E:** header `BaselineControl` (`vs <name> ▾`, firm documents only) and `BaselineModal` (same-firm candidates whose text is in the browser, suggested item pre-checked, error only on submit); no demo control. Exact no-baseline copy.
- **F:** `computeGate(rows, policy?)` maps change rows to `gates: true` only when a baseline resolved and the pass is ready; `GateButton` keeps Intake's `merged`, badge and three-part render, and adds the UI-only pending display (never Ready while pending).
- **G/H:** AI-never-gates e2e (stubbed `/api/ai`, openrouter aborted, 0 live calls); counts selector and no-LLM worker run.

## What Was Skipped or Deferred

- Nothing in the checklist skipped.
- Agent-probe keyboard walk and opt-in design probe (`DESIGN_PROBE=1`) not run in this EXECUTE pass; axe via `a11y-keyboard` is green. Human keyboard pass stays the named backlog residual (`variance-web-manual-keyboard-pass_NOTE_17-10-26.md`).
- E9 (registry note) was an orchestrator to-do outside the execute agent's write scope; closed by UPDATE PROCESS (see Registry below). Files: V2 also edits `state/package.ts` (one additive export), `e2e-hook.ts`, `no-e2e-hook-in-dist.test.ts`, and (deviation 6) `features/review/components/DocPane.tsx`, `test/review-sync.test.ts`, `e2e/memory-no-reflag.spec.ts`.

## Test Gate Outcomes

Exact contract commands (one token per call, serial preview on 4317, port checked free before each call):

| Gate | Result |
|---|---|
| unit `variance-counts-selector` | 5 passed |
| unit `variance-baseline-source-contract` | 7 passed |
| unit `variance-store` | 5 passed |
| unit `package-member-source` | 6 passed |
| unit `variance-no-llm-full-run-web` | 2 passed |
| unit `no-e2e-hook-in-d` | 2 passed |
| unit `import-graph` | 4 passed (no new ALLOWED line needed) |
| e2e `variance-render-first` | 3 passed (3 s delay, failure, 20 s timeout) |
| e2e `variance-cosmetic-hidden-default` | 1 passed |
| e2e `variance-baseline-from-package` | 3 passed (package path, lens role change without re-open, reload restore, pointer path + modal, two baselines ignored line, scan baseline line, expired line) |
| e2e `variance-baseline-same-firm-only` | 1 passed |
| e2e `variance-no-baseline-errors-only` | 2 passed (incl. scanned-current line, counsel unaffected) |
| e2e `variance-ai-never-gates` (Hybrid) | 1 passed |
| Regression e2e block (23 tokens) | all passed (counsel-gate 4, gate-pill 5, diff-pairs 10, memory-no-reflag 1, turnstile-no-block 2, a11y-keyboard 4, layout-vs-mockup 5, no-llm-corpus 1, sample-zero-calls 4, filter-sort 4, app-shell 8, placeholder-routes 5, mobile-shell 5, restore-and-no-text 2, nine intake tokens all passed; intake-demo-packages run alone) |
| Unit tokens package-store / package-view / package-gate-ui / gate-pill / restore-last-doc | 21 / 8 / 7 / 4 / 10 passed |
| `pnpm --filter @aduin/web test` | 338 passed (47 files) |
| `pnpm --filter @aduin/web typecheck` | ok |
| `pnpm lint` | ok |
| Extra: full preview e2e (`pnpm --filter @aduin/web test:e2e`) | 228 passed, 1 skipped (was 217 + 1 skip; +11 variance tests) |

Red-first: all seven stubs were written first and failed with `NOT IMPLEMENTED - TDD stub for: ...` before implementation.

### A7 ripple prediction vs observed

| Spec | Predicted | Observed |
|---|---|---|
| sample-zero-calls, filter-sort, gate-pill, a11y-keyboard, no-llm-corpus, diff-pairs, layout-vs-mockup (sample opens) | samples never become a firm-pointer baseline (deviation 3), so no change rows; Partners Group samples show the segment, "No baseline" control and the short muted line | as predicted for rows and counts. Two real UI bugs surfaced and were fixed in product code (not in specs): the extra segment row broke the findings-column grid (list overlapped the chips: filter-sort, layout-vs-mockup); the baseline control aria-label did not contain its visible text (axe `label-content-name-mismatch`: a11y-keyboard) |
| memory-no-reflag (Fund I then Fund II uploads, same firm) | Fund I becomes the baseline, change rows join Fund II | 3 change rows joined; derived repair: count error rows only |
| intake specs with a baseline role | variance may add rows | all passed unchanged |
| review-sync unit (fixture with zero blocks) | not predicted | the shared gate keeps `unreadable`, so the toast now follows the pill ("Not ready"); derived repair: the fixture gets one block (a readable document) |

## Plan Deviations

All within the blast radius; none touches auth, billing, schema, Worker, deploy or a public API.

1. **Trigger location:** the pass starts from a `useReview.subscribe` (phase becomes ready) inside `variance-store.ts`, not an edit inside `openDocument`. Why: avoids a module cycle (review -> variance store -> package -> review) and gives D-S0-2 in one place. Impact: same timing (synchronous in the same store update, so `resolving` lands with the findings); `state/review.ts` edits stay limited to the gate sites.
2. **Triage key:** change-row triage uses the existing `triage:{docId}` key (D4 and Public Contracts "same triage store"); no `variance:triage:{docId}` key exists. The pointer key `variance:baseline:{firmId}` is used and asserted.
3. **Samples never become a pointer baseline:** B1 builds pointer candidates from stored uploads only, so only an uploaded firm document becomes the firm baseline; samples with a firm show "No earlier document from this firm. Reviewing for errors only." (without the "becomes the baseline" sentence). Null-firm documents show no segment and no line.
4. **Cosmetic toggle location:** "Show cosmetic changes (N)" sits under the list (in `CosmeticGroups`), not inside the Filter popover, so `FilterMenu.tsx` is untouched.
5. **import-graph:** no ALLOWED line appended. `VarianceResult.meta` arrives decoded from the worker, so the main thread needs no `varianceMetaOf` (E6 permits this).
6. **Extra small edits:** `DocPane.tsx` JumpMenu filter (D2b rule needs it), and the two derived test repairs above.
7. **AI-never-gates stub severity:** the stub claims `high`, the highest an AI finding may claim (the core schema rejects `critical` for AI findings); the explanation asks to block.
8. **Pending timeout:** `VARIANCE_PENDING_TIMEOUT_MS` = 20 000 ms (the plan named the constant, not the value).

## Test Infra Gaps Found

- None blocking. The e2e preview needs no Turnstile key; the live Turnstile render-first path stays the V5 residual (backlog `variance-render-first-live-turnstile_NOTE_17-10-26.md`).
- Hartwell fixture pair yields only 1 change and 0 cosmetic hunks, so the cosmetic and diff e2e use the NGI 2024/2026 pair (15 changes, 78 cosmetic hunks, 8 groups).

## Closeout Packet

- Selected plan: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-02-web-findings_PLAN_17-10-26.md`
- Finished: checklist A to I; Phase Loop step 5 ticked.
- Verified: every contract gate, regression block, full unit suite, typecheck, lint, full preview e2e.
- Not verified: agent-probe keyboard walk and design probe; live deployed path (no deploy in this phase).
- Remaining at EXECUTE end: EVL, E9 registry note, UPDATE PROCESS (all done, see Closeout below). AC-V1 phase-level verdict: both resolution paths now pass by gate (package role and firm pointer); Intake names used: `usePackage.getState().current` (primary, docs, roles, tag), `usePackage.setRole`, `listUploads`, `readUpload`, `readMemberBytes`, `readPackage`, core `eligibleBaselines`, plus the new `readPackageMemberSource`. Note: the adapter reads `usePackage` state directly (same data as `usePackageView`) because it runs outside React.
- Classification at EXECUTE end: Ready for EVL, then UPDATE PROCESS archival.

## SPEC Achievement

Umbrella SPEC governs (inner loop skips SPEC). Phase-level criteria scored by gate:

| Criterion | Score | Proven by |
|---|---|---|
| AC-V1 baseline resolved from package role and from firm pointer, same firm only | met | `variance-baseline-from-package`, `variance-baseline-same-firm-only`, `variance-baseline-source-contract` (all green, Fully-Automated) |
| Findings render first, variance never blocks (pending, failure, 20 s timeout) | met | `variance-render-first` 3/3 |
| Cosmetic changes hidden by default, counted | met | `variance-cosmetic-hidden-default` |
| No baseline: errors only, exact copy, counsel unaffected | met | `variance-no-baseline-errors-only` |
| AI never gates | met (Hybrid, stubbed AI only) | `variance-ai-never-gates`; live AI path is operator R2 residual, recorded as known gap, not counted as proof of live behaviour |
| Human keyboard and screen-reader pass | unmet | backlog `variance-web-manual-keyboard-pass_NOTE_17-10-26.md` exists |

## SPEC Gaps

- Human keyboard/screen-reader pass (backlog stub exists).
- Live Turnstile render-first path (backlog `variance-render-first-live-turnstile_NOTE_17-10-26.md`).

## UPDATE PROCESS Closeout (2026-10-18)

- EVL: independent vc-tester PASS on first run, 0 fix cycles (`results-evl.tsv`, row `0 P02 ... HALTED_SUCCESS`). EVL HANDOFF: closeout_classification CLEAN, no failing gates.
- Classification: phase VERIFIED. Plan stays in `active/` because it belongs to a live phase program (umbrella and Phases 04, 05 still active; archival moves with the program).
- Drift: MEDIUM-HIGH by file count (more than 10 files, backlog notes referenced, process docs edited). Recommend UPDATE PROCESS -- significant changes detected.
- Registry: appended `## Phase 2 result` (files beyond the claim). The earlier `## Phase 2 revision` (written by the Phase 03 closeout) already covered `state/package.ts`, `e2e-hook.ts`, `no-e2e-hook-in-dist.test.ts`; not duplicated.
- Context updated: `process/context/ui/all-ui.md` (Variance Findings UI section), `process/context/tests/all-tests.md` (Variance Phase 02 tokens and counts). `all-context.md` counts line refreshed.
- Process commit: local on main, no push.
- Autopilot decisions (auto-approved, reversible): umbrella state rewrite, registry append, context edits.
- Behavioral note: a vc-validate-agent edited the P04 plan concurrently; this closeout did not touch it.

## Forward Preview

### Test Infra Found
- `apps/web/e2e/fixtures/variance.ts`: `uploadOne`, `varianceSettled`, `changeRows`, `errorRows`, `varianceDelay`, `varianceFail`, `ageUploads`, `NGI_2024/NGI_2026`, `rawFile`, `scanPage`.
- Rows carry `data-kind="change"` and `data-change-type`; the pill carries `data-variance-pending`.

### Blast Radius Changes
- New: `apps/web/src/features/variance/*`, `apps/web/src/styles/variance.css`.
- Edited beyond the touchpoint list: `features/review/components/DocPane.tsx` (JumpMenu), `test/review-sync.test.ts`, `e2e/memory-no-reflag.spec.ts`.

### Commands to Stay Green
- The contract loops above; for e2e always one token per call and check port 4317 first. Specs that open two same-firm uploads now get change rows: count error rows with `:not([data-kind="change"])`.

### Dependency Changes
- None (no new package, no Dexie bump, no new main-thread core symbol).

CONTEXT_PARTIAL: none.
Follow-up stubs created: none (existing backlog residuals cover the manual keyboard pass and the live Turnstile path).
