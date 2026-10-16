---
name: plan:subdoc-qa-mvp-phase-04b-d1-memory-api
description: "Sub-doc QA MVP — Phase 04b: D1 schema and migrations, platform ports (SQL), session/workspaces, memory repository and endpoints, audit, rules, purge, demo seed"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-04b
---

# Phase 04b — D1 Schema, Platform Ports, Session, Memory Endpoints, Seed

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ✅ CODE DONE (EXECUTE 17-10-26; EVL + reviewer pending)
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ✅ CODE DONE — awaiting EVL and the independent reviewer decision
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04b-d1-memory-api_REPORT_17-10-26.md

---

## Overview

D1 becomes the system of record for Review Memory (DATA-MODEL, **20 tables**). This phase is the **single owner of all SQL**: migrations 0001–0004, the D1 implementation of the platform ports used by Phase 04a (`quota`, `cache`, `ledger`, `breaker`) and Phase 05 (`rules`), the workspace-scoped repository, the session/cookie endpoint with sandbox creation from the demo seed, memory endpoints (lookup, runs, findings chunks, decisions, revoke, counsel questions/answers, rules, firm memory, audit, export metrics), lazy retention purge plus a daily `scheduled()` purge, rule-proposal-on-write, and the demo seed generator. Every statement binds `workspace_id`; append-only is enforced by triggers; at most one active decision per (workspace, firm, fingerprint). It starts with spikes S5, S8 (S9, remote S8 and S10 after migration B1; Step A ordering below). Definitions are in Phase 00. Context routers: `process/context/all-context.md`, `process/context/tests/all-tests.md`, `process/context/worker/all-worker.md`, `process/context/engine/all-engine.md`; design source: `subdoc-qa-mvp_DATA-MODEL_17-10-26.md`.

Inputs carried from Phase 04a (contract notes F4/F5/F14/DV1) and the backlog core-followups (R1, F7): quota claim throws on storage error and returns `ok:false` only at cap (F5); `BreakerPort` persisted with fail-closed read (F14); `MEMORY_LABELS` parity against the applied CHECK (F7); R1 unmasked `detail.facts`/`explanation` never persisted. DV1 decision: the per-IP request counter is NOT re-added (04a reviewer ACCEPT, zero spend exposure on free-only); the 12-call `proxy-budget` stays on fakes and the D1 `query-budget` gate bounds the real AI path.

## Phase Completion Rules

- CODE DONE = migrations, repo, endpoints, tests committed.
- VERIFIED = Exit Gate green on local D1 (`@cloudflare/vitest-plugin`, real SQLite), validate-contract written, spike verdicts S5/S8/S9/S10 recorded (remote ones run under the conditional APPROVED-REMOTE below; else INCONCLUSIVE-LOCAL with the pre-adopted fallbacks), regression: Phase 01 vectors, Phase 04a proxy suite, seams green.
- Remote migration of the real `aduin-transaction-db`, its creation, the remote seed and the production redeploy with D1 happen in Phase 10, not here (record: the user authorized workers.dev deploys of `aduin-transaction-*` resources; that authorization is exercised in Phase 10).

### APPROVED-REMOTE (conditional, spike resources only)

Remote actions in this phase are limited to the throwaway D1 `aduin-transaction-spike-db` and Workers named `aduin-transaction-spike-*` on workers.dev, under these constraints:

- Check the account workers.dev subdomain first; never register one. No routes, no custom domain, never zone `itsjiathao.com`.
- Spike Workers receive no secrets of any kind (no `OPENROUTER_API_KEY`, no `TURNSTILE_SECRET`, no cookie keys).
- Credentials are loaded only with `set -a; source ~/.config/cloudflare/credentials.env; set +a  # APPROVED:credentials.env` and never printed.
- After the runs: delete the spike D1 and Workers, then list-confirm absence (`wrangler d1 list`, `wrangler deployments`/account Worker list). Placeholder `database_id` in `wrangler.jsonc` untouched. No git push.
- If the account/credential step is denied or fails, record `INCONCLUSIVE-LOCAL` and adopt the pre-adopted fallbacks.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC42 | Every decision stored with full record, append-only (UPDATE/DELETE fail) | `decision-record-contract` (exhaustive `test.each`: decision type x reason x option, no fast-check dependency) + `decision-append-only` | Fully-Automated | — |
| AC47 | Memory never crosses firms or workspaces (including `RulesPort`) | `memory-no-cross-firm-or-workspace` (API integration; two workspaces, two firms, composite-FK cross-insert), `rules-port-scoped` | Fully-Automated | browser e2e in P08 |
| AC50 [P1] | Reopen revokes (kept, audited) and the finding reappears as New | `memory-reopen-integration` (revoke endpoint + lookup) | Fully-Automated | UI e2e `memory-reopen-e2e` in P08b |
| AC53 [P1] | ≥ 3 same-pattern, same-reason dismissals propose a rule; 2, or 3 with different reasons, or another firm, do not; rejected key re-proposed only on new evidence (D-5) | `rule-proposal-threshold-matrix` | Fully-Automated | UI in P08b |
| AC55 | Append-only audit trail (who, when, why; no edit/remove) | `audit-trail-append-only` (triggers + `GET /api/audit`) | Fully-Automated | viewer e2e closes P08 |
| AC56 | Per-visitor sandbox isolation; simulated analyst name; stale cookie gives 401 | `sandbox-isolation`, `stale-cookie-invalid-session` (two sessions) | Fully-Automated | browser e2e P08 |
| AC57 | Demo workspace seeded, protected, never bound to a cookie; sandbox is a copy | `demo-workspace-not-polluted` + `demo-seed-copy-effects` (seed → sandbox lookup shows prior decisions) | Fully-Automated | UI effects closes P08/P10 |
| AC58 | Server keeps only snippets, hashes, metadata; sensitive values masked (including free text, R1); retention purge; demo exempt | `memory-storage-contract` + `memory-retention-purge-test` + `cron-purge` | Fully-Automated | — |

Contributes: AC38 (server purge), AC41 (D1 firm list parity with `fixtures/memory/law-firms.json`; `MEMORY_LABELS` parity closes F7), AC43 (server lookup incl. revoked never matching), AC6 (DB CHECK: dismiss requires reason), AC40 (query budget assertions), AC39 (memory-route guards), AC26/AC39 fence (`ai-fail-closed-without-secrets`).

## Entry Gate

- Phase 00 and Phase 01 verified (contracts and ports frozen; cookie helper; vectors; `law-firms.json`); Phase 04a code done (proxy ports, guards, limits, test fakes).
- Phase 02 outputs (`demo-seed-spec.json`) are NOT required to start: this phase ships its own minimal `fixtures/memory/_test-seed-spec.json` and regenerates the real seed when Phase 02 lands (final regeneration in Phase 08/10, CI diff). The generator records which spec path it used (`demo-seed-spec.json` when present, else `_test-seed-spec.json`).

## Library pins (confirm via vc-docs-seeker in Phase 00)

wrangler (`d1 migrations apply`, `d1 execute --local`), D1 client API (`prepare`, `bind`, `batch`, `meta.rows_read`/`rows_written`), @cloudflare/vitest-plugin 1.4.4 (the repo package, successor of vitest-pool-workers: `readD1Migrations` from the plugin entry in `vitest.config.ts`; `applyD1Migrations`, `reset`, `createScheduledController` from `cloudflare:test`), @noble/hashes, zod. No new fast-check dependency in the worker.

## Step A spikes (ordering fixed)

- A1 local, on a draft schema: S5 (atomic counter via guarded upsert + RETURNING; first-claim-over-cap refused) and S8 (SQL surface: `json_each` single param, 100-param cap, partial unique index via EXPLAIN with `COVERING ` allowed in the regex, triggers with RAISE, WITHOUT ROWID + composite FKs, `PRAGMA defer_foreign_keys` in `db.batch`, trigger vs purge DELETE, shared 50-query budget, constraint-error message text for audit-UNIQUE vs `uq_decision_active`). A1 also records whether per-test storage is isolated under the plugin (`reset()`); tests use unique ids and one shared setup that applies migrations and the demo seed.
- A2 after B1 (needs the real DDL with its indexes) and before Step D: S9 (rows-written calibration on throwaway remote D1), remote S8, S10 (cold-start CPU of the memory path; validator choice), cron-on-Free availability. Verdicts are written to the SPIKE-RESULTS REF `## Spike verdicts` rows and checked with `pnpm --filter @aduin/scripts spike:check`.
- Fallbacks pre-adopted: chunked `IN` lists of 90; app-layer enforcement and tests instead of triggers; explicit child-first deletes; lazy purge only; findings persistence opt-in; session seed copy skipped (read-only demo).

## Touchpoints (create)

```
apps/worker/migrations/
  0001_reference_and_workspace.sql   app_meta, law_firm, law_firm_alias, issue_class, workspace, analyst, fund, document, review_run
  0002_memory_core.sql               decision (+indexes, triggers), finding, finding_state, counsel_question (own `id` column), counsel_answer, firm_rule, rule_evidence, audit_event (+triggers)
  0003_reference_seed.sql            law firms + aliases + issue classes, GENERATED from core ISSUE_CLASSES, LAW_FIRMS and normalizeFirmAlias
  0004_cache_quota_ledger.sql        ai_cache, quota_counter, spend_ledger
  (20 tables in total; ordering adjusted so foreign keys are created child-after-parent where practical; schema_version set last)
apps/worker/seed/demo.sql            generated, committed
apps/worker/src/db/{ids.ts,tx.ts,meta.ts (rows_read, rows_written, query counter)}
apps/worker/src/platform/{index.ts (createD1Platform(db, {capFor})),quota.ts,cache.ts,ledger.ts,breaker.ts,rules.ts (createRulesPort(db, workspaceId) only)}
apps/worker/src/memory/{ctx.ts,repo/{workspace,fund,document,run,finding,decision,counsel,rules,audit,purge,lookup}.ts,proposal.ts,seed-copy.ts,health.ts,mask.ts}
apps/worker/src/routes/memory/{index.ts (fills mountMemoryRoutes),session.ts,lookup.ts,runs.ts,decisions.ts,counsel.ts,rules.ts,firm.ts,audit.ts,export.ts,health.ts}
apps/worker/test/memory/**           <token>.test.ts per gate token (names pinned in Test Gates)
scripts/src/seed/{gen-demo-seed.ts,check-seed.ts}                 root `pnpm seed:gen`, `pnpm seed:check`
scripts/src/spikes/{s05-counter,s08-sql-surface,s09-rows-written,s10-cpu}/
fixtures/memory/_test-seed-spec.json
process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-04b/   risk evidence pack (Step F)
```

Serialized single-key seam edits (each declared in the registry, see Registry follow-up; executed one at a time, never in parallel with another phase touching the same file):

- `apps/worker/src/app.ts`: additive pattern-route API on `App` (exact `${method} ${pathname}` match first, then `:param` patterns; unknown `/api/*` stays the JSON 404); the two mount calls stay; `GET /api/health` stays as is (`{ok:true}`).
- `apps/worker/src/index.ts`: build the app lazily on the first request with `createApp({fetch, now, proxy: {platform: createD1Platform(env.DB, {capFor}), breaker}})` (module-level cache, never at import); fall back to `unavailablePlatform()` and `memory_unavailable` when `env.DB` is missing; add the `scheduled()` export (D5b).
- `apps/worker/wrangler.jsonc` (`triggers.crons`, purge vars; `database_id` placeholder untouched), `apps/worker/vitest.config.ts` (migrations via `readD1Migrations` + setup file), `apps/worker/test/{setup.ts,env.d.ts,seams.test.ts}` (the `recordingApp` gains the pattern-route method; the two 04b stub cases are updated: `mountMemoryRoutes` now registers routes, `createD1Platform` no longer throws NotImplemented).
- root `package.json` (`seed:gen`, `seed:check`), `scripts/package.json` (`@aduin/core` as a dependency of `@aduin/scripts`, added only if absent because Phase 02 `scripts/src/fixtures` may need the same key; plus the `seed:gen`/`seed:check` keys the root scripts delegate to with `pnpm --filter @aduin/scripts`, same pattern as `guard:cf`), lockfile change (one `pnpm install`, serialized).

## Public Contracts

Endpoints follow the frozen `contracts/memory.ts` (Contracts v1). No core contract edit in this phase (default decision, Gap 8); derivations are worker-side (A0 below).

- Routes: `POST /api/session`, `POST /api/memory/lookup`, `POST /api/runs`, `POST /api/runs/:id/findings` (≤ 50 per chunk), `POST /api/decisions`, `POST /api/decisions/:id/revoke`, `POST /api/counsel/questions`, `POST /api/counsel/answers`, `GET/POST /api/rules` (+ `/api/rules/:id/approve|reject|revoke`), `GET /api/memory/firm?law_firm_id=` (frozen canonical) with `GET /api/memory/firms/:id` as an alias, `GET /api/audit`, `POST /api/runs/:id/export` (worker-local zod schema, recorded as a Phase 08 note), `GET /api/export` (frozen path; P1 stretch, not an AC), `GET /api/memory/health` (schema version and `seed_mode`). `GET /api/health` (existing, `{ok:true}`) is untouched.
- Every write route returns 503 `memory_unavailable` when `schema_version` mismatches or `seed_mode != '0'` (checked per isolate, cached at most 60 s).
- No endpoint accepts a workspace id from the client; every repo function takes `ctx.workspaceId` from the verified cookie; cookies are issued only for `kind='sandbox'`; memory routes never mint a cookie (missing, invalid or `w`-less cookie gives 401 `invalid_session`).
- Cookie model: one cookie, the 04a `__Host-aduin_v` (`VISITOR_COOKIE`, claims `{v,iat,exp,kid,t?}`). `session.ts` reuses `configFor`/`resolveVisitor`/`visitorSetCookie` and re-signs with `resign(claims, {w, a, exp})`, preserving `v` and `t`; cookie `exp` = the workspace `expires_at` (30 days, not the 1-day visitor TTL). Liveness (workspace exists, `kind='sandbox'`, active, unexpired, analyst present) is verified in the first batched statement of every request; a stale cookie returns 401 `invalid_session` so the client re-posts `/api/session`.
- Guards: reuse `proxy/guards` (`checkOrigin`, `checkClientHeader`, `checkJsonContentType`, `readBodyCapped`; 64 KB, 128 KB for findings chunks), `ProxyError`/`errorResponse` (`no-store`, no CORS, frozen `errorStatus`), the 04a log redactor, a 409 body `{error, current}`. Bodies are never logged.
- Worker re-computes `fingerprint` on every decision write from `quote_text` (core function) and returns `422 fingerprint_mismatch`; the full quote is dropped after hashing. Snippet is derived server-side as `mask(sensitiveSpans)` of `quote_text` BEFORE the 300-char truncation; stored `quote_snippet` ≤ 300 chars.
- Privacy (R1 and free text): `detail.facts` and `explanation` are never persisted (drop or null `detail_json`; keep `region`, `anchor`, bounded `section_path`). The same core `mask` applies to every stored free-text field (notes, `fund_name`, `doc_version_label`, revoke reason, rule text, counsel interpretations). Audit `detail_json` is built from ids and enums only.
- Every write batch inserts one `audit_event` first. Idempotency by `client_op_id`: an audit-UNIQUE violation maps to HTTP 200 with the ORIGINAL result (the outbox needs the original success), `uq_decision_active` violation maps to 409 `conflict_active_decision` with `current`; the two are told apart by the constraint text recorded in S8 (local and remote).
- Multi-row writes use `json_each` or chunking, never one INSERT per finding; worst endpoint ≤ ~20 D1 queries (limit 50).
- Retention (D-4, user-decided; constants imported from core `limits`): sandbox memory 30 days (`limits.sandboxRetentionDays`; `expires_at = created_at + 30 days`; a sliding rule may only extend, never shorten), demo workspace never purged, `ai_cache` TTL 7 days (`limits.aiCacheTtlDays`), quota windows purged after 2 days (`limits.quotaWindowPurgeDays`); purge claimed at most once per hour from new sessions plus the daily `scheduled()` purge.
- Fail-closed: D1 error → memory endpoints return `memory_unavailable`; the proxy (04a) treats ports as down.
- Rule text is prompt context only; `proposed` rules never reach AI context (reads filter `status='active'`); `RulesPort` is workspace-bound.
- `answered/unclear` decisions resolve to label New (counsel's reply did not resolve it).

### A0 contract-fit (worker-side derivation, no core edit)

Pinned before any endpoint code (Step A0); gate `memory-endpoint-contract`:

- Decision firm: from `run_id` to `review_run.law_firm_id`; absent `run_id` gives 400 `invalid_request` reason `run_required`. Unknown request keys (e.g. the web `DecideInput.law_firm_id`) are stripped and never stored.
- Counsel question run: the latest run that contains the `finding_ref`. Answer firm and class come from the question row.
- Create-rule firm: from `?law_firm_id=` on `POST /api/rules`.
- Analyst name: read from the `analyst` row inside the statement, never from the client.
- `counsel_question` has its own unique `id` column, returned as `question_id` (composite PK `(workspace_id, id)`).
- Rule mapping: DB `proposed` -> contract `proposal`; `seed_of` set -> `seed`; DB `revoked` excluded from lists. `origin`/`status` mapping is covered by the endpoint-contract gate.
- Frozen `GET /api/memory/firm` is canonical, `/firms/:id` is the alias; `GET /api/export` is the P1 stretch.
- Run export (`POST /api/runs/:id/export`) uses a worker-local zod schema; recorded as a Phase 08 note.
- Fallback if the orchestrator later prefers additive optional contract fields: a serialized contract-change note with snapshot regeneration (not the default).

### AI-in-production decision

AI stays DISABLED in production until Phase 05. 04b makes NO `OPENROUTER_API_KEY` or `TURNSTILE_SECRET` dependency change and sets no secrets on any Worker (spike Workers included). The live M1 Worker already has `OPENROUTER_API_KEY` set, so the fence must hold because D1 and Turnstile are absent: gate `ai-fail-closed-without-secrets` asserts, REGARDLESS of whether `OPENROUTER_API_KEY` is set: (a) DB missing: `/api/quota` is `global_ok:false` and `/api/ai`, `/api/ocr` refuse with zero claims and zero upstream; (b) D1 wired and `TURNSTILE_SECRET` missing: `/api/ai`, `/api/ocr` refuse with `invalid_session` (`turnstile_missing` / `turnstile_failed`), zero claims, zero upstream (the 04a pipeline checks Turnstile before any claim and before the upstream call; `createTurnstile` returns `ok:false` without a secret). `/api/quota` `global_ok` keeps the 04a rule (`u.global_ok && apiKey && uploadsEnabled`, no Turnstile term); `routes/proxy/quota.ts` is 04a-owned and is NOT edited here, so `/api/quota` is not the fence for case (b). Turnstile widget plan (`aduin-transaction-turnstile`, hostname limited to the `aduin-transaction-web` workers.dev host, public site key in `vars.TURNSTILE_SITE_KEY`, secret only via `wrangler secret put`) is handed to Phase 05/10. Session creation: Turnstile is enforced iff `TURNSTILE_SECRET` is configured (fail closed on a bad token); when unconfigured, sandbox creation is allowed under strict `session_new` per-IP and global daily caps (numbers pinned at S9) with the read-only demo degrade path.

## Blast Radius

`apps/worker/{migrations,seed,src/db,src/platform,src/memory,src/routes/memory,test/memory}`, `scripts/src/{seed,spikes/s05*,s08*,s09*,s10*}`, `fixtures/memory/_test-seed-spec.json`, `harness/phase-04b/`, plus the serialized seam edits listed under Touchpoints (`app.ts`, `index.ts`, `wrangler.jsonc`, `vitest.config.ts`, `test/{setup.ts,env.d.ts,seams.test.ts}`, root and `scripts` `package.json`, lockfile). Disjoint from Phase 04a (`routes/proxy`, `proxy`, `upstream`, `limits`, `identity/turnstile.ts`, `test/proxy`, `test/fakes`; imports only, read-only) and Phase 02 (`packages/core`, `fixtures/memory/{fund-*,demo-seed-spec.json}`). Registry `## Phase 04b` (follow-up below).

## Data Flow

See DATA-MODEL flows (a)–(g): lookup (1 query, JSON array param), run/findings persistence (best-effort tier; decisions, counsel answers and `finding_state` succeed without persisted findings), dismiss batch (audit → supersede → insert → state upsert → proposal check), counsel answer batch, revoke batch, rule approval, sandbox creation (`INSERT … SELECT` from `ws_demo` with ids `sandboxId||':'||seedId`), lazy purge and scheduled purge (claim slot, set-based deletes in dependency order while `workspace.status='purging'`).

## Failure Modes

Unique-index conflict → `409` with the current decision; replayed `client_op_id` → 200 with the original result; trigger violation → `409`/`422`, never a crash; D1 over quota → read-only demo fallback for new sandboxes and `memory_unavailable` for writes (outbox in the client); schema mismatch or `seed_mode != '0'` → 503 on writes; stale/purged cookie → 401 `invalid_session`; quota storage error → claim throws (pipeline fails closed), never `ok:false`; breaker read error → fails closed; purge over limits → bounded batches (≤ 50 workspaces per run); cron failure is non-fatal.

## Implementation Checklist

### Step A0 — Contract fit
- [x] A0. Pin the worker-side derivation rules above in a short note at the top of `routes/memory/index.ts` and write `memory-endpoint-contract` stubs first (frozen schemas, path params, `/api/memory/firm` canonical plus alias, rule `origin`/`status` mapping, unknown keys not stored).

### Step A — Spikes and facts
- [x] A1. Author and run local S5 (20 parallel claims, cap 10 -> exactly 10; first claim with units > cap refused) and S8 on a draft schema (`s05-quota-claim-atomicity`, `s08-sql-surface`); record verdicts, constraint error texts, per-test storage isolation (`reset()`); adopt fallbacks if needed (inner-loop refresh note).
- [x] A2. After B1 and before Step D: S9, remote S8, S10 and cron-on-Free on throwaway `aduin-transaction-spike-*` resources under APPROVED-REMOTE (else INCONCLUSIVE-LOCAL); write verdict rows to the SPIKE-RESULTS REF; delete + list-confirm; `pnpm --filter @aduin/scripts spike:check`.

### Step B — Migrations and reference data
- [x] B1. Write 0001–0004 following DATA-MODEL DDL (20 tables; composite PK `(workspace_id, id)`, `WITHOUT ROWID`, composite FKs, CHECKs, `uq_decision_active` partial unique index, `ix_decision_page`, `ix_decision_pattern`, triggers `decision_no_delete` and `decision_guard_update` gated on `workspace.status='purging'` (list every immutable column; allow only the supersede/revoke columns to change), audit/answer immutability triggers, demo-write-block triggers outside `seed_mode`). `finding_state` and `counsel_question` FKs point at `review_run` (`finding_key` is a plain column) so best-effort finding persistence never breaks essential writes; `decision.origin_*` stay nullable; `counsel_question` gets its own `id`; `detail_json` nulled; rule `origin` values map per A0; `uq_rule_proposal` is a PARTIAL unique index over live statuses (`proposed`, `active`) to allow D-5 re-proposal.
- [x] B2. `0003` generated from core `ISSUE_CLASSES`, `LAW_FIRMS` and `normalizeFirmAlias` (equal to `fixtures/memory/law-firms.json`); `app_meta.schema_version` set by the last statement of each migration; `app_meta.seed_mode` fail-safe (writes 503 when not `'0'`).
- [x] B3. Tests: `migrations`, `triggers`, `explain-lookup` (regex allows `COVERING `); cross-workspace composite-FK insert fails; `decision` UPDATE/DELETE fail; transitions only `active → superseded|revoked`; dismiss without `reason_code` fails at the DB.

### Step C — Platform ports (SQL)
- [x] C1. `platform/quota.ts`: guarded atomic claim `INSERT … SELECT … WHERE ?units<=?cap ON CONFLICT … DO UPDATE … WHERE count+?<=cap RETURNING count` (a first claim above cap is refused; probed), claim THROWS on any D1 error and returns `ok:false` only at cap (F5), refund clamps at 0 with a self-describing token, window parsed from the key suffix (`|YYYY-MM-DD`), `capFor` wrapped so `session_new` has its caps (unknown kinds do not silently refuse), window purge. `createD1Platform(db, {capFor})` returns `{quota(keys), cache, ledger}` with a visitor-bound `quota(keys)` (`usage()` builds `{ai, ocr_pages, global_ok, resets_at}`); `platform/cache.ts` (read, write, TTL purge; no write on hit); `platform/ledger.ts` (`cost_usd` to `cost_micro_usd`).
- [x] C2. `platform/breaker.ts` on `app_meta` (`breaker:{day}` = fingerprint): `tripped()` throws on D1 error (fail closed), `trip()` sets the in-isolate trip first then persists (write failure still trips); wired via `createApp({proxy:{breaker}})` (F14). Gate `breaker-persist`.
- [x] C3. `platform/rules.ts`: export only `createRulesPort(db, workspaceId)` (built per request from the verified `w` by Phase 05), `status='active'` only, `rules_hash` from core `rulesHash`; no unscoped rules read exported. Gate `rules-port-scoped`.
- [x] C4. `platform-contract`: the same cases run parametrized over `FakePlatform` (`test/fakes/platform.ts`) and the D1 implementation (create the shared case list; the suite does not exist yet).

### Step D — Repository and endpoints
- [x] D1. `memory/ctx.ts` (verify cookie, liveness check in the first batched statement, build `ctx`), repo modules; statement-lint test: every SQL string in `memory/repo` and `platform` contains `workspace_id` binding or is declared global; `memory/mask.ts` wraps core `mask`/`sensitiveSpans`.
- [x] D2. `session.ts`: claim `session_new` per IP hash plus a global daily cap, Turnstile via `TurnstilePort` iff `TURNSTILE_SECRET` configured, create workspace + analyst, copy demo seed (≈ 6 queries, ≈ 20 with purge slot), re-sign the cookie with `{w, a, exp=expires_at}` preserving `v`/`t`, audit `session_created`; degrade path when the write estimate is over budget (read-only demo mode, every write returns `read_only_demo`). Gates `session-cookie-workerd`, `stale-cookie-invalid-session`.
- [x] D3. `lookup.ts`, `runs.ts` (+ findings chunks, labels re-resolved with core `resolveLabel`, best-effort, never persist `detail.facts`/`explanation`), `decisions.ts` (+ revoke; `client_op_id` replay returns the original 200 body, `uq_decision_active` race returns 409 `conflict_active_decision` with `current`), `counsel.ts`, `rules.ts`, `firm.ts`, `audit.ts`, `export.ts` (sets `sheet_exported_at`, `sheet_question_count`, audit `counsel_sheet_exported`; `GET /api/export` stretch), `health.ts`; all with guards and the pattern-route API. Gates `memory-guards-matrix`, `idempotent-replay`, `decision-without-persisted-findings`.
- [x] D4. `proposal.ts` inside the dismissal batch: insert proposed `firm_rule` + `rule_evidence` for ≥ 3 distinct active dismissals with the same (workspace, firm, pattern_key, reason_code), reason ≠ `other`. D-5 (user-decided): the partial `uq_rule_proposal` over live statuses allows re-proposal on NEW evidence, defined as at least 1 additional distinct active same-(firm, pattern_key, reason) dismissal decided after the rejection while the total is ≥ 3. `rule-proposal-threshold-matrix` covers: reject then none = no re-proposal; reject then +1 = re-proposal with all evidence; active = no duplicate; `other` never; a revoked decision leaves the count.
- [x] D5. Purge (`memory/repo/purge.ts`): slot claim via `app_meta`, set-based child-first deletes, expired `ai_cache` (7 d)/`quota_counter` (2 d) rows; sandbox 30 d; demo exempt; fake-clock test day 29 kept / day 31 purged.
- [x] D5b. `scheduled()` in `index.ts` runs the same purge daily with `triggers.crons` in `wrangler.jsonc`; non-fatal on failure; lazy purge stays the baseline; cron availability on Free confirmed in remote S8 or recorded INCONCLUSIVE. Gate `cron-purge` via `createScheduledController`.

### Step E — Seed and tests
- [x] E1. `gen-demo-seed.ts` computes fingerprints with core code from a `DemoSeedSpec`, masks with core `mask`/`sensitiveSpans`, records its spec path, emits `seed/demo.sql` wrapped in `seed_mode=1/0`; `pnpm seed:check` regenerates from the spec path RECORDED in the committed `seed/demo.sql` header (never auto-selects, so Phase 02 landing `demo-seed-spec.json` later cannot turn a committed seed red; only `seed:gen` auto-selects), diffs, and also runs the guard `scanText` over `migrations/*.sql` and `seed/demo.sql` (guards skip `.sql`). Add root `seed:gen`/`seed:check` scripts and the `@aduin/core` dependency of `@aduin/scripts` (seam edits).
- [x] E2. Tests, one file per token under `apps/worker/test/memory/<token>.test.ts`: all tokens in Test Gates, with the failing stubs below copied first. `memory-storage-contract` includes a canary in `detail.facts` and a 9-digit number in a note, fund name and rule text. Query-count and `meta.rows_written` assertions per endpoint through the counting wrapper in `db/meta.ts` (via the worker D1 binding; the wrangler CLI does not return rows_written). `memory-label-parity` asserts `MEMORY_LABELS` equals the applied `finding.memory_label` CHECK (closes F7 without editing the core test). Per-request counts in `query-budget` bound the AI worst path (incl. breaker read) well under 50 (DV1: no per-IP counter re-added).

### Step F — Risk evidence pack
- [x] F1. (pack written in `harness/phase-04b/`; reviewer APPROVE pending, recorded by the orchestrator-run independent reviewer) Risk evidence pack in `harness/phase-04b/` (identity, schema/migration + destructive purge, public API, trust boundary) with the read-only vc-security STRIDE and vc-scenario review (tenant isolation, sandbox minting, privacy) before EXECUTE and an automated reviewer APPROVE recorded in `harness/phase-04b/review-decision.json` before DONE; validate with `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness`.

## Test Gates (commands created in this phase)

Command form (program-wide rule, probed in 04a): `pnpm --filter @aduin/worker test <token>`, NO `--` (a literal `--` runs the whole suite and ignores the token), ONE token per invocation (a multi-token call passes when any token matches). Test files are named exactly as the tokens.

| Gate | Command (one token per call) | Tier | Proves AC |
|---|---|---|---|
| migrations/schema | `pnpm --filter @aduin/worker test migrations`, `... test triggers`, `... test explain-lookup` | Fully-Automated | AC42, AC43 (lookup), AC47 |
| decisions | `pnpm --filter @aduin/worker test decision-record-contract`, `... test decision-append-only` | Fully-Automated | AC42 |
| isolation | `pnpm --filter @aduin/worker test memory-no-cross-firm-or-workspace`, `... test sandbox-isolation`, `... test stale-cookie-invalid-session` | Fully-Automated | AC47, AC56 |
| demo | `pnpm --filter @aduin/worker test demo-workspace-not-polluted`, `... test demo-seed-copy-effects`, `pnpm seed:check` | Fully-Automated | AC57 |
| storage/purge | `pnpm --filter @aduin/worker test memory-storage-contract`, `... test memory-retention-purge-test`, `... test cron-purge` | Fully-Automated | AC58, AC38 (server) |
| audit/reopen/rules | `pnpm --filter @aduin/worker test audit-trail-append-only`, `... test memory-reopen-integration`, `... test rule-proposal-threshold-matrix` | Fully-Automated | AC55, AC50, AC53 |
| replay/tiering | `pnpm --filter @aduin/worker test idempotent-replay`, `... test decision-without-persisted-findings` | Fully-Automated | AC42, AC55 |
| endpoint contract | `pnpm --filter @aduin/worker test memory-endpoint-contract` | Fully-Automated | frozen Contracts v1 |
| ports | `pnpm --filter @aduin/worker test platform-contract`, `... test s05-quota-claim-atomicity`, `... test breaker-persist`, `... test rules-port-scoped` | Fully-Automated | F5, F14, AC47 |
| guards/session | `pnpm --filter @aduin/worker test memory-guards-matrix`, `... test session-cookie-workerd`, `... test fingerprint-vectors` | Fully-Automated | AC39, AC56, AC46 vectors in workerd |
| ai fence | `pnpm --filter @aduin/worker test ai-fail-closed-without-secrets` (DB missing: quota `global_ok:false` plus zero-claim refusals; `TURNSTILE_SECRET` missing: Turnstile refusals before any claim; both regardless of `OPENROUTER_API_KEY`) | Fully-Automated | AC26/AC39 fence |
| budgets/parity | `pnpm --filter @aduin/worker test query-budget`, `... test rows-written`, `... test firm-list-parity`, `... test memory-label-parity` | Fully-Automated | AC40 interim, AC41, F7 |
| remote spikes | S9, S10 and remote S8 on throwaway resources; `pnpm --filter @aduin/scripts spike:check` | Hybrid (precondition: Cloudflare account, APPROVED-REMOTE for `aduin-transaction-spike-*`) | AC40 residual |
| risk evidence | `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness` + recorded APPROVE | Hybrid | high-risk classes |
| regression | `pnpm --filter @aduin/worker test seams`, `pnpm --filter @aduin/worker test proxy`, `pnpm --filter @aduin/core test`, `pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | earlier phases |

Failing stubs for red-first (the validate-contract lists additional stubs; copy all verbatim into the test files): `should reject UPDATE and DELETE on decision`, `should allow at most one active decision per workspace firm and fingerprint`, `should refuse dismiss without reason_code at the database level`, `should return fingerprint_mismatch when the client hash disagrees`, `should not let workspace A read workspace B decisions`, `should not write to the demo workspace outside seed mode`, `should propose a rule on the third same-reason dismissal and not on the second`, `should purge expired sandboxes and keep the demo`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `decision-record-contract`, `decision-append-only` | Fully-Automated | AC42 |
| `memory-no-cross-firm-or-workspace`, `rules-port-scoped` | Fully-Automated | AC47 |
| `memory-reopen-integration` | Fully-Automated | AC50 |
| `rule-proposal-threshold-matrix` (incl. D-5 re-proposal) | Fully-Automated | AC53 |
| `audit-trail-append-only` | Fully-Automated | AC55 |
| `sandbox-isolation`, `stale-cookie-invalid-session` | Fully-Automated | AC56 |
| `demo-workspace-not-polluted`, `demo-seed-copy-effects` | Fully-Automated | AC57 |
| `memory-storage-contract`, `memory-retention-purge-test`, `cron-purge` | Fully-Automated | AC58 |
| `memory-endpoint-contract`, `memory-guards-matrix`, `idempotent-replay`, `ai-fail-closed-without-secrets` | Fully-Automated | frozen Contracts v1, AC39, AC26 fence |
| S9/S10 remote calibration | Hybrid | AC40 (residual: local D1 is not remote quota) |

```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction
for t in migrations triggers explain-lookup decision-record-contract decision-append-only memory-no-cross-firm-or-workspace sandbox-isolation stale-cookie-invalid-session demo-workspace-not-polluted demo-seed-copy-effects memory-storage-contract memory-retention-purge-test audit-trail-append-only memory-reopen-integration rule-proposal-threshold-matrix idempotent-replay decision-without-persisted-findings memory-endpoint-contract platform-contract s05-quota-claim-atomicity breaker-persist rules-port-scoped memory-guards-matrix session-cookie-workerd fingerprint-vectors cron-purge ai-fail-closed-without-secrets query-budget rows-written firm-list-parity memory-label-parity seams proxy; do pnpm --filter @aduin/worker test "$t" || exit 1; done
pnpm seed:check && pnpm guard:cf && pnpm secrets:scan
# Expected: all exit 0
```

## Exit Gate

- All gates green; spike verdicts and any adopted fallbacks recorded; migration list (20 tables) and schema hash in the report.
- No remote D1 other than throwaway spike resources was touched; throwaway resources deleted and list-confirmed; no secrets set on any Worker.
- Risk evidence pack validated with a recorded APPROVE.
- Phase report written.

## Risks and Kill Criteria

- M1 D1 100k rows-written/day: S9 estimate > 2× → findings persistence opt-in, seed copy skipped.
- Unverified D1 SQL features (S8): fallbacks above; correctness never depends on triggers alone (app-layer checks plus tests).
- M3 sandbox-minting abuse: `session_new` per-IP and global caps plus the Turnstile hook (enforced iff configured).
- AI exposure: the live Worker already holds `OPENROUTER_API_KEY`; the fence depends on D1 + Turnstile being absent. Any change that makes AI reachable before Phase 05 is a kill criterion (gate `ai-fail-closed-without-secrets`).
- Schedule risk (M12): Tier-2 items in this phase (revoke, rule proposal) are small; if time is short keep AC50 and AC53 backend, defer UI (Phase 08b).

## Cost / Secret Hygiene

No LLM/OCR calls. Cookie signing key from `env` only; no secret in migrations, seeds or logs (04a log redactor reused). Cloudflare names `aduin-transaction-*`; no zone/route; no secrets on spike Workers; no remote migration, seed or deploy of the real DB in this phase (Phase 10). `seed:check` scans `.sql` with the guard `scanText`.

## Rollback

Migrations are forward-only: roll back by dropping the local DB and reverting commits; remote rollback is not needed because the real DB is created in Phase 10. Throwaway spike resources are deleted by name and list-confirmed.

## Blockers That Would Justify BLOCKED Status

- A core contract (Phase 01) cannot express a memory operation even with the A0 worker-side derivation (contract-change note).
- Local D1 under pool-workers cannot execute triggers/partial indexes (S8 fails and the fallback loses AC42/AC55 guarantees) → route to the user.

## Registry follow-up

For the orchestrator to apply to `phase-blast-radius-registry.md` (`## Phase 04b`); this plan does not edit the registry or the umbrella. Add as serialized single-key seam edits: `apps/worker/src/{app.ts,index.ts}`, `apps/worker/wrangler.jsonc` (`triggers.crons`, purge vars), `apps/worker/vitest.config.ts`, `apps/worker/test/{setup.ts,env.d.ts,seams.test.ts}`, root `package.json`, `scripts/package.json`, lockfile. Add new owned paths: `apps/worker/src/platform/breaker.ts`, `apps/worker/src/memory/mask.ts`, `harness/phase-04b/`. Note: `triggers.crons` is owned by 04b (D5b).

## Deviations

All within the 04b blast radius (no hard-stop class). Recorded by EXECUTE 17-10-26.

| # | What deviated | Why | Impact |
|---|---|---|---|
| 1 | `lookup` and `currentActive` pin `INDEXED BY uq_decision_active` | S8: the local planner chose a primary-key prefix scan of the whole workspace | lookup is index-served on local and remote D1; SQLite errors instead of silently scanning if the index ever becomes unusable |
| 2 | A1 (S5/S8) ran on the real B1 DDL, not a separate draft schema | the DDL was written first; it is a superset of the draft | none; facts recorded against the shipped schema |
| 3 | `POST /api/runs`, `/runs/:id/findings` and `/counsel/questions` write no audit row | the frozen `AUDIT_ACTIONS` enum has no action for them; they are working state, not memory decisions | idempotency comes from deterministic ids + `ON CONFLICT DO NOTHING` instead of the audit UNIQUE |
| 4 | The session's `session_created` audit row is inserted after the workspace and analyst rows | the audit FK needs the workspace row | batch is still atomic |
| 5 | A session that also claims the hourly lazy-purge slot uses 29 queries | 12 child-first purge deletes plus the session batch | documented exception in `query-budget` (<= 30, limit 50); all other endpoints <= 10 |
| 6 | Rule revoke action responds with status `rejected` | the frozen `RuleSchema` has no `revoked` status; DB `revoked` stays excluded from lists | Phase 08b note |
| 7 | Read-only demo degrade uses a cookie with `a='ro'` and no `w` | the plan's degrade path needs reads of ws_demo without binding a cookie to it | reads only; every write returns 403 `read_only_demo`; all other w-less cookies get 401 |
| 8 | Extra columns beyond DATA-MODEL: `audit_event.result_json`, `counsel_question.{id,fingerprint,law_firm_id,issue_class}`, `review_run.settings_hash` (run unique key uses it instead of engine_version), `spend_ledger.{units,cache}`; `ai_cache` debug columns nullable | original-result replay; A0 answer derivation; the contract sends `settings_hash`; LedgerEntry fields; CachePort has no debug fields | 20 tables unchanged |
| 9 | No purge `vars` in `wrangler.jsonc`; only `triggers.crons` | retention constants come from core `limits` | `guard:cf` OK; placeholder `database_id` untouched |
| 10 | `SESSION_CAPS` pinned at 5 per IP hash/day and 300 global/day | S9: 84 rows written per session (above the ~60 estimate) | about 25% of the 100k/day write budget |
| 11 | S10 verdict FAIL(fallback): chunk size 25 for client-side findings persistence | 11-15 ms CPU on a worst-case 157 KB body; zod vs raw equal | Phase 08 note; the frozen contract still accepts <= 50 |
| 12 | Spike files: `scripts/src/spikes/s08-sql-surface/remote-worker.mjs` and `scripts/src/spikes/s09-rows-written/run-remote.sh` serve S8-remote/S9/S10/cron; no `s05-counter`/`s10-cpu` dirs | S5 local runs as the worker gate; one throwaway Worker covers all remote spikes | fewer files |
| 13 | Test helpers `test/memory/{db-fixtures,memory-harness,budget-probe}.ts`, `src/memory/http.ts`; `test/env.d.ts` declares `import.meta.glob` and `?raw` | shared plumbing for the 32 gate files and the statement lint | not `.test.ts`, so no token matches them |
| 14 | The validator command on `harness/` (root) fails for every phase (no pack at the root); the pack is validated at `harness/phase-04b` | the per-phase folder layout used since Phase 01 | the only failure there is the intentionally pending reviewer decision |

### Fix cycle 1 deviations (review-decision.json M1, L1-L6; within the 04b blast radius)

- Body/guard order (L5): memory POST routes now verify the cookie signature (no DB) BEFORE reading or parsing the body, so a missing/forged cookie with an oversized or malformed body is 401 (was 413/400). `memory-guards-matrix` sends a valid cookie for the malformed-JSON and body-cap cases and adds a "401 before body read, zero queries" case.
- Findings chunk is capped at 25 server-side (413 `payload_too_large`, reason `findings_chunk`); the budget probe key `findings_50` is renamed `findings_25` in query-budget/rows-written (rows-written bound now 25-30 for a 25-finding chunk).
- M1 caps reuse the frozen `rate` quota scope (no core edit) with keys `mw|req|<ws>|<day>`, `mw|run|...`, `mw|fnd|...`; defaults in code (`MEMORY_WRITE_CAPS` 600 req / 5 runs / 2,000 findings per workspace per UTC day). 5 runs/day follows the review suggestion; it may be tight for a heavy demo session and is a one-constant change.
- L4: the frozen `ConflictBody.current` is typed as an ActiveDecision, so a lost rule race returns 409 `conflict_active_decision` with the current rule status in `reason` (`rule_<status>`) instead of a rule object in `current`. **Superseded in fix cycle 2 (N2):** the lost race now throws `ConflictError(null)` (body `current: null`, frozen ConflictBodySchema), as decisions.ts:87.
- L3: migration 0005 sets `schema_version` '5' last (migration convention test); `EXPECTED_SCHEMA_VERSION` is now '5', so writes stay 503 until 0005 is applied remotely (Phase 10 must apply 0001-0005).
- L2: blockId/detector_id/model go through `maskFree` (non-rejecting) rather than a charset rejection, to avoid breaking engine ids.

### Fix cycle 2 deviations (re-review APPROVE_WITH_FIXES N1-N4, N6; within the 04b blast radius)

- N1/M1: global weighted daily write-row budget `MEMORY_WRITE_CAPS.rowBudgetPerDay` = 40,000 units, key `mw|rows|<day>` (`rate` scope, guarded UPSERT), claimed in `resolveSession` right after the per-workspace request claim. Weights live in one table `MEMORY_WRITE_WEIGHTS` (platform/index.ts): decision 25, run 12, findings chunk n+5, other 10, plus **counsel answer 18** (deviation from "other 10": its rows-written bound is 18). Weights are passed through `postEntry({weight})`; a rows-written test asserts weight >= measured rows per write route. Refusal: 429 `rate_limited` / `memory_write_budget`, retry-after to next UTC day.
- The 25-finding chunk check (413) moved into the findings weight function, so it now runs before any claim (previously after the per-workspace request claim).
- query-budget: `run_export` cap 6 -> 7 (one extra query for the budget claim).
- N3: `runsPerDay` 5 -> 40; the run claim moved after firm validation (unknown firm burns no slot).
- N6: a live sandbox cookie is reused BEFORE the per-IP claim at any cap level (previously only in the over-global-cap branch, which is now removed as unreachable).
- Worst-case D1 rows/day: memory writes <= 40k (weights >= rows) + one budget-counter row per write (<= ~6.7k at the minimum weight 6) + sessions 300 x ~120 = 36k + AI/OCR claim/cache/ledger rows (<= 15 per call, bounded by 04a quotas) -> ~83k before AI/OCR, under 100k for the demo; the budget is a one-constant change if remote calibration differs.

### Fix cycle 3 deviations (re-review APPROVE_WITH_FIXES N7-N9; within the 04b blast radius)

- `apps/worker/src/memory/proposal.ts` (PROPOSAL_SQL.evidence): evidence link capped at the newest `EVIDENCE_LINK_MAX` = 10 active same-key dismissals. Deviation: a (re-)proposal no longer carries ALL evidence when more than 10 exist; `evidence_count` (GET /api/rules, /api/export) now counts LINKED evidence (labelled in `repo/rules.ts`). The threshold still counts all decisions, so rule-proposal-threshold-matrix is unchanged (its re-proposal case links 4 < 10).
- `apps/worker/src/platform/index.ts`: `MEMORY_WRITE_WEIGHTS.decision` 25 -> 32 (measured worst 26 + 6 margin); `MEMORY_WRITE_CAPS.rowBudgetPerDay` 40000 -> 30000 (N9).
- `apps/worker/src/memory/ctx.ts` + `platform/quota.ts` (`QUOTA_SQL.peek`): N8 0-row budget pre-check before the `mw|req` claim. Deviation: a budget-refused write now writes 0 rows (memory-write-limits assertion changed 1 -> 0) and every write route costs +1 query (query-budget caps raised by 1 for runs, findings_25, decision_supersede, counsel_answer, rule_approve, run_export).
- Set-based write scan: only the evidence insert was unbounded; `COUNSEL_SQL.markExported` is amortised (asserted in rows-written).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [x] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [x] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [x] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [x] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [x] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented) — 17-10-26: 34/34 tokens green, full suite 405/405, seed:check, core, typecheck, lint, guard:cf, secrets:scan, spike:check green; F1 reviewer decision pending (orchestrator)
- [x] 6. EVL — green (worker 445/445, core 291/291, risk validator 0 failures; fix cycles bb83e04, fb3064f, 59d9831; reviewer APPROVE_WITH_FIXES, autoStop cleared)
- [x] 7. UPDATE PROCESS — archived; context updated; committed (17-10-26; plan stays in active/ as part of the program folder)

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S1 (worker, core, scripts), S2 (schema/migration, identity), S4, S6 (identity, schema, secrets), S7 → 5/7 HIGH. Recommended: sequential for migrations then ports then repo (tightly coupled), plus a read-only security reviewer (vc-security, vc-scenario for tenant isolation and sandbox minting) before PVL; seam edits serialized; agent-team only if run concurrently with Phase 02 and a contract question appears (shared TaskList). Sonnet for research/validation/review, opus for code execution.

## Test Infra Improvement Notes

(none identified yet) — candidates: D1 query-counting wrapper and rows-written assertion helper (shared with Phase 05); shared case list for `FakePlatform` vs D1 contract suite.

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04b-d1-memory-api_PLAN_17-10-26.md`
- Last completed step: EXECUTE (17-10-26) — code done, all gates green locally, remote spikes recorded; report `subdoc-qa-mvp_PHASE-04b-d1-memory-api_REPORT_17-10-26.md`; next: orchestrator EVL + independent reviewer for `harness/phase-04b/review-decision.json`
- Validate-contract status: CONDITIONAL until vc-validate-agent re-runs PVL from V1 against this supplemented plan
- Next Step: orchestrator applies the Registry follow-up, re-spawns vc-validate-agent; then, after Phases 00 and 01 are verified, vc-research-agent and Step A0/A1 first. Runs parallel with Phase 02. Phase 05 and Phase 08 consume the ports, rules read and endpoints.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: inner-pvl: phase-04b
supersedes: 2026-10-17 (inner-pvl: phase-04b) — inner PVL has current evidence (second pass, after supplement cycle 1 closed all 20 first-pass gaps)

Parallel strategy: sequential (migrations, then ports, then repo and routes are tightly coupled) + one read-only vc-security STRIDE / vc-scenario review (tenant isolation, sandbox minting, privacy) before EXECUTE; runs in the same time window as Phase 02 with serialized seam edits (see Execute-agent instructions E3-E5), so no agent team is needed unless a shared-file question appears
Rationale: 5/7 signals HIGH (S1 worker + core + scripts, S2 schema/API/auth surface, S4 phase program, S6 identity + schema/migration + secrets + public API, S7 5+ files); dominant signal S6. No mid-run coordination between the phases is required because the blast radii are disjoint and the shared seams are one-key edits. Models: sonnet for review/validation, opus only for the code-execution leg. Second inner-loop PVL pass for phase 04b against the ACTUAL code (phases 00, 01, 03, 04a DONE); one recorded supplement cycle (results.tsv), 20 of 20 first-pass gaps verified resolved; the re-validation found no FAIL and no unresolved CONCERN (four small plan-text corrections were applied in this pass, listed under "Plan updates applied by this pass").

Re-validation evidence (this pass; local scratch dir outside the repo, `wrangler d1 execute --local`, wrangler 4.151.1, nothing left in the repo):
- (a) Quota SQL cap-safety, re-probed against the form now in the plan (`INSERT ... SELECT ... WHERE units<=cap ON CONFLICT(scope,key,window) DO UPDATE SET count=count+units WHERE count+units<=cap RETURNING count`): first claim units 7 / cap 6 -> 0 rows, nothing inserted (the old unguarded form returned count 7); units 6 / cap 6 -> count 6; a further 1 -> 0 rows, count stays 6; cap 0 first claim -> refused; 4+4 under cap 10 -> 4, 8, then a third 4 refused (counter stays 8). Refused claims never mutate the row. Result: CAP-SAFE.
- (b) `memory/mask.ts` in the Registry follow-up is `apps/worker/src/memory/mask.ts` (worker-side wrapper over the core `mask`/`sensitiveSpans`, both exported by the `@aduin/core` barrel via `memory/index`), a different file and a different package from `packages/core/src/memory/mask.ts` that Phase 02 widens (A6, `ACCOUNT_NUMBER_RE`). No path collision. Semantic coupling is read-only and one-way (04b imports through the barrel, never edits core); the 02 widening is a regex superset, so 04b gates that use 9-digit canaries pass before and after it (instruction E5).
- (c) Seams vs Phase 02 (02 edits `packages/core/**`, `apps/web/**`, `fixtures/{html-seeded,memory/{fund-*,demo-seed-spec.json}}`, `scripts/src/fixtures`, `scripts/package.json` `fixtures:build`/`fixtures:check`, `packages/core/package.json`, maybe `.prettierignore`): 04b touches none of those except `scripts/package.json` (other keys). Root `package.json` and `pnpm-lock.yaml` are written by 04b only (02 declares no dependency or root-script change); `scripts/package.json` is the single shared file and its edits are different keys (02: two `scripts` keys; 04b: `@aduin/core` dependency and `seed:*` keys), so one-key serialized edits suffice. The `apps/worker/**` seams (`app.ts`, `index.ts`, `wrangler.jsonc`, `vitest.config.ts`, `test/{setup,env.d,seams}`) have no second writer (04a is DONE, 02 does not touch the worker). `fixtures/memory/_test-seed-spec.json` (04b) and `demo-seed-spec.json` (02) are different files; the generator-path race is closed by the P-V4 text fix (seed:check regenerates from the recorded spec path).
- (d) Gates: every token in the plan's loop is a single token with no `--`; the 33 tokens map one-to-one to planned files (`seams` -> existing `test/seams.test.ts`, `proxy` -> existing `test/proxy/*`, the rest -> `apps/worker/test/memory/<token>.test.ts`, E2); `s08-sql-surface` (Step A1) is added in the loop below; vitest filters by file path substring and exits 1 on a token with no file (the worker script has no `--passWithNoTests`), so a missing gate file is red, not vacuous green. No token is a substring of another token's file name.
- Regression probes against the real 04a/00/01 code: `createApp` has exact-match routes and a duplicate-route throw (pattern-route addition is additive); `index.ts` builds the app at module scope without `env` (lazy build is correct); `configFor`, `resolveVisitor`, `visitorSetCookie`, `VISITOR_COOKIE`, `resign` (core, claims already allow `w`/`a`/`t`), `checkOrigin`/`checkClientHeader`/`checkJsonContentType`/`readBodyCapped`, `ProxyError`/`errorResponse`, `BreakerPort`, `unavailablePlatform`, `capFor`, the log `redact` all exist with the names the plan uses; core `limits` already has `sandboxRetentionDays` 30, `aiCacheTtlDays` 7, `quotaWindowPurgeDays` 2; `@cloudflare/vitest-plugin` 1.4.4 exports `readD1Migrations` (plugin entry) and `applyD1Migrations`, `reset`, `createScheduledController` (`cloudflare:test`); `guard:cf` forbids `routes|route|custom_domain|zone_*` keys only, so `triggers.crons` is allowed; `spike:check` accepts the current `DEFERRED(04b)` rows (the exit gate still requires real verdicts for S5/S8/S9/S10); table count 20 (9 + 8 + 3); `validate-plan-artifact.mjs`: 0 failures, 0 warnings.
- One real defect found and fixed in the plan text (P-V1): the supplement said `/api/quota` is `global_ok:false` whenever `TURNSTILE_SECRET` is missing, but the shipped 04a rule is `u.global_ok && Boolean(cfg.apiKey) && cfg.uploadsEnabled` (no Turnstile term), so with D1 wired and the live `OPENROUTER_API_KEY` set the gate would have been unsatisfiable without editing the 04a-owned `routes/proxy/quota.ts`. The fence for the missing-`TURNSTILE_SECRET` case is the pipeline (Turnstile before any claim; `createTurnstile` returns `ok:false` without a secret), so the gate now asserts that instead.

Plan updates applied by this pass (line-anchored; plan lines 33, 68, 102, 138, 181, 203; verified with git diff, 6 lines changed):
- P-V1: `ai-fail-closed-without-secrets` assertion matches the real 04a code (see above).
- P-V2: the plugin package is `@cloudflare/vitest-plugin` 1.4.4 (the plan said the deprecated `@cloudflare/vitest-pool-workers`).
- P-V3: `scripts/package.json` also needs the `seed:gen`/`seed:check` keys that the root scripts delegate to; the `@aduin/core` dependency key is added only if absent (Phase 02 may need it for `scripts/src/fixtures`); one serialized `pnpm install` for the lockfile.
- P-V4: `pnpm seed:check` regenerates from the spec path recorded in the committed `seed/demo.sql` header (never auto-selects); only `seed:gen` auto-selects between `demo-seed-spec.json` and `_test-seed-spec.json`.

Test gates (C3 5-column table; legacy line form below). Command form (program-wide rule, umbrella 2026-10-17, probed in 04a): under pnpm 11.13.1 select tests with `pnpm --filter @aduin/worker test <token>`, NO `--` (a literal `--` runs the whole suite and ignores the token; the plan now uses this form everywhere). ONE token per invocation (a multi-token call passes when any token matches, so a missing gate file would go unnoticed); a single unmatched token exits 1 because the worker script has no `--passWithNoTests`. Create test files named exactly as the tokens under `apps/worker/test/memory/` (`<token>.test.ts`). Gap-resolution B = gate added by this plan's checklist (supplement), A = already proven, C = deferred, D = backlog stub residual.

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC42, AC43, AC47 | migrations 0001-0004 apply on local D1; `schema_version` set last; lookup plan uses `uq_decision_active`; composite-FK cross-workspace insert fails; `decision` UPDATE/DELETE fail outside `purging`; transitions only `active -> superseded\|revoked`; dismiss without `reason_code` fails at the DB | Fully-Automated | `pnpm --filter @aduin/worker test migrations`, then `triggers`, then `explain-lookup` (one call each) | B |
| AC42 | every decision type x reason x option stored with the full record, append-only; exhaustive `test.each` (no fast-check dependency needed: the space is 3 x 4 x 4) | Fully-Automated | `pnpm --filter @aduin/worker test decision-record-contract`, then `decision-append-only` | B |
| AC47, AC56 | two workspaces and two firms never see each other's decisions, rules, audit; sandbox cookie A cannot read B; stale/purged/expired workspace cookie gets 401 `invalid_session` | Fully-Automated | `pnpm --filter @aduin/worker test memory-no-cross-firm-or-workspace`, `sandbox-isolation`, `stale-cookie-invalid-session` | B |
| AC57 | demo workspace never bound to a cookie, write blocked outside `seed_mode`, sandbox is a copy (seed decisions, rules, `rules_hash` equal to the demo's, `seed_of` set); `seed_mode != '0'` makes writes 503; generator output equals committed `seed/demo.sql` | Fully-Automated | `pnpm --filter @aduin/worker test demo-workspace-not-polluted`, `demo-seed-copy-effects`; `pnpm seed:check` | B (root `seed:*` scripts and the `@aduin/core` dependency of `@aduin/scripts` are new seam edits) |
| AC58, AC38 (server) | only masked snippets, hashes and metadata stored; no row snippet > 300; no unmasked 6+ digit run in any free-text column; `detail.facts`/`detail.explanation` canary text never appears in any table dump (R1); retention 30 days sandbox (D-4), demo exempt, `ai_cache` 7 days, quota windows 2 days, fake clock day 29 kept / day 31 purged | Fully-Automated | `pnpm --filter @aduin/worker test memory-storage-contract`, then `memory-retention-purge-test` | B |
| AC55, AC50, AC53 | audit append-only (UPDATE/DELETE fail, `GET /api/audit` keyset paging); reopen revokes and finding is New; proposal at 3 same-reason dismissals, not at 2, not with mixed reasons, not for another firm, never for `other`; D-5: rejected key re-proposed only after new evidence | Fully-Automated | `pnpm --filter @aduin/worker test audit-trail-append-only`, `memory-reopen-integration`, `rule-proposal-threshold-matrix` | B |
| AC42, AC55 | `client_op_id` replay returns the ORIGINAL 200 body with no second row; `uq_decision_active` race returns 409 `conflict_active_decision` with `current`; the two are told apart by constraint text | Fully-Automated | `pnpm --filter @aduin/worker test idempotent-replay` | B |
| AC42 (tiering) | decisions, counsel answers and finding_state succeed when no `finding` rows were persisted (best-effort tier skipped) | Fully-Automated | `pnpm --filter @aduin/worker test decision-without-persisted-findings` | B |
| frozen Contracts v1 | every route and every response parses with the frozen zod schemas; path params work; `GET /api/memory/firm` canonical plus `/firms/:id` alias; rule `origin`/`status` mapping; unknown request keys do not leak into storage | Fully-Automated | `pnpm --filter @aduin/worker test memory-endpoint-contract` | B |
| ports (F5, F14, S5) | D1 `QuotaPort/CachePort/LedgerPort` pass the same cases as `FakePlatform`; claim is atomic (20 parallel, cap 10 -> exactly 10); first claim with units > cap refused; port error THROWS, `ok:false` only at cap; refund clamps at 0; `BreakerPort` persisted, in-isolate trip set first, write failure still trips, read failure fails closed | Fully-Automated | `pnpm --filter @aduin/worker test platform-contract`, `s05-quota-claim-atomicity`, `breaker-persist` | B |
| AC47, AC51 (hand-off to 05) | `RulesPort` is workspace-bound (`createRulesPort(db, workspaceId)`), only `status='active'`, `rules_hash` equals core `rulesHash`; no unscoped rules read is exported | Fully-Automated | `pnpm --filter @aduin/worker test rules-port-scoped` | B |
| AC39, AC56 | memory routes: Origin + `x-aduin-client` + JSON content-type + body caps (64 KB, 128 KB findings), `no-store`, no CORS, frozen `errorStatus`; session: Turnstile enforced when `TURNSTILE_SECRET` is configured, `session_new` per-IP and global caps, one cookie carrying `v`+`w`+`a` (+`t` preserved) with 30-day exp, cookie helper + vectors in workerd (closes the Phase 01 carried gap) | Fully-Automated | `pnpm --filter @aduin/worker test memory-guards-matrix`, `session-cookie-workerd`, `fingerprint-vectors` | B |
| AC38, AC58 | `scheduled()` runs the same purge (daily cron), non-fatal on failure; lazy purge stays the baseline | Fully-Automated | `pnpm --filter @aduin/worker test cron-purge` (via `createScheduledController`) | B |
| AC26/AC39 (fence) | with the D1 platform wired, whatever `OPENROUTER_API_KEY` holds: DB missing -> `/api/quota` `global_ok:false` and `/api/ai`, `/api/ocr` refuse with zero claims and zero upstream; `TURNSTILE_SECRET` missing -> `/api/ai`, `/api/ocr` refuse `invalid_session` (Turnstile runs before any claim and before the upstream call), zero claims, zero upstream; `/api/quota` `global_ok` keeps the 04a rule and is not the fence for this case | Fully-Automated | `pnpm --filter @aduin/worker test ai-fail-closed-without-secrets` | B |
| AC40 (interim), AC41 | per-endpoint D1 query counts (worst endpoint <= ~20, AI worst path incl. breaker read well under 50) and `meta.rows_written` caps; D1 firm list and aliases equal `fixtures/memory/law-firms.json`; `MEMORY_LABELS` equals the applied `finding.memory_label` CHECK (closes F7) | Fully-Automated | `pnpm --filter @aduin/worker test query-budget`, `rows-written`, `firm-list-parity`, `memory-label-parity` | B |
| regression | Phase 00 seams updated, Phase 01 core, Phase 04a proxy suite, guards, typecheck, lint | Fully-Automated | `pnpm --filter @aduin/worker test seams`; `pnpm --filter @aduin/core test`; `pnpm --filter @aduin/worker test proxy`; `pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan` | A |
| AC40 residual (S9, S10, remote S8, cron on Free) | rows-written calibration, cold-start CPU, shared 50-query budget and cron availability on throwaway `aduin-transaction-spike-*` resources under APPROVED-REMOTE; else INCONCLUSIVE-LOCAL with the pre-adopted fallbacks | Hybrid | Step A runners in `scripts/src/spikes/{s09-rows-written,s10-cpu,s08-sql-surface}`; precondition: Cloudflare account + `# APPROVED:credentials.env` load; verdicts written to the SPIKE-RESULTS REF and `pnpm --filter @aduin/scripts spike:check` | B |
| high-risk evidence | risk pack for identity, schema/migration + destructive purge, public API, trust boundary; automated reviewer recorded | Hybrid | `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness` plus a recorded APPROVE in `harness/phase-04b/review-decision.json` | B |

Known-Gap is never a `strategy:` value here. Named residuals (gap-resolution C/D, not proving strategies): real remote D1 rows-written, real-workerd CPU, shared-50 budget and cron-on-Free (Hybrid above; INCONCLUSIVE-LOCAL if the account/credentials step is denied); the real Turnstile widget and live AI are NOT exercised in this phase (Phase 05/10, see the AI-in-production decision); remote migration of the real `aduin-transaction-db`, seed and deploy are Phase 10. Net-gate vacuous-green scan (re-run this pass): every developed 04b behavior (ports `QuotaPort`/`CachePort`/`LedgerPort`/`BreakerPort`/`RulesPort`, cookie/ctx, guards, idempotent replay, cron, tier decoupling, endpoint contract, AI fence, purge, seed) has a Fully-Automated or Hybrid gate in the table above and a planned file for each token; no behavior passes on Known-Gap alone, so the net gate may be a terminal PASS.

Final gate commands (copy-paste; no `--`; one token per call):

```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction
# Step A (local spikes; files authored by Step A, names pinned)
for t in s05-quota-claim-atomicity s08-sql-surface; do pnpm --filter @aduin/worker test "$t" || exit 1; done
# Steps B-F gates
for t in migrations triggers explain-lookup decision-record-contract decision-append-only memory-no-cross-firm-or-workspace sandbox-isolation stale-cookie-invalid-session demo-workspace-not-polluted demo-seed-copy-effects memory-storage-contract memory-retention-purge-test audit-trail-append-only memory-reopen-integration rule-proposal-threshold-matrix idempotent-replay decision-without-persisted-findings memory-endpoint-contract platform-contract breaker-persist rules-port-scoped memory-guards-matrix session-cookie-workerd fingerprint-vectors cron-purge ai-fail-closed-without-secrets query-budget rows-written firm-list-parity memory-label-parity seams proxy; do pnpm --filter @aduin/worker test "$t" || exit 1; done
pnpm --filter @aduin/worker test
pnpm seed:check
pnpm --filter @aduin/core test
pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan
pnpm --filter @aduin/scripts spike:check
node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness   # + recorded APPROVE
# Hybrid (only under APPROVED-REMOTE; else record INCONCLUSIVE-LOCAL): remote S8/S9/S10 runners on aduin-transaction-spike-*, then delete + list-confirm
```

Failing stubs (red-first; Fully-Automated rows only; the plan's 8 existing stubs stay; add these; copy verbatim into the test files):
- `test("should refuse a first claim whose units exceed the cap", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should refuse a first claim whose units exceed the cap") })`
- `test("should throw on a storage error instead of returning ok false", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should throw on a storage error instead of returning ok false") })`
- `test("should keep a breaker trip when the persisted write fails", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should keep a breaker trip when the persisted write fails") })`
- `test("should return the original response when a client_op_id is replayed", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should return the original response when a client_op_id is replayed") })`
- `test("should record a decision when no finding rows were persisted", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should record a decision when no finding rows were persisted") })`
- `test("should never persist detail facts or explanation text", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should never persist detail facts or explanation text") })`
- `test("should mask an account number typed into a note or fund name", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should mask an account number typed into a note or fund name") })`
- `test("should return invalid_session for a cookie whose workspace was purged", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should return invalid_session for a cookie whose workspace was purged") })`
- `test("should keep v and t when the session re-signs the cookie with w and a", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should keep v and t when the session re-signs the cookie with w and a") })`
- `test("should re-propose a rejected rule only after new same-reason dismissals", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should re-propose a rejected rule only after new same-reason dismissals") })`
- `test("should serve path-parameter routes and the frozen firm memory path", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should serve path-parameter routes and the frozen firm memory path") })`
- `test("should keep AI fail closed when D1 is wired but no secrets are set", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should keep AI fail closed when D1 is wired but no secrets are set") })`

Legacy line form:
- Worker D1 + memory: [Fully-automated: `pnpm --filter @aduin/worker test <token>` per gate (loop above), then the full worker suite] | [Fully-automated: `pnpm seed:check`, `pnpm --filter @aduin/core test`, `pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan`] | [hybrid: remote S8/S9/S10 on throwaway `aduin-transaction-spike-*` resources under APPROVED-REMOTE, else INCONCLUSIVE-LOCAL; risk evidence pack validator + recorded automated-reviewer APPROVE] | [agent-probe: read-only vc-security STRIDE + vc-scenario (tenant isolation, sandbox minting, privacy) before EXECUTE] | [known-gap: real remote rows-written/CPU/shared-50/cron-on-Free if the remote step is denied; real Turnstile widget and live AI (Phase 05/10), documented]

Execute-agent instructions (non-gating; the plan text plus these are the contract):
- E1 Quota claim SQL: use numbered parameters so each value is bound once and reused (`?1..?n`), e.g. `INSERT INTO quota_counter (scope,key,window,count,updated_at) SELECT ?1,?2,?3,?4,?6 WHERE ?4<=?5 ON CONFLICT(scope,key,window) DO UPDATE SET count=count+?4, updated_at=?6 WHERE count+?4<=?5 RETURNING count`. The SELECT must keep its `WHERE` (SQLite parse rule for INSERT...SELECT...ON CONFLICT). No row returned = refused at cap; any D1 error THROWS. Red-first stubs cover first-claim-over-cap, at-cap, over-cap-after-claim, cap 0.
- E2 Create gate files exactly named as the tokens under `apps/worker/test/memory/<token>.test.ts` (include `s08-sql-surface.test.ts`, Step A1); run each token once red-first with the copied stubs to prove it matches a file before turning it green. `seams` and `proxy` are the existing files/dirs. A token containing another token as a substring is not allowed; none do today.
- E3 Seam preflight (orchestrator, before parallel work starts, one commit): add to `scripts/package.json` the `seed:gen`/`seed:check` scripts and the `@aduin/core` `workspace:*` dependency (skip if already present), root `package.json` `seed:gen`/`seed:check` delegating with `pnpm --filter @aduin/scripts`, one `pnpm install`, commit `pnpm-lock.yaml`. Phase 02 adds only `fixtures:build`/`fixtures:check` to the same `scripts` object afterwards (re-read the file, anchor the edit on an exact existing line; never rewrite the whole manifest). If preflight is not done, whichever phase edits first does the one-key edit and re-checks the file before each edit. Observed at validation time: Phase 02 has already added `fixtures:build`/`fixtures:check` (uncommitted) and removed `--passWithNoTests` from `packages/core/package.json` `test:seeded`, so preflight is already partly moot: 04b adds its own keys with an exact-line Edit on top of that state and does not touch Phase 02 lines; the shared manifests (`scripts/package.json`, root `package.json`, `pnpm-lock.yaml`) are committed only in an orchestrator-run seam commit that may carry both phases' keys, never staged by one phase alone with the other phase's half-done keys.
- E4 Parallel hygiene with Phase 02 (same working tree): each phase commits only its own paths (`git add <paths>`, never `git add -A` or `.`); whole-repo gates (`pnpm typecheck`, `pnpm lint`, `pnpm guard:cf`, `pnpm secrets:scan`) run at the end of the phase on a quiescent tree, or are scoped during work (`pnpm --filter @aduin/worker typecheck`, `pnpm exec prettier --check apps/worker scripts/src/seed`); a red caused by files the other phase owns is waited out and retried, never fixed here.
- E5 Mask boundary: `apps/worker/src/memory/mask.ts` only wraps `mask`/`sensitiveSpans` imported from the `@aduin/core` barrel; never edit `packages/core/src/memory/mask.ts` (Phase 02, A6). 04b gates must pass on the core before and after the widening: canaries are 9-digit runs (masked by the current regex); no IBAN, alpha-prefixed or over-31-digit assertions in 04b (that stays core follow-up F3 and Phase 02 `mask-widening`).
- E6 Pattern keys in 04b tests and the seed are lowercase, digit-free, charset `[a-z0-9:#>-]`, at most 80 chars, never containing `|` (compatible with Phase 02's `patternKey` spec and with the `proposal_key` delimiter).
- E7 Pattern routes: simplest seam is teaching `route()` to accept `:param` paths (exact-match first, then patterns) with the params passed as an optional 4th handler argument, so existing handlers and the `App` type stay compatible; if a new `App` member is added instead, update `recordingApp` in `test/seams.test.ts` in the same step. `GET /api/health` stays `{ok:true}`; the 04b stub cases in `seams.test.ts` change in the same commit as `app.ts`.
- E8 Memory routes verify the cookie with `verifyCookie` (via `configFor` keys) and require `w`/`a`; they must NOT call `resolveVisitor`, which mints a fresh visitor when the cookie is missing. Only `POST /api/session` mints (kind `sandbox`), through `resign(claims, {w, a, exp})`.
- E9 `index.ts` lazy build: `capFor(configFor(env))` inside a try; a config error or missing `env.DB` falls back to `unavailablePlatform()` and `memory_unavailable`, never throws at import; wrap `capFor` so `session_new` has its caps; export `scheduled()`.
- E10 Spike ledger: before DONE, S5 and S8 (local), S9, S10 (APPROVED-REMOTE, else INCONCLUSIVE-LOCAL) are real verdict rows, not `DEFERRED(04b)`; `pnpm --filter @aduin/scripts spike:check` must exit 0.
- E11 After editing `wrangler.jsonc` (`triggers.crons`, purge vars) run `pnpm guard:cf`; `database_id` placeholder untouched; no `routes` key.

Dimension findings:
- Infra fit: PASS — all 04a/00/01 symbols the plan reuses exist; migrations/triggers/partial index/json_each/composite FK feasible on local D1 (probed in pass 1); `createApp` pattern-route, lazy `index.ts` wiring, `GET /api/memory/health`, `scheduled()` and the `triggers.crons` key are declared as seam edits with no second writer; plugin package name corrected (P-V2).
- Test coverage: PASS — 33 one-token no-`--` gates (+ `s08-sql-surface`) each map to a planned file; all behaviors have a Fully-Automated or Hybrid gate (no behavior rests on Known-Gap alone); vacuous-green hazard closed (unmatched token exits 1); AI fence gate corrected to the real 04a semantics (P-V1); F5/F14/F7/DV1 covered.
- Breaking changes: PASS — no core contract edit (A0 worker-side derivation); `seams.test.ts` and `recordingApp` updates declared; `/api/health` unchanged; `/api/quota` and all 04a proxy files untouched (imports only); Phase 08b consumers see the frozen paths plus the `/firms/:id` alias.
- Security surface: PASS — R1 and free-text masking, single `__Host-aduin_v` cookie with `v`/`t` preserved, Origin/header/body-cap guards, workspace-bound `RulesPort`, cap-safe quota SQL (re-probed), `session_new` caps, sandbox liveness per request, `seed_mode` fail-safe, AI stays fail-closed (Turnstile before claims), APPROVED-REMOTE limited to spike resources with no secrets, evidence pack + STRIDE/vc-scenario review planned.
- Section A Spikes feasibility: PASS — S5/S8 local first on a draft schema, S9/remote S8/S10 after B1, verdict rows and `spike:check` wired; INCONCLUSIVE-LOCAL fallbacks pre-adopted.
- Section B Migrations feasibility: PASS — 20 tables (9+8+3), composite FKs decoupled from best-effort `finding`, partial `uq_rule_proposal`, guarded update trigger; highest-risk edit `decision_guard_update` (list every immutable column).
- Section C Ports feasibility: PASS — port signatures match the code; guarded claim re-probed cap-safe; F5, F14, workspace-bound rules, window parsing, `capFor` wrap; highest-risk edit the atomic claim statement (E1).
- Section D Repo/endpoints feasibility: PASS — pattern routes, guards, single cookie (E8), idempotent replay, A0 derivations, D-5; highest-risk edit the dismissal batch (audit first, supersede, insert, state upsert, proposal) under `db.batch`.
- Section E Seed and tests feasibility: PASS — generator path race with Phase 02 closed (P-V4), `seed:*` keys and `@aduin/core` dependency declared (P-V3, E3), `.sql` scan from `seed:check`, F7 closure via `memory-label-parity`.
- Blast radius vs Phases 00/01/02/03/04a: PASS — disjoint from 02 (`apps/worker`, seed, migrations, `scripts/src/{seed,spikes}` vs `packages/core`, `apps/web`, `fixtures/*`, `scripts/src/fixtures`); the only shared file is `scripts/package.json` (different keys, E3); worker mask path distinct from core mask path (b); 04a files import-only.

Open gaps:
- Remote-only facts (rows-written on real D1, cold-start CPU, shared 50-query budget, cron on Free) are Hybrid under APPROVED-REMOTE; if denied: `INCONCLUSIVE-LOCAL` with the pre-adopted fallbacks (chunked IN of 90, app-layer enforcement, child-first deletes, lazy purge, findings persistence opt-in, session seed copy skipped).
- known-gap: real Turnstile widget and live AI behavior are out of 04b (Phase 05/10); the fence is proven by `ai-fail-closed-without-secrets`.
- No gap is deferred to the backlog. Registry follow-up (orchestrator): amend seam rule D2 to cover the 04b `app.ts` pattern-route and `index.ts` lazy-wiring edits (no second writer, so no conflict).

What This Coverage Does NOT Prove:
- `migrations`/`triggers`/`explain-lookup`/`decision-*`: local Miniflare D1 only (DO-SQLite), not the remote D1 engine, remote migration application via `wrangler d1 migrations apply --remote`, or remote trigger/index behavior (Hybrid remote S8, Phase 10).
- `memory-no-cross-firm-or-workspace`/`sandbox-isolation`/`stale-cookie-invalid-session`: API-level isolation in workerd, not browser multi-context behavior (Phase 08 e2e) or cookie handling by real browsers (`__Host-`, SameSite).
- `demo-*` and `pnpm seed:check`: the seed from `_test-seed-spec.json` or the spec recorded in the committed header, not the final Phase 02/08 seed content or the AC34 zero-AI-call precompute match.
- `memory-storage-contract`: proves no stored column carries the canary text or an unmasked 6+ digit run for the tested inputs; it cannot prove masking of formats the core regex misses until Phase 02's widening lands (IBAN, alpha-prefixed, > 31 digits) or unknown free-text channels.
- `memory-retention-purge-test`/`cron-purge`: a fake clock and a synthetic cron trigger, not the real scheduler firing on Workers Free or purge duration under real data volume.
- `platform-contract`/`s05-quota-claim-atomicity`: local single-isolate concurrency, not multi-isolate races on remote D1 or the provider's own limits; the CLI probe proves the SQL shape, the worker test proves the bound-parameter form.
- `breaker-persist`: not the real OpenRouter served-model strings (F15, Phase 05/10 live probe).
- `query-budget`/`rows-written`: local counts; the remote calibration (S9) and the shared-50 rule are Hybrid; CPU is not measured (S10).
- `ai-fail-closed-without-secrets`: proves the fence in tests (and that `/api/quota` `global_ok` is not the fence for a missing `TURNSTILE_SECRET`), not a deployed Worker's secret inventory (Phase 10 lists account resources and secret names after deploy).
- `session-cookie-workerd`/`fingerprint-vectors`: workerd only; the Playwright browser bundle of the vectors stays with Phase 03.
- Evidence pack validator: proves the artifacts and a recorded decision exist, not that the automated reviewer's analysis is correct.
- Parallel execution with Phase 02: no gate proves the two phases' combined whole-repo state; the regression loop (E4) on a quiescent tree is the only combined check.

Gate: PASS (0 FAILs, 0 unresolved CONCERNs; 20 of 20 first-pass gaps verified resolved in the plan text, 1 new defect (AI fence assertion) and 3 small items fixed in the plan in this pass; residual items are non-gating execute instructions E1-E11)
Accepted by: session (autonomous, autopilot /goal execution); no concerns waived — the four plan-text corrections P-V1..P-V4 were applied, the remaining items are execute instructions E1-E11 and the named residuals above (remote Hybrid facts, real Turnstile and live AI in Phase 05/10).
