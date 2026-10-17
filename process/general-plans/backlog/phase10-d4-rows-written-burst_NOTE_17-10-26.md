---
name: backlog:phase10-d4-rows-written-burst
description: "Phase 10 residual R2: D4 rows_written burst not run live (no real-browser session cookie); caps unchanged; re-run conformance burst after an operator session"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: subdoc-qa-mvp
---

# Phase 10 D4: rows_written burst not measured live

**Status:** open (gate CONDITIONAL). The caps are unchanged: `SESSION_CAPS.globalPerDay` 300 and `MEMORY_WRITE_CAPS.rowBudgetPerDay` 30000.

## Why

The D4 burst must reuse a signed workspace cookie from a real-browser session (E18). Scripts must not mint one. Automated Chromium got no Turnstile token, so no session and no cookie exist (see `phase10-live-ai-sweep-operator_NOTE_17-10-26.md`).

## Baseline measured

The accountTag-only GraphQL read of `aduin-transaction-db` for 2026-10-17 shows rowsWritten 238 and rowsRead 413. That covers migrations 0001-0005, the demo seed (80 rows) and probes. No burst was included.

## To do

1. After an operator obtains a session in a real browser, export the `__Host-aduin_v` cookie to a mode-600 file outside the repo. Do not print it.
2. Run `pnpm --filter @aduin/scripts conformance:free-plan --section burst --cookie-file <path> --d1-id 5f0d76d8-ad88-4a0b-80eb-cff716c10eca` with the CLOUDFLARE_* env loaded, then delete the file.
3. Project rows per day. If the projection is over 60k/day, lower the caps to 150 and 20000, run the worker tests, do a fresh plain build and redeploy.
