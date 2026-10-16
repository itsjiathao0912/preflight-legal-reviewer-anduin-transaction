---
name: subdoc-qa-mvp-phase07-pvl-iteration-001
description: Inner PVL cycle 1 report for phase 07 (version diff and sibling comparison)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 1
  phase: "07"
---

# Phase 07 — inner PVL iteration 001

- First-pass verdict: CONDITIONAL (0 FAIL, 9 CONCERN, 9 gaps).
- Gaps: S1 two gates (`test:golden <token>`) pass vacuously; S2 replacing the compare placeholder breaks four existing tests; S3 `diffDocuments` wire input undefined; S4 masking placement and leak gate; S5 Needs counsel scope; S6 fixture-script touchpoints; S7 e2e assertion list and timing outside `DiffResult`; S8 jsdiff returns `undefined` on edit-length/timeout; S9 tier hygiene and live-narrative Known-Gap.
- Fixes applied (SUPPLEMENT_APPLIED, all 9): gates now `test <token>` (filter behavior of web vitest and playwright verified to fail on no match); new Step G test repairs plus four regression gates and a registry update request (registry not edited); wire input `{a,b,mode}` with shared `prepare` helper; masking inside core with `sensitiveSpans` and named leak tests in both packages; Needs counsel limited to open-document findings-delta rows, diff-only rows disabled with tooltip, Phase 08 backlog stub; fixture scripts added as additive touchpoints; explicit e2e assertions and `{result, ms}` timing wrapper; coarse fallback plus test, A2 discharged; AC16 relabeled Fully-Automated, Known-Gap row plus stub for live narrative quality.
- Validate Contract section left untouched for the re-validation pass.
- Next: re-validate from V1.
