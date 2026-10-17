---
phase: variance-mvp-phase-01-core-engine
date: 2026-10-17
status: COMPLETE_WITH_GAPS
feature: variance-management
plan: process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-01-core-engine_PLAN_17-10-26.md
---

# Phase 01 (V1) Core engine + corpus - EXECUTE + EVL + UPDATE PROCESS report

**Final status: VERIFIED (EVL green after 1 fix cycle).** Commits: `42b3ecb`, `7f0f355`, `d954511`, `789eb8f`, `0ee9fca`. Final counts: full core 3158 passed + 3 skip, scripts 162, test:golden 98 + 3 skip, test:corpus 13. Demo pin 214 / 7 (3 new, 4 logic) / 207 cosmetic in 5 groups. Package 01 (final): raw 64, shown 9 (2 new + 7 logic), recall 7/7. AC-V6 strict precision 2.9% overall, 6.7% on #5 -> #6 after rule `VAR-COS-PAGE-LABEL` (rules 2026.10.2). Archival: Keep in `active/` (umbrella phase program; archive with the program). SPEC achievement: umbrella SPEC governs; AC-V1 to AC-V4, AC-V6, AC-V10 (graph fixtures), AC-V11 (routing) met by passing automated gates; real-document impact precision and package-01 key divergence are named residuals with backlog notes (not claimed met).

**Bottom line:** the variance engine is built in `packages/core/src/variance/` and every gate in the validate contract exits 0. The demo pair hits the pin exactly: raw 214, shown 7 (3 new, 4 logic), cosmetic 207 in 5 groups (118 / 41 / 8 / 29 / 11). Package 01 recalls all 7 answer-key passages; its row split differs from the key (backlog note written, as planned). Gaps are named residuals only (real-document impact precision; page-label rows on #5/#6).

- Commits (main, not pushed): `42b3ecb` feat (engine + additive counsel changes + barrel), `7f0f355` test (corpus generator + fixtures), `d954511` test (18 gate files, 70 tests).
- Entry HEAD: `d90f925`. Tree clean in the blast radius; untracked `.DS_Store` and `.playwright-mcp/` untouched (D-S0-9).
- 0 AI calls, 0 network calls, no wrangler, no Playwright.

## What Was Done

| Section | Result |
|---|---|
| A PLAN-time checks | A1 `buildUnits`/`alignUnits`/`Unit`/`Alignment`/`tokenize`/`diffText` exported; cover = `Unit.kind 'scope'`; number map derived from paired unit keys inside `variance/` (no diff barrel edit). A2 `finding.detector_id` has no CHECK; `pattern_key` CHECK is length <= 80; `ActiveDecision.fund_name` required (`contracts/memory.ts:62`). A3 JSON import `with { type: 'json' }` precedent in `memory/firms.ts`; config is `variance-rules.json`. A4 baseline green: diff-contract 3, diff-determinism 2, gate-state-matrix 2406, sheet-contents 5. Barrel re-grep: zero collisions. |
| B Rules config | `rules-schema.ts` (zod strict, unique ids, lower-case lists, int pins, regex length cap), `variance-rules.json` v`2026.10.1`, `rules.ts` (`loadVarianceRules`, `VarianceConfigError` with path, canonical `rulesHash8`, nested-quantifier regex rejection). |
| C Hunker | `hunks.ts`: full unit text, jsdiff via `diffText`, merge gap 1 (config), whole unit = 1 hunk per block, truncated = 1 coarse replace, move hunk for identical out-of-order units. |
| D Classifier | `classify.ts` + `cosmetic.ts`: ordered D1 algorithm with G2 (renumber / cover date before the digit guard) and G3 (cluster class); 5 positive cosmetic rules + moved; display-only groups. |
| E Impact, routing | `impact.ts`, `audience.ts`, `routing.ts`. Demo 4.2 line: "entities affected; US entities lose the beneficial owners question; old rule not reusable". |
| F Adapter, regression | `adapter.ts` (no `buildFinding`; scalar facts; `varianceMetaOf` sole decoder), `regression.ts`, `label.ts`, `run.ts` (no checks input). |
| G Gate, keys, sheet | `computeGate` optional 4th `policy`; `GateFinding.gates`, `GateState.ownerAnswers`, `GateReason.owner`, `ComputeGate` type updated in the same edit; `owners.ts`; per-owner sheet + `version_drift` template draft. |
| H Barrel, corpus | Explicit named export list appended to `src/index.ts` (no `export *`); `build-variance.ts` (+1 call in `build-seeded.ts`, stray scan in `check.ts` after `walkPkg`); `fixtures/variance/` in `.prettierignore`; H4 package-01 test. |
| I Wrap-up | Determinism + no-LLM gates; full regression block; this report. |

**E12 (214 pin):** satisfied without a PLAN-SUPPLEMENT. 7A is a heading-only added unit (1 block = 1 raw change); Singapore and 8(f) are single contiguous 12+ word insertions. Each of the 7 items measured as exactly 1 hunk.

**E13 (unit keys after Intake's heading/conditional edits):** `golden-05-06-drift` green (8). Measured #5/#6 keys used by the golden: `appendix:c` (removed), `signature:1/s6/pb` (class fees). No key moved relative to the plan's expectations.

**Diff barrel:** no export line added (A1 satisfied; `scopeLabel` imported by relative path).

### Measured counts

| Pair | raw | shown | new | logic | cosmetic | groups |
|---|---|---|---|---|---|---|
| H&C Fund II -> Fund III (pin) | 214 | 7 | 3 | 4 | 207 | 5: renumber 118, name II->III 41, date 8, rename Units->Shares 29, format 11 |
| Package 01 Northgate II -> III (measured, pinned) | 64 | 9 | 2 | 7 | 39 | 3: name II->III 11, rename II->III 1, rename Units->Interests 27 |
| Real #5 -> #6 (measured, pinned) | 163 | 20 | 0 | 20 | 65 | 7 (date 5, 5 renames, format 15) |

Demo item table (hand-authored, asserted): 7A new VAR-NEW-UNIT fund_admin; Singapore new VAR-NEW-INSERTION gp+counsel; 8(f) sanctions new VAR-NEW-INSERTION counsel; 4.2 changed_logic VAR-LOGIC-GUARD-JURISDICTION counsel; Class A minimum changed_logic VAR-LOGIC-GUARD-DIGIT gp; tax status changed_logic VAR-LOGIC-DEFAULT counsel; trust split changed_logic VAR-LOGIC-GUARD-INVESTOR gp (SPEC A9).

Recall 25/25 seeded + demo new/logic changes, logic hidden as cosmetic 0. Precision: 1/39 logic rows cosmetic-shown-as-logic (2.6%); #5/#6 alone 1/20.

### Package-01 key vs engine (E14, recorded, not asserted)

| Key item | Key | Engine | Row |
|---|---|---|---|
| V1 | new / fund admin | new VAR-NEW-UNIT / fund_admin | body:1/s7a |
| V2 | new / GP+counsel | changed_logic JURISDICTION / gp,counsel | body:1/s4/pa (with V4) |
| V3 | new / counsel | new VAR-NEW-INSERTION / counsel | body:1/s10 |
| V4 | logic / counsel | changed_logic JURISDICTION / gp,counsel | body:1/s4/pa (with V2) |
| V5 | logic / GP | changed_logic DIGIT / counsel | body:1/s1 (with dates) |
| V6 | logic / counsel | changed_logic INVESTOR / counsel | body:1/s6/pa (with V7) |
| V7 | logic / counsel (SPEC A9: GP) | changed_logic INVESTOR / counsel | body:1/s6/pa (with V6) |

Rows differ: 9 shown vs the key's 7; split 2 new + 7 logic vs 3 + 4. Causes: top-level units merge items; the Singapore table row is under 12 words; operative digit changes (address, dates, `C-3` labels) are logic by the digit guard. Backlog note written: `process/features/variance-management/backlog/variance-package-01-key-divergence_NOTE_17-10-26.md`.

## What Was Skipped or Deferred

- Nothing in the checklist was skipped. Firms, contracts, D1, Worker and web are untouched (later phases).
- Real-document impact precision stays a named residual (G8, backlog stub already on disk).
- Page-label artifact rows on #5/#6: initially uncovered; RESOLVED in EVL cycle 1 by rule `VAR-COS-PAGE-LABEL` (option a); note `variance-page-label-noise-rows_NOTE_17-10-26.md` now resolved.

## Test Gate Outcomes

All commands run from the repo root, one token per call, no `--` token.

| Command | Result |
|---|---|
| `pnpm --filter @aduin/scripts fixtures:build` | wrote 107 files (no existing fixture changed) |
| `pnpm --filter @aduin/scripts fixtures:check` (x2 after build) | OK, 117 files match, both runs |
| `variance-rules-config-schema-and-provenance` | 5 passed |
| `variance-classification-contract` | 15 passed |
| `variance-seeded-recall-matrix` | 2 passed |
| `variance-precision-measure` | 1 passed |
| `variance-golden-05-06` | 2 passed |
| `variance-impact-from-graph-fixtures` | 4 passed |
| `variance-impact-demo-4-2` | 2 passed |
| `variance-routing-table-matrix` | 4 passed |
| `variance-demo-count` | 3 passed |
| `variance-package-01-northgate` | 1 passed |
| `variance-finding-adapter-contract` | 5 passed |
| `variance-regression-scope-exists` | 4 passed |
| `variance-ai-never-gates-core` (Hybrid, hand-built recorded-shape AI findings) | 1 passed |
| `variance-gate-state-matrix` | 9 passed (policy off byte-equal on all 2400 cells) |
| `variance-question-key-matrix` | 3 passed |
| `variance-sheet-owner-and-template` | 5 passed |
| `variance-determinism-repeat-run` | 2 passed |
| `variance-no-llm-full-run` | 2 passed |
| Regression loop (`diff-contract` 3, `diff-determinism` 2, `diff-pairs` 8, `diff-perf` 1, `gate-state-matrix` 2415 = 2406 legacy + 9 variance in 2 files, `sheet-contents` 5, `contracts` 34, `golden-05-06-drift` 8, `sibling-clause-common-vs-differing` 3, `security` 59, `package-gate-policy-matrix` 8, `package-baseline-eligibility` 5) | all exit 0 |
| `pnpm --filter @aduin/core test:golden` | 98 passed, 3 skipped |
| `pnpm --filter @aduin/core test:corpus` | 13 passed |
| `pnpm --filter @aduin/core typecheck` | exit 0 |
| `pnpm --filter @aduin/scripts record:author --check` | recordings OK (11 cases), no drift |
| `pnpm lint` | exit 0 (eslint + prettier) |
| `pnpm typecheck` | exit 0 (all packages) |
| Full core suite (info) | 118 files, 3154 passed + 3 skipped (before: 3084 + 3) |
| Full scripts suite (info) | 162 passed (unchanged) |

Regression lines:
- Regression: diff-contract / diff-determinism / diff-pairs / diff-perf - PASS
- Regression: gate-state-matrix - PASS (2406 legacy tests unchanged)
- Regression: sheet-contents - PASS
- Regression: contracts (snapshot) - PASS (snapshot not regenerated)
- Regression: golden-05-06-drift - PASS
- Regression: firms-and-rules - PASS (in full core suite; firms untouched)
- Regression: fixtures:check - PASS
- Regression: record:author --check - PASS

## Plan Deviations

Recorded in the plan's `## Deviations` (X1-X9), all within the blast radius: format checked before name/rename (X1); `rawChanges` and per-class counts in the result (X2); `VarianceSide` carries `firmId`/`label` (X3); new test helper (X4); 2-line `build-seeded.ts` append (X5); `SheetFinding.owners?`/`change?` and the sheet importing `questionKey` (X6); one gate reason per open asked owner, regression = `gates` + critical (X7); extra config keys within B1 intent (X8); red-first applied to Section G only (X9).

## Test Infra Gaps Found

- None blocking. `pnpm --filter @aduin/core test <token>` prints vitest `console.log` lines only with `--silent=false`; the recall/precision/package-01 measurements were read with `npx vitest run <file> --reporter=verbose --silent=false` inside `packages/core`.
- CONTEXT_PARTIAL: none.

## Closeout Packet

- Selected plan: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-01-core-engine_PLAN_17-10-26.md`
- Finished: checklist A-I, H4, edge cases 1-4 (merge-gap pins, cosmetic traps, facts shape, key leakage + 2400-cell off-equality).
- Verified: every validate-contract command above exits 0 (executor run; EVL re-run independently by vc-tester, see EVL fix cycle 1).
- Unverified / residual: real-document impact precision (G8); page-label rows on #5/#6 (note); package-01 key divergence (G9 note).
- Cleanup / context capture remaining (UPDATE PROCESS): registry status DONE after EVL; umbrella `## Current Execution State`; engine context doc gains the variance module; umbrella lines on "package 01 = 3 new + 4 logic" (PVL advisory) need aligning with H4.
- Closeout classification: **Keep in active/testing** until EVL confirms, then Ready for UPDATE PROCESS archival.
- Next valid state: EVL (independent vc-tester re-run of the gates above), then UPDATE PROCESS; next phase plans `variance-mvp-phase-02-web-findings_PLAN_17-10-26.md` and `variance-mvp-phase-03-memory-backend_PLAN_17-10-26.md` (parallel-safe).

Follow-up stubs created: `process/features/variance-management/backlog/variance-package-01-key-divergence_NOTE_17-10-26.md`, `process/features/variance-management/backlog/variance-page-label-noise-rows_NOTE_17-10-26.md`.

## Forward Preview

### Test Infra Found
- `packages/core/test/helpers/variance.ts`: `vside`, `sideOfHtml`, `demoPair`, `seededPair`, `sampleVSide`, `expectedDemo`, `expectedSeeded`, `doc` (inline HTML builder).
- `fixtures/variance/expected/{hartwell-crane,seeded}.json` are hand-authored; `build-variance.ts` throws if the authored 118/41/8/29/11 split drifts.

### Blast Radius Changes
- New public core exports: `runVariance`, `varianceMetaOf`, `loadVarianceRules`, `questionKey`, `parseQuestionKey`, `runRegressionChecks`, `describeAssertion`, `assertionCandidateOf`, `normalizeAssertionLabel` + types (`VarianceResult`, `VarianceMeta`, `VarianceSide`, `Owner`, ...). Counsel types (auto-exported via `export type *`): `VarianceGatePolicy`, `GateOwner`, optional `gates` / `ownerAnswers` / `owner` / `meta.owner` / `SheetFinding.owners` / `SheetFinding.change`.
- V2 must pass `firmId` on both `VarianceSide`s and `gates: true` for variance findings in `computeGate(..., policy)`; policy values come from `loadVarianceRules().config.gate_policy`.
- `templateVersionDriftInterpretations` / `templateVersionDriftQuestion` live in `counsel/template-draft.ts` but are not in the core barrel yet (V4 may append them).

### Commands to Stay Green
- The 18 `variance-*` tokens, `gate-state-matrix`, `sheet-contents`, `contracts`, `golden-05-06-drift`, `fixtures:check`, `record:author --check`, `pnpm lint`.

### Dependency Changes
- None (no new packages). Uses existing `diff`, `zod`, `@noble/hashes`.

TL;DR: V1 engine done and green; 214 -> 7 pin exact; package 01 recall 7/7 with a documented row-split divergence; awaiting independent EVL.

## EVL fix cycle 1 (AC-V6 strict precision)

**Bottom line:** AC-V6 now passes on the strict figure. Cosmetic shown as logic: 1 of 34 logic rows (2.9%) overall, 1 of 15 (6.7%) on #5 -> #6. Before: 15.4% overall, 30% on #5 -> #6.

- **Fix (789eb8f):** new positive cosmetic rule `VAR-COS-PAGE-LABEL` (rules version 2026.10.1 -> 2026.10.2, so rulesHash8 changes; provenance tests read the hash live, version pin updated). It accepts a hunk only when each changed side is exactly one `^[A-Z]{1,2}-\d{1,3}$` token alone on its own line. Runs in the G2 digit-exemption slot (same as renumber / date); every other guard still wins. Group key = rule id.
- **Tests (0ee9fca):** classification-contract gains 4 named cases: lone label dropped / re-lettered = cosmetic; traps stay logic: "see Annex B-1" -> "B-2", "Section 4-2" -> "4-3", label inside a sentence deleted, label replaced by "$100". precision-measure asserts the STRICT figure (page-label rows still shown count as misclassified) and prints both. Measured pins updated: golden-05-06 summary raw 163 / shown 15 / cosmetic 78 / logic 15, new group `VAR-COS-PAGE-LABEL` 13; schema test dup-rule path rules.20.
- **Unchanged (hand-authored, not edited):** demo pair 214 / 7 / 207 in 5 groups; seeded recall 25/25, logic hidden as cosmetic 0; package-01 Northgate counts unchanged.
- **Deviation (within blast radius):** bare page numbers were dropped from the rule — the adapter page-noise pass already strips them, so the branch was dead code.
- **Gates:** all 18 variance tokens + 12 regression tokens green; test:golden 98 (+3 skip); test:corpus 13; full core 3158 passed (+3 skip); core + root typecheck; lint; fixtures:build then fixtures:check twice; record:author --check: all exit 0.

## EVL result and UPDATE PROCESS close-out

- EVL: 1 cycle (`results-evl.tsv`: baseline, cycle 1 FAIL AC-V6 strict 15.4%, cycle 1 PASS). Iteration report `variance-mvp-phase-01-evl-iteration-001_REPORT_17-10-26.md`. Final loop status HALTED_SUCCESS.
- Deviations: X1-X9 (above) plus the page-label rule (X10: new positive cosmetic rule, rules version 2026.10.2, bare page numbers dropped as dead code). All inside the Phase 01 blast radius.
- Measured package-01 split supersedes the umbrella's earlier "3 new + 4 logic" claim: 64 raw / 9 shown / 2 new + 7 logic / recall 7/7. The pin for the authored H&C demo stays 7 (3 + 4). Umbrella lines aligned in this UPDATE PROCESS.
- Context updated: `process/context/engine/all-engine.md` (variance module), `process/context/tests/all-tests.md` (variance tokens, counts). Validators: see the final hand-off.
- Follow-ups: `variance-package-01-key-divergence_NOTE_17-10-26.md` (open), `variance-impact-real-sample-ground-truth` (open), page-label note (resolved).
- Next: Phase 03 EXECUTE (inner PVL PASS), then Phase 02 (inner PVL in progress).
