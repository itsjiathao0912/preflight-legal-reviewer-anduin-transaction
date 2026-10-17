---
name: backlog:intake-ng3-two-to-digitize-detection
description: "Role auto-detection marks two subscription agreements as To digitize in the NG3 package; the NG2 2024 one is arguably a baseline."
date: 18-10-26
metadata:
  node_type: memory
  type: reference
  feature: fund-package-intake
---

# intake-ng3-two-to-digitize-detection

**Status:** open. Source: live test 18-10-26 of `samples/packages/01-northgate-infrastructure-iii/docs` (fix commit 8db9245 made the resulting block visible, not the cause).

## Problem

`01-NG3-Subscription-Agreement.docx` and `04-NG2-Subscription-Agreement-2024.docx` both get role To digitize. That triggers `multiple_to_digitize` and disables "Run checks" until the analyst changes one role by hand.

## Why

Role detection in `packages/core/src/package` treats every high-confidence subscription agreement as To digitize. A file whose name or text shows an earlier fund (NG2) or an earlier year is more likely a Baseline.

## To do

Add a tie-break when several subscription agreements are detected: prefer the one matching the package fund name and treat the other as Baseline, with a stated reason. Add a golden test on the NG3 package and keep the analyst-confirm path for unsure cases.
