---
name: backlog:phase08-version-drift-questions
description: "Backlog for Phase 08: create 'Version drift' counsel questions from diff-only Compare rows (renames, leftovers, section/definition/fee/requirement changes) and enable Needs counsel on them"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: subdoc-qa-mvp
---

# Phase 08: Version drift counsel questions from diff-only rows

- **Priority:** P1 for Phase 08 (counsel sheet).
- **Problem:** in Compare (Phase 07), "Needs counsel" works only on findings-delta rows that are findings of the open document (via `useReview().needsCounsel(findingId)`). Diff-only rows (renames, Possible leftover, added / removed / changed sections, definitions, fees, requirements) show the control disabled with the tooltip "Available after counsel sheet (Phase 08)".
- **Ask:** Phase 08 adds a "Version drift" question type built from a diff-only row (kind, title, masked excerpt, both document labels) and enables the Compare control on those rows behind the same call surface. No raw excerpt may leave the browser.
- **Code pointers:** `apps/web/src/features/compare/CompareScreen.tsx` (`cmp-counsel`, `COUNSEL_LATER`), `apps/web/src/features/compare/model.ts` (`CmpItem.findingId`).
- **Source:** Phase 07 plan, Public Contracts "Needs counsel (S5)"; validate-contract residual (gap-resolution C).
