---
name: context:tests
description: Test runners (vitest 4 + cloudflare vitest plugin + Playwright), real pnpm commands, no-double-dash rule, tooling caveats and known gaps for the sub-doc QA tool
keywords: test, tests, testing, vitest, playwright, pnpm, cloudflare vitest plugin, guard, secrets scan, spike, verification, golden corpus, fixtures, seeded defects, e2e, ocr accuracy
metadata:
  node_type: group-entrypoint
  type: context
  read_when: testing, verification, test fixtures, or test debugging
---

# aduin-transaction - All Tests

Last updated: 2026-10-17 (Phase 00 UPDATE PROCESS; HEAD 7d9955b)

Attach this file first when the task involves testing, verification, or test debugging.

This is the fast operator guide for the testing surface:

- which runner to use
- what command to start with
- how to quickly debug common failures
- which deeper file to read next

Do not load the whole `process/context/tests/` folder by default. Start here, then drill down.

---

## How This File Works

This is the `all-tests.md` entrypoint for the `tests/` context group. It follows the `all-*.md` routing convention:

1. Agents read `all-context.md` first and get routed here for testing tasks
2. This file gives quick decision rules and commands
3. For deeper details, agents follow the routing table below to specific docs

As the project grows, add deeper docs to this group (e.g., `e2e-tests.md`, `debugging-and-pitfalls.md`) and add routing entries below. This file stays the fast-start entrypoint.

---

## What This Covers

- test runner selection
- quick commands by package
- fast debugging procedures
- current testing gaps worth remembering

## Read This When

Use this file when you need to:

- run tests after implementation
- decide between test runners
- debug failing tests

## Quick Routing

<!-- STUDY: Replace with routing entries to deeper test docs as they are created. -->
<!-- Start with an empty table. Add rows as deeper docs are created during the project lifecycle. -->

<!-- Example of what a filled-in routing table looks like (from a mature project): -->

<!--
| If you need... | Read next |
|---|---|
| commands and scripts by package | `scripts-and-commands.md` |
| architecture, mocks, auth model, and runner split | `architecture-and-patterns.md` |
| Playwright setup, auth flow, and current specs | `e2e-tests.md` |
| failing-test triage and runtime debugging | `debugging-and-pitfalls.md` |
| known gaps and future test-system fixes | `known-issues.md` |
-->

(No deeper test docs yet. Add routing entries here as they are created; this file carries the real commands for now.)

## Quick Decision Guide

<!-- STUDY: Replace with actual test runner names and when to use each. -->
<!-- For monorepos with multiple runners, list each runner with its scope. -->

<!-- Example of what this looks like filled in (monorepo with Vitest + Bun + Playwright): -->

<!--
### Use `vitest` when

- the change is in React components, hooks, stores, or plugin logic
- the package already has a vitest config and unit-test surface

### Use `bun test` when

- the change is in `packages/api`
- the behavior is router, route, auth-helper, or model logic

### Use Playwright when

- the behavior depends on real navigation, auth redirects, rendering, or full-stack browser flows

### Use container verification when

- the issue is about runtime services, gateway WebSocket behavior, or proxy state
-->

<!-- Example for a simpler single-app project: -->

<!--
### Use `vitest` for everything

- all tests run through vitest
- `vitest run` for CI, `vitest` (watch mode) for development
- Playwright tests also use vitest as the runner via `@playwright/test`
-->

### Runner map (Phase 00 scaffold, pnpm 11.13.1 workspace, Node >=24)

- **vitest 4.1.12** is the unit/integration runner in every package (`packages/core`, `apps/web`, `apps/worker`, `scripts`).
  - `packages/core`: Node environment; tests in `test/{unit,golden,property,seeded,recorded}` (fast-check 4.10.2 for property tests).
  - `apps/web`: jsdom environment; tiny render helper, no @testing-library.
  - `apps/worker`: Workers runtime (workerd/Miniflare) through **`@cloudflare/vitest-plugin` 1.4.4** using `cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })`. Import `SELF` / `env` from `cloudflare:test`. It replaces the deprecated `@cloudflare/vitest-pool-workers`. There is no `fetchMock`, so inject `fetch` through `createApp(deps)` (`AppDeps.fetch`).
  - `scripts`: Node environment; guard tests build throwaway git repos with `scripts/test/tmp-repo.ts`.
- **Playwright 1.64.1** (Chromium headless shell) for e2e: `apps/web/playwright.config.ts`, project `stack` runs against `pnpm dev:stack` at `http://127.0.0.1:8787`. `apps/web/e2e/` is empty until Phase 03. The axe a11y scanner is NOT installed (`@axe-core/playwright` is MPL-2.0, outside the license rule; user decision pending).
- LLM and OCR steps are tested against recorded responses only; no live calls in CI.

### Hard rules

- **No `--` token rule (program-wide):** pnpm 11.13.1 passes `--` literally and the whole suite runs. Select tests with `pnpm --filter <pkg> test <token> [<token>...]`, never `test -- <token>`. Older plan text that says `test -- <token>` must be read in the no-`--` form.
- **Run tools through pnpm / `pnpm exec`.** The kit's scout-block hook rejects Bash/Read on paths containing `dist` or `node_modules`, and the privacy hook misreads env-var access text in heredocs as a file path. Write such files with the Write tool, and invoke binaries as `pnpm exec <tool>`, not by a `node_modules/.bin` path.

## Default Verification Order

Unless the task clearly needs a different path:

1. run the narrowest existing automated test
2. use unit/integration tests before browser tests
3. use end-to-end tests only when the real UI is the thing being verified

## Commands

<!-- STUDY: Replace with actual test commands per package/workspace. -->
<!-- For monorepos, use a table showing package name, runner, and command. -->

<!-- Example of what this looks like filled in (monorepo): -->

<!--
| Package | Runner | Command | Notes |
|---|---|---|---|
| `apps/web` | vitest | `pnpm --filter web test` | jsdom environment |
| `packages/api` | bun test | `pnpm --filter @acme/api test` | needs `.env.test` |
| `packages/db` | bun test | `pnpm --filter @acme/db test` | needs running database |
| `apps/web` (e2e) | Playwright | `pnpm --filter web test:e2e` | needs dev server running |
| root | all | `pnpm test` | runs all packages |

**Typecheck (not a test runner, but often needed for verification):**
```bash
pnpm typecheck          # all packages
pnpm --filter web typecheck  # single package
```

**Lint:**
```bash
pnpm lint               # all packages
pnpm lint:verified      # lint + typecheck together
```
-->

<!-- Example for a simpler single-app project: -->

<!--
```bash
pnpm test              # run all tests (vitest)
pnpm test:e2e          # run Playwright e2e tests
pnpm test -- --watch   # watch mode
pnpm test -- path/to/file.test.ts  # single file
```
-->

**Root scripts (run from the repo root):**

| Script | What it runs |
|---|---|
| `pnpm install --frozen-lockfile` | install; supply-chain policy (`minimumReleaseAge`) enforced via `pnpm-workspace.yaml` |
| `pnpm typecheck` | `pnpm -r typecheck` (tsc 6.0.3 in all 4 packages) |
| `pnpm lint` | `eslint . && prettier --check .` |
| `pnpm test` | `pnpm -r test` (all vitest suites) |
| `pnpm guard:cf` | Cloudflare guard (blocks zone `itsjiathao.com`, non-`aduin-transaction-*` names) via `@aduin/scripts` |
| `pnpm secrets:scan` | secret scanner over tracked files via `@aduin/scripts` |
| `pnpm dev:stack` | builds `@aduin/web`, then `wrangler dev` on 127.0.0.1:8787 (used by Playwright) |
| `pnpm slice:check` | currently a stub (`scripts/src/slice-check-stub.ts`); Phase 04a repoints it |

**Per package:**

| Package | Runner | Commands |
|---|---|---|
| `@aduin/core` (`packages/core`) | vitest | `pnpm --filter @aduin/core test`; subsets `test:golden`, `test:property`, `test:corpus`, `test:vectors` (Phase 01: `--passWithNoTests` removed; unmatched token exits 1), `test:seeded` (still `--passWithNoTests`, Phase 02); filename-token gates `test security`, `test contracts`. See `process/context/engine/all-engine.md` |
| `@aduin/web` (`apps/web`) | vitest (jsdom), Playwright | `pnpm --filter @aduin/web test`; `test:e2e`; `test:a11y` (`--grep @a11y --pass-with-no-tests`) |
| `@aduin/worker` (`apps/worker`) | vitest + cloudflare plugin | `pnpm --filter @aduin/worker test` (health, 404 JSON, seam tests: 7 tests) |
| `@aduin/scripts` (`scripts`) | vitest | `pnpm --filter @aduin/scripts test` (22 tests: guard failing-cases, spike-check, thresholds, gzip) |

**Spike gates (scripts package):** `pnpm --filter @aduin/scripts spike:check` (S1..S10 records present), `spike:s06-local` (gzip bundle size), `spike:s07` (browser timing; needs Chromium and local sample docs). Results: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_SPIKE-RESULTS_REF_17-10-26.md`.

**Phase 00 green baseline (to keep green):**
`pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm guard:cf && pnpm secrets:scan`

## Debugging Quick Reference

- **Worker tests fail to find bindings:** bindings come from `apps/worker/wrangler.jsonc`; the plugin config points at it.
- **Worker needs a fake network:** pass `fetch` through `createApp(deps)`; do not rely on `fetchMock`.
- **Web e2e needs the stack:** Playwright starts `pnpm dev:stack` (build + wrangler dev on port 8787); free that port first.
- **Hook false positives:** see the "Run tools through pnpm" rule above.
- **Remote spikes** used a temporary workers.dev Worker (already deleted); do not re-run them without APPROVED-REMOTE in the phase contract.

## Known Gaps

- No a11y scanner (axe is MPL-2.0); Phases 03/10 need a user decision.
- `apps/web/e2e/` has no specs yet (Phase 03).
- Remote spikes were not re-run in EVL; Worker deletion is trusted from the spike REF.
- OpenRouter free-tier numeric limits are unconfirmed; read `GET /api/v1/key` at runtime (Phase 05).
- D1 "batch counts as one of the 50 queries" is open (S8, Phase 04b). S3/S4 land in Phase 06; S5/S8/S9/S10 in Phase 04b.
- No true onshore/offshore feeder pair in the sample corpus; use Partners Group pairs (samples #3-6).
- OCR inputs (`samples/sub-docs/raw/09-rw-holdings-scans/`) have no ground-truth transcript yet; one is needed for OCR accuracy tests.
