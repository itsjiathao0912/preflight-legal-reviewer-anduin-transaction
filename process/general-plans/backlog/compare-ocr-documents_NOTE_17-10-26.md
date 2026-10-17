---
name: backlog:compare-ocr-documents
description: "Backlog: Compare versions cannot diff scanned / OCR documents (OCR runs on the main thread in Phase 06); Phase 07 deviation, new plan required"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: subdoc-qa-mvp
---

# Compare for scanned / OCR documents (Phase 07 residual)

- **Priority:** P2 (known-gap; AC19 is met for HTML, PDF text layer and DOCX).
- **Problem:** the Compare picker lists HTML samples and stored HTML / PDF / DOCX uploads only. Scan sets (sample #9) and image uploads are not offered, and a PDF with no text layer returns "Could not read this document" (`scanned_document`).
- **Root cause:** `EngineApi.diffDocuments` re-reads both documents with the worker `prepare` helper. OCR runs on the main thread (Phase 06 ocr-queue), so the worker has no OCR lines for a scan unless they are passed in.
- **Fix options:** (1) pass the already OCR'd lines of an open scan as an `{kind:'ocr'}` side input (reuse the analyze OCR path); (2) cache OCR lines per sourceHash in IndexedDB and let Compare read them. Either needs a plan + validate (privacy: OCR text stays in the browser).
- **Owner:** a later phase (NEW PLAN REQUIRED). Source: Phase 07 plan, Public Contracts "Format scope (N2)"; recorded in the Phase 07 REPORT 07b section.
