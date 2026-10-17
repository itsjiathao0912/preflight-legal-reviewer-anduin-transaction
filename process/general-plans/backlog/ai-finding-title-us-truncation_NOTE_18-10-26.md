---
name: backlog:ai-finding-title-us-truncation
description: "UI: AI finding titles are cut at U.S. because the title sentence splitter treats the abbreviation as a sentence end"
date: 18-10-26
metadata:
  node_type: memory
  type: reference
  feature: none
---

# AI finding title truncated at U.S.

**Status:** open. Source: ai-review-stream-dedup (completed/ai-review-stream-dedup_18-10-26).

Seen live 18-10-26: title 'The checkbox provides only a U.S.' (cut). Fix the title derivation (sentence split) to skip common abbreviations (U.S., e.g., i.e., Inc., No.), add a unit test with the 'U.S.' case. Likely in apps/web or packages/core finding-title code; locate with grep for the splitter.
