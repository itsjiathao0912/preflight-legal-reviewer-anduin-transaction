---
name: backlog:package-gate-block-e2e-reach
description: "The package gate Blocked path (no sub agreement) is proven in unit tests only (G6)."
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: fund-package-intake
---

# package-gate-block-e2e-reach

**Status:** open. Source: Fund Package Intake program closeout (`process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_REPORT_17-10-26.md`).

## Problem

The package gate Blocked path (no sub agreement) is proven in unit tests only (G6).

## Why

`counsel-gate-line` and `findings-meta` count core reasons only, so no e2e can reach a package block today. One-document reload also has no e2e.

## To do

Find a legal UI path that reaches Blocked from a package (or surface package reasons in those two counters), then add an e2e for the block reason and one-document reload.
