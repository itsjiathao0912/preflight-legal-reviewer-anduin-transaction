---
name: registry:subdoc-qa-mvp-blast-radius
description: "Append-only blast-radius registry for the subdoc-qa-mvp phase program (one section per phase; seam rules)"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: subdoc-qa-mvp
---

# Phase Blast-Radius Registry — subdoc-qa-mvp

Append-only: later agents add a `## Phase N` revision note, never overwrite. Umbrella: `subdoc-qa-mvp-umbrella_PLAN_17-10-26.md`. Registry initialized by the PLAN session (single planner, so no cross-agent overlap occurred during planning; overlap analysis below).

## Seam files (shared by design; edits are single appended lines, serialized by the orchestrator)

- `packages/core/src/index.ts` (barrel exports)
- `packages/core/src/detectors/registry.ts` (detector registrations; Phases 01, 02)
- `apps/web/src/features/registry.ts` (feature modules; Phases 03, 02, 05, 06, 07, 08, 08b, 09)
- `apps/worker/src/app.ts` (mount lines for proxy routes, memory routes, Turnstile port, D1 platform; Phases 04a, 04b)
- `pnpm-lock.yaml` / package manifests: owned by Phase 00; new dependencies need a registry note and a serialized commit.

## Phase 00
Creates: root config, `packages/*` and `apps/*` skeletons, `scripts/` package, `fixtures/` dirs, guards, seam stubs, spike scripts for S1, S2, S6, S7, `THIRD_PARTY_NOTICES.md`. Edits: `.gitignore`.
status: DONE (17-10-26, commit 7d9955b, EVL 11/11 green)

## Phase 01
Owns: `packages/core/src/{model,adapters/html,structure,graph,findings,detectors (golden files only),memory,session,config,contracts,engine}` + their tests, `fixtures/fingerprint-vectors.json`, `fixtures/memory/law-firms.json`. NOT owned (later phases): `llm`, `diff`, `counsel`, `outline`, `investor`, `adapters/{pdf,docx,ocr}`. Seams (append-only): `packages/core/src/index.ts`, `detectors/registry.ts`. Phase-00-owned manifests/lint edited only via the serialized F0 seam step (2026-10-17 revision).
status: DONE (17-10-26, commit 6d12628, EVL CLEAN; independent security review pending)

## Phase 02
Owns: `packages/core/src/{detectors (new files), investor, structure-view (buildStructureView), memory/patternKey.ts}`, `packages/core/test/**` (new files), `fixtures/html-seeded`, `fixtures/memory/{fund-*,demo-seed-spec.json}`, `scripts/src/fixtures`, `apps/web/src/features/{structure,investor-paths}/**`, new web e2e specs (structure-view, investor-path-view, reveal-sensitive).
Narrow additive edits (revision 2026-10-17, inner PVL E14): core `memory/mask.ts` (F3 widening), `adapters/html.ts` + `structure/option-groups.ts` + `structure/types.ts` (footnote_marker TS-only side channel; no schema change), `findings/make-finding.ts` (re-export patternKey), golden tests `golden-01`/`golden-03-05`/`golden-11` (narrow "no other finding" totals to Phase 01 detector ids; golden content unchanged), `finding-schema-contract.test.ts` (mask-aware), `detectors/registry.ts` + `index.ts` (append-only seams); web `engine/types.ts` (optional `structure`), `engine.worker.ts`, `shell/Sidebar.tsx`, `shell/NavGroup.tsx` (structure badge), `features/registry.ts` (append); Phase 03 e2e specs repaired by derivation (gate-pill, filter-sort, previously-handled-section, placeholder-routes, app-shell, a11y-smoke, finding-highlight). Seams: `packages/core/package.json` (test:seeded), `scripts/package.json` (fixtures:build/check) — serialized against 04b. Disjoint from 04b code (apps/worker/**, worker-side memory/mask).
status: DONE (17-10-26, commits 7a7f421 + 1f5dade, EVL core 291/291, review fixes applied; F4 deferred to Phase 05)
## Phase 03
Owns: `apps/web/**` (except later feature dirs), `scripts/src/build-samples.ts`. Reads `design/mockups/*`. Disjoint from 04a.
status: DONE (17-10-26, commit 833161b, EVL green, visual review PASS_WITH_NOTES)

## Phase 04a
Owns: `apps/worker/src/{routes/proxy,proxy,upstream,limits,identity/turnstile.ts,config.ts}`, `apps/worker/test/{proxy,fakes}`, `scripts/src/slice-check.ts`, `apps/web/e2e/slice.spec.ts`. Disjoint from 04b (migrations, seed, platform, memory, routes/memory, test/memory).
status: DONE (17-10-26, commits 729e7fd + 70d320b, EVL green, review APPROVE_WITH_FIXES fixed; M1 closed). Extra seam edit during M1 closure: `apps/web/playwright.config.ts` (optional `SLICE_BASE_URL` override, one additive key).

## Phase 04b
Owns: `apps/worker/{migrations,seed,src/db,src/platform,src/memory,src/routes/memory,test/memory}`, `scripts/src/{seed,spikes/s05*,s08*,s09*,s10*}`, `fixtures/memory/_test-seed-spec.json`. Single owner of all SQL.
status: DONE (17-10-26, commits 7a7f421 + bb83e04 + fb3064f + 59d9831, EVL worker 445/445, core 291/291, review APPROVE_WITH_FIXES final, autoStop cleared)

## Phase 05
Owns: `packages/core/src/llm/**` (except `tasks/drift-narrative*`), `fixtures/llm-recordings/{clause-judgment,counsel-draft}`, `apps/web/src/features/ai/**`, `scripts/src/{record/record-ai.ts,precompute/precompute-ai.ts}`, `design/mockups/ai-states.html`. Extends: `apps/worker/src/routes/proxy/ai.ts` (04a-owned; verified before this phase).
Revision 2026-10-17 (PLAN-SUPPLEMENT): also owns `packages/core/src/contracts/ai.ts` (additive `task`, `drafts`) + contracts snapshot, `packages/core/test/{recorded,helpers}/**`, `apps/web/src/api/**` (generic stream client, reused by Phase 06 OCR), `apps/web/e2e/{auto-downgrade,ai-resume,provenance,sample-zero-calls,ai-banners}.spec.ts`. Extends (additive/seam edits): `apps/worker/src/{proxy/pipeline.ts,proxy/guards.ts,upstream/{openrouter,models-config}.ts,routes/proxy/ai.ts}`, `apps/worker/wrangler.jsonc`, `apps/worker/test/**`; `apps/web/src/{features/review (seam),engine/engine.worker.ts (additive toView),state/session.ts,shell/AiSwitch.tsx,features/processing/StageStatus.tsx,storage/db.ts}`; detectors (F4, P2-3, P2-4); `scripts/package.json`. Phase 07 appends `llm/tasks/drift-narrative.v1.ts` + one registry entry only (no Worker edit). Phase 05 EXECUTE commits before Phase 06 EXECUTE.
Revision 2026-10-17 (PVL cycles 1-4, extension requests recorded in the plan's `### Registry update request` subsections): additionally touches `apps/worker/src/{proxy/ports.ts,index.ts,upstream/classify.ts,config.ts}`, `apps/worker/test/fakes/platform.ts`, `apps/worker/test/proxy/{proxy-budget,free-only-config,llm-failure-injection-matrix-d1,rules-hash-seed-parity}.test.ts`, `apps/web/public/precomputed/{docHash}.{rulesHash8}.json` (samples #1/#3, committed), `apps/web/e2e/{locator-chip,status-stages}.spec.ts`, `scripts/test/precompute-ai.test.ts`, `process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-05/`, `apps/web/test/import-graph.test.ts` (gate, unchanged), `apps/web/src/engine/{types,client}.ts` (additive), `apps/web/test/engine-ai-api.test.ts` (new), `apps/web/src/api/{stubMemoryApi,memoryApi}.ts`, `apps/web/vite.config.ts`, `apps/web/src/e2e-hook.ts`. Shared ownership with Phase 06 on `apps/web/src/engine` (types.ts, client.ts, engine.worker.ts): Phase 05 commits first, edits additive; Phase 06 follows.
status: DONE (17-10-26, commits 2ac1917 + e9c90d9 + 9c9f3b5 + a9732a6 + f0f476c, EVL core 355 / worker 515 / scripts 49 / web unit 47 / e2e 82 / golden 44, review fixes M1-M3 L1-L3 applied, evidence validator 0 failures)

## Phase 06
Owns: `packages/core/src/{adapters (pdf, docx, ocr, format-detect), ocr}`, `fixtures/{docx,pdf,scans-ground-truth}`, `fixtures/llm-recordings/ocr`, `apps/web/src/{engine,features/scan}`, `scripts/src/{ocr,spikes/s03*,s04*,record/record-ocr.ts,precompute/precompute-ocr.ts}`, `apps/web/public/precomputed/ocr`, `design/mockups/scan-viewer.html`.
Revision 2026-10-17 (PVL): newly owns `packages/core/src/adapters/{sup-segments,pdf-text,docx,ocr,page-noise,format-detect}.ts`, `apps/web/src/engine/{render-pages,ocr-queue}.ts`, `apps/web/public/precomputed/ocr/**`, `apps/web/public/samples/09-rw-holdings-scans/**`, `scripts/src/{fixtures/make-pdf.ts,ocr/**,precompute/**,record/record-ocr.ts}`, `fixtures/{pdf,docx,scans-ground-truth,llm-recordings/ocr}/**`, `harness/phase-06/`. Extends (additive, serialized after prior owner): `apps/worker/src/upstream/{openrouter,models-config}.ts` (OCR path) + worker ocr prompt-version test; `packages/core/src/{adapters/html.ts (re-export), detectors/footnote-requirement*, investor/extract.ts, findings/make-finding.ts, index.ts (append)}`; `buildDocGraph`; `apps/web/src/{engine/{engine.worker,types,client}.ts, state/review.ts, features/open-document/**}` (corrected from non-existent features/home); `apps/web/package.json` (conditional on E5 probe); `scripts/package.json`; `pnpm-lock.yaml` (single writer after Phase 05); `apps/web/e2e/{upload-limits,sample-picker-smoke,engine-worker-split}.spec.ts`; `scripts/src/build-samples.ts`; `THIRD_PARTY_NOTICES.md`. Phase 05 owns `apps/web/src/api/`; Phase 06 only consumes it.

## Phase 07
Owns: `packages/core/src/diff/**`, `packages/core/src/llm/tasks/drift-narrative.v1.ts`, `fixtures/diff`, `fixtures/llm-recordings/drift-narrative`, `apps/web/src/features/diff/**`, `design/mockups/diff.html`.
Revision 2026-10-17 (PVL): also touches `apps/web/e2e/{placeholder-routes,layout-vs-mockup,a11y-smoke}.spec.ts` and `apps/web/src/smoke.test.tsx` (narrow repair edits, Phase 03 owned); `scripts/src/fixtures/{build-seeded.ts,check.ts}` (additive, Phase 02 owned; stray-file scan extended to `fixtures/diff`); `apps/web/src/engine/{engine.worker.ts,client.ts,types.ts}` (prepare helper + `diffDocuments`, after Phase 06); `apps/web/src/features/{compare/**,registry.ts}`; `apps/web/test/support/mockupCss.ts`; `packages/core/src/index.ts` (append).

## Phase 08
Owns: `packages/core/src/counsel/**`, `apps/web/src/{features/{counsel,gate,metrics,audit},api (extension)}`, `scripts/src/dev-seed.ts`, `design/mockups/counsel-sheet.html`.
Revision 2026-10-17 (PVL): newly owns `apps/web/src/lib/download.ts` (shared with Phase 09, first lander creates, second must not narrow; frozen signature `downloadBlob(filename: string, data: string | Blob, mime: string): void`), `apps/web/src/api/{realMemoryApi,outbox}.ts`, `apps/web/src/features/audit/AuditList.tsx` (reusable; 08b mounts it as a tab), `harness/phase-08/`, `apps/worker/test/llm/rules-echo.test.ts`, `apps/web/e2e/stack-memory-*.spec.ts`. Extends additively (serialized after prior owner): `apps/worker/src/proxy/pipeline.ts` (result-frame `meta` only), `apps/web/src/features/ai/stream-client.ts` (optional `task` param), `apps/web/src/api/{memoryApi,stubMemoryApi,client}.ts`, `apps/web/src/state/{review,session}.ts`, `apps/web/src/shell/AnalystBadge.tsx`, `apps/web/src/features/review/{gateInterim.ts,**}`, `apps/web/test/import-graph.test.ts` (ALLOWED additions only: `computeGate`, sheet builder, template draft, metrics, `sensitiveSpans`), `apps/web/src/storage/db.ts` (conditional version bump), `apps/web/playwright.config.ts`, `apps/web/package.json` (mammoth devDependency, `test:e2e:stack-memory`), root `package.json` (`dev:stack:seeded`), `apps/worker/package.json` (`dev:e2e`), `pnpm-lock.yaml` (single writer), repairs to `apps/web/e2e/{placeholder-routes,app-shell}.spec.ts` and `apps/web/src/smoke.test.tsx`. Seam order: `features/registry.ts`, `smoke.test.tsx`, `placeholder-routes.spec.ts` are also edited by Phases 07 and 09; Phase 08 appends `counsel` last at EXECUTE time and edits only its own row. Core `export-docx.ts` is NOT created (D3). `features/open-document/**` is not touched. 08b must not redefine `MemoryApi` methods or `AuditList`; Phase 09 must reuse `download.ts` if present.

## Phase 08b
Owns: `apps/web/src/features/memory/**`, `design/mockups/firm-memory.html`; extends `features/audit/**`.
Revision 2026-10-17 (PVL, replaces the stale `design/mockups/firm-memory.html` and "extends `features/audit/**`" wording): owns `apps/web/src/features/memory/**`, `apps/web/e2e/{memory-ui-decisions,memory-ui-rules,memory-ui-audit,stack-memory-firm-rules}.spec.ts`, `apps/web/e2e/fixtures/memory-stub-rules.ts`, `apps/web/test/memory-join.test.ts`. Mounts Phase 08 `AuditList` (read-only, does not modify `features/audit/**` or `apps/web/src/api/**`). Appends one entry id:'memory' to `apps/web/src/features/registry.ts`; adds the additive store action `refreshMemory` to `apps/web/src/state/review.ts` (after Phase 08 S2.1; edit scope limited to that action); narrow repair edits to `apps/web/e2e/{placeholder-routes,app-shell}.spec.ts` and `apps/web/src/smoke.test.tsx`; additive `#memory` case in `apps/web/e2e/a11y-smoke.spec.ts`; additive `mockupCss.ts` / `layout-vs-mockup.spec.ts` only if the slicer cannot reach #v-memory; CONDITIONAL `apps/web/playwright.config.ts` (only if Phase 08 lacks the stack-memory testMatch / preview testIgnore) and CONDITIONAL additive `apps/web/test/import-graph.test.ts`. UI contract is `design/mockups/app.html` #v-memory. No Worker, core or fixtures changes.

## Phase 09
Owns: `packages/core/src/outline/**`, `fixtures/outline`, `apps/web/src/features/outline/**`.
Revision 2026-10-17 (PVL): replaces the earlier claim with the plan Touchpoints file set. Removes `registry.ts` and the "registry slot" wording. Adds `apps/web/src/lib/download.ts` (create-or-reuse with Phase 08, same signature `downloadBlob(filename: string, data: string | Blob, mime: string): void`), `apps/web/src/engine/{types,engine.worker}.ts`, `StructureScreen.tsx` (header), `apps/web/test/import-graph.test.ts`, `apps/web/test/download-blob.test.ts`, and `apps/web/src/e2e-hook.ts` (narrow-edit claim on a Phase 05-owned seam: one `HookState` field plus installer entry for the IS_E2E force-invalid-outline hook; not append-only). Ordering: Phase 09 EXECUTE follows Phase 07 engine-trio edits; parallel-safe with 08/08b.

## Phase 10
Owns: `scripts/src/{deploy,conformance,precompute/precompute-all.ts}`, final `apps/web/public/precomputed/**`, `apps/worker/seed/demo.sql` (regenerated), `README.md`, `docs/{demo,DEPLOY.md}`, `apps/web/e2e/{perf-budget,a11y-keyboard,deployed-smoke,fund-two,free-plan-limits}.spec.ts`; edits `apps/worker/wrangler.jsonc` (D1 id only).

## Overlap analysis (planning time)

| Parallel group | Pairs | Result |
|---|---|---|
| M1 | 03 vs 04a | Disjoint (`apps/web/src` vs `apps/worker/src`); 04a adds one web e2e spec after 03 is verified |
| G1 | 02 vs 04b | Disjoint (`packages/core`, `fixtures/*`, web investor view vs `apps/worker`, seed, migrations) |
| G2 | 05 vs 06 vs 09 | Disjoint feature dirs; shared seams are append-only lines; 05 extends one 04a file after 04a is verified |
| G3 | 07 vs 06/09 | Disjoint (`diff/` vs `adapters`/`ocr` vs `outline/`) |

## Potential Blast Radius Conflicts

None unresolved. Known shared-write points are the seam files above; mitigation is orchestrator-serialized single-line edits.

## Revision note 17-10-26 (Phase 03 PVL supplement)

- Phase 06 EXTENDS `apps/web/src/engine` (created by Phase 03: `engine.worker.ts`, `client.ts`); it does not create it. Only `engine.worker.ts` may import parse/structure internals.
- Phase 03 seam edits serialized by the orchestrator against Phase 04a: `pnpm-lock.yaml`, `THIRD_PARTY_NOTICES.md`, `.gitignore`. Phase 03 edits only `apps/web/package.json` among manifests.
- `apps/web/e2e/slice.spec.ts` stays Phase 04a's; Phase 03 Playwright config defines projects `preview` (P03 specs) and `stack` (04a slice spec).

## Revision note 17-10-26 (Phase 04a PVL supplement)

- Phase 04a OWNS `apps/web/e2e/slice.spec.ts` and `scripts/src/slice-check.ts` (orchestrator decision); Phase 03 proves real findings via its own finding-highlight spec.
- Phase 04a adds `apps/worker/src/proxy/log.ts` (redactor, reused by Phase 04b), `limits/prelimit.ts`, `test/fakes/{openrouter-stub,turnstile-stub}.ts`, and `harness/` evidence pack; drops `routes/proxy/cache.ts`.
- `apps/worker/wrangler.jsonc`: 04a owns proxy vars only (one-key serialized edits). Phase 00 B4 pre-wires mountProxyRoutes/mountMemoryRoutes; 04a fills proxy stubs only; `app.ts` seam = TurnstilePort only.

## Revision note 17-10-26 (Phase 00 EXECUTE — seam rule D2)

- Seam rule: later phases APPEND to barrel/registry seam files only (`packages/core/src/index.ts`, `apps/web/src/features/registry.ts`, `packages/core/src/detectors/registry.ts`); the orchestrator serializes those edits.
- `apps/worker/src/app.ts`: route-mount lines (`mountProxyRoutes(app, deps)`, `mountMemoryRoutes(app, deps)`) are pre-wired by Phase 00 and are never edited; deps-wiring lines (real TurnstilePort in 04a, `createD1Platform` in 04b) are single-line edits serialized by the orchestrator.
- `apps/worker/wrangler.jsonc` (Phase 00 owns the skeleton): Phase 04b owns `triggers.crons` and purge-related `vars`; Phase 04a owns proxy `vars`; each a serialized one-key edit. Carry into Phase 04b PVL.
- Phase 00 added (beyond the touchpoint list): `.prettierignore`, `scripts/tsconfig.worker.json`, `scripts/src/guards/scan-files.ts`, `scripts/src/slice-check-stub.ts` (stub for `pnpm slice:check`; Phase 04a creates `scripts/src/slice-check.ts` and repoints the script), `scripts/spikes/s01-s02/{worker.ts,wrangler.jsonc,cf-api.ts}`.

## Phase 03 re-target note 17-10-26 (supplement cycle 3)

- Phase 03 re-targeted to `design/mockups/app.html` (shell + Findings only; `review-workspace.html` is a historical token source). Blast radius unchanged: `apps/web/**`, `scripts/src/build-samples.ts`; reads `design/mockups/app.html`, `app_NOTES.md`, DATA-MODEL (memory_label CHECK list, test time).
- Phase 03 publishes `data-testid`s (listed in its `## Public Contracts`); Phase 04a's `slice.spec.ts` selectors use only those.
- Structure (incl. Investor types sub-view), Counsel, Compare, Firm memory, Documents are P03 placeholders registered via `apps/web/src/features/registry.ts`; later UI phases append real views. Phase 02's `apps/web/src/features/investor-paths` and its `investor-path-view` e2e have no host until the later Structure UI phase.
- Phase 01 `MemoryLabel` enum must equal the DATA-MODEL `memory_label` CHECK list (`previously_dismissed`, `already_answered`, ...); P03 `memory-label-enum` test asserts it.

## Revision 2026-10-17 (orchestrator, 04b inner PVL)
Seam rule D2 also covers Phase 04b edits to `apps/worker/src/app.ts` (additive pattern-route API; route-mount lines never edited) and `apps/worker/src/index.ts` (lazy app build with env-bound D1 platform). Shared manifest `scripts/package.json`: Phase 02 owns `fixtures:build`/`fixtures:check`; Phase 04b owns `seed:gen`/`seed:check` and the `@aduin/core` dependency (one-key edits). Root `package.json` + `pnpm-lock.yaml`: Phase 04b only during 02 ∥ 04b.

## Phase 07 revision 2026-10-17 (plan-supplement)
Ownership change: Phase 07 now also touches (append-only) `apps/web/src/engine/{engine.worker.ts,client.ts,types.ts}` (adds `EngineApi.diffDocuments`), `apps/web/src/features/registry.ts` (appends id `compare`), `apps/web/src/features/compare/**` (replaces `features/diff/**`), `apps/web/test/support/mockupCss.ts` (Compare slicer), `packages/core/src/index.ts` (export append). `design/mockups/diff.html` is dropped (mockup is `app.html #v-compare`). Engine files overlap Phase 06: order 05 then 06 then 07; Phase 07 EXECUTE starts after Phase 06 lands.
