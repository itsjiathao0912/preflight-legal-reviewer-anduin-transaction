---
name: note:variance-docs-handoff
description: "Docs handoff for the design/doc owner after Variance Phase 05: stale facts in README.md, docs/DEPLOY.md and docs/architecture/* (read-only for the variance program)"
date: 18-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
  phase: phase-05
---

# Variance docs handoff (for the doc owner)

Variance does not edit `README.md`, `docs/**`, `design/**` or `samples/packages/**`. These facts changed and need the doc owner:

1. **Migrations:** live D1 moves from 0001-0005 to 0001-0006 (`0006_variance.sql`, schema_version `'6'`) when leg 2 deploys. `docs/DEPLOY.md` still names the 0001-0005 range.
2. **Live version id:** recorded in the Phase 05 report after leg 2 (rollback target before it: `b04f1a8c-41f5-4c20-92dc-196d6e7d252a`, then `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f`).
3. **`version_drift` is now emitted** by variance (change rows on a firm baseline); docs that call it future work are stale.
4. **Counts stay true:** 13 detectors, 15 issue classes (pinned by `scripts/test/counts-wording.test.ts`). Variance rules are change classes, not detectors.
5. **Which route shows which number (demo script):**
   - Upload route, firm Hartwell & Crane LLP: Fund I, then Fund II (record the firm-template answer "Appendix C must exist" on the Appendix C change), then Fund III and pick Fund II in the `vs ... ▾` control: 214 raw, 7 shown (3 New, 4 Logic), 207 cosmetic in 5 groups, plus the R-01 regression row.
   - Picker samples titled "(variance demo)" open as single documents with no baseline (samples never become a baseline). Presenter convenience only.
   - Demo package Northgate (now firm Hartwell & Crane): 64 raw / 9 shown against the Fund II subscription agreement; answer-key recall 7/7 (not 7 shown).
   - Demo package Lotus Bay (now firm Ostrander Pell): v1 draft as baseline; the "shall not" -> "shall" meaning change (answer key V6) is a change row.
   - Demo package Redwood Ridge (no firm in the reference list): errors only, no baseline control.
6. **Known limitations to mention:** fund-scope supersede (M1) and no revoke path for regression checks (D5c), see the P03 backlog notes.
7. **App name:** another session renamed the app to Preflight (c677ce6); the counsel DOCX creator field still says "Sub-doc QA" (`exportDocx.ts`), owned by that session.
