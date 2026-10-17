---
phase: variance-mvp-program-closeout
date: 2026-10-18
status: COMPLETE_WITH_GAPS
feature: variance-management
plan: process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md
---

# Variance Management MVP - program report

**TL;DR:** All 5 phases are VERIFIED and Variance is live as Worker `d9aaddd9-a62f-4850-8ff2-89889c8ef652` (D1 migration 0006 applied, `schema_version` 6). All 20 acceptance criteria are met by passing automated gates; 2 of them (AC-V14, AC-V16) also have an unproven live write path that needs an operator run. Live AI calls for the whole feature: 0. The task folder stays in `active/` until the operator residuals run.

## Phases and commits

| Phase | Scope | Status | Commits |
|---|---|---|---|
| 01 | Core engine and corpus (`packages/core/src/variance/`) | VERIFIED | 42b3ecb 7f0f355 d954511 789eb8f 0ee9fca |
| 02 | Web Findings (Changes segment, change rows, baseline control, cosmetic groups, pending pill) | VERIFIED | 8f4e6a4 60a5507 15aa796 |
| 03 | Memory backend (migration 0006, regression_check, owner/intent/scope) | VERIFIED | f93fd9a b5b5f84 1882dbf ef11874 f68fe32 b6fe91b 84577e4 |
| 04 | Owners, Questions tabs, answer intent and scope, regression UI | VERIFIED | 838ca1e a31dff0 f42f56d a6ccd1b |
| 05 | Demo samples, e2e, perf and a11y, remote migration and deploy | VERIFIED (with gaps) | bd8ff4e 07db58b 179c315; merge of the live deploy branch f3a2a18, 566416e |

Live: `https://aduin-transaction-web.giathaowork.workers.dev`, version `d9aaddd9-a62f-4850-8ff2-89889c8ef652` (workers.dev only). Rollback chain: `d9aaddd9` -> `8a82ead2` (write-incompatible with schema 6, see incident) -> `b04f1a8c` -> `3d2c7301`. Time Travel bookmark before 0006: `0000003e-00000000-00005107-13e12919a05a2c9178a343de17daef4e`; SQL backup (82,122 B) is in the session scratchpad, not committed.

## Test counts (merged main 0c6312e, independent EVL)
core 3190 (+3 skip), worker 608, web unit 518, scripts 183, preview e2e 242 (+1 opt-in skip), stack-memory 12.

## AC-V1 to AC-V20 achievement

All scored against the automated/E2E gate named in each phase plan's traceability matrix. Evidence is in the per-phase reports.

| AC | Score | Evidence |
|---|---|---|
| V1 baseline from package, same firm only | met | P02 `package-baseline-eligibility`, `intake-baseline-role-same-firm`; P03 firm-scoped lookups. Limit: samples never become a baseline |
| V2 every change classified | met | P01 `variance-classification-contract` |
| V3 cosmetic hidden, countable, groupable | met | P02 cosmetic groups e2e |
| V4 demo 214 -> 7 plus R-01 | met | `variance-demo-count`; e2e `variance-demo-214-to-7` |
| V5 recall 100% on seeded | met | `variance-seeded-recall-matrix` |
| V6 cosmetic-as-logic at most 10% | met | `variance-precision-measure`: 2.9% overall, 6.7% on #5 -> #6 |
| V7 real #5 -> #6 | met | `variance-golden-05-06` (163 raw / 15 shown) |
| V8 no baseline means errors only | met | `variance-package-samples` (Redwood), P02 no-baseline spec |
| V9 never AI-gated | met | `variance-ai-never-gates-core` (Hybrid, stubbed AI), e2e `variance-ai-never-gates` |
| V10 impact from logic graph | met | `variance-impact-from-graph-fixtures`, `variance-impact-demo-4-2` |
| V11 owner by routing table, override saved | met | `variance-routing-table-matrix`; e2e `variance-owner-override` |
| V12 two owners, two questions | met | e2e `variance-two-owner-two-questions` |
| V13 per-owner groups and exports | met | e2e `variance-questions-by-owner-export` |
| V14 answer records option, note, intent, scope | met (local) | e2e `variance-answer-record-intent-scope`; worker `variance-answer-append-only`. Live write path unproven; fund-scope supersede limit |
| V15 intent human-entered | met | `variance-intent-human-only` (unit + e2e) |
| V16 R-01 regression check | met (local) | core `variance-regression-scope-exists`; e2e `variance-regression-r01`; stack `stack-memory-variance-regression-no-cross-firm`. Live write path = operator residual |
| V17 gate counts changes and questions, two states | met | `variance-gate-state-matrix`; e2e `variance-gate-two-states` |
| V18 demo gate walk | met | e2e `variance-demo-gate-walk` |
| V19 versioned, validated rules config | met | `variance-rules-config-schema-and-provenance` |
| V20 reproducible, works with no AI | met | `variance-determinism-repeat-run`, `variance-no-llm-full-run` |

## Incident (18-10-26)
Deploy `d9aaddd9` at about 20:28 UTC; the live probe failed twice from a probe timing bug; the Worker was rolled back to `8a82ead2`, which pins `EXPECTED_SCHEMA_VERSION '5'` and refuses memory writes on schema 6. Memory writes returned 503 for about 3.5 minutes (20:28:35-20:32:11 UTC, reads fine) until the orchestrator rolled forward to `d9aaddd9`. No data lost; D1 not restored. Lesson: after a schema_version bump the old Worker is write-incompatible, so rollback means roll forward or D1 restore. Recorded in `process/context/worker/all-worker.md` and backlog.
An earlier leg-2 attempt stopped at F3a because the live `8a82ead2` came from the unmerged branch `deploy/ai-stream-dedup`; resolved by its owner's merge (f3a2a18, 566416e). Nothing remote was changed by that attempt.

## Known gaps and backlog (all in `process/features/variance-management/backlog/`)
- `variance-live-probe-rerun_NOTE_18-10-26.md` (operator, next UTC day)
- `variance-live-regression-operator_NOTE_17-10-26.md` (live R-01 write path)
- `variance-manual-keyboard-pass_NOTE_17-10-26.md`, `variance-web-manual-keyboard-pass_NOTE_17-10-26.md`
- `variance-fund-scope-supersede_NOTE_17-10-26.md` (M1: fund-B answer supersedes fund-A's)
- `variance-regression-check-revoke_NOTE_17-10-26.md` (no revoke, 20 per firm)
- `variance-schema-bump-rollback-recipe_NOTE_18-10-26.md`, `variance-package-fixtures-docx-nondeterminism_NOTE_18-10-26.md`
- `variance-docs-handoff_NOTE_17-10-26.md` (README, DEPLOY.md, architecture docs for the design/doc session)
- `variance-demo-preseeded-r01_NOTE_17-10-26.md`, `variance-change-chip-overlap_NOTE_18-10-26.md`, `variance-p04-review-minors_NOTE_18-10-26.md`, `variance-package-01-key-divergence_NOTE_17-10-26.md`, `variance-page-label-noise-rows_NOTE_17-10-26.md`, `variance-impact-real-sample-ground-truth_NOTE_17-10-26.md`, `variance-render-first-live-turnstile_NOTE_17-10-26.md`
- Test infra: `design-probe.spec.ts` writes into another program's tracked folder; `intake-demo-packages` is load-sensitive; port 4317 teardown race between serial e2e calls.

## Archive decision
Keep `variance-mvp_17-10-26/` in `active/` until the operator residuals run (live probe re-run, live R-01 write, keyboard pass), same convention as Fund Package Intake. Archival gate: two criteria rest on Known-Gap live residuals, so the vacuous-green ban forbids archival now.

## Closeout packet (program)
Selected plan: the umbrella above. Classification: Keep in active/testing. Verified: all local gates, remote migration, live health/schema/headers/smoke. Unverified: live probe, live R-01 write, human keyboard pass. Next valid state: operator residual runs, then archive; Findings v2 Phase B may proceed now. Commit checkpoint: process commit after UPDATE PROCESS (source commits done). Drift: HIGH. Strongly recommend UPDATE PROCESS -- harness/protocol files touched.
