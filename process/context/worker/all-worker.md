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

Last updated: 2026-10-17 (Phase 05 UPDATE PROCESS; HEAD f0f476c plus the process commit)

Entrypoint for the `worker/` context group (one doc for now). Read this before touching `apps/worker`, `/api/*`, limits, or a deploy.

## Scope

Covers: what `apps/worker` contains, the AI/OCR proxy pipeline, refund policy, limits, config/env names, secret names (names only, never values), deploy rules and the redeploy recipe.

Does not cover: engine detectors and frozen contracts (`process/context/engine/all-engine.md`), test commands (`process/context/tests/all-tests.md`), the D1 schema DDL (`subdoc-qa-mvp_DATA-MODEL_17-10-26.md` in the program task folder; migrations are in `apps/worker/migrations/`). The memory API summary below is the durable part.

## What The Worker Is

One Worker, `aduin-transaction-web` (`apps/worker/wrangler.jsonc`, Free plan, `workers_dev: true`, no routes, no custom domain). It serves the built SPA from `apps/web/dist` as static assets (`ASSETS`, SPA fallback, `run_worker_first: ["/api/*"]`) and `/api/*` from code. **The Worker never parses documents**; parsing runs in the browser engine. It only proxies AI/OCR calls to OpenRouter.

Routes (live in M1): `GET /api/health` (static `{ok:true}`, no `no-store` yet), `GET /api/quota`, `POST /api/ai`, `POST /api/ocr` (PDF mime is rejected 415). Phase 06 OCR contract (code on main, NOT yet deployed): prompt version `ocr2` (`PROMPT_VER.ocr`, `models-config.ts`); markers and checkboxes travel inside line text; the model-facing OCR JSON schema omits `ext` (the frozen client result keeps it); `shapeAi`/OCR shaping requires the decoded image bytes to start with JPEG `FFD8FF` or PNG `89504E47` (`hasImageMagic`, `guards.ts`) or answers 415 `unsupported_type` before any upstream call, so a PDF relabelled as an image is never sent to OpenRouter (test `ocr-never-sends-pdf`). Memory routes (Phase 04b, code-complete, not yet deployed) are listed in the Memory API section.

Source map (`apps/worker/src`): `app.ts` (createApp + AppDeps seams), `config.ts` (strict env parsing, fail closed), `routes/proxy/{ai,ocr,quota,index}.ts`, `proxy/{guards,pipeline,stream,errors,log,ports}.ts`, `limits/{clock,visitor,prelimit,policy}.ts`, `upstream/{openrouter,classify,models-config}.ts`, `identity/turnstile.ts`, `platform/{index,quota,cache,ledger,breaker,rules}.ts` (D1 platform, Phase 04b; with no D1 binding `unavailablePlatform()` still makes AI/OCR fail closed and quota fail-soft), `memory/**` (ctx, repo modules, proposal, purge, mask), `routes/memory/**`, `migrations/0001-0005`, `seed/demo.sql`.

## Pipeline Order (`proxy/pipeline.ts`)

1. Header-only guards (origin, `x-aduin-client: 1`, content type, body caps).
2. In-isolate pre-limit (30 req/min, 6 AI req/min per IP; no subrequest).
3. Body read, parse, shape (open-proxy whitelist; client-supplied model/plugins/provider/tools/max_tokens dropped or rejected; images only as `data:image/(png|jpeg|webp);base64`). For AI, `shapeAi` passes `task` (default `clause-judgment`) and applies a server-side idempotent `mask(text, sensitiveSpans(text))` to candidate quotes.
4. Identity: signed visitor cookie `__Host-aduin_v` (Secure, HttpOnly, SameSite=Lax; minted on the first `/api/*` call).
5. Firm rules (AI only): resolved only when the cookie has `w`, `a !== 'ro'` and the request carries `law_firm_id`; otherwise no rules (hash `none`). A failed rules read, or no rules store while rules are needed, refuses with 503 `memory_unavailable` / reason `rules_unavailable` before any claim or upstream call.
6. Messages and key: `TASKS[task].buildMessages(...)` (core `llm/`), core `inputHash(messages)`, cache key = `inputHash` + the task's `promptVersion` + `schemaVersion` + the injected `rules_hash`.
7. Cache read. A HIT costs zero claims, zero writes, zero upstream calls (a HIT with firm rules still costs the one rules read).
8. Turnstile (token in header `x-aduin-turnstile`; fails closed with 401 `invalid_session`).
9. Ordered claims: visitor (req, fresh-doc v + IP, OCR pages) then global provider counter (always claimed last) then spend reservation.
10. OpenRouter call (`redirect: 'error'`, 120 s timeout, free models only) streamed as hold-open NDJSON (`{t:'hb'}` every 10 s, then one terminal `result` or `error` frame).
11. Classify (task-aware: `parseContent` for prose/fences, then `task.validate` is the only validation; `finish_reason: 'length'` = malformed, claims kept, nothing cached), cache write, ledger write, terminal frame.

Pre-stream refusals are HTTP via `errorStatus(code)` with body `{error:{code,message,reason?,retry_after_s?}}`; failures after the stream opens are terminal `error` frames with the same fields. Clients must handle both. Budget: at most 13 port calls per AI request (`proxy-budget`: workspace + firm MISS 9, workspace + firm HIT 2 = rules read + cache get, no-firm HIT 1, a rules read failure 1).

## Refund Policy (DV10)

| Cause | Visitor claims | Global + spend |
|---|---|---|
| refusal before dispatch, pre-dispatch abort, non-consuming 4xx (400/401/403/413/415/422) | refunded | refunded |
| client abort after dispatch | kept | kept |
| provider fault after dispatch (network, 5xx, 429, 402) | refunded | kept |
| upstream timeout (review M2: the call may still have consumed provider budget) | kept | kept |
| malformed output, 200-with-error body | kept | kept |

## Limits And Config

Defaults live in `packages/core/src/config/limits.ts` (the single source); env vars override. Per visitor per UTC day: 3 fresh-AI documents (D-4), 8 AI requests, 6 OCR pages. Global cap = min(`globalProviderReqsPerDay`, `PROVIDER_ALLOWANCE_PER_DAY` default 50). Spend cap `SPEND_CAP_MICRO_USD` (paid path disabled; `PAID_FALLBACK_ENABLED=false`). Body caps: AI 128 KiB, OCR 700 KiB, other 64 KiB. AI output budget: one `AI_MAX_TOKENS = 10000` in core `packages/core/src/llm/wire.ts`, used by the Worker `MAX_TOKENS.ai` and by the scripts request builder (live sample #3 used 5783 output tokens, so 6000 was too tight). Firm rules in the prompt: at most 20 rules, 500 code points each, 4096 bytes total (core `llm/rules.ts`). Active rules per firm per workspace: the rules read is `LIMIT 101` and creating or approving the 101st active rule is refused with 429 `quota_exhausted` / reason `active_rule_cap` (cap is 100). Windows reset at UTC midnight.

Plain vars in `wrangler.jsonc`: `PAID_FALLBACK_ENABLED`, `OPENROUTER_BASE_URL` (must be https `openrouter.ai`), `AI_TEXT_MODELS` (a single free text model, `nvidia/nemotron-3-super-120b-a12b:free`), `AI_RESPONSE_MODE` (`json_schema` default; only `json_schema` or `json_object` allowed, anything else is a `ConfigError`), `AI_VISION_MODELS` (every id must end in `:free`; `openrouter/*` router ids rejected), `AI_UPLOADS_ENABLED` (exact string `true`). Other optional vars: `AI_PAID_MODELS`, `VISITOR_AI_DOCS_PER_DAY`, `VISITOR_AI_REQS_PER_DAY`, `VISITOR_OCR_PAGES_PER_DAY`, `PAID_MAX_COST_MICRO_USD`, `VISITOR_COOKIE_TTL_S`, `TURNSTILE_PASS_TTL_MS`, `TURNSTILE_SITE_KEY`. Invalid config throws `ConfigError` and the proxy degrades without any upstream call.

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

Set on the live Worker: `COOKIE_SIGNING_KEYS` (JSON map kid to key), `COOKIE_SIGNING_KID`, `OPENROUTER_API_KEY` (from `~/.config/openrouter/credentials.env`). Not set yet: `TURNSTILE_SECRET` (the web widget loader is a Phase 10 item; Phase 05 shipped only the token-provider seam). Local dev uses gitignored `.dev.vars`.

## Deploy Rules And Redeploy Recipe

- Live: https://aduin-transaction-web.giathaowork.workers.dev (workers.dev subdomain `giathaowork`; active version `a258f588-85d5-4970-affa-0ffb1eb938bb`, preview redeploy of code dca6a45 plus the Phase 06 closeout, i.e. HEAD e5fd10e, on 17-10-26; live smoke: `/` 200, `/api/health` ok, image-magic 415 on `/api/ocr`, stack slice 1/1, zero upstream `/api/ai` and `/api/ocr` calls). Phases 04b, 05 and 06 Worker code is now deployed. AI is fail-closed until the D1 platform is deployed (Phase 10) and the Turnstile widget lands (Phase 10).
- Hard rules: only `aduin-transaction-*` names on workers.dev/pages.dev; never touch zone `itsjiathao.com`; no route or custom domain; Workers Free only; `git push` needs user OK. Run `pnpm guard:cf && pnpm secrets:scan` before every deploy.
- Recipe until Phase 10: (1) `pnpm --filter @aduin/web build` (a plain build, not `build:e2e`; `no-e2e-hook-in-dist` proves it); (2) the committed `wrangler.jsonc` binds D1 with a placeholder all-zero id that `wrangler deploy` cannot resolve, so generate a temporary config that is the committed file minus `d1_databases` and `$schema`, with `main` and `assets.directory` paths rebased, under the gitignored `apps/worker/.wrangler/`; assert it has no routes/custom_domain/zone keys and the name starts with `aduin-transaction-`; (3) `wrangler deploy -c <that file>`; (4) delete the temporary file. Phase 10 creates the real D1 and replaces the placeholder id, after which plain `wrangler deploy` works.
- Verify: `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` (https `*.workers.dev` only).

## Known Gaps

- Real workerd CPU and hold-open timing at `max_tokens` 10000 and OpenRouter accounting of aborted/4xx requests are unproven (Phase 10 probe). The served-model string was observed in Phase 05: `nvidia/nemotron-3-super-120b-a12b:free`, `json_schema` accepted (3 of 8 live calls used, $0).
- Phase 05 follow-ups in the backlog: the Worker should echo `meta.rules_hash8` / `rules_applied` (L5), and live-model quality (2 of 4 quotes unlocatable on sample #3; counsel drafts echo clause text) is a Phase 10 sweep.
- `x-aduin-doc` is client-attested (04a F4) and stays untrusted. 04a F5 (claim throws on storage errors) and F14 (breaker persisted) are done in 04b.
- D1 daily-rows risk N11 (accepted until Turnstile is live) and N12 (AI refusals write 6-12 rows): see the Memory API section and `process/general-plans/backlog/core-followups_17-10-26/`.
- `GET /api/health` lacks `cache-control: no-store`.
- The deployed Worker now runs the `ocr2` prompt/schema (redeployed 17-10-26, version `a258f588-85d5-4970-affa-0ffb1eb938bb`). Rule kept for later redeploys: deploy the Worker before the web bundle (F12), otherwise a new web client talks to an old OCR contract. OCR live usage so far: 27 of 30 APPROVED-LIVE free requests at $0 (precompute only; the Worker path was not exercised live).

## Source Paths

- `apps/worker/{wrangler.jsonc,migrations,seed,src/**,test/**}`, `scripts/src/{slice-check.ts,seed/**}`
- `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04a-worker-proxy_{PLAN,REPORT}_17-10-26.md`, and `.../subdoc-qa-mvp_PHASE-04b-d1-memory-api_{PLAN,REPORT}_17-10-26.md` (fix cycles 1-3, `harness/phase-04b/`)
- `packages/core/src/config/limits.ts`, `packages/core/src/contracts/`

## Update Triggers

Pipeline order, task registry or prompt version, refund-policy change, new route, new env var or secret, limit change, D1 platform wired (04b), Turnstile widget added, deploy recipe change, custom domain decision.

## Routing

No deeper docs yet. Tests: `process/context/tests/all-tests.md`. Engine contracts: `process/context/engine/all-engine.md`.
