---
name: note:variance-regression-check-revoke
description: "No revoke path for regression checks: 20 active checks per firm per sandbox is a hard ceiling (variance P03 D5c)"
date: 17-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
---

# Regression checks cannot be revoked in the MVP

**Status:** NEW PLAN REQUIRED (small). **Priority:** low (demo sandboxes are short-lived). **Source:** variance Phase 03, deviation list D5c, review notes.

**Problem.** `regression_check.status` can flip `active` to `revoked` only by direct SQL (proven in the `triggers` test). No route does it. A reopened or superseded answer leaves its check `active`, so the `regression_check_cap` trigger makes 20 active checks per firm per workspace a hard ceiling, and a stale check keeps producing a regression finding after the analyst changed their mind.

**Fix option.** Flip the checks linked to a decision (`source_answer_id`) inside the existing revoke batch (`POST /api/decisions/:id/revoke`): +1 statement, about +1 row written. Update `MEMORY_WRITE_WEIGHTS` for revoke, add a `rows-written` assertion, a `triggers` row and a stack-memory case. Additive; no contract field needed.

**Not blocking.** Known-Gap named in the P03 report; phase 05 should mention the ceiling in the handoff notes.
