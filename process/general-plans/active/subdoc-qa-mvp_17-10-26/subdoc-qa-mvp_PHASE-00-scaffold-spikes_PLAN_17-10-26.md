---
name: plan:subdoc-qa-mvp-phase-00-scaffold-spikes
description: "Sub-doc QA MVP — Phase 00: pnpm monorepo scaffold, tooling and guards, cross-phase seams, and spikes S1-S10 with kill criteria"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-00
---

# Phase 00 — Scaffold and Spikes S1–S10

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Milestone:** M1 vertical slice (00 → 01 → 03 → 04a)
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-00-scaffold-spikes_REPORT_17-10-26.md

---

## Overview

Context router: `process/context/all-context.md`; test router: `process/context/tests/all-tests.md` (pre-code, no runner exists; no test files exist in the blast radius, confirmed by file search). This phase creates the empty-but-runnable monorepo, the test/guard tooling every later phase uses, the **seam files** that let later phases run in parallel without editing the same file, and runs the spikes the vertical slice needs. It owns **no SPEC acceptance criteria** (enabling phase). Deferred spikes are fully specified here (question, method, pass, kill criterion, fallback) and run in the phase named in the table.

## Phase Completion Rules

- CODE DONE = scaffold committed and `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test` exit 0.
- VERIFIED = Exit Gate green, validate-contract written, spike results recorded in `subdoc-qa-mvp_SPIKE-RESULTS_REF_17-10-26.md`, and any remote (Cloudflare/OpenRouter) spike either run under an explicit APPROVED-REMOTE line in the validate-contract or marked `INCONCLUSIVE-LOCAL` with its fallback adopted. Regression check: n/a (first phase). Any remote action needs user confirmed approval.

## Acceptance Criteria

Owned SPEC ACs: none. Phase acceptance (not SPEC):
1. `pnpm install`, `typecheck`, `lint`, `test`, `guard:cf`, `secrets:scan` exit 0 on the empty scaffold (proven by: `scaffold-smoke`; strategy: Fully-Automated).
2. Spikes S6, S7, S1, S2 each have a recorded verdict PASS / FAIL(+fallback adopted) / INCONCLUSIVE-LOCAL (proven by: `spike-results-ref-complete`, a script that checks the REF has a row per spike; strategy: Fully-Automated for the check, Agent-Probe for the judgment).
3. Every library pin and every Cloudflare/D1/OpenRouter fact in the tables below is confirmed via `vc-docs-seeker` and written into the REF (strategy: Agent-Probe; residual named, not a pass on its own).

## Entry Gate

- SPEC R6, INNOVATE R6 and DATA-MODEL locked by the user.
- Node v24.22.0 and pnpm available (`node -v`, `pnpm -v`); if pnpm is missing, `corepack enable` is the only install action.

## Library pins (INNOVATE) — exact versions: confirm via vc-docs-seeker in this phase

| Area | Library | Notes |
|---|---|---|
| Frontend | React + Vite, Tailwind CSS, shadcn/ui (Radix primitives), Zustand, TanStack Table | shadcn/Radix used for accessible behavior only; styling comes from the approved mockup tokens (see Phase 03) |
| Parsing | htmlparser2 (probe used 12.0.0), unpdf and/or pdfjs-dist (probe used unpdf 1.9.0), mammoth | browser-side only |
| Diff/export | jsdiff (`diff` package), docx | docx lazy-loaded |
| State | Dexie, Comlink | |
| Validation/hash | zod (S10 may swap to zod/mini), @noble/hashes | |
| Tests | Vitest, fast-check, @cloudflare/vitest-pool-workers, Playwright, @axe-core/playwright (axe-core) | |
| Worker | wrangler, no web framework (hand-rolled route table, ~60 LOC) | Hono rejected for script size and CPU unless S6/S10 show headroom |
| Fonts | Newsreader and Geist (per approved mockup) | self-host in Phase 03 if licensing allows (OFL); confirm |
| Licenses | all MIT/BSD/Apache/OFL; record in `THIRD_PARTY_NOTICES.md` | `docs/research/reusable-repos.md` rule |

Confirm via `vc-docs-seeker` before writing any checklist step that calls these APIs: wrangler `assets` config incl. `run_worker_first`, `wrangler d1 migrations apply`, pool-workers `defineWorkersConfig`/`readD1Migrations`/`applyD1Migrations`/`fetchMock`, htmlparser2 `Parser` handlers, jsdiff function names, Dexie schema syntax, Comlink `expose/wrap`, @noble/hashes `sha256` import path, Turnstile test keys.

## Facts to confirm (write results to REF; any mismatch updates later phase plans)

| Fact | Where it bites |
|---|---|
| Workers Free: 10 ms CPU, 50 subrequests, 100k req/day, 128 MB, compressed script size limit (3 MB historic vs 64 MiB claimed) | S6, all Worker phases |
| D1 Free: 100k rows written/day (index entries count), 5M rows read/day, 500 MB per DB, 100 bound params, 50 queries per invocation, whether batch statements and fetches share the 50 | 4b, S8, S9 |
| Cron Triggers available on Free; static-asset requests free; Turnstile free | 4b purge, 10 |
| OpenRouter free: 20 req/min, 50/day (1000/day after credits); free model ids still listed | S3, S4, 5, 6 |

## Touchpoints (all created here)

- Root: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.nvmrc`, `THIRD_PARTY_NOTICES.md`, `.gitignore` additions (`.dev.vars`, `.wrangler/`, build output dirs, `playwright-report/`, `fixtures/llm-recordings/_live/`)
- `packages/core/` (`package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `test/` dirs `unit property golden seeded recorded`)
- `apps/web/` (Vite React TS skeleton, `vite.config.ts`, `index.html`, `src/main.tsx`, `playwright.config.ts`, `e2e/`)
- `apps/worker/` (`wrangler.jsonc`, `src/index.ts`, `src/app.ts` with `createApp(deps)`, seam stubs below, `vitest.config.ts` for pool-workers, `test/`)
- `scripts/` (`package.json`, `src/guards/{guard-cf.ts,secrets-scan.ts}`, `src/spikes/`)
- `fixtures/` (empty dirs with `.gitkeep`: `html-seeded memory diff outline docx scans-ground-truth llm-recordings`)
- Seam stubs (exact files): `apps/worker/src/routes/proxy/index.ts` exports `mountProxyRoutes(app, deps)` (Phase 04a fills); `apps/worker/src/routes/memory/index.ts` exports `mountMemoryRoutes(app, deps)` (4b fills); `apps/worker/src/platform/index.ts` exports `createD1Platform(db)` throwing NotImplemented (4b fills; ports typed in core contracts in Phase 01); `apps/web/src/features/registry.ts` (typed array of feature modules; one-line additions per phase); `packages/core/src/index.ts` barrel (append-only exports).
- `scripts/spikes/` throwaway Worker configs named `aduin-transaction-spike` (remote only under approval).

## Public Contracts

- Workspace package names: `@aduin/core`, `@aduin/web`, `@aduin/worker`, `@aduin/scripts`.
- Root scripts (program-wide command vocabulary): `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm guard:cf`, `pnpm secrets:scan`, `pnpm dev:stack` (builds web then `wrangler dev` serving SPA + `/api/*` locally), `pnpm slice:check` (stub now, real in Phase 04a).
- Per-package: `@aduin/core` `test`, `test:golden`, `test:property`, `test:seeded`, `test:corpus`; `@aduin/worker` `test`; `@aduin/web` `test`, `test:e2e`, `test:a11y`; `@aduin/scripts` `record:*`, `precompute:*`, `seed:*`, `fixtures:build`, `spike:*` (each created by the phase that needs it).
- Dependency rule: this phase pre-installs the pinned libraries into the right packages so later phases never edit manifests or the lockfile; a later new dependency needs a registry note and a serialized commit.
- No Cloudflare route, custom domain or zone reference may exist in any config (`guard:cf` enforces). Free models only; the paid LLM path is built later but stays disabled by config (`PAID_FALLBACK_ENABLED=false`).

## Blast Radius

Everything above (new files only; nothing existing is modified except `.gitignore`). Registry entry: `phase-blast-radius-registry.md` `## Phase 00`.

## Data Flow / Failure Modes

Scaffold only. Spike data flow: spike Worker (remote) ← curl/Playwright client; results → REF file. Failure mode: a remote spike action without approval → refuse and mark INCONCLUSIVE-LOCAL (never silently skip, never run).

## Spikes S1–S10 (kill criteria and fallbacks)

Cost class legend: local = no network; needs-cf = deploys a throwaway `aduin-transaction-spike*` resource (outward-facing, approval); live = OpenRouter free model calls (approval with max request count). All remote actions need an explicit APPROVED-REMOTE line in the validate-contract; local-first variants always run.

| # | Question | Method | Pass | Kill criterion | Fallback triggered | Class | Runs in |
|---|---|---|---|---|---|---|---|
| S1 | Does a streaming hold-open proxy survive 54–90 s on workers.dev within 10 ms CPU? | Spike Worker streams a heartbeat chunk every 10 s for 90 s (no upstream), then one live-model call; read `cpuTime` and outcome from `wrangler tail --format json`; 5 runs at 54 s and 90 s | 5/5 complete, outcome ok, cpuTime ≤ 8 ms | any run drops before 90 s, or cpuTime > 10 ms in 2 of 5 | Uploads go no-LLM; samples keep precomputed AI (AC34); AI lane shows "AI for your own documents is unavailable"; Phase 05 builds only the cached/precomputed path | needs-cf (+1 live) | 00 |
| S2 | Can a ~400 KB image body be proxied within CPU? | POST 400 KB base64 JSON to spike route; compare pass-through stream vs parse+template; measure cpuTime | ≤ 7 ms with pass-through | > 7 ms after both variants | Shrink to 1200–1500 px JPEG 0.7 (~150–250 KB) and string-template the body (no JSON parse of the base64); if still failing, visitor OCR off, precomputed scan set only | needs-cf | 00 |
| S3 | Do 2 OCR pages per request keep footnote markers? | `appa1-pg1` plus `appa1-pg2` in one prompt, strict JSON, nemotron-3.5-super-vl:free, 3 runs (≤ 4 requests) | markers kept 3/3 | marker lost in ≥ 2 of 3 | One page per request; visitor OCR cap tightened to 6 pages/day | live | 06 (step A) |
| S4 | Does the model return usable region coordinates? | Same pages, ask for normalized boxes per line; compare to hand-drawn boxes for 3 lines (≤ 3 requests) | IoU ≥ 0.3 on ≥ 50% of lines | coordinates absent or IoU < 0.3 on ≥ 50% | Page-level highlight only; location text "page N, line M" (AC4/AC23 weaker, documented) | live | 06 (step A) |
| S5 | D1 Free quota facts, `INSERT … ON CONFLICT DO UPDATE … WHERE … RETURNING` atomic counter, Cron on Free | docs via vc-docs-seeker + local pool-workers concurrency test (20 parallel claims, cap 10) + one remote read of quota docs/limits | exactly 10 succeed locally | atomicity violated, or RETURNING unsupported | Two-statement claim inside `db.batch`; lazy purge only | local (+needs-cf) | 04b (step A) |
| S6 | Real workerd CPU on the proxy path; script size limit | Build the Worker skeleton, `wrangler deploy --dry-run --outdir` into a scratch folder, measure gzip size; remote CPU via tail on the S1 route | gz size < 1 MiB and CPU ≤ 8 ms | gz size > 2.5 MiB or CPU > 10 ms | Drop zod from Worker hot path (hand validators), lazy `import()` rarely used code | local + needs-cf | 00 |
| S7 | Browser timing for the largest sample and a 22-page scan/PDF (AC29 baseline) | Playwright (Chromium) harness: htmlparser2 SAX + cell merge on #2 (380 KB); pdf.js render+downscale of ILPA PDF (local-only #14) and downscale of the 22 JPEGs; log ms | #2 parse+merge ≤ 1.5 s; page render ≤ 400 ms/page | parse+merge > 3 s or render > 1.5 s/page | Move work into Comlink Web Worker chunks, stream SAX, lower render scale to 1200 px | local | 00 |
| S8 | D1 SQL surface: `json_each` with one array param, 100-param cap, partial unique index use (EXPLAIN), triggers with RAISE, WITHOUT ROWID + composite FK, defer FK, trigger vs purge DELETE, batch+fetch share 50, Cron on Free | pool-workers tests with real migrations plus one remote check of the shared-50 budget | all behaviors as designed | any behavior differs | Chunked `IN (?,…)` of 90 (3 queries/200 findings); app-layer enforcement + tests instead of triggers; child-first explicit deletes; lazy purge only | local (+needs-cf) | 04b (step A) |
| S9 | Rows-written calibration | Remote throwaway D1: persist a 200-finding run, a decision, a session; read `meta.rows_written` | run ≤ ~250, decision ≤ ~15, session ≤ ~60 | estimate > 2× | Findings persistence becomes opt-in only; session copy of demo seed skipped (read-only demo fallback) | needs-cf | 04b (step A) |
| S10 | Cold-start CPU of the memory path (HMAC verify, 128 KB JSON parse, @noble/hashes, validator choice) | Spike route + tail, zod vs zod/mini | ≤ 5 ms | > 8 ms | Lighter validator; smaller chunk size (25) | needs-cf | 04b (step A) |

Slice-critical now: S6, S7, S1, S2 (local variants always; remote under approval). The others keep their design here and are authored and run at the named phase entry; their fallbacks are already pre-adopted as plan defaults, so no phase is blocked by them.

## Implementation Checklist

### Step A — Confirm facts and pins (vc-docs-seeker)
- [ ] A1. Run vc-docs-seeker for every library/API in the pin list; write exact versions and API notes into `subdoc-qa-mvp_SPIKE-RESULTS_REF_17-10-26.md` (section "Pins").
- [ ] A2. Confirm the Workers Free / D1 Free / Cron / Turnstile / OpenRouter facts table; write results (section "Facts"); if a fact contradicts DATA-MODEL, add a "Plan impact" line naming the phase plans to update.

### Step B — Monorepo scaffold
- [ ] B1. Create `package.json` (private, `packageManager`), `pnpm-workspace.yaml` (`packages/*`, `apps/*`, `scripts`), `tsconfig.base.json` (strict, ES2022, `moduleResolution: bundler`), `.nvmrc` (24).
- [ ] B2. Create `packages/core` with `src/index.ts` (empty barrel) and Vitest config; add one smoke test `test/unit/smoke.test.ts`.
- [ ] B3. Create `apps/web` Vite React TS skeleton with one placeholder page, Vitest (jsdom) smoke, `playwright.config.ts` with a `webServer` running `pnpm dev:stack`.
- [ ] B4. Create `apps/worker` with `wrangler.jsonc` (name `aduin-transaction-web`, assets directory pointing at the web build output, `run_worker_first ["/api/*"]` per docs-seeker result, D1 binding `DB` named `aduin-transaction-db` with placeholder id, no routes), `src/index.ts`, `src/app.ts` (`createApp(deps)`, tiny route table, `GET /api/health` returns `{ok:true}`), pool-workers `vitest.config.ts`, smoke test.
- [ ] B5. Create `scripts/` package (tsx runner) and `fixtures/` skeleton dirs.
- [ ] B6. Pre-install all pinned libraries into the correct packages (see pin table); generate lockfile.

### Step C — Tooling and guards
- [ ] C1. Root scripts per Public Contracts; `pnpm test` = `pnpm -r test`.
- [ ] C2. `scripts/src/guards/guard-cf.ts`: fail if any tracked config/script contains zone id `894bc9f93640fab260bf1580b5b48cb7`, `itsjiathao.com`, a `routes` or `custom_domain` key in wrangler configs, or a Worker/D1/KV/R2 name without the `aduin-transaction` prefix. Test it with a failing fixture.
- [ ] C3. `scripts/src/guards/secrets-scan.ts`: fail on `sk-or-`, long hex/base64 assignments to `*_KEY`/`*_SECRET`, tracked `.dev.vars`/`.env*`; test with failing fixture. Record a log-redaction rule for later phases (never log headers/bodies containing keys).
- [ ] C4. `THIRD_PARTY_NOTICES.md` skeleton listing each dependency and license.
- [ ] C5. `scripts/src/guards/guard-git.ts` (optional helper) documenting that `git push` is a hard stop (no push without user OK); no automation of push.

### Step D — Seams
- [ ] D1. Create the seam stubs listed under Touchpoints with exact exported names, each covered by a test asserting the stub exists and is a no-op (so later phases replace, not invent).
- [ ] D2. Write the seam rule into the registry: later phases append to barrel/registry files only; the orchestrator serializes those edits.

### Step E — Slice spikes (S6, S7, S1, S2)
- [ ] E1. S7: build `scripts/src/spikes/s07-browser-timing/` Playwright harness; run locally; record ms in REF.
- [ ] E2. S6 local: `wrangler deploy --dry-run --outdir <scratch>` on the skeleton; record gz size.
- [ ] E3. S1/S2/S6 remote: author `scripts/spikes/s01-s02/` spike Worker (`aduin-transaction-spike`) and run script. Allowed unattended under the confirmed deploy policy (only `aduin-transaction-spike*` resources on workers.dev, never the zone, no routes); if the policy or credentials are unavailable, record INCONCLUSIVE-LOCAL. Credentials via `set -a; source ~/.config/cloudflare/credentials.env; set +a`, never printed; requires the user's APPROVED marker). After running: delete the spike Worker and confirm the account listing no longer shows it.
- [ ] E4. Record verdicts; adopt fallbacks for FAIL/INCONCLUSIVE in the REF and in the "Plan impact" list.

### Step F — Deferred spike specs
- [ ] F1. Copy the S3, S4, S5, S8, S9, S10 rows into the REF with owner phase; confirm each owner phase plan's step A references them (Phases 04b and 06 already do).

## Test Gates (commands created in this phase unless noted)

| Gate | Command | Tier | Proves |
|---|---|---|---|
| install | `pnpm install --frozen-lockfile` | Fully-Automated | lockfile consistent |
| typecheck/lint | `pnpm typecheck && pnpm lint` | Fully-Automated | scaffold compiles |
| unit smoke | `pnpm test` | Fully-Automated | each package runner works (Vitest, jsdom, pool-workers) |
| guards | `pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | no zone/secret leakage; guard tests prove they can fail |
| worker health | `pnpm --filter @aduin/worker test` | Fully-Automated | `/api/health` via pool-workers |
| spikes | `pnpm --filter @aduin/scripts spike:check` (checks REF rows) | Fully-Automated | every spike has a verdict row |
| remote spike | manual, APPROVED-REMOTE only | Agent-Probe | S1/S2/S6 verdicts (residual: local proxies cannot enforce the CPU limit) |

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `scaffold-smoke` (install, typecheck, lint, test, guards) | Fully-Automated | none (enabling; protects AC31 zone rule and secret hygiene) |
| `spike-results-ref-complete` | Fully-Automated | none (enables AC29/AC40 decisions: spikes S6, S7) |
| S1, S2, S6 remote verdicts | Agent-Probe | informs AC40 and the AC35 fallback choice |

```bash
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm guard:cf && pnpm secrets:scan
# Expected: all exit 0
```

## Exit Gate

- All Test Gates green; REF written with Pins, Facts, S1–S10 verdicts or owner-phase hand-offs.
- Remote spike resources deleted (or never created); `pnpm guard:cf` green.
- Phase report written to the report destination.

## Risks and Kill Criteria

- Spike results change the architecture: each has a pre-adopted fallback (table), so the plan never blocks.
- pnpm/Playwright browser install needs network: allowed; no secrets involved.
- Remote spikes cost nothing but are outward-facing: approval gate above.

## Cost / Secret Hygiene

Free models only; spikes S3/S4 are ≤ 7 live requests total and run in Phase 06 under approval; the OpenRouter key is read from env only in scripts and never printed; PDFs are never sent to OpenRouter; Cloudflare resources named `aduin-transaction-*`; zone itsjiathao.com never touched; no git push.

## Rollback

Everything is new files: `git revert` the phase commit; delete any remote spike resources by name (`aduin-transaction-spike*`).

## Blockers That Would Justify BLOCKED Status

- Node/pnpm cannot be installed; the registry/network is unreachable for installs.
- A required library has no maintained release compatible with Node 24 / Workers (then update pins and route to the user).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md` (include APPROVED-REMOTE / APPROVED-LIVE lines or their absence)
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals present: S1 (3 workspaces), S3 (10 spikes), S4, S6 (secrets/Cloudflare), S7 → score 5/7 HIGH. Recommended: sequential for Steps A–D (shared files); parallel read-only subagents for the independent spike probes in Step E (no cross-talk). Models: sonnet for research/validation, opus only for the scaffold/spike code execution leg.

## Test Infra Improvement Notes

(none identified yet) — expected later: shared `RecordedTransport` helper (Phase 05), D1 query-counting wrapper (Phase 04b).

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-00-scaffold-spikes_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next Step: spawn vc-research-agent for RESEARCH (step 1); then follow Phase Loop Progress. Remote actions need APPROVED-REMOTE in the contract. Do not start Phase 01 before this phase's exit gate.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
