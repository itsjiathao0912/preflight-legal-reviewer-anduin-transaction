---
phase: phase-04b-d1-memory-api
date: 2026-10-17
status: COMPLETE_WITH_GAPS
feature: subdoc-qa-mvp
plan: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04b-d1-memory-api_PLAN_17-10-26.md
---

# Phase 04b — D1 schema, platform ports, session, memory API, seed: EXECUTE report

**TL;DR.** D1 is now the system of record for Review Memory. Migrations 0001-0004 create the 20 tables, the SQL ports back the 04a proxy, and 19 memory routes are live behind the cookie. All 34 gate tokens pass locally, as do the full worker suite (405 tests), `seed:check`, core tests and the whole-repo gates. The remote spikes ran on throwaway resources that were deleted afterwards. The one open item is the independent reviewer's decision on the evidence pack, which the orchestrator owns. Nothing was committed.

## Mid-implementation progress note (written at about 50%)

- 50% point: seams, migrations, seed generator, ports, repo, routes, `app.ts` pattern routes, lazy `index.ts`, cron done; all 32 gate files created and run red once; `s05`, `s08`, `seams`, `memory-endpoint-contract` green.
- Deviation found by then: the lookup needed `INDEXED BY uq_decision_active` (S8). Handled within the blast radius; listed under Plan Deviations.

## What Was Done

- **Seams (E3, one key per edit):** `scripts/package.json` got `seed:gen`, `seed:check` and the `@aduin/core` `workspace:*` dependency (Phase 02's `fixtures:*` keys were not touched). Root `package.json` got `seed:gen`/`seed:check`. One `pnpm install` was run (lockfile +3 lines). `apps/worker/src/app.ts` gained `:param` routes: exact match first, params passed as an optional 4th handler argument, `App` type unchanged. `apps/worker/src/index.ts` builds the app lazily per D1 binding, falls back to `unavailablePlatform()`, and exports `scheduled()`. `wrangler.jsonc` got `triggers.crons` `["17 3 * * *"]` (the placeholder `database_id` is untouched; `guard:cf` OK). Also updated: `vitest.config.ts` (migrations + seed passed as bindings), `test/setup.ts` (idempotent migrate + seed), `test/env.d.ts`, `test/seams.test.ts`.
- **Migrations:** `0001_reference_and_workspace.sql` (9 tables), `0002_memory_core.sql` (8 tables, 26 triggers), `0003_reference_seed.sql` (generated from core `LAW_FIRMS`, `ISSUE_CLASSES` and `normalizeFirmAlias`), `0004_cache_quota_ledger.sql` (3 tables). That is 20 tables and 18 indexes. `schema_version` is set by the last statement of each migration (final value `4`).
- **Seed:** `scripts/src/seed/gen-demo-seed.ts` uses core fingerprint/mask code, records its spec path, and writes `apps/worker/seed/demo.sql` wrapped in `seed_mode=1/0`. `scripts/src/seed/check-seed.ts` regenerates from the recorded path, diffs, and scans every `.sql` with the guard `scanText`. Test spec: `fixtures/memory/_test-seed-spec.json` (synthetic, including the non-routable `001234567`).
- **Platform ports** (`apps/worker/src/platform/`): `quota.ts` (E1 guarded claim with numbered parameters; throws on D1 error; `ok:false` only at cap; refund clamps at 0), `cache.ts`, `ledger.ts`, `breaker.ts` (F14), `rules.ts` (only `createRulesPort(db, workspaceId)`), and `index.ts` (`createD1Platform`, `withSessionCaps`, `SESSION_CAPS`).
- **Memory layer** (`apps/worker/src/memory/`): `ctx.ts` (verifyCookie only, never mints; liveness plus schema/seed health in the first query), `mask.ts`, `health.ts`, `proposal.ts` (AC53 + D-5), `seed-copy.ts`, `http.ts`, and `repo/{workspace,fund,document,run,finding,decision,counsel,rules,audit,purge,lookup}.ts`. Every statement binds `workspace_id` or is declared global; two lint tests enforce this.
- **Routes** (`apps/worker/src/routes/memory/`): session, lookup, runs (+ findings), decisions (+ revoke), counsel questions/answers, rules (+ approve/reject/revoke), firm (canonical + `/firms/:id` alias), audit, export (run export + `GET /api/export`), and memory health. The A0 derivations are pinned at the top of `index.ts`.
- **DB helpers** (`apps/worker/src/db/`): `ids.ts`, `meta.ts` (query/rows metering wrapper), `tx.ts` (constraint-text classification).
- **Gates:** 32 files `apps/worker/test/memory/<token>.test.ts`, with the 20 verbatim TDD stubs copied first and each token run red once (each matched exactly one file). Helpers: `db-fixtures.ts`, `memory-harness.ts`, `budget-probe.ts`.
- **Remote spikes:** `scripts/src/spikes/s08-sql-surface/remote-worker.mjs` and `scripts/src/spikes/s09-rows-written/run-remote.sh`. Verdict rows are written to the SPIKE-RESULTS REF.
- **Risk evidence pack:** `process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-04b/` (5 files; reviewer decision pending).

Migration list (20 tables): app_meta, law_firm, law_firm_alias, issue_class, workspace, analyst, fund, document, review_run | counsel_question, counsel_answer, decision, finding, finding_state, firm_rule, rule_evidence, audit_event | ai_cache, quota_counter, spend_ledger.
Schema hash: `09b5c9e2cb4f9a8a` (sha256 prefix of the sorted `sqlite_master` SQL after 0001-0004). File hashes: 0001 `979272b85e5070c3`, 0002 `919ab9771e02f3e4`, 0003 `dafcabc312b6e74b`, 0004 `e29fb66f821d8f54`, seed `f9853beb0a0ec9a6`.

## What Was Skipped or Deferred

- F1 reviewer APPROVE: left pending per the orchestrator instruction. The orchestrator runs an independent reviewer and writes `harness/phase-04b/review-decision.json`.
- Real `aduin-transaction-db` creation, remote migration, seed and the production redeploy: Phase 10, as planned. Not touched.
- Real Turnstile widget and live AI: Phase 05/10.

## Test Gate Outcomes

One token per call, no `--`. Exact summary lines:

| token | result |
|---|---|
| s05-quota-claim-atomicity | rc=0, 1 file, 6 tests |
| s08-sql-surface | rc=0, 12 tests |
| migrations | rc=0, 5 |
| triggers | rc=0, 5 |
| explain-lookup | rc=0, 2 |
| decision-record-contract | rc=0, 85 |
| decision-append-only | rc=0, 2 |
| memory-no-cross-firm-or-workspace | rc=0, 5 |
| sandbox-isolation | rc=0, 3 |
| stale-cookie-invalid-session | rc=0, 3 |
| demo-workspace-not-polluted | rc=0, 4 |
| demo-seed-copy-effects | rc=0, 2 |
| memory-storage-contract | rc=0, 3 |
| memory-retention-purge-test | rc=0, 3 |
| audit-trail-append-only | rc=0, 3 |
| memory-reopen-integration | rc=0, 2 |
| rule-proposal-threshold-matrix | rc=0, 5 |
| idempotent-replay | rc=0, 2 |
| decision-without-persisted-findings | rc=0, 1 |
| memory-endpoint-contract | rc=0, 5 |
| platform-contract | rc=0, 10 |
| breaker-persist | rc=0, 3 |
| rules-port-scoped | rc=0, 2 |
| memory-guards-matrix | rc=0, 33 |
| session-cookie-workerd | rc=0, 5 |
| fingerprint-vectors | rc=0, 29 |
| cron-purge | rc=0, 3 |
| ai-fail-closed-without-secrets | rc=0, 4 |
| query-budget | rc=0, 2 |
| rows-written | rc=0, 3 |
| firm-list-parity | rc=0, 3 |
| memory-label-parity | rc=0, 1 |
| seams | rc=0, 6 |
| proxy | rc=0, 11 files, 141 tests |

- `pnpm --filter @aduin/worker test`: `Test Files 45 passed (45)`, `Tests 405 passed (405)`.
- `pnpm seed:check`: `seed:check: OK`.
- `pnpm --filter @aduin/core test`: `Test Files 36 passed (36)`, `Tests 277 passed (277)`.
- `pnpm typecheck`: core, worker, scripts and web all `Done`. `pnpm lint`: eslint clean, `All matched files use Prettier code style!`. `pnpm guard:cf`: `guard:cf: OK`. `pnpm secrets:scan`: `secrets:scan: OK`. These were run on the tree as it stood at the end of the phase; Phase 02 files were present and passing.
- `pnpm --filter @aduin/scripts spike:check`: `spike:check: OK (S1..S10)`.
- Risk validator on `harness/phase-04b`: one failure, `review-decision.json decision must be approved, approved-with-concerns, or rejected` (the decision is pending by design). On `harness/` root, the contract's literal command fails for every phase because no pack lives at the root (see Plan Deviations #14).

Measured budgets (local, through `db/meta.ts`):

- Queries: session 12, session with purge slot 29, runs 5, 50 findings 5, lookup of 200 fingerprints 2, dismissal with proposal 9, supersede 10, revoke 5, counsel answer 10, rule approve 4, firm 4, audit 2.
- AI worst path on the D1 platform: 9 queries + 2 fetches.
- Rows written: session 84, run 7, 50 findings 51, dismissal 17 (with proposal) or 8, revoke 5, answer 11.

## Spike verdicts (SPIKE-RESULTS REF rows written)

- **S5: PASS.** Local: 20 parallel claims against cap 10 gave exactly 10; a first claim over the cap is refused; at-cap and cap-0 cases behave. Remote: the claim ran inside the real session route.
- **S8: PASS-WITH-RISK.** Local and remote: foreign keys enforced, `json_each` with one parameter for 200 fingerprints, 100 bound parameters, triggers RAISE, composite FKs, batches atomic, purge deletes allowed only while `purging`. The constraint texts carry the same substrings locally and remotely. Risk: the local planner needed `INDEXED BY`. Remote budget probe: 55 D1 queries succeeded and 55 fetches failed. Cron schedule accepted on Free; firing not observed within 90 s.
- **S9: PASS-WITH-RISK.** Run 211 rows, decision 8, session 84 (target about 60; 1.4×, below the 2× kill line). Session caps pinned.
- **S10: FAIL(fallback).** 11–15 ms CPU on a worst-case 157 KB body, with or without zod. Fallback: client chunk size 25.
- Remote resources: `aduin-transaction-spike-db` and `aduin-transaction-spike-mem` on the existing `giathaowork` workers.dev subdomain. No secrets (`secret list` empty), no routes, no zone. Both were deleted, and `d1 list` plus `deployments list` confirm they are gone (also after an earlier attempt that failed deploy validation).

## Plan Deviations

14 deviations, all within the blast radius; full table in the plan `## Deviations`. The main ones: `INDEXED BY` on the lookup; no audit rows for runs, findings and questions (the frozen enum has no action for them); the session path with the purge slot at 29 queries; the rule revoke response maps to `rejected`; the read-only demo cookie `a='ro'`; extra columns (`result_json`, question firm/class, `settings_hash`); session caps pinned at 5/300; S10 chunk 25; consolidated spike files; validator path.

## Test Infra Gaps Found

- The contract's validator command targets the `harness/` root, which never holds a pack. Use `harness/phase-04b`.
- Vitest D1 storage is per test file and persists across tests inside a file. Tests that flip global `app_meta` (seed_mode, global session cap) must restore it inside the file. They do.
- `import.meta.glob` / `?raw` need type declarations in `test/env.d.ts` (added).

## Closeout Packet

- Selected plan: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04b-d1-memory-api_PLAN_17-10-26.md`.
- Finished: checklist A0–E2 and step 5 ticked; F1 pack written (decision pending).
- Verified: every local gate above; remote S8, S9 and S10 on throwaway resources.
- Not verified: real cron firing on Free; production-bundle CPU; the remote 101-parameter rejection text; real Turnstile and live AI.
- Files to commit (orchestrator; no `git add -A`): `apps/worker/{migrations,seed,src/db,src/platform,src/memory,src/routes/memory,test/memory}`, `apps/worker/{src/app.ts,src/index.ts,wrangler.jsonc,vitest.config.ts,test/setup.ts,test/env.d.ts,test/seams.test.ts}`, `scripts/src/seed`, `scripts/src/spikes/{s08-sql-surface,s09-rows-written}`, `fixtures/memory/_test-seed-spec.json`, the program folder's `harness/phase-04b/`, SPIKE-RESULTS REF, plan, and this report. Shared manifests (`package.json`, `scripts/package.json`, `pnpm-lock.yaml`) go in the orchestrator seam commit together with Phase 02's keys (E3).
- Closeout state: **Keep in active/testing** until EVL and the independent reviewer decision are recorded.

## Forward Preview

### Test Infra Found
- `apps/worker/test/memory/memory-harness.ts` (sessions, runs, decisions, findings over HTTP), `db-fixtures.ts`, `budget-probe.ts`, and `src/db/meta.ts` `meteredDb` for query/rows assertions (reusable by Phase 05).
- `test/setup.ts` applies migrations and the demo seed once per test file.

### Blast Radius Changes
- New: `apps/worker/src/{db,memory,routes/memory/*}`, the platform SQL ports, migrations, the seed. `app.ts` pattern routes (additive). `index.ts` lazy build + `scheduled()`.
- For Phase 05: build `createRulesPort(env.DB, ctx.workspaceId)` per request from the verified `w`; the cache key `rules_hash` comes from the port. For Phase 08: frozen paths plus the `/firms/:id` alias; run export uses a worker-local schema `{client_op_id, question_count}`; client findings chunk size 25 (S10); client ids should not carry free text; the rule revoke response reports `rejected`.

### Commands to Stay Green
- `pnpm --filter @aduin/worker test <token>` (one token per call), `pnpm --filter @aduin/worker test`, `pnpm seed:check` (run `pnpm seed:gen` after any change to the spec, firms or issue classes), `pnpm --filter @aduin/scripts spike:check`, `pnpm guard:cf` after `wrangler.jsonc` edits.

- Seed spec hand-off: Phase 02 has since added `fixtures/memory/demo-seed-spec.json` (uncommitted, Phase 02-owned). The committed `seed/demo.sql` records `_test-seed-spec.json`, so `pnpm seed:check` stays green. The next `pnpm seed:gen` (Phase 08/10 final regeneration, after 02 is verified) will select the Phase 02 spec and must be followed by a re-run of the `demo-*` and `memory-endpoint-contract` gates, whose firm counts come from the seed.

### Dependency Changes
- `@aduin/scripts` now depends on `@aduin/core` (`workspace:*`); lockfile +3 lines. No new third-party dependency.

Follow-up stubs created: none (both LOW residuals are recorded in `adversarial-validation.json` for the reviewer to classify). CONTEXT_PARTIAL: none.

## Fix cycle 1 (2026-10-17, review-decision.json APPROVE_WITH_FIXES: M1, L1-L6)

Base HEAD 7a7f421, no commit. Scope: apps/worker/** + harness/phase-04b/adversarial-validation.json + this plan/report. No edits to packages/core, apps/web, lockfile or package.json files; review-decision.json untouched.

### What was fixed
- **M1 write flood**: `memoryCtx(write:true)` (now `verifySession` + `resolveSession`) claims a per-workspace daily counter through the existing guarded quota_counter UPSERT right after liveness (scope `rate`, key `mw|req|<ws>|<day>`, cap 600). POST /api/runs also claims `mw|run` (cap 5/day), findings claim `mw|fnd` by chunk size (cap 2,000/day). Refusal: 429 `rate_limited` with reason `workspace_write_limit` / `workspace_run_limit` / `workspace_findings_limit` and retry-after; nothing is written. Caps live in code (`MEMORY_WRITE_CAPS`, apps/worker/src/platform/index.ts).
- **L1**: the session degrade path no longer refunds the per-IP claim.
- **L6**: at the global cap, a request carrying a live sandbox cookie gets that sandbox back (same w/a, kind sandbox) instead of the 'ro' cookie.
- **L2**: `parseWith` enforces `ID_RE` on `client_op_id` and `finding_ref` (400 `id_charset`); finding ids are checked against `ID_RE`; `anchor.blockId`, `detector_id`, `model` pass through `maskFree` before persisting.
- **L3**: new migration `0005_demo_protection_gaps.sql` (UPDATE triggers on review_run, counsel_answer, fund, document, analyst; DELETE triggers on firm_rule, rule_evidence, analyst, fund, document, review_run, finding, finding_state, counsel_question); schema_version '5'. 0002 untouched.
- **L4**: rule approve/reject/revoke use `AUDIT_SQL.insertIfRuleStatus` (audit row only if the rule is still in the expected prior status) and check the UPDATE's `meta.changes`; 0 → replayed result, else 409 `conflict_active_decision` with reason `rule_<current status>`.
- **L5**: every memory POST runs header guards → cookie signature check (no DB) → capped body read/parse → liveness (+ write claim). Findings chunks over 25 are 413 `payload_too_large` reason `findings_chunk`.

### Files changed
- src: memory/ctx.ts, memory/http.ts, memory/health.ts, memory/repo/audit.ts, memory/repo/finding.ts, platform/index.ts, routes/memory/{counsel,decisions,export,lookup,rules,runs,session}.ts
- migrations: 0005_demo_protection_gaps.sql (new)
- tests (new): test/memory/memory-write-limits.test.ts (11), test/memory/session-degrade-bounds.test.ts (3)
- tests (updated): budget-probe.ts, demo-workspace-not-polluted (+3 L3 tests), memory-endpoint-contract (schema_version 5), memory-guards-matrix (verify-first order), migrations (0005), query-budget / rows-written (findings_25), session-cookie-workerd (L1: IP claim kept)
- evidence: harness/phase-04b/adversarial-validation.json (+7 scenarios incl. the M1 write flood)

### Test gate outcomes (fresh run)
- 36 single-token runs (32 memory tokens + s08-sql-surface + the 2 new files + seams + proxy): all rc=0 (e.g. memory-guards-matrix 45, query-budget 2, rows-written 3, demo-workspace-not-polluted 7, memory-write-limits 11, session-degrade-bounds 3, proxy 141, seams 6).
- `pnpm --filter @aduin/worker test`: 47 files / 434 tests passed.
- `pnpm seed:check` OK; `pnpm typecheck` OK; `pnpm lint` OK (eslint + prettier); `pnpm guard:cf` OK; `pnpm secrets:scan` OK; validate-risk-artifacts.mjs on harness/phase-04b: 0 warnings, 0 failures.

### Deviations
Recorded in the plan under `## Deviations` → "Fix cycle 1 deviations" (verify-first changes 413/400 to 401 for cookie-less requests; findings_50 → findings_25 budget key; L4 409 carries status in `reason` because the frozen ConflictBody `current` is an ActiveDecision; schema_version 5; maskFree instead of charset rejection for blockId/detector_id/model).

### Forward preview additions
- Phase 10 must apply migrations 0001-0005 (writes are 503 until schema_version is 5) and set TURNSTILE_SECRET (L6 note).
- The web client must send findings in chunks of at most 25 (it already does per S10) and handle 429 `workspace_*_limit` as a soft failure in the outbox.
- review-decision.json `pendingFixes` still lists M1, L1-L6; the reviewer (not this agent) should re-review and move them to `resolvedFindings`.

## Fix cycle 2 (2026-10-17, re-review APPROVE_WITH_FIXES: N1-N4, N6)

### What was fixed
- N1/M1: global weighted daily write-row budget (40,000 units/day, `mw|rows|<day>`) claimed in `resolveSession` after the per-workspace claim; 429 `memory_write_budget` with retry-after to next UTC day; sessions/AI/OCR not charged. Mint-and-flood scenario added to harness/phase-04b/adversarial-validation.json.
- N2: rule lost-race 409 is now `ConflictError(null)` (frozen ConflictBody, `current: null`).
- N3: `runsPerDay` 40; run claim after firm validation.
- N4: end-to-end race test (competing approve injected between `ruleById` and the batch via a D1 proxy seam): 409 ConflictBody, exactly one audit event.
- N6: live sandbox reuse before the per-IP claim (0 rows, no IP claim); ro cookie never reused as a sandbox.

### Weights (units = max rows written, from rows-written bounds)
| Route | Units |
|---|---|
| POST /api/decisions | 25 |
| POST /api/runs | 12 |
| POST /api/runs/:id/findings | n + 5 |
| POST /api/counsel/answers | 18 |
| every other memory write | 10 |

Worst case/day: <= 40k memory rows + <= ~6.7k budget-counter rows + 36k session rows + AI/OCR rows -> ~83k + AI/OCR, under 100k.

### Files changed
apps/worker/src/{memory/ctx.ts, memory/http.ts, platform/index.ts, routes/memory/{counsel,decisions,rules,runs,session}.ts}; apps/worker/test/memory/{memory-write-limits,query-budget,rows-written,session-degrade-bounds}.test.ts; harness/phase-04b/adversarial-validation.json; this report and the plan.

### Test gate outcomes (fresh run)
- memory-write-limits 17, session-degrade-bounds 5, memory-guards-matrix 45, rows-written 4, query-budget 2, rule-proposal-threshold-matrix 5, memory-endpoint-contract 5, demo-workspace-not-polluted 7, session-cookie-workerd 5, sandbox-isolation 3, proxy 141 (11 files): all rc=0.
- `pnpm --filter @aduin/worker test`: 47 files / 443 tests passed.
- typecheck, lint (eslint + prettier), guard:cf, secrets:scan, seed:check: OK; validate-risk-artifacts on harness/phase-04b: 0 warnings, 0 failures.

### Deviations
Plan `## Deviations` -> "Fix cycle 2 deviations" (counsel answer weight 18; chunk check before claims; run_export query cap 7; L4 reason-note superseded by N2).

### Forward preview additions
- Web outbox should treat 429 `memory_write_budget` like `workspace_*_limit` (soft failure, retry next day).
- review-decision.json was not edited; the reviewer should move N1-N4/N6 to resolved.

