---
name: note:variance-impact-real-sample-ground-truth
description: "Ground-truth review of Variance Phase 01 impact lines and owner routing against real SEC sample pairs (only authored corpus is pinned)"
date: 17-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
---

# Impact lines on real sample pairs - ground truth (Phase 01)

**Context:** Phase 01 pins impact lines and owner routing only on the authored `fixtures/variance` corpus (214 to 7). Real SEC sample pairs have no ground truth for which changes are logic and what impact applies.
**Why deferred:** needs a domain reviewer to label expected classes; building it inside Phase 01 would widen scope. Known-Gap residual; the corpus gates stay the proving strategy for the authored pair only.
**Owner:** the user or a domain reviewer. **Trigger:** before claiming variance accuracy beyond the demo pair; may reuse samples/packages answer keys (Phase 05 note).
**Steps:** pick 2-3 real related pairs from `samples/sub-docs/`, label expected change classes and impacts, add as a golden fixture plus a backlog-tracked test in packages/core. Record precision observations in a REPORT.

