---
name: plan:subdoc-qa-mvp-phase-03-web-shell
description: "Sub-doc QA MVP — Phase 03: app shell (vertical sidebar / icon rail) and Findings screen built to the approved app.html mockup, showing real findings from the core engine on bundled samples (vertical slice); other routes are placeholders"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-03
---

# Phase 03 — Web Shell (approved app.html: shell + Findings, real findings)

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED (re-targeted to app.html 17-10-26, supplement cycle 3)
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Milestone:** M1 vertical slice (00 → 01 → 03 → 04a)
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-03-web-shell_REPORT_17-10-26.md

---

## Overview

Builds `apps/web` to the **approved** mockup `design/mockups/app.html` (notes: `design/mockups/app_NOTES.md`; direction: `process/context/ui/all-ui.md`; umbrella `## Execution Holds`, hold update 17-10-26: Phase 03 RELEASED for shell + Findings). The app loads a bundled sample, runs the Phase 01 engine in a Comlink Web Worker, and shows **real** findings in the mockup's layout:

- **App shell:** vertical sidebar 232 px that collapses to a 56 px icon rail (auto-collapses below 1200 px; only the collapse state is persisted). Groups in sentence case: Review (Findings, Counsel questions), Check (Structure, Compare versions), Firm (`<firm> memory`, Documents). Bottom-pinned: gate button "Blocked · N" with a reasons popover, the AI on / No AI switch with the daily allowance, the analyst name. NO horizontal tab bar.
- **Findings screen:** one-line header ("Findings" + "N open · N block digitization") with the stage stepper collapsed into one status button plus popover; reading view + 400 px findings column (380 px at 1024); the outline column is replaced by a "Jump to section" menu (blocking counts per section); severity chips (Blocks / Fix / Note) plus one Filter menu; one-line finding rows that expand in place on select; Dismiss is a focus-trapped modal with a required reason; "Previously handled (n)" is a collapsed row pinned at the bottom of the column; undo toast; masked-value reveal; No-AI banner.
- **Placeholders:** Counsel questions, Structure (incl. the Investor types sub-view), Compare versions, `<firm>` memory and Documents are routed placeholders ("coming in a later build" empty states). Their real views are built by later UI phases after those views are approved in app.html.

Memory is served by a **stub memory API** persisted in IndexedDB (Dexie) so labels, triage persistence and Previously handled work before the Worker exists. Context routers: `process/context/all-context.md`, `process/context/ui/all-ui.md`, `process/context/tests/all-tests.md`.

UI contract (every UI phase): use `minimalist-ui` for visual direction and `redesign-existing-projects` for audit passes on app screens; `design-taste-frontend` only for marketing surfaces (landing, slides), never app screens. **`design/mockups/app.html` is the layout and token spec** (its `:root` and CSS are the single source); `review-workspace.html` is a historical token source only and is never read by tests or used as a layout spec. Tokens (unchanged): cool stone ground #E9ECE9, one teal accent #1D5C57, Geist for UI, Newsreader where app.html uses it (document text, evidence quotes, brand and page/popover/modal headings; the NOTES phrase "document text only" is looser than the CSS, the CSS is the contract), 4px base radius (`--r`) with the named exceptions found in app.html, tone steps instead of borders, no gradients, shadows only on popovers and the dismiss modal. **Allowed font sizes and radii are NOT hard-coded in plan or tests**: they are derived from the app.html CSS at test time (reference values today, to be updated from app.html if it changes: font sizes 13/14/15/16/17/20/28 px; radii 4px (`--r`), 3px, 2px, 999px, plus per-corner 4px/0 on the selected-row bar and 0). **shadcn/Radix reconciliation:** use Radix primitives (Dialog/Popover/Select/Toggle/Collapsible) for accessibility behavior only (focus trap, Esc, aria); restyle every component from the app.html tokens, never ship default shadcn styling. Tailwind maps to the tokens via CSS variables (`@theme`), no hard-coded colors in components.

Scope fence: this phase builds only the **shell + Findings** (plus a minimal functional "Open a document" dialog, see C1). Structure (incl. Investor types), Counsel questions, Compare, Firm memory and Documents have no approved view yet: P03 ships routed placeholders; each later UI phase starts with an app.html view step reusing the same tokens and patterns.

## Phase Completion Rules

- CODE DONE = components and tests committed.
- VERIFIED = Exit Gate green incl. visual check vs app.html, validate-contract re-written for the app.html target, M1 slice check (together with Phase 04a, which authors `slice.spec.ts` from the `data-testid`s published below) recorded, regression: Phase 01 goldens + Phase 00 guards green.
- User confirmed: app.html + app_NOTES.md approved with 3 defaults: the Findings badge counts open items only; group labels are sentence case; Accept on a blocking item keeps the gate Blocked until counsel answers.

## Product defaults folded in (umbrella `## User-Decided Product Defaults`, 17-10-26)

- **D-4** uploads are retained 24 hours in the browser (not 7 days): `retention-purge` asserts 23h59 kept and 24h purged against the `config/limits.ts` value, and the privacy notice states "24 hours". 3 fresh-AI documents per visitor per day; opening a cached sample does not count; the sidebar AI switch shows the allowance as "N of 3 fresh-AI documents left today" (value from `config/limits.ts`, never hard-coded in components; the P03 allowance counter is a Dexie stub, display-only until P05/P04a wire real quota). Sandbox memory 30 days / demo never purged: the upload purge must not touch memory decisions (asserted in `retention-purge`).
- **D-2** a counsel answer on a "Dismissed in <fund>, re-confirm" item counts as the re-confirmation: `gateInterim` treats it as resolved (answer A/B/C; `unclear` stays unresolved); matrix row added in D1a.
- **D-7** sample corpus = 12 HTML (01-08, 10-13) plus the 22-page scan set (09, activates in P06; shown as a disabled row until then). ILPA #14 is local-only and not in the picker.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC2 | Sample picker (inside the Open a document dialog) opens every HTML sample in one click, pre-tagged firm/fund/version (#3–#6 one firm) | `sample-picker-smoke` (loops all 12 `.htm` samples, 01-08 and 10-13, through the worker engine; the 22-page scan set row (#9) is disabled until P06) | Fully-Automated | closes P06 |
| AC3 | Named stages; stage failure → partial result naming the stage; AI shows "pending" | `status-stages` (E2E spec `e2e/status-stages.spec.ts`; status button + stage popover; injected stage failure via E2E-only build flag) | Fully-Automated | AI pending verified P05 |
| AC4 | Selecting a finding scrolls to and highlights its quote | `finding-highlight` (real engine output: sample #1 "this Section 11" mismatch, plus assertions for #3 swapped refs and #11 undefined "Units") | Fully-Automated | scan region highlight P06 |
| AC5 | Filter/sort by severity (chips), class, detector, status (Filter menu); counts match; state survives reload | `filter-sort` | Fully-Automated | Detector select is an additive Filter-menu field not drawn in app.html (see Risks) |
| AC6 | Accept/dismiss/needs-counsel persist and are undoable; Dismiss refused without a reason from the fixed list (modal) | `triage-actions` + `dismiss-requires-reason` (against the stub memory API) | Fully-Automated | PARTIAL here: "answered" closes P08 (real API); "edit text/severity" has no affordance in app.html, deferred (backlog stub B-EDIT below) |
| AC37 | Upload limits stated and enforced (10 MB, 30 pages per scan, accepted types) before any AI call | `upload-limits` (at limit, over limit, wrong type, empty; page-count rows activate in P06) | Fully-Automated | closes P06 |
| AC38 | Privacy notice before first upload and before AI use; AI off switch; stored uploads purged after the 24 h retention | `privacy-notice` + Vitest `retention-purge` (IndexedDB TTL 24 h, fake clock; memory decisions untouched) | Fully-Automated | server purge P04b; toggle effect P05 |
| AC41 | Upload links firm (alias list, no free text), fund name, version label; #3–#6 pre-tagged one firm; no firm → "memory not applied" | `upload-firm-tagging` | Fully-Automated | D1 list parity P04b |
| AC49 | "Previously handled (n)" is complete, collapsible, shows reason/who/fund/when; nothing is removed by showing it | `previously-handled-section` (seeded stub memory + real dismiss flow) | Fully-Automated | closes P08 |

### AC ownership after the app.html re-target (fully met vs partial)

| AC | P03 status | What P03 proves | What moves where |
|---|---|---|---|
| AC2, AC3, AC4, AC5, AC37, AC38, AC41, AC49 | FULLY MET here (within the stated "closing" extras) | gates above | AC5 detector filter is an additive control (flagged to the design session) |
| AC6 | PARTIAL | accept, dismiss (reason required), needs-counsel, undo, persistence | "answered" -> P08; "edit text/severity" -> later UI phase after app.html draws it (backlog stub B-EDIT) |
| AC10 (reveal control) | FULLY MET for the control | Reveal/Hide in the selected row and masked value in the document, seeded-finding test (`triage-actions` extra) | detection and masking rules owned by P02 |
| AC17 (structure view) | NOT MET here; placeholder route only | `placeholder-routes` proves the Structure route renders the "coming in a later build" empty state | placeholder now, real view later: Structure view (incl. Investor types sub-view) in a later UI phase after it is approved in app.html; AC17 extraction stays P01. Umbrella traceability row AC17 (P03 closing column) and the M1 AC list must be updated by the orchestrator |
| AC61 (investor-path view, P02-owned) | NOT HOSTED here | none | P02's `investor-path-view` e2e has no host in P03; it re-targets to the later Structure/Investor types UI phase (registry note appended) |
| AC30 (interim) | PARTIAL | axe zero critical on shell, Findings and open overlays | full sign-off P10 |
| gate rule (AC22 owned by P08) | interim | `gate-interim` + `gate-pill` | P08 `computeGate` parity |

Backlog stub B-EDIT (to be filed by UPDATE-PROCESS; the residual is recorded, not dropped): "AC6 edit text/severity: no edit affordance in app.html; design session to add one, then a later UI phase builds it and adds an `edit-finding` e2e." The gate for the AC6 "edit" clause stays CONDITIONAL until then; AC6 is never declared fully PASS on Known-Gap.

Naming rule (decision, one choice): every e2e spec file is named after its gate token (`e2e/<token>.spec.ts`), every Vitest file after its token (`test/<token>.test.ts`), and every gate command selects by that token as a bare argument, **never with `--`** (pnpm 11.13.1 passes `--` literally and the whole suite runs): `pnpm --filter @aduin/web test <token>` and `pnpm --filter @aduin/web test:e2e <token>`. One token per call in gate loops. A token that matches no file must fail the call (no `passWithNoTests`; Playwright "No tests found" exits non-zero); D0 proves both. Gate-rule extras (not an AC; AC22 is owned by P08): `gate-interim` (Vitest) and `gate-pill` (Playwright).

Severity to app.html label mapping (state explicitly in code and tests; labels read from the `SEV` table in app.html): critical (= blocks digitization) -> "Blocks digitization" (chip "Blocks"); high -> "Fix before build" (chip "Fix"); medium and low -> "Note". This replaces the old review-workspace wording ("Blocks build" / "Fix first"). Memory label display (values = DATA-MODEL `memory_label` CHECK list, see Public Contracts): `new` -> "New", `previously_dismissed` -> "Previously dismissed", `already_answered` -> "Already answered", `awaiting_counsel` -> "Awaiting counsel", `dismissed_reconfirm` -> "Dismissed in <fund>, re-confirm".

## Entry Gate

- Phase 01 exit gate passed (core engine, contracts frozen v1: `fingerprintFor`, optional `Finding.fingerprint`, `quote_hash`).
- `design/mockups/app.html` and `app_NOTES.md` exist and are approved; `process/context/ui/all-ui.md` read.
- UI references: none provided; proceed with app.html as the reference (do not introduce new references during EXECUTE). Mockups other than app.html (compare, counsel-sheet, firm-memory, start, structure) are NOT approved as views: do not build from them.

## Library pins (confirm via vc-docs-seeker in Phase 00)

React, Vite, Tailwind, Radix primitives (via shadcn/ui source), Zustand, TanStack Table, Dexie, Comlink, Playwright, @axe-core/playwright, Newsreader + Geist (self-hosted font files; OFL).

## Touchpoints (create; web only)

```
apps/web/
  index.html, vite.config.ts (E2E flag define via `--mode e2e` + .env.e2e VITE_E2E=1; no samples copy plugin), playwright.config.ts (from P00; two projects below)
  public/samples/*            generated by scripts/src/build-samples.ts from samples/sub-docs/raw (12 .htm: 01-08, 10-13) + manifest.json (firm/fund/version tags; #3–#6 partners-group; #9 scan set listed as disabled)
  public/firms.json           generated from fixtures/memory/law-firms.json
  src/styles/{tokens.css,base.css}   tokens copied from the app.html :root (single source in the web app)
  src/main.tsx, App.tsx, state/{review,filters,session,shell}.ts (Zustand), hash view-switch (no router dependency); `shell.ts` holds route + collapse + auto-rail flag
  src/engine/{engine.worker.ts,client.ts}    Comlink wrapper over @aduin/core (parse, run, structure). ONLY engine.worker.ts imports htmlparser2 / core parse, structure and detector internals; Phase 06 EXTENDS this directory (registry note). Worker settings carry NO firmId; findings return with `quote_hash` and NO fingerprint
  src/storage/db.ts (Dexie: documents, parsedModel cache, uiState, drafts, outbox, allowance)
  src/api/{memoryApi.ts (interface from core contracts), stubMemoryApi.ts (Dexie-backed), client.ts (fetch; real impl in P04b/P08)}
  src/memory/fingerprintFindings.ts   main thread only: core `fingerprintFor(finding, firmId)` per finding, `firmId=null` -> null fingerprints, skip lookup; then `memoryApi.lookup` + core `resolveLabel`
  src/components/ui/*         Radix-based primitives restyled from tokens (popover, dialog/modal, select, collapsible)
  src/shell/                  AppShell, Sidebar (232 px) + IconRail (56 px), NavGroup (Review/Check/Firm, sentence case), DocSwitcher, GateButton + GatePopover, AiSwitch + allowance, AnalystBadge, collapse hook (matchMedia max-width:1199px, localStorage guarded by try/catch)
  src/features/open-document/  minimal functional "Open a document" dialog (launched from the doc switcher and the empty state): sample picker + upload + firm/fund/version + limits copy + privacy notice (visual design of the Documents/start surface is a later UI phase)
  src/features/processing/    stage stepper content (read, structure, checks, AI review, done) rendered inside the status popover + allowance slot
  src/features/review/gateInterim.ts   pure function, reason kinds open|unanswered|unclear|awaiting_counsel|reconfirm_required; its type mirrors Phase 08 computeGate so P08 swaps the import for core
  src/features/review/        FindingsScreen: header + StageStatusButton + StagePopover, doc pane (rendered from model text nodes, never raw HTML) + JumpToSectionMenu, findings column (TanStack Table rows), SeverityChips, FilterMenu, FindingRow (one line, expands on select), DismissModal (focus-trapped, required reason), UndoToast, label tags, PreviouslyHandledRow, RevealControl, NoAiBanner
  src/features/placeholders/  PlaceholderView content for counsel, structure (incl. Investor types sub-view), compare, memory, documents ("coming in a later build")
  src/features/registry.ts    (seam from P00: register findings + placeholder routes; later UI phases APPEND real views that replace a placeholder route)
  e2e/{app-shell,placeholder-routes,sample-picker-smoke,status-stages,finding-highlight,filter-sort,triage-actions,dismiss-requires-reason,upload-limits,privacy-notice,upload-firm-tagging,previously-handled-section,hostile-html,gate-pill,engine-worker-split,layout-vs-mockup,a11y-smoke}.spec.ts   (file name == gate token; `slice.spec.ts` is owned by Phase 04a, NOT created here)
  test/{tokens-match-mockup,gate-interim,import-graph,source-guard,stub-memory-api,retention-purge,severity-label,memory-label-enum,no-e2e-hook-in-dist}.test.ts   (Vitest; `severity-label` is the A5 severity-mapping test, `no-e2e-hook-in-dist` is B1b, `memory-label-enum` checks core MemoryLabel against DATA-MODEL)
  test/support/mockupCss.ts   shared parser of design/mockups/app.html (:root, font sizes, radii, shell widths, media queries); imported by tokens-match-mockup, severity-label and the layout spec
  e2e/fixtures/{seedMemory.ts}   Playwright fixture seeding the stub memory (Dexie) with fingerprints computed by core `fingerprintFor`
  design-probe/  app.html-vs-app screenshots + rubric (saved in this task folder at closeout)
scripts/src/build-samples.ts
```

Manifest edits (seam edits, serialized by the orchestrator against Phase 04a): `apps/web/package.json` (only manifest P03 edits), `pnpm-lock.yaml`, `THIRD_PARTY_NOTICES.md`, `.gitignore` (adds `apps/web/public/samples/` and `apps/web/public/firms.json`).

```text
Playwright projects (apps/web/playwright.config.ts):
  preview  webServer: `pnpm build:e2e && pnpm exec vite preview` (build mode e2e; `prebuild:e2e` generates samples, so test:e2e AND test:a11y both get samples on a clean checkout); runs every P03 spec
  stack    webServer: `pnpm dev:stack`; runs only Phase 04a's slice spec (P03 does not own it)
Samples mechanism (ONE): `prebuild` / `prebuild:e2e` / `predev` / `pretest:e2e` / `pretest:a11y` npm scripts call scripts/src/build-samples.ts (idempotent); output apps/web/public/samples/* is gitignored; no separate Vite copy plugin.
```

## Public Contracts

- Consumes `@aduin/core` public API and `contracts/memory.ts` only; never imports core internals on the main thread.
- **Fingerprint flow (ONE flow, Phase 01 Contracts v1):** the engine returns findings with `quote_hash` and NO fingerprint (`Finding.fingerprint` is optional and never engine-computed). The main thread calls core `fingerprintFor(finding, firmId)` per finding before `memoryApi.lookup(firmId, fingerprints[])`. `firmId = null` ("Other / no firm") yields `null` fingerprints, skips the lookup, labels every finding `new` and shows "memory not applied" (AC41). `firmId` is never passed to the worker.
- **Memory label enum:** the web uses core `MemoryLabel` whose values must equal the DATA-MODEL `memory_label` CHECK list: `new`, `previously_dismissed`, `already_answered`, `awaiting_counsel`, `dismissed_reconfirm`. `test/memory-label-enum.test.ts` parses the CHECK list from `subdoc-qa-mvp_DATA-MODEL_17-10-26.md` and asserts equality with the core export. NOTE for the orchestrator: Phase 01's plan text still lists `'dismissed'` and `'answered'` in `MemoryLabel`; Phase 01 owns the enum and must align it to DATA-MODEL before this test can pass (P03 does not rename it).
- `MemoryApi` interface (web side) is satisfied by the stub now and by the real Worker client in Phase 08; the stub must reproduce the Worker semantics: append-only decisions, one active decision per fingerprint, revoke instead of delete, `reason_code` required for dismiss.
- Reading view contract: text is rendered as React text nodes from the document model; no `dangerouslySetInnerHTML`, no `innerHTML`, no external resource loads from document content.
- Persisted state (guarded `localStorage`/Dexie access: any storage error falls back to defaults with no thrown error): shell collapse `ui:v1:sidebar` (the ONLY shell/layout state persisted: route, selection, expanded row, open popovers and Previously-handled expansion reset on load); `ui:v1:filters` (AC5, SPEC requires reload survival); `ui:v1:ai` (AC38 AI switch). Note: app_NOTES says filters and AI mode reset on load in the prototype; the locked SPEC (AC5, AC38) requires persistence, so this plan follows the SPEC. **USER-CONFIRMED 17-10-26 ("Đồng ý cả 4 lựa chọn của plan"): filters (`ui:v1:filters`) and AI mode (`ui:v1:ai`) persist per AC5/AC38; the current view/route does NOT persist (always lands on Findings, asserted in `app-shell`).**
- Gate rule (core, confirmed by the user): a critical finding counts as unresolved until it is dismissed with reason or answered by counsel; **Accept alone keeps the gate Blocked** until counsel answers; `dismissed_reconfirm` stays unresolved until re-confirmed, **and (D-2) a counsel answer A/B/C on it counts as the re-confirmation**; answer `unclear` stays unresolved.
- **Published `data-testid`s (contract for Phase 04a's `slice.spec.ts`; stable, never renamed without a registry note):**
  - Shell: `app-shell`, `sidebar`, `sidebar-toggle`, `doc-switcher`, `nav-findings`, `nav-counsel`, `nav-structure`, `nav-compare`, `nav-memory`, `nav-documents`, `nav-badge-findings`, `nav-badge-counsel`, `gate-button`, `gate-popover`, `gate-reason` (one per unresolved item, `data-finding-id`), `ai-on`, `ai-off`, `ai-allowance`, `analyst-name`, `placeholder-view` (attribute `data-route`).
  - Findings: `findings-header`, `findings-meta`, `stage-status-button`, `stage-popover`, `ai-off-banner`, `memory-not-applied`, `doc-pane`, `doc-highlight` (attribute `data-finding-id`), `jump-menu-button`, `jump-menu`, `jump-item`, `findings-column`, `severity-chip-block`, `severity-chip-fix`, `severity-chip-note`, `filter-button`, `filter-menu`, `filter-class`, `filter-detector`, `filter-status`, `filter-sort`, `filter-reset`, `findings-list`, `finding-row` (attributes `data-finding-id`, `data-severity` block|fix|note, `data-status`, `aria-expanded`), `finding-title`, `finding-body`, `finding-quote`, `finding-expected`, `finding-found`, `finding-provenance`, `finding-memory-tag`, `action-accept`, `action-dismiss`, `action-counsel`, `action-restore`, `reveal-toggle`, `empty-state`.
  - Dismiss and toast: `dismiss-modal`, `dismiss-reason` (radio, `value` = reason_code), `dismiss-note`, `dismiss-error`, `dismiss-save`, `dismiss-cancel`, `undo-toast`, `undo-button`.
  - Previously handled: `previously-handled-toggle`, `previously-handled-count`, `previously-handled-item` (attribute `data-memory-label`), `reopen-decision`.
  - Open a document: `open-document-dialog`, `sample-option` (attribute `data-sample-id`), `upload-input`, `limits-copy`, `upload-error`, `firm-combobox`, `fund-input`, `version-input`, `privacy-notice`, `privacy-ack`, `open-submit`.

## Blast Radius

`apps/web/**`, `scripts/src/build-samples.ts`. Manifests: only `apps/web/package.json` is edited; `pnpm-lock.yaml`, `THIRD_PARTY_NOTICES.md` and `.gitignore` are seam edits serialized by the orchestrator against Phase 04a. `apps/web/e2e/slice.spec.ts` is Phase 04a's (not touched). Reads only: `design/mockups/app.html` (tokens, layout, SEV labels, reasons; read at test time), `design/mockups/app_NOTES.md`, `samples/sub-docs/raw/*`, `fixtures/memory/law-firms.json`, `subdoc-qa-mvp_DATA-MODEL_17-10-26.md` (memory_label CHECK list, test time), `@aduin/core` exports. `design/mockups/review-workspace.html` is NOT read (historical). Does not touch `packages/core` or `apps/worker`. Parallel-safe with Phase 04a (disjoint). Registry `## Phase 03` (re-target note appended 17-10-26).

## Data Flow

Sample bytes (static asset or upload) → IndexedDB (document store) → Comlink engine worker (settings: sample id and limits only, no firm) → model + findings (with `quote_hash`, without fingerprint) → main thread store. Main thread: `firmId` (from the document tag) → if null: fingerprints null, no lookup, all findings `new`, "memory not applied"; else core `fingerprintFor(finding, firmId)` per finding → `memoryApi.lookup(firmId, fingerprints[])` (chunks of 200) → `resolveLabel(finding+fingerprint, activeDecision)` → list placement (main list vs "Previously handled (n)" row; `dismissed_reconfirm` stays in the main list and blocks). Triage action → `memoryApi.decide(...)` (stub: Dexie append) → state refresh → gate and badges recomputed. Filters → Zustand → `ui:v1:filters`; sidebar collapse → `ui:v1:sidebar`.

## Failure Modes

Engine worker error → partial result with stage named in the stage popover and status button (AC3); memory API error → all findings New plus "Memory unavailable" banner; no firm → "memory not applied"; corrupt/unsupported/empty upload → inline message in the Open a document dialog, no crash; hostile HTML → rendered as inert text (AC39 hostile case); blocked or throwing `localStorage` → defaults, no uncaught error; viewport below 960 px is out of scope (app.html `min-width:960px`).

## Implementation Checklist

### Step A — Mockup contract and tokens
- [ ] A1. Read `process/context/ui/all-ui.md`, `design/mockups/app.html` and `app_NOTES.md`; list interactions to reproduce (sidebar collapse/expand toggle and auto-rail below 1200, nav switching with `aria-current`, doc switcher menu, gate button + popover with jump links, AI on/No AI switch + allowance + rail mini button, status button + stage popover, Jump to section menu, severity chips toggle, Filter menu (class, status, sort, reset, J/K hint), click-to-expand row, highlight + scroll, Accept / Dismiss modal / Needs counsel / Restore, undo toast, Previously handled row with Reopen decision, masked value + Reveal, No-AI banner, J/K, Esc closes popovers/modal).
- [ ] A2. Create `src/styles/tokens.css` from the app.html `:root`; Tailwind `@theme` maps to the variables; self-host Newsreader and Geist; `base.css` carries the app.html resets (`button,select,textarea{font:inherit;color:inherit}`, plus `input{font:inherit}`).
- [ ] A3. `test/support/mockupCss.ts` (parser of `design/mockups/app.html`) and Vitest `test/tokens-match-mockup.test.ts` (Vitest only; no Playwright token spec): parse the app.html `:root` custom properties and assert each equals the value in `tokens.css`.
- [ ] A4. Source guard `test/source-guard.test.ts` (Vitest): fail on hex colors or default shadcn color classes (`bg-primary`, `text-muted-foreground`, `border-border`, etc.) in `src/components`, `src/shell` and `src/features`; colors only via token variables.
- [ ] A5. Fix severity to label mapping in one module (`critical`->"Blocks digitization"/chip "Blocks", `high`->"Fix before build"/"Fix", `medium`/`low`->"Note") with Vitest `test/severity-label.test.ts` asserting it AND that the label strings equal the `SEV` table parsed from app.html.

### Step B — Engine bridge and storage
- [ ] B1. `engine.worker.ts` + `client.ts` (Comlink), progress events per stage. Worker settings contain NO `firmId`; findings come back with `quote_hash` and no fingerprint (Phase 01 Contracts v1).
- [ ] B1a. Split guard: Vitest import-graph test `test/import-graph.test.ts` (or ESLint `no-restricted-imports`) proving only `src/engine/engine.worker.ts` imports `htmlparser2` and core parse/structure/detector internals; main-thread code may import only these `@aduin/core` public symbols: `fingerprintFor`, `resolveLabel`, `MemoryLabel`, `mask`, firm list functions, memory contract types and the `limits` config.
- [ ] B1b. E2E-only stage-failure hook: compiled in only when `VITE_E2E=1` (the Playwright `preview` build, mode `e2e`); a Vitest/Node test `test/no-e2e-hook-in-dist.test.ts` builds without the flag and asserts the production build output directory contains no hook marker string.
- [ ] B1c. `src/memory/fingerprintFindings.ts`: for each finding call core `fingerprintFor(finding, firmId)`; `firmId=null` returns null fingerprints and the caller skips `memoryApi.lookup`, sets every label `new`, and shows `memory-not-applied`; else lookup in chunks of 200 and `resolveLabel`. `test/memory-label-enum.test.ts` per Public Contracts.
- [ ] B2. Dexie `db.ts` (stores, TTL purge on app start using `config/limits.ts` retention = 24 h for uploads/parsed models/drafts; never purges memory decisions; allowance counter store, decremented only by a non-cached fresh-AI document, not by opening a cached sample).
- [ ] B3. `scripts/src/build-samples.ts` run by the `prebuild`/`prebuild:e2e`/`predev`/`pretest:e2e`/`pretest:a11y` scripts (single mechanism; output gitignored); manifest with firm/fund/version tags (#3–#6 `partners-group`, fund/version labels from file names; 12 HTML samples 01-08, 10-13; #9 scan set listed as disabled).
- [ ] B5. Define `apps/web/package.json` scripts (the only manifest P03 edits): `test` = `vitest run` with Vitest `include: ['test/**/*.test.ts']`, `exclude: ['e2e/**']`, NO `passWithNoTests`; `build` = `vite build`; `build:e2e` = `vite build --mode e2e` (`.env.e2e` sets `VITE_E2E=1`); `test:e2e` = `playwright test --project=preview`; `test:a11y` = `playwright test --project=preview a11y-smoke`; `pretest:e2e`, `pretest:a11y`, `prebuild`, `prebuild:e2e`, `predev` = `tsx ../../scripts/src/build-samples.ts` (the single samples mechanism). Gates pass tokens as bare arguments (no `--`). `playwright.config.ts` `testMatch`: project `preview` matches all `e2e/*.spec.ts` except `slice.spec.ts` (`testIgnore: /slice\.spec\.ts/`), `forbidOnly: true`; project `stack` matches only `slice.spec.ts` (Phase 04a's).
- [ ] B4. `stubMemoryApi.ts` implementing the `MemoryApi` interface with the real semantics; `test/stub-memory-api.test.ts` builds its fingerprints with core `fingerprintFor` (never hand-made strings).

### Step C — Screens
- [ ] C1. Open a document dialog (Radix Dialog restyled; launched from the doc switcher "Open another document…" and the empty state of Findings): sample picker (12 HTML samples; #9 scan set disabled until P06), upload with limits copy (10 MB, 30 pages per scan, `.htm/.html/.pdf/.docx/.jpg/.jpeg/.png`; `.pdf/.docx/images` pass validators and then show the inline message "supported in a later build" (until P06), no crash), firm picker (alias-resolving combobox; free text rejected; "Other / no firm" allowed with the "memory not applied" message), fund name, version label; privacy notice before the first upload and before first AI use with retention values from `limits.ts` (uploads 24 hours) and the 3 fresh-AI documents per day allowance copy; AI switch state stored. This dialog is functional and token-styled only; it is excluded from the app.html fidelity rubric.
- [ ] C2. App shell: sidebar 232 px / icon rail 56 px with the collapse toggle (`sidebar-toggle`), auto-rail below 1200 px (toggle hidden), groups Review / Check / Firm in sentence case, nav items and badges (Findings badge = open items only; Counsel badge = needs-counsel items; no Structure/Compare badge since the Structure issue count definition is an open design question), `<firm> memory` label from the document's firm ("Firm memory" when no firm), bottom-pinned gate button + gate popover (reason items jump to the finding), AI on / No AI switch + allowance ("N of 3 fresh-AI documents left today"; the rail shows the mini toggle), analyst name (placeholder constant, app_NOTES open question 4), skip link, no horizontal tab bar; collapse state persisted only (`ui:v1:sidebar`).
- [ ] C3. Findings screen to app.html: one-line header with meta and `stage-status-button` + `stage-popover` (named stages read, structure, checks, AI review, done; partial-failure state; AI pending / off), No-AI banner, reading view with highlight, `jump-menu` (sections with blocking counts), findings column 400 px (380 px at max-width 1279) with severity chips, Filter menu (class, detector, status, sort, reset; active-filter count badge), one-line rows expanding in place (quote with location, expected/found, provenance rule id or model + fresh/cache, label tag, memory note, "Why it was flagged" disclosure, Accept / Dismiss… / Needs counsel; "Re-confirm dismissal…" on `dismissed_reconfirm`; Restore on dismissed), Dismiss modal (4 fixed reasons mapped to reason_code, optional note, refused without a reason with the app.html message, Radix focus trap, rest of app inert, Esc closes, focus returns, then selection moves to the next finding), undo toast on every change, "Previously handled (n)" collapsed row pinned at the column bottom with items showing label/who/fund/when/reason and "Reopen decision" (revoke, never delete). The gate uses `features/review/gateInterim.ts` (reason kinds open|unanswered|unclear|awaiting_counsel|reconfirm_required, signature mirroring P08 `computeGate`).
- [ ] C4. Placeholder routes: Counsel questions, Structure (incl. the Investor types sub-view), Compare versions, `<firm>` memory, Documents each render `placeholder-view` (h1 + "coming in a later build" empty state, no link to design files); registered through `features/registry.ts` so later UI phases replace them by appending.
- [ ] C5. Reveal control for masked sensitive values (default masked in the list row and in the document; `reveal-toggle`).
- [ ] C6. Keyboard: J/K, Enter/Esc, visible focus (2 px accent outline), ARIA roles for list/dialog/popover, `aria-current="page"` on the active nav item, `aria-expanded` on every popover trigger; severity never by color alone (icon + word).

### Step D — Tests
- [ ] D0. Gate wiring check (record output in the report): `pnpm --filter @aduin/web test no-such-token` and `pnpm --filter @aduin/web test:e2e no-such-token` both exit non-zero; `pnpm --filter @aduin/web test gate-interim` runs exactly 1 file; `pnpm --filter @aduin/web test:e2e gate-pill` runs only `gate-pill.spec.ts`; `pnpm --filter @aduin/web test:a11y` works on a clean checkout (samples generated by the hook/webServer build).
- [ ] D1. Playwright specs per Test Gates under project `preview` (`vite preview` of a `VITE_E2E=1` build, stub API; no Worker). `slice.spec.ts` is Phase 04a's under project `stack`; P03 does not create it.
- [ ] D1a. `gate-interim` Vitest matrix and `gate-pill` Playwright spec. Matrix rows: critical open -> unresolved `open`; critical accepted -> unresolved `unanswered` (Accept alone keeps Blocked); critical needs-counsel -> `awaiting_counsel`; critical dismissed with reason -> resolved; critical `dismissed_reconfirm` -> `reconfirm_required`; **(D-2) critical `dismissed_reconfirm` + counsel answer A/B/C -> resolved (re-confirmation)**; same + answer `unclear` -> `unclear` unresolved; non-critical never blocks. `gate-pill` e2e: Accept keeps `gate-button` "Blocked · N"; Dismiss with reason lowers N; reconfirm item stays counted; seeded counsel answer (seedMemory) on a reconfirm item lowers N; popover `gate-reason` items jump to the finding.
- [ ] D1b. `engine-worker-split` e2e: `page.on('worker')` fires on sample open; main-thread long-task budget (PerformanceObserver `longtask`, budget stated in the spec) while parsing sample #2.
- [ ] D1c. `layout-vs-mockup` e2e (computed styles and bounding boxes), every expected value derived at test time from the app.html CSS via `test/support/mockupCss.ts` (reference values today, update from app.html if it changes, never loosen the assertion): at 1440 sidebar 232 px and findings column 400 px; at 1200 sidebar still expanded (232 px) unless collapse is persisted; at 1199 sidebar forced to the 56 px rail with `sidebar-toggle` hidden; at 1024 rail 56 px and findings column 380 px (app.html `@media (max-width:1279px)`), no horizontal overflow; no `[role=tablist]` anywhere and the nav is a vertical `nav[aria-label=Main]` with groups Review/Check/Firm; gate button, AI switch and analyst name are pinned at the sidebar bottom; of shell state only collapse persists across reload (route, selection, expanded row, popovers reset); box-shadow only on `role=dialog` popovers and the dismiss modal; no gradients; allowed font-size and radius sets derived from the app.html CSS, then every computed value in the app (screens: Findings, a placeholder route, status popover, filter menu, dismiss modal) must be in the set (radius 0 and per-corner values allowed; elements with no rendered text ignored for font size). Reference values the derivation must yield today: font sizes 13/14/15/16/17/20/28 px; radius 4px (`--r`) with named exceptions 3px (segmented buttons, tags, kbd, mask, reveal button), 2px (focus ring, mark, checkbox), 999px (count badges, avatar). If the derived set and these reference values differ, the spec fails and the plan is updated, not the assertion.
- [ ] D1d. `previously-handled-section` seeding: Playwright fixture `seedMemory.ts` seeds stub memory with fingerprints from core `fingerprintFor` OR the real flow (dismiss #3 in fund A / partners-group, then open #5 fund B same firm). Assert `previously-handled-count`, reason/who/fund/when, Reopen revokes (stored) and the item returns to New; include a critical-dismissed case that stays in the main list labelled "Dismissed in [fund], re-confirm"; plus a no-firm case: `memory-not-applied` shown, no lookup call.
- [ ] D1e. `privacy-notice.spec.ts` also asserts the AI switch state persists across reload (AC38), the notice states 24 hours, and `ai-allowance` reads "3 of 3 fresh-AI documents left today" and is unchanged after opening a cached sample (D-4; effect of the toggle is P05). `retention-purge` (Vitest, fake clock): upload at 23h59 kept, at 24h purged; value read from `limits.ts`; a stored decision created with core `fingerprintFor` survives the purge.
- [ ] D1f. `app-shell` e2e: groups and labels (sentence case), nav click switches view and `aria-current`, collapse to rail and persistence across reload, **the app always lands on Findings on load (user decision 17-10-26): set the route to each placeholder route, reload, assert `nav-findings` has `aria-current=page` and `findings-header` is visible; the route is never persisted**, auto-rail at 1199, Findings badge counts open only (changes after Accept), bottom-pinned items, doc switcher menu. `placeholder-routes` e2e: each of the 5 routes renders `placeholder-view` with its `data-route` and the "coming in a later build" text.
- [ ] D2. `hostile-html.spec.ts`: upload an HTML with `<script>`, `onerror`, `<iframe>`, external `<img>`; assert no script ran (sentinel), no request to a non-local host (route interception), content shown as text.
- [ ] D3. `a11y-smoke.spec.ts`: axe on Findings (sidebar expanded), Findings (sidebar collapsed rail), a placeholder route, and with these open: status popover, filter menu, jump menu, gate popover, dismiss modal (focus trap: 12 Tab presses stay inside, Esc closes and returns focus, rest of app inert), Previously handled expanded, Open a document dialog. Gate = zero critical violations (AC30 interim); serious color-contrast findings are listed in the report, not gate-fail (full sign-off Phase 10).

### Step E — Visual check vs app.html
- [ ] E1. Screenshot review at 1440, 1024 and 1199 (auto-collapse) widths; compare layout, tokens, type scale, spacing against `app.html`; apply `design-taste-frontend` `references/tells.md`/`critique.md` as a checklist only; record deviations and reasons in the report (agent-probe). Playwright saves screenshots of the app.html file and the app at 1440, 1024 and 1199 into this task folder (`design-probe/`; external Google Fonts blocked for parity, rubric judges type scale not glyph shapes; content differs because app.html is demo data), with a pass/fail rubric (sidebar 232/56, rail at 1199, findings column 400/380, no tab bar, tone steps, type scale and radius judged against the app.html-derived sets from D1c incl. the named exceptions, shadow only on popovers/modal, single accent); a read-only second subagent runs the rubric. The Open a document dialog is excluded from the rubric. Other mockups (compare, counsel-sheet, firm-memory, start, structure) are NOT approved: do not build from them.
- [ ] E2. Raise selects and the dismiss note to 16 px where app.html does (modal textarea 16 px); keep the Detector select styled like the other Filter selects.
- [ ] E3. UPDATE PROCESS action: record approved tokens, the shell contract and the published `data-testid` list in `process/context/ui/all-ui.md` (Artifacts section) at closeout.

## Test Gates (commands created in this phase)

No `--` in any command; one token per call; a token that matches no file fails.

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| unit | `pnpm --filter @aduin/web test` | Fully-Automated | stub API semantics, retention purge, severity mapping |
| app shell | `pnpm --filter @aduin/web test:e2e app-shell` | Fully-Automated | shell contract (AC30 support) |
| placeholders | `pnpm --filter @aduin/web test:e2e placeholder-routes` | Fully-Automated | routed placeholders (AC17 view NOT here) |
| sample picker | `pnpm --filter @aduin/web test:e2e sample-picker-smoke` | Fully-Automated | AC2 |
| stages | `pnpm --filter @aduin/web test:e2e status-stages` | Fully-Automated | AC3 |
| highlight | `pnpm --filter @aduin/web test:e2e finding-highlight` | Fully-Automated | AC4 (real engine output, samples #1, #3, #11) |
| filter | `pnpm --filter @aduin/web test:e2e filter-sort` | Fully-Automated | AC5 |
| triage | `pnpm --filter @aduin/web test:e2e triage-actions` | Fully-Automated | AC6 (partial), AC10 (reveal control) |
| dismiss | `pnpm --filter @aduin/web test:e2e dismiss-requires-reason` | Fully-Automated | AC6 (reason required, modal trap) |
| stub api | `pnpm --filter @aduin/web test stub-memory-api` | Fully-Automated | AC6 stub semantics, fingerprint flow |
| upload limits | `pnpm --filter @aduin/web test:e2e upload-limits` | Fully-Automated | AC37 |
| privacy | `pnpm --filter @aduin/web test:e2e privacy-notice` | Fully-Automated | AC38 |
| retention | `pnpm --filter @aduin/web test retention-purge` | Fully-Automated | AC38 (24 h, D-4) |
| firm tagging | `pnpm --filter @aduin/web test:e2e upload-firm-tagging` | Fully-Automated | AC41 |
| previously handled | `pnpm --filter @aduin/web test:e2e previously-handled-section` | Fully-Automated | AC49 |
| hostile html | `pnpm --filter @aduin/web test:e2e hostile-html` | Fully-Automated | AC39 (client part) |
| gate interim | `pnpm --filter @aduin/web test gate-interim` | Fully-Automated | gate rule incl. D-2 (user-confirmed; AC22 owned by P08) |
| gate pill | `pnpm --filter @aduin/web test:e2e gate-pill` | Fully-Automated | gate rule (UI) |
| worker split | `pnpm --filter @aduin/web test:e2e engine-worker-split` | Fully-Automated | parsing off main thread |
| import graph | `pnpm --filter @aduin/web test import-graph` | Fully-Automated | parsing off main thread; main-thread import allow-list incl. `fingerprintFor` |
| label enum | `pnpm --filter @aduin/web test memory-label-enum` | Fully-Automated | memory label values equal DATA-MODEL CHECK list |
| E2E hook absent in prod | `pnpm --filter @aduin/web test no-e2e-hook-in-dist` | Fully-Automated | stage-failure hook not shipped |
| tokens | `pnpm --filter @aduin/web test tokens-match-mockup` | Fully-Automated | mockup fidelity (app.html :root) |
| severity label | `pnpm --filter @aduin/web test severity-label` | Fully-Automated | severity mapping vs app.html SEV |
| source guard | `pnpm --filter @aduin/web test source-guard` | Fully-Automated | no hex colors / default shadcn classes |
| layout vs mockup | `pnpm --filter @aduin/web test:e2e layout-vs-mockup` | Fully-Automated | mockup fidelity (layout, app.html-derived) |
| a11y smoke | `pnpm --filter @aduin/web test:a11y` | Hybrid (zero critical axe violations; precondition: preview build, handled by `pretest:a11y` + webServer build; manual keyboard pass in P10) | AC30 (interim) |
| visual vs mockup | screenshots of app.html and the app at 1440, 1024 and 1199 + rubric, run by a read-only second subagent | Agent-Probe | mockup fidelity (visual) |
| regression | `pnpm --filter @aduin/core test:golden && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | Phase 01/00 intact |

Gate loop form (one token per call; any non-zero stops):

```bash
for t in app-shell placeholder-routes sample-picker-smoke status-stages finding-highlight filter-sort triage-actions dismiss-requires-reason upload-limits privacy-notice upload-firm-tagging previously-handled-section hostile-html gate-pill engine-worker-split layout-vs-mockup; do pnpm --filter @aduin/web test:e2e $t || exit 1; done
for t in stub-memory-api retention-purge gate-interim import-graph memory-label-enum no-e2e-hook-in-dist tokens-match-mockup severity-label source-guard; do pnpm --filter @aduin/web test $t || exit 1; done
```

Failing stubs for red-first: `should refuse to dismiss without a reason and show the message`, `should keep filter state after reload`, `should highlight the quote of the selected finding`, `should render hostile html as inert text`, `should keep the gate Blocked after Accept on a critical finding`, `should treat a counsel answer on a reconfirm item as resolved`, `should run document parsing in a dedicated worker`, `should not ship the E2E failure hook in the production build`, `should force the icon rail below 1200px`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `sample-picker-smoke` | Fully-Automated | AC2 |
| `app-shell`, `placeholder-routes` | Fully-Automated | shell contract (supports AC30; AC17 view is NOT proven here) |
| `gate-interim` (Vitest, incl. D-2 row), `gate-pill` | Fully-Automated | gate rule (user-confirmed; AC22 owned by P08) |
| `engine-worker-split`, `import-graph` | Fully-Automated | parsing off main thread |
| `layout-vs-mockup`, `tokens-match-mockup`, `source-guard`, `severity-label` | Fully-Automated | mockup fidelity (app.html) |
| `memory-label-enum` | Fully-Automated | memory label values equal DATA-MODEL (supports AC43/AC49) |
| `no-e2e-hook-in-dist` | Fully-Automated | stage-failure hook absent in production |
| `status-stages` | Fully-Automated | AC3 |
| `finding-highlight` | Fully-Automated | AC4 |
| `filter-sort` | Fully-Automated | AC5 |
| `triage-actions`, `dismiss-requires-reason`, `stub-memory-api` | Fully-Automated | AC6 (partial: answered P08, edit deferred B-EDIT), AC10 (reveal control) |
| `upload-limits` | Fully-Automated | AC37 |
| `privacy-notice` (notice shown, 24 h, allowance, AI switch persists), `retention-purge` | Fully-Automated | AC38 |
| `upload-firm-tagging` | Fully-Automated | AC41 |
| `previously-handled-section` | Fully-Automated | AC49 |
| `hostile-html` | Fully-Automated | AC39 (client part) |
| `a11y-smoke` | Hybrid (preview build precondition; manual keyboard pass in P10) | AC30 (interim) |
| Visual check vs app.html at 1440, 1024, 1199 (rubric, read-only second subagent) | Agent-Probe | none directly (supports AC30 and UI quality); residual: no pixel-diff oracle |
| AC6 "edit text/severity" clause | named residual (not a strategy): backlog stub B-EDIT; gate stays CONDITIONAL | AC6 (edit clause) |

Alias note: SPEC/umbrella tokens carry an `-e2e` suffix or longer names (`finding-highlight-e2e` = `finding-highlight.spec.ts`, `upload-limits-e2e` = `upload-limits.spec.ts`, `status-stages-and-partial-failure` = `status-stages.spec.ts`, `privacy-notice-and-ai-toggle-e2e` = `privacy-notice.spec.ts`); P03 file names are the bare gate tokens. `structure-view` is no longer a P03 token (moved to a later UI phase).

```bash
pnpm --filter @aduin/web test && pnpm --filter @aduin/web test:e2e && pnpm --filter @aduin/web test:a11y
# Expected: all exit 0 (aggregate form; per-gate evidence uses the one-token loops above)
```

## Exit Gate

- All gates green; screenshots recorded in the report; `tokens-match-mockup` green (app.html `:root`).
- Real findings visible (proven by `finding-highlight` on real engine output): opening sample #1 shows the "this Section 11" finding highlighted in the document (M1 check completes with Phase 04a's `pnpm slice:check`, whose `slice.spec.ts` uses the published `data-testid`s).
- Placeholder routes verified; AC17 view explicitly recorded as not met here (placeholder now, real view later).
- Phase report written.

## Risks and Kill Criteria

- Radix restyle drift from tokens: guarded by `tokens-match-mockup` and the visual probe.
- Document pane performance on the 380 KB sample (S7): virtualize the pane if render > 1 s (fallback: windowed blocks).
- Stub vs real API semantic gap: closed in Phase 08; stub tests mirror Worker rules.
- app.html deviations (surfaced, not silent): Detector filter (AC5), Open a document dialog (no approved Documents/start view), no Structure badge, SPEC-driven persistence of filters and AI switch, serif headings per CSS. User-confirmed 17-10-26 (all 4 decided, not open): persistence per AC5/AC38 with route never persisted; Detector inside the single Filter menu; the minimal open-document dialog from the doc switcher is the interim solution (a Documents view and Upload modal in app.html replace it in a later phase); serif headings follow the app.html CSS. B-EDIT stays in backlog.
- P01 `MemoryLabel` wording (`dismissed`/`answered`) vs DATA-MODEL CHECK: `memory-label-enum` fails until P01 aligns; route to the P01 owner.
- Kill: if highlight-by-anchor is unreliable across table-merged lines, fall back to block-level highlight (documented).

## Cost / Secret Hygiene

No LLM/OCR/Cloudflare calls in this phase. No keys in the web bundle (Turnstile site key is public and added in P04a/P05). Samples are public SEC files.

## Rollback

`git revert` the phase commits; `apps/web` is isolated and the Worker/core are unaffected.

## Blockers That Would Justify BLOCKED Status

- app.html interactions cannot be reproduced with the pinned stack (route to user with specifics).
- Engine worker cannot run in the browser build (core pulls Node-only code) → fix in core via contract note.

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S4, S6 (untrusted-input rendering), S7 (30+ files) → 3/7 MEDIUM. Recommended: sequential single agent (shared component tree); optional second read-only subagent for the visual probe. Sonnet for research/validation, opus for code execution.

## Test Infra Improvement Notes

(none identified yet) — candidates: a reusable Playwright fixture that seeds Dexie and fake time; `test/support/mockupCss.ts` could be shared by later UI phases (compare, counsel, memory) to derive tokens and widths from their approved app.html views.

## Supplement Cycle 3 Change List (17-10-26)

1. RE-TARGET to app.html: every `review-workspace.html` layout reference replaced (UI contract, touchpoints, layout spec, tokens test, probe, a11y states); review-workspace is a historical token source only. Scope is shell + Findings; five routes are placeholders; AC ownership re-stated (AC17 view and AC61 host moved out; AC6 partial; AC5 additive Detector filter).
2. G4: no `--` in any gate command; one token per call; an unmatched token fails (D0); `pretest:a11y` hook plus a `build:e2e` webServer so samples exist on a clean checkout.
3. G5: single fingerprint flow (engine: `quote_hash` only; main thread `fingerprintFor` then lookup; `firmId=null` -> "memory not applied"); `firmId` removed from worker settings; `fingerprintFor` added to the B1a allow-list and used in `stub-memory-api`, `previously-handled-section` (seedMemory) and `retention-purge`; memory labels equal DATA-MODEL CHECK values (`memory-label-enum`).
4. User-decided defaults: D-4 (24 h upload retention test; 3 fresh-AI docs/day allowance, cached sample free), D-2 (gate-interim counsel-answer-on-reconfirm row), D-7 (12 HTML 01-08 and 10-13 + 22-page scan set #9).

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-03-web-shell_PLAN_17-10-26.md`
- Last completed step: not started (plan re-targeted to app.html; supplement cycle 3 applied; PVL PASS 17-10-26)
- Validate-contract status: PASS for the app.html target (outer PVL re-run 17-10-26 after supplement cycle 3; contract below). G4 and G5 are addressed in plan text.
- Orchestrator actions flagged: (a) umbrella AC17 row and M1 AC list (P03 no longer closes AC17 view); (b) P02 `investor-path-view` e2e has no host until the later Structure UI phase; (c) P01 `MemoryLabel` enum wording vs DATA-MODEL; (d) file backlog stub B-EDIT; (e) the four design choices (persistence, Detector filter, Open a document dialog, serif headings) are user-confirmed 17-10-26; nothing further to relay.
- Next Step: after Phase 01 is verified, spawn vc-research-agent (read the Phase 01 report, app.html, app_NOTES.md, all-ui.md). Next phase: Phase 04a authors `slice.spec.ts` from the published `data-testid`s to complete Milestone 1.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: outer-pvl
supersedes: 2026-10-17 (outer-pvl) — re-run from V1 after supplement cycle 3 (re-target to approved `design/mockups/app.html`, G4, G5, D-2/D-4/D-7); this contract has current evidence

Parallel strategy: sequential
Rationale: 3/7 signals (S4 phase program, S6 untrusted-document rendering trust boundary, S7 30+ files) = MEDIUM; shared component tree and a single editing agent, so execute sequentially; optional read-only second subagent only for the visual probe. The validate fan-out was run inline by the single validate agent (no sub-agent spawn tool); no cross-agent contradictions to rank.

Re-validation evidence (V1-V3, 17-10-26):
- Structural validator `validate-plan-artifact.mjs`: 0 failures, 0 warnings. File paths resolve (app.html, app_NOTES.md, samples 01-08 and 10-13 plus `09-rw-holdings-scans`, DATA-MODEL, registry, umbrella).
- Fidelity to app.html (read in full, CSS parsed by script): font sizes in the CSS are exactly 13/14/15/16/17/20/28 px; radii are `var(--r)` 4px, 3px, 2px, 999px and the per-corner `var(--r) 0 0 var(--r)` on the selected-row bar; box-shadow occurs only on `.pop` and `.modal`; no gradients; sidebar 232/56 px; findings column 400 px, 380 px under `@media (max-width:1279px)`; auto-rail `matchMedia('(max-width:1199px)')`; `.app{min-width:960px}`; SEV labels and the 4 REASONS strings match the plan's mapping; only `ui:v1:sidebar`-style collapse is stored in the mockup. The plan derives every size/radius/width at test time (`test/support/mockupCss.ts`) with reference values equal to what the file yields today.
- Shell scope only: placeholder routes for Counsel, Structure (incl. Investor types), Compare, Firm memory, Documents; other mockups explicitly not built from; AC17 view, AC61 host and AC6 edit clause are recorded as moved (B-EDIT backlog stub, user-confirmed 17-10-26).
- G4/G5 fixed in text: no `--` in any gate; one token per call; `pretest:a11y` plus `build:e2e` webServer; `fingerprintFor` flow with `quote_hash` only from the engine and `firmId=null` -> "memory not applied"; consistent with Phase 01 Contracts v1 (`Finding.fingerprint` optional, `fingerprintFor(finding, firmId|null)`, `resolveLabel`, E5 MemoryLabel alignment).
- D-2 (gate-interim reconfirm + counsel answer A/B/C resolves, `unclear` does not), D-4 (24 h uploads, 3 fresh-AI docs/day, cached sample free, memory untouched by purge), D-7 (12 HTML + scan set row disabled), D-8 (axe dev-only test dependency) are present and tested.
- User-confirmed design choices 17-10-26 ("Đồng ý cả 4 lựa chọn của plan, B-EDIT cứ để backlog"): filters and AI mode persist (AC5/AC38) while the route never persists (always lands on Findings: asserted in `app-shell`, D1f, and in the `layout-vs-mockup` reload check); Detector inside the single Filter menu; minimal Open a document dialog from the doc switcher is the interim solution (Documents view and Upload modal in app.html replace it later); serif headings follow the app.html CSS.
- Phase 04a consumption: 04a E2 uses only the published `data-testid`s; P03 `test:e2e` runs `--project=preview` so 04a's `stack`-project `slice.spec.ts` stays out of P03's gates; 04a's deferred regression `pnpm --filter @aduin/web test:e2e` equals the P03 aggregate. No regression found: no core/worker edits, disjoint blast radius, registry note present.
- Reality check against the committed Phase 00 scaffold (7d9955b; `pnpm -s typecheck` green): scripts, configs and gaps listed under E4-E10 below are execute instructions, none is a plan gap.

Test gates (C3 5-column table; commands in the no-`--` form; one token per call):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC2 | every HTML sample (12: 01-08, 10-13) opens in one click via the Open a document dialog, pre-tagged firm/fund/version (#3-#6 one firm); #9 scan set row disabled | Fully-Automated | `pnpm --filter @aduin/web test:e2e sample-picker-smoke` | B |
| AC3 | named stages; injected stage failure gives partial result naming the stage; AI shows pending | Fully-Automated | `pnpm --filter @aduin/web test:e2e status-stages` (hook compiled only in `--mode e2e`) | B |
| AC4 / M1 | selecting a finding scrolls to and highlights its quote on REAL engine output (#1 "this Section 11", #3 swapped refs, #11 undefined "Units") | Fully-Automated | `pnpm --filter @aduin/web test:e2e finding-highlight` | B |
| AC5 | filter/sort by severity chips, class, detector, status in the single Filter menu; counts match; filters survive reload | Fully-Automated | `pnpm --filter @aduin/web test:e2e filter-sort` | B |
| AC6 (partial) | accept / dismiss (reason required, modal focus trap) / needs-counsel persist and undo | Fully-Automated | `pnpm --filter @aduin/web test:e2e triage-actions`, `pnpm --filter @aduin/web test:e2e dismiss-requires-reason`, `pnpm --filter @aduin/web test stub-memory-api` | B (edit text/severity clause: D, B-EDIT; "answered": C, P08) |
| AC10 (control) | masked value in row and document; Reveal/Hide toggle | Fully-Automated | `pnpm --filter @aduin/web test:e2e triage-actions` (seeded-finding extra) | B |
| gate rule (AC22 owned by P08) | Accept keeps gate Blocked; dismiss with reason resolves; reconfirm stays unresolved; D-2 counsel answer resolves; popover reasons jump to the finding | Fully-Automated | `pnpm --filter @aduin/web test gate-interim`, `pnpm --filter @aduin/web test:e2e gate-pill` | B |
| shell contract (AC30 support) | 232/56 px sidebar, auto-rail at 1199, groups and nav, badges (open only), bottom-pinned gate/AI/analyst, collapse persists, route does not persist (always lands on Findings) | Fully-Automated | `pnpm --filter @aduin/web test:e2e app-shell` | B |
| placeholder routes (AC17 view NOT here) | five routes render `placeholder-view` with `data-route` | Fully-Automated | `pnpm --filter @aduin/web test:e2e placeholder-routes` | B (real views: C, later UI phases) |
| AC37 | upload limits stated and enforced (10 MB, types, empty) before any AI call; pdf/docx/images show "supported in a later build" | Fully-Automated | `pnpm --filter @aduin/web test:e2e upload-limits` | B (page-count rows: C, P06) |
| AC38 | privacy notice before first upload and AI use; states 24 hours; AI switch persists; allowance "3 of 3" unchanged by cached sample; 24 h purge keeps memory | Fully-Automated | `pnpm --filter @aduin/web test:e2e privacy-notice`, `pnpm --filter @aduin/web test retention-purge` | B |
| AC41 | firm picker alias-resolving, free text rejected, "Other / no firm" -> memory not applied | Fully-Automated | `pnpm --filter @aduin/web test:e2e upload-firm-tagging` | B |
| AC49 | Previously handled (n) complete, collapsible, reason/who/fund/when, Reopen revokes; critical-dismissed stays in main list | Fully-Automated | `pnpm --filter @aduin/web test:e2e previously-handled-section` | B |
| AC39 (client) | hostile HTML rendered as inert text; no script; no non-local request | Fully-Automated | `pnpm --filter @aduin/web test:e2e hostile-html` | B |
| mockup fidelity (tokens, guards, mapping) | app.html `:root` equals `tokens.css`; no hex colors / default shadcn classes; severity labels equal app.html `SEV`; memory labels equal DATA-MODEL CHECK | Fully-Automated | `pnpm --filter @aduin/web test tokens-match-mockup`, `... test source-guard`, `... test severity-label`, `... test memory-label-enum` | B |
| mockup fidelity (layout) | widths, breakpoints, no tab bar, shadows only on popovers/modal, font and radius sets derived from app.html | Fully-Automated | `pnpm --filter @aduin/web test:e2e layout-vs-mockup` | B |
| parsing off main thread | worker created; only `engine.worker.ts` imports parse internals | Fully-Automated | `pnpm --filter @aduin/web test:e2e engine-worker-split`, `pnpm --filter @aduin/web test import-graph` | B |
| E2E hook absent in prod | hook marker absent from production `dist/` | Fully-Automated | `pnpm --filter @aduin/web test no-e2e-hook-in-dist` | B |
| gate wiring | unmatched token fails; single-token selection works; a11y script works on a clean checkout | Fully-Automated | D0 commands recorded in the report | B |
| AC30 (interim) | axe zero critical violations on shell, Findings (expanded and rail), placeholder, and open overlays | Hybrid | `pnpm --filter @aduin/web test:a11y` (precondition: preview build with samples; manual keyboard pass in P10) | C (full sign-off P10) |
| visual vs app.html | layout, type scale, spacing, tone steps at 1440, 1024, 1199 | Agent-Probe | Playwright screenshots of app.html and the app into `design-probe/`, rubric run by a read-only second subagent | D |
| regression | Phase 01 goldens and Phase 00 guards intact | Fully-Automated | `pnpm --filter @aduin/core test:golden && pnpm guard:cf && pnpm secrets:scan` | A |

gap-resolution legend: A proven now; B fixed in this plan's checklist; C deferred to a named later phase/plan; D backlog test-building stub (named residual).
Known-Gap is never a strategy value. Net-gate vacuous-green scan: every developed behavior has a Fully-Automated, Hybrid or Agent-Probe gate; the only named residuals are the AC6 "edit text/severity" clause (not developed; B-EDIT backlog, user-confirmed) and the placeholder views (not developed; later UI phases). Clear.

Failing stubs (Fully-Automated rows; red-first starting points):
- AC4 / M1: test("should highlight the quote of the selected finding", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should highlight the quote of the selected finding") })
- AC5: test("should keep filter state after reload", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should keep filter state after reload") })
- AC6: test("should refuse to dismiss without a reason and show the message", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should refuse to dismiss without a reason and show the message") })
- gate rule: test("should keep the gate Blocked after Accept on a critical finding", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should keep the gate Blocked after Accept on a critical finding") })
- gate rule D-2: test("should treat a counsel answer on a reconfirm item as resolved", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should treat a counsel answer on a reconfirm item as resolved") })
- shell: test("should force the icon rail below 1200px", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should force the icon rail below 1200px") })
- shell: test("should land on Findings after reload regardless of the last route", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should land on Findings after reload regardless of the last route") })
- AC49: test("should keep a critical dismissed item in the main list labelled re-confirm and count it as unresolved", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should keep a critical dismissed item in the main list labelled re-confirm and count it as unresolved") })
- AC39 (client): test("should render hostile html as inert text", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should render hostile html as inert text") })
- Web Worker split: test("should run document parsing in a dedicated worker", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should run document parsing in a dedicated worker") })
- E2E hook absent in prod: test("should not ship the E2E failure hook in the production build", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should not ship the E2E failure hook in the production build") })
- tokens: test("should match every app.html :root custom property in tokens.css", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should match every app.html :root custom property in tokens.css") })
- layout: test("should size the sidebar 232px and the findings column 400px at 1440 and use the 56px rail at 1199", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should size the sidebar 232px and the findings column 400px at 1440 and use the 56px rail at 1199") })

Execute-agent instructions (advisory; none is a plan gap; all probed against the committed Phase 00 scaffold 7d9955b):
- E1. `base.css` carries the app.html resets `button,select,textarea{font:inherit;color:inherit}` plus `input{font:inherit}` (UA default 13.333px would fail the derived font-size set).
- E2. In `layout-vs-mockup` treat radius `0` and per-corner values as allowed and ignore elements with no rendered text for the font-size check; derive widths and breakpoints from app.html (never hard-code; reference values 232/56/400/380, 1199/1279).
- E3. Map the 4 app.html REASONS strings to the DATA-MODEL `reason_code` values `firm_standard_wording`, `no_form_impact`, `tool_false_alarm`, `other` in one module; the stub validates against that list.
- E4. Scaffold `apps/web/vite.config.ts` has `test.include: ['src/**/*.test.{ts,tsx}']` and `environment: 'jsdom'`; B5 moves Vitest tests to `test/**/*.test.ts`. Set `include` to both `test/**/*.test.ts` and `src/**/*.test.{ts,tsx}` (or move the scaffold smoke test), keep NO `passWithNoTests`, and add `// @vitest-environment node` to the Node-only tests (`no-e2e-hook-in-dist`, `import-graph`, `tokens-match-mockup`). Add `test` to `apps/web/tsconfig.json` `include` so `pnpm typecheck` covers it.
- E5. The scaffold `src/smoke.test.tsx` asserts the placeholder page and an EMPTY `features` registry; P03 replaces `main.tsx` and registers findings plus placeholders, so update or replace that smoke test in the same commit (extending `FeatureModule` with a route component is within P03 ownership of the seam; later phases still only append one line).
- E6. Scaffold `playwright.config.ts` has ONE `stack` project and ONE global `webServer` (`pnpm dev:stack`, cwd `../..`, baseURL 127.0.0.1:8787). B5 needs two projects: make `webServer` an array and give each project its own `baseURL` (preview: `vite preview` port, cwd `apps/web`, command `pnpm build:e2e && pnpm exec vite preview --port <fixed> --strictPort`; stack: unchanged, 04a's). Replace the scaffold `test:e2e` (`playwright test`) with `playwright test --project=preview` and the scaffold `test:a11y` (`--grep @a11y --pass-with-no-tests`) with `playwright test --project=preview a11y-smoke` (no pass-with-no-tests; the token must match a file). Keep `testIgnore: /slice\.spec\.ts/` on `preview`. Playwright 1.64.1 needs chromium-1248, which is installed.
- E7. New dependencies in `apps/web/package.json` (the only manifest P03 edits; pin exactly like the scaffold, confirm versions via vc-docs-seeker and `minimumReleaseAge`): Radix primitives actually used (dialog, popover, select, collapsible/toggle; scaffold has only `react-slot`), `@axe-core/playwright` (dev-only, D-8), `fake-indexeddb` (dev-only; needed so Vitest `stub-memory-api` and `retention-purge` can run Dexie in jsdom/node), Geist and Newsreader self-hosted font files (OFL; add to THIRD_PARTY_NOTICES via the serialized seam). `tsx` already resolves from `apps/web` (probed `pnpm exec tsx` v4.23.15), so the `tsx ../../scripts/src/build-samples.ts` hooks work; D0 re-proves it on a clean checkout.
- E8. `fixtures/memory/law-firms.json` does not exist yet (`fixtures/memory/` is empty); Phase 01 C3 creates it and Phase 01 is the Entry Gate. `build-samples.ts` must fail loudly if it is missing rather than emit an empty `firms.json`.
- E9. `.gitignore` currently ignores `samples/sub-docs/raw/14-ilpa-*` and `_full-prospectus/`; add `apps/web/public/samples/` and `apps/web/public/firms.json` via the serialized seam edit; never copy #14 into `public/`.
- E10. The route never persists: `shell.ts` must not write the route anywhere; `app-shell` asserts landing on Findings after reload from each placeholder route (D1f). Only `ui:v1:sidebar`, `ui:v1:filters`, `ui:v1:ai` persist.
- E11. If the 1200 px boundary is ambiguous in a test, use 1199 (rail) and 1200 (expanded) exactly as app.html's `max-width:1199px` media query.

Legacy line form:
- apps/web unit: [Fully-automated: pnpm --filter @aduin/web test]
- apps/web e2e: [Fully-automated: pnpm --filter @aduin/web test:e2e]
- apps/web a11y: [hybrid: pnpm --filter @aduin/web test:a11y + precondition preview build and generated samples + manual keyboard pass in P10]
- visual vs app.html: [agent-probe: screenshots at 1440, 1024 and 1199 against design/mockups/app.html, rubric by read-only second subagent]
- regression: [Fully-automated: pnpm --filter @aduin/core test:golden && pnpm guard:cf && pnpm secrets:scan]

Dimension findings:
- Infra fit: PASS — web-only blast radius; two Playwright projects and one samples mechanism are stated; scaffold gaps (vitest include/environment, single-project Playwright config, scaffold scripts, new deps, tsconfig include, missing `law-firms.json` until P01) are all recorded as execute instructions E4-E8 and are mechanically feasible (typecheck green, tsx and chromium-1248 present).
- Test coverage: PASS — every developed behavior has a named automated gate with file-name token and no `--`; a11y is Hybrid with a stated precondition; visual is Agent-Probe; residuals (AC6 edit, AC30 full sign-off) are named with gap-resolution D/C.
- Breaking changes: PASS — fingerprint flow, MemoryLabel values and published `data-testid`s align with Phase 01 Contracts v1, DATA-MODEL and Phase 04a; AC17/AC61/AC6 ownership moves are recorded in the registry and flagged to the orchestrator.
- Security surface: PASS — text-node rendering, no innerHTML, no keys in the bundle, hostile-HTML gate with sentinel and route interception, E2E hook excluded from production and proven by `no-e2e-hook-in-dist`; axe is a dev-only dependency (D-8); no auth/billing surface.
- Section A (mockup contract and tokens): PASS — derived font/radius/width sets verified against the real app.html CSS; source guard and tokens test present.
- Section B (engine bridge and storage): PASS — single fingerprint flow, D-4 retention, allowance stub, scripts and samples mechanism defined (see E4-E9).
- Section C (screens): PASS — shell, Findings, Dismiss modal, Previously handled, placeholders, reveal, keyboard; scope fence holds.
- Section D (tests): PASS — specs and tests named by token; D0 wiring check; route-lands-on-Findings assertion added to D1f.
- Section E (visual check vs app.html): PASS — screenshots at 1440/1024/1199 with a rubric derived from app.html; residual: no pixel-diff oracle.

Open gaps: none blocking. Named residuals: AC6 "edit text/severity" clause - known-gap: documented as NEW PLAN REQUIRED - backlog stub B-EDIT (user-confirmed 17-10-26; to be filed by UPDATE-PROCESS); Documents view and Upload modal replace the interim Open a document dialog in a later UI phase after app.html draws them.

What This Coverage Does NOT Prove:
- sample-picker-smoke: does not prove scan/PDF/DOCX samples (activate in P06) or real-user click latency.
- status-stages: does not prove the AI stage with real AI (P05) or timing on slow devices; failure is injected by an E2E-only hook, not a real engine crash.
- finding-highlight / filter-sort / triage-actions: do not prove behavior against the real Worker memory API (P04b/P08), multi-tab concurrency, or highlight across table-merged lines beyond the sample set (kill-criterion fallback: block-level).
- gate-interim / gate-pill: do not prove core `computeGate` parity (P08 gate-state-matrix) or answered/unclear states beyond stub data.
- upload-limits / privacy-notice / retention-purge: do not prove server-side purge (P04b), page-count limit on real scans (P06), or the AI toggle effect and real quota (P05).
- previously-handled-section: does not prove cross-session or cross-device memory (P08, real API) or cross-firm isolation.
- tokens-match-mockup / source-guard: prove token values and absence of hard-coded colors, not that components consume them.
- layout-vs-mockup: proves computed geometry and a bounded style vocabulary derived from app.html at the listed widths on Findings, a placeholder route and the listed overlays; not pixel parity, content, widths below 960 px, or the Open a document dialog (excluded).
- engine-worker-split / import-graph: prove a worker is created and imports are confined statically; not absence of every main-thread long task on slower hardware.
- no-e2e-hook-in-dist: proves a marker string is absent from `dist/`; not that no other test-only code ships.
- hostile-html: does not prove the same on PDF/DOCX/OCR paths (P06) or server-side abuse protection (04a).
- a11y-smoke: does not prove WCAG AA contrast on all states or the full keyboard flow (P10).
- visual probe: no pixel-diff oracle; judgment-based.
- placeholder-routes: proves only that placeholders render; the Structure, Counsel, Compare, Memory and Documents behaviors (incl. AC17 view, AC61) are not proven here.
- all gate commands: the no-`--` selection form was probed in a scratch workspace (cycle 2) and the scripts/config reality was checked against the Phase 00 scaffold by reading; the real `apps/web` P03 specs do not exist yet.

Gate: PASS (no FAILs, no unresolved CONCERNs; minor scaffold-reality items recorded as execute instructions E4-E11; user-confirmed design choices applied)
Accepted by: n/a (PASS); execute instructions E1-E11 and named residuals (B-EDIT, AC30 full sign-off in P10) acknowledged by session (autonomous, autopilot standing consent)
