---
name: note:findings-v2-step3-flag-passage
description: "Backlog stub: Findings v2 step 3 (Flag this passage, Suggest wording) per decision D-8, plus residual test stubs for Findings v2 step 1; needs its own SPEC and PLAN"
date: 18-10-26
metadata:
  node_type: memory
  type: note
  feature: findings-v2
  phase: backlog
---

# Findings v2 step 3 - Flag this passage and Suggest wording (backlog stub)

**Status:** BACKLOG. Needs its own SPEC then PLAN. Starts only after Findings v2 Phase B ships (`process/features/findings-v2/completed/findings-v2_18-10-26/findings-v2_PLAN_18-10-26.md`). Step 1 builds nothing for it (decision D-8).

## What the design asks for (NOTES D13)

A selection menu in the reading view with two actions:
- **Flag this passage:** the analyst creates a manual finding on the selected text.
- **Suggest wording:** the analyst proposes replacement wording, shown in the counsel question and carried into the DOCX export.
Rich-text editing was rejected (analysts never edit counsel's document).

## Outline of the work (from D-8 and RESEARCH Q8)

1. **Core contract.** `detector_kind: 'manual'` is not representable today: the finding schema requires `(detector_kind === 'ai') !== (model !== undefined)` and limits the kind to `'rule' | 'ai'`. Adding `'manual'` changes `packages/core/src/findings/schema.ts` and regenerates `packages/core/test/__snapshots__/contracts.json-schema.snap` (a seam file; coordinate with whoever owns the contracts at that time). Severity caps by `detector_kind` (`maxSeverityFor`) need a rule for manual findings.
2. **Selection anchor.** Reuse `{blockId, offsetStart, offsetEnd}`. `DocPane` has no selection handling today, so this needs a selection listener, a floating menu and handling of masked spans (the selection must not expose masked values) in the Variance-locked `DocPane.tsx`.
3. **Persistence.** A new Dexie table (`apps/web/src/storage/db.ts` version bump; the current schema is at `version(2)`). Manual findings survive reloads and re-merge with engine findings by anchor.
4. **No gating.** A manual finding never blocks the gate (like AI findings, which never gate). Decide how it counts in progress, chips and the counsel sheet.
5. **Proposed fix field.** A new optional field carried through the counsel question wording (`wordingFor` in `features/counsel/sheet-model.ts`, the core `buildCounselSheet`/`SheetFinding` shapes) and the DOCX export (`features/counsel/exportDocx.ts`, `export-flow.ts`). Both sit in core or Variance-touched areas and need additive fields plus a snapshot update.
6. **Memory.** Decide whether a manual finding writes a memory decision (NOTES Q1 is still open for Ask counsel; keep the same answer).
7. **Dedupe.** Manual findings are never merged with rule or AI findings (Phase C dedupe only merges one rule with one AI).

## Open questions for the SPEC

- Can a manual finding be dismissed with the same reasons as a rule finding, or does it only have Ask counsel and Close issue?
- Does "Suggest wording" require a manual finding, or can it attach to an existing finding?
- Maximum length of the proposed wording and the masking rule (apply `mask` before storing, like AI drafts).
- Placement in the v2 groups (To review / Sent to counsel / Closed) and in progress counts.

## Dependencies and constraints

- Findings v2 Phase B shipped (the accordion, bar and zoom exist).
- No live LLM calls; deterministic first.
- Core change means the frozen contract rules in `process/context/engine/all-engine.md` apply (additive only).

## Residual test stubs (Findings v2 step 1: Known-Gap, never a terminal PASS)

These are recorded here because the Findings v2 plan classifies them Known-Gap; the gates that depend on them stay CONDITIONAL.

1. **Manual keyboard and screen-reader pass** over the action bar, Close issue modal, panel resizer and zoom controls (tab order, focus return after the modal closes, announcements for the outcome toast, `aria-valuenow` on the resizer). Test to build: an extended `a11y-keyboard`-style Playwright spec in the preview project plus one recorded human pass; related Intake backlog stub: manual keyboard pass in `process/features/fund-package-intake/backlog/`.
2. **Human look at fit-width and the calm palette** at 1900px and wider and at 75 / 150 percent zoom. Phase B captures Agent-Probe screenshots; a human confirmation is still needed. Test to build: a design-probe spec step with fixed screenshots per zoom level.
