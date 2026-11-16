---
phase: projects-v1-execute
date: 2026-11-15
status: COMPLETE_WITH_GAPS
feature: projects
plan: process/features/projects/active/projects-v1_15-11-26/projects-v1_PLAN_15-11-26.md
---

# Projects v1 - EXECUTE report

## What Was Done

All 10 checklist items. Client-only Projects landing page (first screen outside e2e and counsel share), create dialog with members and roles, 3 seeded demo projects, View as switch in the sidebar, Mark ready to digitize gated on Approver, Dexie version 3 additive `projects` table with 30-day purge.

Files: NEW `apps/web/src/state/projects.ts`, `state/projects.test.ts`, `features/projects/{AvatarStack,ProjectRow,ProjectsPage,CreateProjectDialog,ViewAsSwitch,ProjectContext}.tsx`, `features/projects/{seed,initial-view,enter-project}.ts`, `features/projects/{seed.test.ts,role-gate.test.tsx,ProjectsPage.test.tsx}`, `styles/projects.css`, `e2e/projects.spec.ts`. EDIT `src/storage/db.ts`, `src/App.tsx`, `src/features/counsel/CounselScreen.tsx`, `src/shell/Sidebar.tsx`, `src/index.css`, `test/no-e2e-hook-in-dist.test.ts`, `test/package-db-v2.test.ts`, `test/variance-store.test.ts`.

## What Was Skipped or Deferred

Plan known gaps unchanged: real computeGate on rows of non-seeded projects, edit/delete project, live stack check.

## Test Gate Outcomes

| # | Command | Result |
|---|---|---|
| 1 | `pnpm --filter @aduin/web typecheck` | pass |
| 2 | `pnpm --filter @aduin/web test` | 714/714 (104 files) |
| 3 | `test projects` / `seed` / `role-gate` / `no-e2e-hook-in-d` | 22 / 4 / 6 / 2 pass |
| 4 | `pnpm --filter @aduin/web test:e2e projects` | 3/3 |
| 5 | `pnpm --filter @aduin/web test:e2e` | 92 pass, 179 fail, 1 skip, 2 did not run; all failures pre-existing drift (F7b) or load flake |
| 6 | `pnpm lint` | red only on pre-existing F8 `scripts/src/bench/bench-defects.ts` (4 errors) |
| 7 | `pnpm typecheck` | pass |

## Plan Deviations

See plan `## Deviations` (Sidebar hosts the project block, Dexie version assertions in 2 tests, extra helper modules, e2e (c) uses an uploaded doc, purge runs inside `load()`).

## Test Infra Gaps Found

- Preview e2e baseline is red before this change (F7b in `process/general-plans/backlog/llm-detector-followups_NOTE_22-10-26.md`): ~110 failures wait for the removed `sample-option` picker, others for the old "Questions" h1, `nav-structure`, `gp-group`. Classification: harness-drift. The "baseline plus 3 pass" criterion cannot be met until F7b is fixed.
- `pnpm lint` picks up `apps/web/test-results/` trace JS while a Playwright run is in progress (only transient).

## Closeout Packet

- Selected plan: `process/features/projects/active/projects-v1_15-11-26/projects-v1_PLAN_15-11-26.md`
- Verified: gates 1-4, 7; projects specs green; no project failure in gate 5.
- Unverified: full preview green (blocked by F7b drift); manual look at the page.
- Classification: Keep in active/testing until EVL confirms; then UPDATE PROCESS.

## Forward Preview

### Test Infra Found
Specs opt in to the Projects page with `localStorage['e2e.projects']='1'` via `addInitScript`; default e2e view stays the app shell.
### Blast Radius Changes
`apps/web` only. Dexie now at version 3.
### Commands to Stay Green
Gate list above; `pnpm --filter @aduin/web test:e2e projects`.
### Dependency Changes
None.
