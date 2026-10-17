---
name: subdoc-qa-mvp-phase08b-evl-iteration-002
description: EVL iteration 002 for phase08b - confirmation at HEAD 2de6749 after review fixes M1, m1, m4 and NITs; all gates green, closeout CLEAN
date: 2026-10-17
metadata:
  type: iteration-report
  domain: tests
  iteration: 002
  phase: "08b"
---

# phase08b - EVL iteration 002 (confirmation at 2de6749)

- Commit under test: 2de6749 (fix: reopening an answered decision re-blocks the gate; keep other triage fields). Fixes: M1 (clear the local counsel answer when the revoked decision was an answered one), m1 (reopen no longer wipes unrelated triage fields), m4 (dialog ignores Escape/cancel while a write is in flight), NITs (`useRealMemory` asserted absent from the production build, `memory.css` hex literals replaced by tokens, reopen snapshot keeps the entered reason).
- Gates (all green): web unit 196, preview e2e 157 passed + 1 opt-in skip, stack-memory 10, `counsel-gate` 4, `gate-pill` 3, plus the same repo gates (core 2914, Worker firm-rule gates, typecheck, lint, `guard:cf`, `secrets:scan`, `slice:check`).
- Review: M1 independently CONFIRMED FIXED; no evidence pack required (no auth, billing, migration or API change; the e2e switch is compiled out of production).
- closeout_classification: CLEAN.
- Result: HALTED_SUCCESS.
