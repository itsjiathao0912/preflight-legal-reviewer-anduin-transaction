---
phase: ai-review-stream-dedup
date: 2026-10-18
status: COMPLETE_WITH_GAPS
feature: none
plan: process/general-plans/completed/ai-review-stream-dedup_18-10-26/ai-review-stream-dedup_PLAN_18-10-26.md
---

# ai-review-stream-dedup: phase report and closeout

**Verdict:** shipped and live (version `8a82ead2-07ed-4b06-ad60-226d3f4734c8`). Archive with known gaps; each gap has a backlog stub.

### What Was Done
- Sections A-G (code): streamed OpenRouter upstream (SSE) with a 60 s idle timeout (AI only) and a 420 s ceiling (OCR keeps 240 s), visitor-claim refund on upstream timeout, candidate selection that skips deterministic-finding sentences, `dropRuleDuplicates` and verify-step `ruleFindings`/`suppressed`, derived recordings, docs.
- Section H: deployed from a clean worktree (`deploy/ai-stream-dedup` = hotfix b04f1a8c base + 4 cherry-picks). Rollback version `b04f1a8c-41f5-4c20-92dc-196d6e7d252a`. Health 200 no-store, CSP byte-identical, schema 5 (0006 not shipped).
- Section I: live end-to-end upload of the NG3 `.docx` through the Upload UI: AI review done, `/api/ai` 178.5 s (241.5 s margin to the 420 s ceiling), 16 findings (7 deterministic, 8 AI, 1 other), zero AI findings duplicate a deterministic one.
- Context updated: `process/context/worker/all-worker.md` (live version, rollback chain, Turnstile note, CPU), `process/context/all-context.md` (live demo line).

### What Was Skipped/Deferred
- I6 optional live re-record (K3) skipped. K1, K2, K3, AC7b CPU-after and E6 live proof, plus the "U.S." title cut, are backlog stubs: `process/general-plans/backlog/ai-stream-*_NOTE_18-10-26.md` and `ai-finding-title-us-truncation_NOTE_18-10-26.md`.

### Test Gate Outcomes
- EVL (vc-tester, HEAD ac13287): all A-G gates green; core 3190 (+3 skip), worker 603, web 314, scripts 176, preview e2e 219 (+1 skip).
- Deploy tree: typecheck, lint, worker 563/563, core gates, guard:cf, secrets:scan, deploy:preflight green.
- Live: upload run as above (AC17 PASS, AC18 PASS; AC7b not measured).

### Plan Deviations
See the plan's `## Deviations`. Key: live base was b04f1a8c not 3d2c7301; a 4th cherry-pick (UI toast fix) added; stack smoke replaced by a headless check (port 4317 busy); Section I was run by the orchestrator with Playwright (Turnstile issued a token automatically), not a human.

### Test Infra Gaps Found
- No live CPU measurement after a streamed review (AC7b); synthetic-only proof of the `dropRuleDuplicates` live path (E6); stack smoke port 4317 collision. Stubs filed.

### SPEC Achievement
No SPEC file; plan AC1-AC19 act as criteria. AC1-AC14, AC17 (live upload, margin), AC18 (zero duplicates), AC19: met. AC7b: unmet (CPU after not measured) -> backlog stub `ai-stream-cpu-after-ac7b`.

## SPEC Gaps
- AC7b (live CPU after streaming) -> backlog. K1-K3 are accepted named residuals.

### Closeout Packet
1. Plan: `process/general-plans/active/ai-review-stream-dedup_18-10-26/ai-review-stream-dedup_PLAN_18-10-26.md` (archived to `completed/`).
2. Classification: Ready for UPDATE PROCESS archival, with gaps. Every developed-behavior criterion except AC7b (an Agent-Probe measurement) is met by a passing automated or live gate.
3. Finished: see What Was Done.
4. Verified vs unverified: see Test Gate Outcomes; unverified: K1, K2, K3, AC7b.
4b. Validate-contract: present, CONDITIONAL with named residuals, PVL cycle recorded in `results.tsv`.
5. Cleanup: context docs and backlog done; branch `deploy/ai-stream-dedup` and worktree `.claude/worktrees/deploy-ai-stream` remain local (not pushed).
6. Next state: pick from the backlog stubs; the operator-run live sweep (R2) remains.
7. Commit: process commit on `claude/pensive-wilson-850b6c`; code commits already made.
8. Regression: whole-repo suites green at EVL; deploy-tree gates green.
9. SPEC achievement: above.

Drift score: MEDIUM (2 signals: 10 or more files touched, task-folder structural change). Recommend UPDATE PROCESS -- significant changes detected.

### Forward Preview
#### Test Infra Found
`sse-assemble`, `sse-failure-shapes`, `sse-cheap-parse`, `upstream-timeouts`, `timeout-refund`, SSE stub modes (documented in `process/context/tests/all-tests.md`).
#### Blast Radius Changes
Added vs plan: `scripts/test/ocr-live-guard.test.ts` (test only), two updated core tests, deploy-tree cherry-pick `d7b7756` (web `review.ts`).
#### Commands to Stay Green
`pnpm typecheck`; `pnpm --filter @aduin/worker test`; `pnpm --filter @aduin/core test`; `pnpm --filter @aduin/web test`; `pnpm --filter @aduin/scripts test`; `pnpm guard:cf`; `pnpm secrets:scan`.
#### Dependency Changes
None.
