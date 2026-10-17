---
phase: findings-v2-program-closeout
date: 2026-10-18
status: COMPLETE_WITH_GAPS
feature: findings-v2
plan: process/features/findings-v2/completed/findings-v2_18-10-26/findings-v2_PLAN_18-10-26.md
---

# Findings v2 - program closeout (18-10-26)

TL;DR: Findings v2 shipped and is live (Worker version 7db9e602, assets only). Phase A and B are verified; Phase C was dropped (P-16). D11 ("AI agrees") is descoped and D13 (flag passage) is backlog. All developed-behavior criteria are met by passing automated gates; the remaining gaps are non-blocking and listed with backlog pointers.

## What Was Done

- Phase A (9e866f2, 7a0d172, 597c9cf): new self-contained module `apps/web/src/features/review/{v2,zoom}` plus `apps/web/src/styles/findings-v2.css`, unmounted, with pure logic and unit tests.
- Phase B (9427237, cc08373, c20ebc9, c411972, 06b02ac, a98ca9c, d521bd5, 2517fc3, 4c39a5a): v2 fixes P-11..P-17, FindingsScreen now mounts `FindingsPanelV2`, document zoom with Fit width, `findings-actions` e2e fixture and repaired specs, `findings-v2.spec` plus store parity, dead code removed (FindingRow, DismissModal, ChangeRow), design probe, layout polish, code review fixes R1-R3, R5, R6, R8-R10, R12-R14, R17, R18.
- Deploy: LIVE Worker `aduin-transaction-web` version `7db9e602-a688-4559-ae2d-d69892c873be` from main 4c39a5a. Assets only, preflight 13/13, `/api/health` 200 no-store, 0 AI, 0 OCR, $0. Rollback chain 7db9e602 -> d9aaddd9 -> (8a82ead2 write-incompatible with schema 6) -> b04f1a8c -> 3d2c7301.

## Design D1-D15 outcome

| Design | Outcome |
|---|---|
| D1 two-button sticky bar, D2 reason modal, D3 bar behavior, D4 resizable panel, D5 one-line rows, D6 expanded block, D7 no "Show in document", D8 groups and progress, D9 severity chips and filter, D10 calm palette, D12 outcome toast with Undo, D14 shortcuts, D15 zoom | Shipped and proven (AC-1..11, 13, 15..20) |
| D11 "AI agrees" | Descoped (P-16): core dedupe already removes AI twins. Pure module stays unmounted. Backlog `findings-v2-ai-agrees-dedupe_NOTE_18-10-26.md` |
| D13 flag passage, suggest wording | Not built; needs its own SPEC and PLAN. Backlog `findings-v2-step3-flag-passage_NOTE_18-10-26.md` |

## What Was Skipped/Deferred

- Phase C dedupe hookup (dropped, P-16).
- Review items R11, R15, R16, R19, R20, the cleanup list and residual visual diffs: `process/features/findings-v2/backlog/findings-v2-review-followups_NOTE_18-10-26.md`.
- D15 amendment (design, 18-10-26): Fit width clamp 60-175%; if 60% still overflows, the area scrolls horizontally from the left edge; never clip under the panel. Manual range is now 60-200 in 10% steps (one floor for fit and manual, so - from a 60% fit is a no-op and + goes to 70; presets unchanged 75/90/100/125/150).
- Accepted as designed: R4 (dismissed hidden from Closed under the default filter, P-7), R7 (Cmd/Ctrl zoom keys per D15).

## Test Gate Outcomes (EVL re-run at 4c39a5a, all green)

- 9 targeted vitest tokens, one per call; web typecheck clean.
- `pnpm --filter @aduin/web test`: 544 tests, 73 files.
- `test:e2e findings-v2`: 11 passed; layout-vs-mockup 5/5.
- Full preview e2e: 253 passed + 1 opt-in skip; stack-memory 12.
- `grep -rn "action-accept"` over e2e, test, src: empty. Commit paths in scope.

## Plan Deviations

- P-16: Phase C dropped (see above). P-11..P-15, P-17 fixed before mount.
- E-B5 wording error: the counsel nav badge counts only `counsel` status rows; triage-actions keeps "1".
- Harness refused several subagent file writes (plan creation and some report progress blocks); the orchestrator placed the agent-drafted plan, decision, NOTE and report texts with user approval. Substance is the agent's draft.

## Test Infra Gaps Found

- Intake package lens a11y: serious `label-content-name-mismatch` (4), pre-existing, in Intake backlog.
- Design probe is opt-in (skipped by default); manual keyboard and screen-reader pass not done.
- Two parallel e2e flakes seen once in a full run (intake-demo-packages, memory-ui-decisions), green in isolation and on re-run.

## SPEC Achievement

No locked `*_SPEC_*.md` exists for this plan; design NOTES D1-D15 and AC-1..AC-20 in the plan are the scored criteria. Met by passing gates: AC-1..11, 13, 15..20. Unmet (descoped, not developed): AC-12 (D11) and AC-14 (D13), each with a backlog stub. No developed behavior rests on a Known-Gap.

## SPEC Gaps

- AC-12 / D11: backlog `findings-v2-ai-agrees-dedupe_NOTE_18-10-26.md`.
- AC-14 / D13: backlog `findings-v2-step3-flag-passage_NOTE_18-10-26.md`.

## Closeout Packet

1. Selected plan: `process/features/findings-v2/completed/findings-v2_18-10-26/findings-v2_PLAN_18-10-26.md` (was in `active/`).
2. Classification: Ready for UPDATE PROCESS archival (archived).
3. Finished: Phases A and B, live deploy; Phase C dropped.
4. Verified: gates above and a live smoke (sample #1 shows 18 findings in about 3 s, sticky bar and zoom controls present, 0 console errors). Unverified: manual keyboard and screen-reader pass.
4b. Validate-contract: present (Phase A outer-pvl PASS, Phase B inner-pvl PASS).
5. Cleanup: context docs, backlog note and archive done in this closeout commit. Remaining: none blocking.
6. Next valid state: no next phase. Optional: operator keyboard/SR pass, then pick up the backlog notes.
7. Commit: process commit (this closeout); code commits already made. No push.
8. Regression: full preview e2e 253 + 1 skip and stack-memory 12 re-run at 4c39a5a; Variance surfaces preserved inside v2 (AC-20 green).
9. SPEC achievement: see above.

Drift score: HIGH (5 signals: more than 10 files touched, 3+ memory-worthy observations, new backlog notes and archived folder, plan deviation P-16 and writes placed by orchestrator). Strongly recommend UPDATE PROCESS -- harness/protocol files touched. (No harness or protocol files were actually edited; the band wording is mechanical.)

## Forward Preview

#### Test Infra Found
`apps/web/e2e/fixtures/findings-actions.ts` helpers; `gotoApp(page,{zoom})` seed; design probe now captures findings-v2.html and zoom 75/100/150.

#### Blast Radius Changes
Added `features/review/{v2,zoom}`, `styles/findings-v2.css`; deleted FindingRow, DismissModal, ChangeRow; FindingsScreen and DocPane edited; no Worker, core, schema or route change.

#### Commands to Stay Green
`pnpm --filter @aduin/web typecheck`; `pnpm --filter @aduin/web test` (544); `pnpm --filter @aduin/web test:e2e` (253 + 1 skip); `pnpm --filter @aduin/web test:e2e:stack-memory` (12, never with preview).

#### Dependency Changes
None.
