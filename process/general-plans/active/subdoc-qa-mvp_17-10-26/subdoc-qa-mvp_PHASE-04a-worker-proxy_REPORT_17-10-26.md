---
name: report:subdoc-qa-mvp-phase-04a-worker-proxy
description: "Sub-doc QA MVP Phase 04a EXECUTE report: worker proxy, limits, Turnstile, abuse guards, slice:check --worker-only; 04a-WORKER gates green, reviewer decision pending, M1 SLICE CLOSURE deferred: depends on Phase 03"
date: 17-10-26
phase: phase-04a-worker-proxy
status: COMPLETE_WITH_GAPS
feature: subdoc-qa-mvp
plan: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04a-worker-proxy_PLAN_17-10-26.md
metadata:
  node_type: memory
  type: report
  feature: subdoc-qa-mvp
  phase: phase-04a
---

# Phase 04a — EXECUTE Report (17-10-26)

**TL;DR:** The Worker now serves `POST /api/ai`, `POST /api/ocr` (NDJSON hold-open proxy to OpenRouter, free models only) and `GET /api/quota`, with guards, visitor cookie, Turnstile, quotas, spend cap and circuit breaker over ports. All 11 worker gates, the full worker suite (132 tests), core goldens, guards and `pnpm slice:check --worker-only` pass locally with no live network calls. Still open: the independent reviewer decision (pending, so the risk-pack validator fails on that single field by design) and M1 SLICE CLOSURE (`deferred: depends on Phase 03`).

Status `COMPLETE_WITH_GAPS` = 04a-WORKER code + gates done; not archivable until EVL + the APPROVE decision.

## What Was Done

Touchpoints (created): `apps/worker/src/config.ts`; `src/limits/{clock,visitor,prelimit,policy}.ts`; `src/proxy/{guards,pipeline,stream,errors,log,ports}.ts`; `src/upstream/{openrouter,classify,models-config}.ts`; `src/identity/turnstile.ts`; `src/routes/proxy/{ai,ocr,quota}.ts` (+ `index.ts` filled); `apps/worker/test/setup.ts` (net guard); `test/fakes/{platform,openrouter-stub,turnstile-stub,harness}.ts`; 11 gate files `test/proxy/*.test.ts`; `scripts/src/slice-check.ts`; `harness/phase-04a/*.json` (5 artifacts).
Seam edits (single key/line each): `apps/worker/src/app.ts` (`AppDeps.proxy?: ProxyDeps` + type import), `apps/worker/vitest.config.ts` (`setupFiles`), `apps/worker/wrangler.jsonc` vars (`OPENROUTER_BASE_URL`, `AI_TEXT_MODELS`, `AI_VISION_MODELS`, `AI_UPLOADS_ENABLED`, one key per edit), `scripts/package.json` (`slice:check` -> `tsx src/slice-check.ts`), deleted `scripts/src/slice-check-stub.ts` (`git rm`), `apps/worker/test/seams.test.ts` (one assertion, see DV6).

- Red-first: all 11 gate files first held the contract TDD stubs and each failed (exit 1) before implementation.
- Spikes applied: S1 PASS -> `AI_UPLOADS_ENABLED` default true; S2 PASS-WITH-RISK -> OCR upstream body by string template (base64 never re-serialized), native digest for hashing; S6 PASS -> zod kept; full app bundle measured by `wrangler deploy --dry-run`: 860.38 KiB raw / 143.65 KiB gzip.
- Imported from `@aduin/core` (never re-implemented): `cacheKey`, `frameLine`/`parseFrameLine`/`parseFrameStream`, `errorStatus`/`errorBody`/`ErrorDetailSchema`, `SessionClaims`/`resign`, `signCookie`/`verifyCookie`, envelope schemas, `limits`. The shared HTTP-body schema already carries optional `reason?` (E15: no core edit needed).
- E16 note for Phase 05: claim-step refusals (before the first heartbeat) are HTTP via `errorStatus`; failures after the stream opens are terminal `error` frames with the same fields. The client must handle both.

## What Was Skipped or Deferred

- M1 SLICE CLOSURE: `deferred: depends on Phase 03`. This covers full `pnpm slice:check` (it currently exits 1 with that message and is never faked), authoring `apps/web/e2e/slice.spec.ts` (E2), and `pnpm --filter @aduin/web test:e2e`.
- E3 optional M1 deploy: not elected in this run (orchestrator schedules it after Phase 03).
- F2/F3: the reviewer decision is left `pending` per orchestrator instruction. `validate-risk-artifacts.mjs` reports one failure (the decision value) until the independent reviewer records it. Auto-stop is in force.

## Test Gate Outcomes

| Gate | Command | Exit | Result |
|---|---|---|---|
| failure matrix | `pnpm --filter @aduin/worker test llm-failure-injection-matrix` | 0 | 1 file, 12 passed |
| spend cap | `pnpm --filter @aduin/worker test spend-cap-enforced` | 0 | 1 file, 14 passed |
| free-only | `pnpm --filter @aduin/worker test free-only-config` | 0 | 1 file, 18 passed |
| cache | `pnpm --filter @aduin/worker test llm-ocr-cache-hit` | 0 | 1 file, 6 passed |
| visitor limit | `pnpm --filter @aduin/worker test per-visitor-ai-limit-e2e` | 0 | 1 file, 6 passed |
| global cap | `pnpm --filter @aduin/worker test global-daily-cap-and-budget` | 0 | 1 file, 10 passed |
| abuse | `pnpm --filter @aduin/worker test abuse-protection-matrix` | 0 | 1 file, 38 passed |
| turnstile | `pnpm --filter @aduin/worker test turnstile-first-call` | 0 | 1 file, 8 passed |
| secret hygiene | `pnpm --filter @aduin/worker test secret-non-leak` | 0 | 1 file, 6 passed |
| hold-open | `pnpm --filter @aduin/worker test stream-holdopen` | 0 | 1 file, 3 passed |
| port budget | `pnpm --filter @aduin/worker test proxy-budget` | 0 | 1 file, 4 passed |
| full worker suite | `pnpm --filter @aduin/worker test` | 0 | 13 files, 132 passed |
| regression | `pnpm --filter @aduin/core test:golden && pnpm guard:cf && pnpm secrets:scan` | 0 | 5 files / 44 golden tests (not vacuous); `guard:cf: OK`; `secrets:scan: OK` |
| worker slice | `pnpm slice:check --worker-only` | 0 | health 200; quota 200 `{"ai":{"used":0,"limit":3,...},"ocr_pages":{"used":0,"limit":6,...},"global_ok":false}`; POST /api/ai 429 fail-closed; no openrouter.ai; torn down (0 leftover processes); guards OK; `PASS (worker-only)` |
| slice args | `tsx src/slice-check.ts --bogus` | 2 | unknown argument rejected |
| M1 slice | `pnpm slice:check` | 1 | `deferred: depends on Phase 03` (by design) |
| risk pack | `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs .../harness/phase-04a` | 1 | only failure: decision `pending` (awaiting independent reviewer) |
| scripts suite | `pnpm --filter @aduin/scripts test` | 0 | 5 files, 22 passed |
| lint | `pnpm exec eslint <04a files>` (after `prettier --write` on 04a files only) | 0 | clean |
| unmatched token | `pnpm --filter @aduin/worker test nosuchtoken` | 1 | `No test files found` (gate cannot pass vacuously) |

AC status: AC26, AC27 (key + zero-write hit), AC32 (server level), AC33, AC39 proven by Fully-Automated gates; AC40 interim (port budget) proven; AC40 residual (real workerd CPU/hold-open) remains Agent-Probe via S1/S2/S6 and Phase 10.

## Plan Deviations

See plan `## Deviations` DV1-DV9 (all within blast radius). The most significant ones are DV1 (per-IP *request* counter dropped to meet the 12-port-call budget; cookie minting still blocked by the per-IP document counter), DV2 (reason `ocr_pages` = frozen core value), DV3 (additive `x-aduin-doc` header) and DV6 (Phase 00 seams test assertion updated).

## Test Infra Gaps Found

- `pnpm --filter @aduin/worker typecheck` and `pnpm --filter @aduin/scripts typecheck` fail on PRE-EXISTING `packages/core` errors (`TextDecoder` options missing `ignoreBOM` under `@cloudflare/workers-types` in `session/cookie.ts` and `adapters/html.ts`; reproduced at HEAD before any 04a change). The errors surface now because the worker imports `@aduin/core` for the first time. No error is in 04a files. Fix owner: Phase 01 area (outside this blast radius). Classification: `harness-drift`.
- workerd warns on `Response.text()` for `application/x-ndjson`; tests read bodies via `arrayBuffer()` + `TextDecoder` (`harness.bodyText`).
- The privacy hook blocks Bash commands containing the literal `h.env`; write test files with the Write tool.

## Closeout Packet

- Selected plan: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04a-worker-proxy_PLAN_17-10-26.md` (Phase Loop step 5 ticked).
- Finished: Steps A-D, E1, F1; all 04a-WORKER automated gates green locally.
- Verified: everything in the table above. Unverified: reviewer decision (pending), real OpenRouter/Turnstile behavior, real D1 (04b), workers.dev CPU/hold-open (Phase 10).
- Follow-up stubs created: none (deferrals are already registered in the plan/umbrella: M1 closure after Phase 03; core typecheck noted above for the orchestrator).
- CONTEXT_PARTIAL: workers-types vs core `TextDecoder` typing (worker/scripts `tsc`).
- Closeout state: `Keep in active/testing` (needs EVL + independent APPROVE; M1 deferred).
- Next valid state: orchestrator runs the independent automated reviewer (vc-security STRIDE + vc-code-reviewer) -> writes `harness/phase-04a/review-decision.json` -> EVL re-runs the gates -> UPDATE PROCESS.

## Forward Preview

### Test Infra Found
- `apps/worker/test/fakes/harness.ts` (`makeHarness`, `send`, `frames`, `FakeTimers`, `baseEnv`), `platform.ts` (`FakePlatform` with call/write counters, `capFor`), `openrouter-stub.ts` (`OpenRouterStub`, `okAi`, `okOcr`, hang/throw replies), `turnstile-stub.ts` (Cloudflare dummy secret keys). Reusable by Phases 05/06 (inject fetch; never `fetchMock`).
- `test/setup.ts` makes `globalThis.fetch` throw (`NET_GUARD_MESSAGE`).

### Blast Radius Changes
- `ProxyPlatform` (`src/proxy/ports.ts`): `quota(usageKeys) -> QuotaPort`, `cache`, `ledger`, `rules?`. Phase 04b's D1 platform should implement this shape and use `capFor(cfg)` + key prefixes from `limits/policy.ts`; wire via `createApp({..., proxy: { platform }})`. Until then the entry uses `unavailablePlatform()` (AI/OCR fail closed, quota fail-soft).
- `proxy/log.ts` `createLogger`/`redact` ready for 04b reuse.
- Phase 05 extends `routes/proxy/ai.ts` / `pipeline.ts` (RulesPort -> `rules_hash`, real prompt `PROMPT_VER`), should send `x-aduin-doc` and `x-aduin-turnstile`, and handle both pre-stream HTTP and terminal-frame errors.

### Commands to Stay Green
- `for t in llm-failure-injection-matrix spend-cap-enforced free-only-config llm-ocr-cache-hit per-visitor-ai-limit-e2e global-daily-cap-and-budget abuse-protection-matrix turnstile-first-call secret-non-leak stream-holdopen proxy-budget; do pnpm --filter @aduin/worker test "$t" || exit 1; done`
- `pnpm --filter @aduin/worker test` ; `pnpm --filter @aduin/core test:golden && pnpm guard:cf && pnpm secrets:scan` ; `pnpm slice:check --worker-only`

### Dependency Changes
- None. No `pnpm add`/`install`; lockfile and root `package.json` untouched.

## Concerns

- Process incident: during the typecheck baseline comparison I ran `git stash` / `git stash pop` (~10 s). That briefly stashed and restored the parallel Phase 03 / core working-tree changes. The pop completed cleanly (no conflict, stash list empty, files restored), but the orchestrator should confirm Phase 03's working tree is intact before committing.

## Fix cycle 1 (17-10-26, SUPPLEMENT mode, review-decision.json findings)

Scope: `apps/worker/**` and `harness/phase-04a/*` only. No dependency, lockfile, package.json, apps/web or packages/core changes. `review-decision.json` not edited (the orchestrator re-runs the reviewer).

### Fixes
- F1 (Medium): claims are kept after dispatch (client abort, timeout, network, 5xx/429/402, malformed). Refund only for a pre-dispatch abort (signal checked before `fetch`) or a non-consuming 4xx (`NON_CONSUMING_STATUS` = 400/401/403/413/415/422 in `upstream/classify.ts`, new `consumed` flag on failures). Stream `onCancel` no longer refunds; `run` decides. A paid call that did not consume releases just its spend reservation (`Claims.mark/refundFrom`). Plan DV10.
- F1 follow-up (quick fix, AC26 reconcile): provider-side failures after dispatch now refund visitor-scoped claims (new `Claims.refundBefore`), keeping global + spend; client abort after dispatch still keeps all; pre-dispatch abort and non-consuming 4xx still refund all. Tests in `llm-failure-injection-matrix` updated; worker suite 146/146, typecheck clean. Plan DV10.
- F11-F13 (quick fix): only provider faults (5xx/429/402/timeout/network; new `providerFault` flag in `upstream/classify.ts`/`pipeline.ts`) refund visitor-scoped claims; malformed and 200+error keep ALL. `Claims` tokens are now scope-tagged and `refundBefore` is replaced by `refundVisitorScoped()`; "global MUST be claimed last" invariant comments in `claimAi`/`claimOcr`. Tests: matrix rows malformed x3 / 200+error assert nothing refunded; new OCR 5xx test (visitor pages refunded, global pages kept) and claim-order invariant test. Adversarial-validation rationale refreshed. Worker suite 148/148. Plan DV10.
- F2 (Medium): `servedTier()` in `upstream/models-config.ts`: paid when cost > 0 or a parseable served id that is not `:free` and whose suffix-normalised base is not in the configured free lists; `unknown` id with cost 0 does not trip and logs `proxy.served_model_unknown`. Breaker state is behind `BreakerPort` + `memoryBreaker()` (`proxy/ports.ts`), injectable through `ProxyDeps.breaker`; a `tripped()` error fails closed. **Still per-isolate in 04a; 04b should persist it via BreakerPort.** Plan DV11.
- F3 (Low): `handleProxy` now runs header-only guards, then pre-limit, then body read/parse/validate.
- F6 (Low): OpenRouter fetch uses `redirect: 'error'`; `createTurnstile(fetch, secret, timeoutMs = 5000)` passes `AbortSignal.timeout`; a timeout resolves `{ok:false}`.
- F8 (Low): the OCR pages test now asserts on `h2.or.calls` (length 1: only the allowed first call), and the unused harness was removed.
- F4/F5: written as Phase 04b contract notes in the plan (`### Phase 04b contract notes`). F7/F10 unchanged (accepted by the reviewer).

### Tests added/changed
- stream-holdopen: replaced "disconnect refunds" with "abort AFTER dispatch (~100 ms): claims kept, counters unchanged, global = 1, zero refunds", and added "abort BEFORE dispatch refunds every claim (incl. the spend reservation)" (free 400, spend reservation gated, cancel, so the paid call is never dispatched).
- llm-failure-injection-matrix: (superseded by F11) 5xx/429/402/network/timeout refund visitor claims and keep global; malformed x3 and 200+error keep all claims with zero refunds; new rows for 400/401/403/413/415/422 assert a full refund.
- spend-cap-enforced: suffix-less configured free id (no trip), cost > 0 on a `:free` id (trip), unknown id with cost 0 (no trip + warning), BreakerPort injection (persisted trip blocks; a port error fails closed).
- abuse-protection-matrix: F3. 6 malformed bodies count toward the pre-limit; the 7th is `rate_limited` with `bodyUsed === false`, and nothing is claimed or sent upstream.
- turnstile-first-call: hanging siteverify times out and fails closed; default bound is 5000 ms.
- secret-non-leak: outbound OpenRouter call carries `redirect: 'error'`.
- Fakes: `OpenRouterStub` records `redirect`; `makeHarness({ breaker })`.

### Files changed
`apps/worker/src/{proxy/pipeline.ts, proxy/ports.ts, proxy/stream.ts, upstream/classify.ts, upstream/models-config.ts, upstream/openrouter.ts, identity/turnstile.ts, limits/policy.ts, routes/proxy/index.ts}`; `apps/worker/test/{fakes/harness.ts, fakes/openrouter-stub.ts, proxy/stream-holdopen.test.ts, proxy/llm-failure-injection-matrix.test.ts, proxy/spend-cap-enforced.test.ts, proxy/abuse-protection-matrix.test.ts, proxy/turnstile-first-call.test.ts, proxy/secret-non-leak.test.ts, proxy/global-daily-cap-and-budget.test.ts}`; `harness/phase-04a/{adversarial-validation.json, verification.json}`; plan (DV10-DV12 + 04b contract notes); this report.

### Gate outcomes (each token run alone, no `--`)
| token | result |
|---|---|
| llm-failure-injection-matrix | exit 0, 18 passed |
| spend-cap-enforced | exit 0, 18 passed |
| free-only-config | exit 0, 18 passed |
| llm-ocr-cache-hit | exit 0, 6 passed |
| per-visitor-ai-limit-e2e | exit 0, 6 passed |
| global-daily-cap-and-budget | exit 0, 10 passed |
| abuse-protection-matrix | exit 0, 39 passed |
| turnstile-first-call | exit 0, 9 passed |
| secret-non-leak | exit 0, 7 passed |
| stream-holdopen | exit 0, 4 passed |
| proxy-budget | exit 0, 4 passed |

`pnpm --filter @aduin/worker test`: 13 files / 146 passed. `pnpm --filter @aduin/worker typecheck`: exit 0. `pnpm slice:check --worker-only`: PASS (worker-only). `pnpm guard:cf`: OK. `pnpm secrets:scan`: OK. `validate-risk-artifacts.mjs harness/phase-04a`: warnings [], failures [].

### Residual (unchanged)
OpenRouter's real accounting of aborted or 4xx requests, and the served-model string format, are still unproven. Both need the Phase 05/10 live probe. The breaker is per-isolate until 04b. F7 (pre-limit Map.clear) is accepted.
