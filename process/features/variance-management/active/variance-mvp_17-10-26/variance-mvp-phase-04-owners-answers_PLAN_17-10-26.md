---
name: plan:variance-mvp-phase-04-owners-answers
description: "Variance MVP Phase 04 (V4): owner chips and override, per-owner question keys, Questions owner grouping and per-owner DOCX export, template wording for change rows, Record-answer intent/scope/preview, regression client wiring (R-01), gate popover owner grouping"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: variance-management
  phase: phase-04
---

# Phase 04 - V4 Owners, answers, regression UI

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** variance-mvp
**Umbrella plan:** process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-04-owners-answers_REPORT_17-10-26.md (flat in the program task folder)
**Risk class:** medium-high (trust-boundary client logic: forged scope/assertion must also be impossible from the UI; shared-collision zone with Intake on the Questions screen and the gate popover; no schema, no deploy)
**Depends on:** Phase 02 (web Findings, VERIFIED) AND Phase 03 (memory backend, VERIFIED). External: the Intake feature is CLOSED (live Worker 3d2c7301); Step 0 re-sync done 2026-10-17 (see Step 0 status below).
**Context routers read:** `process/context/all-context.md`, `process/context/ui/all-ui.md`, `process/context/worker/all-worker.md`, `process/context/tests/all-tests.md`.

---

## Overview

Turns suggested owners into decisions and answers into memory, with no new screen: an owner chip on each change row (read from V1 routing, overridable before asking), one question per (finding, owner) using the composite key `<findingId>@<owner>`, the existing "Counsel questions" screen renamed "Questions" with `All · Counsel · GP · Fund admin` tabs and unanswered counts plus one DOCX export per owner, deterministic wording for change questions, the Record-answer dialog extended with intent and scope (firm template requires an intent and shows a one-line preview of the check it will create), the regression example R-01 wired end to end, and gate popover reasons grouped by owner (list only).

Locked inputs: DECISION D4 (routing, keying, override storage, tabs, per-owner export), D5 (assertion creation only when `facts.assertion_candidate` exists, preview from `describeAssertion`, client write path), D2 (gate policy). UI contract: `design/mockups/app-variance.html` plus notes (Questions grouping, answer modal, popover groups). Intent is human text only (AC-V15): no AI intent draft exists in this MVP.

Decisions made at PLAN time (reversible, recorded): (1) the owner override is allowed only while no question exists for that finding; once asked, the chip is read-only with a tooltip. (2) Error findings get an owner chip too (from the `issue_class` row) but keep the plain question key. (3) The counsel nav entry is renamed "Questions" by editing its registry row only; the route hash is unchanged so deep links keep working.

## Step 0 - Precondition: re-sync with Intake before EXECUTE

Re-sync with Intake's landed code (inner R+I refresh) before EXECUTE: read Intake's final PLAN and closeout and its landed diff; update the `## Dependencies on Intake` section of the umbrella (observed vs assumed to observed); re-allocate the migration number; re-check the collision files in the phase-blast-radius registry; write an `## Inner Loop Refresh Note` in this plan. EXECUTE may not start until the Intake feature is closed.

Phase-specific Step 0 checks: (a) **Questions screen / counsel sheet overlap:** OBSERVED-IN-CODE (2026-10-17): `features/counsel/GpRequestGroup.tsx` is rendered ONCE at `CounselScreen.tsx:271`, inside the non-empty branch directly above `<ul className="rows" data-testid="counsel-list">`, only when a package exists (`<h1 id="h-counsel">` at :160 and the two `id: 'counsel'` rows of `features/registry.ts` at :29 and :75 are unchanged), with its own `exportRequestDocx.ts` (a separate missing-documents request DOCX; the counsel export is unchanged) and its requests are not Findings. Reconciliation rule (default, reversible): the owner tabs and per-owner counsel exports operate on the question list only; `GpRequestGroup` stays where Intake put it, unchanged and visible on every tab, with its own count and export; the GP tab badge and the gate popover owner groups count variance questions only (they equal the core gate reasons), and Intake's package reasons stay in Intake's own popover section; nothing is counted twice. The landed component was re-read at Step 0 and its structure matches this rule; re-check at EXECUTE entry. (b) OBSERVED-IN-CODE: Intake's `GateButton.tsx` builds `merged = {...gate, status, reasons: [...gate.reasons, ...pkgBlocks]}` (blocked when the core gate OR any package block reason blocks), passes it to `gatePillView`, renders core `GateReasons`, then `PackageGateReasons`, then `CoverageLine`, and its badge uses `merged.reasons.length`; V4 changes only the core `GateReasons` grouping (owner groups) and must keep the `merged` object, that order and the badge expression intact; every variance-policy gate input (including the `Triage.ownerAnswers` path into `computeGate`) keeps the `unreadable` spread from `use-review-view.ts:38` (D-S0-4). (c) Re-read V2's final `ChangeRow.tsx`, `select.ts`, `variance-store.ts`, `baseline-source.ts` (landed code) and V3's final contracts. (d) Re-confirm `hartwell-crane` is present in the web firm list (V3).

**Step 0 status (resolved 2026-10-17, PLAN-SUPPLEMENT; basis `variance-mvp_STEP0-RESYNC_17-10-26.md`, git HEAD 8a9398c).** Intake is CLOSED. Check (a) and (b) are answered from landed code above: `CounselScreen.tsx` gained only an import and `<GpRequestGroup />` at :271 (+2 lines); `GateReasons.tsx`, `ExportDialog.tsx`, `ai-draft.ts` and `registry.ts` are unchanged by Intake; Intake added `PackageGateReasons.tsx` and `CoverageLine.tsx`. Decisions recorded (orchestrator defaults, reversible): **D-S0-4** every variance-policy gate call and `GateButton.tsx` keep the `unreadable` spread and Intake's `merged` object with its three-part render; the GP tab badge and popover owner groups count variance questions only (they equal the core gate reasons) and Intake's package reasons stay in Intake's popover section, as before. **D-S0-6** the V7 trust-split owner stays GP per the user-approved SPEC A9 (the package-01 answer key says Counsel: recorded as a note for the design session; no rule change; the owner override stays available). **D-S0-8** never git push in any phase. **D-S0-9** `.playwright-mcp/` and `.DS_Store` are not Variance's: never touch or commit them. Regression tokens added (Intake surfaces that now see a variance pass): e2e `intake-demo-packages` (load-sensitive 30 s wait, run alone) and the web unit tokens `package-gate-ui`, `gate-pill` and `gp-request-group` (`gate-pill` is also already an e2e token below). Hook-filtered word rule: the tokens in Test Gates contain neither hook-filtered word (the production output directory and installed-packages directory names).

## Phase Completion Rules

- CODE DONE = checklist A to J implemented and committed.
- VERIFIED = Exit Gate green, validate-contract written, regression evidence for overlapping surfaces (`counsel-sheet`, `counsel-answer`, `counsel-export`, `counsel-gate`, `gate-pill`, `memory-*`, `export-flow`, `counsel-export-contents`, `sheet-contents`, `gate-state-matrix`, `a11y-keyboard`, `layout-vs-mockup`). Code-only completion is CODE DONE.
- Known-Gap is never a proving strategy; live AI wording stays a named residual (not used here).

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy |
|---|---|---|---|
| AC-V11 | owner suggested by routing table; analyst override saved and recorded (client store plus `owner_source` at ask time) | `variance-owner-override` (e2e) plus V1 `variance-routing-table-matrix` | Fully-Automated |
| AC-V12 | Singapore yields one GP question and one counsel question, each answerable alone | `variance-two-owner-two-questions` (e2e) | Fully-Automated |
| AC-V13 | Questions grouped per owner with unanswered counts; one DOCX export per owner containing only that owner's questions with quote, old vs new text, options; counts equal the gate reasons | `variance-questions-by-owner-export` (e2e with DOCX parse-back) plus `variance-counsel-export-contents` (web unit, node env, mammoth) | Fully-Automated |
| AC-V14 | dialog saves option, note, intent, scope; firm_template refused without intent; record shows who and when | `variance-answer-record-intent-scope` (e2e) plus V3 `variance-answer-append-only` | Fully-Automated |
| AC-V15 | intent is human-entered: no auto-fill, no AI draft path, whitespace-only refused | `variance-intent-human-only` (e2e plus static unit check) | Fully-Automated |
| AC-V16 | R-01 end to end: after a firm-template answer "Appendix C must exist", Fund III without Appendix C shows a blocking finding "Regression: confirmed in Fund II" with the check quote; with Appendix C present no finding; another firm never runs it | `variance-regression-r01` (e2e: violated, held, other firm) plus V3 `variance-regression-no-cross-firm` | Fully-Automated |
| AC-V17 | gate counts untriaged changes, regression findings, asked-unanswered; "unclear" stays blocking; exactly two states; cosmetic never blocks | `variance-gate-two-states` (e2e) plus V1 `variance-gate-state-matrix` | Fully-Automated |
| Counts agree | Findings segment, Questions tabs, sidebar badge, gate popover groups come from one selector | `variance-counts-owner-selector` (unit) plus `variance-questions-by-owner-export` | Fully-Automated |

## Entry Gate

- Phases 02 and 03 VERIFIED; Intake closed (Step 0); `hartwell-crane` in the web firm list.
- V2 and V3 reports read in full (V1 `## Forward Preview` only).

## Touchpoints

Create (V4-owned):
- `apps/web/src/features/variance/{OwnerChip.tsx,owner-store.ts,regression-client.ts,AssertionPreview.tsx,owner-groups.ts}` (owner override persisted in the `uiState` key `variance:owner:{docId}`; `regression-client.ts` takes the lookup's `regression_checks`, runs the core check via the engine worker and appends the regression finding; `owner-groups.ts` builds the per-owner lists for tabs, export and popover)
- `apps/web/test/variance-{counts-owner-selector,question-ids,owner-sheet-model,counsel-export-contents,intent-human-only-static,assertion-preview,regression-doc-not-retained,memory-wiring}.test.ts` (`variance-memory-wiring` added by the 18-10-26 inner PVL, Section H: change-row fingerprints, composite key through outbox and export, client/Worker label parity (M2), `finding_too_large`, intent `''`)
- `apps/worker/test/memory/variance-question-key-composite.test.ts` (new, H2: the question route accepts a composite `finding_ref`)
- `apps/web/e2e/variance-{owner-override,two-owner-two-questions,questions-by-owner-export,answer-record-intent-scope,intent-human-only,regression-r01,gate-two-states}.spec.ts`
- `apps/web/e2e/fixtures/variance-owners.ts`

Modify (additive; each file's owner in parentheses):
- `apps/web/src/features/counsel/{CounselScreen.tsx,QuestionRow.tsx,AnswerForm.tsx,sheet-model.ts,question-ids.ts,export-flow.ts,exportDocx.ts,counsel-store.ts,ExportDialog.tsx,ai-draft.ts}` (Phase 08; tabs, owner sections, per-owner export opening `ExportDialog` with that owner's sheet (owner in title and filename), composite keys via the single core `questionKey`, answer fields; `toggleAi` and `ai-draft.ts` exclude change questions so 0 live AI calls are made for them; `sheet-model.ts` `gateInputs` receives `ownerAnswers`)
- `apps/web/src/features/review/model.ts` (V2-owned, Intake collision file; NARROW edit only: add the optional `ownerAnswers?: Partial<Record<Owner, CounselOption | null>>` field to the `Triage` interface (defined in this file) and pass it into the `states[id]` object inside `computeGate`; no other change or behavior in the file, and the `unreadable` spread added by Intake at `use-review-view.ts:38` stays; V2 must be committed first and Intake is closed)
- `apps/web/src/features/gate/GateReasons.tsx` (Phase 08; group by owner, list only (`GateButton.tsx` is not edited by V4: its `merged` object, badge and three-part render stay; D-S0-4), "You" group for the analyst's own items, "Earlier funds" group for prior-fund items)
- `apps/web/src/features/variance/{ChangeRow.tsx,select.ts,variance-store.ts}` (V2-owned; narrow edits after V2 landed: mount `OwnerChip`, add owner counts to the shared selector, receive the regression finding; V2 must be committed first)
- `apps/web/src/state/review.ts` (additive: `recordAnswer` and `persistAnswer` gain an `owner` argument, answer action carries owner/intent/scope/assertion; the optional `Triage.ownerAnswers` map (owner to answer) lives INSIDE the persisted triage JSON, so `saveTriage` and the Dexie schema need no change (A1 confirms by reading `saveTriage`); regression arrival action recomputes the gate; edit scope limited to those actions PLUS the Section H items: `findingById`/`wiresFor`/`persistAnswer` resolve change and regression rows (H1; `decide` is unchanged), `refreshMemory` and the load-time lookup pass the fund scope (H3), `needsCounsel` writes the asked markers (H5), per-owner answer ids and the `refreshMemory(revokedDecisionId)` revoke branch (H7))
- `apps/web/src/features/registry.ts` (rename the LAST (effective, last-wins) `counsel` row label to "Questions"; optionally sync the earlier placeholder row label; ONE logical rename; seam)
- `apps/web/src/engine/{engine.worker.ts,types.ts,client.ts}` (additive `runRegression(documentRef, checks)` calling core `runRegressionChecks`; V2 owns the file, serialized after it)
- `apps/web/test/import-graph.test.ts` (ALLOWED: append the main-thread value imports actually used, expected `questionKey`, `parseQuestionKey`, `describeAssertion`; single appended line, serialized seam)
- `apps/web/e2e/fixtures/memory-stub-rules.ts` (add `regression_checks` and the new answer fields to the fake Worker, additive)
- `apps/web/src/features/counsel/CounselScreen.tsx` h1 text becomes "Questions" (same file as above).
- Repairs by derivation only AFTER a failing run proves the need (nav label, h1 or Questions markup changed): `apps/web/e2e/{counsel-sheet,counsel-answer,counsel-export,counsel-gate,app-shell,placeholder-routes,a11y-smoke,layout-vs-mockup}.spec.ts`, `apps/web/src/smoke.test.tsx`

- (added by the 18-10-26 inner PVL, Section H; each is a NARROW additive edit of a Phase 03 file that is VERIFIED and has no live collision) `apps/web/src/memory/fingerprintFindings.ts` (pure helper `fundScopeName(fund)` only, H3); `apps/web/src/api/outbox.ts` (`enqueueAnswer` derives `finding_keys` from `parseQuestionKey(question.finding_ref).findingId`, H2); `apps/worker/src/routes/memory/counsel.ts` (`counselQuestionHandler` derives the finding, run and issue-class lookups from `parseQuestionKey(body.finding_ref).findingId` and keeps `body.finding_ref` as the question key, H2); `apps/web/src/features/counsel/question-ids.ts` and `export-flow.ts` already listed above (composite keys).

Not touched in V4: `packages/core/**` (all variance, gate and sheet logic landed in V1; contracts in V3), `apps/worker/**` EXCEPT the single `routes/memory/counsel.ts` edit above and its new test, `apps/web/src/{api,storage}/**` EXCEPT the single `api/outbox.ts` edit above (V3 and Dexie unchanged), README, `docs/**`, `design/**`.

## Public Contracts

- No new screen, route or sidebar item; the Questions route hash is unchanged (label rename only).
- Question keys: change findings `<findingId>@<owner>`, error findings plain id, from one helper (`questionKey`); `UNIQUE(workspace, review_run, finding_key)` unchanged. ONE keying rule is used identically by `sheet-model`, `export-flow`, `readQuestionIds` and `wording()`; no module builds or parses a key by hand.
- Owner values sent on the wire are only `counsel | gp | fund_admin` (server CHECK). The local-only analyst owner "You" is never a question owner, never gets a key and never reaches the outbox. Question creation at send time carries `owner` and `owner_source` (V3 wire fields).
- Regression checks arrive through V3's additive lookup accessor (`lookup()` keeps returning an array); V4 consumes only that accessor and the decoded `VarianceMeta` (V1 `varianceMetaOf` is the sole decoder of `suggested_owners`, `assertion_candidate`, `impact` since `detail.facts` is scalar-only; it runs in the engine worker, and the main thread reads `useVariance().result.meta[id]`, which P02 already carries, and the `meta` map returned by `runRegression` (H4); the main thread never imports `varianceMetaOf`).
- Every wire field used here was added optionally in V3; the client never sends `scope: firm_template` without a non-empty trimmed intent (the server refuses it as well).
- Per-owner export reuses the existing DOCX builder (DOCX stays the only format); the sheet meta gains the optional owner.
- Gate stays two states; counts come from the one shared selector.

## Blast Radius

Files directly modified or created: the Touchpoints list (about 5 new source files, 6 unit tests, 7 e2e specs plus 1 fixture, 13 additive edits to existing files, up to 8 derived spec repairs). Collision files with Intake: `features/counsel/*`, `features/gate/GateReasons.tsx`, `features/review/model.ts` (narrow `computeGate` input only; V2-owned), `state/review.ts`, `features/registry.ts`, `import-graph.test.ts` (see registry; Step 0 observed `CounselScreen.tsx` +2 lines only, and `GateReasons.tsx`, `ExportDialog.tsx`, `ai-draft.ts`, `registry.ts` unchanged by Intake). Guarded surfaces: `counsel-*`, `gate-pill`, `memory-*`, `export-flow`, `import-graph`, `layout-vs-mockup`.

## Implementation Checklist

### Section A - PLAN-time verifications (first tasks)

- [x] A1. Confirm where questions are created for the server (observed: at export, in a batch, then `counsel_sheet_exported` audit) and where in-app answers are recorded (`AnswerForm` to `review.ts` to the outbox `answer` op); the owner and `owner_source` fields ride the question creation request (V3 contract), intent/scope/assertion ride the answer op. Also confirm `saveTriage` persists the whole triage object as JSON so the optional `Triage.ownerAnswers` map needs no Dexie change; if it does not, stop and replan (no schema bump is planned).
- [x] A2. Confirm the existing tests that assert the label "Counsel questions" or the sheet markup; list them for the derived repairs (do not edit them before a failing run proves the need).
- [x] A3. Baseline green before edits: `counsel-sheet`, `counsel-answer`, `counsel-export`, `counsel-gate`, `gate-pill` (e2e) and `export-flow`, `counsel-export-contents`, `import-graph` (web unit); record counts.
- [x] A4. Confirm the engine worker can hold the parsed `Structure` of the open document so `runRegression` needs only `(documentRef, checks)`.

### Section B - Owner chip, override, keys (AC-V11, AC-V12)

- [x] B1. `OwnerChip.tsx`: shows each suggested owner with the one-line routing reason; a select to override while no question exists for the finding; override saved in `owner-store.ts` (`uiState`) and recorded as `owner_source: 'override'` at ask time (`suggested` otherwise); read-only once asked. Override options (exactly): "Counsel", "GP", "Fund admin", "GP + Counsel" (creates two keys, one question per owner), and "You (no confirmation needed)" which is local-only: it is never sent, creates no key, and the Ask action is disabled with the tooltip "Change the owner first". Unit assertion (`variance-owner-sheet-model`): choosing "You" never produces an outbox op or a question key.
- [x] B2. `question-ids.ts` and `counsel-store.ts` use the core `questionKey(findingId, owner)`; a finding with two owners becomes two question records, each answerable alone; error findings keep the plain id. One helper only; a unit test enumerates error and change keys.
- [x] B4. Per-owner answer state: `recordAnswer` and `persistAnswer` in `state/review.ts` take an `owner` argument and write `Triage.ownerAnswers[owner]`; question creation at send time sends `owner` and `owner_source`; `features/review/model.ts` adds the optional `ownerAnswers` field to the `Triage` interface and passes it into `computeGate`'s state, and `features/counsel/sheet-model.ts` `gateInputs` also receives `ownerAnswers` (a finding resolves only when every asked owner answered; "unclear" keeps it blocking). For change findings `Triage.counselAnswer` is NOT written (ownerAnswers is authoritative, so the first owner's A/B/C cannot resolve the finding through the single-answer path); error findings keep `counselAnswer` exactly as today. Default, reversible: Step 0 re-reads V1's landed `gateReasonFor` precedence between `counselAnswer` and `ownerAnswers` and adjusts only if it differs; `variance-owner-sheet-model` asserts one-of-two answered gives `awaiting_counsel`. Asked-marker rule (V1 G1): `ownerAnswers[owner] = null` is written when a question is created for that owner (ask/export path), overwritten with the option on answer; key absent = not asked; the local-only "You" never gets a key.
- [x] B3. Gates: `variance-question-ids`, `variance-owner-sheet-model` (unit; asserts the four states: asked-unanswered (key present, null), one-of-two answered (`awaiting_counsel`), "unclear" (stays blocking), and "You" (key never present)), `variance-owner-override`, `variance-two-owner-two-questions` (e2e).

### Section C - Questions screen, tabs, per-owner export (AC-V13)

- [x] C1. `CounselScreen.tsx`: tabs `All · Counsel n · GP n · Fund admin n` (unanswered counts), owner sections, "Export for <owner> (DOCX)" per owner; `sheet-model.ts` filters per owner via core `buildCounselSheet` option; `export-flow.ts` and `exportDocx.ts` pass `meta.owner` and put the owner in title and filename; the existing D-1 rule (export only unanswered) is unchanged. "Export for <owner> (DOCX)" opens the existing `ExportDialog.tsx` with that owner's sheet (owner in dialog title and filename); `toggleAi` and `ai-draft.ts` exclude change questions (deterministic template wording only, 0 live AI calls for them); `variance-owner-sheet-model` asserts the question list handed to `fetchAiDrafts` contains no change-kind question.
- [x] C2. `registry.ts` has two `counsel` rows (placeholder first, real row appended last; last wins): rename the LAST (effective) row label to "Questions" (optionally sync the placeholder); `CounselScreen` h1 becomes "Questions". Derived repairs (`smoke.test.tsx`, `app-shell`, `placeholder-routes`, `a11y-smoke`, `layout-vs-mockup`) are made only after a failing run proves they break. Intake's GP missing-documents item stays in the GP group and the GP export (Step 0 (a)).
- [x] C3. `QuestionRow.tsx`: change questions use the V1 deterministic template wording (old text, new text, A/B/C); intent field is not part of the question.
- [x] C4. Gates: `variance-questions-by-owner-export` (e2e: parse each DOCX with mammoth; no other owner's items), `variance-counsel-export-contents` (unit, node env), `variance-owner-sheet-model` (no change-kind question reaches `fetchAiDrafts`), regressions `counsel-sheet`, `counsel-export`, `export-flow`, `counsel-export-contents`.

### Section D - Record-answer dialog: intent, scope, preview (AC-V14, AC-V15)

- [x] D1. `AnswerForm.tsx`: option (default marked), note, "Why is it written this way? (intent)" textarea, scope radios "This fund only / Firm template"; scope firm_template requires a non-empty TRIMMED intent (client refusal message; server also refuses); one muted preview line: when `facts.assertion_candidate` exists show `describeAssertion(...)` (for R-01: Appendix C must exist), otherwise "no automatic check for this item". The answer shows who and when.
- [x] D2. Intent is human-only: the textarea has no default value, no auto-fill, no "use AI draft" action; the existing counsel AI draft (question wording) never touches it. Static unit test `variance-intent-human-only-static` greps the counsel feature for any assignment to the intent field outside user input.
- [x] D3. `state/review.ts` answer action carries `intent`, `scope`, `assertion` into the outbox op (op kinds unchanged); triage keeps one status per finding; `ownerAnswers` for the core gate is fed from the per-owner answers (finding resolves only when every asked owner answered A/B/C; any "unclear" keeps it blocking); the answer overwrites the owner's `null` asked marker set at question creation (B4).
- [x] D4. Gates: `variance-answer-record-intent-scope`, `variance-intent-human-only` (e2e), `variance-assertion-preview` (unit), regressions `counsel-answer`, `memory-prior-answer`, `memory-edit-is-new`.

### Section E - Regression wiring (AC-V16)

- [x] E1. `regression-client.ts`: after the memory lookup returns `regression_checks` (background, never blocking first paint), call the engine `runRegression`; a violation appends a critical finding labelled "Regression: confirmed in <fund>" with the check statement as quote; the gate recomputes; a held check adds nothing; a check for another firm never arrives (server-scoped) and is also ignored client-side if its firm differs. The regression finding keeps the stable id the core assigns (`f_<hash>` from detector, class, anchor and the check statement as quote: the same check on the same document always gives the same id; no `REG-` rewrite, H4), is resolvable through normal triage (same status controls), and joins memory through its fingerprint (`fingerprintFor` over its issue class and statement quote, H1) so a prior answer is recognised; if memory join is unavailable it is explicitly local-only (labelled so, never sent to the server as a new finding). It never blocks first render. `runRegression` on `doc_not_retained` (engine LRU of 2 by docHash evicted the parse): re-run the check from the remembered analyze input held by the client; if none exists, skip silently (no finding, no error). Unit test `variance-regression-doc-not-retained` covers both branches; the check is added to the unit gate list.
- [x] E2. `engine.worker.ts`/`client.ts`/`types.ts` additive `runRegression`; `fake worker` fixture returns `regression_checks` for the e2e real-client path; the Dexie stub returns the checks stored by earlier answers in the same browser.
- [x] E3. Gate: `variance-regression-r01` (e2e). Flow: open Fund II with baseline Fund I (firm hartwell-crane) so a `VAR-LOGIC-REMOVED` row for Appendix C exists; record the answer "Appendix C must exist" scope firm template with an intent; open Fund III (no Appendix C): blocking regression finding with the check quote; open `fund-III-with-appendix-c`: no regression finding; open a different firm's document: no check runs.

### Section F - Gate popover and counts (AC-V17, counts agree)

- [x] F1. `GateReasons.tsx`: group reasons "You n · Counsel n · GP n · Fund admin n · Earlier funds n" (list only); `select.ts` owner counts feed the popover, the Questions tabs and the sidebar badge; totals equal Blocked N. Membership rules: "You" = items whose owner is the local-only You (blocking but never asked); "Counsel / GP / Fund admin" = asked or suggested variance questions by owner (unanswered or "unclear"); "Earlier funds" = regression findings and prior-fund items; each blocking finding appears in every group whose owner still owes an answer: a finding with ONE owner appears in exactly one group, a finding with two owners (GP + Counsel) gives TWO core gate reasons (landed V1 `computeVarianceGate` emits one reason per asked owner still open, with `GateReason.owner` set; see H6) and is listed once under each owner whose question is unanswered, so group sizes are counted per (finding, owner) pair, equal the Questions tab counts for that owner, and sum to Blocked N. Blocking reasons of error findings go to their chip owner (Decision 2); when `GateReason.owner` is undefined they go to a "Document errors" fallback inside the "You" group (unless the finding is asked). `variance-counts-owner-selector` asserts that the set of distinct finding keys across all groups equals the set of core gate reason keys, with no package and with a package present, that no (finding, owner) pair is listed twice, and that the sum of group sizes equals the core reasons count (H6; the earlier `+ number of two-owner findings` arithmetic is void). Equality statement: the sum of the owner-group sizes equals `gate.reasons.length` (= Blocked N when there are no Intake package block reasons; Blocked N counts (finding, owner) pairs, as the mockup notes do: You 5 + Counsel 3 + GP 2 + Fund admin 1 + Earlier funds 1 = Blocked 12) and the distinct finding keys of the groups equal the distinct finding keys of the core reasons; Intake package reasons stay in Intake's own popover section and are never counted here. `variance-counts-owner-selector` covers both cases (no package, and package present with the Intake section excluded).
- [x] F2. Gates: `variance-counts-owner-selector` (unit), `variance-gate-two-states` (e2e), regressions `counsel-gate`, `gate-pill`.

### Section G - Wrap-up

- [x] G1. Append the `import-graph` ALLOWED line only for symbols actually imported on the main thread; run `import-graph`. G2. Derived repairs only where a run proves breakage (nav label, markup). G3. Full regression block (Exit Gate). G4. Phase report with regression lines and the Intake reconciliation note (GP group). G5. Reference the existing backlog stub for the residual manual keyboard pass: `process/features/variance-management/backlog/variance-manual-keyboard-pass_NOTE_17-10-26.md` (owned by another agent; do NOT create it here; EXECUTE only verifies it exists). The assertion candidate is read from the worker-decoded `meta[id].assertion_candidate` (no main-thread `varianceMetaOf` import, no 4th `import-graph` symbol). Landed state: `describeAssertion`, `normalizeAssertionLabel`, `scopeMismatch`, `fingerprintFor`, `mask` and `sensitiveSpans` are ALREADY in the ALLOWED set (P03 and earlier), so the appended line adds only `questionKey` and `parseQuestionKey`; `runRegressionChecks` is imported by `engine.worker.ts` only (exempt).

### Section H - Wiring gaps found by the 18-10-26 inner PVL (against landed P01-P03 code; fixed here in plan text)

Each item is a mismatch between this plan's earlier assumptions and the code that landed; EXECUTE implements them with the gates named. Locked answers to the carry-overs are marked M2, intent `''`, `finding_too_large`.

- [x] H1. **Change rows and the regression finding have no fingerprint on the main thread.** `fingerprintFindings` runs over `result.findings` only (P02 keeps change rows in the variance slice), so `memory.byId[changeId]` is undefined and `state/review.ts` `findingById`, `wiresFor`, `persistAnswer` and `decide` return null for them: no answer, question or firm-template check would ever reach memory. Add one helper in `state/review.ts`, `rowFinding(id)` = the finding from `result.findings`, else from `varianceSlice().findings`, else from the local regression findings, and `rowFingerprint(id)` = `memory?.byId[id]?.fingerprint ?? fingerprintFor(finding, doc.firmId)` (`fingerprintFor` is already allow-listed). `wiresFor`, `persistAnswer` and `export-flow.recordInMemory` (its `input.findings`/`input.memory`) use them. `decide` is deliberately NOT changed: "Mark as expected" on a change row stays local-only exactly as V2 ships it (no label lookup for change rows exists to read such a decision back, and it would spend write budget for nothing); a unit case pins that dismissing a change row enqueues no outbox op. Labels of change rows stay `new` (no cross-document label lookup for change rows in V4; recorded decision, reversible); the Worker still stores their answers and checks.
- [x] H2. **The composite key must survive the whole pipeline.** (a) `persistAnswer` sets `question.finding_ref = questionKey(f.id, owner)` and `owner`/`owner_source`; `readQuestionIds(doc.id)` is read and written by the composite key. (b) `api/outbox.ts` `enqueueAnswer` derives `finding_keys` from `[parseQuestionKey(question.finding_ref).findingId]` (today `finding_keys: [question.finding_ref]` would look the wire finding up by the composite and store nothing). (c) `export-flow.recordInMemory` looks the finding and fingerprint up by `parseQuestionKey(q.findingKey).findingId` and sends `finding_ref: q.findingKey` plus `owner` and `owner_source`. (d) Worker `counselQuestionHandler` resolves the finding row, the run and the issue class from `finding_ref` as a plain id (`latestWithFinding`, `latestByDecisionOrigin`): a composite ref misses, the run falls back to the workspace's latest run (wrong fund name possible) and a fresh finding fails with `issue_class_unknown` (400). Narrow Worker edit: use `parseQuestionKey(body.finding_ref).findingId` for those two lookups and keep `body.finding_ref` as the question key, the question id input and the `byRunKey` lookup; plain refs behave exactly as before. New Worker test `variance-question-key-composite`: (1) composite ref with a persisted finding creates the question on that finding's run with the right issue class and `owner`; (2) two owners of one finding give two questions with different ids; (3) a plain ref is unchanged; (4) a ref with `@` and an unknown suffix is treated as plain. Registry note (orchestrator-owned): P04 now also touches the P03-owned `apps/worker/src/routes/memory/counsel.ts` and `apps/web/src/api/outbox.ts` (VERIFIED, no live collision).
- [x] H3. **M2 (required): fund scope in the client label.** `state/review.ts` `refreshMemory` (and any later lookup-backed call) passes `fundScopeName(doc.fund)` as the 4th argument of `fingerprintFindings`. The Worker stores `run.fund_name = mask(fund.slice(0,200))` and `'(no fund)'` when the document has no fund (`outboxDocFor` omits the field; Worker `NO_FUND`), and compares `ctx.fundName !== decision.fund_name`; `fundScopeName(fund)` in `memory/fingerprintFindings.ts` mirrors exactly that (`fund ? mask(fund.slice(0,200), sensitiveSpans(...)) : '(no fund)'`, allow-listed names). The render-first local call (`api` null) needs no scope. `variance-memory-wiring` asserts client label equals the Worker rule (same cases as Worker `variance-label-call-sites`: fund-scoped decision in another fund = `new` and not linked; same fund = `already_answered`; `firm_template` applies everywhere; empty-fund document) and pins the literal `'(no fund)'`.
- [x] H4. **Regression arrival path.** `regression-client.ts` calls `api.lookupWithChecks(firmId, fps)` with the fingerprints of error findings and change rows; the contract and both clients make no request for zero fingerprints, so when none exist it uses the all-zero sentinel `'0'.repeat(64)` (valid HEX64, matches no decision) so a document with no findings still gets the firm's checks (unit-tested). `runRegression(documentRef, checks)` in `engine.worker.ts` returns `{ok, findings, meta}` built exactly like `runVarianceImpl`: `toView(f, blocks, idx, g, numberingNote)`, `title` from `meta`, and `kind: 'change'` (so `computeGate` gives it `gates: true`, severity critical, `policy.regression_blocks`), with `meta` decoded in the worker by `varianceMetaOf`; the retained graph supplies `g.structure`; a missing retained graph returns `doc_not_retained` (E1 fallback). A4 is thus answered from landed code (`Retained.g` holds the structure; LRU of 2).
- [x] H5. **Asked markers are written at the Ask click.** `needsCounsel` on a change row writes `ownerAnswers[o] = null` for each chosen owner immediately and removes them when toggled off (a re-click); question creation at send or export carries `owner` and `owner_source` but does not set the marker. The marker (not a server round trip) is what makes the Questions tab, the popover group and the gate reason agree at once, and makes the owner chip read-only. "You" never gets a marker. The existing `isQuestion` / `needsAnswer` / `questionState` helpers in `sheet-model.ts` read the per-owner answers for change findings (error findings unchanged).
- [x] H6. **Gate reasons are per (finding, owner) pair (supersedes the N5 arithmetic).** Landed `computeVarianceGate` emits one reason per asked owner still open, so Blocked N (`gate.reasons.length`, the pill badge and the header) counts pairs and the owner groups sum to it directly. `owner-groups.ts` places a reason in `reason.owner`'s group; an ownerless reason goes to the chip owner of an error finding (V1 routing row, default Counsel when asked) or else to "You" (inside it the "Document errors" fallback); "Earlier funds" holds regression findings and prior-fund items. `GateReasons.tsx` must key its list items by `${findingKey}@${owner ?? ''}` (today `key={r.findingKey}` would duplicate for a two-owner finding) and add `data-owner`; `data-finding-id` stays the plain finding key. Tab counts are that owner's unanswered asked questions; they equal the popover group only while every asked question gates (variance policy on); with the legacy gate (no baseline) a non-critical asked error question is in the tab but not in the popover. `variance-counts-owner-selector` covers both modes, no package and package present. The `unreadable` spread now lives in `features/variance/select.ts` `reviewGate` (P02 moved it from `use-review-view.ts:38`); every gate call keeps it.
- [x] H7. **Per-owner answer ids and revoke.** `Triage.ownerAnswerIds?: Partial<Record<Owner, string | null>>` holds each owner's `pending:` or real decision id; `recordAnswer` for a change finding writes it (not `answerId`), changing or undoing one owner's answer revokes only that owner's decision, and `refreshMemory(revokedDecisionId)` sets the matching owner's `ownerAnswers[o]` back to `null` (still asked, so the gate stays blocked) instead of leaving a resolved gate. Known limitation (same family as M1, do not fix here): the Worker keeps one active decision per (workspace, firm, fingerprint), so a second owner's answer supersedes the first owner's decision in memory; local per-owner state keeps both answers.
- [x] H8. **Intent `''` and the masked-blank case.** `AnswerForm` sends `intent` only when the trimmed text is non-empty (truncated to 500; `undefined`, never `''`, otherwise). For `firm_template` the client also refuses an intent whose masked form is blank (Worker `intentIsBlank`: mask tokens `#\d{0,4}` removed), using the allow-listed `mask` and `sensitiveSpans`, so an all-sensitive intent is not silently rejected by the Worker after the local answer shows recorded.
- [x] H9. **`finding_too_large` is non-fatal (verified in code).** `splitByBytes` throws `invalid_request` reason `finding_too_large`; `outbox.fail` turns any `invalid_request` into a terminal `rejected` op (the drain continues) and `export-flow` swallows the failure into "Saved locally; not recorded in memory"; `recordAnswer` writes triage before `persistAnswer`, so the local answer and the gate stay correct. `variance-memory-wiring` pins this (a throwing `storeFindings` leaves the answer, the gate and the other ops intact; nothing is thrown to the UI).
- [x] H10. Gates: `variance-memory-wiring` (unit, covers H1, H3, H4 sentinel, H8, H9, and the composite `finding_keys` of H2(b)), Worker `variance-question-key-composite` (H2(d)), the existing `outbox`, `export-flow` and `variance-counts-owner-selector` for H2(b), H2(c) and H6.

### Edge cases carried from vc-scenario / vc-security

1. Composite key leakage: a finding id that already contains `@`; an error finding that must never be given an owner suffix; two owners where one answers "unclear" and the other A (stays blocking); one owner answered, other missing (`awaiting_counsel`); override after asked (read-only); override then re-open document (persisted via `uiState`).
2. Forged inputs from the UI: whitespace-only intent; scope firm_template with an intent of 500+ characters (client truncates at 500, server refuses above); assertion label with markup or 80+ chars (client trims to the normalized label from `describeAssertion`, never free text); answer replayed from the outbox (idempotent, no second check).
3. Owner "You": selected then Ask pressed (disabled, tooltip), never in outbox or export; regression finding after LRU eviction (re-run or silent skip).
4. Export correctness: per-owner export lists only that owner's unanswered questions; a finding with two owners appears once in each owner's export; an owner with zero open questions disables its export button with a visible reason; per-owner tab counts equal that owner's popover group size, and distinct findings across groups equal the core gate reasons (a two-owner finding is counted once per open owner in Blocked N, in the tabs and in the groups: all three equal, H6).

## Test Gates (exact commands; no `--` token; one token per call)

```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction
for t in variance-counts-owner-selector variance-question-ids variance-owner-sheet-model variance-counsel-export-contents variance-intent-human-only-static variance-assertion-preview variance-regression-doc-not-retained variance-memory-wiring import-graph; do pnpm --filter @aduin/web test "$t" || exit 1; done
for t in variance-question-key-composite variance-owner-persisted variance-label-call-sites variance-answer-append-only memory-label-parity; do pnpm --filter @aduin/worker test "$t" || exit 1; done
for t in variance-owner-override variance-two-owner-two-questions variance-questions-by-owner-export variance-answer-record-intent-scope variance-intent-human-only variance-regression-r01 variance-gate-two-states; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
```

Regression block (preview e2e serially, one agent at a time, port 4317 shared; stack-memory afterwards, never together):

```bash
for t in counsel-sheet counsel-answer counsel-export counsel-gate gate-pill memory-no-reflag memory-prior-answer memory-edit-is-new memory-blocking-never-hidden memory-no-cross-firm a11y-keyboard layout-vs-mockup app-shell placeholder-routes no-llm-corpus intake-missing-docs-request-export intake-gp-group-absent-without-package intake-gate-warning-policy intake-demo-packages; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
for t in export-flow counsel-export-contents counsel-draft gate-reexport api-contract outbox review-sync package-gate-ui gate-pill gp-request-group; do pnpm --filter @aduin/web test "$t" || exit 1; done
for t in gate-state-matrix sheet-contents variance-gate-state-matrix variance-question-key-matrix; do pnpm --filter @aduin/core test "$t" || exit 1; done
pnpm --filter @aduin/web test
pnpm --filter @aduin/web typecheck
pnpm --filter @aduin/worker typecheck
pnpm lint
pnpm typecheck
```

Intake regression notes: `intake-demo-packages` is load-sensitive (30 s wait; run it alone); `gate-pill` exists as both a unit token and an e2e token; `package-gate-ui` and `gp-request-group` are web unit tests. Never use the e2e token `gate` alone. Each one-token e2e call rebuilds the preview (3 to 6 s).

## Test Coverage Plan (routing chain loaded: all-tests.md)

| Area | Tier | Scenario | Command | Proves | Does NOT prove |
|---|---|---|---|---|---|
| apps/web owners | Fully-automated | override saved; suggested vs override recorded | `test:e2e variance-owner-override` | AC-V11 | persistence on the live D1 (V3 worker tests plus V5 smoke) |
| apps/web questions | Fully-automated | two owners give two answerable questions | `test:e2e variance-two-owner-two-questions` | AC-V12 | wording quality |
| apps/web export | Fully-automated | per-owner DOCX contains only that owner's items | `test:e2e variance-questions-by-owner-export` plus unit `variance-counsel-export-contents` | AC-V13 | opening the file in Word (rendering) |
| apps/web answer | Fully-automated | intent and scope recorded; firm_template needs intent | `test:e2e variance-answer-record-intent-scope`, `variance-intent-human-only` | AC-V14, AC-V15 | AI-drafted intent (not built) |
| apps/web regression | Fully-automated | violated, held, other firm | `test:e2e variance-regression-r01` | AC-V16 client path (stub and fake worker) | live Worker (V5 stack smoke) |
| apps/web gate | Fully-automated | two states; counts equal | `test:e2e variance-gate-two-states` | AC-V17 | live deployment |
| apps/web owner sheet | Fully-automated | asked-unanswered, one-of-two answered, unclear, You; no change-kind question passed to `fetchAiDrafts` | `test variance-owner-sheet-model` | owner answer states (V1 G1), 0 live AI calls for change questions | real OpenRouter traffic |
| apps/web memory wiring | Fully-automated | change rows get a fingerprint and wire; composite key reaches outbox and export; client label equals Worker rule (M2); intent `''` becomes undefined; `finding_too_large` non-fatal | `test variance-memory-wiring` | H1, H2(b), H3, H8, H9 | live D1 and the real Worker path (V5 stack smoke) |
| apps/worker questions | Fully-automated | composite `finding_ref` resolves the finding, run and issue class; two owners give two questions | `@aduin/worker test variance-question-key-composite` | H2(d) | deployed Worker (V5) |
| apps/web counts | Fully-automated | sum of owner groups (incl. Document errors under You) equals core gate reasons, no package and package present | `test variance-counts-owner-selector` | counts agree | deployed gate |
| apps/web UX | Agent probe | read the Questions tabs, owner chips and answer dialog at 1440 and 1024 against `app-variance.html`; keyboard walk (tabs, override select, dialog) | agent drives preview (`DESIGN_PROBE=1 pnpm exec playwright test --project=preview design-probe` from `apps/web`) and records judgment | visual fit, non-colour cues | pixel parity; manual keyboard pass remains a Known-Gap residual (backlog stub `variance-manual-keyboard-pass_NOTE_17-10-26.md` in `process/features/variance-management/backlog/`) |

Failing stubs: each Fully-automated row starts as `test("should <scenario>", ...)` throwing `NOT IMPLEMENTED - TDD stub for: <scenario>`.

## Exit Gate

- All Test Gates and the regression block exit 0; counts recorded (web unit and preview e2e totals before and after).
- Count agreement shown in one report table (Findings segment, Questions tabs, sidebar badge, popover groups equal).
- Report written with regression lines.

## Blockers That Would Justify BLOCKED Status

- Intake's Questions screen or gate popover structure cannot host owner tabs and Intake's GP group item together without a redesign decision.
- V3 answer or lookup contract changed shape after the V3 report (re-sync in Step 0 should catch it).
- `import-graph` would need more than the three symbols listed (stop and replan).

## Phase 03 Carry-overs (UPDATE PROCESS, 2026-10-18 00:05 local; plan body only, the Validate Contract was not touched)

Step-0 carry-over items from the Phase 03 closeout (review PASS WITH NOTES). Handle at RESEARCH/Step 0; the inner PVL must pick them up.

- **M2 (required):** `apps/web/src/state/review.ts` must pass the active fund name to `fingerprintFindings(..., fundName)` (the optional parameter exists and is tested; P03 left the caller alone). Until wired, the client label ignores fund scope while the Worker applies it. Add a client/Worker label parity test for a `scope = fund` decision recorded in another fund (the Worker side is `variance-label-call-sites`; the client side needs its own case).
- **Consume `lookupWithChecks`** (new `MemoryApi` method) for regression checks, and `AnswerInput.intent/scope/assertion`, `QuestionItem.owner/owner_source`. Fake Worker: `apps/web/test/support/fakeMemoryFetch.ts` now stores answered decisions and checks.
- **Minor, check `storeFindings`:** `finding_too_large` (a single finding over 131,072 B) must be non-fatal for the caller; memory never blocks the review.
- **Minor:** intent `''` is stored as `''` (edge); decide at Step 0 whether the UI sends `undefined` instead.
- **Known limitation M1 (do not fix here):** one active decision per (workspace, firm, fingerprint); a fund-scoped answer in fund B supersedes fund A's (ping-pong), including a `firm_template` decision. Backlog NOTE `variance-fund-scope-supersede_NOTE_17-10-26.md`. Do not build UI that assumes both funds keep separate active decisions.
- **Ceiling D5c:** no revoke path; 20 active checks per firm per sandbox is a hard ceiling. Backlog NOTE `variance-regression-check-revoke_NOTE_17-10-26.md`.

## Phase Loop Progress

- [x] 0. PRECONDITION - Intake feature closed; Step 0 re-sync done (Questions overlap reconciled from landed code); Inner Loop Refresh Note written (2026-10-17)
- [x] 1. RESEARCH - research-agent: V2 and V3 reports read in full; V1 Forward Preview read; test context loaded
- [x] 2. INNOVATE - innovate-agent: approach decided (n/a if the DECISION still holds)
- [x] 3. PLAN-SUPPLEMENT - plan-agent: existing phase plan updated (or "n/a - research clean")
- [x] 4. PVL - vc-validate-agent: full V1-V7; validate-contract per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [x] 5. EXECUTE - vc-execute-agent (opus): checklist done; per-section gates green (18-10-26, commits 838ca1e a31dff0; report written)
- [x] 6. EVL - independent vc-tester: gates re-run; stubs registered; EVL HANDOFF SUMMARY (18-10-26, 1 fix cycle, HALTED_SUCCESS)
- [x] 7. UPDATE PROCESS - phase report written, umbrella state updated, commit done (18-10-26)

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder - vc-validate-agent writes this section before EXECUTE)", the orchestrator must spawn vc-validate-agent first. A partial contract is a placeholder.

Strategy (vc-agent-strategy-compare, PLAN-end): signals S2 (contract consumption), S6 weak, S7 (5+ files) = 2-3/7 MEDIUM, but sections B, C, D, F all edit `counsel/*`, `review.ts`, `select.ts`, so recommended SEQUENTIAL single opus EXECUTE agent; EVL by an independent sonnet vc-tester serially (port 4317), plus a sonnet code-review pass on the client-side trust boundary (D2, E1).

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `variance-owner-override` | Fully-Automated | AC-V11 |
| `variance-two-owner-two-questions` | Fully-Automated | AC-V12 |
| `variance-questions-by-owner-export`, `variance-counsel-export-contents` | Fully-Automated | AC-V13 |
| `variance-answer-record-intent-scope` | Fully-Automated | AC-V14 |
| `variance-intent-human-only`, `variance-intent-human-only-static` | Fully-Automated | AC-V15 |
| `variance-regression-r01` | Fully-Automated | AC-V16 |
| `variance-gate-two-states`, `variance-counts-owner-selector` | Fully-Automated | AC-V17 |
| `variance-owner-sheet-model` (owner states; no change-kind question to `fetchAiDrafts`) | Fully-Automated | AC-V12, AC-V13 |
| `variance-memory-wiring`, Worker `variance-question-key-composite` | Fully-Automated | AC-V12, AC-V14, AC-V16 (the path from the UI to memory) |
| keyboard and design probes | Agent-Probe | base AC30 on changed screens |
| `counsel-*`, `memory-*`, `gate-pill`, `sheet-contents`, `gate-state-matrix` | Fully-Automated | base AC20-AC22, AC41-AC48 stay green |

## Test Infra Improvement Notes

- `apps/web/e2e/fixtures/variance-owners.ts` and the extended `memory-stub-rules.ts` should expose one `recordFirmTemplateAnswer()` helper reused by V5.
- Parsing DOCX in e2e needs mammoth (already a devDependency); keep parsing in node-env unit tests where possible.
- Serial e2e only (port 4317, shared `test-results`).

## Resume and Execution Handoff

- Selected plan file path: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-04-owners-answers_PLAN_17-10-26.md`
- Umbrella plan: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md`
- Last completed step: Step 0 PLAN-SUPPLEMENT 2026-10-17 (Intake closed; Refresh Note written; not started otherwise; V2 and V3 must be VERIFIED first)
- Validate-contract status: PASS written by the inner PVL for phase 4 (generated-by `inner-pvl: phase-4`, 18-10-26; supersedes the 2026-10-17 outer-pvl contract); V3 is VERIFIED; V2 code is landed (HEAD 15aa796) and its independent EVL run was still in progress at validate time, so the Entry Gate (V2 VERIFIED) still holds EXECUTE; Section H (18-10-26) is part of the contract
- Next step: after Phases 02 and 03 are VERIFIED (Intake is closed), spawn vc-research-agent for RESEARCH (read the V2 and V3 reports in full), then INNOVATE (n/a if the DECISION holds), PLAN-SUPPLEMENT and inner PVL. EXECUTE receives this one exact plan path.
- Validators: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this plan>`; `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <this plan>`.
- Hard rules for every agent prompt: never git stash, checkout, reset or restore; commit on main with conventional prefixes; never run git push in any phase (the user pushes); execution commits separate from process commits.

## Inner Loop Refresh Note: 2026-10-17 — changed sections: header (Depends on), Step 0 (checks a and b observed from landed code; new status paragraph with D-S0-4/6/8/9), Touchpoints (model.ts and GateReasons bullets), Blast Radius, Test Gates (regression: intake-demo-packages, package-gate-ui, gate-pill, gp-request-group), Phase Loop Progress, Resume and Execution Handoff. Invalidates prior validate-contract.

Written by the Step 0 PLAN-SUPPLEMENT at 2026-10-17 22:11 local, after this plan's outer-pvl contract (written 17:49 the same day). Basis `variance-mvp_STEP0-RESYNC_17-10-26.md`. Landed facts: `<GpRequestGroup />` at `CounselScreen.tsx:271` directly above `<ul data-testid="counsel-list">`; `<h1 id="h-counsel">` at :160; `registry.ts` rows :29 and :75 unchanged; `GateButton.tsx` merged object and badge on `merged.reasons.length`; `use-review-view.ts:38` `unreadable` spread. The reconciliation rule from Step 0 (a) is confirmed unchanged. V7 owner stays GP (D-S0-6). Push rule restated (D-S0-8); `.playwright-mcp/` and `.DS_Store` are not Variance's (D-S0-9). PVL-new concern to check: the added regression tokens exist (an unmatched token exits 1) and `intake-demo-packages` stays green with the Questions rename.

## Validate Contract

Status: PASS
Date: 18-10-26
date: 2026-10-18
generated-by: inner-pvl: phase-4
supersedes: 2026-10-17 (outer-pvl) - inner PVL has current evidence (re-validated against landed P01, P02 and P03 code after the 2026-10-17 Inner Loop Refresh Note and the 2026-10-18 Phase 03 Carry-overs; nine wiring gaps found and fixed in plan text as Section H)

Parallel strategy: sequential
Rationale: score 2-3/7 (S2 contract consumption, S7 5+ files; S6 weak) is MEDIUM, but sections B, C, D, F and H all edit `counsel/*`, `state/review.ts`, `select.ts`, so one opus EXECUTE agent runs sequentially; EVL by an independent sonnet vc-tester, preview e2e serially (port 4317), stack-memory afterwards, never together. Dominant signal: shared files across sections. This inner-PVL pass was a single read-only validate-agent (a subagent cannot spawn others): the Layer 1 and Layer 2 checks were done as direct verification against the landed code (no builds, tests or Playwright run; a tester held port 4317).

Inner-PVL result (cycle 1 of the inner pass): `validate-plan-artifact.mjs` 0 failures, 0 warnings (before and after the edits). All paths and symbols named in the plan resolve at HEAD 15aa796. Nine mismatches between the plan and the landed code were found; each was FIXED IN THE PLAN TEXT (Section H, plus targeted edits to Touchpoints, Public Contracts, E1, F1, Edge case 4, G5, Test Gates, Coverage Plan, Verification Evidence, handoff) and none is left open. Checked and clean: M2 target lines, `finding_too_large` handling, intent `''`, import-graph budget, change-row triage keying, Intake overlap structure, all regression tokens (every named e2e and unit token resolves to a file; no token collides with an existing one).

Findings fixed in plan text (all CONCERN or FAIL-if-left, now closed):
- H1 (FAIL if left): change rows and the regression finding are never in `memory.byId` (P02 keeps them in the variance slice, `fingerprintFindings` runs over `result.findings` only), so `findingById`, `wiresFor` and `persistAnswer` returned null for them and no answer, question or firm-template check could reach memory. Fixed: `rowFinding`/`rowFingerprint` helpers (`fingerprintFor`, already allow-listed); `decide` deliberately unchanged (change-row dismissals stay local-only as V2 ships).
- H2 (FAIL if left): composite `<id>@<owner>` as `finding_ref` broke three places: outbox `finding_keys` (wire lookup by plain id, nothing stored), `export-flow` (`byId.get(q.findingKey)`), and the Worker question route (finding, run and issue class resolved from `finding_ref` as a plain id: wrong run or `issue_class_unknown` 400). Fixed: narrow edits to `api/outbox.ts` and `apps/worker/src/routes/memory/counsel.ts` (both P03 files, VERIFIED, no live collision) plus Worker gate `variance-question-key-composite`. Orchestrator note: sync the registry (P04 now touches these two files).
- H3 (M2, required): `refreshMemory` calls `fingerprintFindings` without the fund scope (state/review.ts:396); Worker persists `mask(fund.slice(0,200))` or `(no fund)`. Fixed: `fundScopeName(fund)` helper mirroring the Worker, wired in `refreshMemory`, parity gate in `variance-memory-wiring`.
- H4: `lookupWithChecks` needs at least one fingerprint (contract `min(1)`, no request for zero), so a document with no findings never fetched checks; `runRegression` must return `toView` + `kind: 'change'` + worker-decoded meta; the `REG-<check id>` id wording did not match core (`compose` assigns `f_<hash>`). Fixed: all-zero sentinel fingerprint, `runRegression` returns `{ok, findings, meta}` like `runVarianceImpl`, E1 rewritten to the core id.
- H5: the asked marker is written at the Ask click (`needsCounsel`), not at export, so tab, popover and gate agree immediately.
- H6 (FAIL if left as written): the plan said a two-owner finding is ONE core gate reason and that Blocked N counts findings; landed `computeVarianceGate` emits one reason per asked owner still open (`GateReason.owner`), so Blocked N counts (finding, owner) pairs (the mockup notes sum the same way) and the pair arithmetic in F1 could never hold. Fixed in F1, Edge case 4 and H6; `GateReasons.tsx` list keys must include the owner (`key={r.findingKey}` duplicates).
- H7: per-owner answer ids and revoke (`refreshMemory(revokedDecisionId)` left a resolved gate after a memory Reopen); one active decision per fingerprint on the Worker means a later owner's answer supersedes the earlier one in memory (named limitation, family of M1).
- H8: intent `''` becomes `undefined`; firm-template intent whose masked form is blank is refused client-side (Worker `intentIsBlank`).
- H9 (verified clean, now pinned): `finding_too_large` is non-fatal (`invalid_request` becomes a terminal `rejected` outbox op, export swallows it, triage is written before the send).
- Stale references corrected: the `unreadable` spread moved from `use-review-view.ts:38` to `features/variance/select.ts reviewGate` (P02); `varianceMetaOf` is never imported on the main thread (worker-decoded `meta`); `describeAssertion` was already allow-listed by P03, so the import-graph line adds only `questionKey` and `parseQuestionKey`.

Test gates (C3 5-column table; every proving strategy is Fully-Automated except the one Agent-Probe row; Known-Gap is never a strategy):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC-V11 | suggested owner shown; analyst override saved and recorded as `owner_source` | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-owner-override` | B (gate added by this plan) |
| AC-V12 | one finding with two owners gives two questions, each answerable alone; one `questionKey` helper; asked marker states; one-of-two answered keeps the finding blocking; composite key reaches outbox, export and the Worker question route | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-two-owner-two-questions`; unit `variance-question-ids`, `variance-owner-sheet-model`, `variance-memory-wiring`; `pnpm --filter @aduin/worker test variance-question-key-composite` | B |
| AC-V13 | Questions grouped per owner with unanswered counts; per-owner DOCX contains only that owner's items | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-questions-by-owner-export`; unit `variance-counsel-export-contents` | B |
| AC-V14 | dialog saves option, note, intent, scope; firm_template refused without trimmed (and unmasked-nonblank) intent; intent `''` is never sent; change-row answers reach memory | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-answer-record-intent-scope`; unit `variance-memory-wiring` | B |
| AC-V15 | intent is human-entered only; whitespace-only refused; no AI path | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-intent-human-only`; unit `variance-intent-human-only-static` | B |
| AC-V16 | R-01 end to end: violated, held, other firm; doc_not_retained fallback; zero-finding document still fetches checks | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-regression-r01`; unit `variance-assertion-preview`, `variance-regression-doc-not-retained`, `variance-memory-wiring` | B (client path only; live Worker is V5 stack smoke) |
| AC-V17 | gate: two states, "unclear" stays blocking, cosmetic never blocks | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-gate-two-states` | B |
| counts agree | Findings segment, Questions tabs, sidebar badge, popover groups from one selector; sum of owner-group sizes equals `gate.reasons.length` (pairs), distinct finding keys equal the core reasons' (no package, and package present with Intake section excluded); Document errors fallback; legacy-gate tab versus popover | Fully-Automated | `pnpm --filter @aduin/web test variance-counts-owner-selector` plus `variance-questions-by-owner-export` | B |
| M2 label parity | client label equals the Worker rule for a fund-scoped decision recorded in another fund, same fund, firm_template and an empty-fund document | Fully-Automated | `pnpm --filter @aduin/web test variance-memory-wiring` with Worker `variance-label-call-sites` | B |
| change questions make 0 live AI calls | `toggleAi` / `ai-draft.ts` skip change questions | Fully-Automated | `pnpm --filter @aduin/web test variance-owner-sheet-model` | B |
| base surfaces stay green | counsel, memory, gate, export, a11y, layout, Intake overlap surfaces, Worker memory | Fully-Automated | regression block in `## Test Gates` (preview e2e, web unit, core unit, Worker tokens, typecheck, lint) | A (baseline run is checklist A3) |
| UX fit on changed screens (tabs, owner chips, dialog; 1440 and 1024) | visual fit and non-colour cues vs `app-variance.html` | Agent-Probe | `DESIGN_PROBE=1 pnpm exec playwright test --project=preview design-probe` from `apps/web`, agent records judgment | D (manual keyboard pass is a named residual; stub exists at `process/features/variance-management/backlog/variance-manual-keyboard-pass_NOTE_17-10-26.md`) |

Exact gate commands for EXECUTE (copy of `## Test Gates`; no `--` token; one token per call; preview e2e serially, port 4317 shared, stack-memory afterwards, never together):

```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction
for t in variance-counts-owner-selector variance-question-ids variance-owner-sheet-model variance-counsel-export-contents variance-intent-human-only-static variance-assertion-preview variance-regression-doc-not-retained variance-memory-wiring import-graph; do pnpm --filter @aduin/web test "$t" || exit 1; done
for t in variance-question-key-composite variance-owner-persisted variance-label-call-sites variance-answer-append-only memory-label-parity; do pnpm --filter @aduin/worker test "$t" || exit 1; done
for t in variance-owner-override variance-two-owner-two-questions variance-questions-by-owner-export variance-answer-record-intent-scope variance-intent-human-only variance-regression-r01 variance-gate-two-states; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
# regression block
for t in counsel-sheet counsel-answer counsel-export counsel-gate gate-pill memory-no-reflag memory-prior-answer memory-edit-is-new memory-blocking-never-hidden memory-no-cross-firm a11y-keyboard layout-vs-mockup app-shell placeholder-routes no-llm-corpus intake-missing-docs-request-export intake-gp-group-absent-without-package intake-gate-warning-policy intake-demo-packages; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
for t in export-flow counsel-export-contents counsel-draft gate-reexport api-contract outbox review-sync package-gate-ui gate-pill gp-request-group; do pnpm --filter @aduin/web test "$t" || exit 1; done
for t in gate-state-matrix sheet-contents variance-gate-state-matrix variance-question-key-matrix; do pnpm --filter @aduin/core test "$t" || exit 1; done
pnpm --filter @aduin/web test
pnpm --filter @aduin/web typecheck
pnpm --filter @aduin/worker typecheck
pnpm lint
pnpm typecheck
```

Legacy line form (retained for existing consumers):
- apps/web owners: [Fully-automated: `pnpm --filter @aduin/web test:e2e variance-owner-override`]
- apps/web questions: [Fully-automated: `pnpm --filter @aduin/web test:e2e variance-two-owner-two-questions`] + [Fully-automated: `pnpm --filter @aduin/worker test variance-question-key-composite`]
- apps/web export: [Fully-automated: `pnpm --filter @aduin/web test:e2e variance-questions-by-owner-export` + unit `variance-counsel-export-contents`]
- apps/web answer: [Fully-automated: `test:e2e variance-answer-record-intent-scope`, `variance-intent-human-only`]
- apps/web memory wiring: [Fully-automated: `pnpm --filter @aduin/web test variance-memory-wiring`]
- apps/web regression: [Fully-automated: `test:e2e variance-regression-r01` + unit `variance-regression-doc-not-retained`]
- apps/web gate: [Fully-automated: `test:e2e variance-gate-two-states`]
- apps/web UX: [agent-probe: design-probe at 1440 and 1024] | [known-gap residual: manual keyboard pass, backlog stub `process/features/variance-management/backlog/variance-manual-keyboard-pass_NOTE_17-10-26.md`]

Failing stubs (Fully-Automated rows only; red-first starting point for EXECUTE; not on-disk files):

```
test("should save an owner override and record owner_source override at ask time", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: owner override") })
test("should give one question per (finding, owner) for a two-owner change, each answerable alone", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: two owners two questions") })
test("should export one DOCX per owner containing only that owner's unanswered questions", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: per-owner export") })
test("should record option, note, intent and scope and refuse firm_template without a trimmed intent", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: answer intent scope") })
test("should never auto-fill intent and refuse whitespace-only intent", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: intent human only") })
test("should show a blocking regression finding when Appendix C is missing, none when present, none for another firm", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: regression R-01") })
test("should re-run a regression check from the remembered input after LRU eviction, and skip silently when none exists", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: regression doc not retained") })
test("should keep the gate two-state with unclear blocking and cosmetic never blocking", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: gate two states") })
test("should derive Findings segment, Questions tabs, sidebar badge and popover groups from one selector and sum the owner groups to gate.reasons.length", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: counts owner selector") })
test("should never request an AI draft for a change question", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: change questions make no AI call") })
test("should fingerprint and wire a change row for an answer, send the composite finding_ref with plain finding_keys, and keep dismissals of change rows local", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: memory wiring change rows") })
test("should compute the same label as the Worker for a fund-scoped decision recorded in another fund", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: client worker label parity") })
test("should send intent undefined instead of an empty string and refuse a masked-blank firm-template intent", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: intent empty and masked blank") })
test("should keep the local answer and the gate when storeFindings throws finding_too_large", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: finding too large non-fatal") })
test("should fetch regression checks for a document with no fingerprinted finding using the sentinel fingerprint", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: regression sentinel lookup") })
test("should create a question from a composite finding_ref on the finding's own run with the right issue class", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: worker composite question key") })
```

Execute-agent instructions (all already written into the plan body; kept as reminders):
- E1: `Triage` is DEFINED in `features/review/model.ts`; the `ownerAnswers` field (and `ownerAnswerIds`, H7) and the pass-through in `computeGate` (widen its local `states` annotation) are one narrow edit; `gateInterim.ts` is a plain re-export of core `computeGate` and needs no change; re-read the file at Step 0.
- E2: asked marker per V1 G1 (key present, `null` = asked unanswered), written at the Ask click (H5); `counselAnswer` is not written for change findings; core `computeVarianceGate` ignores `counselAnswer` once any owner key exists (landed behavior matches).
- E3: `variance-owner-sheet-model` asserts no change-kind question reaches `fetchAiDrafts`.
- E4: popover groups per F1 and H6: reasons are per (finding, owner) pair, list keys include the owner, `data-owner` added, sum of groups equals `gate.reasons.length`.
- E5: implement Section H in order H1, H2, H3 first (they unblock every e2e that records an answer); H2(d) is the one Worker edit; keep the allowed import-graph additions to `questionKey` and `parseQuestionKey`; never import `varianceMetaOf` on the main thread.
- E6: re-read `CounselScreen.tsx` (GpRequestGroup at :271), `GateButton.tsx` (`merged` object, three-part render) and `registry.ts` (two `counsel` rows, :29 and :75) at EXECUTE entry; none changed since Step 0.

Dimension findings:
- Infra fit: PASS - every named path and symbol resolves at HEAD 15aa796 (counsel/*, gate/*, `shell/GateButton.tsx`, registry rows, `review/model.ts`, `state/review.ts`, variance/* from P02, core `questionKey`/`parseQuestionKey`/`describeAssertion`/`runRegressionChecks`/`varianceMetaOf`, P03 `lookupWithChecks` and answer fields); engine worker holds the retained graph with `structure` (A4 answered); corrected references recorded
- Test coverage: PASS - every AC has a Fully-Automated gate; vacuous-green scan clean (Known-Gap only as the named keyboard residual with a backlog stub); new gates added for M2 parity, composite key, change-row wiring, `finding_too_large`, intent `''`, zero-finding regression lookup; all regression tokens resolve and do not collide
- Breaking changes: PASS - additive only; route hash unchanged; Worker edit leaves plain `finding_ref` behavior identical (a unit case pins it); outbox edit changes only the derived `finding_keys` for composite refs; label rename repairs enumerated
- Security surface: PASS - forged scope or assertion refused client-side and server-side; assertion label normalized via `describeAssertion`; checks ignored client-side when the firm differs; intent human-only, 500 cap, masked-blank refused; "You" never reaches the outbox or a key; the composite-key Worker edit only changes lookup keys inside the already authenticated workspace; no auth, secret or schema change
- Section A (PLAN-time verifications) feasibility: PASS - A1 confirmed (`saveTriage` persists the whole triage record; questions are created at send or export; answers ride the outbox), A4 confirmed
- Section B (owner chip, override, keys) feasibility: PASS - highest-risk edit is the composite key through outbox, export and the Worker (H2); mitigated by one helper, the Worker test and `variance-memory-wiring`
- Section C (Questions tabs, per-owner export) feasibility: PASS - registry rename, ExportDialog path, AI exclusion with gate; highest-risk edit `CounselScreen.tsx` (`GpRequestGroup` stays on every tab)
- Section D (Record-answer dialog) feasibility: PASS - intent, scope, preview, trimmed and masked-nonblank rule; per-owner overwrite of the null marker
- Section E (regression wiring) feasibility: PASS - checks fetched with a sentinel when needed; `runRegression` returns views and meta like `runVarianceImpl`; `doc_not_retained` fallback via `rememberInput`; highest-risk edit `engine.worker.ts` `runRegression`
- Section F (gate popover and counts) feasibility: PASS - per-pair reasons, owner-keyed list items, legacy-gate versus variance-gate tab behavior stated; highest-risk edit `GateReasons.tsx` (Intake collision; keep order GateReasons, PackageGateReasons, CoverageLine)
- Section G (wrap-up) feasibility: PASS - backlog stub present; import-graph adds two names
- Section H (inner-PVL wiring) feasibility: PASS - each item is a bounded edit with a named gate; the Worker and outbox edits are narrow and additive
- Intake coupling (Step 0 items a to d): PASS - re-verified from landed code: `GpRequestGroup` at `CounselScreen.tsx:271`, `<h1 id="h-counsel">` at :160, `GateButton` `merged` object and badge on `merged.reasons.length`, registry rows :29 and :75 unchanged

Open gaps:
- none blocking (0 FAIL, 0 CONCERN after the inline fixes)
- advisory (orchestrator-owned): `phase-blast-radius-registry.md` P04 line must add `apps/worker/src/routes/memory/counsel.ts`, `apps/worker/test/memory/variance-question-key-composite.test.ts`, `apps/web/src/api/outbox.ts`, `apps/web/src/memory/fingerprintFindings.ts`, `apps/web/test/variance-memory-wiring.test.ts` (and the already-noted `variance-regression-doc-not-retained.test.ts`); no collision (P03 is VERIFIED, P05 only deploys)
- advisory: the Entry Gate still requires Phase 02 VERIFIED; its independent EVL run was in progress at validate time
- known-gap: documented as NEW PLAN REQUIRED - none (no out-of-scope gap found)
- known-gap (named residuals, carried): change rows get no cross-document memory label in V4 (answers and checks are stored; labels of change rows stay `new`); a second owner's answer supersedes the first owner's decision in memory (M1 family, backlog `variance-fund-scope-supersede_NOTE_17-10-26.md`); no check revoke path and 20-check ceiling (backlog `variance-regression-check-revoke_NOTE_17-10-26.md`); manual keyboard pass (backlog stub exists, gap-resolution D); live Worker regression path and live D1 persistence of owners and answers (V5 stack smoke, operator residual `variance-live-regression-operator_NOTE_17-10-26.md`)

What this coverage does NOT prove:
- `variance-owner-override`: persistence on the live D1 (V3 worker tests plus V5 smoke); that the override survives a browser with storage disabled
- `variance-two-owner-two-questions` and `variance-question-key-composite`: question wording quality; behavior with three or more owners; the deployed Worker (V5)
- `variance-questions-by-owner-export` and `variance-counsel-export-contents`: opening the DOCX in Word (rendering); GP missing-documents request export (Intake's own gate)
- `variance-answer-record-intent-scope` and `variance-intent-human-only`: AI-drafted intent (not built, by design); server masking of intent beyond the client's masked-blank pre-check (V3 gate)
- `variance-regression-r01`, `variance-regression-doc-not-retained` and `variance-memory-wiring`: the live Worker lookup path and Turnstile-gated sessions (V5 stack smoke, operator residual); checks other than `scope_exists`; cross-document labels of change rows
- `variance-gate-two-states` and `variance-counts-owner-selector`: the deployed gate; counts when an Intake package block reason exists beyond the Intake-excluded case asserted by the selector unit
- `variance-owner-sheet-model` AI-call assertion: real OpenRouter traffic (checks the call set only, 0 live calls made)
- Agent-Probe design probe: pixel parity; a manual keyboard pass with a real screen reader

Gate: PASS
Accepted by: not required for PASS (no CONCERN open after the inline fixes). Session: autonomous autopilot, planning-only inner PVL for phase 4; findings H1-H9 fixed in plan text in this pass and re-checked by `validate-plan-artifact.mjs` (0 failures, 0 warnings). BRANCH B: the umbrella plan carries `## Stable Program Goal`, so no Autonomous Goal Block section is written to this phase plan (the umbrella goal governs).

Amendment 17-10-26 (user decision): no git push in any phase; commit locally only; the user pushes. Wording-only tightening, no gate change.
