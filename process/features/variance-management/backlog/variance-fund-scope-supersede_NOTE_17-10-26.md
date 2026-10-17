---
name: note:variance-fund-scope-supersede
description: "One active decision per (workspace, firm, fingerprint): a fund-scoped answer in fund B supersedes fund A's decision (variance P03 review M1)"
date: 17-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
---

# Fund-scoped answers supersede each other across funds

**Status:** known limitation, NEW PLAN REQUIRED if the behavior matters. **Priority:** medium. **Source:** variance Phase 03 code review, finding M1 (PASS WITH NOTES).

**Problem.** Uniqueness is `uq_decision_active` on (workspace, firm, fingerprint). The fingerprint is the same for a clause in fund A and fund B, so recording a `scope = fund` answer in fund B supersedes the active decision made in fund A (ping-pong). If the superseded decision was `firm_template`, live memory becomes last-writer-wins across funds. History is preserved (append-only), nothing is lost, but the active view flips and a firm-level answer can be silently replaced by a fund-level one.

**Fix options.**
1. Refuse (409 or a typed 400) a fund-scoped supersede of an active `firm_template` decision.
2. Widen uniqueness to include the scope key (fund name for fund-scoped rows). Needs a migration and a lookup change; larger.

**Interim.** P04 UI must not assume two funds keep separate active decisions. P05 handoff notes name this limitation.
