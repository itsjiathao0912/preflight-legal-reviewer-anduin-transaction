---
name: subdoc-qa-mvp-phase01-pvl-iteration-001
description: PVL cycle 1 report for phase 01 (core engine)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 1
  phase: "01"
---

# Phase 01 — PVL iteration 001

- First-pass verdict: Gate: CONDITIONAL (0 FAIL, 10 gaps).
- Gaps:
  1. Algorithm L (ref-label-coherence).
  2. Algorithm H (heading inference).
  3. Algorithm U (undefined term).
  4. Algorithm S (statutory exclusions).
  5. Finding quote, snap and fingerprint rules.
  6. Field-level contracts v1.
  7. Frozen model shapes.
  8. F0 seam edits.
  9. Exact-count and negative goldens, test:vectors.
  10. Security hardening.
- Supplement: SUPPLEMENT_APPLIED (10 gaps); validators report 0 failures.
- Orchestrator decisions:
  - Mask format follows DATA-MODEL 2.2 (`#` + last 4).
  - The Turnstile claim is named `t` (epoch ms).
  - New `v` visitor-id claim so `a` keeps its analyst meaning. This was edited directly in the SessionClaims paragraph.
- Next: re-validate from V1 (in parallel with 03 and 04a).
