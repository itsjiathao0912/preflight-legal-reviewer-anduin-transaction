---
phase: variance-mvp-phase-05-demo-deploy
date: 2026-10-18
status: COMPLETE_WITH_GAPS
feature: variance-management
plan: process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-05-demo-deploy_PLAN_17-10-26.md
---

# Phase 05 - Demo, e2e, deploy: EXECUTE leg 1 report (local)

**TL;DR:** Leg 1 is done and green at HEAD `07db58b` (code commits `bd8ff4e` feat, `07db58b` test; local `main`, not pushed). Sections A to E, F1 and F2b ran locally with 0 model calls and 0 remote calls. Leg 2 (remote migration 0006 and the deploy) needs the F0 user confirmation first. **Leg 2 must deploy HEAD `07db58b`.** Status is COMPLETE_WITH_GAPS only because leg 2 has not run.

**Deploy-pinning concern (F4a):** after leg 1 finished, another session committed `9e866f2` on `main` ("feat: findings v2 pure logic modules", 17 new files under `apps/web/src/features/review/{v2,zoom}`, additive) and left more untracked files under `apps/web/src` (findings-v2 work in progress). HEAD is now `9e866f2`, not `07db58b`, and the code paths are not clean. F4a stops a deploy in that state. The orchestrator must coordinate before leg 2: either (a) the other session finishes or parks its untracked files and the full LEG-1 regression is re-run on the new HEAD (that HEAD becomes the deploy commit, and the F0 packet must list the findings-v2 commits it ships), or (b) the user decides otherwise. Leg 1 never touched those files.

## What Was Done

| Item | Result |
|---|---|
| A1 baseline at 5458b86 | core 3190 + 3 skip, worker 608, web 375, scripts 176, typecheck, lint green |
| A2 / A4 / A5 | `build-samples.ts` guard at line 214 confirmed; live-script conventions read (`common.ts`, `probe-session.ts`, `smoke-package.ts`); `expected/hartwell-crane.json` pins 214 / 7 / 3 / 4 / 207, 5 groups, owners, R-01 |
| A3 | Recipe read; site-key extraction moved to leg 2 (it is a live curl; deviation 2) |
| B1 | 4 "(variance demo)" samples (`vh-fund-I`, `vh-fund-II`, `vh-fund-III`, `vh-fund-III-appendix-c`, firm `hartwell-crane`); guard is now explicit `12 + 4`; 12 originals byte-identical; picker count derived 13 to 17 |
| B2 | `variance-package-samples`: Northgate vs its Fund II agreement (answer-key recall 7/7, 9 shown rows), Lotus Bay vs v1 draft ("shall not" to "shall" surfaced), Redwood Ridge errors only |
| B3b | `make-package.ts` `DESIGN_FIRMS`: Northgate `hartwell-crane`, Lotus Bay `ostrander-pell`, Redwood `null`; regenerated JSON differs only by the 2 `firmId` fields |
| C1 / C2 | `variance-demo-214-to-7` and `variance-demo-gate-walk` green (counts agree at 5 steps, N read from the page) |
| D1 / D2 | perf case: Fund III vs Fund II, checks done 16 ms, 7 changes 108-143 ms (budget 5000); a11y case: 0 critical on findings with changes, expanded change row, baseline modal, Questions, answer form |
| D3 | Agent probe at 1440 and 1024: sensible Tab order, 0 overflow, 0 console errors; finding: type chip overlaps the row title (backlog stub) |
| E1 / E2 | Full LEG-1 gate list green (table below); `counts-wording` 13 / 15 |
| F1 | guard:cf, secrets:scan, typecheck, worker and web suites green; evidence artifacts 1-4 written (validator 0 failures, 1 expected warning: artifact 5 comes after G) |
| F2b | Local populated-DB rehearsal of 0006: clean (details below) |
| Live probe | `scripts/src/live/probe-variance.ts` + offline test (6 tests); script key `probe:live-variance` |
| Backlog notes | `variance-docs-handoff_NOTE_17-10-26.md`, `variance-demo-preseeded-r01_NOTE_17-10-26.md`, `variance-change-chip-overlap_NOTE_18-10-26.md` |

### Mid-implementation progress note
At about 50% (B and C done): 9 of 20 leg-1 items complete, no blocker. Deviations at that point: picker `#NaN` label repair, C1 demo order. Continued without pause.

## What Was Skipped or Deferred

- **Leg 2 (F0, F2, F2c-F6b, G1-G3, H1 artifact 5):** needs the user confirmation. Nothing remote was run.
- **A3 site-key read** (live curl): moved to leg 2.
- `design-probe` spec not run (it overwrites tracked PNGs of another program); a scratch probe was used instead.

## Test Gate Outcomes (LEG 1, HEAD 07db58b, serial, one token per call)

| Gate | Result |
|---|---|
| install, typecheck, lint | PASS |
| core | PASS 3190 + 3 skip (first run: `size-cap`, `diff-determinism` timed out under load, the documented pair; both pass alone; full re-run green) |
| worker / web / scripts | PASS 608 / 375 / 183 (scripts +7: probe-variance 6, counts-wording 1) |
| fixtures:check, test package-fixtures | PASS (117 files; 4 tests) |
| e2e variance-demo-214-to-7, variance-demo-gate-walk, variance-package-samples | PASS 1 / 1 / 1 |
| e2e perf-budget, a11y-keyboard, sample-picker-smoke, intake-package-lens, intake-missing-docs-request-export | PASS 4 / 5 / 2 / 3 / 2 (re-run serially after a port-4317 teardown race in the runner) |
| test:a11y | PASS |
| core variance-demo-count, variance-determinism-repeat-run; worker rows-written; scripts conformance-free-plan | PASS |
| full preview e2e | 241 passed + 1 opt-in skip; `intake-demo-packages` failed under load and passed alone (twice) - documented load-sensitive spec |
| stack-memory | PASS 12 |
| slice:check, guard:cf, secrets:scan, seed:check, record:author --check, precompute:ai --check | PASS (no seed or recording diff) |
| 20 regression e2e tokens + unit package-gate-ui, gate-pill | PASS |
| counts grep, git diff --check | PASS |
| evidence validator (`harness/phase-05`) | 0 failures |

### F2b populated-DB rehearsal (local only, scratch persist dir in the session scratchpad)
- Built: migrations 0001-0005, `seed/demo.sql` (the live seed), a sandbox copy (workspace, analyst, 7 decisions, rule + evidence, 8 audit rows, fund, document, review run, question, answer).
- Before / after 0006: `law_firm` 3 to 6 (+3), `law_firm_alias` 6 to 12 (+6), workspace 2, decision 14, question 1, answer 1, run 1, audit 16, rules 2 unchanged; `schema_version` 5 to 6; `regression_check` 0 rows; 47 triggers including all 11 named in F3b.
- Guards hold after the trigger re-creation: decision quote / decision / intent / scope blocked (`decision_immutable`), active to revoked allowed; answer option / intent blocked (`answer_immutable`); question owner blocked (`question_owner_immutable`); demo rows blocked (`demo_read_only`); audit update and decision delete blocked (`audit_append_only`, `decision_append_only`).
- Re-running the 0006 `INSERT OR IGNORE` lines: no-op (6 / 12). F2c expectation confirmed: `law_firm` +3, `law_firm_alias` +6, nothing else changes.

## Plan Deviations
See `## Deviations` in the plan (8 items, all within blast radius): picker label repair in `OpenDocumentDialog.tsx`; A3 moved to leg 2; C1 demo order and Fund II picked in the `vs` control; Redwood no-firm behavior (no muted line); D1 "errors painted" = Checks done; D2 focus return not asserted; D3 scratch probe; DOCX bytes kept at HEAD after regeneration.

## Test Infra Gaps Found
- The preview e2e runner can see port 4317 still bound for a moment after a spec's server shuts down; back-to-back one-token calls need a "port free" wait (the gate script now waits).
- `design-probe.spec.ts` writes into another program's tracked folder; it should take an output dir.
- `intake-demo-packages` stays load-sensitive in the full run.

## Closeout Packet
- **Selected plan:** `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-05-demo-deploy_PLAN_17-10-26.md`
- **Finished:** Sections A-E, F1, F2b; commits `bd8ff4e`, `07db58b`.
- **Verified:** every LEG-1 local gate (above). **Unverified:** remote migration, deploy, live smoke, live probe (leg 2); live R-01 write (operator residual R2).
- **Classification:** `Keep in active/testing` (leg 2 pending).
- **Next valid state:** orchestrator runs F0 (asks the user with the packet below), then spawns leg 2 with this plan path.

### F0 packet (for the orchestrator to show the user)
1. Target `https://aduin-transaction-web.giathaowork.workers.dev`, Worker `aduin-transaction-web`, D1 `aduin-transaction-db`.
2. Remote commands: listed below (one `migrations apply --remote` for 0006, not idempotent; one `wrangler deploy`; `wrangler rollback <id>` only on a failed check).
3. Deploy commit: the commit the full regression ran on (`07db58b` today; HEAD has since moved to `9e866f2` by another session, see the concern above), which must equal `git rev-parse HEAD` and the EVL commit. Commits the bundle ships since the live Worker code 994ea54 include all Variance P01-P05 commits and another session's `c677ce6` (Preflight rename).
4. Recorded live version / rollback target: `b04f1a8c-41f5-4c20-92dc-196d6e7d252a`, then `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f` (re-read with `deployments list` at F3a and F4a; a different id = stop).
5. Leg-1 evidence: all local gates green; F2b rehearsal clean.

### LEG-2 command list (verbatim from the validate-contract; credentials loaded in the same Bash call as each wrangler command with `set -a; source ~/.config/cloudflare/credentials.env; set +a`, never printed)
```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction && pnpm guard:cf && pnpm secrets:scan
cd apps/worker && pnpm exec wrangler deployments list
cd apps/worker && pnpm exec wrangler d1 migrations list aduin-transaction-db --remote
cd apps/worker && pnpm exec wrangler d1 time-travel info aduin-transaction-db
cd apps/worker && pnpm exec wrangler d1 export aduin-transaction-db --remote --output <scratchpad>/aduin-transaction-db-pre-0006.sql
cd apps/worker && pnpm exec wrangler d1 execute aduin-transaction-db --remote --command "SELECT key, value FROM app_meta"
cd apps/worker && pnpm exec wrangler d1 execute aduin-transaction-db --remote --command "SELECT (SELECT COUNT(*) FROM law_firm) AS law_firm, (SELECT COUNT(*) FROM law_firm_alias) AS alias, (SELECT COUNT(*) FROM workspace) AS ws, (SELECT COUNT(*) FROM decision) AS dec, (SELECT COUNT(*) FROM counsel_question) AS q, (SELECT COUNT(*) FROM counsel_answer) AS ans, (SELECT COUNT(*) FROM finding) AS f, (SELECT COUNT(*) FROM review_run) AS runs, (SELECT COUNT(*) FROM audit_event) AS audit"
cd apps/worker && pnpm exec wrangler d1 execute aduin-transaction-db --remote --command "SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name"
cd apps/worker && pnpm exec wrangler deployments list
cd apps/worker && pnpm exec wrangler d1 migrations apply aduin-transaction-db --remote
(repeat the three SELECTs above, plus PRAGMA table_info(counsel_question) and SELECT COUNT(*) FROM regression_check, then compare per F3b)
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction && git rev-parse HEAD && git status --porcelain
VITE_TURNSTILE_SITE_KEY=<public site key read from the live bundle, A3> pnpm --filter @aduin/web build
pnpm --filter @aduin/scripts deploy:preflight
cd apps/worker && pnpm exec wrangler deployments list
git diff --stat HEAD -- apps/worker/wrangler.jsonc
cd apps/worker && pnpm exec wrangler deploy
curl -s https://aduin-transaction-web.giathaowork.workers.dev/api/health
curl -s -H 'x-aduin-client: 1' https://aduin-transaction-web.giathaowork.workers.dev/api/memory/health
curl -sI https://aduin-transaction-web.giathaowork.workers.dev/
pnpm guard:cf
SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack
pnpm --filter @aduin/scripts probe:live-variance
```
On a failed F5, F5b or live smoke: `cd apps/worker && pnpm exec wrangler rollback <version id recorded at F3a>` (whole version, F6b). Leg-2 notes: do A3 (read the public site key from the live `index.html` and JS assets) before the build; expected F3b effect `law_firm` +3, `law_firm_alias` +6 (F2b-confirmed); never run a Playwright `stack` project between the plain build and the deploy; F5b expects `schema_version` `'6'`, `seed_mode` `'0'`; write artifact 5 (`adversarial-validation.json`) after G and re-run the validator.

## Forward Preview

### Test Infra Found
- `chooseBaseline(page, name)` appended to `apps/web/e2e/fixtures/variance.ts` (picks a baseline in the `vs` control).
- Gate N: read from `gate-button .lbl` (the `.gn` badge repeats the number; `textContent` of the button concatenates both).
- No-firm documents: no baseline control, no Changes segment.
- `scripts/src/live/probe-variance.ts` reuses `RequestRecorder`, `mustAbort`, `frameOrigin` from `smoke-package.ts` and the guards from `common.ts`.

### Blast Radius Changes
- Extra edit: `apps/web/src/features/open-document/OpenDocumentDialog.tsx` (1 line, label).
- New public sample files `hartwell-crane-*.html` under the generated samples dir (gitignored).

### Commands to Stay Green
- The LEG-1 gate list in the validate-contract (serial; wait for port 4317 to be free between calls; `intake-demo-packages` alone; core timing pair alone if it times out under load).

### Dependency Changes
- None (no package, migration, seed or recording change).

CONTEXT_PARTIAL: none.
Follow-up stubs created: `process/features/variance-management/backlog/variance-docs-handoff_NOTE_17-10-26.md`, `process/features/variance-management/backlog/variance-demo-preseeded-r01_NOTE_17-10-26.md`, `process/features/variance-management/backlog/variance-change-chip-overlap_NOTE_18-10-26.md`.

## Leg 2 attempt (18-10-26) - BLOCKED at F3a, nothing applied

- Worktree: clean, detached at `07db58b` (timestamp-only DOCX drift restored, `git status --porcelain` empty).
- `pnpm guard:cf` OK, `pnpm secrets:scan` OK.
- `wrangler deployments list` (read-only): live version is `8a82ead2-07ed-4b06-ad60-226d3f4734c8` (created 2026-10-17T18:50:57Z), NOT the recorded `b04f1a8c-41f5-4c20-92dc-196d6e7d252a`. STOP condition hit. The orchestrator confirms it came from branch `deploy/ai-stream-dedup` (tip `d7b7756`), which is not in `07db58b`'s history, so deploying `07db58b` would roll back live fixes.
- `wrangler d1 migrations list --remote` (read-only): exactly `0006_variance.sql` pending (as expected).
- NOT run: time-travel info, backup export, before-count SELECTs, migration apply, build, deploy, post-deploy smoke. Remote D1 is still at 0001-0005, schema_version unchanged. No rollback needed.
- Rollback chain if needed later: `8a82ead2` (current live) -> `b04f1a8c` -> `3d2c7301`.
- To unblock: merge `deploy/ai-stream-dedup` (d7b7756) into main, re-run the LEG-1 regression on the merged HEAD, update the F0 packet (new deploy commit, rollback target `8a82ead2`), then re-spawn leg 2.

## Leg 2 retry (18-10-26) - migration applied, deploy rolled back, live memory writes degraded

**TL;DR:** Migration 0006 is applied and verified on live D1. The deploy (`d9aaddd9-a62f-4850-8ff2-89889c8ef652`) went live and passed health, schema and header checks, but `probe:live-variance` failed twice, so per the leg-2 rule it was rolled back to `8a82ead2-07ed-4b06-ad60-226d3f4734c8`. **The rolled-back Worker expects schema 5 and refuses memory writes (503) against schema 6**: live reads work, Accept/Dismiss/answers are not saved. The probe failure is a probe timing bug, not a product bug. Needs an orchestrator/user decision: roll forward to `d9aaddd9` (recommended) or restore D1.

- Worktree: detached at `0c6312e7f47f791649e90f19faeb129275889963`, porcelain empty at every check; `wrangler.jsonc` diff empty.
- F3a (x3: start, before apply, before deploy): live `8a82ead2`. Remote migrations: only `0006_variance.sql` pending.
- F2c: Time Travel bookmark `0000003e-00000000-00005107-13e12919a05a2c9178a343de17daef4e`; export `<scratchpad>/aduin-transaction-db-pre-0006.sql`, 82,122 bytes, mode 600, sha256 prefix `d0306d6408bbd7ac`, not committed.
- Before: schema_version 5, seed_mode 0; law_firm 3, alias 6, workspace 3, decision 21, question 0, answer 0, finding 0, review_run 0, audit 26; 40 triggers.
- F3 apply: one run, 34 commands, success.
- F3b after: schema_version 6; law_firm 6 (+3: calder-reyes, hartwell-crane, ostrander-pell), alias 12 (+6), all other counts unchanged; regression_check 0 rows; 47 triggers with all 11 named present (question_owner_immutable, regression_check_no_delete, regression_check_guard_update, regression_check_cap, demo_ro_regression_check, demo_ro_regression_check_update, demo_ro_regression_check_delete, decision_guard_update, answer_guard_update, demo_ro_decision_update, demo_ro_counsel_answer_update); owner/owner_source and intent/scope columns present; nothing pending.
- F4a/F4: plain build with the public site key read from the live bundle; `deploy:preflight` 13/13 (first run 12/13 because the env var was only given to the build); `wrangler deploy` -> `d9aaddd9-a62f-4850-8ff2-89889c8ef652` (workers.dev only, bindings and cron unchanged).
- F5/F5b on `d9aaddd9`: `/api/health` `{ok:true}` no-store; `/api/memory/health` ok:true, schema 6, expected 6, seed_mode 0; `/` 200 with CSP, nosniff, referrer and permissions policy; `guard:cf` OK.
- G: stack smoke failed once, passed on retry. `probe:live-variance` failed twice at `firm-combobox` fill ("element was detached") on the second upload; a third run was refused by the session ledger (4 of 5 today). The input showed "Hartwell & Crane LLP", so the firm is present live. Firm-list GET needs a session cookie (401 with curl); not separately checked.
- Probe diagnosis (local preview, scratch spec, deleted): after Fund II the probe checks `open-document-dialog` isVisible while the dialog is still closing, skips reopening, and then acts on inputs that are being removed. The e2e `uploadOne` helper waits for the dialog to be hidden; the probe does not. Classification: **harness-drift**. Fix: add `await expect(page.getByTestId('open-document-dialog')).toBeHidden()` after `open-submit` in `scripts/src/live/probe-variance.ts` (follow-up, out of this leg).
- F6/F6b: `wrangler rollback 8a82ead2-07ed-4b06-ad60-226d3f4734c8` -> live `8a82ead2`; `/api/health` ok; `/api/memory/health` **ok:false, schema 6, expected 5**. The plan's premise "old Worker keeps working with nullable columns" holds for reads only: `d7b7756:apps/worker/src/memory/health.ts:7` pins `EXPECTED_SCHEMA_VERSION = '5'` and `memory/ctx.ts:115` refuses writes when it does not match. Tabs that loaded the `d9aaddd9` bundle during its live window may still send new fields.
- Not done (outside authorized actions): roll forward, D1 restore. Spend: 0 AI calls.
- Options for the orchestrator/user: (a) roll forward with `wrangler rollback d9aaddd9-a62f-4850-8ff2-89889c8ef652` (that version passed every check except the probe, whose failure is a probe bug), then fix the probe and run it next UTC day; (b) user restores D1 from the bookmark (removes 0006; memory writes return on `8a82ead2`).

## Roll forward (18-10-26)

**TL;DR:** Orchestrator chose option (a). `d9aaddd9-a62f-4850-8ff2-89889c8ef652` is live again; memory health ok (schema 6 = expected 6). Write outage lasted about 3.5 minutes. Probe fixed in `179c315`; live probe deferred to the next UTC day (ledger 4/5).

- 20:32:06 UTC: `wrangler deployments list` confirmed live `8a82ead2`; `wrangler rollback d9aaddd9-a62f-4850-8ff2-89889c8ef652` -> deployed 20:32:11 UTC (message "variance P05 roll forward: schema 6 build"). workers.dev only; no routes or domains touched.
- Checks on `d9aaddd9`: `/api/health` `{ok:true}`; `/api/memory/health` ok:true, schema 6, expected 6, seed_mode 0; `/` HTTP 200 with CSP, nosniff, referrer policy; `guard:cf` OK; stack smoke passed first try (1/1, 8.0 s).
- Outage window (memory writes 503): 20:28:35 -> 20:32:11 UTC, about 3.5 minutes. Reads worked throughout. D1 not restored.
- Probe fix: `179c315` `fix: live variance probe waits for the Open dialog to close` (`scripts/src/live/probe-variance.ts`: wait for `open-document-dialog` hidden after `open-submit`). Offline `test probe-variance` 6/6, eslint and tsc clean. Not pushed.
- Deferred: `probe:live-variance` on the next UTC day. Spend: 0 AI calls.

## Final closeout (UPDATE PROCESS, 18-10-26)

**TL;DR:** Phase 05 is COMPLETE_WITH_GAPS. Variance is live as Worker `d9aaddd9-a62f-4850-8ff2-89889c8ef652` (D1 migration 0006 applied, schema 6). Every local gate is green on merged main `0c6312e`. The gaps are operator-only live proofs (R-01 write path, live probe, keyboard pass) plus one incident lesson now recorded in context.

### Final EVL (merged main 0c6312e, independent re-run)
core 3190 (+3 skip), worker 608, web unit 518, scripts 183, preview e2e 242 (+1 opt-in skip), stack-memory 12. Live checks on `d9aaddd9`: `/api/health` ok no-store, `/api/memory/health` ok schema 6 = expected 6 seed_mode 0, CSP and security headers on `/`, `guard:cf` OK, stack smoke 1/1. Live AI calls for the whole feature: 0.

### Incident summary
Deploy `d9aaddd9` at about 20:28 UTC. The live probe failed twice (probe timing bug, harness-drift, not product). Per the leg-2 rule the Worker was rolled back to `8a82ead2`, but that Worker pins `EXPECTED_SCHEMA_VERSION '5'` (`health.ts:7`, `ctx.ts:115`) and refuses memory writes on schema 6: memory writes returned 503 from 20:28:35 to 20:32:11 UTC (about 3.5 min; reads worked). The orchestrator rolled forward to `d9aaddd9`; D1 was not restored. **Lesson (durable):** after a migration that bumps `schema_version`, the previous Worker is write-incompatible. "Roll the Worker back, keep the migration" is NOT a safe rollback. A post-deploy failure must roll forward (fix) or the user restores D1 from the Time Travel bookmark. Plans must not list the pre-migration Worker version as an automatic rollback target. Recorded in `process/context/worker/all-worker.md` and backlog.

### SPEC Achievement (Phase 05 scope)
Phase 05 owns the demo, deploy and live-proof criteria. Scored against its named gates.

| Criterion | Score | Evidence |
|---|---|---|
| AC-V4 demo reduction (214 to 7 plus R-01) | met | e2e `variance-demo-214-to-7`, core `variance-demo-count` |
| AC-V18 gate walk Blocked to Ready, counts agree | met | e2e `variance-demo-gate-walk` (counts agree at 5 steps) |
| AC-V8 no baseline means errors only (package 03) | met | `variance-package-samples` (Redwood errors only) |
| AC-V20 reproducible, no-AI | met | core `variance-determinism-repeat-run`, `variance-no-llm-full-run` |
| Deploy with Time Travel backup, then verify | met | bookmark recorded, 0006 verified, `d9aaddd9` live checks green |
| Live variance probe on the deployed Worker | **unmet** | failed twice (probe bug), fixed in `179c315`, re-run deferred (ledger 4/5) |
| Live R-01 write path (AC-V16 on the real D1) | **unmet** | operator run needed (human, real browser) |
| Manual keyboard / screen-reader pass | **unmet** | Hybrid Known-Gap; human only |

SPEC Gaps (each has a backlog note): live probe re-run (`variance-live-probe-rerun_NOTE_18-10-26.md`), live R-01 write path (`variance-live-regression-operator_NOTE_17-10-26.md`), keyboard pass (`variance-manual-keyboard-pass_NOTE_17-10-26.md`, `variance-web-manual-keyboard-pass_NOTE_17-10-26.md`), fund-scope supersede (`variance-fund-scope-supersede_NOTE_17-10-26.md`), docs handoff (`variance-docs-handoff_NOTE_17-10-26.md`).

### Closeout packet (final)
1. Selected plan: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-05-demo-deploy_PLAN_17-10-26.md`
2. Classification: Keep in active/testing (archival gate: live R-01 write path and live probe are Known-Gap residuals, so the folder is not archivable yet; same convention as Intake).
3. Finished: leg 1 (A-E, F1, F2b), merge unblock, F2c-F6b, roll forward, probe fix, evidence pack 1-4.
4. Verified: all local gates, remote migration, live health/schema/headers/stack smoke. Unverified: live probe, live R-01 write, keyboard pass.
4b. Validate-contract: present, Gate PASS (inner-pvl phase 5).
5. Cleanup done: context docs, umbrella state, registry, backlog notes. Needed: operator residuals.
6. Next valid state: operator residual runs, then archive the task folder; Findings v2 Phase B (mount) may proceed.
7. Commit checkpoint: process commit after this UPDATE PROCESS (source commits already done).
8. Regression: full preview e2e 242 + stack-memory 12 PASS on 0c6312e.
9. SPEC achievement: see table above.
Drift score: HIGH (4 signals: 10+ files, durable lesson in worker context, 3+ memory-worthy observations, backlog notes written). Strongly recommend UPDATE PROCESS -- harness/protocol files touched.

Follow-up stubs: `variance-live-probe-rerun_NOTE_18-10-26.md`, `variance-schema-bump-rollback-recipe_NOTE_18-10-26.md`, `variance-package-fixtures-docx-nondeterminism_NOTE_18-10-26.md`.
