---
name: note:variance-live-probe-rerun
description: "Operator: re-run probe:live-variance on the live Worker d9aaddd9 on the next UTC day (session ledger was 4 of 5)"
date: 18-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
  phase: phase-05
---

# Re-run the live variance probe (operator, next UTC day)

**Priority:** P1 (the only live end-to-end proof of the Variance upload flow).
**Problem:** `pnpm --filter @aduin/scripts probe:live-variance` failed twice on 18-10-26 at the `firm-combobox` fill ("element was detached"). Cause was a probe timing bug (the probe did not wait for the Open dialog to close after `open-submit`), not a product bug. Fixed in `179c315`. A third run was refused by the session ledger (4 of 5 used that UTC day).
**Fix / action:** on the next UTC day run `pnpm --filter @aduin/scripts probe:live-variance` against `https://aduin-transaction-web.giathaowork.workers.dev` (live `d9aaddd9`). Expect Fund I, II, III uploads, change rows and the gate. Zero AI calls. If it passes, record the result in the P05 report and close this note.
**Tier:** Known-Gap residual (Agent-Probe; never a proving strategy).
