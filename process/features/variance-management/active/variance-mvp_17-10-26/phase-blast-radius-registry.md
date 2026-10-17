---
name: registry:variance-mvp-blast-radius
description: "Append-only blast-radius registry for the variance-mvp phase program (one section per phase; seam rules; Intake collision files)"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: variance-management
---

# Phase Blast-Radius Registry - variance-mvp

Append-only: later agents add a `## Phase N` revision note, never overwrite. Umbrella: `variance-mvp-umbrella_PLAN_17-10-26.md`. Registry initialized by the PLAN session. Single planner (no agent team was available), so no cross-author overlap occurred during planning; the disjointness analysis below was done by that planner.

## Seam files (shared by design; edits are single appended lines or narrow additive edits, serialized by the orchestrator; Intake may touch the same files)

- `packages/core/src/index.ts` (barrel; V1 appends one export line)
- `apps/web/test/import-graph.test.ts` ALLOWED list (V2 and V4 append single lines)
- `packages/core/test/__snapshots__/contracts.json-schema.snap` (V3 regenerates once, with a change note; Intake may also regenerate: whoever lands second rebases)
- `apps/worker/migrations/` (V3 adds exactly one file; number allocated at V3 Step 0)
- `apps/web/src/engine/{engine.worker,types,client}.ts` (V2 first, V4 second, additive methods)
- `apps/web/src/state/review.ts` (V2 variance slice, then V4 answer/regression actions; narrow edit scope each)
- `apps/web/src/features/registry.ts` (V4 renames one nav label)
- `scripts/src/fixtures/{build-seeded,check}.ts` (V1 one appended line and an additive scan)
- `fixtures/memory/law-firms.json` (V3 adds `hartwell-crane` atomically with the migration; Intake may add the same entry: no-op merge)
- `scripts/src/dev-seed.ts` (V3 updates `EXPECTED_MIGRATIONS`)

## Intake planned footprint (observed in Intake's locked INNOVATE and 4 phase plans; code not landed at planning time)

Core: `packages/core/src/package/**` (new), one append line in `packages/core/src/index.ts`; `fixtures/package/**` via `scripts/src/fixtures/build-package.ts` (extends `check.ts`). Web: `state/package.ts`, `features/package/**`, `features/open-document/**` (multi-file Upload modal), Dexie `version(2)` in `storage/db.ts`, `state/review.ts` (`DocMeta.packageId`, `openDocument` option `package`), `engine/{types,client,engine.worker}.ts`, `features/review/{use-review-view.ts,FindingsScreen.tsx}`, `shell/GateButton.tsx`, `features/gate/{CoverageLine,PackageGateReasons}.tsx`, `features/counsel/{GpRequestGroup,exportRequestDocx}.ts(x)` and `CounselScreen.tsx`, a large `import-graph` ALLOWED append, live script `scripts/src/live/smoke-package.ts`. NOT touched by Intake (so free for Variance): core `computeGate`/`counsel/*`, D1 migrations, Worker code, contracts and snapshot, `law-firms.json`.

## Intake collision files (Intake owns or may touch; Variance edits are additive and re-checked at each Step 0)

`state/review.ts`, `storage/db.ts` (Variance does NOT edit), `features/open-document/*` (Variance does NOT edit except a logged derived repair in V5), `features/review/{FindingsScreen,use-review-view,model,Banners}`, `features/gate/GateReasons.tsx`, `shell/GateButton.tsx`, `counsel/{gate,sheet,types}.ts` (core), `features/counsel/*`, `index.ts` (core barrel), `import-graph.test.ts`, `contracts/memory.ts` and snapshot, `apps/worker/migrations/`, `routes/memory/*`, `memory/repo/*`, `api/*`, `law-firms.json`, `build-seeded.ts`, `process/context/*` (serialized at UPDATE PROCESS). Forbidden to Variance (as for Intake): `README.md`, `docs/README.md`, `docs/architecture/**`, `design/mockups/**`; Variance also does not edit `docs/**` at all (handoff NOTE instead).

## Disjointness analysis (V2 and V3 are parallel-safe)

V2 edits only `apps/web/src/{features/variance,features/review,state,engine,shell,styles}`, web variance tests and e2e. V3 edits only `packages/core/src/{contracts,config,memory}`, `fixtures/memory/law-firms.json`, `apps/worker/**`, `apps/web/src/api/**`, web api unit tests, `stack-memory` spec, `scripts/src/dev-seed.ts`. No file is claimed by both. Shared tools: both run web unit and the web build, so run them serially (one agent at a time); Playwright port 4317 (preview) and 4318/8788 (stack-memory) never run together. V4 starts only after V2 and V3 are committed and edits V2-owned `ChangeRow.tsx`, `select.ts`, `variance-store.ts` narrowly.

## Phase 1
Owns (creates): `packages/core/src/variance/**`, `packages/core/test/{unit,property,golden}/variance-*`, `fixtures/variance/**`, `scripts/src/fixtures/build-variance.ts`. Edits (additive): `packages/core/src/counsel/{gate,sheet,types,template-draft}.ts`, `packages/core/src/index.ts` (append), `packages/core/src/diff/index.ts` (ONLY if check A1 needs one export line), `scripts/src/fixtures/{build-seeded,check}.ts`. NOT touched: contracts, findings, taxonomy, detectors registry, firms, `apps/**`.
status: planned
status: DONE (2026-10-17; EVL green, commits 42b3ecb 7f0f355 d954511 789eb8f 0ee9fca; append-only, earlier line kept for history)

## Phase 2
Owns (creates): `apps/web/src/features/variance/{types,baseline-source,variance-store,select,ChangeRow,ChangeDiff,ImpactLines,BaselineControl,BaselineModal,CosmeticGroups,NoBaselineLine}`, `apps/web/src/styles/variance.css`, `apps/web/test/variance-*`, `apps/web/e2e/variance-{baseline-from-package,baseline-same-firm-only,cosmetic-hidden-default,no-baseline-errors-only,ai-never-gates,render-first}.spec.ts`, `apps/web/e2e/fixtures/variance.ts`. Edits (additive): `apps/web/src/engine/{engine.worker,types,client}.ts`, `apps/web/src/state/{review,filters}.ts`, `apps/web/src/features/review/{FindingsScreen,use-review-view,model}`, `apps/web/src/shell/GateButton.tsx`, `apps/web/test/import-graph.test.ts` (append). NOT touched: counsel, gate, compare, memory, open-document, structure, api, storage, packages, worker.
status: planned

## Phase 3
Owns (creates): `apps/worker/migrations/00NN_variance.sql`, `apps/worker/test/memory/variance-*`, `apps/web/e2e/stack-memory-variance-regression-no-cross-firm.spec.ts`, `packages/core/test/unit/variance-label-scope-rule.test.ts`, `harness/phase-03/`. Edits (additive): `packages/core/src/{contracts/memory.ts,config/limits.ts,memory/label.ts}` plus the snapshot, `fixtures/memory/law-firms.json`, `apps/worker/src/{routes/memory/{counsel,lookup,decisions},memory/{repo,health},platform}` (weights location per A3), `apps/web/src/api/{memoryApi,stubMemoryApi,realMemoryApi,outbox}.ts`, web api unit tests, existing worker memory tests, `scripts/src/dev-seed.ts`. NOT touched: web features/state/shell/engine, core variance/counsel/findings/diff, `seed/demo.sql`, remote D1.
status: planned

## Phase 4
Owns (creates): `apps/web/src/features/variance/{OwnerChip,owner-store,regression-client,AssertionPreview,owner-groups}`, `apps/web/test/variance-{counts-owner-selector,question-ids,owner-sheet-model,counsel-export-contents,intent-human-only-static,assertion-preview}.test.ts`, `apps/web/e2e/variance-{owner-override,two-owner-two-questions,questions-by-owner-export,answer-record-intent-scope,intent-human-only,regression-r01,gate-two-states}.spec.ts`, `apps/web/e2e/fixtures/variance-owners.ts`. Edits (additive): `apps/web/src/features/counsel/*`, `apps/web/src/features/gate/GateReasons.tsx`, V2-owned `features/variance/{ChangeRow,select,variance-store}` (narrow, after V2 landed), `apps/web/src/state/review.ts`, `apps/web/src/features/registry.ts` (one row), `apps/web/src/engine/*` (additive `runRegression`), `apps/web/test/import-graph.test.ts` (append), `apps/web/e2e/fixtures/memory-stub-rules.ts`, derived repairs of counsel/app-shell specs. NOT touched: packages, worker, api, storage.
status: planned

## Phase 5
Owns (creates): `apps/web/e2e/variance-{demo-214-to-7,demo-gate-walk}.spec.ts`, `scripts/src/live/probe-live-variance.ts`, `scripts/test/probe-variance.test.ts`, `harness/phase-05/`, backlog notes. Edits (additive): `scripts/src/build-samples.ts` (H&C sample entries), `apps/web/e2e/{perf-budget,a11y-keyboard}.spec.ts`, `scripts/package.json`, derived repairs only (`sample-picker-smoke`, `deployed-smoke`, `open-document` if proven necessary). Operational: one remote migration apply and one Worker deploy to the allowed target only. NOT touched: `seed/demo.sql`, migrations (applied, never edited), README, `docs/**`, `design/**`, packages logic.
status: planned

## Phase 5 revision (PVL cycle 1, 17-10-26)
Appended by the PVL-supplement. Naming seam and collision files discovered by the validators and the re-check items from the working tree.
- `scripts/src/build-samples.ts`: P05 B1 adds additive H&C entries and turns the `expected 12 HTML samples` guard into an explicit `12 + N` check. Intake Phase 2 ALSO modifies it (copies package members, writes `apps/web/public/samples/packages.json`, keeps `manifest.json` byte-identical). Seam file; read Intake's landed diff and rebase at Step 0 (e). Not previously listed as an Intake collision file.
- Probe naming: P05 plan creates `scripts/src/live/probe-variance.ts` and `scripts/test/live/probe-variance.test.ts` (the Phase 5 section above says `probe-live-variance.ts` / `scripts/test/probe-variance.test.ts`; the plan text governs, the script key stays `probe:live-variance`). Also creates `scripts/test/counts-wording.test.ts`. Derived repair target is `slice.spec.ts` (live smoke), not `deployed-smoke`.
- `scripts/src/live/*` is shared with Intake's `smoke-package.ts`: P05 imports `common.ts`, never edits it.

## PVL cycle 1 revisions (cross-phase seam and collision files named by validators)
- `apps/web/src/features/review/model.ts`: P02 and P04 make narrow edits; Intake collision file. Serialize P02 then P04; rebase on Intake's landed change at each Step 0.
- `apps/web/src/e2e-hook.ts` and `apps/web/test/no-e2e-hook-in-dist.test.ts` (P02): P02 adds hook surface and must keep the no-hook-in-dist test green; P04 and P05 must not add new hook exports.
- `apps/web/src/features/counsel/ExportDialog.tsx` and `ai-draft.ts` (P04): within the Intake-touched `features/counsel/*` area; narrow additive edits only, re-check at Step 0.
- `.prettierignore` (P01): one appended line for `fixtures/variance/**`; any phase touching it appends, never reorders.
- `scripts/src/fixtures/gen-demo-seed.ts`, `scripts/test/**/firms-and-rules.test.ts` and the `schema_version` pin sites (P03, serialized with the migration): `scripts/src/dev-seed.ts` (`EXPECTED_MIGRATIONS`), `apps/worker/test/memory/memory-endpoint-contract.test.ts`, `apps/web/e2e/stack-memory-smoke.spec.ts`. All must be updated together when the V3 migration number is allocated; P05 only re-checks.
- `apps/worker/src/memory/repo/purge.ts` and `apps/worker/src/db/tx.ts` (P03): P03 edits narrowly for the new table and trigger handling; Intake may touch `memory/repo/*`. Rebase at Step 0.

### Currently observed concurrent Intake edits (working tree at PVL cycle 1; re-check items at every Step 0, not Variance-owned)
`apps/web/src/shell/GateButton.tsx` (plus new `features/gate/gate-pill.ts`, `test/gate-pill.test.ts`), `apps/web/e2e/gate-pill.spec.ts`, `apps/web/e2e/diff-pairs.spec.ts`, `apps/web/e2e/filter-sort.spec.ts`, `apps/web/src/features/compare/CompareScreen.tsx`, `apps/web/src/styles/base.css`, `apps/worker/seed/demo.sql` (and new `apps/worker/seed/test-seed.sql`), `apps/worker/vitest.config.ts`, `apps/worker/test/env.d.ts`, `scripts/src/seed/{check-seed,gen-demo-seed}.ts`, `packages/core/src/detectors/{ref-label-coherence,ref-this-section,util}.ts` and two golden tests. Implications: P05 states `seed/demo.sql` is NOT touched by Variance, yet it is currently modified by another stream, so `seed:check` baseline must be re-measured at Step 0 (A1) and any diff attributed. The detector edits may change finding counts that P01 and P05 pin (214 to 7 uses the authored variance corpus, not these detectors' real-sample counts; confirm). `GateButton.tsx` is also a P02 edit target.

### Phase 5 addendum: samples/packages
Design-owned, read-only `samples/packages/` (three fictional DOCX fund packages) is not yet committed. P05 reads it only; no phase edits it. If it lands, the sample-count guard in `scripts/src/build-samples.ts` is not affected unless Intake's `packages.json` step or P05 B1 chooses to import from it (decision at Step 0 (g)).

## PVL cycle 2 corrections
Appended by the PVL cycle 2 supplement (Phase 03). Plan text governs over earlier entries.
- Real paths: `scripts/src/seed/gen-demo-seed.ts` (earlier entries naming `scripts/src/fixtures/gen-demo-seed.ts` are wrong) and `packages/core/test/unit/firms-and-rules.test.ts` (earlier entries naming a scripts-side `firms-and-rules` test are wrong).
- `apps/web/test/variance-regression-doc-not-retained.test.ts` is a Phase 04 owned file (not Phase 03).
- Phase 03 normalizer location: `packages/core/src/variance/label.ts` (`normalizeAssertionLabel`, barrel-exported), imported by P03, never rewritten.

## Step 0 re-sync (2026-10-17 PLAN-SUPPLEMENT, Intake closed)
Appended by the Step 0 PLAN-SUPPLEMENT; basis `variance-mvp_STEP0-RESYNC_17-10-26.md` (git HEAD 8a9398c, code HEAD a4d7a34 plus Intake Phase 4 commits through 6fb34fb; nothing built or run). Plan text and this section govern over the earlier Intake-footprint entries above (which stay for history).
- Superseded: the "Intake planned footprint" and "Currently observed concurrent Intake edits" lists. Everything Intake touched is committed; `apps/worker/seed/demo.sql` has no diff in `f791b97..HEAD`; the earlier "scripts/src/fixtures/build-package.ts" name is `make-package.ts` (plus `package-facts-extract.ts`); `use-review-view.ts` does NOT expose `pkg`/`pkgGate` (Intake changed only line 38, the `unreadable` spread); the package gate merge lives in `shell/GateButton.tsx`.
- Confirmed NOT touched by Intake (no collision): `packages/core/src/{counsel,diff,contracts}`, the contracts snapshot, `apps/worker/{migrations,src/routes,src/memory}`, `fixtures/memory/law-firms.json`, `scripts/src/fixtures/build-seeded.ts`, `scripts/src/dev-seed.ts`, `features/registry.ts`, `features/gate/GateReasons.tsx`, `features/counsel/{ExportDialog,ai-draft}`, `e2e-hook.ts`, `no-e2e-hook-in-dist` test. (Intake touched `apps/worker/src/proxy/pipeline.ts`, `upstream/openrouter.ts` and three proxy tests: not Variance files.)
- NEW or changed collision files (Variance edits stay additive and are re-checked at each RESEARCH): `apps/web/src/state/package.ts` (P02 adds ONE additive pure accessor `readPackageMemberSource`, D-S0-1; new claim, Intake is closed); `apps/web/src/state/last-doc.ts` and `apps/web/src/App.tsx` (restore-on-start reopens the last document and package; read-only awareness, a reload re-runs the Variance pass); `apps/web/src/features/ai/ai-lane.ts` (`aiHolds`, `aiReopen`, `emit`, `shown`; read-only awareness); `apps/web/src/features/review/FindingsScreen.tsx` (Intake added `<CoverageLine placement="header" />`; the P02 baseline control and All/Errors/Changes segment must coexist, D-S0-4); `apps/web/src/shell/GateButton.tsx` (merged gate object, three-part render, `merged.reasons.length` badge; P02 F2 and P04 keep them); `apps/web/src/state/review.ts` (+84 lines; gate call sites now `gateLine` 537-541, dismiss next-selection about 735 and 749-755, dismiss `computeGate` 757, toast 759; P02 C2b); `apps/web/src/engine/{types,client,engine.worker}.ts` (Intake added `packageDefs`, `packageFacts`, `readPackageDoc`; Variance's `runVariance` is a further additive method); `apps/web/src/storage/db.ts` (Dexie `version(2)`; `uiState` also holds `session:lastDoc`, so Variance keys stay `variance:*`); `scripts/src/fixtures/check.ts` (+41 lines; P01 slots its scan before the final `if (problems.length)` block); `scripts/src/build-samples.ts` (guard at line 214; additive `buildPackages()` after the manifest write); `fixtures/package/demo-packages.json` (P05 B3 ONE-field retag of `northgate-iii` to `hartwell-crane`, D-S0-7); `packages/core/src/index.ts` (star export at :172; the P01 named list cannot collide); `apps/web/test/import-graph.test.ts` (ALLOWED gained 18 Intake names including `eligibleBaselines`).
- Read-only inputs (Variance never edits): `fixtures/package/design/northgate-iii/*.docx` (P01 H4 reads), `fixtures/package/hartwell/**`, `samples/packages/**` (design-owned, committed c1c5fe0), `.playwright-mcp/` and `.DS_Store` (untracked, not Variance's; never touch or commit, D-S0-9).
- Phase claims added: Phase 1 also owns `packages/core/test/unit/variance-package-01-northgate.test.ts`. Phase 2 also owns `apps/web/test/package-member-source.test.ts` and edits `apps/web/src/state/package.ts` (additive accessor). Phase 3 adds regression tokens only (`intake-firm-tagging`, `intake-baseline-role-same-firm`, `package-confirm-table`, `package-baseline-eligibility`). Phase 5 also edits `fixtures/package/demo-packages.json` (one field).
status: planned

## Phase 2 revision (UPDATE PROCESS after Phase 03, 2026-10-18)
Appended by the Phase 03 UPDATE PROCESS. Plan text governs over earlier entries.
- Phase 02 V2 adds ONE additive export to `apps/web/src/state/package.ts` (`readPackageMemberSource`, D-S0-1) and edits `apps/web/src/e2e-hook.ts` and `apps/web/test/no-e2e-hook-in-dist.test.ts` (hook surface must keep the no-hook-in-dist test green; P04 and P05 add no new hook exports). Earlier Phase 2 "NOT touched" lists do not cover these files.

## Phase 3 result (UPDATE PROCESS, 2026-10-18)
status: DONE (2026-10-18; EVL green, 0 fix cycles; commits f93fd9a b5b5f84 1882dbf ef11874 f68fe32 b6fe91b 84577e4; append-only, earlier `status: planned` kept for history)
- Migration allocated and applied locally only: `apps/worker/migrations/0006_variance.sql` (`schema_version` 5 to 6). It also recreates the two `demo_ro_*_update` triggers after the guards (SQLite fires the newest trigger first). Not idempotent; remote apply is Phase 05 under a Time Travel bookmark.
- Files touched beyond the Phase 3 claim: `apps/worker/src/memory/http.ts` and `apps/worker/src/db/tx.ts` (new trigger texts map to 400 `invalid_request`), new `apps/worker/src/memory/repo/regression.ts`, `apps/worker/test/memory/variance-harness.ts`, `scripts/test/reference-firms-pin.test.ts`, `apps/web/test/support/fakeMemoryFetch.ts`, `apps/web/test/import-graph.test.ts` ALLOWED (+3 names), `scripts/src/seed/gen-demo-seed.ts` (pin `REFERENCE_0003_FIRM_IDS`), five `schema_version` pin sites. `apps/web/src/state/review.ts` NOT touched (P04 wires `fundName`).
- Six firms in `law-firms.json` (added `hartwell-crane`, `ostrander-pell`, `calder-reyes`); package 03 stays untagged.
- Seam for later phases: `seed-copy.ts` copies decisions without `intent`/`scope`; P04 owns the `fundName` wiring and client/Worker label parity test.

## Phase 2 result (UPDATE PROCESS, 2026-10-18)
status: DONE (2026-10-18; EVL green, 0 fix cycles; commits 8f4e6a4 60a5507 15aa796; append-only, earlier `status: planned` kept for history)
- Files touched beyond the Phase 2 claim (beyond the earlier `## Phase 2 revision` note, which already covers `state/package.ts`, `e2e-hook.ts`, `no-e2e-hook-in-dist.test.ts`): `apps/web/src/features/review/components/DocPane.tsx` (JumpMenu counts change rows under the Changes segment only), `apps/web/test/review-sync.test.ts` (fixture gets one block; shared gate keeps `unreadable`), `apps/web/e2e/memory-no-reflag.spec.ts` (count error rows only). `FilterMenu.tsx` NOT touched (cosmetic toggle lives in `CosmeticGroups`). No ALLOWED line added to `import-graph.test.ts`.
- Seams for P04: V2-owned `features/variance/{ChangeRow,select,variance-store}` are stable; specs opening two same-firm uploads now get change rows (count error rows with `:not([data-kind="change"])`); `VARIANCE_PENDING_TIMEOUT_MS` 20 000; triage uses the existing `triage:{docId}` key; pointer key `variance:baseline:{firmId}`; e2e seam `varianceDelayMs` / `varianceFail` (IS_E2E only).
