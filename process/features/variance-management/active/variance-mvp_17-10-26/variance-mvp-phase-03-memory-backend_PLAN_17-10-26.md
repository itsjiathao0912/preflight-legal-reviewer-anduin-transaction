---
name: plan:variance-mvp-phase-03-memory-backend
description: "Variance MVP Phase 03 (V3): memory backend (one forward-only D1 migration, additive memory contracts + snapshot note, Worker route/repo/weights/triggers, stub + real memory API + outbox, scope rule in memory/label.ts, hartwell-crane firm added atomically, worker and stack-memory tests)"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: variance-management
  phase: phase-03
---

# Phase 03 - V3 Memory backend

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** variance-mvp
**Umbrella plan:** process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-03-memory-backend_REPORT_17-10-26.md (flat in the program task folder)
**Risk class:** HIGH (schema/data migration on a live D1; public API contract change; trust-boundary logic: cross-firm and cross-workspace isolation; append-only guards). Manual-first evidence pack required (vc-risk-evidence-pack, 5 artifacts) under `process/features/variance-management/active/variance-mvp_17-10-26/harness/phase-03/`.
**Depends on:** Phase 01 (VERIFIED; supplies the assertion kind, rules caps, `questionKey`). Parallel-safe with Phase 02 (disjoint file sets). External: the Intake feature is CLOSED (live Worker 3d2c7301); Step 0 re-sync done 2026-10-17 (see Step 0 status below).
**Context routers read:** `process/context/all-context.md`, `process/context/worker/all-worker.md`, `process/context/engine/all-engine.md`, `process/context/tests/all-tests.md`.

---

## Overview

Gives variance the minimum server-side storage it needs and nothing else: owner and owner source on questions, intent and scope on answers and decisions, one append-only `regression_check` table, one new audit action, a scope rule for labels, and the Hartwell and Crane firm. Everything is additive and forward-only; old clients and a rolled-back Worker keep working because every new column is nullable.

Locked inputs: DECISION D5 (one migration, additive columns plus one table, recreated guard triggers, additive contracts, `scope_exists` only, regression checks returned inside the lookup response, no new route, no Dexie bump), D7 (firm). Read the DECISION file first. Frozen v1 rules: contracts are additive only; the contracts snapshot is regenerated only with a change note.

**Firm ownership deviation from DECISION D7 (observed reason):** `apps/worker/test/memory/firm-list-parity.test.ts` asserts that D1 `law_firm` rows and aliases equal `fixtures/memory/law-firms.json` exactly. Adding the firm to the JSON in Phase 01 would turn that test red until the migration lands. So the firm is added ATOMICALLY here: JSON entry, the migration `INSERT OR IGNORE` rows, and the parity test, in one commit. Core `LAW_FIRMS` follows the JSON automatically (it imports it). Entry (byte-identical to what Intake may add): id `hartwell-crane`, name "Hartwell & Crane LLP", aliases "Hartwell & Crane", "H&C". OBSERVED-IN-CODE (Step 0, 2026-10-17; Intake closed): Intake did NOT add this firm (its `hartwell` demo package is tagged `firm-x` and the three design demo packages are `firmId: null`), `law-firms.json` still has 3 firms (partners-group, firm-x, firm-y), so V3 is the sole owner; if that ever changes, the JSON edit is a no-op and the migration insert is `INSERT OR IGNORE`. V2 e2e must not depend on this firm; V4 and V5 do.

## Step 0 - Precondition: re-sync with Intake before EXECUTE

Re-sync with Intake's landed code (inner R+I refresh) before EXECUTE: read Intake's final PLAN and closeout and its landed diff; update the `## Dependencies on Intake` section of the umbrella (observed vs assumed to observed); re-allocate the migration number; re-check the collision files in the phase-blast-radius registry; write an `## Inner Loop Refresh Note` in this plan. EXECUTE may not start until the Intake feature is closed.

Phase-specific Step 0 checks: (a) **Migration number:** list `apps/worker/migrations/` at Step 0 and allocate the next free number. OBSERVED-IN-CODE (2026-10-17): `apps/worker/migrations/` = 0001..0005 (`0005_...sql:55` sets `schema_version` '5'; `scripts/src/dev-seed.ts:27` `EXPECTED_MIGRATIONS` = 0001..0005); Intake added no migration (browser-only persistence), so the expected number is 0006 and the expected `schema_version` is 6; still list the folder at EXECUTE, never assume. File name `00NN_variance.sql`; never edit a landed migration. Record the number in the umbrella and in the registry. (b) `app_meta.schema_version` handling: bump from the then-current value (expected 5 to 6); update `apps/worker/src/memory/health.ts` expectations and `scripts/src/dev-seed.ts` `EXPECTED_MIGRATIONS` together. (c) Diff Intake's changes to `contracts/memory.ts`, `routes/memory/*`, `memory/repo/*`, `api/{memoryApi,stubMemoryApi,realMemoryApi,outbox}.ts`, `contracts snapshot`; OBSERVED-IN-CODE: Intake did not change `contracts/memory.ts`, the contracts snapshot, `routes/memory/*`, `memory/repo/*`, `api/*`, the migrations, `law-firms.json` or `seed/demo.sql` (it touched only `apps/worker/src/proxy/pipeline.ts`, `upstream/openrouter.ts` and three proxy tests, none of them P03 files), so there is no overlap; the snapshot is one file, whoever lands second regenerates. (d) OBSERVED-IN-CODE: Intake added no D1 table or trigger (its new tables are Dexie), so there is no new `demo_ro_*` convention to follow beyond the existing ones.

**Step 0 additions (PVL cycle 1):** (e) **Phase 01 normalizer (C10):** confirm the ONE exported pure label normalizer that Phase 01 landed (expected: the named export `normalizeAssertionLabel` in `packages/core/src/variance/label.ts`, barrel-exported from the core index (NOT in `regression.ts`), which maps a scope label such as "Appendix C" to the lower-cased, whitespace-collapsed key of at most 80 chars). V3 IMPORTS it in the route and the web preview and NEVER writes a second normalizer; if the export is absent or differently named, record the real name here and stop (route back to PLAN-SUPPLEMENT). (f) **Hard-coded `schema_version` sites:** grep the repo for `'5'`-pinned schema_version at Step 0 and update every hit in the same commit as the migration; known sites are listed in Touchpoints (dev-seed self-check, `memory-endpoint-contract.test.ts`, `stack-memory-smoke.spec.ts`).

**Step 0 status (resolved 2026-10-17, PLAN-SUPPLEMENT; basis `variance-mvp_STEP0-RESYNC_17-10-26.md`, git HEAD 8a9398c).** Intake is CLOSED. This phase is clean against Intake: no overlap in contracts, snapshot, routes, repo, api, migrations, `law-firms.json` or the demo seed; the `schema_version` pin sites are unchanged (`scripts/src/dev-seed.ts:27`, `apps/worker/src/memory/health.ts`, `memory-endpoint-contract.test.ts`, `stack-memory-smoke.spec.ts`). Decisions recorded (orchestrator defaults, reversible): **D-S0-7** this phase still adds `hartwell-crane` ("Hartwell & Crane LLP", aliases "Hartwell & Crane", "H&C") atomically with the migration; V5 retags the Northgate demo package to it afterwards (the retag is not in this phase). New consumer check: the 4th firm reaches the Upload modal's firm combobox (it offers the firms in the generated `firms.json`) and Intake specs that enumerate firms, so the regression block gains the e2e tokens `intake-firm-tagging` and `intake-baseline-role-same-firm`, the web unit `package-confirm-table` and the core test `package-baseline-eligibility`. No web variance pass exists in this phase, so the Intake regression tokens `intake-demo-packages`, `package-gate-ui` and `gate-pill` live in the P02, P04 and P05 blocks. **D-S0-8** never git push in any phase. **D-S0-9** `.playwright-mcp/` and `.DS_Store` are not Variance's: never touch or commit them. Hook-filtered word rule: the Test Gates tokens contain neither hook-filtered word (the production output directory and installed-packages directory names).

## Phase Completion Rules

- CODE DONE = checklist A to J implemented and committed.
- VERIFIED = Exit Gate green, validate-contract written, evidence pack validated, regression evidence recorded (worker `migrations`, `triggers`, `rows-written`, `memory-write-limits`, `memory-guards-matrix`, `memory-storage-contract`, `demo-workspace-not-polluted`, `firm-list-parity`, `memory-label-parity`; core `contracts`; web `api-contract`, `outbox`, `stub-memory-api`; `stack-memory-*`). The migration is NOT applied to the remote D1 in this phase (that is V5, deploy slice).
- Known-Gap is never a proving strategy. The rows_written burst on the deployed path remains the operator residual R2 (backlog `phase10-d4-rows-written-burst`); the new write weight is proven by the local `rows-written` test.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy |
|---|---|---|---|
| AC-V14 (server part) | answer records option, note, intent, scope; scope firm_template refused without a non-blank intent (server-side; non-blank = non-whitespace AFTER masking); intent and assertion label are masked like `note` (AC58); records append-only (new columns immutable after insert) | `variance-answer-append-only` (worker, via `triggers`) plus `variance-answer-intent-rule` (worker, incl. whitespace-only and masked-empty intent) plus web `api-contract` plus web `outbox` (terminal scrub) | Fully-Automated |
| AC-V16 (server part) | regression check lookup is scoped by workspace_id AND law_firm_id; another firm or workspace never receives a check; cap per firm (route pre-check plus trigger backstop, three-way literal parity); server re-normalizes assertion key with the Phase 01 normalizer, enum kind, label at most 80 chars; assertion requires scope firm_template; a replayed answer (also at the cap) creates no second check; derived audit op id `#rc` cannot collide with a client id; lookup fetches checks only for non-empty fingerprints, deduplicated per 200-chunk | `variance-regression-no-cross-firm` (worker) plus stack-memory `stack-memory-variance-regression-no-cross-firm` | Fully-Automated |
| AC-V11 (persistence) | owner and owner_source (`suggested` or `override`) persisted at ask time; no new write path or audit action | `variance-owner-persisted` (worker) | Fully-Automated |
| AC-V19/L6 (provenance, retargeted) | a worst-case variance finding (provenance facts in `detail`) passes `FindingWireSchema`; every request body built by `realMemoryApi.storeFindings` stays at most `FINDINGS_BODY_CAP` (131,072 bytes) through a byte-aware split, with explicit byte arithmetic from V1's pinned caps. The Worker never persists `detail` (`detail_json` is bound NULL), so no 2000-char limit applies | `variance-finding-wire-size` (worker) | Fully-Automated |
| D5 scope rule | a decision with scope `fund` only counts for `already_answered` in the same `fund_name` | `variance-label-scope-rule` (core) plus `memory-label-parity` (worker) | Fully-Automated |
| Budget | measured `rowsWritten` of answer-with-assertion is at most its new weight (derived from a measurement; index entries counted); question creation adds 0 rows; lookup stays within the updated query pin (3) | `rows-written` (extended, own measurement, not via `measureEndpoints()`) plus `memory-write-limits` plus `query-budget` (pin 2 to 3) | Fully-Automated |
| Isolation of new table | `demo_ro_regression_check` insert, update, delete block writes to the demo workspace; delete blocked; only the status flip allowed | `triggers` (extended) and `demo-workspace-not-polluted` | Fully-Automated |
| Retention (F1) | a sandbox that holds a `regression_check` is purged by the hourly batch without aborting; `purging` exemption lets the child delete through the no-delete trigger | `memory-retention-purge-test` and `cron-purge` (both extended to seed a check) | Fully-Automated |
| Firm list dependents (F2) | `pnpm seed:check` stays green with the 4th firm; core `firms-and-rules` expects four ids; every `schema_version` site agrees | `seed:check`, core `firms-and-rules`, worker `firm-list-parity` and `memory-endpoint-contract`, `pnpm --filter @aduin/scripts test`, stack `stack-memory-smoke` | Fully-Automated |
| Label scope call sites (C6) | persisted `finding.memory_label` (Worker `runs.ts`) equals the client label (`fingerprintFindings.ts`) for a `scope = fund` decision recorded in another fund | `variance-label-call-sites` (worker) plus `variance-label-scope-rule` (core) | Fully-Automated |

## Entry Gate

- Phase 01 VERIFIED. Intake closed (Step 0). Migration number allocated and recorded.
- The remote D1 is NOT touched in this phase.

## Touchpoints

Create:
- `apps/worker/migrations/00NN_variance.sql` (number allocated at Step 0), content per DECISION D5. Exact shape:
  - `ALTER TABLE` nullable columns `counsel_question.owner` (CHECK in counsel|gp|fund_admin) and `owner_source` (CHECK in suggested|override), `counsel_answer.intent` (CHECK length <= 500) and `scope` (CHECK fund|firm_template), `decision.intent` and `scope` (same CHECKs).
  - DROP and CREATE `decision_guard_update` and `answer_guard_update` (copy the 0002 text verbatim, add the new columns so they are immutable). There is NO `counsel_question` guard trigger today (only `demo_ro_*`); decision: owner and owner_source are written once at INSERT with `ON CONFLICT DO NOTHING` (no upsert path), and a NEW trigger `question_owner_immutable` blocks any UPDATE of `owner`/`owner_source` (plus one matrix row in `triggers`).
  - `CREATE TABLE regression_check ... WITHOUT ROWID`: PRIMARY KEY (`workspace_id`, `id`); columns `id`, `workspace_id`, `law_firm_id`, `source_answer_id`, `source_fund_name`, `assertion_kind` CHECK = 'scope_exists', `assertion_key` CHECK length 1..80 (normalized label), `statement_text` CHECK length 1..300 (built server-side from kind and label, never client text), `status` CHECK active|revoked, `created_at`; composite FOREIGN KEY (`workspace_id`, `source_answer_id`) REFERENCES `counsel_answer` so a check cannot reference another workspace's answer; FK `law_firm_id` to `law_firm`; index `ix_regression_check_scope` on (`workspace_id`, `law_firm_id`, `status`). Table count becomes 21 (`migrations` test updated).
  - Triggers (names by existing convention): `regression_check_no_delete` (RAISE unless the workspace status is `purging`, copying the `0002` lines 204-241 exemption), `regression_check_guard_update` (only `status` flip active to revoked allowed; every other column immutable), `regression_check_cap` (BEFORE INSERT, aborts when the firm already has the cap of active rows in that workspace), `demo_ro_regression_check` (insert), `demo_ro_regression_check_update`, `demo_ro_regression_check_delete`.
  - Firm rows, `INSERT OR IGNORE`: `law_firm` (`hartwell-crane`, `Hartwell & Crane LLP`, `hartwell and crane`); `law_firm_alias` rows (`hartwell and crane`, `hartwell-crane`), (`hartwell crane`, `hartwell-crane`), (`h and c`, `hartwell-crane`); same columns as `0003_reference_seed.sql`.
  - `app_meta.schema_version` bump (same `ON CONFLICT DO UPDATE` form as 0003).
- `apps/worker/test/memory/variance-{answer-append-only,answer-intent-rule,regression-no-cross-firm,owner-persisted,finding-wire-size}.test.ts`
- `apps/worker/test/memory/variance-label-call-sites.test.ts` (C6 proof)
- `apps/web/e2e/stack-memory-variance-regression-no-cross-firm.spec.ts`
- `packages/core/test/unit/variance-label-scope-rule.test.ts`
- Evidence pack: `process/features/variance-management/active/variance-mvp_17-10-26/harness/phase-03/` (5 artifacts per vc-risk-evidence-pack)

Modify (additive, nullable, or optional):
- `packages/core/src/contracts/memory.ts` (`CounselQuestionRequest.owner?`, `owner_source?`; `CounselAnswerRequest.intent?` at most 500, `scope?` (`fund|firm_template`), `assertion?` (`{kind:'scope_exists', label}`); `ActiveDecision.intent?`, `scope?`; `MemoryLookupResponse.regression_checks?`; `AUDIT_ACTIONS` gains exactly `regression_check_created`; `answer_recorded` audit detail carries `scope` and the intent length, never text), `packages/core/test/__snapshots__/contracts.json-schema.snap` (regenerated WITH a change note in the phase report and the commit message)
- `packages/core/src/config/limits.ts` (additive: regression checks per firm cap; intent max 500)
- `packages/core/src/memory/label.ts` (scope rule: scope `fund` counts for `already_answered` only in the same `fund_name`)
- `fixtures/memory/law-firms.json` (add `hartwell-crane`; no-op if present)
- `apps/worker/src/routes/memory/{counsel,lookup,decisions}.ts`, `apps/worker/src/memory/repo/*` (insert owner/intent/scope, create the check and its audit row in the same batch, scoped SELECT of checks by `workspace_id` AND `law_firm_id` inside the existing lookup response), `apps/worker/src/memory/health.ts` (expected schema version), the file holding `MEMORY_WRITE_WEIGHTS` (locate at A3; new entry for answer-with-assertion), `apps/worker/src/platform/**` only if the weights live there
- `apps/web/src/api/{memoryApi,stubMemoryApi,realMemoryApi,outbox}.ts` (answer op carries the new optional fields; the stub enforces the same intent rule; outbox kinds `decide|answer|revoke` unchanged), `apps/web/test/{api-contract,outbox,stub-memory-api,realMemoryApi}.test.ts`
- Existing worker tests extended: `migrations`, `triggers`, `rows-written`, `memory-write-limits`, `memory-guards-matrix`, `memory-storage-contract`, `demo-workspace-not-polluted`, `firm-list-parity`, `memory-label-parity`
- `scripts/src/dev-seed.ts` (`EXPECTED_MIGRATIONS` and the migration log line; additive)
- **Declared dependents of the firm list and `schema_version` (F2):** `scripts/src/seed/gen-demo-seed.ts` (see Section C design: `buildReferenceSql()` filters `LAW_FIRMS` to a pinned `REFERENCE_0003_FIRM_IDS = ['partners-group','firm-x','firm-y']` so the regenerated 0003 stays byte-identical to the landed file and `pnpm seed:check` stays green with NO edit to 0003; later-migration firms live only in their own migration), `scripts/src/seed/check-seed.ts` (only if it asserts firm count; observed: it diffs `buildReferenceSql()` against 0003), `packages/core/test/unit/firms-and-rules.test.ts` (expect four ids), `scripts/src/dev-seed.ts` lines 105-106 (self-check `schema_version` '5' to the new value) plus `EXPECTED_MIGRATIONS`, `apps/worker/test/memory/memory-endpoint-contract.test.ts:275` (`'5'`), `apps/web/e2e/stack-memory-smoke.spec.ts:9` (`'5'`), `scripts/test/**` covering the generator (extended)
- **Retention (F1):** `apps/worker/src/memory/repo/purge.ts` (`PURGE_CHILD_TABLES` gains `'regression_check'` BEFORE `'counsel_answer'`; correct child-first order: `rule_evidence, finding_state, finding, firm_rule, decision, regression_check, counsel_answer, counsel_question, ...`), tests `memory-retention-purge-test` and `cron-purge` (extended to seed a check)
- **Error mapping and cap (C3):** `apps/worker/src/db/tx.ts` (`TRIGGER_TEXTS` whitelist gains the new `RAISE(ABORT, ...)` texts: check immutable, check append-only, cap exceeded, question owner immutable)
- **Budget coupling (C4, C5):** `apps/worker/src/platform/index.ts` (weights), `apps/worker/test/memory/query-budget.test.ts` (`lookup_200` pin 2 to 3, cap 3), `apps/worker/test/memory/budget-probe.ts` only if unavoidable (preferred: measure answer-with-assertion inside `rows-written.test.ts` with its own helper so `measureEndpoints()` keys and the `query-budget` key-set equality stay untouched)
- **Label scope call sites (C6):** `apps/worker/src/routes/memory/runs.ts:116`, `apps/web/src/memory/fingerprintFindings.ts:59`, `DECISION_COLS` and `toActiveDecision` in the worker decision repo (read `scope`), `apps/web/src/api/import-graph` ALLOWED list append only if `api/*` gains a core value import (C12)
- Contract snapshot module-list note only if a new schema is added (observed: memory contracts ARE in the snapshot; expect it to move)

Not touched in V3: `apps/web/src/{features,state,shell,engine}/**` (V2 and V4), `packages/core/src/{variance,counsel,findings,diff}/**`, `apps/worker/seed/demo.sql` (V5), remote D1, README, `docs/**`, `design/**`.

## Public Contracts

- All new request and response fields are OPTIONAL; old clients and an older Worker keep working (new columns nullable; rollback keeps them).
- One new `AUDIT_ACTIONS` value (`regression_check_created`); the enum snapshot moves with a change note.
- No new route; checks ride the existing lookup response (optional `regression_checks` array).
- `UNIQUE(workspace, review_run, finding_key)` unchanged; change findings use `<findingId>@<owner>` as `finding_key` (V1 helper), error findings keep the plain id.
- Append-only: nothing deleted, only status flips; the recreated guard triggers keep every previously guarded column guarded plus the new ones.
- No AI task, `AI_TASK_IDS` unchanged, 0 live calls.

## Blast Radius

Files directly modified or created: the Touchpoints list (1 migration, about 6 new tests, 1 stack spec, 8 core/worker/web source edits, 9 extended tests, evidence pack). Collision files with Intake: `contracts/memory.ts` and its snapshot, `apps/worker/migrations/`, `routes/memory/*`, `memory/repo/*`, `api/*`, `fixtures/memory/law-firms.json`, `scripts/src/dev-seed.ts` (Step 0 observed NO Intake change in any of them; see registry). Guarded surfaces: `contracts`, `migrations`, `triggers`, `firm-list-parity`, `api-contract`, `memory-no-cross-firm`.

## Implementation Checklist

### Section A - PLAN-time verifications (first tasks; record results in the phase report)

- [ ] A1. (retargeted, C1) Confirm the real wire limits for variance findings: `FindingDetailSchema` (explanation at most 1000, each string fact at most 1000, at most 6 interpretations of 500), `FINDINGS_BODY_CAP` (128 KB) and the 25-finding chunk cap. Observed: the Worker NEVER persists `detail` (`finding.ts` binds `detail_json` as NULL, R1; `memory-storage-contract` asserts no detail persisted), so the 2000-char `detail_json` CHECK never applies and there is no V3 wire builder. Confirm `detector_id` of the form `variance.<rule_id>` and `pattern_key` of at most 80 chars are accepted by the `finding` CHECKs (observed `pattern_key` CHECK length 1..80, `detector_kind` rule|ai). Cross-phase note: Phase 01 plan item F1 carries the same stale 2000-char premise; flag it in the phase report for the orchestrator.
- [ ] A2. Confirm `ActiveDecision.fund_name` exists and is required (observed: `contracts/memory.ts:62`, `z.string().max(200)`); the scope rule relies on it.
- [ ] A3. Locate `MEMORY_WRITE_WEIGHTS` (grep whole repo), the `rows-written` test and the `budget-probe.ts` helper; record the file paths used by this phase.
- [ ] A4. Allocate the migration number (Step 0 (a)) and confirm `app_meta.schema_version` handling and `scripts/src/dev-seed.ts` `EXPECTED_MIGRATIONS`.
- [ ] A5. Decide the scope-condition home (C6): the pure rule lives in `packages/core/src/memory/label.ts` as an additive optional parameter (see E1); the worker `runs.ts` and the web `fingerprintFindings.ts` both call that one function so parity is by construction, and `variance-label-call-sites` proves it. `memory-label-parity` only compares the enum to the CHECK list; do not claim it proves the rule.
- [ ] A6. Confirm `apps/worker/src/memory/seed-copy.ts` (sandbox copy of the demo workspace) needs no change: the demo workspace holds no `regression_check` rows (the demo seed is deliberately NOT changed in this program), so the copy list stays as is; check `demo-seed-copy-effects` and `sandbox-isolation` stay green after the migration.
- [ ] A7. Baseline green before edits: worker `migrations`, `triggers`, `rows-written`, `firm-list-parity`, core `contracts`, web `api-contract` (one token per call); record counts.
- [ ] A8. List every hit of `schema_version` pins and firm-count assertions (`grep -rn "'5'" scripts apps packages --include=*.ts` filtered to schema_version, and `grep -rn "firm-y"`) and confirm they equal the declared dependents in Touchpoints; any extra hit is added to the same commit.

### Section B - Contracts first (types shared by B to F)

- [ ] B1. `contracts/memory.ts` additive fields exactly as in Touchpoints. `scope firm_template` without a non-blank intent fails the request schema refinement; a second refinement (N5): `assertion` present requires `scope = 'firm_template'`, otherwise `invalid_request` (an assertion with scope `fund` or absent scope is refused; mirrored in `stubMemoryApi`, proven in `variance-answer-intent-rule`); non-blank means `intent.trim().length > 0` and the route re-checks AFTER masking (a whitespace-only or fully-masked-empty intent is refused with `invalid_request`). AC-V15 keeps intent human text only: the server never generates or edits it, but it DOES mask it (`maskOpt`, same as `note`, AC58). The `assertion.label` is also masked and normalized with the Phase 01 exported normalizer (Step 0 (e)); `statement_text` is NEVER a request field.
- [ ] B2. `limits.ts`: `regressionChecksPerFirm` (default 20, same value as the V1 rules config), `intentMaxChars` 500.
- [ ] B3. Regenerate the snapshot with the exact no-`--` form: `pnpm --filter @aduin/core test contracts -u` (the test uses `toMatchFileSnapshot`, which rewrites only under the vitest update flag), then re-run WITHOUT the flag (`pnpm --filter @aduin/core test contracts`) to prove byte-stability, record `shasum -a 256 packages/core/test/__snapshots__/contracts.json-schema.snap` before and after in the change note listing every moved schema. Gate: `pnpm --filter @aduin/core test contracts` (no flag) exits 0. The `-u` flag is the single permitted exception to the no-flag rule and applies only to this snapshot step.

### Section C - Migration (HIGH risk)

- [ ] C1. Write `00NN_variance.sql` exactly per Touchpoints (columns, WITHOUT ROWID table, composite FK, trigger names, firm rows). Every new column nullable; every CHECK as listed. The DROP and CREATE of `decision_guard_update` and `answer_guard_update` copy every column the originals guard (read `0002_memory_core.sql` lines 208 to 250) verbatim and add `intent`, `scope` (and `owner`, `owner_source` only where the table has them). Owner decision (C8): no `counsel_question` guard exists today, so add `question_owner_immutable` as specified; do NOT widen any existing guard.
- [ ] C2. `regression_check` triggers per Touchpoints. `regression_check_no_delete` carries the `status = 'purging'` exemption (F1) exactly as the peers in `0002` lines 204-241; the update guard allows only the status flip active to revoked (mirror `counsel_answer`); the cap trigger counts ACTIVE rows per (`workspace_id`, `law_firm_id`) and its literal equals `limits.regressionChecksPerFirm`; demo-workspace triggers named `demo_ro_regression_check`, `demo_ro_regression_check_update`, `demo_ro_regression_check_delete` (`demo-workspace-not-polluted` checks names).
- [ ] C3. Firm rows, `INSERT OR IGNORE`, spelled out: `law_firm` (`hartwell-crane`, canonical_name `Hartwell & Crane LLP`, name_norm `hartwell and crane`); `law_firm_alias` rows (`hartwell and crane`), (`hartwell crane`), (`h and c`) all to `hartwell-crane`; add the JSON entry (id, name, aliases `Hartwell & Crane`, `H&C`) in the same commit. Landed `0003_reference_seed.sql` is NEVER edited.
- [ ] C3b. (F2, generator design) `scripts/src/seed/gen-demo-seed.ts`: introduce `REFERENCE_0003_FIRM_IDS` (the three firms of landed 0003) and make `buildReferenceSql()` iterate only `LAW_FIRMS.filter(f => REFERENCE_0003_FIRM_IDS.includes(f.id))`, so the regenerated text equals landed 0003 byte for byte and `pnpm seed:check` stays green; the demo seed's `reference` block uses the same function (demo.sql is not changed in V3). Add a `scripts/test` case: the generated 0003 text contains no `hartwell-crane`, and every firm in `LAW_FIRMS` is either in the pinned list or inserted by a later migration (`grep` of `migrations/*.sql` in the test). Update `firms-and-rules.test.ts` to four ids, `dev-seed.ts` self-check and `EXPECTED_MIGRATIONS`, `memory-endpoint-contract.test.ts:275` and `stack-memory-smoke.spec.ts:9` to the new `schema_version`.
- [ ] C4. Gates (worker, one token per call): `migrations` (names list, table list now 21, WITHOUT ROWID assertion), `triggers` (matrix over old and new columns, question owner immutability, regression_check delete blocked outside `purging`, allowed inside), `firm-list-parity`, `demo-workspace-not-polluted`; plus `pnpm seed:check`, `pnpm --filter @aduin/scripts test`, core `firms-and-rules`.

### Section D - Worker route, repo, weights

- [ ] D1. `routes/memory/counsel.ts` and repo: store `owner`/`owner_source` at question creation (0 extra rows, `ON CONFLICT DO NOTHING`); store `intent`/`scope` on the answer and on the resulting decision row; derive server-side, NEVER from the body: `workspace_id` from the cookie, `law_firm_id` from the question row, `source_fund_name` from `run.fund_name`. When `assertion` is present and scope is `firm_template`: validate kind enum, normalize label with the Phase 01 normalizer, at most 80 chars, build `statement_text` server-side, PRE-CHECK the per-firm cap in the route (reason `regression_check_cap`, `invalid_request`; the trigger is the backstop). ORDER OF CHECKS (N1): first call `replayed(ctx, client_op_id)` (`apps/worker/src/memory/repo/audit.ts`); only when it finds nothing run the cap pre-check, so a replay of an already-recorded answer at the cap returns the original success and never `regression_check_cap`. Batch ORDER (C2): (1) audit `answer_recorded` with the request `client_op_id` (replay key), (2) the answer row, (3) the `regression_check` row (FK to the answer), (4) audit `regression_check_created` with the DERIVED distinct op id `<client_op_id>#rc` (N4: the delimiter `#` lies OUTSIDE `ID_RE`, so no valid client op id can equal a derived id; server-built, within the 80-char CHECK, never client-chosen; `audit_event` has `UNIQUE (workspace_id, client_op_id)`). A replayed answer hits the audit unique key first, so no second check and no second `#rc` row. Tests in `variance-regression-no-cross-firm` and `idempotent-replay`: (a) plain replay creates no second check; (b) replay-at-cap (firm already holds the cap of active checks, the same answer op is replayed) returns the original success, not `regression_check_cap`; (c) a forged client op id `X:rc` (and one containing `#`) is either accepted as an ordinary id or refused by `ID_RE`, and never collides with or suppresses the derived `X#rc` row of answer `X`. `answer_recorded` audit detail carries `scope` and the intent length, never the text.
- [ ] D2. `routes/memory/lookup.ts`: return optional `regression_checks` (ACTIVE checks for the caller's workspace AND the looked-up firm only; at most the cap; fields `id`, `assertion_kind`, `assertion_key`, `statement_text`, `source_fund_name`). The response is unchanged in shape; the web side consumes it through `lookupWithChecks` (F1). This is exactly one extra SELECT: update `query-budget` `lookup_200` from 2 to 3 (cap 3, `toBe(3)`) explicitly in `query-budget.test.ts`; leave `measureEndpoints()` keys unchanged.
- [ ] D3. Weights (C4): measure first. Add a measurement in `rows-written.test.ts` (own helper; real local D1 `meta.rows_written`, which counts index entries: `audit_event` unique op index plus `ix_audit_ws_time`, the `regression_check` PK and `ix_regression_check_scope`; expected about +5 over a plain answer) of an answer-with-assertion. Derive the new weight from that measured value (plain answer weight plus measured delta, no guessed +2). In `apps/worker/src/platform/index.ts` charge it through the `postEntry` weight FUNCTION: it receives the parsed body, so `assertion` present selects the larger weight, absent keeps `W.counselAnswer` 18 unchanged. Assertion restated: measured `rowsWritten` is at most the weight; question creation weight unchanged (0 new rows). Update `memory-write-limits` to pin the new weight.
- [ ] D4. (retargeted, C1; N3) Test `variance-finding-wire-size` (worker): build the worst-case variance finding from V1's PINNED adapter caps (Step 0 names the V1 symbols for explanation, fact and interpretation limits; read them, never retype them) and assert it passes `FindingWireSchema`. Write the byte arithmetic in the test as explicit named constants: `perFindingBytes = JSON.stringify(worstFinding).length` measured with `TextEncoder` (UTF-8 bytes, not string length), `chunkBytes = 25 * perFindingBytes + envelopeBytes`, compared with `FINDINGS_BODY_CAP` (131,072 bytes). The assertions are: (1) one worst-case finding passes the schema; (2) a 25-finding chunk is reported with its byte size and is asserted under the cap WHEN the arithmetic fits; (3) when `chunkBytes` exceeds the cap, the test instead asserts that `realMemoryApi.storeFindings` splits the batch so every request body is at most 131,072 bytes (see F1); (4) a single finding whose own body exceeds the cap is the V1-defect blocker (below); (5) the stored `detail_json` is NULL. The Worker adds no clip logic; the split lives only in the web client.
- [ ] D5. `memory/health.ts`: expected `schema_version` updated together with the migration (writes refused with 503 `memory_unavailable` on mismatch, per the observed behavior). Also `db/tx.ts` `TRIGGER_TEXTS` additions (C3) with a test that each new trigger text maps to its defined `invalid_request` or `conflict` class and NOT to `other` (503). Add a cap-parity assertion in `variance-regression-no-cross-firm`: the trigger literal parsed from the migration file equals `limits.regressionChecksPerFirm` equals the V1 rules-config cap (Step 0 names the symbol).
- [ ] D5b. (F1 retention) `purge.ts`: add `'regression_check'` to `PURGE_CHILD_TABLES` before `'counsel_answer'` (FK child-first; foreign keys are enforced). Extend `memory-retention-purge-test` and `cron-purge` to seed a sandbox with an answer plus a `regression_check` and assert the hourly purge batch completes, the check is gone with the workspace, and no other workspace's check is touched.
- [ ] D5c. (C9 decision) There is NO revoke path in the MVP: no new route, `revokeDecisionHandler` unchanged, so a reopened or superseded answer leaves its check `active` and the per-firm cap is a HARD CEILING per sandbox. Named residual (never a proving strategy): the status-flip trigger path is proven by direct SQL in `triggers` only; EXECUTE/UPDATE PROCESS writes backlog NOTE `variance-regression-check-revoke_NOTE_<date>.md` (flip linked checks in the revoke batch, +1 row, weight update). Document the ceiling in the phase report.
- [ ] D6. Gates (worker): `variance-answer-intent-rule`, `variance-owner-persisted`, `variance-answer-append-only`, `variance-regression-no-cross-firm`, `variance-finding-wire-size`, `rows-written`, `memory-write-limits`, `memory-guards-matrix`, `memory-storage-contract`, `query-budget`, `idempotent-replay`, `memory-retention-purge-test`, `cron-purge`, `audit-trail-append-only`.

### Section E - Label scope rule

- [ ] E1. `memory/label.ts` (C6): additive optional signature `resolveLabel(finding, activeDecision, ctx?: { fundName?: string })`; the decision `Pick` gains optional `scope` and `fund_name`. Rule: a decision with `scope = 'fund'` counts for `already_answered` only when `ctx.fundName` equals the decision's `fund_name`; otherwise it behaves as if no active decision matched; `scope` absent or `ctx` absent behaves exactly as today. Update BOTH real call sites to pass `ctx`: `apps/worker/src/routes/memory/runs.ts:116` (`fundName` = `run.fund_name`, persisted `finding.memory_label`) and `apps/web/src/memory/fingerprintFindings.ts:59` (the active fund name); update `DECISION_COLS`/`toActiveDecision` to read `scope`. Decision (no link): when a scope-mismatched decision resolves the label to `new` in `runs.ts`, the persisted finding row does NOT link that decision's `decision_id` (label `new` means no decision applies; linking would let a fund-A decision leak into fund B's finding state).
- [ ] E2. Gates: core `variance-label-scope-rule`; worker `variance-label-call-sites` (a `scope = fund` decision recorded in fund A: persisted label for a finding in fund B is NOT `already_answered` and equals the label the client function returns for the same inputs; same fund IS `already_answered`; ASSERT the mismatched case persists label `new` AND a NULL `decision_id` on the finding, the matched case links `decision_id`); worker `memory-label-parity` (enum vs CHECK, unchanged).

### Section F - Web memory API layer (stub, real, outbox)

- [ ] F1. `memoryApi.ts` types for the new optional fields plus an ADDITIVE accessor `lookupWithChecks(firmId, fingerprints): Promise<{ decisions: ActiveDecision[]; regression_checks: RegressionCheckSummary[] }>`; `lookup()` keeps returning `Promise<ActiveDecision[]>` unchanged (about 12 call sites assert arrays: `fingerprintFindings.ts`, `stub-memory-api`, `api-contract`, `review-sync`, `retention-purge`, `turnstile-no-block`) and delegates to it. Semantics (N2), identical in stub and real: the fingerprints are split into chunks of 200 (the existing lookup chunk size) and the lookup PLUS its checks are repeated per chunk; the returned `regression_checks` are DEDUPLICATED by check `id` across chunks; a document with NO fingerprints fetches NO checks at all (no request; the contract `fingerprints.min(1)` stays unchanged and is not relaxed). Tests in `api-contract` (both implementations) cover 0, 1, 200, 201 and 450 fingerprints and assert the deduplicated check list. `stubMemoryApi.ts` stores and returns the new fields and enforces the same intent rule (non-blank after trim, firm_template). `realMemoryApi.storeFindings` gains a byte-aware split (N3): after the existing 25-finding chunking, if a chunk's UTF-8 body would exceed `FINDINGS_BODY_CAP` (131,072 bytes) it is halved until every body fits; a single finding exceeding the cap on its own is NOT split or clipped, it throws a typed error (the V1-defect blocker). Asserted in `realMemoryApi` (a batch of worst-case findings is sent as several requests, each at most 131,072 bytes, all findings delivered once) and in `variance-finding-wire-size`. `realMemoryApi.ts` and `outbox.ts` carry the answer op with `intent`, `scope`, `assertion` (op kinds `decide|answer|revoke` unchanged; question op carries `owner`, `owner_source`). Outbox `scrubTerminal` (today drops `quote_text` and `counsel_note` after a terminal state) must ALSO drop `intent` and `assertion.label`; asserted in the `outbox` test. Append to the `import-graph` ALLOWED list only if `api/*` gains a core value import.
- [ ] F2. Gates (web unit): `api-contract` (one suite against both stub and real), `outbox`, `stub-memory-api`, `realMemoryApi`, `import-graph`.

### Section G - Stack tests (server-side isolation proof)

- [ ] G1. `stack-memory-variance-regression-no-cross-firm.spec.ts` (stack-memory project, local Worker on port 8788 via `dev:stack:seeded`): workspace A records a firm-template answer with an assertion for firm hartwell-crane; the lookup for the same firm returns the check; the lookup for another firm, and the same firm in another workspace, return none; a forged `scope` without intent is refused; over the cap is refused. Run: `pnpm --filter @aduin/web test:e2e:stack-memory` then token `stack-memory-variance-regression-no-cross-firm` (never together with the preview project). Also confirm `stack-memory-smoke` expects the new `schema_version` (F2).

### Section H - Evidence pack and wrap-up

- [ ] H1. Write the 5 high-risk artifacts under `harness/phase-03/` with these exact file names: `risk-gate.json`, `context-snippets.json`, `verification.json`, `review-decision.json`, `adversarial-validation.json`. Required fields (per `.claude/skills/vc-risk-evidence-pack/SKILL.md` and the validator): `task`, `planPath`, `riskLevel`, `riskClasses`, `mustStopBeforeFinalize`, `humanApprovalRequired`, `why` in the risk gate; the review decision is one of `approved | approved-with-concerns | rejected`. `adversarial-validation.json` is REQUIRED (a missing file is a failure here even though the validator only warns). Content: risk class and rollback/forward-only note, adversarial entries N1 (replay of an answer when the firm is at the cap must return the original success), N4 (forged `X:rc` and `X#rc` client op ids must not collide with the derived `#rc` audit id) and N5 (assertion with scope `fund` or no scope must be refused `invalid_request`), each with the test name and its output, isolation proof output, rows_written arithmetic (measured per D3), trigger matrix. Validate: `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/features/variance-management/active/variance-mvp_17-10-26/harness/phase-03` (0 failures, 0 missing files).
- [ ] H2. Full regression block (Exit Gate). H3. Phase report with the migration number, the snapshot change note and regression lines.

### Edge cases carried from vc-scenario / vc-security (STRIDE quick scan)

1. Spoofing and tampering: forged `scope`/`assertion` from the client (refused server-side; kind enum; label re-normalized; cap per firm; audit `regression_check_created`). Information disclosure: lookup for firm B in workspace A must return zero checks of firm A or of workspace B (query keyed by BOTH ids; test both axes). Repudiation: every created check has an audit row in the same batch. Denial of service: cap per firm; no unbounded SELECT. Elevation: demo workspace read-only triggers on the new table.
2. Migration hazards: recreated guard triggers must still block updates to every previously guarded column (matrix test over old columns plus new); `INSERT OR IGNORE` seed must be idempotent on re-apply; old Worker code against the new schema (nullable columns) must still pass `memory-storage-contract`.
3. Budget hazards: the answer-with-assertion batch must not exceed the weight (the measured value, D3); question creation must add 0; a replayed answer (idempotent replay) must not create a second check.
4. Retention hazard (F1): a `regression_check` row without the `purging` exemption or without the `PURGE_CHILD_TABLES` entry aborts the whole hourly purge batch; proven by the extended purge tests.
5. Replay hazard (C2): a replayed answer must not create a second check or a second `#rc` audit row, including a replay when the firm is already at the cap (replay check runs before the cap pre-check, N1); the derived id uses `#`, which `ID_RE` forbids, so a forged client op id such as `X:rc` or `X#rc` can never equal or pre-empt a derived id (N4); the client id is length-limited so the derived id stays at most 80 chars.
6. Privacy hazard (C7): `intent` and `assertion.label` masked before persistence and before audit; whitespace-only or fully-masked intent refused; outbox terminal ops scrubbed.
7. Generator hazard (F2): adding a firm to `law-firms.json` must not change regenerated 0003 (pinned id list).

## Test Gates (exact commands; no `--` token; one token per call)

```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction
for t in contracts variance-label-scope-rule firms-and-rules; do pnpm --filter @aduin/core test "$t" || exit 1; done
pnpm --filter @aduin/scripts test
pnpm seed:check
for t in migrations triggers firm-list-parity demo-workspace-not-polluted variance-answer-intent-rule variance-owner-persisted variance-answer-append-only variance-regression-no-cross-firm variance-finding-wire-size variance-label-call-sites rows-written memory-write-limits memory-guards-matrix memory-storage-contract query-budget memory-label-parity idempotent-replay memory-retention-purge-test cron-purge audit-trail-append-only memory-endpoint-contract; do pnpm --filter @aduin/worker test "$t" || exit 1; done
for t in api-contract outbox stub-memory-api realMemoryApi import-graph; do pnpm --filter @aduin/web test "$t" || exit 1; done
pnpm --filter @aduin/web test:e2e:stack-memory
for t in stack-memory-variance-regression-no-cross-firm stack-memory-memory-no-cross-firm stack-memory-smoke sandbox-isolation roundtrip; do pnpm --filter @aduin/web test:e2e:stack-memory "$t" || exit 1; done
```

Snapshot regeneration (Section B3 only, never in a gate loop): `pnpm --filter @aduin/core test contracts -u`, then the no-flag re-run; record both hashes in the change note.

Regression block:

```bash
# firm-list consumers added at the 2026-10-17 Step 0 (4th firm); preview project first, never together with stack-memory
for t in intake-firm-tagging intake-baseline-role-same-firm; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
pnpm --filter @aduin/web test package-confirm-table
pnpm --filter @aduin/core test package-baseline-eligibility
pnpm --filter @aduin/worker test
pnpm --filter @aduin/scripts test
pnpm --filter @aduin/core test
pnpm --filter @aduin/web test
pnpm --filter @aduin/worker typecheck
pnpm --filter @aduin/core typecheck
pnpm seed:check
pnpm guard:cf
pnpm secrets:scan
pnpm lint
pnpm typecheck
```

Notes: `rules-injection-delimited-hostile` style tokens exist in both core and worker (the package filter keeps them apart). The `stack-memory` project must not run together with the preview project; run preview first, then stack-memory, serially. The first stack-memory line above runs the whole project once; the loop re-runs by token to prove none is unmatched. Letters-only nonces in rule text (the Worker masks long digit runs).

## Test Coverage Plan (routing chain loaded: all-tests.md, worker/all-worker.md; existing blast-radius tests discovered under `apps/worker/test/memory/`)

| Area | Tier | Scenario | Command | Proves | Does NOT prove |
|---|---|---|---|---|---|
| apps/worker migration (high-risk) | Fully-automated | migration applies on a clean DB, names/tables list updated, guards recreated | `pnpm --filter @aduin/worker test migrations`, `triggers` | schema shape, immutability of new columns | behavior on the live remote D1 (V5 preflight and post-deploy check) |
| apps/worker isolation (high-risk) | Fully-automated | no cross-firm and no cross-workspace check returned | `variance-regression-no-cross-firm` | AC-V16 server | other trust boundaries |
| apps/worker isolation | Hybrid | same proof through the real HTTP stack | `test:e2e:stack-memory variance-regression-no-cross-firm` (precondition: local `wrangler dev --local` via `dev:stack:seeded`) | AC-V16 on the wire | the deployed Worker (V5 smoke) |
| apps/worker budget | Fully-automated | +2 rows on answer-with-assertion, 0 on question | `rows-written` | weights | deployed `rows_written` burst: named operator residual R2, backlog `phase10-d4-rows-written-burst` (gate for the budget stays CONDITIONAL on the deployed path) |
| apps/web api | Fully-automated | stub and real client behave identically | `api-contract` | contract parity | live Worker |
| core label | Fully-automated | scope fund counts only in the same fund | `variance-label-scope-rule` plus worker `memory-label-parity` | D5 scope rule | UI wording (V4) |
| remote D1 migration | Known-gap (named residual) | applying the migration to the live D1 | none here; V5 runs it with preflight | - | backlog/V5 owns it; this gate is explicitly NOT claimed by V3 |

| apps/worker retention (high-risk) | Fully-automated | sandbox holding a check is purged; batch does not abort | `memory-retention-purge-test`, `cron-purge` (extended) | F1 lifecycle | live hourly cron on the deployed Worker (V5 smoke) |
| scripts and core firm dependents | Fully-automated | seed:check green with 4 firms; `firms-and-rules` four ids | `pnpm seed:check`, `pnpm --filter @aduin/scripts test`, core `firms-and-rules` | F2 | remote D1 content |
| apps/worker label call sites | Fully-automated | persisted label equals client label for fund-scope decision in another fund | `variance-label-call-sites` | C6 | UI wording (V4) |
| apps/web outbox privacy | Fully-automated | terminal ops drop `intent` and `assertion.label` | `outbox` | C7 | server masking (covered by `variance-answer-intent-rule`) |
| check lifecycle (revoke) | Known-gap (named residual) | no revoke path in MVP; cap is a hard ceiling per sandbox | none; status flip proven by SQL in `triggers` only | the trigger guard | revoke-from-UI behavior; backlog NOTE `variance-regression-check-revoke` keeps any claim CONDITIONAL |
Failing stubs: each Fully-automated row starts as `test("should <scenario>", ...)` throwing `NOT IMPLEMENTED - TDD stub for: <scenario>`.

## Exit Gate

- Every command in Test Gates exits 0 (including `memory-retention-purge-test`, `cron-purge`, `pnpm seed:check`, `pnpm --filter @aduin/scripts test`); counts recorded (worker files/tests before and after; snapshot change note with both sha256 values present).
- Evidence pack validator exits with 0 failures.
- `git status` shows the migration file new and no edited earlier migration (`git diff --stat apps/worker/migrations` shows only the new file).
- Report written with the allocated migration number.

## Blockers That Would Justify BLOCKED Status

- Intake landed a migration or contract change that conflicts structurally with the recreated guard triggers (needs the Intake owner's trigger text; resolve in Step 0, not at EXECUTE). Step 0 observed none.
- A SINGLE worst-case variance finding cannot pass `FindingWireSchema`, or alone exceeds `FINDINGS_BODY_CAP` (131,072 bytes) (a multi-finding chunk over the cap is NOT a blocker; the byte-aware split in `realMemoryApi.storeFindings` handles it; stop; this is a V1 provenance-size defect, route to a Phase 01 PLAN-SUPPLEMENT; V3 adds no clip).
- Any need to touch the remote D1 before V5 (not allowed here).

## Phase Loop Progress

- [x] 0. PRECONDITION - Intake feature closed; Step 0 re-sync done; migration number allocated (expected 0006, re-listed at EXECUTE entry); Inner Loop Refresh Note written (2026-10-17)
- [ ] 1. RESEARCH - research-agent: Phase 01 report read in full; test context loaded; drift checked
- [ ] 2. INNOVATE - innovate-agent: approach decided (n/a if the DECISION still holds)
- [ ] 3. PLAN-SUPPLEMENT - plan-agent: existing phase plan updated (or "n/a - research clean")
- [ ] 4. PVL - vc-validate-agent: full V1-V7 (security dimension mandatory); validate-contract per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [ ] 5. EXECUTE - vc-execute-agent (opus): checklist done; per-section gates green
- [ ] 6. EVL - independent vc-tester: gates re-run; stubs registered; EVL HANDOFF SUMMARY
- [ ] 7. UPDATE PROCESS - phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder - vc-validate-agent writes this section before EXECUTE)", the orchestrator must spawn vc-validate-agent first. A partial contract is a placeholder.

Strategy (vc-agent-strategy-compare, PLAN-end): signals S1 (core+worker+web), S2, S6 (migration, trust boundary), S7 = 4/7 HIGH. Recommended: SEQUENTIAL single opus EXECUTE agent in section order (contracts B, migration C, worker D, label E, web API F, stack G). Parallel fan-out is allowed only AFTER section B lands (contract fixes the interface): worker agent (C to D, G) and web-API agent (F) with disjoint file sets, serialized snapshot regeneration. Default is sequential (shared checkout, no `git stash` rule, port 8788 for stack-memory (`playwright.config.ts`) is separate from preview 4317 but both builds share the web output). EVL by an independent sonnet vc-tester plus a sonnet code-review/security pass.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `variance-answer-intent-rule`, `variance-answer-append-only`, `triggers`, web `api-contract` | Fully-Automated | AC-V14 (server part) |
| `variance-regression-no-cross-firm` (worker) | Fully-Automated | AC-V16 (server part) |
| `stack-memory-variance-regression-no-cross-firm` | Hybrid | AC-V16 (wire) |
| `variance-owner-persisted` | Fully-Automated | AC-V11 (persistence) |
| `variance-finding-wire-size` | Fully-Automated | AC-V19 (provenance carried within `FindingWireSchema` and the body cap) |
| `variance-label-scope-rule`, `memory-label-parity` | Fully-Automated | D5 scope rule (supports AC-V16 reuse) |
| `rows-written` | Fully-Automated | NFR platform/budget (base AC39, AC40 stay valid) |
| `migrations`, `firm-list-parity`, `demo-workspace-not-polluted` | Fully-Automated | NFR safety (base AC41, AC42, AC47) |
| `memory-retention-purge-test`, `cron-purge` (extended) | Fully-Automated | NFR retention (base D-4) and AC-V16 lifecycle |
| `seed:check`, `firms-and-rules`, scripts tests, `memory-endpoint-contract`, `stack-memory-smoke` | Fully-Automated | NFR safety (firm list and schema_version dependents) |
| `variance-label-call-sites` | Fully-Automated | D5 scope rule at the real call sites |
| `outbox` (scrub) | Fully-Automated | AC-V14 privacy (AC58 masking carried) |
| `intake-firm-tagging`, `intake-baseline-role-same-firm`, web `package-confirm-table`, core `package-baseline-eligibility` (4th-firm consumers) | Fully-Automated | NFR safety (firm list dependents; Intake surfaces stay green) |

## Test Infra Improvement Notes

- Backlog candidate: a single shared helper for "firm in four mirrors" (json, core, web generated json, D1 seed) so a new firm is one edit; today `firm-list-parity` is the only guard.
- The deployed `rows_written` burst (residual R2) cannot be automated (Turnstile); keep it operator-run.

## Resume and Execution Handoff

- Selected plan file path: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-03-memory-backend_PLAN_17-10-26.md`
- Umbrella plan: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md`
- Last completed step: Step 4 PVL (outer-pvl, cycle 2 re-validate, Gate: PASS); phase not started otherwise (V1 must be VERIFIED first); Step 0 PLAN-SUPPLEMENT applied 2026-10-17 (Intake closed)
- Validate-contract status: INVALIDATED by the 2026-10-17 Inner Loop Refresh Note (inner PVL must re-run before EXECUTE); prior state: written 17-10-26 (outer-pvl, PVL cycle 2 re-validate: Gate: PASS, 0 FAIL, 0 CONCERN; N1-N5 from cycle 1 verified closed against the repo; the cycle-1 CONDITIONAL and first-pass BLOCKED contracts are superseded; Step 0 re-sync with Intake and Phase 01 symbol re-verification remain the pre-EXECUTE known-gaps)
- Next step: after Phase 01 is VERIFIED (Intake is closed), spawn vc-research-agent for RESEARCH (list `apps/worker/migrations/` and allocate the migration number there), then INNOVATE (n/a if the DECISION holds), PLAN-SUPPLEMENT and inner PVL. EXECUTE receives this one exact plan path.
- Validators: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this plan>`; `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <this plan>`.
- Hard rules for every agent prompt: never git stash, checkout, reset or restore; commit on main with conventional prefixes; never run git push in any phase (the user pushes); no remote D1 or deploy in this phase; execution commits separate from process commits.

## Inner Loop Refresh Note: 2026-10-17 — changed sections: header (Depends on), Overview (firm ownership observation), Step 0 (checks a, c, d observed; new status paragraph with D-S0-7/8/9), Test Gates (regression block: 4th-firm consumers), Blockers, Phase Loop Progress, Verification Evidence, Resume and Execution Handoff. Invalidates prior validate-contract.

Written by the Step 0 PLAN-SUPPLEMENT at 2026-10-17 22:11 local, after this plan's outer-pvl contract (written 17:49 the same day). Basis `variance-mvp_STEP0-RESYNC_17-10-26.md`. P03 stays valid as written: no Intake change in contracts, snapshot, routes, repo, api, migrations, `law-firms.json`, seed; migration still 0006 and `schema_version` 5 to 6; Dexie is `version(2)` (unrelated to P03). New: regression tokens for the 4th firm's consumers (`intake-firm-tagging`, `intake-baseline-role-same-firm`, `package-confirm-table`, `package-baseline-eligibility`); D-S0-7 (V5 retags the Northgate demo package; not this phase). Push rule restated (D-S0-8); `.playwright-mcp/` and `.DS_Store` are not Variance's (D-S0-9). PVL-new concern to check: whether adding `hartwell-crane` changes any Intake spec that enumerates firms (UNVERIFIED until a run).

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: outer-pvl
supersedes: 2026-10-17 (outer-pvl) - the cycle-1 CONDITIONAL contract (5 low CONCERN N1-N5); this re-validate (PVL cycle 2 re-run, after the N1-N5 supplement) has current evidence

Mode: Deep (phase of a multi-phase program; worker, D1 migration, trust-boundary surface; security and risk-evidence scrutiny applied). Context loaded: `all-context.md`, `worker/all-worker.md`, `engine/all-engine.md`, `tests/all-tests.md`, DECISION D4/D5/D7, umbrella, registry, P01 plan (symbol alignment), PVL iteration 001 and 002 reports present. Repo reads (read-only; nothing built, tested, run or applied): migrations 0001-0005 (`0002` trigger text lines 204-250, `0005` `demo_read_only`), `memory/repo/{audit,counsel,purge}.ts`, `routes/memory/{counsel,lookup,decisions,runs}.ts`, `memory/http.ts`, `db/{tx,ids}.ts`, `platform/index.ts`, core `contracts/memory.ts`, `memory/label.ts`, `config/limits.ts`, web `api/{realMemoryApi,outbox,memoryApi}.ts`, `memory/fingerprintFindings.ts`, `scripts/src/seed/gen-demo-seed.ts`, `query-budget.test.ts`.

Structural validator (`validate-plan-artifact.mjs`, run in-session at V1 step 3b): 0 failures, 0 warnings. Repo state at validation: HEAD eab4a0e on main; `apps/worker/migrations/` still holds 0001-0005 only, `contracts/memory.ts` last touched by Phase 01/04b commits, `git status` outside the variance folder shows only the Intake `results.tsv`, so the Step 0 expectation (number 0006, `schema_version` 6) is unchanged.

Parallel strategy: sequential (read-only inline validation by one agent; a fire-and-forget validator cannot spawn). Signal score 5/7 HIGH: S1 (core, worker, web, scripts), S2, S4, S6, S7. No `VC-FEASIBILITY-PROBE-NEEDED` (every check was mechanical and read-only). EXECUTE recommendation stays as the plan states: ONE sequential opus vc-execute-agent in section order (contracts B, migration C, worker D, label E, web API F, stack G); a parallel worker and web-API split only after Section B lands; independent sonnet vc-tester for EVL plus a sonnet code-review and security pass. EXECUTE stays held until the Intake feature closes (by design).
Rationale: dominant signals S2 and S6 (D1 migration, trigger recreation, cross-firm isolation); disjoint-file parallelism buys little in a shared checkout.

Closure of the cycle-1 CONCERNs N1-N5 (verified against the repo, not only plan text):

| Prior finding | Result | Evidence |
|---|---|---|
| N1 replay at the cap boundary | CLOSED | Plan D1 now orders the checks: `replayed(ctx, client_op_id)` first, cap pre-check only when it finds nothing; D1 tests (a) plain replay, (b) replay-at-cap returns the original success, (c) forged ids; edge case 5 and the Evidence pack adversarial entry N1 restate it. Repo: `memory/repo/audit.ts` `replayed()` exists and `decisions.ts` `replayResponse()` (line 50) returns the stored result. Today's `counselAnswerHandler` has no pre-check, so the order is a pure insertion before the batch. |
| N2 `lookupWithChecks` signature | CLOSED | F1 now specifies `lookupWithChecks(firmId, fingerprints)`, 200-chunks, dedupe by check `id`, no request for zero fingerprints, `fingerprints.min(1)` unchanged. Repo: `MemoryLookupRequestSchema` is `.min(1).max(limits.memoryLookupMax)` (`contracts/memory.ts` 70-73); `realMemoryApi.lookup` already dedupes fingerprints, returns early on empty and chunks by `limits.memoryLookupMax` (lines 344-355), so the accessor is a direct extension; tests cover 0, 1, 200, 201, 450. `lookup.ts` is one lookup query today and `query-budget` pins `lookup_200: 2` (line 13, 40), so the plan's 2 to 3 update is accurate. |
| N3 worst-case wire size | CLOSED | A1/D4/F1 now build the worst case from V1's pinned adapter caps with explicit `TextEncoder` byte arithmetic; `realMemoryApi.storeFindings` gains a byte-aware halving split under `FINDINGS_BODY_CAP` (131,072); a single oversized finding is the V1-defect blocker. Repo: `FINDINGS_BODY_CAP = limits.aiBodyBytes` (128 KB, `memory/http.ts:27`), `FINDINGS_CHUNK_MAX` 25 and `FINDINGS_CHUNK` 25 (count-only chunking at `realMemoryApi.ts` 389-390) confirm the current gap the split closes; the web already imports `limits` from `@aduin/core`, so no new import edge. |
| N4 derived op id collision | CLOSED | D1/edge case 5 derive `<client_op_id>#rc`. Repo: `ID_RE = /^[A-Za-z0-9_:.-]{1,64}$/` (`db/ids.ts:16`) excludes `#`, and `memory/http.ts` `SAFE_ID_KEYS = ['client_op_id','finding_ref']` runs `ID_RE` on every parsed request (`parseWith`), so a client can never send `X#rc`; `audit_event.client_op_id` CHECK is length 1..80 (`0002` line 184) and 64+3 = 67 fits. Forged-`X:rc` and `X#rc` cases are in D1 test (c) and the evidence pack. |
| N5 `assertion` requires `firm_template` | CLOSED | B1 adds the second refinement (assertion present requires `scope = 'firm_template'`, else `invalid_request`), mirrored in `stubMemoryApi`, proven in `variance-answer-intent-rule`; AC table, contract table and the H1 adversarial entry carry it. The weight function reads the raw body (`http.ts` 121: `opts.weight(raw)`) before schema parse, so the refusal also bounds what a forged body can be charged. |

Earlier fixes re-checked and still intact (plan text plus repo): F1 retention (`purge.ts` `PURGE_CHILD_TABLES` is child-first, `counsel_answer` at index 5 so inserting `'regression_check'` before it is correct; D5b, the `purging` exemption in C2, extended `memory-retention-purge-test` and `cron-purge`); F2 firm and `schema_version` dependents (`health.ts`, `dev-seed.ts` 105-106, `memory-endpoint-contract.test.ts:275`, `stack-memory-smoke.spec.ts` and `firms-and-rules.test.ts` all declared; `buildReferenceSql()` still iterates all `LAW_FIRMS`, so the C3b pinned `REFERENCE_0003_FIRM_IDS` filter is still needed and still listed); C1 wire premise (A1, detail never persisted); C2 batch order (audit, answer, check, `#rc` audit); C3 `TRIGGER_TEXTS` whitelist (`db/tx.ts` 12-20, new texts declared, `decisions.ts` `onBatchError` and `http.ts:84` are the two consumers); C4 weight function (`W.counselAnswer` 18 base, `postEntry` accepts a function); C5 `lookup_200` pin; C6 label call sites (`runs.ts:116`, `fingerprintFindings.ts:59` are the only two `resolveLabel` callers, core `label.ts` takes no ctx today so the additive optional parameter is safe); C7 outbox scrub (`scrubTerminal` drops `quote_text` and `counsel_note` today, edit point confirmed); C8 isolation (`question_owner_immutable` is a new trigger; `insertQuestion` already uses `ON CONFLICT ... DO NOTHING`; `markAnswered` UPDATEs only `status`, so the trigger on `owner`/`owner_source` cannot block it); C9 revoke residual D5c; C10 normalizer ownership (P01 plan confirms `normalizeAssertionLabel` in `variance/label.ts`, barrel-exported, named list); C11 snapshot command (core `test` is `vitest run`); C12 evidence-pack names and fields.

Net gate derivation (0 FAIL, 0 CONCERN, 0 probes):

| Layer 1 dimension | Status |
|---|---|
| Infra fit | PASS |
| Test coverage | PASS |
| Breaking changes | PASS |
| Security surface | PASS |

| Layer 2 section | Status |
|---|---|
| A - PLAN-time verifications | PASS |
| B - Contracts | PASS |
| C - Migration | PASS |
| D - Worker route, repo, weights | PASS |
| E - Label scope rule | PASS |
| F - Web memory API layer | PASS |
| G - Stack tests | PASS |
| H - Evidence pack | PASS |

Totals: 0 FAILs / 0 CONCERNs / 12 PASS (4 Layer 1 dimensions, 8 Layer 2 sections). Net gate: PASS. Net-gate vacuous-green check: every developed behavior has a Fully-Automated or Hybrid gate; the three Known-Gap rows are named residuals (remote D1 apply, deployed `rows_written` burst, check revoke path) with owners and backlog notes, never proving strategies, so the PASS is not vacuous.

Advisory notes (not counted; fold into Step 0 or EXECUTE instructions):
- A1. D1 replay: use `replayResponse(ctx, client_op_id, 'answer_recorded')` (`decisions.ts:50`, throws `op_reused` when the stored action differs or the result is null) rather than a bare `replayed()`, which is non-null for any action.
- A2. D3 weight selector: treat `assertion` as present only when `raw.assertion` is a non-null object; a refused body charged the larger weight is harmless but the selector should not key on mere key presence of `null`.
- A3. D5/C3 trigger texts are matched by substring in order (`classifyBatchError`): choose texts that neither contain nor sit inside an existing one (for example `regression_check_immutable`, `regression_check_append_only`, `regression_check_cap`, `question_owner_immutable` are clean); the demo triggers reuse `demo_read_only` (0005 convention), so `http.ts:84` needs no change.
- A4. C1 convention: peer tables carry `workspace_id REFERENCES workspace(id)`; add it to `regression_check` (harmless: the workspace row is deleted after all children in `runPurge`).
- A5. Carried from cycle 1: the registry names `scripts/src/fixtures/gen-demo-seed.ts` and a scripts-side `firms-and-rules.test.ts` that do not exist (real: `scripts/src/seed/gen-demo-seed.ts`, `packages/core/test/unit/firms-and-rules.test.ts`); correct the registry line at UPDATE PROCESS. `apps/web/test/support/fakeMemoryFetch.ts`, `realMemoryApi.test.ts:352` and `e2e/fixtures/memory-stub-rules.ts:173` hold fake `'5'` health responses that stay green; the Step 0 grep will list them, do not edit them as pins.

Security surface (vc-security STRIDE scan plus vc-risk-evidence-pack scrutiny): risk class HIGH (schema/data migration, public contract change, trust boundary). Spoofing and tampering: `workspace_id` from the cookie, `law_firm_id` from the question row, `source_fund_name` from `run.fund_name` (`fund.name`, NOT NULL), `statement_text` server-built, kind enum, label masked then normalized and capped at 80, `assertion` gated on `firm_template`, composite FK keeps a check bound to its own workspace's answer. Replay and idempotency: replay check precedes the cap pre-check and the derived op id sits outside `ID_RE`, so neither a retry nor a forged id can suppress or duplicate a check. Information disclosure: lookup keyed by workspace AND firm, tested on both axes, bounded by the cap; intent and label masked before persistence and audit; outbox terminal scrub extended. Repudiation: check and its audit row share one batch. DoS: cap per firm per workspace (route pre-check plus trigger backstop, three-way literal parity), weight charged from a measured value, byte-aware findings split keeps bodies under the cap, no unbounded SELECT. Elevation: demo workspace blocked by `demo_ro_regression_check*` triggers. Migration hazards covered: recreated guard triggers matrix-tested over old and new columns, `INSERT OR IGNORE` idempotent, nullable columns keep an older Worker and a rollback working, landed migrations untouched, remote D1 untouched. The evidence pack contract is complete (five artifact names, validator fields, mandatory `adversarial-validation.json` with N1, N4, N5 entries). No secrets, no auth change, 0 AI calls, no deploy. Residuals R2 (deployed `rows_written` burst) and the remote D1 apply (Phase 05) are named, not claimed.

Known gaps (excluded from the CONCERN count; Step 0 must re-verify): Intake coupling rows marked OBSERVED-IN-PLAN (no Intake migration, contract, Worker or `law-firms.json` change, so number 0006 and `schema_version` 6; `firm-x` demo tagging), Phase 01 symbols the plan consumes (`questionKey`, assertion kind, rules caps incl. cap 20, `normalizeAssertionLabel`, adapter caps for the D4 worst case), `scripts/src/seed/{check-seed,gen-demo-seed}.ts`, `apps/worker/seed/{demo,test-seed}.sql` and `apps/worker/vitest.config.ts` state (registry-listed, re-checked at Step 0), the revoke path (D5c, backlog note planned), remote D1 apply (Phase 05), deployed rows_written burst (backlog `phase10-d4-rows-written-burst_NOTE_17-10-26.md`), EXECUTE held until Intake closes (by design).

Test gates (C3 5-column table; the legacy line form follows):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC-V14-a | answer stores intent and scope; firm_template without a non-blank intent (after masking) is refused server-side; `assertion` without firm_template refused (N5) | Fully-Automated | `pnpm --filter @aduin/worker test variance-answer-intent-rule` | B |
| AC-V14-b | new columns immutable after insert; every old guarded column still guarded; `question_owner_immutable` | Fully-Automated | `pnpm --filter @aduin/worker test variance-answer-append-only`, then `triggers` | B |
| AC-V14-c | stub and real client agree, including the intent rule, `lookupWithChecks(firmId, fingerprints)` chunking and dedupe, and the outbox terminal scrub | Fully-Automated | `pnpm --filter @aduin/web test api-contract`, then `outbox`, `stub-memory-api`, `realMemoryApi` | B |
| AC-V16-a | lookup never returns a check of another firm or workspace; cap; label re-normalized; replay (also at the cap, N1) creates no second check; forged `X:rc` and `X#rc` ids (N4) | Fully-Automated | `pnpm --filter @aduin/worker test variance-regression-no-cross-firm`, then `idempotent-replay` | B |
| AC-V16-b | same isolation through the real HTTP stack | Hybrid | `pnpm --filter @aduin/web test:e2e:stack-memory stack-memory-variance-regression-no-cross-firm` (precondition: local `wrangler dev` via `dev:stack:seeded`, port 8788, no Intake Playwright running) | B |
| AC-V11 | owner and owner_source persisted at ask time with 0 extra rows | Fully-Automated | `pnpm --filter @aduin/worker test variance-owner-persisted` | B |
| AC-V19 (retargeted) | a worst-case variance finding built from V1 adapter caps passes `FindingWireSchema`; every `storeFindings` request body is at most 131,072 bytes through the byte-aware split (N3) | Fully-Automated | `pnpm --filter @aduin/worker test variance-finding-wire-size`, then web `realMemoryApi` | B |
| D5 scope rule | scope fund counts for already_answered only in the same fund | Fully-Automated | `pnpm --filter @aduin/core test variance-label-scope-rule`, then worker `memory-label-parity` | B |
| C6 call sites | persisted label (and NULL `decision_id` on mismatch) equals client label for a fund-scoped decision in another fund | Fully-Automated | `pnpm --filter @aduin/worker test variance-label-call-sites` | B |
| Budget | measured rows of answer-with-assertion at most its weight; question creation 0; lookup 3 queries | Fully-Automated | `pnpm --filter @aduin/worker test rows-written`, then `memory-write-limits`, `query-budget` | B |
| Isolation of new table | demo insert/update/delete blocked; delete blocked outside purging; only the status flip | Fully-Automated | `pnpm --filter @aduin/worker test triggers`, then `demo-workspace-not-polluted` | B |
| Migration shape | applies clean; 21 tables; WITHOUT ROWID; schema_version last | Fully-Automated | `pnpm --filter @aduin/worker test migrations` | B |
| Retention (F1) | a sandbox holding a check is purged; the hourly batch does not abort | Fully-Automated | `pnpm --filter @aduin/worker test memory-retention-purge-test`, then `cron-purge` | B |
| Firm dependents (F2) | `seed:check` green with the 4th firm; four firm ids; every `schema_version` site agrees | Fully-Automated | `pnpm seed:check`, `pnpm --filter @aduin/scripts test`, `pnpm --filter @aduin/core test firms-and-rules`, worker `firm-list-parity`, `memory-endpoint-contract`, stack `stack-memory-smoke` | B |
| Contract freeze | additive snapshot move with change note and stable re-run | Fully-Automated | `pnpm --filter @aduin/core test contracts` (no flag; `-u` only in B3) | B |
| Evidence pack | five artifacts with required fields, 0 failures | Fully-Automated | `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/features/variance-management/active/variance-mvp_17-10-26/harness/phase-03` | B |
| Remote D1 apply | applying the migration to the live D1 | - (named residual) | none in this phase | C (Phase 05 preflight and post-deploy check) |
| Deployed rows_written burst | live write cost | - (named residual) | none (Turnstile blocks automation) | D (backlog `phase10-d4-rows-written-burst_NOTE_17-10-26.md`) |
| Check revoke path | status flip from a user action | - (named residual) | none; flip proven by SQL in `triggers` only | D (backlog NOTE `variance-regression-check-revoke_NOTE_<date>.md`, written at EXECUTE or UPDATE PROCESS) |

gap-resolution legend: A proven now; B gate added or fixed by this plan's checklist; C deferred to a named later phase; D backlog stub. Known-Gap is never a `strategy:` value; it appears only as the three named residual rows above.

Failing stubs (Fully-Automated rows only; red-first starting points, not on-disk files):
- AC-V14-a: `test("should refuse a firm_template answer without a non-blank intent and refuse an assertion without firm_template", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: AC-V14-a") })`
- AC-V14-b: `test("should keep every old guarded column and the new intent, scope, owner columns immutable", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: AC-V14-b") })`
- AC-V14-c: `test("should behave identically on stub and real client for intent, scope, assertion and lookupWithChecks", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: AC-V14-c") })`
- AC-V16-a: `test("should never return a regression check of another firm or workspace, refuse over the cap, and answer a replay at the cap with the stored result", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: AC-V16-a") })`
- AC-V11: `test("should persist owner and owner_source at ask time with zero extra rows", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: AC-V11") })`
- AC-V19: `test("should keep every findings request body at most the body cap through the byte-aware split", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: AC-V19") })`
- D5: `test("should count a fund-scoped decision for already_answered only in the same fund", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: D5") })`
- C6: `test("should persist the same label the client computes for a fund-scoped decision in another fund", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: C6") })`
- Budget: `test("should measure answer-with-assertion rows at most its weight and question creation at zero", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: Budget") })`
- Isolation of new table: `test("should block demo writes and deletes on regression_check and allow only the status flip", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: Isolation of new table") })`
- Migration shape: `test("should apply the migration cleanly with 21 tables and schema_version last", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: Migration shape") })`
- Retention (F1): `test("should purge a sandbox that holds a regression check without aborting the batch", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: Retention") })`
- Firm dependents (F2): `test("should keep seed:check green with the fourth firm and every schema_version site in agreement", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: Firm dependents") })`
- Contract freeze: `test("should move the contracts snapshot additively and byte-stable on re-run", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: Contract freeze") })`
- Evidence pack: `test("should validate the five phase-03 risk artifacts with zero failures", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: Evidence pack") })`

Legacy line form (retained for existing consumers):
- worker migration and triggers: [Fully-automated: `pnpm --filter @aduin/worker test migrations`, `triggers`, `demo-workspace-not-polluted`]
- worker isolation and answer rules: [Fully-automated: `variance-regression-no-cross-firm`, `variance-answer-intent-rule`, `variance-answer-append-only`, `variance-owner-persisted`, `variance-finding-wire-size`, `variance-label-call-sites`, `idempotent-replay`]
- worker budget and purge: [Fully-automated: `rows-written`, `memory-write-limits`, `query-budget`, `memory-retention-purge-test`, `cron-purge`]
- core and scripts: [Fully-automated: `pnpm --filter @aduin/core test contracts`, `variance-label-scope-rule`, `firms-and-rules`; `pnpm seed:check`; `pnpm --filter @aduin/scripts test`]
- web api: [Fully-automated: `pnpm --filter @aduin/web test api-contract`, `outbox`, `stub-memory-api`, `realMemoryApi`, `import-graph`]
- stack: [hybrid: `pnpm --filter @aduin/web test:e2e:stack-memory stack-memory-variance-regression-no-cross-firm` + local seeded Worker]
- remote D1, deployed burst and check revoke: [known-gap: documented, Phase 05 and backlog `phase10-d4-rows-written-burst`, `variance-regression-check-revoke`]

Dimension findings:
- Infra fit: PASS - purge child-first list and exemption, platform weights (`platform/index.ts`), `health.ts`, `dev-seed.ts` sites, `db/tx.ts` whitelist, generator pin and 0003 byte-identity all verified on disk; no new runtime surface.
- Test coverage: PASS - every gate token and command resolves (new tokens are new files); the N3 worst case is now built from V1 caps with byte arithmetic and backed by the web split; replay-at-cap and forged-id cases present in `variance-regression-no-cross-firm` and `idempotent-replay`.
- Breaking changes: PASS - additive contract fields, nullable columns, additive `lookupWithChecks(firmId, fingerprints)` with `lookup()` unchanged, `fingerprints.min(1)` untouched, 0003 byte-identity; safe for old clients and rollback.
- Security surface: PASS - isolation fully server-derived; replay-before-cap order, `#rc` outside `ID_RE` (enforced by `parseWith` on `client_op_id`), `assertion` gated on `firm_template` close the three cycle-1 holes; masking and outbox scrub in place.
- Section A feasibility: PASS - all A1-A8 targets resolve; A1 wire limits correct.
- Section B feasibility: PASS - contract refinements (intent non-blank, assertion requires firm_template) are plain zod `superRefine`; snapshot command verified.
- Section C feasibility: PASS - nullable `ALTER TABLE ADD COLUMN` with CHECK, DROP and CREATE TRIGGER (copy `0002` 208-250 verbatim plus new columns), `INSERT OR IGNORE`, WITHOUT ROWID with composite FK to `counsel_answer(workspace_id, id)` (same target other tables already reference), `purging` exemption are mechanically fine; highest-risk edit remains the recreated `decision_guard_update` and `answer_guard_update` (matrix-test old and new columns).
- Section D feasibility: PASS - batch order, replay-first cap check (use `replayResponse`, advisory A1), derived `#rc` id, measured weight via the `postEntry` weight function, `TRIGGER_TEXTS` additions (advisory A3), `purge.ts` and the extra lookup SELECT are sound.
- Section E feasibility: PASS - additive optional `ctx` parameter, two call sites (`runs.ts:116`, `fingerprintFindings.ts:59`), `DECISION_COLS` and `toActiveDecision` (null must map to absent keys); NULL `decision_id` on scope mismatch specified and asserted.
- Section F feasibility: PASS - `lookupWithChecks` extends the existing chunking and dedupe in `realMemoryApi.lookup`; byte-aware split sits in `storeFindings` (declared file); outbox scrub target confirmed.
- Section G feasibility: PASS - port 8788, `stack-memory-smoke` schema pin, spec tokens resolve.
- Section H feasibility: PASS - five artifact names, validator fields and mandatory `adversarial-validation.json` with N1, N4, N5 entries.

Open gaps: none (known-gaps listed above are not counted).

**What This Coverage Does NOT Prove** (what this coverage does NOT prove): none of these gates proves behavior on the remote D1 (migration apply on live data, trigger recreation under live traffic) or the deployed `rows_written` burst; the stack spec does not prove the deployed Worker; `api-contract` does not prove a live Worker; `variance-label-scope-rule` proves the core function only (call sites are proven by `variance-label-call-sites`); `rows-written` proves local D1 row counts, not Cloudflare billing; `variance-finding-wire-size` proves serialization size and the client split, not network behavior; no gate covers a human-solved Turnstile flow or a revoke-from-UI path; the V1 adapter caps and `normalizeAssertionLabel` are Phase 01 outputs not yet landed, so the D4 and normalizer gates are proven only after Step 0 re-verifies them; nothing in this validate pass executed any test (read-only; Intake holds the build output and port 4317), so every gate above is unrun evidence of feasibility, not of passing.

Accepted by: session (autonomous autopilot, planning phases only; no EXECUTE) - Gate PASS with no accepted concerns; known-gaps carried by name: Intake coupling (OBSERVED-IN-PLAN rows), Phase 01 symbol re-verification at Step 0, remote D1 apply (Phase 05), deployed rows_written burst (R2), check revoke path (D5c).

Autonomous goal block: BRANCH B (the umbrella plan `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md` holds `## Stable Program Goal`, verified on disk). No per-phase goal-block section is written to this phase plan (BRANCH B: the check passes vacuously); the umbrella's /goal governs ("Reference for latest state: the umbrella plan path above").

Gate: PASS

Amendment 17-10-26 (user decision): no git push in any phase; commit locally only; the user pushes. Wording-only tightening, no gate change.
