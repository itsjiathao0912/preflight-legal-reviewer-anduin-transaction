---
name: note:variance-package-01-key-divergence
description: "Package-01 (design Northgate III vs Fund II DOCX): engine rows differ from the answer key's 7 shown (3 new + 4 changed_logic); recall 7/7 holds"
date: 17-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
  phase: phase-01
---

# Package-01 answer key vs engine (Phase 01, E14 / G9)

**Bottom line:** the engine recalls all 7 answer-key passages in non-cosmetic hunks of shown rows (asserted by `variance-package-01-northgate`). It does NOT reproduce the key's "7 shown = 3 new + 4 changed_logic": it shows 9 rows (2 new + 7 changed_logic). This is recorded, not asserted, per plan H4.

**Measured (EXECUTE 2026-10-17, code 42b3ecb):** raw 64, shown 9 (new 2, changed_logic 7), cosmetic 39 in 3 groups (`VAR-COS-NAME:II -> III` 11, `VAR-COS-RENAME:II -> III` 1, `VAR-COS-RENAME:Units -> Interests` 27).

| Key item | Key class / owner | Engine class, rule / owner | Engine row (unit) |
|---|---|---|---|
| V1 Section 7A Source of Funds | new / fund admin | new, VAR-NEW-UNIT / fund_admin | body:1/s7a |
| V2 Singapore row | new / GP + counsel | changed_logic, VAR-LOGIC-GUARD-JURISDICTION / gp,counsel | body:1/s4/pa (shared with V4) |
| V3 10.4 Sanctions | new / counsel | new, VAR-NEW-INSERTION / counsel | body:1/s10 |
| V4 4.2 non-US entities | changed_logic / counsel | changed_logic, VAR-LOGIC-GUARD-JURISDICTION / gp,counsel | body:1/s4/pa (shared with V2) |
| V5 minimum $2.5m to $5m | changed_logic / GP | changed_logic, VAR-LOGIC-GUARD-DIGIT / counsel | body:1/s1 (shared with dates) |
| V6 tax status select all | changed_logic / counsel | changed_logic, VAR-LOGIC-GUARD-INVESTOR / counsel | body:1/s6/pa (shared with V7) |
| V7 trust split | changed_logic / counsel | changed_logic, VAR-LOGIC-GUARD-INVESTOR / counsel | body:1/s6/pa (shared with V6) |

**Why the rows differ (by design of the locked rules, not a defect):**
- Units are top-level sections or parts, and D3 clusters per unit, so V2+V4 and V6+V7 share one row each.
- The Singapore table row ("Singapore Registered office address: ____ ☐") is under 12 words, so it is not a step-1 `new` insertion; it carries a jurisdiction word, so it is logic and makes the Section 4 Part A row mixed (`changed_logic`).
- The key's "cosmetic" items are digit changes in operative text (address Suite 1200 to 1400 in the cover, Section 14 and Annex B; first-closing dates 2024 to 2026 in Sections 1-2; Annex C labels `C-3` to `C.3`). The D1/G2 digit guard classifies them as logic. That adds 3 extra rows (body:1, body:1/s14, instructions:b) and extends the Section 1 and 2 rows.
- Owners follow the routing table: the merged Section 1 row (V5 + dates) gets no class-minimum title match, so it routes to counsel (key: GP); the V6/V7 row title "Investor Type and Tax Status" matches the tax-status rule first, so the trust split routes to counsel (key: counsel; SPEC A9 says GP for the demo corpus, D-S0-6: note only).

**Owner:** design session / product (rules owner). **Trigger:** before using package 01 as a demo of the 214-to-7 style reduction, or when tuning the rules config.
**Options (each a PLAN-level decision, not done in Phase 01):** (a) accept as documented (the authored `fixtures/variance` corpus stays the exact 214/7/207 pin); (b) add a cover/address rule or a sub-unit clustering level (paragraph-level rows) through a rules-config version bump; (c) re-author the design answer key to count rows per top-level unit. Never loosen `variance-package-01-northgate` recall.
