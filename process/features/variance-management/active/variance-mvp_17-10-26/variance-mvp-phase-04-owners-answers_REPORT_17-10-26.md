---
name: report:variance-mvp-phase-04-owners-answers
description: "Variance MVP Phase 04 EXECUTE report: owners, per-owner questions, Questions tabs and export, intent/scope, regression R-01, popover owner groups"
date: 18-10-26
phase: phase-04-owners-answers
status: COMPLETE
feature: variance-management
plan: process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-04-owners-answers_PLAN_17-10-26.md
metadata:
  node_type: memory
  type: report
  feature: variance-management
  phase: phase-04
---

# Phase 04 EXECUTE report: owners, answers, regression UI

**TL;DR:** Phase 04 is coded, committed (838ca1e feat, a31dff0 test) and every contract gate passes. Two fixes the PVL missed were needed for composite question keys: the Worker id charset rule and the Dexie stub's stored-finding check.

## What Was Done

- **Owners (AC-V11):** owner chip on each change row, a "Suggested owner" select with the routing reason, override saved in `uiState` (`variance:owner:{docId}`) and sent as `owner_source: 'override'` when the question is created. The select is read-only once asked. "You" is local-only: Ask owner is disabled with "Change the owner first".
- **Keys (AC-V12, B2, H2):** one question per (finding, owner) keyed by core `questionKey` (`<findingId>@<owner>`); error findings keep the plain id. The key survives the whole pipeline: `persistAnswer`, `readQuestionIds`, outbox `finding_keys` (plain id), `export-flow.recordInMemory`, the Dexie stub and the Worker question route.
- **Per-owner state (B4, H5, H7):** asked markers (`ownerAnswers[o] = null`) are written at the Ask click; `counselAnswer` is never written for change findings; per-owner answer ids; a revoked owner answer sets that owner back to asked (gate stays blocked).
- **Questions screen (AC-V13):** h1 and the effective registry label renamed "Questions" (route hash unchanged). With change questions: tabs `All · Counsel n · GP n · Fund admin n`, owner sections, and "Export for <owner> (DOCX)" opening the existing ExportDialog with that owner's sheet (owner in title and filename). Error-only documents keep the Phase 08 flat list. Intake's `GpRequestGroup` stays above the list on every tab.
- **Answer dialog (AC-V14, AC-V15, H8):** change questions get option A marked as Default, note, "Why is it written this way? (intent)", scope "This fund only / Firm template", and one preview line from `describeAssertion` (or "No automatic check for this item."). Firm template needs a non-blank intent whose masked form is not blank. Intent is sent only when non-blank (never `''`). No AI path touches intent; change questions never get an AI draft.
- **Regression R-01 (AC-V16, E1, E2, H4):** engine `runRegression(ref, checks)` returns change-kind views plus worker-decoded meta (core `f_<hash>` ids). A background regression client calls `lookupWithChecks` (all-zero sentinel when there are no fingerprints), falls back to the remembered input on `doc_not_retained`, and skips silently otherwise. Findings join rows with or without a baseline.
- **Gate popover (AC-V17, F1, H6):** reasons grouped "You · Counsel · GP · Fund admin · Earlier funds" (list only). Keys include the owner, items carry `data-owner`, and group sizes sum to `gate.reasons.length`. `GateButton.tsx` was not edited.
- **Memory wiring (H1, H3, H9):** `rowFinding`/`rowFingerprint` give change rows and regression findings a fingerprint and a wire. `refreshMemory` passes `fundScopeName(doc.fund)` (M2 parity with the Worker). `finding_too_large` stays non-fatal.
- **Worker (H2(d)):** the question route resolves finding, run and issue class from the plain id and keeps the composite as the question key.

## What Was Skipped or Deferred

- Agent-Probe design probe (`DESIGN_PROBE=1 ... design-probe`): not run. It writes screenshots under `process/`, which this run may not write to. It is left for EVL or the orchestrator.
- Manual keyboard pass: named residual. Backlog stub exists: `process/features/variance-management/backlog/variance-manual-keyboard-pass_NOTE_17-10-26.md`.
- Per-sub-step code-reviewer / simplifier / vc-scenario / vc-security spawns: not possible here (this agent has no Agent tool). I did my own trust-boundary review (below). An independent sonnet review is still recommended, as the plan's strategy says.
- stack-memory e2e (8788): no stack-memory token is in the contract's regression block, so I did not run it. The Worker change is covered by Worker unit tests.

## Test Gate Outcomes

All commands run as written in the contract (one token per call, no `--` token, preview e2e run one at a time on 4317 with a port check before each call).

| Gate loop | Result |
|---|---|
| Web unit: variance-counts-owner-selector 4, variance-question-ids 3, variance-owner-sheet-model 6, variance-counsel-export-contents 3, variance-intent-human-only-static 3, variance-assertion-preview 3, variance-regression-doc-not-retained 3, variance-memory-wiring 6, import-graph 4 | all pass |
| Worker: variance-question-key-composite 4, variance-owner-persisted 4, variance-label-call-sites 3, variance-answer-append-only 3, memory-label-parity 2 | all pass |
| E2E: variance-owner-override, variance-two-owner-two-questions, variance-questions-by-owner-export, variance-answer-record-intent-scope, variance-intent-human-only, variance-regression-r01, variance-gate-two-states | 7/7 pass |
| Regression preview e2e: counsel-sheet 3, counsel-answer 3, counsel-export 3, counsel-gate 4, gate-pill 5, memory-no-reflag 1, memory-prior-answer 3, memory-edit-is-new 1, memory-blocking-never-hidden 1, memory-no-cross-firm 1, a11y-keyboard 4, layout-vs-mockup 5, app-shell 8, placeholder-routes 5, no-llm-corpus 1, intake-missing-docs-request-export 2, intake-gp-group-absent-without-package 2, intake-gate-warning-policy 1, intake-demo-packages 1 (run alone) | all pass (app-shell and placeholder-routes after the derived label repair) |
| Regression web unit: export-flow 6, counsel-export-contents 7, counsel-draft 4, gate-reexport 5, api-contract 38, outbox 23, review-sync 13, package-gate-ui 7, gate-pill 4, gp-request-group 3 | all pass |
| Core: gate-state-matrix 2415, sheet-contents 5, variance-gate-state-matrix 9, variance-question-key-matrix 3 | all pass |
| `pnpm --filter @aduin/web test` | 55 files / 372 tests pass (A3 baseline before edits: 47 files / 341) |
| web typecheck, worker typecheck, `pnpm lint`, `pnpm typecheck` | clean |
| Extra (surfaces touched): P02 variance e2e specs (6) and a11y-smoke | all pass |

A3 baseline before edits: counsel-sheet 3, counsel-answer 3, counsel-export 3, counsel-gate 4, gate-pill 5 (e2e); export-flow 6, counsel-export-contents 4, import-graph 4 (unit).

**Count agreement (one selector; e2e `variance-questions-by-owner-export`, Fund III vs Fund II, 4 changes asked):**

| Surface | Counsel | GP | Fund admin | You | Total |
|---|---|---|---|---|---|
| Questions tabs (unanswered) | 2 | 2 | 1 | – | All 5 |
| Gate popover groups | 2 | 2 | 1 | 3 | 8 |
| Gate reasons / pill badge | | | | | 8 |
| Sidebar Questions badge | | | | | 5 |

**Red-first note:** the Worker test was confirmed red first (400 schema, then 400 id_charset), then made green. The web unit and e2e tests were written right after their code, inside the same section. The contract stubs were not run red on disk first.

## Plan Deviations

All stay inside the validate-contract blast radius. None touches auth, billing, schema or deploy.

1. **`apps/worker/src/memory/http.ts` (not in Touchpoints):** `parseWith` gained an opt-in `questionKey` option. Only the question route accepts `<ID_RE id>@<counsel|gp|fund_admin>` (64 chars or fewer). The existing `ID_RE` (no `@`) refused every composite key before the route ran, which the PVL did not catch. The decisions route still refuses `@` (pinned in the test). An unknown suffix is treated as a plain id and refused by the charset, as before. Test case 4 asserts that refusal rather than a stored question.
2. **`apps/web/src/api/stubMemoryApi.ts` (not in Touchpoints):** `createQuestions` checks the plain finding id (parity with the Worker H2(d) change). Without it, preview e2e could not create a question for any composite key.
3. **`apps/web/src/features/review/use-review-view.ts` (not in Touchpoints):** regression findings join the rows through the shared `changeFindings` helper. The view also exposes `regressionMeta`.
4. **Intent/scope fields on change questions only:** error questions keep the Phase 08 answer form. This is a reversible decision: sending the default `scope: 'fund'` for error answers would change legacy cross-fund labels (DECISION: a fund-scoped answer counts only in the same fund).
5. **Error findings have no owner chip:** error questions belong to Counsel, the core sheet default, so tabs, export and popover agree. Error findings did not get a chip from the `issue_class` row, which was PLAN-time Decision 2 (`sensitive_data` would be Fund admin).
6. **`Triage` gained `ownerAnswerInfo` (who/when/note/intent/scope per owner) and `ownerSource`**, beyond `ownerAnswers`/`ownerAnswerIds`. These are optional fields inside the persisted triage JSON; no Dexie change.
7. **Doc input remembering lives in `engine/client.ts` `analyzeInWorker`** (`rememberDocInput`/`docInputOf`), not in `state/review.ts`. The many unit tests that mock `engine/client` with fixed factories would otherwise break.
8. **Sidebar Questions badge:** error findings in Needs counsel plus one per asked owner of each change finding. A change row in `counsel` status with no markers (P02-era data) still counts 1, which keeps `variance-counts-selector` unchanged.
9. **`ai-draft.ts` unchanged:** change questions are filtered before `fetchAiDrafts` (`aiDraftRows`), and `baseWording` ignores AI text for change rows.
10. **Derived repairs (each proven by a failing run):** `src/smoke.test.tsx`, `e2e/app-shell.spec.ts`, `e2e/placeholder-routes.spec.ts` now expect the label "Questions".

**Files beyond the registry claim:** `apps/worker/src/memory/http.ts`, `apps/web/src/api/stubMemoryApi.ts`, `apps/web/src/features/review/use-review-view.ts`. Already advisory in the contract: `apps/worker/src/routes/memory/counsel.ts`, `apps/worker/test/memory/variance-question-key-composite.test.ts`, `apps/web/src/api/outbox.ts`, `apps/web/src/memory/fingerprintFindings.ts`, `apps/web/test/variance-memory-wiring.test.ts`, `apps/web/test/variance-regression-doc-not-retained.test.ts`.

## Trust-boundary self-review (in place of a vc-security spawn)

- **Spoofing / tampering of keys:** composite refs are accepted only by the question route, with the safe charset on the finding id and a known-owner suffix. Lookups stay inside the authenticated workspace.
- **Forged scope or assertion:** the client refuses firm template without an intent (blank or masked-blank), and the server refuses too. The assertion is built only from the worker-decoded `assertion_candidate` label, only for firm template and a non-unclear answer.
- **Information disclosure:** "You" never reaches the outbox or a key. Regression checks are server-scoped by workspace and firm. The client cannot re-check the firm because the summaries carry no firm id; the lookup is made per firm.
- **Denial of service:** at most 50 checks are taken, labels are cut to 80 chars and statements to 300. A regression or memory failure never blocks first paint.

## Test Infra Gaps Found

- Stub/Worker parity on question keys was untested before. It is now covered by `variance-owner-override` (stub question with `owner_source: override`) and `variance-question-key-composite` (Worker).
- `variance-regression-r01` checks the held and other-firm cases with a fixed 2 s wait, because "no finding" has no positive signal. It is a weaker check than the violated case.

## Closeout Packet

- Selected plan: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-04-owners-answers_PLAN_17-10-26.md`
- Finished: checklist A-H; commits 838ca1e, a31dff0 (local main, not pushed).
- Verified: every contract gate and the full regression block, run by this agent. Not verified yet: the independent EVL re-run, the design probe, the manual keyboard pass, and the live Worker path (V5).
- Remaining: EVL (vc-tester), a sonnet code review of the trust boundary, registry sync for the 3 extra files, then UPDATE PROCESS.
- Classification (at EXECUTE end): Keep in active/testing until the EVL confirmation run is done. Superseded by the final classification below (VERIFIED).

## Forward Preview

### Test Infra Found
- `apps/web/e2e/fixtures/variance-owners.ts`: `hcFile`, `openHc`, `openFundIIIvsII`, `changeRow`, `askOwner`, `gotoQuestions`, `questionRow`, `ownerRows`, `recordAnswer`, `recordFirmTemplateAnswer`, `stubRows` (reads stub values from `uiState`).
- Fake Worker `installFakeWorker(page, { regressionChecks })` returns `regression_checks` on lookup.
- Row selectors: question rows carry `data-key`, `data-owner`, `data-kind`; gate groups `[data-testid=gate-group][data-group=you|counsel|gp|fund_admin|earlier]` with `data-count`; tabs `questions-tab-<k>` with `data-count`.
- Real change titles in the Hartwell fixtures: "Investor Domicile" (Singapore, Counsel + GP), "Investor Type", "Tax Status", "Beneficial Owners", "Minimum Subscription", "Source of Funds Verification", "Representations of the Subscriber"; the Fund II vs Fund I row is "Removed "APPENDIX C – INVESTOR QUESTIONNAIRE"".

### Blast Radius Changes
- New: `features/variance/{OwnerChip.tsx,owner-store.ts,owner-groups.ts,regression-client.ts,AssertionPreview.tsx}`.
- Extra edits: Worker `memory/http.ts`, web `api/stubMemoryApi.ts`, `features/review/use-review-view.ts`.

### Commands to Stay Green
- The contract loops above. Run `intake-demo-packages` alone. Check `lsof -nP -iTCP:4317 -sTCP:LISTEN` before every e2e call.

### Dependency Changes
- None. No new package, no Dexie bump, no migration. Main-thread core imports added: `questionKey` and `parseQuestionKey` only (`varianceMetaOf` stays worker-only).

CONTEXT_PARTIAL: none.
Follow-up stubs created: none (the existing backlog keyboard-pass stub covers the residual).

## EVL fix cycle 1

Scope: three code-review findings on 838ca1e / a31dff0. Commits: f42f56d (fix), a6ccd1b (test).

1. MAJOR (H7 owner revoke) — `refreshMemory` now uses `rowFingerprint(k)` (change/regression rows get the locally computed fingerprint) and resolves each owner's `pending:<op>` id through `outbox().resolveId` to match the revoked decision exactly (one owner only). The fingerprint fallback applies only when no id resolves exactly (op not synced yet). Tests: two new cases in `variance-memory-wiring` (two owners, revoke gp only -> gp null, counsel kept; unsynced fallback + non-matching fingerprint untouched).
2. MINOR (owner key cross-check) — Worker `counsel.ts` and `stubMemoryApi.ts` refuse a body owner differing from the key `@owner` suffix (400 `invalid_request`, reason `owner_key_mismatch`) and persist the suffix owner when body owner is absent. Test: new case in worker `variance-question-key-composite`.
3. MINOR (scrub) — `scrubTerminal` sets `question.interpretations` to `[]` on terminal ops. `outbox` test extended with document-text interpretations.

Deviation: none (reason string `owner_key_mismatch` chosen as the fixed reason).

Gates: web tokens variance-memory-wiring 8, outbox 23, api-contract 38, stub-memory-api 8, review-sync 13, variance-owner-sheet-model 6 — pass. Worker variance-question-key-composite 5, variance-owner-persisted 4 — pass (no `counsel*` test file exists). E2E preview: variance-answer-record-intent-scope 1, variance-gate-two-states 1, variance-two-owner-two-questions 1, memory-prior-answer 3 — pass. Full web unit 374/374, worker 571/571, web + worker typecheck clean, `pnpm lint` clean.

## Final closeout (UPDATE PROCESS, 18-10-26)

**Status: VERIFIED. Classification: Ready for UPDATE PROCESS archival of the phase (umbrella program stays active; Phase 05 remains).** Commits: 838ca1e, a31dff0 (execute), f42f56d, a6ccd1b (EVL fix cycle 1). Local main only; nothing pushed or deployed; 0 model calls.

**EVL result (independent vc-tester, 1 fix cycle, `results-evl.tsv` HALTED_SUCCESS):** web unit 374, worker 571, preview e2e 234 passed + 1 opt-in skip (`intake-demo-packages` is a known load-sensitive flake; it passed when run alone), stack-memory 12, typecheck and lint green. Code review: PASS WITH NOTES; the major (owner revoke did not re-block the gate) and two minors were fixed in the fix cycle.

**SPEC achievement (umbrella SPEC governs; phase-program inner loop):** AC-V11 (owners) met, AC-V12 (one question per finding and owner) met, AC-V13 (Questions screen, tabs, per-owner export) met, AC-V14/V15 (intent, scope, assertion preview) met, AC-V16 (regression R-01) met against the fake Worker (live Worker path is an operator residual), AC-V17 (gate popover groups) met. Unmet or residual: manual keyboard pass (Known-Gap, backlog), live Worker regression path, live D1 persistence. Each residual has a backlog note.

**Plan deviations at EVL:** 10 at EXECUTE (above), none added by the fix cycle. Files beyond the registry claim: `apps/worker/src/memory/http.ts`, `apps/web/src/api/stubMemoryApi.ts`, `apps/web/src/features/review/use-review-view.ts`, plus advisory `counsel.ts`, `outbox.ts`, `fingerprintFindings.ts` and new tests.

**Review minors not fixed (backlog):** `process/features/variance-management/backlog/variance-p04-review-minors_NOTE_18-10-26.md`.

**Test infra gaps:** `variance-regression-r01` held and other-firm cases use a fixed 2 s wait; `intake-demo-packages` load-sensitive flake; stack-memory has no Variance owner or regression spec yet.

**Forward preview to Phase 05:** keep green the P04 token blocks above plus `intake-demo-packages` alone; Phase 05 owns remote apply of 0006 (Time Travel bookmark first), Worker then web deploy, the one-field `northgate-iii` retag, and demo seed. Never roll back the Worker alone after the web ships. Push rule: the user now allows a single orchestrator push after the feature closes; agents still never push.
