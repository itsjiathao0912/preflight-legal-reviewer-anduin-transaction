---
phase: notifications-v1-execute
date: 2026-11-15
status: COMPLETE_WITH_GAPS
feature: projects
plan: process/features/projects/active/notifications-v1_15-11-26/notifications-v1_PLAN_15-11-26.md
---

# Notifications v1 - EXECUTE report

## What Was Done
- Dexie version 4 (additive) `notifications` table, `StoredNotification`, `purgeNotificationsExpired` (30 days + orphan projects).
- `apps/web/src/state/notifications.ts`: feed/unread/relative-time helpers, 5 emitters, zustand store (dedupe by `dedupeKey`, per-role read state, db injection), `emitSafe`.
- Seeds `features/projects/notification-seed.ts` (4 events; Approver 3 unread), loaded from `useProjects.load`.
- Emitters wired: create (member_added), attachDoc (new_version), `applySheet` (answers), CounselScreen gate notifier (gate_ready) and Mark ready (marked_ready). All guarded (project view, not counsel mode, never throw).
- UI: `features/notifications/{NotificationBell,NotificationList,NotificationRow,navigate}`, `styles/notifications.css`; bell in `ProjectsPage` `.pj-head` and `ProjectContext`.

## What Was Skipped or Deferred
- Full preview e2e (gate 6) not run per orchestrator instruction (pre-existing F7b failures).
- new_version change count not shown (no variance summary at attach time).

## Test Gate Outcomes
1. web typecheck: PASS
2. web unit full: 738/738 PASS (baseline 714 + 24 new)
3. targeted: notifications 14, notification-seed 4, NotificationBell 6, projects 26, package-db-v2 2, no-e2e-hook-in-d 2 - all PASS
4. e2e notifications: 4/4 PASS (twice; one earlier run failed while another agent rebuilt on the shared port, then green)
5. e2e projects: 4/4 PASS
6. full e2e: SKIPPED (instruction)
7. pnpm lint: 4 errors, all pre-existing in scripts/src/bench/bench-defects.ts; touched files lint-clean
8. pnpm typecheck: PASS

## Plan Deviations
See plan `## Deviations` (answerKeys field, index-based member dedupe key, no count on new_version, Redwood seed actor, inline bell SVG + `--block-fg` dot, navigate.ts helper, variance-store version assertion 3->4).

## Test Infra Gaps Found
- Port 4317 shared between agents; concurrent builds can make a preview run test a stale/mutating dist.

## Closeout Packet
Selected plan above. Code done; unit + targeted e2e green. Remaining: full e2e (known F7b), UPDATE PROCESS. Classification: Ready for UPDATE PROCESS archival (after orchestrator EVL).

## Forward Preview
### Test Infra Found
vitest node env + fake-indexeddb with `setNotificationsDbForTest`; e2e opt-in `e2e.projects`.
### Blast Radius Changes
apps/web only; Dexie now version 4.
### Commands to Stay Green
`pnpm --filter @aduin/web test notifications`, `test NotificationBell`, `test notification-seed`, `test:e2e notifications`, `test:e2e projects`.
### Dependency Changes
None.
