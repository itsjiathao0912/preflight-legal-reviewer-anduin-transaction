---
name: registry:intake-mvp-blast-radius
description: "Append-only blast-radius registry for the intake-mvp phase program (one section per phase and per Phase 3 track; seam rules; overlap analysis)"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: fund-package-intake
---

# Phase Blast-Radius Registry — intake-mvp

Append-only: later agents add a `## Phase N` revision note, never overwrite. Umbrella: `intake-mvp-umbrella_PLAN_17-10-26.md`. Registry initialized by the PLAN session (single planner, so no cross-agent overlap occurred during planning; the TeamCreate machinery was unavailable, so the coordination token protocol reduces to this one-author registry; overlap analysis below).

## Seam files (shared by design; edits are single appended lines or additive keys, serialized by phase order)

- `packages/core/src/index.ts` (barrel; Phase 1 appends ONE block; nobody else touches it)
- `scripts/package.json` (Phase 1 adds keys `package:fixtures`, `package:facts-extract`; Phase 4 adds key `smoke:live-package`; sequential phases, different lines)
- `apps/web/test/import-graph.test.ts` (Phase 2 appends allow-list names; nobody else edits it)
- `apps/web/src/state/review.ts` and `apps/web/src/engine/*` (Phase 2 only; frozen afterwards)
- `apps/web/src/features/registry.ts`, `apps/web/src/shell/Sidebar.tsx`, `apps/web/src/styles/{tokens,base,app-extra,counsel,structure}.css`: NOT edited by any phase of this program (no new routes, no new sidebar items, no new tokens).

## Phase 1 — core package engine
Creates: `packages/core/src/package/*` (types, config, policy, detect, facts, definitions, references, terms, resolve, coverage, request, baseline, analyze, index), core tests under `packages/core/test/{unit,golden,seeded,property}/package-*` (now including `package-readiness`, `package-facts`, `package-scan-bounded`), `scripts/src/fixtures/{make-package,package-facts-extract}.ts`, `scripts/test/package-fixtures.test.ts`, `fixtures/package/**` (including `fixtures/package/design/**`: copies of the design-owned `samples/packages/**`, which stay READ-ONLY for every phase).
Edits (append/additive only): `packages/core/src/index.ts`, `scripts/src/fixtures/check.ts`, `scripts/package.json`.
NOT owned: `packages/core/src/{detectors,counsel,contracts,memory,structure,model}/**`, `apps/**`.
status: PLANNED

## Phase 2 — web data plane
Creates: `apps/web/src/state/package.ts`, `apps/web/src/features/package/{contract,package-view,package-persist}.ts`, `apps/web/src/features/open-document/{PackageConfirmTable.tsx,package-actions.ts,demo-packages.ts}`, `apps/web/src/styles/package-intake.css`, `apps/web/e2e/fixtures/package.ts`, web unit tests `package-store`, `package-view`, `package-db-v2`, `engine-package-api`, `apps/web/src/features/open-document/package-confirm-table.test.tsx` (vitest-collected path), and nine `intake-*` upload specs (including `intake-demo-packages`).
Edits: `apps/web/src/engine/{types,client,engine.worker}.ts`, `apps/web/src/storage/db.ts`, `apps/web/src/state/review.ts`, `apps/web/src/features/open-document/{OpenDocumentDialog.tsx,open-actions.ts,validate-upload.ts,samples.ts}` (`features/review/use-review-view.ts` is NOT edited: Phase 3 reads `usePackageView().gateReasons`), `apps/web/test/import-graph.test.ts`, `scripts/src/build-samples.ts`.
NOT owned: `packages/**`, `apps/worker/**`, `features/{structure,counsel,gate,memory,compare}/**`, `shell/**`, `FindingsScreen.tsx`.
status: PLANNED

## Phase 3 — web surfaces (three strictly disjoint tracks)
Contract consumed (read-only): every Phase 2 file listed above.

### Track 3a (Package lens)
Creates: `apps/web/src/features/package/{PackageLens,PackageDocuments,PackageReferences,PackageTerms,PackageCoverageTable}.tsx`, `apps/web/src/styles/package-lens.css`, `apps/web/src/features/package/package-lens.test.tsx`, six `apps/web/e2e/intake-*` specs (package-lens, crossdoc-terms-no-false-positive, crossdoc-terms-real-error, terms-unverified-without-lpa, reference-confirm, correction-persists).
Edits: `apps/web/src/features/structure/StructureScreen.tsx`, `apps/web/src/features/structure/model.ts`.

### Track 3b (coverage line and gate)
Creates: `apps/web/src/features/gate/{CoverageLine,PackageGateReasons}.tsx`, `apps/web/src/styles/package-gate.css`, `apps/web/src/features/gate/package-gate-ui.test.tsx`, four `apps/web/e2e/intake-*` specs (coverage-visible, coverage-next-to-gate, gate-warning-policy, no-package-ui-on-samples).
Edits: `apps/web/src/shell/GateButton.tsx`, `apps/web/src/features/review/FindingsScreen.tsx`.

### Track 3c (GP group and request DOCX)
Creates: `apps/web/src/features/counsel/{GpRequestGroup.tsx,exportRequestDocx.ts}`, `apps/web/src/styles/package-request.css`, `apps/web/test/request-export-contents.test.ts`, `apps/web/src/features/counsel/gp-request-group.test.tsx`, two `apps/web/e2e/intake-*` specs (missing-docs-request-export, gp-group-absent-without-package).
Edits: `apps/web/src/features/counsel/CounselScreen.tsx`.

Disjointness proof (checked at PLAN time against the real tree): `StructureScreen.tsx` / `structure/model.ts` appear only in 3a; `GateButton.tsx` / `FindingsScreen.tsx` / `features/gate/*` new files only in 3b (the existing `features/gate/GateReasons.tsx` and `gate-store.ts` are untouched); `CounselScreen.tsx` / `features/counsel/*` new files only in 3c (existing counsel files untouched); each track has its own CSS file and its own e2e spec names; no track edits a Phase 2 file. Join step J1 re-checks with `git diff --name-only`.
status: PLANNED

## Phase 4 — closeout and deploy
Creates: `apps/web/e2e/{intake-perf-budget,intake-a11y-keyboard,stack-memory-package-privacy}.spec.ts`, `scripts/src/live/smoke-package.ts`, `scripts/test/live/smoke-package.test.ts`, evidence pack `harness/phase-4/*.json` in the task folder.
Edits: `scripts/package.json` (one key).
Remote: Worker `aduin-transaction-web` version only.
NOT owned: all product source.
status: PLANNED

## Revision note (PVL cycle 1, 17-10-26; append-only note, names above were corrected in place to match)
- Phase 1: `scripts/src/fixtures/build-package.ts` renamed `make-package.ts` (session bash hook blocks the old word); adds `fixtures/package/design/**` copies of read-only `samples/packages/**` plus three tests (`package-readiness`, `package-facts`, `package-scan-bounded`); no new shared seam files; the package format type is exported as `PackageDocFormat` (barrel stays one appended block).
- Phase 2: component test moved under `src/` (vitest include); `use-review-view.ts` dropped from the claim; adds spec `intake-demo-packages` and `build-samples.ts` copying `fixtures/package/design/**` (still the same file).
- Phase 3: three `.tsx` unit tests moved to `apps/web/src/features/{package,gate,counsel}/` (inside each track's own directory; still disjoint; each token matches exactly one file). 3b builds on the parent session's `features/gate/gate-pill.ts` and does not edit it.
- Phase 4: no new files; rollback target and `P1_BASE` are recorded literals from the Step 0 re-sync.
- Shared-checkout note (orchestrator addition A): the parent session's tracked edits (`packages/core/src/detectors/{ref-label-coherence,ref-this-section,util}.ts`, two core goldens, `apps/web/src/{shell/GateButton.tsx,features/gate/gate-pill.ts,features/compare/CompareScreen.tsx,styles/base.css}` plus specs, `apps/worker/{seed,test/env.d.ts,vitest.config.ts}`, `scripts/src/seed/*`) are committed and deployed before Phase 1 EXECUTE; they are not claimed by any phase here. Re-check against the real tree at Phase 1 Step 0.

## Potential Blast Radius Conflicts

None across phases that run at the same time. The only concurrent work in the program is the three Phase 3 tracks, whose sets are disjoint (above). Sequential phases share only the seam files listed at the top (`scripts/package.json`: Phase 1 and Phase 4, different lines, never concurrent). Resolution: parallel-safe by phase ordering; no reassignment needed.

## Phase 1 — T14 revision note (17-10-26, PVL-supplement; append-only)
Adds to the Phase 1 claim: edits to exactly five existing core files, no others under detectors or structure: `packages/core/src/structure/headings.ts`, `packages/core/src/structure/structurer.ts` (only if needed), `packages/core/src/structure/conditionals.ts`, `packages/core/src/detectors/flow.ts`, `packages/core/src/detectors/broken-conditional.ts`; new tests `packages/core/test/unit/{structure-heading-forms,broken-conditional-annex-question}.test.ts`, `packages/core/test/golden/package-design-goldens.test.ts`; existing core goldens or pinned counts may change only with an explanation-table row in the Phase 1 report. The Phase 1 "NOT owned" line above is superseded for these five files only (`util.ts`, `registry.ts`, every other detector and structure file stay read-only). Overlap check: no other phase claims any of these files (Phases 2-4 own `apps/**`, scripts and web specs; web specs pinning per-sample counts are read-only for Phase 1). status: PLANNED
