---
phase: phase-03-web-shell
date: 2026-10-17
status: COMPLETE
feature: subdoc-qa-mvp
plan: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-03-web-shell_PLAN_17-10-26.md
---

# Phase 03 — Web Shell: EXECUTE report

TL;DR: The app shell and the Findings screen are built to `design/mockups/app.html`. They show real engine findings from the bundled samples, with parsing in a Comlink Web Worker and memory on a Dexie stub. The five other routes are placeholders. All 9 Vitest gates, all 16 e2e gates, a11y (from a clean checkout), the aggregate run, the D0 wiring checks and the regression set pass locally. Nothing was committed (the orchestrator commits). The visual probe screenshots are in `design-probe/`; the read-only second reviewer is still to run.

## Mid-implementation progress note (written at ~50%)

Status: Steps A-C implemented and the Vitest suite green (10 files / 38 tests). Playwright specs, D0 and Step E were still to do. Deviations 1-3 below were already known and were handled by documenting them and continuing.

## What Was Done

- **Step A (mockup contract):** `src/styles/tokens.css` holds the app.html `:root` plus a Tailwind `@theme inline` mapping. `base.css` is the app.html shell + Findings CSS, ported with the E1 resets. `app-extra.css` covers the Radix wrappers, placeholders and the interim dialog. Fonts are self-hosted (Geist and Newsreader 400/500/600 via @fontsource). The icon sprite is copied from app.html. `test/support/mockupCss.ts` derives every token, size, radius, width and breakpoint at test time. The A5 severity mapping lives in `features/review/severity.ts`; the E3 reasons map to `reason_code` in `reasons.ts`.
- **Step B (engine and storage):** `engine/engine.worker.ts` is the only importer of the core parse, structure and detector code. It reports the stages read, structure and checks (partial result on failure). Settings carry no firm. `engine/client.ts` wraps it with Comlink. `memory/fingerprintFindings.ts` runs the single fingerprint flow: `fingerprintFor` → `lookup` in chunks of 200 → `resolveLabel`, and a null firm means "memory not applied" with no lookup. `storage/db.ts` (Dexie) has the 24 h purge (uploads, parsed models, drafts; never decisions) and the allowance stub. `api/{memoryApi,stubMemoryApi,client}.ts`: append-only, one active decision per fingerprint, revoke instead of delete, and `reason_code` required for dismiss. `scripts/src/build-samples.ts` copies 12 HTML samples into a manifest (#3-#6 partners-group, #9 disabled) plus `firms.json`, and fails loudly if `law-firms.json` is missing. B5 scripts and the two Playwright projects (preview + stack) are set up per E4-E6.
- **Step C (screens):** Shell (`src/shell/*`): 232 px sidebar / 56 px rail, auto-rail at max-width 1199 px with the toggle hidden, Review/Check/Firm groups, badges (Findings = open, Counsel = needs-counsel), "<firm> memory" label, doc switcher popover, gate button + popover (reasons jump to the finding), AI on / No AI switch with "N of 3 fresh-AI documents left today", analyst name, skip link. Only `ui:v1:sidebar`, `ui:v1:filters` and `ui:v1:ai` persist. The route always lands on #findings.
  - Findings (`features/review/*`): one-line header with meta and the stage status button + popover; No-AI, memory-not-applied and memory-unavailable banners; reading view as text nodes with highlights and the jump menu; severity chips; Filter menu (class, status, sort, detector, reset, J/K hint).
  - Findings rows: one-line rows that expand in place; Dismiss modal (Radix Dialog with focus trap, app inert, required reason, focus moves to the next row); undo toast; Previously handled (n) with Reopen (revoke); masked value with Reveal. The gate uses `gateInterim.ts`, which has the P08 `computeGate` shape.
  - Other screens: the interim Open a document dialog (samples, upload with limits, alias-resolving firm, fund, version, privacy notice with acknowledgement) and a privacy prompt before switching AI on. Placeholders are registered via `features/registry.ts` (last entry per id wins).
- **Step D (tests):** 9 Vitest gate files plus the updated scaffold smoke test; 16 gate e2e specs plus `a11y-smoke`; fixtures `e2e/fixtures/{app,seedMemory}.ts` (seeded fingerprints come from core `fingerprintFor` run on the real sample in Node).
- **Step E:** screenshots of app.html and the app at 1440, 1199 and 1024 in `design-probe/`. E2: the select boxes and the dismiss note are 16 px as in app.html; the Detector select uses the same styling as the other selects.
- **Seam edits (serialized, mine only):** `apps/web/package.json` adds @radix-ui/react-dialog and react-popover 1.3.1, @fontsource/geist and newsreader 5.3.0, and dev-only @axe-core/playwright 4.14.0, fake-indexeddb 6.2.5, tsx and @types/node. Also `pnpm-lock.yaml`, `THIRD_PARTY_NOTICES.md` (rows plus the D-8 MPL note and the OFL fonts) and `.gitignore` (`apps/web/public/samples/`, `apps/web/public/firms.json`).
- Removed the scaffold `src/pages/placeholder-page.tsx` (it was swept into 70e4a02 by accident; the deletion is staged here).

## Touchpoints

`apps/web/{package.json,vite.config.ts,playwright.config.ts,tsconfig.json}`
`apps/web/src/{main.tsx,App.tsx,index.css,e2e-flag.ts,e2e-hook.ts,smoke.test.tsx}`
`apps/web/src/styles/{tokens.css,base.css,app-extra.css}`, `apps/web/src/icons/sprite.tsx`
`apps/web/src/state/{storage,shell,filters,session,review}.ts`
`apps/web/src/engine/{types.ts,engine.worker.ts,client.ts}`, `apps/web/src/storage/db.ts`
`apps/web/src/api/{memoryApi,stubMemoryApi,client}.ts`, `apps/web/src/memory/fingerprintFindings.ts`
`apps/web/src/components/ui/{icon,popover,modal}.tsx`
`apps/web/src/shell/{AppShell,Sidebar,NavGroup,DocSwitcher,GateButton,AiSwitch,AnalystBadge}.tsx`, `use-shell-effects.ts`
`apps/web/src/features/registry.ts`, `features/placeholders/PlaceholderView.tsx`, `features/processing/StageStatus.tsx`
`apps/web/src/features/open-document/{OpenDocumentDialog.tsx,PrivacyPrompt.tsx,open-actions.ts,samples.ts,validate-upload.ts,privacy-copy.ts}`
`apps/web/src/features/review/{FindingsScreen.tsx,model.ts,gateInterim.ts,severity.ts,reasons.ts,memory-labels.ts,issue-classes.ts,use-review-view.ts}` and `components/{DocPane,FindingRow,FilterMenu,PreviouslyHandledRow,DismissModal,Banners,UndoToast}.tsx`
`apps/web/test/*.test.ts` (9) + `test/support/mockupCss.ts`; `apps/web/e2e/*.spec.ts` (17 gate/a11y specs + `design-probe.spec.ts`) + `e2e/fixtures/{app,seedMemory}.ts`
`scripts/src/build-samples.ts`; seams `pnpm-lock.yaml`, `THIRD_PARTY_NOTICES.md`, `.gitignore`.
Not touched: `apps/worker/**`, `packages/core/**`, `scripts/src/slice-check.ts`, `apps/web/e2e/slice.spec.ts`.

## Test Gate Outcomes (local, 2026-10-17)

Vitest, one token per call (`pnpm --filter @aduin/web test <token>`):
```
stub-memory-api exit=0  Test Files 1 passed (1)  Tests 6 passed (6)
retention-purge exit=0  Test Files 1 passed (1)  Tests 3 passed (3)
gate-interim exit=0  Test Files 1 passed (1)  Tests 11 passed (11)
import-graph exit=0  Test Files 1 passed (1)  Tests 4 passed (4)
memory-label-enum exit=0  Test Files 1 passed (1)  Tests 2 passed (2)
no-e2e-hook-in-dist exit=0  Test Files 1 passed (1)  Tests 2 passed (2)
tokens-match-mockup exit=0  Test Files 1 passed (1)  Tests 1 passed (1)
severity-label exit=0  Test Files 1 passed (1)  Tests 3 passed (3)
source-guard exit=0  Test Files 1 passed (1)  Tests 4 passed (4)
unit (pnpm --filter @aduin/web test) exit=0  Test Files 10 passed (10)  Tests 38 passed (38)
```
Playwright, one token per call (`pnpm --filter @aduin/web test:e2e <token>`; each call rebuilds the preview):
```
app-shell exit=0  8 passed            placeholder-routes exit=0  6 passed
sample-picker-smoke exit=0  2 passed  status-stages exit=0  4 passed
finding-highlight exit=0  4 passed    filter-sort exit=0  4 passed
triage-actions exit=0  3 passed       dismiss-requires-reason exit=0  2 passed
upload-limits exit=0  3 passed        privacy-notice exit=0  3 passed
upload-firm-tagging exit=0  4 passed  previously-handled-section exit=0  4 passed
hostile-html exit=0  1 passed         gate-pill exit=0  3 passed
engine-worker-split exit=0  1 passed  layout-vs-mockup exit=0  5 passed
```
- a11y (Hybrid), run after deleting `apps/web/public` (clean checkout): `pnpm --filter @aduin/web test:a11y` exit=0, 1 passed. Critical = 0 in all 11 states.
  - Serious findings, listed and not gate-failing per D3: `label-content-name-mismatch` (1 node; the Findings nav item's accessible name includes the badge's sr-only "Open:" prefix) and `scrollable-region-focusable` (1 node; the findings list scroller in some states). Both go to P10 sign-off.
- Aggregate `pnpm --filter @aduin/web test:e2e`: exit=0, 58 passed, 1 skipped (`design-probe`, opt-in only).
- D0 wiring:
  - `test no-such-token` exit=1 ("No test files found, exiting with code 1")
  - `test:e2e no-such-token` exit=1 ("Error: No tests found.")
  - `test gate-interim` exit=0 with exactly 1 file
  - `test:e2e gate-pill` exit=0 with only `e2e/gate-pill.spec.ts`
  - `test:a11y` exit=0 on a clean checkout (samples regenerated by the `pretest:a11y` hook)
- Regression: `pnpm --filter @aduin/core test:golden` exit=0 (5 files / 44 tests); `pnpm guard:cf` OK; `pnpm secrets:scan` OK; workspace `pnpm -s typecheck` exit=0; eslint and prettier clean on all my files.
- Engine-worker split: one worker (`engine.worker`) is created on open; the main thread's long tasks while opening sample #2 were [100 ms] against a stated budget of 200 ms.

### Visual probe (Agent-Probe) — screenshots and first-pass rubric

Files: `process/general-plans/active/subdoc-qa-mvp_17-10-26/design-probe/{mockup,app}-{1440,1199,1024}.png`. Google Fonts are blocked for both; the content differs because app.html uses demo data. The orchestrator still has to run the read-only second reviewer.

| Rubric item | Result | Evidence |
|---|---|---|
| Sidebar 232 px at 1440, 56 px rail at 1199 and 1024 | PASS | screenshots; `layout-vs-mockup` geometry |
| Findings column 400 px at 1440, 380 px at ≤1279 | PASS | `layout-vs-mockup` |
| No horizontal tab bar; vertical Review/Check/Firm nav | PASS | screenshots; `[role=tablist]` count 0 |
| Tone steps instead of borders (ground → panel → card → paper) | PASS | side-by-side 1440 |
| Type scale and radius sets within the app.html-derived sets | PASS | `layout-vs-mockup` style audit (Findings, placeholder, 4 popovers, dismiss modal) |
| Shadow only on popovers and the modal; no gradients | PASS | style audit |
| Single accent (teal) for the active nav bar, selected row bar and focus | PASS | screenshots |
| Severity never by color alone (icon + word) | PASS | chips/rows show icon + label |

Judged deviations: (a) real documents have long sentences, so the expanded quote and title wrap over more lines than the mockup's curated demo; (b) checkbox glyphs (☐) from the source HTML appear in option rows; (c) block kinds such as table rows render as the mockup's `.fields` panels, which suits form-like blocks. Recorded, not fixed (content, not layout).

## What Was Skipped or Deferred

- AC6 "edit text/severity" clause: backlog stub B-EDIT (UPDATE-PROCESS files it). "Answered" moves to P08.
- AC17 view and the AC61 host: placeholder only (later UI phase).
- AC30 full sign-off and the 2 serious axe items: P10.
- E3 (record tokens, the shell contract and the testid list in `process/context/ui/all-ui.md`) is an UPDATE PROCESS action; EXECUTE must not edit `process/context/`.
- Registry `status: DONE` annotation: left for EVL-green per protocol.

## Plan Deviations

Seven deviations are recorded in the plan's `## Deviations` section; all are within the blast radius and none is hard-stop class:
1. TanStack Table not used.
2. The E2E flag comes from a Vite `define` per build mode (no dotenv file).
3. Font-size/radius derivation is scoped to the shell + Findings CSS, because app.html gained 18/19 px for later screens after PVL. The reference sets still match exactly.
4. Native radios are excluded from the radius audit.
5. The token comparison normalizes formatting, because Prettier lowercases hex.
6. Extra seams: triage state stored in `uiState`, stub `answer()`, supersede-on-decide, the E2E hook, the opt-in design probe, and a stack webServer that is only configured on request.
7. The import-graph allow-list includes the memory contract values.

## Test Infra Gaps Found

- Playwright launches every configured webServer regardless of `--project`, so the stack server is now gated on `--project=stack`. 04a's `slice:check` must pass `--project=stack` (the regex accepts both `=` and a space).
- Each one-token e2e call rebuilds the preview, about 3-6 s per call. That is acceptable.
- The main bundle is 568 kB (the core barrel is not fully tree-shaken on the main thread). This is not a gate; a candidate for P10 code-splitting.

## Closeout Packet

- Selected plan: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-03-web-shell_PLAN_17-10-26.md` (checklist A1-E2 ticked; Phase Loop step 5 ticked; `## Deviations` added).
- Verified: every Fully-Automated gate and the Hybrid a11y gate, locally, with the exact commands from the validate contract.
- Unverified: the second-reviewer visual rubric; EVL independent re-run; the M1 slice (04a `slice.spec.ts` on the `stack` project).
- Cleanup and context capture remaining: E3 (all-ui.md), the B-EDIT stub, umbrella AC17/AC61 notes, and the registry DONE annotation at EVL.
- Follow-up stubs created: none (B-EDIT is filed by UPDATE-PROCESS per plan).
- CONTEXT_PARTIAL: ui component conventions (all-ui.md has no component-code section yet; E3 adds it).
- Classification: **Keep in active/testing** until EVL and the second visual reviewer confirm. Then it is ready for UPDATE PROCESS archival.

## Forward Preview

### Test Infra Found
- `test/support/mockupCss.ts` (`rootVars`, `fontSizes`, `radii`, `shellWidths`, `railMaxWidth`, `sevTable`, `reasonsList`, `findingsCss`). Later UI phases should add their own section slicer next to `findingsCss`.
- `e2e/fixtures/app.ts` (`openSample`, `forceSeverity`, `chooseReasonAndSave`) and `e2e/fixtures/seedMemory.ts` (Node-side `fingerprintFor` seeding).
- E2E hook `window.__aduinE2E` (`failStage`, `transform`, `memory()`, `review()`), present only in e2e-mode builds.

### Blast Radius Changes
- `features/registry.ts` `FeatureModule` now carries `group`, `icon` and `component`; later phases append an entry with the same `id` to replace a placeholder.
- The published `data-testid`s are exactly as listed in the plan's Public Contracts, plus extras: `doc-menu`, `open-another`, `stage-item`, `filter-count`, `firm-hint`, `privacy-prompt`, `privacy-accept`, `loading-state`, `memory-unavailable`.

### Commands to Stay Green
`pnpm --filter @aduin/web test`, `pnpm --filter @aduin/web test:e2e`, `pnpm --filter @aduin/web test:a11y`, `pnpm --filter @aduin/web typecheck`, plus the per-token loops in the plan. Visual probe: run `pnpm exec playwright test --project=preview design-probe` from apps/web with the DESIGN_PROBE variable set to 1.

### Dependency Changes
+ @radix-ui/react-dialog 1.3.1, @radix-ui/react-popover 1.3.1, @fontsource/geist 5.3.0, @fontsource/newsreader 5.3.0
+ dev: @axe-core/playwright 4.14.0 (MPL-2.0, D-8), fake-indexeddb 6.2.5, tsx 4.23.15, @types/node 24.19.2
