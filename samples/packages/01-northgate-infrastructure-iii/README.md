# Package 01: Northgate Infrastructure Fund III, L.P.

Fictional sample data for the Fund Package Intake and Variance features of the Sub-doc QA tool.
Every name, number and address is invented (555 phone numbers, example.com emails, fake ABA/account numbers). Each page of every file carries the banner "FICTIONAL SAMPLE - test data for Sub-doc QA - not a real offering".

This is the happy path: a complete package, a prior-fund baseline from the same law firm, and a small set of seeded gaps. Expected findings are in `answer-key.md`. Regenerate everything with `python3 _build/build.py` (needs python-docx).

## Parties

| Role | Name |
|---|---|
| Fund | Northgate Infrastructure Fund III, L.P., Delaware limited partnership |
| General Partner | Northgate Infrastructure Partners III GP, LLC (Delaware) |
| Manager | Northgate Capital Management, LLC, 200 Harborview Drive, Suite 1400, Boston, MA 02110. Eleanor Voss (Managing Partner), Daniel Okafor (CIO) |
| Fund counsel (the firm) | Hartwell & Crane LLP, New York. Partner Margaret Lin |
| Administrator (AML/KYC) | Meridale Fund Services Ltd. |
| Auditor | Ashby Kerr LLP |
| Prior fund (baseline) | Northgate Infrastructure Fund II, L.P., first closing 12 Sept 2024, same firm |

## Fund economics

| Item | Fund III | Fund II (baseline) |
|---|---|---|
| Size | Target $750M, hard cap $1.0B | not modelled |
| Minimum commitment | $5,000,000, waivable by the GP | $2,500,000 |
| GP commitment | 2% | 2% |
| Management fee | 1.75% of commitments in a 5-year investment period, then 1.25% of net invested capital | same |
| Waterfall | European (whole-fund): return of capital, then 8% preferred return compounded annually, 100% GP catch-up, then 80/20. Clawback | same |
| Term | 10 years after final closing plus 2 x 1-year extensions | same |
| Source-of-funds threshold | $1,000,000 (new Section 7A) | none |

## Key dates

| Date | Event |
|---|---|
| June 2026 | PPM date |
| 24 Aug 2026 | Eleanor Voss requirements email |
| 15 Sept 2026 | First closing (and date of the LPA) |
| 15 Sept 2027 | Final closing at the latest (12 months after first closing). The sub agreement leaves it as the placeholder `[insert Final Closing Date]` on purpose |

## Investors (personas for the demo)

| # | Investor | Type | Country / state | Commitment | Tax form | Special terms |
|---|---|---|---|---|---|---|
| 1 | Kestrel State Teachers' Retirement System | US governmental plan | USA / Ohio | $50M | W-9 | Side letter: MFN + ESG reporting (the Kestrel Side Letter, **not in package**) |
| 2 | Halvorsen Family Office AS | Entity | Norway (EEA) | $15M | W-8BEN-E, CRS self-certification | Beneficial owners required (entity formed outside the US) |
| 3 | Tanjong Pagar Holdings Pte. Ltd. | Entity | Singapore | $20M | W-8BEN-E | Needs the NEW Singapore domicile option; beneficial owners required |
| 4 | Margaret A. Whitfield Revocable Trust | Revocable trust | USA / Massachusetts | $5M | W-9 | Exercises the revocable vs irrevocable trust split; exactly at the new $5M minimum |
| 5 | Dr. Linh Vo | Natural person | USA / California | $5M | W-9 | Accredited investor and Qualified Purchaser |

All five commitments are at or above $1,000,000, so every investor falls under the new Section 7A source-of-funds rule. Total of the five: $95M.

## Documents (`docs/`)

| File | Expected type | Expected role | Purpose | Approx. words |
|---|---|---|---|---|
| `01-NG3-Subscription-Agreement.docx` | Subscription agreement (with investor questionnaire annexes) | digitize | The document under review. Sections 1-14 plus 7A, Annex A (questionnaire), B (wire), C (tax forms guide), D (AML/KYC documents), E (signature pages). 18-19 est. pages | 8,970 |
| `02-NG3-LPA-Definitions-and-Key-Terms.docx` | LPA (extract: definitions and key articles) | reference | Defines the terms the sub agreement relies on; economics, default, transfer, ERISA 25% test, MFN | 3,930 |
| `03-NG3-PPM-Summary-of-Terms.docx` | PPM (summary of terms) | reference | Same economics; minimum $5,000,000 | 2,170 |
| `04-NG2-Subscription-Agreement-2024.docx` | Subscription agreement, prior fund (same firm) | baseline | Fund II on the same template; differs from 01 by exactly the seven variance items plus cosmetics | 8,490 |
| `05-Meridale-AML-KYC-Requirements.docx` | AML/KYC requirements (administrator) | reference (a "requirement" role is also acceptable; it is not turned into a form) | KYC matrix by investor type, $1,000,000 source-of-funds threshold, consistent with Section 7A | 1,290 |
| `06-GP-Email-Requirements-Note.docx` | GP requirements note (email) | requirement | "accept Singapore investors", "minimum $5M, waivable", "sanctions rep required" and more | 570 |

Note on the baseline: 04 is a copy of the same template, so it carries the same template-level seeded quirks as 01 (the drafting note, the placeholder, the self-reference, the swapped Part B reference, the wire block, the missing Annex F and Kestrel references, the stale `$2,500,000` in Section 2.1). They are deliberately identical so that they do not show up as variance; only the seven items below do. Defects are asserted in the answer key for 01 only.

## What is deliberately missing

| Missing item | Referenced from | Expected tool behaviour |
|---|---|---|
| Annex F (ERISA Representations) | 01 Section 9.1, twice | Reference "not in package"; one line in the request to the GP |
| The Kestrel Side Letter and any other Side Letter | 01 Sections 6.4 and 14.3 | Reference "not in package"; in the same request |
| IRS tax forms (W-9, W-8BEN, W-8BEN-E, W-8EXP, W-8IMY), FATCA/CRS self-certification | 01 Section 8 and Annex C | Tax-form coverage group: partial (only form names can be checked) |
| Eligible Transferee Certificate (form) | 01 Section 13.1 | Reference "not in package" (and the term itself is undefined everywhere, see answer key D7) |

## Demo storyline

1. **Upload.** Drop all six files at once (AC-I1). Choose firm Hartwell & Crane LLP, fund "Northgate Infrastructure Fund III", version "2026".
2. **Detection.** Types and roles appear with reasons: 01 subscription agreement (digitize), 02 LPA and 03 PPM (reference), 04 subscription agreement (candidate baseline), 05 AML/KYC requirements, 06 requirement note. The analyst marks 04 as **baseline** (same firm only; AC-I9).
3. **Map and coverage.** References resolve to 02 (Partnership Agreement) and 03 (PPM). Unresolved: Annex F, Side Letter and Kestrel Side Letter, tax forms, Eligible Transferee Certificate. Coverage: references and conditional logic full; undefined terms full (LPA present); numbers and investor eligibility full (PPM present); tax forms partial; what changed full (baseline present).
4. **Defined terms.** About ten terms used in 01 are defined only in 02 (Capital Commitment, Capital Contribution, Closing Date, Defaulting Partner, Benefit Plan Investor, Limited Partner, Management Fee, Qualified Purchaser, Side Letter, Transfer). They show "defined in LPA" with the definition quote and no error (AC-I14). "Eligible Transferee Certificate" is still reported (AC-I15). Re-run without file 02: the terms become "unverified" with a coverage note, not errors (AC-I16).
5. **Findings on 01.** The existing detectors report the swapped Part B reference, the wrong "this Section" reference, the stray "Units", the drafting note, the placeholder and the wire block (see answer key).
6. **Variance.** Versus 04 the Changes view shows 7 meaningful items (3 new, 4 logic) and hides the cosmetic ones: new Section 7A; Singapore domicile; new Section 10.4 Sanctions; Section 4.2 now limited to non-US entities; minimum $5,000,000; tax status "select all that apply"; trusts split into revocable and irrevocable (AC-V2..V5, V10).
7. **Questions.** One request to the GP lists every missing document with its quote (AC-I20). Variance questions go to owners (7A to the administrator; Singapore to GP and counsel; sanctions and 4.2 to counsel; minimum to the GP).
8. **Gate.** Missing documents warn only (AC-I19); the gate stays Blocked while critical items, unanswered questions and untriaged changes remain, and the coverage line (tax forms partial) is shown beside it (AC-I18).
9. **Requirements note (06, future/P1).** The email requirements are consistent with 01 apart from the stale `$2,500,000` in Section 2.1, which is the cross-document item for U13.
