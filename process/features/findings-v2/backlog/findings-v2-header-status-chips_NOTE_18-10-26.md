---
name: note:findings-v2-header-status-chips
description: "Backlog: fold the stacked 'No saved AI review' and 'Memory not applied' banners into compact header status chips (mockup D10)"
date: 18-10-26
metadata:
  type: note
  feature: findings-v2
  phase: backlog
---

# Findings v2: header status chips instead of stacked banners

**Status:** deferred (scope decision, 18-10-26). Not implemented.

## Problem

On the Findings screen, the "No saved AI review for this sample." banner (`ai-not-precomputed`, `AiBanner.tsx`) and the "Memory not applied." banner (`memory-not-applied`, `Banners.tsx`) stack as two full-width banners. Together they take about 110 px at 1440 and about 130 px at 1024, which pushes the reading area and the findings panel down (see `completed/findings-v2_18-10-26/design-probe/live-1024.png`).

## Design intent (mockup D10)

Fold them into compact header status chips (Coverage, Memory, Checks) next to the page title. Each chip opens a popover that explains the state and offers the fix (Run AI on this sample, pick a law firm, Retry memory).

## Why deferred

It changes shared banner surfaces beyond the Findings v2 polish pass. The banners are also used by render-first, intake and AI flows, and many specs assert their test ids and text.

## Touches

- `apps/web/src/features/ai/AiBanner.tsx` (`ai-banner`, `ai-not-precomputed`, `ai-run-sample`, `ai-rules-notice`)
- `apps/web/src/features/review/components/Banners.tsx` (`ai-off-banner`, `no-text-banner`, `memory-not-applied`, `memory-unavailable`)
- `apps/web/src/features/review/FindingsScreen.tsx` header (`.pagehead`)
- e2e specs asserting `ai-not-precomputed` / `ai-run-sample` / `memory-not-applied` (grep, 18-10-26): `ai-banners`, `ai-no-duplicates`, `ai-resume`, `auto-downgrade`, `intake-firm-tagging`, `previously-handled-section`, `provenance`, `sample-zero-calls`, `upload-firm-tagging`, `variance-ai-never-gates`
- e2e specs asserting the other banner ids or texts: `memory-ui-decisions`, `ocr-unavailable`, `privacy-notice`, `restore-and-no-text`, `status-stages`, `turnstile-no-block`
- render-first gates (banner must not delay findings): `variance-render-first`, `turnstile-no-block`

## Done when

The chips replace the stacked banners on Findings at 1440 and 1024, every fix stays reachable by keyboard from the chip popover, the specs above are updated to the chip/popover test ids, and render-first timing is unchanged.
