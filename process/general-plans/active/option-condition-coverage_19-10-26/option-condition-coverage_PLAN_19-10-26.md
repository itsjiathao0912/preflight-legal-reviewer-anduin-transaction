---
name: plan:option-condition-coverage
description: "Add detector option-condition-coverage (class option_gap_overlap, severity high): flags an investor-type option only partly named by the adjacent conditional"
date: 19-10-26
feature: none
---

# Option-condition coverage detector — PLAN (SIMPLE)

Complexity: SIMPLE
Status: EXECUTED (19-10-26), awaiting EVL

## Overview
The demo doc offers "Partnership or LLC" while the next instruction only names partnerships, so an LLC investor's route is unclear. This adds one deterministic rule that catches this pattern.

## Acceptance Criteria
- AC1: The demo doc gets exactly 1 `option-condition-coverage` finding on "Partnership or LLC", citing the option, the conditional text and "Section 2, Part B", with the question "Should LLC investors complete Section 3?".
- AC2: Individual, Joint tenants, IRA and fully named options are never flagged.
- AC3: No new findings on the 13 SEC corpus samples; all existing gates stay green.

## Phase Completion Rules
CODE DONE when checklist items 1-3 are written. VERIFIED only when every test gate in the Validate Contract passes.

**Answer first:** add one new file in `packages/core/src/detectors/`, append one line to the registry, and add one test file. The change is limited to core. No changes to the taxonomy, web labels, Worker or contracts. Spec: `option-condition-coverage_SPEC_19-10-26.md`.

## Decision Summary

### Chosen Approach
New detector `option-condition-coverage` that reuses the `option_gap_overlap` class. A coverage gap between an option and its routing instruction is a kind of option gap, and reusing the class avoids touching frozen contracts and web labels.

### Why This Over Alternatives
| Alternative | Why Rejected |
|---|---|
| Add a new IssueClass `option_condition_gap` | Touches the frozen taxonomy (15 classes), `apps/web/src/features/review/issue-classes.ts`, labels, Worker schema enums and tests. Too wide for one rule. |
| Reuse `broken_conditional` | That class means a missing target and is `critical` (gating). Its counsel template is about skip targets. |
| Extend `investor-path-missing-item` | `classifyType` maps both "partnership" and "LLC" to `partnership`, so type-level logic treats the option as covered. The gap is only visible at word level. |

### Risk Predictions
- Precision: real SEC samples may contain "X or Y" options near conditionals. Mitigation: require an exclusive investor group, the 3-block window, same section, and an unnamed part that is a recognised type.
- Test drift: the new finding appears on the 4 hartwell-crane docs (public samples). Any spec that counts rule findings on those docs may move. Mitigation: run the full core suite and the preview e2e suite.
- Severity: `high` shows as "Fix" but `computeGate` is critical-only, so it does not block. `isBlocking(high)` triggers a memory re-confirm. This is accepted because it matches `option-gap-overlap`.

### Key Constraints Accepted
Word-level matching only. Light plural folding ("partnerships" → "partnership", "LLCs" → "llc"). IRA and unnamed options are never flagged.

## Algorithm
1. For each `group` in `g.structure.optionGroups` where `group.exclusive && isInvestorGroup(group)`:
2. Let `last = max(group.blockIndices)`. Candidate conditionals: `c.blockIndex` in `[min(blockIndices), last + 3]`, `!c.negative`, the same `info[].section?.number` as `last`, and `typesIn(c.trigger).length >= 1`.
3. For each option: `parts = cleanLabel(withoutMarker(label, marker)).split(/\s*(?:\bor\b|\/|,)\s*/i)`, filtered to non-empty. Skip the option when there are fewer than 2 parts. A part is `named` when its normalized head word (lowercase, trailing "s" stripped) is a word in the normalized trigger. Flag when there is at least 1 named part and at least 1 unnamed part with `classifyType(part) !== null`.
4. Emit at most one finding per (group, conditional), for the first flagged option. Anchor: `blockIndex = opt.blockIndex`, match the label inside `textOf`.
5. Facts (via `maskFacts`, each at least 3): `option`, `named`, `unnamed`, `condition` (`maskThenClip(c.text,200)`), `target` (`c.targets.join(', ')` or "the referenced section"), `where` (`whereOf`), `counsel_question`.
6. `explain`: `In {where} the option "{option}" is only partly covered by "{condition}": it names {named} but not {unnamed}, so it is unclear whether {unnamed} investors follow that instruction.`
7. `interpretations`: [`{Unnamed} investors also complete {target}.`, `{Unnamed} investors do not complete {target}; only {named} investors do.`, `The option should be split so each type has its own route.`]. `expected`: `A conditional that names every type in the option, or split options`. `counsel_question`: `Should {unnamed} investors complete {target}?` (for the demo: "Should LLC investors complete Section 3?").
8. `patternKey(OPTION_CONDITION_COVERAGE_ID, 'partial-named')`. Severity `high`, confidence 0.7.

## Touchpoints
- NEW `packages/core/src/detectors/option-condition-coverage.ts`
- EDIT `packages/core/src/detectors/registry.ts`: add one import line and one entry after `investorPathMissingItem`. Append only.
- NEW `packages/core/test/unit/option-condition-coverage.test.ts`: synthetic HTML cases plus the `fixtures/variance/hartwell-crane/fund-I.html` case.

## Public Contracts
None changed. FindingSchema, IssueClass enum, severity enum and the Worker schemas are unchanged. One more detector id appears in `detector_id` values. This is additive.

## Blast Radius
- core: the 3 files above. The tests that iterate the registry (`explanation-present-per-rule`, `review-fix-cycle`, `pattern-key`, `test:corpus`, `test:seeded`) automatically include the new detector.
- web labels: none (the class already exists). Worker: none. Outline snapshot (`packages/core/src/outline`): check whether it embeds findings (E3).
- Finding counts: the 4 hartwell-crane docs gain 1 rule finding each. The 13 SEC corpus docs should gain none (E2).
- Docs at UPDATE PROCESS: `process/context/engine/all-engine.md` ("13 detectors" becomes 14).

## Implementation Checklist
- [x] 1. Write the detector following the Algorithm section, using the `option-gap-overlap.ts` style.
- [x] 2. Append it to the registry.
- [x] 3. Write unit tests for: (a) the demo doc gives exactly 1 finding on "Partnership or LLC" with `unnamed='LLC'` and a question that contains "LLC" and "Section 3"; (b) "Individual" and "IRA" are not flagged; (c) fully named "Trust or Partnership" is not flagged; (d) a conditional 5 blocks away is not flagged; (e) a conditional in another section is not flagged; (f) a non-exclusive group is not flagged; (g) a negative conditional is not flagged; (h) an account number in the option is masked; (i) the output is deterministic over 2 runs.
- [x] 4. Run the gates below and fix drift. Do not weaken existing assertions.

## Verification Evidence
| Tier | Scenario | Command | Proves |
|---|---|---|---|
| Fully-automated | New detector cases | `pnpm --filter @aduin/core test option-condition-coverage` | the rule and its false-positive guards |
| Fully-automated | Explain is total for every rule | `pnpm --filter @aduin/core test explanation-present-per-rule` | at least 3 facts, `expected` is set |
| Fully-automated | Review cycle (mask, long groups, isolation) | `pnpm --filter @aduin/core test review-fix-cycle` | clamps and masking |
| Fully-automated | Goldens, corpus, seeded | `pnpm --filter @aduin/core test:golden`, `test:corpus`, `test:seeded` | no new findings on real samples |
| Fully-automated | Full core suite + typecheck | `pnpm --filter @aduin/core test`; `pnpm typecheck`; `pnpm lint` | no regression |
| Hybrid | Preview e2e (rule-finding counts on hartwell samples) | `pnpm --filter @aduin/web test:e2e` | UI counts still match |
| Known-gap | Web unit | not needed (no label change); run `pnpm --filter @aduin/web test severity-label` as a cheap check | — |

## Resume and Execution Handoff
Start at checklist item 1. Read `option-gap-overlap.ts`, `investor/extract.ts` and `investor/types.ts` first. Do not commit, deploy, stash, checkout or reset.

## Validate Contract
Gate: PASS
generated-by: outer-pvl
date: 2026-10-19
Date: 19-10-26

| Layer 1 dimensions | Status |
|---|---|
| Infra fit | PASS: core only, pure function, no runtime surface |
| Test coverage | PASS: exact tokens from all-tests.md; one token per call; no `--` |
| Breaking changes | PASS: no contract or enum change |
| Security surface | PASS: masking via `maskFacts`/`maskThenClip`; no network |

| Layer 2 sections | Status |
|---|---|
| Detector file | PASS (helpers `isInvestorGroup`, `cleanLabel`, `withoutMarker`, `classifyType`, `typesIn`, `whereOf` exist) |
| Registry append | PASS (append marker present) |
| Tests | PASS (fixture path verified to contain the exact text) |

Totals: 0 FAILs / 0 CONCERNs / 7 PASSes. Net Gate: PASS.

Execute-agent instructions:
- E1: Confirm `Conditional.trigger` holds the "If ..." clause ("the Investor is a trust, corporation or partnership"). If it does not, match against `c.text` up to the first comma, and record this in the report.
- E2: If `test:corpus` or `test:seeded` shows new findings on SEC samples, tighten the rule (do not loosen the tests) and list each finding in the report.
- E3: Grep `packages/core/src/outline` and the core tests for snapshots that include detector ids or finding counts. Update only snapshots that are additive.
- E4: Grep the core, web and worker tests for asserted detector counts (e.g. 13). Update them only if they count the registry.
- E5: If any preview e2e spec changes count, report the spec name and the old and new count before editing.

Test gates (one token per call): `option-condition-coverage`, `explanation-present-per-rule`, `review-fix-cycle`, `pattern-key`; then `test:golden`, `test:corpus`, `test:seeded`, the full core suite, `pnpm typecheck`, `pnpm lint`, `pnpm --filter @aduin/web test:e2e`.
Hard stops: no deploy, no commit, no edits to the taxonomy, contracts or web labels.

## Deviations
- What: added a seeded fixture class `option-condition-coverage` (clean + partial-named) to `scripts/src/fixtures/build-seeded.ts` and generated `fixtures/html-seeded/option-condition-coverage/` via `pnpm --filter @aduin/scripts fixtures:build`.
- Why: `test:seeded` (seeded-defect-matrix AC18) requires a fixture directory for every registered non-Phase-01 detector; without it the gate fails. Loosening the test was not allowed.
- Impact: test data only (no web/worker/contract change); fixture rebuild produced no diff in existing fixtures.

## Next Instruction
Say ENTER EXECUTE MODE to implement this plan with vc-execute-agent (opus).
