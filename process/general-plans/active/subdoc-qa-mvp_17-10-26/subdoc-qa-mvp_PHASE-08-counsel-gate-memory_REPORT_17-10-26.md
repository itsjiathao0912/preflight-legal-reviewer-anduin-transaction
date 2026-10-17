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
