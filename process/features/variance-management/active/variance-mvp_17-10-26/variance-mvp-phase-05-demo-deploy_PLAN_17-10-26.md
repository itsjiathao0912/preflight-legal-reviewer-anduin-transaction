---
name: plan:variance-mvp-phase-05-demo-deploy
description: "Variance MVP Phase 05 (V5): Hartwell and Crane demo samples, variance-demo e2e specs (214 to 7, gate walk), perf and a11y re-runs, full regression, remote migration then Worker deploy to workers.dev, live smoke, residuals, closeout and final local commit"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: variance-management
  phase: phase-05
---

# Phase 05 - V5 Demo, e2e, deploy

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** variance-mvp
**Umbrella plan:** process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-05-demo-deploy_REPORT_17-10-26.md (flat in the program task folder)
**Risk class:** HIGH (deploy/runtime change; migration applied to a live remote D1; outward-facing). Manual-first evidence pack required (vc-risk-evidence-pack, 5 artifacts) under `process/features/variance-management/active/variance-mvp_17-10-26/harness/phase-05/`.
**Depends on:** Phases 01 to 04 all VERIFIED. External: Intake feature closed AND deployed before EXECUTE (Step 0).
**Context routers read:** `process/context/all-context.md`, `process/context/worker/all-worker.md` (deploy rules and recipe), `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`; `docs/DEPLOY.md` (read-only reference).

---

## Overview

Proves the whole feature on the demo story and ships it. Demo story (L9): Hartwell and Crane LLP, Northgate Infrastructure Fund III against the Fund II baseline: 214 raw changes become 7 shown (3 new, 4 logic) plus the R-01 regression, with owners, impact and the gate walk. Then: full regression of every earlier surface, remote migration, Worker deploy (the Worker serves the web bundle, so one `wrangler deploy` ships both), live smoke, residuals recorded, closeout, and a final local commit on `main` (no git push in any phase; the user pushes).

Decisions made at PLAN time (reversible, recorded):
1. **No remote demo-workspace seed delta.** The demo workspace is append-only and is seeded once with `seed_mode=1`; adding rows to the LIVE demo workspace would be irreversible (delete is blocked by trigger). So the live demo shows R-01 by recording the Fund II answer in the visitor's sandbox copy (about 2 minutes, scripted in the demo flow); `seed/demo.sql` and `seed:check` are NOT changed. A backlog stub `variance-demo-preseeded-r01_NOTE_17-10-26.md` (feature backlog) records the option and the approval it would need. (DECISION D7 called the demo seed a "deploy-slice extra"; this is the safe form of it.)
2. **README and `docs/**` are not edited here.** Counts stay literally true (13 detectors, 15 issue classes). The stale facts for the doc owner (migration range text in `docs/DEPLOY.md`, live version id, `version_drift` now emitted) go into a handoff NOTE `variance-docs-handoff_NOTE_17-10-26.md` in the feature backlog (per the doc-ownership memory).
3. **Deploy order** is: (a) apply the remote migration, (b) verify `app_meta.schema_version`, (c) single `wrangler deploy` of Worker plus assets. "Worker deploy before web" means exactly this: the server schema and code must be live before any client that sends the new fields; there is no separate web deploy path here. A new Worker against an unmigrated D1 refuses writes (503 `memory_unavailable`), so (a) strictly precedes (c).

## Step 0 - Precondition: re-sync with Intake before EXECUTE

Re-sync with Intake's landed code (inner R+I refresh) before EXECUTE: read Intake's final PLAN and closeout and its landed diff; update the `## Dependencies on Intake` section of the umbrella (observed vs assumed to observed); re-allocate the migration number; re-check the collision files in the phase-blast-radius registry; write an `## Inner Loop Refresh Note` in this plan. EXECUTE may not start until the Intake feature is closed.

Phase-specific Step 0 checks: (a) read Intake's closeout for the CURRENT live Worker version id (this becomes the rollback target; observed in Intake's Phase 4 plan: Intake redeploys static assets only and records 23612b12-51c7-4d75-a324-f4f2f6392ba8 as ITS rollback target, so after Intake's deploy the live id is a new one; read it, never assume) and the live D1 migration state (`wrangler d1 migrations list aduin-transaction-db --remote`, read-only). (b) Hartwell and Crane demo documents: observed in Intake's Phase 1 plan: Intake authors its own small set in `fixtures/package/hartwell/` (Fund III subscription agreement, Northgate LPA definitions DOCX, Fund II prior) tagged to firm `firm-x`, with a `demo-packages.json` entry `hartwell`. The variance corpus (`fixtures/variance/hartwell-crane/`, firm `hartwell-crane`, pinned to 214/7) is a SEPARATE set. The live sample list must label them distinctly (variance entries titled with the suffix "(variance demo)"), no duplicate titles, no duplicate firm entries; the demo script tells the presenter which entry shows which feature. (c) Intake's sample-picker and package demo entry points; fit the H&C samples to them. (d) Intake's deploy left the Worker in a known-good state; confirm `/api/health` and the full baseline suite are green at HEAD before any V5 edit. (e) Collision re-check on `scripts/src/build-samples.ts`: Intake Phase 2 also modifies it (copies package members, writes `apps/web/public/samples/packages.json`, keeps `manifest.json` byte-identical) and the program registry's Intake collision list does not name it; read Intake's landed diff of that file, rebase the V5 additive entries on it, and append a `## Phase 5 revision` note to `phase-blast-radius-registry.md` naming it as a seam file (append-only). (f) Re-verify every ASSUMED / OBSERVED-IN-PLAN Intake fact this plan leans on (demo entry points, rollback id, migration state, `smoke-package.ts` shape); any that fails the re-check is a Step 0 finding, not an EXECUTE-time surprise. (g) Design-owned fictional packages: check whether `samples/packages/` (01-northgate-infrastructure-iii, 02-lotus-bay-asia-growth-ii, 03-redwood-ridge-credit-i; each with README.md, answer-key.md, `_build/build.py` and DOCX docs; observed at PLAN time still being generated and uncommitted) is committed; if yes, map every `answer-key.md` row (seeded defect, exact quote, expected class and severity, AC-V* mapping) to a named test or demo step per the table in `## Fictional Sample Packages`, and record unmapped rows as backlog; if not committed, proceed with the authored corpus only and note it. (h) Working-tree concurrency: re-check the Intake edits listed in the registry `## Phase 5 revision` and measure `seed:check`, `fixtures:check` baselines before attributing any diff.

## PVL Cycle 1 Revisions

Supplement scope: added `## Known Gaps (Resolved via Backlog)`, `## Fictional Sample Packages`, Step 0 checks (g) and (h), checklist B2, touchpoint and evidence row for `variance-package-samples`. Registry gained `## Phase 5 revision` and `## PVL cycle 1 revisions`. Re-validation (cycle 1) closed both supplement gaps, added the conditional `variance-package-samples` gate to the Test Gates block, and rewrote the validate-contract as PASS.

## Phase Completion Rules

- CODE DONE = checklist A to E (specs, samples, regression) committed; Deploy is a separate gated checkpoint.
- VERIFIED = Exit Gate green INCLUDING the deploy and live smoke sections, validate-contract written, evidence pack validated, regression evidence for every earlier phase recorded. If the live smoke or deploy is blocked, the phase is CODE DONE with a named residual, never VERIFIED.
- The live memory write path (answer with assertion on the deployed D1) needs a Turnstile session, which automated Chromium cannot obtain (residual R2); it is proven locally by `stack-memory` and stays an operator residual with a backlog stub. Known-Gap is never the proving strategy; this behavior's live gate stays CONDITIONAL.

## Known Gaps (Resolved via Backlog)

Named residuals, each with a backlog stub in `process/features/variance-management/backlog/` (Known-Gap is never a proving strategy; the related gates stay CONDITIONAL):

- Live R-01 write path on the deployed D1 (needs a human Turnstile session): `variance-live-regression-operator_NOTE_17-10-26.md` - NEW PLAN REQUIRED (operator run, exact steps in the note).
- Render-first with a human-solved Turnstile session: `variance-render-first-live-turnstile_NOTE_17-10-26.md`.
- Manual keyboard passes: `variance-manual-keyboard-pass_NOTE_17-10-26.md` (Phase 04), `variance-web-manual-keyboard-pass_NOTE_17-10-26.md` (Phase 02).
- Impact lines on real sample pairs: `variance-impact-real-sample-ground-truth_NOTE_17-10-26.md` (Phase 01).
- Also created by this phase at execution: `variance-docs-handoff_NOTE_17-10-26.md`, `variance-demo-preseeded-r01_NOTE_17-10-26.md`.

## Fictional Sample Packages (design-owned inputs, reuse plan)

The design session produces three FICTIONAL fund packages as DOCX under `samples/packages/` (read-only for this program, not yet committed at PLAN time; each has README.md, `answer-key.md` with seeded defects, exact quotes, expected class and severity and AC-V* mapping, and `_build/build.py`). Reuse where they fit; they do NOT replace `fixtures/variance/hartwell-crane/` (the authored corpus stays the source for the exact 214 to 7 pin, AC-V4 and AC-V18).

| Package | Baseline | Use in Phase 05 | Strategy |
|---|---|---|---|
| 01-northgate-infrastructure-iii | Fund II baseline | live demo walk (presenter script) and an extra e2e pass of the baseline-from-package flow; map answer-key rows to AC-V1, AC-V4-like assertions | Fully-Automated for mapped rows, demo walk Agent-Probe |
| 02-lotus-bay-asia-growth-ii | prior draft v1 (master plus feeder) | prior-draft-as-baseline case (version baseline role) | Fully-Automated for mapped rows |
| 03-redwood-ridge-credit-i | none | no-baseline case: errors only, muted no-baseline line (AC for `variance-no-baseline-errors-only`) | Fully-Automated |

Rules: (1) read-only; any wrong or missing answer-key item is reported to the design owner, never edited here. (2) These are demo and e2e inputs only; counts pinned by `fixtures/variance` are not re-derived from them. (3) Sample-count guard: `scripts/src/build-samples.ts` guards the original HTML count (12) and B1 adds an explicit `12 + N` check; adding package samples would change N and the `sample-picker-smoke` `toHaveCount`, and Intake's Phase 2 already generates `apps/web/public/samples/packages.json`. Decision at Step 0 (g): if Intake's package demo entry can host these, add them there via the Intake mechanism; otherwise load them in e2e via the upload path (`setInputFiles`) from `samples/packages/**/docs` without touching the picker count. Either way the guard stays explicit, never loosened to a range. (4) Step 0 check: committed? map answer-key AC-V* rows to tests (record the mapping table in the Inner Loop Refresh Note); unmapped rows become backlog notes. (5) Zero AI/OCR calls; DOCX parse is local.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy |
|---|---|---|---|
| AC-V4 | demo pair: raw 214, exactly 7 shown (3 new, 4 logic) plus R-01; 207 cosmetic grouped in 5 groups | `variance-demo-214-to-7` (e2e) plus V1 `variance-demo-count` | Fully-Automated |
| AC-V18 | from Blocked, resolving the analyst's own items then the owners' answers leads to Ready to digitize; per-owner counts on Questions equal the gate reasons | `variance-demo-gate-walk` (e2e) | Fully-Automated |
| AC-V1 (re-verify) | baseline from the package role on the final Intake-integrated code, same firm only | `variance-baseline-from-package`, `variance-baseline-same-firm-only` re-run in the regression block | Fully-Automated |
| AC-V16 (stack) | R-01 server-side isolation on the real HTTP stack | `stack-memory-variance-regression-no-cross-firm` re-run | Hybrid |
| NFR performance (base AC29) | Fund III vs Fund II variance appears within the deterministic target (under 5 s for the largest document) | `perf-budget` (additive demo case) | Fully-Automated |
| NFR a11y (base AC30) | zero critical axe on changed screens; non-colour cues; keyboard operable | `a11y-keyboard`, `a11y-smoke` (`pnpm --filter @aduin/web test:a11y`) plus agent keyboard probe | Fully-Automated plus Agent-Probe |
| NFR Workers Free (base AC40) | variance adds no server CPU path; writes within budget | `rows-written`, `conformance-free-plan` (offline), `deploy:preflight` | Fully-Automated |
| AC-V20 (re-verify) | reproducible, no-LLM | `no-llm-corpus`, `variance-determinism-repeat-run` re-run | Fully-Automated |
| Deployed render-first | on the live site the Fund III findings and changes render without Turnstile and without waiting for memory | `probe-live-variance` (agent-probe script, read-only, zero AI/OCR calls) plus live stack smoke | Agent-Probe |
| Counts wording | "13 detectors / 15 issue classes" unchanged | new `counts-wording` scripts test (13 detectors, 15 classes, wording present) plus the `grep` gate in Test Gates | Fully-Automated |

## Entry Gate

- Phases 01 to 04 VERIFIED; Intake closed and deployed (Step 0).
- Working tree clean; credentials loaded without printing: `set -a; source ~/.config/cloudflare/credentials.env; set +a`.
- Hard stops reviewed (see Safety below).

## Touchpoints

Create:
- `apps/web/e2e/variance-{demo-214-to-7,demo-gate-walk}.spec.ts`
- `scripts/src/live/probe-variance.ts` and `scripts/test/live/probe-variance.test.ts` (script key stays `probe:live-variance`; PVL-verified naming: the existing analogues are `scripts/src/live/probe-session.ts` and `probe-ai.ts`, their tests `scripts/test/live/{probe-session,probe-ai}.test.ts`, the shared guards are `scripts/src/live/common.ts` (`assertLiveBase`, `liveBase`, `liveUrl`, `Ledger`, `LiveGuardError`, `parseFlags`, `log`) and the guard tests are `scripts/test/live/live-guards.test.ts`; there is no file called `probe-live-session` or `live-guards`. Pattern: allow-listed, ledgered, https `aduin-transaction-*.giathaowork.workers.dev` only, read-only GETs, headless Chromium, zero AI/OCR calls, stop on any non-2xx or cost; import the shared guards, never copy them)
- `scripts/test/counts-wording.test.ts` (new, Fully-Automated; PVL grep found NO existing core test that pins the counts): imports `detectors` and `ISSUE_CLASSES` from `@aduin/core` and asserts exactly 13 and 15, and reads (read-only) `README.md` and `docs/architecture/status.md` asserting the literal detector-count phrasing is still present
- `process/features/variance-management/active/variance-mvp_17-10-26/harness/phase-05/` (evidence pack, 5 artifacts)
- `apps/web/e2e/variance-package-samples.spec.ts` (new, Fully-Automated, only if Step 0 (g) finds `samples/packages/` committed: runs Northgate vs Fund II baseline, Lotus Bay prior-draft baseline and Redwood Ridge no-baseline through the upload path)
- Backlog notes in `process/features/variance-management/backlog/`: `variance-docs-handoff_NOTE_17-10-26.md`, `variance-demo-preseeded-r01_NOTE_17-10-26.md`, `variance-live-regression-operator_NOTE_17-10-26.md`, `variance-manual-keyboard-pass_NOTE_17-10-26.md` (if not already created by V4), `variance-impact-real-sample-ground-truth_NOTE_17-10-26.md` (if not created by V1)

Modify (additive):
- `scripts/src/build-samples.ts` (add the H&C Fund I/II/III and `fund-III-with-appendix-c` entries with `firmId: 'hartwell-crane'`, fund and version tags, sourced from `fixtures/variance/hartwell-crane/*`; Phase 03 owned, additive entries only; `public/samples` and `firms.json` stay generated and gitignored)
- `apps/web/e2e/{perf-budget,a11y-keyboard}.spec.ts` (additive cases for the demo pair and the changed screens)
- `apps/web/e2e/sample-picker-smoke.spec.ts` (its second test asserts `sample-option` `toHaveCount(13)`; that becomes 13 plus the number of H&C entries, a derived and logged repair; the first test loops the 12 HTML ids and stays unchanged) and `apps/web/src/features/open-document/**` ONLY by derived repair if the sample count or order assertion breaks (observe first; `open-document` is Intake-owned, so any edit is a narrow, logged exception). PVL note: `deployed-smoke.spec.ts` does not exist; the live smoke is `slice.spec.ts` (project `stack`)
- `apps/web/e2e/fixtures/variance.ts` (V2-owned helper; append only)
- `scripts/package.json` (script key `probe:live-variance`), `scripts/test/live/live-guards.test.ts` (allow-list case for the new probe, only if the pattern requires it)
- Process artifacts only after EXECUTE (UPDATE PROCESS): `process/context/{all-context.md,engine/all-engine.md,ui/all-ui.md,worker/all-worker.md,tests/all-tests.md}` and the umbrella `## Current Execution State`

Not touched in V5: `apps/worker/seed/demo.sql` and `fixtures/memory/demo-seed-spec.json` (no demo seed change), all migration files (the V3 migration is applied, never edited), `README.md`, `docs/**`, `design/**`, `packages/**` logic (a defect found here is fixed through a follow-up plan stub in its owning phase, never silently).

## Public Contracts

- Deployed surface: only `https://aduin-transaction-web.giathaowork.workers.dev` (Worker `aduin-transaction-web`, D1 `aduin-transaction-db`). No routes, no custom domain, no change to the protected zone, no new Cloudflare resource (`pnpm guard:cf` before and after).
- The remote D1 migration is forward-only; rollback is code-only (`wrangler rollback <previous-version-id>`); new columns are nullable so the previous Worker keeps working against the migrated schema.
- No change to AI/OCR behavior; AI/OCR spend stays $0; no live provider call is made by this phase.

## Blast Radius

Files directly modified or created: 2 e2e specs, 1 live probe plus its test, 1 counts-wording test, 1 sample-generator edit, 2 additive spec edits, up to 3 derived repairs, an evidence pack, up to 5 backlog notes; then process artifacts at UPDATE PROCESS. Operational blast radius: the live Worker and the live D1 (one additive migration). Guarded surfaces: the entire existing suite (see Test Gates).

## Safety (hard stops for this phase; every one stops and reports, none is retried)

- Never touch the protected Cloudflare zone; never write its name or id into any file or command; never attach a route or custom domain; only `aduin-transaction-*` resources.
- Free OpenRouter models only; at most 6 live AI calls for the whole feature and at most 3 per UTC day; this plan uses 0. Stop on any cost greater than 0, a non-`:free` model, a 429 or an open breaker.
- Commit locally on `main` only; never run git push in any phase (the user pushes). Run `pnpm guard:cf` and `pnpm secrets:scan` before the final local commit (UPDATE PROCESS).
- Never run `git stash`, `checkout`, `reset` or `restore`.
- Remote D1: only `wrangler d1 migrations list/apply ... --remote` for the one new migration, read-only SELECTs, and the read-only `wrangler d1 time-travel info` (bookmark recorded as the data rollback pointer); no `execute --file` against `--remote` (local-only rehearsal in F2b is allowed, never `--remote`); no destructive SQL; a Time Travel restore is never run by an agent (a hard stop that needs the user).
- Credentials for wrangler are loaded in the same Bash call that uses them (the approved line from the all-worker deploy recipe; the privacy hook needs the `APPROVED:` marker from the user) and never exported, printed or persisted.
- Never print `CLOUDFLARE_API_KEY`, `OPENROUTER_API_KEY`, `COOKIE_SIGNING_KEYS`, `TURNSTILE_SECRET`.

## Implementation Checklist

### Section A - PLAN-time verifications (first tasks)

- [ ] A1. Re-run the whole baseline at HEAD before editing (same list as Exit Gate regression block) and record the counts; any red baseline stops the phase (not a V5 defect).
- [ ] A2. `build-samples.ts` facts verified at PVL (re-check at EXECUTE): entries come from a hard-coded `TAGS` table and `HTML_IDS` list, files are read from `samples/sub-docs/raw/` by `${id}-*.htm`, and the function calls `fail('expected 12 HTML samples')` when the `kind: 'html'` count is not exactly 12, which would abort every `pretest:e2e`/`pretest:a11y`/`prebuild:e2e` hook the moment an H&C entry is added. B1 must change that guard deliberately. `sample-picker-smoke` asserts `toHaveCount(13)` (second test). `perf-budget` derives its largest sample from the manifest by file size (H&C docs are small, no change expected; confirm).
- [ ] A3. Confirm the deploy recipe in `process/context/worker/all-worker.md` and `docs/DEPLOY.md` (read-only), the public Turnstile site key source for `VITE_TURNSTILE_SITE_KEY` (a public build-time variable; PVL found no recorded value in the repo or the docs: `apps/web/.env.example` is blank and `docs/DEPLOY.md` gives names only, so the source is the key compiled into the LIVE bundle, read with a plain read-only `curl` of the live `index.html` and its JS assets, exactly as Intake's Phase 4 does; never invented, never printed to logs beyond the build command, and if it cannot be extracted the step stops as NEEDS_CONTEXT), and `deploy:preflight` expectations.
- [ ] A4. Read `scripts/src/live/probe-session.ts` and `scripts/src/live/common.ts` (the real names; see Touchpoints), Intake's landed `scripts/src/live/smoke-package.ts` (the closest analogue: real Chromium, records every request, aborts `/api/ai` and `/api/ocr`, fails on a failing POST or findings not visible within 5 s) and `scripts/test/live/live-guards.test.ts` to follow the allow-list, ledger and stop-reason conventions exactly; import the shared guard code rather than copying it.
- [ ] A5. List `fixtures/variance/expected/` (Phase 01 generates `expected/*.json`; its plan does not pin a file name, so do not assume `variance-demo.json`) and confirm from the real file the numbers for error findings, owner counts and gate N on Fund III (the gate walk pins these, NOT the mockup's invented 12).

### Section B - Demo samples

- [ ] B1. `build-samples.ts`: add the H&C samples (additive, deterministic) with these concrete rules: new non-numeric ids (for example `vh-fund-I`, `vh-fund-II`, `vh-fund-III`, `vh-fund-III-appendix-c`; confirm no clash with Intake's ids at Step 0) kept out of `HTML_IDS`/`TAGS` numeric flow; source files read from `fixtures/variance/hartwell-crane/*.html` (a second source dir, since the raw dir only holds `NN-*.htm`) and copied to `apps/web/public/samples/`; titles end with "(variance demo)"; `firmId: 'hartwell-crane'`; the existing hard guard becomes an explicit `12 original + N variance-demo` check (never removed, never loosened to a range); the 12 original entries and their order stay byte-identical. Then run e2e `sample-picker-smoke` and repair its `toHaveCount(13)` by derivation (13 + N), logged.

- [ ] B2. Fictional packages (conditional on Step 0 (g)): if `samples/packages/` is committed, add `variance-package-samples.spec.ts` covering the mapped answer-key rows (Northgate with Fund II baseline, Lotus Bay with prior-draft baseline, Redwood Ridge with no baseline); do not alter the 214-to-7 pin; do not change the picker count unless Step 0 (g) chose the picker route (then derive the count, logged). Gate: `variance-package-samples` (e2e, one token per call). If not committed, record "n/a - not committed" in the Inner Loop Refresh Note and continue.

### Section C - Demo e2e specs (AC-V4, AC-V18)

- [ ] C1. `variance-demo-214-to-7.spec.ts`: open Fund III (firm hartwell-crane) with baseline Fund II; assert header "vs Fund II" control, Changes 7 (3 New, 4 Logic), the cosmetic count 207 and 5 groups on request (renumber 118, fund name 41, date 8, rename 29, format 11), the impact lines for 4.2 ("US entities lose the beneficial-owner question; old rule not reusable") and the owner chips per the routing table (7A fund admin; Singapore GP and counsel; sanctions counsel; 4.2 counsel; Class A minimum GP; tax status counsel; trust split GP); record the Fund II firm-template answer (setup pair Fund II vs Fund I, "Appendix C must exist"), reopen Fund III: R-01 blocking finding "Regression: confirmed in Fund II".
- [ ] C2. `variance-demo-gate-walk.spec.ts`: from Blocked, resolve the analyst's own items (Mark as expected with reason), ask owners (per-owner questions), export per owner, answer each owner's question, assert the gate reaches Ready to digitize; assert at every step that the Questions tab counts equal the gate popover groups equal Blocked N (numbers from the pinned expected file); assert no horizontal overflow and no console errors.
- [ ] C3. Gates: `variance-demo-214-to-7`, `variance-demo-gate-walk` (e2e, one token per call).

### Section D - Performance and a11y re-runs (base AC29, AC30)

- [ ] D1. `perf-budget.spec.ts`: additive case timing the Fund III variance (errors painted, then changes) under the 5 s deterministic target; the existing cases (169 ms and 104 ms) stay unchanged.
- [ ] D2. `a11y-keyboard.spec.ts`: additive cases for the baseline modal, All/Errors/Changes segment, a change row, Questions tabs and the answer dialog (axe zero critical; keyboard order; non-colour cues).
- [ ] D3. Agent probe (record judgment in the report): keyboard walk of the demo story at 1440 and 1024 and a visual compare with `design/mockups/app-variance.html` (`DESIGN_PROBE=1 pnpm exec playwright test --project=preview design-probe`, run from `apps/web`); no pixel-parity claim.
- [ ] D4. Gates: `perf-budget`, `a11y-keyboard`, and `pnpm --filter @aduin/web test:a11y`.

### Section E - Full regression (EVL scope; serial, one agent)

- [ ] E1. Run the whole Test Gates block in order; record totals against Phase 10's recorded counts (core 2914, worker 525, web unit 223, scripts 150, preview e2e 173 plus 1 opt-in skip, stack-memory 10) and against the counts after V1 to V4.
- [ ] E2. Counts wording check: the new `scripts/test/counts-wording.test.ts` passes (13 detectors via `detectors` in `packages/core/src/detectors/registry.ts`, 15 classes via `ISSUE_CLASSES` in `packages/core/src/findings/taxonomy.ts`, `README.md` and `docs/architecture/status.md` keep their "13 detectors" wording; PVL fact: `status.md` has only the "13" phrase, the "15 issue classes" phrase lives in `README.md` and `docs/architecture/components.md`) and the grep gate matches (a changed count would be a defect to route back to V1, never a README edit here).

### Section F - Deploy to workers.dev (outward-facing checkpoint; allowed target only)

- [ ] F1. Pre-flight: `pnpm guard:cf`, `pnpm secrets:scan`, `pnpm typecheck`, worker and web test suites green; evidence pack artifacts 1 to 4 written (risk class, rollback and forward-only note, trigger and isolation proof from V3, rows_written arithmetic).
- [ ] F2. Remote migration state (read-only first): `cd apps/worker && pnpm exec wrangler d1 migrations list aduin-transaction-db --remote`; expect exactly the V3 migration pending (and nothing of Intake pending). Any unexpected pending file stops the phase. Also record the read-only Time Travel bookmark (`pnpm exec wrangler d1 time-travel info aduin-transaction-db`) in the evidence pack as the data rollback pointer; restoring is never run by an agent.
- [ ] F2b. Populated-database rehearsal, LOCAL ONLY (PVL finding: `stack-memory` applies all migrations first and seeds afterwards via `scripts/src/dev-seed.ts`, and the V3 migration drops and recreates guard triggers and adds CHECK columns, so nothing proves it over data that already exists, which is the live situation): in a scratch persist dir outside the repo, apply migrations 0001-0005 and the demo seed with the same builders as `dev-seed.ts`, add sandbox-copy rows through the app's own repo code or the seed spec, then apply the V3 migration file with `wrangler d1 execute --local --persist-to <scratch> --file <migration>`; verify no row count changed, `app_meta.schema_version` is the new value, the recreated triggers still block updates to every previously guarded column, and a second apply of the `INSERT OR IGNORE` rows is a no-op. If V3's own worker tests already prove migrate-over-seeded-data, cite them instead and record why. Never `--remote` here.
- [ ] F3. Apply: `cd apps/worker && pnpm exec wrangler d1 migrations apply aduin-transaction-db --remote`; verify `SELECT * FROM app_meta` shows the V3 `schema_version`, and `SELECT id FROM law_firm WHERE id = 'hartwell-crane'` returns one row.
- [ ] F4. Build and deploy: fresh plain build with the public key compiled in (`VITE_TURNSTILE_SITE_KEY=<public site key> pnpm --filter @aduin/web build`, never `build:e2e`), `pnpm --filter @aduin/scripts deploy:preflight`, then `cd apps/worker && pnpm exec wrangler deploy` (credentials loaded in the same Bash call; before it, `git diff --stat HEAD -- apps/worker/wrangler.jsonc` must be empty; if wrangler proposes anything beyond updating Worker `aduin-transaction-web` (a route, a custom domain, a new binding or resource, a migration prompt) STOP and report; one retry is allowed after a Cloudflare API 10500 on the deployments call, live stays on the old version meanwhile). Record the printed version id and the previous (rollback) version id in the report and the umbrella.
- [ ] F5. Post-deploy checks: `curl -s https://aduin-transaction-web.giathaowork.workers.dev/api/health` (no-store, memory schema version equals the migration), `curl -sI` for status 200 and the security headers, `pnpm guard:cf` again.
- [ ] F6. Rollback rule: if F5 or the live smoke fails, `pnpm exec wrangler rollback <previous-version-id>` (from `apps/worker`, credentials loaded in the same call) immediately (code only; the migration stays, it is additive), record in the report, mark the phase CODE DONE with the blocker.

### Section G - Live smoke (read-only)

- [ ] G1. `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` (existing smoke, `e2e/slice.spec.ts`, which opens sample 01, dismisses one finding and reads `/api/quota`: zero AI/OCR calls; with the site key compiled in a token-less browser makes no failing `POST /api/session`).
- [ ] G2. `pnpm --filter @aduin/scripts probe:live-variance`: opens the H&C Fund III sample against the Fund II baseline on the live site in headless Chromium; asserts findings and the 7 changes render within the render-first budget WITHOUT a Turnstile token and without a `/api/session` dependency; zero AI/OCR calls; ledger written; stops on any anomaly. Record timing.
- [ ] G3. Residuals written (never hidden): live memory write of R-01 (answer with assertion on the deployed D1) and the AC51-style live items need a human with a real browser (Turnstile) - stubs `variance-live-regression-operator_NOTE_17-10-26.md` and the existing `phase10-*` operator stubs; automated Chromium cannot obtain a token (residual R2).

### Section H - Evidence pack and closeout (UPDATE PROCESS step)

- [ ] H1. Evidence pack artifact 5 (live smoke output) and validation: `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/features/variance-management/active/variance-mvp_17-10-26/harness/phase-05` (0 failures).
- [ ] H2. UPDATE PROCESS (vc-update-process-agent): update `process/context/{all-context,engine/all-engine,ui/all-ui,worker/all-worker,tests/all-tests}.md` (feature summary, new gate tokens, migration number, deploy record, residuals); rewrite the umbrella `## Current Execution State`; register backlog notes; run the harness validators relevant to the change type (`validate-context-discovery`, `validate-plan-inventory`, `validate-umbrella-artifact`, `git diff --check`).
- [ ] H3. Final local commit: after the feature closes and `pnpm guard:cf` and `pnpm secrets:scan` pass, make the final local commit on `main` (orchestrator or vc-git-manager); never run git push in any phase, the user pushes. Notify the design session via the docs handoff NOTE.

### Edge cases carried from vc-scenario

1. Deploy hazards: new Worker against an unmigrated D1 (writes 503) - prevented by F2/F3 order; migration applied but deploy fails - old Worker keeps working (nullable columns); Intake's migration unexpectedly pending remotely - stop.
2. Demo hazards: sandbox copy lacks the R-01 answer (by design; the demo flow records it); the visitor opens Fund III before Fund II (no baseline: muted line and Errors only, a documented demo order); two sessions on one IP hit the 5-session cap (run the probe once).
3. Render-first hazard: a render path gated on Turnstile appears only with the site key compiled in (it happened in Phase 10) - hence G2 on the live site, not only the e2e build.

## Test Gates (exact commands; no `--` token; one token per call)

New V5 gates:

```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction
for t in variance-demo-214-to-7 variance-demo-gate-walk perf-budget a11y-keyboard sample-picker-smoke; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
pnpm --filter @aduin/web test:a11y
pnpm --filter @aduin/scripts test probe-variance
pnpm --filter @aduin/scripts test counts-wording
# conditional (only if Step 0 (g) finds samples/packages/ committed; see B2):
pnpm --filter @aduin/web test:e2e variance-package-samples
```

Full regression block (run serially; preview e2e first, then stack-memory, never together):

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm --filter @aduin/core test
pnpm --filter @aduin/worker test
pnpm --filter @aduin/web test
pnpm --filter @aduin/scripts test
pnpm --filter @aduin/web test:e2e
pnpm --filter @aduin/web test:e2e:stack-memory
pnpm slice:check
pnpm guard:cf
pnpm secrets:scan
pnpm seed:check
pnpm --filter @aduin/scripts fixtures:check
pnpm --filter @aduin/scripts record:author --check
pnpm --filter @aduin/scripts precompute:ai --from-recordings --check
for t in variance-baseline-from-package variance-baseline-same-firm-only variance-no-baseline-errors-only variance-regression-r01 variance-gate-two-states turnstile-no-block csp-headers no-llm-corpus sample-zero-calls fund-two intake-multi-upload intake-baseline-role-same-firm intake-coverage-visible intake-gate-warning-policy intake-missing-docs-request-export intake-perf-budget intake-a11y-keyboard; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
grep -n "13 deterministic detectors\|13 detectors" README.md docs/architecture/status.md
```

Deploy checks (Section F/G; outward-facing, workers.dev only):

```bash
curl -s https://aduin-transaction-web.giathaowork.workers.dev/api/health
SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack
pnpm --filter @aduin/scripts probe:live-variance
```

Notes: PVL resolved the registry-count question: NO core test pins "13 detectors / 15 issue classes" (the registry tests only assert `>= 3` and uniqueness), so V5 adds the `counts-wording` scripts test (a vitest filter that matches no file would exit 1, so a wrong token cannot pass vacuously). `fixtures:check`, `seed:check` and `precompute:ai --check` must show NO diff after V1 to V4 (the demo seed and recordings are deliberately untouched).

## Test Coverage Plan (routing chain loaded: all-tests.md, worker/all-worker.md; blast-radius tests discovered)

| Area | Tier | Scenario | Command | Proves | Does NOT prove |
|---|---|---|---|---|---|
| scripts counts | Fully-automated | 13 detectors, 15 issue classes, wording present | `pnpm --filter @aduin/scripts test counts-wording` | the wording gate (AC counts) | whether prose elsewhere is accurate |
| apps/web demo | Fully-automated | 214 to 7, groups, impact, owners, R-01 | `test:e2e variance-demo-214-to-7` | AC-V4 | human judgment of the demo narrative |
| apps/web demo | Fully-automated | gate walk to Ready; counts agree | `test:e2e variance-demo-gate-walk` | AC-V18 | the under-3-minute human timing (agent-probe, recorded) |
| apps/web perf | Fully-automated | demo pair within the 5 s target | `test:e2e perf-budget` | base AC29 | production network latency |
| apps/web a11y | Fully-automated plus Agent probe | axe zero critical; keyboard walk | `test:e2e a11y-keyboard`, `test:a11y`; agent probe | base AC30 | screen-reader quality; manual keyboard pass is a Known-Gap residual with backlog stub |
| apps/worker deploy (high-risk) | Hybrid | remote migration then deploy; health shows the new schema version | Section F commands (precondition: credentials loaded, EVL green) | deploy correctness | behavior under real load |
| deployed render-first | Agent probe | headless live open of Fund III renders changes without a token | `probe:live-variance` | the Phase 10 blind-spot class (render gated on Turnstile) | the live memory write path |
| live R-01 write path | Known-gap (named residual) | answer with assertion on the deployed D1 needs a Turnstile session | none (automated Chromium gets no token) | - | backlog stub `variance-live-regression-operator_NOTE_17-10-26.md` with exact operator steps; local proof is `stack-memory`; this gate stays CONDITIONAL, never PASS-by-default |
| all earlier phases | Fully-automated | full regression block | Test Gates | no regression | operator-only items (R2, R4) |

Failing stubs: the two new e2e specs start as `test("should <scenario>", ...)` throwing `NOT IMPLEMENTED - TDD stub for: <scenario>`.

## Exit Gate

- All commands in Test Gates exit 0 (including the full regression block); counts recorded; no baseline count regressed.
- Deploy section: migration applied, health shows the new schema version, headers 200, live stack smoke green, `probe:live-variance` green with timing recorded; version id and rollback id in the report.
- Evidence pack validator: 0 failures. `pnpm guard:cf` and `pnpm secrets:scan` green before the final local commit.
- Residuals listed in the report (live R-01 write, AC51-style items, manual keyboard pass), each with its backlog stub.

## Blockers That Would Justify BLOCKED Status

- A red baseline at HEAD that Variance did not cause (stop; report to the orchestrator).
- Remote migration state unexpected (an Intake migration pending, or the V3 number collides): stop before F3.
- Live smoke fails and rollback is needed: phase is CODE DONE with a blocker; do not retry blindly.
- Any step would require touching the protected zone, a custom domain, a paid model call or a destructive SQL: hard stop.

## Phase Loop Progress

- [ ] 0. PRECONDITION - Intake feature closed and deployed; Step 0 re-sync done; rollback target recorded; Inner Loop Refresh Note written
- [ ] 1. RESEARCH - research-agent: V1 to V4 reports read (V4 in full, earlier Forward Preview); test context loaded; drift checked
- [ ] 2. INNOVATE - innovate-agent: approach decided (n/a if the DECISION and this plan still hold)
- [ ] 3. PLAN-SUPPLEMENT - plan-agent: existing phase plan updated (or "n/a - research clean")
- [ ] 4. PVL - vc-validate-agent: full V1-V7 (security and deploy dimensions mandatory); validate-contract per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [ ] 5. EXECUTE - vc-execute-agent (opus): checklist A to G done; per-section gates green; the deploy sections run only with the validate-contract's explicit outward-facing instruction
- [ ] 6. EVL - independent vc-tester: full regression block re-run serially; stubs registered; EVL HANDOFF SUMMARY
- [ ] 7. UPDATE PROCESS - phase report written, context docs updated, umbrella state updated, program closeout, then the final local commit (no push)

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder - vc-validate-agent writes this section before EXECUTE)", the orchestrator must spawn vc-validate-agent first. A partial contract is a placeholder. Deploy and remote migration are outward-facing: they run only when the validate-contract names them explicitly.

Strategy (vc-agent-strategy-compare, PLAN-end): signals S1, S2, S6 (deploy, remote migration), S7 = 4/7 HIGH; the work is a strictly ordered pipeline (specs, regression, deploy, smoke) with one shared checkout and one port, so recommended SEQUENTIAL: one opus EXECUTE agent for Sections A to E, then a separate gated opus execute leg for F and G after the orchestrator confirms the validate-contract's deploy instruction; EVL by an independent sonnet vc-tester; a sonnet security review of the deploy checklist.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `variance-demo-214-to-7` | Fully-Automated | AC-V4 |
| `variance-demo-gate-walk` | Fully-Automated | AC-V18 |
| `variance-baseline-from-package`, `variance-baseline-same-firm-only` (re-run) | Fully-Automated | AC-V1 |
| `stack-memory-variance-regression-no-cross-firm` (re-run) | Hybrid | AC-V16 |
| `variance-determinism-repeat-run`, `no-llm-corpus` (re-run) | Fully-Automated | AC-V20 |
| `perf-budget` | Fully-Automated | NFR performance (base AC29) |
| `a11y-keyboard`, `test:a11y`, keyboard probe | Fully-Automated plus Agent-Probe | NFR UI (base AC30) |
| `rows-written`, `conformance-free-plan`, `deploy:preflight` | Fully-Automated | NFR platform (base AC40) |
| `probe:live-variance`, live stack smoke | Agent-Probe | deployed render-first (Phase 10 blind-spot class) |
| `variance-package-samples` (only if samples/packages committed) | Fully-Automated | AC-V1 (prior-draft and no-baseline cases), AC-V4 re-confirmation on package inputs |
| live R-01 write path | Known-gap residual (CONDITIONAL, backlog stub) | AC-V16 live portion only; AC-V16 itself is proven locally |

## Test Infra Improvement Notes

- A Turnstile-capable automated session (test sitekey on a non-production widget) would let the live write path and AC51-style probes run unattended; today they are operator-only (R2).
- `sample-picker-smoke` asserting an exact sample count makes every new sample a spec edit; a manifest-driven count would remove that coupling.
- `probe:live-variance` should share its guard code with `probe:live-session` (one allow-list) rather than a copy.

## Resume and Execution Handoff

- Selected plan file path: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-05-demo-deploy_PLAN_17-10-26.md`
- Umbrella plan: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md`
- Last completed step: not started (EXECUTE held until the Intake feature is closed and deployed; Phases 01 to 04 must be VERIFIED first)
- Validate-contract status: written (outer-pvl, 2026-10-17, PASS after PVL cycle 1 re-validation; supersedes the first-pass CONDITIONAL contract)
- Next step: after Phases 01 to 04 are VERIFIED and Intake is closed, spawn vc-research-agent for Step 0 plus RESEARCH. EXECUTE receives this one exact plan path.
- Validators: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this plan>`; `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <this plan>`.
- Hard rules for every agent prompt: never git stash, checkout, reset or restore; commit on main with conventional prefixes; never run git push in any phase (the user pushes); never name or touch the protected zone; execution commits separate from process commits.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: outer-pvl
supersedes: 2026-10-17 (outer-pvl) - re-validated after PVL cycle 1 supplement (both prior SUPPLEMENT REQUEST gaps closed, new Fictional Sample Packages section reviewed)

Parallel strategy: sequential
Rationale: signals S1 (web, scripts, worker operational), S2 (remote D1 migration), S6 (deploy and schema), S7 (5+ files) = 4/7 HIGH, but the work is a strictly ordered pipeline (specs, regression, migrate, deploy, smoke) on one shared checkout and one Playwright port, with no mid-run coordination need, so fit beats score: sequential. Agents: 1 opus vc-execute-agent for Sections A to E, then a separate gated opus execute leg for F and G (only after the orchestrator confirms the outward-facing instruction below), 1 sonnet vc-tester for EVL, 1 sonnet security review of the deploy checklist = 4 agents, no cost guard triggered. (The re-validation ran as one sequential read-only pass: every check below is a file read, grep or the plan-artifact validator; no build, test, Playwright, wrangler or Cloudflare call.)

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC-V4 | 214 raw changes become exactly 7 shown (3 new, 4 logic), 207 cosmetic in 5 groups, impact line for 4.2, owner chips, R-01 blocking finding after recording the Fund II answer | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-demo-214-to-7` | B |
| AC-V4 (core part, re-run) | variance result reports raw 214, shown 7, cosmetic 207 | Fully-Automated | `pnpm --filter @aduin/core test variance-demo-count` | A |
| AC-V18 | from Blocked, own items then owner answers reach Ready to digitize; Questions counts equal gate popover groups equal Blocked N at every step | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-demo-gate-walk` | B |
| AC-V1 (re-verify) | baseline from the package role on Intake-integrated code, same firm only | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-baseline-from-package` then `variance-baseline-same-firm-only` (one token per call) | A |
| AC-V1 (package inputs, conditional) | Northgate with Fund II baseline, Lotus Bay with prior-draft baseline, Redwood Ridge no-baseline errors-only, mapped answer-key rows; runs only if Step 0 (g) finds `samples/packages/` committed (else "n/a - not committed" in the Refresh Note) | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-package-samples` | B |
| AC-V16 (stack) | R-01 isolation on the real HTTP stack (local seeded D1) | Hybrid | `pnpm --filter @aduin/web test:e2e:stack-memory` (precondition: local seeded stack on :8788, free port); includes `stack-memory-variance-regression-no-cross-firm` | A |
| NFR performance (base AC29) | Fund III variance appears within 5 s; existing perf cases unchanged | Fully-Automated | `pnpm --filter @aduin/web test:e2e perf-budget` | B |
| NFR a11y (base AC30) | zero critical axe on changed screens, non-colour cues, keyboard order | Fully-Automated | `pnpm --filter @aduin/web test:e2e a11y-keyboard` and `pnpm --filter @aduin/web test:a11y` | B |
| NFR a11y (judgment) | keyboard walk of the demo story at 1440 and 1024, visual compare with the mockup (no pixel parity) | Agent-Probe | `DESIGN_PROBE=1 pnpm exec playwright test --project=preview design-probe` from `apps/web`, judgment recorded in the report | B |
| NFR Workers Free (base AC40) | variance adds no server CPU path; writes within budget; deploy artifact preflight | Fully-Automated | `pnpm --filter @aduin/worker test rows-written`, `pnpm --filter @aduin/scripts test conformance-free-plan`, `pnpm --filter @aduin/scripts deploy:preflight` (after the plain build) | A |
| AC-V20 (re-verify) | reproducible, no-LLM | Fully-Automated | `pnpm --filter @aduin/web test:e2e no-llm-corpus` and `pnpm --filter @aduin/core test variance-determinism-repeat-run` | A |
| Counts wording | exactly 13 detectors and 15 issue classes, wording present in README and status.md | Fully-Automated | `pnpm --filter @aduin/scripts test counts-wording` and `grep -n "13 deterministic detectors\|13 detectors" README.md docs/architecture/status.md` | B |
| Deploy correctness (high-risk) | remote migration list shows only the V3 file, populated-DB rehearsal clean, apply, health schema version equals the migration, headers 200, guard:cf before and after | Hybrid | Section F commands (precondition: credentials loaded in the same call, EVL green, Intake closed and deployed) | B |
| Deployed render-first | on the live site Fund III findings and 7 changes render without a Turnstile token and without `/api/session`, zero AI/OCR calls | Agent-Probe | `pnpm --filter @aduin/scripts test probe-variance` (offline guard test) then `pnpm --filter @aduin/scripts probe:live-variance` plus `SLICE_BASE_URL=... pnpm --filter @aduin/web exec playwright test --project=stack` | B |
| AC-V16 live portion | answer with assertion on the deployed D1 needs a Turnstile session (residual R2); proven locally by the stack-memory row above | Hybrid | local proof only: `stack-memory-variance-regression-no-cross-firm`; live proof is the operator note `variance-live-regression-operator_NOTE_17-10-26.md` (exists, exact steps) | D |

gap-resolution legend: A proven now (gate passes in this cycle); B fixed in this plan (gate added by this plan's checklist); C deferred to a named later phase/plan; D backlog test-building stub (named residual; keep-active; continue).

C-4 reconciliation: the `strategy` column carries only Fully-Automated, Hybrid or Agent-Probe. The live write path is a named residual row (gap-resolution D), never a proving strategy. Net-gate vacuous-green check: no developed behavior rests on Known-Gap alone (the live R-01 write has the local `stack-memory` gate; the live-only portion is a named residual with a written note).

Failing stubs (Fully-Automated rows whose proving test is NEW in this phase; rows that re-run an already existing test need no stub):

- AC-V4: `test("should reduce 214 raw changes to 7 shown (3 new, 4 logic) with 207 cosmetic in 5 groups", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should reduce 214 raw changes to 7 shown (3 new, 4 logic) with 207 cosmetic in 5 groups") })`
- AC-V18: `test("should reach Ready to digitize from Blocked with matching counts at every step", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should reach Ready to digitize from Blocked with matching counts at every step") })`
- AC-V1 (package inputs): `test("should review the Northgate, Lotus Bay and Redwood Ridge packages with the right baseline roles", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should review the Northgate, Lotus Bay and Redwood Ridge packages with the right baseline roles") })`
- NFR performance: `test("should show Fund III variance within the 5 second deterministic target", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should show Fund III variance within the 5 second deterministic target") })`
- NFR a11y: `test("should have zero critical axe violations and keyboard order on the variance screens", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should have zero critical axe violations and keyboard order on the variance screens") })`
- Counts wording: `test("should keep exactly 13 detectors and 15 issue classes with the wording present", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should keep exactly 13 detectors and 15 issue classes with the wording present") })`

Legacy line form:
- apps/web demo: [Fully-automated: `pnpm --filter @aduin/web test:e2e variance-demo-214-to-7`, `variance-demo-gate-walk`, `variance-package-samples` (conditional)] | [agent-probe: keyboard walk and mockup compare]
- apps/web perf and a11y: [Fully-automated: `perf-budget`, `a11y-keyboard`, `pnpm --filter @aduin/web test:a11y`]
- scripts counts and live probe: [Fully-automated: `pnpm --filter @aduin/scripts test counts-wording`, `probe-variance`] | [agent-probe: `probe:live-variance`]
- apps/worker deploy: [hybrid: Section F commands, precondition credentials loaded and EVL green]
- live R-01 write path: [known-gap: documented, operator note `variance-live-regression-operator_NOTE_17-10-26.md`; local proof by stack-memory]
- full regression: [Fully-automated: the whole Test Gates regression block, serial]

Dimension findings:
- Infra fit: PASS - `build-samples.ts` (line 169 `expected 12 HTML samples` guard, `HTML_IDS` list of 12) is handled by B1 and A2 (explicit `12 + N`, never loosened); the Intake collision on that file is now in the registry `## Phase 5 revision` and Step 0 (e). `scripts/src/live/{common,probe-session,probe-ai}.ts` and `scripts/test/live/live-guards.test.ts` exist as named; `scripts/package.json` has the sibling `probe:live-*` keys; the scripts workspace depends on `@aduin/core` (counts-wording imports are feasible).
- Test coverage: PASS - every developed behavior has an automated or agent-probe gate; `counts-wording` is feasible (`detectors` and `ISSUE_CLASSES` are exported from the core barrel; README lines 26, 101, 165 and `status.md` line 13 carry the wording the grep gate matches); `rows-written.test.ts`, `conformance-free-plan.test.ts`, `slice.spec.ts`, `perf-budget`, `a11y-keyboard`, `a11y-smoke`, `design-probe`, `turnstile-no-block`, `csp-headers`, `no-llm-corpus`, `sample-zero-calls`, `fund-two*` exist; variance and intake gate tokens are defined in the sibling phase plans. The one new gap found this cycle (conditional `variance-package-samples` gate missing from the Test Gates block and this table) was fixed inline.
- Breaking changes: PASS - no contract or code change in V5; the migration (V3, applied not edited) is additive and forward-only, rollback is code-only; `sample-picker-smoke` count `toHaveCount(13)` (line 35) changes by logged derived repair.
- Security surface: PASS (deploy rules re-checked, all present) - target only `https://aduin-transaction-web.giathaowork.workers.dev` (enforced in code by `assertLiveBase`); `aduin-transaction-*` resources only; no routes or custom domains; the protected zone is never named in the plan or the backlog notes (grep clean); remote migration (F2 list, bookmark, F2b local rehearsal, F3 apply, schema_version check) strictly before the single `wrangler deploy` (F4); forward-only, `wrangler rollback` code-only, Time Travel restore forbidden to agents; wrangler stop clause and clean `wrangler.jsonc` check; credentials loaded in the same call, never printed; FREE models only, 0 live AI calls (feature budget at most 6, at most 3 per UTC day); final local commit only (no push) after the feature closes with guard:cf and secrets:scan green. Evidence pack (5 artifacts) required before F.
- Section A feasibility (pre-checks): PASS - A1 to A5 reference real files and names; site-key source is the live bundle (NEEDS_CONTEXT stop if not extractable); A5 reads `fixtures/variance/expected/` (not yet on disk: Phase 01 output, known-gap).
- Section B feasibility (samples): PASS - B1 concrete (ids, second source dir, titles, `firmId`, `12 + N` guard); B2 conditional on Step 0 (g), `samples/packages/` still uncommitted at this check (untracked, three package folders with `docs/` and `_build/`), handled by the n/a path; picker-versus-upload decision and the "no duplicate titles" rule are stated in `## Fictional Sample Packages` rule 3 and Step 0 (b). Not-yet-committed samples are a Step-0-checked known-gap.
- Section C feasibility (demo e2e): PASS (conditional on prior phases) - depends on V2/V4 testids, `apps/web/e2e/fixtures/variance.ts` and the Fund III expected file, not yet on disk; ASSUMED known-gap, re-verified at Step 0 and EXECUTE (by-design hold on Intake and Phases 01 to 04).
- Section D feasibility (perf, a11y): PASS - existing specs and `design/mockups/app-variance.html` present; commands match `apps/web/package.json`.
- Section E feasibility (regression): PASS - regression tokens exist or are defined in sibling plans; `fixtures:check`, `record:author`, `precompute:ai`, `seed:check`, `slice:check`, `guard:cf`, `secrets:scan` script keys exist; counts wording corrected earlier (status.md has "13" only).
- Section F feasibility (remote migration and deploy): PASS - order, forward-only and rollback match `docs/DEPLOY.md` and `all-worker.md`; F2b, bookmark and stop clause present. Highest-risk edit: the live migration apply (recreates guard triggers on a populated D1); sequence list, bookmark, rehearsal, apply, verify, then deploy. `deploy:preflight` script key exists.
- Section G feasibility (live smoke): PASS - `slice.spec.ts` is the live smoke; `probe:live-variance` follows `probe-session.ts` and the shared `common.ts`; ledger and stop-on-anomaly reused.
- Section H feasibility (evidence, closeout, final local commit): PASS - validators exist; no push in any phase.
- Prior SUPPLEMENT REQUEST closure: gap 1 (live-regression operator note and Known Gaps section) CLOSED - the note exists with exact operator steps, `## Known Gaps (Resolved via Backlog)` lists it and the four other stubs, all five notes exist on disk. Gap 2 (registry `build-samples.ts` collision) CLOSED - `## Phase 5 revision` names it as an Intake seam file (append-only). The 9 earlier inline fixes (12-count guard, counts-wording, real probe names, site-key source, expected-folder listing, status.md wording, slice.spec.ts, F2b with Time Travel and stop clause, credential rule) are intact.
- Advisory (not counted): the registry's older `## Phase 5` section still names `probe-live-variance.ts`, `scripts/test/probe-variance.test.ts` and `deployed-smoke`; the append-only revision note states the plan text governs (`scripts/src/live/probe-variance.ts`, `scripts/test/live/probe-variance.test.ts`, `slice.spec.ts`). Concurrent Intake working-tree edits (GateButton, gate-pill, demo.sql, detectors) are Step 0 (h) re-check items.

Execute-agent instructions (outward-facing, named explicitly as the umbrella requires):
- E1. EXECUTE may not start until the Intake feature is closed and deployed and Phases 01 to 04 are VERIFIED; Step 0 runs first, including (e), (f), (g) and (h), and writes the `## Inner Loop Refresh Note`. If Intake's landed state contradicts an ASSUMED row, stop and report.
- E2. Sections A to E are a separate leg from F and G. The orchestrator confirms this instruction before spawning the F and G leg.
- E3. AUTHORIZED outward-facing actions (and only these): (1) `wrangler d1 migrations list/apply aduin-transaction-db --remote` for exactly the one V3 migration, after F2 shows it is the only pending file and F2b is clean; (2) one `wrangler deploy` of Worker `aduin-transaction-web` from `apps/worker`, only after the remote migration succeeded and `app_meta.schema_version` was verified; (3) `wrangler rollback <previous-version-id>` on failure; (4) read-only live GETs and the headless probe against https://aduin-transaction-web.giathaowork.workers.dev. Anything else (route, custom domain, new resource, secret change, remote seed, destructive SQL, Time Travel restore, a live AI or OCR call, any step touching the protected zone) is a hard stop, never retried.
- E4. Free OpenRouter models only; this phase makes 0 live AI calls (budget for the feature: at most 6, at most 3 per UTC day). Stop on any cost above 0, a non-`:free` model, a 429 or an open breaker.
- E5. Load credentials in the same Bash call that uses them; never print or persist them; run `pnpm guard:cf` and `pnpm secrets:scan` before and after deploy and before the final local commit.
- E6. B1 must keep the 12 original sample entries byte-identical and turn the `expected 12 HTML samples` guard into an explicit `12 + N` check; never delete it or loosen it to a range.
- E7. Write the evidence pack artifacts 1 to 4 before F and artifact 5 after G; the validator must report 0 failures. Commit locally on `main` only at feature close (UPDATE PROCESS), never git push, with `pnpm guard:cf` and `pnpm secrets:scan` green.
- E8. A red baseline at HEAD that Variance did not cause stops the phase. A defect in `packages/**` is routed to a follow-up plan stub in its owning phase, never fixed silently here. The `samples/packages/**` inputs are read-only; answer-key errors are reported to the design owner, never edited.

Open gaps (named known-gaps, excluded from the CONCERN count; none is a FAIL):
- Live R-01 memory write on the deployed D1 (and AC51-style items, manual keyboard pass, AC40 live measurements): known-gap: documented as NEW PLAN REQUIRED - see backlog/variance-live-regression-operator_NOTE_17-10-26.md, backlog/variance-manual-keyboard-pass_NOTE_17-10-26.md, backlog/variance-web-manual-keyboard-pass_NOTE_17-10-26.md, backlog/variance-render-first-live-turnstile_NOTE_17-10-26.md, backlog/variance-impact-real-sample-ground-truth_NOTE_17-10-26.md; existing `phase10-*` stubs in `process/general-plans/backlog/`. Two more notes are created at execution: `variance-docs-handoff_NOTE_17-10-26.md`, `variance-demo-preseeded-r01_NOTE_17-10-26.md`.
- Intake-dependent facts (demo entry points, rollback target id, remote migration state, `smoke-package.ts` shape, `build-samples.ts` merge, Intake ids) are ASSUMED or OBSERVED-IN-PLAN: known-gap, re-verified at Step 0 (a) to (f).
- `samples/packages/**` not yet committed, and `fixtures/variance/**` plus Phase 01 to 04 outputs not yet on disk: known-gap, Step 0 (g) and EXECUTE entry checks.
- Remote D1 migration behavior on live data is proven only by the local populated-DB rehearsal (F2b) and the post-apply read-only checks; the Time Travel bookmark is the data rollback pointer.

What this coverage does NOT prove:
- `variance-demo-214-to-7` and `variance-demo-gate-walk`: human judgment of the demo narrative, the under-3-minute human timing, and any behavior in a real (non-e2e-stub) memory backend.
- `variance-package-samples`: anything about answer-key rows that are not mapped to a test (those become backlog notes); the 214-to-7 pin (owned by the authored corpus).
- `perf-budget`, `a11y-keyboard`, `test:a11y`: production network latency, screen-reader quality, the manual keyboard pass.
- Regression block and `stack-memory`: operator-only items (R2, R4), live Turnstile iframe CSP with a human-solved challenge, behavior under real load, the live D1.
- Section F commands: behavior under real load, and any live-data effect not visible to read-only checks.
- `probe:live-variance` and the stack smoke: the live memory write path, AI and OCR on the live site, anything behind a Turnstile token.
- `counts-wording`: whether prose elsewhere in README or `docs/**` is accurate (docs are handed off, not edited here).

Gate: PASS (0 FAILs, 0 unresolved CONCERNs; the one new gap was fixed inline; named residuals above are documented known-gaps with backlog notes, not CONCERNs)
Accepted by: n/a for the gate (PASS); session (autonomous, planning-phase autopilot, no EXECUTE) acknowledges the named known-gaps listed under Open gaps

Amendment 17-10-26 (user decision): no git push in any phase; commit locally only; the user pushes. Wording-only tightening, no gate change.
