---
name: backlog:intake-code-splitting
description: "Main web bundle grew from 568 kB to 837 kB (+270 kB) with Intake."
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: fund-package-intake
---

# intake-code-splitting

**Status:** open. Source: Fund Package Intake program closeout (`process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_REPORT_17-10-26.md`).

## Problem

Main web bundle grew from 568 kB to 837 kB (+270 kB) with Intake.

## Why

Phase 4 D4 measured 837.67 kB, above the 60 kB note threshold. Render-first holds, perf budgets pass (hartwell 24 ms, ngi 52 ms).

## To do

Lazy-load the Package lens, DOCX export and heavy parsers with dynamic imports; re-measure; keep e2e green.
