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
**Depends on:** Phases 01 to 04 all VERIFIED. External: the Intake feature is CLOSED AND DEPLOYED (live Worker 3d2c7301-a4a5-487c-bd7d-2f2c0800be6f); Step 0 re-sync done 2026-10-17 (see Step 0 status below).
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

Phase-specific Step 0 checks: (a) read Intake's closeout for the CURRENT live Worker version id (this becomes the rollback target; OBSERVED-IN-CODE at Step 0, 2026-10-17: the live version is `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f` (static assets only; Worker code 994ea54 unchanged; rollback chain `3d2c7301` -> `cde74507` -> `328ca295` -> `09e7a579` -> `47d98295` -> `23612b12`), so the V5 rollback target was `3d2c7301` (NOTE 18-10-26: the intake hotfix made live `b04f1a8c-41f5-4c20-92dc-196d6e7d252a`, static assets + same Worker code; that is now the rollback target, with `3d2c7301` next in the chain); re-read it read-only at EXECUTE entry in case a later deploy happened, never assume) and the live D1 migration state (`wrangler d1 migrations list aduin-transaction-db --remote`, read-only). (b) Hartwell and Crane demo documents: OBSERVED-IN-CODE (built by `scripts/src/fixtures/make-package.ts`): Intake authors its own small set in `fixtures/package/hartwell/` (Fund III subscription agreement, Northgate LPA definitions DOCX, Fund II prior) tagged to firm `firm-x`, with a `demo-packages.json` entry `hartwell`. The variance corpus (`fixtures/variance/hartwell-crane/`, firm `hartwell-crane`, pinned to 214/7) is a SEPARATE set. The live sample list must label them distinctly (variance entries titled with the suffix "(variance demo)"), no duplicate titles, no duplicate firm entries; the demo script tells the presenter which entry shows which feature. (c) Intake's sample-picker and package demo entry points; fit the H&C samples to them. (d) Intake's deploy left the Worker in a known-good state; confirm `/api/health` and the full baseline suite are green at HEAD before any V5 edit. (e) Collision re-check on `scripts/src/build-samples.ts`: Intake Phase 2 also modifies it (copies package members, writes `apps/web/public/samples/packages.json`, keeps `manifest.json` byte-identical) and the program registry's Intake collision list did not name it (now named in its Step 0 section). OBSERVED-IN-CODE (2026-10-17): the `expected 12 HTML samples` guard is now at line 214 (line 169 when planned); Intake added `buildPackages()` AFTER the manifest write, writing `public/samples/packages.json` and copies under `public/samples/packages/<id>/`; `manifest.json` is unchanged, so `sample-picker-smoke` `toHaveCount(13)` at `e2e/sample-picker-smoke.spec.ts:35` stays correct; Intake's `PACKAGE_TAGS` and demo ids (`northgate-iii`, `lotus-bay-asia-ii`, `redwood-ridge-i`, `hartwell`, `ngi`, `rw-scans`, `blackstone-appendix`) live in the package list namespace, while Variance sample ids such as `vh-fund-II` live in the sample list (no clash); read Intake's landed diff of that file, rebase the V5 additive entries on it, and append a `## Phase 5 revision` note to `phase-blast-radius-registry.md` naming it as a seam file (append-only). (f) Re-verify every ASSUMED / OBSERVED-IN-PLAN Intake fact this plan leans on (demo entry points, rollback id, migration state, `smoke-package.ts` shape); any that fails the re-check is a Step 0 finding, not an EXECUTE-time surprise. (g) Design-owned fictional packages: check whether `samples/packages/` (01-northgate-infrastructure-iii, 02-lotus-bay-asia-growth-ii, 03-redwood-ridge-credit-i; each with README.md, answer-key.md, `_build/build.py` and DOCX docs; OBSERVED-IN-CODE at Step 0, 2026-10-17: committed in c1c5fe0, README and answer-key 01 edited in 57043fc, and already consumed by Intake as demo packages) is committed: YES, so map every `answer-key.md` row (seeded defect, exact quote, expected class and severity, AC-V* mapping) to a named test or demo step per the table in `## Fictional Sample Packages`, and record unmapped rows as backlog; if not committed, proceed with the authored corpus only and note it. (h) Working-tree concurrency: re-check the Intake edits listed in the registry `## Phase 5 revision` and measure `seed:check`, `fixtures:check` baselines before attributing any diff.

**Step 0 status (resolved 2026-10-17, PLAN-SUPPLEMENT; basis `variance-mvp_STEP0-RESYNC_17-10-26.md`, git HEAD 8a9398c).** Intake is CLOSED and DEPLOYED. Answers from landed code: (a) live Worker `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f` is the rollback target; live D1 is at migrations 0001-0005 (Intake applied none); (b) Intake's `hartwell` set is built by `make-package.ts`, tagged `firm-x`; the three design demo packages (`northgate-iii`, `lotus-bay-asia-ii`, `redwood-ridge-i`) are `firmId: null`; (e) the `build-samples.ts` guard is at line 214 and Intake's `buildPackages()` is additive after the manifest write; (g) `samples/packages/` is committed; `smoke-package.ts` exists (383 lines). Decisions recorded (orchestrator defaults, reversible): **D-S0-7** P03 adds `hartwell-crane`; THIS phase retags the Northgate demo package (`fixtures/package/demo-packages.json`, `firmId` null today) to `hartwell-crane` so the live demo walk has memory, owners and R-01 (new checklist B3); Intake is closed so the edit is allowed; Intake's demo-package specs are re-run after. **D-S0-5** the authored corpus keeps the 214/7/207 pin and R-01 chain; package-01 coverage (7 shown) lives in P01 H4, and here Northgate, Lotus Bay and Redwood Ridge are opened through Intake's demo-package list (picker count stays 13). **D-S0-8** never git push in any phase. **D-S0-9** `.playwright-mcp/` and `.DS_Store` are not Variance's: never touch or commit them. **D-S0-4** the demo gate walk relies on the merged gate seams kept by P02 and P04. Baseline counts to compare against are the post-Intake documented numbers (see E1). Hook-filtered word rule: the tokens in Test Gates contain neither hook-filtered word (the production output directory and installed-packages directory names).

## PVL Cycle 1 Revisions

Supplement scope: added `## Known Gaps (Resolved via Backlog)`, `## Fictional Sample Packages`, Step 0 checks (g) and (h), checklist B2, touchpoint and evidence row for `variance-package-samples`. Registry gained `## Phase 5 revision` and `## PVL cycle 1 revisions`. Re-validation (cycle 1) closed both supplement gaps, added the conditional `variance-package-samples` gate to the Test Gates block, and rewrote the validate-contract as PASS.

## Inner PVL Revisions (18-10-26, inner-pvl: phase-5; additive, no earlier text removed)

Applied inline by the inner PVL (read-only checks of landed code at HEAD a31dff0). Where an older line below disagrees with this section, THIS SECTION GOVERNS; the affected lines also carry a pointer.

1. **Generated fixtures (B3 correction).** `fixtures/package/demo-packages.json` and `fixtures/package/expected.json` are GENERATED by `scripts/src/fixtures/make-package.ts` (`demoPackages()` writes `firmId: null` for every design package; `EXPECTED.design[...].firmId` is `null` for all three) and `pnpm --filter @aduin/scripts fixtures:check` byte-compares them. A hand edit of the JSON therefore fails `fixtures:check` as drift. The retag is made in `make-package.ts` and regenerated with `pnpm --filter @aduin/scripts package:fixtures`. Retag set (Phase 03 carry-over, orchestrator-locked): `northgate-iii` to `hartwell-crane`, `lotus-bay-asia-ii` to `ostrander-pell`, `redwood-ridge-i` stays `null` (README firm Sutter Lane and Abernathy is not in `law-firms.json`; no-baseline case). All the retag firm ids exist in `fixtures/memory/law-firms.json` (6 firms) and migration 0006. No Intake spec or core test reads `design.*.firmId` (grep clean), so the retag is expected to need no derived repair; `intake-package-lens` and `intake-missing-docs-request-export` read `expected.design` and are re-run.
2. **Demo route facts (Phase 01 and 02 measurements).** (a) The authored corpus `fixtures/variance/hartwell-crane/` gives 214 raw / 7 shown (3 new, 4 logic) / 207 cosmetic ONLY through the upload path (Fund II uploaded, then Fund III, firm Hartwell & Crane LLP; helper `openFundIIIvsII` in `apps/web/e2e/fixtures/variance-owners.ts`). (b) Bundled samples never become a pointer baseline (P02 deviation 3): the H&C picker entries from B1 open as single documents with no baseline (errors only, muted line). They are presenter conveniences, not a variance pair. (c) Package 01 (Northgate) is measured at 64 raw / 9 shown (2 new + 7 logic), answer-key recall 7/7 (P01 report; backlog `variance-package-01-key-divergence_NOTE_17-10-26.md`), NOT 7 shown; `variance-package-samples` asserts recall of the 7 answer-key passages, never a 7-row count. (d) The demo script and the docs handoff NOTE must say which route shows which number.
3. **Live health endpoint.** `GET /api/health` returns only `{ok:true}`. The schema version is served by `GET /api/memory/health` (needs header `x-aduin-client: 1`; returns `ok`, `schema_version`, `expected_schema_version`, `seed_mode`; HTTP 503 when the schema is not the expected one). `EXPECTED_SCHEMA_VERSION` is `'6'` in `apps/worker/src/memory/health.ts`. F5 checks the memory endpoint.
4. **What the deploy ships.** The live Worker code is 994ea54; since then only Variance code changed in `apps/worker/src` (11 files, P03 and P04); `wrangler.jsonc`, `seed/demo.sql` and migrations 0001-0005 are unchanged. Main also carries a commit from another session that this deploy ships in the web bundle (c677ce6: app renamed to Preflight, page title, sidebar label, favicon, request-DOCX creator; the docs commits 54a85b3 and 69156bb are not in the bundle). The live version at the last record is `b04f1a8c-41f5-4c20-92dc-196d6e7d252a` (intake hotfix, built from branch `hotfix/intake-readiness-msg`, not from main); that id is the first rollback target, then `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f`. The rename touches no e2e or live-smoke string (a grep for the old name finds only a DOCX creator field in `exportDocx.ts`, outside this phase).
5. **Outward-facing steps are a USER-CONFIRMATION HARD STOP** (see Safety and F0): the autopilot standing consent covers Sections A to E and the local parts of F (F1, F2b); it does NOT cover any remote D1 command or the deploy.
6. **Counts to compare against (E1).** The Intake numbers in E1 are stale; the documented post-Phase-04 numbers are web unit 372 tests in 55 files, worker 566 plus Phase 04 additions, core 3165 plus 3 skip plus Phase 04 additions, scripts 165, stack-memory 12, preview e2e 228 plus 1 skip plus Phase 04's 7 specs. They are re-measured at A1 and the A1 numbers are authoritative.
7. **A5 correction.** `fixtures/variance/expected/hartwell-crane.json` exists (and `seeded.json`). It pins raw 214, shown 7, new 3, logic 4, cosmetic 207, the five group counts, the seven items with owners, and the R-01 chain (setup pair Fund I vs Fund II, assertion `appendix c`, statement "Appendix C must exist", violated in Fund III, holds in Fund III with Appendix C). It does NOT pin the Blocked N of the gate: C2 asserts equality of the Questions tab counts, the gate popover groups and Blocked N at every step (P04 measured 8 gate reasons for the Fund III pair with 4 changes asked), reading N from the page, never from a hard-coded number.

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

The design session produces three FICTIONAL fund packages as DOCX under `samples/packages/` (read-only for this program, COMMITTED in c1c5fe0 and already Intake demo packages (`northgate-iii`, `lotus-bay-asia-ii`, `redwood-ridge-i` in `fixtures/package/demo-packages.json`, all `firmId: null` today); each has README.md, `answer-key.md` with seeded defects, exact quotes, expected class and severity and AC-V* mapping, and `_build/build.py`). Reuse where they fit; they do NOT replace `fixtures/variance/hartwell-crane/` (the authored corpus stays the source for the exact 214 to 7 pin, AC-V4 and AC-V18).

| Package | Baseline | Use in Phase 05 | Strategy |
|---|---|---|---|
| 01-northgate-infrastructure-iii | Fund II baseline | live demo walk (presenter script) after the D-S0-7 retag to `hartwell-crane` (B3) and an extra e2e pass of the baseline-from-package flow; map answer-key rows to AC-V1, AC-V4-like assertions | Fully-Automated for mapped rows, demo walk Agent-Probe |
| 02-lotus-bay-asia-growth-ii | prior draft v1 (master plus feeder) | prior-draft-as-baseline case (version baseline role) | Fully-Automated for mapped rows |
| 03-redwood-ridge-credit-i | none | no-baseline case: errors only, muted no-baseline line (AC for `variance-no-baseline-errors-only`) | Fully-Automated |

Rules: (1) read-only; any wrong or missing answer-key item is reported to the design owner, never edited here. (2) These are demo and e2e inputs only; counts pinned by `fixtures/variance` are not re-derived from them. (3) Sample-count guard: `scripts/src/build-samples.ts` guards the original HTML count (12) and B1 adds an explicit `12 + N` check; adding package samples would change N and the `sample-picker-smoke` `toHaveCount`, and Intake's Phase 2 already generates `apps/web/public/samples/packages.json`. Decision at Step 0 (g), DECIDED 2026-10-17: the packages are ALREADY hosted by Intake's demo-package mechanism (`fixtures/package/demo-packages.json`, built into `public/samples/packages/` by `buildPackages()`), so the specs open them through that list following `intake-demo-packages.spec.ts` and the picker count stays 13; the earlier alternatives follow for the record: if Intake's package demo entry can host these, add them there via the Intake mechanism; otherwise load them in e2e via the upload path (`setInputFiles`) from `samples/packages/**/docs` without touching the picker count. Either way the guard stays explicit, never loosened to a range. (4) Step 0 check: committed? map answer-key AC-V* rows to tests (record the mapping table in the Inner Loop Refresh Note); unmapped rows become backlog notes. (5) Zero AI/OCR calls; DOCX parse is local.

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
- `apps/web/e2e/variance-package-samples.spec.ts` (new, Fully-Automated, UNCONDITIONAL since Step 0 found `samples/packages/` committed (c1c5fe0): runs Northgate vs Fund II baseline, Lotus Bay prior-draft baseline and Redwood Ridge no-baseline through the upload path)
- Backlog notes in `process/features/variance-management/backlog/`: `variance-docs-handoff_NOTE_17-10-26.md`, `variance-demo-preseeded-r01_NOTE_17-10-26.md`, `variance-live-regression-operator_NOTE_17-10-26.md`, `variance-manual-keyboard-pass_NOTE_17-10-26.md` (if not already created by V4), `variance-impact-real-sample-ground-truth_NOTE_17-10-26.md` (if not created by V1)

Modify (additive):
- `scripts/src/build-samples.ts` (add the H&C Fund I/II/III and `fund-III-with-appendix-c` entries with `firmId: 'hartwell-crane'`, fund and version tags, sourced from `fixtures/variance/hartwell-crane/*`; Phase 03 owned, additive entries only; `public/samples` and `firms.json` stay generated and gitignored)
- `apps/web/e2e/{perf-budget,a11y-keyboard}.spec.ts` (additive cases for the demo pair and the changed screens)
- `apps/web/e2e/sample-picker-smoke.spec.ts` (its second test asserts `sample-option` `toHaveCount(13)`; that becomes 13 plus the number of H&C entries, a derived and logged repair; the first test loops the 12 HTML ids and stays unchanged) and `apps/web/src/features/open-document/**` ONLY by derived repair if the sample count or order assertion breaks (observe first; `open-document` is Intake-owned, so any edit is a narrow, logged exception). PVL note: `deployed-smoke.spec.ts` does not exist; the live smoke is `slice.spec.ts` (project `stack`)
- `apps/web/e2e/fixtures/variance.ts` (V2-owned helper; append only)
- `fixtures/package/demo-packages.json` (Intake-owned, CLOSED; ONE-field edit: the `northgate-iii` entry's `firmId` from `null` to `hartwell-crane`, D-S0-7; needs P03's `hartwell-crane` in `law-firms.json` and the generated `firms.json`; any Intake spec or pin (`fixtures/package/expected.json`, `intake-demo-packages`, `intake-firm-tagging`) that merely asserts Northgate has no firm is a narrow, logged derived repair)
- `scripts/src/fixtures/make-package.ts` (Intake-owned, CLOSED; inner PVL 18-10-26: the real retag target, `demoPackages()` firm ids and `EXPECTED.design` firm ids only) and the two GENERATED outputs `fixtures/package/demo-packages.json` and `fixtures/package/expected.json` (regenerated by `package:fixtures`, never hand-edited; this supersedes the "ONE-field edit" wording above and covers the Lotus Bay retag to `ostrander-pell`)
- `scripts/package.json` (script key `probe:live-variance`), `scripts/test/live/live-guards.test.ts` (allow-list case for the new probe, only if the pattern requires it)
- Process artifacts only after EXECUTE (UPDATE PROCESS): `process/context/{all-context.md,engine/all-engine.md,ui/all-ui.md,worker/all-worker.md,tests/all-tests.md}` and the umbrella `## Current Execution State`

Not touched in V5: `apps/worker/seed/demo.sql` and `fixtures/memory/demo-seed-spec.json` (no demo seed change), all migration files (the V3 migration is applied, never edited), `fixtures/package/**` except the one-field retag above (the generated DOCX and `checksums.json` are never edited), `README.md`, `docs/**`, `design/**`, `packages/**` logic (a defect found here is fixed through a follow-up plan stub in its owning phase, never silently).

## Public Contracts

- Deployed surface: only `https://aduin-transaction-web.giathaowork.workers.dev` (Worker `aduin-transaction-web`, D1 `aduin-transaction-db`). No routes, no custom domain, no change to the protected zone, no new Cloudflare resource (`pnpm guard:cf` before and after).
- The remote D1 migration is forward-only; rollback is code-only (`wrangler rollback <previous-version-id>`); new columns are nullable so the previous Worker keeps working against the migrated schema.
- No change to AI/OCR behavior; AI/OCR spend stays $0; no live provider call is made by this phase.

## Blast Radius

Files directly modified or created: 2 e2e specs, 1 live probe plus its test, 1 counts-wording test, 1 sample-generator edit, 1 one-field demo-package retag (D-S0-7), 1 package-samples spec, 2 additive spec edits, up to 3 derived repairs, an evidence pack, up to 5 backlog notes; then process artifacts at UPDATE PROCESS. Operational blast radius: the live Worker and the live D1 (one additive migration). Guarded surfaces: the entire existing suite (see Test Gates).

## Safety (hard stops for this phase; every one stops and reports, none is retried)

- Never touch the protected Cloudflare zone; never write its name or id into any file or command; never attach a route or custom domain; only `aduin-transaction-*` resources.
- Free OpenRouter models only; at most 6 live AI calls for the whole feature and at most 3 per UTC day; this plan uses 0. Stop on any cost greater than 0, a non-`:free` model, a 429 or an open breaker.
- Commit locally on `main` only; never run git push in any phase (the user pushes). Run `pnpm guard:cf` and `pnpm secrets:scan` before the final local commit (UPDATE PROCESS).
- Never run `git stash`, `checkout`, `reset` or `restore`.
- Remote D1: only `wrangler d1 migrations list/apply ... --remote` for the one new migration, read-only SELECTs, and the read-only `wrangler d1 time-travel info` (bookmark recorded as the data rollback pointer); no `execute --file` against `--remote` (local-only rehearsal in F2b is allowed, never `--remote`); no destructive SQL; a Time Travel restore is never run by an agent (a hard stop that needs the user).
- Credentials for wrangler are loaded in the same Bash call that uses them (the approved line from the all-worker deploy recipe; the privacy hook needs the `APPROVED:` marker from the user) and never exported, printed or persisted.
- Never print `CLOUDFLARE_API_KEY`, `OPENROUTER_API_KEY`, `COOKIE_SIGNING_KEYS`, `TURNSTILE_SECRET`.
- **USER-CONFIRMATION HARD STOP (inner PVL 18-10-26, orchestrator-locked):** before ANY remote D1 command (including the read-only list, time-travel, export and SELECT commands), before the migration apply and before `wrangler deploy` (and its rollback on failure), the orchestrator asks the USER and waits for an explicit confirmation of the packet in F0. Autopilot standing consent does not cover it. Sections A to E, F1 and F2b run without it.
- **Remote D1 allow-list additions (read-only, inner PVL 18-10-26):** `wrangler d1 export aduin-transaction-db --remote --output <scratchpad file>` (backup; the file stays outside the repo, mode 600, never committed), `wrangler d1 execute aduin-transaction-db --remote --command "<single SELECT or PRAGMA table_info>"`, and `wrangler deployments list` from `apps/worker`. Still forbidden: `execute --file` against `--remote`, any non-SELECT SQL, a Time Travel restore.
- **Single deployer rule:** another session (debug session `local_c18ddd8c-870b-46c6-be57-5413ebf73067`) also deploys hotfixes to the same Worker. The live version is re-read immediately before the migration apply and again immediately before `wrangler deploy` (F3a, F4a); a mismatch with the recorded id is a stop, never an overwrite.

## Implementation Checklist

### Section A - PLAN-time verifications (first tasks)

- [ ] A1. Re-run the whole baseline at HEAD before editing (same list as Exit Gate regression block) and record the counts; any red baseline stops the phase (not a V5 defect).
- [ ] A2. `build-samples.ts` facts verified at PVL (re-check at EXECUTE): entries come from a hard-coded `TAGS` table and `HTML_IDS` list, files are read from `samples/sub-docs/raw/` by `${id}-*.htm`, and the function calls `fail('expected 12 HTML samples')` (line 214 at HEAD a4d7a34; line 169 when planned) when the `kind: 'html'` count is not exactly 12, which would abort every `pretest:e2e`/`pretest:a11y`/`prebuild:e2e` hook the moment an H&C entry is added. B1 must change that guard deliberately. `sample-picker-smoke` asserts `toHaveCount(13)` (second test). `perf-budget` derives its largest sample from the manifest by file size (H&C docs are small, no change expected; confirm).
- [ ] A3. Confirm the deploy recipe in `process/context/worker/all-worker.md` and `docs/DEPLOY.md` (read-only), the public Turnstile site key source for `VITE_TURNSTILE_SITE_KEY` (a public build-time variable; PVL found no recorded value in the repo or the docs: `apps/web/.env.example` is blank and `docs/DEPLOY.md` gives names only, so the source is the key compiled into the LIVE bundle, read with a plain read-only `curl` of the live `index.html` and its JS assets, exactly as Intake's Phase 4 does; never invented, never printed to logs beyond the build command, and if it cannot be extracted the step stops as NEEDS_CONTEXT), and `deploy:preflight` expectations.
- [ ] A4. Read `scripts/src/live/probe-session.ts` and `scripts/src/live/common.ts` (the real names; see Touchpoints), Intake's landed `scripts/src/live/smoke-package.ts` (OBSERVED-IN-CODE: 383 lines; it exits 1 on third-party Turnstile iframe console noise, backlog stub `intake-live-smoke-turnstile-console`, so `probe-variance` must filter or record that noise rather than fail on it; the closest analogue: real Chromium, records every request, aborts `/api/ai` and `/api/ocr`, fails on a failing POST or findings not visible within 5 s) and `scripts/test/live/live-guards.test.ts` to follow the allow-list, ledger and stop-reason conventions exactly; import the shared guard code rather than copying it.
- [ ] A5. List `fixtures/variance/expected/` (Phase 01 generates `expected/*.json`; its plan does not pin a file name, so do not assume `variance-demo.json`) and confirm from the real file the numbers for error findings, owner counts and gate N on Fund III (the gate walk pins these, NOT the mockup's invented 12).

### Section B - Demo samples

- [ ] B1. `build-samples.ts`: add the H&C samples (additive, deterministic) with these concrete rules: new non-numeric ids (for example `vh-fund-I`, `vh-fund-II`, `vh-fund-III`, `vh-fund-III-appendix-c`; confirm no clash with Intake's ids at Step 0) kept out of `HTML_IDS`/`TAGS` numeric flow; source files read from `fixtures/variance/hartwell-crane/*.html` (a second source dir, since the raw dir only holds `NN-*.htm`) and copied to `apps/web/public/samples/`; titles end with "(variance demo)"; `firmId: 'hartwell-crane'`; the existing hard guard becomes an explicit `12 original + N variance-demo` check (never removed, never loosened to a range); the 12 original entries and their order stay byte-identical. Then run e2e `sample-picker-smoke` and repair its `toHaveCount(13)` by derivation (13 + N), logged.

- [ ] B2. Fictional packages (UNCONDITIONAL since Step 0 (g) found `samples/packages/` committed, c1c5fe0; open them through Intake's demo-package list, never from `samples/packages/` directly): add `variance-package-samples.spec.ts` covering the mapped answer-key rows (Northgate with Fund II baseline, Lotus Bay with prior-draft baseline, Redwood Ridge with no baseline); do not alter the 214-to-7 pin; do not change the picker count unless Step 0 (g) chose the picker route (then derive the count, logged). Gate: `variance-package-samples` (e2e, one token per call). (The earlier "if not committed" branch is void.)

- [ ] B3. Demo-package firm retag (D-S0-7; depends on P03 having added `hartwell-crane` to `fixtures/memory/law-firms.json` and the generated `firms.json`): edit ONE field in `fixtures/package/demo-packages.json`: the `northgate-iii` entry's `firmId` from `null` to `hartwell-crane`, so the live Northgate demo has memory, owners and R-01 (its README firm is Hartwell & Crane LLP). Before editing, grep `fixtures/package/expected.json` and the Intake specs for assumptions that Northgate has no firm (memory off, no-firm assertions); after editing rebuild the samples through the existing e2e prebuild hook (`scripts/src/build-samples.ts`, `buildPackages()`). Gate (one token per call): e2e `intake-demo-packages`, `intake-firm-tagging`, `intake-baseline-role-same-firm`; web unit `package-gate-ui`; `pnpm --filter @aduin/scripts fixtures:check` and `pnpm --filter @aduin/scripts test`. A failing Intake assertion that only encodes "no firm" is a narrow, logged derived repair; any other failure stops and is reported. Lotus Bay and Redwood Ridge stay `firmId: null` (their README firms are not in `law-firms.json`; Redwood is the no-baseline case). **SUPERSEDED 18-10-26: the target file and the Lotus Bay line of this item are corrected by B3b and by Inner PVL Revisions item 1; B3b governs.**

- [ ] B3b. Retag correction (governs over B3; Inner PVL Revisions item 1): edit `scripts/src/fixtures/make-package.ts` (NOT the generated JSON): in `demoPackages()` give the design packages their firm (`northgate-iii` to `hartwell-crane`, `lotus-bay-asia-ii` to `ostrander-pell`, `redwood-ridge-i` stays `null`) and set the same `firmId` in `EXPECTED.design['northgate-iii']` and `EXPECTED.design['lotus-bay-asia-ii']`; then regenerate with `pnpm --filter @aduin/scripts package:fixtures` so `fixtures/package/demo-packages.json` and `fixtures/package/expected.json` change by exactly those fields and `fixtures/package/design/checksums.json` and the DOCX copies stay byte-identical (check with `git diff --stat`). Gates (one token per call): `pnpm --filter @aduin/scripts fixtures:check`, `pnpm --filter @aduin/scripts test package-fixtures`, then B3's e2e and unit gates plus `intake-package-lens` and `intake-missing-docs-request-export`. A hand-edited generated JSON is a defect.

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

- [ ] E1. Run the whole Test Gates block in order; record totals against the post-Intake documented counts (`process/context/tests/all-tests.md`: core 3084 plus 3 skip, worker 526, web unit 298, scripts 162, contracts 34, preview e2e 217 plus 1 opt-in skip, stack-memory 11; documented, not re-measured at Step 0, so re-measure at A1) and against the counts after V1 to V4.
- [ ] E2. Counts wording check: the new `scripts/test/counts-wording.test.ts` passes (13 detectors via `detectors` in `packages/core/src/detectors/registry.ts`, 15 classes via `ISSUE_CLASSES` in `packages/core/src/findings/taxonomy.ts`, `README.md` and `docs/architecture/status.md` keep their "13 detectors" wording; PVL fact: `status.md` has only the "13" phrase, the "15 issue classes" phrase lives in `README.md` and `docs/architecture/components.md`) and the grep gate matches (a changed count would be a defect to route back to V1, never a README edit here).

### Section F - Deploy to workers.dev (outward-facing checkpoint; allowed target only)

- [ ] F0. USER-CONFIRMATION HARD STOP (inner PVL 18-10-26). EXECUTE leg 1 (Sections A to E, F1, F2b) ends here. The orchestrator asks the user, once, with this packet, and F2 to G start only after an explicit user confirmation that quotes it: (1) target `https://aduin-transaction-web.giathaowork.workers.dev`, Worker `aduin-transaction-web`, D1 `aduin-transaction-db`; (2) the exact remote commands: `migrations list --remote`, `time-travel info`, `export --remote` to the scratchpad, ONE `migrations apply --remote` (0006, not idempotent), read-only SELECTs, ONE `wrangler deploy`, and `wrangler rollback <recorded id>` only on a failed check; (3) the deploy commit (`git rev-parse HEAD`, equal to the EVL commit) and the list of commits since the live source that the bundle ships, including the other session's c677ce6 Preflight rename; (4) the recorded live version and rollback target; (5) the leg-1 evidence (all local gates green, F2b rehearsal result). No confirmation, no remote command.
- [ ] F1. Pre-flight: `pnpm guard:cf`, `pnpm secrets:scan`, `pnpm typecheck`, worker and web test suites green; evidence pack artifacts 1 to 4 written (risk class, rollback and forward-only note, trigger and isolation proof from V3, rows_written arithmetic).
- [ ] F2. Remote migration state (read-only first): `cd apps/worker && pnpm exec wrangler d1 migrations list aduin-transaction-db --remote`; expect exactly the V3 migration pending (and nothing of Intake pending; the live D1 is at migrations 0001-0005 per the context docs and Intake applied none). Any unexpected pending file stops the phase. Also record the read-only Time Travel bookmark (`pnpm exec wrangler d1 time-travel info aduin-transaction-db`) in the evidence pack as the data rollback pointer; restoring is never run by an agent.
- [ ] F2b. Populated-database rehearsal, LOCAL ONLY (PVL finding: `stack-memory` applies all migrations first and seeds afterwards via `scripts/src/dev-seed.ts`, and the V3 migration drops and recreates guard triggers and adds CHECK columns, so nothing proves it over data that already exists, which is the live situation): in a scratch persist dir outside the repo, apply migrations 0001-0005 and the demo seed with the same builders as `dev-seed.ts`, add sandbox-copy rows through the app's own repo code or the seed spec, then apply the V3 migration file with `wrangler d1 execute --local --persist-to <scratch> --file <migration>`; verify no row count changed, `app_meta.schema_version` is the new value, the recreated triggers still block updates to every previously guarded column, and a second apply of the `INSERT OR IGNORE` rows is a no-op. If V3's own worker tests already prove migrate-over-seeded-data, cite them instead and record why. Never `--remote` here.
- [ ] F2c. Backup and before-state (after F0 confirmation, read-only): `cd apps/worker && pnpm exec wrangler d1 export aduin-transaction-db --remote --output <scratchpad>/aduin-transaction-db-pre-0006.sql` (scratchpad outside the repo, mode 600, never committed, contents never pasted into a report); record the Time Travel bookmark from `time-travel info`; record BEFORE row counts with read-only `execute --remote --command "SELECT ..."` for `law_firm`, `law_firm_alias`, `workspace`, `decision`, `counsel_question`, `counsel_answer`, `finding`, `review_run`, `audit_event` (use the real table names from `migrations/0002_memory_core.sql`), the trigger names from `sqlite_master`, `app_meta`, and `migrations list`. Expected effect of 0006 on counts: `law_firm` +3, `law_firm_alias` +6, every other table unchanged, `regression_check` new and empty.
- [ ] F3a. Live-version re-check before the apply: `wrangler deployments list` (read-only) must show the recorded live version (`b04f1a8c-41f5-4c20-92dc-196d6e7d252a` unless the Step 0 re-read recorded a newer one with a source commit that is an ancestor of HEAD: `git merge-base --is-ancestor <source> HEAD`). A different active version means another session deployed: STOP and report to the orchestrator; do not apply and do not deploy.
- [ ] F3. Apply: `cd apps/worker && pnpm exec wrangler d1 migrations apply aduin-transaction-db --remote`; verify `SELECT * FROM app_meta` shows the V3 `schema_version`, and `SELECT id FROM law_firm WHERE id = 'hartwell-crane'` returns one row.
- [ ] F3b. Post-apply verification (read-only, before any deploy): `schema_version` is `'6'`; AFTER counts equal the F2c BEFORE counts except `law_firm` +3 and `law_firm_alias` +6; `regression_check` exists with 0 rows; `PRAGMA table_info(counsel_question)` lists `owner` and `owner_source`, `counsel_answer` and `decision` list `intent` and `scope`; the trigger list contains `question_owner_immutable`, `regression_check_no_delete`, `regression_check_guard_update`, `regression_check_cap`, `demo_ro_regression_check`, `demo_ro_regression_check_update`, `demo_ro_regression_check_delete`, `decision_guard_update`, `answer_guard_update`, `demo_ro_decision_update`, `demo_ro_counsel_answer_update`; `migrations list --remote` shows nothing pending. Any mismatch: STOP before the deploy; the old Worker still works (nullable columns); report with the Time Travel bookmark (restore is never run by an agent).
- [ ] F4a. Deploy pinning (inner PVL 18-10-26): immediately before the plain web build, `git rev-parse HEAD` equals the commit the full regression ran on, and `git status --porcelain` shows no modified or untracked file under `apps/`, `packages/`, `scripts/`, `fixtures/` (process files and `.playwright-mcp/`, `.DS_Store` are not Variance's and are ignored); a moved HEAD or a dirty code path stops the deploy until the regression is re-run. Immediately before `wrangler deploy`, repeat F3a (`wrangler deployments list`).
- [ ] F4. Build and deploy: fresh plain build with the public key compiled in (`VITE_TURNSTILE_SITE_KEY=<public site key> pnpm --filter @aduin/web build`, never `build:e2e`), `pnpm --filter @aduin/scripts deploy:preflight`, then `cd apps/worker && pnpm exec wrangler deploy` (credentials loaded in the same Bash call; before it, `git diff --stat HEAD -- apps/worker/wrangler.jsonc` must be empty; if wrangler proposes anything beyond updating Worker `aduin-transaction-web` (a route, a custom domain, a new binding or resource, a migration prompt) STOP and report; one retry is allowed after a Cloudflare API 10500 on the deployments call, live stays on the old version meanwhile). Record the printed version id and the previous (rollback) version id in the report and the umbrella.
- [ ] F5. Post-deploy checks: `curl -s https://aduin-transaction-web.giathaowork.workers.dev/api/health` (no-store, memory schema version equals the migration), `curl -sI` for status 200 and the security headers, `pnpm guard:cf` again.
- [ ] F6. Rollback rule: if F5 or the live smoke fails, `pnpm exec wrangler rollback <previous-version-id>` (from `apps/worker`, credentials loaded in the same call) immediately (code only; the migration stays, it is additive), record in the report, mark the phase CODE DONE with the blocker.
- [ ] F5b. F5 correction (governs over F5's `/api/health` wording; Inner PVL Revisions item 3): `curl -s https://aduin-transaction-web.giathaowork.workers.dev/api/health` must return `{"ok":true}` with `cache-control: no-store`; the schema version check is `curl -s -H 'x-aduin-client: 1' https://aduin-transaction-web.giathaowork.workers.dev/api/memory/health` returning `ok:true`, `schema_version` `'6'`, `expected_schema_version` `'6'`, `seed_mode` `'0'` (a 503 here is a failed check and triggers F6).
- [ ] F6b. Rollback scope (reconciles F6 with the Phase 03 carry-over): Worker code and the static assets are ONE version, so `wrangler rollback <id>` reverts both together; the target is the id recorded at F3a (not an older one). The migration stays. Never revert the Worker while keeping the new web bundle live (an older Worker silently drops `assertion`, `scope` and `intent`); after a rollback, tabs that loaded the new bundle may still send those fields, so record that and tell the user. A rollback is authorised only inside the F0 confirmation.

### Section G - Live smoke (read-only)

- [ ] G1. `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` (existing smoke, `e2e/slice.spec.ts`, which opens sample 01, dismisses one finding and reads `/api/quota`: zero AI/OCR calls; with the site key compiled in a token-less browser makes no failing `POST /api/session`).
- [ ] G2. `pnpm --filter @aduin/scripts probe:live-variance`: opens the H&C Fund III sample against the Fund II baseline on the live site in headless Chromium; asserts findings and the 7 changes render within the render-first budget WITHOUT a Turnstile token and without a `/api/session` dependency; zero AI/OCR calls; ledger written; stops on any anomaly. Record timing.
- [ ] G2b. G2 route correction (Inner PVL Revisions item 2): the live probe cannot use bundled picker samples as the baseline pair. It uploads, in headless Chromium through `upload-input` (client-side only; no document body leaves the browser), `fixtures/variance/hartwell-crane/fund-II.html` then `fund-III.html` with firm Hartwell & Crane LLP, and asserts 7 change rows (3 new, 4 logic), findings visible within the render-first budget, no `POST /api/session` failure, no `/api/ai` or `/api/ocr` request (abort both), the ledger written; it filters or records the known third-party Turnstile iframe console noise (backlog `intake-live-smoke-turnstile-console`) instead of failing on it. Separately it may open the Northgate demo package and record the measured 9 shown as an observation, not as a gate.
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
# unconditional (Step 0 (g): samples/packages/ is committed; see B2):
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
for t in variance-baseline-from-package variance-baseline-same-firm-only variance-no-baseline-errors-only variance-regression-r01 variance-gate-two-states turnstile-no-block csp-headers no-llm-corpus sample-zero-calls fund-two intake-multi-upload intake-baseline-role-same-firm intake-coverage-visible intake-gate-warning-policy intake-missing-docs-request-export intake-perf-budget intake-a11y-keyboard intake-demo-packages intake-firm-tagging intake-reload-restores-package; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
for t in package-gate-ui gate-pill; do pnpm --filter @aduin/web test "$t" || exit 1; done
grep -n "13 deterministic detectors\|13 detectors" README.md docs/architecture/status.md
```

Deploy checks (Section F/G; outward-facing, workers.dev only):

```bash
curl -s https://aduin-transaction-web.giathaowork.workers.dev/api/health
curl -s -H 'x-aduin-client: 1' https://aduin-transaction-web.giathaowork.workers.dev/api/memory/health
SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack
pnpm --filter @aduin/scripts probe:live-variance
```

Notes: Intake regression: `intake-demo-packages` is load-sensitive (30 s wait; run it alone). Hook-filtered word rule: no command or prompt may contain the production output directory or installed-packages directory words; the tokens above were scanned and contain neither. PVL resolved the registry-count question: NO core test pins "13 detectors / 15 issue classes" (the registry tests only assert `>= 3` and uniqueness), so V5 adds the `counts-wording` scripts test (a vitest filter that matches no file would exit 1, so a wrong token cannot pass vacuously). `fixtures:check`, `seed:check` and `precompute:ai --check` must show NO diff after V1 to V4 (the demo seed and recordings are deliberately untouched).

## Test Coverage Plan (routing chain loaded: all-tests.md, worker/all-worker.md; blast-radius tests discovered)

| Area | Tier | Scenario | Command | Proves | Does NOT prove |
|---|---|---|---|---|---|
| scripts counts | Fully-automated | 13 detectors, 15 issue classes, wording present | `pnpm --filter @aduin/scripts test counts-wording` | the wording gate (AC counts) | whether prose elsewhere is accurate |
| apps/web demo | Fully-automated | 214 to 7, groups, impact, owners, R-01 | `test:e2e variance-demo-214-to-7` | AC-V4 | human judgment of the demo narrative |
| apps/web demo | Fully-automated | gate walk to Ready; counts agree | `test:e2e variance-demo-gate-walk` | AC-V18 | the under-3-minute human timing (agent-probe, recorded) |
| apps/web demo packages | Fully-automated | Northgate retagged to `hartwell-crane` keeps Intake's demo-package surfaces green; the three design packages map to their answer-key rows (Northgate with Fund II baseline, Lotus Bay prior draft, Redwood Ridge no baseline) | `test:e2e variance-package-samples`, `intake-demo-packages`, `intake-firm-tagging`, `intake-baseline-role-same-firm`; web unit `package-gate-ui` | AC-V1 on package inputs, D-S0-7 safety | a 7-row count on package 01 (measured 64 raw / 9 shown, recall 7/7, P01 H4 owns it); live demo narrative |
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

## Phase 03 Carry-overs (UPDATE PROCESS, 2026-10-18 00:05 local; plan body only, the Validate Contract was not touched)

Step-0 carry-over items from the Phase 03 closeout.

- **Remote apply of 0006 (deploy note):** migration `0006_variance.sql` is NOT idempotent (ALTER TABLE ADD COLUMN, trigger recreation, new table); a partially applied remote run cannot simply be re-run. Record the read-only Time Travel bookmark BEFORE applying, `migrations list --remote` first, and rehearse on a populated local D1 (F2b). Restoring is never run by an agent.
- **Rollback rule:** never roll back the Worker alone after the new web bundle ships. An older Worker silently drops `assertion`, `scope` and `intent` fields (zod strips unknown keys), so the web would believe it recorded checks that were never stored. Roll back only as a pair, or hold the web bundle.
- **Weights and burst:** `MEMORY_WRITE_WEIGHTS.counselAnswerWithAssertion` is 23 (plain answer 13 rows, with assertion 18 rows measured locally); `query-budget` `lookup_200` is now 3. The deployed `rows_written` burst stays operator residual R2.
- **Demo seed copy (E9):** `apps/worker/src/memory/repo/seed-copy.ts` copies decisions without `intent` or `scope`. Extend it only if the demo ever seeds scoped decisions.
- **Retag:** Northgate demo package to `hartwell-crane`, Lotus Bay (package 02) to `ostrander-pell`, package 03 untagged (the six reference firms are already in 0006 and `law-firms.json`).
- **Health:** `schema_version` is now `'6'` (five pin sites already moved); the live smoke and `health.ts` expectations must read 6 after the apply.
- **Known limitation M1 and D5c** (fund-scope supersede, no revoke path): see the two P03 backlog NOTEs; surface in the final README/handoff notes, not as fixes.

## Phase Loop Progress

- [x] 0. PRECONDITION - Intake feature closed and deployed; Step 0 re-sync done; rollback target recorded (3d2c7301; re-read read-only at EXECUTE entry) (note 18-10-26: rollback target is now b04f1a8c, see Step 0 (a)); Inner Loop Refresh Note written (2026-10-17)
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
| `intake-demo-packages`, `intake-firm-tagging`, `intake-baseline-role-same-firm` (re-run after the D-S0-7 retag) | Fully-Automated | NFR safety (Intake surfaces stay green) |
| `a11y-keyboard`, `test:a11y`, keyboard probe | Fully-Automated plus Agent-Probe | NFR UI (base AC30) |
| `rows-written`, `conformance-free-plan`, `deploy:preflight` | Fully-Automated | NFR platform (base AC40) |
| `probe:live-variance`, live stack smoke | Agent-Probe | deployed render-first (Phase 10 blind-spot class) |
| `variance-package-samples` (samples/packages is committed; unconditional) | Fully-Automated | AC-V1 (prior-draft and no-baseline cases), AC-V4 re-confirmation on package inputs |
| live R-01 write path | Known-gap residual (CONDITIONAL, backlog stub) | AC-V16 live portion only; AC-V16 itself is proven locally |

## Test Infra Improvement Notes

- A Turnstile-capable automated session (test sitekey on a non-production widget) would let the live write path and AC51-style probes run unattended; today they are operator-only (R2).
- `sample-picker-smoke` asserting an exact sample count makes every new sample a spec edit; a manifest-driven count would remove that coupling.
- `probe:live-variance` should share its guard code with `probe:live-session` (one allow-list) rather than a copy.

## Resume and Execution Handoff

- Selected plan file path: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-05-demo-deploy_PLAN_17-10-26.md`
- Umbrella plan: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-umbrella_PLAN_17-10-26.md`
- Last completed step: Step 0 PLAN-SUPPLEMENT 2026-10-17 (Intake closed and deployed; Refresh Note written; not started otherwise; Phases 01 to 04 must be VERIFIED first)
- Validate-contract status: inner-pvl: phase-5 contract written 2026-10-18 (see `## Validate Contract`; it supersedes the invalidated outer-pvl contract); history: INVALIDATED by the 2026-10-17 Inner Loop Refresh Note; prior state: written (outer-pvl, 2026-10-17, PASS after PVL cycle 1 re-validation; supersedes the first-pass CONDITIONAL contract)
- Next step: after Phases 01 to 04 are VERIFIED (Intake is closed and deployed), spawn vc-research-agent for RESEARCH (V1 to V4 reports; re-read the live version read-only), then INNOVATE (n/a if the DECISION holds), PLAN-SUPPLEMENT and inner PVL. EXECUTE receives this one exact plan path.
- Validators: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this plan>`; `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <this plan>`.
- Hard rules for every agent prompt: never git stash, checkout, reset or restore; commit on main with conventional prefixes; never run git push in any phase (the user pushes); never name or touch the protected zone; execution commits separate from process commits.

## Inner Loop Refresh Note: 2026-10-17 — changed sections: header (Depends on), Step 0 (checks a, b, e, g observed; new status paragraph with D-S0-4/5/7/8/9), Fictional Sample Packages (committed; hosted by Intake's demo-package list; Northgate retag), Touchpoints (new demo-packages.json retag, Not touched, Blast Radius), Implementation Checklist (A2, A4, B2 unconditional, new B3, E1 counts, F2), Test Gates (unconditional package-samples, regression tokens, notes), Test Coverage Plan, Verification Evidence, Phase Loop Progress, Resume and Execution Handoff. Invalidates prior validate-contract.

Written by the Step 0 PLAN-SUPPLEMENT at 2026-10-17 22:11 local, after this plan's outer-pvl contract (written 17:49 the same day). Basis `variance-mvp_STEP0-RESYNC_17-10-26.md`. Landed facts used: live Worker `3d2c7301-a4a5-487c-bd7d-2f2c0800be6f` is the rollback target (chain `3d2c7301` -> `cde74507` -> `328ca295` -> `09e7a579` -> `47d98295` -> `23612b12`); `build-samples.ts` guard now at line 214 and Intake's `buildPackages()` is additive after the manifest write; `sample-picker-smoke` `toHaveCount(13)` at spec line 35 unchanged; `samples/packages/` committed (c1c5fe0); `smoke-package.ts` exists. Answer-key mapping table (Step 0 (g)): package 01 rows V1-V7 map to AC-V2 and AC-V4 (P01 H4 owns the 7-shown pin), V4/V7/V2/V1 impact lines to AC-V10, owners to AC-V11 (V7 differs: GP per SPEC A9, D-S0-6), V2 two owners to AC-V12; package 02 rows V1-V7 use its intended/structural/unintended taxonomy (no class or count pin; `variance-package-samples` asserts only that V6 "shall not" to "shall" is surfaced as meaning-changing); package 03 maps to AC-V8 (no baseline: muted line, empty Changes, Errors only); package 01's "Variance group: full with 04" coverage row has no landed Intake counterpart (coverage groups are fixed at five) and becomes a backlog note. Baseline counts updated to the post-Intake numbers. Push rule restated (D-S0-8); `.playwright-mcp/` and `.DS_Store` are not Variance's (D-S0-9). PVL-new concerns to check: the B3 retag does not break Intake specs that assume Northgate has no firm (UNVERIFIED until a run), and the deploy-target and credential steps are unchanged.

## Validate Contract

Status: PASS
Date: 18-10-26
date: 2026-10-18
generated-by: inner-pvl: phase-5
supersedes: 2026-10-17 (outer-pvl) - inner PVL has current evidence (the outer contract was invalidated by the 2026-10-17 Inner Loop Refresh Note and Phase 03 carry-overs; re-validated from V1 against landed code at HEAD a31dff0)

Parallel strategy: sequential
Rationale: signals S1 (web, scripts, worker operational), S2 (remote D1 migration), S6 (deploy and schema), S7 (5+ files) = 4/7 HIGH, but the work is a strictly ordered pipeline (specs, regression, rehearsal, USER CONFIRMATION, backup, migrate, verify, deploy, smoke) on one shared checkout and one Playwright port, with no mid-run coordination need, so fit beats score: sequential. Agents: 1 opus vc-execute-agent for leg 1 (Sections A to E, F1, F2b), then, only after the user confirmation in F0, a separate opus execute leg for F2 to G; 1 sonnet vc-tester for EVL; 1 sonnet security review of the deploy checklist = 4 agents, no cost guard triggered. The inner PVL ran as one read-only pass (file reads, grep, git log and diff, the plan-artifact validator); no build, test, Playwright, wrangler or Cloudflare call, no commit.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC-V4 | 214 raw become exactly 7 shown (3 new, 4 logic), 207 cosmetic in 5 groups, impact line for 4.2, owner chips, R-01 blocking finding after recording the Fund II answer (upload path, firm Hartwell & Crane LLP) | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-demo-214-to-7` | B |
| AC-V4 (core part, re-run) | variance result reports raw 214, shown 7, cosmetic 207 | Fully-Automated | `pnpm --filter @aduin/core test variance-demo-count` | A |
| AC-V18 | from Blocked, own items then owner answers reach Ready to digitize; Questions counts equal gate popover groups equal Blocked N at every step (N read from the page) | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-demo-gate-walk` | B |
| AC-V1 (re-verify) | baseline from the package role on Intake-integrated code, same firm only | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-baseline-from-package` then `variance-baseline-same-firm-only` (one token per call) | A |
| AC-V1 (package inputs) | Northgate with Fund II baseline (recall of the 7 answer-key passages, measured 64 raw / 9 shown, no 7-row assertion), Lotus Bay with prior-draft baseline, Redwood Ridge no-baseline errors-only | Fully-Automated | `pnpm --filter @aduin/web test:e2e variance-package-samples` | B |
| Demo-package retag (D-S0-7 and carry-over) | northgate-iii tagged hartwell-crane, lotus-bay-asia-ii tagged ostrander-pell, redwood-ridge-i untagged; made in `make-package.ts` and regenerated; generated files change only by those fields; Intake surfaces stay green | Fully-Automated | `pnpm --filter @aduin/scripts fixtures:check`, `pnpm --filter @aduin/scripts test package-fixtures`, then `pnpm --filter @aduin/web test:e2e intake-demo-packages`, `intake-firm-tagging`, `intake-baseline-role-same-firm`, `intake-package-lens`, `intake-missing-docs-request-export` and `pnpm --filter @aduin/web test package-gate-ui` (one token per call) | B |
| AC-V16 (stack) | R-01 isolation on the real HTTP stack (local seeded D1) | Hybrid | `pnpm --filter @aduin/web test:e2e:stack-memory` (precondition: local seeded stack on :8788, free port); includes `stack-memory-variance-regression-no-cross-firm` | A |
| NFR performance (base AC29) | Fund III variance appears within 5 s; existing perf cases unchanged | Fully-Automated | `pnpm --filter @aduin/web test:e2e perf-budget` | B |
| NFR a11y (base AC30) | zero critical axe on changed screens, non-colour cues, keyboard order | Fully-Automated | `pnpm --filter @aduin/web test:e2e a11y-keyboard` and `pnpm --filter @aduin/web test:a11y` | B |
| NFR a11y (judgment) | keyboard walk of the demo story at 1440 and 1024, visual compare with the mockup (no pixel parity) | Agent-Probe | `DESIGN_PROBE=1 pnpm exec playwright test --project=preview design-probe` from `apps/web`, judgment recorded in the report | B |
| NFR Workers Free (base AC40) | variance adds no server CPU path; writes within budget; deploy artifact preflight | Fully-Automated | `pnpm --filter @aduin/worker test rows-written`, `pnpm --filter @aduin/scripts test conformance-free-plan`, `pnpm --filter @aduin/scripts deploy:preflight` (after the plain web build) | A |
| AC-V20 (re-verify) | reproducible, no-LLM | Fully-Automated | `pnpm --filter @aduin/web test:e2e no-llm-corpus` and `pnpm --filter @aduin/core test variance-determinism-repeat-run` | A |
| Counts wording | exactly 13 detectors and 15 issue classes, wording present in README and status.md | Fully-Automated | `pnpm --filter @aduin/scripts test counts-wording` and `grep -n "13 deterministic detectors\|13 detectors" README.md docs/architecture/status.md` | B |
| Deploy correctness (high-risk) | remote migrations list shows only 0006, populated-DB rehearsal clean (local), backup export and Time Travel bookmark recorded, apply, F3b verification (schema_version 6, counts, triggers, columns), `/api/memory/health` shows schema 6, headers 200, guard:cf before and after | Hybrid | Section F commands F0 to F6b (precondition: user confirmation of the F0 packet, credentials loaded in the same call, EVL green, deploy commit equals EVL commit, live version equals the recorded one) | B |
| Deployed render-first | on the live site the Fund II then Fund III upload pair renders findings and 7 changes without a Turnstile token and without a failing `/api/session`, zero AI/OCR calls | Agent-Probe | `pnpm --filter @aduin/scripts test probe-variance` (offline guard test) then `pnpm --filter @aduin/scripts probe:live-variance` plus `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` | B |
| AC-V16 live portion | answer with assertion on the deployed D1 needs a Turnstile session (residual R2); proven locally by the stack-memory row above | Hybrid | local proof only: `stack-memory-variance-regression-no-cross-firm`; live proof is the operator note `variance-live-regression-operator_NOTE_17-10-26.md` (exists, exact steps) | D |

gap-resolution legend: A proven now (gate passes in this cycle); B fixed in this plan (gate added by this plan's checklist); C deferred to a named later phase/plan; D backlog test-building stub (named residual; keep-active; continue).

C-4 reconciliation: the `strategy` column carries only Fully-Automated, Hybrid or Agent-Probe. The live write path is a named residual row (gap-resolution D), never a proving strategy. Net-gate vacuous-green check: no developed behavior rests on Known-Gap alone (the live R-01 write has the local `stack-memory` gate; the live-only portion is a named residual with a written note).

Failing stubs (Fully-Automated rows whose proving test is NEW in this phase; rows that re-run an existing test need no stub):

- AC-V4: `test("should reduce 214 raw changes to 7 shown (3 new, 4 logic) with 207 cosmetic in 5 groups", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should reduce 214 raw changes to 7 shown (3 new, 4 logic) with 207 cosmetic in 5 groups") })`
- AC-V18: `test("should reach Ready to digitize from Blocked with matching counts at every step", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should reach Ready to digitize from Blocked with matching counts at every step") })`
- AC-V1 (package inputs): `test("should review the Northgate, Lotus Bay and Redwood Ridge packages with the right baseline roles", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should review the Northgate, Lotus Bay and Redwood Ridge packages with the right baseline roles") })`
- NFR performance: `test("should show Fund III variance within the 5 second deterministic target", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should show Fund III variance within the 5 second deterministic target") })`
- NFR a11y: `test("should have zero critical axe violations and keyboard order on the variance screens", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should have zero critical axe violations and keyboard order on the variance screens") })`
- Counts wording: `test("should keep exactly 13 detectors and 15 issue classes with the wording present", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should keep exactly 13 detectors and 15 issue classes with the wording present") })`

Legacy line form:
- apps/web demo: [Fully-automated: `pnpm --filter @aduin/web test:e2e variance-demo-214-to-7`, `variance-demo-gate-walk`, `variance-package-samples`] | [agent-probe: keyboard walk and mockup compare]
- apps/web perf and a11y: [Fully-automated: `perf-budget`, `a11y-keyboard`, `pnpm --filter @aduin/web test:a11y`]
- scripts fixtures, counts and live probe: [Fully-automated: `fixtures:check`, `test package-fixtures`, `test counts-wording`, `test probe-variance`] | [agent-probe: `probe:live-variance`]
- apps/worker deploy: [hybrid: Section F commands F0 to F6b, precondition user confirmation, credentials loaded and EVL green]
- live R-01 write path: [known-gap: documented, operator note `variance-live-regression-operator_NOTE_17-10-26.md`; local proof by stack-memory]
- full regression: [Fully-automated: the whole Test Gates regression block, serial]

Dimension findings:
- Infra fit: PASS - 9 defects found against landed code and fixed inline (list under "Inner PVL fixes"): the retag target was a generated file, `/api/health` cannot show the schema version, the G2 pair route contradicted P02 deviation 3. Verified present: migration `0006_variance.sql` (schema 6, `EXPECTED_SCHEMA_VERSION '6'`), `law-firms.json` with 6 firms, `scripts/src/live/{common,probe-session,probe-ai,smoke-package}.ts`, `scripts/package.json` keys `probe:live-session`, `smoke:live-package`, `deploy:preflight`, `package:fixtures`, `fixtures:check`; `build-samples.ts` guard still `expected 12 HTML samples` at line 214 (untouched by P01 to P04, B1 still to do); `sample-picker-smoke` `toHaveCount(13)` at line 35.
- Test coverage: PASS - every developed behavior has an automated or agent-probe gate; all regression tokens exist as spec or test files (variance-* e2e specs, intake-* specs, `gate-pill`, `package-gate-ui`, `variance-demo-count`, `variance-determinism-repeat-run`, `rows-written`, `conformance-free-plan`); `counts-wording` is feasible (`detectors` has 13 entries, `ISSUE_CLASSES` has 15; README lines 28, 111 and `status.md` line 13 carry the wording the grep gate matches); `fixtures/variance/expected/hartwell-crane.json` exists with the pinned numbers; helper `openFundIIIvsII` exists for the demo specs. Stale counts and the gate-N source were corrected.
- Breaking changes: PASS - no contract or code change in V5 beyond fixtures and specs; migration 0006 is additive and forward-only (nullable columns, recreated guard triggers), not idempotent; the live Worker code (994ea54) has changed in 11 Worker files since, all Variance (P03, P04), `wrangler.jsonc` and `seed/demo.sql` unchanged, so the F2b populated rehearsal and F3b verification are the proof; rollback is whole-version only (F6b).
- Security surface: PASS (HIGH risk, evidence pack required) - target only `https://aduin-transaction-web.giathaowork.workers.dev` (enforced by `assertLiveBase`); `aduin-transaction-*` only; no routes or custom domains (`deploy:preflight` and `guard:cf` check `wrangler.jsonc`); the protected zone is not named or touched; remote migration after backup, bookmark, rehearsal and user confirmation, strictly before the single deploy; Time Travel restore forbidden to agents; credentials loaded in the same call, never printed; FREE models only, 0 live AI calls (feature budget at most 6, at most 3 per UTC day); never git push; single-deployer re-check against the debug session; deploy pinned to the EVL commit; the other session's Preflight rename is disclosed in the confirmation packet.
- Section A feasibility (pre-checks): PASS - A1 to A5 reference real files; A5 corrected (expected file exists, gate N not pinned).
- Section B feasibility (samples, retag): PASS - B1 concrete and still pending, now stated as presenter convenience (no baseline from samples); B2 unconditional (`samples/packages` committed); B3 corrected by B3b (edit `make-package.ts`, regenerate, gates named). Highest-risk edit: the generated-file retag; sequence B3b gates before anything else in Section B.
- Section C feasibility (demo e2e): PASS - depends on landed P02 and P04 testids and the helper file `apps/web/e2e/fixtures/variance-owners.ts` (`hcFile`, `openHc`, `openFundIIIvsII`, `changeRow`, `askOwner`, `gotoQuestions`, `recordAnswer`, `recordFirmTemplateAnswer`), all present; owners in C1 match the expected file (7A fund admin; Singapore GP and counsel; sanctions counsel; 4.2 counsel; Class A minimum GP; tax status counsel; trust split GP).
- Section D feasibility (perf, a11y): PASS - existing specs and `design/mockups/app-variance.html` present; commands match `apps/web/package.json` (`test:e2e`, `test:a11y`).
- Section E feasibility (regression): PASS - script keys exist (`slice:check`, `guard:cf`, `secrets:scan`, `seed:check`, `fixtures:check`, `record:author`, `precompute:ai`); baseline counts replaced by the post-Phase-04 documents and A1 re-measurement.
- Section F feasibility (remote migration and deploy): PASS - order F0 hard stop, F1, F2b (local), F2, F2c, F3a, F3, F3b, F4a, F4, F5, F5b, F6, F6b; commands exist in wrangler 4 (`d1 migrations list/apply`, `d1 time-travel info`, `d1 export --remote --output`, `d1 execute --remote --command`, `deployments list`, `rollback`). Highest-risk edit: the live migration apply (drops and recreates four guard triggers on a populated D1, not idempotent); mitigated by backup, bookmark, rehearsal, F3a, a single apply and F3b.
- Section G feasibility (live smoke): PASS - `slice.spec.ts` (project `stack`) is the live smoke and asserts no title string (the Preflight rename does not affect it); `probe:live-variance` follows `probe-session.ts` and the shared `common.ts` and uses the upload route (G2b).
- Section H feasibility (evidence, closeout, final local commit): PASS - validators exist; no push in any phase.

Inner PVL fixes (applied inline to the plan, additive; each pointer is in the plan): (1) B3 hand-edited generated JSON, would fail `fixtures:check`: B3b, Touchpoints, Revisions 1; (2) B3 left Lotus Bay untagged against the Phase 03 carry-over and the orchestrator lock: B3b; (3) F5 and Test Gates used `/api/health`, which returns only `{ok:true}`: F5b, Test Gates deploy checks, Revisions 3; (4) no remote backup export, no before and after counts, no trigger and schema verification: F2c, F3b, Safety allow-list; (5) no live-version re-check or deploy-commit pinning against the other deploying session: F3a, F4a, Safety single-deployer rule; (6) no explicit user-confirmation hard stop: F0, Safety; (7) F6 rollback text contradicted the pair rule and named a stale target: F6b, Revisions 4; (8) G2 and B1 assumed a sample pair baseline (P02 deviation 3) and package 01 was stated as 7 shown (measured 9): G2b, coverage row, Revisions 2; (9) stale E1 counts and A5 expected-file facts: Revisions 6 and 7.

Execute-agent instructions (outward-facing, named explicitly as the umbrella requires):
- E1. EXECUTE may not start until Phases 01 to 04 are VERIFIED (Phase 04 EVL was still running at this PVL: wait for its EVL PASS, its UPDATE PROCESS closeout commit and a clean `git status` for code paths) and A1 records a green baseline at HEAD. Step 0 facts are re-checked in the first task (live version read-only only after F0 confirmation; before it, trust the recorded `b04f1a8c`).
- E2. Leg 1 = Sections A to E plus F1 and F2b (all local; no wrangler call to Cloudflare, no remote D1). The orchestrator then runs F0: it asks the USER and waits for explicit confirmation of the packet. Leg 2 = F2c to G only after that confirmation. Autopilot standing consent does NOT satisfy F0.
- E3. AUTHORIZED outward-facing actions after the F0 confirmation (and only these): (1) `wrangler d1 migrations list/apply aduin-transaction-db --remote` for exactly 0006 after F2c, F3a and the clean F2b; (2) read-only `wrangler d1 time-travel info`, `wrangler d1 export --remote --output <scratchpad>` and `wrangler d1 execute --remote --command "<SELECT or PRAGMA table_info>"`; (3) `wrangler deployments list` (read-only); (4) one `wrangler deploy` of Worker `aduin-transaction-web` from `apps/worker`, only after F3b passed and F4a pinning holds; (5) `wrangler rollback <recorded id>` on a failed F5, F5b or live smoke; (6) read-only live GETs and the headless probe against https://aduin-transaction-web.giathaowork.workers.dev. Anything else (route, custom domain, new resource, secret change, remote seed, `execute --file --remote`, non-SELECT SQL, Time Travel restore, a live AI or OCR call, anything touching the protected zone) is a hard stop, never retried.
- E4. Free OpenRouter models only; 0 live AI calls in this phase (feature budget at most 6, at most 3 per UTC day). Stop on any cost above 0, a non-`:free` model, a 429 or an open breaker.
- E5. Load credentials in the same Bash call that uses them (the approved line from the all-worker deploy recipe; the privacy hook needs the user's `APPROVED:` marker); never print, export or persist them; run `pnpm guard:cf` and `pnpm secrets:scan` before and after the deploy and before the final local commit.
- E6. B1 keeps the 12 original sample entries byte-identical and turns the `expected 12 HTML samples` guard into an explicit `12 + N` check; never delete it or loosen it to a range. B3b edits `make-package.ts` and regenerates; generated JSON is never hand-edited; the DOCX copies and `checksums.json` stay byte-identical.
- E7. Write evidence pack artifacts 1 to 4 before F2c and artifact 5 after G; the validator must report 0 failures. Commit locally on `main` only (execution commits separate from process commits), never git push, never git stash, checkout, reset or restore; do not touch or commit `.playwright-mcp/`, `.DS_Store` or `process/features/findings-v2/`.
- E8. A red baseline at HEAD that Variance did not cause stops the phase. A defect in `packages/**` is routed to a follow-up plan stub in its owning phase. `samples/packages/**`, `README.md`, `docs/**` and `design/**` are read-only (stale facts go to the handoff NOTE `variance-docs-handoff_NOTE_17-10-26.md`).
- E9. F4a: deploy only from the commit the full regression ran on, with clean code paths; re-run `deploy:preflight` after the plain build; never run a Playwright `stack` project between the plain build and the deploy (it rebuilds the e2e bundle into the same output).

Exact gate commands for EXECUTE (one token per call; no `--` token; run serially, never two Playwright projects together; check port 4317 is free before each e2e call):

LEG 1 - local gates (autopilot, no confirmation needed):
```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm --filter @aduin/core test
pnpm --filter @aduin/worker test
pnpm --filter @aduin/web test
pnpm --filter @aduin/scripts test
pnpm --filter @aduin/scripts fixtures:check
pnpm --filter @aduin/scripts package:fixtures
pnpm --filter @aduin/scripts fixtures:check
pnpm --filter @aduin/scripts test package-fixtures
for t in variance-demo-214-to-7 variance-demo-gate-walk variance-package-samples perf-budget a11y-keyboard sample-picker-smoke intake-package-lens intake-missing-docs-request-export; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
pnpm --filter @aduin/web test:a11y
pnpm --filter @aduin/scripts test probe-variance
pnpm --filter @aduin/scripts test counts-wording
pnpm --filter @aduin/core test variance-demo-count
pnpm --filter @aduin/core test variance-determinism-repeat-run
pnpm --filter @aduin/worker test rows-written
pnpm --filter @aduin/scripts test conformance-free-plan
pnpm --filter @aduin/web test:e2e
pnpm --filter @aduin/web test:e2e:stack-memory
pnpm slice:check
pnpm guard:cf
pnpm secrets:scan
pnpm seed:check
pnpm --filter @aduin/scripts record:author --check
pnpm --filter @aduin/scripts precompute:ai --from-recordings --check
for t in variance-baseline-from-package variance-baseline-same-firm-only variance-no-baseline-errors-only variance-regression-r01 variance-gate-two-states turnstile-no-block csp-headers no-llm-corpus sample-zero-calls fund-two intake-multi-upload intake-baseline-role-same-firm intake-coverage-visible intake-gate-warning-policy intake-missing-docs-request-export intake-perf-budget intake-a11y-keyboard intake-demo-packages intake-firm-tagging intake-reload-restores-package; do pnpm --filter @aduin/web test:e2e "$t" || exit 1; done
for t in package-gate-ui gate-pill; do pnpm --filter @aduin/web test "$t" || exit 1; done
grep -n "13 deterministic detectors\|13 detectors" README.md docs/architecture/status.md
git diff --check
node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/features/variance-management/active/variance-mvp_17-10-26/harness/phase-05
```
Notes: `intake-demo-packages` is load-sensitive (run it alone); `fixtures:check`, `seed:check`, `precompute:ai --check` must show no diff other than the B3b fields in `demo-packages.json` and `expected.json`; the `package:fixtures` line runs only after B3b and only once. Agent probe (judgment recorded in the report): `cd apps/web && DESIGN_PROBE=1 pnpm exec playwright test --project=preview design-probe`.

F0 - STOP. Orchestrator asks the user with the F0 packet; continue only on explicit confirmation.

LEG 2 - confirmed remote and deploy leg (credentials loaded in the same call as each wrangler command: `set -a; source ~/.config/cloudflare/credentials.env; set +a`, never printed):
```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction && pnpm guard:cf && pnpm secrets:scan
cd apps/worker && pnpm exec wrangler deployments list
cd apps/worker && pnpm exec wrangler d1 migrations list aduin-transaction-db --remote
cd apps/worker && pnpm exec wrangler d1 time-travel info aduin-transaction-db
cd apps/worker && pnpm exec wrangler d1 export aduin-transaction-db --remote --output <scratchpad>/aduin-transaction-db-pre-0006.sql
cd apps/worker && pnpm exec wrangler d1 execute aduin-transaction-db --remote --command "SELECT key, value FROM app_meta"
cd apps/worker && pnpm exec wrangler d1 execute aduin-transaction-db --remote --command "SELECT (SELECT COUNT(*) FROM law_firm) AS law_firm, (SELECT COUNT(*) FROM law_firm_alias) AS alias, (SELECT COUNT(*) FROM workspace) AS ws, (SELECT COUNT(*) FROM decision) AS dec, (SELECT COUNT(*) FROM counsel_question) AS q, (SELECT COUNT(*) FROM counsel_answer) AS ans, (SELECT COUNT(*) FROM finding) AS f, (SELECT COUNT(*) FROM review_run) AS runs, (SELECT COUNT(*) FROM audit_event) AS audit"
cd apps/worker && pnpm exec wrangler d1 execute aduin-transaction-db --remote --command "SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name"
cd apps/worker && pnpm exec wrangler deployments list
cd apps/worker && pnpm exec wrangler d1 migrations apply aduin-transaction-db --remote
(repeat the three SELECTs above, plus PRAGMA table_info(counsel_question) and SELECT COUNT(*) FROM regression_check, then compare per F3b)
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction && git rev-parse HEAD && git status --porcelain
VITE_TURNSTILE_SITE_KEY=<public site key read from the live bundle, A3> pnpm --filter @aduin/web build
pnpm --filter @aduin/scripts deploy:preflight
cd apps/worker && pnpm exec wrangler deployments list
git diff --stat HEAD -- apps/worker/wrangler.jsonc
cd apps/worker && pnpm exec wrangler deploy
curl -s https://aduin-transaction-web.giathaowork.workers.dev/api/health
curl -s -H 'x-aduin-client: 1' https://aduin-transaction-web.giathaowork.workers.dev/api/memory/health
curl -sI https://aduin-transaction-web.giathaowork.workers.dev/
pnpm guard:cf
SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack
pnpm --filter @aduin/scripts probe:live-variance
```
On a failed F5, F5b or live smoke: `cd apps/worker && pnpm exec wrangler rollback <version id recorded at F3a>` (whole version, F6b), then record and mark the phase CODE DONE with the blocker.

Open gaps (named known-gaps, excluded from the CONCERN count; none is a FAIL):
- Live R-01 memory write on the deployed D1 (and AC51-style items, manual keyboard pass, AC40 live measurements): known-gap: documented as NEW PLAN REQUIRED - see backlog/variance-live-regression-operator_NOTE_17-10-26.md, backlog/variance-manual-keyboard-pass_NOTE_17-10-26.md, backlog/variance-web-manual-keyboard-pass_NOTE_17-10-26.md, backlog/variance-render-first-live-turnstile_NOTE_17-10-26.md, backlog/variance-impact-real-sample-ground-truth_NOTE_17-10-26.md, backlog/variance-package-01-key-divergence_NOTE_17-10-26.md; existing `phase10-*` stubs in `process/general-plans/backlog/`. Two more notes are created at execution: `variance-docs-handoff_NOTE_17-10-26.md`, `variance-demo-preseeded-r01_NOTE_17-10-26.md`.
- Remote D1 migration behavior on live data is proven only by the local populated-DB rehearsal (F2b), the backup export, the Time Travel bookmark and the F3b read-only checks; deployed `rows_written` burst stays operator residual R2.
- Whether the retag leaves any Intake spec that encodes "no firm" for Northgate or Lotus Bay is UNVERIFIED until the B3b gates run (grep found none): known-gap, closed by the B3b gates.
- Advisory (not counted): `apps/web/src/features/counsel/exportDocx.ts:93` still sets the DOCX creator to "Sub-doc QA" (the rename commit changed only the request export); belongs to the session that owns the rename, not to this phase. Phase 04's EVL was still running and its plan and report files were uncommitted at this PVL (E1 covers it).

What this coverage does NOT prove:
- `variance-demo-214-to-7` and `variance-demo-gate-walk`: human judgment of the demo narrative, the under-3-minute human timing, and behavior against a real (non-stub) memory backend.
- `variance-package-samples`: a 7-row count on package 01 (measured 9 shown), anything about answer-key rows that are not mapped to a test, the 214-to-7 pin (owned by the authored corpus).
- Retag gates: the live demo narrative on the Northgate package after the retag.
- `perf-budget`, `a11y-keyboard`, `test:a11y`: production network latency, screen-reader quality, the manual keyboard pass.
- Regression block and `stack-memory`: operator-only items (R2, R4), live Turnstile iframe CSP with a human-solved challenge, behavior under real load, the live D1.
- Section F commands: behavior under real load, concurrent writers during the apply, and any live-data effect not visible to the read-only checks.
- `probe:live-variance` and the stack smoke: the live memory write path, AI and OCR on the live site, anything behind a Turnstile token, and the Northgate package demo as a gate (observation only).
- `counts-wording`: whether prose elsewhere in README or `docs/**` is accurate (docs are handed off, not edited here).

Gate: PASS (0 FAILs, 0 unresolved CONCERNs; the 9 defects found were fixed inline in the plan; named residuals above are documented known-gaps with backlog notes, not CONCERNs; the remote migration, deploy and rollback are a USER-CONFIRMATION HARD STOP (F0) that autopilot does not waive)
Accepted by: n/a for the gate (PASS); session (autonomous, autopilot, no remote action) acknowledges the named known-gaps listed under Open gaps

Amendment 17-10-26 (user decision): no git push in any phase; commit locally only; the user pushes. Wording-only tightening, no gate change.
