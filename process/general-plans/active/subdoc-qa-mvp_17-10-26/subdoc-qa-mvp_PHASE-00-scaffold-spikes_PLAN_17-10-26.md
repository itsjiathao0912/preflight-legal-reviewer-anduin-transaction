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
**Status**: ✅ VERIFIED (DONE 17-10-26; EVL 11/11 green; commit 7d9955b)
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ✅ VERIFIED (DONE; plan stays in active/ until the program closes)
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
| Tests | Vitest **4.x** (pin the major that `@cloudflare/vitest-pool-workers` peers: 0.23.0 peers `vitest ^4.1.0`; vitest latest is 5.x, do NOT use it), fast-check, @cloudflare/vitest-pool-workers, Playwright, @axe-core/playwright (axe-core) | same vitest 4.x in every package |
| Toolchain | typescript, eslint + typescript-eslint, prettier, tsx, jsdom, `@cloudflare/workers-types` or `wrangler types` (choose per docs-seeker) | required for `pnpm typecheck` / `pnpm lint` / scripts runner / jsdom smoke tests |
| Package manager | pnpm 11.13.1 (`packageManager: pnpm@11.13.1`) | probe-confirmed: `pnpm install` exits 1 with ERR_PNPM_IGNORED_BUILDS unless `allowBuilds` is set (esbuild, workerd, any others pnpm reports) |
| Worker | wrangler, no web framework (hand-rolled route table, ~60 LOC) | Hono rejected for script size and CPU unless S6/S10 show headroom |
| Fonts | Newsreader and Geist (per approved mockup) | self-host in Phase 03 if licensing allows (OFL); confirm |
| Licenses | all MIT/BSD/Apache/OFL; record in `THIRD_PARTY_NOTICES.md` | `docs/research/reusable-repos.md` rule |

Confirm via `vc-docs-seeker` before writing any checklist step that calls these APIs: wrangler `assets` config incl. `run_worker_first`, `wrangler d1 migrations apply`, pool-workers config API (take the exact config helper from vc-docs-seeker; `defineWorkersConfig` may be stale in 0.23.x) and `readD1Migrations`/`applyD1Migrations`/`fetchMock`, htmlparser2 `Parser` handlers, jsdiff function names, Dexie schema syntax, Comlink `expose/wrap`, @noble/hashes `sha256` import path, Turnstile test keys.

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

## Registry follow-up (advisory; registry file edited by another agent)

- `apps/worker/wrangler.jsonc` ownership for cron triggers and `vars` is not assigned to 04a/04b in `phase-blast-radius-registry.md`: assign it (Phase 04b owns the `triggers.crons` and purge-related `vars` entries; Phase 04a owns proxy `vars`), each as a serialized one-key edit; Phase 00 owns the file skeleton.
- `createApp` pre-wiring (B4): `mountProxyRoutes` and `mountMemoryRoutes` are already called in `createApp`, so 04a/04b edit only `routes/proxy/index.ts` and `routes/memory/index.ts`; record this in the registry seam rule (D2).

## Data Flow / Failure Modes

Scaffold only. Spike data flow: spike Worker (remote) ← curl/Playwright client; results → REF file. Failure mode: a remote spike action without approval → refuse and mark INCONCLUSIVE-LOCAL (never silently skip, never run).

## Spikes S1–S10 (kill criteria and fallbacks)

Cost class legend: local = no network; needs-cf = deploys a throwaway `aduin-transaction-spike*` resource (outward-facing, approval); live = OpenRouter free model calls (approval with max request count). All remote actions need an explicit APPROVED-REMOTE line in the validate-contract; local-first variants always run.

| # | Question | Method | Pass | Kill criterion | Fallback triggered | Class | Runs in |
|---|---|---|---|---|---|---|---|
| S1 | Does a streaming hold-open proxy survive 54–90 s on workers.dev within 10 ms CPU? | Spike Worker streams a heartbeat chunk every 10 s for 90 s (no upstream), then one live-model call per duration class (live calls capped at 2 total); read `cpuTime` and outcome from `wrangler tail --format json`; 5 runs at 54 s and 90 s | 5/5 complete, outcome ok, cpuTime ≤ 8 ms (8-10 ms = PASS-WITH-RISK: record measured value, no fallback) | any run drops before 90 s, or cpuTime > 10 ms in 2 of 5 | Uploads go no-LLM; samples keep precomputed AI (AC34); AI lane shows "AI for your own documents is unavailable"; Phase 05 builds only the cached/precomputed path | needs-cf (+1 live) | 00 |
| S2 | Can a ~400 KB image body be proxied within CPU? | POST 400 KB base64 JSON to spike route; compare pass-through stream vs parse+template; measure cpuTime | ≤ 7 ms with pass-through (7-10 ms = PASS-WITH-RISK: record value, no fallback) | > 10 ms after both variants | Shrink to 1200–1500 px JPEG 0.7 (~150–250 KB) and string-template the body (no JSON parse of the base64); if still failing, visitor OCR off, precomputed scan set only | needs-cf | 00 |
| S3 | Do 2 OCR pages per request keep footnote markers? | `appa1-pg1` plus `appa1-pg2` in one prompt, strict JSON, nemotron-3.5-super-vl:free, 3 runs (≤ 4 requests) | markers kept 3/3 | marker lost in ≥ 2 of 3 | One page per request; visitor OCR cap tightened to 6 pages/day | live | 06 (step A) |
| S4 | Does the model return usable region coordinates? | Same pages, ask for normalized boxes per line; compare to hand-drawn boxes for 3 lines (≤ 3 requests) | IoU ≥ 0.3 on ≥ 50% of lines | coordinates absent or IoU < 0.3 on ≥ 50% | Page-level highlight only; location text "page N, line M" (AC4/AC23 weaker, documented) | live | 06 (step A) |
| S5 | D1 Free quota facts, `INSERT … ON CONFLICT DO UPDATE … WHERE … RETURNING` atomic counter, Cron on Free | docs via vc-docs-seeker + local pool-workers concurrency test (20 parallel claims, cap 10) + one remote read of quota docs/limits | exactly 10 succeed locally | atomicity violated, or RETURNING unsupported | Two-statement claim inside `db.batch`; lazy purge only | local (+needs-cf) | 04b (step A) |
| S6 | Real workerd CPU on the proxy path; script size limit | Build the Worker skeleton, `wrangler deploy --dry-run --outdir` into a scratch folder, measure gzip size on an entry that bundles zod, @noble/hashes and the route table; remote CPU via tail on the S1 route | gz size < 1 MiB and CPU ≤ 8 ms (1-2.5 MiB or 8-10 ms = PASS-WITH-RISK: record value, no fallback) | gz size > 2.5 MiB or CPU > 10 ms | Drop zod from Worker hot path (hand validators), lazy `import()` rarely used code | local + needs-cf | 00 |
| S7 | Browser timing for the largest sample and a 22-page scan/PDF (AC29 baseline) | Playwright (Chromium) harness: htmlparser2 SAX + cell merge on #2 (380 KB); pdf.js render+downscale of ILPA PDF (local-only #14) and downscale of the 22 JPEGs; log ms | #2 parse+merge ≤ 1.5 s; page render ≤ 400 ms/page | parse+merge > 3 s or render > 1.5 s/page | Move work into Comlink Web Worker chunks, stream SAX, lower render scale to 1200 px | local | 00 |
| S8 | D1 SQL surface: `json_each` with one array param, 100-param cap, partial unique index use (EXPLAIN), triggers with RAISE, WITHOUT ROWID + composite FK, defer FK, trigger vs purge DELETE, batch+fetch share 50, Cron on Free | pool-workers tests with real migrations plus one remote check of the shared-50 budget | all behaviors as designed | any behavior differs | Chunked `IN (?,…)` of 90 (3 queries/200 findings); app-layer enforcement + tests instead of triggers; child-first explicit deletes; lazy purge only | local (+needs-cf) | 04b (step A) |
| S9 | Rows-written calibration | Remote throwaway D1: persist a 200-finding run, a decision, a session; read `meta.rows_written` | run ≤ ~250, decision ≤ ~15, session ≤ ~60 | estimate > 2× | Findings persistence becomes opt-in only; session copy of demo seed skipped (read-only demo fallback) | needs-cf | 04b (step A) |
| S10 | Cold-start CPU of the memory path (HMAC verify, 128 KB JSON parse, @noble/hashes, validator choice) | Spike route + tail, zod vs zod/mini | ≤ 5 ms | > 8 ms | Lighter validator; smaller chunk size (25) | needs-cf | 04b (step A) |

Slice-critical now: S6, S7, S1, S2 (local variants always; remote under approval). The others keep their design here and are authored and run at the named phase entry; their fallbacks are already pre-adopted as plan defaults, so no phase is blocked by them.

## Implementation Checklist

### Step A — Confirm facts and pins (vc-docs-seeker)
- [x] A1. Run vc-docs-seeker for every library/API in the pin list; write exact versions and API notes into `subdoc-qa-mvp_SPIKE-RESULTS_REF_17-10-26.md` (section "Pins").
- [x] A2. Confirm the Workers Free / D1 Free / Cron / Turnstile / OpenRouter facts table; write results (section "Facts"); if a fact contradicts DATA-MODEL, add a "Plan impact" line naming the phase plans to update.

### Step B — Monorepo scaffold
- [x] B1. Create `package.json` (private, `packageManager`), `pnpm-workspace.yaml` (`packages/*`, `apps/*`, `scripts`), `tsconfig.base.json` (strict, ES2022, `moduleResolution: bundler`), `.nvmrc` (24). Set `packageManager: pnpm@11.13.1`. In `pnpm-workspace.yaml` add `allowBuilds` for `esbuild`, `workerd` and every other package pnpm reports under ERR_PNPM_IGNORED_BUILDS. Require ONE clean `pnpm install` (exit 0, no ignored-builds error) before the lockfile is generated/committed.
- [x] B2. Create `packages/core` with `src/index.ts` (empty barrel) and Vitest config; add one smoke test `test/unit/smoke.test.ts`.
- [x] B3. Create `apps/web` Vite React TS skeleton with one placeholder page, Vitest (jsdom) smoke, `playwright.config.ts` with a `webServer` running `pnpm dev:stack`.
- [x] B4. Create `apps/worker` with `wrangler.jsonc` (name `aduin-transaction-web`, assets directory pointing at the web build output, `run_worker_first ["/api/*"]` per docs-seeker result, D1 binding `DB` named `aduin-transaction-db` with placeholder id, no routes), `src/index.ts`, `src/app.ts` (`createApp(deps)`, tiny route table, `GET /api/health` returns `{ok:true}`; `createApp` ALREADY calls the no-op `mountProxyRoutes(app, deps)` and `mountMemoryRoutes(app, deps)` so 04a/04b only fill their own stub files and never edit `app.ts`), pool-workers `vitest.config.ts`, smoke test.
- [x] B5. Create `scripts/` package (tsx runner) and `fixtures/` skeleton dirs.
- [x] B6. Pre-install all pinned libraries into the correct packages (see pin table, incl. vitest 4.x and the Toolchain row); run `pnpm install` once and confirm exit 0 with no ERR_PNPM_IGNORED_BUILDS before generating the lockfile; then verify `pnpm install --frozen-lockfile` exits 0.
- [x] B7. Run `pnpm exec playwright install chromium` (network allowed, no secrets); precondition for S7 and web e2e.
- [x] B8. Add `.gitkeep` to every empty fixture/test directory (`fixtures/*`, `packages/core/test/*`, `apps/web/e2e/`) so they are tracked.

### Step C — Tooling and guards
- [x] C1. Root scripts per Public Contracts; `pnpm test` = `pnpm -r test`.
- [x] C2. `scripts/src/guards/guard-cf.ts` (file list from `git ls-files --cached --others --exclude-standard`, so uncommitted new files are scanned; scan scope: wrangler configs, package manifests, `scripts/`, `apps/*/src`, root config files; exclusions: the guard sources themselves, `scripts/**/test/**`, `process/`, `docs/`, `CLAUDE.md`, `AGENTS.md`): fail if any tracked config/script contains zone id `894bc9f93640fab260bf1580b5b48cb7`, `itsjiathao.com`, a `routes` or `custom_domain` key in wrangler configs, or a Worker/D1/KV/R2 name without the `aduin-transaction` prefix. Test it with failing fixtures built at RUNTIME in an OS tmp dir (string concatenation, e.g. split zone id literal) - never commit a literal zone id fixture.
- [x] C3. `scripts/src/guards/secrets-scan.ts` (same file listing command, scope and exclusions as C2): fail on `sk-or-`, long hex/base64 assignments to `*_KEY`/`*_SECRET`, tracked `.dev.vars`/`.env*`; test with failing fixtures built at runtime in a tmp dir (never commit a literal `sk-or-` string; assemble it from parts). Record a log-redaction rule for later phases (never log headers/bodies containing keys).
- [x] C4. `THIRD_PARTY_NOTICES.md` skeleton listing each dependency and license.
- [x] C5. `scripts/src/guards/guard-git.ts` (optional helper) documenting that `git push` is a hard stop (no push without user OK); no automation of push.

### Step D — Seams
- [x] D1. Create the seam stubs listed under Touchpoints with exact exported names, each covered by a test asserting the stub exists and is a no-op (so later phases replace, not invent).
- [x] D2. Write the seam rule into the registry: later phases append to barrel/registry files only; the orchestrator serializes those edits.

### Step E — Slice spikes (S6, S7, S1, S2)
- [x] E1. S7: build `scripts/src/spikes/s07-browser-timing/` Playwright harness; run locally; record ms in REF.
- [x] E2. S6 local: `wrangler deploy --dry-run --outdir <scratch>` on the skeleton; record gz size.
- [x] E3. S1/S2/S6 remote: author `scripts/spikes/s01-s02/` spike Worker (`aduin-transaction-spike`) and run script. Allowed unattended under the confirmed deploy policy (only `aduin-transaction-spike*` resources on workers.dev, never the zone, no routes). Procedure:
  1. Credentials: user approved using `~/.config/cloudflare/credentials.env` for this project; load it ONLY in a Bash call carrying a trailing `# APPROVED:credentials.env` marker, e.g. `set -a; source ~/.config/cloudflare/credentials.env; set +a  # APPROVED:credentials.env`; never print values. If the hook or permission system still denies, record INCONCLUSIVE-LOCAL and adopt the fallback.
  2. Subdomain pre-check: before any `wrangler deploy`, query the Cloudflare API for the account workers.dev subdomain (X-Auth-Email / X-Auth-Key headers, values not printed). If absent: do NOT register one; record INCONCLUSIVE-LOCAL.
  3. OpenRouter key: reaches the spike Worker only by piping from env via stdin to `wrangler secret put` (no echo, no argv); the secret and Worker are deleted after the spike; confirm via API listing that neither remains.
  4. S1 live OpenRouter calls capped at 2 TOTAL (one post-heartbeat upstream call per duration class, 54 s and 90 s), free model only.
  5. After running: delete the spike Worker and confirm the account listing no longer shows it.
- [x] E4. Record verdicts; adopt fallbacks for FAIL/INCONCLUSIVE in the REF and in the "Plan impact" list. Grey zones (between Pass and Kill) are PASS-WITH-RISK: record the measured value, adopt NO fallback unless the kill criterion fires.
- [x] E5. Create the spike gate scripts in `scripts/src/spikes/` (wired as `@aduin/scripts` `spike:*`), each with a failing-case test built at runtime:
  - `spike:check`: parses the REF and requires one table row per spike S1..S10. REF row format (Markdown table `## Spike verdicts`, header `| Spike | Verdict | Measured | Fallback adopted | Owner phase |`; one row per spike, first cell exactly `S1`..`S10`). Verdict must be one of `PASS`, `PASS-WITH-RISK`, `FAIL(fallback)`, `INCONCLUSIVE-LOCAL`, `DEFERRED(owner phase)` (e.g. `DEFERRED(04b)`). Exit non-zero on a missing row, unknown verdict, or empty Measured for PASS/PASS-WITH-RISK.
  - `spike:s07`: runs the Playwright harness from E1 and exits non-zero past kill thresholds (parse+merge > 3 s or render > 1.5 s/page); 1.5 s / 400 ms are Pass; between is PASS-WITH-RISK.
  - `spike:s06-local`: builds a skeleton spike entry that bundles zod, @noble/hashes AND the route table (not the empty skeleton), runs `wrangler deploy --dry-run --outdir <scratch>`, gzips the output and asserts size: < 1 MiB PASS, 1 to 2.5 MiB PASS-WITH-RISK, > 2.5 MiB exits non-zero (kill).

### Step F — Deferred spike specs
- [x] F1. Copy the S3, S4, S5, S8, S9, S10 rows into the REF with owner phase; confirm each owner phase plan's step A references them (Phases 04b and 06 already do).

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
- [x] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [x] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [x] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals present: S1 (3 workspaces), S3 (10 spikes), S4, S6 (secrets/Cloudflare), S7 → score 5/7 HIGH. Recommended: sequential for Steps A–D (shared files); parallel read-only subagents for the independent spike probes in Step E (no cross-talk). Models: sonnet for research/validation, opus only for the scaffold/spike code execution leg.

## Test Infra Improvement Notes

(none identified yet) — expected later: shared `RecordedTransport` helper (Phase 05), D1 query-counting wrapper (Phase 04b).

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-00-scaffold-spikes_PLAN_17-10-26.md`
- Last completed step: UPDATE PROCESS (step 7) done 17-10-26; EVL 11/11 green; committed 7d9955b (execution); process commit by the orchestrator. Report: `subdoc-qa-mvp_PHASE-00-scaffold-spikes_REPORT_17-10-26.md`; REF: `subdoc-qa-mvp_SPIKE-RESULTS_REF_17-10-26.md`; closeout: `subdoc-qa-mvp_PHASE-00-closeout_REPORT_17-10-26.md`.
- Validate-contract status: PASS (outer-pvl, 2026-10-17, after supplement cycle 1; see `## Validate Contract`)
- Next Step: Phase 00 is DONE. Next program step is Phase 01 EXECUTE (see umbrella `## Current Execution State`).

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: outer-pvl
supersedes: 2026-10-17 (outer-pvl) — first-pass CONDITIONAL contract (0 FAIL, 6 CONCERN); supplement cycle 1 applied all 6 gaps (see `subdoc-qa-mvp-phase00-pvl-iteration-001_REPORT_17-10-26.md`) and this re-validation from V1 has current evidence

Parallel strategy: sequential (Steps A-D, shared files); parallel read-only subagents for the independent Step E spike probes
Rationale: 5/7 signals (S1 multi-workspace, S3 10 spikes, S4 phase program, S6 secrets/Cloudflare, S7 5+ files); dominant signal = shared-file scaffold, so sequential for A-D. Models: sonnet for research/validation, opus only for the scaffold/spike code execution leg.

Re-validation evidence (this cycle):
- Structural: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <plan>` exit 0, 0 failures, 0 warnings.
- Gap closure (all 6 verified in plan text): (1) B1/B6 + pin table `allowBuilds`, one clean `pnpm install` before lockfile; (2) pin table Tests + Toolchain rows (vitest 4.x, typescript, eslint, prettier, tsx, jsdom, workers types) + B7 Chromium; (3) E5 `spike:check` / `spike:s07` / `spike:s06-local` with REF row format and verdict vocabulary; (4) C2/C3 scan scope, exclusions, `git ls-files --cached --others --exclude-standard`, runtime-built fixtures; (5) E3 steps 1-5 (APPROVED marker, subdomain pre-check, stdin secret, delete + listing, S1 cap = 2 live calls); (6) S1/S2/S6 PASS-WITH-RISK grey zones, E4, S6 bundles zod + @noble/hashes + route table.
- Probes run in a scratch dir outside the repo (nothing in the repo touched): pnpm 11.13.1 + `allowBuilds: {esbuild, workerd}` -> `pnpm add -D vitest@4 @cloudflare/vitest-pool-workers@0.23.0 wrangler typescript` exits 0; `@cloudflare/vitest-pool-workers@0.23.0` peers `vitest ^4.1.0` (confirmed); a pool-workers health test passed with `assets.directory` pointing at a non-existent folder (so `pnpm test` does not need the web build first); privacy hook regex `APPROVED:[^\s]+` is matched anywhere in a Bash command, so the trailing `# APPROVED:credentials.env` marker in E3 is accepted (read `.claude/hooks/lib/privacy-checker.cjs`).
- Regression scan: registry and Phases 01/03/04a/04b consistent with this plan (04a already assumes Phase 00 B4 pre-wiring and the wrangler vars seam); no touchpoint removed; Phase 00 still owns manifests, lockfile, `.gitignore`.

Remote/live approvals:
- APPROVED-REMOTE: conditional. Covers ONLY spike S1/S2/S6 remote variants: deploy of Worker `aduin-transaction-spike` to workers.dev (no routes, no custom domain, never zone itsjiathao.com / 894bc9f93640fab260bf1580b5b48cb7), run, then delete and confirm the account listing no longer shows it. Basis: locked clarification 2 in `subdoc-qa-mvp_AUTOPILOT_GOAL_17-10-26.md` plus the user's locked authorization (unattended deploys to *.workers.dev / *.pages.dev, `aduin-transaction-*` resources, saved Global key, secrets only via `wrangler secret put`). The runtime permission system and the privacy hook still govern the credentials load; if either denies it, or the account has no workers.dev subdomain, record INCONCLUSIVE-LOCAL and adopt the plan fallback (never register a subdomain, never stall).
- APPROVED-LIVE: cap = 2 free-model OpenRouter requests total for S1 (one post-heartbeat upstream call per duration class, not one per run). S3/S4 live calls are NOT approved here (Phase 06). No paid model.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| P00-AC1a | lockfile consistent, install exits 0 unattended | Fully-Automated | `pnpm install --frozen-lockfile` (needs `allowBuilds` in pnpm-workspace.yaml, plan B1/B6) | B |
| P00-AC1b | scaffold compiles and lints | Fully-Automated | `pnpm typecheck && pnpm lint` | B |
| P00-AC1c | each package runner works (Vitest, jsdom, pool-workers, scripts) | Fully-Automated | `pnpm test` (= `pnpm -r test`; every package incl. `@aduin/scripts` defines `test`, see E8) | B |
| P00-AC1d | `/api/health` served via pool-workers | Fully-Automated | `pnpm --filter @aduin/worker test` | B |
| P00-AC1e | zone/secret guards pass AND can fail | Fully-Automated | `pnpm guard:cf && pnpm secrets:scan && pnpm --filter @aduin/scripts test` (guard tests build failing fixtures at runtime in an OS tmp dir) | B |
| P00-D1 | seam stubs exist with exact exports and are no-ops | Fully-Automated | `pnpm test` (seam tests in core/worker/web) | B |
| P00-AC2a | REF has a verdict row per spike S1-S10, valid verdict vocabulary, Measured filled for PASS rows | Fully-Automated | `pnpm --filter @aduin/scripts spike:check` (plan E5) | B |
| P00-S7 | browser timing thresholds (#2 parse+merge <= 1.5 s; render <= 400 ms/page; kill > 3 s / > 1.5 s) | Hybrid | `pnpm --filter @aduin/scripts spike:s07` exits non-zero past kill thresholds; precondition: `pnpm exec playwright install chromium` done (B7), sample #2 present and the gitignored ILPA PDF present locally | B |
| P00-S6L | spike entry bundling zod + @noble/hashes + route table gz size < 1 MiB (1-2.5 MiB PASS-WITH-RISK; > 2.5 MiB exits non-zero) | Fully-Automated | `pnpm --filter @aduin/scripts spike:s06-local` runs `wrangler deploy --dry-run --outdir <scratch>` and asserts gzip size (plan E5) | B |
| P00-S1S2S6R | remote proxy survives 90 s within CPU; 400 KB body CPU; grey zones recorded as PASS-WITH-RISK | Agent-Probe | spike Worker + `wrangler tail --format json`, 5 runs each at 54 s and 90 s, judged against the S1/S2/S6 pass and kill columns; INCONCLUSIVE-LOCAL fallback if credentials/subdomain unavailable | D |
| P00-AC3 | pins and platform facts confirmed in REF | Agent-Probe | vc-docs-seeker per library/fact; REF sections "Pins" and "Facts"; residual: not a pass on its own | A |

Failing stubs (Fully-Automated rows; red-first starting point):
- test("should install with frozen lockfile", () => { throw new Error("NOT IMPLEMENTED - TDD stub: lockfile consistent, install exits 0") })
- test("should typecheck and lint the scaffold", () => { throw new Error("NOT IMPLEMENTED - TDD stub: scaffold compiles and lints") })
- test("should run each package runner", () => { throw new Error("NOT IMPLEMENTED - TDD stub: core/web/worker/scripts smoke tests") })
- test("should serve GET /api/health", () => { throw new Error("NOT IMPLEMENTED - TDD stub: /api/health returns {ok:true}") })
- test("guard:cf should fail on zone id, routes key and unprefixed names", () => { throw new Error("NOT IMPLEMENTED - TDD stub: guard-cf failing fixtures") })
- test("secrets:scan should fail on sk-or- and tracked .dev.vars", () => { throw new Error("NOT IMPLEMENTED - TDD stub: secrets-scan failing fixtures") })
- test("seam stubs should exist and be no-ops", () => { throw new Error("NOT IMPLEMENTED - TDD stub: mountProxyRoutes, mountMemoryRoutes, createD1Platform, features registry") })
- test("spike:check should fail when a spike row is missing", () => { throw new Error("NOT IMPLEMENTED - TDD stub: REF row per S1-S10") })
- test("spike:s06-local should fail when gz size exceeds the kill threshold", () => { throw new Error("NOT IMPLEMENTED - TDD stub: dry-run gzip size assertion") })

Legacy line form:
- scaffold: [Fully-automated: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm guard:cf && pnpm secrets:scan`]
- guards: [Fully-automated: `pnpm --filter @aduin/scripts test`]
- spike ledger: [Fully-automated: `pnpm --filter @aduin/scripts spike:check`]
- S7: [hybrid: `pnpm --filter @aduin/scripts spike:s07` + Chromium installed + local samples]
- S6 local: [Fully-automated: `pnpm --filter @aduin/scripts spike:s06-local`]
- S1/S2/S6 remote: [agent-probe: spike Worker + wrangler tail; INCONCLUSIVE-LOCAL fallback]
- pins/facts: [agent-probe: vc-docs-seeker]

Dimension findings:
- Infra fit: PASS - `allowBuilds` fix probe-confirmed (exit 0 with esbuild + workerd); vitest 4.x pin matches pool-workers 0.23.0 peers; toolchain and Chromium steps present (B6/B7); missing assets dir does not break pool-workers. Advisory: pool-workers is renamed (see E2).
- Test coverage: PASS - every Fully-Automated/Hybrid gate has a creating checklist step (E5 for spike scripts, C2/C3 for guards, D1 for seams); guards use runtime fixtures and a defined scan scope; S6 bundles real deps; grey zones defined; no developed behavior rests on Known-Gap alone (remote S1/S2/S6 are Agent-Probe backed by automated S6-local and Hybrid S7). Net-gate vacuous-green check: clear.
- Breaking changes: PASS - all-new files; only `.gitignore` edited; seam exports named; B4 pre-wires mounts so 04a/04b do not edit route-mount lines. Advisory (E10): align the D2 seam rule with 04a/04b deps-wiring one-liners; `wrangler.jsonc` cron/vars ownership recorded as a registry follow-up.
- Security surface: PASS - credentials load uses the trailing APPROVED marker (hook-accepted, verified), subdomain pre-check forbids registering one, OpenRouter key via stdin to `wrangler secret put` only, spike Worker and secret deleted and confirmed, S1 live cap 2, free model only, zone itsjiathao.com never referenced in configs (guard:cf enforces), no push.
- Section A feasibility: PASS - vc-docs-seeker confirmations mandated before API steps; probe-confirmed head start in E2/E3.
- Section B feasibility: PASS - all targets new (no collisions); install gate probe-confirmed.
- Section C feasibility: PASS - scope, exclusions, file listing command and runtime fixtures specified.
- Section D feasibility: PASS - seam stubs exact and testable; mounts pre-wired.
- Section E feasibility: PASS - S6 real-dependency bundle, three gate scripts with failing-case tests, grey-zone verdict rule, credentials/subdomain/secret procedure; remote variants may end INCONCLUSIVE-LOCAL by design (known-gap D).
- Section F feasibility: PASS - copying deferred rows is mechanical; owner-phase step A references exist in 04b and 06.

Blast radius vs 01/03/04a: PASS. 00 runs strictly before 01 then (03 || 04a); shared skeleton files are serial. 01 owns `packages/core/**`, 03 owns `apps/web/**`, 04a owns `apps/worker/src/{routes/proxy,...}`; the only 00-created files they touch are the declared seam stubs. `.gitignore`, lockfile and manifests are owned by 00 (registry seam rule).

Plan updates applied: none in this pass (supplement cycle 1 already applied all 6 gaps; validator found no new plan-text defect).

Execute-agent instructions (advisory refinements; none changes a gate or the plan structure):
- E1. `pnpm-workspace.yaml` needs `allowBuilds` (esbuild: true, workerd: true, plus any other package pnpm reports under ERR_PNPM_IGNORED_BUILDS); run one clean `pnpm install` (exit 0) before the lockfile is generated. `packageManager: pnpm@11.13.1`.
- E2. Pins (probe 17-10-26): vitest 4.1.12 resolved with 4.x; vitest latest is 5.0.5 (do not use unless A1 re-confirms). `@cloudflare/vitest-pool-workers@0.23.0` is DEPRECATED: npm says it was renamed to `@cloudflare/vitest-plugin` (1.4.4, peers `vitest ^4.1.0 || ^5.0.0`). A1 decides via vc-docs-seeker: stay on 0.23.0 (works, probe passed) or migrate; if migrating, write a "Plan impact" line naming Phases 01, 04a, 04b. On 0.23.0 the config helper is the `cloudflareTest({ wrangler: { configPath } })` Vite plugin, not `defineWorkersConfig`. `typescript` resolved to 7.0.2 in the probe: in A1 check `typescript-eslint`'s peer range and pin an in-range TypeScript version.
- E3. Facts head start for the REF "Facts" and Plan impact: `cloudflare:test` on 0.23.0 exports `applyD1Migrations`, `SELF`, `env`, `createExecutionContext`, `createScheduledController` but NOT `fetchMock` -> Phase 04a must inject `fetch` through `createApp(deps)` (its plan E2 already does); record "Plan impact: 04a, 06" in the REF. `assets.directory` may point at a not-yet-built folder without breaking `pnpm test`.
- E4. Credentials for remote spikes: load with `set -a; source ~/.config/cloudflare/credentials.env; set +a  # APPROVED:credentials.env` (marker must be in the same Bash call; the hook matches `APPROVED:[^\s]+` anywhere in the command). The OpenRouter credentials file needs the same marker form. Never echo values, never put them in argv. If the hook or permission system denies, stop the remote variant and record INCONCLUSIVE-LOCAL.
- E5. Before any `wrangler deploy`, check the account workers.dev subdomain via the Cloudflare API (headers X-Auth-Email / X-Auth-Key, values not printed). If none: do NOT register one; record INCONCLUSIVE-LOCAL.
- E6. The OpenRouter key reaches the spike Worker only by piping from env to `wrangler secret put` on stdin; S1 live calls = 2 total, model id must end in `:free` and be listed as free; delete the Worker (and secret) after the run and confirm via API listing.
- E7. Guards: scope guard-cf and secrets-scan to wrangler configs, package manifests, `scripts/`, `apps/*/src`, root config files; list files with `git ls-files --cached --others --exclude-standard`; exclude guard sources, test dirs, `process/`, `docs/`, `CLAUDE.md`, `AGENTS.md`. Build failing fixtures at runtime (string concatenation into a tmp dir); never commit literal `sk-or-` or zone-id fixtures.
- E8. `@aduin/scripts` must define its own `test` script (Vitest 4.x) so `pnpm -r test` runs the guard and spike-script failing-case tests (the plan's Public Contracts list omits it). The plan's Test Gates table lists only `spike:check`; run all three of `spike:check`, `spike:s07`, `spike:s06-local` as gates (this contract is authoritative).
- E9. Grey zones are PASS-WITH-RISK: record the measured value in the REF and adopt no fallback; only the kill criterion triggers a fallback. Hook caveat: the scout-block hook rejects Bash commands whose arguments mention paths like `dist` or `node_modules` unless the command starts with an allowlisted build/tool command (pnpm, npx, vite, vitest, tsc, esbuild, ...); `wrangler`, `node` and `tsx` are not allowlisted, so invoke them as `pnpm exec wrangler ...` / `pnpm exec tsx ...` and avoid inspecting build or dependency folders with cat/grep/ls.
- E10. D2 seam rule wording: 04a and 04b plans keep one-line deps-wiring edits in `apps/worker/src/app.ts` (real TurnstilePort, createD1Platform); what Phase 00 pre-wires is the two route-mount calls. Write the rule as "route-mount lines are never edited; deps-wiring lines are single-line edits serialized by the orchestrator". `apps/worker/wrangler.jsonc` cron/vars ownership (04b crons, 04a vars) is a registry follow-up for the orchestrator; the Phase 04b plan does not yet mention it, so carry it into 04b's PVL.

Open gaps:
- remote S1/S2/S6 verdicts may end INCONCLUSIVE-LOCAL (credentials load, subdomain absent): known-gap: pre-adopted fallbacks in the plan; carried as gap-resolution D (backlog stub: spike-remote-rerun).
- S3, S4, S5, S8, S9, S10 run at owner phases (06, 04b): known-gap: documented as owner-phase hand-offs, not counted as CONCERNs.
- 04b plan lacks `wrangler.jsonc` cron/vars ownership: known-gap: documented as registry follow-up, to be resolved in Phase 04b PVL (not a Phase 00 defect).

What this coverage does NOT prove:
- `pnpm test`/`typecheck`/`lint`: nothing about behavior of later phases; only that the empty scaffold compiles and runs.
- `pnpm install --frozen-lockfile`: does not prove a clean machine without a network or with a different pnpm major.
- `guard:cf`/`secrets:scan`: do not cover git history, remote Cloudflare state, or secrets in untracked files outside the defined scope.
- worker health (pool-workers): does not prove real workerd CPU limits or workers.dev behavior.
- `spike:check`: proves a verdict row exists, not that the verdict is right.
- `spike:s07` (local Chromium on a dev machine): does not prove timings on visitor hardware.
- `spike:s06-local`: gz size only; does not prove runtime CPU or the Free-plan size limit on the platform.
- Remote spikes: a single-region, single-account run does not prove sustained behavior under real load or the OpenRouter free-tier latency distribution.
- Probes done at VALIDATE time (pnpm install, pool-workers health, hook regex) ran in a scratch dir with the versions resolved on 17-10-26; they do not prove the final lockfile resolves identically.

Gate: PASS (0 FAILs, 0 CONCERNs; 6 of 6 supplement gaps verified resolved; advisory E1-E10 recorded; known-gaps carried as named residuals)
Accepted by: n/a (Gate is PASS; no concerns to accept)

## Deviations

Recorded by EXECUTE 17-10-26 (all within the Phase 00 blast radius; none touches auth, billing, schema, public API, container or zone). Details and impact in the phase report.

1. Workers test runner: `@cloudflare/vitest-plugin` 1.4.4 instead of `@cloudflare/vitest-pool-workers` 0.23.0 (contract E2 left this to A1). Impact: Phases 01, 04a, 04b read "pool-workers" as the plugin (REF Plan impact).
2. `@axe-core/playwright` NOT installed: MPL-2.0 is outside the project license rule. Impact: Phases 03/10 a11y need a user decision (REF Plan impact).
3. TypeScript pinned to 6.0.3 (latest 7.0.2 is outside typescript-eslint's peer range `<6.1.0`), per contract E2.
4. Extra dev deps in `@aduin/scripts`: `esbuild` (S7 browser bundle), `@cloudflare/workers-types` and `@types/node` (typecheck). Extra files: `.prettierignore`, `scripts/tsconfig.worker.json`, `scripts/src/guards/scan-files.ts` (shared listing/scope for both guards), `scripts/src/slice-check-stub.ts` (avoids creating 04a-owned `scripts/src/slice-check.ts`), `scripts/spikes/s01-s02/cf-api.ts` (env-only Cloudflare API helper for subdomain/listing checks).
5. `apps/web` smoke test uses a 20-line React render helper instead of adding @testing-library (no new dependency).
6. S2 "pass-through" measured as a JS `TransformStream` byte counter, not a native fetch pipe to an upstream (no third-party sink); recorded in REF method notes.
7. C5 `guard-git.ts` is a documentation constant only (the plan marks it optional; no push automation).
8. pnpm 11.13.1 auto-added `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml` on first install (kept; supply-chain policy).
