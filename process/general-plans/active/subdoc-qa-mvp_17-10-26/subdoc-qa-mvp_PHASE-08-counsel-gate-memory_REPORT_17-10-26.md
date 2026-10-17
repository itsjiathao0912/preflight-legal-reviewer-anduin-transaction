---
phase: phase-08-counsel-gate-memory
date: 2026-10-17
status: COMPLETE_WITH_GAPS
feature: subdoc-qa-mvp
plan: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08-counsel-gate-memory_PLAN_17-10-26.md
---

# Phase 08 report: Counsel Sheet, Gate, Memory Write-Back

Status note: only Stage S0 (interface freeze) is done. S1/S2/S3/review/EVL have not started. The phase as a whole is in progress.

## S0 - Interface freeze (2026-10-17, HEAD e5fd10e + working tree, no commit)

TL;DR: the MemoryApi interface, error mapping, core counsel types and outbox state union are frozen. The Dexie stub implements the whole interface. The shared `api-contract` test is green against the stub. S1 agents must code against the definitions below and must not change them.

### Files touched

| File | Change |
|---|---|
| `apps/web/src/api/memoryApi.ts` | Frozen interface, input/result types, `MemoryApiError` (code/reason/status/retryAfterUtc?/current?), `toMemoryApiError` mapping, `isDailyBudgetReason`, `nextUtcDay`, `AUDIT_PAGE_SIZE=100`, `FINDINGS_CHUNK=25`, `OutboxState` |
| `apps/web/src/api/stubMemoryApi.ts` | Implements every new method (Dexie `uiState` rows prefixed `stub:`); decide now checks `pattern_key`, run existence and `firm_required`; answer resolves firm through `question_id` |
| `packages/core/src/counsel/types.ts` (new) | Gate + sheet types, `ComputeGate` signature |
| `packages/core/src/index.ts` | Appended `export type * from './counsel/types'` (collision check: none of the new names existed in core) |
| `apps/web/test/api-contract.test.ts` (new) | Shared contract cases (`describe.each(IMPLS)`), error-mapping table, fake-fetch sanity |
| `apps/web/test/support/fakeMemoryFetch.ts` (new) | In-process fake `fetch` mirroring Worker statuses and error bodies, for `realMemoryApi` in S1 |

No existing caller changed: new `DecideInput`/`AnswerInput` fields are optional, and the `MemoryApiError` constructor stays backward compatible (`(code, message, init?)`).

### Frozen interface (exact)

```ts
interface MemoryApi {
  bootstrap(name: string): Promise<SessionInfo>;            // SessionInfo = CreateSessionResponse {workspace_id, analyst_id, kind:'sandbox'|'visitor', expires_at, read_only}
  lookup(lawFirmId: string, fingerprints: string[]): Promise<ActiveDecision[]>;
  ensureRun(input: EnsureRunInput): Promise<{ run_id: string }>;
  storeFindings(runId: string, findings: FindingWire[]): Promise<{ stored: number }>;  // client chunks of FINDINGS_CHUNK=25; op ids generated inside
  decide(input: DecideInput): Promise<ActiveDecision>;
  createQuestions(runId: string, items: QuestionItem[]): Promise<CreatedQuestion[]>;
  answer(input: AnswerInput): Promise<ActiveDecision>;
  exportRun(runId: string, input: ExportRunInput): Promise<ExportRunResult>;
  revoke(decisionId: string, reason: string): Promise<ActiveDecision | null>;
  firmRules(lawFirmId: string): Promise<string[]>;
  // pinned 08b signatures
  firm(lawFirmId: string): Promise<FirmMemoryResponse>;
  listRules(lawFirmId: string): Promise<Rule[]>;
  createRule(lawFirmId: string, text: string): Promise<Rule>;
  approveRule(id: string): Promise<Rule>;
  rejectRule(id: string): Promise<Rule>;
  revokeRule(id: string, text: string): Promise<Rule>;
  audit(cursor?: string): Promise<AuditPage>;               // {events: AuditEvent[], next_cursor?}; page size AUDIT_PAGE_SIZE=100
  health(): Promise<MemoryHealth>;                          // {ok, schema_version?, expected_schema_version, seed_mode?, seed_version?, reason?}
}
DecideInput  = {client_op_id, law_firm_id, run_id?, finding_ref, decision:'dismissed'|'accepted', reason_code?, note?, quote_text, fingerprint, issue_class, pattern_key?, fund_name?, doc_version_label?, section_path?, quote_snippet?, decided_by_name}
AnswerInput  = {client_op_id, law_firm_id, question_id?, quote_text?, fingerprint, issue_class, counsel_option, counsel_note?, fund_name?, quote_snippet?, decided_by_name}
EnsureRunInput = {client_op_id, doc_name, doc_hash, law_firm_id: string|null, fund_name?, version_label?, settings_hash}
QuestionItem = {client_op_id, finding_ref, fingerprint, interpretations: string[] /*1-6 x 1-500*/}
CreatedQuestion = {finding_ref, question_id}
ExportRunInput = {question_count, client_op_id?}
ExportRunResult = {ok: true, run_id, sheet_exported_at, sheet_question_count}
MemoryApiErrorCode = 'invalid_request'|'not_found'|'unavailable'|'read_only'|'unauthorized'|'conflict'|'run_required'|'fingerprint_mismatch'|'rate_limited'|'quota_exhausted'
class MemoryApiError { code; reason?; status; retryAfterUtc?: string /*ISO*/; current?: ActiveDecision|null; constructor(code, message, init?) }
type OutboxState = 'queued'|'sending'|'synced'|'retry'|'deferred'|'rejected'
```

Real-client rules (S1): `run_id` is required for decide (else `run_required`); `question_id` and `quote_text` are required for answer; wire answer body is `{client_op_id, question_id, option, note?, quote_text, fingerprint}`; decide drops `law_firm_id`, `section_path`, `quote_snippet`, `decided_by_name` (zod strips them anyway); never reuse a `client_op_id`.

### Error mapping (`toMemoryApiError(status, body, now)`)

| Wire | Client code |
|---|---|
| `read_only_demo` (403) | `read_only` |
| `invalid_session` (401) | `unauthorized` |
| `conflict_active_decision` (409) | `conflict` + `current` |
| `invalid_request` reason `run_required` | `run_required` |
| `invalid_request` reason `*_not_found` | `not_found` |
| `invalid_request` other reasons (`firm_required`, `pattern_key`, `op_reused`, `id_charset`, `rule_state`, ...) | `invalid_request` + `reason` |
| `fingerprint_mismatch` (422) | `fingerprint_mismatch` |
| `rate_limited` / `quota_exhausted` (429) | same code; `retryAfterUtc` = next UTC midnight for `memory_write_budget`, `workspace_*`, `session_limit` (or when `retry_after_s` is missing), else now + `retry_after_s` |
| `memory_unavailable` (503), other, network | `unavailable` (404 without a code -> `not_found`) |

`status` is always the HTTP status.

### Core counsel types (`@aduin/core`, type-only)

`TriageStatus`, `GateReasonKind`, `GateStatus`, `GateFinding {id, severity, detector_kind?: 'rule'|'ai'}` (absent = `'rule'`, E13), `GateState`, `GateReason`, `GateResult`, `ComputeGate`, `SheetFinding`, `SheetQuestion`, `CounselSheetMeta`, `CounselSheet`. `gateInterim.ts` is unchanged and still exports its current names; S2 makes it a re-export.

### Other S0 decisions

- **Dexie:** no version bump. Use `uiState` rows `run:{workspace_id}:{key}` and `metrics:{docHash}` (client cache, S1/S2). Stub-internal rows use the `stub:` prefix so they never collide.
- **downloadBlob:** `apps/web/src/lib/download.ts` (Phase 09) already matches the frozen signature. Reused as is.
- **import-graph ALLOWED additions (applied in S2, not S0):** `computeGate`, `buildCounselSheet`, `buildTemplateDraft`, the metrics function names chosen in S1, and `sensitiveSpans` (exists in `packages/core/src/memory/mask.ts`). S1 core agent: use these exact names or update this list.
- **S0.3 verified:** finding insert is `INSERT OR IGNORE` (`apps/worker/src/memory/repo/finding.ts`) but `POST /api/runs/:id/findings` claims `rows.length` write units first, so duplicates burn budget. The client must skip ids already stored. W13: Worker chunk max is 25, core `limits.findingsChunk` stays 50; the client chunks at `FINDINGS_CHUNK = 25`.

### Gates (S0)

| Gate | Result |
|---|---|
| `pnpm --filter @aduin/web test api-contract` | 22/22 pass |
| `pnpm --filter @aduin/web test import-graph` | 4/4 pass |
| `pnpm --filter @aduin/web test` (whole web unit) | 19 files, 98 tests pass |
| `pnpm --filter @aduin/core test` (full, incl. contracts snapshot) | 73 files, 501 tests pass |
| `pnpm typecheck` | all 4 projects pass |
| eslint + prettier on touched files | clean |

### Deviations

- `api-contract` was not run red first: the new stub methods were written in the same step as the test. Low risk, because it is a contract test of new methods that did not exist before.
- `DecideInput.run_id`, `AnswerInput.question_id` and `AnswerInput.quote_text` are optional at the type level, so existing callers keep compiling. The real client enforces them.
- `MemoryApiErrorCode` also includes `quota_exhausted` (the plan's "etc."), so 429 quota and 429 burst limits stay separate.
- The stub's `revokeRule` reports `rejected` (this matches the Worker's rule mapping).

### Forward Preview (for S1)

- **Test infra:** `createFakeMemoryFetch(opts)` in `apps/web/test/support/fakeMemoryFetch.ts`; options are `readOnly` and a one-shot `failNextWrite`. Add the real client to `IMPLS` in `api-contract.test.ts`.
- **Blast radius:** S1(c) owns `apps/web/src/api/**` (realMemoryApi, outbox, client.ts). Do not change frozen signatures in `memoryApi.ts`.
- **Commands to stay green:** the gate table above.
- **Dependencies:** none added.

## S1-worker (L5 rules echo)

- `apps/worker/src/proxy/pipeline.ts`: added the local helper `rulesEcho` plus `NO_RULES_META`. `rulesMeta` is declared next to `rulesHash` and set in the AI branch from `selectInjectedRules` (hoisted). The AI result frame now carries `meta: {rules_hash8, rules_applied, rules_total}` on the cache-hit and miss paths. With no rules (no workspace, read-only cookie, no firm, or a firm with 0 active rules) the values are `'none'`/0/0. OCR frames are unchanged. Only counts and the 8-char hash prefix are emitted, never rule text.
- New test `apps/worker/test/llm/rules-echo.test.ts` has 4 tests: hit and miss with rules (includes the no-rule-text leak check), no workspace (hit and miss), workspace with no firm, and firm with no rules. Red-first was not run as a separate step: the test was written alongside the edit.
- Gates: rules-echo 4/4, proxy-budget 6/6, cache-hit-zero-claims-with-rules 1/1 (HIT purity kept), llm-failure-injection-matrix 32/32, full worker 65 files/525 tests, core contracts 34/34, `packages/core/src/contracts` diff empty, worker typecheck clean, eslint and prettier clean, guard:cf OK.
- Deviations: added `rules_total`, which the task allowed as optional. Not committed.

## S1-core - Core counsel track (2026-10-17, HEAD 1d45fa2 + working tree, no commit)

TL;DR: core gate, sheet builder, template draft and metrics are in; all core gates green (2914 tests). `types.ts` unchanged. Web `gateInterim.ts` untouched; core `computeGate` matches it exactly plus the L4 AI exclusion, so the S2 re-export keeps `gate-interim.test.ts` behaviour.

### Files

| File | Change |
|---|---|
| `packages/core/src/counsel/gate.ts` (new) | `computeGate`, `gateReasonFor`, `isGating`, `findingLink`, `GATE_REASON_TEXT` |
| `packages/core/src/counsel/sheet.ts` (new) | `includeOnSheet`, `buildCounselSheet`, `BuildSheetOptions` |
| `packages/core/src/counsel/template-draft.ts` (new) | `maskAndClamp`, `maskQuote`, `clampInterpretations`, `templateInterpretations`, `templateQuestionText`, `INTERPRETATION_MAX_CHARS` (500), `INTERPRETATIONS_MAX` (6) |
| `packages/core/src/counsel/metrics.ts` (new) | `computeMetrics`, `FALSE_ALARM_REASON`, `MetricsInput`, `DocumentMetrics` |
| `packages/core/src/index.ts` | Append-only named re-exports of the above (collision grep: none) |
| `packages/core/test/unit/counsel/{gate-state-matrix,sheet-contents,metrics}.test.ts` (new) | Gates |

### Exported value names (for S2 import-graph ALLOWED)

`computeGate`, `gateReasonFor`, `isGating`, `findingLink`, `GATE_REASON_TEXT`, `includeOnSheet`, `buildCounselSheet`, `maskAndClamp`, `maskQuote`, `clampInterpretations`, `templateInterpretations`, `templateQuestionText`, `INTERPRETATION_MAX_CHARS`, `INTERPRETATIONS_MAX`, `computeMetrics`, `FALSE_ALARM_REASON` (plus already-exported `mask`, `sensitiveSpans` via `memory/index`). Types: `BuildSheetOptions`, `MetricsInput`, `DocumentMetrics` + S0 counsel types.

### Semantics pinned

- Gate: critical-only; `detector_kind === 'ai'` never gates (L4); clear A/B/C resolves incl. `dismissed_reconfirm` (D-2); `unclear` -> `unclear`; Accept -> `unanswered` (AC22); counsel -> `awaiting_counsel`; dismissal resolves only with a reason code; open status falls back to the memory label. High `dismissed_reconfirm` does not gate.
- Sheet: excluded when answered A/B/C here (D-1: DOCX = unanswered only) or dismissed here; `unclear` returns as New (even over an excluded prior label); labels `already_answered`/`awaiting_counsel`/`previously_dismissed` excluded; label `new` included; `dismissed_reconfirm` included only when accepted/counsel here. Quote masked `mask(text, sensitiveSpans(text))` then clamped to `limits.quoteMaxChars`; interpretations = edited/AI drafts if given else template, masked, trimmed, empties dropped, <= 6 x <= 500 chars (validated against `CounselQuestionRequestSchema`). Numbering 1-based in finding order.
- Metrics (AC64): defectsBeforeBuild = non-AI findings not `dismissed` with `tool_false_alarm`; questionsBatched = sheet question count; timeToExportMs = max(0, exportedAt - t0).

### Gate outcomes

| Gate | Result |
|---|---|
| `pnpm --filter @aduin/core test gate-state-matrix` | 2406 passed (full matrix 4 status x 5 answer x 2 reason x 5 label x 4 severity x 3 kind = 2400 cells + named stubs) |
| `pnpm --filter @aduin/core test sheet-contents` | 5 passed |
| `pnpm --filter @aduin/core test metrics` | 2 passed |
| `pnpm --filter @aduin/core test contracts` | 34 passed (snapshot unchanged) |
| `pnpm --filter @aduin/core test` | 76 files, 2914 passed |
| `pnpm --filter @aduin/core typecheck`, eslint, prettier (touched files) | clean |

### Deviations

- Red-first not literally observed: modules and tests were written in the same pass (tests named per the plan's failing-stub list). Within blast radius; no behaviour impact.
- Optional property test `test/property/counsel` (gate monotonicity) not added; the exhaustive matrix covers the same space.

## S1-e2e-infra

Status: COMPLETE (G1-G4, E14). No commit.

### What was done

- `scripts/src/dev-seed.ts` (new): random per-run `COOKIE_SIGNING_KEYS` (`{e2e<hex8>: 43-char base64url}`) + `COOKIE_SIGNING_KID`, kept in memory only; refuses to run if `apps/worker/.dev.vars` exists; recreates `apps/worker/.wrangler/e2e-stack-memory`; applies migrations 0001-0005 (asserts exactly these) and the seed from `buildDemoSeedSql(loadSpec(ROOT, PHASE02_SPEC), PHASE02_SPEC)` via `wrangler d1 execute --local --persist-to`; self-checks sd01-sd03, proposed sr01 (partners-group), schema_version 5, seed_mode 0; spawns `pnpm exec wrangler dev --local --persist-to <dir> --ip 127.0.0.1 --port 8788 --var COOKIE_SIGNING_KEYS:... --var COOKIE_SIGNING_KID:...` as an argv array with secret-looking env vars stripped (slice:check rule). `seed:gen` not run; `apps/worker/seed/demo.sql` untouched.
- Scripts: root `dev:stack:seeded` = `pnpm --filter @aduin/web build && pnpm --filter @aduin/worker dev:e2e` (plain-mode SPA first, E14); worker `dev:e2e` = `pnpm --filter @aduin/scripts dev:seed`; scripts `dev:seed` = `tsx src/dev-seed.ts`; web `test:e2e:stack-memory` = `playwright test --project=stack-memory`. No dependency or lockfile change.
- `apps/web/playwright.config.ts`: `wantsStack` = `/--project[= ]stack(?![-\w])/`, new `wantsStackMemory`; `preview` `testIgnore` = `[slice, stack-memory-.*\.spec\.ts]`; project `stack-memory` (testMatch `stack-memory-.*\.spec\.ts`, baseURL `http://127.0.0.1:8788`); its webServer `pnpm dev:stack:seeded`, `reuseExistingServer: false`, 240 s, placed after the preview webServer.
- `apps/web/e2e/fixtures/stack-memory.ts` (new helper): `uniqueIp()` (random 10.x.y.z), extended `test` whose `extraHTTPHeaders` adds a unique `cf-connecting-ip` per test context, `newStackContext(browser, baseURL)` for extra contexts, `CLIENT_HEADERS`.
- `apps/web/e2e/stack-memory-smoke.spec.ts` (new): memory health ok (schema 5, seed_mode 0); POST /api/session 200, `kind: sandbox`, `read_only: false`, `__Host-aduin_v` cookie set; 6 sessions from 6 fresh contexts all 200 and writable.

### Probe results (G3, recorded before the five stack-memory specs)

- Local wrangler honors the per-IP session cap: 7 POST /api/session calls with the same `cf-connecting-ip: 10.9.9.9` returned `200 200 200 200 200 429 429` (`rate_limited`, reason `session_limit`).
- Unique `cf-connecting-ip` per context via `extraHTTPHeaders` lifts it (smoke test 3: 6/6 writable). The shared-storageState fallback is not needed.
- `--var KEY:JSON` works (wrangler splits on the first colon): sessions mint, so the JSON key map parsed.
- dev-seed log contains no key material (grep for the key/kid patterns: 0 hits).

### Commands (exact, one token each)

| Gate | Result |
|---|---|
| `pnpm --filter @aduin/web test:e2e:stack-memory stack-memory-smoke` | 3 passed |
| `pnpm slice:check` | PASS (full); stack project still runs slice.spec.ts only |
| `pnpm --filter @aduin/web test:e2e app-shell` | 8 passed (preview unaffected) |
| `pnpm --filter @aduin/scripts typecheck`, `pnpm --filter @aduin/web typecheck` | clean |
| `pnpm exec eslint` + `pnpm exec prettier --check` on touched files | clean |
| `pnpm guard:cf`, `pnpm secrets:scan`, `pnpm seed:check` | OK |

### Deviations

- New helper file `apps/web/e2e/fixtures/stack-memory.ts` (not named in the scope list) so the five later stack-memory specs share the unique-IP lever. Within the e2e blast radius.
- Extra script `dev:seed` in `scripts/package.json` (the worker package has no `tsx`), so worker `dev:e2e` delegates to it.
- Note: when `--project=stack-memory` runs, the preview webServer still starts first (e2e build), then the plain build overwrites `apps/web/dist` (intended order, E14). Do not run preview and stack-memory projects in the same invocation.

## S1-client - Web client + outbox track (2026-10-17, HEAD 1d45fa2 + working tree, no commit)

TL;DR: the real Worker client, the outbox and the `client.ts` switch are in. All three new web gates are green, plus import-graph, the whole web unit suite (21 files, 153 tests) and the web typecheck. `state/review.ts` and the UI are NOT wired (S2).

### Files touched

| File | Change |
|---|---|
| `apps/web/src/api/realMemoryApi.ts` (new) | `RealMemoryApi implements MemoryApi` (frozen interface unchanged). Every call sends `x-aduin-client: 1`, `credentials: 'include'`, `cache: 'no-store'`. Exact paths from `routes/memory/index.ts`. Auto-bootstrap before the first call (default name `Linh Tran`); `read_only` / `readOnly` / `currentSession()` / `onSession()` come from the POST /api/session response only. A 401 `invalid_session` re-bootstraps and retries once (a second 401 surfaces as `unauthorized`). Run cache `run:{workspace_id}:{law_firm_id\|doc_hash\|settings_hash}` plus stored-finding ids `run:{workspace_id}:#findings:{run_id}` in `uiState` (memory mirror when there is no db). All `run:` rows are dropped when the workspace changes (`run:#workspace` marker). `storeFindings` sends chunks of 25 and skips ids already stored, including duplicates inside one call. Local refusals before any request: decide without `run_id` -> `run_required`; bad `pattern_key`; answer without `question_id` / `quote_text`; `createQuestions` validates the whole batch (1-6 x 1-500) first. Extra non-interface method `invalidateRun(doc)` (`RunCacheControl`) for the outbox. `health()` returns the 503 body (`ok:false`). `newClientOpId()` exported. |
| `apps/web/src/api/outbox.ts` (new) | `Outbox` over the Dexie `outbox` table (no version bump; state, attempts and `nextAttemptAt` live inside `op`). Strict FIFO drain that stops at the first op that is not due. States and handling as the plan describes: 409 -> rejected + `conflict` event with `current`; 422/400/403 -> rejected; `run_required` / `run_not_found` -> `invalidateRun` + one retry; 429 daily (`memory_write_budget`, `workspace_*`, `session_limit`) -> `deferred` until `retryAfterUtc` (next UTC day); other 429 -> `retry` at `retryAfterUtc`; network/5xx/401/no client -> `retry` with backoff 1 s doubling up to 5 min. Ops store the document key and finding keys; `ensureRun` (fresh op id), `findingsFor(doc, keys)` -> `storeFindings`, then the write run at send time. `enqueueDecide` returns `pending:<client_op_id>`; `resolveId` maps it after sync. `enqueueRevoke` on a pending id: cancels when never attempted or deferred; queues after it when it may have reached the Worker (sending or retrying); revokes the real id when synced; a rejected target is skipped. `enqueueAnswer` creates the question at send time and saves `question_id` on the op, so a retry never makes a second question. Read-only sessions never enqueue. `start(window)` drains on `online` and `focus` and resets rows stuck in `sending` (`recover()`). `unsyncedCount()` = queued + sending + retry + deferred. Terminal rows are pruned after 7 days. |
| `apps/web/src/api/client.ts` | `apiEnabled()` -> `RealMemoryApi({db})`, otherwise `StubMemoryApi`. The cached client is dropped on `onApiBaseChange` (e2e `setApiBase`). `isRealMemoryApi()` helper. |
| `apps/web/test/api-contract.test.ts` | Added the `real` implementation (RealMemoryApi + `createFakeMemoryFetch`) to `IMPLS`. All 10 shared cases pass for both implementations. |
| `apps/web/test/realMemoryApi.test.ts` (new) | 28 cases: headers and credentials, bootstrap before lookup, name trim/limits, read_only from the response, 401 re-bootstrap + single retry, network/no-base -> unavailable, wire code table (403/409/400 reasons/422/429/503), 409 `current`, exact decide/answer/question/export bodies (stub-only keys dropped), unique op ids, rules/firm/audit paths, health 503 body, run cache key, chunks of 25 + delta-only send, workspace-change clear, `invalidateRun`, `client.ts` switching on base change. |
| `apps/web/test/outbox.test.ts` (new) | 17 cases over a scripted flaky fake MemoryApi, plus one end-to-end case over RealMemoryApi + fake fetch. Includes the two named stubs `should defer a 429 memory_write_budget op to the next UTC day` and `should map the optimistic pending id to the real decision id on drain`. |
| `apps/web/test/support/fakeMemoryFetch.ts` | Extended (see Deviations): records `calls`, configurable `workspaceId`, lookup allowed for read-only sessions (as the Worker does), rules (create/list/approve/reject/revoke), GET /api/memory/firm, and audit events with paging. |

### Gates (S1-client)

| Gate | Result |
|---|---|
| `pnpm --filter @aduin/web test api-contract` | 32/32 pass (stub + real) |
| `pnpm --filter @aduin/web test realMemoryApi` | 28/28 pass |
| `pnpm --filter @aduin/web test outbox` | 17/17 pass |
| `pnpm --filter @aduin/web test import-graph` | 4/4 pass (no new core value imports; only `limits`) |
| `pnpm --filter @aduin/web test` (whole web unit) | 21 files, 153 tests pass |
| `pnpm --filter @aduin/web typecheck` | pass (covers src + test) |
| eslint + prettier on the 7 touched files | clean |

Red evidence: the tests were written after the code (same step). As a check, I mutated the outbox to treat daily 429s as `retry`: the two defer tests failed (2 failed / 15 passed). Then I restored the file and they went green again.

### Deviations

- `apps/web/test/support/fakeMemoryFetch.ts` was edited (not in the scope list). The shared contract cases (rules lifecycle, firm counts, audit events > 0) cannot run against the real client without it. It stays a test-only fixture inside the web test blast radius. Lookup is now allowed for read-only sessions, which matches the Worker (`write: false`).
- No `apps/web/src/api/session.ts`: session state lives in `RealMemoryApi` (`currentSession`, `readOnly`, `onSession`). S2 builds `useSession().readOnly` in `state/session.ts` on top of these.
- `client.ts` now picks the real client whenever the API base is not `''`. That includes production `/` and vitest. `state/review.ts` still calls `decide` without `run_id`, so on the live Worker those calls now fail locally with `run_required` and are swallowed, as before. Lookup now works against the real Worker. S2 must route decide through the outbox.
- `unsyncedCount` also counts `sending` rows (they are unsynced too).

### Forward Preview (for S2)

- **Wiring:** create one `Outbox({db, api: memoryApi, readOnly: () => isRealMemoryApi(a) && a.readOnly, findingsFor})` and call `start()` once. `findingsFor(doc, keys)` should map the current document's findings to `FindingWire`. Use `enqueueDecide(doc, input)` (keep the `pending:` id), `enqueueRevoke(id)` and `enqueueAnswer(doc, input, question?)`. Use `onEvent` for conflict refresh, rejected messages and the unsynced chip. The `OutboxDoc` key is `{doc_name, doc_hash, law_firm_id, settings_hash, fund_name?, version_label?}`.
- **Bootstrap:** call `RealMemoryApi.bootstrap(storedName)` at startup when `isRealMemoryApi(memoryApi())`. Without this call, the client bootstraps itself with `Linh Tran` before the first lookup.
- **Commands to stay green:** the gate table above.
- **Dependencies:** none added.

## S2 - Integration (2026-10-17, HEAD 84cdb49 + working tree, no commit)

TL;DR: decisions, revokes and counsel answers now go through the outbox; the session uses the stored analyst name; the real Counsel questions view, gate links, DOCX export, metrics panel, audit list and unsynced chip are in. All S2 gates are green, including the whole preview e2e (114 passed, 1 skipped) and `pnpm slice:check`. One pre-existing S1 regression was found and fixed (see Deviations 1).

### Files

| File | Change |
|---|---|
| `apps/web/src/state/memory-sync.ts` (new) | App-wide `Outbox` (started once), `useSync` (unsynced count, deferred flag, last refusal), `flushOutbox`, `outboxDocFor` (doc key; `settings_hash` = sha256 of `aduin-web/settings@1`), `toFindingWire` (drops `quote` and display fields), `setFindingsProvider`, `onSyncEvent`, `writesDisabled`. Session: `loadAnalystName` (Dexie uiState `session:analystName`, default `Linh Tran`), `ensureSession` (one `bootstrap(name)` per real client, before the first memory call; sets `readOnly` from the response and on `onSession`), `changeAnalystName` |
| `apps/web/src/state/session.ts` | `ANALYST_NAME` removed -> `DEFAULT_ANALYST_NAME`, `analystName`, `readOnly` (the named `useSession().readOnly` accessor), `setAnalystName`, `setReadOnly`, `cleanAnalystName` (trim, 1-80) |
| `apps/web/src/state/review.ts` | `decide` -> `outbox.enqueueDecide` (optimistic `pending:<op>` id, `decided_by_name` = session name); `revoke` -> `enqueueRevoke` (pending ids cancel or queue) + flush; new `recordAnswer` (A/B/C/unclear + note + who + when; `enqueueAnswer` with the stored question id or a question to create at send time; undoable; toast "Answer recorded. N items left on the gate."); t0 captured at the top of `openDocument`, `recordOpen(docHash, t0)` once the hash exists; before the lookup: `ensureSession()` (firm documents only) + `flushOutbox()`; wire findings cached per document at enqueue time (last 4 docs) so an op that drains after a switch still persists its findings; 409 conflict -> memory refresh. No-firm and read-only: triage stays local, nothing queued |
| `apps/web/src/features/review/gateInterim.ts` | Thin re-export: `computeGate as gateInterim`, `GATE_REASON_TEXT`, types `TriageStatus GateReasonKind GateFinding GateState GateReason GateResult` (E13 names) |
| `apps/web/src/features/review/model.ts` | `computeGate` passes `detector_kind` (E4); `Triage` gains optional `counselNote`, `answeredBy`, `answeredAt`, `answerId` |
| `apps/web/src/features/counsel/**` (new) | `CounselScreen.tsx`, `QuestionRow.tsx`, `AnswerForm.tsx`, `PriorCard.tsx`, `ExportDialog.tsx`, `sheet-model.ts`, `counsel-store.ts` (drafts in Dexie `drafts` as `counsel:{docId}`), `ai-draft.ts` (`task: 'counsel-draft'`, masked candidates, `lawFirmId: null`), `exportDocx.ts` (lazy `import('docx')`, `Packer.toBlob`), `export-flow.ts`, `question-ids.ts` (uiState `questions:{docId}`) |
| `apps/web/src/features/gate/**` (new) | `GateReasons.tsx` (links into counsel or findings; reconfirm text "Dismissed in [fund], re-confirm"; "Awaiting counsel (asked in [fund])"), `gate-store.ts` (shared popover open state) |
| `apps/web/src/features/metrics/**` (new) | `metrics-store.ts` (`metrics:{docHash}`: t0 rewritten until the first export; first export only; `computeMetrics`), `MetricsPanel.tsx` |
| `apps/web/src/features/audit/AuditList.tsx` (new) | Presentational `AuditList({events, loading?, onMore?})`, no fetching, labels for all `AUDIT_ACTIONS` |
| `apps/web/src/shell/{AnalystBadge,GateButton,Sidebar,UnsyncedChip}.tsx` | Inline dismissible name edit; GateButton uses `GateReasons` + shared open state; unsynced chip (hidden at 0) between the gate and the AI switch |
| `apps/web/src/features/ai/ai-lane.ts` | L5: `rulesEchoMismatch(meta, expected)`; on mismatch the cached rule texts are dropped (Retry re-reads), AI findings cleared, downgrade `rules_changed`; read-only sessions skip the check |
| `apps/web/src/api/client.ts` | Preview (`--mode e2e`) build keeps the stub memory client even after `setApiBase('/')` (Deviation 1) |
| `apps/web/src/features/registry.ts` | Appended `{id:'counsel', ..., component: CounselScreen}` after the Phase 07 compare entry |
| `apps/web/src/icons/sprite.tsx`, `src/styles/counsel.css`, `src/index.css`, `src/main.tsx` | Icons `edit`, `pin`, `down` (from app.html); counsel/dialog/metrics/audit/chip styles ported from app.html (outside the hex-guarded dirs); `loadAnalystName()` at startup |
| `apps/web/test/import-graph.test.ts` | ALLOWED += `computeGate`, `GATE_REASON_TEXT`, `buildCounselSheet`, `templateInterpretations`, `templateQuestionText`, `maskQuote`, `maskAndClamp`, `INTERPRETATION_MAX_CHARS`, `computeMetrics`, `sensitiveSpans` (all S1-core names) |
| Repairs | `src/smoke.test.tsx` (counsel appended to the id list; `featureFor('counsel')` = `CounselScreen`), `e2e/placeholder-routes.spec.ts` (counsel row removed; "counsel is no longer a placeholder"), `e2e/a11y-smoke.spec.ts` (counsel view audited; placeholder audit moved to Firm memory). `app-shell.spec.ts` needed no change |
| `apps/web/package.json`, `pnpm-lock.yaml` | `mammoth` 1.13.0 devDependency (single install) |
| Tests (new) | `review-sync` (9), `counsel-export-contents` (3, node env, mammoth parse-back), `counsel-draft` (4), `gate-reexport` (4: re-export names, Phase 03 call shape, L4, L5 echo) |

### A0 conformance (counsel UI vs app.html `#counsel`)

Matches: header (title, "N questions · N unanswered", All / Unanswered segment, Export DOCX), compact gate line with "See reasons" (opens the sidebar gate popover) and the "Accepting a finding does not open the gate" tail, one row per question (severity icon, Qn, wording, tag New / Accepted / Answered / Unclear, ref), expanded body (masked quote with pin citation, A/B/C readings, provenance Template draft / AI suggestion / Edited by you, Edit wording with Ctrl/Cmd+Enter and Esc, reconfirm memory note, Record answer / Change answer form with A/B/C/unclear, note, Answered by, Date, validation message), collapsed "Already answered (n) · Awaiting counsel (n)" with "Not exported to counsel" and "Record counsel's answer" on awaiting items (D-3), export preview (summary "N unanswered questions go to counsel: x New, y Accepted", gate warning callout, item list, "Left out of this export (n)", Download DOCX, "DOCX is the only export format"). Questions = Needs counsel + Accepted blocking findings (app_NOTES). Differences (design autonomy): an "AI draft" toggle button in the header; a no-firm note "Memory needs a law firm tag ..." and a read-only note; a metrics panel under the sheet after the first export; the dialog is a Radix dialog with the mockup `.dlg/.dl` styling instead of a native `<dialog>`. E9/D-1: the preview and the DOCX list only unanswered New/Accepted questions; recorded answers show in the app only.

### New test ids (for S3)

Counsel: `counsel-view`, `counsel-meta`, `counsel-filter-all`, `counsel-filter-open`, `counsel-ai-draft`, `counsel-export`, `counsel-gate-line`, `counsel-gate-reasons`, `counsel-no-firm`, `counsel-read-only`, `counsel-empty`, `counsel-list`, `counsel-none`, `counsel-row` (`data-finding-id`, `data-state` new/accepted/answered/unclear), `counsel-row-toggle`, `counsel-question-text`, `counsel-quote`, `counsel-interp`, `counsel-provenance`, `counsel-ai-chip`, `counsel-template-chip`, `counsel-edited-chip`, `counsel-edit`, `counsel-edit-text`, `counsel-edit-save`, `counsel-edit-cancel`, `counsel-edit-reset`, `counsel-reconfirm-note`, `counsel-record`, `counsel-answer` (`data-option`), `counsel-prior-toggle`, `counsel-prior-list`, `counsel-prior` (`data-finding-id`, `data-kind` answered/awaiting), `counsel-prior-record`. Answer form: `answer-form`, `answer-option` (value A/B/C/unclear), `answer-note`, `answer-by`, `answer-date`, `answer-error`, `answer-save`, `answer-cancel`. Export: `export-dialog`, `export-summary`, `export-gate-warning`, `export-no-firm`, `export-preview`, `export-item` (`data-finding-id`), `export-left-out`, `export-error`, `export-close`, `export-download`. Metrics: `metrics-panel`, `metric-defects`, `metric-questions`, `metric-time`. Audit: `audit-list`, `audit-event` (`data-action`), `audit-empty`, `audit-more`. Shell: `unsynced-chip`, `analyst-name-edit`, `analyst-name-input`. Gate: `gate-reason` gains `data-target` (counsel/findings).

### UI strings (new)

"Counsel questions", "N question(s) · N unanswered", "AI draft" / "Drafting…", "Export DOCX", "Digitization is blocked · N critical item(s) open", "See reasons", "Accepting a finding does not open the gate. Only a counsel answer does.", "Ready to digitize · every critical item is resolved", "Memory needs a law firm tag: answers stay in this browser and are not remembered for the next fund. Export still works.", "This demo workspace is read-only: answers and exports are not written to memory.", "No questions yet. Mark a finding \"Needs counsel\" in Findings and it appears here.", "Every question on this sheet has an answer. You can still export it.", "Template draft", "AI suggestion", "Edited by you", "Record answer", "Change answer", "Record counsel's answer", "Save answer", "Unclear: counsel could not answer. This keeps the gate blocked for a critical item.", "Choose an option or \"unclear\", and say who answered.", "Answer recorded. N items left on the gate." / "The gate is now Ready.", "Recorded as unclear. ...", "Export preview", "Left out of this export (n)", "Download DOCX", "Query sheet exported: N questions.", export failure messages (memory busy / unavailable / generic, "Nothing was marked as exported"), "The AI draft is not available right now. The template draft is used.", "Delivery metrics (first export)", "Defects found before build", "Questions batched", "Time to exportable sheet", "N unsynced" (+ "memory limit reached, retries tomorrow"), gate reasons "Dismissed in [fund], re-confirm" and "Awaiting counsel (asked in [fund])". Default "Answered by" is "Counsel, [firm name]".

### Gates (S2, one token per call)

| Gate | Result |
|---|---|
| `pnpm --filter @aduin/web test review-sync` | 9/9 |
| `pnpm --filter @aduin/web test counsel-export-contents` | 3/3 |
| `pnpm --filter @aduin/web test counsel-draft` | 4/4 |
| `pnpm --filter @aduin/web test api-contract` | 32/32 |
| `pnpm --filter @aduin/web test outbox` | 17/17 |
| `pnpm --filter @aduin/web test import-graph` | 4/4 |
| `pnpm --filter @aduin/web test source-guard` | 4/4 |
| `pnpm --filter @aduin/web test smoke` | 2/2 |
| `pnpm --filter @aduin/web test` (whole web unit) | 25 files, 173 tests |
| `pnpm --filter @aduin/core test` | 76 files, 2914 tests |
| `pnpm --filter @aduin/worker test` | 65 files, 525 tests |
| `pnpm --filter @aduin/web test:e2e` (whole preview, single serial invocation) | 114 passed, 1 skipped (design-probe opt-in) |
| `pnpm slice:check` | PASS (full) |
| `pnpm typecheck`, `pnpm lint`, `pnpm guard:cf`, `pnpm secrets:scan` | clean / OK |

Red evidence: tests were written right after the code. Mutation checks: with `cleanWording` not masking, `counsel-draft` fails 3/4; with `decide` returning null before enqueue, `review-sync` fails 2/9. Both restored and green. The first whole-preview run failed 10 AI specs (Deviation 1); the first `slice:check` failed on a console 503 (Deviation 2). Both were fixed and re-run green.

### Deviations

1. **`apps/web/src/api/client.ts` (S1 file) edited.** Since S1, `client.ts` picks the real Worker client whenever the API base is not `''`. The 10 preview AI specs (`ai-banners`, `ai-resume`, `auto-downgrade`, `provenance`, `sample-zero-calls`) call `setApiBase('/')` and intercept only `/api/ai` and `/api/quota`, so `firmRules` went to the preview server, failed, and the lane downgraded to `rules_unavailable`. S1 did not run the whole preview e2e, so this regression was already present at HEAD 84cdb49. Fix: the `--mode e2e` build (`IS_E2E`) keeps the Dexie stub. Production, vitest and the `stack`/`stack-memory` builds are unchanged (`realMemoryApi` 28/28 still green, including the client switch case).
2. **Lazy bootstrap.** `bootstrap(storedName)` runs in `ensureSession()` just before the first memory call (lookup on a firm document, the first write, export), not eagerly at startup. An eager POST /api/session logged a 503 on the M1 local stack (no D1) and broke `slice.spec`'s "no console errors". Bootstrap still always precedes the first lookup.
3. `stream-client.ts` was not edited: the optional `task` argument (default `clause-judgment`) already existed (Phase 07).
4. The AI draft supplies the question wording. Interpretations A/B/C stay the template ones (the `counsel-draft` task returns only `drafts[].text`). The wording is masked and clamped to 500 characters (L6).
5. "Answered by" (counsel) is stored only with the local triage. Memory `decided_by_name` is the analyst's session name.
6. Undoing a changed answer restores the earlier answer only locally; the earlier memory decision stays revoked. This is a rare path.
7. Answering an Awaiting-counsel prior item (D-3) creates a new question in the current run, then answers it. Prior question ids are not on `ActiveDecision`.
8. The Counsel nav badge still counts Needs-counsel findings only (Phase 03 behaviour, kept so `triage-actions`/`app-shell` stay unchanged). It does not count Accepted blocking questions.
9. The stub `createQuestions` does not write an `awaiting_counsel` decision. S3's `memory-prior-answer` / awaiting cases may need a stub extension (S3 scope).
10. Extra test file `gate-reexport.test.ts` (the task's "gate re-export compatibility" test), which also covers the L5 echo helper.

Backlog: `phase08-version-drift-questions` already exists (left unchanged). No new backlog stub.

### Forward Preview (for S3)

- **Test infra:** preview specs use the stub (`IS_E2E`) even after `setApiBase('/')`. AI draft e2e: `setApiBase('/')`, then fulfil `/api/ai` with the `counsel-draft` recording (task `counsel-draft`, candidate ids = finding ids). Export downloads go through `downloadBlob`; catch them with Playwright `page.waitForEvent('download')` and parse with mammoth. Metrics appear after the first export. Gate reasons carry `data-target`.
- **Blast radius changes:** new dirs `features/{counsel,gate,metrics,audit}`, `state/memory-sync.ts`, `styles/counsel.css`.
- **Commands to stay green:** the gate table above.
- **Dependency changes:** `mammoth` 1.13.0 devDependency in `@aduin/web`.

## S3 - E2E specs (2026-10-17, HEAD dd086f4 + working tree, no commit)

TL;DR: 11 new preview specs (22 tests) and 5 new stack-memory specs (6 tests) are green, one token per call, then whole preview (137 passed, 1 skipped) and whole stack-memory (9 passed). No stub extension was needed: an `accepted` decision with no answer already resolves to `awaiting_counsel` in core `resolveLabel`, so seeding it through the existing `seedMemory` covers every awaiting case. No product code changed.

### Files (all in `apps/web/e2e/`)

| File | Tests | Proves |
|---|---|---|
| `fixtures/counsel.ts` (new helper) | - | Fund I/II/Y fixtures from `fixtures/memory` (engine findings in Node, `seedFundI` asserts fixture fingerprint == `fingerprintFor`), `openFund` (upload + firm tag), counsel helpers, `exportDocxText` (`waitForEvent('download')` + mammoth), `trackOpenRouter` |
| `fixtures/stack-memory.ts` (extended S1 helper) | - | `stackHome` (AI off), `openRouterHits`, `apiJson`, `firmDecisions`, `auditEvents` (all pages), `expectSynced`, `dismissSynced`, `cloneSession` (same cookie, clean IndexedDB) |
| `counsel-sheet.spec.ts` | 3 | AC20: template draft, questions = Needs counsel + Accepted critical; AI-off fallback toast; wording edit/Esc/persist/reset; AI draft replayed from the committed `counsel-draft` recording (law_firm_id null, AI chip, model) |
| `counsel-answer.spec.ts` | 3 | AC21/AC22: Accept on critical stays Blocked (`unanswered`), `unclear` keeps it, A opens it, memory write (stub lookup: answered A by Linh Tran); form validation; D-3 awaiting item answered in-app via the gate link |
| `counsel-export.spec.ts` | 3 | AC21/D-1: DOCX parse-back lists only unanswered New/Accepted, citations, A/B readings, no recorded answer or note; masked quotes (`#8097`, raw number absent in preview and DOCX); failure (exportRun rejected via the e2e memory handle) shows the message, no download, no metrics, sheet editable |
| `counsel-gate.spec.ts` | 4 | AC22/AC48: reasons carry `data-target` (findings / counsel) and navigate; AI-detector critical never gates (L4); high `dismissed_reconfirm` labelled, not gating; critical re-confirm flow lowers N |
| `metrics.spec.ts` | 1 | AC64: defects = non-AI findings not dismissed as false alarm (7 of 8 + 1 AI), questions "1 in one round", time format; second export changes nothing |
| `memory-no-reflag.spec.ts` | 1 | AC44 (UI dismissal at fund I -> Previously handled at fund II with reason, name, fund) |
| `memory-prior-answer.spec.ts` | 3 | AC45 + interim AC59/AC60 (below); awaiting from fund I not re-sent (preview left-out + DOCX) |
| `memory-edit-is-new.spec.ts` | 1 | AC46 (Section 4 -> 5 is New and gates) |
| `memory-blocking-never-hidden.spec.ts` | 1 | AC48 (critical stays in main list labelled re-confirm, gates, survives reload) |
| `memory-no-cross-firm.spec.ts` | 1 | AC47 preview twin (Firm X memory never applies to Firm Y; still applies to Firm X) |
| `analyst-name.spec.ts` | 2 | Default Linh Tran, non-blocking inline edit, Esc keeps, trimmed name persists and signs decisions |
| `stack-memory-sandbox-isolation.spec.ts` | 1 | AC56: two contexts/IPs -> two sandbox workspaces; B sees nothing of A (firm memory, lookup, audit, list); B's revoke of A's id is 4xx and A's decision stays active |
| `stack-memory-demo-workspace.spec.ts` | 2 | AC57: seeded effects in a new sandbox (7 Avery decisions, #3 handled); another sandbox's write does not pollute the next visitor; read-only session -> read-only note, zero POST writes |
| `stack-memory-audit-trail-append-only.spec.ts` | 1 | AC55: decide -> revoke (UI Reopen in a clean profile); earlier events unchanged, recorded before revoked, revoked decision no longer active |
| `stack-memory-memory-no-cross-firm.spec.ts` | 1 | AC47 real Worker: Firm X dismissal invisible for Firm Y (UI, firm memory, lookup), applies at fund II |
| `stack-memory-roundtrip.spec.ts` | 1 | AC49: dismiss -> 200, answer -> 200, export -> `sheet_exported_at` + audit `counsel_sheet_exported`; reload keeps local state with no unsynced; a clean profile with the same cookie gets `previously_dismissed` / `already_answered` from the Worker lookup |

Every spec asserts zero browser requests to openrouter.ai (stack specs switch AI off; the stack has no OpenRouter key).

### Interim AC59/AC60 (from `memory-prior-answer`, fixture `fund-expectations.json` summary)

Fund II: 8 findings, 5 handled by Fund I memory (3 previously dismissed + 2 already answered), 3 need action, 62.5% fewer to review (>= 50%). The UI counts match (Previously handled = 5, main list = 3) and every expected label lands on the right finding. Final runs stay in Phase 10.

### Gates (one token per call)

| Gate | Result |
|---|---|
| `pnpm --filter @aduin/web test:e2e <token>` x 11 (counsel-sheet, counsel-answer, counsel-export, counsel-gate, metrics, memory-no-reflag, memory-prior-answer, memory-edit-is-new, memory-blocking-never-hidden, memory-no-cross-firm, analyst-name) | 3, 3, 3, 4, 1, 1, 3, 1, 1, 1, 2 passed |
| `pnpm --filter @aduin/web test:e2e` (whole preview) | 137 passed, 1 skipped (design-probe) |
| `pnpm --filter @aduin/web test:e2e:stack-memory <token>` x 5 (sandbox-isolation, demo-workspace, audit-trail-append-only, memory-no-cross-firm, roundtrip) | 1, 2, 1, 1, 1 passed |
| `pnpm --filter @aduin/web test:e2e:stack-memory` (whole) | 9 passed (incl. S1 smoke 3) |
| `pnpm slice:check` | PASS (full) |
| `pnpm --filter @aduin/web test` | 25 files, 173 tests |
| `pnpm typecheck`, `pnpm lint` | clean |

Red evidence: tests were written against existing S2 code (Mode B, e2e). Real failures seen and fixed in the specs during authoring: AI-off assumption (button is enabled, shows the fallback toast), focus vs `aria-expanded` after a gate link, sample #3 fully covered by the demo seed (switched the stack roundtrip to #4), same-doc reload keeps local triage (added the clean-profile check), seeded audit history precedes `session_created`.

### Deviations / gaps

1. **Read-only demo cookie not minted for real.** A real `ro` cookie only comes from exhausting the global 300/day session cap, which would turn every other stack-memory spec in the same run read-only. The spec rewrites the POST /api/session response to `read_only: true` (the client trusts only the response) and proves the UI disables writes and sends zero POSTs. The server-side 403 `read_only_demo` stays proven by the worker test `test/memory/session-cookie-workerd.test.ts`. Classified test-infra limitation, not a product gap.
2. **Audit trail viewer:** `AuditList` is not mounted in any route yet (08b consumes it), so the audit spec reads GET /api/audit with the page's cookie.
3. **S3.3 (`no-llm-corpus` e2e + core corpus) and S3.4 not done in this stage:** outside this task's spec list. S3.4's backlog stub already exists (`process/general-plans/backlog/phase08-version-drift-questions_NOTE_17-10-26.md`); S3.3 remains open for the orchestrator.
4. `fixtures/stack-memory.ts` (S1 file) was extended with helpers; within the e2e blast radius.
