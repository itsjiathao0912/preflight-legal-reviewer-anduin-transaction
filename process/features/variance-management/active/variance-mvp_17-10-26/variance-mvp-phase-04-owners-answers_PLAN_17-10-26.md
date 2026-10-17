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
**Depends on:** Phase 02 (web Findings, VERIFIED) AND Phase 03 (memory backend, VERIFIED). External: Intake feature closed before EXECUTE (Step 0).
**Context routers read:** `process/context/all-context.md`, `process/context/ui/all-ui.md`, `process/context/worker/all-worker.md`, `process/context/tests/all-tests.md`.

---

## Overview

Turns suggested owners into decisions and answers into memory, with no new screen: an owner chip on each change row (read from V1 routing, overridable before asking), one question per (finding, owner) using the composite key `<findingId>@<owner>`, the existing "Counsel questions" screen renamed "Questions" with `All · Counsel · GP · Fund admin` tabs and unanswered counts plus one DOCX export per owner, deterministic wording for change questions, the Record-answer dialog extended with intent and scope (firm template requires an intent and shows a one-line preview of the check it will create), the regression example R-01 wired end to end, and gate popover reasons grouped by owner (list only).

Locked inputs: DECISION D4 (routing, keying, override storage, tabs, per-owner export), D5 (assertion creation only when `facts.assertion_candidate` exists, preview from `describeAssertion`, client write path), D2 (gate policy). UI contract: `design/mockups/app-variance.html` plus notes (Questions grouping, answer modal, popover groups). Intent is human text only (AC-V15): no AI intent draft exists in this MVP.

Decisions made at PLAN time (reversible, recorded): (1) the owner override is allowed only while no question exists for that finding; once asked, the chip is read-only with a tooltip. (2) Error findings get an owner chip too (from the `issue_class` row) but keep the plain question key. (3) The counsel nav entry is renamed "Questions" by editing its registry row only; the route hash is unchanged so deep links keep working.

## Step 0 - Precondition: re-sync with Intake before EXECUTE

Re-sync with Intake's landed code (inner R+I refresh) before EXECUTE: read Intake's final PLAN and closeout and its landed diff; update the `## Dependencies on Intake` section of the umbrella (observed vs assumed to observed); re-allocate the migration number; re-check the collision files in the phase-blast-radius registry; write an `## Inner Loop Refresh Note` in this plan. EXECUTE may not start until the Intake feature is closed.

Phase-specific Step 0 checks: (a) **Questions screen / counsel sheet overlap:** observed in Intake's Phase 3 plan (track 3c, code not yet landed): `features/counsel/GpRequestGroup.tsx` is rendered ONCE in `CounselScreen.tsx` below the gate line and above the questions list, only when a package exists, with its own `exportRequestDocx.ts` (a separate missing-documents request DOCX; the counsel export is unchanged) and its requests are not Findings. Reconciliation rule (default, reversible): the owner tabs and per-owner counsel exports operate on the question list only; `GpRequestGroup` stays where Intake put it, unchanged and visible on every tab, with its own count and export; the GP tab badge and the gate popover owner groups count variance questions only (they equal the core gate reasons), and Intake's package reasons stay in Intake's own popover section; nothing is counted twice. Re-read the landed component and adjust only if its structure differs. (b) Intake's `GateButton.tsx` computes `blocked` as the core gate OR any package block reason and renders core `GateReasons`, then `PackageGateReasons`, then `CoverageLine`; V4 changes only the core `GateReasons` grouping (owner groups) and must keep that order and Intake's expression intact. (c) Re-read V2's final `ChangeRow.tsx`, `select.ts`, `variance-store.ts`, `baseline-source.ts` (landed code) and V3's final contracts. (d) Re-confirm `hartwell-crane` is present in the web firm list (V3).

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
- `apps/web/test/variance-{counts-owner-selector,question-ids,owner-sheet-model,counsel-export-contents,intent-human-only-static,assertion-preview,regression-doc-not-retained}.test.ts`
- `apps/web/e2e/variance-{owner-override,two-owner-two-questions,questions-by-owner-export,answer-record-intent-scope,intent-human-only,regression-r01,gate-two-states}.spec.ts`
- `apps/web/e2e/fixtures/variance-owners.ts`

Modify (additive; each file's owner in parentheses):
- `apps/web/src/features/counsel/{CounselScreen.tsx,QuestionRow.tsx,AnswerForm.tsx,sheet-model.ts,question-ids.ts,export-flow.ts,exportDocx.ts,counsel-store.ts,ExportDialog.tsx,ai-draft.ts}` (Phase 08; tabs, owner sections, per-owner export opening `ExportDialog` with that owner's sheet (owner in title and filename), composite keys via the single core `questionKey`, answer fields; `toggleAi` and `ai-draft.ts` exclude change questions so 0 live AI calls are made for them; `sheet-model.ts` `gateInputs` receives `ownerAnswers`)
- `apps/web/src/features/review/model.ts` (V2-owned, Intake collision file; NARROW edit only: add the optional `ownerAnswers?: Partial<Record<Owner, CounselOption | null>>` field to the `Triage` interface (defined in this file) and pass it into the `states[id]` object inside `computeGate`; no other change or behavior in the file; V2 and Intake must be committed first)
- `apps/web/src/features/gate/GateReasons.tsx` (Phase 08; group by owner, list only, "You" group for the analyst's own items, "Earlier funds" group for prior-fund items)
- `apps/web/src/features/variance/{ChangeRow.tsx,select.ts,variance-store.ts}` (V2-owned; narrow edits after V2 landed: mount `OwnerChip`, add owner counts to the shared selector, receive the regression finding; V2 must be committed first)
- `apps/web/src/state/review.ts` (additive: `recordAnswer` and `persistAnswer` gain an `owner` argument, answer action carries owner/intent/scope/assertion; the optional `Triage.ownerAnswers` map (owner to answer) lives INSIDE the persisted triage JSON, so `saveTriage` and the Dexie schema need no change (A1 confirms by reading `saveTriage`); regression arrival action recomputes the gate; edit scope limited to those actions)
- `apps/web/src/features/registry.ts` (rename the LAST (effective, last-wins) `counsel` row label to "Questions"; optionally sync the earlier placeholder row label; ONE logical rename; seam)
- `apps/web/src/engine/{engine.worker.ts,types.ts,client.ts}` (additive `runRegression(documentRef, checks)` calling core `runRegressionChecks`; V2 owns the file, serialized after it)
- `apps/web/test/import-graph.test.ts` (ALLOWED: append the main-thread value imports actually used, expected `questionKey`, `parseQuestionKey`, `describeAssertion`; single appended line, serialized seam)
- `apps/web/e2e/fixtures/memory-stub-rules.ts` (add `regression_checks` and the new answer fields to the fake Worker, additive)
- `apps/web/src/features/counsel/CounselScreen.tsx` h1 text becomes "Questions" (same file as above).
- Repairs by derivation only AFTER a failing run proves the need (nav label, h1 or Questions markup changed): `apps/web/e2e/{counsel-sheet,counsel-answer,counsel-export,counsel-gate,app-shell,placeholder-routes,a11y-smoke,layout-vs-mockup}.spec.ts`, `apps/web/src/smoke.test.tsx`

Not touched in V4: `packages/core/**` (all variance, gate and sheet logic landed in V1; contracts in V3), `apps/worker/**`, `apps/web/src/{api,storage}/**` (V3 and Dexie unchanged), README, `docs/**`, `design/**`.

## Public Contracts

- No new screen, route or sidebar item; the Questions route hash is unchanged (label rename only).
- Question keys: change findings `<findingId>@<owner>`, error findings plain id, from one helper (`questionKey`); `UNIQUE(workspace, review_run, finding_key)` unchanged. ONE keying rule is used identically by `sheet-model`, `export-flow`, `readQuestionIds` and `wording()`; no module builds or parses a key by hand.
- Owner values sent on the wire are only `counsel | gp | fund_admin` (server CHECK). The local-only analyst owner "You" is never a question owner, never gets a key and never reaches the outbox. Question creation at send time carries `owner` and `owner_source` (V3 wire fields).
- Regression checks arrive through V3's additive lookup accessor (`lookup()` keeps returning an array); V4 consumes only that accessor and `varianceMetaOf` (V1 sole decoder of `suggested_owners`, `assertion_candidate`, `impact` since `detail.facts` is scalar-only).
- Every wire field used here was added optionally in V3; the client never sends `scope: firm_template` without a non-empty trimmed intent (the server refuses it as well).
- Per-owner export reuses the existing DOCX builder (DOCX stays the only format); the sheet meta gains the optional owner.
- Gate stays two states; counts come from the one shared selector.

## Blast Radius

Files directly modified or created: the Touchpoints list (about 5 new source files, 6 unit tests, 7 e2e specs plus 1 fixture, 13 additive edits to existing files, up to 8 derived spec repairs). Collision files with Intake: `features/counsel/*`, `features/gate/GateReasons.tsx`, `features/review/model.ts` (narrow `computeGate` input only; V2-owned), `state/review.ts`, `features/registry.ts`, `import-graph.test.ts` (see registry). Guarded surfaces: `counsel-*`, `gate-pill`, `memory-*`, `export-flow`, `import-graph`, `layout-vs-mockup`.

## Implementation Checklist

### Section A - PLAN-time verifications (first tasks)

- [ ] A1. Confirm where questions are created for the server (observed: at export, in a batch, then `counsel_sheet_exported` audit) and where in-app answers are recorded (`AnswerForm` to `review.ts` to the outbox `answer` op); the owner and `owner_source` fields ride the question creation request (V3 contract), intent/scope/assertion ride the answer op. Also confirm `saveTriage` persists the whole triage object as JSON so the optional `Triage.ownerAnswers` map needs no Dexie change; if it does not, stop and replan (no schema bump is planned).
- [ ] A2. Confirm the existing tests that assert the label "Counsel questions" or the sheet markup; list them for the derived repairs (do not edit them before a failing run proves the need).
- [ ] A3. Baseline green before edits: `counsel-sheet`, `counsel-answer`, `counsel-export`, `counsel-gate`, `gate-pill` (e2e) and `export-flow`, `counsel-export-contents`, `import-graph` (web unit); record counts.
- [ ] A4. Confirm the engine worker can hold the parsed `Structure` of the open document so `runRegression` needs only `(documentRef, checks)`.

### Section B - Owner chip, override, keys (AC-V11, AC-V12)

- [ ] B1. `OwnerChip.tsx`: shows each suggested owner with the one-line routing reason; a select to override while no question exists for the finding; override saved in `owner-store.ts` (`uiState`) and recorded as `owner_source: 'override'` at ask time (`suggested` otherwise); read-only once asked. Override options (exactly): "Counsel", "GP", "Fund admin", "GP + Counsel" (creates two keys, one question per owner), and "You (no confirmation needed)" which is local-only: it is never sent, creates no key, and the Ask action is disabled with the tooltip "Change the owner first". Unit assertion (`variance-owner-sheet-model`): choosing "You" never produces an outbox op or a question key.
- [ ] B2. `question-ids.ts` and `counsel-store.ts` use the core `questionKey(findingId, owner)`; a finding with two owners becomes two question records, each answerable alone; error findings keep the plain id. One helper only; a unit test enumerates error and change keys.
- [ ] B4. Per-owner answer state: `recordAnswer` and `persistAnswer` in `state/review.ts` take an `owner` argument and write `Triage.ownerAnswers[owner]`; question creation at send time sends `owner` and `owner_source`; `features/review/model.ts` adds the optional `ownerAnswers` field to the `Triage` interface and passes it into `computeGate`'s state, and `features/counsel/sheet-model.ts` `gateInputs` also receives `ownerAnswers` (a finding resolves only when every asked owner answered; "unclear" keeps it blocking). For change findings `Triage.counselAnswer` is NOT written (ownerAnswers is authoritative, so the first owner's A/B/C cannot resolve the finding through the single-answer path); error findings keep `counselAnswer` exactly as today. Default, reversible: Step 0 re-reads V1's landed `gateReasonFor` precedence between `counselAnswer` and `ownerAnswers` and adjusts only if it differs; `variance-owner-sheet-model` asserts one-of-two answered gives `awaiting_counsel`. Asked-marker rule (V1 G1): `ownerAnswers[owner] = null` is written when a question is created for that owner (ask/export path), overwritten with the option on answer; key absent = not asked; the local-only "You" never gets a key.
- [ ] B3. Gates: `variance-question-ids`, `variance-owner-sheet-model` (unit; asserts the four states: asked-unanswered (key present, null), one-of-two answered (`awaiting_counsel`), "unclear" (stays blocking), and "You" (key never present)), `variance-owner-override`, `variance-two-owner-two-questions` (e2e).

### Section C - Questions screen, tabs, per-owner export (AC-V13)

- [ ] C1. `CounselScreen.tsx`: tabs `All · Counsel n · GP n · Fund admin n` (unanswered counts), owner sections, "Export for <owner> (DOCX)" per owner; `sheet-model.ts` filters per owner via core `buildCounselSheet` option; `export-flow.ts` and `exportDocx.ts` pass `meta.owner` and put the owner in title and filename; the existing D-1 rule (export only unanswered) is unchanged. "Export for <owner> (DOCX)" opens the existing `ExportDialog.tsx` with that owner's sheet (owner in dialog title and filename); `toggleAi` and `ai-draft.ts` exclude change questions (deterministic template wording only, 0 live AI calls for them); `variance-owner-sheet-model` asserts the question list handed to `fetchAiDrafts` contains no change-kind question.
- [ ] C2. `registry.ts` has two `counsel` rows (placeholder first, real row appended last; last wins): rename the LAST (effective) row label to "Questions" (optionally sync the placeholder); `CounselScreen` h1 becomes "Questions". Derived repairs (`smoke.test.tsx`, `app-shell`, `placeholder-routes`, `a11y-smoke`, `layout-vs-mockup`) are made only after a failing run proves they break. Intake's GP missing-documents item stays in the GP group and the GP export (Step 0 (a)).
- [ ] C3. `QuestionRow.tsx`: change questions use the V1 deterministic template wording (old text, new text, A/B/C); intent field is not part of the question.
- [ ] C4. Gates: `variance-questions-by-owner-export` (e2e: parse each DOCX with mammoth; no other owner's items), `variance-counsel-export-contents` (unit, node env), `variance-owner-sheet-model` (no change-kind question reaches `fetchAiDrafts`), regressions `counsel-sheet`, `counsel-export`, `export-flow`, `counsel-export-contents`.

### Section D - Record-answer dialog: intent, scope, preview (AC-V14, AC-V15)

- [ ] D1. `AnswerForm.tsx`: option (default marked), note, "Why is it written this way? (intent)" textarea, scope radios "This fund only / Firm template"; scope firm_template requires a non-empty TRIMMED intent (client refusal message; server also refuses); one muted preview line: when `facts.assertion_candidate` exists show `describeAssertion(...)` (for R-01: Appendix C must exist), otherwise "no automatic check for this item". The answer shows who and when.
- [ ] D2. Intent is human-only: the textarea has no default value, no auto-fill, no "use AI draft" action; the existing counsel AI draft (question wording) never touches it. Static unit test `variance-intent-human-only-static` greps the counsel feature for any assignment to the intent field outside user input.
- [ ] D3. `state/review.ts` answer action carries `intent`, `scope`, `assertion` into the outbox op (op kinds unchanged); triage keeps one status per finding; `ownerAnswers` for the core gate is fed from the per-owner answers (finding resolves only when every asked owner answered A/B/C; any "unclear" keeps it blocking); the answer overwrites the owner's `null` asked marker set at question creation (B4).
- [ ] D4. Gates: `variance-answer-record-intent-scope`, `variance-intent-human-only` (e2e), `variance-assertion-preview` (unit), regressions `counsel-answer`, `memory-prior-answer`, `memory-edit-is-new`.

### Section E - Regression wiring (AC-V16)

- [ ] E1. `regression-client.ts`: after the memory lookup returns `regression_checks` (background, never blocking first paint), call the engine `runRegression`; a violation appends a critical finding labelled "Regression: confirmed in <fund>" with the check statement as quote; the gate recomputes; a held check adds nothing; a check for another firm never arrives (server-scoped) and is also ignored client-side if its firm differs. The regression finding has a stable id (`REG-<check id>` plus document hash), is resolvable through normal triage (same status controls), and joins memory through its fingerprint (derived from check id plus normalized check statement) so a prior answer is recognised; if memory join is unavailable it is explicitly local-only (labelled so, never sent to the server as a new finding). It never blocks first render. `runRegression` on `doc_not_retained` (engine LRU of 2 by docHash evicted the parse): re-run the check from the remembered analyze input held by the client; if none exists, skip silently (no finding, no error). Unit test `variance-regression-doc-not-retained` covers both branches; the check is added to the unit gate list.
- [ ] E2. `engine.worker.ts`/`client.ts`/`types.ts` additive `runRegression`; `fake worker` fixture returns `regression_checks` for the e2e real-client path; the Dexie stub returns the checks stored by earlier answers in the same browser.
- [ ] E3. Gate: `variance-regression-r01` (e2e). Flow: open Fund II with baseline Fund I (firm hartwell-crane) so a `VAR-LOGIC-REMOVED` row for Appendix C exists; record the answer "Appendix C must exist" scope firm template with an intent; open Fund III (no Appendix C): blocking regression finding with the check quote; open `fund-III-with-appendix-c`: no regression finding; open a different firm's document: no check runs.

### Section F - Gate popover and counts (AC-V17, counts agree)

- [ ] F1. `GateReasons.tsx`: group reasons "You n · Counsel n · GP n · Fund admin n · Earlier funds n" (list only); `select.ts` owner counts feed the popover, the Questions tabs and the sidebar badge; totals equal Blocked N. Membership rules: "You" = items whose owner is the local-only You (blocking but never asked); "Counsel / GP / Fund admin" = asked or suggested variance questions by owner (unanswered or "unclear"); "Earlier funds" = regression findings and prior-fund items; each blocking finding appears in every group whose owner still owes an answer: a finding with ONE owner appears in exactly one group, a finding with two owners (GP + Counsel) is ONE core gate reason but is listed once under each owner whose question is unanswered (decided default, reversible), so group sizes are counted per (finding, owner) pair and equal the Questions tab counts for that owner. Blocking reasons of error findings go to their chip owner (Decision 2); when `GateReason.owner` is undefined they go to a "Document errors" fallback inside the "You" group (unless the finding is asked). `variance-counts-owner-selector` asserts that the set of distinct finding keys across all groups equals the set of core gate reason keys, with no package and with a package present, that no (finding, owner) pair is listed twice, and that sum of group sizes = core reasons count + number of two-owner findings still open on both owners. Equality statement: the distinct finding keys in the owner groups equal the core gate reasons (= Blocked N when there are no Intake package block reasons; Blocked N counts findings, not pairs); Intake package reasons stay in Intake's own popover section and are never counted here. `variance-counts-owner-selector` covers both cases (no package, and package present with the Intake section excluded).
- [ ] F2. Gates: `variance-counts-owner-selector` (unit), `variance-gate-two-states` (e2e), regressions `counsel-gate`, `gate-pill`.

### Section G - Wrap-up

- [ ] G1. Append the `import-graph` ALLOWED line only for symbols actually imported on the main thread; run `import-graph`. G2. Derived repairs only where a run proves breakage (nav label, markup). G3. Full regression block (Exit Gate). G4. Phase report with regression lines and the Intake reconciliation note (GP group). G5. Reference the existing backlog stub for the residual manual keyboard pass: `process/features/variance-management/backlog/variance-manual-keyboard-pass_NOTE_17-10-26.md` (owned by another agent; do NOT create it here; EXECUTE only verifies it exists). Assertion candidate is read through `varianceMetaOf` (no 4th `import-graph` symbol; the allowed set stays `questionKey`, `parseQuestionKey`, `describeAssertion`).

### Edge cases carried from vc-scenario / vc-security

1. Composite key leakage: a finding id that already contains `@`; an error finding that must never be given an owner suffix; two owners where one answers "unclear" and the other A (stays blocking); one owner answered, other missing (`awaiting_counsel`); override after asked (read-only); override then re-open document (persisted via `uiState`).
2. Forged inputs from the UI: whitespace-only intent; scope firm_template with an intent of 500+ characters (client truncates at 500, server refuses above); assertion label with markup or 80+ chars (client trims to the normalized label from `describeAssertion`, never free text); answer replayed from the outbox (idempotent, no second check).
3. Owner "You": selected then Ask pressed (disabled, tooltip), never in outbox or export; regression finding after LRU eviction (re-run or silent skip).
4. Export correctness: per-owner export lists only that owner's unanswered questions; a finding with two owners appears once in each owner's export; an owner with zero open questions disables its export button with a visible reason; per-owner tab counts equal that owner's popover group size, and distinct findings across groups equal the core gate reasons (a two-owner finding is counted once in Blocked N and once per owner in the tabs and groups).

## Test Gates (exact commands; no `--` token; one token per call)

```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction
for t in variance-counts-owner-selector variance-question-ids variance-owner-sheet-model variance-counsel-export-contents variance-intent-human-only-static variance-assertion-preview variance-regression-doc-not-retained import-graph; do pnpm --filter @aduin/web test "$t" || exit 1; done
for t in variance-owner-override variance-two-owner-two-questions variance-questions-by-owner-export variance-answer-record-intent-scope variance-intent-human-only variance-regression-r01 variance-gate-two-states; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
```

Regression block (preview e2e serially, one agent at a time, port 4317 shared; stack-memory afterwards, never together):

```bash
for t in counsel-sheet counsel-answer counsel-export counsel-gate gate-pill memory-no-reflag memory-prior-answer memory-edit-is-new memory-blocking-never-hidden memory-no-cross-firm a11y-keyboard layout-vs-mockup app-shell placeholder-routes no-llm-corpus intake-missing-docs-request-export intake-gp-group-absent-without-package intake-gate-warning-policy; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
for t in export-flow counsel-export-contents counsel-draft gate-reexport api-contract review-sync; do pnpm --filter @aduin/web test "$t" || exit 1; done
for t in gate-state-matrix sheet-contents variance-gate-state-matrix variance-question-key-matrix; do pnpm --filter @aduin/core test "$t" || exit 1; done
pnpm --filter @aduin/web test
pnpm --filter @aduin/web typecheck
pnpm lint
pnpm typecheck
```

Never use the e2e token `gate` alone. Each one-token e2e call rebuilds the preview (3 to 6 s).

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

## Phase Loop Progress

- [ ] 0. PRECONDITION - Intake feature closed; Step 0 re-sync done (Questions overlap reconciled); Inner Loop Refresh Note written
- [ ] 1. RESEARCH - research-agent: V2 and V3 reports read in full; V1 Forward Preview read; test context loaded
- [ ] 2. INNOVATE - innovate-agent: approach decided (n/a if the DECISION still holds)
- [ ] 3. PLAN-SUPPLEMENT - plan-agent: existing phase plan updated (or "n/a - research clean")
- [ ] 4. PVL - vc-validate-agent: full V1-V7; validate-contract per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [ ] 5. EXECUTE - vc-execute-agent (opus): checklist done; per-section gates green
- [ ] 6. EVL - independent vc-tester: gates re-run; stubs registered; EVL HANDOFF SUMMARY
- [ ] 7. UPDATE PROCESS - phase report written, umbrella state updated, commit done

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
| keyboard and design probes | Agent-Probe | base AC30 on changed screens |
| `counsel-*`, `memory-*`, `gate-pill`, `sheet-contents`, `gate-state-matrix` | Fully-Automated | base AC20-AC22, AC41-AC48 stay green |

## Test Infra Improvement Notes

- `apps/web/e2e/fixtures/variance-owners.ts` and the extended `memory-stub-rules.ts` should expose one `recordFirmTemplateAnswer()` helper reused by V5.
- Parsing DOCX in e2e needs mammoth (already a devDependency); keep parsing in node-env unit tests where possible.
- Serial e2e only (port 4317, shared `test-results`).

## Resume and Execution Handoff

- Selected plan file path: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-04-owners-answers_PLAN_17-10-26.md`
- Umbrella plan: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md`
- Last completed step: not started (EXECUTE held until the Intake feature closes; V2 and V3 must be VERIFIED first)
- Validate-contract status: PASS written (outer-pvl, PVL cycle 2 re-validation, 17-10-26); EXECUTE still held until Intake closes and Step 0 re-sync is done
- Next step: after Phases 02 and 03 are VERIFIED and Intake is closed, spawn vc-research-agent for Step 0 plus RESEARCH. EXECUTE receives this one exact plan path.
- Validators: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this plan>`; `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <this plan>`.
- Hard rules for every agent prompt: never git stash, checkout, reset or restore; commit on main with conventional prefixes; no push; execution commits separate from process commits.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: outer-pvl
supersedes: 2026-10-17 (outer-pvl) - outer PVL has current evidence (PVL cycle 2 re-validation after the N1-N4 supplement; the prior contract was CONDITIONAL with N1-N4)

Parallel strategy: sequential
Rationale: score 2-3/7 (S2 contract consumption, S7 5+ files; S6 weak) is MEDIUM, but sections B, C, D, F all edit `counsel/*`, `state/review.ts`, `select.ts`, so one opus EXECUTE agent runs sequentially; EVL by an independent sonnet vc-tester, preview e2e serially (port 4317), stack-memory afterwards, never together. Dominant signal: shared files across sections. This outer-PVL pass was a single read-only validate-agent (a subagent cannot spawn others): the Layer 1 and Layer 2 checks were done as direct repo and cross-plan verification, not as separate spawned agents.

Re-validation result (cycle 2): N1-N4 are CLOSED in the plan text (verified against the repo and the V1/V2/V3 plans) and C1-C7 remain intact (no regression of the earlier fixes). One NEW low-severity concern (N5, popover and tab counting for a finding with two owners, plus the `counselAnswer` versus `ownerAnswers` precedence) was found and FIXED IN THE PLAN TEXT in this pass (F1, Edge case 4, B4); no new files, scope or schema. Structural validator `validate-plan-artifact.mjs`: 0 failures, 0 warnings (run before the edit; re-run after).

Prior gap closure:
- N1 closed: Touchpoints and B4 add the optional `ownerAnswers?: Partial<Record<Owner, CounselOption | null>>` to the `Triage` interface in `apps/web/src/features/review/model.ts` (verified: `Triage` is defined at line 10 of that file) and pass it into the `states[id]` object in `computeGate` (lines 113-132); the edit is narrow and V2 and Intake commit first.
- N2 closed: B4 and D3 define the asked marker exactly as V1 G1 does (key present = asked, `null` = asked and unanswered, key absent = not asked, "You" never gets a key); B3 and `variance-owner-sheet-model` assert the four states.
- N3 closed: C1 and C4 state that `toggleAi` and `ai-draft.ts` exclude change questions and that `variance-owner-sheet-model` asserts the list handed to `fetchAiDrafts` has no change-kind question (verified: `fetchAiDrafts` is called from `CounselScreen.tsx` `toggleAi`, defined in `ai-draft.ts`).
- N4 closed: F1 sends blocking reasons of error findings to their chip owner and, when `GateReason.owner` is undefined, to a "Document errors" fallback inside the "You" group (unless asked); `variance-counts-owner-selector` asserts the group-to-core-reasons relation in the no-package and package-present cases.
- C1-C7 still intact (re-verified): per-owner answer state in the persisted triage JSON (`saveTriage` puts the whole `Record<string, Triage>` into `uiState`, no Dexie change); `ExportDialog.tsx` and `ai-draft.ts` in Touchpoints; local-only "You" option; last-wins `counsel` registry row (placeholder first, real row appended last, both labelled "Counsel questions" today); `REG-<check id>` regression id, fingerprint and `doc_not_retained` branch; F1 membership rules; G5 backlog stub (verified present).
- N5 (new, fixed in plan text): F1 said "each blocking reason appears in exactly one group" while Edge case 4 and C1 say a two-owner finding appears in both owners' tabs and exports, so "tabs equal gate reasons" could not hold. Plan now states: a two-owner finding is one core reason (one in Blocked N) and is listed once under each owner that still owes an answer; group and tab counts are per (finding, owner) pair; the selector unit asserts equality on DISTINCT finding keys plus the pair arithmetic. B4 also now states that `Triage.counselAnswer` is not written for change findings (ownerAnswers is authoritative), so one owner's A/B/C cannot resolve a two-owner finding.

Test gates (C3 5-column table; every proving strategy is Fully-Automated except the one Agent-Probe row; Known-Gap is never a strategy):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC-V11 | suggested owner shown; analyst override saved and recorded as `owner_source` | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-owner-override` | B (gate added by this plan) |
| AC-V12 | one finding with two owners gives two questions, each answerable alone; one `questionKey` helper; asked marker states; one-of-two answered keeps the finding blocking | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-two-owner-two-questions`; unit `variance-question-ids`, `variance-owner-sheet-model` | B |
| AC-V13 | Questions grouped per owner with unanswered counts; per-owner DOCX contains only that owner's items | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-questions-by-owner-export`; unit `variance-counsel-export-contents` | B |
| AC-V14 | dialog saves option, note, intent, scope; firm_template refused without trimmed intent | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-answer-record-intent-scope` | B |
| AC-V15 | intent is human-entered only; whitespace-only refused; no AI path | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-intent-human-only`; unit `variance-intent-human-only-static` | B |
| AC-V16 | R-01 end to end: violated, held, other firm; doc_not_retained fallback | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-regression-r01`; unit `variance-assertion-preview`, `variance-regression-doc-not-retained` | B (client path only; live Worker is V5 stack smoke) |
| AC-V17 | gate: two states, "unclear" stays blocking, cosmetic never blocks | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-gate-two-states` | B |
| counts agree | Findings segment, Questions tabs, sidebar badge, popover groups from one selector; distinct finding keys equal core reasons (no package, and package present with Intake section excluded); Document errors fallback; two-owner pair arithmetic | Fully-Automated | `pnpm --filter @aduin/web test variance-counts-owner-selector` plus `variance-questions-by-owner-export` | B |
| change questions make 0 live AI calls | `toggleAi` / `ai-draft.ts` skip change questions | Fully-Automated | `pnpm --filter @aduin/web test variance-owner-sheet-model` (assertion is in plan text C1 and C4) | B |
| base surfaces stay green | counsel, memory, gate, export, a11y, layout, Intake overlap surfaces | Fully-Automated | regression block in `## Test Gates` (preview e2e, web unit, core unit, typecheck, lint) | A (baseline run is checklist A3) |
| UX fit on changed screens (tabs, owner chips, dialog; 1440 and 1024) | visual fit and non-colour cues vs `app-variance.html` | Agent-Probe | `DESIGN_PROBE=1 pnpm exec playwright test --project=preview design-probe` from `apps/web`, agent records judgment | D (manual keyboard pass is a named residual; stub exists at `process/features/variance-management/backlog/variance-manual-keyboard-pass_NOTE_17-10-26.md`) |

Legacy line form (retained for existing consumers):
- apps/web owners: [Fully-automated: `pnpm --filter @aduin/web test:e2e variance-owner-override`]
- apps/web questions: [Fully-automated: `pnpm --filter @aduin/web test:e2e variance-two-owner-two-questions`]
- apps/web export: [Fully-automated: `pnpm --filter @aduin/web test:e2e variance-questions-by-owner-export` + unit `variance-counsel-export-contents`]
- apps/web answer: [Fully-automated: `test:e2e variance-answer-record-intent-scope`, `variance-intent-human-only`]
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
test("should derive Findings segment, Questions tabs, sidebar badge and popover groups from one selector", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: counts owner selector") })
test("should never request an AI draft for a change question", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: change questions make no AI call") })
```

Execute-agent instructions (carried, all already written into the plan body; kept for the execute-agent as reminders):
- E1: `Triage` is DEFINED in `features/review/model.ts`; the `ownerAnswers` field and its pass-through in `computeGate` are one narrow edit; re-read the file at Step 0 after V2 and Intake commit.
- E2: asked marker per V1 G1 (key present, `null` = asked unanswered); `counselAnswer` is not written for change findings; at Step 0 re-read V1's landed `gateReasonFor` precedence and adjust only if it differs.
- E3: `variance-owner-sheet-model` asserts no change-kind question reaches `fetchAiDrafts`.
- E4: popover groups per F1 (error reasons to chip owner or "Document errors" under "You"; two-owner findings listed under each owner that still owes an answer; equality on distinct finding keys).

Dimension findings:
- Infra fit: PASS - every named path and symbol verified on disk (counsel/*, `features/gate/GateReasons.tsx`, registry two `counsel` rows, `review/model.ts` `Triage` and `computeGate`, `state/review.ts` `saveTriage` and `Triage` store, `ai-draft.ts` `fetchAiDrafts`, all 15 preview e2e regression specs, the web unit and core unit regression gates incl. `counsel/gate-state-matrix` and `counsel/sheet-contents`, both backlog stubs); V1 names (`GateState.ownerAnswers`, `GateReason.owner?`, `questionKey`, `parseQuestionKey`, `describeAssertion`, `runRegressionChecks`, `varianceMetaOf`, `variance-gate-state-matrix`, `variance-question-key-matrix`), V2 names (policy argument and `gates: true` in `model.ts`, rows include change rows) and V3 names (`lookupWithChecks`, `regression_checks`, `owner_source`, intent/scope/assertion) align; Intake names (`GpRequestGroup`, `PackageGateReasons`, `CoverageLine`, `intake-missing-docs-request-export`, `intake-gp-group-absent-without-package`, `intake-gate-warning-policy`) appear in Intake's plans
- Test coverage: PASS - every AC has a Fully-Automated gate; vacuous-green scan clean (Known-Gap only as the named keyboard residual with a backlog stub); 0-live-AI-call claim and the owner-state matrix have named gates; counts equality is now precise and testable
- Breaking changes: PASS - additive only; route hash unchanged; label rename repairs enumerated; wire fields optional (V3); composite key only for change findings; `lookup()` stays an array; `Triage.ownerAnswers` optional inside the persisted JSON, no Dexie change
- Security surface: PASS - forged scope or assertion refused client-side and server-side, assertion label normalized via `describeAssertion`, regression checks ignored client-side when the firm differs, intent human-only with 500 cap, "You" owner never reaches the outbox or a key
- Section A (PLAN-time verifications) feasibility: PASS - A1 mechanically confirmed (`saveTriage` persists the whole triage record); A2-A4 read-only
- Section B (owner chip, override, keys) feasibility: PASS - `Triage` and `computeGate` edit located; asked marker and counselAnswer rule written; highest-risk edit `question-ids.ts` and `counsel-store.ts` re-keying, mitigated by one helper and the key unit test
- Section C (Questions tabs, per-owner export) feasibility: PASS - registry rename, ExportDialog path, AI exclusion with gate; highest-risk edit `CounselScreen.tsx` (Intake also edits it; `GpRequestGroup` stays on every tab per Step 0 (a))
- Section D (Record-answer dialog) feasibility: PASS - intent, scope, preview, trimmed-intent rule and per-owner overwrite of the null marker specified and testable
- Section E (regression wiring) feasibility: PASS - id, fingerprint, local-only fallback, `doc_not_retained` branch; highest-risk edit `engine.worker.ts` `runRegression` (additive, serialized after V2)
- Section F (gate popover and counts) feasibility: PASS - membership rules cover single-owner, two-owner, "You", "Earlier funds" and error findings; highest-risk edit `GateReasons.tsx` (Intake collision, keep order GateReasons, PackageGateReasons, CoverageLine)
- Section G (wrap-up) feasibility: PASS - backlog stub verified present; allow-list budget stays at three symbols
- Intake coupling (Step 0 items a to d): PASS as known-gap - rows marked observed-in-plan are re-verified by Step 0; EXECUTE is held until Intake closes by design

Open gaps:
- none blocking (0 FAIL, 0 CONCERN)
- advisory (not a plan gap, orchestrator-owned): `phase-blast-radius-registry.md` P04 "Owns (creates)" line lists 6 unit tests and omits `variance-regression-doc-not-retained.test.ts` (a new file in the V4-owned `apps/web/test/variance-*` prefix, no collision risk); sync the registry at the next registry touch
- known-gap: documented as NEW PLAN REQUIRED - none (no out-of-scope gap found)
- known-gap (named residuals, re-verified at Step 0 or later): Intake `ASSUMED`/`OBSERVED-IN-PLAN` rows; manual keyboard pass (backlog stub exists, gap-resolution D); live Worker regression path (V5 stack smoke, operator residual `variance-live-regression-operator_NOTE_17-10-26.md`); live D1 persistence of owner and answers (V3 plus V5)

What this coverage does NOT prove:
- `variance-owner-override`: persistence on the live D1 (V3 worker tests plus V5 smoke); that the override survives a browser with storage disabled
- `variance-two-owner-two-questions`: question wording quality; behavior with three or more owners
- `variance-questions-by-owner-export` and `variance-counsel-export-contents`: opening the DOCX in Word (rendering); GP missing-documents request export (Intake's own gate)
- `variance-answer-record-intent-scope` and `variance-intent-human-only`: AI-drafted intent (not built, by design); server masking of intent (V3 gate)
- `variance-regression-r01` and `variance-regression-doc-not-retained`: the live Worker lookup path and Turnstile-gated sessions (V5 stack smoke, operator residual); checks other than `scope_exists`
- `variance-gate-two-states` and `variance-counts-owner-selector`: the deployed gate; counts when an Intake package block reason exists beyond the Intake-excluded case asserted by the selector unit
- `variance-owner-sheet-model` AI-call assertion: real OpenRouter traffic (checks the call set only, 0 live calls made)
- Agent-Probe design probe: pixel parity; a manual keyboard pass with a real screen reader

Gate: PASS
Accepted by: not required for PASS (no CONCERN open). Session: autonomous autopilot, planning-only run; PVL cycle 2 re-validation, 0 FAIL, 0 CONCERN after the N5 plan-text fix. Recorded fix cycles: 2 (results.tsv has P04 cycle-1 and cycle-2 rows).
