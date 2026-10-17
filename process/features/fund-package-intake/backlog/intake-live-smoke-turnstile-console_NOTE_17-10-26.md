---
name: backlog:intake-live-smoke-turnstile-console
description: "`smoke:live-package` exits 1 on Turnstile iframe console errors (third-party), although all 8 Intake checks pass."
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: fund-package-intake
---

# intake-live-smoke-turnstile-console

**Status:** open. Source: Fund Package Intake program closeout (`process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_REPORT_17-10-26.md`).

## Problem

`smoke:live-package` exits 1 on Turnstile iframe console errors (third-party), although all 8 Intake checks pass.

## Why

Six console errors came from `https://challenges.cloudflare.com` (its own connect-src refusing `data:,`). Orchestrator ruling: excluded. The script has no ignore list, by design.

## To do

Decide a first-party-only console rule in `scripts/src/live/smoke-package.ts` (filter by origin) with a unit test; keep strict classification for first-party errors.
