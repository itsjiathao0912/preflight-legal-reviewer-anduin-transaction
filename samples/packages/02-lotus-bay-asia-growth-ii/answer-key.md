# Answer key: package 2 (Lotus Bay Asia Growth Fund II)

All seeded defects are in `docs/01-LB2-Subscription-Agreement-Offshore-v2.docx`. Locations are section numbers in that file. Quotes are verbatim (confirmed by `_build/check.py`).

"Current build" means the detectors in `packages/core/src/detectors` as read at generation time (2026-10-17). It is a prediction from reading the detector source, not a measured run. Where the detector set has no matching rule, the entry says so.

## Seeded issues

| ID | Location | Exact quote | Issue | Expected class / detector | Severity | AC | Caught now? |
|---|---|---|---|---|---|---|---|
| E1 | Sections 2.1, 4.1, 4.4, 4.7, 11.1, 11.3, 11.5 (terms used); Section 1.2 (deferral) | Terms: "Capital Commitment", "Drawdown Notice", "Defaulting Limited Partner", "Excused Investor", "Key Person Event", "Carried Interest Escrow". Deferral: "Capitalized terms used but not defined herein have the meanings given to them in the Partnership Agreement." | Six capitalized terms are defined only in the missing LPA | `defined_term_issue` family, but outcome must be **unverified** (listed in coverage), not an error. Cross-document definition lookup | none (unverified is not a finding) | AC-I16 (also AC-I14/I15 once an LPA is added) | No. `defined-term-issues` and `undefined-term` only judge terms in the single document; cross-document unverified status ships with intake. Nothing should be flagged as an error. |
| E2 | Section 6.2 (also referenced at 3.2 and 9.5) | "complete the Cayman AML Schedule set out in Annex C" | Reference to Annex C, which is not in the document or the package | `broken_cross_reference`; external reference extraction, resolves to "not in package" | high | AC-I10, AC-I12, AC-I20 | No. The reference detectors cover "Section N" forms; no Annex handling found. Intake adds it. Expect 3 reference hits (Sections 3.2, 6.2, 9.5), one GP request item. |
| E3 | Section 3.2 vs Section 9.5 | "All Investors must deliver the documents listed in Annex C." vs "Investors that are regulated financial institutions in a FATF member jurisdiction are not required to deliver any documents under Annex C." | Direct contradiction on who must deliver Annex C documents | `logic_contradiction` (LLM judgment on a graph-selected neighborhood) | high | Base spec contradiction check; AC-I17 (coverage partial because Annex C missing) | Only with AI on. No deterministic detector. |
| E4 | Section 5.1 | "accredited investor or a professional investor, and the General Partner and the Fund may treat those two expressions as interchangeable" (full sentence: "Each Investor resident in Singapore represents that it is an accredited investor or a professional investor, and the General Partner and the Fund may treat those two expressions as interchangeable for the purposes of this Agreement.") | Two different legal tests used interchangeably for Singapore investors; the test that applies is not stated | `ambiguity` | medium | Base spec ambiguity check | Only with AI on. |
| E5 | Section 10.4 (correct form at Section 10.2) | Typo: "the General Partner shall unreasonably withhold consent". Correct: "the General Partner shall not unreasonably withhold consent" | Missing "not" reverses the meaning | `meaningful_typo`; in variance also `version_drift` because v1 Section 10.4 reads correctly | high | Base spec typo check; variance AC | Only with AI on. Variance drift visible once variance ships. |
| E6 | Annex A, Part 1 | Table "Type of Investor": Individual / Corporation / Trust / Pension / Insurance Company | No "Other" and no "Fund of funds" option, so a fund-of-funds investor cannot complete the form | `investor_path_dead_end` (critical) or `option_gap_overlap`; also `investor_path_missing_item` | critical to high | Base spec investor-path checks (AC62 family); AC-I17 | Uncertain. `option-gap-overlap` handles numeric ranges and "all of the above" only; the investor-path detectors assert only when the graph proves it. Treat as a stretch catch. |
| E7 | Section 2.3 | "For Investors resident in Singapore, the minimum Capital Commitment is S$3,000,000." | Minimum stated in Singapore dollars in a US dollar fund; everywhere else it is US$3,000,000 | `ambiguity` (currency); across documents also a number mismatch against PPM and Section 2.3 first sentence | medium | Base spec ambiguity check; cross-document numbers (intake map) | Only with AI on. |
| E8 | Section 11.4 (correct value at Section 4.4: 30%) | "[●]% of the carried interest" | Unfilled placeholder in the escrow percentage | `placeholder`, detector `flag-placeholder` | medium | AC10 | Yes. |
| E9 | Annex D | "Account Number: 9990001234567" and "ABA Routing No.: 000000018" | Wire details present in the document; must be masked | `sensitive_data`, detector `flag-sensitive`; shown masked as #4567 and #0018 | medium (capped) | AC10 | Yes. Raw values must not appear in quotes, explanations or hashes. |

## Notes on seeded behaviour that are not extra defects

- **Annex C is referenced exactly three times** (Sections 3.2, 6.2, 9.5). E2 names the Section 6.2 quote; the other two are the E3 pair. All three resolve to "not in package". There is no Annex C heading anywhere, and no table of contents lists it.
- **Other missing references** (expected GP request items): the Partnership Agreement (Sections 1.1, 1.2, 4.4, 5.6 onward), the US Feeder Subscription Agreement (Sections 1.1, 2.6; Annex A Part 6). Together with Annex C that is exactly three items.
- **Resolvable references** (should not appear in the GP request): "Private Placement Memorandum" and "the Memorandum" resolve to doc 03; "Tax Form Selection Guide" (Section 7.1) resolves to doc 06; "any Side Letter" (Section 2.7) resolves to doc 05 for Sakura only.
- **Doc 02 is intentionally complete.** Its investor-type list includes "Fund of funds" and "Other", so the E6 gap in doc 01 is also a cross-document mismatch with doc 02. This is context, not a separate seeded defect.
- **Wire details also appear in doc 04 (v1).** Sensitive-data masking should apply there too, but v1 is a baseline and is not checked for defects.
- All "Section N.M" cross-references inside docs 01 and 04 resolve; `check.py` confirms zero broken internal references. All Part references in Annex A resolve in both versions.
- No drafting notes, no other bracket placeholders, and no other currencies stated for the minimum commitment appear in doc 01. The only `[●]` is E8. The only "S$" amount is E7.

## Expected variance, doc 04 (v1 draft, baseline) to doc 01 (v2)

| # | Change | v1 | v2 | Location |
|---|---|---|---|---|
| V1 | Vietnam added to eligible jurisdictions | No Vietnam row | Row in Section 5.2 table; new Section 5.5 (Vietnamese Investors); new Section 9.6; Annex A Part 5 | Sections 5.2, 5.5, 9.6; Annex A |
| V2 | Minimum commitment lowered | US$5,000,000 | US$3,000,000 (plus the E7 S$ sentence) | Section 2.3 |
| V3 | PEP questionnaire added | Short notification duty | Annex A Part 7 and revised Section 6.3 | Section 6.3; Annex A |
| V4 | Escrow raised | 25% in Sections 4.4 and 11.4 | 30% in Section 4.4; placeholder in Section 11.4 (E8) | Sections 4.4, 11.4 |
| V5 | Renumbering | Data Protection is Section 14, Governing Law is Section 13 | Data Protection is Section 13, Governing Law is Section 14 | Sections 13, 14 and every cross-reference to them |
| V6 | Silent meaning change (E5) | "shall not unreasonably withhold" | "shall unreasonably withhold" | Section 10.4 |
| V7 | Cosmetic edits | Cover stamp "Draft Version 1 - August 2026"; Section 5 title without "Warranties"; Section 1.3 "are not words of limitation"; Section 8.5 titled "Governing Law"; Section 12.4 titled "Publicity"; Section 15.4 "An electronic signature has the same effect as a signature by hand." | Cover stamp "Version 2 - October 2026"; Section 5 title with "Warranties"; Section 1.3 "are illustrative and do not limit..."; Section 8.5 "Governing Law of the Power of Attorney"; Section 12.4 "Advertising and Publicity"; Section 15.4 "Signature by a recognised electronic signature platform is effective as signature by hand." | various |

Variance should classify V1 to V4 and V5 as intended or structural changes and surface V6 (and the E7/E8 additions) as unintended or meaning-changing. V7 should be low-priority or hidden. Variance ships with the variance feature (not in the current build).

## Intake expectations for this package (AC-I mapping)

| AC | Expected on this package |
|---|---|
| AC-I4, AC-I5 | 01 and 04 typed as subscription agreement; 02 as investor questionnaire; 03 as PPM; 05 as side letter; 06 as tax form guide. |
| AC-I9 | 04 offered as baseline (same firm); never offered from another firm. |
| AC-I10, AC-I11 | References found: Partnership Agreement, Private Placement Memorandum, US Feeder Subscription Agreement, Side Letter, Annex C (3 hits), Tax Form Selection Guide, Form W-8BEN / W-8BEN-E / W-9. |
| AC-I12 | Partnership Agreement, US Feeder Subscription Agreement, Annex C: "not in package". PPM, Side Letter, tax guide: resolved. |
| AC-I13 | Every stored quote exists verbatim in its document. |
| AC-I16 | The six E1 terms listed as unverified; zero undefined-term errors for them. |
| AC-I17, AC-I18 | Coverage partial for definitions (LPA missing) and AML/KYC (Annex C missing); Findings header shows the coverage line beside "Ready to digitize" or "Blocked". |
| AC-I19 | Gate warns for missing LPA; not blocked. |
| AC-I20 | One GP request, three items, each with its referencing quote. |
