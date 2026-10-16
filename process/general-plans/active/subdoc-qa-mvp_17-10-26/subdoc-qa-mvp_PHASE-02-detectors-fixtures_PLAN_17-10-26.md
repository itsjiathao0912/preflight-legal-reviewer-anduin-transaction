---
name: plan:subdoc-qa-mvp-phase-02-detectors-fixtures
description: "Sub-doc QA MVP — Phase 02: remaining deterministic detectors, flags, terms, investor-type paths, pattern_key, seeded and fund I/II fixtures"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-02
---

# Phase 02 — Remaining Detectors, Flags, Investor Paths, Fixtures

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-02-detectors-fixtures_REPORT_17-10-26.md

---

## Overview

Follows the vertical slice (Phase 02 does not block Phase 03). Context router: `process/context/all-context.md`. Completes the deterministic rule set on the Phase 01 engine: broken conditionals, unreachable/circular flow, option gap/overlap, defined-term issues (duplicate, unused, used-before-defined, capitalization), inconsistent footnote/requirement, drafting notes, placeholders, sensitive data (masked), plus **investor-type path extraction** with dead-end and missing-item detectors and the web **investor-path view**. It also writes the per-detector `pattern_key`, the seeded-defect fixtures (one per class), the **fund I / fund II / firm Y fixtures** that power every memory proof (AC44, AC45, AC47, AC59, AC60), and the demo-seed spec. Context routers: `process/context/product-domain.md` (taxonomy), `process/context/tests/all-tests.md`, `samples/sub-docs/README.md`.

## Phase Completion Rules

- CODE DONE = detectors, fixtures, view committed.
- VERIFIED = Exit Gate green, validate-contract written, corpus precision/ceiling report recorded, regression: Phase 01 goldens and Phase 03 e2e green. Severity caps from Phase 01 (label-coherence, sensitive_data) are revisited only with corpus evidence in the report.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC10 | Flags drafting notes (NTD:), placeholders (`[xx]`, `[insert investor name]`), sensitive numbers (ABA/DDA in #1, #7); values masked by default with reveal | `flags-ntd-placeholder-sensitive` (samples #5, #1, #7 + fixtures) + `reveal-sensitive-e2e` (web) | Fully-Automated | reveal control built in P03 |
| AC18 | Seeded-defect coverage: every deterministic class has a fixture and is detected | `seeded-defect-matrix` (one row per class and detector; precision ≥ 90%, recall 100%) | Fully-Automated | re-run at P10 |
| AC61 | Investor-type path view lists sections/questions per type; deterministic | `investor-path-extraction-fixtures` + `investor-path-determinism` + `investor-path-view-e2e` | Fully-Automated | — |
| AC62 | Types with no valid path or missing required items flagged with clause cited | `investor-path-seeded-defects` (dead-end type, missing required item, clean control) | Fully-Automated | — |

Contributes proofs for AC8/AC9 (new rules join the registry loops) and AC7 (finding-schema-contract re-run).

## Entry Gate

- Phase 01 verified (core, contracts). Phase 03 verified for the web parts (investor-path view, reveal e2e); core/fixture steps may start right after Phase 01 and run parallel with Phase 04b.

## Library pins (confirm via vc-docs-seeker in Phase 00)

htmlparser2, zod, fast-check, Vitest; `defined-terms-checker` (MIT) is a reference for rules only, ported with own tests and notice in `THIRD_PARTY_NOTICES.md`. LexNLP, clausebox and other AGPL/no-license sources are never copied.

## Touchpoints (create/modify)

```
packages/core/src/detectors/{broken-conditional.ts,unreachable-flow.ts,option-gap-overlap.ts,defined-term-issues.ts,footnote-requirement.ts,flag-drafting-note.ts,flag-placeholder.ts,flag-sensitive.ts,investor-path-dead-end.ts,investor-path-missing-item.ts}
packages/core/src/investor/{types.ts,extract.ts,paths.ts}            type vocabulary (individual, joint, trust, IRA, entity, ERISA plan, custodial, ...), path model
packages/core/src/memory/patternKey.ts                                implementation (interface from P01)
packages/core/src/detectors/registry.ts                               (append registrations)
packages/core/src/index.ts                                            (append exports)
packages/core/test/{seeded,unit,property,golden}/…
fixtures/html-seeded/<class>/<case>.html + expected.json              one clean control + >=1 defect per class
fixtures/memory/{fund-I.html,fund-II.html,fund-Y.html,fund-expectations.json,fund-I-decisions.json,fund-I-answers.json,demo-seed-spec.json}
scripts/src/fixtures/{build-seeded.ts,find-shared-passages.ts}
apps/web/src/features/investor-paths/**                               view (registered via features/registry.ts)
apps/web/e2e/{investor-path-view,reveal-sensitive}.spec.ts
```

## Public Contracts

- Every detector supplies `id`, `class` (taxonomy code), `severity`, `explain()`, `patternKey()`; registry loops (AC9) enforce it.
- **`pattern_key` spec (proposed default, locked unless the user vetoes):** `<detector_id>[:<shape>]` where `shape` is derived from the normalized evidence with every digit run replaced by `#` and capped at 80 chars, e.g. `ref-label-coherence:part b of section #`, `undefined-term:units->shares`, `flag-placeholder:[insert investor name]`. AI findings use `ai:<task_id>:<class>`. Numbers never appear. Reason `other` never proposes a rule.
- Investor path model: `InvestorPath {type, sections[], questions[], required[], reachesCompletion: boolean, citations[]}`; deterministic order; valid path = the conditional graph from the start node reaches the signature/completion node when the type is selected.
- Severity rules: broken conditional, unreachable flow, investor_path_dead_end = `critical`; option gap/overlap, footnote inconsistency = `high`; defined-term issues = `medium`/`high` by kind; drafting note, placeholder = `medium`; sensitive_data capped `medium`; investor_path_missing_item = `high`.
- Fixture contract: fund-expectations.json states exactly: 3 unchanged previously-handled passages, 2 new defects, 1 passage edited from "Section 4" to "Section 5", and counsel answers for 2 findings; fund-Y has the identical passages under another firm.

## Blast Radius

`packages/core/src/{detectors,investor,memory/patternKey.ts}`, `packages/core/test/**`, `fixtures/{html-seeded,memory}`, `scripts/src/fixtures`, `apps/web/src/features/investor-paths`, two e2e specs. Disjoint from Phase 04b (`apps/worker/**`, `scripts/src/seed`). Barrel/registry edits are append-only seam lines. Registry `## Phase 02`.

## Data Flow

Graph (Phase 01) → detectors → findings with `patternKey`; graph → investor extractor (option groups with investor-type labels, conditionals, "must also complete Part C") → paths → detectors → findings + view model for the web. Fixtures → `fixtures:build` → HTML + expected JSON → seeded-defect matrix.

## Failure Modes

No investor-type option group found → empty path view with "No investor types detected" (not an error); ambiguous conditional → path marked `uncertain` and no dead-end finding (never assert on uncertainty); false-positive flood → corpus ceiling check (< 40 high+critical per doc) fails the gate.

## Implementation Checklist

### Step A — Detectors
- [ ] A1. `broken-conditional`, `unreachable-flow` (reachability + cycle detection over conditional edges), `option-gap-overlap` (exclusivity cue vs structure), with `explain` facts.
- [ ] A2. `defined-term-issues` (used-but-undefined, duplicate, unused, used-before-defined, inconsistent capitalization) with false-positive filters; port rules from defined-terms-checker with own tests.
- [ ] A3. `footnote-requirement` (option group where some options carry a footnote marker and sibling options do not; works on HTML and on OCR JSON line streams for #9 in Phase 06).
- [ ] A4. Flags: `flag-drafting-note` (NTD:, "Drafting note"), `flag-placeholder` (`[xx]`, `[insert …]`, `[●]`; never `____` blanks or `[ ]` checkboxes), `flag-sensitive` (ABA/DDA/routing/account with context cues) using `mask.ts`; `[***]` redaction noted as info only.
- [ ] A5. `patternKey.ts` implementation and per-detector `patternKey()`; unit tests (digits stripped, 80-char cap, stable).

### Step B — Investor paths
- [ ] B1. `investor/extract.ts` + type vocabulary; `paths.ts` path computation; `investor-path-dead-end`, `investor-path-missing-item` detectors.
- [ ] B2. Tests: `investor-path-extraction-fixtures` (per type), `investor-path-determinism` (5 runs equal), `investor-path-seeded-defects` (dead-end, missing item, clean control); run on samples #1, #7, #10 as informational.

### Step C — Seeded and memory fixtures
- [ ] C1. `scripts/src/fixtures/build-seeded.ts` + `fixtures/html-seeded/*` (one clean control and ≥ 1 defect per class and detector); `seeded-defect-matrix` test (precision ≥ 90%, recall 100%).
- [ ] C2. `fixtures/memory/fund-I.html`, `fund-II.html`, `fund-Y.html` + `fund-expectations.json`, `fund-I-decisions.json`, `fund-I-answers.json`.
- [ ] C3. `scripts/src/fixtures/find-shared-passages.ts`: run the engine on #3–#6 with firm `partners-group`, list fingerprints occurring in ≥ 2 documents, rank non-blocking first; choose ≥ 3 for the demo seed; if fewer than 3 non-blocking shared findings exist, author the demo as dismissals on shared non-blocking findings plus counsel-answered swapped-reference findings and record the choice (swapped refs are blocking, so they demonstrate "Already answered" and "Dismissed in [fund], re-confirm", not "Previously handled").
- [ ] C4. `fixtures/memory/demo-seed-spec.json` (`DemoSeedSpec` from Phase 01 contracts): decisions on sample #3, ≥ 3 same-pattern dismissals with the same reason for one pattern (so a rule proposal can be demonstrated, M7), one firm rule.

### Step D — Corpus and web view
- [ ] D1. `pnpm --filter @aduin/core test:corpus`: report per-document counts and top false-positive causes; ceiling < 40 high+critical per doc; record in the phase report; adjust severity caps with evidence.
- [ ] D2. `apps/web/src/features/investor-paths/**` view per approved tokens (mockup step: a quick screen sketch under `design/mockups/investor-paths.html` reusing tokens, self-reviewed with minimalist-ui rules; record in the report), registered via `registry.ts`.
- [ ] D3. `investor-path-view.spec.ts` and `reveal-sensitive.spec.ts` (masked by default in list and document; reveal shows value; hash and snippet never contain the raw value).

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| flags | `pnpm --filter @aduin/core test -- flags-ntd-placeholder-sensitive` | Fully-Automated | AC10 |
| seeded matrix | `pnpm --filter @aduin/core test:seeded` | Fully-Automated | AC18 |
| investor paths | `pnpm --filter @aduin/core test -- investor-path` | Fully-Automated | AC61, AC62 |
| registry loops | `pnpm --filter @aduin/core test -- explanation-present-per-rule determinism-repeat-run` | Fully-Automated | AC9, AC8 re-run |
| schema contract | `pnpm --filter @aduin/core test:property` | Fully-Automated | AC7 re-run over new rules |
| corpus ceiling | `pnpm --filter @aduin/core test:corpus` | Fully-Automated | success metric (false-alarm ceiling) |
| web view | `pnpm --filter @aduin/web test:e2e -- investor-path-view reveal-sensitive` | Fully-Automated | AC61 (view), AC10 (reveal) |
| regression | `pnpm --filter @aduin/core test:golden && pnpm --filter @aduin/web test:e2e -- slice triage-actions && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | Phase 01/03 intact |

Failing stubs for red-first: `should flag NTD drafting note in sample 5`, `should flag [insert investor name] as placeholder but not ____ blanks`, `should mask ABA routing number as #####1234`, `should flag a skip that points to a missing section`, `should flag an investor type with no path to the signature section`, `should list the same investor paths on every run`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `flags-ntd-placeholder-sensitive` | Fully-Automated | AC10 |
| `reveal-sensitive-e2e` | Fully-Automated | AC10 (reveal control) |
| `seeded-defect-matrix` | Fully-Automated | AC18 |
| `investor-path-extraction-fixtures`, `investor-path-determinism`, `investor-path-view-e2e` | Fully-Automated | AC61 |
| `investor-path-seeded-defects` | Fully-Automated | AC62 |

```bash
pnpm --filter @aduin/core test && pnpm --filter @aduin/core test:seeded && pnpm --filter @aduin/core test:corpus && pnpm --filter @aduin/web test:e2e -- investor-path-view reveal-sensitive
# Expected: all exit 0; corpus report lists no document above the ceiling
```

## Exit Gate

- All gates green; seeded matrix precision ≥ 90%, recall 100% for deterministic classes; corpus ceiling met.
- Fund I/II/Y fixtures and `demo-seed-spec.json` committed and described in the report (needed by Phases 04b, 08, 10).
- Phase report written.

## Risks and Kill Criteria

- Investor-type vocabularies vary across samples: start with the vocabulary seen in #1, #7, #10 and seeded fixtures; unknown types are shown as "unclassified option", never flagged as defects.
- Heuristic false positives (label-coherence, footnote inconsistency): if corpus ceiling fails, demote severity to `high`/`medium` and record the cause; do not add suppression lists that hide real goldens (AC11–AC13 must stay green).
- Too few shared non-blocking passages in #3–#6 for the demo seed: fallback in step C3.

## Cost / Secret Hygiene

No network, no LLM. Sensitive values from #1/#7 are masked before hashing and storage; fixtures contain no real credentials; secret scan runs in the regression gate.

## Rollback

`git revert` phase commits; registry appends are removable; fixtures are additive.

## Blockers That Would Justify BLOCKED Status

- Golden tests from Phase 01 regress and cannot be fixed without removing a rule.
- Demo seed cannot be built honestly from #3–#6 and the user must choose a different demo sample.

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

Signals: S3 (many detector directions), S4, S7 (30+ files) → 3/7 MEDIUM. Recommended: parallel subagents for Step A detector groups after the registry seam is fixed (disjoint files per detector), then sequential for fixtures and the view. Sonnet for research/validation, opus for code execution.

## Test Infra Improvement Notes

(none identified yet)

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-02-detectors-fixtures_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next Step: after Milestone 1 (Phases 00, 01, 03, 04a) is verified, spawn vc-research-agent. Runs parallel with Phase 04b (disjoint). Outputs consumed by Phases 04b (seed spec), 05, 07, 08, 09, 10.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
