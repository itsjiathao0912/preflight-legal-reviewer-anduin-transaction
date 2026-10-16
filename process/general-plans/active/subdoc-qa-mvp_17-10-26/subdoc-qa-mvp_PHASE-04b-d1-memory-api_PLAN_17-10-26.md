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
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04b-d1-memory-api_REPORT_17-10-26.md

---

## Overview

D1 becomes the system of record for Review Memory (DATA-MODEL, 19 tables). This phase is the **single owner of all SQL**: migrations 0001–0004, the D1 implementation of the platform ports used by Phase 04a (`quota`, `cache`, `ledger`) and Phase 05 (`rules`), the workspace-scoped repository, the session/cookie endpoint with sandbox creation from the demo seed, memory endpoints (lookup, runs, findings chunks, decisions, revoke, counsel questions/answers, rules, firm memory, audit, export metrics), lazy retention purge, rule-proposal-on-write, and the demo seed generator. Every statement binds `workspace_id`; append-only is enforced by triggers; at most one active decision per (workspace, firm, fingerprint). It starts with spikes S5, S8, S9, S10 (definitions in Phase 00). Context routers: `process/context/all-context.md`, `process/context/tests/all-tests.md`; design source: `subdoc-qa-mvp_DATA-MODEL_17-10-26.md`.

## Phase Completion Rules

- CODE DONE = migrations, repo, endpoints, tests committed.
- VERIFIED = Exit Gate green on local D1 (pool-workers, real SQLite), validate-contract written, spike verdicts S5/S8/S9/S10 recorded (remote ones run unattended under the confirmed deploy policy: throwaway `aduin-transaction-spike-*` D1/Worker, deleted afterwards; else INCONCLUSIVE-LOCAL with fallbacks), regression: Phase 01 vectors, Phase 04a proxy suite green.
- Remote migration of the real `aduin-transaction-db` happens in Phase 10, not here.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC42 | Every decision stored with full record, append-only (UPDATE/DELETE fail) | `decision-record-contract` (property test over decision types) + `decision-append-only` | Fully-Automated | — |
| AC47 | Memory never crosses firms or workspaces | `memory-no-cross-firm-or-workspace` (API integration; two workspaces, two firms, composite-FK cross-insert) | Fully-Automated | browser e2e in P08 |
| AC50 [P1] | Reopen revokes (kept, audited) and the finding reappears as New | `memory-reopen-integration` (revoke endpoint + lookup) | Fully-Automated | UI e2e `memory-reopen-e2e` in P08b |
| AC53 [P1] | ≥ 3 same-pattern, same-reason dismissals propose a rule; 2, or 3 with different reasons, or another firm, do not | `rule-proposal-threshold-matrix` | Fully-Automated | UI in P08b |
| AC55 | Append-only audit trail (who, when, why; no edit/remove) | `audit-trail-append-only` (triggers + `GET /api/audit`) | Fully-Automated | viewer e2e closes P08 |
| AC56 | Per-visitor sandbox isolation; simulated analyst name | `sandbox-isolation` (two sessions) | Fully-Automated | browser e2e P08 |
| AC57 | Demo workspace seeded, protected, never bound to a cookie; sandbox is a copy | `demo-workspace-not-polluted` + `demo-seed-copy-effects` (seed → sandbox lookup shows prior decisions) | Fully-Automated | UI effects closes P08/P10 |
| AC58 | Server keeps only snippets, hashes, metadata; sensitive values masked; retention purge; demo exempt | `memory-storage-contract` + `memory-retention-purge-test` | Fully-Automated | — |

Contributes: AC38 (server purge), AC41 (D1 firm list parity with `fixtures/memory/law-firms.json`), AC43 (server lookup incl. revoked never matching), AC6 (DB CHECK: dismiss requires reason), AC40 (query budget assertions).

## Entry Gate

- Phase 00 and Phase 01 verified (contracts and ports frozen; cookie helper; vectors; `law-firms.json`).
- Phase 02 outputs (`demo-seed-spec.json`) are NOT required to start: this phase ships its own minimal `fixtures/memory/_test-seed-spec.json` and regenerates the real seed when Phase 02 lands (final regeneration in Phase 08/10, CI diff).

## Library pins (confirm via vc-docs-seeker in Phase 00)

wrangler (`d1 migrations apply`, `d1 execute --local`), D1 client API (`prepare`, `bind`, `batch`, `meta.rows_written`), @cloudflare/vitest-pool-workers (`readD1Migrations`, `applyD1Migrations`), @noble/hashes, zod.

## Step A spikes (run first)

S5 (atomic counter via upsert + RETURNING; quota/cron facts), S8 (SQL surface: `json_each` single param, 100-param cap, partial unique index via EXPLAIN, triggers with RAISE, WITHOUT ROWID + composite FKs, defer FK, trigger vs purge DELETE, shared 50-query budget), S9 (rows-written calibration on a throwaway remote D1), S10 (cold-start CPU of memory path; validator choice). Definitions, pass and kill criteria: Phase 00 table. Fallbacks pre-adopted: chunked `IN` lists of 90; app-layer enforcement and tests instead of triggers; explicit child-first deletes; lazy purge only; findings persistence opt-in; session seed copy skipped (read-only demo).

## Touchpoints (create)

```
apps/worker/migrations/
  0001_reference_and_workspace.sql   app_meta, law_firm, law_firm_alias, issue_class, workspace, analyst, fund, document, review_run
  0002_memory_core.sql               decision (+indexes, triggers), finding, finding_state, counsel_question, counsel_answer, firm_rule, rule_evidence, audit_event (+triggers)
  0003_reference_seed.sql            law firms + aliases (generated from fixtures/memory/law-firms.json), issue classes (15)
  0004_cache_quota_ledger.sql        ai_cache, quota_counter, spend_ledger
  (same four-file shape as DATA-MODEL; ordering adjusted so foreign keys are created child-after-parent where practical; schema_version set last)
apps/worker/seed/demo.sql            generated, committed
apps/worker/src/db/{ids.ts,tx.ts,meta.ts (rows_written, query counter)}
apps/worker/src/platform/{index.ts (fills createD1Platform),quota.ts,cache.ts,ledger.ts,rules.ts}
apps/worker/src/memory/{ctx.ts,repo/{workspace,fund,document,run,finding,decision,counsel,rules,audit,purge,lookup}.ts,proposal.ts,seed-copy.ts,health.ts}
apps/worker/src/routes/memory/{index.ts (fills mountMemoryRoutes),session.ts,lookup.ts,runs.ts,decisions.ts,counsel.ts,rules.ts,firm.ts,audit.ts,export.ts,health.ts}
apps/worker/test/memory/**
scripts/src/seed/{gen-demo-seed.ts,check-seed.ts}                 root `pnpm seed:gen`, `pnpm seed:check`
scripts/src/spikes/{s05-counter,s08-sql-surface,s09-rows-written,s10-cpu}/
fixtures/memory/_test-seed-spec.json
```
Seam edits (single lines): `apps/worker/src/app.ts` wires `mountMemoryRoutes` and `createD1Platform`.

## Public Contracts

- Endpoints exactly as `contracts/memory.ts`: `POST /api/session`, `POST /api/memory/lookup`, `POST /api/runs`, `POST /api/runs/:id/findings` (≤ 50 per chunk), `POST /api/decisions`, `POST /api/decisions/:id/revoke`, `POST /api/counsel/questions`, `POST /api/counsel/answers`, `GET/POST /api/rules` (+ `/approve`, `/reject`, `/revoke`), `GET /api/memory/firms/:id`, `GET /api/audit`, `POST /api/runs/:id/export`, `GET /api/health` (schema version; writes refuse with 503 on mismatch). Optional `GET /api/memory/export` is a stretch, not an AC.
- No endpoint accepts a workspace id from the client; every repo function takes `ctx.workspaceId` from the verified cookie; cookies are issued only for `kind='sandbox'`.
- Worker re-computes `fingerprint` on every decision write from `quote_text` (core function) and returns `422 fingerprint_mismatch`; the full quote is dropped after hashing; stored `quote_snippet` ≤ 300 chars, masked.
- Every write batch inserts one `audit_event` first; a replayed `client_op_id` aborts the whole batch (idempotent outbox retries).
- Multi-row writes use `json_each` or chunking, never one INSERT per finding; worst endpoint ≤ ~20 D1 queries (limit 50).
- Retention (proposed defaults): sandbox sliding 7 days from last activity, max lifetime 30 days; `ai_cache` TTL 7 days; quota windows purged after 2 days; demo exempt; purge claimed at most once per hour from new sessions.
- Fail-closed: D1 error → memory endpoints return `memory_unavailable`; the proxy (04a) treats ports as down.
- Rule text is prompt context only; `proposed` rules never reach AI context (reads filter `status='active'`).
- `answered/unclear` decisions resolve to label New (counsel's reply did not resolve it).

## Blast Radius

`apps/worker/{migrations,seed,src/db,src/platform,src/memory,src/routes/memory,test/memory}`, `scripts/src/{seed,spikes/s05*,s08*,s09*,s10*}`, `fixtures/memory/_test-seed-spec.json`, seam line in `apps/worker/src/app.ts`. Disjoint from Phase 04a (`routes/proxy`, `proxy`, `upstream`, `limits`, `identity/turnstile.ts`, `test/proxy`, `test/fakes`) and Phase 02 (`packages/core`, `fixtures/memory/{fund-*,demo-seed-spec.json}`). Registry `## Phase 04b`.

## Data Flow

See DATA-MODEL flows (a)–(g): lookup (1 query, JSON array param), run/findings persistence (best-effort tier), dismiss batch (audit → supersede → insert → state upsert → proposal check), counsel answer batch, revoke batch, rule approval, sandbox creation (`INSERT … SELECT` from `ws_demo` with ids `sandboxId||':'||seedId`), lazy purge (claim slot, set-based deletes in dependency order while `workspace.status='purging'`).

## Failure Modes

Unique-index conflict → `409` with the current decision; trigger violation → `409`/`422`, never a crash; D1 over quota → read-only demo fallback for new sandboxes and `memory_unavailable` for writes (outbox in the client); schema mismatch → 503 on writes; purge over limits → bounded batches (≤ 50 workspaces per run).

## Implementation Checklist

### Step A — Spikes and facts
- [ ] A1. Author and run S8 local tests (pool-workers + real migrations draft); record verdicts; adopt fallbacks if needed (update this plan's steps via inner-loop refresh note).
- [ ] A2. S5 local concurrency test (20 parallel claims, cap 10); S10 local CPU proxy; S9 and remote S8/S10 on a throwaway `aduin-transaction-spike-db` / Worker (delete afterwards; confirm absence).

### Step B — Migrations and reference data
- [ ] B1. Write 0001–0004 following DATA-MODEL DDL (composite PK `(workspace_id, id)`, `WITHOUT ROWID`, composite FKs, CHECKs, `uq_decision_active` partial unique index, `ix_decision_page`, `ix_decision_pattern`, triggers `decision_no_delete` and `decision_guard_update` gated on `workspace.status='purging'`, audit/answer immutability triggers, demo-write-block triggers outside `seed_mode`).
- [ ] B2. `0003` generated from `fixtures/memory/law-firms.json` and the 15 issue classes; `app_meta.schema_version` set by the last statement of each migration.
- [ ] B3. Tests: migrations apply cleanly; `EXPLAIN QUERY PLAN` for lookup shows `uq_decision_active`; cross-workspace composite-FK insert fails; `decision` UPDATE/DELETE fail; revoked/superseded transitions only `active → superseded|revoked`.

### Step C — Platform ports (SQL)
- [ ] C1. `platform/quota.ts`: atomic claim (`INSERT … ON CONFLICT … DO UPDATE … WHERE count+? <= cap RETURNING`), refund, window purge; `platform/cache.ts` (read, write, TTL purge; no write on hit); `platform/ledger.ts`; `platform/rules.ts` (active rule texts per firm, ordered, for Phase 05).
- [ ] C2. Contract tests run the same suite used on the Phase 04a fake (`test/fakes/platform.ts` semantics) against the D1 implementation.

### Step D — Repository and endpoints
- [ ] D1. `memory/ctx.ts` (verify cookie, build `ctx`), repo modules; statement-lint test: every SQL string in `memory/repo` and `platform` contains `workspace_id` binding or is declared global.
- [ ] D2. `session.ts`: claim `session_new` per IP hash, Turnstile via `TurnstilePort`, create workspace + analyst, copy demo seed (≈ 6 queries, ≈ 20 with purge slot), issue `__Host-sid; HttpOnly; Secure; SameSite=Lax`, audit `session_created`; degrade path when write estimate is over budget (read-only demo mode, every write returns `read_only_demo`).
- [ ] D3. `lookup.ts`, `runs.ts` (+ findings chunks, labels re-resolved with core `resolveLabel`, best-effort), `decisions.ts` (+ revoke), `counsel.ts`, `rules.ts`, `firm.ts`, `audit.ts`, `export.ts` (sets `sheet_exported_at`, `sheet_question_count`, audit `counsel_sheet_exported`), `health.ts`.
- [ ] D4. `proposal.ts` inside the dismissal batch: `INSERT OR IGNORE` proposed `firm_rule` + `rule_evidence` for ≥ 3 distinct active dismissals with the same (workspace, firm, pattern_key, reason_code), reason ≠ `other`; `uq_rule_proposal` guarantees one proposal per key forever (rejected never re-proposed).
- [ ] D5. Purge (`memory/repo/purge.ts`): slot claim via `app_meta`, set-based child-first deletes, expired `ai_cache`/`quota_counter` rows; demo exempt; fake-clock test.

### Step E — Seed and tests
- [ ] E1. `gen-demo-seed.ts` computes fingerprints with core code from a `DemoSeedSpec`, emits `seed/demo.sql` wrapped in `seed_mode=1/0`; `pnpm seed:check` regenerates and diffs (CI).
- [ ] E2. Tests: `decision-record-contract` (fast-check over decision types), `decision-append-only`, `memory-no-cross-firm-or-workspace`, `sandbox-isolation`, `demo-workspace-not-polluted`, `demo-seed-copy-effects`, `memory-storage-contract` (no row with > 300-char snippet, no unmasked sensitive value, no full-text column), `memory-retention-purge-test`, `rule-proposal-threshold-matrix`, `audit-trail-append-only`, `memory-reopen-integration`, idempotent replay of `client_op_id`, query-count and `meta.rows_written` assertions per endpoint (counting wrapper in `db/meta.ts`), fingerprint vectors in workerd, `firm-list-parity` (D1 list equals `law-firms.json`).

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| migrations/schema | `pnpm --filter @aduin/worker test -- migrations triggers explain-lookup` | Fully-Automated | AC42, AC43 (lookup), AC47 |
| decisions | `pnpm --filter @aduin/worker test -- decision-record-contract decision-append-only` | Fully-Automated | AC42 |
| isolation | `pnpm --filter @aduin/worker test -- memory-no-cross-firm-or-workspace sandbox-isolation` | Fully-Automated | AC47, AC56 |
| demo | `pnpm --filter @aduin/worker test -- demo-workspace-not-polluted demo-seed-copy-effects && pnpm seed:check` | Fully-Automated | AC57 |
| storage/purge | `pnpm --filter @aduin/worker test -- memory-storage-contract memory-retention-purge-test` | Fully-Automated | AC58, AC38 (server) |
| audit/reopen/rules | `pnpm --filter @aduin/worker test -- audit-trail-append-only memory-reopen-integration rule-proposal-threshold-matrix` | Fully-Automated | AC55, AC50, AC53 |
| budgets | `pnpm --filter @aduin/worker test -- query-budget rows-written` | Fully-Automated | AC40 interim |
| parity/vectors | `pnpm --filter @aduin/worker test -- firm-list-parity fingerprint-vectors` | Fully-Automated | AC41 (server list), AC46 vectors in workerd |
| remote spikes | S9, S10 and remote S8 on throwaway resources | Hybrid (precondition: Cloudflare account, unattended allowed for `aduin-transaction-spike-*`) | rows-written and CPU calibration |
| regression | `pnpm --filter @aduin/core test && pnpm --filter @aduin/worker test -- proxy && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | earlier phases |

Failing stubs for red-first: `should reject UPDATE and DELETE on decision`, `should allow at most one active decision per workspace firm and fingerprint`, `should refuse dismiss without reason_code at the database level`, `should return fingerprint_mismatch when the client hash disagrees`, `should not let workspace A read workspace B decisions`, `should not write to the demo workspace outside seed mode`, `should propose a rule on the third same-reason dismissal and not on the second`, `should purge expired sandboxes and keep the demo`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `decision-record-contract`, `decision-append-only` | Fully-Automated | AC42 |
| `memory-no-cross-firm-or-workspace` | Fully-Automated | AC47 |
| `memory-reopen-integration` | Fully-Automated | AC50 |
| `rule-proposal-threshold-matrix` | Fully-Automated | AC53 |
| `audit-trail-append-only` | Fully-Automated | AC55 |
| `sandbox-isolation` | Fully-Automated | AC56 |
| `demo-workspace-not-polluted`, `demo-seed-copy-effects` | Fully-Automated | AC57 |
| `memory-storage-contract`, `memory-retention-purge-test` | Fully-Automated | AC58 |
| S9/S10 remote calibration | Hybrid | AC40 (residual: local D1 is not remote quota) |

```bash
pnpm --filter @aduin/worker test && pnpm seed:check && pnpm guard:cf && pnpm secrets:scan
# Expected: all exit 0
```

## Exit Gate

- All gates green; spike verdicts and any adopted fallbacks recorded; migration list and schema hash in the report.
- No remote D1 other than throwaway spike resources was touched; throwaway resources deleted.
- Phase report written.

## Risks and Kill Criteria

- M1 D1 100k rows-written/day: S9 estimate > 2× → findings persistence opt-in, seed copy skipped.
- Unverified D1 SQL features (S8): fallbacks above; correctness never depends on triggers alone (app-layer checks plus tests).
- M3 sandbox-minting abuse: `session_new` counter plus Turnstile hook.
- Schedule risk (M12): Tier-2 items in this phase (revoke, rule proposal) are small; if time is short keep AC50 and AC53 backend, defer UI (Phase 08b).

## Cost / Secret Hygiene

No LLM/OCR calls. Cookie signing key from `env` only; no secret in migrations, seeds or logs (logger redaction helper from Phase 04a is reused when present, else a local one). Cloudflare names `aduin-transaction-*`; no zone/route; no remote migration of the real DB in this phase.

## Rollback

Migrations are forward-only: roll back by dropping the local DB and reverting commits; remote rollback is not needed because the real DB is created in Phase 10. Throwaway spike resources are deleted by name.

## Blockers That Would Justify BLOCKED Status

- A core contract (Phase 01) cannot express a memory operation (contract-change note).
- Local D1 under pool-workers cannot execute triggers/partial indexes (S8 fails and the fallback loses AC42/AC55 guarantees) → route to the user.

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S1 (worker, core, scripts), S2 (schema/migration, identity), S4, S6 (identity, schema, secrets), S7 → 5/7 HIGH. Recommended: sequential for migrations then repo (tightly coupled), plus a read-only security reviewer (vc-security, vc-scenario for tenant isolation and sandbox minting) before PVL; agent-team only if run concurrently with Phase 02 and a contract question appears (shared TaskList). Sonnet for research/validation/review, opus for code execution.

## Test Infra Improvement Notes

(none identified yet) — candidates: D1 query-counting wrapper and rows-written assertion helper (shared with Phase 05).

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04b-d1-memory-api_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next Step: after Phases 00 and 01 are verified, spawn vc-research-agent; run spikes in Step A first. Runs parallel with Phase 02. Phase 05 and Phase 08 consume the ports, rules read and endpoints.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
