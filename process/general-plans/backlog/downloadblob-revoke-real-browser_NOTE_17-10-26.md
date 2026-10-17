---
name: backlog:downloadblob-revoke-real-browser
description: "Backlog R3 (Phase 09): downloadBlob object-URL revoke timing is only tested with stubs and one real e2e download"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: subdoc-qa-mvp
---

# R3: downloadBlob revoke timing in real browsers

- **Priority:** P3 (named residual of AC63; low risk).
- **Problem:** `apps/web/src/lib/download.ts` `downloadBlob` revokes the object URL in a `setTimeout(0)`. The unit test (`download-blob`) uses stub URL functions and fake timers. The e2e download exercises the real call once, but real-browser revoke timing (Safari/Firefox) is not asserted. A too-early revoke could cancel a large download.
- **Fix options:** raise the delay (for example 1000 ms) or revoke on a later event; add a real-browser Agent-Probe on Firefox and WebKit via Playwright projects.
- **Owner:** Phase 10 polish. Phase 08 reuses `downloadBlob` unchanged until then.
- **Source:** Phase 09 plan Exit Gate R3; Phase 09 REPORT closeout.
