---
name: context:all-ui
description: UI/UX design direction, design skills, references, tokens and approved mockups for the sub-doc QA web app
keywords: memory screen, firm memory, ui, ux, design, mockup, frontend, layout, look and feel, design tokens, taste skill, minimalist, accessibility, wcag, review workspace, counsel sheet, app.html, sidebar, shell, data-testid, route, hash, radix, tailwind, playwright, component, findings screen
related: [context:tests]
date: 18-10-26
metadata:
  node_type: group-entrypoint
  type: context
  read_when: any UI/UX design, mockup, frontend implementation or UI review task
---

# aduin-transaction - UI/UX Context

Last updated: 2026-10-17 (Phase 10 UPDATE PROCESS; code HEAD f0d924b plus the process commit)

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

## Counsel View, Gate And Memory Sync (Phase 08, `apps/web/src/{features/{counsel,gate,metrics,audit},state/memory-sync.ts,api}`)

- **Counsel view** (`features/counsel`, registry entry `counsel`): header "Counsel questions" with "N questions · N unanswered", All / Unanswered segment, AI draft, Export DOCX; one row per question (severity, Qn, wording, tag New / Accepted / Answered / Unclear), expanded body with masked quote and pin citation, A/B/C readings, provenance chip (Template draft / AI suggestion / Edited by you), wording editor (Ctrl/Cmd+Enter saves, Esc cancels), Record or Change answer form (A/B/C/unclear, note, answered by, date). Drafts persist in Dexie `drafts` as `counsel:{docId}`; question ids in uiState `questions:{docId}`. The counsel nav badge still counts Needs-counsel findings only.
- **Gate popover** (`features/gate`): reasons link into Counsel or Findings (`data-target`); text "Dismissed in [fund], re-confirm" and "Awaiting counsel (asked in [fund])"; the sidebar GateButton shares the open state.
- **Metrics panel** (`features/metrics`): shown after the first export only (`metrics:{docHash}`, t0 captured at the top of `openDocument`, first export only).
- **Unsynced / parked chip** (`shell/UnsyncedChip.tsx`): hidden at 0, between the gate and the AI switch; parked ops read "memory unavailable, retries on reload".
- **Analyst name:** inline dismissible edit in `AnalystBadge` (default Linh Tran, 1-80 chars, control and bidi characters stripped, persisted in uiState `session:analystName`). Renaming does not change the server-side analyst of a live sandbox session (documented in `session.ts`; a UI hint is in the backlog).
- **Export:** `exportDocx.ts` lazy-loads `docx`; `export-flow.ts` builds the DOCX first and records to memory best-effort, so a memory failure still downloads with the quiet note "Saved locally; not recorded in memory." (review F1). Only a DOCX build failure raises `ExportError`. No firm tag: answers stay local, export still works. Read-only demo: writes disabled with a read-only note.
- **Testids (new):** `counsel-view`, `counsel-meta`, `counsel-filter-all`, `counsel-filter-open`, `counsel-ai-draft`, `counsel-export`, `counsel-gate-line`, `counsel-gate-reasons`, `counsel-no-firm`, `counsel-read-only`, `counsel-empty`, `counsel-list`, `counsel-none`, `counsel-row` (`data-finding-id`, `data-state`), `counsel-row-toggle`, `counsel-question-text`, `counsel-quote`, `counsel-interp`, `counsel-provenance`, `counsel-edit*`; the full list is in the Phase 08 REPORT (S2 "New test ids").
- **AuditList** (`features/audit/AuditList.tsx`) is presentational (no fetching); Phase 08b mounts it in the memory Audit tab unmodified.
- **Preview builds** (`--mode e2e`) keep the Dexie stub memory client even after `setApiBase('/')`; production and vitest use the real client when the API base is set. Specs that need the real client with a fake Worker call the IS_E2E-only `__aduinE2E.useRealMemory(true)` (see `process/context/tests/all-tests.md`).

## Firm Memory Screen (Phase 08b, `apps/web/src/features/memory`, `apps/web/src/styles/memory.css`)

- **Route and scope:** `#memory`, registry id `memory`. The firm is the open document's `firmId`; no firm shows the empty state (`memory-no-firm`) and makes no API call. UI contract is `design/mockups/app.html` `#v-memory`.
- **Layout:** header "{Firm} memory" with a meta line (decisions, active, rules, suggested); a `role=tablist` segmented control Decisions | Rules | Audit trail (arrow keys, Home, End); "What memory keeps" info popover. States: loading, unavailable with Retry ("Memory unavailable. Findings are shown as New."), read-only note.
- **Decisions tab:** one row per decision, issue-class filter and All / Active / Reopened status segment, "N of M", 200-row truncation note. Reopen opens a native `<dialog>` with a required reason; Reopened rows are derived from `decision_revoked` audit events (the firm endpoint returns only active decisions), so they cover loaded audit pages only. After a Reopen the store action `refreshMemory(revokedDecisionId?)` in `state/review.ts` resets same-document triage entries to `open`, clears a local counsel answer when the revoked decision was an answered one (gate re-blocks), then re-reads memory.
- **Rules tab:** Suggested strip (proposed rules with "N matching dismissals" from a client cross-match, never `evidence_count`; Review dialog with Approve and Reject, no note field; "No effect until approved"); Active rules table with who/when from audit; Add rule; per-rule Deactivate with reason (Edit is omitted); AI info line (20 rules, 4096 bytes); 100-active-rule cap message; Rejected caption list.
- **Audit tab:** action-group filter over the loaded pages, "N of M entries, newest first", "Show older entries" paging through `audit(cursor)`.
- **Writes** (Reopen, Add, Approve, Reject, Deactivate) are awaited `MemoryApi` calls with a fresh `client_op_id`; never queued in the outbox. 409 or 400 `*_not_found` / `rule_state` closes the dialog, refetches and toasts "Already changed"; 403 sets read-only (controls disabled with the title "This demo workspace is read-only."); network errors keep the dialog open ("Could not reach memory. Try again"). The dialog ignores Escape and Cancel while a write is in flight. Free text renders as React text nodes only.
- **Testids:** `memory-view`, `memory-meta`, `memory-tabs`, `memory-tab-{decisions,rules,audit}`, `memory-info`, `memory-kept`, `memory-no-firm`, `memory-loading`, `memory-unavailable`, `memory-retry`, `memory-read-only`; Decisions `memory-decisions`, `memory-filter-class`, `memory-filter-status` (`data-value`), `memory-decisions-shown`, `memory-decision` (`data-decision-id`, `data-status` active|reopened, `data-class`), `memory-reopen`, `memory-decisions-empty`, `memory-decisions-truncated`; Rules `memory-rules`, `memory-suggested`, `memory-suggestion` (`data-rule-id`), `memory-suggestion-matching`, `memory-review`, `memory-no-suggestions`, `memory-active-rules`, `memory-rule` (`data-rule-id`), `memory-deactivate`, `memory-add-rule`, `memory-no-rules`, `memory-ai-info`, `memory-rejected`, `memory-rejected-rule`; dialogs `memory-dialog` (`data-kind`), `memory-dialog-{reason,text,error,submit,cancel,close}`, `memory-approve`, `memory-reject`, `memory-matching`, `memory-matching-{item,count,none}`, `memory-reject-note`, `memory-review-read-only`, `memory-review-text`; Audit `memory-audit`, `memory-audit-group`, `memory-audit-shown`, `memory-audit-note` plus Phase 08 `audit-list`, `audit-event`, `audit-more`.
- **Open polish (backlog P8b-1 to P8b-4):** quiet refetch drops loaded older audit pages; "Reopened" includes undo/restore revokes; a failed quiet refetch hides valid data; aria-labels expose raw ids. See `process/general-plans/backlog/core-followups_17-10-26/core-followups_REF_17-10-26.md`.

## Turnstile, Memory State and Banners (Phase 10)

- **Render-first:** deterministic findings render as soon as the engine result is ready. Memory labels start as New, then the AI precomputed lookup, session bootstrap plus outbox flush and the memory lookup run in the background and apply only while the load is current. Never block rendering on Turnstile or the session.
- **`data-memory-state` on the findings column** (`FindingsScreen.tsx`): `pending` (firm doc, background steps running), `ready`, `unavailable` (bootstrap failed or no token; the "Memory unavailable" banner shows with a Retry, testid `memory-unavailable-retry`), `none` (no firm). E2E fixtures wait for it to leave `pending`.
- **Turnstile overlay** (`features/ai/turnstile-widget.ts`, `turnstile.ts`): managed widget, hidden by default. It is revealed only when the user just acted (`markUserIntent()`, 15 s window: AI Run/Retry, memory writes, analyst-name edit, Firm memory page load/Retry, banner Retry). Background requests settle null at once on `before-interactive-callback` and never show the overlay. Copy: "Verify you are human to use AI and memory features". Unset site key means no provider and no script load (preview/e2e builds). A failed unauthorized bootstrap is cached 60 s so no repeated challenges.
- **a11y fixes (Phase 10):** `.docsw` aria-label starts with the visible text ("{name} {firm}, switch document"); the document scroller is `role=region`, `tabIndex=0`, `aria-label="Document text"`.
- **CSP implications for UI code:** no inline scripts, no eval (Zod runs jitless via `src/zod-jitless.ts`, imported first in `main.tsx`), fonts are files not data: URIs, `style-src` keeps `'unsafe-inline'` only for Radix scroll-lock styles (residual R-CSP-STYLE).
- **Open (operator):** screenshots `13-memory` and `14-audit` need a Turnstile-verified session; manual keyboard pass not recorded.

## Fund Package Intake surfaces (no new screens; `apps/web/src/features/{package,open-document,gate,counsel}`, `state/package.ts`)

Source of truth: the Phase 2 and 3 reports in `process/features/fund-package-intake/active/intake-mvp_17-10-26/`. Intake folds into existing screens; the registry, sidebar and design tokens are unchanged.

- **Upload modal:** multi-file drop (12 files, 40 MB, refusal message stores nothing), a Demo packages list, and a package confirmation table (`PackageConfirmTable.tsx`): firm, fund and version, per-file type, role, confidence and reason; low-confidence rows must be confirmed before Run checks; baseline role is offered for same-firm documents only. A single high-confidence sub agreement becomes a one-document package (coverage shows after findings render); Samples-list opens stay classic.
- **Structure -> Package lens** (`PackageLens` with Documents, References, Terms, Coverage table): reference confirm and "None of these", terms `defined in package` / `unverified`, corrections persist across reload (24 h window).
- **Findings header:** `CoverageLine` sits next to the gate pill; the gate popover lists `PackageGateReasons`. A partial package never looks fully checked.
- **Questions:** "For the GP" group (`GpRequestGroup`) with one item per distinct missing document plus its quote, and one request DOCX per export click (`exportRequestDocx.ts`). Absent without a package.
- **Data contract:** `usePackage` store, frozen `PackageView` (`features/package/contract.ts`); Dexie v2; reload restores the package (`state/last-doc.ts`, `App.tsx`). Render-first holds: findings never wait for package work.
- **Known gaps:** Escape on the Upload modal returns focus to `<body>` (stub `intake-dialog-focus-return`); a11y serious (non-critical) color-contrast x1 (Findings) and label-content-name-mismatch x4 (Package lens); manual keyboard and screen-reader pass not run; main bundle +270 kB (837 kB).

## Variance surfaces in Findings (Variance Phase 02, no new screens; `apps/web/src/features/variance`, `styles/variance.css`)

Source of truth: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-02-web-findings_REPORT_17-10-26.md`. Version changes fold into the existing Findings screen; registry, sidebar and tokens unchanged.

- **Segment and filter:** `All / Errors N / Changes N` beside the kept `CoverageLine`; chips and `Errors N` count errors only. Filters gain `kind` and `showCosmetic` (old persisted filters still load).
- **Change rows:** type chip, read-only owner chip, status icons, old text above new with `del` strike-through and `ins` bold underline, impact lines ("from the logic graph, deterministic"), provenance `version (hash8)`, masked by `maskQuote`. Rows carry `data-kind="change"` and `data-change-type`. "Mark as expected..." (Dismiss modal, reason required) and "Ask owner" (Needs counsel) write local triage only (existing `triage:{docId}` key).
- **Cosmetic changes:** hidden by default; "Show cosmetic changes (N)" sits under the list (`CosmeticGroups`, groups capped at 5 plus a muted overflow line), not in the Filter popover.
- **Baseline control:** header `BaselineControl` (`vs <name>`, firm documents only; aria-label must contain the visible text) and `BaselineModal` (same-firm candidates whose text is in the browser, suggested item pre-checked). Baseline source order: package role first, firm pointer `variance:baseline:{firmId}` second; samples never become a pointer baseline; no demo control.
- **Muted lines:** exact no-baseline copy ("No earlier document from this firm. Reviewing for errors only."), scan baseline and scanned-current lines, expired line, two-baselines ignored line. Null-firm documents show no segment and no line.
- **Pending pill:** "Checking changes" (`data-variance-pending`) on the gate pill while the pass runs; never Ready while pending; render-first holds (findings never wait; failure or the 20 s `VARIANCE_PENDING_TIMEOUT_MS` ends pending). Change rows gate only when a baseline resolved and the pass is ready (`computeGate(rows, policy)`).
- **Known gaps:** human keyboard and screen-reader pass not run (backlog `variance-web-manual-keyboard-pass_NOTE_17-10-26.md`); live Turnstile render-first path unproven.

## Variance owners, Questions and answers (Variance Phase 04, no new screens; `apps/web/src/features/{variance,counsel,gate}`)

Source of truth: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-04-owners-answers_REPORT_17-10-26.md`.

- **Owner chips:** each change row shows an owner chip and a "Suggested owner" select with the routing reason. The override is saved in `uiState` (`variance:owner:{docId}`) and sent as `owner_source: 'override'`. The select is read-only once the question is asked. "You" is local-only (Ask owner is disabled until the owner changes).
- **Questions screen (h1 and effective registry label "Questions"; route hash unchanged):** with change questions it shows tabs `All · Counsel n · GP n · Fund admin n` (`questions-tab-<k>`, `data-count`), owner sections, and "Export for <owner> (DOCX)" through the existing ExportDialog (owner in title and filename). Error-only documents keep the flat Phase 08 list. Intake's `GpRequestGroup` stays above the list on every tab. Question rows carry `data-key`, `data-owner`, `data-kind`.
- **One question per (finding, owner):** key `<findingId>@<owner>` for change findings; error findings keep the plain id. One selector feeds tabs, gate popover and sidebar badge so counts agree.
- **Answer dialog:** change questions get option A marked Default, "Why is it written this way? (intent)", scope "This fund only / Firm template", and one assertion preview line (`AssertionPreview`, from `describeAssertion`, or "No automatic check for this item."). Firm template needs a non-blank intent after masking. Intent is human-only; change questions never get an AI draft.
- **Regression finding:** a prior firm-template assertion that no longer holds appears as a finding in the group "Earlier funds" (background `regression-client`; silent skip when nothing is retained).
- **Gate pairs:** the popover groups reasons You, Counsel, GP, Fund admin, Earlier funds (`[data-testid=gate-group][data-group]`, `data-count`; sizes sum to `gate.reasons.length`). A revoked owner answer sets that owner back to asked, so the gate re-blocks. `GateButton.tsx` is unchanged.
- **Known gaps:** human keyboard and screen-reader pass for owners and answers not run (backlog `variance-manual-keyboard-pass_NOTE_17-10-26.md`); review minors in `variance-p04-review-minors_NOTE_18-10-26.md`.

## UI Test Conventions

- Two Playwright projects (`apps/web/playwright.config.ts`): `preview` (`vite preview` of a `--mode e2e` build, stub memory API, no Worker; runs every Phase 03 spec) and `stack` (built SPA + Worker; only `slice.spec.ts`; select with `--project=stack`; `SLICE_BASE_URL` points it at a deployed https `*.workers.dev` Worker). Details and commands: `process/context/tests/all-tests.md`.
- Derive layout and tokens from `design/mockups/app.html` at test time through `apps/web/test/support/mockupCss.ts` (`rootVars`, `fontSizes`, `radii`, `shellWidths`, `railMaxWidth`, `sevTable`, `reasonsList`, `findingsCss`); never hard-code mockup numbers in specs. Later UI phases add their own section slicer beside `findingsCss` (Phase 07 added `compareCss()`).
- E2E hook `window.__aduinE2E` exists only in `--mode e2e` builds (`no-e2e-hook-in-dist` guards production, including `useRealMemory`). Fixtures: `e2e/fixtures/{app,seedMemory,memory-stub-rules}.ts`.
- A11y: `@axe-core/playwright` is installed as a dev-only dependency (MPL-2.0 decision D-8 recorded in `THIRD_PARTY_NOTICES.md`); gate = zero critical violations; the two serious items closed in Phase 10 (specs `a11y-keyboard`, `perf-budget`, `csp-headers`, `turnstile-no-block`).
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
