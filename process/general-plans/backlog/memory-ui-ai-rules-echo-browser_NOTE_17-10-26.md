---
name: backlog:memory-ui-ai-rules-echo-browser
description: "Backlog: no browser-driven proof that a firm rule added in the memory page reaches an AI run (meta.rules_hash8 / rules_applied echo); Phase 08b named residual, Phase 10 live probe"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: subdoc-qa-mvp
---

# Browser-driven AI run echoing the firm rules hash (Phase 08b residual)

- **Priority:** P2 (named residual, gap-resolution D; AC51 is met by the Worker gates plus the Hybrid browser-to-Worker isolation spec).
- **Gap:** no test drives a real AI review from the browser after a rule is added in `#memory` and checks that the NDJSON `meta.rules_hash8` / `rules_applied` echo matches the firm's active rules.
- **Proven today:** Worker gates `firm-rule-in-context-recorded-llm`, `firm-rule-isolation`, `proposed-rule-never-injected` (server-side injection); `stack-memory-firm-rules` (rule added through the UI is stored for firm A only, firm B sees none, no AI call); web `rulesEchoMismatch` / `rulesHashMissing` unit cases (`gate-reexport`).
- **Why not now:** the local stack-memory Worker has no recorded upstream and the OpenRouter host is locked to openrouter.ai; a live call is out of scope (free-models-only, no live calls in EXECUTE).
- **Fix:** Phase 10 live probe on the deployed Worker: add a rule for a firm in `#memory`, run an AI review on that firm's document, assert the echoed `rules_hash8` equals the hash of the active rule texts and that a second firm's run does not echo it.
- **Owner:** Phase 10 (live verification). Source: Phase 08b plan C5 / Validate Contract residual row.
