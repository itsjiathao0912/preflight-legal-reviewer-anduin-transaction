---
name: plan:subdoc-qa-mvp-phase-07-version-diff
description: "Sub-doc QA MVP — Phase 07: version diff and sibling-document comparison (section alignment, jsdiff, extractors, rename inference, findings delta, common vs differing clauses)"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-07
---

# Phase 07 — Version Diff and Sibling Labeling

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-07-version-diff_REPORT_17-10-26.md

---

## Overview

Compares two related documents with one pipeline for every format (no Docxodus): section alignment (scope path + heading/body similarity), jsdiff for word/sentence changes, extractors (defined terms, fee percentages, must/required lines), rename inference (Units→Shares, Member→Shareholder, Memorandum→Prospectus, placement agent→distributor, Placement Fee→Sales Load), a findings delta (fixed / still present / new), and a **sibling mode** that labels every clause common or differing (supports Anduin's Omnibus single-form practice). Test sets: #5 vs #6 (drift), #3 vs #4 (reorganized), an identical pair ("no differences"), and a seeded sibling pair, because the samples contain no true feeder pair. An AI narrative of the rename drift uses the Phase 05 task framework with recorded responses (hybrid part). Context routers: `process/context/all-context.md`, `process/context/product-domain.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`; golden facts in `subdoc-qa-mvp_RESEARCH_17-10-26.md` section A.

UI contract (refreshed 2026-10-17): the Compare screen HAS an approved mockup: `design/mockups/app.html` `#v-compare` plus `compare_NOTES.md`. No `diff.html` is created (old step A0 deleted). The screen is a two-doc picker with swap, a Versions|Siblings toggle (default Versions, D-6), stat chips, a change list, and a clause diff, built from existing tokens.

Execution split (D8): sequential, opus for EXECUTE, order Phase 05 then 06 then 07. 07a = core diff + goldens; 07b = Worker seam (`EngineApi.diffDocuments`) + Compare UI + e2e; 07c = AI narrative (conditional on Phase 05 verified, else backlog stub and AC15 H-part stays CONDITIONAL; at most 3 free live recordings).

## Phase Completion Rules

- CODE DONE = diff engine, view, tests committed.
- VERIFIED = Exit Gate green, validate-contract written, regression: Phase 02 corpus + Phase 03 e2e + Phase 05 AI lane specs green. The narrative test uses recorded responses; if Phase 05 is not yet verified the narrative step is deferred (backlog stub) and AC15 stays CONDITIONAL, never silently passed.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC15 | #5→#6: both swapped refs fixed; Appendix C removed; terminology renames; class fees (3.5% A, 1.5% S); drafting note removed (#6 KEEPS an `[insert …]` placeholder, so assert only the placeholders actually removed); sections 1–12 and Parts A–D unchanged except Part A of §6 relabelled Unit class→Share class (an expected `changed`/renamed entry, not a regression) | `pnpm --filter @aduin/core test golden-05-06-drift` (FA for structure, fees, Appendix C, fixed refs); `pnpm --filter @aduin/core test drift-narrative` (H for the AI rename narrative on recorded responses) | Fully-Automated + Hybrid | Live-narrative quality is a named Known-Gap residual (backlog stub, gate stays CONDITIONAL) |
| AC16 | "LLC Agreement" retained in #6 (count taken from engine output, not the old "10×" figure) is low confidence, if reported at all (diff-only, not a Finding) | `pnpm --filter @aduin/core test golden-06-llc-agreement-lowconf` (if present: confidence < 0.5 and <= 0.4 by rule, severity low, label "Possible leftover") | Fully-Automated (no precondition) | — |
| AC19 | Diff incl. sibling feeder/parallel docs: added/removed/renamed sections, changed definitions/requirements/fees, findings delta; clause labeled common vs differing; #3 vs #4 does not crash; identical pair says "no differences" | `pnpm --filter @aduin/web test:e2e diff-pairs` (#5/#6, #3/#4, identical pair) + `pnpm --filter @aduin/core test sibling-clause-common-vs-differing` (seeded sibling pair) | Fully-Automated | — |

## Entry Gate

- Phases 02, 03 verified; Phase 05 verified for the narrative step 07c only.
- Phase 06's engine-file changes (`apps/web/src/engine/*`, core adapters) must have LANDED before 07b EXECUTE: Phase 07 appends to those files, it does not fork them (order 05 then 06 then 07). 07b checks that `engine.worker.ts` contains Phase 06's format dispatch before touching it.
- Phase 02 fixtures and findings (for the findings delta) available.

## Library pins (confirm via vc-docs-seeker in Phase 00)

jsdiff v9 (`diff` 9.0.0: `diffWords`, `diffSentences`; option names `maxEditLength` / `timeout`). Pre-condition A2 is DISCHARGED by the PVL probe (2026-10-17): `diff` 9.0.0 exports `diffWords`, `diffSentences`, `diffLines`, `diffChars`; change objects are `{count, added, removed, value}`; when `maxEditLength` or `timeout` is exceeded the call RETURNS `undefined` (it does not throw; probed for both options). EXECUTE need not re-probe but B2 must handle the `undefined` return. Also: htmlparser2 (via adapter), zod, Vitest, Playwright, TanStack Table.

## Touchpoints (create)

```
packages/core/src/diff/{types.ts,normalize-key.ts,align.ts,diff-text.ts,extract-terms.ts,extract-fees.ts,extract-requirements.ts,rename-inference.ts,findings-delta.ts,sibling.ts,index.ts}
packages/core/src/llm/tasks/drift-narrative.v1.ts      07c; uses Phase 05 framework (new file; no edit of P05 files)
packages/core/src/index.ts                             (append exports only)
packages/core/test/{unit,golden,recorded}/diff/**      (incl. diff-input-failure)
fixtures/diff/{sibling-A.html,sibling-B.html,identical-pair/*,empty.html,single-section.html,expected/*.json}   built/verified by fixtures:build / fixtures:check
fixtures/llm-recordings/drift-narrative/*.json
scripts/src/fixtures/{build-seeded.ts,check.ts}        (Phase 02-owned; ADDITIVE edit: emit the fixtures/diff set; extend the stray-file scan to fixtures/diff)
apps/web/src/engine/{engine.worker.ts,client.ts,types.ts}   (append EngineApi.diffDocuments(input); extract a shared prepare(bytes, settings) helper inside engine.worker.ts after Phase 06's format dispatch; no second worker)
apps/web/src/features/registry.ts                      (append id:'compare', replacing the `#compare` placeholder)
apps/web/src/features/compare/**                       picker, swap, Versions|Siblings toggle, stat chips, change list, clause diff, empty/loading states
apps/web/test/support/mockupCss.ts                     (append a Compare slicer)
apps/web/test/import-graph.test.ts                     (gate only; must stay green, not edited)
apps/web/e2e/{diff-pairs,sibling-clauses}.spec.ts      (new)
apps/web/e2e/{placeholder-routes,layout-vs-mockup,a11y-smoke}.spec.ts   (NARROW REPAIR; see Step G)
apps/web/src/smoke.test.tsx                            (NARROW REPAIR; append 'compare' to the id array)
```

Reference only (no edits): `design/mockups/app.html` `#v-compare`, `design/mockups/compare_NOTES.md`.

## Public Contracts

- Core entry (D1, N3): `diffDocuments({a: SideInput, b: SideInput, mode:'version'|'sibling'})` in `packages/core/src/diff/`, where `SideInput = {ok:true, structure, graph, findings} | {ok:false, stage: DiffStage, code: string}`; it returns `{result: DiffResult}` or `{error:{side:'a'|'b', stage: DiffStage, code: string}}` (the first failed side, a before b) and never throws for a failed side. `DiffStage = 'read'|'parse'|'structure'|'detect'|'diff'` is its own exported type in `diff/types.ts`, distinct from the engine's `StageId`; `code` is a CoreError code or a fixed token, never message text. `DiffResult` is a zod schema in `diff/types.ts` with a contract test. It is NOT added to the frozen v1 snapshot set unless the snapshot test picks it up, in which case regenerate with a recorded change note. Output is deterministic (sorted), plain JSON over Comlink. `DiffResult` carries NO timing field (timing lives outside; see AC29). Text spans (E17) are computed once on the WHOLE aligned-block raw text and then mapped onto the jsdiff segments, so a span straddling a segment boundary is not split or missed.
- `DiffResult {mode: 'version'|'sibling', sections: [{status: added|removed|renamed|moved|changed|same, a?, b?, pathA?, pathB?}], definitions: [...], requirements: [...], fees: [...], renames: [{from,to,count,confidence}], possibleLeftovers: [...], findingsDelta: {fixed[], stillPresent[], new[]}, clauses?: [{label: common|differing|only_a|only_b, ...}]}`; same input gives identical output. Every text-bearing entry carries a span-aware clipped RAW excerpt (clip bounds are extended so no sensitive span is split; reuse the `excerpt()` widening approach from structure-view) plus `sensitiveSpans: [{start,end}]` (offsets into that raw excerpt). The main thread masks at display time with the allow-listed core `mask` (already on the import-graph allow-list) and Reveal toggles it, following the existing `revealed` state convention used by Findings. Raw excerpts never leave the browser (no server path in Phase 07). A `truncated: boolean` flag is set on a section whose text diff used the coarse fallback (B2).
- Worker wire input (S3): `EngineApi.diffDocuments(input)` where `input = {a:{bytes, name, kind?}, b:{bytes, name, kind?}, mode:'version'|'sibling'}`. `bytes` is an `ArrayBuffer`/`Uint8Array` (transferred), `name` is the display file name, `kind` is the optional format hint the same way `analyze` takes it. The worker holds no parsed-document cache and `analyze` returns no `DocGraph`, so `diffDocuments` parses both inputs itself. Both inputs go through the SAME bytes→(DocGraph, findings) helper as `analyze`: extract `prepare(bytes, settings)` inside `engine.worker.ts` AFTER Phase 06's format dispatch lands (extraction without behavior change; `analyze` keeps its imports of `htmlToLines`, `buildDocGraph`, `runDeterministic` as the import-graph test expects). Format scope (N2): the Compare picker is limited to formats the in-worker `prepare` handles: HTML at minimum; PDF (text layer) and DOCX ONLY if Phase 06's worker dispatch exposes them (checked at D0). Scanned/OCR documents are OUT of scope for Compare in this phase because OCR runs on the main thread in Phase 06; recorded as a deviation plus backlog stub `compare-ocr-documents_NOTE_17-10-26.md`. Error mapping (N3): the worker `prepare(bytes, settings)` catches a thrown CoreError and returns `{ok:false, stage: DiffStage, code}` (the CoreError code only, never its message text; unknown throws map to a fixed token such as `unknown`); success returns `{ok:true, structure, graph, findings}`. The worker passes both per-side results to core `diffDocuments` and wraps the outcome with `ms`. Return type: `{result: DiffResult, ms: number}` on success, or `{error: {side: 'a'|'b', stage: DiffStage, code: string}}` on failure; the error carries NO document text. `ms` is a wrapper field outside `DiffResult`.
- Alignment (D2): normalized scope keys (case-folded, whitespace/punctuation collapsed, small-caps neutralized, numbering split into {kind, ordinal}); repeated running headers get an ordinal and align in sequence; Roman/letter part labels use canonical ordinal as tie-break after title. Passes: exact key, then LCS over the heading sequence, then a bounded similarity fallback (token Jaccard on heading plus first N chars) only inside unmatched windows. Complexity O(n log n + sum k^2).
- Findings delta (D4, replaces exact `detector_id + quote_hash`): within an aligned block pair, the same `detector_id` with quote similarity >= threshold on normalized text (case/punctuation/brackets stripped, digits masked) = still present; no counterpart and the aligned block no longer triggers = fixed; a B finding with no counterpart = new. Thresholds pinned from engine output on #5/#6, never hand-written.
- Worker seam (D1): `EngineApi.diffDocuments` runs inside the EXISTING `engine.worker.ts`; the import-graph guard forbids a second worker or a main-thread diff.
- UI/privacy (D5, S4, N1 option a): `DiffResult` excerpts are span-aware clipped RAW text plus `sensitiveSpans`; core `diff/` computes spans (core-internal detector helpers) and widens clip bounds so no span is split. The main thread masks at display time with the allow-listed core `mask` (import-graph allow-list already includes `mask`; no other core runtime import) and Reveal toggles it via the existing `revealed` convention in `state/review.ts`. Raw excerpts stay in the browser (no server path). Leak gates (named, non-vacuous, in BOTH packages): core `diff-pairs` case `no-raw-sensitive-digits` asserts the spans cover the seeded synthetic account number and that the masked render contains no run of 4+ raw consecutive digits of it except the mask's last-4; web e2e `diff-pairs` assertion `should not leak sensitive digits in masked diff text` asserts masked by default and Reveal shows it. The seeded sibling generator authors a synthetic non-routable account number (990000017-style, like SYN_ABA) inside a differing clause. Token classes only (source-guard).
- Input failure (N2, N3): neither core `diffDocuments` nor the worker wrapper throws across Comlink for a bad input; core shapes `{ok:false}` side inputs into `{error:{side, stage, code}}` and the worker `prepare` produces those `{ok:false}` inputs from thrown CoreErrors (no document text anywhere in the payload). Compare shows a "Could not read this document" state naming the side (A or B).
- Needs counsel (S5): wired ONLY to findings-delta rows (`stillPresent` and `new`) that are findings of the currently OPEN document, via the existing `useReview().needsCounsel(findingId)` (Phase 03 interim triage; Phase 08 replaces the store behind the same call). Diff-only rows (renames, leftovers, section add/remove/change, definitions, fees) render the "Needs counsel" control DISABLED with tooltip "Available after counsel sheet (Phase 08)". No edit to `state/review.ts` or `features/review/gateInterim.ts`. No "Version drift" question is created in Phase 07; a backlog stub asks Phase 08 to create "Version drift" questions from diff-only rows (see Backlog Stubs).
- Rename inference (D3): aligned-sentence token/short-phrase substitution; a pair is a rename when >= 80% of aligned sentences containing the old term contain the new term in the same position AND count >= 3. No hardcoded pairs: the five #5→#6 renames are goldens only.
- Residual legacy term (diff-only, NOT a Finding): an old-document term that co-occurred with a renamed term and still appears >= 3 times in the new document is reported only as `Possible leftover` with confidence <= 0.4 and severity `low` (AC16).
- Sibling mode never claims legal equivalence: labels are textual (identical after normalization = common).
- AI narrative is optional and clearly labeled "AI summary"; the deterministic diff never depends on it.
- AC29 (D7): end-to-end diff < 3 s inside the worker, INCLUDING both parses, both `runDeterministic` runs, alignment and text diff; record ms for #2 vs #2 and #5 vs #6. Timing stays OUT of `DiffResult` (it would break "same input gives identical output" and the 5-run determinism gate): the worker returns `{result, ms}`; the Node perf test measures with its own timer; the e2e reads ms from a console line `diff-ms <n>` (or a test-only hook) logged by the client. Named risk: F4 (Phase 05 fix) may add CPU cost on the shared engine path.

## Blast Radius

`packages/core/src/diff/**`, `packages/core/src/llm/tasks/drift-narrative.v1.ts` (new), `packages/core/src/index.ts` (append), core tests, `fixtures/diff`, `fixtures/llm-recordings/drift-narrative`, `scripts/src/fixtures/{build-seeded.ts,check.ts}` (additive; Phase 02-owned), `apps/web/src/engine/{engine.worker.ts,client.ts,types.ts}` (additive `diffDocuments` plus a behavior-preserving `prepare` helper extraction; shared with Phase 06, so Phase 06 changes must land first), `apps/web/src/features/{registry.ts (append compare),compare/**}`, `apps/web/test/support/mockupCss.ts` (append slicer), two new e2e specs, and the narrow repairs to `apps/web/e2e/{placeholder-routes,layout-vs-mockup,a11y-smoke}.spec.ts` and `apps/web/src/smoke.test.tsx` (replacing the compare placeholder invalidates their placeholder assertions). `apps/web/test/import-graph.test.ts` is a gate. No Worker (`apps/worker`) changes; narrative goes through the existing `/api/ai`. Sequential with Phase 06 on the engine files (not parallel-safe there).

### Registry update request (Phase 07)

The orchestrator owns `phase-blast-radius-registry.md`; Phase 07 does NOT edit it. Requested additions to `## Phase 07` (append-only, by the orchestrator):
- `scripts/src/fixtures/{build-seeded.ts,check.ts}` — additive edit; Phase 02 owns them; stray-file scan extended to `fixtures/diff`.
- `apps/web/e2e/{placeholder-routes,layout-vs-mockup,a11y-smoke}.spec.ts` and `apps/web/src/smoke.test.tsx` — narrow repair edits (compare placeholder replaced by the real view; derivation, not loosening); Phase 03 owns them.
- `apps/web/src/engine/engine.worker.ts` — behavior-preserving `prepare` helper extraction plus `diffDocuments`; follows Phase 06's format dispatch.

## Data Flow

Two inputs `{bytes, name, kind?}` → in the worker, the shared `prepare(bytes, settings)` helper (same as `analyze`: format dispatch, parse, `buildDocGraph`, `runDeterministic`; a thrown CoreError becomes `{ok:false, stage, code}`) produces each document's per-side input `{ok:true, structure, graph, findings}` | `{ok:false, stage, code}`, which core `diffDocuments` consumes → `normalize-key.ts` + `align.ts` (exact key → LCS → bounded similarity fallback) → per-aligned-pair `diff-text.ts` (jsdiff; `undefined` result → coarse whole-block replace flagged truncated) → extractors (terms, fees, requirements) → rename inference → findings delta (aligned-block matching) → span-aware clipped raw excerpts with `sensitiveSpans` recorded in core → `{result: DiffResult, ms}` (or `{error:{side, stage, code}}` if either side input is `{ok:false}`, stage in `DiffStage`) over Comlink → Compare view (main thread masks with core `mask` at display time; Reveal toggles it using the result's spans). Sibling mode additionally labels clauses common/differing. Narrative: `DiffResult.renames` + sample aligned sentences → `drift-narrative` task (cached; recorded in CI).

## Failure Modes

Restructured docs (#3 vs #4): unmatched sections shown as added/removed, never a crash; empty or single-section documents → "not enough structure to align" message; pair with no changes → "No differences found"; jsdiff returns `undefined` (edit-length or timeout bound exceeded) → coarse whole-block replace flagged `truncated`, deterministic, no throw; an input that cannot be read/parsed (worker `prepare` maps the thrown CoreError code to `{ok:false, stage, code}`; core shapes the `{error}`) → `{error: {side, stage, code}}` and a "Could not read this document" state naming the side (scanned/OCR documents are not offered in the picker); AI narrative unavailable → "AI summary skipped" with reason, deterministic diff unaffected.

## Implementation Checklist

### Step A — Types (07a)
- [ ] A1. `diff/types.ts` zod `DiffResult` (with span-aware raw excerpts, `sensitiveSpans`, `truncated`; NO timing), the `SideInput` union, the `DiffStage` type (`read|parse|structure|detect|diff`, distinct from `StageId`, E20) and the `{error:{side, stage: DiffStage, code}}` shape + contract test (check whether the v1 snapshot test picks it up; if so regenerate with a change note).
- [x] A2. Pre-condition: jsdiff v9 option names and return behavior confirmed — DISCHARGED by the PVL probe on `diff` 9.0.0 (see Library pins). No further action.

### Step B — Engine (07a)
- [ ] B1. `normalize-key.ts` and `align.ts` per D2 (complexity bound test on #2 vs itself; ordinal handling of repeated running headers).
- [ ] B2. `diff-text.ts` using jsdiff `diffWords`/`diffSentences` with `maxEditLength`/`timeout`; handle an `undefined` return (no throw): coarse fallback = whole-block replace (one removed + one added change), `truncated: true`, deterministic; test `should fall back to a coarse diff when jsdiff returns undefined` (force it with a tiny `maxEditLength`).
- [ ] B3. `extract-terms.ts`, `extract-fees.ts` (percent patterns incl. class-specific 3.5% A / 1.5% S), `extract-requirements.ts` (must/required/shall lines).
- [ ] B4. `rename-inference.ts` per D3 (five known renames as goldens, no hardcoded pairs) plus the diff-only residual-term rule.
- [ ] B5. `findings-delta.ts` per D4, `sibling.ts`. All excerpts are span-aware clipped RAW text (clip bounds widened so no sensitive span is split, reusing the structure-view `excerpt()` approach) with `sensitiveSpans` offsets recorded; masking is NOT done in core output (the main thread applies `mask`). Spans are computed on the WHOLE aligned-block raw text and then mapped onto the jsdiff segments (E17). `diffDocuments` shapes `{ok:false}` side inputs into `{error:{side, stage, code}}` without throwing (N3).

### Step C — Tests and fixtures (07a)
- [ ] C0. Fixtures: `fixtures/diff/{sibling-A,sibling-B}.html`, identical pair, empty doc, single-section doc, wired into `fixtures:build` / `fixtures:check` by editing `scripts/src/fixtures/{build-seeded.ts,check.ts}` additively (Phase 02-owned; registry update request above) and extending the stray-file scan in `check.ts` to cover `fixtures/diff` (an unexpected extra file there must fail `fixtures:check`). Seeded sibling expectations are AUTHORED in the generator, not read back from the engine. The sibling generator authors a synthetic non-routable account number (990000017-style, like SYN_ABA) inside a differing clause so the leak gates are non-vacuous.
- [ ] C1. `golden-05-06-drift`: values derived by running the engine on #5/#6 and pinning actual counts/ids/thresholds (no hand-written expected values); both swapped refs fixed; Appendix C removed; renames; fees; drafting note removed and the remaining `[insert …]` placeholder asserted present; §6 Part A Unit class→Share class relabel expected; sections 1–12 and Parts A–D otherwise unchanged. Semantic facts are asserted as named assertions so the test is not a tautology.
- [ ] C2. `golden-06-llc-agreement-lowconf` (LLC Agreement count from engine output); `diff-pairs` unit variants: #3/#4 no crash plus added/removed, identical pair, empty doc, single-section doc, the named leak case `no-raw-sensitive-digits` (asserts `sensitiveSpans` cover the seeded synthetic account number in the sibling differing clause, and that the render after applying core `mask` over those spans has no run of 4+ raw consecutive digits of it except the mask's last-4), and `diff-input-failure` (new core unit test file: a `{ok:false, stage, code}` input on side a and, separately, on side b each make core `diffDocuments` return `{error: {side, stage, code}}` with the correct side, `stage` within `DiffStage`, and a test that no document text appears anywhere in the serialized payload). The worker-side CoreError-to-`{ok:false}` mapping is covered by e2e assertion 8b, not by this core test.
- [ ] C3. `sibling-clause-common-vs-differing` on the seeded fixtures; `diff-determinism` (5 runs equal, `DiffResult` has no timing field).
- [ ] C4. Performance probe per D7 (`diff-perf`, own timer in the test, not in `DiffResult`); record ms for #2 vs #2 and #5 vs #6 (AC29 input).

### Step D — Worker seam (07b)
- [ ] D0. After confirming Phase 06's format dispatch is in `engine.worker.ts`: extract `prepare(bytes, settings)` from `analyze` WITHOUT behavior change (existing `engine-worker-split` and `app-shell` e2e are the regression), then append `EngineApi.diffDocuments(input)` (wire input per Public Contracts; returns `{result, ms}` or `{error: {side, stage, code}}`, never throws for bad input) to `engine.worker.ts`, `client.ts`, `types.ts`; at the same time record which formats Phase 06's dispatch exposes to `prepare` (HTML always; PDF text layer and DOCX only if exposed) and limit the Compare picker to them, excluding scanned/OCR documents; extend/confirm `import-graph` guard stays green (no second worker, no main-thread diff, no main-thread core runtime import beyond the allow-list).

### Step E — Compare UI (07b)
- [ ] E1. `features/compare/**` per `#v-compare` + `compare_NOTES.md`: append `id:'compare'` to `registry.ts`; two-doc picker (bytes from `/samples/<file>` or IndexedDB uploads, mirroring `features/open-document/open-actions.ts`; e2e feeds fixtures and the hostile HTML through the existing upload-input flow, E19), swap, Versions|Siblings toggle (default Versions), stat chips (Added/Removed/Renamed/Changed + Fixed/Still present/New; sibling: common/differing/only in one), change list, clause diff, same-doc "No differences", J/K/Esc, visible loading state and empty state; masked-by-default: the view applies the allow-listed core `mask` to raw excerpts using the result's `sensitiveSpans`, and Reveal toggles it via the existing `revealed` state convention (no other core runtime import on the main thread); a "Could not read this document" state naming side A or B when `diffDocuments` returns `{error}`; picker lists only formats the worker `prepare` handles (no scanned/OCR); "Needs counsel" per the Needs counsel contract (enabled only on findings-delta rows of the open document via `needsCounsel(findingId)`; disabled with tooltip "Available after counsel sheet (Phase 08)" on diff-only rows); worker-measured ms logged as console line `diff-ms <n>`.
- [ ] E2. Append a Compare slicer to `apps/web/test/support/mockupCss.ts` BEFORE the layout-vs-mockup spec is repaired/run (E15); token-class-only (source-guard green). Note `apps/web/src/smoke.test.tsx` must append `'compare'` AFTER `'structure'` in the id array (E16, see G4).
- [ ] E3. `diff-pairs.spec.ts` and `sibling-clauses.spec.ts` with these assertions listed explicitly:
  - `diff-pairs.spec.ts`: (1) swap reverses direction (added/removed counts exchange); (2) Versions is the default mode on load (D-6); (3) Versions|Siblings toggle switches mode and chips; (4) same document picked twice shows "No differences"; (5) #3 vs #4 renders with no crash and shows added/removed; (6) J/K moves selection through the change list, Esc closes/clears; (7) loading state is visible while the diff runs and the empty state shows before a pair is chosen; (8) text is masked by default (main-thread `mask` over `sensitiveSpans`), `should not leak sensitive digits in masked diff text` asserts no 4+ raw digit run of the seeded synthetic account number in the DOM before Reveal (except the mask's last-4), and Reveal shows it; (8b) input failure (worker mapping): an HTML file nested beyond MAX_PARSE_DEPTH (same hostile shape as `apps/web/e2e/hostile-html.spec.ts`), uploaded on one side through the existing upload-input flow, makes the worker `prepare` map the thrown CoreError to `{ok:false, stage, code}` and Compare shows "Could not read this document" naming that side; deterministic trigger, never random bytes (fallback only if the hostile-HTML trigger proves unusable: extend the E2E fail hook with a `side` param); (9) Needs counsel is ENABLED on a findings-delta row of the open document and DISABLED (tooltip "Available after counsel sheet (Phase 08)") on a diff-only row; (10) worker timing: the logged `diff-ms` for #5 vs #6 is < 3000 and the value is recorded in the report.
  - `sibling-clauses.spec.ts`: Siblings mode on the seeded pair shows common / differing / only-in-one chips and clause labels; an unchanged clause is labeled common.

### Step F — AI narrative (07c, conditional on Phase 05 verified)
- [ ] F1. `drift-narrative.v1` task with recorded response for #5→#6 (at most 3 free live recordings); test that narrative text only states renames present in `DiffResult.renames`; the narrative inputs (renames plus sample aligned sentences) are built from MASKED and clipped excerpts, with an assertion that no raw sensitive span text and no 4+ raw digit run reaches the task input (E18). If Phase 05 is not verified: write backlog stub; AC15 H-part stays CONDITIONAL.

### Step G — Compare placeholder test repairs (07b, S2; derivation not loosening)
- [ ] G1. `apps/web/e2e/placeholder-routes.spec.ts`: remove the `['compare','Compare versions']` placeholder row and add a test "compare is no longer a placeholder" (the Compare view is shown, `placeholder-view` is absent).
- [ ] G2. `apps/web/e2e/layout-vs-mockup.spec.ts`: after `nav-compare` assert the real Compare view instead of `placeholder-view`.
- [ ] G3. `apps/web/e2e/a11y-smoke.spec.ts`: keep the axe audit but point the former `nav-compare` "placeholder" audit at the real Compare view (rename), and add a placeholder audit on another still-placeholder id (`counsel`, `memory` or `documents`, whichever is still a placeholder).
- [ ] G4. `apps/web/src/smoke.test.tsx`: append `'compare'` AFTER `'structure'` in the exact `features.map(f => f.id)` array (E16); label and nav order are unchanged because the id keeps its first (placeholder) registration position.

### Backlog Stubs (written by EXECUTE/UPDATE PROCESS, not by this plan)
- [ ] `process/general-plans/backlog/drift-narrative-live-quality_NOTE_17-10-26.md` — live-model narrative quality (AC15 H part Known-Gap; test-building stub; gate stays CONDITIONAL).
- [ ] `process/general-plans/backlog/compare-ocr-documents_NOTE_17-10-26.md` — Compare for scanned/OCR documents (OCR runs on the main thread in Phase 06; out of scope here; recorded as a Phase 07 deviation).
- [ ] `process/general-plans/backlog/phase08-version-drift-questions_NOTE_17-10-26.md` — ask Phase 08 to create "Version drift" counsel questions from diff-only rows (renames, leftovers, section add/remove/change) and enable the Needs counsel control on them.

## Test Gates (commands created in this phase)

Command rules: `pnpm --filter <pkg> test <token>`, NO `--`, one token per call; every token must match more than 0 files. Core gates use the plain `test` script ONLY: `test:golden <token>` is unsafe because `test:golden` is `vitest run test/golden` and vitest ORs the filters, so an unmatched token still exits 0 (reproduced: 44 tests pass). Verified filter behavior: `pnpm --filter @aduin/core test <token>` and `pnpm --filter @aduin/web test <token>` run `vitest run <token>` and exit 1 on no match; `pnpm --filter @aduin/web test:e2e <token>` runs `playwright test --project=preview <token>` and exits 1 ("No tests found") on no match. Web vitest `include` is `test/**/*.test.ts` and `src/**/*.test.{ts,tsx}`.

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| drift golden | `pnpm --filter @aduin/core test golden-05-06-drift` | Fully-Automated | AC15 |
| low confidence | `pnpm --filter @aduin/core test golden-06-llc-agreement-lowconf` | Fully-Automated | AC16 |
| sibling | `pnpm --filter @aduin/core test sibling-clause-common-vs-differing` | Fully-Automated | AC19 |
| determinism | `pnpm --filter @aduin/core test diff-determinism` | Fully-Automated | AC19 |
| pairs unit (incl. `no-raw-sensitive-digits`) | `pnpm --filter @aduin/core test diff-pairs` | Fully-Automated | AC19, D5 privacy |
| input failure (core shaping, sides a and b, no text in payload) | `pnpm --filter @aduin/core test diff-input-failure` | Fully-Automated | AC19 (bad input handled, N2/N3) |
| input failure (worker CoreError mapping, hostile HTML via upload-input, e2e 8b) | `pnpm --filter @aduin/web test:e2e diff-pairs` | Fully-Automated | AC19 (bad input handled, N3) |
| perf | `pnpm --filter @aduin/core test diff-perf` (and web worker timing in e2e) | Fully-Automated | AC29 |
| e2e pairs | `pnpm --filter @aduin/web test:e2e diff-pairs` | Fully-Automated | AC19 |
| e2e sibling | `pnpm --filter @aduin/web test:e2e sibling-clauses` | Fully-Automated | AC19 |
| import graph | `pnpm --filter @aduin/web test import-graph` | Fully-Automated | D1 seam |
| source guard | `pnpm --filter @aduin/web test source-guard` | Fully-Automated | D5 tokens |
| narrative | `pnpm --filter @aduin/core test drift-narrative` (recorded; 07c; precondition Phase 05 VERIFIED) | Hybrid | AC15 (H part) |
| live narrative quality | — (no automated gate) | Known-Gap (named residual; backlog stub `drift-narrative-live-quality_NOTE_17-10-26.md`; AC15 H part stays CONDITIONAL) | AC15 (residual) |
| regression core | `pnpm --filter @aduin/core test:golden` then `pnpm --filter @aduin/core test:corpus` (bare scripts, regression only; no token) | Fully-Automated | earlier phases |
| regression web | `pnpm --filter @aduin/web test:e2e app-shell` then `pnpm --filter @aduin/web test:e2e structure-view` | Fully-Automated | earlier phases (replaces the nonexistent `slice` token) |
| regression placeholder routes | `pnpm --filter @aduin/web test:e2e placeholder-routes` | Fully-Automated | Step G1 repair |
| regression layout | `pnpm --filter @aduin/web test:e2e layout-vs-mockup` | Fully-Automated | Step G2 repair |
| regression a11y | `pnpm --filter @aduin/web test:e2e a11y-smoke` | Fully-Automated | Step G3 repair |
| regression registry unit | `pnpm --filter @aduin/web test smoke` | Fully-Automated | Step G4 repair |
| guards | `pnpm guard:cf` then `pnpm secrets:scan` | Fully-Automated | safety |

Failing stubs for red-first: `should report both swapped references as fixed between 5 and 6`, `should report Appendix C removed`, `should show no differences for the same document picked twice`, `should not leak sensitive digits in masked diff text`, `should infer Units to Shares as a rename`, `should label an unchanged clause common in sibling mode`, `should say no differences for an identical pair`, `should not report LLC Agreement above low confidence`, `should fall back to a coarse diff when jsdiff returns undefined`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm --filter @aduin/core test golden-05-06-drift` | Fully-Automated | AC15 |
| `pnpm --filter @aduin/core test drift-narrative` (recorded; conditional on Phase 05) | Hybrid | AC15 (H part) |
| live-model narrative quality (named residual, backlog stub) | Known-Gap | AC15 (residual; keeps H part CONDITIONAL) |
| `pnpm --filter @aduin/core test golden-06-llc-agreement-lowconf` | Fully-Automated | AC16 |
| `pnpm --filter @aduin/web test:e2e diff-pairs`, `pnpm --filter @aduin/core test sibling-clause-common-vs-differing`, `diff-determinism`, `diff-pairs` | Fully-Automated | AC19 |
| `pnpm --filter @aduin/core test diff-perf` (< 3 s worker, ms recorded for #2/#2 and #5/#6) | Fully-Automated | AC29 |
| `pnpm --filter @aduin/core test diff-input-failure` (core shaping) + e2e `diff-pairs` assertion 8b (worker mapping, hostile HTML via upload-input) | Fully-Automated | AC19 (bad input handled) |
| `no-raw-sensitive-digits` (core `diff-pairs`) and `should not leak sensitive digits in masked diff text` (web e2e `diff-pairs`) | Fully-Automated | D5 privacy |

Known-Gap note: live-model narrative quality is a named residual; it is NOT a proving strategy. Its gate stays CONDITIONAL with a backlog stub (also when Phase 05 is unverified).

```bash
pnpm --filter @aduin/core test golden-05-06-drift
pnpm --filter @aduin/core test sibling-clause-common-vs-differing
pnpm --filter @aduin/web test:e2e diff-pairs
# Expected: each exits 0 (run one token per call)
```

## Exit Gate

- All gates green; diff timings recorded; renames and thresholds recorded with corpus evidence.
- Phase report written.

## Risks and Kill Criteria

- Alignment quality on restructured docs (#3/#4): fallback to heading-sequence LCS plus unmatched lists; AC19 only requires no crash and correct added/removed.
- Rename heuristic over-fires: thresholds tuned on #5/#6 only; residual-term rule capped low so AC16 holds.
- AC29 CPU budget: F4 (Phase 05 fix) may slow the shared engine path; timings recorded per D7.
- Shared engine files with Phase 06: Phase 07 EXECUTE must follow Phase 06 landing; append-only edits plus the behavior-preserving `prepare` extraction.
- Replacing the compare placeholder breaks four existing tests: repaired in Step G by derivation, regression-gated.
- No true feeder pair: sibling labeling demonstrated on #3–#6 plus seeded fixtures (documented limitation).

## Cost / Secret Hygiene

Deterministic diff has no network. The narrative task uses recorded responses in CI; any live recording is free-model only under an APPROVED-LIVE cap (≤ 3 requests); no paid calls; PDFs never sent; keys never printed; Cloudflare untouched.

## Rollback

`git revert` phase commits; the Compare view reverts to the Phase 03 `#compare` placeholder when `id:'compare'` is removed from `registry.ts` (and the Step G test repairs revert with the same commit).

## Blockers That Would Justify BLOCKED Status

- #5/#6 golden facts cannot be reproduced deterministically (e.g. alignment fails on real documents) and need user input on acceptable heuristics.
- Phase 05 task framework API changed incompatibly (contract-change note).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [x] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [x] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [x] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [x] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S4, S7 (20+ files) → 2/7 MEDIUM. Recommended (D8): sequential single agent, split 07a core diff + goldens, 07b worker seam + Compare UI + e2e, 07c narrative (conditional). Sonnet for research/validation, opus for code execution. Order 05 → 06 → 07.

## Test Infra Improvement Notes

- Add a Compare slicer to `apps/web/test/support/mockupCss.ts` (planned, E2).
- Gate commands must use the no-`--`, one-token-per-call form; tokens must match >0 files. Core gates use `test <token>`, never `test:golden <token>` (vitest ORs filters, so an unmatched token passes vacuously).
- `fixtures:check` stray-file scan is extended to `fixtures/diff` (C0).

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-07-version-diff_PLAN_17-10-26.md`
- Last completed step: inner-loop steps 1-3 (research, innovate, plan-supplement) done 2026-10-17; PVL supplement cycles 1 (9 gaps), 2 (2 gaps) and 3 (1 gap, N3) applied; re-validate from V1 next
- Validate-contract status: pending re-validation (first-pass CONDITIONAL; supplement cycle 1 applied)
- Next Step: spawn vc-validate-agent (inner PVL re-run from V1). EXECUTE only after Phase 06 engine changes have landed. Phase 08 consumes the findings delta only for display, not as a dependency of the gate.

## Inner Loop Refresh Note

Date: 2026-10-17. Inner-loop PLAN-SUPPLEMENT folded RESEARCH and INNOVATE decisions D1-D8 into this plan.
- D1: core diff in `packages/core/src/diff/`, run via `EngineApi.diffDocuments` in the existing engine worker; zod `DiffResult`.
- D2: normalized-key alignment (exact → LCS → bounded similarity). D3: rename inference without hardcoded pairs; leftover is diff-only. D4: aligned-block findings delta replaces `detector_id + quote_hash`.
- D5: UI per `app.html #v-compare` + `compare_NOTES.md` (diff.html step deleted); registry id `compare`; masked by default; Needs counsel via Phase 03 interim state.
- D6: fixtures and goldens (engine-derived values; AC15/AC16 wording corrected). D7: AC29 < 3 s end-to-end. D8: sequential 07a/07b/07c, order 05→06→07.
- Gates rewritten to `pnpm --filter <pkg> test <token>` (no `--`); `slice` regression token replaced by existing specs `app-shell`/`structure-view`. jsdiff v9 option names are an EXECUTE pre-condition (A2).

### PVL supplement cycle 1 (2026-10-17)

Applied the validator's SUPPLEMENT REQUEST (9 CONCERN gaps, 0 FAIL). Plan sections touched: Acceptance Criteria, Entry Gate, Library pins, Touchpoints, Public Contracts, Blast Radius (+ Registry update request subsection), Data Flow, Failure Modes, Implementation Checklist (A1, A2, B2, B5, C0-C4, D0, E1-E3, new Step G, Backlog Stubs), Test Gates, Verification Evidence, Risks, Rollback, Test Infra Improvement Notes, Resume and Execution Handoff. The Validate Contract section is left untouched for the re-validation pass.
- S1: `drift golden` / `low confidence` gates now `pnpm --filter @aduin/core test <token>`; `test:golden` kept only as a bare regression row. Verified no other `test:<script> <token>` form ignores its filter: web `test` (`vitest run`) and `test:e2e` (`playwright test --project=preview`) both fail on an unmatched token; the rest are bare scripts.
- S2: Step G repairs for `placeholder-routes`, `layout-vs-mockup`, `a11y-smoke` specs and `src/smoke.test.tsx`; four new regression gate rows; registry update request subsection (registry itself not edited).
- S3: `diffDocuments` wire input `{a:{bytes,name,kind?}, b:{bytes,name,kind?}, mode}`; shared `prepare(bytes, settings)` helper in `engine.worker.ts` after Phase 06; Compare accepts whatever `analyze` accepts.
- S4: masking inside core; `DiffResult` carries masked excerpts plus `sensitiveSpans`; named leak tests `no-raw-sensitive-digits` (core `diff-pairs`) and `should not leak sensitive digits in masked diff text` (web e2e).
- S5: Needs counsel limited to findings-delta rows of the open document via `needsCounsel(findingId)`; diff-only rows disabled with tooltip; no `state/review.ts` change; Phase 08 backlog stub.
- S6: `scripts/src/fixtures/{build-seeded,check}.ts` added as additive touchpoints; stray-file scan extended to `fixtures/diff`.
- S7: e2e assertions listed in E3; timing kept OUT of `DiffResult` (`{result, ms}` wrapper, `diff-ms` console line).
- S8: B2 handles jsdiff returning `undefined` (coarse fallback, `truncated`, test); A2 marked discharged by the probe.
- S9: `golden-06-llc-agreement-lowconf` relabeled Fully-Automated; `diff-pairs-e2e` replaced by `test:e2e diff-pairs`; live-narrative quality added as a Known-Gap row with backlog stub (CONDITIONAL, never a PASS-able proving strategy).

### PVL supplement cycle 2 (2026-10-17)

Applied the cycle-1 re-validate SUPPLEMENT REQUEST (CONDITIONAL, 2 CONCERN gaps N1, N2; 0 FAIL; trend 9 to 2) using orchestrator decisions. Sections touched: Public Contracts (DiffResult, wire input, UI/privacy, new Input failure bullet), Data Flow, Failure Modes, Touchpoints (test list), Implementation Checklist (B5, C0, C2, D0, E1, E2, E3 item 8/8b, G4, Backlog Stubs), Test Gates, Verification Evidence, Resume and Execution Handoff. The Validate Contract section is untouched.
- N1: Reveal vs lossy masking resolved as option (a), matching the Findings convention: `DiffResult` carries span-aware clipped RAW excerpts (clip bounds widened so no span is split) plus `sensitiveSpans`; the main thread masks at display time with the allow-listed core `mask` and Reveal toggles it via `revealed`. Raw excerpts never leave the browser. Leak gates made non-vacuous: the seeded sibling generator authors a synthetic non-routable account number (990000017-style) in a differing clause; core `diff-pairs` asserts spans cover it and the masked render has no 4+ raw consecutive digits except the mask's last-4; web e2e `diff-pairs` asserts masked by default and Reveal shows it.
- N2: `diffDocuments` returns `{result, ms}` or `{error: {side, stage, code}}` (no document text); Compare shows "Could not read this document" naming the side; new core test `diff-input-failure` plus e2e assertion 8b. Picker limited to formats the in-worker `prepare` handles (HTML minimum; PDF text layer and DOCX only if Phase 06's dispatch exposes them); scanned/OCR documents out of scope for Compare (OCR is main-thread in Phase 06), recorded as a deviation with backlog stub `compare-ocr-documents_NOTE_17-10-26.md` (written at EXECUTE/UPDATE).
- E15/E16 kept: Compare slicer in `mockupCss.ts` lands before the layout-vs-mockup spec (E2); `'compare'` appended after `'structure'` in the `smoke.test.tsx` id array (G4).

### PVL supplement cycle 3 (2026-10-17)

Applied the cycle-2 re-validate SUPPLEMENT REQUEST (CONDITIONAL, 1 CONCERN gap N3; 0 FAIL; trend 9 to 2 to 1) using the validator's suggestion. Sections touched: Public Contracts (core entry, wire input, Input failure, DiffResult span note), Data Flow, Failure Modes, Implementation Checklist (A1, B5, C2, E1, E3 8b, F1), Test Gates, Verification Evidence, Resume and Execution Handoff. The Validate Contract section is untouched.
- N3: core `diffDocuments` takes per-side inputs `{ok:true, structure, graph, findings} | {ok:false, stage, code}` and returns `{result}` or `{error:{side, stage, code}}`; the worker `prepare(bytes, settings)` maps a thrown CoreError (code only, never message text) to `{ok:false, stage, code}` and the worker wraps with `ms`. `DiffStage` (`read|parse|structure|detect|diff`) is its own type, distinct from `StageId`. Core test `diff-input-failure` covers shaping for side a and side b plus no document text in the payload; e2e 8b covers the worker mapping via HTML nested beyond MAX_PARSE_DEPTH uploaded through the upload-input flow (E2E fail hook with a `side` param only as fallback; never random bytes).
- E17-E20 reflected: spans computed on whole aligned-block raw text then mapped to jsdiff segments (B5, Public Contracts); drift-narrative inputs masked and clipped with an assertion (F1); e2e uses upload-input for fixtures/diff and hostile HTML (E1, E3 8b); DiffStage type (A1).

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: inner-pvl: phase-07
supersedes: 2026-10-17 (inner-pvl: phase-07) — cycle-2 re-validate contract (CONDITIONAL, single gap N3: diff-input-failure seam and trigger); this is the re-validation after PVL supplement cycle 3

Parallel strategy: sequential (one opus execute agent for 07a core diff, 07b worker seam and Compare UI, 07c narrative); sonnet for the EVL tester. No agent team and no parallel fix agents: the work shares `packages/core/src/index.ts`, `engine.worker.ts`, `client.ts`, `types.ts` and `registry.ts` with Phases 05 and 06, which must land first (order 05 then 06 then 07).
Rationale: 2/7 signals (S1 core + web + scripts, S7 20+ files); dominant signal S7. The files are seam files serialized by the orchestrator, so there is no disjoint blast radius to partition. Layer 1 and Layer 2 checks were run as read-only inspections of the real code in this pass (no spawned dimension agents were available to this subagent); each finding cites the file it comes from. Models: sonnet for validation and EVL, opus only for the code-execution leg.

PVL cycle: 3 of 10 (first pass: 9 gaps; cycle-1 re-validate: 2 gaps; cycle-2 re-validate: 1 gap; cycle-3 re-validate: 0 gaps; trend 9 -> 2 -> 1 -> 0). PVL supplement cycles 1, 2 and 3 are recorded in the plan and in `results.tsv`.

Re-validation evidence (this pass, against the real working tree; phases 00-04b DONE, 05 and 06 not yet executed):
- `validate-plan-artifact.mjs` on the full repo-relative path: 0 failures, 0 warnings (431 lines).
- Cycle-1 gaps S1-S9 and cycle-2 gaps N1, N2 stay resolved (no new evidence against them).
- N3 (core vs worker error ownership, deterministic trigger) RESOLVED in plan text and verified against code. Plan text: Public Contracts core entry takes per-side `SideInput = {ok:true, structure, graph, findings} | {ok:false, stage: DiffStage, code}` and returns `{result}` or `{error:{side, stage, code}}`, never throwing for a failed side; the worker `prepare(bytes, settings)` maps a thrown CoreError (code only) to `{ok:false}`; A1 defines `DiffStage`; B5 shapes errors in core; C2 `diff-input-failure` tests the shaping for side a and side b plus "no document text in the serialized payload"; E3 8b covers the worker mapping end to end; Data Flow, Failure Modes, Test Gates and Verification Evidence agree. A pure core function now owns the shaping, so the core gate is reachable and not a test of a hand-written literal (the `{ok:false}` input is the function's documented input type). Code checks: (1) `packages/core/src/model/errors.ts` `CoreError` has `readonly code: ErrorCode` and is exported from `packages/core/src/index.ts`; `ErrorCode` (`contracts/errors.ts`) includes `payload_too_large`. (2) `packages/core/src/adapters/html.ts` exports `MAX_PARSE_DEPTH = 16384` and `onopentag` throws `CoreError('payload_too_large')` once open-element depth reaches it; `packages/core/test/security/nesting-dos.test.ts` proves the case (`'<div>a'.repeat(80000)` is rejected with `payload_too_large`), so the trigger is deterministic and about 100 KB, below `limits.maxUploadBytes` (10 MB, `config/limits.ts`). (3) `apps/web/e2e/hostile-html.spec.ts` supplies the upload flow and file shape (`getByTestId('upload-input').setInputFiles({name, mimeType, buffer})`, then fund, privacy-ack, `open-submit`); its payload is inert-text hostile markup, not nested, so the plan's phrase "same hostile shape" is loose wording only (the real trigger precedent is `nesting-dos.test.ts`); carried as execute instruction E21, not a gap. `investor-path-view.spec.ts` line 47 confirms the `upload-input` precedent. (4) `open-actions.ts` `openUpload` writes the file to IndexedDB before `analyze`, so a file whose analysis fails still appears in the Compare picker (the 8b flow works). (5) `engine.worker.ts` `analyze` uses a bare `catch {}` and an E2E-only `shouldFail` hook; the new `prepare` must capture `e.code` itself, carried as E22 (extraction without behavior change). (6) The existing `StageId` is `read|structure|checks|ai|done` (`engine/types.ts`), so a separate `DiffStage` type is correct (E20).
- No new gaps: every other contract line re-read against the plan; Step G repairs, registry append, Compare slicer, leak gates, jsdiff `undefined` fallback and gate command forms are consistent.

Plan updates required: none. All plan fixes are applied; remaining items are execute-agent instructions (E1-E22) and named residuals.

Test gates (C3 5-column table; legacy line form below). Command form (program-wide rule, tests/all-tests.md): `pnpm --filter <pkg> test <token>`, NO `--`, ONE token per call, an unmatched token must exit 1. For core gates the plain `test` script is the only form that satisfies this (`test:golden <token>` is NOT safe: vitest ORs the filters). Create test files named exactly as the tokens. gap-resolution: A = proven now, B = added by this plan's checklist or its supplement, C = deferred to a named later phase, D = backlog test-building stub.

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC15 | #5 to #6: both swapped refs reported fixed; Appendix C removed (references to it fall to 0); five renames inferred with counts and no hardcoded pair list; class fees 3.5% Class A and 1.5% Class S; drafting note removed while the remaining `[insert ...]` placeholder is still present; sections 1-12 and Parts A-D unchanged except the expected Part A of section 6 relabel Unit class to Share class; findings delta fixed / still present / new | Fully-Automated | `pnpm --filter @aduin/core test golden-05-06-drift` | B |
| AC15 (narrative) | the recorded "AI summary" only states renames present in `DiffResult.renames`; deterministic diff never depends on it | Hybrid | `pnpm --filter @aduin/core test drift-narrative`; precondition: Phase 05 task framework VERIFIED (else no test, backlog stub) | C |
| AC15 (residual) | live-model narrative quality | none (named residual row, not a proving strategy) | — (backlog stub `drift-narrative-live-quality_NOTE_17-10-26.md`) | D |
| AC16 | "LLC Agreement" retained in #6 (count from engine output) appears only as diff-only `Possible leftover`, confidence below 0.5 and at most 0.4 by the plan rule, severity low, never a Finding | Fully-Automated | `pnpm --filter @aduin/core test golden-06-llc-agreement-lowconf` | B |
| AC19 | #3 vs #4 does not crash and reports added/removed; identical pair says "no differences"; empty document and single-section document give "not enough structure to align" | Fully-Automated | `pnpm --filter @aduin/core test diff-pairs` | B |
| AC19 | sibling mode labels every clause common / differing / only_a / only_b on the seeded sibling pair; "common" means identical after normalization, never legal equivalence | Fully-Automated | `pnpm --filter @aduin/core test sibling-clause-common-vs-differing` | B |
| AC19 | `diffDocuments` is deterministic: 5 runs on the same pair are deep-equal and sorted; `DiffResult` carries no timing | Fully-Automated | `pnpm --filter @aduin/core test diff-determinism` | B |
| AC19 (input failure) | a side that cannot be read/parsed/structured/checked yields `{error: {side, stage, code}}` naming the right side with no document text; the Compare view shows "Could not read this document" naming the side | Fully-Automated | `pnpm --filter @aduin/core test diff-input-failure` (core shaping of per-side `{ok:false, stage, code}` inputs, sides a and b, no document text in the payload) plus e2e `diff-pairs` assertion 8b (worker `prepare` maps the thrown CoreError code to `{ok:false}`; deterministic trigger: HTML nested beyond MAX_PARSE_DEPTH delivered through `upload-input`) | B |
| AC29 | end-to-end diff under 3 s including both parses, both `runDeterministic` runs, alignment and text diff; ms recorded for #2 vs #2 and #5 vs #6 | Fully-Automated | `pnpm --filter @aduin/core test diff-perf` (Node) plus worker-measured ms asserted in `pnpm --filter @aduin/web test:e2e diff-pairs` | B |
| AC19, D5 | Compare screen: picker and swap (direction reverses), Versions default on load, Versions/Siblings toggle, stat chips, change list, clause diff, same-document "No differences", #3 vs #4 renders, J/K/Esc, loading and empty states, masked by default and Reveal shows the raw value, Needs counsel on a delta row | Fully-Automated | `pnpm --filter @aduin/web test:e2e diff-pairs` | B |
| AC19 | sibling mode in the UI: common / differing / only-in-one chips and clause labels on the seeded pair | Fully-Automated | `pnpm --filter @aduin/web test:e2e sibling-clauses` | B |
| D5 privacy | masked diff excerpts leak no sensitive digit run (core: spans cover the seeded number and the masked render has no 4+ raw digit run except the mask's last-4; web DOM before Reveal) on a pair that actually contains the synthetic account number | Fully-Automated | `no-raw-sensitive-digits` inside core `diff-pairs`; `should not leak sensitive digits in masked diff text` inside web `diff-pairs.spec.ts` | B |
| D1 seam | no second worker, no main-thread diff, only `engine.worker.ts` imports core diff values | Fully-Automated | `pnpm --filter @aduin/web test import-graph` | A |
| D5 tokens | token classes only, no hex colors, no raw HTML in `features/compare/**` | Fully-Automated | `pnpm --filter @aduin/web test source-guard` | A |
| regression (core) | earlier engine behavior unchanged (goldens, corpus) | Fully-Automated | `pnpm --filter @aduin/core test:golden` then `pnpm --filter @aduin/core test:corpus` (bare scripts) | A |
| regression (web unit) | feature registry still lists `compare` with the same label and nav order after the append | Fully-Automated | `pnpm --filter @aduin/web test smoke` (after the Step G4 repair) | B |
| regression (web e2e) | earlier screens and the repaired compare tests stay green | Fully-Automated | `pnpm --filter @aduin/web test:e2e app-shell`, `structure-view`, `placeholder-routes`, `layout-vs-mockup`, `a11y-smoke` (one call each) | B |
| safety | Cloudflare guard and secret scan | Fully-Automated | `pnpm guard:cf` then `pnpm secrets:scan` | A |

Failing stubs (red-first; Fully-Automated rows only; copy verbatim into the test files):
- `test("should report both swapped references as fixed between 5 and 6", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should report both swapped references as fixed between 5 and 6") })`
- `test("should report Appendix C removed", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should report Appendix C removed") })`
- `test("should infer Units to Shares as a rename", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should infer Units to Shares as a rename") })`
- `test("should not infer a rename below 80 percent coverage or fewer than 3 occurrences", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should not infer a rename below 80 percent coverage or fewer than 3 occurrences") })`
- `test("should not report LLC Agreement above low confidence", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should not report LLC Agreement above low confidence") })`
- `test("should say no differences for an identical pair", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should say no differences for an identical pair") })`
- `test("should not crash on samples 3 and 4 and list unmatched sections as added or removed", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should not crash on samples 3 and 4 and list unmatched sections as added or removed") })`
- `test("should answer not enough structure for an empty or single-section document", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should answer not enough structure for an empty or single-section document") })`
- `test("should align repeated running headers by ordinal", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should align repeated running headers by ordinal") })`
- `test("should fall back to a coarse diff when jsdiff returns undefined", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should fall back to a coarse diff when jsdiff returns undefined") })`
- `test("should label an unchanged clause common in sibling mode", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should label an unchanged clause common in sibling mode") })`
- `test("should produce identical output across five runs", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should produce identical output across five runs") })`
- `test("should finish a 5 vs 6 diff in under 3 seconds", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should finish a 5 vs 6 diff in under 3 seconds") })`
- `test("should show no differences for the same document picked twice", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should show no differences for the same document picked twice") })`
- `test("should reverse added and removed when the pair is swapped", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should reverse added and removed when the pair is swapped") })`
- `test("should not leak sensitive digits in masked diff text", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should not leak sensitive digits in masked diff text") })`
- `test("should name side A when input A cannot be read", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should name side A when input A cannot be read") })`
- `test("should name side B when input B cannot be read", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should name side B when input B cannot be read") })`
- `test("should add a findings-delta row to counsel questions via the existing triage", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should add a findings-delta row to counsel questions via the existing triage") })`
- `test("should keep compare registered with the same label after the registry append", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should keep compare registered with the same label after the registry append") })`
- `test("should show a could-not-read state naming the side for a deeply nested upload", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should show a could-not-read state naming the side for a deeply nested upload") })`

Legacy line form:
- core diff (AC15, AC16, AC19, AC29): [Fully-automated: `pnpm --filter @aduin/core test golden-05-06-drift`, `golden-06-llc-agreement-lowconf`, `sibling-clause-common-vs-differing`, `diff-determinism`, `diff-pairs`, `diff-input-failure`, `diff-perf` (one call each)] | [hybrid: `pnpm --filter @aduin/core test drift-narrative` + precondition Phase 05 verified] | [known-gap: live-model narrative quality, documented]
- Compare UI (AC19, D5): [Fully-automated: `pnpm --filter @aduin/web test:e2e diff-pairs`, `sibling-clauses`, `pnpm --filter @aduin/web test import-graph`, `source-guard`, `smoke`] | [agent-probe: design match of the Compare screen against `app.html #v-compare` (opt-in `DESIGN_PROBE=1` design-probe spec)]
- regression: [Fully-automated: `pnpm --filter @aduin/core test:golden`, `test:corpus`; `pnpm --filter @aduin/web test:e2e app-shell`, `structure-view`, `placeholder-routes`, `layout-vs-mockup`, `a11y-smoke`; `pnpm guard:cf`; `pnpm secrets:scan`]

Execute-agent instructions (non-gating; the plan text plus the supplement plus these are the contract):
- E1 (order): start 07a only after Phase 05 and Phase 06 have been EXECUTED and committed by the orchestrator or when the orchestrator explicitly serializes; start 07b only after Phase 06's `engine.worker.ts` format dispatch has landed (check the file contains the dispatch, then append, never fork it). Start 07c only if the Phase 05 report says VERIFIED and `packages/core/src/llm/` exists; read the ACTUAL Phase 05 task API first.
- E2 (gate form): `pnpm --filter @aduin/core test <token>` for every core gate; never `test:golden <token>`. D0 check per token: run it before its test file exists (must exit 1), then after (must exit 0). One token per call.
- E3 (jsdiff 9.0.0): `maxEditLength` and `timeout` make `diffWords`/`diffSentences` return `undefined`; treat as the coarse-replace fallback, flagged truncated, deterministic; test it.
- E4 (wire): follow the plan's wire definition; the worker has no parsed-document cache, so `diffDocuments` parses and runs `runDeterministic` for both inputs itself. `analyze` behavior and its `htmlToLines`/`buildDocGraph`/`runDeterministic` imports must stay as the import-graph test expects. No second worker, no main-thread diff. Keep `analyze`'s stage reports and failure path intact when extracting `prepare`.
- E5 (masking, per the resolved N1 option a): the main thread never imports `maskThenClip`, `sensitiveSpans` or the `DiffResult` zod schema as a value (type-only imports allowed); `mask` is the only allow-listed masking value. `sensitiveSpans` offsets are into the exact raw excerpt string the view renders: compute them on the final clipped excerpt (after clip widening) and keep any "…" ellipsis outside the spanned string or shift offsets, so `mask(excerpt, spans)` is correct.
- E6 (determinism): timing stays out of `DiffResult` (`{result, ms}` wrapper).
- E7 (fixtures): extend the `scripts/src/fixtures` seeded generator and `check.ts` additively and prettier-clean; seeded sibling expectations are AUTHORED in the generator; the #5/#6 golden pins counts, ids and thresholds from engine output but asserts the semantic facts as named assertions.
- E8 (repairs): update the four existing tests by derivation, not loosening (Step G).
- E9 (Needs counsel): `useReview().needsCounsel(findingId)` only for findings-delta rows of the OPEN document; no edit to `state/review.ts` or `gateInterim.ts`.
- E10 (live calls): APPROVED-LIVE for Phase 07 = at most 3 free-model requests, only to record the `drift-narrative` response on the public SEC samples #5/#6, only after Phase 05 is VERIFIED, masked and clipped input, through `/api/ai`. Any other live call, any paid call, any PDF upload, any `git push`, any Cloudflare touch beyond the guards is a hard stop. No `apps/worker` edits.
- E11 (untrusted text): render diff text through React text nodes only; clip excerpts; no raw document text in logs.
- E12 (picker bytes): read sample bytes from `/samples/<file>` and uploads from IndexedDB the way `features/open-document/open-actions.ts` does; reuse or mirror inside `features/compare/**`; do not edit Phase 03 files outside the touchpoints.
- E13 (AC29 risk): record ms for #2 vs #2 and #5 vs #6 in the phase report; if Phase 05's F4 fix threatens 3 s, report a CONCERN with numbers, do not relax the bound.
- E14 (e2e cost): each `test:e2e` call rebuilds the preview (3-6 s); one token per call.
- E15 (style audit): `layout-vs-mockup` runs the computed-style audit on the real Compare view after Step G2; append the Compare slicer to `mockupCss.ts` (E2) BEFORE running that spec, derive its vocabulary from `app.html #v-compare`, do not loosen the audit.
- E16 (smoke.test.tsx): append `'compare'` after the existing trailing `'structure'` entry in the id array; do not reorder.
- E17 (word-level masking): the clause diff view renders jsdiff change segments. Do NOT run `sensitiveSpans` per segment: a number split across segments (for example `021 000 021` where only the last group changed) would not be recognized and would show raw. Compute spans on the whole raw aligned-block text and map them to the segments by offset (or snap segment boundaries to span boundaries) so masking is applied to the same text the diff came from; make the seeded differing clause change the account number itself so the leak gate exercises a changed-token path.
- E18 (narrative input): `DiffResult` now holds RAW excerpts, so the sample aligned sentences handed to `drift-narrative` (07c) must be masked and clipped before they reach the Phase 05 task framework and `/api/ai`; add an assertion in `drift-narrative` that no 4+ raw digit run of the seeded number is in the task input.
- E19 (e2e fixture delivery): the Compare picker lists `/samples/*` and IndexedDB uploads; seeded fixtures under `fixtures/diff` are not bundled samples. Deliver the seeded sibling pair, the identical pair and the hostile (deeply nested) HTML for assertion 8b through the existing `upload-input` flow in the open dialog (precedent: `investor-path-view.spec.ts`), then pick them in Compare; do not add them to `public/samples`.
- E20 (error stage names): the error `stage` vocabulary (`read|parse|structure|detect|diff`) is the exported type `DiffStage` in `packages/core/src/diff/types.ts` (A1), distinct from the existing `StageId` (`read|structure|checks|ai|done`); the worker and `engine/types.ts` use it by type-only import/re-export. `code` is a CoreError `code` (an `ErrorCode`, for example `payload_too_large`) or a fixed token such as `unknown`, never an exception message.
- E21 (8b trigger, verified in this pass): the deterministic failure trigger is HTML whose open-element depth reaches `MAX_PARSE_DEPTH` (16384, `packages/core/src/adapters/html.ts`): `htmlToLines` throws `CoreError('payload_too_large')`. Build it like `packages/core/test/security/nesting-dos.test.ts` (`'<div>a'.repeat(N)` with N above 16384; about 100 KB, far below `limits.maxUploadBytes` = 10 MB) and deliver it with the file-delivery shape of `apps/web/e2e/hostile-html.spec.ts` (`setInputFiles` on `upload-input`, then fund, privacy-ack, `open-submit`). Note: `hostile-html.spec.ts` carries the upload flow and file shape only; its markup is inert-text hostile HTML, NOT nested, so do not copy its payload. The open dialog persists the upload to IndexedDB BEFORE `analyze` runs (`open-actions.ts` `openUpload`), so the failed file still appears in the Compare picker. Expected 8b result: stage `read`, code `payload_too_large`, side named as picked.
- E22 (prepare extraction): `analyze` currently catches with a bare `catch {}` and discards the error. The new `prepare` must read `e.code` when `e instanceof CoreError` (`CoreError` is exported from `@aduin/core`; the worker may import it as a value) and otherwise return the fixed token `unknown`, while `analyze` keeps reporting its stage failures exactly as before (existing `engine-worker-split` and `app-shell` e2e are the regression). Never copy `e.message` into the payload.

Dimension findings:
- Infra fit: PASS — the seam fits (existing `engine.worker.ts`, no Worker changes, import-graph guard, Phase 06 sequencing, OCR scope excluded); the `{error}` shape now has a named producer (`prepare` maps CoreError code to `{ok:false}`; core shapes `{error}`) and a deterministic trigger verified in `html.ts` and `nesting-dos.test.ts` (N3 resolved).
- Test coverage: PASS — gate commands are non-vacuous in form (`test <token>`, no `--`, one token per call); both leak gates are non-vacuous (seeded account number); `diff-input-failure` is reachable (pure core shaping, both sides, no text in payload) and e2e 8b covers the worker mapping with a deterministic nesting trigger. Named residuals only (live narrative quality, mockup design match).
- Breaking changes: PASS — the four tests broken by replacing the compare placeholder are repaired by derivation (Step G) and regression-gated; `DiffResult` is outside the frozen contract set (append-only barrel).
- Security surface: PASS — raw excerpts stay in the browser, the main thread masks with allow-listed `mask` and Reveal uses the existing `revealed` convention (verified in `FindingRow.tsx`); error payload carries code only, no message text (asserted); no auth, billing, schema or Worker surface; untrusted text through React only; live calls capped at 3 free requests (E10); split-segment masking and raw-text-into-narrative hazards carried as E17 and E18 with gates.
- Section A/B/C feasibility (core diff, fixtures, goldens, 07a): PASS — real `diff` 9.0.0, `Structure`/`DocGraph` types, `mask`/`sensitiveSpans`, `CoreError`, `DiffStage` placement and fixture scripts verified; the jsdiff `undefined` path is handled; highest-risk edit: alignment on restructured #3 vs #4 (mitigation: heading-sequence LCS plus unmatched lists, AC19 needs only no-crash).
- Section D feasibility (worker seam, 07b): PASS — the `prepare` extraction is mechanically feasible after Phase 06 lands; the `{error}` seam and trigger are now defined; highest-risk edit: touching `analyze` during the extraction, whose bare `catch {}` must be preserved (mitigation: E22, extraction without behavior change, existing `engine-worker-split` and `app-shell` e2e as regression).
- Section E/G feasibility (Compare UI and test repairs, 07b): PASS — registry append, slicer, repairs, the Reveal behavior and 8b (upload persists before analyze) are implementable as written; highest-risk edit: segment-level masking (E17).
- Section F feasibility (narrative, 07c): PASS (conditional) — new file only; `packages/core/src/llm/` is created by Phase 05, so the task must follow its real API; masked input (E18); the gate stays Hybrid and CONDITIONAL-in-spirit (residual D) if Phase 05 is unverified, never silently passed.

Open gaps: none new (0 CONCERN, 0 FAIL). Named residuals carried:
- Live-model narrative quality (AC15 H part): known-gap: documented as a named residual (gap-resolution D); backlog stub `process/general-plans/backlog/drift-narrative-live-quality_NOTE_17-10-26.md` is written by EXECUTE/UPDATE PROCESS. It is a residual, not a proving strategy, so it does not make the net gate vacuous: every developed behavior has a Fully-Automated or Hybrid gate.
- Compare for scanned/OCR documents: known-gap: documented as NEW PLAN REQUIRED — see backlog/compare-ocr-documents_NOTE_17-10-26.md (written by EXECUTE/UPDATE PROCESS).
- No true feeder pair in the sample corpus: sibling labeling is demonstrated on #3-#6 plus a seeded sibling pair (documented limitation).
- Needs counsel for non-finding diff rows (Version drift question): deferred to Phase 08 (gap-resolution C), backlog stub `phase08-version-drift-questions_NOTE_17-10-26.md`.
- Design match of the Compare screen against the mockup is Agent-Probe only (opt-in `DESIGN_PROBE=1`); no automated pixel gate.

What This Coverage Does NOT Prove:
- `golden-05-06-drift` does not prove alignment quality on documents other than #5/#6 and the seeded pairs, and, because its values are pinned from engine output, it proves stability plus the named semantic facts, not independent correctness of every changed clause.
- `golden-06-llc-agreement-lowconf` does not prove that no other legacy term is wrongly reported; it proves the LLC Agreement case and the rule cap.
- `diff-pairs` and `sibling-clause-common-vs-differing` do not prove legal equivalence of "common" clauses, true feeder-pair behavior (none exists in the corpus), or alignment quality on large restructurings beyond #3 vs #4.
- `diff-determinism` does not prove determinism across machines, Node versions or browsers (it compares repeated runs in one process).
- `diff-perf` (Node) and the e2e worker timing do not prove the budget on a slow device, a cold worker, or after Phase 05's F4 CPU change if timings were taken before it landed; they do not cover DOCX or scanned inputs unless Phase 06 formats are included in the picker.
- `diff-pairs` e2e and `sibling-clauses` e2e do not prove visual fidelity to the mockup, color contrast, or full keyboard and screen-reader behavior (a11y smoke covers zero critical axe violations only).
- The leak gates prove no raw sensitive digit run appears for the pairs they run on; they do not prove masking of sensitive formats the engine's account-number pattern does not recognize, nor of a number split across word-level diff segments unless E17's changed-token case is implemented.
- `diff-input-failure` (core) proves the shaping of `{ok:false}` per-side inputs into `{error:{side, stage, code}}` for both sides and the absence of document text in the payload; e2e 8b proves the worker mapping for the nesting trigger (`payload_too_large` at stage `read`). Neither proves behavior for corrupt PDF or DOCX bytes, for other CoreError codes, or for scanned documents (out of scope for Compare).
- `drift-narrative` (recorded) does not prove live-model narrative quality, token or latency behavior, or free-tier availability.
- `import-graph` and `source-guard` are static text checks; they do not prove runtime behavior of the worker seam.
- The regression gates do not prove behavior of surfaces no spec covers (for example Phase 06 formats, Phase 08 counsel store).

Gate: PASS (0 FAILs, 0 CONCERNs; N3 verified resolved in plan text and against code; PVL supplement cycles 1, 2 and 3 recorded; named residuals carried as documented known-gaps with backlog stubs; ready for EXECUTE after Phase 05 and Phase 06 engine changes have landed)
Accepted by: n/a — Gate is PASS (no CONCERN accepted); session (autonomous, autopilot /goal execution) recorded the named residuals above as documented known-gaps.
