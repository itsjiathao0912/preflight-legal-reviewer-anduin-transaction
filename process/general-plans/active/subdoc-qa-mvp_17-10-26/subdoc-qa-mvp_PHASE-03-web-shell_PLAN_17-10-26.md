---
name: plan:subdoc-qa-mvp-phase-03-web-shell
description: "Sub-doc QA MVP — Phase 03: web shell built to the approved review-workspace mockup, showing real findings from the core engine on bundled samples (vertical slice)"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-03
---

# Phase 03 — Web Shell (approved mockup, real findings)

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Milestone:** M1 vertical slice (00 → 01 → 03 → 04a)
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-03-web-shell_REPORT_17-10-26.md

---

## Overview

Builds `apps/web` to the **approved** mockup `design/mockups/review-workspace.html` (notes: `design/mockups/review-workspace_NOTES.md`; direction: `process/context/ui/all-ui.md`). The app loads a bundled sample, runs the Phase 01 engine in a Comlink Web Worker, and shows **real** findings in the mockup's layout: top bar, tabs, stage stepper, outline rail + reading page, 448 px findings panel (400 px at 1024), gate pill with popover, Previously handled section, dismiss-with-reason, undo toast, masked-value reveal. Memory is served by a **stub memory API** persisted in IndexedDB (Dexie) so labels, triage persistence and the Previously handled section work before the Worker exists. Context routers: `process/context/all-context.md`, `process/context/ui/all-ui.md`, `process/context/tests/all-tests.md`.

UI contract (every UI phase): use `minimalist-ui` for visual direction and `redesign-existing-projects` for audit passes on app screens; `design-taste-frontend` only for marketing surfaces (landing, slides), never app screens. Tokens come from the mockup `:root` (cool stone ground #E9ECE9, one teal accent #1D5C57, Newsreader + Geist, 4px base radius (`--r`) with the mockup's named exceptions (3px tags/segmented buttons, 2px focus ring/docid rule, 999px gate pill/count badge), UI-chrome type sizes 13/14/16/20/28 (the document pane and evidence quote also use 15/17 per the mockup), tone steps instead of borders, no shadows/gradients except the single gate-popover shadow). **shadcn/Radix reconciliation:** use Radix primitives (Dialog/Popover/Select/Toggle/Collapsible/Tabs) for accessibility behavior only; restyle every component from the mockup tokens, never ship default shadcn styling. Tailwind maps to the tokens via CSS variables (`@theme`), no hard-coded colors in components.

Other screens (structure, diff, counsel sheet, memory, outline) have no mockup: this phase builds only the **structure** view; each later UI phase starts with a mockup step reusing the same tokens and patterns.

## Phase Completion Rules

- CODE DONE = components and tests committed.
- VERIFIED = Exit Gate green incl. visual check vs mockup, validate-contract written, M1 slice check (together with Phase 04a) recorded, regression: Phase 01 goldens + Phase 00 guards green.
- User confirmed: mockup is approved (relayed by the UI session). Gate semantics confirmed: Accept on a blocking item keeps the gate Blocked until counsel answers.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC2 | Sample picker opens every HTML sample in one click, pre-tagged firm/fund/version (#3–#6 one firm) | `sample-picker-smoke` (loops all 12 `.htm` samples through the worker engine; the 22-page scan set row activates in P06) | Fully-Automated | closes P06 |
| AC3 | Named stages; stage failure → partial result naming the stage; AI shows "pending" | `status-stages` (E2E spec `e2e/status-stages.spec.ts`; injected stage failure via E2E-only build flag) | Fully-Automated | AI pending verified P05 |
| AC4 | Selecting a finding scrolls to and highlights its quote | `finding-highlight` (real engine output: sample #1 "this Section 11" mismatch, plus assertions for #3 swapped refs and #11 undefined "Units") | Fully-Automated | scan region highlight P06 |
| AC5 | Filter/sort by severity, class, detector, status; counts match; state survives reload | `filter-sort` | Fully-Automated | — |
| AC6 | Accept/dismiss/answered/edit/needs-counsel persist and are undoable; Dismiss refused without a reason from the fixed list | `triage-actions` + `dismiss-requires-reason` (against the stub memory API) | Fully-Automated | closes P08 (real API) |
| AC37 | Upload limits stated and enforced (10 MB, 30 pages per scan, accepted types) before any AI call | `upload-limits` (at limit, over limit, wrong type, empty; page-count rows activate in P06) | Fully-Automated | closes P06 |
| AC38 | Privacy notice before first upload and before AI use; AI off switch; stored uploads purged after retention | `privacy-notice` + Vitest `retention-purge` (IndexedDB TTL, fake clock) | Fully-Automated | server purge P04b; toggle effect P05 |
| AC41 | Upload links firm (alias list, no free text), fund name, version label; #3–#6 pre-tagged one firm | `upload-firm-tagging` | Fully-Automated | D1 list parity P04b |
| AC49 | "Previously handled (n)" is complete, collapsible, shows reason/who/fund/when; nothing is removed by showing it | `previously-handled-section` (seeded stub memory + real dismiss flow) | Fully-Automated | closes P08 |

Also built here, proven elsewhere: AC17 structure **view** (extraction owned by P01; this phase's `structure-view` is the closing check), AC10 reveal control component (owned by P02; this phase ships the control and a seeded-finding test).

Naming rule (decision, one choice): every e2e spec file is named after its gate token (`e2e/<token>.spec.ts`), and every gate command selects by that file name (`playwright test --project=preview <token>`, a file-name regex), never by test title. Gate-rule extras (not an AC; AC22 is owned by P08): `gate-interim` (Vitest) and `gate-pill` (Playwright).

Severity to mockup label mapping (state explicitly in code and tests): critical (= blocks digitization) -> "Blocks build"; high -> "Fix first"; medium and low -> "Note". Decisions recorded: label "Fix first" is kept (user-confirmed mockup wording); the outline rail with blocking counts is kept (mockup open question 3).

## Entry Gate

- Phase 01 exit gate passed (core engine, contracts frozen).
- Mockup file and notes exist (`design/mockups/`), `process/context/ui/all-ui.md` read.
- UI references: none provided; proceed with the mockup as the reference (do not introduce new references during EXECUTE).

## Library pins (confirm via vc-docs-seeker in Phase 00)

React, Vite, Tailwind, Radix primitives (via shadcn/ui source), Zustand, TanStack Table, Dexie, Comlink, Playwright, @axe-core/playwright, Newsreader + Geist (self-hosted font files; OFL).

## Touchpoints (create; web only)

```
apps/web/
  index.html, vite.config.ts (E2E flag define; no samples copy plugin), playwright.config.ts (from P00; two projects below)
  public/samples/*            generated by scripts/src/build-samples.ts from samples/sub-docs/raw (12 .htm) + manifest.json (firm/fund/version tags; #3–#6 partners-group)
  public/firms.json           generated from fixtures/memory/law-firms.json
  src/styles/{tokens.css,base.css}   tokens copied from the mockup :root (single source in the web app)
  src/main.tsx, App.tsx, state/{review,filters,session}.ts (Zustand), hash view-switch (no router dependency)
  src/engine/{engine.worker.ts,client.ts}    Comlink wrapper over @aduin/core (parse, run, structure). ONLY engine.worker.ts imports htmlparser2 / core parse, structure and detector internals; Phase 06 EXTENDS this directory (registry note). firmId is passed in worker settings; findings carry the engine-supplied Finding.fingerprint (P01)
  src/storage/db.ts (Dexie: documents, parsedModel cache, uiState, drafts, outbox)
  src/api/{memoryApi.ts (interface from core contracts), stubMemoryApi.ts (Dexie-backed), client.ts (fetch; real impl in P04b/P08)}
  src/components/ui/*         Radix-based primitives restyled from tokens
  src/features/home/          upload + sample picker + firm/fund/version form + limits + privacy notice + AI switch
  src/features/processing/    stage stepper (read, structure, checks, AI review, done) + allowance slot
  src/features/review/gateInterim.ts   pure function, reason kinds open|unanswered|unclear|awaiting_counsel|reconfirm_required; its type mirrors Phase 08 computeGate so P08 swaps the import for core
  src/features/review/        top bar, gate pill + popover, document pane (rendered from model text nodes, never raw HTML), findings panel (TanStack Table), filters, finding card, dismiss reason picker, undo toast, label chips, Previously handled, reveal control
  src/features/structure/     outline rail + structure tab (sections, refs resolved/unresolved/suspicious with expected vs found, conditionals, option groups, terms)
  src/features/registry.ts    (seam from P00: register home/review/structure)
  e2e/{sample-picker-smoke,status-stages,finding-highlight,filter-sort,triage-actions,dismiss-requires-reason,upload-limits,privacy-notice,upload-firm-tagging,previously-handled-section,structure-view,hostile-html,gate-pill,engine-worker-split,layout-vs-mockup,a11y-smoke}.spec.ts   (file name == gate token; `slice.spec.ts` is owned by Phase 04a, NOT created here)
  test/{tokens-match-mockup,gate-interim,import-graph,source-guard,stub-memory-api,retention-purge,severity-label,no-e2e-hook-in-dist}.test.ts   (Vitest; `severity-label` is the A5 severity-mapping test, `no-e2e-hook-in-dist` is B1b)
  e2e/fixtures/{seedMemory.ts}   Playwright fixture seeding the stub memory (Dexie)
  design-probe/  mockup-vs-app screenshots + rubric (saved in this task folder at closeout)
scripts/src/build-samples.ts
```

Manifest edits (seam edits, serialized by the orchestrator against Phase 04a): `apps/web/package.json` (only manifest P03 edits), `pnpm-lock.yaml`, `THIRD_PARTY_NOTICES.md`, `.gitignore` (adds `apps/web/public/samples/` and `apps/web/public/firms.json`).

```text
Playwright projects (apps/web/playwright.config.ts):
  preview  webServer: build with VITE_E2E=1 then `vite preview`; runs every P03 spec
  stack    webServer: `pnpm dev:stack`; runs only Phase 04a's slice spec (P03 does not own it)
Samples mechanism (ONE): `prebuild` / `predev` / `pretest:e2e` npm scripts call scripts/src/build-samples.ts; output apps/web/public/samples/* is gitignored; e2e and Vite build depend on that step (no separate Vite copy plugin).
```

## Public Contracts

- Consumes `@aduin/core` public API and `contracts/memory.ts` only; never imports core internals.
- `MemoryApi` interface (web side) is satisfied by the stub now and by the real Worker client in Phase 08; the stub must reproduce the Worker semantics: append-only decisions, one active decision per fingerprint, revoke instead of delete, `reason_code` required for dismiss.
- Reading view contract: text is rendered as React text nodes from the document model; no `dangerouslySetInnerHTML`, no `innerHTML`, no external resource loads from document content.
- Persisted UI state keys (filters, tab, selected finding) are versioned (`ui:v1`).
- Gate rule (core, confirmed by the user): a critical finding counts as unresolved until it is dismissed with reason or answered by counsel; **Accept alone keeps the gate Blocked** until counsel answers; `dismissed_reconfirm` stays unresolved until re-confirmed.

## Blast Radius

`apps/web/**`, `scripts/src/build-samples.ts`. Manifests: only `apps/web/package.json` is edited; `pnpm-lock.yaml`, `THIRD_PARTY_NOTICES.md` and `.gitignore` are seam edits serialized by the orchestrator against Phase 04a. `apps/web/e2e/slice.spec.ts` is Phase 04a's (not touched). Reads only: `design/mockups/*`, `samples/sub-docs/raw/*`, `fixtures/memory/law-firms.json`, `@aduin/core` exports. Does not touch `packages/core` or `apps/worker`. Parallel-safe with Phase 04a (disjoint). Registry `## Phase 03`.

## Data Flow

Sample bytes (static asset or upload) → IndexedDB (document store) → Comlink engine worker → model + findings → main thread store. For each finding the web computes `fingerprint` (core) and calls `memoryApi.lookup(firm, fingerprints[])` → `resolveLabel` → list placement (main list vs Previously handled). Triage action → `memoryApi.decide(...)` (stub: Dexie append) → state refresh. Filters → Zustand → localStorage.

## Failure Modes

Engine worker error → partial result with stage named (AC3); memory API error → all findings New plus "Memory unavailable" banner; corrupt/unsupported/empty upload → inline message, no crash; hostile HTML → rendered as inert text (AC39 hostile case).

## Implementation Checklist

### Step A — Mockup contract and tokens
- [ ] A1. Read `process/context/ui/all-ui.md`, the mockup HTML and NOTES; list interactions to reproduce (J/K navigation, click-to-open card, highlight + scroll, severity chips, selects, inline reason picker with 4 fixed reasons + optional note, undo toast, gate popover with jump links, "No AI" switch banner, Previously handled with Reopen, masked value + Reveal).
- [ ] A2. Create `src/styles/tokens.css` from the mockup `:root`; Tailwind `@theme` maps to the variables; self-host Newsreader and Geist.
- [ ] A3. Vitest `test/tokens-match-mockup.test.ts` (Vitest only; no Playwright token spec): parse the mockup `:root` custom properties and assert each equals the value in `tokens.css`.
- [ ] A4. Source guard `test/source-guard.test.ts` (Vitest): fail on hex colors or default shadcn color classes (`bg-primary`, `text-muted-foreground`, `border-border`, etc.) in `src/components` and `src/features`; colors only via token variables.
- [ ] A5. Fix severity to label mapping in one module (`critical`->"Blocks build", `high`->"Fix first", `medium`/`low`->"Note") with Vitest `test/severity-label.test.ts` asserting it.

### Step B — Engine bridge and storage
- [ ] B1. `engine.worker.ts` + `client.ts` (Comlink), progress events per stage. Settings passed to the worker include `firmId`; findings use the engine-supplied `Finding.fingerprint` (P01), never recomputed in the main thread.
- [ ] B1a. Split guard: Vitest import-graph test `test/import-graph.test.ts` (or ESLint `no-restricted-imports`) proving only `src/engine/engine.worker.ts` imports `htmlparser2` and core parse/structure/detector internals; main-thread code may use only core memory, fingerprint, label and firm functions.
- [ ] B1b. E2E-only stage-failure hook: compiled in only when `VITE_E2E=1` (used by the Playwright `preview` build); a Vitest/Node test `test/no-e2e-hook-in-dist.test.ts` builds without the flag and asserts the production `dist/` contains no hook marker string.
- [ ] B2. Dexie `db.ts` (stores, TTL purge on app start using `config/limits.ts` retention).
- [ ] B3. `scripts/src/build-samples.ts` run by the `prebuild`/`predev`/`pretest:e2e` scripts (single mechanism; output gitignored); manifest with firm/fund/version tags (#3–#6 `partners-group`, fund/version labels from file names).
- [ ] B5. Define `apps/web/package.json` scripts (the only manifest P03 edits): `test` = `vitest run` with Vitest `include: ['test/**/*.test.ts']` and `exclude: ['e2e/**']` (so Playwright specs are never collected by Vitest); `test:e2e` = `playwright test --project=preview` (a gate selects specs by file-name token, e.g. `test:e2e -- status-stages`); `test:a11y` = `playwright test --project=preview a11y-smoke`; `pretest:e2e`, `prebuild`, `predev` = `tsx ../../scripts/src/build-samples.ts` (the single samples mechanism). `playwright.config.ts` `testMatch`: project `preview` matches all `e2e/*.spec.ts` except `slice.spec.ts` (`testIgnore: /slice\.spec\.ts/`); project `stack` matches only `slice.spec.ts` (Phase 04a's).
- [ ] B4. `stubMemoryApi.ts` implementing the `MemoryApi` interface with the real semantics; unit tests for the semantics.

### Step C — Screens
- [ ] C1. Home: sample picker (12 samples), upload with limits copy (10 MB, 30 pages per scan, `.htm/.html/.pdf/.docx/.jpg/.jpeg/.png`; `.pdf/.docx/images` pass validators and then show the inline message "supported in a later build" (until P06), no crash), firm picker (alias-resolving combobox; free text rejected; "Other / no firm" allowed with "memory not applied" message), fund name, version label; privacy notice before first upload and before AI use with retention values from `limits.ts`; AI switch (state stored; effect wired in P05).
- [ ] C2. Processing stage stepper with named stages and the partial-failure state; allowance slot placeholder.
- [ ] C3. Review workspace to mockup: top bar, tabs, document pane with highlight, findings panel (TanStack Table), filters/sort/counts (persist), finding card (class, severity icon+word, quote with location, detector rule id or model+fresh/cache, confidence, expected-vs-found), actions (Accept, Needs counsel, Dismiss reason picker, Edit text/severity), undo toast, label chips, Previously handled (with Reopen), gate pill + popover. The gate pill uses `features/review/gateInterim.ts` (reason kinds open|unanswered|unclear|awaiting_counsel|reconfirm_required, signature mirroring P08 `computeGate`); popover reasons jump to the item.
- [ ] C4. Structure tab + outline rail (AC17 view).
- [ ] C5. Reveal control for masked sensitive values (default masked in list and document).
- [ ] C6. Keyboard: J/K, Enter/Esc, visible focus, ARIA roles for list/dialog/popover; severity never by color alone.

### Step D — Tests
- [ ] D1. Playwright specs per Test Gates under project `preview` (`vite preview` of a `VITE_E2E=1` build, stub API; no Worker). `slice.spec.ts` is Phase 04a's under project `stack`; P03 does not create it.
- [ ] D1a. `gate-interim` Vitest matrix and `gate-pill` Playwright spec: Accept on critical keeps Blocked; Dismiss with reason resolves; reconfirm stays unresolved; popover reasons jump to the item.
- [ ] D1b. `engine-worker-split` e2e: `page.on('worker')` fires on sample open; main-thread long-task budget (PerformanceObserver `longtask`, budget stated in the spec) while parsing sample #2.
- [ ] D1c. `layout-vs-mockup` e2e (computed styles and bounding boxes): findings panel 448 px at 1440 and 400 px at 1024 (mockup breakpoint max-width 1279); outline rail hidden at 1024; box-shadow only on the gate popover; no gradients. Radius and font-size vocabularies are NOT hard-coded: at test time the spec reads the mockup file's CSS (like `tokens-match-mockup`) and derives the allowed sets, then asserts every computed value in the app (screens: home, review, popover open) is in the set. Reference values the derivation must yield today: font sizes 13/14/15/16/17/20/28 px (UI chrome 13/14/16/20/28; document pane 15/17); radius 4px (`--r`) with named exceptions 3px (tags, segmented buttons, kbd, mask, badge), 2px (focus ring, docid rule, mark, checkbox), 999px (gate pill, count badge). If the derived set and these reference values differ, the spec fails and the plan is updated, not the assertion loosened.
- [ ] D1d. `previously-handled-section` seeding: Playwright fixture `seedMemory.ts` seeds stub memory with real fingerprints OR the real flow (dismiss #3 in fund A / partners-group, then open #5 fund B same firm). Assert count, reason/who/fund/when, Reopen revokes (stored) and the item returns to New; include a critical-dismissed case that stays in the main list labelled "Dismissed in [fund], re-confirm".
- [ ] D1e. `privacy-notice.spec.ts` also asserts the AI switch state persists across reload (AC38; effect of the toggle is P05).
- [ ] D2. `hostile-html.spec.ts`: upload an HTML with `<script>`, `onerror`, `<iframe>`, external `<img>`; assert no script ran (sentinel), no request to a non-local host (route interception), content shown as text.
- [ ] D3. `a11y-smoke.spec.ts`: axe on home, review, gate popover open, reason picker open, Previously handled expanded. Gate = zero critical violations (AC30 interim); serious color-contrast findings are listed in the report, not gate-fail (full sign-off Phase 10).

### Step E — Visual check vs mockup
- [ ] E1. Screenshot review at 1440 and 1024 widths; compare layout, tokens, type scale, spacing against the mockup; apply `design-taste-frontend` `references/tells.md`/`critique.md` as a checklist only; record deviations and reasons in the report (agent-probe). Playwright saves screenshots of the mockup file and the app at 1440 and 1024 into this task folder (`design-probe/`), with a pass/fail rubric (panel width, rail, tone steps, type scale and radius judged against the mockup-derived sets from D1c incl. the named exceptions, shadow, single accent); a read-only second subagent runs the rubric. Newer mockups (compare, counsel-sheet, firm-memory, start, structure) are NOT approved: do not build from them.
- [ ] E2. Raise selects to 16 px under 900 px (mockup note 4); keep outline rail with blocking counts (mockup open question 3 default: keep).
- [ ] E3. UPDATE PROCESS action: record approved tokens in `process/context/ui/all-ui.md` (Artifacts section) at closeout.

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| unit | `pnpm --filter @aduin/web test` | Fully-Automated | stub API semantics, retention purge, severity mapping |
| sample picker | `pnpm --filter @aduin/web test:e2e -- sample-picker-smoke` | Fully-Automated | AC2 |
| stages | `pnpm --filter @aduin/web test:e2e -- status-stages` | Fully-Automated | AC3 |
| highlight | `pnpm --filter @aduin/web test:e2e -- finding-highlight` | Fully-Automated | AC4 (real engine output, samples #1, #3, #11) |
| filter/triage | `pnpm --filter @aduin/web test:e2e -- filter-sort triage-actions dismiss-requires-reason` | Fully-Automated | AC5, AC6 |
| upload/privacy/firm | `pnpm --filter @aduin/web test:e2e -- upload-limits privacy-notice upload-firm-tagging` | Fully-Automated | AC37, AC38, AC41 |
| previously handled | `pnpm --filter @aduin/web test:e2e -- previously-handled-section` | Fully-Automated | AC49 |
| structure view | `pnpm --filter @aduin/web test:e2e -- structure-view` | Fully-Automated | AC17 (view) |
| hostile html | `pnpm --filter @aduin/web test:e2e -- hostile-html` | Fully-Automated | AC39 (client part) |
| gate interim | `pnpm --filter @aduin/web test -- gate-interim` | Fully-Automated | gate rule (user-confirmed; AC22 owned by P08) |
| gate pill | `pnpm --filter @aduin/web test:e2e -- gate-pill` | Fully-Automated | gate rule (UI) |
| worker split | `pnpm --filter @aduin/web test:e2e -- engine-worker-split` and `pnpm --filter @aduin/web test -- import-graph` | Fully-Automated | parsing off main thread |
| E2E hook absent in prod | `pnpm --filter @aduin/web test -- no-e2e-hook-in-dist` | Fully-Automated | stage-failure hook not shipped |
| tokens | `pnpm --filter @aduin/web test -- tokens-match-mockup` | Fully-Automated | mockup fidelity (tokens) |
| source guard | `pnpm --filter @aduin/web test -- source-guard` | Fully-Automated | no hex colors / default shadcn classes |
| layout vs mockup | `pnpm --filter @aduin/web test:e2e -- layout-vs-mockup` | Fully-Automated | mockup fidelity (layout) |
| a11y smoke | `pnpm --filter @aduin/web test:a11y` | Hybrid (zero critical axe violations; precondition: preview build; manual keyboard pass in P10) | AC30 (interim) |
| visual vs mockup | screenshots of mockup and app at 1440 and 1024 + rubric, run by a read-only second subagent | Agent-Probe | mockup fidelity (visual) |
| regression | `pnpm --filter @aduin/core test:golden && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | Phase 01/00 intact |

Failing stubs for red-first: `should refuse to dismiss without a reason and show the message`, `should keep filter state after reload`, `should highlight the quote of the selected finding`, `should render hostile html as inert text`, `should keep the gate Blocked after Accept on a critical finding`, `should run document parsing in a dedicated worker`, `should not ship the E2E failure hook in the production build`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `sample-picker-smoke` | Fully-Automated | AC2 |
| `gate-interim` (Vitest), `gate-pill` | Fully-Automated | gate rule (user-confirmed; AC22 owned by P08) |
| `engine-worker-split`, `import-graph` | Fully-Automated | parsing off main thread |
| `layout-vs-mockup`, `tokens-match-mockup`, `source-guard` | Fully-Automated | mockup fidelity |
| `no-e2e-hook-in-dist` | Fully-Automated | stage-failure hook absent in production |
| `status-stages` | Fully-Automated | AC3 |
| `finding-highlight` | Fully-Automated | AC4 |
| `filter-sort` | Fully-Automated | AC5 |
| `triage-actions`, `dismiss-requires-reason` | Fully-Automated | AC6 |
| `upload-limits` | Fully-Automated | AC37 |
| `privacy-notice` (notice shown + AI switch state persists), `retention-purge` | Fully-Automated | AC38 |
| `upload-firm-tagging` | Fully-Automated | AC41 |
| `previously-handled-section` | Fully-Automated | AC49 |
| `hostile-html` | Fully-Automated | AC39 (client part) |
| `a11y-smoke` | Hybrid (preview build precondition; manual keyboard pass in P10) | AC30 (interim) |
| `severity-label` | Fully-Automated | severity-to-label mapping (A5) |
| `structure-view` | Fully-Automated | AC17 (view) |
| Visual check vs mockup (rubric, read-only second subagent) | Agent-Probe | none directly (supports AC30 and UI quality); residual: no pixel-diff oracle |

Alias note: SPEC/umbrella tokens carry an `-e2e` suffix or longer names (`finding-highlight-e2e` = `finding-highlight.spec.ts`, `upload-limits-e2e` = `upload-limits.spec.ts`, `status-stages-and-partial-failure` = `status-stages.spec.ts`, `privacy-notice-and-ai-toggle-e2e` = `privacy-notice.spec.ts`); P03 file names are the bare gate tokens.

```bash
pnpm --filter @aduin/web test && pnpm --filter @aduin/web test:e2e -- --project=preview && pnpm --filter @aduin/web test:a11y
# Expected: all exit 0
```

## Exit Gate

- All gates green; screenshots recorded in the report; `tokens-match-mockup` green.
- Real findings visible (proven by `finding-highlight` on real engine output): opening sample #1 shows the "this Section 11" finding highlighted in the document (M1 check completes with Phase 04a's `pnpm slice:check`).
- Phase report written.

## Risks and Kill Criteria

- Radix restyle drift from tokens: guarded by `tokens-match-mockup` and the visual probe.
- Document pane performance on the 380 KB sample (S7): virtualize the pane if render > 1 s (fallback: windowed blocks).
- Stub vs real API semantic gap: closed in Phase 08; stub tests mirror Worker rules.
- Kill: if highlight-by-anchor is unreliable across table-merged lines, fall back to block-level highlight (documented).

## Cost / Secret Hygiene

No LLM/OCR/Cloudflare calls in this phase. No keys in the web bundle (Turnstile site key is public and added in P04a/P05). Samples are public SEC files.

## Rollback

`git revert` the phase commits; `apps/web` is isolated and the Worker/core are unaffected.

## Blockers That Would Justify BLOCKED Status

- Mockup interactions cannot be reproduced with the pinned stack (route to user with specifics).
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

(none identified yet) — candidate: a reusable Playwright fixture that seeds Dexie and fake time.

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-03-web-shell_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: CONDITIONAL (outer PVL re-run 17-10-26 after supplement cycle 2; G1-G3 resolved; 2 new concerns G4 gate-command wiring and G5 fingerprint flow vs Phase 01, supplement cycle 3 required)
- Next Step: after Phase 01 is verified, spawn vc-research-agent (read the Phase 01 report, mockup, all-ui.md). Next phase: Phase 04a (thin Worker) to complete Milestone 1.

## Validate Contract

Status: CONDITIONAL
Date: 17-10-26
date: 2026-10-17
generated-by: outer-pvl
supersedes: 2026-10-17 (outer-pvl) - re-run from V1 after supplement cycle 2 (3 gaps G1-G3 applied); this contract has current evidence

Parallel strategy: sequential
Rationale: 3/7 signals (S4 phase program, S6 untrusted-document rendering trust boundary, S7 30+ files) = MEDIUM; shared component tree and a single editing agent, so execute sequentially; optional second read-only subagent only for the visual probe. The validate fan-out was run inline by the single validate agent (no sub-agent spawn tool available); no cross-agent contradictions to rank.

Prior supplement gaps re-checked against the plan text and the approved mockup (cycle 3 of the PVL loop):
- G1 (mockup values) RESOLVED. D1c now derives the allowed font-size and radius sets from the mockup CSS at test time. Verified against `design/mockups/review-workspace.html`: font sizes present are 13/14/15/16/17/20/28 px (15 in `.paper h3`, `h2 small`, `blockquote.ev`; 17 in `.paper h2`); radii present are 4px (`--r`, plus the `var(--r) var(--r) 0 0` tab corner), 3px (`.seg button`, `.badge`, `.tag`, `kbd`, `.mask`, `.revealbtn`), 2px (focus ring, `mark.q`, `.box`), 999px (gate pill, count badge). The plan's reference values match. Panel 448 px at 1440 and 400 px at 1024 with rail hidden match the mockup `@media (max-width:1279px)` block. Nit (advisory, not a gap): the plan lists the "docid rule" among the 2px radii; in the mockup the docid rule is a 2px-wide bar with no radius, so only the focus ring, mark and checkbox box carry 2px radius. The set is derived from the file, so the assertion is unaffected.
- G2 (scripts and config) RESOLVED in structure. B5 states `test`, `test:e2e`, `test:a11y`, `pretest:e2e`/`prebuild`/`predev`, Vitest include/exclude and per-project `testMatch`/`testIgnore`. The B5 config shape was probed in a scratch pnpm 11.13.1 workspace with Vitest and Playwright: Vitest collects only `test/**/*.test.ts`; project `preview` ran `e2e/*.spec.ts` and skipped `slice.spec.ts`; the `pretest:e2e` and `predev` pre-hooks fire. NEW wiring gaps found by that probe are recorded as G4.
- G3 (inventory drift) RESOLVED. Touchpoints lists `no-e2e-hook-in-dist` and `severity-label`; Verification Evidence has `hostile-html`, `a11y-smoke` and `severity-label` rows; the `-e2e` alias note is present; D1e asserts the AI switch persists.
- No regression: P03 still does not own `slice.spec.ts`; no core/worker edits; AC rows AC2/3/4/5/6/37/38/41/49 intact; Phase 01's new required `v` visitor id in SessionClaims does not touch P03 (P03 uses a stub memory API and no cookies; the `stack` project runs only Phase 04a's slice spec). `validate-plan-artifact.mjs` reports 0 failures, 0 warnings.

Test gates (C3 5-column table; commands are shown in the corrected no-`--` form that G4 requires; until the plan is supplemented the plan text still shows `-- <token>`):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC2 | every HTML sample opens in one click, pre-tagged firm/fund/version (#3-#6 one firm) | Fully-Automated | `pnpm --filter @aduin/web test:e2e sample-picker-smoke` | B |
| AC3 | named stages; injected stage failure gives partial result naming the stage; AI shows pending | Fully-Automated | `pnpm --filter @aduin/web test:e2e status-stages` (hook compiled only with `VITE_E2E=1`) | B |
| AC4 / M1 | selecting a finding scrolls to and highlights its quote, on REAL engine output (#1 "this Section 11", #3 swapped refs, #11 undefined "Units") | Fully-Automated | `pnpm --filter @aduin/web test:e2e finding-highlight` | B |
| AC5 | filter/sort by severity/class/detector/status; counts match; survives reload | Fully-Automated | `pnpm --filter @aduin/web test:e2e filter-sort` | B |
| AC6 | accept/dismiss/answered/edit/needs-counsel persist and undo; dismiss refused without reason | Fully-Automated | `pnpm --filter @aduin/web test:e2e triage-actions dismiss-requires-reason` + `pnpm --filter @aduin/web test stub-memory-api` | B |
| gate rule (user-confirmed; AC22 owned by P08) | Accept on a critical finding keeps gate Blocked until counsel answers; dismiss-with-reason resolves; dismissed_reconfirm stays unresolved; popover reasons jump to the item | Fully-Automated | `pnpm --filter @aduin/web test gate-interim` + `pnpm --filter @aduin/web test:e2e gate-pill` | B |
| AC37 | upload limits stated and enforced (10 MB, types, empty) before any AI call; pdf/docx/images show "supported in a later build" | Fully-Automated | `pnpm --filter @aduin/web test:e2e upload-limits` | B |
| AC38 | privacy notice before first upload and before AI use; AI switch state persists; IndexedDB retention purge | Fully-Automated | `pnpm --filter @aduin/web test:e2e privacy-notice` + `pnpm --filter @aduin/web test retention-purge` | B |
| AC41 | firm picker alias-resolving, free text rejected, #3-#6 pre-tagged one firm | Fully-Automated | `pnpm --filter @aduin/web test:e2e upload-firm-tagging` | B |
| AC49 | Previously handled (n) complete, collapsible, reason/who/fund/when, Reopen revokes (never deletes); critical-dismissed stays in main list | Fully-Automated | `pnpm --filter @aduin/web test:e2e previously-handled-section` (seedMemory fixture or real dismiss flow; needs the G5 fingerprint wiring) | B |
| AC17 (view) | structure tab and outline rail list sections, refs, conditionals, option groups, terms | Fully-Automated | `pnpm --filter @aduin/web test:e2e structure-view` | B |
| AC39 (client) | hostile HTML rendered as inert text; no script runs; no non-local request | Fully-Automated | `pnpm --filter @aduin/web test:e2e hostile-html` | B |
| mockup fidelity (tokens + guards) | every mockup `:root` property equals `tokens.css`; no hex colors / default shadcn classes; severity-to-label mapping | Fully-Automated | `pnpm --filter @aduin/web test tokens-match-mockup source-guard severity-label` | B |
| mockup fidelity (layout) | panel 448 px at 1440 / 400 px at 1024, rail hidden at 1024, shadow only on gate popover, no gradients; font-size and radius sets derived from the mockup CSS | Fully-Automated | `pnpm --filter @aduin/web test:e2e layout-vs-mockup` | B |
| browser Web Worker split | no document parsing on the main thread; only `engine.worker.ts` imports parse/structure internals | Fully-Automated | `pnpm --filter @aduin/web test:e2e engine-worker-split` + `pnpm --filter @aduin/web test import-graph` | B |
| E2E hook absent in prod | stage-failure hook not shipped in production `dist/` | Fully-Automated | `pnpm --filter @aduin/web test no-e2e-hook-in-dist` | B |
| AC30 (interim) | axe scan home + review (incl. open gate popover, reason picker, Previously handled expanded): zero critical violations | Hybrid | `pnpm --filter @aduin/web test:a11y` (precondition: preview build served and samples generated; manual keyboard pass in P10) | C |
| visual vs mockup | layout, type scale, spacing, tone steps at 1440 and 1024 | Agent-Probe | Playwright screenshots of mockup file and app at both widths into `design-probe/`, pass/fail rubric run by a read-only second subagent | D |
| regression | Phase 01 goldens and Phase 00 guards intact | Fully-Automated | `pnpm --filter @aduin/core test:golden && pnpm guard:cf && pnpm secrets:scan` | A |

gap-resolution legend: A proven now; B fixed in this plan's checklist; C deferred to a named later phase/plan; D backlog test-building stub (named residual).
Known-Gap is never a strategy value; none of the rows above is carried by Known-Gap alone (no vacuous green).

Failing stubs (Fully-Automated rows; red-first starting points, one per row group above; copy each into the matching spec/test file):
- AC4 / M1: test("should highlight the quote of the selected finding", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should highlight the quote of the selected finding") })
- AC5: test("should keep filter state after reload", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should keep filter state after reload") })
- AC6: test("should refuse to dismiss without a reason and show the message", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should refuse to dismiss without a reason and show the message") })
- gate rule: test("should keep the gate Blocked after Accept on a critical finding", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should keep the gate Blocked after Accept on a critical finding") })
- AC49: test("should keep a critical dismissed item in the main list labelled re-confirm and count it as unresolved", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should keep a critical dismissed item in the main list labelled re-confirm and count it as unresolved") })
- AC39 (client): test("should render hostile html as inert text", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should render hostile html as inert text") })
- Web Worker split: test("should run document parsing in a dedicated worker", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should run document parsing in a dedicated worker") })
- E2E hook absent in prod: test("should not ship the E2E failure hook in the production build", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should not ship the E2E failure hook in the production build") })
- tokens: test("should match every mockup :root custom property in tokens.css", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should match every mockup :root custom property in tokens.css") })
- layout: test("should size the findings panel 448px at 1440 and 400px at 1024 and hide the outline rail at 1024", () => { throw new Error("NOT IMPLEMENTED - TDD stub: should size the findings panel 448px at 1440 and 400px at 1024 and hide the outline rail at 1024") })

Execute-agent instructions (advisory; not plan gaps):
- E1. `base.css` must carry the mockup resets `button,select,textarea{font:inherit;color:inherit}` and add `input{font:inherit}` (the home screen has inputs the mockup does not show; the UA default 13.333px would fail the derived font-size set).
- E2. In `layout-vs-mockup`, treat radius `0` (and per-corner values such as `4px 4px 0 0` on tabs) as allowed, and ignore elements with no rendered text for the font-size check.
- E3. Map the 4 UI dismiss reasons (mockup labels) to the DATA-MODEL `reason_code` values `firm_standard_wording`, `no_form_impact`, `tool_false_alarm`, `other` in one module; the stub validates against that list.

Legacy line form:
- apps/web unit: [Fully-automated: pnpm --filter @aduin/web test]
- apps/web e2e: [Fully-automated: pnpm --filter @aduin/web test:e2e]
- apps/web a11y: [hybrid: pnpm --filter @aduin/web test:a11y + precondition preview build and generated samples + manual keyboard pass in P10]
- visual vs mockup: [agent-probe: screenshots at 1440 and 1024 against design/mockups/review-workspace.html, rubric by read-only second subagent]
- regression: [Fully-automated: pnpm --filter @aduin/core test:golden && pnpm guard:cf && pnpm secrets:scan]

Dimension findings:
- Infra fit: CONCERN - web-only blast radius, two Playwright projects and one samples mechanism are stated and the B5 config shape works in a pnpm 11.13.1 probe; but (a) `pretest:e2e` is keyed to the `test:e2e` script name, so `test:a11y` (a separate script) does not trigger it and the gitignored samples are missing on a clean checkout unless the Playwright `webServer` command goes through `pnpm build` (stated nowhere), and (b) every gate selects by `-- <token>`, which the pinned pnpm does not honor (G4).
- Test coverage: CONCERN - every behavior has a named automated gate and a file-name token; the gate commands as written do not select by token under pnpm 11.13.1, so each "per-gate" command actually runs the whole suite (green only if everything is green; red-first isolation and AC-to-gate traceability are not what the plan claims) (G4).
- Breaking changes: CONCERN - the plan contradicts the frozen Phase 01 contract: P01 says `Finding.fingerprint` is optional, the engine never computes it, and `fingerprintFor(finding, firmId|null)` computes it at lookup time; P03 B1 and Touchpoints say `firmId` goes into worker settings and findings carry an engine-supplied `Finding.fingerprint` "never recomputed in the main thread", while P03 Data Flow says the web computes it (G5).
- Security surface: PASS - text-node rendering, no innerHTML, no secrets in bundle, hostile-HTML gate with sentinel and route interception, E2E hook excluded from production and proven by `no-e2e-hook-in-dist`; the new `v` claim in SessionClaims is not consumed by this phase.
- Section A (mockup contract and tokens): PASS - G1 resolved; allowed sets derived from the mockup file and the reference values match the real mockup CSS (see E1, E2).
- Section B (engine bridge and storage): CONCERN - B1/Touchpoints fingerprint wording conflicts with P01 (G5); B5 scripts need `pretest:a11y` or an explicit `webServer` build step (G4).
- Section C (screens): PASS - gate computed by web-local `gateInterim.ts` mirroring P08 `computeGate` kinds; Reopen, unsupported-type message, severity-to-label mapping, reveal control and keyboard items present.
- Section D (tests): CONCERN - spec file names equal gate tokens, D1a-D1e, D2, D3 are concrete; the `-- <token>` selection form is non-functional (G4).
- Section E (visual check vs mockup): PASS - screenshots at 1440 and 1024, rubric uses the mockup-derived sets, newer unapproved mockups excluded; residual: no pixel-diff oracle.

Open gaps:
- G4: gate command wiring under the pinned `pnpm@11.13.1`. Probe evidence (scratch workspace, Vitest + Playwright): `pnpm --filter @aduin/web test -- gate-interim` ran 2 of 2 test files (filter ignored) while `... test gate-interim` ran 1; `... test:e2e -- status-stages` ran both specs while `... test:e2e status-stages` ran one; multiple tokens work without `--` (`test:e2e status-stages gate-pill`). Fix in plan text: drop `--` from every gate command (Test Gates table, Verification Evidence one-liner, B5 example, Naming rule); keep `test:e2e` = `playwright test --project=preview` so the final one-liner is `pnpm --filter @aduin/web test:e2e`. Also add `pretest:a11y` (same samples script) or state that the Playwright `preview` `webServer` command runs `pnpm build` (so `prebuild` generates samples) and that `test:a11y` depends on it. The same `-- <token>` form appears in other phase plans (Phase 00-10: 100+ occurrences): program-wide, to be handled by the orchestrator; only Phase 03 is in scope here.
- G5: fingerprint contract mismatch with Phase 01 (see Breaking changes). Fix in plan text: remove `firmId` from the worker settings and the "engine-supplied `Finding.fingerprint`" wording in B1, Touchpoints (`src/engine`) and the Section B note; state ONE flow: the engine returns findings with `quote_hash` and no fingerprint; the main thread calls core `fingerprintFor(finding, firmId)` (allowed main-thread import, named in B1a) before `memoryApi.lookup`; `firmId=null` ("Other / no firm") yields `null` fingerprints, skips lookup, and shows "memory not applied" (AC41). Make `stub-memory-api`, `previously-handled-section` and `retention-purge` use the same call.
- Registry note (resolved): Phase 06 extends `apps/web/src/engine`.
- Not approved, noted only: newer mockups `design/mockups/{compare,counsel-sheet,firm-memory,start,structure}.html` are NOT approved; Phase 03 must not build from them.
- Optional, not blocking: CSP via `_headers`; visual pixel-diff oracle (none feasible, content differs).

What this coverage does NOT prove:
- sample-picker-smoke: does not prove scan/PDF/DOCX samples (activate in P06) or real-user click latency.
- status-stages: does not prove AI stage with real AI (P05) or stage timing on slow devices; failure is injected by an E2E-only hook, not a real engine crash.
- finding-highlight / filter-sort / triage: do not prove behavior against the real Worker memory API (P04b/P08), multi-tab concurrency, or highlight across table-merged lines beyond the sample set (kill-criterion fallback: block-level).
- gate rule (interim): does not prove core `computeGate` parity (P08 gate-state-matrix) or answered/unclear/Awaiting counsel states beyond stub data.
- upload / privacy: do not prove server-side purge (P04b), page-count limit on real scans (P06), or AI toggle effect (P05).
- previously-handled: does not prove cross-session or cross-device memory (P08, real API) or cross-firm isolation.
- tokens-match-mockup / source-guard: prove token values and absence of hard-coded colors, not that components consume them or that layout matches.
- layout-vs-mockup: proves computed geometry and a bounded style vocabulary (derived from the mockup file) at 1440 and 1024 only, on home, review and popover screens; not pixel parity, content, or other widths.
- engine-worker-split / import-graph: prove a worker is created and imports are confined statically; not absence of every main-thread long task on slower hardware.
- no-e2e-hook-in-dist: proves a marker string is absent from `dist/`; not that no other test-only code ships.
- hostile-html: does not prove the same on PDF/DOCX/OCR paths (P06) or server-side abuse protection (04a).
- a11y smoke: does not prove WCAG AA contrast on all states or full keyboard flow (P10).
- visual probe: no pixel-diff oracle; judgment-based.
- all gate commands: the corrected no-`--` form was probed in a scratch workspace with trivial specs, not against the real `apps/web` (which does not exist yet).

Gate: CONDITIONAL (no FAILs; 2 CONCERNs G4-G5, both fixable in plan text; G1-G3 resolved; supplement cycle 3 required)
Accepted by: session (autonomous, autopilot standing consent) - pending supplement cycle 3; concerns accepted by name: G4 gate-command wiring under pnpm 11.13.1 (`--` token selection ignored, `pretest:a11y`/samples), G5 fingerprint flow vs Phase 01 frozen contract (`fingerprintFor` at lookup time, no firmId in worker settings).
