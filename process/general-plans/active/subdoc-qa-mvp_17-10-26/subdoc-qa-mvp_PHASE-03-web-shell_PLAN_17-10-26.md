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

UI contract (every UI phase): use `minimalist-ui` for visual direction and `redesign-existing-projects` for audit passes on app screens; `design-taste-frontend` only for marketing surfaces (landing, slides), never app screens. Tokens come from the mockup `:root` (cool stone ground #E9ECE9, one teal accent #1D5C57, Newsreader + Geist, 4px radius, tone steps instead of borders, no shadows/gradients except the single gate-popover shadow). **shadcn/Radix reconciliation:** use Radix primitives (Dialog/Popover/Select/Toggle/Collapsible/Tabs) for accessibility behavior only; restyle every component from the mockup tokens, never ship default shadcn styling. Tailwind maps to the tokens via CSS variables (`@theme`), no hard-coded colors in components.

Other screens (structure, diff, counsel sheet, memory, outline) have no mockup: this phase builds only the **structure** view; each later UI phase starts with a mockup step reusing the same tokens and patterns.

## Phase Completion Rules

- CODE DONE = components and tests committed.
- VERIFIED = Exit Gate green incl. visual check vs mockup, validate-contract written, M1 slice check (together with Phase 04a) recorded, regression: Phase 01 goldens + Phase 00 guards green.
- User confirmed: mockup is approved (relayed by the UI session). Gate semantics confirmed: Accept on a blocking item keeps the gate Blocked until counsel answers.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC2 | Sample picker opens every HTML sample in one click, pre-tagged firm/fund/version (#3–#6 one firm) | `sample-picker-smoke` (loops all 12 `.htm` samples through parse; the 22-page scan set row activates in P06) | Fully-Automated | closes P06 |
| AC3 | Named stages; stage failure → partial result naming the stage; AI shows "pending" | `status-stages-and-partial-failure` (E2E, injected stage failure) | Fully-Automated | AI pending verified P05 |
| AC4 | Selecting a finding scrolls to and highlights its quote | `finding-highlight-e2e` | Fully-Automated | scan region highlight P06 |
| AC5 | Filter/sort by severity, class, detector, status; counts match; state survives reload | `filter-sort-e2e` | Fully-Automated | — |
| AC6 | Accept/dismiss/answered/edit/needs-counsel persist and are undoable; Dismiss refused without a reason from the fixed list | `triage-actions-persist-e2e` + `dismiss-requires-reason-e2e` (against the stub memory API) | Fully-Automated | closes P08 (real API) |
| AC37 | Upload limits stated and enforced (10 MB, 30 pages per scan, accepted types) before any AI call | `upload-limits-e2e` (at limit, over limit, wrong type, empty; page-count rows activate in P06) | Fully-Automated | closes P06 |
| AC38 | Privacy notice before first upload and before AI use; AI off switch; stored uploads purged after retention | `privacy-notice-and-ai-toggle-e2e` + browser-side `retention-purge-test` (IndexedDB TTL, fake clock) | Fully-Automated | server purge P04b; toggle effect P05 |
| AC41 | Upload links firm (alias list, no free text), fund name, version label; #3–#6 pre-tagged one firm | `upload-firm-tagging-e2e` | Fully-Automated | D1 list parity P04b |
| AC49 | "Previously handled (n)" is complete, collapsible, shows reason/who/fund/when; nothing is removed by showing it | `previously-handled-section-e2e` (stub API) | Fully-Automated | closes P08 |

Also built here, proven elsewhere: AC17 structure **view** (extraction owned by P01; this phase's `structure-view-e2e` is the closing check), AC10 reveal control component (owned by P02; this phase ships the control and a seeded-finding test).

## Entry Gate

- Phase 01 exit gate passed (core engine, contracts frozen).
- Mockup file and notes exist (`design/mockups/`), `process/context/ui/all-ui.md` read.
- UI references: none provided; proceed with the mockup as the reference (do not introduce new references during EXECUTE).

## Library pins (confirm via vc-docs-seeker in Phase 00)

React, Vite, Tailwind, Radix primitives (via shadcn/ui source), Zustand, TanStack Table, Dexie, Comlink, Playwright, @axe-core/playwright, Newsreader + Geist (self-hosted font files; OFL).

## Touchpoints (create; web only)

```
apps/web/
  index.html, vite.config.ts (copy samples step), playwright.config.ts (from P00; e2e specs here)
  public/samples/*            generated by scripts/src/build-samples.ts from samples/sub-docs/raw (12 .htm) + manifest.json (firm/fund/version tags; #3–#6 partners-group)
  public/firms.json           generated from fixtures/memory/law-firms.json
  src/styles/{tokens.css,base.css}   tokens copied from the mockup :root (single source in the web app)
  src/main.tsx, App.tsx, state/{review,filters,session}.ts (Zustand), hash view-switch (no router dependency)
  src/engine/{engine.worker.ts,client.ts}    Comlink wrapper over @aduin/core (parse, run, structure)
  src/storage/db.ts (Dexie: documents, parsedModel cache, uiState, drafts, outbox)
  src/api/{memoryApi.ts (interface from core contracts), stubMemoryApi.ts (Dexie-backed), client.ts (fetch; real impl in P04b/P08)}
  src/components/ui/*         Radix-based primitives restyled from tokens
  src/features/home/          upload + sample picker + firm/fund/version form + limits + privacy notice + AI switch
  src/features/processing/    stage stepper (read, structure, checks, AI review, done) + allowance slot
  src/features/review/        top bar, gate pill + popover, document pane (rendered from model text nodes, never raw HTML), findings panel (TanStack Table), filters, finding card, dismiss reason picker, undo toast, label chips, Previously handled, reveal control
  src/features/structure/     outline rail + structure tab (sections, refs resolved/unresolved/suspicious with expected vs found, conditionals, option groups, terms)
  src/features/registry.ts    (seam from P00: register home/review/structure)
  e2e/{slice,filter-sort,triage,previously-handled,upload,privacy,structure,hostile-html,tokens,a11y-smoke}.spec.ts
scripts/src/build-samples.ts
```

## Public Contracts

- Consumes `@aduin/core` public API and `contracts/memory.ts` only; never imports core internals.
- `MemoryApi` interface (web side) is satisfied by the stub now and by the real Worker client in Phase 08; the stub must reproduce the Worker semantics: append-only decisions, one active decision per fingerprint, revoke instead of delete, `reason_code` required for dismiss.
- Reading view contract: text is rendered as React text nodes from the document model; no `dangerouslySetInnerHTML`, no `innerHTML`, no external resource loads from document content.
- Persisted UI state keys (filters, tab, selected finding) are versioned (`ui:v1`).
- Gate rule (core, confirmed by the user): a critical finding counts as unresolved until it is dismissed with reason or answered by counsel; **Accept alone keeps the gate Blocked** until counsel answers; `dismissed_reconfirm` stays unresolved until re-confirmed.

## Blast Radius

`apps/web/**`, `scripts/src/build-samples.ts`. Reads only: `design/mockups/*`, `samples/sub-docs/raw/*`, `fixtures/memory/law-firms.json`, `@aduin/core` exports. Does not touch `packages/core` or `apps/worker`. Parallel-safe with Phase 04a (disjoint). Registry `## Phase 03`.

## Data Flow

Sample bytes (static asset or upload) → IndexedDB (document store) → Comlink engine worker → model + findings → main thread store. For each finding the web computes `fingerprint` (core) and calls `memoryApi.lookup(firm, fingerprints[])` → `resolveLabel` → list placement (main list vs Previously handled). Triage action → `memoryApi.decide(...)` (stub: Dexie append) → state refresh. Filters → Zustand → localStorage.

## Failure Modes

Engine worker error → partial result with stage named (AC3); memory API error → all findings New plus "Memory unavailable" banner; corrupt/unsupported/empty upload → inline message, no crash; hostile HTML → rendered as inert text (AC39 hostile case).

## Implementation Checklist

### Step A — Mockup contract and tokens
- [ ] A1. Read `process/context/ui/all-ui.md`, the mockup HTML and NOTES; list interactions to reproduce (J/K navigation, click-to-open card, highlight + scroll, severity chips, selects, inline reason picker with 4 fixed reasons + optional note, undo toast, gate popover with jump links, "No AI" switch banner, Previously handled with Reopen, masked value + Reveal).
- [ ] A2. Create `src/styles/tokens.css` from the mockup `:root`; Tailwind `@theme` maps to the variables; self-host Newsreader and Geist.
- [ ] A3. Test `e2e/tokens.spec.ts` (or Vitest): parse the mockup `:root` custom properties and assert each equals the value in `tokens.css` (`tokens-match-mockup`).

### Step B — Engine bridge and storage
- [ ] B1. `engine.worker.ts` + `client.ts` (Comlink), progress events per stage.
- [ ] B2. Dexie `db.ts` (stores, TTL purge on app start using `config/limits.ts` retention).
- [ ] B3. `scripts/src/build-samples.ts` + Vite step; manifest with firm/fund/version tags (#3–#6 `partners-group`, fund/version labels from file names).
- [ ] B4. `stubMemoryApi.ts` implementing the `MemoryApi` interface with the real semantics; unit tests for the semantics.

### Step C — Screens
- [ ] C1. Home: sample picker (12 samples), upload with limits copy (10 MB, 30 pages per scan, `.htm/.html/.pdf/.docx/.jpg/.jpeg/.png`), firm picker (alias-resolving combobox; free text rejected; "Other / no firm" allowed with "memory not applied" message), fund name, version label; privacy notice before first upload and before AI use with retention values from `limits.ts`; AI switch (state stored; effect wired in P05).
- [ ] C2. Processing stage stepper with named stages and the partial-failure state; allowance slot placeholder.
- [ ] C3. Review workspace to mockup: top bar, tabs, document pane with highlight, findings panel (TanStack Table), filters/sort/counts (persist), finding card (class, severity icon+word, quote with location, detector rule id or model+fresh/cache, confidence, expected-vs-found), actions (Accept, Needs counsel, Dismiss reason picker, Edit text/severity), undo toast, label chips, Previously handled, gate pill + popover.
- [ ] C4. Structure tab + outline rail (AC17 view).
- [ ] C5. Reveal control for masked sensitive values (default masked in list and document).
- [ ] C6. Keyboard: J/K, Enter/Esc, visible focus, ARIA roles for list/dialog/popover; severity never by color alone.

### Step D — Tests
- [ ] D1. Playwright specs per Test Gates (run against `vite preview` with the stub API; no Worker needed except `slice` which runs on `pnpm dev:stack` after Phase 04a).
- [ ] D2. `hostile-html.spec.ts`: upload an HTML with `<script>`, `onerror`, `<iframe>`, external `<img>`; assert no script ran (sentinel), no request to a non-local host (route interception), content shown as text.
- [ ] D3. `a11y-smoke.spec.ts`: axe on home and review screens (full a11y sign-off is Phase 10).

### Step E — Visual check vs mockup
- [ ] E1. Screenshot review at 1440 and 1024 widths; compare layout, tokens, type scale, spacing against the mockup; apply `design-taste-frontend` `references/tells.md`/`critique.md` as a checklist only; record deviations and reasons in the report (agent-probe).
- [ ] E2. Raise selects to 16 px under 900 px (mockup note 4); keep outline rail with blocking counts (mockup open question 3 default: keep).
- [ ] E3. UPDATE PROCESS action: record approved tokens in `process/context/ui/all-ui.md` (Artifacts section) at closeout.

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| unit | `pnpm --filter @aduin/web test` | Fully-Automated | stub API semantics, retention purge |
| sample picker | `pnpm --filter @aduin/web test:e2e -- sample-picker-smoke` | Fully-Automated | AC2 |
| stages | `pnpm --filter @aduin/web test:e2e -- status-stages` | Fully-Automated | AC3 |
| highlight/filter/triage | `pnpm --filter @aduin/web test:e2e -- finding-highlight filter-sort triage-actions dismiss-requires-reason` | Fully-Automated | AC4, AC5, AC6 |
| upload/privacy/firm | `pnpm --filter @aduin/web test:e2e -- upload-limits privacy-notice upload-firm-tagging` | Fully-Automated | AC37, AC38, AC41 |
| previously handled | `pnpm --filter @aduin/web test:e2e -- previously-handled-section` | Fully-Automated | AC49 |
| structure view | `pnpm --filter @aduin/web test:e2e -- structure-view` | Fully-Automated | AC17 (view) |
| hostile html | `pnpm --filter @aduin/web test:e2e -- hostile-html` | Fully-Automated | AC39 (client part) |
| tokens | `pnpm --filter @aduin/web test -- tokens-match-mockup` | Fully-Automated | mockup fidelity (tokens) |
| a11y smoke | `pnpm --filter @aduin/web test:a11y` | Hybrid (automated scan; manual keyboard pass in P10) | AC30 (interim) |
| visual vs mockup | screenshots + checklist | Agent-Probe | mockup fidelity (layout) |
| regression | `pnpm --filter @aduin/core test:golden && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | Phase 01/00 intact |

Failing stubs for red-first: `should refuse to dismiss without a reason and show the message`, `should keep filter state after reload`, `should highlight the quote of the selected finding`, `should render hostile html as inert text`, `should keep the gate Blocked after Accept on a critical finding`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `sample-picker-smoke` | Fully-Automated | AC2 |
| `status-stages-and-partial-failure` | Fully-Automated | AC3 |
| `finding-highlight-e2e` | Fully-Automated | AC4 |
| `filter-sort-e2e` | Fully-Automated | AC5 |
| `triage-actions-persist-e2e`, `dismiss-requires-reason-e2e` | Fully-Automated | AC6 |
| `upload-limits-e2e` | Fully-Automated | AC37 |
| `privacy-notice-and-ai-toggle-e2e`, retention purge | Fully-Automated | AC38 |
| `upload-firm-tagging-e2e` | Fully-Automated | AC41 |
| `previously-handled-section-e2e` | Fully-Automated | AC49 |
| `structure-view-e2e` | Fully-Automated | AC17 (view) |
| Visual check vs mockup | Agent-Probe | none directly (supports AC30 and UI quality); residual: no pixel-diff oracle |

```bash
pnpm --filter @aduin/web test && pnpm --filter @aduin/web test:e2e && pnpm --filter @aduin/web test:a11y
# Expected: all exit 0
```

## Exit Gate

- All gates green; screenshots recorded in the report; `tokens-match-mockup` green.
- Real findings visible: opening sample #1 shows the "this Section 11" finding highlighted in the document (M1 check completes with Phase 04a's `pnpm slice:check`).
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
- Validate-contract status: pending
- Next Step: after Phase 01 is verified, spawn vc-research-agent (read the Phase 01 report, mockup, all-ui.md). Next phase: Phase 04a (thin Worker) to complete Milestone 1.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
