---
name: subdoc-qa-mvp-phase04a-pvl-iteration-001
description: PVL cycle 1 report for phase 04a (worker proxy)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 1
  phase: "04a"
---

# Phase 04a — PVL iteration 001

- First-pass verdict: Gate: CONDITIONAL (0 FAIL, 10 CONCERN).
- Gaps:
  1. Cache read now comes before claims (zero-write hits).
  2. Risk evidence pack added (Step F).
  3. Free-only enforcement plus a circuit breaker.
  4. Redactor and base-URL validation, with a secret-non-leak gate.
  5. Stream hold-open test with a 120 s timeout and refund-on-abort.
  6. Open-proxy whitelist, data-URI images only, IP identity per /64.
  7. In-isolate pre-limit, read-only quota, shared provider counter.
  8. Turnstile `t` claim, M1 visitor cookie, fail-closed siteverify.
  9. slice.spec.ts owned by 04a (orchestrator decision).
  10. Test files pinned, config env list completed, OpenRouter/Turnstile stubs, slice:check runs local.
- Also: the optional M1 deploy step E3 is constrained to aduin-transaction-* on workers.dev and includes a smoke check.
- Supplement: SUPPLEMENT_APPLIED; validators report 0 failures; registry note appended.
- Cross-phase: the SessionClaims `t` claim is being frozen in the phase 01 supplement. Re-validate 04a after the 01 supplement lands.
