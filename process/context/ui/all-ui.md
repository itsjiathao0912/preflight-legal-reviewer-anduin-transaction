---
name: context:all-ui
description: UI/UX design direction, design skills, references, tokens and approved mockups for the sub-doc QA web app
keywords: ui, ux, design, mockup, frontend, layout, look and feel, design tokens, taste skill, minimalist, accessibility, wcag, review workspace, counsel sheet, app.html, sidebar, shell, data-testid, route, hash, radix, tailwind, playwright, component, findings screen
related: [context:tests]
date: 17-10-26
metadata:
  node_type: group-entrypoint
  type: context
  read_when: any UI/UX design, mockup, frontend implementation or UI review task
---

# aduin-transaction - UI/UX Context

Last updated: 2026-10-17 (Phase 05 UPDATE PROCESS; HEAD f0f476c plus the process commit)

Entrypoint for the `ui/` context group. `vc-ui-ux-designer` MUST read this before any design or frontend work.

## Scope

Covers: UI/UX design direction, which design skills to use, references, design tokens and approved mockups for the sub-doc QA web app.

Does not cover: product scope (see `process/context/product-domain.md`).

## Read When

- any UI/UX design, mockup, frontend implementation or UI review task
- choosing a design skill or visual-QA method

## Design Skills

Installed at USER level in `~/.claude/skills`, intentionally NOT in repo `.claude/skills`, so kit validators and vc-update are unaffected.

- Source: https://github.com/leonxlnx/taste-skill, commit `f624f37` (2026-10-14), MIT.
- Reinstall: clone that commit, then copy
  - `skills/minimalist-skill` -> `~/.claude/skills/taste-minimalist-skill`
  - `skills/redesign-skill` -> `~/.claude/skills/taste-redesign-skill`
  - `skills/taste-skill` -> `~/.claude/skills/design-taste-frontend`
- Each installed folder has a `SOURCE.txt`.

## Which Skill For Which Job

| Job | Use |
|---|---|
| App screens (review workspace, structure view, diff, counsel sheet + gate, firm memory, audit trail) | `minimalist-ui` (taste-minimalist-skill) for visual direction; `redesign-existing-projects` (taste-redesign-skill) for audit/upgrade passes. `ui-ux-pro-max` / `vc-frontend-design` also allowed for component patterns |
| Visual QA | design-taste-frontend `references/tells.md` and `references/critique.md` as an anti-"AI-slop" checklist; its `scripts/inspect.mjs` (local server + screenshots) for a look-and-fix loop; plus `ui-review` / `ux-review` skills |
| Marketing surfaces only (demo intro/landing page, README banner, slides) | `design-taste-frontend` main skill. It is NOT for dashboards or app screens; never use it to style app screens |
| Do not use | brutalist, gpt-taste, imagegen-*, brandkit |

## Product UI Principles

Derived from the SPEC (`process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_SPEC_17-10-26.md`):

- English UI; dense, calm analyst tool, not a marketing page
- document left, findings right
- severity never conveyed by color alone; WCAG AA; keyboard-operable triage (AC30)
- every finding shows provenance: rule id, or model + fresh/cache
- AI results visibly labeled and shown as pending until done
- deterministic results first
- no-LLM mode banner

## References

When to provide: at the start of the UX design step, BEFORE mockups; 2-3 refs per screen type with one line on what is liked. Never introduce new references during EXECUTE.

Reference list: none provided yet.

## Artifacts

- Approved mockup: `design/mockups/app.html` + `app_NOTES.md` (all views approved; conflict rule: app.html/app_NOTES win for UI, the SPEC wins on any other conflict). `review-workspace.html` is historical (palette/type only). Other files in `design/mockups/` are not approved views.
- Design tokens: APPROVED. Single source is the `:root` block of `design/mockups/app.html` (ground, panel, card, paper, ink 1-3, single teal accent, tone `--step`, block/fix/note/ok fg+bg pairs, `--mark`, `--r:4px`, Geist sans, Newsreader serif, `--ease`). The web copy is `apps/web/src/styles/tokens.css` (Tailwind `@theme inline` maps to the variables); `test/tokens-match-mockup.test.ts` fails on drift. Do not restate values here; read app.html.
- Visual-review evidence: `process/general-plans/active/subdoc-qa-mvp_17-10-26/design-probe/` (app vs mockup at 1440/1199/1024 + `second-review_17-10-26.md`, PASS_WITH_NOTES).

## Shell Contract (built in Phase 03, `apps/web/src/shell`)

- 232 px sidebar; 56 px icon rail at max-width 1199 px (auto, toggle hidden there); below 960 px is out of scope. Groups (sentence case): Review (Findings, Counsel questions), Check (Structure incl. Investor types sub-view, Compare versions), Firm ("<firm> memory", Documents). Pinned at the bottom: gate pill ("Blocked · N"), AI on / No AI switch with allowance line, analyst name. Doc switcher popover on top; skip link first.
- Findings screen: one-line header + stage status button/popover (no stepper), reading view rendered from model text nodes (never raw HTML), Jump to section menu, findings column 400 px at 1440 and 380 px at 1279 and below, severity chips + one Filter menu, one-line rows that expand in place, Dismiss modal (required reason), undo toast, "Previously handled (n)" row with Reopen, masked values with Reveal.
- Severity labels (single module `features/review/severity.ts`, asserted against the app.html `SEV` table): critical = "Blocks digitization" (chip "Blocks"), high = "Fix before build" ("Fix"), medium/low = "Note". Severity is never shown by color alone (icon + word).
- Dismiss reasons map to DATA-MODEL `reason_code`: `firm_standard_wording`, `no_form_impact`, `tool_false_alarm`, `other`.

## Route And Persistence Conventions

- Hash routes, no router dependency; ids: `#findings` (default), `#counsel`, `#structure`, `#compare`, `#memory`, `#documents`. The route is NEVER persisted: a load always lands on `#findings`.
- Persisted (guarded `localStorage`; any storage error falls back to defaults): `ui:v1:sidebar` (collapse), `ui:v1:filters` (AC5), `ui:v1:ai` (AC38 AI mode). Nothing else about layout persists (selection, expanded row, popovers reset).
- Later UI phases register a real view by appending a `features/registry.ts` entry with the same `id` as the placeholder (last entry per id wins). Placeholder routes show "coming in a later build".

## Published data-testids (stable; rename only with a registry note)

Authoritative list: the `Published data-testid` bullet group in `subdoc-qa-mvp_PHASE-03-web-shell_PLAN_17-10-26.md` Public Contracts. Families:
- Shell: `app-shell`, `sidebar`, `sidebar-toggle`, `doc-switcher`, `nav-{findings,counsel,structure,compare,memory,documents}`, `nav-badge-{findings,counsel}`, `gate-button`, `gate-popover`, `gate-reason`, `ai-on`, `ai-off`, `ai-allowance`, `analyst-name`, `placeholder-view` (`data-route`).
- Findings: `findings-header`, `findings-meta`, `stage-status-button`, `stage-popover`, `doc-pane`, `doc-highlight` (`data-finding-id`), `jump-menu(-button)`, `jump-item`, `findings-column`, `severity-chip-{block,fix,note}`, `filter-*`, `findings-list`, `finding-row` (`data-finding-id`, `data-severity`, `data-status`, `aria-expanded`), `finding-{title,body,quote,expected,found,provenance,memory-tag}`, `action-{accept,dismiss,counsel,restore}`, `reveal-toggle`, `empty-state`, banners `ai-off-banner`, `memory-not-applied`, `memory-unavailable`.
- Dismiss/toast: `dismiss-{modal,reason,note,error,save,cancel}`, `undo-toast`, `undo-button`. Previously handled: `previously-handled-{toggle,count,item}`, `reopen-decision`. Open a document: `open-document-dialog`, `sample-option`, `upload-input`, `limits-copy`, `upload-error`, `firm-combobox`, `fund-input`, `version-input`, `privacy-notice`, `privacy-ack`, `open-submit`, plus extras `open-another`, `loading-state`, `stage-item`, `filter-count`, `firm-hint`, `privacy-prompt`, `privacy-accept`.

## Component Conventions

- Stack: React 19 + Vite 8 + Tailwind 4; Zustand state (`state/{shell,filters,session,review}.ts`); Dexie storage; engine in a Comlink Web Worker (`engine/engine.worker.ts` is the only importer of core parse/structure/detector code; the main thread uses the public `@aduin/core` API and contracts only).
- Radix (dialog, popover) is used for accessibility behavior only (focus trap, inert app, Esc, positioning) and restyled entirely from tokens in `components/ui/*`. No default shadcn color classes and no hex colors in `src/components`, `src/shell`, `src/features` (`test/source-guard.test.ts` enforces). Shadows only on popovers and modals; no gradients; 4 px radius; tone steps instead of borders.
- Fonts are self-hosted (@fontsource Geist and Newsreader). Document text is rendered as React text nodes; `dangerouslySetInnerHTML`/`innerHTML` are banned in reading view. A single fingerprint flow: engine returns `quote_hash`, the main thread calls core `fingerprintFor(finding, firmId)`; `firmId=null` means "memory not applied".
- Copy rules: sentence-case labels; filter/AI persistence per SPEC; the Findings badge counts open items only; Accept on a blocking finding keeps the gate Blocked until counsel answers.

## AI Lane (Phase 05, `apps/web/src/{api,features/ai}`)

- **State machine** (`features/ai/ai-lane.ts`, zustand): `off | idle | pending | fresh | cache | skipped | unavailable | not_precomputed`. Resumes on the reset timer and on tab focus; toggling AI off removes AI findings (re-on re-runs the lookup; samples return to `not_precomputed`, no call).
- **Lookup order:** static `/precomputed/{docHash}.{rulesHash8}.json`, then `POST /api/ai`. It runs in `openDocument` before the list shows, so counts are stable. Bundled samples never call `/api/ai` on open: they show `not_precomputed` and a "Run AI on this sample" button. Uploads auto-run once. The lookup hash is `rulesHash8(ruleTexts)` of the rules the client would inject (`MemoryApi.firmRules`); `law_firm_id` is sent only when active rules exist, else `null` (hash `none`).
- **Verify chain in the engine worker:** `analyze` also returns optional `aiCandidates`; `verifyAi(result, docHash, injectedRuleTexts, ctx {model, provenance})` runs there (LRU-2 retained graphs; the client re-analyzes once on `doc_not_retained`). The main thread never imports core parse or verify code.
- **Provenance and labels:** AI rows show the label "AI suggestion" plus fresh/cache provenance (`finding-provenance` has `data-provenance` = `rule|fresh|cache`). Locator chip "{section path} · ¶ N" (U1 shipped; engine `toView` carries `locator {path, paragraph}`).
- **Stage status prefix invariant:** the stage button text is always `Checks done · AI review {not connected | not run | running | done | from cache | skipped | unavailable | off}`; the `Checks done` prefix is kept in every state. The preview (e2e) build with API base `''` reads `not connected`. `[data-stage=ai]` and `[data-stage=done]` have matching state texts ("Done · rules and AI", "Done · rules only", "Waiting for AI review").
- **Banners** (`banner-map.ts`, `AiBanner.tsx`): `(code, reason)` maps to `visitor_limit`, `daily_cap`, `ai_unavailable`, `ai_disabled`, `quota`, `breaker`, `budget`, `rate`, `verification` (invalid_session), `rules_unavailable` (memory_unavailable), `result_unusable`, `provider_error`, and a client-side `rules_changed` (rules re-read after the call differ). Auto-resume only for midnight / retry-after kinds; provider, unusable, verification and rules banners need manual Retry. Copy: "AI review skipped: {reason}. Rules, memory and the gate still work; ambiguity, contradiction and typo passes are skipped." The rules notice shows "N of M firm rules applied" (`100+` over the cap).
- **API client** (`src/api/`): `base.ts` (runtime API base: `VITE_API_BASE` is `'/'` in production and stack builds, `''` in `--mode e2e`; base `''` fails soft with a stub allowance and no `/api/ai`), `http.ts` (`x-aduin-client`, `x-aduin-doc`, `x-aduin-turnstile`), `ndjson.ts` (generic stream client, ignores `hb`, first terminal frame wins, 4 MiB line cap, no auto-retry; reused by Phase 06 OCR), `quota.ts` (silent on failure). Turnstile is a token-provider seam only (no key: "verification needed", no call); the widget loader is Phase 10.
- **E2E hooks** (IS_E2E only, compiled out of production): `__aduinE2E.setApiBase(base)` (called by the five AI specs before opening a document) and `__aduinE2E.setFirmRules(texts)` (stub firm rules). `no-e2e-hook-in-dist` guards production.
- **New data-testids:** `ai-banner` (`data-reason`), `ai-retry`, `ai-not-precomputed`, `ai-run-sample`, `ai-rules-notice`, `ai-suggestion-label`, `finding-locator`; `ai-allowance` has `data-source` (`quota|stub`).
- **Open:** the `rules_changed` banner has no automated test; AI draft text is not shown yet (mask and clamp `drafts[].text` first, Phase 08).

## Scan Viewer And OCR (Phase 06, `apps/web/src/features/scan`, `apps/web/src/engine/{render-pages,ocr-queue}.ts`)

- **Scan viewer** (`ScanPane`, `scan-model.ts`, `scan-store.ts`, `scan.css`) is embedded in the Findings route for a document with scanned pages (OCR source, or a PDF with scan pages): page chips with per-page state, page image beside extracted text, per-line confidence, low-confidence marking, region highlight on the finding's page, prev/next. Summary line has `aria-live=polite`; the scroll pane is focusable (`tabIndex 0`, role region, labelled).
- **Pipeline:** PDFs are rendered to page images and OCR runs per page on the main thread (`render-pages`, `ocr-queue`; page hash over ORIGINAL bytes). Only page images ever go to `/api/ocr`, never the PDF. Bundled sample #9 (22 scanned pages) reads precomputed OCR from `public/precomputed/ocr/**` with 0 `/api` calls.
- **AI off means no OCR egress:** `runOcrQueue({ aiOff })` takes a getter (`() => boolean`, read before the quota call and before each page, so switching AI off mid-run stops the rest). Precomputed and cached results still apply. A per-load `AbortController` stops a superseded queue and skips scan-store writes for superseded loads.
- **States and banners** (`ScanNotices`): `ocr-unavailable` (text not extracted, page images stay), `ocr-down`, `ocr-ai-off` (AI review is off, so scans are shown as images only), `scan-notice`, `numbering-notice`.
- **Privacy copy** (`features/open-document/privacy-copy.ts`, shown in the upload dialog): "Scanned pages are sent as images to a third-party free AI model to read the text, only while AI review is on." AI is on by default, so page images leave the browser by default after this disclosure (review note N4).
- **New data-testids:** `scan-viewer`, `scan-summary`, `scan-progress`, `scan-page`, `scan-page-chip`, `scan-page-image`, `scan-page-image-pending`, `scan-page-label`, `scan-page-state`, `scan-prev`, `scan-next`, `scan-text`, `scan-line`, `scan-text-highlight`, `scan-region`, `scan-confidence`, `scan-low-confidence`, `scan-no-text`, `scan-notice`, `ocr-unavailable`, `ocr-down`, `ocr-ai-off`, `numbering-notice`.
- **Known gaps:** live OCR boxes are row-level (not word-level) and live confidence is uninformative (0.95); the optional `design/mockups/scan-viewer.html` was not made (the viewer reuses the app.html docpane/paper/banner/badge styles).

## Compare View (Phase 07, `apps/web/src/features/compare`)

- **Files:** `CompareScreen.tsx`, `model.ts` (items, chip groups, `CmpItem.findingId`), `sources.ts` (picker list and bytes, mirrors `open-actions.ts`), `AiSummary.tsx`, `compare.css` (tokens only; the mockup's `#fff` hover colour is `var(--paper)`). Registered through `features/registry.ts` (`id:'compare'`). Mockup: `design/mockups/app.html #v-compare` (no side-by-side toggle, no "Mark reviewed"). The engine runs the diff in the Web Worker (`EngineApi.diffDocuments`), only types plus `mask` reach the main thread; every excerpt is masked with its `sensitiveSpans`.
- **Formats:** HTML samples (not the scan set) and stored uploads named `.htm/.html/.pdf/.docx`. Scans and images are excluded (backlog `compare-ocr-documents`). Same document selected twice shows "No differences" without a worker call.
- **Testids:** `compare-view` (`data-mode`), `cmp-meta`, `cmp-base`, `cmp-compare`, `cmp-swap`, `cmp-mode-version`, `cmp-mode-sibling`, `cmp-stats`, `cmp-chip` (`data-k`, `data-n`), `cmp-clear`, `cmp-list`, `cmp-item` (`data-id`, `data-kind`, `data-group`, `aria-current`), `cmp-empty`, `cmp-loading`, `cmp-nodiff`, `cmp-nostructure`, `cmp-error` (`data-side`), `cmp-detail`, `cmp-clause-diff`, `cmp-reveal`, `cmp-counsel`.
- **Needs counsel:** works only for findings-delta rows that are findings of the open document (`useReview().needsCounsel`); diff-only rows show it disabled with "Available after counsel sheet (Phase 08)" (backlog `phase08-version-drift-questions`).
- **AI summary** (`AiSummary`, version mode, notice none; element `data-state`): `none` (no renames), `off` (AI switch off), `unavailable` (no API in the build), `idle` ("Summarize changes" button, no call on open), `pending`, `done` (lines `from -> to` plus text, "AI suggestion" tag, `model - fresh|from cache`), `skipped` (banner with reason and Retry; the diff is unaffected). Uses the generic stream client with `task: 'drift-narrative'`.

## Logic Outline Export (Phase 09, `apps/web/src/features/outline`, `apps/web/src/lib/download.ts`)

- **Files:** `finalizeOutline.ts` (validates with `OutlineSchema`, blocks an invalid outline), `ExportOutlineButton.tsx` (mounted in the `StructureScreen` header, only when a document is open, disabled when there is no structure), `OutlinePreview.tsx`. Shared `lib/download.ts`: `downloadBlob(filename: string, data: string | Blob, mime: string): void` (frozen signature; revokes the object URL in `setTimeout(0)`; Phase 08 reuses it unchanged).
- **Testids:** the Export outline button and preview (preview exposes `data-count`) as asserted in `e2e/logic-outline-export.spec.ts`; the e2e hook field `forceInvalidOutline` exists only in `--mode e2e` builds.

## UI Test Conventions

- Two Playwright projects (`apps/web/playwright.config.ts`): `preview` (`vite preview` of a `--mode e2e` build, stub memory API, no Worker; runs every Phase 03 spec) and `stack` (built SPA + Worker; only `slice.spec.ts`; select with `--project=stack`; `SLICE_BASE_URL` points it at a deployed https `*.workers.dev` Worker). Details and commands: `process/context/tests/all-tests.md`.
- Derive layout and tokens from `design/mockups/app.html` at test time through `apps/web/test/support/mockupCss.ts` (`rootVars`, `fontSizes`, `radii`, `shellWidths`, `railMaxWidth`, `sevTable`, `reasonsList`, `findingsCss`); never hard-code mockup numbers in specs. Later UI phases add their own section slicer beside `findingsCss` (Phase 07 added `compareCss()`).
- E2E hook `window.__aduinE2E` exists only in `--mode e2e` builds (`no-e2e-hook-in-dist` guards production). Fixtures: `e2e/fixtures/{app,seedMemory}.ts`.
- A11y: `@axe-core/playwright` is installed as a dev-only dependency (MPL-2.0 decision D-8 recorded in `THIRD_PARTY_NOTICES.md`); gate = zero critical violations; serious items are listed, not gate-failing, and close in Phase 10.
- Known UI follow-ups U1-U4 (locator chip shipped in Phase 05, contrast measurement, keyboard-focus screenshot, notes underline): `process/general-plans/backlog/core-followups_17-10-26/core-followups_REF_17-10-26.md`. AC6 edit-text/severity: backlog B-EDIT.

## Source Paths

- `process/context/product-domain.md`
- `apps/web/src/{styles,shell,features,components,state,engine}/`, `apps/web/e2e/`, `apps/web/test/support/mockupCss.ts`
- SPEC path above
- `design/mockups/` (once created)
- `~/.claude/skills/{taste-minimalist-skill,taste-redesign-skill,design-taste-frontend}`

## Update Triggers

Mockup approved, tokens changed, skill version changed, new references provided, shell/route/testid contract change, a later UI phase replaces a placeholder view.

## Routing

No deeper docs yet. Add rows here when tokens, references or component conventions get their own files. Test commands: `process/context/tests/all-tests.md`.
