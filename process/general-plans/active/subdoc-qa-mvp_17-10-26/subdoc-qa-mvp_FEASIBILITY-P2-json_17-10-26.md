---
slug: subdoc-qa-mvp
date: 2026-10-17
verdict: VIABLE
originating-phase: spec
---

# Feasibility P2: strict JSON output and latency of free text models for clause judgment

**TL;DR:** `nvidia/nemotron-3-super-120b-a12b:free` returned schema-valid strict JSON 4 of 4 times and flagged the Section 11 to 12 mismatch in 3 of 4, but only once with the correct diagnosis and fix; latency is 28 to 49 s (p50 about 41 s). The `models:[...]` fallback array works. Two warnings: `openrouter/free` is not usable (it routed to a content-safety classifier), and both gemma-4 ids returned 429 on every attempt. Use the LLM as an optional second opinion, not as the primary defect detector.

## Hypothesis
At least one free text model honors a strict `json_schema` response format at least 2 of 3 times and finds the Section 11 versus Section 12 cross-reference mismatch in the Franklin Lexington PMF subscription text.

## Mechanism Under Test
OpenRouter `response_format: {type:"json_schema", strict:true}` on free models (plus `json_object` for gemma-4), the `openrouter/free` router, and the `models:[...]` fallback array, measured for schema validity, finding quality and latency. Related: SPEC AC20, AC26, AC28; RESEARCH section B.

## Probe Family
4 — External API shape capture (live OpenRouter requests).

## Probe Cost Class
`needs-live-provider`. Safety gate met: user opted in explicitly in chat for live OpenRouter calls on free models. Only `:free` ids were used. Every successful response reported `cost: 0`. No paid model was attempted.

## Probe Method
- Source text: `samples/sub-docs/raw/01-franklin-lexington-pmf-2024.htm`, HTML stripped with `python3 -I` (script/style removed, entities decoded). Excerpt of 4,019 chars: the "11. Accredited Investor Status" heading and its opening lines, an explicit "items 1-21 omitted" marker, the end of Section 11 (items 21 to 22), then the whole "12. Qualified Client Status" heading and items 1 to 6. In the source, items 5 and 6 of Section 12 say "paragraphs 1 through 4 of this Section 11"; Section 12 has its own items 1 to 4, so the reference should read Section 12 (a stale cross-reference).
- Prompt asked for `{"findings":[{class, quote, location, explanation, severity, confidence, interpretations[]}]}` (class and severity enums), `temperature: 0`, `max_tokens: 6000`. The prompt did NOT hint at the answer.
- Strict schema: `additionalProperties:false`, all keys required. Validation used a hand-written checker (exact key set, enum, types).
- Mismatch scoring was done by reading each finding: "found" means it flagged the "this Section 11" text in Section 12 items 5/6; "correct fix" means it said it should point to Section 12.
- API key never printed or stored.

## Evidence Captured

**Raw results table**

| # | Model (mode) | Latency | HTTP | JSON parsed | Schema valid | Mismatch flagged | Correct diagnosis and fix |
|---|---|---|---|---|---|---|---|
| 1 | nemotron-3-super-120b-a12b:free (json_schema strict) | 49.4 s | 200 | yes | yes | NO (1 unrelated "ambiguous wording" finding) | no |
| 2 | same | 28.4 s | 200 | yes | yes | yes (2 findings, class broken_reference, conf 0.95) | yes ("Change Section 11 to Section 12") |
| 3 | same | 36.8 s | 200 | yes | yes | yes (2 findings, broken_reference, 0.95) | partly (says "this" is misleading; suggests keeping "Section 11") |
| 4 | models:[gemma-4-31b-it:free, nemotron-3-super-120b-a12b:free] (strict) | 45.0 s | 200 | yes | yes | yes (class ambiguous_term, 0.9) | partly (same wrong fix as #3) |
| 5 | openrouter/free (strict) | 2.7 s | 200 | NO | no | no | no |
| 6 | gemma-4-31b-it:free (json_object) | 0.5 s | 429 | n/a | n/a | n/a | n/a |
| 7 | gemma-4-26b-a4b-it:free (json_object) | 0.5 s | 429 | n/a | n/a | n/a | n/a |

Summary for the viable model (nemotron-3-super-120b, runs 1 to 3 plus the fallback run, which was served by it):
- Schema-valid JSON: 3/3 direct, 4/4 including the fallback run; no code fences, no extra keys, no enum drift.
- Latency (4 samples): 28.4, 36.8, 45.0, 49.4 s; **p50 about 41 s**. It is a reasoning model: 1.4k to 2.0k completion tokens plus 3.7k to 6.6k chars of hidden reasoning.
- Mismatch flagged 3/4; correct diagnosis 1/4 clean plus 2/4 partial. Output is non-deterministic even at `temperature: 0` (run 1 versus run 2 on identical input).
- Excerpt (run 2): "The reference to Section 11 paragraphs 1-4 incorrectly points to the Accredited Investor criteria; the intended reference is likely to the Qualified Client criteria in Section 12 paragraphs 1-4."
- `openrouter/free` served `nvidia/nemotron-3.5-content-safety:free` and returned `User Safety: safe` (5 tokens): a moderation model, not a judge. The router picks any free model by request features, so it is unsafe as a default.
- gemma-4: 429 "temporarily rate-limited upstream" (Google AI Studio), no `Retry-After` header. The 31b id failed 3 of 3 attempts across P1 and P2 and 26b-a4b failed 1 of 1; I stopped those models per the budget rule. Their JSON-mode behavior was therefore not measurable.
- Fallback array: with the first model returning 429, the call was answered by the second model; the response body names the serving model (`model` field), so the app can log which model answered. This was proven on a 429 failover only.
- Not measured: true concurrency (all calls sequential, one at a time), and `Retry-After` handling (the header never appeared).

Requests used: **7 of the 20 allowed for P2** (13 across P1 and P2; 7 left).

## Verdict
VIABLE

The rule was at least one free model with schema-valid JSON in at least 2 of 3 calls that also finds the mismatch: nemotron-3-super-120b gives 3/3 valid and flags the mismatch in 2 of those 3 (and 3 of 4 counting the fallback run). Treat this as a narrow pass: detection is not consistent run to run.

## Resulting Design Constraint
- **What this licenses:** `nvidia/nemotron-3-super-120b-a12b:free` with `json_schema strict:true` can be the default for clause-judgment output (AC20 draft questions, AC26 summaries): the schema held 4 of 4 times, so the app can still validate every response and reject or repair rare bad ones; the `models:[...]` fallback array is usable to survive upstream 429s.
- **What this forbids:** The LLM must not be the primary or only detector of cross-reference defects (it missed the target once and gave a wrong fix twice): the deterministic graph checks (AC17, AC18) stay primary and LLM output is labeled as a suggestion with confidence; do not use `openrouter/free` as a model id (it can route to a non-generative safety classifier); do not assume 28 to 49 s fits the Worker 30 s `waitUntil` window, so run LLM calls in a queue or from the client with progress; do not depend on gemma-4 free ids (3 of 3 and 1 of 1 returned 429).
- **What remains uncertain (known-gap):** Concurrency and sustained rate behavior (no parallel calls tried, 20/min and 50/day limits only read from docs); whether `json_object` mode on gemma-4 works (never reached the model); stability of the free ids (they rotate, so the model list must be configurable); and quality over a larger sample than 4 runs on one excerpt.
