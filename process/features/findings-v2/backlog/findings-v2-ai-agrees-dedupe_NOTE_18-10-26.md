---
name: note:findings-v2-ai-agrees-dedupe
description: "Backlog: D11 'AI agrees' dedupe (Findings v2 Phase C) dropped because core dedupe already removes AI twins; revival needs an engine decision"
date: 18-10-26
metadata:
  type: note
  feature: findings-v2
  phase: backlog
---

# Findings v2: "AI agrees" dedupe (former Phase C)

**Status:** BACKLOG. Needs a design decision plus an engine decision.

## Why it was dropped (P-16, 18-10-26)

- Core dedupe already removes every AI finding whose anchor overlaps any rule anchor in the same block, for any issue class: `packages/core/src/llm/dedupe.ts` (`rangesOverlap`, `dropRuleDuplicates`), wired in `candidates.ts:9,99` (rule sentences are never sent as AI candidates) and `verify-quote.ts:14,204,320`. Commit a2a7047 (cherry-pick of fd144b1), live since 8a82ead2 and in d9aaddd9. `e2e/ai-no-duplicates.spec.ts` proves no AI row overlaps a rule row.
- `v2/dedupe.ts` (same block + overlapping offsets + same class) is a strict subset of that rule, so it matches nothing in the live or precomputed pipeline. The D11 "AI agrees" cross-check signal is therefore never shown: the AI twin is dropped rather than merged.

## Current state

- `apps/web/src/features/review/v2/dedupe.ts` and `findings-v2-dedupe.test.ts` stay committed and unmounted as a defensive pure module (documented as unused).

## Revival steps

1. Change core dedupe to keep AI twins as twins (attach to the rule finding) instead of dropping them. This touches the engine and the AI result contract; needs design + engine sign-off.
2. Mount `dedupeFindings` and `triageWithTwins` in `use-review-view.ts` (about 3 lines, between `mergeFindings` and `buildRows`), show the violet "AI agrees" tag and the twin provenance in Details, add a view test and an e2e.
3. Re-confirm the NOTES §7 Q2 tie rule (rule finding's id and severity win; design confirmed 18-10-26).
