---
name: backlog:ai-stream-candidate-quality-k3
description: "K3: model quality on the new (rule-sentence-free) candidate sets has only one live run; re-record samples 1 and 3 live"
date: 18-10-26
metadata:
  node_type: memory
  type: reference
  feature: none
---

# K3: model quality on new candidate sets

**Status:** open. Source: ai-review-stream-dedup (completed/ai-review-stream-dedup_18-10-26).

Candidate selection no longer includes deterministic-finding sentences. Only one live run (NG3, 8 AI suggestions) checks quality. To do: with the free allowance, run record:author live for samples 1 and 3 (optional step I6), then re-run the core gates.
