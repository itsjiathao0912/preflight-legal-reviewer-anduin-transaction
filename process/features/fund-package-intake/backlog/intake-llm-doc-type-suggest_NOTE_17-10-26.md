---
name: backlog:intake-llm-doc-type-suggest
description: "AC-I7 ships the suggester seam only; no LLM task, prompt or registry entry exists. Add a free-model doc-type suggestion that never overrides a confirmed value."
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: fund-package-intake
---

# intake-llm-doc-type-suggest

**Status:** open. Source: Fund Package Intake program closeout (`process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_REPORT_17-10-26.md`).

## Problem

AC-I7 ships the suggester seam only; no LLM task, prompt or registry entry exists. Add a free-model doc-type suggestion that never overrides a confirmed value.

## Why

Seam only (`DocTypeSuggester`, `mergeSuggestion`) is proven by an injected fake suggester. A real task needs the LLM framework in `packages/core/src/llm`, a recording, and a Worker allow-list entry (needs user approval for any Worker change).

## To do

Add a `doc_type_suggest` LLM task with recordings; label suggestions; keep rules-first and no-LLM mode; prove precedence with the existing seam tests plus a recorded run.
