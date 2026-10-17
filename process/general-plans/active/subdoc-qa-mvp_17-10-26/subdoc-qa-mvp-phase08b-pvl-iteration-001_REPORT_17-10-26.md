---
name: subdoc-qa-mvp-phase08b-pvl-iteration-001
description: Inner PVL cycle 1 report for phase 08b (memory UI)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 1
  phase: "08b"
---

# Phase 08b - inner PVL iteration 001

- First pass: CONDITIONAL, 0 FAIL, 9 CONCERN (G1-G9). All 9 fixed in the plan (supplement cycle 1); `## Validate Contract` untouched.
- G1: AI-context proof moved to the existing Worker gates (`firm-rule-in-context-recorded-llm`, `firm-rule-isolation`, `proposed-rule-never-injected`); `stack-memory-firm-rules` narrowed to Hybrid browser to Worker, no AI call; named residual (browser AI run echoing `meta.rules_hash8`) as gap-resolution D, backlog stub `memory-ui-ai-rules-echo-browser_NOTE_17-10-26.md`, Phase 10 live probe.
- G2: `revoke(decisionId, reason)` replaces `revokeDecision`; Phase 08 surface pinned in Public Contracts; A0 greps all.
- G3: 400/409 lost races refetch plus "Already changed"; 403 `read_only_demo` disables writes.
- G4: five 08b writes are awaited calls, not outbox ops; no per-row unsynced wording.
- G5: recast per the orchestrator override (Phase 08 PVL G4): A0 asserts the stack-memory D1 (Phase 08 dev-seed output) holds sd01-sd03 and sr01; no `demo.sql` header requirement, no `seed:gen` routed to Phase 08.
- G6: additive `refreshMemory` store action also resets same-id triage entries; AC50 has two e2e cases.
- G7: firm = open document firmId; no-firm empty state, no `firm()` call.
- G8: deviations X8-X11; lean Reopened row issue class join; one unit case.
- G9: conditional playwright config touchpoint, fake-Worker pin, type-only core imports, a11y-smoke case, preview tokens renamed `memory-ui-*`.
- Cross-phase requests R1-R5 recorded in the plan (R3/R4 consumed by Phase 08 pins). Next: re-validate from V1.
