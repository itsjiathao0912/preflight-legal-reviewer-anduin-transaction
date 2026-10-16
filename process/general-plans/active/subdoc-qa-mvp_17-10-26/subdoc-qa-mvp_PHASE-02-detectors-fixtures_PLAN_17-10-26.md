---
name: plan:subdoc-qa-mvp-phase-02-detectors-fixtures
description: "Sub-doc QA MVP — Phase 02: remaining deterministic detectors, flags, terms, investor-type paths, pattern_key, seeded and fund I/II fixtures, and the approved #structure view"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-02
---

# Phase 02 — Remaining Detectors, Flags, Investor Paths, Fixtures, Structure View

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: 🔧 EXECUTE done 17-10-26 (all contract gates green in scope; EVL pending)
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** 🔧 EXECUTE done (EVL pending)
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-02-detectors-fixtures_REPORT_17-10-26.md

---

## Overview

Follows the vertical slice (Phase 02 does not block Phase 03, which is already done). Context routers: `process/context/all-context.md`, `process/context/ui/all-ui.md`, `process/context/engine/all-engine.md`, `process/context/product-domain.md` (taxonomy), `process/context/tests/all-tests.md`, `samples/sub-docs/README.md`. Completes the deterministic rule set on the Phase 01 engine: broken conditionals, unreachable/circular flow, option gap/overlap, defined-term issues (duplicate, unused, used-before-defined, capitalization), inconsistent footnote/requirement, drafting notes, placeholders, sensitive data (masked), plus **investor-type path extraction** with dead-end and missing-item detectors. The web side builds the real approved **`#structure` view** from `design/mockups/app.html` (`#structure`) and `design/mockups/app_NOTES.md`: six sub-views (Sections, Cross-references, Conditions, Option groups, Defined terms, Investor types), "Issues only" by default with a "Show everything" toggle, row detail in a right drawer, and a computed `nav-badge-structure`. It also writes the per-detector `pattern_key`, the seeded-defect fixtures (one per class), the **fund I / fund II / firm Y fixtures** that power every memory proof (AC44, AC45, AC47, AC59, AC60), and the demo-seed spec. The UI hold is released; no new mockup file is authored.

## Phase Completion Rules

- CODE DONE = detectors, fixtures, Structure view committed.
- VERIFIED = Exit Gate green, validate-contract written, corpus precision/ceiling report recorded, regression: Phase 01 goldens and the FULL Phase 03 preview e2e suite green (after the named spec adaptations). Severity caps from Phase 01 (label-coherence, sensitive_data) are revisited only with corpus evidence in the report.

## Acceptance Criteria

Each criterion names its proving scenario (`proven by`) and one strategy; gates below back-reference the criterion id.

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC10 | Flags drafting notes (NTD:), placeholders (`[xx]`, `[insert investor name]`), sensitive numbers (ABA/DDA in #1, #7); values masked by default with reveal | `flags-ntd-placeholder-sensitive`, `mask-widening`, `security` + `reveal-sensitive` e2e | Fully-Automated | reveal control built in P03; F3 widening folded in |
| AC17 | `#structure` lists sections, cross-references with status, conditions, option groups with cue, defined terms; Issues only default; Show everything; row drawer | `structure-view` e2e (Fully-Automated) + view-fidelity screenshot probe (Agent-Probe) | Fully-Automated | view fidelity to app.html is Agent-Probe only |
| AC18 | Seeded-defect coverage: every deterministic class has a fixture and is detected | `seeded-defect-matrix` (`test:seeded`; precision ≥ 90%, recall 100%) | Fully-Automated | re-run at P10 |
| AC61 | Investor-type path view lists sections/questions per type; deterministic | `investor-path-extraction-fixtures` + `investor-path-determinism` + `investor-path-view` e2e | Fully-Automated | — |
| AC62 | Types with no valid path or missing required items flagged with clause cited; inline gap row in view | `investor-path-seeded-defects` + `investor-path-view` (gap row via uploaded seeded fixture) | Fully-Automated | — |
| AC59 | Memory proof arithmetic over fund II: 8 findings without memory, 3 non-blocking previously handled + 2 counsel-answered = 5 handled, 3 need action (2 new + 1 edited) = 62.5% fewer to review | `memory-fixtures` | Fully-Automated | consumed by 04b, 08, 10 |
| AC44/AC45/AC47/AC60 | fund I/II/Y labels and firm isolation inputs exist and equal engine output | `memory-fixtures`, `demo-seed-spec` | Fully-Automated | end-to-end label proofs live in 04b/08/10 |

Contributes proofs for AC8/AC9 (new rules join the registry loops: `determinism`, `explanation-present-per-rule`) and AC7 (`finding-schema-contract` re-run, extended additively for masked quotes).

## Entry Gate

- Phases 00, 01, 03, 04a verified; Milestone 1 (vertical slice) live; HEAD >= 70d320b. All holds released (UI hold released; `#structure` in app.html approved). Phase 04b (`apps/worker/**`, `scripts/src/seed`) runs parallel and is disjoint.
- D-7: corpus = 12 HTML samples in Phase 02 (`test:corpus`); the #9 scans are Phase 06; #14 is local-only. D-8: axe is dev-only (a11y smoke runs only in the e2e project, never shipped).
- Program test-command rule (no `--`): `pnpm --filter <pkg> test <one-file-name-token>`; ONE token per call; the token must equal a test file name; a token that matches nothing is red.

## Library pins (confirm via vc-docs-seeker in Phase 00)

htmlparser2, zod, fast-check, Vitest; `defined-terms-checker` (MIT) is a reference for rules only, ported with own tests and notice in `THIRD_PARTY_NOTICES.md`. LexNLP, clausebox and other AGPL/no-license sources are never copied.

## Touchpoints (create/modify)

```
packages/core/src/detectors/{broken-conditional.ts,unreachable-flow.ts,option-gap-overlap.ts,defined-term-issues.ts,footnote-requirement.ts,flag-drafting-note.ts,flag-placeholder.ts,flag-sensitive.ts,investor-path-dead-end.ts,investor-path-missing-item.ts}
packages/core/src/investor/{types.ts,extract.ts,paths.ts}            type vocabulary (individual, joint, trust, IRA, entity, ERISA plan, custodial, ...), path model; plain data, core-internal (not a v1 contract schema)
packages/core/src/structure-view/build.ts                              pure `buildStructureView(graph, structure, findings)` -> plain-data StructureView (6 lenses + issue counts + badge total); exported from index.ts (append)
packages/core/src/memory/patternKey.ts                                the single pattern_key implementation (sanitizer; see Public Contracts)
packages/core/src/findings/make-finding.ts                            EDIT (narrow): `patternKey` becomes a re-export of memory/patternKey.ts, byte-identical output
packages/core/src/memory/mask.ts                                      EDIT (additive, F3): widen ACCOUNT_NUMBER_RE (bounded, linear)
packages/core/src/adapters/** + structure/option-groups.ts            EDIT (additive, A3): optional `footnote_marker` on option labels read from `<sup>` text
packages/core/src/detectors/registry.ts                               (append registrations; seam)
packages/core/src/index.ts                                            (append exports; seam; no duplicate `patternKey` export)
packages/core/package.json                                            EDIT (seam, additive): `test:seeded` loses `--passWithNoTests`
packages/core/test/{seeded,unit,property,golden,security}/…           new + extended tests (see Test Gates); `test/property/finding-schema-contract.test.ts` extended additively (masked quote via mask(text.slice(anchor)))
fixtures/html-seeded/<class>/<case>.html + expected.json              one clean control + >=1 defect per class and detector; synthetic non-routable numbers only
fixtures/memory/{fund-I.html,fund-II.html,fund-Y.html,fund-expectations.json,fund-I-decisions.json,fund-I-answers.json,demo-seed-spec.json}
scripts/src/fixtures/{build-seeded.ts,find-shared-passages.ts,check.ts}
scripts/package.json                                                  EDIT (seam shared with 04b; serialized): add `fixtures:build` and `fixtures:check`
.prettierignore                                                       EDIT (seam, additive) ONLY if generated fixtures cannot be made prettier-clean (see Risks)
apps/web/src/features/structure/**                                    the #structure view (6 sub-views, Issues only / Show everything, right drawer)
apps/web/src/features/investor-paths/**                               Investor types sub-view (type list, ordered path, inline gap row), hosted by the structure view
apps/web/src/features/registry.ts                                     APPEND one line: id `structure` (last entry wins over the placeholder)
apps/web/src/engine/types.ts                                          EDIT (narrow, additive, Phase 03 file): optional `structure?: StructureView` on EngineResult (type-only import from core)
apps/web/src/engine/engine.worker.ts                                  EDIT (narrow, additive, Phase 03 file): call `buildStructureView` and attach `structure`
apps/web/src/shell/Sidebar.tsx                                        EDIT (narrow, additive, Phase 03 file): computed `nav-badge-structure` from `structure.badge`
apps/web/e2e/{structure-view,investor-path-view,reveal-sensitive}.spec.ts   new specs
apps/web/e2e/{gate-pill,filter-sort,previously-handled-section,dismiss-requires-reason,placeholder-routes,app-shell,a11y-smoke}.spec.ts   EDIT (P03-owned specs, P02 adaptation; see Step E)
apps/web/e2e/slice.spec.ts                                            POSSIBLE edit (04a-owned, stack project): only if sample #1 output changes the asserted target (see Step E)
```

Published testids (stable contract for the specs): `structure-view`, `structure-lens-{sections|crossrefs|conditions|options|terms|investors}`, `structure-issue-count-{lens}`, `structure-toggle-everything`, `structure-row`, `structure-drawer`, `investor-type-row`, `investor-path-step`, `investor-gap-row`, `investor-empty-state`, `nav-badge-structure`.

## Public Contracts

- Every detector supplies `id`, `class` (taxonomy code), `severity`, `explain()`, `patternKey()`; registry loops (AC9) enforce it. `explain()` and `patternKey()` are TOTAL functions over sparse facts (the AC9 test passes `{reference, used_term, defined_term}` only): missing keys never throw and never print `undefined`.
- **`pattern_key` spec (real helper output, locked):** `<detector_id>[:<shape>]`; `shape` is lowercased, every digit run replaced by `#`, whitespace runs replaced by `-`, any character outside the charset `[a-z0-9:#>-]` removed, total capped at 80 chars, never containing `|` (the D1 `proposal_key` delimiter). Examples (real output): `ref-label-coherence:part-b-of-section-#`, `undefined-term:units->shares`, `flag-placeholder:xx`. AI findings use `ai:<task_id>:<class>`. Numbers never appear (digit-free keys). Reason `other` never proposes a rule. `memory/patternKey.ts` owns the implementation; `findings/make-finding.ts` re-exports it with byte-identical output for all existing keys (proved by the existing goldens plus the `pattern-key` test); the index barrel keeps exactly one `patternKey` export; `contracts.json-schema.snap` stays byte-identical (E3).
- Every finding produced on #1/#3/#5/#11 carries >= 3 `detail.facts`, a truthy `detail.expected`, and a digit-free `pattern_key` (golden loop invariants).
- Masking: `detail.facts`, `detail.explanation`, `detail.expected` and every document-derived string pass through `mask()` (backlog R1); `buildFinding` default masking is kept AND detectors mask facts themselves; `flag-sensitive` facts = `last4` + `cue` only; the unmasked value never reaches `quote_hash` input, snippet, Dexie or any log.
- Investor path model: `InvestorPath {type, sections[], questions[], required[], reachesCompletion: boolean, citations[]}` is a core-internal plain-data type, NOT a v1 contract schema (snapshot unchanged); deterministic order; valid path = the conditional graph from the start node reaches the signature/completion node when the type is selected.
- Wire contract (additive): `EngineResult.structure?: StructureView` (optional; older consumers ignore it). `StructureView` is plain data produced by the pure core function `buildStructureView`, called ONLY inside `engine.worker.ts`; the main thread imports types only (`import-graph.test` allows a fixed list of value imports from `@aduin/core` and is not widened).
- Severity rules: broken conditional, unreachable flow, investor_path_dead_end = `critical`; option gap/overlap, footnote inconsistency = `high`; defined-term issues = `medium`/`high` by kind; drafting note, placeholder = `medium`; sensitive_data capped `medium`; investor_path_missing_item = `high`.
- `investor_path_missing_item` covers BOTH "must also complete Part C" and the app.html PATH-04 case (a peer type carries an item, such as footnote 2, that this type lacks).
- Fixture contract (`fund-expectations.json`): metadata block (firm id, fund name per fixture; firm identity lives here, not in the HTML) and per passage the expected label. Fund II exactly: 3 non-blocking `previously_dismissed`, 2 `already_answered` (counsel answers for 2 findings; these may be blocking), 2 `new`, 1 `edited` ("Section 4" edited to "Section 5": different fingerprint, still a real engine finding) = 8 findings. Blocking dismissals stay in the main list (AC48), so the 3 previously handled passages are non-blocking. fund-Y holds the identical passages under another firm: identical quotes, fingerprints differ because the firm differs. All fingerprints come from real engine output (never hand-made).

## Blast Radius

`packages/core/src/{detectors,investor,structure-view,adapters,structure/option-groups.ts,memory/patternKey.ts,memory/mask.ts,findings/make-finding.ts}`, `packages/core/package.json` (`test:seeded`), `packages/core/test/**`, `fixtures/{html-seeded,memory}`, `scripts/src/fixtures`, `scripts/package.json`, `apps/web/src/features/{structure,investor-paths}`, three new e2e specs plus the named P03 spec adaptations. Narrow additive edits to Phase 03 files: `apps/web/src/engine/{types.ts,engine.worker.ts}`, `apps/web/src/shell/Sidebar.tsx`, `apps/web/src/features/registry.ts` (append). Disjoint from Phase 04b (`apps/worker/**`, `scripts/src/seed`) except the `scripts/package.json` seam (serialized). Barrel/registry/package.json edits are append-only seam lines. Registry `## Phase 02` (see Registry follow-up).

## Registry follow-up

The orchestrator/update-process agent owns `phase-blast-radius-registry.md` (this plan does not edit it). The `## Phase 02` entry must be updated to include:
- Added areas: `packages/core/src/{structure-view,memory/mask.ts,adapters,structure/option-groups.ts,findings/make-finding.ts}`, `packages/core/package.json` (`test:seeded`), `scripts/package.json` (`fixtures:build`, `fixtures:check`; seam shared with 04b, serialize), `apps/web/src/features/structure/**`, `.prettierignore` (only if needed).
- Narrow additive edits to Phase 03 files: `apps/web/src/engine/types.ts`, `apps/web/src/engine/engine.worker.ts`, `apps/web/src/shell/Sidebar.tsx`, `apps/web/src/features/registry.ts` (append).
- P03-owned spec adaptations: `gate-pill`, `filter-sort`, `previously-handled-section`, `dismiss-requires-reason`, `placeholder-routes`, `app-shell`, `a11y-smoke` (and `slice.spec.ts` only if #1 output changes the asserted target; owner 04a).
- Seams to serialize: `detectors/registry.ts`, `src/index.ts`, `features/registry.ts`, `scripts/package.json`, `packages/core/package.json`.

## Data Flow

Graph (Phase 01) → detectors → findings with `patternKey` (facts masked); graph → investor extractor (option groups with investor-type labels, conditionals, "must also complete Part C") → paths → detectors → findings. In the worker: graph + structure + findings → `buildStructureView` (pure, core) → `EngineResult.structure` (additive optional) → main thread renders the `#structure` lenses and `nav-badge-structure` (issue count computed from the same view model). Fixtures → `fixtures:build` → HTML + expected JSON → seeded-defect matrix; `fixtures:check` rebuilds and compares with committed files (drift gate). Footnote markers: adapter reads `<sup>` text on option labels into an additive optional `footnote_marker` field consumed by `footnote-requirement`.

## Failure Modes

No investor-type option group found → empty path view with "No investor types detected" (not an error); ambiguous conditional → path marked `uncertain` and no dead-end finding (never assert on uncertainty); false-positive flood → corpus ceiling check (< 40 high+critical per doc, 12 HTML samples) fails the gate; structurer fails (`stage_failed`) → `structure` absent and the view shows its empty state; widened mask regex must stay linear (ReDoS suite).

## Deferred

- **U1 locator chip ("§N ¶N") — DEFERRED to Phase 05** (explicit decision, not built in Phase 02). Reason: the gap is in the engine `toView.ref` (section only; paragraph part missing) and in `features/review/**` rendering, a Phase 03 UI surface that Phase 05 touches next for the AI lane; Phase 02 already edits three Phase 03 files and widening that surface adds regression risk without proving any Phase 02 criterion. Record the carry in the phase report and the backlog `core-followups` entry.
- Footnote markers on real scanned documents / OCR JSON line streams: Phase 06 (A3 proof here is the seeded fixture only).
- Real-sample investor-path accuracy (#1, #7, #10): informational Agent-Probe only; backlog stub for a ground-truth test (residual, never a PASS).

## Implementation Checklist

### Step A — Detectors (registry appends serialized, one detector group at a time; run `pnpm --filter @aduin/core test:golden` after each group, STOP if a golden changes)
- [x] A1. `broken-conditional`, `unreachable-flow` (reachability + cycle detection over conditional edges), `option-gap-overlap` (exclusivity cue vs structure), with `explain` facts (>= 3 facts each, truthy `expected`).
- [x] A2. `defined-term-issues` (used-but-undefined, duplicate, unused, used-before-defined, inconsistent capitalization) with false-positive filters; port rules from defined-terms-checker with own tests.
- [x] A3. `footnote-requirement` (option group where some options carry a footnote marker and sibling options do not). Marker reading rule: the HTML adapter/structurer adds an optional `footnote_marker` (the text of a `<sup>` element inside the option label) to the option model; existing fields and contract schemas are unchanged. Proof: a seeded fixture in `fixtures/html-seeded/footnote-requirement/` (clean control with markers on all siblings, defect with a marker on one sibling only). OCR JSON line streams (#9) stay Phase 06; a real-scan proof is Phase 06.
- [x] A4. Flags: `flag-drafting-note` (NTD:, "Drafting note"), `flag-placeholder` (`[xx]`, `[insert …]`, `[●]`; never `____` blanks or `[ ]` checkboxes), `flag-sensitive` (ABA/DDA/routing/account with context cues; facts = last4 + cue only) using `mask.ts`; `[***]` redaction noted as info only. New findings on #3/#5/#6 (and #1/#7 sensitive) are legitimate AC10 behavior.
- [x] A5. `memory/patternKey.ts` sanitizer (charset `[a-z0-9:#>-]`, digits to `#`, 80 cap, no `|`), `make-finding.ts` re-export (byte-identical for existing keys), per-detector total `patternKey()`; unit test `pattern-key` (digits stripped, 80-char cap, charset, stable, existing keys unchanged).
- [x] A6. F3: widen `ACCOUNT_NUMBER_RE` in `memory/mask.ts` (digit runs over 31, IBAN, alpha-prefixed account) bounded and linear (explicit upper bounds, no nested quantifiers); `mask-widening` test; `test:vectors` and `test:golden` unchanged.
- [x] A7. Security: facts/explanation/expected masked; new test `security/sensitive-no-raw` asserting no finding JSON field contains the raw digits of a synthetic ABA/DDA; add every new regex and the widened mask regex to `security/redos.test.ts` (hostile-input linear-time cases).
- [x] A8. Extend `test/property/finding-schema-contract.test.ts` additively: for sensitive quotes compare `mask(text.slice(anchor))` to `quote`, otherwise the existing `text.slice(anchor) === quote`.

### Step B — Investor paths
- [x] B1. `investor/extract.ts` + type vocabulary; `paths.ts` path computation; `investor-path-dead-end` (critical only when the graph proves no route), `investor-path-missing-item` (Part C case and app.html PATH-04 peer-item case).
- [x] B2. Tests: `investor-path-extraction-fixtures` (per type), `investor-path-determinism` (5 runs equal), `investor-path-seeded-defects` (dead-end, missing item both forms, clean control silent, uncertain never asserted); run on samples #1, #7, #10 as informational (Agent-Probe, recorded in the report).

### Step C — Seeded and memory fixtures
- [x] C1. `scripts/src/fixtures/build-seeded.ts` + `fixtures/html-seeded/*` (one clean control and >= 1 defect per class and detector, synthetic non-routable ABA/DDA numbers); generated HTML is prettier-clean (else the `.prettierignore` seam edit is recorded); remove `--passWithNoTests` from `test:seeded`; `seeded-defect-matrix` test in `packages/core/test/seeded/` (precision >= 90%, recall 100%; an empty dir fails). Add `fixtures:build` and `fixtures:check` to `scripts/package.json` (serialized seam).
- [x] C2. `fixtures/memory/fund-I.html`, `fund-II.html`, `fund-Y.html` + `fund-expectations.json` (metadata + labels as in Public Contracts, AC59 arithmetic 8 / 5 handled / 3 need action = 62.5% fewer), `fund-I-decisions.json`, `fund-I-answers.json`; all fingerprints derived from engine output. Gate `memory-fixtures` (`packages/core/test/unit/memory-fixtures.test.ts`): engine output on fund I / II / Y equals `fund-expectations.json` (labels, 3 unchanged non-blocking, 2 answered, 2 new, 1 edited with a different fingerprint, fund-Y identical quotes with fingerprints differing by firm).
- [x] C3. `scripts/src/fixtures/find-shared-passages.ts`: run the engine on #3–#6 with firm `partners-group`, list fingerprints occurring in >= 2 documents, rank non-blocking first; choose >= 3 for the demo seed; if fewer than 3 non-blocking shared findings exist, author the demo as dismissals on shared non-blocking findings plus counsel-answered swapped-reference findings and record the choice (swapped refs are blocking, so they demonstrate "Already answered" and "Dismissed in [fund], re-confirm", not "Previously handled"). Expected path (M7): the >= 3 same-pattern same-reason dismissals span samples #3, #5, #6 (placeholders). M7 fallback if those do not yield 3 shared same-pattern findings: use any shared non-blocking pattern across #3–#6, else the C3 fallback; record the choice in the report.
- [x] C4. `fixtures/memory/demo-seed-spec.json` (`DemoSeedSpec` from Phase 01 contracts): decisions on sample #3, >= 3 same-pattern same-reason dismissals for one pattern (M7), one firm rule. Gate `demo-seed-spec` (`packages/core/test/unit/demo-seed-spec.test.ts`): parses with `DemoSeedSpecSchema`; every decision quote equals a real engine finding on its `sample_id`; >= 3 same-pattern same-reason dismissals (or the documented fallback).

### Step D — Corpus and Structure view
- [x] D1. `pnpm --filter @aduin/core test:corpus`: report per-document counts and top false-positive causes; ceiling < 40 high+critical per doc over the 12 HTML samples (D-7); list each new finding on the 12 samples for manual true/false classification; record in the phase report; adjust severity caps with evidence.
- [x] D2. `packages/core/src/structure-view/build.ts` (pure `buildStructureView`; unit test `structure-view-build`: lens contents, issue counts, badge total, determinism) and the worker wiring (`types.ts` additive optional field, `engine.worker.ts` call, main thread type-only imports).
- [x] D3. `apps/web/src/features/structure/**` per app.html `#structure` and `app_NOTES.md`: six lens tabs with issue counts, "Issues only" default, "Show everything" toggle (also reveals external statutory citations, which are never listed as internal, and the optional flow diagram toggle), restart badge on sections, cross-references with status, conditions, option groups with cue, defined terms, right-hand row drawer, Investor types lens (`features/investor-paths/**`: type list, ordered path, inline gap row, Partnership or LLC pre-selected rule from app.html, "No investor types detected" empty state). Register by appending `{ id: 'structure', ... }` to `features/registry.ts`. Tokens from the approved app.html only (no new tokens, no new mockup).
- [x] D4. `Sidebar.tsx`: computed `nav-badge-structure` from `structure.badge` (replaces the hard-coded value), additive.
- [x] D5. Specs: `structure-view.spec.ts` (6 lenses present, Issues only default, Show everything raises row count, drawer opens, statutory cites not internal, badge equals computed total, derived from engine output not hard-coded), `investor-path-view.spec.ts` (type list, ordered path, gap row via an uploaded seeded fixture, empty state), `reveal-sensitive.spec.ts` (masked by default in list and document; reveal shows value; hash and snippet never contain the raw value).

### Step E — Phase 03 regression repair (owned by this phase)
- [x] E1. BEFORE writing detectors: run the full preview suite `pnpm --filter @aduin/web test:e2e` and record the baseline (all green expected). Run again after Step A and Step D to see which P03 specs change.
- [x] E2. Edit only these P03 specs, each recorded as an EXPECTED change with a note in the report (new findings on #3/#5/#6 are legitimate AC10 behavior); derive counts from engine output via `engineFindings()` (or filter to the golden class) instead of hard-coding:
  - `gate-pill.spec.ts` (#5 "Blocked · 2", `findings-meta` "2 open · 2 block"): derive block/open counts from `engineFindings()`.
  - `filter-sort.spec.ts` (#3 chips and row counts): derive from `engineFindings()` / filter to the golden class.
  - `previously-handled-section.spec.ts` (#5/#3 counts): derive counts.
  - `dismiss-requires-reason.spec.ts` (`toHaveCount(4)`): derive the count.
  - `placeholder-routes.spec.ts`, `app-shell.spec.ts`: remove Structure from the placeholder lists (it is now a real view).
  - `a11y-smoke.spec.ts`: switch the placeholder audit to another still-placeholder route and add a `#structure` audit.
  - Any other preview spec that fails after Step A/D: add it here with a derived-count fix, never weaken an assertion about product behavior.
- [x] E3. `slice.spec.ts` (04a-owned, stack project, asserts sample #1 behavior: golden "this Section 11" finding, dismiss, gate, quota): the #1 golden output must not change. New sensitive flags on #1 add findings but the spec asserts the golden finding and derives open counts; verify with `pnpm slice:check` only if the M1 deploy path is touched (it is not), otherwise inspect the spec: if #1 output would change the selected `target` row, list `slice.spec.ts` as an edited file (filter the target to the golden class) and record it in the report and the Registry follow-up.

## Test Gates (commands created in this phase)

All commands use the program no-`--` form, one file-name token per call; a token that matches no file is red.

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| flags | `pnpm --filter @aduin/core test flags-ntd-placeholder-sensitive` | Fully-Automated | AC10 |
| mask widening | `pnpm --filter @aduin/core test mask-widening` then `pnpm --filter @aduin/core test:vectors` | Fully-Automated | AC10 (F3) |
| security | `pnpm --filter @aduin/core test security` | Fully-Automated | AC10 (no raw sensitive value; ReDoS) |
| pattern key | `pnpm --filter @aduin/core test pattern-key` | Fully-Automated | pattern_key spec |
| seeded matrix | `pnpm --filter @aduin/core test:seeded` (no `--passWithNoTests`) | Fully-Automated | AC18 |
| investor paths | `pnpm --filter @aduin/core test investor-path-extraction-fixtures`; `... investor-path-determinism`; `... investor-path-seeded-defects` | Fully-Automated | AC61, AC62 |
| structure view build | `pnpm --filter @aduin/core test structure-view-build` | Fully-Automated | AC17 |
| registry loops | `pnpm --filter @aduin/core test explanation-present-per-rule`; `pnpm --filter @aduin/core test determinism` | Fully-Automated | AC9, AC8 re-run |
| schema contract | `pnpm --filter @aduin/core test:property` | Fully-Automated | AC7 re-run over new rules |
| memory fixtures | `pnpm --filter @aduin/core test memory-fixtures` | Fully-Automated | AC59/AC60/AC44/AC45/AC47 inputs |
| demo seed | `pnpm --filter @aduin/core test demo-seed-spec` | Fully-Automated | D-7 / M7 |
| fixtures drift | `pnpm --filter @aduin/scripts fixtures:check` | Fully-Automated | committed fixtures equal fresh build |
| corpus ceiling | `pnpm --filter @aduin/core test:corpus` | Fully-Automated | success metric (false-alarm ceiling) |
| web views | `pnpm --filter @aduin/web test:e2e structure-view`; `... investor-path-view`; `... reveal-sensitive` | Fully-Automated | AC17, AC61/AC62, AC10 |
| regression | `pnpm --filter @aduin/core test:golden`, then `pnpm --filter @aduin/web test:e2e` (FULL preview suite), then `pnpm typecheck`, `pnpm lint`, `pnpm guard:cf`, `pnpm secrets:scan` (separate calls) | Fully-Automated | Phase 01/03 intact |
| view fidelity | screenshots of `#structure` at 1440/1199/1024 compared with app.html (P03 design-probe pattern) | Agent-Probe | AC17 view fidelity |

Failing stubs for red-first are listed in the Validate Contract below.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `flags-ntd-placeholder-sensitive`, `mask-widening`, `security` | Fully-Automated | AC10 |
| `reveal-sensitive` e2e | Fully-Automated | AC10 (reveal control) |
| `structure-view` e2e, `structure-view-build` | Fully-Automated | AC17 |
| `seeded-defect-matrix` (`test:seeded`) | Fully-Automated | AC18 |
| `investor-path-extraction-fixtures`, `investor-path-determinism`, `investor-path-view` e2e | Fully-Automated | AC61 |
| `investor-path-seeded-defects`, gap row in `investor-path-view` | Fully-Automated | AC62 |
| `memory-fixtures`, `demo-seed-spec` | Fully-Automated | AC59, AC60, AC44, AC45, AC47 (inputs) |
| `explanation-present-per-rule`, `determinism`, `test:property` | Fully-Automated | AC9, AC8, AC7 |
| Structure view vs app.html at 3 widths | Agent-Probe | AC17 (fidelity) |
| investor paths on #1, #7, #10 | Agent-Probe | AC61 (informational, no ground truth; backlog stub for a ground-truth test) |

```bash
pnpm --filter @aduin/core test:golden
pnpm --filter @aduin/core test:seeded
pnpm --filter @aduin/core test:corpus
pnpm --filter @aduin/web test:e2e
# Expected: each exits 0 (separate calls); corpus report lists no document above the ceiling
```

## Exit Gate

- All gates green; seeded matrix precision >= 90%, recall 100% for deterministic classes; corpus ceiling met; full preview e2e suite green after the recorded spec adaptations.
- Fund I/II/Y fixtures and `demo-seed-spec.json` committed and described in the report (needed by Phases 04b, 08, 10); `fixtures:check` green.
- Phase report written, including expected-change notes for each adapted P03 spec and the U1 deferral to Phase 05.

## Risks and Kill Criteria

- Investor-type vocabularies vary across samples: start with the vocabulary seen in #1, #7, #10 and seeded fixtures; unknown types are shown as "unclassified option", never flagged as defects. #10 has about 16 types; `critical` only when the graph proves no route.
- Heuristic false positives (label-coherence, footnote inconsistency): if corpus ceiling fails, demote severity to `high`/`medium` and record the cause; do not add suppression lists that hide real goldens (AC11–AC13 must stay green).
- Too few shared non-blocking passages in #3–#6 for the demo seed: fallback in step C3 (M7 fallback).
- Generated fixtures failing prettier: make the builder output prettier-clean first; only then add the `.prettierignore` seam lines (recorded in the Registry follow-up).
- Widened mask regex becoming super-linear: bounded quantifiers only, covered by the ReDoS suite.

## Cost / Secret Hygiene

No network, no LLM. Sensitive values from #1/#7 are masked before hashing and storage; fixtures use synthetic non-routable ABA/DDA numbers and contain no real credentials; no raw number in any expected.json, snapshot, log or report; secret scan runs in the regression gate.

## Rollback

`git revert` phase commits; registry appends are removable; fixtures are additive; the `structure` field on EngineResult is optional so reverting the worker edit leaves consumers valid.

## Blockers That Would Justify BLOCKED Status

- Golden tests from Phase 01 regress and cannot be fixed without removing a rule.
- Demo seed cannot be built honestly from #3–#6 and the user must choose a different demo sample.
- A contract change to `contracts/**` appears necessary (E3: stop and route to PLAN).

## Deviations

Within-blast-radius deviations (autopilot: documented, continued). No hard-stop class deviation (no contract, schema, auth, billing, container or secret change; `contracts.json-schema.snap` byte-identical; no new dependency, no lockfile change by this phase).

| # | What deviated | Why | Impact |
|---|---|---|---|
| DV1 | `buildStructureView(g, findings)` takes the DocGraph (which carries `structure`) instead of `(graph, structure, findings)` | the DocGraph already bundles graph + structure; one argument less to keep in sync | none (pure function, worker-only caller) |
| DV2 | New helper files inside the detectors area: `detectors/util.ts` (masking, sentence grouping, locations) and `detectors/flow.ts` (target parsing and checks shared by broken-conditional, unreachable-flow, investor paths and the structure view) | avoid duplicating target and masking logic across 4 detectors and the view | inside `packages/core/src/detectors` (blast radius) |
| DV3 | `apps/web/src/styles/structure.css` (new) holds the ported app.html Structure CSS; imported by `StructureScreen.tsx` | source-guard forbids hex colours under `features/`; the mockup Structure CSS carries hex values; `styles/` is the established home | one new stylesheet; no token added (`tokens-match-mockup` green) |
| DV4 | `apps/web/src/smoke.test.tsx` (P03 unit test) adapted: the registry list now ends with the appended `structure` entry | the plan's registry append changes the pinned list by design | expected change; asserts the real view wins |
| DV5 | `apps/web/e2e/triage-actions.spec.ts` (P03 spec, not in the E9 list) adapted: the `.mask` locator is scoped to the seeded value because #1 now masks its own ABA/DDA | E9 rule "any other preview spec that fails: derived fix" | assertion kept (seeded mask still `#8097`) |
| DV6 | `test/property/finding-schema-contract.test.ts`: the AI-severity refinement property now picks a non-`sensitive_data` base finding | the first finding on #1 is now a sensitive flag (capped at medium), which made the property moot | additive; property unchanged in meaning |
| DV7 | AC9 totality check (`explain({})` without "undefined") is asserted for Phase 02 detectors only | Phase 01 `explain()` needs its own facts; changing Phase 01 detector text risks golden content (E2) | residual recorded as backlog P2-3 |
| DV8 | `nav-badge-structure` screen-reader prefix is "To check" (app.html) instead of E10's illustrative "Issues"; a warn icon is rendered like the mockup | UI rule: app.html wins on copy | copy only |
| DV9 | Seeded fixtures avoid lines starting with "Type" ("Subscriber type (check one):") | a Phase 01 EDGAR noise rule drops such lines (bug, backlog P2-1); fixing it is a Phase 01 adapter change with golden risk | fixtures only |
| DV10 | Red-first stubs were not run as a separate red step: tests were written next to the implementation and confirmed green; the red evidence for the P03 adaptations is the recorded post-Step-A e2e run (7 expected failures) | single-session execution | TDD order only; every gate confirmed green |
| DV11 | Flow diagram toggle renders a list of sections with their conditions, not the hand-drawn app.html SVG; mockup icons missing from the sprite use substitutes | no generic layout for arbitrary documents; sprite is a P03 file not in the touchpoints | backlog P2-7, P2-8 |

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [x] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [x] 2. INNOVATE — innovate-agent: approach decided (orchestrator decisions: build approved `#structure`, additive worker wire, defer U1 to Phase 05)
- [x] 3. PLAN-SUPPLEMENT — plan-agent: PVL-supplement applied (13 gaps) to the existing plan
- [x] 4. PVL — vc-validate-agent: re-run from V1 after the supplement; validate-contract refreshed (Gate: PASS, 17-10-26; binding execute instructions E1-E14 in the contract)
- [x] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented) — vc-execute-agent 17-10-26, report `subdoc-qa-mvp_PHASE-02-detectors-fixtures_REPORT_17-10-26.md`
- [x] 6. EVL — all EVL gates green (core 291/291 after review fix cycle 1f5dade; web e2e green); follow-up stubs registered; EVL HANDOFF SUMMARY written
- [x] 7. UPDATE PROCESS — archived; context updated; committed (17-10-26; plan stays in active/ as part of the program folder)

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S3 (many detector directions), S4, S7 (30+ files) → 3/7 MEDIUM. Recommended: parallel subagents for Step A detector groups after the registry seam lines are serialized (disjoint files per detector), then sequential for fixtures and the Structure view. Sonnet for research/validation, opus only for the code-execution leg.

## Test Infra Improvement Notes

- `test:seeded` must fail on an empty directory (the `--passWithNoTests` flag is removed here).
- Add `fixtures:check` (drift gate) to the scripts package; consider making a no-match token an error in the program test runner wrapper (a token matching no file currently exits 0).
- Backlog stub: ground-truth test for investor paths on real samples #1, #7, #10 (residual, Agent-Probe only today).

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-02-detectors-fixtures_PLAN_17-10-26.md`
- Last completed step: EXECUTE (17-10-26). All checklist items done; final gate list 1-14 green; gate 15: `guard:cf` / `secrets:scan` green, `pnpm typecheck` / `pnpm lint` red ONLY in 04b-owned paths (apps/worker/**, scripts/src/seed/**; parallel WIP); core/web/scripts typecheck and ESLint on Phase 02 files clean. Next: EVL (vc-tester independent re-run).
- Validate-contract status: PASS (inner-pvl re-run 17-10-26 after supplement cycle 1); execute-agent instructions E1-E14 in the contract are binding.
- Next Step: spawn vc-execute-agent. EXECUTE starts at E1 (baseline: core full, web unit, full preview e2e), then Step A with registry appends serialized. State: HEAD 70d320b, Milestone 1 live, phases 00/01/03/04a done, holds released. Runs parallel with Phase 04b (disjoint). Outputs consumed by Phases 04b (seed spec), 05, 07, 08, 09, 10. Validators: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <plan>`.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: inner-pvl: phase-02
supersedes: 2026-10-17 (inner-pvl: phase-02) — inner PVL re-run after supplement cycle 1 has current evidence (all 13 gaps verified resolved against the real code)

Parallel strategy: parallel-subagents (Step A detector groups, disjoint files, after the registry seam lines are serialized) then sequential for fixtures, Structure view and the P03 spec repair
Rationale: 3/7 signals (S3 many detector directions, S4 phase program, S7 30+ files) = MEDIUM; dominant signal S7. Orchestrator serializes the seam appends (`detectors/registry.ts`, `src/index.ts`, `features/registry.ts`, `scripts/package.json`, `packages/core/package.json`). Sonnet for research/validation, opus only for the code-execution leg.

Test gates (C3 5-column table, additive; program no-`--` form, ONE token per call because a multi-token filter passes when any token matches; every token maps to a planned file, see E8):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC10 | NTD, `[xx]`/`[insert ...]`/`[●]` placeholders and ABA/DDA numbers flagged; sensitive values masked in quote, snippet, hash, facts, explanation | Fully-Automated | `pnpm --filter @aduin/core test flags-ntd-placeholder-sensitive` (samples #5, #3, #1, #7 + fixtures) | B |
| AC10 | masked by default in list and document; reveal shows value; hash/snippet never hold the raw value | Fully-Automated | `pnpm --filter @aduin/web test:e2e reveal-sensitive` | B |
| AC10 / F3 | mask widening (digit runs over 31, IBAN, alpha-prefixed account) without changing existing vectors | Fully-Automated | `pnpm --filter @aduin/core test mask-widening`; then `pnpm --filter @aduin/core test:vectors` | B |
| AC17 | #structure lists sections (restart badge), cross-references with status, conditions, option groups with cue, defined terms; Issues only default; Show everything; row drawer; statutory cites not internal; badge computed | Fully-Automated | `pnpm --filter @aduin/web test:e2e structure-view` | B |
| AC17 | pure `buildStructureView`: lens contents, issue counts, badge total, determinism | Fully-Automated | `pnpm --filter @aduin/core test structure-view-build` | B |
| AC18 | every P02 deterministic class and detector has a clean control and a seeded defect | Fully-Automated | `pnpm --filter @aduin/core test:seeded` (precision >= 90%, recall 100%; script loses `--passWithNoTests`, verified present today) | B |
| AC61 | investor types and ordered paths extracted, deterministic over 5 runs | Fully-Automated | `pnpm --filter @aduin/core test investor-path-extraction-fixtures`; `pnpm --filter @aduin/core test investor-path-determinism` | B |
| AC61 | Investor types sub-view: type list, ordered path, Partnership or LLC pre-selected, empty state | Fully-Automated | `pnpm --filter @aduin/web test:e2e investor-path-view` | B |
| AC62 | dead-end type and missing item (Part C and PATH-04 peer-item) flagged with clause cited; clean control silent; uncertain never asserted | Fully-Automated | `pnpm --filter @aduin/core test investor-path-seeded-defects` | B |
| AC9 | every registered detector has total (sparse-facts-safe) `explain()` and charset-clean `patternKey()`; golden-sample findings keep >= 3 facts, truthy expected, digit-free key | Fully-Automated | `pnpm --filter @aduin/core test explanation-present-per-rule` | A |
| AC8 | repeat-run determinism with the new detectors | Fully-Automated | `pnpm --filter @aduin/core test determinism` | A |
| AC7 | finding schema contract over new rules (masked quote compared via `mask(slice, sensitiveSpans(slice))`) | Fully-Automated | `pnpm --filter @aduin/core test:property` | B |
| pattern_key | charset `[a-z0-9:#>-]`, digits to `#`, 80 chars, no `|`, stable; single implementation in `memory/patternKey.ts` | Fully-Automated | `pnpm --filter @aduin/core test pattern-key` | B |
| AC59/AC60/AC44/AC45/AC47 (inputs) | engine output on fund I / II / Y equals `fund-expectations.json` (3 non-blocking previously_dismissed, 2 answered, 2 new, 1 edited = 8 findings; Y identical quotes, fingerprints differ by firm) | Fully-Automated | `pnpm --filter @aduin/core test memory-fixtures` | B |
| D-7 / M7 | demo-seed-spec parses with `DemoSeedSpecSchema`; every decision quote equals a real engine finding on its `sample_id`; >= 3 same-pattern same-reason dismissals (or documented fallback) | Fully-Automated | `pnpm --filter @aduin/core test demo-seed-spec` | B |
| security | new regexes linear-time on hostile input; no raw sensitive value in any finding JSON field | Fully-Automated | `pnpm --filter @aduin/core test security` (directory token: matches `test/security/*.test.ts`) | B |
| success metric | corpus ceiling < 40 high+critical per doc, 12 HTML samples | Fully-Automated | `pnpm --filter @aduin/core test:corpus` | A |
| fixtures drift | committed seeded/memory fixtures equal a fresh build | Fully-Automated | `pnpm --filter @aduin/scripts fixtures:check` (script added by C1) | B |
| regression | Phase 01 goldens intact (finding content unchanged; three named total-count assertions narrowed, E2); core and web unit suites; Phase 03 preview e2e green after the named adaptations | Fully-Automated | `pnpm --filter @aduin/core test:golden`; `pnpm --filter @aduin/core test`; `pnpm --filter @aduin/web test`; `pnpm --filter @aduin/web test:e2e`; `pnpm typecheck`; `pnpm lint`; `pnpm guard:cf`; `pnpm secrets:scan` (each a separate call) | B |
| AC17/AC61 view fidelity | #structure matches app.html at 1440/1199/1024 (6 lenses, drawer, tokens) | Agent-Probe | screenshots via the P03 design-probe pattern compared with app.html; reviewer judges layout, copy, tokens | D |
| AC61 on real samples | investor paths on #1, #7, #10 are sensible | Agent-Probe | informational run and reviewer read; no ground truth; recorded in the report | D |

Failing stubs (Fully-Automated rows, red first):
- `test("should flag NTD drafting note in sample 5", () => { throw new Error("NOT IMPLEMENTED — TDD stub: flags-ntd-placeholder-sensitive") })`
- `test("should flag [insert investor name] as placeholder but not ____ blanks", () => { throw new Error("NOT IMPLEMENTED — TDD stub: placeholder") })`
- `test("should flag ABA routing and DDA on sample 1 with masked quote and 3 facts (last4, cue, kind)", () => { throw new Error("NOT IMPLEMENTED — TDD stub: sensitive on sample 1") })`
- `test("should not flag phone, fax, P.O. Box or ZIP digits that carry no account cue", () => { throw new Error("NOT IMPLEMENTED — TDD stub: sensitive no-cue negative") })`
- `test("should mask a 40-digit run and an IBAN", () => { throw new Error("NOT IMPLEMENTED — TDD stub: mask-widening") })`
- `test("should render the Structure view with Issues only by default and 6 lenses", () => { throw new Error("NOT IMPLEMENTED — TDD stub: structure-view") })`
- `test("should build the structure view model with lens contents, counts and badge total", () => { throw new Error("NOT IMPLEMENTED — TDD stub: structure-view-build") })`
- `test("should flag a skip that points to a missing section", () => { throw new Error("NOT IMPLEMENTED — TDD stub: broken-conditional") })`
- `test("should flag an option group where one sibling carries a footnote marker and another does not", () => { throw new Error("NOT IMPLEMENTED — TDD stub: footnote-requirement") })`
- `test("should detect every seeded defect and stay silent on every clean control", () => { throw new Error("NOT IMPLEMENTED — TDD stub: seeded-defect-matrix") })`
- `test("should list the same investor paths on every run", () => { throw new Error("NOT IMPLEMENTED — TDD stub: investor-path-determinism") })`
- `test("should flag an investor type with no path to the signature section", () => { throw new Error("NOT IMPLEMENTED — TDD stub: investor-path-seeded-defects") })`
- `test("should list the Investor types sub-view per type with the gap row", () => { throw new Error("NOT IMPLEMENTED — TDD stub: investor-path-view") })`
- `test("should build pattern keys with digits stripped, 80-char cap and the safe charset", () => { throw new Error("NOT IMPLEMENTED — TDD stub: pattern-key") })`
- `test("should label fund II passages exactly as fund-expectations.json states", () => { throw new Error("NOT IMPLEMENTED — TDD stub: memory-fixtures") })`
- `test("should match every demo-seed decision to a real engine finding", () => { throw new Error("NOT IMPLEMENTED — TDD stub: demo-seed-spec") })`

Legacy line form (retained for existing consumers):
- packages/core detectors, investor, patternKey, mask: [Fully-automated: `pnpm --filter @aduin/core test flags-ntd-placeholder-sensitive` | `... test investor-path-seeded-defects` | `... test:seeded` | `... test:property` | `... test:corpus`]
- apps/web structure + investor view: [Fully-automated: `pnpm --filter @aduin/web test:e2e structure-view` | `... investor-path-view` | `... reveal-sensitive` | full `test:e2e`] | [agent-probe: Structure view vs app.html at 3 widths]
- fixtures + scripts: [Fully-automated: `pnpm --filter @aduin/core test memory-fixtures` | `... test demo-seed-spec` | `pnpm --filter @aduin/scripts fixtures:check`]
- real-sample investor-path accuracy: [known-gap: documented, backlog stub (residual, gap-resolution D)]

Dimension findings:
- Infra fit: PASS — verified on the real scaffold: registry seam and `Detector` interface; `buildFinding` already default-masks 6+ digit runs; `test:seeded` really carries `--passWithNoTests` (removal is meaningful); `scripts/package.json` has no `fixtures:*` yet (added by C1); `.prettierignore` does not cover `fixtures/` (builder must emit prettier-clean HTML, seam recorded otherwise); `@aduin/scripts` has no `@aduin/core` dependency (E7); the structure view data path fits (`useReview.result` already carries `EngineResult`, `{...result}` keeps an additive `structure`). HEAD 70d320b matches the Entry Gate.
- Test coverage: PASS — all gate tokens are single, `--`-free and map to a planned or existing file (E8); the program rule is stated in the plan; `security` is a directory token that matches `test/security/*`. Added tokenless `pnpm --filter @aduin/core test` and `pnpm --filter @aduin/web test` to the regression set (web unit `import-graph.test`, `tokens-match-mockup`, `source-guard` guard exactly what this phase touches). slice.spec.ts is stack-only and not run by `test:e2e` (inspection only, E9).
- Breaking changes: PASS with instructions — probed the 12 HTML samples: #1 gains 2 sensitive findings (block 27 "ABA routing", block 28 "DDA"); #3 gains 1 placeholder + 2 sensitive; #5 gains 1 NTD + 2 placeholders + 2 sensitive; #6 gains 1 placeholder + 2 sensitive; #2 gains about 6 `[●]` placeholders + sensitive; #4 and #13 may gain sensitive; #7 gains sensitive (ABA#/DDA# in one sentence, dedupe trap, E3); #11 gains none; #12 `[***]` is info only. Consequences found: (1) three Phase 01 golden total-count assertions break by design (E2); (2) finding-highlight.spec.ts #3 loop and positional picks in previously-handled-section / gate-pill / filter-sort break (E9); (3) `dismiss-requires-reason` `toHaveCount(4)` counts the four reason radios, not findings, so the plan's "derive the count" is moot (E9); (4) `nav-badge-structure` needs a NavGroup.tsx edit because NavGroup renders badges only for findings|counsel and Sidebar has no hard-coded structure badge (E10). slice.spec.ts, finding-highlight #1/#11 target selection and gate-pill all still pass given the repair (verified by reading each spec against the probe). Frozen contracts and `contracts.json-schema.snap` untouched (E6).
- Security surface: PASS — masking is the trust-boundary item and is fully specified: facts/explanation/expected through `mask()`, no raw digits in any field, `quote_hash` from masked text, widened `ACCOUNT_NUMBER_RE` bounded and in the ReDoS suite (verified: today a 40-digit run is not masked at all, because the 6..31 digit regex needs word boundaries at both ends; F3 fixes that), synthetic non-routable fixture numbers, no network, no LLM, no secrets. Contradiction fixed: facts for `flag-sensitive` are `last4`, `cue`, `kind` (3 facts) because the golden loop needs >= 3 (E3).
- Section A (detectors): PASS with instructions — mechanically feasible. Highest-risk edit: A2 defined-term rules; golden constraint is ZERO `defined_term_issue` on #1/#3/#5/#6 and only "Units" on #11, while a naive duplicate rule fires on "Fund" (defined twice in #3/#5/#6) and a naive unused rule on "U.S." (#3 to #6) per the probe; filters required, no sample-keyed suppression (E2). A3 footnote_marker implementable with a TS-only side channel (E5): the adapter drops `<sup>` text into the line with no record today, `Line`/`Cue` schemas are in the contracts snapshot so no schema field is allowed, the structurer keeps the same Line object in `block.lines[0]`, so only `adapters/html.ts`, `structure/option-groups.ts` and `structure/types.ts` change.
- Section B (investor paths): PASS — pure core extractor over `OptionGroup`/`Conditional`; PATH-04 peer-item case and Part C case both specified; uncertain never asserted; `critical` only when the graph proves no route. Residual: no ground truth on #1/#7/#10 (Agent-Probe, backlog stub).
- Section C (fixtures): PASS with instructions — AC59 arithmetic checks (8 findings; 3 previously dismissed + 2 answered = 5 handled; 3 need action = 62.5% fewer). `MemoryLabel` has no `edited` value: an edited passage resolves to label `new` through a fingerprint mismatch, so `fund-expectations.json` carries `label` (MemoryLabel) plus `category` (previously_dismissed | already_answered | new | edited) (E11). Fingerprint = firm|class|quote_hash, so fund-Y differs from fund-II by firm only; all values from engine output.
- Section D (corpus and web view): PASS with instructions — real `#structure` exists in app.html (six lenses, Show everything, PATH-04, badge); data flows through the worker (`import-graph.test` allows type-only imports); registry last-entry-wins append is correct; NavGroup/store notes in E10.

Open gaps: none blocking. Known gaps carried (not counted as concerns): real-sample investor-path accuracy (Agent-Probe, backlog stub, gap-resolution D); U1 locator chip deferred to Phase 05 (explicit decision, record in report and backlog `core-followups`); footnote markers on scanned documents and OCR streams (Phase 06).
What this coverage does NOT prove:
- `flags-ntd-placeholder-sensitive`: that every real-world account/routing format is caught (only cue-bearing ABA/DDA/routing/account forms and the widened masks); placeholders in OCR text (Phase 06); `[***]` redactions are info only.
- `reveal-sensitive`: nothing about server-side persistence of masked values (R1 stays with 04b).
- `structure-view` / `structure-view-build` / `investor-path-view`: pixel fidelity to app.html (Agent-Probe only), behavior when the structurer fails beyond the empty-state check, the flow diagram beyond its toggle.
- `test:seeded`: recall on real forms; seeded fixtures are synthetic and can overfit the rules (corpus ceiling and the real-sample informational runs are the counterweight).
- `investor-path-*`: correct paths on real documents; only seeded fixtures are asserted.
- `memory-fixtures` / `demo-seed-spec`: end-to-end memory labels in the app or the D1 seed (proved in 04b, 08, 10).
- `test:corpus`: false-alarm precision (a count ceiling only; the report lists each new finding on the 12 samples for manual true/false classification).
- `test:golden` after the E2 narrowing: "no other finding on this document" now holds only for the Phase 01 detector ids; new detectors are covered by their own seeded tests and the corpus report.
- full web `test:e2e`: the stack project (`slice.spec.ts`) is not run; it needs no edit by inspection; run `pnpm slice:check` only if the M1 deploy path is touched (it is not).
Gate: PASS (0 FAILs; all 13 supplement gaps verified resolved in the plan; remaining mechanical items are binding execute-agent instructions E1-E14 below)
Accepted by: n/a for PASS (no CONCERN accepted; E1-E14 are mitigations recorded in this contract, autopilot session, 2026-10-17)

Verification of the 13 supplement gaps (S1-S13), against the real code: S1 structure view specified with testids and spec names [resolved]; S2 worker wire additive and type-only on the main thread [resolved; NavGroup edit added in E10]; S3 P03 spec adaptation named [resolved; precision added in E9, finding-highlight added]; S4 gates one token, no `--`, real file names, regression set fixed [resolved; web and core unit suites added]; S5 pattern_key spec uses real helper output, charset-clean, single implementation, one barrel export [resolved]; S6 F3 mask widening bounded and tested [resolved]; S7 detector constraints (total functions, >= 3 facts, expected, digit-free key) [resolved; `flag-sensitive` fact set corrected in E3]; S8 footnote marker rule [resolved; mechanism pinned in E5]; S9 AC7 property test extended [resolved; signature note in E12]; S10 fund fixture labels and AC59 arithmetic [resolved; `edited` mapping in E11]; S11 demo-seed gate and prettier handling [resolved]; S12 U1 deferred to Phase 05 with a recorded decision [resolved]; S13 status housekeeping (HEAD, D-7, D-8, loop progress, resume block) [resolved].

Execute-agent instructions (binding; where they conflict with plan text above them, these win):
- E1. Before writing detectors, run the baseline: `pnpm --filter @aduin/core test` (full), `pnpm --filter @aduin/web test`, and `pnpm --filter @aduin/web test:e2e` (full preview suite); record results. Re-run the e2e suite after Step A and after Step D to see which specs the new findings change.
- E2. Registry appends one detector group at a time; run `pnpm --filter @aduin/core test:golden` after each group. STOP only if a golden FINDING changes (ref-this-section x2 on #1, ref-label-coherence x2 on #3 and x2 on #5, undefined-term "Units" on #11, zero `defined_term_issue` on #1/#3/#5/#6). Named adaptation (expected, record in the report): three "no other finding" total-count assertions count every detector and break by design once AC10 flags fire: `golden-01-this-section-11.test.ts` (`expect(findings).toHaveLength(2)`), `golden-03-05-swapped-part-b-refs.test.ts` (negative test, `expect(findings).toHaveLength(2)`), `golden-11-undefined-units.test.ts` (`expect(findings).toHaveLength(1)`, only if it turns red). Narrow each to findings whose `detector_id` is one of `ref-this-section`, `ref-label-coherence`, `undefined-term`, with a comment pointing at AC10. Edit nothing else in goldens. A2 filters: no sample-keyed or term-keyed suppression lists; use structural filters (re-definition across numbering scopes or with the same definition text, abbreviation and jurisdiction terms such as "U.S."); if a golden still breaks, demote the rule or narrow it, never hide the golden.
- E3. New detector findings: >= 3 `detail.facts`, truthy `detail.expected`, `explanation === explain(facts)` (build the explanation only from facts), `pattern_key === patternKey(facts)`, digit-free key (the golden loop in `explanation-present-per-rule` covers #1/#3/#5/#11, which now include flag findings). `flag-sensitive` facts = `last4`, `cue`, `kind` (aba | dda | routing | account | other); this overrides "last4 + cue only". Cue rule: a cue word (ABA, routing, DDA, account, plus tolerate `ABA#:` and `DDA#:`) before the number in the same block; negative tests on #1 phone/fax/P.O. Box/ZIP and #7 phone numbers. Two numbers that snap to the same sentence (sample #7 block 4 holds both ABA# and DDA#) must not rely on `runDeterministic` id de-duplication: emit one finding listing both cues (facts stay masked) or distinct ids; assert it in the flags test.
- E4. Placeholders: `[xx]`, `[insert ...]`, `[●]` (sample #2 has about 6); never `____` or `[ ]`; `[***]` redactions (21 on #12) are not findings. List every new finding on all 12 samples in the D1 corpus report for true/false classification (probe: #2, #4, #13 also gain findings that the plan text does not mention).
- E5. footnote_marker: do NOT add fields to `LineSchema`/`CueSchema` or change line text (contracts snapshot and goldens). Record `<sup>` text per emitted Line in a TS-only side channel in `adapters/html.ts` (for example a WeakMap keyed by the Line object, or a non-schema property on the Line objects the adapter creates); `structure()` keeps that same object in `block.lines[0]`; `option-groups.ts` sets `OptionItem.footnote_marker` when an option label ends with a recorded sup text; add `footnote_marker?: string` to `OptionItem` in `structure/types.ts` (authorized unlisted additive edit) and OMIT the property when absent so structure snapshots stay byte-identical. No change to `structurer.ts` or `engine.ts` is needed. If this cannot be done without a schema or text change, STOP and route to PLAN.
- E6. No edits under `packages/core/src/contracts/**`; `contracts.json-schema.snap` stays byte-identical; `memory/index.ts` must not export `patternKey` (the barrel keeps its single export from `findings/make-finding`, which re-exports `memory/patternKey.ts`).
- E7. `scripts/src/fixtures/*` need the engine but `@aduin/scripts` has no `@aduin/core` dependency: import it through the relative path `../../../packages/core/src/index` (no lockfile change). If instead a workspace dependency is added, record the `pnpm-lock.yaml` change as a seam edit. `pnpm --filter @aduin/scripts typecheck` must pass.
- E8. Gate token to file map (create exactly these names, then confirm each exists before running the gate, because a token that matches nothing exits 0): `packages/core/test/unit/{flags-ntd-placeholder-sensitive,mask-widening,pattern-key,structure-view-build,investor-path-extraction-fixtures,investor-path-determinism,investor-path-seeded-defects,memory-fixtures,demo-seed-spec}.test.ts`; `packages/core/test/seeded/seeded-defect-matrix.test.ts`; `packages/core/test/security/sensitive-no-raw.test.ts` (plus the extended `redos.test.ts`); existing `unit/explanation-present-per-rule.test.ts`, `property/determinism.test.ts`, `property/finding-schema-contract.test.ts`; web `e2e/{structure-view,investor-path-view,reveal-sensitive}.spec.ts`.
- E9. P03 spec repair (every edit an EXPECTED change with a report note; never weaken an assertion about product behavior): pick golden findings by `detector_id === 'ref-label-coherence'` (or `facts.reference`), never by engine index, in `previously-handled-section` (all four tests: a non-blocking placeholder dismissed in #3 would land in "previously handled", not the main list), `gate-pill` (`[a, b]`, `[a]`, and `forceSeverity` index = `findIndex` of the same finding in engine order); `gate-pill` with all findings forced critical: N = `engineFindings('05').length`, meta `${N} open · ${N} block digitization`, toast `${N-1} blocking reason(s) left.` with the plural rule from `state/review.ts` (`reason${left > 1 ? 's' : ''}`); `finding-highlight.spec.ts` (not in the plan's list, add it): the #3 loop and `[1]` use `facts.reference`, which new placeholder/sensitive findings lack ("undefined"), so filter to `ref-label-coherence`, and filter the #11 lookup to `undefined-term`; `filter-sort` (#3 chips, `toHaveCount(2)`, `['fix','note']`, `filter-count`) derived from `engineFindings('03')`; `dismiss-requires-reason`: `toHaveCount(4)` counts the four reason radios, so do NOT edit it unless it turns red; `app-shell` (line 31 asserts the structure placeholder: assert `structure-view`), `placeholder-routes` (drop structure rows and the "Investor types" placeholder test), `a11y-smoke` (placeholder audit on another route, add a `#structure` audit). UI default sort is severity, so positional UI picks (`rowsLoc.first()`, `.nth(1)`) on #1/#3 keep landing on the golden "fix" rows; edit them only if red. `slice.spec.ts`: expected UNCHANGED (target is selected by text "this Section 11", open count and gate branch are derived, the new #1 findings are medium and so "note", not blocking); do not edit it unless inspection after Step A shows a changed target; list it in the report either way.
- E10. `nav-badge-structure`: `shell/NavGroup.tsx` renders `nav-badge-*` only for `findings` and `counsel`, and `Sidebar.tsx` has no hard-coded structure value. Make narrow additive edits to `NavGroup.tsx` (render the badge for `structure`) and `Sidebar.tsx` (`badges.structure = { n: result?.structure?.badge ?? 0, sr: 'Issues' }` read from `useReview(s => s.result)`); record both files in the Registry follow-up. Structure view components read `useReview(s => s.result?.structure)` and import core types only.
- E11. `fund-expectations.json`: per passage store `label` (a `MemoryLabel`) and `category` (previously_dismissed | already_answered | new | edited). The edited passage resolves to `new` (fingerprint mismatch), it is not a new label value. All fingerprints computed with `fingerprintFor` from engine output; the 3 previously dismissed passages must be non-blocking (medium flag findings are natural candidates); the 2 answered may be blocking.
- E12. A8: compare `quote` to `mask(slice, sensitiveSpans(slice))` for every finding (identical to the raw slice when no digit run is present); `mask()` takes spans, so the plan shorthand `mask(text.slice(anchor))` must pass them.
- E13. Never put a raw account/routing number in any fixture, expected.json, snapshot, log or report; synthetic non-routable numbers only. Keep every new regex bounded (no nested quantifiers) and add it to `redos.test.ts`.
- E14. Registry follow-up (orchestrator, update-process): add `packages/core/src/structure/types.ts`, `apps/web/src/shell/NavGroup.tsx`, `apps/web/e2e/finding-highlight.spec.ts`, and `packages/core/test/golden/{golden-01-this-section-11,golden-03-05-swapped-part-b-refs,golden-11-undefined-units}.test.ts` (total-count narrowing) to the `## Phase 02` entry; the registry still lists "2 web e2e specs" and omits the P03 edits.

Final gate commands (each a separate call, one token, no `--`; run in this order after the per-section gates):
1. `pnpm --filter @aduin/core test flags-ntd-placeholder-sensitive`
2. `pnpm --filter @aduin/core test mask-widening` then `pnpm --filter @aduin/core test:vectors`
3. `pnpm --filter @aduin/core test security`
4. `pnpm --filter @aduin/core test pattern-key`
5. `pnpm --filter @aduin/core test:seeded`
6. `pnpm --filter @aduin/core test investor-path-extraction-fixtures`; `pnpm --filter @aduin/core test investor-path-determinism`; `pnpm --filter @aduin/core test investor-path-seeded-defects`
7. `pnpm --filter @aduin/core test structure-view-build`
8. `pnpm --filter @aduin/core test explanation-present-per-rule`; `pnpm --filter @aduin/core test determinism`; `pnpm --filter @aduin/core test:property`
9. `pnpm --filter @aduin/core test memory-fixtures`; `pnpm --filter @aduin/core test demo-seed-spec`
10. `pnpm --filter @aduin/scripts fixtures:check`
11. `pnpm --filter @aduin/core test:corpus`
12. `pnpm --filter @aduin/core test:golden`; `pnpm --filter @aduin/core test`; `pnpm --filter @aduin/web test`
13. `pnpm --filter @aduin/web test:e2e structure-view`; `pnpm --filter @aduin/web test:e2e investor-path-view`; `pnpm --filter @aduin/web test:e2e reveal-sensitive`
14. `pnpm --filter @aduin/web test:e2e` (full preview suite)
15. `pnpm typecheck`; `pnpm lint`; `pnpm guard:cf`; `pnpm secrets:scan`
16. Agent-Probe (not a command): `#structure` screenshots at 1440/1199/1024 vs app.html; investor paths on #1, #7, #10 informational.
