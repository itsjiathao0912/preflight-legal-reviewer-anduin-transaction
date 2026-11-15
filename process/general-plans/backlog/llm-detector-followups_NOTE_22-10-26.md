---
name: backlog:llm-detector-followups
description: "Follow-ups left by llm-defect-detection: model recall unproven until a live run, per-investor pass, selector-vs-instruction and cover-vs-detail detectors, structurer defined-term noise"
date: 22-10-26
metadata:
  node_type: memory
  type: reference
  feature: none
---

# LLM detector follow-ups (from llm-defect-detection_22-10-26)

**Status:** open. Source plan: `process/general-plans/completed/llm-defect-detection_22-10-26/llm-defect-detection_PLAN_22-10-26.md`.

| # | Follow-up | Why it is not in the plan |
|---|---|---|
| F1 | RESOLVED for the verified subset at EVL cycle 1 (22-10-26, `reference-target@2`): live 3 of 3 (E1, E2, E3), 3 non-matching (2 Keystone duplicate Part A, 1 LAGO). Earlier `@1`: 1 of 3 with 11 and 21 non-matching. OPEN: held-out precision. On the 30 corpus docs outside the verified subset (19 build pairs) the final run gave 14 non-matching findings, over the per-doc limit in North Haven Private Income 2022 (7) and West Bay BDC (3); run-to-run variance is large (North Haven 2022: 0 in one run, 7 in the next). Causes: (a) resolver misses headings merged into long blocks ("Subscriber Questionnaire Section B: ..." inside a block over 200 chars), so pointers get NOT FOUND or a heading line becomes a pointer; (b) West Bay is an exemption doc whose "Section I(h)(3)" points at an external exemption; (c) model noise on duplicate same-title headings. Next: structurer-level heading detection (F5/F6), an optional second sample or majority vote per pair, and a held-out gate in the bench. Replay: `bench:defects --offline --subset heldout --source live`. | Held-out precision is not an AC of this plan; reported, not tuned further. |
| F2 | Energea per-investor-type pass: contradiction inside one investor path (5.21 non-U.S. allowed vs 5.22.2 U.S. citizen or resident). | Needs a new pass that groups clauses by investor type. |
| F3 | Selector-vs-instruction detector: Keystone four investor types offered but two routed; Hatteras selector omits Community Property; NF Investment never assigns Section G. | Absence of a pointer cannot be found by a pointer-sentence pair builder. |
| F4 | Cover-vs-detail detector: Third Point cover checklist (box 11 may skip II, III and IV) vs Exhibit H and Section IV text. | Two distant places, no single pointer sentence. |
| F5 | Structurer fix for defined-term noise (316 of 437 findings on the 46-doc corpus are defined_term_issue). | Moves goldens and fixtures; needs its own plan. |
| F6 | Third Point and unlettered-block cases: "Co-Investor block has no letter" (Franklin 4A and 4B). | Structurer labeling issue. |
| F7 | RESOLVED 22-10-26 (pre-deploy): `ai-resume`, `ai-no-duplicates` and `variance-ai-never-gates` now answer `task: 'reference-target'` with a clean result and count `/api/ai` calls per task (helpers `isRefTarget`, `callsOf`, `noRefTargetFindings` in `apps/web/e2e/fixtures/ai.ts`). Root cause was the tests, not the product: the two-pass lane already sends no reference-target after a failed clause-judgment call and runs each pass once per attempt. All 5 tests pass. AI-vs-AI dedupe: still none added (open). | - |
| F7b | Harness drift found while closing F7 (not caused by this plan): 0c3a6a2 replaced the single-sample picker (`sample-option`) with demo packages, so every spec using `openSample` in `apps/web/e2e/fixtures/app.ts` times out (e.g. `sample-zero-calls`, `provenance`, `auto-downgrade`, `ai-banners`, `csp-headers`, `ocr-unavailable`, `sample-picker-smoke`; about 48 specs import it). The two F7 specs moved to the new `uploadSample` helper (uploads the raw sample bytes, same doc hash; uploads auto-run AI so the 'Run AI on this sample' click is gone). Also failing for copy/screen drift: `counsel-sheet` ('3 requests · 2 items waiting'), `variance-intent-human-only` (no 'Questions' h1), `ai-banners` allowance. Fix: migrate the remaining specs, decide whether sample-only behavior (not_precomputed banner) still needs a test. | Out of scope for F7; test-breakage, product unchanged. |
| F8 | 4 eslint errors in `scripts/src/bench/bench-defects.ts` (found at EVL; `pnpm lint` red for the scripts package). Fix the lint errors only, no behavior change. | Found after the final deploy; not a plan criterion. |
| F9 | Stack slice smoke `apps/web/e2e/slice.spec.ts` fails: the welcome screen (added in dded9c7) overlays the doc switcher, so the click times out. Fix: dismiss the welcome screen in the spec (or use the new `uploadSample` helper), then re-run `SLICE_BASE_URL=... playwright test --project=stack`. | Test-breakage from another session's UI change; product unchanged. |
