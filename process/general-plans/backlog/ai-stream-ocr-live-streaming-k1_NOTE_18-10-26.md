---
name: backlog:ai-stream-ocr-live-streaming-k1
description: "K1: live OCR streaming through the Worker SSE path is stub-only; first-byte silence of a vision model is unprobed"
date: 18-10-26
metadata:
  node_type: memory
  type: reference
  feature: none
---

# K1: live OCR streaming unproven

**Status:** open. Source: ai-review-stream-dedup (completed/ai-review-stream-dedup_18-10-26).

OCR sends stream:true but keeps a single 240 s timer (no idle timer). Only the stub proves it. To do: with explicit approval for a free vision model call, run one live OCR page and record first-byte time and SSE shape; then decide whether OCR can use the idle timer.
