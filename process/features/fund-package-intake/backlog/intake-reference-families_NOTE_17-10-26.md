---
name: backlog:intake-reference-families
description: "Reference families not extracted: US Feeder Subscription Agreement, Eligible Transferee Certificate, Tax Form Selection Guide. Used-term recall misses."
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: fund-package-intake
---

# intake-reference-families

**Status:** open. Source: Fund Package Intake program closeout (`process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_REPORT_17-10-26.md`).

## Problem

Reference families not extracted: US Feeder Subscription Agreement, Eligible Transferee Certificate, Tax Form Selection Guide. Used-term recall misses.

## Why

LB2 gets 2 of 3 GP requests (US Feeder Subscription Agreement missing); NG3 D7 Eligible Transferee Certificate. Unlisted used terms: Excused Investor, Key Person Event, Plan Assets, Significant Participation, Hurdle Amount (fewer than two determiner-led uses). Proper nouns (Delaware, United Kingdom, Internal Revenue Service) still show as unverified.

## To do

Add the families to the reference synonym data, relax the used-term rule for single defined-looking uses with a precision check, filter common proper nouns; update goldens.
