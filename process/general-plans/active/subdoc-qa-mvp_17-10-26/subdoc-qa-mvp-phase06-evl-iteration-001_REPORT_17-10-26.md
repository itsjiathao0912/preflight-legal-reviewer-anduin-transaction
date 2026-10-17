---
name: subdoc-qa-mvp-phase06-evl-iteration-001
description: EVL iteration 001 for phase06 - full confirmation run at b9767ac (06a-06f)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: tests
  iteration: 001
  phase: "06"
---

# phase06 - EVL iteration 001 (full confirmation run at b9767ac)

- Commits under test: 027a450 (06a/06b), 2d198f4 (06c), 6473186 (06d), b9767ac (06e/06f).
- Gates: full EVL 37/37 green (core, worker, scripts, web unit, web e2e incl. `ingest-all-formats`, `ocr-position-confidence`, `ocr-unavailable`, `scan-set-smoke`, `upload-limits`, `sample-picker-smoke`; typecheck, lint, `guard:cf`, `secrets:scan`, `fixtures:check`; evidence validator on `harness/phase-06` 0 failures).
- Result: HALTED_SUCCESS for the gate set. The independent security review that followed found F1 (zip-guard bypass) and F2 (OCR egress without consent); those were fixed in later commits and re-confirmed in iteration 002.
