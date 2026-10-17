---
phase: findings-v2-phase-b
date: 2026-10-18
status: COMPLETE
feature: findings-v2
plan: process/features/findings-v2/completed/findings-v2_18-10-26/findings-v2_PLAN_18-10-26.md
---

# Findings v2 Phase B report

Progress blocks are appended per execute step. Placed by the orchestrator when the harness refused the subagent's write.

## B0.5, B1, B2 (execute agent 1)

### What Was Done

- B0.5: all 20 Phase A tokens passed, one per call; `data-memory-state` already present at `FindingsPanelV2.tsx:107`.
- B1 (9427237): P-11 Expected/Found ids; P-12 memory note kept on the outcome toast (store toast `msg` plus `memoryNotSavedNote`; `state/review.ts` not edited); P-14 "Re-confirm dismissal" bar label; P-15 focus (after save to the next selected row; after Esc or Cancel back to `action-dismiss` via `onCloseAutoFocus`); G9 "Reason: <label>" as one text node; G10 memory tag "New"; G11 prior-decision note and re-confirm sentence (`fmtDate` copied into ExpandedBlock). Tests: panel-ui 22, actions-flow 13, change-expanded 8; typecheck, eslint, prettier pass.
- B2 (cc08373): FindingsScreen aside replaced by `<FindingsPanelV2/>`; `.work` gets `fv2-work`; the J/K effect, `focusRow` and the DismissModal host removed. New fixture `e2e/fixtures/findings-actions.ts`. Repaired `triage-actions` and `app-shell:80`. Gates: typecheck 0 errors; web vitest 524/524 (72 files); e2e triage-actions 3 passed; app-shell 8 passed.

### Plan Deviations

1. The counsel nav badge counts only rows with status `counsel` (blocking accepts reach the counsel sheet but not the badge), so triage-actions keeps "1"; E-B5's wording was wrong on this point.
2. New additive test id `finding-dismissed-reason`.
3. New optional prop `focusAfterClose(saved)` on CloseIssueModal (the panel decides focus; the modal does not read the store).
4. Extra fixture helper `acceptRow` (Ask counsel on blocking rows, Close issue then Real issue otherwise).

### Skipped or Deferred

B3 to B8 and B-deploy. `app-shell:60` (E-B15) is left for B3 together with the zoom seed.

### Notes for later steps

- FindingRow, DismissModal and ChangeRow no longer have any importer (B6 deletes after grep). FindingsScreen line anchors in the plan are now stale.
- Radix calls `onCloseAutoFocus` after `setTimeout(0)`: focus tests wait one macrotask.
- Fixture helpers: `askCounsel` (returns accepted or counsel), `closeAsRealIssue`, `closeWithReason(page, id, code, note?)`, `moveBack`, `openFirstFinding(page, sev?)`, `acceptRow`; each opens the row first.
- D12 toast strings: "Sent to counsel · Counsel questions now", "Closed as a real issue · Gate", "Closed · Gate".

### Forward Preview

Stay green: `findings-v2-panel-ui` (22), `findings-v2-actions-flow` (13), `findings-v2-change-expanded` (8), full web vitest (524), e2e `triage-actions` (3), `app-shell` (8). Dependencies changed: none.

## B3, B4 (execute agent 2)

### What Was Done

- B3 (c20ebc9): DocPane zoom (`useDocZoom(scrollRef, selectedId)`, `style` + `data-dz` on `.docscroll`, `DocZoomControls` after `JumpMenu` in `.docbar`, imported from the zoom barrel). `test/support/mockupCss.ts` gains `findingsV2Css` (all style blocks), `findingsV2Widths` (1280 / 50 / 55 / clamp 40-65 / handle 8, parsed from the mockup script and `.work` grid) and `findingsV2ShadowSelectors`. `gotoApp(page, { zoom })` seeds `ui:v1:doczoom` = manual 100 only when the key is absent (`'fit'` skips). layout-vs-mockup repaired (E-B7, E-B8, E-B16); app-shell:60 ignores the seeded key (E-B15); `.fv2-modal textarea` 14px -> 16px (E-B13).
- B4 (c411972): repair list applied; every touched or importing spec run alone, then the full preview project once.

### Test Gate Outcomes (all exit 0 unless stated)

| Command / token | Result |
|---|---|
| `pnpm --filter @aduin/web typecheck` | 0 errors (after B3 and after B4) |
| `pnpm --filter @aduin/web test` | 72 files / 524 tests (after B3 and after B4) |
| vitest `findings-v2-css-guard` | 25 passed |
| e2e `layout-vs-mockup` | 5 passed (first run 2 failed: vacuous-reset assertion over-strict, filter button covered; fixed) |
| e2e `finding-highlight` / `perf-budget` / `app-shell` | 4 / 4 / 8 passed |
| discovery run of the full preview project (before B4 repairs) | 34 failed, 208 passed, 1 skipped |
| e2e alone, after repairs | a11y-keyboard 5, ai-banners 4, ai-no-duplicates 2, ai-resume 2, counsel-answer 3, counsel-export 3, counsel-gate 4, counsel-sheet 3, fund-two-zero-hidden-zero-repeat 3, gate-pill 5, intake-missing-docs-request-export 2, locator-chip 2, memory-prior-answer 3, metrics 1, provenance 2, sample-zero-calls 4, upload-firm-tagging 4, variance-ai-never-gates 1, variance-answer-record-intent-scope 1, variance-baseline-from-package 3, variance-demo-214-to-7 1, variance-demo-gate-walk 1, variance-gate-two-states 1, variance-intent-human-only 1, variance-owner-override 1, variance-questions-by-owner-export 1, variance-regression-r01 1, variance-two-owner-two-questions 1, variance-no-baseline-errors-only 2, csp-headers 3, dismiss-requires-reason 2, a11y-smoke 1, triage-actions 3, previously-handled-section 4, finding-highlight 4, app-shell 8 |
| `pnpm --filter @aduin/web test:e2e` (full preview, once) | 242 passed, 1 skipped (= baseline); intake-demo-packages did not flake |
| E-B9 boundary diff `832dac1..HEAD` on forbidden paths | empty |

### Repairs

| File | Repair | Rule |
|---|---|---|
| e2e/layout-vs-mockup | panel width = mockup percent x real `.work` width, 1px tolerance, handle 8px; viewport set before load (reload per case); mockup values asserted in the reference test; shadow allow-list `.li.open`->`fv2-row-open`, `.btn.out`->`fv2-btn-outline`, `.pop`->`fv2-zoom-menu`, plus `[aria-invalid=true]` inset (app.html; findings-v2.html has no invalid rule); vacuous `li` `sel` check -> second row `aria-expanded="false"` (the store still selects the first row by default) | E-B7, E-B8, E-B16 |
| e2e/app-shell:60 | localStorage keys exact except the seeded `ui:v1:doczoom` | E-B15 |
| e2e/fixtures/counsel.ts | `markCounsel` = `askCounsel` (accepted on block, counsel otherwise); `markAccepted` = `acceptRow` | E-B5 |
| e2e/fixtures/variance-owners.ts `askOwner` | waits for the row to open, clicks the bar's `action-counsel` | E-B18 |
| e2e/gate-pill | Accept -> `askCounsel` (accepted); toast `Closed · Gate still blocked (N)` | E-B5, D12 |
| e2e/upload-firm-tagging | Accept -> `acceptRow`; memory-not-saved note still in the toast | E-B5 |
| e2e/a11y-keyboard | `tabTo('action-counsel', 120)` (bar after the list) | E-B5 |
| e2e/locator-chip | opens `finding-details`; section number read from the own text nodes of the first `.fv2-sec-h` (the line also holds tags, e.g. `12` + `New` read as `12N`) | E-B17 |
| e2e/counsel-gate | blocking Ask counsel -> reason kind `unanswered` (core: accepted = unanswered), still `data-target=counsel` | E-B5 |
| e2e/variance-gate-two-states:30, variance-demo-gate-walk:92 | unscoped `action-dismiss` | E-B18 |
| e2e/variance-owner-override | unscoped `action-counsel`; after Ask owner waits for `data-status=counsel` and re-opens Tax Status (the panel moves to the next row after an action) before reading its select | E-B18 |

No other spec in the list needed edits (dismiss-requires-reason, a11y-smoke, triage-actions, previously-handled-section, csp-headers, variance-no-baseline-errors-only, finding-highlight passed as is). The ai-*, provenance and sample-zero-calls failures were a product bug (below), not spec edits.

### Product Fixes (v2 files)

1. `styles/findings-v2.css` `.fv2`: fixed 4-row grid replaced by a flex column (`.fv2 > .flist` takes the rest). With the Errors/Changes segment shown the panel has 5-6 children, the list fell into an `auto` row and covered the filter header (filter button unclickable). E-B13 corrective edit.
2. `styles/findings-v2.css` `.fv2-modal textarea` 16px (E-B13).
3. `v2/AccordionRow.tsx`: collapsed AI tag reads `AI` + screen-reader ` suggestion` (old row had sr "AI suggestion."); 9 specs filter rows by that text.
4. `v2/ChangeExpanded.tsx` imports `styles/variance.css`: only `variance/ChangeRow.tsx` imported it, so after B2 the diff, impact and owner styles were missing from the bundle (variance-baseline-from-package: `ins` weight 400). B6 may delete ChangeRow safely now.

### Plan Deviations

1. `findingsV2Css` joins every `<style>` block (the mockup has one today).
2. The invalid-field inset allowance is derived from app.html (`input[aria-invalid=true]`), not findings-v2.html, which has no such rule.
3. layout-vs-mockup test 2 keeps one page and reloads per viewport (the document reopens on reload) instead of new pages; same effect as E-B16.
4. counsel-gate assertion `awaiting_counsel` -> `unanswered`: not in the repair list; follows from E-B5 semantics.
5. Product fixes 1, 3 and 4 above were not predicted by the plan.

### Notes for B5, B6, B7

- After any bar action the panel selects the next row; specs that inspect the acted row must wait for its new `data-status` and re-open it.
- `gotoApp(page, { zoom: 'fit' })` for fit-default cases; a number seeds manual zoom; reload keeps the user's zoom.
- `findingsV2Widths()` / `findingsV2ShadowSelectors()` are available for findings-v2.spec.
- `action-accept` remains only in `components/FindingRow.tsx` (B6 deletes it; then AC-B4 grep is empty). FindingRow, DismissModal, ChangeRow: no importer.
- The style audit does not open the zoom menu; findings-v2.spec can cover it.
- Stack-memory not run in this step.

## B5, B6, B7 (execute agent 3)

### What Was Done

- B5 (06b02ac): new `apps/web/e2e/findings-v2.spec.ts` (8 tests: sticky bar + next row + Undo + Move back; Close issue modal; groups, progress, done state and disabled bar; resize drag/keys/clamp/persist; zoom fit/manual/presets/keys/persist/horizontal scroll; scroll-to-finding centered at 150%; shortcuts J/K/C/X ignored while typing or with the modal open plus focus return; Variance change row owner chip + Ask owner). New `apps/web/src/features/review/v2/findings-v2-store-parity.test.tsx` (7 tests: real `useReview` + real `useReviewView` + real `useFindingActions`, stub memory API; the simulated outcome equals the real post-action question count, gate status, gate reasons and row status, and the toast equals the simulated D12 text).
- B6 (a98ca9c): deleted `components/FindingRow.tsx`, `components/DismissModal.tsx`, `variance/ChangeRow.tsx` (git grep: no importer in apps, scripts or packages). No CSS or helper removed: every helper they used still has another importer, and the old-row CSS lives in `base.css` (forbidden, stays per E-B6).
- B7: full gate table below. `design-probe.spec.ts` edited (d521bd5): findings-v2.html capture with the first row open, app at 1440 and 1024 with zoom 75 / 100 / 150 (new page per variant so the seed and the mount-time panel percent apply), output to this task folder `design-probe/`.

### Test Gate Outcomes (B7; all exit 0)

| Gate | Result |
|---|---|
| 16 Phase A tokens, one per call (action-plan 7, actions-flow 13, change-expanded 8, dedupe 7, groups 5, outcome 8, panel-resizer 5, panel-ui 22, reasons-map 6, shortcut-guard 5, shortcuts-hook 5, width-math 6, css-guard 25, use-doc-zoom 11, zoom-controls 6, zoom-math 7) | 16/16 green, 146 tests |
| `source-guard` / `import-graph` / `tokens-match-mockup` / `severity-label` | 4 / 4 / 1 / 3 passed |
| `pnpm --filter @aduin/web test findings-v2-store-parity` | 7 passed |
| `pnpm --filter @aduin/web typecheck` | 0 errors (after B5, B6, B7) |
| `pnpm exec eslint apps/web/src/features/review apps/web/e2e apps/web/test/support` | 0 problems |
| `pnpm exec prettier --check` (review, e2e, test/support, findings-v2.css) | clean |
| `pnpm --filter @aduin/web test` (full, after B6) | 73 files / 531 tests (524 + 7 store parity) |
| `pnpm --filter @aduin/web test:e2e findings-v2` | 8 passed (first run green) |
| `pnpm --filter @aduin/web test:e2e` (full preview, once) | 250 passed, 1 skipped (242 baseline + 8 new); no flake |
| `pnpm --filter @aduin/web test:e2e layout-vs-mockup` | 5 passed |
| `pnpm --filter @aduin/web test:e2e:stack-memory` (after preview, alone) | 12 passed (= baseline) |
| `DESIGN_PROBE=1 pnpm exec playwright test --project=preview design-probe` (from apps/web) | 1 passed, 8 PNGs |
| `grep -rn "action-accept" apps/web/e2e apps/web/test apps/web/src` | empty (exit 1) |
| E-B9 boundary diff `832dac1..HEAD` on forbidden paths | empty; all changed paths inside E-B6 |

### Design-probe artifacts (Agent-Probe; untracked, about 170-270 KB each, not committed)

`process/features/findings-v2/completed/findings-v2_18-10-26/design-probe/`: `mockup-findings-v2-1440.png`, `mockup-findings-v2-1024.png`, `app-1440-zoom75.png`, `app-1440-zoom100.png`, `app-1440-zoom150.png`, `app-1024-zoom75.png`, `app-1024-zoom100.png`, `app-1024-zoom150.png`.

Judgment (non-blocking, for review):
- Panel width, sticky bar (two equal buttons at the bottom), progress header, chips and group heading match the mockup at both widths; zoom 150 scrolls inside the document area with no page overflow.
- Observation 1: after the row click the whole shell is scrolled up (screen header with Coverage / Memory / Checks is out of view and a grey strip shows under the app). Likely `scrollIntoView({block:'center'})` in `DocPane.tsx` also scrolls outer ancestors. Not changed here (DocPane scroll effect is pre-existing; worth a look in review).
- Observation 2: "Question for counsel" shows two disclosure markers (native `details` marker plus the icon).
- Observation 3: the severity line icon touches the text ("Blocks digitization" has no gap after the icon) and the reading view at 100% has no visible 700px page frame (the mockup shows a white page on grey).

### Product Fixes

None in this step.

### Plan Deviations

1. Extra commit d521bd5 for the design-probe spec edit (the task asked to commit it; the plan's step list has no commit name for it).
2. design-probe no longer captures `app.html` or width 1199; it now captures `findings-v2.html` and the zoom variants (E-B6/N6 scope). The old output folder under `subdoc-qa-mvp_17-10-26` is no longer written.
3. Store parity drives the real hooks (`useReviewView`, `useFindingActions`) instead of only the store, so it also proves the toast text.

### Forward Preview

- Stay green: web vitest 531 (73 files); preview e2e 250 + 1 skip; stack-memory 12; findings-v2 e2e 8; store parity 7.
- Blast radius: unchanged (E-B6 paths only).
- Next: B8 EVL (vc-tester re-run of this table) and code review, then UPDATE PROCESS; B-deploy after both. A stack-memory run overwrote the web bundle output: the deploy recipe must re-make the plain bundle right before deploy (as planned).
- Dependencies: none changed.

## B7 follow-up: visual fixes (18-10-26)

Compared design-probe PNGs with `mockup-findings-v2-1440.png`; fixed 5 defects (all within the E-B6 edit set; base.css untouched).

1. App shell scrolled on row click / J (root cause): the visually hidden `.sr` spans in the rows are `position: absolute` with no positioned ancestor inside the scrollers, so they hung off the viewport and made the page 1083px tall on a 900px viewport; `scrollIntoView` then scrolled `html` by 48px (header gone, grey strip). Fix: `.work.fv2-work { position: relative; overflow: hidden }` plus `position: relative` on `.flist` and `.docscroll[data-dz]`. New e2e (zoom 100 and 150): after row click + J, html/body/.app scrollTop and `window.scrollY` are 0, the header is in view, the mark is inside `.docscroll`. Red before (48), green after.
2. Question for counsel: native marker hidden, one chevron that rotates on open, mockup summary type (14px ink + grey hint), serif question text; auto-open rule (blocking or A/B) unchanged; the card grows (the list scrolls).
3. Severity line: new `fv2-sevline` flex row with 8px gaps between icon, label, location and tags (class kept alongside `fv2-sec-h`, text nodes unchanged for locator-chip spec).
4. Paper: `.docscroll[data-dz] .paper` now sets white background, 1px step border and `margin: 0 auto`, so the page is a framed, centered card on the grey area (no shadow: layout-vs-mockup bans shadows).
5. Progress: counts moved into the progress row (one row); "To review N" label on the chips row with chips + Filter right-aligned; the To review group heading is visually hidden (still read by screen readers, tests unchanged). Variance segment and no-baseline line stay between.

Gates: tsc 0; web vitest 73 files / 531 tests; `test:e2e findings-v2` 10/10; layout-vs-mockup 5/5; design probe refreshed; full preview e2e 252 passed + 1 skip (first full run had 2 parallel flakes in intake-demo-packages and memory-ui-decisions, both green in isolation and in the second full run).

Residuals: at 100% on 1440 the 700px page is wider than the reading area, so no grey margin shows (mockup default is Fit width 90%); at 150% the doc auto-scrolls horizontally to the mark, hiding the page left edge; counts keep the " · " separators (pinned by e2e) where the mockup uses spacing only; mockup's "Section 3" right-aligned location on the row title is not in the app.

## Code review fixes (18-10-26, commit 4c39a5a)

| Item | Outcome | Note |
|---|---|---|
| R1 | fixed | Bar and C/X act on the row from the visible v2 list (`flat`); filtered-out or Previously handled selection = "nothing open". Unit (2) + e2e |
| R2 | fixed | Row-state selectors retargeted to `.fv2-rowb[data-...]`; css-guard checks attributes per element class |
| R14 | fixed | `[data-action='move-back']`; `.fv2-group[data-count='0'] .fv2-group-h` |
| R3 | fixed | Dismiss selects `nextToReview` like the other actions; unit + store-parity |
| R5 | fixed | Note field hidden when "Real issue" is chosen |
| R6 | fixed | Recenter only after a user zoom action, not area-driven fit recomputes; unit (2) |
| R8 | fixed | Bar buttons `aria-disabled` while busy and ignore clicks; focus moves to the selected row after bar/C/X; e2e |
| R9/R10 | fixed | Store errors caught -> toast "Could not save. Try again."; actions resolve boolean; modal closes only on a real save |
| R12 | fixed | Selection moves only if the analyst did not pick another row during the call (selectSeq) |
| R13 | fixed | Toast text/Undo reused only from the toast this action produced (id check) |
| R17 | fixed | Shift added to the shortcut ignore list |
| R18 | fixed | `aria-valuemax` >= 1 |
| R4 | accepted | Dismissed hidden from Closed under default filter (P-7, design-approved) |
| R7 | accepted | Cmd/Ctrl zoom keys per D15 |
| R11, R15, R16, R19, R20, cleanup list | backlog | Unchanged per orchestrator |

Gates: web vitest 73 files / 544 tests; typecheck clean; findings-v2 e2e 11/11; layout-vs-mockup 5/5; full preview e2e 253 passed + 1 skip.

## B-deploy (18-10-26)

- Commit deployed: `4c39a5a` (main). Static assets only; no migration, no route, no custom domain, workers.dev only.
- New live version: `7db9e602-a688-4559-ae2d-d69892c873be` (100%, CF API deployments list, created 2026-10-17T22:25:28Z).
- Previous version / only rollback target: `d9aaddd9-a62f-4850-8ff2-89889c8ef652` (re-checked live right before deploy). `8a82ead2` and older stay forbidden (schema 6).
- Pre-deploy: `pnpm guard:cf` OK, `pnpm secrets:scan` OK, port 4317 freed. Site key read from the live bundle: exactly 1 distinct match (E-B19), passed inline from a scratch script, never printed. Plain web bundle made right before deploy.
- `deploy:preflight`: 13/13 PASS (site key compiled in, no e2e hook marker, `_headers` with CSP, no routes/zone keys).
- Live checks: `/api/health` 200 `{ok:true}` with `cache-control: no-store`; title and brand "Preflight"; sample #1 (Franklin Lexington) opened from the picker shows 18 findings in about 3 s with no Turnstile wait; `findings-column` and sticky `action-counsel` present; document zoom controls present (- / 90% / + / Fit width); 0 console errors; only API call was `GET /api/quota` (0 AI, 0 OCR, $0).
- Rollback: not needed.
