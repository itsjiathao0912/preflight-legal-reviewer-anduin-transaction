---
phase: phase-08b-memory-ui
date: 2026-10-17
status: COMPLETE
feature: subdoc-qa-mvp
plan: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08b-memory-ui_PLAN_17-10-26.md
name: report:subdoc-qa-mvp-phase-08b-memory-ui
description: "Phase 08b EXECUTE report: #memory screen (Decisions, Rules, Audit trail) over the Phase 08 MemoryApi; all gates green; EVL + review closed; UPDATE PROCESS done"
metadata:
  node_type: memory
  type: report
  feature: subdoc-qa-mvp
  phase: phase-08b
---

# Phase 08b report: Memory UI (Decisions | Rules | Audit trail)

TL;DR: the `#memory` screen is built and registered. Every gate in the validate contract is green, run one token per call: memory-join unit, the three new preview specs (19 tests), placeholder-routes, app-shell, a11y-smoke, whole preview e2e (157 passed, 1 opt-in skip), the new Hybrid stack spec, whole stack-memory (10 passed), the three Worker AI-context gates, `slice:check`, typecheck, lint, guard:cf, secrets:scan. No commit (HEAD eb53541 + working tree).

## What Was Done

### A0: entry conformance (HEAD eb53541)

Phase 08 surface, confirmed by grep:

| Pin | Found |
|---|---|
| `firm`, `listRules`, `createRule(lawFirmId, text)`, `approveRule(id)`, `rejectRule(id)`, `revokeRule(id, text)`, `revoke(decisionId, reason)`, `audit(cursor?)` -> `{events, next_cursor?}`, `AUDIT_PAGE_SIZE = 100` | `apps/web/src/api/memoryApi.ts`, `realMemoryApi.ts` |
| `MemoryApiError {code, reason, status, retryAfterUtc?, current?}` | `memoryApi.ts` (wire mapping: `*_not_found` -> `not_found`, `rule_state` -> `invalid_request` + reason, 409 -> `conflict`, 403 -> `read_only`, 429 -> `quota_exhausted` + reason) |
| Presentational `AuditList({events, loading?, onMore?})`, no fetching; renders time, actor, entity type, action and reason | `apps/web/src/features/audit/AuditList.tsx` (not modified) |
| Read-only accessor | `useSession().readOnly` (`state/session.ts`), set from the POST /api/session response by `ensureSession` |
| 401 `invalid_session` re-bootstrap | `RealMemoryApi.request` |
| `client.ts` drops its cached client on `onApiBaseChange` | yes; BUT the preview (`IS_E2E`) build keeps the stub (Phase 08 S2 deviation 1). See Deviation P1 |
| Health URL the client calls | `health()` calls `GET /api/memory/health`; no app flow calls `health()` |
| stack-memory project | `playwright.config.ts`: `wantsStack = /--project[= ]stack(?![-\w])/`, project `stack-memory` testMatch `stack-memory-.*\.spec\.ts`, preview `testIgnore` `[slice, stack-memory-.*\.spec\.ts]`. No config change needed |
| Exact stack-memory command | `pnpm --filter @aduin/web test:e2e:stack-memory stack-memory-firm-rules` (script `playwright test --project=stack-memory`) |
| Stack-memory D1 seed (E4) | `scripts/src/dev-seed.ts` self-checks sd01-sd03 + proposed sr01. The new stack spec also asserts it in the sandbox copy: `GET /api/rules?law_firm_id=partners-group` holds `<sandbox>:sr01` with status `proposed`, and `GET /api/memory/firm` holds `<sandbox>:sd01..sd03` (seed-copy ids are prefixed). PASS |

Mockup conformance (`design/mockups/app.html` `#v-memory`, `app_NOTES.md`):

| Mockup element | Built |
|---|---|
| Header: "{Firm} memory" + meta line `{n} decisions ({a} active) · {r} rules · {p} suggested` | yes (X7: real firm name, e.g. "Partners Group memory") |
| Segmented control Decisions / Rules / Audit trail, `role=tablist`, counts as dim text, pending flag on Rules | yes, arrow keys / Home / End, roving tabindex, `aria-selected` |
| Info popover "What memory keeps" | yes (Escape and outside click close it) |
| Decisions: single-line rows, class filter, status segment, "N of M" | yes; status segment All / Active / Reopened (X6, X8) |
| Decision Reopen dialog with required reason | yes (native `<dialog>`) |
| Rules: Suggested strip with Review | yes ("N matching dismissals" text, Deviation P4) |
| Review dialog: text, "No effect until approved" callout, evidence list, Approve / Reject | yes; evidence = "Matching dismissals" (never `evidence_count`); no note field (X2, X3) |
| Active rules table, Add rule | yes; who/when from audit (X5); Add has no Why (X4) |
| Rule row menu: Edit, Deactivate | Deactivate only, as a direct link (X1; Deviation P4) |
| Audit: lock bar, group filter, "N of M entries, newest first" | yes, over loaded pages, plus a "filters apply to loaded entries" note |
| Audit columns Entry #, Target text, Why | Entry # omitted; Target = entity type + short id; Why = reason or reason_code label (X11) |
| Expandable decision detail rows | omitted (X9) |
| "Memory reused N of M" | omitted (X10) |

### Files

| File | Change |
|---|---|
| `apps/web/src/features/memory/MemoryView.tsx` (new) | Header, tabs, info popover, status states (noFirm / loading / unavailable + Retry / ok), read-only note, dialog routing, write outcome handling (refetch, toasts, `refreshMemory` after Reopen) |
| `features/memory/memory-join.ts` (new) | Pure helpers: `joinRevoked`, `matchingDismissals` (text path, seeded-rule fallback, none), `ruleWhoWhen`, `auditGroup`, `filterAudit`, `auditForDisplay`, `shortId`, `humanClass` |
| `features/memory/useMemoryData.ts` (new) | Loads `firm()` + `listRules()` + first `audit()` page after `ensureSession()`; `loadMoreAudit` via `audit(cursor)`; `refetch`; firm = `useReview.doc.firmId`; no firm = no call; stale-response guard |
| `features/memory/write.ts` (new) | `runWrite` + `classifyWriteError` (changed / readOnly / cap / retry) and UI messages |
| `features/memory/MemoryDialog.tsx` (new) | Native `<dialog>` shell (showModal, Escape, close, error slot) |
| `features/memory/decisions/{DecisionsTab,DecisionRow,ReopenDialog}.tsx` (new) | Decisions tab and Reopen |
| `features/memory/rules/{RulesTab,SuggestedStrip,ReviewRuleDialog,AddRuleDialog,DeactivateRuleDialog}.tsx` (new) | Rules tab and its three dialogs |
| `features/memory/audit/MemoryAuditTab.tsx` (new) | Group filter + paging over the unmodified `AuditList` |
| `apps/web/src/styles/memory.css` (new) | Memory CSS ported from app.html (outside the hex-guarded dirs, imported by `MemoryView` like `structure.css`) |
| `apps/web/src/features/registry.ts` | Appended `{id:'memory', ..., component: MemoryView}` after the counsel entry |
| `apps/web/src/state/review.ts` | Additive store action `refreshMemory(revokedDecisionId?)`: resets same-document triage entries whose `decisionId` equals the revoked id to `open`, saves them, then re-reads memory. No other change |
| `apps/web/src/e2e-hook.ts`, `apps/web/src/api/client.ts` | IS_E2E-guarded `__aduinE2E.useRealMemory(on)`; `memoryApi()` rebuilds its cached client when the wanted kind changes (Deviation P1) |
| `apps/web/src/smoke.test.tsx`, `e2e/placeholder-routes.spec.ts`, `e2e/a11y-smoke.spec.ts` | Narrow repairs: memory appended to the registry ids; memory removed from placeholders with a "Memory is a real view" case; a11y audits `#memory` and moves the placeholder audit to Documents. `app-shell.spec.ts` needed no change |
| `apps/web/test/memory-join.test.ts` (new) | 5 cases (C1) |
| `apps/web/e2e/fixtures/memory-stub-rules.ts` (new) | Stateful fake Worker (B6/E12), core-zod-validated request and response bodies, request recording, one-shot failures, `expectClean()` (no unexpected route, no invalid body); `demoSeed()` mirrors sd01-sd03 + sr01 |
| `apps/web/e2e/memory-ui-{decisions,rules,audit}.spec.ts` (new) | 11 + 7 + 1 tests |
| `apps/web/e2e/stack-memory-firm-rules.spec.ts` (new) | Hybrid AC51 spec (1 test) |
| `process/general-plans/backlog/memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md` (new) | Named residual stub |

Not touched: `packages/**`, `apps/worker/**`, `fixtures/**`, `features/audit/**`, `design/**`, `playwright.config.ts`, `import-graph.test.ts` (no new core value import), `mockupCss.ts` / `layout-vs-mockup.spec.ts` (slicer not extended).

### Behavior notes

- Writes (Reopen, Add, Approve, Reject, Deactivate) are awaited `MemoryApi` calls; the client generates a fresh `client_op_id` per call, so Try again is a new op (asserted). Never outbox-queued.
- Error mapping: 409 or 400 `*_not_found` / `rule_state` -> close, refetch, toast "Already changed"; 403 -> `setReadOnly(true)` + toast; 429 `active_rule_cap` -> "This firm already has 100 active rules. Deactivate one first." (dialog open); network / other -> "Could not reach memory. Try again" (dialog open). Load failures (503, network, 400 `unknown_firm`) -> "Memory unavailable. Findings are shown as New." + Retry.
- Read-only session: Reopen, Add, Deactivate disabled with title "This demo workspace is read-only."; Review opens without Approve / Reject; specs assert zero POST writes.
- Free text (rule text, reasons, actor names) renders as React text nodes only (E5); source-guard green.

### Security determination (E9)

UI over existing server-enforced endpoints; no new trust boundary, auth, secret or contract. The only runtime switch added (`useRealMemory`) lives inside an `IS_E2E` block that is compiled out of production (`no-e2e-hook-in-dist` green in the web unit run). No high-risk evidence pack needed.

## Mid-implementation progress note

At about 50% (B1-B2 done, decisions spec 10/11 on its first run): the one failure was a test-technique bug (the spec removed the toast DOM node behind React); fixed by clearing the toast through the store. No plan deviation found at that point beyond P1 (already authorized by the brief). Continued without pause.

## What Was Skipped or Deferred

- Browser-driven AI run echoing `meta.rules_hash8` (named residual, gap-resolution D): backlog `process/general-plans/backlog/memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md`, Phase 10 live probe.
- `layout-vs-mockup` slicer extension: not needed (the plan makes it conditional); the layout gate does not apply to `#memory`.
- Stale triage entries of documents that are not open keep a revoked decisionId until reopened (accepted in the validate contract).

## Test Gate Outcomes

All commands one token per call, no `--`.

| Gate | Result |
|---|---|
| `pnpm --filter @aduin/web test memory-join` | red first (stub threw), then 5/5 |
| `pnpm --filter @aduin/web test import-graph` | 4/4 (unchanged ALLOWED set) |
| `pnpm --filter @aduin/web test source-guard` | 4/4 |
| `pnpm --filter @aduin/web test smoke` | 2/2 |
| `pnpm --filter @aduin/web test` (whole web unit) | 27 files, 194 tests |
| `pnpm --filter @aduin/web test:e2e memory-ui-decisions` | 11 passed |
| `pnpm --filter @aduin/web test:e2e memory-ui-rules` | red first (3 stubs failed), then 7 passed |
| `pnpm --filter @aduin/web test:e2e memory-ui-audit` | 1 passed |
| `pnpm --filter @aduin/web test:e2e placeholder-routes` | 5 passed |
| `pnpm --filter @aduin/web test:e2e app-shell` | 8 passed |
| `pnpm --filter @aduin/web test:e2e a11y-smoke` | 1 passed (memory case: no critical violation) |
| `pnpm --filter @aduin/web test:e2e` (whole preview, single invocation) | 157 passed, 1 skipped (design-probe opt-in) |
| `pnpm --filter @aduin/web test:e2e:stack-memory stack-memory-firm-rules` (after preview, never concurrent) | 1 passed (Hybrid; incl. A0 seed assertion) |
| `pnpm --filter @aduin/web test:e2e:stack-memory` (whole) | 10 passed |
| `pnpm --filter @aduin/worker test firm-rule-in-context-recorded-llm` | 2/2 |
| `pnpm --filter @aduin/worker test firm-rule-isolation` | 2/2 |
| `pnpm --filter @aduin/worker test proposed-rule-never-injected` | 2/2 |
| `pnpm slice:check` | PASS (full) |
| `pnpm typecheck` | clean (web, worker, scripts) |
| `pnpm lint` (eslint + prettier) | clean |
| `pnpm guard:cf`, `pnpm secrets:scan` | OK |

Proof map: AC52 + AC50 closing = `memory-ui-decisions` (both reopen cases (a) and (b), lost race, network retry with a fresh op id, no-firm, 200-row note, 503, read-only); AC54 + AC53 UI = `memory-ui-rules` (Suggested-not-Active, approve audited, reject inactive and not re-proposed after reload, body mapping, cap, `rule_state` race, no Edit, read-only) + Worker `proposed-rule-never-injected`; AC55 filters = `memory-ui-audit`; AC51 = Worker gates + `stack-memory-firm-rules`. No section is Known-Gap-only.

Red-first: the memory-join unit and the `memory-ui-rules` preview stubs were run red before any component existed. The decisions and audit stubs were written red-first but not run red separately (each `test:e2e` call rebuilds the preview); low risk, they now assert real behavior.

## Plan Deviations

X1-X11 are implemented as planned. Additional (all within the 08b blast radius or explicitly authorized by the EXECUTE brief):

| # | File | Deviation | Rationale |
|---|---|---|---|
| P1 | `apps/web/src/e2e-hook.ts`, `apps/web/src/api/client.ts` (Phase 08 files) | Added the IS_E2E-guarded `__aduinE2E.useRealMemory(on)`; `memoryApi()` rebuilds the cached client when the wanted kind (real / stub) changes | Since Phase 08 S2 the preview build keeps the stub even after `setApiBase('/')`, so the planned page.route fake Worker (B6) could not be reached. Authorized by the EXECUTE brief ("add a minimal IS_E2E-guarded switch if needed"). Production, vitest and stack builds unchanged (`realMemoryApi` + `no-e2e-hook-in-dist` green) |
| P2 | `apps/web/src/state/review.ts` | `refreshMemory` takes an optional `revokedDecisionId` (`(revokedDecisionId?: string) => Promise<void>`) | The action must know which decision was revoked to reset matching triage entries (G6). Still callable as `() => Promise<void>` |
| P3 | `features/memory/{MemoryDialog.tsx, write.ts}`, `styles/memory.css` | Extra files not named in Touchpoints | Shared dialog shell / error mapping; mockup CSS ported outside the hex-guarded dirs, same pattern as `structure.css` |
| P4 | Rules tab | Single "Deactivate…" link per rule instead of a "⋯" menu; the Suggested strip shows "N matching dismissals" text instead of an "N decisions" link | With Edit omitted (X1) the menu has one item; the sprite has no dots icon; the count must be the client cross-match, not `evidence_count` |
| P5 | Audit tab | Load more uses the Phase 08 `AuditList` button ("Show older entries") | 08b may not modify `AuditList` |
| P6 | Decisions tab | Extra muted note that reopened rows come from loaded audit pages | Makes the X6 limitation visible (plan Risks line) |

No hard-stop class deviation (no schema, auth, API contract, container, secret or external integration change).

## Test Infra Gaps Found

- None blocking. Note for later phases: preview specs that need the real memory client call `useFakeWorkerClient(page)` (= `useRealMemory(true)` then `setApiBase('/')`) after `gotoApp`, with `installFakeWorker` registered before navigation.
- The Worker masks long digit runs in free rule text (`maskFree`); stack specs must use letters-only nonces in rule text.

## Closeout Packet

- Selected plan: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08b-memory-ui_PLAN_17-10-26.md` (checklist A0-D1 ticked; Phase Loop step 5 ticked).
- Classification: Ready for UPDATE PROCESS archival after the EVL confirmation run (orchestrator spawns vc-tester).
- Finished: B1-B6, C1-C6, D1 as above.
- Verified: every validate-contract gate listed in Test Gate Outcomes. Unverified: deployed behavior (Phase 10), browser-driven AI rules echo (backlog stub).
- Cleanup / context capture: UPDATE PROCESS should record the `useRealMemory` e2e seam and the memory testids in `process/context/tests/` and `process/context/ui/`, apply the R5 registry request, and update the umbrella state.
- CONTEXT_PARTIAL: none.
- Follow-up stubs created: `process/general-plans/backlog/memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md`.
- Next valid state: EVL (vc-tester re-runs the gates), then UPDATE PROCESS, then commit, then Phase 10.

## Forward Preview

### Test Infra Found

- Fake Worker `apps/web/e2e/fixtures/memory-stub-rules.ts` (`installFakeWorker`, `useFakeWorkerClient`, `demoSeed`, `fakeDecision`, `recordedEvent`, `bodiesOf`, `errorBody`, `expectClean`).
- New testids: `memory-view`, `memory-meta`, `memory-tabs`, `memory-tab-{decisions,rules,audit}`, `memory-info`, `memory-kept`, `memory-no-firm`, `memory-loading`, `memory-unavailable`, `memory-retry`, `memory-read-only`; Decisions `memory-decisions`, `memory-filter-class`, `memory-filter-status` (`data-value`), `memory-decisions-shown`, `memory-decision` (`data-decision-id`, `data-status` active/reopened, `data-class`), `memory-reopen`, `memory-decisions-empty`, `memory-decisions-truncated`; Rules `memory-rules`, `memory-suggested`, `memory-suggestion` (`data-rule-id`), `memory-suggestion-matching`, `memory-review`, `memory-no-suggestions`, `memory-active-rules`, `memory-rule` (`data-rule-id`), `memory-deactivate`, `memory-add-rule`, `memory-no-rules`, `memory-ai-info`, `memory-rejected`, `memory-rejected-rule`; dialog `memory-dialog` (`data-kind`), `memory-dialog-reason`, `memory-dialog-text`, `memory-dialog-error`, `memory-dialog-submit`, `memory-dialog-cancel`, `memory-dialog-close`, `memory-approve`, `memory-reject`, `memory-matching`, `memory-matching-item`, `memory-matching-count`, `memory-matching-none`, `memory-reject-note`, `memory-review-read-only`, `memory-review-text`; Audit `memory-audit`, `memory-audit-group`, `memory-audit-shown`, `memory-audit-note` (+ Phase 08 `audit-list`, `audit-event`, `audit-more`).

### Blast Radius Changes

- New dir `apps/web/src/features/memory/**`, new `styles/memory.css`; seam edits in `registry.ts`, `state/review.ts`, `e2e-hook.ts`, `api/client.ts`.

### Commands to Stay Green

The Test Gate Outcomes table, in that order (preview before stack-memory, never concurrent).

### Dependency Changes

None.

## Review fixes (17-10-26, after 54ddaae)

- **M1 (major), fixed (option: clear the answer, not restrict Reopen).** `refreshMemory(revokedId, match?)` in `apps/web/src/state/review.ts` now also clears a counsel answer (`counselAnswer`, `answeredBy`, `answeredAt`, `counselNote`, `answerId`) when the revoked decision is an answered one. Triage keeps the optimistic `pending:<op>` id even after the outbox drains, so matching is by exact id OR (pending id + same finding fingerprint + same decision kind). `MemoryView` passes the reopened row's fingerprint and kind. Test: `test/review-sync.test.ts` "M1: reopening an answered decision ... re-blocks the gate" (gate Ready before, `unanswered` reason after).
- **m1, fixed.** Reopen no longer resets the entry to `{status:'open'}`; it spreads the entry and only clears the matched decision. Test: "m1: reopening a dismissal keeps an unrelated counsel answer".
- **m4, fixed.** `MemoryDialog` ignores Escape/cancel while `busy`; Close (x) and Cancel are disabled while a write is in flight.
- **NIT, fixed.** `no-e2e-hook-in-dist` asserts `useRealMemory` is absent in production and present in the e2e build. `memory.css` hex literals replaced with `var(--ink)` / `var(--accent)`. The Reopen snapshot stores the entered reason (ReopenDialog passes it to `onDone`).

Gates: web unit 196/196 (incl. review-sync 13, memory-join, no-e2e-hook-in-d 2/2); e2e preview memory-ui-decisions 11, memory-ui-rules 7, memory-ui-audit 1, counsel-gate 4, gate-pill 3, counsel-answer 3, sample-picker-smoke 2; full preview 157 passed / 1 skipped; `pnpm typecheck` and `pnpm lint` clean. stack-memory not run (no change to its surface).

## Closeout (UPDATE PROCESS, 2026-10-17)

**Commits:** 54ddaae (feat: memory screen), 2de6749 (review fixes). Process commit follows this closeout.

**Classification:** Keep in program task folder (umbrella plan stays active; Phase 08b itself is DONE and verified). Drift score: HIGH (5 signals: more than 10 files touched, review-driven fix cycle, 3+ memory-worthy observations such as the `useRealMemory` seam, registry/umbrella structural changes, deviations P1-P6). Strongly recommend UPDATE PROCESS -- harness/protocol files touched (no harness files changed; context docs, registry and umbrella were updated here).

**Review:** vc-code-reviewer APPROVE_WITH_FIXES. M1 (reopening an answered decision left the local counsel answer, so the gate stayed Ready) fixed in 2de6749 and independently CONFIRMED FIXED. m1 (reopen wiped unrelated triage fields), m4 (dialog closed mid-write) and the NITs (`useRealMemory` asserted absent from production, `memory.css` hex literals to tokens, reopen snapshot keeps its reason) fixed. No evidence pack required (no auth, billing, migration or API change; the e2e switch is compiled out of production).

**EVL:** cycle 1 on 54ddaae all green (web unit 194, preview e2e 157 + 1 opt-in skip, stack-memory 10, core 2914, Worker firm-rule tokens, typecheck, lint, `guard:cf`, `secrets:scan`, `slice:check`). Cycle 2 on 2de6749 all green (web unit 196, preview 157 + 1 skip, stack-memory 10, `counsel-gate` 4, `gate-pill` 3, plus the same repo gates). `closeout_classification: CLEAN`. TSV rows 77-78 (final HALTED_SUCCESS).

### SPEC Achievement

| AC | Result | Proven by |
|---|---|---|
| AC52 [P1] firm memory page lists decisions and rules, filters by issue class, reopens a decision | met | `memory-ui-decisions` (11), Fully-Automated |
| AC54 [P1] proposed rule has no effect until approved; approval active and audited; reject stays inactive | met | `memory-ui-rules` (7) + Worker `proposed-rule-never-injected` (2), Fully-Automated |
| AC50 [P1] closing: Reopen revokes, finding is New next review | met | two reopen cases in `memory-ui-decisions`; M1 follow-up covered by the review-sync unit case and `counsel-gate` |
| AC53 [P1] closing: proposal visible with evidence | met | `memory-ui-rules` + 04b `rule-proposal-threshold-matrix` |
| AC55 [P0] closing: audit trail viewable, filters by action group | met | `memory-ui-audit` (1) + Phase 08 `audit-trail-append-only` |
| AC51 [P1] closing: active rule reaches AI as context, never a filter, never another firm | met for context and isolation (Worker gates + Hybrid `stack-memory-firm-rules`); browser-driven AI run echoing `meta.rules_hash8` is unmet | residual stub `process/general-plans/backlog/memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md` (Phase 10 live probe) |

## SPEC Gaps

- AC51 browser-driven `meta.rules_hash8` echo: unmet, Known-Gap residual with a backlog stub (exists on disk). It does not make any developed behavior vacuously green: every other AC above has a passing automated or Hybrid gate.
- Memory-page polish (review m2, m3, m5 and NITs): not SPEC ACs; backlog row P8b-1 in `process/general-plans/backlog/core-followups_17-10-26/core-followups_REF_17-10-26.md`.

**Known Gaps verification:** `memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md` exists (no `BACKLOG_NOTE_MISSING`).

**Next valid state:** missing-target cross-reference detector (P6-1, P1, corpus check on the 13 sample docs), then Phase 10. Deploy of the 08b web build is handled separately; the new live version id is recorded by the orchestrator.
