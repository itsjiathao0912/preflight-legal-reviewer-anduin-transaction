---
name: plan:subdoc-qa-mvp-phase-08b-memory-ui
description: "Sub-doc QA MVP — Phase 08b (P1): firm memory page, audit filters, firm rules UI, rule proposals and approval, optional workspace JSON export"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-08b
---

# Phase 08b — Memory UI (Tier 2, P1)

**Date**: 17-10-26
**Complexity**: SIMPLE-COMPLEX (one feature area, ~10 steps)
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08b-memory-ui_REPORT_17-10-26.md

---

## Overview

Tier 2 (P1, cut first if late, cut order from DATA-MODEL M12: rule proposal UI (AC54) → firm memory page (AC52) → outline export (Phase 09) → firm rules as AI context stays in Phase 05 → workspace export). The backend already exists (Phase 04b: rules, proposals, revoke, firm memory read, audit; Phase 05: rules injection). This phase adds the screens: per-firm memory page (decisions and rules, filter by issue class, reopen), audit viewer filters, firm rules add/revoke, proposed-rules panel with the evidence decisions and Approve/Reject, and an optional workspace JSON export/import (stretch, not an AC). Context routers: `process/context/all-context.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`.

UI contract: no approved mockup for the memory screens. Step A0 produces `design/mockups/firm-memory.html` reusing Phase 03 tokens/patterns (tone steps, 4px radius, Newsreader/Geist, no shadows), self-reviewed with minimalist-ui and the tells checklist, before building.

## Phase Completion Rules

- CODE DONE = screens and tests committed.
- VERIFIED = Exit Gate green against the real local Worker, validate-contract written, regression: Phase 08 memory e2e specs green. If the program is cut for time, the report records AC52/AC54 as DEFERRED (backlog stub) and the umbrella marks Phase 08b `SKIPPED (P1 cut)`, never VERIFIED.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC52 [P1] | One page per firm lists decisions and rules, filters by issue class, can reopen a decision | `firm-memory-page-e2e` | Fully-Automated | — |
| AC54 [P1] | A proposed rule has no effect until approved (findings and AI context unchanged); approval makes it active and audited; rejected stays inactive | `rule-proposal-needs-approval-e2e` | Fully-Automated | backend (AC53) in P04b |

Closing verification for: AC50 (`memory-reopen-e2e` from the memory page), AC51 (rule added via UI reaches AI context: recorded-LLM check), AC53 (proposal appears in UI after the third same-reason dismissal), AC55 (audit filters).

## Entry Gate

- Phases 04b and 08 verified; Phase 05 verified for the AI-context check.
- Demo seed contains ≥ 3 same-pattern dismissals (Phase 02) so a proposal can be demonstrated.

## Library pins (confirm via vc-docs-seeker in Phase 00)

Zustand, TanStack Table, Radix (Dialog, Tabs), Dexie (export/import only), Playwright.

## Touchpoints (create)

```
apps/web/src/features/memory/{FirmMemoryPage.tsx,DecisionTable.tsx,RulesPanel.tsx,ProposedRules.tsx,AuditFilters.tsx,export-import.ts}
apps/web/src/features/audit/** (modify: add filters; owned by P08)
apps/web/e2e/{firm-memory-page,rule-proposal-needs-approval,memory-reopen,firm-rule-ai-context}.spec.ts
design/mockups/firm-memory.html
```

## Public Contracts

- Uses only existing endpoints (`GET /api/memory/firms/:id`, `GET/POST /api/rules`, `/approve`, `/reject`, `/revoke`, `POST /api/decisions/:id/revoke`, `GET /api/audit`); no Worker changes.
- Reopen requires a reason; revoked decisions stay visible with "revoked" status; nothing is deleted.
- Proposed rule shows its evidence decisions; approve may edit the text only while `proposed`; reject is final for that pattern key.
- Workspace JSON export (stretch): decisions, rules and audit of the visitor's own sandbox only; import is not part of this phase.

## Blast Radius

`apps/web/src/features/memory/**`, `apps/web/src/features/audit/**` (extension), e2e specs, `design/mockups/firm-memory.html`. Nothing else. Registry `## Phase 08b`.

## Data Flow

Memory page → firm id → `GET /api/memory/firms/:id` (decisions, rules, proposals, filter by issue class) → table; reopen → revoke endpoint → page refresh; approve/reject → rules endpoints → audit row → rules list update.

## Failure Modes

Memory unavailable → page shows a clear unavailable state; 409 on already-revoked decision → refresh with current state; no proposals → empty state explaining the threshold (3 same-reason dismissals).

## Implementation Checklist

### Step A — Mockup
- [ ] A0. Sketch `design/mockups/firm-memory.html` (tokens reused); note deviations.

### Step B — Screens
- [ ] B1. `FirmMemoryPage` with firm selector, `DecisionTable` (filter by issue class, reason/who/fund/when, Reopen with reason).
- [ ] B2. `RulesPanel` (add manual rule ≤ 500 chars, revoke) and `ProposedRules` (evidence list, Approve/Reject).
- [ ] B3. Audit filters (action, firm, date).
- [ ] B4. Optional `export-import.ts` JSON export of the visitor's sandbox memory.

### Step C — Tests
- [ ] C1. `firm-memory-page`: list, filter by issue class, reopen → finding reappears as New on the next review.
- [ ] C2. `rule-proposal-needs-approval`: dismiss the pattern 3× with the same reason → proposal appears; before approval findings and AI request context unchanged; after approval rule is active, audited, and next AI request carries it; rejected stays inactive and is not re-proposed.
- [ ] C3. `firm-rule-ai-context` with recorded responses (AC51 closing).

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| memory page | `pnpm --filter @aduin/web test:e2e -- firm-memory-page memory-reopen` | Fully-Automated | AC52, AC50 (closing) |
| proposals | `pnpm --filter @aduin/web test:e2e -- rule-proposal-needs-approval` | Fully-Automated | AC54, AC53 (UI) |
| rule in AI context | `pnpm --filter @aduin/web test:e2e -- firm-rule-ai-context` | Hybrid (recorded responses) | AC51 (closing) |
| regression | `pnpm --filter @aduin/web test:e2e -- memory-no-reflag memory-blocking-never-hidden && pnpm --filter @aduin/worker test && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | Phase 08/04b intact |

Failing stubs for red-first: `should list a firm's decisions filtered by issue class`, `should reopen a decision and show the finding as New`, `should not change AI context before a proposal is approved`, `should keep a rejected proposal inactive and not propose it again`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `firm-memory-page-e2e` | Fully-Automated | AC52 |
| `rule-proposal-needs-approval-e2e` | Fully-Automated | AC54 |
| `memory-reopen-e2e` | Fully-Automated | AC50 (closing) |
| `firm-rule-ai-context` (recorded) | Hybrid | AC51 (closing) |

```bash
pnpm --filter @aduin/web test:e2e -- firm-memory-page rule-proposal-needs-approval memory-reopen firm-rule-ai-context
# Expected: exit 0
```

## Exit Gate

- All gates green; deferred items (if any) recorded as backlog stubs; phase report written.

## Risks and Kill Criteria

- Tier 2: if the program is behind, skip this phase after recording AC52/AC54 as DEFERRED (honest status; AC50/AC53 backend proofs from Phase 04b remain).
- Rule text is prompt context: length caps and delimited block already enforced server-side (Phase 05); UI must not bypass them.

## Cost / Secret Hygiene

No live calls (recorded responses only); no paid models; no secrets in the UI; Cloudflare untouched.

## Rollback

`git revert` phase commits; the memory tab disappears when its feature module is unregistered.

## Blockers That Would Justify BLOCKED Status

- Backend endpoints from Phase 04b do not return fields the UI needs (contract-change note, small follow-up in 04b).

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

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08b-memory-ui_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next Step: after Phases 04b and 08 are verified, spawn vc-research-agent (or record `SKIPPED (P1 cut)` in the umbrella). Next phase: Phase 10.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
