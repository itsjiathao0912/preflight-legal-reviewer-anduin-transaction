---
name: subdoc-qa-mvp-research
description: Consolidated RESEARCH findings for the sub-doc QA MVP (sample-corpus structure, golden defects, OpenRouter/OCR/Cloudflare constraints)
date: 2026-10-17
metadata:
  type: report
  phase: RESEARCH
---

# Sub-doc QA MVP — RESEARCH report (17-10-26)

Two parallel read-only research agents ran: (A) the real sample corpus and (B) external platform facts.
Both returned DONE_WITH_CONCERNS. A spot-checked #4, #7, #8, #10, #12 and #13, and viewed only 2 of the 22 scan pages.
B relied on docs fetched with curl plus the live OpenRouter `/api/v1/models` API.

## A. Corpus facts (samples/sub-docs/raw)

### Golden findings (verified real defects, usable as demo + regression fixtures)

| Doc | Location | Evidence | Class |
|---|---|---|---|
| #1 Franklin Lexington 2024 | Sec 12 (Qualified Client), paras 5 and 6 | "paragraphs 1 through 4 of this Section 11" (should be Section 12) | Broken cross-reference |
| #3 PG Master 2019 | Instructions checklist | "Custodian indicated in Part B of Section 6" (custodian is Sec 4) | Broken cross-reference |
| #3 PG Master 2019 | Instructions checklist | "amount specified in Part B of Section 4" (amount is Sec 6 Part B) | Broken cross-reference |
| #5 PG NGI 2024 | Instructions | the same two swapped references as #3 | Broken cross-reference; fixed in #6, so also a drift signal |
| #9 RW Holdings scan A-1 p.1 | Sec 2 Account Type grid | Partnership/LLC lacks footnote 2 (attach entity docs); Corporation/Trust/Other have it, and the later #8 Modiv form has it | Inconsistent requirement (OCR path) |
| #11 Medalist 2016 | Intro | "the offered Units will not be…" (the defined term is "Shares") | Undefined / inconsistent term |
| #6 PG NGI 2026 | throughout | "LLC Agreement" kept (10x) after Units→Shares rename | Possible terminology drift (low confidence) |

Also flag-worthy, though not defects: the #5 drafting note "NTD: PG to confirm factual information…"; placeholder brackets
`[xx]`, `[insert investor name]`; fund bank account numbers (ABA/DDA) in #1 and #7 (sensitive data); `[***]` redactions in #12.

### Version-drift pairs
- **#5 → #6 (PG NGI 2024 → June 2026):**
  - Terminology changed: Units→Shares, Member→Shareholder, Memorandum→Prospectus, placement agent→distributor, Placement Fee→Sales Load.
  - Fees became class-specific: Sales Load 3.5% for A and 1.5% for S.
  - Appendix C was removed.
  - Both broken references were fixed.
  - The drafting note and placeholders were removed.
  - The section list (1–12) and Parts A–D are unchanged.
- **#3 vs #4 (PG Master 2019 vs TEI 2016):** the structure was reorganized (Appendix A Sections 1–7 became Sections 1–12 with Parts). #4 adds a footnote routing ERISA investors to another feeder.
- **#2 Coatue:** the RIA and broker-dealer variants sit in one file with no delimiter. The only marker is the page-header suffix "– RIAs" dropping at about page 18 of 32. Section 7 differs between them.

### Conditional-instruction patterns (graph edges)
- Section whitelist: "Please complete Sections 1, 6, 7, 10, 11, 12 and 13 only…" (#1).
- Role routing: "FINRA-Registered Representatives must complete Section 14A" (#1).
- Option→section requirement: "Additional documentation required in Section 4C" (#2).
- Negative gate: "Only complete … if you do not wish to enroll" (#2).
- Skip: "if you check this box, proceed to question 6" (#10).
- Entity extra part: "…entities must also complete Part C" (#3/#5).
- State-list gate: residents of AL, AR… are not auto-enrolled (#13).
- Act-on-negation: "Cross out number 2 if…" (#4, #7, #2).

### Parser implications (hard facts)
1. **No `<h1>`–`<h6>` tags anywhere.** Headings come from text patterns ("N. TITLE", "Part X –", "Appendix X", "4A") plus bold/caps cues.
2. **Section numbers often sit in their own `<td>`,** so table cells must be merged into logical lines before reading numbers.
3. **Numbering restarts inside one doc** (acknowledgements 1–13, suitability 1–22 then 1–6, questions per Part), so reference targets need a scope.
4. **"Section X" also appears in statutory cites,** such as "Section 3(c)(1) of the 1940 Act" or "Section 501(c)(3) of the Code", which must be separated from internal references. Raw hit counts per doc are 4–80.
5. **Compound and inverted reference forms exist:** "Part B of Section 6", "Section 3 of Appendix A", "paragraph (21) above", "Section 3.10(d)", "this Section 11".
6. **Checkbox encodings vary:** `☐` U+2610, `¨` (Wingdings), `[ ]`, `o`, `☒` (pre-filled), empty bordered cells, images. #7 hides its text in 159 white 0.5pt runs over images.
7. **Exclusivity cues to parse:** "check only one", "select only one", "Check One Box Only", "(circle one)", "check all that apply", "please mark one".
8. **Page-label prefixes don't match appendix letters** (#5/#6: Appendix A is on pages "C-x"), so page labels can't identify appendices.
9. **Noise to strip:** EDGAR wrapper lines (`EX-99.(P)(2)`, filename), running headers and footers, "N of 32" counters, "[Logo]".
10. **Defined terms:** mostly inline `(the "X")`, plus `"X" means` glossaries and "(as defined in Appendix A)".
11. **Fillable fields** appear as underscore runs, label + empty cell, image boxes (scans), "Date | Signature" cells, and hints like "(must be completed)".
12. **OCR (#9):** 2612×3568 px at 1200 DPI, crisp. The difficulty is layout, not legibility: 3-column checkbox grids with empty white boxes, superscript footnote markers, gray panels and initials boxes. Reading must be position-aware.

## B. Platform constraints (as of 2026-10-17)

### OpenRouter
- **Free tier limits:** 20 requests/min and 50/day. Once at least $10 of credits has been bought (about $9 in practice), the limit becomes **1000/day**. Counters reset at UTC midnight. `GET /api/v1/key` reports `free_model_daily_requests`.
- **Errors:** 429 comes either from the platform or from the upstream provider (honor `Retry-After`). A negative balance returns 402 even for free models.
- **Fallback:** a `models: [...]` array is tried in priority order on any error, and billing goes to the model that answered.
- **Free text model with strict JSON schema:** `nvidia/nemotron-3-super-120b-a12b:free` (262k context, `structured_outputs`). There is also the `openrouter/free` router.
- **Free vision models:**
  - `nvidia/nemotron-3.5-super-vl:free`: 1M context, `structured_outputs`. The best OCR candidate.
  - `google/gemma-4-31b-it:free` and `google/gemma-4-26b-a4b-it:free`: JSON mode only, no strict schema.
  - `dots-studio/dots-3-note-preview:free`.
  - Free model IDs rotate, so the app needs a configurable model list.
- **Cheap paid fallbacks** ($ per million tokens, input/output):
  - Text: `openai/gpt-oss-20b` (0.018/0.09), `mistralai/mistral-nemo` (0.029/0.03).
  - Vision: `nex-agi/nex-n2.5-mini` (0.025/0.10), `google/gemma-3-4b-it` (0.05/0.10), `google/gemma-3-12b-it` (0.05/0.15).
  - Images are billed as input tokens.
- **PDF input:** sent as the `file` content type, with the engine set through the `file-parser` plugin:
  - `cloudflare-ai` is free (likely text-layer only).
  - `mistral-ocr` costs $2 per 1000 pages and is best for scans.
  - `native` is billed as tokens.
  - If no engine is set, OpenRouter may fall back to the **paid** mistral-ocr. **The app must always set the engine explicitly.**

### Cloudflare
- **Workers limits:**

  | Limit | Free | Paid |
  |---|---|---|
  | CPU per request | **10 ms** | 30 s (up to 5 min) |
  | Subrequests | 50 | 10,000 |
  | Requests per day | 100k | — |
  | Memory | 128 MB | 128 MB |
  | Bundle size (uncompressed) | 64 MiB | 64 MiB |
  | Startup time | 1 s | 1 s |

- **LLM wait time is not CPU time.** `waitUntil` allows up to 30 s after the response. Queues and Durable Object alarms are capped at 15 min.
- **Storage (free tier):**
  - D1: 500 MB per DB, 2 MB per row, 50 queries per invocation.
  - KV: 1,000 writes/day, so it is a poor fit for a cache.
  - R2: 10 GB, free egress.
- **Workers AI:** 10k neurons/day free, 20 requests/min. It has vision models (llama-3.2-11b-vision, mistral-small-3.1, gemma-4, moondream). There is no dedicated OCR model. `toMarkdown` gives free PDF text extraction.
- **unpdf** runs on Workers for text extraction; page rendering needs a canvas, which Workers lacks.
- **Tesseract.js** runs in the browser (WASM). It needs a PDF page rendered to an image first, and its accuracy on forms is unverified.

### Implications to carry into SPEC and INNOVATE
- Heavy parsing (large HTML, PDF, the Docxodus WASM) does **not** fit Workers Free's 10 ms CPU limit. Either do it in the browser, or use **Workers Paid ($5/mo)**, which is a user decision.
- On the Free plan, per-clause LLM fan-out hits the 50-subrequest cap, so calls must be batched or moved to the client or a queue.
- Cache LLM and OCR results in D1/R2 (not KV), keyed by doc hash + model + prompt version.

## Probes still needed (vc-feasibility-test candidates)
1. OCR quality of free vision models (nemotron-3.5-super-vl, gemma-4) vs paid mistral-ocr on 3–5 #9 pages. The key test is whether the missing footnote 2 on Partnership/LLC survives OCR.
2. Whether free models actually honor the JSON schema, plus their latency and concurrency.
3. Docxodus WASM size and startup against the 64 MiB / 1 s / 128 MB limits.
4. unpdf CPU cost per page vs the 10 ms Free limit.
5. Whether the `cloudflare-ai` PDF engine does any OCR on scans.
