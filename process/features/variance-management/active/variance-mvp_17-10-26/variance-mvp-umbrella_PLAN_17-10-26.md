---
name: plan:variance-mvp-umbrella
description: "Variance management slim MVP (V1 baseline diff and classification; V2 impact, owner routing, per-owner questions, answer intent/scope, one regression check) - umbrella/orchestration plan for the 5-phase program folded into the existing sub-doc QA app"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: variance-management
  phase: umbrella
---

# Variance Management Slim MVP - Umbrella Plan

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED (EXECUTE held until the Intake feature is closed)

- Program type: PHASE PROGRAM (5 phases; V2 and V3 parallel-safe, other joins gated)
- Feature folder: `process/features/variance-management/`
- Task folder (everything flat here): `process/features/variance-management/active/variance-mvp_17-10-26/`
- File naming note: the umbrella filename carries the literal `umbrella` token (`variance-mvp-umbrella_PLAN_17-10-26.md`) because `validate-plan-artifact.mjs` and `validate-umbrella-artifact.mjs` require it for any plan declaring `phase: umbrella`. Phase plans are `variance-mvp-phase-0N-{slug}_PLAN_17-10-26.md`.
- Locked upstream artifacts (read in this order): SPEC `variance-mvp_SPEC_17-10-26.md` (AC-V1..AC-V20, L1..L10), RESEARCH `variance-mvp_RESEARCH_17-10-26.md`, INNOVATE Decision Summary copied verbatim as `variance-mvp_DECISION_17-10-26.md` (D1..D10, risk predictions). UI contract: `design/mockups/app-variance.html` plus `design/mockups/app-variance_NOTES.md` (the SPEC governs where the mockup shows cut features).

---

## Overview

The app finds defects inside one document. This program adds the question analysts ask on every new fund: what is different from what we already know, what does it do to the form, and who must confirm it. A new document is compared to the same law firm's earlier document (the baseline). Every change is classified `new`, `changed_logic` or `changed_cosmetic`; cosmetic noise is hidden (214 raw changes become 7 shown plus one regression); impact on the form is computed from the logic graph; each change is routed to counsel, GP or fund admin (overridable); questions group per owner with one DOCX export per owner; answers keep option, note, intent and scope; one regression check (R-01, "Appendix C must exist") proves memory can re-check an old answer. No new screens, no sidebar items, gate stays two states, AI never gates, 0 live AI calls.

Fixtures: the authored `fixtures/variance/hartwell-crane` corpus (V1, pinned 214 to 7) is the primary proof. The design session's `samples/packages/` (3 fictional DOCX packages with answer keys) is OBSERVED-IN-MESSAGE and not yet on disk; V1 Step 0 (c) decides reuse as extra same-firm-pair and no-baseline cases and maps the answer keys' AC-V* rows to tests.

Chosen approach (DECISION): an additive `variance/` module in `packages/core`; change rows are ordinary frozen-v1 `Finding`s (`issue_class 'version_drift'`, metadata in `detail.facts`) through an adapter; gate and sheet change through optional fields only; one forward-only migration plus additive contract fields for memory; one adapter file couples to Intake.

Execution is HELD: the Intake feature (`process/features/fund-package-intake/`) is a prerequisite and has no code yet at planning time. Every phase begins with Step 0 (below).

## Implementation Checklist (program level)

Atomic program steps; the per-phase checklists live in each phase plan.

1. Run the outer PVL: one read-only vc-validate-agent per phase plan; fix gaps through PVL-supplement cycles until `Gate: PASS`.
2. Orchestrator fills `## Pre-PVL Conflict Resolution` and emits the post-VALIDATE /goal block.
3. Wait for the Intake feature to close (hard precondition); then run Step 0 plus the 7-step inner loop for Phase 01.
4. Phase 01, then Phase 02 and Phase 03 (either order, default sequential), then Phase 04, then Phase 05; each phase commits its execution changes before the next starts.
5. Phase 05 deploys (remote migration, then Worker) only under the validate-contract's explicit instruction; program closeout updates context docs and commits locally on main (no git push in any phase; the user pushes).

Context routers for every agent: `process/context/all-context.md`, then `process/context/engine/all-engine.md`, `process/context/ui/all-ui.md`, `process/context/worker/all-worker.md`, and the verification router `process/context/tests/all-tests.md` (exact test commands and the no-`--`, one-token-per-call rules). Test verification language: every phase gate is an exact command listed in that phase's Test Gates; the program-level matrix below maps each acceptance criterion to its proving scenario. A phase is marked VERIFIED only after the independent EVL run and, for the final program closeout, after the user confirms the result (user confirmed working).

---

## Step 0 - Mandatory precondition for the program and for EVERY phase

Re-sync with Intake's landed code (inner R+I refresh) before EXECUTE: read Intake's final PLAN and closeout and its landed diff; update the `## Dependencies on Intake` section of this umbrella (observed vs assumed to observed); re-allocate the migration number; re-check the collision files in `phase-blast-radius-registry.md`; write an `## Inner Loop Refresh Note` in the phase plan. EXECUTE may not start until the Intake feature is closed.

The same sentence, plus phase-specific checks, is the first section of each phase plan. Under a standing /goal the orchestrator must not spawn vc-execute-agent for any phase while the Intake feature folder still has an open plan (not closed and deployed) - this is a hard precondition, not a pause.

---

## Program Goal Charter

```
Variance Management Slim MVP - Program Goal Charter

North star:
- An analyst opens a new fund document and, within seconds, sees only the changes that matter versus the same firm's earlier document, what each does to the form, and who must confirm it, and the answers are remembered with their reasons.

Definition of done (an unattended agent must be able to do all of these):
1. Compare a document to a same-firm baseline and get changes classified new / changed_logic / changed_cosmetic with the deciding rule, cosmetic hidden by default and grouped on request (AC-V1, V2, V3, V5, V6, V7, V8).
2. On the Hartwell and Crane demo, 214 raw changes become exactly 7 shown (3 new, 4 logic) plus the R-01 regression (AC-V4, V18).
3. See impact (investor types, conditional paths, old rule reusable yes/no) and a suggested, overridable owner per change; a two-owner change gives two questions; questions group per owner with one DOCX export each (AC-V10 to V13).
4. Record an answer with option, note, intent and scope; firm-template answers need an intent and may create the one supported check; the R-01 check fires on the next same-firm document and never crosses firms or workspaces (AC-V14 to V16).
5. Gate counts untriaged changes, regression findings and unanswered questions, with exactly two states (AC-V17); results are versioned, reproducible and work with no AI (AC-V19, V20; AI never gates, AC-V9).
6. The feature is deployed to the allowed workers.dev target with the forward-only migration applied, and the work is committed locally on main (no git push in any phase; the user pushes).

What "verified" means (program level):
- A phase is VERIFIED only when its Exit Gate commands are green, its validate-contract (PVL) is written with Gate: PASS, regression evidence for every overlapping earlier surface is recorded, and an independent vc-tester EVL run confirmed the gates. Code-only completion is CODE DONE.
- Known-Gap is never a proving strategy: a behavior whose only proof is a named residual keeps its gate CONDITIONAL and has a backlog stub.
- validate-contract gates must be recorded alongside phase gates and regression evidence for a phase to reach VERIFIED. A phase without a validate-contract (or documented skip reason) cannot be marked VERIFIED.

Scope tiers -> phase mapping:
- Tier 1 Core engine and corpus -> Phase 01 (V1)
- Tier 2 Web Findings integration -> Phase 02 (V2)
- Tier 3 Memory backend -> Phase 03 (V3)
- Tier 4 Owners, answers, regression UI -> Phase 04 (V4)
- Tier 5 Demo e2e and deploy -> Phase 05 (V5)
- This program retires Tiers 1-5.

Explicitly out of scope (deferred tier):
- Market-standard template baseline (Tier 2 of the PRD) and "Unusual vs market"; first-review logic groups; cross-document mismatch and multi-document cross-check; rules-in-effect or any config UI; generalized regression checks (only scope_exists / R-01); 3-state gate; adversarial investor personas; multiple baselines per review; AI-written intent or AI change explanations; the missing-target cross-reference detector; a pre-seeded R-01 in the LIVE demo workspace (irreversible, backlog); README and docs/** edits (handoff note to the doc owner).

Hard safety constraints (non-negotiable, per phase):
- Never touch, create or delete anything on the protected Cloudflare zone, never write its name or id, never attach a route or custom domain; only aduin-transaction-* resources; deploy only to https://aduin-transaction-web.giathaowork.workers.dev.
- Free OpenRouter models only; at most 6 live AI calls for this feature and at most 3 per UTC day; this plan uses 0; stop on any cost, non-free model, 429 or open breaker.
- Render-first: never await session, Turnstile or memory before deterministic findings render.
- Forward-only migration (never edit a landed migration); apply the remote migration BEFORE the Worker deploy; deploy order is migration, then Worker (which serves the web bundle).
- Commit locally on main only; never run git push in any phase (the user pushes). Run guard:cf and secrets:scan before the final local commit. Commit directly on main with conventional prefixes. Never git stash, checkout, reset or restore in agent prompts.
- "13 detectors / 15 issue classes" wording stays true (update only if counts change; the plan changes no count).
- Commit each phase's execution changes before starting the next phase. Keep process/plan/context commits separate from execution commits.
```

---

## Stable Program Goal (copy-paste this to start autonomous execution)

```
SESSION GOAL: Variance management slim MVP (AC-V1..V20) folded into existing screens; deployed to workers.dev; local commits only (user pushes)
Ref: process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md

TARGET: all 5 phases VERIFIED until:
- AC-V1..V20 proven per umbrella matrix; demo 214 raw -> 7 shown + R-01
- gates green: pnpm typecheck/lint/test, guard:cf, secrets:scan, seed:check, fixtures:check
- tiers: automated (iterate-until-green) / hybrid (fix if in blast radius) / agent-probe (record judgment)

AUTONOMY: before ANY spawn read umbrella ## Current Execution State and the phase plan ## Phase Loop Progress; first unchecked box = next agent. Delegation mandatory (no inline execution).

PER-PHASE LOOP (R>I>P>PVL>E>EVL>UP, SKIPS SPEC, never skip/reorder):
1 RESEARCH 2 INNOVATE 3 PLAN-SUPPLEMENT 4 PVL 5 EXECUTE 6 EVL 7 UPDATE-PROCESS
- STEP 0 first in every phase: EXECUTE may not start until the Intake feature is closed; re-sync with Intake's landed code, update Dependencies on Intake, re-allocate migration no., write Inner Loop Refresh Note
- PVL never skipped; placeholder or partial contract = blocked
- every subagent FIRST ACTION: vc-context-discovery + vc-plan-discovery
- every phase-END: vc-agent-strategy-compare
- EXECUTE = opus; all else sonnet

HARD STOPS (pause, wait for user):
- irreversible/outward action not in the validate-contract; cascade BLOCKED
- any cost >0, non-:free model, 429; max 6 live AI calls (plan uses 0), 3/UTC day
- remote D1 write other than the one migration apply; live demo-workspace seed

SAFETY (never override):
- no new screens/sidebar items; render-first (never await session/Turnstile/memory before findings)
- deploy only aduin-transaction-web.giathaowork.workers.dev; aduin-transaction-* only; no routes/domains; never touch the protected zone
- forward-only migration; migration then deploy; never git push (user pushes)
- never git stash/checkout/reset/restore; commit on main, conventional prefixes
- "13 detectors / 15 issue classes" wording unchanged

TEST GATES (every phase exit; no -- token; one token per call):
 pnpm --filter <pkg> test <token> | pnpm --filter @aduin/web test:e2e <token>
 harness: node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs; node .claude/skills/vc-audit-vc/scripts/validate-skills.mjs; node .claude/skills/vc-audit-vc/scripts/validate-kit-portability.mjs; node .claude/skills/vc-audit-context/scripts/validate-context-discovery.mjs; node .claude/skills/vc-audit-plans/scripts/validate-plan-inventory.mjs

VALIDATE CONTRACT: per-phase, written by vc-validate-agent into each phase plan before EXECUTE.

START: Phase 1, Step 0 + RESEARCH (pending Intake close). Spawn vc-research-agent for Phase 1.
```

---

## Phase Ordering

| Phase | Plan file | Scope summary | Depends on |
|---|---|---|---|
| 0 (pre-program) | this file | Folder structure, DECISION copy, plans, registry, validators | - |
| 1 - V1 Core engine + corpus | `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-01-core-engine_PLAN_17-10-26.md` | `packages/core/src/variance/` (rules config + hash, hunker, classifier, cosmetic groups, impact, routing, scope_exists check, Finding adapter), additive gate policy and owner sheet, seeded corpus and generator, `variance-*` core tests | Phase 0; Intake closed (Step 0) |
| 2 - V2 Web: Findings | `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-02-web-findings_PLAN_17-10-26.md` | engine-worker pass, baseline adapter (single Intake coupling point), variance store, change rows, All/Errors/Changes, baseline control and modal, cosmetic groups, no-baseline line, gate pending, count selector | Phase 1 |
| 3 - V3 Memory backend | `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-03-memory-backend_PLAN_17-10-26.md` | one migration, additive memory contracts + snapshot note, Worker route/repo/weights/triggers, stub + real API + outbox, label scope rule, hartwell-crane firm, worker + stack-memory tests | Phase 1; parallel-safe with Phase 2 |
| 4 - V4 Owners, answers, regression UI | `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-04-owners-answers_PLAN_17-10-26.md` | owner chips and override, per-owner keys, Questions tabs and export, template wording, answer intent/scope + preview, regression client wiring, gate popover groups | Phase 2 + Phase 3 |
| 5 - V5 Demo, e2e, deploy | `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-05-demo-deploy_PLAN_17-10-26.md` | H&C samples, demo e2e (214 to 7, gate walk), perf and a11y re-runs, full regression, remote migration then Worker deploy, live smoke, residuals, closeout, final local commit | Phases 1-4 |

### Join Conditions

- Phase 1 MUST NOT start EXECUTE until Phase 0 is complete AND the Intake feature is closed (Step 0).
- Phase 2 and Phase 3 MUST NOT start EXECUTE until Phase 1's exit gate passes; they may then run in either order (parallel-safe, disjoint file sets) but, in the shared checkout, default to sequential (V2 then V3).
- Phase 4 MUST NOT start EXECUTE until Phase 2 AND Phase 3 exit gates both pass.
- Phase 5 MUST NOT start EXECUTE until Phases 1 to 4 exit gates all pass; its deploy sections run only with the validate-contract's explicit outward-facing instruction.
- Verified ordering (vc-sequential-thinking): V1 produces `runVariance`, `questionKey`, gate policy and the assertion kind; V2 consumes `runVariance`/`varianceMetaOf`; V3 consumes the assertion kind and rules caps and fixes the wire contract; V4 consumes V2 UI seams, V3 contracts/API and V1 helpers; V5 consumes everything. No phase depends on a later phase's output.

### Per-Phase Entry / Exit Gates

| Phase | Entry | Exit gate |
|---|---|---|
| 0 | Program start | plan files and registry written; plan validators 0 failures |
| 1 | Phase 0 complete; Intake closed; Step 0 done | `variance-demo-count` raw 214, 7 shown, 207 cosmetic in 5 groups; all `variance-*` core gates; regression `diff-*`, `gate-state-matrix`, `sheet-contents`, `contracts`; `fixtures:check`; `record:author --check` |
| 2 | Phase 1 VERIFIED; Step 0 done | `variance-render-first`, baseline/cosmetic/no-baseline/ai-never-gates e2e; `variance-counts-selector`; `import-graph`; regression `counsel-gate`, `gate-pill`, `turnstile-no-block` |
| 3 | Phase 1 VERIFIED; Step 0 done; migration number allocated | worker `migrations`, `triggers`, `rows-written`, `firm-list-parity`, `variance-*` worker gates; core `contracts`; web `api-contract`; stack-memory `variance-regression-no-cross-firm`; evidence pack 0 failures |
| 4 | Phases 2 and 3 VERIFIED; Step 0 done | owner/two-owner/export/answer/intent/r01/gate-two-states e2e; counts agree; regression `counsel-*`, `memory-*` |
| 5 | Phases 1-4 VERIFIED; Intake closed and deployed | demo e2e green; full regression green; migration applied; health schema version; live smoke and probe; evidence pack 0 failures; guard:cf and secrets:scan before the final local commit |

---

## Pre-PVL Conflict Resolution

(placeholder - orchestrator writes this section before the outer PVL begins. It must classify each shared package as `parallel-safe` or `reassign` (with the winning phase named). If no conflicts exist, it must state explicitly: "No package conflicts - all phases are parallel-safe.")

Planner pre-analysis (single author, no cross-author coordination needed; the orchestrator confirms or overrides): shared packages and verdicts.
- `packages/core`: V1 (variance, counsel, barrel), V3 (contracts, config, memory, snapshot). Disjoint directories; the barrel `index.ts` is V1-only; the snapshot is V3-only. Verdict: parallel-safe.
- `apps/web`: V2 (features/variance, features/review, state, engine, shell), V3 (api only), V4 (features/counsel, gate; narrow edits of V2 files after V2 landed), V5 (e2e, perf, a11y). V2 and V3 disjoint. V4 after V2: verdict parallel-safe with sequencing (V4 after V2 and V3).
- `apps/worker`: V3 only (V5 operational deploy only). Verdict: parallel-safe.
- `scripts`: V1 (`fixtures/*`), V3 (`dev-seed.ts`), V5 (`build-samples.ts`, `live/`). Disjoint files. Verdict: parallel-safe.
- Seam files and Intake collision files are listed in `phase-blast-radius-registry.md`; serialization rules apply.

---

## Dependencies on Intake

Interface boundary: the SINGLE coupling point is `apps/web/src/features/variance/baseline-source.ts` (V2). Everything else in Variance is independent of Intake's data model. EXECUTE of every phase is held until the Intake feature is closed; each Step 0 converts the "assumed" rows below to "observed" by reading Intake's landed code and closeout, then rewrites this table.

Status vocabulary: OBSERVED = read in this repository today (code or config); OBSERVED-IN-PLAN = stated in Intake's locked INNOVATE or phase plans (Intake code has NOT landed, so it can still change); ASSUMED = no Intake artifact says it. Step 0 of each phase converts OBSERVED-IN-PLAN and ASSUMED rows to OBSERVED from the landed code and rewrites this table.

Planning-time observation basis: `git log` HEAD 025d589 (spec commits); at the last check the Intake folder `process/features/fund-package-intake/active/intake-mvp_17-10-26/` held the SPEC, an autopilot goal block, `intake-mvp_INNOVATE_17-10-26.md` and four phase plans (`PHASE-1-core-package-engine`, `PHASE-2-web-data-plane`, `PHASE-3-web-surfaces`, `PHASE-4-closeout-deploy`), all untracked, no Intake code; Dexie `version(1)` only; migrations 0001 to 0005 only; `law-firms.json` has 3 firms.

| # | Assumption | Source | Status | Where it bites / fallback |
|---|---|---|---|---|
| 1 | Enumerate the package's documents with role, firm, fund, version and creation time | DECISION D6 item 1 | OBSERVED-IN-PLAN: `usePackageView()` returns a `PackageView` with `firmId`, `documents[]` (id, name, type, role, confidence, ...) and `baselines: {docId, name}[]`; it is `null` unless the open document is the package primary in the ready phase (null for sample opens and the classic path) (Intake Phase 2 plan, contract items 1 and 2) | `baseline-source.ts` only. Resolution order: package baselines first, then a firm pointer in `uiState` |
| 2 | A setter changes a document's role to baseline, same firm only, rejecting cross-firm | D6 item 2 | OBSERVED-IN-PLAN: `usePackage.getState().setRole(docId, role)` returns `{ok}` or `unknown_doc`, `primary_locked`, `cross_firm`, `role_not_allowed`; `baselineDocs()`; `addEarlierDocument(storedDocId)` refuses cross-firm; core `eligibleBaselines(pkg, candidates)` is same-firm only | `baseline-source.ts` `setBaseline`; the pointer path writes `uiState` |
| 3 | Document bytes are readable in the browser within 24 h; `bytesAvailable=false` is surfaced and the analyst re-adds the document | D6 item 3 | OBSERVED (`storage/db.ts` `RETENTION_MS` 24 h, Dexie `documents`); OBSERVED-IN-PLAN (Intake: `documents` rows gain optional `packageId`, `purgeExpired` covers packages, bundled demo members store a `sampleRef` instead of bytes) | muted "text no longer in the browser" line (V2 B1); sample-ref members resolved through the samples loader |
| 4 | A package-scoped event fires when roles are confirmed; otherwise variance triggers on open-document | D6 item 4 | OBSERVED-IN-PLAN: roles are confirmed in the Upload confirmation table, `runDraft` then calls `useReview.openDocument` with `package: {id, defs}`; `setRole` re-opens the primary through the normal render-first path | V2 C2: variance triggers after `openDocument` renders findings, which covers both Intake and classic opens |
| 5 | The role UI is Intake's confirmation table; Variance adds only the Findings header baseline control, which edits the same role | D6 item 5; Intake SPEC U4, AC-I9 | OBSERVED-IN-PLAN (role is chosen with the confirmation table's role select; baseline is never auto-assigned) | V2 E1 |
| 6 | Intake owns package metadata persistence; Variance persists nothing about the baseline server-side | D6 item 6 | OBSERVED-IN-PLAN: Intake persistence is browser-only (Dexie `version(2)` `packages` table); no D1 migration, no Worker route | V3 adds no baseline table |
| 7 | `computeGate` co-edit: whoever lands second rebases | D6 item 7 | OBSERVED-IN-PLAN: Intake leaves core `computeGate` and its 2400-cell matrix untouched; it merges `packageGateReasons` in the web view-model (`use-review-view.ts` exposes `pkg` and `pkgGate` next to `gate`); `GateButton` blocks on the core gate OR any package block reason. Legacy 3-argument `computeGate` OBSERVED today | V1 gate edit has no expected overlap; V2 edits only how `gate` is computed in `use-review-view.ts`/`model.ts` and keeps Intake's additions |
| 8 | Firm ownership (D7): the `hartwell-crane` entry (id `hartwell-crane`, name "Hartwell & Crane LLP", aliases "Hartwell & Crane", "H&C") | D7 | OBSERVED absent in `law-firms.json`; OBSERVED-IN-PLAN: Intake does NOT add it (its demo package is tagged to `firm-x`). Variance (V3) is the sole owner and adds it atomically with the migration because `firm-list-parity` couples the JSON to D1 | V3 Step 0 and C3 |
| 9 | Migration number | D5 | OBSERVED: 0001 to 0005 exist. OBSERVED-IN-PLAN: Intake adds no D1 migration and keeps `schema_version` 5 (Intake INNOVATE item 7, Phase 4 plan). Expected Variance number 0006, `schema_version` 6; allocate by listing the folder at V3 Step 0, never assume | V3 Step 0 (a); `dev-seed.ts` `EXPECTED_MIGRATIONS`; `memory/health.ts` |
| 10 | Dexie version | D5 | OBSERVED `version(1)` only. OBSERVED-IN-PLAN: Intake adds `version(2)` with a `packages` table and optional `documents.packageId`. Variance adds NO bump (client state in the `uiState` key-value table) | V2 B2 |
| 11 | Questions screen and counsel sheet overlap | Intake SPEC U9; Intake Phase 3 plan track 3c | OBSERVED-IN-PLAN: `features/counsel/GpRequestGroup.tsx` rendered once in `CounselScreen.tsx` (below the gate line, above the questions list, only for packages) with its own `exportRequestDocx.ts`; requests are not Findings; the counsel export is unchanged. Reconciliation rule fixed in V4 Step 0 (a): tabs and per-owner export act on the question list; `GpRequestGroup` is untouched and visible on every tab with its own count and export | V4 |
| 12 | `DocMeta`/`openDocument` changes and how a package review is represented | RESEARCH Q8 | OBSERVED-IN-PLAN: `DocMeta.packageId?`, `openDocument` option `package`, one `result` for the to-digitize primary; only ONE to-digitize document per package run is the primary | V2 Step 0 (b); variance diffs the primary against the one baseline |
| 13 | Several baselines allowed by Intake AC-I9; Variance uses ONE baseline per review (A8): the most recently marked, tie-break `createdAt` descending then document id ascending, with a muted "N other baseline(s) ignored" line | D6 | OBSERVED-IN-PLAN: Intake allows one or more baseline-role documents ("one or more documents can carry role baseline") | `baseline-source.ts` B1 |
| 14 | Hartwell and Crane demo documents: ONE set or two | Intake Phase 1 plan; D7 | OBSERVED-IN-PLAN: Intake authors its own small set in `fixtures/package/hartwell/` (Fund III subscription agreement, LPA definitions DOCX, Fund II prior), tagged `firm-x`, via `scripts/src/fixtures/build-package.ts`. Variance keeps a SEPARATE self-contained corpus in `fixtures/variance/hartwell-crane/` (firm `hartwell-crane`, pinned 214/7) with distinct file names; Intake's pins are never changed by Variance; the live sample list labels the variance entries "(variance demo)" | V1 Step 0 (b); V5 Step 0 (b) |
| 15 | `scripts/src/fixtures/{build-seeded,check}.ts` | D7 | OBSERVED-IN-PLAN: Intake adds `build-package.ts` and extends `check.ts` (drift gate and stray-file scan for `fixtures/package`); Variance appends one line to `build-seeded.ts` and an additive `fixtures/variance` scan to `check.ts`: both additive, rebase at V1 Step 0 | V1 H2 |
| 16 | Shared single-line seams (core `index.ts` barrel, `import-graph` ALLOWED, contracts snapshot) | RESEARCH | OBSERVED as single-file merge points; OBSERVED-IN-PLAN: Intake appends to the barrel and to `ALLOWED` (a long list) and leaves the snapshot unmodified; whoever lands second rebases | registry seam list |
| 17 | Intake may not edit `README.md`, `docs/README.md`, `docs/architecture/**`, `design/mockups/**` | Intake goal block | OBSERVED (goal block); Variance honors the same and also leaves `docs/**` to a handoff note | V5 decision 2 |
| 18 | Intake e2e specs that load a package WITH a baseline role will now also run variance (changes rows, gate pending, possibly Blocked) | derived from rows 1, 4, 14 | OBSERVED-IN-PLAN: Intake spec set (`intake-*`, `stack-memory-package-privacy`) and its demo package with a Fund II baseline; Variance regression blocks include the relevant `intake-*` tokens | V2, V4, V5 regression blocks; narrow derived repairs only, each logged |
| 20 | Design-session fixtures: 3 FICTIONAL fund packages as DOCX under `samples/packages/` (`01-northgate-infrastructure-iii` baseline Fund II; `02-lotus-bay-asia-growth-ii` baseline prior draft v1, master + feeder; `03-redwood-ridge-credit-i` no baseline), each with `README.md`, `answer-key.md` (seeded defects, exact quotes, expected class/severity, AC-V* mapping) and `_build/build.py` | design-session message to this PLAN-supplement | OBSERVED-IN-MESSAGE, not yet on disk, design-owned, read-only, not committed | V1 Step 0 (c): if committed, read answer keys and map AC-V* rows to tests; reuse Northgate as a second same-firm pair and Redwood Ridge as the no-baseline case; the authored `fixtures/variance` corpus keeps the exact 214 to 7 pin unless an answer key pins equivalent counts; V5 may reuse for demo/e2e where they fit |
| 19 | Intake Phase 4 redeploys static assets and records the live Worker version (rollback target for V5) and a live smoke script `scripts/src/live/smoke-package.ts` | Intake Phase 4 plan | OBSERVED-IN-PLAN | V5 Step 0 (a), A4 |

Final reconciliation rule: if Step 0 finds an Intake interface that contradicts a row, the row is rewritten, the affected phase plan gets an `## Inner Loop Refresh Note`, and (only if a section of a plan changes) a PLAN-SUPPLEMENT cycle runs; EXECUTE never works from an assumption that Step 0 could have observed.

---

## Acceptance Criteria Traceability Matrix

Strategy tags: FA Fully-Automated, H Hybrid, AP Agent-Probe. Known-Gap is never a strategy here; residuals are named in the last column. Every criterion names its proving scenario (REQ-TEST-LINK) and every phase gate names back the criterion it proves.

| AC | Statement (short) | Phase(s) | proven by | strategy | Residual / note |
|---|---|---|---|---|---|
| AC-V1 | baseline from package role, same firm only | 2, 5 | `variance-baseline-from-package`, `variance-baseline-same-firm-only` (e2e) | FA | CONDITIONAL until both resolution paths (package role via Intake's store, firm pointer) are exercised and the Intake names used are recorded at V2 Step 0 |
| AC-V2 | every change classified with evidence | 1 | `variance-classification-contract` | FA | |
| AC-V3 | cosmetic hidden by default, grouped on request | 2 | `variance-cosmetic-hidden-default` (e2e) | FA | |
| AC-V4 | demo 214 to 7 (3 new, 4 logic) plus R-01 | 1, 5 | `variance-demo-count` (core), `variance-demo-214-to-7` (e2e) | FA | SPEC governs the mockup: 207 cosmetic, not 206 |
| AC-V5 | recall 100% on seeded | 1 | `variance-seeded-recall-matrix` | FA | |
| AC-V6 | cosmetic-as-logic at most 10% | 1 | `variance-precision-measure` | FA | |
| AC-V7 | real pair #5 to #6 | 1 | `variance-golden-05-06` | FA (classification); H AI wording not used | |
| AC-V8 | no baseline: Errors only, becomes baseline | 2 | `variance-no-baseline-errors-only` (e2e) | FA | text kept only 24 h |
| AC-V9 | changes never AI-gated | 1, 2 | `variance-ai-never-gates-core`, `variance-ai-never-gates` (e2e) | H | recorded/stubbed AI, no live call |
| AC-V10 | impact from the logic graph | 1 | `variance-impact-from-graph-fixtures`, `variance-impact-demo-4-2` | FA | real-sample impact precision: named residual (backlog stub `variance-impact-real-sample-ground-truth`), labelled "uncertain" |
| AC-V11 | owner from routing table, overridable | 1, 3, 4 | `variance-routing-table-matrix`, `variance-owner-persisted` (worker), `variance-owner-override` (e2e) | FA | |
| AC-V12 | two owners = two questions | 1, 4 | `variance-question-key-matrix`, `variance-two-owner-two-questions` (e2e) | FA | |
| AC-V13 | per-owner Questions and export | 4 | `variance-questions-by-owner-export` (e2e), `variance-counsel-export-contents` | FA | |
| AC-V14 | answer records option, note, intent, scope | 3, 4 | `variance-answer-intent-rule`, `variance-answer-append-only` (worker), `variance-answer-record-intent-scope` (e2e) | FA | |
| AC-V15 | intent is human-entered | 4 | `variance-intent-human-only` (e2e), `variance-intent-human-only-static` | FA | |
| AC-V16 | R-01 regression, no cross-firm | 1, 3, 4, 5 | `variance-regression-scope-exists`, `variance-regression-no-cross-firm` (worker), `stack-memory-variance-regression-no-cross-firm`, `variance-regression-r01` (e2e) | FA, H (stack) | live write path on the deployed D1 needs Turnstile: operator residual R2, backlog stub `variance-live-regression-operator`; AC proven locally |
| AC-V17 | gate counts changes and questions, two states | 1, 4 | `variance-gate-state-matrix`, `variance-gate-two-states` (e2e) | FA | |
| AC-V18 | demo gate walk | 5 | `variance-demo-gate-walk` (e2e) | FA | under-3-minute human timing recorded by an agent probe |
| AC-V19 | versioned validated config, hash in provenance | 1, 3 | `variance-rules-config-schema-and-provenance`, `variance-finding-wire-size` | FA | |
| AC-V20 | reproducible, no-LLM | 1, 2, 5 | `variance-determinism-repeat-run`, `variance-no-llm-full-run`, `no-llm-corpus` | FA | |
| NFR performance, a11y, Workers Free, render-first | base AC29, AC30, AC40, Phase 10 render-first | 2, 5 | `perf-budget`, `a11y-keyboard`, `test:a11y`, `rows-written`, `variance-render-first`, `probe:live-variance` | FA, AP | manual keyboard pass: Known-Gap residual with backlog stub (CONDITIONAL) |

Coverage check: all 20 criteria appear; none is left with only a Known-Gap; AC-V1, AC-V10, AC-V16 carry named residuals and stay CONDITIONAL on those portions only.

---

## Per-Phase Loop

Each phase executes the canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` (SKIPS SPEC; SPEC ran once and is locked). Each phase plan also has a `0. PRECONDITION` line (Step 0, Intake re-sync) that must be ticked before step 1.

1. RESEARCH - research-agent: load context, read prior phase reports (immediately prior in full, earlier phases' `## Forward Preview` only), read Intake's landed code (Step 0), check plan drift.
2. INNOVATE - innovate-agent: decide approach only if Step 0 or research invalidated the DECISION; otherwise mark n/a with the reason.
3. PLAN-SUPPLEMENT - plan-agent: supplement the EXISTING phase plan (never author a new plan); write the `## Inner Loop Refresh Note`; or mark "n/a - research clean".
4. PVL - vc-validate-agent: full V1-V7; validate-contract per `.claude/skills/vc-validate-findings/references/example-validate-output.md`. Never skipped; a placeholder or partial contract blocks EXECUTE. High-risk phases (3, 5) carry the vc-risk-evidence-pack gate.
5. EXECUTE - vc-execute-agent (opus): per-section test gates after each section.
6. EVL - independent vc-tester (sonnet) re-runs the validate-contract gate commands serially; fix cycles by vc-execute-agent; report-first then TSV row; 10-cycle cap.
7. UPDATE PROCESS - vc-update-process-agent: phase report, context docs, umbrella state, commit.

**PVL is NEVER skipped.** A placeholder `## Validate Contract` = blocked. Orchestrator mechanical gate before spawning vc-execute-agent: `grep -c 'Gate: PASS' <plan-file>` at least 1, or `results.tsv` records at least one PVL fix cycle, or the user accepted the CONDITIONAL gaps this session.

Models: planning, research, validation, review and update-process agents run sonnet; only vc-execute-agent legs run opus.

---

## Phase Loop Progress

Program-level checklist (the per-phase boxes live in each phase plan; the orchestrator reads those first):

- [x] 0. Program planning (this PLAN session): DECISION copied, umbrella, 5 phase plans, registry written; validators run
- [ ] Outer PVL: parallel read-only validators, one per phase plan, then V7 verdicts per plan (placeholder `## Validate Contract` sections are filled per phase by vc-validate-agent)
- [ ] Intake feature closed (hard precondition; checked by the orchestrator before any EXECUTE)
- [ ] Phase 01 loop: 0 Step 0, 1 R, 2 I, 3 P, 4 PVL, 5 E, 6 EVL, 7 UP
- [ ] Phase 02 loop: same 8 boxes
- [ ] Phase 03 loop: same 8 boxes
- [ ] Phase 04 loop: same 8 boxes
- [ ] Phase 05 loop: same 8 boxes (deploy under explicit validate-contract instruction)
- [ ] Program closeout: context docs, final local commit on main (no push)

---

## Autonomous Execution Rules (During /goal)

- The agent self-decides at all V5 gates; CONDITIONAL net gate proceeds with fixes in flight and gaps on record; BLOCKED goes to backlog and the program continues with remaining independent phases (a cascade of two BLOCKED phases is a hard stop).
- Hard stops (must pause): irreversible or outward-facing actions not named in the validate-contract (the V5 remote migration apply and deploy ARE named there and the target is allowed), cost greater than zero, live demo-workspace seed, anything touching the protected zone.
- Subagent delegation is mandatory; direct artifact writes by the orchestrator are a protocol violation; autonomy removes approval pauses only.
- The phase report is the communication channel for conflicts, errors and learnings.

---

## Global Constraints

- Never lower validator checks or widen the `import-graph` allow-list beyond the symbols actually imported on the main thread.
- No new issue class, detector, AI task, screen, sidebar item or Dexie version; contracts change only in `contracts/memory.ts` (additive) with a snapshot change note.
- Gate stays exactly two states (the pending display is UI-only). Intent is human text only. AI never gates.
- One baseline per review, same firm only; the only regression kind is `scope_exists`.
- Run Playwright serially, one agent at a time (port 4317; stack-memory afterwards, never together). Select tests as `pnpm --filter <pkg> test <token>`; never the `--` token; one token per call; an unmatched token exits 1 and counts as a failure.
- After any diff-adjacent change run `pnpm --filter @aduin/scripts record:author --check`.
- Commit each phase's execution changes before starting the next phase. Keep process/plan/context commits separate from execution commits. Commit directly on main (conventional prefixes), never run git push in any phase (the user pushes), never git stash, checkout, reset or restore.

---

## Durable Report Destinations

| Phase | Report path (inside task folder) |
|---|---|
| 0 (pre-program) | `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-00-planning_REPORT_17-10-26.md` (written only if the orchestrator wants a PLAN report) |
| 1 - V1 | `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-01-core-engine_REPORT_17-10-26.md` |
| 2 - V2 | `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-02-web-findings_REPORT_17-10-26.md` |
| 3 - V3 | `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-03-memory-backend_REPORT_17-10-26.md` |
| 4 - V4 | `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-04-owners-answers_REPORT_17-10-26.md` |
| 5 - V5 | `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-05-demo-deploy_REPORT_17-10-26.md` |

PVL/EVL iteration reports and `results.tsv` also live flat in this folder (`variance-mvp-phaseNN-{pvl|evl}-iteration-{NNN}_REPORT_17-10-26.md`). Evidence packs: `harness/phase-03/`, `harness/phase-05/`. Backlog notes: `process/features/variance-management/backlog/`.

---

## Program Status Table

| Phase | Status |
|---|---|
| 0 - Pre-program (plan creation) | ✅ COMPLETE (plans written; pending outer PVL) |
| 01 - Core engine + corpus | ⏳ PLANNED |
| 02 - Web: Findings | ⏳ PLANNED |
| 03 - Memory backend | ⏳ PLANNED |
| 04 - Owners, answers, regression UI | ⏳ PLANNED |
| 05 - Demo, e2e, deploy | ⏳ PLANNED |

Status values: ⏳ PLANNED | 🔨 CODE DONE | 🧪 TESTING | ✅ VERIFIED | 🚧 BLOCKED | ✅ COMPLETE

---

## Risk Predictions (vc-predict, 5 personas; DECISION verdict CAUTION, plus PLAN-time additions)

From the DECISION (unchanged): adapter hides metadata in `detail.facts` (mitigation: typed `varianceMetaOf` with zod parse and an adapter contract test); gate policy flag (default undefined equals legacy, matrix test); cross-firm lookup leak (query by workspace AND firm, server test in stack-memory); forged scope/assertion (server validation, cap, audit); unguarded new columns (guard triggers recreated, `triggers` tests); live migration (forward-only, additive, nullable); rows_written (weight plus test, burst stays operator residual R2); free-plan CPU (variance stays in the browser); 0 LLM calls; too many untriaged changes (config policy switch); misclassification (default to logic, positive cosmetic rules).

PLAN-time additions (new facts found while planning):
1. `firm-list-parity` couples `law-firms.json` to D1: the firm cannot be split across phases; added atomically in V3 with the migration (deviation from D7 ownership, same outcome).
2. R-01 corpus gap: the missing-target xref detector is deferred, so the assertion candidate comes from a variance change row; the corpus has Fund I/II/III so Fund II vs Fund I yields the removal row and Fund III lacks Appendix C (keeps the demo count at exactly 7).
3. SPEC vs mockup count: 214 minus 7 = 207 cosmetic (the mockup says 206); SPEC governs.
4. Live demo-workspace seeding is irreversible (append-only triggers): not done; the demo records the Fund II answer in the visitor sandbox; backlog stub records the option.
5. `scripts/src/dev-seed.ts` `EXPECTED_MIGRATIONS` and `memory/health.ts` schema version must move with the migration or local stacks and writes break; added to V3.
6. Wire limit (corrected): the Worker never persists finding `detail` (detail_json is always NULL), so there is no 2000/1800 clip. Real limits are `FindingDetailSchema` (`facts` scalar-only: string up to 1000 chars, number, boolean, null), the 128 KB body cap and the 25-finding chunk cap; lists and the assertion candidate are encoded as strings or flat keys, decoded only by `varianceMetaOf`. `normalizeAssertionLabel` is owned by V1 and imported by the V3 server.
7. Intake collision on the Questions screen and gate popover is the top coordination risk; handled by Step 0 and the single-adapter rule.

Verdict: CAUTION, proceed with the mitigations in the phase plans.

---

## Touchpoints

- `packages/core/src/variance/**` (new), `packages/core/src/counsel/{gate,sheet,types,template-draft}.ts`, `packages/core/src/{index.ts,contracts/memory.ts,config/limits.ts,memory/label.ts}`, core snapshot, `fixtures/variance/**`, `fixtures/memory/law-firms.json`, `scripts/src/fixtures/{build-variance,build-seeded,check}.ts`
- `apps/web/src/features/{variance,review,counsel,gate}/**`, `apps/web/src/{engine,state,shell,api,styles}/**` (additive), `apps/web/e2e/variance-*.spec.ts`, `apps/web/test/variance-*.test.ts`
- `apps/worker/migrations/00NN_variance.sql`, `apps/worker/src/{routes/memory,memory,platform}/**`, `apps/worker/test/memory/variance-*`, `scripts/src/{dev-seed.ts,build-samples.ts,live/probe-live-variance.ts}`
- Full per-phase lists: each phase plan's `## Touchpoints` and `phase-blast-radius-registry.md`.

---

## Public Contracts

- Frozen v1 `Finding`, `DiffResultSchema`, `issue_class` enum (15), detector registry (13), `AI_TASK_IDS`: unchanged.
- `contracts/memory.ts` moves additively (optional owner, owner_source, intent, scope, assertion, regression_checks; one new audit action); snapshot regenerated once with a change note.
- `computeGate` without the new optional policy is byte-identical to today (2400-cell matrix).
- No new screen, route or sidebar item; hash routes unchanged; the counsel nav label becomes "Questions".
- Deployed surface: only `https://aduin-transaction-web.giathaowork.workers.dev`; no route, custom domain or zone change.

---

## Blast Radius

Files directly modified or created across the program: about 35 new source files, about 45 new tests and specs, 1 migration, generated fixtures, about 40 additive edits (listed per phase). Operational: one additive migration on the live D1 and one Worker deploy (V5). Collision files with Intake are listed in the registry.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| per-phase Exit Gates (see phase plans) | Fully-Automated | AC-V2, V4, V5, V6, V7, V10, V11, V12, V17, V19, V20 (V1); AC-V1, V3, V8, V9 (V2); AC-V14, V16, V19 (V3); AC-V11 to V17 (V4) |
| `variance-demo-214-to-7`, `variance-demo-gate-walk` | Fully-Automated | AC-V4, AC-V18 |
| `variance-ai-never-gates-core`, `variance-ai-never-gates` | Hybrid | AC-V9 |
| `stack-memory-variance-regression-no-cross-firm` | Hybrid | AC-V16 |
| keyboard and design probes, `probe:live-variance` | Agent-Probe | NFR UI, deployed render-first |
| plan artifact validators | Fully-Automated | plan structure only (not a SPEC criterion) |

Plan artifact validators (run at PLAN end and again after any supplement): `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <plan>` for each of the 6 plans; `node .claude/skills/vc-generate-phase-program/scripts/validate-umbrella-artifact.mjs <umbrella>`; `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <phase plan>` for each phase plan.

---

## Test Infra Improvement Notes

- Concurrent Playwright on port 4317 flakes (backlog P6-2); a per-agent port option would allow V2 and V3 to execute truly in parallel.
- A Turnstile-capable automated session (non-production test widget) would let live memory writes and AI/OCR sweeps run unattended (residual R2).
- One "firm in four mirrors" helper would make a new firm a single edit (today only `firm-list-parity` guards it).
- A shared Hartwell and Crane fixture builder (`build-variance.ts`) should be reused by Intake rather than duplicated.

---

## Resume and Execution Handoff

- Selected plan file path: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md`
- Last completed phase: Phase 0 (this umbrella plus 5 phase plans, DECISION copy and registry are the Phase 0 artifacts)
- Validate-contract status: pending (vc-validate-agent writes per phase; the outer PVL runs first)
- First phase to enter EXECUTE (only after the outer PVL passes AND the Intake feature is closed): `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-01-core-engine_PLAN_17-10-26.md`
- Each later phase must re-run research (and Step 0) before execution. EXECUTE receives exactly ONE selected plan file path.
- Current phase: none started. Next action: orchestrator runs the outer PVL (one read-only vc-validate-agent per phase plan), fills `## Pre-PVL Conflict Resolution`, then waits for the Intake close.
- Execute-agent start instruction: read this file, read the Phase 1 plan, complete Step 0 and RESEARCH first.
- Hard rules for every agent prompt: never git stash, checkout, reset or restore; commit locally on main; never run git push in any phase (the user pushes); never touch the protected zone.

---

## Current Execution State

Last updated: 17-10-26 (PLAN)
Current phase: none started - 0 of 5 (status: planned; EXECUTE held until the Intake feature closes)
Phase name: n/a (next: Phase 01 - Core engine + corpus)
Phase status: planned - Phase 00 planning COMPLETE; Phases 01 to 05 PLANNED; outer PVL pending
Phase EVL: n/a (no phase executed)
Phase report: none yet (destinations listed under Durable Report Destinations)
Next phase: Phase 01 - `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-01-core-engine_PLAN_17-10-26.md` (Step 0 Intake re-sync, then RESEARCH)
Current loop step: PLAN done; next is outer PVL (then Step 0 + RESEARCH for Phase 01 once Intake is closed)
Validate-contract status: pending (not written for any phase)
Program Net Gate: PENDING
Latest validator run: 17-10-26 - plan artifact validators on the umbrella and 5 phase plans (results in the PLAN handoff)

Loop step values: RESEARCH | INNOVATE | PLAN-SUPPLEMENT | PVL | EXECUTE | EVL | UPDATE-PROCESS
Orchestrator rule: read "Current loop step" and "validate-contract status" before spawning any subagent. Never spawn execute-agent when loop step is RESEARCH, INNOVATE, PLAN-SUPPLEMENT, or PVL, and never before the Intake feature is closed.

Note: The Stable Program Goal above is fixed. This section is the only part that changes - update-process-agent rewrites it after every phase closeout (overwrite, not append - git history is the audit log).

---

## Validate Contract

(placeholder - vc-validate-agent writes this section before EXECUTE)

Next Step: run the outer PVL (vc-validate-agent per phase plan), then say ENTER EXECUTE MODE only after PVL passes and the Intake feature is closed (RIPER-5).

Amendment 17-10-26 (user decision): no git push in any phase; commit locally only; the user pushes. Wording-only tightening, no gate change.
