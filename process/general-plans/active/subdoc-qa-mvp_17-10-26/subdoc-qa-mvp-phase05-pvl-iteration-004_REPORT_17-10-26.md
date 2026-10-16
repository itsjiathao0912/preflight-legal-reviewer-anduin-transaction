---
name: subdoc-qa-mvp-phase05-pvl-iteration-004
description: Inner PVL cycle 4 report for phase 05 (LLM AI lane)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 4
  phase: "05"
---

# Phase 05 - inner PVL iteration 004

Cycle-3 re-validate: Gate CONDITIONAL, 0 FAIL, 1 CONCERN (G16). Trend 9 -> 3 -> 3 -> 1. Plan only; Validate Contract untouched.

Fix applied (orchestrator decision = validator suggestion):
- G16: AI lane enable is a runtime API base with a per-build default. `apps/web/vite.config.ts` `define` sets `VITE_API_BASE` to `'/'` for non-e2e modes (production and stack) and `''` for `--mode e2e` (preview). Client reads it once into a runtime store value. IS_E2E-guarded `__aduinE2E.setApiBase(base)` in `apps/web/src/e2e-hook.ts` is called only by the five V5 specs (`sample-zero-calls`, `auto-downgrade`, `ai-resume`, `provenance`, `ai-banners`) before opening a document. Base `''` fails soft (stub allowance, no banner, no `/api/ai`), so `upload-firm-tagging` and other existing specs are unaffected. `no-e2e-hook-in-dist`, whole-suite web gates and `slice.spec.ts` stay green.
- Sections touched: Touchpoints, Blast Radius, Public Contracts (G14 invariant 2), Checklist V2 and V5, regression test-gate row, Verification Evidence, cycle 4 note, registry request.
- Registry `## Phase 05` revision line appended (all recorded extension requests, shared engine ownership with Phase 06).
