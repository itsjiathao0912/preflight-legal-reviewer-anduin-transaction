---
name: note:variance-demo-preseeded-r01
description: "Option: pre-seed the R-01 firm-template check in the live demo workspace (needs explicit user approval; the demo workspace is append-only)"
date: 18-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
  phase: phase-05
---

# Pre-seeded R-01 in the live demo workspace (deferred, needs approval)

Today the live demo shows R-01 by recording the Fund II answer "Appendix C must exist" in the visitor's sandbox copy (about 2 minutes, scripted in the demo flow). `apps/worker/seed/demo.sql` and `seed:check` are unchanged.

Pre-seeding would add a `regression_check` row (and its decision/answer chain) to the live demo workspace. That is irreversible: demo rows cannot be deleted (trigger) and the seed runs once with `seed_mode=1`. It needs: a new seed spec entry, `seed:gen` with the pinned reference firm ids, `seed:check`, sandbox seed-copy support for `intent`/`scope` (`apps/worker/src/memory/repo/seed-copy.ts` copies decisions without them today), a remote write with `seed_mode=1`, and explicit user approval. NEW PLAN REQUIRED if wanted.
