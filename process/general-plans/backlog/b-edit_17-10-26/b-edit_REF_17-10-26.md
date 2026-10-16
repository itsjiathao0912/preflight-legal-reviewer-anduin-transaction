---
name: backlog:b-edit
description: "Backlog B-EDIT: AC6 'edit text/severity' clause has no affordance in app.html; needs a design decision and a later UI phase"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: subdoc-qa-mvp
---

# B-EDIT: edit finding text and severity (AC6 residual)

- **Priority:** P1 (partial AC6 until resolved)
- **Problem:** AC6 includes editing a finding's text and severity. The approved `design/mockups/app.html` has no affordance for it, so Phase 03 meets AC6 only partially (accept/reject paths only).
- **Root cause:** the sidebar redesign (app.html) dropped the edit control that the earlier review-workspace mockup implied.
- **Fix options:** (1) add an inline edit control in the finding drawer; (2) a dedicated edit sub-panel in the Findings screen. Either needs a design decision and a mockup step before build.
- **Owner:** a later UI phase (candidate: 08b or a new UI phase), after the user approves a mockup.
- **Source:** coordinator note during Phase 00 UPDATE PROCESS, 17-10-26. Umbrella AC matrix row AC6 and the M1 description reference this stub.
