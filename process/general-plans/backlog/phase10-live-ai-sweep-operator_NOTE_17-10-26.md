---
name: backlog:phase10-live-ai-sweep-operator
description: "Phase 10 residual R2: no Turnstile token from automated Chromium, so the AC51 echo, AI timing at max_tokens 10000, the #1/#3 judgment sweep, drift narrative, counsel draft and the OCR recheck did not run live; needs a human operator in a real browser"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: subdoc-qa-mvp
---

# Phase 10 residual R2: live AI/OCR sweep needs a human operator

**Status:** open. The gate stays CONDITIONAL until this runs.

## What happened (Wave C, 17-10-26, live version 67c796ff)

- The Turnstile widget `aduin-transaction-web` (managed, hostname pinned) works: the script loads, the challenge runs and our page CSP shows zero violations.
- Playwright Chromium, headless and headed, is escalated to an interactive challenge. One plain operator click on the checkbox restarted the challenge, and it failed again. No token came back.
- With no token, the client correctly sends no `POST /api/session` (E24 behaves as designed). The live smoke stays green.
- We made no attempt to evade bot detection. AI and OCR stay fail-closed on the live site.
- AI calls used: 0 of 6. OCR calls used: 0 of 6. Spend: $0.

## To do (operator, any UTC day, max 3 AI per day)

1. In a normal (non-automated) browser, open the live URL and open sample **#3** (Partners Group). Sample #1 has no law firm, so it never starts a memory session and firm rules cannot apply to it. Complete the Turnstile check if it is shown.
2. AC51: add one firm rule in #memory, run the AI review, and check that the echoed `rules_hash8` matches the active rules. The result must be labelled fresh.
3. Timing: measure the CPU and duration of that first AI call with `wrangler tail aduin-transaction-web --format json`.
4. Then run one drift narrative and one counsel draft (stay within the cap), plus one OCR row-level recheck on one scan page.
5. Ledger every call (task, UTC time, model, cost). Stop on cost > 0, any 429 or an open breaker.
6. `probe:live-ai` drives a Playwright browser and will likely hit the same refusal. Either run it with the operator completing the challenge in the headed window, or record the calls by hand.
7. `probe:live-ai`'s header still says to run AC51 "on sample #1". Change that to #3 before using it.
