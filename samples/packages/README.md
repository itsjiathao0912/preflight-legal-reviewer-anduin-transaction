# Fund package samples (fictional)

These are three **fictional** fund document packages. They are demo and test data for the Fund Package Intake and Variance Management features: upload a whole package, detect each document's type and role, resolve references across documents, report coverage, request missing documents, and classify changes against a baseline. They are also useful for exercising today's single-document review.

All people, firms, funds, addresses and account numbers are invented. Every page carries the header "FICTIONAL SAMPLE — test data for Sub-doc QA — not a real offering".

| Package | Scenario it tests | Main sub agreement | Other documents | Deliberately missing |
|---|---|---|---|---|
| [01-northgate-infrastructure-iii](01-northgate-infrastructure-iii/README.md) | **Complete package with a baseline.** Hartwell & Crane LLP has a prior fund (Fund II). Terms defined only in the LPA must not be flagged. Seven variance items vs Fund II. | 8,865 words (about 19 pages) | LPA definitions, PPM summary, Fund II baseline (8,397 words), administrator KYC matrix, GP email | Annex F (ERISA), Kestrel side letter |
| [02-lotus-bay-asia-growth-ii](02-lotus-bay-asia-growth-ii/README.md) | **Partial package.** No LPA, so coverage is partial and the LPA terms are "unverified". One request goes to the GP. Cayman master fund + US feeder. The baseline is the prior draft v1 of the same fund. | 8,666 words (about 18 pages) | Standalone questionnaire, PPM summary, v1 draft baseline (8,284 words), Sakura side letter, W-8 guide | LPA, Annex C (Cayman AML schedule), US Feeder subscription agreement |
| [03-redwood-ridge-credit-i](03-redwood-ridge-credit-i/README.md) | **First review.** New law firm (Sutter Lane & Abernathy), first fund, no baseline. ERISA investor paths. The GP email conflicts with the documents. One scanned file needs OCR. | 9,730 words (about 20 pages) | LPA definitions, PPM summary, administrator AML checklist, GP email, scanned tax guide (image only) | none; no baseline exists |

Each package folder contains:
- `docs/*.docx`: the files to upload.
- `README.md`: parties, investor personas (type, country, commitment, tax form), economics and waterfall, key dates, the role of each document, and the demo storyline.
- `answer-key.md`: every seeded defect with its exact quote, the expected issue class and severity, the acceptance criterion it exercises, and whether today's build catches it.
- `_build/`: the generator. Run `python3 _build/build.py` inside the package folder to rebuild `docs/`.

## Measured against today's build (core detectors run on the DOCX)

| Package | Seeded | Caught today | Waits for intake / variance / AI |
|---|---|---|---|
| 01 Northgate III | 10 | 6 (D1, D2, D3, D4, D5, D10) | D6 Annex F target, D7 term defined nowhere, D8 LPA-only terms, D9 cross-document minimum |
| 02 Lotus Bay II | 9 | predicted 2 (E8, E9); not run | LPA-deferred terms, Annex C, contradiction, ambiguity, typo, currency |
| 03 Redwood Ridge I | 10 | 4 (F7, F8, F10 ×2) | Question-target dead end, footnote row, xref coherence, LPA terms, option overlap, ambiguity |

## Known engine gap these samples expose

- **The cause:** the structurer recognises section headings written as `4. Title`, but **not** `Section 4. Title`, and probably not `Article I.` either.
- **Package 01** uses the `4. Title` form, so the engine sees its sections.
- **Packages 02 and 03** use `Section N.` headings, as many real agreements do, so the engine may find no sections in them. That would weaken reference and investor-path checks.
- **Intake will need this anyway**, because LPAs use `Article` headings.
- This is reported to the build session as a fix to make before intake.
