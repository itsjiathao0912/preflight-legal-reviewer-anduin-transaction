---
name: plan:subdoc-qa-mvp-phase-09-logic-outline
description: "Sub-doc QA MVP — Phase 09 (P1): JSON form logic outline export (sections, branches, references, defined terms, investor-type paths)"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-09
---

# Phase 09 — Form Logic Outline Export (Tier 2, P1)

**Date**: 17-10-26
**Complexity**: SIMPLE-COMPLEX (one feature, three checklist groups)
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-09-logic-outline_REPORT_17-10-26.md

---

## Overview

Exports the document's logic as a JSON "form logic outline": sections, branches (conditionals), references with resolution status, defined terms, and investor-type paths. It is a reference outline only; the tool does not generate the form (SPEC out of scope). It is a pure projection of the existing masked `StructureView` (Phase 01 graph plus Phase 02 investor paths) with a versioned, zod-defined schema. Cut order: this phase is cut after the memory page (Phase 08b) when time is short. Context routers: `process/context/all-context.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`.

UI contract: only an Export button and a counts-only preview in the Structure tab header (Phase 03 screen); no new screen, so no new mockup. Use Phase 03 tokens.

## Chosen Approach (INNOVATE decision, locked)

- The engine worker projects the existing masked StructureView into an additive optional `EngineResult.outline` (an `OutlineDraft`, see Public Contracts; it has no `document.name`), eagerly, inside analyze. It is omitted when there is no structure; the Export button is then disabled with an explanation.
- The main thread completes the draft: it masks the name with `maskOutlineName`, validates with `OutlineSchema`, and downloads via the shared `apps/web/src/lib/download.ts` `downloadBlob(filename: string, data: string | Blob, mime: string): void` (revokes the object URL after a tick; Phase 08 reuses it, so its signature is a contract). Whoever lands first (Phase 08 or 09) creates `download.ts`; the other reuses it with the identical signature.
- Import-graph guard: the only guard edit is adding exactly three value NAMES to `ALLOWED` in `apps/web/test/import-graph.test.ts`: `OutlineSchema`, `outlineFilename`, `maskOutlineName` (all exported from the `@aduin/core` public seam; the main thread never imports core `src` paths). Fallback if the guard edit is refused: worker RPC `exportOutline(name)` returns the validated text, no web import of these names.
- `registry.ts` is NOT edited (no registry slot). The Export button mounts in the `StructureScreen.tsx` header OUTSIDE the `view ?` conditional so the disabled no-structure state renders (narrow Phase 02-owned edit).

## Phase Completion Rules

- CODE DONE = builder, schema, button, tests committed.
- VERIFIED = Exit Gate green, validate-contract written, regression: Phase 01/02 core suites. If cut, the umbrella marks `SKIPPED (P1 cut)` and AC63 DEFERRED with a backlog stub.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC63 [P1] | Analyst exports sections, branches, references, defined terms, investor-type paths as a JSON outline; reference only | `logic-outline-export-contents` (core: counts equal Node-derived StructureView totals for samples #1/#3/#5 per the count definitions, plus a synthetic all-enum StructureView case; disclaimer, byte-stability, masked citations); `download-blob` (web unit); `outline-schema-snapshot`; web e2e `logic-outline-export` (export, parse, validate, compare on-screen counts) | Fully-Automated | Investor paths are heuristic with no ground truth (P2-2), stated in the schema description |

## Entry Gate

- Phases 02 and 03 verified (`StructureView.investors` populated; structure tab present).
- Phase 07 landed (engine worker trio: types.ts / engine.worker.ts edits) before this phase's EXECUTE starts.

## Library pins (confirm via vc-docs-seeker in Phase 00)

zod 4.6 (schema + `z.toJSONSchema`), Vitest, Playwright.

## Touchpoints

Create:

```
packages/core/src/outline/{build.ts,schema.ts,version.ts,index.ts}
packages/core/test/unit/outline/{logic-outline-export-contents,outline-schema-snapshot}.test.ts
fixtures/outline/schema.v1.json
apps/web/src/lib/download.ts                        (shared; create only if Phase 08 has not already, else reuse unchanged)
apps/web/test/download-blob.test.ts                 (stubbed URL.createObjectURL/revokeObjectURL, fake timers)
apps/web/src/features/outline/{ExportOutlineButton.tsx,finalizeOutline.ts,OutlinePreview.tsx}
apps/web/e2e/logic-outline-export.spec.ts
```

Modify (additive only):

```
packages/core/src/index.ts                          (append exports)
apps/web/src/engine/types.ts                        (optional EngineResult.outline)
apps/web/src/engine/engine.worker.ts                (project OutlineDraft next to wherever result.structure is assigned; re-read at EXECUTE start, Phase 07 extracts `prepare`)
apps/web/src/features/structure/StructureScreen.tsx (header slot OUTSIDE the `view ?` conditional; Phase 02-owned narrow edit)
apps/web/test/import-graph.test.ts                  (ALLOWED += OutlineSchema, outlineFilename, maskOutlineName; only guard edit)
apps/web/src/e2e-hook.ts                            (narrow edit, Phase 05-owned seam: `HookState` field + installer entry for the IS_E2E force-invalid-outline hook, body inside `if (IS_E2E)`)
apps/web/test/no-e2e-hook-in-dist.test.ts            (existing gate, extended: new hook name absent from production)
```

## Public Contracts

- `OutlineSchema` v1 (document order, fixed key order, no `z.record`, no `generatedAt`, no full text):
  - `schema`: literal `"form-logic-outline/v1"`; `disclaimer`: literal `"Reference outline only; not a generated form."`
  - `document`: `{name (masked, ≤120), format, contentHash, pageCount?}`
  - `sections[]`: `{id, number, title, depth (0|1), restart, refsIn, refsOut}`
  - `references[]`: `{id, text, where, status (resolved|suspicious|unresolved), target?, expected? (nullable), external?: false}` plus external rows `{id, text, where, source, external: true}`
  - `branches[]`: `{id, kind (whitelist|role|skip|negative|jump), where, condition, targets: string[], targetFound, citation}`
  - `definedTerms[]`: `{term, definedAt, uses, status (ok|early|twice|none|unused|case), note?}`
  - `investorPaths[]`: `{type, label, sections[{number,title}], skipped[], questions[{section,text}], reachesCompletion, uncertain, gapCount}`
  - `confidenceNote?`; `counts`: `{sections, references, branches, definedTerms, investorPaths}` with definitions: `sections` = `sections.length` (= StructureView `totals.sections`, including parts); `references` = `references.length` (= `referenceCount`, including external); `branches` = the conditions count (`branches.length`); `definedTerms` = the terms count (`definedTerms.length`); `investorPaths` = `investors.types.length`. A4 asserts these equalities; the preview labels the first as "sections incl. parts".
  - Draft type: `OutlineDraft = Omit<Outline,'document'> & { document: Omit<Outline['document'],'name'> }`. The worker emits `EngineResult.outline?: OutlineDraft`; `finalizeOutline` adds the masked `name` to produce `Outline`. Sources: `contentHash` = docHash, `format` = `result.source ?? 'html'`, `pageCount` from the document, the worker passes `ocrLowConfidencePages` (page numbers from `ocr.pages[]` where `lowConfidence`) and `notice` to the builder, which composes `confidenceNote` itself (key omitted when neither is present; masked via `maskThenClip(…, 300)`), `branches[].targets` = the StructureView target string split on `", "` (lossless today; A4 asserts `targets.join(", ")` equals the source string).
  - Masking rules: `id` fields (section, reference, branch ids) are never masked. `document.name` goes through `maskOutlineName(name)`; the filename goes through `outlineFilename(name)`, which uses `maskText` internally plus the sanitizer rules below. Core barrel (`packages/core/src/index.ts`, append-only) exports ALL of: values `OutlineSchema`, `outlineFilename`, `maskOutlineName`, `buildOutlineDraft`, `OUTLINE_SCHEMA_ID`, `OUTLINE_DISCLAIMER`; types `Outline`, `OutlineDraft`. Builder signature: `buildOutlineDraft(view, opts: {docHash, source, pageCount?, ocrLowConfidencePages?, notice?}) → OutlineDraft`. The three-name rule applies ONLY to the main-thread `import-graph` ALLOWED set (`OutlineSchema`, `outlineFilename`, `maskOutlineName`); the worker imports `buildOutlineDraft` (types are erased) and the other names are not main-thread imports.
  - Dropped from the projection: quote, blockId, findingId, issue, option rows, `entity_extra_part`.
  - Free-text fields (`where`, `condition`, `text`, `note`, `citation`) pass through `maskThenClip(…, 300)`; sensitive values are masked.
- Filename: `outlineFilename(name)` = mask the name, strip extension, replace non `[A-Za-z0-9._-]` with `-`, collapse runs, trim leading/trailing `-` and `.`, cap 80, fallback `document` → `{base}.logic-outline.json`. Body is `JSON.stringify(validated, null, 2)`; byte-stable.
- `downloadBlob(filename: string, data: string | Blob, mime: string): void` in `apps/web/src/lib/download.ts` (shared contract; Phase 08 reuses; whoever lands first creates it, the second must not narrow it; Phase 08 needs Blob for DOCX; object URL revoked after a tick).
- Additive optional `EngineResult.outline` (an `OutlineDraft`; omitted when no structure). Export is client-side only; no server call; no AI.
- UI test ids (new): `outline-export` (button), `outline-export-disabled-reason` (explanation when no outline), `outline-export-error` (inline invalid error), `outline-preview` (counts-only block). Existing ids `structure-meta`, `structure-toggle-everything`, `structure-view` stay unchanged. The no-structure e2e case is driven by the existing `__aduinE2E.failStage('structure')`.
- Failure contract: safe-parse failure shows an inline error and no download; an IS_E2E-only hook in `apps/web/src/e2e-hook.ts` (`__aduinE2E.forceInvalidOutline(on)` plus an exported `e2eForceInvalidOutline()` reader that returns false outside IS_E2E; body inside `if (IS_E2E)`) forces an invalid outline for the e2e blocked-on-invalid test; the existing production-absence gate asserts the new hook name is absent from production output.

## Blast Radius

`packages/core/src/outline/**`, core tests, `fixtures/outline`, `apps/web/src/lib/download.ts`, `apps/web/src/features/outline/**`, `apps/web/src/engine/{types,engine.worker}.ts`, `StructureScreen.tsx` header, `apps/web/test/import-graph.test.ts`, `apps/web/test/download-blob.test.ts`, `apps/web/src/e2e-hook.ts` (narrow `HookState` field + installer entry, Phase 05-owned seam), `apps/web/test/no-e2e-hook-in-dist.test.ts` (extend), one e2e spec. Parallel-safe with Phases 08 and 08b (disjoint); sequential after Phase 07 (engine trio).

### Registry update request (Phase 09)

For the orchestrator or registry owner to apply (not edited here):
- Replace the `## Phase 09` claim with the file set under Touchpoints above.
- Remove `registry.ts` and the "registry slot" wording; add `apps/web/src/lib/download.ts`, `engine/types.ts`, `engine/engine.worker.ts`, `StructureScreen.tsx` (header), and `apps/web/test/import-graph.test.ts`.
- Add `apps/web/src/e2e-hook.ts` (narrow-edit claim on a Phase 05-owned seam: one `HookState` field plus installer entry for the IS_E2E force-invalid-outline hook; not append-only) and `apps/web/test/download-blob.test.ts`; `download.ts` is create-or-reuse with Phase 08 (same signature).
- Note ordering: Phase 09 EXECUTE follows Phase 07's engine-trio edits; parallel-safe with 08/08b.

## Data Flow

Analyze in the engine worker → project masked `StructureView` to an `OutlineDraft` (eager, optional; attached next to wherever `result.structure` is assigned) → main thread adds `document.name` via `maskOutlineName` → `finalizeOutline` validates with `OutlineSchema` (safeParse) → `JSON.stringify(…, null, 2)` → `downloadBlob`. `OutlinePreview` shows counts only (label "sections incl. parts"), read from the same `outline.counts`, so tests compare like with like.

## Failure Modes

- No structure (e.g. unparsed or scan failure): `outline` omitted; the Export button (mounted outside the `view ?` conditional) renders disabled with `outline-export-disabled-reason`.
- Document without investor types: empty `investorPaths` array (valid); low-confidence scans include `confidenceNote`.
- Schema safe-parse failure: inline error, no download, never a partial file.
- Import-graph guard refuses the schema import: switch to fallback worker RPC `exportOutline(name)`.
- Sensitive values in free text: masked and clipped to 300; leak test seeds sensitive values and asserts absence.
- Object URL leak: revoked after a tick in `downloadBlob`.

## Implementation Checklist

### 09-A Core schema, builder, snapshot
- [x] A1. `outline/{schema,version,index}.ts`: `OutlineSchema` v1 per Public Contracts; `outlineFilename(name)` (uses `maskText` internally plus the sanitizer rules), `maskOutlineName(name)`, `OUTLINE_SCHEMA_ID`, `OUTLINE_DISCLAIMER`; append the full barrel export list from Public Contracts to `packages/core/src/index.ts` (append-only); `id` fields are never masked.
- [x] A2. `outline/build.ts`: export `buildOutlineDraft(view, opts: {docHash, source, pageCount?, ocrLowConfidencePages?, notice?}) → OutlineDraft`; pure projection of masked StructureView to outline (document order, fixed key order, drops per contract, free text masked and clipped 300); composes `confidenceNote` from `ocrLowConfidencePages` and `notice` (key omitted when neither is present; masked then clipped 300).
- [x] A3. `fixtures/outline/schema.v1.json` emitted from `z.toJSONSchema(OutlineSchema)`; `outline-schema-snapshot.test.ts` compares against it; investor-path heuristic note in schema description.
- [x] A4. `logic-outline-export-contents.test.ts`: samples #1, #3, #5: counts equal Node-derived `buildStructureView` totals (structure-view.spec precedent) and the Public Contracts equalities (`sections` = sections.length, `references` = references.length, `branches` = branches.length, `definedTerms` = terms count, `investorPaths` = `investors.types.length`; `targets.join(", ")` equals the source target string); disclaimer present; no `generatedAt`; byte-stability across two runs; seeded sensitive values absent from citations; filename sanitizer unit cases. Non-vacuity asserts: branches and investorPaths non-empty on #3; external references present in at least one sample. Plus one synthetic StructureView case covering every enum value (all branch kinds, external refs, all term statuses, uncertain investor paths) with sensitive seeds in every free-text field (`where`, `condition`, `text`, `note`, `citation`, `document.name`); assert all masked and clipped, ids unmasked. Plus the `confidenceNote` cases (G7): one low-confidence input (`ocrLowConfidencePages` non-empty and a `notice` containing a sensitive seed longer than 300): `confidenceNote` present, seed masked, length ≤ 300; one clean input (neither option): the `confidenceNote` key is absent from the object.

### 09-B Engine field, download, button
- [x] B1. `engine/types.ts` optional `outline?: OutlineDraft`; `engine.worker.ts` projects eagerly in analyze next to wherever `result.structure` is assigned, omitted without structure. Re-read `engine.worker.ts` at EXECUTE start (Phase 07 extracts `prepare`); sources per Public Contracts (contentHash = docHash, format = `result.source ?? 'html'`, pageCount, `ocrLowConfidencePages` from `ocr.pages[]` and `notice`, passed to `buildOutlineDraft` which composes `confidenceNote`).
- [x] B2. `apps/web/src/lib/download.ts` `downloadBlob(filename: string, data: string | Blob, mime: string): void` (create only if Phase 08 has not; else reuse); `apps/web/test/download-blob.test.ts` with stubbed `URL.createObjectURL` / `URL.revokeObjectURL` and fake timers: asserts, for both a string input and a Blob input (Blob passed through unwrapped), the anchor click, filename, mime, and that revoke runs after a tick and not before.
- [x] B3. `features/outline/finalizeOutline.ts` (`maskOutlineName`, `OutlineSchema.safeParse`, stringify, `outlineFilename`; calls `e2eForceInvalidOutline()`); add the IS_E2E force-invalid-outline hook to `apps/web/src/e2e-hook.ts` (a small `HookState` field plus installer entry, a narrow edit in a Phase 05-owned seam, not append-only; body inside `if (IS_E2E)`); extend the production-absence gate test to assert the new hook name is absent.
- [x] B4. `ExportOutlineButton.tsx` (test ids `outline-export`, `outline-export-disabled-reason`, `outline-export-error`; disabled with explanation when no outline; inline error on invalid) and `OutlinePreview.tsx` (`outline-preview`; counts only, label "sections incl. parts"; cuttable); mount in the `StructureScreen.tsx` header OUTSIDE the `view ?` conditional so the disabled no-structure state renders; existing ids `structure-meta`, `structure-toggle-everything`, `structure-view` unchanged.
- [x] B5. `apps/web/test/import-graph.test.ts` ALLOWED += exactly `OutlineSchema`, `outlineFilename`, `maskOutlineName` (value names; the main thread never imports core `src` paths; fallback: worker RPC `exportOutline(name)`).

### 09-C E2E and leak tests
- [x] C1. `logic-outline-export.spec.ts`: export, parse downloaded file, validate with schema, compare `outline-preview` counts and the file's `counts` against Node-derived `buildStructureView` totals (structure-view.spec precedent); blocked-on-invalid via `__aduinE2E.forceInvalidOutline(true)`; no-structure case driven by `__aduinE2E.failStage('structure')` asserting `outline-export` disabled and `outline-export-disabled-reason` visible.
- [x] C2. Run regression gates and confirm no secrets or Cloudflare changes.

## Test Gates (commands created in this phase)

One token per call, `pnpm --filter <pkg> test <token>`, no `--`.

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| contents | `pnpm --filter @aduin/core test logic-outline-export-contents` | Fully-Automated | AC63 |
| schema snapshot | `pnpm --filter @aduin/core test outline-schema-snapshot` | Fully-Automated | AC63 |
| download-blob | `pnpm --filter @aduin/web test download-blob` | Fully-Automated | AC63 |
| e2e | `pnpm --filter @aduin/web test:e2e logic-outline-export` | Fully-Automated | AC63 |
| hook absent from production | `pnpm --filter @aduin/web test no-e2e-hook-in-dist` (extended to assert the force-invalid-outline hook name is absent; executing/test agents may use the prefix token `no-e2e-hook-in-d` if a shell hook blocks the full word) | Fully-Automated | AC63 (failure-contract hook cannot ship) |
| regression web | `pnpm --filter @aduin/web test import-graph` | Fully-Automated | Phase 03 intact |
| regression e2e | `pnpm --filter @aduin/web test:e2e structure-view` (also `engine-worker-split`, `a11y-smoke`, one token per call) | Fully-Automated | Phase 02/03/07 intact |
| regression core | `pnpm --filter @aduin/core test:golden` | Fully-Automated | Phase 01 intact |
| hygiene | `pnpm guard:cf` and `pnpm secrets:scan` (separate calls) | Fully-Automated | Cloudflare/secrets safe |

Failing stubs for red-first: `should export sections branches references terms and investor paths`, `should match the structure view counts`, `should include the reference-only disclaimer`, `should be byte-stable`, `should not leak seeded sensitive values`, `should cover every enum value in the synthetic structure view`, `should revoke the object URL after a tick`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `logic-outline-export-contents` (core unit on samples #1/#3/#5) | Fully-Automated | AC63 |
| `outline-schema-snapshot` | Fully-Automated | AC63 |
| `download-blob` (web unit: object URL created, revoked after a tick) | Fully-Automated | AC63 |
| `logic-outline-export` (e2e: export, parse, validate, counts vs Node-derived totals, blocked-on-invalid, disabled no-structure state) | Fully-Automated | AC63 |

```bash
pnpm --filter @aduin/core test logic-outline-export-contents
pnpm --filter @aduin/core test outline-schema-snapshot
pnpm --filter @aduin/web test download-blob
pnpm --filter @aduin/web test:e2e logic-outline-export
# Expected: each exits 0
```

## Exit Gate

- Gates green; schema snapshot fixture committed; phase report written.
- Residual backlog stubs written at UPDATE PROCESS (named residuals, not proving strategies): R1 investor-path correctness (heuristic, no ground truth, P2-2); R2 real OCR confidence calibration (whether the low-confidence flags are right; the note composition is gated synthetically in A4); R3 `downloadBlob` object-URL revoke behavior in real browsers (unit test uses stubs only).

## Risks and Kill Criteria

- Tier 2: cut if behind schedule (record `SKIPPED (P1 cut)`, AC63 DEFERRED, backlog stub).
- Schema churn: versioned `v1`; later changes bump the version.
- Import-graph guard refusal: use the worker RPC fallback.
- StructureScreen header edit touches Phase 02-owned file: keep to a single additive slot.

## Cost / Secret Hygiene

No network, no LLM, no secrets; sensitive values masked in free text; Cloudflare untouched.

## Rollback

`git revert` phase commits; removing the header mount hides the button; `outline` is optional so the engine contract stays compatible.

## Blockers That Would Justify BLOCKED Status

- Investor paths (Phase 02) not stable enough to project (finish Phase 02 first).
- Phase 07 engine-trio edits not landed (sequence after it).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [x] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [x] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [x] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note written (2026-10-17)
- [x] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [x] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [x] 6. EVL — all EVL gates green at dca6a45 (independent serial run, iteration-001); R1-R3 stubs registered; EVL HANDOFF SUMMARY written
- [x] 7. UPDATE PROCESS — phase report written, umbrella state updated, context updated, committed (phase 07 and 09 closeout)

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Inner Loop Refresh Note

Date: 2026-10-17. Sections changed from INNOVATE decisions: Overview, Chosen Approach (new), Acceptance Criteria, Entry Gate, Touchpoints, Public Contracts (kinds fixed to whitelist|role|skip|negative|jump; schema fully specified), Blast Radius (plus Registry update request), Data Flow, Failure Modes, Implementation Checklist (regrouped 09-A/B/C), Test Gates (one token per call, no `--`; added schema snapshot and regression set), Risks, Execution Strategy, Resume handoff. Samples changed to #1/#3/#5. `registry.ts` dropped from touchpoints.

### PVL supplement cycle 1 (2026-10-17)

6 gaps applied (PVL-supplement mode, validate contract untouched): (1) count definitions pinned to StructureView totals with A4/C1 equality checks and Node-derived totals; (2) `OutlineSchema`, `outlineFilename`, `maskOutlineName` exported from core, three value names added to ALLOWED, `id` never masked; (3) `apps/web/src/e2e-hook.ts` added to Touchpoints, Blast Radius and registry request, with production-absence gate extended; (4) Export button mounted outside the `view ?` conditional, test ids specified, no-structure e2e via `failStage('structure')`; (5) `OutlineDraft` type and field sources defined, projection attached beside `result.structure`, `engine.worker.ts` re-read at EXECUTE start; (6) synthetic all-enum A4 case with non-vacuity asserts, plus `download-blob` unit test and gate. Residual stubs R1-R3 recorded in Exit Gate. `download.ts` is create-or-reuse with Phase 08.

### PVL supplement cycle 2 (2026-10-17)

1 gap applied (G7, PVL-supplement mode, validate contract untouched): `buildOutlineDraft` takes `ocrLowConfidencePages?` and `notice?` and composes `confidenceNote` (omitted when none, masked, clipped 300); A4 gains one low-confidence and one clean case; R2 narrowed to real OCR confidence calibration. Advisories E8/E9: builder export named and all barrel exports listed, three-name rule scoped to the main-thread ALLOWED set, `e2e-hook.ts` edit described as a narrow `HookState` field plus installer entry.

Frozen helper signature (orchestrator note): `downloadBlob(filename: string, data: string | Blob, mime: string): void`; Public Contracts, B2 and the download-blob test cases (string and Blob input) updated.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S4 → 1/7 LOW. Recommended: sequential, single opus EXECUTE agent after Phase 07 lands (engine trio); parallel-safe with Phases 08/08b. Sonnet for research/validation. If cut: `SKIPPED (P1 cut)`, AC63 DEFERRED plus backlog stub.

## Test Infra Improvement Notes

(none identified yet)

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-09-logic-outline_PLAN_17-10-26.md`
- Last completed step: 3 PLAN-SUPPLEMENT (2026-10-17); PVL supplement cycle 2 applied (G7)
- Validate-contract status: written 2026-10-17, Gate: PASS
- Next Step: spawn vc-validate-agent (inner PVL); EXECUTE only after Phases 02, 03, 07 are verified, or record `SKIPPED (P1 cut)`. Next phase: Phase 10 needs this phase done or explicitly skipped.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: inner-pvl: phase-09
supersedes: 2026-10-17 (inner-pvl: phase-09, cycle-1 re-validate CONDITIONAL, 1 CONCERN G7) — re-validation after PVL supplement cycle 2 has current evidence

Re-validation note (cycle 2): the single open gap from cycle 1 (G7, `confidenceNote` derivation had no automated gate) is verified resolved in plan text (Public Contracts, A2, A4, B1, Exit Gate R2) and against code. Advisories E8 and E9 verified applied. The frozen shared signature `downloadBlob(filename: string, data: string | Blob, mime: string): void` is consistent in all five Phase 09 places (Chosen Approach, Public Contracts, B2, supplement-cycle note, Test Gates wording) and matches the Phase 08 plan's frozen form (its S0.2 and G7 entries; two Phase 08 lines use the shorthand `text|blob`, which is the same union, so no conflict). Trend 6 gaps, then 1, then 0. No new gap found; 0 FAIL, 0 CONCERN.

Parallel strategy: sequential
Rationale: score 2/7 (S4 phase program, S7 about 14 files in blast radius); dominant signal S7. Sequential is chosen on fit, not score: the checklist is a dependency chain (core schema and builder, then worker field, then button, then e2e) and the engine trio and `StructureScreen.tsx` are shared seams, so fan-out would only add coordination cost. One opus execute agent (EXECUTE only), one sonnet vc-tester for EVL, sonnet for everything else. Agent count: 1 + 1 = 2. Cost guard: not triggered.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC63 | Outline counts equal the Node-derived StructureView totals, disclaimer present, no `generatedAt`, byte-stable, seeded sensitive values absent in every free-text field, ids unmasked, all enum values project (synthetic case), `confidenceNote` composed when low-confidence pages or a notice are given (masked, at most 300 chars) and key absent when neither is given, filename sanitizer cases (samples #1/#3/#5) | Fully-Automated | `pnpm --filter @aduin/core test logic-outline-export-contents` | B |
| AC63 | `OutlineSchema` v1 JSON Schema matches the committed `fixtures/outline/schema.v1.json` | Fully-Automated | `pnpm --filter @aduin/core test outline-schema-snapshot` | B |
| AC63 | `downloadBlob(filename: string, data: string \| Blob, mime: string): void` creates the anchor click with filename and mime for string and Blob input, and revokes the object URL after a tick, not before | Fully-Automated | `pnpm --filter @aduin/web test download-blob` | B |
| AC63 | Export button downloads a file that parses, validates against the schema and matches counts; invalid outline blocks the download; no-structure document disables the button | Fully-Automated | `pnpm --filter @aduin/web test:e2e logic-outline-export` | B |
| AC63 | The force-invalid-outline hook name is absent from the production build | Fully-Automated | `pnpm --filter @aduin/web test no-e2e-hook-in-dist` (prefix token `no-e2e-hook-in-d` if a shell hook blocks the full word) | B |
| Phase 03 intact | Main-thread core value imports stay allow-listed (guard edit only adds the three outline names) | Fully-Automated | `pnpm --filter @aduin/web test import-graph` | A |
| Phase 02/03/07 intact | Structure screen, worker split and a11y still pass with the new header button | Fully-Automated | `pnpm --filter @aduin/web test:e2e structure-view` (then `engine-worker-split`, then `a11y-smoke`, one token per call) | A |
| Phase 01 intact | Core goldens unchanged | Fully-Automated | `pnpm --filter @aduin/core test:golden` | A |
| Hygiene | No Cloudflare zone change, no secrets | Fully-Automated | `pnpm guard:cf` and `pnpm secrets:scan` (separate calls) | A |

Gate command rule: `pnpm --filter <pkg> test <token>` or `test:e2e <token>`, no `--`, one token per call; an unmatched token must fail (vitest and Playwright both exit non-zero on no match; every token above is unique to its file).

Failing stubs (red-first, Fully-Automated new-gate rows; copy into the test files verbatim):

- Row 1 (`logic-outline-export-contents`):
  - `test("should export sections branches references terms and investor paths", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should export sections branches references terms and investor paths") })`
  - `test("should match the structure view counts", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should match the structure view counts") })`
  - `test("should include the reference-only disclaimer", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should include the reference-only disclaimer") })`
  - `test("should be byte-stable", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should be byte-stable") })`
  - `test("should not leak seeded sensitive values", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should not leak seeded sensitive values") })`
  - `test("should cover every enum value in the synthetic structure view", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should cover every enum value in the synthetic structure view") })`
  - `test("should compose a masked clipped confidence note for low-confidence input", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should compose a masked clipped confidence note for low-confidence input") })`
  - `test("should omit the confidence note key for clean input", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should omit the confidence note key for clean input") })`
- Row 2 (`outline-schema-snapshot`): `test("should match the committed JSON Schema fixture", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should match the committed JSON Schema fixture") })`
- Row 3 (`download-blob`): `test("should revoke the object URL after a tick", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should revoke the object URL after a tick") })`
- Row 4 (`logic-outline-export`): `test("should download a valid outline whose counts match the structure view", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should download a valid outline whose counts match the structure view") })`

gap-resolution legend: A proven now; B gate added by this plan's checklist; C deferred to a named later phase; D backlog test-building stub (named residual). C-4: the strategy column carries only Fully-Automated / Hybrid / Agent-Probe; Known-Gap is never a strategy.

Named residuals (gap-resolution D; justified, none is the silent reason a behavior passes; every developed behavior above has a Fully-Automated gate):
- R1 Investor-type paths are heuristic with no ground truth (P2-2); the export proves projection fidelity only (counts, order, masking), not path correctness. Stated in the schema description. Backlog stub written by UPDATE PROCESS.
- R2 Real OCR confidence calibration (whether the low-confidence flags are right). The `confidenceNote` composition itself is now gated synthetically in A4 (G7 resolved); only the real-OCR input quality is residual. Backlog stub written by UPDATE PROCESS.
- R3 `downloadBlob` real-browser object-URL revoke: the `download-blob` unit test uses stubs and the e2e download exercises the real call once, but revoke timing in real browsers is not asserted. Backlog stub written by UPDATE PROCESS.

Legacy line form:
- AC63 outline: [Fully-automated: `pnpm --filter @aduin/core test logic-outline-export-contents`, `pnpm --filter @aduin/core test outline-schema-snapshot`, `pnpm --filter @aduin/web test download-blob`, `pnpm --filter @aduin/web test:e2e logic-outline-export`, `pnpm --filter @aduin/web test no-e2e-hook-in-dist`] | [known-gap: investor-path correctness (R1), real OCR confidence calibration (R2), real-browser object-URL revoke (R3) — documented above]
- Regression: [Fully-automated: `pnpm --filter @aduin/web test import-graph`, `pnpm --filter @aduin/web test:e2e structure-view`, `pnpm --filter @aduin/web test:e2e engine-worker-split`, `pnpm --filter @aduin/web test:e2e a11y-smoke`, `pnpm --filter @aduin/core test:golden`, `pnpm guard:cf`, `pnpm secrets:scan`]

Dimension findings:
- Infra fit: PASS — unchanged from cycle 1 and re-checked against code: `maskText` and `maskThenClip` live in `packages/core/src/detectors/util.ts` and the sibling `structure-view/build.ts` already imports them relatively, so the outline module can do the same; `StructureScreen.tsx` renders one shared `header` in both branches so a slot outside the `view ?` actions block shows in the no-structure state; `engine.worker.ts` already carries `source`, `pageCount`, `ocr` and `notice` on the result and `failStage('structure')` leaves `structure` unset, so `outline` is naturally omitted; `apps/web/src/lib` does not exist yet (create-or-reuse with Phase 08); `e2e-hook.ts` has a `HookState` object and IS_E2E-guarded installer, so the narrow edit is feasible.
- Test coverage: PASS — G7 resolved: `buildOutlineDraft` now takes `ocrLowConfidencePages?` and `notice?` and composes `confidenceNote` itself (key omitted when neither is present, masked then clipped 300), and A4 carries one low-confidence case (note present, seed masked, length at most 300) and one clean case (key absent), so the behavior has a Fully-Automated gate and R2 is narrowed to real OCR calibration. Earlier resolved items stay resolved (count definitions, synthetic all-enum case, non-vacuity asserts on #3, `download-blob` unit for string and Blob input). No developed behavior rests on a residual alone.
- Breaking changes: PASS — `EngineResult.outline` is additive and optional; barrel export is append-only and the full list (values `OutlineSchema`, `outlineFilename`, `maskOutlineName`, `buildOutlineDraft`, `OUTLINE_SCHEMA_ID`, `OUTLINE_DISCLAIMER`; types `Outline`, `OutlineDraft`) is now explicit; the three-name rule is correctly scoped to the main-thread `ALLOWED` set while the worker imports `buildOutlineDraft`; `downloadBlob` signature is identical across Phase 09 and the Phase 08 frozen form, so no cross-phase conflict. Advisory: `import-graph.test.ts` is edited here and not in Phase 07; the edits do not overlap in time.
- Security surface: PASS — client-side only, no network, no secrets; free text including the new `confidenceNote` goes through `maskThenClip` (mask first, then clip); ids never masked; name and filename go through `maskText`; `safeParse` blocks partial files; force-invalid hook body inside `if (IS_E2E)` with the production-absence gate extended.
- Section 09-A feasibility (core schema, builder, snapshot): PASS — builder signature and export names are now spelled out (A1, A2, Public Contracts); `z.toJSONSchema` behavior verified in the first pass; `targets` split on ", " is lossless on real data; highest-risk edit: builder field mapping and masking, covered by the synthetic case and the new `confidenceNote` cases.
- Section 09-B feasibility (engine field, download, button): PASS — B1 now states the worker passes `ocrLowConfidencePages` and `notice` to the builder and the builder composes the note; `downloadBlob` create-or-reuse and the `download-blob` unit are feasible in jsdom; `source-guard` needs token styles only in the new feature files (E8); highest-risk edit: `StructureScreen.tsx` header slot, a single additive element outside `view ?`.
- Section 09-C feasibility (e2e and leak tests): PASS — precedent `structure-view.spec.ts` derives expected numbers from core in Node; the disabled case uses the existing `failStage('structure')` hook; tokens `logic-outline-export` and `no-e2e-hook-in-dist` are unique; highest-risk edit: keeping the invalid-outline hook out of the production bundle (gated).

Plan updates applied: none this pass (supplement cycle 2 already applied G7 and advisories E8/E9 in the plan body).

Execute-agent instructions:
- E1. Before editing `engine.worker.ts`, re-read it: Phase 07 extracts `prepare` from `analyze`. Attach `result.outline` next to wherever `result.structure` is assigned; keep it optional and absent without structure.
- E2. Never apply `maskThenClip` to `id` fields (ids pass through unchanged); apply it only to the free-text fields in Public Contracts.
- E3. Main-thread value imports come from `@aduin/core` only (never `@aduin/core/src/...`); the guard edit adds exactly the three value NAMES to `ALLOWED`, nothing else.
- E4. Create the failing stubs first and see them red; run gates one token per call, no `--`.
- E5. Phase 06 working-tree edits (`features/scan`, `state/review.ts`, `open-document`) may be uncommitted; start EXECUTE only after Phases 06 and 07 are committed, and do not touch their files.
- E6. Keep the `StructureScreen.tsx` edit to one additive slot in the shared `header` (outside the `view ?` actions block); leave existing test ids (`structure-meta`, `structure-toggle-everything`, `structure-view`) unchanged.
- E7. If a gate cannot be made green, record the gap in the phase report; do not mark Phase 09 verified on a known-gap.
- E8. Export the outline builder (`buildOutlineDraft`) plus the `Outline` and `OutlineDraft` types from the barrel in addition to the three guard-listed value names; the three-name rule applies to the main-thread `ALLOWED` set, not to the barrel. Use only token styles in `features/outline/**` (source-guard).
- E9. `no-e2e-hook-in-dist`: keep the new hook key and reader body inside `if (IS_E2E)` so the minifier drops them; assert the hook key string (for example `forceInvalidOutline`) is absent from the production build text, mirroring the existing `e2eFailStage` assertion.
- E10 (advisory, not a gap). In `engine.worker.ts`, `OcrPageView.index` is 0-based; convert to 1-based page numbers when building `ocrLowConfidencePages` (or state in the builder that the values are 0-based indexes) so the note text reads naturally. A4 asserts presence, masking and length only, so keep the conversion in one place and cover it in the phase report.

Open gaps: none (G1-G7 resolved; no out-of-scope gaps; no new gaps this cycle)

What This Coverage Does NOT Prove:
- `logic-outline-export-contents`: proves projection fidelity on three HTML samples plus one synthetic all-enum case, and `confidenceNote` composition on two synthetic inputs (counts, order, disclaimer, byte-stability, masking, filename sanitizer); does not prove that investor paths are correct (R1), nor that real OCR low-confidence flags are right (R2), nor the worker's 0-based-to-page-number mapping of `ocr.pages[]` (E10, one line, typechecked only).
- `outline-schema-snapshot`: proves the schema did not drift; does not prove any real document validates (the contents and e2e gates do).
- `download-blob`: proves the call sequence and revoke-after-a-tick with stubbed URL functions and fake timers for string and Blob input; does not prove real-browser revoke timing (R3).
- `logic-outline-export` (e2e): proves export, parse, validate, count match, blocked-on-invalid and the disabled no-structure state in Chromium for one or two HTML samples; does not prove behavior on PDF, DOCX or OCR documents, nor the file saved to disk beyond the Playwright download.
- `no-e2e-hook-in-dist`: proves the hook name is absent from the production bundle text; does not prove other future hooks are guarded.
- Regression gates: static or screen-level; they do not prove the worker structured-clone cost of the extra `outline` field on large documents.

Gate: PASS (re-validation after PVL supplement cycle 2; 0 FAIL, 0 CONCERN; G1-G7 resolved; 3 named residuals R1-R3, none is the sole proof of a developed behavior)
Accepted by: not required — Gate is PASS (no concerns to accept); validate-fix loop closed after 2 supplement cycles.

## Deviations

Recorded by EXECUTE (2026-10-17, within blast radius, autopilot):
- `apps/web/src/styles/structure.css`: appended a small `.outline-export` layout block (flex column, existing `.mut` text) for the header slot. Not listed in Touchpoints; styling only, no tokens added.
- `outline-schema-snapshot` compares the parsed JSON (deep equality) rather than raw bytes, so the repo-wide prettier pass on `fixtures/` does not churn the fixture.
- `references[]` order: internal references in document order, then external citations in document order (the StructureView keeps them in two lists).
- `fixtures/outline/.gitkeep` removed (the directory now holds `schema.v1.json`).
