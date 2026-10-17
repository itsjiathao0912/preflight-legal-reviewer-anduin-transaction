# Answer key: Package 03 (Redwood Ridge Credit Opportunities Fund I)

All seeded defects are in `docs/01-RR1-Subscription-Agreement.docx` unless stated. There are no other deliberate defects. Quotes are verbatim and are checked by `_build/check.py`.

"Catches now?" was measured on 2026-10-17 by running the current core DOCX adapter and all registered detectors on document 01 (4 findings, listed under F7, F8, F10). "Intake" means it needs the Fund Package Intake work (AC-I1 to AC-I20); "variance" means the variance MVP.

Issue classes are the `issue_class` codes in `packages/core/src/findings/taxonomy.ts`. Detector ids are from `packages/core/src/detectors/`.

## Seeded defects

| ID | Location | Exact quote | Issue | Expected class / detector | Severity | AC exercised | Catches now? |
|---|---|---|---|---|---|---|---|
| F1 | Annex A, Part 2, Question 7 | `If you answered Yes to Question 6 (Benefit Plan Investor), skip to Question 15.` | Dead end: the questionnaire ends at Question 14, so a Benefit Plan Investor is sent to a question that does not exist | `broken_conditional` (`broken-conditional`); also an `investor_path_dead_end` (`investor-path-dead-end`) for the benefit plan route | critical | AC62 (investor paths); first-review Errors-only (AC-V8) | No. The conditional detector resolves Section, Part and Annex targets; "Question N" is not a resolvable target type yet. Gap to close |
| F2 | Section 8.2 versus Annex A Question 3 table | `Annex B (ERISA Representations) must be completed by each Investor that is an ERISA plan, but is not required for plans subject to Section 4975 of the Code (e.g., IRAs)`; table rows "401(k) or other defined contribution plan", "Defined benefit pension plan" and "Individual retirement account (IRA)" carry footnote 3 ("must also complete Annex B"); the row "Other benefit plan" has no marker | Requirement inconsistency: the text says IRAs need no Annex B, footnote 3 says they do, and "Other benefit plan" has no footnote at all | `inconsistent_footnote_requirement` (`footnote-requirement`); possibly `investor_path_missing_item` (`investor-path-missing-item`) for the plan branch | high | AC62; AC-I17 (plan branch coverage) | No (the footnote detector did not fire on this table). Gap to close |
| F3 | Section 8.1 | `the 25% limitation described in Section 8.4` | Broken cross-reference by meaning: Section 8.4 is "Insurance Company General Accounts"; the 25% test is Section 8.3 | `broken_cross_reference` (`ref-label-coherence`) | high | AC12 (reference coherence) | No. The target exists, so only a coherence check could catch it; the phrase does not match the detector's current pattern |
| F4 | Throughout 01 (uses); definitions in doc 02 | Terms: `Plan Assets`, `Significant Participation`, `Hurdle Amount`, `Subscription Facility` | Defined only in the LPA (doc 02), used in the sub agreement via Section 1.2 ("Capitalized terms used but not defined herein have the meanings given to them in the Partnership Agreement.") | With the LPA present: no error, each shown "defined in LPA" with the definition quote. Without the LPA: "unverified" (not `defined_term_issue`) | none (info) | AC-I14, AC-I16 | The current build does not flag undefined terms of this kind at all, so no false error today. The "defined in LPA" display and the "unverified" state need intake |
| F5 | Section 5.6 | `Qualified Credit Investor` | Capitalized term defined nowhere in the package (not in 01, not in 02) | `defined_term_issue` (`defined-term-issues`, undefined sub-rule) | medium | AC-I15 | No. Needs intake cross-document definitions |
| F6 | Annex A Question 9 ("check one") | `Taxable U.S. person` and `U.S. person subject to tax` | Overlapping options in an exclusive group | `option_gap_overlap` (`option-gap-overlap`) | high | AC10-class option checks | No. The detector handles numeric ranges and "All of the above" only; this is a semantic overlap (LLM or future rule) |
| F7 | Annex A Question 13 | `[NTD: SL&A to confirm whether the foundation needs a separate UBTI rep.]` | Drafting note left in the document | `drafting_note` (`flag-drafting-note`) | medium | AC10 | Yes |
| F8 | Section 3.6 | `[insert Subscription Facility lender]` | Unfilled placeholder (the lender is named in docs 02 and 03: Front Range Commercial Bank) | `placeholder` (`flag-placeholder`) | medium | AC10 | Yes |
| F9 | Section 3.6 | `Commitments may be reduced from time to time at the discretion of the General Partner or the Investor` | Ambiguity: who may reduce a Commitment (the GP, the Investor, or either)? Doc 02 Section 1.7 says GP may reduce with the LP's consent, so "or" is unclear | `ambiguity` (LLM judgment; no deterministic detector) | medium | judgment layer | No (needs the LLM layer, not run in the probe) |
| F10 | Annex C | `ABA routing number: 999000011` and `Account number: 9900123456` | Sensitive data: fake wire details in the document | `sensitive_data` (`flag-sensitive`) | medium (capped) | AC10 | Yes (two findings, masked to #0011 and #3456) |

## Package-level expectations (intake, first review)

| ID | What | Expected | AC | Catches now? |
|---|---|---|---|---|
| P1 | Doc 06 is an image-only DOCX | Row shows "needs OCR"; if OCR is unavailable, coverage for the tax-form group drops to partial; with OCR the text is extracted and typed as a tax forms guide | AC-I3, AC-I17 | Intake |
| P2 | Types and roles | 01 subscription agreement (to digitize); 02 LPA extract (reference); 03 PPM (reference); 04 AML/KYC checklist (reference); 05 GP requirements note; 06 tax forms guide (reference, needs OCR) | AC-I4, AC-I5 | Intake |
| P3 | External references from 01 | "Partnership Agreement" resolves to 02; "Memorandum" resolves to 03; "Side Letter" is "not in package"; IRS Form W-9 / W-8BEN / W-8BEN-E / W-8IMY are "not in package" (the scanned guide is the only related file) | AC-I10 to AC-I13 | Intake |
| P4 | Missing documents request | One request to the GP lists the Side Letter and the IRS forms, each with the referencing quote | AC-I20 | Intake |
| P5 | No baseline | Muted line "No earlier document from this firm... this document becomes the baseline"; Changes filter empty; Errors only | AC-V8 (variance L5, L10), AC-I9 | Variance and intake |
| P6 | Unknown firm | Sutter Lane & Abernathy LLP is not in the firm list; app states memory is not applied | AC-I2 | Intake |
| P7 | Coverage line | Without OCR, the Findings header shows a partial coverage line beside the gate; the sub agreement is present, so the gate is not blocked for a missing document | AC-I17 to AC-I19 | Intake |

## Requirement-versus-document mismatch (future, out of the MVP)

| ID | Document and quote | Conflicts with | Notes |
|---|---|---|---|
| R1 (U12) | Doc 05: `We need source-of-funds evidence for any commitment of $2,000,000 or more` | Doc 04 Section 4.1 ("above $5,000,000") and doc 01 Section 6.3 ("more than $5,000,000"); Annex A Question 12 asks about "more than $5,000,000" | Not caught and not in scope for the MVP (requirement-versus-document check, U12). Effect on investors: Elena Marchetti ($2M), Sandoval ($5M) and others would need evidence under the GP's rule but not under the document or the checklist; the tool should one day surface this as a question to the GP |

## Things that are intentionally not defects

- Doc 02 is an extract of Article I and cross-references later Articles (for example Section 4.6) that are not reproduced. It is a reference document and is not checked as a digitize target.
- External statute references ("Section 4975 of the Code", "Section 3(42) of ERISA", "Section 401(c) of ERISA") are not internal references.
- Defined terms in doc 01 other than the four in F4 and the one in F5 are defined in doc 01 itself. Every internal "Section N.N" reference resolves (checked by `_build/check.py`), except F3 which resolves to the wrong subject. "Question 15" is the only unresolved question reference.
- The amounts $2,000,000 (minimum), $300M / $400M, 1.5% fee, 7% hurdle, 15% carry, 1.5% GP commitment and 1.0x leverage are consistent across docs 01, 02 and 03.
