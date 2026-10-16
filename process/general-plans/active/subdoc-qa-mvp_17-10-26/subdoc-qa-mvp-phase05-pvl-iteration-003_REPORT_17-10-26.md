---
name: subdoc-qa-mvp-phase05-pvl-iteration-003
description: Inner PVL cycle 3 report for phase 05 (LLM AI lane)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 3
  phase: "05"
---

# Phase 05 — inner PVL iteration 003

Cycle-2 re-validate: Gate CONDITIONAL, 0 FAIL, 3 CONCERN (G13-G15). Trend 9 -> 3 -> 3 (different gaps each cycle). Plan only; Validate Contract untouched.

Fixes applied:
- G13: `analyze` also returns optional `aiCandidates`; worker keeps last 2 graphs by docHash (LRU 2); `verifyAi(result, docHash, injectedRuleTexts: string[])` and `rulesHash8(ruleTexts: string[])` take plain strings; `doc_not_retained` error when evicted; `MemoryApi.firmRules(firmId)` plus stub; new gate `engine-ai-api` (`apps/web/test/engine-ai-api.test.ts`).
- G14: whole-suite `pnpm --filter @aduin/web test` and `test:e2e` added to the regression row; `Checks done` prefix kept in all AI states; preview project fails soft (stub allowance, no banner, no `/api/ai` call); real `/api/quota` only when `VITE_API_BASE` is set.
- G15: R2 evidence pack follows the validator schema (`decision` in approved|approved-with-concerns|rejected), precedent `harness/phase-04b`.

Registry request extended: engine-ai-api.test.ts, stubMemoryApi.ts, memoryApi.ts.

Next: re-validate from V1.
