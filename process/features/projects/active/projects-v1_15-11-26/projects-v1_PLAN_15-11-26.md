---
name: plan:projects-v1
description: "Projects v1: client-side Projects landing page, create-project modal, members and roles, View-as role gating on Mark ready to digitize, seeded demo projects"
date: 15-11-26
feature: projects
---

# Projects v1 - Plan (SIMPLE, client-side only)

Status: CODE DONE (EXECUTE 15-11-26; awaiting EVL)
Complexity: SIMPLE
**Date:** 15-11-26 | Feature: projects | Selected plan path: `process/features/projects/active/projects-v1_15-11-26/projects-v1_PLAN_15-11-26.md`

## Overview

Add a client-side Projects landing page as the app's first screen, with project creation, members/roles and a View-as role gate; the existing review flow runs inside a project unchanged.

## SPEC (locked, user 2026-11-15)

Goals: Projects page is the first page (allowed exception to no-new-screens). Inside a project the existing upload / package intake / review flow is unchanged.
- List row: name, description (truncated), gate status (Blocked / Ready / Not started), open items count, latest activity, member avatars + roles. Filter tabs "Needs my action" / "All projects" (cheap: filter on derived flag).
- Create modal: name (required 1-200), description (optional), members (name, email, role). Roles: Legal counsel, Digitization analyst, Advisor, Approver.
- No login, no emails sent. "View as <role>" switch in project header (client-only). Only Approver can press Mark ready to digitize (CounselScreen.tsx ~187); others see it disabled with a short reason. Advisory, UI-only.
- Firm decisions/rules stay workspace-wide. Findings/questions/gate follow the project's documents.
- 2-3 seeded demo projects from `features/open-document/demo-packages.ts`.
Out of scope: D1/worker/core changes, auth, invites, per-project firm rules, edit/delete member UI beyond create (delete project is optional, backlog), server sync.

## INNOVATE decision

### Chosen Approach
Client-only Dexie table + zustand store + view flag - fastest, zero contract risk, no migration.

### Why This Over Alternatives
| Alternative | Why Rejected |
|---|---|
| D1 projects table + worker routes | Schema/API surface, deploy needed, orchestrator chose speed |
| localStorage only | Members need structured storage, retention, tests; Dexie already present |

### Risk Predictions
- Security/privacy: member emails are personal data. Mitigation: only in Dexie `projects` table, never in URL/hash/logs/analytics; 30-day purge; project id (random uuid) is the only thing in hash.
- E2E churn: 109 specs use `gotoApp` landing in app shell. Mitigation below (E2E default view = app).
- Counsel share mode must not show Projects: gate on `isCounselMode()` / pendingToken.
- Dexie version bump: additive `version(N+1)` adding table only; existing tables untouched.

### Key Constraints Accepted
Advisory-only roles (a user can switch to Approver); no multi-device; projects not shared.

## Design

- Dexie: new table `projects` (`id`, `name`, `description`, `members[]`, `createdAt`, `updatedAt`, `docIds[]`, `seeded?`). New `db.version(next).stores({ projects: 'id, updatedAt' })` (additive). Retention: `purgeProjectsExpired(db, now)` deletes rows with `updatedAt` older than 30 days (separate constant `PROJECT_RETENTION_DAYS = 30`; NOT inside `purgeExpired` 24 h logic; called at startup next to it). Seeded rows are re-created if absent.
- Store `apps/web/src/state/projects.ts` (zustand): `projects`, `activeProjectId`, `viewAs: Role`, `view: 'projects'|'project'`, actions `load()`, `create(input)`, `open(id)`, `closeToList()`, `setViewAs(role)`; pure helpers `canMarkReady(role)` (true only Approver), `gateStatusFor(project)`, `needsMyAction(project, role)`. Validation helper `validateProjectInput` (name 1-200 trimmed, email shape, role in enum).
- Seeds `apps/web/src/features/projects/seed.ts`: `buildSeedProjects(demoPackages)` returns 2-3 projects (names/descriptions/members authored in code, each referencing a demo package id); inserted on first load when table empty.
- Initial view: `view = 'projects'` unless `isCounselMode()` or `useShare.pendingToken`; when `IS_E2E` and `localStorage['e2e.projects'] !== '1'` initial view = `'project'` (app shell as today). New specs opt in via `page.addInitScript` setting that key. Least churn: gotoApp and the 109 existing specs unchanged. IS_E2E block is compiled out of prod (no-e2e-hook-in-dist stays green; the key string must live only inside the IS_E2E branch).
- `restoreOnStart` (App.tsx) only runs once a project is entered (or in E2E default view) so Projects page is not preempted by last-doc reopen; entering a project runs the existing open flow (OpenDocumentDialog / package intake) unchanged. Opening a seeded project opens its demo package via the existing demo-package loader.
- UI: `features/projects/{ProjectsPage,ProjectRow,CreateProjectDialog,ViewAsSwitch,AvatarStack}.tsx`, `styles/projects.css` using existing tokens (Findings v2 look, Radix dialog restyled as in open-document dialog). Rendered from App.tsx in place of AppShell when `view==='projects'`; header of AppShell gets ViewAsSwitch + "All projects" back link when inside a project. No rationale text on screens; English only.
- Role gate: CounselScreen Mark ready button `disabled={... || !canMarkReady(viewAs)}` with `title`/short inline reason "Only the Approver can mark ready." Default viewAs = Approver (so existing counsel e2e specs keep passing with no churn); counsel share mode forces Approver-unchanged behavior (its own flow untouched).
- Gate status/open items on list: derived from the project's stored doc state where available; seeded projects carry static `summary {gate, openItems, lastActivity}` shown until a real doc is opened (kept minimal; real computeGate wiring is backlog).

## Touchpoints

- NEW `apps/web/src/state/projects.ts` (+ `projects.test.ts`)
- NEW `apps/web/src/features/projects/*` (+ `seed.ts`, `seed.test.ts`, `ProjectsPage.test.tsx`, `role-gate.test.ts`)
- NEW `apps/web/src/styles/projects.css` (import from styles index)
- EDIT `apps/web/src/storage/db.ts` (additive version + table + `purgeProjectsExpired`) and its purge caller
- EDIT `apps/web/src/App.tsx` (view switch, startup)
- EDIT `apps/web/src/features/counsel/CounselScreen.tsx` (role gate only)
- EDIT AppShell header file (ViewAs + back link; locate via grep for header component)
- NEW `apps/web/e2e/projects.spec.ts` (3 specs)

## Public Contracts

None changed: no core exports, no worker routes, no D1. Dexie schema additive only. Hash routes unchanged (project id kept in zustand/session, not hash; if hash used, uuid only, never email).

## Blast Radius

`apps/web` only. Existing specs unaffected because E2E default view = app shell and default role = Approver. Counsel share mode unchanged. Risk: Dexie version bump (verify existing db tests), App.tsx startup ordering.

## Implementation Checklist

- [x] 1. `db.ts`: add `projects` table type, additive version, `purgeProjectsExpired` (30 d), wire into startup purge.
- [x] 2. `state/projects.ts` store + pure helpers + validation.
- [x] 3. `features/projects/seed.ts` using `demo-packages.ts`; first-load seeding.
- [x] 4. UI components + `projects.css`; ProjectsPage list, filter tabs, empty state, create dialog (members add/remove rows).
- [x] 5. App.tsx: initial view logic (counsel/pending-token/E2E), render ProjectsPage vs AppShell, restoreOnStart only after entering a project.
- [x] 6. AppShell header: ViewAsSwitch + back to Projects.
- [x] 7. CounselScreen: role gate + short reason.
- [x] 8. Unit tests: store (create/validate/persist/purge 30 d vs 24 h unaffected), seed (2-3 projects, valid, idempotent), role gating (`canMarkReady`, only Approver, button disabled), page render (rows show fields, no email in `location.href`).
- [x] 9. E2E `projects.spec.ts` (opt-in via init script key `e2e.projects`): (a) create project via modal -> appears in list with name/description; (b) enter seeded project -> demo package upload/review flow reaches Findings; (c) View as Legal counsel -> Mark ready disabled with reason, View as Approver -> enabled.
- [x] 10. Run all gates; fix; confirm no email text in URL, `no-e2e-hook-in-dist` green.

## Verification Evidence

Gate commands below; before/after counts: web unit 692 at 4ca0bad baseline plus new tests; preview e2e baseline plus 3.

EXECUTE run 15-11-26: typecheck green; web unit 714/714 (692 + 22 new); targeted tokens projects 22, seed 4, role-gate 6, no-e2e-hook-in-d 2 all green; `test:e2e projects` 3/3; full preview 92 pass / 179 fail / 1 skip / 2 did not run, every failure is pre-existing harness drift recorded as F7b (removed `sample-option` picker, renamed nav/Questions h1, nav-structure) or load flake (intake-demo-packages passes alone); 0 failures touch projects testids; root `pnpm typecheck` green; `pnpm lint` red only on pre-existing F8 (`scripts/src/bench/bench-defects.ts`, 4 errors, outside blast radius). Report: `projects-v1_REPORT_15-11-26.md`.

## Resume and Execution Handoff

Resume at the first unchecked checklist item. Selected plan is this file only. Execute = opus; no commit, no deploy, no push (autopilot policy). Do not use git stash/checkout/reset.

## Deviations

- Sidebar (`apps/web/src/shell/Sidebar.tsx`) is the shell header: there is no top header in AppShell, so the project block (All projects back link, project name, View as) sits under the brand row via new `features/projects/ProjectContext.tsx` (E1, within blast radius).
- Two existing unit tests pinned the Dexie version at 2 (`test/package-db-v2.test.ts`, `test/variance-store.test.ts`); updated for the additive version 3 (assertion intent kept). `test/no-e2e-hook-in-dist.test.ts` gains one assertion that `e2e.projects` is absent from the production build.
- Extra small modules: `features/projects/initial-view.ts` (first-screen rule, keeps the e2e key inside `IS_E2E`) and `features/projects/enter-project.ts` (seeded -> demo package dialog; with docs -> last-doc restore; new -> upload dialog).
- E2E (c) uses a new project + one uploaded sub doc with the e2e transform emptying findings (a demo package keeps the gate blocked through package-level items), so Approver -> enabled is provable.
- `purgeProjectsExpired` runs at startup inside `useProjects.load()` (the Projects page startup path), not inside `restoreOnStart`, because restore now waits until a project is entered. Role-gate test is `role-gate.test.tsx` (renders CounselScreen), token `role-gate` unchanged.

### Supplement 15-11-26 (orchestrator in-browser check, 4 gaps)
- [x] S1 rail: `ProjectContext` renders a compact column in the 56px rail (icon back button `aria-label="All projects"`, initials badge with full name in title, narrow View as select with visually hidden label); was `display:none`.
- [x] S2 a11y: Create dialog Name/Description get `aria-labelledby` to their visible label spans.
- [x] S3 Projects header "View as" label `white-space: nowrap`.
- [x] S4 reload: active project id (only) kept in sessionStorage `pj:v1:active`; `restoreActive()` after load reopens it when it still exists, else clears and stays on the list. Not used in counsel share / e2e default (projects disabled there). Deviation from the earlier note "active id lives only in the store": now also sessionStorage, no email, not in URL.
- Tests: unit `projects` (+4), e2e `projects.spec.ts` rail + reload case (not run here; EVL owns e2e).

## Validate Contract

Date: 15-11-26
date: 2026-11-15
generated-by: outer-pvl
Gate: PASS

Layer 1: Infra fit PASS (web-only, no worker/D1); Test coverage PASS (unit + preview e2e exist); Breaking changes PASS (additive Dexie version, defaults preserve existing behavior); Security surface PASS (emails stay local, not in URL, 30 d purge; no auth claimed, UI advisory).
Layer 2: db/store PASS; seeds PASS; UI/App wiring PASS with note: locate AppShell header file and verify Dexie version number at execute time (E1); role gate PASS.

Execute-agent instructions:
- E1 Confirm current Dexie version number and AppShell header file by grep before editing; adjust, do not skip.
- E2 The `e2e.projects` key string must be inside an `IS_E2E` branch so the production build carries it not.
- E3 No `--` token in pnpm commands; one token per `test` call.
- E4 Do not add D1/worker/core changes; if needed, stop and report.

Test gates (run from repo root, in order):
1. `pnpm --filter @aduin/web typecheck`
2. `pnpm --filter @aduin/web test` (full web unit; expect 692 + new, all green)
3. targeted unit tokens, one per call: `pnpm --filter @aduin/web test projects` ; `pnpm --filter @aduin/web test seed` ; `pnpm --filter @aduin/web test role-gate` ; `pnpm --filter @aduin/web test no-e2e-hook-in-d`
4. `pnpm --filter @aduin/web test:e2e projects` (targeted new spec)
5. `pnpm --filter @aduin/web test:e2e` (full preview; baseline plus 3 pass, 1 opt-in skip)
6. `pnpm lint`
7. `pnpm typecheck`

Known gaps: real computeGate on list rows for non-seeded projects, delete/edit project, live stack check (backlog). Tier: fully-automated.

## Acceptance Criteria

- AC1 Projects page is first page (non-E2E, non-counsel); seeded projects visible.
- AC2 Create modal validates and adds a project to the list.
- AC3 Entering a project runs the unchanged upload/review flow.
- AC4 Only Approver can press Mark ready to digitize; others disabled with reason.
- AC5 No email in URL; counsel share mode never shows Projects; all existing gates stay green.

## Phase Completion Rules

CODE DONE only after checklist done; VERIFIED only when every test gate above is green and the plan reconciled.

Next: ENTER EXECUTE MODE for this plan (standing consent granted under autopilot).
