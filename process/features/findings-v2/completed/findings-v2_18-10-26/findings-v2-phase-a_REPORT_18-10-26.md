---
phase: findings-v2-phase-a
date: 2026-10-18
status: COMPLETE
feature: findings-v2
plan: process/features/findings-v2/completed/findings-v2_18-10-26/findings-v2_PLAN_18-10-26.md
---

# Findings v2 - Phase A report (early new-file slice)

Written by the orchestrator verbatim from the serial-verify execute agent's report (the harness refused the subagent's file write; same pattern the user approved for the plan files).

## What Was Done

- A1 (9e866f2): pure logic modules (types, reasons-map, groups, action-plan, outcome, dedupe, width-math, shortcut-guard, zoom-math) and 8 unit tests.
- A2-UI (7a0d172): 18 source files and 5 jsdom tests under `apps/web/src/features/review/v2/`.
- A2-ZOOM (597c9cf): zoom hook, controls, barrel and 3 tests under `apps/web/src/features/review/zoom/`, plus `apps/web/src/styles/findings-v2.css`.
- A3 fix: `zoom/findings-v2-css-guard.test.ts` class cross-check now scans every string and template-literal piece (a token followed by `${` is skipped as a prefix); `fv2-sev` only appears in a template literal. CSS unchanged.

## Test Gate Outcomes

| Group | Token | Tests |
|---|---|---|
| Regression | source-guard | 4 |
| Regression | import-graph | 4 |
| Regression | tokens-match-mockup | 1 |
| Regression | severity-label | 3 |
| A1 | findings-v2-action-plan | 7 |
| A1 | findings-v2-groups | 5 |
| A1 | findings-v2-outcome | 8 |
| A1 | findings-v2-dedupe | 7 |
| A1 | findings-v2-reasons-map | 6 |
| A1 | findings-v2-shortcut-guard | 5 |
| A1 | findings-v2-width-math | 6 |
| A1 | findings-v2-zoom-math | 7 |
| UI | findings-v2-actions-flow | 11 |
| UI | findings-v2-shortcuts-hook | 5 |
| UI | findings-v2-panel-ui | 18 |
| UI | findings-v2-change-expanded | 8 |
| UI | findings-v2-panel-resizer | 5 |
| Zoom | findings-v2-use-doc-zoom | 11 |
| Zoom | findings-v2-zoom-controls | 6 |
| Zoom | findings-v2-css-guard | 25 |

- `pnpm --filter @aduin/web typecheck`: clean. eslint on v2/ and zoom/: clean. prettier --check on v2/, zoom/, styles/findings-v2.css: clean.
- Full `pnpm --filter @aduin/web test` once: exit 0, 71 files, 515 tests, no unhandled rejections (above the 375 baseline: new tests plus Variance additions on main).

## Boundary proof

1. Locked-path `git diff --name-only HEAD -- <locked paths>`: empty.
2. `git status --short -- apps/web/src` before commit: only `??` under features/review/v2, features/review/zoom, styles/findings-v2.css; after commit: empty.
3. `git show --name-only --format=`: 9e866f2 = 17 paths (v2/ + zoom/); 7a0d172 = 23 paths (v2/); 597c9cf = 6 zoom/ paths + styles/findings-v2.css.

## Plan Deviations (all inside planned files; none touches a hard-stop area)

- A1: extra exports `hasRecordedAnswer`, `BarState`, `OTHER_NOTE_REQUIRED`; 8 A1 tokens, not 9 (the ninth, css-guard, belongs to A2-ZOOM).
- Zoom: `width` + `max-width` on the page so it scrolls sideways above fit width (D15); zoom keys ignored while a dialog is open; no recenter on the first measurement; own test stubs; preset ids `zoom-preset-{p}`; modal shadow variable also on `.fv2-modal` (modal portals outside `.fv2`); two literal `rgb()` values outside `.fv2` vars (zoom menu shadow, AI tag root colours) because zoom controls live in `.docbar`.
- UI: (1) test-helpers extra exports `fv`, `changeFv`, `makeView`, `ViewOpts`; (2) use-ask-owners exports `metaFor`, `AskOwners`; (3) `closeTitle(row)`, `MOVE_BACK_ANSWERED`; (4) `GroupedList` takes `empty` and optional `twins`, `KindSegment` takes `counts`; (5) group test ids `group-review|sent|closed` on `li.fv2-group`, all groups in one `ul[data-testid=findings-list]`, empty groups not rendered, groups not collapsible; (6) status tags Counsel / Owner / Closed per mockup `chipFor`; (7) `finding-memory-tag` kept in ExpandedBlock; (8) reuses global `btn`, `modal`, `dform`, `reasons`, `fkind`, `fhead` classes; (9) radios `name="close-reason"`, save button "Close issue"; (10) `busy` in component state, double-click guard ref.
- A3: css-guard string/template-literal scan.

## Open design questions

- P-7: dismissed findings are hidden from Closed by the default `active` filter.
- P-10: "Real issue" is hidden on change rows (an accepted change row still gates).
- Non-blocking Ask counsel / Real issue turns the gate to "blocked (1)" in the outcome toast; this is the real gate behavior (a counsel question waits for an answer).

## What Was Skipped or Deferred

- No Playwright, builds or deploys in Phase A.
- AC-5, AC-6, AC-8, AC-16 proven only in jsdom until Phase B browser evidence.
- Manual keyboard and screen-reader pass: known gap.
- Dedupe not wired until Phase C.

## Test Infra Gaps Found

- zsh does not split a `$VAR` path list for a multi-path `git commit -- <paths>`; use bash (`bash -c`) or literal paths.

## Closeout

Keep the plan in active. Next: vc-tester EVL, then UPDATE PROCESS for Phase A (no archive), then wait for the Variance P05 close message before Phase B Step 0.

## Forward Preview

- Must stay green: the 20 tokens above, typecheck, eslint and prettier on the new paths, full web suite (71 files / 515 tests at Phase A close).
- Planned files changed beyond the Phase A table: none. Dependencies changed: none.
