---
name: note:variance-manual-keyboard-pass
description: "Manual keyboard and screen-reader pass for Variance Phase 04 owner and answer UI (residual after automated a11y)"
date: 17-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
---

# Manual keyboard pass - owners and answers (Phase 04)

**Context:** Phase 04 adds owner chips, the Questions-by-owner tabs and the answer dialog. Automated gates (axe, a11y-keyboard) prove zero critical axe and tab order, not human usability.
**Why deferred:** a manual keyboard and screen-reader pass needs a human; recorded as a Known-Gap residual (named, never a proving strategy), so the NFR a11y gate stays CONDITIONAL on this item.
**Owner:** the user (or a later a11y plan). **Trigger:** after Phase 05 deploy, or before any external demo.
**Steps:** with keyboard only, walk Findings > owner chip popover > Questions tab per owner > export > Answer dialog (assertion preview) > Esc and focus return; note focus loss, traps, unlabeled controls. Record results in a REPORT; open fix stubs per defect.

