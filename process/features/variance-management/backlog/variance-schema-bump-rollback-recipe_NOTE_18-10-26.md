---
name: note:variance-schema-bump-rollback-recipe
description: "Fix the deploy/rollback recipe and plan templates: after a schema_version bump the previous Worker is write-incompatible, so rollback must be roll-forward or D1 restore"
date: 18-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
  phase: phase-05
---

# Schema-bump rollback rule (incident 18-10-26)

**Priority:** P1 (process).
**Problem:** the P05 plan listed `8a82ead2` as the automatic rollback target. After migration 0006 set `schema_version` 6, `8a82ead2` (`EXPECTED_SCHEMA_VERSION '5'`, `health.ts:7`, `ctx.ts:115`) refuses memory writes (503). Rolling back caused about 3.5 min of write outage (20:28:35-20:32:11 UTC) until roll-forward.
**Root cause:** the plan assumed additive nullable columns make the old Worker safe. True for reads only; the version pin makes writes fail.
**Recorded so far:** `process/context/worker/all-worker.md` (deploy and rollback recipe) carries the rule.
**Remaining work (optional):** (a) add a "schema-bump rollback" line to `process/development-protocols/plan-lifecycle.md` or the deploy-plan checklist so future plans never name the pre-migration Worker as an auto rollback target; (b) consider relaxing `EXPECTED_SCHEMA_VERSION` to a min-compatible range for additive migrations; (c) rehearse "restore D1 from Time Travel bookmark" once.
