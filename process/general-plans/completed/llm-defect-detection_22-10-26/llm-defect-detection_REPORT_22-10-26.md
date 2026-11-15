---
name: report:llm-defect-detection
description: "Closeout report for llm-defect-detection: reference-target LLM task, review playbook, defect bench; WITH_GAPS, archived to completed"
date: 22-10-26
metadata:
  node_type: memory
  type: report
  feature: none
  phase: llm-defect-detection
---

---
phase: llm-defect-detection
date: 2026-10-22
status: COMPLETE_WITH_GAPS
feature: none
plan: process/general-plans/completed/llm-defect-detection_22-10-26/llm-defect-detection_PLAN_22-10-26.md
---

# llm-defect-detection closeout (22-10-26)

**Verdict:** all plan acceptance criteria met by passing automated gates and the approved live run. Archived to `completed/`. Known gaps (held-out precision, lint, unrelated e2e drift, stale slice smoke) are in backlog, none of them is a plan criterion.

## What Was Done
- `REVIEW_PLAYBOOK` (`packages/core/src/llm/playbook.ts`, at most 10,000 chars) added to the clause-judgment system prompt; `clause-judgment@2` (schema `clause-judgment.s1` unchanged). Legacy recordings re-keyed.
- New task `reference-target` (`reference-target@2`, schema `reference-target.s2`): the pair builder `llm/reference-pairs.ts` resolves outside references ("Section E", "Part C", lettered headings) and builds one pair per (pointer, label) with the pointer sentence as exact prefix plus one TARGET block; the model returns a verdict (match / mismatch / unclear) and only `mismatch` items become findings; the quote must be the pointer sentence.
- Wiring: task registry, `AI_TASK_IDS`, contracts snapshot (additive), Worker accepts the id, web engine types and AI lane; Worker byte-parity digests re-pinned on purpose.
- Defect bench: `scripts/src/bench/bench-defects.ts` (`bench:defects`) and `author-bench-recordings.ts` (`bench:author`) over the 46-doc EDGAR corpus; ground truth `fixtures/defect-bench/ground-truth.json`; spend tracked by the `BenchLedger` (outside the repo, separate from the `scripts/src/live` Ledger).
- e2e fix (deviation F7): `ai-resume`, `ai-no-duplicates`, `variance-ai-never-gates` now count `/api/ai` calls per task.
- Research: `docs/research/anduin-analyst-and-counsel-loop.md`. EDGAR evidence: 21 real defects across 46 docs; before this work the engine caught 8 of 20 and produced about 300 of 437 findings that were false positives.
- Deployed: Worker `preflight-legal-reviewer` version `f7b25f68-681f-4898-851f-4428135a9ff4`, built from a clean worktree of d6a4e5d (the 14 uncommitted UI files of another session were not deployed). Rollback target `970236bc-bc9f-4b7a-bc17-7d62ef392e8b` (no schema change; D1 stays at migrations 0001-0007, schema 7). Live checks: `/api/health` 200 no-store, CSP present, bundle contains `reference-target`, clean page load.
- Commits on main (not pushed): d6a4e5d (final), plus b683b8c and dded9c7 made by another session that included part of this work.
- Live OpenAI spend for this work: $0.3379 (gpt-4.1-mini, BenchLedger; cap for this work $1.00).

## What Was Skipped/Deferred
- Held-out precision (30 docs outside the verified subset): 14 non-matching findings, North Haven 2022 has 7 and West Bay 2024 has 3; run-to-run variance is high. Not an AC. Backlog F1.
- Per-investor pass (F2), selector-vs-instruction (F3), cover-vs-detail (F4), structurer defined-term noise (F5), unlettered blocks (F6). Backlog F2-F6.
- 4 eslint errors in `scripts/src/bench/bench-defects.ts`. Backlog F8.
- Stale stack slice smoke. Backlog F9.

## Test Gate Outcomes
- 26 of 26 offline gates green (core goldens, recorded, security, worker byte-parity and openai-request-shape, web unit, scripts, `fixtures:check`), per EVL handoff.
- Bench verified subset offline authored: 3 of 3 caught, Partners Group refs 4 of 4. Live replay (`--offline --source live`): 3 of 3 with 3 non-matching (AC10 limits: at least 2 of 3, at most 2 per doc, at most 16 total).
- e2e `ai-resume`, `ai-no-duplicates`, `variance-ai-never-gates` pass.
- Red, not caused by this plan: `e2e/slice.spec.ts` on the stack project (welcome screen overlays the doc switcher, from dded9c7; F9); about 48 preview specs on removed `sample-option` and changed UI text (F7b); lint (F8).

## Plan Deviations
- `reference-target@2` instead of `@1` (EVL cycle 1): verdict schema, one pair per (pointer, label) with one TARGET block plus an optional NOTE line, resolver additions (nested lettered fallback, short prefixed headings, qualified sub-references are not pointers).
- Added `bench:author`, `--source authored|live`, `--subset heldout`.
- Playwright touched at the user's deploy approval (F7).
- Ground-truth ids split (E4a-E4d, E13, E14); contract snapshot regenerated with `pnpm --filter @aduin/core test contracts -u`.
- AC10 first live runs failed (1 of 3, 11 and 21 non-matching with `@1`); fixed by the `@2` design, then green (final run 3 of 3, 3 non-matching).

## Test Infra Gaps Found
- Stack slice smoke is stale (F9). Remaining preview specs use removed helpers (F7b). Lint errors in the bench script (F8).
- No held-out gate in the bench (F1, optional majority vote per pair).

## SPEC Achievement
The locked SPEC is inside the plan. Scoring by plan acceptance criteria: AC1-AC9, AC11, AC12 met (offline gates); AC10 met (live, after `@2`). Not-required defects (E4 beyond the 4 refs, F2-F4 kinds) are explicitly out of the SPEC.
## SPEC Gaps
None for the plan criteria. Held-out precision and non-pointer defect kinds are backlog F1-F4 (SPEC frozen, not edited).

## Closeout Packet
1. Plan: `process/general-plans/completed/llm-defect-detection_22-10-26/llm-defect-detection_PLAN_22-10-26.md`
2. Classification: Ready for UPDATE PROCESS archival (with gaps in backlog). Archival gate: every developed-behavior criterion is proven by a passing automated or live gate; the open gaps are not plan criteria, so none forces keep-active.
3. Finished: see What Was Done.
4. Verified: offline gates, bench, live AC10, deploy checks. Unverified: held-out precision, live AI in a real browser session (Turnstile, operator residual R2).
4b. Validate-contract: present, Gate PASS.
5. Cleanup done: context docs, backlog stubs F8 and F9, plan status. Still needed: commit of process artifacts (not done here), 14 unrelated dirty UI files belong to another session.
6. Next: orchestrator commits the process changes; next work is backlog F1 or F9.
7. Commit: execution commits already on main; process commit belongs after this UPDATE PROCESS.
8. Regression: n/a (not a phase program); engine goldens and `fixtures:check` unchanged.
9. SPEC achievement: above.

Drift score: HIGH (4 signals: 10+ files touched, README/protocol untouched but backlog NOTE written and task folder archived, 3+ memory-worthy observations, plan deviations from `@1` and pair design).
Strongly recommend UPDATE PROCESS -- harness/protocol files touched.
