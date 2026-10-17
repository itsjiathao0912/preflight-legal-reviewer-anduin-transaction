# Status

As of 17 Oct 2026 (live version `47d98295-c583-4dc0-9f96-f9e161c8cf35`, code `0a67dc4`, rollback `23612b12`): Phases 00-10 are done and the site is live with its real database, Turnstile and an enforced CSP. Demo-readiness fixes are live (see below). A human-operator live AI sweep, the AC51 echo and the D4 burst are still pending.

Status key: **Built / Partial / Planned / Not live yet**. Live in the table means built and running on the deployed Worker.

## Status by area

| Area | Status | Notes |
|---|---|---|
| Format adapters (HTML, text PDF, DOCX, OCR JSON) | Built | |
| Structurer and logic graph | Built | |
| Deterministic detectors | Partial | 13 detectors built; missing-target cross-reference detector deferred (feasibility inconclusive) |
| Review and triage (W2) | Built | Edit of finding text or severity not built (backlog B-EDIT) |
| Open a document (W1) | Partial | Interim open dialog built; full `#documents` screen is still a placeholder route |
| AI lane (W3) | Built | Live on the Worker; live AI sweep pending a human-operator run |
| Counsel sheet, gate, DOCX export (W4) | Built | Live AI draft quality not measured |
| Compare versions (W5) | Built | No compare for scanned documents; diff-only rows cannot become counsel questions |
| Structure and investor types (W6) | Built | |
| Logic outline JSON export | Built | |
| Firm memory UI, rules, audit (W7) | Built | Live on D1 |
| Demo sandbox (W8) | Built | Live. `ws_demo` is Partners Group: 7 decisions plus rule `sr01` (proposed); includes counsel answer A on the two swapped refs (`sd06`, `sd07`) |
| Memory API (19 routes) and D1 schema | Built | Live: real D1 `aduin-transaction-db`, schema 5 |
| AI/OCR proxy, limits, spend ledger | Built | Live with D1 quotas and cache |
| Turnstile | Built | Managed widget live; automated browsers cannot pass it |
| CSP and security headers | Built | Enforced; `style-src 'unsafe-inline'` residual |
| Fund Package Intake | Planned | 4 phases, not live yet. [process/features/fund-package-intake/](../../process/features/fund-package-intake/); fictional demo packages in [samples/packages/](../../samples/packages/) |
| Variance management | Planned | 5 phases, EXECUTE after intake, not live yet. [process/features/variance-management/](../../process/features/variance-management/) |
| CI pipeline | Planned | None today; every gate runs locally |
| Deploy guide, README, demo script and slides | Built | [DEPLOY.md](../DEPLOY.md), root README, [demo](../demo/); 13-memory and 14-audit screenshots need manual capture |

## Live deployment

URL: `https://aduin-transaction-web.giathaowork.workers.dev` (Worker `aduin-transaction-web`, `*.workers.dev` only). Version `47d98295-c583-4dc0-9f96-f9e161c8cf35`, code `0a67dc4` (rollback `23612b12`).

A live probe on 17 Oct 2026: `/` returns 200, `/api/health` returns 200, and `/api/quota` with the `x-aduin-client` header returns `global_ok:true`. Response headers include `content-security-policy` with `script-src 'self' https://challenges.cloudflare.com` and a `style-src 'unsafe-inline'` residual, plus `referrer-policy: no-referrer`.

Behavior on the live site:

- Firm documents render deterministic findings first; memory and AI load in the background.
- Shared firm memory, the demo sandbox, server-side quotas and the AI/OCR proxy run against real D1.
- Bundled samples use precomputed AI and OCR results and make zero upstream calls.
- Live AI/OCR calls to date: 0. AI spend: $0.
- Automated browsers cannot get a Turnstile token, so live AI and OCR from scripts is untested.

## What changed at go-live

Plan: [Phase 10](../../process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-10-deploy-final_PLAN_17-10-26.md).

| Item | Before | Now |
|---|---|---|
| Database | No D1 binding, placeholder id | Real D1 `aduin-transaction-db`, schema 5, demo seed |
| Turnstile | Worker verify only | Managed widget live |
| Headers and CSP | None | CSP enforced, `referrer-policy: no-referrer` |
| Memory and demo sandbox | `memory_unavailable` | Live |
| Quotas | `/api/quota` answered `global_ok:false` | `global_ok:true` |
| Documents | Findings waited on memory | Findings first, memory and AI in the background |
| Deliverables | Planned | Root README, DEPLOY.md, demo materials |

## Demo-readiness fixes (live in `47d98295`, code `0a67dc4`)

- Severity: broken cross-references (`ref-label-coherence`, `ref-this-section`) are critical ("Blocks digitization") when the reference sits in a routing context (the instructions scope, an answer option, or a block holding a conditional); otherwise high. The 4 swapped "Part B" references on samples #3 and #5 are critical; "this Section 11" on #1 stays high. AI findings never gate. Opened without memory, #5 shows "Blocked · 2" (verified live).
- Live seed: `ws_demo` is Partners Group with 7 decisions and rule `sr01` (proposed). The old Firm X / Firm Y data was removed from `ws_demo` only. The seed holds counsel answer A on the two swapped refs (`sd06`, `sd07`), so in a memory-enabled session #3 and #5 show them as "Already answered" and the gate is Ready. To demo Blocked, open #5 without memory, or Reopen `sd06`/`sd07` in Firm memory with a reason; they return as New and block.
- The gate pill shows a neutral "No document" when nothing is open.
- Finding titles no longer contain "(fit ...)".
- Compare's disabled Needs counsel text: "Only changes linked to a finding in the open document can be sent to counsel."

## Known gaps and backlog

| Gap | Where tracked |
|---|---|
| Live AI sweep, the AC51 echo and the D4 burst (rows_written under load) pending a human-operator run | Phase 10 closeout |
| Worker CPU p99 16 ms observed (0 errors), above the 10 ms Free-plan figure | Phase 10 closeout |
| `style-src 'unsafe-inline'` residual (Radix) | Phase 10 closeout |
| 13-memory and 14-audit screenshots need manual capture | `docs/demo/` |
| Missing-target cross-reference detector deferred (feasibility inconclusive) | `process/general-plans/backlog/missing-target-xref_17-10-26/` |
| `#documents` screen is a placeholder | UI notes |
| Edit finding text or severity (B-EDIT) | `process/general-plans/backlog/b-edit_17-10-26/` |
| Diff-only rows cannot become counsel questions | Backlog (version drift questions) |
| No compare for scanned documents | `process/general-plans/backlog/compare-ocr-documents_NOTE_17-10-26.md` |
| OCR ground truth was transcribed by an agent, not a person | `process/general-plans/backlog/ocr-confidence-calibration_NOTE_17-10-26.md` |
| Live OCR confidence is flat (0.95) | same note |
| Live quality of AI counsel drafts and drift summaries untested | `process/general-plans/backlog/drift-narrative-live-quality_NOTE_17-10-26.md` |
| Investor-path detectors lack a human-checked ground truth | `process/general-plans/backlog/investor-path-ground-truth_NOTE_17-10-26.md` |
| Memory page polish items (P8b-1 to P8b-6) | `process/general-plans/backlog/core-followups_17-10-26/` |
| Headings such as "Section N." / "Article I." and Annex / Question conditional targets are not resolved | Planned in Fund Package Intake Phase 1 |
| No CI; gates run locally | Planned |

## Test counts

Source: the demo-readiness build session (17 Oct 2026). Not re-run for this document. Total 3,997 plus 1 opt-in skip.

| Suite | Count |
|---|---|
| Core (Vitest) | 2,914 |
| Worker (Vitest, local D1) | 525 |
| Web unit (Vitest) | 226 |
| Scripts | 152 |
| Playwright end-to-end (preview project) | 175, plus 1 opt-in skipped |
| Stack-memory e2e (Worker plus local D1) | 10 |

Performance: largest sample 169 ms, a ~50 KB sample 104 ms. There is no CI workflow; run the gates with the root scripts in [package.json](../../package.json).

Spend on AI to date: $0 (free models only).

## Related

- [README.md](README.md): architecture overview
- [decisions.md](decisions.md): ADR-8 explains why uploads fail closed without D1 or Turnstile
- [components.md](components.md): per-component status
- [docs/README.md](../README.md): start here
