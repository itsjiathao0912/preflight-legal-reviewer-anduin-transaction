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

Phase 1 builds the whole intake brain as pure, deterministic TypeScript in `packages/core/src/package/` (new folder; the frozen v1 contracts, `computeGate` and its matrix are NOT edited; no new detector or issue class is added; exactly two existing modules are extended by the T14 scope addition, see Step B0). It contains: document type and role detection with confidence and a fixed reason; a lightweight "package facts" reader (title lines, headings, definitions) used for reference documents; external-reference extraction with verbatim, location-bearing quotes; reference resolution against package files with a synonym table; cross-document defined-term logic (definitions from reference documents, suppression of the offering-noun `undefined-term` finding when the package defines the term, an "unverified" list otherwise); coverage per check group as data; gate policy for missing documents as data (`DEFAULT_PACKAGE_POLICY`, `packageGateReasons`); the deduplicated GP document request list; and same-firm baseline eligibility (`eligibleBaselines`).

Phase 1 also produces every fixture the later phases consume: a synthetic Hartwell and Crane package (Fund III subscription agreement, Northgate LPA definitions excerpt as DOCX, Fund II prior subscription agreement), authored expectations, the `PackageAnalysis` schema snapshot, a demo-package manifest, and short committed "real facts" for the local-only real documents so goldens run in CI without them.

Why first: Phases 2 and 3 only wire this module into the browser worker, the store and the screens. No UI, no worker, no Dexie in this phase.

**Premise check first (INNOVATE finding 1):** the `undefined-term` detector only fires on offering nouns (Units, Interests, Stock). The SPEC premise "dozens of false undefined-term errors" is therefore re-scoped to: LISTING ("defined in LPA" / "unverified"), coverage counts, and suppression of the offering-noun finding when the package defines it. Step A baselines the existing goldens before anything is built so this is measured, not assumed.

**T14 scope addition (parent-approved, 17-10-26): structure heading forms and conditional targets (Step B0).** Real agreements write headings as `Section 4.`, `SECTION 4`, `Article 4.`, `Article IV.`, `ARTICLE 4` (with or without a title), and the structurer only knows `4. Title`; the design packages 02 and 03 use `Section N.` headings and package 03 has a conditional that points at `Question 15` while package 01 points at `Annex F`. Without B0 the engine would find no sections in those packages (weak reference, conditional and investor-path checks) and the LPA documents use `Article` headings. B0 extends the heading recognizer and the conditional target resolver only; "13 detectors / 15 issue classes" stays true. Details, allow-list, tests and the corpus-regression table are in Step B0, Step G (G22-G25) and the Acceptance rows AC-S1..AC-S4.

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
| AC-S1 (T14) | The structurer accepts `Section N.`, `SECTION N`, `Article N.`, `Article I.` (roman), `ARTICLE N`, each with or without a title, and rejects prose such as "Section 3 of the Act" mid-sentence | `structure-heading-forms` unit (all forms, roman I..XX, titled and bare, negatives) | Fully-Automated |
| AC-S2 (T14) | `broken-conditional` resolves `Annex X` and `Question N` targets: "complete Annex F" with no Annex F is a finding; "skip to Question 15" with 14 questions is a finding; existing targets stay silent; no structural evidence stays `uncertain` | `broken-conditional-annex-question` unit | Fully-Automated |
| AC-S3 (T14) | Design-package DOCX goldens encode each answer-key should-catch and should-not-catch for the heading, Annex and Question cases (LB2 offshore agreement, RR1 agreement, NG3 and RR1 LPA definitions) | `package-design-goldens` (copies under `fixtures/package/design/**`) | Fully-Automated |
| AC-S4 (T14) | The existing 12 HTML samples (and the 13th appendix sample where it is in the corpus) show no false-positive flood; every changed golden count is explained | `package-design-goldens` corpus-regression block plus the full core suite and the explanation table in the Phase 1 report | Fully-Automated |

Non-criteria guarded here: frozen contracts v1 and the contracts snapshot stay byte-identical; `packages/core/src/counsel/**`, `packages/core/src/contracts/**` untouched; in `packages/core/src/detectors/**` and `packages/core/src/structure/**` only the five T14 allow-list files change (Step B0, Blast Radius); the registry and the other detectors stay byte-identical.

## Entry Gate

- No modified tracked non-process file; record `git rev-parse HEAD` as `P1_BASE` in the phase report (later phases diff against it). `P1_BASE` is the literal 40-character sha recorded by the Step 0 re-sync below, never the symbolic `HEAD`.
- **Step 0 re-sync (BLOCKING; runs before Step A).** The parent demo-readiness fixes are DEPLOYED: code commit `0a67dc4`, process commit `faff59c`, live version `47d98295-c583-4dc0-9f96-f9e161c8cf35` (fallback `23612b12-51c7-4d75-a324-f4f2f6392ba8`). There is no wait. Proceed when (1) `git merge-base --is-ancestor 0a67dc4 HEAD` holds and (2) `git status --short` shows no modified tracked non-process file (modified process plan files are the orchestrator's and are expected; never stash, checkout, reset or restore another actor's edits; if a tracked source file is modified, STOP and report). Then: (3) re-read at HEAD the files the parent changed (`detectors/util.ts`, `ref-label-coherence.ts`, `ref-this-section.ts`, the two goldens `golden-01-this-section-11` and `golden-03-05-swapped-part-b-refs`); (4) record `P1_BASE` = the literal 40-char `git rev-parse HEAD` sha at start (never the symbolic `HEAD`; every `P1_BASE` diff gate uses that literal) and the rollback target `47d98295-c583-4dc0-9f96-f9e161c8cf35` in the phase report; (5) re-measure the baseline counts quoted in this plan (core 2914, web 223, preview 173 plus 1 skip).
- **Step 0 rebase note (T14 item 5).** The parent commit `0a67dc4` (demo readiness; now on `main`, tree clean at hand-off) changed `packages/core/src/detectors/util.ts` (new `refRoutingContext` and `refSeverity`: a broken cross-reference is `critical` in an instructions scope, an answer option or a conditional block, else `high`), `ref-label-coherence.ts`, `ref-this-section.ts` and goldens `golden-01-this-section-11` and `golden-03-05-swapped-part-b-refs`. Assumption updates for this phase: (a) `refRoutingContext` reads `g.structure.conditionals`, `optionGroups` and scope kind, so B0 heading changes can move a block into or out of an `instructions` scope and flip a `high` to `critical`: those are expected goldens changes to explain; (b) no B0 code edits `util.ts`; (c) `P1_BASE` is the HEAD sha recorded at start (descends from `0a67dc4`); keep the Step 0 re-sync, and re-read `util.ts`, `ref-label-coherence.ts`, `ref-this-section.ts` and the two goldens at that sha before B0.
- **Design packages (Step 0, orchestrator addition B).** The design session produces fictional packages under `samples/packages/{01-northgate-infrastructure-iii,02-lotus-bay-asia-growth-ii,03-redwood-ridge-credit-i}/` (each: `docs/`, `README.md`, `answer-key.md` with seeded defects, exact quotes and AC-I* mapping, `_build/`). They are READ-ONLY for this program. Confirm they are committed (`git ls-files samples/packages` lists the docs, README.md and answer-key.md of each) and read each `answer-key.md`. If any is not committed by then, fall back to the synthetic Hartwell builder alone for that package, record the fallback in the phase report, and change nothing else (Hartwell remains the deterministic fixture). The design packages are committed (c1c5fe0; docs, `README.md`, `answer-key.md` present, verified at the T14 supplement); the B0 goldens use `02-lotus-bay-asia-growth-ii/docs/01-LB2-Subscription-Agreement-Offshore-v2.docx`, `03-redwood-ridge-credit-i/docs/01-RR1-Subscription-Agreement.docx` and the LPA definitions files `01-northgate-infrastructure-iii/docs/02-NG3-LPA-Definitions-and-Key-Terms.docx` and `03-redwood-ridge-credit-i/docs/02-RR1-LPA-Definitions.docx`.
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
Modify (T14, allow-list; nothing else under `detectors/` or `structure/`): `packages/core/src/structure/headings.ts` (heading recognizer `sectionCandidate`, `SECTION_RE`), `packages/core/src/structure/structurer.ts` (only if the accept rules need roman or Article handling; otherwise untouched), `packages/core/src/structure/conditionals.ts` (target extraction: `TARGET_RE`, `MORE_TARGETS_RE`, the `targets` strings), `packages/core/src/detectors/flow.ts` (target resolution: `parseTarget`, `conditionalTargets`, `checkTarget`, shared with `unreachable-flow` and the investor-path extractors) and `packages/core/src/detectors/broken-conditional.ts` (consumer; edit only if the finding text needs a target kind word). Create (tests): see section "Test files".
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
- T14 contract check (verified at PLAN time): heading forms do not touch frozen contracts. `Section.number` stays a string, blocks stay kind `heading`, `Conditional.targets` stays `string[]`, and `section_path` strings in findings are the only exported trace; no new `BlockKind`, issue class or schema field. If EXECUTE finds that a contract change would be required (for example a new block kind), STOP and report NEEDS_CONTEXT; never edit `packages/core/src/contracts/**`.
- Unchanged: frozen contracts v1, `packages/core/test/__snapshots__/contracts.json-schema.snap`, the 13 detectors (two of them, `broken-conditional` and through `flow.ts` the flow consumers, extended without a new issue class) and `detectors/registry.ts`, `computeGate` and its matrix, taxonomy (15 issue classes), `limits` in `config/limits.ts`, the Finding schema, fingerprints and memory labels.

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

T14 allow-list (the ONLY edits allowed under detectors and structure): `packages/core/src/structure/headings.ts`, `packages/core/src/structure/structurer.ts` (only if needed), `packages/core/src/structure/conditionals.ts`, `packages/core/src/detectors/flow.ts`, `packages/core/src/detectors/broken-conditional.ts`. New tests: `packages/core/test/unit/structure-heading-forms.test.ts`, `packages/core/test/unit/broken-conditional-annex-question.test.ts`, `packages/core/test/golden/package-design-goldens.test.ts`; existing goldens or unit tests whose literal counts legitimately change are edited only with an entry in the explanation table (Step B0). Registry rows: see `phase-blast-radius-registry.md` Phase 1 revision note.

Read-only here (touch = BLOCKED): the rest of `packages/core/src/detectors/**` (including `util.ts`, `registry.ts`), `packages/core/src/counsel/**`, `packages/core/src/contracts/**`, `packages/core/src/memory/**`, the rest of `packages/core/src/structure/**`, `packages/core/src/model/**`, `apps/**`.

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
- [ ] A2. Run `pnpm --filter @aduin/core test golden-11-undefined-units` (exit 0, more than 0 tests; 5 tests at HEAD) and `pnpm --filter @aduin/core typecheck` (exit 0).
- [ ] A3. Create `packages/core/test/unit/package-undefined-term-baseline.test.ts`: for each of the 12 HTML samples (use `htmlSamples()` and `analyzed(n)` from `packages/core/test/helpers/samples.ts`) pin, as literal expectations measured by running the engine now, the count and the sorted `used_term` list of findings with `detector_id` `undefined-term`, and the count of `defined_term_issue` findings by `detector_id`. Measure first, then write the literals.
- [ ] A4. Record the measured table in the phase report under `## Premise Check`. Expected from `golden-11-undefined-units`: `undefined-term` fires only on #11 ("Units") and not on #5/#6. If the table shows more samples with `undefined-term` findings, record each as a RESCOPE NOTE (ACs stay listing + suppression + coverage per INNOVATE finding 1); do not add a generic undefined-term rule.
- [ ] A5. Run `pnpm --filter @aduin/core test package-undefined-term-baseline` (exit 0) and commit `test: pin undefined-term baseline before intake`.

### Step B0 — Structure heading forms and conditional targets (T14; after A5, before any detection work)

- [ ] B0.1. Re-read at `P1_BASE`: `packages/core/src/structure/headings.ts` (`SECTION_RE = /^\s*(\d{1,2}[A-Z]?)\.(?:\s+(.*))?$/`, `sectionCandidate`, `titleIsHeading`, `HEADING_LIMITS`), `packages/core/src/structure/structurer.ts` (accept rules around `sectionCandidate`: next number, letter suffix, restatement, gap up to 3, reset to 1), `packages/core/src/structure/numbering-scopes.ts` (`scopeOpener`, read-only), `packages/core/src/structure/conditionals.ts`, `packages/core/src/detectors/flow.ts`, `packages/core/src/detectors/broken-conditional.ts`, `packages/core/src/detectors/util.ts` (read-only, parent change 0a67dc4).
- [ ] B0.2. Write `packages/core/test/unit/structure-heading-forms.test.ts` and `packages/core/test/unit/broken-conditional-annex-question.test.ts` FIRST and run both red (scenarios in G22 and G23).
- [ ] B0.3. `headings.ts` `sectionCandidate`: accept keyword-led forms `Section N.` / `SECTION N` / `Section N` followed by a title, `Article N.` / `ARTICLE N` / `ARTICLE N TITLE`, and roman `Article I.` .. `Article XX.` (head word case-insensitive; number grammar `\d{1,2}[A-Z]?` or UPPERCASE roman `[IVXL]{1,6}` only). Qualification rule (PVL gap 1; measured: LB2 v2, RR1 agreement and RR1 LPA headings are neither bold nor caps): a keyword-led line qualifies on THREE conditions only: the keyword, the number grammar, and a bounded title: total line at most 120 characters, no sentence-final period after the title (the period directly after the number, `Section 4.`, is fine), and the title text is not a lowercase-led sentence. Bold or caps are NOT required for keyword-led forms (this is a new form with its own rule; the existing `N. Title` bold-or-caps rule and `Part` rules stay byte-identical, so no threshold is loosened). A bare `Section 4.` or `Article IV` line (title on the next line) qualifies the same way. Roman numerals convert to an integer for `num`; the `number` string stays the arabic string so `Section 4` and `Article IV` references resolve consistently (single documented choice, recorded in the report). Negatives (must NOT become headings or sections): a line that begins mid-sentence ("Section 3 of the Act applies ..."), `Section 4975 of the Code`, a lowercase sentence after the number, a statutory cite ("Section 3(42) of ERISA"), `Section N:` instruction lines (sample #9 OCR has 8), lowercase or mixed-case roman (`Article iv`), `Article IV of the Agreement ...` prose, and dotted decimals (`Section 1.1 Title.`, `1.1 Title`). The new regex is a module-level `export const` so `redos.test.ts` collects it, plus the bounded hostile-input test in G22.
- [ ] B0.4. `structurer.ts`: edit ONLY if the accept rules cannot take the new candidates unchanged (for example roman sequences must follow I, II, III with the same gap and restatement rules). If edited, the diff is limited to accept/number handling, no new block kind, no new scope kind.
- [ ] B0.5. `conditionals.ts` and `flow.ts`: extend target extraction and resolution to `Annex X` (single letter or number label) and `Question N`. NO scope kind is used or added: there is no annex scope kind (`ScopeKind` = `body|instructions|terms|signature|appendix|part`), and `numbering-scopes.ts` and `structure/types.ts` stay OFF the allow-list (the allow-list is unchanged at five files). Resolution is from block text (PVL gap 2): annex labels = blocks (any kind) whose text matches `^Annex <label>` at block start, plus `appendix` scope titles; question numbers = blocks whose text matches `^Question <N>` inside the enclosing annex (the nearest preceding `^Annex <label>` block; if none, the whole document), numbered continuously across Parts (RR1 numbers questions 1-14 across Parts 1-3; never per Part). `TARGET_RE`/`MORE_TARGETS_RE` gain the two heads; `parseTarget` returns a typed target (`annex` label, `question` number); in `checkTarget` the Annex and Question branches run BEFORE the bare-Part branch (which reads `t.parts[0]!`, undefined for these targets). `Annex X` is `missing` when at least one `^Annex` label exists in the document and X is not among them, `found` when it is, `uncertain` when the document has no annex label at all (the Harbourline W-8 guide case). `Question N` is `missing` only when at least one `^Question` block exists in the enclosing annex and the highest number is below N, `found` when N exists, else `uncertain`. Uncertain never produces a finding. One shared exported helper in `flow.ts` (for example `annexLabels(blocks)` and `questionNumbers(blocks, annexLabel)`) feeds D2 `scopeLabels` and the D3 internal-versus-external exclusion, so intake and the detector agree; the package module imports it and never re-implements it. `Section`/`Part` behavior byte-identical (existing `flow` and conditional tests unchanged). If EXECUTE finds `numbering-scopes.ts` or `structure/types.ts` unavoidable, STOP and report NEEDS_CONTEXT (the orchestrator would amend the allow-list, the registry and the gates together); never edit them unilaterally.
- [ ] B0.6. `broken-conditional.ts`: edit only if the explanation or `interpretations` text needs the target kind (a one-line wording generalization); detector id, class, severity (critical) and `patternKey` unchanged; no new issue class (taxonomy stays 15). `unreachable-flow` and the investor-path extractors consume `flow.ts`; their outputs may legitimately gain results (the RR1 benefit-plan route is also an `investor_path_dead_end` per the answer key); record every such change in the explanation table.
- [ ] B0.7. Corpus regression (run before and after B0.3-B0.6 on the same engine): the 12 HTML samples via `htmlSamples()` and `analyzed(n)` (and sample #13 / #9 where already in the core goldens). Produce the EXPLANATION TABLE in the Phase 1 report (`## T14 Corpus Regression`): one row per golden or pinned count that changed (golden/test name, old count, new count, reason). Goldens that may change and therefore need a row if they do: `golden-01-this-section-11`, `golden-03-05-swapped-part-b-refs`, `golden-heading-extraction-03-05`, `golden-09-ocr-footnote2`, `golden-11-undefined-units`, `statutory-cite-not-flagged`, `package-undefined-term-baseline` (A3 literals), the investor-path and flow tests (`investor/paths.ts`: a `complete Annex F` for a Benefit Plan Investor can create a `part-c` gap and flip `uncertain`), `graph-extraction-fixtures` (`target:` edges in `graph/graph.ts`), `structure-view-build` (`targetFound`, `issue`, target text in `structure-view/build.ts`), `outline/logic-outline-export-contents` (targets in `outline/build.ts`), `redos`, `corpus`, `golden-05-06-drift`, the tests that use the `conditionals.html` fixture, `determinism`, the engine seeded and property corpora that pin per-sample finding counts, the scripts and web specs that pin per-sample counts (web specs are read-only here: if one would change, record it for Phase 2 instead of editing; sample #13 is one of the 12 HTML samples, not a 13th file). Each of these tests is run before and after, and every changed literal gets an explanation-table row. A new finding on a corpus sample is acceptable only with a reason in the table (real heading now recognized or real Annex/Question target missing); a silent increase, or more than 3 new findings on any single sample, or any new finding classified as noise, STOPS the step: tighten the pattern, never loosen a threshold. Nothing is hand-edited to green.
- [ ] B0.8. Run `pnpm --filter @aduin/core test structure-heading-forms`, `broken-conditional-annex-question`, `contracts`, `determinism` (one token per call), `pnpm --filter @aduin/core typecheck`; then `git diff --name-only P1_BASE -- packages/core/src/detectors packages/core/src/structure` must list only the five allow-list files (at B0 time the full `packages/core/src` set check below applies from Step E6 on). Commit `feat: structurer accepts Section and Article headings; broken-conditional resolves Annex and Question targets` with explicit paths.

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
- [ ] G22. `structure-heading-forms` (AC-S1, unit): every form (`Section 4. Title`, `SECTION 4`, `Section 4`, `Article 4.`, `ARTICLE 4 DEFINITIONS`, `Article I.`, `Article XII. Title`), roman I..XX conversion, NON-bold and NON-caps keyword-led titles still accepted (gap 1), accept rules (next number, letter suffix, gap); negatives that must not become headings: "Section 3 of the Act applies" mid-sentence, "Section 4975 of the Code", "Section 3(42) of ERISA", lowercase sentence after the number, `Section N: <sentence>.` instruction lines, uppercase-only check (lowercase `Article iv`), `Article IV of the Agreement ...` prose, dotted decimals (`Section 1.1 Title.`, `1.1 Title`), a title over 120 chars, a title with a sentence-final period; `4. Title` behavior unchanged. Regex-time bound: the exported heading regex runs over hostile input (a 100 000-character line of digits, of `Section ` repeats, and of mixed roman letters) under a fixed time bound (modeled on `test/unit/defined-term-scan-bounded.test.ts`), and `redos.test.ts` now collects it.
- [ ] G23. `broken-conditional-annex-question` (AC-S2, unit): "If the Investor is a Benefit Plan Investor, complete Annex F." with and without an Annex F scope; "If you answered Yes to Question 6, skip to Question 15." with 14 and with 15 questions; Section/Part targets unchanged; document with no annex or question evidence gives no finding; one finding per instruction; severity critical.
- [ ] G24. `packages/core/test/golden/package-design-goldens.test.ts` (AC-S3, AC-S4): reads the committed copies under `fixtures/package/design/**` (never `samples/packages/**`) through the DOCX adapter and the engine; encodes from each package `answer-key.md` and `samples/packages/README.md`. Counts are measured at B0.7 and written as literals (measure first). LB2 offshore v2 (`01-LB2-Subscription-Agreement-Offshore-v2.docx`): `Section N.` headings give sections found (count asserted; 0 today), "Annex C" mentions are NOT internal sections and produce no new finding (no conditional targets Annex there), E8 placeholder and E9 sensitive data still caught. RR1 agreement (`01-RR1-Subscription-Agreement.docx`): sections found (count asserted); F1 `skip to Question 15` is a `broken-conditional` finding (should-catch) and the 14-question list does not flag other questions (should-not-catch); F7, F8, F10 still found; every other "Section N.N" cross-reference stays silent except F3 (the `Section 8.4` coherence case is a known engine gap: measure it, record it, do NOT assert it silent). NG3 and RR1 LPA definitions files (`02-NG3-LPA-Definitions-and-Key-Terms.docx`, `02-RR1-LPA-Definitions.docx`): section counts asserted (NG3 LPA 9 Articles, RR1 LPA 1 Article) and the measured per-detector counts pinned (today 3 defined-term-issue findings for NG3 LPA and 14 for RR1 LPA, unrelated to B0; NOT asserted zero); the RR1 LPA is an Article I extract whose cross-references to later Articles (`Section 4.6`) may become broken references once Article I is recognized: pin whatever is measured and explain it. NG3 sub agreement (`01-NG3-Subscription-Agreement.docx`): D6 `complete Annex F` is now a `broken-conditional` finding (critical), D1-D5 and D10 remain as before (15 sections, `N. Title`). NG2 baseline (the Fund II prior subscription agreement under `fixtures/package/design/northgate-iii/`): NG2 gains the same Annex F finding (answer key: 5 findings on the baseline today, so 6 after); add an NG2 row and an explanation-table entry (NG2-annexF). Corpus-regression block: the 12 HTML sample corpus finding counts equal the post-B0.7 table with no row unexplained.
- [ ] G25. Add the new test tokens to the Step H1 run list: `structure-heading-forms`, `broken-conditional-annex-question`, `package-design-goldens` (one token per call, more than 0 tests each).


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
| `pnpm --filter @aduin/core test structure-heading-forms` | Fully-Automated | AC-S1 (T14) |
| `pnpm --filter @aduin/core test broken-conditional-annex-question` | Fully-Automated | AC-S2 (T14) |
| `pnpm --filter @aduin/core test package-design-goldens` | Fully-Automated | AC-S3, AC-S4 (T14) |
| `pnpm --filter @aduin/core test contracts` and `git diff --quiet P1_BASE -- packages/core/test/__snapshots__ packages/core/src/contracts` | Fully-Automated | frozen contracts v1 unchanged |
| `git diff --name-only P1_BASE -- packages/core/src` (P1_BASE = the literal sha from Step 0) must list exactly the five T14 allow-list files, `packages/core/src/index.ts` and files under `packages/core/src/package/`, nothing else; plus `git diff --quiet P1_BASE -- apps` | Fully-Automated | untouched surface: every other core directory (detectors, counsel, memory, contracts, structure, model, graph, findings, llm, adapters, investor, structure-view, outline, diff, session, ocr, config, engine) and apps unchanged (frozen v1; proves nothing about the allow-list files' content, which G22-G24 prove) |
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
git diff --name-only P1_BASE -- packages/core/src
# Expected: exactly the five allow-list files (headings.ts, structurer.ts if edited, conditionals.ts, flow.ts, broken-conditional.ts), packages/core/src/index.ts and packages/core/src/package/**; then: git diff --quiet P1_BASE -- apps (exit 0)
```

- All checklist items checked; premise table recorded; phase report written to the report destination; execution commits made with explicit paths.

## Risks and Mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| Wrong high-confidence type | High | Conservative threshold (score ≥ 3 and margin ≥ 2); two-subscription roles always `low`; golden on committed real facts; T1 ruling wording |
| Real-file score ties (NGI #5/#6) and SEC cover boilerplate with no type phrase | Med | Step C6: earliest-title-line tie-break, tie never `high`, SEC-cover rule to `ppm` at `low`, golden run first on committed real facts; Known-Gap with backlog stub for any remaining miss |
| Reference recall below 100% on NGI #5/#6 | Med | Seeded matrix with independent noun-count ground truth; tune pattern DATA, not code paths; if a rule cannot be tuned, record a Known-Gap with a backlog stub and keep AC-I11 CONDITIONAL (no LLM task is added without an orchestrator ruling; adding one is a hard stop because it is needs-live-provider) |
| T14 heading/target change floods the corpus with new findings or moves goldens | High | Step B0.7 before/after corpus table with a reason per changed count, red-first tests with negatives, stop rule (more than 3 new findings on one sample or any noise finding), patterns tightened never thresholds loosened; five-file allow-list gate |
| T14 edits shared `flow.ts` and so also change `unreachable-flow` and investor-path results | Med | Explanation table covers those detectors; Section/Part behavior pinned byte-identical by the existing tests |
| Keyword-led heading rule drops bold/caps and so over-accepts prose lines | Med | Bounded rule (keyword, number grammar, title at most 120 chars, no final period, not lowercase-led) plus the G22 negatives (`Section N:` lines, lowercase roman, `Article IV of the Agreement` prose, dotted decimals); corpus has 0 keyword-led lines so the 12 samples cannot regress; B0.7 stop rule |
| Annex/Question resolution from block text reads wrong evidence (per-Part numbering, no annex labels) | Med | Enclosing-annex scoping, continuous numbering across Parts, `uncertain` when no label or question evidence; one shared helper in `flow.ts` for detector and intake; no scope kind or `numbering-scopes.ts` edit (allow-list stays five files) |
| Barrel export-name collision | Low | Typecheck after the barrel append; rename on the package side |
| Real documents missing locally | Low | Committed facts are the CI proof; missing local files recorded as Known-Gap with backlog stub |
| Catastrophic regex | Med | Bounded quantifiers, linear-time patterns, per-block caps; a `defined-term-scan-bounded` style test for references |

## Rollback

All changes are additive files plus one appended barrel block and two script keys, plus the T14 edits to five existing core files (each in its own commit, so `git revert` of that commit alone restores the previous heading and conditional behavior). Roll back by reverting the phase commits (`git revert <sha>`); nothing in later phases exists yet. No data migration, no deploy.

## Blockers That Would Justify BLOCKED Status

- Step A shows the premise is wrong in a way that changes ACs (surface to the orchestrator as RESCOPE; do not widen detectors).
- A required change in a read-only path (detectors or structure files outside the five-file T14 allow-list, contracts, counsel) turns out to be unavoidable, or heading forms would require a frozen contract change (NEEDS_CONTEXT).
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
- Last completed step: not started (PVL supplement cycle applied for gaps 1-7; re-validate from V1 next)
- Validate-contract status: written 2026-10-17 (Gate: PASS, inner-pvl: phase-1, pass 2 after the C1-C7 supplement; residuals recorded as known-gaps with backlog stubs)
- Next step: spawn vc-execute-agent (opus) with this exact plan path, the validate-contract (this plan, `## Validate Contract`) and Step 0 then Step A first; emit the /goal block (BRANCH B: umbrella governs) before EXECUTE.
- Validators for the plan artifact: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this plan>` and `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <this plan>`.
- Next instruction: ENTER VALIDATE MODE for this plan, then ENTER EXECUTE MODE only after `Gate: PASS`.

## Inner Loop Refresh Note: 2026-10-17 — changed sections: Overview, Acceptance Criteria (AC-S1..AC-S4), Entry Gate (rebase note), Touchpoints, Public Contracts, Blast Radius, Implementation Checklist (new Step B0, G22-G25), Verification Evidence, Exit Gate, Risks, Rollback, Blockers, Resume. Invalidates prior validate-contract.

Written after the 2026-10-17 validate-contract (same calendar day, later in time; the refresh follows that contract and a V1 date check must treat it as newer). Reason: parent-approved T14 scope addition (structure heading forms plus Annex/Question conditional targets, design-package DOCX goldens, corpus regression) and rebase onto parent commit 0a67dc4.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: inner-pvl: phase-1
supersedes: 2026-10-17 (inner-pvl: phase-1) — inner PVL pass 1 (Gate: CONDITIONAL, concerns C1-C7); the plan body was supplemented for C1-C7 and this re-validation from V1 has current evidence against HEAD 6893bca (code at 0a67dc4)

Parallel strategy: sequential (one opus vc-execute-agent, then one sonnet vc-tester for EVL)
Rationale: signal score 2/7 (S4 phase program, S7 14+ new files); dominant signal S7; B0 edits five shared core files and the new module imports them, so one author keeps order (B0 before B, types before detect before analyze). Agent count: 1 execute + 1 tester. Agrees with the plan's Execution Strategy.

Gate: PASS — inner PVL pass 2 (re-validation from V1 after SUPPLEMENT_APPLIED): 0 FAILs, 0 open CONCERNs. All seven prior concerns (C1-C7) are resolved in the plan body and each was re-checked against real code at HEAD; three low-severity execute-agent notes (E8-E10) are carried as instructions, not gaps. Named residuals are Known-Gaps with backlog stubs; every developed behavior has a Fully-Automated gate.

### Resolution of the prior concerns (re-verified at HEAD, read-only probes in the session scratchpad)

- C1 keyword-led heading rule: RESOLVED. B0.3 now qualifies `Section N.` / `Article N|roman` on keyword, number grammar and a bounded title (120 chars, no final period, not a lowercase sentence), with no bold or caps requirement; `N. Title` and `Part` rules stay byte-identical. Measured at HEAD: LB2 v2 (15 keyword-led lines), RR1 agreement (13) and RR1 LPA headings are `bold:false caps:false` (only the NG3 LPA `Article` lines are bold), so the old rule would give 0 sections; HEAD gives 0 sections for LB2 v2, RR1 agreement, both LPAs; NG3 agreement 15 and NG2 14 (`N. Title`).
- C2 Annex/Question from block text: RESOLVED. `ScopeKind` is `body|instructions|terms|signature|appendix|part` (no annex kind); the plan now resolves from `^Annex <label>` and `^Question <N>` block text with a shared `flow.ts` helper and keeps `numbering-scopes.ts` and `structure/types.ts` off the allow-list. Measured: RR1 has 14 `paragraph` Question blocks across Parts 1-3 and 4 Annex blocks (A-D); sample #12 has `Annex A:` .. `Annex E:` blocks (so `complete ... Annex D` stays silent); Harbourline W-8 guide has no `^Annex` block (stays `uncertain`); LB2 v2 has annex blocks A, B, D, E and no Annex conditional (its "Annex C" mentions are not conditionals). The real RR1 sentence `If you answered Yes to Question 6 (Benefit Plan Investor), skip to Question 15.` sits within `VERB_WINDOW` 160 and `TARGET_WINDOW` 80, so adding the two heads to `TARGET_RE` is sufficient. `checkTarget` bare-Part branch reads `t.parts[0]!`, so the Annex and Question branches must run first (written in B0.5).
- C3 conditional consumers: RESOLVED. B0.7 now lists `graph-extraction-fixtures`, `structure-view-build`, `outline/logic-outline-export-contents`, `redos`, `corpus`, `golden-05-06-drift`, `conditionals.html` users, investor-path tests and `determinism`. All named test files exist at HEAD (`test/unit/graph-extraction-fixtures`, `structure-view-build`, `test/unit/outline/logic-outline-export-contents`, `test/security/redos`, `test/corpus/corpus`, `test/golden/diff/golden-05-06-drift`, `test/fixtures/conditionals.html`).
- C4 G24 counts and NG2: RESOLVED. Section counts and measured per-detector counts replace "zero findings"; measured again at HEAD: NG3 LPA 3 and RR1 LPA 14 `defined-term-issues`, NG2 baseline 5 findings (plan adds the NG2 Annex F row and the NG2-annexF explanation entry), NG3 agreement 6 findings. The F3 `Section 8.4` coherence case is pinned as measured, not asserted silent.
- C5 diff gate path set: RESOLVED. The gate is `git diff --name-only P1_BASE -- packages/core/src` and must list exactly the five allow-list files, `src/index.ts` and `src/package/**`, plus `git diff --quiet P1_BASE -- apps`.
- C6 entry gate: RESOLVED. Step 0 uses `git merge-base --is-ancestor 0a67dc4 HEAD` (probe: holds) and "no modified tracked non-process file" (probe: only process plan files modified; `.DS_Store` is untracked), records the literal 40-char `P1_BASE` and the rollback target `47d98295-c583-4dc0-9f96-f9e161c8cf35`.
- C7 G22 negatives and regex-time bound: RESOLVED. G22 lists `Section N:` lines, lowercase roman, `Article IV of the Agreement` prose, dotted decimals (`Section 1.1 Title.` is real: the NG3 LPA has dozens of such lines), title over 120 chars, title with final period, plus a hostile-input bound modeled on `test/unit/defined-term-scan-bounded.test.ts` (exists).

### Other checks

- Baseline: `pnpm --filter @aduin/core test golden-11-undefined-units` = 5 tests green (re-run in this pass); full-suite baseline 2914 measured in the previous pass, tree unchanged in core since (HEAD moved by docs-only commits).
- Names the plan relies on exist: `sectionCandidate`, private `SECTION_RE` (headings.ts); accept rules in `structurer.ts` (`scopeOpener` is evaluated before `sectionCandidate`); `TARGET_RE`, `MORE_TARGETS_RE`, `VERB_WINDOW`, `TARGET_WINDOW` (conditionals.ts); `parseTarget`, `conditionalTargets`, `checkTarget`, exported `SECTION_RE`/`PART_RE` (flow.ts); `refRoutingContext`, `refSeverity` (util.ts, read-only).
- Frozen contracts v1 untouched: heading stays kind `heading`, `Section.number` stays a string, `Conditional.targets` stays `string[]`; no new block kind, issue class or schema field.
- Registry: the Phase 1 revision note lists exactly the five files; no other phase or the variance program claims them (grep over `process/`: only intake plans and the Phase 02 subdoc plan and report mention them, the latter completed history).
- `validate-plan-artifact.mjs` and `validate-phase-stub.mjs`: 0 failures, 0 warnings. Design packages committed (`git ls-files samples/packages` lists docs, README and answer-key for all three). `results.tsv` records 7 lines (header, baseline, cycle rows): `PHASE_COMPLETE: VALIDATE` is legal.

Dimension findings:
- Infra fit: PASS — file paths, names and the entry gate resolve at HEAD; no wait, no deploy; allow-list, registry and rollback consistent.
- Test coverage: PASS — every developed behavior has a Fully-Automated gate (table below); G22-G24 are red-first with negatives and measured literals; the only Hybrid row is the opt-in local-facts check with a backlog stub.
- Breaking changes: PASS — frozen contracts, snapshot and `computeGate` gated; Section/Part/`N. Title` behavior byte-identical (the 12 HTML samples contain 0 keyword-led heading lines, measured); new conditional heads add conditionals only on NG3/NG2 (Annex A and Annex F), RR1, Harbourline and #12, all explained by the B0.7 table with a stop rule.
- Security surface: PASS — pure parser and detector code, no secret, auth, API, billing or trust-boundary change beyond the cross-firm baseline rule (own Fully-Automated gate); new patterns bounded and linear with an explicit time-bound test; 0 live model calls.
- Section A (premise check): PASS — baseline literals measured before B0.
- Section B0 (heading forms and conditional targets): PASS — mechanically feasible as written; highest-risk edit remains `checkTarget` branch order (E4).
- Section B-H (types, detection, facts, terms, coverage, fixtures, tests, close): PASS — unchanged since the outer contract, which was verified against real code.
- Blast-radius disjointness vs `phase-blast-radius-registry.md`: PASS.

Open gaps: none (no FAIL, no open CONCERN). Named residuals are Known-Gaps below, none a developed behavior without a gate.
Out-of-scope gaps deferred to backlog: none this cycle.

### Plan updates applied
- None by this agent (write scope is the contract plus the two Resume status lines). The plan body already carries the C1-C7 supplement.

### Execute-agent instructions
- E1 (Step 0): `git merge-base --is-ancestor 0a67dc4 HEAD` and no modified tracked non-process file; never stash, checkout, reset or restore; record the literal 40-char `P1_BASE` and rollback target `47d98295-c583-4dc0-9f96-f9e161c8cf35`.
- E2 (Step A): measure baseline literals first; never assume.
- E3 (Step B0): write G22 and G23 red first; keep a before/after run of the same engine for B0.7; stop rule stands (more than 3 new findings on one sample, any noise finding, or an unexplained count change stops the step; tighten patterns, never loosen thresholds).
- E4 (Step B0.5): run the Annex and Question branches in `checkTarget` before the bare-Part branch; `uncertain` never yields a finding.
- E5 (Step C): `package-type-detection-golden` first over committed real facts; tune DATA only; a tie never yields `high`.
- E6 (Step E6): export `PackageDocFormat` only; never shadow `DocFormat`.
- E7 (Step H): stage by explicit path; avoid the three blocked words in new paths; never `git add -A`; record that `DocumentRequest.quote` is stored unmasked (Phase 3c routes it through `maskAndClamp`).
- E8 (regex bound; new, low): `test/security/redos.test.ts` does not import `structure/headings` (it hard-codes `HEADING_RES`), so exporting the new heading regex does not by itself add it to redos; G22's own hostile-input time bound is the gate for it. Optional: add `import * as headings` plus `...collect(headings)` to `ALL` as an explained edit (the `>= 45` sanity check still holds). New exported regexes in `flow.ts` and `conditionals.ts` ARE auto-collected (`collect(flow)`, `collect(conditionals)`) and must stay under the 2000 ms budget there.
- E9 (heading vs scope; new, low): `scopeOpener` runs before `sectionCandidate`, so a bold or caps keyword-led line containing `Instructions`, `Terms and Conditions`, `Signature Pages` or `Appendix X` opens a scope instead of a section (same as `N. Title` today). Pin one such case in G22 as measured, do not change `numbering-scopes.ts`.
- E10 (label grammar; new, low): the annex label match is `^Annex <label>` with NO required trailing period: sample #12 writes `Annex D:` and the design packages write `Annex F.`; include both forms in G23 (and `Annex D:` with a label present stays silent).

### Test gates (5-column table; strategy carries only the 3 proving strategies)

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| premise | undefined-term baseline pinned before intake | Fully-Automated | `pnpm --filter @aduin/core test package-undefined-term-baseline` | B |
| AC-S1 | `Section N.`, `SECTION N`, `Article N` or roman, bold or not, titled or bare, accepted; prose, statute cites, `Section N:` lines, dotted decimals rejected; hostile-input time bound | Fully-Automated | `pnpm --filter @aduin/core test structure-heading-forms` | B |
| AC-S2 | `Annex X` and `Question N` targets: missing is a finding, present is silent, no annex evidence is uncertain | Fully-Automated | `pnpm --filter @aduin/core test broken-conditional-annex-question` | B |
| AC-S3 | design DOCX goldens encode answer-key should-catch and should-not-catch (LB2, RR1, NG3, NG2, two LPAs) | Fully-Automated | `pnpm --filter @aduin/core test package-design-goldens` | B |
| AC-S4 | 12-sample corpus counts equal the post-B0.7 table, every change explained | Fully-Automated | `pnpm --filter @aduin/core test package-design-goldens` (corpus block) and `pnpm --filter @aduin/core test` | B |
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
| robustness | no catastrophic regex on hostile input (package scans, new heading regex, new conditional regexes) | Fully-Automated | `pnpm --filter @aduin/core test package-scan-bounded`, `pnpm --filter @aduin/core test redos` and the G22 time-bound cases | B |
| frozen v1 | contracts snapshot untouched; only the five allow-list files change in core src outside `src/package/` and the barrel | Fully-Automated | `pnpm --filter @aduin/core test contracts` plus `git diff --name-only P1_BASE -- packages/core/src` set check and `git diff --quiet P1_BASE -- apps` | A |
| fixtures | generated fixtures reproduce | Fully-Automated | `pnpm --filter @aduin/scripts test package-fixtures` and `pnpm --filter @aduin/scripts fixtures:check` | B |
| AC-I5 local | real local files still match committed facts | Hybrid | `PACKAGE_LOCAL=1 pnpm --filter @aduin/core test package-realfacts-local` (precondition: `_full-prospectus` present locally; never a CI gate) | D |

gap-resolution legend: A proven now; B fixed in this plan (gate added by the checklist); C deferred to a named later phase/plan; D backlog test-building stub (named residual). Known-Gap is never a `strategy:` value.

Legacy line form (retained for existing consumers):
- core package module: [Fully-automated: the one-token `pnpm --filter @aduin/core test <token>` calls in the table above] | [hybrid: `PACKAGE_LOCAL=1 pnpm --filter @aduin/core test package-realfacts-local`, needs local `_full-prospectus`] | [agent-probe: none] | [known-gap: live LLM doc-type suggester (seam only), B0 residual forms]
- structure and detectors (T14): [Fully-automated: `structure-heading-forms`, `broken-conditional-annex-question`, `package-design-goldens`, `contracts`, `determinism`, `redos`] | [hybrid: none] | [agent-probe: none] | [known-gap: Schedule/Exhibit targets, per-Part question numbering, dash or next-line heading titles]
- fixtures and scripts: [Fully-automated: `pnpm --filter @aduin/scripts test package-fixtures`, `pnpm --filter @aduin/scripts fixtures:check`] | [hybrid: none] | [agent-probe: none] | [known-gap: none]

Failing stubs (Fully-Automated rows only, red first; in the file named by each row's proving test; the Hybrid row gets none). Skeleton for every row, `<behavior>` is the behavior cell of that row:

```
test("should <behavior>", () => {
  throw new Error("NOT IMPLEMENTED — TDD stub: <behavior>")
})
```

Row-specific stubs (verbatim scenario names for the three T14 gates, which carry the highest risk):

```
// structure-heading-forms.test.ts
test("should accept Section N. and Article roman headings without bold or caps", () => { throw new Error("NOT IMPLEMENTED — TDD stub: keyword-led headings") })
test("should reject Section N: instruction lines, dotted decimals, lowercase roman and Article IV of the Agreement prose", () => { throw new Error("NOT IMPLEMENTED — TDD stub: heading negatives") })
test("should finish the heading regex on 100000-char hostile lines under the time bound", () => { throw new Error("NOT IMPLEMENTED — TDD stub: heading regex bound") })
// broken-conditional-annex-question.test.ts
test("should flag complete Annex F when no Annex F block exists and stay silent when it does", () => { throw new Error("NOT IMPLEMENTED — TDD stub: annex target") })
test("should flag skip to Question 15 with 14 questions numbered across Parts and stay silent with 15", () => { throw new Error("NOT IMPLEMENTED — TDD stub: question target") })
test("should stay uncertain with no annex or question evidence", () => { throw new Error("NOT IMPLEMENTED — TDD stub: uncertain target") })
// package-design-goldens.test.ts
test("should pin measured section counts and answer-key findings for LB2, RR1, NG3, NG2 and both LPAs", () => { throw new Error("NOT IMPLEMENTED — TDD stub: design goldens") })
test("should keep the 12-sample corpus counts equal to the post-B0.7 table", () => { throw new Error("NOT IMPLEMENTED — TDD stub: corpus regression") })
```

Regression suite (after all steps): `pnpm --filter @aduin/core test`, `pnpm --filter @aduin/scripts test`, `pnpm typecheck`, `pnpm lint`, `pnpm guard:cf`, `pnpm secrets:scan`, all exit 0; one token per call, no `--`, confirm more than 0 tests ran.

What This Coverage Does NOT Prove:
- Heading goldens prove the five design DOCX files and the 12 HTML samples (none has a keyword-led heading line), not other drafting styles such as `Section 4 -` dashes, centered all-caps `ARTICLE IV` with the title on the next line, or non-English headings.
- Annex and Question resolution is proven on the measured documents; a document that numbers questions per Part, or names annexes `Schedule` or `Exhibit`, is not covered (those targets are out of B0 scope).
- Detection goldens prove the rules on committed facts and four to five real files only, not accuracy on unseen subscription documents.
- Reference recall proves seeded and NGI #5/#6 phrases, not arbitrary drafting styles; the ground truth shares its exclusion list with the extractor.
- Suppression and unverified-term logic is proven on a synthetic LPA excerpt and the design LPAs, not on a real multi-document package.
- Same-firm eligibility is proven as a pure function; the browser store, Dexie persistence and UI (Phases 2 and 3) are not exercised here.
- Determinism is proven in one Node process, not for the browser worker path; web specs that pin per-sample counts are read-only here and are recorded for Phase 2.
- Quote masking at render and export is not proven here (Phase 3c).
- Bounded-scan timing proves hostile-input safety on this machine's time bound, not worst-case browser performance.
- The Hybrid local-facts check proves nothing in CI.

### High-risk pack
Required: no. Pure browser-side and parser-side code: no auth, billing, schema migration, public API, deploy or secret surface. The cross-firm baseline rule is a trust-boundary rule covered by the Fully-Automated `package-baseline-eligibility` gate and the Phase 2 e2e `intake-baseline-role-same-firm`; a manual-first pack is recommended at Phase 2 EVL, not here.

### Backlog artifacts to create during durable capture
- `process/features/fund-package-intake/backlog/intake-llm-doc-type-suggest_NOTE_17-10-26.md` — LLM suggester task (seam only ships; needs-live-provider).
- `process/features/fund-package-intake/backlog/intake-local-real-facts_NOTE_17-10-26.md` — only if a local real file is missing or misses its authored type.
- `process/features/fund-package-intake/backlog/intake-annex-question-forms_NOTE_17-10-26.md` — `Schedule`/`Exhibit` conditional targets, per-Part question numbering and dash or next-line heading titles (named residuals of B0).

### Known gaps on record
- Live suggester behavior: none shipped (T2); seam proven by a fake only; residual `known-gap: documented`, backlog stub `intake-llm-doc-type-suggest` (every developed behavior has a Fully-Automated gate; vacuous-green ban satisfied).
- AC-I5 for local-only real files is Hybrid (opt-in); CI proves committed facts only; backlog stub `intake-local-real-facts` if a local file is missing.
- B0 residual forms (Schedule/Exhibit targets, per-Part questions, dash or next-line heading titles): `known-gap: documented`, backlog stub `intake-annex-question-forms`; none is a developed behavior without a gate.

No `## Autonomous Goal Block` is written to this phase plan: BRANCH B — the umbrella `intake-mvp-umbrella_PLAN_17-10-26.md` carries `## Stable Program Goal` (verified on disk, count 1), which governs.

Accepted by: not required for the gate (Gate: PASS, no open CONCERN). The named residuals above are recorded as known-gaps with backlog stubs by session (autonomous /goal, autopilot VALIDATE), not as accepted concerns.
