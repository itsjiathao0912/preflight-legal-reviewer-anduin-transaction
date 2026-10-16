---
name: subdoc-qa-mvp-autopilot-goal
description: Provisional autopilot goal block for the sub-doc QA MVP unattended run
date: 2026-10-17
metadata:
  type: goal-block
  lane: full
---

Emitted: 2026-10-17. This is the provisional block. V7 of VALIDATE will emit the (UPDATE) variant.

```
SESSION GOAL: Build, test and deploy the sub-doc QA MVP (SPEC R6, 64 ACs) phase by phase per the umbrella plan in process/general-plans/active/subdoc-qa-mvp_17-10-26/
ENTRY PHASE: PLAN (RESEARCH, SPEC R6, INNOVATE R6 + DATA-MODEL, probes P1/P2/P4 complete; PLAN agent running)
REMAINING PHASES:
  [ ] PLAN: umbrella + phase plans 00–10, 04b, 08b (1 sonnet vc-plan-agent, sequential; agent-team tooling unavailable)
  [ ] Per phase, inner loop R→I→P→PVL→E→EVL→UP: vc-validate-agent (sonnet) → vc-execute-agent (opus) → vc-tester (sonnet) → vc-update-process-agent (sonnet)
  [ ] Order, Milestone 1 vertical slice: 00 scaffold → 01 engine HTML + golden detectors → 03 web shell per approved mockup → 04a Worker proxy → DEPLOY slice
  [ ] Then: 02, 04b, 05, 06, 07, 08, 08b (P1), 09 (P1), 10 (deploy, a11y, perf, README, video script+storyboard, slides)
CLARIFICATIONS LOCKED:
  1. Scope: all phases incl. P1 (08b, 09).
  2. Deploy unattended ONLY to *.workers.dev / *.pages.dev, resources named aduin-transaction-*; NEVER zone itsjiathao.com (894bc9f93640fab260bf1580b5b48cb7); secrets only via `wrangler secret put`; use saved Global key (~/.config/cloudflare/credentials.env).
  3. OpenRouter: free models only, no paid calls; quota 50/day — spread precompute over days, gaps → backlog; no-LLM mode must always work.
  4. Git: commit on main after each phase; NO push.
  5. Gate: Accept on a blocking finding stays Blocked until counsel answers (AC22).
  6. UI: approved mockup design/mockups/review-workspace.html + process/context/ui/all-ui.md are the spec for UI phases.
  7. Video: script + storyboard only (user records).
  8. BLOCKED phase → backlog note + continue next phase.
EXECUTE CONSENT: standing-granted via autopilot trigger (2026-10-17)
DECISION POLICY: auto-proceed on all reversible decisions; PVL CONDITIONAL → supplement loop (≤10 cycles), plateau → accept as known-gap; EVL fail → scoped fix loop (≤10); BLOCKED → backlog + continue; P1 cut order per DATA-MODEL M12 if time/limits bite; secrets never printed or committed.
HARD STOPS:
  - Irreversible/outward-facing actions not covered above (git push, custom domain/route, any change to zone itsjiathao.com, paid model call, deleting user data)
  - Cascade BLOCKED (2 consecutive phases BLOCKED-skipped)
  - needs-live-provider feasibility probe that would be billed
TEST GATES: TBD — populated after VALIDATE
START: wait for PLAN agent → validators → VALIDATE phase 00
LANE: full
```
