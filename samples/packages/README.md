# Fund package samples (fictional)

These are three **fictional** fund document packages. They are demo and test data for the Fund Package Intake and Variance Management features: upload a whole package, detect each document's type and role, resolve references across documents, report coverage, request missing documents, and classify changes against a baseline. They are also useful for exercising today's single-document review.

All people, firms, funds, addresses and account numbers are invented. Every page carries the header "FICTIONAL SAMPLE — test data for Sub-doc QA — not a real offering".

| Package | Scenario it tests | Main sub agreement | Other documents | Deliberately missing |
|---|---|---|---|---|
| [01-northgate-infrastructure-iii](01-northgate-infrastructure-iii/README.md) | **Complete package with a baseline.** Hartwell & Crane LLP has a prior fund (Fund II). Terms defined only in the LPA must not be flagged. Seven variance items vs Fund II. | 8,969 words (about 19 pages) | LPA definitions, PPM summary, Fund II baseline (8,491 words), administrator KYC matrix, GP email | Annex F (ERISA), Kestrel side letter |
| [02-lotus-bay-asia-growth-ii](02-lotus-bay-asia-growth-ii/README.md) | **Partial package.** No LPA, so coverage is partial and the LPA terms are "unverified". One request goes to the GP. Cayman master fund + US feeder. The baseline is the prior draft v1 of the same fund. | 8,666 words (about 18 pages) | Standalone questionnaire, PPM summary, v1 draft baseline (8,284 words), Sakura side letter, W-8 guide | LPA, Annex C (Cayman AML schedule), US Feeder subscription agreement |
| [03-redwood-ridge-credit-i](03-redwood-ridge-credit-i/README.md) | **First review.** New law firm (Sutter Lane & Abernathy), first fund, no baseline. ERISA investor paths. The GP email conflicts with the documents. One scanned file needs OCR. | 9,730 words (about 20 pages) | LPA definitions, PPM summary, administrator AML checklist, GP email, scanned tax guide (image only) | none; no baseline exists |

Each package folder contains:
- `docs/*.docx`: the files to upload.
- `README.md`: parties, investor personas (type, country, commitment, tax form), economics and waterfall, key dates, the role of each document, and the demo storyline.
- `answer-key.md`: every seeded defect with its exact quote, the expected issue class and severity, the acceptance criterion it exercises, and whether today's build catches it.
- `_build/`: the generator. Run `python3 _build/build.py` inside the package folder to rebuild `docs/`.

## Measured against today's build (core detectors plus package intake, live version 3d2c7301)

| Package | Seeded | Caught by the detectors | Package-level (intake, live) | Still missed |
|---|---|---|---|---|
| 01 Northgate III | 10 | 7 (D1, D2, D3, D4, D5, D6, D10); also 7 findings on the live site | D8 LPA-only terms shown "Defined in LPA" with 0 false errors; GP request has 7 items (Side Letter, Form W-9, Annex F, Form W-8BEN, Form W-8BEN-E, Form W-8EXP, Form W-8IMY) | D7 "Eligible Transferee Certificate" (not a reference family or listed term), D9 cross-document minimum (future) |
| 02 Lotus Bay II | 9 | predicted 2 (E8, E9); detector run not repeated | E1 terms: 4 of 6 listed "Unverified"; Annex C and the LPA "not in package"; GP requests 2 of 3 | E1 Excused Investor and Key Person Event not listed; third GP request "US Feeder Subscription Agreement" not extracted; contradiction, ambiguity, typo, currency need AI |
| 03 Redwood Ridge I | 10 | 4 (F1, F7, F8, F10); F1 "skip to Question 15" is newly caught | Side Letter and IRS forms requested; scanned guide flagged "needs OCR"; Subscription Facility "Defined in LPA" | F4 terms Plan Assets, Significant Participation, Hurdle Amount not listed; footnote row, xref coherence, option overlap, ambiguity |

Package-level items (D8 LPA-only terms, E1, F4, the missing documents and the coverage line) are now handled by Fund Package Intake, with the misses named above. Schedule and Exhibit targets and dash-style headings are not handled either.

## Firm tags and variance in the live demo (version d9aaddd9)

| Package | Firm tag on the Demo packages button | Variance in the live build |
|---|---|---|
| 01 Northgate III | Hartwell & Crane LLP | Baseline is Fund II (same firm). The Changes segment shows 9 rows (2 new + 7 logic) from 214 raw changes, not the answer key's 3 new + 4 logic, because digit changes in operative text count as logic. The V7 trust-split change is owned by the GP (SPEC A9); the answer key says Counsel. |
| 02 Lotus Bay II | Ostrander Pell LLP | Baseline is the v1 draft of the same fund. |
| 03 Redwood Ridge I | none (first review) | No baseline, so no Changes segment. Sutter Lane & Abernathy is not a seeded firm. |

Memory-backed variance needs a human Turnstile session on the live site.

## Use them as demo inputs

On the live site, open Upload and pick a package under "Demo packages" (Northgate Capital III, Lotus Bay Asia II, Redwood Ridge I), or drag the six files of a package's `docs/` folder into the Upload dialog. The demo copies live in `fixtures/package/design/`. Steps: [docs/walkthrough/demo-walkthrough.vi.md](../../docs/walkthrough/demo-walkthrough.vi.md) (Vietnamese). Package 01 is the primary demo: its "For the GP" group shows 7 items.

## Engine gap these samples exposed (fixed)

- **The cause:** the structurer recognised section headings written as `4. Title`, but not `Section 4. Title` or `Article I.`, and conditional targets such as `Annex F` or `Question 3` were not resolved.
- **The fix:** both are fixed in core (Intake Phase 1; D6 on package 01 by commit 28fe3d4) and live in the app with the intake UI (version 3d2c7301). Package 03 F1 is now caught.
- **Still open:** Schedule and Exhibit targets and dash-style headings are not handled.
