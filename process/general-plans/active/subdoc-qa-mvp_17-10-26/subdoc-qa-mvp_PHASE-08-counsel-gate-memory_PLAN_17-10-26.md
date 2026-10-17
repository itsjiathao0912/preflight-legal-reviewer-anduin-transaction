---
name: plan:subdoc-qa-mvp-phase-08-counsel-gate-memory
description: "Sub-doc QA MVP — Phase 08: counsel query sheet, answers, strict gate with re-confirm, DOCX export, real memory write-back, delivery metrics, audit viewer"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-08
---

# Phase 08 — Counsel Sheet, Gate, DOCX Export, Memory Write-Back, Metrics

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08-counsel-gate-memory_REPORT_17-10-26.md

---

## Overview

Closes the analyst loop and makes memory real end to end. Core gets the counsel-sheet builder (New and Accepted needs-counsel only; Already answered and Awaiting counsel excluded; `unclear` returns as New), a template draft (no-LLM) and the AI draft through the Phase 05 task, the strict **gate** (pure function, all state combinations), and the DOCX export (`docx`, lazy-loaded, verified by parsing the output back). The web replaces the Phase 03 stub memory API with the real Worker client (Phase 04b endpoints), adds the outbox with "unsynced"/"Memory unavailable" states, the counsel sheet screen, answer recording (A/B/C/unclear + note), the gate pill states incl. `Dismissed in [fund], re-confirm`, the delivery metrics panel (defects before build, questions batched, time to exportable sheet) and a minimal **audit trail viewer**. Context routers: `process/context/all-context.md`, `process/context/product-domain.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`; memory rules: DATA-MODEL sections 2.3 and 4.

Confirmed decisions in force: Accept on a digitization-blocking finding keeps the gate **Blocked until counsel answers** (also on a blocking finding, Accept alone never opens the gate); AC22 states unresolved = open, unanswered, `unclear`, Awaiting counsel, or unconfirmed `dismissed_reconfirm`. **UI contract (supplement 2026-10-17):** the counsel route is now approved in `design/mockups/app.html` (`#counsel`) + `app_NOTES.md`, and `design/mockups/counsel-sheet.html` + `counsel-sheet_NOTES.md` exists (verified, trial mockup, pre-sidebar layout). Step A0 is therefore a **conformance check** (counsel UI vs app.html `#counsel`, with counsel-sheet.html as the detail reference for the question card, answer controls, wording editor and the Awaiting/Already-answered collapsed section), not a new mockup. **SPEC wins on any conflict** with the mockups. User-approved decisions locked for this phase (umbrella D-1..D-3): D-1 the DOCX contains only unanswered New/Accepted questions, recorded answers are shown in the app only (a recorded deviation from the AC21 wording "answers shown beside each question", see AC21 row); D-2 a clear counsel answer on a `dismissed_reconfirm` item counts as the re-confirmation; D-3 in-app answering of Awaiting-counsel items is in scope. See `## Locked Decisions (PLAN-SUPPLEMENT 2026-10-17)` and `## Inner Loop Refresh Note`.

## Phase Completion Rules

- CODE DONE = core, web, integration tests committed.
- VERIFIED = Exit Gate green against the **real local Worker** (no stub), validate-contract written, regression: Phases 01–07 key suites green. Real-D1 behavior is proven locally under pool-workers; the deployed check is Phase 10.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC20 | Counsel sheet drafted and editable; no-AI template draft; AI draft recorded/cached; excludes Already answered/Awaiting counsel | `counsel-sheet-draft-edit-e2e` (spec `counsel-sheet`, both modes) + `counsel-draft` (web unit, mask/clamp/fallback) + `sheet-contents` (core) | Fully-Automated (no-LLM) + Hybrid (AI draft: recorded response in CI) | Drafts persist in IndexedDB; L6 mask + clamp of `drafts[].text` |
| AC21 | DOCX export has every unanswered New/Accepted question, citation, interpretations; recording an answer sets Answered and writes memory; sheet contains only New and Accepted. **Deviation (D-1, user-approved):** recorded answers (A/B/C, note, who, when) are shown in the app, not in the DOCX; the DOCX lists only unanswered questions (an answered question no longer needs counsel) | `counsel-export-contents` (web: build DOCX, parse back with mammoth) + `counsel-answer` (e2e, record flow incl. memory write) | Fully-Automated | AC21 wording deviation recorded in the report and umbrella decision log |
| AC22 | Gate strict: Blocked with linked reasons while any critical item unresolved; Ready only when all resolved. Critical-only; AI-detector findings never gate (explicit `detector_kind === 'ai'` exclusion, L4); high `dismissed_reconfirm` shows its label but does not gate (documented deviation vs DATA-MODEL line 234, which says "blocking finding"; SPEC AC22/AC48 say critical) | `gate-state-matrix` (core, full matrix: status x counsel answer x label x severity x detector kind) + `gate` (e2e) | Fully-Automated | — |
| AC25 | No-LLM mode complete: every sample processes; structure, findings, diff, template counsel sheet, gate work; zero uncaught errors | `no-llm-full-corpus-run` (all samples; scans open as page images) | Fully-Automated | final run in P10 |
| AC44 | Finding dismissed at fund I appears in "Previously handled (n)" for identical passage at fund II, with reason and fund I name | `memory-no-reflag-e2e` | Fully-Automated | — |
| AC45 | Counsel answered at fund I → fund II shows Already answered with prior answer; not in exported sheet; Awaiting counsel also not re-sent | `memory-prior-answer-not-reasked-e2e` (parse DOCX: zero repeated questions) | Fully-Automated | — |
| AC48 | Blocking defects never hidden: stays in main list labeled "Dismissed in [old fund], re-confirm"; gate unresolved until re-confirmed | `memory-blocking-never-hidden-e2e` + `gate-with-reconfirm-state` | Fully-Automated | — |
| AC64 | Per-document metrics: defects before build = non-AI findings not dismissed as false alarm at export time; questions batched = sheet question count (target one round); time = export timestamp minus `t0` (start time captured at the top of `openDocument` in `state/review.ts`, written to Dexie `uiState` `metrics:{docHash}` once the doc hash exists after analysis; t0 is rewritten on each open until an export is recorded; only the first export is measured) | `metrics` (core unit: definitions) + `document-metrics-panel-e2e` (spec `metrics`) | Fully-Automated | Definitions recorded in the report |

Closing verification for: AC6 (real API persistence), AC43 (integrated), AC46 (`memory-edit-is-new-e2e`), AC47 (browser `memory-no-cross-firm-or-workspace-e2e`), AC49 (real data), AC55 (`audit-trail-append-only-e2e` via viewer), AC56 (`sandbox-isolation-e2e` two browser contexts), AC57 (`demo-workspace-seeded-effects-e2e`, `demo-workspace-not-polluted-e2e`), AC59/AC60 interim runs (proven by `memory-prior-answer`: it asserts the fund II needs-action reduction from `fixtures/memory/fund-expectations.json` `summary` (fund II 8 findings, 5 handled, 3 need action, `fewer_to_review_pct` 62.5, >= 50) and the numbers are copied into the report; strategy: Fully-Automated; the fixture supports it, so no residual). AC59/AC60 final runs stay in Phase 10.

## Entry Gate

- Phases 03, 04b, 05, 07 verified (Phase 02 fixtures: fund I/II/Y, demo seed spec).
- Do NOT run `pnpm seed:gen` (it would rewrite the Phase 04b/10-owned committed `apps/worker/seed/demo.sql`, which worker baselines such as `demo-seed-copy-effects` pin). `pnpm seed:check` must stay green on the committed file. The local D1 for `stack-memory` is seeded by `scripts/src/dev-seed.ts` from `fixtures/memory/demo-seed-spec.json` into a throwaway persist dir (see touchpoints).

## Library pins (confirm via vc-docs-seeker in Phase 00)

docx (`Document`, `Packer.toBlob`/`toBuffer`, tables, numbering), mammoth (`extractRawText`, used to parse the exported DOCX back in tests), Dexie, Zustand, TanStack Table, Playwright (multiple browser contexts), zod.

## Touchpoints (create/modify)

```
CORE (new, owned): packages/core/src/counsel/{gate.ts,sheet.ts,template-draft.ts,metrics.ts,types.ts}   barrel append in packages/core/src/index.ts
   (no export-docx.ts in core: DOCX export moves to web, see Locked Decisions D3; docx is a web dependency and core has no docx dependency)
CORE tests: packages/core/test/unit/counsel/{gate-state-matrix,sheet-contents,metrics}.test.ts (+ property/counsel for gate monotonicity)
WORKER (additive, L5): apps/worker/src/proxy/pipeline.ts (result frame meta, two sites: cache-hit frame ~L288 and miss frame ~L390; values from `rules` selected at ~L246-252)
   apps/worker/test/llm/rules-echo.test.ts
   (frames.ts `meta` is already `z.record(...).optional()`: NO frozen contract change)
WEB API (extended, Phase 03/05 files): apps/web/src/api/{memoryApi.ts (interface freeze S0), stubMemoryApi.ts (extended), client.ts (switch via apiEnabled()), http.ts (reuse)}
   new: apps/web/src/api/{realMemoryApi.ts,outbox.ts}  tests: apps/web/test/{api-contract,outbox,realMemoryApi,review-sync,counsel-export-contents,counsel-draft}.test.ts
WEB storage: apps/web/src/storage/db.ts  (Dexie version 2 ONLY if runs + metrics tables are needed; else reuse uiState rows `run:{key}` / `metrics:{docId}`; decision at S0)
WEB state: apps/web/src/state/{review.ts (decide/question/export wiring, optimistic ids; `openDocument` t0 capture, see G11), session.ts (replace ANALYST_NAME, bootstrap, `useSession().readOnly` accessor)}; apps/web/src/shell/AnalystBadge.tsx (reads session name)
WEB features: apps/web/src/features/review/gateInterim.ts (thin re-export of core computeGate), apps/web/src/features/review/** (labels with real data, prior-answer display)
   apps/web/src/features/counsel/** (screen, card, editor, answer controls, export dialog, exportDocx.ts with lazy import('docx'))
   apps/web/src/features/gate/** (popover reasons + re-confirm flow)   apps/web/src/features/metrics/**   apps/web/src/features/audit/AuditList.tsx (reusable; 08b mounts it as a tab, no nav item)
   apps/web/src/features/ai/stream-client.ts (Phase 05 file: add narrow optional `task` param; default stays 'clause-judgment')
   apps/web/src/features/registry.ts (seam: append id:'counsel' real view)   apps/web/src/lib/download.ts (frozen: `downloadBlob(filename: string, data: string | Blob, mime: string): void`; Phase 09 uses it too: whoever lands first creates it, the second must not narrow it; the object URL is revoked after a tick)
   (t0 is captured in `state/review.ts openDocument`, NOT in `features/open-document`: no open-document edit)
   apps/web/test/import-graph.test.ts (ALLOWED set additions only: `computeGate`, the sheet builder, the template draft builder, the metrics functions, `sensitiveSpans`; exact export names confirmed against `packages/core/src/index.ts` at S0)
WEB manifests: apps/web/package.json (mammoth as devDependency; script `test:e2e:stack-memory`), pnpm-lock.yaml (single writer, serialized after Phase 06/07 landings)
E2E: apps/web/e2e/{counsel-sheet,counsel-answer,counsel-export,counsel-gate,metrics,memory-no-reflag,memory-prior-answer,memory-edit-is-new,memory-blocking-never-hidden,memory-no-cross-firm}.spec.ts   (project `preview`, extended stub; the gate spec is `counsel-gate.spec.ts` because the token `gate` also matches the existing `gate-pill.spec.ts`; `memory-no-cross-firm.spec.ts` is the preview twin of `stack-memory-memory-no-cross-firm`)
   apps/web/e2e/stack-memory-{sandbox-isolation,demo-workspace,audit-trail-append-only,memory-no-cross-firm,roundtrip}.spec.ts   (project `stack-memory`)
   apps/web/e2e/no-llm-corpus.spec.ts (also gate via `pnpm --filter @aduin/core test:corpus`)
   repairs: apps/web/e2e/{placeholder-routes,app-shell}.spec.ts, apps/web/src/smoke.test.tsx (counsel route is no longer a placeholder)
   apps/web/playwright.config.ts (new project `stack-memory`, port 8788; `wantsStack` tightened to `/--project[= ]stack(?![-\w])/` plus a `wantsStackMemory` twin; `preview` `testIgnore` gains `stack-memory-.*\.spec\.ts`; `stack-memory` has its own `testMatch` and baseURL `http://127.0.0.1:8788`; the preview webServer stays first so the plain-mode SPA is produced after the e2e-mode bundle)
INFRA: scripts/src/dev-seed.ts (generates random per-run `COOKIE_SIGNING_KEYS` (JSON `{kid: string >= 32 bytes}`) and `COOKIE_SIGNING_KID`, applies migrations 0001-0005 and the seed SQL from the exported `buildDemoSeedSql(spec, PHASE02_SPEC)` over `fixtures/memory/demo-seed-spec.json` into a recreated throwaway persist dir under `apps/worker/.wrangler/`, then spawns `wrangler dev --local --persist-to <dir> --port 8788 --var ...` with an argv array; nothing printed or committed; no `.dev.vars` is ever created; self-check that the D1 contains sd01-sd03 plus proposed sr01, which Phase 08b relies on), root package.json script `dev:stack:seeded`, apps/worker/package.json script `dev:e2e`; the `stack-memory` webServer uses `reuseExistingServer: false`; `seed:gen` is NOT run and `apps/worker/seed/demo.sql` is untouched (`seed:check` stays green)
DESIGN: design/mockups/counsel-sheet.html (exists, reference); app.html #counsel (conformance target)
BACKLOG: process/general-plans/backlog/phase08-version-drift-questions_NOTE_17-10-26.md (written at EXECUTE)
HARNESS: process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-08/{adversarial-validation,context-snippets,review-decision,risk-gate,verification}.json (precedent harness/phase-05, same validator schema)
```
Edits to Phase 03/04a/04b/05/06/07-owned files are limited to the lines named above and documented in the report. No frozen core contract changes (confirm via the contracts snapshot test, unchanged).

## Public Contracts

- **Gate (core, pure):** `computeGate(findings, states, labels) -> {status: 'ready'|'blocked', reasons: [{findingKey, kind: open|unanswered|unclear|awaiting_counsel|reconfirm_required, link}]}` in `packages/core/src/counsel/gate.ts`. Critical-only (high never gates). **Explicit L4 exclusion:** a finding with `detector_kind === 'ai'` never gates, regardless of status or label; there is no "promoted AI" concept (an analyst who wants an AI finding to block raises it through counsel, not through promotion). `apps/web/src/features/review/gateInterim.ts` becomes a thin re-export of the core function and types (same shape as today; `gate-interim.test.ts` keeps passing). Interim rules kept: Accept alone = `unanswered` (Blocked); a clear A/B/C counsel answer resolves; `unclear` = `unclear`; Needs counsel = `awaiting_counsel`; a critical `dismissed_reconfirm` finding stays `reconfirm_required` until a new decision or a clear counsel answer (D-2); high `dismissed_reconfirm` shows the label but does not gate.
- **Sheet inclusion (core):** label `new` OR (status accepted AND needs-counsel); `answered`/`unclear` returns as New; `already_answered`, `awaiting_counsel`, `previously_dismissed` are excluded. Gate and sheet reasons link to the same finding key.
- **MemoryApi (web, frozen at S0 before parallel work):** `apps/web/src/api/memoryApi.ts` gains, beyond today's lookup/decide/answer/revoke/firmRules: `bootstrap(name) -> {workspace_id, analyst_id, kind, expires_at, read_only}` (maps the session response); `ensureRun(input) -> {run_id}`; `storeFindings(runId, findings)` (client chunks of 25; core `limits.findingsChunk` stays 50, the Worker `FINDINGS_CHUNK_MAX` is 25: W13 note); `createQuestions(runId, items)`; `answer(...)`; `exportRun(runId, {question_count})`; `health()`. **Pinned 08b signatures (08b only consumes them):** `firm(lawFirmId)`, `listRules(lawFirmId)`, `createRule(lawFirmId, text)`, `approveRule(id)`, `rejectRule(id)`, `revokeRule(id, text)`, `revoke(decisionId, reason)`, `audit(cursor?) -> {events, next_cursor}` (page size 100). `MemoryApiError` carries `code`, `reason`, `status`, `retryAfterUtc?`, `current?`. A named read-only accessor `useSession().readOnly` is exported from `state/session.ts`. `client.ts` re-evaluates the selected client whenever the API base changes (e2e `setApiBase`).
- **Wire field shapes (verified against Worker route schemas; confirm at S0):** export body `{client_op_id, question_count}`, response `{ok, run_id, sheet_exported_at, sheet_question_count}`. Answer body `{client_op_id, question_id, option, note?, quote_text, fingerprint}`: no `run_id`; the web `counsel_option`/`counsel_note` map to `option`/`note`; firm and class come from the question row. Decide body requires `run_id` and a `pattern_key` matching `^[a-z0-9:#>-]{1,80}$` and drops `law_firm_id`, `section_path`, `quote_snippet`, `decided_by_name`. `createQuestions` needs a persisted finding, a non-null firm and 1-6 `interpretations` of 1-500 chars. A `client_op_id` is never reused across actions (400 `op_reused`).
- **Error mapping (code + reason + status):** wire codes `read_only_demo`, `invalid_session` (401), `conflict_active_decision` (409 + `current`), `invalid_request` with reasons `run_required`, `firm_required`, `run_not_found`, `question_not_found`, `pattern_key`, `op_reused`, `id_charset`, `rule_state`, `rule_not_found`, `decision_not_found`; 422 `fingerprint_mismatch`; 429 `rate_limited` vs `quota_exhausted` classified by code + reason + status (reasons `memory_write_budget`, `workspace_*`, `session_limit`); 503 `memory_unavailable`. Client `MemoryApiError.code` values map from these (`read_only`, `unauthorized`, `conflict`, `run_required`, `rate_limited`, `fingerprint_mismatch`, etc.). `DecideInput`/`AnswerInput` gain `run_id`, `quote_text`, `question_id` (where the Worker schema requires them: confirm against `packages/core/src/contracts/memory.ts` at S0). `MemoryApiError.code` extends to: `read_only`, `rate_limited` (with `retryAfterUtc`), `conflict` (with `current`), `run_required`, `unauthorized`, `fingerprint_mismatch` plus the existing three. **Phase 08 owns ALL methods including those Phase 08b needs** (08b only consumes them).
- **Implementations:** real fetch client `realMemoryApi.ts` and the extended `stubMemoryApi.ts` (Dexie, same interface, for the preview project and offline demo). Selection in `client.ts` via `apiEnabled()` from `api/base.ts` (NOT an `API_MODE` flag; the plan's earlier `API_MODE=real|stub` is dropped). A shared contract test `api-contract` runs the same cases against both implementations (real one against an in-process fake `fetch` that mirrors Worker status codes).
- **Outbox (`apps/web/src/api/outbox.ts`):** uses the existing Dexie `outbox` table (schema v1: `++seq, createdAt`); states `queued -> sending -> synced | retry(backoff) | deferred | rejected`; every mutating call carries an idempotent `client_op_id`; 409 refreshes the active decision in the UI; 422 (`fingerprint_mismatch` and other validation) is a hard error, op `rejected`, never retried; 429 `memory_write_budget` or `workspace_*` limits set `deferred` and retry after the next UTC day (N14/W12); a lookup failure shows "Memory unavailable" and labels every finding New (safe direction); one quiet "unsynced" chip shows queued+retry+deferred count. `decide` returns an optimistic `pending:<op>` id that is mapped to the real decision id when the op drains; revoke of a still-pending op cancels it (never sent) or, if already `sending`, queues after it. The read-only demo session (`read_only` from the session response, never from the cookie) disables writes and skips the outbox. Outbox ops store the document key and finding keys and resolve `run_id` at send time.
- **Session bootstrap:** the analyst name defaults to `Linh Tran` (the current `ANALYST_NAME`, approved mockup name) and the name prompt never blocks the shell: it is an inline, dismissible edit on the sidebar `analyst-name` badge that keeps the default; the stored name (Dexie `uiState`) feeds `bootstrap(name)` (`analyst_name` 1-80 chars, trimmed) and `decided_by_name`; `app-shell.spec.ts` (line ~100 expects `Linh Tran`), `slice.spec.ts` and all existing preview specs stay green unchanged (proven by E15 whole preview e2e + `pnpm slice:check`). When `apiEnabled()` it calls `POST /api/session` (idempotent for a live sandbox; cookie never read by JS) and stores the name; bootstrap always precedes the first `lookup`; a 401 `invalid_session` triggers re-bootstrap plus one retry (never "Memory unavailable"); `read_only` comes from the session response, not the cookie; the read-only demo opens with writes disabled. `ANALYST_NAME` constant in `state/session.ts` is replaced by the session name (stub mode keeps a local name prompt).
- **Run lifecycle:** `ensureRun` is lazy, on the first write action (decide, question, export), never at open. Dedupe key `law_firm_id + doc_hash + settings_hash` is cached in Dexie as `run:{workspace_id}:{key} -> run_id` plus the set of stored finding ids; the cache and stored-finding sets are cleared when the workspace changes (no foreign run id is ever reused). Re-analysis with the same key reuses the run and sends only the **delta** (new finding ids, including late AI findings); a different `settings_hash` creates a new run. `ensureFindingPersisted(ids)` runs before decide/question/export. **Duplicate-id behavior (verified in Worker code, `apps/worker/src/memory/repo/finding.ts`): the finding insert is `INSERT OR IGNORE`, so storing an id twice is idempotent and returns a lower `stored` count; BUT `POST /api/runs/:id/findings` claims `rows.length` write units before the insert (runs.ts `claimWrite(ctx,'fnd',rows.length)`), so duplicates still burn the daily write budget. The client therefore skips ids already recorded as stored.**
- **Answer recording:** A/B/C/unclear + note + who + when; writes counsel_answer + superseding `answered` decision in one Worker batch; finding becomes Answered; `unclear` keeps critical items unresolved. Needs-counsel questions are created in one `createQuestions` batch at export or answer time (not per click). **No-firm documents:** the Worker refuses decisions and questions without a firm (`firm_required`), so triage stays local-only, `createQuestions`/`answer` persistence is skipped, export still works (run with `law_firm_id: null`, `question_count` recorded), and the UI shows the note "memory needs a law firm tag".
- **DOCX export (web, `features/counsel/exportDocx.ts`):** lazy `import('docx')`; content: title, firm/fund/version, one numbered question per **unanswered** New/Accepted finding with clause citation (location + quote, masked, <= 1000 chars), interpretations A/B/C, answer line (blank for counsel). Order: `createQuestions` batch, build DOCX, `POST /api/runs/:id/export` (records `sheet_exported_at`, `sheet_question_count`, audit row), then download via `downloadBlob`. Any failure leaves the sheet editable (no partial state shown as exported). Quote masking uses `mask(text, sensitiveSpans(text))` (core allow-listed for the main thread via the import-graph ALLOWED edit). Verified by parsing the output back with mammoth in a web unit test.
- **AI draft:** `stream-client.ts` gains an optional `task` argument (default `clause-judgment`) so `counsel-draft` can use the same transport; drafts are masked and clamped (L6: mask sensitive values, clamp `drafts[].text` length to the sheet wording cap) before they reach the drafts UI; template draft is the fallback when AI is off or unavailable; provenance chip "AI suggestion".
- **L5 rules echo (Worker, additive):** `meta.rules_hash8` (first 8 chars of the injected `rules.hash`, `'none'` when no rules) and `meta.rules_applied` (count of injected rules) on the AI result frame (hit and miss). The client compares with the rules it holds; on mismatch it re-reads `firmRules` on Retry. No contract schema change (`meta` is an open optional record).
- **Metrics:** as in the AC64 row; browser clock for local display, server `sheet_exported_at` recorded. t0 is captured at the top of `openDocument` (before analysis), written to `uiState` `metrics:{docHash}` once the hash exists, rewritten on each open until an export is recorded; only the first export is measured.

## Blast Radius

`packages/core/src/counsel/**` + barrel, core tests, `apps/worker/src/proxy/pipeline.ts` (meta echo only) + `apps/worker/test/llm/rules-echo.test.ts`, `apps/web/src/{api,state,storage (conditional),shell/AnalystBadge,features/{counsel,gate,metrics,audit,review (re-export + labels),ai/stream-client,registry},lib/download}`, `apps/web/test/import-graph.test.ts` (ALLOWED additions only), e2e specs + `playwright.config.ts` + repairs, `scripts/src/dev-seed.ts`, root/worker/web manifests (scripts, mammoth devDependency), lockfile. Seam files `features/registry.ts`, `smoke.test.tsx`, `placeholder-routes.spec.ts` are also edited by Phases 07 and 09: Phase 08 appends `counsel` after whatever the last registry entry is at EXECUTE time, edits only its own row, and derives expected arrays from the live registry where possible. Registry `## Phase 08` revised (see `### Registry update request (Phase 08)`). Auth/session, memory writes and export are high-risk classes: evidence pack required.

## Data Flow

Session bootstrap (before any lookup) -> open document -> `t0` captured at the top of `openDocument`, `metrics:{docHash}` written once the hash exists -> findings -> fingerprints (core `fingerprintFor`) -> `lookup` (read, no run needed) -> labels -> UI lists. First write action -> `ensureRun` (dedupe key cached as `run:{workspace_id}:{key}`; outbox resolves `run_id` at send time; no-firm documents stay local-only and only export runs with `law_firm_id: null`) -> `ensureFindingPersisted(ids)` (chunks of 25, skip already stored) -> `decide` via outbox (`client_op_id`, optimistic `pending:<op>` id) -> Worker D1 batch -> audit. Counsel: sheet builder (core, pure) -> draft (template, or AI through `task: 'counsel-draft'`) -> analyst edits (drafts in IndexedDB) -> export: `createQuestions` batch -> DOCX (lazy `docx`) -> `POST /api/runs/:id/export` -> `downloadBlob`. Answer: `answer` (outbox) -> counsel_answer + `answered` decision -> memory. Next fund of the same firm: `lookup` returns active decisions -> Previously handled / Already answered / Awaiting counsel / reconfirm; sheet builder excludes the first three kinds, gate treats Awaiting and reconfirm of critical items as unresolved.

## Failure Modes

Worker unreachable: outbox queues, "unsynced" chip, lookup failure shows "Memory unavailable" and all findings New. 409: UI shows the current decision and refreshes. 422 (`fingerprint_mismatch` etc.): hard error, op `rejected`, finding keeps its local state and shows the message. 429 `memory_write_budget`/`workspace_*`: op `deferred` to the next UTC day, chip says so. 403 `read_only_demo`: writes disabled up front from the session response, outbox skipped. 401 `invalid_session`: re-bootstrap and retry once, not "Memory unavailable". No firm: decisions/questions stay local, export still works. 429 is classified `rate_limited` vs `quota_exhausted` by code + reason + status. 400 `op_reused`: never reuse a `client_op_id` across actions. `run_required`: client calls `ensureRun` then retries once. DOCX generation failure or export POST failure: message, sheet stays editable, nothing marked exported. AI draft unavailable or rules echo mismatch: template draft / re-read rules on Retry. Late AI findings after a run exists: sent as delta on next write. Duplicate finding ids never error (INSERT OR IGNORE) but cost budget: skipped client-side.

## Implementation Checklist

Sections run in the order S0 -> S1 -> S2 -> S3 -> review -> EVL. Per-section test gates run at the end of each section (commands in `## Test Gates`).

### S0 - Interface freeze (single opus agent; blocks S1)
- [x] S0.1 Extend `apps/web/src/api/memoryApi.ts` with the frozen method set (including the pinned 08b signatures, `MemoryApiError` fields `code/reason/status/retryAfterUtc?/current?`, the wire field shapes and error mapping table) from `## Public Contracts`; confirm each input field against `packages/core/src/contracts/memory.ts` and the Worker route schemas (`apps/worker/src/routes/memory/*.ts`); no behavior yet (types and the shared fake-fetch fixture only).
- [x] S0.2 Freeze `packages/core/src/counsel/types.ts` (gate and sheet types, `computeGate` signature with `detector_kind`; E13: `GateFinding.detector_kind` is optional and defaults to `'rule'` so existing `gate-interim.test.ts` calls keep passing; `gateInterim.ts` keeps exporting `gateInterim`, `GATE_REASON_TEXT`, `TriageStatus`, `GateReasonKind`, `GateFinding`, `GateState`, `GateReason`, `GateResult`; check new core type names against the core barrel for `export *` collisions), the outbox state union, the `downloadBlob(filename: string, data: string | Blob, mime: string): void` in `apps/web/src/lib/download.ts` (create it if absent; if Phase 09 landed it, reuse and never narrow it; revoke the object URL after a tick), the exact core export names needed for the `import-graph` ALLOWED edit (E-G6), and decide the Dexie question: runs + metrics tables (version 2, note the bump) vs `uiState` rows (default: `uiState` rows `run:{key}`, `metrics:{docId}`, no version bump).
- [x] S0.3 Verify and record in the report: duplicate-finding-id idempotence (INSERT OR IGNORE, budget still claimed; already established in this plan) and the Worker 25 vs core 50 chunk note (W13).

### S1 - Parallel opus subagents on disjoint directories (after S0)
- [x] S1.core (core counsel): `counsel/gate.ts` (critical-only, explicit `detector_kind === 'ai'` exclusion L4, high `dismissed_reconfirm` does not gate, D-2 answer re-confirms), `sheet.ts`, `template-draft.ts`, `metrics.ts`, barrel append; tests `gate-state-matrix` (full matrix status x counsel answer x label x severity x detector kind), `sheet-contents`, `metrics`; red-first stubs below.
- [x] S1.worker (L5): add `meta: {rules_hash8, rules_applied}` to both AI result-frame sites in `apps/worker/src/proxy/pipeline.ts` (hit ~L288 and miss ~L390; OCR frames unchanged); test `apps/worker/test/llm/rules-echo.test.ts` (hit and miss, with and without rules, `'none'`); confirm `contracts/frames.ts` unchanged.
- [x] S1.web-client (done 2026-10-17, see REPORT "S1-client"): `realMemoryApi.ts`, extended `stubMemoryApi.ts`, `client.ts` switch via `apiEnabled()`, `outbox.ts` (states, backoff, deferred-to-next-UTC-day, 409/422 handling, optimistic ids, revoke-of-pending), run lifecycle helper (`ensureRun`, `ensureFindingPersisted`, dedupe cache, delta send, skip stored ids), session bootstrap before the first lookup, 401 re-bootstrap + retry, `read_only` from the session response, `run:{workspace_id}:{key}` cache cleared on workspace change, outbox ops storing document + finding keys with `run_id` resolved at send time, `client.ts` re-evaluating the client when the API base changes; tests `api-contract` (both implementations), `outbox` (flaky fake), `realMemoryApi`.
- [x] S1.e2e-infra: `scripts/src/dev-seed.ts` (random per-run cookie keys, argv-array spawn of `wrangler dev --local --persist-to <dir> --port 8788 --var ...`, `buildDemoSeedSql(spec, PHASE02_SPEC)` into the throwaway persist dir, no `seed:gen`, no `.dev.vars`, self-check that the D1 contains sd01-sd03 plus proposed sr01), root script `dev:stack:seeded` (E14: builds the plain-mode web SPA via `pnpm --filter @aduin/web build` before `dev-seed.ts` starts wrangler, since the Worker serves the SPA as assets; never the e2e mode), worker script `dev:e2e`, Playwright project `stack-memory` in `apps/web/playwright.config.ts` (port 8788, `reuseExistingServer: false`, `wantsStack` tightened and `wantsStackMemory` added, `preview` `testIgnore` extended, own `testMatch`/baseURL, preview webServer first), unique `cf-connecting-ip` per browser context via `extraHTTPHeaders` (per-IP session cap is 5; verified here that local wrangler honors it; fallback: one shared storageState with at most 5 sessions), first assertion proves a session mints, web script `test:e2e:stack-memory`. Probe results go in the report before the five stack-memory specs are written.

### S2 - Integration (single opus agent; after S1)
- [x] S2.1 `apps/web/src/state/review.ts`: replace the swallowing `decide`; optimistic ids; use outbox + run lifecycle; replace `ANALYST_NAME` with the stored session name that defaults to `Linh Tran` (non-blocking inline edit on the `analyst-name` badge, dismissible, default kept; feeds `bootstrap(name)` and `decided_by_name`; `app-shell.spec.ts`, `slice.spec.ts` and every existing preview spec stay green unchanged, proven by E15 whole preview e2e + `pnpm slice:check`); capture t0 at the top of `openDocument` and write `metrics:{docHash}` once the hash exists (no `features/open-document` edit); `gateInterim.ts` -> thin re-export of core; add the ALLOWED imports to `apps/web/test/import-graph.test.ts`; test `review-sync`.
- [x] S2.2 Counsel UI `features/counsel/**` per app.html `#counsel` (A0 conformance check recorded: header gate line, one row per question, expand for quote/options/provenance/inline wording edit/Record answer, collapsed "Already answered (n) · Awaiting counsel (n)", Export DOCX opens a preview of unanswered New/Accepted only); drafts persisted in IndexedDB; template default + AI draft toggle with "AI suggestion" chip via the `task` param in `stream-client.ts`; L6 mask + clamp (`mask(text, sensitiveSpans(text))`); template fallback; no-firm note "memory needs a law firm tag"; test `counsel-draft`; append `id:'counsel'` to `features/registry.ts` after the last entry at EXECUTE time.
- [x] S2.3 `features/counsel/exportDocx.ts` (lazy `import('docx')`), `lib/download.ts` usage, order createQuestions -> build -> export POST -> download; test `counsel-export-contents` (mammoth devDependency in `apps/web/package.json`).
- [x] S2.4 `features/gate/**` popover reasons + re-confirm flow (D-2); `features/metrics/**` panel (reads `metrics:{docHash}`, first export only); `features/audit/AuditList.tsx` presentational `AuditList({events, loading?, onMore?})` (no fetching inside; the caller uses `audit(cursor)`), no nav item.
- [x] S2.5 Repair `apps/web/e2e/placeholder-routes.spec.ts`, `apps/web/e2e/app-shell.spec.ts`, `apps/web/src/smoke.test.tsx` for the counsel route being real: edit only the `counsel` row, derive the expected arrays from the live registry where possible, anchor edits by symbol (Phases 07 and 09 edit the same files). EXECUTE starts only after Phase 06 is committed and Phase 07 is verified.

### S3 - E2E specs (after S2; may split across two agents by spec file)
- [x] S3.1 Preview project (extended stub): `counsel-sheet`, `counsel-answer`, `counsel-export` (parse exported DOCX: zero repeated questions for AC45), `counsel-gate`, `metrics`, `memory-no-reflag`, `memory-prior-answer` (also asserts the interim AC59/AC60 fund II reduction from `fixtures/memory/fund-expectations.json` `summary`), `memory-edit-is-new` (Section 4 -> 5), `memory-blocking-never-hidden`, `memory-no-cross-firm` (preview twin).
- [x] S3.2 `stack-memory` project (real Worker, seeded local D1): `stack-memory-sandbox-isolation` (two browser contexts), `-demo-workspace` (seeded effects, not polluted), `-audit-trail-append-only`, `-memory-no-cross-firm` (firm Y), `-roundtrip` (decide -> reload -> lookup -> label).
- [x] S3.3 `no-llm-corpus` (e2e, preview) and `pnpm --filter @aduin/core test:corpus`; interim AC59/AC60 numbers (from `memory-prior-answer`) copied into the report (final in Phase 10).
- [x] S3.4 Write backlog stub `process/general-plans/backlog/phase08-version-drift-questions_NOTE_17-10-26.md` (version-drift counsel questions from Compare diff-only rows: out of scope here; Needs counsel from Compare stays as Phase 07 built it).

### Review and closeout
- [ ] R1 Sonnet security and code review (STRIDE on session/identity, memory writes, export; secrets; masking; cross-firm); fix cycle if needed.
- [ ] R2 High-risk evidence pack in `harness/phase-08/` (five JSON files, exact validator schema as `harness/phase-05`), then run `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-08` and quote 0 failures.
- [ ] R3 EVL by a spawned vc-tester re-running the validate-contract gates; phase report; `process/context/{worker,tests,engine,ui}` updates at UPDATE PROCESS.

## Test Gates (commands created in this phase)

All commands are the no-double-dash form (pnpm 11.13.1 passes `--` literally); one token per call; web e2e tokens match spec file names.

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| gate matrix | `pnpm --filter @aduin/core test gate-state-matrix` | Fully-Automated | AC22 (incl. L4 AI exclusion, D-2, high reconfirm) |
| sheet contents | `pnpm --filter @aduin/core test sheet-contents` | Fully-Automated | AC20, AC45 (exclusion) |
| metrics (core) | `pnpm --filter @aduin/core test metrics` | Fully-Automated | AC64 (definitions) |
| rules echo | `pnpm --filter @aduin/worker test rules-echo` | Fully-Automated | L5 (supporting AC20 AI draft correctness) |
| api contract | `pnpm --filter @aduin/web test api-contract` | Fully-Automated | AC6, AC43 (stub and real parity) |
| outbox | `pnpm --filter @aduin/web test outbox` | Fully-Automated | AC6 (idempotent write-back, failure modes) |
| real client | `pnpm --filter @aduin/web test realMemoryApi` | Fully-Automated | AC6, AC47 |
| review sync | `pnpm --filter @aduin/web test review-sync` | Fully-Automated | AC43, AC22 |
| export contents | `pnpm --filter @aduin/web test counsel-export-contents` | Fully-Automated | AC21, AC45 (zero repeated questions) |
| draft | `pnpm --filter @aduin/web test counsel-draft` | Fully-Automated (recorded) + Hybrid (live AI draft: manual, free model only, APPROVED-LIVE) | AC20 |
| e2e sheet | `pnpm --filter @aduin/web test:e2e counsel-sheet` | Fully-Automated + Hybrid | AC20 |
| e2e answer | `pnpm --filter @aduin/web test:e2e counsel-answer` | Fully-Automated | AC21 |
| e2e export | `pnpm --filter @aduin/web test:e2e counsel-export` | Fully-Automated | AC21, AC45 |
| e2e gate | `pnpm --filter @aduin/web test:e2e counsel-gate` (spec `counsel-gate.spec.ts`; the token `gate` is NOT used because it also matches `gate-pill.spec.ts`) | Fully-Automated | AC22, AC48 |
| e2e metrics | `pnpm --filter @aduin/web test:e2e metrics` | Fully-Automated | AC64 |
| e2e memory (5 calls, one token each; `memory-prior-answer` also proves interim AC59/AC60) | `pnpm --filter @aduin/web test:e2e memory-no-reflag`, `... memory-prior-answer`, `... memory-edit-is-new`, `... memory-blocking-never-hidden`, `... memory-no-cross-firm` (preview, extended stub); the real-Worker twin of the cross-firm case is `stack-memory-memory-no-cross-firm` | Fully-Automated | AC44, AC45, AC46, AC47, AC48 |
| stack-memory | `pnpm --filter @aduin/web test:e2e:stack-memory` (all five specs; one spec per call: append `sandbox-isolation`, `demo-workspace`, `audit-trail-append-only`, `memory-no-cross-firm` or `roundtrip`). Precondition: none beyond the project webServer, which runs `dev-seed.ts` (random per-run cookie keys, no `.dev.vars`, recreated seeded persist dir, `reuseExistingServer: false`); first assertion proves a session mints | Hybrid (local stack precondition) | AC55, AC56, AC57, AC47, AC49 |
| no-LLM corpus | `pnpm --filter @aduin/web test:e2e no-llm-corpus` and `pnpm --filter @aduin/core test:corpus` | Fully-Automated | AC25 |
| evidence pack | `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-08` | Fully-Automated | high-risk evidence (AC6, AC22, AC47) |
| regression | whole web unit `pnpm --filter @aduin/web test`, whole web e2e `pnpm --filter @aduin/web test:e2e`, import-graph (`pnpm --filter @aduin/web test import-graph`), contracts snapshot unchanged (`pnpm --filter @aduin/core test contracts`), `pnpm --filter @aduin/worker test` (full), `pnpm --filter @aduin/core test:golden`, `pnpm slice:check`, `pnpm seed:check`, `pnpm guard:cf`, `pnpm secrets:scan` | Fully-Automated | earlier phases |

Known-Gap handling: live-model draft quality is Hybrid/manual only (never a PASS by itself); any behavior left on Known-Gap gets a backlog stub and its gate stays CONDITIONAL (vacuous-green ban). No frozen contract change is expected; the contracts snapshot test must stay unchanged.

Failing stubs for red-first: `should block the gate after Accept on a critical finding until counsel answers`, `should keep the gate blocked for an unclear answer`, `should never gate on an AI-detector finding`, `should show high dismissed_reconfirm label without gating`, `should exclude already answered and awaiting counsel findings from the sheet`, `should export a docx that contains every unanswered question and interpretation`, `should show Previously handled at fund II for a fund I dismissal`, `should show Dismissed in fund I re-confirm for a blocking finding`, `should treat Section 4 changed to Section 5 as new`, `should not apply Firm X decisions to Firm Y`, `should skip already stored finding ids when re-sending after re-analysis`, `should defer a 429 memory_write_budget op to the next UTC day`, `should map the optimistic pending id to the real decision id on drain`, `should include rules_hash8 in the AI result frame`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `counsel-sheet-draft-edit-e2e` | Fully-Automated + Hybrid | AC20 |
| `counsel-export-contents`, `counsel-answer-record-e2e` | Fully-Automated | AC21 |
| `gate-state-matrix`, `counsel-gate-e2e` | Fully-Automated | AC22 |
| `no-llm-full-corpus-run` | Fully-Automated | AC25 |
| `memory-no-reflag-e2e` | Fully-Automated | AC44 |
| `memory-prior-answer-not-reasked-e2e` | Fully-Automated | AC45, AC59/AC60 interim (fund II reduction from `fund-expectations.json`) |
| `memory-blocking-never-hidden-e2e`, `gate-with-reconfirm-state` | Fully-Automated | AC48 |
| `document-metrics-panel-e2e` | Fully-Automated | AC64 |
| `memory-edit-is-new-e2e`, `memory-no-cross-firm-or-workspace-e2e`, `sandbox-isolation-e2e`, `demo-workspace-*-e2e`, `audit-trail-append-only-e2e` | Fully-Automated | AC46, AC47, AC56, AC57, AC55 (closing) |
| `rules-echo` (worker), `api-contract`, `outbox`, `realMemoryApi`, `review-sync` | Fully-Automated | AC6, AC43 (write-back, integrated) |
| `counsel-draft` (recorded) / live AI draft | Fully-Automated + Hybrid (manual, free model) | AC20 |
| `stack-memory-roundtrip`, `stack-memory-*` | Hybrid (local seeded stack) | AC47, AC49, AC55, AC56, AC57 (real Worker) |
| `validate-risk-artifacts.mjs` on `harness/phase-08` | Fully-Automated | high-risk evidence pack (AC6, AC22, AC47) |

```bash
pnpm --filter @aduin/core test && pnpm --filter @aduin/web test:e2e && pnpm slice:check
# Expected: all exit 0 against the real local Worker and seeded D1
```

## Exit Gate

- All gates green against the real local Worker (`stack-memory` project) and the extended stub (preview project; selection by `apiEnabled()`); exported DOCX opened and parsed in tests; interim fund I/II results (findings needing action with vs without memory) recorded in the report.
- Phase report written; backlog stubs recorded for any Known-Gap (none may be left as a silent pass).

## Risks and Kill Criteria

- Fund II 50% reduction (AC59) depends on fixtures: if the interim result is < 50%, fix fixtures/memory logic (not thresholds) in this phase.
- D1 write budget (M1): decision batches ~10–12 rows; outbox batching avoids bursts.
- Stub-to-real semantic drift: all Phase 03 specs re-run against the real Worker.
- Schedule: if late, do not cut anything in this phase (all ACs here are P0).

## Cost / Secret Hygiene

AI draft path uses Phase 05 task with recorded responses in CI; any live call needs APPROVED-LIVE (free only); no paid calls; the browser never sees keys; DOCX contains only the analyst's own quotes (≤ 1000 chars each, masked for sensitive values); Cloudflare resources local only here.

## Rollback

`git revert` phase commits; build with `VITE_API_BASE=''` (preview/e2e mode, `apiEnabled()` false) to return to stub behavior; the Worker L5 meta edit is additive and revertable alone; D1 data is local.

## Blockers That Would Justify BLOCKED Status

- A Phase 04b endpoint cannot support a required flow (route a follow-up to 04b with a contract-change note).
- `docx` output cannot be parsed back reliably in tests (then verify structure via XML parts).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [x] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked (done 2026-10-17, orchestrator; findings folded into this plan)
- [x] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written (done 2026-10-17, orchestrator; findings folded into this plan)
- [x] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean") (done 2026-10-17; see Inner Loop Refresh Note)
- [x] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline; refreshed 2026-10-17)

Signals: S1, S2, S4, S6 (identity/memory/export), S7 -> 5/7 HIGH. Agent team is unavailable in this environment (TeamCreate missing): recorded, falling back to the S0 -> S1 -> S2 -> S3 pipeline below. **S0** interface freeze by a single opus agent (memoryApi types, counsel types, outbox state union, download signature, Dexie decision). **S1** parallel opus subagents on disjoint directories: (a) `packages/core/src/counsel` + core tests, (b) Worker L5 (`apps/worker/src/proxy/pipeline.ts` + test), (c) web client + outbox (`apps/web/src/api/**`, `storage/db.ts` if bumped), (d) e2e infra (`scripts/src/dev-seed.ts`, `playwright.config.ts`, root/worker/web scripts). Disjoint blast radii make bare parallel subagents valid here because the S0 freeze removes mid-run coordination needs. **S2** single opus agent for `state/review.ts`, counsel/gate/metrics UI and DOCX export. **S3** e2e specs (opus; may split by spec file). Then a sonnet security/code review, then EVL by a spawned vc-tester. Model policy: opus only for the code-execution legs, sonnet for review, validate, update-process. vc-scenario edge cases (reconfirm, unclear, AI-only, pending-op revoke, 429 deferral) are folded into the gate matrix and outbox tests.

## Test Infra Improvement Notes

- Playwright helper for multiple browser contexts (sandbox-isolation) and a DOCX parse-back helper (mammoth, web devDependency) shared by `counsel-export-contents` and the exported-sheet e2e checks.
- The `stack-memory` Playwright project and `scripts/src/dev-seed.ts` are new infra; document the exact commands in `process/context/tests/all-tests.md` at UPDATE PROCESS.
- Core gate tests move into one shared fixture builder (status x answer x label x severity x detector kind) so web `review-sync` can reuse it.

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08-counsel-gate-memory_PLAN_17-10-26.md`
- Last completed step: 3 PLAN-SUPPLEMENT (2026-10-17). Steps 1 RESEARCH and 2 INNOVATE complete.
- Validate-contract status: written 2026-10-17, Gate: PASS
- Next Step: PVL supplement cycle 1 applied (12 gaps, see `### PVL supplement cycle 1`); re-spawn vc-validate-agent from V1. Phase 08b is being supplemented concurrently by another agent; the shared registry change is requested below, not applied here. Entry gate still requires Phases 03, 04b, 05, 07 verified (07 waits on 06).
- Gate-command rule: no `--`, one token per call (see `## Test Gates`).
- High-risk evidence pack required under `harness/phase-08/` (auth/session, memory writes, export).
- Validators: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08-counsel-gate-memory_PLAN_17-10-26.md`.

## Locked Decisions (PLAN-SUPPLEMENT 2026-10-17)

| ID | Decision |
|---|---|
| D1 | User-approved (umbrella D-1) wins: DOCX contains only unanswered New/Accepted questions; recorded answers are shown in the app only. Deviation from the AC21 wording recorded in the AC21 row and the report. D-3: in-app answering is in scope. Accept on a blocking finding stays Blocked until counsel answers. |
| D2 | Gate is critical-only with an explicit `detector_kind === 'ai'` exclusion (precondition L4). No "promoted AI" concept. High `dismissed_reconfirm` shows the label but does not gate (deviation vs DATA-MODEL line 234 "blocking finding"; SPEC AC22/AC48 and the approved app.html say critical). `gateInterim.ts` becomes a thin re-export of core. |
| D3 | DOCX export moves from core to web (`features/counsel/exportDocx.ts`, lazy `import('docx')`; `docx` is already a web dependency, core has none). The parse-back gate `counsel-export-contents` therefore moves from core to web, with `mammoth` added as a web devDependency (core already has it); `pnpm-lock.yaml` has a single writer. Core keeps pure `sheet.ts`, `template-draft.ts`, `gate.ts`, `metrics.ts`. |
| D4 | MemoryApi interface is frozen first (S0). Phase 08 owns every method, including those 08b needs. Switch by `apiEnabled()`, not an `API_MODE` flag. |
| D5 | Run lifecycle is lazy; dedupe key `law_firm_id + doc_hash + settings_hash`; delta on re-analysis; different `settings_hash` = new run. Duplicate finding ids are idempotent in the Worker (INSERT OR IGNORE) but still consume write budget, so the client skips stored ids. |
| D6 | Version-drift counsel questions from Compare diff-only rows are out of scope; backlog stub written at EXECUTE. |
| D7 | Metrics definitions (AC64) as in the AC64 row; `t0` = `openDocument` call time, first export only. |
| D8 | E2E: preview project with the extended stub plus a new `stack-memory` Playwright project on a seeded local D1 (`scripts/src/dev-seed.ts`). |

## Security Notes (STRIDE scan, supplement)

- **Spoofing / identity:** session cookie is HttpOnly and never read by JS; analyst name is a display label only; read-only comes from the session response `read_only` (never from the cookie), which disables writes client-side, and the Worker refuses writes with 403 `read_only_demo` (client code `read_only`). Test: `stack-memory-demo-workspace`, `realMemoryApi` read_only case.
- **Tampering:** all mutating calls carry `client_op_id` (idempotent replay); fingerprint is recomputed server-side (422 `fingerprint_mismatch` is terminal, never retried); AI draft text is masked and clamped (L6) before display or export.
- **Repudiation:** every write has an audit row; the viewer is read-only; `stack-memory-audit-trail-append-only` proves no edit/delete path.
- **Information disclosure:** DOCX holds only the analyst's own masked quotes (<= 1000 chars); memory never crosses firms or workspaces (`memory-no-cross-firm` both projects, I1 end-to-end re-verification of firm-rule isolation); the browser never sees keys; rules echo exposes only an 8-char hash prefix and a count.
- **Denial of service:** write budget (decision batches ~10-12 rows, findings chunks of 25), outbox backoff and next-UTC-day deferral, one quiet chip instead of retry storms.
- **Elevation:** none added; no new Worker route; the only Worker change is additive frame metadata.

## Risk Predictions (vc-predict summary and vc-scenario edge cases)

Highest-risk items: (1) outbox optimistic-id mapping and revoke-of-pending (an unmapped `pending:<op>` id leaking into a revoke call): edge cases covered by `outbox` tests (revoke before drain, revoke while sending, drain order); (2) gate semantics divergence between stub, real Worker labels and core (`gate-state-matrix` plus `review-sync` plus `api-contract` parity); (3) write-budget exhaustion in `stack-memory` runs (batching, skip stored ids; deferred state is a test case); (4) AI-detector finding with critical severity wrongly blocking (L4 explicit exclusion and test); (5) seeded local D1 drift vs `demo.sql` (dev-seed uses a dedicated persist dir recreated per run). Kill criteria unchanged: if the interim fund II result is < 50% fix fixtures/memory logic, never thresholds.

## High-Risk Evidence Pack (required)

Risk classes: auth/session, memory writes (trust boundary), export. Artifacts under `process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-08/`: `adversarial-validation.json`, `context-snippets.json`, `review-decision.json`, `risk-gate.json`, `verification.json`, written in the exact schema of `harness/phase-05` and checked by the same evidence validator at R2.

## Blast-Radius Registry Coordination

### Registry update request (Phase 08)

Request for the orchestrator/registry writer (this agent did not edit `phase-blast-radius-registry.md`; a concurrent agent is editing the 08b plan). Append to `## Phase 08` (revision 2026-10-17, PLAN-SUPPLEMENT):

- Newly owns: `apps/web/src/lib/download.ts` (shared with Phase 09: whoever lands first creates it; signature `downloadBlob(filename: string, data: string | Blob, mime: string): void`, first lander creates, second must not narrow it), `apps/web/src/api/{realMemoryApi,outbox}.ts`, `apps/web/src/features/audit/AuditList.tsx` (reusable; 08b mounts it as a tab), `scripts/src/dev-seed.ts`, `harness/phase-08/`, `apps/worker/test/llm/rules-echo.test.ts`, `apps/web/e2e/stack-memory-*.spec.ts`.
- Extends (additive, serialized after prior owner): `apps/worker/src/proxy/pipeline.ts` (result-frame `meta` only, Phase 04a/05 file), `apps/web/src/features/ai/stream-client.ts` (optional `task` param, Phase 05 file), `apps/web/src/api/{memoryApi,stubMemoryApi,client}.ts`, `apps/web/src/state/{review,session}.ts`, `apps/web/src/shell/AnalystBadge.tsx`, `apps/web/src/features/review/{gateInterim.ts,**}`, `apps/web/test/import-graph.test.ts` (ALLOWED additions only: `computeGate`, sheet builder, template draft, metrics, `sensitiveSpans`), `apps/web/src/storage/db.ts` (conditional version bump), `apps/web/playwright.config.ts`, `apps/web/package.json` (mammoth devDependency, `test:e2e:stack-memory`), root `package.json` (`dev:stack:seeded`), `apps/worker/package.json` (`dev:e2e`), `pnpm-lock.yaml` (single writer), repairs to `apps/web/e2e/{placeholder-routes,app-shell}.spec.ts` and `apps/web/src/smoke.test.tsx`, seam `apps/web/src/features/registry.ts` (append `id:'counsel'`) and `packages/core/src/index.ts` (append).
- Changed ownership note: core `export-docx.ts` is NOT created (D3). The Phase 08 line "No Worker code changes expected" is superseded by the additive L5 frame meta edit.
- Seam order: `features/registry.ts`, `smoke.test.tsx`, `placeholder-routes.spec.ts` are also edited by Phases 07 and 09; Phase 08 appends `counsel` last at EXECUTE time and edits only its own row. `features/open-document/**` is NOT touched (t0 lives in `state/review.ts`).
- Overlap check: 08b must not redefine `MemoryApi` methods or `AuditList`; Phase 09 must reuse `download.ts` if present.

## Backlog Stubs Owed (written at EXECUTE)

- `process/general-plans/backlog/phase08-version-drift-questions_NOTE_17-10-26.md` (D6). Any other Known-Gap found at EXECUTE gets its own stub and keeps its gate CONDITIONAL.

## Inner Loop Refresh Note

Date: 2026-10-17. Mode: inner-loop plan refresh (PLAN-SUPPLEMENT, step 3), existing plan updated in place; no new plan file.
Inputs: umbrella D-1..D-9 and Current Execution State preconditions L4 (computeGate excludes `detector_kind:'ai'`), L5 (Worker rules echo), L6 (mask and clamp drafts), I1 (firm-rule isolation end to end); SPEC AC20-25, AC44-48, AC59-60, AC64; app.html `#counsel` + `app_NOTES.md`; `counsel-sheet.html` (verified to exist) + `counsel-sheet_NOTES.md`; code verified by Read/Grep (memoryApi.ts, client.ts, base.ts, stubMemoryApi, db.ts, stream-client.ts, gateInterim.ts, runs.ts, finding.ts, pipeline.ts, frames.ts, playwright.config.ts, package scripts).
Sections changed: Overview/UI contract, Acceptance Criteria (AC20, AC21 deviation, AC22, AC64), Touchpoints, Public Contracts, Blast Radius, Data Flow, Failure Modes, Implementation Checklist (rewritten as S0-S3 + review), Test Gates (no-`--` form, new tokens, stack-memory), Verification Evidence (rows added), Execution Strategy, Test Infra Notes, Resume handoff, Phase Loop Progress (1-3 ticked); new sections Locked Decisions, Security Notes, Risk Predictions, High-Risk Evidence Pack, Registry update request, Backlog Stubs.
Corrections to the earlier plan: `export-docx.ts` leaves core (D3); `API_MODE` flag replaced by `apiEnabled()`; "no Worker code changes" replaced by the additive L5 meta edit; `apps/web/src/features/home` is not a path (open-document is); gate matrix gains the detector-kind axis; commands lose `--`; the Playwright `webServer` for integration becomes a new `stack-memory` project; counsel sheet mockup step becomes a conformance check. Duplicate-finding-id question answered from Worker code (idempotent via INSERT OR IGNORE, budget still claimed). Open for PVL/EXECUTE verification: exact `DecideInput`/`AnswerInput`/`createQuestions`/`export` field sets against `contracts/memory.ts`, and `.dev.vars` availability for the `stack-memory` webServer.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: inner-pvl: phase-08
supersedes: 2026-10-17 (inner-pvl: phase-08) — cycle-1 re-validation contract (CONDITIONAL, G13 analyst-name prompt, G14 stale Security Notes); this is the cycle-2 re-validation after PVL supplement cycle 2

Parallel strategy: sequential-pipeline (S0 single opus agent, then S1 four parallel opus subagents on disjoint directories, then S2 single opus agent, then S3 e2e specs, then a sonnet security review and a spawned vc-tester EVL). Agent team is not used (TeamCreate unavailable in this environment, recorded in the plan); the S0 interface freeze removes the mid-run coordination need, so bare parallel subagents are valid for S1 only if the four blast radii stay disjoint (they do: `packages/core/src/counsel`, `apps/worker/src/proxy/pipeline.ts` + test, `apps/web/src/api` + outbox, `scripts/src/dev-seed.ts` + `playwright.config.ts` + manifests). Model policy: opus only for S0/S1/S2/S3 code legs; sonnet for review, validate, EVL tester and update-process.
Rationale: 5/7 signals (S1 multi-package, S2 auth/API/identity surface, S4 phase program, S6 high-risk class identity + memory writes + export, S7 20+ files); dominant signal S6. Estimated agents: S0 1 + S1 4 + S2 1 + S3 2 (split by spec file) + review 1 + EVL tester 1 = about 10, under the 30-agent cost guard.

PVL cycle: cycle 2 re-validation for Phase 08 (`results.tsv` row 64 first-pass supplement, row 68 cycle-2 supplement; two fix cycles recorded, `wc -l` = 70). Evidence: `validate-plan-artifact.mjs` 0 failures / 0 warnings; every item re-verified against the plan text and the working tree (Phases 00-05 DONE; Phase 06 uncommitted mid-EXECUTE; Phase 07 PASS contract, EXECUTE pending).

Resolution check of the first-pass gaps (all 12 verified against plan text AND code; resolved items stay resolved):
- G1 RESOLVED: plan Touchpoints INFRA + S1.e2e-infra + gate row. Code: `apps/worker/src/config.ts` reads `COOKIE_SIGNING_KEYS` (JSON map, keys >= 32 bytes, kid charset) and `COOKIE_SIGNING_KID` and requires both; `slice-check.ts` refuses to start when `.dev.vars` or `.env` exists, so the plan's "no `.dev.vars` ever" is the correct choice; `.wrangler/` is gitignored; `TURNSTILE_SECRET` unset means Turnstile is not enforced.
- G2 RESOLVED: `apps/web/playwright.config.ts` currently has `wantsStack = /--project[= ]stack\b/` (matches `--project=stack-memory`: confirmed defect) and a `preview` `testIgnore` of only `slice.spec.ts`; the plan's `/--project[= ]stack(?![-\w])/`, `wantsStackMemory`, extended `testIgnore`, own `testMatch` and baseURL 8788, preview webServer first, are mechanically sound. `test:e2e` is `playwright test --project=preview`, so the whole-e2e gate never starts a stack server.
- G3 RESOLVED (with the plan's own verified fallback): `SESSION_CAPS.perIpPerDay` is 5 (`apps/worker/src/platform/index.ts`); the IP comes only from `cf-connecting-ip` through `ipPrefix` (IPv4 accepted as-is); a unique header per context via `extraHTTPHeaders` is the right lever, and S1.e2e-infra records the probe result plus a shared-storageState fallback of at most 5 sessions.
- G4 RESOLVED: `scripts/src/seed/gen-demo-seed.ts` exports `buildDemoSeedSql(spec, specPath)`, `loadSpec`, `PHASE02_SPEC`; `seed:gen` would auto-select the Phase 02 spec and rewrite `apps/worker/seed/demo.sql` (confirmed), so the "do not run seed:gen" rule stands; `fixtures/memory/demo-seed-spec.json` exists; migrations 0001-0005 exist.
- G5 RESOLVED: field shapes match `packages/core/src/contracts/memory.ts` and `claims.ts` exactly (`CreateSessionResponseSchema {workspace_id, analyst_id, kind, expires_at, read_only}`; decide `run_id` optional in the schema but refused with `run_required` by `routes/memory/decisions.ts`; `CounselAnswerRequestSchema` `option`/`note`/`quote_text`/`fingerprint`; `CounselQuestionRequestSchema` interpretations 1-6 x 1-500; Worker-local `RunExportRequestSchema {client_op_id, question_count}`). Error mapping verified: `read_only_demo` (403), `invalid_session` (401, reasons `no_session`/`bad_cookie`/`no_workspace`), `conflict_active_decision` (409 + `current`), `invalid_request` reasons `run_required|firm_required|run_not_found|question_not_found|pattern_key|op_reused|id_charset|rule_state|rule_not_found|decision_not_found`, `rate_limited` reasons `memory_write_budget|workspace_write_limit|workspace_run_limit|workspace_findings_limit|session_limit`, 422 `fingerprint_mismatch`, 503 `memory_unavailable`; the wire retry field is `retry_after_s`.
- G6 RESOLVED: `apps/web/test/import-graph.test.ts` ALLOWED set currently lacks `sensitiveSpans` and every counsel value; the plan names the additions and the core export `sensitiveSpans` (packages/core/src/memory/mask.ts) and `mask` exist.
- G7 RESOLVED: `apps/web/src/lib/` does not exist yet, so the first lander creates `download.ts`; the union signature is a superset of Phase 09's text-only form (orchestrator aligns the Phase 09 plan).
- G8 RESOLVED: token collisions re-checked on disk: no existing spec or test path contains `counsel-gate`, `metrics`, `outbox`, `api-contract`, `realMemoryApi`, `review-sync`, `counsel-export-contents`, `rules-echo`; `gate-pill.spec.ts` would have matched the bare token `gate` (confirmed), so `counsel-gate` is correct; `packages/core/test/contracts/contracts.test.ts` and `test/corpus/corpus.test.ts` exist for the `contracts` and `test:corpus` tokens; evidence-pack validator `validate-risk-artifacts.mjs` exists and runs clean on `harness/phase-05`; `fixtures/memory/fund-expectations.json` `summary` = 8 findings, 5 handled, 3 need action, 62.5 percent (interim AC59/AC60 needs no residual).
- G9 RESOLVED: bootstrap-before-lookup, 401 re-bootstrap + retry, `read_only` from the session response, `run:{workspace_id}:{key}` cache, `run_id` at send time are in Public Contracts, Data Flow, Failure Modes and S1.web-client; duplicate-id behavior confirmed (`INSERT OR IGNORE`, `claimWrite(ctx,'fnd',rows.length)` before the insert, `FINDINGS_CHUNK_MAX = 25`).
- G10 RESOLVED: no-firm rule matches `firm_required` in `decisions.ts` and `counsel.ts`; export on a run with `law_firm_id: null` is accepted by `export.ts`.
- G11 RESOLVED: `openDocument` is in `apps/web/src/state/review.ts` (line ~354), the doc id is `result.docHash || doc_<seq>` (line ~394), `features/open-document` holds no `openDocument`.
- G12 RESOLVED: `features/registry.ts` currently has the `counsel` placeholder row; `smoke.test.tsx` (lines 15, 26), `placeholder-routes.spec.ts` (line 6) and `app-shell.spec.ts` (line 38 loop) are the seam files; the plan's append-last, own-row-only, symbol-anchored rule is correct.
- Also verified: L5 sites in `apps/worker/src/proxy/pipeline.ts` (cache-hit result frame ~L288, miss frame ~L390, `rulesHash` set at ~L243-252; `selectInjectedRules` in `packages/core/src/llm/rules.ts` already returns `hash8` and `applied`; `FrameSchema.meta` is an open optional record, so no frozen contract change; web `ndjson.ts` already forwards `meta`); `fixtures/llm-recordings/counsel-draft` exists; `AI_TASK_IDS` already contains `counsel-draft`; Dexie is version 1 with `outbox (++seq, createdAt)`, `drafts`, `uiState`, so E8 (no version bump) holds; `design/mockups/app.html` has the `#counsel` route and `counsel-sheet.html` exists; `process/general-plans/backlog/phase08-*` is not written yet (written at EXECUTE, S3.4).
- 08b cross-phase pins all PRESENT in the Phase 08 plan: `firm(lawFirmId)`, `listRules(lawFirmId)`, `createRule(lawFirmId, text)`, `approveRule(id)`, `rejectRule(id)`, `revokeRule(id, text)`, `revoke(decisionId, reason)`, `audit(cursor?) -> {events, next_cursor}` (page 100); `MemoryApiError` `code/reason/status/retryAfterUtc?/current?`; presentational `AuditList({events, loading?, onMore?})` with no fetching; `useSession().readOnly`; `client.ts` re-evaluates on API base change (matches 08b R1-R4 and its Public Contracts line "Phase 08 surface 08b depends on"; 08b needs only `AuditList({events, ...})`).
- G13 RESOLVED (cycle 2, verified): plan line `## Public Contracts` Session bootstrap pins the default `Linh Tran`, a non-blocking dismissible inline edit on the sidebar `analyst-name` badge, the stored name (Dexie `uiState`) feeding `bootstrap(name)` (1-80 chars, trimmed) and `decided_by_name`, and the existing specs staying green unchanged (E15 + `pnpm slice:check`); S2.1 repeats it. Code check: `ANALYST_NAME` has exactly two consumers (`shell/AnalystBadge.tsx`, `state/review.ts:305`), so the replacement does not ripple.
- G14 RESOLVED (cycle 2, verified): `grep` for `a==='ro'` finds no occurrence in the plan outside the Validate Contract and the supplement-cycle-2 table (both history); the Security Notes Spoofing line and the Session bootstrap bullet agree with Public Contracts (`read_only` from the session response, 403 `read_only_demo`, client code `read_only`). No real inconsistency remains.
- E13 and E14 REFLECTED: S0.2 carries the optional `detector_kind` default `'rule'`, the unchanged `gateInterim.ts` export names and the barrel collision check; S1.e2e-infra carries the plain-mode SPA build before `dev-seed.ts`.

Test gates (C3 5-column table; legacy line form below). Command form (program-wide rule, `process/context/tests/all-tests.md`): `pnpm --filter <pkg> test <token>` / `test:e2e <token>`, NO `--`, ONE token per call; an unmatched token must exit 1. Token safety re-checked: `counsel-gate` (not `gate`), `metrics`, `outbox` and the others match only the new files.

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC22 | Gate: critical-only; Accept alone stays Blocked; `unclear` Blocked; Awaiting counsel Blocked; high `dismissed_reconfirm` shows the label but never gates; `detector_kind === 'ai'` never gates (L4); D-2 clear counsel answer re-confirms; full matrix status x answer x label x severity x detector kind | Fully-Automated | `pnpm --filter @aduin/core test gate-state-matrix` | B |
| AC20, AC45 | Sheet inclusion: New and Accepted needs-counsel only; `already_answered`, `awaiting_counsel`, `previously_dismissed` excluded; `unclear` returns as New; template draft deterministic | Fully-Automated | `pnpm --filter @aduin/core test sheet-contents` | B |
| AC64 | Metrics definitions: defects before build = non-AI findings not dismissed as `tool_false_alarm` at export; questions batched = sheet count; time = first export minus t0 | Fully-Automated | `pnpm --filter @aduin/core test metrics` | B |
| L5 (supports AC20) | AI result frame carries `meta.rules_hash8` and `meta.rules_applied` on hit and miss, `'none'`/0 without rules; contracts snapshot unchanged | Fully-Automated | `pnpm --filter @aduin/worker test rules-echo` | B |
| AC6, AC43 | `MemoryApi` parity: stub (Dexie) and real client (fake fetch mirroring Worker status codes and wire field names) pass the same cases | Fully-Automated | `pnpm --filter @aduin/web test api-contract` | B |
| AC6 | Outbox: idempotent `client_op_id`, 409 refresh, 422 terminal, 429 deferred to next UTC day, optimistic `pending:<op>` id mapping, revoke of pending (before drain and while sending), drain order, run_id resolved at send time | Fully-Automated | `pnpm --filter @aduin/web test outbox` | B |
| AC6, AC47 | Real client maps wire codes (`read_only_demo`, `invalid_session`, `conflict_active_decision`, `invalid_request` reasons, 429 `rate_limited`/`quota_exhausted`) and sends exactly the Worker field names | Fully-Automated | `pnpm --filter @aduin/web test realMemoryApi` | B |
| AC43, AC22 | Integration: decide/question/export wiring, optimistic ids, skip already stored finding ids on re-send, gate re-export parity with core | Fully-Automated | `pnpm --filter @aduin/web test review-sync` | B |
| AC21, AC45 | DOCX contains every unanswered New/Accepted question with masked citation and interpretations, zero answered/awaiting/previously-handled questions; parsed back with mammoth in a Node-environment test | Fully-Automated | `pnpm --filter @aduin/web test counsel-export-contents` | B |
| AC20 | Draft: mask + clamp (L6) of `drafts[].text`, template fallback, provenance chip, recorded AI response | Fully-Automated | `pnpm --filter @aduin/web test counsel-draft` | B |
| AC20 (live) | Live free-model counsel-draft quality | Agent-Probe (manual, APPROVED-LIVE, free model only) | manual probe recorded in the report | D (named residual: backlog stub; never a PASS by itself) |
| AC20 | Counsel sheet screen: draft, edit, persist across reload, no-AI template mode, AI draft toggle via recorded `/api/ai` | Fully-Automated | `pnpm --filter @aduin/web test:e2e counsel-sheet` | B |
| AC21 | Record an answer (A/B/C/unclear + note): finding becomes Answered, memory written (stub in preview) | Fully-Automated | `pnpm --filter @aduin/web test:e2e counsel-answer` | B |
| AC21, AC45 | Export flow downloads DOCX of unanswered questions only; failure leaves sheet editable | Fully-Automated | `pnpm --filter @aduin/web test:e2e counsel-export` | B |
| AC22, AC48 | Gate pill states incl. `Dismissed in [fund], re-confirm`, linked reasons, Ready only when all resolved | Fully-Automated | `pnpm --filter @aduin/web test:e2e counsel-gate` | B |
| AC64 | Metrics panel after first export | Fully-Automated | `pnpm --filter @aduin/web test:e2e metrics` | B |
| AC44 | Fund I dismissal appears in Previously handled at fund II with reason and fund I name | Fully-Automated | `pnpm --filter @aduin/web test:e2e memory-no-reflag` | B |
| AC45 | Counsel answered at fund I: fund II shows Already answered, absent from the exported sheet (parse DOCX), Awaiting not re-sent | Fully-Automated | `pnpm --filter @aduin/web test:e2e memory-prior-answer` | B |
| AC46 | Section 4 changed to Section 5 is a NEW finding (fingerprint differs) | Fully-Automated | `pnpm --filter @aduin/web test:e2e memory-edit-is-new` | B |
| AC48 | Blocking defect never hidden: stays in main list labeled re-confirm, gate unresolved | Fully-Automated | `pnpm --filter @aduin/web test:e2e memory-blocking-never-hidden` | B |
| AC47 | Firm X decisions never applied to Firm Y (preview stub; spec `memory-no-cross-firm.spec.ts` is now listed in the plan) | Fully-Automated | `pnpm --filter @aduin/web test:e2e memory-no-cross-firm` | B |
| AC47, AC49, AC55, AC56, AC57 | Real Worker + seeded local D1: sandbox isolation (two contexts), demo workspace seeded effects and not polluted, append-only audit viewer, cross-firm on real D1, decide-reload-lookup roundtrip | Hybrid (local stack precondition: `stack-memory` webServer, per-run random cookie keys, recreated seeded persist dir, session-mint first assertion) | `pnpm --filter @aduin/web test:e2e:stack-memory sandbox-isolation` then `demo-workspace`, `audit-trail-append-only`, `memory-no-cross-firm`, `roundtrip` (one call each) | A |
| AC25 | No-LLM mode: every sample processes, zero uncaught errors | Fully-Automated | `pnpm --filter @aduin/web test:e2e no-llm-corpus` and `pnpm --filter @aduin/core test:corpus` | B |
| AC59, AC60 (interim) | Fund II needs-action reduction with vs without memory, asserted inside `memory-prior-answer` from `fixtures/memory/fund-expectations.json` `summary` (8 findings, 5 handled, 3 need action, 62.5 percent) | Fully-Automated | `pnpm --filter @aduin/web test:e2e memory-prior-answer` | C (final AC59/AC60 runs stay in Phase 10) |
| High-risk evidence | Evidence pack present and schema-valid | Fully-Automated | `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-08` | B |
| Regression | Whole web unit, whole web e2e, `import-graph`, `contracts` unchanged, worker full, core golden, slice check, seed check, guards | Fully-Automated | `pnpm --filter @aduin/web test`, `pnpm --filter @aduin/web test:e2e`, `pnpm --filter @aduin/web test import-graph`, `pnpm --filter @aduin/core test contracts`, `pnpm --filter @aduin/worker test`, `pnpm --filter @aduin/core test:golden`, `pnpm slice:check`, `pnpm seed:check`, `pnpm guard:cf`, `pnpm secrets:scan` (one call each) | A |

C-4 reconciliation: the `strategy` column carries only Fully-Automated, Hybrid and Agent-Probe; Known-Gap is never a proving strategy, only the named residual rows (gap-resolution D and C).

Failing stubs for the Fully-Automated rows (red-first starting point for execute-agent; destined for the test files, not written to disk during VALIDATE):
- gate-state-matrix: `test("should block the gate after Accept on a critical finding until counsel answers", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should block the gate after Accept on a critical finding until counsel answers") })`; `should keep the gate blocked for an unclear answer`; `should never gate on an AI-detector finding`; `should show high dismissed_reconfirm label without gating` (same stub skeleton each).
- sheet-contents: `should exclude already answered and awaiting counsel findings from the sheet`.
- counsel-export-contents: `should export a docx that contains every unanswered question and interpretation`.
- memory-no-reflag: `should show Previously handled at fund II for a fund I dismissal`.
- memory-blocking-never-hidden: `should show Dismissed in fund I re-confirm for a blocking finding`.
- memory-edit-is-new: `should treat Section 4 changed to Section 5 as new`.
- memory-no-cross-firm (preview and stack-memory twin): `should not apply Firm X decisions to Firm Y`.
- review-sync: `should skip already stored finding ids when re-sending after re-analysis`.
- outbox: `should defer a 429 memory_write_budget op to the next UTC day`; `should map the optimistic pending id to the real decision id on drain`.
- rules-echo: `should include rules_hash8 in the AI result frame`.

Legacy line form (retained for existing consumers):
- core counsel: [Fully-automated: `pnpm --filter @aduin/core test gate-state-matrix`; `... test sheet-contents`; `... test metrics`; `... test contracts`; `... test:corpus`; `... test:golden`]
- worker L5: [Fully-automated: `pnpm --filter @aduin/worker test rules-echo`; `pnpm --filter @aduin/worker test`]
- web client and integration: [Fully-automated: `pnpm --filter @aduin/web test api-contract`; `... test outbox`; `... test realMemoryApi`; `... test review-sync`; `... test counsel-export-contents`; `... test counsel-draft`; `... test import-graph`; `... test`]
- web e2e preview: [Fully-automated: `pnpm --filter @aduin/web test:e2e counsel-sheet`; `counsel-answer`; `counsel-export`; `counsel-gate`; `metrics`; `memory-no-reflag`; `memory-prior-answer`; `memory-edit-is-new`; `memory-blocking-never-hidden`; `memory-no-cross-firm`; `no-llm-corpus`; whole `test:e2e`]
- stack-memory: [hybrid: `pnpm --filter @aduin/web test:e2e:stack-memory <token>` with tokens `sandbox-isolation`, `demo-workspace`, `audit-trail-append-only`, `memory-no-cross-firm`, `roundtrip` + precondition: webServer starts a recreated persist dir, migrations 0001-0005 applied, Phase 02 demo spec seeded, random per-run cookie signing keys passed to wrangler via `--var`, no `.dev.vars`]
- live AI draft: [agent-probe: counsel-draft quality, manual, free model, APPROVED-LIVE] | [known-gap: documented, backlog stub]
- evidence: [Fully-automated: `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-08`]
- infra regression: [Fully-automated: `pnpm slice:check`, `pnpm seed:check`, `pnpm guard:cf`, `pnpm secrets:scan`]

Dimension findings:
- Infra fit: PASS — G1-G4 resolved and verified against `config.ts`, `slice-check.ts`, `platform/index.ts`, `playwright.config.ts`, `gen-demo-seed.ts`; E14 (build the plain-mode SPA before `dev-seed.ts`) is now in S1.e2e-infra.
- Test coverage: PASS — re-checked on disk in cycle 2: none of the new tokens (`counsel-gate`, `metrics`, `outbox`, `api-contract`, `realMemoryApi`, `review-sync`, `counsel-export-contents`, `rules-echo`, `counsel-draft`, `counsel-sheet`, `counsel-answer`, `counsel-export`, `memory-*`, `no-llm-corpus`) matches an existing web spec or unit file; the only on-disk `memory-no-cross-firm` file is a Worker test (`apps/worker/test/memory/memory-no-cross-firm-or-workspace.test.ts`) that the web e2e and web unit commands never match; every behavior has a Fully-Automated or Hybrid gate; Agent-Probe live draft is a named residual (D).
- Breaking changes: PASS — G13 RESOLVED: Public Contracts Session bootstrap and S2.1 pin the default `Linh Tran`, a non-blocking dismissible inline edit on the `analyst-name` badge, stored name feeding `bootstrap(name)` and `decided_by_name`, and E15 (whole preview e2e + `pnpm slice:check`) as the regression proof; consistent with code: `ANALYST_NAME = 'Linh Tran'` in `state/session.ts` is used only by `AnalystBadge.tsx` and `state/review.ts:305`, and `app-shell.spec.ts:100` expects `Linh Tran`. No frozen core contract change (contracts snapshot stays unchanged).
- Security surface: PASS — G14 RESOLVED: the Spoofing line now says read-only comes from the session response `read_only` and the Worker refuses with 403 `read_only_demo`; the only remaining `a==='ro'` text in the plan is this contract's own history (resolution check, cycle-1 gap text, supplement table), and the `a==='ro'` hits in the working tree are Worker-side server code (`memory/ctx.ts`, `proxy/pipeline.ts`, `routes/memory/session.ts`), correct and not a plan inconsistency. Controls re-confirmed: firm and workspace only from the verified cookie, fingerprint recomputed server-side (422), `INSERT OR IGNORE` finding ids, per-workspace and global write budgets, HttpOnly cookie, read-only demo refuses writes, random per-run cookie keys never committed or printed.
- S0 interface freeze: PASS — contract fields, error mapping, `downloadBlob` union and the 08b pins are in the plan and match the code; E13 now in S0.2.
- S1.core (counsel): PASS — E4 and E13 (`detector_kind` optional, default `'rule'`, `gateInterim.ts` export names kept).
- S1.worker (L5): PASS — hoist `hash8` and `applied` beside `rulesHash`; two result-frame sites; edit by symbol.
- S1.web-client: PASS — run cache, outbox, bootstrap and 401 retry specified and consistent with the Worker.
- S1.e2e-infra: PASS — G1-G4 resolved; probe-and-fallback for the IP header; E14 build step.
- S2 integration: PASS — G13 resolved in S2.1; t0 hook and seam order resolved.
- S3 e2e specs: PASS — spec and token naming resolved.
- Review and closeout (R1-R3): PASS — evidence pack schema in E6, validator command in the gate table.
- 08b cross-phase pins: PASS — all pinned signatures and accessors present.

Open gaps: none (0 FAIL, 0 CONCERN). G13 and G14 from the cycle-1 re-validation are RESOLVED (evidence in the resolution check above). No new gaps raised in cycle 2.

Known gaps (named residuals, excluded from the CONCERN count, none is a silent pass): live-model counsel-draft quality (Agent-Probe, backlog stub, Phase 10 sweep); version-drift counsel questions (backlog stub D6); deployed real-D1 behavior and final AC59/AC60 runs (Phase 10).

Execute-agent instructions (E1-E12 unchanged from the first-pass contract; E13-E15 added in cycle 1 and now reflected in the plan text; no new instructions in cycle 2):
- E1 Start EXECUTE only after Phase 06 is committed and Phase 07 is verified; Phase 06's uncommitted edits touch `state/review.ts`, `features/open-document`, `FindingsScreen.tsx`. Anchor every edit by symbol, never by line number; re-read each file first.
- E2 L5: in `proxy/pipeline.ts` hoist `rules.hash8` and `rules.applied` into outer variables beside `rulesHash`; add `meta: {rules_hash8, rules_applied}` to the AI result frame on the cache-hit and the miss return only (OCR frames unchanged); assert `packages/core/src/contracts/frames.ts` and the contracts snapshot are unchanged.
- E3 `stream-client.ts`: add the optional `task` argument defaulting to `clause-judgment`; the counsel-draft call uses the same transport and counts against the visitor's 8 AI requests per day (show the existing allowance; do not add a fresh-document claim). AI draft e2e opts in with `__aduinE2E.setApiBase('/')` and fulfils `/api/ai` from `fixtures/llm-recordings/counsel-draft` (recorded for sample #3); any `openrouter.ai` request is aborted.
- E4 `computeGate` takes `detector_kind`; update the call site in `features/review/model.ts`; `gateInterim.ts` becomes a thin re-export; `gate-interim.test.ts` must keep passing.
- E5 `dev-seed.ts`: recreate the persist dir under `apps/worker/.wrangler/` each run (gitignored), apply migrations 0001-0005 with `wrangler d1 migrations apply DB --local --persist-to`, run the generated Phase 02 seed with `wrangler d1 execute DB --local --persist-to --file`, then start `wrangler dev` with `--persist-to` and `--var`; port 8788; no remote flag anywhere; keep `guard:cf` and `secrets:scan` green (keys exist only in memory and the child argv).
- E6 Evidence pack `harness/phase-08/` uses the exact schema of `harness/phase-05` and the validator `validate-risk-artifacts.mjs`: `risk-gate.json` {task, planPath, riskLevel "high", riskClasses[], mustStopBeforeFinalize, humanApprovalRequired, why}; `context-snippets.json` {task, snippets[{file, lines, description}]}; `verification.json` {task, commands[{command, result, notes}], manualChecks[{check, result, notes}], result}; `review-decision.json` {task, decision in approved|approved-with-concerns|rejected, blockingFindings[], nonBlockingFindings[], notes} (also record `reviewDecision` for the `validate-evidence-pack.mjs` vocabulary APPROVE/REJECT as Phase 05 did); `adversarial-validation.json` {task, method, scenarios[{stride, scenario, ruled_out, rationale}]}. Run the validator and quote 0 failures.
- E7 `counsel-export-contents` carries `// @vitest-environment node` (jsdom would resolve mammoth's browser entry); production uses `Packer.toBlob`, the test reads `await blob.arrayBuffer()` into mammoth `extractRawText({buffer})`; `mammoth` 1.13.0 (same pin as core) as a web devDependency, lockfile single writer.
- E8 Dexie: no version bump. Outbox rows keep state, attempts and `nextAttemptAt` inside `op`; run cache and metrics use `uiState` keys; counsel drafts use the `drafts` table (24 h browser retention purge applies: documented, intentional).
- E9 Counsel UI conformance (A0): the approved mockup preview shows recorded answers beside questions; D-1 (user-approved) and SPEC win: the in-app preview and the DOCX list only unanswered New/Accepted questions; record this deviation in the report and the umbrella decision log.
- E10 `docx` stays a lazy `import('docx')` chunk (the main bundle is already 568 kB); no static import anywhere; add no live provider call, no deploy, no push.
- E11 Backlog stub `process/general-plans/backlog/phase08-version-drift-questions_NOTE_17-10-26.md` plus one stub for live counsel-draft quality; any other Known-Gap found keeps its gate CONDITIONAL.
- E12 Probe result of the `cf-connecting-ip` header behavior (G3) and the session-mint assertion (G1) are recorded in the report before the five stack-memory specs are written.
- E13 (cycle 1) `GateFinding.detector_kind` is optional in the core type and defaults to `'rule'`, so the existing `gate-interim.test.ts` calls (`{id, severity}` only) keep passing; `features/review/gateInterim.ts` keeps exporting the names it exports today (`gateInterim`, `GATE_REASON_TEXT`, `TriageStatus`, `GateReasonKind`, `GateFinding`, `GateState`, `GateReason`, `GateResult`) so no importer changes; check the new core type names against the existing core barrel for `export *` collisions at S0. Reflected in S0.2 (cycle 2).
- E14 (cycle 1) `dev:stack:seeded` mirrors `dev:stack`: build the plain-mode web SPA (`pnpm --filter @aduin/web build`, never the e2e mode) before `dev-seed.ts` starts wrangler, because the Worker serves `../web/dist` as assets; the `stack-memory` webServer command is that script and its url is `http://127.0.0.1:8788/api/health`. Reflected in S1.e2e-infra (cycle 2).
- E15 (cycle 1) After G13 was fixed in the plan, the whole preview e2e (`pnpm --filter @aduin/web test:e2e`) and `pnpm slice:check` are the proof that the name default and inline edit did not break the Phase 03/04a specs; if any Phase 03 spec needs a change, edit only the minimum and list it in the report. The inline name edit must not change the text content of the `analyst-name` test id element while the default is kept (`app-shell.spec.ts` line ~100 asserts `Linh Tran`).

What this coverage does NOT prove:
- `gate-state-matrix`, `sheet-contents`, `metrics` (core): proves pure functions only; not that the web wires `detector_kind` or labels correctly (that is `review-sync` and the e2e specs), and not real D1 label parity.
- `rules-echo` (worker): proves the frame metadata; not that the client re-reads rules on Retry or that the AI draft is correct.
- `api-contract`, `outbox`, `realMemoryApi`, `review-sync`: run against a fake fetch and the Dexie stub; they do not prove behavior of the real Worker, real D1 triggers, budgets or the cookie in a browser (only `stack-memory` does, locally).
- `counsel-export-contents`: proves DOCX text and structure parsed with mammoth; not Word rendering fidelity, not that a user's browser saves the file, not DOCX of PDF or OCR sources beyond the fixtures used.
- `counsel-draft` and the preview AI draft e2e: recorded responses only; not live-model quality, latency or free-tier quota behavior (named residual D).
- preview e2e specs: use the extended stub and the e2e hook; not the real session, the cookie or Worker status codes.
- `stack-memory-*`: proves the local Worker and a seeded local D1 on Chromium over http://127.0.0.1; not the deployed Free-plan D1 `rows_written`, Turnstile, remote CPU limits, Firefox/WebKit, or cookie behavior on https workers.dev (Phase 10).
- `no-llm-corpus`: proves no uncaught errors and structure/findings/diff/template sheet/gate work offline; not finding accuracy.
- AC59/AC60 interim: fixture-based reduction only; final measured runs are Phase 10.
- Evidence-pack validator: proves the files exist and the schema keys are present; not that the review was thorough.

Gate: PASS (0 FAILs, 0 unresolved CONCERNs; G1-G14 resolved and verified; named residuals only: live AI draft quality, version-drift questions, deployed real-D1 and final AC59/AC60 in Phase 10; two fix cycles recorded in `results.tsv`, rows 64 and 68)
Accepted by: n/a (Gate is PASS; no concerns accepted). Named residuals (live counsel-draft quality = Agent-Probe, backlog stub; version-drift questions = backlog stub D6; deployed real-D1 and final AC59/AC60 = Phase 10) are known-gaps carried by gap-resolution D and C, not accepted concerns.

### PVL supplement cycle 1 (2026-10-17)

Mode: PVL-supplement (all 12 V7 gaps accepted, 0 FAIL). `## Validate Contract` untouched. Plan sections edited in place; `PHASE_COMPLETE: PLAN-SUPPLEMENT` is not used here. Re-validate from V1 next.

| Gap | Applied in |
|---|---|
| G1 | Touchpoints INFRA (`dev-seed.ts` random per-run keys, argv-array `wrangler dev --local --persist-to --port 8788 --var`, no `.dev.vars`, `reuseExistingServer: false`); S1.e2e-infra (first assertion proves a session mints); stack-memory gate row precondition |
| G2 | Touchpoints `playwright.config.ts` (`wantsStack` regex `/--project[= ]stack(?![-\w])/`, `wantsStackMemory`, preview `testIgnore`, own `testMatch` + baseURL 8788, preview webServer first); S1.e2e-infra |
| G3 | S1.e2e-infra (unique `cf-connecting-ip` per context via `extraHTTPHeaders`, verified there; fallback shared storageState <= 5 sessions) |
| G4 | Entry Gate (no `seed:gen`); Touchpoints INFRA (`buildDemoSeedSql(spec, PHASE02_SPEC)`, sd01-sd03 + proposed sr01 self-check, `seed:check` on the committed file) |
| G5 | Public Contracts: wire field shapes and error mapping bullets; S0.1; MemoryApiError fields; never reuse a `client_op_id` |
| G6 | Touchpoints + Blast Radius + registry request: `apps/web/test/import-graph.test.ts` ALLOWED additions; DOCX masking `mask(text, sensitiveSpans(text))` |
| G7 | Touchpoints, S0.2, registry request: `downloadBlob(filename: string, data: string | Blob, mime: string): void`; first lander creates, second must not narrow; revoke after a tick (the orchestrator aligns the Phase 09 plan) |
| G8 | Rename to `counsel-gate.spec.ts`; preview `memory-no-cross-firm.spec.ts` listed; evidence-pack validator row in Test Gates, R2 and Verification Evidence; interim AC59/AC60 proven inside `memory-prior-answer` (fixture `fund-expectations.json` `summary`: 8 findings, 5 handled, 3 need action, 62.5%, so no residual and no backlog stub) |
| G9 | Public Contracts session bootstrap and run lifecycle; Data Flow; Failure Modes; S1.web-client (bootstrap before lookup, 401 re-bootstrap + retry, `read_only` from the session response, `run:{workspace_id}:{key}`, outbox resolves `run_id` at send time) |
| G10 | Public Contracts no-firm rule; Failure Modes; S2.2 UI note "memory needs a law firm tag" |
| G11 | AC64 row, Public Contracts Metrics, Data Flow, S2.1: t0 captured at the top of `openDocument` in `state/review.ts`, `metrics:{docHash}` written once the hash exists, rewritten until an export is recorded, first export only; `features/open-document` touchpoint removed |
| G12 | Blast Radius, S2.2, S2.5, registry request: append `counsel` last at EXECUTE time, edit only its own row, derive arrays from the live registry, symbol-anchored edits; EXECUTE starts after Phase 06 committed and Phase 07 verified |

08b cross-phase requests incorporated: pinned signatures `firm(lawFirmId)`, `listRules(lawFirmId)`, `createRule(lawFirmId, text)`, `approveRule(id)`, `rejectRule(id)`, `revokeRule(id, text)`, `revoke(decisionId, reason)`, `audit(cursor?) -> {events, next_cursor}` (page 100); `MemoryApiError` carries `code`, `reason`, `status`, `retryAfterUtc?`, `current?`; presentational `AuditList({events, loading?, onMore?})`; `useSession().readOnly`; `client.ts` re-evaluates the client when the API base changes.

Registry: not edited here; the `### Registry update request (Phase 08)` block above carries the additions for the orchestrator.

### PVL supplement cycle 2 (2026-10-17)

Mode: PVL-supplement (2 V7 gaps accepted, 0 FAIL). `## Validate Contract` untouched; no Inner Loop Refresh Note written. Re-validate from V1 next.

| Gap | Applied in |
|---|---|
| G13 | Public Contracts Session bootstrap (default `Linh Tran`, non-blocking inline `analyst-name` badge edit, stored name feeds `bootstrap(name)` and `decided_by_name`, existing specs unchanged, E15 + `pnpm slice:check`); S2.1 checklist |
| G14 | Security Notes Spoofing line: read-only from the session response `read_only`, Worker refuses with 403 `read_only_demo`; `a==='ro'` removed (also removed from the Session bootstrap bullet) |
| E13 | S0.2 (optional `detector_kind` default `'rule'`, `gateInterim.ts` export names kept, barrel collision check) |
| E14 | S1.e2e-infra (`dev:stack:seeded` builds the plain-mode SPA before `dev-seed.ts` starts wrangler) |

## Deviations (EXECUTE S2, 2026-10-17)

All are inside the blast radius; the full list with impact is in the Phase 08 REPORT, section "S2". (1) `api/client.ts`: the preview `--mode e2e` build keeps the stub memory client after `setApiBase('/')`. This fixes an S1 regression that broke 10 preview AI specs. (2) The session bootstrap is lazy (just before the first memory call), so firmless documents never call POST /api/session; this keeps `slice:check` free of console errors. (3) `stream-client.ts` was not edited: the `task` argument already existed. Impact: none on the public contracts; whole preview e2e and `slice:check` are green.
