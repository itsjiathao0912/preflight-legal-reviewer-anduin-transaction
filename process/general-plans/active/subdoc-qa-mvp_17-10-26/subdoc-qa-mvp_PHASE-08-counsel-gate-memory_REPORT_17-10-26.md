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
