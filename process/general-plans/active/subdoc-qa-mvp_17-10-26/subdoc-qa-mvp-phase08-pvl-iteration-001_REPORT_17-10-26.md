---
name: subdoc-qa-mvp-phase08-pvl-iteration-001
description: Inner PVL cycle 1 report for phase 08 (counsel sheet, gate, memory write-back)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 1
  phase: "08"
---

# Phase 08 — inner PVL iteration 001

- First-pass verdict: CONDITIONAL (0 FAIL, 12 CONCERN, 12 gaps G1-G12).
- Gaps: G1 stack-memory secrets, G2 Playwright mechanics, G3 per-IP session cap, G4 seed ownership, G5 wire shapes and error mapping, G6 import-graph ALLOWED edit, G7 `downloadBlob` signature, G8 gate naming and missing rows, G9 session and run lifecycle, G10 no-firm documents, G11 metrics t0 hook, G12 seam repair order.
- Fixes applied (SUPPLEMENT_APPLIED, all 12): (1) `dev-seed.ts` random per-run cookie keys, argv-array `wrangler dev`, no `.dev.vars`, `reuseExistingServer: false`, session-mint first assertion; (2) `wantsStack` regex tightened, `wantsStackMemory`, preview `testIgnore`, own `testMatch`/baseURL, preview webServer first; (3) unique `cf-connecting-ip` per context, fallback shared storageState; (4) no `seed:gen`, `buildDemoSeedSql(spec, PHASE02_SPEC)` into a throwaway dir, sd01-sd03 + sr01 self-check; (5) wire field shapes, error mapping table, `client_op_id` never reused; (6) import-graph ALLOWED additions and `mask(text, sensitiveSpans(text))`; (7) `downloadBlob(filename: string, data: string | Blob, mime: string): void`; (8) `counsel-gate.spec.ts`, preview `memory-no-cross-firm.spec.ts`, evidence-pack validator row, interim AC59/AC60 asserted inside `memory-prior-answer` (fixture `fund-expectations.json` supports it: 62.5%, no residual); (9) bootstrap before lookup, 401 re-bootstrap + retry, `read_only` from the session response, `run:{workspace_id}:{key}` cache, `run_id` resolved at send time; (10) no-firm local-only triage with export still working; (11) t0 captured at the top of `openDocument`, `metrics:{docHash}`, first export only, open-document touchpoint removed; (12) append `counsel` last at EXECUTE time, own row only, arrays derived from the live registry.
- 08b cross-phase requests incorporated (pinned MemoryApi signatures, `MemoryApiError` fields, presentational `AuditList`, `useSession().readOnly`, client re-evaluation on API base change).
- Validate Contract section left untouched. Registry not edited (request block updated). `validate-plan-artifact.mjs`: 0 failures, 0 warnings.
- Next: re-validate from V1. Orchestrator action: align Phase 09 plan `downloadBlob` signature and apply the registry request.
