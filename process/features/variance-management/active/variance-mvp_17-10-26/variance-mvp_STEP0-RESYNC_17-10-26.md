---
name: report:variance-mvp-step0-resync
description: "Variance program Step 0 re-sync with Intake's landed code: per-row status of the umbrella Dependencies on Intake table, seams, collision files, samples/packages answer keys, test counts, working tree, and plan lines that are now wrong"
date: 17-10-26
metadata:
  node_type: memory
  type: report
  feature: variance-management
  phase: step0-resync
---

# Variance Step 0 re-sync with Intake (read-only research)

```yaml
context-envelope:
  feature: variance-management
  phase: RESEARCH
  session-goal: Step 0 inner RESEARCH, re-sync Variance plans with Intake's landed code
  branch: main
  worktree: main
  context-group: engine, ui, worker, tests (routers read)
  blast-radius-packages: packages/core, apps/web, apps/worker, scripts
  active-plan: process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md
  test-runner: vitest | playwright
  validate-contract: per-phase, pending (outer PVL contracts exist per phase; not re-read here)
```

Basis: git HEAD 8a9398c (process closeout), code HEAD a4d7a34 plus Intake Phase 4 test/script commits (c4d68bc..6fb34fb). `git log f791b97..HEAD` = 33 commits, 225 files. Nothing was built or run; every claim is from reading code, `git diff f791b97..HEAD` or `grep`. Items that need a run to prove are marked UNVERIFIED.

## BLUF

- 14 of the 20 umbrella rows are now OBSERVED-IN-CODE as written. 5 are CHANGED (rows 1, 2, 3, 4, 7, plus 14/15 naming) and 1 is STILL-ASSUMED (row 18 behavior, needs a run). Details in section 1.
- Three plan statements are wrong against landed code and must change: (a) Intake did NOT put `pkg`/`pkgGate` in `use-review-view.ts` (the merge is inside `GateButton.tsx`; `use-review-view.ts` only added `unreadable`); (b) `PackageView.baselines` is only `{docId, name}` with no firm, no marked-time, no bytes flag, and baseline bytes have no public accessor; (c) marking a baseline does NOT re-open the primary, so "Variance triggers after `openDocument`" does not fire on a role change.
- No migration, contract, snapshot, Worker route, `law-firms.json`, `computeGate` or `counsel/*` change by Intake. Migration still 0006, `schema_version` 5 to 6; Dexie is now `version(2)`; `hartwell-crane` still absent.
- Core barrel gained `export * from './package/index'` (star). No collision with any planned Variance name (grep found zero hits for all nine names plus `Owner`, `RuleId`, `ChangeClass`).
- `samples/packages/` is committed (c1c5fe0). Package 01 has the same 3 new + 4 logic split as the authored pin, but about 50 raw hunks, not 214. Its firm is "Hartwell & Crane LLP", which is not in `law-firms.json`, and the shipped demo entry tags it firm null (no memory).
- Working tree: only `.DS_Store` and `.playwright-mcp/` are untracked. No `packages/core/test/unit/zz-*.test.ts` exists. No tracked file is dirty.

## Scope and Blast Radius

In scope: Intake's landed diff against the Variance umbrella, 5 phase plans and registry. Out of scope: running anything, editing plans (the orchestrator's PLAN-SUPPLEMENT owns that), `samples/packages/` (design-owned, read-only).

Intake landed (non-process): `packages/core/src/package/**` (16 files), small edits in `detectors/{flow,ref-label-coherence}.ts`, `structure/{headings,conditionals}.ts`, one barrel line; web `state/{package,last-doc}.ts`, `features/{package,open-document,gate,counsel,structure,review}`, `engine/{client,engine.worker,types}.ts`, `storage/db.ts`, `App.tsx`, `shell/{GateButton,DocSwitcher}.tsx`, `features/ai/ai-lane.ts`; scripts `build-samples.ts`, `fixtures/{check,make-package,package-facts-extract}.ts`, `live/smoke-package.ts`; 24 `intake-*` e2e specs. Not touched: `packages/core/src/{counsel,diff,contracts}`, snapshot, `apps/worker/{migrations,src/routes,src/memory}`, `fixtures/memory/law-firms.json`, `scripts/src/fixtures/build-seeded.ts`, `scripts/src/dev-seed.ts`.

## 1. Dependencies on Intake: row by row

Format: row number, verdict, evidence.

| # | Verdict | Evidence and what differs |
|---|---|---|
| 1 | OBSERVED-IN-CODE + CHANGED | `PackageView` has `firmId`, `documents[]` (id, name, type, role, confidence, ...), `baselines: PackageBaselineView[]` (`apps/web/src/features/package/contract.ts:34-61`). `PackageBaselineView` = `{docId, name}` only (contract.ts:34-37). No per-document firm, no created/marked time, no bytes flag, no `roleMarkedAt`. Firm, fund and version exist only per package (`PackageView.firmId`, contract.ts:42). Null rule: non-null only when `phase === 'ready' && doc.packageId === current.id`, or while `refreshing` (`package-view.ts:28-33`). CHANGED: a classic single-file upload that detects as a high-confidence subscription agreement becomes a ONE-document package after findings render (`open-document/open-actions.ts:98-107`, `state/package.ts:798-859`), so the view is non-null there with `baselines: []`. Sample opens clear the package (`open-actions.ts:17`, `:134`), so it is null for samples. The plan's "null for the classic path" is only true for non-sub-agreement uploads. |
| 2 | OBSERVED-IN-CODE + CHANGED | `setRole(docId, role)` returns `{ok:true}` or `{ok:false, reason}` with reasons `unknown_doc`, `primary_locked`, `cross_firm`, `role_not_allowed` (contract.ts:66-70, `state/package.ts:872-888`). `baselineDocs()` exists (package.ts:910-914) sorted by NAME, not by marked time. `addEarlierDocument(storedDocId)` exists (package.ts:651-702) but works on the DRAFT only (before Run) and requires the doc to be in `draft.earlier`; after a run no store API adds an earlier stored document. Only `sub_agreement` type can be baseline (package.ts:679-680, 879); `to_digitize` cannot be set by `setRole` (877). Cross-firm refusal in `setRole` checks only a member whose source carries `firmId` (earlier stored docs); in-package members share the package firm (package.ts:880-884). Core `eligibleBaselines(pkg, candidates)` is exactly as Intake's message says (`packages/core/src/package/baseline.ts:1-25`): same-firm only; candidate with non-null firm differing from `pkg.firmId` rejected; null-firm package sees within-package candidates only; order createdAt desc, name, docId. Plan statement "tie-break roleMarkedAt then createdAt" (P02 B3, line 118) has no data source. |
| 3 | OBSERVED-IN-CODE + CHANGED | 24 h retention OBSERVED (`storage/db.ts:118` `RETENTION_MS`); `documents` rows gain optional `packageId` (db.ts:27); `purgeExpired` covers `packages` (db.ts:123-136); bundled members store `sampleRef` not bytes (`StoredPackageDoc.sampleRef`, db.ts:55). CHANGED/ASSUMED: no `bytesAvailable` concept exists. Member bytes live in a module-private `sources` Map (`state/package.ts:147`, not exported); restore silently omits a non-primary member whose bytes are gone (package.ts:473-498) and returns false only if the PRIMARY is missing (524). `PackageDocument.id` and `PackageBaselineView.docId` are the 64-hex content hash (`core/package/types.ts:29-32`), not a Dexie id. See "Baseline bytes" below. |
| 4 | CHANGED | There is no package-scoped "roles confirmed" event. Upload modal `runDraft` calls `useReview.openDocument` with `package: {id, defs}` (package.ts:442-446). `setRole`/`setType`/`confirmTarget` call `commit`, which re-opens the primary ONLY when `sourceKey(definition sources)` changed (package.ts:530-534; `definitionSources` = role `reference` + type lpa/ppm + not needsOcr, `core/package/terms.ts:186-190`). A baseline role change therefore does NOT re-open and does NOT re-run `openDocument`. Variance must key off `usePackageView().baselines` changes (the store sets `analysis` synchronously in `commit`), not off an open event. |
| 5 | OBSERVED-IN-CODE | Pre-run: confirmation table `open-document/PackageConfirmTable.tsx` (`setDraftField`, :34). Post-run: Structure screen Package lens `features/package/PackageDocuments.tsx:55` calls `setRole`. Baseline is never auto-assigned (`resolveRoles` gives sub agreements `to_digitize`, low confidence when two: `core/package/detect.ts:259-261`). |
| 6 | OBSERVED-IN-CODE | Browser-only persistence: Dexie `packages` table (db.ts:97, 111-114). No D1 migration, no Worker route (`git diff --stat` shows no worker memory/migration change). |
| 7 | CHANGED (location of the merge) | Core `computeGate` untouched (`counsel/gate.ts:43`, still 3 args, `ComputeGate` type `counsel/types.ts:39`). The merge is NOT in `use-review-view.ts`. Landed: `use-review-view.ts:38` returns `gate: { ...computeGate(rows), unreadable: hasNoText(result) }` and nothing about packages; `shell/GateButton.tsx` calls `usePackageView()`, builds `merged = {...gate, status: blocked if core blocked or any package `block` reason, reasons: [...gate.reasons, ...pkgBlocks]}`, passes it to `gatePillView`, renders `GateReasons`, then `PackageGateReasons`, then `CoverageLine` (GateButton diff). `GatePillState` gained `'unreadable'` (`gate/gate-pill.ts`). The "2400-cell matrix" is now 2406 cells (Intake report: `gate-state-matrix` 2406). |
| 8 | OBSERVED-IN-CODE (still ABSENT) | `fixtures/memory/law-firms.json` has 3 firms (partners-group, firm-x, firm-y); `hartwell-crane` absent. Intake's `hartwell` demo package is tagged `firm-x` (`fixtures/package/demo-packages.json`). The three design packages (northgate, lotus-bay, redwood) are tagged `firmId: null`. |
| 9 | OBSERVED-IN-CODE | `apps/worker/migrations/` = 0001..0005; `migrations/0005_...sql:55` sets `schema_version` '5'; `scripts/src/dev-seed.ts:27` `EXPECTED_MIGRATIONS` = 0001..0005. Intake added no migration. Expected 0006 / schema 5 to 6 stands. |
| 10 | OBSERVED-IN-CODE | Dexie `version(2)` (db.ts:111): `packages: '&id, firmId, createdAt'`, `documents: '&id, createdAt, packageId'`. `uiState '&key'` still exists and is not purged; Intake uses key `session:lastDoc` (`state/last-doc.ts:9`), so Variance keys must be namespaced to avoid it. No bump needed by Variance. |
| 11 | OBSERVED-IN-CODE | `<GpRequestGroup />` at `features/counsel/CounselScreen.tsx:271`, inside the non-empty branch directly above `<ul className="rows" data-testid="counsel-list">`; own export `exportRequestDocx.ts`. Plan reconciliation rule fits. |
| 12 | OBSERVED-IN-CODE | `DocMeta.packageId?` and `OpenPackageOption {id, defs, reopen?}` in `state/review.ts` (diff); `openDocument` option `package`/`packageFacts`; one `result` for the primary; `attachPackage(docId, packageId)` added (not in the plan). `doc.id` stays the content hash. |
| 13 | OBSERVED-IN-CODE | Intake allows several baseline-role documents; `setRole` has no uniqueness rule; `baselineDocs()` is name-sorted. Variance's one-baseline tie-break is Variance-owned and has no "marked time" input (see row 2). |
| 14 | OBSERVED-IN-CODE + NAME CHANGED | Hartwell set is `fixtures/package/hartwell/{fund-iii-subscription-agreement.html, northgate-lpa-definitions.docx, fund-ii-subscription-agreement-prior.html}`, firm-x. Built by `scripts/src/fixtures/make-package.ts` (the plan says `build-package.ts`, which does not exist). Intake pins live in `fixtures/package/expected.json`. Separate-corpus decision still holds. |
| 15 | CHANGED | Intake did NOT touch `scripts/src/fixtures/build-seeded.ts`. It extended `scripts/src/fixtures/check.ts` (+41 lines: imports `buildPackageFixtures`, `PACKAGE_DIR`, `REAL_FACTS_KEYS` from `make-package`; `walkPkg` stray scan; ends just before the `if (problems.length)` block). New files `make-package.ts`, `package-facts-extract.ts`. P01 H2's additive `fixtures/variance` scan rebases onto this. |
| 16 | CHANGED (star export) | Barrel now ends `export * from './package/index';` (`packages/core/src/index.ts:172`). Intake did NOT append to `ALLOWED` as "a long list" only: it added 18 names (`import-graph.test.ts` diff: analyzePackage, packageRunReadiness, packageGateReasons, coverageLineText, buildDocumentRequests, eligibleBaselines, detectDocument, resolveRoles, mergeSuggestion, checkPackageLimits, definitionSources, DEFAULT_PACKAGE_POLICY, PACKAGE_LIMITS, PACKAGE_DOC_TYPES, PACKAGE_DOC_ROLES, PackageAnalysisSchema, PackageDocumentSchema, PackageFactsSchema). Contracts snapshot `packages/core/test/__snapshots__/contracts.json-schema.snap` has no diff. |
| 17 | OBSERVED-IN-CODE | `README.md` (+14) and `docs/architecture/status.md`, `docs/walkthrough/demo-walkthrough.vi.md` WERE edited by Intake/closeout commits after the goal block (commit 57043fc "update status, walkthrough, README"). The "Intake may not edit README/docs" premise is superseded; Variance's own "leave docs to a handoff note" rule is a Variance decision and unaffected. |
| 18 | STILL-ASSUMED (behavior) | Nothing runs without a run. Code-level facts: Intake e2e specs that mark a baseline use `confirmAllRows` (checks boxes only; role select is separate) and the `hartwell`/design demo packages carry a baseline, so a Variance pass WILL trigger on them once Variance exists. Which `intake-*` specs would change is UNVERIFIED. |
| 19 | OBSERVED-IN-CODE | `scripts/src/live/smoke-package.ts` exists (383 lines). Live Worker version `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f` (static assets only; Worker code 994ea54 unchanged; rollback chain `3d2c7301 -> cde74507 -> 328ca295 -> 09e7a579 -> 47d98295 -> 23612b12`; `all-context.md`, Intake report line 29). The rollback target the plan said to read is therefore 3d2c7301. |
| 20 | OBSERVED-IN-CODE | `samples/packages/` committed (c1c5fe0; 57043fc edited README/answer-key 01). 01 northgate, 02 lotus-bay, 03 redwood, each with README, answer-key, `_build`, `docs/*.docx`. Intake copied the DOCX into `fixtures/package/design/<id>/` with `checksums.json` and builds them into `public/samples/packages/` (`build-samples.ts` `buildPackages`). |

### Exact names and signatures of baseline role data

- Read: `usePackageView(): PackageView | null` (`package-view.ts:90`); `PackageView.baselines: {docId: string; name: string}[]` (documents with role `baseline`, in document order = primary first then by name, `package-view.ts:82-86`). Per doc: `PackageDocView {id, name, type, role, confidence, reason, confirmed, needsOcr, format, isPrimary, editable}`. Package: `{packageId, firmId, firmName, fund, version, ...}`.
- Write: `usePackage.getState().setRole(docId, 'baseline'|'reference'): PackageActionResult`; `setType`; `confirmTarget`.
- Store (non-view): `usePackage.getState().current: CurrentPackage {id, tag, docs: PackageDocument[], primaryDocId, confirmedTargets, createdAt}`; `createdAt` is the PACKAGE run time, not per document.
- Firm of a baseline: not exposed per doc; it equals `PackageView.firmId` for in-package docs. `StoredDocument.firmId` (Dexie `documents`) exists for stored uploads.
- Time: no role-marked time anywhere. Available: `CurrentPackage.createdAt` (package), `StoredDocument.createdAt` (stored upload, via `readUpload`/`listUploads`).
- Bytes availability: not exposed. Paths that exist: (1) `readPackage(packageId)` gives `StoredPackage.docs[]` with `storedDocId` or `sampleRef` (`package-persist.ts`, exported); (2) `readMemberBytes(storedDocId)` (package-persist.ts:154) reads Dexie `documents.bytes` (null when purged); (3) bundled members need a fetch of `sampleRef` and the safe-ref rule: `fetchBundled` and `safeSampleRef` logic exist but `fetchBundled` is module-private (`state/package.ts:936`), `safeSampleRef` is exported (package-persist.ts:32). The `sources` Map has no accessor.
- sampleRef key scheme (from `open-document/package-actions.ts:28-57`, `package-persist.ts:31-41`, `db.ts:55`): demo file member = public URL `/samples/packages/<pkgid>/<file>` (no sampleId); bundled HTML sample member = bare `NN-name.htm` (with sampleId `NN`); scan = `scan:NN`; uploads have NO sampleRef and use `storedDocId` = `pd_<pkgId[4:16]>_<contentHash[0:16]>` (package.ts:337-339), or the original upload id for an earlier stored doc.
- Post-run stored-earlier candidates: `listUploads(limit, firmId)` (package-persist.ts:184-200) returns same-firm OR null-firm uploads (note it admits `firmId === null` rows); `earlierFor` (state/package.ts:342) is private and draft-only.
- Engine side: `readPackageDocInWorker` returns only light `PackageFacts` (title lines, head text, headings, definitions, hash), NOT text or structure; `diffDocuments` (existing Phase 07 path) is the only existing two-document analyze API in the engine.

## 2. Seams and contract state

- Migration: still 0006 and `schema_version` 5 to 6 (rows 9, above). Pin sites to move together (unchanged since the plan): `scripts/src/dev-seed.ts:27`, `apps/worker/src/memory/health.ts`, worker `memory-endpoint-contract.test.ts`, `apps/web/e2e/stack-memory-smoke.spec.ts` (not re-read line by line here).
- Dexie: `version(2)` (rows 10).
- Barrel: mixed. Existing groups use named and star exports (`export * from './memory/index'`, `'./llm/index'`, `'./diff/index'`, `'./package/index'`); a named explicit list for `./variance/index` is consistent and cannot collide. Grep over `packages/core/src apps/web/src apps/worker/src` for `normalizeAssertionLabel|questionKey|parseQuestionKey|runVariance|varianceMetaOf|loadVarianceRules|runRegressionChecks|describeAssertion|assertionCandidateOf|VarianceResult|CosmeticGroup|RegressionCheck|RuleId|ChangeClass|Owner`: zero hits. `version_drift` appears only as a taxonomy entry and in `issue-classes.ts` (still emitted by nothing).
- Gate: core `computeGate = (findings, states, labels)`, no policy param (`counsel/gate.ts:43`, `counsel/types.ts:39`). Web `model.ts:113` `computeGate(rows): GateResult` wraps `gateInterim` = core `computeGate`. Merged gate shape in `GateButton.tsx` is shown in row 7. `GateResult` carries an optional `unreadable` after `use-review-view.ts:38`.
- `import-graph.test.ts` `ALLOWED` (starts line 10): original list plus the 18 Intake names above.
- Contracts snapshot: unchanged (no diff); `contracts` core token count 34 (Intake report).

## 3. Collision files per phase

Intake's change, then whether the plan touchpoint is still accurate.

**P01 (core)**: `counsel/{gate,sheet,types}.ts`: NO Intake change, plan accurate. `index.ts`: Intake appended a star export; plan's explicit named list is accurate. `scripts/src/fixtures/check.ts`: Intake extended it; the additive `fixtures/variance` scan must slot before the final `if (problems.length)` (check.ts ~line 168); `build-seeded.ts`: unchanged by Intake and still exports `DIFF_DIR`, `SEEDED_DIR` used by check.ts. `law-firms.json`: unchanged. Also relevant, not in the registry: Intake edited `structure/headings.ts` (+53: `Section 4.`, `Article I.` forms), `structure/conditionals.ts` (+16: Annex/Question targets), `detectors/flow.ts` (+113), `ref-label-coherence.ts`. Variance's hunker uses `buildUnits` keys from `diff/` and impact uses `Structure.conditionals`; both sit downstream of those two structure edits. UNVERIFIED: whether the real-sample #5/#6 unit keys moved (Intake reports `golden-05-06-drift` green, which the P01 regression block also runs).

**P02 (web findings)**: `state/review.ts` (+84): added `package` open option, `attachPackage`, `saveLastDoc`, `keepAi` logic. Gate call sites moved: `gateLine` was ~507, now line 537-541; dismiss `computeGate` (`left`) was ~697, now 757; dismiss toast ~699, now 759; dismiss next-selection (`before`/`after`/`next`) was ~680 and ~692, now about 735 and 749-755. P02 lines 75 and 125 quote the old numbers. These call sites still use the PLAIN web `computeGate`: they ignore both package block reasons and `unreadable` (Intake did not route them through the merged gate). `use-review-view.ts`: see row 7 (no `pkg`/`pkgGate`). `FindingsScreen.tsx`: Intake added `<CoverageLine placement="header" />` inside the header block after the `findings-meta` paragraph and before `<StageStatus />` is a sibling (FindingsScreen diff); P02's baseline control and `All / Errors / Changes` segment must coexist with it. `features/review/model.ts`: Intake added `NO_TEXT_MESSAGE`, `hasNoText` only; `computeGate(rows)` unchanged. `shell/GateButton.tsx`: merged gate (row 7). `engine/{types,client,engine.worker}.ts`: Intake added `packageDefs`, `packageFacts`, `readPackageDoc` (additive; Variance's `runVariance` is a further additive method). `no-e2e-hook-in-dist` and `e2e-hook.ts`: not modified by Intake.

**P03 (memory backend)**: no Intake change in `contracts/memory.ts`, snapshot, `routes/memory/*`, `memory/repo/*`, `api/*`, migrations, `law-firms.json`, `seed/demo.sql`. Plan accurate. (Intake did touch `apps/worker/src/proxy/pipeline.ts`, `upstream/openrouter.ts` and three proxy tests: not P03 files.)

**P04 (owners/answers)**: `features/counsel/CounselScreen.tsx` +2 lines (import and `<GpRequestGroup />` at :271; `<h1 id="h-counsel">` at :160 is unchanged, so "h1 becomes Questions" stands). `features/registry.ts`: unchanged; two `id: 'counsel'` rows at :29 and :75, plan accurate. `GateButton.tsx` ordering as P04 Step 0 (b) describes, with the extra `merged.reasons.length` badge. `features/gate/GateReasons.tsx`: not modified; Intake added `PackageGateReasons.tsx`, `CoverageLine.tsx`. `ExportDialog.tsx`, `ai-draft.ts`: not modified by Intake.

**P05 (demo/deploy)**: `scripts/src/build-samples.ts` guard `expected 12 HTML samples` is now at line 214 (plan says line 169). Intake added `buildPackages()` AFTER the manifest write and writes `public/samples/packages.json` plus copies under `public/samples/packages/<id>/`; `manifest.json` is unchanged, so `sample-picker-smoke` `toHaveCount(13)` at `e2e/sample-picker-smoke.spec.ts:35` is still correct and the H&C-entries-in-manifest plan stays valid. Intake's `PACKAGE_TAGS` and demo ids (`northgate-iii`, `lotus-bay-asia-ii`, `redwood-ridge-i`, `hartwell`, `ngi`, `rw-scans`, `blackstone-appendix`) occupy the package list namespace; Variance sample ids like `vh-fund-II` are in a different list. `law-firms.json` ids: `hartwell-crane` still absent. Intake tagged its `hartwell` package to `firm-x`: confirmed.

Other Intake-touched files the registry does not list and Variance may meet: `state/last-doc.ts`, `App.tsx` (restore on start; reopens the last document and its package), `DocSwitcher.tsx` (+13), `features/ai/ai-lane.ts` (`aiHolds`, `aiReopen`, `emit`, `shown`), `StageStatus.tsx`, `styles/base.css`, `components/ui/popover.tsx`, and the Dexie `documents` index.

## 4. samples/packages

Read: `samples/packages/README.md` and the three `answer-key.md`. Package ids and firms:

| Pkg | Fund / firm in README | Baseline | Demo entry firm tag | Variance expectations |
|---|---|---|---|---|
| 01 northgate | Northgate Infrastructure Fund III; firm Hartwell & Crane LLP (README:15) | `04-NG2-Subscription-Agreement-2024.docx` (Fund II, same template, differs by exactly 7 items plus cosmetics) | `firmId: null` in `demo-packages.json` | answer-key section B |
| 02 lotus-bay | Lotus Bay Asia Growth Fund II (firm name not matched to law-firms.json) | `04-LB2-...-v1-draft.docx` (prior draft of same fund) | null | answer-key V1..V7 |
| 03 redwood | Redwood Ridge Credit I; firm Sutter Lane & Abernathy (new firm) | none | null | no-baseline case (AC-V8, README P5) |

**Package 01 raw and class expectations (answer-key section B, lines 27-43):** "about 60 differing paragraphs and about 50 token-level hunks, of which 7 are meaningful"; 7 shown = 3 `new` + 4 `changed_logic`; remaining about 43 cosmetic and hidden (fund name and GP name, roman numeral, "Interests" vs "Units", address Suite 1400 vs 1200, first closing/PPM/LPA dates, Annex C labels `C.3`/`C.4` vs `C-3`/`C-4`, wire beneficiary account name). The authored pin is 214 raw / 207 cosmetic in 5 groups; package 01 would not reproduce those numbers (about 50 raw, cosmetic group count not pinned by the key).

| Key row | Location | Class | Owner in key | Plan owner for same item |
|---|---|---|---|---|
| V1 | new 7A Source of Funds Verification | new | Fund admin | 7A fund admin (match) |
| V2 | 4.3 table row Singapore | new | GP + counsel (two questions) | Singapore GP+counsel (match) |
| V3 | new 10.4 Sanctions | new | Counsel | sanctions counsel (match) |
| V4 | 4.2 Beneficial Owners, 7 added words | changed_logic | Counsel | 4.2 counsel (match) |
| V5 | 1.2 minimum Capital Commitment $5,000,000 vs $2,500,000 | changed_logic | GP | Class A minimum GP (match) |
| V6 | 6.2 Tax Status "(select all that apply)" vs "(check one)" | changed_logic | Counsel | tax status counsel (match) |
| V7 | 6.1 Investor Type rows Revocable/Irrevocable trust vs single Trust | changed_logic | **Counsel** | **trust split GP** (SPEC A9 line 288, DECISION line 174): MISMATCH |

Impact expectations in the key (AC-V10): V4 affects non-US entity investors and removes the question for US entities; V7 affects trust investors; V2 affects the Singapore investor; V1 affects every investor with commitment at least $1,000,000. The key's package-level section C lists a "Variance group: full with 04" coverage row, but Intake's coverage groups are fixed at five (`structure_flow, internal_refs, defined_terms, external_refs, investor_paths`, `core/package/policy.ts`) and none uses the baseline: that key row has no landed counterpart.

Package 02 (answer-key lines 31-43): V1 Vietnam added (new), V2 minimum US$5,000,000 to US$3,000,000 (amount), V3 PEP questionnaire added (new), V4 escrow 25% to 30% (percent), V5 renumbering of sections 13/14 (cosmetic if mapped), V6 "shall not" to "shall" (negation, meaning change), V7 cosmetic edits. The key states the classification it expects but not counts, and says "Variance should classify V1 to V4 and V5 as intended or structural changes and surface V6 as meaning-changing", i.e. its taxonomy is intended/structural/unintended, not new/changed_logic/changed_cosmetic.

Package 03: no variance rows; the README's P5 line expects the muted no-baseline line, empty Changes filter and Errors-only view (AC-V8, L10).

Evidence for the choice (observations only; the selection belongs to INNOVATE, which is inner-loop step 2):
- Authored corpus: engine-independent, deterministic builder, exact 214/207/5-group pin, includes Fund I/II/III for the R-01 chain, firm `hartwell-crane` is Variance-owned. The Appendix C removal that feeds R-01 is NOT in package 01's key (V1..V7 contain no appendix removal; D6 Annex F is a missing-document item, not a variance row).
- Package 01: real DOCX through the shipped DOCX adapter, already in the demo list (as firm null), committed answer key with owners and impact, same 3+4 split. Counts differ (about 50 raw). Unverified without a run: whether V2 (a table row) is classified `new` by the planned unit rule (whole unit added or a pure insertion of at least 12 words), and whether the V6 and V7 table/option edits cluster into separate change rows. DOCX table handling of the engine on package 01 has no measured variance output.
- Using package 01 for memory/owner/R-01 flows needs a firm: its demo entry is `firmId: null` (memory not applied), and `hartwell-crane` does not exist until P03. Package 02's prior-draft baseline is the same fund, same version label differs; its answer-key owners are not stated.

What Phase 01 would need to change in either case (facts): (1) the plan's `variance-demo-count` pin of 214/7/207 stays valid only for the authored corpus; (2) a package-01 test would pin 7 shown (3 new + 4 logic) and a hand-pinned raw count from a run, not the key's "about 50"; (3) V7's owner expectation conflicts with the plan's routing table (GP vs Counsel); (4) any package-01 test must read `fixtures/package/design/northgate-iii/*.docx` (already copied with checksums) rather than `samples/packages/` (read-only design folder), because `fixtures:check` already guards the former.

**AC-V* mapping of the answer keys to plan tests (rows present in keys):**
- AC-V2 (class evidence): keys 01 V1-V7 all rows; plan test `variance-classification-contract`.
- AC-V5 (recall on seeded new/logic): 01 V1-V7 mark each `new`/`changed_logic`; plan `variance-seeded-recall-matrix` (authored corpus) has no package-01 equivalent yet.
- AC-V10 (impact): 01 V1, V2, V4, V7 impact lines; plan `variance-impact-demo-4-2` (4.2 case only).
- AC-V11 (routing): 01 owners for V1-V7; plan `variance-routing-table-matrix` (7 cases; V7 conflict above).
- AC-V12 (two owners, two questions): 01 V2; plan `variance-question-key-matrix`, `variance-two-owner-two-questions`.
- AC-V8 (no baseline): 03 P5 row; plan `variance-no-baseline-errors-only`.
- AC-V4: 01 key says "7 shown (3 new, 4 changed_logic)"; the plan's `variance-demo-count` pins 214.
- AC-V6, V7 (real pair #5/#6), V9, V13-V20: no answer-key rows.

## 5. Test counts and commands

Confirmed from `process/context/tests/all-tests.md:286-294` and the Intake report (line 33-41): core 3084 (+3 skip), web unit 298, preview e2e 217 (+1 opt-in skip), stack-memory 11, worker 526, scripts 162, contracts 34. I did not run any suite, so these are documented numbers, not re-measured.

Rules in force: no `--` token; one token per call; an unmatched token must exit 1; serial Playwright on port 4317 (stack-memory 8788/8788 separate, never together); `intake-demo-packages` is load-sensitive with a 30 s wait; each one-token e2e call rebuilds the preview. Hook filter: the kit's scout-block hook rejects any Bash command containing the substrings for the production output directory or the installed-packages directory (it blocked my own `grep` once). Existing precedent: the token `no-e2e-hook-in-d`. New Intake web unit tokens: `package-store package-view package-db-v2 engine-package-api package-confirm-table package-lens package-gate-ui gp-request-group request-export-contents restore-last-doc`. The Intake smoke script exits 1 on third-party Turnstile iframe console noise (stub `intake-live-smoke-turnstile-console`). Both Variance `variance-*` token lists contain no filtered substring (the P01/P05 gate loops use words like `variance-demo-214-to-7`); none was found to contain the filtered words in the P01 and P05 loops I read, but P02-P04 loops were not scanned token by token. All-tests.md lines 151-160 still contain stale template rows (`packages/api`, bun test); not Variance-relevant.

## 6. Working tree

`git status --short`: `?? .DS_Store`, `?? .playwright-mcp/` only. `.playwright-mcp/` holds one file `console-2026-10-17T12-35-13-113Z.log` (7 KB, created 19:37), a Playwright MCP session console dump from tooling, not from Intake or Variance code; it is not gitignored. `.DS_Store` is macOS metadata, not gitignored. `ls packages/core/test/unit | grep zz` returns nothing: no `zz-*.test.ts` exists. `git status --ignored` shows only build and dependency output as ignored (apps/web dist, node_modules, public samples/firms.json, `.wrangler`, `.vibecode-backup`, hook logs). The registry's "Currently observed concurrent Intake edits" list (GateButton, gate-pill, seed demo.sql, ...) is no longer dirty: all are committed. `apps/worker/seed/demo.sql` has no diff in `f791b97..HEAD` (the registry assumed it was being modified by another stream). Variance EXECUTE must not touch `.playwright-mcp/` or `.DS_Store`.

## 7. Plan lines now wrong or impossible (per phase)

Umbrella (`variance-mvp-umbrella_PLAN_17-10-26.md`):
- L16, L34, L52-54, L194-197: "EXECUTE held, Intake has no code" and the observation basis (HEAD 025d589, Dexie v1, 3 firms) are stale; Intake is closed (8a9398c, live 3d2c7301).
- L30 and L219 (row 20): "samples/packages not yet on disk / OBSERVED-IN-MESSAGE" is now committed (c1c5fe0).
- L207 (row 7): the `use-review-view.ts exposes pkg and pkgGate` claim is false; merge is in `GateButton.tsx`.
- L201 (row 1): `baselines` has no firm/time/bytes; "null for classic path" no longer holds for single-file sub agreements.
- L204 (row 4): "setRole re-opens the primary" holds only when definition sources change.
- L214 (row 14): `build-package.ts` is `make-package.ts`.
- L215 (row 15): `build-seeded.ts` was not touched; only `check.ts` was extended.
- L216 (row 16): barrel is a star export; ALLOWED got 18 names, snapshot untouched (consistent with plan).
- L217 (row 17): Intake-era edits to README/docs landed (57043fc).
- L220 (row 19): rollback target is now 3d2c7301 (not 23612b12).

P01: L44 (a)(b) `build-package.ts` -> `make-package.ts`; "Intake extends check.ts" is landed; L46 (c) is no longer a conditional (committed); L163 H1 comment about Intake's star line is correct; L134 D1 Cover/header and L141 E1 impact: confirm against the heading/conditional changes (UNVERIFIED); gate matrix is 2406 cells not 2400 (L102, L178, L156 wording "2400"). L164 H2 still right (`build-seeded.ts` untouched).

P02: L39 (a): `usePackageView` null conditions (classic path now non-null for single sub agreements); `setRole` re-open claim; `addEarlierDocument` described as usable for baselines, but it is draft-only. L67/L116 B1: `listBaselineCandidates`, `bytesAvailable` have no Intake source (bytes accessor absent); L118 B3 tie-break on `roleMarkedAt` has no data. L75 and L125 C2b: line numbers 507/680/692/697 are now 537/~735/~749/757 and the call sites ignore package block reasons and `unreadable`. L82 (use-review-view merge) wrong; L76: `computeGate` called with variance policy must keep `unreadable` (spread, as `use-review-view.ts:38`). L139 E1: "same-firm earlier documents whose text is in the browser" must be built from `listUploads` + `eligibleBaselines` (exported) because `earlierFor` is private and draft-only. L146 F2 `GateButton.tsx` pending display: edit must preserve the `merged` object and the three-section render.

P03: L33/L89 firm addition stands; no Intake overlap (Step 0 c, d are clean). `schema_version` pin sites unchanged. No text needs to change except marking rows observed.

P04: L39 (a) accurate (GpRequestGroup placement and independence); L39 (b) accurate; add that `GateButton.tsx` badge uses `merged.reasons.length`. L121 C2 accurate (two registry rows at :29 and :75; `h1` at CounselScreen:160).

P05: L40 (a) rollback id stale (`23612b12` -> `3d2c7301`; live D1 migration state 0001-0005 per context); L40 (e), registry "Phase 5 revision": guard line 169 -> 214; `build-samples.ts` Intake diff is additive after the manifest write; L72 `samples/packages` "not committed" is stale; L68-70 table: packages 01-03 are already Intake demo packages with `firmId: null`, so a Variance pass in them has no firm and no memory; L108 `toHaveCount(13)` at spec line 35 still true; Intake's `smoke-package.ts` exists for `live/common.ts` reuse.

Registry (`phase-blast-radius-registry.md`): L30 ("NOT touched by Intake: core computeGate... law-firms.json") confirmed; L75 "currently observed concurrent Intake edits" is obsolete (committed); L62-63 probe naming unchanged; L33-34 collision list lacks `state/last-doc.ts`, `App.tsx`, `features/ai/ai-lane.ts`, `scripts/src/build-samples.ts` (named later), `engine/*` (named).

## Key Facts (non-obvious)

- Baseline bytes and per-baseline firm/time are not in any exported Intake interface. Variance's single coupling file would need either an additive export on `state/package.ts` (an Intake-owned, now closed file) or its own use of `readPackage`/`readMemberBytes`/`listUploads`/`safeSampleRef` plus its own bundled fetch. Which one is chosen is a design decision (INNOVATE).
- A baseline-role change triggers no re-open, so `PackageView` changes (zustand `analysis` set in `commit`) are the only signal.
- Single-file sub-agreement uploads are registered as one-doc packages after render; they appear in `PackageView` with `baselines: []` and are stored in Dexie `documents` with firm tags, so a "firm pointer" path over stored uploads has real data.
- The design packages ship with firm null (memory off), the firm combobox only offers firms in `firms.json`, and `hartwell-crane` is absent.
- Package gate and unreadable logic are not in the review.ts toast/gateLine paths.
- Intake's own `Variance` mention: none; coverage groups have no variance group.

## Test Gap Analysis

1. Zero-coverage files in the Variance blast radius: all of `packages/core/src/variance/**`, `apps/web/src/features/variance/**` and variance e2e do not exist yet (new work). Existing files Variance will edit: `counsel/gate.ts` and `sheet.ts` covered by `gate-state-matrix` (2406 cells) and `sheet-contents`; `GateButton.tsx` covered by `gate-pill` e2e/unit and `package-gate-ui` (unit); `state/review.ts` dismiss/gateLine toasts: no test asserts the "gate is now Ready" text against a merged gate (UNVERIFIED by grep of tests; not searched exhaustively).
2. Behaviors with no asserting test today: the interaction of `unreadable` or package block reasons with `gateLine`/dismiss toast (Intake covers only the pill and popover); baseline bytes availability and purge-expired baselines; a Variance pass running for a single-file one-doc package; Package lens role change leading to a Variance re-run.
3. Preliminary tiers: baseline source contract = Fully-Automated (unit with fake-indexeddb, like `package-store`); package-01 DOCX variance counts = Agent-Probe until measured, then Fully-Automated; DOCX table row classification = Known-Gap until a run; owner/tie-break `roleMarkedAt` = cannot be tested (no data source); live R-01 = Known-Gap (operator).

## Infra Improvement Suggestions

- A pure exported accessor for member bytes/availability in `state/package.ts` would remove the private `sources` Map as a coupling blocker.
- `.playwright-mcp/` and `.DS_Store` are untracked and not gitignored; they will show in every `git status`.
- The kit hook filter can block read-only greps that contain the forbidden words; the documented bypass is a token prefix.

## Open Questions

1. Where should Variance read baseline bytes from (additive export vs persist helpers)? Needs INNOVATE.
2. Does the DOCX adapter plus the planned unit rule classify package-01 V2 (table row), V6 (option text) and V7 (table rows) as the answer key expects? Needs a measured run (out of scope here).
3. Should V7 (trust split) owner follow the key (Counsel) or the SPEC A9 default (GP)? Documents disagree.
4. Package 01/02/03 demo entries are firm-null; does the demo for Variance need those entries retagged (Intake-owned `demo-packages.json`) or rely on the separate authored corpus?
5. Do the structure-heading and conditional changes in core move any unit key used by P01's `variance-golden-05-06` or impact tests? UNVERIFIED.
6. Which `intake-*` e2e specs will start showing a Variance pass or Blocked state (row 18)?
7. `scripts/test` and web loops P02-P04: not scanned for hook-filtered token substrings.

TL;DR: Intake left the migration, contracts, gate core and firms untouched, so P03 and most of P01 are valid as written. The real changes are in the web seam: baselines expose only id and name, bytes have no accessor, a baseline role change does not reopen the document, the gate merge lives in GateButton (not use-review-view), and review.ts gate call sites moved 30-60 lines and ignore package/unreadable state. Package 01 matches the 3+4 split but not the 214 pin, and its firm is not yet in the firm list.
