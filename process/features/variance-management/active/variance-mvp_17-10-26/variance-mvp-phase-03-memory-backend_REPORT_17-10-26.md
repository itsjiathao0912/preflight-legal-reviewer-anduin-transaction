---
name: report:variance-mvp-phase-03-memory-backend
description: "Variance MVP Phase 03 EXECUTE report: migration 0006, additive memory contracts, regression checks, scope rule, three firms; all Test Gates and the regression block green on local D1"
date: 17-10-26
phase: phase-03-memory-backend
status: COMPLETE
feature: variance-management
plan: process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-03-memory-backend_PLAN_17-10-26.md
metadata:
  node_type: memory
  type: report
  feature: variance-management
  phase: phase-03
---

# Phase 03 - V3 Memory backend: EXECUTE report

**TL;DR (final, after EVL and UPDATE PROCESS 2026-10-18):** Phase 03 is VERIFIED. The independent EVL run was green on the first pass (0 fix cycles) and the code review passed with notes M1 and M2 (both recorded, neither blocks). Original execute summary: Sections A-H are done and committed (8 commits on main, nothing pushed). Migration is **0006** (`schema_version` 5 to 6). Every Test Gates command and the whole regression block exit 0. The risk evidence pack validates with 0 failures and 0 warnings. Only local D1 was used. 13 deviations, all inside the planned scope (listed below). Ready for the independent EVL run.

## What Was Done

Commits (base `0ee9fca`; `ce5c684` and `0def20f` are the other agent's process commits):

| Commit | Content |
|---|---|
| `f93fd9a` feat | Section B: additive contracts + limits + snapshot regenerated (change note below) |
| `b5b5f84` feat | Sections C, D, E: migration 0006, Worker route/repo/weights/triggers mapping, purge order, scope rule (core + both call sites), firms JSON, generator pin, five `schema_version` pins |
| `1882dbf` test | Worker, core and scripts gates (6 new worker tests, 1 core, 1 scripts; 15 extended) |
| `ef11874` feat | Section F: web `lookupWithChecks`, answer/question fields, stub, byte-aware split, outbox scrub |
| `f68fe32` test | Web gates (api-contract, outbox, stub, real client, fake Worker fetch) |
| `b6fe91b` test | Section G: `stack-memory-variance-regression-no-cross-firm.spec.ts` |
| `84577e4` chore | prettier format of `contracts/memory.ts` (found by `pnpm lint`; snapshot unchanged) |

### Section A: plan-time checks

- **A1 (wire limits):** `FindingDetailSchema` caps explanation at 1000, interpretations at 6 x 500 (`INTERPRETATIONS_MAX` and `INTERPRETATION_MAX_CHARS`). V1 `FACT_MAX` is 1000. `FINDINGS_BODY_CAP` is 131,072 and the Worker `FINDINGS_CHUNK_MAX` is 25. The Worker binds `detail_json` NULL, so the 2000-char CHECK never applies (confirmed by `variance-finding-wire-size`). `detector_id` `variance.<rule>` (schema max 80; the column has no CHECK) and `pattern_key` up to 80 chars are accepted. **Flag for the orchestrator:** Phase 01 plan item F1 still carries the stale 2000-char `detail_json` premise.
- **A2:** `ActiveDecision.fund_name` exists and is required (`z.string().max(200)`).
- **A3:** `MEMORY_WRITE_WEIGHTS` is in `apps/worker/src/platform/index.ts`. The variance measurement lives in `rows-written.test.ts` (own helper). `budget-probe.ts` was not touched, so the `measureEndpoints()` keys are unchanged.
- **A4:** `apps/worker/migrations/` held 0001-0005, so the new file is **0006_variance.sql**. `schema_version` goes from 5 to 6. `EXPECTED_MIGRATIONS` in `dev-seed.ts` now includes `0006`.
- **A5:** the scope rule lives in `packages/core/src/memory/label.ts` (optional `ctx` plus the exported `scopeMismatch`). Both runtime call sites use it.
- **A6:** `seed-copy.ts` needed no change. `demo-seed-copy-effects` and `sandbox-isolation` pass (full worker suite). The stack token `sandbox-isolation` also passes.
- **A7 baseline (before edits):** worker `migrations` 5, `triggers` 5, `rows-written` 6, `firm-list-parity` 3; core `contracts` 34; web `api-contract` 32. All green.
- **A8 pins:** the grep hits match the declared list exactly: `dev-seed.ts:105`, `health.ts`, `memory-endpoint-contract.test.ts:275`, `stack-memory-smoke.spec.ts:9`, `stack-memory-package-privacy.spec.ts:129`. All five moved to `'6'` in commit `b5b5f84`. The non-pins were left unchanged: `fakeMemoryFetch.ts:89-90`, `realMemoryApi.test.ts:352`, `memory-stub-rules.ts:173-174`. The only hard-coded firm id list was `firms-and-rules.test.ts`; it now lists six firms.

### Contract snapshot change note (B3)

- sha256 **before** `50e1b2d03374ac93c25459da5cbb67a1dc6c8647bb3c3e8e93637d875c69444e`, **after** `6903cde117fd7b8fb8847a1245653a3c510f2b0b7139c12f10d50b96d010cf60`. The re-run without the flag is byte-stable, and the hash was unchanged after the later prettier commit.
- Added schemas: `memory.AnswerAssertionSchema`, `AnswerScopeSchema`, `OwnerSourceSchema`, `QuestionOwnerSchema`, `RegressionCheckSummarySchema`.
- Moved schemas (optional fields added): `ActiveDecision` (+`intent`, `scope`) and every schema that embeds it (`ConflictBody`, `CounselAnswerResponse`, `CreateDecisionResponse`, `ExportResponse`, `FirmMemoryResponse`, `RevokeDecisionResponse`), `CounselQuestionRequest` (+`owner`, `owner_source`), `CounselAnswerRequest` (+`intent`, `scope`, `assertion`; the two refinements do not appear in the JSON schema), `MemoryLookupResponse` (+`regression_checks`), `AuditEvent`/`AuditResponse` (+`regression_check_created`).
- Removed schemas: none. `limits` gains `regressionChecksPerFirm` 20 and `intentMaxChars` 500.

### Measured write weight (D3)

Local D1 `meta.rows_written`, from the variance test in `rows-written`:

- Plain answer: **13** rows. Answer with assertion: **18** rows (**+5**: the check row with its primary-key and `ix_regression_check_scope` entries, plus its audit row and indexes).
- Weight: 18 (`counselAnswer`) + 5 = **`counselAnswerWithAssertion: 23`**. The `postEntry` weight function picks 23 only when `assertion` is a non-null object (E2).
- Asking a question with `owner`/`owner_source` writes the same number of rows as a plain question (0 extra).
- `memory-write-limits` pins the weight table and checks that the budget claims 18 and then 23. `query-budget` `lookup_200` moves from 2 to 3 (`toBe(3)`).

### Wire size (D4, from `variance-finding-wire-size`)

The worst case uses `€` (3 bytes in UTF-8) to fill every V1 cap: 20 string facts at `FACT_MAX`, explanation 1000, interpretations 6 x 500, section path 8 x 300, snippet 300, expected 300.

- One finding is **82,236 B**; its request body is **82,333 B**, under the 131,072 B cap, so there is no V1 provenance defect.
- A 25-finding chunk would be **2,056,021 B**, over the cap. So `realMemoryApi.storeFindings` halves chunks by byte size: 30 worst-case findings were sent in more than 2 requests, each at most 131,072 B, and every finding arrived exactly once.
- A single finding over the cap throws `finding_too_large` and is never clipped. The Worker answers a body over the cap with 413.

### Revoke ceiling (D5c)

There is no revoke path in the MVP. A reopened or superseded answer leaves its check `active`, so **20 active checks per firm per sandbox is a hard ceiling**. The `active -> revoked` flip is proven by direct SQL in `triggers` only.

## What Was Skipped or Deferred

- Backlog NOTE `variance-regression-check-revoke_NOTE_17-10-26.md`: written by UPDATE PROCESS (flip linked checks in the revoke batch, +1 row, weight update).
- Backlog NOTE `variance-fund-scope-supersede_NOTE_17-10-26.md` (review M1): written by UPDATE PROCESS.
- Review M2 and minors (`fundName` wiring, client/Worker label parity test, non-fatal `finding_too_large`, intent `''` edge): added to the Phase 04 plan body as Step-0 carry-overs. Rollback-pair rule, 0006 non-idempotence and `seed-copy.ts` intent/scope: added to the Phase 05 plan body.
- Remote D1 apply of 0006 belongs to Phase 05 (Time Travel bookmark procedure). Not touched here.
- The deployed `rows_written` burst stays operator residual R2.
- `apps/web/src/state/review.ts` does not yet pass the active fund name to `fingerprintFindings` (state is V2/V4 scope). The new optional parameter is in place and tested. Until V4 wires it, the client label ignores the fund scope while the Worker applies it.

## Test Gate Outcomes

The Test Gates block ran exactly as written in the plan (bash loops, one token per call, no `--`):

| Command | Result |
|---|---|
| core `contracts` / `variance-label-scope-rule` / `firms-and-rules` | 34 / 5 / 8 passed |
| `pnpm --filter @aduin/scripts test` | 19 files, 165 passed |
| `pnpm seed:check` | OK |
| worker: `migrations` 6, `triggers` 8, `firm-list-parity` 4, `demo-workspace-not-polluted` 7, `variance-answer-intent-rule` 4, `variance-owner-persisted` 4, `variance-answer-append-only` 3, `variance-regression-no-cross-firm` 9, `variance-finding-wire-size` 3, `variance-label-call-sites` 3, `rows-written` 7, `memory-write-limits` 18, `memory-guards-matrix` 46, `memory-storage-contract` 4, `query-budget` 2, `memory-label-parity` 2, `idempotent-replay` 3, `memory-retention-purge-test` 4, `cron-purge` 4, `audit-trail-append-only` 4, `memory-endpoint-contract` 5 | all passed |
| web: `api-contract` 38, `outbox` 23, `stub-memory-api` 8, `realMemoryApi` 35, `import-graph` 4 | all passed |
| `pnpm --filter @aduin/web test:e2e:stack-memory` (whole project, local `wrangler dev --local` on 8788) | 12 passed |
| stack tokens `stack-memory-variance-regression-no-cross-firm`, `stack-memory-memory-no-cross-firm`, `stack-memory-smoke`, `stack-memory-package-privacy`, `sandbox-isolation`, `roundtrip` | 1 / 1 / 3 / 1 / 1 / 1 passed |

Regression block:

| Command | Result |
|---|---|
| preview `intake-firm-tagging`, `intake-baseline-role-same-firm` (port 4317, run before stack, serially) | 2 / 1 passed |
| web `package-confirm-table`; core `package-baseline-eligibility` | 4 / 5 passed |
| `pnpm --filter @aduin/worker test` | 71 files, **566** passed (was 526) |
| `pnpm --filter @aduin/scripts test` | 165 passed (was 162) |
| `pnpm --filter @aduin/core test` | **3165** passed, 3 skipped (+7 from this phase) |
| `pnpm --filter @aduin/web test` | 42 files, **313** passed (was 298) |
| worker and core `typecheck`, `pnpm typecheck` | exit 0 |
| `pnpm seed:check`, `pnpm guard:cf`, `pnpm secrets:scan` | OK |
| `pnpm lint` | exit 0 (after commit `84577e4`) |
| `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs .../harness/phase-03` | 0 failures, 0 warnings |
| `git diff --stat 0ee9fca HEAD -- apps/worker/migrations` | only `0006_variance.sql` (+137) |

Every developed behavior is proven by a Fully-Automated or Hybrid gate. The three Known-Gap rows (remote apply, deployed burst, revoke path) are named residuals, never the only proof. No section is green only by default.

## Plan Deviations

All are within the planned scope (implementation detail, no auth, billing, schema scope or public-route change):

1. **0006 also recreates `demo_ro_decision_update` and `demo_ro_counsel_answer_update` word for word.** Why: SQLite fires the newest trigger first. After the guards were recreated, a demo-row UPDATE reported `answer_immutable` instead of `demo_read_only` (`demo-workspace-not-polluted` went red). Recreating the two demo triggers after the guards restores the old priority exactly. The write is refused either way.
2. **New 0006 trigger texts map to a typed 400 `invalid_request`** (reason = the trigger text) through `TRIGGER_INVALID_REQUEST` in `db/tx.ts`, plus one branch in `memory/http.ts` `handle`. Older texts keep their existing mapping. `http.ts` is not named in Touchpoints, but it is the Worker memory error mapper the plan's D5 asks for.
3. **Core exports `scopeMismatch`** (next to `resolveLabel`). The NULL `decision_id` is keyed on the scope mismatch itself, as E1 asks, and the web `prior` is cleared in the same way. The `import-graph` ALLOWED list gains `scopeMismatch`, `normalizeAssertionLabel` and `describeAssertion` (stub value imports, C12).
4. **`fingerprintFindings` gains an optional `fundName` parameter.** Its caller in `state/review.ts` is not edited (off-limits this phase). See Forward Preview.
5. New files not listed by name in the plan: `apps/worker/src/memory/repo/regression.ts` (repo layer, within `memory/repo/*`), `apps/worker/test/memory/variance-harness.ts` (test helper, not a gate), `scripts/test/reference-firms-pin.test.ts` (the C3b scripts case).
6. "Masked-empty intent" is defined as nothing left after removing mask tokens (`#` plus up to 4 digits) and whitespace. Example: an intent of only `021000021` is refused.
7. A question with `owner` but no `owner_source` is stored as `suggested`. `owner_source` without `owner` is ignored.
8. `web/test/support/fakeMemoryFetch.ts` (the fake Worker for `api-contract`) now stores answered decisions (the real Worker always did), implements the variance answer rule, checks and the 128 KB findings body cap, and exposes `lookupCalls()`.
9. The real web client checks the variance answer rule before sending, so a refused answer spends no write budget. The server still re-checks after masking.
10. `memory-harness.ts` `dumpWorkspace` also scans `regression_check`, so the storage canaries cover the new table.
11. The worst-case wire test reads `FACT_MAX` through a relative import of `packages/core/src/variance/adapter.ts`, because it is not exported from the barrel. It is read, not retyped.
12. Control characters (6-byte JSON escapes) are not modelled in the worst case. The worst printable character `€` (3 bytes) is used.
13. Side effect of deviation 1: `question_owner_immutable` is newer than `demo_ro_counsel_question_update`. A direct-SQL owner UPDATE on a demo row therefore reports `question_owner_immutable` (still refused; no app path does this).

## Test Infra Gaps Found

- None blocking. Candidate: the plan's "firm in four mirrors" helper stays a backlog idea.
- `fakeMemoryFetch` was not storing answered decisions. Fixed here (deviation 8).

## Closeout Packet

- **Selected plan:** `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-03-memory-backend_PLAN_17-10-26.md`
- **Finished:** checklist A-H. Evidence pack: `process/features/variance-management/active/variance-mvp_17-10-26/harness/phase-03/` (5 files, validator clean).
- **Verified:** every Test Gates command and the regression block, on local D1 only.
- **Not verified:** remote D1 apply (P05), deployed burst (R2), independent EVL re-run, sonnet code-review and security pass.
- **Left for UPDATE PROCESS:** backlog NOTE `variance-regression-check-revoke`; record migration 0006 in the umbrella and registry (registry `status: DONE` after EVL); flag Phase 01 F1's stale 2000-char premise; the P05 note E9 (`seed-copy.ts` decision column list has no intent/scope).
- **Classification (final):** CLEAN with review notes. Phase VERIFIED; the plan stays in `active/` because it belongs to a live phase program (the umbrella and Phases 02, 04, 05 are still active); archival happens at program closeout.
- **EVL:** independent vc-tester re-run, 0 cycles, `results-evl.tsv` row `0 P03 tests PASS none HALTED_SUCCESS`.
- **Review:** vc-code-reviewer PASS WITH NOTES (M1 fund-scope supersede, M2 `fundName` not wired, minors above).
- **Next state:** Phase 02 EXECUTE (running), then Phase 04 inner PVL.

## Forward Preview

### Test Infra Found
- `apps/worker/test/memory/variance-harness.ts`: `askQuestion`, `answer`, `answerBody`, `withAssertion` (question, answer and assertion on a fresh run).
- `fakeMemoryFetch` now supports variance answers, `regression_checks` and `lookupCalls()`.
- Stack specs mint a session explicitly with `POST /api/session`, because the app creates one lazily.

### Blast Radius Changes
- New: `apps/worker/migrations/0006_variance.sql`, `apps/worker/src/memory/repo/regression.ts`.
- Changed public surface (all optional or additive): memory contracts, `MemoryApi.lookupWithChecks`, `AnswerInput.intent/scope/assertion`, `QuestionItem.owner/owner_source`, `resolveLabel(…, ctx?)`, `scopeMismatch`, `fingerprintFindings(…, fundName?)`, `splitByBytes`, `FINDINGS_BODY_CAP` (web), `varianceAnswerError`.
- **V4:** pass the active fund name from `state/review.ts` into `fingerprintFindings`, and consume `lookupWithChecks`.
- **V5:** retag the Northgate demo package to `hartwell-crane` and Lotus Bay (package 02) to `ostrander-pell`; leave package 03 untagged. Extend `seed-copy.ts` if the demo ever seeds scoped decisions (E9). Apply 0006 remotely.

### Commands to Stay Green
- `pnpm --filter @aduin/worker test` (566), `pnpm --filter @aduin/core test`, `pnpm --filter @aduin/web test` (313), `pnpm --filter @aduin/scripts test` (165), `pnpm seed:check`, `pnpm lint`, `pnpm typecheck`.
- `pnpm --filter @aduin/web test:e2e:stack-memory` (12; port 8788). Run the preview project first, never together.
- Never run `pnpm seed:gen` without `REFERENCE_0003_FIRM_IDS` in place (it is now in `gen-demo-seed.ts`).

### Dependency Changes
- None (no new packages).

CONTEXT_PARTIAL: none.
Follow-up stubs created: `variance-regression-check-revoke_NOTE_17-10-26.md`, `variance-fund-scope-supersede_NOTE_17-10-26.md` (feature backlog).
Phase 01 plan F1 stale 2000-char premise: already corrected in the landed Phase 01 plan (line 153 states no 2000-char clip); nothing to annotate.
