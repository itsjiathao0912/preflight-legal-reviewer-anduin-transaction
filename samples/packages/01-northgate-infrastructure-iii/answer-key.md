# Answer key: Package 01 (Northgate Infrastructure Fund III)

Document 01 = `docs/01-NG3-Subscription-Agreement.docx`. Locations use the headings in that file. "Current build" means the detectors in `packages/core/src/detectors` as they stood when this package was generated; each status below was measured by running the core engine on the generated DOCX (7 findings in total on 01 in the current build, no others; D6 was added by commit 28fe3d4, the first measurement had 6).

## A. Seeded issues in 01

| ID | Section / location | Exact quote | Issue type | Class / detector | Severity | AC | Caught by current build? |
|---|---|---|---|---|---|---|---|
| D1 | 1.4 Delivery of Subscription Documents, 2nd paragraph | `to the Custodian indicated in Part B of Section 6` (custodian information is Part B of Section 4) | Broken cross-reference (swapped Part B; Section 6 Part B is "Trusts and Public Plan Investors") | `broken_cross_reference` / `ref-label-coherence` | high (instruction context) | existing AC12 | Yes. Reported with expected target "Section 4 (Investor and Custodian Information)" |
| D2 | 12.1 Representation, 1st paragraph (Section 12, Qualified Purchaser Status) | `paragraphs 1 through 4 of this Section 11` | Self-reference to the wrong section | `broken_cross_reference` / `ref-this-section` | high | existing AC11 | Yes. Reported with expected Section 12 |
| D3 | 1.3 No Registration; Offering Basis | `the offered Units will not be registered` (document defines and uses "Interests" everywhere else; this is the only "Unit(s)" in 01) | Offering-term drift | `defined_term_issue` / `undefined-term` | medium | existing AC13 | Yes. Note the sub agreement carries the "meanings given to them in the Partnership Agreement" carve-out, so the finding quotes both interpretations |
| D4 | 2.3 Classes of Interests | `[NTD: Hartwell & Crane to confirm the Class S minimum with tax counsel before filing.]` | Drafting note left in the text | `drafting_note` / `flag-drafting-note` | medium | existing | Yes |
| D5 | 2.2 Closings | `[insert Final Closing Date]` | Placeholder | `placeholder` / `flag-placeholder` | medium | existing | Yes |
| D6 | 9.1 Benefit Plan Status | `If the Investor is a Benefit Plan Investor, complete Annex F.` and a second plain reference `Annex F (ERISA Representations)` in the next sentence. No Annex F exists in 01 or in the package | Conditional whose target does not exist; document missing from the package | `broken_conditional` (class `broken_conditional`, critical when detected) | critical (conditional); missing-document warning in intake | AC-I10, AC-I12, AC-I19, AC-I20; existing broken-conditional | **Yes (commit 28fe3d4, live in 328ca295).** `broken-conditional` now resolves Annex X / Question N targets, so "complete Annex F" is reported as a conditional whose target does not exist. The missing-document request (Annex F in the GP request) still waits for intake |
| D7 | 13.1 Restrictions on Transfer, 2nd paragraph | `Eligible Transferee Certificate` (sentence: "...accompanied by a duly completed Eligible Transferee Certificate...") | Capitalized term defined nowhere (not in 01, not in 02 LPA, not in 03 PPM); also a form not in the package | `defined_term_issue` (undefined capitalized term) | medium | AC-I15; AC-I12 for the form | **No.** The existing `undefined-term` detector only covers offering-security nouns. Expected after intake: error "defined nowhere" even though the LPA is present |
| D8 | Many sections | Terms used in 01 but defined only in 02: Capital Commitment (1.2, 3.1 and more), Capital Contribution (3.1), Closing Date (2.1, 2.2), Defaulting Partner (3.3), Benefit Plan Investor (9.1 and more). Also Limited Partner, Management Fee, Qualified Purchaser (12.1), Side Letter (14.3), Transfer (13.1) | Terms defined in a package reference document | none expected | n/a (must NOT be flagged) | AC-I14 (LPA present: "defined in LPA", 0 false errors), AC-I16 (LPA absent: "unverified", counted in coverage) | Current build raises nothing for these (it has no generic undefined-term check), so there are 0 false positives today; the behaviour is verified only after intake ships |
| D9 | 2.1 Acceptance and Rejection, last sentence | `minimum Capital Commitment of $2,500,000` while Section 1.2 and the PPM (03) say `$5,000,000` | Stale minimum copied from Fund II (internal contradiction inside 01 and cross-document mismatch with 03) | `logic_contradiction` (needs the shared-values check) | high | **Future (U13, out of MVP scope)**. Record only; do not expect a finding in the MVP | No |
| D10 | Annex B Wire Instructions | `ABA 021000000` and `Acct 000123456789` | Bank routing and account numbers in the text | `sensitive_data` / `flag-sensitive` | medium | existing (masking) | Yes for the routing number (finding shows `ABA #0000`). The account-number row is part of the same block; verify masking in the UI |

Notes:
- The text "Class S" inside D4 is the only capitalized "Class" term and sits inside the drafting note. The current build raises no separate defined-term finding for it.
- The sub agreement also references `any Side Letter entered into with the Investor` (14.3) and `the Kestrel Side Letter` (6.4, 14.3, defined in 6.4). Both are references to a document type (Side Letter) that is not in the package. Expected after intake: both quotes listed, resolved "not in package" (AC-I10 to AC-I12, AC-I20).
- The carve-out sentence `Capitalized terms used but not defined herein have the meanings given to them in the Partnership Agreement.` (1.1) is the explicit external-definition reference for AC-I10 and AC-I14.
- Other references seeded for AC-I10/I11: `the PPM` and `the Partnership Agreement` (resolve to 03 and 02); IRS Forms W-9, W-8 (Section 8.1), W-8BEN, W-8BEN-E, W-8EXP, W-8IMY (Annex C) resolve to nothing (tax forms not in package, coverage partial).
- Expected findings on 01 from the current build: D1, D2, D3, D4, D5, D6, D10 and nothing else (7 total). D7, D8 and D9 are still not caught. Baseline 04 earlier produced the same minus D3 (5 total) because it is the same template; 04 contains the same Annex F reference, so its count may now also change (unverified, not re-measured).

## B. Variance items, 04 (baseline, Fund II) to 01 (Fund III)

Expected Changes view: 7 shown (3 new, 4 changed_logic) and the rest cosmetic and hidden. A rough paragraph-level diff of the two files gives about 60 differing paragraphs and about 50 token-level hunks, of which 7 are meaningful.

| ID | Location | New text (01) vs old (04) | Change type | Owner (rules table) | AC |
|---|---|---|---|---|---|
| V1 | New Section 7A "Source of Funds Verification" (7A.1 to 7A.3), `$1,000,000 (the "Verification Threshold")` | Absent in 04 | `new` | Fund admin | AC-V2, V5, V10, V11 |
| V2 | 4.3 Jurisdiction table: row "Singapore" | Absent in 04 | `new` | GP + counsel (two questions, AC-V12) | AC-V2, V5, V11, V12 |
| V3 | New 10.4 "Sanctions" (`Sanctions Laws`) | Absent in 04; 04 has only 10.1 to 10.3 | `new` | Counsel | AC-V2, V5, V11 |
| V4 | 4.2 Beneficial Owners | `Each Investor that is an entity formed or organized outside the United States shall provide the names of its beneficial owners.` vs `Each Investor that is an entity shall provide the names of its beneficial owners.` (7 added words) | `changed_logic` (US entities lose the question; old form rule not reusable) | Counsel | AC-V2, V5, V10, V11 |
| V5 | 1.2 Subscription and Minimum Commitment | `The minimum Capital Commitment is $5,000,000` vs `$2,500,000` | `changed_logic` | GP | AC-V2, V5, V11 |
| V6 | 6.2 Tax Status | `Tax status of the Investor (select all that apply):` vs `(check one):` | `changed_logic` | Counsel | AC-V2, V5 |
| V7 | 6.1 Investor Type table | Rows `Revocable trust (grantor trust)` and `Irrevocable trust` vs a single `Trust` | `changed_logic` | Counsel | AC-V2, V5 |

Cosmetic differences (expected hidden, grouped; roughly 50 hunks): fund name "Fund III" vs "Fund II" and GP name; roman numeral; "Interests" vs "Units" throughout (D3's stray "Units" is in both documents, so it is not a change); address "Suite 1400" vs "Suite 1200"; first closing, PPM and LPA dates (15 Sept 2026 / June 2026 vs 12 Sept 2024 / June 2024); Annex C paragraph labels `C.3` and `C.4` vs `C-3` and `C-4`; wire beneficiary account name. The stale `$2,500,000` in 2.1 is identical in both files and therefore not a variance item.

Impact checks (AC-V10) expected: V4 affects non-US entity investors (Halvorsen, Tanjong Pagar) and removes the question for US entities (Kestrel, the Whitfield trust); V7 affects trust investors (Whitfield Revocable Trust); V2 affects Tanjong Pagar; V1 affects every investor with a commitment of at least $1,000,000 (all five).

## C. Package-level expectations (intake)

| Expectation | Detail | AC |
|---|---|---|
| Type detection | 01 subscription agreement; 02 LPA; 03 PPM; 04 subscription agreement (prior fund); 05 AML/KYC requirements; 06 GP requirements note | AC-I4, I5 |
| Roles | 01 digitize; 02, 03 reference; 04 baseline (confirmed by the analyst, same firm); 05 reference (or requirement); 06 requirement | AC-I4, I9 |
| Missing documents (single GP request) | Annex F; Side Letter and Kestrel Side Letter; IRS tax forms (W-9, W-8BEN, W-8BEN-E, W-8EXP, W-8IMY) and FATCA/CRS self-certification; Eligible Transferee Certificate form. Each item carries its quote | AC-I10 to I12, I20 |
| Coverage | Tax-form group: partial. Undefined-terms group: full with 02, partial without. Numbers and eligibility group: full with 03/02. Variance group: full with 04 | AC-I17, I18 |
| Gate | Sub agreement present, so not blocked for that reason; missing LPA/PPM would only warn | AC-I19 |
| Cross-document (future, U13) | 01 Section 2.1 `$2,500,000` vs 03 `$5,000,000` and 01 Section 1.2 `$5,000,000`. 06 states "$5M, waivable", consistent with 01 Section 1.2, 02 Section 2.2 and 03 | out of MVP scope |
