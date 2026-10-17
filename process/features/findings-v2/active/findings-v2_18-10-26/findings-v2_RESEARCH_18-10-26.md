---
name: report:findings-v2-research
description: "Read-only research for the Findings v2 redesign: current Findings anatomy, action wiring, test ids, Variance overlap, styling, DocPane zoom hooks, dedupe and test infra"
date: 18-10-26
metadata:
  node_type: memory
  type: report
  feature: findings-v2
  phase: research
---

# Findings v2 - RESEARCH (18-10-26)

```yaml
context-envelope:
  feature: findings-v2
  phase: RESEARCH
  session-goal: map the Findings screen blast radius for the v2 redesign (design-owned mockup + NOTES D1-D15)
  branch: main
  worktree: main
  context-group: ui, tests, engine, worker (routers read)
  blast-radius-packages: apps/web (features/review, state, styles, e2e, test); packages/core read-only
  active-plan: none yet (goal file only)
  test-runner: vitest 4.1.12 (jsdom) | playwright 1.64 (preview project)
  validate-contract: none
```

## TL;DR
- Findings v2 step 1 can start in NEW files. FindingsScreen, DocPane, FindingRow and model.ts are the seams; no resizer, no `ui:v1:fpw`, no zoom and no C/X shortcuts exist today.
- At research time `git status` shows NO modified source files (only a Variance P04 plan/report). Variance P04 code is committed (838ca1e, a31dff0); P05 plan touches only e2e specs, samples, scripts and deploy, not `apps/web/src`. The lock is a scheduling rule, not a live edit conflict.
- Biggest rename risk: `action-accept/-counsel/-dismiss/-restore` appear 41 times in 21 e2e specs plus 2 source files (FindingRow, Variance ChangeRow).
- Mockup tokens equal `app.html` tokens; the violet AI tag, new CSS and the page layout are NEW and must live in a new CSS file (tokens-match-mockup forbids new `:root` vars in tokens.css).

## Scope and Blast Radius
In: `apps/web/src/features/review/**`, `state/review.ts` actions (read), `styles/*` (new file), `e2e` + `test` specs referencing Findings ids, `features/variance/ChangeRow.tsx` (parallel row type).
Out: core engine, worker, migrations, counsel screen (read for draft text only).

## Q1 Findings screen anatomy (all under apps/web/src/features/review unless noted)
| Piece | File:line | Notes |
|---|---|---|
| Screen shell, header, `.work` grid, `aside.fp`, kind segment, severity chips, FilterMenu, list, Cosmetic groups, PreviouslyHandledRow, DismissModal host | FindingsScreen.tsx:51-256 | VARIANCE-OWNED (seam) |
| J/K shortcuts (window keydown, skips INPUT/TEXTAREA/SELECT, modifiers, open dialog) | FindingsScreen.tsx:~66-90 | only J and K; no C / X |
| Row (one-line button `rowb` + expanded `rbody`, three action buttons) | components/FindingRow.tsx:78-247 | free file but used by the list |
| Change row (parallel component) | features/variance/ChangeRow.tsx | Variance-owned; own `rowb`/`rbody`/`acts` and same testids |
| Filter popover (Class, Status, Sort, Detector, Reset) | components/FilterMenu.tsx | free; reads `useFilters` |
| Dismiss modal (required reason radio, note 500 chars, `dismiss-*`) | components/DismissModal.tsx:1-125 | free |
| Toast | components/UndoToast.tsx:1-31 (state in review.ts: `toast`, `showToast`, `clearToast`; undo 7000 ms else 2600 ms) | free; one string `msg` + `undo()` callback only |
| DocPane reading view + docbar + JumpMenu + scroll/flash | components/DocPane.tsx:1-268 | VARIANCE-OWNED (seam) |
| Scan viewer | features/scan/ScanPane.tsx | separate, not Variance |
| Banners, PreviouslyHandledRow, issue-classes, severity (SEV table), reasons (DISMISS_REASONS), memory-labels, gateInterim | review/* | free except model.ts |
- Panel width: fixed CSS. `base.css:556-561` `.work{grid-template-columns:minmax(0,1fr) 400px}`; `base.css:1684-1686` 380px at max-width 1279. No resizer and no localStorage key (`KEYS` in state/storage.ts:28-32 holds sidebar, filters, ai only). `ui:v1:fpw` is new.
- Scroll-to-finding: DocPane.tsx effect on `[selectedId, selectSeq]` finds `mark[data-testid=doc-highlight][data-finding-id]` inside `.docscroll` ref, `scrollIntoView({block:'center'})`, re-adds class `flash` (CSS `mark.q.flash`, base.css:692, reduced-motion aware). Row click calls `select(id)`; `select` bumps `selectSeq` (review.ts:784).
- Dismiss selects next row itself (review.ts:852). Accept/needsCounsel do NOT advance selection (D3 needs this: "after an action the next finding opens").
- Free vs Variance-owned (per task list): FindingsScreen, DocPane, model.ts, state/{review,package,last-doc}, base.css, GateButton, counsel/*, gate/GateReasons, variance/*, App, e2e-hook, engine/*, storage/db are locked. FREE: FindingRow, FilterMenu, DismissModal, UndoToast, Banners, PreviouslyHandledRow, issue-classes, severity, reasons, memory-labels, gateInterim, use-review-view.ts (not on the lock list, but imports `variance/select` and mirrors review.ts), state/filters.ts, state/storage.ts, state/shell.ts, components/ui/*.

## Q2 Action wiring (state/review.ts; zustand `useReview`)
| Action | Signature (review.ts line) | Effect |
|---|---|---|
| select | `(id: string\|null) => void` :144/:784 | sets selectedId, selectSeq+1 |
| accept | `(id) => Promise<void>` :146/:787 | toggle: if already accepted, revoke decision, triage open; else `decide(id,'accepted')` (memory write if firm) and triage `accepted`; toast "Finding accepted." / "Accept removed." with undo |
| needsCounsel | `(id, ask?: OwnerAsk) => Promise<void>` :152/:804 | toggle `counsel`/`open`; local only; `ask` = change-finding owners; toast "Added to the counsel questions draft." |
| dismiss | `(id, reason: ReasonCode, note: string) => Promise<string\|null>` :153/:834 | memory decision, triage dismissed, selects next visible row, toast `Dismissed. ` + `dismissGateText(gateNow())` ("N blocking reason(s) left." / "The gate is now Ready.") |
| restore | `(id) => Promise<void>` :154/:860 | revoke decision, triage open, toast "Finding restored." |
| restoreSnapshot | internal closure :627 (`(id, prev: Triage\|null, created: string\|null)`), NOT on the store API | used only by the toast undo callbacks; v2 "Undo" works by wrapping existing toast undo; a v2 outcome toast needs its own message but can reuse `showToast(msg, undo)` |
| showToast | `(msg: string, undo?: (()=>void)\|null)` :877 | message is plain string; D12 string must be built by the caller |
- Mapping D5 note holds: Ask counsel on blocking = `accept(id)` toggle (so a second click REMOVES the accept; guard against toggling), non-blocking = `needsCounsel(id)` toggle. "Real issue" close = `accept`. Others = `dismiss(id, reason, note)`.
- Note: `dismiss`/`restore` toast text is hard-coded in the store; D12 text ("Counsel questions now N . Gate still blocked (N)") must be produced after the action by calling `showToast` again from v2 code (the store action's own toast fires first and would be overwritten) or by a store edit (locked).
- Gate and counts: `useReviewView()` returns `gate` (`reviewGate(rows,result,policy)`, status 'ready'|'blocked', reasons[]), `counts.counsel` (error findings with status `counsel` + one per asked owner of change findings) and `counts.blocked`. `gateNow()`/`reviewRowsNow()` are private closures in review.ts. Question count for the toast must use the counsel sheet rule: `questionRows`/`isQuestion` in features/counsel/sheet-model.ts:~30-45 (counsel status plus ACCEPTED blocking findings; `isErrorQuestion` in variance/owner-groups.ts) - NOT `counts.counsel`, because an accepted blocking finding is also a question but `counts.counsel` (sidebar badge) counts only status `counsel`. Evidence: sheet-model.ts header comment "Questions = findings marked Needs counsel, plus Accepted findings that block digitization".
- "Question for counsel" source: `wordingFor(r, drafts, key)` / `baseWording(r, drafts)` in counsel/sheet-model.ts:178-192. Order: saved edit (`drafts.edits[key]`), AI draft (`drafts.useAi && !changeRow ? drafts.ai[id]`), else core `templateQuestionText(issue_class, loc)` = "`{class label} at {loc}: which reading should we digitize?`" (core counsel/template-draft.ts:70). Drafts come from Dexie via `useCounsel` (counsel-store.ts, `drafts` loaded by `load(docId)`; seeded `EMPTY_DRAFTS`). Readings A/B come from `templateInterpretations(issue_class)` and per-finding `f.detail.interpretations` (FindingRow shows them in "Why it was flagged"). counsel/* is Variance-locked, so v2 can IMPORT these pure helpers (sheet-model.ts exports) but not edit them; import-graph.test only restricts imports from `@aduin/core`.

## Q3 Test ids on the Findings screen and who asserts them
- Findings family (stable list in `process/context/ui/all-ui.md`): findings-header, findings-meta, stage-status-button, stage-popover, doc-pane, doc-highlight, jump-menu(-button), jump-item, findings-column, severity-chip-{block,fix,note}, filter-*, findings-list, finding-row (+ data-finding-id/severity/status/kind, aria-expanded), finding-{title,body,quote,expected,found,provenance,memory-tag,locator}, reveal-toggle, empty-state, action-{accept,dismiss,counsel,restore}, dismiss-{modal,reason,note,error,save,cancel}, undo-toast, undo-button, previously-handled-*, reopen-decision, kind-{all,errors,changes}, kind-segment, change-type, change-provenance, data-memory-state.
- `action-accept|counsel|dismiss|restore`: 41 hits. Source: FindingRow.tsx, variance/ChangeRow.tsx. E2E specs (21): a11y-keyboard, a11y-smoke, analyst-name, app-shell, counsel-gate, dismiss-requires-reason, gate-pill, layout-vs-mockup, memory-no-reflag, metrics, previously-handled-section, slice, stack-memory-demo-workspace, stack-memory-roundtrip, triage-actions, variance-gate-two-states, variance-no-baseline-errors-only, variance-owner-override, plus fixtures counsel.ts, stack-memory.ts, variance-owners.ts. Variance-locked specs among them: a11y-keyboard, gate-pill, memory-no-reflag, stack-memory-*, variance-*.
- `finding-row` 26 files, `finding-body` 12, `doc-pane` 16, `undo-toast` 5, `dismiss-modal` 5, `doc-highlight` 5, `findings-column` 4, `finding-title` 8 (includes fixtures app.ts, variance.ts, stack-memory.ts).
- layout-vs-mockup.spec.ts:26,91-95 asserts findings column 400px (1440) and 380px (<=1279) derived from `app.html` via test/support/mockupCss.ts. A 40-65% resizable panel (D4) changes those numbers and the spec's mockup source.
- No unit test imports FindingRow/DocPane/FindingsScreen directly (src tests: gp-request-group.test.tsx, package-gate-ui.test.tsx only); coverage of review UI is e2e.

## Q4 Variance UI inside the findings list (must survive in the accordion)
| Piece | File | Status |
|---|---|---|
| Segment All/Errors/Changes (`kind-*`) + NoBaselineLine | FindingsScreen.tsx | P02 landed |
| BaselineControl + BaselineModal in header | variance/ | P02 landed |
| ChangeRow (type chip, owner chip, ChangeDiff, ImpactLines, OwnerSelect, provenance, "Mark as expected..." / "Ask owner") | variance/ChangeRow.tsx | P02 + P04 landed |
| CosmeticGroups under list | variance/CosmeticGroups.tsx | P02 |
| Pending pill "Checking changes" on gate pill | shell/GateButton.tsx | P02 |
| Owner chips, per-owner questions, questions by owner, answer intent/scope, regression R-01 rows (`Regression` chip) | variance/OwnerChip, owner-groups, regression-client; counsel/* | P04 landed (838ca1e) |
| Gate two states (errors gate vs changes gate with `gatePolicy`) | model.ts `computeGate`, variance/select | P02/P04 |
- Row contract is shared: both row types render `li.row > button.rowb[data-testid=finding-row]` + `div.rbody[finding-body]`. Change rows have no Accept; their buttons are "Mark as expected..." (opens Dismiss modal) and "Ask owner" (needsCounsel with owners, disabled when no owner). v2 D1 (Ask counsel / Close issue) maps cleanly only for error rows; change rows need an owner picker retained (OwnerSelect) and the P04 label copy.
- P05 (pending) per its plan touches e2e demo specs, `build-samples.ts`, `apps/web/public/samples`, perf-budget and a11y-keyboard additive cases, sample-picker-smoke counts; NO `apps/web/src/features/review`. Collision with v2 is limited to e2e files named above (a11y-keyboard, perf-budget) and Findings testids.

## Q5 Styling
- Tokens: `styles/tokens.css` is a verbatim copy of app.html `:root`; `test/tokens-match-mockup.test.ts` asserts key-for-key equality with app.html. findings-v2.html `:root` equals those tokens plus `--sbw`. No token change needed; NEW values (violet AI tag, card shadow, hairline, warm greys, panel width var, doc scale var) would fail that test if added as `:root` vars in tokens.css, so they go in a new file scoped to a v2 container class.
- Tailwind 4: only `@import 'tailwindcss/theme'` and utilities (index.css:1-3); components are plain CSS classes in base.css etc. source-guard.test.ts bans hex colors in `src/components|shell|features` (CSS files in `styles/` are outside it).
- Import points: `src/index.css` imports tokens, base, app-extra, counsel. Feature CSS is imported by the owning component module (`import '../../styles/variance.css'` in variance/ChangeRow.tsx:10; structure.css in MemoryView/StructureScreen; package-*.css; scan.css; compare.css). So a new `styles/findings-v2.css` can be imported from a NEW component file (e.g. features/review/v2/*.tsx) with no edit to base.css or index.css. variance.css is imported by ChangeRow (Variance-owned) but need not be touched.
- Override risk: base.css defines `.row`, `.rowb`, `.rbody`, `.acts`, `.fp`, `.fhead`, `.chip`, `.paper`, `.docscroll` globally; v2 selectors must be scoped (e.g. `.fv2 .row`) or use new class names to avoid regressions on Compare/Counsel/Variance rows that share some of them.
- The mockup's blockers: it uses Google Fonts links and a mock bar (`.mbar`) that are not product; the app self-hosts Geist/Newsreader (main.tsx:2-7).

## Q6 DocPane reading view and D15 zoom hooks
- Rendering: React text nodes; `article.paper` with `h1.sub`, blocks by kind (heading h2, field/table_row div.fields, option div.opt, else p) wrapped in `mark.q[data-finding-id]` by anchor offsets; masks via `.mask`. No HTML/PDF image rendering here (scans use ScanPane; DocPane is the text reading view for HTML, PDF text, DOCX).
- Geometry: `.docscroll` (the scroll container, `role=region`, `tabIndex=0`, testid doc-pane; base.css:581 padding `0 24px 80px`, mobile 16px); `.paper` base.css:584 `max-width:700px; margin:0 auto; padding:52px 60px 72px; font:400 16px/1.72 serif`; narrow media (<=1279) padding 40px 36px 56px. Matches D15 "700px page at 100%".
- Zoom hook points: (a) CSS on a wrapper: transform scale would break `scrollIntoView` geometry and layout width (transform does not change layout), so the whole-page "Google Docs" behavior needs `zoom` or scaling of font-size/max-width/padding via a CSS var (`--dz`) on `.paper`; (b) fit-width needs the width of `.docscroll` (ResizeObserver; resizes on window, panel drag, panel collapse), minus 2x32px gutter, clamp 90-175%; (c) horizontal scroll inside `.docscroll` above fit width (`overflow:auto` already via `.scroll`?, verify); (d) scroll-to-finding already uses `el.scrollIntoView({block:'center'})` which is scale-agnostic for CSS `zoom`/font scaling but approximate for transforms; (e) the controls go in `.docbar` (DocPane.tsx, locked) next to `JumpMenu`; (f) Cmd/Ctrl +/-/0 key handler would be window-level (needs `preventDefault` against browser zoom).
- localStorage helper: `state/storage.ts` `safeGet/safeSet/safeGetJson` and the frozen `KEYS` object (:28-32); existing keys `ui:v1:sidebar|filters|ai`. New `ui:v1:doczoom` and `ui:v1:fpw` need either a KEYS edit (state/storage.ts is not on the lock list) or local constants using `safeGet/safeSet` in a new module.
- Doc width impact: `.docbar` and `.paper` styles live in base.css (locked); v2 zoom CSS must override from the new CSS file.

## Q7 Dedupe (step 2)
- Rule findings come from the engine (`result.findings`); AI findings arrive via `ai-lane.ts` `emit()` -> sink -> `review.setAiFindings(docId, findings)` (review.ts:1015-1031) which keeps non-AI findings and appends AI ones (`detector_kind !== 'ai'` filter) into `result.findings`. Variance change rows are merged later in `use-review-view.ts` (`mergeFindings(result.findings, changes)`), then `buildRows`.
- Natural seam: `useReviewView` (use-review-view.ts:~37) before/after `buildRows`; AI twin shares triage because triage is keyed by finding id (`triage[f.id]`, `Row.triage`). To make "acting on one acts on both", the merged row needs the twin id alias in triage reads and actions; today `buildRows` reads `triage[f.id]` only.
- Shapes (core findings/schema.ts): `issue_class`, `severity`, `detector_kind: 'rule'|'ai'` (+`model` iff ai, `provenance` only for AI), `anchor: {blockId, offsetStart, offsetEnd}` (used at DocPane.tsx byBlock), `quote`, `confidence`, `detail {explanation, expected, interpretations}`. Severity caps by issue class and detector_kind (`maxSeverityFor`). Memory fingerprint is computed per finding in `fingerprintFindings` (memory/fingerprintFindings.ts) so an AI twin has its own fingerprint/label.
- Open decision input: NOTES D11 requires "higher severity wins"? (NOTES Q2 asks; not decided). Observed fact: AI findings are capped at lower severity than rules for some classes.

## Q8 Flag this passage / Suggest wording (step 3)
- Findings contract has `detector_kind` limited to `'rule'|'ai'` (schema checks `(detector_kind==='ai') !== (model!==undefined)`); `'manual'` is not representable without a core contract change (and JSON-schema snapshot regeneration: packages/core/test/__snapshots__/contracts.json-schema.snap is a seam file).
- Anchors are block+offset; a selection anchor could reuse `{blockId, offsetStart, offsetEnd}`; DocPane has no selection handling today (marks only on click).
- Counsel question and DOCX paths: question wording = `wordingFor` (above), sheet = core `buildCounselSheet` via `SheetFinding`; export in counsel/exportDocx.ts + export-flow.ts. A proposed-fix field would need additive core/sheet fields; out of scope for step 1.

## Q9 Test infra
- Vitest 4.1.12 via vite.config.ts `test`: environment jsdom (jsdom 30.1.3), include `test/**/*.test.ts` and `src/**/*.test.{ts,tsx}`. Single file: `pnpm --filter @aduin/web test <token>` (no `--` token per all-tests rules). No `@testing-library/*` in package.json (only react-dom 19.3.1 + jsdom); existing tsx tests (gp-request-group.test.tsx, package-gate-ui.test.tsx) render with react-dom directly.
- `test/import-graph.test.ts` (ALLOWED list at :14-72) restricts which VALUE names the main thread may import from `@aduin/core`; folders are not listed, so a new `features/review/v2/` folder needs no ALLOWED edit as long as v2 code imports only already-allowed core names (e.g. `mask`, `computeGate`, `templateQuestionText`, `maskQuote`, `SEVERITIES`, `REASON_CODES`) or types. A new value import from core would need an appended line; the registry lists that file as a program seam (V2/V4 appended lines), i.e. coordinate any append with the Variance session.
- source-guard.test.ts: no hex colors / raw HTML injection in `src/components|shell|features`.
- E2E: Playwright `preview` project, `--mode e2e` build; mockup-derived layout via test/support/mockupCss.ts (`findingsCss`, etc.), currently from app.html. Findings v2 would need a v2 mockup slicer.

## Q10 Step 1 buildable as NEW files now (no edits to locked files)
Candidates (all under `apps/web/src/features/review/v2/` + `styles/findings-v2.css`):
| Module | Needs from shared files |
|---|---|
| `ActionBar.tsx` (sticky bar: Ask counsel / Close issue / Move back to review, disabled when nothing open) | `useReview` accept/needsCounsel/dismiss/restore/select/showToast; selected `Row` + `Row.status`; `f.severity==='critical'` or `r.sev==='block'` to branch call |
| `CloseIssueModal.tsx` (reasons per D2, hide "Real issue" on blocking, Other requires note) | reuse `DISMISS_REASONS` (review/reasons.ts) and `ReasonCode`; extra reason maps to `accept` |
| `outcome.ts` (D12 text: counsel question count + gate state) | `questionRows` from counsel/sheet-model + `useReviewView().gate` |
| `ProgressHeader.tsx` ("N of M reviewed", Counsel/Closed/Left bar) | `view.rows`, `Row.status` |
| `AccordionRow.tsx` / `ExpandedBlock.tsx` (D5/D6: What's wrong, quote with Reveal, Question for counsel via `wordingFor`/`useCounsel`, Details) | `Row`, `QuoteBody`/`Provenance`/`LocatorChip` (existing exports), `memoryLabelText` |
| `GroupedList.tsx` (To review / Sent / Closed) | `view.visible` |
| `SeverityChips.tsx` | `SEV`, `useFilters` (existing) |
| `PanelResizer.tsx` + `use-panel-width.ts` (40-65%, `ui:v1:fpw`, safeGet/safeSet) | only a CSS var on the container |
| `use-shortcuts.ts` (J/K/C/X) | `view.visible`, `select` (note: the existing J/K handler in FindingsScreen.tsx would double-fire; wiring needs the screen edit) |
| `DocZoom.tsx` + `use-doc-zoom.ts` (`ui:v1:doczoom`, Cmd/Ctrl =/-/0, ResizeObserver) | needs `.docbar` and `.paper` hooks (DocPane, locked) |
| `findings-v2.css` | new, scoped under a v2 container class |
Wiring (mounting the v2 list in FindingsScreen, removing J/K there, `.work` column width, DocPane toolbar, ChangeRow reuse) requires edits to locked files and must wait for the Variance session to close.

## Key Facts
- Working tree has no modified source at research time; Variance P04 landed (a31dff0), P05 not started in code.
- Ask counsel is asymmetric in memory: `accept` writes a memory decision (if firm), `needsCounsel` does not (NOTES Q1). `accept` is a TOGGLE (second call removes the accept) and `needsCounsel` is a TOGGLE; v2 buttons must call them only when the row is not already in that state.
- Existing toast text is generated inside the store and is plain-string only; D12 needs a second `showToast` call or a store edit.
- `Row.status` is the 4-value `TriageStatus` (open/accepted/counsel/dismissed); v2 "To review / Sent to counsel / Closed" grouping is a pure derivation: open -> To review, counsel + (accepted on blocking) -> Sent, dismissed + (accepted non-blocking) -> Closed.
- `placement()` hides memory-handled rows into "Previously handled (n)" (model.ts); v2 progress numerator/denominator must decide whether they count.
- Hard UI rules: `aria-label` of controls must contain the visible text (a11y fixes noted in all-ui.md); no hex in features; no gradients; 4px radius.

## Library/API Findings
No new library is required by the findings. Existing: Radix dialog/popover wrappers (`components/ui/modal`, `popover`), zustand, Comlink. Docs lookup (docs-seeker) not run: no new library encountered.

## Test Gap Analysis
1. Zero unit coverage: FindingRow, DocPane, FindingsScreen, DismissModal, UndoToast, FilterMenu (only e2e). New v2 modules need unit tests (jsdom + react-dom; no testing-library).
2. Behaviors in NOTES with no asserting test today: D1-D3 (action bar), D5 accordion, D8 progress, D12 outcome toast text, D14 C/X keys, D15 zoom (no spec), D4 resize, D11 dedupe. Asserted today: J/K (filter-sort/finding-highlight area; verify), triage actions (triage-actions.spec), dismiss reason required (dismiss-requires-reason.spec), toast undo (triage-actions).
3. Tier hints: action/outcome text/progress/dedupe logic = Fully-Automated (pure functions + vitest); accordion/resizer/zoom/shortcuts = Hybrid (jsdom + Playwright preview); fit-width resize behavior, visual calm palette = Agent-Probe (Playwright screenshots / design-probe spec); manual keyboard/screen-reader pass = Known-Gap (no recorded human pass).
4. Existing specs that will break by design if ids or layout change: layout-vs-mockup (400/380px), all specs using `action-*` or expanded-row structure.

## Infra Improvement Suggestions
- A mockup slicer for findings-v2.html in test/support/mockupCss.ts (like `findingsCss`) would let layout specs derive v2 widths instead of hard-coding.
- Adding `@testing-library/react` is not present; tests use react-dom directly.

## Open Questions
1. Which testid strategy: keep `action-accept|counsel|dismiss` as aliases (hidden or reused on new buttons), or rename with a registry note and update 21 specs (7 Variance-locked)?
2. D11 dedupe rule (same block, overlapping offsets, same class; higher severity wins) is unconfirmed (NOTES Q2); where to host (use-review-view vs core toView) and how the twin shares the triage key and counsel question.
3. NOTES Q1: should Ask counsel on non-blocking also write memory?
4. Is `use-review-view.ts` safe to edit now (not on the lock list, but imports Variance select and merges Variance rows)?
5. Does D12 count "Counsel questions now N" use sheet questions (counsel + accepted blocking) or the badge count? (Evidence above favors sheet questions.)
6. ChangeRow and regression rows: restyle under v2 accordion or keep Variance rows unchanged until after the lock?
7. Fit-width default changes the `.paper` rendering for every existing doc spec (finding-highlight, perf-budget): is a no-op default (100%) needed for unchanged-spec stability?
8. Whether `.fp` width 40-65% fits the 1024px layout and the mobile stacking in base.css:1722-1738.
