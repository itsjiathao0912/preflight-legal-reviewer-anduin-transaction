---
phase: program-closeout
date: 2026-10-17
status: COMPLETE_WITH_GAPS
feature: fund-package-intake
plan: process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp-umbrella_PLAN_17-10-26.md
name: report:intake-mvp-program-closeout
description: "Fund Package Intake program closeout: SPEC achievement AC-I1..AC-I20 and AC-S1..S4, test deltas, deviations, known gaps, archival decision"
metadata:
  node_type: memory
  type: report
  feature: fund-package-intake
---

# Fund Package Intake: program closeout (UPDATE PROCESS)

**TL;DR:** All four phases are executed, independently verified (EVL green) and deployed (Worker version `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f`). 20 of 20 acceptance criteria are met by passing automated gates; three carry a gap note (AC-I3 live OCR, AC-I5 LB2/proper nouns, AC-I7 seam only). Operator-only residuals remain, so the task folder stays in `active/`. Nothing was pushed.

## What Was Done

| Phase | Scope | Key commits |
|---|---|---|
| 1 | Core package engine (`packages/core/src/package`), heading forms and Annex/Question targets (T14), fixtures | f3928b6 28fe3d4 ff17999 eb5f5b5 8503cde |
| 2 | Web data plane: light read in the engine worker, Dexie v2, `usePackage`, frozen `PackageView`, multi-file Upload modal with confirmation table, demo packages, same-firm baseline role | 8a52c72 496c0f9 782d1fb 2e922f9 |
| 3 | Surfaces (no new screens): Structure Package lens, coverage line and gate reasons, "For the GP" group plus request DOCX, reload restore | 6fbe9a7 2b3a4fe a0e23a8 c21cd72 f08adcd |
| Review | APPROVE_WITH_FIXES; all MUST-FIX fixed and re-reviewed | 0784938 47e188f a4d7a34 |
| 4 | Perf, a11y and privacy specs, live package smoke script, deploy | c4d68bc a027187 9607860 6fb34fb |

Plans: eab4a0e, 1f17967, 527cb68. Live: `3d2c7301` (static assets only; Worker code is `994ea54`, unchanged by Intake). Rollback chain: 3d2c7301 -> cde74507 -> 328ca295 -> 09e7a579 -> 47d98295 -> 23612b12. Intake live AI/OCR spend: $0 (0 model calls).

## Test Gate Outcomes

| Suite | Before Intake | After | Result |
|---|---|---|---|
| core | 2914 | 3084 (+3 skip, opt-in) | green |
| web unit | 226 | 298 | green |
| preview e2e | 175 | 217 (+1 opt-in skip) | green |
| stack-memory | 10 | 11 | green |
| scripts | 152 | 162 | green |
| worker | 526 | 526 | green |
| contracts | 34 | 34 | green |

Also green: typecheck, lint, guard:cf, secrets:scan, fixtures:check, seed:check, record:author --check, precompute:ai --from-recordings --check, slice:check, preflight 13/13. Live: F1 `/api/health` no-store, F2 CSP byte-identical to `_headers`, F3 stack slice, F4 package smoke 8/8 Intake checks.

## SPEC Achievement

Legend: Met = automated gate passed; Met-with-gap = gate passed, a stated sub-part is not proven; Known-gap = no passing gate (none).

| AC | Status | Evidence |
|---|---|---|
| AC-I1 multi-file upload and limits | Met | `intake-multi-upload`, `intake-limits-refusal`, core `package-limits` |
| AC-I2 firm, fund, version | Met | `intake-firm-tagging` |
| AC-I3 scans reuse OCR or flag | Met-with-gap | `intake-scan-ocr-or-flag` (needs-OCR flag, coverage drop). Live OCR text quality is operator residual (stub `intake-operator-live-sweep`) |
| AC-I4 type, role, confidence, reason | Met | core `package-detect` |
| AC-I5 detection correct on demo set | Met-with-gap | `package-type-detection-golden`: no wrong `high` value (T1); two-subscription-agreement roles are `low` by design |
| AC-I6 low confidence holds run | Met | `intake-low-confidence-gate` |
| AC-I7 LLM fallback, never overrides | Met-with-gap | Seam only (T2): `package-suggester-seam`, `intake-no-llm-run`; no live task ships. Stubs `intake-llm-doc-type-suggest`, `package-no-llm-live-proof` |
| AC-I8 corrections persist | Met | `intake-correction-persists`, `intake-reload-restores-package`, `restore-last-doc` |
| AC-I9 baseline role, same firm only | Met | `intake-baseline-role-same-firm`, `package-baseline-eligibility` |
| AC-I10 references with quote and location | Met | `package-reference-extraction-golden` |
| AC-I11 reference recall 100% on seeded | Met | `package-reference-recall-matrix` (note: LB2 US Feeder Sub not extracted, outside seeded set; stub `intake-reference-families`) |
| AC-I12 resolve or "not in package" | Met | `package-reference-resolution-matrix`, `intake-reference-confirm` |
| AC-I13 quotes verbatim | Met | `package-quote-verbatim-contract` |
| AC-I14 defined-in-package terms not flagged | Met | `intake-crossdoc-terms-no-false-positive`, `package-crossdoc-terms-golden` |
| AC-I15 undefined term still an error | Met | `intake-crossdoc-terms-real-error`, `golden-11-undefined-units` |
| AC-I16 unverified without LPA | Met | `intake-terms-unverified-without-lpa` |
| AC-I17 coverage per check group | Met | `package-coverage-matrix`, `intake-coverage-visible` |
| AC-I18 partial never looks fully checked | Met | `intake-coverage-next-to-gate`, `intake-no-package-ui-on-samples` |
| AC-I19 gate policy | Met-with-gap | Core `package-gate-policy-matrix` + warn e2e; Blocked path unit-only (G6, stub `package-gate-block-e2e-reach`) |
| AC-I20 one request, all missing docs | Met | `intake-missing-docs-request-export`, core `package-request` |
| AC-S1 heading forms | Met | `structure-heading-forms` (8) |
| AC-S2 Annex/Question targets | Met | `broken-conditional-annex-question` (6) |
| AC-S3, AC-S4 design goldens, corpus regression | Met | `package-design-goldens` (3), explanation table in Phase 1 report |
| Base re-runs AC8, 13, 22, 25, 29, 30, 40, 41, 58 | Met | Phase 4 C7 list (determinism 23, golden-11 5, gate-state-matrix 2406, no-llm-corpus, perf-budget, a11y, firm-tagging); all pass |

Unmet criteria: none. Gap notes are backlog stubs in `process/features/fund-package-intake/backlog/`.

## Plan Deviations

1. T14 scope addition (heading forms, Annex/Question targets) and shared checkout re-sync (T12), both parent-approved.
2. Phase 1: `quote.ts` and a shared test loader added; `other` doc type row; narrower used-term rule; NG3 LPA has 10 Articles not 9.
3. Phase 2: four existing upload fixtures are high-confidence sub agreements and became one-document packages (accepted, Phase 3 R1).
4. Phase 3: join wrote the six 3a specs; `intake-demo-packages` wait raised 5 s to 30 s (flake hardening, no assertion weakened).
5. Phase 4: C6 literal `git diff P1_BASE` gate exits 1 only due to another session's already-live commits a0f4961 and 994ea54 (Worker code proven unchanged against live); F4 raw exit 1 only from third-party Turnstile iframe console errors (orchestrator ruled excluded).
6. Red-first was partly written alongside code in Phases 1 and 4 (recorded).

## Test Infra Gaps Found

Package Blocked path not e2e-reachable; smoke console rule trips on third-party noise; per-agent Playwright ports still open; bundle +270 kB. All have stubs.

## Closeout Packet

1. Selected plan: `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp-umbrella_PLAN_17-10-26.md`
2. Closeout classification: Keep in active/testing (AC-I3 live OCR and the live AI/OCR, real-session memory and Turnstile-iframe residuals rest on operator-run Known-Gap items; previous program precedent).
3. Finished: Phases 1-4, review fixes, deploy, live smoke, context docs, 12 backlog stubs.
4. Verified: every AC by an automated gate; live headers, health, slice, package smoke. Unverified: live AI/OCR on packages, R4 iframe CSP, manual keyboard and screen-reader pass.
4b. Validate-contract: present and PASS in every phase plan (PVL iterations 001-003 plus inner PVL).
5. Cleanup done: umbrella state, Phase Loop Progress, registry, context docs, backlog. Still needed: operator run, then archive.
6. Next valid state: operator residual run (see `intake-operator-live-sweep`), then `git mv` the folder to `completed/`. The orchestrator may push `main` (T13).
7. Commit checkpoint: execution commits done (c4d68bc .. 6fb34fb); this process commit follows.
8. Regression: Phase 4 C1-C7 serial full run, all PASS.
9. SPEC achievement: table above.

Drift score: HIGH (4 signals: >=10 files touched, backlog NOTEs written, feature-folder structure change, validate-contract deviations C6). Strongly recommend UPDATE PROCESS -- harness/protocol files touched. (Harness files untouched; band wording is the machine-matched string.)

## Post-Closeout Fixes

### 18-10-26: Run checks silently disabled (commit 8db9245, quick-fix lane, no plan file)

- **Found by:** live testing, uploading the NG3 package (`samples/packages/01-northgate-infrastructure-iii/docs`, 6 files).
- **Symptom:** "Run checks" stayed disabled with no explanation. `01-NG3-Subscription-Agreement.docx` and `04-NG2-Subscription-Agreement-2024.docx` both got role To digitize, so `packageRunReadiness` reported `multiple_to_digitize`, but `PackageConfirmTable` only rendered the `noSubAgreement` and `versionMissing` messages.
- **Fix:** `apps/web/src/features/open-document/PackageConfirmTable.tsx` now renders one `pkg-held` line (`data-testid="package-problem"`, `data-code`) per problem in the package notice: `multiple_to_digitize` ("N files are set to To digitize. Keep one and set the others to Reference or Baseline, or remove them."), `no_to_digitize` (hidden when there is no sub agreement), `low_confidence_unconfirmed` ("Confirm or fix {masked name} before running checks.").
- **Tests:** +3 web unit tests in `package-confirm-table.test.tsx` (file 7/7); extended e2e `apps/web/e2e/intake-low-confidence-gate.spec.ts` (preview, 1 passed); web typecheck passed. Full suites not re-run.
- **State:** merged to `main` (3ec092e) and deployed as a hotfix, see Deploy record below.
- **Deploy record (18-10-26):** hotfix deploy to https://aduin-transaction-web.giathaowork.workers.dev, new live version `b04f1a8c-41f5-4c20-92dc-196d6e7d252a` (previous `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f` is the first rollback target). Source: branch `hotfix/intake-readiness-msg` = a4d7a34 (the commit 3d2c7301 was built from) + cherry-pick of 8db9245 as c7fcb17. Main HEAD was deliberately not deployed: it holds undeployed Variance Phase 01-03 code needing migration 0006 (live D1 stays at 0005). Worker code identical to 994ea54. Gates on the hotfix tree: guard:cf OK, secrets:scan OK, web typecheck, web unit 301/301, preview e2e intake-low-confidence-gate 1 passed, plain build with site key, deploy:preflight OK.
- **Live smoke (18-10-26):** `/api/health` 200 no-store `{ok:true}`. NG3 smoke in headless Chromium (6 docx): Run checks disabled with 4 problem lines (3 "Confirm or fix ..." plus "2 files are set to To digitize..."); after setting 04-NG2 to Reference and confirming rows, no problem lines, Run checks enabled, checks ran ("Checks done", 7 findings). 0 AI/OCR model calls. The change is also on main, so the next main deploy (Variance Phase 05) includes it.
- **Open observation (not fixed):** role auto-detection marks two subscription agreements as To digitize in NG3 (the NG2 2024 one is arguably a baseline). `packages/core/src/package` untouched. Backlog: `process/features/fund-package-intake/backlog/intake-ng3-two-to-digitize-detection_NOTE_18-10-26.md`.
