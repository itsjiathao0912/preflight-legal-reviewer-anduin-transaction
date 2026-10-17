---
name: backlog:investor-path-ground-truth
description: "Backlog R1 (Phase 09): investor-type paths are heuristic with no ground truth, so the outline export proves projection fidelity only"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: subdoc-qa-mvp
---

# R1: Investor-path correctness (no ground truth)

- **Priority:** P2 (named residual of AC63; AC63 is met for projection fidelity).
- **Problem:** investor-type paths (P2-2) are produced by a heuristic extractor. The logic outline export is proven to project them faithfully (counts, order, masking, byte-stability) but nothing proves the paths themselves are right.
- **Fix options:** hand-label investor paths for 3 to 5 samples and add a golden; or an Agent-Probe review against the source documents.
- **Owner:** a later phase or Phase 10 polish (NEW PLAN REQUIRED for a labelled set).
- **Source:** Phase 09 plan Exit Gate R1; Phase 09 REPORT closeout.
