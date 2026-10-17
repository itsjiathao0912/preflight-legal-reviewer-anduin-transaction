---
name: plan:variance-mvp-phase-01-core-engine
description: "Variance MVP Phase 01 (V1): packages/core variance module (rules config + hash, hunker, classifier, cosmetic groups, impact, routing, scope_exists check, Finding adapter), additive gate policy + owner sheet, seeded corpus and generator"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: variance-management
  phase: phase-01
---

# Phase 01 - V1 Core engine + corpus

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: 🔄 EXECUTED (awaiting EVL)
**Program:** variance-mvp
**Umbrella plan:** process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** 🔄 EXECUTED (awaiting EVL)
**Report destination:** process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-01-core-engine_REPORT_17-10-26.md (flat in the program task folder)
**Risk class:** medium (frozen-contract-adjacent: gate and sheet change through optional fields only; no schema, no deploy)
**Depends on:** none inside the program. External: the Intake feature is CLOSED (live Worker 3d2c7301); Step 0 re-sync done 2026-10-17 (see Step 0 status below).
**Context routers read:** `process/context/all-context.md`, `process/context/engine/all-engine.md`, `process/context/tests/all-tests.md`, `process/context/planning/all-planning.md`.

---

## Overview

Builds the whole deterministic variance engine in `packages/core/src/variance/` and proves it with a seeded corpus. Output is plain JSON: change rows as frozen-v1 `Finding`s (`issue_class: 'version_drift'`, metadata in `detail.facts` as SCALAR values only: `FindingDetailSchema.facts` accepts string up to 1000 chars, number, boolean or null, so lists and the assertion candidate are encoded as strings or flat keys and decoded only by `varianceMetaOf`), a meta record keyed by finding id, display-only cosmetic groups, and the raw/shown/cosmetic summary. Gate and counsel sheet gain only optional fields. No web, Worker, migration or contract file is touched here (those are V2 to V4).

Locked inputs: DECISION D1 (raw change = one word-level hunk recomputed from full unit text; ordered classification, default = logic), D2 (Finding adapter, gate policy 4th parameter), D3 (impact + audience dimension), D4 (routing + composite question key), D7 (corpus), D8 (0 AI calls). Read the DECISION file first.

**Corpus design decision (PLAN-time, resolves a SPEC gap):** the missing-target cross-reference detector is deferred, so no error finding can carry the R-01 assertion. The assertion candidate therefore comes from a variance change row (a removed or added appendix unit). The Hartwell and Crane corpus therefore has THREE documents:
- Fund I: contains Appendix C. Used only for the "Fund II review" setup pair.
- Fund II: references Appendix C, does NOT contain it. Baseline of the demo pair. Fund II vs Fund I yields a `VAR-LOGIC-REMOVED` row carrying the flat scalar facts `assertion_kind = 'scope_exists'` and `assertion_label = 'Appendix C'` (decoded as `assertion_candidate` by `varianceMetaOf`); the analyst answers "Appendix C must exist" with scope firm_template (this is the R-01 source answer).
- Fund III: also lacks Appendix C, so Fund III vs Fund II shows NO Appendix C change row (keeps AC-V4 exactly 7) and the regression check fires on Fund III. A fourth file `fund-III-with-appendix-c` is the "holds" variant.

**Count pin (SPEC governs the mockup):** raw = 214, shown = 7 (3 `new`, 4 `changed_logic`), cosmetic hunks = 207 in exactly 5 groups. Authored split: renumber 118, fund_name 41, date 8, rename (Units to Shares) 29, format 11 (sum 207). The mockup's "206 cosmetic" is off by one; AC-V4 says 214 minus 7 = 207.

## Step 0 - Precondition: re-sync with Intake before EXECUTE

Re-sync with Intake's landed code (inner R+I refresh) before EXECUTE: read Intake's final PLAN and closeout and its landed diff; update the `## Dependencies on Intake` section of the umbrella (observed vs assumed to observed); re-allocate the migration number; re-check the collision files in the phase-blast-radius registry; write an `## Inner Loop Refresh Note` in this plan. EXECUTE may not start until the Intake feature is closed.

Phase-specific Step 0 checks: (a) `git diff` of Intake for `packages/core/src/counsel/{gate,sheet,types}.ts`, `packages/core/src/index.ts`, `scripts/src/fixtures/{build-seeded,check}.ts`, `fixtures/memory/law-firms.json`; rebase this plan's additive edits on Intake's landed `computeGate` (coverage reason kinds, policy data). (b) Observed in Intake's INNOVATE (item 9 and the demo-packages note): Intake does NOT add `hartwell-crane`; it tags its demo package to the existing firm `firm-x` and builds its own synthetic set in `fixtures/package/hartwell/` via `scripts/src/fixtures/make-package.ts` (OBSERVED-IN-CODE; the earlier plan name `build-package.ts` does not exist). V1 does not touch firms (V3 adds the firm). The variance corpus stays a SEPARATE self-contained set in `fixtures/variance/hartwell-crane/` with distinct file names (Intake's Fund II/III files are small package seeds with their own pins, which V1 must not change). Intake's landed `scripts/src/fixtures/check.ts` (+41 lines: `buildPackageFixtures`, `PACKAGE_DIR`, `REAL_FACTS_KEYS` from `make-package`, a `walkPkg` stray scan, ending just before the final `if (problems.length)` block at about line 168) is the base the additive `fixtures/variance` scan rebases onto. OBSERVED-IN-CODE (Step 0, 2026-10-17): core `computeGate` is untouched (`counsel/gate.ts:43`, still 3 args; `counsel/types.ts:39`), the `gate-state-matrix` is 2400 cells (2406 tests in the file), and Intake merges package reasons inside the web `shell/GateButton.tsx`, so the V1 gate edit has no overlap.

Step 0 check (c), design-session fixtures (OBSERVED-IN-CODE, committed in c1c5fe0; the conditional wording below is SUPERSEDED by D-S0-5 in the Step 0 status paragraph): the design session is generating 3 FICTIONAL fund packages as DOCX under `samples/packages/` (`01-northgate-infrastructure-iii` with Fund II as baseline; `02-lotus-bay-asia-growth-ii` with baseline = prior draft v1, master plus feeder; `03-redwood-ridge-credit-i` with no baseline), each with `README.md`, `answer-key.md` (seeded defects, exact quotes, expected class and severity, AC-V* mapping) and `_build/build.py`. They are design-owned and read-only. At Step 0 check: is `samples/packages/` committed? If yes, read each `answer-key.md` and map every AC-V* row to a test in this phase (reuse Northgate as a second same-firm pair and Redwood Ridge as the no-baseline case, as extra Fully-Automated cases next to the authored corpus). The authored `fixtures/variance/hartwell-crane` corpus stays the pin for the exact 214 to 7 count UNLESS an answer key pins equivalent counts (then record that in the report; do not replace silently). If the folder is still absent at EXECUTE, skip (c), record it as not available, and the authored corpus alone proves V1. Never edit `samples/packages/`.

**Step 0 status (resolved 2026-10-17, PLAN-SUPPLEMENT; basis `variance-mvp_STEP0-RESYNC_17-10-26.md`, git HEAD 8a9398c).** Intake is CLOSED (live Worker `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f`; its `active/` folder is not an open plan). Check (a): `counsel/{gate,sheet,types}.ts` have NO Intake change (`computeGate` at gate.ts:43 still 3 args, matrix is 2400 cells (2406 tests in the file)); `index.ts` ends with `export * from './package/index';` (index.ts:172) and a named list cannot collide (grep: zero hits for all planned names); `build-seeded.ts` is untouched; `check.ts` was extended; `law-firms.json` is untouched. Intake also edited `structure/headings.ts` (+53: `Section 4.`, `Article I.` forms), `structure/conditionals.ts` (+16: Annex and Question targets) and `detectors/{flow,ref-label-coherence}.ts`; the hunker uses `buildUnits` keys from `diff/` and impact uses `Structure.conditionals`, both downstream of those edits, so `variance-golden-05-06`, the impact cases and the D1 renumber and cover/header cases are UNVERIFIED against them until run (Intake reports `golden-05-06-drift` green).

Decisions recorded (orchestrator defaults, reversible): **D-S0-5** keep the authored `fixtures/variance` corpus for the exact 214/7/207 pin and the R-01 Fund I/II/III chain, and ADD checklist H4 (a package-01 Northgate test read from `fixtures/package/design/northgate-iii/*.docx`, never from the read-only `samples/packages/`; recall 7 of 7 of the key passages in non-cosmetic hunks of shown rows; raw, shown, new and logic counts measured at EXECUTE then pinned; the key's 7 shown = 3 new + 4 changed_logic is recorded as a key-vs-engine table, not asserted, because units are top-level sections and key items share units; see H4, which governs; a divergence is a finding in the report, never bent silently). **D-S0-6** the V7 trust-split owner stays GP per the user-approved SPEC A9 (the package-01 answer key says Counsel: a note for the design session, no rule change). **D-S0-8** never git push in any phase. **D-S0-9** `.playwright-mcp/` and `.DS_Store` are not Variance's: never touch or commit them. Hook-filtered word rule: the Test Gates tokens below contain neither hook-filtered word (the production output directory and installed-packages directory names).

## Phase Completion Rules

- CODE DONE = checklist A to N implemented and committed; core suite green.
- VERIFIED = Exit Gate green, validate-contract written, regression evidence recorded for every overlapping earlier surface (`diff-*`, `gate-state-matrix`, `sheet-contents`, `contracts`, `golden-05-06-drift`, `firms-and-rules`, `fixtures:check`, `record:author --check`). Code-only completion is CODE DONE, never VERIFIED.
- Known-Gap is never a proving strategy here; any behavior left without a gate gets a backlog stub and its gate stays CONDITIONAL.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy |
|---|---|---|---|
| AC-V2 | every raw change is exactly one class with old/new passage and rule id | `variance-classification-contract` (property: one class, evidence present) | Fully-Automated |
| AC-V4 (core part) | demo pair: raw 214, 7 shown (3 new, 4 logic), 207 cosmetic in 5 groups; full UI proof is V5 `variance-demo-214-to-7-e2e`; package 01 (design Northgate DOCX pair): all 7 answer-key passages recalled in non-cosmetic hunks of shown rows, none cosmetic; raw, shown, new and logic counts MEASURED then pinned; the key's 7 rows (3 new + 4 logic) are recorded, not asserted, because units are top-level sections so key items share rows (D-S0-5, H4) | `variance-demo-count`, `variance-package-01-northgate` | Fully-Automated |
| AC-V5 | recall 100% on seeded new/logic changes, none classified cosmetic | `variance-seeded-recall-matrix` | Fully-Automated |
| AC-V6 | cosmetic shown as logic at most 10% of logic rows (seeded traps plus #5/#6) | `variance-precision-measure` | Fully-Automated |
| AC-V7 | #5 to #6: Units to Shares cosmetic; class fees logic; Appendix C removed shown | `variance-golden-05-06` | Fully-Automated (classification); AI wording is not used |
| AC-V9 (core part) | contradicting AI findings change nothing: classes, owners, impact, gate byte-equal; AI never gates even when asked; web e2e is V2 | `variance-ai-never-gates-core` | Hybrid (recorded AI input, runs in CI) |
| AC-V10 | impact from the logic graph; demo 4.2 case | `variance-impact-from-graph-fixtures`, `variance-impact-demo-4-2` | Fully-Automated |
| AC-V11 (core part) | routing table matrix (7A fund admin; Singapore GP+counsel; sanctions counsel; 4.2 counsel; Class A minimum GP; tax status counsel; trust split GP per SPEC A9; the package-01 answer key says Counsel for V7: note for the design session, D-S0-6) | `variance-routing-table-matrix` | Fully-Automated |
| AC-V12 (core part) | `<findingId>@<owner>` key; error findings keep the plain id; per-owner sheet filter and template draft | `variance-question-key-matrix`, `variance-sheet-owner-and-template` | Fully-Automated |
| AC-V17 (core part) | gate policy off = legacy; policy on counts untriaged changes, regression, asked-unanswered; two states only | `variance-gate-state-matrix` (extends `gate-state-matrix`) | Fully-Automated |
| AC-V19 | versioned schema-validated config; invalid fails fast; hash in finding provenance | `variance-rules-config-schema-and-provenance` | Fully-Automated |
| AC-V20 | byte-equal across repeated runs; works with no AI | `variance-determinism-repeat-run`, `variance-no-llm-full-run` | Fully-Automated |
| AC-V16 (core part) | `scope_exists` runner: violated gives a critical regression finding; held gives none | `variance-regression-scope-exists` | Fully-Automated |

## Entry Gate

- Intake feature CLOSED (Step 0 done 2026-10-17); inner PVL re-validated this plan against the Refresh Note. No other program phase must precede V1.
- Working tree free of unrelated uncommitted changes in the blast radius; HEAD recorded in the report.

## Touchpoints

Create (all new):
- `packages/core/src/variance/types.ts` (RuleId, ChangeClass, VarianceResult, VarianceMeta zod, CosmeticGroup, RegressionCheck, Owner)
- `packages/core/src/variance/rules-schema.ts` (zod strict schema), `variance-rules.json` (versioned config: `version`, tokenizer + hunk merge pins, `new_min_words`, guard word lists, cosmetic rule params, `audience_dimensions`, routing table, gate policy, `regression` caps), `rules.ts` (load, validate, canonical hash, `rulesHash8`; invalid config throws a clear error and produces no findings)
- `packages/core/src/variance/label.ts` (`normalizeAssertionLabel`, scopeLabel-based, exported by name so the Phase 03 server re-normalization imports the SAME function), `hunks.ts`, `classify.ts`, `cosmetic.ts`, `impact.ts`, `audience.ts`, `routing.ts`, `owners.ts` (`questionKey`, `parseQuestionKey`), `regression.ts` (`runRegressionChecks`, `describeAssertion`, `assertionCandidateOf`), `adapter.ts` (Finding builders, `varianceMetaOf`), `run.ts` (`runVariance`), `index.ts`
- `packages/core/test/{unit,property,golden}/variance-*.test.ts` (names per Acceptance Criteria)
- `fixtures/variance/**` (generated: `hartwell-crane/{fund-I,fund-II,fund-III,fund-III-with-appendix-c}.html`, `seeded/*.html`, `expected/*.json`)
- `scripts/src/fixtures/build-variance.ts`
- `packages/core/test/unit/variance-sheet-owner-and-template.test.ts` (new gate, see G4)
- `packages/core/test/unit/variance-package-01-northgate.test.ts` (new gate, see H4; D-S0-5)

Modify (additive only):
- `packages/core/src/counsel/gate.ts` (optional `policy` 4th parameter, optional `gates?: boolean` on `GateFinding`, optional `owner` on `GateReason`, optional `ownerAnswers` on `GateState`; the `ComputeGate` function type in `counsel/types.ts` gains the optional 4th `policy` parameter in the same edit)
- `packages/core/src/counsel/sheet.ts`, `packages/core/src/counsel/types.ts` (optional `CounselSheet.meta.owner`; `buildCounselSheet` option to filter per owner)
- `packages/core/src/counsel/template-draft.ts` (deterministic `version_drift` plus `change_type` path: old text, new text, A/B/C options; intent is human-only)
- `.prettierignore` (ONE appended line `fixtures/variance/`; precedent `fixtures/diff/`; registry note: add `.prettierignore` to the V1 claim in `phase-blast-radius-registry.md`, owned by the orchestrator, not edited by this plan)
- `packages/core/src/index.ts` (append-only EXPLICIT NAMED export line for `./variance/index`; seam, serialized; never `export *`, so it cannot collide with Intake's landed `export * from './package/index'` at `index.ts:172`)
- `packages/core/src/diff/index.ts` ONLY IF check A1 shows a needed symbol is not exported (one additive export line, no behavior change)
- `scripts/src/fixtures/build-seeded.ts` (ONE appended line invoking `build-variance`), `scripts/src/fixtures/check.ts` (extend the stray-file scan to `fixtures/variance`, additive; rebased on Intake's landed `check.ts`: slot the scan before the final `if (problems.length)` block, mirror the `walkStray(DIFF_DIR)` pattern at check.ts:40-49 against the `fresh` map, call it right after `walkPkg(PACKAGE_DIR)` at line 167, never touch `fixtures/package/**`)

Not touched in V1: `contracts/*` and the contracts snapshot, `findings/*`, `taxonomy.ts`, `detectors/registry.ts`, `fixtures/memory/law-firms.json` and `memory/firms.ts` (firm is added atomically in V3, see registry), anything under `apps/**`, README and `docs/**`.

## Public Contracts

- Frozen v1 `Finding`/`FindingSchema` unchanged; no new `issue_class` (variance uses the declared `version_drift`); `DiffResultSchema` and `SectionDiff` unchanged.
- `computeGate(rows, ...)` with `policy` undefined returns exactly the legacy result for all 2400 `gate-state-matrix` matrix cells (the test file runs 2406 tests: 2400 cells plus 6 named cases).
- "13 detectors / 15 issue classes" stays literally true: variance is a diff-derived producer, not a registered detector; `version_drift` becomes emitted (the README phrase "1 from version diff" becomes true). No README or `docs/**` edit.
- New public core exports (appended as an explicit named list, never `export *`): `runVariance`, `varianceMetaOf`, `loadVarianceRules`, `questionKey`, `parseQuestionKey`, `runRegressionChecks`, `describeAssertion`, `assertionCandidateOf`, `normalizeAssertionLabel`, `VarianceResult` and related types.
- Facts contract: `detail.facts` values are scalars only (string up to 1000 chars, number, boolean, null). `varianceMetaOf` is the sole decoder and returns the typed shape; V2, V3 and V4 never read raw `detail.facts`.
- No new AI task: `AI_TASK_IDS` and the contracts snapshot do not move.

## Blast Radius

Files directly modified or created: the Touchpoints list above (about 15 new source files, about 14 new test files, generated fixtures, 6 additive edits). Collision files with Intake (Step 0 observed): `index.ts` (star export landed at :172), `check.ts` (extended, +41 lines); `counsel/{gate,sheet,types}.ts` and `build-seeded.ts` have NO Intake change (see registry). Frozen surfaces guarded: `diff-contract`, `diff-determinism`, `gate-state-matrix`, `sheet-contents`, `contracts`, `golden-05-06-drift`.

## Implementation Checklist

### Section A - PLAN-time verifications (first tasks; record each result in the phase report)

- [x] A1. Confirm `Unit` (`diff/align.ts`) exposes `text`, `norm`, `key`, `blockIndices` and that `buildUnits`, `alignUnits`, `Unit`, `Alignment` are exported from `diff/index.ts` (observed at plan time: yes). Confirm the aligned pair list lets you derive the old-to-new section number map (`Unit.key` of paired units). If a needed symbol is missing, add ONE export line to the diff barrel; if the map cannot be derived, derive it from `keyA`/`keyB` inside `variance/` instead (no diff edit).
- [x] A2. Confirm the D1 `finding` table has no CHECK that rejects `detector_id` of the form `variance.<rule_id>` and that `pattern_key` (1 to 80 chars) accepts rule ids (observed: `pattern_key` CHECK is length 1..80, `detector_kind` CHECK is rule|ai; confirm `detector_id` has none). Confirm `ActiveDecision.fund_name` is required (observed: `contracts/memory.ts:62`, `z.string().max(200)`). Output feeds V3.
- [x] A3. Confirm core imports JSON with `with { type: 'json' }` (observed in `memory/firms.ts`); if so the rules config is `variance-rules.json`. Confirm the same import works in the web engine worker build (V2 re-checks).
- [x] A4. Run the baseline: `pnpm --filter @aduin/core test diff-contract`, `diff-determinism`, `gate-state-matrix`, `sheet-contents` (one token per call) and record the green counts before any edit.

### Section B - Rules config and hash (AC-V19)

- [x] B1. Write `rules-schema.ts` (zod `.strict()`; every rule id unique; word lists lower-case; numeric pins integers) and `variance-rules.json` (`version: "2026.10.1"`, tokenizer `word-punct`, hunk `merge_gap_tokens`, `new_min_words: 12`, guards, cosmetic params, `audience_dimensions` US vs non-US plus named-country patterns incl. Singapore, ordered routing table per DECISION D4, `error_owner_by_issue_class` default counsel, gate policy flags `untriaged_change_blocks: true`, `asked_unanswered_blocks: true`, `regression_blocks: true`, regression cap per firm 20).
- [x] B2. `rules.ts`: `loadVarianceRules(raw?)` validates, throws `VarianceConfigError` with the failing path; `rulesHash8` = first 8 hex of sha256 over canonical (sorted-key) JSON using `@noble/hashes`. Never returns partial rules.
- [x] B3. Gate: run `pnpm --filter @aduin/core test variance-rules-config-schema-and-provenance` (valid, invalid, hash stable under key reorder, hash recorded in `detail.facts.variance_rules_hash8`).

### Section C - Hunker (D1 raw change)

- [x] C1. `hunks.ts`: for each aligned unit pair build token arrays from full `Unit.text` of BOTH structures (NOT `DiffResult.segments`), run `diff` v9 word diff, merge per the pinned rule, emit hunks `{unitKeyA, unitKeyB, kind: insert|delete|replace, oldTokens, newTokens, oldText, newText}`. Whole added/removed unit = 1 hunk per block. `diff` returning `undefined` on `maxEditLength`/`timeout` must map to a single coarse replace hunk flagged `truncated` (guard word) - never throw.
- [x] C2. `VarianceResult.summary.raw` = total hunks. Gate: `variance-demo-count` asserts 214.

### Section D - Classifier and cosmetic groups (AC-V2, V5, V6, V7)

- [x] D1. `classify.ts` implements the ordered algorithm of DECISION D1 exactly (step 0 firm guard emits `notice: cross_firm` and no output; step 1 whole unit added/removed and pure insertion of at least `new_min_words`; step 2 logic guards on changed tokens only (digits, percent, amount, negation, modals, condition words, `typesIn` investor terms, jurisdiction words, `truncated`); step 3 positive cosmetic rules; step 4 default logic). Every decision records `rule_id`. Digit guard ordering (G2): before the step-2 digit guard runs, each hunk is first evaluated by the rule that explains its digits: a hunk whose only digits are an old-to-new section number mapped by the alignment is evaluated by VAR-COS-RENUMBER; a date hunk in the cover/header is evaluated by VAR-COS-DATE. If that rule accepts, the digits are removed from the guarded token set. Every OTHER guard (amount, percent, negation, modal, condition, investor term, jurisdiction, truncated, or any additional changed digit) still wins and gives logic. Precedence: where this checklist and DECISION D1 text differ (the G2 digit-guard exemption here, the G3 cluster class in D3), THIS PLAN governs. Cover/header for VAR-COS-DATE = a unit of kind `scope` (the document or scope preamble produced by `buildUnits`); confirm at A1 that the authored cover date sits in such a unit, and adjust the authored fixture, never the rule. Named cases in `variance-classification-contract`: renumber-mapped-target = cosmetic; renumber-target-did-not-move = logic; cover-date = cosmetic; date-in-operative-text = logic; Units to Shares plus an added number = logic; renumber hunk that also changes a percent = logic.
- [x] D2. `cosmetic.ts`: VAR-COS-RENAME (hunk equals a `DiffResult.renames` pair), VAR-COS-NAME (repeated proper-noun swap, at least 2 occurrences, not relying on `inferRenames` thresholds), VAR-COS-RENUMBER (label changes AND alignment maps old target number to new; a reference whose target did not move is LOGIC), VAR-COS-DATE (cover/header only; a date in operative text is logic), VAR-COS-FORMAT (equal after case, whitespace, punctuation normalization), VAR-COS-MOVED (moved unit, identical text). Cosmetic hunks become display-only groups keyed by rule id (and rename pair) with count and up to 3 examples. Guard-token rule for the format group: VAR-COS-FORMAT is evaluated after the step-2 guards (unknown means logic), so a format change on a guard-bearing token (for example `$1,000` to `$1000`, `MAY` to `may`) is classified logic by design; the 11 authored format hunks and the format trap pairs must therefore contain no guard tokens, and one named case in `variance-classification-contract` pins the guard-bearing format change as logic.
- [x] D3. Non-cosmetic hunks cluster per aligned unit into one change row. Cluster class rule (G3): `new` if the unit was added, OR every non-cosmetic hunk of the cluster is a step-1 `new` insertion (pure insertion of at least `new_min_words` words); a MIXED cluster (any non-new hunk) is `changed_logic`. The 7 demo items live in SEPARATE alignment units so they cannot collapse into one row (see H2). Named cases in `variance-classification-contract`: all-insertions cluster = new; mixed cluster = changed_logic; added unit = new; 7-word insertion (4.2) = changed_logic.
- [x] D4. Gates: `variance-classification-contract`, `variance-seeded-recall-matrix`, `variance-precision-measure`, `variance-golden-05-06`.

### Section E - Impact and routing (AC-V10, V11)

- [x] E1. `impact.ts` `computeImpact(change, A, B)` per DECISION D3: affected investor types = union over both sides of `investorModelOf` paths whose `sections`/`questions` intersect the changed unit key plus `typesIn(hunk text)`; affected conditional paths from `Structure.conditionals` (`blockIndex`/`targets`) as old to new pairs; "old form rule reusable" = yes only when impact sets are empty, the unit touches no conditional/question/option/field, and affected investor sets are equal; unknown or `InvestorPath.uncertain` = no, flagged uncertain. Labelled "from the logic graph and qualifier rules, deterministic".
- [x] E2. `audience.ts`: diff audience qualifiers old vs new; a restriction phrase ("now applies only to", "formed or organized outside") adds the complement audience; map to entity family via `typesIn`. Demo 4.2 output: entities affected, US entities lose the beneficial-owner question, old rule not reusable.
- [x] E3. `routing.ts`: ordered first-match rules (change_type, title regex, rule id, keywords, impact flags) returning 1 to 2 owners plus a one-line reason; default counsel; error findings owner from `issue_class` row. Owners are `counsel | gp | fund_admin`.
- [x] E4. Gates: `variance-impact-from-graph-fixtures`, `variance-impact-demo-4-2`, `variance-routing-table-matrix`.

### Section F - Finding adapter and meta (D2)

- [x] F1. `adapter.ts`: build each change as a valid `FindingSchema` object WITHOUT `buildFinding` (its quote comes from the new graph block, wrong for a removed unit): compose with `findingId`, `quoteHash`, `makeAnchor`, `mask`/`sensitiveSpans` and `FindingSchema.parse`. Fields: `issue_class 'version_drift'`, `detector_kind 'rule'`, `detector_id 'variance.<rule_id>'`, `pattern_key <rule_id>`, severity `medium` (new/logic) or `critical` (regression), `quote` = new clause text (removed unit: old text with `quote_side 'old'`), anchor = nearest block in the new document, doc start offset 0 for a removed unit. All metadata in `detail.facts` as SCALARS ONLY: `kind` (change|regression), `change_type`, `rule_id`, `variance_rules_version`, `variance_rules_hash8`, `baseline_doc`, `quote_side` (strings); `suggested_owners` as ONE comma-joined string (for example `counsel,gp`); `impact_*` lists as ONE deterministic JSON string each, clipped to 1000 chars with a `truncated` marker; optional assertion candidate as two flat keys `assertion_kind` and `assertion_label`. Fingerprint is the existing `fp1|firm|issue_class|quote_hash` (no change). Real limits are `FindingDetailSchema` (scalar facts, 1000-char strings), the 128 KB Worker body cap and the 25-finding chunk cap; the Worker never persists finding `detail` (detail_json is always NULL), so there is NO 2000-char detail_json clip and no 1800 cap. `variance-finding-adapter-contract` asserts: every output parses with `FindingSchema`; every fact value is a scalar; every string fact is at most 1000 chars; list encodings round-trip through `varianceMetaOf`.
- [x] F2. `varianceMetaOf(finding)`: the ONLY decoder of variance facts: single typed accessor with a zod parse over the scalar facts; splits `suggested_owners` into `owners: Owner[]`, parses the `impact_*` JSON strings, and reassembles `assertion_candidate?: {kind, label}` from `assertion_kind`/`assertion_label` (returns undefined for non-variance findings; throws on malformed variance facts). Contract test: every adapter output parses with `FindingSchema` and `varianceMetaOf`.
- [x] F3. `run.ts` `runVariance({baseline, current, rules?})` takes `SideInput {structure, graph, findings}` for both sides, no AI input; returns `{findings, meta (by finding id), cosmeticGroups, summary {raw, shown, cosmetic}, notice?}`. `runVariance` has NO `checks` input and never runs regression checks: `summary.shown` counts change rows only (7 on the demo pair); the R-01 regression finding comes from the separate F4 call `runRegressionChecks(structure, checks)` (V4 calls it through the engine `runRegression`). `variance-regression-scope-exists` and `variance-demo-count` call it directly on Fund III (one critical regression finding) and on `fund-III-with-appendix-c` (none).
- [x] F4. `regression.ts`: `runRegressionChecks(structure, checks)` evaluates `scope_exists` against `Structure.scopes` using `scopeLabel` normalization; a violation becomes a critical finding labelled "Regression: confirmed in <fund>" with `detector_id 'variance.regression.scope_exists'` and the check statement as the quote. `describeAssertion({kind,label})` returns the one-line preview. `assertionCandidateOf(change)` returns the candidate only for removed/added `appendix` scope units, with the label passed through `normalizeAssertionLabel` (scopeLabel-based, in `variance/label.ts`, exported by name; Phase 03 server re-normalization imports this same function).
- [x] F5. Gates: `variance-finding-adapter-contract`, `variance-regression-scope-exists`, `variance-ai-never-gates-core`.

### Section G - Gate policy, owner keys, sheet (AC-V12, V17)

- [x] G1. `gate.ts`: add optional `policy` 4th parameter (and the same optional parameter on the `ComputeGate` type in `counsel/types.ts`); semantics defined here and asserted in `variance-gate-state-matrix`: `GateFinding.gates?: boolean` = the caller marks a variance change finding as gating-eligible regardless of severity (undefined keeps legacy `isGating`); `GateState.ownerAnswers?: Partial<Record<Owner, CounselOption | null>>` where key PRESENT = that owner was asked and `null` = asked, not answered (a missing key = not asked); with policy on a row gates if (kind change and untriaged) OR kind regression OR an asked question is unanswered (any severity). `detector_kind 'ai'` stays non-gating even if asked. `GateReason.owner?` and `GateState.ownerAnswers?` (a finding resolves only when every asked owner answered A/B/C; any "unclear" gives `unclear`; any missing gives `awaiting_counsel`). Existing reason mapping reused unchanged. `computeGate` stays exactly two states.
- [x] G2. `owners.ts`: `questionKey(findingId, owner?)` returns `<findingId>@<owner>` for change findings and the plain id for error findings; `parseQuestionKey`. One helper, used everywhere.
- [x] G3. `sheet.ts`/`types.ts`: `CounselSheet.meta.owner?` and the per-owner filter in `buildCounselSheet`; unchanged output when no owner is passed. `template-draft.ts`: deterministic `version_drift` path (old text, new text, A/B/C).
- [x] G4. Gates: `variance-gate-state-matrix`, `variance-question-key-matrix`, NEW `variance-sheet-owner-and-template` (owner filter leaves output unchanged when no owner is passed; masked `version_drift` template draft with old text, new text, A/B/C; interpretations at most 500 chars each via `maskAndClamp`), then regression `gate-state-matrix` and `sheet-contents`.

### Section H - Barrel, corpus, generator

- [x] H1. Append ONE explicit named export line to `packages/core/src/index.ts` (`export { runVariance, varianceMetaOf, loadVarianceRules, questionKey, parseQuestionKey, runRegressionChecks, describeAssertion, assertionCandidateOf, normalizeAssertionLabel } from './variance/index'` plus `export type {...}`; never `export *`; serialized seam). Intake's `export * from './package/index'` is LANDED (`index.ts:172`); Step 0 grep found zero collisions with every planned name (also `Owner`, `RuleId`, `ChangeClass`, `VarianceResult`, `CosmeticGroup`, `RegressionCheck`); re-grep at EXECUTE entry.
- [x] H2. `scripts/src/fixtures/build-variance.ts` generates the corpus deterministically (no timestamps, fixed seed): Hartwell and Crane docs per the Overview design, `seeded/` trap pairs (cosmetic traps: renumbering with moved target, fund name, cover date, Units to Shares, format; logic items: the 7 demo items; edge traps: date in operative text, single-occurrence name, reference whose target did not move, number/negation/modal/condition guards, truncated), and `expected/*.json` (class, rule id, owners, impact per seeded change). `expected/*.json` is HAND-AUTHORED, never computed from the engine, and includes the demo item table (item to class to rule id to owners). The 7 demo items sit in SEPARATE alignment units (lettered Parts or separate sections for Singapore, tax status and trust split): 3 `new` (7A new section; Singapore list item inserted as a sentence of 12 words or more; 8(f) sanctions paragraph of 12 words or more) and 4 `changed_logic` (4.2 with 7 inserted words; Class A minimum amount; tax status; trust split). In `build-variance.ts` import `html`/`json` from `build-seeded.ts` ONLY lazily inside functions (circular import: `build-seeded.ts` imports `build-variance.ts`), or move the shared helpers into a small new module. `variance-demo-count` asserts the table. Raw-count constraint (inner PVL, E12): a wholly added unit counts 1 raw change PER BLOCK (DECISION D1), so each of the 7 demo items must contribute exactly ONE raw change: author 7A so its added unit has exactly one block (a heading-only unit is acceptable for the pin) and the Singapore and 8(f) items as one contiguous insertion inside an existing unit; if the structurer cannot produce a one-block added unit, STOP, record the measured count and request a PLAN-SUPPLEMENT (never move 214/7/207 silently). Append ONE line to `build-seeded.ts`; extend `check.ts` stray-file scan (a `walkStray`-style scan of `fixtures/variance` against the `fresh` map, slotted after line 167 and before its final `if (problems.length)` block; Intake's `make-package.ts` and `fixtures/package/**` are not touched).
- [x] H3. Append `fixtures/variance/` to `.prettierignore` (one line), then gate: `pnpm --filter @aduin/scripts fixtures:build` then `pnpm --filter @aduin/scripts fixtures:check` (twice in a row, second run produces no diff) and `pnpm lint` (prettier must not see generated fixtures).

- [x] H4. Package-01 test (D-S0-5; pins rewritten by the inner PVL 17-10-26; THIS H4 governs over any older "7 shown = 3 new + 4 changed_logic" wording for the design pair elsewhere in this plan or the umbrella). Add `packages/core/test/unit/variance-package-01-northgate.test.ts`. Inputs: Fund III `fixtures/package/design/northgate-iii/01-NG3-Subscription-Agreement.docx` against the Fund II baseline `fixtures/package/design/northgate-iii/04-NG2-Subscription-Agreement-2024.docx`, loaded with the existing Intake helpers `load(rel)` and `graphOf(loaded)` from `packages/core/test/helpers/package-fixtures.ts` (relative imports; they run the shipped DOCX adapter; `runDeterministic(graph)` supplies each side's `findings` for `runVariance`); NEVER use `samples/packages/` as a test input (design-owned, read-only; Intake's `fixtures:check` already guards the copy through `checksums.json`); the executor may READ `samples/packages/01-northgate-infrastructure-iii/answer-key.md` section B only to author the expected passage table. Why the earlier pins changed (observed in code at the inner PVL): units are top-level sections only (`structure/headings.ts` SECTION_RE `^\s*(\d{1,2}[A-Z]?)\.`; dotted `4.2` and `10.4` are not headings), so key items share units: V2 (Singapore row) and V4 (4.2) both sit in Section 4, V6 (tax status) and V7 (trust rows) both in Section 6, V3 (10.4) is an insertion inside Section 10, V5 is in Section 1; D3 clusters per unit, so the engine is predicted to show about 5 rows for the key's 7 items, and the key's "cosmetic" address (Suite 1200 to 1400) and first-closing date changes are digit changes in operative text, which the D1/G2 digit guard classifies logic. Assertions (all must pass; the test exits 0): (a) RECALL 7 of 7: each key item's changed passage lies inside a NON-cosmetic hunk of a SHOWN change row (V1 `Source of Funds Verification`; V2 `Singapore`; V3 `Sanctions`; V4 `formed or organized outside`; V5 `$2,500,000`; V6 `select all that apply`; V7 `Revocable trust`) and appears in no cosmetic group; (b) every raw change has exactly one class with rule id and old/new passage; (c) MEASURED pins: raw, shown, new, logic, cosmetic and cosmetic-group counts are measured at EXECUTE then hand-pinned in the test and reported; (d) two runs are byte-equal. RECORDED, NOT ASSERTED (phase report key-vs-engine table; write `process/features/variance-management/backlog/variance-package-01-key-divergence_NOTE_17-10-26.md` when any row differs): the key's 7 shown with 3 `new` + 4 `changed_logic`, the per-item class, and the V7 owner (key says Counsel, SPEC A9 says GP, D-S0-6: note only). If any key passage is NOT recalled under (a), that is a real defect: stop and route to RESEARCH; never loosen the assertion or bend a rule. Gate: `pnpm --filter @aduin/core test variance-package-01-northgate` (in Test Gates below). The authored corpus keeps the exact 214/7/207 pin and the R-01 chain.

### Section I - Wrap-up

- [x] I1. `variance-determinism-repeat-run` (3 repeated runs byte-equal incl. JSON.stringify) and `variance-no-llm-full-run` (no network, no transport created).
- [x] I2. Full regression block (Exit Gate), then `pnpm --filter @aduin/scripts record:author --check` (candidate quotes may not move; V1 touches no `llm/` file, expected unchanged).
- [x] I3. Write the phase report; note any ONE-LINE export added to the diff barrel.

### Edge cases carried from vc-scenario (each needs a named test case)

1. Hunk count pin: merge granularity changes the count - test with a pair whose adjacent edits are 0, 1 and 2 tokens apart; the fixture count is pinned to the config, not to the algorithm default.
2. Cosmetic misclassified: renumber whose target did not move = logic; date in operative text = logic; fund-name swap with 1 occurrence = logic; Units to Shares in a sentence that also adds a number = logic (guard wins).
3. Facts shape: list and assertion encodings round-trip through `varianceMetaOf`; a nested array or object in facts must fail the adapter contract; a label with odd casing or a plural normalizes identically through `normalizeAssertionLabel`.
4. Key leakage and gate off-equality: finding ids containing `@`, error findings must keep the plain key, gate with policy undefined byte-equal to legacy on all 2400 matrix cells (2406 tests in the file).

## Test Gates (exact commands; no `--` token; one token per call)

```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction
pnpm --filter @aduin/scripts fixtures:build
pnpm --filter @aduin/scripts fixtures:check
for t in variance-rules-config-schema-and-provenance variance-classification-contract variance-seeded-recall-matrix variance-precision-measure variance-golden-05-06 variance-impact-from-graph-fixtures variance-impact-demo-4-2 variance-routing-table-matrix variance-demo-count variance-package-01-northgate variance-finding-adapter-contract variance-regression-scope-exists variance-ai-never-gates-core variance-gate-state-matrix variance-question-key-matrix variance-sheet-owner-and-template variance-determinism-repeat-run variance-no-llm-full-run; do pnpm --filter @aduin/core test "$t" || exit 1; done
```

Regression block (overlapping earlier surfaces):

```bash
for t in diff-contract diff-determinism diff-pairs diff-perf gate-state-matrix sheet-contents contracts golden-05-06-drift sibling-clause-common-vs-differing security package-gate-policy-matrix package-baseline-eligibility; do pnpm --filter @aduin/core test "$t" || exit 1; done
pnpm --filter @aduin/core test:golden
pnpm --filter @aduin/core test:corpus
pnpm --filter @aduin/core typecheck
pnpm --filter @aduin/scripts record:author --check
pnpm lint
pnpm typecheck
```

Note: the token `gate-state-matrix` also matches `variance-gate-state-matrix` (substring); both must pass. An unmatched token exits 1, which proves a gate cannot pass vacuously. Under heavy load `diff-determinism` and `size-cap` can time out; re-run in isolation before treating as a failure.

## Test Coverage Plan (vc-test-coverage-plan output; routing chain loaded: all-tests.md, engine/all-engine.md)

| Area | Tier | Scenario | Command | Proves | Does NOT prove |
|---|---|---|---|---|---|
| core/variance | Fully-automated | one class per change, evidence present | `pnpm --filter @aduin/core test variance-classification-contract` | AC-V2 | meaning on unseen real documents |
| core/variance | Fully-automated | recall matrix 100%, logic hidden as cosmetic = 0 | `variance-seeded-recall-matrix` | AC-V5 | recall on documents outside the corpus |
| core/variance | Fully-automated | precision at most 10% | `variance-precision-measure` | AC-V6 | precision on other firms |
| core/variance | Fully-automated | #5 to #6 goldens | `variance-golden-05-06` | AC-V7 | AI narrative wording (not used) |
| core/counsel | Fully-automated | gate policy off equals legacy; policy on counts | `variance-gate-state-matrix` plus `gate-state-matrix` | AC-V17 core | web pill rendering (V2) |
| core/variance | Hybrid | contradicting recorded AI input changes nothing | `variance-ai-never-gates-core` (precondition: a hand-built or existing recorded AI findings array) | AC-V9 core | the browser flow (V2 e2e) |
| core/counsel | Fully-automated | per-owner sheet filter unchanged without owner; masked `version_drift` template (G3) | `variance-sheet-owner-and-template` | AC-V12 and AC-V4 sheet path (core part) | web per-owner export (V4) |
| scripts/fixtures | Fully-automated | generator deterministic, no stray files | `fixtures:build` then `fixtures:check` | corpus integrity | demo realism to a human (V5 agent-probe) |
| core/variance (package 01) | Fully-automated | design Northgate III vs Fund II (real DOCX): all 7 answer-key passages recalled in non-cosmetic hunks of shown rows (none cosmetic), one class per change, raw/shown/new/logic/cosmetic/group counts measured then pinned; the key's 7 shown = 3 new + 4 logic and per-item classes recorded in the report (a differing row gets a backlog note, never a silent pass) | `pnpm --filter @aduin/core test variance-package-01-northgate` | AC-V4 corroboration on a real DOCX pair (recall), AC-V2 | that the engine reproduces the key's 7 rows or 3 + 4 split; cosmetic group count (not pinned by the key); V7 owner (key says Counsel, SPEC A9 says GP: note only); other firms |
| impact on real samples | Known-gap (named residual) | impact precision on real documents is unproven (investor-path ground truth backlog P2-2) | none | - | labelled "uncertain" in output; backlog stub `variance-impact-real-sample-ground-truth_NOTE_17-10-26.md` in `process/features/variance-management/backlog/`; gate for AC-V10 stays pinned by the authored fixtures, not claimed for real data |

Failing stubs (TDD red-first, consumed by EXECUTE from the validate-contract): each Fully-automated scenario above starts as `test("should <scenario>", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: <scenario>") })` in its named file.

## Exit Gate

- Every command in Test Gates exits 0; counts recorded (core file/test totals before and after).
- `variance-demo-count` reports raw 214, shown 7 (3 new, 4 logic), cosmetic 207 in 5 groups.
- Report written to the report destination with regression lines `Regression: [surface] - [PASS|FIXED|BLOCKED]`.

## Blockers That Would Justify BLOCKED Status

- Intake changed `computeGate` in a way that cannot take an optional 4th policy parameter additively (needs an Intake-owner decision). Step 0 observed NO change (`counsel/gate.ts:43`), so this is now only an EXECUTE-entry re-check.
- Check A1 shows the alignment cannot supply an old-to-new number map and `keyA`/`keyB` derivation is unsound (renumber rule cannot be made positive); then VAR-COS-RENUMBER is dropped, renumber stays logic, and AC-V4 counts are re-pinned in a PLAN-SUPPLEMENT.
- `record:author --check` reports drift caused by this phase (must not happen; stop and route to RESEARCH).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC.

- [x] 0. PRECONDITION - Intake feature closed; Step 0 re-sync done; Inner Loop Refresh Note written (2026-10-17; Step 0 research, D-S0 decisions and this supplement also cover steps 1-3 for Phase 01: the orchestrator ticks 1-3 on receipt of `PHASE_COMPLETE: PLAN-SUPPLEMENT`)
- [x] 1. RESEARCH - research-agent: prior reports read; test context loaded; drift since plan checked
- [x] 2. INNOVATE - innovate-agent: approach decided (n/a if the DECISION still holds after Step 0)
- [x] 3. PLAN-SUPPLEMENT - plan-agent: existing phase plan updated (or "n/a - research clean")
- [x] 4. PVL - vc-validate-agent: full V1-V7; validate-contract per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [x] 5. EXECUTE - vc-execute-agent (opus): all checklist items done; per-section test gates green (2026-10-17; commits 42b3ecb, 7f0f355, d954511; report variance-mvp-phase-01-core-engine_REPORT_17-10-26.md)
- [x] 6. EVL - independent vc-tester: gates re-run; follow-up stubs registered; EVL HANDOFF SUMMARY written (2026-10-17; 1 fix cycle, AC-V6 strict precision; HALTED_SUCCESS)
- [x] 7. UPDATE PROCESS - archived; context updated; committed (plan stays in active/ with the program; phase VERIFIED 2026-10-17)

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder - vc-validate-agent writes this section before EXECUTE)", the orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates is a placeholder.

Strategy (vc-agent-strategy-compare, PLAN-end): signals S2 (frozen-adjacent contracts), S7 (5+ files) = 2/7 MEDIUM, but sections B to G share `variance/types.ts` and `index.ts`, so no disjoint fan-out: recommended SEQUENTIAL single EXECUTE agent (opus), sections in order, per-section gate after each; EVL by an independent sonnet vc-tester.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `variance-classification-contract` | Fully-Automated | AC-V2 |
| `variance-demo-count` | Fully-Automated | AC-V4 (core part) |
| `variance-package-01-northgate` | Fully-Automated | AC-V4 (package-01 corroboration), AC-V2 |
| `variance-seeded-recall-matrix` | Fully-Automated | AC-V5 |
| `variance-precision-measure` | Fully-Automated | AC-V6 |
| `variance-golden-05-06` | Fully-Automated | AC-V7 |
| `variance-ai-never-gates-core` | Hybrid | AC-V9 (core part) |
| `variance-impact-from-graph-fixtures`, `variance-impact-demo-4-2` | Fully-Automated | AC-V10 |
| `variance-routing-table-matrix` | Fully-Automated | AC-V11 (core part) |
| `variance-question-key-matrix` | Fully-Automated | AC-V12 (core part) |
| `variance-sheet-owner-and-template` | Fully-Automated | AC-V12 (core part, per-owner sheet and template draft) |
| `variance-gate-state-matrix` plus `gate-state-matrix` | Fully-Automated | AC-V17 (core part) |
| `variance-rules-config-schema-and-provenance` | Fully-Automated | AC-V19 |
| `variance-determinism-repeat-run`, `variance-no-llm-full-run` | Fully-Automated | AC-V20 |
| `variance-regression-scope-exists` | Fully-Automated | AC-V16 (core part) |
| `diff-contract`, `diff-determinism`, `sheet-contents`, `contracts`, `golden-05-06-drift` | Fully-Automated | base AC8, AC19, AC20-22 stay green |

## Test Infra Improvement Notes

- Design-session packages: Step 0 (c) DECIDED (D-S0-5): package 01 becomes the extra core test `variance-package-01-northgate` (read from `fixtures/package/design/northgate-iii/`, never `samples/packages/`); packages 02 and 03 stay V5 inputs.
- A shared Hartwell and Crane fixture builder is created here (`build-variance.ts`); Intake's synthetic package should reuse its output rather than author a second set (record in the umbrella dependency note).
- Concurrent Playwright on port 4317 is not relevant in V1 (no browser), but this phase must not be EXECUTEd in parallel with another agent that edits `packages/core/src/index.ts`.

## Resume and Execution Handoff

- Selected plan file path: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-01-core-engine_PLAN_17-10-26.md`
- Umbrella plan: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md`
- Last completed step: Step 0 PLAN-SUPPLEMENT 2026-10-17 (Intake closed; Refresh Note written; not started otherwise)
- Validate-contract status: inner-pvl contract (generated-by: inner-pvl: phase-1, 2026-10-17, Gate PASS) below supersedes the invalidated outer-pvl contract; no further PVL needed before EXECUTE unless a newer Inner Loop Refresh Note appears
- Next step: EXECUTE (loop step 5): vc-execute-agent (opus) receives this one exact plan path and the Test Gates and Execute-agent instructions E1 to E14 in the contract below.
- Validators for the plan artifact: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this plan>` and `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <this plan>`.
- Hard rules for every agent prompt: never run git stash, checkout, reset or restore; commit directly on main with conventional prefixes; never run git push in any phase (the user pushes); execution commits separate from process commits.

## Inner Loop Refresh Note: 2026-10-17 — changed sections: header (Depends on), Step 0 (corrected names, new status paragraph with D-S0-5/6/8/9), Acceptance Criteria (AC-V4, AC-V11 rows), Entry Gate, Touchpoints, Public Contracts, Blast Radius, Implementation Checklist (H1, H2, new H4, edge case 4), Test Gates, Test Coverage Plan, Blockers, Phase Loop Progress, Verification Evidence, Test Infra Improvement Notes, Resume and Execution Handoff. Invalidates prior validate-contract.

Written by the Step 0 PLAN-SUPPLEMENT at 2026-10-17 22:11 local, after this plan's outer-pvl contract (written 17:49 the same day). Basis `variance-mvp_STEP0-RESYNC_17-10-26.md`. New in this plan: checklist H4 and gate `variance-package-01-northgate` (D-S0-5); gate matrix wording 2400 -> 2406 cells; `build-package.ts` -> `make-package.ts`; Intake `check.ts` and star barrel observed in code; regression block gains `package-gate-policy-matrix` and `package-baseline-eligibility`; V7 owner stays GP (D-S0-6). Push rule restated (D-S0-8); untracked `.playwright-mcp/` and `.DS_Store` are not Variance's (D-S0-9). PVL-new concerns to check: the three package-01 rows that are UNVERIFIED against the DOCX table handling, and whether Intake's `structure/{headings,conditionals}.ts` edits moved unit keys used by `variance-golden-05-06`.

## Deviations

Written by EXECUTE 2026-10-17 (autonomous; all within the Phase 01 blast radius; no hard-stop class touched: no schema, D1, Worker, web, contracts or deploy change).

| # | What deviated | Why | Impact |
|---|---|---|---|
| X1 | Step-3 cosmetic order is renumber/date (G2) -> FORMAT -> NAME -> RENAME (D1 lists rules, not an order) | `e-mail` -> `email` repeated 4x is inferred by `inferRenames` as a rename; "equal after case/punctuation normalization" is the stricter claim | Format group is format; no class changes (all cosmetic either way) |
| X2 | `VarianceResult` also returns `rawChanges` (every hunk with class + rule id) and `summary.new` / `summary.changed_logic` | AC-V2 ("every raw change has one class, passage, rule id") needs the raw list; counts avoid re-deriving | Additive output only |
| X3 | `VarianceSide` = `{structure, graph, findings, firmId, label?}` (plan wrote `SideInput {structure, graph, findings}`) | D1 step 0 needs both firms; `label` feeds `baseline_doc` | V2 passes `firmId` from the baseline adapter |
| X4 | New test helper `packages/core/test/helpers/variance.ts` | Shared loaders for 18 test files (DRY) | Test infra only |
| X5 | `build-seeded.ts` got 2 lines (import + one call), not 1 | ESM import is required for the call | None |
| X6 | `SheetFinding` gains optional `owners?` and `change?`; `sheet.ts` imports `questionKey` from `variance/owners` | Per-owner filter and the `version_drift` draft need them (types.ts is a touchpoint) | Additive; legacy sheet output unchanged (sheet-contents green) |
| X7 | Policy-on gate emits one reason per unresolved asked owner; regression = `gates: true` + severity critical | Per-owner counts must equal gate reasons (AC-V13/V18); `GateFinding` has no kind field | Two states kept; policy off byte-equal on 2400 cells |
| X8 | Rules config carries extra keys within B1 intent: `rules` (id/class/label list), `default_owner`, `default_reason`, `restriction_phrases`, `hunk.max_edit_length`, `regression.label_max_chars` | Rule ids must be declared once; audience restriction and edit bound must be pinned in config | Hash covers them |
| X9 | TDD red-first was applied for Section G only (gate matrix 6 red, sheet 3 red); B-F code preceded their test files | The corpus counts had to be measured against the engine before the gates could pin them | All 70 tests green; no test was weakened |

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: inner-pvl: phase-1
supersedes: 2026-10-17 (outer-pvl) - the 17:49 outer-pvl contract (Gate PASS) is invalidated by the 22:11 Inner Loop Refresh Note (Intake landed, H4 and `variance-package-01-northgate` added); inner PVL has current evidence

Parallel strategy: sequential
Rationale: 2/7 signals (S2 frozen-adjacent gate/sheet contracts, S7 5+ files; dominant S7). Sections B to G share `variance/types.ts` and `index.ts`, so there is no disjoint fan-out. EXECUTE = ONE vc-execute-agent (opus), sections A to I in order, per-section gate after each; EVL = independent sonnet vc-tester. Agent count: 1 EXECUTE + 1 EVL tester. (V2 fan-out run as one sequential read-only pass inside this validate-agent session: plan, DECISION, Step 0 re-sync and the landed code were read directly; the DESIGN DOCX pair was unzipped read-only and diffed per paragraph in the scratchpad; nothing was built or run, no test or Playwright started.)

Inner-PVL evidence summary (what was checked against the landed code, 2026-10-17, HEAD d8f3ca0, tree clean in the blast radius; only untracked `.DS_Store` and `.playwright-mcp/`, which are not Variance's):
- `packages/core/src/index.ts` ends with `export * from './package/index';` at line 172; grep of core `src` finds NO existing export named `Owner`, `RuleId`, `ChangeClass`, `CosmeticGroup`, `RegressionCheck`, `VarianceResult`, `runVariance`, `varianceMetaOf`, `loadVarianceRules`, `questionKey`, `parseQuestionKey`, `runRegressionChecks`, `describeAssertion`, `assertionCandidateOf`, `normalizeAssertionLabel`; the named export line cannot collide. `scopeLabel` lives in `diff/normalize-key.ts` and is NOT in the diff barrel: `variance/label.ts` imports it by relative path (no barrel edit needed).
- `diff/index.ts` exports `buildUnits`, `alignUnits`, `Unit`, `Alignment`, `tokenize`, `diffText`, `inferRenames`; `Unit` has `text`, `norm`, `key`, `blockIndices`, `kind`; cover/header = `kind 'scope'` (confirmed in `buildUnits`). No barrel edit needed (A1 satisfied at plan time).
- `counsel/gate.ts:43` `computeGate: ComputeGate = (findings, states, labels)` (3 args); `counsel/types.ts:39` `ComputeGate`; both untouched by Intake; the optional 4th `policy` parameter is additive.
- `gate-state-matrix.test.ts` pins `cells = 4*5*2*5*4*3 = 2400`; the Intake reports' "2406" is the file's total TEST count (2400 cells + 6 named cases). Plan wording corrected (C2).
- `scripts/src/fixtures/check.ts`: `walkStray(DIFF_DIR)` at lines 40-49 (scan against the `fresh` map), `walkPkg(PACKAGE_DIR)` at 167, final `if (problems.length)` at 169: the variance scan slots after line 167, before 169. `build-seeded.ts` exports `html`, `json`, `buildFixtures` (line 1037), unchanged by Intake; the one appended line goes inside `buildFixtures()`.
- Test runner facts (all-tests.md): every regression token resolves to an existing file (`diff-contract`, `diff-determinism`, `diff-pairs`, `diff-perf` in `test/unit/diff/`; `gate-state-matrix`, `sheet-contents` in `test/unit/counsel/`; `contracts` in `test/contracts/`; `golden-05-06-drift` in `test/golden/diff/`; `sibling-clause-common-vs-differing`, `package-gate-policy-matrix`, `package-baseline-eligibility` in `test/unit/`; `security` is the `test/security/` directory); `test:golden` and `test:corpus` scripts exist; no `--` token anywhere; the Test Gates block contains neither hook-filtered word (checked by regex on the block; exit 1 = no match).
- Intake's structure edits: `headings.ts` SECTION_RE accepts only `\d{1,2}[A-Z]?\.` (top-level) and keyword forms; dotted `4.2`/`10.4` are never section headings, so units are top-level sections (plus `Part X` parts). Whether Intake's heading and conditional edits moved unit keys in real pair #5/#6 is UNVERIFIED by reading and is an EXECUTE-time check (E13), as agreed.

Test gates (C3 5-column table; one token per call, no `--` token; commands are the plan's `## Test Gates` block, run from the repo root):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC-V19 | versioned schema-validated config; invalid fails fast, no findings; hash stable under key reorder; hash in provenance | Fully-Automated | `pnpm --filter @aduin/core test variance-rules-config-schema-and-provenance` | B |
| AC-V2 | every raw change has exactly one class, old/new passage, rule id; G2 named cases (renumber mapped = cosmetic, target did not move = logic, cover date cosmetic, operative date logic, Units to Shares plus a number = logic, renumber plus percent = logic, guard-bearing format change = logic); G3 named cases (all-insertions cluster new, mixed cluster logic, added unit new, 7-word insertion logic) | Fully-Automated | `pnpm --filter @aduin/core test variance-classification-contract` | B |
| AC-V5 | recall 100% on seeded new/logic; none classified cosmetic | Fully-Automated | `pnpm --filter @aduin/core test variance-seeded-recall-matrix` | B |
| AC-V6 | cosmetic shown as logic at most 10% of logic rows | Fully-Automated | `pnpm --filter @aduin/core test variance-precision-measure` | B |
| AC-V7 | #5 to #6: Units to Shares cosmetic; fees logic; Appendix C removed shown | Fully-Automated | `pnpm --filter @aduin/core test variance-golden-05-06` | B |
| AC-V10 | impact from the logic graph (fixtures) | Fully-Automated | `pnpm --filter @aduin/core test variance-impact-from-graph-fixtures` | B |
| AC-V10 | demo 4.2: entities affected, US loses beneficial-owner question, old rule not reusable | Fully-Automated | `pnpm --filter @aduin/core test variance-impact-demo-4-2` | B |
| AC-V11 | routing table matrix (7 owner cases) | Fully-Automated | `pnpm --filter @aduin/core test variance-routing-table-matrix` | B |
| AC-V4 (core) | authored demo pair (Fund III vs Fund II) raw 214, shown 7 (3 new, 4 logic), cosmetic 207 in 5 groups (118/41/8/29/11), no Appendix C row; hand-authored item table asserted | Fully-Automated | `pnpm --filter @aduin/core test variance-demo-count` | B |
| AC-V4 corroboration, AC-V2, AC-V5 on a real DOCX pair | design Northgate III vs Fund II: all 7 answer-key passages recalled in non-cosmetic hunks of shown rows, none cosmetic; one class and rule id per change; raw, shown, new, logic, cosmetic and group counts MEASURED at EXECUTE then hand-pinned; the key's 7 shown / 3 + 4 split recorded, not asserted | Fully-Automated | `pnpm --filter @aduin/core test variance-package-01-northgate` | B (key-vs-engine divergences: D, backlog note) |
| D2 / AC-V19 | every adapter output parses with `FindingSchema` and `varianceMetaOf`; every fact scalar; string facts at most 1000 chars; list and assertion encodings round-trip; nested array/object in facts fails | Fully-Automated | `pnpm --filter @aduin/core test variance-finding-adapter-contract` | B |
| AC-V16 (core) | `scope_exists` violated gives a critical regression finding; held gives none (called directly via `runRegressionChecks`) | Fully-Automated | `pnpm --filter @aduin/core test variance-regression-scope-exists` | B |
| AC-V9 (core) | contradicting recorded AI input changes nothing; AI never gates even when asked | Hybrid | `pnpm --filter @aduin/core test variance-ai-never-gates-core` (precondition: hand-built or existing recorded AI findings array; runs in CI, no network) | B |
| AC-V17 (core) | policy off byte-equal to legacy on all 2400 matrix cells of `gate-state-matrix` (the file runs 2406 tests: 2400 cells + 6 named cases); policy on counts untriaged change, regression, asked-unanswered; `gates` and `ownerAnswers` semantics pinned; two states only | Fully-Automated | `pnpm --filter @aduin/core test variance-gate-state-matrix` plus `gate-state-matrix` | B |
| AC-V12 (core) | `<findingId>@<owner>` key; error findings keep the plain id; `@` in ids safe | Fully-Automated | `pnpm --filter @aduin/core test variance-question-key-matrix` | B |
| AC-V12 / AC-V4 sheet path (core) | per-owner sheet filter leaves output unchanged without owner; masked `version_drift` template draft (old text, new text, A/B/C; interpretations at most 500 chars) | Fully-Automated | `pnpm --filter @aduin/core test variance-sheet-owner-and-template` | B |
| AC-V20 | 3 repeated runs byte-equal | Fully-Automated | `pnpm --filter @aduin/core test variance-determinism-repeat-run` | B |
| AC-V20 | full run with no network and no transport | Fully-Automated | `pnpm --filter @aduin/core test variance-no-llm-full-run` | B |
| corpus integrity | generator deterministic, no stray files (including `fixtures/variance`), prettier-ignored (build then check, twice; then lint) | Fully-Automated | `pnpm --filter @aduin/scripts fixtures:build` then `pnpm --filter @aduin/scripts fixtures:check`, then `pnpm lint` | B |
| base AC8/AC19/AC20-22 and Intake package gates | frozen and Intake surfaces stay green (regression block) | Fully-Automated | the plan's regression block (below) | A (green baseline recorded at A4) |

Gate commands EXECUTE and EVL run, verbatim (repo root; one token per call; no `--` token):

```
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction
pnpm --filter @aduin/scripts fixtures:build
pnpm --filter @aduin/scripts fixtures:check
for t in variance-rules-config-schema-and-provenance variance-classification-contract variance-seeded-recall-matrix variance-precision-measure variance-golden-05-06 variance-impact-from-graph-fixtures variance-impact-demo-4-2 variance-routing-table-matrix variance-demo-count variance-package-01-northgate variance-finding-adapter-contract variance-regression-scope-exists variance-ai-never-gates-core variance-gate-state-matrix variance-question-key-matrix variance-sheet-owner-and-template variance-determinism-repeat-run variance-no-llm-full-run; do pnpm --filter @aduin/core test "$t" || exit 1; done
for t in diff-contract diff-determinism diff-pairs diff-perf gate-state-matrix sheet-contents contracts golden-05-06-drift sibling-clause-common-vs-differing security package-gate-policy-matrix package-baseline-eligibility; do pnpm --filter @aduin/core test "$t" || exit 1; done
pnpm --filter @aduin/core test:golden
pnpm --filter @aduin/core test:corpus
pnpm --filter @aduin/core typecheck
pnpm --filter @aduin/scripts record:author --check
pnpm lint
pnpm typecheck
```

(`record:author --check` is the plan's own regression line; its `--check` is the script's flag, not a test-selection token. Run `fixtures:check` a second time after `fixtures:build` and confirm no diff.)

Legacy line form (retained for existing consumers):
- core/variance: [Fully-automated: `pnpm --filter @aduin/core test <each variance-* token above>` exit 0] | [hybrid: `variance-ai-never-gates-core` + recorded AI findings array] | [agent-probe: none in V1] | [known-gap: impact precision on real documents, named residual with backlog stub, documented below]
- core/counsel: [Fully-automated: `variance-gate-state-matrix`, `gate-state-matrix`, `sheet-contents`, `variance-question-key-matrix`, `variance-sheet-owner-and-template`] | [known-gap: web pill rendering belongs to V2]
- scripts/fixtures: [Fully-automated: `fixtures:build` then `fixtures:check` twice, `pnpm lint`]

Failing stubs (TDD red-first, one per Fully-Automated row; copy each into its named file; Hybrid, Agent-Probe and residual rows get none):

```
variance-rules-config-schema-and-provenance: test("should validate the versioned rules config, fail fast on invalid config and record the hash in provenance", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: rules config schema and provenance") })
variance-classification-contract: test("should give every raw change exactly one class with old/new passage and rule id", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: classification contract") })
variance-seeded-recall-matrix: test("should show every seeded new and logic change and classify none as cosmetic", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: seeded recall matrix") })
variance-precision-measure: test("should show cosmetic as logic for at most 10% of logic rows", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: precision measure") })
variance-golden-05-06: test("should classify Units to Shares cosmetic, class fees logic and Appendix C removed as shown on pair 5 to 6", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: golden 05-06") })
variance-impact-from-graph-fixtures: test("should compute affected investor types and conditional paths from the logic graph", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: impact from graph fixtures") })
variance-impact-demo-4-2: test("should report entities affected, US entities lose the beneficial-owner question and old rule not reusable for 4.2", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: impact demo 4.2") })
variance-routing-table-matrix: test("should route the 7 demo changes to the owners in the routing table", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: routing table matrix") })
variance-demo-count: test("should report raw 214, shown 7 (3 new, 4 logic) and 207 cosmetic in 5 groups on the demo pair", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: demo count") })
variance-package-01-northgate: test("should recall all 7 answer-key passages in non-cosmetic hunks of shown rows on the design Northgate pair and pin the measured counts", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: package 01 northgate") })
variance-finding-adapter-contract: test("should build change findings with scalar-only facts that parse with FindingSchema and round-trip through varianceMetaOf", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: finding adapter contract") })
variance-regression-scope-exists: test("should raise a critical regression finding when Appendix C is missing and none when present", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: regression scope_exists") })
variance-gate-state-matrix: test("should equal the legacy gate with policy undefined and count untriaged changes, regression and asked-unanswered with policy on", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: variance gate state matrix") })
variance-question-key-matrix: test("should key change questions as findingId@owner and keep the plain id for error findings", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: question key matrix") })
variance-sheet-owner-and-template: test("should filter the counsel sheet per owner and draft a masked version_drift question with old text, new text and A/B/C", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: sheet owner filter and template draft") })
variance-determinism-repeat-run: test("should produce byte-equal output across 3 repeated runs", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: determinism repeat run") })
variance-no-llm-full-run: test("should run end to end with no network and no transport", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: no-LLM full run") })
```

Dimension findings:
- Infra fit: PASS - every path, export and line number the plan cites resolves in the landed code today (barrel star export at `index.ts:172`, `computeGate` at `gate.ts:43`, `check.ts` insertion point after line 167, `build-seeded.ts` `buildFixtures` at 1037, `package-fixtures.ts` `load`/`graphOf` helpers, `findingId`/`quoteHash`/`makeAnchor`/`mask`/`sensitiveSpans`/`maxSeverityFor`/`typesIn`/`investorModelOf`/`runDeterministic`); `fixtures/variance` does not exist (clean create); `.prettierignore` lacks the append (a V1 step). No Intake assumption is left for P01.
- Test coverage: PASS - 18 named core gates plus the scripts gate and the regression block map to AC-V2/4/5/6/7/9/10/11/12/16/17/19/20; every token resolves to a real or to-be-created file and an unmatched token exits 1 (non-vacuous); the gate matrix size is now stated correctly (2400 cells, 2406 tests); package-01 gate restructured so it can exit 0 and still report key divergence honestly (C1). The 214/7/207 arithmetic is consistent (118+41+8+29+11 = 207; 207+7 = 214; 3 new + 4 logic = 7) PROVIDED each demo item yields exactly one raw change (E12).
- Breaking changes: PASS - all edits additive (optional 4th `computeGate` parameter with the `ComputeGate` type edited in the same step, optional `gates`/`owner`/`ownerAnswers`/`meta.owner`); frozen v1 `Finding`, the 15 issue classes and the contracts snapshot untouched; `version_drift` is a declared class and `maxSeverityFor` handles rule findings; explicit named barrel list (never `export *`) cannot collide with Intake's star export.
- Security surface: PASS - no auth, billing, network, secret, schema or deploy surface; masking via existing `mask`/`sensitiveSpans`; config regexes compiled and length-capped at load; template drafts masked; the design DOCX are read-only committed copies guarded by Intake's `checksums.json`.
- Section A feasibility: PASS - A1 satisfied (`buildUnits`, `alignUnits`, `Unit`, `Alignment`, `tokenize` exported; `scopeLabel` imported by relative path from `diff/normalize-key.ts`, no barrel edit), A2/A3 verified at plan time, A4 is an EXECUTE-time baseline.
- Section B feasibility: PASS - `@noble/hashes` and zod `.strict()` precedents; regex compile and cap at load.
- Section C feasibility: PASS - jsdiff v9 and `tokenize` exist; `merge_gap_tokens` pinned and tested at gaps 0, 1, 2; `truncated` coarse hunk path defined. Raw-count rule (DECISION D1: a wholly added unit counts 1 raw change PER BLOCK) interacts with the 214 pin: see E12.
- Section D feasibility: PASS - ordering and precedence over DECISION D1 are written in the plan; cover/header = `Unit.kind 'scope'` confirmed in code. Highest-risk edit: `classify.ts` ordering and the digit-guard exemption.
- Section E feasibility: PASS - `investorModelOf`, `typesIn` exist; the 4.2 insertion is 7 words (below `new_min_words` 12). Highest-risk edit: `audience.ts` restriction extractor (pinned by `variance-impact-demo-4-2`).
- Section F feasibility: PASS - scalar-only facts schema verified; `detail_json` never persisted by the Worker; `normalizeAssertionLabel` in `variance/label.ts`; `runVariance` has no `checks` input. Highest-risk edit: `adapter.ts` (no `buildFinding` for a removed unit).
- Section G feasibility: PASS - `gates?`, `ownerAnswers?`, `owner?` semantics defined; `variance-sheet-owner-and-template` present; `computeGate` is a `ComputeGate`-typed const so the optional 4th parameter is additive.
- Section H feasibility: PASS after inline fixes - C4 (`check.ts` precedent is `walkStray` against `fresh`, not `walkPkg`), C5/E12 (one-block 7A), C1/C3 (H4 rewrite and loader pointer). Highest-risk edit: H4 pins (see C1) and the lazy `html`/`json` import (circular with `build-seeded.ts`).
- Section I feasibility: PASS - determinism and no-LLM gates are straightforward; regression tokens exist (including Intake's `package-gate-policy-matrix`, `package-baseline-eligibility`).

Concerns found this pass (all closed inline in the plan; no residual):
- C1 H4 (`variance-package-01-northgate`): the a-priori pin "shown = 7 with 3 new + 4 changed_logic" cannot be met by the landed engine design. Evidence: `headings.ts` SECTION_RE gives top-level units only; per-paragraph diff of the two design DOCX shows the key items share units (V2 Singapore row and V4 4.2 both in Section 4; V6 tax status and V7 trust rows both in Section 6; V3 10.4 is an insertion inside Section 10; V5 in Section 1); D3 clusters per unit, so about 5 rows, not 7; and the key's "cosmetic" address (Suite 1200 to 1400) and first-closing date changes are digit changes in operative text, which the D1/G2 guard classifies logic, adding rows. With "every command exits 0" in the Exit Gate this would stall EXECUTE or tempt a silent loosening. Fix applied: H4 rewritten to assert recall 7 of 7 (each key passage in a non-cosmetic hunk of a shown row), one class per change, and MEASURED-then-pinned counts; key-vs-engine divergence is recorded in the report (and a backlog note), not asserted. AC-V4 row, D-S0-5 sentence and the Test Coverage row aligned.
- C2 Gate matrix wording: "2406 cells" is the test count of `gate-state-matrix.test.ts` (2400 cells + 6 named cases; the file pins `4*5*2*5*4*3`). Plan text corrected to "2400 matrix cells (2406 tests)". EVL must compare byte-equality on the 2400 cells and record the 2406 test total, never assert a 2406-cell count.
- C3 H4 loader pointer: the plan said the `@aduin/core/docx` subpath "as `ingest-all-formats-docx` does"; that test imports `../../src/adapters/docx` and the Intake helper `test/helpers/package-fixtures.ts` already provides `load(rel)`, `graphOf(loaded)` and DOCX support. H4 now names the helpers.
- C4 `check.ts` precedent: plan said "reuse its `walkPkg` pattern"; `walkPkg` is bound to `freshPkg` and real-facts shape logic. The right precedent is `walkStray(DIFF_DIR)` (lines 40-49) against the `fresh` map. Touchpoints and H2 corrected; insertion after line 167.
- C5 Raw-count arithmetic for a whole new section: DECISION D1 counts a wholly added unit as 1 raw change PER BLOCK, so a multi-block "7A" would give raw 215+, not 214. H2 and E12 now require each of the 7 demo items to contribute exactly one raw change (7A authored so its added unit has exactly one block, or STOP and request a PLAN-SUPPLEMENT; never move the pin silently).

Open gaps:
- G7 closed: Intake interface, collision files and `samples/packages/` assumptions are all observed in code and recorded in the plan; no residual.
- G8 [known-gap: documented as NEW PLAN REQUIRED, residual D] impact precision on real documents is unproven; labelled "uncertain" in output; AC-V10 pinned by authored fixtures only. Backlog stub on disk: `variance-impact-real-sample-ground-truth_NOTE_17-10-26.md` in `process/features/variance-management/backlog/`.
- G9 [named residual D, written by EXECUTE only if it occurs] key-vs-engine divergence on the design pair (shown-row count, per-item class, V7 owner): `variance-package-01-key-divergence_NOTE_17-10-26.md` in `process/features/variance-management/backlog/`; AC-V4 corroboration is carried by recall 7 of 7, not by the key's 7 rows.
- Advisory for the orchestrator (not this plan's file): umbrella lines 237 (D-S0-5), 255 (AC-V4 row) and 415 (Verification Evidence row) still say package 01 gives "3 new + 4 logic"; align them with H4 in the next umbrella update. Phase 05 only reads packages as V5 inputs and is unaffected.
- Advisory: the Phase 03 Step 0 text expects `normalizeAssertionLabel` "in `variance/regression.ts`, for example"; Phase 01 puts it in `variance/label.ts` and exports it from the core barrel by the same name; P03 owner aligns the wording. The "plural normalizes identically" edge case means `Appendix C` vs `appendix c`/`APPENDIX  C` (case and whitespace), because `scopeLabel` does not match "Appendices".

What this coverage does NOT prove (What This Coverage Does NOT Prove):
- `variance-rules-config-schema-and-provenance`: not that the routing and cosmetic criteria are right for any firm other than the authored ones.
- `variance-classification-contract`: not that the class is the meaningful one on unseen real documents (only that exactly one class and evidence exist, plus the named edge cases).
- `variance-seeded-recall-matrix`: not recall on documents outside the authored corpus.
- `variance-precision-measure`: not precision on other firms; the 10% bound is measured on the seeded corpus plus pair #5/#6 only.
- `variance-golden-05-06`: not AI narrative wording (not used), not other real pairs, and (until run) not that Intake's heading and conditional edits left the unit keys of #5/#6 unchanged (E13).
- `variance-impact-from-graph-fixtures`, `variance-impact-demo-4-2`: not impact precision on real documents (G8), and not the web display.
- `variance-routing-table-matrix`: not that an analyst override is saved (V3/V4).
- `variance-demo-count`: not the browser view of 214 to 7 (V5 e2e), not that the count survives a changed tokenizer pin, and not the design packages.
- `variance-package-01-northgate`: not that the engine reproduces the answer key's 7 shown rows or its 3 + 4 split (top-level-section units merge items; operative digit changes are logic), not the cosmetic group count, not the V7 owner (key Counsel, SPEC A9 GP: note only), not other firms; it does prove recall of all 7 key passages on a real DOCX pair, one class per change, and determinism.
- `variance-finding-adapter-contract`: not that the D1 wire accepts the finding (V3 `variance-finding-wire-size`).
- `variance-regression-scope-exists`: not cross-firm isolation of the stored check (V3 server test) and not other assertion kinds.
- `variance-ai-never-gates-core`: not the browser flow (V2 e2e) and not live model output.
- `variance-gate-state-matrix`, `gate-state-matrix`: not web pill rendering, the merged package-gate render in `GateButton.tsx`, or the "Checking changes" pending display (V2).
- `variance-question-key-matrix`: not the Questions screen grouping or per-owner export (V4).
- `variance-sheet-owner-and-template`: not the web per-owner DOCX export (V4) and not counsel-facing wording quality (human review).
- `variance-determinism-repeat-run`, `variance-no-llm-full-run`: not determinism across Node versions or machines.
- `fixtures:build` and `fixtures:check`: not that the demo looks realistic to a human (V5 agent probe).
- regression block: proves Intake's package gates and the frozen diff, gate and sheet surfaces stay green; not browser behavior (no Playwright in V1).

Plan updates applied (inner PVL, 5 inline edits; no scope, file or checklist-letter change):
- P1 H4 rewritten (recall 7 of 7 asserted; counts measured then pinned; key divergence recorded, not asserted; helper loader named); AC-V4 row, D-S0-5 sentence and Test Coverage Plan row aligned (C1, C3).
- P2 "2406 cells" corrected to "2400 matrix cells (2406 tests)" in Step 0, Public Contracts and edge case 4 (C2).
- P3 `check.ts` precedent corrected to `walkStray` against `fresh` in Touchpoints and H2 (C4).
- P4 H2 gains the one-raw-change-per-demo-item authoring constraint (C5).
- P5 Resume and Execution Handoff status lines updated to the inner-pvl contract.

Execute-agent instructions (binding):
- E1 (F1/F2): detail facts are scalars only; `varianceMetaOf` is the ONLY decoder (`owners: Owner[]`, `assertion_candidate?: {kind, label}` rebuilt from `assertion_kind`/`assertion_label`); V2 and V4 never read raw `detail.facts`. Build with `findingId`, `quoteHash`, `makeAnchor`, `mask`/`sensitiveSpans`, `FindingSchema.parse`; never `buildFinding` for a removed unit.
- E2 (D1): this plan governs over DECISION D1 text on the digit-guard exemption and the cluster class. Renumber (mapped target) and cover date are evaluated by their rule before the digit guard; every other guard still wins.
- E3 (D3/H2): cluster class `new` when the unit was added OR every non-cosmetic hunk is a step-1 `new` insertion; mixed cluster = `changed_logic`. The 7 demo items sit in separate alignment units and each is exactly ONE non-cosmetic hunk (214 minus 207 = 7); `expected/*.json` hand-authored with the item to class to rule id to owners table, asserted in `variance-demo-count`. Authored cosmetic hunks (format, name, rename, renumber, date) must be separated from any logic edit by more than `merge_gap_tokens` so they cannot merge into a guarded hunk.
- E4 (G1): define `GateFinding.gates?` and `GateState.ownerAnswers?` semantics in code and `variance-gate-state-matrix` before use; run `variance-sheet-owner-and-template`.
- E5 (H): append `fixtures/variance/` to `.prettierignore` (one line; list it in the report as a V1 touchpoint); use `html`/`json` only inside functions in `build-variance.ts` (or move helpers); expectations never computed from the engine; add the variance stray scan to `check.ts` with the `walkStray` pattern after line 167 and before the final `if (problems.length)` block.
- E6 (H1): named export list only, never `export *`; edit `ComputeGate` in `counsel/types.ts` with `computeGate`; re-grep every planned export name at EXECUTE entry.
- E7 (B): compile and length-cap config regexes at load; linear-time patterns only.
- E8 (Step 0 / Entry Gate): `git status` clean in the blast radius (untracked `.DS_Store` and `.playwright-mcp/` are not Variance's: never touch or commit them), record HEAD; never git stash, checkout, reset, restore or push; commit locally on main with conventional prefixes.
- E9 (A1): `scopeLabel` is imported by relative path from `diff/normalize-key.ts`; only if another needed symbol is missing add ONE export line to `diff/index.ts` and note it; never change `diff-contract`, `diff-determinism`, `DiffResult` or segments.
- E10 (EVL): `variance-gate-state-matrix` and `gate-state-matrix` both match the substring `gate-state-matrix`; run both; compare 2400 matrix cells and record the file's 2406 test total (never assert 2406 cells); re-run `diff-determinism`, `diff-perf` and `size-cap` in isolation before treating a timeout as a failure.
- E11 (G2/regression): `runVariance` never runs regression checks; the regression finding comes only from `runRegressionChecks`.
- E12 (H2/C2): each of the 7 demo items contributes exactly ONE raw change. A wholly added unit counts 1 raw change PER BLOCK (DECISION D1), so author 7A so that its added unit has exactly one block (heading-only unit is acceptable for the pin) and the Singapore and 8(f) items as one contiguous insertion inside existing units. If the structurer cannot produce a one-block added unit, STOP, record the measured count and request a PLAN-SUPPLEMENT; never move 214/7/207 silently.
- E13 (D4/regression): first run `golden-05-06-drift` and read the `variance-golden-05-06` unit keys against Intake's heading and conditional edits (`structure/headings.ts`, `structure/conditionals.ts`) BEFORE pinning the renumber and cover/header cases; if a unit key moved, fix the expected value from the measured key and record it in the report; never bend a rule.
- E14 (H4): read the answer key (`samples/packages/01-northgate-infrastructure-iii/answer-key.md`, section B) only to author the expected passage table; load the DOCX through `load`/`graphOf` from `packages/core/test/helpers/package-fixtures.ts` from `fixtures/package/design/northgate-iii/`; assert recall 7 of 7 plus measured pins; record the key-vs-engine table (shown rows, per-item class, V7 owner) in the phase report and write the backlog note when any row differs; if any key passage is NOT recalled in a non-cosmetic hunk of a shown row, that is a real defect: stop and route to RESEARCH, never loosen.

High-risk pack: no (risk class medium: additive core types only; no auth, billing, schema or migration, API contract, deploy or secret surface).

Backlog artifacts:
- `process/features/variance-management/backlog/variance-impact-real-sample-ground-truth_NOTE_17-10-26.md` - on disk (G8, residual D, keep-active).
- `process/features/variance-management/backlog/variance-package-01-key-divergence_NOTE_17-10-26.md` - to be written by EXECUTE only if a key-vs-engine row differs (G9).

Known gaps on record:
- G8 impact on real documents - named residual D with backlog stub; AC-V10 proof is the authored fixtures only.
- G9 package-01 key divergence - named residual D, conditional on EXECUTE measurement; the proving behavior (recall 7 of 7, one class per change, determinism) has a Fully-Automated gate, so the net gate is not vacuous.

Net-gate check (vacuous-green ban): every developed V1 behavior has a Fully-Automated or Hybrid gate, including the per-owner sheet filter and `version_drift` template (`variance-sheet-owner-and-template`) and the real-DOCX corroboration (`variance-package-01-northgate`); the only Known-Gap is real-document impact precision (and the conditional key divergence), named, justified residuals with backlog stubs, never the silent reason a behavior passes. Gate is PASS because zero unresolved CONCERNs and zero FAILs remain after the inline fixes.

Autonomous goal block: BRANCH B - the umbrella plan `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md` carries a Stable Program Goal section on disk (verified), so no goal-block section is written to this phase plan; reference for latest state: that umbrella path.

Gate: PASS
Accepted by: not required (Gate PASS, no unresolved CONCERNs); known-gaps G8 and G9 recorded above as named residuals.

Amendment 17-10-26 (user decision): no git push in any phase; commit locally only; the user pushes. Wording-only tightening, no gate change.
