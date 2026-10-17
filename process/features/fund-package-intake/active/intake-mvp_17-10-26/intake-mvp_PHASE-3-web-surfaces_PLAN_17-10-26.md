---
name: plan:intake-mvp-phase-3-web-surfaces
description: "Fund package intake — Phase 3: three disjoint web tracks folded into existing screens (3a Package lens in Structure, 3b coverage line in Findings header and gate popover, 3c GP missing-documents group and request DOCX in Counsel questions), each runnable by a separate opus subagent against the frozen Phase 2 contract"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: fund-package-intake
  phase: phase-3
---

# Phase 3 — Web surfaces (tracks 3a, 3b, 3c)

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED (waits for Phase 2 VERIFIED and its frozen contract)
**Program:** intake-mvp (fund-package-intake, U1-U9, AC-I1..AC-I20)
**Umbrella plan:** process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-3-web-surfaces_REPORT_17-10-26.md (flat in the program task folder)
**Depends on:** Phase 1 (core) and Phase 2 (store, `PackageView` contract, upload flow, e2e helpers). Phase 2 is built (commits 8a52c72, 496c0f9, 782d1fb; report `intake-mvp_PHASE-2-web-data-plane_REPORT_17-10-26.md`, zero contract deviations; EVL pending).
**Locked inputs:** `intake-mvp_SPEC_17-10-26.md`, `intake-mvp_INNOVATE_17-10-26.md` (rulings T1-T4; the strategy deviation: Phase 3 EXECUTE uses parallel opus subagents with strictly disjoint file sets and a frozen store contract instead of an agent team). Context read for this plan: `process/context/all-context.md`, `process/context/ui/all-ui.md`, `process/context/tests/all-tests.md`.

---

## Overview

Phase 3 shows the package. It adds three surfaces to EXISTING screens (no new screens, no sidebar item, no route): (3a) a "Package" lens tab inside Structure listing documents, external references with quote and location, cross-document terms and coverage per check group; (3b) one coverage line in the Findings header and in the gate popover, plus package gate reasons (missing sub agreement blocks, missing LPA or PPM only warns); (3c) a "For the GP" group in Counsel questions with one item per missing document and one DOCX request export. Every surface reads ONLY the frozen Phase 2 contract (`usePackageView()`, `usePackage` actions, the frozen test ids and e2e helpers) and appears only for package uploads and demo packages; samples and the classic single-file path never show package UI.

The three tracks own strictly disjoint file sets (checked below and in the registry), so three separate opus subagents can run at once. They never edit Phase 2 files; if a track needs a contract change it stops (`NEEDS_CONTEXT`) and the orchestrator runs a plan supplement plus a PVL re-run. Playwright is serialized: tracks run only unit tests; one coordinated serial e2e pass runs after the join (port 4317 is a single shared resource).

Closing proofs by track: 3a closes AC-I8 (user-visible), AC-I12 (UI confirm), AC-I14, AC-I15, AC-I16 and the lens half of AC-I17; 3b closes AC-I17 (header and popover), AC-I18, AC-I19 (UI half); 3c closes AC-I20.

## Phase Completion Rules

- `CODE DONE` = all three tracks' checklists complete; `TESTING` = per-track unit gates green; `VERIFIED` only with: join gates (typecheck, lint, full web unit suite) green, the serialized e2e pass green for every Phase 3 spec plus the regression specs, an independent serial EVL (vc-tester), a written validate-contract, and the phase report. User-confirmation language appears only where the user confirmed.
- Known-Gap is never a terminal pass for developed behavior (vacuous-green ban). A surface behavior without a passing e2e gate stays CONDITIONAL with a backlog stub.
- Contract freeze: no track edits a Phase 2 file; a needed change is a plan supplement, not an edit.

## Acceptance Criteria

| ID | Criterion (surface half owned by Phase 3) | proven by | strategy |
|---|---|---|---|
| AC-I8 | A corrected type or role is saved with the package and drives every dependent check after reload | `intake-correction-persists-e2e` (3a): change a reference document's type in the Package lens, reload, restore from recent packages, lens and coverage show the correction | Fully-Automated |
| AC-I9 (lens) | A baseline can be marked from the Package lens for same-firm documents only | `intake-package-lens-e2e` (3a) plus Phase 2 `package-store` guard | Fully-Automated |
| AC-I12 (UI) | An unclear reference is shown for confirmation, never guessed; confirming updates resolution and coverage | `intake-reference-confirm-e2e` (3a) plus Phase 1 `package-reference-resolution-matrix` | Fully-Automated |
| AC-I14 | With the LPA present, a term it defines shows "defined in LPA" with the definition quote and gives 0 false undefined-term findings for it | `intake-crossdoc-terms-no-false-positive-e2e` (3a; synthetic LPA) | Fully-Automated |
| AC-I15 | A term defined nowhere is still an error; base AC13 (#11 "Units") still flagged | `intake-crossdoc-terms-real-error-e2e` (3a) plus `golden-11-undefined-units` re-run | Fully-Automated |
| AC-I16 | Without the LPA, terms are listed "unverified" and counted, not flagged | `intake-terms-unverified-without-lpa-e2e` (3a) | Fully-Automated |
| AC-I17 | Coverage per check group is visible in the Package lens, the gate popover and the Findings header line | `intake-coverage-visible-e2e` (3b, header and popover) plus `intake-package-lens-e2e` (3a, lens) plus Phase 1 `package-coverage-matrix` | Fully-Automated |
| AC-I18 | Whenever any group is partial or blocked, the header coverage line is visible next to the gate | `intake-coverage-next-to-gate-e2e` (3b) | Fully-Automated |
| AC-I19 (UI) | Missing sub agreement blocks with a reason; missing LPA/PPM warns only and leaves the gate otherwise unchanged | `intake-gate-warning-policy-e2e` (3b; no-LPA package keeps the same gate as its findings dictate and shows the warning) plus unit `package-gate-ui` (a package with no sub agreement shows Blocked with the reason and a higher count) plus Phase 1 `package-gate-policy-matrix` | Fully-Automated |
| AC-I20 | Questions shows, in the GP group, one item per missing document with the referencing quote; one export holds all of them once | `intake-missing-docs-request-export-e2e` (3c; DOCX parsed with mammoth; Annex F, Side Letter and Form W-8BEN-E present; no duplicates) | Fully-Automated |
| AC30 (re-run slice) | New controls are keyboard operable with non-colour cues | unit tests per track assert roles, labels and icon-plus-word status; the axe and keyboard pass over the package flow is Phase 4 `intake-a11y-keyboard` | Fully-Automated (manual keyboard pass: Known-Gap carried from the base program) |
| Samples untouched | No package UI for samples and the classic path | `intake-no-package-ui-on-samples-e2e` (3b) | Fully-Automated |

## Entry Gate

- Phase 2 VERIFIED; the frozen contract section of the Phase 2 plan is unchanged; `usePackageView`, `usePackage` and `apps/web/e2e/fixtures/package.ts` exist and `pnpm --filter @aduin/web test package-store` is green.
- Re-sync (orchestrator addition A): `GateButton.tsx` now consumes the parent session's `apps/web/src/features/gate/gate-pill.ts` (`gatePillView(hasDocument, gate)`) and `apps/web/test/gate-pill.test.ts`; both are committed before Phase 1 starts. Record `P3_BASE` as a literal sha. Track 3b re-reads `GateButton.tsx`, `gate-pill.ts` and the `gate-pill` e2e spec before editing.
- Record `git rev-parse HEAD` as `P3_BASE` in the report; baselines recorded: `pnpm --filter @aduin/web test` count, `pnpm --filter @aduin/web typecheck`.
- Phase 2 reality (PLAN-SUPPLEMENT 2026-10-17): the real contract files are `apps/web/src/features/package/{contract.ts,package-view.ts,package-persist.ts}`, `apps/web/src/state/package.ts` (`usePackage`; actions incl. `setType`, `setRole`, `confirmTarget`, `restore(id): Promise<boolean>`, `listRecent`), `apps/web/e2e/fixtures/package.ts`. Types come from `features/package/contract.ts` (`PackageView`, `PackageDocView`, `PackageActionResult`, `PackageActionRefusal`); the hook is `usePackageView` from `features/package/package-view.ts`. Track imports use exactly these names; none was renamed in Phase 2. Real e2e helpers: `uploadPackage(page, files: UploadFile[], tag: {firm, fund, version?})` where each file is `{name, mimeType?, buffer}` (inline buffers supported, so the 3a-D5 temp-file fallback is not needed), `openDemoPackage`, `confirmAllRows`, `runPackage`, `restoreRecentPackage`, `waitForChecks`, plus `hartwellFile(s)`, `idbCounts`, `HARTWELL_DIR`, `RAW_DIR`.
- Each track agent reads: this plan, the Phase 2 frozen contract, `process/context/ui/all-ui.md` (tokens, no new colors, testid conventions), `process/context/tests/all-tests.md`.

## Agent rules (every subagent of this phase, all three tracks)

- Never run `git stash`, `git checkout`, `git reset`, `git restore` (shared checkout with two other agents working at the same time). Stage explicit paths only (`git add <path>` for files of YOUR track); never `git add -A` or `git add .`; never edit, format or commit another track's files.
- Commit directly on `main` with a conventional prefix (`feat|fix|test|docs|process|chore|refactor`) and end every message with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never edit `README.md`, `docs/README.md`, `docs/architecture/**`, `design/mockups/**`.
- Never touch the owner's protected personal Cloudflare zone named in `CLAUDE.md` Project Rules; no routes or custom domains; Cloudflare resources stay `aduin-transaction-*`.
- Free OpenRouter models only; 0 live model calls are planned in this program (a budget of 6 stays reserved, at most 3 per UTC day); stop on cost above 0, a non-`:free` model, a 429 or an open breaker. Preview e2e has no Worker: any `/api/ai` or `/api/ocr` request is a defect.
- Never print or commit secrets. Do not edit `apps/worker/**`, `packages/core/**`, or any Phase 2 file.
- Typecheck errors that originate in files outside YOUR track's file set are reported in your handback, not fixed; the join step reruns typecheck.

## Test command rules (read `process/context/tests/all-tests.md`)

- `pnpm --filter <pkg> test <token>` and `pnpm --filter <pkg> test:e2e <token>`; NO `--`; one token per call; an unmatched token must exit 1; confirm more than 0 tests ran.
- **Tracks do not run Playwright.** Port 4317 and `test-results` are one shared resource and the e2e call rebuilds the shared output; the serialized e2e pass (Step J) is run by ONE agent after all three tracks finish. Never run `preview` and `stack-memory` concurrently.
- A bash hook rejects command text containing `build`, `dist` or `node_modules`: run builds only through a script file written to the session scratchpad with the Write tool and executed with `bash <path>`; invoke binaries as `pnpm exec`.
- Render-first: never await session, Turnstile or memory before rendering deterministic findings; the package surfaces read the already-computed view and never fetch.

## Touchpoints

- Track 3a (Package lens): `apps/web/src/features/package/{PackageLens.tsx,PackageDocuments.tsx,PackageReferences.tsx,PackageTerms.tsx,PackageCoverageTable.tsx}`, `apps/web/src/styles/package-lens.css`, `apps/web/src/features/structure/StructureScreen.tsx`, `apps/web/src/features/structure/model.ts`.
- Track 3b (coverage and gate): `apps/web/src/features/gate/{CoverageLine.tsx,PackageGateReasons.tsx}`, `apps/web/src/styles/package-gate.css`, `apps/web/src/shell/GateButton.tsx`, `apps/web/src/features/review/FindingsScreen.tsx`.
- Track 3c (GP group and request DOCX): `apps/web/src/features/counsel/{GpRequestGroup.tsx,exportRequestDocx.ts}`, `apps/web/src/styles/package-request.css`, `apps/web/src/features/counsel/CounselScreen.tsx`.
- Tests: per track (see Blast Radius).

## Public Contracts

Unchanged: everything in Phase 2's "Unchanged" list, the counsel export (`buildCounselDocx`, `exportCounselSheet`), the core gate (`computeGate`, `gate-state-matrix`), `features/registry.ts`, `Sidebar` nav, `tokens.css`, the existing Structure lens order and labels (the six existing tabs; the `Package` tab appears only when `usePackageView()` is not null), the Findings header text `findings-meta`, the Counsel gate line, existing testids.

Phase 2 additions beyond the frozen set (usable by tracks, not frozen): testids `package-version-input`, `package-row-low-mark`, `package-row-remove`, row attribute `data-suggestion-source`. Phase 2 deviation 2: `state/review.ts` `live()` now compares `doc.id`, and `attachPackage` replaces the `doc` object (adds `packageId`), so 3b and 3c must not rely on `doc` object identity (select by `doc.id`; the package view stays non-null across `attachPackage`).

R1 ruling (accepted per SPEC AC-I18): single high-confidence subscription agreement uploads become one-document packages after render and show the coverage line (for example "Coverage: partial - no LPA ...") and the Package lens tab. These are `packages/core/test/fixtures/sections-parts.html`, sample #3 raw when uploaded, `fixtures/diff/sibling-A/B`, `fixtures/diff/identical-pair/a,b`. Bundled samples opened from the Samples list and tiny, hostile and html-seeded fixtures stay classic with no package UI. `intake-no-package-ui-on-samples` therefore asserts absence only for Samples-list opens and for classic-path uploads of tiny/non-high-confidence fixtures, and asserts presence of the coverage line for a single high-confidence sub agreement upload.

New testids (owned by Phase 3; frozen for Phase 4 specs):
- 3a: `structure-lens-package`, `package-lens`, `package-lens-line`, `package-lens-documents`, `package-lens-doc` (`data-doc-id`), `package-lens-doc-type`, `package-lens-doc-role`, `package-lens-action-error`, `package-lens-references`, `package-reference` (`data-resolution`, `data-target-key`), `package-reference-confirm`, `package-reference-show`, `package-lens-terms`, `package-term` (`data-status`), `package-lens-coverage`, `package-coverage-group` (`data-group`, `data-status`).
- 3b: `findings-coverage-line` (`data-status`), `gate-coverage-line` (`data-status`), `package-gate-reason` (`data-level="block"`), `package-gate-warning` (`data-level="warn"`).
- 3c: `gp-group`, `gp-request-item` (`data-target-key`), `gp-request-quote`, `gp-request-count`, `gp-request-export`, `gp-request-none`.

## Blast Radius

Files directly created or modified (exact), by track. The three sets are pairwise disjoint (verified in `phase-blast-radius-registry.md`).

**Track 3a:** `apps/web/src/features/package/PackageLens.tsx`, `PackageDocuments.tsx`, `PackageReferences.tsx`, `PackageTerms.tsx`, `PackageCoverageTable.tsx` (new); `apps/web/src/styles/package-lens.css` (new); `apps/web/src/features/structure/StructureScreen.tsx`, `apps/web/src/features/structure/model.ts` (modify); tests (new): `apps/web/src/features/package/package-lens.test.tsx`, `apps/web/e2e/intake-package-lens.spec.ts`, `intake-crossdoc-terms-no-false-positive.spec.ts`, `intake-crossdoc-terms-real-error.spec.ts`, `intake-terms-unverified-without-lpa.spec.ts`, `intake-reference-confirm.spec.ts`, `intake-correction-persists.spec.ts`.

**Track 3b:** `apps/web/src/features/gate/CoverageLine.tsx`, `PackageGateReasons.tsx` (new); `apps/web/src/styles/package-gate.css` (new); `apps/web/src/shell/GateButton.tsx`, `apps/web/src/features/review/FindingsScreen.tsx` (modify); tests (new): `apps/web/src/features/gate/package-gate-ui.test.tsx`, `apps/web/e2e/intake-coverage-visible.spec.ts`, `intake-coverage-next-to-gate.spec.ts`, `intake-gate-warning-policy.spec.ts`, `intake-no-package-ui-on-samples.spec.ts`.

**Track 3c:** `apps/web/src/features/counsel/GpRequestGroup.tsx`, `exportRequestDocx.ts` (new); `apps/web/src/styles/package-request.css` (new); `apps/web/src/features/counsel/CounselScreen.tsx` (modify); tests (new): `apps/web/test/request-export-contents.test.ts`, `apps/web/src/features/counsel/gp-request-group.test.tsx`, `apps/web/e2e/intake-missing-docs-request-export.spec.ts`, `intake-gp-group-absent-without-package.spec.ts`.

**Join step (serialized; the ONLY agent allowed to edit these, tracks never touch them):**
- R2 restore-on-reload (new item J0 below): `apps/web/src/state/last-doc.ts`, `apps/web/src/App.tsx` (both last edited by the bug-fix session, commit 1f5cfa5; that session is done editing apps/web; re-read both from disk before editing, additive only), `apps/web/test/restore-last-doc.test.ts` (existing unit file, add cases only), new e2e `apps/web/e2e/intake-reload-restores-package.spec.ts`.
- R1 affected existing e2e specs (additive assertions only, never delete or weaken an existing assertion; they are e2e files, so only the join agent edits them): `apps/web/e2e/ingest-all-formats.spec.ts` (uses `sections-parts.html`), `apps/web/e2e/restore-and-no-text.spec.ts` (sample #3 raw), `apps/web/e2e/diff-pairs.spec.ts` (`sibling-A/B`, `identical-pair`), `apps/web/e2e/sibling-clauses.spec.ts` and `apps/web/e2e/compare-ai-summary.spec.ts` only if the J3 run shows they upload a high-confidence sub agreement. The join agent edits one of these only if J3 shows a failure or a package-UI side effect that needs a pinned assertion.

Read-only for ALL tracks: every Phase 2 file (`state/package.ts`, `features/package/{contract,package-view,package-persist}.ts`, `features/open-document/**`, `engine/**`, `storage/**`, `state/review.ts`, `features/review/use-review-view.ts`, `e2e/fixtures/package.ts`), `packages/**`, `apps/worker/**`, `features/registry.ts`, `shell/Sidebar.tsx`, `styles/tokens.css`, `styles/base.css`, `styles/app-extra.css`, `styles/counsel.css`, `styles/structure.css`.

## Data Flow

All three surfaces read `usePackageView()` (plain data, already computed after findings rendered). 3a additionally calls `usePackage` actions `setType`, `setRole`, `confirmTarget` for edits; those recompute the analysis synchronously and may re-open the primary document through the normal render-first path. 3b is read-only (it reads `coverageLine`, `coverageStatus`, `gateReasons`). 3c reads `requests`, builds a DOCX in the browser (lazy `docx` import, like `exportDocx.ts`), masks every string with `maskAndClamp` and downloads it with `downloadBlob`; it writes nothing to memory, Dexie or the server (requests are not Findings: no taxonomy, fingerprint, memory or gate change). Quotes shown or exported pass through `maskQuote` / `maskAndClamp` at the edge.

Failure modes: `usePackageView()` null renders nothing for the new surfaces (samples, classic path, loading); a store action that returns `{ok: false}` shows an inline `package-lens-action-error` text; DOCX build failure shows a toast and keeps the group usable (nothing downloaded); zero requests show `gp-request-none` ("Nothing missing: every referenced document is in the package.").

## Implementation Checklist

### Step A — Track 3a: Package lens (opus subagent 3a; files of 3a only)

- [ ] 3a-A1. `features/structure/model.ts`: add `PACKAGE_LENS = 'package'`, the web-local type `StructureLensId = LensId | 'package'` and `lensesFor(hasPackage)` returning the six existing lenses plus a trailing `{id: 'package', label: 'Package'}` only when `hasPackage`; the existing `LENSES`, `DEFAULT_LENS`, `lineFor`, `visibleCount` stay unchanged.
- [ ] 3a-A2. `features/structure/StructureScreen.tsx`: read `usePackageView()`; render the tab list from `lensesFor(!!pkg)`; the `Package` tab has no issue-count badge but shows a warning icon plus screen-reader text "coverage partial" when `coverageStatus` is not `full`; when the package lens is active render `<PackageLens />`, replace the `structure-line` text with `package-lens-line` (the coverage line), and hide the "Show everything" toggle; call `usePackageView()` with the other hooks at the top of the component, BEFORE the `if (!view)` early return (rules of hooks); reset the lens to the default ONLY when the active lens is `package` AND the review `phase === 'ready'` AND the package view is null (document switch to a non-package document); every other lens persists across documents exactly as today (`structure-view` unchanged); do NOT reset while `refreshing` is true or during the transient reload after `setType`/`setRole` (G5, uses the Phase 2 `refreshing` field); type the lens as `StructureLensId` and narrow before calling `lineFor`, `visibleCount`, `TableLens`. No other existing behavior changes (arrow-key tab navigation includes the new tab).
- [ ] 3a-A3. `PackageLens.tsx` + `styles/package-lens.css` (class prefix `pkg-lens-`, tokens only): package header (fund, version, firm name) and the four sections below.
- [ ] 3a-A4. `PackageDocuments.tsx` (`package-lens-documents`): table of documents (name, type, role, confidence word with icon, reason). Non-primary rows have type and role selects (`package-lens-doc-type`, `package-lens-doc-role`) calling `usePackage.getState().setType/setRole`; a `{ok: false}` result shows `package-lens-action-error` with plain text; the primary row is read-only with the label "Document to digitize". Baseline is markable here for same-firm documents.
- [ ] 3a-A5. `PackageReferences.tsx` (`package-lens-references`): references grouped by `targetKey`; each mention row (`package-reference`, `data-resolution`, `data-target-key`) shows the masked quote, location ("Section X, paragraph N" from `location.sectionPath`) and resolution as icon plus word (Resolved to <file name>, Not in package, Needs confirmation); `unclear` rows carry a select `package-reference-confirm` (candidate documents of the matching type plus "None of these") calling `confirmTarget`; a button `package-reference-show` jumps to the quote in Findings using the same scroll pattern as Structure's `showInDoc` (block id from `useReview` result blocks by `location.blockIndex`).
- [ ] 3a-A6. `PackageTerms.tsx` (`package-lens-terms`): rows `package-term` with `data-status` (`defined_in_package` "Defined in LPA" or the document type label; `unverified`), mentions, the masked definition quote when defined, and the plain reason text when unverified ("No LPA in the package" / "Not found in the reference documents"); a short note that these lists are not findings.
- [ ] 3a-A7. `PackageCoverageTable.tsx` (`package-lens-coverage`): one `package-coverage-group` row per group (`data-group`, `data-status`) with label, status as icon plus word, missing document types and reasons from the view; the same fixed `coverageLine` text above the table.
- [ ] 3a-A8. Unit `package-lens.test.tsx` (jsdom with the existing tiny render helper): renders sections from a synthesized `PackageView`; `{ok:false}` shows the inline error; status never relies on color alone (icon plus word present); the tab is absent when the view is null; reference and definition quotes are masked on screen (feed a quote for which `maskQuote(q) !== q`, assert the DOM holds `maskQuote(q)` and never the raw `q`). File: `apps/web/src/features/package/package-lens.test.tsx` (G1: vitest only collects `test/**/*.test.ts` and `src/**/*.test.{ts,tsx}`; `.tsx` under `apps/web/test/` would exit 1 with no files). Token `package-lens` must match exactly one file and run more than 0 tests.

### Step B — Track 3b: coverage line and gate (opus subagent 3b; files of 3b only)

- [ ] 3b-B1. `features/gate/CoverageLine.tsx` + `styles/package-gate.css` (class prefix `pkg-gate-`): renders `<p>` with an icon, the view's `coverageLine` and `data-status`; prop `placement` selects the testid (`findings-coverage-line` or `gate-coverage-line`); renders nothing when `usePackageView()` is null.
- [ ] 3b-B2. `features/gate/PackageGateReasons.tsx`: block reasons as items `package-gate-reason` (`data-level="block"`, plain text from `PackageGateReason.text`), warnings under the heading "Warnings (they do not block digitization)" as `package-gate-warning` (`data-level="warn"`); renders nothing when there are none.
- [ ] 3b-B3. `shell/GateButton.tsx`: read `usePackageView()` (null-safe) and use its `gateReasons` (frozen P2 contract item 2, the only package gate-reason source; `useReviewView()` is NOT extended, G2); build on the parent session's `gate-pill.ts`: keep the core gate input to `gatePillView(hasDocument, gate)` and pass a merged gate `{status, reasons}` whose `status` is `blocked` when the core gate OR any package `block` reason says so and whose `reasons` are the core reasons plus the package block reasons, so label, icon and title strings come from `gate-pill.ts` unchanged and `gate-pill.ts` is NOT edited; the merged object MUST be built by spreading the core gate (`{...gate, status, reasons}`) so `unreadable` (set by `useReviewView()` since 1f5cfa5: a no-text document is never Ready) is preserved, and the no-text pill still wins over any package state; `blocked` is the core gate OR any package `block` reason; the count is core reasons plus package block reasons; label strings and icons unchanged; the popover shows the existing core `GateReasons`, then `PackageGateReasons`, then `<CoverageLine placement="popover" />`; a package that only warns leaves the label exactly as the core gate dictates.
- [ ] 3b-B4. `features/review/FindingsScreen.tsx`: insert `<CoverageLine placement="header" />` inside the header text block after `findings-meta`; no other change; `findings-meta` text and testids unchanged (layout-vs-mockup keeps passing because the element is absent without a package).
- [ ] 3b-B5. Unit `package-gate-ui.test.tsx`: block versus warn rendering; a synthesized package with no sub agreement shows Blocked with the reason and a count one higher than the core gate; a package with only an LPA warning keeps the core label; the coverage line text equals the view's string; nothing renders for a null view. File: `apps/web/src/features/gate/package-gate-ui.test.tsx` (G1); token `package-gate-ui` matches exactly one file.

### Step C — Track 3c: GP group and request DOCX (opus subagent 3c; files of 3c only)

- [ ] 3c-C1. `features/counsel/exportRequestDocx.ts`: `buildRequestDocx(meta, requests, generatedAt?)` (lazy `import('docx')`, same pattern as `exportDocx.ts`): title "Missing documents request · <fund>", a facts line (law firm, fund, version, or "Law firm: not tagged"), "N document(s) needed · prepared <date>", then per request a numbered heading "<n>. <label>", the italic masked quote prefixed "Referenced N times. First reference: ", a "Why we need it" line ("The subscription agreement refers to this document."), and a blank line "Status / expected date: ______"; every string through `maskAndClamp`; `requestDocxFilename(meta)` returns `missing-documents-<fund slug>.docx` (same slug rules as `docxFilename`); an empty list writes "No missing documents."
- [ ] 3c-C2. `features/counsel/GpRequestGroup.tsx` + `styles/package-request.css` (class prefix `pkg-req-`): the group `gp-group` titled "For the GP" with a one-line explanation and a count; one item per `DocumentRequest` (`gp-request-item`, `data-target-key`) with label, `gp-request-count` ("referenced N times") and the masked quote (`gp-request-quote`); the export button `gp-request-export` downloads ONE DOCX per click via `downloadBlob(filename, blob, DOCX_MIME)` (imports from `lib/download.ts` and `exportDocx.ts`, read-only) and shows a toast "Request exported: N documents."; zero requests show `gp-request-none`; renders nothing when `usePackageView()` is null.
- [ ] 3c-C3. `features/counsel/CounselScreen.tsx`: render `<GpRequestGroup />` once, below the gate line and the no-firm note and above the questions list, only inside the `phase === 'ready'` branch; no change to the counsel export, the gate line, the question rows or the prior section.
- [ ] 3c-C4. Unit `request-export-contents.test.ts` (parsed with mammoth like `counsel-export-contents.test.ts`): every request appears exactly once with its quote; a duplicated target in the input appears once after core dedupe; masking applied; filename rule; empty list text. Unit `gp-request-group.test.tsx`: items, counts, none-state, absent without a package, and the on-screen `gp-request-quote` is masked (feed a quote with `maskQuote(q) !== q`, assert the DOM holds `maskQuote(q)` and never raw `q`); `request-export-contents` asserts the same for the mammoth text. The `gp-request-group` component test lives at `apps/web/src/features/counsel/gp-request-group.test.tsx` (G1; `.tsx` must be under `src/`); token `gp-request-group` matches exactly one file; `request-export-contents.test.ts` stays under `apps/web/test/` (a `.ts` file).

### Step D — Per-track e2e specs (written by the track agents; RUN only in Step J)

- [ ] 3a-D1. `intake-package-lens` (AC-I17 lens half, AC-I9 lens): open demo `hartwell`, confirm rows, run; the `Package` tab exists; documents, references (LPA resolved, Annex F, Side Letter, Form W-8BEN-E not in package), terms and five coverage groups render; marking Fund II as baseline from the lens works; sample #3 shows no `Package` tab. When `northgate-iii` is listed in `packages.json`, also open it and assert the lens shows its baseline (Fund II) and the coverage groups from `expected.json`.
- [ ] 3a-D2. `intake-crossdoc-terms-no-false-positive` (AC-I14): Hartwell with the LPA: no finding row for the offering noun "Units"; `package-term` "Units" has `data-status="defined_in_package"` and its definition quote.
- [ ] 3a-D3. `intake-crossdoc-terms-real-error` (AC-I15): same package: a finding row for "Stock" remains; plus Hartwell without the LPA keeps both noun findings.
- [ ] 3a-D4. `intake-terms-unverified-without-lpa` (AC-I16): Hartwell Fund III only: no findings from the cross-document logic, `package-term` rows `data-status="unverified"` with the reason, count equals the number in the coverage line.
- [ ] 3a-D5. `intake-reference-confirm` (AC-I12 UI): two files of type lpa so a reference is `unclear`; the select shows both candidates and "None of these"; choosing one updates the row to Resolved and the coverage line; choosing "None of these" gives Not in package. Second LPA source (G3): an inline `Buffer` built in the spec with different content (for example an "Amended and Restated" LPA body with a changed paragraph) so its content hash differs and the Phase 2 duplicate-collapse does not merge it; passed through `uploadPackage(page, files, tag)` where each file is `{name, mimeType, buffer}` (the real helper accepts inline buffers: `UploadFile = {name, mimeType?, buffer}`).
- [ ] 3a-D6. `intake-correction-persists` (AC-I8): change Fund II from reference to baseline and mark the LPA type through the lens, reload the page, open the dialog, restore the package from `package-recent-option`, open Structure: the corrections and the coverage line are intact.
- [ ] 3b-D1. `intake-coverage-visible` (AC-I17): header `findings-coverage-line` and popover `gate-coverage-line` both show the same text as the Package lens line; text starts "Coverage: partial".
- [ ] 3b-D2. `intake-coverage-next-to-gate` (AC-I18): on the Findings route `gate-button` and `findings-coverage-line` are visible together for a partial package and the line names the missing items.
- [ ] 3b-D3. `intake-gate-warning-policy` (AC-I19 UI): Hartwell Fund III with no LPA: popover shows a `package-gate-warning` for the LPA, no `package-gate-reason` block item, and the `gate-button` label equals what the core gate gives for the same findings (Ready to digitize when no critical finding).
- [ ] 3b-D4. `intake-no-package-ui-on-samples` (R1): opening samples #3 and #11 from the Samples list shows no coverage line, no `Package` tab and no GP group; a tiny or hostile single-file upload (classic path, not a high-confidence sub agreement) shows none either; a single high-confidence sub agreement upload (fixture `sections-parts.html`) is a one-document package and DOES show `findings-coverage-line` (starts "Coverage: partial") and the `Package` tab (AC-I18), asserted with web-first assertions.
- [ ] 3c-D1. `intake-missing-docs-request-export` (AC-I20): Hartwell Fund III with the LPA: GP group lists three items (Annex F, Side Letter, Form W-8BEN-E) each with its quote and count; export once; the DOCX captured with an inline `page.waitForEvent('download')` around the `gp-request-export` click and parsed with mammoth inside the spec (G4: `exportDocxText` from `e2e/fixtures/counsel.ts` clicks `counsel-export` and is for the counsel sheet only; do not use it here) contains each label exactly once and each quote; the sheet export of counsel questions is unchanged. Then repeat for demo `northgate-iii` when it is listed in `packages.json` (orchestrator addition B): item labels, counts and quotes equal the entries derived from its `answer-key.md` in `fixtures/package/expected.json` (Annex F and the Kestrel side letter); never hard-code counts for the design packages in the spec.
- [ ] 3c-D2. `intake-gp-group-absent-without-package`: Samples-list open and a classic (non-high-confidence) upload show no `gp-group`; a one-document package (R1) shows `gp-group` with the missing LPA and PPM requests.

### Step J — Join (after all three tracks hand back; ONE agent; serial)

- [x] J0. R2 package restore on reload. Re-read `state/last-doc.ts` and `App.tsx` from disk. In `last-doc.ts`: `parseLastDoc` keeps `packageId` when it is a string matching the existing `SAFE_REF` shape (else drops it, never rejects the row); `LastDoc` already carries the optional field via `DocMeta`; confirm the save path (`saveLastDoc` caller in `state/review.ts`) writes `packageId` and, because `attachPackage` runs after render, re-save the last-doc row when `attachPackage` sets it (real code check at PVL: a multi-file package run already saves `packageId` because `primaryOpen` puts it in the `meta` passed to `openDocument`, so for Hartwell and demo packages only `parseLastDoc` and `restoreLastDocument` need to change; a one-document package (R1) is attached AFTER open by `attachPackage` and its last-doc row has no `packageId`: the join agent MAY re-save it from `App.tsx` with a `useReview.subscribe` that calls the exported `saveLastDoc` when `doc.packageId` becomes set; if that is not small and clean, leave it and record the one-document reload as a Known-Gap with backlog stub `package-single-restore-on-reload_NOTE_17-10-26.md`. This item must NOT stop with `NEEDS_CONTEXT` for that case; never edit `review.ts` or `state/package.ts`). In `restoreLastDocument` the package branch goes right after `loadLastDoc` and BEFORE the source branches, guarded by `deps.isEmpty()`. In `restoreLastDocument` add an optional dep `restorePackage?: (packageId: string) => Promise<boolean>`; when the remembered doc has `packageId` and the dep returns true, return true without the classic open; when it returns false (package row gone, past the 24 h window) fall through to the existing classic path unchanged. In `App.tsx` wire `restorePackage: (id) => usePackage.getState().restore(id)` and keep `isEmpty` semantics. Unit (additive in `test/restore-last-doc.test.ts`): parse keeps a valid `packageId`, drops an invalid one; package branch used when `restorePackage` is true; classic fallback when false. E2E `intake-reload-restores-package` (AC-I8 reload half, R2): upload the Hartwell package, run, reload, expect `package-lens` via the Structure `Package` tab and `findings-coverage-line` to be visible without using `package-recent-option`; the existing `intake-correction-persists` (3a, recent-packages restore path) is NOT edited by the join.
- [x] J1. Confirm the three file sets did not overlap: `git diff --name-only P3_BASE -- apps scripts packages` partitions exactly into the three tracks' lists plus the join-step files in Blast Radius (J0 and R1 only) and nothing else (G8: the pathspec excludes `process/` report files, which the join step writes later).
- [x] J1b. Render-first / no-fetch grep gate (G7): over the new surface components (`features/package/Package*.tsx`, `features/gate/{CoverageLine,PackageGateReasons}.tsx`, `features/counsel/{GpRequestGroup.tsx,exportRequestDocx.ts}`) run `grep -rnE "fetch\(|ensureSession|getSession|turnstile|sendBeacon|XMLHttpRequest" <those files>`; it must print nothing (grep exit 1). New surfaces never fetch, never await session, Turnstile or memory, and the only `@aduin/core` value imports allowed are `maskQuote` and `maskAndClamp`.
- [x] J2. `pnpm --filter @aduin/web typecheck`, `pnpm lint`, then every per-track unit token one per call: `package-lens`, `package-gate-ui`, `request-export-contents`, `gp-request-group`, `restore-last-doc` (after J0), then the full `pnpm --filter @aduin/web test`.
- [x] J3. Serialized e2e (one invocation at a time, one token per call): the 12 Phase 3 specs in Step D order, then `intake-reload-restores-package`, then the R1 specs `ingest-all-formats`, `restore-and-no-text`, `diff-pairs`, `sibling-clauses`, `compare-ai-summary`, then the regression specs `structure-view`, `gate-pill`, `counsel-gate`, `counsel-sheet`, `counsel-export`, `app-shell`, `layout-vs-mockup`, `investor-path-view`, `previously-handled-section`, `placeholder-routes`.
- [x] J4. Write the phase report (per-track results, any contract friction, Known-Gaps, backlog stubs); commit report-side files only after tracks have committed their own.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm --filter @aduin/web test package-lens` | Fully-Automated | AC-I12 (UI), AC-I14/15/16 rendering, AC30 slice |
| `pnpm --filter @aduin/web test package-gate-ui` | Fully-Automated | AC-I17, AC-I19 (UI half incl. no-sub block) |
| `pnpm --filter @aduin/web test request-export-contents` | Fully-Automated | AC-I20 |
| `pnpm --filter @aduin/web test gp-request-group` | Fully-Automated | AC-I20 |
| `pnpm --filter @aduin/web test:e2e intake-package-lens` | Fully-Automated | AC-I17 (lens), AC-I9 (lens) |
| `pnpm --filter @aduin/web test:e2e intake-crossdoc-terms-no-false-positive` | Fully-Automated | AC-I14 |
| `pnpm --filter @aduin/web test:e2e intake-crossdoc-terms-real-error` | Fully-Automated | AC-I15 |
| `pnpm --filter @aduin/web test:e2e intake-terms-unverified-without-lpa` | Fully-Automated | AC-I16 |
| `pnpm --filter @aduin/web test:e2e intake-reference-confirm` | Fully-Automated | AC-I12 (UI) |
| `pnpm --filter @aduin/web test:e2e intake-correction-persists` | Fully-Automated | AC-I8 |
| `pnpm --filter @aduin/web test:e2e intake-coverage-visible` | Fully-Automated | AC-I17 |
| `pnpm --filter @aduin/web test:e2e intake-coverage-next-to-gate` | Fully-Automated | AC-I18 |
| `pnpm --filter @aduin/web test:e2e intake-gate-warning-policy` | Fully-Automated | AC-I19 |
| `pnpm --filter @aduin/web test:e2e intake-no-package-ui-on-samples` | Fully-Automated | L2 (no new screens; samples untouched) |
| `pnpm --filter @aduin/web test:e2e intake-missing-docs-request-export` | Fully-Automated | AC-I20 |
| `pnpm --filter @aduin/web test:e2e intake-gp-group-absent-without-package` | Fully-Automated | AC-I20 scope (package only) |
| `pnpm --filter @aduin/web test restore-last-doc` | Fully-Automated | AC-I8 (reload, R2) |
| `pnpm --filter @aduin/web test:e2e intake-reload-restores-package` | Fully-Automated | AC-I8 (package view survives reload) |
| R1 specs one per call: `ingest-all-formats`, `restore-and-no-text`, `diff-pairs`, `sibling-clauses`, `compare-ai-summary` (green; additive assertions only) | Fully-Automated | AC-I18 side effect accepted, base specs keep passing |
| regression tokens (Step J3) one per call | Fully-Automated | AC17, AC22, AC20, AC21 (base screens keep working) |
| `git diff --quiet P3_BASE -- apps/worker packages` and no Phase 2 file in `git diff --name-only P3_BASE -- apps scripts packages` | Fully-Automated | contract freeze; no Worker or core change |
| J1b grep gate: no `fetch(`, session, Turnstile or beacon in the new surface files (grep exit 1) | Fully-Automated | render-first and no-network for the new surfaces (G7) |
| Known-Gap (G6): the `block` path of `GateButton` (no subscription agreement) is proven in unit only, because the UI cannot reach a run without a subscription agreement; `counsel-gate-line` and `findings-meta` count core reasons only | Known-Gap (backlog stub `package-gate-block-e2e-reach_NOTE_17-10-26.md`; gate stays CONDITIONAL for this path) | AC-I19 block half beyond unit |
| `pnpm --filter @aduin/web test`, `pnpm typecheck`, `pnpm lint` | Fully-Automated | regression (base AC1-AC64 keep passing) |

## Exit Gate

```bash
pnpm --filter @aduin/web test package-lens
# Expected: exit 0, more than 0 tests (repeat one-token calls for package-gate-ui, request-export-contents, gp-request-group)
pnpm --filter @aduin/web test:e2e intake-package-lens
# Expected: exit 0, more than 0 tests ran (repeat one token per call for all 12 Phase 3 specs and the regression tokens)
pnpm --filter @aduin/web typecheck
# Expected: exit 0
git diff --name-only P3_BASE -- apps scripts packages
# Expected: only files listed in Blast Radius, none from Phase 2's file list (process/ files excluded by the pathspec, G8)
```

- All three tracks checked off; join gates green; contract unchanged; phase report written.

## Risks and Mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| Two tracks edit the same file | High | Disjoint file sets, per-track `git add` with explicit paths, J1 partition check, registry sub-claims |
| Findings header or gate popover changes break header-sensitive specs | Med | The new elements render only for packages; `layout-vs-mockup`, `gate-pill`, `app-shell` re-run in J3 and again in the Phase 4 full run |
| Concurrent Playwright runs | High | Tracks never run Playwright; one serialized pass in Step J |
| Contract friction discovered mid-phase | Med | Stop with `NEEDS_CONTEXT`; supplement and PVL re-run (never edit Phase 2 files) |
| Lens reset flashes during a store re-open | Med | Reset only when `phase === 'ready'` and the view is null; `refreshing` keeps the view non-null (G5) |
| Unclear-reference UI guesses silently | High | Select starts empty; coverage keeps "N references to confirm" until chosen |
| Quote text unmasked | Med | `maskQuote` / `maskAndClamp` at every render and export edge; tests assert masking |

## Rollback

Revert the per-track commits (`git revert <sha>`); the surfaces are additive and render nothing without a package, so reverting any single track leaves the others and the app working. No data, Worker or D1 change. Live state at Phase 3 entry: version 328ca295-d5da-487e-a063-843b0c7c86db (commit 1f5cfa5); rollback chain 328ca295 -> 09e7a579 -> 47d98295 -> 23612b12. Phase 3 deploys nothing; Phase 4 ROLLBACK_VERSION is whatever `deployments list` shows live at Phase 4 entry (currently 328ca295).

## Blockers That Would Justify BLOCKED Status

- Phase 2 not VERIFIED, or the frozen contract changed after PVL.
- A track cannot meet its criterion without editing a file outside its set.
- Two tracks' blast radii turn out to overlap in code that exists at EXECUTE time (registry conflict).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [x] 1. RESEARCH — satisfied by the program-level RESEARCH plus the code reading for this plan; a scoped pass at phase entry re-reads the Phase 2 report for the actual store API and testids
- [x] 2. INNOVATE — satisfied by the program-level INNOVATE (LOCKED, including the parallel-subagents deviation)
- [x] 3. PLAN-SUPPLEMENT — done 2026-10-17: reconciled with the Phase 2 report and real contract files; Inner Loop Refresh Note written (rulings R1-R4)
- [x] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md` (Status / Gate / Plan updates applied / Execute-agent instructions / Test gates / High-risk pack / Backlog artifacts / Known gaps / Accepted by)
- [x] 5. EXECUTE — three tracks done (3a, 3b, 3c) and joined; per-section test gates run and green (or gaps documented)
- [x] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [x] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", the orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare applied inline)

Signal score 4/7 (S3 three independent directions, S4, S6 trust-boundary exports are masked, S7). The skill's preferred option for coordinated blast radii is an agent team; TeamCreate machinery is not available in this session, so the locked deviation applies: THREE parallel opus vc-execute-agents (3a, 3b, 3c), fire-and-forget, with strictly disjoint file sets and a frozen contract, so no mid-run coordination is needed (the disjointness is the substitute for a coordinating channel). Agent count: 3 execute (opus) + 1 join agent (opus for the J-step edits only if a fix is required; the serial e2e pass itself is run by a sonnet vc-tester) + 1 sonnet vc-code-reviewer. Playwright is serialized after the join (single port).

## Test Infra Improvement Notes

(none identified yet) — candidates to record at EVL: per-agent Playwright ports (existing backlog P6-2) would let tracks run e2e in parallel; a shared `exportDocxText`-style helper for the request DOCX.

## Resume and Execution Handoff

- Selected plan file path: `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-3-web-surfaces_PLAN_17-10-26.md`
- Last completed step: step 3 PLAN-SUPPLEMENT (2026-10-17); next is inner PVL (re-run from V1; Refresh Note is newer than the existing contract)
- Validate-contract status: outer-pvl contract on file is superseded by the Inner Loop Refresh Note; re-validation required
- Next step: after Phase 2 VERIFIED, re-read its report, plan-supplement if names changed, inner PVL; then spawn THREE vc-execute-agents (opus) in parallel, each given this exact plan path, the validate-contract path, its track letter and its exact file set (Blast Radius above), plus the join step for a fourth agent.
- Validators for the plan artifact: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this plan>` and `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <this plan>`.
- Next instruction: ENTER VALIDATE MODE for this plan (after Phase 2), then ENTER EXECUTE MODE only after `Gate: PASS`.

## Inner Loop Refresh Note

Date: 2026-10-17. Changed sections: header (Depends on), Entry Gate, Public Contracts, Blast Radius (join-step files), Implementation Checklist (new J0, J1/J2/J3 edits, 3b-D4, 3c-D2, 3a-D5 wording), Verification Evidence (3 rows), Rollback, Phase Loop Progress, Resume. Invalidates the prior validate-contract (re-run PVL from V1).
- R1: single high-confidence sub agreement uploads (`sections-parts.html`, sample #3 raw upload, `fixtures/diff/sibling-A/B`, `identical-pair/a,b`) are one-document packages and show the coverage line and Package tab (accepted, AC-I18); Samples-list opens stay classic. Affected existing e2e specs are touched only by the serialized join agent with additive assertions.
- R2: package lost on reload (Phase 2 known gap): join item J0 edits `state/last-doc.ts` and `App.tsx` (re-read first, additive) and adds `intake-reload-restores-package`; the files are added to the registry.
- R3: Phase 2 extra testids and the `live()` doc.id change are noted in Public Contracts.
- R4: live version 328ca295-d5da-487e-a063-843b0c7c86db; Phase 4 rollback text updated.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: inner-pvl: phase-3
supersedes: 2026-10-17 (outer-pvl) — inner PVL has current evidence (Phase 2 is built; every name, testid and helper was re-checked against the real code)

Parallel strategy: parallel-subagents (locked INNOVATE deviation: three fire-and-forget opus vc-execute-agents, one per track, plus a serial join)
Rationale: signal score 4/7 (S3 three independent directions, S4 program phase, S6 trust-boundary export masked, S7 more than 5 files); dominant signal is the disjoint blast radius, so no mid-run channel is needed. Agents: 3 opus execute + 1 sonnet vc-tester (serial e2e) + 1 sonnet vc-code-reviewer + 1 opus join agent (J0 edits and any fix) = 6. No cost guard triggered. Playwright runs once, serialized, after the join.

V1 notes: `validate-plan-artifact.mjs` and `validate-phase-stub.mjs` pass (0 failures, 0 warnings). `## Inner Loop Refresh Note` (2026-10-17) is present, so this is a full re-validation, not an auto-proceed. Cheap checks run this pass: `pnpm --filter @aduin/web test package-lens` exits 1 (no file yet, red-first works); `restore-last-doc` (4 tests) and `gate-pill` (6 tests) are green; vitest include is `test/**/*.test.ts` and `src/**/*.test.{ts,tsx}` with jsdom. No Playwright was run.

Real-code verification (Phase 2 built, commits 8a52c72, 496c0f9, 782d1fb, 2e922f9; bug-fix commits 9ea0011, 1f5cfa5):
- `features/package/contract.ts` exports `PackageView` (fields documents, references, terms, coverage, coverageLine, coverageStatus, gateReasons, requests, baselines, refreshing, firmName, fund, version), `PackageDocView` (isPrimary, editable), `PackageActionResult`, `PackageActionRefusal`; `package-view.ts` exports `usePackageView()` (null unless ready and `doc.packageId` matches, or `refreshing`). `state/package.ts` has `setType`, `setRole`, `confirmTarget(targetKey, docId | 'none')`, `restore(id): Promise<boolean>`, `listRecent`. `e2e/fixtures/package.ts` has `uploadPackage(page, files, tag)` with inline buffers, `openDemoPackage`, `confirmAllRows`, `runPackage`, `restoreRecentPackage`, `waitForChecks`, `hartwellFile(s)`, `idbCounts`. Every plan import matches; no name was renamed.
- Core shapes match the plan: `ExternalReference` (quote, location.sectionPath and blockIndex, resolution resolved or not_in_package or unclear, targetKey, targetFamily lpa/ppm/side_letter/tax_form/annex), `CrossDocTerm` (defined_in_package or unverified, quote, reason), `CoverageGroup`, `DocumentRequest` (label, quote, count, quote stored UNMASKED), `PackageGateReason` (level block or warn, text). `maskQuote` and `maskAndClamp` are in the import-graph ALLOWED set.
- Existing screens: `StructureScreen` has the early `if (!view)` return and holds the lens in local state without any reset today; `GateButton` calls `gatePillView(hasDocument, gate)` where `gate` carries `unreadable`; `FindingsScreen` has `findings-meta` in `findings-header`; `CounselScreen` has `counsel-gate-line`, `counsel-no-firm` and a `phase !== 'ready'` branch; `exportDocx.ts` exports `DOCX_MIME`, `docxFilename`; `last-doc.ts` `parseLastDoc` drops `packageId` today; `review.ts` saves `meta` at open and `attachPackage` does not re-save.
- No Phase 3 testid or file name exists yet (no collision with Phase 2 testids or the nine existing `intake-*` specs); all ten regression spec files and the five R1 spec files exist.

Prior-gap resolution (cycle 2 contract to this contract; all G1-G8 stay resolved):
- N1 (CONCERN, fixed in plan, 3b-B3): the merged gate for `gatePillView` must spread the core gate so `unreadable` survives; a fresh `{status, reasons}` would show Ready for a no-text document and undo 1f5cfa5. Plan text and E7 updated.
- N2 (CONCERN, fixed in plan, 3a-A2): lens reset wording contradicted E3. Now: reset only when the active lens is `package` AND `phase === 'ready'` AND the view is null; `usePackageView()` is called before the `if (!view)` early return.
- N3 (CONCERN, fixed in plan, 3a-A8 and 3c-C4): the Phase 1 hand-off (quotes stored unmasked) was tested only at export. Unit gates now assert on-screen masking for the lens quotes and `gp-request-quote`, plus export masking.
- N4 (CONCERN, fixed in plan, J0): the old text could stop the join with `NEEDS_CONTEXT` for a save site that does not need to change for multi-file packages. Now: Hartwell and demo packages already save `packageId`; only `parseLastDoc` and `restoreLastDocument` change; one-document reload is an optional `App.tsx` subscribe or a named Known-Gap.

Ruling checks:
- R1 (one-document packages show coverage line and Package tab; Samples-list opens show none): consistent across 3a-D1, 3b-D4 (asserts absence for Samples-list opens #3 and #11 and a tiny or hostile classic upload, presence for `sections-parts.html`), 3c-D2 (GP group present for the one-document package, absent for samples and classic), and the five R1 existing specs in J3 (additive assertions by the join agent only).
- R2 (reload restore): unit gate `restore-last-doc` (parse keeps a valid `packageId`, drops an invalid one, package branch used, classic fallback) plus e2e `intake-reload-restores-package` (reload without `package-recent-option`).

Disjointness re-proof: 3a = `features/package/{PackageLens,PackageDocuments,PackageReferences,PackageTerms,PackageCoverageTable}.tsx`, `package-lens.test.tsx`, `styles/package-lens.css`, `features/structure/{StructureScreen.tsx,model.ts}`, 6 specs. 3b = `features/gate/{CoverageLine,PackageGateReasons}.tsx`, `package-gate-ui.test.tsx`, `styles/package-gate.css`, `shell/GateButton.tsx`, `features/review/FindingsScreen.tsx`, 4 specs. 3c = `features/counsel/{GpRequestGroup.tsx,exportRequestDocx.ts,gp-request-group.test.tsx}`, `test/request-export-contents.test.ts`, `styles/package-request.css`, `features/counsel/CounselScreen.tsx`, 2 specs. Pairwise disjoint, no overlap with any Phase 2 file. Join-only files: `state/last-doc.ts`, `App.tsx`, `test/restore-last-doc.test.ts`, `intake-reload-restores-package.spec.ts`, and additive edits to the R1 existing specs (J3 only). Nothing under `apps/worker`, `packages`, `registry.ts`, `Sidebar.tsx`, tokens. No new screen, route or sidebar item.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC-I8 | corrected type or role survives reload and drives coverage | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-correction-persists` | B |
| AC-I8 (reload, R2) | package view survives a plain reload | Fully-Automated | `pnpm --filter @aduin/web test restore-last-doc` plus `pnpm --filter @aduin/web test:e2e intake-reload-restores-package` | B |
| AC-I9 (lens) | baseline markable from lens, same firm only | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-package-lens` | B |
| AC-I12 (UI) | unclear reference shown for confirmation, never guessed | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-reference-confirm` | B |
| AC-I14 | term defined in LPA listed, 0 false undefined-term finding | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-crossdoc-terms-no-false-positive` | B |
| AC-I15 | term defined nowhere still an error; #11 Units still flagged | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-crossdoc-terms-real-error` | B |
| AC-I16 | no LPA gives unverified terms, counted, not flagged | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-terms-unverified-without-lpa` | B |
| AC-I17 | coverage per group in lens, popover and header | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-coverage-visible` | B |
| AC-I18 | partial coverage line visible next to the gate | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-coverage-next-to-gate` | B |
| AC-I19 (warn) | missing LPA warns only; gate label as the core gate dictates | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-gate-warning-policy` | B |
| AC-I19 (block) | missing sub agreement shows Blocked with reason and count one higher; no-text pill still wins | Fully-Automated | `pnpm --filter @aduin/web test package-gate-ui` (unit; end-to-end reach is the G6 residual) | B, with D residual |
| AC-I20 | one GP item per missing document; one DOCX holds each once, quotes masked | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-missing-docs-request-export` plus `request-export-contents` plus `gp-request-group` | B |
| quote masking | quotes masked on screen and in the DOCX (Phase 1 hand-off) | Fully-Automated | unit `package-lens`, `gp-request-group`, `request-export-contents` (assert `maskQuote(q)` present, raw `q` absent) | B |
| AC30 slice | roles, labels, icon-plus-word status | Fully-Automated | unit tokens `package-lens`, `package-gate-ui`, `gp-request-group`; manual keyboard pass is Phase 4 | B, with D residual |
| R1 samples and one-document | no package UI for Samples-list opens and classic uploads; coverage line, tab and GP group for a one-document package | Fully-Automated | `pnpm --filter @aduin/web test:e2e intake-no-package-ui-on-samples` and `intake-gp-group-absent-without-package` | B |
| regression | base screens and header specs keep passing | Fully-Automated | J3 one token per call: `ingest-all-formats`, `restore-and-no-text`, `diff-pairs`, `sibling-clauses`, `compare-ai-summary`, `structure-view`, `gate-pill`, `counsel-gate`, `counsel-sheet`, `counsel-export`, `app-shell`, `layout-vs-mockup`, `investor-path-view`, `previously-handled-section`, `placeholder-routes`; unit `gate-pill`, `import-graph`, `source-guard` in the full web suite | A |
| contract freeze | no Phase 2, Worker or core file changed | Fully-Automated | `git diff --quiet P3_BASE -- apps/worker packages` plus the partition of `git diff --name-only P3_BASE -- apps scripts packages` | B |
| render-first | package surfaces never fetch or await session | Fully-Automated | J1b: `grep -rnE "fetch\(\|ensureSession\|getSession\|turnstile\|sendBeacon\|XMLHttpRequest"` over the new surface files prints nothing (grep exit 1) | B |

Failing stub (Fully-Automated unit rows; consumed red-first by the execute agents):
- `package-lens`: `test("should render documents, references, terms and coverage from a PackageView", () => { throw new Error("NOT IMPLEMENTED — TDD stub: package lens sections") })`
- `package-gate-ui`: `test("should show Blocked with the reason and a count one higher for a package with no sub agreement", () => { throw new Error("NOT IMPLEMENTED — TDD stub: package gate block") })`
- `request-export-contents`: `test("should list every request exactly once with its masked quote", () => { throw new Error("NOT IMPLEMENTED — TDD stub: request docx contents") })`
- `gp-request-group`: `test("should render one item per request with count and none-state, nothing without a package", () => { throw new Error("NOT IMPLEMENTED — TDD stub: gp group") })`
- `restore-last-doc` (join, additive): `test("should keep a valid packageId, drop an invalid one, and use the package branch only when restorePackage returns true", () => { throw new Error("NOT IMPLEMENTED — TDD stub: restore package branch") })`

Legacy line form:
- 3a Package lens: [Fully-automated: `pnpm --filter @aduin/web test package-lens` + six `intake-*` specs in Step D] | [known-gap: manual keyboard pass is Phase 4]
- 3b coverage and gate: [Fully-automated: `pnpm --filter @aduin/web test package-gate-ui` + four `intake-*` specs] | [known-gap: block reason end-to-end reach, unit-proven only (G6)]
- 3c GP group and request DOCX: [Fully-automated: `request-export-contents`, `gp-request-group` + two `intake-*` specs]
- Join: [Fully-automated: J0 `restore-last-doc` + `intake-reload-restores-package`, J1 partition, J1b grep gate, typecheck, `pnpm lint`, full web unit suite, 12 serialized Phase 3 specs, 15 regression and R1 specs] | [known-gap: one-document package reload, only if the optional re-save is not done]

Dimension findings:
- Infra fit: PASS — vitest include and jsdom verified; the three component tests sit at collected paths; render helper, `downloadBlob`, `DOCX_MIME`, ALLOWED masking imports and the `gate-pill.ts` seam all exist; every Phase 2 name matches the real code.
- Test coverage: PASS — every AC, R1, R2 and the masking hand-off map to a Fully-Automated gate; the only residuals (block path end-to-end reach, optional one-document reload, keyboard pass) have a unit or e2e gate for the developed behavior plus a named stub, so no vacuous green.
- Breaking changes: PASS — existing-file edits (`StructureScreen`, `structure/model.ts`, `GateButton`, `FindingsScreen`, `CounselScreen`, join: `last-doc.ts`, `App.tsx`) are additive and null-safe; testids, `findings-meta` text, the six tabs, counsel export, Sidebar and gate-pill strings unchanged; the `unreadable` no-text gate is preserved (N1).
- Security surface: PASS — no auth, billing, schema, network or secret surface; React escaping only; quotes masked at every render and export edge and now asserted; IndexedDB `packageId` is validated by `SAFE_REF` before use; 0 live model calls; no high-risk class, so no evidence pack.
- Section A (Track 3a Package lens): PASS — targets exist; highest-risk edit is the `StructureLensId` typing across `TableLens`, `lineFor` and `onTabKey`, plus hook order (E3).
- Section B (Track 3b coverage and gate): PASS — builds on `gate-pill.ts` without editing it; highest-risk edit is the merged gate and count in `GateButton` (E7).
- Section C (Track 3c GP group and request DOCX): PASS — placement points exist; highest-risk edit is `exportRequestDocx.ts` masking and dedupe (E6).
- Section J (Join): PASS — J0 uses only `last-doc.ts`, `App.tsx` and the existing unit file; partition pathspec and grep gate exact; serialized e2e is run by a spawned vc-tester.

Plan updates applied: P1 3a-A2 (reset rule and hook order); P2 3a-A8 (on-screen masking assertion); P3 3b-B3 (spread core gate, keep `unreadable`); P4 3c-C4 (on-screen masking assertion); P5 J0 (no NEEDS_CONTEXT stop; package branch ordering; optional one-document re-save or named Known-Gap).

Execute-agent instructions:
- E1. Before writing a unit test, confirm its path matches the vite `include` and that `pnpm --filter @aduin/web test <token>` runs more than 0 tests; never edit `vite.config.ts`.
- E2. Commit only your own files with an explicit pathspec: `git commit <your paths> -m ...` (never a plain `git commit` after `git add`: the index is shared). If `.git/index.lock` exists, wait and retry; never delete it. Format only your own files: `pnpm exec prettier --write <own paths>`. Never run stash, checkout, reset or restore.
- E3. StructureScreen: call `usePackageView()` among the top hooks, before the `if (!view)` early return. Reset the lens to the default ONLY when the active lens is `package` AND `phase === 'ready'` AND the package view is null (every other lens persists as today; `structure-view` must pass unchanged); never reset while `refreshing`. Keep the `Package` tab in the arrow-key order; type the lens as `StructureLensId` and narrow before calling `lineFor`, `visibleCount`, `TableLens`.
- E4. A11y: every select has an accessible name that includes the document or reference; status is icon plus word; the `Package` tab warning is icon plus screen-reader text; key rows by `doc.id` and `targetKey`; `package-reference-show` and selects are native; no colour-only state.
- E5. Observable-correction specs (`intake-correction-persists`, `intake-package-lens` baseline step): read the current role or type first and choose a DIFFERENT value, then assert the same observable (for example the `Units` term turning unverified when the LPA type is changed away from `lpa`, or Fund II listed in `baselines`) before reload and after restore from `package-recent-option`. Never assume the default role of Fund II.
- E6. `buildRequestDocx`: defensively dedupe by `targetKey` then by lower-cased label, keep the first quote and the count; mask every string; zero items prints "No missing documents."; the `request-export-contents` unit feeds a duplicated input to prove it. `buildCounselDocx` and `exportCounselSheet` stay unchanged (`counsel-export-contents` unit and `counsel-export` spec re-run).
- E7. `GateButton`: build the merged gate as `{...gate, status, reasons}` so `unreadable` is preserved; label strings and icons stay exactly as today when only warnings exist; pass the merged gate to `gatePillView` AND use the merged count in the `gn` badge (today it prints `gate.reasons.length`); the popover list still receives core `gate.reasons` only (package reasons are not `GateReason` objects); `package-gate-ui` includes a no-text case (unreadable stays the unreadable pill); `gate-pill` spec and unit pass unchanged.
- E8. New surfaces never fetch, never await session or Turnstile, never write memory, Dexie or the server; the only `@aduin/core` value imports allowed are `maskQuote` and `maskAndClamp`; everything else is type-only; no hex colour literal and no `.innerHTML =` or `dangerouslySetInnerHTML` anywhere under `src/` including the new `*.test.tsx` files (source-guard scans test files under `features/`).
- E9. Join agent: the partition check is `git diff --name-only P3_BASE -- apps scripts packages`; attribute any file outside the three tracks to its owner (parent session or the sibling Variance program, which also edits `FindingsScreen.tsx`, `GateButton.tsx` and `features/counsel/*` later) before treating it as an overlap; run each token one per call; the serialized e2e is run by a spawned vc-tester, not inline.
- E10. 3a-A5 select for `unclear` references: candidates are `view.documents` (non-primary) of the reference's `targetFamily` type; for the `annex` family (no document type) offer all non-primary documents plus "None of these"; `package-lens.test.tsx` asserts both cases.
- E11. Single-file packages appear only after findings render: specs use web-first assertions (`expect(locator).toBeVisible()`) for `package-lens`, `findings-coverage-line` and the Package tab; never an immediate `count()` or `isVisible()`.
- E12. `intake-gate-warning-policy` derives the expected `gate-button` label from the same document opened without a package (classic upload of the same file), not from an assumed "Ready to digitize".
- E13. Masking tests: pick a quote for which `maskQuote(q) !== q` (assert that precondition in the test), then assert the rendered DOM text and the mammoth text contain `maskQuote(q)` and never the raw `q`. Core stores quotes UNMASKED.
- E14. J0 order inside `restoreLastDocument`: `loadLastDoc`, then if `last.packageId && deps.restorePackage` and `deps.isEmpty()`, call it and return true on success; on false fall through to the unchanged source branches. `parseLastDoc` keeps `packageId` only when it is a string passing `SAFE_REF`; never reject the row for a bad `packageId`. The e2e `intake-reload-restores-package` uses the Hartwell package (multi-file), not a one-document package.
- E15. In specs, "sample #N" means opened from the Samples list (classic); a raw upload of the same file is a different path (R1). Do not edit any Phase 2 spec or fixture.
- E16. Typecheck errors originating outside your track's files are reported, not fixed; if a track needs a contract or Phase 2 file change, stop with `NEEDS_CONTEXT`.

High-risk pack: not required (no auth, billing, schema, API contract, runtime or secret change).

Backlog artifacts (to write at UPDATE PROCESS, not now; the validator writes only this plan file):
- `package-gate-block-e2e-reach_NOTE_17-10-26.md` in `process/features/fund-package-intake/backlog/`: the package block reason and the `counsel-gate-line` and `findings-meta` core-only count are unit-proven only.
- `package-single-restore-on-reload_NOTE_17-10-26.md` (only if the optional J0 re-save is not done): a one-document package reloads as a classic document, with no coverage line.
- Per-agent Playwright ports (existing backlog P6-2).

Open gaps:
- G6 [known-gap: documented as backlog stub, not counted as CONCERN]: the `block` path of `GateButton` (no subscription agreement) is proven in unit only; `counsel-gate-line` and `findings-meta` count core reasons only; stub `package-gate-block-e2e-reach_NOTE_17-10-26.md`; gap-resolution D.
- One-document package reload [known-gap, conditional]: stub `package-single-restore-on-reload_NOTE_17-10-26.md`; gap-resolution D; Hartwell reload is Fully-Automated.
- Manual keyboard and screen-reader pass: known-gap carried to Phase 4 `intake-a11y-keyboard` and the base program.
- No other open gaps.

What this coverage does NOT prove:
- Unit gates prove rendering from synthesized views only; they do not prove real analysis output (Phase 1 goldens and Phase 2 store tests do).
- The e2e specs run in the preview bundle; they do not prove live AI or OCR, Worker, D1 or deployed behavior (Phase 4 smoke and operator residuals).
- No gate proves a manual screen-reader or keyboard pass; the axe and keyboard run is Phase 4.
- Findings-render-before-package timing is proven in Phase 2 `package-store` and the Phase 4 perf budget, not by any Phase 3 gate beyond the J1b grep.
- A package with no subscription agreement cannot be opened through the UI (the run is held), so the Blocked pill and reason are proven by unit only; the Counsel gate line and `findings-meta` for that case are not asserted.
- The DOCX is parsed as text; layout and Word rendering are not verified.
- Reload restore is proven for a multi-file package only; the 24 h purge boundary is a Phase 2 store test, not a Phase 3 gate.
- This pass did not execute any Playwright spec or any new Phase 3 gate (none exists yet); it verified names, paths and shapes against the real code and ran only `package-lens` (expected red), `restore-last-doc` and `gate-pill`.

Gate: PASS
Accepted by: n/a (no CONCERN open; N1-N4 were fixed in the plan; the G6 residual, the optional one-document reload and the Phase 4 keyboard pass are recorded known-gaps with backlog stubs, accepted under the autopilot decision policy for this run). No `## Autonomous Goal Block` is written here: the umbrella plan carries `## Stable Program Goal` (BRANCH B).
