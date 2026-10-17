---
name: backlog:package-no-llm-live-proof
description: "AC-I7 zero-AI proof is vacuous in the preview build (no API); only the store test asserts the AI lane stays off."
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: fund-package-intake
---

# package-no-llm-live-proof

**Status:** open. Source: Fund Package Intake program closeout (`process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_REPORT_17-10-26.md`).

## Problem

AC-I7 zero-AI proof is vacuous in the preview build (no API); only the store test asserts the AI lane stays off.

## Why

Live package runs made 0 AI/OCR calls in the smoke (31 requests, 0 AI/OCR), which supports but does not close this.

## To do

Add a stack-memory (or live) assertion that a package open with AI off sends no `/api/ai` or `/api/ocr` request.
