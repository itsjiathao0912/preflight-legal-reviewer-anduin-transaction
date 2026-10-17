---
name: backlog:intake-dialog-focus-return
description: "Escape on the Upload modal returns focus to body instead of the trigger."
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: fund-package-intake
---

# intake-dialog-focus-return

**Status:** open. Source: Fund Package Intake program closeout (`process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_REPORT_17-10-26.md`).

## Problem

Escape on the Upload modal returns focus to body instead of the trigger.

## Why

Pre-existing: the `DocSwitcher` popover is already unmounted when the dialog closes. Phase 4 asserts keyboard recovery (Tab reaches `doc-switcher`).

## To do

Restore focus to the invoking control on close; tighten the a11y spec to assert focus return.
