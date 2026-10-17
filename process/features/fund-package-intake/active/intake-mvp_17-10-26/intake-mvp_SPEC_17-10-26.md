---
name: spec:intake-mvp
description: "SPEC delta for slim fund package intake (U1-U9): multi-file package upload, type/role detection with confirmation, external references, cross-document defined terms, coverage per check group, one missing-documents request for the GP; folded into existing screens"
date: 17-10-26
feature: fund-package-intake
metadata:
  type: spec
  phase: SPEC
  status: draft-for-user-review
  extends: subdoc-qa-mvp (AC1-AC64 stay in force; new ACs are AC-I1 onward)
  consumed-by: variance-mvp (baseline role)
---

# SPEC delta: Fund package intake, slim MVP (U1 to U9)

**BLUF:** A subscription agreement never stands alone. Today the app reads one file, so it either reports dozens of
false "undefined term" errors (the LPA defines them) or says nothing about documents that are referenced but absent.
This delta lets the analyst upload the whole package, confirms what each file is, finds what the sub agreement points
to, stops false undefined-term errors, shows honestly which checks ran fully, partly or not at all, and produces one
missing-documents request for the GP. No new screens: it folds into Documents, Structure, Gate/Findings and Questions.

Reads with the base SPEC `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_SPEC_17-10-26.md` and the
sibling `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp_SPEC_17-10-26.md`.
Sources: user PRD "Fund Package Intake" (Vietnamese), PRD "Legal Reviewer", current architecture docs.

## Locked Decisions (user and orchestrator validation, 17-10-26)

| # | Decision |
|---|---|
| L1 | Scope = U1 to U9 (P0) only. The baseline ROLE is in scope through U4 |
| L2 | No new screens or sidebar items. Documents: Upload modal takes many files and gains a type/role confirmation table. Structure: new "Package" lens next to Sections / References. Gate popover shows coverage; Findings header shows one line such as "Coverage: partial - no LPA, 14 terms unverified". Questions: the missing-documents request is the GP owner group's export (one item per missing document plus the quote). This overrides the PRD's 4 separate screens |
| L3 | Stack as built: TypeScript on Cloudflare. PRD's Python / PyMuPDF / python-docx is not adopted. Free models only |
| L4 | Type detection is deterministic first (file name, first-page title, known phrases); LLM is a fallback only, inside the existing free quota. Reference extraction is deterministic patterns first. Every quote exists verbatim |
| L5 | PRD `zdr` / data-collection settings do not exist on free models. The demo uses public documents only. "Confidential packages need a zero-retention provider" is listed under production-not-built |
| L6 | OCR: the PRD says no OCR, but OCR exists. Scanned files in a package reuse the existing OCR path within its limits. If OCR is unavailable the file is flagged "needs OCR" and coverage drops. The existing capability is not removed |
| L7 | Full document text stays in the browser (IndexedDB, 24 h, as today). The server (D1) stores only package metadata, hashes, short quotes and coverage. Memory never crosses law firms or workspaces. Other firms' documents are never a baseline |
| L8 | Limits: 10 MB per file (unchanged); package limit proposed at 12 files and 40 MB total (tune in PLAN). Reference documents (LPA/PPM) are parsed only for definitions, reference targets and headings; they are not run through the full error review |
| L9 | Demo data: (a) synthetic Hartwell & Crane package (Fund III sub agreement + LPA definitions excerpt + Fund II as baseline; Annex F and the side letter referenced but missing). (b) Real public packages: #13 Blackstone REIT Appendix B + full prospectus; #9 RW Holdings scans + its prospectus; Partners Group NGI #5/#6 ("LLC Agreement" appears 11 times in each; #5 says "Memorandum" 8 times and #6 says "Prospectus" 8 times, a real cross-document reference case) |
| L10 | Closes the backlog item P2-6 (defined-term false positives) for terms defined elsewhere in the package; extends the defined-term detector and its ACs (see mapping) |
| L11 | Coverage sits next to the gate so a partial package never looks fully checked. Assumption (A1): missing the sub agreement blocks the gate; a missing LPA or PPM only warns |

## Summary

The analyst drops the fund's documents in together. The app labels each file (sub agreement, LPA, PPM, tax form,
side letter, other) and its role (to digitize, reference, baseline), shows a confidence, and asks for confirmation
where unsure. It then reads the sub agreement for phrases like "as defined in the Partnership Agreement" or "see
Annex F", matches each to a file in the package or marks it missing, and treats terms defined in the LPA as defined.
A coverage summary says which checks are full, partial or blocked and why. One request lists everything missing for
the GP, each with the quote that references it.

## Problem

| Pain | Example | Today |
|---|---|---|
| False alarms | Sub agreement says capitalized terms have the meaning in the Partnership Agreement; "Capital Commitment", "Closing Date" get flagged | Dozens of false errors; trust lost on first run |
| Missed cross-document risk | Reference to Annex F that nobody sent | Found late, mid-build, one more wait with the time difference |
| False confidence | One file reviewed, analyst assumes all checked | Nothing says what was not checked |
| Repeated asking | Missing documents requested piecemeal | Several rounds with the GP |

## Job To Be Done

When a fund sends its documents, I want to upload them together and see what each is, what the sub agreement relies on,
what is missing, and which checks could not run, so I get no false alarms and ask the GP for everything once.

## User Stories

| ID | As a... | I want... | So that... |
|---|---|---|---|
| IS1 | Analyst | to drop many files at once and have the app guess type and role | I do not classify files by hand (U1, U3) |
| IS2 | Analyst | to tag the package with firm and fund from the existing list | memory and baseline stay inside one firm (U2) |
| IS3 | Analyst | low-confidence guesses held for my confirmation before checks run | a wrong type never drives wrong checks (U3, U4) |
| IS4 | Analyst | to fix a type or role and mark which document is the baseline | later checks, including variance, use my correction (U4) |
| IS5 | Analyst | the sub agreement's outside references listed with quotes and location | I see what it depends on (U5) |
| IS6 | Analyst | each reference matched to a package file or marked "not in package" | I know what is missing (U6) |
| IS7 | Analyst | no "undefined term" error when the LPA defines the term, and a real error when nobody does | I trust the findings (U7) |
| IS8 | Analyst | coverage per check group as full / partial / blocked, next to the gate | I never think a partial package was fully checked (U8) |
| IS9 | Analyst | one missing-documents sheet for the GP | I ask once (U9) |
| IS10 | GP (request recipient) | a short list of missing documents, each with why it is needed | I send everything in one reply (U9) |

## What The User Wants (Behavioral Outcomes)

1. **Upload a package.** The Upload modal accepts several files (DOCX, HTML, PDF, scanned images/PDF via existing OCR). Over the limits: a plain message, nothing half-processed.
2. **Tag once.** Firm from the existing list (aliases resolve, free text refused), fund name, version label, applied to the package.
3. **Confirmation table.** One row per file: file name, detected type, detected role, confidence (high / low), reason ("title page says Limited Partnership Agreement"). Low-confidence rows are marked and must be confirmed or fixed; "Run checks" stays disabled until they are.
4. **Fix and mark baseline.** Type and role are editable per row; one or more rows can be marked "baseline" (same firm only). Corrections are kept.
5. **Package lens.** In Structure, "Package" lists: external references (quote, location, resolved to which file / not in package), cross-document terms (term, where defined), and coverage per check group.
6. **No false undefined terms.** A term used but defined only in a reference document is shown as "defined in LPA" with the definition quote, not as an error. A term defined nowhere stays an error.
7. **Honest coverage.** Gate popover and Findings header show coverage in one line, for example "Coverage: partial - no LPA, 14 terms unverified". Missing the sub agreement blocks the gate; missing LPA/PPM warns only (A1).
8. **One request.** Questions gets a GP group item per missing document with the referencing quote; its export is one sheet, in one file.
9. **Scanned and unreadable files.** A scan with no OCR available is flagged "needs OCR"; its dependent checks drop to partial or blocked.

## Flow / State Diagram

```
 [Upload modal: drop N files] --> limits ok? --no--> message, nothing stored
        | yes
        v
 [pick firm / fund / version] --> parse each file (OCR path for scans; "needs OCR" if unavailable)
        v
 detect type + role (rules first, LLM fallback) --> confidence per file
        v
 [Confirmation table] --low confidence?--yes--> analyst confirms/fixes (Run checks disabled)
        |  analyst may mark baseline (same firm only)                |
        v<-----------------------------------------------------------+
 extract definitions + headings (reference docs) and references (sub agreement)
        v
 resolve each reference: to a package file | "not in package"
        v
 defined-term check uses package definitions --> real errors only
        v
 coverage per check group: full | partial | blocked
        v
 [Findings header line + Gate popover]      [Questions: GP group, 1 item per missing doc]
```

Coverage states (per check group):

```
 full ------ all documents the group needs are present and readable
 partial --- some missing/unreadable (e.g. no LPA: terms unverified) -> warns
 blocked --- the group's core document absent (no sub agreement) -> gate Blocked
```

## Acceptance Criteria (Testable Outcomes)

Strategy tags as in the base SPEC: FA Fully-Automated, H Hybrid, AP Agent-Probe. Scenario names are provisional and
finalized in PLAN, extending `process/context/tests/all-tests.md` (golden corpus, seeded fixtures, recorded-LLM, E2E browser).

### A. Upload and tagging (U1, U2)

**AC-I1. [P0] A package of many files uploads in one action.** Up to the limits (proposed 12 files, 40 MB total, 10 MB each) a single drop accepts all; over the limit a clear message appears and nothing is stored.
- proven by: `intake-multi-upload-e2e` plus `intake-limits-refusal-e2e`; strategy: FA

**AC-I2. [P0] The package is tied to a firm, fund and version.** Firm comes from the existing list (aliases resolve, free text refused); fund and version label are required; without a firm the app says memory is not applied.
- proven by: `intake-firm-tagging-e2e` (extends `upload-firm-tagging-e2e`); strategy: FA

**AC-I3. [P0] Scanned files reuse OCR or are flagged.** A scanned file in a package goes through the existing OCR path within its limits; if OCR is unavailable the row shows "needs OCR" and affected coverage drops.
- proven by: `intake-scan-ocr-or-flag-e2e` (sample #9 scans; OCR stubbed unavailable); strategy: FA with H for real OCR text

### B. Type, role, confirmation (U3, U4)

**AC-I4. [P0] Every file gets type, role and confidence with a stated reason.** Rule-based detection from file name, first-page title and known phrases; the reason is shown.
- proven by: `intake-type-detection-contract` (one row per file; reason present); strategy: FA

**AC-I5. [P0] Detection is correct on the demo set.** 100% on the synthetic package and the real packages in L9.
- proven by: `intake-type-detection-golden` (expected type/role matrix, no-LLM run); strategy: FA

**AC-I6. [P0] Low confidence holds the run until confirmed.** Rows below the confidence threshold are marked; "Run checks" is disabled until each is confirmed or fixed.
- proven by: `intake-low-confidence-gate-e2e`; strategy: FA

**AC-I7. [P0] LLM is a fallback only and never overrides a confirmed value.** When rules are unsure a free model may suggest a type with a confidence; the suggestion is labelled and replaced by the analyst's choice; with AI off, detection still completes.
- proven by: `intake-llm-fallback-recorded` (recorded AI contradicting a rule; confirmed value unchanged) plus `intake-no-llm-run`; strategy: H

**AC-I8. [P0] Analyst corrections persist and drive later checks.** Changed type/role is saved with the package and used by every dependent check after reload.
- proven by: `intake-correction-persists-e2e`; strategy: FA

**AC-I9. [P0] The baseline role is markable, same firm only.** One or more documents can carry role "baseline"; a document from another firm or workspace is never offered or accepted. Variance consumes this role (see Depends).
- proven by: `intake-baseline-role-same-firm-e2e` (two firms, same text); strategy: FA

### C. References (U5, U6)

**AC-I10. [P0] External references are extracted with quote and location.** Phrases such as "as defined in the Partnership Agreement", "see Annex F", "complete Form W-8BEN-E", "the Side Letter" are found; each has a verbatim quote and location.
- proven by: `intake-reference-extraction-golden` (pattern matrix); strategy: FA

**AC-I11. [P0] Reference recall on seeded references is 100%.** Every reference seeded in the synthetic package and the real cases (NGI #5/#6 "LLC Agreement" and "Memorandum"/"Prospectus") is found.
- proven by: `intake-reference-recall-matrix`; strategy: FA

**AC-I12. [P0] Every reference is resolved or marked "not in package".** Matching uses type, title and a synonym table ("LP Agreement", "Fund Agreement", "Partnership Agreement" all mean LPA); an unclear match is shown for the analyst to confirm, never guessed silently.
- proven by: `intake-reference-resolution-matrix` (synonyms, annex titles, missing targets); strategy: FA

**AC-I13. [P0] Quotes are real.** Every stored quote exists verbatim in its document; a quote that fails this check is dropped and counted.
- proven by: `intake-quote-verbatim-contract` (property test); strategy: FA

### D. Cross-document defined terms (U7)

**AC-I14. [P0] Terms defined in a package reference document are not flagged undefined.** With the LPA present, a capitalized term defined there shows "defined in LPA" with its definition quote; false undefined-term findings for such terms are 0.
- proven by: `intake-crossdoc-terms-no-false-positive-e2e` (synthetic LPA; extends AC13/AC17 fixtures); strategy: FA

**AC-I15. [P0] A term defined nowhere is still an error.** With the LPA present, a term absent from both documents is reported as before.
- proven by: `intake-crossdoc-terms-real-error-e2e` plus base AC13 re-run (#11 "Units"); strategy: FA

**AC-I16. [P0] Without the LPA, terms are marked unverified, not errored.** Terms that the sub agreement says are defined elsewhere are listed as "unverified" (counted in coverage), not as undefined errors.
- proven by: `intake-terms-unverified-without-lpa-e2e`; strategy: FA

### E. Coverage and gate (U8)

**AC-I17. [P0] Coverage is shown per check group.** Each group is full / partial / blocked with the missing document types; visible in the Package lens, the gate popover and the Findings header line.
- proven by: `intake-coverage-matrix` (package states) plus `intake-coverage-visible-e2e`; strategy: FA

**AC-I18. [P0] A partial package never looks fully checked.** Whenever any group is partial or blocked, the Findings header shows the coverage line next to "Ready to digitize" or "Blocked".
- proven by: `intake-coverage-next-to-gate-e2e`; strategy: FA

**AC-I19. [P0] Gate policy for missing documents.** Missing the sub agreement: Blocked with a reason. Missing LPA/PPM: warns only, gate otherwise unchanged. The policy is configurable data, not code.
- proven by: `intake-gate-missing-doc-policy-matrix` (extends `gate-state-matrix`); strategy: FA

### F. Request for the GP (U9)

**AC-I20. [P0] One request lists every missing document.** Questions shows, in the GP group, one item per missing document with the quote that references it; one export contains all of them, once per package.
- proven by: `intake-missing-docs-request-export-e2e` (parse the DOCX; Annex F and side letter present; no duplicates); strategy: FA

## Non-Functional Requirements

| Area | Requirement | Target |
|---|---|---|
| Type accuracy | Demo set (L9) | 100% (AC-I5) |
| False undefined terms | Terms defined in the present LPA | 0 (AC-I14) |
| Reference recall | Seeded references | 100% (AC-I11) |
| Reproducibility | Same package and config, identical types, references, coverage | byte-equal; works with no AI (base AC8, AC25) |
| Safety | AI never gates; quotes verbatim; no cross-firm memory or baselines | AC-I7, AC-I9, AC-I13 |
| Cost | Free models only, $0 added | unchanged |
| Platform | Workers Free (10 ms CPU, 50 subrequests); parsing stays in the browser worker | base AC29, AC40 re-run on the package |
| Privacy | Server stores metadata, hashes, short quotes, coverage only | base AC58 extended |
| UI | No new screens; keyboard operable; non-colour cues | base AC30 re-run |

## Data Delta (required data, not a schema design)

| Needed data | Why |
|---|---|
| **Package**: firm, fund, version label, created time, file count | AC-I1, AC-I2 |
| **Document** gains **type**, **role** (to digitize / reference / baseline), **confidence**, detection reason, analyst-confirmed flag, content hash, "needs OCR" flag | AC-I3 to AC-I9 |
| **External reference**: source document, verbatim quote, location, target label, resolved document or "not in package", match confirmed by analyst | AC-I10 to AC-I13 |
| **Cross-document definition**: term, defining document, definition quote, location | AC-I14 to AC-I16 |
| **Coverage**: check group, status (full / partial / blocked), missing document types, computed time | AC-I17 to AC-I19 |
| **Document request**: items (document name plus referencing quote), exported time, fulfilled time | AC-I20 |
| Browser holds full text (24 h); server holds hashes and short quotes only | L7 |

## Out Of Scope (future work)

| Item | Why |
|---|---|
| U10 Append to an existing package and rerun only affected checks | Needs result-reuse rules; P1 |
| U11 New-version detection ("this is a new version of X") | Depends on matching rules; P1 |
| U12 Requirement notes from GP / fund admin as a role | New input type and checks; P1 |
| U13 Shared values / cross-document number mismatch | Needs value extraction per document type; P1 (the riskiest feature) |
| U14 Auto-suggest baseline | Needs similarity ranking; P2 |
| U15 Data room or email import | External integrations; P2 |
| Tax-form content checks (W-9, W-8) | Only which investors are pointed to which form, and only as references |
| New screens, sidebar items, a separate coverage dashboard | Locked (L2) |
| Zero-retention model provider for confidential packages | Production-not-built (L5) |
| Multi-user permissions | Single analyst demo |

## Constraints

| Source | Constraint |
|---|---|
| User | No new screens; free models only; TypeScript on Cloudflare Workers Free + D1; English UI |
| User | AI never gates and quotes real text; results reproducible; works with no AI |
| User | Memory and baselines never cross firms or workspaces; never touch the owner's protected personal Cloudflare zone (see CLAUDE.md Project Rules) |
| Base SPEC | All AC1 to AC64 keep passing; this delta extends, never weakens, them |
| Process | Demo data public or synthetic; sample files untrusted input; the ILPA PDF is copyrighted and local-only, so it is not bundled; `_full-prospectus` is gitignored and local-only (present: #9 and #13 full files) |

## Assumptions (PRD open questions answered)

| # | PRD item | Assumption used here | Effect if wrong |
|---|---|---|---|
| A1 | Gate on missing documents | Missing sub agreement blocks; missing LPA/PPM warns | Change a config row |
| A2 | Channel GP uses to send documents | Analyst uploads by hand | Import is future work (U15) |
| A3 | Who sends the request to GP | The analyst sends the exported sheet | Artifact unchanged if account manager sends |
| A4 | Side letter is shared with Anduin | Often not; its absence only warns | Coverage line and request still work |
| A5 | Should GP self-upload | No; one analyst | Future work |
| A6 | Sub agreement takes definitions from LPA with one generic sentence | Yes; the "defined elsewhere" sentence is detected by patterns | Terms stay "unverified" rather than erroring |
| A7 | Scans | Reuse existing OCR within limits | Flagged "needs OCR" |
| A8 | Package limits | 12 files, 40 MB total | Tune in PLAN |

## Risks

| Risk | Mitigation |
|---|---|
| Wrong type drives wrong checks | Confidence shown; low confidence held for confirmation (AC-I6) |
| Reference named differently ("LP Agreement") | Synonym table; unclear match shown for confirmation (AC-I12) |
| Huge LPA/PPM | Parse only definitions, targets, headings (L8) |
| Analyst ignores coverage | Coverage line beside the gate (AC-I18) |
| Free-plan CPU on large packages | Parse in the browser worker; re-run base AC29/AC40 |
| Real prospectus is 4 to 8 MB HTML | Definitions-only parse; per-file 10 MB limit unchanged |
| Confidential data and free models | Public demo only; production-not-built (L5) |

## Success Metrics

| Metric | Target |
|---|---|
| Type detection on demo set | 100% (AC-I5) |
| False undefined terms, LPA present | 0 (AC-I14) |
| Seeded reference recall | 100% (AC-I11) |
| Missing documents found (seeded: Annex F, side letter) | 100% (AC-I20) |
| Requests to GP per package | 1 (AC-I20) |
| New screens or sidebar items | 0 (L2) |
| Demo walk (upload only sub agreement, add LPA and Fund II, request GP) | under 1 minute |

## How This Maps To Existing ACs

| Existing AC | Status | What changes |
|---|---|---|
| AC13 (#11 "Units" undefined) | Extended | Still flagged when no package document defines it |
| AC17 (Structure lists logic) | Extended | Adds "Package" lens |
| AC22 (strict gate) | Extended | Missing sub agreement blocks; missing LPA/PPM warns (AC-I19) |
| AC41 (firm tagging) | Extended | Applies to the whole package |
| AC25, AC8 (no-LLM, determinism) | Extended | Cover intake output |
| AC20, AC21 (counsel sheet, export) | Extended | GP group carries missing-document items |
| AC29, AC30, AC40, AC58 | Re-run | On package flow and changed screens |
| Backlog P2-6 (defined-term false positives) | Closed for cross-document terms | Residual title/caption cases stay open |
| All others | Untouched | Must keep passing |

## Depends On / Consumed By

- Variance (`variance-mvp`) consumes the baseline role from AC-I9. Build order: intake U1 to U9 first, then variance V1 and V2.
- Intake needs no variance feature.

## Open Questions

None that change WHAT is built. Items A1 to A8 are assumptions to confirm or tune in PLAN.

## Background / Research Findings

- Exists today (docs/architecture): format adapters, logic graph, 13 detectors, AI lane, counsel sheet with strict gate, OCR for scans, firm memory, D1. Single-document only; no package, role, cross-document terms or coverage.
- Samples checked: `samples/sub-docs/raw/05` and `06` NGI (each: "LLC Agreement" 11 times); `_full-prospectus` holds #9 and #13 full HTML locally (gitignored); #9 scans are in `09-rw-holdings-scans`; ILPA PDF local-only.
- User decision: slim version, intake U1 to U9 folded into existing screens first, then variance V1 + V2.

## TL;DR

- Upload the whole package into the existing Upload modal; the app labels each file, asks to confirm unsure ones, and lets the analyst mark the baseline.
- It finds outside references, matches them to package files, stops false undefined-term errors when the LPA defines them, and shows coverage next to the gate.
- One GP request lists every missing document with its quote. No new screens; free models; browser keeps full text.
- 20 criteria (AC-I1 to AC-I20); targets: type 100%, false terms 0, reference recall 100%. Variance consumes the baseline role.

PHASE_COMPLETE: SPEC
