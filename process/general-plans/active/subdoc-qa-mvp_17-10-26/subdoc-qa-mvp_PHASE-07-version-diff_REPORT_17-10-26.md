---
phase: phase-07-version-diff
date: 2026-10-17
status: COMPLETE_WITH_GAPS
feature: subdoc-qa-mvp
plan: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-07-version-diff_PLAN_17-10-26.md
---

# Phase 07 — Version Diff — Report

Status: 07a is done (core diff engine, fixtures, goldens). 07b (worker seam, Compare UI, e2e) and 07c (AI narrative) have not started. Nothing is committed yet.

## 07a — Core diff engine + goldens + fixtures (2026-10-17)

### What Was Done

- `packages/core/src/diff/`: `types.ts` (zod `DiffResultSchema` (strict, no timing), `SideInput`, `DiffStage` = read|parse|structure|detect|diff, `DiffErrorSchema` (code limited to `^[a-z_]{1,40}$`)), `normalize-key.ts`, `align.ts`, `diff-text.ts`, `extract-terms.ts`, `extract-fees.ts`, `extract-requirements.ts`, `rename-inference.ts`, `findings-delta.ts`, `sibling.ts`, `index.ts` (`diffDocuments({a, b, mode})`).
- Barrel: one appended block in `packages/core/src/index.ts` (`export * from './diff/index'`).
- Alignment units are scope preambles, sections and parts. Passes run in this order: exact (structural key + heading key, made monotone with an O(n log n) LIS step), then LCS on heading keys inside unmatched windows, then same structural key (relabel), then Jaccard similarity (≥ 0.5 on heading + first 200 chars). Each window is capped at 250k cells. Repeated headers get ordinals: by scope-kind occurrence (`body:2`), plus `#n` on duplicate keys.
- Text diff: sensitive spans are computed once on the whole raw text. Each span becomes one atomic token, then jsdiff `diffArrays` with `maxEditLength` 1500 runs over those tokens. A number can never be split across segments (E17), and the segment `sensitiveSpans` are mapped from the whole-text spans. If jsdiff returns `undefined`, the fallback is one `del` plus one `add` for the whole block, with `truncated: true`.
- Excerpts are raw clipped text plus `sensitiveSpans`, with clip bounds widened so no span is split. The ellipsis is a `clippedStart/End` flag, not text inside the excerpt. Core does no masking.
- Fixtures (generator `buildDiffFixtures()` in `scripts/src/fixtures/build-seeded.ts`; expectations authored there): `fixtures/diff/{sibling-A,sibling-B,empty,single-section}.html`, `identical-pair/{a,b}.html`, `expected/{sibling-A-vs-B,identical-pair,not-enough-structure}.json`. The differing wire clause changes the synthetic number itself (990000017 → 990000025). `check.ts` now scans `fixtures/diff` recursively for stray files; a planted `expected/stray.json` made `fixtures:check` exit 1.
- Tests: `test/unit/diff/{diff-pairs,diff-determinism,diff-input-failure,diff-perf,sibling-clause-common-vs-differing,diff-contract}.test.ts` + `diff-helpers.ts`; `test/golden/diff/{golden-05-06-drift,golden-06-llc-agreement-lowconf}.test.ts`.

### Pinned golden numbers (engine output, #5 → #6)

| Item | Value |
|---|---|
| Sections | added 0, removed 1 (`appendix:c`), renamed 1 (`signature:1/s6/pa` "Unit class" → "Share class"), moved 0, changed 21, same 9 |
| Findings delta | fixed 4 (2× ref-label-coherence, flag-placeholder `[xx]`, flag-drafting-note), still present 3 (2× flag-sensitive, flag-placeholder `[insert investor name]`), new 0 |
| Quote-similarity threshold | 0.5. Accepted pairs: min 1.0. Best rejected same-detector pair: 0.231 |
| Renames (from, to, count/occurrences) | Member→Shareholder 4/4; Memorandum→Prospectus 8/8; Placement Fee→Sales Load 3/3; Units→Shares 29/35 (0.83); placement agent→distributor 4/4. No other renames |
| Definitions renamed | Member→Shareholder, Memorandum→Prospectus, Units→Shares |
| Fees | 0.85% A same, 0.25% S same, 3.5% (no class) → 3.5% Class A changed, 1.5% Class S added |
| "Appendix C" mentions in #6 | 0 |
| LLC Agreement (AC16) | 11 occurrences in #6. Only a "Possible leftover": confidence 0.31, severity low. All leftovers: ERISA 0.24, LLC Agreement 0.31, Plan 0.30 |
| Rename thresholds | coverage ≥ 0.8, count ≥ 3, same-position window ±48 chars. Leftover rule: co-occurrence ≥ 0.5, count ≥ 3, confidence = min(0.4, 0.4 × ratio) |

#3 vs #4: added 10, removed 23, renamed 3, moved 4, changed 1. No crash.

### Perf (AC29 input, Node, test's own timer, includes both parses + both `runDeterministic`)

- #5 vs #6: 187 ms (warm). #2 vs #2: 143 ms. A cold one-off tsx run of #5 vs #6 took about 1.4 s in total. All are under 3 s. Worker timing is measured in 07b.

### Test Gate Outcomes

All green: `golden-05-06-drift` 8, `golden-06-llc-agreement-lowconf` 2, `diff-pairs` 8 (including `no-raw-sensitive-digits` and the E17 split-number case), `diff-determinism` 2, `diff-input-failure` 5, `diff-perf` 1, `sibling-clause-common-vs-differing` 3, `contracts` 34 (snapshot unchanged: its module list does not include `diff/`, and the separate `diff-contract` test covers `DiffResult`), `security` 34, `test:golden` 67, full core 70 files / 457 tests. Core typecheck, scripts typecheck and `fixtures:check` OK. Prettier and eslint are clean on all touched files. Each token exited 1 before its test file existed.

### Plan Deviations (within blast radius)

1. The diff uses jsdiff `diffArrays` over span-aware word tokens, not `diffWords`/`diffSentences`. Reason: that is the only way to keep a sensitive number atomic (E17). It is the same word-level operation from the same library, and `maxEditLength` → `undefined` was confirmed by a runtime probe.
2. There is no `timeout` option, only `maxEditLength`. A wall-clock bound would make the output depend on machine speed (determinism, E6).
3. Section titles are compared with parentheticals stripped. As a result §9 "(Selection Required Below)" and §12 counts as `changed`, not `renamed`, so Part A of §6 is the only relabel, as AC15 states.
4. An internal (non-input) exception yields `{error:{side:'a', stage:'diff', code}}`. The contract has no side-neutral value.
5. `possibleLeftovers` also lists ERISA and Plan (≤ 0.31, low). This is allowed by the diff-only rule; the values are pinned.
6. Requirement and definition comparisons are rename-aware: a sentence that changed only because of an inferred rename is not reported.

### What Was Skipped or Deferred

- 07b and 07c are not started (out of scope for this spawn). The backlog stubs (`drift-narrative-live-quality`, `compare-ocr-documents`, `phase08-version-drift-questions`) are not written yet; they belong to 07b/07c/UPDATE PROCESS.

### Test Infra Gaps Found

- The `contracts` snapshot test uses a hard-coded module list, so new schemas are never picked up automatically. `diff-contract.test.ts` covers `DiffResult` instead.
- Incident: another agent's `git stash` removed the uncommitted `buildDiffFixtures` block from `build-seeded.ts` once. I re-created it, and `fixtures:check` is green.

### Forward Preview

- Test Infra Found: `test/unit/diff/diff-helpers.ts` (`sideOf`, `fixtureSide`, `maskedRender`, `leakedRuns`, `allTexts`) can be reused by 07b.
- Blast Radius Changes: none outside the plan.
- Commands to Stay Green: the 7 core tokens above, `pnpm --filter @aduin/core test:golden`, `pnpm --filter @aduin/scripts fixtures:check`.
- Dependency Changes: none (`diff` 9.0.0 was already a dependency).
- For 07b: the worker needs `diffDocuments`, `DiffStage`, `DiffResult` and `CoreError` (all exported from `@aduin/core`). The main thread imports types plus `mask` only.
