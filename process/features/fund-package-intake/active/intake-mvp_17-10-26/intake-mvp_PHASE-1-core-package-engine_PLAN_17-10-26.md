---
name: plan:intake-mvp-phase-1-core-package-engine
description: "Fund package intake — Phase 1: pure core package module in packages/core/src/package (type/role detection, references, cross-document terms, coverage, gate policy, document requests, baseline eligibility), synthetic and real-fact fixtures, goldens and property tests"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: fund-package-intake
  phase: phase-1
---

# Phase 1 — Core package engine and fixtures

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED (outer PVL next)
**Program:** intake-mvp (fund-package-intake, U1-U9, AC-I1..AC-I20)
**Umbrella plan:** process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-1-core-package-engine_REPORT_17-10-26.md (flat in the program task folder)
**Locked inputs:** `intake-mvp_SPEC_17-10-26.md`, `intake-mvp_INNOVATE_17-10-26.md` (Decision Summary plus ORCHESTRATOR RULINGS T1-T4; LOCKED). Context routers read for this plan: `process/context/all-context.md`, `process/context/engine/all-engine.md`, `process/context/tests/all-tests.md`, `process/context/worker/all-worker.md`, `process/context/product-domain.md`.

---

## Overview

Phase 1 builds the whole intake brain as pure, deterministic TypeScript in `packages/core/src/package/` (new folder; the frozen v1 contracts, the 13 detectors, `computeGate` and its matrix are NOT edited). It contains: document type and role detection with confidence and a fixed reason; a lightweight "package facts" reader (title lines, headings, definitions) used for reference documents; external-reference extraction with verbatim, location-bearing quotes; reference resolution against package files with a synonym table; cross-document defined-term logic (definitions from reference documents, suppression of the offering-noun `undefined-term` finding when the package defines the term, an "unverified" list otherwise); coverage per check group as data; gate policy for missing documents as data (`DEFAULT_PACKAGE_POLICY`, `packageGateReasons`); the deduplicated GP document request list; and same-firm baseline eligibility (`eligibleBaselines`).

Phase 1 also produces every fixture the later phases consume: a synthetic Hartwell and Crane package (Fund III subscription agreement, Northgate LPA definitions excerpt as DOCX, Fund II prior subscription agreement), authored expectations, the `PackageAnalysis` schema snapshot, a demo-package manifest, and short committed "real facts" for the local-only real documents so goldens run in CI without them.

Why first: Phases 2 and 3 only wire this module into the browser worker, the store and the screens. No UI, no worker, no Dexie in this phase.

**Premise check first (INNOVATE finding 1):** the `undefined-term` detector only fires on offering nouns (Units, Interests, Stock). The SPEC premise "dozens of false undefined-term errors" is therefore re-scoped to: LISTING ("defined in LPA" / "unverified"), coverage counts, and suppression of the offering-noun finding when the package defines it. Step A baselines the existing goldens before anything is built so this is measured, not assumed.

## Phase Completion Rules

- `CODE DONE` = all checklist steps checked. `TESTING` = per-step gates green. `VERIFIED` only with: every Section 4 gate green in an independent serial EVL (vc-tester), the contract-untouched gates green, a written validate-contract, the phase report written, and user-visible confirmation language ("user confirmed") only where the user actually confirmed. Code-only completion is never VERIFIED.
- Known-Gap is never a terminal pass for developed behavior (vacuous-green ban). Any Known-Gap needs a backlog stub and keeps that gate CONDITIONAL.
- The three opt-in local-only checks (`package-realfacts-local`, `package:facts-extract`) are Hybrid and never gate CI; the committed real-facts fixtures are what CI proves.

## Acceptance Criteria

Each criterion names its proving scenario (`proven by:`) and strategy (`strategy:` Fully-Automated | Hybrid | Agent-Probe). Gates in section "Verification Evidence" back-reference these ids.

| ID | Criterion (core half owned by Phase 1) | proven by | strategy |
|---|---|---|---|
| AC-I4 | Every file gets type, role, confidence and a stated fixed-template reason from file name, first-page title and known phrases | `package-detect` unit (one row per fixture file; reason present, from templates) | Fully-Automated |
| AC-I5 | Detection is correct on the demo set (T1 ruling: type correct on every demo file; no wrong high-confidence type or role; two-subscription-agreement roles flagged low) | `package-type-detection-golden` (expected matrix in `fixtures/package/expected.json`, committed real facts, no LLM) | Fully-Automated |
| AC-I7 | LLM is a seam only: precedence confirmed analyst > high rule > low rule > AI suggestion; a fake suggester never overrides a confirmed value; detection completes with no suggester (T2 ruling, 0 live calls) | `package-suggester-seam` unit with injected fake suggester | Fully-Automated |
| AC-I9 (pure half) | `eligibleBaselines` returns same-firm candidates only; null-firm packages see within-package candidates only; identical text under two firms never crosses | `package-baseline-eligibility` unit | Fully-Automated |
| AC-I10 | References such as "as defined in the Partnership Agreement", "see Annex F", "Form W-8BEN-E", "the Side Letter" are found with verbatim quote and location | `package-reference-extraction-golden` (pattern matrix on the synthetic package and NGI #5/#6) | Fully-Automated |
| AC-I11 | Recall on seeded references is 100% (synthetic package plus NGI #5/#6 "LLC Agreement", "Memorandum", "Prospectus") | `package-reference-recall-matrix` (authored expected list vs an independent noun-count ground truth with an explicit exclusion list) | Fully-Automated |
| AC-I12 | Every reference is resolved or `not_in_package`; synonyms (LP Agreement, Fund Agreement, Partnership Agreement all mean LPA); unclear shown for confirmation, never guessed | `package-reference-resolution-matrix` | Fully-Automated |
| AC-I13 | Every stored quote is a verbatim substring of its document block (≤240 chars); a failing quote is dropped and counted in `dropped` | `package-quote-verbatim-contract` (fast-check property) | Fully-Automated |
| AC-I14 (core half) | Terms defined in a present reference document are suppressed from the offering-noun finding and listed "defined in package" with the definition quote | `package-crossdoc-terms-golden` (synthetic) | Fully-Automated |
| AC-I15 (core half) | A term nobody defines stays a finding; base AC13 (#11 "Units") unchanged | `package-crossdoc-terms-golden` + `golden-11-undefined-units` | Fully-Automated |
| AC-I16 (core half) | Without an LPA, terms the sub agreement says are defined elsewhere are `unverified` (counted), not findings | `package-crossdoc-terms-golden` | Fully-Automated |
| AC-I17 (matrix) | Coverage per check group full / partial / blocked with missing types; fixed coverage line text | `package-coverage-matrix` | Fully-Automated |
| AC-I19 | Missing sub agreement blocks with a reason; missing LPA/PPM warns only; policy is data (a modified policy row changes the outcome) | `package-gate-policy-matrix` (extends the `gate-state-matrix` pattern; `computeGate` untouched) | Fully-Automated |
| AC-I20 (core half) | One request item per distinct missing target label, deduped (T3), quote kept | `package-request` unit | Fully-Automated |
| AC8 (re-run) | Same package, same config: byte-equal analysis; shuffled input order identical | `package-determinism` (run twice plus shuffled order) | Fully-Automated |

Non-criteria guarded here: frozen contracts v1 and the contracts snapshot stay byte-identical; `packages/core/src/detectors/**`, `packages/core/src/counsel/**`, `packages/core/src/contracts/**` untouched.

## Entry Gate

- Clean working tree for the blast radius; record `git rev-parse HEAD` as `P1_BASE` in the phase report (later phases diff against it). SUPERSEDED by the Step 0 re-sync below: `P1_BASE` is the literal 40-character sha recorded there, never the symbolic `HEAD`, and every `git diff --quiet P1_BASE` gate uses that literal.
- **Step 0 re-sync (BLOCKING; runs before Step A).** The parent orchestrator session owns uncommitted demo-readiness fixes in the shared checkout: core detectors `ref-label-coherence.ts`, `ref-this-section.ts`, `util.ts`, two core goldens (`golden-01-this-section-11`, `golden-03-05-swapped-part-b-refs`), web `GateButton.tsx`, `features/gate/gate-pill.ts` (new), `base.css`, `CompareScreen.tsx` and their e2e/unit specs (`gate-pill`, `filter-sort`, `diff-pairs`, `test/gate-pill.test.ts`), worker `seed/demo.sql`, `seed/test-seed.sql`, `test/env.d.ts`, `vitest.config.ts`, and `scripts/src/seed/*`. Wait for the parent session's "fixes deployed" message carrying the commit hash and the live version id. Then: (1) re-read the changed files above; (2) `git status --short` must show no modified tracked file (never stash, checkout, reset or restore another actor's edits; if one remains, STOP and report); (3) record `P1_BASE` = that literal sha and the new live rollback target = the version id the parent reports (fallback `23612b12-51c7-4d75-a324-f4f2f6392ba8`) in the phase report; (4) re-measure the baseline counts quoted in this plan (core 2914, web 223, preview 173 plus 1 skip), because the parent's fixes change them.
- **Design packages (Step 0, orchestrator addition B).** The design session produces fictional packages under `samples/packages/{01-northgate-infrastructure-iii,02-lotus-bay-asia-growth-ii,03-redwood-ridge-credit-i}/` (each: `docs/`, `README.md`, `answer-key.md` with seeded defects, exact quotes and AC-I* mapping, `_build/`). They are READ-ONLY for this program. Confirm they are committed (`git ls-files samples/packages` lists the docs, README.md and answer-key.md of each) and read each `answer-key.md`. If any is not committed by then, fall back to the synthetic Hartwell builder alone for that package, record the fallback in the phase report, and change nothing else (Hartwell remains the deterministic fixture). At PLAN time `docs/` was still empty, so file names below are by folder, not by file.
- Baseline suites green before any edit: `pnpm --filter @aduin/core test` (2914 tests at f0d924b) and `pnpm --filter @aduin/core typecheck`.
- Program SPEC and INNOVATE read; this plan read in full; `process/context/engine/all-engine.md` read (frozen v1, barrel append-only rule).

## Agent rules (every subagent of this phase)

- Never run `git stash`, `git checkout`, `git reset`, `git restore` (shared checkout). Stage explicit paths only (`git add <path>`); never `git add -A` or `git add .`.
- Commit directly on `main` with a conventional prefix (`feat|fix|test|docs|process|chore|refactor`) and end every message with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never edit `README.md`, `docs/README.md`, `docs/architecture/**`, `design/mockups/**`.
- Never touch the owner's protected personal Cloudflare zone named in `CLAUDE.md` Project Rules; no routes or custom domains; Cloudflare resources stay `aduin-transaction-*`.
- Free OpenRouter models only; 0 live model calls are planned in this program (a budget of 6 stays reserved, at most 3 per UTC day); stop on cost above 0, a non-`:free` model, a 429 or an open breaker.
- Never print or commit secrets; never re-put existing secrets. Public real documents are untrusted input: parse, never execute.

## Test command rules (read `process/context/tests/all-tests.md` for the runner facts)

- Select tests with `pnpm --filter <pkg> test <token>` and `pnpm --filter <pkg> test:e2e <token>`. NO `--` (pnpm 11 passes it literally and the whole suite runs). One token per call; an unmatched token must exit 1; confirm more than 0 tests ran.
- Playwright: one `preview` invocation at a time on port 4317; never run `preview` and `stack-memory` concurrently. (No Playwright in Phase 1.)
- A bash hook rejects command text containing `build`, `dist` or `node_modules`. Run builds only through a script file written into the session scratchpad (Write tool) and executed with `bash <path>`; the new fixture scripts use the names `package:fixtures` and `package:facts-extract` for that reason. Invoke binaries as `pnpm exec <tool>`.
- Render-first (program rule, applies from Phase 2): never await session, Turnstile or memory before rendering deterministic findings.

## Touchpoints

Create (core): `packages/core/src/package/{types,config,policy,detect,facts,definitions,references,terms,resolve,coverage,request,baseline,analyze,index}.ts` (14 files; `facts.ts` is an adaptation: INNOVATE's list had no facts.ts, but the stage-1 reader needs a home that imports `structure()` while `analyze.ts` stays free of parser imports so the main thread can import it later).
Modify (append only): `packages/core/src/index.ts` (one export block at the end).
Create (tests): see section "Test files".
Create (scripts): `scripts/src/fixtures/make-package.ts`, `scripts/src/fixtures/package-facts-extract.ts`, `scripts/test/package-fixtures.test.ts`. Modify: `scripts/src/fixtures/check.ts` (include the package fixtures in the drift gate), `scripts/package.json` (two new script keys only).
Create (fixtures): `fixtures/package/hartwell/{fund-iii-subscription-agreement.html,northgate-lpa-definitions.docx,fund-ii-subscription-agreement-prior.html}`, `fixtures/package/{expected.json,schema.v1.json,demo-packages.json}`, `fixtures/package/real-facts/*.json`. Plus `fixtures/package/design/{northgate-iii,lotus-bay-asia-ii,redwood-ridge-i}/**` and `fixtures/package/design/checksums.json` (copies of read-only `samples/packages/**`, only when committed by the design session).

## Public Contracts

Frozen for later phases (names and shapes are the contract; Phase 2 and Phase 3 import them):

- Types (zod strict schemas plus inferred types, all exported from `@aduin/core`): `PackageDocType` (`sub_agreement | lpa | ppm | tax_form | side_letter | other`), `PackageDocRole` (`to_digitize | reference | baseline`), `PackageConfidence` (`high | low`), `SuggestionSource` (`rule | analyst | ai`), `PackageDocFormat` (`html | pdf | docx | ocr | image`; named `PackageDocFormat` because `@aduin/core` already exports `DocFormat` from the adapters (`'html'|'pdf'|'docx'|'jpeg'|'png'`), and an explicit export would silently shadow it through `export *`; the adapters' `DocFormat` stays unchanged), `PackageDocument`, `PackageFacts`, `DocLocation`, `CrossDocDefinition`, `RawReference`, `ExternalReference`, `UsedTerm`, `SuppressedTerm`, `PrimaryFacts`, `CrossDocTerm`, `CoverageGroup`, `DocumentRequest`, `PackageAnalysis`, `PackagePolicy`, `PackageGateReason`, `BaselineCandidate`, `PackageProblem`.
- Functions: `detectDocument`, `resolveRoles`, `mergeSuggestion`, `packageRunReadiness`, `checkPackageLimits`, `buildPackageFacts`, `extractPrimaryFacts`, `extractExternalReferences`, `extractPackageDefinitions`, `applyPackageDefinitions`, `definitionSources`, `buildCrossDocTerms`, `resolveReferences`, `computeCoverage`, `coverageLineText`, `packageGateReasons`, `buildDocumentRequests`, `eligibleBaselines`, `analyzePackage`; constants `PACKAGE_DOC_TYPES`, `PACKAGE_DOC_ROLES`, `PACKAGE_LIMITS`, `DEFAULT_PACKAGE_POLICY`, `COVERAGE_GROUP_DEFS`, `DOC_SYNONYMS`, `DETECT_RULES`.
- Seam type only: `DocTypeSuggester` (async function from detect input to an optional type plus confidence). No LLM task is registered.
- Field-level contract (summary; types.ts is the source):
  - `PackageDocument`: id (64-hex content hash of the file; equals the engine `docHash` of the same bytes), name, type, role, confidence, reason, confirmed, suggestionSource, needsOcr, format, titleLines.
  - `PackageFacts`: contentHash, name, format, bytes, needsOcr, titleLines (≤12 lines, ≤200 chars each), headText (≤1500 chars), headings (≤200, ≤120 chars each), definitions (`CrossDocDefinition[]`).
  - `ExternalReference`: id (stable hash), quote (≤240, verbatim), location (blockIndex, start, end, sectionPath, optional page), targetLabel, targetKey (family plus normalized label), targetFamily (`lpa | ppm | side_letter | tax_form | annex`), resolution (`resolved | not_in_package | unclear`), resolvedDocId optional, confirmedByAnalyst.
  - `PrimaryFacts` (computed by the browser worker from the to-digitize document graph): docId, references (`RawReference[]`), dropped, usedTerms, carveOutTarget, localTerms, scopeLabels, suppressed (`SuppressedTerm[]`).
  - `CrossDocTerm`: term, status (`defined_in_package | unverified`), mentions, defining docId and definition quote when defined, reason (`no_reference_document | not_in_reference_documents`) when unverified.
  - `CoverageGroup`: id (`structure_flow | internal_refs | defined_terms | external_refs | investor_paths`), label, status (`full | partial | blocked`), missingTypes, reasons. `DocumentRequest`: id, targetKey, label, targetFamily, quote, count, firstDocId. `PackageAnalysis`: schema literal `package-analysis.v1`, documents, references, terms, coverage, requests, dropped (all arrays sorted deterministically; no timestamps, ids from clocks, or timings).
- **Variance interface (consumer: variance-mvp L10, AC-V1, AC-V8; frozen here and in Phase 2):** pure `eligibleBaselines(pkg {id, firmId}, candidates)` in core (`BaselineCandidate` = docId, name, firmId, packageId, optional storedDocId and createdAt) returns candidates in the same package whose own non-null `firmId` does not differ from the package `firmId` (defense in depth: a same-package candidate with a differing non-null `firmId` is rejected), or in the same non-null firm; never another firm; a null-firm package sees within-package candidates only. Phase 2 adds the browser side (`usePackage` store `setRole`, `baselineDocs`, `addEarlierDocument`). Variance reads the baseline role from the package store and never from D1.
- Unchanged: frozen contracts v1, `packages/core/test/__snapshots__/contracts.json-schema.snap`, the 13 detectors and `detectors/registry.ts`, `computeGate` and its matrix, taxonomy (15 issue classes), `limits` in `config/limits.ts`, the Finding schema, fingerprints and memory labels.

## Blast Radius

Files directly created or modified (exact):

- `packages/core/src/package/types.ts`, `config.ts`, `policy.ts`, `detect.ts`, `facts.ts`, `definitions.ts`, `references.ts`, `terms.ts`, `resolve.ts`, `coverage.ts`, `request.ts`, `baseline.ts`, `analyze.ts`, `index.ts` (new)
- `packages/core/src/index.ts` (append one block)
- `packages/core/test/unit/package-undefined-term-baseline.test.ts`, `package-types-contract.test.ts`, `package-detect.test.ts`, `package-suggester-seam.test.ts`, `package-reference-resolution-matrix.test.ts`, `package-coverage-matrix.test.ts`, `package-gate-policy-matrix.test.ts`, `package-request.test.ts`, `package-baseline-eligibility.test.ts`, `package-determinism.test.ts`, `package-limits.test.ts` (new); `packages/core/test/unit/package-readiness.test.ts`, `package-facts.test.ts`, `package-scan-bounded.test.ts` (new, PVL cycle 1 G3)
- `packages/core/test/golden/package-type-detection-golden.test.ts`, `package-reference-extraction-golden.test.ts`, `package-crossdoc-terms-golden.test.ts`, `package-realfacts-local.test.ts` (new)
- `packages/core/test/seeded/package-reference-recall-matrix.test.ts` (new)
- `packages/core/test/property/package-quote-verbatim-contract.test.ts` (new)
- `scripts/src/fixtures/make-package.ts`, `scripts/src/fixtures/package-facts-extract.ts` (new); `scripts/src/fixtures/check.ts`, `scripts/package.json` (modify, additive); `scripts/test/package-fixtures.test.ts` (new)
- `fixtures/package/**` (new, generated and committed) (includes `fixtures/package/design/**`). Read-only sources: `samples/packages/**` (design-owned, never edited).

Read-only here (touch = BLOCKED): `packages/core/src/detectors/**`, `packages/core/src/counsel/**`, `packages/core/src/contracts/**`, `packages/core/src/memory/**`, `packages/core/src/structure/**`, `packages/core/src/model/**`, `apps/**`.

## Data Flow

1. Web worker (Phase 2) turns bytes into lines with the existing adapters. For every package member `buildPackageFacts` runs `structure()` only (no graph, no detectors) and returns titles, headings and definitions (stage 1, light read).
2. `detectDocument` scores file name (2 points), first-page title and heading lines (3 points) and body phrases in the first 1500 characters (1 point each, max 3); `high` = top score ≥ 3 and margin ≥ 2 over the runner-up, else `low`. `resolveRoles` applies package-level role rules (one subscription agreement becomes `to_digitize`; two or more subscription agreements are all `low` and held; file name hints prior / previous / baseline propose `baseline` at `low`; baseline is never auto-assigned at `high`). Tie handling and the SEC-cover rule are step C6 (a tie never produces `high`).
3. The analyst confirms (Phase 2). The to-digitize document runs through the normal engine analyze with the package definitions injected: `applyPackageDefinitions(findings, defs)` removes offering-noun `undefined-term` findings the package defines and returns `SuppressedTerm[]`; `extractPrimaryFacts(graph)` returns references, used terms and the A6 carve-out target.
4. `analyzePackage` (pure, main thread) combines documents, facts, `PrimaryFacts` and confirmed targets into `PackageAnalysis`: `resolveReferences`, `buildCrossDocTerms`, `computeCoverage`, `buildDocumentRequests`.
5. `coverageLineText`, `packageGateReasons` and `eligibleBaselines` are pure views over that analysis (Phase 2 view-model, Phase 3 UI).

Failure modes: structurer exception on a member gives facts with `needsOcr` false and empty titles (type `other`, `low`); empty lines (scan with no OCR) give `needsOcr` true; a quote that fails the verbatim check is dropped and counted; an unclear resolution never auto-resolves; two files with the same content hash collapse (Phase 2 shows a notice).

## Implementation Checklist

### Step A — Premise check and baseline (FIRST task; nothing else starts before A5)

- [ ] A1. Record `P1_BASE` (`git rev-parse HEAD`) and `git status --short` (must be clean for the blast radius) in the phase report.
- [ ] A2. Run `pnpm --filter @aduin/core test golden-11-undefined-units` (exit 0, more than 0 tests; 4 tests at f0d924b) and `pnpm --filter @aduin/core typecheck` (exit 0).
- [ ] A3. Create `packages/core/test/unit/package-undefined-term-baseline.test.ts`: for each of the 12 HTML samples (use `htmlSamples()` and `analyzed(n)` from `packages/core/test/helpers/samples.ts`) pin, as literal expectations measured by running the engine now, the count and the sorted `used_term` list of findings with `detector_id` `undefined-term`, and the count of `defined_term_issue` findings by `detector_id`. Measure first, then write the literals.
- [ ] A4. Record the measured table in the phase report under `## Premise Check`. Expected from `golden-11-undefined-units`: `undefined-term` fires only on #11 ("Units") and not on #5/#6. If the table shows more samples with `undefined-term` findings, record each as a RESCOPE NOTE (ACs stay listing + suppression + coverage per INNOVATE finding 1); do not add a generic undefined-term rule.
- [ ] A5. Run `pnpm --filter @aduin/core test package-undefined-term-baseline` (exit 0) and commit `test: pin undefined-term baseline before intake`.

### Step B — Types, limits, policy

- [ ] B1. `packages/core/src/package/types.ts`: zod strict schemas and inferred types exactly as in Public Contracts; constants `PACKAGE_DOC_TYPES`, `PACKAGE_DOC_ROLES`; `PackageAnalysisSchema` with `schema: z.literal('package-analysis.v1')`. Import only `zod` and existing core model types (`Line`, `Block` as types).
- [ ] B2. `packages/core/src/package/config.ts`: `PACKAGE_LIMITS` = 12 files, 40 MB total, `limits.maxUploadBytes` per file (do not touch the frozen `limits`); `checkPackageLimits(files: {name, size}[])` returns ok or a plain-language refusal message ("A package takes up to 12 files and 40 MB in total. You chose N files." / total-size variant / per-file variant naming the file). Refusal stores nothing (pure function).
- [ ] B3. `packages/core/src/package/policy.ts`: `PackagePolicySchema` (missingDocGate record type to `block | warn | off`, `warnOnlyWhenReferenced` list of types), `DEFAULT_PACKAGE_POLICY` validated by the schema at module load with `sub_agreement: block`, `lpa: warn`, `ppm: warn`, `side_letter: warn`, `tax_form: warn`, `warnOnlyWhenReferenced: [ppm, side_letter, tax_form]` (LPA warns whenever missing, because defined terms need it); `COVERAGE_GROUP_DEFS` (data): `structure_flow` "Structure and flow" requires sub_agreement; `internal_refs` "Internal cross-references" requires sub_agreement; `defined_terms` "Defined terms" requires sub_agreement, recommends lpa; `external_refs` "External references" requires sub_agreement, no static recommends (dynamic: any reference `not_in_package` or `unclear`); `investor_paths` "Investor paths" requires sub_agreement. `packageGateReasons(analysis, policy)` returns `PackageGateReason[]` (level `block | warn`, docType, fixed plain text); a type counts as present only when a document of that type exists and `needsOcr` is false.

### Step C — Detection

- [ ] C1. `packages/core/src/package/detect.ts`: `DETECT_RULES` data table per type with title phrases (3 points: subscription agreement / subscription booklet / subscription document(s) / subscription application; (amended and restated) limited partnership agreement / agreement of limited partnership / limited liability company agreement / operating agreement; private placement memorandum / offering memorandum / prospectus / confidential memorandum; form W-8BEN-E / form W-8BEN / form W-9 / form W-8IMY; side letter), file-name tokens (2 points: sub, subscription; lpa, lp-agreement, partnership-agreement, llc-agreement; ppm, memorandum, prospectus; w-8, w8, w-9, w9; side-letter), body phrases (1 point each, max 3). File name normalized to lowercase with separators unified to `-`.
- [ ] C2. `detectDocument(input)` returns `{type, role, confidence, reason}`; type `other` with `low` and reason "No title, file name or opening text matched a known document type." when nothing scores. Reasons are fixed templates only (for example `Title says "…"`, `File name contains "…"`, `Opening text mentions "…"`); never free text, never the document body.
- [ ] C3. `resolveRoles(docs)`: exactly one `sub_agreement` becomes `to_digitize` (confidence unchanged); two or more subscription agreements: all `low`, reason "Two subscription agreements in this package; choose which one to digitize." (role proposed `to_digitize` for all, readiness then forces exactly one); non-sub types default to `reference`; a name hint (prior, previous, baseline) proposes `baseline` at `low`. Role `to_digitize` is only legal on type `sub_agreement`.
- [ ] C4. `DocTypeSuggester` type and `mergeSuggestion(doc, suggestion)`: precedence confirmed analyst > high rule > low rule > AI suggestion; an AI suggestion is stored with `suggestionSource: 'ai'` only when it outranks the current value; it never changes a `confirmed` value. No registry entry, no prompt, no task file.
- [ ] C5. `packageRunReadiness(docs)` in `analyze.ts` (pure): problems `low_confidence_unconfirmed` (per doc), `no_to_digitize`, `multiple_to_digitize`; `ok` only when all `low` rows are confirmed and exactly one row has role `to_digitize`.
- [ ] C6. Real-file tie-break and SEC-cover rule (PVL cycle 1, G2; data in `DETECT_RULES`, no new code path). Measured on the real files: NGI #5 and #6 tie at 3 points between subscription agreement, a memorandum/prospectus and "limited liability company agreement" in their first 12 lines, and the full S-11 files show no type phrase in the first 12 lines or first 1500 characters (SEC cover boilerplate). Rules: (a) deterministic tie-break among equal top scores = the type whose title phrase appears on the EARLIEST title line (then the lowest line offset, then the fixed type order `sub_agreement, lpa, ppm, tax_form, side_letter, other`); (b) a tie can NEVER yield `high` (margin rule stays: margin >= 2 over the runner-up), so a tie resolves the TYPE deterministically but at `low` confidence; (c) SEC-cover rule: head text containing "registration statement" or a form number "Form S-11" (and not an earlier-line subscription title) maps to `ppm` at `low`, reason template `Opening text mentions "..."`; (d) write `package-type-detection-golden` first, run it over the committed real facts (NGI #5, #6, #13 Appendix B, #9 OCR page 1, both S-11 files) to measure scores, then tune DATA only; (e) if a real file still cannot reach its authored type, record a Known-Gap for that file only, write backlog stub `intake-local-real-facts`, and keep AC-I5 CONDITIONAL for that file (never a silent pass).

### Step D — Facts, definitions, references

- [ ] D1. `definitions.ts`: `extractPackageDefinitions(docId, blocks)` using `extractDefinedTerms` from `packages/core/src/structure/defined-terms.ts` (paren and means forms) plus a bounded `X means` scan for unquoted heads (term ≤ 6 words, linear-time); each definition carries a verbatim quote (sentence window ≤240) and `DocLocation`; deterministic order by (blockIndex, start).
- [ ] D2. `facts.ts`: `buildPackageFacts({contentHash, name, format, bytes, lines, needsOcr})` runs `structure(contentHash, lines)` only; fills titleLines (first 12 non-empty lines), headText (first 1500 chars), headings (heading blocks), definitions; empty lines give `needsOcr: true`. `extractPrimaryFacts(graph, docId)` runs `extractExternalReferences` on the to-digitize blocks, collects `usedTerms`, `carveOutTarget` (reuse the exported `CARVE_OUT_RE` from `packages/core/src/detectors/undefined-term.ts` by import; do not edit the detector), `localTerms` (structure defined terms), `scopeLabels` (section, annex, schedule and appendix labels of this document).
- [ ] D3. `references.ts`: `extractExternalReferences(blocks, ctx)` with three pattern families kept as data and linear-time: (1) definitional ("as defined in the X", "have the meanings given to them in the X", plus the `CARVE_OUT_RE` sentence); (2) governing ("pursuant to", "in accordance with", "subject to the terms of", "as set forth in" followed by a named document); (3) named documents (Limited Partnership Agreement, Partnership Agreement, LP Agreement, Limited Liability Company Agreement, LLC Agreement, Operating Agreement, Fund Agreement, Private Placement Memorandum, Offering Memorandum, Memorandum, Prospectus, PPM, Side Letter, Form W-8BEN(-E), Form W-9, Annex / Schedule / Exhibit / Appendix plus a label). Exclusions: self-reference ("this Subscription Agreement"), statutory names (Act, Code, Rule; owned by the statutory detector), and a labelled Annex / Schedule / Appendix that matches a heading or scope label of the same document (internal, not external). Quote = sentence window around the match, ≤240 chars, verified as a substring of the block text before use; a failing quote is dropped and counted in `dropped`. Masking is a render/export edge concern (Phase 2/3), not applied here.
- [ ] D4. `resolve.ts`: `DOC_SYNONYMS` data (lpa: limited partnership agreement, partnership agreement, lp agreement, lpa, fund agreement, limited liability company agreement, llc agreement, operating agreement; ppm: private placement memorandum, offering memorandum, memorandum, prospectus, ppm; side_letter: side letter; tax_form: form w-8ben, form w-8ben-e, form w-9). `resolveReferences(raw, docs, facts, confirmedTargets, primaryId)`: candidates are package documents other than the primary with the matching type (annex family: documents whose title lines, headings or file name carry the label); exactly one confident candidate gives `resolved`; none gives `not_in_package`; two or more, or one candidate whose confidence is `low` and unconfirmed, gives `unclear`; `confirmedTargets[targetKey]` (document id or the literal `none`) overrides and sets `confirmedByAnalyst`.

### Step E — Terms, coverage, requests, baseline, analysis

- [ ] E1. `terms.ts`: `definitionSources(docs)` (role `reference`, type `lpa` or `ppm`); `applyPackageDefinitions(findings, defs)` (only findings with `detector_id` `undefined-term` whose `detail.facts.used_term` family-matches a definition term; returns remaining findings plus `SuppressedTerm[]`; never edits other findings; stable order); `extractUsedTerms(blocks, localTerms)` (capitalized 1-4 word terms used mid-sentence at least twice, not defined locally, minus a stoplist kept as data: Section, Article, Part, Annex, Schedule, Exhibit, Appendix, Agreement, Subscription Agreement, Form, Item, Page, United States, U.S., Act, Code, Rule, Regulation, Securities Act, Investment Company Act, Exchange Act, ERISA, IRS, SEC, month and weekday names; bounded to 200 terms); `buildCrossDocTerms(primary, defs, hasDefinitionDoc)` lists terms only when `carveOutTarget` is present (the sub agreement says terms are defined elsewhere): status `defined_in_package` with the defining document and quote, else `unverified` with reason `no_reference_document` (no definition-bearing reference document) or `not_in_reference_documents`; suppressed offering-noun terms are merged in as `defined_in_package`. These lists produce no findings.
- [ ] E2. `coverage.ts`: `computeCoverage(docs, references, terms, policy?)` using `COVERAGE_GROUP_DEFS`: `blocked` if a required type is missing or present with `needsOcr` (reason "has no readable text (needs OCR)"); `partial` if a recommended type is missing or `needsOcr`, any reference is `not_in_package` or `unclear`, or any term is `unverified`; else `full`. Reason templates are fixed ("no LPA", "N terms unverified", "N references not in the package", "N references to confirm", "needs OCR"). `coverageLineText(analysis)` returns `Coverage: full` or `Coverage: <worst status> - <reasons deduplicated in group order, at most 3, then "+N more">` (example: `Coverage: partial - no LPA, 14 terms unverified`).
- [ ] E3. `request.ts`: `buildDocumentRequests(references, primaryId)` groups references with resolution `not_in_package` by `targetKey` (T3: one item per distinct missing target label, deduped); label = display form of the first mention, quote = first mention in document order, count = mentions; unclear references are never requests.
- [ ] E4. `baseline.ts`: `eligibleBaselines(pkg, candidates)` as in Public Contracts; stable order (createdAt desc then name); pure. It also rejects a same-package candidate whose non-null `firmId` differs from the package `firmId` (PVL cycle 1 G5).
- [ ] E5. `analyze.ts`: `analyzePackage({docs, facts, primary, confirmedTargets, policy?})`: inputs sorted by (id, name); output arrays sorted; fixed coverage group order; `primary` null before the run gives references and terms empty; `dropped` carried from `PrimaryFacts`.
- [ ] E6. `index.ts` re-exports the public names; then append ONE block to `packages/core/src/index.ts` (`// --- Intake Phase 1: fund package module` followed by `export * from './package/index';`). Run `pnpm --filter @aduin/core typecheck`; any export-name collision with the existing barrel is renamed on the package side (never on the existing side). The package format type is exported ONLY as `PackageDocFormat`. Typecheck does not catch a shadowed name, so `package-types-contract` also carries a type-level assertion (an `Expect<Equal<>>` style check) that `DocFormat` imported from `@aduin/core` is still exactly the adapter union `'html'|'pdf'|'docx'|'jpeg'|'png'`.

### Step F — Fixtures and scripts

- [ ] F1. `scripts/src/fixtures/make-package.ts` (script key `package:fixtures`): writes `fixtures/package/hartwell/fund-iii-subscription-agreement.html` (title "NORTHGATE INFRASTRUCTURE FUND III, L.P. SUBSCRIPTION AGREEMENT"; defines `("Interests")` locally; the A6 sentence "Capitalized terms used but not defined herein have the meanings given to them in the Partnership Agreement."; a "purchase of the Units" use (Units defined only in the LPA excerpt, so suppressed with the LPA present); a "subscribed for the Stock" use (nobody defines Stock, finding stays); used-twice terms Capital Commitment, Closing Date, General Partner, Management Fee and one nobody defines, Excused Investor; references to the Partnership Agreement, Annex F (Investor Questionnaire), the Side Letter and Form W-8BEN-E; internal Annex labels that must NOT become external references), `fixtures/package/hartwell/northgate-lpa-definitions.docx` (via the `docx` library as in `scripts/src/fixtures/make-docx.ts`; title "AMENDED AND RESTATED LIMITED PARTNERSHIP AGREEMENT" and quoted definitions for Units, Capital Commitment, Closing Date, General Partner, Management Fee), `fixtures/package/hartwell/fund-ii-subscription-agreement-prior.html` (same template, Fund II). Lines ≤100 chars; deterministic; prettier-clean; synthetic, non-routable data only.
- [ ] F1b. `make-package.ts` also copies the three read-only design packages (sources `samples/packages/<folder>/docs/*`) into `fixtures/package/design/<id>/` with stable file names (`<id>` = `northgate-iii`, `lotus-bay-asia-ii`, `redwood-ridge-i`), writes `fixtures/package/design/checksums.json` (sha256 of each source and copy; a source change by the design session shows as drift to re-run) and derives `expected.json` entries from each `answer-key.md`. Mapping (orchestrator addition B): northgate-iii (full package plus Fund II baseline; Annex F and the Kestrel side letter missing) = AC-I5, I9, I11, I14, I15, I16, I20; lotus-bay-asia-ii (Cayman master plus US feeder; no LPA; Annex C, LPA and US feeder subscription agreement missing; baseline = prior draft v1) = AC-I5, I9, I12, I16, I20; redwood-ridge-i (first-time fund, no baseline, ERISA branch, scanned tax guide needing OCR) = AC-I5, I10, I17 and the needs-OCR coverage path. Synthetic Hartwell stays as the always-available fallback and the deterministic CI fixture; if a design package is missing at Step 0 its entries are simply absent.
- [ ] F2. Same script writes `fixtures/package/expected.json` (AUTHORED expectations: per file type, final analyst-resolved role, whether it must be low confidence, expected references with families and resolutions with and without the LPA, expected terms with and without the LPA, expected coverage, expected requests: Annex F, Side Letter, Form W-8BEN-E), `fixtures/package/schema.v1.json` (JSON schema of `PackageAnalysisSchema`) and `fixtures/package/demo-packages.json` (entries `hartwell` (firm `firm-x`; Hartwell and Crane is not in the firm list and adding it would touch frozen memory fixtures, so the package is tagged to the existing firm `firm-x` and the narrative lives in the documents), `ngi` (firm `partners-group`; members `sample:05` and `sample:06`), `rw-scans` (member `scan:09`), `blackstone-appendix` (member `sample:13`); members reference bundled files by path or by sample id; no local-only file is ever referenced).
- [ ] F2b. `demo-packages.json` lists, in this order: `northgate-iii`, `lotus-bay-asia-ii`, `redwood-ridge-i` (design packages, only those present), then `hartwell` (fallback and deterministic fixture), `ngi` (#5 + #6), `rw-scans` (#9). The Upload modal's Demo packages list shows this order, so it prefers the three design packages. Field `primaryDemoId` = `northgate-iii` when it was confirmed at Step 0, else `hartwell`; the live smoke (Phase 4) reads it.
- [ ] F3. `scripts/src/fixtures/package-facts-extract.ts` (script key `package:facts-extract`, local-only, reads gitignored `samples/sub-docs/raw/_full-prospectus/*`, #13 Appendix B, the #9 precomputed OCR page 1 under `apps/web/public/precomputed/ocr/`): writes short committed `fixtures/package/real-facts/<id>.json` with name, format, titleLines (≤12 × ≤200 chars), headText (≤1500 chars) and the expected type/role. Run it once if `_full-prospectus` exists; otherwise record the missing local file as a Known-Gap with a backlog stub and keep AC-I5 CONDITIONAL for that file only.
- [ ] F4. `scripts/src/fixtures/check.ts`: extend the drift gate so every generated package fixture is rebuilt in memory and compared (HTML and JSON byte-equal; the DOCX through `sameDocx` from `make-docx.ts`, which skips `docProps/core.xml`); stray files under `fixtures/package/hartwell` fail. `scripts/package.json`: add only the keys `package:fixtures` and `package:facts-extract`. The drift gate rebuilds ONLY `hartwell/*`, `expected.json`, `schema.v1.json`, `demo-packages.json` and (when present) `design/**` copies; `real-facts/*.json` derive from gitignored local files and are checked for SHAPE only, never rebuilt (G6). The script is named `make-package.ts` (matches `make-docx.ts`, `make-pdf.ts`) because a path containing the blocked word cannot be staged by the session hook; stage it through a scratchpad script file if ever needed, never `git add -A`.
- [ ] F5. Run `pnpm --filter @aduin/scripts package:fixtures` once; commit generated fixtures; run `pnpm --filter @aduin/scripts fixtures:check` (exit 0).

### Step G — Tests (red first for Fully-Automated rows: write each test file with the scenario names below, run it red, then implement)

- [ ] G1. `package-types-contract` (deep-equal `z.toJSONSchema(PackageAnalysisSchema)` with `fixtures/package/schema.v1.json`; also asserts the existing contracts snapshot file is unchanged by running in the same package as `contracts`). Also asserts, at type level, that `DocFormat` from `@aduin/core` is unchanged (the adapter union) and that `PackageDocFormat` is the package union (G1 of PVL cycle 1).
- [ ] G2. `package-limits` (12 files, 40 MB, per-file boundaries; refusal message texts; zero side effects).
- [ ] G3. `package-detect` (AC-I4: every fixture file gets type, role, confidence, template reason; no body text in reasons).
- [ ] G4. `package-type-detection-golden` (AC-I5: expected matrix from `expected.json` plus committed `real-facts/*.json` for the full prospectus files, #13, #9 page 1; NGI #5/#6 read from the committed raw HTML; assert type equals expected on EVERY file and no `high` confidence carries a wrong type or wrong final role; two subscription agreements are `low`).
- [ ] G5. `package-suggester-seam` (AC-I7: injected fake suggester contradicting a rule; confirmed value unchanged; no-suggester run completes; precedence table).
- [ ] G6. `package-reference-extraction-golden` (AC-I10: pattern matrix on the synthetic Fund III and on NGI #5/#6; every quote is verbatim; locations resolve).
- [ ] G7. `package-reference-recall-matrix` (AC-I11: ground truth for NGI #5/#6 = independent noun counts of "LLC Agreement", "Memorandum", "Prospectus" over block text minus the explicit exclusion list authored in `fixtures/package/expected.json`; 100% of seeded references found; report found/total per family).
- [ ] G8. `package-reference-resolution-matrix` (AC-I12: synonyms, annex titles, missing targets, two LPAs gives `unclear`, low-confidence unconfirmed candidate gives `unclear`, `confirmedTargets` override).
- [ ] G9. `package-quote-verbatim-contract` (AC-I13: fast-check over generated block text with embedded reference phrases; every returned quote is a substring of its block; injected corruption is dropped and counted).
- [ ] G10. `package-crossdoc-terms-golden` (AC-I14/15/16: with LPA: "Units" suppressed and listed `defined_in_package` with the definition quote, "Stock" finding retained; without LPA: terms `unverified` with reason `no_reference_document`; with LPA lacking a term: `not_in_reference_documents`; sample #11 still flags "Units").
- [ ] G11. `package-coverage-matrix` (AC-I17: full / partial / blocked per group across package states including `needsOcr`; exact `coverageLineText` strings).
- [ ] G12. `package-gate-policy-matrix` (AC-I19: missing sub agreement blocks with a reason; missing LPA / PPM warns; warn-only-when-referenced types; a modified policy row flips block/warn/off; `computeGate` outputs unchanged for the same findings).
- [ ] G13. `package-request` (AC-I20 core half and T3: dedupe by target label, first-mention quote, count, unclear excluded).
- [ ] G14. `package-baseline-eligibility` (AC-I9 pure half: two firms with identical text never cross; null firm; within-package; ordering). Adds the case: same-package candidate with a differing non-null `firmId` is rejected.
- [ ] G15. `package-determinism` (AC8: run the whole pipeline twice and with shuffled document order; `JSON.stringify` byte-equal).
- [ ] G16. `package-realfacts-local` (opt-in `PACKAGE_LOCAL=1`: re-derive facts from the local real files and compare with the committed `real-facts`; skipped silently otherwise; counts as Hybrid, never a CI gate).
- [ ] G17. `scripts/test/package-fixtures.test.ts` (generated fixtures equal committed files; docx zip entries compared without `docProps/core.xml`).
- [ ] G18. `package-readiness` (AC-I6 core: `packageRunReadiness` problems `low_confidence_unconfirmed`, `no_to_digitize`, `multiple_to_digitize`; `ok` only when every `low` row is confirmed and exactly one row is `to_digitize`).
- [ ] G19. `package-facts` (`buildPackageFacts`: titleLines <= 12 x 200, headText <= 1500, headings <= 200 x 120, empty lines give `needsOcr: true`, structurer exception gives empty titles with type `other`; `extractUsedTerms`: used-twice rule, local-term exclusion, stoplist).
- [ ] G20. `package-scan-bounded` (modeled on `test/unit/defined-term-scan-bounded.test.ts`: long unbroken runs and a 1 MB single block through `extractExternalReferences`, `extractPackageDefinitions` and `extractUsedTerms` finish under a fixed time bound; this is the test the Risks table promises for catastrophic regex).
- [ ] G21. Design-package rows (additive to the goldens above, only for packages confirmed at Step 0): `package-type-detection-golden`, `package-reference-extraction-golden`, `package-crossdoc-terms-golden`, `package-reference-recall-matrix` and `package-request` each gain rows driven by `fixtures/package/expected.json` entries derived from each package's `answer-key.md` (seeded defects with exact quotes; AC-I5, I11, I14-I16, I20 mapped as in F1b). NGI #5/#6, #13 and #9 stay the real-document cases of the same goldens.

### Step H — Close

- [ ] H1. Run every gate in "Verification Evidence" one token per call, then the full core suite and the untouched-contract gates; write the phase report (commands, counts, premise table, adaptations, Known-Gaps, backlog stubs to register: `intake-llm-doc-type-suggest` (no task ships; seam only), `intake-local-real-facts` if the local files were missing). Hand-off to Phase 3c (G5): `DocumentRequest.quote` is stored UNMASKED; record in the report that the request DOCX (and every render) must route quotes through core `maskAndClamp` (`maskQuote` for display) before writing.
- [ ] H2. Commit execution changes with explicit paths: `feat: core fund package module with fixtures and goldens` (core), `test: package fixtures drift gate` (scripts, fixtures).

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm --filter @aduin/core test package-undefined-term-baseline` | Fully-Automated | premise check (INNOVATE finding 1); guards AC-I15 base |
| `pnpm --filter @aduin/core test package-types-contract` | Fully-Automated | schema snapshot (INNOVATE data model); AC-I13 shape |
| `pnpm --filter @aduin/core test package-limits` | Fully-Automated | AC-I1 (core half: refusal rule) |
| `pnpm --filter @aduin/core test package-detect` | Fully-Automated | AC-I4 |
| `pnpm --filter @aduin/core test package-type-detection-golden` | Fully-Automated | AC-I5 |
| `pnpm --filter @aduin/core test package-suggester-seam` | Fully-Automated | AC-I7 |
| `pnpm --filter @aduin/core test package-reference-extraction-golden` | Fully-Automated | AC-I10 |
| `pnpm --filter @aduin/core test package-reference-recall-matrix` | Fully-Automated | AC-I11 |
| `pnpm --filter @aduin/core test package-reference-resolution-matrix` | Fully-Automated | AC-I12 |
| `pnpm --filter @aduin/core test package-quote-verbatim-contract` | Fully-Automated | AC-I13 |
| `pnpm --filter @aduin/core test package-crossdoc-terms-golden` | Fully-Automated | AC-I14, AC-I15, AC-I16 (core halves) |
| `pnpm --filter @aduin/core test golden-11-undefined-units` | Fully-Automated | AC-I15 / base AC13 re-run |
| `pnpm --filter @aduin/core test package-coverage-matrix` | Fully-Automated | AC-I17 (matrix) |
| `pnpm --filter @aduin/core test package-gate-policy-matrix` | Fully-Automated | AC-I19 |
| `pnpm --filter @aduin/core test gate-state-matrix` | Fully-Automated | AC22 re-run (core gate untouched) |
| `pnpm --filter @aduin/core test package-request` | Fully-Automated | AC-I20 (core half), T3 |
| `pnpm --filter @aduin/core test package-baseline-eligibility` | Fully-Automated | AC-I9 (pure half) |
| `pnpm --filter @aduin/core test package-determinism` | Fully-Automated | AC8 re-run on intake output |
| `pnpm --filter @aduin/core test package-readiness` | Fully-Automated | AC-I6 (core half) |
| `pnpm --filter @aduin/core test package-facts` | Fully-Automated | AC-I4/AC-I5 input facts (needsOcr, caps, used terms) |
| `pnpm --filter @aduin/core test package-scan-bounded` | Fully-Automated | no catastrophic regex on hostile input (AC8 robustness; Risks row) |
| `pnpm --filter @aduin/core test determinism` | Fully-Automated | AC8 base |
| `pnpm --filter @aduin/core test contracts` and `git diff --quiet P1_BASE -- packages/core/test/__snapshots__ packages/core/src/contracts` | Fully-Automated | frozen contracts v1 unchanged |
| `git diff --quiet P1_BASE -- packages/core/src/detectors packages/core/src/counsel packages/core/src/memory packages/core/src/contracts packages/core/src/structure packages/core/src/model packages/core/src/graph packages/core/src/findings packages/core/src/llm packages/core/src/adapters packages/core/src/engine.ts apps` (P1_BASE = the literal sha from Step 0) | Fully-Automated | detectors, gate, memory, apps untouched |
| `pnpm --filter @aduin/scripts test package-fixtures` and `pnpm --filter @aduin/scripts fixtures:check` | Fully-Automated | fixtures reproducible (AC8) |
| `PACKAGE_LOCAL=1 pnpm --filter @aduin/core test package-realfacts-local` | Hybrid (local files; opt-in) | AC-I5 real files still match committed facts |
| `pnpm --filter @aduin/core test`, `pnpm --filter @aduin/scripts test`, `pnpm typecheck`, `pnpm lint`, `pnpm guard:cf`, `pnpm secrets:scan` | Fully-Automated | regression (base AC1-AC64 keep passing) |

## Exit Gate

```bash
pnpm --filter @aduin/core test package-detect
# Expected: exit 0, more than 0 tests; repeat the same one-token call for every token in the table above
pnpm --filter @aduin/core test
# Expected: exit 0, previous 2914 tests plus the new package tests, 0 failed
pnpm --filter @aduin/scripts fixtures:check
# Expected: exit 0 (no drift, no stray, no missing)
git diff --quiet P1_BASE -- packages/core/src/detectors packages/core/src/counsel packages/core/src/memory packages/core/src/contracts packages/core/src/structure packages/core/src/model packages/core/src/graph packages/core/src/findings packages/core/src/llm packages/core/src/adapters packages/core/src/engine.ts apps
# Expected: exit 0
```

- All checklist items checked; premise table recorded; phase report written to the report destination; execution commits made with explicit paths.

## Risks and Mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| Wrong high-confidence type | High | Conservative threshold (score ≥ 3 and margin ≥ 2); two-subscription roles always `low`; golden on committed real facts; T1 ruling wording |
| Real-file score ties (NGI #5/#6) and SEC cover boilerplate with no type phrase | Med | Step C6: earliest-title-line tie-break, tie never `high`, SEC-cover rule to `ppm` at `low`, golden run first on committed real facts; Known-Gap with backlog stub for any remaining miss |
| Reference recall below 100% on NGI #5/#6 | Med | Seeded matrix with independent noun-count ground truth; tune pattern DATA, not code paths; if a rule cannot be tuned, record a Known-Gap with a backlog stub and keep AC-I11 CONDITIONAL (no LLM task is added without an orchestrator ruling; adding one is a hard stop because it is needs-live-provider) |
| Barrel export-name collision | Low | Typecheck after the barrel append; rename on the package side |
| Real documents missing locally | Low | Committed facts are the CI proof; missing local files recorded as Known-Gap with backlog stub |
| Catastrophic regex | Med | Bounded quantifiers, linear-time patterns, per-block caps; a `defined-term-scan-bounded` style test for references |

## Rollback

All changes are additive files plus one appended barrel block and two script keys. Roll back by reverting the phase commits (`git revert <sha>`); nothing in later phases exists yet. No data migration, no deploy.

## Blockers That Would Justify BLOCKED Status

- Step A shows the premise is wrong in a way that changes ACs (surface to the orchestrator as RESCOPE; do not widen detectors).
- A required change in a read-only path (detectors, contracts, counsel) turns out to be unavoidable.
- The barrel append cannot be made collision-free without touching existing exports.

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [x] 1. RESEARCH — satisfied by the program-level RESEARCH and the code reading done for this plan (no scoped research pass needed; a fresh agent re-verifies the Step A premise at EXECUTE entry)
- [x] 2. INNOVATE — satisfied by the program-level INNOVATE (`intake-mvp_INNOVATE_17-10-26.md`, LOCKED)
- [x] 3. PLAN-SUPPLEMENT — n/a: plan freshly written by the PLAN session, no research gaps (Step A re-verifies the premise at EXECUTE entry)
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md` (Status / Gate / Plan updates applied / Execute-agent instructions / Test gates / High-risk pack / Backlog artifacts / Known gaps / Accepted by)
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", the orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare applied inline; no skill-invocation tool in this planning session)

Signal score 2/7 (S4 phase program, S7 14+ new files). Recommended: sequential, ONE opus vc-execute-agent (the code-writing leg), then an independent sonnet vc-tester for EVL. Reason: one author keeps types.ts, the barrel and the policy tables consistent; the steps depend on each other (types before detect before analyze). No parallel fan-out. Agent count: 1 execute + 1 tester.

## Test Infra Improvement Notes

(none identified yet) — candidates to record at EVL: a shared helper for loading `fixtures/package/**` in core tests; the one-token-per-call loop could be a script (existing backlog P6-2 style).

## Resume and Execution Handoff

- Selected plan file path: `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-1-core-package-engine_PLAN_17-10-26.md`
- Last completed step: not started (plan written; outer PVL next)
- Validate-contract status: written 2026-10-17 (Gate: PASS, outer-pvl, PVL cycle 2)
- Next step: spawn vc-validate-agent (outer PVL) for this plan; after Gate: PASS spawn vc-execute-agent (opus) with this exact plan path, the validate-contract path, and Step A first.
- Validators for the plan artifact: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this plan>` and `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <this plan>`.
- Next instruction: ENTER VALIDATE MODE for this plan, then ENTER EXECUTE MODE only after `Gate: PASS`.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: outer-pvl
supersedes: 2026-10-17 (outer-pvl) — cycle-1 CONDITIONAL contract (G1-G6); the supplemented plan body now carries the evidence

Parallel strategy: sequential (one opus vc-execute-agent, then one sonnet vc-tester for EVL)
Rationale: signal score 2/7 (S4 phase program, S7 14+ files); dominant signal S7; steps depend on each other (types, detect, analyze). Agent count: 1 execute + 1 tester. Agrees with the plan's Execution Strategy.

Gate: PASS — PVL cycle 2 (after 1 supplement cycle): 0 FAILs, 0 unresolved CONCERNs. All six cycle-1 gaps verified resolved in the plan body against real code.

### Prior gap resolution (verified against real code at HEAD 025d589)

| Gap | Status | Evidence |
|---|---|---|
| G1 `DocFormat` shadow | RESOLVED | `packages/core/src/index.ts:114` still exports adapter `DocFormat` (`format-detect.ts:13` union); plan exports `PackageDocFormat` only (Public Contracts, E6) plus type-level assertion (E6, G1 test). No existing barrel name collides with any of the 25 new package names (grep of `packages/core/src`: 0 hits). |
| G2 detection tie-break and S-11 rule | RESOLVED | Step C6 (a)-(e): earliest-title-line tie-break, tie never `high`, SEC-cover rule to `ppm` at `low`, golden-first tuning of DATA, per-file Known-Gap with backlog stub `intake-local-real-facts`. |
| G3 missing unit and bounded-scan tests | RESOLVED | G18 `package-readiness`, G19 `package-facts` (incl. `extractUsedTerms`), G20 `package-scan-bounded`; all in Blast Radius and Verification Evidence; model file `defined-term-scan-bounded.test.ts` exists. |
| G4 untouched-surface diff too narrow | RESOLVED | Verification row and Exit Gate diff now cover detectors, counsel, memory, contracts, structure, model, graph, findings, llm, adapters, `engine.ts`, `apps`, against the literal `P1_BASE` sha. |
| G5 baseline defense-in-depth and masking note | RESOLVED | E4 and G14 reject a same-package candidate with a differing non-null `firmId`; H1 records that `DocumentRequest.quote` is unmasked and must route through core `maskAndClamp` (`counsel/template-draft.ts:10`, exported from the barrel). |
| G6 blocked-word file name | RESOLVED | File renamed `make-package.ts` (matches `make-docx.ts`, `make-pdf.ts`); `real-facts/*.json` excluded from the drift rebuild (F4, shape check only). |

### Layer 1 and Layer 2 findings

Dimension findings:
- Infra fit: PASS — verified on disk: `CARVE_OUT_RE` and `family` exported from `detectors/undefined-term.ts`, `extractDefinedTerms` in `structure/defined-terms.ts`, `sameDocx` in `scripts/src/fixtures/make-docx.ts`, `sha256Hex` in the barrel, `htmlSamples` helper, `fixtures:check` script; `packages/core/src/package/` does not exist yet (clean create).
- Test coverage: PASS — every owned AC (AC-I4, 5, 6 core, 7, 9, 10-17, 19, 20, AC8) has a named Fully-Automated gate; Step G writes red first; Known-Gap only as a named residual (Hybrid local real facts) with a backlog stub.
- Breaking changes: PASS — frozen contracts v1, snapshot, 13 detectors, `computeGate`, `limits` untouched and gated; barrel change is one appended block; no export collision.
- Security surface: PASS — pure browser-side module; same-firm rule with in-package defense in depth; verbatim-quote check; bounded-scan test; masking hand-off recorded; 0 live model calls (suggester is a seam only).
- Section A (premise check): PASS — runs first and pins literals measured before any build.
- Section B (types, limits, policy): PASS — mechanical.
- Section C (detection): PASS — C6 deterministic tie-break and cover rule; residual risk is real-file accuracy, handled by tune-data-then-Known-Gap.
- Section D (facts, definitions, references): PASS — by-import reuse of the carve-out regex, bounded patterns.
- Section E (terms, coverage, request, baseline, analyze): PASS.
- Section F (fixtures and scripts): PASS — design packages are not committed yet (`git ls-files samples/packages` is empty; two of three have README and answer-key, none has docs); the plan's Step 0 fallback to synthetic Hartwell covers it (accepted, not a gap).
- Section G/H (tests, close): PASS.
- Blast-radius disjointness vs `phase-blast-radius-registry.md`: PASS — unchanged from cycle 1.
- Structural validator (`validate-plan-artifact.mjs`): 0 failures, 0 warnings.

Open gaps: none blocking. Observations (not gaps): A2 says 4 tests for `golden-11-undefined-units`, measured 5 earlier (the gate only requires more than 0); the uncommitted parent-session edits are handled by the Step 0 re-sync.

### Plan updates applied
- None by this agent. The plan body supplement from cycle 1 is what this contract validates.

### Execute-agent instructions
- E1 (Step 0, blocking): do not start until the parent session confirms the demo-readiness fixes are committed; `git status --short` must show no modified tracked file; record the literal 40-char `P1_BASE`. Never stash, checkout, reset or restore.
- E2 (Step 0): `git ls-files samples/packages` is empty now. Re-check; for any design package without committed docs, `answer-key.md` and `README.md`, use the Hartwell fallback and record it in the phase report; `demo-packages.json` then omits that package and sets `primaryDemoId` = `hartwell`.
- E3 (Step A): measure the baseline first; literals in `package-undefined-term-baseline` are measured, never assumed.
- E4 (Step C): write `package-type-detection-golden` first and run over committed real facts; tune DATA only. A tie never yields `high`.
- E5 (Step E6): `PackageDocFormat` only; never export a name that shadows `DocFormat`.
- E6 (Step H2): stage by explicit path; `make-package.ts` and every new path must avoid the three blocked words; use a scratchpad script if a staging command is rejected. Never `git add -A` or `git add .`.
- E7 (Step H1): `DocumentRequest.quote` is stored unmasked; record the Phase 3c masking hand-off in the report.

### Test gates (5-column table; strategy carries only the 3 proving strategies)

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| premise | undefined-term baseline pinned before intake | Fully-Automated | `pnpm --filter @aduin/core test package-undefined-term-baseline` | B |
| AC-I1 core | 12 files, 40 MB, per-file refusal, no side effects | Fully-Automated | `pnpm --filter @aduin/core test package-limits` | B |
| schema | PackageAnalysis schema deep-equals `fixtures/package/schema.v1.json`; `DocFormat` unchanged | Fully-Automated | `pnpm --filter @aduin/core test package-types-contract` | B |
| AC-I4 | type, role, confidence, template reason per file | Fully-Automated | `pnpm --filter @aduin/core test package-detect` | B |
| AC-I5 | type correct on every demo file, no wrong high-confidence value | Fully-Automated | `pnpm --filter @aduin/core test package-type-detection-golden` | B (D for any real file that cannot reach its type) |
| AC-I6 core | readiness: low unconfirmed rows, exactly one to_digitize | Fully-Automated | `pnpm --filter @aduin/core test package-readiness` | B |
| AC-I4/I5 input | facts caps, needsOcr, used terms | Fully-Automated | `pnpm --filter @aduin/core test package-facts` | B |
| AC-I7 | seam only, analyst > high > low > AI | Fully-Automated | `pnpm --filter @aduin/core test package-suggester-seam` | B |
| AC-I9 pure | same firm only, null firm, in-package firm mismatch | Fully-Automated | `pnpm --filter @aduin/core test package-baseline-eligibility` | B |
| AC-I10 | references with verbatim quote and location | Fully-Automated | `pnpm --filter @aduin/core test package-reference-extraction-golden` | B |
| AC-I11 | recall 100% on synthetic package and NGI #5/#6 | Fully-Automated | `pnpm --filter @aduin/core test package-reference-recall-matrix` | B |
| AC-I12 | resolved, not_in_package, unclear, synonyms, override | Fully-Automated | `pnpm --filter @aduin/core test package-reference-resolution-matrix` | B |
| AC-I13 | quotes verbatim, corrupt quote dropped and counted | Fully-Automated | `pnpm --filter @aduin/core test package-quote-verbatim-contract` | B |
| AC-I14/15/16 core | suppress defined terms, keep Stock, unverified without LPA | Fully-Automated | `pnpm --filter @aduin/core test package-crossdoc-terms-golden` | B |
| AC13 base | #11 Units still flagged | Fully-Automated | `pnpm --filter @aduin/core test golden-11-undefined-units` | A |
| AC-I17 | coverage per group, exact line text | Fully-Automated | `pnpm --filter @aduin/core test package-coverage-matrix` | B |
| AC-I19 | missing sub blocks, LPA/PPM warn, policy is data | Fully-Automated | `pnpm --filter @aduin/core test package-gate-policy-matrix` | B |
| AC22 base | `computeGate` unchanged | Fully-Automated | `pnpm --filter @aduin/core test gate-state-matrix` | A |
| AC-I20 core, T3 | one request per missing label, deduped | Fully-Automated | `pnpm --filter @aduin/core test package-request` | B |
| AC8 | byte-equal, shuffled order identical | Fully-Automated | `pnpm --filter @aduin/core test package-determinism` and `pnpm --filter @aduin/core test determinism` | B / A |
| robustness | no catastrophic regex on hostile input | Fully-Automated | `pnpm --filter @aduin/core test package-scan-bounded` | B |
| frozen v1 | contracts snapshot and detectors untouched | Fully-Automated | `pnpm --filter @aduin/core test contracts` plus `git diff --quiet P1_BASE --` over the Exit Gate path set | A |
| fixtures | generated fixtures reproduce | Fully-Automated | `pnpm --filter @aduin/scripts test package-fixtures` and `pnpm --filter @aduin/scripts fixtures:check` | B |
| AC-I5 local | real local files still match committed facts | Hybrid | `PACKAGE_LOCAL=1 pnpm --filter @aduin/core test package-realfacts-local` (precondition: `_full-prospectus` present locally; never a CI gate) | D |

Failing stubs (Fully-Automated rows only, red first, consumed by execute-agent): for each row above, in the file named by its proving test, `test("should <behavior cell>", () => { throw new Error("NOT IMPLEMENTED — TDD stub: <behavior cell>") })`. The Hybrid row gets none.

Regression suite (after all steps): `pnpm --filter @aduin/core test`, `pnpm --filter @aduin/scripts test`, `pnpm typecheck`, `pnpm lint`, `pnpm guard:cf`, `pnpm secrets:scan`, all exit 0; one token per call, no `--`, confirm more than 0 tests ran.

What This Coverage Does NOT Prove:
- Detection goldens prove the rules on committed facts and four to five real files only, not accuracy on unseen subscription documents or non-English files.
- Reference recall proves seeded and NGI #5/#6 phrases, not arbitrary drafting styles; the ground truth shares its exclusion list with the extractor.
- Suppression and unverified-term logic is proven on a synthetic LPA excerpt, not on a real LPA or a real multi-document package.
- Same-firm eligibility is proven as a pure function; the browser store, Dexie persistence and UI (Phases 2 and 3) are not exercised here.
- Determinism is proven for this module in one Node process, not for the browser worker path.
- Quote masking at render and export is not proven here (Phase 3c).
- Bounded-scan timing proves hostile-input safety on this machine's time bound, not worst-case browser performance.
- The Hybrid local-facts check proves nothing in CI.

### High-risk pack
Required: no. The module is pure and browser-side: no auth, billing, schema migration, public API, deploy or secret surface. The cross-firm baseline rule is a trust-boundary rule covered by the Fully-Automated `package-baseline-eligibility` gate and the Phase 2 e2e `intake-baseline-role-same-firm`; a manual-first pack is recommended at Phase 2 EVL, not here.

### Backlog artifacts to create during durable capture
- `process/features/fund-package-intake/backlog/intake-llm-doc-type-suggest_NOTE_17-10-26.md` — LLM suggester task (seam only ships; needs-live-provider).
- `process/features/fund-package-intake/backlog/intake-local-real-facts_NOTE_17-10-26.md` — only if a local real file is missing or misses its authored type.

### Known gaps on record
- Live suggester behavior: none shipped (T2); seam proven by a fake only; residual with backlog stub (named residual, every developed behavior has a Fully-Automated gate; vacuous-green ban satisfied).
- AC-I5 for local-only real files is Hybrid (opt-in); CI proves committed facts only.

No `## Autonomous Goal Block` is written to this phase plan: BRANCH B — the umbrella `intake-mvp-umbrella_PLAN_17-10-26.md` carries `## Stable Program Goal`, which governs.

Accepted by: n/a — Gate is PASS; no concern accepted or deferred beyond the named residual Known-Gaps above.
