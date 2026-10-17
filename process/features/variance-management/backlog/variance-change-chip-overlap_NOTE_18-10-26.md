---
name: note:variance-change-chip-overlap
description: "UI defect seen in the Phase 05 agent probe: the New/Logic change-type chip overlaps the start of the change row title (1440 and 1024)"
date: 18-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
  phase: phase-02
---

# Change-type chip overlaps the row title

Seen in the Phase 05 D3 agent probe (Hartwell & Crane Fund III vs Fund II, e2e build, Chromium, 1440 and 1024 wide): in each change row the type chip ("New", "Logic") is drawn over the first characters of the title ("New text in Section 2 ..." reads "NewNew text", "Logic" is cut to "Log" under "Changed ..."). The mockup `design/mockups/app-variance.html` shows chip then title side by side.

Owner: Phase 02 web code (`apps/web/src/features/variance/ChangeRow.tsx` markup `.ct` and `apps/web/src/styles/variance.css`). Not fixed in Phase 05 (specs/samples/deploy scope). Automated gates do not catch it (axe reports no violation; text content is correct).

Fix idea: give `.rowb` a grid/flex column for the chip (`flex: none`) and let the title shrink with ellipsis; add a layout assertion (chip box right edge <= title box left edge) to `variance-demo-214-to-7` or a layout spec. QUICK FIX candidate (CSS only, one feature area).
