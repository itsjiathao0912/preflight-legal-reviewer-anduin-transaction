---
name: plan:subdoc-qa-mvp-umbrella
description: "Sub-doc QA MVP — umbrella/orchestration plan for the 13-plan phase program (11 phases plus 04a/04b, 08b): vertical slice first, then memory, AI, OCR, diff, counsel gate, deploy"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: umbrella
---

# Sub-doc QA MVP — Umbrella Plan

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED

- Program type: PHASE PROGRAM (phases 00, 01, 02, 03, 04a, 04b, 05, 06, 07, 08, 08b, 09, 10; Milestone 1 vertical slice first)
- Date: 17-10-26
- Task folder (flat, holds every artifact): `process/general-plans/active/subdoc-qa-mvp_17-10-26/` (general-plans; `metadata.feature: subdoc-qa-mvp`)
- Inputs (locked): `subdoc-qa-mvp_SPEC_17-10-26.md` (64 ACs, R1–R6), `subdoc-qa-mvp_INNOVATE_17-10-26.md` (Decision Summary + R6), `subdoc-qa-mvp_DATA-MODEL_17-10-26.md`, RESEARCH, FEASIBILITY P1/P2/P4 and contract-lint/compare-cli verdicts, PRD-REVIEW-MEMORY.
- Context routers: `process/context/all-context.md`, `process/context/product-domain.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`.

---

## Overview

Build a polished English web app that lets an Anduin Digitization Service Analyst load a fund subscription document, see every defect with the exact clause quoted, diff it against a related version or sibling, see which sections apply per investor type, send a short counsel question sheet, and be gated from "Ready to digitize" until critical items are answered; with per-law-firm Review Memory, no-AI mode, and Cloudflare Workers Free + D1 Free only. Architecture (INNOVATE Approach A + R6): browser Web Worker engine (parse, structure, graph, checks, diff, gate, DOCX), thin Worker (proxy, limits, D1 memory), static assets, D1 as system of record for memory.

Why a phase program: 13 plan files, 3 packages plus a Worker, an approved UI mockup, remote resources, and unverified platform mechanics (spikes S1–S10) that need per-phase validation gates.

**Reordering (user instruction):** the first goal is a testable end-to-end **vertical slice**: 00 → 01 → 03 → 04a. Phase 02 follows the slice and no longer blocks Phase 03. AC ownership below is consistent with that order.

**Planning notes (honest):** (1) The kit skills (`vc-context-discovery`, `vc-plan-discovery`, `vc-agent-strategy-compare`, `vc-test-coverage-plan`, `vc-sequential-thinking`) were applied inline from their loaded instructions; this planning session had no skill-invocation tool. (2) `vc-docs-seeker` library-API confirmation is mandated in Phase 00 (no phase checklist step depends on an unconfirmed API); versions are marked "confirm via vc-docs-seeker in Phase 00". (3) The umbrella file carries the literal `umbrella` token (kit validator rule) instead of the shorter name in the task request.

---

## Program Goal Charter

```
Sub-doc QA MVP — Program Goal Charter

North star:
- Give an Anduin Digitization Service Analyst a polished, explainable pre-digitization review tool that finds real defects in fund subscription documents with cited evidence, turns unclear items into a counsel query sheet that gates digitization, and remembers decisions per law firm without ever hiding a real defect or breaking Cloudflare Workers Free and a ~$0 AI budget.

Definition of done (an unattended agent must be able to do all of these):
1. Open any bundled sample or visitor upload (HTML, text PDF, DOCX, scanned PDF/image) and see structure, deterministic findings with quoted evidence, and the four verified golden defects (#1, #3/#5, #11; #9 footnote soft) in the live demo.
2. Review side by side, triage with required dismiss reasons, diff two versions or siblings, see investor-type paths, draft/edit/export a DOCX counsel sheet, record answers, and watch the gate go Blocked/Ready strictly.
3. Run fully with zero AI (no-LLM mode), degrade automatically with banners on any quota/budget/limit event, and use only recorded responses in CI.
4. Remember decisions and counsel answers per law firm in per-visitor sandboxes with a seeded read-only demo: handled items move to "Previously handled", answered questions are not re-asked, edited passages are new, blocking defects are never hidden.
5. Deploy to the default workers.dev URL within Workers Free limits, with README, demo video and slides, and the zone itsjiathao.com untouched.

What "verified" means (program level):
- A phase is VERIFIED only with its own gates green, regression checks on overlapping earlier surfaces green, a written validate-contract, and a phase report; each SPEC AC is VERIFIED when its named proof (see AC matrix) runs green at its closing phase. Known-Gap is never a terminal pass for developed behavior: it needs a backlog stub and keeps the gate CONDITIONAL. P1 ACs may be honestly DEFERRED (status SKIPPED, not VERIFIED).
- Milestone 1 (00 → 01 → 03 → 04a) is accepted by `pnpm slice:check` plus the visual check against the approved mockup.

Scope tiers → phase mapping:
- Tier 1 (P0, must ship): AC1–AC49, AC55–AC62, AC64 → Phases 00, 01, 03, 04a (M1), 02, 04b, 05, 06, 07, 08, 10.
- Tier 2 (P1, cut first if late): AC50–AC54, AC63 → backend slices inside 04b (revoke, proposals) and 05 (rules injection); UI/proof in 08b and 09. Cut order: AC53/AC54 UI, AC52, AC63, then AC51.
- Tier 3 (out of scope): see below.
- This program retires Tiers 1 and 2.

Explicitly out of scope (deferred tier):
- Real auth/accounts/roles/multi-tenancy; editing the source document; generating the digitized form (the JSON outline is a reference); fuzzy/embedding memory matching; memory across firms; decision expiry; second-person approval; e-signature/investor-facing forms; emailing counsel; CSV/PDF counsel export; paid Cloudflare features; legal advice; production compliance; non-English; RIA/BD variant splitting for #2; handwriting; model training; redistributing ILPA #14 in the live demo.

Hard safety constraints (non-negotiable, per phase):
- Cloudflare Workers FREE plan only (10 ms CPU, 50 subrequests, 100k requests/day); the Worker never parses documents.
- Never create, modify or delete anything on the zone itsjiathao.com (id 894bc9f93640fab260bf1580b5b48cb7); no custom domain or route; resources named aduin-transaction-*; default workers.dev/pages.dev URLs only.
- No secret in the repo, logs or CI output; Worker secrets only via `wrangler secret put`; credentials only from ~/.config/*/credentials.env.
- LLM: free OpenRouter models only during the run (paid path built but disabled by config, ~$10 cap stays as a ceiling); free models first; recorded responses in CI; PDFs are never sent to OpenRouter (no implicit paid OCR engine).
- Server stores only short quoted snippets, hashes and metadata (never full documents); memory is append-only, exact-match, per firm and per workspace; blocking defects are never hidden; Accept on a blocking finding keeps the gate Blocked until counsel answers.
- git push is a hard stop (user OK required). Commit each phase's execution changes before starting the next phase; keep process/plan/context commits separate from execution commits.
```

---

## Stable Program Goal (copy-paste this to start autonomous execution)

```
SESSION GOAL: subdoc-qa-mvp — Sub-doc QA MVP
Ref: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md

TARGET: Run phases 00>01>03>04a (Milestone 1 slice, pnpm slice:check), then 02+04b, 05+06+09, 07, 08, 08b, 10 until:
- all 64 ACs VERIFIED (matrix in umbrella) or P1 ACs 50-54,63 honestly DEFERRED
- all validators exit 0, every phase exit gate green, live demo on workers.dev
- Test tiers: automated (iterate-until-green) / hybrid (fix-if-in-blast-radius) / agent-probe (record-judgment)

AUTONOMY: Before ANY subagent spawn read umbrella ## Current Execution State, then the phase plan ## Phase Loop Progress (first unchecked box = next subagent).

PER-PHASE LOOP (7-step inner loop R>I>P>PVL>E>EVL>UP, never skip or reorder; SKIPS SPEC):
  1 RESEARCH > 2 INNOVATE > 3 PLAN-SUPPLEMENT > 4 PVL > 5 EXECUTE > 6 EVL > 7 UPDATE-PROCESS
- PVL NEVER skipped; placeholder or partial contract = blocked
- Every subagent FIRST ACTION: vc-context-discovery + vc-plan-discovery
- Every phase-END: vc-agent-strategy-compare
- UI phases read process/context/ui/all-ui.md + design/mockups/review-workspace.html tokens; mockup step before each new screen
Report via phase reports. No approval between phases unless a hard stop.

HARD STOPS (pause, ask user):
- git push; custom domain or route; any touch of zone itsjiathao.com (id 894bc9f93640fab260bf1580b5b48cb7)
- any paid LLM/OCR call; live free-model calls beyond the APPROVED-LIVE cap in the contract
- deploy to anything but aduin-transaction-* on workers.dev/pages.dev
- Net gate BLOCKED with no backlog path; agent count >100

SAFETY (never override):
- Workers FREE only; Worker never parses docs; free OpenRouter models only; PDFs never sent to OpenRouter; CI uses recorded responses
- Never print/commit secrets (wrangler secret put only); run pnpm guard:cf and secrets:scan every phase
- Server stores only snippets/hashes/metadata; memory append-only, exact-match; blocking defects never hidden
- Accept on a blocking finding keeps gate Blocked until counsel answers
- Commit each phase before advancing; process and execution commits separate

TEST GATES (every phase exit): pnpm typecheck && pnpm lint && pnpm test && pnpm guard:cf && pnpm secrets:scan
  node .claude/skills/vc-generate-phase-program/scripts/validate-umbrella-artifact.mjs <umbrella>
  node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <phase plan>
  node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <plan>
  node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs --strict
  node .claude/skills/vc-audit-vc/scripts/validate-skills.mjs

VALIDATE CONTRACT: Per-phase contracts written by vc-validate-agent into each phase plan before EXECUTE (remote/live actions need explicit APPROVED lines).

START: Phase 00, loop step RESEARCH (pending). Spawn vc-research-agent for Phase 00.
```

---

## Phase Ordering

This table is the Phased Delivery Plan. Execution order: **M1 slice** 00 → 01 → (03 ∥ 04a) → slice check; then (02 ∥ 04b); then (05 ∥ 06 ∥ 09); then 07; then 08 → 08b → 10.

| Phase | Plan file | Scope summary | Depends on |
|---|---|---|---|
| 00 — Scaffold + spikes | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-00-scaffold-spikes_PLAN_17-10-26.md` | pnpm workspaces, tooling, guards, seams; spikes S1–S10 specified, S6/S7/S1/S2 run | — |
| 01 — Core engine | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-01-core-engine_PLAN_17-10-26.md` | model, HTML adapter, structurer, graph, finding schema, golden detectors, memory core, API contracts v1 | 00 |
| 03 — Web shell (M1) | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-03-web-shell_PLAN_17-10-26.md` | web app to the approved mockup, real findings, stub memory API, structure view | 01 |
| 04a — Worker proxy (M1) | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04a-worker-proxy_PLAN_17-10-26.md` | thin Worker: static assets, AI/OCR proxy, limits, Turnstile, abuse protection; `slice:check` | 00, 01 (contracts) |
| 02 — Detectors, flags, paths, fixtures | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-02-detectors-fixtures_PLAN_17-10-26.md` | remaining detectors, flags, investor paths + view, pattern_key, seeded and fund I/II/Y fixtures. Note: its `investor-path-view` e2e needs the Structure view host; until that view is approved and built, the e2e is deferred and extraction gates stand alone | 01 (web parts: 03) |
| 04b — D1 + memory API | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04b-d1-memory-api_PLAN_17-10-26.md` | migrations, SQL ports, session/workspaces, memory endpoints, audit, rules, purge, seed; spikes S5, S8, S9, S10 | 00, 01 |
| 05 — LLM + AI lane | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-05-llm-ai-lane_PLAN_17-10-26.md` | task framework, recordings, AI lane UI, provenance, banners, rules injection, rules_hash | 02, 03, 04a, 04b |
| 06 — PDF/DOCX/OCR | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-06-pdf-docx-ocr_PLAN_17-10-26.md` | adapters, OCR pipeline, scan viewer, precompute; spikes S3, S4 | 01, 03, 04a |
| 09 — Logic outline (P1) | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-09-logic-outline_PLAN_17-10-26.md` | JSON form logic outline export | 02, 03 |
| 07 — Version diff | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-07-version-diff_PLAN_17-10-26.md` | diff, sibling labeling, findings delta, AI narrative | 02, 03, 05 |
| 08 — Counsel + gate + memory write-back | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08-counsel-gate-memory_PLAN_17-10-26.md` | counsel sheet, answers, gate, DOCX, real memory client, metrics, audit viewer | 03, 04b, 05, 07 (02 fixtures) |
| 08b — Memory UI (P1) | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08b-memory-ui_PLAN_17-10-26.md` | firm memory page, rule proposals/approval, audit filters | 04b, 08 |
| 10 — Deploy + final | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-10-deploy-final_PLAN_17-10-26.md` | deploy, a11y, perf, final precompute, fund II proofs, README/video/slides | all (08b and 09 verified or skipped) |

Supporting artifacts (same folder): `phase-blast-radius-registry.md`; spike results REF created by Phase 00 (`subdoc-qa-mvp_SPIKE-RESULTS_REF_17-10-26.md`).

### Join Conditions

- Phase 01 MUST NOT start until Phase 00 exit gate passes.
- Phases 03 and 04a MUST NOT start until Phase 01 exit gate passes (contracts frozen); they are parallel-safe and together form Milestone 1 (accepted by `pnpm slice:check`).
- Phase 02 and Phase 04b MUST NOT start until Phase 01 passes (04b also needs Phase 00 spike S5/S8 steps, which it runs first); Phase 02's web steps wait for Phase 03.
- Phase 05 MUST NOT start until 02, 03, 04a, 04b all pass.
- Phase 06 MUST NOT start until 01, 03, 04a pass. Phase 09 MUST NOT start until 02, 03 pass.
- Phase 07 MUST NOT start until 02, 03, 05 pass (deterministic steps could start after 02 and 03; the narrative step needs 05).
- Phase 08 MUST NOT start until 03, 04b, 05, 07 pass. Phase 08b MUST NOT start until 04b and 08 pass.
- Phase 10 MUST NOT start until every other phase is VERIFIED or recorded SKIPPED (P1 only).

### Parallel-safe groups (disjoint blast radius, see registry)

| Group | Phases | Why parallel-safe |
|---|---|---|
| M1 | 03 ∥ 04a | `apps/web/src` vs `apps/worker/src`; 04a adds one web e2e spec after 03 verifies |
| G1 | 02 ∥ 04b | `packages/core` + fixtures + web investor view vs `apps/worker` + seed + migrations |
| G2 | 05 ∥ 06 ∥ 09 | separate feature dirs; seams are append-only single lines (orchestrator serializes) |
| G3 | 07 with remaining 06/09 | `diff/` vs `adapters,ocr` vs `outline/` |
| Serial | 08 → 08b → 10 | shared web/gate/memory surfaces and final integration |

---

## Milestone 1 — Vertical Slice (00 → 01 → 03 → 04a)

Goal: after an unattended run the app is testable end to end: open a bundled sample in a web app built to the approved mockup, see REAL findings from the core engine (golden #1, #3/#5, #11), click a finding to highlight the quoted clause, triage with required dismiss reason (stub memory API), and reach the same app through the thin local Worker that serves the assets and `/api/quota`.

End-to-end acceptance check (all must pass):

```bash
pnpm install --frozen-lockfile
pnpm --filter @aduin/core test:golden        # AC11, AC12, AC13 on real samples
pnpm --filter @aduin/web test                # incl. tokens-match-mockup
pnpm slice:check                             # builds web, starts wrangler dev (local), runs apps/web/e2e/slice.spec.ts, GET /api/quota, guards
pnpm guard:cf && pnpm secrets:scan
```

Plus an agent-probe visual check of the app shell + Findings screen against `design/mockups/app.html` (1440/1199/1024). ACs proven at M1 (owner phases): AC2–AC5 (HTML samples), AC6 (stub API), AC7–AC9, AC11–AC13, AC37–AC38 (client parts), AC41, AC43, AC46 (vectors), AC49 (stub), AC26/27/32/33/39 (Worker logic over ports). Note: P03 now only partially meets AC6 (app.html has no edit text/severity affordance; see backlog `B-EDIT`) and AC30; AC17 view moves to Phase 02.

Spikes needed by the slice: S6, S7, S1, S2 (Phase 00). Others (S3, S4 in 06; S5, S8, S9, S10 in 04b) are specified in Phase 00 with kill criteria and run at their owner phase; their fallbacks are pre-adopted so nothing blocks M1.

---

## Per-Phase Entry / Exit Gates

| Phase | Entry | Exit gate |
|---|---|---|
| 00 | Program start | scaffold commands green; guards green; spikes S6/S7/S1/S2 verdicts; REF written |
| 01 | 00 exit | core tests, goldens, property tests green; contracts v1 frozen |
| 03 | 01 exit | web unit + e2e green; tokens match mockup; visual check; real findings visible |
| 04a | 01 exit | Worker proxy tests green; `pnpm slice:check` green (M1) |
| 02 | 01 exit (web: 03) | seeded matrix, flags, investor paths green; corpus ceiling met; fund fixtures committed |
| 04b | 00 + 01 exit | schema/isolation/audit/purge/seed tests green; spike verdicts S5/S8/S9/S10 |
| 05 | 02, 03, 04a, 04b exit | AI lane tests green with recorded responses; prompts frozen |
| 06 | 01, 03, 04a exit | ingest-all-formats, OCR tests green; S3/S4 verdicts; precompute done or authored fallback stated |
| 09 | 02, 03 exit | outline export tests green (or SKIPPED) |
| 07 | 02, 03, 05 exit | drift, sibling, diff e2e green |
| 08 | 03, 04b, 05, 07 exit | counsel/gate/memory e2e green against the real Worker |
| 08b | 04b, 08 exit | memory UI e2e green (or SKIPPED) |
| 10 | all others | live URL smoke, Free-plan conformance, a11y, fund II, deliverables, zone untouched |

---

## Per-Phase Loop

Each phase executes the canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP`. This inner loop SKIPS SPEC — SPEC runs once in the outer program loop, not per phase. The 7 steps map to:

1. **RESEARCH** — spawn research-agent: load context, read prior phase reports (the immediately prior in full; earlier ones' Forward Preview only), check plan drift, document findings
2. **INNOVATE** — spawn innovate-agent: decide approach; write Decision Summary (chosen approach + rejected alternatives)
3. **PLAN-SUPPLEMENT** — spawn plan-agent: add gaps/pre-conditions into the existing phase plan (never author a new plan) or mark "n/a — research clean"; write Inner Loop Refresh Note if sections changed
4. **PVL** — spawn vc-validate-agent: full V1-V7; validate-contract per `.claude/skills/vc-validate-findings/references/example-validate-output.md`; remote/live actions get explicit APPROVED lines
5. **EXECUTE** — spawn vc-execute-agent per approved plan and validate-contract; per-section test gates run inline
6. **EVL** — spawn vc-tester: run phase gates to green; regression checkpoint; register follow-up stubs; write EVL HANDOFF SUMMARY
7. **UPDATE-PROCESS** — write phase report to the durable report path, rewrite umbrella `## Current Execution State` (overwrite, not append), commit

**PVL is NEVER skipped.** A placeholder `## Validate Contract` = blocked. Do not spawn execute-agent while the Validate Contract section reads "(placeholder — vc-validate-agent writes this section before EXECUTE)".

Test-tier rules honored in every phase plan (vacuous-green ban, REQ-TEST-LINK, TEST-SCENARIO-DISCOVERY): only Fully-Automated, Hybrid and Agent-Probe prove behavior; Known-Gap is a named residual that needs a backlog stub and keeps the gate CONDITIONAL; every SPEC criterion names `proven by` + `strategy`; the `all-tests.md` router was loaded and, because the project is pre-code, no deeper test docs or test files exist (greenfield; runner and commands are created in Phase 00).

---

## Autonomous Execution Rules (During /goal)

During /goal execution of this program:
- The agent self-decides at all V5 gates; no user approval between phases.
- CONDITIONAL net gate: proceed, fixes in flight, gaps on record. BLOCKED net gate: backlog stub, continue with unblocked phases.
- **Hard stops (must pause for the user):** `git push`; attaching any custom domain or route; touching zone itsjiathao.com; any paid LLM/OCR call; live free-model calls beyond the validate-contract APPROVED-LIVE cap; deploying anywhere except `aduin-transaction-*` on workers.dev/pages.dev; plan file marks "pause required"; agent count > 100.
- **Confirmed by the user in this session:** unattended deploys to `*.workers.dev` / `*.pages.dev` are allowed (aduin-transaction-* only, secrets via `wrangler secret put` only, never zone itsjiathao.com); Accept on a blocking finding keeps the gate Blocked until counsel answers (AC22).
- **Default in force, pending explicit user confirmation:** free OpenRouter models only during the run (stricter than SPEC R3/R5, so the single paid OCR attempt of R5 is NOT used and AC14 stays soft); the paid fallback is built and disabled by config.
- The phase report is the communication channel for conflicts, errors and learnings.

---

## AC Traceability Matrix (64/64, each AC owned by exactly one phase)

Convention: **Owner** = the phase that builds the capability and carries the AC's primary named proof; **Verifying / closing** = later phase(s) where the full proof closes or is re-run. Strategy: FA Fully-Automated, H Hybrid, AP Agent-Probe. Known-Gap is not used as a proof strategy anywhere. Tier: P0 or P1 (SPEC marks).

| AC | Behavior | Tier | Owner phase | Verifying / closing phase | Strategy | Proven by |
|---|---|---|---|---|---|---|
| AC1 | Every input type opens (+firm/fund/version at upload) | P0 | 06 | 06,10 | FA | `ingest-all-formats` |
| AC2 | Sample set selectable, tagged | P0 | 03 | 06 | FA | `sample-picker-smoke` |
| AC3 | Progress visible and honest | P0 | 03 | 05 | FA | `status-stages-and-partial-failure` |
| AC4 | Finding highlight beside document | P0 | 03 | 06 | FA | `finding-highlight-e2e` |
| AC5 | Filter and sort persist | P0 | 03 | - | FA | `filter-sort-e2e` |
| AC6 | Decisions persist; dismiss needs reason | P0 | 03 | 08 | FA | `triage-actions-persist-e2e + dismiss-requires-reason-e2e` |
| AC7 | Every finding complete | P0 | 01 | 10 | FA | `finding-schema-contract` |
| AC8 | Deterministic reproducible | P0 | 01 | 02 | FA | `determinism-repeat-run` |
| AC9 | Findings explained | P0 | 01 | 02 | FA | `explanation-present-per-rule` |
| AC10 | NTD, placeholder, sensitive flags (masked) | P0 | 02 | 03 (control built) | FA | `flags-ntd-placeholder-sensitive` |
| AC11 | Golden #1 this Section 11 | P0 | 01 | - | FA | `golden-01-this-section-11` |
| AC12 | Golden #3/#5 swapped Part B refs | P0 | 01 | - | FA | `golden-03-05-swapped-part-b-refs` |
| AC13 | Golden #11 undefined Units | P0 | 01 | - | FA | `golden-11-undefined-units` |
| AC14 | Golden #9 OCR footnote 2 (soft) | P0 | 06 | 10 | H | `golden-09-ocr-footnote2` |
| AC15 | Golden #5-#6 drift | P0 | 07 | - | FA+H | `golden-05-06-drift` |
| AC16 | Low-confidence LLC Agreement | P0 | 07 | - | H | `golden-06-llc-agreement-lowconf` |
| AC17 | Structure view lists logic | P0 | 01 | 02 — Structure view (UI built after its app.html view is approved; P03 ships a placeholder route) | FA | `graph-extraction-fixtures + golden-statutory-cite-not-flagged` |
| AC18 | Seeded-defect coverage per class | P0 | 02 | 10 | FA | `seeded-defect-matrix` |
| AC19 | Version and sibling diff | P0 | 07 | - | FA | `diff-pairs-e2e + sibling-clause-common-vs-differing` |
| AC20 | Counsel sheet drafted and editable | P0 | 08 | - | FA+H | `counsel-sheet-draft-edit-e2e` |
| AC21 | DOCX export and answer tracking | P0 | 08 | - | FA | `counsel-export-contents + counsel-answer-record-e2e` |
| AC22 | Strict gate | P0 | 08 | - | FA | `gate-state-matrix + gate-e2e` |
| AC23 | OCR positions and confidence | P0 | 06 | - | H | `ocr-position-and-confidence-e2e + ocr-accuracy-vs-transcript` |
| AC24 | OCR failure graceful | P0 | 06 | - | FA | `ocr-unavailable-mode-e2e` |
| AC25 | No-LLM mode complete | P0 | 08 | 10 | FA | `no-llm-full-corpus-run` |
| AC26 | Quota and budget exhaustion survivable | P0 | 04a | 05 | FA | `llm-failure-injection-matrix + spend-cap-enforced` |
| AC27 | AI cache never stale vs rules | P0 | 04a | 05 | FA | `llm-ocr-cache-hit + cache-invalidated-by-firm-rules-change` |
| AC28 | AI never invents evidence | P0 | 05 | - | H | `llm-quote-must-exist` |
| AC29 | Performance on corpus | P0 | 10 | - | FA | `perf-budget-corpus` |
| AC30 | Accessibility basics | P0 | 10 | - | H | `a11y-scan-and-keyboard-e2e` |
| AC31 | Live demo and deliverables | P0 | 10 | - | FA+AP | `deployed-smoke-e2e + deliverables checklist` |
| AC32 | Per-visitor AI run limit | P0 | 04a | 05 | FA | `per-visitor-ai-limit-e2e` |
| AC33 | Global daily cap and budget | P0 | 04a | 05 | FA | `global-daily-cap-and-budget` |
| AC34 | Cached results reused for samples | P0 | 05 | 10 | FA | `sample-open-zero-llm-calls` |
| AC35 | Auto downgrade with banner | P0 | 05 | - | FA | `auto-downgrade-banner-e2e + ai-resume-after-reset` |
| AC36 | Fresh vs cached visible | P0 | 05 | - | FA | `provenance-fresh-vs-cache-ui` |
| AC37 | Upload limits enforced and stated | P0 | 03 | 06 | FA | `upload-limits-e2e` |
| AC38 | Privacy notice and AI toggle, retention | P0 | 03 | 04b,05 | FA | `privacy-notice-and-ai-toggle-e2e + retention-purge-test` |
| AC39 | Public-endpoint abuse protection | P0 | 04a | 03,10 | FA | `abuse-protection-matrix` |
| AC40 | Fits Workers Free limits | P0 | 10 | 04a,04b interim | FA+H | `free-plan-limits-conformance + limit-exceeded-safe-failure` |
| AC41 | Documents linked to firm, fund, version | P0 | 03 | 04b | FA | `upload-firm-tagging-e2e` |
| AC42 | Decision stored with full record | P0 | 04b | - | FA | `decision-record-contract + decision-append-only` |
| AC43 | Findings labeled from memory | P0 | 01 | 04b,08 | FA | `memory-label-matrix` |
| AC44 | Handled findings not re-flagged | P0 | 08 | - | FA | `memory-no-reflag-e2e` |
| AC45 | Prior answers shown, not re-asked | P0 | 08 | - | FA | `memory-prior-answer-not-reasked-e2e` |
| AC46 | Edited passage is new | P0 | 01 | 08 | FA | `memory-edit-is-new-e2e + fingerprint-normalization-property` |
| AC47 | No cross firm or workspace | P0 | 04b | 08 | FA | `memory-no-cross-firm-or-workspace-e2e` |
| AC48 | Blocking defects never hidden | P0 | 08 | - | FA | `memory-blocking-never-hidden-e2e + gate-with-reconfirm-state` |
| AC49 | Previously handled complete and collapsible | P0 | 03 | 08 | FA | `previously-handled-section-e2e` |
| AC50 | Reopen a past decision | P1 | 04b | 08b | FA | `memory-reopen-e2e` |
| AC51 | Firm rules are context, never a filter | P1 | 05 | 08b | H | `firm-rule-in-context-recorded-llm + firm-rule-isolation` |
| AC52 | Per-firm memory page | P1 | 08b | - | FA | `firm-memory-page-e2e` |
| AC53 | Rule proposed from repeated dismissals | P1 | 04b | 08b | FA | `rule-proposal-threshold-matrix` |
| AC54 | Proposed rule needs approval | P1 | 08b | - | FA | `rule-proposal-needs-approval-e2e` |
| AC55 | Audit trail append-only | P0 | 04b | 08 | FA | `audit-trail-append-only-e2e` |
| AC56 | Private sandbox per visitor | P0 | 04b | 08 | FA | `sandbox-isolation-e2e` |
| AC57 | Seeded demo workspace protected | P0 | 04b | 08,10 | FA | `demo-workspace-seeded-effects-e2e + demo-workspace-not-polluted-e2e` |
| AC58 | Memory keeps only snippets, hashes, metadata | P0 | 04b | - | FA | `memory-storage-contract + memory-retention-purge-test` |
| AC59 | Fund II reduces work by half | P0 | 10 | 08 interim | FA | `fund-two-memory-reduction-e2e` |
| AC60 | Fund II hides no defect, repeats no question | P0 | 10 | 08 interim | FA | `fund-two-zero-hidden-zero-repeat-e2e` |
| AC61 | Investor-type path view | P0 | 02 | - | FA | `investor-path-extraction-fixtures + investor-path-determinism` |
| AC62 | Investor types with no path flagged | P0 | 02 | - | FA | `investor-path-seeded-defects` |
| AC63 | Form logic outline export | P1 | 09 | - | FA | `logic-outline-export-contents` |
| AC64 | Delivery metrics per document | P0 | 08 | - | FA | `document-metrics-panel-e2e` |

Ownership count: 00:0, 01:9, 02:4, 03:9, 04a:5, 04b:8, 05:5, 06:4, 07:3, 08:8, 08b:2, 09:1, 10:6 = 64. Phase 00 owns none (enabling). Coverage check is scripted (see Verification Evidence).

---

## Blast-Radius Registry (summary; full text in `phase-blast-radius-registry.md`)

| Phase | Owns (creates) | Extends (documented) | Parallel-safe with |
|---|---|---|---|
| 00 | root config, `packages/*`/`apps/*`/`scripts` skeletons, `fixtures/` dirs, guards, seam stubs, spike scripts | `.gitignore` | none (first) |
| 01 | `packages/core/**` (model, adapters/html, structure, graph, findings, detectors golden, memory, session, config, contracts, engine), `fixtures/{fingerprint-vectors.json,memory/law-firms.json}` | — | none |
| 03 | `apps/web/**`, `scripts/src/build-samples.ts` | — | 04a |
| 04a | `apps/worker/src/{routes/proxy,proxy,upstream,limits,identity/turnstile.ts,config.ts}`, `apps/worker/test/{proxy,fakes}`, `scripts/src/slice-check.ts`, `apps/web/e2e/slice.spec.ts` | seam line in `apps/worker/src/app.ts` | 03 |
| 02 | `packages/core/src/{detectors (new files),investor,memory/patternKey.ts}`, `fixtures/{html-seeded,memory/fund-*,memory/demo-seed-spec.json}`, `scripts/src/fixtures`, `apps/web/src/features/investor-paths`, 2 web e2e specs | detector registry and barrel (append) | 04b |
| 04b | `apps/worker/{migrations,seed,src/db,src/platform,src/memory,src/routes/memory,test/memory}`, `scripts/src/{seed,spikes s05,s08,s09,s10}`, `fixtures/memory/_test-seed-spec.json` | seam line in `apps/worker/src/app.ts` | 02 |
| 05 | `packages/core/src/llm/**`, `fixtures/llm-recordings/{clause-judgment,counsel-draft}`, `apps/web/src/features/ai/**`, `scripts/src/{record/record-ai.ts,precompute/precompute-ai.ts}` | `apps/worker/src/routes/proxy/ai.ts`; `features/review/**` | 06, 09 |
| 06 | `packages/core/src/{adapters pdf/docx/ocr,ocr}`, `fixtures/{docx,pdf,scans-ground-truth,llm-recordings/ocr}`, `apps/web/src/{engine,features/scan}`, `scripts/src/{ocr,spikes s03,s04,record-ocr,precompute-ocr}`, `apps/web/public/precomputed/ocr` | `features/home/**` (accept formats) | 05, 09 |
| 09 | `packages/core/src/outline/**`, `fixtures/outline`, `apps/web/src/features/outline/**` | barrel (append) | 05, 06, 07 |
| 07 | `packages/core/src/diff/**`, `packages/core/src/llm/tasks/drift-narrative.v1.ts`, `fixtures/{diff,llm-recordings/drift-narrative}`, `apps/web/src/features/diff/**` | barrel (append) | 06, 09 |
| 08 | `packages/core/src/counsel/**`, `apps/web/src/features/{counsel,gate,metrics,audit}`, `scripts/src/dev-seed.ts` | `apps/web/src/api/**` (real client), `features/review/**` | none (serial) |
| 08b | `apps/web/src/features/memory/**` | `features/audit/**` | none |
| 10 | `scripts/src/{deploy,conformance,precompute/precompute-all.ts}`, final `public/precomputed/**`, `README.md`, `docs/**` | `apps/worker/wrangler.jsonc` (D1 id), `apps/worker/seed/demo.sql` (regenerated) | none |

Seam files (single-line appends serialized by the orchestrator): `packages/core/src/index.ts`, `packages/core/src/detectors/registry.ts`, `apps/web/src/features/registry.ts`, `apps/worker/src/app.ts`. Manifests and lockfile are owned by Phase 00.

---

## Pre-PVL Conflict Resolution

Orchestrator classification (2026-10-17, outer PVL of Milestone 1):

| Shared surface | Classification | Winner / rule |
|---|---|---|
| `packages/core` | parallel-safe | Disjoint subdirectories per phase; barrel lines are append-only |
| `apps/web` | parallel-safe | 03 owns the shell; later phases add feature dirs; 06 extends `apps/web/src/engine` after 03 |
| `apps/worker` | parallel-safe (04a ∥ 04b) / sequential (05 after 04a) | Disjoint subdirectories; `createApp` pre-wires `mountProxyRoutes` + `mountMemoryRoutes` (Phase 00 B4) |
| `apps/web/e2e/slice.spec.ts` | **reassign → 04a** | 04a owns the slice spec + `scripts/src/slice-check.ts`; 03 proves real findings via `finding-highlight` |
| `pnpm-lock.yaml`, `THIRD_PARTY_NOTICES.md`, `.gitignore`, root manifests | seam (Phase 00 owner) | 03 and 04a edits are serialized by the orchestrator (one commit at a time) |
| `apps/worker/wrangler.jsonc` | seam (Phase 00 skeleton) | 04a owns proxy vars; 04b owns `triggers.crons` + purge vars; one-key serialized edits |

Planner's pre-analysis for the orchestrator (not the final classification): `packages/core` — shared by 01, 02, 05, 06, 07, 08, 09 but in disjoint subdirectories with append-only barrel lines: parallel-safe within groups G1/G2/G3. `apps/web` — 03 owns the shell; later phases add feature directories: parallel-safe except the seam registry. `apps/worker` — 04a vs 04b disjoint by subdirectory; 05 extends one 04a file after 04a verifies (sequential, not parallel).

---

## Execution Strategy per Phase (vc-agent-strategy-compare applied inline, 7-signal score)

Per-phase strategy is also recorded inside each phase plan. Agent-team is the mandated strategy for creating 3+ phase plans; this PLAN session was a single planner (blast radii checked in the registry instead of live cross-talk), so the validation fan-out below is where parallelism is used.

| Phase | Score | Recommended execution strategy | Models |
|---|---|---|---|
| 00 | 5/7 HIGH | sequential scaffold; parallel read-only spike probes | sonnet; opus for code |
| 01 | 5/7 HIGH | sequential (tightly coupled engine) | sonnet; opus for code |
| 03 | 3/7 MEDIUM | sequential; optional read-only visual probe subagent | sonnet; opus for code |
| 04a | 4/7 HIGH | sequential + read-only security review (vc-security) | sonnet; opus for code |
| 02 | 3/7 MEDIUM | parallel subagents for detector groups, then sequential | sonnet; opus for code |
| 04b | 5/7 HIGH | sequential + read-only security/tenant review | sonnet; opus for code |
| 05 | 5/7 HIGH | agent team (core/LLM, web lane, worker wiring) | sonnet; opus for code |
| 06 | 4/7 HIGH | parallel adapters, sequential OCR pipeline | sonnet; opus for code |
| 07 | 2/7 MEDIUM | sequential | sonnet; opus for code |
| 08 | 5/7 HIGH | agent team of 2 (core; web + integration e2e) | sonnet; opus for code |
| 08b, 09 | 1/7 LOW | sequential | sonnet; opus for code |
| 10 | 5/7 HIGH | sequential deploy; parallel read-only sign-off and docs | sonnet; opus for deploy code |

**Outer PVL (validate) fan-out for 13 plans (phase-END recommendation):** parallel validate subagents, one per phase plan (read-only, no cross-talk), sonnet each, about 13–15 agents (under the 30-agent guard); orchestrator merges V7 gap lists. Present the four options (sequential invalid for 3+ plans; parallel subagents recommended; workflow overkill; agent team viable if registry conflicts appear).

---

## Locked Numeric Defaults (PLAN-proposed; user may veto before outer PVL; single source `packages/core/src/config/limits.ts`)

| Constant | Default | Rationale / dependency |
|---|---|---|
| Upload limit | 10 MB, 30 pages per scan, types `.htm .html .pdf .docx .jpg .jpeg .png` | samples are 50–380 KB HTML; 22-page scan set |
| Per-visitor AI | 3 AI documents/day (≤ 8 requests/day incl. counsel drafts); OCR ≤ 6 pages/day | free quota 50/day shared |
| Global AI cap | 35 requests per UTC day (15 held in reserve); raise only after credits exist | free tier 50/day; 1000/day only with credits |
| Spend cap | $10 total ceiling, paid path disabled (so actual spend $0) | free-only default |
| Rate limits | 30 requests/min per visitor, 6/min for AI | abuse protection |
| Body caps | AI 128 KB, OCR 700 KB, others 64 KB | S2 |
| Retention | sandbox 7 days sliding, 30 days max; ai_cache TTL 7 days; browser stored uploads 7 days; quota windows purged after 2 days; demo exempt | AC38/AC58 notice text |
| Memory | `RULE_PROPOSAL_MIN=3`; findings chunk ≤ 50; quote ≤ 1000 chars; snippet ≤ 300 chars | DATA-MODEL |
| Dismiss reasons (fixed) | "Law firm's standard wording", "Does not affect the form", "Tool false alarm", "Other" (+ optional note) | AC6, mockup |
| OCR low-confidence | page confidence < 0.6 | Phase 06 |

---

## User-Decided Product Defaults (2026-10-17, approved by the user via the design session: "đồng ý")

These override the proposed defaults in the next section wherever they differ. Each phase applies them at its inner PVL or supplement.

| # | Decision | Applies to |
|---|---|---|
| D-1 | The counsel DOCX export contains only unanswered New/Accepted questions; answers are shown in the app | 08 |
| D-2 | A counsel answer on a "Dismissed in <old fund>, re-confirm" item counts as the re-confirmation | 08, 03 (gate interim) |
| D-3 | Awaiting-counsel items can be answered in-app | 08 |
| D-4 | Retention: uploads 24h (browser); sandbox memory 30 days (demo never purged); 3 fresh-AI documents per visitor per day; opening a cached sample does not count | 03, 04a, 04b |
| D-5 | A rejected rule proposal may be re-proposed when new evidence (more same-reason dismissals) arrives | 04b, 08b |
| D-6 | Compare opens in Versions mode by default | 07 |
| D-7 | Sample corpus = 12 HTML (01–08, 10–13) + the 22-page RW Holdings scan set (09); ILPA #14 local-only; SPEC AC2 corrected | 02, 03, 06, 10 |
| D-8 (orchestrator, autonomous, reversible) | `axe-core` / `@axe-core/playwright` (MPL-2.0) is allowed as a **dev-only test dependency**. It is not copied and not shipped. The user's license rule covers code copied into the product. If the user objects, swap it for another a11y check. | 03, 10 |
| D-9 (orchestrator, from phase 00 A1) | Worker tests use `@cloudflare/vitest-plugin` 1.4.4 (`cloudflareTest`) instead of the deprecated `@cloudflare/vitest-pool-workers` 0.23.0; vitest stays at 4.1.12. Read "pool-workers" in plans 01/04a/04b as this plugin. | 01, 04a, 04b |

## Open Decisions Deferred by PLAN (with proposed defaults)

| # | Decision | Proposed default (adopted in phase plans) | Where |
|---|---|---|---|
| 1 | Retention values | see table above | 03, 04b |
| 2 | `pattern_key` spec | `<detector_id>[:<shape>]` with digits → `#`, ≤ 80 chars; AI: `ai:<task>:<class>`; reason `other` never proposes | 02 |
| 3 | Last-4 masking of sensitive spans | keep `#` + last 4 in hash and snippet (DATA-MODEL 2.2; orchestrator 2026-10-17); `sensitive_data` severity capped `medium` so a collision cannot hide a blocking item | 01, 02 |
| 4 | `unclear` counsel answer | resolves to label New; critical items stay unresolved; re-included in the next sheet | 01, 08 |
| 5 | Accept on a blocking finding | CONFIRMED by the user: gate stays Blocked until counsel answers | 03, 08 |
| 6 | AI-only findings and the gate | severity ≤ high, labeled "AI suggestion", never gate unless the analyst promotes them | 01, 05 |
| 7 | Free-only LLM and R5 paid OCR attempt | free-only in force (pending user confirmation); R5 attempt not used; AC14 soft with honest README | 05, 06, 10 |
| 8 | Sample count wording | SPEC AC2 says 13 HTML samples; the corpus has 12 `.htm` files plus the #9 scan set and the local-only ILPA PDF #14. Plan loops 12 HTML + the 22-page set; ask the user to correct the SPEC wording | 03, 06 |
| 9 | Demo seed content | built from shared passages in #3–#6 (`find-shared-passages`); swapped refs are blocking so they demo "Already answered"/"re-confirm"; fall back as described in Phase 02 | 02, 04b |
| 10 | Metrics definition "defects found before build" | findings not dismissed as false alarm at export time | 08 |
| 11 | OCR page confidence formula | `min(self_reported ?? 0.7, structural_score)` | 06 |
| 12 | Worker routing and validator | hand-rolled route table; zod unless S10 says zod/mini | 00, 04b |
| 13 | Slides tooling | Marp CLI (MIT), confirm in Phase 00 | 10 |
| 14 | UI references | none provided; mockup is the reference | 03 |
| 15 | Partners Group as the "firm" for #3–#6 | follow SPEC (pre-tagged as one firm/template family) | 01, 03 |
| 16 | OpenRouter credits | not assumed; precompute split across UTC days; top-up is the user's option | 05, 06, 10 |
| 17 | Cron on Free | not relied on; lazy purge baseline | 04b |
| 18 | Demo video narration | script and Playwright capture draft produced; human narration is a user action | 10 |
| 19 | Umbrella filename | `subdoc-qa-mvp-umbrella_PLAN_17-10-26.md` (kit rule) instead of `subdoc-qa-mvp_PLAN_17-10-26.md` | umbrella |

---

## Global Constraints

- Never lower or bypass a validator, guard or test gate; never widen the Cloudflare allowlist (resources `aduin-transaction-*`, workers.dev/pages.dev only).
- Copy code only from MIT/BSD/Apache sources and keep notices (`THIRD_PARTY_NOTICES.md`); AGPL or no-license repos are reference only; sample files are untrusted input (parse, never execute).
- Deterministic first; AI only judges graph-selected clause neighborhoods and must quote text that exists; no live AI in CI.
- Each UI phase uses the approved tokens and patterns (`design/mockups/review-workspace.html`, `process/context/ui/all-ui.md`); a mockup step precedes each new screen; `design-taste-frontend` only for marketing surfaces.
- After every phase run `pnpm guard:cf` and `pnpm secrets:scan`; after plan edits run the plan validators.
- Commit each phase's execution changes before starting the next phase. Keep process/plan/context commits separate from execution commits. No `git push` without the user.

---

## Durable Report Destinations

| Phase | Report path (inside the task folder) |
|---|---|
| 00 | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-00-scaffold-spikes_REPORT_17-10-26.md` |
| 01 | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-01-core-engine_REPORT_17-10-26.md` |
| 03 | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-03-web-shell_REPORT_17-10-26.md` |
| 04a | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04a-worker-proxy_REPORT_17-10-26.md` |
| 02 | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-02-detectors-fixtures_REPORT_17-10-26.md` |
| 04b | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04b-d1-memory-api_REPORT_17-10-26.md` |
| 05 | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-05-llm-ai-lane_REPORT_17-10-26.md` |
| 06 | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-06-pdf-docx-ocr_REPORT_17-10-26.md` |
| 07 | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-07-version-diff_REPORT_17-10-26.md` |
| 08 | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08-counsel-gate-memory_REPORT_17-10-26.md` |
| 08b | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08b-memory-ui_REPORT_17-10-26.md` |
| 09 | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-09-logic-outline_REPORT_17-10-26.md` |
| 10 | `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-10-deploy-final_REPORT_17-10-26.md` |

---

## Phase Loop Progress

Program-level view (each phase's own `## Phase Loop Progress` holds the 7 checkboxes; this table mirrors it for the orchestrator after each UPDATE-PROCESS).

| Phase | 1 R | 2 I | 3 P-S | 4 PVL | 5 E | 6 EVL | 7 UP |
|---|---|---|---|---|---|---|---|
| 00 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 01 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 03 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 04a | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 02 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 04b | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 05 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 06 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 09 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 07 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 08 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 08b | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 10 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

---

## Program Status Table

| Phase | Status |
|---|---|
| 0 — Pre-program (plan creation) | ⏳ PLANNED (plans written; outer PVL pending) |
| 00 — Scaffold + spikes | ⏳ PLANNED |
| 01 — Core engine | ⏳ PLANNED |
| 03 — Web shell (M1) | ⏳ PLANNED |
| 04a — Worker proxy (M1) | ⏳ PLANNED |
| 02 — Detectors, flags, paths, fixtures | ⏳ PLANNED |
| 04b — D1 + memory API | ⏳ PLANNED |
| 05 — LLM + AI lane | ⏳ PLANNED |
| 06 — PDF/DOCX/OCR | ⏳ PLANNED |
| 09 — Logic outline (P1) | ⏳ PLANNED |
| 07 — Version diff | ⏳ PLANNED |
| 08 — Counsel + gate + memory write-back | ⏳ PLANNED |
| 08b — Memory UI (P1) | ⏳ PLANNED |
| 10 — Deploy + final | ⏳ PLANNED |

Status values: ⏳ PLANNED | 🔨 CODE DONE | 🧪 TESTING | ✅ VERIFIED | 🚧 BLOCKED | ✅ COMPLETE | SKIPPED (P1 cut). A phase is only promoted to VERIFIED with phase gates, regression evidence and a validate-contract; any outward-facing step needs the user confirmed policy above (user confirmed deploy policy and gate semantics in this session).

---

## Touchpoints

- Monorepo: `package.json`, `pnpm-workspace.yaml`, `packages/core`, `apps/web`, `apps/worker`, `scripts`, `fixtures`, `design/mockups` (read), `docs/`, `README.md`.
- Process artifacts: this task folder (umbrella, 13 phase plans, registry, REF/REPORT files).
- Remote (Phase 10 and throwaway spikes only): Worker `aduin-transaction-web`, D1 `aduin-transaction-db`, spike resources `aduin-transaction-spike*` (deleted after use).

---

## Public Contracts

- Existing, unchanged: SPEC, INNOVATE, DATA-MODEL, mockup and context files (read-only inputs); `samples/sub-docs/raw/*` read-only.
- New program contracts: workspace package names and root command vocabulary (Phase 00); API contracts v1 and ports (Phase 01, frozen); memory endpoints (04b); AI/OCR/quota endpoints (04a); `form-logic-outline/v1` (Phase 09); DOCX counsel sheet layout (Phase 08).
- Any contract change after freeze requires a contract-change note in the phase report plus a registry entry and re-run of dependent contract tests.

---

## Blast Radius

Files directly created by the program: everything listed in the registry above. Existing repo files modified: `.gitignore` (Phase 00), `apps/worker/wrangler.jsonc` (D1 id, Phase 10), and — at UPDATE-PROCESS only — context docs (`process/context/ui/all-ui.md` tokens, `process/context/tests/all-tests.md` commands). SPEC/INNOVATE/DATA-MODEL are never modified by execution.

---

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Milestone 1 `pnpm slice:check` + goldens + tokens test + visual probe | Fully-Automated + Agent-Probe | AC11, AC12, AC13 end to end; supports AC3–AC6 |
| Per-phase test gates (listed in each phase plan) | Fully-Automated / Hybrid / Agent-Probe as assigned in the AC matrix | AC1–AC64 per the traceability matrix |
| Fund II proofs (Phase 10, interim Phase 08) | Fully-Automated | AC59, AC60 |
| Live deployed smoke + Free-plan conformance | Fully-Automated + Hybrid | AC31, AC40 |
| Plan structure validators (below) | Fully-Automated | none (artifact integrity) |

```bash
node .claude/skills/vc-generate-phase-program/scripts/validate-umbrella-artifact.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
# Expected: failures: []
for f in process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-*_PLAN_17-10-26.md; do node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs "$f"; done
# Expected: failures: [] for each
node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <each plan>
# Expected: failures: []
```

---

## Test Infra Improvement Notes

(none identified yet) — expected during execution: shared `RecordedTransport`/`OpenRouterStub` helpers (Phases 04a/05), D1 query-counting wrapper (Phase 04b), Playwright multi-context and DOCX-parse fixtures (Phase 08). Known gap carried from `all-tests.md`: no OCR ground-truth transcript yet (created in Phase 06 as agent-transcribed, spot-check recommended).

---

## Risks (program level)

| Risk | Mitigation |
|---|---|
| D1 Free 100k rows-written/day (M1) | lean rows, best-effort findings tier, outbox, read-only demo fallback, S9 calibration |
| Hold-open proxy fails on Free (S1) | uploads no-LLM, samples keep precomputed AI (AC34 unaffected) |
| Free vision/text model quality and quota | AI is a second opinion; recorded responses; precompute split across UTC days |
| Heading inference quality without tags | goldens as hard gates; corpus ceiling; severity caps with evidence |
| Schedule (M12) | Tier 2 cut order; vertical slice first |
| Demo depends on template reuse assumption (PRD) | stated in README as an assumption to confirm with Anduin |

---

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md`
- Last completed phase: Phase 0 (pre-program: plan creation; this umbrella plus 13 phase plans and the registry)
- Validate-contract status: pending (vc-validate-agent writes per phase; outer PVL over all 13 plans comes first)
- Next Step for a fresh agent: read this umbrella (Current Execution State, Phase Ordering, AC matrix), fill `## Pre-PVL Conflict Resolution`, run the outer PVL fan-out, then start Phase 00 with a research subagent.
- Current phase: Phase 00 — Scaffold + spikes
- Next action: say "ENTER VALIDATE MODE" for the outer PVL; after it, spawn vc-research-agent for Phase 00. Do not start any EXECUTE work before PVL.
- Execute-agent start instruction: read this file, read the Phase 00 plan, run the research subagent first.

---

## Execution Holds (orchestrator, 2026-10-17)

| Phase | Hold | Released when | Run-order effect |
|---|---|---|---|
| 03 web shell (and later UI-only steps of 05/07/08/08b/09) | **Dependency-BLOCKED on `design/mockups/app.html` approval.** The user is switching navigation from horizontal tabs to a vertical sidebar. The groups are REVIEW (Findings, Counsel questions), CHECK (Structure incl. an "Investor types" sub-view, Compare versions) and FIRM (Firm memory, Documents). The gate status is pinned at the sidebar bottom, the sidebar collapses to an icon rail, and detail opens in drawers. `review-workspace.html` is no longer the navigation spec; its tokens (palette, Newsreader/Geist, 4px radius, tone steps) still apply. Source: user, relayed by the design session ("Báo session build tạm chưa dựng khung UI cho tới khi tôi duyệt."). | The design session reports that the user approved app.html. Then a P03 PVL supplement re-targets the plan to app.html before EXECUTE. | Autopilot skips 03 and runs the next independent phases: 01 → 04a → 02 → 04b → 07 → 06, … The M1 slice deploy waits for 03. |

**Deferred P03 supplement items (apply together with the app.html re-target):**
- G4: drop `--` from gate commands. pnpm 11.13.1 passes `--` literally and the whole suite runs. Add a `pretest:a11y` samples hook, or a `pnpm build` webServer.
- G5: one fingerprint flow. The engine returns `quote_hash` only; the main thread calls core `fingerprintFor(finding, firmId)` before lookup; `firmId=null` means "memory not applied". Remove `firmId` from worker settings.

**Hold update (2026-10-17): Phase 03 RELEASED for shell + Findings.** The user approved `design/mockups/app.html` + `app_NOTES.md` and its 3 defaults: the Findings badge counts open items only; group labels are sentence case; Accept on a blocking finding keeps the gate Blocked until counsel answers. User's words, relayed by the design session: "Duyệt app.html và cả 3 mặc định…". Phase 03 builds the app shell (232px sidebar / 56px rail, auto-collapse below 1200px, groups Review/Check/Firm, bottom: gate pill + AI switch + analyst) and the Findings screen. Other routes are placeholders until their views in app.html are approved. **Still held:** UI for Counsel questions, Structure/Investor types, Compare, Firm memory, Documents (later UI phases build from app.html once approved). Proposed product defaults (export/retention/re-propose/Compare default) are NOT decided; plan defaults stay.

**Hold update 2 (2026-10-17): ALL UI HOLDS RELEASED.** Every view in `design/mockups/app.html` + `app_NOTES.md` is approved (committed by the design session as e676e35). The user delegated remaining design calls ("…có câu hỏi nào mày không biết hả, tự quyết định luôn. Làm hết luôn đi."), and the design session relayed it. Later UI phases build from app.html: #counsel (08), #structure incl. the Investor types sub-view (02 view, AC17/AC61), #compare (07, default Versions, "Needs counsel" creates a counsel question), #memory (08b: Decisions | Rules | Audit trail, native `<dialog>` modals with required reasons), #documents with the Upload modal (06/08b; supersedes P03's interim open-document dialog). Hash routes default to #findings and are never persisted. Design decisions made on the user's behalf are in app_NOTES.md: the gate follows AC22, so critical Awaiting-counsel items stay unresolved and the demo shows "Blocked · 4"; the Findings header count equals the gate total; seed F-02 is Accepted and F-03 is Needs counsel. **Conflict rule:** app.html/app_NOTES for UI; **SPEC wins** on any conflict. Each UI phase's PVL must cite its app.html view.

**Program-wide gate-command rule (orchestrator, 2026-10-17):** under pnpm 11.13.1, select tests with `pnpm --filter <pkg> test <token> [<token>...]` (NO `--`). Plans that still say `test -- <token>` must be read as the no-`--` form by execute agents and testers. Their supplements fix the text when each phase reaches inner PVL.

## Live Demo and Deploy Runbook (Milestone 1, 17-10-26)

- Live demo: https://aduin-transaction-web.giathaowork.workers.dev (Worker `aduin-transaction-web`, workers.dev only; active version `9dcf2f75-d8ac-419f-b33b-5a2525847ae7`). AI is fail-closed (no D1 platform, no Turnstile widget) until Phase 04b/05.
- Redeploy until 04b: `pnpm guard:cf && pnpm secrets:scan`, `pnpm --filter @aduin/web build`, then `wrangler deploy` with a generated config that is the committed `apps/worker/wrangler.jsonc` minus `d1_databases` (the committed file still carries the placeholder all-zero D1 id). Phase 04b replaces the placeholder with the real id, after which plain `wrangler deploy` works. Full recipe, secret names and rules: `process/context/worker/all-worker.md` (Deploy section).
- Verify a deploy: `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack`.
- Hard stops still apply: no custom domain or route, never the zone itsjiathao.com, `aduin-transaction-*` names only, secrets only via `wrangler secret put`.

---

## Current Execution State

Last updated: 17-10-26 (Phase 05 UPDATE PROCESS)
Current phase: Phase 06 of 13 EXECUTE in progress (Phases 00, 01, 02, 03, 04a, 04b, 05 DONE; Milestone 1 CLOSED and live)
Phase name: Phase 06 - PDF / DOCX / OCR adapters (Phase 07 version diff has PVL PASS and waits on 06; then 08, 08b, 09, 10)
Phase status: 00 DONE (7d9955b); 01 DONE (6d12628); 03 DONE (833161b); 04a DONE (729e7fd); M1 CLOSED (70d320b; live at https://aduin-transaction-web.giathaowork.workers.dev, version 9dcf2f75-d8ac-419f-b33b-5a2525847ae7; AI fail-closed until Turnstile is live); 02 DONE (7a7f421 + 1f5dade); 04b DONE (7a7f421 + bb83e04 + fb3064f + 59d9831); 05 DONE (2ac1917 + e9c90d9 + 9c9f3b5 + a9732a6 + f0f476c); 06 EXECUTE in progress; 07 PVL PASS, waiting on 06
Phase EVL: 05 green (core 355, worker 515, scripts 49, web unit 47, web e2e 82 + 1 opt-in skipped, golden 44; typecheck, lint, guards, seed, slice:check green; evidence validator 0 failures; review fixes M1-M3, L1-L3 applied). Earlier: 02 and 04b green (see their reports)
Phase report: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-05-llm-ai-lane_REPORT_17-10-26.md` (stage sections, review fix cycle, UPDATE PROCESS closeout with SPEC achievement); earlier: `subdoc-qa-mvp_PHASE-02-detectors-fixtures_REPORT_17-10-26.md`, `subdoc-qa-mvp_PHASE-04b-d1-memory-api_REPORT_17-10-26.md`
Next phase: 06 (EXECUTE now), then 07, 08, 08b, 09, 10. Phase 08 preconditions: `computeGate` excludes `detector_kind: 'ai'` with a test (L4); mask and clamp `drafts[].text` before the drafts UI (L6); re-verify firm-rule isolation end to end (I1); Worker echoes `meta.rules_hash8` / `rules_applied` and the client re-reads rules on Retry (L5). Phase 10 preconditions: Turnstile widget loader + `TURNSTILE_SECRET`; apply remote D1 migrations 0001-0005 and re-measure rows_written remotely (W10-W16); live-model quality sweep / precompute spread over UTC days (live usage so far 3 of 8 at $0); real workerd timing probe at `max_tokens` 10000. All in backlog `core-followups_REF`
Current loop step: Phase 06 EXECUTE (Phase 05 UPDATE-PROCESS complete)
Validate-contract status: 01, 02, 03, 04a, 04b, 05 PASS and EXECUTED; 06 PASS (executing); 07 PASS (waiting on 06)
Program Net Gate: CONDITIONAL (carried gaps: AC6 edit clause (B-EDIT), AC17/AC61 views placeholder until later UI phases, U1-U4 UI notes and 2 serious axe items to Phase 10, AC40 real workerd CPU/hold-open and OpenRouter accounting need the Phase 10 live probe, AC28/AC51 live-model quality residual (Hybrid), N11 D1 daily-rows risk accepted until Turnstile is live, `/api/health` lacks no-store, THIRD_PARTY_NOTICES transitive rows before 10, remote spikes not re-run for deployed paths)
Latest validator run: 17-10-26 - 05 UPDATE PROCESS: `validate-context-discovery` and `validate-plan-inventory` at closeout (see closeout report)

Loop step values: RESEARCH | INNOVATE | PLAN-SUPPLEMENT | PVL | EXECUTE | EVL | UPDATE-PROCESS
Orchestrator rule: read "Current loop step" and "validate-contract status" before spawning any subagent. Never spawn execute-agent when loop step is RESEARCH, INNOVATE, PLAN-SUPPLEMENT, or PVL.

Note: The Stable Program Goal above is fixed. This section is the only part that changes — update-process-agent rewrites it after every phase closeout (overwrite, not append — git history is the audit log).

---

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
