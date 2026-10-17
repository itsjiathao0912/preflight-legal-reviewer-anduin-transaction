---
name: subdoc-qa-mvp-phase08b-evl-iteration-001
description: EVL iteration 001 for phase08b - independent confirmation at HEAD 54ddaae (memory UI feat commit); all gates green, code review then found M1
date: 2026-10-17
metadata:
  type: iteration-report
  domain: tests
  iteration: 001
  phase: "08b"
---

# phase08b - EVL iteration 001 (independent confirmation at 54ddaae)

- Commit under test: 54ddaae (feat: firm memory screen, decisions, rules, audit trail).
- Gates (all green): web unit 194, preview e2e 157 passed + 1 opt-in skip, stack-memory 10, core 2914, Worker firm-rule gates (`firm-rule-in-context-recorded-llm`, `firm-rule-isolation`, `proposed-rule-never-injected`), typecheck, lint, `guard:cf`, `secrets:scan`, `slice:check`.
- Outcome: gates green, but the parallel code review (vc-code-reviewer, APPROVE_WITH_FIXES) found M1: reopening an answered decision left the local counsel answer in place, so the gate stayed Ready. This is a behavior gap the gates did not cover, so a fix cycle was run (see iteration 002).
- Result: CONTINUE.
