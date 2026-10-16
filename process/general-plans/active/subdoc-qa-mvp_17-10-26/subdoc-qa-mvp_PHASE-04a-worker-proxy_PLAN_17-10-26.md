---
name: plan:subdoc-qa-mvp-phase-04a-worker-proxy
description: "Sub-doc QA MVP — Phase 04a: thin Cloudflare Worker (Free): static assets, AI/OCR hold-open proxy, quotas and spend cap over ports, Turnstile, abuse protection; closes the worker half of Milestone 1 (full M1 slice deferred until Phase 03 is verified)"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-04a
---

# Phase 04a — Worker Proxy, Limits, Turnstile, Abuse Protection

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: 🚧 EXECUTED (04a-WORKER gates green; review pending; M1 deferred)
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** 🚧 EXECUTE done, awaiting EVL + independent review
**Milestone:** M1 vertical slice (00 → 01 → 03 → 04a): 04a-WORKER closes the worker half; M1 SLICE CLOSURE is deferred until Phase 03 is VERIFIED against `app.html` (umbrella `## Execution Holds`)
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04a-worker-proxy_REPORT_17-10-26.md

---

## Overview

The Worker (Free plan) never parses documents. This phase builds the HTTP and policy layer on top of **ports** (interfaces from Phase 01 contracts): static assets serving, `POST /api/ai` and `POST /api/ocr` hold-open streaming proxies to OpenRouter, `GET /api/quota`, a cache-first lookup, spend ledger and cap logic, per-visitor and global limits, Turnstile on the first AI call, request guards (size, type, rate, Origin/CSRF), and fail-closed behavior. SQL lives in Phase 04b (`apps/worker/src/platform/*`); here the ports are implemented by an in-memory fake for tests, then integrated for real in Phase 05. It also owns `pnpm slice:check` (Milestone 1) with two modes: `--worker-only` (04a closure, no web) and full (deferred until Phase 03 is VERIFIED). Context routers: `process/context/all-context.md`, `process/context/tests/all-tests.md`; credentials rules in `CLAUDE.md` Project Rules.

## Phase Completion Rules

- CODE DONE = routes and tests committed.
- Closure is split because Phase 03 is HELD (umbrella `## Execution Holds`, pending `app.html` approval):
  - (a) **04a-WORKER VERIFIED** = all 11 worker gates + `pnpm --filter @aduin/core test:golden` + `pnpm guard:cf && pnpm secrets:scan` + `pnpm slice:check --worker-only` + risk pack (validator + APPROVE), validate-contract written, spikes S1/S2/S6 verdicts applied (or fallback adopted). Runnable with Phase 03 held (needs only Phase 00 + Phase 01).
  - (b) **M1 SLICE CLOSURE** = full `pnpm slice:check` + `pnpm --filter @aduin/web test:e2e`; recorded in the report as `deferred: depends on Phase 03`; closed by the first run after Phase 03 is VERIFIED against `app.html`. Never faked or stubbed green.
- Any remote deploy (first deploy to `*.workers.dev`) is allowed unattended per the user's confirmed policy, but only: `aduin-transaction-*` resources, default `workers.dev` URL, secrets via `wrangler secret put`, never zone `itsjiathao.com`, no custom domain or route (hard stop). Phase 04a itself needs no remote deploy: all gates run locally.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC26 | Quota/budget exhaustion survivable: 429/402/timeout/malformed → fallback, no lost work; cumulative spend tracked; refuse paid calls at the cap | `llm-failure-injection-matrix` (429, 402, timeout, malformed) + `spend-cap-enforced` + `free-only-config` + `stream-holdopen` + `secret-non-leak` | Fully-Automated | banner UI closes P05 |
| AC27 | AI/OCR results cached; same input+model+prompt+rules hash never re-calls; cache key includes rules hash | `llm-ocr-cache-hit` (here: cache key derivation + zero-claim/zero-write hit path over the cache port) | Fully-Automated | `cache-invalidated-by-firm-rules-change` closes P05 |
| AC32 | Per-visitor AI run limit (default 3 documents/day) with downgrade message and deterministic results intact | `per-visitor-ai-limit-e2e` (server level here: exceed → HTTP via `errorStatus('quota_exhausted')` with `error.reason = visitor_limit`) | Fully-Automated | UI message closes P05 |
| AC33 | Global daily cap = lesser of configured cap and provider allowance; ≤ ~$10 spend; remaining allowance exposed | `global-daily-cap-and-budget` (simulated counters at/below/above caps; UTC midnight reset; AI requests and OCR pages share one provider counter) | Fully-Automated | UI display closes P05 |
| AC39 | Abuse protection: rate limit, oversize/malformed rejection, no AI call without passing AC32/33, no code execution or internal fetch from uploads | `abuse-protection-matrix` (burst, oversize body, malformed JSON, wrong type, forged cookie, cookie minting, spoofed XFF, client model/plugins/provider/tools, non-data image URL, Origin/CSRF, hostile payload text) | Fully-Automated | client hostile-HTML in P03; deployed in P10 |

## Entry Gate

- Phase 01 exit gate passed (contracts, ports, cookie helper); Phase 03 is NOT required (held; disjoint).
- S1, S2, S6 verdicts available from Phase 00 (or their pre-adopted fallbacks).
- Entry Gate check: `packages/core/src/contracts/claims.ts` exposes `SessionClaims` with `v` (required) and `t?` (epoch ms), `resign(claims, patch)` exists, and `cacheKey()`, `contracts/frames.ts` (`parseFrameLine`) and `errorStatus` are exported from `@aduin/core`, and the shared error schema (frame and HTTP body) carries optional `reason?` (frozen on the frame by Phase 01 Contracts v1; if the HTTP body schema in `contracts/errors.ts` lacks it, add it as an optional field under the same additive-only rule, never a local fork). If `t` is absent, STOP: treat it as a Phase 01 contract gap and apply Phase 01's additive-only rule (new field optional, no removal/retyping, no `v` bump); never fork a local claims type.

## Library pins (confirm via vc-docs-seeker in Phase 00)

wrangler (invoked as `pnpm exec wrangler`), the Workers test runner as decided by Phase 00 A1 (`fetchMock` is NOT exported by `@cloudflare/vitest-pool-workers` 0.23.0, and that package is deprecated in favor of `@cloudflare/vitest-plugin`; this phase does not depend on either for outbound stubbing: the OpenRouter and Turnstile stubs are injected `fetch` via `createApp(deps)`), Turnstile server verify endpoint and test keys, OpenRouter chat-completions and `models:[]` fallback semantics. No web framework.

## Touchpoints (create)

```
apps/worker/src/
  routes/proxy/{index.ts (fills mountProxyRoutes stubs only; Phase 00 B4 pre-wires mountProxyRoutes/mountMemoryRoutes in createApp),ai.ts,ocr.ts,quota.ts}
  proxy/{guards.ts (method, Origin, custom header, content-type, size caps, field whitelist/shaping), pipeline.ts, stream.ts (NDJSON heartbeat), errors.ts, log.ts (redactor; reused by Phase 04b)}
  upstream/{openrouter.ts (validated https base URL, model allowlist, models:[] free-only), classify.ts (429/402/timeout/malformed), models-config.ts (AI_TEXT_MODELS, AI_VISION_MODELS)}
  limits/{visitor.ts (identity from cf-connecting-ip only + signed visitor cookie), prelimit.ts (cheap in-isolate limiter), policy.ts (visitor + global + spend claims), clock.ts}
  identity/turnstile.ts (real TurnstilePort impl)
  config.ts (env typing + defaults in code, see Config below)
apps/worker/test/proxy/*.test.ts    gate files, exact names pinned in Test Gates
apps/worker/test/fakes/{platform.ts (in-memory Quota/Cache/Ledger/Rules ports; also used by P05), openrouter-stub.ts (shared OpenRouterStub reused by P05/P06), turnstile-stub.ts}
scripts/src/slice-check.ts          OWNED HERE: orchestrates M1 slice check; replaces Phase 00's `slice-check-stub.ts` (delete it) and repoints the single `slice:check` key in `scripts/package.json` (serialized seam edit); `--worker-only` forwards through root -> scripts (probed)
apps/web/e2e/slice.spec.ts          OWNED HERE (orchestrator decision, umbrella Pre-PVL Conflict Resolution); authoring DEFERRED until Phase 03 is re-targeted to `app.html` and publishes its `data-testid`s (selectors use only those); created after P03 is verified; P03 proves real findings via its own finding-highlight spec
process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/   risk evidence pack (Step F)
```
Seam edits (single keys/lines, serialized by the orchestrator): `apps/worker/src/app.ts` adds optional port/config fields to `AppDeps` (additive: Phase 00's `createApp({fetch, now})` callers keep compiling) and wires the real `TurnstilePort`, with a matching one-line wiring in `apps/worker/src/index.ts` (mount calls already pre-wired by Phase 00 B4); `apps/worker/wrangler.jsonc` proxy vars only (this phase owns proxy vars: `OPENROUTER_BASE_URL`, `AI_TEXT_MODELS`, `AI_VISION_MODELS`, `AI_UPLOADS_ENABLED`, `PAID_FALLBACK_ENABLED`, caps, `TURNSTILE_SITE_KEY`), one key per edit, serialized.

Config (`config.ts`, defaults in code; test bindings injected via `createApp(deps)`/env, never from `wrangler.jsonc` in tests): `OPENROUTER_API_KEY` (secret), `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`; must be https and host exactly `openrouter.ai`, else startup fails closed), `AI_TEXT_MODELS`, `AI_VISION_MODELS` (comma lists), `AI_UPLOADS_ENABLED` (default per S1), `PAID_FALLBACK_ENABLED` (default false; true only on the exact string `"true"`), paid model list (default empty), caps (`VISITOR_AI_DOCS_PER_DAY`=3, `VISITOR_AI_REQS_PER_DAY`=8, `VISITOR_OCR_PAGES_PER_DAY`=6, `GLOBAL_PROVIDER_REQS_PER_DAY`=35, `SPEND_CAP_MICRO_USD`), `COOKIE_SIGNING_KEYS` (JSON kid->key map; Phase 01 verify takes the map) plus `COOKIE_SIGNING_KID` (the kid used to sign new cookies; must exist in the map, else fail closed), `VISITOR_COOKIE_TTL_S` (cookie `exp` = `iat` + this; default 86400), `TURNSTILE_PASS_TTL_MS` (default 1800000), `TURNSTILE_SECRET`, `TURNSTILE_SITE_KEY`. Free-only validation: reject any model id not ending in `:free` and any `openrouter/*` router id (config load throws; tests assert).

## Public Contracts

- `POST /api/ai`, `POST /api/ocr`, `GET /api/quota` shapes exactly as `contracts/ai.ts`, `ocr.ts`, `quota.ts` (Phase 01 Contracts v1). Streaming responses are NDJSON built from the `contracts/frames.ts` shapes: `{t:'hb'}` every 10 s, then exactly one terminal `{t:'result',kind,data,cache,model,meta?}` or `{t:'error',code,message,retry_after_s?}`. Pre-stream rejections (guards, Turnstile, auth, and quota/policy refusals at the claim step, which happen before the first heartbeat) return HTTP via `errorStatus(code)` from `@aduin/core` with body `{error:{code,message,reason?,retry_after_s?}}`. `reason` is the optional additive string frozen by Phase 01 Contracts v1 on the error frame/body; for quota refusals it is one of `visitor_limit`, `global_cap`, `spend_cap`, `ocr_pages_limit` and is asserted by `per-visitor-ai-limit-e2e` (and `global-daily-cap-and-budget`, `spend-cap-enforced` for their tokens). Failures after the stream opens (timeout, upstream error) are terminal `error` frames carrying the same fields `{t:'error',code,message,reason?,retry_after_s?}`. `GET /api/quota` returns `{ai:{used,limit,resets_at}, ocr_pages:{used,limit,resets_at}, global_ok}`. The client can resume by re-requesting: the cache key makes the retry a hit.
- The Worker derives the cache key from the payload it actually forwards (hash of final messages), never from client-claimed hashes. Key = the imported `cacheKey({kind,input_hash,model,prompt_ver,schema_ver,rules_hash})` from `@aduin/core` (never re-implemented; components containing `|` are rejected); `rules_hash='none'` until Phase 05 wires the `RulesPort`. Tests assert hit/miss keys against `fixtures/cache-key-vectors.json`.
- Units are claimed only after a cache miss and Turnstile pass, before the upstream call, and refunded on upstream failure.
- Model lists come from env; free ids only (every outbound `model` and every `models[]` entry ends with `:free`; `openrouter/*` router ids rejected); paid ids never mixed in; the paid path exists but is disabled (`PAID_FALLBACK_ENABLED` enabled only on exact `"true"`, paid list empty by default) and refuses without credits and without being under the $10 cap. OpenRouter performs model fallback itself via `models[]`; the Worker sends one request and only classifies the final result (no Worker-side next-model loop). Optional provider `max_price` 0 is set only if vc-docs-seeker confirms it in Phase 00 docs; otherwise omitted.
- Upstream timeout 120 s (greater than the observed 88 s worst case). On timeout or client disconnect the upstream is aborted and claimed units are refunded (refund-on-abort), the ledger records no cost.
- Ledger records the serving model and `usage.cost`. A non-zero cost while paid is disabled trips a circuit breaker: further AI/OCR requests return the degrade code until the next UTC day or config change.
- Open-proxy shaping: the whitelist is aligned to the frozen envelope. AI: `v`, `law_firm_id`, `candidates` (id, quote, section_path, issue_class_hint), `settings.model_tier` (mapped to a server-side tier, never used as or forwarded as a model id; unknown tier -> default tier). OCR: `v`, `mime` (png/jpeg only), `pages` (index, data_b64). `ext` is dropped, never forwarded upstream; unknown top-level optional fields are ignored (additive-only rule), client hashes ignored for keying. `/api/ocr` with `mime: application/pdf` returns 415 `unsupported_type` (via `errorStatus`) before any cache read, Turnstile or claim. The server sets `model`, `models`, `plugins`, `provider`, `tools`, `max_tokens`, `temperature`, `response_format`. Any client-supplied model/plugins/provider/tools/max_tokens is rejected (400) or dropped and tested. Image parts are accepted only as `data:image/(png|jpeg|webp);base64,...`; any http(s) or other URL is rejected (no SSRF via provider).
- Identity: client IP is read from `cf-connecting-ip` only (never `x-forwarded-for`), hashed with a daily salt, IPv6 truncated to /64 before hashing. Per-visitor limits key on the cookie claim `v` (never `a`, never an unnamed cookie id) and on the IP hash, applying the stricter of the two, so cookie minting cannot bypass them; a cookie carrying `a` but a different `v` is keyed on its own `v` and gets no extra allowance; the global provider cap plus Turnstile is the documented backstop.
- Turnstile and cookie: frozen Phase 01 contract. The M1 visitor cookie is `{v, iat, exp, kid, t?}` (no `w`/`a`), issued by 04a on first `/api/*` call (`__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`), signed with `COOKIE_SIGNING_KID` from the `COOKIE_SIGNING_KEYS` map, `exp` = `iat` + `VISITOR_COOKIE_TTL_S`; verification accepts any kid in the map. `t` is epoch MILLISECONDS of the last successful siteverify; setting it uses `resign(claims, patch)`, which preserves all existing claims (`v`, `w`, `a`, `iat`, `exp`, `kid`). Freshness: a pass is valid iff `now - t <= TURNSTILE_PASS_TTL_MS`; a future `t` (`t > now`) is rejected as stale and forces a new siteverify. Token carrier: the Turnstile token is sent in an additive request header (`x-aduin-turnstile`), outside the JSON body, so the frozen AI/OCR envelope is unchanged. Missing token on a first call, failed siteverify, already-spent token or network error fails closed with `invalid_session` (`errorStatus` -> 401): no claim, no upstream call. Tests use documented dummy keys through the stub: `1x00000000000000000000AA` pass, `2x00000000000000000000AA` fail, `3x00000000000000000000AA` already-spent.
- `GET /api/quota` never writes (read-only port call; zero-write assertion lives in gate `global-daily-cap-and-budget`: fake-port write counter = 0 after the call). There is NO `/api/cache` route; the cache is internal (CachePort read inside the AI/OCR pipeline), so `routes/proxy/cache.ts` is dropped.
- Provider counter: AI requests and OCR pages share ONE provider counter (OpenRouter free allowance, 50/day assumed); each fallback attempt inside `models[]` is accounted as one request at claim time (assumption: stated conservatively, 1 claim per Worker request, documented in the report if OpenRouter bills attempts separately).
- Secret hygiene: key never appears in responses, headers or logs; upstream error bodies are never echoed (mapped to codes); all `/api/*` responses carry `cache-control: no-store`; no CORS headers are emitted; missing key fails closed (`quota_exhausted`-style degrade).
- PDFs are never accepted by `/api/ocr` (images only); no `file` content type and no `file-parser` plugin are ever emitted.
- Cache hits cause no D1 write (no `hits` update), no claim and no upstream call, even when all caps are exhausted.
- Fail-closed: if the platform ports are unreachable, AI/OCR return `quota_exhausted`/`memory_unavailable` style degrade responses and the client runs no-LLM.
- Defaults (locked, see umbrella): visitor 3 AI documents/day (≤ 8 requests/day) and ≤ 6 OCR pages/day; global 35 AI requests/UTC day (configurable; raise only after credits exist); rate limit 30 requests/min per visitor, 6/min for AI; bodies: AI ≤ 128 KB, OCR ≤ 700 KB, others ≤ 64 KB.

## Blast Radius

`apps/worker/src/{routes/proxy,proxy (incl. log.ts),upstream,limits,identity/turnstile.ts,config.ts}`, `apps/worker/test/{proxy,fakes}`, `scripts/src/slice-check.ts`, `apps/web/e2e/slice.spec.ts` (owned here), `process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/`, seam line in `apps/worker/src/app.ts` (TurnstilePort only), proxy vars in `apps/worker/wrangler.jsonc` (one-key serialized edits). `proxy/log.ts` is consumed by Phase 04b (redactor reuse). Disjoint from Phase 04b (`migrations`, `seed`, `platform`, `memory`, `routes/memory`) and Phase 03 (`apps/web/src`). Registry `## Phase 04a` (revision note appended 17-10-26).

## Data Flow

Browser -> `/api/ai` or `/api/ocr` (cookie + `x-aduin-client` + Origin):
1. guards (method, Origin, header, content-type, size, field whitelist/shaping, image-part check; no claim yet);
2. cheap in-isolate rate pre-limit (no D1, no Turnstile subrequest; Workers rate-limiting binding used instead only if vc-docs-seeker confirms it on Free);
3. identity (`cf-connecting-ip` hash, /64 for IPv6; cookie verify against the kid map and take `v`, or 04a-issued `__Host-` visitor cookie carrying a fresh `v`);
4. cache read via `CachePort` using the key derived from the forwarded payload: a HIT streams the stored result with zero claims, zero D1 writes, zero upstream calls, even when every cap is exhausted;
5. MISS: Turnstile (first AI call only; token from the `x-aduin-turnstile` header; a pass is stored as `t` (epoch ms) via `resign`; skipped when `now - t <= TURNSTILE_PASS_TTL_MS`; missing/failed -> `invalid_session`, fail closed);
6. policy claims (visitor keyed on `v`, stricter of `v` and IP hash, global shared provider counter, spend) via `QuotaPort`;
7. OpenRouter call (hold open, NDJSON heartbeat every 10 s, 120 s timeout, abort on client disconnect) -> classify/validate -> cache write -> ledger write (serving model, `usage.cost`) -> final line.
Failure at 5-7: refund claims, return degrade code. `GET /api/quota` is read-only.

## Failure Modes

429 (OpenRouter has already tried `models[]`; Worker classifies the final result, honors `Retry-After` only for the degrade message), 402 (negative balance: stop and switch client to no-LLM), timeout 120 s or client abort (abort upstream, refund, `upstream_failed`), malformed JSON (one repair attempt without a new paid call, else reject), ports down (fail-closed), oversize/forged/shaped-out input (reject before any claim), non-zero cost with paid disabled (circuit breaker), siteverify failure (fail closed), missing key (fail closed), waitUntil that throws (never used; stream unaffected).

## Adversarial Scenarios (feed Step F)

Key exfiltration via errors/logs; open-proxy abuse (client-chosen model/plugins/tools); cookie forgery; cap bypass by cookie minting; SSRF via image URL; paid-model injection via client fields; Origin/CSRF bypass.

## Implementation Checklist

### Step A - Guards, identity, shaping
- [x] A1. `proxy/guards.ts`: method allowlist, `Origin` equals own origin for mutating calls, `x-aduin-client: 1`, content-type allowlist, per-route size caps (on `content-length` and streamed read), field whitelist (reject client model/plugins/provider/tools/max_tokens), image parts only `data:image/(png|jpeg|webp);base64`.
- [x] A2. `limits/visitor.ts` + `limits/prelimit.ts`: identity from `cf-connecting-ip` only, /64 hashing for IPv6, daily salt; visitor key = stricter of cookie `v` and IP hash (never `a`); cheap in-isolate pre-limit (30/min, 6/min AI) before Turnstile and D1; 04a issues `__Host-` signed visitor cookie `{v, iat, exp, kid}` when none, signed with `COOKIE_SIGNING_KID` from `COOKIE_SIGNING_KEYS`.
- [x] A3. `proxy/log.ts`: redactor (authorization, x-api-key, bodies, key value) reused by 04b; all logging goes through it.
- [x] A4. Tests: `abuse-protection-matrix` rows: burst, oversize, malformed JSON, wrong type, missing header, forged cookie, cookie with `a` but a different `v` (limits follow `v`), cookie with expired `t` (re-verifies Turnstile) and future `t` (rejected), spoofed `x-forwarded-for`, cookie-minting bypass, client `ext` (dropped), `application/pdf` on `/api/ocr` (415 before any claim), client model/plugins/provider/tools, non-data image URL, Origin/CSRF bypass, hostile text.

### Step B - Policy and ports
- [x] B1. `limits/policy.ts`: ordered claims (visitor -> global shared provider counter -> spend) with refund, run only after cache miss and Turnstile; UTC-day windows via `clock.ts`; `global-daily-cap-and-budget` at/below/above caps, UTC midnight, OCR pages and AI requests sharing one counter, fallback-attempt accounting assumption.
- [x] B2. `test/fakes/platform.ts` (claim succeeds iff count+units <= cap, same semantics as future SQL).
- [x] B3. Spend: micro-USD ledger with serving model + `usage.cost`; reserve estimated max cost before a paid call; paid path gated by exact-`"true"` flag and cap; circuit breaker on non-zero cost while paid disabled (`spend-cap-enforced`).

### Step C - Upstream and streaming
- [x] C1. `upstream/openrouter.ts`: base URL validated https + host `openrouter.ai`; injected `fetch`; allowlisted models; `temperature: 0`; `models:[free ids]`; strict `json_schema`; `max_tokens` server-set (6000 text, 8000 vision JSON, confirm S3); optional provider `max_price` 0 only if docs confirm.
- [x] C2. `config.ts` free-only validation + `upstream/classify.ts`; tests `free-only-config` (every outbound `model`/`models[]` ends `:free`, router ids rejected, flag only on `"true"`) and `llm-failure-injection-matrix` (429, 402, timeout, malformed) via the shared `OpenRouterStub` injected through `createApp(deps)`; "net-connect disabled" is a test-setup guard (`apps/worker/test/setup.ts`, registered by one `setupFiles` key in `apps/worker/vitest.config.ts`, a serialized seam edit of a Phase 00 file) that replaces `globalThis.fetch` with a stub that throws, so any unmocked outbound call fails the test.
- [x] C3. `proxy/stream.ts`: NDJSON hold-open using the `contracts/frames.ts` shapes (every emitted line is validated with `parseFrameLine`), heartbeat every 10 s, exactly one terminal line, upstream abort on disconnect, refund on abort, never `waitUntil`; test `stream-holdopen` with fake clock (including a `waitUntil` that throws).

### Step D - Routes
- [x] D1. `routes/proxy/ai.ts`, `ocr.ts`, `quota.ts` per contracts; `index.ts` fills the Phase 00 pre-wired `mountProxyRoutes` stubs (no `cache.ts`, no `/api/cache`).
- [x] D2. `identity/turnstile.ts`: siteverify, fail closed on failure/network error; verified once then `t` claim set by re-signing the cookie preserving claims; token read from the `x-aduin-turnstile` header; tests in gate file `turnstile-first-call` through `turnstile-stub.ts` (injected fetch) with dummy keys: rows pass, fail, already-spent, missing token, network-error, fresh-`t` (skips siteverify; `t` in ms, future `t` rejected); asserts `invalid_session` / `errorStatus` 401 with zero claims and zero upstream calls on every non-pass.
- [x] D3. Pipeline order per Data Flow: cache read BEFORE Turnstile and claims; `llm-ocr-cache-hit` asserts the key equals the imported `cacheKey()` output and matches `fixtures/cache-key-vectors.json`, hit streams with zero claims, zero D1 writes (fake port write counter = 0), zero upstream calls, even with exhausted caps.
- [x] D4. `secret-non-leak`: key never in responses/headers/logs, upstream error bodies not echoed, `cache-control: no-store`, no CORS headers, missing key fails closed. `proxy-budget`: <= 12 port calls per AI request. `per-visitor-ai-limit-e2e`: exceed -> HTTP via `errorStatus('quota_exhausted')` with body `{error:{code:'quota_exhausted',message,reason:'visitor_limit',retry_after_s?}}` (pre-stream, since the claim runs before the first heartbeat), keyed on `v`; reasons `global_cap`, `spend_cap`, `ocr_pages_limit` asserted in their gates; a failure after the stream opens is asserted as a terminal `error` frame with the same fields. `global-daily-cap-and-budget` also asserts `GET /api/quota` returns `{ai, ocr_pages, global_ok}` and performs zero port writes.

### Step E - Slice check (Milestone 1; split: worker-only now, full deferred)
- [x] E1. `scripts/src/slice-check.ts` + root `pnpm slice:check` (owned here; run under `pnpm exec tsx`), two modes. **`--worker-only`** (runs now, Phase 03 held; part of 04a-WORKER VERIFIED): start `pnpm exec wrangler dev --local` (never `--remote`; no real OpenRouter key present, fail-closed AI; web build NOT run; the configured assets directory does not exist while Phase 03 is held and `wrangler dev` errors on a missing assets directory (probed at VALIDATE, wrangler 4.151.1), so the script creates an empty temp directory, passes it as `--assets <tmpdir>` and removes it on teardown; `/api/health` answers 200 with it), `GET /api/quota` asserts 200 JSON `{ai, ocr_pages, global_ok}` (before Phase 04b the entry wires no D1 platform because `createD1Platform` is a NotImplemented stub: quota then returns 200 with `used` 0, the configured limits and `global_ok:false`, performs no writes, and AI/OCR fail closed; test fakes are never imported into `src`), `GET /api/health` asserts 200, run `pnpm guard:cf && pnpm secrets:scan` (this is what "run guards" means), assert no outbound openrouter.ai call, tear down the dev server on success and failure. **Full mode** (`pnpm slice:check`, deferred: depends on Phase 03): first `pnpm --filter @aduin/core test:golden`, build web, then the worker-only steps plus `pnpm exec playwright test` (`stack` project) on `apps/web/e2e/slice.spec.ts`.
- [ ] E2. (deferred: depends on Phase 03) `slice.spec.ts` (DEFERRED until Phase 03 is VERIFIED against `app.html` and publishes its `data-testid`s; use only those, no invented selectors): open sample #1 -> finding "this Section 11" listed; #3 -> swapped-reference findings; #11 -> undefined-term finding; no console errors; `/api/quota` reachable. Phase 03 separately proves real findings highlighted via its own finding-highlight spec; this spec proves the Worker stack. Not authored or run while Phase 03 is held; recorded `deferred: depends on Phase 03`.
- [ ] E3. (not elected in this run; orchestrator schedules M1 deploy after Phase 03) OPTIONAL M1 deploy (user-authorized, only if orchestrator elects; waits for Phase 03 per umbrella hold): `aduin-transaction-*` Worker and resources on default `*.workers.dev` only; no `routes`/`custom_domain`; never zone `itsjiathao.com`; secrets via `pnpm exec wrangler secret put <NAME>` with value piped from stdin (never argv/files); credentials file sourced only with the `# APPROVED:credentials.env` marker and never printed; run `pnpm guard:cf && pnpm secrets:scan` before and list account resources after to confirm the zone is untouched. Post-deploy smoke: sample opens, findings render, `GET /api/quota` responds 200 JSON, no key in any response/header. Anything outside these constraints is a hard stop.

### Step F - Risk evidence pack (vc-risk-evidence-pack; high-risk: secrets, trust boundary, public API/proxy, spend)
- [x] F1. Write in `process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/`: `risk-gate.json` (risk class secret/trust-boundary + public API/proxy, `mustStopBeforeFinalize: true`), `context-snippets.json` (file:line of guards, visitor identity, upstream, log redactor, config), `verification.json` (happy path + failure/boundary steps from the gates), `adversarial-validation.json` (the 7 scenarios above, each with ruled_out and rationale), `review-decision.json`.
- [ ] F2. (PENDING: independent automated reviewer, orchestrator-run) Review: run a read-only sonnet vc-security STRIDE pass and vc-code-reviewer on guards, identity, upstream, logging; record APPROVE or REJECT. Autopilot note: since the user is away, the review decision is made by this automated reviewer (sonnet vc-security / vc-code-reviewer); record that in `review-decision.json` `reviewer` and rationale.
- [ ] F3. (validator run: 1 expected failure = pending decision) Run `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs` over the harness dir; must pass. Auto-stop: not DONE until decision is APPROVE.

## Test Gates (commands created in this phase)

Test files live in `apps/worker/test/proxy/<name>.test.ts`; a token matching no file MUST fail the gate (vitest `No test files found`, exit 1; `passWithNoTests` is never set). Select tests with `pnpm --filter @aduin/worker test <token>`, ONE token per invocation (a multi-token call still passes when any one token matches, probed, so a missing file would go unnoticed; no `--`: under pnpm 11.13.1 a literal `--` runs the whole suite and ignores the token). Primary mechanism: fake `fetch` injected via `createApp(deps)`. "Net-connect disabled" means a test-setup guard that makes `globalThis.fetch` throw, so unmocked outbound requests fail (`fetchMock` is absent in pool-workers 0.23.0 and the package is deprecated in favor of `@cloudflare/vitest-plugin`; Phase 00 A1 decides the runner).

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| failure matrix | `pnpm --filter @aduin/worker test llm-failure-injection-matrix` | Fully-Automated | AC26 |
| spend cap | `pnpm --filter @aduin/worker test spend-cap-enforced` | Fully-Automated | AC26 |
| free-only-config | `pnpm --filter @aduin/worker test free-only-config` | Fully-Automated | AC26 |
| cache | `pnpm --filter @aduin/worker test llm-ocr-cache-hit` | Fully-Automated | AC27 (key + zero-write hit) |
| visitor limit | `pnpm --filter @aduin/worker test per-visitor-ai-limit-e2e` | Fully-Automated | AC32 |
| global cap | `pnpm --filter @aduin/worker test global-daily-cap-and-budget` | Fully-Automated | AC33 |
| abuse | `pnpm --filter @aduin/worker test abuse-protection-matrix` | Fully-Automated | AC39 |
| turnstile-first-call | `pnpm --filter @aduin/worker test turnstile-first-call` (pass, fail, already-spent, missing, network-error, fresh-`t`) | Fully-Automated | AC39 |
| secret-non-leak | `pnpm --filter @aduin/worker test secret-non-leak` | Fully-Automated | AC26/AC39 |
| stream-holdopen | `pnpm --filter @aduin/worker test stream-holdopen` | Fully-Automated | AC26 |
| query/CPU budget | `pnpm --filter @aduin/worker test proxy-budget` (<= 12 port calls per AI request) | Fully-Automated | AC40 interim |
| worker slice (04a-WORKER) | `pnpm slice:check --worker-only` | Fully-Automated | Worker stack boots locally (supports AC26, AC39; runs with Phase 03 held) |
| M1 slice (deferred: depends on Phase 03) | `pnpm slice:check` | Fully-Automated | Milestone 1 (supports AC3, AC4, AC11-AC13); first run after Phase 03 VERIFIED |
| risk pack | `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs` over `harness/` + APPROVE decision | Hybrid | high-risk evidence |
| remote CPU | S1/S2/S6 verdict applied | Agent-Probe | AC40 residual |
| regression (worker-standalone) | `pnpm --filter @aduin/core test:golden && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | earlier phases (Phase 01, Phase 00 guards) |
| regression (deferred: depends on Phase 03) | `pnpm --filter @aduin/web test:e2e` | Fully-Automated | Phase 03 web e2e; first run after Phase 03 VERIFIED |

Failing stubs for red-first: `should return quota_exhausted when the visitor exceeds the daily AI documents`, `should refuse a paid call at the spend cap`, `should refund claimed units when upstream fails`, `should reject a body over the cap before claiming quota`, `should serve a cache hit without calling upstream`, `should never emit a file content part or file-parser plugin`, `should send only :free model ids when paid fallback is disabled`, `should never include the api key in any response, header or log line`, `should hold the stream open with heartbeats and never call waitUntil`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `llm-failure-injection-matrix`, `spend-cap-enforced`, `free-only-config`, `stream-holdopen` | Fully-Automated | AC26 |
| `llm-ocr-cache-hit` (zero-write hit) | Fully-Automated | AC27 |
| `per-visitor-ai-limit-e2e` (server level) | Fully-Automated | AC32 |
| `global-daily-cap-and-budget` (shared provider counter) | Fully-Automated | AC33 |
| `abuse-protection-matrix`, `turnstile-first-call`, `secret-non-leak` | Fully-Automated | AC39 |
| `proxy-budget` | Fully-Automated | AC40 interim |
| `pnpm slice:check --worker-only` | Fully-Automated | Worker stack local boot, `/api/quota` + `/api/health`, no outbound openrouter.ai (AC26, AC39) |
| `pnpm slice:check` + `pnpm --filter @aduin/web test:e2e` (deferred: depends on Phase 03) | Fully-Automated | Milestone 1 (AC11, AC12, AC13 visible end to end); closes M1 SLICE CLOSURE |
| risk evidence pack + validator + APPROVE decision | Hybrid | high-risk evidence (secrets/trust boundary) |

```bash
pnpm --filter @aduin/worker test && pnpm slice:check --worker-only
# Expected: exit 0 (04a-WORKER VERIFIED set, Phase 03 held)
# Deferred, after Phase 03 VERIFIED: pnpm slice:check && pnpm --filter @aduin/web test:e2e
# Expected then: slice spec shows sample #1 finding highlighted through the local Worker stack
```

## Exit Gate

- 04a-WORKER VERIFIED: all worker gates + `pnpm --filter @aduin/core test:golden` + `pnpm slice:check --worker-only` + guards green; no secret or zone reference (`guard:cf`, `secrets:scan`); no live OpenRouter or Turnstile call made (injected fetch, throwing `globalThis.fetch` setup guard).
- Risk evidence pack present in `harness/` (5 JSON artifacts), `validate-risk-artifacts.mjs` passes, review decision APPROVE (automated reviewer under autopilot, recorded).
- M1 SLICE CLOSURE recorded in the report as `deferred: depends on Phase 03` (full `pnpm slice:check`, `slice.spec.ts`, `pnpm --filter @aduin/web test:e2e`); closed by the first run after Phase 03 is VERIFIED against `app.html`. Report lists AC proven so far, known gaps; optional M1 deploy smoke result if elected after the hold lifts.
- Phase report written.

## Risks and Kill Criteria

- S1 fail (hold-open cannot survive): keep the code path but default `AI_UPLOADS_ENABLED=false`; uploads run no-LLM; samples use precomputed results (Phase 05/10).
- S2 fail: shrink images / template body; OCR for visitors capped or off.
- Free-model 429 churn: model list configurable; no gemma-4 default.
- Worker script size (S6): avoid zod in the hot path if gz size > 1 MiB.

## Cost / Secret Hygiene

Tests use injected fetch only (no network; throwing global fetch guard). No live OpenRouter calls in this phase. Keys are read from `env` only, never logged (log helper redacts `authorization`, `x-api-key`, bodies). Free models only; paid path disabled by config and by default. PDFs never reach OpenRouter. No Cloudflare route or custom domain; zone `itsjiathao.com` untouched (`guard:cf`).

## Rollback

`git revert` phase commits; the stub `mountProxyRoutes` from Phase 00 returns. No data created (ports are fakes).

## Blockers That Would Justify BLOCKED Status

- Ports contract (Phase 01) cannot express a required operation or `SessionClaims.t` is missing (resolve per Phase 01's additive-only rule: new optional field only; removal, retyping or a `v` bump needs a contract-change note and re-freeze).
- Injected `fetch` via `createApp(deps)` cannot be wired through the Workers test runner chosen by Phase 00 A1 (`fetchMock` is absent in pool-workers 0.23.0; package deprecated in favor of `@cloudflare/vitest-plugin`); route to the Phase 00 REF. Plan impact: 04a, 06.

## Deviations

(EXECUTE 17-10-26, autopilot; all within the Phase 04a blast radius; none touch auth/billing schema, container lifecycle, secrets management or external integrations beyond the planned OpenRouter/Turnstile calls.)

- DV1 per-IP request counter dropped. What: AI claims are `req` on `v`, fresh-document `doc` on `v` AND ip hash (when new for `v`), then global. Why: with both `req|v` and `req|ip` the upstream-failure path was 13 port calls (1 read + 6 claims + 6 refunds) > the 12-call `proxy-budget`. Impact: cookie minting stays blocked (a minted cookie is a new `v`, so each request counts as a new document on the ip key, 3/day); residual: a holder of up to 3 valid cookies can make up to 8 requests each on already-counted documents per IP/day; backstops: global cap, Turnstile, 6/min pre-limit. Recorded for the reviewer.
- DV2 OCR refusal reason is `ocr_pages` (the frozen Phase 01 `QUOTA_REASONS` value), not `ocr_pages_limit` as written in this plan. Never fork the core contract.
- DV3 additive optional request header `x-aduin-doc` (hex 16-64) carries document identity for the D-4 3-documents/day count; absent -> the forwarded-payload hash is the document id. Outside the frozen JSON envelope (same pattern as `x-aduin-turnstile`). Phase 05 client should send it.
- DV4 spend-cap refusal uses code `budget_cap` (503) with reason `spend_cap`; circuit breaker uses `budget_cap` reason `circuit_breaker`; fail-closed degrades use `quota_exhausted` with reasons `ai_unavailable` / `ai_disabled`; a post-open upstream 429 is a terminal frame `upstream_failed` reason `provider_rate_limited` (+ `retry_after_s`), 402 is `budget_cap` reason `provider_balance`.
- DV5 `apps/worker/src/index.ts` not edited: `AppDeps` gains one optional `proxy?: ProxyDeps` field (additive) and `mountProxyRoutes` builds the real TurnstilePort from `deps.fetch` + `TURNSTILE_SECRET` when none is injected.
- DV6 Phase 00 `apps/worker/test/seams.test.ts`: the "mountProxyRoutes registers nothing" assertion now asserts exactly `POST /api/ai`, `POST /api/ocr`, `GET /api/quota` (consequence of filling the stub).
- DV7 Turnstile gates both `/api/ai` and `/api/ocr` on a cache miss (both spend the provider allowance).
- DV8 `TURNSTILE_SITE_KEY` not added to `wrangler.jsonc` (no real site key in this phase; widget is P03/P05). Vars added: `OPENROUTER_BASE_URL`, `AI_TEXT_MODELS`, `AI_VISION_MODELS`, `AI_UPLOADS_ENABLED` (S1 PASS -> true).
- DV9 paid max-cost reservation (`PAID_MAX_COST_MICRO_USD`, default 20000) is held on success (conservative; the frozen QuotaPort has no partial refund).
- DV10 (fix cycle 1, review F1; refined by quick fix reconciling AC26) refund policy split by cause. What: (a) pre-dispatch aborts and definite non-consuming upstream 4xx (400/401/403/413/415/422) refund ALL claims; (b) a client abort after dispatch keeps ALL claims (visitor `req`, `doc`/`seen`, global, spend); (c) provider-side failures after dispatch (timeout, network error, 5xx, 429, 402; flagged `providerFault` on the classified outcome) refund the visitor-scoped claims (`req`, `seen`, `doc` v+ip, OCR pages v+ip, via scope-tagged `Claims.refundVisitorScoped()`) but KEEP the global counter and any spend reservation; (d) malformed/schema-invalid output and 200-with-error bodies keep ALL claims, because a visitor can induce them via prompt injection (review F11). Invariant: global is always claimed last in `claimAi`/`claimOcr` (review F12). A paid call that did not consume releases only its own spend reservation (`Claims.mark()`/`refundFrom()`). Why: refund-on-abort let a client disconnect after dispatch to keep counters flat while the provider counted the request; but a user must not lose their 3-docs/day allowance (D-4) to provider failures. Impact: AC26 "units refunded on failure" is satisfied for visitor-facing units; global/spend counters intentionally track possible provider use.
- DV11 (fix cycle 1, review F2) circuit breaker judgement and port. What: trips on `usage.cost > 0`, or a parseable served id that is neither a `:free` variant nor (suffix-normalised) a configured free model; a missing/unparseable id with cost 0 does not trip and logs `proxy.served_model_unknown`. State moved behind `BreakerPort` (`src/proxy/ports.ts`; default `memoryBreaker()` per isolate; optional `ProxyDeps.breaker`); a `tripped()` port error fails closed. The breaker is still per-isolate in 04a.
- DV12 (fix cycle 1, review F3/F6) order is header-only guards -> pre-limit -> body read/parse/validate; OpenRouter fetch uses `redirect: 'error'`; Turnstile siteverify has a 5 s `AbortSignal.timeout` and fails closed.

### Phase 04b contract notes (fix cycle 1; the 04b plan itself is not edited here)

- F4: `x-aduin-doc` is client-attested. A constant value collapses the 3-documents/day D-4 limit to the 8 requests/day ceiling on `v` (still bounded by the ip doc counter for new cookies, Turnstile and the global cap). 04b/05 may derive the document id server-side; until then treat it as untrusted.
- F5: the 04b SQL `QuotaPort.claim` MUST throw on any port/storage error and return `ok:false` ONLY for a genuine at-cap refusal. `Claims.marker()` reads `ok:false` as "document already seen", so a swallowed port error would silently skip the doc claims.
- F2: 04b should persist the circuit breaker by implementing `BreakerPort` (D1 row keyed by UTC day + config fingerprint) and wiring it via `createApp({ proxy: { breaker } })`; `tripped()` should throw on storage errors (the pipeline fails closed).
- F1: with claims kept after dispatch, the 04b refund path is only hit before dispatch or for definite non-consuming 4xx; port-call budget on the failure path is unchanged or lower.

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [x] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented) (17-10-26: 04a-WORKER gates green; reviewer decision pending; M1 SLICE CLOSURE deferred: depends on Phase 03)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S2 (API/auth surface), S4, S6 (secrets, trust boundary, public endpoint), S7 → 4/7 HIGH. Recommended: sequential (single route/policy subtree) with a read-only security review subagent (vc-security STRIDE pass on guards and identity) before PVL. Sonnet for research/validation/review, opus for code execution.

## Test Infra Improvement Notes

Shared `OpenRouterStub` (`apps/worker/test/fakes/openrouter-stub.ts`) and `turnstile-stub.ts` built here (injected-fetch based), plus the `globalThis.fetch`-throws setup guard, reused by Phases 05, 06. Plan impact: 04a, 06 (06 must use injected fetch, not `fetchMock`).

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04a-worker-proxy_PLAN_17-10-26.md`
- Last completed step: 5 EXECUTE (17-10-26). Report: `subdoc-qa-mvp_PHASE-04a-worker-proxy_REPORT_17-10-26.md`; risk pack `harness/phase-04a/` (decision pending)
- Validate-contract status: PASS (outer-pvl 2026-10-17, re-validated after supplement cycle 3; 3/3 cycle-3 gaps resolved; minor items recorded as execute-agent instructions E12-E17)
- Next Step: after Phase 01 is verified (Phase 03 not required; held), spawn vc-research-agent. When 04a-WORKER is VERIFIED, record M1 SLICE CLOSURE as `deferred: depends on Phase 03`; after Phase 03 is VERIFIED against `app.html`, run `pnpm slice:check` and `pnpm --filter @aduin/web test:e2e` to close M1. Next phases: Phase 02 and Phase 04b in parallel.
- Gate commands: no `--` between `test` and the token; a token matching no file fails the gate.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: outer-pvl
supersedes: 2026-10-17 (outer-pvl) — re-validation after PVL supplement cycle 3 (3 gaps applied: M1 Phase 03 hold split, T1 no-`--` gate commands, Q1 quota `reason` carrier); this contract has current evidence (adds 6 probe-verified minor fixes applied to the plan body)

Parallel strategy: sequential (single route/policy subtree) + one read-only vc-security STRIDE review subagent before EXECUTE
Rationale: 4/7 signals HIGH (S2 API/auth surface, S4 phase program, S6 secrets + trust boundary + public endpoint + spend cap, S7 5+ files); dominant signal S6. Sequential because the route/policy subtree is tightly coupled and no mid-run coordination is needed. Models: sonnet for review/validation, opus only for the code-execution leg.

Test gates (C3 5-column table; legacy line form below). Command form (program-wide rule, umbrella 2026-10-17): under pnpm 11.13.1 select tests with `pnpm --filter <pkg> test <token>`, NO `--` (a literal `--` runs the whole suite and ignores the token). ONE token per invocation: probed at VALIDATE, a single unmatched token exits 1 (`No test files found`) but a multi-token call passes when any token matches, so a missing gate file would go unnoticed. The mode flag `--worker-only` is not the `--` separator and forwards through root -> scripts (probed).

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC26 | 429/402/timeout/malformed upstream -> degrade, units refunded, no lost work | Fully-Automated | `pnpm --filter @aduin/worker test llm-failure-injection-matrix` (OpenRouter stub, injected fetch, no network) | A |
| AC26 | refuse paid call at cap and whenever `PAID_FALLBACK_ENABLED` is not exactly `true`; circuit breaker on non-zero cost | Fully-Automated | `pnpm --filter @aduin/worker test spend-cap-enforced` | A |
| AC26 | free ids only in outbound `model`/`models[]`; `openrouter/*` router ids rejected; flag only on exact `"true"` | Fully-Automated | `pnpm --filter @aduin/worker test free-only-config` | A |
| AC27 | cache key via imported `cacheKey()` matching `fixtures/cache-key-vectors.json`; hit streams with no upstream call, no claim, no write, even with exhausted caps | Fully-Automated | `pnpm --filter @aduin/worker test llm-ocr-cache-hit` | A |
| AC32 | visitor over daily AI documents -> pre-stream HTTP `errorStatus('quota_exhausted')` (429) with `error.reason = visitor_limit`, keyed on `v`; post-open failure is a terminal `error` frame with the same fields | Fully-Automated | `pnpm --filter @aduin/worker test per-visitor-ai-limit-e2e` | A |
| AC33 | global cap = lesser of configured cap and provider allowance; at/below/above; UTC midnight; AI and OCR share one provider counter; `GET /api/quota` returns `{ai, ocr_pages, global_ok}` and writes nothing; reasons `global_cap`, `spend_cap`, `ocr_pages_limit` in their gates | Fully-Automated | `pnpm --filter @aduin/worker test global-daily-cap-and-budget` | A |
| AC39 | burst, oversize, malformed JSON, wrong type, forged cookie, `a`-only cookie with different `v`, expired/future `t`, cookie minting, spoofed XFF, client model/plugins/provider/tools/`ext`, non-data image URL, `application/pdf` mime (415), Origin/CSRF, hostile text | Fully-Automated | `pnpm --filter @aduin/worker test abuse-protection-matrix` | A |
| AC39 (Turnstile) | first AI call: pass / fail / already-spent / missing token / network error fail closed (`invalid_session`, 401, zero claims, zero upstream); fresh `t` (ms) skips siteverify; re-sign preserves claims | Fully-Automated | `pnpm --filter @aduin/worker test turnstile-first-call` | A |
| AC40 (interim) | <= 12 port calls per AI request | Fully-Automated | `pnpm --filter @aduin/worker test proxy-budget` | A |
| AC26/AC39 (secret hygiene) | key never in response, headers, logs, errors; base URL https + host `openrouter.ai`; missing key fails closed; `no-store`; no CORS | Fully-Automated | `pnpm --filter @aduin/worker test secret-non-leak` | A |
| AC26 (hold-open) | NDJSON `hb` every 10 s, exactly one terminal frame parsed by `parseFrameLine`, 120 s timeout, upstream abort + refund, `waitUntil` never called | Fully-Automated | `pnpm --filter @aduin/worker test stream-holdopen` (fake clock) | A |
| worker stack (04a-WORKER) | local Worker boots via `wrangler dev --local` with an empty temp `--assets` dir; `/api/health` 200; `/api/quota` 200 JSON `{ai, ocr_pages, global_ok}`; guards green; no outbound openrouter.ai; teardown | Fully-Automated | `pnpm slice:check --worker-only` (replaces Phase 00 stub) | B (script and mode added by this plan's Step E1) |
| earlier phases (worker-standalone) | Phase 01 goldens and Phase 00 guards intact; no secret or zone reference | Fully-Automated | `pnpm --filter @aduin/core test:golden && pnpm guard:cf && pnpm secrets:scan` | A |
| high-risk evidence | risk pack for secrets/trust-boundary/public-API/proxy/spend; reviewer is the automated sonnet vc-security / vc-code-reviewer, recorded | Hybrid | `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness` plus recorded APPROVE decision | A |
| Milestone 1 (DEPENDS ON PHASE 03; held) | slice through the local Worker stack with the web build: samples #1/#3/#11 findings, `/api/quota` 200 JSON, guards, no outbound openrouter.ai call | Fully-Automated | `pnpm slice:check` (needs the Phase 03 web build and Playwright `stack` project) | C (deferred to the first run after Phase 03 is VERIFIED against `app.html`; recorded `deferred: depends on Phase 03`; never faked) |
| earlier phases (DEPENDS ON PHASE 03; held) | Phase 03 web e2e intact | Fully-Automated | `pnpm --filter @aduin/web test:e2e` | C (same deferral) |
| AC40 residual | real workerd CPU and 54-90 s hold-open on workers.dev | Agent-Probe | S1/S2/S6 verdicts applied (Phase 00 REF) | C (Phase 10 `free-plan-limits-conformance`; D backlog stub if S1 fails) |

Known-Gap is never a `strategy:` value here. Named residuals: real-workerd CPU limit and real-provider latency are not provable locally (gap-resolution C, Phase 10); the M1 end-to-end slice is deferred, not dropped, while Phase 03 is held (gap-resolution C). Net-gate vacuous-green scan: every developed 04a behavior has a Fully-Automated or Hybrid gate; clear.

Final gate commands (copy-paste; no `--`):

```bash
# 04a-WORKER VERIFY set (worker-standalone; runs while Phase 03 is held; needs only Phase 00 + Phase 01). One token per call.
for t in llm-failure-injection-matrix spend-cap-enforced free-only-config llm-ocr-cache-hit per-visitor-ai-limit-e2e global-daily-cap-and-budget abuse-protection-matrix turnstile-first-call secret-non-leak stream-holdopen proxy-budget; do pnpm --filter @aduin/worker test "$t" || exit 1; done
pnpm --filter @aduin/worker test
pnpm --filter @aduin/core test:golden && pnpm guard:cf && pnpm secrets:scan
pnpm slice:check --worker-only
node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness   # + recorded APPROVE
# Deferred M1 SLICE CLOSURE set (depends on Phase 03 VERIFIED against app.html; run after the hold lifts; record `deferred: depends on Phase 03` until then):
pnpm slice:check
pnpm --filter @aduin/web test:e2e
```

Failing stubs (red-first; Fully-Automated rows only; copy verbatim into the test files):
- `test("should return quota_exhausted when the visitor exceeds the daily AI documents", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should return quota_exhausted when the visitor exceeds the daily AI documents") })`
- `test("should refuse a paid call at the spend cap", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should refuse a paid call at the spend cap") })`
- `test("should refund claimed units when upstream fails", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should refund claimed units when upstream fails") })`
- `test("should reject a body over the cap before claiming quota", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should reject a body over the cap before claiming quota") })`
- `test("should serve a cache hit without calling upstream", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should serve a cache hit without calling upstream") })`
- `test("should never emit a file content part or file-parser plugin", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should never emit a file content part or file-parser plugin") })`
- `test("should send only :free model ids when paid fallback is disabled", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should send only :free model ids when paid fallback is disabled") })`
- `test("should never include the api key in any response, header or log line", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should never include the api key in any response, header or log line") })`
- `test("should hold the stream open with heartbeats and never call waitUntil", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should hold the stream open with heartbeats and never call waitUntil") })`
- `test("should boot the worker-only slice with an empty assets dir and answer /api/health", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should boot the worker-only slice with an empty assets dir and answer /api/health") })`

Legacy line form:
- Worker proxy/limits: [Fully-automated: `pnpm --filter @aduin/worker test <token>` per gate, then the full suite] | [Fully-automated: `pnpm slice:check --worker-only`] | [fully-automated, deferred until Phase 03 verifies: `pnpm slice:check`, `pnpm --filter @aduin/web test:e2e`] | [hybrid: risk evidence pack validator + automated reviewer decision] | [agent-probe: S1/S2/S6 remote CPU/hold-open verdicts applied] | [known-gap: real-workerd CPU enforcement and live-provider latency, documented (Phase 10)]

Plan updates applied by this pass (all in the plan body, probe-verified where marked):
- P1. Frontmatter description no longer says "completes Milestone 1" (now: closes the worker half; full M1 deferred).
- P2. Entry Gate also checks the shared error schema carries optional `reason?` (add additively to `contracts/errors.ts` if the HTTP body schema lacks it).
- P3. E1: `wrangler dev` errors on a missing assets directory (probed, wrangler 4.151.1: "The directory specified by the assets.directory field ... does not exist"); worker-only mode now creates an empty temp dir and passes `--assets <tmpdir>` (probed: `/api/health` 200).
- P4. E1: before Phase 04b `createD1Platform` is a NotImplemented stub, so the dev entry has no platform: `/api/quota` returns 200 with `used` 0, configured limits, `global_ok:false`, zero writes; AI/OCR fail closed; no test fakes imported into `src`.
- P5. Touchpoints/E1: `slice-check.ts` replaces Phase 00's `slice-check-stub.ts` and repoints one `slice:check` key in `scripts/package.json`.
- P6. C2: net guard registered through one `setupFiles` key in `apps/worker/vitest.config.ts` (serialized seam edit of a Phase 00 file).
- P7. Test Gates intro: one token per invocation (multi-token call passes when any token matches; probed).
- P8. Seam edits: `AppDeps` gains optional port/config fields (additive) with one-line wiring in `src/index.ts`; Resume status line set to PASS.

Cycle-3 gap verification (re-read against the current plan text and Phase 01 Contracts v1):
- M1 (Phase 03 hold): RESOLVED. Phase Completion Rules split into (a) 04a-WORKER VERIFIED and (b) M1 SLICE CLOSURE `deferred: depends on Phase 03`; Entry Gate says Phase 03 not required; E1 has `--worker-only` and full modes; E2 `slice.spec.ts` deferred and uses only Phase 03's published `data-testid`s; Test Gates and Verification Evidence rows are labeled; Exit Gate lists only worker-standalone items and records M1 as deferred; Next Step and Rollback consistent. Run order matches umbrella `## Execution Holds` (01 -> 04a -> 02 -> 04b). No residual Phase 03 dependency in the worker-standalone set.
- T1 (no `--`): RESOLVED. `grep "test --"` over the plan body returns only the historical contract note text; all 11 gate rows, Verification Evidence, Resume and the code block use `test <token>`; intro states a token matching no file must fail (probed: exit 1; core `test:golden` has `--passWithNoTests`, not the worker).
- Q1 (quota reason): RESOLVED. Pre-stream refusals return HTTP via `errorStatus(code)` with `{error:{code,message,reason?,retry_after_s?}}`; post-open failures are terminal `error` frames with the same fields; reasons `visitor_limit`, `global_cap`, `spend_cap`, `ocr_pages_limit` asserted in the named gates; Phase 01 Contracts v1 freezes optional `reason?` on the frame (the HTTP body is covered by P2 and E15).
- No regressions: cycle-2 items (frozen claims, v-keyed limits, kid map, header carrier, injected fetch, `pnpm exec`) intact; `validate-plan-artifact.mjs` 0 failures, 0 warnings; blast radius still disjoint from Phase 01 (`packages/core`), 03 (`apps/web/src`), 04b (`platform`, `migrations`, `memory`); registry and umbrella agree.
- /goal block: BRANCH B (umbrella has `## Stable Program Goal`); no autonomous goal-block section is written to this phase plan; the umbrella goal governs. Reference for latest state: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md

Execute-agent instructions (carried forward E1-E11; new E12-E17 are minor and non-blocking):
- E1. Gate commands use vitest file-name filters in the no-`--` form: create test files named exactly `llm-failure-injection-matrix`, `spend-cap-enforced`, `free-only-config`, `llm-ocr-cache-hit`, `per-visitor-ai-limit-e2e`, `global-daily-cap-and-budget`, `abuse-protection-matrix`, `turnstile-first-call`, `proxy-budget`, `secret-non-leak`, `stream-holdopen` under `apps/worker/test/proxy/` (`*.test.ts`). A filter that matches no file must fail the gate, not pass it. If the plan text still says `test -- <token>`, read it as `test <token>`.
- E2. No live OpenRouter or Turnstile call in any test: inject `fetch` through `createApp(deps)`; `fetchMock` is not available (Phase 00 E3), so also install the setup guard that makes global `fetch` throw. Do not skip a test; record the outcome in the phase REF ("Plan impact: 04a, 06").
- E3. Free-only is enforced in code: reject any model id not ending in `:free`, reject `openrouter/*` router ids, default `PAID_FALLBACK_ENABLED` to disabled and enable only on the exact string `true`, keep the paid model list empty by default.
- E4. Secrets: key read from `env` only; never log or echo headers/bodies; do not forward upstream error bodies; no `.dev.vars` or key value in the repo, CI output or slice-check output; credentials files under `~/.config/*` loaded only with the `# APPROVED:credentials.env` marker in the same Bash call and never printed.
- E5. `pnpm slice:check` (any mode) starts `pnpm exec wrangler dev --local` only (never `--remote`), with no real OpenRouter key present (fail-closed AI), asserts no outbound call to openrouter.ai, and tears the dev server down on success and failure.
- E6. Deploy: Phase 04a needs no remote deploy. If the orchestrator elects the M1 deploy (plan Step E3), it waits for Phase 03 (umbrella hold): only `aduin-transaction-*` resources on the default `*.workers.dev` URL, no `routes`/`custom_domain`, never zone `itsjiathao.com` (id 894bc9f93640fab260bf1580b5b48cb7), check the account workers.dev subdomain first and do NOT register one (Phase 00 E5), secrets via `wrangler secret put` on stdin (never argv/files), `pnpm guard:cf && pnpm secrets:scan` before and list account resources after. Anything else is a hard stop. No git push.
- E7. OCR body CPU: do not `JSON.parse` the full 700 KB body and re-serialize; stream-hash the bytes and build the upstream body by string templating (S2); prefer hand validators over zod in the hot path if S6 shows gz size over 1 MiB.
- E8. Spend path (disabled by default): reserve estimated max cost before a paid call so concurrent calls cannot overshoot the cap; write ledger row with serving model and `usage.cost`.
- E9. Before reporting DONE: produce the risk evidence pack (risk-gate, context-snippets, verification, review-decision, adversarial-validation) in `process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/`, run `validate-risk-artifacts.mjs`; run the read-only vc-security STRIDE review and vc-code-reviewer first; the automated reviewer is named in `review-decision.json`; auto-stop until APPROVE.
- E10. Cross-phase: import `cacheKey`, frame schemas, `errorStatus`, `SessionClaims`, `resign` and the cookie helper from `@aduin/core` (Phase 01 Contracts v1); never re-implement them. `t` is epoch milliseconds.
- E11. Phase 03 hold: do not wait on or edit Phase 03 files. Run only the worker-standalone VERIFY set; mark `pnpm slice:check` (full) and `pnpm --filter @aduin/web test:e2e` as `deferred: depends on Phase 03` in the phase report; do not fake or stub them green. Do not depend on Phase 00 files beyond its documented seams (`createApp(deps)`, `mountProxyRoutes` stub, `apps/worker/vitest.config.ts`, root `guard:cf` and `secrets:scan` scripts).
- E12. Gate loop: run each gate with one token per invocation (loop form in Final gate commands); never combine tokens in one call, a missing file would go unnoticed. Confirm `pnpm --filter @aduin/core test:golden` actually ran golden files (the core script uses `--passWithNoTests`, so it is vacuous if Phase 01 left no goldens; the Entry Gate guarantees Phase 01 passed).
- E13. Entry wiring: extend `AppDeps` additively (optional fields) so Phase 00's `health.test.ts` and `seams.test.ts` keep compiling; `src/index.ts` is a one-line wiring edit. With no D1 platform (04b not run), ports resolve to an "unavailable" implementation: `/api/quota` 200 with `used` 0, configured limits, `global_ok:false`, zero writes; AI/OCR fail closed. Do not import `apps/worker/test/fakes` into `src`.
- E14. Runner is `@cloudflare/vitest-plugin` 1.4.4 on vitest 4.1.12 (Phase 00 A1 decision, in `apps/worker/vitest.config.ts`); plan references to `@cloudflare/vitest-pool-workers` 0.23.0 are historical. The net guard goes in `test/setup.ts` via a single `setupFiles` key.
- E15. Error body `reason?`: use ONE shared error schema from `@aduin/core` for the frame and the HTTP body. Phase 01's plan text freezes `reason?` on the frame only (its common-body line omits it); if the built schema lacks it on the body, add it as an optional field (additive-only rule, no `v` bump) and note it in the phase report; orchestrator should carry the same one-line note into Phase 01 EXECUTE.
- E16. Pre-stream vs frame: claim-step policy refusals (before the first heartbeat) are HTTP via `errorStatus`; failures after the stream opens are terminal `error` frames; Phase 01's endpoint table allows both for `/api/ai`. Record in the phase report so Phase 05's client handles both forms.
- E17. slice-check mechanics: start `pnpm exec wrangler dev --local --ip 127.0.0.1 --port <free port> --assets <empty tmpdir>` from `apps/worker`; poll `/api/health` until ready; kill the whole process group (wrangler and workerd) on success and failure; remove the tmpdir; delete `scripts/src/slice-check-stub.ts` and repoint the single `slice:check` key in `scripts/package.json`; exit non-zero on any unknown arg. Hook caveat (Phase 00 E9): invoke via `pnpm exec`, and do not put `dist` or `node_modules` paths in Bash arguments.

Dimension findings:
- Infra fit: PASS — Worker Free fit consistent with P2/P4 (ports/hash/forward only); injected `fetch`, `pnpm exec` tooling, local-only wrangler; wrangler missing-assets failure and the empty `--assets` workaround probed and fixed in plan (P3); Phase 00 scaffold present on disk and matches seams.
- Test coverage: PASS — 11 worker gates + worker-only slice, all Fully-Automated, file names pinned, one token per call (probed), no live calls, standalone of Phase 03; deferred M1 rows labeled with gap-resolution C, not a Known-Gap strategy.
- Breaking changes: PASS — claims, `cacheKey`, frames, `errorStatus`, envelope whitelist, quota shape and optional `reason?` align with Phase 01 Contracts v1; HTTP-body `reason?` is an additive optional field (E15), no consumer broken.
- Security surface: PASS — key hygiene, free-only, fail closed, SSRF block, `cf-connecting-ip` identity, `v`-keyed limits, Turnstile header with fail-closed siteverify and `t` freshness, HMAC cookie via Phase 01 helper, no `waitUntil`, evidence pack with automated reviewer; no zone or custom-domain touch (CLAUDE.md Project Rules). No FAIL.
- Section A Guards/identity feasibility: PASS — highest-risk edit A2 mitigated by forged-cookie, spoofed-XFF, `a`-only and `t` rows in A4.
- Section B Policy/ports feasibility: PASS — ordering and refunds sound; refusal form and reason carrier pinned (Q1 resolved); highest-risk edit B1 keeps the zero-write hit assertion.
- Section C Upstream/stream feasibility: PASS — frozen frames and `parseFrameLine`; fake-clock test with a throwing `waitUntil`; net guard wiring pinned (P6); highest-risk edit C3.
- Section D Routes/Turnstile feasibility: PASS — header carrier, gate file and fail-closed matrix pinned; highest-risk edit D2.
- Section E Slice check feasibility: PASS — worker-only mode feasible after P3-P5 (probed boot with `--assets`, `/api/health` 200, flag forwarding); full mode and `slice.spec.ts` deferred with the Phase 03 hold; E3 deploy constraints compliant.
- Section F Risk evidence pack: PASS — 5 artifacts in the task-folder `harness/`, validator script present, automated sonnet reviewer recorded, auto-stop respected.
- Blast radius vs Phase 00/01/03/04b: PASS — disjoint; seam edits (`app.ts`, `index.ts`, `wrangler.jsonc` vars, `vitest.config.ts` key, `scripts/package.json` key) are single-key and serialized.
- Phase 03 hold dependency: PASS — confined to the deferred full `slice:check`, `slice.spec.ts` and web e2e; worker-standalone set verified independent.

Open gaps:
- known-gap: real-workerd CPU enforcement and live-provider latency/rate behavior are not provable locally; covered by S1/S2/S6 verdicts and Phase 10 conformance (documented, gap-resolution C).
- deferred (not a gap in 04a worker scope): full `pnpm slice:check` and `pnpm --filter @aduin/web test:e2e` until Phase 03 is verified against `app.html` (gap-resolution C).
- advisory for orchestrator: Phase 01 plan line "every error response is `{error:{code, message, retry_after_s?}}`" omits `reason?`; carry E15 into Phase 01 EXECUTE (not a 04a blocker).

What This Coverage Does NOT Prove:
- `llm-failure-injection-matrix` / `spend-cap-enforced` / `free-only-config`: do not prove real OpenRouter behavior (real 429 `Retry-After`, real 402 on negative balance, real `models[]` fallback ordering, free-id rotation) or that a real paid model is never selected on the live account.
- `llm-ocr-cache-hit`: does not prove D1 atomicity or TTL behavior (fakes; real SQL in Phase 04b) or rules-hash invalidation (Phase 05).
- `per-visitor-ai-limit-e2e` / `global-daily-cap-and-budget`: do not prove concurrency races on real D1 counters, IPv6 rotation or distributed-IP abuse, provider-side allowance drift, or the UI message (Phase 05).
- `abuse-protection-matrix`: does not prove Cloudflare edge rate limiting, DDoS behavior, or abuse against the deployed Worker (Phase 10).
- `turnstile-first-call`: does not prove the real Turnstile widget, real siteverify latency, or token behavior from a live browser.
- `secret-non-leak`: does not prove secrets are absent from Cloudflare platform logs/tail output or from deploy tooling output.
- `stream-holdopen`: does not prove a real 54-90 s hold-open survives on workers.dev or real CPU under 10 ms (S1/S2/S6, Phase 10).
- `proxy-budget`: counts port calls only; not real CPU, subrequest count including provider fan-out, or D1 rows written.
- `pnpm slice:check --worker-only`: proves the local Worker boots with an empty assets dir, serves `/api/health` and a fail-closed `/api/quota`, and makes no outbound openrouter.ai call; it does NOT prove the web app, real findings in the UI, any browser behavior, or a real D1-backed quota (Phase 04b).
- Full `pnpm slice:check` (deferred): will prove the local stack with the Phase 03 web build, not the deployed app, real Turnstile widget, or live AI.
- Evidence pack validator: proves artifacts exist and a reviewer decision is recorded, not that the (automated) reviewer's analysis is correct.

Gate: PASS (0 FAILs, 0 unresolved CONCERNs; 3 of 3 cycle-3 gaps verified resolved; 8 minor plan fixes applied; no regressions; minor items carried as execute-agent instructions E12-E17)
Accepted by: n/a (Gate is PASS; no concerns to accept; minor items E12-E17 are execute-agent instructions, session autonomous under autopilot)
