---
name: plan:subdoc-qa-mvp-phase-08b-memory-ui
description: "Sub-doc QA MVP — Phase 08b (P1): #memory screen (Decisions, Rules, Audit trail) from app.html: reopen, firm rules, rule proposals and approval, audit filters; no contract or Worker change"
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

Tier 2 (P1, cut first if late, cut order from DATA-MODEL M12: rule proposal UI (AC54) → firm memory page (AC52) → outline export (Phase 09) → firm rules as AI context stays in Phase 05 → workspace export). The backend already exists (Phase 04b: rules, proposals, revoke, firm memory read, audit; Phase 05: rules injection; Phase 08: real `MemoryApi` client, outbox, session bootstrap, reusable audit list). This phase builds ONLY the `#memory` screen (Decisions | Rules | Audit trail) in `apps/web/src/features/memory/**` on top of that. It adds NO contract surface and NO Worker changes. Workspace JSON export/import is dropped from this phase (not an AC; the `GET /api/export` contract already exists for a later stretch). Context routers: `process/context/all-context.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`, `process/context/worker/all-worker.md`.

UI contract (approved, ALL UI HOLDS RELEASED, umbrella Hold update 2): `design/mockups/app.html` `#v-memory` (render code around lines 2499-2630) + `design/mockups/app_NOTES.md`. Header: title "{Firm} memory" with a meta line, a native segmented control **Decisions | Rules | Audit trail** (`role=tablist`, counts as dim text), and an info popover "What memory keeps". Decisions = single-line rows with Reopen. Rules = one-row "Suggested" strip (opens a Review dialog) plus the Active-rules table with Add rule. Audit = append-only list with an action-group filter. All writes use native `<dialog>` modals that refuse empty reasons. Tokens, fonts, 4px radius, tone steps come from Phase 03 (`apps/web/src/styles`). Conflict rule: app.html/app_NOTES for UI, SPEC wins on any conflict. Step A0 is no longer a mockup task; it is a conformance check (see Checklist) and the `layout-vs-mockup` slicer is extended only if needed. The old plan pins (TanStack Table, Radix Tabs) are dropped: native `<table>` and a native segmented control exactly as the mockup.

Mockup deviations decided here (all recorded in the phase report, none change a contract):

| # | Mockup shows | Built | Why |
|---|---|---|---|
| X1 | Rule Edit action | omitted (no menu item, no disabled stub) | no edit endpoint; approve-time `text` edit exists but is out of scope and risky (the `text` field REPLACES rule text on approve and is reused as the revoke reason) |
| X2 | Reject requires a reason | Reject has no reason field | `RuleActionRequest` has no reason for reject; the audit row carries no reason |
| X3 | Approve has an optional note | no note field | the only body field on approve is `text`, which would overwrite the rule text. NEVER send a note as `text` on approve |
| X4 | Add rule has an optional Why | no Why field | no API field |
| X5 | Rule rows show who and when | who/when joined client-side from audit events (`rule_added`, `rule_approved`) by `entity_id`; blank when the event is not in the loaded pages | `RuleSchema` has only id, text, status, origin, evidence_count |
| X6 | Decisions list includes revoked decisions | see Public Contracts: revoked rows come from audit events | `GET /api/memory/firm` returns only `status = 'active'` decisions (verified in `apps/worker/src/routes/memory/firm.ts`) |
| X7 | Firm name "Hartwell & Crane" | the real selected firm label (demo seed firm is `partners-group`, "Partners Group memory" is already the nav label) | mockup copy is invented |
| X8 | Status label "Revoked" | label "Reopened" | the user-facing verb is Reopen; the audit action stays `decision_revoked` |
| X9 | Expandable detail rows on Decisions | omitted, or built only from the row data already loaded | the firm endpoint returns no extra detail; nothing is fetched per row |
| X10 | "Memory reused N of M" line | omitted | no contract field carries a reuse count |
| X11 | Audit columns Target text, Why, "Entry #NNN" | Target = entity type + short id (no join to loaded decisions/rules: option (a), because the Phase 08 presentational `AuditList` takes no join props and 08b may not modify it); Why = event `reason` or the `reason_code` label from `detail`; both rendered from the event itself; Entry number omitted | audit events carry ids and enums only |

## Phase Completion Rules

- CODE DONE = screens and tests committed.
- VERIFIED = Exit Gate green against the real local Worker, validate-contract written, regression: Phase 08 memory e2e specs green. If the program is cut for time, the report records AC52/AC54 as DEFERRED (backlog stub) and the umbrella marks Phase 08b `SKIPPED (P1 cut)`, never VERIFIED.

## Acceptance Criteria

Numbers verified against `subdoc-qa-mvp_SPEC_17-10-26.md` (AC49-AC55 present as listed; AC49 is Phase 08 `Previously handled`, not owned here; AC55 is [P0] but its viewer proof is Phase 08, 08b closes the filter part only).

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC52 [P1] | One page per firm lists decisions and rules, filters by issue class, can reopen a decision | `firm-memory-page-e2e` = `memory-ui-decisions.spec.ts` (list, status + issue-class filter, Reopen with required reason) | Fully-Automated | — |
| AC54 [P1] | A proposed rule has no effect until approved (findings and AI context unchanged); approval makes it active and audited; rejected stays inactive | `rule-proposal-needs-approval-e2e` = `memory-ui-rules.spec.ts` (UI asserts the proposed rule is Suggested and absent from the Active table until Approve; approval audited; reject stays inactive) + Worker gate `proposed-rule-never-injected` (existing Phase 05 file: a proposed rule is never injected into AI context) | Fully-Automated | backend (AC53) in P04b; the AI-context half is proven by the Worker gate, not by the browser |
| AC50 [P1] closing | Reopen marks the decision revoked (kept, who/when/why audited) and the finding is New on the next review | `memory-reopen-e2e` = two reopen cases in `memory-ui-decisions.spec.ts`: (a) a prior-firm seeded decision labelled `previously_dismissed` shows as New after Reopen, (b) the same-document triage entry whose decisionId equals the revoked id resets to `open` | Fully-Automated | proof in 04b backend; 08b closes the UI path via the additive store action `refreshMemory` in `state/review.ts` |
| AC53 [P1] closing | Proposal appears in the UI with its evidence after the same-reason dismissals | `rule-proposal-threshold-matrix` (04b) + proposal visibility in `memory-ui-rules.spec.ts` | Fully-Automated | — |
| AC51 [P1] closing | An active firm rule reaches the AI as context, never a filter, never another firm | `firm-rule-in-context-recorded-llm` + `firm-rule-isolation` + `proposed-rule-never-injected` (existing Phase 05 Worker gates, one `pnpm --filter @aduin/worker test <token>` call each) and `stack-memory-firm-rules.spec.ts` (Hybrid browser to Worker: a rule added through the UI is listed for firm A only via `/api/rules` and `/api/memory/firm`; firm B sees none; no AI call) | Fully-Automated (Worker gates) + Hybrid (stack-memory) | precondition for the Hybrid spec: local seeded stack-memory Worker. Named residual: a browser-driven AI run echoing `meta.rules_hash8` (gap-resolution D, backlog stub `memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md`, Phase 10 live probe) |
| AC55 [P0] closing | Audit trail viewable with who, when, why; filters by action group | `audit-trail-append-only-e2e` (Phase 08) + client filters in `memory-ui-audit.spec.ts` | Fully-Automated | — |

Umbrella proof names to spec files: `firm-memory-page-e2e` and `memory-reopen-e2e` → `memory-ui-decisions`; `rule-proposal-needs-approval-e2e` → `memory-ui-rules`; AC55 filters → `memory-ui-audit`; `firm-rule-in-context-recorded-llm`, `firm-rule-isolation`, `proposed-rule-never-injected` → existing Worker test files (Phase 05); `stack-memory-firm-rules` → browser to Worker isolation only. Preview spec tokens are named `memory-ui-*` so the Playwright filter regex cannot also match Phase 08 `stack-memory-*` specs.

Known gap (named residual, not a proving strategy): read-only demo workspace behavior beyond disabled buttons is proven in Phase 08 (`demo-workspace-*`); 08b only asserts the disabled-with-tooltip state. Backlog stub if the Phase 08 flag is absent at entry.

## Entry Gate

- Phases 04b and ALL of Phase 08 verified and committed (umbrella D-5 order 08 → 08b → 10). Phase 08 must provide the surface pinned under Public Contracts ("Phase 08 surface 08b depends on"): the `MemoryApi` methods, `AuditList`, session bootstrap (analyst name, cookie never read by JS, read-only demo flag read from the session response field `read_only`, 401 `invalid_session` triggers a re-bootstrap), the outbox (08b does NOT use it for its five writes), and a `stack-memory` Playwright project with its script (project regex `/--project[= ]stack(?![-\w])/`, preview `testIgnore` `stack-memory-.*\.spec\.ts`, both frozen by Phase 08). Names are confirmed at EXECUTE entry by the A0 grep against the Phase 08 report and code. If any is missing: BLOCKED, route a small follow-up to Phase 08, do not re-implement here.
- Phase 05 verified for the AC51 check (`meta.rules_hash8` / `rules_applied` echo, Phase 08 item L5).
- Demo seed verified at PLAN-SUPPLEMENT time (2026-10-17): `fixtures/memory/demo-seed-spec.json` holds 3 same-pattern same-reason dismissals for `partners-group` (`sd01`-`sd03`, pattern `flag-placeholder:insert`, reason `firm_standard_wording`) AND a seeded `proposed` rule `sr01` (pattern `flag-placeholder:insert`); `scripts/src/seed/gen-demo-seed.ts` links the three decisions as `rule_evidence` (evidence_count 3) and writes a `rule_proposed` audit row. So the Rules tab shows one real Suggested row on the demo with no extra seed work. No seed change is required by 08b. Caveat: in the read-only demo the Suggested row is visible but Approve/Reject are disabled; the approve/reject walkthrough therefore runs in a visitor sandbox, which already copies the seed (sd01-sd03 + sr01) per seed-copy.ts, in the e2e specs.
- Seed precondition for the stack-memory spec (G5, per the Phase 08 PVL G4 decision): the committed `apps/worker/seed/demo.sql` header is NOT required to change and 08b does not route `seed:gen` to Phase 08. Phase 08's `scripts/src/dev-seed.ts` builds the stack-memory D1 from the exported `buildDemoSeedSql(spec, PHASE02_SPEC)` over `fixtures/memory/demo-seed-spec.json` into a throwaway persist dir (`seed:check` stays on the committed file). A0 asserts that this stack-memory D1 contains `sd01`-`sd03` and the proposed rule `sr01` for `partners-group` (a setup step calling `GET /api/rules` on the stack-memory Worker, or a dev-seed self-check); missing means BLOCKED, small follow-up for Phase 08. The seeded `rule_proposed` audit row carries only `detail.status` (no `reason_code`), so evidence fallback path (2) applies: the spec holds exactly one 3-member (pattern_key, reason_code) group. Preview specs use the `page.route` fake Worker with its own seeded state. Re-seeding the live remote demo D1 happens in Phase 10.

## Library pins (confirm via vc-docs-seeker in Phase 00)

Zustand, Radix Dialog is NOT used (native `<dialog>` per mockup), Dexie not used by this phase, Playwright, Vitest. No new dependencies. `@tanstack/react-table` stays unused.

## Touchpoints (create / modify)

```
CREATE  apps/web/src/features/memory/MemoryView.tsx            (header, segmented control, hash route #memory, info popover)
CREATE  apps/web/src/features/memory/decisions/{DecisionsTab,DecisionRow,ReopenDialog}.tsx
CREATE  apps/web/src/features/memory/rules/{RulesTab,SuggestedStrip,ReviewRuleDialog,AddRuleDialog,DeactivateRuleDialog}.tsx
CREATE  apps/web/src/features/memory/audit/MemoryAuditTab.tsx   (mounts Phase 08 AuditList + group filter + keyset paging)
CREATE  apps/web/src/features/memory/memory-join.ts             (pure helpers: audit join, evidence cross-match, audit group filter, rule who/when)
CREATE  apps/web/src/features/memory/useMemoryData.ts           (loads firm + rules + audit pages through the Phase 08 client; error/readOnly state)
CREATE  apps/web/test/memory-join.test.ts
CREATE  apps/web/e2e/{memory-ui-decisions,memory-ui-rules,memory-ui-audit,stack-memory-firm-rules}.spec.ts
CREATE  apps/web/e2e/fixtures/memory-stub-rules.ts              (08b-owned fake Worker for the preview specs: stateful page.route('/api/**') handler returning core-zod-validated bodies; exact endpoint set: POST /api/session (with a `read_only` toggle), GET /api/health, GET /api/quota, POST /api/memory/lookup, GET /api/memory/firm, GET /api/rules, POST /api/rules, POST /api/rules/:id/approve, POST /api/rules/:id/reject, POST /api/rules/:id/revoke, POST /api/decisions/:id/revoke, GET /api/audit; paths verified against apps/worker/src/routes/memory/index.ts; every body validated with core zod schemas; 400 unknown_firm on /api/memory/firm is handled like 'Memory unavailable' (E11); plus 400/403/409/429/503 cases)
MODIFY  apps/web/src/features/registry.ts                       (append entry id:'memory'; last entry with an id wins)
MODIFY  apps/web/src/state/review.ts                            (additive store action `refreshMemory: () => Promise<void>`, after Phase 08's S2.1 lands; no other change)
MODIFY  apps/web/e2e/placeholder-routes.spec.ts, apps/web/e2e/app-shell.spec.ts, apps/web/src/smoke.test.tsx   (narrow repairs: memory is no longer a placeholder)
MODIFY  apps/web/test/support/mockupCss.ts + apps/web/e2e/layout-vs-mockup.spec.ts   (only if the slicer cannot reach #v-memory; additive)
MODIFY  apps/web/e2e/a11y-smoke.spec.ts                         (additive: one `#memory` route case, no critical axe violation)
MODIFY  apps/web/playwright.config.ts                           (CONDITIONAL, only if Phase 08 lacks it: stack-memory project testMatch `stack-memory-*.spec.ts` and preview-project testIgnore `stack-memory-.*\.spec\.ts`; Phase 08 owns it)
MODIFY  apps/web/test/import-graph.test.ts                      (CONDITIONAL additive ALLOWED extension, only if a value import from @aduin/core is unavoidable)
READ    apps/web/src/features/audit/AuditList.tsx (Phase 08 owned, NOT modified)
```

## Public Contracts

- 08b adds NO contract surface and NO Worker change. It consumes only the Phase 08 `MemoryApi` methods over existing endpoints: `GET /api/memory/firm` (decisions LIMIT 200, rules, counts), `GET /api/rules?law_firm_id=`, `POST /api/rules`, `POST /api/rules/:id/{approve,reject,revoke}`, `POST /api/decisions/:id/revoke`, `GET /api/audit?limit&cursor`.
- Phase 08 surface 08b depends on (pinned here; A0 greps every item; a missing piece is a BLOCKED follow-up for Phase 08, never a local re-implementation): `MemoryApi.firm(lawFirmId)`, `listRules(lawFirmId)`, `createRule(lawFirmId, text)`, `approveRule(id)`, `rejectRule(id)`, `revokeRule(id, text /* the revoke reason */)`, `revoke(decisionId, reason)` (decision Reopen; the old name `revokeDecision` does NOT exist), `audit(cursor?)` returning `{events, next_cursor}` with page size 100; `MemoryApiError.reason` carrying the Worker reason string; a presentational `AuditList({events, ...})` that does not fetch (08b owns fetching and paging); a named read-only accessor for the session flag (the session response field `read_only`, not the cookie; exact accessor name recorded at A0); a 401 `invalid_session` triggers a re-bootstrap inside the client. Every write carries a fresh `client_op_id` generated inside the client. Phase 08's `downloadBlob` helper is not used by this phase.
- Verified server semantics the UI must honor (`apps/worker/src/routes/memory/{rules,firm,decisions}.ts`, `proposal.ts`, `packages/core/src/contracts/memory.ts`):
  - `GET /api/memory/firm` returns only decisions with `status = 'active'` (newest first, LIMIT 200) and the firm's rules; `GET /api/rules` lists `proposed | active | rejected` (revoked rules are not returned).
  - Reopen = `POST /api/decisions/:id/revoke` with `{client_op_id, reason}` (reason 1-500). The reason is required in the UI. A lost race returns 409 `conflict_active_decision` or 400 `invalid_request` with reason `decision_not_found`; both map to a refetch plus the "Already changed" toast (see Failure Modes).
  - Rule `approve` body `text` REPLACES the rule text; `revoke` body `text` is stored as the revoke reason (default `revoked`). The UI sends `text` only on revoke (Deactivate reason, required in the UI) and NEVER on approve or reject.
  - Active-rule cap is 100 per firm: create or approve beyond it returns 429 `quota_exhausted` with reason `active_rule_cap`.
  - A proposal exists only for a `pattern_key` with at least 3 distinct active same-reason dismissals and reason other than `other`. D-5: a REJECTED (or revoked) key can be proposed again after at least one NEW same-key dismissal decided after the rejection, while the total stays at least 3. The old plan text "reject is final for that pattern key" is WRONG and is replaced by this rule; the empty state and Reject dialog copy must say a rejected suggestion can return only if new matching dismissals arrive.
  - `evidence_count` counts LINKED evidence only (capped at the newest 10 per proposal). Never show it as the number of matching dismissals.
- Client-side derived data (no contract change):
  - Revoked decisions (X6): the Decisions tab status filter is All | Active | Reopened. Active rows come from `GET /api/memory/firm`. Reopened rows are rebuilt from `decision_revoked` audit events of the current firm (`entity_id` = decision id; actor, `at`, `reason`, `detail.decision` kind). They are lean rows ("Reopened by X on date: reason") because the quote and fund are not returned for revoked decisions; a decision reopened in this session keeps its full row from the pre-reopen snapshot until reload. A lean Reopened row takes its issue class from the `decision_recorded` audit event with the same `entity_id` when that event is in the loaded pages; otherwise it shows "—" and is hidden under any specific issue-class filter. Revoked who/when/why are shown from the audit join.
  - Proposal evidence: for a `proposed` rule, show "matching dismissals" = active decisions of the firm with the same `pattern_key` and `reason_code`. The pair is not in `RuleSchema` and the audit `rule_proposed` event carries only `detail.reason_code`, so `memory-join.matchingDismissals(rule, decisions, auditEvents)` resolves it in this order: (1) pattern from the generated text `Findings matching "<pattern_key>" are usually ...` plus reason from the audit `detail.reason_code`; (2) fallback for the seeded rule (`sr01`, free text): the single (pattern_key, reason_code) group of the firm's active dismissals with 3 or more members; (3) otherwise no list, only the line "Proposed from repeated dismissals". The list is labelled "matching dismissals" and is NEVER equated with `evidence_count` (which counts linked evidence, at most 10).
  - Rule who/when: from audit events `rule_added`, `rule_proposed`, `rule_approved` by `entity_id`.
  - Audit groups (client side, over loaded pages): `decision` = `decision_recorded`, `answer_recorded`; `reopen` = `decision_revoked`; `rule` = `rule_added`, `rule_proposed`, `rule_approved`, `rule_rejected`, `rule_revoked`. The tab shows events whose `law_firm_id` equals the selected firm (events without a firm, such as `session_created`, are excluded).
- Info line (Rules tab): "The AI receives at most 20 active rules (4096 bytes) per request; N of M rules applied" (N/M from the Phase 05 `meta.rules_applied` echo when the last AI run is known, else the static limit sentence only).
- Firm source (G7): the firm is the open document's `firmId` (`useReview.doc.firmId`). With no open document or no firm, the memory page shows the empty state "Open a document for a law firm to see its memory." and makes NO `firm()` call; `useMemoryData` reloads when the firm changes; a cold load on the `#memory` hash with no document shows the same empty state.
- Writes (G4): the five 08b writes (Reopen, Add, Approve, Reject, Deactivate) are awaited `MemoryApi` calls with a fresh `client_op_id`, NOT queued in the outbox. A network error keeps the dialog open with "Could not reach memory. Try again". No per-row "unsynced" wording (the global Phase 08 chip only).
- Store addition (G6): `state/review.ts` gains the additive action `refreshMemory: () => Promise<void>` (after Phase 08's S2.1 lands). It refetches memory and also resets any triage entry whose decisionId equals the revoked id to `open`, so a same-document finding is New after Reopen. No other change to that file.
- Nothing is deleted anywhere. All write buttons are disabled with a tooltip when the Phase 08 session says the workspace is the shared read-only demo.

## Blast Radius

`apps/web/src/features/memory/**` (create), `apps/web/src/features/registry.ts` (append one entry), `apps/web/src/state/review.ts` (additive store action `refreshMemory` only; edit scope limited to that action; applied after Phase 08's S2.1), the three narrow repair files (`placeholder-routes.spec.ts`, `app-shell.spec.ts`, `src/smoke.test.tsx`), optional `mockupCss.ts` / `layout-vs-mockup.spec.ts`, new e2e specs and one additive fake-Worker fixture file, one unit test, an additive `#memory` case in `a11y-smoke.spec.ts`, conditional `apps/web/playwright.config.ts` (Phase 08 owned) and conditional additive `import-graph.test.ts` ALLOWED extension. `features/memory/**` and `memory-join.ts` use type-only imports from `@aduin/core`. NOT touched: `packages/**`, `apps/worker/**`, `fixtures/**`, `features/audit/**` (read only), `design/**` (no new mockup). Registry change request below.

## Data Flow

Open `#memory` → the firm is the open document's `firmId` (none: empty state, no calls) → `useMemoryData` calls `firm()` + `listRules()` + first `audit()` page (no argument; fixed page size 100 inside the Phase 08 client), then `audit(cursor)` for Load more → `memory-join` derives rows (Decisions: active + reopened-from-audit; Rules: Suggested strip + Active table with who/when; Audit: group-filtered list) → write actions (Reopen, Add, Approve, Reject, Deactivate) are awaited `MemoryApi` calls with a fresh `client_op_id` (NOT queued in the outbox) → on success the hook refetches the affected resources (firm, rules, newest audit page) and, for Reopen, the additive store action `state/review.ts` `refreshMemory` runs (it also resets any triage entry whose decisionId equals the revoked id to `open`) so the next review labels the finding New (AC50) → audit row appears.

## Failure Modes

| Mode | Behavior |
|---|---|
| 503 `memory_unavailable` / network on load | all three tabs show "Memory unavailable. Findings are shown as New." with Retry; write buttons disabled; no fabricated rows |
| Network error or 429 soft failure on any of the five 08b writes (Reopen, Add, Approve, Reject, Deactivate) | the call is awaited, not outbox-queued; dialog stays open with "Could not reach memory. Try again"; no optimistic row; no per-row "unsynced" state (global Phase 08 chip only); Try again sends a fresh `client_op_id` |
| 429 `quota_exhausted` / `active_rule_cap` on Add or Approve | inline dialog message "This firm already has 100 active rules. Deactivate one first."; dialog stays open, no optimistic row |
| 409 `conflict_active_decision`, or 400 `invalid_request` with reason `rule_state` / `rule_not_found` / `decision_not_found` | refetch, close the dialog, toast "Already changed" |
| 401 `invalid_session` | the Phase 08 client re-bootstraps once and retries; the UI shows nothing special |
| No open document / no firm | empty state "Open a document for a law firm to see its memory."; no `firm()` call |
| Read-only demo (session field `read_only`) or 403 `read_only_demo` | write buttons disabled with tooltip; Suggested row visible, Review opens read-only without Approve/Reject |
| Decisions beyond 200 | note under the table "Showing the newest 200 decisions" when `counts.decisions` > rows shown |
| Audit pagination | "N of M entries, newest first" (N filtered, M loaded); "Load more" while `next_cursor` exists; filters apply only to loaded pages and the note says so |
| No proposals | empty state: "No suggested rules. A rule is suggested after 3 or more dismissals of the same pattern with the same reason (not Other)." |

## Implementation Checklist

Execution order: A → B → C → D → E (tabs B2-B4 may be disjoint parallel subagents after B1; they share only `memory-join.ts` and `useMemoryData.ts`, written first in B1).

### Step A — Entry and mockup conformance
- [ ] A0. Conformance check instead of a new mockup: read `design/mockups/app.html` `#v-memory` + `app_NOTES.md`; list in the report each mockup element built and each deviation X1-X11. Confirm every Phase 08 item pinned in Public Contracts by `grep` in `apps/web/src/api`, `apps/web/src/features/audit`, `apps/web/src/state/review.ts`, `apps/web/playwright.config.ts` (client method names and signatures, `MemoryApiError.reason`, presentational `AuditList` props, read-only accessor, `client.ts` re-evaluating the API base after `__aduinE2E.setApiBase`, stack-memory project regex, `testMatch`, preview `testIgnore`); record the exact stack-memory command in the report. Assert the stack-memory D1 (Phase 08 dev-seed output) holds `sd01`-`sd03` and the proposed rule `sr01` for `partners-group` (see Entry Gate seed bullet); do NOT require a change to the committed `demo.sql` header. Missing → BLOCKED follow-up for Phase 08, not reimplementation.
- [ ] A1. Red-first stubs: create the four failing tests named below (unit + three preview specs) before any component.

### Step B — Screens (all under `apps/web/src/features/memory/`)
- [ ] B1. `memory-join.ts` (pure, unit tested): `joinRevoked(decisions, auditEvents)`, `matchingDismissals(rule, decisions, auditEvents)`, `ruleWhoWhen(rule, auditEvents)`, `auditGroup(event)`, `filterAudit(events, group, firmId)`. `useMemoryData.ts`: load `firm()`, `listRules()`, first `audit()` page (no argument; fixed page size 100 inside the Phase 08 client), then `audit(cursor)` for Load more; expose `loadMoreAudit`, `refetch`, `status: ok | unavailable | readOnly | noFirm`; the firm is `useReview.doc.firmId`, `noFirm` makes no `firm()` call and shows the empty state, data reloads on firm change, a cold `#memory` hash load is handled. Type-only imports from `@aduin/core` in `features/memory/**` and `memory-join.ts`. `MemoryView.tsx`: header, native segmented control (arrow-key navigation, `aria-selected`), info popover "What memory keeps", meta line `{n} decisions ({a} active) · {r} rules · {p} suggested`. Register in `features/registry.ts` (`id:'memory'`, appended).
- [ ] B2. Decisions tab: single-line rows (issue class, quote snippet, reason, who, fund, when, status), filters status (All | Active | Reopened) and issue class, truncation note at 200, Reopen action opens `ReopenDialog` (native `<dialog>`, reason required 1-500, refuses empty with inline error, Reopen is an awaited `revoke(decisionId, reason)` call, not outbox-queued; success calls the additive store action `state/review.ts` `refreshMemory`, which also resets a triage entry with the revoked decisionId to `open`). Status label is "Reopened" (X8). Reopened rows from `joinRevoked` as lean rows (issue class from the same-entity `decision_recorded` event when loaded, else "—", hidden under a specific class filter). Disabled Reopen + tooltip in read-only demo.
- [ ] B3. Rules tab: Suggested strip (one row per `proposed` rule, opens `ReviewRuleDialog` showing the rule text, "No effect until approved", the "matching dismissals" list from `matchingDismissals`, Approve and Reject buttons with NO reason/note field, copy "A rejected suggestion can return only if new matching dismissals arrive"); Active rules table (text, who, when from `ruleWhoWhen`, Deactivate opens `DeactivateRuleDialog` with required reason sent as revoke `text`); Add rule (`AddRuleDialog`, rule text 1-500, refuses empty); rejected rules listed muted under a "Rejected" caption (no actions); no Edit action; cap message on 429 `active_rule_cap`; AI info line (20 rules / 4096 bytes, "N of M applied" from Phase 05 echo when known). All writes (Add, Approve, Reject, Deactivate) are awaited `MemoryApi` calls with a fresh `client_op_id`, not outbox-queued; refetch after; network error keeps the dialog open with "Could not reach memory. Try again"; 400/409 lost races refetch with an "Already changed" toast.
- [ ] B4. Audit tab: `MemoryAuditTab` fetches and pages itself and passes `filterAudit` output to the presentational Phase 08 `AuditList({events, ...})` (Target = entity type + short id, no Target join; Why = event `reason` or `reason_code` label, Entry number omitted: X11); group control All actions | Decisions | Reopened decisions | Rules; "N of M entries, newest first" with "Load more" while `next_cursor`; note that filters apply to loaded entries.
- [ ] B5. Narrow repairs: `placeholder-routes.spec.ts` (drop memory from the placeholder list, add a "Memory is a real view" case like Structure), `app-shell.spec.ts`, `src/smoke.test.tsx`; extend `mockupCss.ts` slicer and `layout-vs-mockup.spec.ts` only if `#v-memory` is not covered; the layout-vs-mockup gate applies only if the slicer is extended. Add the additive `#memory` case to `a11y-smoke.spec.ts`.
- [ ] B6. Test-infra pins (G9): preview specs use the fake Worker in `e2e/fixtures/memory-stub-rules.ts` (a stateful `page.route('/api/**')` handler returning core-zod-validated bodies, installed with `__aduinE2E.setApiBase('/')` before the app opens, which requires Phase 08's `client.ts` to re-evaluate the base when it changes); stack-memory `testMatch` / preview `testIgnore` are Phase 08-owned (touch `playwright.config.ts` only if absent); type-only `@aduin/core` imports, else extend the `import-graph` ALLOWED set additively and record it.

### Step C — Tests (red first, then green per section)
- [ ] C1. Unit `apps/web/test/memory-join.test.ts`: audit join (revoked who/when/why), evidence cross-match (text-regex path, seeded-rule fallback path, unresolved path, never equals `evidence_count`), audit group mapping, firm filter, rule who/when, lean Reopened row issue class joined from the same-entity `decision_recorded` event (else "—").
- [ ] C2. Preview `memory-ui-decisions.spec.ts` (AC52, AC50; AC50 case (b) seeds the Dexie triage row directly through the existing e2e/state seam, with no UI dismiss, so no runs/findings/decisions-create endpoints are needed in the fake Worker): list, status + issue-class filter, Reopen refuses empty reason, Reopen writes an audit row, row moves to Reopened, AC50 case (a): a prior-firm seeded decision labelled `previously_dismissed` shows as New after Reopen; AC50 case (b): the same-document triage entry with the revoked decisionId resets to `open`; an "already changed" case (409 or 400 `decision_not_found` → refetch, dialog closed, toast "Already changed"); no-firm empty state with no `firm()` call; 200-row note, 503 unavailable state, read-only disabled tooltip.
- [ ] C3. Preview `memory-ui-rules.spec.ts` (AC53 UI, AC54, G13 body mapping: the fake Worker records request bodies and the spec asserts approve and reject carry only `client_op_id`, revoke carries `text`, create carries `text` with `law_firm_id` as query param, Reopen (in `memory-ui-decisions`) carries `{client_op_id, reason}`; failing stub `should send no text on approve or reject`): Suggested row with matching dismissals; before Approve the proposed rule appears only in the Suggested strip and never in the Active table (the AI-context half is proven by the Worker gate `proposed-rule-never-injected`); a 400 `rule_state` race shows "Already changed"; Approve makes it Active and appends a `rule_approved` audit row; Reject leaves it inactive (Rejected caption) and no re-proposal appears without a new dismissal; Add rule and Deactivate with reason; `active_rule_cap` 429 message; no Edit control present.
- [ ] C4. Preview `memory-ui-audit.spec.ts` (AC55 filters): groups filter the loaded list, "N of M entries, newest first", Load more appends the next page, firm filter excludes `session_created`.
- [ ] C5. Stack `stack-memory-firm-rules.spec.ts` (AC51 browser to Worker, Hybrid): in the stack-memory project against the local seeded Worker, add a rule for firm A through the UI; assert it is listed for firm A only through `/api/rules` and `/api/memory/firm`; firm B sees none; NO AI call. AC51 AI-context proof = existing Worker gates `pnpm --filter @aduin/worker test firm-rule-in-context-recorded-llm`, `pnpm --filter @aduin/worker test firm-rule-isolation`, `pnpm --filter @aduin/worker test proposed-rule-never-injected` (one per call). Named residual (gap-resolution D): a browser-driven AI run echoing `meta.rules_hash8`; backlog stub `memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md` (written at D1), Phase 10 live probe.
- [ ] C6. Regression: whole web unit and preview e2e, `import-graph`, `a11y-smoke` (memory route included), `layout-vs-mockup`, Phase 08 memory specs, Worker tests, `pnpm guard:cf`, `pnpm secrets:scan`.

### Step D — Report and registry
- [ ] D1. Write the phase report (deviations X1-X11, the stack-memory D1 seed assertion result, recorded stack-memory command, the `memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md` backlog stub, any other deferred item as a backlog stub).

## Test Gates (commands created in this phase; no `--`, one token per call)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| join helpers | `pnpm --filter @aduin/web test memory-join` | Fully-Automated | AC52/AC54 support (derived data) |
| decisions | `pnpm --filter @aduin/web test:e2e memory-ui-decisions` | Fully-Automated | AC52, AC50 (closing) |
| rules | `pnpm --filter @aduin/web test:e2e memory-ui-rules` | Fully-Automated | AC54, AC53 (UI) |
| audit | `pnpm --filter @aduin/web test:e2e memory-ui-audit` | Fully-Automated | AC55 (filters, closing) |
| stack memory (browser to Worker) | Phase 08 stack-memory project command (exact script recorded at A0; invoked once per spec token `stack-memory-firm-rules`) | Hybrid (local seeded Worker, no AI call) | AC51 (isolation through the UI) |
| AI context (Worker) | `pnpm --filter @aduin/worker test firm-rule-in-context-recorded-llm` | Fully-Automated | AC51 |
| firm isolation (Worker) | `pnpm --filter @aduin/worker test firm-rule-isolation` | Fully-Automated | AC51 |
| proposed never injected (Worker) | `pnpm --filter @aduin/worker test proposed-rule-never-injected` | Fully-Automated | AC54 |
| regression web | `pnpm --filter @aduin/web test` then `pnpm --filter @aduin/web test:e2e` then `pnpm --filter @aduin/web test:a11y` | Fully-Automated | Phases 03/08 intact, a11y, layout-vs-mockup |
| regression repo | `pnpm --filter @aduin/worker test` then `pnpm guard:cf` then `pnpm secrets:scan` | Fully-Automated | Phase 04b intact, Cloudflare rules |

Each command is run as its own call (no `&&` chain required by the gate; the one-token rule applies to spec filters).

Failing stubs for red-first: `should list a firm's decisions filtered by issue class`, `should reopen a decision and show the finding as New`, `should not change AI context before a proposal is approved`, `should keep a rejected proposal inactive until new matching dismissals arrive`, `should resolve matching dismissals without equating them to evidence_count`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `memory-ui-decisions` = `firm-memory-page-e2e` | Fully-Automated | AC52 |
| `memory-ui-decisions` reopen case = `memory-reopen-e2e` | Fully-Automated | AC50 (closing) |
| `memory-ui-rules` = `rule-proposal-needs-approval-e2e` | Fully-Automated | AC54, AC53 (UI) |
| `memory-ui-audit` client filters | Fully-Automated | AC55 (closing, filters) |
| `stack-memory-firm-rules` (browser to Worker, firm A only, no AI call) | Hybrid | AC51 (closing, isolation) |
| `firm-rule-in-context-recorded-llm`, `firm-rule-isolation` (existing Worker files) | Fully-Automated | AC51 (closing, AI context) |
| `proposed-rule-never-injected` (existing Worker file) + UI Suggested-not-Active assertion in `memory-ui-rules` | Fully-Automated | AC54 |
| `a11y-smoke` memory case | Fully-Automated | AC52 (support, a11y) |
| `memory-join` unit | Fully-Automated | AC52, AC54 (support) |

```bash
pnpm --filter @aduin/web test memory-join
pnpm --filter @aduin/web test:e2e memory-ui-decisions
pnpm --filter @aduin/web test:e2e memory-ui-rules
pnpm --filter @aduin/web test:e2e memory-ui-audit
pnpm --filter @aduin/worker test firm-rule-in-context-recorded-llm
pnpm --filter @aduin/worker test firm-rule-isolation
pnpm --filter @aduin/worker test proposed-rule-never-injected
# Expected: each exit 0; the stack-memory spec exit 0 per the Phase 08 command
```

## Exit Gate

- All gates green; no read-only-demo write ever sent; deferred items (if any) recorded as backlog stubs; deviations X1-X11 recorded; phase report written.

## Risks and Kill Criteria

- Tier 2: if the program is behind, skip this phase after recording AC52/AC54 as DEFERRED (honest status; AC50/AC53 backend proofs from Phase 04b remain).
- Rule text is prompt context: length caps and delimited block already enforced server-side (Phase 05); UI enforces 1-500 characters only as a convenience and must never bypass them.
- Approve body `text` replaces rule text and revoke `text` is the reason: a wrong field mapping silently corrupts rules. Mitigation: dedicated client calls per action; the owning test is `memory-ui-rules` (the fake Worker records request bodies; approve and reject send no `text`), not `memory-join`.
- Revoked decisions are not returned by the firm endpoint (X6): the Reopened filter depends on loaded audit pages; if the audit has more than 100 entries for the firm older reopenings are missing until "Load more". Accepted and noted in the UI line.
- Phase 08 name drift (client methods, `AuditList`, stack-memory script): mitigated by A0 grep; mismatch is BLOCKED, not a local re-implementation.
- Risk Predictions (vc-predict, inline, SIMPLE-COMPLEX): top failure is contract misuse on approve/revoke (above); second is flaky stack-memory proof (Hybrid, runs local Worker; retry once, record); third is scope creep into rule edit or export (explicitly omitted).

## Cost / Secret Hygiene

No live calls (recorded responses only); no paid models; no secrets in the UI; Cloudflare untouched.

## Rollback

`git revert` phase commits; the memory tab disappears when its feature module is unregistered.

## Blockers That Would Justify BLOCKED Status

- Backend endpoints from Phase 04b do not return fields the UI needs (contract-change note, small follow-up in 04b).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [x] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [x] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [x] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [x] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S4 → 1/7 LOW (one feature area, serial after Phase 08). Recommended: one opus implementer (EXECUTE) after Phase 08 commits; the three tabs (B2 Decisions, B3 Rules, B4 Audit) MAY run as disjoint parallel subagents after B1 lands `memory-join.ts` and `useMemoryData.ts` (blast radii are separate directories; no shared edits). One sonnet reviewer after EXECUTE; EVL confirmation by a spawned vc-tester (sonnet). Research, validation, review all sonnet; only the implementing agent is opus.

## Test Infra Improvement Notes

(none identified yet)

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08b-memory-ui_PLAN_17-10-26.md`
- Last completed step: 4 PVL supplement cycle 1 applied (2026-10-17, 9 gaps); steps 1-3 recorded earlier
- Validate-contract status: written 2026-10-17, Gate: PASS
- Validator expectations: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08b-memory-ui_PLAN_17-10-26.md`
- Next Step: re-validate from V1 (vc-validate-agent) citing `design/mockups/app.html` `#v-memory`; EXECUTE only after Phases 04b and 08 are verified and committed (A0 grep confirms Phase 08 names). Next phase after 08b: Phase 10.

## Inner Loop Refresh Note

Date: 2026-10-17. Mode: inner-loop plan refresh (Step 3). Sections changed: Overview, Acceptance Criteria, Entry Gate, Library pins, Touchpoints, Public Contracts, Blast Radius, Data Flow, Failure Modes, Implementation Checklist, Test Gates, Verification Evidence, Exit Gate, Risks and Kill Criteria, Execution Strategy, Phase Loop Progress, Resume and Execution Handoff.

What changed and why:
- UI contract switched from a new `firm-memory.html` mockup to the approved `app.html` `#v-memory` + `app_NOTES.md`; TanStack Table and Radix Tabs pins dropped (native table and segmented control).
- Dependency widened to all of Phase 08 (client methods, outbox, session, `AuditList`, `stack-memory` project); 08b adds no contract surface and no Worker change.
- Corrected wrong plan text: "reject is final for that pattern key" → D-5 re-proposal after at least one new same-key dismissal. Proposal needs `pattern_key` and a reason other than `other`; evidence shown as "matching dismissals" by client cross-match, never as `evidence_count` (linked evidence, at most 10).
- Found: `GET /api/memory/firm` returns only active decisions, so revoked/Reopened rows come from `decision_revoked` audit events (X6). Rule who/when come from audit (X5). Reject, approve, add have no reason/note fields (X2-X4) and Edit is omitted (X1); approve `text` would overwrite rule text, so it is never sent.
- Added 100-active-rule cap message (`quota_exhausted` / `active_rule_cap`), AI info line (20 rules / 4096 bytes), 200-row truncation note, audit paging ("N of M entries, newest first").
- Entry-gate claim verified: demo seed holds 3 same-pattern same-reason dismissals (`sd01`-`sd03`) plus a seeded proposed rule `sr01` with linked evidence; no seed change needed. Approve/Reject on the read-only demo are disabled, so those specs run in a sandbox.
- Tests re-cut: unit `memory-join`; preview `memory-ui-decisions`, `memory-ui-rules`, `memory-ui-audit`; stack-memory `stack-memory-firm-rules` (AC51 via `meta.rules_hash8` / `rules_applied`, I1 isolation). All gates use no `--` and one spec token per call. Umbrella proof names mapped in Acceptance Criteria.
- Workspace JSON export/import dropped from this phase (stretch, not an AC).

### Registry update request (Phase 08b)

Requested replacement for the `## Phase 08b` entry in `phase-blast-radius-registry.md` (orchestrator or update-process applies; this agent edits only this plan):

```
## Phase 08b
Owns: `apps/web/src/features/memory/**`, `apps/web/e2e/{memory-ui-decisions,memory-ui-rules,memory-ui-audit,stack-memory-firm-rules}.spec.ts`, `apps/web/e2e/fixtures/memory-stub-rules.ts`, `apps/web/test/memory-join.test.ts`.
Revision 2026-10-17 (PLAN-SUPPLEMENT): reads (does not modify) `apps/web/src/features/audit/**`, `apps/web/src/api/**` (Phase 08). Appends one entry id:'memory' to `apps/web/src/features/registry.ts`; adds one hook call in `apps/web/src/state/review.ts` (refreshMemory after reopen); narrow repair edits to `apps/web/e2e/{placeholder-routes,app-shell}.spec.ts` and `apps/web/src/smoke.test.tsx`; additive `apps/web/test/support/mockupCss.ts` / `apps/web/e2e/layout-vs-mockup.spec.ts` only if the slicer cannot reach #v-memory. Drops `design/mockups/firm-memory.html` (UI contract is design/mockups/app.html #v-memory). No Worker, core or fixtures changes.
```

### Cross-phase requests to Phase 08

Requests only; this agent edits no Phase 08 file. Phase 08 PVL G4 override (2026-10-17) already settled the seed and regex items, recorded as consumed pins.

- R1: Phase 08 pins, in its plan and report, the signatures listed under Public Contracts: `firm(lawFirmId)`, `listRules(lawFirmId)`, `createRule(lawFirmId, text)`, `approveRule(id)`, `rejectRule(id)`, `revokeRule(id, text /* reason */)`, `revoke(decisionId, reason)`, `audit(cursor?)` → `{events, next_cursor}` (page size 100), `MemoryApiError.reason`, a presentational `AuditList({events, ...})` that does not fetch, a named read-only accessor, and `client.ts` re-evaluating the API base when `__aduinE2E.setApiBase` changes. Missing items become Phase 08 follow-ups, never 08b reimplementation.
- R2: Phase 08 owns the stack-memory project `testMatch` (`stack-memory-*.spec.ts`) and the preview-project `testIgnore` (`stack-memory-.*\.spec\.ts`, frozen by Phase 08). 08b touches `apps/web/playwright.config.ts` only if absent.
- R3: the `wantsStack` regex must not also match `stack-memory`. CONSUMED: Phase 08 freezes `/--project[= ]stack(?![-\w])/`; 08b only verifies it at A0 and uses its exact stack-memory script.
- R4: seed ownership. CONSUMED (orchestrator override): Phase 08's `scripts/src/dev-seed.ts` builds the stack-memory D1 from `buildDemoSeedSql(spec, PHASE02_SPEC)` over `fixtures/memory/demo-seed-spec.json` into a throwaway persist dir; `seed:check` stays on the committed `demo.sql`. 08b asserts the dev-seed output holds `sd01`-`sd03` + `sr01` (A0) and does NOT require a `demo.sql` header change. Live remote demo D1 re-seed: Phase 10.

### R5 Registry update request (Phase 08b, supersedes the earlier request; orchestrator or update-process applies)

```
## Phase 08b
Owns: `apps/web/src/features/memory/**`, `apps/web/e2e/{memory-ui-decisions,memory-ui-rules,memory-ui-audit,stack-memory-firm-rules}.spec.ts`, `apps/web/e2e/fixtures/memory-stub-rules.ts`, `apps/web/test/memory-join.test.ts`.
Revision 2026-10-17 (PVL supplement cycle 1): reads (does not modify) `apps/web/src/features/audit/**` and `apps/web/src/api/**` (Phase 08). Appends one entry id:'memory' to `apps/web/src/features/registry.ts`; adds the additive store action `refreshMemory` to `apps/web/src/state/review.ts` (after Phase 08 S2.1; edit scope limited to that action); narrow repair edits to `apps/web/e2e/{placeholder-routes,app-shell}.spec.ts` and `apps/web/src/smoke.test.tsx`; additive `#memory` case in `apps/web/e2e/a11y-smoke.spec.ts`; additive `apps/web/test/support/mockupCss.ts` / `apps/web/e2e/layout-vs-mockup.spec.ts` only if the slicer cannot reach #v-memory; CONDITIONAL `apps/web/playwright.config.ts` (stack-memory testMatch / preview testIgnore, only if Phase 08 lacks them) and CONDITIONAL additive `apps/web/test/import-graph.test.ts` ALLOWED extension. Preview e2e tokens are `memory-ui-*` to avoid regex collisions with Phase 08 `stack-memory-*` specs. No Worker, core or fixtures changes.
```

### PVL supplement cycle 1 (2026-10-17)

Mode: PVL-supplement (narrow scope). First-pass CONDITIONAL, 0 FAIL, 9 CONCERN. `## Validate Contract` was not edited (it still shows the old spec tokens and the old G5 seed wording; re-validate rewrites it). Orchestrator override from the Phase 08 PVL G4 applied to G5 (no `demo.sql` header requirement, no `seed:gen` routed to Phase 08).

| Gap | Applied |
|---|---|
| G1 | AI-context proof = existing Worker gates `firm-rule-in-context-recorded-llm`, `firm-rule-isolation`, `proposed-rule-never-injected` (one call each, new Test Gates rows); C5 `stack-memory-firm-rules` narrowed to a Hybrid browser to Worker spec (firm A only, firm B none, no AI call); named residual "browser-driven AI run echoes `meta.rules_hash8`" (gap-resolution D, backlog stub `memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md`, Phase 10 live probe); AC54 row reworded (UI asserts Suggested, not in Active table) |
| G2 | `revokeDecision` replaced by `revoke(decisionId, reason)`; Phase 08 methods pinned in Public Contracts; A0 greps all; missing is BLOCKED follow-up for 08 |
| G3 | 400 `invalid_request` (`rule_state` / `rule_not_found` / `decision_not_found`) and 409 `conflict_active_decision` both refetch plus "Already changed" toast, dialog closed; 403 `read_only_demo` disables writes; preview "already changed" case added to C2 and C3 |
| G4 | the five 08b writes are awaited calls with a fresh `client_op_id`, not outbox-queued; network error keeps the dialog open; per-row "unsynced" dropped |
| G5 | seed precondition recast per the override: A0 asserts the stack-memory D1 (Phase 08 dev-seed output) holds `sd01`-`sd03` + `sr01`; seeded `rule_proposed` row has only `detail.status` so fallback path (2) applies; live remote D1 re-seed in Phase 10 |
| G6 | additive store action `refreshMemory: () => Promise<void>` in `state/review.ts`, also resetting a triage entry with the revoked decisionId to `open`; AC50 e2e has two cases; edit scope recorded in Blast Radius |
| G7 | firm = open document's `firmId`; no-firm empty state and no `firm()` call; reload on firm change; cold `#memory` load handled |
| G8 | deviations X8-X11 added; lean Reopened rows take issue class from the `decision_recorded` event, else "—" and hidden under a specific class filter; one memory-join unit case |
| G9 | conditional `playwright.config.ts` touchpoint; fake-Worker mechanism pinned (B6); type-only core imports; additive a11y-smoke memory case; layout gate only if the slicer is extended; preview tokens renamed `memory-ui-decisions` / `memory-ui-rules` / `memory-ui-audit` everywhere before the contract |

Also reflected from the override: Phase 08 freezes the stack-memory project regex `/--project[= ]stack(?![-\w])/` and preview `testIgnore` `stack-memory-.*\.spec\.ts`; 401 `invalid_session` triggers a re-bootstrap; read-only comes from the session response field `read_only`, not the cookie; `downloadBlob` is not used by this phase.

### PVL supplement cycle 2 (2026-10-17)

Mode: PVL-supplement (narrow scope). Cycle-1 re-validate CONDITIONAL, 0 FAIL, 4 CONCERN (G10-G13). `## Validate Contract` was not edited (its E4 and `audit({limit:100})` wording is stale and is rewritten by re-validate); Phase 08 plan untouched.

| Gap | Applied |
|---|---|
| G10 | Data Flow and B1 now use `audit()` for the first page and `audit(cursor)` for Load more (fixed page size 100) |
| G11 | option (a) chosen: no Target join; X11 = Target shows entity type + short id; Why = event `reason` or `reason_code` label from detail, both rendered from the event through the unmodified Phase 08 `AuditList`. Deviation recorded in X11 and B4 |
| G12 | exact preview fake-Worker endpoint set listed in `memory-stub-rules.ts` (paths verified against `apps/worker/src/routes/memory/index.ts`); AC50 case (b) seeds the Dexie triage row directly via the existing e2e/state seam (no runs/findings/decisions endpoints); 400 `unknown_firm` on `/api/memory/firm` handled as "Memory unavailable" (E11) |
| G13 | `memory-ui-rules` records fake-Worker request bodies and asserts the field mapping; failing stub `should send no text on approve or reject`; Risks owning test fixed to `memory-ui-rules` |
| E4 | Entry Gate wording: a fresh sandbox already copies the seed (sd01-sd03 + sr01) per seed-copy.ts. The same wording in Execute-agent instruction E4 sits inside `## Validate Contract` and is left for re-validate |

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: inner-pvl: phase-08b
supersedes: 2026-10-17 (inner-pvl: phase-08b, cycle-1 re-validate contract, CONDITIONAL, gaps G10-G13) — inner PVL cycle 3 (re-validate after PVL supplement cycle 2) has current evidence

Parallel strategy: sequential (one opus execute agent after Phase 08 is committed; the three tab sections B2/B3/B4 MAY be disjoint parallel opus subagents after B1 lands `memory-join.ts` and `useMemoryData.ts`; sonnet for review and for the EVL tester).
Rationale: 1/7 signals (S2, memory/rules write surface only as UI over existing endpoints); dominant signal: one feature directory serial after Phase 08; shared seam files (`features/registry.ts`, `state/review.ts`, `placeholder-routes.spec.ts`, `app-shell.spec.ts`, `smoke.test.tsx`, `import-graph.test.ts`) are also edited by Phase 08, so they serialize after 08. Layer 1 and Layer 2 checks were run as read-only inspections of the real code in this pass (no spawned dimension agents were available to this subagent); each finding cites its source file. Models: sonnet for validation, review and EVL; opus only for the code-execution leg.

PVL cycle: 3 (re-validate after supplement cycle 2). Trend: 9 gaps (first pass) -> 4 gaps (cycle-1 re-validate) -> 0 gaps (this pass). G1-G13 verified resolved in the plan text and stay resolved. No new gap raised.

Evidence (this pass, against the real working tree; Phase 08 not yet executed, so its surface is checked against the Phase 08 plan, not code):
- `validate-plan-artifact.mjs` on the full repo-relative path: 0 failures, 0 warnings, exit 0.
- G10 resolved: Data Flow and B1 now say `audit()` for the first page and `audit(cursor)` for Load more (fixed page size 100); matches the Phase 08 pin `audit(cursor?) -> {events, next_cursor}`.
- G11 resolved: option (a) chosen in X11 and B4 (Target = entity type + short id, Why = event `reason` or `reason_code` label, no join, Entry number omitted); needs no new `AuditList` prop; `AuditList({events, loading?, onMore?})` is pinned presentational in the Phase 08 plan (S2.4) and 08b does not modify it. A0 additionally confirms that `AuditList` renders actor, time, action and a reason column (Phase 08 closes AC55 "who, when, why" through this viewer); a missing column is a Phase 08 follow-up, not a local re-implementation (carried in E1).
- G12 resolved: exact fake-Worker endpoint set is listed in the Touchpoints row for `memory-stub-rules.ts`; AC50 case (b) seeds the triage row directly (no runs, findings or decisions-create endpoints); `unknown_firm` on `/api/memory/firm` is handled as "Memory unavailable" (E11).
- G13 resolved: `memory-ui-rules` owns the request-body mapping assertion (approve and reject carry only `client_op_id`; revoke carries `text`; create carries `text` with `law_firm_id` as the query param; Reopen carries `{client_op_id, reason}` in `memory-ui-decisions`); failing stub `should send no text on approve or reject` is in the plan's stub list; the Risks line now names `memory-ui-rules` as the owning test.
- Endpoint paths verified against `apps/worker/src/routes/memory/index.ts` (`MEMORY_ROUTES`): `POST /api/session`, `POST /api/memory/lookup`, `GET /api/rules`, `POST /api/rules`, `POST /api/rules/:id/approve`, `POST /api/rules/:id/reject`, `POST /api/rules/:id/revoke`, `POST /api/decisions/:id/revoke`, `GET /api/memory/firm`, `GET /api/audit` are all registered. Health: `GET /api/health` ({ok:true}) is registered in `apps/worker/src/app.ts` line 117 (NOT in `routes/memory/index.ts`), and a separate `GET /api/memory/health` (schema version, seed_mode, 503 `ok:false` when the DB is down) is registered in `routes/memory/index.ts`. `GET /api/quota` is registered in `apps/worker/src/routes/proxy/index.ts` (not in the memory routes). The plan's note "paths verified against routes/memory/index.ts" is therefore exact for the memory routes only; health and quota live in two other files. The Phase 08 plan pins `health()` on `MemoryApi` without naming its URL (its stack-memory webServer readiness url is `http://127.0.0.1:8788/api/health`). Resolution is an execute instruction (E12), not a plan gap: the stub only needs the routes the real client calls.
- AC50 case (b) seam verified in code: triage is persisted in the Dexie `uiState` table under key `triage:${doc.id}` with value `Record<findingId, Triage>` (`apps/web/src/state/review.ts` `triageKey`, `loadTriage`, `saveTriage`; `Triage` = `{status, reasonCode?, note?, counselAnswer?, decisionId?}` in `features/review/model.ts`; IndexedDB database name `aduin-web` per `storage/db.ts`). `loadTriage` runs only when a document opens (review.ts line 407). The existing IndexedDB access pattern is `previously-handled-section.spec.ts` (`indexedDB.open('aduin-web')` inside `page.evaluate`). So a spec can seed `{status:'dismissed', decisionId:<revoked id>}` directly, then reopen the document; no UI dismiss and no extra fake-Worker endpoints are needed. `refreshMemory` is today a closure-local at the top of the store factory (review.ts line 260) and `reopen` calls it; exposing it as a store action is the additive G6 change, scoped and correct.
- Code verified OK (carried from earlier passes, re-spot-checked): `packages/core/src/contracts/memory.ts` (RuleSchema, `RuleActionRequestSchema` = `client_op_id` + optional `text`, `RevokeDecisionRequestSchema` reason 1-500, `AuditEventSchema`, `AuditQuerySchema` limit 1-100); `decisions.ts` (`decision_not_found` is 400 `invalid_request`; raced row is 409; `decision_revoked` audit carries `reason` + `detail.decision`); `rules.ts` (`rule_state` / `rule_not_found` 400; cap 429 `quota_exhausted` / `active_rule_cap` on create and approve); `firm.ts` (`status = 'active'` only, LIMIT 200, unknown firm 400 `unknown_firm`); `proposal.ts` (`rule_proposed` detail carries `reason_code`); `apps/worker/src/memory/seed-copy.ts` (a fresh sandbox copies the demo seed incl. sd01-sd03 and sr01); `api/base.ts` + `e2e-hook.ts` (`setApiBase('/')` yields relative `/api/...` URLs intercept-able by `page.route('/api/**')`).
- Phase 08 pins re-checked against the Phase 08 plan (lines 96, 140, 347): `firm`, `listRules`, `createRule`, `approveRule`, `rejectRule`, `revokeRule(id, text)`, `revoke(decisionId, reason)`, `audit(cursor?)`, `MemoryApiError {code, reason, status, retryAfterUtc?, current?}`, presentational `AuditList({events, loading?, onMore?})`, `useSession().readOnly`, `client.ts` re-evaluation on API base change, stack-memory regex `/--project[= ]stack(?![-\w])/`, preview `testIgnore` `stack-memory-.*\.spec\.ts`. These Phase 08 items are still unimplemented (the current `playwright.config.ts` holds the old `stack` regex); that is the Phase 08 EXECUTE dependency, gated by the Entry Gate and A0.
- Mockup: `design/mockups/app.html` `#v-memory` + `app_NOTES.md` (verified in the first pass; unchanged).
- Registry: `phase-blast-radius-registry.md` `## Phase 08b` (line 64) still shows the old claim ("owns `design/mockups/firm-memory.html`; extends `features/audit/**`"). The plan's R5 request supersedes it; the orchestrator or update-process must apply R5 and the Phase 08 request before EXECUTE (instruction E10, not a plan gap: the request is already written).
- Pinned stack-memory command (Phase 08 plan, A0 re-confirms by grep): `pnpm --filter @aduin/web test:e2e:stack-memory stack-memory-firm-rules` (script `playwright test --project=stack-memory`; the token is a regex on the spec file name; one token per call).

Test gates (C3 5-column table; legacy line form below). Command form (program-wide rule, tests/all-tests.md): `pnpm --filter <pkg> test <token>`, NO `--`, ONE token per call; an unmatched token must exit 1. gap-resolution: A = proven now, B = added by this plan's checklist or its supplement, C = deferred to a named later phase, D = backlog test-building stub. The strategy column carries only Fully-Automated, Hybrid or Agent-Probe; Known-Gap is never a strategy (residual row below carries gap-resolution D).

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC52 / AC54 (support) | pure join helpers: revoked rows from `decision_revoked` audit events, `matchingDismissals` (text-regex path, seeded-rule fallback path, unresolved path, never equals `evidence_count`), audit group mapping, firm filter, rule who/when, lean Reopened row issue class from the same-entity `decision_recorded` event (else "—") | Fully-Automated | `pnpm --filter @aduin/web test memory-join` | B |
| AC52 | decisions list, status filter All/Active/Reopened, issue-class filter, 200-row note, 503 unavailable state, no-firm empty state with no `firm()` call, read-only demo disabled tooltip | Fully-Automated | `pnpm --filter @aduin/web test:e2e memory-ui-decisions` | B |
| AC50 (closing) | Reopen refuses an empty reason; writes a `decision_revoked` audit row; the row moves to Reopened; (a) a prior-firm decision labelled `previously_dismissed` is New after Reopen, (b) the same-document triage entry with the revoked decisionId resets to `open` (triage row seeded directly in Dexie `uiState` key `triage:<doc.id>`, then the document is reopened); a lost race (409 or 400 `decision_not_found`) refetches, closes the dialog, toasts "Already changed"; Reopen body is `{client_op_id, reason}` | Fully-Automated | `pnpm --filter @aduin/web test:e2e memory-ui-decisions` (reopen cases) | B |
| AC54 / AC53 (UI) | Suggested row with matching dismissals; before Approve the proposed rule is only in the Suggested strip, never in the Active table; Approve makes it Active and appends `rule_approved`; Reject keeps it inactive (Rejected caption), no re-proposal without a new dismissal; Add rule and Deactivate with required reason; `active_rule_cap` message; 400 `rule_state` race shows "Already changed"; no Edit control; request bodies recorded by the fake Worker (approve/reject carry only `client_op_id`; revoke carries `text`; create carries `text` with `law_firm_id` as the query param) | Fully-Automated | `pnpm --filter @aduin/web test:e2e memory-ui-rules` | B |
| AC55 (closing, filters) | action-group filter over loaded pages, "N of M entries, newest first", Load more appends the next keyset page (`audit(cursor)`), firm filter excludes `session_created` | Fully-Automated | `pnpm --filter @aduin/web test:e2e memory-ui-audit` | B |
| AC51 / AC54 (AI context) | an active firm rule reaches the AI prompt as context only, never another firm; a proposed rule is never injected | Fully-Automated | `pnpm --filter @aduin/worker test firm-rule-in-context-recorded-llm`, `pnpm --filter @aduin/worker test firm-rule-isolation`, `pnpm --filter @aduin/worker test proposed-rule-never-injected` (existing Phase 05 files at `apps/worker/test/llm/`, one call each) | A |
| AC51 (browser to Worker) | a rule added through the UI is listed for firm A only through the real local Worker (`/api/rules`, `/api/memory/firm`); firm B sees none; no AI call | Hybrid | `pnpm --filter @aduin/web test:e2e:stack-memory stack-memory-firm-rules`; precondition: Phase 08 `stack-memory` webServer (`dev-seed.ts`, random per-run cookie keys, seeded throwaway persist dir, no `.dev.vars`) | B |
| AC51 (AI run through the browser) | a browser-driven AI review echoes `meta.rules_hash8` / `rules_applied` | none (named residual row, not a proving strategy; the local Worker has no recorded upstream and the OpenRouter host is locked to openrouter.ai) | — (backlog stub `memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md`; Phase 10 live probe) | D |
| a11y | `#memory` route has no critical axe violation | Fully-Automated | `pnpm --filter @aduin/web test:e2e a11y-smoke` (after the additive memory case) | B |
| layout | memory view matches the mockup computed-style audit when the slicer reaches `#v-memory` (conditional, additive) | Fully-Automated | `pnpm --filter @aduin/web test:e2e layout-vs-mockup` | B |
| regression (web) | earlier screens, repaired memory/placeholder tests and import-graph stay green | Fully-Automated | `pnpm --filter @aduin/web test`, then `pnpm --filter @aduin/web test:e2e`, then `pnpm --filter @aduin/web test import-graph`, then `pnpm --filter @aduin/web test:a11y` | A |
| regression (repo) | Phase 04b/05 Worker intact; Cloudflare guard; secrets | Fully-Automated | `pnpm --filter @aduin/worker test`, then `pnpm guard:cf`, then `pnpm secrets:scan` | A |

Failing stubs (red-first; Fully-Automated rows only; copy verbatim into the test files):
- `test("should resolve matching dismissals without equating them to evidence_count", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should resolve matching dismissals without equating them to evidence_count") })`
- `test("should list a firm's decisions filtered by issue class", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should list a firm's decisions filtered by issue class") })`
- `test("should reopen a decision and show the finding as New", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should reopen a decision and show the finding as New") })`
- `test("should not change AI context before a proposal is approved", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should not change AI context before a proposal is approved") })`
- `test("should keep a rejected proposal inactive until new matching dismissals arrive", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should keep a rejected proposal inactive until new matching dismissals arrive") })`
- `test("should send no text on approve or reject", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should send no text on approve or reject") })` (lives in `memory-ui-rules`)
- `test("should filter the audit list by action group and load the next page", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should filter the audit list by action group and load the next page") })`

Legacy line form:
- memory UI (AC50, AC52, AC53, AC54, AC55): [Fully-automated: `pnpm --filter @aduin/web test memory-join`; `pnpm --filter @aduin/web test:e2e memory-ui-decisions`, `memory-ui-rules`, `memory-ui-audit` (one call each)] | [hybrid: `pnpm --filter @aduin/web test:e2e:stack-memory stack-memory-firm-rules` + precondition Phase 08 seeded stack-memory webServer] | [known-gap: browser-driven AI run echo of the rules hash, documented as backlog stub]
- AC51 (Worker): [Fully-automated: `pnpm --filter @aduin/worker test firm-rule-in-context-recorded-llm`, `firm-rule-isolation`, `proposed-rule-never-injected` (one call each)]
- regression: [Fully-automated: `pnpm --filter @aduin/web test`, `test:e2e`, `test import-graph`, `test:a11y`; `layout-vs-mockup`; `pnpm --filter @aduin/worker test`; `pnpm guard:cf`; `pnpm secrets:scan`]

Dimension findings:
- Infra fit: PASS — fake-Worker endpoint set is pinned and checked against the Worker route files (memory routes in `routes/memory/index.ts`, `GET /api/health` in `app.ts`, `GET /api/quota` in `routes/proxy/index.ts`); the health URL ambiguity is resolved by instruction E12.
- Test coverage: PASS — every criterion maps to a runnable gate; body-mapping is owned by `memory-ui-rules` (G13); the AC50 case (b) triage seam exists (Dexie `uiState` `triage:<doc.id>`); the one unproven behavior (browser-driven AI rules echo) is a named residual with backlog stub, not a vacuous green.
- Breaking changes: PASS — no contract surface, no Worker change, no core change (verified); registry append, `refreshMemory` store action and the three repair specs are serialized after Phase 08, which edits the same files; stale registry entry is carried as E10.
- Security surface: PASS — UI over server-enforced endpoints (`maskFree`, 100-rule cap, 403 read-only, `client_op_id` replay safety); free text rendered as React text nodes; approve/reject APIs take no text parameter at all; no new trust-boundary logic, so no high-risk evidence pack for 08b (record this determination in the report).
- Section A (Entry gate + A0): PASS — every Phase 08 item 08b needs is pinned in the Phase 08 plan; A0 greps remain the check; stack-memory regex, `testMatch`/`testIgnore` and dev-seed self-check are Phase 08-owned.
- Section B1 (join, hook, MemoryView, registry): PASS — `audit()` / `audit(cursor)` now matches the pinned signature (G10 resolved).
- Section B2 (Decisions): PASS — Reopen path, lean Reopened rows, `refreshMemory` reset and "Already changed" mapping match the verified Worker behavior; unknown-firm 400 only for a firm id outside `LAW_FIRMS` (E11).
- Section B3 (Rules): PASS — 400 `rule_state`, 429 cap, no Edit, no reason on reject, body mapping owned by `memory-ui-rules` (G13 resolved).
- Section B4 (Audit): PASS — option (a) (no Target join) is consistent with the unmodified presentational `AuditList` (G11 resolved).
- Section B5 (repairs): PASS — `placeholder-routes.spec.ts`, `app-shell.spec.ts`, `smoke.test.tsx` touch points identified; `a11y-smoke.spec.ts` takes an additive case; apply on top of Phase 08's counsel edits.
- Section C (tests): PASS — C2 and C3 name the fake-Worker mechanism, the triage seam and the body assertions.
- Section D (report): PASS.

Open gaps: none (G1-G13 resolved; no new gap raised in this pass).

Known Gaps (named residuals, not counted as CONCERN): browser-driven AI run echoing `meta.rules_hash8` (gap-resolution D, backlog stub `memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md`, Phase 10 live probe).

What This Coverage Does NOT Prove:
- `memory-join`: no browser behavior, no real Worker; the seeded-rule fallback is proven against the spec data only, not against a regenerated or sandbox-copied D1.
- `memory-ui-decisions` / `memory-ui-rules` / `memory-ui-audit` (preview): the fake Worker mirrors, but is not, the real Worker; no D1 rows_written, no real cap race, no real 409 race, no cookie/session behavior, no Phase 08 outbox interplay.
- Worker AI-context gates (Phase 05 files): server-side injection only; they do not prove the memory page or any browser flow.
- `stack-memory-firm-rules`: firm isolation at the rules/memory endpoints on a local seeded Worker; NOT an AI run, NOT the `meta.rules_hash8` echo, NOT the deployed Worker (Phase 10).
- Design fidelity beyond the computed-style slicer (Agent-Probe `DESIGN_PROBE=1` is opt-in and not part of the gate).
- Read-only demo behavior beyond disabled buttons (Phase 08 `demo-workspace-*`).
- Revoked decisions older than the loaded audit pages (accepted, noted in the UI line); stale triage entries of documents that are NOT currently open keep a revoked decisionId until reopened (same-document reset only, as AC50 case (b)).

Execute-agent instructions (non-gating; the plan text plus the supplement plus these are the contract):
- E1 (order): start only after Phases 04b and 08 are VERIFIED and committed; run A0 greps first (client method names and signatures, `MemoryApiError.reason`, `AuditList` props and that it renders actor, time, action, target and a reason column, `useSession().readOnly`, `client.ts` base re-evaluation, `test:e2e:stack-memory` script, stack-memory regex, `testMatch`, preview `testIgnore`, dev-seed self-check). Any missing 08 piece = BLOCKED, small 08 follow-up; never re-implement `MemoryApi` or `AuditList` here.
- E2 (gate form): one token per call, no `--`; each new e2e/unit token must exit 1 before its file exists and exit 0 after.
- E3 (field mapping): approve and reject send only `client_op_id`; revoke sends `text` as the required reason; create sends `text` with `law_firm_id` as the query param; Reopen sends `{client_op_id, reason}`; assert the bodies in `memory-ui-rules` (reopen body in `memory-ui-decisions`).
- E4 (seed): A0 asserts the Phase 08 stack-memory D1 holds sd01-sd03 and the proposed rule sr01 for `partners-group` (dev-seed self-check or a `GET /api/rules` setup step); do NOT require a `demo.sql` header change and never run `seed:gen`; a fresh sandbox already copies the demo seed (sd01-sd03 + sr01, per `seed-copy.ts`), so approve/reject in the stack run on sr01 directly; answered decisions sd06/sd07 are not copied while their audit events are, so audit rows for them render with entity type + short id only (no Target join).
- E5 (untrusted text): render rule text, reasons and actor names as React text nodes only; no HTML sink.
- E6 (imports): `memory-join.ts` and tab components use type-only imports from `@aduin/core`; local literal lists for audit actions; if a value import is unavoidable, extend the `import-graph` ALLOWED set additively and record it.
- E7 (e2e cost): each `test:e2e` call rebuilds the preview (3-6 s); one token per call.
- E8 (live calls): none. Any live call, paid call, `git push`, Cloudflare touch beyond the guards is a hard stop.
- E9 (report): record deviations X1-X11, the stack-memory D1 seed assertion result, the exact stack-memory command, the "no evidence pack needed" determination, the `memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md` backlog stub and any other deferred item as a backlog stub.
- E10 (registry): before EXECUTE the orchestrator or update-process applies the plan's R5 registry request (and the Phase 08 request) to `phase-blast-radius-registry.md`; the current `## Phase 08b` entry still claims `design/mockups/firm-memory.html` and "extends `features/audit/**`".
- E11 (unknown firm): `GET /api/memory/firm` and `GET /api/rules` return 400 `invalid_request` reason `unknown_firm` for a firm id outside `LAW_FIRMS`; treat it like "Memory unavailable" for that firm, no crash.
- E12 (fake-Worker endpoint list, health and fallback): `memory-stub-rules.ts` must answer exactly the routes the real client calls: `POST /api/session` (with a `read_only` toggle), `POST /api/memory/lookup`, `GET /api/memory/firm`, `GET /api/rules`, `POST /api/rules`, `POST /api/rules/:id/approve`, `POST /api/rules/:id/reject`, `POST /api/rules/:id/revoke`, `POST /api/decisions/:id/revoke`, `GET /api/audit`, `GET /api/quota` (served by `routes/proxy`, shape `{ai, ocr_pages, global_ok}`). Health: `GET /api/health` exists in `apps/worker/src/app.ts` (not in `routes/memory/index.ts`) and `GET /api/memory/health` exists in `routes/memory/index.ts`; the Phase 08 plan does not name the URL its `health()` calls, so A0 greps the Phase 08 client and the stub answers only the health route(s) the client actually calls (`/api/health` returns `{ok:true}`; `/api/memory/health` returns `{ok, schema_version, seed_mode}`); if neither is called, drop health from the stub. Any other `/api/**` request must get an explicit 404 `{error}` response and be recorded, and each spec asserts the unexpected-request list is empty so a missing stub route fails loudly instead of hanging. Every body is validated with core zod schemas.
- E13 (AC50 case (b) triage seam): seed the triage row through IndexedDB `aduin-web`, table `uiState`, key `triage:<doc.id>`, value `{ [findingId]: { status: 'dismissed', decisionId: <revoked id> } }` (pattern: `previously-handled-section.spec.ts` `indexedDB.open('aduin-web')` in `page.evaluate`; read `doc.id` from the opened document), then reopen the document, because `loadTriage` runs only at document open. After Reopen, assert the finding is New (status `open`). Never create the entry through the UI dismiss path.

Autonomous goal block: not written here (BRANCH B: umbrella `subdoc-qa-mvp-umbrella_PLAN_17-10-26.md` has `## Stable Program Goal`; the umbrella's /goal governs).

Gate: PASS (0 FAILs, 0 CONCERNs; G1-G13 resolved; one named residual with backlog stub)
Accepted by: not required for PASS (no concerns to accept). Named residual carried, not accepted as a CONCERN: browser-driven AI run echo of `meta.rules_hash8` (backlog stub, Phase 10 live probe).
