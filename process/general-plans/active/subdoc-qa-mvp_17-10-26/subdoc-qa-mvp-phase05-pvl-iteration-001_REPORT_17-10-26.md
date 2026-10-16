---
name: subdoc-qa-mvp-phase05-pvl-iteration-001
description: Inner PVL cycle 1 report for phase 05 (LLM AI lane)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 1
  phase: "05"
---

# Phase 05 — inner PVL iteration 001

- First-pass verdict: CONDITIONAL (0 FAIL, 9 CONCERN G1-G9). All plan-text or checklist gaps; no architectural flaw.
- Supplement applied all 9 gaps (SUPPLEMENT_APPLIED):
  - G1 per-request `rulesFor` factory (ports.ts, index.ts, fakes/platform.ts).
  - G2 classify.ts and config.ts added (envelope wrap, per-finding drop, new default model, AI_RESPONSE_MODE).
  - G3 `injectedRulesHash` reuses core `rulesHash`; over-cap truncation with "N of M" notice.
  - G4 `rules_unavailable` is a reason under `memory_unavailable`; banner mapping table added.
  - G5 gate defects fixed (fixtures:check path, slice:check, `-d1` token, six new gates, budget 13 with workspace+firm scenarios).
  - G6 committed `public/precomputed/{docHash}.{rulesHash8}.json` for samples #1/#3.
  - G7 `apps/web/src/api/` extended; F1 recordings gate W4/V5 via SendMessage; JSON-import probe first.
  - G8 escape rule, record-ai ceiling 8, `:free` allow-list, abort on `usage.cost > 0`, evidence pack step R2.
  - G9 module-private enum/draft shape; snapshot diff limited to two entries.
- Recorded: P2-6 stays backlog (known-gap); live recording optional, else AC28/AC51 stay Hybrid with residual named.
- Registry changes: listed in the plan under `### Registry update request (Phase 05, PVL cycle 1)` for the orchestrator.
- Next: re-validate from V1.
