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
Owns: `packages/core/src/{detectors (new files), investor, memory/patternKey.ts}`, `packages/core/test/**` (new), `fixtures/html-seeded`, `fixtures/memory/{fund-*,demo-seed-spec.json}`, `scripts/src/fixtures`, `apps/web/src/features/investor-paths`, 2 web e2e specs. Disjoint from 04b.

## Phase 03
Owns: `apps/web/**` (except later feature dirs), `scripts/src/build-samples.ts`. Reads `design/mockups/*`. Disjoint from 04a.

## Phase 04a
Owns: `apps/worker/src/{routes/proxy,proxy,upstream,limits,identity/turnstile.ts,config.ts}`, `apps/worker/test/{proxy,fakes}`, `scripts/src/slice-check.ts`, `apps/web/e2e/slice.spec.ts`. Disjoint from 04b (migrations, seed, platform, memory, routes/memory, test/memory).

## Phase 04b
Owns: `apps/worker/{migrations,seed,src/db,src/platform,src/memory,src/routes/memory,test/memory}`, `scripts/src/{seed,spikes/s05*,s08*,s09*,s10*}`, `fixtures/memory/_test-seed-spec.json`. Single owner of all SQL.

## Phase 05
Owns: `packages/core/src/llm/**` (except `tasks/drift-narrative*`), `fixtures/llm-recordings/{clause-judgment,counsel-draft}`, `apps/web/src/features/ai/**`, `scripts/src/{record/record-ai.ts,precompute/precompute-ai.ts}`, `design/mockups/ai-states.html`. Extends: `apps/worker/src/routes/proxy/ai.ts` (04a-owned; verified before this phase).

## Phase 06
Owns: `packages/core/src/{adapters (pdf, docx, ocr, format-detect), ocr}`, `fixtures/{docx,pdf,scans-ground-truth}`, `fixtures/llm-recordings/ocr`, `apps/web/src/{engine,features/scan}`, `scripts/src/{ocr,spikes/s03*,s04*,record/record-ocr.ts,precompute/precompute-ocr.ts}`, `apps/web/public/precomputed/ocr`, `design/mockups/scan-viewer.html`.

## Phase 07
Owns: `packages/core/src/diff/**`, `packages/core/src/llm/tasks/drift-narrative.v1.ts`, `fixtures/diff`, `fixtures/llm-recordings/drift-narrative`, `apps/web/src/features/diff/**`, `design/mockups/diff.html`.

## Phase 08
Owns: `packages/core/src/counsel/**`, `apps/web/src/{features/{counsel,gate,metrics,audit},api (extension)}`, `scripts/src/dev-seed.ts`, `design/mockups/counsel-sheet.html`.

## Phase 08b
Owns: `apps/web/src/features/memory/**`, `design/mockups/firm-memory.html`; extends `features/audit/**`.

## Phase 09
Owns: `packages/core/src/outline/**`, `fixtures/outline`, `apps/web/src/features/outline/**`.

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
