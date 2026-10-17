---
name: note:variance-live-regression-operator
description: "Operator steps for the live R-01 regression write path on the deployed D1 (needs a human Turnstile session); NEW PLAN REQUIRED"
date: 17-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
---

# Live R-01 regression write path - operator run

**Status:** NEW PLAN REQUIRED (operator-run residual; named in P05 Known Gaps).
**Owner:** the user (a human in a real browser). **Source phase:** variance Phase 05 (G3).
**Trigger:** after the Phase 05 deploy and live smoke are green, or whenever the operator has a real-browser session.

## Why deferred
The live memory write (record an answer with an assertion, then see the R-01 blocking finding) needs a Turnstile token. Automated headless Chromium cannot obtain one (residual R2). The behavior is proven locally by `stack-memory-variance-regression-no-cross-firm`; only the live-D1 portion is unproven. The live D1 demo workspace is append-only, so the run uses the visitor's sandbox copy only.

## Exact operator steps
1. Open https://aduin-transaction-web.giathaowork.workers.dev in a real desktop browser (not automation). Wait for the Turnstile widget to pass.
2. Open the Hartwell and Crane Fund II sample titled "(variance demo)" and then Fund I as its baseline (setup pair Fund II vs Fund I).
3. On the finding "Appendix C must exist", Answer with an assertion (record the Fund II firm-template answer). Confirm the answer saves (no error toast; Network tab shows the answer POST returning 2xx).
4. Open Fund III (variance demo) with Fund II as baseline. Expect the R-01 blocking finding labelled "Regression: confirmed in Fund II" and the gate to show Blocked.
5. Open the same Fund III in a second firm context (a different sample firm, e.g. firm-x package) and confirm NO R-01 finding appears (cross-firm isolation).
6. Record: date, Worker version id from /api/health, the observed counts, and any console errors, in a REPORT under this feature. Spend no AI or OCR calls (do not press AI actions). Never touch the protected Cloudflare zone.

## Pass criteria
Answer persisted; R-01 shown in the same firm; absent in another firm; no console errors; zero AI/OCR calls.

