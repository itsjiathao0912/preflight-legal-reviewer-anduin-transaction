---
name: plan:subdoc-qa-mvp-phase-08-counsel-gate-memory
description: "Sub-doc QA MVP — Phase 08: counsel query sheet, answers, strict gate with re-confirm, DOCX export, real memory write-back, delivery metrics, audit viewer"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-08
---

# Phase 08 — Counsel Sheet, Gate, DOCX Export, Memory Write-Back, Metrics

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08-counsel-gate-memory_REPORT_17-10-26.md

---

## Overview

Closes the analyst loop and makes memory real end to end. Core gets the counsel-sheet builder (New and Accepted needs-counsel only; Already answered and Awaiting counsel excluded; `unclear` returns as New), a template draft (no-LLM) and the AI draft through the Phase 05 task, the strict **gate** (pure function, all state combinations), and the DOCX export (`docx`, lazy-loaded, verified by parsing the output back). The web replaces the Phase 03 stub memory API with the real Worker client (Phase 04b endpoints), adds the outbox with "unsynced"/"Memory unavailable" states, the counsel sheet screen, answer recording (A/B/C/unclear + note), the gate pill states incl. `Dismissed in [fund], re-confirm`, the delivery metrics panel (defects before build, questions batched, time to exportable sheet) and a minimal **audit trail viewer**. Context routers: `process/context/all-context.md`, `process/context/product-domain.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`; memory rules: DATA-MODEL sections 2.3 and 4.

Confirmed decisions in force: Accept on a digitization-blocking finding keeps the gate **Blocked until counsel answers**; AC22 states unresolved = open, unanswered, `unclear`, Awaiting counsel, or unconfirmed `dismissed_reconfirm`. UI contract: the counsel sheet and audit viewer have no approved mockup; Step A0 produces `design/mockups/counsel-sheet.html` (sheet list, wording editor, A/B/C answer controls, gate banner) reusing Phase 03 tokens, self-reviewed (minimalist-ui, tells checklist).

## Phase Completion Rules

- CODE DONE = core, web, integration tests committed.
- VERIFIED = Exit Gate green against the **real local Worker** (no stub), validate-contract written, regression: Phases 01–07 key suites green. Real-D1 behavior is proven locally under pool-workers; the deployed check is Phase 10.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC20 | Counsel sheet drafted and editable; no-AI template draft; AI draft recorded/cached; excludes Already answered/Awaiting counsel | `counsel-sheet-draft-edit-e2e` (both modes) | Fully-Automated (no-LLM) + Hybrid (AI draft) | — |
| AC21 | DOCX export has every question, citation, interpretation; recorded answers (A/B/C, note, who, when) shown; recording sets Answered and writes memory; sheet contains only New and Accepted | `counsel-export-contents` (parse DOCX back) + `counsel-answer-record-e2e` | Fully-Automated | — |
| AC22 | Gate strict: Blocked with linked reasons while any critical item unresolved; Ready only when all resolved | `gate-state-matrix` (all combinations) + `gate-e2e` | Fully-Automated | — |
| AC25 | No-LLM mode complete: every sample processes; structure, findings, diff, template counsel sheet, gate work; zero uncaught errors | `no-llm-full-corpus-run` (all samples; scans open as page images) | Fully-Automated | final run in P10 |
| AC44 | Finding dismissed at fund I appears in "Previously handled (n)" for identical passage at fund II, with reason and fund I name | `memory-no-reflag-e2e` | Fully-Automated | — |
| AC45 | Counsel answered at fund I → fund II shows Already answered with prior answer; not in exported sheet; Awaiting counsel also not re-sent | `memory-prior-answer-not-reasked-e2e` (parse DOCX: zero repeated questions) | Fully-Automated | — |
| AC48 | Blocking defects never hidden: stays in main list labeled "Dismissed in [old fund], re-confirm"; gate unresolved until re-confirmed | `memory-blocking-never-hidden-e2e` + `gate-with-reconfirm-state` | Fully-Automated | — |
| AC64 | Per-document metrics: defects before build, questions batched (target one round), time upload → exportable sheet | `document-metrics-panel-e2e` | Fully-Automated | — |

Closing verification for: AC6 (real API persistence), AC43 (integrated), AC46 (`memory-edit-is-new-e2e`), AC47 (browser `memory-no-cross-firm-or-workspace-e2e`), AC49 (real data), AC55 (`audit-trail-append-only-e2e` via viewer), AC56 (`sandbox-isolation-e2e` two browser contexts), AC57 (`demo-workspace-seeded-effects-e2e`, `demo-workspace-not-polluted-e2e`), AC59/AC60 interim runs (final in P10).

## Entry Gate

- Phases 03, 04b, 05, 07 verified (Phase 02 fixtures: fund I/II/Y, demo seed spec).
- Demo seed regenerated from `fixtures/memory/demo-seed-spec.json` (`pnpm seed:gen && pnpm seed:check`).

## Library pins (confirm via vc-docs-seeker in Phase 00)

docx (`Document`, `Packer.toBlob`/`toBuffer`, tables, numbering), mammoth (`extractRawText`, used to parse the exported DOCX back in tests), Dexie, Zustand, TanStack Table, Playwright (multiple browser contexts), zod.

## Touchpoints (create/modify)

```
packages/core/src/counsel/{sheet.ts,template-draft.ts,gate.ts,metrics.ts,export-docx.ts (lazy import),types.ts}
packages/core/src/llm/tasks/counsel-draft usage only (task defined in P05)
packages/core/src/index.ts                      (append)
packages/core/test/{unit,property}/counsel/**   gate-state-matrix, sheet-contents, metrics
apps/web/src/api/{realMemoryApi.ts,outbox.ts}   real client (replaces stub via config), idempotent client_op_id outbox   [P03 files extended]
apps/web/src/features/counsel/**                counsel sheet screen, editor, answer controls, export button
apps/web/src/features/gate/**                   gate pill/popover states (extends P03 gate), re-confirm flow
apps/web/src/features/metrics/**                metrics panel
apps/web/src/features/audit/**                  read-only audit trail list
apps/web/e2e/{counsel-sheet,counsel-export,counsel-answer,gate,memory-no-reflag,memory-prior-answer,memory-edit-is-new,memory-blocking-never-hidden,memory-no-cross-firm,sandbox-isolation,demo-workspace,audit-trail,metrics,no-llm-corpus}.spec.ts
apps/worker/test/integration/**                 Playwright webServer config uses `pnpm dev:stack` with seeded local D1 (script `scripts/src/dev-seed.ts`)
scripts/src/dev-seed.ts                         applies migrations + demo seed to the local dev D1
design/mockups/counsel-sheet.html
```
Edits to Phase 03/04b-owned files are limited to wiring the real API (config switch) and documented in the report.

## Public Contracts

- `computeGate(findings, states, labels) → {status: 'ready'|'blocked', reasons: [{findingKey, kind: open|unanswered|unclear|awaiting_counsel|reconfirm_required, link}]}` is pure and exhaustive; AI-only findings never gate unless promoted by the analyst.
- Sheet inclusion rule: label `new` or (status accepted and needs_counsel); excluded: `already_answered`, `awaiting_counsel`, `previously_dismissed`; `answered/unclear` is New and re-included.
- Answer recording: A/B/C/unclear + note + who + when; writes counsel_answer + superseding `answered` decision in one batch; finding becomes Answered; `unclear` keeps critical items unresolved.
- DOCX content: title, firm/fund/version, one numbered question per finding with clause citation (location + quote), interpretations A/B/C, answer line; answers shown when recorded. Export records `sheet_exported_at` and `sheet_question_count` via `POST /api/runs/:id/export` and an audit row.
- Re-confirm: for a `dismissed_reconfirm` blocking finding the analyst records Accept or Dismiss-with-reason again in the current run; a new decision supersedes the old one and the gate treats it as resolved only after that decision (and counsel answer when Accept).
- Metrics: defects before build = findings with status not dismissed-as-false-alarm at export time (definition recorded in the report); questions batched = sheet question count; time = `sheet_exported_at - document.upload_started_at` (browser clock for the local display, server value recorded).
- Outbox: every mutating call carries `client_op_id`; failures show "unsynced"; lookup failure shows "Memory unavailable" and all findings as New (the safe direction).

## Blast Radius

`packages/core/src/counsel/**`, core tests, `apps/web/src/{api (extension),features/{counsel,gate,metrics,audit}}`, e2e specs, `scripts/src/dev-seed.ts`, `design/mockups/counsel-sheet.html`. Extends (documented) `apps/web/src/features/review/**` for label chips with real data. No Worker code changes expected; any needed fix goes through a contract-change note or a Phase 04b follow-up. Registry `## Phase 08`.

## Data Flow

Review run → findings → fingerprints → `POST /api/memory/lookup` → labels → UI lists; decisions → `POST /api/decisions` (outbox) → D1 batch → audit; counsel sheet builder → draft (template or AI) → analyst edits (drafts in IndexedDB) → export DOCX → `POST /api/runs/:id/export`; answer → `POST /api/counsel/answers` → memory. Next fund from the same firm: lookup returns active decisions → Previously handled / Already answered / Awaiting counsel / reconfirm.

## Failure Modes

Worker unreachable → outbox queue + "unsynced" and "Memory unavailable" (all New); 409 on conflicting decision → UI shows the current decision and refreshes; 422 fingerprint mismatch → hard error logged, finding stays unsaved with message; DOCX generation failure → message, sheet content remains editable; AI draft unavailable → template draft.

## Implementation Checklist

### Step A — Mockup and core
- [ ] A0. `design/mockups/counsel-sheet.html` sketch (tokens reused).
- [ ] A1. `counsel/gate.ts` + `gate-state-matrix` (all state combinations incl. reconfirm and unclear).
- [ ] A2. `counsel/sheet.ts`, `template-draft.ts`, `metrics.ts`; inclusion/exclusion tests.
- [ ] A3. `counsel/export-docx.ts` (lazy-loaded) + `counsel-export-contents` (parse back with mammoth and compare to sheet).

### Step B — Real memory client and outbox
- [ ] B1. `realMemoryApi.ts` implementing the `MemoryApi` interface (same semantics as the stub); config switch `API_MODE=real|stub` (default real in e2e against the Worker, stub kept for offline demo).
- [ ] B2. `outbox.ts`: idempotent retry with `client_op_id`, backoff, "unsynced" count, drain on reconnect; unit tests with a flaky fake.
- [ ] B3. Session bootstrap: analyst-name prompt on first entry → `POST /api/session`; demo seed copy visible; cookie never read by JS.

### Step C — Screens
- [ ] C1. Counsel sheet screen: list of questions with citation and interpretations, wording editor (persist drafts), template/AI toggle (AI via Phase 05 task and provenance chip), export DOCX button.
- [ ] C2. Answer controls (A/B/C/unclear + note); status Answered; prior-answer display for Already answered items in the review list.
- [ ] C3. Gate pill states and popover reasons linked to items; `Dismissed in [fund], re-confirm` flow.
- [ ] C4. Metrics panel; audit trail viewer (read-only list from `GET /api/audit`).
- [ ] C5. Replace stub semantics in e2e: re-run Phase 03 triage/previously-handled specs against the real Worker.

### Step D — Integration e2e (fund I / II / Y)
- [ ] D1. `scripts/src/dev-seed.ts`; Playwright `webServer` starts the dev stack with seeded local D1.
- [ ] D2. Specs: `memory-no-reflag`, `memory-prior-answer-not-reasked` (parse exported DOCX: zero repeated questions), `memory-edit-is-new` (Section 4→5), `memory-blocking-never-hidden`, `memory-no-cross-firm` (firm Y fixture), `sandbox-isolation` (two contexts), `demo-workspace` (seeded effects, not polluted), `audit-trail`, `metrics`, `counsel-*`, `gate`, `no-llm-corpus`.
- [ ] D3. Interim AC59/AC60 run on the fund I/II fixtures (final in Phase 10).

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| gate matrix | `pnpm --filter @aduin/core test -- gate-state-matrix` | Fully-Automated | AC22 |
| sheet/export | `pnpm --filter @aduin/core test -- counsel-export-contents sheet-contents` | Fully-Automated | AC20, AC21, AC45 (exclusion) |
| counsel e2e | `pnpm --filter @aduin/web test:e2e -- counsel-sheet counsel-answer gate` | Fully-Automated + Hybrid (AI draft recorded) | AC20, AC21, AC22 |
| memory e2e | `pnpm --filter @aduin/web test:e2e -- memory-no-reflag memory-prior-answer memory-edit-is-new memory-blocking-never-hidden memory-no-cross-firm` | Fully-Automated | AC44, AC45, AC46, AC47, AC48 |
| sandbox/demo/audit | `pnpm --filter @aduin/web test:e2e -- sandbox-isolation demo-workspace audit-trail` | Fully-Automated | AC56, AC57, AC55 |
| metrics | `pnpm --filter @aduin/web test:e2e -- metrics` | Fully-Automated | AC64 |
| no-LLM corpus | `pnpm --filter @aduin/web test:e2e -- no-llm-corpus` and `pnpm --filter @aduin/core test:corpus` | Fully-Automated | AC25 |
| regression | `pnpm --filter @aduin/core test:golden && pnpm --filter @aduin/worker test && pnpm slice:check && pnpm seed:check && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | earlier phases |

Failing stubs for red-first: `should block the gate after Accept on a critical finding until counsel answers`, `should keep the gate blocked for an unclear answer`, `should exclude already answered and awaiting counsel findings from the sheet`, `should export a docx that contains every question and interpretation`, `should show Previously handled at fund II for a fund I dismissal`, `should show Dismissed in fund I re-confirm for a blocking finding`, `should treat Section 4 changed to Section 5 as new`, `should not apply Firm X decisions to Firm Y`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `counsel-sheet-draft-edit-e2e` | Fully-Automated + Hybrid | AC20 |
| `counsel-export-contents`, `counsel-answer-record-e2e` | Fully-Automated | AC21 |
| `gate-state-matrix`, `gate-e2e` | Fully-Automated | AC22 |
| `no-llm-full-corpus-run` | Fully-Automated | AC25 |
| `memory-no-reflag-e2e` | Fully-Automated | AC44 |
| `memory-prior-answer-not-reasked-e2e` | Fully-Automated | AC45 |
| `memory-blocking-never-hidden-e2e`, `gate-with-reconfirm-state` | Fully-Automated | AC48 |
| `document-metrics-panel-e2e` | Fully-Automated | AC64 |
| `memory-edit-is-new-e2e`, `memory-no-cross-firm-or-workspace-e2e`, `sandbox-isolation-e2e`, `demo-workspace-*-e2e`, `audit-trail-append-only-e2e` | Fully-Automated | AC46, AC47, AC56, AC57, AC55 (closing) |

```bash
pnpm --filter @aduin/core test && pnpm --filter @aduin/web test:e2e && pnpm slice:check
# Expected: all exit 0 against the real local Worker and seeded D1
```

## Exit Gate

- All gates green with `API_MODE=real`; exported DOCX opened and parsed in tests; interim fund I/II results (findings needing action with vs without memory) recorded in the report.
- Phase report written; backlog stubs recorded for any Known-Gap (none may be left as a silent pass).

## Risks and Kill Criteria

- Fund II 50% reduction (AC59) depends on fixtures: if the interim result is < 50%, fix fixtures/memory logic (not thresholds) in this phase.
- D1 write budget (M1): decision batches ~10–12 rows; outbox batching avoids bursts.
- Stub-to-real semantic drift: all Phase 03 specs re-run against the real Worker.
- Schedule: if late, do not cut anything in this phase (all ACs here are P0).

## Cost / Secret Hygiene

AI draft path uses Phase 05 task with recorded responses in CI; any live call needs APPROVED-LIVE (free only); no paid calls; the browser never sees keys; DOCX contains only the analyst's own quotes (≤ 1000 chars each, masked for sensitive values); Cloudflare resources local only here.

## Rollback

`git revert` phase commits; set `API_MODE=stub` to return to Phase 03 behavior; D1 data is local.

## Blockers That Would Justify BLOCKED Status

- A Phase 04b endpoint cannot support a required flow (route a follow-up to 04b with a contract-change note).
- `docx` output cannot be parsed back reliably in tests (then verify structure via XML parts).

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

Signals: S1, S2, S4, S6 (identity/memory), S7 → 5/7 HIGH. Recommended: agent team of 2 (core gate/sheet/export; web screens and integration e2e) sharing a TaskList for the gate/sheet contract; vc-scenario for gate edge cases (reconfirm, unclear, AI-only). Sonnet for research/validation, opus for code execution.

## Test Infra Improvement Notes

(none identified yet) — candidate: Playwright helper for multi-context sessions and DOCX parse.

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-08-counsel-gate-memory_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next Step: after Phases 03, 04b, 05, 07 are verified, spawn vc-research-agent. Next phases: Phase 08b (P1 UI) then Phase 10.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
