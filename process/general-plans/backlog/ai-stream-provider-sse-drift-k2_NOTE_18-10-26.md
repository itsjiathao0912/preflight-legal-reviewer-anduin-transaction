---
name: backlog:ai-stream-provider-sse-drift-k2
description: "K2: OpenRouter SSE shape could drift (comments, error chunks, finish reasons); only the probe-time shape is tested"
date: 18-10-26
metadata:
  node_type: memory
  type: reference
  feature: none
---

# K2: provider SSE shape drift

**Status:** open. Source: ai-review-stream-dedup (completed/ai-review-stream-dedup_18-10-26).

readSse handles the shapes seen in the probe and synthetic failure shapes. To do: add a periodic live probe or a recorded-shape canary so a provider change shows up as stream_truncated or malformed in tests, not live.
