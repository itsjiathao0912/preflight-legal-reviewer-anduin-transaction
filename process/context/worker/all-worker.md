---
name: context:all-worker
description: Cloudflare Worker (apps/worker) facts for the sub-doc QA tool - AI/OCR proxy pipeline order, refund policy, limits, config and env var names, secret names, error shapes, live deploy rules and redeploy recipe
keywords: worker, cloudflare, wrangler, proxy, openrouter, ai, ocr, ndjson, hold-open, turnstile, quota, spend cap, circuit breaker, refund, cookie, deploy, workers.dev, secrets, d1, health, api quota, free-only, limits
related: [context:all-engine, context:tests]
date: 17-10-26
metadata:
  node_type: group-entrypoint
  type: context
  read_when: any work in apps/worker, the /api/* routes, quotas or limits, OpenRouter calls, secrets, or deploying to workers.dev
---

# aduin-transaction - Worker Context

Last updated: 2026-10-17 (Phase 03/04a UPDATE PROCESS; HEAD 70d320b)

Entrypoint for the `worker/` context group (one doc for now). Read this before touching `apps/worker`, `/api/*`, limits, or a deploy.

## Scope

Covers: what `apps/worker` contains, the AI/OCR proxy pipeline, refund policy, limits, config/env names, secret names (names only, never values), deploy rules and the redeploy recipe.

Does not cover: engine detectors and frozen contracts (`process/context/engine/all-engine.md`), test commands (`process/context/tests/all-tests.md`), D1 schema and memory API (Phase 04b, see `subdoc-qa-mvp_DATA-MODEL_17-10-26.md` in the program task folder).

## What The Worker Is

One Worker, `aduin-transaction-web` (`apps/worker/wrangler.jsonc`, Free plan, `workers_dev: true`, no routes, no custom domain). It serves the built SPA from `apps/web/dist` as static assets (`ASSETS`, SPA fallback, `run_worker_first: ["/api/*"]`) and `/api/*` from code. **The Worker never parses documents**; parsing runs in the browser engine. It only proxies AI/OCR calls to OpenRouter.

Routes (live in M1): `GET /api/health` (static `{ok:true}`, no `no-store` yet), `GET /api/quota`, `POST /api/ai`, `POST /api/ocr` (PDF mime is rejected 415). Memory routes are Phase 04b seams (`src/routes/memory`).

Source map (`apps/worker/src`): `app.ts` (createApp + AppDeps seams), `config.ts` (strict env parsing, fail closed), `routes/proxy/{ai,ocr,quota,index}.ts`, `proxy/{guards,pipeline,stream,errors,log,ports}.ts`, `limits/{clock,visitor,prelimit,policy}.ts`, `upstream/{openrouter,classify,models-config}.ts`, `identity/turnstile.ts`, `platform/index.ts` (D1 platform lands in 04b; until then `unavailablePlatform()` makes AI/OCR fail closed and quota fail-soft).

## Pipeline Order (`proxy/pipeline.ts`)

1. Header-only guards (origin, `x-aduin-client: 1`, content type, body caps).
2. In-isolate pre-limit (30 req/min, 6 AI req/min per IP; no subrequest).
3. Body read, parse, shape (open-proxy whitelist; client-supplied model/plugins/provider/tools/max_tokens dropped or rejected; images only as `data:image/(png|jpeg|webp);base64`).
4. Identity: signed visitor cookie `__Host-aduin_v` (Secure, HttpOnly, SameSite=Lax; minted on the first `/api/*` call).
5. Cache read (content-hash key). A HIT costs zero claims, zero writes, zero upstream calls.
6. Turnstile (token in header `x-aduin-turnstile`; fails closed with 401 `invalid_session`).
7. Ordered claims: visitor (req, fresh-doc v + IP, OCR pages) then global provider counter (always claimed last) then spend reservation.
8. OpenRouter call (`redirect: 'error'`, 120 s timeout, free models only) streamed as hold-open NDJSON (`{t:'hb'}` every 10 s, then one terminal `result` or `error` frame).
9. Classify, cache write, ledger write, terminal frame.

Pre-stream refusals are HTTP via `errorStatus(code)` with body `{error:{code,message,reason?,retry_after_s?}}`; failures after the stream opens are terminal `error` frames with the same fields. Clients must handle both. Budget: at most 12 port calls per AI request.

## Refund Policy (DV10)

| Cause | Visitor claims | Global + spend |
|---|---|---|
| refusal before dispatch, pre-dispatch abort, non-consuming 4xx (400/401/403/413/415/422) | refunded | refunded |
| client abort after dispatch | kept | kept |
| provider fault after dispatch (timeout, network, 5xx, 429, 402) | refunded | kept |
| malformed output, 200-with-error body | kept | kept |

## Limits And Config

Defaults live in `packages/core/src/config/limits.ts` (the single source); env vars override. Per visitor per UTC day: 3 fresh-AI documents (D-4), 8 AI requests, 6 OCR pages. Global cap = min(`globalProviderReqsPerDay`, `PROVIDER_ALLOWANCE_PER_DAY` default 50). Spend cap `SPEND_CAP_MICRO_USD` (paid path disabled; `PAID_FALLBACK_ENABLED=false`). Body caps: AI 128 KiB, OCR 700 KiB, other 64 KiB. Windows reset at UTC midnight.

Plain vars in `wrangler.jsonc`: `PAID_FALLBACK_ENABLED`, `OPENROUTER_BASE_URL` (must be https `openrouter.ai`), `AI_TEXT_MODELS`, `AI_VISION_MODELS` (every id must end in `:free`; `openrouter/*` router ids rejected), `AI_UPLOADS_ENABLED` (exact string `true`). Other optional vars: `AI_PAID_MODELS`, `VISITOR_AI_DOCS_PER_DAY`, `VISITOR_AI_REQS_PER_DAY`, `VISITOR_OCR_PAGES_PER_DAY`, `PAID_MAX_COST_MICRO_USD`, `VISITOR_COOKIE_TTL_S`, `TURNSTILE_PASS_TTL_MS`, `TURNSTILE_SITE_KEY`. Invalid config throws `ConfigError` and the proxy degrades without any upstream call.

Circuit breaker: trips on `usage.cost > 0` or a served model id that is not `:free` and not in the configured free lists. Per-isolate in 04a (`BreakerPort` + `memoryBreaker()`); 04b persists it.

## Secrets (names only; set with `wrangler secret put`, never in the repo or logs)

Set on the live Worker: `COOKIE_SIGNING_KEYS` (JSON map kid to key), `COOKIE_SIGNING_KID`, `OPENROUTER_API_KEY` (from `~/.config/openrouter/credentials.env`). Not set yet: `TURNSTILE_SECRET` (widget arrives with 04b/05). Local dev uses gitignored `.dev.vars`.

## Deploy Rules And Redeploy Recipe

- Live: https://aduin-transaction-web.giathaowork.workers.dev (workers.dev subdomain `giathaowork`; active version `9dcf2f75-d8ac-419f-b33b-5a2525847ae7`). AI is fail-closed until 04b (no D1) and 05 (Turnstile widget).
- Hard rules: only `aduin-transaction-*` names on workers.dev/pages.dev; never touch zone `itsjiathao.com`; no route or custom domain; Workers Free only; `git push` needs user OK. Run `pnpm guard:cf && pnpm secrets:scan` before every deploy.
- Recipe until 04b: (1) `pnpm --filter @aduin/web build` (a plain build, not `build:e2e`; `no-e2e-hook-in-dist` proves it); (2) the committed `wrangler.jsonc` binds D1 with a placeholder all-zero id that `wrangler deploy` cannot resolve, so generate a temporary config that is the committed file minus `d1_databases` and `$schema`, with `main` and `assets.directory` paths rebased, under the gitignored `apps/worker/.wrangler/`; assert it has no routes/custom_domain/zone keys and the name starts with `aduin-transaction-`; (3) `wrangler deploy -c <that file>`; (4) delete the temporary file. Phase 04b replaces the placeholder with the real D1 id, after which plain `wrangler deploy` works.
- Verify: `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` (https `*.workers.dev` only).

## Known Gaps

- Real workerd CPU and hold-open timing, OpenRouter accounting of aborted/4xx requests, and the served-model string format are unproven (Phase 05/10 live probe).
- `x-aduin-doc` is client-attested (F4); the 04b SQL `QuotaPort.claim` must throw on storage errors (F5); a failed `BreakerPort.trip()` write must also set the in-isolate trip (F14). See the 04a plan `### Phase 04b contract notes`.
- `GET /api/health` lacks `cache-control: no-store`.

## Source Paths

- `apps/worker/{wrangler.jsonc,src/**,test/**}`, `scripts/src/slice-check.ts`
- `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04a-worker-proxy_{PLAN,REPORT}_17-10-26.md`
- `packages/core/src/config/limits.ts`, `packages/core/src/contracts/`

## Update Triggers

Pipeline or refund-policy change, new route, new env var or secret, limit change, D1 platform wired (04b), Turnstile widget added, deploy recipe change, custom domain decision.

## Routing

No deeper docs yet. Tests: `process/context/tests/all-tests.md`. Engine contracts: `process/context/engine/all-engine.md`.
