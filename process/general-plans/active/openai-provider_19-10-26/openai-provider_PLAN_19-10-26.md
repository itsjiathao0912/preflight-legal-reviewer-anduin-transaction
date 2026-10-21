---
name: plan:openai-provider
description: "Add OpenAI (direct, gpt-4.1-mini) as a config-selected AI/OCR provider beside OpenRouter, with a $10 lifetime reserve/settle spend cap"
date: 19-10-26
feature: general
---

# PLAN: OpenAI as a config-selected AI/OCR provider

Date: 19-10-26
Status: M1-M4 CODE DONE (19-10-26, EVL pending); M5 not started (hard stops)
Complexity: COMPLEX (5 milestones, one plan file; high-risk classes: billing/credits, secrets/trust-boundary, deploy/runtime)
**SPEC:** `process/general-plans/active/openai-provider_19-10-26/openai-provider_SPEC_19-10-26.md` (user-approved; Open Questions resolved with defaults)
**Execution model:** opus for EXECUTE legs; sonnet for everything else.

**TL;DR:** Add a small provider seam in the Worker so `AI_PROVIDER` picks OpenRouter (today, byte-identical) or OpenAI `gpt-4.1-mini` (new). OpenAI calls reserve worst-case cost against a lifetime `spend|openai` counter in the existing `quota_counter` table before dispatch, then settle to actual usage. No D1 migration. Ship in 5 milestones; deploy/secret/probe steps are hard stops for the orchestrator.

## Overview

Context sources: `process/context/all-context.md`, `process/context/worker/all-worker.md`, `process/context/engine/all-engine.md`, `process/context/tests/all-tests.md`, `process/development-protocols/plan-lifecycle.md`.

Today all AI and OCR go through OpenRouter free models. This plan implements the INNOVATE Decision Summary (10 decisions, approved "Go") exactly. The plan is a single COMPLEX plan (not a phase program): milestones are sequential and share one blast radius in `apps/worker`, so splitting into phase files adds overhead without benefit.

Locked user decisions: call OpenAI directly; `gpt-4.1-mini` for text and OCR; $10 TOTAL lifetime cap, never resets, fail closed; keep OpenRouter selectable via `AI_PROVIDER`; opus for EXECUTE.

## Goals

1. `AI_PROVIDER=openai` routes AI and OCR to `https://api.openai.com/v1` with `gpt-4.1-mini`; `openrouter` is byte-identical to today; anything else turns AI/OCR off without breaking memory routes.
2. OpenAI spend can never exceed $10 lifetime, even under concurrency, and is never silently under-counted.
3. OpenAI success never trips the breaker; OpenAI quota/auth errors are classified non-retryable.
4. Key never leaves Worker secrets; secrets scan catches OpenAI key shapes.
5. Rollout is reversible by flipping one var (no schema change).

## Scope

In: `apps/worker` (config, upstream, platform, proxy pipeline, routes/proxy quota, wrangler.jsonc, tests and fakes), `apps/web` (OCR model constants, banner copy check, tests), `scripts` (precompute-ocr constant, secrets-scan, live-guard allow-list, new direct probe script, tests), docs (README, `docs/DEPLOY.md`, `process/context/worker/all-worker.md`, `process/context/all-context.md`).

Out (from SPEC): new screens or provider chooser, other models, UI cap reset, per-visitor dollar budgets, detector/prompt changes, BYOK, any change to zone `itsjiathao.com`, editing `CLAUDE.md` (an OpenAI credentials row is proposed in the closeout only), any change in `packages/core` (core `responseFormat`, `TASKS`, `OcrResultSchema`, `ERROR_CODES` stay untouched; `reason` is already a free string).

## Data Flow

1. Browser -> `POST /api/ai` or `/api/ocr` -> existing guards (origin, limits, Turnstile, cache). Cache hit returns without any spend.
2. Right after config load (before the cache read, because the cache key now carries the provider model): `provider = providerFor(cfg)`. `invalid` -> refuse `quota_exhausted`/`ai_unavailable` (existing `unavailable()` helper), log `proxy.config_invalid_provider` (operator-only), zero port calls, no upstream. Then the cache read uses `provider.modelFor(kind)` in the cache key (OpenRouter: `models[0]`, byte-identical to today).
3. Existing claims (visitor, global request counts) run first. If `provider.metered`, the spend reservation runs LAST: `SpendPort.reserve(worstCaseMicroUsd)` against `spend|openai`. Refusal refunds every earlier claim and returns `budget_cap` reason `spend_cap`; zero upstream fetches.
4. Dispatch `provider.call(body)` (OpenAI: `redirect:'manual'`, Bearer `OPENAI_API_KEY`, `stream:true`, `stream_options.include_usage:true`).
5. SSE assembled by existing `upstream/sse.ts`; final usage chunk read. `provider.checkServed(servedId)` -> ok/trip/unknown; trip feeds the existing breaker.
6. Result normalised (`normalizeOcr` drops nulls before `OcrResultSchema.safeParse`), cached, streamed as today's NDJSON frames.
7. `SpendPort.settle(token, actualMicroUsd | keepWorst | release)` per the settle table (M2 item 2.4). Ledger row written as today; counter is authoritative.

## Touchpoints

| File | Change |
|---|---|
| `apps/worker/src/config.ts` | Soft-parse `AI_PROVIDER` -> `'openrouter'|'openai'|'invalid'`, add `openaiApiKey` (from `OPENAI_API_KEY`), never throw for provider; fingerprint per provider |
| `apps/worker/src/upstream/provider.ts` (new) | Provider interface + `providerFor(cfg)`; openrouter impl delegating to existing functions |
| `apps/worker/src/upstream/openai.ts` (new) | Host/model/price constants, `buildOpenAiBody`, `callOpenAi`, `checkServedOpenAi`, `classifyOpenAiError`, schema transformer, OCR wire schema, `normalizeOcr`, `worstCaseMicroUsd`, `costMicroUsd` |
| `apps/worker/src/upstream/openrouter.ts`, `models-config.ts`, `classify.ts`, `sse.ts` | Unchanged bodies; `classify.ts` failure type gains optional `usage` (additive); `sse.ts` exposes usage tokens if not already |
| `apps/worker/src/platform/spend.ts` (new) | `SpendPort` (reserve/settle) on `QUOTA_SQL.claim/refund`, key `spend|openai` |
| `apps/worker/src/platform/index.ts`, `proxy/ports.ts` | Optional `spend?: SpendPort` on `ProxyPlatform` |
| `apps/worker/src/proxy/pipeline.ts` | Use provider seam; reservation last; settle on every exit path; `callWithFallback` only for openrouter |
| `apps/worker/src/proxy/errors.ts`, `proxy/log.ts` | `spend_cap`, `provider_balance`, `provider_auth` reasons; `proxy.usage_missing`, `proxy.spend_overrun` log events |
| `apps/worker/src/routes/proxy/quota.ts` | `global_ok=false` when provider is `invalid`, the active provider key is missing, or OpenAI remaining < OCR worst case; no spend numbers in the visitor JSON (AC14) |
| `apps/worker/src/routes/proxy/index.ts` | Logger secret list adds `cfg?.openaiApiKey` (today `[cfg?.apiKey, cfg?.turnstileSecret]`) so the key is scrubbed from every log line |
| `apps/worker/src/index.ts` | `buildApp` wires `spend` from `createD1Platform`; must not throw for any `AI_PROVIDER` value |
| `apps/worker/wrangler.jsonc` | `"AI_PROVIDER": "openrouter"` (M1), later `"openai"` (M5 step 5.4) |
| `apps/worker/test/fakes/harness.ts` | `baseEnv` adds `AI_PROVIDER:'openrouter'` |
| `apps/worker/test/memory/budget-probe.ts`, `apps/worker/test/memory/ai-fail-closed-without-secrets.test.ts` | Env fixtures built without `baseEnv`: add `AI_PROVIDER:'openrouter'` only (no assertion change). EXECUTE re-greps `apps/worker/test` for any other env literal that reaches `/api/ai` or `/api/ocr` |
| `apps/worker/test/fakes/openai-stub.ts` (new) | OpenAI-shaped SSE stub; refuses any host other than `api.openai.com` |
| `apps/worker/test/proxy/*` new test files | listed in Verification Evidence |
| `apps/web/src/engine/ocr-queue.ts` | `OCR_MODEL='gpt-4.1-mini'`, new `PRECOMPUTED_OCR_MODEL='nvidia/nemotron-3.5-super-vl:free'`; `ocrKeyParts`/`ocrPageKey` gain a `model` parameter (default `OCR_MODEL`); the precomputed lookup uses the `PRECOMPUTED_OCR_MODEL` key, the Dexie cache uses the `OCR_MODEL` key; new `OCR_UNAVAILABLE_SPEND` reason for `budget_cap`/`spend_cap` |
| `apps/web/src/features/ai/banner-map.ts` | New `BannerKey` `spend_limit` (resume `none`); `budget_cap`/`spend_cap` -> `spend_limit`; `budget_cap`/`provider_balance` -> `ai_unavailable`; `upstream_failed`/`provider_auth` -> `provider_error` (existing default) |
| `apps/web/test/no-e2e-hook-in-dist.test.ts` | Also assert the production build text has no provider key pattern (regex built at runtime) and no `OPENAI_API_KEY` string |
| `apps/web/e2e/slice.spec.ts` | Outbound browser-request check matches `openrouter.ai` OR `api.openai.com` (browser never calls a provider) |
| `scripts/src/precompute/precompute-ocr.ts` | Add `PRECOMPUTED_OCR_MODEL` (same value) and keep `OCR_MODEL` as an alias export so `scripts/test/ocr-live-guard.test.ts` and `record-ocr.ts` keep compiling; behaviour unchanged |
| `scripts/src/guards/secrets-scan.ts` | Add rule `openai-key`: regex `(?<![A-Za-z0-9_-])sk-(proj-)?[A-Za-z0-9_-]{20,}` excluding matches that start with the OpenRouter prefix (still rule `openrouter-key-prefix`); the left boundary stops false hits on words like `risk-evidence-pack-validator` |
| `scripts/src/deploy/preflight.ts` | New check "no provider key pattern in built assets" (same regex + OpenRouter prefix), value never printed |
| `scripts/src/live/common.ts` | Served-model stop condition -> allow-list (`:free` or `^gpt-4\.1-mini(-\d{4}-\d{2}-\d{2})?$`) |
| `scripts/src/live/probe-openai-direct.ts` (new) + `scripts/package.json` script `probe:openai-direct` | Stage-1 direct probe, 3 calls, in-code ceiling 3 |
| (no edit to `scripts/src/guards/*`) | The direct probe pins `https://api.openai.com/v1` as a constant inside `probe-openai-direct.ts` (same pattern as `record-ai.ts` pinning `openrouter.ai`); the `live/common.ts` target allow-list stays workers.dev-only |
| `README.md`, `docs/DEPLOY.md`, `process/context/worker/all-worker.md`, `process/context/all-context.md` | Privacy sentence, provider/rollout/cap docs, known gaps |

## Public Contracts

- HTTP/NDJSON shapes unchanged. New `reason` values (free string, already allowed by core `ErrorDetailSchema`): `spend_cap` (code `budget_cap`, 503), `provider_balance` (code `budget_cap`, non-retryable), `provider_auth` (code `upstream_failed`, 502). Error messages never echo upstream bodies.
- `/api/quota`: `global_ok` becomes false when OpenAI remaining budget < OCR worst case. Visitor-facing payload adds no spend numbers.
- Operator spend surface (AC14): structured log line `proxy.spend` on every reserve refusal and every settle, fields `{kind, provider:'openai', outcome:'actual'|'keep'|'release'|'overrun'|'refused', reserved_micro_usd, actual_micro_usd, total_micro_usd, cap_micro_usd}` (visible via `wrangler tail`); plus the documented read-only D1 query in `all-worker.md` and `docs/DEPLOY.md`: `pnpm --filter @aduin/worker exec wrangler d1 execute aduin-transaction-db --remote --command "SELECT count, updated_at FROM quota_counter WHERE scope='spend' AND key='spend|openai' AND window='all'"` and `SELECT at, model, cost_micro_usd FROM spend_ledger ORDER BY at DESC LIMIT 20`. Never in `/api/quota`, `/api/health` or any visitor response.
- Config: new var `AI_PROVIDER` (`openrouter` | `openai`), new secret `OPENAI_API_KEY`. `OPENROUTER_API_KEY` kept.
- Fingerprints: OpenRouter fingerprint unchanged; OpenAI fingerprint `['openai', 'gpt-4.1-mini', spendCap]`.
- Storage: `quota_counter` row key `spend|openai` (window `all`, never purged). No migration; `schema_version` stays 6.
- Web OCR Dexie cache key now uses `gpt-4.1-mini` for live OCR; precomputed #9 lookup keeps the old id.

## Blast Radius

- Packages: `apps/worker` (primary), `apps/web` (2 files + tests), `scripts` (4 files + tests), docs. `packages/core`: none.
- High-risk classes: billing/credits (spend counter, reserve/settle), secrets/trust-boundary (new key, scanner), deploy/runtime (var flip, secret put, live calls), public API (new reasons, quota semantics). `vc-risk-evidence-pack` applies at M5.
- D1: no schema change; new rows only. All Worker versions stay write-compatible with schema 6, so rollback = flip var or `wrangler rollback` to `72dc83ba` lineage.
- Existing 608 worker tests must pass with assertions unmodified (harness default `openrouter`); the only allowed test edits are adding `AI_PROVIDER:'openrouter'` to env fixtures that bypass `baseEnv` (missing = invalid per SPEC AC1).

## Security (STRIDE quick scan)

| Threat | Mitigation |
|---|---|
| Spoofing upstream / redirect to attacker host | Host is a code constant, no env override; `redirect:'manual'`; stub refuses other hosts |
| Tampering with spend via concurrency | Atomic `QUOTA_SQL.claim` reserve before dispatch; concurrency test near cap |
| Repudiation (spend not traceable) | Ledger row per call + `proxy.usage_missing`/`spend_overrun` logs |
| Info disclosure (key in logs/bundle/errors) | Key only in `env`; error bodies read ≤4 KB, never echoed; bundle and response grep gates; secrets-scan patterns |
| DoS by exhausting $10 | Existing per-visitor/global request limits + Turnstile remain; cap is fail-closed (accepted product behaviour) |
| Elevation (visitor sees operator spend) | Quota route exposes only on/off to visitors |

## Risk Predictions (vc-predict, condensed)

1. Pipeline refactor changes OpenRouter bytes -> mitigated by body byte-parity test and unmodified 608 suite.
2. OpenAI strict schema rejects transformed schemas -> stage-1 live probe (M5.3) before the flip; transformer unit tests.
3. Settle missed on an exit path (abort, timeout) -> settle-matrix test enumerates every exit; `finally`-style single settle point.
4. Prices wrong -> step 4.0 confirms on pricing page and against probe usage; constant dated.
5. Counter rollback by D1 Time Travel restore -> documented known gap.

## Implementation Checklist

Rules for EXECUTE: one token per test call, never `test -- <token>`; no `git stash`, `git checkout`, `git reset`; commit on `main` per milestone with conventional prefixes; never read `~/.config/openai/credentials.env` except where step 5.3 explicitly loads it via the `APPROVED:` marker; never print keys.

### M1 - Provider seam, soft config, harness

1.1 `apps/worker/src/config.ts`: add `aiProvider: 'openrouter' | 'openai' | 'invalid'` parsed from `AI_PROVIDER` (see 1.1a for the missing case), and `openaiApiKey` from `OPENAI_API_KEY`. Never throw for these.
1.1a Missing `AI_PROVIDER` resolves to `'invalid'` (SPEC AC1: missing fails closed). Parsing: trimmed value exactly `openrouter` or `openai`, anything else (missing, empty, other case, non-string) -> `'invalid'`. `loadConfig` and `configFor` NEVER throw for `AI_PROVIDER` or `OPENAI_API_KEY` (they also back `buildApp`, `memory/ctx.ts` and the quota route). `wrangler.jsonc` and `baseEnv` always set it; env fixtures that bypass `baseEnv` (`test/memory/budget-probe.ts`, `test/memory/ai-fail-closed-without-secrets.test.ts`, plus any found by grep) get `AI_PROVIDER:'openrouter'` added, nothing else.
1.2 Fingerprint: openrouter path returns the existing array byte-identical; openai path returns `['openai', 'gpt-4.1-mini', spendCapMicroUsd]`.
1.3 New `apps/worker/src/upstream/provider.ts`: interface `Provider { id; modelFor(kind); buildBody; call; responseFormat; normalizeOcr?; checkServed(id): 'ok'|'trip'|'unknown'; classifyError?; metered: boolean }` and `providerFor(cfg)`. OpenRouter impl delegates to existing `buildBody`, `callOpenRouter`, `servedTier`, `freeModelsFor`; `metered:false`.
1.4 `proxy/pipeline.ts`: route through `providerFor`; `callWithFallback` only when `id==='openrouter'`; `invalid` -> `unavailable()` (`quota_exhausted`/`ai_unavailable`) right after config load, before the cache read, zero port calls; memory routes untouched.
1.4a Cache key `model` = `provider.modelFor(kind)` (OpenRouter returns `models[0]`, so its keys are byte-identical; OpenAI returns `gpt-4.1-mini`), so a cached OpenRouter answer is never served under the OpenAI provider and vice versa.
1.4b The missing-key check (`!cfg.apiKey`) becomes provider-aware (`openrouter` -> `apiKey`, `openai` -> `openaiApiKey`); same in the quota route `global_ok`.
1.5 `wrangler.jsonc`: add `"AI_PROVIDER": "openrouter"`.
1.6 `test/fakes/harness.ts` `baseEnv`: add `AI_PROVIDER:'openrouter'`.
1.7 Tests: `provider-switch-matrix.test.ts` (openrouter/openai/invalid/missing; invalid + missing: zero upstream, `loadConfig` does not throw, memory `/api/memory/*` still 200 via `configFor`; cache isolation: an entry cached under provider openrouter is a MISS under openai), `openrouter-body-byte-parity.test.ts` (captured request body equals pre-change golden for each task + OCR).
1.8 Gate M1 (see Verification Evidence, M1 rows). Commit `feat(worker): provider seam with AI_PROVIDER soft config`.

### M2 - SpendPort, reserve/settle, quota

2.1 New `apps/worker/src/platform/spend.ts`: `SpendPort { reserve(units): {ok:true, token} | {ok:false}; settle(token, actualUnits | 'keep' | 'release') }` using `QUOTA_SQL.claim/refund` on key `spend|openai` with limit = `spendCapMicroUsd` (10_000_000). Scope `'spend'` (so the existing `capFor`/`withSessionCaps` kind `spend` applies), key `spend|openai`; no day suffix so `splitWindow` gives window `'all'`; `apps/worker/src/memory/repo/purge.ts:47` skips `'all'` (assert in test). `spend.ts` owns its SQL: reserve = the `QUOTA_SQL.claim` statement reading its `RETURNING count` (the running total), settle-down = `UPDATE ... SET count = MAX(0, count - ?) ... RETURNING count`, overrun = the claim statement bound with cap `Number.MAX_SAFE_INTEGER`; `QUOTA_SQL` itself is not changed.
2.2 Add optional `spend?: SpendPort` to `ProxyPlatform` (`proxy/ports.ts`, `platform/index.ts`); fake platform implements it in-memory over the same claim semantics.
2.3 Pipeline: if `provider.metered`, reserve `worstCaseMicroUsd` as the LAST claim; on refusal refund all earlier claims, return `budget_cap`/`spend_cap`, no fetch.
2.4 Settle table (single settle point covering every exit):
  - success + usage -> settle to actual cost
  - success without usage -> keep worst; log `proxy.usage_missing`
  - malformed / `finish_reason:length` with usage -> actual; without -> worst
  - 400 schema error / 401 / 403 / `insufficient_quota` -> release fully
  - client abort BEFORE dispatch -> release fully (missing key never reaches reserve)
  - 5xx, 429 rate limit, network error, timeout, truncated stream, client abort after dispatch -> keep worst
  - actual > reserved -> increase by difference without cap check; log `proxy.spend_overrun`
  - every settle and every refusal logs one `proxy.spend` line (see Public Contracts) with the running total and the cap
  - ledger row for a metered success: `cost_usd = settledMicroUsd / 1e6` (so `spend_ledger.cost_micro_usd` is non-zero, needed by AC19)
2.5 `upstream/classify.ts`: classified failure gains optional `usage` (additive; existing callers unchanged).
2.6 `/api/quota`: `global_ok=false` when `cap - spent < worstCase(OCR, one image)` (one extra peek read of `spend|openai`, openai provider only); operator detail per SPEC AC14 = the `proxy.spend` log line plus the documented read-only D1 query (Public Contracts); visitor JSON keeps exactly `{ai, ocr_pages, global_ok}`.
2.7 Tests: `spend-lifetime-counter.test.ts` (survives UTC midnight clock advance, `cron-purge`, platform re-create on same D1), `spend-reserve-settle-matrix.test.ts` (every row of 2.4), `spend-cap-concurrency.test.ts` (N parallel calls near cap; final counter ≤ 10_000_000 and refused calls made 0 fetches), `spend-cap-refusal.test.ts` (at cap: `budget_cap`/`spend_cap`, plain message, 0 fetches, earlier claims refunded), `quota-spend-global-ok.test.ts` (global_ok flips near the cap; quota and health bodies carry no spend numbers or keys), `spend-operator-log.test.ts` (each settle row emits one `proxy.spend` line with `total_micro_usd` and `cap_micro_usd`; no key or body in the line; openai path port calls ≤ 15).
2.8 Gate M2. Commit `feat(worker): lifetime OpenAI spend reserve and settle`.

### M3 - OpenAI module

3.1 `upstream/openai.ts` constants: `OPENAI_BASE = 'https://api.openai.com/v1'`, `OPENAI_MODEL = 'gpt-4.1-mini'`, `OPENAI_PRICES_MICRO_USD_PER_MTOK = {'gpt-4.1-mini': {in: 400_000, out: 1_600_000}}` with comment `UNVERIFIED until step 4.0` (replaced by a dated "verified dd-mm-yy" comment in 4.0).
3.2 `costMicroUsd(inTok, outTok) = ceil(inTok*0.4 + outTok*1.6)`; cached-token discount ignored. `worstCaseMicroUsd(body)`: inTok = UTF-8 byte length of the text message parts + UTF-8 byte length of the `response_format` JSON (structured-output schemas are billed as input) + 3000 per image part (image base64 bytes are NOT counted) + 16 per message; out = `max_completion_tokens`; ceil.
3.3 `buildOpenAiBody`: `{model, messages, temperature:0, max_completion_tokens, response_format, stream:true, stream_options:{include_usage:true}}`; no `models`, `provider`, `usage`, or other OpenRouter-only fields.
3.4 `callOpenAi`: `fetch(OPENAI_BASE + '/chat/completions', {method:'POST', redirect:'manual', headers:{Authorization:'Bearer ' + key, 'content-type':'application/json'}})`. Missing key -> AI-off refusal before reserve.
3.5 Schema transformer: deep copy core text schemas, strip `minLength`, `maxLength`, `minimum`, `maximum`, `maxItems`; `strict:true`. Hand-written OCR wire schema: every property listed in `required`, `bbox` and `conf` required but nullable, `additionalProperties:false` on every object, `v` as `enum` (not `const`), no `ext`, no length/range keywords. `normalizeOcr` drops null fields then `OcrResultSchema.safeParse`. Core schemas remain the post-parse validators.
3.6 `checkServed`: `^gpt-4\.1-mini(-\d{4}-\d{2}-\d{2})?$` -> ok, anything else -> trip.
3.7 `classifyOpenAiError`: for 401/403/429 read ≤4 KB body (never echoed or logged raw); 429 with `error.code`/`type` `insufficient_quota` -> `budget_cap`/`provider_balance` non-retryable, not consumed; 401/403 -> `upstream_failed`/`provider_auth`; other 429 -> existing `provider_rate_limited`.
3.8 OpenAI provider impl in `provider.ts` (`metered:true`); `routes/proxy/index.ts` logger secret list adds `cfg?.openaiApiKey`.
3.9 `test/fakes/openai-stub.ts`: OpenAI SSE chunks with final usage chunk; scripted errors; throws on any URL host other than `api.openai.com`.
3.10 Tests: `openai-request-shape.test.ts` (each text task + OCR body; no OpenRouter fields; usage requested; schema keywords stripped), `openai-ocr-normalise.test.ts`, `openai-e2e-ndjson-parity.test.ts` (same NDJSON frames as OpenRouter path for equivalent answer), `openai-served-breaker.test.ts` (dated id ok, no breaker trip; foreign id trips), `openai-error-classify.test.ts` (insufficient_quota, 401, 403, rate 429, body not echoed), `openai-cost.test.ts` (known token counts -> exact µUSD), `openai-host-pinned.test.ts`, extend `secret-non-leak` scenario for `OPENAI_API_KEY` (responses AND captured log lines).
3.11 Gate M3. Commit `feat(worker): OpenAI gpt-4.1-mini provider`.

### M4 - Web, scripts, guards

4.0 Price verification: operator/agent confirms gpt-4.1-mini input/output prices on OpenAI's pricing page (manual, read-only web); update constant if different and replace comment with `verified 19-10-26 (pricing page)`; re-confirmed against stage-1 probe usage in 5.3.
4.1 `apps/web/src/engine/ocr-queue.ts`: `OCR_MODEL='gpt-4.1-mini'`; `PRECOMPUTED_OCR_MODEL='nvidia/nemotron-3.5-super-vl:free'`; `ocrKeyParts(sourceHash, pageIndex, params, model = OCR_MODEL)`; in the queue compute the precomputed key with `PRECOMPUTED_OCR_MODEL` and the Dexie cache key with `OCR_MODEL`; add `OCR_UNAVAILABLE_SPEND = 'Text reading is off: the spend limit has been reached'` for `budget_cap`/`spend_cap`.
4.2 `scripts/src/precompute/precompute-ocr.ts`: add `PRECOMPUTED_OCR_MODEL` (same value; free-only guard unchanged) and keep `export const OCR_MODEL = PRECOMPUTED_OCR_MODEL` so existing imports compile. Regeneration of #9 deferred (SPEC default), labelled old model.
4.3 Update web `apps/web/test/ocr-never-sends-pdf.test.ts` (it pins the old id in `ocrKeyParts`) and web `ocr-ai-consent` tests for the new constant; add web unit `ocr-model-constants.test.ts` (live key uses `gpt-4.1-mini`, precomputed lookup still hits the committed #9 index).
4.4 `banner-map.ts`: today `budget_cap` maps to `budget` ("the AI budget for today is used up", resume `midnight`), which is wrong for a lifetime cap. Add `BannerKey` `spend_limit` = `{reason: 'the spend limit has been reached, so AI review is switched off', short: 'spend limit reached', resume: 'none', lane: 'skipped'}`; `bannerFor`: `budget_cap` + `spend_cap` -> `spend_limit`, `budget_cap` + `provider_balance` -> `ai_unavailable`, `circuit_breaker` unchanged, other `budget_cap` -> `budget`; `provider_auth` falls to `provider_error`. Check every `BannerKey` consumer (`ai-lane.ts`, `compare/AiSummary.tsx`) compiles. New web unit test file `banner-spend-cap.test.ts` (banner mapping + OCR `OCR_UNAVAILABLE_SPEND`).
4.5 `secrets-scan.ts`: add rule `openai-key` with `(?<![A-Za-z0-9_-])sk-(proj-)?[A-Za-z0-9_-]{20,}` (skip matches starting with the OpenRouter prefix); fixtures (built at runtime with `join('-')`, never literal) prove: `sk-proj-...` and legacy `sk-...` flagged, `sk-or-` still `openrouter-key-prefix`, short `sk-` words and `risk-evidence-pack-validator`-style words not flagged. `pnpm secrets:scan` must stay clean on the current tree.
4.6 `scripts/src/live/common.ts`: served-model stop -> allow-list `:free` suffix or `^gpt-4\.1-mini(-\d{4}-\d{2}-\d{2})?$`; tests in `live-guards.test.ts`.
4.7 New `scripts/src/live/probe-openai-direct.ts`: requires `ALLOW_LIVE_LLM=1`, ceiling 3 calls (counted in the existing outside-repo live ledger from `live/common.ts`), host constant `https://api.openai.com/v1` pinned in the script (no env override, `redirect:'error'`), `max_completion_tokens` 64, tasks clause_judgment, counsel_draft, one OCR page; prints only status, served model, usage tokens and computed µUSD; aborts on non-allow-listed served model. Offline test `probe-openai-direct.test.ts` with injected fetch.
4.7a Bundle and deploy key checks: extend `apps/web/test/no-e2e-hook-in-dist.test.ts` (it builds into a temp dir itself) to assert no provider key pattern and no `OPENAI_API_KEY` string in the production build; add the same pattern as a `deploy:preflight` check with a case in `scripts/test/live/deploy-preflight.test.ts`; extend `apps/web/e2e/slice.spec.ts` outbound regex to `/openrouter\.ai|api\.openai\.com/i`.
4.8 Gate M4. Commit `feat: web OCR model, secrets scan and live guards for OpenAI`.

### M5 - Docs, rollout, operator probe

5.1 Docs: README privacy sentence ("When AI review or OCR is used, sub-document text and scanned pages are sent to OpenAI."), `docs/DEPLOY.md` (secret, var flip, rollback), `process/context/worker/all-worker.md` (provider seam, spend counter authoritative over ledger, Time Travel restore rolls counter back, combined OpenRouter+OpenAI cap is a known gap), `process/context/all-context.md`. Commit `docs: OpenAI provider and lifetime spend cap`.
5.2 HARD STOP (outward, orchestrator; EXECUTE returns here and does not deploy): deploy from `main` with `AI_PROVIDER=openrouter` using the recipe in `process/context/worker/all-worker.md`: `pnpm guard:cf && pnpm secrets:scan`; `VITE_TURNSTILE_SITE_KEY=<site key> pnpm --filter @aduin/web build` (plain build, key inline, never printed or exported; read per the "Site key source" rule); `pnpm --filter @aduin/scripts deploy:preflight`; `pnpm --filter @aduin/worker exec wrangler deploy`; then the live stack check; confirm identical behaviour.
5.3 HARD STOP (secret + billed): `wrangler secret put OPENAI_API_KEY` on Worker `preflight-legal-reviewer` (keep `OPENROUTER_API_KEY`); then stage-1 probe `ALLOW_LIVE_LLM=1 pnpm --filter @aduin/scripts probe:openai-direct` with key loaded via `APPROVED:` marker, never printed. 3 calls. Record usage vs price constant.
5.4 HARD STOP (deploy): set `"AI_PROVIDER": "openai"` in `wrangler.jsonc`; re-run `pnpm --filter @aduin/worker test` (the vitest pool reads `wrangler.jsonc` vars; must stay green); commit on `main` (`chore(worker): switch AI_PROVIDER to openai`); deploy with the 5.2 recipe; live stack check.
5.5 HARD STOP (operator, human Turnstile): stage-2 probe via Worker, ≤3 calls (one AI, one OCR, one extra); check `spend|openai` > 0 with the documented read-only D1 query, `spend_ledger` row with non-zero `cost_micro_usd`, a `proxy.spend` line in `wrangler tail`, breaker not tripped. Residual for AC19 if not run.
5.6 Rollback: flip `AI_PROVIDER` back and redeploy, or `wrangler rollback` to the previous version (all schema-6 compatible). No push without user OK.

## Phase Loop Progress

- [x] M1 seam + soft config + harness (CODE DONE 19-10-26, commit 578bbf4; execute-agent gates green, EVL pending)
- [x] M2 SpendPort + reserve/settle + quota (CODE DONE 19-10-26, commit 578bbf4; gates green, EVL pending)
- [x] M3 OpenAI module + transformer + normaliser + errors + checkServed + prices + stub (CODE DONE 19-10-26, commit 578bbf4; gates green, EVL pending)
- [x] M4 web constants, banner, precompute alias, secrets-scan, live-guard allow-list, direct probe, bundle/preflight key checks (CODE DONE 19-10-26; gates green, EVL pending)
- [ ] M5 docs + rollout (5.2-5.5 hard stops) + operator probe

## Deviations

Recorded by EXECUTE (19-10-26). All within the plan's blast radius; no schema, auth, API-shape or deploy change.

1. Commits: M1-M3 landed as ONE worker commit (578bbf4) instead of three, because the pipeline settle point (M2) and the provider seam (M1) live in the same function; M4 is its own commit. Impact: none on behaviour.
2. Step 4.0 price check NOT done (EXECUTE cannot browse). The constant stays 400_000 / 1_600_000 µUSD per MTok with a dated comment "launch price, to confirm in M5.3 probe" (`apps/worker/src/upstream/openai.ts`). M5.3 must compare probe usage x price with the OpenAI dashboard.
3. `worstCaseMicroUsd(kind, messagesJson, responseFormatJson)` takes the parts instead of the full body string: the OCR base64 data URL is cut out before parsing (CPU), text parts are counted exactly as specified. Same formula.
4. `normalizeOcr` only drops nulls; `OcrResultSchema.safeParse` runs right after it in the shared classify tail (via a classify hook). Same behaviour as 3.5.
5. `classify.ts`: the success result also gains optional `tokens` (needed for "success + usage -> actual"); failures gain `tokens` as planned. Additive.
6. Web OCR queue: after a refusal, later pages now reuse the refusal reason (so every page says `OCR_UNAVAILABLE_SPEND` at the cap instead of "page limit reached for today"). Small addition needed for AC13 copy consistency.
7. `apps/web/e2e/auto-downgrade.spec.ts` (not in Touchpoints) pinned the old mapping `budget_cap/spend_cap -> budget`; updated to `spend_limit` and added a plain `budget_cap` row that keeps `budget`. `apps/web/e2e/ai-banners.spec.ts` row `provider_balance` updated from `budget` to `ai_unavailable` per 4.4.
8. `scripts/src/live/common.ts`: the stop message keeps the words "not :free" (now "is not :free or gpt-4.1-mini") so the existing live-guards assertions stay unchanged.
9. Direct probe imports the Worker body builders (`apps/worker/src/upstream/openai.ts`, `openrouter.ts`, `sse.ts`) so the probe sends exactly the Worker's request shape; ledger claims use kinds `ai` x2 and `ocr` x1.

Pre-existing gate failures NOT caused by this work (other sessions' commits on main): scripts `counts-wording` expects 13 detectors but commit c900fa5 (option-condition-coverage) added a 14th; `pnpm lint` prettier warning on `apps/web/src/features/review/zoom/findings-v2-css-guard.test.ts` (committed unformatted in a8e9745).

## Phase Completion Rules

- A milestone is CODE DONE when its checklist is implemented; it is green only when its gate rows below all pass via a spawned vc-tester (EVL).
- M5 is VERIFIED only after 5.2 and 5.4 live checks pass and the user confirms; 5.5 may close as an operator residual (backlog stub) with AC19 CONDITIONAL.
- Never mark VERIFIED without user confirmation.

## Acceptance Criteria

| SPEC AC | proven by | strategy |
|---|---|---|
| AC1 provider select / invalid fails closed | `provider-switch-matrix` | Fully-Automated |
| AC2 OpenRouter unchanged | full worker suite unmodified + `free-only-config` + `openrouter-body-byte-parity` | Fully-Automated |
| AC3 switch by var only | `provider-switch-matrix` (same build, env differs) | Fully-Automated |
| AC4 text request accepted | `openai-request-shape` + stage-1 probe (5.3) | Hybrid |
| AC5 OCR request accepted | `openai-ocr-normalise` + stage-1 probe OCR page | Hybrid |
| AC6 same NDJSON frames | `openai-e2e-ndjson-parity` | Fully-Automated |
| AC7 cost from usage x price | `openai-cost` | Fully-Automated |
| AC8 no reset | `spend-lifetime-counter` | Fully-Automated |
| AC9 reserve before dispatch, no overshoot | `spend-cap-concurrency` | Fully-Automated |
| AC10 settle rules | `spend-reserve-settle-matrix` | Fully-Automated |
| AC11 missing usage -> worst | `spend-reserve-settle-matrix` (no-usage row) | Fully-Automated |
| AC12 cap refusal, 0 upstream | `spend-cap-refusal` | Fully-Automated |
| AC13 UI degrades at cap | web e2e `ai-banners` extended with spend_cap fake (banner shows `spend_limit` copy, findings still render) + `banner-spend-cap` unit (banner + OCR reason) | Fully-Automated |
| AC14 spend observable to operator only | `quota-spend-global-ok` (visitor bodies carry no spend) + `spend-operator-log` (`proxy.spend` line with total/cap) + documented D1 query (docs grep) | Fully-Automated |
| AC15 OpenAI success no breaker trip | `openai-served-breaker` | Fully-Automated |
| AC16 quota/auth classified | `openai-error-classify` | Fully-Automated |
| AC17 scanner + no key in bundle/responses | scripts `secrets-scan` + worker `secret-non-leak` (responses + logs) + web `no-e2e-hook-in-d` (extended key-pattern check) + scripts `deploy-preflight` + `pnpm secrets:scan` | Fully-Automated |
| AC18 key only secret; docs say OpenAI | `secret-non-leak` + docs grep (5.1) | Hybrid |
| AC19 live probe | stage-2 operator probe (5.5) | Agent-Probe (residual if not run; keep CONDITIONAL + backlog stub) |
| AC20 OCR model consistency | web `ocr-model-constants` + web `ocr-never-sends-pdf` + web `ocr-ai-consent` + worker `llm-ocr-cache-hit` + worker `provider-switch-matrix` (cache isolation per provider) + scripts `ocr-live-guard` | Fully-Automated |

## Verification Evidence

Test context: `process/context/tests/all-tests.md` (one token per call; no `--`; unmatched token exits 1). Every token below was checked: existing tokens map to an existing file in the named package; new tokens name the new file this plan creates. Run web e2e serially (one agent at a time, port 4317) and never concurrently with the `stack` project.

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| M1: `pnpm --filter @aduin/worker test provider-switch-matrix` | Fully-Automated | AC1, AC3 |
| M1: `pnpm --filter @aduin/worker test openrouter-body-byte-parity` | Fully-Automated | AC2 |
| M1/M2/M3: `pnpm --filter @aduin/worker test` (full, 608 pre-existing pass unmodified) | Fully-Automated | AC2 |
| M1: `pnpm --filter @aduin/worker test free-only-config` | Fully-Automated | AC2 |
| M2: `pnpm --filter @aduin/worker test spend-lifetime-counter` | Fully-Automated | AC8 |
| M2: `pnpm --filter @aduin/worker test spend-reserve-settle-matrix` | Fully-Automated | AC10, AC11 |
| M2: `pnpm --filter @aduin/worker test spend-cap-concurrency` | Fully-Automated | AC9 |
| M2: `pnpm --filter @aduin/worker test spend-cap-refusal` | Fully-Automated | AC12 |
| M2: `pnpm --filter @aduin/worker test quota-spend-global-ok` | Fully-Automated | AC14 |
| M2: `pnpm --filter @aduin/worker test spend-operator-log` | Fully-Automated | AC14 |
| M2: `pnpm --filter @aduin/worker test proxy-budget` | Fully-Automated | AC2 (openrouter port budget unchanged) |
| M2: `pnpm --filter @aduin/worker test spend-cap-enforced` | Fully-Automated | AC2 (paid-fallback reservation unchanged) |
| M2: `pnpm --filter @aduin/worker test cron-purge` | Fully-Automated | AC8 (regression) |
| M3: `pnpm --filter @aduin/worker test openai-request-shape` | Fully-Automated | AC4 |
| M3: `pnpm --filter @aduin/worker test openai-ocr-normalise` | Fully-Automated | AC5 |
| M3: `pnpm --filter @aduin/worker test openai-e2e-ndjson-parity` | Fully-Automated | AC6 |
| M3: `pnpm --filter @aduin/worker test openai-cost` | Fully-Automated | AC7 |
| M3: `pnpm --filter @aduin/worker test openai-served-breaker` | Fully-Automated | AC15 |
| M3: `pnpm --filter @aduin/worker test openai-error-classify` | Fully-Automated | AC16 |
| M3: `pnpm --filter @aduin/worker test openai-host-pinned` | Fully-Automated | AC4 (security) |
| M3: `pnpm --filter @aduin/worker test secret-non-leak` | Fully-Automated | AC17, AC18 |
| M4: `pnpm --filter @aduin/web test ocr-model-constants` | Fully-Automated | AC20 |
| M4: `pnpm --filter @aduin/web test ocr-ai-consent` | Fully-Automated | AC20 |
| M4: `pnpm --filter @aduin/web test ocr-never-sends-pdf` | Fully-Automated | AC20 |
| M4: `pnpm --filter @aduin/worker test ocr-never-sends-pdf` | Fully-Automated | regression (worker OCR shape) |
| M4: `pnpm --filter @aduin/scripts test ocr-live-guard` | Fully-Automated | AC20 (precompute constant alias) |
| M4: `pnpm --filter @aduin/worker test llm-ocr-cache-hit` | Fully-Automated | AC20 |
| M4: `pnpm --filter @aduin/web test banner-spend-cap` | Fully-Automated | AC13 |
| M4: `pnpm --filter @aduin/web test:e2e ai-banners` (spend_cap case added) | Fully-Automated | AC13 |
| M4: `pnpm --filter @aduin/scripts test secrets-scan` | Fully-Automated | AC17 |
| M4: `pnpm --filter @aduin/scripts test live-guards` | Fully-Automated | AC19 (guard part) |
| M4: `pnpm --filter @aduin/scripts test probe-openai-direct` | Fully-Automated | AC4, AC5 (offline) |
| M4: `pnpm --filter @aduin/web test no-e2e-hook-in-d` (builds into its own temp dir) | Fully-Automated | AC17 (bundle) |
| M4: `pnpm --filter @aduin/scripts test deploy-preflight` | Fully-Automated | AC17 (deploy check) |
| M4: `pnpm --filter @aduin/web test` (full web unit) and `pnpm --filter @aduin/web test:e2e` (full preview, serial) | Fully-Automated | regression (banner keys, OCR keys) |
| All: `pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | AC17, regression |
| All: `pnpm --filter @aduin/core test` and `pnpm --filter @aduin/scripts test` (full) | Fully-Automated | regression (core untouched) |
| M5.1: `grep -c "sent to OpenAI" README.md` ≥ 1 and `grep -c "sent to OpenAI" docs/DEPLOY.md` ≥ 1 (two separate calls) and `grep -c "spend|openai" process/context/worker/all-worker.md` ≥ 1 | Fully-Automated | AC18, AC14 (docs) |
| M5.3: stage-1 direct probe (3 billed calls) | Hybrid (precondition: secret + user-approved key load) | AC4, AC5 |
| M5.2/5.4: `SLICE_BASE_URL=https://preflight-legal-reviewer.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` | Hybrid (precondition: deployed) | AC2, AC3 |
| M5.5: stage-2 operator probe via Worker, check `spend|openai` > 0, ledger row, breaker clear | Agent-Probe | AC19 |

Failing stubs (TDD red-first, for the validate-contract; not files): one `throw new Error("NOT IMPLEMENTED")` stub per Fully-Automated scenario above, named by its token.

Known-Gap residuals (named, with justification; none is the only proof of a developed behaviour): live combined OpenRouter+OpenAI cap (separate counters by design); D1 Time Travel restore rolls the counter back (operator action, documented); web OCR Dexie key is build-time, so after an `AI_PROVIDER` flip back to openrouter a visitor's local cache may hold `gpt-4.1-mini` lines for the same page (same page text, harmless, cleared by existing retention); OpenAI 429 rate limits keep the worst-case reservation (fail toward over-count, per SPEC); AC19 if operator does not run 5.5 (backlog stub `process/general-plans/backlog/openai-stage2-probe_NOTE_19-10-26.md`, written by EXECUTE at 5.5 if not run).

## Dependencies

- M2 depends on M1 (provider `metered` flag). M3 depends on M1+M2 (OpenAI provider uses SpendPort). M4.1-4.6 independent of M3 code but gated after M3 for one integrated suite. M4.7 before M5.3. M5 strictly after M1-M4 green and committed. Ordering verified sequentially: no step consumes a later step's output.
- External: OpenAI key (operator has it), Cloudflare credentials, human Turnstile for 5.5.

## Integration Notes

- `configFor` also backs `memory/ctx.ts` and `index.ts`: provider parsing must never throw (covered in `provider-switch-matrix`).
- `spend|global` (OpenRouter paid fallback; key has no day suffix, so it is also window `all` today) is untouched and separate from `spend|openai`.
- D1 write budget: one extra claim + one settle write per OpenAI call (within existing Free-plan budget at ≤35 AI requests/day).

## Rollback

Flip `AI_PROVIDER` to `openrouter` and redeploy, or `wrangler rollback`. No schema change; `spend|openai` row stays (frozen). Never roll back to ≤`8a82ead2`.

## Test Infra Improvement Notes

- New `openai-stub.ts` fake that refuses unscripted hosts is reusable for any future direct provider.
- Consider a shared golden for upstream request bodies per provider (byte-parity pattern).

## Validate Contract

Status: PASS
Date: 19-10-26
date: 2026-10-19
generated-by: outer-pvl

Parallel strategy: sequential
Rationale: score 4/7 (S1 multi-package, S2 API/quota semantics, S6 high-risk billing/secrets/deploy, S7 5+ files). Milestones M1-M5 share one blast radius in `apps/worker` and depend on each other in order, so EXECUTE runs one opus vc-execute-agent per milestone, one after another, with a sonnet vc-tester EVL run after each milestone. Validation itself ran sequentially in one session (no subagent tool was available); all 4 dimensions and 5 milestone sections were checked against the real files.

Net gate derivation: Layer 1 = 4 PASS; Layer 2 = 5 PASS (after 17 plan fixes applied in this pass, listed below). Totals: 0 FAILs / 0 open CONCERNs / 9 PASSes -> Gate PASS.

Plan updates applied in this pass (all inside this file):
- P1 Data Flow + 1.4/1.4a/1.4b: `invalid` provider refuses right after config (before the cache read); cache key model = `provider.modelFor(kind)` (it was hard-wired to the OpenRouter model, so OpenAI could have served cached OpenRouter answers); provider-aware missing-key check.
- P2 1.1a + Blast Radius: missing `AI_PROVIDER` = invalid kept (SPEC AC1); `loadConfig` never throws for it; env fixtures that bypass `baseEnv` (`budget-probe.ts`, `ai-fail-closed-without-secrets.test.ts`) get `AI_PROVIDER:'openrouter'` only. The old claim "608 tests unmodified" was impossible with missing = invalid.
- P3 AC14 made concrete: `proxy.spend` log line (total/cap) on every settle and refusal, documented read-only D1 queries, new test `spend-operator-log`; visitor JSON unchanged.
- P4 2.1 purge path corrected to `apps/worker/src/memory/repo/purge.ts:47`; SpendPort SQL spelled out (RETURNING count, overrun claim with no cap).
- P5 2.4 settle table: pre-dispatch abort row; ledger `cost_usd` from settled cost (AC19 needs a non-zero ledger row).
- P6 3.2 worst case also counts `response_format` bytes and per-message overhead (structured-output schemas are billed as input).
- P7 3.5 OCR wire schema: `v` as enum (the core schema emits `const`), all properties required.
- P8 Logger secret list adds `openaiApiKey` (`routes/proxy/index.ts:34`); `secret-non-leak` checks log lines too.
- P9 4.1/4.3 web OCR: `ocrKeyParts` gets a model parameter so the precomputed #9 lookup and the Dexie cache use different keys; `ocr-never-sends-pdf` that pins the model is a WEB test (gate added under `@aduin/web`).
- P10 4.2 precompute: keep the `OCR_MODEL` alias export (scripts `ocr-live-guard` and `record-ocr.ts` import it); gate `ocr-live-guard` added.
- P11 4.4 banner: today `budget_cap` shows "AI budget for today", resume midnight (wrong for a lifetime cap); new `spend_limit` banner, `provider_balance` -> `ai_unavailable`; OCR gets `OCR_UNAVAILABLE_SPEND`.
- P12 4.5 secrets regex made concrete with a left boundary (a naive `sk-...{20,}` hits words like `risk-evidence-pack-validator`); fixtures built at runtime.
- P13 4.7 direct probe pins its host in-script and uses the live ledger; the vague `scripts/src/guards/*` allow-list row was removed (no guard edit needed).
- P14 4.7a AC17 bundle proof: `no-e2e-hook-in-dist` gains a key-pattern assertion, `deploy:preflight` gains a key check, `slice.spec.ts` also blocks `api.openai.com`. Before, nothing actually scanned the bundle for keys.
- P15 5.2 deploy recipe fixed (`pnpm deploy:preflight` does not exist at the root; the build needs the inline site key).
- P16 5.4 re-run the full worker suite after flipping `wrangler.jsonc` (the vitest pool reads its vars).
- P17 Verification table: tokens checked against real files and scripts; docs grep split per file; new gates `spend-operator-log`, `proxy-budget`, `spend-cap-enforced`, web `ocr-never-sends-pdf`, `ocr-live-guard`, `deploy-preflight`, full web unit + preview e2e.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1, AC3 | provider select; invalid/missing fails closed, no throw; cache isolation | Fully-Automated | `pnpm --filter @aduin/worker test provider-switch-matrix` | B |
| AC2 | OpenRouter body byte-identical | Fully-Automated | `pnpm --filter @aduin/worker test openrouter-body-byte-parity` | B |
| AC2 | OpenRouter free-only, budget, paid-fallback unchanged | Fully-Automated | `pnpm --filter @aduin/worker test free-only-config`; `... test proxy-budget`; `... test spend-cap-enforced`; full `pnpm --filter @aduin/worker test` | A |
| AC4 | OpenAI text request shape, schema keywords stripped | Fully-Automated | `pnpm --filter @aduin/worker test openai-request-shape` | B |
| AC4, AC5 | real OpenAI accepts text + OCR requests | Hybrid | M5.3 stage-1 direct probe (precondition: secret set, user-approved key load, at most 3 billed calls) | B |
| AC5 | OCR wire schema + null normalise | Fully-Automated | `pnpm --filter @aduin/worker test openai-ocr-normalise` | B |
| AC6 | same NDJSON frames | Fully-Automated | `pnpm --filter @aduin/worker test openai-e2e-ndjson-parity` | B |
| AC7 | cost = usage x price | Fully-Automated | `pnpm --filter @aduin/worker test openai-cost` | B |
| AC8 | lifetime counter, no reset, not purged | Fully-Automated | `pnpm --filter @aduin/worker test spend-lifetime-counter`; `... test cron-purge` | B |
| AC9 | reserve before dispatch, no overshoot | Fully-Automated | `pnpm --filter @aduin/worker test spend-cap-concurrency` | B |
| AC10, AC11 | settle matrix incl. missing usage | Fully-Automated | `pnpm --filter @aduin/worker test spend-reserve-settle-matrix` | B |
| AC12 | at cap: refusal, 0 upstream, claims refunded | Fully-Automated | `pnpm --filter @aduin/worker test spend-cap-refusal` | B |
| AC13 | UI shows spend-limit banner; findings keep working | Fully-Automated | `pnpm --filter @aduin/web test banner-spend-cap`; `pnpm --filter @aduin/web test:e2e ai-banners` | B |
| AC14 | operator-only spend visibility | Fully-Automated | `pnpm --filter @aduin/worker test quota-spend-global-ok`; `... test spend-operator-log`; docs grep | B |
| AC15 | OpenAI success never trips breaker | Fully-Automated | `pnpm --filter @aduin/worker test openai-served-breaker` | B |
| AC16 | quota/auth classified, body not echoed | Fully-Automated | `pnpm --filter @aduin/worker test openai-error-classify` | B |
| AC4 (security) | host pinned, other hosts refused | Fully-Automated | `pnpm --filter @aduin/worker test openai-host-pinned` | B |
| AC17, AC18 | no key in responses, logs, bundle, tree | Fully-Automated | `pnpm --filter @aduin/worker test secret-non-leak`; `pnpm --filter @aduin/scripts test secrets-scan`; `pnpm --filter @aduin/web test no-e2e-hook-in-d`; `pnpm --filter @aduin/scripts test deploy-preflight`; `pnpm secrets:scan` | B |
| AC18 | docs say text and scans go to OpenAI | Fully-Automated | `grep -c "sent to OpenAI" README.md`; `grep -c "sent to OpenAI" docs/DEPLOY.md` (each at least 1) | B |
| AC19 (guard part) | live scripts accept gpt-4.1-mini, still stop on others; probe ceiling | Fully-Automated | `pnpm --filter @aduin/scripts test live-guards`; `pnpm --filter @aduin/scripts test probe-openai-direct` | B |
| AC19 | one real AI + one real OCR via the Worker, ledger cost > 0, breaker clear | Agent-Probe | M5.5 operator probe (human Turnstile); if not run -> backlog stub `openai-stage2-probe_NOTE_19-10-26.md` | C |
| AC20 | OCR model/cache keys consistent; #9 precomputed still hits | Fully-Automated | `pnpm --filter @aduin/web test ocr-model-constants`; `... test ocr-never-sends-pdf`; `... test ocr-ai-consent`; `pnpm --filter @aduin/worker test llm-ocr-cache-hit`; `pnpm --filter @aduin/scripts test ocr-live-guard` | B |
| AC2, AC3 (live) | deployed Worker behaves (openrouter, then openai) | Hybrid | `SLICE_BASE_URL=https://preflight-legal-reviewer.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` (precondition: 5.2 / 5.4 deployed) | B |
| regression | whole repo green | Fully-Automated | `pnpm typecheck`; `pnpm lint`; `pnpm guard:cf`; `pnpm secrets:scan`; `pnpm --filter @aduin/core test`; `pnpm --filter @aduin/scripts test`; `pnpm --filter @aduin/web test`; `pnpm --filter @aduin/web test:e2e` (serial) | A |

gap-resolution legend: A proven now (existing gate) / B gate added by this plan's checklist / C deferred to a named later step (M5.5 operator) / D backlog stub.

Failing stubs (TDD red-first for the NEW test files; existing regression tests get none; not files on disk):

```
test("should route by AI_PROVIDER and fail closed on invalid or missing", () => { throw new Error("NOT IMPLEMENTED — TDD stub: provider-switch-matrix") })
test("should send a byte-identical OpenRouter body", () => { throw new Error("NOT IMPLEMENTED — TDD stub: openrouter-body-byte-parity") })
test("should keep the lifetime spend counter across midnight, purge and restart", () => { throw new Error("NOT IMPLEMENTED — TDD stub: spend-lifetime-counter") })
test("should settle every exit path per the settle table", () => { throw new Error("NOT IMPLEMENTED — TDD stub: spend-reserve-settle-matrix") })
test("should never let parallel calls push spend above the cap", () => { throw new Error("NOT IMPLEMENTED — TDD stub: spend-cap-concurrency") })
test("should refuse at the cap with zero upstream calls", () => { throw new Error("NOT IMPLEMENTED — TDD stub: spend-cap-refusal") })
test("should turn global_ok off near the cap and expose no spend to visitors", () => { throw new Error("NOT IMPLEMENTED — TDD stub: quota-spend-global-ok") })
test("should log one proxy.spend line with total and cap per settle", () => { throw new Error("NOT IMPLEMENTED — TDD stub: spend-operator-log") })
test("should build an OpenAI body without OpenRouter fields and with usage requested", () => { throw new Error("NOT IMPLEMENTED — TDD stub: openai-request-shape") })
test("should normalise OCR nulls and validate with OcrResultSchema", () => { throw new Error("NOT IMPLEMENTED — TDD stub: openai-ocr-normalise") })
test("should stream the same NDJSON frames as the OpenRouter path", () => { throw new Error("NOT IMPLEMENTED — TDD stub: openai-e2e-ndjson-parity") })
test("should compute exact micro-USD from token usage", () => { throw new Error("NOT IMPLEMENTED — TDD stub: openai-cost") })
test("should not trip the breaker on a dated gpt-4.1-mini id", () => { throw new Error("NOT IMPLEMENTED — TDD stub: openai-served-breaker") })
test("should classify insufficient_quota, 401, 403 and rate 429 without echoing bodies", () => { throw new Error("NOT IMPLEMENTED — TDD stub: openai-error-classify") })
test("should refuse any host other than api.openai.com", () => { throw new Error("NOT IMPLEMENTED — TDD stub: openai-host-pinned") })
test("should key live OCR on gpt-4.1-mini and precomputed on the old id", () => { throw new Error("NOT IMPLEMENTED — TDD stub: ocr-model-constants") })
test("should show the spend_limit banner and OCR spend reason at the cap", () => { throw new Error("NOT IMPLEMENTED — TDD stub: banner-spend-cap") })
test("should probe OpenAI directly with a 3-call ceiling and a pinned host", () => { throw new Error("NOT IMPLEMENTED — TDD stub: probe-openai-direct") })
```

Legacy line form:
- worker provider seam: Fully-automated: `pnpm --filter @aduin/worker test provider-switch-matrix` | `... test openrouter-body-byte-parity` | full `pnpm --filter @aduin/worker test`
- worker spend: Fully-automated: `spend-lifetime-counter`, `spend-reserve-settle-matrix`, `spend-cap-concurrency`, `spend-cap-refusal`, `quota-spend-global-ok`, `spend-operator-log`, `cron-purge`
- worker OpenAI: Fully-automated: `openai-request-shape`, `openai-ocr-normalise`, `openai-e2e-ndjson-parity`, `openai-cost`, `openai-served-breaker`, `openai-error-classify`, `openai-host-pinned`, `secret-non-leak`
- web: Fully-automated: `ocr-model-constants`, `ocr-never-sends-pdf`, `ocr-ai-consent`, `banner-spend-cap`, `no-e2e-hook-in-d`, `test:e2e ai-banners`
- scripts: Fully-automated: `secrets-scan`, `live-guards`, `probe-openai-direct`, `ocr-live-guard`, `deploy-preflight`
- live: hybrid: M5.3 direct probe (secret + approved key load); stack run after 5.2/5.4 (deployed) | agent-probe: M5.5 operator probe (human Turnstile)

Dimension findings:
- Infra fit: PASS — fits the existing proxy pipeline, D1 `quota_counter` (scope `spend`, window `all`, already skipped by purge) and the Free-plan write budget (+2 writes per OpenAI call); deploy recipe and cache-key gaps fixed in plan.
- Test coverage: PASS — every gate token checked against real files and `package.json` scripts, one token per call, no `--`; wrong package for the model-pinning `ocr-never-sends-pdf` fixed; AC14 and AC17 now have real gates.
- Breaking changes: PASS — HTTP/NDJSON shapes unchanged; new `reason` strings only; OpenRouter body byte-parity test; no D1 migration (schema stays 6); only test env fixtures gain `AI_PROVIDER`.
- Security surface: PASS — host pinned with no env override; key in a Worker secret only, scrubbed from logs (fixed), never echoed; bundle, preflight and tree scans; bounded secrets regex; spend cap fails closed. High-risk evidence pack required at M5.
- M1 provider seam: PASS — edit targets present (`config.ts`, `pipeline.ts` `callWithFallback`/`once`/cache-key line); highest-risk edit = pipeline refactor, mitigated by byte parity + full suite.
- M2 spend: PASS — `QUOTA_SQL.claim` is atomic and returns `count`; `withSessionCaps` already allows kind `spend`; highest risk = a missed settle on an exit path, mitigated by a single settle point + matrix test.
- M3 OpenAI module: PASS — core text schemas already list every property as required with `additionalProperties:false` (checked by generating them); only length/range keywords need stripping; live acceptance proven at M5.3 before the flip (reversible).
- M4 web/scripts: PASS — `OCR_MODEL` is used in 1 web key function and 3 scripts imports; banner key consumers are `ai-lane.ts` and `AiSummary.tsx`.
- M5 rollout: PASS — 5.2-5.5 are explicit HARD STOPs that return to the orchestrator; rollback = flip the var or `wrangler rollback` within `preflight-legal-reviewer` versions (schema 6 compatible).

Execute-agent instructions:
- E1 Every M5 step 5.2, 5.3, 5.4, 5.5 is a HARD STOP: stop and return to the orchestrator. Never deploy, run `wrangler secret put`, load the OpenAI credentials file, run a billed probe, or `git push` yourself.
- E2 Before M1 code: grep `apps/worker/test` for `OPENROUTER_API_KEY` and `loadConfig(` and add `AI_PROVIDER:'openrouter'` to every env literal that reaches `/api/ai` or `/api/ocr` without `baseEnv`. Do not change any assertion. If a pre-existing test still fails, stop and report.
- E3 Run gates one token per call, never `test -- <token>`; run web e2e serially (never with another agent or the `stack` project). No `git stash`, `git checkout`, `git reset`.
- E4 Step 4.0 price check: confirm `gpt-4.1-mini` at $0.40 / $1.60 per 1M tokens (input/output) on OpenAI's pricing page (read-only); update the constant and its dated comment. If you cannot confirm it, keep `UNVERIFIED` and report it; 5.3 re-checks against real usage.
- E5 Keep `OCR_MODEL` exported in `scripts/src/precompute/precompute-ocr.ts` (alias) and keep the scripts free-only guard unchanged.
- E6 Test fixtures with key-shaped strings must build them at runtime (`[...].join('-')`), never as literals.
- E7 Run `vc-risk-evidence-pack` (billing + secrets + deploy) before reporting M5 complete.

What This Coverage Does NOT Prove:
- Worker stub tests (M1-M3) do not prove that real OpenAI accepts the transformed schemas, the vision input or `max_completion_tokens`; only M5.3 does, and only for clause-judgment, counsel-draft and one OCR page (drift-narrative relies on the same schema pattern, not a live call).
- `spend-cap-concurrency` runs in one workerd isolate; it proves the reserve-before-dispatch order and the guarded SQL, not cross-colo D1 contention under real load.
- The price constant is only as correct as the 4.0 check; a later OpenAI price change is not detected automatically.
- The secrets scan covers only in-scope tracked paths (scripts/, apps/*/src, configs); keys pasted into `process/` or `docs/` are excluded by design.
- The `stack` live run does not exercise a fresh AI or OCR call (that needs a human Turnstile token); AC19 rests on the M5.5 operator probe.
- Nothing proves the combined OpenRouter + OpenAI spend (separate counters) or the counter after a D1 Time Travel restore (documented known gaps).

Open gaps: none in plan. Named residuals (not counted as CONCERNs): combined-provider cap, Time Travel counter rollback, build-time web OCR cache key after a flip back, worst case kept on OpenAI 429. AC19 depends on the operator running M5.5; if it is not run, EXECUTE writes `process/general-plans/backlog/openai-stage2-probe_NOTE_19-10-26.md` and the closeout records it.
Gate: PASS
Accepted by: n/a (Gate PASS, no concerns accepted; user asked for the automatic path, 19-10-26)

## Autonomous Goal Block

```
SESSION GOAL: OpenAI gpt-4.1-mini as a config-selected AI/OCR provider with a $10 lifetime spend cap (EXECUTE M1-M5)
Charter + umbrella plan: N/A — single plan
Plan: process/general-plans/active/openai-provider_19-10-26/openai-provider_PLAN_19-10-26.md (SPEC in same folder)
Autonomy: self-decide reversible steps per feedback_autonomous_phase_execution.md; opus for EXECUTE, sonnet for vc-tester EVL; one milestone at a time, commit on main per milestone.
Hard stop conditions / safety constraints:
- Stop and return to the orchestrator at M5.2 (deploy), M5.3 (secret put + billed direct probe), M5.4 (flip AI_PROVIDER + deploy), M5.5 (operator probe with human Turnstile).
- Never read or print the OpenAI credentials file or any key; key only via wrangler secret put.
- Never touch zone itsjiathao.com; workers.dev only; deploy from main; no git push without user OK.
- Billed OpenAI calls total at most 15 (planned 6); the spend cap fails closed.
- No git stash / checkout / reset; one test token per call, no "--".
Next phase: EXECUTE: process/general-plans/active/openai-provider_19-10-26/openai-provider_PLAN_19-10-26.md (start M1)
Validate contract: inline in plan (Gate: PASS, outer-pvl, 2026-10-19)
Execute start: pnpm --filter @aduin/worker test provider-switch-matrix | pnpm --filter @aduin/worker test openrouter-body-byte-parity | pnpm --filter @aduin/worker test | then M2-M4 tokens from the Test gates table | e2e: pnpm --filter @aduin/web test:e2e ai-banners | probe: M5.5 operator | high-risk pack: yes
```

## Resume and Execution Handoff

- Primary execute anchor: this file. Supporting: SPEC in the same folder.
- Resume: read `## Phase Loop Progress`; the first unticked milestone is next. Each milestone ends with its own commit on `main`.
- EXECUTE (opus) must stop at every M5 HARD STOP and return to the orchestrator; billed calls total ≤15 (planned 6), < $0.10.
- Do not edit `CLAUDE.md`; the proposed credentials row (`~/.config/openai/credentials.env`, `OPENAI_API_KEY`, `POST https://api.openai.com/v1/chat/completions`) goes in the closeout as a suggestion.
- High-risk evidence: run `vc-risk-evidence-pack` (billing + secrets + deploy) before M5 closure.
- Next Step: ENTER EXECUTE MODE (validate-contract Gate: PASS, 19-10-26).
