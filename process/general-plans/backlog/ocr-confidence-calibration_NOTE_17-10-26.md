---
name: backlog:ocr-confidence-calibration
description: "Backlog R2 (Phase 09): real OCR low-confidence flags are not calibrated; outline confidenceNote composition is only gated synthetically"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: subdoc-qa-mvp
---

# R2: Real OCR confidence calibration

- **Priority:** P2 (named residual of AC63; related to the carried AC4/AC23 live OCR confidence gap).
- **Problem:** `buildOutlineDraft` composes `confidenceNote` from `ocrLowConfidencePages` and `notice`, gated with synthetic inputs (A4). Whether the real OCR low-confidence flags are right (neither too noisy nor too quiet) is unproven.
- **Fix options:** compare flagged pages against the agent-transcribed ground truth for sample #9 and tune the threshold; a labelled set of 22 pages gives CER per page.
- **Owner:** Phase 10 live-model sweep or a later OCR quality pass.
- **Source:** Phase 09 plan Exit Gate R2; Phase 09 REPORT closeout.
