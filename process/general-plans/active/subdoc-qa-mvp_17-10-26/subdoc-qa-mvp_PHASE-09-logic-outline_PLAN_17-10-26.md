---
name: plan:subdoc-qa-mvp-phase-09-logic-outline
description: "Sub-doc QA MVP — Phase 09 (P1): JSON form logic outline export (sections, branches, references, defined terms, investor-type paths)"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-09
---

# Phase 09 — Form Logic Outline Export (Tier 2, P1)

**Date**: 17-10-26
**Complexity**: SIMPLE-COMPLEX (one feature, ~8 steps)
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-09-logic-outline_REPORT_17-10-26.md

---

## Overview

Exports the document's logic as a JSON "form logic outline": sections, branches (conditionals), references with resolution status, defined terms, and investor-type paths. It is a reference outline only; the tool does not generate the form (SPEC out of scope). It reuses the Phase 01 graph and the Phase 02 investor paths, so the export is a pure projection with a versioned schema. Cut order: this phase is cut after the memory page (Phase 08b) when time is short. Context routers: `process/context/all-context.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`.

UI contract: only an Export button and a small preview in the Structure tab (Phase 03 screen); no new screen, so no new mockup. Use Phase 03 tokens.

## Phase Completion Rules

- CODE DONE = builder, schema, button, tests committed.
- VERIFIED = Exit Gate green, validate-contract written, regression: Phase 01/02 core suites. If cut, the umbrella marks `SKIPPED (P1 cut)` and AC63 DEFERRED with a backlog stub.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC63 [P1] | Analyst exports sections, branches, references, defined terms, investor-type paths as a JSON outline; reference only | `logic-outline-export-contents` (parse the exported JSON against the structure view data and the JSON schema) | Fully-Automated | — |

## Entry Gate

- Phases 02 and 03 verified (investor paths, structure tab).

## Library pins (confirm via vc-docs-seeker in Phase 00)

zod (schema + JSON Schema output), Vitest, Playwright.

## Touchpoints (create)

```
packages/core/src/outline/{build.ts,schema.ts,version.ts,index.ts}
packages/core/src/index.ts                         (append)
packages/core/test/unit/outline/**
fixtures/outline/{schema.v1.json,expected/*.json}
apps/web/src/features/outline/{ExportOutlineButton.tsx,OutlinePreview.tsx}   (registered via registry.ts; mounted in the Structure tab through the registry slot)
apps/web/e2e/logic-outline-export.spec.ts
```

## Public Contracts

- Outline JSON `{schema: "form-logic-outline/v1", document: {name, format, contentHash}, sections: [...], branches: [{id, kind: whitelist|role_routing|skip|negative_gate|entity_extra_part, from, to[], citation}], references: [{id, text, status: resolved|unresolved|suspicious, target?, expected?}], definedTerms: [...], investorPaths: [...]}`; deterministic key order; no document full text, only short citations (≤ 300 chars, masked sensitive values).
- Export is client-side (Blob download); no server call; no AI.
- The outline contains `disclaimer: "Reference outline only; not a generated form."`.

## Blast Radius

`packages/core/src/outline/**`, core tests, `fixtures/outline`, `apps/web/src/features/outline/**`, one e2e spec. Parallel-safe with Phases 05, 06, 07 (disjoint; append-only seams). Registry `## Phase 09`.

## Data Flow

Parsed model + graph + investor paths → `buildOutline()` → zod validate → JSON → download; the structure view reads the same projection for the preview so tests compare like with like.

## Failure Modes

Document without investor types → empty `investorPaths` array (valid); scan documents with low confidence → outline includes a `confidenceNote`; schema validation failure → export blocked with a message (never a partial file).

## Implementation Checklist

### Step A — Schema and builder
- [ ] A1. `outline/schema.ts` zod v1 and emitted `fixtures/outline/schema.v1.json`.
- [ ] A2. `outline/build.ts` projecting graph + paths; deterministic output; masked citations.
- [ ] A3. Unit tests over samples #1, #3, #10 and seeded fixtures: counts of sections/references/terms/paths equal the structure view data.

### Step B — Web
- [ ] B1. `ExportOutlineButton` (downloads `{docName}.logic-outline.json`) and `OutlinePreview`.
- [ ] B2. `logic-outline-export.spec.ts`: export, parse the downloaded file, validate against the schema, compare with the on-screen structure view counts.

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| builder | `pnpm --filter @aduin/core test -- logic-outline-export-contents` | Fully-Automated | AC63 |
| e2e | `pnpm --filter @aduin/web test:e2e -- logic-outline-export` | Fully-Automated | AC63 |
| regression | `pnpm --filter @aduin/core test:golden && pnpm --filter @aduin/web test:e2e -- structure-view && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | Phase 01–03 intact |

Failing stubs for red-first: `should export sections branches references terms and investor paths`, `should match the structure view counts`, `should include the reference-only disclaimer`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `logic-outline-export-contents` (unit + e2e parse) | Fully-Automated | AC63 |

```bash
pnpm --filter @aduin/core test -- logic-outline-export-contents && pnpm --filter @aduin/web test:e2e -- logic-outline-export
# Expected: exit 0
```

## Exit Gate

- Gates green; schema file committed; phase report written.

## Risks and Kill Criteria

- Tier 2: cut if behind schedule (record AC63 DEFERRED, backlog stub).
- Schema churn: versioned `v1`; later changes bump the version.

## Cost / Secret Hygiene

No network, no LLM, no secrets; sensitive values masked in citations; Cloudflare untouched.

## Rollback

`git revert` phase commits; button hides when the feature module is unregistered.

## Blockers That Would Justify BLOCKED Status

- Investor paths (Phase 02) not stable enough to project (finish Phase 02 first).

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

Signals: S4 → 1/7 LOW. Recommended: sequential single agent. Sonnet for research/validation, opus for code execution.

## Test Infra Improvement Notes

(none identified yet)

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-09-logic-outline_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next Step: after Phases 02 and 03 are verified, spawn vc-research-agent (parallel-safe with Phases 05, 06, 07) or record `SKIPPED (P1 cut)`. Next phase: Phase 10 needs this phase done or explicitly skipped.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
