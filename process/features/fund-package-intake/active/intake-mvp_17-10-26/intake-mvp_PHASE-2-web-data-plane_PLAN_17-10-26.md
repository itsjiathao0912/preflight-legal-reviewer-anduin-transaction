---
name: plan:intake-mvp-phase-2-web-data-plane
description: "Fund package intake — Phase 2: browser data plane (engine worker readPackageDoc, packageDefs and packageFacts, Dexie v2 packages table, usePackage store and frozen PackageView contract, multi-file Upload modal with confirmation table, demo packages, same-firm baseline role) plus upload end-to-end specs"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: fund-package-intake
  phase: phase-2
---

# Phase 2 — Web data plane

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED (waits for Phase 1 VERIFIED)
**Program:** intake-mvp (fund-package-intake, U1-U9, AC-I1..AC-I20)
**Umbrella plan:** process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-2-web-data-plane_REPORT_17-10-26.md (flat in the program task folder)
**Depends on:** Phase 1 (core package module, fixtures, `fixtures/package/demo-packages.json`).
**Locked inputs:** `intake-mvp_SPEC_17-10-26.md`, `intake-mvp_INNOVATE_17-10-26.md` (rulings T1-T4 LOCKED). Context read for this plan: `process/context/all-context.md`, `process/context/ui/all-ui.md`, `process/context/engine/all-engine.md`, `process/context/worker/all-worker.md`, `process/context/tests/all-tests.md`.

---

## Overview

Phase 2 connects the pure core package module to the browser: the engine worker gets a light read for package members and the package-aware analyze settings; Dexie gets an additive `packages` table; a `usePackage` zustand store runs the two-stage pipeline (light read, detect, analyst confirms, normal analyze with package definitions) and exposes ONE frozen read contract (`PackageView`) that Phase 3 consumes; the Upload modal accepts many files, enforces limits and tags, shows the confirmation table, and lists demo packages and recent packages; the same-firm baseline role is markable (the variance consumer). Everything stays render-first: deterministic findings render the moment the worker returns; package analysis, coverage and the Package lens data are computed synchronously from the analyze output afterwards and nothing awaits session, Turnstile or memory.

Phase 2 builds NO new screen and NO Phase 3 surface (Package lens, coverage line, gate popover, GP group are Phase 3). It ends with the P2 to P3 contract frozen and written out below.

**Honest adaptations to the locked INNOVATE (all recorded in the report):**
1. Light-read facts are cached in the existing `parsedModels` table under the key `pkgfacts:<contentHash>` (not the bare hash): the review store already writes `parsedModels` rows keyed by the bare document hash for the opened document, so a bare key would collide.
2. The confirmation table carries baseline through the role select (a separate baseline checkbox would duplicate it); AC-I9 "one or more documents can carry role baseline" is satisfied by the select.
3. Demo-package members are listed in a separate generated `apps/web/public/samples/packages.json` (gitignored like the other generated sample files) so `manifest.json` and the `sample-picker-smoke` counts (13 `sample-option`) stay unchanged.
4. A single-file upload keeps the classic path unless its detection is `sub_agreement` at `high` confidence (existing single-file specs upload tiny nameless snippets that would otherwise fall into the confirmation table); a single high-confidence sub agreement becomes a one-document package with coverage shown after findings render.

## Phase Completion Rules

- `CODE DONE` = checklist complete; `TESTING` = per-step gates green; `VERIFIED` only with: all Section gates green in an independent serial EVL (vc-tester), the full web unit suite and the full preview e2e suite green (so no existing spec regressed), a written validate-contract, the phase report, and the frozen contract section unchanged since PVL. User-confirmation language appears only where the user confirmed.
- Known-Gap is never a terminal pass for developed behavior (vacuous-green ban). Live OCR text quality stays an operator residual (existing backlog), recorded as Known-Gap with a stub; the AC-I3 gate rests on the Fully-Automated scenario.
- The P2 to P3 contract is FROZEN at the end of PVL. After that, any change needs a plan supplement and a PVL re-run; Phase 3 agents never edit Phase 2 files.

## Acceptance Criteria

| ID | Criterion (web half owned by Phase 2) | proven by | strategy |
|---|---|---|---|
| AC-I1 | Many files upload in one action up to 12 files / 40 MB total / 10 MB each; over the limit a plain message and nothing is stored | `intake-multi-upload-e2e` plus `intake-limits-refusal-e2e` plus unit `package-store` (refusal leaves every Dexie table empty) | Fully-Automated |
| AC-I2 | The package is tied to firm, fund, version (aliases resolve, free text refused; fund required; no firm = memory not applied) | `intake-firm-tagging-e2e` (extends `upload-firm-tagging-e2e`) | Fully-Automated |
| AC-I3 | A scanned member reuses the existing OCR path within its limits or the row shows "needs OCR" and affected coverage drops | `intake-scan-ocr-or-flag-e2e` (sample #9 demo member with committed precomputed OCR; uploaded image with OCR unavailable in the preview build) | Fully-Automated (live OCR text quality: Known-Gap, operator residual R2, stub exists) |
| AC-I6 | Low-confidence rows hold the run; Run checks stays disabled until each is confirmed or fixed | `intake-low-confidence-gate-e2e` | Fully-Automated |
| AC-I7 (web half) | With AI off or no API the whole package flow completes with rule detection only | `intake-no-llm-run-e2e` (zero `/api/ai` and zero `/api/ocr` requests) | Fully-Automated |
| AC-I8 (data half) | Corrected type/role/confirmation is stored with the package and restored after reload | unit `package-store` (restore keeps corrections) ; the user-visible reload proof is Phase 3 `intake-correction-persists-e2e` | Fully-Automated |
| AC-I9 | Baseline role markable, same firm only; another firm's document is never offered or accepted | `intake-baseline-role-same-firm-e2e` (two firms, same text) plus unit `package-store` (store refuses a cross-firm baseline) | Fully-Automated |
| AC8 / AC25 (web) | Same package gives identical analysis; works with no AI | unit `package-view` (analysis equal across two runs) and `intake-no-llm-run-e2e` | Fully-Automated |
| Render-first | Findings render before package analysis; nothing awaits session/Turnstile/memory | unit `package-store` ("findings phase ready before analysis resolved" ordering test) | Fully-Automated |

Phase 2 also guards: existing `upload-firm-tagging`, `upload-limits`, `privacy-notice`, `sample-picker-smoke`, `ingest-all-formats`, `ocr-unavailable`, `scan-set-smoke` specs keep passing unchanged (see Verification Evidence).

## Entry Gate

- Phase 1 VERIFIED (report exists; `packages/core/src/package` exported from `@aduin/core`; `fixtures/package/**` committed; `pnpm --filter @aduin/core test` green).
- Step 0 re-sync inherited from Phase 1 (orchestrator addition A): the parent session's demo-readiness fixes (gate pill, `GateButton.tsx`, `features/gate/gate-pill.ts`, `CompareScreen`, core detector edits, worker seed) are committed and deployed BEFORE Phase 1 starts. `P2_BASE` is recorded as a literal 40-character sha, and the baseline counts below (223 web tests, 173 preview) are re-measured because the parent's fixes change them. If any tracked file is modified at entry, STOP and report; never stash, checkout, reset or restore.
- Baselines recorded before edits (phase report): `pnpm --filter @aduin/web test` (223 tests at f0d924b), `pnpm --filter @aduin/web typecheck`, and the preview e2e count (173 passed plus 1 opt-in skip at f0d924b) is NOT re-run here in full; only the specs named in Verification Evidence run per step, and the full preview run is the Exit Gate.
- Read `process/context/ui/all-ui.md` (testids, no new screens, tokens locked by `tokens-match-mockup`) and `process/context/worker/all-worker.md` (render-first rule).

## Agent rules (every subagent of this phase)

- Never run `git stash`, `git checkout`, `git reset`, `git restore` (shared checkout). Stage explicit paths only (`git add <path>`); never `git add -A` or `git add .`.
- Commit directly on `main` with a conventional prefix (`feat|fix|test|docs|process|chore|refactor`) and end every message with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never edit `README.md`, `docs/README.md`, `docs/architecture/**`, `design/mockups/**`.
- Never touch the owner's protected personal Cloudflare zone named in `CLAUDE.md` Project Rules; no routes or custom domains; Cloudflare resources stay `aduin-transaction-*`.
- Free OpenRouter models only; 0 live model calls are planned in this program (a budget of 6 stays reserved, at most 3 per UTC day); stop on cost above 0, a non-`:free` model, a 429 or an open breaker. Phase 2 e2e runs in the preview build (no Worker): any `/api/ai` or `/api/ocr` call is a defect.
- Never print or commit secrets; never re-put existing secrets. Do not edit `apps/worker/**` (no Worker change in this program).

## Test command rules (read `process/context/tests/all-tests.md`)

- `pnpm --filter <pkg> test <token>` and `pnpm --filter <pkg> test:e2e <token>`; NO `--`; one token per call; an unmatched token must exit 1; confirm more than 0 tests ran.
- Playwright: the `preview` project owns port 4317 and `test-results`; run ONE invocation at a time; never run `preview` and `stack-memory` concurrently. Each one-token `test:e2e` call rebuilds the e2e bundle (3-6 s).
- A bash hook rejects command text containing `build`, `dist` or `node_modules`: run builds only through a script file written to the session scratchpad with the Write tool and executed with `bash <path>`; invoke binaries as `pnpm exec`.
- Render-first: never await session, Turnstile or memory before rendering deterministic findings.

## Touchpoints

Create (web): `apps/web/src/state/package.ts`; `apps/web/src/features/package/{contract.ts,package-view.ts,package-persist.ts}`; `apps/web/src/features/open-document/{PackageConfirmTable.tsx,package-actions.ts,demo-packages.ts}`; `apps/web/src/styles/package-intake.css`; `apps/web/e2e/fixtures/package.ts`.
Modify (web): `apps/web/src/engine/{types.ts,client.ts,engine.worker.ts}`; `apps/web/src/storage/db.ts`; `apps/web/src/state/review.ts`; `apps/web/src/features/open-document/{OpenDocumentDialog.tsx,open-actions.ts,validate-upload.ts,samples.ts}`; `apps/web/test/import-graph.test.ts` (append allow-list names only).
Modify (scripts): `scripts/src/build-samples.ts` (copy package member files, write `apps/web/public/samples/packages.json`).
Create (tests): see Blast Radius.

## Public Contracts

Unchanged: the Worker (`apps/worker/**`, routes, D1 migrations 0001-0005, `wrangler.jsonc`), frozen core contracts v1, `packages/core/src/**` (Phase 1 owns it), `features/registry.ts` (no new routes or sidebar items), `tokens.css` and the mockup tokens, `manifest.json` shape, existing testids.

Changed additively:
- `EngineSettings` (web, `engine/types.ts`) gains `packageDefs?: CrossDocDefinition[]` and `packageFacts?: boolean`.
- `EngineResult` gains `packageFacts?: PrimaryFacts` (present only when `settings.packageFacts` was true).
- `EngineApi` gains `readPackageDoc(input: AnalyzeInput, opts: {name: string}): Promise<ReadPackageDocResponse>` where the response is `{ok: true, facts: PackageFacts}` or `{ok: false, code: string}` (code only, never message or document text).
- `DocMeta` (state/review.ts) gains optional `packageId`; `openDocument` option object gains optional `package: {id: string, defs: CrossDocDefinition[]}`.
- Dexie `AppDb.version(2)` adds table `packages` and an index `packageId` on `documents`; the `version(1)` declaration stays byte-identical; `purgeExpired` also purges `packages` at 24 h.
- `ALLOWED` in `apps/web/test/import-graph.test.ts` gains (append only): `analyzePackage`, `packageRunReadiness`, `packageGateReasons`, `coverageLineText`, `buildDocumentRequests`, `eligibleBaselines`, `detectDocument`, `resolveRoles`, `mergeSuggestion`, `checkPackageLimits`, `definitionSources`, `DEFAULT_PACKAGE_POLICY`, `PACKAGE_LIMITS`, `PACKAGE_DOC_TYPES`, `PACKAGE_DOC_ROLES`, `PackageAnalysisSchema`. Parser-backed names (`buildPackageFacts`, `extractPrimaryFacts`, `applyPackageDefinitions`) stay worker-only.

### FROZEN P2 to P3 CONTRACT (Phase 3 tracks 3a, 3b, 3c import ONLY these; the contract is the one place the three tracks meet)

Files: `apps/web/src/features/package/contract.ts` (types), `apps/web/src/features/package/package-view.ts` (hook and pure builder), `apps/web/src/state/package.ts` (store), `apps/web/e2e/fixtures/package.ts` (Playwright helpers).

1. `usePackageView()` returns `PackageView | null` (S2, replaces the earlier primary-id rule). It is non-null only when a package exists AND `useReview.doc.packageId === package.id` AND the review phase is `ready`, OR while a store-initiated re-open of that same package's primary runs: then the PREVIOUS view stays non-null with `refreshing: true` (stale-while-reopen), so Phase 3 surfaces never flash away. Primary-id equality is NOT the rule: a classic or sample open of the same bytes carries no `packageId` and never shows package UI, and a demo package whose primary is a bundled sample (`sample:NN`) DOES show it. `openSample`, classic `openUpload` and `reopenRecent` without a `packageId` clear `usePackage.current`. It is `null` while a different document loads. It never triggers a network call.
2. `PackageView` fields (all plain data, structured-clone safe): `packageId`; `firmId` (string or null); `firmName`; `fund`; `version`; `documents` (`PackageDocView[]`: id, name, type, role, confidence, reason, confirmed, needsOcr, format, isPrimary, editable (false for the primary); sorted primary first, then by name); `references` (`ExternalReference[]`, document order); `terms` (`CrossDocTerm[]`); `coverage` (`CoverageGroup[]`, fixed order structure_flow, internal_refs, defined_terms, external_refs, investor_paths); `coverageLine` (string from core `coverageLineText`); `coverageStatus` (`full | partial | blocked`, the worst group); `gateReasons` (`PackageGateReason[]`, level `block` or `warn`, from core `packageGateReasons` with `DEFAULT_PACKAGE_POLICY`); `requests` (`DocumentRequest[]`); `baselines` (`{docId, name}[]` documents with role baseline); `refreshing` (boolean: true only while a store-initiated re-open runs, else false). `gateReasons` is the ONLY package gate-reason source for Phase 3 (`useReviewView()` is NOT extended).
3. Store actions (`usePackage.getState()`): `setRole(docId, role)` returns `{ok: true}` or `{ok: false, reason: 'unknown_doc' | 'primary_locked' | 'cross_firm' | 'role_not_allowed'}`; `setType(docId, type)` returns the same shape (reason `primary_locked` for the to-digitize document); `confirmTarget(targetKey, docId | 'none')` returns void; each persists the package row, recomputes the analysis synchronously and, when the change alters the definition sources or the primary, re-opens the primary document through the normal render-first path with `opts.package.reopen: true` (no fresh AI run, no extra allowance; S4) and `refreshing: true` until it settles (findings re-render, triage is kept by document id). `baselineDocs()` returns the `baselines` list. `addEarlierDocument(storedDocId)` (draft stage) refuses cross-firm documents.
4. Display strings owned by core or Phase 2, never re-derived by Phase 3: `coverageLine` and the `PackageGateReason.text`.
5. Test ids frozen by Phase 2 (Phase 3 may rely on them): `upload-input` (now `multiple`), `package-limits-copy`, `package-confirm-table`, `package-row` (attributes `data-doc-id`, `data-confidence`, `data-needs-ocr`), `package-row-type`, `package-row-role`, `package-row-confidence`, `package-row-reason`, `package-row-confirm`, `package-run`, `package-back`, `package-notice`, `package-earlier-list`, `package-earlier-add`, `package-sample-option` (`data-package-id`), `package-recent-option` (`data-package-id`).
6. Playwright helpers in `apps/web/e2e/fixtures/package.ts` (read-only for Phase 3): `uploadPackage(page, files, tag)`, `openDemoPackage(page, id)`, `confirmAllRows(page)`, `runPackage(page)`, `restoreRecentPackage(page, id)`, `waitForChecks(page)`.
7. Phase 3 never edits Phase 2 files. If Phase 3 needs a contract change it stops and reports (`NEEDS_CONTEXT`).

## Blast Radius

Files directly created or modified (exact):

- `apps/web/src/engine/types.ts`, `apps/web/src/engine/client.ts`, `apps/web/src/engine/engine.worker.ts` (modify)
- `apps/web/src/storage/db.ts` (modify: version 2, purge)
- `apps/web/src/state/package.ts` (new), `apps/web/src/state/review.ts` (modify: `DocMeta.packageId`, `openDocument` package option)
- `apps/web/src/features/package/contract.ts`, `package-view.ts`, `package-persist.ts` (new)
- `apps/web/src/features/open-document/OpenDocumentDialog.tsx`, `open-actions.ts`, `validate-upload.ts`, `samples.ts` (modify); `PackageConfirmTable.tsx`, `package-actions.ts`, `demo-packages.ts` (new)
- `apps/web/src/styles/package-intake.css` (new; imported only by `PackageConfirmTable.tsx`)
- `scripts/src/build-samples.ts` (modify)
- `apps/web/test/import-graph.test.ts` (modify: allow-list append)
- Tests (new): `apps/web/test/package-store.test.ts`, `package-view.test.ts`, `package-db-v2.test.ts`, `engine-package-api.test.ts`; `apps/web/src/features/open-document/package-confirm-table.test.tsx` (vitest only collects `test/**/*.test.ts` and `src/**/*.test.{ts,tsx}`, so this component test lives under `src/`, uses `src/test-utils.tsx`, no hex colors per the source guard; S1); `apps/web/e2e/intake-demo-packages.spec.ts` (S5/B); `apps/web/e2e/intake-multi-upload.spec.ts`, `intake-limits-refusal.spec.ts`, `intake-firm-tagging.spec.ts`, `intake-scan-ocr-or-flag.spec.ts`, `intake-low-confidence-gate.spec.ts`, `intake-no-llm-run.spec.ts`, `intake-baseline-role-same-firm.spec.ts`, `intake-no-sub-agreement-held.spec.ts`; `apps/web/e2e/fixtures/package.ts`

Read-only here: `packages/core/**`, `apps/worker/**`, `apps/web/src/features/{structure,counsel,gate,memory,compare}/**`, `apps/web/src/shell/**`, `apps/web/src/features/review/FindingsScreen.tsx` (Phase 3 owns the surfaces), `design/mockups/**`.

## Data Flow

Upload path (N ≥ 2 files or a demo package; the single-file rule is the paragraph after step 5):
1. Dialog validates fields (firm from list or "Other / no firm", fund, privacy ack) and `checkPackageLimits` plus `checkUpload` per file BEFORE any read; any refusal shows `upload-error` and stores nothing.
2. `prepareDraft`: for each file the main thread dispatches by extension (html, docx, pdf directly; images carry no text, so their facts are `needsOcr: true` and detection uses the file name only, `low`); `engine.readPackageDoc` returns `PackageFacts`; sequential light reads (bounded memory, one file at a time); facts cached in memory; `detectDocument` then `resolveRoles`; duplicates by content hash collapse with a `package-notice`. Scan members (S5): a `scan:NN` demo member (and demo `rw-scans`) takes its facts from the PRECOMPUTED OCR, never the network: the light read runs `runOcrQueue` with AI off and no API and feeds an `ocr` kind `AnalyzeInput` to `readPackageDoc`, so type detection sees the scan text. An uploaded image member keeps `needsOcr: true` and detection by file name (`low`); image members are hashed with `sha256Hex` on the main thread so the id equals the later OCR `sourceHash` (E8); `readPackageDoc` never throws (code only). After the primary run, `needsOcr` for every OCR-backed member is set from `result.ocr.pages` (all pages done = false) and `analyzePackage` is recomputed; without this, core `packageGateReasons` would treat the demo subscription agreement as absent.
3. Exactly one document, type `sub_agreement`, `high`: auto-run (no table). Otherwise the confirmation table shows; every `low` row must be confirmed or edited; `package-run` is enabled only when core `packageRunReadiness(docs).ok`. A package with no `sub_agreement` shows the line "No subscription agreement in this package. Checks need one." and keeps Run disabled.
4. `runDraft`: persist the package row and member `documents` rows (bytes; bundled demo members store a `sampleRef` instead), then `useReview.openDocument` for the to-digitize document with `package: {id, defs}` where `defs` are the definitions of `definitionSources(docs)`; the worker applies `applyPackageDefinitions` inside the checks stage before findings are returned, and returns `packageFacts` (only when requested). `analyzePackage` runs on the main thread after `openDocument` resolves (findings are already on screen); `usePackageView` then fills. Persistence is fire-and-forget (E1): `openDocument` starts before or concurrently with the member-byte writes (ids are content hashes, known up front), findings never wait on IndexedDB, and a storage failure stays soft (memory-only package). Package-initiated re-opens (`setRole`, `setType`, `confirmTarget`, `restore`) pass `opts.package.reopen: true`: `review.ts` then skips the fresh AI run that `openDocument` starts for uploads (S4), and exactly ONE AI allowance is counted per package run in the preview stub (same as `openUpload`), never one per re-open.
5. Reload: `package-recent-option` lists stored packages (24 h); `restore(id)` rebuilds docs, facts (`parsedModels` key `pkgfacts:<hash>`, else a fresh light read), corrections and `confirmedTargets`, and re-opens the primary.

**Single-file rule (S3, binding).** N = 1 never blocks closing the dialog and never double-parses. The dialog closes at once and the CLASSIC analyze runs with `packageFacts: true`; type detection runs on the result; only when it is a `sub_agreement` at `high` confidence is a one-document package registered (persisted, `usePackage.current` set, `DocMeta.packageId` attached) AFTER findings render, so coverage appears after findings, never before (no extra light read before the dialog closes). Every other single file stays on the classic path unchanged (no package, no table, `usePackageView()` null). Fallback only if detection from the result proves impractical: keep a light read but record a before/after wall time of the `upload-limits` at-limit spec (it asserts `open-document-dialog` hidden within the default 5 s on a 10 MB file), and any light-read failure on N = 1 goes to the classic path unchanged (corrupt-file and image specs keep their messages).


Failure modes: light-read failure on one member gives a row with type `other`, `low`, reason "This file could not be read." (never document text) and the run is held until the analyst fixes or removes it (removal re-checks readiness); storage unavailable means the package runs in memory only (documents and package row not persisted, restore unavailable); worker `readPackageDoc` returns code-only failures; a superseded run (newer document opened) writes nothing (same `loadSeq` rule as `openDocument`).

## Implementation Checklist

### Step A — Baseline

- [ ] A1. Record `git rev-parse HEAD` as `P2_BASE`, confirm Phase 1 exports exist (`pnpm --filter @aduin/core typecheck` exit 0), run `pnpm --filter @aduin/web test` and `pnpm --filter @aduin/web typecheck` and record counts.

### Step B — Engine contract and worker

- [ ] B1. `engine/types.ts`: add `packageDefs?`, `packageFacts?` to `EngineSettings`; `packageFacts?` to `EngineResult`; `ReadPackageDocResponse`; `readPackageDoc` on `EngineApi` (types from `@aduin/core` as type imports).
- [ ] B2. `engine/engine.worker.ts`: import `buildPackageFacts`, `extractPrimaryFacts`, `applyPackageDefinitions` from `@aduin/core` (worker-only); implement `readPackageDoc` by reusing `readInput` and `checkFormat` (html, docx, pdf, ocr kinds; a PDF with scan pages and no OCR pages returns `needsOcr` facts from its text pages), then `buildPackageFacts`; never throws across Comlink (code-only failure). In `analyze`, inside the checks stage and BEFORE `toView`, `buildAiCandidatesWithSites` and `buildStructureView`: when `settings.packageDefs?.length` run `applyPackageDefinitions(findings, defs)` and keep the filtered list; when `settings.packageFacts` set `result.packageFacts` to `extractPrimaryFacts(g, docHash)` with `suppressed` filled. Without these settings behavior is byte-identical to today (determinism for samples).
- [ ] B3. `engine/client.ts`: add `readPackageDocInWorker(input, opts)`.
- [ ] B4. Unit `engine-package-api.test.ts` (same direct `api` import pattern as `engine-dispatch.test.ts`): `readPackageDoc` on the Phase 1 fixtures returns facts with titleLines and definitions; analyze with the LPA definitions suppresses the offering-noun finding and returns `packageFacts.suppressed`; analyze without settings returns no `packageFacts` and identical findings to a settings-free run; a corrupt file returns a code-only failure.

### Step C — Storage

- [ ] C1. `storage/db.ts`: `version(2).stores({packages: '&id, firmId, createdAt', documents: '&id, createdAt, packageId'})` with `version(1)` untouched; add `StoredPackage` row type (id, firmId, firmName, fund, version, createdAt, primaryDocId, docs[]: id, name, type, role, confidence, reason, confirmed, suggestionSource, needsOcr, format, storedDocId, sampleRef; confirmedTargets); `StoredDocument` gains optional `packageId`; `purgeExpired` adds `packages` to the transaction at 24 h; `appDb()` unchanged.
- [ ] C2. Unit `package-db-v2.test.ts` (fake-indexeddb, node env like `retention-purge.test.ts`): a v1 database with rows opens as v2 with rows intact; package rows purge at the retention boundary; documents with `packageId` purge; decisions and live outbox rows untouched.

### Step D — Store and view

- [ ] D1. `features/package/contract.ts`: all frozen types (see contract above) as TypeScript type declarations only.
- [ ] D2. `features/package/package-persist.ts`: read/write of `packages`, member `documents` rows, `parsedModels` `pkgfacts:` rows; restore reads bytes back.
- [ ] D3. `state/package.ts`: the `usePackage` zustand store with: `draft` (status, rows, tag, earlier candidates, notice), `current`, `facts`, `primary`, `analysis`; actions `prepareDraft`, `setDraftField` (edit sets `confirmed: true`, `suggestionSource: 'analyst'`), `confirmDraftRow`, `removeDraftRow`, `addEarlierToDraft`, `runDraft`, `restore`, `listRecent`, `setRole`, `setType`, `confirmTarget`, `baselineDocs`, `clear`. Rules: to-digitize role only on a `sub_agreement`; `setRole(baseline)` refuses a document whose firm differs from the package firm (`cross_firm`), refuses the primary (`primary_locked`); earlier documents offered by `eligibleBaselines(pkg, candidates)` where candidates are stored `documents` rows of kind `upload` (newest 5) with their `firmId`; a draft or run superseded by a newer document writes nothing.
- [ ] D4. `features/package/package-view.ts`: pure `buildPackageView(...)` plus `usePackageView()`; `use-review-view.ts` is NOT edited (Phase 3 reads `usePackageView().gateReasons` directly; the hook memoizes on store slices because several components call it, E11; when `result.packageFacts` is absent it builds the analysis with `primary: null`).
- [ ] D5. Unit `package-store.test.ts`: limits refusal stores nothing; duplicate collapse; readiness (low rows hold the run; two subs; no sub); role and type guards (`primary_locked`, `cross_firm`, `role_not_allowed`); restore keeps corrections and `confirmedTargets`; render-first ordering (the review phase is `ready` before package analysis resolves); superseded run writes nothing. Unit `package-view.test.ts`: view is `null` for sample opens and the classic path; analysis equal across two builds; gate reasons from policy.
- [ ] D6. `package-store.test.ts` additions: (S3) classic-path corpus guard: every existing e2e upload fixture (fund-I/II/Y, html-seeded, tiny snippets, hostile) is NOT a high-confidence `sub_agreement`, so the classic path is kept; (S4) a package-initiated re-open (`setRole`, `setType`, `confirmTarget`, `restore`) sets `opts.package.reopen: true` and does NOT call the AI lane, and the first package run counts exactly one allowance (assert call counts on the mocked AI lane and allowance stub); (E1) ordering with a never-resolving IndexedDB `put`: the review phase still reaches `ready`; (E10) with AI off the package flow never calls the AI lane. Harness (E9): mock `../src/engine/client` and `../src/features/ai/ai-lane` like `turnstile-no-block.test.ts`, `import 'fake-indexeddb/auto'`.
- [ ] D7. `package-view.test.ts` additions (S2): the view is null when `doc.packageId` differs or is absent (classic and sample opens of identical bytes); non-null for a demo package whose primary is a bundled sample; non-null with `refreshing: true` during a store-initiated re-open; `usePackage.current` cleared by `openSample`, classic `openUpload`, `reopenRecent` without a `packageId`; memoized on store slices (E11).

### Step E — Review wiring

- [ ] E1. `state/review.ts`: `DocMeta.packageId?`; `openDocument` option `package`; pass `packageDefs` (and `packageFacts: true`) into the engine settings for that call only; keep the rest of the flow untouched (render-first, AI lane, memory background). After analysis the store keeps `result.packageFacts` for `usePackage` (read from `useReview` result by `runDraft`).

### Step F — Upload modal and demo packages

- [ ] F1. `validate-upload.ts`: add `checkPackageFiles(files)` wrapping core `checkPackageLimits` and per-file `checkUpload`; add the package limits copy under the NEW testid `package-limits-copy` ("A package takes up to 12 files and 40 MB in total."); leave `limitsCopy()` and testid `limits-copy` untouched.
- [ ] F2. `OpenDocumentDialog.tsx`: the existing `upload-input` gets `multiple`; state moves from one `File` to `File[]`; N = 1 follows the single-file rule in Data Flow (S3: close at once, classic analyze with `packageFacts: true`, register a one-document package after findings render only for a high-confidence `sub_agreement`); N ≥ 2 validates limits first, then `prepareDraft`; step 2 renders `PackageConfirmTable` inside the same modal (`package-back` returns to step 1 and clears the draft); a "Demo packages" list (`package-sample-option`) and a "Recent packages (this browser, 24 h)" list (`package-recent-option`) are added without touching the existing `sample-option` list; existing testids `upload-input`, `open-submit`, `firm-combobox`, `fund-input`, `version-input`, `privacy-ack`, `upload-error`, `limits-copy`, `firm-hint`, `privacy-notice` keep behavior.
- [ ] F3. `PackageConfirmTable.tsx` and `styles/package-intake.css`: one row per file (name, type select, role select, confidence word with an icon, fixed reason text, confirm control); `low` rows carry a "Needs your confirmation" mark that is not colour-only; the earlier same-firm documents list (`package-earlier-list`, newest 5, only via `eligibleBaselines`); "Run checks" (`package-run`); keyboard operable; tokens only (no new colors). Binding (validate E4): the detection reason (it can quote a title) and file names pass through `maskAndClamp` at display; the modal is widened for the table by a modifier class inside `package-intake.css` only (never edit `app-extra.css`, `tokens.css`, `base.css`); no hex colors in `features/**`.
- [ ] F3b. Unit `apps/web/src/features/open-document/package-confirm-table.test.tsx` (S1; path is vitest-collected; `pnpm --filter @aduin/web test package-confirm-table` must run more than 0 tests): fixed reason text shown on every row, low rows carry a non-colour-only mark, selects have accessible names; reasons and file names pass through `maskAndClamp`.
- [ ] F4. `package-actions.ts`, `demo-packages.ts`, `samples.ts`, `open-actions.ts`: demo package loader reads `/samples/packages.json`; `openDemoPackage` fetches member bytes (bundled files, `sample:NN` members from the existing sample files, `scan:09` through the existing scan-set path with its precomputed OCR, member id = the same `sha256` of the joined page hashes used by `review.ts`) and goes through the same `prepareDraft`; `reopenRecent` in `open-actions.ts` restores a package when the document carries a `packageId`.
- [ ] F5. (validate E7: `build-samples.ts` must not exit when `fixtures/package/demo-packages.json` is missing; warn and write an empty `packages.json`; record the sha256 of the gitignored `manifest.json` before and after the edit as proof it is unchanged) `scripts/src/build-samples.ts`: copy `fixtures/package/hartwell/*` to `apps/web/public/samples/packages/hartwell/` and write `apps/web/public/samples/packages.json` from `fixtures/package/demo-packages.json` (resolving `sample:NN` and `scan:NN` members to the generated public paths); `manifest.json` output stays byte-identical to today.
- [ ] F5b. `build-samples.ts` also copies `fixtures/package/design/**` (when present) to `apps/web/public/samples/packages/<id>/` and lists those packages FIRST in `packages.json` (design packages preferred in the Upload modal; Hartwell, ngi and rw-scans follow).

### Step G — Import-graph and e2e helpers

- [ ] G1. Append the allow-list names to `ALLOWED` in `apps/web/test/import-graph.test.ts`; run `pnpm --filter @aduin/web test import-graph` (exit 0).
- [ ] G2. `apps/web/e2e/fixtures/package.ts`: the helper set listed in the frozen contract; reads fixture files from `fixtures/package/hartwell/` and `samples/sub-docs/raw/`.

### Step H — End-to-end specs (preview project; tiny, deterministic; zero network)

- [ ] H1. `intake-multi-upload` (AC-I1): drop the three Hartwell files at once; table shows 3 rows with type, role, confidence and reason; after confirming, Run opens findings for Fund III.
- [ ] H2. `intake-limits-refusal` (AC-I1): 13 files, then over 40 MB total, then one over 10 MB: `upload-error` with plain text, no table, nothing in IndexedDB.
- [ ] H3. `intake-firm-tagging` (AC-I2): alias resolves, free text refused, fund required, "Other / no firm" shows memory not applied; the tag applies to the package (doc switcher shows the firm). Adaptation 5 (validate E5): the existing UI defaults the version label to `v1`; the SPEC says version label required. Resolution: the version label is REQUIRED for N >= 2 (the confirmation table shows it empty and blocks Run until filled), classic single-file keeps the default; asserted in `intake-firm-tagging`; recorded as adaptation 5 in the report.
- [ ] H4. `intake-scan-ocr-or-flag` (AC-I3): demo `rw-scans` opens with precomputed OCR (no `/api/ocr`); an uploaded JPEG member plus an LPA shows "needs OCR" on its row in the preview build (no API) and the primary run keeps working. Members (S5): the uploaded-image case is a JPEG plus an LPA plus a subscription agreement (a JPEG plus an LPA alone has no subscription agreement and cannot show "the primary run keeps working"); the demo `rw-scans` case asserts `needsOcr` is false after the run (set from `result.ocr.pages`).
- [ ] H5. `intake-low-confidence-gate` (AC-I6): two subscription agreements: both rows `low`, `package-run` disabled; editing one row to baseline and confirming the other enables it; a nameless snippet file also lands as `low` (type other).
- [ ] H6. `intake-no-llm-run` (AC-I7, AC25): AI switch off and no API: full package flow completes; zero `/api/ai` and zero `/api/ocr` requests; every rule suggestion is labelled `rule`.
- [ ] H7. `intake-baseline-role-same-firm` (AC-I9): open a single upload under firm A, then start a package under firm B with identical text: `package-earlier-list` for firm B is empty; the same package under firm A lists the earlier document; marking a baseline works only for the offered one.
- [ ] H8. `intake-no-sub-agreement-held`: only an LPA file: line "No subscription agreement in this package. Checks need one.", `package-run` disabled.
- [ ] H9. `intake-demo-packages` (orchestrator addition B): every package listed in the generated `packages.json` (the design packages `northgate-iii`, `lotus-bay-asia-ii`, `redwood-ridge-i` when present, then `hartwell`, `ngi`, `rw-scans`) opens from the Demo packages list in the stated order, shows the confirmation table (or auto-runs), and reaches findings; the three design packages are listed before the synthetic one.

### Step I — Close

- [ ] I1. Run every gate in Verification Evidence, then the full unit suite, typecheck, lint and the FULL preview e2e (one invocation) as the regression proof; write the phase report (commands, counts, adaptations 1-4, frozen contract confirmation, Known-Gaps, backlog stubs).
- [ ] I1b. Per-step extra gates (validate E3; one token per call, each must run more than 0 tests): after F2 run e2e `upload-limits` (record the at-limit wall time before/after), `hostile-html`, `engine-worker-split`, `investor-path-view`, `counsel-sheet`, `memory-prior-answer`, `fund-two-zero-hidden-zero-repeat`; after F3 run `a11y-smoke` and `a11y-keyboard`; after E1 run `turnstile-no-block`, `status-stages`, `perf-budget`. The classic single-file path specs (`upload-firm-tagging`, `upload-limits`, `privacy-notice`, `ingest-all-formats`) are also re-run after F2 (S3).
- [ ] I2. Commit with explicit paths: `feat: package data plane in the engine worker and Dexie v2`, `feat: multi-file upload modal with package confirmation table`, `test: intake upload e2e specs`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm --filter @aduin/web test engine-package-api` | Fully-Automated | AC-I14/15 plumbing; AC8 (no settings = identical output) |
| `pnpm --filter @aduin/web test package-db-v2` | Fully-Automated | L7 24 h purge; additive Dexie v2 |
| `pnpm --filter @aduin/web test package-store` | Fully-Automated | AC-I1 (refusal stores nothing), AC-I6, AC-I8 (data half), AC-I9 guard, render-first |
| `pnpm --filter @aduin/web test package-view` | Fully-Automated | contract shape (doc.packageId rule, `refreshing`, cleared on classic opens); AC8 |
| `pnpm --filter @aduin/web test package-confirm-table` (file `src/features/open-document/package-confirm-table.test.tsx`, must run more than 0 tests) | Fully-Automated | AC-I4 reason shown; AC-I6 (non-colour mark) |
| `pnpm --filter @aduin/web test import-graph` | Fully-Automated | parsing stays in the worker; allow-list |
| `pnpm --filter @aduin/web test:e2e intake-multi-upload` | Fully-Automated | AC-I1 |
| `pnpm --filter @aduin/web test:e2e intake-limits-refusal` | Fully-Automated | AC-I1 |
| `pnpm --filter @aduin/web test:e2e intake-firm-tagging` | Fully-Automated | AC-I2 |
| `pnpm --filter @aduin/web test:e2e intake-scan-ocr-or-flag` | Fully-Automated (live OCR text: Known-Gap, operator residual) | AC-I3 |
| `pnpm --filter @aduin/web test:e2e intake-low-confidence-gate` | Fully-Automated | AC-I6 |
| `pnpm --filter @aduin/web test:e2e intake-no-llm-run` | Fully-Automated | AC-I7 (web half), AC25 |
| `pnpm --filter @aduin/web test:e2e intake-baseline-role-same-firm` | Fully-Automated | AC-I9 |
| `pnpm --filter @aduin/web test:e2e intake-no-sub-agreement-held` | Fully-Automated | AC-I19 user-visible half (no sub agreement) |
| `pnpm --filter @aduin/web test:e2e intake-demo-packages` | Fully-Automated | AC-I1/AC-I3 demo set opens (design packages first) |
| `pnpm --filter @aduin/web test:e2e upload-firm-tagging`, `upload-limits`, `privacy-notice`, `sample-picker-smoke`, `ingest-all-formats`, `ocr-unavailable`, `scan-set-smoke` (one token per call) | Fully-Automated | AC41, AC37, base upload behavior unchanged |
| `git diff --quiet P2_BASE -- apps/worker packages` | Fully-Automated | no Worker, no core change in Phase 2 |
| classic-path corpus guard and `reopen` flag assertions inside `package-store` (D6) | Fully-Automated | S3 classic path kept; S4 no extra AI run or allowance on package re-open |
| `pnpm --filter @aduin/web test`, `pnpm --filter @aduin/scripts test`, `pnpm typecheck`, `pnpm lint`, full `pnpm --filter @aduin/web test:e2e` | Fully-Automated | regression (base AC1-AC64 keep passing) |

## Exit Gate

```bash
pnpm --filter @aduin/web test package-store
# Expected: exit 0, more than 0 tests (repeat one-token calls for each token in the table)
pnpm --filter @aduin/web test:e2e intake-multi-upload
# Expected: exit 0, more than 0 tests ran
pnpm --filter @aduin/web test:e2e
# Expected: all preview specs pass (173 previous plus the new intake specs, 1 opt-in design-probe skip)
git diff --quiet P2_BASE -- apps/worker packages
# Expected: exit 0
```

- All checklist items checked; frozen contract section unchanged since PVL; phase report written; commits with explicit paths.

## Risks and Mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| Header/modal-sensitive existing specs break | Med | New testids only; `limits-copy` and `manifest.json` untouched; existing upload specs re-run per step and in the full run |
| Dexie v2 upgrade loses data | Low | Additive only; migration test with a v1 database |
| Browser memory/time for 12 files / 40 MB | Med | Sequential light reads, up-front refusal, facts cached; AC29 package perf spec is Phase 4 |
| Double parse of a single upload | Low | Removed by the single-file rule (S3: classic analyze first, package registered after findings render); fallback light read is timed |
| Cross-firm baseline leak | High | `eligibleBaselines` only; store guard; e2e with two firms and identical text |
| Render-first regression | High | Ordering unit test; `turnstile-no-block` and `status-stages` specs re-run in the full suite |
| Suppression changes AI input hash on package runs | Low | Samples unaffected; documented |

## Rollback

Revert the phase commits (`git revert <sha>`): the Dexie v2 upgrade is additive and the v1 declaration is untouched, so an older bundle still opens the database. No Worker or D1 change. Generated sample files are gitignored.

## Blockers That Would Justify BLOCKED Status

- Phase 1 not VERIFIED, or a Phase 1 export needed here is missing or shaped differently.
- A change in `apps/worker/**` or `packages/core/**` turns out to be required.
- The frozen contract cannot hold all three Phase 3 tracks without a shared file edit.

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [x] 1. RESEARCH — satisfied by the program-level RESEARCH plus the code reading for this plan; a scoped research pass at phase entry re-reads Phase 1's report for any renamed export
- [x] 2. INNOVATE — satisfied by the program-level INNOVATE (LOCKED); the four adaptations above are recorded, not re-decided
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated with Phase 1 report findings (renamed exports, measured counts); Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md` (Status / Gate / Plan updates applied / Execute-agent instructions / Test gates / High-risk pack / Backlog artifacts / Known gaps / Accepted by)
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", the orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare applied inline)

Signal score 4/7 (S2 storage schema and engine contract, S4, S6 trust boundary of stored documents, S7). Recommended: sequential, ONE opus vc-execute-agent (steps depend on each other: engine types, then store, then modal), then an independent sonnet vc-tester EVL. Parallelism is not recommended: the store, the engine API and the modal all touch the contract that Phase 3 will freeze on. Agent count: 1 execute + 1 tester (+ 1 sonnet vc-code-reviewer pass at EVL for the persistence and cross-firm guard).

## Test Infra Improvement Notes

(none identified yet) — candidates to record at EVL: a reusable Playwright helper to drop N files (added in `e2e/fixtures/package.ts`); the preview rebuild per one-token call (existing backlog).

## Resume and Execution Handoff

- Selected plan file path: `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-2-web-data-plane_PLAN_17-10-26.md`
- Last completed step: not started (plan written; waits for Phase 1)
- Validate-contract status: pending
- Next step: after Phase 1 VERIFIED, re-read the Phase 1 report, run plan-supplement if exports changed, then inner PVL; then spawn vc-execute-agent (opus) with this exact plan path and the validate-contract path, starting at Step A.
- Validators for the plan artifact: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this plan>` and `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <this plan>`.
- Next instruction: ENTER VALIDATE MODE for this plan (after Phase 1), then ENTER EXECUTE MODE only after `Gate: PASS`.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: outer-pvl
supersedes: 2026-10-17 (outer-pvl) — first-pass CONDITIONAL (S1-S5) resolved by PVL supplement cycle 1; this re-validate has current evidence

Parallel strategy: sequential
Rationale: 4/7 signals (S2 storage schema and engine contract, S4 phase program, S6 trust boundary of stored documents and same-firm baselines, S7 more than 5 files); dominant signal S6 plus the single contract seam (engine types, store and modal all touch what Phase 3 freezes on), so steps are strictly dependent. 1 opus vc-execute-agent, then an independent sonnet vc-tester EVL, plus 1 sonnet vc-code-reviewer pass on persistence and the cross-firm guard (3 agents total; no cost guard). Parallel subagents (4 Layer 1 + 5 sections + 3 optional = 12), workflow (4 steps x 1 x 1 = 4) and agent team (3 members x 2 rounds = 6) were scored and rejected: nothing here is independent.

Prior-gap resolution (cycle 2, checked against the plan body and real code):

| Gap | Resolution in body | Real-code check | Result |
|---|---|---|---|
| S1 component test location | Moved to `apps/web/src/features/open-document/package-confirm-table.test.tsx` in Touchpoints, Blast Radius, F3b and Verification Evidence | `apps/web/vite.config.ts` include is `['test/**/*.test.ts', 'src/**/*.test.{ts,tsx}']`; `src/test-utils.tsx` exists | RESOLVED |
| S2 frozen view rule | Contract item 1 rewritten: `doc.packageId === package.id`, `refreshing`, stale-while-reopen, classic opens clear `usePackage.current`; `gateReasons` in `PackageView`; `use-review-view.ts` no longer edited (D4) | `DocMeta` lives in `state/review.ts` (Phase 2-owned); Phase 3 3a-A2 and 3b-B3 read `usePackageView().gateReasons` and `refreshing` | RESOLVED |
| S3 single-file path | Data Flow single-file rule: close at once, classic analyze with `packageFacts: true`, register one-document package after findings only for high `sub_agreement`; fallback timing recorded; corpus guard in D6; classic specs in I1b | `upload-limits`, `ingest-all-formats`, `privacy-notice`, `upload-firm-tagging` specs exist | RESOLVED |
| S4 AI re-run on re-open | `opts.package.reopen` flag in contract item 3, Data Flow step 4, E1, D6 call-count assertions | `review.ts` line 624 `if (ai.fresh && live()) void aiRunFresh()` is the exact site to guard | RESOLVED |
| S5 scan members, H4 | Data Flow step 2 (precomputed OCR through `runOcrQueue`, `needsOcr` from `result.ocr.pages`, image hash equals OCR `sourceHash`); H4 now JPEG plus LPA plus subscription agreement | `readInput` and `checkFormat` anchors exist in `engine.worker.ts` (lines 236-320) | RESOLVED |
| E1-E13 | All folded into the body (E1 fire-and-forget persistence, E3 per-step gates in I1b, E4 mask and widen in F3, E5 adaptation 5 in H3, E7 in F5, E9 and E10 in D6) | every named e2e spec file exists on disk | RESOLVED |

Frozen P2 to P3 contract completeness: PASS. `PackageView` lists packageId, firm, fund, version, documents (editable, isPrimary), references, terms, coverage, coverageLine, coverageStatus, gateReasons, requests, baselines, refreshing. Store action return shapes, frozen testids (15) and Playwright helpers (6) are named. Consistent with Phase 3: 3a-A2 relies on `refreshing`, 3b-B3 on `gateReasons`, Phase 3 read-only list includes `use-review-view.ts` and every Phase 2 file, Phase 3 component tests live under `src/` (S1 hand-off done).

Test gates (C3 5-column table, additive; the legacy line form follows it):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC-I1 | three files dropped at once open the confirmation table; Run opens findings | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-multi-upload` | B |
| AC-I1 | 13 files, over 40 MB total, one file over 10 MB: plain message, no table, nothing in IndexedDB | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-limits-refusal` and `pnpm --filter @aduin/web test package-store` | B |
| AC-I2 | alias resolves, free text refused, fund required, version required for N >= 2, no firm shows memory not applied; tag applies to the package | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-firm-tagging` | B |
| AC-I3 | demo `rw-scans` opens from precomputed OCR with zero `/api/ocr`; uploaded image member shows "needs OCR" and the primary run still works | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-scan-ocr-or-flag` | B |
| AC-I3 | live OCR text quality of a JPEG member in the deployed app | Agent-Probe | operator probe in a real browser (existing backlog residual R2) | D |
| AC-I6 | low rows hold the run; two subs both low; nameless snippet lands as other/low | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-low-confidence-gate` | B |
| AC-I7 (web), AC25 | AI off and no API: whole package flow completes, zero `/api/ai` and `/api/ocr`, rule suggestions labelled rule | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-no-llm-run` and `pnpm --filter @aduin/web test package-store` (AI lane never called with AI off) | B |
| AC-I8 (data) | corrected type/role/confirmation stored and restored with confirmedTargets | Fully-Automated | `pnpm --filter @aduin/web test package-store` | B |
| AC-I9 | baseline same firm only: two firms, identical text; store refuses cross-firm | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-baseline-role-same-firm` and `pnpm --filter @aduin/web test package-store` | B |
| AC-I19 (visible half) | LPA only: "No subscription agreement in this package. Checks need one." and Run disabled | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-no-sub-agreement-held` | B |
| AC8 / AC25 (web) | same package gives identical analysis; view null for classic and sample opens, non-null for demo with sample primary, `refreshing` during re-open | Fully-Automated | `pnpm --filter @aduin/web test package-view` | B |
| Render-first | review phase ready before package analysis and before any package persistence (never-resolving put) resolves; superseded run writes nothing | Fully-Automated | `pnpm --filter @aduin/web test package-store` | B |
| S4 reopen | package-initiated re-open sets `reopen: true`, no AI lane call, one allowance per package run | Fully-Automated | `pnpm --filter @aduin/web test package-store` | B |
| AC8 plumbing | readPackageDoc facts; analyze with LPA defs suppresses offering noun; no settings = identical output; corrupt file code-only failure | Fully-Automated | `pnpm --filter @aduin/web test engine-package-api` | B |
| L7 | Dexie v1 database upgrades to v2 with rows intact; packages and package documents purge at 24 h; decisions and live outbox untouched | Fully-Automated | `pnpm --filter @aduin/web test package-db-v2` | B |
| AC-I4 / AC-I6 UI | reason text shown; low mark not colour-only; masked strings | Fully-Automated | `pnpm --filter @aduin/web test package-confirm-table` | B |
| Demo set | every listed demo package opens, design packages first | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-demo-packages` | B |
| Parsing stays in worker | allow-list append only; no parser import on the main thread | Fully-Automated | `pnpm --filter @aduin/web test import-graph` | A |
| Base upload behavior | existing single-file specs unchanged | Fully-Automated | `pnpm --filter @aduin/web test:e2e <token>` one per call: `upload-firm-tagging`, `upload-limits`, `privacy-notice`, `sample-picker-smoke`, `ingest-all-formats`, `ocr-unavailable`, `scan-set-smoke`, `hostile-html`, `engine-worker-split`, `investor-path-view`, `counsel-sheet`, `memory-prior-answer`, `fund-two-zero-hidden-zero-repeat`, `a11y-smoke`, `a11y-keyboard`, `turnstile-no-block`, `status-stages`, `perf-budget` | A |
| Classic-path guard (S3) | every existing e2e upload fixture is NOT a high-confidence sub agreement | Fully-Automated | `pnpm --filter @aduin/web test package-store` | B |
| No Worker/core change | Phase 2 touches neither | Fully-Automated | `git diff --quiet P2_BASE -- apps/worker packages` | A |
| Regression | base AC1-AC64 keep passing | Fully-Automated | `pnpm --filter @aduin/web test`, `pnpm --filter @aduin/scripts test`, `pnpm typecheck`, `pnpm lint`, full `pnpm --filter @aduin/web test:e2e` (one invocation, port 4317) | A |

Failing stubs (Fully-Automated rows, red-first starting points, not files on disk):
- AC-I1 multi: `test("should open the confirmation table for three files dropped at once", () => { throw new Error("NOT IMPLEMENTED — TDD stub: intake-multi-upload") })`
- AC-I1 refusal: `test("should refuse 13 files, over 40 MB total and one file over 10 MB and store nothing", () => { throw new Error("NOT IMPLEMENTED — TDD stub: intake-limits-refusal") })`
- AC-I2: `test("should resolve aliases, refuse free text, require fund and tag the package", () => { throw new Error("NOT IMPLEMENTED — TDD stub: intake-firm-tagging") })`
- AC-I3: `test("should open rw-scans from precomputed OCR with zero ocr requests and flag an uploaded image member as needs OCR", () => { throw new Error("NOT IMPLEMENTED — TDD stub: intake-scan-ocr-or-flag") })`
- AC-I6: `test("should keep Run checks disabled until every low row is confirmed or fixed", () => { throw new Error("NOT IMPLEMENTED — TDD stub: intake-low-confidence-gate") })`
- AC-I7: `test("should complete the package flow with AI off and no AI or OCR requests", () => { throw new Error("NOT IMPLEMENTED — TDD stub: intake-no-llm-run") })`
- AC-I8 data: `test("should restore corrected type, role and confirmedTargets after reload", () => { throw new Error("NOT IMPLEMENTED — TDD stub: package-store restore") })`
- AC-I9: `test("should never offer or accept a baseline from another firm with identical text", () => { throw new Error("NOT IMPLEMENTED — TDD stub: intake-baseline-role-same-firm") })`
- AC-I19 visible: `test("should hold the run and show the no-subscription-agreement line for an LPA-only package", () => { throw new Error("NOT IMPLEMENTED — TDD stub: intake-no-sub-agreement-held") })`
- AC8: `test("should give identical analysis across two builds and a null view for classic and sample opens", () => { throw new Error("NOT IMPLEMENTED — TDD stub: package-view") })`
- Render-first: `test("should make the review phase ready before package analysis and persistence resolve", () => { throw new Error("NOT IMPLEMENTED — TDD stub: package-store ordering") })`
- S4 reopen: `test("should not start an AI run or count an allowance on a package-initiated re-open", () => { throw new Error("NOT IMPLEMENTED — TDD stub: package-store reopen") })`
- Plumbing: `test("should return facts, suppress the offering noun with LPA defs and stay byte-identical without settings", () => { throw new Error("NOT IMPLEMENTED — TDD stub: engine-package-api") })`
- Dexie v2: `test("should open a v1 database as v2 with rows intact and purge packages at 24 h", () => { throw new Error("NOT IMPLEMENTED — TDD stub: package-db-v2") })`
- Confirm table: `test("should show the fixed reason and a non-colour low mark on every row", () => { throw new Error("NOT IMPLEMENTED — TDD stub: package-confirm-table") })`
- Demo set: `test("should open every listed demo package with design packages first", () => { throw new Error("NOT IMPLEMENTED — TDD stub: intake-demo-packages") })`
- Classic-path guard: `test("should keep the classic path for every existing e2e upload fixture", () => { throw new Error("NOT IMPLEMENTED — TDD stub: classic-path corpus") })`

Legacy line form:
- apps/web engine and storage: [Fully-automated: `pnpm --filter @aduin/web test engine-package-api` and `package-db-v2`]
- apps/web store and view: [Fully-automated: `pnpm --filter @aduin/web test package-store` and `package-view` and `package-confirm-table`]
- apps/web upload flow: [Fully-automated: the nine `pnpm --filter @aduin/web test:e2e intake-*` upload specs, one token per call] | [Fully-automated: eighteen existing specs unchanged]
- scripts samples: [Fully-automated: `pnpm --filter @aduin/scripts test` plus manifest checksum before and after]
- live OCR of a JPEG member: [agent-probe: operator, real browser, residual R2] | [known-gap: documented, backlog stub exists]

Dimension findings:
- Infra fit: PASS — every anchor resolves in real code (`review.ts` openDocument and aiRunFresh site, `engine.worker.ts` readInput/checkFormat, `db.ts` version(1) and purgeExpired transaction, vitest include, test-utils, all named existing specs); Phase 1 files (`packages/core/src/package`, `fixtures/package`) are absent now by design (plan waits for Phase 1 VERIFIED; names are re-read at Step A and E6)
- Test coverage: PASS — every owned AC has a Fully-Automated proof with a one-token command; the component test is vitest-collected; classic-path guard, reopen and never-resolving-put cases are in `package-store`; preview-only vacuity of zero-AI-request is recorded as a named residual
- Breaking changes: PASS — Dexie v2, EngineSettings, EngineResult, EngineApi, DocMeta are additive; N=1 path no longer blocks the dialog or double-parses; frozen view rule is now unambiguous and matches Phase 3
- Security surface: PASS — no network, no Worker, CSP unaffected; cross-firm baseline guarded by core `eligibleBaselines`, store guard and two-firm e2e; light-read failures are code-only; reasons and file names masked and clamped at display; 24 h purge extends to `packages`
- Section A baseline: PASS — P2_BASE literal sha and re-measured counts after the Step 0 re-sync
- Section B engine contract and worker: PASS — no-settings output byte-identical; docx via the existing subpath
- Section C storage: PASS — additive v2, `version(1)` untouched, fake-indexeddb present
- Section D store and view: PASS — S2 contract complete; E1 fire-and-forget persistence specified
- Section E review wiring: PASS — `reopen` flag has a single exact guard site
- Section F upload modal and demo packages: PASS — single-file rule, scan members, widening via `package-intake.css` only, build-samples tolerates missing inputs
- Section G import-graph and helpers: PASS — ALLOWED append only
- Section H e2e specs: PASS — H4 membership fixed; H9 demo order specified
- Blast radius vs registry: PASS — Phase 2 files disjoint from Phases 1, 3, 4; `import-graph.test.ts`, `review.ts`, `engine/*` are Phase 2 only; Phase 3 never edits Phase 2 files

Open gaps: none that require a plan change. Execute-agent instructions E14-E15 are new this cycle.
- Out-of-scope deferrals: none this cycle.
- Live OCR text quality of a JPEG member: known-gap: documented as existing residual R2 — see `process/general-plans/backlog/phase10-*_NOTE_17-10-26.md`

Plan updates applied: none by validate this cycle (the supplement already landed in the body).

Execute-agent instructions (E1-E13 from cycle 1 are now in the plan body and remain binding; new):
- E14 Step D3 and the single-file rule: the plan says `DocMeta.packageId` is attached after findings render for a one-document package, but `review.ts` has no setter. Add one minimal action in `review.ts` (for example `attachPackage(docId, packageId)` that replaces `doc` with a copy carrying `packageId`, only when `get().doc.id === docId` and not superseded), covered by a `package-view` case. Do not change `doc.id` (it is the content hash that triage and memory key on).
- E15 Step A1 and E6: after the Phase 1 report is read, record in the phase report whether any Phase 1 export name differs from the allow-list in Public Contracts; adapt names only. If a shape cannot be absorbed by the frozen contract, stop with NEEDS_CONTEXT (do not edit the frozen contract text).
- Carried (binding, already in body): E1 persistence never awaited before findings render; E2 `eligibleBaselines` before the newest-5 slice and exclude draft members; E3 per-step extra gates one token per call; E8 `readPackageDoc` never throws; E9 harness mocks; E11 memoized view; E12 commit hygiene (explicit paths, no stash/checkout/reset/restore, no Playwright overlap on port 4317).

Test gates run order (after each section; regression suite after all sections):
- B: `pnpm --filter @aduin/web test engine-package-api`; C: `package-db-v2`; D: `package-store`, `package-view`; G1: `import-graph`; F: `package-confirm-table` then the upload specs; H: the nine `intake-*` specs, one token per call; I: full unit, typecheck, lint, scripts test, full preview e2e, `git diff --quiet P2_BASE -- apps/worker packages`.

High-risk pack:
Required: yes (permission/trust-boundary class: cross-firm baseline guard and stored documents; browser schema migration: Dexie v2). Manual-first, not a blocking hook. The program evidence pack is produced in Phase 4 (`harness/phase-4/*.json`); Phase 2 records in its phase report the negative cases (cross-firm refusal in store and e2e, v1 to v2 upgrade, purge boundary, limits refusal stores nothing) as `verification.json` inputs, and the EVL sonnet vc-code-reviewer pass supplies the `review-decision.json` input; `mustStopBeforeFinalize` applies to Phase 4.

Backlog artifacts to create during durable capture:
- `process/features/fund-package-intake/backlog/package-single-upload-light-read_NOTE_17-10-26.md` — only if the S3 fallback light read is used (record measured cost)
- `process/features/fund-package-intake/backlog/package-no-llm-live-proof_NOTE_17-10-26.md` — AC-I7 zero-AI-request proof is vacuous in the preview build; the live stack proof belongs to Phase 4 smoke

Known gaps on record (named residuals, each with an automated gate on everything developed):
- Live OCR text of a JPEG member in the deployed app — operator residual R2 (existing backlog), Agent-Probe row, gap-resolution D, stub exists; the developed behavior (flag, precomputed OCR path) has Fully-Automated gates
- `intake-no-llm-run` cannot observe an AI request in the preview build (API disabled) — named residual; `package-store` asserts the AI lane is never called with AI off; stack-level proof deferred to Phase 4
- Double-parse cost for single uploads — only if the S3 fallback is used; measured in Phase 4 (AC29)

What this coverage does NOT prove:
- `intake-multi-upload` and the unit suites do not prove behavior with real 12-file / 40 MB drops in a real browser (memory and time are Phase 4 AC29), nor any live Worker, Turnstile or D1 path.
- `intake-limits-refusal` proves refusal and an empty IndexedDB, not that a later valid upload still works after a refusal in the same session beyond the specs named.
- `intake-scan-ocr-or-flag` proves precomputed OCR and the needs-OCR flag, not live OCR text quality.
- `intake-no-llm-run` proves no requests in the preview build only; it does not prove the deployed Worker makes zero AI calls for a package.
- `package-db-v2` proves the upgrade in fake-indexeddb, not a real Chromium upgrade with two tabs open.
- `package-view` and `package-store` prove the frozen contract data and the stale-while-reopen rule in jsdom/node, not how Phase 3 surfaces render it; the unit and e2e gates do not prove Phase 3 surfaces (lens, coverage line, gate popover, GP group).
- `import-graph` proves names, not bundle size or main-thread cost of the core barrel.
- Gates cannot run until Phase 1 is VERIFIED (core package module and fixtures are not on disk yet); this contract's anchors on Phase 1 are re-checked at Step A1 and E15.

Gate: PASS (0 FAILs, 0 CONCERNs; S1-S5 and E1-E13 resolved in the body; E14-E15 are execute-agent instructions; the frozen P2 to P3 contract is final as of this validate, any later change needs a supplement and a new PVL)
Accepted by: n/a (PASS; autonomous /goal autopilot, no concerns to accept)
