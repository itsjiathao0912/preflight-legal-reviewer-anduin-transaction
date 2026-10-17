---
name: subdoc-qa-mvp-phase07-evl-iteration-001
description: EVL iteration 001 for phase07 - independent serial confirmation at HEAD dca6a45 (07a f3f533f, 07b 99c9cee, 07c dca6a45)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: tests
  iteration: 001
  phase: "07"
---

# phase07 - EVL iteration 001 (independent serial confirmation at dca6a45)

- Commits under test: f3f533f (07a core diff), 99c9cee (07b Compare + worker seam), dca6a45 (07c AI drift narrative). Run serially, one token per call, by an independent tester.
- Gates: core 501, worker 521, web unit 76, web e2e 114 (+1 opt-in skip), scripts 63; `fixtures:check`, typecheck, lint, `guard:cf`, `secrets:scan`, `seed:check`, `slice:check` all OK.
- Pinned #5 to #6 goldens and perf (Node 187 ms warm, browser 343 ms) match the Phase 07 REPORT.
- Live: drift-narrative 1 of 3 approved free calls, $0.
- Serial e2e removes the shared-port and concurrent-edit flakes seen during EXECUTE (`provenance`, `layout-vs-mockup`).
- Gaps carried (not failures): AC15 AI-narrative quality is Known-Gap (backlog `drift-narrative-live-quality`), Compare excludes OCR documents (backlog `compare-ocr-documents`), diff-only rows cannot raise counsel questions until Phase 08 (backlog `phase08-version-drift-questions`).
- Result: HALTED_SUCCESS.
