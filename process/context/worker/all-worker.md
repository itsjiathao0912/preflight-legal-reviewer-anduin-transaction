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

Last updated: 2026-10-17 (Phase 10 UPDATE PROCESS; code HEAD f0d924b plus the process commit)

Entrypoint for the `worker/` context group (one doc for now). Read this before touching `apps/worker`, `/api/*`, limits, or a deploy.

## Scope

Covers: what `apps/worker` contains, the AI/OCR proxy pipeline, refund policy, limits, config/env names, secret names (names only, never values), deploy rules and the redeploy recipe.

Does not cover: engine detectors and frozen contracts (`process/context/engine/all-engine.md`), test commands (`process/context/tests/all-tests.md`), the D1 schema DDL (`subdoc-qa-mvp_DATA-MODEL_17-10-26.md` in the program task folder; migrations are in `apps/worker/migrations/`). The memory API summary below is the durable part.

## What The Worker Is

One Worker, `aduin-transaction-web` (`apps/worker/wrangler.jsonc`, Free plan, `workers_dev: true`, no routes, no custom domain). It serves the built SPA from `apps/web/dist` as static assets (`ASSETS`, SPA fallback, `run_worker_first: ["/api/*"]`) and `/api/*` from code. **The Worker never parses documents**; parsing runs in the browser engine. It only proxies AI/OCR calls to OpenRouter.

Routes (live in M1): `GET /api/health` (static `{ok:true}`, `no-store`), `GET /api/quota`, `POST /api/ai`, `POST /api/ocr` (PDF mime is rejected 415). Phase 06 OCR contract (code on main, NOT yet deployed): prompt version `ocr2` (`PROMPT_VER.ocr`, `models-config.ts`); markers and checkboxes travel inside line text; the model-facing OCR JSON schema omits `ext` (the frozen client result keeps it); `shapeAi`/OCR shaping requires the decoded image bytes to start with JPEG `FFD8FF` or PNG `89504E47` (`hasImageMagic`, `guards.ts`) or answers 415 `unsupported_type` before any upstream call, so a PDF relabelled as an image is never sent to OpenRouter (test `ocr-never-sends-pdf`). Memory routes (Phase 04b, code-complete, not yet deployed) are listed in the Memory API section.

Source map (`apps/worker/src`): `app.ts` (createApp + AppDeps seams), `config.ts` (strict env parsing, fail closed), `routes/proxy/{ai,ocr,quota,index}.ts`, `proxy/{guards,pipeline,stream,errors,log,ports}.ts`, `limits/{clock,visitor,prelimit,policy}.ts`, `upstream/{openrouter,classify,models-config}.ts`, `identity/turnstile.ts`, `platform/{index,quota,cache,ledger,breaker,rules}.ts` (D1 platform, Phase 04b; with no D1 binding `unavailablePlatform()` still makes AI/OCR fail closed and quota fail-soft), `memory/**` (ctx, repo modules, proposal, purge, mask), `routes/memory/**`, `migrations/0001-0006`, `seed/demo.sql`.

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
10. OpenRouter call (`redirect: 'error'`, 240 s timeout, free models only) streamed as hold-open NDJSON (`{t:'hb'}` every 10 s, then one terminal `result` or `error` frame).
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

Write caps (`platform/index.ts`, UTC day windows): per workspace 600 mutating requests, 40 runs, 2000 findings; global weighted row budget 30,000 units/day (`MEMORY_WRITE_WEIGHTS`: decision 32, run 12, counsel answer 18, findings chunk n + 5, any other write 10; `counselAnswerWithAssertion` 23, picked by `postEntry` only when `assertion` is a non-null object; weights are at least the measured rows). Refusals are HTTP 429 (reasons `memory_write_budget`, `workspace_request_limit`, `workspace_run_limit`, `workspace_finding_limit`) and write 0 rows. Sessions: 5 per IP hash and 300 global per UTC day (`SESSION_CAPS`), at most about 130 rows each including the seed copy and a lazy purge slot. Quota claims THROW on a D1 error and return `ok:false` only at cap (fail closed). The breaker is persisted in `app_meta` (`breaker:{day}`).

Storage and retention: D1 schema version 6 locally (`app_meta.schema_version`, migrations 0001-0006; 0005 adds demo-write-block triggers; 0006 is Variance, see below). The LIVE D1 is still at 5 until Variance Phase 05 applies 0006. Only snippets, hashes and metadata are stored (never `detail.facts` or `explanation`). Purge runs from a daily cron (`triggers.crons` `17 3 * * *`) plus lazy slots at session start: sandbox workspaces after 30 days (demo workspace exempt), `quota_counter` after 2 days, `ai_cache` after 7 days; set-based child-first deletes with LIMITs. `wrangler.jsonc` still carries the placeholder all-zero `database_id`; the real D1 is created and migrated in Phase 10.

D1 Free budget: the binding limit is `rows_written` at 100k/day. Corrected worst case (review N11): days 1-30 about 84-96k/day, steady state from day 31 under simultaneous max abuse of all caps about 140-170k/day, because purge DELETEs mirror rows written 30 days earlier. Effect is availability only (writes refused until UTC reset, app fails closed). Accepted risk until Turnstile is live. Phase 10 must re-measure remotely and, if needed, lower `SESSION_CAPS.globalPerDay` or `rowBudgetPerDay` so 2 x (memory + sessions + AI) is at most about 90k. Any new write path needs a weight and a `rows-written` assertion.

Client contract notes: the web outbox (Phase 08) must treat 429 `memory_write_budget` and `workspace_*_limit` as a soft failure and retry next UTC day. Core `limits.findingsChunk` should align to the server cap of 25.

Phase 10 (DONE 17-10-26): the real D1 `aduin-transaction-db` (id `5f0d76d8-ad88-4a0b-80eb-cff716c10eca`, APAC) is live with migrations 0001-0005 (schema version 5), the demo seed (3 law firms, 1 workspace, 3 firm rules, 8 decisions) and `TURNSTILE_SECRET` set. Remote `rows_written` baseline was 238 on the first day (migrations + seed); the D4 burst was not run (no human session), so caps are unchanged (`SESSION_CAPS.globalPerDay` 300, `MEMORY_WRITE_CAPS.rowBudgetPerDay` 30000) and the burst re-measure is an operator item (`process/general-plans/backlog/phase10-d4-rows-written-burst_NOTE_17-10-26.md`). N11/N12 hardening decision stays open.

## Secrets (names only; set with `wrangler secret put`, never in the repo or logs)

Set on the live Worker: `COOKIE_SIGNING_KEYS` (JSON map kid to key), `COOKIE_SIGNING_KID`, `OPENROUTER_API_KEY` (from `~/.config/openrouter/credentials.env`), `TURNSTILE_SECRET` (set 17-10-26 from a mode-600 scratch file piped to `wrangler secret put`, then deleted). The Turnstile widget `aduin-transaction-web` (managed, hostname `aduin-transaction-web.giathaowork.workers.dev` only) exists; its public site key is compiled into the web build via `VITE_TURNSTILE_SITE_KEY` (the Worker config `TURNSTILE_SITE_KEY` is optional and unused). Secret set with no compiled key makes memory and AI fail closed. Local dev uses gitignored `.dev.vars`.

## Deploy Rules And Redeploy Recipe

- Live: https://aduin-transaction-web.giathaowork.workers.dev (workers.dev subdomain `giathaowork`; active version `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f` (Fund Package Intake web assets from main a4d7a34; Worker code 994ea54 is unchanged by Intake), 17-10-26; rollback chain `cde74507-7b92-4e43-99fa-754de2c5cf3b` -> `328ca295-d5da-487e-a063-843b0c7c86db` -> `09e7a579` -> `47d98295-c583-4dc0-9f96-f9e161c8cf35` -> `23612b12-51c7-4d75-a324-f4f2f6392ba8` (render-first fix af59da6; older: `67c796ff` first go-live with the Turnstile-blocking render bug, `4325e4e4`). Live checks (re-run on 3d2c7301: health no-store, CSP byte-identical to `_headers`, stack slice, package smoke 8/8): CSP and security headers on `/`, `/api/health` 200 `no-store`, `/api/memory/health` schema 5, stack smoke 1 passed (zero upstream AI/OCR calls), findings in about 1 s on #5/#3/#1 with no Turnstile overlay and no `/api/session` call. Phase 04b, 05, 06 and 10 code is deployed; AI and OCR need a Turnstile token, so they work only for a human in a real browser (automated Chromium gets no token, residual R2).
- Hard rules: only `aduin-transaction-*` names on workers.dev/pages.dev; never touch zone `itsjiathao.com`; no route or custom domain; Workers Free only; `git push` needs user OK. Run `pnpm guard:cf && pnpm secrets:scan` before every deploy.
- Recipe (plain `wrangler deploy`, since the real D1 id is committed): (1) `pnpm guard:cf && pnpm secrets:scan`; (2) plain build with the public site key inline, per command, never exported or committed: `VITE_TURNSTILE_SITE_KEY=<site key> pnpm --filter @aduin/web build` (not `build:e2e`; any Playwright `stack` run rebuilds the e2e bundle into the same output, so always rebuild plain right before deploying); (3) `pnpm --filter @aduin/scripts deploy:preflight` (13 checks: `_headers` present, site key compiled in, no e2e hook marker, no routes or zone keys); (4) `pnpm --filter @aduin/worker exec wrangler deploy` (a CF API 10500 on the deployments call happened once; a retry succeeded and live stays on the old version meanwhile). Rollback: `wrangler rollback <version>`; `wrangler secret delete TURNSTILE_SECRET`; delete the widget by site key (manual); drop the D1 only on a full teardown.
- **Render-first rule:** the web client must never await the session bootstrap or Turnstile before rendering deterministic findings (EVL found firm documents blocked for 172 s on a failing challenge, fixed in af59da6). Memory, AI-rules lookup and outbox flush run in the background; a failed bootstrap is cached 60 s.
- **Scripts guard rails:** live scripts under `scripts/src/{live,conformance,deploy,screenshots}` use an https `*.workers.dev` allow-list and a Cloudflare REST allow-list (GET `workers/scripts`, `d1/database`, `challenges/widgets`; POST `challenges/widgets`; never `/zones`), a call ledger with a cap (O_EXCL lock) and stop on non-free or cost > 0 frames.
- Verify: `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` (https `*.workers.dev` only).

## AI Result Meta Echo and Memory Client Expectations (Phase 08, commit 8bdf1aa)

- **L5 echo:** the AI result frame (cache hit and miss) carries `meta: {rules_hash8, rules_applied, rules_total}`. With no rules (no workspace, read-only cookie, no firm, or a firm with 0 active rules) the values are `'none'`, 0, 0. Only counts and the 8-char hash prefix are emitted, never rule text. OCR frames are unchanged. The web client compares the echo with the hash it expected; a mismatch drops cached rule texts and downgrades with `rules_changed` (Retry re-reads rules); a missing expected hash on a writable firm session downgrades with `rules_unavailable` before `/api/ai` (review F7). Test: `apps/worker/test/llm/rules-echo.test.ts`.
- **Client expectations of the memory API** (real client `apps/web/src/api/realMemoryApi.ts` plus outbox): `POST /api/session` is called lazily, once, before the first memory call (not at startup, so a no-D1 local stack stays quiet); a 503 bootstrap makes the client keep triage local and enqueue nothing. Writes are idempotent (`INSERT OR IGNORE` on duplicate finding ids; the budget is still claimed). The server refuses cross-workspace operations; the client also stamps `workspace_id` on every queued op and rejects it at drain with `workspace_changed` if the workspace changed (F2). `unavailable` / `unauthorized` retry up to 6 attempts, then the op parks until reload or `online`. Terminal ops are scrubbed and purged after 24 h. Export never depends on memory: the DOCX downloads even if memory writes 503 (F1).

## Known Gaps

- Real workerd CPU and hold-open timing at `max_tokens` 10000 and OpenRouter accounting of aborted/4xx requests are still unproven: the Phase 10 live AI sweep did not run (R2, backlog `phase10-live-ai-sweep-operator_NOTE_17-10-26.md`). Measured instead: Worker CPU p50 1.6 ms / p99 16 ms over 116 requests, 0 errors (p99 above the 10 ms Free limit, backlog `phase10-worker-cpu-p99`); AC39 matrix 7/7 rejected; 429 after 30 requests (AC40). AI 0 of 6, OCR 0 of 6 live calls used in Phase 10, $0. The served-model string was observed in Phase 05: `nvidia/nemotron-3-super-120b-a12b:free`, `json_schema` accepted (3 of 8 live calls used, $0).
- Phase 05 follow-ups in the backlog: the L5 echo is DONE (Phase 08); live-model quality (2 of 4 quotes unlocatable on sample #3; counsel drafts echo clause text) is a Phase 10 sweep.
- `x-aduin-doc` is client-attested (04a F4) and stays untrusted. 04a F5 (claim throws on storage errors) and F14 (breaker persisted) are done in 04b.
- D1 daily-rows risk N11 (accepted until Turnstile is live) and N12 (AI refusals write 6-12 rows): see the Memory API section and `process/general-plans/backlog/core-followups_17-10-26/`.
- `GET /api/health` now returns `cache-control: no-store` (Phase 10); HEAD returns 404 (GET-only route).
- The deployed Worker now runs the `ocr2` prompt/schema (first deployed 17-10-26 in version `2a3e0f34-6e01-4cff-b2ed-27cd62a6deb7`; still in force in `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f`). Rule kept for later redeploys: deploy the Worker before the web bundle (F12), otherwise a new web client talks to an old OCR contract. OCR live usage so far: 27 of 30 APPROVED-LIVE free requests at $0 (precompute only; the Worker path was not exercised live).

- **Fund Package Intake (17-10-26) changed no Worker code, route, secret, D1 migration or limit.** Package members never leave the browser (no member text in any URL or body; proven by `stack-memory-package-privacy`); the only package-related calls are the existing session, memory and quota APIs. Live version 3d2c7301 is static-assets-only versus cde74507.

- **Variance Phase 03 (18-10-26, local only; nothing deployed):** migration `0006_variance.sql` (`schema_version` 6) adds nullable `owner`/`owner_source` on `counsel_question`, `intent`/`scope` on answers and decisions, one append-only `regression_check` table (`WITHOUT ROWID`, composite FK to the answer so a check cannot point at another workspace, cap trigger of 20 active per firm per workspace), the new audit action `regression_check_created`, and three reference firms (`hartwell-crane`, `ostrander-pell`, `calder-reyes`; `law-firms.json` now has six; `REFERENCE_0003_FIRM_IDS` stays the original three so `0003` stays byte-identical). Guard triggers `decision_guard_update` and `answer_guard_update` are recreated with the new columns immutable, and the two `demo_ro_*_update` triggers are recreated after them (SQLite fires the newest trigger first). New trigger texts (`question_owner_immutable`, `regression_check_immutable`, `regression_check_append_only`, cap) map to a typed 400 `invalid_request` with reason = trigger text (`TRIGGER_INVALID_REQUEST` in `db/tx.ts`, one branch in `memory/http.ts`). The migration is NOT idempotent: a partial remote apply cannot be re-run, so Phase 05 records a Time Travel bookmark first.
- **Variance memory API (additive, no new route):** `POST /api/memory/lookup` also returns `regression_checks` (same workspace AND firm only; `lookup_200` budget is now 3 calls). `POST /api/counsel/answers` accepts optional `intent`, `scope`, `assertion` (kind `scope_exists` only; statement text is built server-side from the normalized label, never client text; an intent that is empty after masking is refused). `POST /api/counsel/questions` accepts `owner` and `owner_source` (default `suggested`). Core `resolveLabel(..., ctx?)` and `scopeMismatch` in `packages/core/src/memory/label.ts` apply the fund scope at both call sites; the web client label ignores fund scope until Variance Phase 04 passes `fundName` from `state/review.ts`. Measured weights (local D1): plain answer 13 rows, with assertion 18. Findings bodies are split by bytes in the web client (cap 131,072 B; worst-case finding 82,236 B).
- **Known limitations (backlog):** one active decision per (workspace, firm, fingerprint), so a fund-scoped answer in fund B supersedes fund A's (`variance-fund-scope-supersede_NOTE_17-10-26.md`); no revoke path, 20 active checks per firm is a hard ceiling (`variance-regression-check-revoke_NOTE_17-10-26.md`). Rollback rule: never roll back the Worker alone after the web bundle ships (an older Worker silently drops assertion, scope and intent).

## Source Paths

- `apps/worker/{wrangler.jsonc,migrations,seed,src/**,test/**}`, `scripts/src/{slice-check.ts,seed/**}`
- `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04a-worker-proxy_{PLAN,REPORT}_17-10-26.md`, and `.../subdoc-qa-mvp_PHASE-04b-d1-memory-api_{PLAN,REPORT}_17-10-26.md` (fix cycles 1-3, `harness/phase-04b/`)
- `packages/core/src/config/limits.ts`, `packages/core/src/contracts/`

## Update Triggers

Pipeline order, task registry or prompt version, refund-policy change, new route, new env var or secret, limit change, D1 platform wired (04b), Turnstile widget added, deploy recipe change, custom domain decision.

## Routing

No deeper docs yet. Tests: `process/context/tests/all-tests.md`. Engine contracts: `process/context/engine/all-engine.md`.
