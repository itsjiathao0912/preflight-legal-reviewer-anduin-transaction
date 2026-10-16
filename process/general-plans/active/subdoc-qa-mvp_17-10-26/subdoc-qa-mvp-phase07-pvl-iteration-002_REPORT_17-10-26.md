---
name: subdoc-qa-mvp-phase07-pvl-iteration-002
description: Inner PVL cycle 2 report for phase 07 (version diff and sibling comparison)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 2
  phase: "07"
---

# Phase 07 — inner PVL iteration 002

- Cycle 1 re-validate verdict: CONDITIONAL (0 FAIL, 2 CONCERN gaps: N1, N2). Gap trend 9 to 2.
- N1 (Reveal vs lossy masking): chose option (a). DiffResult carries span-aware clipped raw excerpts plus `sensitiveSpans`; main thread masks with allow-listed core `mask`, Reveal toggles via `revealed`; raw text never leaves the browser. Leak gates made non-vacuous with a seeded synthetic account number in a differing clause of the sibling fixtures; core `diff-pairs` and web e2e `diff-pairs` assert accordingly.
- N2 (input failure + OCR scope): `diffDocuments` returns `{result, ms}` or `{error: {side, stage, code}}` with no document text; Compare shows "Could not read this document"; new core test `diff-input-failure` and e2e assertion 8b. Picker limited to formats the in-worker prepare handles; scanned/OCR out of scope, deviation plus backlog stub `compare-ocr-documents_NOTE_17-10-26.md` (written at EXECUTE/UPDATE).
- E15/E16 retained in the checklist (E2, G4).
- Fixes applied (SUPPLEMENT_APPLIED, 2 gaps). Validate Contract untouched.
- Next: re-validate from V1.
