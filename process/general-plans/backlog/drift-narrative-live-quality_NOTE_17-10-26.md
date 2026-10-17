---
name: note:drift-narrative-live-quality
description: "Known-Gap test-building stub — live-model quality of the Phase 07 drift narrative (AC15 H part stays CONDITIONAL)"
date: 17-10-26
feature: subdoc-qa-mvp
---

# Drift narrative — live-model quality (Known-Gap stub)

Source: Phase 07 (07c), plan `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-07-version-diff_PLAN_17-10-26.md`, gate row "live narrative quality" (Known-Gap, residual D).

## What is proven today

- `pnpm --filter @aduin/core test drift-narrative` (Hybrid, recorded): the narrative keeps only lines that answer a sent rename and name both its terms; inputs are masked and clipped (E18); invented renames and unknown ids are dropped.
- One live free recording (#5 -> #6, `nvidia/nemotron-3-super-120b-a12b:free`, cost 0): 5 of 5 lines kept, plausible wording.

## What is NOT proven (residual)

- Live quality across other pairs, models or days (free-tier drift, refusals, truncation).
- Whether the "what to re-check" advice is correct, not just on-topic.
- Latency and token behaviour with 8 renames.

## Test to write (when budget allows)

1. A small rubric set (3 pairs incl. #3 vs #4 and a seeded pair) with expected rename sets.
2. A guarded live sweep (`record:ai`, free model only, cap <= 3 per run) scoring kept/sent ratio, banned facts (section numbers, fees) absent, length bound.
3. Promote to Hybrid only if the sweep is reproducible; any prompt change bumps `drift-narrative@1`.

The AC15 H-part gate stays CONDITIONAL until then.
