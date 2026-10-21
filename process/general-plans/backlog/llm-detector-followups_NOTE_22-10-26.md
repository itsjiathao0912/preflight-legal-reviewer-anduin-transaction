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

**Status:** open. Source plan: `process/general-plans/active/llm-defect-detection_22-10-26/llm-defect-detection_PLAN_22-10-26.md`.

| # | Follow-up | Why it is not in the plan |
|---|---|---|
| F1 | Live model recall of the `reference-target` task and `clause-judgment@2` is unproven. Run `bench:defects --live --subset verified` (16 docs, about $0.17 on gpt-4.1-mini) (approved by the user for testing; guarded by ledger, $10 cap, ask above about $1). | Run as AC10 at EXECUTE; if it could not run (key or cap), this stays open and the plan closes CONDITIONAL. |
| F2 | Energea per-investor-type pass: contradiction inside one investor path (5.21 non-U.S. allowed vs 5.22.2 U.S. citizen or resident). | Needs a new pass that groups clauses by investor type. |
| F3 | Selector-vs-instruction detector: Keystone four investor types offered but two routed; Hatteras selector omits Community Property; NF Investment never assigns Section G. | Absence of a pointer cannot be found by a pointer-sentence pair builder. |
| F4 | Cover-vs-detail detector: Third Point cover checklist (box 11 may skip II, III and IV) vs Exhibit H and Section IV text. | Two distant places, no single pointer sentence. |
| F5 | Structurer fix for defined-term noise (316 of 437 findings on the 46-doc corpus are defined_term_issue). | Moves goldens and fixtures; needs its own plan. |
| F6 | Third Point and unlettered-block cases: "Co-Investor block has no letter" (Franklin 4A and 4B). | Structurer labeling issue. |
| F7 | Existing preview e2e specs `ai-resume`, `ai-no-duplicates` and `variance-ai-never-gates` assert exactly one `/api/ai` call per upload; uploads with reference pairs now make two. Update the assertions and run them. Also consider AI-vs-AI dedupe (none added). | Playwright is excluded by the user for this plan. |
