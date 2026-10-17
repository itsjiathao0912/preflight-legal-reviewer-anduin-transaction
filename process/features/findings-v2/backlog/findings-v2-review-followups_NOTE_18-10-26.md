---
name: note:findings-v2-review-followups
description: "Findings v2 deferred review items R11, R15, R16, R19, R20, cleanup list, residual visual diffs and the manual keyboard and screen-reader pass"
date: 18-10-26
feature: findings-v2
metadata:
  node_type: memory
  type: note
  feature: findings-v2
---

# Findings v2 review follow-ups (deferred at closeout, 18-10-26)

Priority: low to medium. None blocks the live release (7db9e602). Source: code review of Phase B (see `process/features/findings-v2/completed/findings-v2_18-10-26/findings-v2-phase-b_REPORT_18-10-26.md`, "Code review fixes").

## Review items (not fixed)

- R11, R15, R16, R19, R20: deferred unchanged by the orchestrator; the review wording is in the Phase B code review output. Re-read the findings panel and zoom code before picking them up.

## Cleanup list

- Dead `base.css` rules for the deleted FindingRow and fp aside.
- Move `isEditableTarget` into one shared util (duplicated).
- `safeSet` used inside an effect; `viewRef` used inside an effect (tidy).
- `h3` without a parent `h2` in the panel (heading order).

## Residual visual differences from the mockup

- At 100% zoom on 1440 the 700px page is wider than the reading area, so no grey margin shows (mockup default is Fit width 90%).
- Row location ("Section 3") is not right-aligned on the row title.
- Counts keep " · " separators (pinned by e2e); mockup uses spacing only.

## Verification still to do (operator)

- Manual keyboard pass (J/K/C/X, zoom keys, resize handle) and a screen-reader pass of the findings panel.
- Intake package lens a11y `label-content-name-mismatch` (4) is tracked in the Intake backlog, not here.

## Test path debt

- `apps/web/e2e/design-probe.spec.ts` writes to `process/features/findings-v2/active/findings-v2_18-10-26/design-probe/`, which moved to `completed/` at archive. Point it at a stable location before the next run.

## Accepted as designed (no action)

- R4 dismissed hidden from Closed under the default filter (P-7); R7 Cmd/Ctrl zoom keys (D15).
