---
name: plan:variance-mvp-phase-02-web-findings
description: "Variance MVP Phase 02 (V2): web Findings integration (engine-worker variance pass, baseline adapter, variance store, change rows, All/Errors/Changes filter, baseline control and modal, cosmetic groups, no-baseline line, gate pending display, shared count selector)"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: variance-management
  phase: phase-02
---

# Phase 02 - V2 Web: Findings

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** variance-mvp
**Umbrella plan:** process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-02-web-findings_REPORT_17-10-26.md (flat in the program task folder)
**Risk class:** medium (shared UI collision zone with Intake: Findings header, gate pill; render-first rule; no schema, no Worker, no deploy)
**Depends on:** Phase 01 (core engine, VERIFIED). Parallel-safe with Phase 03 (disjoint file sets, see registry). External: Intake feature closed before EXECUTE (Step 0).
**Context routers read:** `process/context/all-context.md`, `process/context/ui/all-ui.md`, `process/context/worker/all-worker.md` (render-first Deploy Rules), `process/context/tests/all-tests.md`.

---

## Overview

Surfaces the V1 engine in the existing Findings screen with no new screen and no sidebar item: an `All / Errors / Changes` filter, change rows (type chip, title, owner chip slot, status icons, expandable old-above-new text with strike-through for removed words and bold underline for added words, never colour alone, plus impact lines labelled "from the logic graph, deterministic"), a header baseline control (`vs <fund> <version> ▾`) with a modal, a "Show cosmetic changes (N)" filter option revealing at most 5 grouped rows, the muted no-baseline line, and the gate pill pending display. Variance is a second local pass in the engine worker; it never awaits session, Turnstile or memory (render-first).

Locked inputs: DECISION D2 (web `FindingView` gains an optional derived `kind`), D6 (baseline rules and the single adapter file), D9 (render-first, gate pending UI-only, chips exclude change rows). UI contract: `design/mockups/app-variance.html` plus `design/mockups/app-variance_NOTES.md`; where the mockup shows cut features (Tier 2/3, first-review groups, 3-state gate, rules-in-effect, cross-doc) the SPEC governs.

Owner chip, owner override, Questions grouping, answer modal and regression client wiring are NOT here (V4). This phase renders the owner chip slot read-only from `suggested_owners`.

## Step 0 - Precondition: re-sync with Intake before EXECUTE

Re-sync with Intake's landed code (inner R+I refresh) before EXECUTE: read Intake's final PLAN and closeout and its landed diff; update the `## Dependencies on Intake` section of the umbrella (observed vs assumed to observed); re-allocate the migration number; re-check the collision files in the phase-blast-radius registry; write an `## Inner Loop Refresh Note` in this plan. EXECUTE may not start until the Intake feature is closed.

Phase-specific Step 0 checks (all collapse onto `baseline-source.ts`): (a) confirm the adapter against Intake's LANDED code. Intake's plan (observed in its INNOVATE and Phase 2 plan, code not yet landed at planning time) exposes: `usePackageView()` returning a `PackageView` (`firmId`, `documents[]` with `role`, `baselines: {docId, name}[]`) that is `null` unless the open document is the package primary in the `ready` phase (so it is null for sample opens and the classic single-file path); store actions `usePackage.getState().setRole(docId, role)` (returns `{ok}` or reason `unknown_doc|primary_locked|cross_firm|role_not_allowed`), `baselineDocs()`, `addEarlierDocument(storedDocId)`; the pure core `eligibleBaselines(pkg, candidates)` (same-firm only); documents in Dexie `documents` (new optional `packageId`) and a Dexie `version(2)` `packages` table. Resolution order implemented in `baseline-source.ts`: (1) when a `PackageView` exists, the package baseline documents (`baselines`), with `setBaseline` calling `setRole(docId, 'baseline')`; (2) otherwise (sample opens, classic single-file path, and the L5 'this document becomes the baseline' write) a firm pointer in `uiState` over same-firm stored documents, candidates filtered with `eligibleBaselines`. Record in the Refresh Note which of Intake's names changed when it landed. (b) Read Intake's `DocMeta`/`openDocument` changes in `state/review.ts` and its Findings header change (coverage line) and re-plan the header placement of the baseline control and filter segment so both elements coexist. (c) Dexie: confirm Intake's `version(2)` stores; this phase adds NO version bump (all variance client state uses the `uiState` key-value table). (d) Confirm how e2e specs load two same-firm documents with a chosen firm (upload through the open-document flow; the existing firms `firm-x`, `firm-y`, `partners-group` are available now; `hartwell-crane` arrives in V3 so V2 specs must not use it). (e) Candidate fixture inputs (subject to a Step-0 "committed?" check, `git ls-files samples/packages`): the design session is generating fictional DOCX packages under `samples/packages/` (Northgate III with a Fund II baseline, Lotus Bay II with a prior-draft baseline, Redwood Ridge I with no baseline). If committed, `variance-baseline-from-package` uses Northgate III or Lotus Bay II for the package-with-baseline case and `variance-no-baseline-errors-only` may use Redwood Ridge I for a package no-baseline case; if not committed, the existing fixture plan (two same-firm uploads through the open-document flow) is the fallback. Record the outcome in the Refresh Note. (f) Cross-phase rule: Phase 01 keeps `detail.facts` scalar-only, so ALL variance metadata (`assertion_candidate`, `suggested_owners`, impact lists, uncertain flag) is read ONLY through core `varianceMetaOf` (the sole decoder); no web file reads facts objects directly. (g) Cross-phase requirement P01 must satisfy: Phase 01 `VarianceResult` (or, if P01 does not, the worker wrapper in `apps/web` `engine.worker.ts`) MUST carry `gatePolicy`, `rulesVersion` and `rulesHash8` as plain JSON; check P01's `VarianceResult` at Step 0 and add them in the worker wrapper when absent.

## Phase Completion Rules

- CODE DONE = checklist A to I implemented and committed; web unit and the listed e2e specs green.
- VERIFIED = Exit Gate green, validate-contract written, regression evidence for overlapping surfaces (`counsel-gate`, `gate-pill`, `diff-pairs`, `memory-no-reflag`, `turnstile-no-block`, `a11y-keyboard`, `layout-vs-mockup`, `no-llm-corpus`, `sample-zero-calls`, `import-graph`). Code-only completion is CODE DONE.
- AC-V1 stays CONDITIONAL until BOTH resolution paths are exercised by a gate (package role path and the firm-pointer path) and the umbrella records the Intake names actually used; Known-Gap is never the proving strategy.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy |
|---|---|---|---|
| AC-V1 | baseline = package role baseline, same firm only; header control changes the role; other-firm and other-workspace documents never offered even with identical text | `variance-baseline-from-package` plus `variance-baseline-same-firm-only` (e2e) | Fully-Automated |
| AC-V3 | cosmetic hidden by default, count stated, filter reveals at most 5 grouped rows | `variance-cosmetic-hidden-default` (e2e) | Fully-Automated |
| AC-V8 | no baseline: muted line, Errors only, empty Changes filter; after review the document becomes the firm baseline and is offered next time (when its text is in the browser) | `variance-no-baseline-errors-only` (e2e) | Fully-Automated |
| AC-V9 (web part) | AI findings that contradict the rules change no class, owner or gate; AI never gates even if asked | `variance-ai-never-gates` (e2e, stubbed contradicting AI frames, no live call) | Hybrid |
| AC-V20 (web part) | no-LLM run shows variance rows; repeated opens give identical rows | `variance-no-llm-full-run-web` (unit/e2e) plus existing `no-llm-corpus` | Fully-Automated |
| Render-first (L, D9) | findings render without awaiting variance, session, Turnstile or memory; no flash of Ready then Blocked | `variance-render-first` (e2e: errors painted before variance completes; pill pending then final) plus `turnstile-no-block` regression | Fully-Automated |
| Counts agree (mockup rule) | Findings segment, header counts, sidebar badge derive from one selector | `variance-counts-selector` (unit) | Fully-Automated |

## Entry Gate

- Phase 01 VERIFIED (core exports `runVariance`, `varianceMetaOf`, `loadVarianceRules`, `computeGate` with `policy`).
- Intake closed (Step 0). Working tree clean in the blast radius.

## Touchpoints

Create (all new, owned by V2):
- `apps/web/src/features/variance/types.ts`, `baseline-source.ts` (THE single coupling point to Intake: `listBaselineCandidates(doc)`, `resolveBaseline(doc)`, `setBaseline(docId)` (same firm only, rejects cross-firm), `bytesAvailable`), `variance-store.ts` (state: `idle|running|ready|none|error`, baseline pointer, results; persisted client state in `uiState` keys `variance:baseline:{firmId}` and `variance:triage:{docId}`), `select.ts` (ONE counts selector shared by the Findings segment, header counts, sidebar badge and, later, the gate popover), `ChangeRow.tsx` (owner chip slot read-only), `ChangeDiff.tsx`, `ImpactLines.tsx`, `BaselineControl.tsx`, `BaselineModal.tsx`, `CosmeticGroups.tsx`, `NoBaselineLine.tsx`
- `apps/web/src/styles/variance.css` (existing tokens only; 4 px radius; serif for document text)
- `apps/web/test/variance-{counts-selector,baseline-source-contract,store,no-llm-full-run-web}.test.ts`
- `apps/web/e2e/variance-{baseline-from-package,baseline-same-firm-only,cosmetic-hidden-default,no-baseline-errors-only,ai-never-gates,render-first}.spec.ts`
- `apps/web/e2e/fixtures/variance.ts` (shared helper, V2-owned; V4 and V5 append only)

Modify (additive):
- `apps/web/src/engine/{engine.worker.ts,types.ts,client.ts}` (additive `runVariance` method returning plain JSON; reuses the diff `prepare` helper; no change to existing methods; shared with other phases, serialized after prior owners)
- `apps/web/src/state/review.ts` (additive variance slice and the trigger after deterministic render; edit scope: variance actions PLUS the three gate-consistency call sites: `gateLine` (~line 507), the dismiss toast (~line 697) and the dismiss next-selection (~lines 680 and 692), all routed through the merged-row variance-policy gate; no other edits), `apps/web/src/state/filters.ts` (new fields `kind: all|errors|changes` and `showCosmetic`, defaults added so `loadFilters` stays valid)
- `apps/web/src/features/review/{FindingsScreen.tsx,use-review-view.ts,model.ts}` (segment, header baseline control, change rows, no-baseline line; chip counts and `Errors N` count only `kind=error`; `computeGate` called with the variance policy only when a baseline resolved)
- `apps/web/src/shell/GateButton.tsx` (UI-only "Checking changes" pending display)
- `apps/web/src/e2e-hook.ts` (additive, `IS_E2E`-guarded variance delay-in-ms and variance-fail seam read by the engine worker call path) and the `EngineSettings` field in `apps/web/src/engine/types.ts` carrying it (absent in production builds)
- `apps/web/test/no-e2e-hook-in-dist.test.ts` (extend the existing markers: production dist contains none of the new variance-hook markers; the e2e build contains them)
- `apps/web/test/import-graph.test.ts` (ALLOWED: append the main-thread value imports actually used, expected `varianceMetaOf`; single appended line, serialized seam)
- Repairs by derivation only if a base spec breaks on changed counts (narrow, one expectation at a time, each logged in the phase report): ANY spec in the Regression block, in particular `apps/web/e2e/{gate-pill,filter-sort,app-shell,placeholder-routes,a11y-smoke,a11y-keyboard,layout-vs-mockup,sample-zero-calls,no-llm-corpus,diff-pairs}.spec.ts`, and `apps/web/src/smoke.test.tsx`; and Intake's `apps/web/e2e/intake-*.spec.ts` that load a package WITH a baseline role (observed: the Intake demo package has a Fund II baseline, so variance now also runs there and may add change rows and the gate pending display); repair only the affected expectation, narrowly, and log each in the phase report
- `apps/web/src/features/review/use-review-view.ts` is ALSO edited by Intake (it exposes `pkg` and `pkgGate` next to `gate`); V2 changes only how `gate` is computed (variance policy) and merges variance counts, leaving Intake's additions intact; Intake's `GateButton.tsx` combines `core gate OR package block reasons`, so the V2 pending display is added next to that expression, not replacing it

Not touched in V2: `apps/web/src/features/{counsel,gate,compare,memory,open-document,structure}/**` (V4 owns counsel and gate; open-document is Intake's), `apps/web/src/api/**`, `apps/web/src/storage/db.ts` (no Dexie bump), `packages/**`, `apps/worker/**`, README, `docs/**`, `design/**`.

## Public Contracts

- No new screen, route or sidebar item. Hash routes and "route never persisted" unchanged.
- Engine worker API: one additive method; all existing methods and types unchanged.
- `FindingView` gains an optional derived `kind` (web type, not a frozen contract); errors keep `kind=error` semantics for chips.
- `Triage` shape unchanged; change rows use the same triage store keyed by finding id.
- The gate has exactly two states; the pending display is UI-only (`computeGate` unchanged in V2).
- All variance metadata is read on the web side only through core `varianceMetaOf` (sole decoder; Phase 01 keeps `detail.facts` scalar-only). Web code never reads facts objects directly.
- Engine worker `runVariance` result returns `gatePolicy`, `rulesVersion` and `rulesHash8` as plain JSON (loaded inside the worker); the main thread imports only `varianceMetaOf` (no `loadVarianceRules` on the main thread).
- `computeGate` (core) takes the variance policy as an optional 4th argument and `GateFinding.gates?`; the web wrapper in `model.ts` maps every change row to `gates: true` (see F1).
- `import-graph` allow-list grows by at most the one runtime symbol actually needed.

## Blast Radius

Files directly modified or created: the Touchpoints list (about 14 new source files, 4 unit tests, 6 e2e specs, 1 fixture helper, 9 additive edits). Additional edit surfaces: `state/review.ts` gate call sites (gateLine, dismiss toast, next-selection), `engine/types.ts` + `e2e-hook.ts` + `no-e2e-hook-in-dist.test.ts` (e2e seam). Collision files with Intake: `state/review.ts`, `features/review/{FindingsScreen,use-review-view,model}.tsx/ts`, `shell/GateButton.tsx`, `import-graph.test.ts` (see registry). Frozen/guarded: `import-graph`, `layout-vs-mockup`, `counsel-gate`, `gate-pill`, `turnstile-no-block`.

## Implementation Checklist

### Section A - PLAN-time verifications (first tasks)

- [ ] A1. Gate pending visual: `grep` the shell and `features/gate` for an existing "pending" treatment. Observed at plan time: only `data-memory-state` on the Findings column exists; the pill has none. If none, add the UI-only flag in B/G (`variancePending` while a baseline resolved and variance is running); `computeGate` stays two states.
- [ ] A2. Confirm how the web engine worker bundle imports core JSON/`variance` (V1 A3 re-check in the worker build) and that `runVariance` output is structured-clone-safe plain JSON.
- [ ] A3. Confirm where CSS files are imported (existing `styles/memory.css` pattern) and register `variance.css` the same way.
- [ ] A4. Confirm how existing AI e2e specs stub `/api/ai` frames (helper in `apps/web/e2e/fixtures` used by `ai-resume`/`provenance`); reuse it for `variance-ai-never-gates`.
- [ ] A5. Confirm the Compare rule that scans/OCR documents are excluded (`compare/sources.ts`); apply the same rule: an OCR baseline shows a muted "baseline is a scan; add a text version" line, no diff; a scanned or OCR CURRENT document shows a muted "variance unavailable for scanned documents" line (status `none`-like, never `error`), errors keep working. Both lines are asserted (see B3 and E3).
- [ ] A6. Baseline run of regression gates before edits: `counsel-gate`, `gate-pill`, `diff-pairs`, `turnstile-no-block` (one token per call) and web unit `import-graph`; record counts.
- [ ] A7. Ripple prediction BEFORE editing (A6 extension): list every spec opening two or more same-firm documents in one test (observed: `sample-zero-calls` 5 opens, `filter-sort` 5, `gate-pill` 3, `a11y-keyboard` 3, `no-llm-corpus`, `diff-pairs`, `layout-vs-mockup`; Partners Group samples 3 to 5 share a firm). For each, predict the effect of the firm-pointer write after a no-baseline review (the first open becomes the baseline, so later same-firm opens run variance and may add change rows, a pending display and changed counts). Record predictions in the phase report, then compare to observed results; derived repairs are limited to confirmed predicted effects.

### Section B - Baseline adapter and store (AC-V1, AC-V8)

- [ ] B1. `baseline-source.ts` implements the two-step resolution order from Step 0 (a) (package baselines first, firm pointer second). Rules in both: one baseline per review; if more than one baseline, pick the most recently marked, tie-break `createdAt` descending then document id ascending, and surface a muted line "N other baseline(s) ignored (one baseline per review)"; same firm only, enforced here AND again inside core `runVariance` step 0; unknown firm means no baseline; `bytesAvailable=false` surfaces "baseline text is no longer in the browser; add it again" and skips the diff. An expired baseline (Dexie row older than 24 h) behaves as `bytesAvailable=false`. A scanned/OCR baseline surfaces the muted scan line and skips the diff.
- [ ] B2. `variance-store.ts` holds status and results; client state persisted only in `uiState` keys (no new Dexie table, no version bump). After a no-baseline review completes, write the pointer so the document becomes the firm's baseline (pointer path; when a package exists the document is already in it and the role is set through Intake's `setRole`).
- [ ] B3. Gate: `pnpm --filter @aduin/web test variance-baseline-source-contract` (both firms, identical text, never offered across firm or workspace; ASSERTS: tie-break order `roleMarkedAt` then `createdAt` desc then document id asc; the exact line "N other baseline(s) ignored (one baseline per review)"; the OCR-scan baseline line; the `bytesAvailable=false` line; the expired-baseline line) and `variance-store` (ASSERTS: one-baseline selection, stale-run drop by run id when the baseline changes mid-run, `uiState` keys `variance:baseline:{firmId}` and `variance:triage:{docId}`, the `resolving` to `error` timeout transition, no Dexie version bump; `gatePolicy`, `rulesVersion` and `rulesHash8` present in the stored ready result).

### Section C - Engine worker pass (render-first, D9)

- [ ] C1. `engine.worker.ts`: additive `runVariance(baselineDocRef, currentDocRef)` reusing the existing diff `prepare` path (two `runDeterministic` passes, about 0.34 s on #5/#6); calls core `runVariance`; returns plain JSON that also carries `gatePolicy`, `rulesVersion` and `rulesHash8` (read from core `loadVarianceRules()` INSIDE the worker, where imports are unrestricted), so the main thread never imports `loadVarianceRules`. `client.ts` and `types.ts` expose it. Never touches session, Turnstile or memory. Byte resolution (reuse the `compare/sources.ts` `loadSide` key scheme, not a new one): a sample document is fetched by its `s:` key, an uploaded document is read from its Dexie `documents` row by the `u:` key, and an Intake package document resolves through its `sampleRef` (fetch) or its Dexie row; the engine worker receives both documents resolved to refs/bytes and never fetches by itself. A scanned or OCR current document is detected before the pass and yields the muted "variance unavailable for scanned documents" line instead of an error state.
- [ ] C1b. E2E seam: add `apps/web/src/e2e-hook.ts` hook methods guarded by `IS_E2E` (variance delay in ms, variance failure) carried through an `EngineSettings` field in `engine/types.ts` and read in the `runVariance` call path only; extend `test/no-e2e-hook-in-dist.test.ts` with the production-absent and e2e-present markers. Used by `variance-render-first` (3 s delay case, failure case).
- [ ] C2. `state/review.ts`: trigger the pass only AFTER `result.findings` is set and rendered; failure sets `variance.status='error'` and a muted line, errors keep working. Variance findings are kept in a separate array, merged by the view layer; they are NOT fed into the AI lane or the memory-label refresh in this phase (AI candidates and labels are unchanged, so `record:author --check` cannot drift).
- [ ] C2b. Gate consistency in `state/review.ts`: route `gateLine` (~507), the dismiss toast (~697) and the dismiss next-selection (~680 and ~692) through the SAME merged-row variance-policy gate used by the view (one shared helper in `model.ts`/`select.ts`, not a second computation), so toasts never say "gate is now Ready" while the pill is Blocked. "Mark as expected" and "Ask owner" on change rows write LOCAL TRIAGE ONLY in V2 (the existing triage store; `decide()` needs a fingerprint and writes no firm-memory decision for change rows); owner choice and memory writes are V4.
- [ ] C3. Gate: `pnpm --filter @aduin/web test:e2e variance-render-first` (ASSERTS: with the C1b 3 s delay, errors are painted and usable while the pill shows "Checking changes" and never Ready-then-Blocked; no `/api/session` required; with the C1b failure case the muted error line appears, errors keep working and the pill leaves pending; the named timeout path ends pending) and `pnpm --filter @aduin/web test no-e2e-hook-in-d`.

### Section D - Change rows and filters (AC-V3)

- [ ] D1. `state/filters.ts`: add `kind` (`all|errors|changes`, default `all`) and `showCosmetic` (default false) with defaults so persisted `ui:v1:filters` from older sessions still load; state survives reload.
- [ ] D2. `FindingsScreen.tsx`/`use-review-view.ts`/`model.ts`: segment `All / Errors N / Changes N`; severity chips and the `Errors` count count only `kind=error`; Changes shows only `new` and `changed_logic` rows; "Show cosmetic changes (N)" off by default reveals at most 5 grouped rows (rule id, count, up to 3 examples).
- [ ] D2b. Merge boundary (decided, per consumer): `useReviewView().rows` INCLUDES change rows (needed by GateReasons labels and the Sidebar badge). DocPane marks: change rows get marks only for new/changed units anchored in the CURRENT text; removed-unit rows (`quote_side` old, anchor offset 0 or zero-length) create NO mark and are reachable from the list only (anchor-safe). JumpMenu counts include change rows under the Changes segment only. Sidebar: no edit, it reads `open` and `counsel` from the view. CounselScreen `questionRows` and `buildSheet`: asked change rows enter the Questions list with the generic `version_drift` wording until V4; on a NO-BASELINE run no change rows exist, so the existing `counsel-gate` and counsel export specs must be unaffected (explicit check in the regression block). GateReasons gets change rows through the same merged rows.
- [ ] D3. `ChangeRow.tsx`/`ChangeDiff.tsx`/`ImpactLines.tsx`: type chip (New / Logic), title, owner chip slot (read-only from `suggested_owners`), status icons; expanded row shows old text above new text with removed words struck through and added words bold-underlined (not colour alone), the quoted clause, location, impact (investor types, conditional paths, "Old form rule reusable yes/no", "uncertain" flag when set) and the line "from the logic graph, deterministic". Provenance line shows `variance_rules_version (hash8)`. Text is masked then clipped using the existing core mask contract. All metadata (impact lists, `suggested_owners`, `assertion_candidate`, uncertain flag) is read ONLY via core `varianceMetaOf`; never from `detail.facts` directly.
- [ ] D4. Existing change actions reuse the existing triage store: "Mark as expected..." uses the existing Dismiss modal with the required reason; "Ask owner" is the existing Needs-counsel action renamed on change rows only (the owner choice and per-owner questions are V4; here it sets status `counsel` and nothing else). Both actions on change rows write local triage only in V2 (no firm-memory write).
- [ ] D5. Gate: `variance-cosmetic-hidden-default` (e2e) plus the ChangeDiff/ImpactLines assertions owned by `variance-baseline-from-package` (see E3).

### Section E - Baseline control, modal, no-baseline line (AC-V1, AC-V8)

- [ ] E1. `BaselineControl.tsx` in the Findings header (`vs <fund> <version> ▾`) opens `BaselineModal.tsx`: lists only same-firm earlier documents whose text is in the browser (suggested item pre-checked, error shown only on submit with nothing selected, never on open); selecting changes the baseline role per the adapter (Package path: `usePackage.setRole(docId, 'baseline')`, pointer path: the `uiState` firm pointer). No "Demo: simulate a new law firm" control.
- [ ] E2. `NoBaselineLine.tsx`: exact copy "No earlier document from this firm. Reviewing for errors only. This document becomes the baseline." Changes filter shows an empty state; errors work as today.
- [ ] E3. Gate: `variance-baseline-from-package`, `variance-baseline-same-firm-only`, `variance-no-baseline-errors-only` (e2e, one token per call). ASSERTIONS owned by `variance-baseline-from-package`: expanded change row shows old text above new, removed words in `del`/strike-through and added words bold-underlined (computed style, not colour), impact lines (investor types, conditional paths, reusable yes/no, uncertain flag) with the line "from the logic graph, deterministic", and the provenance line `variance_rules_version (hash8)`; the "N other baseline(s) ignored" line when two baselines exist (package path); a scanned/OCR baseline line and the "variance unavailable for scanned documents" line; the expired-baseline line (Dexie row aged via fixture helper). `variance-no-baseline-errors-only` also asserts that counsel specs/export are unaffected on a no-baseline run (D2b).

### Section F - Gate policy wiring and pending display (AC-V17 web part, D9)

- [ ] F1. `model.ts`: call `computeGate(rows, ..., policy)` with the variance policy (the `gatePolicy` returned as plain JSON by the engine worker `runVariance` result, stored in `variance-store`; the main thread imports only `varianceMetaOf` from core and never `loadVarianceRules`) ONLY when a baseline resolved and variance status is `ready`; errors-only reviews call it exactly as today (L5). Row-to-`GateFinding` mapping: the wrapper signature becomes `computeGate(rows, ..., policy?)`; each `Row` maps to `GateFinding` as today, and every row with `kind` change maps to `gates: true` (so untriaged change rows block under the policy); AI rows keep `gates` absent/false (AI never gates).
- [ ] F2. `GateButton.tsx`: while a baseline is resolved and the pass is running, render the UI-only pending display "Checking changes" (muted text beside the pill label, `aria-live` polite); the pill never shows Ready before the pass finishes. The `resolving` state is set in the SAME store update that sets `result.findings` (so no Ready-then-Blocked flash) and ends on resolved-none, ready or error; a named timeout constant (`VARIANCE_PENDING_TIMEOUT_MS`) forces error plus the muted line so pending never sticks. A no-baseline sample open goes `resolving` to `none` immediately (web-first `gate-pill` assertions retry; confirm in A7). Counts come only from `select.ts`.
- [ ] F3. Gate: `gate-pill` and `counsel-gate` regressions, `variance-render-first`, `variance-store` (timeout and `resolving` ordering).

### Section G - AI never gates (AC-V9 web part)

- [ ] G1. `variance-ai-never-gates.spec.ts`: stub `/api/ai` (no live call, any `openrouter.ai` request aborted per house rule) with a hand-built result frame whose AI finding quotes real change-clause text and contradicts the rules (says "cosmetic", suggests another owner); assert class, owner chip, impact and gate count are unchanged and that the AI finding never raises the gate even when asked.

### Section H - Unit selector and no-LLM

- [ ] H1. `variance-counts-selector` (Findings segment, header counts, sidebar badge, popover input all equal) and `variance-no-llm-full-run-web` (no network, repeated opens identical).

### Section I - Wrap-up

- [ ] I1. Full regression block (Exit Gate). I2. Append the `import-graph` ALLOWED line only for symbols actually imported on the main thread; run `import-graph`. I3. Phase report with regression lines.

### Edge cases carried from vc-scenario

1. Render-first: slow variance pass (simulated 3 s) must leave errors usable and the pill pending; a failed pass must not block errors or leave the pill pending forever (timeout to muted error line).
2. Baseline hazards: baseline document expired from Dexie after 24 h; baseline is an OCR scan; two baselines tie on `roleMarkedAt`; document of another firm with identical text; user changes baseline mid-run (stale result must be dropped by run id).
3. Count agreement: change rows must not inflate `Errors N` or the severity chips; Findings 9 / Questions 6 style badges agree with the segment counts.

## Test Gates (exact commands; no `--` token; one token per call)

```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction
for t in variance-counts-selector variance-baseline-source-contract variance-store variance-no-llm-full-run-web no-e2e-hook-in-d import-graph; do pnpm --filter @aduin/web test "$t" || exit 1; done
for t in variance-render-first variance-cosmetic-hidden-default variance-baseline-from-package variance-baseline-same-firm-only variance-no-baseline-errors-only variance-ai-never-gates; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
```

Regression block (run preview e2e serially, one agent at a time; port 4317 and `test-results` are shared):

```bash
for t in counsel-gate gate-pill diff-pairs memory-no-reflag turnstile-no-block a11y-keyboard layout-vs-mockup no-llm-corpus sample-zero-calls filter-sort app-shell placeholder-routes intake-multi-upload intake-baseline-role-same-firm intake-coverage-visible intake-coverage-next-to-gate intake-gate-warning-policy intake-no-package-ui-on-samples intake-no-llm-run; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
pnpm --filter @aduin/web test
pnpm --filter @aduin/web typecheck
pnpm lint
```

Never use the token `gate` alone for e2e (it also matches `gate-pill`). Do NOT run the `preview` and `stack-memory` projects together. Each one-token e2e call rebuilds the preview (3 to 6 s).

## Test Coverage Plan (routing chain loaded: all-tests.md)

| Area | Tier | Scenario | Command | Proves | Does NOT prove |
|---|---|---|---|---|---|
| apps/web/variance | Fully-automated | baseline from package role (via the Intake store) and from the firm pointer; header control; same-firm only | `test:e2e variance-baseline-from-package`, `variance-baseline-same-firm-only` | AC-V1 | Intake's confirmation-table UI itself (Intake's gates own it) |
| apps/web/variance | Fully-automated | cosmetic hidden, grouped on request | `test:e2e variance-cosmetic-hidden-default` | AC-V3 | counts on the 214 demo (V5) |
| apps/web/variance | Fully-automated | no baseline then becomes baseline | `test:e2e variance-no-baseline-errors-only` | AC-V8 | text kept beyond 24 h |
| apps/web/variance | Hybrid | contradicting stubbed AI changes nothing | `test:e2e variance-ai-never-gates` (precondition: e2e AI stub helper) | AC-V9 web | live-model behavior |
| apps/web/render | Fully-automated | errors painted before variance; no session needed | `test:e2e variance-render-first` | render-first rule | live Turnstile path (no site key in e2e builds; blind spot closed by the V5 live smoke) |
| apps/web/a11y | Agent probe | keyboard walk of the baseline modal, segment and change row (non-colour cues) | agent drives preview, records judgment; axe via `a11y-keyboard` regression | base AC30 on changed screens | screen-reader quality; manual keyboard pass remains a Known-Gap residual with backlog stub |
| design fidelity | Agent probe | compare Findings with `app-variance.html` at 1440 and 1024 (opt-in `DESIGN_PROBE=1`) | `pnpm exec playwright test --project=preview design-probe` from `apps/web` | visual fit | pixel parity |

Failing stubs: each Fully-automated row starts as `test("should <scenario>", ...)` throwing `NOT IMPLEMENTED - TDD stub for: <scenario>` in its named spec.

## Exit Gate

- All Test Gates and the regression block exit 0; counts recorded (web unit and preview e2e totals before and after).
- Umbrella `## Dependencies on Intake` rows 1 to 5 and 11 to 13 rewritten from observed landed code; AC-V1 verdict recorded accordingly.
- Report written; regression lines recorded.

## Blockers That Would Justify BLOCKED Status

- Intake changed `FindingsScreen` header or `state/review.ts` so that the baseline control and filter segment cannot coexist without redesign (needs a design-session decision).
- Step 0 shows Intake's package store has no stable same-firm setter or the package documents' bytes are not in the browser (then the firm-pointer path alone carries AC-V1, recorded CONDITIONAL with a backlog stub).
- `import-graph` would need more than one new runtime symbol (stop and replan).

## Phase Loop Progress

- [ ] 0. PRECONDITION - Intake feature closed; Step 0 re-sync done; adapter resolution order confirmed against Intake's landed code; Inner Loop Refresh Note written
- [ ] 1. RESEARCH - research-agent: Phase 01 report read in full; test context loaded; drift checked
- [ ] 2. INNOVATE - innovate-agent: approach decided (n/a if the DECISION still holds)
- [ ] 3. PLAN-SUPPLEMENT - plan-agent: existing phase plan updated (or "n/a - research clean")
- [ ] 4. PVL - vc-validate-agent: full V1-V7; validate-contract per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [ ] 5. EXECUTE - vc-execute-agent (opus): checklist done; per-section gates green
- [ ] 6. EVL - independent vc-tester: gates re-run; stubs registered; EVL HANDOFF SUMMARY
- [ ] 7. UPDATE PROCESS - phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder - vc-validate-agent writes this section before EXECUTE)", the orchestrator must spawn vc-validate-agent first. A partial contract is a placeholder.

Strategy (vc-agent-strategy-compare, PLAN-end): signals S2 weak, S7 (5+ files) = 1-2/7 LOW-MEDIUM; sections share `variance-store.ts`, `model.ts`, `FindingsScreen.tsx`, so recommended SEQUENTIAL single EXECUTE agent (opus). V2 and V3 EXECUTE may run as two separate agents in parallel ONLY with disjoint file sets per the registry and with serialized seam commits (`import-graph.test.ts`, `packages/core/src/index.ts` untouched by V2); default is sequential V2 then V3 to avoid the shared-checkout and port 4317 risks.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `variance-baseline-from-package` (package role path and firm-pointer path, both) | Fully-Automated | AC-V1 |
| `variance-baseline-same-firm-only` | Fully-Automated | AC-V1 |
| `variance-cosmetic-hidden-default` | Fully-Automated | AC-V3 |
| `variance-no-baseline-errors-only` | Fully-Automated | AC-V8 |
| `variance-ai-never-gates` | Hybrid | AC-V9 (web part) |
| `variance-no-llm-full-run-web` plus `no-llm-corpus` | Fully-Automated | AC-V20 (web part) |
| `variance-render-first` plus `turnstile-no-block` plus `no-e2e-hook-in-d` (3 s delay, failure case, pill pending then final, timeout) | Fully-Automated | render-first (L5, D9) |
| `variance-baseline-from-package` ChangeDiff/ImpactLines assertions (old above new, strike-through, bold-underline, impact lines, provenance line) | Fully-Automated | AC-V1 (rendering of baseline-driven rows) |
| `variance-baseline-source-contract` (tie-break, ignored-baselines line, OCR-baseline line, bytesAvailable=false, expired baseline) | Fully-Automated | AC-V1 |
| `variance-store` (stale-run drop, one-baseline selection, uiState keys, `gatePolicy` presence, timeout) | Fully-Automated | AC-V1 / render-first |
| `variance-no-baseline-errors-only` counsel-unaffected check plus scanned-current muted line | Fully-Automated | AC-V8 |
| `variance-counts-selector` | Fully-Automated | count agreement (feeds AC-V13/V17 in V4) |
| keyboard and design probes | Agent-Probe | base AC30 on changed screens |

## Test Infra Improvement Notes

- `apps/web/e2e/fixtures/variance.ts` becomes the shared two-document loader (upload with a chosen firm); V4 and V5 reuse it.
- Concurrent Playwright on port 4317 flakes (backlog P6-2); keep e2e serial. A per-agent port option would unblock parallel EXECUTE of V2 and V3.
- The e2e build has no Turnstile site key; render-first is only fully proven by the V5 live smoke.

## Resume and Execution Handoff

- Selected plan file path: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-02-web-findings_PLAN_17-10-26.md`
- Umbrella plan: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md`
- Last completed step: not started (EXECUTE held until the Intake feature closes; V1 must be VERIFIED first)
- Validate-contract status: pending
- Next step: after Phase 01 is VERIFIED and Intake is closed, spawn vc-research-agent for Step 0 plus RESEARCH. EXECUTE receives this one exact plan path.
- Validators: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this plan>`; `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <this plan>`.
- Hard rules for every agent prompt: never git stash, checkout, reset or restore; commit on main with conventional prefixes; never run git push in any phase (the user pushes); execution commits separate from process commits.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: outer-pvl
supersedes: 2026-10-17 (outer-pvl) - the PVL cycle 1 re-run CONDITIONAL contract (0 FAIL, 2 CONCERN: Gap 8, Gap 9); this PVL cycle 2 re-run has current evidence after the Gap 8-9 supplement

Parallel strategy: sequential
Rationale: 2/7 signals (S4 phase program, S7 five or more files); nominal MEDIUM would suggest parallel subagents, overridden to SEQUENTIAL because Sections B to F share `variance-store.ts`, `model.ts`, `FindingsScreen.tsx` and `state/review.ts`, Playwright port 4317 and `test-results` are shared, and the checkout is shared. One opus EXECUTE agent (1) plus one sonnet vc-tester for EVL (1); no fan-out, no cost guard. Note: like the earlier passes, this re-run executed its Layer 1 and Layer 2 checks inline and sequentially (the validate subagent has no spawn tool in this session); all four dimensions and all nine sections were assessed with read-only repo evidence.

Validation basis (PVL cycle 2 re-run from V1): `validate-plan-artifact.mjs` = 0 failures, 0 warnings. V1 Step 4: no `## Inner Loop Refresh Note` in the plan (the only mentions are Step 0 text, the Phase Loop Progress line and execute-agent instruction E1), so no re-validate trigger beyond the supplement itself. The real `## Validate Contract` heading was located line-anchored (`^## Validate Contract`, one hit); everything above it is preserved unchanged. Paths and facts re-verified read-only this pass: all twelve regression e2e specs exist under `apps/web/e2e/`; the seven `intake-*` regression tokens each appear in Intake's plan files (1 to 3 files each; an unmatched token would exit 1, so Step 0 re-verifies); `features/review/gateInterim.ts` re-exports core `computeGate`, which is already in the `import-graph` ALLOWED set, and the web wrapper `model.ts` `computeGate(rows)` maps `{id, severity, detector_kind}` (F1 adds `gates` and the optional policy); `import-graph.test.ts` checks that main-thread `@aduin/core` value imports are in the ALLOWED set and that the worker is the exempt file, so passing `gatePolicy` as plain JSON and importing only `varianceMetaOf` keeps the budget at one new symbol; `e2e-hook.ts` already has the `IS_E2E`-guarded hook pattern (`e2eSettings` returns `Pick<EngineSettings, ...>`), so the C1b seam extends an existing pattern; `process/context/tests/all-tests.md` line 208 confirms the kit hook rejects the word `dist` in commands and that the prefix token `no-e2e-hook-in-d` matches the same vitest file; the Phase 01 plan puts the gate policy inside `variance-rules.json`, exposes `loadVarianceRules` and computes `rulesHash8` in `rules.ts` (so the worker can read all three values); `samples/packages/` still holds three untracked fixture folders (Step 0 (e) "committed?" check applies); Intake's concurrent working-tree edits to `GateButton.tsx` and the new `features/gate/gate-pill.ts` are visible (collision handled by E4 and the registry). Blast Radius, Public Contracts, Touchpoints and Verification Evidence sections are present. No feasibility probe was needed (all checks were mechanical reads).

Prior gap closure (each item re-read against the current plan text):
- Gaps 1 to 7 (cycle 0 set): remain CLOSED and intact (e2e seam in Touchpoints, C1b and C3; the three `review.ts` gate sites in C2b; merge boundary in D2b; Row-to-`GateFinding` mapping and `resolving` rules in F1 and F2; named assertions in B3, C3, D5 and E3; widened derived repairs plus A7 ripple prediction; byte-resolution keys in C1 and A5 scanned-current line).
- Gap 8 CLOSED: the Test Gates loop (line `for t in ... no-e2e-hook-in-d import-graph`), C3 and the Verification Evidence row all use the prefix token `no-e2e-hook-in-d`. The remaining full-word mentions (Touchpoints, Blast Radius, C1b) are FILE PATHS, which the hook filter does not see, and are correct.
- Gap 9 CLOSED: Public Contracts, C1, F1, B3 and the Verification Evidence row all state that the engine worker `runVariance` result carries `gatePolicy`, `rulesVersion` and `rulesHash8` as plain JSON (read from `loadVarianceRules()` inside the worker), that the main thread imports only `varianceMetaOf` (budget of one new runtime symbol), and that `variance-store` asserts `gatePolicy` presence in the ready result; Step 0 (g) adds the cross-phase check that P01's `VarianceResult` (or the worker wrapper) supplies the three fields, with the worker-wrapper fallback.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC-V1 | baseline = package role baseline or firm pointer; header control changes it; same firm only, never another firm or workspace even with identical text; expanded change row shows old above new (strike-through and bold-underline by computed style), impact lines and provenance line | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-baseline-from-package`; `pnpm --filter @aduin/web test:e2e variance-baseline-same-firm-only`; `pnpm --filter @aduin/web test variance-baseline-source-contract` | B (stays CONDITIONAL at phase level until both resolution paths pass and the Intake names used are recorded, per the plan's own completion rule) |
| AC-V3 | cosmetic hidden by default, count stated, filter reveals at most 5 grouped rows | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-cosmetic-hidden-default` | B |
| AC-V8 | no baseline: muted line, Errors only, empty Changes filter; the document becomes the firm baseline and is offered next time; counsel specs and export unaffected on that run; scanned-current muted line | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-no-baseline-errors-only` | B |
| AC-V9 (web) | contradicting stubbed AI changes no class, owner, impact or gate; AI never raises the gate | Hybrid | `pnpm --filter @aduin/web test:e2e variance-ai-never-gates` (precondition: e2e AI stub helper `e2e/fixtures/ai.ts`; no live call) | B |
| AC-V20 (web) | no-LLM run shows variance rows, no network, repeated opens identical | Fully-Automated | `pnpm --filter @aduin/web test variance-no-llm-full-run-web`; `pnpm --filter @aduin/web test:e2e no-llm-corpus` | B |
| Render-first (L5, D9) | errors painted before variance completes (3 s delay case); pill pending then final; failed pass shows a muted line and leaves pending; timeout path ends pending; no `/api/session` needed; hook absent from production | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-render-first`; `pnpm --filter @aduin/web test:e2e turnstile-no-block`; `pnpm --filter @aduin/web test no-e2e-hook-in-d` | B |
| Counts agree | Findings segment, header counts, sidebar badge and popover input derive from one selector | Fully-Automated | `pnpm --filter @aduin/web test variance-counts-selector` | B |
| Client state | one-baseline tie-break, stale-run drop by run id, `uiState` keys, `gatePolicy`, `rulesVersion` and `rulesHash8` present in the ready result, `resolving` to `error` timeout, no Dexie bump | Fully-Automated | `pnpm --filter @aduin/web test variance-store` | B |
| Import budget | main thread adds at most the one runtime symbol `varianceMetaOf` | Fully-Automated | `pnpm --filter @aduin/web test import-graph` | B |
| Regression (overlapping surfaces) | existing Findings, gate, diff, memory, a11y, layout, no-LLM and Intake surfaces keep passing | Fully-Automated | the plan's Regression block (`counsel-gate gate-pill diff-pairs memory-no-reflag turnstile-no-block a11y-keyboard layout-vs-mockup no-llm-corpus sample-zero-calls filter-sort app-shell placeholder-routes` plus seven `intake-*` tokens, one token per call), `pnpm --filter @aduin/web test`, `pnpm --filter @aduin/web typecheck`, `pnpm lint` | A at baseline (A6), B after edits |
| NFR a11y (base AC30 on changed screens) | keyboard walk of the baseline modal, segment and change row; non-colour cues | Agent-Probe | agent drives the preview build and records a judgment; axe through `a11y-keyboard`; opt-in `DESIGN_PROBE=1 pnpm exec playwright test --project=preview design-probe` from `apps/web` | B |
| NFR a11y residual | human keyboard and screen-reader pass | Agent-Probe (the agent walk above is the proving strategy; the human pass is the named residual) | none automated | D (backlog stub on disk: `process/features/variance-management/backlog/variance-web-manual-keyboard-pass_NOTE_17-10-26.md`; never the proving strategy) |

Failing stubs (Fully-Automated rows only; destined for the execute-agent red-first start, not written to disk by VALIDATE):

- AC-V1 (`variance-baseline-from-package`, `variance-baseline-same-firm-only`, `variance-baseline-source-contract`): `test("should use the package baseline role and the firm pointer and never offer another firm's document", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: baseline from package/pointer, same firm only") })`
- AC-V3: `test("should hide cosmetic changes by default and reveal at most 5 grouped rows on request", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: cosmetic hidden by default") })`
- AC-V8: `test("should run errors only with the muted line when no baseline exists and then offer this document as the firm baseline", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: no baseline then becomes baseline") })`
- AC-V20 (web): `test("should show identical variance rows on repeated opens with no network", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: no-LLM full run web") })`
- Render-first: `test("should paint errors before the variance pass finishes and never leave the pill pending", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: render-first") })`
- Counts agree: `test("should derive segment, header, sidebar and popover counts from one selector", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: counts selector") })`
- Client state: `test("should pick one baseline by tie-break, drop a stale run, carry gatePolicy with the ready result and time out to a muted error", () => { throw new Error("NOT IMPLEMENTED - TDD stub for: variance store") })`

Legacy line form:
- apps/web/variance: [Fully-automated: `pnpm --filter @aduin/web test:e2e variance-baseline-from-package`, `variance-baseline-same-firm-only`, `variance-cosmetic-hidden-default`, `variance-no-baseline-errors-only`, `variance-render-first`] | [Fully-automated unit: `pnpm --filter @aduin/web test variance-counts-selector`, `variance-baseline-source-contract`, `variance-store`, `variance-no-llm-full-run-web`, `no-e2e-hook-in-d`, `import-graph`] | [hybrid: `pnpm --filter @aduin/web test:e2e variance-ai-never-gates` + e2e AI stub helper] | [agent-probe: keyboard walk and opt-in design probe] | [known-gap: human keyboard and screen-reader pass, documented as backlog stub]

Dimension findings:
- Infra fit: PASS - every path, runner and command resolves; the gate tokens now avoid the hook-filtered word (`no-e2e-hook-in-d`); the gate policy reaches the main thread as plain JSON from the worker, so the import budget stays at one new runtime symbol; the `e2e-hook.ts` seam extends an existing `IS_E2E` pattern
- Test coverage: PASS - every developed behavior has a Fully-Automated or Hybrid gate (ChangeDiff and ImpactLines, provenance, ignored-baselines, OCR-baseline, expired baseline, stale-run drop, `gatePolicy` presence, timeout, failed pass, scanned-current line, counsel-unaffected, import budget); the only Known-Gap is the human keyboard pass, a named residual with a backlog stub and an Agent-Probe proving strategy; the net-gate vacuous-green scan is clear
- Breaking changes: PASS - engine worker API additive; `FindingView` gains only an optional `kind`; `Triage`, hash routes and the gate's two states unchanged; merge boundary per consumer, the three `review.ts` gate sites and the Row-to-`GateFinding` mapping are decided; base-spec ripple is predicted (A7) and repairs are derived and logged
- Security surface: PASS - no auth, billing, secret, schema, Worker or deploy surface; the only trust boundary is client-side firm scoping of the baseline (adapter and again in core `runVariance` step 0; Fully-Automated e2e plus unit, above the hybrid minimum); text is rendered through React escaping and masked then clipped by the core mask contract; no new network call; the `IS_E2E` seam is proven absent from production by the marker test; no evidence pack required (browser-local, medium risk as stated)
- Section A feasibility (PLAN-time verifications): PASS - A1 to A7 mechanical; A5 rule exists in `compare/sources.ts`; A7 ripple prediction is a documented step before edits; highest-risk edit: none
- Section B feasibility (baseline adapter and store): PASS - `uiState` exists and is never purged, two-step resolution order matches Intake's observed-in-plan names (known-gap, Step 0 re-verifies); highest-risk edit: pointer write plus package `setRole` dual path, sequence the pointer path first
- Section C feasibility (engine worker pass): PASS - `prepare` reuse, `loadSide` keys, trigger-after-render, the seam and the worker-side policy transport are mechanically feasible; highest-risk edit: the `state/review.ts` trigger after `result.findings` is set (keep it in one narrow block; drop stale results by run id)
- Section D feasibility (change rows and filters): PASS - `loadFilters` additive-safe; merge boundary decided; local-triage-only change actions stated; highest-risk edit: `use-review-view.ts` shared with Intake (merge variance rows without touching `pkg` and `pkgGate`)
- Section E feasibility (baseline control, modal, no-baseline line): PASS - header coexistence with Intake's coverage line is a Step 0 (b) item with an explicit BLOCKED trigger; exact copy and error-on-submit-only are testable; `variance.css` must stay inside the `layout-vs-mockup` vocabulary (13 14 15 16 17 20 28 px; radii 0 2 3 4 999)
- Section F feasibility (gate policy wiring and pending display): PASS - mapping, `resolving` state, timeout and the policy source (`variance-store`, from the worker result) are specified; `gateInterim` is the core `computeGate` re-export already in the ALLOWED set; highest-risk edit: `GateButton.tsx` (Intake also edits it and has a pending Intake change to `features/gate/gate-pill.ts`; add the pending display next to Intake's expression)
- Section G feasibility (AI never gates): PASS - recorded-frame stubbing is established (`ai.ts`); a stubbed AI finding must quote text inside a real candidate (`llm-quote-scoped-to-candidate`), so take it from the recorded request, not invented
- Section H feasibility (unit selector and no-LLM): PASS - pure selector and the jsdom `api` import pattern (`engine-dispatch.test.ts`) make both gates mechanical; depends on the V1 corpus (entry gate)
- Section I feasibility (wrap-up): PASS - the `import-graph` allow-list is a plain `Set`; the plan expects one appended symbol (`varianceMetaOf`), now guaranteed by the worker-side policy transport

Net: 0 FAIL, 0 CONCERN, all 9 prior gaps closed, no new gap found. Net-gate vacuous-green scan: clear, every developed behavior has a Fully-Automated or Hybrid gate. Known Gaps (excluded from the CONCERN count; the plan has no `## Known Gaps (Resolved via Backlog)` section, so they are classified here): Intake interface names (including the source of the "marked" time for the baseline tie-break) and the seven `intake-*` regression tokens are OBSERVED-IN-PLAN and re-verified at Step 0; the not-yet-committed `samples/packages/` fixtures (Step 0 (e) "committed?" check); the two-document e2e loader and firm choice in the Intake-modified Upload modal (Step 0 (d)); P01's `VarianceResult` field list for `gatePolicy`, `rulesVersion` and `rulesHash8` (Step 0 (g), worker-wrapper fallback specified); the live Turnstile render-first path (backlog stub `variance-render-first-live-turnstile_NOTE_17-10-26.md`, closed by the V5 live smoke); the human keyboard and screen-reader pass (backlog stub `variance-web-manual-keyboard-pass_NOTE_17-10-26.md`); EXECUTE held until Intake closes (by design).

Open gaps: none (Known Gaps above are named residuals, not CONCERNs).

Backlog artifacts (named residuals; present on disk, written by another agent):
- `process/features/variance-management/backlog/variance-web-manual-keyboard-pass_NOTE_17-10-26.md` - human keyboard and screen-reader pass (resolution D)
- `process/features/variance-management/backlog/variance-render-first-live-turnstile_NOTE_17-10-26.md` - render-first with a human-solved Turnstile challenge on the deployed Worker (resolution C, closed by the V5 live smoke)

Execute-agent instructions (apply on top of the plan; the former E6 and E7 are now plan text and are dropped):
- E1. Step 0 first: do not start EXECUTE until the Intake feature is closed; rewrite umbrella `## Dependencies on Intake` rows 1 to 5 and 11 to 13, re-verify that the seven `intake-*` regression tokens exist (an unmatched token exits 1), write the `## Inner Loop Refresh Note`, and record which Intake names changed.
- E2. Red first: write each Fully-Automated stub above in its named spec or unit file, confirm it fails for the right reason, then implement; one token per call, never the `--` token, never the bare token `gate`; use the token `no-e2e-hook-in-d`, never the full word the hook filter rejects.
- E3. Sequence: Section A, then B (pointer path before package path), C, D, E, F, G, H, I; run the section gate after each; serial Playwright only on port 4317; never run `preview` and `stack-memory` together.
- E4. Shared files: when `state/review.ts`, `features/review/use-review-view.ts`, `FindingsScreen.tsx` or `GateButton.tsx` were changed by Intake (a concurrent Intake edit to `GateButton.tsx` and `features/gate/gate-pill.ts` is visible in the working tree), edit narrowly and leave Intake's additions intact; run `import-graph` after the single appended line.
- E5. Never git stash, checkout, reset or restore; commit on main with conventional prefixes; never run git push in any phase (the user pushes); execution commits separate from process commits.
- E6. Step 0 (g): read P01's landed `VarianceResult`; if it lacks `gatePolicy`, `rulesVersion` or `rulesHash8`, add them in the `engine.worker.ts` wrapper from `loadVarianceRules()`; if a second main-thread runtime symbol proves unavoidable, STOP and replan (the plan's own Blocker).
- E7. Baseline tie-break: B1 and B3 assert only the fields Intake's landed view really exposes; if no "marked at" time exists, the tie-break is `createdAt` descending then document id ascending (the `roleMarkedAt` step is dropped from the assertion and recorded in the Refresh Note).

Autonomous goal block: BRANCH B - umbrella plan `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md` carries `## Stable Program Goal` on disk (grep count 1), so no autonomous goal block section is written to this phase plan (the umbrella goal governs); reference for latest state: the umbrella plan path above.

Accepted by: session (autopilot, planning-only run, auto-select recommended option) - Gate PASS with no unresolved concern; the known gaps listed above are accepted as named residuals with backlog stubs or Step 0 re-verification.

What This Coverage Does NOT Prove:
- `variance-baseline-from-package` and `variance-baseline-same-firm-only`: Intake's confirmation-table UI itself, Intake code that has not landed (names are OBSERVED-IN-PLAN), baselines held longer than 24 h, the live deployed path.
- `variance-cosmetic-hidden-default`: counts on the 214-change Hartwell and Crane demo (V5), real-sample cosmetic precision (V1).
- `variance-no-baseline-errors-only`: text kept beyond 24 h; a sample baseline whose text is only fetchable, not stored.
- `variance-ai-never-gates`: live model behavior; a real OpenRouter reply; any AI-lane change in V4.
- `variance-no-llm-full-run-web` and `no-llm-corpus`: behavior on real uploads with Turnstile or a live Worker.
- `variance-render-first`, `turnstile-no-block` and `no-e2e-hook-in-d`: the live Turnstile path (no site key in e2e builds; closed by the V5 live smoke) and real-device timing.
- `variance-counts-selector`: owner groups and question counts (V4).
- `variance-store`: IndexedDB eviction by the browser, multi-tab races; the actual P01 `VarianceResult` shape until Step 0 (g) reads it.
- `import-graph`: runtime behavior of the worker bundle (only the static import list).
- Regression block: keyboard and screen-reader quality (agent walk plus axe only), pixel parity with `app-variance.html`, parallel Playwright (the block is serial).

Gate: PASS

Amendment 17-10-26 (user decision): no git push in any phase; commit locally only; the user pushes. Wording-only tightening, no gate change.
