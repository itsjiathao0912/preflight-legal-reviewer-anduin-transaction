---
phase: phase-07-version-diff
date: 2026-10-17
status: COMPLETE_WITH_GAPS
feature: subdoc-qa-mvp
plan: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-07-version-diff_PLAN_17-10-26.md
---

# Phase 07 — Version Diff — Report

Status: 07a is done (core diff engine, fixtures, goldens). 07b (worker seam, Compare UI, e2e) and 07c (AI narrative) have not started. Nothing is committed yet.

## 07a — Core diff engine + goldens + fixtures (2026-10-17)

### What Was Done

- `packages/core/src/diff/`: `types.ts` (zod `DiffResultSchema` (strict, no timing), `SideInput`, `DiffStage` = read|parse|structure|detect|diff, `DiffErrorSchema` (code limited to `^[a-z_]{1,40}$`)), `normalize-key.ts`, `align.ts`, `diff-text.ts`, `extract-terms.ts`, `extract-fees.ts`, `extract-requirements.ts`, `rename-inference.ts`, `findings-delta.ts`, `sibling.ts`, `index.ts` (`diffDocuments({a, b, mode})`).
- Barrel: one appended block in `packages/core/src/index.ts` (`export * from './diff/index'`).
- Alignment units are scope preambles, sections and parts. Passes run in this order: exact (structural key + heading key, made monotone with an O(n log n) LIS step), then LCS on heading keys inside unmatched windows, then same structural key (relabel), then Jaccard similarity (≥ 0.5 on heading + first 200 chars). Each window is capped at 250k cells. Repeated headers get ordinals: by scope-kind occurrence (`body:2`), plus `#n` on duplicate keys.
- Text diff: sensitive spans are computed once on the whole raw text. Each span becomes one atomic token, then jsdiff `diffArrays` with `maxEditLength` 1500 runs over those tokens. A number can never be split across segments (E17), and the segment `sensitiveSpans` are mapped from the whole-text spans. If jsdiff returns `undefined`, the fallback is one `del` plus one `add` for the whole block, with `truncated: true`.
- Excerpts are raw clipped text plus `sensitiveSpans`, with clip bounds widened so no span is split. The ellipsis is a `clippedStart/End` flag, not text inside the excerpt. Core does no masking.
- Fixtures (generator `buildDiffFixtures()` in `scripts/src/fixtures/build-seeded.ts`; expectations authored there): `fixtures/diff/{sibling-A,sibling-B,empty,single-section}.html`, `identical-pair/{a,b}.html`, `expected/{sibling-A-vs-B,identical-pair,not-enough-structure}.json`. The differing wire clause changes the synthetic number itself (990000017 → 990000025). `check.ts` now scans `fixtures/diff` recursively for stray files; a planted `expected/stray.json` made `fixtures:check` exit 1.
- Tests: `test/unit/diff/{diff-pairs,diff-determinism,diff-input-failure,diff-perf,sibling-clause-common-vs-differing,diff-contract}.test.ts` + `diff-helpers.ts`; `test/golden/diff/{golden-05-06-drift,golden-06-llc-agreement-lowconf}.test.ts`.

### Pinned golden numbers (engine output, #5 → #6)

| Item | Value |
|---|---|
| Sections | added 0, removed 1 (`appendix:c`), renamed 1 (`signature:1/s6/pa` "Unit class" → "Share class"), moved 0, changed 21, same 9 |
| Findings delta | fixed 4 (2× ref-label-coherence, flag-placeholder `[xx]`, flag-drafting-note), still present 3 (2× flag-sensitive, flag-placeholder `[insert investor name]`), new 0 |
| Quote-similarity threshold | 0.5. Accepted pairs: min 1.0. Best rejected same-detector pair: 0.231 |
| Renames (from, to, count/occurrences) | Member→Shareholder 4/4; Memorandum→Prospectus 8/8; Placement Fee→Sales Load 3/3; Units→Shares 29/35 (0.83); placement agent→distributor 4/4. No other renames |
| Definitions renamed | Member→Shareholder, Memorandum→Prospectus, Units→Shares |
| Fees | 0.85% A same, 0.25% S same, 3.5% (no class) → 3.5% Class A changed, 1.5% Class S added |
| "Appendix C" mentions in #6 | 0 |
| LLC Agreement (AC16) | 11 occurrences in #6. Only a "Possible leftover": confidence 0.31, severity low. All leftovers: ERISA 0.24, LLC Agreement 0.31, Plan 0.30 |
| Rename thresholds | coverage ≥ 0.8, count ≥ 3, same-position window ±48 chars. Leftover rule: co-occurrence ≥ 0.5, count ≥ 3, confidence = min(0.4, 0.4 × ratio) |

#3 vs #4: added 10, removed 23, renamed 3, moved 4, changed 1. No crash.

### Perf (AC29 input, Node, test's own timer, includes both parses + both `runDeterministic`)

- #5 vs #6: 187 ms (warm). #2 vs #2: 143 ms. A cold one-off tsx run of #5 vs #6 took about 1.4 s in total. All are under 3 s. Worker timing is measured in 07b.

### Test Gate Outcomes

All green: `golden-05-06-drift` 8, `golden-06-llc-agreement-lowconf` 2, `diff-pairs` 8 (including `no-raw-sensitive-digits` and the E17 split-number case), `diff-determinism` 2, `diff-input-failure` 5, `diff-perf` 1, `sibling-clause-common-vs-differing` 3, `contracts` 34 (snapshot unchanged: its module list does not include `diff/`, and the separate `diff-contract` test covers `DiffResult`), `security` 34, `test:golden` 67, full core 70 files / 457 tests. Core typecheck, scripts typecheck and `fixtures:check` OK. Prettier and eslint are clean on all touched files. Each token exited 1 before its test file existed.

### Plan Deviations (within blast radius)

1. The diff uses jsdiff `diffArrays` over span-aware word tokens, not `diffWords`/`diffSentences`. Reason: that is the only way to keep a sensitive number atomic (E17). It is the same word-level operation from the same library, and `maxEditLength` → `undefined` was confirmed by a runtime probe.
2. There is no `timeout` option, only `maxEditLength`. A wall-clock bound would make the output depend on machine speed (determinism, E6).
3. Section titles are compared with parentheticals stripped. As a result §9 "(Selection Required Below)" and §12 counts as `changed`, not `renamed`, so Part A of §6 is the only relabel, as AC15 states.
4. An internal (non-input) exception yields `{error:{side:'a', stage:'diff', code}}`. The contract has no side-neutral value.
5. `possibleLeftovers` also lists ERISA and Plan (≤ 0.31, low). This is allowed by the diff-only rule; the values are pinned.
6. Requirement and definition comparisons are rename-aware: a sentence that changed only because of an inferred rename is not reported.

### What Was Skipped or Deferred

- 07b and 07c are not started (out of scope for this spawn). The backlog stubs (`drift-narrative-live-quality`, `compare-ocr-documents`, `phase08-version-drift-questions`) are not written yet; they belong to 07b/07c/UPDATE PROCESS.

### Test Infra Gaps Found

- The `contracts` snapshot test uses a hard-coded module list, so new schemas are never picked up automatically. `diff-contract.test.ts` covers `DiffResult` instead.
- Incident: another agent's `git stash` removed the uncommitted `buildDiffFixtures` block from `build-seeded.ts` once. I re-created it, and `fixtures:check` is green.

### Forward Preview

- Test Infra Found: `test/unit/diff/diff-helpers.ts` (`sideOf`, `fixtureSide`, `maskedRender`, `leakedRuns`, `allTexts`) can be reused by 07b.
- Blast Radius Changes: none outside the plan.
- Commands to Stay Green: the 7 core tokens above, `pnpm --filter @aduin/core test:golden`, `pnpm --filter @aduin/scripts fixtures:check`.
- Dependency Changes: none (`diff` 9.0.0 was already a dependency).
- For 07b: the worker needs `diffDocuments`, `DiffStage`, `DiffResult` and `CoreError` (all exported from `@aduin/core`). The main thread imports types plus `mask` only.

## 07b — Worker seam, Compare UI, e2e, Step G repairs (2026-10-17)

Status: 07b and Step G are done and green; nothing committed. 07c (drift narrative, F1) is the next step.

### What Was Done

- Worker seam (D0): Phase 06's format dispatch (`readInput`) was present first. `engine.worker.ts` gains `graphOf(read)` (the stage-2 graph build, now shared by `analyze` and `prepare`; `analyze`'s stage reports, bare catches and imports are unchanged), `codeOf(e)` (CoreError code or `unknown`, never the message, E22), `prepare(input, settings)` returning core `SideInput` (`read` / `structure` / `detect` stages; a non-HTML read with no lines gives `scanned_document` / `no_text`), and `api.diffDocuments({a, b, mode})` → `{result, ms}` | `{error}` (side b is not parsed when side a fails). `types.ts`: `DiffSideInput`, `DiffDocumentsInput`, `DiffDocumentsResponse`, type re-exports `DiffMode`/`DiffResult`/`DiffStage`. `client.ts`: `diffInWorker` logs `diff-ms <n>`.
- Formats in Compare: HTML samples (not the scan set), stored uploads named `.htm/.html/.pdf/.docx`. Scans and images are excluded (backlog stub).
- Compare UI (`apps/web/src/features/compare/`): `CompareScreen.tsx`, `model.ts` (items, chip groups, groups), `sources.ts` (picker list + bytes, mirroring `open-actions.ts`), `compare.css` (tokens only). Registry append `id:'compare'`.
- Testids: `compare-view` (`data-mode`), `cmp-meta`, `cmp-base`, `cmp-compare`, `cmp-swap`, `cmp-mode-version`, `cmp-mode-sibling`, `cmp-stats`, `cmp-chip` (`data-k`, `data-n`), `cmp-clear`, `cmp-list`, `cmp-item` (`data-id`, `data-kind`, `data-group`, `aria-current`), `cmp-empty`, `cmp-loading`, `cmp-nodiff`, `cmp-nostructure`, `cmp-error` (`data-side`), `cmp-detail`, `cmp-clause-diff`, `cmp-reveal`, `cmp-counsel`.
- Masking: every excerpt and segment renders `mask(text, sensitiveSpans)` until Reveal (`useReview().revealed`); clipping happens after masking. Segments use the per-segment spans that core mapped from the whole block (E17).
- Needs counsel: enabled only when the row's finding id is a finding of the open document (stillPresent/new → `findingIdB`, fixed → `findingIdA`); otherwise disabled with title "Available after counsel sheet (Phase 08)" plus visible text.
- Step G: `placeholder-routes` (compare row removed; new "compare is no longer a placeholder"), `layout-vs-mockup` (real Compare view audited with a #5/#6 diff open, against `compareCss()` vocabulary), `a11y-smoke` (placeholder audit moved to Counsel questions; new "compare" audit with a diff open), `smoke.test.tsx` ('compare' appended after 'structure' + component/label asserts). `mockupCss.ts`: `compareCss()` slicer.
- New e2e: `diff-pairs.spec.ts` (10 tests), `sibling-clauses.spec.ts` (1 test), helper `e2e/fixtures/compare.ts`. Seeded fixtures and the nested HTML go through `upload-input` (E19, E21).
- Orchestrator request: `fixtures/diff/` added to `.prettierignore` (generator-owned output, like `fixtures/llm-recordings/`); `pnpm lint` is green and `fixtures:check` stays OK.
- Backlog stubs: `process/general-plans/backlog/compare-ocr-documents_NOTE_17-10-26.md`, `process/general-plans/backlog/phase08-version-drift-questions_NOTE_17-10-26.md`.

### Test Gate Outcomes

| Gate | Result |
|---|---|
| web `test import-graph` | 4/4 |
| web `test source-guard` | 4/4 |
| web `test smoke` | 2/2 |
| web unit (whole) | 17 files / 72 tests |
| e2e `diff-pairs` | 10/10 (includes 8, 8b, 9, 10) |
| e2e `sibling-clauses` | 1/1 (10 common, 2 differing, 2 only-in-one) |
| e2e `placeholder-routes` / `layout-vs-mockup` / `a11y-smoke` | 5/5, 5/5, 1/1 (0 critical) |
| e2e `app-shell` / `structure-view` / `engine-worker-split` | 8/8, 4/4, 2/2 |
| e2e whole (`pnpm --filter @aduin/web test:e2e`) | 107 passed, 1 skipped (opt-in design-probe) |
| core full | 70 files / 467 tests (two clean runs; one earlier run had 1 failure while the full e2e suite ran in parallel, most likely a timing test under CPU load) |
| web typecheck, `pnpm lint`, `guard:cf`, `secrets:scan`, `fixtures:check` | OK |

Perf (AC29, worker, measured in the browser): #5 vs #6 `diff-ms 343` (both prepares + diff), well below 3000 ms. #2 vs #2 is not measured in the browser because the UI short-circuits the same document to "No differences"; the Node figure (143 ms) stands.

### Plan Deviations (within blast radius)

1. The shared helper is `graphOf` + `prepare(input, settings)` (it takes an `AnalyzeInput`, not bare bytes). `analyze` keeps its own stage-reporting flow and calls the shared `readInput` + `graphOf`. Reason: a single helper would change `analyze`'s stage events. Behaviour is unchanged, as shown by the engine-worker-split and app-shell gates.
2. The swap assertion compares section-level added/removed (they swap exactly, and Appendix C moves from removed to added). The chip totals also include rename-aware definition and requirement rows, which do not have to be symmetric in the reverse direction (the observed totals were 8 and 18).
3. Same-document selection shows "No differences" without calling the worker, as in the mockup. Identical but distinct files go through the worker (`notice: no_differences`, tested with the identical-pair uploads).
4. `compare.css` lives in `features/compare/` and uses tokens only: the mockup's `#fff` hover/pressed colour becomes `var(--paper)`. There is no side-by-side/inline layout toggle and no "Mark reviewed" control; clause diffs render inline segments, with two columns when there are no segments. No icon sprite edits were made, so existing icons are used.
5. The Compare picker lists `.pdf`/`.docx` uploads; the worker does not run OCR, so partly scanned PDFs are compared on their text pages only.

### What Was Skipped or Deferred

- 07c / F1 (drift narrative): next step. The backlog stub `drift-narrative-live-quality_NOTE_17-10-26.md` is still to be written by 07c or UPDATE PROCESS.
- CONTEXT_PARTIAL: none.

### Forward Preview

- Test Infra Found: `e2e/fixtures/compare.ts` (`upload`, `openCompare`, `pickPair`, `chip`, `chipN`, `waitDiff`); `compareCss()` in `test/support/mockupCss.ts`.
- Blast Radius Changes: `.prettierignore` (one line, orchestrator request).
- Commands to Stay Green: the gates in the table above, one token per call.
- Dependency Changes: none.

## 07c — AI drift narrative (opus, 2026-10-17)

Status: COMPLETE. F1 and the backlog stub ticked. Not committed. Phase 05 VERIFIED precondition met.

### What was built

- `packages/core/src/llm/tasks/drift-narrative.v1.ts` (new): task `drift-narrative` (`drift-narrative@1` / `drift-narrative.s1`, model schema `drift_narrative_v1` = `drafts[{candidate_id,text<=600}]`), `buildDriftNarrativeCandidates(DiffResult)` (one candidate per rename, max 8, largest count first; quote `Rename: "from" -> "to" (n of m occurrences)` + masked/clipped `Before:`/`After:` sample from a changed/renamed/moved section, fallback the renamed definition), `readDriftNarrative(data, candidates)` (main-thread reader), `renameOfCandidate`, `mentionsRename`.
- E18: excerpt text is masked with its `sensitiveSpans`, masked again by the account-number pattern, then clipped (clip after mask); the whole quote is pattern-masked once more. Asserted: seeded number and any 5+ digit run absent from candidates AND from the built messages.
- Validator: Phase 05 `wrapEnvelope` (drafts) + drop any draft whose candidate is not a sent rename or whose text does not name both terms (`ext.dropped` counts them). The narrative can only state renames in `DiffResult.renames`.
- Contract (additive): `AI_TASK_IDS` += `'drift-narrative'`; snapshot regen moved only the `AiRequestSchema.task` enum (3 lines). Worker picks the task up via `TASKS` with no code change.
- Registry append + `llm/index.ts` export append.
- Scripts: casebook `pair` cases `drift-narrative-05-06` (live) and `drift-narrative-hostile-invented-rename` (authored); `pairCandidates(a,b)` in `ai-request.ts`; request `sample: null` + `pair`.
- Web: `features/compare/AiSummary.tsx` in the Compare detail pane (version mode, notice none). States (`data-state`): `none` (no renames), `off` (AI switch off), `unavailable` (no API in build), `idle` ("Summarize changes" button, no call on open), `pending`, `done` (lines `from → to` + text, "AI suggestion" tag, `model · fresh|from cache`), `skipped` (banner reason + Retry; diff unaffected). `stream-client` got optional `task` and `docHash` (no `x-aduin-doc` for a pair). `import-graph` allow-list +`buildDriftNarrativeCandidates`, `readDriftNarrative`.

### Live calls (E10, APPROVED-LIVE <= 3)

- Used: **1 of 3**. Case `drift-narrative-05-06`, strict `json_schema`, HTTP 200, `usage.cost = 0`, 986 tokens in / 767 out.
- Served model: `nvidia/nemotron-3-super-120b-a12b:free`.
- Quality: 5 of 5 lines kept by the validator; each names old and new term and a sensible re-check hint (form labels, Prospectus references, fee footnote). Minor: it calls every change "throughout"/"all occurrences" although Units is 29 of 35. Residual stays Known-Gap (backlog stub).
- Key sourced with the approval marker only; `secrets:scan` OK.

### Gate outcomes

| Command | Result |
|---|---|
| `pnpm --filter @aduin/core test drift-narrative` | 1 file, 6 pass |
| `pnpm --filter @aduin/core test contracts` | 34 pass (after snapshot regen) |
| `pnpm --filter @aduin/core test llm-task-registry` | 9 pass |
| `pnpm --filter @aduin/core test llm-schema` | 9 pass |
| `pnpm --filter @aduin/core test` | 73 files, 501 pass (an earlier run had 2 timeouts, `diff-determinism`/`size-cap`, under concurrent Phase 09 load; green on rerun) |
| `pnpm --filter @aduin/worker test record-body-parity` | 21 pass |
| `pnpm --filter @aduin/worker test` | 64 files, 521 pass |
| `pnpm --filter @aduin/scripts test` | 9 files, 63 pass; `record:author --check` OK (11 cases) |
| `pnpm --filter @aduin/web test` | 18 files, 76 pass (incl. `import-graph` 4) |
| `pnpm --filter @aduin/web test:e2e compare-ai-summary` (new) | 4 pass |
| e2e `diff-pairs` 10, `layout-vs-mockup` 5, `a11y-smoke` 1, `provenance` 2, `sample-zero-calls` 4, `sibling-clauses` 1 | pass (`provenance` failed once while the Phase 09 agent shared the preview port, green on rerun) |
| `pnpm typecheck`, eslint + prettier on touched files, `guard:cf`, `secrets:scan` | OK |

### Deviations

See plan `## Deviations` (07c entry). No web unit test for `AiSummary` (states are covered by the 4-test e2e spec). Strict red-first not run for the recorded test (Hybrid tier, Mode B).

### Concurrency note

The Phase 09 agent rewrote `apps/web/test/import-graph.test.ts` mid-run and dropped my allow-list line; it was re-appended after their `maskOutlineName` entry. Both phases' entries are present now.

### Test infra gaps found

- None blocking. Known-Gap: live narrative quality (`process/general-plans/backlog/drift-narrative-live-quality_NOTE_17-10-26.md`); AC15 H part stays CONDITIONAL.
- The shared preview port 4317 serializes e2e runs across concurrent agents.

CONTEXT_PARTIAL: none.

### Forward Preview

- Test infra found: casebook `pair` cases; `recordingByCase('drift-narrative-05-06')`; e2e reads `fixtures/llm-recordings/drift-narrative/`.
- Blast radius changes: files above; `fixtures/llm-recordings/drift-narrative/5685e20db8f250a9.json` (live) and `7252bfe74de14154.json` (authored hostile).
- Commands to stay green: the gates above, plus `record:author --check` after any diff-engine change (candidate quotes move the inputHash; re-record or re-author).
- Dependency changes: none.

## UPDATE PROCESS closeout (17-10-26)

Phase 07 is closed: 07a f3f533f, 07b 99c9cee, 07c dca6a45. Status COMPLETE_WITH_GAPS (one CONDITIONAL criterion part, see below). The sections above that say "nothing committed" or "07b/07c not started" describe the state at the time they were written.

### EVL outcome

Independent serial run at HEAD dca6a45, all green: core 501, worker 521, web unit 76, web e2e 114 (+1 opt-in skip), scripts 63; `fixtures:check`, typecheck, lint, `guard:cf`, `secrets:scan`, `seed:check`, `slice:check` OK. Iteration report: `subdoc-qa-mvp-phase07-evl-iteration-001_REPORT_17-10-26.md`. Live use: 1 of 3 approved free calls ($0), for `drift-narrative`.

### Pinned numbers (for Phase 08 and 10)

- Pinned #5 to #6 goldens are in the 07a table above (sections, findings delta, renames, fees, thresholds). Perf: Node 187 ms warm, browser 343 ms (AC29 budget 3 s).
- Frozen-contract note: Phase 07c made one additive change, `AI_TASK_IDS` += `'drift-narrative'` (`AiRequestSchema.task` enum 2 values to 3). The contracts snapshot was regenerated and only that enum moved. Worker needs no code change.

### SPEC Achievement

| AC | Result | Evidence |
|---|---|---|
| AC15 (version diff #5 to #6, rename narrative) | Deterministic part MET; AI-narrative part CONDITIONAL (unmet as a live-quality claim) | Goldens `golden-05-06-drift` and e2e `diff-pairs` green; narrative proven only by recorded + hostile-authored recording (Hybrid). Live quality is a Known-Gap: backlog `drift-narrative-live-quality_NOTE_17-10-26.md` |
| AC16 (LLC Agreement leftover) | MET | `golden-06-llc-agreement-lowconf`: 11 occurrences, "Possible leftover" only, confidence 0.31, severity low |
| AC19 (Compare view, HTML / PDF text / DOCX) | MET | e2e `diff-pairs` 10, `sibling-clauses`, `compare-ai-summary` 4 |
| AC29 (diff under 3 s) | MET | Node 187 ms, browser 343 ms |

Known-Gap is not counted as met. The archival gate keeps the plan files in `active/` with the program folder because Phase 07 is part of the still-running umbrella task folder (the whole folder archives at program end).

### Known gaps and follow-ups

- Compare excludes scanned / OCR documents: `process/general-plans/backlog/compare-ocr-documents_NOTE_17-10-26.md`.
- Diff-only rows cannot create counsel questions: `process/general-plans/backlog/phase08-version-drift-questions_NOTE_17-10-26.md` (Phase 08 input).
- Live narrative quality: `process/general-plans/backlog/drift-narrative-live-quality_NOTE_17-10-26.md`.
- Test infra: the `contracts` snapshot test uses a hard-coded module list; the shared preview port 4317 serializes e2e runs, so run the suite serially (one agent at a time).

### Plan deviations

See the 07a, 07b and 07c deviation lists above and the plan `## Deviations` section. None changed the blast radius beyond the registry revision.

### Closeout Packet

1. Selected plan: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-07-version-diff_PLAN_17-10-26.md`.
2. Classification: Ready for UPDATE PROCESS archival at program end; AC15 AI part keeps a CONDITIONAL backlog stub.
3. Finished: 07a, 07b, 07c, Step G repairs.
4. Verified: all gates above. Unverified: live narrative quality, OCR documents in Compare.
4b. Validate-contract: present, PASS.
5. Cleanup: registry DONE, Phase Loop 6 and 7 ticked, context docs updated. Remaining: none for this phase.
6. Next: Phase 08 EXECUTE.
7. Commit: execution commits already made; process commit `process: close out phases 07 and 09`.
8. Regression: web e2e 114, worker 521, core 501 all green at dca6a45.
9. SPEC achievement: see table above.

Drift score: HIGH (files touched 10+, 2 backlog notes and 3 stubs, contract change). Strongly recommend UPDATE PROCESS -- harness/protocol files touched.

PHASE_COMPLETE: UPDATE PROCESS (Phase 07)
