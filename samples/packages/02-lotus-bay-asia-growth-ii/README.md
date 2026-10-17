# Package 2: Lotus Bay Asia Growth Fund II, L.P. (partial package, prior-draft baseline)

> FICTIONAL SAMPLE. Every person, firm, fund, licence number, address, phone number and bank detail is invented.
> Test data for the Sub-doc QA "Fund Package Intake" feature. Not a real offering.

## Why this package exists

It exercises the **partial-package** path of Fund Package Intake:

- The Partnership Agreement (LPA) is **not uploaded**, so every term the sub agreement defers to the LPA must be "unverified", never an error (AC-I16).
- Annex C and the US Feeder Subscription Agreement are referenced but absent, so the tool must list them in one request to the GP (AC-I12, AC-I20).
- The **baseline is a prior draft (v1) of the same fund**, not another fund. This tests the baseline role (AC-I9) and variance on a version pair.

Rebuild everything with `python3 samples/packages/02-lotus-bay-asia-growth-ii/_build/build.py`; verify with `python3 .../_build/check.py`.

## Parties

| Role | Name |
|---|---|
| Master fund | Lotus Bay Asia Growth Fund II, L.P. (Cayman Islands exempted limited partnership) |
| Parallel vehicle | Lotus Bay Asia Growth Fund II (US Feeder), L.P. (Delaware) for US taxable and tax-exempt investors |
| General Partner | Lotus Bay GP II Ltd. (Cayman Islands exempted company) |
| Manager | Lotus Bay Capital Pte. Ltd., 8 Marina View, #40-01, Singapore 018960 (capital markets services licence CMS-100777, fictional) |
| Key persons | Wei Ling Tan (Managing Partner), Rahul Iyer (Partner), Nguyen Minh Chau (Vietnam Head) |
| Administrator | Harbourline Fund Administration (Cayman) Ltd. |
| Auditor | Pell & Quayside |
| Counsel | Ostrander Pell LLP (Singapore and US), Calder Reyes (Cayman) |

## Fund structure (text diagram)

```
 Direct offshore investors                         US taxable / tax-exempt investors
 (SG, HK, JP, VN: this package)                    (US Persons)
            |                                                   |
            | Offshore Subscription Agreement                   | US Feeder Subscription Agreement (NOT in package)
            v                                                   v
 +-----------------------------------+             +------------------------------------+
 | Lotus Bay Asia Growth Fund II, LP |<------------| Lotus Bay Asia Growth Fund II      |
 | (Cayman master fund)              |  invests    | (US Feeder), L.P. (Delaware)       |
 +-----------------------------------+  pro rata   +------------------------------------+
            ^
            | general partner / advised by
 Lotus Bay GP II Ltd. (Cayman)  /  Lotus Bay Capital Pte. Ltd. (Singapore manager)
```

## Investors

| # | Investor | Type | Country | Commitment | Tax form | Special terms |
|---|---|---|---|---|---|---|
| 1 | Mekong Pearl Life Insurance JSC | Insurer | Vietnam | $25,000,000 | W-8BEN-E, CRS | Vietnamese foreign-investment approval letter required |
| 2 | Sakura Kogyo Employees' Pension Fund | Pension | Japan | $40,000,000 | W-8BEN-E | Side letter: Japanese-language reporting, MFN, excuse right (doc 05) |
| 3 | Arun Mehta | Individual (accredited investor) | Singapore | $1,000,000 | W-8BEN | Below the $3,000,000 minimum; needs a GP waiver (Section 2.3) |
| 4 | Banyan Lane Trustees Ltd. as trustee of the Chen Family Trust | Trust (professional investor) | Hong Kong | $10,000,000 | W-8BEN-E | None |
| 5 | Cascade Ridge University Endowment | US tax-exempt | United States, via the US Feeder | $15,000,000 | W-9 | UBTI blocker election; subscribes under the US Feeder agreement (not in package) |

Total of the five: $91,000,000 against a $400,000,000 target.

## Fund economics (version 2 and PPM summary agree)

| Item | Term |
|---|---|
| Size | Target $400M, hard cap $500M, USD |
| Minimum commitment | $3,000,000 (GP may accept less); v1 draft said $5,000,000 |
| Management fee | 2.0% of commitments during a 4-year investment period, then 1.5% of invested capital |
| Waterfall | American (deal-by-deal): 8% preferred return, 100% catch-up, 20% carried interest |
| Carried interest escrow | 30% of carry held in escrow; v1 draft said 25% |
| Term | 10 years from initial closing; key persons clause (key person event suspends the investment period) |

## Key dates

| Date | Event |
|---|---|
| Aug 2026 | Draft version 1 of the offshore subscription agreement (doc 04) |
| 12 Oct 2026 | Sakura side letter (doc 05) |
| Oct 2026 | Version 2 of the subscription agreement (doc 01), questionnaire (doc 02), PPM summary (doc 03), Harbourline tax guide (doc 06) |
| 15 Dec 2026 | Expected initial closing; documents due at least 10 Business Days earlier |
| 15 Dec 2027 | Last closing (12 months after initial closing) |
| 15 Dec 2030 | End of investment period (4 years) |
| 15 Dec 2036 | End of term (10 years) |

## Document list

| File | Expected type | Expected role | Notes |
|---|---|---|---|
| `docs/01-LB2-Subscription-Agreement-Offshore-v2.docx` | Subscription agreement | To digitize | Current version, Sections 1-15, Annexes A, B, D, E (no Annex C). Carries seeded defects E1-E9. |
| `docs/02-LB2-Investor-Questionnaire-Standalone.docx` | Investor questionnaire | To digitize | Separate questionnaire: investor-type branches (includes Fund of funds and Other), professional-investor tests per country, PEP questionnaire. |
| `docs/03-LB2-PPM-Summary.docx` | PPM (summary) | Reference | Numbers agree with v2: size, minimum, fees, waterfall, 30% escrow, term. |
| `docs/04-LB2-Subscription-Agreement-Offshore-v1-draft.docx` | Subscription agreement | Baseline | Prior draft of the same fund (Aug 2026). |
| `docs/05-Sakura-Side-Letter.docx` | Side letter | Reference | Japanese reporting, MFN, excuse right; investor 2 only. |
| `docs/06-Harbourline-W8-Guide.docx` | Tax form guide | Reference | Which W-8 or W-9 for which investor type. |

## What is deliberately missing

The tool must list these three in one GP request, each with the quote that references it:

1. **Partnership Agreement (LPA).** Referenced in Section 1.2 ("...meanings given to them in the Partnership Agreement"), Section 1.1, and throughout.
2. **Annex C (Cayman AML Schedule).** Referenced in Sections 3.2, 6.2 and 9.5.
3. **US Feeder Subscription Agreement.** Referenced in Sections 1.1 and 2.6, and Annex A Part 6.

The Private Placement Memorandum (03), the Side Letter (05, resolves "any Side Letter" for Sakura only) and the Tax Form Selection Guide (06) are present and should resolve.

## Demo storyline

1. Drop all six files. Detection labels 01 and 02 "to digitize", 03, 05 and 06 "reference", and 04 asks to be confirmed as baseline (same firm and fund, different version label).
2. The package map shows three unresolved references: LPA, Annex C, US Feeder Subscription Agreement.
3. Coverage line reads partial: definition checks run in "unverified" mode, cross-document number checks run against the PPM only.
4. Findings: no false "undefined term" errors for the six LPA-deferred terms; they are listed as unverified. Real defects appear (E2-E9).
5. Variance against doc 04 shows the five intended v1-to-v2 changes plus the silent typo in Section 10.4.
6. Questions tab: one GP request with three items. Export once.
7. The gate warns (LPA missing) but is not blocked, because the sub agreement is present (AC-I19).

## Expected tool behaviour in one line

Partial coverage is stated honestly, nothing is falsely flagged for missing context, and one request to the GP asks for everything missing. See `answer-key.md` for each seeded issue.
