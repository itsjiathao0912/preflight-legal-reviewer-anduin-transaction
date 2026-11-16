---
name: plan:notifications-v1
description: "Notifications v1: client-only bell and popover in the app header, 5 role-filtered events stored in a new Dexie table, seeded demo notifications, builds on Projects v1"
date: 15-11-26
feature: projects
---

# Notifications v1 - Plan (SIMPLE, client-side only)

Status: CODE DONE (EXECUTE 15-11-26; e2e pending port, see report)
Complexity: SIMPLE
**Date:** 15-11-26 | Feature: projects | Selected plan path: `process/features/projects/active/notifications-v1_15-11-26/notifications-v1_PLAN_15-11-26.md`

## Overview

A bell with an unread badge opens a Hebbia-style popover ("Notifications (N)", Mark all read, rows with avatar, sentence, project subtitle, relative time, unread dot). Five events are written to a client-side Dexie table and filtered by the View-as role. Builds on Projects v1 (store `state/projects.ts`, Dexie version 3, `ViewAsSwitch`, `ProjectContext`).

## SPEC (locked, user 2026-11-15)

Goals: user sees what changed in their projects without hunting. Reference: Hebbia notification card (screen hebbia-30: tab header with count, avatar, one sentence, muted subtitle, relative time right, coral dot left). Linear: badge counts unread only; Notion: all kept.
- Bell button + badge in the app header: Projects page (`.pj-head`, beside ViewAsSwitch) and inside a project (`ProjectContext` row). Radix popover, tokens only. Notifications only, no "What's new" tab. Header "Notifications (N)" (N = unread for the current role) + "Mark all read". Empty state.
- Row click marks read and opens that project at the right screen: answers -> Questions (`counsel` route); new version -> Findings (Changes segment); ready / sign-off -> Questions. Keyboard: bell, rows (buttons), Mark all read reachable; Escape closes and returns focus to the bell.
- No login: "you" = this browser + current View-as role. Feed filtered by `forRole`. A role is never notified of its own action.
- Five events only: (1) counsel answered N questions, (2) added to a project, (3) new version uploaded, (4) gate Blocked->Ready, (5) marked ready to digitize.
- Seed 3-5 demo notifications on the seeded demo projects (visible on first open).
- English UI, no rationale text on screens.
Out of scope: D1, worker routes, core contracts, email/push, per-user settings, "What's new" tab, unread sound, cross-device sync, delete notification UI, notification preferences.

## INNOVATE decision

### Chosen Approach
Dexie table `notifications` + zustand store + pure emitter functions called at the five existing action sites - zero contract risk, matches Projects v1 pattern.

### Why This Over Alternatives
| Alternative | Why Rejected |
|---|---|
| Derive feed from project state on read (no table) | Cannot represent read state, actor, or one-shot batches; dedupe by answer id needs memory |
| D1 events table + worker routes | Schema/API surface, deploy; user locked client-only |
| localStorage JSON blob | No retention/indexing, cap and quota issues; Dexie already present |

### Risk Predictions
- Correctness: emitters fire on re-render or re-open and create duplicates. Mitigation: deterministic `dedupeKey` (e.g. `answers:<projectId>:<sorted answerIds hash>`, `gate-ready:<projectId>:<cycle>`, `member:<projectId>:<email>`), unique index, `put` is idempotent.
- Product: no real second user, so "Counsel answered" would never appear locally. Mitigation: derive from answers the server already returns (merge path) plus seeds; actor = answerer name from `RemoteAnswer.by`.
- Privacy: events hold member names, never emails; URL never carries notification data.
- E2E churn: 109 existing specs run with Projects off (`e2e.projects` unset) so bell must not break them; bell renders only when projects are enabled.
- Counsel share mode must not show a bell (no Projects there).

### Key Constraints Accepted
Advisory single-browser model; "other roles" notified means the feed shows to whoever switches to that role. Gate-transition detection depends on a live gate value.

## Design

- Storage (`apps/web/src/storage/db.ts`): new interface `StoredNotification { id: string; dedupeKey: string; type: 'answers'|'member_added'|'new_version'|'gate_ready'|'marked_ready'; projectId: string; forRoles: ProjectRole[]; actor: { name: string; role?: ProjectRole }; title: string (the sentence); target: 'questions'|'findings_changes'; count?: number; createdAt: number; readByRole: Partial<Record<ProjectRole, number>>; seeded?: boolean }`. Additive `this.version(N+1).stores({ notifications: '&id, &dedupeKey, projectId, createdAt' })` where N+1 = current max version + 1 (Projects v1 is 3, so 4; grep first). `purgeNotificationsExpired(db, now)` deletes rows with `createdAt` at or past `PROJECT_RETENTION_MS`, and also rows whose `projectId` no longer exists; called next to `purgeProjectsExpired` in `projects.ts` `load`. Read state is per role so switching View-as shows the right unread count.
- Pure logic `apps/web/src/state/notifications.ts` (no React): `feedFor(all, role, projectsById)` (filters `forRoles.includes(role)`, excludes actor.role === role, sorts newest first), `unreadCount(feed, role)`, `isUnread(n, role)`, `relativeTime(ts, now)` (`now`, `Nm`, `Nh`, `Nd`, `Nw`; under 1 min = "now"), emitter builders: `onAnswers`, `onMemberAdded`, `onNewVersion`, `onGateReady`, `onMarkedReady` each returning `StoredNotification | null` (null when no other role to notify or already deduped). Recipient rules: answers -> analyst + approver (+ advisor); member_added -> the added member's role only; new_version -> all roles except the uploader's current View-as role; gate_ready -> approver; marked_ready -> all roles except approver.
- Store (same file or `state/notifications-store.ts`, zustand): `items`, `loaded`, `load()`, `emit(n)` (persist + dedupe by `dedupeKey`), `markRead(id, role)`, `markAllRead(role)`, `clearForTest`. DB injection like `setProjectsDbForTest`.
- Emitters wired (grep before editing; files may have changed):
  1. answers: after `mergeRemoteAnswers` in `features/counsel/share-flow.ts`/`counsel-share.ts` merge path (`remoteAnswers(sheet)`), compute newly seen answer ids for the active project vs dedupe key; emit one event per batch "<by> answered N questions." Also run on project open (existing sync path), never on counsel-share tabs.
  2. member_added: in `useProjects.create` for every member (actor = "You" / first counsel member name; sentence "<creator> added you to <Project> as <Role label>"). Creator name = the project's first member with role counsel/analyst else "A teammate".
  3. new_version: where a package/document is attached to an existing project that already had docs (`attachDoc` with `docIds.length > 0` before add); N = changes count if the variance summary is available at that point, else omit count ("New version uploaded."). Do not emit on first document.
  4. gate_ready: small hook `useGateNotifier` mounted once in `CounselScreen`/shell reading `view.gate.reasons.length`; emits when it goes from >0 to 0 for the active project (ignore the first read after mount, and ignore not-started). Also update project `summary.gate` is out of scope.
  5. marked_ready: in the Mark ready handler success path (`CounselScreen.tsx` after `markReadyToDigitize`), actor = Approver of project.
- Seeds `features/projects/notification-seed.ts`: `buildSeedNotifications(projects, now)` returns 4 events on the three seeded projects (e.g. Northgate: "Hannah Crane answered 3 questions." 2h ago to analyst/approver; Lotus Bay: "Omar Haddad marked ready..."/"Lotus Bay Asia II is ready for your sign-off." 26h ago to approver; Redwood: "Sara Kim added you to Redwood Ridge Fund I as Digitization analyst." 3d; Northgate: "New version uploaded - 5 changes to review." 1d). Default View-as is Approver, so the Approver feed must show 3 unread on first open. Idempotent insert by `dedupeKey` in `load` next to project seeding; re-created after purge.
- UI `features/notifications/{NotificationBell,NotificationList,NotificationRow}.tsx`, `styles/notifications.css` imported with the other styles. Bell = icon button (`data-testid="notif-bell"`, `aria-label` "Notifications, N unread"), badge coral token, hidden when 0 (keep button). Popover (Radix `@radix-ui/react-popover`, already installed) content `data-testid="notif-popover"`, header `Notifications (N)` + `Mark all read` (`notif-mark-all`, disabled when 0 unread), list of `button` rows `data-testid="notif-row"` with `data-unread`. Row: initials avatar circle (token colors, deterministic per name), sentence, muted project name, relative time right, coral dot left for unread. Empty: "You're all caught up." Row click: `markRead`, close popover, `useProjects.open(projectId)` (works from list or from another project), then after enter set route via `useShell.setRoute('counsel'|'findings')`; for `findings_changes` also set the Changes segment if a store setter exists (grep `variance` segment state), else Findings only. No sound, no toasts.
- Placement: `<NotificationBell />` in `ProjectsPage.tsx` `.pj-head` and in `ProjectContext.tsx` next to `ViewAsSwitch`. Rendered only inside those two, so counsel share mode and E2E default view (no Projects) never show it.
- Tokens only (`process/context/ui/all-ui.md`): no new colors; unread dot reuses the coral/danger token already used for badges.

## Touchpoints

- EDIT `apps/web/src/storage/db.ts` (additive version, table, `purgeNotificationsExpired`)
- NEW `apps/web/src/state/notifications.ts` (+ `notifications.test.ts`)
- NEW `apps/web/src/features/notifications/*` (+ `NotificationBell.test.tsx`)
- NEW `apps/web/src/features/projects/notification-seed.ts` (+ `notification-seed.test.ts`)
- NEW `apps/web/src/styles/notifications.css` (+ import)
- EDIT `apps/web/src/state/projects.ts` (load: purge + seed notifications; create: member_added; attachDoc: new_version)
- EDIT `apps/web/src/features/projects/ProjectsPage.tsx`, `ProjectContext.tsx` (bell)
- EDIT `apps/web/src/features/counsel/share-flow.ts` or `counsel-share.ts` (answers emitter, after merge)
- EDIT `apps/web/src/features/counsel/CounselScreen.tsx` (gate notifier + marked_ready emitter only; no gating change)
- NEW `apps/web/e2e/notifications.spec.ts`
- Existing tests that may need a one-line update: `apps/web/test/package-db-v2.test.ts` (Dexie version assertion), `apps/web/test/no-e2e-hook-in-dist.test.ts` (any new e2e key must be inside the IS_E2E branch).

## Public Contracts

None changed: no core exports, no worker routes, no D1 schema, no API shapes. Dexie schema additive (new table, new version). No new URL/hash fields.

## Blast Radius

`apps/web` only. Risks: (a) Dexie version bump (verify db version tests, and rebase on whichever version Projects v1 ends with); (b) `projects.ts` load/create/attachDoc touched by another agent right now (grep, edit minimally); (c) CounselScreen and share-flow are shared with counsel mode: emitters must be guarded by `activeProjectId` and not run when `isCounselMode()`. Existing specs unaffected because the bell renders only in Projects UI.

## Implementation Checklist

(EXECUTE 15-11-26: items 1-8 and 10 done; item 9 spec written, run status in the REPORT.)

1. Grep the final Projects v1 shape: Dexie max version in `storage/db.ts`, `purgeProjectsExpired` call site, `useProjects` actions, `ProjectContext`/`ProjectsPage` header markup, `share-flow` merge path, CounselScreen gate/mark-ready code. Adjust names below to match.
2. `db.ts`: `StoredNotification` type, additive version, table, `purgeNotificationsExpired`.
3. `state/notifications.ts`: pure helpers (`feedFor`, `unreadCount`, `isUnread`, `relativeTime`, 5 builders) + zustand store with dedupe by `dedupeKey`, per-role read state, db injection for tests.
4. `notification-seed.ts` + wire into `useProjects.load` after seeding (idempotent) and purge.
5. Wire emitters: create (member_added), attachDoc (new_version), answers merge, gate notifier, mark ready.
6. UI: `NotificationBell`, `NotificationList`, `NotificationRow`, `notifications.css`; place in `ProjectsPage` and `ProjectContext`.
7. Row click navigation (open project then route) and focus/Escape behavior.
8. Unit tests (see Verification Evidence).
9. Playwright `notifications.spec.ts` (opt-in `e2e.projects`).
10. Run all gates, fix, confirm `no-e2e-hook-in-dist` green, no emails in notification rows or URL.

## Verification Evidence

Baseline: web unit 692/692 at 4ca0bad plus Projects v1 additions (record the actual count at start of EXECUTE); preview e2e baseline plus Projects v1 specs.

Unit tests (vitest, jsdom, fake-indexeddb or db injection as in `projects.test.ts`):
- `notifications.test.ts`: event store persists and reloads; dedupe (same `dedupeKey` twice = one row; answers batch with same ids = one event); role filter (`feedFor` per role, actor role excluded, member_added only for the added role); unread per role (markRead for approver does not mark counsel); `markAllRead`; `relativeTime` table (now, 5m, 3h, 1d, 6d, 2w); purge at 30 days and orphan project rows; emitters: answers (N and sentence), member_added (role label), new_version (not on first doc, count optional), gate_ready (only >0 to 0, once), marked_ready (all roles except approver).
- `notification-seed.test.ts`: 3-5 events, valid project ids, approver unread = 3 at default role, idempotent, no emails.
- `NotificationBell.test.tsx`: badge shows unread for current role, hidden at 0; popover header "Notifications (N)"; empty state; row click calls open with project id and decrements; Mark all read zeroes; Escape closes; switching View-as changes the list.

Playwright preview (`notifications.spec.ts`, init script sets `e2e.projects`):
1. Bell badge shows 3 on seeded data (Approver) and `notif-popover` rows match.
2. Open popover, click the Northgate row: app shell visible, project context name shown, Questions screen active, badge decreases by 1 after reopening Projects/popover.
3. Mark all read: badge disappears, header shows "Notifications (0)", rows have no unread dot.
4. View as Legal counsel changes the feed (different rows or count); switching back restores Approver feed.

## Resume and Execution Handoff

Resume at the first unchecked checklist item. Selected plan is this file only. Execute = opus; no commit, no deploy, no push (autopilot policy). Do not use git stash/checkout/reset. Projects v1 files are being edited by another agent: grep current code before each edit and keep edits minimal and additive.

## Validate Contract

Date: 15-11-26
date: 2026-11-15
generated-by: outer-pvl
Gate: PASS

Layer 1: Infra fit PASS (web-only, no worker/D1/core); Test coverage PASS (vitest + preview e2e exist, patterns in projects.test.ts and projects.spec.ts); Breaking changes PASS (additive Dexie version, bell only in Projects UI so existing specs unaffected); Security surface PASS (no auth claimed, names not emails in rows, no URL data, 30 d purge).
Layer 2: storage PASS; pure logic/store PASS; emitters PASS with note: wiring sites are read from Projects v1 shape that may still change (E1); UI PASS; e2e PASS with note: row-click route assertion needs the project to finish entering (poll like `enterSeeded`) (E5).

Execute-agent instructions:
- E1 Grep before editing: Dexie max version, `useProjects` actions, header files, share-flow merge path, CounselScreen gate/ready code. Adjust names; do not skip an emitter.
- E2 Any new e2e key string must live inside an `IS_E2E` branch (reuse existing `e2e.projects` opt-in; add none).
- E3 No `--` token in pnpm commands; one token per `test` call.
- E4 No D1, worker or core changes; if needed, stop and report.
- E5 In e2e, poll for `project-context-name` and the active route before asserting; seeded entry opens the demo package dialog first.
- E6 Emitters must be guarded: only when `activeProjectId` is set and `!isCounselMode()`; never throw into the host flow (catch and ignore).
- E7 Update the Dexie version assertion in existing db tests only if it fails because of the new version.

Test gates (run from repo root, in order):
1. `pnpm --filter @aduin/web typecheck`
2. `pnpm --filter @aduin/web test` (full web unit; expect baseline + new, all green)
3. targeted unit tokens, one per call: `pnpm --filter @aduin/web test notifications` ; `pnpm --filter @aduin/web test notification-seed` ; `pnpm --filter @aduin/web test NotificationBell` ; `pnpm --filter @aduin/web test projects` ; `pnpm --filter @aduin/web test package-db-v2` ; `pnpm --filter @aduin/web test no-e2e-hook-in-d`
4. `pnpm --filter @aduin/web test:e2e notifications` (targeted new spec)
5. `pnpm --filter @aduin/web test:e2e projects` (Projects v1 spec still green)
6. `pnpm --filter @aduin/web test:e2e` (full preview; baseline plus new, 1 opt-in skip)
7. `pnpm lint`
8. `pnpm typecheck`

Known gaps: real server polling for answers (derived only on merge/open), per-user server read state, delete/clear notifications, preferences, "What's new", live stack check (backlog). Tier: fully-automated.

## Acceptance Criteria

- AC1 Bell with unread badge on Projects page and inside a project; badge counts unread for the current role only.
- AC2 Popover matches the target: header "Notifications (N)" + Mark all read, avatar, sentence, project subtitle, relative time, unread dot; empty state.
- AC3 Row click marks read and opens the project at Questions (answers, ready, sign-off) or Findings/Changes (new version).
- AC4 Five events emit once each (deduped), never to the acting role; View as switch changes the feed.
- AC5 Seeded demo shows 3 unread for Approver on first open; no email or notification data in URL; counsel share mode and existing specs unaffected; all gates green.

## Phase Completion Rules

CODE DONE only after checklist done; VERIFIED only when every test gate above is green and the plan reconciled.

Next: ENTER EXECUTE MODE for this plan (standing consent granted under autopilot).

## Deviations

- `StoredNotification` gained optional `answerKeys?: string[]` so the next answers batch counts only new answers (dedupe by sorted-set hash alone would re-announce old answers). Within blast radius (Dexie row field, no index).
- `member_added` dedupe key uses the member index (`member:<projectId>:<index>`) instead of the email, so no email is stored outside the projects table.
- `new_version` omits the change count (no variance summary at `attachDoc` time); sentence "New version uploaded."
- Seed Redwood event actor is "Tom Becker" (Redwood has no counsel member; Sara Kim is the analyst who receives it).
- Bell icon is an inline SVG in `NotificationBell.tsx` (no sprite symbol added); unread dot and badge use `--block-fg` (no coral token exists).
- Row navigation lives in `features/notifications/navigate.ts`: same project = route now; other project = route applied once that project's document reaches `ready`.
- `apps/web/test/variance-store.test.ts` Dexie version assertion 3 -> 4 (E7).
