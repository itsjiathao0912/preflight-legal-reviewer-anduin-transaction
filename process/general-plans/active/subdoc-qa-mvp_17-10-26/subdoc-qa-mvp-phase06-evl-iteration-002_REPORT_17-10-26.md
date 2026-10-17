---
name: subdoc-qa-mvp-phase06-evl-iteration-002
description: EVL iteration 002 for phase06 - scoped confirmation after review fixes F1/F2/F3/F5/F9/F11, F1 repack and N5
date: 2026-10-17
metadata:
  type: iteration-report
  domain: tests
  iteration: 002
  phase: "06"
---

# phase06 - EVL iteration 002 (scoped confirmation after review fixes)

- Commits under test: 69bddd5 (F1/F2/F3/F5/F9/F11), 5c1c25d (F1 repack), 73599b5 (N5 entry names + repack self-check).
- Scope: Phase 06 gates only, scoped to the fixed surfaces. Core `docx-zip-bomb` 31, `docx` 42, `security` 59, `ingest-all-formats` 10, `golden-09-ocr-footnote2` 13; web unit `ocr-ai-consent`, `ocr-supersede`, `import-graph`, `source-guard`; web e2e `ocr-unavailable`, `ocr-render-path`, `ocr-position-confidence`, `scan-set-smoke`, `privacy-notice`, `upload-limits`; worker `ocr-never-sends-pdf` plus full worker; scripts `ocr-live-guard`; typecheck and lint clean.
- Reviews: first APPROVE_WITH_FIXES (F1, F2), confirmation REJECT (ZIP64 sentinel bypass A, CD-gap bypass B), re-confirmation PARTIAL (N5 name-length overflow), final APPROVE (F1 and N5 independently re-confirmed at 73599b5).
- Note: full core runs under heavy machine load (concurrent agent) showed timing-only timeouts (`size-cap`, `diff-determinism`) that passed in isolation. Recorded as a test-infra note.
- Result: HALTED_SUCCESS.
