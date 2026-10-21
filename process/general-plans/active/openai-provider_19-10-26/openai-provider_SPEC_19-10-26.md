---
name: spec:openai-provider
description: "Requirements for adding OpenAI (direct, gpt-4.1-mini) as the AI and OCR provider with a $10 lifetime spend cap, keeping OpenRouter as a config-selected fallback"
date: 19-10-26
feature: general
---

# SPEC: OpenAI as the AI/OCR provider

**TL;DR:** The live app switches its AI review and scan reading from free OpenRouter models to OpenAI `gpt-4.1-mini`, called directly. Spend is capped at $10 for the lifetime of the deployment and never resets. At the cap, AI and OCR turn off with a clear message while deterministic findings keep working. OpenRouter stays as a one-variable fallback and its free-only protections do not change.

## Summary

Today every AI judgment and every scan (OCR) page goes through OpenRouter free models, which are slow and unreliable. The user wants the app to call OpenAI directly using `gpt-4.1-mini` for both text AI and vision OCR. Because OpenAI is paid, the app needs a hard money limit: $10 total, forever, computed from what each call actually used. A config setting chooses the provider, so going back to OpenRouter is a setting change plus a redeploy, with no code change. This replaces the earlier "free models only" rule for the OpenAI path only.

## Users

| User | Why they care |
|---|---|
| Digitization analyst (demo visitor) | AI review and scan reading work reliably and fast; the app never hangs or surprises them. |
| Operator (the user / builder) | Controls cost with a hard $10 ceiling, can flip providers without code, keeps keys out of the browser and the repo. |
| Reviewer of the challenge submission | Sees deterministic QA still works when AI is off; sees honest privacy wording. |

## User Stories / Jobs To Be Done

1. As an analyst, I want the AI review to return results from a reliable model, so that I get ambiguity and contradiction findings without long waits or failures.
2. As an analyst, I want scanned pages read by a capable vision model, so that scanned sub docs produce usable text.
3. As the operator, I want a $10 lifetime ceiling on OpenAI spend that cannot be exceeded, so that a demo cannot run up a bill.
4. As an analyst, when the ceiling is reached, I want a clear "AI is switched off" message while deterministic findings, Questions and export keep working, so that the tool stays useful.
5. As the operator, I want to choose the provider with one config variable, so that I can fall back to OpenRouter without touching code.
6. As the operator, I want the OpenAI key stored only as a Worker secret and caught by the secrets scan if it leaks, so that the key never reaches the browser or the repo.
7. As a reader of the README, I want honest wording that document text and scans are sent to OpenAI when AI/OCR are used, so that privacy expectations are correct.

## What The User Wants (Behavioral Outcomes)

- With the provider set to OpenAI, AI review and OCR work end to end using `gpt-4.1-mini`, with no change to screens, buttons or flows.
- Each AI or OCR call adds its real cost (from tokens used) to a running lifetime total. The total never resets, not at UTC midnight and not on redeploy.
- Before a call starts, the app checks that even the worst-case cost of that call still fits under $10. If not, the call is refused up front.
- At the cap, AI and OCR answer with a clear plain-language message ("AI review is switched off: the spend limit has been reached"). Deterministic findings, Questions, gate and DOCX export are unaffected.
- A normal OpenAI answer never looks like a "paid model" incident, so it does not switch AI/OCR off for the day.
- OpenAI quota or billing errors (for example "insufficient quota") are shown as AI unavailable, not retried as if temporary.
- Setting the provider to OpenRouter restores today's behavior exactly, including free-only guards.
- No OpenAI key appears in any browser bundle, response, log or committed file.

## Flow / State Diagram

```
Visitor starts AI review / OCR
        |
        v
 existing guards (origin, limits, Turnstile, cache)  --HIT--> cached result (no cost)
        |MISS
        v
 provider = ? (config)
   |                          |
 openai                    openrouter
   |                          |
   v                          v
 lifetime spend + worst-case   existing free-only path
 of this call <= $10 ?         (unchanged)
   |yes            |no
   v               v
 call OpenAI     refuse: "AI switched off:
   |             spend limit reached"
   v             (findings/Questions/export still work)
 answer + token usage
   |
   v
 cost = tokens x price -> add to lifetime total -> result to visitor

Spend states:  [under cap] --total reaches $10--> [AI/OCR off, permanent]
               (switching provider to openrouter leaves OpenAI total frozen)
```

## Acceptance Criteria (Testable Outcomes)

Scenario names are the proposed gates; INNOVATE/PLAN will bind them to concrete test files from the worker, scripts and live test groups in `process/context/tests/all-tests.md`.

**A. Provider selection**

1. Setting the provider variable to `openai` sends AI and OCR calls to OpenAI `gpt-4.1-mini`; setting it to `openrouter` sends them to OpenRouter exactly as today. An unknown or missing value fails closed (AI/OCR off, deterministic findings work) with a clear config error.
   - proven by: worker provider-switch matrix (stubbed upstreams, both values plus invalid); strategy: Fully-Automated
2. The OpenRouter branch is unchanged: free-only model rules, the $10 config-load ceiling, the paid-fallback-disabled rule and the circuit breaker behave as before when provider is `openrouter`.
   - proven by: existing OpenRouter worker suites re-run unmodified in `openrouter` mode (free-only, breaker, paid-fallback tests); strategy: Fully-Automated
3. Switching provider needs only a variable change and a redeploy, no code change.
   - proven by: provider-switch matrix (same build, different config); strategy: Fully-Automated

**B. Requests the provider accepts**

4. The text AI request is accepted by OpenAI: it does not send OpenRouter-only fields, asks for token usage in the stream, and the structured-output schemas for all text tasks are accepted by OpenAI.
   - proven by: request-shape tests for each AI task against an OpenAI-shaped stub; one small billed live probe per task type (see Open Questions); strategy: Hybrid
5. The OCR request is accepted by OpenAI with its vision input, and an OCR result with optional fields (box, confidence) still validates and is cached.
   - proven by: OpenAI-shaped OCR stub test plus a live probe on one scan page; strategy: Hybrid
6. A successful OpenAI answer is parsed and shown exactly like an OpenRouter answer (same findings shape, same NDJSON frames to the browser).
   - proven by: end-to-end proxy test with an OpenAI-shaped streaming stub; strategy: Fully-Automated

**C. Spend cap ($10 lifetime, no reset)**

7. Cost per call is computed from reported token usage times a stated price table for `gpt-4.1-mini`, and added to a persistent lifetime total.
   - proven by: ledger unit tests with known token counts and prices; strategy: Fully-Automated
8. The lifetime total does not reset at UTC midnight or on redeploy.
   - proven by: clock-advance test across midnight plus a restart/re-instantiate test on the same storage; strategy: Fully-Automated
9. A call is refused before it is sent if lifetime spend plus that call's worst-case cost would exceed $10, so concurrent in-flight calls cannot overshoot the cap.
   - proven by: concurrency test firing parallel calls near the cap; total never exceeds $10; strategy: Fully-Automated
10. After a call finishes, the reservation is replaced by actual cost; a provider failure with no usage releases or settles the reservation by a stated rule so spend is never silently under-counted.
    - proven by: refund/settle matrix (success, abort after dispatch, 5xx, timeout, missing usage); strategy: Fully-Automated
11. If usage is missing from an otherwise successful answer, the app counts the worst-case cost for that call (fail toward over-counting) and records a warning.
    - proven by: stub answer without usage; strategy: Fully-Automated

**D. Fail-closed behavior at the cap**

12. When the cap is reached, AI and OCR requests get a clear, stable "spend limit reached" error with plain-language text; no upstream call is made.
    - proven by: worker test with spend at cap asserting zero upstream calls and the error shape; strategy: Fully-Automated
13. At the cap, deterministic findings, Questions, gate and DOCX export still work in the browser and the AI/OCR UI shows the message instead of a spinner or generic failure.
    - proven by: preview e2e spec with the quota/cap response faked; strategy: Fully-Automated
14. The current spend is observable by the operator without exposing it to visitors beyond the simple on/off state.
    - proven by: worker test on the quota/health response contents; strategy: Fully-Automated

**E. Errors and the circuit breaker**

15. A normal OpenAI response (served model id such as `gpt-4.1-mini-2025-...`, no `cost` field) does not trip the circuit breaker and does not block AI/OCR for the day.
    - proven by: breaker test with an OpenAI-shaped success; strategy: Fully-Automated
16. OpenAI "insufficient quota" and invalid-key errors surface as "AI unavailable" (not retried as transient, not charged to the visitor); rate-limit 429s are still treated as transient.
    - proven by: error-classification matrix with OpenAI-shaped bodies; strategy: Fully-Automated

**F. Secrets and privacy**

17. The secrets scan flags OpenAI key patterns (`sk-` and `sk-proj-` forms) in addition to OpenRouter keys; a built browser bundle and every API response contain no key.
    - proven by: secrets-scan fixtures (positive and negative) plus a bundle/response grep gate; strategy: Fully-Automated
18. The OpenAI key exists only as a Worker secret and in the operator's local credentials file; it is never read by browser code, and the README and docs state that sub-doc text and scans are sent to OpenAI when AI/OCR are used.
    - proven by: bundle grep gate (as above) plus doc check in the docs-sync gate; strategy: Hybrid

**G. Live and operational**

19. After deploy, a small billed live probe confirms one real AI call and one real OCR call succeed, record non-zero cost in the ledger, and keep the breaker untripped. Live scripts no longer stop on a non-`:free` served model when provider is `openai`.
    - proven by: live probe script run once with operator authorization; strategy: Agent-Probe (automation is not possible without spending real money and a human-issued Turnstile token; residual is explicit)
20. OCR cache entries and web OCR model reference are consistent with the new model, so a stale model id never causes silent misses or wrong cache hits; sample #9 precomputed OCR is either regenerated or clearly labeled as the old model.
    - proven by: cache-key unit tests with the new model id plus web unit test on the OCR model constant; strategy: Fully-Automated

## Out Of Scope

- Any new screen, setting UI or visitor-facing provider chooser.
- Other OpenAI models, model routing/fallback between models, or auto-selecting providers by cost.
- Resetting, topping up or raising the $10 cap from the UI (changing it is an operator config change).
- Per-visitor dollar budgets (existing per-visitor request limits stay as they are).
- Changing deterministic detectors, prompts' meaning, or the counsel sheet.
- BYOK through OpenRouter.
- Touching zone `itsjiathao.com`, custom domains, or anything outside this repo's Worker.
- Editing the user-owned `CLAUDE.md` (a credentials-table row is proposed only).

## Constraints

- User-locked: direct OpenAI at `https://api.openai.com/v1`; model `gpt-4.1-mini` for text and vision; $10 total lifetime, no reset; fail closed at the cap; OpenRouter retained, chosen by config var, switching needs no code change.
- This overrides "free models only" for the OpenAI branch only; the OpenRouter branch keeps free-only guards.
- Secrets stay outside the repo; no key printed, hard-coded, committed or sent to the browser. Do not read `~/.config/openai/credentials.env` during planning; the Worker secret is set with `wrangler secret put OPENAI_API_KEY`.
- Deploy from `main` only; live Worker is `preflight-legal-reviewer` (no custom domain); keep `OPENROUTER_API_KEY` secret in place for rollback; D1 rollback rules in `process/context/worker/all-worker.md` apply (a schema change, if any, must follow the schema-bump rollback rule).
- Free Cloudflare plan limits and existing D1 write-budget rules still apply to any new ledger writes.
- The browser must keep working with no AI at all (existing no-LLM rule).

## Risks

| Risk | Impact | Mitigation direction (decided later) |
|---|---|---|
| OpenAI rejects current structured-output schemas (OCR optional fields, length/range keywords) | AI/OCR 400s after deploy | Schema acceptance check per task before go-live (AC 4, 5) |
| No cost field from OpenAI; usage only if requested in stream | Spend under-counted, cap breached | Price table plus usage request; missing usage counts worst case (AC 7, 11) |
| Parallel calls overshoot the cap | Spend above $10 | Reserve worst case before dispatch (AC 9) |
| Existing breaker treats any non-free served model as an incident | AI/OCR off for the day after first success | Provider-aware breaker (AC 15) |
| OpenAI quota error looks like a transient 429 | Endless retries or confusing UX | Classify explicitly (AC 16) |
| Shared test fakes are OpenRouter-shaped | False green | Add OpenAI-shaped fakes; keep OpenRouter suites in force (AC 2, 6) |
| Document text and scans leave to a third party | Privacy expectation mismatch | README and docs wording (AC 18) |
| Stale OCR cache keyed on the old model | Wrong or missing OCR for sample #9 | Decide regenerate vs label (AC 20, Open Question 2) |
| Price table goes stale | Cap drifts from real billing | Table kept as a named, reviewable constant; note in docs |

## Open Questions

1. Live probe authorization (owner: user): may the operator run a small billed live OpenAI probe (one AI call per task type plus one OCR page, well under $0.10) after deploy? Needed for AC 4, 5, 19. Default if unanswered: yes, capped at 15 calls.
2. Precomputed OCR for sample #9 (owner: user): regenerate now with `gpt-4.1-mini` (spends a few cents of the $10) or later? Default: later, label as old model meanwhile.
3. Privacy wording (owner: user): confirm the README/docs sentence that sub-doc text and scans are sent to OpenAI. Default: add a plain sentence in README and docs.
4. `CLAUDE.md` credentials table (owner: user): add an OpenAI row (`~/.config/openai/credentials.env`, `OPENAI_API_KEY`, `POST https://api.openai.com/v1/chat/completions`)? It is a user-owned file, so this is a proposal only.
5. Price table values (owner: next-phase research): confirm current `gpt-4.1-mini` input/output token prices from OpenAI's pricing page before PLAN.

Under an interactive session these are non-blocking: each has a stated default, so none blocks INNOVATE; items 1 to 4 need the user's answer before the corresponding step runs.

## Background / Research Findings

- OpenRouter is assumed in many places: base URL pinned to openrouter.ai, free-only model assertions, a `models` array in the request body (OpenAI rejects it), cost read from `usage.cost` (OpenAI never sends it), a breaker that trips on any non-free served id, and a paid-fallback path with a fixed reservation.
- The $10 ceiling exists only as a config-load check; there is no dollar cap on the main path today, only request counts (35 global AI requests per day, per visitor 3 AI docs, 8 AI requests, 6 OCR pages). The spend ledger is in micro-USD, and the spend quota counter is per UTC day, so a lifetime cap is new behavior.
- Images are already sent as data-URI image parts (OpenAI-compatible). The OCR JSON schema has optional box and confidence fields that OpenAI strict mode may reject; text schemas use length and range keywords whose acceptance is unverified.
- The web client hard-codes the OCR model (part of the OCR cache key); cache keys everywhere include the model id.
- The secrets scan detects only the OpenRouter key prefix. Live scripts stop on any non-`:free` served model.
- Test fakes and breaker/free-only tests are OpenRouter-shaped and pin old behavior.
- User brainstorm (19-10-26): call OpenAI directly (not BYOK); model `gpt-4.1-mini` for text and vision; "$10 tổng, không reset"; keep OpenRouter "Giữ, chọn bằng config". Key is saved and verified (models list returned 200 and `gpt-4.1-mini` available).
