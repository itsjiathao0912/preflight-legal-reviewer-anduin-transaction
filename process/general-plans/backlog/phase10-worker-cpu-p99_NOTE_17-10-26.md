---
name: backlog:phase10-worker-cpu-p99
description: "Phase 10 observation: aduin-transaction-web CPU p99 16 ms on 2026-10-17 (116 requests, 0 errors) is above the 10 ms Workers Free per-invocation limit; find the heavy route"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: subdoc-qa-mvp
---

# Phase 10: Worker CPU p99 above the Free 10 ms limit

**Status:** open, low priority. There were no errors.

GraphQL `workersInvocationsAdaptive` for `aduin-transaction-web`, 2026-10-17 00:00Z to about 08:10Z, covering versions 4325e4e4 and 67c796ff:

- 116 requests, 0 errors
- CPU: p50 1.6 ms, p99 16.0 ms
- Wall time: p50 2.0 ms, p99 240 s (held-open streams)

## To do

Find which invocation is heavy using `wrangler tail` with cpuTime per request. Candidates: cold start, cookie HMAC, the cron purge, and the 429 pre-limit burst. Then confirm whether any route risks error 1102 on Free. AI-call CPU at `max_tokens` 10000 is still unmeasured; see the operator note.
