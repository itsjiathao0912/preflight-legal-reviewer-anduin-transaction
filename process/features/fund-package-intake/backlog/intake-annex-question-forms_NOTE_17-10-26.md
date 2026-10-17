---
name: backlog:intake-annex-question-forms
description: "Structurer and conditional targets miss Schedule/Exhibit targets, per-Part question numbering and dash or next-line heading titles."
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: fund-package-intake
---

# intake-annex-question-forms

**Status:** open. Source: Fund Package Intake program closeout (`process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_REPORT_17-10-26.md`).

## Problem

Structurer and conditional targets miss Schedule/Exhibit targets, per-Part question numbering and dash or next-line heading titles.

## Why

Phase 1 (T14) added Section/Article headings and Annex/Question targets only. Measured misses: RR1 F1 not also produced as `investor_path_dead_end`; F3 `Section 8.4` coherence stays silent.

## To do

Extend `structure/headings.ts` and `structure/conditionals.ts` for Schedule and Exhibit targets, Part-scoped numbering and dash headings; add goldens; explain every changed corpus count.
