---
name: plan:findings-v2
description: "Findings v2 (design NOTES D1-D15): sticky action bar, reason modal, accordion groups with progress, resizable panel, document zoom, shortcuts, then dedupe. Phase A new files now, Phase B integration after Variance P05, Phase C dedupe hookup"
date: 18-10-26
feature: findings-v2
metadata:
  node_type: memory
  type: plan
  feature: findings-v2
---

# Findings v2 - Implementation Plan (Phases A, B, C)

**Date**: 18-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED (Phase A ready to execute after VALIDATE; Phases B and C gated)
**Feature:** findings-v2 (`process/features/findings-v2/`)
**Decision record:** `findings-v2_DECISION_18-10-26.md` (D-1..D-10, locked; cited, not redefined)
**Research:** `findings-v2_RESEARCH_18-10-26.md` (file:line evidence)
**Design source (read-only):** `design/mockups/findings-v2.html`, `design/mockups/findings-v2_NOTES.md` (D1-D15)
**Context routers read:** `process/context/all-context.md`, `process/context/ui/all-ui.md`, `process/context/tests/all-tests.md`, `process/context/planning/all-planning.md`, `process/context/worker/all-worker.md` (deploy recipe only).
**Next Step:** ENTER VALIDATE MODE for this plan, then ENTER EXECUTE MODE for Phase A only.

---

## Overview

TL;DR: Build the approved Findings v2 redesign as a new, self-contained module, in three gated phases. Phase A (new files only) can run today. Phase B (the swap into Variance-locked files) waits for Variance P05 to close. Phase C (AI duplicate merge) is its own later commit.

Goal: the analyst sees what a click really does (outcome toast with Undo), uses two honest buttons in one sticky bar, works through an accordion list grouped as To review / Sent to counsel / Closed with a progress header, drags the findings panel between 40 and 65 percent, zooms the reading page like Google Docs (Fit width by default), and uses J/K/C/X. Duplicate AI suggestions merge into the rule finding they repeat (Phase C).

Non-goals (this plan): "Flag this passage" and "Suggest wording" (step 3, backlog stub `process/features/findings-v2/backlog/findings-v2-step3-flag-passage_NOTE_18-10-26.md`); any core, Worker, migration or store change; new screens or sidebar items; live LLM calls; `ScanPane` zoom; memory-write changes (NOTES Q1 stays open).

## Hard Rules (verbatim scheduling constraints)

1. **Phase A touches ONLY new files:** `apps/web/src/features/review/v2/**`, `apps/web/src/features/review/zoom/**`, `apps/web/src/styles/findings-v2.css`, and new unit tests (`apps/web/test/findings-v2-*.test.ts(x)` or co-located). It must NOT edit: `features/review/{FindingsScreen.tsx, components/DocPane.tsx, model.ts, use-review-view.ts}`, `state/{review.ts, package.ts, last-doc.ts, storage.ts}`, `styles/{base.css, tokens.css, index.css}`, `shell/GateButton.tsx`, `features/{counsel/*, gate/*, compare/*, ai/*, registry.ts, variance/*}`, `App.tsx`, `e2e-hook.ts`, `engine/*`, `storage/db.ts`, `test/import-graph.test.ts`, any e2e spec or fixture. Imports from those files are allowed (read-only). No new `@aduin/core` value imports beyond the ALLOWED list. No hex colors in `features/*` (source-guard). Phase A gates: vitest only (`pnpm --filter @aduin/web test <token>` per new file, plus `pnpm --filter @aduin/web typecheck`, which exists in `apps/web/package.json`, plus the existing `source-guard`, `import-graph`, `tokens-match-mockup` tests as regression tokens). No Playwright, no builds, no deploys in Phase A.
2. **Phase B starts only after the Variance session messages that P05 is closed.** Playwright runs serially on port 4317. Bash command text must not contain "build", "dist" or "node_modules" (kit hook): gate commands use package scripts and `pnpm exec` (see Verification Evidence). Where the recipe needs a production bundle, write the command into a scratch shell file with the Write tool and run that file (all-tests.md "Hard rules": the hook sees only the script path).
3. **Commits:** local on `main`, pathspec-only `git add <paths>`, conventional prefixes (`feat|fix|docs|spec|process|phase|chore|refactor|test`), trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No push. Never `git stash`, `git checkout`, `git reset` or `git restore` (shared checkout with parallel sessions). Never `git add -A` or `git add .`.
4. **Product rules:** no new screens or sidebar items; render-first preserved (findings appear without waiting for Turnstile); no live LLM calls; one view of Findings (v2 replaces, never coexists behind a flag).
5. **Deploy** (end of Phase B or C, only after EVL and code review): only `https://aduin-transaction-web.giathaowork.workers.dev`, via `pnpm --filter @aduin/scripts deploy:preflight` and a fresh plain web bundle with `VITE_TURNSTILE_SITE_KEY` inline (public site key, per command, never exported or committed). Re-read the live version first as the rollback target (`wrangler rollback <version>`); coordinate with the hotfix session; never touch zone `itsjiathao.com` (id `894bc9f93640fab260bf1580b5b48cb7`). Recipe: `process/context/worker/all-worker.md` section "Deploy Rules And Redeploy Recipe" (`pnpm guard:cf && pnpm secrets:scan`, plain bundle, `deploy:preflight` 13 checks, `wrangler deploy`). Static assets only: the Worker code is not changed by this plan, so the "deploy the Worker before the web bundle (F12)" rule is not triggered, but the Variance Phase 03 rule (never roll back the Worker alone after the web bundle ships) still holds.

## Resolved Open Questions (answers recorded from code and mockup)

| # | Question | Answer |
|---|---|---|
| a | Mockup default panel width | `findings-v2.html` line 1060: `pp = stored fv2:fpp if 40..65, else window.innerWidth >= 1280 ? 50 : 55` (percent of `.work`; clamp 40-65 at line 1061; handle is an 8px grid column). **Default: 50% at viewport width 1280px or more, 55% below.** Product key is `ui:v1:fpw` (D-4), not the mockup's `fv2:fpp`. At 1440 this is about 720px; at 1024 it is about 563px. |
| b | D2 reasons to ReasonCode / DISMISS_REASONS | "Real issue — I'll handle it in the form build" maps to `accept(id)` (modal-only synthetic key `real_issue`, hidden on blocking rows, no `ReasonCode`). "Firm's standard wording" maps to `firm_standard_wording`; "Does not affect the form" to `no_form_impact`; "Tool false alarm" to `tool_false_alarm`; "Other" to `other` (note required, trimmed non-empty). No core change. Label differences from `reasons.ts` `DISMISS_REASONS` ("Law firm's standard wording") are accepted: the design-owned D2 label wins in v2 and `reasons-map.ts` owns the strings; `DISMISS_REASONS` stays untouched. A unit test asserts every non-synthetic key is a member of `REASON_CODES`. |
| c | `.paper` descendants (px sizes) for the `--dz` override | Enumerated in "Zoom CSS override table" below (base.css lines 584-653, 658, 710, 638, 1683-1700, 1753). |
| d | e2e specs scoping `action-*` | See Phase B "Derived repair list". `action-accept` appears in `triage-actions`, `app-shell`, `gate-pill`, `a11y-keyboard` and `fixtures/counsel.ts`; three spec/fixture files scope actions inside `finding-body`: `variance-gate-two-states.spec.ts:30` (`action-dismiss`), `variance-owner-override.spec.ts:48` and `fixtures/variance-owners.ts:41` (`action-counsel`); all three are Variance-owned. |
| e | Test tokens and harness | Vitest `include` is `test/**/*.test.ts` and `src/**/*.test.{ts,tsx}` (vite.config.ts), so **`.tsx` tests must be co-located under `src/`** (a `.tsx` under `apps/web/test/` is never collected). Tokens match by filename substring, one per call: see the token table in Phase A. The jsdom + react-dom harness (no testing-library) is `apps/web/src/test-utils.tsx` `render(ui)` (uses `createRoot` inside `act`); copy the pattern of `apps/web/src/features/package/package-lens.test.tsx` (zustand `setState` seeding, `act`, DOM queries). jsdom has no `ResizeObserver` (tests install a stub). |

### Zoom CSS override table (answer c; px values from `apps/web/src/styles/base.css`)

All values become `calc(<px> * var(--dz))` under `.docscroll[data-dz] .paper ...` in `findings-v2.css`. Base: `.paper` `max-width: 700px; padding: 52px 60px 72px; font: 400 16px/1.72 serif`.

| Selector | Properties to scale (px) | base.css line |
|---|---|---|
| `.paper` | `max-width` 700; padding 52/60/72 (at max-width 1279: 40/36/56; at max-width 767: 24/16/40); font-size 16; `border-radius` stays 4 | 584, 1693, 1753 |
| `.paper h1` | font-size 28; margin-bottom 4 | 593 |
| `.paper .sub` | font-size 16; margin-bottom 36 | 599 |
| `.paper h2` | font-size 17; margin 38/0/10; `scroll-margin-top` 24 | 604 |
| `.paper h2 small` | font-size 15; margin-left 6 | 610 |
| `.paper h3` | font-size 15; margin 20/0/6 | 616 |
| `.paper p` | margin-bottom 13 (`max-width: 62ch` follows font-size, no change) | 621 |
| `.paper .fields` | padding 14/16; font-size 14 | 625 |
| `.paper .opt` | gap 10; font-size 14 | 632 |
| `.box` (inside `.opt`) | width and height 13 | 638 |
| `.paper ol.p` | padding-left 22; margin-bottom 13 | 645 |
| `.paper ol.p li` | margin-bottom 6 (`max-width: 60ch` follows font-size) | 649 |
| `.paper .fold` | font-size 14 | 653 |
| `.paper .mask` (class `.mask` is global) | font-size 14; padding 1/6 | 710 |
| `.paper mark.q` | padding 0/1; `text-decoration-thickness` 2; `text-underline-offset` 3 | 658 |
| `.docscroll` | padding-inline 32 under `[data-dz]` (the fit-width gutter, replaces 24/16); `overflow-x: auto`; `scrollbar-gutter: stable` | 581, 1687 |

Step A0 re-greps `.paper` in every `apps/web/src/styles/*.css` (there is no `scan.css`; E25) and fails the CSS review if a descendant is missing from this table.

## Plan-Level Decisions (additions that do not change D-1..D-10)

- **P-1 Progress counts.** "N of M reviewed" counts `view.main` rows (so "Previously handled (n)" memory-handled rows are excluded), all severities, both error and change rows, independent of chips and the Filter popover (progress must not jump when filtering). N = Sent + Closed, M = To review + Sent + Closed. Flagged for design confirmation; reversible inside `groups.ts`.
- **P-2 Resizer lives inside the panel.** `PanelResizer` renders as an absolutely positioned 8px handle on the left edge of the panel root (`.fv2`), so `.work` keeps two grid tracks (`minmax(0,1fr) calc(var(--fpw)*1%)`). `use-panel-width.ts` sets `--fpw` on `el.closest('.work')`. Phase B adds the static class `fv2-work` to `.work` (declaratively, in the FindingsScreen edit).
- **P-3 Additive Phase A files** needed to make D-9 self-contained: `v2/types.ts` (shared types), `v2/KindSegment.tsx` (re-creation of the All/Errors/Changes segment markup with the same ids `kind-segment`, `kind-all`, `kind-errors`, `kind-changes`), `v2/index.ts` (barrel exporting `FindingsPanelV2`, `useShortcuts`, `useFindingActions`), `zoom/index.ts` (barrel). These sit under the allowed directories.
- **P-4 Dismiss selection.** Dismiss keeps the store's own next-row selection (`review.ts:852`, picks the next visible row, possibly in Sent); accept and needsCounsel select the next To-review row. Accepted divergence per D-3. Note: `dismiss()` returns the next selected id (`Promise<string | null>`), not an error string.
- **P-5 Bar labels for change rows.** The bar shows "Ask owner" and "Mark as expected..." (P04 copy) for change and regression rows, and "Ask counsel" and "Close issue" for rule rows; ids are the same (D-1).
- **P-6 Registry.** The Variance blast-radius registry (`.../variance-mvp_17-10-26/phase-blast-radius-registry.md`) is append-only and Variance-owned. The PLAN session only writes its assigned files, so Phase A's claim (new files only, no seam file) is recorded here; the execute agent appends a `## Findings v2 Phase B` section to that registry at Phase B Step 0 once P05 is closed.

- **P-7 Group counts vs progress (E13, supplement 1).** Group header counts and the rows listed come from `view.visible`; the progress header comes from `view.main` (P-1). Under the default Status filter `active`, dismissed rows are not in `view.visible`, so the Closed group lists only accepted non-blocking rows while the progress "Closed N" counts dismissed ones too. Decision: keep both as specified, do not change the filter; panel tests that assert the Closed group contents seed the filter to `all`; the report records it as a design question (reversible: one line in `groups.ts` callers).
- **P-8 Resizer key step (E12).** Arrow step is 2 (percent) and Shift+Arrow is 10, matching the mockup (`findings-v2.html`), so `FPW_STEP = 2` and `FPW_STEP_BIG = 10` replace the earlier 1 and 5 in `width-math.ts`; Home 40 and End 65 unchanged; the width-math and resizer tests assert 2 and 10.
- **P-9 Reconfirm modal title (E14).** The mockup's Close issue modal title is "Close issue" (`findings-v2.html` line 830) and has no re-confirm state. Decision: title "Close issue" for every row, except `row.label === 'dismissed_reconfirm'`, where it is "Re-confirm this dismissal" (the existing `DismissModal` wording, `DismissModal.tsx:52`), because that state exists only in the product and dropping it would hide why the analyst is being asked again; the submitted call is the same. Tested in `findings-v2-panel-ui`.
- **P-10 Accept on change rows (E24, supplement 2).** `isBlocking` is severity-based, so an ordinary change row counts as non-blocking, but under a variance policy the gate marks every change row `gates: true` and an accepted one `unanswered`. Decision: `groups.ts` adds `gatesReview(r)` (blocking severity or change/variance row); an accepted `gatesReview` row groups to Sent (not Closed) and "Real issue" is hidden in the Close issue modal for such rows; `planControl` keeps routing change rows to Ask owner so the bar never emits `accept` for them. Design question for the report: should "Real issue" (accept) exist on change rows at all (today's `ChangeRow` never accepts)? Reversible inside `groups.ts` and `reasons-map.ts`.

## Architecture Note (data flow)

1. `useReviewView()` (existing) gives `rows`, `main`, `visible`, `gate`, `counts`, `variance`, `regressionMeta`. `FindingsPanelV2({view})` derives `groups = groupRows(view.visible)` and `progress = progressOf(view.main)`.
2. Click on a row calls the store `select(id)` (existing; `selectSeq` triggers `DocPane` scroll and flash, D7). Open state is `selectedId` (one at a time; re-click keeps it open).
3. The bar, or key C/X, calls `planControl(control, selectedRow)`: `ask-counsel` gives `accept` (blocking) or `needsCounsel` (non-blocking; change rows add `{owners, source}`); `close-issue` opens `CloseIssueModal`; `move-back` gives `restore`.
4. `useFindingActions` snapshots the pre-action rows, computes the `Outcome` (simulated status change, `questionRows`, `reviewGate`), awaits the store action, selects the next To-review row (accept/needsCounsel), reads `useReview.getState().toast?.undo`, then calls `showToast(outcome.text, thatUndo)`, replacing the store's own generic toast with the D12 text while keeping its undo.
5. Failure modes: store action rejects (no toast change, selection unchanged, error is not swallowed: the glue rethrows after clearing the in-flight flag); double click (in-flight flag disables the bar); selected row disappears after an action (selection falls to next or null; bar disables); no To-review rows left (select null, done state `findings-done`); change row with no owners (Ask owner disabled, title `CHANGE_OWNER_FIRST`).
6. Rollback: Phase A is additive (delete the new files). Phase B and C are single commits each (revert).

## Interface Contracts (fixed; the logic agent and the UI agent code to these in parallel)

All new modules live under `apps/web/src/features/review/v2/` unless noted. Types import only from existing modules: `Row`, `Triage` from `../model`; `FindingView` from `../../../engine/types`; `ReasonCode` type from `@aduin/core`, `TriageStatus` type from `../gateInterim` (E25: it is not a core export) (type imports are not subject to the ALLOWED list); `OwnerAsk` from `../../../state/review`; `Owner` from the variance module that exports it (`features/variance/owner-groups.ts`; Step A0 confirms the export name).

```ts
// types.ts
export type GroupKey = 'review' | 'sent' | 'closed';
export type Control = 'ask-counsel' | 'close-issue' | 'move-back';
export type CloseReasonKey = 'real_issue' | ReasonCode; // ReasonCode = firm_standard_wording | no_form_impact | tool_false_alarm | other
export type ReviewView = ReturnType<typeof import('../use-review-view').useReviewView>;

// reasons-map.ts
export interface CloseReasonOption { key: CloseReasonKey; label: string; blockingHidden: boolean; noteRequired: boolean }
export const CLOSE_REASONS: readonly CloseReasonOption[]; // order: real_issue, firm_standard_wording, no_form_impact, tool_false_alarm, other
export function closeReasonsFor(row: Row): readonly CloseReasonOption[]; // E24: drops real_issue when gatesReview(row) (blocking severity, or a change/variance row); imports gatesReview from ./groups
export type CloseCall = { call: 'accept' } | { call: 'dismiss'; reason: ReasonCode; note: string };
export function toCloseCall(key: CloseReasonKey, note: string): CloseCall; // real_issue -> accept; trims note
export function closeError(key: CloseReasonKey | null, note: string): string | null; // null key -> DISMISS_REASON_REQUIRED text; other + empty note -> 'Add a note for "Other".'

// groups.ts
export const isBlocking: (r: Row) => boolean; // r.sev === 'block'
export const gatesReview: (r: Row) => boolean; // E24: true for rows whose acceptance the gate still treats as open/unanswered: r.sev === 'block' || r.f.kind === 'change' (change/variance rows). Mirrors features/review/model.ts:174 (every change row is gates:true under a variance policy) and core counsel/gate.ts computeVarianceGate (an accepted change row stays 'unanswered'). isBlocking stays severity-based.
export function groupOf(r: Row): GroupKey; // open -> review; counsel -> sent; accepted -> gatesReview(r) ? sent : closed; dismissed -> closed
export interface Grouped { review: Row[]; sent: Row[]; closed: Row[] }
export function groupRows(visible: readonly Row[]): Grouped; // stable: keeps incoming order inside each group
export function flatOrder(g: Grouped): Row[]; // review, sent, closed
export interface Progress { total: number; reviewed: number; sent: number; closed: number; left: number; done: boolean } // reviewed = sent + closed; left = review; done = total > 0 && left === 0
export function progressOf(main: readonly Row[]): Progress; // P-1

// action-plan.ts
export type Plan =
  | { kind: 'call'; call: 'accept' | 'needsCounsel' | 'restore'; id: string; ask?: OwnerAsk }
  | { kind: 'open-close-modal'; id: string }
  | { kind: 'noop'; reason: 'no-selection' | 'already-acted' | 'not-acted' | 'owner-required' | 'answered' };
export function planControl(control: Control, row: Row | null, ctx?: { ask?: OwnerAsk }): Plan;
//  ask-counsel: row null -> noop no-selection; status !== 'open' -> noop already-acted (never a toggle);
//   change row (f.kind === 'change'): ctx.ask missing or ask.owners empty -> noop owner-required, else call needsCounsel with ask;
//   blocking -> call accept; else call needsCounsel.
//  close-issue: row null -> no-selection; status !== 'open' -> already-acted; else open-close-modal.
//  move-back: row null -> no-selection; status === 'open' -> not-acted; row has a recorded answer (triage.counselAnswer set, or any non-null ownerAnswers value) -> noop 'answered' (restore() would drop the local answer while the memory decision stays); else call restore.
export function barState(row: Row | null): { primary: 'ask-counsel' | 'move-back' | null; closeEnabled: boolean; moveBackEnabled: boolean; labels: { ask: string; close: string } }; // moveBackEnabled is false for an open row and for an answered row
export function nextToReview(flat: readonly Row[], actedId: string): string | null; // flat = flatOrder(groupRows(visible)) BEFORE the action; first review row after actedId, else first review row before it, else null

// outcome.ts
export type OutcomeAction = 'ask-counsel' | 'close-real-issue' | 'close-dismiss' | 'move-back';
export interface OutcomeInput { rows: readonly Row[]; id: string; action: OutcomeAction; ask?: OwnerAsk; reason?: ReasonCode; result: { blocks: readonly unknown[] } | null | undefined; policy: Parameters<typeof reviewGate>[2] }
export interface Outcome { text: string; questionCount: number; gateBefore: 'ready' | 'blocked'; gateAfter: 'ready' | 'blocked'; gateReasons: number; unreadable: boolean }
export function simulateStatus(rows: readonly Row[], input: Pick<OutcomeInput, 'id' | 'action' | 'ask' | 'reason'>): Row[]; // pure copy with the acted row's status and triage changed; it MIRRORS the store's triage shapes (E3): accept keeps prior triage and sets accepted; needsCounsel sets counsel (change-row ask writes ownerAnswers[o] = null per owner); dismiss writes {status:'dismissed', reasonCode} and drops ownerAnswers; restore writes {status:'open'}
export function computeOutcome(input: OutcomeInput): Outcome; // uses questionRows (features/counsel/sheet-model) and reviewGate (features/variance/select)
// Exact texts (separator " · " = space, U+00B7, space):
//  ask-counsel:       "Sent to counsel · Counsel questions now {N} · {GATE}"
//  close-real-issue:  "Closed as a real issue · {GATE}"
//  close-dismiss:     "Closed · {GATE}"
//  move-back:         "Moved back to review · Counsel questions now {N} · {GATE}"
//  {GATE}: unreadable -> "Gate not ready (no text read)"; after blocked and before blocked -> "Gate still blocked ({M})";
//          after blocked and before ready -> "Gate now blocked ({M})"; after ready and before blocked -> "Gate now ready"; ready and ready -> "Gate ready".
//  M = gate.reasons.length after the action; N = questionRows(simulated).length.

// dedupe.ts  (pure; hooked up in Phase C)
export interface DedupeResult { findings: FindingView[]; twins: Record<string, FindingView>; twinOf: Record<string, string> } // twins: primaryId -> ai twin; twinOf: twinId -> primaryId
export function dedupeFindings(findings: readonly FindingView[]): DedupeResult;
//  match: same anchor.blockId, half-open ranges [offsetStart, offsetEnd) intersect (non-empty), same issue_class, one detector_kind 'rule' and one 'ai'.
//  rules claim in input order (E11): each rule, in the order it appears in the input, takes the best still-unused AI finding; rule keeps id and severity; each rule gets at most one twin (largest overlap, tie -> lowest `order`, tie -> lowest id); each ai is used once; unmatched ai stays a separate row; output order = input order minus removed twins. Never merges kind === 'change' rows or two findings of the same detector_kind.
export function triageWithTwins(triage: Readonly<Record<string, Triage>>, twinOf: Readonly<Record<string, string>>): Record<string, Triage>; // primary falls back to triage[twinId] when it has none; never invents keys; writes always go to the primary id (callers use the primary id)

// width-math.ts
export const FPW_KEY = 'ui:v1:fpw'; export const FPW_MIN = 40; export const FPW_MAX = 65; export const FPW_STEP = 2; export const FPW_STEP_BIG = 10; // P-8: mockup parity
export function clampPct(n: number): number; // round then clamp 40..65
export function defaultPct(viewportPx: number): number; // >= 1280 -> 50 else 55
export function readPct(raw: string | null, viewportPx: number): number; // invalid or out of range -> defaultPct (stored value must be an integer 40..65)
export function pctFromPointer(clientX: number, work: { left: number; width: number }): number; // panel is the RIGHT column: clampPct(((work.left + work.width) - clientX) / work.width * 100)
export function pctFromKey(pct: number, key: string, shift?: boolean): number | null; // ArrowLeft widens panel (+2, +10 with shift; P-8), ArrowRight narrows, Home -> 40, End -> 65; other key -> null
// use-panel-width.ts
export function usePanelWidth(): { pct: number; setPct(n: number, persist?: boolean): void; ref: React.RefObject<HTMLElement | null>; min: number; max: number }; // ref attached to the panel root; sets --fpw on closest('.work'); persists via safeSet(FPW_KEY, String(pct)) only when persist is true (pointer-up, key press)

// shortcut-guard.ts
export interface KeyLike { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey?: boolean; repeat: boolean; isComposing?: boolean; target: EventTarget | null }
export function isEditableTarget(t: EventTarget | null): boolean; // INPUT, TEXTAREA, SELECT, [contenteditable]
export function shouldIgnoreKey(e: KeyLike, doc?: Document): boolean; // editable target, ctrl/meta/alt, isComposing, document.querySelector('[role="dialog"]') present (repeat is handled per key in actionForKey)
export type ShortcutAction = 'next' | 'prev' | 'ask-counsel' | 'close-issue';
export function actionForKey(e: KeyLike, doc?: Document): ShortcutAction | null; // j/k (any case) -> next/prev (repeat allowed); c/x -> ask-counsel/close-issue only when !repeat; shouldIgnoreKey short-circuits to null
// use-shortcuts.ts
export function useShortcuts(args: { flat: readonly Row[]; selectedId: string | null; select(id: string | null): void; onControl(c: Control): void; barEnabled(c: Control): boolean }): void; // window keydown only while mounted; preventDefault when it acts; J/K walk flat and stop at the ends (no wrap); C/X call onControl only when barEnabled; after J/K select(id) it focuses the row via requestAnimationFrame + focus({preventScroll:true}) like the old handler (E25 focusRow)

// use-finding-actions.ts (glue; the ONLY v2 module that touches the store)
export interface FindingActions { busy: boolean; ask(id: string): Promise<void>; closeRealIssue(id: string): Promise<void>; closeDismiss(id: string, reason: ReasonCode, note: string): Promise<void>; moveBack(id: string): Promise<void> }
export function useFindingActions(view: ReviewView): FindingActions;

// zoom/zoom-math.ts
export const DOCZOOM_KEY = 'ui:v1:doczoom'; export const PAGE_PX = 700; export const GUTTER_PX = 64; // 2 x 32
export const ZOOM_MIN = 75; export const ZOOM_MAX = 200; export const ZOOM_STEP = 10; export const FIT_MIN = 90; export const FIT_MAX = 175; export const PRESETS: readonly number[]; // 75, 90, 100, 125, 150
export interface ZoomState { mode: 'fit' | 'manual'; pct: number } // pct is meaningful only in manual mode
export function fitWidth(areaPx: number): number; // clamp(round((areaPx - 64) / 700 * 100), 90, 175)
export function effectivePct(s: ZoomState, areaPx: number): number; // fit -> fitWidth(areaPx), manual -> pct
export type ZoomAction = { type: 'in' } | { type: 'out' } | { type: 'preset'; pct: number } | { type: 'fit' };
export function zoomReducer(s: ZoomState, a: ZoomAction, areaPx: number): ZoomState; // in: manual, min(200, (floor(eff/10)+1)*10); out: manual, max(75, (ceil(eff/10)-1)*10) where eff = effectivePct; preset: manual clamp 75..200; fit: {mode:'fit', pct: s.pct}
export function parseZoom(raw: unknown): ZoomState; // invalid -> {mode:'fit', pct:100}; manual pct clamped 75..200 and rounded
export function zoomKeyAction(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): ZoomAction | null; // Cmd/Ctrl + '=' or '+' -> in; '-' or '_' -> out; '0' -> fit; any alt -> null
// zoom/use-doc-zoom.ts
export function useDocZoom(scrollRef: React.RefObject<HTMLElement | null>, selectedId: string | null): { state: ZoomState; pct: number; areaPx: number; dispatch(a: ZoomAction): void; style: React.CSSProperties; dataDz: string }; // style = { '--dz': pct/100 }; dataDz = String(pct); ResizeObserver on scrollRef clientWidth (ignores deltas < 2px; absent API -> no-op); persists via safeSet(DOCZOOM_KEY, JSON.stringify(state)); window keydown while mounted (preventDefault, skip isEditableTarget); after any change re-centers the selected mark (querySelector mark[data-testid=doc-highlight][data-finding-id=...].scrollIntoView({block:'center'}))
// zoom/DocZoomControls.tsx
export function DocZoomControls(props: { pct: number; mode: 'fit' | 'manual'; dispatch(a: ZoomAction): void }): JSX.Element; // [-] [100% v] [+] [Fit width]; testids below

// v2/use-ask-owners.ts (null-safe; the bar learns a change row's owners here, E5)
export function useAskOwners(row: Row | null, view: ReviewView): { ask: OwnerAsk | null; askDisabled: boolean; askTitle: string | undefined }; // E23 rule set, mirroring useRowOwners (features/variance/OwnerChip.tsx):
//   meta = view.variance?.meta[row.f.id] ?? view.regressionMeta[row.f.id]  (ordinary change rows take suggested owners from variance meta, as FindingsScreen.tsx:198 and ChangeRow do; regression rows from regression meta)
//   asked = askedOwners(row.triage); owners = asked.length ? asked : effectiveOwners(meta?.owners ?? [], override).owners; source comes from the same call; asked owners WIN over any override
//   override is read from useOwners only when useOwners.docId === the open document id (useReview doc.id); the hook calls useOwners.load(docId) in an effect (load trigger)
//   row null or non-change row -> {ask:null, askDisabled:false, askTitle:undefined}
//   change row: askDisabled = isChangeRow(row) && owners.length === 0 && row.status !== 'counsel'; askTitle = CHANGE_OWNER_FIRST when disabled; ask = {owners, source} when owners.length > 0, else null
export function buildOwnerAsk(row: Row, view: ReviewView): OwnerAsk | null; // imperative twin used by useFindingActions.ask(id): the same E23 rules through useOwners.getState(), never a hook; null for a non-change row and for a change row with no owners
// v2/QuoteBody.tsx (re-created: the FindingRow QuoteBody is private, E2)
export function QuoteBody(props: { row: Row }): JSX.Element; // reads useReview revealed and toggleReveal and the block text; masks via mask from @aduin/core; keeps testid reveal-toggle; no raw HTML
// v2/test-helpers.tsx (test-only shared harness, E7, E8)
export function renderV2(ui: React.ReactElement): { container: HTMLElement; unmount(): void }; // sets IS_REACT_ACT_ENVIRONMENT; re-implements createRoot + act itself and returns unmount (E25: src/test-utils render keeps a module-level container and no root, so it cannot be wrapped)
export function installDomStubs(): void; // ResizeObserver, matchMedia, Element.prototype.scrollIntoView, setPointerCapture, releasePointerCapture
export function queryDoc(selector: string): Element | null; // portal-aware: queries document, not the container (Radix dialog portals to document.body)
// Store mock header (fake-indexeddb/auto; vi.mock of api/client and features/ai/ai-lane; dynamic imports after the mocks) is copied per test file from test/variance-counts-selector.test.ts, because vi.mock is hoisted per file.

// UI components (props only; no store reads except where stated)
FindingsPanelV2({ view }: { view: ReviewView })      // root <aside className="fv2" data-testid="findings-column" data-fv2="1">; reads useFilters, useReview (select, selectedId), calls useFindingActions, useShortcuts, usePanelWidth, useAskOwners(selectedRow, view) (no owners prop: owners come from the owner store via useAskOwners)
ProgressHeader({ progress }: { progress: Progress })
SeverityChips({ chips }: { chips: ReviewView['chips'] })   // uses useFilters sev toggles; testids severity-chip-{block,fix,note}
GroupedList({ groups, selectedId, onSelect, view }: ...)   // renders group headers + AccordionRow
AccordionRow({ row, open, onToggle, view, twin }: ...)     // li > button[finding-row] + div[finding-body]
ExpandedBlock({ row, twin }: ...)                          // rule rows (D6)
ChangeExpanded({ row, meta }: ...)                         // change and regression rows; read-only imports of ChangeDiff, ImpactLines, OwnerChip, OwnerSelect, useRowOwners
ActionBar({ row, busy, askDisabled, askTitle, onControl }: ...)   // sticky bottom; askDisabled and askTitle come from useAskOwners
CloseIssueModal({ row, open, onClose, onSubmit }: ...)     // reuse components/ui modal wrapper; testids dismiss-*
PanelResizer({ pct, min, max, onChange(pct, persist) }: ...)
KindSegment({ ... }) // P-3
```

### Test id and aria contract (new ids; existing ids kept per D-1)

| Element | `data-testid` | Notes |
|---|---|---|
| Panel root | `findings-column` (kept) | plus `data-fv2="1"`, `aria-label="Findings"` |
| Progress header | `progress-header`, `progress-bar`, `progress-text` | text "N of M reviewed"; counts "Counsel N · Closed N · Left N" |
| Group headers | `group-review`, `group-sent`, `group-closed` | `data-group`, `data-count`; headings "To review", "Sent to counsel", "Closed" |
| Done state | `findings-done` | shown when `progress.done` ("All findings reviewed") |
| Row | `finding-row` (kept) | `data-finding-id`, `data-severity`, `data-status`, `data-kind`, `aria-expanded` |
| Row body | `finding-body` (kept) | `finding-title`, `finding-quote`, `finding-provenance`, `finding-locator`, `reveal-toggle` kept |
| Question for counsel | `question-for-counsel` | open by default on blocking rows and rows with A/B readings |
| Details | `finding-details` | collapsed `details` element |
| AI tags | `ai-tag`, `ai-agrees-tag` | violet token in `findings-v2.css` |
| Bar | `action-bar` | buttons `action-counsel` (`data-action="ask-counsel"`), `action-dismiss`, `action-restore` |
| Modal | `dismiss-modal`, `dismiss-reason`, `dismiss-note`, `dismiss-error`, `dismiss-save`, `dismiss-cancel` (kept) | radios per reason; `dismiss-reason` carries `data-reason={key}` |
| Resizer | `panel-resizer` | `role="separator"`, `aria-orientation="vertical"`, `aria-valuemin=40`, `aria-valuemax=65`, `aria-valuenow`, `aria-label="Resize findings panel"` |
| Zoom controls | `doc-zoom-controls`, `zoom-out`, `zoom-in`, `zoom-menu`, `zoom-fit` | `zoom-menu` shows e.g. "100%" and lists presets; `zoom-fit` is `aria-pressed` while fit is on |
| Toast | `undo-toast`, `undo-button` (kept) | text from `computeOutcome` |

Every control's `aria-label` contains its visible text (all-ui.md a11y rule). Severity is never color alone (icon plus word, reuse `severity.ts` `SEV`).

### CSS class contract (`styles/findings-v2.css`, written by the zoom/CSS agent, used by the UI agent)

Prefix `fv2-` only, plus the root `.fv2`, `.fv2-work` and the attribute selector `.docscroll[data-dz]`. The CSS file lives in `styles/`, outside `source-guard`, but values reuse tokens (`var(--paper)`, `var(--panel)`, `var(--ink)`, `var(--ink-2)`, `var(--ink-3)`, `var(--step)`, `var(--block-fg)`, `var(--r)`, `var(--ease)` from `tokens.css`). New values (violet AI tag, card shadow, hairline) are declared as custom properties on `.fv2` (never on `:root`: `tokens-match-mockup` forbids new `:root` vars). Classes: `fv2` (root; grid rows `auto auto minmax(0,1fr) auto`, `position: relative` for the resizer, background `var(--card)`), `fv2-head`, `fv2-prog`, `fv2-prog-bar`, `fv2-prog-counts`, `fv2-chips`, `fv2-group`, `fv2-group-h`, `fv2-list`, `fv2-row`, `fv2-row-open`, `fv2-rowb`, `fv2-sev`, `fv2-title`, `fv2-tag`, `fv2-tag-ai`, `fv2-body`, `fv2-sec`, `fv2-sec-h`, `fv2-quote`, `fv2-qfc` (question for counsel), `fv2-reading` (A/B plain text), `fv2-details`, `fv2-bar`, `fv2-btn`, `fv2-btn-fill`, `fv2-btn-outline`, `fv2-modal`, `fv2-reasons`, `fv2-resizer`, `fv2-done`, `fv2-zoom`, `fv2-zoom-btn`, `fv2-zoom-menu`, `fv2-work`. Media rules: at max-width 1279px `.work.fv2-work` keeps the percentage column (floor 40%, `--fpw` default 55 set by the hook); at max-width 767px `.work.fv2-work{grid-template-columns:minmax(0,1fr)}`, `.work > .fv2{order:-1}` (replicates base.css `.work > .fp{order:-1}`), `.fv2-resizer{display:none}`; `prefers-reduced-motion` honored; no gradients; 4px radius; no colored left bars; focus ring only on `:focus-visible`.

**State-variant and attribute-hook contract (E21; the UI agent emits exactly these, the CSS agent styles exactly these; no other state class names):**

| Component | Static classes | State hooks emitted |
|---|---|---|
| `FindingsPanelV2` root | `fv2` | `data-fv2="1"`, `data-testid="findings-column"`, `data-memory-state` |
| `ProgressHeader` | `fv2-head`, `fv2-prog`, `fv2-prog-bar`, `fv2-prog-counts` | fill width via inline `style={{ width }}` (or an inline custom property); `role="progressbar"` with `aria-valuenow`; `data-testid` ids per the contract table |
| `SeverityChips`, `KindSegment` | `fv2-chips` | `aria-pressed` on toggles; severity chip `data-severity` |
| Group header and list | `fv2-group`, `fv2-group-h`, `fv2-list` | `data-group` (`review`/`sent`/`closed`), `data-count` |
| `AccordionRow` | `fv2-row` (+ `fv2-row-open` when open), `fv2-rowb`, `fv2-sev`, `fv2-title`, `fv2-tag`, `fv2-tag-ai` | `aria-expanded`, `data-severity` (`block`/`fix`/`note`), `data-status` (`open`/`counsel`/`accepted`/`dismissed`), `data-kind` (`error`/`change`/`regression`) |
| `ExpandedBlock`, `ChangeExpanded` | `fv2-body`, `fv2-sec`, `fv2-sec-h`, `fv2-quote`, `fv2-qfc`, `fv2-reading`, `fv2-details` | native `details[open]` for Details |
| `ActionBar` | `fv2-bar`, `fv2-btn`, `fv2-btn-fill`, `fv2-btn-outline` | `:disabled`, `data-action` |
| `CloseIssueModal` | `fv2-modal`, `fv2-reasons` | `data-reason`, `aria-invalid` on the note when in error |
| `PanelResizer` | `fv2-resizer` | `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| `DocZoomControls` | `fv2-zoom`, `fv2-zoom-btn`, `fv2-zoom-menu` | `aria-pressed` on Fit width, `aria-expanded` on the menu button |
| Done and work | `fv2-done`, `fv2-work` | `.docscroll[data-dz]` set by `useDocZoom` |

`findings-v2-css-guard` cross-checks that every `fv2-` class used in a `className` string of a non-test `v2/*.tsx` or `zoom/*.tsx` file exists in `findings-v2.css` (E21); the check runs in the serial verify step after both A2 agents finish and a failure is fixed serially.

---

## Phase A - Early new-file slice (executable NOW)

**Phase status:** ⏳ PLANNED
**Depends on:** nothing (Variance P04 code is committed; P05 does not touch `apps/web/src`).
**Risk class:** low (additive, unmounted, no data or contract change).
**Report destination:** `process/features/findings-v2/active/findings-v2_18-10-26/findings-v2-phase-a_REPORT_18-10-26.md`
**Execute strategy (D-9):** A1 logic modules and tests (1 opus agent), then A2 two parallel opus agents with disjoint directories: UI in `v2/` (components, glue hooks, KindSegment) and `zoom/` plus `styles/findings-v2.css`. Model: opus for these code-writing agents only; research, validate and review run on sonnet. The A2 agents coordinate only through the fixed CSS class contract above, so no cross-talk is required and parallel subagents are valid. Serialize test runs (one vitest process at a time).

### Files (all CREATE; nothing is edited)

| # | Path | Step |
|---|---|---|
| 1 | `apps/web/src/features/review/v2/types.ts` | A1 |
| 2 | `.../v2/reasons-map.ts` + `findings-v2-reasons-map.test.ts` | A1 |
| 3 | `.../v2/groups.ts` + `findings-v2-groups.test.ts` | A1 |
| 4 | `.../v2/action-plan.ts` + `findings-v2-action-plan.test.ts` | A1 |
| 5 | `.../v2/outcome.ts` + `findings-v2-outcome.test.ts` | A1 |
| 6 | `.../v2/dedupe.ts` + `findings-v2-dedupe.test.ts` | A1 |
| 7 | `.../v2/width-math.ts` + `findings-v2-width-math.test.ts` | A1 |
| 8 | `.../v2/shortcut-guard.ts` + `findings-v2-shortcut-guard.test.ts` | A1 |
| 9 | `.../zoom/zoom-math.ts` + `zoom/findings-v2-zoom-math.test.ts` | A1 |
| 9a | `.../zoom/findings-v2-css-guard.test.ts` (node environment; supplement 1, E18) | A2-ZOOM |
| 10 | `.../v2/use-finding-actions.ts` + `findings-v2-actions-flow.test.tsx` | A2-UI |
| 10a | `.../v2/use-ask-owners.ts`, `v2/QuoteBody.tsx`, `v2/test-helpers.tsx` (supplement 1: E5, E2, E7) | A2-UI |
| 11 | `.../v2/use-panel-width.ts`, `v2/use-shortcuts.ts` + `findings-v2-shortcuts-hook.test.tsx` | A2-UI |
| 12 | `.../v2/{FindingsPanelV2,ProgressHeader,SeverityChips,GroupedList,AccordionRow,ExpandedBlock,ChangeExpanded,ActionBar,CloseIssueModal,PanelResizer,KindSegment}.tsx`, `v2/index.ts` + `findings-v2-panel-ui.test.tsx`, `findings-v2-change-expanded.test.tsx`, `findings-v2-panel-resizer.test.tsx` | A2-UI |
| 13 | `.../zoom/use-doc-zoom.ts`, `zoom/DocZoomControls.tsx`, `zoom/index.ts` + `zoom/findings-v2-use-doc-zoom.test.tsx`, `zoom/findings-v2-zoom-controls.test.tsx` | A2-ZOOM |
| 14 | `apps/web/src/styles/findings-v2.css` | A2-ZOOM |

Test files are co-located next to their module (`src/**/*.test.{ts,tsx}` is collected; `test/**/*.test.tsx` would not be). Test sources must contain no hex color literals (source-guard scans `src/features/**` including tests) and no `dangerouslySetInnerHTML` or `.innerHTML =`.

### Touchpoints (read-only imports from existing files)

`../model` (`Row`, `Triage`, `buildRows` for fixtures), `../severity` (`SEV`, `SEV_KEYS`), `../reasons` (`DISMISS_REASON_REQUIRED` only), `../components/{FilterMenu, PreviouslyHandledRow}` (reuse, read-only); `QuoteBody` is a private function in `FindingRow.tsx` and is NOT importable (re-create it as `v2/QuoteBody.tsx`); `Provenance` and `AI_SUGGESTION` come from `../../ai/Provenance`, `LocatorChip` from `../../ai/Locator`; `Banners` stays rendered by `FindingsScreen` (outside the aside) and is not part of the panel (validated 18-10-26), `../memory-labels` (`memoryLabelText`), `../use-review-view` (`useReviewView` type), `../../variance/{select (reviewGate), owner-groups (isErrorQuestion, askedOwners, isChangeRow), OwnerChip (OwnerChip, OwnerSelect, useRowOwners, CHANGE_OWNER_FIRST), ChangeDiff, ImpactLines, CosmeticGroups, NoBaselineLine, variance-store (useVariance)}`, `../../counsel/{sheet-model (questionRows, wordingFor, EMPTY_DRAFTS), counsel-store (useCounsel drafts)}`, `../../../state/{review (useReview, OwnerAsk), filters (useFilters), storage (safeGet, safeSet, safeGetJson)}`, `../../../components/ui/{modal,popover}` wrappers, `../../../test-utils` (`render`). Core imports are type-only or names already in the ALLOWED list (`templateQuestionText`, `maskQuote`, `mask`, `computeGate`, `REASON_CODES`); no append to `import-graph.test.ts`.

### Blast Radius (Phase A)

New files only (table above). No runtime consumer: nothing mounts `FindingsPanelV2`, `useShortcuts` or `useDocZoom` until Phase B, so no existing screen, route, bundle size budget or e2e spec changes behavior. `styles/findings-v2.css` is imported only by new v2 and zoom components, therefore it is not in the CSS graph of the running app until Phase B. Regression surface: `source-guard`, `import-graph`, `tokens-match-mockup`, `severity-label` and the full web vitest suite (measured at VALIDATE, HEAD 5458b86: 55 files / 375 tests green). Collision check: Phase A claims no seam file; Variance P05 edits e2e, `scripts/`, samples and deploy only.

### Public Contracts introduced

The TypeScript signatures above (module-internal to `apps/web`), the `ui:v1:fpw` and `ui:v1:doczoom` localStorage keys (JSON shapes: `fpw` = integer string 40..65; `doczoom` = `{"mode":"fit"|"manual","pct":number}`), and the new test ids. No HTTP, core, storage-schema or Worker contract changes. all-ui.md "Persisted" list gains the two keys at UPDATE PROCESS.

### Phase A Implementation Checklist

- [x] A0. Preflight (read-only): `git status --short` and confirm none of the Hard Rule 1 files is modified by another session; `grep -n "\.paper" apps/web/src/styles/*.css` equals the Zoom CSS override table; confirm exact export names for `Owner`, `isErrorQuestion`, `askedOwners`, the `FindingRow` reuse exports (`QuoteBody`, `Provenance`, `LocatorChip`) and the `useCounsel` drafts selector; read `FindingsScreen.tsx` lines 100-256 to copy kind-segment, chips and filter markup and ids exactly. Record any name that differs in the Phase A report; do not edit a locked file to fix it.
- [x] A1.1 Create `v2/types.ts` and `v2/reasons-map.ts` with the contract above; D2 labels exactly: "Real issue — I'll handle it in the form build", "Firm's standard wording", "Does not affect the form", "Tool false alarm", "Other".
- [x] A1.2 Create `v2/groups.ts` (`groupOf`, `groupRows`, `flatOrder`, `progressOf`, `isBlocking`).
- [x] A1.3 Create `v2/action-plan.ts` (`planControl`, `barState`, `nextToReview`). Never emit `accept` or `needsCounsel` for a row whose status is not `open`.
- [x] A1.4 Create `v2/outcome.ts` (`simulateStatus`, `computeOutcome`) with the exact D12 strings; imports `questionRows` from `../../counsel/sheet-model` and `reviewGate` from `../../variance/select`.
- [x] A1.5 Create `v2/dedupe.ts` (`dedupeFindings`, `triageWithTwins`), `v2/width-math.ts`, `v2/shortcut-guard.ts`, `zoom/zoom-math.ts`.
- [x] A1.6 Create the nine unit test files for A1 (matrix below); run each token alone until green; run `pnpm --filter @aduin/web typecheck` (A1 is a single agent, so this is safe).
- [x] A1.7 Commit A1 (E26, same form as A5): `git add <A1 paths>`, check `git diff --cached --name-only`, then `git commit -m "feat: findings v2 pure logic modules (action plan, groups, outcome, dedupe, width and zoom math)" -- <A1 paths>` (pathspec on commit so nothing another session staged is swept in); trailer as in Hard Rule 3.
- [x] A2-UI.1 Create `v2/use-finding-actions.ts` (flow in Architecture step 4; in-flight flag; rethrow on rejection). Order (E27): create the A2-UI.0 files (`test-helpers.tsx`, `QuoteBody.tsx`, `use-ask-owners.ts`) BEFORE this file, because it imports `buildOwnerAsk`.
- [x] A2-UI.0 Create `v2/test-helpers.tsx` (E7: `renderV2` returning `{ container, unmount }`, `installDomStubs` for ResizeObserver, matchMedia, scrollIntoView, setPointerCapture, releasePointerCapture, portal-aware `queryDoc`; each test file copies the store mock header from `test/variance-counts-selector.test.ts` per E8; every test unmounts in `afterEach`; do not edit `src/test-utils.tsx`), `v2/QuoteBody.tsx` (E2) and `v2/use-ask-owners.ts` (E5: null-safe; `useAskOwners` is the hook the panel uses to pass `askDisabled` and `askTitle` to `ActionBar`; `buildOwnerAsk` is the imperative twin that `useFindingActions.ask(id)` calls through `useOwners.getState()`; `FindingsPanelV2({view})` gets no owners prop).
- [x] A2-UI.2 Create `v2/use-panel-width.ts`, `v2/use-shortcuts.ts`, `v2/PanelResizer.tsx`, `v2/CloseIssueModal.tsx`, `v2/ActionBar.tsx`, `v2/ProgressHeader.tsx`, `v2/SeverityChips.tsx`, `v2/KindSegment.tsx`.
- [x] A2-UI.3 Create `v2/ExpandedBlock.tsx` (D6 order: severity line + section + "AI agrees"; What's wrong; quote with Reveal via the existing quote component; "Question for counsel" from `wordingFor(row, drafts)` rendered as plain text, open by default when `isBlocking(row)` or the finding has A/B readings in `f.detail.interpretations`; A/B shown as plain text, not options; collapsed "Details": where, class, rule or model, AI review, confidence, why flagged; twin provenance when `twin` is given). `v2/ChangeExpanded.tsx` (adapter; "Ask owner" disabled with `CHANGE_OWNER_FIRST` when `useRowOwners(...).owners` is empty).
- [x] A2-UI.4 Create `v2/AccordionRow.tsx`, `v2/GroupedList.tsx`, `v2/FindingsPanelV2.tsx`, `v2/index.ts`. Panel composition order (top to bottom): `ProgressHeader`, `KindSegment` (plus `NoBaselineLine` read-only reuse when no baseline), `SeverityChips` + `FilterMenu`, list region (`role="region" aria-label="Findings list"`; `GroupedList`, `CosmeticGroups`; plus the existing `loading-state`, `empty-state`, error state and `findings-list` ids), `PreviouslyHandledRow`; `Banners` stays in `FindingsScreen` and is NOT rendered by the panel; the panel root also keeps `data-memory-state` (same derivation as `FindingsScreen`) because `e2e/fixtures/app.ts` and `loading-state` waits depend on them, `findings-done` when done, `ActionBar`, `PanelResizer` (absolute left edge).
  - **Panel keeps these ids and states (E6):** root `findings-column` with `data-memory-state`; scroll region `role="region" aria-label="Findings list"` (also what `a11y-keyboard.spec.ts` finds); `findings-list` on the `ul`; `loading-state` ("Reading the document…", awaited by `e2e/fixtures/app.ts`); `empty-state` copy; the error or empty state with the "Open a document" button (`useShell` `setOpenDoc`); `CosmeticGroups`; `PreviouslyHandledRow`; never import `Banners`. Group counts come from `view.visible` and progress from `view.main` (P-7). The Close issue modal title follows P-9.
  - **E22 CSS import rule:** `styles/findings-v2.css` is imported only from the barrel entries `v2/index.ts` and `zoom/index.ts` (the `FindingsPanelV2` and `DocZoomControls` entries); never from a leaf component, hook or test, so no jsdom test depends on the other parallel agent having created the file. The UI agent emits only the state hooks of the E21 attribute-hook contract.
  - **E25 facts:** `TriageStatus` is imported from `../gateInterim`; the list region keeps `tabIndex={0}` and `className="scroll flist"` (asserted at `a11y-keyboard.spec.ts:125`); the note textarea keeps `maxLength={500}`; `renderV2` re-implements `createRoot` plus `act` (src/test-utils `render` keeps no root); J/K `select(id)` then focuses the row (`requestAnimationFrame`, `focus({preventScroll:true})`); there is no `styles/scan.css`.
- [x] A2-UI.5 Create the jsdom tests (matrix below); run ONLY your own tokens, one per call. A2 agents run only their own tokens; typecheck, eslint, A3, A4 and commits run once, serially, after both A2 agents finish (E10; parallel project-wide typecheck and git writes race).
- [x] A2-ZOOM.1 (E22: import `findings-v2.css` only from `zoom/index.ts`, never from `use-doc-zoom.ts`, `DocZoomControls.tsx` or a test; E21: style exactly the attribute hooks listed in the CSS class contract) Create `zoom/use-doc-zoom.ts`, `zoom/DocZoomControls.tsx`, `zoom/index.ts`, and their tests (a stub `ResizeObserver` is installed in the test; the hook must no-op when the API is absent). A2 agents run only their own tokens; typecheck, eslint, A3, A4 and commits run once, serially, after both finish. Also create `zoom/findings-v2-css-guard.test.ts` (E18) and run its token after A2-ZOOM.2 (E21: it also carries the class-usage cross-check of every `fv2-` class used in `v2/*.tsx` and `zoom/*.tsx`; that cross-check is run in the serial verify step once both A2 agents are done).
- [x] A2-ZOOM.2 Create `styles/findings-v2.css` per the CSS class contract and the Zoom CSS override table (including `.docscroll[data-dz]` rules, the three padding sets, `overflow-x: auto`, `scrollbar-gutter: stable`).
- [x] A2-ZOOM.3 Run `pnpm exec prettier --check apps/web/src/styles/findings-v2.css`.
- [x] A3. Regression tokens, each alone: `source-guard`, `import-graph`, `tokens-match-mockup`, `severity-label`; then the full `pnpm --filter @aduin/web test` once and `pnpm --filter @aduin/web typecheck`.
- [x] A4. Boundary proof (scoped; the literal "`git diff --name-only` is empty" cannot pass while the Variance session keeps tracked `process/` files modified in this shared checkout): run the three commands under "Boundary proof" in the Validate Contract (locked-path `git diff --name-only HEAD -- <locked paths>` prints nothing; `git status --short -- apps/web/src` shows only the allowed `??` paths; `git show --name-only --format= <sha>` per plan commit lists only Phase A paths).
- [x] A5. Commit A2 once, serially, after A3 and A4 are green (two commits allowed: UI, then zoom plus CSS). Check `git diff --cached --name-only` first, then `git add <paths>` and `git commit -m "<msg>" -- <paths>` (pathspec on commit so nothing another session staged is swept in); trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; pathspec-only adds; messages `feat: findings v2 panel components and glue hooks (unmounted)` and `feat: findings v2 document zoom and styles (unmounted)`.
- [x] A6. Write the Phase A report (commands, outcomes, deviations, any export-name differences found at A0). Update this plan's `Current Execution State`.

### Phase A test matrix (REQ-TEST-LINK: each test names the acceptance criterion it proves)

| Token (one per call) | File | Tier | Proves |
|---|---|---|---|
| `findings-v2-reasons-map` | `v2/findings-v2-reasons-map.test.ts` | Fully-Automated | AC-3: key to `ReasonCode` mapping, `real_issue` hidden on blocking, Other needs note, keys subset of `REASON_CODES`; E24: `closeReasonsFor(row)` hides `real_issue` for a blocking row and for an ordinary change row (`gatesReview`), keeps it for a non-blocking rule row |
| `findings-v2-groups` | `v2/findings-v2-groups.test.ts` | Fully-Automated | AC-9: group rule for all 4 statuses x blocking/non-blocking, stable order, progress totals and `done`; E24: `gatesReview` is true for blocking and change rows, an accepted change row (medium severity) groups to Sent not Closed, an accepted non-blocking rule row groups to Closed |
| `findings-v2-action-plan` | `v2/findings-v2-action-plan.test.ts` | Fully-Automated | AC-2, AC-4: blocking to `accept`, non-blocking to `needsCounsel`, never a toggle on an acted row, change-row owner rule, `nextToReview` (next, previous, none), `barState` labels and `moveBackEnabled`; move-back on a row with `counselAnswer` or a non-null `ownerAnswers` value returns noop `answered` |
| `findings-v2-outcome` | `v2/findings-v2-outcome.test.ts` | Fully-Automated | AC-13: exact strings for all 4 actions and every gate transition; `questionCount` follows the counsel-sheet rule (accepted blocking counts, accepted non-blocking does not); `simulateStatus` mirrors store shapes (dismiss drops `ownerAnswers`, restore gives `{status:'open'}`, change-row ask writes null answers) |
| `findings-v2-dedupe` | `v2/findings-v2-dedupe.test.ts` | Fully-Automated | AC-12: overlap boundaries (touching ranges do not match), class mismatch, same detector_kind, multi-candidate tie rule, one twin per rule, rules claim in input order (two rules overlapping one AI finding: the first rule wins it), `change` rows untouched, `triageWithTwins` fallback |
| `findings-v2-width-math` | `v2/findings-v2-width-math.test.ts` | Fully-Automated | AC-5: clamp, default 50/55 at 1280, `readPct` invalid input, pointer math (right column), key math (step 2, Shift 10; P-8) |
| `findings-v2-css-guard` | `zoom/findings-v2-css-guard.test.ts` (node environment) | Fully-Automated | AC-11, AC-A3: `findings-v2.css` has no `:root`, no `gradient`, every selector starts with `.fv2`, `.fv2-`, `.docscroll[data-dz]`, `.work.fv2-work` or `.work > .fv2` (media blocks included), `fv2-` prefix, no `.row`, `.rowb`, `.fp` overrides, zoom overrides scoped by `[data-dz]`, every Zoom CSS override table row present; E21 class-usage cross-check: every `fv2-` class found in a `className` string of a non-test `v2/*.tsx` or `zoom/*.tsx` file is defined as a class selector in `findings-v2.css` |
| `findings-v2-shortcut-guard` | `v2/findings-v2-shortcut-guard.test.ts` | Fully-Automated | AC-15: ignore list (editable, modifiers, IME, repeat for C/X, open dialog), J/K allowed on repeat |
| `findings-v2-zoom-math` | `zoom/findings-v2-zoom-math.test.ts` | Fully-Automated | AC-16: `fitWidth` clamp edges (area 0, 764, 1900, 4000), steps in/out from fit and manual, preset clamp, `parseZoom` junk, key mapping |
| `findings-v2-actions-flow` | `v2/findings-v2-actions-flow.test.tsx` | Hybrid (jsdom plus store `setState` with `vi.fn` actions) | AC-2, AC-4, AC-13: plan, await, select next, capture `toast.undo`, `showToast(text, undo)`; busy flag; rejection path |
| `findings-v2-shortcuts-hook` | `v2/findings-v2-shortcuts-hook.test.tsx` | Hybrid | AC-15: J/K walk, no wrap, C/X dispatch only when enabled, listener removed on unmount |
| `findings-v2-panel-ui` | `v2/findings-v2-panel-ui.test.tsx` | Hybrid | AC-1, AC-4, AC-6, AC-7, AC-8, AC-9, AC-10, AC-19: ids (including `loading-state`, `empty-state`, `findings-list`, region "Findings list", `data-memory-state`), modal title per P-9, Closed group asserted with the filter set to `all` (P-7), aria names contain visible text, one open row, bar disabled with nothing open, group moves, progress text, done state, no "Show in document" button; list region has `tabindex="0"`; note field `maxLength=500` (E25); modal hides Real issue on a change row (E24); E23 Ask owner cases: change row with `variance.meta[id].owners=['gp']` enables the bar button and the call carries `{owners:['gp'], source:'suggested'}`, an owner override to `you` (with `useOwners.docId` equal to the open doc) disables it, asked owners win over the override |
| `findings-v2-change-expanded` | `v2/findings-v2-change-expanded.test.tsx` | Hybrid | AC-20: change row renders Variance parts; "Ask owner" disabled with `CHANGE_OWNER_FIRST` when no owners (owner store stubbed through `setState`); E23 cases: an ordinary change row with `variance.meta[id].owners=['gp']` enables Ask owner and builds `{owners:['gp'], source:'suggested'}`; an override to `you` disables it; asked owners win over the override |
| `findings-v2-panel-resizer` | `v2/findings-v2-panel-resizer.test.tsx` | Hybrid | AC-5: separator attributes, arrow keys, Home/End, persist only on pointer-up and key |
| `findings-v2-use-doc-zoom` | `zoom/findings-v2-use-doc-zoom.test.tsx` | Hybrid | AC-16: stub `ResizeObserver` (2px rule), persistence round trip, keydown only while mounted, typing ignored, `scrollIntoView` called after change |
| `findings-v2-zoom-controls` | `zoom/findings-v2-zoom-controls.test.tsx` | Hybrid | AC-16: control ids, aria names, `aria-pressed` on Fit width, preset menu |
| `source-guard`, `import-graph`, `tokens-match-mockup`, `severity-label` | existing | Fully-Automated (regression) | AC-11, AC-17: no hex in features, no new core value import, no `:root` drift, severity labels intact |

Agent-Probe and Known-Gap in Phase A: none run (no browser). The visual calm-palette check and fit-width feel are Phase B Agent-Probe. Known-Gap residual: manual keyboard and screen-reader pass (see Residual Test Gaps).

### Phase A acceptance (all must hold)

- AC-A1: every file in the Phase A table exists; the scoped boundary proof in the Validate Contract holds (no locked path edited; untracked paths under `apps/web/src` are only the allowed set).
- AC-A2: all 16 new test tokens pass (15 plus `findings-v2-css-guard`; new custom properties only on `.fv2`, never `:root`), one per call; the 4 regression tokens pass; full `pnpm --filter @aduin/web test` and `typecheck` pass; eslint and prettier clean on the new paths.
- AC-A3: `findings-v2.css` contains no `:root` block, every selector begins with `.fv2`, `.fv2-`, `.docscroll[data-dz]`, `.work.fv2-work` or `.work > .fv2`, and no gradient.
- AC-A4: no import of a core value outside the ALLOWED list (the `import-graph` token proves it).

### Phase A Phase Loop Progress (7-step inner loop, SPEC skipped)

- [x] 1 RESEARCH - done in `findings-v2_RESEARCH_18-10-26.md`; Phase A Step A0 re-checks export names
- [x] 2 INNOVATE - `findings-v2_DECISION_18-10-26.md` (D-1..D-10)
- [x] 3 PLAN-SUPPLEMENT - this plan (creation mode; no prior plan existed)
- [x] 4 PVL - vc-validate-agent writes the Validate Contract below
- [x] 5 EXECUTE - A1, then A2-UI and A2-ZOOM in parallel (commits 9e866f2, 7a0d172, 597c9cf; report `findings-v2-phase-a_REPORT_18-10-26.md`)
- [x] 6 EVL - vc-tester re-runs the contract gate commands independently (all gates green, closeout CLEAN)
- [x] 7 UPDATE PROCESS - capture Phase A learnings; commit (do not archive: Phase B continues in the same plan)

---

## Phase B - Integration (gated on Variance P05 close)

**Phase status:** ⏳ PLANNED (blocked until the Variance session messages "P05 closed")
**Depends on:** Phase A VERIFIED, Variance P05 closed (its code commits landed or confirmed not to touch `apps/web/src`), Step 0 re-sync below.
**Risk class:** medium-high (swaps the Findings list in locked files; changes many e2e references; production deploy).
**Report destination:** `process/features/findings-v2/active/findings-v2_18-10-26/findings-v2-phase-b_REPORT_18-10-26.md`
**Execute strategy:** B1 swap, B2 DocPane zoom plus mockup slicer, B3 e2e repairs, B4 new specs and parity test, each as 1 opus agent, run sequentially because every step edits shared locked files and Playwright shares port 4317. EVL (vc-tester, sonnet), code review (vc-code-reviewer, sonnet) and UPDATE PROCESS follow.

### Step 0 (mandatory, before PVL): re-sync with Variance's landed code

The Phase B file and line targets are research-time facts (18-10-26, code HEAD a31dff0). Step 0 re-reads and re-verifies **every** Phase B file and line target below and writes an `## Inner Loop Refresh Note` in this plan (date newer than the Validate Contract) before Phase B PVL runs.

- [ ] B0.1 `git log --oneline -15` and `git diff a31dff0..HEAD --stat -- apps/web` to list everything Variance P05 changed; read the diffs for the Phase B files (below).
- [ ] B0.2 Re-read Variance's landed UI: owner chips and `OwnerSelect` (`features/variance/OwnerChip.tsx`), questions grouped by owner (`features/counsel/*`, `owner-groups.ts`), the gate's two states (`reviewGate`, `computeGate` policy, `GateButton`), regression rows (R-01), and any P05 additions (a11y-keyboard and perf-budget additive cases, H&C sample entries that change counts). Confirm the exports `ChangeExpanded` imports still exist with the same signatures.
- [ ] B0.3 Re-verify each target: `FindingsScreen.tsx` (grid and `aside.fp` structure, kind segment, `CoverageLine`, J/K effect position, `DismissModal` host, `UndoToast` host); `DocPane.tsx` (scroll effect on `[selectedId, selectSeq]`, `.docbar`, `JumpMenu` placement, `.docscroll` ref); `use-review-view.ts` (Phase C only); `base.css` rules `.work` (556-561, 1684-1686, 1712-1738), `.paper`; `test/support/mockupCss.ts`; `e2e/layout-vs-mockup.spec.ts:26, 91-95`; the shared e2e fixture that opens documents (`e2e/fixtures/app.ts`, to confirm where `addInitScript` can seed `ui:v1:doczoom`).
- [ ] B0.4 Recount `action-*` references: `grep -rnE "action-(accept|counsel|dismiss|restore)" apps/web/e2e apps/web/test apps/web/src` and compare with the Derived repair list; add any new spec Variance P05 introduced.
- [ ] B0.5 Re-run the Phase A gates (all 16 tokens plus the 4 regression tokens) to prove Phase A still holds after P05; re-test `ChangeExpanded` (`findings-v2-change-expanded`).
- [ ] B0.6 Append a `## Findings v2 Phase B` claim section to the Variance `phase-blast-radius-registry.md` (append-only), listing the locked files this phase edits and the derived repairs to Variance-owned specs.
- [ ] B0.7 Write `## Inner Loop Refresh Note` in this plan (format: behavior-reference Section 5): what changed since 18-10-26, which targets moved, which gates changed.

### Phase B files

| File | Action | Change (line numbers re-verified at Step 0) |
|---|---|---|
| `apps/web/src/features/review/FindingsScreen.tsx` | EDIT (Variance-locked) | Replace the `aside.fp` body with `<FindingsPanelV2 view={view} />`; add class `fv2-work` to the `.work` element; delete the window J/K effect (about lines 66-90) in the same commit; keep the page header, `DocPane`, banners, `CoverageLine` and `UndoToast` hosts; the old `DismissModal` host goes away because `CloseIssueModal` replaces it (the old file is deleted at B5). |
| `apps/web/src/features/review/components/DocPane.tsx` | EDIT (locked, about 4 lines) | Call `useDocZoom(scrollRef, selectedId)`; add `style={zoom.style}` and `data-dz={zoom.dataDz}` on the `.docscroll` element; render `<DocZoomControls .../>` next to `JumpMenu` inside `.docbar`. Scroll effect unchanged. |
| `apps/web/test/support/mockupCss.ts` | EDIT | Add `findingsV2Css` slicer reading `design/mockups/findings-v2.html`: default width percents (50 at 1280 and above, 55 below), clamp 40 and 65, handle 8px. |
| `apps/web/e2e/layout-vs-mockup.spec.ts` | EDIT (derived repair, lines ~26, 91-95) | Replace the 400/380 findings-column assertions with percentage assertions from `findingsV2Css`. |
| `apps/web/e2e/fixtures/app.ts` (confirm at Step 0) | EDIT | `addInitScript` seeds `localStorage['ui:v1:doczoom'] = {"mode":"manual","pct":100}` so existing geometry and perf specs keep the 700px page. |
| `apps/web/e2e/fixtures/findings-actions.ts` | CREATE | Helpers: `openFirstFinding`, `askCounsel`, `closeAsRealIssue` (opens `action-dismiss`, picks `data-reason="real_issue"`, saves), `closeWithReason(reason, note?)`, `moveBack`. |
| e2e specs and fixtures in the Derived repair list | EDIT (derived repairs only) | Minimal edits: `action-accept` becomes `askCounsel` (blocking) or `closeAsRealIssue` (non-blocking); `finding-body`-scoped action clicks become page-level `action-*`; label strings follow D2. |
| `apps/web/e2e/findings-v2.spec.ts` | CREATE | Bar, outcome toast and Undo, groups and progress, resize (drag and keys, persistence), zoom (fit, manual, keys, persistence), shortcuts, done state. |
| `apps/web/src/features/review/v2/findings-v2-store-parity.test.tsx` | CREATE | Simulated `computeOutcome` equals a real recompute through the real store actions (pattern from `apps/web/test/review-sync.test.ts`, confirmed at Step 0). |
| `apps/web/src/features/review/components/FindingRow.tsx` and `DismissModal.tsx` | DELETE (B5, only after the full gate is green and no importer remains) | Leave `features/variance/ChangeRow.tsx` to the Variance owner. |
| `process/context/ui/all-ui.md`, `process/context/tests/all-tests.md` | EDIT at UPDATE PROCESS | Findings anatomy, published ids, persisted keys, new test tokens, the `.tsx`-only-under-`src` note. |

### Derived repair list (answer d; counts from `grep` at 18-10-26)

| Spec or fixture | Hits | Kind of repair | Owner flag |
|---|---|---|---|
| `e2e/triage-actions.spec.ts` | 5 (`action-accept` x2) | accept becomes `askCounsel` or `closeAsRealIssue`; "accepted" counts follow the group moves | free |
| `e2e/app-shell.spec.ts` | 1 (`action-accept`, line 80) | same | free |
| `e2e/fixtures/counsel.ts` | 2 (`action-accept`, line 136) | helper becomes `askCounsel`; used by many counsel specs, re-run all of them | free |
| `e2e/gate-pill.spec.ts` | 2 (`action-accept`, line 25) | same | **Variance-locked** (coordinate) |
| `e2e/a11y-keyboard.spec.ts` | 1 (`tabTo(page,'action-accept',40)`, line 160) | tab order now reaches the bar; retarget to `action-counsel`; additive P05 cases must be re-read | **Variance-locked** |
| `e2e/dismiss-requires-reason.spec.ts` | 4 | Dismiss modal reasons and labels (D2); the required-reason error text is unchanged (`DISMISS_REASON_REQUIRED`) | free |
| `e2e/layout-vs-mockup.spec.ts` | 1 | 400/380 becomes percent assertions | free |
| `e2e/a11y-smoke.spec.ts`, `e2e/analyst-name.spec.ts`, `e2e/counsel-gate.spec.ts`, `e2e/metrics.spec.ts`, `e2e/previously-handled-section.spec.ts`, `e2e/slice.spec.ts` | 1-2 each | Verify they still pass; edit only where they assume actions live inside `finding-body` or assume `action-*` exists on a collapsed row (the bar is always present but disabled with nothing open) | free (`slice.spec.ts` is the live smoke on the stack project: run only with `SLICE_BASE_URL` at deploy) |
| `e2e/memory-no-reflag.spec.ts`, `e2e/stack-memory-demo-workspace.spec.ts`, `e2e/stack-memory-roundtrip.spec.ts`, `e2e/fixtures/stack-memory.ts` | 1 each | accept becomes `askCounsel` or `closeAsRealIssue`; the stack-memory project is a separate run | **Variance-locked** |
| `e2e/variance-no-baseline-errors-only.spec.ts` | 1 | same | **Variance-locked** |
| `e2e/variance-gate-two-states.spec.ts:30`, `e2e/variance-owner-override.spec.ts:48`, `e2e/fixtures/variance-owners.ts:41` | 1 each | **scoped inside `finding-body`**: drop the `finding-body` scope so the click targets the bar (`getByTestId('action-dismiss')` or `getByTestId('action-counsel')`) | **Variance-locked** |

Rule for Variance-locked files: once Variance posts "P05 closed", the files are free to edit; edits stay minimal, are logged in the Phase B report, and are announced to the Variance session before commit (shared checkout).

### Phase B Implementation Checklist

- [ ] B0. Step 0 complete (checklist above), refresh note written, PVL re-run from V1 if the note is newer than the contract.
- [ ] B1. FindingsScreen swap commit (FindingsPanelV2 mounted, `fv2-work` class, J/K effect deleted, `useShortcuts` mounted through the panel). Run `typecheck`, the web vitest suite once, then Playwright smoke tokens (one per call) `triage-actions`, `app-shell`. Commit (one commit): `feat: mount findings v2 panel in the Findings screen`.
- [ ] B2. DocPane zoom edit plus `findingsV2Css` slicer, `layout-vs-mockup` repair, e2e zoom seed. Run `layout-vs-mockup`, `finding-highlight`, `perf-budget` tokens. Commit: `feat: document zoom and fit width in the reading view`.
- [ ] B3. Create `e2e/fixtures/findings-actions.ts`; apply the Derived repair list. Run each affected spec alone, then the whole preview project once. Commit: `test: repair e2e for findings v2 actions` (Variance-owned files named in the message).
- [ ] B4. Create `findings-v2.spec.ts` and `findings-v2-store-parity.test.tsx`. Commit: `test: findings v2 e2e and store parity`.
- [ ] B5. After the full gate is green, remove dead `FindingRow.tsx` and `DismissModal.tsx` only if no importer remains (`grep -rn "FindingRow\|DismissModal" apps/web/src`); keep `ChangeRow.tsx`. Commit: `refactor: remove superseded finding row and dismiss modal`.
- [ ] B6. Agent-Probe: design-probe style screenshots (opt-in `DESIGN_PROBE=1`, `pnpm exec playwright test --project=preview design-probe` from `apps/web`, per all-tests.md) at 1440, 1199 and 1024, with zoom at 75, 100, 150 and fit; compare against `findings-v2.html` (calm palette, no horizontal overflow, bar visible while the list scrolls). Findings go in the report.
- [ ] B7. EVL (vc-tester re-runs the contract commands), code review, UPDATE PROCESS (`all-ui.md`, `all-tests.md`), then the deploy recipe if Hard Rule 5 conditions hold, then message the design session.

### Phase B acceptance

- AC-B1: AC-1 to AC-10, AC-13, AC-15, AC-16, AC-19, AC-20 hold in the real app (Playwright preview project).
- AC-B2: every spec in the Derived repair list passes; the whole preview suite passes (217 + 1 skip baseline plus the new spec); the stack-memory project passes when run (11 baseline).
- AC-B3: the store parity test passes (simulated equals real).
- AC-B4: `grep` finds no `action-accept` in `apps/web/e2e`, `apps/web/test`, `apps/web/src`.
- AC-B5: web vitest, typecheck, `source-guard`, `import-graph`, `tokens-match-mockup`, `no-e2e-hook-in-dist` green; deploy preflight green when deploying.

### Phase B Phase Loop Progress

- [ ] 1 RESEARCH - Step 0 re-sync (B0.1-B0.6)
- [ ] 2 INNOVATE - n/a unless Step 0 finds a contract change (then amend the DECISION file)
- [ ] 3 PLAN-SUPPLEMENT - write `## Inner Loop Refresh Note` (B0.7)
- [ ] 4 PVL - validate-contract re-run if the note is newer than the contract
- [ ] 5 EXECUTE - B1 to B5
- [ ] 6 EVL - vc-tester independent run
- [ ] 7 UPDATE PROCESS - context docs, report, commit

---

## Phase C - Dedupe hookup (build-split step 2)

**Phase status:** ⏳ PLANNED
**Depends on:** Phase B VERIFIED (committed; deployed if the deploy ran). Own commit.
**Risk class:** medium (changes row counts and counsel questions; product confirmation pending for the tie rule).
**Report destination:** `process/features/findings-v2/active/findings-v2_18-10-26/findings-v2-phase-c_REPORT_18-10-26.md`

### Files

| File | Action | Change |
|---|---|---|
| `apps/web/src/features/review/use-review-view.ts` | EDIT (about 3 lines plus 1 in the return object) | After `mergeFindings(...)`: `const d = dedupeFindings(merged)`; `buildRows(d.findings, memory, triageWithTwins(triage, d.twinOf))`; return `twins: d.twins` in the memo result. `Row` and `model.ts` are not edited. |
| `apps/web/src/features/review/v2/{AccordionRow,ExpandedBlock}.tsx` | EDIT (own files) | `AccordionRow` shows the violet "AI agrees" tag when `view.twins[row.f.id]` exists; `ExpandedBlock` puts twin provenance, model and confidence in Details. (If Phase A already wires the optional `twin` prop, only the call site changes.) |
| `apps/web/e2e/findings-v2-dedupe.spec.ts` | CREATE | One merged row with "AI agrees"; acting on it moves the primary and the twin never appears as a second row; counts and counsel questions count once. Fixture source resolved at C0 (an existing recorded-AI fixture that overlaps a rule finding, or a jsdom render of `useReviewView` seeded through `useReview.setState` and `setAiFindings`). |
| `apps/web/src/features/review/v2/findings-v2-dedupe-view.test.tsx` | CREATE | Hybrid jsdom: seed `result.findings` with one rule and one overlapping ai finding; the view has 1 row, `twins` has 1 entry, triage on the twin id shows on the primary. |

### Phase C Implementation Checklist

- [ ] C0. Re-run Phase A and B gates; confirm `use-review-view.ts` is unchanged by Variance since Phase B Step 0; find the AI-plus-rule overlap fixture (record the choice); the tie rule is recorded as the answer to NOTES Q2 and flagged for design confirmation in the report.
- [ ] C1. Edit `use-review-view.ts` (3 lines). Run `findings-v2-dedupe`, `findings-v2-dedupe-view`, `typecheck`, web vitest once.
- [ ] C2. Wire the `twin` display (AccordionRow and ExpandedBlock) if not already wired.
- [ ] C3. Create `findings-v2-dedupe.spec.ts`; run it and the counts-sensitive specs (`filter-sort`, `metrics`, `counsel-gate`, `a11y-smoke`) one per call.
- [ ] C4. Commit alone: `feat: merge AI suggestions that repeat a rule finding (findings v2 step 2)`.
- [ ] C5. EVL, review, UPDATE PROCESS, deploy per Hard Rule 5 if not already deployed with Phase B.

### Phase C acceptance

AC-12 holds end to end; counts, counsel questions and the gate count the merged issue once; undoing the action restores both; the AI-off and render-first paths are unchanged; no live AI call is made.

### Phase C Phase Loop Progress

- [ ] 1 RESEARCH - C0
- [ ] 2 INNOVATE - n/a (D-7)
- [ ] 3 PLAN-SUPPLEMENT - Inner Loop Refresh Note only if Phase B changed contracts
- [ ] 4 PVL
- [ ] 5 EXECUTE
- [ ] 6 EVL
- [ ] 7 UPDATE PROCESS - archive the whole plan folder when Phase C is VERIFIED

---

## Acceptance Criteria (mapped to design D1-D15; each names its proving gate)

| ID | Design | Criterion | proven by | strategy |
|---|---|---|---|---|
| AC-1 | D1 | Bar has exactly two equal buttons ("Ask counsel" filled, "Close issue" outline), no help text; change rows read "Ask owner" and "Mark as expected..." | `findings-v2-panel-ui`; Phase B `findings-v2.spec.ts` bar test | Hybrid |
| AC-2 | D1, D-3 | Ask counsel on blocking calls `accept(id)`, on non-blocking `needsCounsel(id)`; never a toggle on an acted row | `findings-v2-action-plan`, `findings-v2-actions-flow` | Fully-Automated |
| AC-3 | D2 | Close issue opens the modal with the 5 reasons; "Real issue" hidden on blocking; Other needs a note; no reason shows an error; Real issue calls `accept`, others `dismiss(id, reason, note)` | `findings-v2-reasons-map`, `findings-v2-panel-ui`, `dismiss-requires-reason` (Phase B) | Fully-Automated + Hybrid |
| AC-4 | D3 | Bar pinned at panel bottom, disabled with nothing open, "Move back to review" for sent or closed, next To-review row opens after an action | `findings-v2-action-plan`, `findings-v2-actions-flow`, `findings-v2.spec.ts` | Fully-Automated + Hybrid |
| AC-5 | D4 | Panel 40-65 percent, default 50 (>=1280) or 55, key `ui:v1:fpw`, pointer and keyboard resize, persisted, full width on mobile | `findings-v2-width-math`, `findings-v2-panel-resizer`, `layout-vs-mockup` (Phase B), `findings-v2.spec.ts` | Fully-Automated + Hybrid |
| AC-6 | D5 | One-line 36px rows, detail opens under the clicked row, one at a time, re-click keeps it open | `findings-v2-panel-ui` | Hybrid |
| AC-7 | D6 | Expanded block order and content; Question for counsel from the real counsel draft (`wordingFor`), auto-open on blocking and A/B; A/B plain text; Details collapsed | `findings-v2-panel-ui` | Hybrid |
| AC-8 | D7 | No "Show in document" button; row click and J/K scroll and flash the passage | `findings-v2-panel-ui` (absence), `finding-highlight` and `findings-v2.spec.ts` (Phase B) | Hybrid |
| AC-9 | D8 | Groups To review / Sent / Closed; progress "N of M reviewed" with Counsel, Closed, Left counts; done state | `findings-v2-groups`, `findings-v2-panel-ui` | Fully-Automated + Hybrid |
| AC-10 | D9 | Severity chips plus the existing Filter popover retained | `findings-v2-panel-ui`, `filter-sort` (Phase B) | Hybrid |
| AC-11 | D10 | Calm palette: no hex in features, no gradients, `fv2-` prefix, no `:root` additions, violet only on AI tags | `source-guard`, `tokens-match-mockup`, CSS review in AC-A3, Phase B design-probe screenshots | Fully-Automated + Agent-Probe |
| AC-12 | D11, D-7 | An AI finding overlapping a rule finding (same block, overlapping offsets, same class) merges into one row "AI agrees"; acting on it acts on both; counts once | `findings-v2-dedupe`, `findings-v2-dedupe-view`, `findings-v2-dedupe.spec.ts` (Phase C) | Fully-Automated + Hybrid |
| AC-13 | D12 | Outcome toast with Undo shows the D12 text; the text equals the real recompute | `findings-v2-outcome`, `findings-v2-actions-flow`, `findings-v2-store-parity` (Phase B) | Fully-Automated + Hybrid |
| AC-14 | D13 | Not built in this plan; backlog stub exists for step 3 | `process/features/findings-v2/backlog/findings-v2-step3-flag-passage_NOTE_18-10-26.md` exists | Known-Gap (residual, stub written; gate stays CONDITIONAL for D13) |
| AC-15 | D14 | J/K move, C Ask counsel, X Close issue; ignored while typing, with modifiers, IME, repeat (C and X), or a dialog open | `findings-v2-shortcut-guard`, `findings-v2-shortcuts-hook`, `findings-v2.spec.ts` | Fully-Automated + Hybrid |
| AC-16 | D15 | Zoom: fit default (clamp 90-175, 32px gutter), manual 75-200 step 10, presets, Cmd/Ctrl = - 0, saved in `ui:v1:doczoom`, scroll-to-finding works at every zoom, horizontal scroll above fit | `findings-v2-zoom-math`, `findings-v2-use-doc-zoom`, `findings-v2-zoom-controls`, `findings-v2.spec.ts`; fit-width feel by design-probe | Fully-Automated + Hybrid + Agent-Probe |
| AC-17 | - | Phase A edits no locked file; Phase A runs no browser, build or deploy | Phase A step A4 (scoped boundary proof) | Fully-Automated |
| AC-18 | - | No new screens or sidebar items; render-first preserved; no live LLM call | `findings-v2.spec.ts` (nav list unchanged), `render-first` spec, `no-e2e-hook-in-dist`, deploy preflight | Hybrid |
| AC-19 | D-1 | Test id contract (table above) holds; `aria-label` contains visible text | `findings-v2-panel-ui` | Hybrid |
| AC-20 | D-2 | Change and regression rows keep Variance behavior inside the accordion (diff, impact lines, owner chip and select, Ask owner disabled without owners) | `findings-v2-change-expanded`; Phase B re-run after P05; `variance-owner-override` (repaired) | Hybrid |

## Phase Completion Rules

- A phase is `CODE DONE` when its checklist is complete and committed; it is `VERIFIED` only when the phase's EVL gates are green (independent vc-tester run), the regression tokens are green, and the report lists commands and outcomes. Code-only completion is never VERIFIED.
- Phase A is VERIFIED on vitest evidence only; AC-5, AC-6, AC-8 and AC-16 stay CONDITIONAL until Phase B browser evidence exists (vacuous-green ban: Known-Gap is never a terminal PASS for developed behavior).
- A gate with a Known-Gap residual (AC-14, manual a11y pass) stays CONDITIONAL, with its backlog stub recorded.
- Phase B does not start until the Variance P05-closed message is recorded in the Phase B report.
- Archive the plan folder only when Phase C is VERIFIED (UPDATE PROCESS), not after Phase A or B.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm --filter @aduin/web test findings-v2-reasons-map` | Fully-Automated | AC-3 |
| `pnpm --filter @aduin/web test findings-v2-groups` | Fully-Automated | AC-9 |
| `pnpm --filter @aduin/web test findings-v2-action-plan` | Fully-Automated | AC-2, AC-4 |
| `pnpm --filter @aduin/web test findings-v2-outcome` | Fully-Automated | AC-13 |
| `pnpm --filter @aduin/web test findings-v2-dedupe` | Fully-Automated | AC-12 |
| `pnpm --filter @aduin/web test findings-v2-width-math` | Fully-Automated | AC-5 |
| `pnpm --filter @aduin/web test findings-v2-css-guard` | Fully-Automated | AC-11, AC-A3 |
| `pnpm --filter @aduin/web test findings-v2-shortcut-guard` | Fully-Automated | AC-15 |
| `pnpm --filter @aduin/web test findings-v2-zoom-math` | Fully-Automated | AC-16 |
| `pnpm --filter @aduin/web test findings-v2-actions-flow` | Hybrid | AC-2, AC-4, AC-13 |
| `pnpm --filter @aduin/web test findings-v2-shortcuts-hook` | Hybrid | AC-15 |
| `pnpm --filter @aduin/web test findings-v2-panel-ui` | Hybrid | AC-1, AC-4, AC-6, AC-7, AC-8, AC-9, AC-10, AC-19 |
| `pnpm --filter @aduin/web test findings-v2-change-expanded` | Hybrid | AC-20 |
| `pnpm --filter @aduin/web test findings-v2-panel-resizer` | Hybrid | AC-5 |
| `pnpm --filter @aduin/web test findings-v2-use-doc-zoom` | Hybrid | AC-16 |
| `pnpm --filter @aduin/web test findings-v2-zoom-controls` | Hybrid | AC-16 |
| `pnpm --filter @aduin/web test source-guard` (and `import-graph`, `tokens-match-mockup`, `severity-label`, each its own call) | Fully-Automated | AC-11, AC-17 |
| `pnpm --filter @aduin/web typecheck`; `pnpm exec eslint apps/web/src/features/review/v2 apps/web/src/features/review/zoom`; `pnpm exec prettier --check apps/web/src/features/review/v2 apps/web/src/features/review/zoom apps/web/src/styles/findings-v2.css` | Fully-Automated | AC-17, AC-A3 |
| Scoped boundary proof (see Validate Contract "Boundary proof": `git diff --name-only HEAD -- <locked paths>` empty, `git status --short -- apps/web/src` only allowed paths, `git show --name-only --format= <sha>` per commit) | Fully-Automated | AC-17 |
| Phase B: `pnpm --filter @aduin/web test:e2e findings-v2` (preview project, serial, port 4317); then each repaired spec token one per call; then `pnpm --filter @aduin/web test:e2e` once | Hybrid | AC-1, AC-3, AC-4, AC-5, AC-6, AC-8, AC-10, AC-15, AC-16, AC-18, AC-19, AC-20 |
| Phase B: `pnpm --filter @aduin/web test findings-v2-store-parity` | Hybrid | AC-13 |
| Phase B: `pnpm --filter @aduin/web test:e2e:stack-memory` (11 baseline) | Hybrid | AC-3 (memory write paths unchanged) |
| Phase B: design-probe screenshots at 1440, 1199, 1024; zoom 75, 100, 150, fit (opt-in `DESIGN_PROBE=1`, `pnpm exec playwright test --project=preview design-probe` from `apps/web`) | Agent-Probe | AC-11, AC-16 (visual calm palette, fit-width feel, no horizontal overflow) |
| Phase C: `pnpm --filter @aduin/web test findings-v2-dedupe-view`; `pnpm --filter @aduin/web test:e2e findings-v2-dedupe` | Hybrid | AC-12 |
| Deploy (end of B or C): `pnpm guard:cf`, `pnpm secrets:scan`, a plain web bundle with the public site key inline (scratch script run, see Hard Rule 2), `pnpm --filter @aduin/scripts deploy:preflight`, `pnpm --filter @aduin/worker exec wrangler deploy`, live checks: `/api/health` 200 no-store, findings render in about 1 s, no Turnstile overlay; record the previous live version for `wrangler rollback` | Hybrid | AC-18 |
| Manual keyboard and screen-reader pass over bar, modal, resizer, zoom controls | Known-Gap (residual; stub written) | AC-1, AC-5, AC-15, AC-16 stay CONDITIONAL on this residual |

Gate commands deliberately use `pnpm --filter ... <script>` and `pnpm exec <tool>` with repo-relative source paths, so the Bash text never contains "build", "dist" or "node_modules".

## Known Gaps (Resolved via Backlog)

Named residuals, excluded from the CONCERN/FAIL count by VALIDATE V3 (stub written, never a terminal PASS for developed behavior):

- AC-14 (D13 Flag this passage, Suggest wording): known-gap: documented as NEW PLAN REQUIRED - see `process/features/findings-v2/backlog/findings-v2-step3-flag-passage_NOTE_18-10-26.md`
- Manual keyboard and screen-reader pass over bar, modal, resizer, zoom controls: known-gap: documented as NEW PLAN REQUIRED - same note, section "Residual test stubs" item 1
- Human look at fit-width and the calm palette at 1900px and wider: known-gap: documented as NEW PLAN REQUIRED - same note, item 2

## Residual Test Gaps (Known-Gap, never a terminal PASS)

1. Manual keyboard and screen-reader pass: backlog stub recorded in `findings-v2-step3-flag-passage_NOTE_18-10-26.md` section "Residual test stubs"; also covered by the existing Intake backlog stub for the manual keyboard pass.
2. Human judgment of fit-width feel and calm palette at 1900px and above: Agent-Probe screenshots in Phase B approximate it; a human look stays a residual (same stub).
3. D13 (Flag this passage and Suggest wording): not built here (step 3).
4. Live Turnstile and live AI/OCR remain operator-run residuals from the earlier program (R2, R4); not affected.

## Risk Predictions and Scenario Edge Cases

From the locked Decision Summary (vc-predict CAUTION); scenario edges added here are folded into the tests above.

| Risk | Edge case to test | Gate |
|---|---|---|
| Outcome drift | Accepted blocking finding counts as a counsel question, accepted non-blocking does not; dismissing the last blocker flips "Gate still blocked" to "Gate now ready"; undo restores | `findings-v2-outcome`, `findings-v2-store-parity` |
| Toggle trap | Pressing C twice, X then C on an acted row, double click, key repeat: the second call must be a noop (no accept revoked) | `findings-v2-action-plan`, `findings-v2-actions-flow`, `findings-v2-shortcuts-hook` |
| ChangeExpanded coupling | Change row with no owners; owner override then Ask; regression row (`Regression` chip) | `findings-v2-change-expanded`, Step 0 re-run after P05 |
| Large swap | Revert of the B1 commit returns the old list (keep `FindingRow` until B5) | rollback note; B1 is a single commit |
| ResizeObserver loop and fit | Panel drag changes the area width: only deltas of 2px or more recompute; `scrollbar-gutter: stable` prevents scrollbar jitter; area 0 (hidden pane) returns 90 | `findings-v2-zoom-math`, `findings-v2-use-doc-zoom` |
| `--dz` misses | Every `.paper` descendant in the override table is covered; headings, `.fields`, `.opt`, `.mask`, list items | CSS review (A0, AC-A3), design-probe at 75, 100, 150 |
| Browser-zoom hijack | Cmd/Ctrl +/-/0 inside an input, inside a dialog, or on another route must not be intercepted | `findings-v2-use-doc-zoom` (unmounted and typing cases) |
| Memory asymmetry (NOTES Q1) | Ask counsel on non-blocking writes no memory decision; blocking writes one when a firm is set; behavior unchanged from today | unit and e2e (no new memory write); NOTES Q1 left open |
| Dedupe surprises | Touching ranges, two AI findings on one rule finding, AI severity higher than rule | `findings-v2-dedupe` |
| Selected row vanishes | Row moves to another group or is filtered out after an action: selection moves to the next To-review row or null; the bar disables | `findings-v2-actions-flow`, `findings-v2-panel-ui` |

## Security Note

No auth, billing, secret or Worker surface is touched. The Question for counsel text passes through existing masking (`wordingFor` and `maskQuote` already mask); v2 never renders raw HTML (no `dangerouslySetInnerHTML`); quotes keep masked values with Reveal. `ui:v1:fpw` and `ui:v1:doczoom` are read through guarded storage helpers and validated (`readPct`, `parseZoom`), so tampered values fall back to defaults. Deploy touches only the `aduin-transaction-web` Worker.

## Test Infra Improvement Notes

- Add a `findingsV2Css` slicer to `apps/web/test/support/mockupCss.ts` (Phase B) so layout specs derive v2 widths from `findings-v2.html` instead of hard-coding.
- `apps/web/src/test-utils.tsx` `render()` is minimal (no unmount helper, no cleanup between tests): Phase A tests must unmount their roots in `afterEach` or add a local helper in `v2/` (do not edit `test-utils.tsx`; it is outside the Phase A allowed set).
- Vitest collects `.tsx` only under `src/`; document this in `all-tests.md` at UPDATE PROCESS (a `.tsx` under `apps/web/test/` is silently not run, so a "token not found" exit 1 is the signal).
- jsdom lacks `ResizeObserver` and `matchMedia`: add a shared stub in a v2 test helper rather than per test.

## Touchpoints

See "Phase A Touchpoints", the Phase B files table and the Phase C files table. Read-only imports are listed under Phase A. The Variance blast-radius registry gets one appended section at Phase B Step 0 (P-6).

## Public Contracts

See "Interface Contracts" (module signatures), "Test id and aria contract", "CSS class contract", the two localStorage keys, and the D12 outcome strings. No core contract, snapshot, migration, Worker route or storage schema changes anywhere in this plan.

## Blast Radius

Phase A: new files only (additive, unmounted). Phase B: `FindingsScreen.tsx`, `DocPane.tsx`, `mockupCss.ts`, e2e fixtures and the Derived repair list (about 21 spec and fixture files), 2 new e2e or fixture artifacts, 1 new unit test, removal of 2 dead components, 2 context docs. Phase C: `use-review-view.ts` plus own files and 2 new tests. Shared runtime: Playwright port 4317 (serial), stack-memory ports 4318/8788 never together with preview. Deploy: one Worker version, static assets only.

## Validate Contract

Status: PASS
Date: 18-10-26
date: 2026-10-18
generated-by: outer-pvl
supersedes: 2026-10-18 (outer-pvl) - cycle-2 contract (CONDITIONAL, 0 FAIL, 3 CONCERN); re-validated cycle 3 after PVL supplement cycle 2
Re-validated: cycle 3 (PVL re-run from V1 after supplement cycle 2; scope Phase A; code HEAD 5458b86 unchanged; no file under `packages/` modified, and the working-tree edits under `apps/web/e2e` and `features/open-document` belong to the Variance session). The three cycle-2 CONCERNs (N1 Ask-owner meta source and owner rules, N2 Real-issue accept on change rows, N3 parallel A2 CSS coordination and import order) are resolved in the plan text and were re-verified against real code (evidence in Dimension findings). No new correctness or feasibility problem was found; two style-level facts are carried as execute instructions E28 and E29.
Scope: Phase A only (new-file slice). Phase B and C are outlined coherently and flagged nothing blocking; each gets its own PVL after an `## Inner Loop Refresh Note` once Variance P05 is closed.
Baseline measured at VALIDATE cycle 1 (HEAD 5458b86): `pnpm --filter @aduin/web typecheck` clean; `pnpm --filter @aduin/web test` = 55 files / 375 tests green; `source-guard` 4, `import-graph` 4, `tokens-match-mockup` 1, `severity-label` 3 green; `pnpm --filter @aduin/web test findings-v2` exits 1 ("No test files found"), proving an unmatched token cannot pass vacuously. Cycle 3 ran no build, no Playwright and no test run (read-only); `validate-plan-artifact.mjs` on this plan: 0 failures, 0 warnings.

Parallel strategy: parallel-subagents (A1 sequential first, then A2-UI and A2-ZOOM in parallel, then one serial verify and commit step)
Rationale: 7-signal score 2/7 (S4 three-phase plan, S7 5+ files; S1, S2, S3, S5, S6 absent for Phase A) = MEDIUM. The two A2 agents never need each other's findings mid-run (disjoint directories, fixed CSS class contract), so an agent team is not required. Model: opus only for the three code-writing agents; validate, review and EVL are sonnet.

Test gates (C3 5-column table; each token is its own command, no `--`; confirm more than 0 tests ran per token):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC-3 | Close-issue reason keys map to `ReasonCode`, `real_issue` hidden on blocking, Other needs a note, keys subset of `REASON_CODES` | Fully-Automated | `pnpm --filter @aduin/web test findings-v2-reasons-map` | B |
| AC-9 | Group rule (4 statuses x blocking/non-blocking), stable order, progress totals and `done` | Fully-Automated | `pnpm --filter @aduin/web test findings-v2-groups` | B |
| AC-2, AC-4 | Blocking to `accept`, non-blocking to `needsCounsel`, never a toggle on an acted row, change-row owner rule, `nextToReview`, `barState` labels, move-back guard on answered rows | Fully-Automated | `pnpm --filter @aduin/web test findings-v2-action-plan` | B |
| AC-13 | Exact D12 strings for 4 actions and every gate transition; question count follows the counsel-sheet rule | Fully-Automated | `pnpm --filter @aduin/web test findings-v2-outcome` | B |
| AC-12 | Overlap boundaries, class mismatch, same detector_kind, tie rule, one twin per rule, change rows untouched, `triageWithTwins` fallback | Fully-Automated | `pnpm --filter @aduin/web test findings-v2-dedupe` | B (hookup deferred to Phase C) |
| AC-5 | Clamp, default 50 or 55 at 1280, `readPct` junk, pointer math (right column), key math | Fully-Automated | `pnpm --filter @aduin/web test findings-v2-width-math` | B |
| AC-15 | Ignore list (editable, modifiers, IME, repeat for C and X, open dialog), J/K allowed on repeat | Fully-Automated | `pnpm --filter @aduin/web test findings-v2-shortcut-guard` | B |
| AC-16 | `fitWidth` clamp edges (0, 764, 1900, 4000), in/out from fit and manual, preset clamp, `parseZoom` junk, key mapping | Fully-Automated | `pnpm --filter @aduin/web test findings-v2-zoom-math` | B |
| AC-11, AC-A3 | `findings-v2.css` has no `:root`, no gradient, every selector prefixed per the CSS contract, every Zoom CSS override table row present under `.docscroll[data-dz]` | Fully-Automated | `pnpm --filter @aduin/web test findings-v2-css-guard` (file `apps/web/src/features/review/zoom/findings-v2-css-guard.test.ts`, node environment via the `// @vitest-environment node` docblock as in `test/source-guard.test.ts`; now carried by the plan: Files row 9a, matrix, Verification Evidence, AC-A2; E21 adds a class-usage cross-check) | B |
| AC-2, AC-4, AC-13 | plan, await, select next, capture `toast.undo`, `showToast(text, undo)`, busy flag, rejection path; move-back toast carries no Undo | Hybrid | `pnpm --filter @aduin/web test findings-v2-actions-flow` | B |
| AC-15 | J/K walk, no wrap, C/X only when enabled, listener removed on unmount | Hybrid | `pnpm --filter @aduin/web test findings-v2-shortcuts-hook` | B |
| AC-1, AC-4, AC-6, AC-7, AC-8, AC-9, AC-10, AC-19 | Ids, aria names contain visible text, one open row, bar disabled with nothing open, group moves, progress text, done state, no "Show in document", loading and empty states, `data-memory-state` | Hybrid | `pnpm --filter @aduin/web test findings-v2-panel-ui` | B (browser proof deferred to Phase B) |
| AC-20 | Change row renders Variance parts; bar "Ask owner" disabled with `CHANGE_OWNER_FIRST` when no owners | Hybrid | `pnpm --filter @aduin/web test findings-v2-change-expanded` | B (re-run after P05 at Phase B Step 0) |
| AC-5 | Separator attributes, arrow keys, Home/End, persist only on pointer-up and key | Hybrid | `pnpm --filter @aduin/web test findings-v2-panel-resizer` | B (drag in a browser deferred to Phase B) |
| AC-16 | Stub `ResizeObserver` (2px rule), persistence round trip, keydown only while mounted, typing ignored, `scrollIntoView` after change | Hybrid | `pnpm --filter @aduin/web test findings-v2-use-doc-zoom` | B |
| AC-16 | Control ids, aria names, `aria-pressed` on Fit width, preset menu | Hybrid | `pnpm --filter @aduin/web test findings-v2-zoom-controls` | B |
| AC-11, AC-17 | No hex in features, no new core value import, no `:root` drift, severity labels intact | Fully-Automated | `pnpm --filter @aduin/web test source-guard`, then `import-graph`, `tokens-match-mockup`, `severity-label` (each its own call) | A (green at baseline; re-run after A2) |
| AC-17, AC-A2 | Types, lint, format, full web suite | Fully-Automated | `pnpm --filter @aduin/web typecheck`; `pnpm exec eslint apps/web/src/features/review/v2 apps/web/src/features/review/zoom`; `pnpm exec prettier --check apps/web/src/features/review/v2 apps/web/src/features/review/zoom apps/web/src/styles/findings-v2.css`; `pnpm --filter @aduin/web test` once (expect 55 + new files, 375 + new tests, all green) | B |
| AC-17, AC-A1, AC-A4 | Phase A edits no locked file (boundary proof, see "Boundary proof" below) | Fully-Automated | the three boundary commands below | B |
| AC-11, AC-16 (visual) | Calm palette, fit-width feel, no horizontal overflow | Agent-Probe | Phase B design-probe screenshots (`DESIGN_PROBE=1`); not run in Phase A (no browser) | C |

Failing stubs (Fully-Automated rows only; red-first starting point for execute-agent, copy by Scenario name; not on disk during VALIDATE):

- findings-v2-reasons-map: `test("should map close-issue reason keys to ReasonCode and hide real_issue on blocking", () => { throw new Error("NOT IMPLEMENTED - TDD stub: close-issue reason mapping") })`
- findings-v2-groups: `test("should group rows by status and blocking and report progress", () => { throw new Error("NOT IMPLEMENTED - TDD stub: groups and progress") })`
- findings-v2-action-plan: `test("should never emit accept or needsCounsel for a non-open row", () => { throw new Error("NOT IMPLEMENTED - TDD stub: action plan never toggles") })`
- findings-v2-outcome: `test("should produce the exact D12 text for every action and gate transition", () => { throw new Error("NOT IMPLEMENTED - TDD stub: outcome strings") })`
- findings-v2-dedupe: `test("should merge only an overlapping rule and ai pair of the same class", () => { throw new Error("NOT IMPLEMENTED - TDD stub: dedupe") })`
- findings-v2-width-math: `test("should clamp the panel width to 40..65 and default to 50 or 55", () => { throw new Error("NOT IMPLEMENTED - TDD stub: width math") })`
- findings-v2-shortcut-guard: `test("should ignore typing, modifiers, IME, key repeat for C and X, and open dialogs", () => { throw new Error("NOT IMPLEMENTED - TDD stub: shortcut guard") })`
- findings-v2-zoom-math: `test("should compute fit width and step zoom within 75..200", () => { throw new Error("NOT IMPLEMENTED - TDD stub: zoom math") })`
- findings-v2-css-guard: `test("should keep findings-v2.css free of :root, gradients and unprefixed selectors", () => { throw new Error("NOT IMPLEMENTED - TDD stub: css guard") })`

Boundary proof (replaces the literal "`git diff --name-only` is empty", which cannot pass while the Variance session keeps tracked `process/` files modified in this shared checkout):

1. `git diff --name-only HEAD -- apps/web/src/features/review/FindingsScreen.tsx apps/web/src/features/review/components apps/web/src/features/review/model.ts apps/web/src/features/review/use-review-view.ts apps/web/src/state apps/web/src/styles/base.css apps/web/src/styles/tokens.css apps/web/src/index.css apps/web/src/shell apps/web/src/features/counsel apps/web/src/features/gate apps/web/src/features/compare apps/web/src/features/ai apps/web/src/features/registry.ts apps/web/src/features/variance apps/web/src/App.tsx apps/web/src/e2e-hook.ts apps/web/src/engine apps/web/src/storage apps/web/test/import-graph.test.ts packages` prints nothing (any listed path edited by this plan is a violation). `apps/web/e2e`, `scripts` and `apps/web/src/features/open-document` are deliberately NOT in this command: the Variance session is editing them right now (P05; seen modified at VALIDATE), and Phase A has no reason to touch them; command 3 (the per-commit file list) proves Phase A did not.
2. `git status --short -- apps/web/src` shows only `??` entries (or nothing once committed) under `features/review/v2`, `features/review/zoom` and `styles/findings-v2.css`, and no ` M` or `M ` line.
3. After each plan commit: `git show --name-only --format= <sha>` lists only paths in the Phase A file table (plus none under any locked path).

Legacy line form (retained for existing consumers):
- v2 pure logic: [Fully-automated: the 9 tokens above, one per call] | [known-gap: dedupe is not hooked up until Phase C]
- v2 UI components and glue hooks: [Fully-automated: typecheck + eslint + prettier + `source-guard`] | [hybrid: jsdom tokens `findings-v2-actions-flow`, `-shortcuts-hook`, `-panel-ui`, `-change-expanded`, `-panel-resizer`; precondition: stub `ResizeObserver`, `scrollIntoView`, pointer capture in `v2/test-helpers.tsx`] | [agent-probe: Phase B screenshots] | [known-gap: manual keyboard and screen-reader pass, backlog stub recorded]
- zoom hook, controls and CSS: [Fully-automated: `findings-v2-zoom-math`, `findings-v2-css-guard`, prettier on the css] | [hybrid: `findings-v2-use-doc-zoom`, `findings-v2-zoom-controls`] | [agent-probe: fit-width feel at 75/100/150/fit in Phase B]
- regression: [Fully-automated: `source-guard`, `import-graph`, `tokens-match-mockup`, `severity-label`, full `pnpm --filter @aduin/web test`, `pnpm --filter @aduin/web typecheck`]

Dimension findings (cycle 3):
- Infra fit: PASS - every claim of the supplement was checked against code. Ask-owner meta source: `FindingsScreen.tsx:198` passes `meta={view.variance?.meta[r.f.id]}` and `ChangeRow.tsx:47-48` uses `meta = passMeta ?? regMeta`, so the E23 rule `view.variance?.meta[id] ?? view.regressionMeta[id]` is the real one; `use-review-view.ts` returns `variance: ready ? vResult : null` and `regressionMeta` for the open doc; `useRowOwners` (`OwnerChip.tsx:27-46`) matches E23 line for line (asked owners win; override only when `useOwners.docId === docId`; `load(docId)` in an effect; `useOwners.load` is idempotent so the double load from `useAskOwners` and `useRowOwners` is safe); the disabled rule equals `ChangeRow.tsx:52` (`own.owners.length === 0 && r.status !== 'counsel'`) and the title is `CHANGE_OWNER_FIRST`. `OwnerAsk` is `{owners, source}` (`state/review.ts:206`). `TriageStatus` is re-exported by `features/review/gateInterim.ts`. `a11y-keyboard.spec.ts:125` asserts `tabindex="0"` on the region named "Findings list" (matches the preserved `tabIndex={0}` and class `scroll flist`). `styles/` has no `scan.css`. `showToast(msg, undo)` and `toast.undo` exist (`state/review.ts:156, 877`); `dismiss` returns the next id and sets selection itself (line 852-858); `restore` toast has no undo (line 865).
- Test coverage: PASS - 16 filename-unique tokens, include globs, store-mock header and `// @vitest-environment node` pattern were verified in cycle 2; E21 adds the class-usage cross-check and E25 fixes the `renderV2` helper (it re-implements `createRoot` plus `act`). Residual limits are recorded under "What this coverage does NOT prove" and stay named Known-Gap residuals (not CONCERNs): jsdom has no layout or cascade, so AC-5, AC-6, AC-8, AC-16 are proven in jsdom only until Phase B. Vacuous-green check: every developed behavior in Phase A has a Fully-Automated or Hybrid gate; Known-Gap rows exist only for D13 (not built here) and the manual keyboard and screen-reader pass.
- Breaking changes: PASS - Phase A adds files only; nothing mounts the panel, shortcuts or zoom hook; no core, Worker, migration or storage-schema change; `import-graph` ALLOWED list contains `mask`, `maskQuote`, `templateQuestionText`, `computeGate`, `buildCounselSheet`, `REASON_CODES`; type imports are free.
- Security surface: PASS - no auth, billing, secret or Worker surface; quote and question text render as plain text; the two localStorage keys are read through guarded helpers and validated; the note input keeps the 500 character cap.
- Section A1 pure logic: PASS - `gatesReview(r) = r.sev === 'block' || r.f.kind === 'change'` was checked against the real gate. `sev === 'block'` is exactly `severity === 'critical'` (`severity.ts` `sevKey`), the same test the store uses for questions (`owner-groups.ts` `isErrorQuestion`: counsel, or accepted and critical), so an accepted blocking row is a counsel question and belongs in Sent. The core gate (`counsel/gate.ts` `computeVarianceGate`) treats every `gates: true` change row as eligible (`untriaged_change_blocks` is `true` in `variance-rules.json:219`, `regression_blocks` for critical) and an accepted one maps to `unanswered`, so an accepted change row cannot be Closed; without a baseline only regression rows exist, they are critical and `isGating` (non-AI) holds, so the result is the same. Regression findings are `kind: 'change'` FindingViews (`engine.worker.ts:527, 600`; the "regression" word lives in `meta.kind` and `pattern_key VAR-REG-SCOPE-EXISTS`), so `gatesReview`, `planControl` (change rows first, never `accept`) and `closeReasonsFor` already cover regression rows. `isBlocking` (severity) and the store notion agree; no change needed. One accepted divergence: AI-detected critical rows never gate, but an accepted one is still a question (store rule), so Sent is the consistent group (P-1 and E24 stay as written). `simulateStatus` shapes verified against `state/review.ts` 787-866.
- Section A2-UI components and glue: PASS - Interface Contracts are consistent for parallel work: the only store-touching module is `use-finding-actions.ts` (A2-UI.0 files first, E27); `reasons-map.ts` imports `gatesReview` from `./groups` (no cycle: `groups.ts` has type-only imports); `computeOutcome` imports `questionRows` and `reviewGate` as read-only; the A1 signatures (`groups`, `action-plan`, `outcome`, `reasons-map`, `width-math`, `shortcut-guard`, `zoom-math`) are sufficient for the A2 agents to code against before A1 is merged because A2 starts after the A1 commit. Style-level facts carried as E28 (row attribute parity with `ChangeRow`) and E29 (`gatesReview` mirrors the shipped policy values).
- Section A2-ZOOM zoom and CSS: PASS - the E21 attribute-hook table plus the cross-check and the E22 barrel-only CSS import remove the parallel-agent coupling; the Zoom CSS override table was verified in cycle 2; the `.work` media rules and `.work > .fp{order:-1}` exist in `base.css` (lines 556, 1684, 1722-1732).
- Phase B and C outline: PASS (coherence only, non-blocking) - targets are plausible and the plan already requires Step 0 re-sync. Notes for Phase B Step 0 (not blockers): the Variance working tree adds an `a11y-keyboard.spec.ts` P05 case that asserts `data-kind="change"` on the focused change row and `getByTestId('change-type')` text `New|Logic` inside the row (line 215-216; handled by E28 in Phase A), the original `tabTo(page,'action-accept',40)` at line 160 must be retargeted, and the new P05 specs (`variance-demo-214-to-7`, `variance-demo-gate-walk`, `variance-package-samples`) must be added to the B0.4 `action-*` recount.

Open gaps:
- AC-14 (D13 Flag this passage, Suggest wording): known-gap: documented as NEW PLAN REQUIRED - see backlog/findings-v2-step3-flag-passage_NOTE_18-10-26.md
- Manual keyboard and screen-reader pass over bar, modal, resizer, zoom controls: known-gap: documented as NEW PLAN REQUIRED - see backlog/findings-v2-step3-flag-passage_NOTE_18-10-26.md (section "Residual test stubs", item 1)
- Human look at fit-width and calm palette at 1900px and wider: known-gap: documented as NEW PLAN REQUIRED - see backlog/findings-v2-step3-flag-passage_NOTE_18-10-26.md (item 2)
- Product questions carried as recorded decisions, not blockers: NOTES Q1 (memory asymmetry unchanged), NOTES Q2 (rule finding wins id and severity; provisional), P-7 (Closed group hides dismissed rows under the default Status filter), P-8 (resizer step 2 and 10; resolved), P-9 (modal title), P-10 (Real issue on change rows: design question for the report).

What this coverage does NOT prove:
- The pure-logic tokens prove behavior on fixtures only: they do not prove that the simulated D12 outcome equals the real store recompute (Phase B `findings-v2-store-parity`), nor any real Playwright run.
- The jsdom tokens (`actions-flow`, `shortcuts-hook`, `panel-ui`, `change-expanded`, `panel-resizer`, `use-doc-zoom`, `zoom-controls`) do not prove layout, real pointer dragging, focus order, scroll-to-finding and flash in `DocPane`, fit width on a real `ResizeObserver`, browser Cmd/Ctrl zoom interception, or that the CSS renders as designed (jsdom has zero layout and no stylesheet cascade).
- `findings-v2-css-guard` proves the CSS text rules only, not that `--dz` scaling reaches every real `.paper` child at 75, 100, 150 or fit.
- `findings-v2-actions-flow` uses `vi.fn` store actions: it does not prove memory writes, the undo callback against the real store, or that a rejected real action leaves the store consistent.
- `findings-v2-change-expanded` stubs the owner store: it does not prove owner override persistence or regression-row behavior after Variance P05 (re-run at Phase B Step 0).
- Regression tokens prove no hex, no new core value import, no `:root` drift and severity labels, not that existing screens are unchanged at runtime (nothing is mounted in Phase A).
- Nothing in Phase A proves accessibility with a real keyboard or screen reader, the e2e specs that reference `action-accept`, deploy, render-first, or the Phase C dedupe hookup.
- Cycle 2: the jsdom tokens cannot prove that a class used by a component is styled (only the E21 cross-check in `findings-v2-css-guard` proves it exists), nor that the owner rules of E23 match the real owner store on a document with a baseline (Phase B Step 0 re-run), nor that accept on a change row never happens through memory restore of an older decision.
- Cycle 3: `gatesReview` is static (blocking severity or change row): it does not read the live `VarianceGatePolicy`, so if a firm later ships `untriaged_change_blocks: false` the group of an accepted change row would still be Sent (the shipped rules value is `true`); no gate command proves the policy-off case.

Plan updates applied (V6, mechanical corrections of verified facts; no contract redesign):
- P1: Resolved Open Questions row e and Test Infra Improvement Notes: `src/test-utils.ts` corrected to `src/test-utils.tsx`.
- P2: Phase A Touchpoints: `QuoteBody` is private in `FindingRow.tsx` (re-create in `v2/`); `Provenance` and `AI_SUGGESTION` come from `features/ai/Provenance`, `LocatorChip` from `features/ai/Locator`; `Banners` stays in `FindingsScreen`.
- P3: AC-A1, checklist A4 and the Verification Evidence boundary row now point to the scoped "Boundary proof" in this contract.
- P4: Phase A Blast Radius baseline updated to the measured 55 files / 375 tests.
- P5: new section `## Known Gaps (Resolved via Backlog)` (AC-14, manual keyboard pass, fit-width human look) pointing at the existing backlog stub.
- P6: A2-UI.4 panel composition: `banners` removed from the panel (Banners stays in the screen) and the loading, empty, error states with the preserved ids are named.
- P7: `Current Execution State` updated to the PVL first-pass result.
- Cycle 3 (re-validation): VALIDATE edited no plan body text except this Validate Contract, `Current Execution State` and the `Autonomous Goal Block` (refreshed to the post-supplement state). Execute instructions E28 and E29 are added below; they are binding execute-agent instructions and, where E28 differs from the Interface Contracts text on `data-kind`, E28 wins.

Execute-agent instructions (apply to Phase A; the supplement cycle folds the contract-level ones into the plan checklist):
- E1 Export facts (A0): `Owner` is `import type { Owner } from '@aduin/core'`; `isErrorQuestion`, `isChangeRow`, `askedOwners`, `effectiveOwners` come from `features/variance/owner-groups`; `useOwners` from `features/variance/owner-store`; `OwnerAsk` from `state/review`; `Provenance`/`AI_SUGGESTION` from `features/ai/Provenance`; `LocatorChip` from `features/ai/Locator`; `view.variance?.gatePolicy` is the `policy` argument and `view.regressionMeta[id]` is the regression meta. Record any other difference in the Phase A report; never edit a locked file to fix it.
- E2 Re-create `QuoteBody` in `v2/QuoteBody.tsx` (reads `useReview` `revealed`, `toggleReveal`, the block text; masks with `mask` from `@aduin/core`, already ALLOWED; keeps testid `reveal-toggle`; no raw HTML). (addressed in supplement cycle 1)
- E3 `simulateStatus` mirrors the store: accept keeps prior triage and sets `accepted`; needsCounsel sets `counsel` (change rows with owners add `ownerAnswers[o] = null`); dismiss writes `{status:'dismissed', reasonCode}` and drops `ownerAnswers`; restore writes `{status:'open'}`. `restore` shows no Undo (the store gives none): the move-back toast calls `showToast(text, null)`. (addressed in supplement cycle 1)
- E4 `planControl('move-back')` returns `noop` with reason `answered` when the row has a recorded answer (`triage.counselAnswer` set, or any non-null `ownerAnswers` value); `barState` exposes the disabled state; test it. Reason: `restore()` would drop the local answer while the memory decision stays. (addressed in supplement cycle 1)
- E5 "Ask owner": add `v2/use-ask-owners.ts` (null-safe; reads `useOwners` choices, `askedOwners`, `effectiveOwners`, meta from the view) returning `{ ask, askDisabled }` for the selected row; `ActionBar` gets `askDisabled` and the `CHANGE_OWNER_FIRST` title; `useFindingActions.ask(id)` builds the `OwnerAsk` for change rows from the same source (imperative `useOwners.getState()` read, not a hook). `ChangeExpanded` renders only the read-only Variance parts (diff, impact, owner chip and select, provenance). (addressed in supplement cycle 1)
- E6 `FindingsPanelV2` keeps: root `findings-column` with `data-memory-state` (same derivation as `FindingsScreen`), the scroll region `role="region" aria-label="Findings list"`, `findings-list` on the `ul`, `empty-state` copy, `loading-state` ("Reading the document…") and the empty or error state with the "Open a document" button (`useShell` `setOpenDoc`), `CosmeticGroups`, `PreviouslyHandledRow`; it does not import `Banners`. (addressed in supplement cycle 1)
- E7 jsdom: put shared stubs and a render helper that returns `{ container, unmount }` in `v2/test-helpers.tsx` (set `IS_REACT_ACT_ENVIRONMENT`; stub `ResizeObserver`, `matchMedia`, `Element.prototype.scrollIntoView`, `setPointerCapture`, `releasePointerCapture`); production code calls `scrollIntoView` and pointer capture optionally; every test unmounts its root in `afterEach`; do not edit `src/test-utils.tsx`. (addressed in supplement cycle 1)
- E8 Tests that import the review store copy the header of `test/variance-counts-selector.test.ts` (`fake-indexeddb/auto`, `vi.mock` of `api/client` and `features/ai/ai-lane`, dynamic imports after the mocks), with paths rewritten for `src/features/review/v2/`.
- E9 Every file under `src/features/**`, tests included: no `#` followed by 3 to 8 hex characters and a word boundary, no `dangerouslySetInnerHTML`, no `.innerHTML =`, no default shadcn color class names.
- E10 A2 concurrency: the A2-UI and A2-ZOOM agents run only their own vitest tokens; they do not run project-wide `typecheck`, `eslint` on the directories, or any `git` write. One serial step after both finish runs A3 and A4 and makes the commits with `git add <paths>` then `git commit -m "<msg>" -- <paths>` (pathspec on commit so nothing another session staged is swept in); check `git diff --cached --name-only` first. (addressed in supplement cycle 1)
- E11 `dedupeFindings`: process rule findings in input order; each takes the largest-overlap AI finding that is still unused (tie: lowest `order`, then lowest id). (addressed in supplement cycle 1)
- E12 Resizer keys: `FPW_STEP = 2` and `FPW_STEP_BIG = 10` (P-8, mockup parity; supersedes the earlier 1 and 5); the width-math and resizer tests assert 2 and 10. (resolved in supplement cycle 1; text corrected in cycle 2)
- E13 Group header counts come from `view.visible`, progress from `view.main` (P-1). Under the default Status filter `active` dismissed rows are not in `view.visible`; panel tests that assert the Closed group seed the filter to `all`; record the observation in the report as a design question. Do not change the filter. (addressed in supplement cycle 1)
- E14 `CloseIssueModal` title is "Re-confirm this dismissal" when `row.label === 'dismissed_reconfirm'` (parity with `DismissModal`); the call is the same. (addressed in supplement cycle 1)
- E15 Do not use `CSS.escape` in code paths a jsdom test reaches without checking it exists; render the modal testids from the contract.
- E16 Zoom out and in buttons: no minus icon exists; use a text glyph for the minus and the `plus` icon (or text) for the plus; do not edit `icons/sprite.tsx`.
- E17 After each A1 module and test is green, run that token alone; never run two vitest processes against the same token at once; one token per call, no `--`.
- E18 Create `zoom/findings-v2-css-guard.test.ts` (node environment, no hex literals in its source): reads `src/styles/findings-v2.css`, asserts no `:root`, no `gradient`, every top-level selector starts with `.fv2`, `.fv2-`, `.docscroll[data-dz]`, `.work.fv2-work` or `.work > .fv2` (media blocks included), and that each row of the Zoom CSS override table appears under `.docscroll[data-dz]`. (addressed in supplement cycle 1)
- E19 Evidence for the report: for each token record the command, the exit code and the tests-run count; the full-suite count must be at least 375 plus the new tests with all green.
- E20 Commit trailer as planned (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`); no push; never `git stash`, `checkout`, `reset`, `restore`, `git add -A` or `git add .`.
- E21 (N3a) CSS class contract check: extend `findings-v2-css-guard` so every `fv2-*` token found in a `className` string of a non-test file under `v2/` and `zoom/` is defined as a class selector in `findings-v2.css` (tests read the files with `node:fs`; no hex literals in the test source). The UI agent uses only the class names of the CSS class contract and expresses state through attributes that already exist in the Test id and aria contract: `[aria-expanded]` and `[data-severity]` and `[data-status]` and `[data-kind]` on the row, `[data-group]` and `[data-count]` on group headers, `:disabled` and `[aria-pressed]` on buttons, `[aria-valuenow]` on the resizer, `[data-fv2]` on the root; the progress fill width is an inline `style={{ width }}` or a custom property set inline. The CSS agent styles those attribute selectors. The cross-check runs in the serial verify step after both agents finish; a failure there is fixed serially (no cross-talk is needed during A2). (addressed in supplement cycle 2)
- E22 (N3b) CSS import location: `styles/findings-v2.css` is imported only from the barrels `v2/index.ts` and `zoom/index.ts`; no component, hook or test file imports it, so no jsdom test depends on the order in which the two parallel agents create files. Phase B imports the panel through `../v2` and the zoom parts through `../zoom`. (addressed in supplement cycle 2)
- E23 (N1) Ask-owner source: `useAskOwners(row, view)` and `buildOwnerAsk(row, view)` copy `useRowOwners` (`features/variance/OwnerChip.tsx`): `meta = view.variance?.meta[row.f.id] ?? view.regressionMeta[row.f.id]`; `asked = askedOwners(row.triage)`; `owners = asked.length ? asked : effectiveOwners(meta?.owners ?? [], override).owners` and `source` from the same call; `override` is read only when `useOwners.docId` equals the open document id (`useReview` `doc.id`); the hook calls `useOwners.load(docId)` in an effect; `askDisabled = isChangeRow(row) && owners.length === 0 && row.status !== 'counsel'` with title `CHANGE_OWNER_FIRST`; non-change rows give `{ask: null, askDisabled: false}`. `AccordionRow` passes the same meta union to `ChangeExpanded`. Tests: an ordinary change row with `variance.meta[id].owners = ['gp']` enables Ask owner and builds `{owners:['gp'], source:'suggested'}`; an override to `you` disables it; asked owners win over the override. (addressed in supplement cycle 2)
- E24 (N2) Real issue on change rows: add `gatesReview(r) = r.sev === 'block' || r.f.kind === 'change'` to `groups.ts`; `groupOf` puts an accepted row in `sent` when `gatesReview(r)` (else `closed`); `closeReasonsFor` and `CloseIssueModal` hide `real_issue` when `gatesReview(row)`; `isBlocking` stays severity-based and `planControl` keeps routing change rows first (they never reach `accept` through the bar). Add cases to `findings-v2-groups`, `findings-v2-reasons-map` and `findings-v2-panel-ui`. If product wants "Real issue" on change rows, record it as a design question in the report instead of enabling it. (addressed in supplement cycle 2)
- E25 Facts and small fixes: import `TriageStatus` from `../gateInterim` (not `@aduin/core`); A0 greps `apps/web/src/styles/*.css` (there is no `scan.css`); the list region keeps `tabIndex={0}` and `className="scroll flist"` (add `tabindex` to the panel-ui assertions); the note textarea keeps `maxLength={500}`; `renderV2` re-implements `createRoot` plus `act` and returns `unmount` (the `render` of `src/test-utils.tsx` keeps no root); after J/K `select(id)` the shortcuts hook focuses the row with `requestAnimationFrame` and `focus({preventScroll: true})` like the old handler (`focusRow`); shortcut guard selector is `[role="dialog"]`. (addressed in supplement cycle 2)
- E26 A1.7 commit uses the same form as A5: `git add <A1 paths>`, check `git diff --cached --name-only`, then `git commit -m "<msg>" -- <A1 paths>`. (addressed in supplement cycle 2)
- E27 Order inside A2-UI: create the A2-UI.0 files (`test-helpers.tsx`, `QuoteBody.tsx`, `use-ask-owners.ts`) before `use-finding-actions.ts`, which imports `buildOwnerAsk`. (addressed in supplement cycle 2)
- E28 Row attribute parity with the shipped change row (`features/variance/ChangeRow.tsx:56-70`, and the Variance P05 case at `e2e/a11y-keyboard.spec.ts:215-216`): `AccordionRow` emits `data-kind` equal to `row.f.kind` (`error` or `change`; a regression row is a `change` row, so its `data-kind` is `change`, not `regression`), plus `data-change-type={meta?.change_type ?? 'changed_logic'}` on change rows and `data-regression="1"` when `meta.kind === 'regression'`; a change row's button line keeps the `change-type` chip (text `New`, `Regression` or `Logic`, with the sr-only ": change vs baseline." suffix), the `finding-title` and the `owner-chip`; every error row button keeps its screen-reader severity label ("Blocks digitization:", "Fix before build:" or "Note:", from `SEV`) because `a11y-keyboard.spec.ts:121` matches `/Blocks digitization:|Fix before build:|Note:/` on the row text. The CSS agent styles `[data-regression]` in addition to the E21 hooks; `findings-v2-panel-ui` and `findings-v2-change-expanded` assert `data-kind`, `change-type` text and the severity word.
- E29 `gatesReview` is a static approximation of the shipped gate policy (`untriaged_change_blocks: true`, `regression_blocks: true` in `packages/core/src/variance/variance-rules.json`); put that sentence in its doc comment and do not read the live policy inside `groups.ts` (keeps A1 pure and `groupRows` signature stable). If a later phase wants the policy-aware form, add an optional second argument then.

Gate: PASS (0 FAILs, 0 CONCERNs after the cycle-3 re-validation; all prior CONCERNs resolved in the plan text and verified against real code; three PVL cycles are recorded in `results.tsv` (baseline plus 2 supplement cycles); named Known-Gap residuals AC-14, the manual keyboard pass and the fit-width human look are excluded from the CONCERN count per V3 and remain open with a backlog stub; Phase A will be VERIFIED on vitest evidence only (after EVL) and AC-5, AC-6, AC-8, AC-16 stay CONDITIONAL until Phase B browser evidence.)
Accepted by: n/a for the gate (Gate is PASS, no CONCERN to accept); residual Known-Gap items carried by name: AC-14 D13 not built here (backlog stub), manual keyboard and screen-reader pass (backlog stub), fit-width human look at 1900px and wider (backlog stub), `gatesReview` static policy approximation (E29), Closed-group-versus-filter visibility (P-7), Real issue on change rows (P-10 design question)

## Autonomous Goal Block

```
SESSION GOAL: Findings v2 (D1-D15) - Phase A new-file slice, then Phase B/C after Variance P05 closes
Charter + umbrella plan: N/A - single plan: process/features/findings-v2/active/findings-v2_18-10-26/findings-v2_PLAN_18-10-26.md
Autonomy: autopilot standing consent (feedback_autonomous_phase_execution.md): auto-proceed on reversible gates, EXECUTE=opus else sonnet, PVL/EVL loops cap 10, BLOCKED -> backlog and continue. Subagent delegation stays mandatory (no inline execution).
Hard stop conditions / safety constraints:
- Phase A touches ONLY new files under apps/web/src/features/review/v2/, features/review/zoom/, styles/findings-v2.css (plus co-located tests); no locked Variance file, no Playwright, no build, no deploy
- Phase B waits for the Variance session to say P05 is closed, then Step 0 re-sync and a new Inner Loop Refresh Note
- Never git stash/checkout/reset/restore, never git add -A or ., no push; commits are local on main with pathspec commit
- No new @aduin/core value import outside the import-graph ALLOWED list; no hex colors in features; no raw HTML
- Deploy only to aduin-transaction-web.giathaowork.workers.dev after EVL and review; never touch zone itsjiathao.com; no live LLM calls
- Cascade BLOCKED (two phases) stops the run
Next phase: EXECUTE Phase A: process/features/findings-v2/active/findings-v2_18-10-26/findings-v2_PLAN_18-10-26.md (validate-contract is PASS after PVL cycle 3)
Validate contract: inline in the plan (## Validate Contract), Gate PASS, re-validated cycle 3 (E1-E29 binding; E28 wins over the contract text on data-kind)
Execute start: A1 pure logic (1 opus agent), then A2-UI + A2-ZOOM (2 opus agents, parallel, own tokens only; create A2-UI.0 files first), then one serial verify+commit. Gates, one token per call, no "--": pnpm --filter @aduin/web test findings-v2-reasons-map | -groups | -action-plan | -outcome | -dedupe | -width-math | -shortcut-guard | -zoom-math | -css-guard | -actions-flow | -shortcuts-hook | -panel-ui | -change-expanded | -panel-resizer | -use-doc-zoom | -zoom-controls; regression source-guard, import-graph, tokens-match-mockup, severity-label; then pnpm --filter @aduin/web typecheck and the full web suite (baseline 55 files / 375 tests) | e2e: none in Phase A | probe: Phase B design-probe | high-risk pack: no
```

## Supplement Log

- 2026-10-18, PVL-supplement cycle 1 (vc-plan-agent, scope-fenced to the 5 SUPPLEMENT REQUEST gaps):
  - Gap 1 addressed: new checklist item A2-UI.0 and the "Panel keeps these ids and states" sub-list in A2-UI.4; Files table rows 10a; Interface Contracts for `use-ask-owners.ts`, `QuoteBody.tsx`, `test-helpers.tsx`; `FindingsPanelV2` and `ActionBar` contract lines (E2, E5, E6, E7, E8).
  - Gap 2 addressed: `findings-v2-css-guard` added to the test matrix, Files table (row 9a), Verification Evidence and the AC-A2 count (16 tokens) (E18).
  - Gap 3 addressed: noop reason `answered` and `barState.moveBackEnabled`; rules claim in input order; `simulateStatus` mirrors store triage shapes; matching cases added to the action-plan, outcome and dedupe matrix rows (E3, E4, E11).
  - Gap 4 addressed: A2-UI.5, A2-ZOOM.1 and A5 now say A2 agents run only their own tokens, serial typecheck, eslint, A3, A4 and commits, and `git commit -m ... -- <paths>` with the Co-Authored-By trailer (E10).
  - Gap 5 addressed: Plan-Level Decisions P-7 (group counts vs progress), P-8 (resizer step 2 and Shift 10, supersedes 1 and 5), P-9 (modal title) (E12, E13, E14).
  - Validate Contract body untouched except "(addressed in supplement cycle 1)" annotations on E2-E7, E10-E14, E18.
- 2026-10-18, PVL-supplement cycle 2 (vc-plan-agent, scope-fenced to the 3 cycle-2 SUPPLEMENT REQUEST gaps; no Inner Loop Refresh Note written):
  - Gap 1 addressed (interface-contracts): `useAskOwners` and `buildOwnerAsk` carry the full E23 rule set (meta = variance meta ?? regression meta, asked owners win, override only when `useOwners.docId` equals the open doc, load trigger, explicit disabled rule with `CHANGE_OWNER_FIRST`); the three E23 tests are in the `findings-v2-panel-ui` and `findings-v2-change-expanded` matrix rows.
  - Gap 2 addressed (interface-contracts): `gatesReview(r)` added to the `groups.ts` contract and used by `groupOf` and `closeReasonsFor(row)` (hides `real_issue` when blocking or change rows); cases added to the groups, reasons-map and panel-ui matrix rows; P-10 records "accept on change rows" as a design question (E24).
  - Gap 3 addressed (phase-a-implementation-checklist and CSS class contract): E21 state-variant and attribute-hook table, class-usage cross-check in `findings-v2-css-guard` (matrix row and A2-ZOOM.1), E22 CSS-import-only-from-barrels rule (A2-UI.4, A2-ZOOM.1), E25 one-liners (TriageStatus path, no `scan.css`, `tabIndex={0}`, `maxLength={500}`, `renderV2` with `createRoot` and `act`, J/K row focus), E26 (A1.7 pathspec commit), E27 (A2-UI.0 files before `use-finding-actions.ts`).
  - Validate Contract body untouched except "(addressed in supplement cycle 2)" annotations on E21-E27.

## Current Execution State

- Last updated: 18-10-26 (Phase A UPDATE PROCESS, light inter-phase; plan NOT archived)
- Current phase: A of A, B, C
- Current loop step: Phase A steps 1-7 complete
- Phase A status: VERIFIED (commits 9e866f2, 7a0d172, 597c9cf; web 71 files / 515 tests; source-guard, import-graph, tokens-match-mockup, severity-label, 16 findings-v2-* tokens (140 tests), typecheck, eslint, prettier, boundary proof B1-B3 green)
- Phase A known gaps: AC-5/6/8/16 browser proof deferred to Phase B; manual keyboard and screen-reader pass; fit-width human look (Phase B agent-probe); AC-14 residual
- Phase A report: `process/features/findings-v2/active/findings-v2_18-10-26/findings-v2-phase-a_REPORT_18-10-26.md`
- Design session (18-10-26) confirmed all provisional decisions: Q1, Q2 rule-wins, D12 count, P-7, P-8, P-10, default width 50/55, action-accept retired, step 3 backlog. Still open for design: non-blocking "Ask counsel / Real issue" toast says gate blocked (1) (real gate behavior).
- Phase B status: PLANNED, blocked on Variance P05 close
- Phase C status: PLANNED, blocked on Phase B
- Validate-contract status: written 18-10-26 (PASS, outer-pvl, Phase A scope; Phase B and C need an Inner Loop Refresh Note and their own PVL)
- Next action: WAIT for the Variance P05 close message, then Phase B Step 0 re-sync (re-run Phase A gates at B0.5), Inner Loop Refresh Note, inner PVL

## Resume and Execution Handoff

- Selected plan file (the only execute anchor): `process/features/findings-v2/active/findings-v2_18-10-26/findings-v2_PLAN_18-10-26.md`. Supporting artifacts: `findings-v2_DECISION_18-10-26.md`, `findings-v2_RESEARCH_18-10-26.md`, `findings-v2_AUTOPILOT_GOAL_18-10-26.md`.
- EXECUTE receives ONE phase at a time: Phase A now. Do not start Phase B until the Variance session says P05 is closed and Step 0 finished.
- Execute strategy for Phase A: A1 (1 opus agent), then A2-UI and A2-ZOOM in parallel (2 opus agents, disjoint directories, interfaces fixed above); sequential test runs; per-section test gate after each checklist section; pathspec-only commits with the Opus 5.5 trailer; no push; never stash, checkout, reset or restore.
- Context to pass: `process/context/all-context.md` plus `find process/context/ -type f`; `process/development-protocols/{orchestration,plan-lifecycle,implementation-standards}.md` (explicit read; not discoverable through the context router).
- Validators to run by hand at closeout: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs process/features/findings-v2/active/findings-v2_18-10-26/findings-v2_PLAN_18-10-26.md`; `node .claude/skills/vc-audit-vc/scripts/validate-agent-parity.mjs --strict` only if agent surfaces change (they do not in this plan); `vc-audit-context` after the `all-ui.md` and `all-tests.md` updates.
- After compaction: read this plan, the Current Execution State, then the Phase A report; re-run `git status --short` and the Phase A tokens to see what exists.
- Step 3 (Flag this passage, Suggest wording) is out of scope: `process/features/findings-v2/backlog/findings-v2-step3-flag-passage_NOTE_18-10-26.md`; it needs its own SPEC and PLAN after Phase B ships.
- Deploy hand-off: Hard Rule 5; message the design session after deploy; message the Variance session before editing any Variance-owned spec.
- Process deviation (18-10-26): the harness refused vc-plan-agent file writes during creation, so with the user's approval the orchestrator wrote DECISION, PLAN and the step-3 backlog NOTE verbatim from the agent's draft; later supplement and validate edits were applied by the subagents themselves.
