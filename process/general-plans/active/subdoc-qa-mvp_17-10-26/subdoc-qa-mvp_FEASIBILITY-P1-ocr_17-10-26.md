---
slug: subdoc-qa-mvp
date: 2026-10-17
verdict: VIABLE
originating-phase: spec
---

# Feasibility P1: free vision-model OCR of the RW Holdings Account Type grid

**TL;DR:** `nvidia/nemotron-3.5-super-vl:free` read the whole page correctly in 3 of 3 runs: all 16 option labels, every footnote marker (Partnership/LLC correctly has none, Corporation correctly has 2), and both footnote texts verbatim. The catch is speed: 17 to 88 s per page, with no spread of fallbacks, because `gemma-4-31b-it:free` returned 429 every time and `dots-3-note-preview:free` ran out of tokens thinking. The paid OCR attempt was not needed and is recorded as pending user credit top-up.

## Hypothesis
At least one free OpenRouter vision model transcribes `appa1-pg1.jpg` (sample #9, Account Type grid) with at least 15/16 option labels and at least 90% footnote-marker accuracy, including Partnership/LLC = no marker, so AC14 and AC23 can rely on free OCR.

## Mechanism Under Test
Free vision models, given a downscaled scan and a structured-JSON prompt (`response_format: json_object`), preserve small superscript footnote markers per checkbox option and reproduce footnote text. Related: SPEC AC14, AC23, R5; RESEARCH section B.

## Probe Family
4 — External API shape capture (live OpenRouter requests).

## Probe Cost Class
`needs-live-provider`. Safety gate met: the user opted in explicitly in chat for live OpenRouter calls for P1/P2 on free models. Only `:free` model ids were called. All successful responses reported `cost: 0`. The paid OCR fallback was NOT attempted (account has $0 credits and it would return 402): **pending user credit top-up**.

## Probe Method
- Verified model ids via `GET /api/v1/models` (free, not counted): all three vision candidates still listed. `nemotron-3.5-super-vl` and `dots-3-note-preview` advertise `structured_outputs`; `gemma-4-31b-it` advertises `response_format` only.
- Downscaled with `sips -Z 1600` (2612x3568 to about 1170x1600, 129 KB). One extra run at full resolution.
- One chat-completions request per run, `temperature: 0`, image as a base64 data URL, prompt asking for JSON `{title, sections[{number,title,instruction,options[{label,footnote_marker|null}],footnotes[{marker,text}],field_labels[]}]}` and told "report only what is visibly printed; null if no superscript".
- Ground truth was confirmed by viewing the image myself: 16 options; marker 1 on Joint Tenants, Tenants in Common, Community Property; marker 2 on Trust, Pension Plan, Profit Sharing Plan, KEOGH Plan, Other, Corporation; none on Individual, Solo 401K, Traditional IRA, Simple IRA, SEP IRA, ROTH IRA, Partnership/LLC.
- Scoring script matched labels to the ground-truth list and compared markers. Scratch files live in the session scratchpad `probes/` folder (outside the repo). The API key was never printed or written.

## Evidence Captured

**Raw results table**

| # | Model | Input | Latency | HTTP | JSON parsed | Labels /16 | Marker correct /16 | Partnership/LLC = none | Corporation = 2 | Footnote texts |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | nemotron-3.5-super-vl:free | 1600px | 17.1 s | 200 | yes | 16 | 16 | yes | yes | both verbatim |
| 2 | nemotron-3.5-super-vl:free | 1600px (repeat) | 88.2 s | 200 | yes | 16 | 16 | yes | yes | both verbatim |
| 3 | nemotron-3.5-super-vl:free | full 2612px | 53.9 s | 200 | yes | 16 | 16 | yes | yes | both verbatim |
| 4 | gemma-4-31b-it:free | 1600px | 0.8 s | 429 | n/a | n/a | n/a | n/a | n/a | n/a |
| 5 | gemma-4-31b-it:free | 1600px (retry after 15 s) | 1.6 s | 429 | n/a | n/a | n/a | n/a | n/a | n/a |
| 6 | dots-3-note-preview:free | 1600px | 44.7 s | 200 | no (empty `content`) | n/a | n/a | n/a | n/a | n/a |

Notes:
- nemotron-3.5-super-vl latency p50 is 53.9 s (range 17.1 to 88.2 s). Prompt tokens 2,026 at 1600px vs 3,459 at full size; completion tokens 2.6k to 3.4k. Full resolution gave no accuracy gain, so downscaling is safe.
- Also correct and worth noting: the model captured section 1 and section 3 field labels and the "(Check One Box Only)" instruction.
- gemma 429 body: "temporarily rate-limited upstream" (provider Google AI Studio). No `Retry-After` header was returned, so I waited 15 s and retried once, then stopped that model (it also 429'd in P2: 3 of 3 in total for the 31b id).
- dots-3: finished with `finish_reason: length`; all 4,000 completion tokens went into hidden `reasoning` (14.6k chars) and `content` was empty. Not tested with a larger token budget, so its quality is unknown, not disproven.
- Excerpt of the model's footnote 2: "Please attach pages of Trust/Plan document (or corporate/entity resolution) which lists the name of Trust/Plan/Entity, Trustees/officers or authorized signatories, signatures and date."
- Not run: page 6 dense prose (budget was kept for the app), and the paid OCR attempt.

## Verdict
VIABLE

The pass rule was at least 15/16 labels and at least 90% marker accuracy including Partnership/LLC. nemotron-3.5-super-vl scored 16/16 and 16/16 in 3 of 3 runs (two resolutions), with identical output quality across runs.

Requests used: **6 of the 20 allowed for P1** (13 in total across P1 and P2; 7 left of the probe budget).

## Resulting Design Constraint
- **What this licenses:** A free vision model can be the default OCR for AC14/AC23, including the footnote-2 gap on #9 Partnership/LLC; downscaling scans to about 1600px on the long side is enough; the planned single capped paid OCR attempt (R5) is not required for this page and can stay unspent.
- **What this forbids:** Do not assume a response within a Worker's 30 s post-response window (observed 17 to 88 s, one model slow even at p50 54 s): OCR must run in a queue, a Durable Object, or from the browser with progress and resumability, and never inside the request path; do not rely on gemma-4 or dots-3 as OCR fallbacks until retested; do not use `max_tokens` around 4000 with reasoning models (dots-3 returned empty content).
- **What remains uncertain (known-gap):** Quality on dense prose pages and on other scans (only page 1 of one sample, three runs of one model); real concurrency and the 50/day free quota for a multi-page scan (about 20 pages in sample #9 would exhaust it on its own); whether the free provider retains uploaded images (visitor privacy notice, AC37); and the paid mistral-ocr comparison, **pending user credit top-up**.
