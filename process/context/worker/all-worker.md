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

Last updated: 2026-10-17 (Phase 04b UPDATE PROCESS; HEAD 59d9831 plus the process commit)

Entrypoint for the `worker/` context group (one doc for now). Read this before touching `apps/worker`, `/api/*`, limits, or a deploy.

## Scope

Covers: what `apps/worker` contains, the AI/OCR proxy pipeline, refund policy, limits, config/env names, secret names (names only, never values), deploy rules and the redeploy recipe.

Does not cover: engine detectors and frozen contracts (`process/context/engine/all-engine.md`), test commands (`process/context/tests/all-tests.md`), the D1 schema DDL (`subdoc-qa-mvp_DATA-MODEL_17-10-26.md` in the program task folder; migrations are in `apps/worker/migrations/`). The memory API summary below is the durable part.

## What The Worker Is

One Worker, `aduin-transaction-web` (`apps/worker/wrangler.jsonc`, Free plan, `workers_dev: true`, no routes, no custom domain). It serves the built SPA from `apps/web/dist` as static assets (`ASSETS`, SPA fallback, `run_worker_first: ["/api/*"]`) and `/api/*` from code. **The Worker never parses documents**; parsing runs in the browser engine. It only proxies AI/OCR calls to OpenRouter.

Routes (live in M1): `GET /api/health` (static `{ok:true}`, no `no-store` yet), `GET /api/quota`, `POST /api/ai`, `POST /api/ocr` (PDF mime is rejected 415). Memory routes (Phase 04b, code-complete, not yet deployed) are listed in the Memory API section.

Source map (`apps/worker/src`): `app.ts` (createApp + AppDeps seams), `config.ts` (strict env parsing, fail closed), `routes/proxy/{ai,ocr,quota,index}.ts`, `proxy/{guards,pipeline,stream,errors,log,ports}.ts`, `limits/{clock,visitor,prelimit,policy}.ts`, `upstream/{openrouter,classify,models-config}.ts`, `identity/turnstile.ts`, `platform/{index,quota,cache,ledger,breaker,rules}.ts` (D1 platform, Phase 04b; with no D1 binding `unavailablePlatform()` still makes AI/OCR fail closed and quota fail-soft), `memory/**` (ctx, repo modules, proposal, purge, mask), `routes/memory/**`, `migrations/0001-0005`, `seed/demo.sql`.

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

Circuit breaker: trips on `usage.cost > 0` or a served model id that is not `:free` and not in the configured free lists. Persisted in D1 by Phase 04b (`platform/breaker.ts`, fail closed on D1 error); the in-isolate trip is still set first.

## Memory API (Phase 04b)

All SQL lives in `apps/worker/src/{memory/repo,platform}`; every statement binds `workspace_id` (statement-lint test) except declared global ones. Routes (all need the signed workspace cookie except `POST /api/session` and health): `POST /api/session` (mints a sandbox workspace + analyst, copies the demo seed, re-signs the cookie with `{w, a, exp}` preserving `v`/`t`; Turnstile only when `TURNSTILE_SECRET` is configured; degrades to a read-only demo when over the write estimate), `POST /api/memory/lookup`, `POST /api/runs`, `POST /api/runs/:id/findings` (chunks of 25), `POST /api/runs/:id/export`, `POST /api/decisions`, `POST /api/decisions/:id/revoke`, `POST /api/counsel/{questions,answers}`, `GET|POST /api/rules`, `POST /api/rules/:id/{approve,reject,revoke}`, `GET /api/memory/firm` (+ alias `/api/memory/firms/:id`), `GET /api/audit`, `GET /api/export`, `GET /api/memory/health`. Decisions are append-only (`uq_decision_active`; `client_op_id` replay returns the original 200 body; a race returns 409 `conflict_active_decision` with `current`). A rule is proposed when at least 3 distinct active same-(firm, pattern_key, reason) dismissals exist (reason not `other`); re-proposal after a rejection needs 1 new dismissal while the total stays at least 3; `evidence_count` is LINKED evidence (newest 10 only) and is not the total dismissal count.

Write order per memory write (`memory/ctx.ts`): verify the signed cookie first (no DB, no body read; a forged cookie never costs body CPU; a read-only cookie on a write is refused), then liveness in the first batched statement, then body parse, then a 0-row pre-check of the global row budget, then the per-workspace `mw|req` claim, then the global weighted row-budget claim (global claimed last).

Write caps (`platform/index.ts`, UTC day windows): per workspace 600 mutating requests, 40 runs, 2000 findings; global weighted row budget 30,000 units/day (`MEMORY_WRITE_WEIGHTS`: decision 32, run 12, counsel answer 18, findings chunk n + 5, any other write 10; weights are at least the measured rows). Refusals are HTTP 429 (reasons `memory_write_budget`, `workspace_request_limit`, `workspace_run_limit`, `workspace_finding_limit`) and write 0 rows. Sessions: 5 per IP hash and 300 global per UTC day (`SESSION_CAPS`), at most about 130 rows each including the seed copy and a lazy purge slot. Quota claims THROW on a D1 error and return `ok:false` only at cap (fail closed). The breaker is persisted in `app_meta` (`breaker:{day}`).

Storage and retention: D1 schema version 5 (`app_meta.schema_version`, migrations 0001-0005; 0005 adds demo-write-block triggers). Only snippets, hashes and metadata are stored (never `detail.facts` or `explanation`). Purge runs from a daily cron (`triggers.crons` `17 3 * * *`) plus lazy slots at session start: sandbox workspaces after 30 days (demo workspace exempt), `quota_counter` after 2 days, `ai_cache` after 7 days; set-based child-first deletes with LIMITs. `wrangler.jsonc` still carries the placeholder all-zero `database_id`; the real D1 is created and migrated in Phase 10.

D1 Free budget: the binding limit is `rows_written` at 100k/day. Corrected worst case (review N11): days 1-30 about 84-96k/day, steady state from day 31 under simultaneous max abuse of all caps about 140-170k/day, because purge DELETEs mirror rows written 30 days earlier. Effect is availability only (writes refused until UTC reset, app fails closed). Accepted risk until Turnstile is live. Phase 10 must re-measure remotely and, if needed, lower `SESSION_CAPS.globalPerDay` or `rowBudgetPerDay` so 2 x (memory + sessions + AI) is at most about 90k. Any new write path needs a weight and a `rows-written` assertion.

Client contract notes: the web outbox (Phase 08) must treat 429 `memory_write_budget` and `workspace_*_limit` as a soft failure and retry next UTC day. Core `limits.findingsChunk` should align to the server cap of 25.

Phase 10 preconditions: apply migrations 0001-0005 to the remote D1 and set the real `database_id`; set `TURNSTILE_SECRET` (without it the global 300/day session cap is exhaustible by about 60 IPs); re-measure `rows_written` remotely for the decision, session and AI paths; decide the open N11/N12 hardening (AI refused requests still write about 6-12 claim/refund rows).

## Secrets (names only; set with `wrangler secret put`, never in the repo or logs)

Set on the live Worker: `COOKIE_SIGNING_KEYS` (JSON map kid to key), `COOKIE_SIGNING_KID`, `OPENROUTER_API_KEY` (from `~/.config/openrouter/credentials.env`). Not set yet: `TURNSTILE_SECRET` (widget arrives with 04b/05). Local dev uses gitignored `.dev.vars`.

## Deploy Rules And Redeploy Recipe

- Live: https://aduin-transaction-web.giathaowork.workers.dev (workers.dev subdomain `giathaowork`; active version `9dcf2f75-d8ac-419f-b33b-5a2525847ae7`). AI is fail-closed until the D1 platform is deployed (Phase 10) and the Turnstile widget lands (05).
- Hard rules: only `aduin-transaction-*` names on workers.dev/pages.dev; never touch zone `itsjiathao.com`; no route or custom domain; Workers Free only; `git push` needs user OK. Run `pnpm guard:cf && pnpm secrets:scan` before every deploy.
- Recipe until Phase 10: (1) `pnpm --filter @aduin/web build` (a plain build, not `build:e2e`; `no-e2e-hook-in-dist` proves it); (2) the committed `wrangler.jsonc` binds D1 with a placeholder all-zero id that `wrangler deploy` cannot resolve, so generate a temporary config that is the committed file minus `d1_databases` and `$schema`, with `main` and `assets.directory` paths rebased, under the gitignored `apps/worker/.wrangler/`; assert it has no routes/custom_domain/zone keys and the name starts with `aduin-transaction-`; (3) `wrangler deploy -c <that file>`; (4) delete the temporary file. Phase 10 creates the real D1 and replaces the placeholder id, after which plain `wrangler deploy` works.
- Verify: `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` (https `*.workers.dev` only).

## Known Gaps

- Real workerd CPU and hold-open timing, OpenRouter accounting of aborted/4xx requests, and the served-model string format are unproven (Phase 05/10 live probe).
- `x-aduin-doc` is client-attested (04a F4) and stays untrusted. 04a F5 (claim throws on storage errors) and F14 (breaker persisted) are done in 04b.
- D1 daily-rows risk N11 (accepted until Turnstile is live) and N12 (AI refusals write 6-12 rows): see the Memory API section and `process/general-plans/backlog/core-followups_17-10-26/`.
- `GET /api/health` lacks `cache-control: no-store`.

## Source Paths

- `apps/worker/{wrangler.jsonc,migrations,seed,src/**,test/**}`, `scripts/src/{slice-check.ts,seed/**}`
- `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04a-worker-proxy_{PLAN,REPORT}_17-10-26.md`, and `.../subdoc-qa-mvp_PHASE-04b-d1-memory-api_{PLAN,REPORT}_17-10-26.md` (fix cycles 1-3, `harness/phase-04b/`)
- `packages/core/src/config/limits.ts`, `packages/core/src/contracts/`

## Update Triggers

Pipeline or refund-policy change, new route, new env var or secret, limit change, D1 platform wired (04b), Turnstile widget added, deploy recipe change, custom domain decision.

## Routing

No deeper docs yet. Tests: `process/context/tests/all-tests.md`. Engine contracts: `process/context/engine/all-engine.md`.
