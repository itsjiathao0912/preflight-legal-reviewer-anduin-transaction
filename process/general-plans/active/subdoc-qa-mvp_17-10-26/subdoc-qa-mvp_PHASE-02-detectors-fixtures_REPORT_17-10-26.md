---
phase: phase-02-detectors-fixtures
date: 2026-10-17
status: COMPLETE_WITH_GAPS
feature: subdoc-qa-mvp
plan: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-02-detectors-fixtures_PLAN_17-10-26.md
---

# Phase 02 — Detectors, Fixtures, Structure View: EXECUTE report

**TL;DR.** All 10 new deterministic detectors, investor paths, the `pattern_key` sanitizer, the widened mask, the seeded and fund I/II/Y fixtures, the demo-seed spec and the real `#structure` view (6 lenses, Issues only, Show everything, right drawer, computed badge) are in. Every gate in the contract's final list is green for this phase's scope: 20 core/scripts gates, 3 new e2e specs and the full preview suite (66 passed, 1 skipped). Phase 01 goldens keep their finding content; only the two "no other finding" totals named in E2 were narrowed. Gaps: `pnpm typecheck` and `pnpm lint` are red only because of Phase 04b's in-progress files (`apps/worker/**`, `scripts/src/seed/**`), and investor paths on real samples remain an Agent-Probe residual.

## Seam release (done first)

`packages/core/package.json` (`test:seeded` lost `--passWithNoTests`) and `scripts/package.json` (`fixtures:build`, `fixtures:check`) were the first edits of the session. Both seams can be released to 04b. This phase did not touch `pnpm-lock.yaml`, the root `package.json` or `apps/worker/**`. Those files show 04b's own changes in the working tree.

## What Was Done

**Step A — detectors** (registry appends, one group at a time; `test:golden` run after each group)
- A1: `broken-conditional` (critical), `unreachable-flow` (critical: a cycle in the jump graph, or a universal forward jump that leaves sections unreachable), `option-gap-overlap` (high: numeric ranges with a gap or overlap; "all of the above" in a check-one group). Shared target parsing is in `detectors/flow.ts`, which also resolves "Part C of Section 2".
- A2: `defined-term-issues`. Kinds: duplicate (high), used-before-defined, unused, capitalization (medium). The filters are structural only: a re-definition in another numbering scope, the same referent, a "Section N (“Label”)" heading citation, abbreviation-like terms, proper-name adjacency, explicit forward references ("as defined below"), and inline (paren) definitions only for used-before-defined. "Used but undefined" stays the Phase 01 `undefined-term` rule. Result: zero `defined_term_issue` on #1/#3/#5/#6 and only "Units" on #11.
- A3: `footnote-requirement` (high). It uses a TS-only side channel (E5): `adapters/html.ts` keeps a WeakMap from each emitted Line to its `<sup>` segments, `option-groups.ts` sets `OptionItem.footnote_marker` (the field is omitted when absent), and `structure/types.ts` gained the optional field. `LineSchema` and `CueSchema`, line text, `structurer.ts` and `engine.ts` are unchanged. Investor-type groups are left to the PATH-04 rule.
- A4: `flag-drafting-note`, `flag-placeholder` (`[xx]`, `[insert …]`, `[●]`; never `____`, `[ ]` or `[***]`), `flag-sensitive` (a cue word in a 32-character look-back window; facts are `last4`, `cue`, `kind`). Several hits in one sentence become one finding listing every cue (#7: `kind "aba, dda"`).
- A5: `memory/patternKey.ts` is the single implementation. `make-finding.ts` re-exports it, the barrel keeps one export and `memory/index.ts` has none. Existing keys are byte-identical.
- A6: `ACCOUNT_NUMBER_RE` now also matches digit runs over 31, IBANs and alpha-prefixed accounts, using bounded alternatives. `test:vectors` is unchanged and green.
- A7: new `security/sensitive-no-raw.test.ts`. Every new regex (collected by module) plus `TYPE_RULES` and 9 new hostile inputs were added to `redos.test.ts`. A real hot path was found and fixed: `groupBySentence` now reuses the last snapped sentence, which turned a 10.7 s 1 MB `NTD` input into a pass.
- A8: `finding-schema-contract` compares `mask(slice, sensitiveSpans(slice))` with `quote` (E12).

**Step B — investor paths:** `investor/{types,extract,paths}.ts` plus `investor-path-dead-end` (critical, only when the graph proves no route) and `investor-path-missing-item` (high: the Part C case and the app.html PATH-04 peer-item case). A path without a completion node is `uncertain` and is never asserted.

**Step C — fixtures:** `scripts/src/fixtures/{build-seeded,find-shared-passages,check}.ts`, with core imported by relative path (E7, no new dependency). The builder writes 46 files: 10 detector dirs with 23 HTML cases plus `expected.json` (expectations are authored, never read back from the engine), `fixtures/memory/{fund-I,fund-II,fund-Y}.html`, `fund-expectations.json`, `fund-I-decisions.json`, `fund-I-answers.json` and `demo-seed-spec.json`. The output is prettier-clean (HTML lines ≤ 100 chars; a JSON printer in prettier's shape), so no `.prettierignore` seam was needed.

**Step D — corpus and the `#structure` view:** the pure `structure-view/build.ts` (`buildStructureView`, exported once from the barrel) is called only in `engine.worker.ts`, and the result is attached as an optional `EngineResult.structure`. The main thread imports types only (import-graph green). Web side: `features/structure/{StructureScreen,StructureLenses,StructureDrawer,model}`, `features/investor-paths/InvestorTypesLens.tsx`, `styles/structure.css`, a registry append, and the computed `nav-badge-structure` (`NavGroup.tsx` and `Sidebar.tsx`, E10).

**Step E — P03 regression repair:** see the spec table below.

## Test Gate Outcomes (final gate list, each a separate call, one token, no `--`)

| # | Command | Exit | Output |
|---|---|---|---|
| 1 | `pnpm --filter @aduin/core test flags-ntd-placeholder-sensitive` | 0 | 1 file, 7 tests passed |
| 2 | `pnpm --filter @aduin/core test mask-widening` | 0 | 1 file, 5 passed |
| 2 | `pnpm --filter @aduin/core test:vectors` | 0 | 2 files, 38 passed |
| 3 | `pnpm --filter @aduin/core test security` | 0 | 6 files, 27 passed |
| 4 | `pnpm --filter @aduin/core test pattern-key` | 0 | 1 file, 5 passed |
| 5 | `pnpm --filter @aduin/core test:seeded` | 0 | 1 file, 2 passed; `[seeded] expected=24 tp=24 predicted=24 recall=1 precision=1.000` |
| 6 | `pnpm --filter @aduin/core test investor-path-extraction-fixtures` | 0 | 1 file, 5 passed |
| 6 | `pnpm --filter @aduin/core test investor-path-determinism` | 0 | 1 file, 5 passed |
| 6 | `pnpm --filter @aduin/core test investor-path-seeded-defects` | 0 | 1 file, 5 passed |
| 7 | `pnpm --filter @aduin/core test structure-view-build` | 0 | 1 file, 7 passed |
| 8 | `pnpm --filter @aduin/core test explanation-present-per-rule` | 0 | 1 file, 2 passed |
| 8 | `pnpm --filter @aduin/core test determinism` | 0 | 2 files, 18 passed |
| 8 | `pnpm --filter @aduin/core test:property` | 0 | 4 files, 29 passed |
| 9 | `pnpm --filter @aduin/core test memory-fixtures` | 0 | 1 file, 4 passed |
| 9 | `pnpm --filter @aduin/core test demo-seed-spec` | 0 | 1 file, 4 passed |
| 10 | `pnpm --filter @aduin/scripts fixtures:check` | 0 | `fixtures:check OK (46 files match a fresh build)` |
| 11 | `pnpm --filter @aduin/core test:corpus` | 0 | 1 file, 13 passed |
| 12 | `pnpm --filter @aduin/core test:golden` | 0 | 5 files, 44 passed |
| 12 | `pnpm --filter @aduin/core test` | 0 | 36 files, 277 passed (baseline 25 / 226) |
| 12 | `pnpm --filter @aduin/web test` | 0 | 10 files, 38 passed |
| 13 | `pnpm --filter @aduin/web test:e2e structure-view` | 0 | 4 passed |
| 13 | `pnpm --filter @aduin/web test:e2e investor-path-view` | 0 | 3 passed |
| 13 | `pnpm --filter @aduin/web test:e2e reveal-sensitive` | 0 | 2 passed |
| 14 | `pnpm --filter @aduin/web test:e2e` (full preview) | 0 | 66 passed, 1 skipped (baseline 58 passed, 1 skipped) |
| 15 | `pnpm typecheck` | 2 | red only in `apps/worker` (04b WIP: `test/memory/cron-purge.test.ts`, `memory-no-cross-firm-or-workspace.test.ts`); `pnpm --filter @aduin/core typecheck`, `@aduin/web typecheck` and `@aduin/scripts typecheck` all exit 0 |
| 15 | `pnpm lint` | 1 | ESLint: 5 errors, all in 04b files (`apps/worker/src/memory/repo/audit.ts`, `apps/worker/src/routes/memory/session.ts`, `apps/worker/test/memory/memory-harness.ts`, `scripts/src/seed/gen-demo-seed.ts`); Prettier: 57 files, all under `apps/worker/**` or `scripts/src/seed/**`. ESLint and Prettier on every Phase 02 file: clean |
| 15 | `pnpm guard:cf` | 0 | `guard:cf: OK` |
| 15 | `pnpm secrets:scan` | 0 | `secrets:scan: OK` |
| 16 | Agent-Probe | — | see "View fidelity" below |

E1 baseline (before any detector): core 25 files / 226 tests, web 10 / 38, preview e2e 58 passed, 1 skipped. After Step A, the e2e run had 7 failures, all expected: filter-sort ×2, finding-highlight #3, gate-pill ×2, previously-handled ×1 and triage-actions masked value. After Step D and the repairs: 66 passed, 1 skipped.

## P03 spec adaptations (EXPECTED changes; no product-behavior assertion weakened)

| Spec | Change | Why |
|---|---|---|
| `gate-pill.spec.ts` | golden picks `[a, b]` by `detector_id === 'ref-label-coherence'`; `N = engineFindings('05').length`; meta `${N} open · ${N} block digitization`; toast `${N-1} blocking reason(s) left.`; forced index = `findIndex` of the golden | #5 gained NTD + 2 placeholders + 2 sensitive (AC10) |
| `previously-handled-section.spec.ts` | all 4 tests pick goldens by detector; gate `Blocked · N` derived; forced-medium index = `findIndex` | a non-blocking flag dismissed in #3 would land in "previously handled" |
| `finding-highlight.spec.ts` | #3 loop and `[1]` filter to `ref-label-coherence`; #11 lookup filtered to `undefined-term` | new flags carry no `facts.reference` |
| `filter-sort.spec.ts` | chip counts, row counts, severity order and document order all derived from `engineFindings('03')` with the same forced severity | #3 gained placeholder + 2 sensitive |
| `app-shell.spec.ts` | the Structure route asserts `structure-view` | Structure is a real view |
| `placeholder-routes.spec.ts` | Structure dropped from the placeholder list; the "Investor types placeholder" test now asserts the real view and no placeholder | Structure is a real view |
| `a11y-smoke.spec.ts` | placeholder audit moved to Compare; new audits on `#structure`, the drawer and Investor types (0 critical) | Structure is a real view |
| `triage-actions.spec.ts` (DV5) | `.mask` scoped to the seeded `#8097` | #1 now masks its own ABA/DDA too |
| `dismiss-requires-reason.spec.ts` | not edited (it counts the 4 reason radios; green) | E9 |
| `slice.spec.ts` (04a, stack) | not edited. Inspection: the target is selected by the text "this Section 11", open counts and the gate branch are derived, and the new #1 findings are medium ("note"), so the target row is unchanged | E9 |
| `src/smoke.test.tsx` (unit, DV4) | the registry list ends with the appended `structure` entry | designed registry append |

Golden test narrowing (E2): `golden-01-this-section-11` and `golden-03-05-swapped-part-b-refs` count only Phase 01 detector ids in the "no other finding" totals. `golden-11-undefined-units` stayed green and was not edited. All golden finding content is unchanged.

## D1 corpus report (12 HTML samples, ceiling < 40 high+critical per document)

| Sample | Findings | High+critical | Classes |
|---|---|---|---|
| #1 | 4 | 2 | sensitive 2, xref 2 |
| #2 | 18 | 0 | sensitive 7, defined-term 5, placeholder 6 |
| #3 | 5 | 2 | xref 2, sensitive 2, placeholder 1 |
| #4 | 3 | 0 | defined-term 2, sensitive 1 |
| #5 | 7 | 2 | xref 2, sensitive 2, placeholder 2, drafting note 1 |
| #6 | 3 | 0 | sensitive 2, placeholder 1 |
| #7 | 4 | 1 | defined-term 3 (1 duplicate = high), sensitive 1 |
| #8 | 0 | 0 | — |
| #10 | 4 | 0 | defined-term 4 |
| #11 | 1 | 0 | undefined-term "Units" |
| #12 | 1 | 0 | defined-term 1 |
| #13 | 2 | 0 | sensitive 2 |

Ceiling met (maximum 2). The severity caps were not changed (no evidence calls for it: label-coherence stays high, sensitive_data stays capped at medium). Top false-positive cause: `used-before-defined` on titles, headings and signature captions (backlog P2-6).

### Every new Phase 02 finding on the 12 samples, with manual classification (quotes as stored: masked)

| # | Sample | Detector | Sev | Snippet (masked) | Class |
|---|---|---|---|---|---|
| 1 | #1 | flag-sensitive:aba | medium | `ABA routing: #0695` | TRUE |
| 2 | #1 | flag-sensitive:dda | medium | `DDA: #4951` | TRUE |
| 3 | #2 | flag-sensitive:aba | medium | `c/o State Street Bank Transfer Agency ABA: #0028` | TRUE |
| 4 | #2 | flag-sensitive:account | medium | `1776 Heritage Drive Account Number: #2584` | TRUE |
| 5 | #2 | defined-term:used-before-defined | medium | `(b) Named on the List of Specially Designated Nationals…` (OFAC) | TRUE (low value) |
| 6 | #2 | flag-sensitive:aba | medium | `ABA: #0028` | TRUE |
| 7 | #2 | flag-sensitive:account | medium | `Account Number: #2584` | TRUE |
| 8–10 | #2 | flag-placeholder:bullet | medium | `☐ Class S/D/I Shares - Fund #[●]` | TRUE ×3 |
| 11 | #2 | defined-term:used-before-defined | medium | `…professional certifications…` (SEC) | TRUE (low value) |
| 12 | #2 | defined-term:used-before-defined | medium | `11. The investor is a broker or dealer…` (Exchange Act) | TRUE (low value) |
| 13 | #2 | defined-term:used-before-defined | medium | `Signature of RIA Representative` | FALSE (signature caption) |
| 14–16 | #2 | flag-sensitive (repeat copy of the form) | medium | ABA / Account Number ×2 | TRUE ×3 |
| 17–19 | #2 | flag-placeholder:bullet (repeat copy) | medium | `Fund #[●]` ×3 | TRUE ×3 |
| 20 | #2 | defined-term:unused | medium | `Regulation Best Interest` defined, never used | TRUE |
| 21 | #3 | flag-sensitive:aba | medium | `ABA: #0028` | TRUE |
| 22 | #3 | flag-sensitive:dda | medium | `DDA: #1927` | TRUE |
| 23 | #3 | flag-placeholder:insert | medium | `FFC: … / [insert investor name]` | TRUE |
| 24 | #4 | defined-term:used-before-defined | medium | `…please contact the Fund…` (Fund defined in Section 3) | TRUE (low value) |
| 25 | #4 | flag-sensitive:aba-dda | medium | custodial option row, ABA # / DDA # | TRUE |
| 26 | #4 | defined-term:unused | medium | `Adviser` defined, never used | TRUE |
| 27 | #5 | flag-sensitive:aba | medium | `[ABA: #0028` | TRUE |
| 28 | #5 | flag-sensitive:dda | medium | `DDA: #1927` | TRUE |
| 29 | #5 | flag-placeholder:xx | medium | `Account Name: Partners Group [xx] DDA` | TRUE |
| 30 | #5 | flag-placeholder:insert | medium | `FFC: … / [insert investor name]]` | TRUE |
| 31 | #5 | flag-drafting-note:ntd | medium | `1 NTD: PG to confirm factual information…` | TRUE |
| 32 | #6 | flag-sensitive:aba | medium | `ABA: #0028` | TRUE |
| 33 | #6 | flag-sensitive:dda | medium | `DDA: #8489` | TRUE |
| 34 | #6 | flag-placeholder:insert | medium | `FFC: … / [insert investor name]` | TRUE |
| 35 | #7 | defined-term:used-before-defined | medium | `If you need assistance in completing this Subscription Agreement…` | FALSE (instructions cite the document title) |
| 36 | #7 | flag-sensitive:aba-dda | medium | wire line, ABA# + DDA# in one sentence (one finding, E3) | TRUE |
| 37 | #7 | defined-term:used-before-defined | medium | `By checking this box, the Company will send…` | TRUE |
| 38 | #7 | defined-term:duplicate | high | "Company" defined twice with different wording | TRUE |
| 39 | #10 | defined-term:used-before-defined | medium | `Subscription Agreement` (title line) | FALSE (title) |
| 40 | #10 | defined-term:unused | medium | `Net worth` (used in lower case) | FALSE (case) |
| 41 | #10 | defined-term:capitalization | medium | `Valuation of investments` (heading) | FALSE (heading) |
| 42 | #10 | defined-term:unused | medium | `SARs` defined, never used | TRUE |
| 43 | #12 | defined-term:used-before-defined | medium | `Similar Law` used before its definition | TRUE |
| 44 | #13 | flag-sensitive:aba | medium | `ABA: #0695` | TRUE |
| 45 | #13 | flag-sensitive:dda | medium | `DDA: #2925` | TRUE |

Result: 45 new findings, 40 true and 5 false (89% precision on real documents; all 5 false positives are medium `defined_term_issue`). No new finding is critical. #8 has none. The `[***]` redactions on #12 (21 occurrences) produce no finding.

## Investor paths on real samples (Agent-Probe, informational, no ground truth)

- #1: 9 types (individual, IRA, joint, trust, custodial, ERISA plan, partnership/LLC, estate, corporation). Completion: Section 13 (Acknowledgement and Signature). Every type reaches it; no dead end, no gap. This reads plausibly.
- #7: no investor-type option group was detected, so the empty state shows. That is plausible: #7's type list is not checkbox-shaped.
- #10: 8 types. Completion is the signature pages, but the main numbering scope has only 1 section, so the paths are trivially "Section 2". This is weak but correctly not asserted.
- #3/#5/#6 (role-routing rows) and #12: types and required items are extracted; no findings.

These results are residual, not a PASS. A ground-truth test is backlog P2-2.

## Fund I / II / Y fixtures and the demo seed (needed by 04b, 08, 10)

- `fund-I.html` (firm-x): 6 findings. `fund-I-decisions.json` holds 3 dismissals: `[insert …]` placeholder (`firm_standard_wording`), NTD (`no_form_impact`) and `[xx]` placeholder. `fund-I-answers.json` holds 3 counsel answers: broken conditional "Section 7" (A), option overlap (B), and "IRA … complete Section 4" (A).
- `fund-II.html` (firm-x): 8 findings = 3 `previously_dismissed` (all medium, non-blocking) + 2 `already_answered` (critical + high) + 2 new (`[●]` placeholder, "Drafting note") + 1 edited ("Section 4" → "Section 5": a different fingerprint, so it is labelled `new` with category `edited`, E11). That gives 5 handled and 3 needing action, i.e. 62.5% fewer to review (AC59).
- `fund-Y.html` (firm-y): the same passages, identical quotes and `quote_hash`; the fingerprints differ because the firm differs, so every label is `new` (firm isolation inputs, AC60).
- `demo-seed-spec.json` (partners-group). M7 expected path held: 3 same-pattern, same-reason dismissals (`flag-placeholder:insert` / `firm_standard_wording`) on #3, #5 and #6, plus 1 proposed firm rule. The C3 fallback is used because only 2 non-blocking fingerprints are shared across #3–#6 (ABA on #3/#6, DDA on #3/#5): both are dismissed on #3, and the 2 swapped Part B references on #3 are counsel-answered (blocking, so they show as "Already answered" on #5). All quotes are masked engine quotes, so there are no raw numbers.

## View fidelity (Agent-Probe; screenshots in `design-probe/`)

The probe compared app.html `#structure` and the app on sample #5 at 1440, 1199 and 1024. Files: `structure-mockup-{1440,1199,1024}.png`, `structure-app-{1440,1199,1024}.png`, plus `-1440-drawer` and `-1440-investors` for both.

| Rubric item | Result |
|---|---|
| Page head: serif "Structure" title, "N to check · sections, references" meta, "Show everything" at top right | match |
| Segmented control: 6 lenses in mockup order, warn chips with counts, selected tab on white | match |
| "Issues only: X of N…" status line | match. The mockup wraps it under the tabs at 1440 because its chips are wider; the app shows it inline. Both use the same flex-wrap rule |
| Table: header row, card rows with 2 px gap, serif reference text, status badges (Suspicious / Unresolved / Resolved) | match |
| Right drawer: kicker, serif title, badges, evidence quote with citation, Expected/Found pair, facts list, why text, rule provenance, black "Show in document" | match. The mockup shows "Finding F-01"; the app shows a "Linked finding" tag because finding ids are hashes |
| Investor types: type list with "n of N sections" and gap badge, selected type with an accent bar, path rows, skipped line, amber gap row with "Show in document" | layout matches; data differs (real #5 has no gaps, and titles are caps from the source) |
| Rail at 1199/1024: the badge shows the computed count | match |
| Tokens: only `tokens.css` variables; mockup hex values copied into `styles/structure.css` | match (`tokens-match-mockup` and `source-guard` green) |

Residual: 7 mockup icons are absent from the sprite and replaced (P2-7), and the flow diagram is a list rather than the SVG (P2-8). Overall judgement: faithful in layout, copy and tokens.

## Plan Deviations

See the plan's `## Deviations` (DV1–DV11). All are within the blast radius. There is no hard-stop class deviation: no contract or schema change, `contracts.json-schema.snap` is byte-identical, and there is no new dependency.

## What Was Skipped or Deferred

- U1 locator chip: explicitly deferred to Phase 05 (backlog P2-9; reason in the plan).
- Footnote markers on scans and OCR streams: Phase 06.
- Real-sample investor-path ground truth: backlog P2-2 (residual).
- Repo-wide `pnpm typecheck` and `pnpm lint` green: blocked by 04b's parallel WIP, not by this phase.

## Test Infra Gaps Found

- A Phase 01 EDGAR noise rule silently drops lines that start with "Type…" (P2-1). It was found only because a fixture lost its question line.
- The program's one-token runner rule: the `determinism` token matches 2 files (`determinism.test.ts` and `investor-path-determinism.test.ts`). That is harmless, but token names should stay unique.
- `security` (`redos.test.ts`) had no coverage of detector post-processing cost. The new 1 MB `ntd` case exposed a quadratic sentence-snap loop, now fixed and covered.

## Closeout Packet

- Selected plan: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-02-detectors-fixtures_PLAN_17-10-26.md`
- Finished: every checklist item A1–E3; Phase Loop step 5 ticked.
- Verified: final gate list items 1–14 and the gate 15 guards. Unverified: repo-wide typecheck and lint (04b WIP), and the stack-project `slice.spec.ts` (by inspection only, as E9 allows).
- Remaining for the orchestrator/UPDATE PROCESS: EVL re-run; registry `## Phase 02` additions (below); context docs (engine and ui groups) for the new detectors, investor model, structure view and fixtures builder.
- Best next state: EVL (vc-tester independent re-run of the contract gates), then UPDATE PROCESS.

Registry follow-up (in addition to E14): `packages/core/src/detectors/{util,flow}.ts`, `packages/core/src/investor/**`, `packages/core/src/structure-view/**`, `apps/web/src/styles/structure.css`, `apps/web/src/smoke.test.tsx`, `apps/web/e2e/triage-actions.spec.ts`, `packages/core/test/property/finding-schema-contract.test.ts`, `packages/core/test/security/redos.test.ts`, and `process/general-plans/backlog/core-followups_17-10-26/core-followups_REF_17-10-26.md` (Phase 02 section appended).

Follow-up stubs created: backlog `core-followups` § "Phase 02 follow-ups" (P2-1 … P2-9).

CONTEXT_PARTIAL: engine (new detectors, investor model, structure view, pattern_key module, mask widening); ui (#structure view, structure.css, computed badge); tests (seeded matrix, fixtures:build/check, one-token runner caveat).

Classification: **Keep in active/testing** until EVL re-runs the gates. Implementation matches the plan apart from the recorded within-radius deviations.

## Forward Preview

### Test Infra Found
- `pnpm --filter @aduin/scripts fixtures:build` regenerates every seeded and memory fixture; `fixtures:check` is the drift gate (byte-equal, catches stray files).
- `test:seeded` now fails on an empty set and checks one fixture dir per Phase 02 detector id.
- The e2e Node side may compute the view model with core `buildStructureView` (see `structure-view.spec.ts`).

### Blast Radius Changes
- `EngineResult.structure?: StructureView` (optional, additive) is on the worker wire.
- `OptionItem.footnote_marker?` (core-internal) and the WeakMap side channel `supSegmentsOf(line)` in `adapters/html.ts`.
- 10 new registry entries; `detectorById` covers them all.

### Commands to Stay Green
- `pnpm --filter @aduin/core test:golden`, `test:seeded`, `test:corpus`, `test`; `pnpm --filter @aduin/scripts fixtures:check`; `pnpm --filter @aduin/web test`, `test:e2e` (one token per call).
- After any detector change: `pnpm --filter @aduin/scripts fixtures:build`, then `fixtures:check`, and re-derive fund and demo expectations (the builder self-checks the AC59 arithmetic and throws on drift).

### Dependency Changes
- None by this phase (no lockfile change; scripts import core by relative path, E7). The working tree also holds 04b's `package.json`/`pnpm-lock.yaml` changes, which are not part of Phase 02.

## Review fix cycle (17-10-26, independent review verdict APPROVE_WITH_FIXES)

All fixes are in `packages/core` plus one line in `apps/web/src/engine/engine.worker.ts`. No golden, contracts snapshot or generated fixture changed (`test:golden` 44/44 byte-identical; `fixtures:check` OK, 46 files). Regression tests: `packages/core/test/unit/review-fix-cycle.test.ts` (14 tests).

| Finding | Change | Test |
|---|---|---|
| F1 (HIGH) long option groups throw ZodError; one throw loses every finding | `detectors/util.ts`: `listLabels` (first 5 + "and N more"), `maskFacts` clamps strings to 400 chars after masking; `footnote-requirement.ts` uses `listLabels` and caps markers at 5; `investor-path-missing-item.ts` dedupes `peers` and `investor_type`; `findings/make-finding.ts` clamps explanation 1000 / facts 1000 / interpretations 500 (max 6) / expected 300; `engine.ts` wraps each `d.run(g)` in try/catch and pushes `{stage:'detector', detectorId, code: error name}` into optional `EngineSettings.diagnostics` (no message, no document text) | 100-option group + one `<sup>` gives one schema-valid finding ("and 94 more"); a throwing detector is recorded and the other findings still return |
| F2 (MED) slice before mask | new `maskThenClip(s, n)` used in flag-drafting-note, broken-conditional, option-gap-overlap, unreachable-flow (same pattern), `whereOf` scope titles, and every `m(x.slice())` in `structure-view/build.ts`; `excerpt()` widens its window to whole sensitive spans and masks the cut text | `990000017` swept across every clip boundary (260 docs); asserts no 4-digit raw window leaks besides `#0017`. Confirmed red when `maskThenClip` was temporarily switched back to slice-first |
| F3 (MED) `ACCOUNT_NUMBER_RE` gaps | `memory/mask.ts`: alpha branch `\b[A-Za-z]{1,4}-?\d{6,130}`; digit branch `\d(?:[ \-–./NBSP]?\d){5,130}` with no word-boundary assertions (runs glued to letters are caught; runs longer than the bound match in adjacent chunks that `mask()` merges). All quantifiers bounded | 9 cases (40 digits after prefix, `acct…`, `021000021x`, `.`, `/`, en-dash, NBSP, 60 grouped digits, 304-digit run); ReDoS suite and the 100k hostile-input test pass |
| P2-1 EDGAR wrapper rule dropped real lines | `adapters/html.ts` rule now the anchored shape (`EX-…`, `<TAG>…`, `TAG:…`, case-sensitive tags) | Keeps "Type of Subscriber (check one):", "Documentation ☐ …", "Text of Section 4"; drops "EX-99.(P)(2)", "<TYPE>10-K", "TYPE: 10-K"; sample #10 has no wrapper noise and keeps its "Documentation" line |
| F5 | `unreachable-flow.ts` pushes into existing adjacency arrays; `sectionIndex` memoized per graph (WeakMap) | full suite |
| F6 | exported `CAP_WORD_BEFORE_RE`, `CAP_WORD_AFTER_RE` (defined-term-issues) and `PARTS_OF_RE`, `SECTION_RE`, `PART_RE` (flow) so the ReDoS suite collects them | `test security` |
| F8 | empty catch around `buildStructureView` now `console.warn('[engine] structure_view_failed', <error name>)` (no document text) | web typecheck, `test import-graph` |
| F9 | `where` and term ids wrapped in `m()` in `structure-view/build.ts` | covered by the F2 sweep |

**Re-baseline note (P2-1):** no golden covers sample #10's investor paths, so nothing was re-baselined. Sample #10 now keeps the "Documentation ☐ For entity investors…" line, which can change its investor-path view and findings on the Findings/Structure screens. The corpus ceiling still holds.

**F10 hash note:** F3 masks more spans, so `quote_hash` changes for any quote that holds a newly masked run (prefixed / glued / dot-, slash-, dash- or NBSP-separated numbers, or runs over 32 digits). `FP_VERSION` is unchanged on purpose: no stored memory exists yet. Phase 04b/05 must not assume these hashes match pre-fix values.

**Deferred:** F4 (quadratic defined-term scans) goes to Phase 05 / backlog P2. F7 skipped: `tokens.css` has no tokens for `#f7f9f6`, `#3f2a00`, `#5a4000` (the mockup CSS uses the same raw hex). F11/P2-5 (date masking) is out of scope. Note: the widened digit branch now also masks 6+ digit dates written with `/` or `.` (e.g. `10/17/2026`). No existing test covers this.

**Gates (each a separate call, one token, no `--`):** core `test security` 6 files / 27 tests; `test:golden` 5 / 44; `test:seeded` 1 / 2; `test` 37 / 291; core `typecheck` exit 0; web `test import-graph` 1 / 4; web `typecheck` exit 0; `fixtures:check` OK; eslint + prettier clean on touched files.
