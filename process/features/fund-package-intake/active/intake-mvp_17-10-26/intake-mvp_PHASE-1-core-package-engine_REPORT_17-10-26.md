---
phase: phase-1-core-package-engine
date: 2026-10-17
status: COMPLETE_WITH_GAPS
feature: fund-package-intake
plan: process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-1-core-package-engine_PLAN_17-10-26.md
---

# Phase 1 — Core package engine: EXECUTE report

**TL;DR:** The intake brain ships as pure code in `packages/core/src/package/` (14 files), with the T14 heading and Annex/Question fixes, all fixtures and 26 one-token gates green. Core 3076 tests pass (was 2914), scripts 156. The 12-sample corpus has zero finding changes. EVL (independent vc-tester run) is next.

## Entry state

- `P1_BASE` = `1f1796770b01d1c9ebef53d60c466e6a94173ea6` (descends from `0a67dc4`; `git merge-base --is-ancestor` held). Rollback target live version `47d98295-c583-4dc0-9f96-f9e161c8cf35`.
- Tree at start: only untracked `.DS_Store`. Baselines re-measured: core 2914 tests green, typecheck green, `golden-11-undefined-units` 5.
- Re-read before B0: `detectors/util.ts` (`refRoutingContext`, `refSeverity`), `ref-label-coherence.ts`, `ref-this-section.ts`, goldens 01 and 03-05. No B0 edit touches them.
- Design packages committed (c1c5fe0); all three answer keys read; copies live under `fixtures/package/design/**`.

## Commits (main, not pushed)

| sha | message |
|---|---|
| f3928b6 | test: pin undefined-term baseline before intake |
| 28fe3d4 | feat: structurer accepts Section and Article headings; broken-conditional resolves Annex and Question targets |
| ff17999 | feat(core): fund package module with fixtures and goldens |
| eb5f5b5 | test: package fixtures drift gate |

## Premise Check

Measured at `P1_BASE` (pinned in `package-undefined-term-baseline`, 13 tests):

| Sample | `undefined-term` | `defined_term_issue` by detector |
|---|---|---|
| #1, #3, #5, #6, #8, #13 | none | none |
| #2 | none | defined-term-issues 5 |
| #4 | none | defined-term-issues 2 |
| #7 | none | defined-term-issues 3 |
| #10 | none | defined-term-issues 5 |
| #11 | Units | undefined-term 1 |
| #12 | none | defined-term-issues 1 |

Premise confirmed: `undefined-term` fires only on #11. No RESCOPE NOTE.

## T14 Corpus Regression

Before/after on the same engine (12 HTML samples plus the 18 design DOCX files).

| Golden / pinned count | Old | New | Reason |
|---|---|---|---|
| 12 HTML samples: finding ids, severities, counts | as P1_BASE | identical | the corpus has 0 keyword-led heading lines; no golden or pinned test literal changed (full suite green with no edit to an existing test) |
| #12 conditionals (not pinned before) | 0 | 1 | "complete ... Annex D" is now a conditional; Annex D exists (`Annex D:` block), so it stays silent |
| NG3 sub agreement findings (answer key "6") | 6 | 7 | D6 `complete Annex F` is now a critical `broken-conditional` (should-catch) |
| NG2 baseline findings (row NG2-annexF) | 5 | 6 | same Annex F instruction (same template) |
| RR1 agreement findings | 4 | 5 | F1 `skip to Question 15` with 14 questions (should-catch); sections 0 -> 13 |
| LB2 v2 sections / findings | 0 / 7 | 15 / 7 | `Section N.` headings now found; no new finding (Annex C mentions are not conditional targets) |
| NG3 LPA sections | 0 | 10 | Article I..X recognized (plan text said 9; the file has 10 Articles, I to X) |
| RR1 LPA sections / findings | 0 / 14 | 1 / 14 | Article I recognized; `Section 4.6` style cross-references did not become broken references |
| Harbourline W-8 guide | 0 sections | 9 sections, 1 conditional, 0 findings | "Annex B" target with no annex labels stays uncertain |
| Other design files (PPM summaries, KYC, side letter) | 0 sections | 5 to 16 sections | headings recognized, 0 new findings |

Stop rule: no sample gained more than 1 finding; no noise finding. Investor-path and unreachable-flow outputs did not change on any file (the RR1 benefit-plan route is caught by `broken-conditional`, not as an `investor_path_dead_end`; recorded as gap).

## What Was Done

- **Step A** premise baseline test and commit.
- **Step B0** `headings.ts`: `KEYWORD_SECTION_RE` (exported), `romanToInt`, `keywordSectionCandidate` (keyword + number grammar + bounded title, no bold/caps needed; roman only for Article; `number` is the arabic string). `conditionals.ts`: `TARGET_RE`/`MORE_TARGETS_RE` gain `Annex` and `Question` heads. `flow.ts`: typed `annex`/`question` targets, shared exported helpers `annexLabels`, `enclosingAnnex`, `questionNumbers`, label regexes; Annex/Question branches run before the bare-Part branch; uncertain never yields a finding. `structurer.ts` and `broken-conditional.ts` were NOT edited (not needed).
- **Steps B-E** `src/package/{types,config,policy,detect,facts,definitions,references,terms,resolve,coverage,request,baseline,analyze,index}.ts` plus `quote.ts`; one appended barrel block in `src/index.ts`. Typecheck shows no export collision; `DocFormat` is unchanged (type-level assertion in `package-types-contract`).
- **Step F** `scripts/src/fixtures/make-package.ts` (`package:fixtures`), `package-facts-extract.ts` (`package:facts-extract`, ran once: all 4 real-facts files written, local files present), drift gate in `check.ts` (verified it reports drift and stray files), 2 script keys. Fixtures: Hartwell (3 files), 18 design copies + checksums, `expected.json`, `schema.v1.json`, `demo-packages.json` (`primaryDemoId: northgate-iii`), 4 real-facts.
- **Step G** all named tests written (list below).

Mid-implementation progress note: at about 50% (after B0 and the module), 13/26 checklist groups were done with no hard-stop deviation; tuning then focused on detection data and used-term precision.

## Test Gate Outcomes

One token per call, no `--`, each > 0 tests:

| Gate | Tests |
|---|---|
| package-undefined-term-baseline | 13 |
| package-types-contract | 4 |
| package-limits | 6 |
| package-detect | 26 |
| package-type-detection-golden | 12 |
| package-suggester-seam | 7 |
| package-reference-extraction-golden | 7 |
| package-reference-recall-matrix | 6 |
| package-reference-resolution-matrix | 11 |
| package-quote-verbatim-contract | 2 (300 + 100 fast-check runs) |
| package-crossdoc-terms-golden | 7 |
| golden-11-undefined-units | 5 |
| package-coverage-matrix | 7 |
| package-gate-policy-matrix | 8 |
| gate-state-matrix | 2406 |
| package-request | 6 |
| package-baseline-eligibility | 5 |
| package-determinism | 3 |
| package-readiness | 4 |
| package-facts | 5 |
| package-scan-bounded | 6 |
| determinism | 23 |
| structure-heading-forms | 8 |
| broken-conditional-annex-question | 6 |
| package-design-goldens | 3 |
| contracts | 34 |
| redos | 5 |
| scripts: package-fixtures | 4 |

Regression: `pnpm --filter @aduin/core test` 98 files, 3076 passed, 3 skipped (the opt-in `package-realfacts-local`); `pnpm --filter @aduin/scripts test` 17 files, 156 passed; `pnpm --filter @aduin/scripts fixtures:check` OK; `pnpm typecheck`, `pnpm lint`, `pnpm guard:cf`, `pnpm secrets:scan` all exit 0.

Diff gates: `git diff --quiet P1_BASE -- packages/core/test/__snapshots__ packages/core/src/contracts` exit 0. `git diff --name-only P1_BASE HEAD -- packages/core/src` = `detectors/flow.ts`, `structure/conditionals.ts`, `structure/headings.ts`, `index.ts`, `package/**` only. `git diff --name-only P1_BASE HEAD -- apps` is empty. Note: the working tree shows 3 modified `apps/worker/**` files that are another session's uncommitted edits (not mine, left alone), so `git diff --quiet P1_BASE -- apps` against the working tree exits 1; against HEAD it is clean.

Red-first: G22/G23 import names that do not exist at `P1_BASE` (`KEYWORD_SECTION_RE`, `annexLabels`, typed targets), so they cannot pass there; I wrote them right after the code edit rather than running a literal red run first (recorded as a process deviation).

## AC coverage

| AC | Proven by | Status |
|---|---|---|
| AC-I4 | package-detect | green |
| AC-I5 | package-type-detection-golden (Hartwell, 3 design packages, NGI #5/#6, 4 real facts) | green; every demo file typed correctly, no wrong high value |
| AC-I6 core | package-readiness | green |
| AC-I7 | package-suggester-seam | green (seam only; 0 live calls) |
| AC-I9 pure | package-baseline-eligibility | green |
| AC-I10 | package-reference-extraction-golden | green |
| AC-I11 | package-reference-recall-matrix | green (NGI #5/#6 100% of the three nouns) |
| AC-I12 | package-reference-resolution-matrix | green |
| AC-I13 | package-quote-verbatim-contract | green |
| AC-I14/15/16 core | package-crossdoc-terms-golden + golden-11 | green |
| AC-I17 | package-coverage-matrix | green |
| AC-I19 | package-gate-policy-matrix + gate-state-matrix | green |
| AC-I20 core | package-request | green |
| AC8 | package-determinism + determinism | green |
| AC-S1 | structure-heading-forms | green |
| AC-S2 | broken-conditional-annex-question | green |
| AC-S3, AC-S4 | package-design-goldens + full suite | green |
| AC-I5 local | package-realfacts-local (Hybrid, `PACKAGE_LOCAL=1`) | not run in CI by design |

## Plan Deviations

All within the blast radius; no hard-stop class.

1. Added `packages/core/src/package/quote.ts` (shared verbatim-quote helper) and `packages/core/test/helpers/package-fixtures.ts` (shared test loader, the plan's own "Test Infra Improvement" candidate). Both inside the planned folders.
2. `DETECT_RULES` has an `other` row (email, investor questionnaire, AML/KYC checklist) and title points only on the document title line (first short, non-sentence line that holds any rule phrase). Needed so GP emails and KYC checklists are not typed as sub agreements or tax forms (T1). Data, not a new code path.
3. `extractUsedTerms` counts determiner-led uses ("the Capital Commitment") and drops terms the document also writes in lower case or that end in a document word (Agreement, Memorandum, Letter, Act, Form). Narrower than "capitalized mid-sentence"; it removed most proper-noun noise.
4. Unquoted `X means` definitions are read at block start only (linear and bounded).
5. Coverage: `needs OCR` on any member makes `external_refs` partial (redwood-ridge scanned guide path).
6. Text fixtures are passed through the repo prettier config inside `make-package.ts` (repo lint checks `fixtures/`).
7. Plan said NG3 LPA has 9 Articles; measured 10 (I-X). Pinned 10.
8. `fixtures/package/**` landed in the core commit (tests depend on it); the scripts commit holds the generator and drift gate.
9. E8 optional redos import not added; G22 has its own hostile-input bound and the new `flow.ts`/`conditionals.ts` regexes are auto-collected by redos (5 green).

## Test Infra Gaps Found

- None blocking. The opt-in `package-realfacts-local` stays Hybrid.

## Known gaps (backlog stubs to register in UPDATE PROCESS)

- `intake-llm-doc-type-suggest`: seam only, no task.
- `intake-annex-question-forms`: Schedule/Exhibit targets, per-Part question numbering, dash or next-line heading titles; RR1 F1 also as `investor_path_dead_end` is not produced; F3 `Section 8.4` coherence stays silent (measured).
- Reference families: "US Feeder Subscription Agreement" (LB2 third request item), "Eligible Transferee Certificate" (NG3 D7) and "Tax Form Selection Guide" are not extracted.
- Used-term recall: LB2 E1 `Excused Investor`, `Key Person Event` and RR1 F4 `Plan Assets`, `Significant Participation`, `Hurdle Amount` are not listed (fewer than two determiner-led uses). Some proper nouns (Delaware, United Kingdom, Internal Revenue Service) still appear as unverified terms.
- `intake-local-real-facts`: not needed (all local files present).
- Hand-off to Phase 3c: `DocumentRequest.quote` is stored UNMASKED; the request DOCX and every render must route quotes through core `maskAndClamp` / `maskQuote`.
- Web specs that pin per-sample counts: none affected (corpus unchanged).

CONTEXT_PARTIAL: none.

## Closeout Packet

- Selected plan: `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-1-core-package-engine_PLAN_17-10-26.md`
- Finished: Steps A, B0, B-H.
- Verified: every Fully-Automated gate by the execute agent (unconfirmed until EVL).
- Unverified: Hybrid local-facts check (opt-in); independent EVL run.
- Cleanup: register the backlog stubs above; registry status `DONE` after EVL green; engine context doc update (UPDATE PROCESS).
- Classification: Keep in active/testing (EVL next).

## Forward Preview

### Test Infra Found
- `packages/core/test/helpers/package-fixtures.ts`: `load`, `factsOf`, `docOf`, `runPackage` (full pipeline), `expectedJson`, `rolesOf`.

### Blast Radius Changes
- New exported core names: everything in `src/package/index.ts`; `KEYWORD_SECTION_RE`, `keywordSectionCandidate`, `romanToInt` (headings), `annexLabels`, `enclosingAnnex`, `questionNumbers`, `ANNEX_*`/`QUESTION_*` regexes (flow). `ParsedTarget` gains optional `annex`/`question`.

### Commands to Stay Green
- `pnpm --filter @aduin/core test <token>` for each token above; `pnpm --filter @aduin/scripts fixtures:check`; after any design-package change run `pnpm --filter @aduin/scripts package:fixtures`.

### Dependency Changes
- None (scripts import `prettier`, already a root devDependency).
