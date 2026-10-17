---
name: plan:intake-mvp-umbrella
description: "Fund Package Intake (U1-U9, AC-I1..AC-I20) — umbrella/orchestration plan for the 4-phase program: core package engine, web data plane, web surfaces (three disjoint tracks), closeout and deploy"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: fund-package-intake
  phase: umbrella
---

# Fund Package Intake — Umbrella Plan

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED (plans written; outer PVL next)

- Program type: PHASE PROGRAM (4 phases; Phase 3 has three parallel tracks 3a, 3b, 3c)
- Feature folder: `process/features/fund-package-intake/`
- Task folder (flat, holds every artifact): `process/features/fund-package-intake/active/intake-mvp_17-10-26/`
- Inputs (locked): `intake-mvp_SPEC_17-10-26.md` (20 ACs, locked decisions L1-L11, assumptions A1-A8), `intake-mvp_INNOVATE_17-10-26.md` (Decision Summary plus ORCHESTRATOR RULINGS T1-T4 and the PLAN strategy deviation), `intake-mvp_AUTOPILOT_GOAL_17-10-26.md` (provisional goal block, clarifications 1-7). Sibling consumer: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp_SPEC_17-10-26.md` (L10, AC-V1, AC-V8 consume the baseline role).
- Context routers read: `process/context/all-context.md`, `process/context/engine/all-engine.md`, `process/context/ui/all-ui.md`, `process/context/worker/all-worker.md`, `process/context/tests/all-tests.md`, `process/context/product-domain.md`, `docs/DEPLOY.md`.

---

## Overview

Fund Package Intake lets the analyst upload a whole fund package (sub agreement, LPA, PPM, tax forms, side letter), confirm what each file is, see what the sub agreement points to, stop false "undefined term" errors when the LPA defines the term, see honestly which checks ran fully, partly or not at all, and send the GP one missing-documents request. It folds into existing screens (Documents upload modal, Structure, Gate and Findings header, Questions); no new screen, route or sidebar item.

Architecture (INNOVATE, locked): "package as a pure core module, with a two-stage browser pipeline". `packages/core/src/package/*` holds pure deterministic logic (detection, references, cross-document terms, coverage, gate policy, requests, baseline eligibility). The browser engine worker light-reads each member (`structure()` only), the analyst confirms, then the to-digitize document goes through the normal analyze with the package definitions injected (a pure post-filter removes offering-noun `undefined-term` findings the package defines). Persistence is browser only (Dexie v2 `packages` table, 24 h); no D1 migration, no Worker change, no new route.

Why a phase program: 3+ dependent phases across three packages plus a deploy, a trust-boundary class (stored documents, same-firm baselines), and a Phase 3 that fans out to three parallel agents against a frozen contract. Phase 1 builds the brain, Phase 2 wires data and the upload flow and freezes the contract, Phase 3 builds the three surfaces in parallel, Phase 4 proves the whole and ships it.

**Planning notes (honest):** (1) The kit skills (`vc-context-discovery`, `vc-plan-discovery`, `vc-agent-strategy-compare`, `vc-test-coverage-plan`, `vc-scenario`, `vc-security`, `vc-sequential-thinking`) were applied inline from their loaded instructions; this planning session had no skill-invocation tool, and TeamCreate machinery was unavailable, so ONE sonnet planner wrote the umbrella and all four phase plans (the INNOVATE deviation note). (2) No library API is called by a checklist step that is not already used in the repo (`docx`, `mammoth`, Dexie, Comlink, zustand, Playwright, axe); the executor confirms any signature with `vc-docs-seeker` before first use. (3) The umbrella file carries the literal `umbrella` token (kit validator rule). (4) Files named by INNOVATE were checked against the real tree; adaptations are listed under "Interpretations and adaptations".

---

## Program Goal Charter

```
Fund Package Intake — Program Goal Charter

North star:
- Let a Digitization Service Analyst drop a fund's whole document package into the existing app and get explainable results without false alarms: what each file is, what the sub agreement relies on, which of those documents are missing, which checks ran fully, partly or not at all, and one request to the GP for everything that is missing, with no new screens, no paid model calls and the browser keeping all document text.

Definition of done (an unattended agent must be able to do all of these):
1. Upload several files in one action (HTML, DOCX, PDF, scans via the existing OCR path), tag firm, fund and version, see a type, role, confidence and reason per file, confirm or fix low-confidence rows, and mark a same-firm baseline.
2. Open the Package lens in Structure and see external references with verbatim quotes and locations resolved to package files or marked "not in package", cross-document terms ("defined in LPA" or "unverified") and coverage per check group; see no false undefined-term finding for a term the present LPA defines, while a term nobody defines stays an error.
3. See "Coverage: partial - ..." in the Findings header and the gate popover; missing sub agreement blocks the gate, missing LPA or PPM only warns.
4. Export ONE DOCX missing-documents request for the GP (one item per distinct missing document with its quote) from Questions.
5. Run the whole flow with AI off and with no network, get byte-identical results on repeat, and have the redeployed site at https://aduin-transaction-web.giathaowork.workers.dev pass the live smoke without waiting for Turnstile.

What "verified" means (program level):
- A phase is VERIFIED only with its own gates green, regression evidence on overlapping earlier surfaces, a written validate-contract, an independent serial EVL and a phase report. Each AC-I is VERIFIED when its named proof runs green at its closing phase (traceability table below). Known-Gap is never a terminal pass for developed behavior: it needs a backlog stub and keeps that gate CONDITIONAL.
- Program level: the full serial regression (core, worker, web unit, scripts, preview e2e, stack-memory separately, typecheck, lint, guards, fixture and seed drift, recordings and precompute checks, slice:check) is green; base ACs AC8, AC13, AC22, AC25, AC29, AC30, AC40, AC41, AC58 re-run green; the redeploy is live-smoked; the operator-run residuals stay recorded.

Scope tiers → phase mapping:
- Tier 1 (P0, must ship): AC-I1..AC-I20 → Phases 1, 2, 3 (closing proofs per table) and Phase 4 (regression and live).
- Tier 2: none (the SPEC has no P1 acceptance criteria).
- Tier 3 (out of scope): see below.
- This program retires Tier 1.

Explicitly out of scope (deferred tier):
- U10 append to an existing package and partial reruns; U11 new-version detection; U12 requirement notes as a role; U13 shared values and cross-document number mismatch; U14 auto-suggest baseline; U15 data room or email import; tax-form content checks; new screens or sidebar items; a separate coverage dashboard; a zero-retention provider for confidential packages; multi-user permissions; a live LLM document-type task (seam only, T2); D1 persistence of packages (no migration 0006); the Variance feature itself (only the baseline interface is delivered).

Hard safety constraints (non-negotiable, per phase):
- Frozen core contracts v1 and the contracts snapshot, the 13 detectors and registry, `computeGate`, the Worker code, D1 migrations 0001-0005 and wrangler config stay untouched; barrel edits are append-only.
- Memory, baselines and stored documents never cross law firms or workspaces; full text stays in the browser (24 h).
- Free OpenRouter models only; 0 live model calls planned (6 reserved, at most 3 per UTC day); stop on cost above 0, a non-:free model, a 429 or an open breaker.
- Never touch the protected personal Cloudflare zone named in CLAUDE.md Project Rules; no route or custom domain; deploy only Worker aduin-transaction-web; never print or commit secrets.
- Render-first: findings never wait for session, Turnstile or memory.
- Commit each phase's execution changes before starting the next phase. Keep process/plan/context commits separate from execution commits.
```

---

## Stable Program Goal (copy-paste this to start autonomous execution)

```
SESSION GOAL: fund-package-intake — Fund Package Intake U1-U9 (AC-I1..AC-I20)
Ref: process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp-umbrella_PLAN_17-10-26.md

TARGET: Run phases 1>2>3>4 until all 20 AC-I proofs and base re-runs (AC8,13,22,25,29,30,40,41,58) are green in the serial full run and Worker aduin-transaction-web is redeployed and live-smoked.
- Umbrella Interpretations T1-T10 are binding (AC-I5 = no wrong high-confidence value; AC-I7 = seam only, 0 live calls; AC-I20 = deduped, one DOCX per click)
- Test tiers: automated (iterate-until-green) / hybrid (fix-if-in-blast-radius) / agent-probe (record-judgment)

AUTONOMY: Before ANY subagent spawn read umbrella ## Current Execution State, then the phase plan ## Phase Loop Progress (first unchecked box = next subagent). Autonomy removes approval pauses only; delegation stays mandatory (feedback_autonomous_phase_execution.md).

PER-PHASE LOOP (7-step inner loop R>I>P>PVL>E>EVL>UP, never skip or reorder; SKIPS SPEC):
  1 RESEARCH > 2 INNOVATE > 3 PLAN-SUPPLEMENT > 4 PVL > 5 EXECUTE > 6 EVL > 7 UPDATE-PROCESS
- PVL NEVER skipped; placeholder or partial contract = blocked
- Every subagent FIRST ACTION: vc-context-discovery + vc-plan-discovery
- Every phase-END: vc-agent-strategy-compare (EXECUTE=opus, all else sonnet)
- Phase 3 = three parallel opus tracks 3a/3b/3c, disjoint files, frozen P2 contract; Playwright serial (port 4317)
Report via phase reports. No approval between phases unless a hard stop.

HARD STOPS (pause, ask user):
- git push before the full program closes; any touch of the protected personal Cloudflare zone (CLAUDE.md); route or custom domain
- any paid or non-:free model call, cost >0, 429, open breaker; live AI/OCR calls (0 planned, 6 reserved)
- deploy to anything but Worker aduin-transaction-web; wrangler secret, D1 or migration changes
- Cascade BLOCKED (2 consecutive phases); agent count >100

SAFETY (never override):
- Frozen core contracts v1, detectors, computeGate, Worker code untouched; no D1 migration; no new screens
- Render-first: never await session/Turnstile/memory before findings render
- No git stash/checkout/reset/restore; explicit-path commits on main, trailer Co-Authored-By: Claude Opus 5.5
- Never print/commit secrets; guard:cf + secrets:scan before any deploy
- Never edit README.md, docs/README.md, docs/architecture/**, design/mockups/**

TEST GATES (every phase exit): pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan; one token per call, no --: pnpm --filter <pkg> test <token>
  node .claude/skills/vc-generate-phase-program/scripts/validate-umbrella-artifact.mjs <umbrella>
  node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <phase plan>
  node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <plan>
  node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs --strict
  node .claude/skills/vc-audit-vc/scripts/validate-skills.mjs

VALIDATE CONTRACT: per-phase contracts by vc-validate-agent in each phase plan before EXECUTE; the deploy needs the P4 contract.

START: Phase 1, loop step 4 PVL (steps 1-3 satisfied; outer PVL runs one validator per phase plan). Spawn vc-validate-agent.
```

---

## Phase Ordering

| Phase | Plan file | Scope summary | Depends on |
|---|---|---|---|
| 0 (pre-program) | this file | SPEC, INNOVATE, plan set, registry, goal block | — |
| 1 — Core package engine and fixtures | `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-1-core-package-engine_PLAN_17-10-26.md` | `packages/core/src/package/*`, goldens and property tests, `fixtures/package/**`, fixture scripts | Phase 0 |
| 2 — Web data plane | `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-2-web-data-plane_PLAN_17-10-26.md` | engine worker API, Dexie v2, `usePackage` store and frozen `PackageView`, multi-file Upload modal with confirmation table, demo and recent packages, baseline role, upload e2e | Phase 1 |
| 3 — Web surfaces (tracks 3a, 3b, 3c) | `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-3-web-surfaces_PLAN_17-10-26.md` | 3a Package lens in Structure; 3b coverage line in Findings header and gate popover plus gate policy UI; 3c GP group and request DOCX in Questions | Phase 1 and Phase 2 |
| 4 — Closeout and deploy | `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-4-closeout-deploy_PLAN_17-10-26.md` | full serial regression, base-AC re-runs, perf, a11y and privacy specs, plain rebuild, preflight, redeploy, live smoke, evidence pack | Phases 1-3 |

Ordering rationale (verified with a numbered dependency walk, no phase reads a later phase's output): (1) core types and functions are consumed by the worker and the store; (2) the store and `PackageView` are consumed by the three surfaces; (3) the surfaces share nothing but the frozen contract, so they fan out; (4) deploy only after everything is verified. Phase 2 must freeze the contract BEFORE Phase 3 starts; Phase 3 must not start on a moving contract.

### Join Conditions

- Phase 2 MUST NOT start until Phase 1 exit gate passes (VERIFIED).
- Phase 3 MUST NOT start until Phase 1 AND Phase 2 exit gates both pass and the Phase 2 frozen-contract section is unchanged since its PVL.
- Phase 3 tracks start together only after Phase 3 PVL `Gate: PASS`; the Phase 3 join step (J) waits for all three.
- Phase 4 MUST NOT start until Phases 1-3 are VERIFIED.

---

## Phased Delivery Plan

Program-level checklist (the atomic, file-level checklists live in each phase plan; EXECUTE always receives ONE phase plan, never this list).

- [ ] P1. Phase 1 Step A premise check (baseline `undefined-term` goldens), then Steps B-H: types, limits and policy; detection; facts, definitions, references; terms, coverage, requests, baseline, analysis; barrel append; fixtures and scripts; tests; close.
- [ ] P2. Phase 2 Steps A-I: engine contract and worker (`readPackageDoc`, `packageDefs`, `packageFacts`); Dexie v2; `usePackage` store and frozen `PackageView`; review wiring; multi-file Upload modal, confirmation table, demo and recent packages; import-graph allow-list; eight upload e2e specs; close with the frozen contract unchanged.
- [ ] P3. Phase 3 Steps A-D in parallel by three opus agents (3a Package lens, 3b coverage line and gate, 3c GP group and request DOCX), then Step J join (partition check, typecheck, lint, unit tokens, serialized e2e).
- [ ] P4. Phase 4 Steps A-G: entry, new perf/a11y/privacy specs and live smoke script, full serial regression and base-AC table, plain rebuild with the site key, preflight, redeploy, live smoke, evidence pack and report.

---

## Per-Phase Entry / Exit Gates

| Phase | Entry | Exit gate |
|---|---|---|
| 1 | Phase 0 complete; core baseline green | every Phase 1 token green one per call, full core suite green, `fixtures:check` green, detectors/contracts/counsel/memory/apps untouched (`git diff --quiet P1_BASE`), premise table recorded | Step 0 re-sync done: the parent session's "fixes deployed" message received (hash and live version id), tracked tree clean, `P1_BASE` recorded as that literal 40-char sha, live rollback target = the reported version id (fallback `23612b12-51c7-4d75-a324-f4f2f6392ba8`), baseline counts re-measured; design packages under `samples/packages/` confirmed committed (else Hartwell fallback noted)
| 2 | Phase 1 VERIFIED | Phase 2 unit tokens and eight intake upload specs green; full preview e2e green (173 plus new); Worker and core untouched; contract frozen |
| 3 | Phases 1 and 2 VERIFIED; contract unchanged | per-track unit tokens green; 12 Phase 3 e2e specs and the regression specs green serially; typecheck and lint green; file partition check clean |
| 4 | Phases 1-3 VERIFIED | full serial regression green; base-AC table green; preflight 13 checks green; deploy done; live smoke green; evidence pack validated; Phase 4 pushes nothing (orchestrator pushes `main` once after UPDATE PROCESS) |

---

## Per-Phase Loop

Each phase executes the canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP`. This inner loop SKIPS SPEC — SPEC ran once in the outer program loop and the SPEC governs every phase.

1. **RESEARCH** — fresh research at phase entry (prior phase report read in full; earlier reports' Forward Preview only); satisfied for all four phases by the program-level work until each phase's entry, when a scoped pass re-reads the previous report.
2. **INNOVATE** — satisfied by `intake-mvp_INNOVATE_17-10-26.md` (LOCKED); a phase innovate pass is needed only if a phase finds the locked decision unworkable (then NEEDS_CONTEXT).
3. **PLAN-SUPPLEMENT** — plan-agent updates the existing phase plan with the previous phase's actual names, counts and testids (Inner Loop Refresh Note if sections changed); never creates a new plan file.
4. **PVL** — vc-validate-agent V1-V7; validate-contract per `.claude/skills/vc-validate-findings/references/example-validate-output.md`. Outer PVL runs one validator per phase plan (parallel, read-only) before Phase 1 EXECUTE; inner PVL re-runs for a phase after its plan-supplement.
5. **EXECUTE** — vc-execute-agent (opus); Phase 3 fans out to three parallel opus agents.
6. **EVL** — independent vc-tester (sonnet) re-runs the contract gate commands serially; fix cycles by vc-execute-agent supplement; 10-cycle cap.
7. **UPDATE-PROCESS** — vc-update-process-agent: phase report, this umbrella's `## Current Execution State` rewritten, context docs updated, commit.

**PVL is NEVER skipped.** A placeholder `## Validate Contract` = blocked. Do not spawn execute-agent while the Validate Contract section reads "(placeholder — vc-validate-agent writes this section before EXECUTE)".

---

## Autonomous Execution Rules (During /goal and autopilot)

- Decide at all V5 gates without user approval; CONDITIONAL means a supplement cycle; BLOCKED means backlog note plus continue with the next phase that does not depend on it (here every phase depends on the previous one, so a BLOCKED phase stops the line and is reported).
- Hard stops are exactly those in the Stable Program Goal; everything reversible proceeds.
- Subagent delegation and the ban on direct orchestrator artifact writes stay mandatory (autonomy removes approval pauses only).
- The phase report is the communication channel for conflicts, errors and learnings.

---

## Interpretations and adaptations (binding for all phases)

| # | Item | Resolution |
|---|---|---|
| T1 | AC-I5 "100%" | Type correct on every demo file; no wrong `high` type or role; ambiguous roles (two subscription agreements) are `low` and resolved by the analyst. Tested by `package-type-detection-golden` |
| T2 | AC-I7 | Seam only (`DocTypeSuggester`, `mergeSuggestion` precedence); no LLM task, no prompt, no registry entry; proven by an injected fake suggester plus the no-LLM e2e; 0 live calls. SPEC tag Hybrid becomes Fully-Automated because no live task ships; backlog stub `intake-llm-doc-type-suggest` |
| T3 | AC-I20 "once per package" | One request item per distinct missing target label (deduped); one DOCX per export click |
| T4 | Persistence | Corrections persist across reload inside the 24 h browser window (L7); documented limitation |
| T5 | Single-file upload | Classic path unless the one file detects as `sub_agreement` at `high` confidence (then a one-document package with coverage after findings render). Existing single-file specs upload nameless snippets, so a forced table would break them |
| T6 | Cross-document term statuses | Two statuses: `defined_in_package` and `unverified` (reason `no_reference_document` or `not_in_reference_documents`). "A term defined nowhere stays an error" is realized by the unchanged offering-noun `undefined-term` finding (INNOVATE: no generic undefined rule); other unverified terms are listed, counted in coverage, and are not findings |
| T7 | Demo firm | The Hartwell and Crane package is tagged to the existing firm `firm-x` (Hartwell and Crane is not in `fixtures/memory/law-firms.json`; adding it would touch frozen memory fixtures and the D1 seed); the narrative lives in the documents |
| T8 | Baseline control | The confirmation table and the Package lens use the role select (includes baseline) instead of a separate checkbox; "Earlier documents from this firm" are offered only through `eligibleBaselines` |
| T9 | Missing sub agreement | The UI cannot reach a run without a subscription agreement (Run stays disabled with a plain line); the `block` gate policy is defense in depth and is proven by the core matrix and a web unit; the user-visible half is `intake-no-sub-agreement-held` |
| T10 | File adaptations to INNOVATE | `facts.ts` added in core; light-read facts cached under `parsedModels` key `pkgfacts:<hash>`; demo packages in generated `packages.json` (manifest unchanged); `package:fixtures` script name avoids the build-word hook; live smoke is a script (`smoke:live-package`) not a Playwright project |
| T11 | Design-session packages (PVL cycle 1, orchestrator addition B) | Three fictional packages under `samples/packages/` (read-only, design-owned: `01-northgate-infrastructure-iii`, `02-lotus-bay-asia-growth-ii`, `03-redwood-ridge-credit-i`; each with `README.md`, `answer-key.md` of seeded defects with exact quotes and AC-I* mapping, `_build/build.py`) are the PRIMARY demo and test inputs for AC-I5, I11, I14-I16, I20 where they fit. Phase 1 `make-package.ts` copies them into `fixtures/package/design/**` with stable paths and checksums and derives `expected.json` from the answer keys; the Upload modal's Demo packages list shows them first. NGI #5/#6, #13 and #9 stay the real-document cases of the real-doc goldens. If a package is not committed at Phase 1 Step 0, the synthetic Hartwell builder is the fallback for it. |
| T12 | Shared checkout re-sync (PVL cycle 1, orchestrator addition A) | The parent session's demo-readiness fixes (core detectors `ref-label-coherence`/`ref-this-section`/`util`, two core goldens, web gate pill: `GateButton.tsx`, `features/gate/gate-pill.ts`, `test/gate-pill.test.ts`, `CompareScreen`, `base.css`, worker seed/vitest config, `scripts/src/seed`) are committed and deployed BEFORE Phase 1 EXECUTE. Phase 1 Step 0 waits for that message, re-reads the files, records `P1_BASE` = the literal sha and the new live rollback version id (fallback `23612b12-51c7-4d75-a324-f4f2f6392ba8`). Phase 3 track 3b builds on `gate-pill.ts` (merged gate passed into `gatePillView`), never replaces it. |
| T13 | Push policy (PVL cycle 1, orchestrator addition C) | The user's locked clarification (17-10-26) authorizes pushing `main` after the full program closes; the orchestrator performs that one push after UPDATE PROCESS. Push stays outside Phase 4; no phase plan contains a "no push" rule that contradicts it. |

---

## AC Traceability Matrix (AC-I1..AC-I20 plus base re-runs; each AC has one closing phase)

Strategy tags: FA Fully-Automated, H Hybrid, AP Agent-Probe. Known-Gap is never a proving strategy.

| AC | Core phase | Surface phase | Closing phase | Strategy | proven by | Command / token |
|---|---|---|---|---|---|---|
| AC-I1 | 1 (limits) | 2 | 2 | FA | `intake-multi-upload-e2e` + `intake-limits-refusal-e2e` | `pnpm --filter @aduin/web test:e2e intake-multi-upload`, `intake-limits-refusal`; `pnpm --filter @aduin/core test package-limits` |
| AC-I2 | — | 2 | 2 | FA | `intake-firm-tagging-e2e` | `pnpm --filter @aduin/web test:e2e intake-firm-tagging` |
| AC-I3 | — | 2 | 2 | FA (live OCR text: Known-Gap residual with stub) | `intake-scan-ocr-or-flag-e2e` | `pnpm --filter @aduin/web test:e2e intake-scan-ocr-or-flag` |
| AC-I4 | 1 | — | 1 | FA | `package-detect` unit (contract) | `pnpm --filter @aduin/core test package-detect` |
| AC-I5 | 1 | — | 1 | FA | `package-type-detection-golden` | `pnpm --filter @aduin/core test package-type-detection-golden` |
| AC-I6 | 1 (readiness) | 2 | 2 | FA | `intake-low-confidence-gate-e2e` | `pnpm --filter @aduin/web test:e2e intake-low-confidence-gate` |
| AC-I7 | 1 (seam) | 2 | 2 | FA (SPEC tag H, see T2) | `package-suggester-seam` + `intake-no-llm-run-e2e` | `pnpm --filter @aduin/core test package-suggester-seam`; `pnpm --filter @aduin/web test:e2e intake-no-llm-run` |
| AC-I8 | 1 | 2 (data), 3a (visible) | 3 | FA | `intake-correction-persists-e2e` | `pnpm --filter @aduin/web test:e2e intake-correction-persists`; `pnpm --filter @aduin/web test package-store` |
| AC-I9 | 1 (pure) | 2 (+3a lens) | 2 | FA | `intake-baseline-role-same-firm-e2e` + `package-baseline-eligibility` | `pnpm --filter @aduin/web test:e2e intake-baseline-role-same-firm`; `pnpm --filter @aduin/core test package-baseline-eligibility` |
| AC-I10 | 1 | 3a (display) | 1 | FA | `package-reference-extraction-golden` | `pnpm --filter @aduin/core test package-reference-extraction-golden` |
| AC-I11 | 1 | — | 1 | FA | `package-reference-recall-matrix` | `pnpm --filter @aduin/core test package-reference-recall-matrix` |
| AC-I12 | 1 | 3a (confirm) | 1 | FA | `package-reference-resolution-matrix` + `intake-reference-confirm-e2e` | `pnpm --filter @aduin/core test package-reference-resolution-matrix`; `pnpm --filter @aduin/web test:e2e intake-reference-confirm` |
| AC-I13 | 1 | — | 1 | FA | `package-quote-verbatim-contract` (property) | `pnpm --filter @aduin/core test package-quote-verbatim-contract` |
| AC-I14 | 1 | 3a | 3 | FA | `intake-crossdoc-terms-no-false-positive-e2e` | `pnpm --filter @aduin/web test:e2e intake-crossdoc-terms-no-false-positive`; `pnpm --filter @aduin/core test package-crossdoc-terms-golden` |
| AC-I15 | 1 | 3a | 3 | FA | `intake-crossdoc-terms-real-error-e2e` + base AC13 | `pnpm --filter @aduin/web test:e2e intake-crossdoc-terms-real-error`; `pnpm --filter @aduin/core test golden-11-undefined-units` |
| AC-I16 | 1 | 3a | 3 | FA | `intake-terms-unverified-without-lpa-e2e` | `pnpm --filter @aduin/web test:e2e intake-terms-unverified-without-lpa` |
| AC-I17 | 1 (matrix) | 3a, 3b | 3 | FA | `package-coverage-matrix` + `intake-coverage-visible-e2e` | `pnpm --filter @aduin/core test package-coverage-matrix`; `pnpm --filter @aduin/web test:e2e intake-coverage-visible` |
| AC-I18 | 1 (line text) | 3b | 3 | FA | `intake-coverage-next-to-gate-e2e` | `pnpm --filter @aduin/web test:e2e intake-coverage-next-to-gate` |
| AC-I19 | 1 | 3b | 1 (policy) and 3 (UI) | FA | `package-gate-policy-matrix` + `intake-gate-warning-policy-e2e` | `pnpm --filter @aduin/core test package-gate-policy-matrix`; `pnpm --filter @aduin/web test:e2e intake-gate-warning-policy` |
| AC-I20 | 1 (requests) | 3c | 3 | FA | `intake-missing-docs-request-export-e2e` | `pnpm --filter @aduin/web test:e2e intake-missing-docs-request-export`; `pnpm --filter @aduin/core test package-request` |
| AC8 (base) | 1 | 2 | 4 | FA | determinism on intake output | `pnpm --filter @aduin/core test package-determinism`, `determinism` |
| AC13 (base) | 1 | 3a | 4 | FA | `golden-11-undefined-units` | `pnpm --filter @aduin/core test golden-11-undefined-units` |
| AC22 (base) | 1 | 3b | 4 | FA | `gate-state-matrix` + gate e2e | `pnpm --filter @aduin/core test gate-state-matrix`; e2e `gate-pill`, `counsel-gate` |
| AC25 (base) | — | 2 | 4 | FA | no-LLM runs | e2e `no-llm-corpus`, `sample-zero-calls`, `intake-no-llm-run` |
| AC29 (base) | — | — | 4 | FA | perf on package flow | e2e `perf-budget`, `intake-perf-budget` |
| AC30 (base) | — | 3 (units) | 4 | H (manual keyboard pass: Known-Gap) | axe and keyboard on the package flow | e2e `a11y-keyboard`, `intake-a11y-keyboard`; `pnpm --filter @aduin/web test:a11y` |
| AC40 (base) | — | — | 4 | FA (live CPU under a session: operator residual) | Worker unchanged, free-plan conformance | `pnpm --filter @aduin/worker test`; `git diff --quiet P1_BASE -- apps/worker`; `pnpm --filter @aduin/scripts test conformance-free-plan` |
| AC41 (base) | — | 2 | 4 | FA | firm tagging | e2e `upload-firm-tagging`, `intake-firm-tagging` |
| AC58 (base) | — | — | 4 | FA | privacy of the package flow | worker `memory-storage-contract`; web `retention-purge`; e2e `stack-memory-package-privacy` |

Coverage check: AC-I1..AC-I20 = 20 rows, each with a `proven by` and a strategy; no AC rests on Known-Gap alone. The Variance consumer criteria (AC-V1, AC-V8) are served by the frozen interface in Phase 1 (`eligibleBaselines`) and Phase 2 (`usePackage.setRole`, `baselineDocs`, `addEarlierDocument`); they are proven in the variance program, not here.

---

## Blast-Radius Registry (summary; full text in `phase-blast-radius-registry.md`)

- Phase 1: `packages/core/src/package/**`, core package tests, `scripts/src/fixtures/{make-package,package-facts-extract}.ts`, `fixtures/package/**`; edits only `packages/core/src/index.ts` (append), `scripts/src/fixtures/check.ts`, `scripts/package.json`.
- Phase 2: web engine, storage, state, `features/package/{contract,package-view,package-persist}`, upload modal files, `import-graph.test.ts` (allow-list append), `scripts/src/build-samples.ts`, e2e helpers and eight upload specs.
- Phase 3: 3a Structure plus `features/package/Package*.tsx`; 3b gate and Findings header plus `features/gate/{CoverageLine,PackageGateReasons}.tsx`; 3c counsel GP group and `exportRequestDocx.ts`; pairwise disjoint.
- Phase 4: three e2e specs, one live script plus its unit test, evidence pack; remote: Worker version only.

---

## Pre-PVL Conflict Resolution

Single-author PLAN session (no concurrent planners), so the classification below is final unless outer PVL finds otherwise.

| Shared package | Classification | Winner / rule |
|---|---|---|
| `packages/core` | parallel-safe | Only Phase 1 edits it; the barrel is one appended block |
| `apps/web` | parallel-safe | Phases 2, 3 and 4 are sequential; the only concurrent work is Phase 3 tracks 3a, 3b, 3c whose file sets are disjoint (registry) |
| `scripts` | parallel-safe | Phases 1, 2 and 4 are sequential; `scripts/package.json` gets additive keys on different lines (Phase 1 two keys, Phase 4 one key) |
| `apps/worker` | not touched | No phase edits it; Phase 4 deploys it unchanged |

No package conflicts — all phases are parallel-safe. If outer PVL reports an overlap, the orchestrator reclassifies as `reassign` with a named winning phase and records the resolution here before EXECUTE.

---

## Execution Strategy per Phase (vc-agent-strategy-compare applied inline, 7-signal score)

Model policy: EXECUTE = opus; every other phase and every reviewer, validator, tester and planner = sonnet.

| Phase | Score and signals | Recommended strategy | Agents (model) |
|---|---|---|---|
| PLAN (this session) | 6/7 (S1 3 packages, S3, S4, S5-ish depth, S6, S7) | agent team recommended (4 planners) but TeamCreate machinery unavailable: ONE planner wrote all plans (locked deviation) | 1 (sonnet) |
| VALIDATE (outer PVL) | 6/7 | four read-only validators, one per phase plan, as parallel subagents (agent-team machinery unavailable; read-only validators need no cross-talk); the orchestrator reconciles blast radius using the registry | 4 (sonnet) |
| Phase 1 EXECUTE | 2/7 | sequential, one author | 1 opus + 1 sonnet vc-tester |
| Phase 2 EXECUTE | 4/7 | sequential (engine, store, modal depend on each other) | 1 opus + 1 sonnet vc-tester + 1 sonnet vc-code-reviewer |
| Phase 3 EXECUTE | 4/7 | three parallel opus agents with disjoint file sets and the frozen contract (substitute for an agent team); one serialized e2e pass after the join | 3 opus + 1 join + 1 sonnet vc-tester |
| Phase 4 EXECUTE | 4/7 | sequential; deploy is single-flight | 1 opus + 1 sonnet vc-tester + 1 sonnet reviewer |
| UPDATE PROCESS (per phase and final) | 2/7 | sequential | 1 sonnet |

Cost guard: 4 + 2 + 3 + 3 + 3 + about 6 sonnet reviewers and testers stays under 30 agents; no confirmation needed.

---

## Global Constraints

- Never lower validator checks; never widen an allow-list without user approval.
- The test command rules apply in every plan: `pnpm --filter <pkg> test <token>` / `test:e2e <token>`, no `--`, one token per call, confirm more than 0 tests ran; Playwright one invocation at a time on port 4317; never run `preview` and `stack-memory` concurrently; a bash hook blocks command text containing build, dist or node_modules, so builds run through scratchpad scripts and binaries through `pnpm exec`; render-first.
- Agent rules in every phase plan: no git stash, checkout, reset or restore; explicit-path commits on main with a conventional prefix and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; never edit `README.md`, `docs/README.md`, `docs/architecture/**`, `design/mockups/**`; never touch the protected personal Cloudflare zone named in CLAUDE.md; free models only with 0 live calls planned.
- After every phase that touches harness or plan artifacts, run the artifact validators (umbrella, phase stub, plan artifact) and confirm exit 0.
- Commit each phase's execution changes before starting the next phase. Keep process/plan/context commits separate from execution commits.

---

## Durable Report Destinations

| Phase | Report path (inside task folder) |
|---|---|
| 0 (pre-program) | `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_INNOVATE_17-10-26.md` and this plan set |
| 1 — Core package engine | `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-1-core-package-engine_REPORT_17-10-26.md` |
| 2 — Web data plane | `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-2-web-data-plane_REPORT_17-10-26.md` |
| 3 — Web surfaces | `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-3-web-surfaces_REPORT_17-10-26.md` |
| 4 — Closeout and deploy | `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-4-closeout-deploy_REPORT_17-10-26.md` |

PVL and EVL iteration reports follow the base program's naming (`intake-mvp-phaseN-pvl-iteration-NNN_REPORT_17-10-26.md`, `intake-mvp-phaseN-evl-iteration-NNN_REPORT_17-10-26.md`) with `results.tsv` in the same folder (created by the orchestrator at the first PVL cycle).

---

## Phase Loop Progress

Program-level view (each phase's own `## Phase Loop Progress` holds the 7 checkboxes; this table mirrors it for the orchestrator after each UPDATE-PROCESS). Steps 1 and 2 are satisfied for every phase by the program-level INNOVATE; Phase 1 step 3 is n/a (plan freshly written).

| Phase | 1 R | 2 I | 3 P-S | 4 PVL | 5 E | 6 EVL | 7 UP |
|---|---|---|---|---|---|---|---|
| 1 | [x] | [x] | [x] | [ ] | [ ] | [ ] | [ ] |
| 2 | [x] | [x] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 3 | [x] | [x] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 4 | [x] | [x] | [ ] | [ ] | [ ] | [ ] | [ ] |

---

## Program Status Table

| Phase | Status |
|---|---|
| 0 — Pre-program (plan creation) | ⏳ PLANNED (plans written; outer PVL pending) |
| 1 — Core package engine and fixtures | ⏳ PLANNED |
| 2 — Web data plane | ⏳ PLANNED |
| 3 — Web surfaces (3a, 3b, 3c) | ⏳ PLANNED |
| 4 — Closeout and deploy | ⏳ PLANNED |

Status values: ⏳ PLANNED | 🔨 CODE DONE | 🧪 TESTING | ✅ VERIFIED | 🚧 BLOCKED | ✅ COMPLETE. A phase is promoted to VERIFIED only with phase gates, regression evidence and a validate-contract; the deploy and push follow the policy in the Stable Program Goal (user-confirmed in the autopilot clarification round, 17-10-26).

---

## Touchpoints

- Phase 1: `packages/core/src/package/`, `packages/core/test/{unit,golden,seeded,property}/package-*`, `scripts/src/fixtures/`, `fixtures/package/`.
- Phase 2: `apps/web/src/{engine,storage,state,features/package,features/open-document,styles/package-intake.css}`, `apps/web/e2e/{fixtures/package.ts,intake-*}`, `scripts/src/build-samples.ts`.
- Phase 3: `apps/web/src/features/{structure,package,gate,counsel}`, `apps/web/src/shell/GateButton.tsx`, `apps/web/src/features/review/FindingsScreen.tsx`, three new CSS files, 12 e2e specs.
- Phase 4: `apps/web/e2e/{intake-perf-budget,intake-a11y-keyboard,stack-memory-package-privacy}.spec.ts`, `scripts/src/live/smoke-package.ts`, harness evidence, Worker version.

---

## Public Contracts

- Unchanged: frozen core contracts v1 and `packages/core/test/__snapshots__/contracts.json-schema.snap`; the 13 detectors, `detectors/registry.ts`, taxonomy (15 issue classes), `computeGate` and its matrix; Worker routes, D1 schema 5 and migrations 0001-0005, `wrangler.jsonc`, secrets; `features/registry.ts` and the sidebar; `manifest.json`; all existing testids.
- New and additive: the `@aduin/core` package module exports (Phase 1 Public Contracts), the engine worker additions (`readPackageDoc`, `packageDefs`, `packageFacts`), Dexie v2 `packages`, the frozen `PackageView` contract and the testids listed in the Phase 2 and Phase 3 plans.
- Wording: "13 detectors / 15 issue classes" stays true, plus "package-level checks (references, cross-document terms, coverage)" which are not detectors and produce no findings.
- Variance interface (consumer, frozen): `eligibleBaselines` (core), `usePackage` `setRole`, `baselineDocs`, `addEarlierDocument` (web).

---

## Blast Radius

Files directly modified or created across the program (exact per-phase lists live in each phase plan and the registry):

- Core (Phase 1): 14 new files under `packages/core/src/package/`, one appended block in `packages/core/src/index.ts`, 17 new core test files.
- Scripts and fixtures (Phases 1, 2, 4): `scripts/src/fixtures/{make-package,package-facts-extract}.ts` and `check.ts`, `scripts/src/build-samples.ts`, `scripts/src/live/smoke-package.ts`, tests, `scripts/package.json` (three keys), `fixtures/package/**`.
- Web (Phases 2, 3, 4): engine, storage, state, upload modal, Package lens, coverage and gate, GP group, CSS files, specs.
- Remote (Phase 4): Worker `aduin-transaction-web` version only.
- Never touched: `packages/core/src/{detectors,counsel,contracts,memory}/**`, `apps/worker/**`, `README.md`, `docs/README.md`, `docs/architecture/**`, `design/mockups/**`.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Phase 1 tokens (`package-detect`, `package-type-detection-golden`, `package-reference-*`, `package-quote-verbatim-contract`, `package-crossdoc-terms-golden`, `package-coverage-matrix`, `package-gate-policy-matrix`, `package-request`, `package-baseline-eligibility`, `package-determinism`, `package-suggester-seam`) | Fully-Automated | AC-I4, I5, I7, I9, I10, I11, I12, I13, I14-16 (core), I17, I19, I20 (core), AC8 |
| Phase 2 unit tokens and eight `intake-*` upload specs | Fully-Automated | AC-I1, I2, I3, I6, I7, I8 (data), I9 |
| Phase 3 unit tokens and 12 `intake-*` surface specs | Fully-Automated | AC-I8, I12 (UI), I14, I15, I16, I17, I18, I19 (UI), I20 |
| Phase 4 full serial regression, base-AC table, perf, a11y, privacy specs | Fully-Automated (a11y Hybrid) | AC8, 13, 22, 25, 29, 30, 40, 41, 58 and every AC-I again |
| Redeploy plus `smoke:live-package`, live headers, `/api/health`, stack slice | Hybrid (live URL) | live behavior; AC31/AC39 intact |
| Operator residuals (real session memory writes, AC51 echo, live AI/OCR sweep, D4 burst, Turnstile iframe R4) | Known-Gap (stubs exist; CONDITIONAL) | live-session parts only |
| `node .claude/skills/vc-generate-phase-program/scripts/validate-umbrella-artifact.mjs <this plan>`, `validate-phase-stub.mjs` and `.claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs` per plan | Fully-Automated | plan artifact structure |

---

## Test Infra Improvement Notes

(none identified yet) — candidates: per-agent Playwright ports (existing backlog P6-2) would let Phase 3 tracks run e2e in parallel; a script that extracts the public site key for deploys; code splitting of the 568 kB bundle.

---

## Risks (program level)

| Risk | Sev | Mitigation |
|---|---|---|
| Wrong high-confidence type drives wrong checks | High | T1: conservative threshold, two-sub roles `low`, goldens on committed real facts, analyst confirmation |
| Cross-firm baseline leak | High | `eligibleBaselines`, store guard, two-firm e2e, same-firm only in the variance interface |
| Phase 3 tracks collide | High | Disjoint sets, explicit-path commits, frozen contract, join partition check, serialized Playwright |
| Coverage line or Package tab breaks existing header-sensitive specs | Med | Elements render only for packages; Phase 3 join and Phase 4 full serial runs |
| "False errors today" premise only partly true | Med | Phase 1 Step A baselines goldens first; ACs stay listing, suppression and coverage |
| Reference recall below 100% on real NGI cases | Med | Seeded matrix with independent ground truth; tune pattern data; no LLM task without ruling |
| Plain build overwritten by an e2e build before deploy | High | Build plain after the last Playwright run; preflight checks the e2e marker |
| Push policy | Low | Resolved by T13: push only at full close, by the orchestrator, after UPDATE PROCESS; no phase pushes |

---

## Resume and Execution Handoff

- Selected plan file path (umbrella): `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp-umbrella_PLAN_17-10-26.md`
- Last completed phase: Phase 0 (this umbrella plan, the INNOVATE artifact, the registry and the four phase plans are the Phase 0 artifacts)
- Validate-contract status: pending (vc-validate-agent writes per phase)
- Current phase: 1 — Core package engine; current loop step: PVL (outer PVL for all four plans)
- Next action: run outer PVL: one vc-validate-agent (sonnet) per phase plan, in parallel and read-only; reconcile blast radius via `phase-blast-radius-registry.md`; fill any `Pre-PVL Conflict Resolution` change above; then emit the /goal block and spawn vc-execute-agent (opus) for Phase 1 with the exact Phase 1 plan path and its validate-contract.
- Execute-agent start instruction: Read this umbrella. Read the Phase 1 plan. Run Step A (premise check and baseline) first. Phases 2-4 each re-run research and plan-supplement against the previous phase report before their own PVL and EXECUTE.
- Next instruction: ENTER VALIDATE MODE for the four phase plans (outer PVL), then ENTER EXECUTE MODE for Phase 1 only after `Gate: PASS`. Never hand a worker the whole program as one checklist.

---

## Current Execution State

Last updated: 17-10-26 (PLAN session)
Current phase: 1 of 4 (program at outer PVL)
Phase 1 name: Core package engine and fixtures
Phase 1 status: ⏳ PLANNED (research, innovate and plan-supplement satisfied; PVL next)
Phase 1 EVL: not run
Phase 1 report: `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-1-core-package-engine_REPORT_17-10-26.md` (not written)
Next phase: Phase 2 — Web data plane (waits for Phase 1 VERIFIED)
Current loop step: PVL (outer PVL; cycle 1 supplement applied 17-10-26, re-validate from V1 next)
Validate-contract status: not written for any phase
Program Net Gate: PENDING
Latest validator run: 17-10-26 PLAN session: `validate-plan-artifact` on the umbrella and each phase plan, `validate-phase-stub` on each phase plan, `validate-umbrella-artifact` on this plan (results recorded in the PLAN handoff message)

Loop step values: RESEARCH | INNOVATE | PLAN-SUPPLEMENT | PVL | EXECUTE | EVL | UPDATE-PROCESS
Orchestrator rule: read "Current loop step" and "Validate-contract status" before spawning any subagent. Never spawn execute-agent when the loop step is RESEARCH, INNOVATE, PLAN-SUPPLEMENT or PVL.

Note: The Stable Program Goal above is fixed. This section is the only part that changes — update-process-agent rewrites it after every phase closeout (overwrite, not append — git history is the audit log).

---

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
