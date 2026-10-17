# Package 03: Redwood Ridge Credit Opportunities Fund I, L.P.

FICTIONAL sample data for the Fund Package Intake feature. Every name, address, bank detail and number is invented. Nothing here is a real offering.

**Scenario in one line:** a first-time private-credit fund, papered by a law firm the tool has never seen, so there is no baseline and the first review runs Errors only.

Rebuild everything with `python3 samples/packages/03-redwood-ridge-credit-i/_build/build.py`, then verify with `python3 samples/packages/03-redwood-ridge-credit-i/_build/check.py`. Seeded defects and expectations are in `answer-key.md`.

## Parties

| Role | Name |
|---|---|
| Fund | Redwood Ridge Credit Opportunities Fund I, L.P., a Delaware limited partnership |
| General Partner | Redwood Ridge Credit GP I, LLC |
| Manager | Redwood Ridge Capital Advisors, LLC, 1600 Larimer Street, Suite 2200, Denver, CO 80202 |
| Key persons | Marcus Delgado (Founder and CIO), Priya Raman-Holt (COO and CCO) |
| Fund counsel (new firm, no history in the tool) | Sutter Lane & Abernathy LLP ("SL&A") |
| Administrator | Pinecroft Administration LLC |
| Auditor | Garner Hollis LLP |
| Subscription line lender | Front Range Commercial Bank (named in the LPA and PPM; the sub agreement has a placeholder, see F8) |

## Fund economics

| Item | Value |
|---|---|
| Strategy | Senior secured and unitranche loans to U.S. mid-market companies |
| Target / hard cap | $300M / $400M |
| Minimum commitment | $2,000,000 |
| Management fee | 1.5% on invested capital |
| Hurdle | 7%, simple (non-compounding) |
| Catch-up / carry | 50/50 GP catch-up, 15% carried interest, European (whole-fund) waterfall |
| GP commitment | 1.5% of aggregate commitments |
| Leverage | Subscription line up to 1.0x aggregate commitments |
| Investment period / term | 3 years / 7 years + 1 + 1 |

## Key dates

| Date | Event |
|---|---|
| 12 Oct 2026 | GP requirements email (document 05) |
| 26 Oct 2026 | GP wants the reviewed digital form |
| 1 Nov 2026 | First close |

## Investors (first close)

| # | Investor | Type | Country / state | Commitment | Tax form | Special terms |
|---|---|---|---|---|---|---|
| 1 | Aspen Hollow Medical Center Retirement Plan | ERISA plan | US / Colorado | $10M | W-9 | Benefit Plan Investor; Annex B required; counts toward the 25% test; source of funds (above $5M) |
| 2 | Whitcombe Mutual Insurance Company | US insurer, general account | US / Iowa | $20M | W-9 | General-account Plan Assets percentage (Section 8.4, Annex A Question 8); source of funds (above $5M) |
| 3 | Elena Marchetti | Italian resident individual, professional investor | Italy | $2,000,000 (the minimum) | W-8BEN | CRS self-certification; FATCA as non-US person; triggers the GP's $2M evidence rule but not the $5M rule |
| 4 | Blue Heron Logistics 401(k) Plan | ERISA plan | US / Georgia | $3M | W-9 | Benefit Plan Investor; Annex B required |
| 5 | Sandoval Family Foundation | US private foundation | US / New Mexico | $5M | W-9 | Tax-exempt, UBTI (Section 7.5); exactly $5M, so "more than $5,000,000" is not met |

First-close total is $40M. Benefit Plan Investors are $13M (32.5%) of that, before any general-account share. That is above 25% at this size and is only a business context point for the demo (at the $300M target the share would be about 4%). No detector computes it.

## Documents

| File | Expected type | Role | Notes |
|---|---|---|---|
| `docs/01-RR1-Subscription-Agreement.docx` | Subscription agreement | To digitize | Sections 1 to 13, Annex A (questionnaire, 14 questions), Annex B (ERISA), Annex C (wire), Annex D (signature pages). About 9,700 words, about 20 pages. Contains the 10 seeded defects |
| `docs/02-RR1-LPA-Definitions.docx` | LPA (extract: Article I only) | Reference | Defines Benefit Plan Investor, Plan Assets, Significant Participation, Capital Commitment, Hurdle Amount, Unfunded Commitment, Defaulting Partner, Subscription Facility and more. Later Articles are cross-referenced but not reproduced |
| `docs/03-RR1-PPM-Summary.docx` | PPM (summary of terms) | Reference | Economics, strategy, risks, ERISA and AML summary; consistent with the sub agreement |
| `docs/04-Pinecroft-AML-KYC-Checklist.docx` | AML/KYC checklist | Reference / requirement | Source-of-funds verification above $5,000,000 |
| `docs/05-GP-Requirements-Email.docx` | GP requirements note | Requirement | Says $2,000,000 or more (conflicts with the $5M elsewhere) |
| `docs/06-RR1-Tax-Forms-Guide-SCANNED.docx` | Tax forms guide | Reference | One page, a single embedded image, no text layer (see below) |

The scanned file is a DOCX whose only content is a PNG made with Pillow, titled "Tax Forms Guide - scanned copy". It has no body text, and no header or footer, so a text extractor finds nothing, as with a scanned PDF. The "FICTIONAL SAMPLE" notice is inside the image instead. A copy of the image is in `_build/scan-page.png`. Deviation from the common rule: the scan carries no header or footer text (it would give the file a text layer).

## What is deliberately missing

- **The full Partnership Agreement.** Only Article I is supplied, so the reference "Partnership Agreement" resolves to the LPA extract.
- **The Side Letter.** The sub agreement refers to "any Side Letter" (Sections 2.5(f), 13.1). None is supplied. Expected: "not in package".
- **Blank IRS forms** (W-9, W-8BEN, W-8BEN-E, W-8IMY). Referenced by name, not supplied. The Tax Forms Guide is scanned and unreadable without OCR.
- **A baseline.** New firm, first fund, no earlier SL&A document.

## Why this is a "first review"

SL&A is not in the firm list (`fixtures/memory/law-firms.json`) and has never produced a document the tool has seen. The package carries no document with role "baseline". By the variance rules (L5, L10, AC-V8) the run is Errors only, the Changes filter is empty, and the app shows the muted line saying no earlier document exists and that this document becomes the baseline. By AC-I2 the app also says that memory is not applied until a firm is chosen.

## Demo storyline and expected tool behaviour

1. **Drop all six files in one action** (AC-I1). The firm is not in the list, so the analyst cannot pick one; the app states memory is not applied (AC-I2).
2. **Detection** (AC-I4, AC-I5): files 01 to 05 get a type and role with a reason. File 06 is flagged "needs OCR" and coverage drops if OCR is not available (AC-I3).
3. **Baseline** (AC-I9): no document is marked baseline. The analyst sees "Errors only" and that the sub agreement will become the firm's baseline.
4. **References** (AC-I10 to AC-I12): "Partnership Agreement" resolves to document 02, "Memorandum" to document 03, "Side Letter" and the IRS forms are "not in package". Every quote is verbatim (AC-I13).
5. **Terms** (AC-I14 to AC-I16): Plan Assets, Significant Participation, Hurdle Amount and Subscription Facility show "defined in LPA" and are not errors. "Qualified Credit Investor" is still an error. Without the LPA the four would be "unverified", not errors.
6. **Findings** (see the answer key): the investor-path dead end and the ERISA branch inconsistency are the headline items; placeholder, drafting note and wire details are the quick wins.
7. **Questions and requirements**: the missing Side Letter and IRS forms go into one request to the GP (AC-I20). The GP's own email says $2,000,000 for source-of-funds evidence, which conflicts with Section 6.3 and the administrator's checklist ($5,000,000). That requirement-versus-document check (U12) is out of the MVP, so it is recorded as future in the answer key.

## What the current build does with document 01

A probe of the current core engine (DOCX adapter plus all registered detectors) on document 01 returns 4 findings: the placeholder (F8), the drafting note (F7) and two sensitive-data items (F10: routing and account number). The other seeded items are not yet caught; see the "Catches now?" column in the answer key.
