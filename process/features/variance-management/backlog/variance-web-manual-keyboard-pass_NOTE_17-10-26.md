---
name: note:variance-web-manual-keyboard-pass
description: "Manual keyboard pass for Variance Phase 02 web findings UI (baseline control, All/Errors/Changes, change rows)"
date: 17-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
---

# Manual keyboard pass - web findings (Phase 02)

**Context:** Phase 02 adds the baseline control and modal, the All/Errors/Changes segment, change rows, cosmetic groups and impact lines. Automated axe and keyboard specs cover structure only.
**Why deferred:** needs a human; Known-Gap residual with this stub, so the Phase 02 UI a11y gate stays CONDITIONAL on it. Can be combined with the Phase 04 pass (see variance-manual-keyboard-pass_NOTE_17-10-26.md).
**Owner:** the user. **Trigger:** after Phase 05 deploy.
**Steps:** keyboard-only: open baseline modal, choose baseline, toggle segment, expand a change row, expand cosmetic groups; verify focus order, visible focus, Esc behaviour, non-colour cues at 1440 and 1024 widths. Record in a REPORT.

