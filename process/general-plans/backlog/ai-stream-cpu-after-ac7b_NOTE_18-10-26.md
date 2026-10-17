---
name: backlog:ai-stream-cpu-after-ac7b
description: "AC7b: Worker CPU after a streamed AI review not measured on live; before-deploy p99 was 35.0 ms (24 h)"
date: 18-10-26
metadata:
  node_type: memory
  type: reference
  feature: none
---

# AC7b: live CPU after streaming

**Status:** open. Source: ai-review-stream-dedup (completed/ai-review-stream-dedup_18-10-26).

Run the workerCpu GraphQL template (scripts/src/live/common.ts, probe:live-ai --tail) for a window covering only a streamed /api/ai review and compare to p50 4.1 ms / p99 35.0 ms. If an /api/ai event shows cpuTime over 50 ms, consider the coalesced-parse fallback. Related: phase10-worker-cpu-p99. Also E6: dropRuleDuplicates in the live path is proven on synthetic input only; confirm with a live finding that overlaps a rule finding.
