---
name: backlog:intake-too-many-refusal-code
description: "`addEarlierDocument` cap reuses refusal code `role_not_allowed` instead of a dedicated code."
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: fund-package-intake
---

# intake-too-many-refusal-code

**Status:** open. Source: Fund Package Intake program closeout (`process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_REPORT_17-10-26.md`).

## Problem

`addEarlierDocument` cap reuses refusal code `role_not_allowed` instead of a dedicated code.

## Why

Review note: the cap refusal is mislabelled; behavior is correct.

## To do

Add a `too_many` refusal code to the contract and map it in the UI message and tests.
