---
name: subdoc-qa-mvp-phase01-evl-iteration-001
description: EVL fix cycle 1 for phase 01 — independent security review findings
date: 2026-10-17
metadata:
  type: iteration-report
  domain: tests
  iteration: 1
  phase: "01"
---

# Phase 01 — EVL iteration 001 (security review)

- The gates were green (vc-tester). The independent reviewer (vc-code-reviewer, sonnet) returned APPROVE_WITH_FIXES; the auto-stop is not cleared.
- Blocking:
  - F1 (High): quadratic CPU on deeply nested tags in `htmlToLines` (480 KB took 20.9 s).
- Also fix in this cycle:
  - F2 (Medium): masking was opt-in; default it to `sensitiveSpans`.
  - F4: NaN `nowS` guard in the cookie check.
  - F6: size check before UTF-8 encode.
  - F9: remove the committed scratch probe `test/zz_probe.test.ts`.
- Deferred:
  - F8 THIRD_PARTY_NOTICES entries (a seam file owned by the phase 03 agent right now). Do after 03.
  - F3, F5, F7 (low) noted as known gaps or follow-ups.
- Fix agent: vc-execute-agent (supplement mode), scoped to packages/core.
