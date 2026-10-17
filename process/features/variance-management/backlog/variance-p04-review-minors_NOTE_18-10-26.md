---
name: note:variance-p04-review-minors
description: "Variance Phase 04 code-review minors not fixed in the EVL fix cycle (stub parity, per-owner export marking, badge drift, filename, comments)"
date: 18-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
  phase: phase-04
---

# Variance Phase 04 review minors (not fixed)

**Context:** The Phase 04 code review (PASS WITH NOTES) found one major and several minors. The major and two minors were fixed in f42f56d and a6ccd1b. These remain. None blocks the gate or the demo. Priority: low unless noted.

1. **Stub parity gaps (low):** the Dexie stub (`apps/web/src/api/stubMemoryApi.ts`) does not match the Worker on id charset, the 64-character limit, and idempotency per run plus key. Fix: mirror the Worker rules and add a parity test.
2. **Per-owner export marks other owners' questions exported (medium):** `markExported` is run-wide, so exporting for one owner marks other owners' drafted questions as exported. Fix: mark only the exported owner's question keys.
3. **Sidebar badge drift for pre-P04 triage (low):** the sidebar Questions badge can disagree with the tabs for triage written before Phase 04. Fix: derive the badge from the one owner selector, or migrate old triage on read.
4. **Extra `lookupWithChecks` read per document open (low):** one more memory read per open than needed. Fix: reuse the first lookup result.
5. **"All" export filename and heading still say "counsel" (low):** rename to "questions" for the All tab export.
6. **Stale comment on the regression finding (trivial):** update the comment to describe the "Earlier funds" finding.
7. **Two unsynced owners on one row are both cleared on reopen (low):** decision rows carry no owner, so a reopen before sync clears both. Fix: carry the owner on the decision row or the outbox op.

**Also recorded (already tracked elsewhere):** M1 fund-scope supersede family (`variance-fund-scope-supersede_NOTE_17-10-26.md`), no revoke path and the 20-check ceiling (`variance-regression-check-revoke_NOTE_17-10-26.md`), manual keyboard pass, live Worker regression path and live D1 persistence (Phase 05 and operator residual).
