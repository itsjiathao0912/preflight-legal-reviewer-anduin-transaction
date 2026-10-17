---
name: note:variance-page-label-noise-rows
description: "RESOLVED (option a, EVL fix cycle 1, 789eb8f) - Real pair #5 -> #6 shows 5 change rows whose only change is a dropped EDGAR page label (B-1..D-2); no cosmetic rule covers them, so they are logic by design"
date: 17-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
  phase: phase-01
---

# Page-label artifact rows on #5 -> #6 (Phase 01 precision observation)

**Bottom line:** AC-V6 passes as measured (cosmetic shown as logic 1 of 39 logic rows = 2.6% overall; 1 of 20 = 5% on #5 -> #6). But 5 more #5 -> #6 rows show only because a 2024 EDGAR page footer label ("B-1", "B-2", "B-6", "B-9", "D-1"/"D-2") is gone in 2026. Counted as cosmetic they would make 6 of 20 #5 -> #6 logic rows (30%) and 6 of 39 overall (15.4%).

**Why they are logic today:** none of the 6 locked cosmetic rules (rename, name, renumber, cover date, format, move) covers a page label, and "unknown means logic" protects the 100% recall target. Adding a rule was out of Phase 01 scope (no rules beyond DECISION D1).
**Rows (unit keys):** `signature:1/s2/pa`, `signature:1/s4`, `signature:1/s10/pd`, `appendix:a`, `appendix:b`. Hand-labelled table lives in `packages/core/test/unit/variance-precision-measure.test.ts`.

**Owner:** rules owner (PLAN). **Trigger:** before claiming precision on real EDGAR pairs, or V5 demo of #5 -> #6.
**Options:** (a) a `VAR-COS-PAGE-LABEL` rule for whole-token page labels (`^[A-Z]-\d{1,3}$`) deleted or inserted at block ends, via a rules-config version bump plus recall traps; (b) strip page labels in the HTML adapter noise pre-pass (affects every detector: needs the golden suite); (c) accept and document. Keep the recall matrix green whichever is chosen.


**Status: RESOLVED (17-10-26, EVL fix cycle 1).** Option (a) chosen: `VAR-COS-PAGE-LABEL` (rules 2026.10.2, commit 789eb8f; tests 0ee9fca). The 5 rows are no longer shown; strict precision 2.9% overall, 6.7% on #5 -> #6; recall 25/25, logic hidden as cosmetic 0.
