---
name: subdoc-qa-mvp-phase05-pvl-iteration-002
description: Inner PVL cycle 2 report for phase 05 (LLM AI lane)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 2
  phase: "05"
---

# Phase 05 — inner PVL iteration 002

Re-validate after cycle 1: Gate CONDITIONAL, 0 FAIL, 3 CONCERN (G10-G12). Trend 9 -> 3 gaps.

Fixes applied (plan only; Validate Contract untouched):
- G10: evidence-pack validator path now `.../harness/phase-05` in R2; evidence-pack row added to Test Gates and Verification Evidence.
- G11: web regression gates added (status-stages, structure-view, source-guard, smoke); `pnpm slice:check` kept (local; port 8787 free, no local secrets file in `apps/worker/`); V3 sub-item to update `status-stages.spec.ts` AI-stage assertions and record them in the phase report.
- G12: import-graph guard kept strict; verify chain routed through `engine.worker.ts` via new `EngineApi.verifyAi(result, docHash)`; `rulesHash8` returned from the worker; stream client parses NDJSON frames only; `import-graph` added as a must-stay-green gate; engine `types.ts`/`client.ts` listed.

Registry update request extended: `apps/web/test/import-graph.test.ts`, `apps/web/e2e/status-stages.spec.ts`, `apps/web/src/engine/{types,client}.ts`.

Next: re-validate from V1.
