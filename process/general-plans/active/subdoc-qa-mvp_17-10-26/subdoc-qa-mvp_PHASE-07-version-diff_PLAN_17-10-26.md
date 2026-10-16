---
name: plan:subdoc-qa-mvp-phase-07-version-diff
description: "Sub-doc QA MVP — Phase 07: version diff and sibling-document comparison (section alignment, jsdiff, extractors, rename inference, findings delta, common vs differing clauses)"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-07
---

# Phase 07 — Version Diff and Sibling Labeling

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-07-version-diff_REPORT_17-10-26.md

---

## Overview

Compares two related documents with one pipeline for every format (no Docxodus): section alignment (scope path + heading/body similarity), jsdiff for word/sentence changes, extractors (defined terms, fee percentages, must/required lines), rename inference (Units→Shares, Member→Shareholder, Memorandum→Prospectus, placement agent→distributor, Placement Fee→Sales Load), a findings delta (fixed / still present / new), and a **sibling mode** that labels every clause common or differing (supports Anduin's Omnibus single-form practice). Test sets: #5 vs #6 (drift), #3 vs #4 (reorganized), an identical pair ("no differences"), and a seeded sibling pair, because the samples contain no true feeder pair. An AI narrative of the rename drift uses the Phase 05 task framework with recorded responses (hybrid part). Context routers: `process/context/all-context.md`, `process/context/product-domain.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`; golden facts in `subdoc-qa-mvp_RESEARCH_17-10-26.md` section A.

UI contract: the diff screen has no approved mockup. Step A0 produces `design/mockups/diff.html` reusing the Phase 03 tokens and patterns (split layout, tone steps, no borders/shadows), self-reviewed with minimalist-ui and the tells checklist, before building the screen.

## Phase Completion Rules

- CODE DONE = diff engine, view, tests committed.
- VERIFIED = Exit Gate green, validate-contract written, regression: Phase 02 corpus + Phase 03 e2e + Phase 05 AI lane specs green. The narrative test uses recorded responses; if Phase 05 is not yet verified the narrative step is deferred (backlog stub) and AC15 stays CONDITIONAL, never silently passed.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC15 | #5→#6: both swapped refs fixed; Appendix C removed; terminology renames; class fees (3.5% A, 1.5% S); drafting note and placeholders removed; sections 1–12 and Parts A–D unchanged | `golden-05-06-drift` (FA for structure, fees, Appendix C, fixed refs; H for the AI rename narrative on recorded responses) | Fully-Automated + Hybrid | — |
| AC16 | "LLC Agreement" retained 10× in #6 is low confidence, if reported at all | `golden-06-llc-agreement-lowconf` (if present: confidence < 0.5, severity low, label "Possible leftover") | Hybrid | — |
| AC19 | Diff incl. sibling feeder/parallel docs: added/removed/renamed sections, changed definitions/requirements/fees, findings delta; clause labeled common vs differing; #3 vs #4 does not crash; identical pair says "no differences" | `diff-pairs-e2e` (#5/#6, #3/#4, identical pair) + `sibling-clause-common-vs-differing` (seeded sibling pair) | Fully-Automated | — |

## Entry Gate

- Phases 02, 03 verified; Phase 05 verified for the narrative step (deterministic diff may start after Phase 02 and Phase 03).
- Phase 02 fixtures and findings (for the findings delta) available.

## Library pins (confirm via vc-docs-seeker in Phase 00)

jsdiff (`diff`: `diffWords`, `diffSentences`, structured patch names), htmlparser2 (via adapter), zod, Vitest, Playwright, TanStack Table.

## Touchpoints (create)

```
packages/core/src/diff/{align.ts,diff-text.ts,extract-terms.ts,extract-fees.ts,extract-requirements.ts,rename-inference.ts,findings-delta.ts,sibling.ts,types.ts,index.ts}
packages/core/src/llm/tasks/drift-narrative.v1.ts      uses Phase 05 framework (new file; no edit of P05 files)
packages/core/src/index.ts                             (append exports)
packages/core/test/{unit,golden,recorded}/diff/**
fixtures/diff/{sibling-A.html,sibling-B.html,identical-pair/*,expected/*.json}
fixtures/llm-recordings/drift-narrative/*.json
apps/web/src/features/diff/**                          picker for two docs, sections table, definitions, fees, findings delta, sibling labels, empty state (registered via registry.ts)
apps/web/e2e/{diff-pairs,sibling-clauses}.spec.ts
design/mockups/diff.html
```

## Public Contracts

- `DiffResult {mode: 'version'|'sibling', sections: [{status: added|removed|renamed|moved|changed|same, a?, b?, pathA?, pathB?}], definitions: [...], requirements: [...], fees: [...], renames: [{from,to,count,confidence}], findingsDelta: {fixed[], stillPresent[], new[]}, clauses?: [{label: common|differing|only_a|only_b, ...}]}`; deterministic ordering; same input gives identical output.
- Findings delta matches by `detector_id + quote_hash` (firm-independent), so a changed passage is "fixed" or "new", never "still present".
- Rename inference: a term pair is a rename when ≥ 80% of aligned sentences containing the old term contain the new term in the same position (thresholds are proposed defaults, tunable with corpus evidence in the report).
- Residual legacy term: an old-document term that co-occurred with renamed terms and still appears ≥ 3 times in the new document is reported only as `Possible leftover` with confidence ≤ 0.4 and severity `low` (AC16).
- Sibling mode never claims legal equivalence: labels are textual (identical after normalization = common).
- AI narrative is optional and clearly labeled "AI summary"; the deterministic diff never depends on it.
- Diff runs in the browser Web Worker (CPU budget: AC29; alignment must be sub-quadratic on heading sequences; target < 3 s for #2-size docs).

## Blast Radius

`packages/core/src/diff/**`, `packages/core/src/llm/tasks/drift-narrative.v1.ts` (new), core tests, `fixtures/diff`, `fixtures/llm-recordings/drift-narrative`, `apps/web/src/features/diff/**`, two e2e specs, `design/mockups/diff.html`. No Worker changes (narrative goes through the existing `/api/ai`). Parallel-safe with Phases 06 and 09 (disjoint). Registry `## Phase 07`.

## Data Flow

Two parsed models (+ their findings) → `align.ts` (scope path first, then heading/body similarity with a similarity threshold) → per-aligned-pair `diff-text.ts` (jsdiff) → extractors (terms, fees, requirements) → rename inference → findings delta → `DiffResult` → web view. Sibling mode additionally labels clauses common/differing. Narrative: `DiffResult.renames` + sample aligned sentences → `drift-narrative` task (cached; recorded in CI).

## Failure Modes

Restructured docs (#3 vs #4): unmatched sections shown as added/removed, never a crash; empty or single-section documents → "not enough structure to align" message; pair with no changes → "No differences found"; AI narrative unavailable → "AI summary skipped" with reason, deterministic diff unaffected.

## Implementation Checklist

### Step A — Mockup and types
- [ ] A0. `design/mockups/diff.html` sketch with the tokens; record deviations.
- [ ] A1. `diff/types.ts` and the Public Contracts shape; contract test.

### Step B — Engine
- [ ] B1. `align.ts` (scope-path then similarity; complexity bound test on #2 vs itself).
- [ ] B2. `diff-text.ts` using jsdiff word/sentence functions confirmed via vc-docs-seeker.
- [ ] B3. `extract-terms.ts`, `extract-fees.ts` (percent patterns incl. class-specific 3.5% A / 1.5% S), `extract-requirements.ts` (must/required/shall lines).
- [ ] B4. `rename-inference.ts` with the five known renames as goldens plus the residual-term rule.
- [ ] B5. `findings-delta.ts`, `sibling.ts`.

### Step C — Tests
- [ ] C1. `golden-05-06-drift`: both swapped refs fixed; Appendix C removed; renames; fees; drafting note/placeholders removed; section list 1–12 and Parts A–D unchanged.
- [ ] C2. `golden-06-llc-agreement-lowconf`; `diff-pairs` unit variants (#3/#4 no crash, identical pair, empty doc).
- [ ] C3. `sibling-clause-common-vs-differing` on the seeded sibling fixtures; determinism test (5 runs equal).
- [ ] C4. Performance probe: time diff of #2 vs #2 and #5 vs #6; record ms (AC29 input).

### Step D — AI narrative (needs Phase 05)
- [ ] D1. `drift-narrative.v1` task with recorded response for #5→#6; test that the narrative text only states renames present in `DiffResult.renames`.

### Step E — View
- [ ] E1. `features/diff/**` per mockup: two-document picker (loaded docs and samples), sections table, definitions/requirements/fees changes, findings delta, sibling labels, empty state, "AI summary pending/skipped" slot.
- [ ] E2. `diff-pairs.spec.ts` and `sibling-clauses.spec.ts`.

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| drift golden | `pnpm --filter @aduin/core test:golden -- golden-05-06-drift` | Fully-Automated (+ Hybrid narrative) | AC15 |
| low confidence | `pnpm --filter @aduin/core test:golden -- golden-06-llc-agreement-lowconf` | Hybrid | AC16 |
| sibling | `pnpm --filter @aduin/core test -- sibling-clause-common-vs-differing diff-determinism` | Fully-Automated | AC19 |
| e2e | `pnpm --filter @aduin/web test:e2e -- diff-pairs sibling-clauses` | Fully-Automated | AC19 |
| narrative | `pnpm --filter @aduin/core test -- drift-narrative` (recorded) | Hybrid | AC15 (H part) |
| regression | `pnpm --filter @aduin/core test:golden && pnpm --filter @aduin/core test:corpus && pnpm --filter @aduin/web test:e2e -- slice && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | earlier phases |

Failing stubs for red-first: `should report both swapped references as fixed between 5 and 6`, `should report Appendix C removed`, `should infer Units to Shares as a rename`, `should label an unchanged clause common in sibling mode`, `should say no differences for an identical pair`, `should not report LLC Agreement above low confidence`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `golden-05-06-drift` | Fully-Automated + Hybrid | AC15 |
| `golden-06-llc-agreement-lowconf` | Hybrid | AC16 |
| `diff-pairs-e2e`, `sibling-clause-common-vs-differing` | Fully-Automated | AC19 |

```bash
pnpm --filter @aduin/core test:golden && pnpm --filter @aduin/core test && pnpm --filter @aduin/web test:e2e -- diff-pairs sibling-clauses
# Expected: all exit 0
```

## Exit Gate

- All gates green; diff timings recorded; renames and thresholds recorded with corpus evidence.
- Phase report written.

## Risks and Kill Criteria

- Alignment quality on restructured docs (#3/#4): fallback to heading-sequence LCS plus unmatched lists; AC19 only requires no crash and correct added/removed.
- Rename heuristic over-fires: thresholds tuned on #5/#6 only; residual-term rule capped low so AC16 holds.
- No true feeder pair: sibling labeling demonstrated on #3–#6 plus seeded fixtures (documented limitation).

## Cost / Secret Hygiene

Deterministic diff has no network. The narrative task uses recorded responses in CI; any live recording is free-model only under an APPROVED-LIVE cap (≤ 3 requests); no paid calls; PDFs never sent; keys never printed; Cloudflare untouched.

## Rollback

`git revert` phase commits; the Diff tab hides when its feature module is not registered.

## Blockers That Would Justify BLOCKED Status

- #5/#6 golden facts cannot be reproduced deterministically (e.g. alignment fails on real documents) and need user input on acceptable heuristics.
- Phase 05 task framework API changed incompatibly (contract-change note).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S4, S7 (20+ files) → 2/7 MEDIUM. Recommended: sequential single agent (one engine), with the narrative step as a short second pass. Sonnet for research/validation, opus for code execution.

## Test Infra Improvement Notes

(none identified yet)

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-07-version-diff_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next Step: after Phases 02, 03 (and 05 for the narrative) are verified, spawn vc-research-agent. Phase 08 consumes the findings delta only for display, not as a dependency of the gate.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
