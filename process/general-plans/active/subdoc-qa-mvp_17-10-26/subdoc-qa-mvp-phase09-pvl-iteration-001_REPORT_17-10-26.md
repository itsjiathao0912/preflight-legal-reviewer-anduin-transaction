---
name: subdoc-qa-mvp-phase09-pvl-iteration-001
description: Inner PVL cycle 1 report for phase 09 (form logic outline export)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 1
  phase: "09"
---

# Phase 09 — inner PVL iteration 001

- First-pass verdict: CONDITIONAL (0 FAIL, 6 CONCERN, 6 gaps).
- Gaps: G1 `counts` not pinned to StructureView totals; G2 name/filename masking and ALLOWED value names undefined; G3 `e2e-hook.ts` (Phase 05-owned seam) missing from touchpoints/registry request; G4 Export button mount inside the `view ?` conditional hides the disabled no-structure state, test ids unspecified; G5 outline draft type and field sources undefined; G6 test gaps (synthetic all-enum case, non-vacuity, `downloadBlob` unit test).
- Fixes applied (SUPPLEMENT_APPLIED, all 6): (1) count definitions (`sections.length` incl. parts, `references.length` incl. external, branches/terms counts, `investors.types.length`), A4 equality asserts, C1 compares with Node-derived StructureView totals, preview label "sections incl. parts"; (2) core `outline/` exports `OutlineSchema`, `outlineFilename`, `maskOutlineName`, ALLOWED gains exactly those names, ids never masked; (3) `apps/web/src/e2e-hook.ts` added (append-only, force-invalid-outline hook inside `if (IS_E2E)`) plus extended production-absence gate; (4) button mounted outside `view ?`, ids `outline-export`, `outline-export-disabled-reason`, `outline-export-error`, `outline-preview`, no-structure e2e via `failStage('structure')`; (5) `OutlineDraft = Omit<Outline,'document'> & { document: Omit<Outline['document'],'name'> }` with sources, projection beside `result.structure`, re-read `engine.worker.ts` at EXECUTE start; (6) synthetic all-enum A4 case with sensitive seeds, non-vacuity asserts, new `download-blob` unit test and gate.
- Residual backlog stubs to write at UPDATE PROCESS: R1 investor-path correctness, R2 OCR confidenceNote, R3 downloadBlob revoke in real browsers. `download.ts` is create-or-reuse with Phase 08 (same signature).
- Validate Contract section left untouched for the re-validation pass.
- Next: re-validate from V1.
