---
name: plan:ai-review-stream-dedup
description: "AI review hardening - stream the OpenRouter call (SSE) with an idle timeout plus a generous ceiling, refund visitor claims on upstream timeout, and stop AI findings that duplicate deterministic findings (candidate selection plus a verify-step safety net); includes a clean-worktree deploy and a live NG3 upload verification"
date: 18-10-26
feature: none
metadata:
  node_type: memory
  type: plan
  feature: none
---

# AI review: upstream streaming + idle timeout, timeout quota refund, no duplicate AI findings

**Date**: 18-10-26
**Complexity**: COMPLEX
**Status**: VERIFIED WITH KNOWN GAPS (18-10-26): A-I done and deployed (8a82ead2); EVL green; residuals K1-K3, AC7b CPU-after, E6 synthetic-only are in backlog. Earlier: VALIDATED - CONDITIONAL (PVL cycle 1)
**Task folder**: `process/general-plans/active/ai-review-stream-dedup_18-10-26/` (probe results and any later reports go in here, flat)
**Plan location choice**: general-plans (cross-cutting: `apps/worker`, `packages/core`, a 3-line touch in `apps/web`, fixtures, scripts; no feature folder fits).
**Upstream inputs**: no SPEC file exists. The three requester decisions D1, D2, D3 (below) are the locked requirements; the acceptance criteria in this plan (AC1-AC19) take the role of SPEC criteria for REQ-TEST-LINK. No INNOVATE Decision Summary (the "how" was fixed by the requester).

---

## Overview

One AI review today is one non-streaming OpenRouter call (up to 40 candidates, `max_tokens` 10000, `nvidia/nemotron-3-super-120b-a12b:free`, `json_schema` strict). A measured live review of `samples/packages/01-northgate-infrastructure-iii/docs/01-NG3-Subscription-Agreement.docx` took about 199 s against a 240 s wall-clock timer, with 4.3-4.7k reasoning tokens. Two further defects: a timeout keeps the visitor claims (so a slow free model burns the visitor's 3 fresh-AI documents), and every AI finding on NG3 (4 of 4) duplicated a deterministic finding because `candidates.ts` feeds each deterministic finding's sentence to the model and the web app concatenates the results with no dedup.

This plan: (1) switches the upstream call to `stream:true` and replaces the single 240 s timer with an idle timeout plus an overall ceiling, keeping the browser-facing NDJSON contract unchanged; (2) refunds the visitor claims on upstream timeout; (3) removes duplicates at the source (candidate selection) and with a pure safety net in the verify step (which also covers the committed precomputed AI files for bundled samples).

**Do NOT cap reasoning.** Capping reasoning made recall erratic. No `reasoning`/`max_reasoning` parameter is added to the upstream body anywhere in this plan.

## Goals

1. G1. A live NG3 upload review finishes with a clear margin under the new limits and the browser sees the same `hb` frames plus exactly one terminal frame as before.
2. G2. An upstream that goes silent fails in about 60 s instead of 240 s; a long but live generation is allowed up to a 420 s ceiling.
3. G3. An upstream timeout refunds the visitor claims `reqV`, `docV`, `docIp` and keeps `global` and `spend` (same class as network/5xx).
4. G4. Zero AI findings whose sentence overlaps a deterministic (`detector_kind === 'rule'`) finding anchor in the same block, for fresh results, cache hits and precomputed static files.
5. G5. Recorded tests stay honest with no live call required by any gate; Worker CPU stays no worse than today (checked, not assumed).

## Non-Goals / Out Of Scope

- No change to the browser-facing NDJSON frame contract (`hb`, `result`, `error`), to `AiRequest`/`AiResult` schemas, to `AI_MAX_TOKENS`, to the prompt text or `promptVersion` (`clause-judgment@1` stays; only the candidate CONTENT changes, which moves `inputHash`, and the cache key follows automatically).
- No reasoning cap, no model change, no paid path, no change to quotas/limits numbers.
- Do NOT touch `packages/core/src/package/**` (another session). `apps/web` edits are limited to `apps/web/src/engine/engine.worker.ts` (3 lines), `apps/web/test/**` additions and one e2e spec plus regenerated `apps/web/public/precomputed/*.none.json`. `apps/web/src/state/review.ts` is NOT edited (the safety net lives in the verify step, see D3b decision).
- Never push. Never touch zone `itsjiathao.com`. Variance commits (migration `0006`) must not reach the deploy.
- No new UI copy or screens (the existing `provider_error` banner already covers `reason: timeout`; see Public Contracts).

## Locked Decisions (from the requester, not re-litigated)

| ID | Decision |
|---|---|
| D1 | Upstream call uses `stream:true` (SSE). The Worker accumulates content deltas and reads `finish_reason`, `model`, `usage` (incl. `usage.cost` if present) from the final chunks, then reuses the parse/validate/classify path on the assembled result. Single 240 s timer replaced by an IDLE timeout (no upstream bytes, where SSE comment keepalives and reasoning deltas COUNT as activity) plus a generous ceiling. 2 MB cap kept. Mid-stream error chunks and streams ending without `[DONE]` handled. Cache and record-body parity stay consistent. |
| D2 | Upstream timeout (idle or ceiling) refunds visitor claims, keeps global + spend. DV10 table in `process/context/worker/all-worker.md` and tests updated. |
| D3 | (a) `candidates.ts`: drop the P0 picks (deterministic-finding sentences) and skip any P1-P3 pick whose sentence overlaps a rule-finding anchor in the same block. (b) A pure core function drops an AI finding whose verified site overlaps a rule-finding anchor in the same block (any class), applied where AI findings are merged so precomputed files also stop duplicating. |

## Derived Choices (this plan's decisions inside the locked ones)

| ID | Choice | Why |
|---|---|---|
| C1 | `UPSTREAM_IDLE_MS = 60_000` (6 heartbeat intervals), armed at dispatch (so a silent connect also trips it), re-armed on every upstream read (SSE comment, reasoning delta, content delta, any bytes). **Provisional until probe P1b**: if the probe's maximum silent gap exceeds 15 s, set idle to `max(60 s, 4 x max gap)`. | A dead upstream is detected in 60 s instead of 240 s. Reasoning deltas arrive every few tens of ms during a live generation, so 60 s of silence is a genuine stall, with room for provider queueing before the first byte. |
| C2 | `UPSTREAM_TIMEOUT_MS = 420_000` (kept export name, now the CEILING; `ProxyDeps.upstreamTimeoutMs` keeps its name and meaning). | 2.1x the measured 199 s; bounds a hold-open to 7 minutes. Workers Free has no wall-clock cap for a connected streaming response (waiting on `fetch` is not CPU); the browser path has no client timer (`requestAi` passes only the user abort signal; `postNdjson` has none); `hb` every 10 s keeps Cloudflare's 100 s idle-connection rule satisfied. |
| C3 | The error `reason` stays `'timeout'` for both idle and ceiling (internal log names differ: `proxy.upstream_idle_timeout`, `proxy.upstream_ceiling_timeout`). | Keeps the frozen error contract and the web banner mapping unchanged. |
| C4 | Stream applies to BOTH kinds (AI and OCR) through the one `once()` path, but the 60 s IDLE timeout is scoped to AI ONLY. OCR keeps today's behavior: `stream:true` is sent, but its timer is the single ceiling-style wall-clock (`UPSTREAM_OCR_TIMEOUT_MS = 240_000`, the current value, no idle timer). Implemented as `idleMs = kind === 'ai' ? ctx.upstreamIdleMs : 0` (0 = no idle timer) and `ceilingMs = kind === 'ai' ? ctx.upstreamTimeoutMs : ctx.upstreamOcrTimeoutMs`. (Gap 6) | A vision model's first-byte silence is unprobed (K1); an idle timer there could turn a working OCR call into a refunded timeout. Keeping OCR on the old 240 s timer changes nothing for OCR. The OCR timeout still refunds visitor claims (D2 applies to every upstream timeout). |
| C5 | Assembled-content cap 2 MiB (same meaning as today: the assistant message) PLUS a raw-stream cap of 8 MiB (reasoning deltas are not buffered but counted). Either exceeded gives `malformed`, claims kept (same as today's oversize reply). | Reasoning bytes (about 1 MB for 4.7k tokens) must not trip the 2 MiB message cap. |
| C6 | Stream that ends cleanly with a `finish_reason` but no `[DONE]` is ACCEPTED. A stream with no `finish_reason` and no `[DONE]` (EOF) or a connection error mid-stream is a provider fault: `reason: 'stream_truncated'` (EOF) / `'network'` (reset), visitor claims refunded, global + spend kept. A mid-stream `{error}` chunk or `finish_reason: 'error'` is `provider_error`, consumed, ALL claims kept (same as today's 200-with-error, because a visitor can induce it). | Consistent with the existing DV10 classes. |
| C7 | Recording policy (see Section C): live recordings whose candidate set changes are derived offline, labeled `authored`, with a `derived_from` marker; legacy live copies are archived in the task folder. No live call is required by any gate. | Honest labeling, deterministic gates. |
| C8 | D3(b) lives in `verifyAiResult` as an OPTIONAL `ctx.ruleFindings` (no ctx = behavior unchanged, so every recorded core test stays valid) and the engine worker passes the rule findings it already holds. | The verify step is the single path for fresh, cache and precomputed results, and it keeps the lane's `count` equal to what is shown. |
| C9 | Local CPU proxy gate = count of `JSON.parse` calls (deterministic); real CPU is observed on the live Worker with `wrangler tail` (`cpuTime`). | CPU cannot be measured under vitest/Miniflare reliably. |

## Context Envelope

| Field | Value |
|---|---|
| feature | none (general-plans: `ai-review-stream-dedup`) |
| phase | PLAN |
| session-goal | AI review: streaming + idle timeout, timeout refund, no duplicate AI findings |
| branch | claude/pensive-wilson-850b6c |
| worktree | /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction/.claude/worktrees/pensive-wilson-850b6c |
| context-group | worker, engine, tests |
| blast-radius-packages | apps/worker, packages/core (llm only), apps/web (engine.worker.ts + tests + precomputed), scripts (record/precompute), fixtures/llm-recordings |
| active-plan | this file |
| test-runner | vitest (workerd via cloudflare plugin) \| vitest (node) \| Playwright preview |
| validate-contract | none yet (written by VALIDATE) |

## Data Flow (architecture note, prose)

Before: browser POST `/api/ai` -> Worker pipeline (guards, rules, cache read, Turnstile, claims) -> ONE non-streaming `fetch` to OpenRouter held up to 240 s -> `classify` parses the full JSON body (`res.text()` capped 2 MiB) -> cache write, ledger write -> terminal frame; meanwhile `ndjsonResponse` sends `{t:'hb'}` every 10 s.

After (steps in order):
1. Unchanged up to claims.
2. `once()` dispatches `fetch` with the body `... ,"response_format":{...},"stream":true}` (append only; byte-identical prefix to today) and header `accept: text/event-stream`. Two timers start: the ceiling (420 s, never reset) and the idle timer (60 s, armed at dispatch).
3. `callOpenRouter` returns the `Response` at headers. `classify(kind, res, ai, { onActivity })` handles status exactly as today (429/402/non-ok map unchanged). For a 200:
   - content-type `text/event-stream` -> `readSse(res, { onActivity, maxContentBytes: 2 MiB, maxRawBytes: 8 MiB })`; any other content-type -> the existing JSON path unchanged (OpenRouter can still answer a 200 with a JSON error body).
4. `readSse` reads the body with a streaming `TextDecoder`, splits lines (`\n` or `\r\n`), and for each network read calls `onActivity` (this re-arms the idle timer). Lines starting with `:` are comments (activity only). `data:` lines: `[DONE]` ends the read; otherwise a cheap prefilter decides whether to `JSON.parse` (only lines that can carry `content`, `finish_reason` non-null, `usage`, `model` first time, or `error`; reasoning-only lines are counted as activity and never parsed; exact patterns fixed by probe P1a). Content deltas are pushed into an array and joined once at the end.
5. The result `{content, finish_reason, model, usage}` goes to the same tail logic as today (`finish(kind, parts, ai)`: `finish_reason === 'length'` malformed, `parseContent`, `task.validate`, `usageOf`, model regex, cost). The `Classified` result type is unchanged.
6. If the idle timer fires, it sets `timedOut` and aborts the controller; `reader.read()` rejects with `AbortError`; `once()` returns `{reason:'timeout', consumed:true, providerFault:true}` (D2). The ceiling does the same. Client disconnect aborts via the existing signal (claims kept, as today).
7. `run()` in `pipeline.ts` applies `refundVisitorScoped()` for `consumed && providerFault` (existing branch), so no pipeline refund-logic change is needed beyond the flag.
8. Cache write, ledger write, terminal frame: unchanged. The browser still receives only `hb` frames and one terminal frame.

Dedup flow: engine worker analyze -> `runDeterministic` (then package-definition suppression) -> `buildAiCandidatesWithSites(g, findings)` now omits rule-finding sentences -> request. On verify (fresh, cache or precomputed): `verifyAiInWorker` -> engine `verifyAi` -> `verifyAiResult(g, result, {…, sites, ruleFindings})` -> `dropRuleDuplicates` removes AI findings overlapping a rule anchor in the same block -> `findings` returned (lane `count` = shown count; `suppressed` is additive and only logged).

## Touchpoints

| File | Change | Phase |
|---|---|---|
| `apps/worker/src/upstream/sse.ts` | NEW `readSse` SSE reader (assemble, prefilter, caps, error/DONE handling) | D |
| `apps/worker/src/upstream/openrouter.ts` | `buildBody` appends `"stream":true`; `callOpenRouter` adds `accept` header | D |
| `apps/worker/src/upstream/classify.ts` | split tail into `finish(...)`; add SSE branch by content-type; optional `{onActivity}` 4th param; new reasons `stream_truncated` | D |
| `apps/worker/src/proxy/pipeline.ts` | `UPSTREAM_TIMEOUT_MS` = 420_000 (AI ceiling), `UPSTREAM_OCR_TIMEOUT_MS` = 240_000 (OCR keeps old timer, no idle), `UPSTREAM_IDLE_MS` = 60_000 (AI only), `ProxyDeps/ProxyContext.upstreamIdleMs` + `upstreamOcrTimeoutMs`, timestamp-based idle timer in `once()`, abort signal passed to `classify`/`readSse`, timeout `providerFault: true`, header comment refresh | D |
| `apps/worker/src/routes/proxy/index.ts` | wire `upstreamIdleMs` and `upstreamOcrTimeoutMs` defaults (line ~28) | D |
| `apps/worker/test/fakes/openrouter-stub.ts` | SSE support: auto-convert a 200 `choices` JSON reply to SSE when request has `stream:true`; new `sse`, `sseStall` and `sseLive` (controller handle: push/close/error) reply variants; helpers | E |
| `apps/worker/test/fakes/harness.ts` | `makeHarness({ upstreamIdleMs })` option | E |
| `apps/worker/test/proxy/{sse-assemble,sse-failure-shapes,sse-cheap-parse,upstream-timeouts,timeout-refund}.test.ts` | NEW gates | E |
| `apps/worker/test/proxy/{stream-holdopen,llm-failure-injection-matrix}.test.ts`, `apps/worker/test/llm/record-body-parity.test.ts` | update for idle/ceiling, timeout refund, `stream:true` body | E |
| `packages/core/src/llm/dedupe.ts` | NEW `rangesOverlap`, `dropRuleDuplicates` (pure) | B |
| `packages/core/src/llm/candidates.ts` | drop P0, skip P1-P3 overlapping rule anchors; doc comment | B |
| `packages/core/src/llm/verify-quote.ts` | optional `ctx.ruleFindings`; outcome `suppressed?` | B |
| `packages/core/src/llm/index.ts` | `export * from './dedupe'` | B |
| `packages/core/test/unit/llm/{ai-candidates-skip-rule-sentences,ai-dedupe-rule-overlap,ai-verify-suppresses-rule-duplicates}.test.ts` | NEW | B |
| `packages/core/test/recorded/llm-schema.recorded.test.ts` | candidate-equality check updated per recording policy | C |
| `scripts/src/record/{casebook.ts,derive-live-recordings.ts,ai-request.ts}`, `scripts/test/derive-live-recordings.test.ts` | derive script + one new authored hostile case (`ai-duplicate-of-rule`); `upstreamBody` doc note (script stays non-streaming) | C |
| `fixtures/llm-recordings/{clause-judgment,counsel-draft}/*.json` | regenerated/derived per policy (drift-narrative untouched); old-hash LIVE files `git rm`-ed after the C2 archive | C |
| `scripts/src/record/casebook.ts` | re-point removed hostile/firm-rules pick ids; new optional `fixedCandidates` field (counsel-draft-03 keeps its literal candidates) | C |
| `scripts/src/record/fixed-candidates/counsel-draft-03.json` | NEW: the two literal candidates copied from the archived live recording's `request.candidates` | C |
| `scripts/src/record/author-recordings.ts` | keep rule for `request.derived_from`; authored raw ids re-pointed to surviving candidates; `authoredRaw` not evaluated for kept files; orphan live files removed explicitly | C |
| `scripts/test/record-body-parity.test.ts` | iterates all CASES: stays green via casebook re-point; add one assertion for `fixedCandidates` cases | C |
| `apps/worker/test/llm/{llm-helpers.ts,firm-rule-in-context-recorded-llm.test.ts,record-body-parity.test.ts}` | verify the hostile/firm-rules recordings still resolve (they read by case name); update only if they pin removed ids or the old body | C/E |
| `packages/core/test/recorded/llm-quote-must-exist.recorded.test.ts` | re-point hard-coded candidate ids (c_a3a1fd5641d412c0 etc.) to the re-pointed casebook ids | C |
| `packages/core/test/recorded/llm-schema.recorded.test.ts` | (lines ~45-48) candidate-equality check skips `counsel-draft` (fixed candidates) | C |
| `apps/web/test/engine-ai-api.test.ts` | pins ids from sample recordings (c_a3a1...): re-point/regenerate expectations | C |
| `apps/web/e2e/{provenance,ai-banners,sample-zero-calls,counsel-sheet,compare-ai-summary}.spec.ts`, `apps/web/e2e/fixtures/ai.ts` | expectations tied to sample-01/03 recordings (e.g. provenance.spec.ts "4 model findings, 2 verified, 2 rejected", `aiRows toHaveCount(2)`); recount from the regenerated recordings | C |
| `scripts/src/spikes/ai-stream-probe/probe.ts` | NEW one-off probe (A2), run only via `pnpm --filter @aduin/scripts exec tsx`; NOT in the deploy cherry-pick | A |
| `apps/web/public/precomputed/*.none.json` (2 files) | regenerated by `precompute:ai --from-recordings` | C |
| `apps/web/src/engine/engine.worker.ts` | retain `ruleFindings` on the retained doc and pass to `verifyAiResult` (about 3 lines) | B |
| `apps/web/e2e/ai-no-duplicates.spec.ts` | NEW preview spec | B |
| `process/context/worker/all-worker.md`, `process/context/engine/all-engine.md`, `process/context/tests/all-tests.md`, `README.md` (live version line), `docs/DEPLOY.md` (timeout note) | doc updates (UPDATE PROCESS owns final context writes; EXECUTE updates only the lines named in checklist G) | G |

## Public Contracts

- **Browser NDJSON contract: UNCHANGED.** `{t:'hb'}` frames plus exactly one terminal `result` or `error`; frozen frame/AI schemas and the contracts snapshot must not change (`contracts` gate must show no snapshot diff).
- **Upstream OpenRouter request body:** one additive key `"stream":true` appended after `response_format`. Messages, model(s), temperature, `max_tokens`, `response_format` byte-identical. No reasoning parameter.
- **Error codes and reasons:** `code` set unchanged. `reason: 'timeout'` unchanged (now also from idle). New reason `stream_truncated` (code `upstream_failed`); the web `bannerFor` maps unknown reasons to the generic `provider_error` banner (verify at EXECUTE step D9 by reading `banner-map.ts` `bannerFor`; if an unmapped reason falls elsewhere, map `stream_truncated` to `provider_error` in the Worker instead by reusing reason `'network'`).
- **Refund contract (DV10):** timeout row changes from "kept / kept" to "refunded / kept". Documented in `all-worker.md`.
- **Core public seam (additive):** `dropRuleDuplicates`, `rangesOverlap` exported from `@aduin/core`; `VerifyAiContext.ruleFindings?`; `VerifyAiOutcome.suppressed?` (present only when `ruleFindings` was supplied). `buildAiCandidates*` signatures unchanged; the returned set shrinks.
- **Cache keys / recordings:** `inputHash` of candidate-bearing requests changes (candidates differ); `promptVersion`/`schemaVersion` unchanged. Old D1 cache entries become unreachable (7-day TTL purge); no migration.
- **No D1 migration, no secret, no env var, no limit change.** Worker `wrangler.jsonc` untouched.

## Blast Radius

- **Worker:** every `/api/ai` and `/api/ocr` call goes through the changed `once()`/`classify`. All 30 worker test files that script `h.or.reply` are affected indirectly (the stub change must keep them green unmodified).
- **Core:** `buildAiCandidates*` consumers: engine worker, Worker `guards.ts` (type/shape use only; verify at EXECUTE), `verify-quote.ts` (`candidateSitesFor`), scripts `ai-request.ts`, recorded and unit llm tests, `llm-task-registry` (pins an `inputHash` of a FIXED input: unaffected).
- **Web:** engine worker verify path (fresh, cache, precomputed). Lane `count` now excludes suppressed duplicates.
- **Fixtures:** every `clause-judgment`/`counsel-draft` recording keyed on a sample-derived candidate set; `drift-narrative` recordings are NOT sample-candidate based (unchanged).
- **Not touched:** `packages/core/src/package/**`, `apps/web/src/state/review.ts`, `apps/web/src/features/**`, migrations, `wrangler.jsonc`, any `itsjiathao.com` resource, `apps/worker/src/platform/**`.
- **Parallel-session hazard:** another session edits `apps/web` and `packages/core/src/package`. EXECUTE must not run `git stash`/`checkout`/`reset`; keep `engine.worker.ts` edits to the three lines; if `engine.worker.ts` has uncommitted foreign changes at EXECUTE time, STOP and ask the orchestrator. Playwright preview shares port 4317: coordinate before running preview e2e.

## Acceptance Criteria (SPEC-equivalent; REQ-TEST-LINK)

| # | Criterion | proven by | strategy |
|---|---|---|---|
| AC1 | Upstream body is the old body plus `"stream":true` only; `inputHash` of forwarded messages equals each recording's | `record-body-parity` (updated `expectedBody`) | Fully-Automated |
| AC2 | The Worker assembles the same terminal result from SSE as from the JSON reply for all recordings; arbitrary chunk boundaries, `\r\n`, multibyte splits, comments, `[DONE]`, usage-only final chunk, cost/model/finish_reason read | `sse-assemble` + `record-body-parity` replay | Fully-Automated |
| AC3 | No upstream bytes for `UPSTREAM_IDLE_MS` aborts and returns `reason: timeout`; a keepalive comment or a reasoning delta re-arms the timer | `upstream-timeouts` (idle cases) | Fully-Automated |
| AC4 | A continuously active stream is still cut at `UPSTREAM_TIMEOUT_MS` | `upstream-timeouts` (ceiling case) | Fully-Automated |
| AC5 | Upstream timeout (idle or ceiling) refunds visitor claims (`reqV`, `docV`, `docIp`) and keeps global + spend; no cache write; no ledger row; DV10 doc row updated | `timeout-refund`, `llm-failure-injection-matrix` (updated), grep gate on `all-worker.md` | Fully-Automated |
| AC6 | Failure shapes: mid-stream `{error}` = provider_error all kept; no `[DONE]` + finish_reason accepted; EOF without finish_reason = `stream_truncated` visitor refund; reset mid-stream = network refund; `finish_reason:length` malformed; content over 2 MiB and raw over 8 MiB malformed (all kept); JSON 200 error body still handled | `sse-failure-shapes` | Fully-Automated |
| AC7 | Reasoning-only lines are never `JSON.parse`d (parse count <= content chunks + final chunk + first model chunk) | `sse-cheap-parse` | Fully-Automated |
| AC7b | Real Worker CPU per streamed review is recorded and not worse than today's observed p99 (16 ms, observation) | live `wrangler tail` cpuTime during AC17 | Agent-Probe |
| AC8 | Browser contract unchanged: valid hb lines, exactly one terminal, heartbeat count follows idle/ceiling; contracts snapshot unchanged; no waitUntil | `stream-holdopen` (updated), core `contracts` | Fully-Automated |
| AC9 | No candidate site overlaps a rule-finding anchor in its block, on samples 1 and 3 and on synthetic docs; retained candidate ids are stable | `ai-candidates-skip-rule-sentences` | Fully-Automated |
| AC10 | `dropRuleDuplicates`: overlap (half-open, zero-length normalized), same block only, any class, adjacency is not overlap, AI-vs-AI never dropped, order preserved | `ai-dedupe-rule-overlap` | Fully-Automated |
| AC11 | `verifyAiResult` with `ruleFindings` drops duplicates and reports `suppressed`; without it, output is byte-identical (all existing recorded/unit llm tests green) | `ai-verify-suppresses-rule-duplicates`, `llm-quote-must-exist`, `llm-quote-scoped-to-candidate`, `ai-mask-before-storage`, `llm-schema` | Fully-Automated |
| AC12 | In the app, fresh/cache/precomputed AI results show no finding overlapping a rule finding; lane count equals shown count | `apps/web/e2e/ai-no-duplicates.spec.ts` (preview) | Fully-Automated |
| AC13 | Recorded tests are honest: `record:author --check`, `precompute:ai --from-recordings --check`, `fixtures:check` green; every derived recording carries `derived_from`; no gate makes a live call | the three script commands + `derive-live-recordings` test | Fully-Automated |
| AC14 | Docs match behavior: refund table row, pipeline step 10/11 text, limits note, engine candidates note, test-token list | grep gates in checklist H | Fully-Automated |
| AC15 | SSE shape confirmed by a direct free-model probe (keepalive comments, reasoning deltas, final usage/cost, finish_reason, max silent gap) and stored in the task folder | probe REF file present with required sections; `pnpm secrets:scan` clean | Hybrid |
| AC16 | Deploy is built from a clean worktree at the live base plus only this plan's commits; no migration 0006, no variance code; preflight green | deploy-worktree diff gate + `deploy:preflight` + live health/stack smoke | Hybrid |
| AC17 | NG3 `.docx` uploaded through the real Upload UI on the live app; AI review completes; duration recorded with margin (see Section I) | live verification protocol | Agent-Probe |
| AC18 | In that live result, zero AI findings duplicate a deterministic finding | live verification protocol (list comparison) | Agent-Probe |
| AC19 | No regression: full worker, core, web unit, preview e2e, scripts suites; `pnpm typecheck`; `pnpm lint`; `pnpm guard:cf`; `pnpm secrets:scan` | EVL commands in the Test Plan | Fully-Automated |

Known-Gap register (NOT a proving strategy; every row keeps its gate CONDITIONAL and has a backlog stub): (K1) live OCR streaming (not exercised live; stub-covered only) -> backlog note `ocr-streaming-live-proof`; (K2) provider SSE shape drift over time -> covered only at probe time -> backlog note `openrouter-sse-contract-recheck`; (K3) quality of the model on the NEW candidate set is proven only by the single live NG3 run (AC17/18) -> optional free re-record step O1. AC1-AC14 and AC19 do not depend on any Known-Gap.

## Probe-Outcome Decision Table (applied at checklist step A4)

| Probe finding | Action |
|---|---|
| Keepalive `: OPENROUTER PROCESSING` comments present; max silent gap <= 15 s | Keep idle 60 s |
| Max silent gap > 15 s (any phase, incl. before first byte) | idle = max(60 s, 4 x gap); record the number in the REF file |
| Reasoning arrives as `delta.reasoning` (or `reasoning_details`) with `content` empty/null | Prefilter: parse only lines where `"content":"` is followed by a non-quote character, or `"finish_reason":"` (non-null), or contains `"usage"` or `"error"` |
| Reasoning and content share a delta shape that the prefilter cannot separate | Parse every `data:` line; add `sse-cheap-parse` threshold on total CPU proxy instead (parse count <= total data lines) and lean on the live `cpuTime` check |
| No `usage` in the stream (free model omits it) | `usageOf` returns undefined, cost 0, `tokens_in/out` omitted (envelope field is optional); record in REF |
| Usage chunk arrives after `[DONE]` or after finish chunk with empty `choices` | Reader keeps reading until `[DONE]` or EOF (never stops at the finish chunk) |
| Served model id appears only in later chunks | Take `model` from the first chunk that has it; fall back to `'unknown'` (existing regex) |
| Free model refuses `stream:true` with `json_schema` (4xx) | STOP. Report BLOCKED to orchestrator: D1 premise failed; options (a) `json_object` mode streaming, (b) keep non-stream with higher timeout. Do not improvise. |
| `usage.cost > 0` or served model not `:free` | Abort probe immediately, report (circuit-breaker class), no further calls |

## Implementation Checklist

Rules for all steps: no `git stash`/`checkout`/`reset`; one commit per lettered section (conventional prefixes `feat:`/`fix:`/`test:`/`process:`); never push; run the section's gates BEFORE moving on (per-section test-gate loop); pass exact `--filter` tokens, one token per call, no `--` token.

### Section A - Pre-flight and the streaming probe (no source change)

- [x] A1. Record the baseline: `git rev-parse --short HEAD` (expect 84d26d5) and run `pnpm --filter @aduin/worker test record-body-parity`, `pnpm --filter @aduin/core test llm-schema`, `pnpm --filter @aduin/scripts record:author --check`, `pnpm --filter @aduin/scripts precompute:ai --from-recordings --check`. All must be green BEFORE any edit; write the results (counts) into the REF file.
- [x] A2. Write the one-off probe `scripts/src/spikes/ai-stream-probe/probe.ts` (inside `@aduin/scripts` so `@aduin/core` and `../record/ai-request` resolve; follows the existing `spikes/` convention; NOT a package script, NOT in the deploy cherry-pick, committed only in the Section A `process:` commit). Run it only with `pnpm --filter @aduin/scripts exec tsx scripts/src/spikes/ai-stream-probe/probe.ts` (path relative to the package root as the command requires). It follows the APPROVED-LIVE ledger convention of `scripts/src/live/common.ts` (count each call in the ledger, `<= 3` AI calls per UTC day, `assertOutsideRepo` for any scratch/ledger file). It reads `OPENROUTER_API_KEY` and `OPENROUTER_BASE_URL` from the environment only (load with `set -a; source ~/.config/openrouter/credentials.env; set +a` in the command; the kit privacy hook will ask: get the user's approval and add the `APPROVED:` marker as the hook requires). Never print, log or write the key; redact `authorization` anywhere. Hard stops inside the script: model must be exactly `nvidia/nemotron-3-super-120b-a12b:free`; abort on any `usage.cost > 0` or a served model not ending `:free`; max 3 upstream calls total across A3-A4; per-call ceiling 420 s.
- [x] A3. Probe P1a (tiny, seconds): small prompt, `stream:true`, the same `response_format` json_schema strict shape as production (built from core `responseFormat(TASKS['clause-judgment'])`), `max_tokens` 400. Record: first 5 raw lines, the set of distinct line kinds (comment, data with reasoning, data with content, finish chunk, usage chunk, `[DONE]`), exact key paths of reasoning vs content deltas, whether `usage.cost` is present, `finish_reason` location, the `model` field per chunk, HTTP headers (`content-type`).
- [x] A4. Probe P1b (one full-size call, about 3 minutes, free, $0): the real sample-03 recording request body rebuilt with `stream:true` (import `upstreamBody`/`caseRequest` from `../../record/ai-request` and `../../record/casebook` directly, since the probe lives in `scripts/`; body = `upstreamBody` plus `,"stream":true`). Optional P1c (only if the user approves a 3rd call): one tiny OCR-shaped vision request to record first-byte silence; skipped by default because OCR keeps the old timer (C4). Record: total duration, number of data lines, number of reasoning-only lines, bytes total, content bytes, max and p95 inter-chunk gap, whether comment keepalives appear and their cadence, final usage and cost, `finish_reason`, whether content is a single JSON object. Store sanitized results (counts, a few redacted sample lines, NO key, NO full model output beyond a short prefix) in `process/general-plans/active/ai-review-stream-dedup_18-10-26/ai-review-stream-dedup_REF_18-10-26.md` with the sections `## Probe P1a`, `## Probe P1b`, `## Constants Chosen` (idle, ceiling, prefilter patterns), `## Decision Table Outcome`.
- [x] A5. Apply the Probe-Outcome Decision Table: fix the idle constant and the prefilter patterns in the REF file; if a STOP row applies, stop and return BLOCKED. Run `pnpm secrets:scan` (must be clean).
- [x] A6. Gate: REF file exists with the four sections and the two measured numbers (max gap, reasoning line count); `pnpm secrets:scan` exit 0. Commit `process: ai-review stream probe results`.

### Section B - Dedup in core and the verify step (core + 3 web lines)

- [x] B1. Create `packages/core/src/llm/dedupe.ts`: `rangesOverlap(aStart, aEnd, bStart, bEnd)` half-open on normalized ranges (`end = max(end, start + 1)` so zero-length anchors count as one character); `dropRuleDuplicates<T extends {anchor:{blockId:string;offsetStart:number;offsetEnd:number}}>(ai: readonly T[], rules: readonly {detector_kind:string;anchor:{...}}[]): { kept: T[]; dropped: T[] }` considering only `detector_kind === 'rule'` entries, grouping rule anchors by `blockId`, preserving AI order, never dropping on AI-vs-AI overlap, pure and total (never throws on hostile numbers: non-finite offsets treated as no overlap).
- [x] B2. Edit `packages/core/src/llm/candidates.ts`: remove the P0 push loop (current lines 55-66) but keep a per-block list `ruleSpans: Map<number, [start,end][]>` filled from `findings` with `detector_kind === 'rule'` (`blockIndexById`); after `snapToSentence` (before the `chosen.has` check) skip the pick when `ruleSpans.get(p.blockIndex)` has a span overlapping `[snap.start, snap.end)` via `rangesOverlap`. Remove `priority: 0` from the type use (priorities 1-3 stay; the sort stays). Update the header doc comment: neighborhoods are now (1) conditional sentences, (2) defined-term definitions, (3) option-group cue lines; sentences of deterministic findings are excluded. `buildAiCandidates` signature and the `findings` parameter stay.
- [x] B3. Edit `packages/core/src/llm/verify-quote.ts`: add `ruleFindings?: readonly Pick<Finding,'anchor'|'detector_kind'>[]` to `VerifyAiContext`; after the loop, when `ctx.ruleFindings` is provided run `dropRuleDuplicates(findings, ctx.ruleFindings)`, return `{ ok: true, findings: kept, rejected, suppressed: dropped.length }`; when not provided return the object exactly as before (no `suppressed` key). Add `export type AiRejectReason` untouched (duplicates are not rejections).
- [x] B4. Edit `packages/core/src/llm/index.ts`: add `export * from './dedupe';`. Confirm `@aduin/core` root exports it (llm/index is re-exported by `src/index.ts`).
- [x] B5. Tests (write red first, stubs below): `packages/core/test/unit/llm/ai-candidates-skip-rule-sentences.test.ts`, `ai-dedupe-rule-overlap.test.ts`, `ai-verify-suppresses-rule-duplicates.test.ts`. Required cases in Test Plan.
- [x] B6. Edit `apps/web/src/engine/engine.worker.ts` (minimal, 3 lines): add `ruleFindings?: Finding[]` to `Retained`; at line ~562 next to `kept.aiSites = ai.sites` add `kept.ruleFindings = findings` (the post-suppression `findings` variable at line ~541, so what is shown equals what is compared); in `verifyAi` pass `...(r.ruleFindings ? { ruleFindings: r.ruleFindings } : {})` into the `verifyAiResult` ctx. Import `type Finding` only if not already imported. Do not touch anything else in the file.
- [x] B7. Add `apps/web/e2e/ai-no-duplicates.spec.ts` (preview project, intercept `/api/ai` and `/api/quota` from recordings as the existing AI specs do; any `openrouter.ai` request aborted): (i) an authored hostile recording case `ai-duplicate-of-rule` (added in C-section casebook) returns an AI finding whose quote sits in a sentence that also has a rule finding: assert the Findings list shows no AI row for it and the AI lane count equals the number of AI rows shown; (ii) opening bundled sample #1 (precomputed path) shows no AI row overlapping a rule row.
- [x] B8. Gates (section B): `pnpm --filter @aduin/core test ai-candidates-skip-rule-sentences`, `ai-dedupe-rule-overlap`, `ai-verify-suppresses-rule-duplicates`, `llm-quote-must-exist`, `llm-quote-scoped-to-candidate`, `ai-mask-before-storage`, `wrap-envelope-item-cap`, `llm-task-registry`, `contracts` (one per call); `pnpm --filter @aduin/core typecheck`; `pnpm --filter @aduin/web typecheck`; `pnpm --filter @aduin/web test import-graph` and `no-e2e-hook-in-d`. NOTE: `llm-schema` and the recorded tests are EXPECTED to fail here until Section C (candidate set changed); that is the planned handoff, not a regression. Do not commit B with those two red: commit B and C together as ONE commit only if B5-B8 are green and C is done in the same working session; otherwise commit B with `llm-schema` named in the commit body as pending C. (Preferred: finish C before committing.)

### Section C - Recordings kept honest (offline, no live call)

- [x] C1. Impact scan: run `pnpm --filter @aduin/core test llm-schema`, `llm-quote-must-exist`, `drift-narrative`; `pnpm --filter @aduin/scripts record:author --check`; `pnpm --filter @aduin/scripts precompute:ai --from-recordings --check`. List which recordings fail and why (candidate set drift vs hint drift). Read `scripts/src/record/casebook.ts`, `author-recordings.ts` and `core/test/helpers/recorded-transport.ts` fully before changing anything; if the structure differs from this plan's assumptions, STOP and report to the orchestrator.
- [x] C2. Archive legacy live evidence: copy each affected LIVE recording (sample-01 and sample-03; `counsel-draft-03` is NOT affected, see C3b; confirm the list in C1) unchanged into `process/general-plans/active/ai-review-stream-dedup_18-10-26/legacy-live-recordings/` (outside `fixtures/`, so no loader or glob reads it). The git history also keeps them.
- [x] C2b. Enumerate ALL vanished candidate ids (Gap 1). Run a throwaway script under `scripts/src/spikes/` (not committed) that, for each sample 01/03, compares the OLD candidate ids (read from the archived live recordings' `request.candidates`, plus the ids hard-coded in `casebook.ts`/`author-recordings.ts`/the tests) against `sampleCandidates(id)` AFTER Section B, and writes the list of vanished ids into the REF file. Known to vanish (verified by the validate pass): `c_a3a1fd5641d412c0` (hostile-hallucinated-quote, sample-01 authored/derived raw), `c_fcfcb4a816686edb` and `c_54cd421d8bdba4af` (counsel-draft-03 picks, sample-03 authored raw), `c_53ded8db41297f0a` (firm-rules-in-context-03). Also check `c_b30f291dff2535b6`, `c_624f0f476f804afb`, `c_439057b9bc027023`, `c_777504f5f99ae768`, and `apps/web/test/engine-ai-api.test.ts` / `packages/core/test/recorded/llm-quote-must-exist.recorded.test.ts` / `llm-schema.recorded.test.ts` ids. Ids in `apps/web/public/precomputed/*.none.json` are regenerated in C6.
- [x] C3. Re-point casebook picks (Gap 1). For each vanished id in `casebook.ts` pick lists (`firm-rules-in-context-03`, `hostile-hallucinated-quote`, and any other hostile case found in C2b), replace it with the lowest-index SURVIVING candidate id of the same sample whose block has no rule finding (record the chosen id and why in the REF file); update the matching `case` arms in `author-recordings.ts` (candidate_id and `quote` values; use `quoteOf(r, id, n)` rather than literal quotes so they track the candidate) and the hard-coded ids in `llm-quote-must-exist.recorded.test.ts`, `llm-schema.recorded.test.ts` (lines ~45-48 and any id pins) and `apps/web/test/engine-ai-api.test.ts`. `scripts/test/record-body-parity.test.ts` and the worker `record-body-parity` hostile set iterate `CASES`/recordings by case name, so they follow the re-point; confirm by running them, and add to `scripts/test/record-body-parity.test.ts` one assertion that a case with `fixedCandidates` produces exactly those candidates.
- [x] C3b. `counsel-draft-03` (Gap 1). Its candidates are the confirmed findings' sentences in the app (`apps/web/src/features/counsel/ai-draft.ts` `draftCandidates`), not the engine's `buildAiCandidates`, so D3(a) must not invalidate its live recording. Add `fixedCandidates?: readonly AiCandidate[]` to `RecordingCase`; `caseRequest` uses it when present (instead of `pick`). Store the two literal candidates in `scripts/src/record/fixed-candidates/counsel-draft-03.json` (copied from the archived live recording's `request.candidates`) and set `fixedCandidates` for `counsel-draft-03` with `pick` removed. Result: request, hash and the LIVE file stay byte-identical (no derive, no relabel); `llm-schema.recorded.test.ts` line ~45-48 skips `r.request.task === 'counsel-draft'` in the "candidates equal the engine's" check (the candidates are fixed, not engine-selected). Gate: the counsel-draft-03 live file is untouched in `git status`.
- [x] C3c. Add the authored hostile case `ai-duplicate-of-rule` to `casebook.ts` and `author-recordings.ts` (response: one finding on a surviving candidate in a block that ALSO has a rule finding in a different sentence AND one finding whose quote falls in a rule-anchored sentence via a crafted candidate id taken from the legacy candidate set; the second must be rejected/suppressed). Keep it authored; it feeds B7 and `ai-verify-suppresses-rule-duplicates`.
- [x] C4. Fix `author-recordings.ts` `authorAll` (Gap 2) BEFORE running it. (a) Compute the request and hash first; if the target file exists and is kept (`meta.source === 'live'` OR `request.derived_from` present), record it as `keptLive`/`keptDerived` and `continue` WITHOUT calling `authoredRaw` (so a stale authored arm that cites a removed id cannot throw for a kept file). (b) For `live: true` cases (`sample-01`, `sample-03`, `drift-narrative-05-06`) whose NEW-hash file does not exist yet (derived file not written yet), `authorAll` must NOT write an authored fallback in write mode and in `--check` mode reports `missing (run record:derive)`; so the order is C4 (fix script) -> C5 (derive) -> C6 (author + check). (c) Orphan handling: old-hash LIVE files (`meta.source === 'live'` not in `expected`) are reported as orphans today; after the C2 archive they are removed with `git rm` (not by the script), and `--check` must then pass with zero orphans. Update the file header doc comment accordingly. Unit-test the keep rule in `scripts/test/derive-live-recordings.test.ts` (fixture dir) or a new `scripts/test/author-recordings-keep.test.ts`.
- [x] C5. Write `scripts/src/record/derive-live-recordings.ts` (+ `package.json` script `record:derive`): for each archived live recording of the ENGINE-candidate cases (`sample-01`, `sample-03`; NOT `counsel-draft-03`, which is fixed): rebuild the NEW request (`caseRequest`), keep only findings whose `candidate_id` exists in the new set AND whose old candidate has the same `quote` and `issue_class_hint` as the new one (so the model really saw this exact text); re-serialize `response.raw` deterministically from the kept findings; write the new file keyed by the NEW inputHash with `meta.source = 'authored'`, `meta.recordedAt` from the legacy recording, and `request.derived_from = { inputHash16: <legacy>, source: 'live', kept: n, dropped: m }` (extra key under `request`). Never invents a finding, never edits text. Unit test `scripts/test/derive-live-recordings.test.ts` with synthetic recordings: kept subset, dropped on hint change, dropped on removed candidate, idempotent second run, deterministic bytes. (Simpler alternative accepted by the plan: label derived files `meta.source = 'live-derived'` and have `authorAll` and `LlmRecordingSchema` consumers treat it as kept; use it only if the schema's `meta.source` enum permits it, otherwise keep `authored` + `derived_from`.)
- [x] C6. Run `pnpm --filter @aduin/scripts record:derive`, then `pnpm --filter @aduin/scripts record:author` (writes the authored hostile cases; keeps derived files), `git rm` the old-hash live files for sample-01/03 (the archived copies from C2 remain), then `pnpm --filter @aduin/scripts precompute:ai --from-recordings` (rewrites `apps/web/public/precomputed/{docHash}.none.json` for samples 1 and 3). Review the diff: the precomputed files may shrink; they are still raw model output and are verified again on open (with dedupe) at runtime.
- [x] C7. Update `packages/core/test/recorded/llm-schema.recorded.test.ts` lines 45-48 from "every recorded candidate equals the current graph candidate" to the same assertion over the regenerated recordings PLUS: for any recording carrying `request.derived_from`, assert `source === 'authored'` and `derived_from.inputHash16` is a 16-hex string; add the assertion that no recorded candidate for a sample overlaps a rule anchor (ties AC9 to the corpus).
- [x] C7b. Update web/e2e expectations tied to the regenerated sample-01/03 recordings (Gap 3). Scan and recount from the regenerated recordings (never hard-code from memory): `apps/web/e2e/provenance.spec.ts` (comment "4 model findings, 2 verified, 2 rejected" and `aiRows toHaveCount(2)`), `ai-banners.spec.ts`, `sample-zero-calls.spec.ts`, `counsel-sheet.spec.ts`, `compare-ai-summary.spec.ts`, `apps/web/e2e/fixtures/ai.ts`, and web unit tests `apps/web/test/engine-ai-api.test.ts`, `ai-lane-reopen.test.ts`, `engine-dispatch.test.ts`, `ocr-ai-consent.test.ts`. For each: run it (`pnpm --filter @aduin/web test <token>` / `pnpm --filter @aduin/web test:e2e <token>`, one token per call; coordinate preview port 4317), and change only the asserted counts/ids that moved because a rule-sentence candidate (or its finding) vanished; where a count falls because dedupe suppresses a row, the new number is the verified-minus-suppressed count (derive it, record it in the commit body). If a test fails for any other reason, STOP and report.
- [x] C8. Gates (section C): `pnpm --filter @aduin/core test llm-schema`, `llm-quote-must-exist`, `drift-narrative`; `pnpm --filter @aduin/scripts test derive-live-recordings`; `pnpm --filter @aduin/scripts test record-body-parity`; `pnpm --filter @aduin/scripts record:author --check` (must report zero orphans and zero missing); `pnpm --filter @aduin/scripts precompute:ai --from-recordings --check`; `pnpm --filter @aduin/scripts fixtures:check`; `pnpm --filter @aduin/worker test record-body-parity` (Worker recordings count must still be >= 9); plus the C7b web unit/e2e tokens. Commit B + C: `feat: ai candidates skip rule sentences, verify drops rule duplicates, recordings re-derived offline`.

### Section D - Worker streaming, idle timeout, timeout refund

- [x] D1. `apps/worker/src/upstream/openrouter.ts`: `buildBody` returns `...,"response_format":${responseFormatJson},"stream":true}` (append only); `callOpenRouter` adds header `accept: 'text/event-stream'`. Update the file header comment. Do not add any reasoning parameter.
- [x] D2. Create `apps/worker/src/upstream/sse.ts` exporting `readSse(res: Response, opts: { onActivity: () => void; maxContentChars: number; maxRawBytes: number }): Promise<SseResult>` with `SseResult = { ok: true; content: string; finishReason: string | null; model: string | undefined; usage: unknown; done: boolean; stats: { lines: number; parsed: number; commentLines: number } } | { ok: false; reason: 'malformed' | 'provider_error' | 'stream_truncated' }`. Behavior (all pinned by tests): streaming `TextDecoder` (`stream: true`), carry-over partial line, accept `\n` and `\r\n`, `data:` with or without a following space, `:` comment lines, blank lines ignored; `onActivity()` on every `reader.read()` result; prefilter from the probe (default: parse only if the line contains `"content":"` followed by a non-quote char, `"finish_reason":"`, `"usage"`, `"error"`, or `model` not yet seen); only `choices[0]` is read; `delta.content` string appended; `finish_reason` kept; `usage` kept (last wins); top-level `error` or `finish_reason === 'error'` -> `provider_error`; raw bytes over `maxRawBytes` or content over `maxContentChars` -> cancel reader, `malformed`; `[DONE]` ends cleanly; clean EOF without `[DONE]`: if `finishReason !== null` accept, else `stream_truncated`; always `reader.cancel()` (swallow errors) when returning early. Abort race (Gap 5): `readSse` takes `signal: AbortSignal` in its options; each `reader.read()` is raced explicitly (`Promise.race([reader.read(), abortRejection])` where `abortRejection` rejects on the signal's `abort` event and is removed in `finally`), and an already-aborted signal is checked before the first read, so a stalled `read()` that real workerd would not reject after headers still ends on abort. Never echo any upstream text into reasons or logs. Test (in `upstream-timeouts`/`sse-failure-shapes`): a stub body whose `read()` never settles and ignores abort must still resolve `readSse` with an abort-derived result when the signal fires.
- [x] D3. `apps/worker/src/upstream/classify.ts`: extract the tail (from `choice`/content handling to the final return) into `finish(kind, { content, finishReason, model, usage }, ai)` used by BOTH paths; JSON path unchanged (same behavior, same `malformed` conditions); add `classify(kind, res, ai?, hooks?: { onActivity?: () => void; signal?: AbortSignal })` (the signal is forwarded to `readSse`); if `res.ok` and content-type starts with `text/event-stream`, call `readSse` with `maxContentChars = MAX_UPSTREAM_BYTES` (2 MiB) and `maxRawBytes = 8 MiB`, map `provider_error` -> `{reason:'provider_error', retryable:true, consumed:true}` (no providerFault: all claims kept), `stream_truncated` -> `{reason:'stream_truncated', retryable:false, consumed:true, providerFault:true}`, `malformed` -> the existing `malformed` object. Status handling above the 200 path is untouched.
- [x] D4. `apps/worker/src/proxy/pipeline.ts`: set `UPSTREAM_TIMEOUT_MS = 420_000` (AI ceiling) and add `export const UPSTREAM_OCR_TIMEOUT_MS = 240_000` (OCR keeps today's value); add `export const UPSTREAM_IDLE_MS = 60_000` (or the probe-adjusted value); add `upstreamIdleMs: number` and `upstreamOcrTimeoutMs: number` to `ProxyContext` and optional `upstreamIdleMs?`/`upstreamOcrTimeoutMs?` to `ProxyDeps` (lines ~89-104); in `once()`: keep the ceiling timer; add the idle mechanism (Gap 5, CPU-cheap): `onActivity` is ONLY `lastActivity = ctx.now()` (a timestamp write; NO clearTimeout/setTimeout per read, so thousands of reasoning deltas cost almost nothing). One re-checking timer: `ctx.timers.setTimeout(check, idleMs)`; `check` computes `idleFor = now - lastActivity`; if `idleFor >= idleMs` it sets `timedOut = true`, logs `proxy.upstream_idle_timeout` and aborts, else it re-arms itself for `idleMs - idleFor`. The timestamp is initialised at dispatch (so a silent connect trips it). Use the existing `ctx.now` (pipeline.ts line 99); in `apps/worker/test/fakes/harness.ts` verify `ctx.now` advances together with `FakeTimers.now` when a test calls `advance()` (FakeTimers has its own `now`, line 37); if they are separate clocks, wire the harness `now` to `() => timers.now` so the check timer and the timestamp use one clock. Idle applies only when `kind === 'ai'` (C4); for OCR no idle timer is created and the ceiling is `upstreamOcrTimeoutMs` (240 s). `classify` receives `{ onActivity, signal }`; ceiling callback logs `proxy.upstream_ceiling_timeout`; clear BOTH timers in `finally`; in the catch return, change the `providerFault` spread to `...(!signal.aborted ? { providerFault: true } : {})` (so network AND timeout are provider faults; a client abort stays kept) and fix the adjacent comments. Update the file header comment (timeout now refunds visitor claims, global + spend kept) and the `once()` doc comment (no more "240 s", no "measured 100-157 s").
- [x] D5. `apps/worker/src/routes/proxy/index.ts` (about line 28): add `upstreamIdleMs: p.upstreamIdleMs ?? UPSTREAM_IDLE_MS` next to `upstreamTimeoutMs`; import the constant.
- [x] D6. Verify (read-only) `refundVisitorScoped()` in `apps/worker/src/limits/policy.ts` refunds exactly the visitor-scoped tokens (`reqV`, `docV`, `docIp`; keeps `global_ai` and `spend`): confirmed by reading lines 95-101; no code change expected. If scopes differ, add a scope-assertion test rather than changing policy.
- [x] D7. Verify (read-only) `apps/web/src/features/ai/banner-map.ts` `bannerFor` for `reason: 'timeout'` and `'stream_truncated'`; if `stream_truncated` is not mapped to `provider_error`, change the Worker to emit `reason: 'network'` for truncation (keeps the web untouched) and update AC6 expectations accordingly.
- [x] D8. Typecheck only (tests come in E, written first in red, see below): `pnpm --filter @aduin/worker typecheck`.

### Section E - Worker test infra and tests (written red-first, then D makes them green)

Order of work: E1-E3 BEFORE D1-D5 are implemented (TDD red), then implement D, then run E gates.
- [x] E1. `apps/worker/test/fakes/openrouter-stub.ts`: (a) in `fetch`, when `init.body` JSON has `stream === true` and the reply is `status 200` with `json.choices` an array, build an SSE `Response` (`content-type: text/event-stream`) from it: one role chunk, content split into 64-char deltas, a finish chunk with the reply's `finish_reason` (default `stop`), a usage chunk (`choices: []`, `usage` from the reply, `cost` passed through), `data: [DONE]`; model in every chunk; (b) new `StubReply` variants: `{ sse: { chunks: string[] } }` (raw strings enqueued as given, so tests control chunk boundaries and malformed lines), `{ sseStall: { chunks: string[] } }` (enqueue the chunks, then never close; on `signal` abort error the stream with an `AbortError` and `this.aborted++`) and `{ sseLive: (ctl: SseController) => void }` (Gap 4): the stub creates the `ReadableStream` with a captured controller and hands the test an `SseController` `{ push(raw: string): void; close(): void; error(e?: unknown): void }` immediately after headers, so a test can interleave `push()` calls with `FakeTimers.advance()` (needed for AC3 re-arm: a comment every 30 s for 5 minutes, reasoning lines every 30 s, then 60 s of silence; and for the ceiling case). On `signal` abort the stream errors with `AbortError` and `this.aborted++`; `push` after close/abort is a no-op; (c) helper `sseLines(opts)` that generates `reasoningLines` reasoning-only chunks, optional comment lines, content deltas, final chunks. Every existing test that scripts `okAi`/JSON must pass UNMODIFIED (that is the regression proof for the stub).
- [x] E2. `apps/worker/test/fakes/harness.ts`: add `upstreamIdleMs?: number` to `makeHarness` opts and pass it to `proxy`.
- [x] E3. New test files, AC3 re-arm and ceiling cases built on `sseLive` (stubs and required cases in the Test Plan): `sse-assemble`, `sse-failure-shapes`, `sse-cheap-parse`, `upstream-timeouts`, `timeout-refund` under `apps/worker/test/proxy/`.
- [x] E4. Update `apps/worker/test/proxy/stream-holdopen.test.ts`: the hang case advances `UPSTREAM_IDLE_MS` and expects `1 + UPSTREAM_IDLE_MS / HEARTBEAT_MS` heartbeats; add a case proving heartbeats continue to `UPSTREAM_TIMEOUT_MS` while an SSE stream keeps producing comments; keep `waitUntilCalls === 0` and `timers.pending === 0`.
- [x] E5. Update `apps/worker/test/proxy/llm-failure-injection-matrix.test.ts` timeout test: rename to "upstream timeout aborts upstream and refunds visitor claims, keeps global (D2)", advance `UPSTREAM_IDLE_MS`, assert `expectVisitorRefundedGlobalKept(h)`, `reason: 'timeout'`, `h.or.aborted === 1`, zero ledger rows, zero cache writes.
- [x] E6. Update `apps/worker/test/llm/record-body-parity.test.ts` `expectedBody` to end with `,"stream":true}` after `response_format`; keep the inputHash and replay assertions; the replay goes through the stub auto-SSE so it also proves AC2 for every recording.
- [x] E7. Gates (section D+E), one token per call: `pnpm --filter @aduin/worker test sse-assemble`, `sse-failure-shapes`, `sse-cheap-parse`, `upstream-timeouts`, `timeout-refund`, `stream-holdopen`, `llm-failure-injection-matrix`, `record-body-parity`, `llm-ocr-cache-hit`, `proxy-budget`, `ocr-never-sends-pdf`, `secret-non-leak`, `free-only-config`, `rules-echo`, `abuse-protection-matrix`, `per-visitor-ai-limit-e2e`, `global-daily-cap-and-budget`, `spend-cap-enforced`; then the whole worker suite `pnpm --filter @aduin/worker test` (baseline 526 tests); `pnpm --filter @aduin/worker typecheck`. Commit D+E: `feat: stream upstream with idle timeout, refund visitor claims on timeout`.

### Section F - Whole-repo regression (EVL-shaped, before any deploy work)

- [x] F1. `pnpm typecheck`; `pnpm lint` (runs eslint + prettier check; run `pnpm exec prettier --write` on touched files first if it fails; `.prettierignore` already excludes the generated recording dirs).
- [x] F2. Whole suites, serially, one agent at a time: `pnpm --filter @aduin/core test` (baseline 3084 + 3 skip, plus new), `pnpm --filter @aduin/web test` (baseline 298), `pnpm --filter @aduin/scripts test` (baseline 162), `pnpm --filter @aduin/worker test`. Coordinate with the other web session before `pnpm --filter @aduin/web test:e2e ai-no-duplicates` and the full preview suite `pnpm --filter @aduin/web test:e2e` (baseline 217 pass + 1 opt-in skip; shares port 4317 and `test-results`).
- [x] F3. `pnpm guard:cf` and `pnpm secrets:scan`.
- [x] F4. Local CPU proxy: confirm `sse-cheap-parse` is green (parse count bound) and record the stats object for a synthetic 6000-reasoning-line stream in the report.

### Section G - Process records (docs only, no behavior)

- [x] G1. `process/context/worker/all-worker.md`: Pipeline Order step 10 (streamed SSE upstream, idle 60 s + ceiling 420 s, `hb` unchanged) and 11 (SSE assembly then classify); Refund Policy (DV10) timeout row -> visitor refunded, global + spend kept, add a `stream_truncated` row and a `mid-stream error chunk` row; Limits section: `UPSTREAM_IDLE_MS`, `UPSTREAM_TIMEOUT_MS` (ceiling), 2 MiB content / 8 MiB raw caps; Known Gaps: live CPU result and the OCR-stream residual. Keep the "Last updated" line.
- [x] G2. `process/context/engine/all-engine.md`: candidate selection no longer includes deterministic-finding sentences; `dropRuleDuplicates` and `verifyAiResult` `ruleFindings`/`suppressed`; recording policy (derived recordings labeled `authored` with `derived_from`).
- [x] G3. `process/context/tests/all-tests.md`: new tokens (`sse-assemble`, `sse-failure-shapes`, `sse-cheap-parse`, `upstream-timeouts`, `timeout-refund`, `ai-candidates-skip-rule-sentences`, `ai-dedupe-rule-overlap`, `ai-verify-suppresses-rule-duplicates`, `derive-live-recordings`, e2e `ai-no-duplicates`) and the stub's SSE modes.
- [x] G4. Gate (grep): `grep -c "UPSTREAM_IDLE_MS" process/context/worker/all-worker.md` >= 1; `grep -n "upstream timeout" process/context/worker/all-worker.md` row no longer says "kept | kept".
- [x] G5. UPDATE PROCESS owns the final context audit (`vc-audit-context`, `vc-audit-plans`); EXECUTE only edits the lines above. (UPDATE PROCESS 18-10-26: vc-audit-context + vc-audit-plans validators run; see report)

### Section H - Deploy from a clean worktree at the live base

Preconditions: sections A-G green and committed on the working branch; the user has approved deploying (autopilot hard stop class if the run is autonomous: a deploy is outward-facing and must be in the validate-contract or approved; `git push` is never done).
- [x] H1. Identify the live base: `process/context/worker/all-worker.md` says live version `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f` = web assets from main `a4d7a34`, Worker code unchanged from `994ea54`. Base commit = `a4d7a34`. Confirm with `git log --oneline -1 a4d7a34` and `git diff --stat 994ea54 a4d7a34 -- apps/worker` (expect empty). DONE 18-10-26: live base was hotfix b04f1a8c (a4d7a34 + c7fcb17), not 3d2c7301; see Deviations.
- [x] H2. Create a separate worktree (never reuse the current one): `git worktree add ../deploy-ai-stream-18-10-26 -b deploy/ai-stream-18-10-26 a4d7a34` from the repo root (path outside `.claude/worktrees`). Do not touch `main`. DONE: worktree .claude/worktrees/deploy-ai-stream, branch deploy/ai-stream-dedup (name differs from plan).
- [x] H3. Cherry-pick ONLY this plan's code commits (sections B+C, D+E) in order, with `git cherry-pick -x <sha>`; do NOT cherry-pick any `process:` commits or anything from the variance range (`f93fd9a`..`84d26d5`, `42b3ecb`..`0ee9fca`). Expected conflict surfaces: `packages/core/src/llm/index.ts`, `apps/web/src/engine/engine.worker.ts` (variance/package edits), `scripts/src/record/casebook.ts`. Resolve by keeping the live-base side plus only this plan's hunks; if a conflict needs a variance hunk, STOP and report. DONE: 4 cherry-picks (a2a7047, a737a51, 372bb7d, d7b7756); review.ts conflict resolved to base text.
- [x] H4. Deploy-tree gates: (a) `git diff --stat a4d7a34..HEAD` lists only files from this plan's Touchpoints (fail if any other path appears); (b) `ls apps/worker/migrations` shows exactly 0001-0005 and `grep -rn "0006\|variance" apps/worker/wrangler.jsonc apps/worker/migrations` returns nothing; (c) `pnpm install --frozen-lockfile`; (d) in this tree run `pnpm typecheck`, `pnpm --filter @aduin/worker test`, `pnpm --filter @aduin/core test ai-candidates-skip-rule-sentences`, `ai-dedupe-rule-overlap`, `llm-schema`, `pnpm --filter @aduin/web test import-graph`, `pnpm --filter @aduin/scripts record:author --check`, `pnpm --filter @aduin/scripts precompute:ai --from-recordings --check`, `pnpm guard:cf`, `pnpm secrets:scan`. DONE: all deploy-tree gates green (see REF Section H).
- [x] H5. Build and deploy using the recipe in `all-worker.md` ("Deploy Rules And Redeploy Recipe"): `VITE_TURNSTILE_SITE_KEY=<public site key> pnpm --filter @aduin/web build` where the site key is a PUBLIC value (Gap 9) read from one of two sources, in this order: (1) the currently served live bundle (`curl` the live HTML, find the JS asset, extract the `0x...` Turnstile sitekey string; the Worker secret `TURNSTILE_SECRET` is never needed or read); (2) the allow-listed `GET /accounts/{id}/challenges/widgets` call in `scripts/src/live/common.ts` (read the widget's `sitekey`, never the secret). `docs/DEPLOY.md` and the phase reports name the variable but do not hold the value. Verify after build that the built `dist` contains the same sitekey string as the live bundle; `pnpm --filter @aduin/scripts deploy:preflight` (13 checks); `pnpm --filter @aduin/worker exec wrangler deploy` (Cloudflare credentials from `~/.config/cloudflare/credentials.env`, loaded per command; never zone `itsjiathao.com`, no route, workers.dev only). One deploy ships Worker + web together (the "Worker before web" rule is satisfied atomically). Record the new version id; the rollback target is `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f`. DONE: version 8a82ead2-07ed-4b06-ad60-226d3f4734c8; rollback b04f1a8c-41f5-4c20-92dc-196d6e7d252a.
- [x] H6. Post-deploy checks: `/api/health` 200 `no-store`; CSP unchanged; `/api/memory/health` schema 5 (proves 0006 did not ship); `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` green (zero upstream calls). DONE with deviation: stack smoke replaced by headless Chromium check (port 4317 busy); health, CSP, schema 5 OK.

### Section I - Live verification (real browser, human Turnstile; END-TO-END UPLOAD)

The live verification is an end-to-end UPLOAD of the local NG3 `.docx` through the real Upload UI in a real browser (not a bundled sample, not an API script). Known separate issue (under investigation by a debugger, outside this plan): uploading the NG3 `.docx` on the CURRENT live app fails at the "Reading" stage. Section I depends on that fix landing (and being deployed or bundled into the Section H deploy tree) first; if the fix is not in the deploy base `a4d7a34` + this plan's commits, STOP at I0 and report to the orchestrator rather than treat the failure as this plan's.

AI needs a Turnstile token, so a human in a real browser is required (automated Chromium gets none, residual R2). If the executing agent has no real-browser tool, hand the user the exact script below and record their result; do not fake it with an API script.
- [x] I0. PLACEHOLDER (blocking precondition): confirm upload "Reading" succeeds for the NG3 `.docx` on the target deployment (fix from the upload-reading investigation; the debugger's findings/commit id to be filled in by the orchestrator before EXECUTE reaches H). Pass = the file upload reaches "Checks done" with deterministic findings visible. If it fails at "Reading", do not proceed to I1-I5 and do not roll back this plan's deploy for that reason alone. DONE: NG3 .docx upload reached "Checks done" on live 8a82ead2.
- [x] I1. Start `wrangler tail aduin-transaction-web --format json` in a terminal (read-only; Cloudflare credentials as above) and save only `cpuTime`, `wallTime`, `outcome` for `/api/ai` events into the task folder REF file (no request/response bodies, no cookies). CPU method (Gap 8): the named method is the `workerCpu` GraphQL template in `scripts/src/live/common.ts` (`ANALYTICS_TEMPLATES.workerCpu`: `workersInvocationsAdaptive` quantiles `cpuTimeP50`/`cpuTimeP99`/`wallTimeP50`/`wallTimeP99`, filtered by `accountTag` and `scriptName: aduin-transaction-web`), run via the existing `probe:live-ai --tail` path. Record p99 BEFORE the deploy (query a window of at least 24 h before H5, e.g. the existing 16 ms observation re-read) and AFTER the NG3 run (a window covering only the I2 run); `wrangler tail` `cpuTime` is the per-event cross-check, not the primary number. PARTIAL: no wrangler tail kept; CPU before-deploy p99 35.0 ms recorded via workerCpu GraphQL; CPU after not measured (AC7b residual, backlog).
- [x] I2. In a real browser open https://aduin-transaction-web.giathaowork.workers.dev, use the Upload UI to select the LOCAL file `samples/packages/01-northgate-infrastructure-iii/docs/01-NG3-Subscription-Agreement.docx` (single file; do not use bundled samples; do not call the API directly), wait for deterministic findings, solve the Turnstile challenge if shown, let the AI review run. Record start/stop wall clock and the DevTools Network `Time` of the `POST /api/ai` request (one attempt; a second attempt only if the first fails for a non-quota reason; per-visitor cap is 3 fresh-AI documents per UTC day, global 50/day). DONE 18-10-26 ~18:53Z by orchestrator via Playwright Chromium (Turnstile issued a token automatically, flexible mode; not a human). /api/ai 178.5 s.
- [x] I3. Pass criteria: terminal `result` frame (no error banner); duration recorded; **clear margin** = `UPSTREAM_TIMEOUT_MS - duration >= 120 s` (duration <= 300 s) and the idle timer never fired (no `timeout` error); if 300 s < duration < 420 s record PASS-WITH-CONCERN and file a backlog note; any `timeout` error = FAIL (then rollback decision below). PASS: terminal result, no timeout error; margin 241.5 s to the 420 s ceiling (duration <= 300 s).
- [x] I4. Duplicate check: list the AI findings (AI badge) and the deterministic findings; for each AI finding confirm its quoted sentence is not the sentence of any deterministic finding (placeholder, NTD drafting note, the two broken cross-references must appear ONLY as deterministic rows). Take screenshots into the task folder. Pass = zero duplicates. PASS: 16 findings (7 deterministic, 8 AI suggestions + 1 other); zero AI findings duplicate a deterministic one (AC12/AC18).
- [x] I5. Record in the REF file: duration, `cpuTime` values vs the old p99 16 ms observation (AC7b: record p99 before/after (GraphQL `workerCpu`) and compare; if a streamed review's `/api/ai` event shows cpuTime over 50 ms, file backlog note `worker-sse-cpu` and consider the coalesced-parse fallback in Risks), AI finding count, rejected count, served model, `cost` (must be 0). PARTIAL: duration and counts recorded; cpuTime after the run not measured (AC7b open).
- [x] I6. Optional O1 (needs user OK; free model, $0): `ALLOW_LIVE_LLM=1 pnpm --filter @aduin/scripts record:ai --max-requests 2` to re-record samples 1 and 3 live on the NEW candidate sets, then `record:author`, `precompute:ai --from-recordings` and re-run the section C gates. Skip if the daily free allowance is tight; K3 stays a documented Known-Gap otherwise. SKIPPED: optional O1 not run; K3 stays a documented Known-Gap.

## Test Plan (vc-test-coverage-plan output; context chain loaded: `all-tests.md`, worker, engine)

Tier assignments waterfall: every behavior with a deterministic command is Fully-Automated; live-provider and live-deploy items are Hybrid/Agent-Probe; Known-Gap rows are residuals with backlog stubs (see register above).

### Area: apps/worker (`upstream/sse.ts`, `classify.ts`, `pipeline.ts`)

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-automated | SSE assemble: content split at every possible byte boundary (including mid multibyte char and mid `\r\n`), comments, `data:` with/without space, `[DONE]`, usage-only final chunk with `choices: []`, `cost` read, `model` read | `pnpm --filter @aduin/worker test sse-assemble` | AC2: assembled result equals the JSON-path result | Real OpenRouter byte framing (probe P1a/b, K2) |
| Fully-automated | Replay all recordings through auto-SSE | `pnpm --filter @aduin/worker test record-body-parity` | AC1, AC2 over 9+ recordings | live model behavior |
| Fully-automated | Idle timeout: `sseStall` after 2 chunks, advance `UPSTREAM_IDLE_MS`; re-arm cases: a comment every 30 s for 5 minutes never times out; reasoning lines every 30 s likewise; then silence for 60 s times out; silent connect (no headers) times out at idle | `pnpm --filter @aduin/worker test upstream-timeouts` | AC3 | real network stalls |
| Fully-automated | Ceiling: chunks every 10 s forever, advance to `UPSTREAM_TIMEOUT_MS`: aborted with `timeout`; `timers.pending === 0` afterwards; heartbeats counted | same file | AC4 | - |
| Fully-automated | Timeout refund: idle and ceiling both refund visitor claims, keep global + spend, no cache, no ledger; client abort after dispatch still keeps all | `pnpm --filter @aduin/worker test timeout-refund` and `llm-failure-injection-matrix` | AC5 | OpenRouter accounting of aborted streams (known unknown, R2) |
| Fully-automated | Failure shapes (AC6 list) incl. JSON 200-with-error body, `finish_reason: length`, content over 2 MiB, raw over 8 MiB, mid-stream reset (stub stream errors), EOF without finish | `pnpm --filter @aduin/worker test sse-failure-shapes` | AC6 | - |
| Fully-automated | Cheap parse: 6000 reasoning-only lines + 300 content lines + finish + usage: `stats.parsed <= 305`; hostile line that contains the string `"content":"` inside a reasoning delta still parsed safely | `pnpm --filter @aduin/worker test sse-cheap-parse` | AC7 | real CPU (see AC7b) |
| Fully-automated | Browser contract: hb lines valid, one terminal, no waitUntil | `pnpm --filter @aduin/worker test stream-holdopen`; `pnpm --filter @aduin/core test contracts` | AC8 | - |
| Hybrid | Stub fidelity vs a real SSE capture: the `sse-assemble` golden lines are copied from the probe REF (sanitized) so the parser is tested against real framing | `pnpm --filter @aduin/worker test sse-assemble` (precondition: probe done, REF present) | parser matches real shape at probe time | later provider drift (K2) |
| Agent-probe | Live CPU and duration of a streamed review | I1-I5 | AC7b, AC17 | other docs |
| Known-gap | OCR streaming against the live provider | - | - | K1, backlog stub |

Failing stubs (TDD red-first, for the validate-contract Test Gates; not written to disk during PLAN):
```
test("should assemble identical content when the SSE body is split at every byte boundary", () => {
  throw new Error("NOT IMPLEMENTED - TDD stub for: sse assemble at every boundary")
})
test("should abort and return reason timeout when no upstream byte arrives for UPSTREAM_IDLE_MS", () => {
  throw new Error("NOT IMPLEMENTED - TDD stub for: idle timeout")
})
test("should refund reqV docV docIp and keep global and spend on upstream timeout", () => {
  throw new Error("NOT IMPLEMENTED - TDD stub for: timeout refund D2")
})
test("should never JSON.parse a reasoning-only data line", () => {
  throw new Error("NOT IMPLEMENTED - TDD stub for: cheap parse")
})
```

### Area: packages/core (`llm/candidates.ts`, `llm/dedupe.ts`, `llm/verify-quote.ts`)

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-automated | Candidates skip rule sentences: synthetic doc with a rule finding in sentence 2 of a 3-sentence block: sentence 2 absent, sentences 1/3 only if picked by P1-P3; rule anchor spanning two sentences excludes both; anchor with offsets past text length clamps; two rule findings same block; option-group pick (start 0,end 1) skipped when first sentence is rule-anchored; non-rule findings (`ai`) never exclude; cap 40 still honored; ids of retained candidates identical to before; samples 1 and 3: no candidate site overlaps a rule anchor | `pnpm --filter @aduin/core test ai-candidates-skip-rule-sentences` | AC9 | model quality on the smaller set (K3) |
| Fully-automated | `dropRuleDuplicates`: overlap true/false matrix, adjacency (`[0,5)` vs `[5,9)`) not overlap, zero-length anchor, same range different block, any class, AI-vs-AI kept, order preserved, hostile numbers (NaN, negative) never throw | `pnpm --filter @aduin/core test ai-dedupe-rule-overlap` | AC10 | - |
| Fully-automated | `verifyAiResult` with and without `ruleFindings`; `suppressed` count; no `suppressed` key without it; verified finding on a rule-anchored sentence dropped, other kept; recorded outputs unchanged without ctx | `pnpm --filter @aduin/core test ai-verify-suppresses-rule-duplicates`; `llm-quote-must-exist`; `llm-quote-scoped-to-candidate`; `ai-mask-before-storage`; `llm-schema`; `llm-task-registry` | AC11 | web wiring (next area) |

Failing stubs:
```
test("should exclude sentences already flagged by a rule finding from AI candidates", () => {
  throw new Error("NOT IMPLEMENTED - TDD stub for: candidates skip rule sentences")
})
test("should drop an AI finding that overlaps a rule anchor in the same block of any class", () => {
  throw new Error("NOT IMPLEMENTED - TDD stub for: dropRuleDuplicates")
})
```

### Area: apps/web (engine worker verify path, lane count) and recordings

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-automated | Preview e2e: AI result with a duplicate-of-rule finding shows no extra row; lane count equals shown AI rows; bundled sample #1 precomputed path shows no overlap | `pnpm --filter @aduin/web test:e2e ai-no-duplicates` (precondition: preview port 4317 free) | AC12 | live model output |
| Fully-automated | Import allow-list unchanged (engine worker is not main-thread) and no e2e hook in dist | `pnpm --filter @aduin/web test import-graph`, `no-e2e-hook-in-d` | no new main-thread core value import | - |
| Fully-automated | Recordings honesty | `pnpm --filter @aduin/scripts record:author --check`; `pnpm --filter @aduin/scripts precompute:ai --from-recordings --check`; `pnpm --filter @aduin/scripts fixtures:check`; `pnpm --filter @aduin/scripts test derive-live-recordings` | AC13 | that the live model would answer the new prompt the same way (K3, optional O1) |
| Fully-automated | Whole-suite regression | `pnpm typecheck`; `pnpm lint`; `pnpm --filter @aduin/core test`; `pnpm --filter @aduin/web test`; `pnpm --filter @aduin/worker test`; `pnpm --filter @aduin/scripts test`; `pnpm --filter @aduin/web test:e2e` | AC19 | - |
| Fully-automated | Doc grep gates | G4 commands | AC14 | - |

### Gap resolution options

| Gap | Resolution options |
|---|---|
| K1 live OCR streaming unproven | A) one human OCR upload after deploy (needs Turnstile) - 10 min. B) none. C) accept: OCR already unproven live (R2). D) backlog `ocr-streaming-live-proof_NOTE_18-10-26.md` in `process/general-plans/backlog/`. Chosen: C + D. |
| K2 provider SSE drift | A) scheduled probe script - out of scope. B) - . C) accept after the probe REF. D) backlog `openrouter-sse-contract-recheck_NOTE_18-10-26.md`. Chosen: C + D. |
| K3 model quality on the new candidate set | A) O1 live re-record (free). B) - . C) accept with the single live NG3 run as the only evidence. D) backlog `ai-quality-new-candidates_NOTE_18-10-26.md`. Chosen: C + D, O1 optional. |

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm --filter @aduin/worker test record-body-parity` | Fully-Automated | AC1, AC2 |
| `pnpm --filter @aduin/worker test sse-assemble` | Fully-Automated | AC2 |
| `pnpm --filter @aduin/worker test upstream-timeouts` | Fully-Automated | AC3, AC4 |
| `pnpm --filter @aduin/worker test timeout-refund` and `llm-failure-injection-matrix` | Fully-Automated | AC5 |
| `pnpm --filter @aduin/worker test sse-failure-shapes` | Fully-Automated | AC6 |
| `pnpm --filter @aduin/worker test sse-cheap-parse` | Fully-Automated | AC7 |
| live `wrangler tail` cpuTime during the NG3 run | Agent-Probe | AC7b |
| `pnpm --filter @aduin/worker test stream-holdopen` and `pnpm --filter @aduin/core test contracts` | Fully-Automated | AC8 |
| `pnpm --filter @aduin/core test ai-candidates-skip-rule-sentences` | Fully-Automated | AC9 |
| `pnpm --filter @aduin/core test ai-dedupe-rule-overlap` | Fully-Automated | AC10 |
| `pnpm --filter @aduin/core test ai-verify-suppresses-rule-duplicates` (+ existing llm tests) | Fully-Automated | AC11 |
| `pnpm --filter @aduin/web test:e2e ai-no-duplicates` | Fully-Automated | AC12 |
| `record:author --check`, `precompute:ai --from-recordings --check`, `fixtures:check`, `derive-live-recordings` test | Fully-Automated | AC13 |
| grep gates G4 | Fully-Automated | AC14 |
| probe REF file + `pnpm secrets:scan` | Hybrid | AC15 |
| deploy-tree diff gate H4 + `deploy:preflight` + live health/schema-5/stack smoke | Hybrid | AC16 |
| NG3 Upload UI live run (I2-I3) | Agent-Probe | AC17 |
| AI vs deterministic list comparison + screenshots (I4) | Agent-Probe | AC18 |
| whole-suite regression EVL (F1-F3) | Fully-Automated | AC19 |

## Risk Predictions (5-persona pre-implementation debate)

| Persona | Prediction | Mitigation in this plan |
|---|---|---|
| Skeptic (protocol) | The free model or OpenRouter may reject or degrade `stream:true` with strict `json_schema`, or put the JSON in `reasoning` fields. | Probe A3/A4 BEFORE any code; STOP row in the decision table; no code is written on an unverified assumption. |
| Performance | Thousands of reasoning deltas make per-line `JSON.parse` blow the 10 ms Free CPU budget (p99 is already 16 ms). | Prefilter never parses reasoning-only lines; parse-count gate (AC7); live `cpuTime` (AC7b); fallback: coalesce idle-timer resets to once per second and parse only content-bearing lines (rule in step I5). |
| Abuse/security | Refunding visitor claims on timeout (D2) lets a visitor induce slow prompts and loop upstream calls (review M2 reversed by decision). | Global counter (50/day) and spend stay held; pre-limit 6 AI req/min per IP stays; idle detection now ends a stalled call in 60 s so the loop is cheaper for the provider, not the visitor; documented as accepted residual in `all-worker.md`. |
| Data/recordings | Re-deriving recordings fabricates evidence or hides drift. | Derived files are labeled `authored` with `derived_from`, only the model's real findings on text it actually saw are kept, legacy live copies archived, no live call in gates, optional honest re-record O1. |
| Release | Deploying from main ships Variance migration 0006 and unfinished variance code. | Clean worktree from `a4d7a34`, cherry-pick of this plan's commits only, diff-stat allow-list gate, `/api/memory/health` must say schema 5. |

Key failure modes: (1) provider sends an in-band error mid-stream after content started: handled as `provider_error`, all claims kept, nothing cached. (2) `finish_reason: length` in the final chunk: malformed, kept (unchanged). (3) idle timer fires at the same instant the final chunk arrives: `classify` result wins if it resolved first; if the abort wins, the call is a timeout and refunded visitor-side (global still held): acceptable. (4) a stub-only parser bug: Hybrid gate copies real probe lines into `sse-assemble`.

## Edge Cases (vc-scenario for the three highest-risk items)

1. SSE reader: multibyte UTF-8 split across two network chunks (streaming `TextDecoder`); `\r\n`; `data:` without space; multiple `choices` (read index 0 only); `delta.content: null`; `choices: []` with usage; `[DONE]` before usage (keep reading to EOF is NOT done after `[DONE]`: usage must arrive first per OpenRouter; if the probe shows otherwise, change per decision table); extremely long single line (over raw cap: malformed, cancel); an `error` key inside a content string must not be mistaken for a top-level error (prefilter hit leads to a full parse, and only the parsed top-level `error` counts); a `data:` line that is not JSON: ignore if comment-like, `malformed` if it was a content line; upstream sends JSON (not SSE) with 200: JSON path; compressed/`content-encoding` not applicable in workerd fetch.
2. Timers: idle armed at dispatch; re-armed on EVERY read including a comment-only read; ceiling never re-armed; both cleared in `finally` (tests assert `FakeTimers.pending === 0`); client disconnect during the stream aborts the controller (reason `client_abort`, all claims kept: unchanged); abort after the result already classified must not flip the result; idle value from probe C1.
3. Candidate dedupe: rule anchor longer than the block text; anchors from multiple rule findings in one sentence; option-group pick at `start 0,end 1`; headings skipped already; sentence snapped differently than the rule anchor (snap start earlier but still overlapping: skipped); a document where all deterministic findings are removed from candidates leaves `0` candidates (the lane already returns early on empty candidates at `ai-lane.ts:215,310`, and the Worker schema `min(1)` is never hit); `candidateSitesFor` recomputes with plain `runDeterministic` (no package suppression), consistent because the engine worker passes `aiSites` when available.

## Security (quick STRIDE of the changed flow)

- Spoofing/Tampering: upstream is pinned to `https://openrouter.ai` (`redirect: 'manual'`, bearer key only to that host); SSE bytes are untrusted: never echoed into reasons/logs (class names only), caps bound memory and CPU (content 2 MiB, raw 8 MiB, ceiling 420 s).
- Repudiation/Info disclosure: logs carry counts and reason strings only; the probe script never prints or stores the key; REF file holds no document text beyond short redacted prefixes; `pnpm secrets:scan` gate.
- DoS: idle plus ceiling bound hold-open time; refund on timeout raises abuse headroom (see Risk table); global and spend remain held.
- Elevation: no new route, no new binding, no new secret, no client-controlled upstream field (still whitelisted shape).

## Rollback

- Code: revert the section D+E commit (Worker streaming) independently of B+C (dedup); either can be reverted alone: the stub/test changes ride with their section. If only the stream misbehaves, set the ceiling back and revert D+E: no data migration involved.
- Deploy: `pnpm --filter @aduin/worker exec wrangler rollback 3d2c7301-a4a5-487c-bd7d-2f2c0800be6f` (documented rollback target; no D1 change, so the Worker and web roll back together safely). Remote D1 stays at schema 5 throughout.
- Recordings/precomputed: restore from git (`git checkout <base> -- fixtures/llm-recordings apps/web/public/precomputed` is NOT to be run in the shared checkout; instead `git revert` the B+C commit) and legacy live copies remain in the task folder.
- Decision rule after deploy: AI review failing with `timeout` on the NG3 run, or any CPU `exceededCpu` outcome in `wrangler tail`, means rollback first, diagnose second.

## Phase Completion Rules

- Status vocabulary: `CODE DONE` = code and its own section gates green; `VERIFIED` = the validate-contract gates re-run green by a spawned vc-tester (EVL) AND, for Sections H and I, the deploy-tree gates and the live NG3 run recorded. Code-only completion is never `VERIFIED`.
- Section exit gates: A = REF file plus clean secrets scan; B and C = core and scripts gates (committed together); D and E = worker gates; F = whole-repo regression; G = doc grep gates; H = deploy-tree diff allow-list, `deploy:preflight`, live health and schema 5; I = AC17/AC18 evidence in the REF file.
- A Known-Gap (K1-K3) never makes a gate PASS-able by itself: those rows stay CONDITIONAL with a backlog stub; AC1-AC14 and AC19 do not rely on any Known-Gap.
- Sections H and I need explicit user approval (outward-facing deploy; real browser with human Turnstile). Without them the plan is `CODE DONE`, not `VERIFIED`.

## Validate Contract

Status: CONDITIONAL
Date: 18-10-26
date: 2026-10-18
generated-by: outer-pvl
supersedes: 2026-10-18 (outer-pvl) - first-pass BLOCKED contract (2 FAIL, 7 CONCERN); this re-run follows PVL cycle 1 (supplement of gaps 1-9) and has current evidence

Parallel strategy: sequential (executed by one vc-validate-agent without a spawn tool; the 4 Layer-1 dimensions and the Section A-I feasibility checks were run as direct read-only verification against the code; no live provider call made)
Rationale: score 6/7 (S1, S2, S3, S5, S6, S7); dominant signal S6 (deploy/runtime/proxy plus upstream byte handling as a trust boundary). Agent count: 1 (no cost guard).

PVL cycle 1 verification of the previous 2 FAILs and 7 CONCERNs (each checked against the actual code):
- Gap 1 (was FAIL) RESOLVED in plan: `casebook.ts` hard-codes `c_a3a1fd5641d412c0` (hostile-hallucinated-quote), `c_fcfcb4a816686edb` + `c_54cd421d8bdba4af` (counsel-draft-03), `c_53ded8db41297f0a` (firm-rules-in-context-03); `author-recordings.ts` cites the same ids at lines 53/84/97/112/116/125/140; ids are content-hash stable (`sha256(docHash|blockId:snapStart)`), sample-01 has 22 and sample-03 36 candidates (cap 40 not hit), so D3(a) only shrinks the sets and no new candidate enters. C2b/C3/C3b/C3c cover the id scan, re-point, `fixedCandidates` for counsel-draft-03 (its candidates come from `draftCandidates` in `ai-draft.ts`, not `buildAiCandidates`, so the feature itself is unaffected; hash and live file stay byte-identical) and the new authored hostile case. Test pins found by grep: `llm-quote-must-exist.recorded.test.ts:73`, `llm-schema.recorded.test.ts:95` (c_624f..., may survive), `apps/web/test/engine-ai-api.test.ts:62-63`; all are in the plan.
- Gap 2 (was FAIL) RESOLVED in plan: `authorAll` computes `authoredRecording(c)` (which calls `authoredRaw`, which throws on removed ids via `quoteOf`) BEFORE the keep check; C4(a) reorders it, C4(b) fixes the write/check behavior for live cases, C4(c) handles orphans. `LlmRecordingSchema` accepts the extra `request.derived_from` key (top-level `z.object`, `request` is not in the schema), `meta.source` stays `authored`, and the web never reads the precomputed `source` field.
- Gap 3 RESOLVED: C7b + Touchpoints list the e2e/unit files tied to sample-01/03 (grep confirms the set).
- Gap 4 RESOLVED: `sseLive` controller variant (E1).
- Gap 5 RESOLVED with instructions E2/E3: timestamp write per read plus one re-checking timer; abort race inside `readSse`.
- Gap 6 RESOLVED: idle scoped to AI, OCR keeps 240 s (C4); OCR streaming stays K1.
- Gap 7 RESOLVED with instruction E7 (probe command path).
- Gap 8 PARTLY resolved: the `workerCpu` template exists in `scripts/src/live/common.ts` and is unit-tested, but no runnable script invokes it; see instruction E8.
- Gap 9 RESOLVED: the public site key is not in `docs/DEPLOY.md` or `all-worker.md` (names only); the live bundle or the allow-listed `GET /challenges/widgets` (in `CF_REST_ALLOW`) are both valid sources.

Test gates (C3 5-column table; strategy column carries only Fully-Automated / Hybrid / Agent-Probe; Known-Gap is never a strategy, it is a named residual carried as gap-resolution D). gap-resolution legend: A = proven now; B = proven by a gate this plan's checklist adds; C = deferred to a named later phase/plan; D = backlog stub (named residual, continue).

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1, AC2 | Upstream body = old body + `"stream":true`; SSE replay of every recording (11 now, 12 after the new authored case; gate floor >= 9) equals the JSON-path result | Fully-Automated | `pnpm --filter @aduin/worker test record-body-parity` | B |
| AC1 | Every other test that asserts the exact upstream body keys follows the new `stream` key | Fully-Automated | `pnpm --filter @aduin/worker test rules-injection-delimited-hostile` (must be updated, instruction E4) | B |
| AC2 | SSE assembly at every byte boundary, `\r\n`, multibyte, comments, `[DONE]`, usage-only final chunk | Fully-Automated | `pnpm --filter @aduin/worker test sse-assemble` | B |
| AC3, AC4 | AI idle timeout (silent connect, stall), re-arm by comment/reasoning delta, ceiling cut, stalled `read()` that ignores abort | Fully-Automated | `pnpm --filter @aduin/worker test upstream-timeouts` | B |
| C4 (OCR scoping) | OCR stream is NOT cut by the 60 s idle timer, is cut at 240 s, and its timeout refunds visitor OCR page claims while keeping global pages | Fully-Automated | `pnpm --filter @aduin/worker test upstream-timeouts` (OCR cases required, instruction E5) | B |
| AC5 | Timeout refunds reqV/docV/docIp (+seen), keeps global + spend, no cache, no ledger | Fully-Automated | `pnpm --filter @aduin/worker test timeout-refund`; `pnpm --filter @aduin/worker test llm-failure-injection-matrix` | B |
| AC6 | Failure shapes: mid-stream error, no `[DONE]`, EOF without finish, reset, length, 2 MiB/8 MiB caps, JSON 200 error | Fully-Automated | `pnpm --filter @aduin/worker test sse-failure-shapes` | B |
| AC7 | Reasoning-only lines never `JSON.parse`d | Fully-Automated | `pnpm --filter @aduin/worker test sse-cheap-parse` | B |
| AC8 | Browser NDJSON contract unchanged (hb + one terminal, no waitUntil, snapshot unchanged) | Fully-Automated | `pnpm --filter @aduin/worker test stream-holdopen`; `pnpm --filter @aduin/core test contracts` | B |
| AC9 | No AI candidate overlaps a rule-finding anchor in its block; retained ids stable | Fully-Automated | `pnpm --filter @aduin/core test ai-candidates-skip-rule-sentences` | B |
| AC10 | `dropRuleDuplicates` / `rangesOverlap` matrix | Fully-Automated | `pnpm --filter @aduin/core test ai-dedupe-rule-overlap` | B |
| AC11 | `verifyAiResult` with `ruleFindings` drops duplicates (synthetic overlap input), reports `suppressed`; without ctx unchanged | Fully-Automated | `pnpm --filter @aduin/core test ai-verify-suppresses-rule-duplicates`; `llm-quote-must-exist`; `llm-quote-scoped-to-candidate`; `ai-mask-before-storage`; `llm-schema` | B |
| AC11 (wiring) | `engine.worker.ts` retains `ruleFindings` and passes it into `verifyAiResult` | Fully-Automated | web unit wiring assertion (spy on the `verifyAiResult` ctx) in `apps/web/test/engine-ai-api.test.ts`, instruction E6; fallback `grep -c "ruleFindings" apps/web/src/engine/engine.worker.ts` >= 3 | B |
| AC12 | App shows no AI row overlapping a rule row (fresh/cache/precomputed); lane count = shown count | Fully-Automated | `pnpm --filter @aduin/web test:e2e ai-no-duplicates` (preview port 4317 free) | B |
| AC13 | Recordings honest: author check (zero orphans, zero missing), precompute check, fixtures check, derived label, no live call | Fully-Automated | `pnpm --filter @aduin/scripts record:author --check`; `pnpm --filter @aduin/scripts precompute:ai --from-recordings --check`; `pnpm --filter @aduin/scripts fixtures:check`; `pnpm --filter @aduin/scripts test derive-live-recordings` | B |
| AC14 | Docs match behavior (refund row, pipeline text, limits note) | Fully-Automated | `grep -c "UPSTREAM_IDLE_MS" process/context/worker/all-worker.md` >= 1; DV10 timeout row no longer "kept / kept" | B |
| AC15 | SSE shape probed on the real free model (keepalive, reasoning deltas, usage/cost, max silent gap) | Hybrid | probe REF file with 4 sections + `pnpm secrets:scan` (precondition: user-approved key load) | B |
| AC16 | Deploy tree = live base `a4d7a34` + this plan's code commits only; no 0006; preflight green | Hybrid | H4 diff-stat allow-list; `ls apps/worker/migrations` = 0001-0005; `pnpm --filter @aduin/scripts deploy:preflight`; `/api/memory/health` schema 5; `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` | B |
| AC17 | Local NG3 .docx uploaded through the live Upload UI in a real browser, AI review completes with margin (<= 300 s) | Agent-Probe | Section I (I2-I3), human Turnstile, one attempt; blocked by I0 until the upload "Reading" fix lands | D (I0 precondition) |
| AC18 | Zero AI findings duplicate a deterministic finding in that live result | Agent-Probe | Section I (I4) list comparison + screenshots | D |
| AC7b | Worker CPU of a streamed review recorded vs the 16 ms p99 observation | Agent-Probe | Section I (I1, I5): `wrangler tail` `cpuTime` per event plus a before/after `workerCpu` GraphQL read (instruction E8) | D |
| AC19 | No regression across all suites | Fully-Automated | `pnpm typecheck`; `pnpm lint`; `pnpm --filter @aduin/core test`; `pnpm --filter @aduin/web test`; `pnpm --filter @aduin/worker test`; `pnpm --filter @aduin/scripts test`; `pnpm --filter @aduin/web test:e2e`; `pnpm guard:cf`; `pnpm secrets:scan` | B |
| K1 | Live OCR streaming (stub-covered only; vision-model silent gap unprobed) | Fully-Automated (stub) with named residual | `pnpm --filter @aduin/worker test sse-assemble` (OCR reply variant) | D (backlog `ocr-streaming-live-proof`) |
| K2 | Provider SSE shape drift after the probe | Hybrid (probe-time only) with named residual | AC15 REF file | D (backlog `openrouter-sse-contract-recheck`) |
| K3 | Model quality on the new, smaller candidate set | Agent-Probe (single NG3 run) with named residual | AC17/AC18; optional O1 free re-record | D (backlog `ai-quality-new-candidates`) |

Failing stubs (TDD red-first; one per Fully-Automated row, keyed by criterion id; Hybrid, Agent-Probe and residual rows get none):
- AC1/AC2: `test("should forward the old body plus stream true and replay every recording through SSE", () => { throw new Error("NOT IMPLEMENTED - TDD stub: record-body-parity stream") })`
- AC1 (keys): `test("should list stream as the last upstream body key", () => { throw new Error("NOT IMPLEMENTED - TDD stub: rules-injection-delimited-hostile keys") })`
- AC2: `test("should assemble identical content when the SSE body is split at every byte boundary", () => { throw new Error("NOT IMPLEMENTED - TDD stub: sse assemble at every boundary") })`
- AC3: `test("should abort and return reason timeout when no upstream byte arrives for UPSTREAM_IDLE_MS", () => { throw new Error("NOT IMPLEMENTED - TDD stub: idle timeout") })`
- AC4: `test("should keep a continuously active stream alive until the ceiling then time out", () => { throw new Error("NOT IMPLEMENTED - TDD stub: ceiling") })`
- C4: `test("should not idle-time-out an OCR stream but cut it at 240 s and refund visitor OCR claims", () => { throw new Error("NOT IMPLEMENTED - TDD stub: ocr timer scoping") })`
- AC5: `test("should refund reqV docV docIp and keep global and spend on upstream timeout", () => { throw new Error("NOT IMPLEMENTED - TDD stub: timeout refund D2") })`
- AC6: `test("should map each SSE failure shape to its reason and refund class", () => { throw new Error("NOT IMPLEMENTED - TDD stub: sse failure shapes") })`
- AC7: `test("should never JSON.parse a reasoning-only data line", () => { throw new Error("NOT IMPLEMENTED - TDD stub: cheap parse") })`
- AC9: `test("should exclude sentences already flagged by a rule finding from AI candidates", () => { throw new Error("NOT IMPLEMENTED - TDD stub: candidates skip rule sentences") })`
- AC10: `test("should drop an AI finding that overlaps a rule anchor in the same block of any class", () => { throw new Error("NOT IMPLEMENTED - TDD stub: dropRuleDuplicates") })`
- AC11: `test("should drop a verified AI finding on a rule-anchored sentence and report suppressed", () => { throw new Error("NOT IMPLEMENTED - TDD stub: verify suppresses rule duplicates") })`
- AC11 wiring: `test("should pass the retained rule findings into verifyAiResult", () => { throw new Error("NOT IMPLEMENTED - TDD stub: engine worker ruleFindings wiring") })`
- AC12: `test("should show no AI row that overlaps a rule row and a lane count equal to the rows shown", () => { throw new Error("NOT IMPLEMENTED - TDD stub: ai-no-duplicates e2e") })`
- AC13: `test("should keep derived recordings labeled authored with derived_from and make no live call", () => { throw new Error("NOT IMPLEMENTED - TDD stub: derive-live-recordings") })`

Legacy line form (retained so existing validate-contract consumers still parse):
- apps/worker (SSE, timers, refund): [Fully-automated: `pnpm --filter @aduin/worker test sse-assemble` and `upstream-timeouts`, `timeout-refund`, `sse-failure-shapes`, `sse-cheap-parse`, `stream-holdopen`, `llm-failure-injection-matrix`, `record-body-parity`, `rules-injection-delimited-hostile`, then the whole worker suite] | [agent-probe: live CPU and duration, Section I] | [known-gap: OCR live streaming K1, documented]
- packages/core (dedupe, candidates, verify): [Fully-automated: `pnpm --filter @aduin/core test ai-candidates-skip-rule-sentences`, `ai-dedupe-rule-overlap`, `ai-verify-suppresses-rule-duplicates`, `llm-schema`, `llm-quote-must-exist`, `contracts`] | [known-gap: model quality on the new candidate set K3, documented]
- apps/web + recordings: [Fully-automated: `pnpm --filter @aduin/web test:e2e ai-no-duplicates`, `record:author --check`, `precompute:ai --from-recordings --check`, `fixtures:check`] | [hybrid: probe REF + deploy-tree gates + live health/stack smoke] | [agent-probe: NG3 upload, I0 precondition]

Execute-agent instructions (concerns that plan text cannot fully pin; each is mandatory when its trigger is reached):
- E1 (Section E2, harness clock): `ctx.now` is `() => clock.now` and `FakeTimers.now` is a SEPARATE clock (verified in `harness.ts`; only `stream-holdopen` and `llm-failure-injection-matrix` use `fakeTimers: true`). Do NOT wire `now` to `timers.now` alone: `send()` advances `clock.now` by 11 s per call (6/min pre-limit) and day keys use `T0`. Wire `now: () => clock.now + (timers?.now ?? 0)`. The idle check compares `ctx.now()` against `lastActivity`, so both must move together under `advance()`.
- E2 (D2/D3/D4, abort semantics): inside `readSse`, an abort (from the internal controller) must REJECT with `AbortError`, not return an `SseResult`, so `once()`'s catch assigns `reason: 'timeout'` (idle/ceiling) or `'client_abort'`. Pass `ac.signal` (the internal controller of `once()`), not the outer client `signal`, to `classify`/`readSse`; the outer `signal` is used only in the catch (`providerFault` when `!signal.aborted`).
- E3 (D4): the existing header comment (lines 10-12) and the `once()` doc comment ("240 s", "measured 100-157 s", "timeout keeps ALL claims (review M2)") and the `providerFault` comment (lines 489-491) must be rewritten; D1 header comment too.
- E4 (E-section, missed touchpoint): `apps/worker/test/llm/rules-injection-delimited-hostile.test.ts:65-72` asserts the exact upstream body key list; add `'stream'` after `'response_format'`. The plan's claim that every existing worker test passes unmodified is true for all others (grep of body/header/key assertions found only this one).
- E5 (E3, OCR): add OCR cases to `upstream-timeouts` and `timeout-refund`: (a) an OCR SSE stream silent for 60 s+ is NOT aborted; (b) it aborts at `UPSTREAM_OCR_TIMEOUT_MS` (240 s) with `reason: 'timeout'`; (c) visitor OCR page claims refunded, global pages kept; (d) AI idle still 60 s in the same harness.
- E6 (B6 wiring): by construction candidate sites exclude rule anchors, so `dropRuleDuplicates` cannot fire at runtime through the engine worker for engine-built candidates; the wiring is invisible in the output. Add a unit assertion in `apps/web/test/engine-ai-api.test.ts` (spy/mocked `verifyAiResult` capturing the ctx) that `ruleFindings` is passed; the e2e `ai-no-duplicates` case (i) will see the crafted legacy candidate id rejected as `unknown_candidate` (not suppressed), so it proves the end-state property AC12, not the D3(b) path; D3(b) is proved by the core unit test with synthetic overlapping `ruleFindings`. Do not claim otherwise in the commit or report.
- E7 (A2): `pnpm --filter @aduin/scripts exec` runs with cwd `scripts/`, so the probe command is `pnpm --filter @aduin/scripts exec tsx src/spikes/ai-stream-probe/probe.ts` (not `scripts/src/...`). The probe file is type-checked by `pnpm typecheck` (tsconfig includes `src`): keep it strict-clean.
- E8 (I1/I5, AC7b): `probe:live-ai --tail` also performs its own live AI calls (`--max-ai` 1-2) through the API, so it cannot be used during the human NG3 upload. Use a plain read-only `pnpm --filter @aduin/worker exec wrangler tail aduin-transaction-web --format json` for per-event `cpuTime`, and a throwaway (uncommitted) script using `CfClient` + `analyticsRequest('workerCpu', ...)` for the p99 before and after (`CfClient` allows exactly ONE GraphQL read per run, so run it twice). No script in the repo invokes `workerCpu` today.
- E9 (C4/C6, orphans): re-pointing changes the input hash of `hostile-hallucinated-quote` and `firm-rules-in-context-03` (and any other re-pointed case), so their OLD authored files (`b4345a3f9db36f5a.json`, `8ae2bdc4b8f87c12.json`, plus any found in C2b) become orphans in addition to the old LIVE sample-01/03 files; `git rm` them too, otherwise `record:author --check` reports orphans. Also keep `case` names unique (llm-schema asserts it) by removing the old live sample files before the final check.
- E10 (C7b): a derived recording cannot fabricate findings. If the derived sample-01/03 results leave too few AI rows for an e2e that needs one (provenance "rejected" row, counsel-sheet AI row), re-count what exists; if a spec can no longer exercise its scenario, STOP and report instead of inventing findings (use the authored hostile case or the optional O1 re-record).
- E11 (Section I order): do not start H/I without explicit user approval; I0 (upload "Reading" fix) must be filled in by the orchestrator first.

Dimension findings:
- Infra fit: CONCERN - all Worker edit anchors verified (`pipeline.ts` `once()` 440-498 and the `providerFault` spread at 492, `classify.ts` tail, `routes/proxy/index.ts` line 28, `refundVisitorScoped` keeps only `global_ai`/`spend` and refunds every other scope); harness clocks are separate (E1), abort must reject (E2), comments to rewrite (E3); OCR still sends `stream:true` live-unproven (K1).
- Test coverage: CONCERN - all gate tokens exist on disk (worker, core, web; `llm-failure-injection-matrix` also matches the D1 variant which has no timeout case); gaps closed by instructions: missed exact-key test (E4), OCR timer scoping gate (E5), engine wiring observability (E6), orphan authored files (E9), derived-recording row counts (E10).
- Breaking changes: PASS - browser NDJSON contract unchanged; `bannerFor` maps any `upstream_failed` reason other than malformed/bad_frame/not_a_stream to `provider_error` (so `stream_truncated` and `timeout` need no web change; D7 fallback unnecessary); no client timer in `ndjson.ts`; `VerifyAiContext.ruleFindings?` and `suppressed?` additive; counsel-draft candidates do not use `buildAiCandidates`; the only other `buildAiCandidatesWithSites` callers are `verify-quote.ts` (fallback) and the engine worker.
- Security surface: PASS - refund-on-timeout abuse is the locked D2 residual (global 50/day, spend and 6 req/min pre-limit stay held); SSE bytes never echoed; caps 2 MiB content / 8 MiB raw / 420 s ceiling; upstream host pinned with `redirect: 'manual'`; probe hard stops (free model only, abort on cost > 0, 3 calls, key never printed, ledger outside repo) are adequate; no secret value in the plan.
- Section A (probe) feasibility: CONCERN - location and imports resolve (`scripts/src/spikes/` is inside the typechecked package; `../../record/ai-request` and `../../record/casebook` resolve); command path fix E7; the probe's sample-03 body reflects the OLD candidate set (36), a harmless difference for SSE shape and silent-gap measurement.
- Section B (core dedupe + 3 web lines) feasibility: PASS - `candidates.ts` P0 loop and key handling match the plan; ids are content-hash stable; `engine.worker.ts` `Retained`, `findings` and the `verifyAiResult` ctx are as described and the file has no uncommitted foreign changes; wiring observability E6.
- Section C (recordings) feasibility: CONCERN (was FAIL) - both previous FAILs are now planned correctly against the code; remaining items E9 and E10; `counsel-draft-03` fixed-candidates approach keeps its live file untouched.
- Section D (Worker streaming) feasibility: CONCERN - mechanically sound; E1-E3.
- Section E (Worker test infra) feasibility: CONCERN - auto-SSE conversion keeps every existing JSON-scripted worker test valid except the one exact-key assertion (E4); `sseLive` is buildable (`ReadableStream` controller plus `FakeTimers.advance`, with microtask flushes between steps).
- Section F-G (regression, docs) feasibility: PASS - gate tokens exist; doc rows at `all-worker.md` lines 44 and 56 match.
- Section H (clean-worktree deploy) feasibility: PASS - `a4d7a34` is an ancestor of HEAD, `git diff 994ea54 a4d7a34 -- apps/worker` is empty, and NONE of the files this plan edits changed since `a4d7a34` (`candidates.ts`, `llm/index.ts`, `engine.worker.ts`, `casebook.ts`, `pipeline.ts`, `classify.ts`, `harness.ts`, `openrouter-stub.ts`, recordings, precomputed, web e2e fixtures), so cherry-picks should apply cleanly; migration `0006` exists only on HEAD; site key sources are valid. Note: Unresolved Question 3 in the plan text is stale (the docs hold names only).
- Section I (live NG3 upload) feasibility: CONCERN - UI-upload requirement met (I2) and the NG3 `.docx` exists locally; I0 is an open precondition owned by the orchestrator (accepted residual); AC7b tooling per E8.

Open gaps:
- I0 (accepted residual): upload "Reading" fix for the NG3 `.docx` is pending from a separate debugger investigation; Section I cannot start until it lands; this does not block CODE DONE of A-G or the H deploy gates.
- K1: known-gap: documented as NEW PLAN REQUIRED - see backlog/ocr-streaming-live-proof_NOTE_18-10-26.md (to be written at UPDATE PROCESS; listed in the plan's handoff)
- K2: known-gap: documented as NEW PLAN REQUIRED - see backlog/openrouter-sse-contract-recheck_NOTE_18-10-26.md (to be written at UPDATE PROCESS)
- K3: known-gap: documented as NEW PLAN REQUIRED - see backlog/ai-quality-new-candidates_NOTE_18-10-26.md (to be written at UPDATE PROCESS)
- Agent-Probe rows (AC7b, AC17, AC18): named residuals; need a human in a real browser (Turnstile) and explicit user approval for H and I.
- Concerns closed by execute-agent instructions E1-E11 (not residual gaps): harness clock coupling, abort semantics, missed exact-key test, OCR scoping gate, wiring assertion, probe path, CPU tooling, orphan files, derived-row counts.

What this coverage does NOT prove:
(What This Coverage Does NOT Prove, per gate)
- record-body-parity / sse-assemble: real OpenRouter byte framing and later provider drift (only the probe REF, K2); OCR vision-model streaming (K1).
- upstream-timeouts / timeout-refund: real workerd abort propagation after headers, real network stalls, OpenRouter accounting of aborted streams.
- sse-cheap-parse: real Worker CPU (only AC7b on the live Worker, Agent-Probe).
- ai-candidates-skip-rule-sentences / dedupe / verify tests: model quality on the smaller candidate set (K3); that `dropRuleDuplicates` ever fires at runtime through the engine worker (it cannot for engine-built candidates; it is a defense in depth proved on synthetic input).
- ai-no-duplicates e2e: live model output (replayed recordings only) and the D3(b) suppression path (the crafted legacy id is rejected as unknown).
- record:author / precompute checks: that the live model answers the new candidate set the same way (derived recordings keep the model's findings on text it saw; O1 is the honest re-record).
- deploy-tree gates: nothing about live Turnstile/AI behavior; AC17/AC18 are the only live evidence, one run on one document.

Gate: CONDITIONAL
Accepted by: session (orchestrator directive for this autonomous PVL cycle, no user prompt; not a user acceptance of H/I). Accepted named residuals: K1 (live OCR streaming), K2 (provider SSE drift), K3 (model quality on the new candidate set), the Agent-Probe rows AC7b/AC17/AC18, and I0 (upload "Reading" fix pending). Concerns resolved by execute-agent instructions rather than accepted: E1 harness clock coupling, E2 abort semantics, E4 missed exact-key test, E5 OCR timer scoping gate, E6 wiring observability, E7 probe command path, E8 CPU tooling, E9 orphan authored files, E10 derived-row counts. Net: 0 FAIL, CONDITIONAL because of the named residuals; PVL fix cycle 1 is recorded in `results.tsv` (3 lines), so `PHASE_COMPLETE: VALIDATE` is legal under rule (b).

## Autonomous Goal Block

SESSION GOAL: AI review hardening - SSE upstream with idle timeout + 420 s ceiling, visitor-claim refund on upstream timeout, no AI findings that duplicate deterministic findings; deploy from a clean worktree at a4d7a34; verify by uploading the local NG3 .docx through the live app UI in a real browser.
Charter + umbrella plan: N/A - single plan: process/general-plans/active/ai-review-stream-dedup_18-10-26/ai-review-stream-dedup_PLAN_18-10-26.md
Autonomy: per feedback_autonomous_phase_execution.md - no approval pauses; subagent delegation still mandatory (vc-execute-agent opus for code, vc-tester for EVL); BLOCKED goes to backlog; never run git stash/checkout/reset; never push.
Hard stop conditions / safety constraints:
- Gate is CONDITIONAL (0 FAIL; named residuals K1-K3, Agent-Probe rows, I0): EXECUTE may start at Section A after the orchestrator spawn rules; follow execute instructions E1-E11 in the Validate Contract; H and I need explicit user approval.
- Never touch Cloudflare zone itsjiathao.com; workers.dev only; free model only; stop on usage.cost > 0.
- No live provider call except the Section A probe (max 3 calls, user approval for the key load) and the single human NG3 upload; no key in logs or files.
- Deploy only from the clean worktree built on a4d7a34 + this plan's code commits; migration 0006 and variance code must not ship (/api/memory/health must say schema 5); rollback target 3d2c7301-a4a5-487c-bd7d-2f2c0800be6f.
- Deploy (H) and the live run (I) need explicit user approval; no reasoning cap; do not change the browser NDJSON contract; do not touch packages/core/src/package/**.
Next phase: EXECUTE ai-review-stream-dedup_PLAN_18-10-26.md Section A (probe needs the user-approved key load), then B+C, D+E, F, G; H and I only with explicit user approval and a filled-in I0.
Validate contract: inline in this plan (## Validate Contract)
Execute start: fully-auto: pnpm --filter @aduin/worker test record-body-parity | pnpm --filter @aduin/core test ai-dedupe-rule-overlap | e2e: pnpm --filter @aduin/web test:e2e ai-no-duplicates | probe: Section I NG3 upload on the live app | high-risk pack: yes (deploy/runtime/proxy + trust boundary)

## PVL Supplement Log (cycle 1, 18-10-26)

Gaps 1-9 addressed in place; the Validate Contract above is the pre-supplement record and must be re-run (VALIDATE from V1).
- Gap 1: C2b (enumerate vanished ids), C3 (re-point casebook + authored arms + test ids), C3b (`fixedCandidates` for counsel-draft-03, live file untouched), C3c; Touchpoints extended.
- Gap 2: C4 (`authorAll` keep rule for `derived_from`, `authoredRaw` not evaluated for kept files, order C4 -> C5 -> C6, `git rm` old-hash live files after the C2 archive).
- Gap 3: C7b + Touchpoints for e2e/web-unit expectations tied to sample-01/03 recordings.
- Gap 4: `sseLive` stub variant with controller handle (E1); E3 builds AC3 on it.
- Gap 5: D4 timestamp-per-read plus one re-checking timer; D2 abort signal raced explicitly inside `readSse`, with a test.
- Gap 6: C4 scopes the 60 s idle timeout to AI; OCR keeps the 240 s timer (`UPSTREAM_OCR_TIMEOUT_MS`), still refunded on timeout.
- Gap 7: probe moved to `scripts/src/spikes/ai-stream-probe/probe.ts`, run via `pnpm --filter @aduin/scripts exec tsx`, APPROVED-LIVE ledger convention, outside the deploy cherry-pick.
- Gap 8: AC7b method = `workerCpu` GraphQL template in `scripts/src/live/common.ts`, p99 before/after (I1, I5).
- Gap 9: H5 reads the public Turnstile site key from the live bundle or the allow-listed `GET challenges/widgets`.
- Section I: end-to-end UPLOAD; placeholder I0 for the upload-"Reading" fix dependency.

## Deviations

Sections B+C (EXECUTE, 18-10-26), all within blast radius:
- C3c: the plan asked for finding 1 on a survivor "in a block that ALSO has a rule finding in a different sentence". No such survivor exists in samples 01/03 (every survivor's block is free of rule findings), so finding 1 uses `c_b30f291dff2535b6` (clean block). The case picks two candidates because a one-pick `c_b30f...` request collides with `hostile-severity-critical`'s inputHash.
- Two existing core tests encoded the removed P0 behavior and were updated (not in the Touchpoints list): `llm-task-registry` ("deterministic findings' sentences are always selected first" is now "never selected") and `ai-mask-before-storage` (an account-number sentence always carries a `sensitive_data` rule finding, so the mask path is exercised with no findings, and the real-engine path is asserted to exclude the sentence).
- `firm-rules-in-context-03`: its finding is now `ambiguity` on the re-pointed sentence (was `placeholder` on the rule-flagged placeholder sentence); `llm-quote-must-exist` asserts the snapped sentence holds the model quote instead of `[insert investor name]`.
- `sample-01`/`sample-03` authored arms (fallbacks, never written for live cases now) were re-pointed to surviving ids so they cannot cite vanished ids.
- `ai-request.ts` `upstreamBody` doc note (Touchpoints, C row) deferred to Section D, where the Worker body actually changes.
- Process files (this plan, REF additions, `legacy-live-recordings/`) are left uncommitted for the orchestrator/UPDATE PROCESS; the code commit holds only code, tests, fixtures and precomputed files.

Sections D+E (EXECUTE, 18-10-26), all within blast radius:
- D2 signature: `readSse` options take `signal?: AbortSignal` (optional, as `classify`'s hooks are optional); `SseResult.stats.lines` counts `data:` lines incl. `[DONE]`. A non-JSON line is `malformed` only when it matched the content pattern, else ignored (Edge Cases row 1).
- D4: the pre-dispatch `signal.aborted` check now runs BEFORE the timers are created (same outcome, no timer to clear). `onActivity()` is also called once when the response headers arrive (activity, keeps the semantics "any upstream bytes").
- D3: a new exported constant `MAX_UPSTREAM_STREAM_BYTES` (8 MiB) in `classify.ts`; the malformed result object became a module constant shared by both paths (no behavior change).
- E1: the auto-SSE conversion applies only to `json` replies whose `choices[0].message.content` is a string; a `text` reply is never converted (lets tests force the JSON path). `sse`/`sseStall` chunks accept `string | Uint8Array` (needed for byte-boundary tests). Harness `now` is `clock.now + (timers?.now ?? 0)` per instruction E1.
- E4 (instruction): `rules-injection-delimited-hostile` key list gained `'stream'`. Section E4 (hold-open) and E5 (matrix) updated as planned.
- E3/E5 (instruction): OCR timer-scoping cases live in `upstream-timeouts` (no idle abort at 61 s, cut at 240 s, AI idle still 60 s in the same harness) and `timeout-refund` (visitor OCR page claims refunded, global kept).
- B5-deferred doc note added to `scripts/src/record/ai-request.ts` `upstreamBody` (recorder stays non-streaming; Worker body = this body + `"stream":true`).
- Worker suite count is 603 (76 files), not the plan's 526 baseline: the branch already carries variance-phase worker tests; all pass.

Sections F+G (EXECUTE, 18-10-26), all within blast radius:
- F2: `scripts/test/ocr-live-guard.test.ts` parity test failed (the Worker body now ends with `"stream":true`, the offline OCR script body does not). Not in Touchpoints. Fixed in the test only: it asserts the Worker body ends with `,"stream":true}` and compares the script body to the Worker body minus that key. The OCR script stays non-streaming (it parses a JSON reply).
- F2 counts: core 3190 (+3 skip; `size-cap` and `diff-determinism` timed out at 5 s under the full run, both pass in isolation), web unit 314, scripts 176, worker 603, preview e2e 219 + 1 skip (plan baselines predate the variance branch).
- F4 stats (from the `sse-cheap-parse` assertions): `lines` 6302, `commentLines` 6000, `parsed` <= 302, `JSON.parse` calls == `parsed`.
- G1: the Limits addition is one sentence of constants (not env vars); Known Gaps notes the unmeasured live CPU and the OCR-stream residual.

Sections H+I (EXECUTE/orchestrator, 18-10-26):
- H1: the live base was not `3d2c7301`/`a4d7a34` but hotfix `b04f1a8c` (a4d7a34 + c7fcb17 = `hotfix/intake-readiness-msg`). The deploy tree is `.claude/worktrees/deploy-ai-stream`, branch `deploy/ai-stream-dedup`, local only. Rollback target is `b04f1a8c-41f5-4c20-92dc-196d6e7d252a`.
- H3: a fourth cherry-pick (`01e7a10` -> `d7b7756`, UI toast fix from another branch, user-approved) was added; `review.ts` conflict resolved keeping the base dismiss text; the variance test file was dropped.
- H6: the stack smoke project was replaced by a headless Chromium load check because port 4317 was busy.
- I0/I2: the upload "Reading" precondition held on the live app. The orchestrator ran the upload with Playwright Chromium, not a human; Turnstile (flexible mode) issued a token automatically, so the "automated Chromium gets no token" residual R2 did not hold for this run.
- I1/I5: CPU after the run was not measured (AC7b stays open); CPU before the deploy: p50 4.1 ms, p99 35.0 ms over 24 h.
- I6: optional re-record skipped.
- Observed UI issue (not this plan): some AI finding titles are cut at "U.S." because the title sentence splitter treats the abbreviation as a sentence end; backlog stub filed.

## Dependencies

- OpenRouter free model availability and SSE support (probe A3/A4 gate); user approval for the probe key load (privacy hook) and for the deploy; real browser plus human Turnstile for Section I; the other web session (engine.worker.ts, preview port).
- Ordering: A (probe) -> B (core dedupe) and C (recordings) -> D+E (Worker; E red-first) -> F (regression) -> G (docs) -> H (deploy) -> I (live). B/C and D/E touch disjoint packages and may run in parallel only if blast radii stay disjoint; they share no file. C depends on B (candidate set). H depends on all code commits.

## Test Infra Improvement Notes

- The `OpenRouterStub` gains SSE and stall modes (reusable for OCR and the Variance AI tasks); keep auto-SSE conversion so legacy JSON-scripted tests keep working.
- `FakeTimers` could gain an `advanceUntilIdle` helper to avoid per-test arithmetic; not required.
- No in-repo way to measure Worker CPU locally: a `wrangler dev --test-scheduled`-style CPU probe or a Miniflare CPU counter would close K-class gap AC7b; backlog candidate `worker-cpu-measure-harness`.
- Recording tooling lacks a first-class "derived" concept; `derive-live-recordings` is the first step and could be generalized for later candidate-set changes.

## Resume and Execution Handoff

- Selected plan (single execute anchor): `process/general-plans/active/ai-review-stream-dedup_18-10-26/ai-review-stream-dedup_PLAN_18-10-26.md`. No supporting phase files.
- Start at Section A step A1; do not skip the probe. A5 can return BLOCKED (decision-table STOP row) and that is a valid outcome.
- State to re-check on resume: `git log --oneline` for commits titled in sections A/B-C/D-E; presence of `ai-review-stream-dedup_REF_18-10-26.md` (A done); existence of `packages/core/src/llm/dedupe.ts` (B); `apps/worker/src/upstream/sse.ts` (D); `legacy-live-recordings/` (C2).
- EXECUTE agent must: spawn a fresh vc-execute-agent with this exact path; never run `git stash/checkout/reset`; never push; ask before the probe key load (privacy hook `APPROVED:` marker), before deploy (H) and before any live provider call beyond the probe; free model only; stop on `usage.cost > 0`.
- EVL: a spawned vc-tester re-runs the validate-contract gate commands (F1-F3 plus the section gates); the orchestrator does not run them inline.
- Validators to run before closing: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs process/general-plans/active/ai-review-stream-dedup_18-10-26/ai-review-stream-dedup_PLAN_18-10-26.md` and, because docs/context change, `vc-audit-context`; agent-surface parity validator not needed (no agent edits).
- UPDATE PROCESS: archive this task folder, update `all-worker.md` (live version, refund row, deploy facts), `all-engine.md`, `all-tests.md`, `all-context.md` (live version line, test counts), `README.md` live version line; write backlog notes K1, K2, K3 plus `worker-cpu-measure-harness`.

## Strategy Recommendation for VALIDATE (vc-agent-strategy-compare)

Score 6/7: S1 (4 packages touched: worker, core, web, scripts), S2 (public-contract surface: upstream request body, refund/error contract, core public seam), S3 (3 workstreams: streaming, refund, dedup), S5 (rigor requested), S6 (deploy/runtime/proxy class; upstream byte handling is a trust boundary), S7 (more than 5 files). Not signaled: S4 (single plan, not a phase program). Fan-out is 4 independent read-only validation dimensions plus 2 feasibility checks with no mid-run coordination needed.

Recommended: **Parallel subagents (read-only, fire-and-forget), 6 agents, all sonnet** (4 Layer-1 dimensions: streaming/SSE correctness and CPU; refund/abuse and contracts; dedup and recordings honesty; deploy/rollback and test-gate completeness; plus 2 Layer-2 feasibility agents: (a) stub-to-workerd SSE streaming behavior under FakeTimers, (b) `banner-map` and `refundVisitorScoped` behavior). Agent count math: 4 + 2 = 6 (< 30, no cost guard). Alternatives: Sequential (1 agent, 6 passes; cheaper, slower, no benefit from parallelism); Workflow (not needed, count is known); Agent team (not needed: validators do not need mid-run coordination; use only if the V7 supplement partition needs shared plan-region ownership). EXECUTE leg: a single vc-execute-agent (opus) per section in order A, B+C, D+E (B/C and D/E may be two agents in an agent team only if the orchestrator confirms disjoint blast radii and uses TeamCreate + SendMessage); all other agents sonnet. Probe step A needs user approval for the credentials load before spawn.

## Unresolved Questions

1. Exact idle constant and prefilter patterns are provisional until probe P1a/P1b (by design; the decision table fixes them).
2. Whether `stream_truncated` maps cleanly in the web banner (checked at D7; fallback reason `network`).
3. The public Turnstile site key value for the web build: `docs/DEPLOY.md` and the phase reports hold names only; at H5 take it from the live bundle or the allow-listed `GET /challenges/widgets` (resolved in VALIDATE cycle 1).
4. Whether the user wants O1 (free live re-record) after deploy.

## Next Instruction

Context router used: `process/context/all-context.md` (groups worker, engine, tests). Validate Contract written (CONDITIONAL, 0 FAIL). Next step: orchestrator emits the /goal block, then ENTER EXECUTE MODE (spawn vc-execute-agent with this exact path; apply execute instructions E1-E11).
