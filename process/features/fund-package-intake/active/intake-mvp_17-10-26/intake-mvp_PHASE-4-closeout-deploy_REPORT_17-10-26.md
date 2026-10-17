---
name: report:intake-mvp-phase-4-closeout-deploy
description: "Intake Phase 4 execute report: serial regression green, base-AC re-runs, plain web bundle, preflight 13/13, deploy 3d2c7301, live smoke (Intake 8/8 green, third-party Turnstile console noise), evidence pack"
date: 17-10-26
phase: phase-4-closeout-deploy
status: COMPLETE_WITH_GAPS
feature: fund-package-intake
plan: process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-4-closeout-deploy_PLAN_17-10-26.md
metadata:
  node_type: memory
  type: report
  feature: fund-package-intake
  phase: phase-4
---

# Phase 4 — Closeout and deploy: execute report

**TL;DR:** Regression green. Deployed version `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f` (rollback target `cde74507-7b92-4e43-99fa-754de2c5cf3b`). Live headers, health and the stack slice pass. The live package smoke passes all 8 Intake checks but exits 1, because the Cloudflare Turnstile iframe logs 6 console errors of its own. No rollback.

## Entry (A1)

- `P4_BASE` = `a4d7a34ee8792d35d7903d0ee08ab4ab3d21bcb9`. `P1_BASE` = `1f1796770b01d1c9ebef53d60c466e6a94173ea6`.
- Tracked modifications at entry: only `results.tsv` (this program's file). Untracked `.DS_Store` and `.playwright-mcp/` were ignored.
- Phase 1-3 reports exist (each COMPLETE_WITH_GAPS; independent EVL green per the orchestrator).
- `wrangler deployments list` at entry and again right before deploy: live = `cde74507-7b92-4e43-99fa-754de2c5cf3b`. This matches the expected id, so E15 is satisfied and it is the ROLLBACK_VERSION.

## What Was Done

| Step | Result |
|---|---|
| B1 `apps/web/e2e/intake-perf-budget.spec.ts` | hartwell **24 ms** (budget 2000), ngi **52 ms** (budget 5000), e2e bundle |
| B2 `apps/web/e2e/intake-a11y-keyboard.spec.ts` | 0 critical on 5 surfaces; serious: color-contrast(1) on findings, label-content-name-mismatch(4) on the lens |
| B3 `apps/web/e2e/stack-memory-package-privacy.spec.ts` | no member text in any URL or body; only session, memory and quota API calls; 0 failing POST; 0 console errors; schema 5 |
| B4 `scripts/src/live/smoke-package.ts` + test + `smoke:live-package` key | 6 unit tests |
| C1-C7 | see the gate table |
| D1-D3 | site key: 1 distinct `0x4` match, length 24; plain bundle; preflight **13/13 PASS + OK** |
| D4 | main bundle **837.67 kB** vs base 568 kB (+270 kB, above the 60 kB note threshold): code-splitting stub |
| E2 | `wrangler deploy` succeeded. Workers.dev only; bindings unchanged (DB, ASSETS, the same vars); cron trigger unchanged. **New version 3d2c7301-a4a5-487c-bd7d-2f2c0800be6f**. No secret, D1 or route action |
| F1-F4 | see Live smoke |
| G1 | evidence pack `harness/phase-4/` validator: 0 failures, 0 warnings |

## Test Gate Outcomes

| Gate | Result |
|---|---|
| core / worker / web / scripts | 3084 + 3 skip / 526 / 298 / 161 (162 after the smoke test addition), 0 failed |
| typecheck, lint, guard:cf, secrets:scan, fixtures:check (65 files), seed:check, record:author --check (11), precompute:ai --from-recordings --check, slice:check (1 passed), git diff --check | all exit 0 |
| C4 preview e2e (one invocation) | **217 passed, 1 skipped** |
| C5 stack-memory | **11 passed** |
| C6 literal `git diff --quiet P1_BASE ...` | **exit 1** (see Deviations); `core test contracts` 34 passed |
| C7 core: determinism 23, golden-11-undefined-units 5, gate-state-matrix 2406, package-determinism 3, structure-heading-forms 8, broken-conditional-annex-question 6, package-design-goldens 3 | all pass |
| C7 web: engine-package-api 4, package-db-v2 2, retention-purge 3; scripts: conformance-free-plan 10, smoke-package 5→6; worker: memory-storage-contract 3, memory-retention-purge-test 3 | all pass |
| C7 e2e: no-llm-corpus 1, sample-zero-calls 4, perf-budget 3, gate-pill 5, counsel-gate 4, a11y-keyboard 4, intake-no-llm-run 1, intake-firm-tagging 2, intake-gate-warning-policy 1, intake-crossdoc-terms-real-error 2, intake-perf-budget 1, intake-a11y-keyboard 1, intake-demo-packages 1, upload-firm-tagging 4, test:a11y 1 | all pass. `stack-memory-package-privacy` belongs to the stack-memory project and is proven by C5 |
| D3 preflight | 13/13 + OK |
| Evidence validator | 0 failures |

### Live smoke (F)

- F1: `GET /api/health` returns `{"ok":true}` with `cache-control: no-store`. A HEAD request returns 404 because the route is GET-only.
- F2: `/` returns 200. CSP is byte-identical to `apps/web/public/_headers`. COOP, Permissions-Policy, Referrer-Policy (no-referrer) and nosniff are present.
- F3: `stack` slice against live: 1 passed, `global_ok=true`.
- F4: `smoke:live-package` (package `northgate-iii`):
  - All 8 checks true: app-shell, confirm+run, findings visible, coverage line, Structure Package tab, GP group with 7 items whose labels match `expected.json`, GP request DOCX, and no package UI on sample #3.
  - Run to findings: 219-228 ms. Coverage line: "Coverage: partial - 3 terms unverified, 18 references not in the package".
  - 31 requests, 0 failing POST, 0 aborted and 0 fulfilled AI/OCR.
  - **Exit 1** on 6 console errors. Every one comes from `https://challenges.cloudflare.com`: the Turnstile iframe's own `connect-src` CSP refusing `data:,`, plus its `%c%d` log line. The result JSON is in `harness/phase-4/smoke-package-result.json`; third-party URLs are reduced to their origin, and the file contains 0 site-key matches.
- F5 (rollback) was NOT run. The failing condition is not Intake behavior. The Turnstile widget, site key and our CSP are unchanged from the previous live version. The live app itself had 0 errors.

## Plan Deviations

1. **C6 / E16:** the literal diff gate exits 1. The extra files (`apps/worker/src/proxy/pipeline.ts`, `upstream/openrouter.ts`, 3 worker tests, `detectors/ref-label-coherence.ts`) come only from the other session's commits a0f4961 and 994ea54. Both are already live, and the orchestrator says shipping them is intended. Proof that the Worker code did not change against live: `git diff --quiet 994ea54 HEAD -- apps/worker` = 0, and `ref-label-coherence.ts` is equal to `1f5cfa5`. The plan text says BLOCKED; this was handled as documented-and-continue under the orchestrator brief.
2. **B2:** Escape closes the modal, but focus goes to `<body>` instead of the trigger. This is pre-existing: the `DocSwitcher` popover is already unmounted. Product source is read-only in Phase 4, so the spec asserts keyboard recovery (Tab reaches `doc-switcher`). Stub: dialog focus return.
3. **B3:** the in-spec members produce zero findings, so the spec asserts `findings-meta` and the coverage line instead of a finding row. The privacy assertions are unchanged.
4. **F4:** the plan's "exit 0" is not met (third-party noise, see above). The classification stays strict; there is no ignore list.
5. **B1 note:** the timings are tiny because package members are analyzed while the draft is built. The measurement is still from click to "Checks done", as specified.
6. The review decision is a self-review. The independent sonnet reviewer pass is left to EVL.
7. Red-first: the stubs and the implementation were written in one step; each test was run to green.

## Test Infra Gaps Found

- `smoke:live-package` console-error rule trips on Turnstile iframe noise in headless Chromium. It needs a decision on a first-party-only console rule (proposed stub: `intake-live-smoke-turnstile-console_NOTE_17-10-26.md`).
- A site-key extraction script would replace the scratchpad reader. Per-agent Playwright ports remain open (P6-2).

## What Was Skipped or Deferred (operator residuals, Known-Gap)

Real-session package memory writes, the AC51 echo, the live AI/OCR sweep, the D4 burst, the R4 Turnstile iframe with a human-solved challenge, and a manual keyboard pass. Stubs to register at UPDATE PROCESS:
- the phase10 residual notes (append the package flow)
- `intake-code-splitting`
- `intake-manual-keyboard-pass`
- `intake-llm-doc-type-suggest`
- `intake-dialog-focus-return`
- `intake-live-smoke-turnstile-console`

No follow-up plan stub files were created in this phase.

## Closeout Packet

- Plan: `intake-mvp_PHASE-4-closeout-deploy_PLAN_17-10-26.md`. Classification: **Keep in active/testing**, pending the EVL decision on F4 and C6.
- Verified: regression, preflight, deploy, F1-F3, and the Intake behaviors of F4. Unverified: the session-dependent residuals.
- G3 guard exits after the final commit are recorded in the commit-hygiene section below.

## Forward Preview

- Test Infra Found: `smoke:live-package` (`--out` writes the result JSON); 3 new e2e specs.
- Blast Radius Changes: none outside the plan's touchpoints.
- Commands to Stay Green: the C1-C7 list; build plain right before deploy; `smoke:live-package`.
- Dependency Changes: none.
- CONTEXT_PARTIAL: none.

## G3 final guards

(recorded after the last commit)
