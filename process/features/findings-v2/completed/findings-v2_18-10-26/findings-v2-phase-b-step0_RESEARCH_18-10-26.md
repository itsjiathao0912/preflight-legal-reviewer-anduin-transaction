---
name: research:findings-v2-phase-b-step0
description: "Findings v2 Phase B Step 0 re-sync after Variance close (dcb387d): anchors, gaps, repair list, Phase C finding, baselines, deploy facts"
date: 18-10-26
metadata:
  node_type: memory
  type: research
  feature: findings-v2
  phase: B-step0
---

# Findings v2 Phase B Step 0 re-sync (18-10-26)

Source: vc-research-agent (sonnet), read-only; placed by the orchestrator.

## 1. Drift since planning (a31dff0)

- No Phase B target file changed: `FindingsScreen.tsx`, `DocPane.tsx`, `model.ts`, `use-review-view.ts`, `base.css`, `test/support/mockupCss.ts`, `layout-vs-mockup.spec.ts`, `e2e/fixtures/app.ts`.
- `state/review.ts` gained `memoryNotSavedNote()` (exported, line 77) and private `withNote()` appended to Accept/Dismiss store toasts (f3a2a18). No signature v2 calls changed.
- New e2e since planning: a11y-keyboard (variance case), perf-budget (+63), variance-demo-214-to-7, variance-demo-gate-walk, variance-package-samples, ai-no-duplicates.

## 2. Corrected anchors

See the plan's Phase B "Corrected anchors" list (FindingsScreen `.work` 120, `aside.fp` 122-238, J/K 70/86-87; DocPane effect 217-227, `.docbar` 231-234, JumpMenu 121/233, `.docscroll` 236-237; base.css `.work` 556-561; layout-vs-mockup 25-27, 91, 95, 147, 22-23/88-89).

## 3. Plan error: zoom seed seam

`e2e/fixtures/app.ts` has no `addInitScript`. The seam is `gotoApp()` (about line 45, used by 101 of 111 specs). 3 specs call `page.goto` directly; 10 stack specs don't call `gotoApp`.

## 4. action-* recount (excluding v2/zoom)

| Id | e2e | src (old rows) |
|---|---|---|
| action-accept | 7 (a11y-keyboard:162, triage-actions:12,17, gate-pill:25, upload-firm-tagging:67, app-shell:80, fixtures/counsel.ts:136) | 1 (FindingRow.tsx:215) |
| action-counsel | 5 | 3 |
| action-dismiss | ~21 | 3 |
| action-restore | 1 | 2 |

finding-body-scoped action clicks: variance-gate-two-states:30, variance-owner-override:46,48, variance-demo-gate-walk:92, fixtures/variance-owners.ts:41.

## 5. v2 gaps

| # | Gap | Evidence |
|---|---|---|
| G1 | `finding-found` / `finding-expected` ids missing in ExpandedBlock | slice.spec:51, finding-highlight.spec:26 |
| G2 | outcome toast drops the memory note (f3a2a18) | use-finding-actions.ts:62 |
| G3 | `.sub2` meta line absent | locator-chip.spec:17 |
| G4 | no "Re-confirm dismissal" bar label | previously-handled-section.spec:28, counsel-gate.spec:116 |
| G5 | 5 reason radios vs asserted 4 | dismiss-requires-reason ~21 |
| G6 | finding-body is a sibling of the row button | safe today |
| G7 | focus after dismiss / Esc return | dismiss-requires-reason ~33, ~46 |
| G8 | a11y-keyboard tabs from row to action-accept | a11y-keyboard:161-165 |

Unverified: whether the `FindingsPanelV2` root carries `data-memory-state` on `findings-column`.

## 6. Variance surfaces covered by v2

Kind segment, NoBaselineLine, CosmeticGroups, PreviouslyHandledRow, FilterMenu, severity chips, owner chip, ChangeExpanded (ChangeDiff, ImpactLines, OwnerSelect + reason), change-type chip, row data attributes, Ask owner / Mark as expected, finding-memory-tag, ai-tag, LocatorChip, Provenance. Baseline control, gate pill, JumpMenu, Earlier-funds popover and `.lbl` are outside the aside.

## 7. Phase C finding

Core dedupe (`packages/core/src/llm/dedupe.ts`, a2a7047, live) drops every AI finding overlapping any rule anchor in the same block, any class; `v2/dedupe.ts` matches nothing live. Decision P-16: Phase C dropped; backlog NOTE `process/features/findings-v2/backlog/findings-v2-ai-agrees-dedupe_NOTE_18-10-26.md`.

## 8. Baselines and deploy facts

- web unit 518, preview e2e 242 (+1 skip), stack-memory 12, core 3190 (+3 skip), worker 608, scripts 183.
- Port 4317 free; teardown race between serial e2e calls (free the port before each call); `intake-demo-packages` is load-sensitive (run alone).
- Live d9aaddd9 (schema 6). Only valid rollback target: d9aaddd9 itself (8a82ead2 and older refuse memory writes on schema 6). Phase B is assets-only.
