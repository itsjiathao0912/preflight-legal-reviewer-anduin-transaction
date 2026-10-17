# Status

As of 17 Oct 2026 (`main` at `a8dbd4b`): Phases 00-09 and 08b are code-complete. The live site runs without its database, so shared memory and fresh AI or OCR on uploads are closed there. Phase 10 (real D1, Turnstile, headers, deploy guide, demo materials) is next.

Status key: **Built / Partial / Planned / Not live yet**.

## Status by area

| Area | Status | Notes |
|---|---|---|
| Format adapters (HTML, text PDF, DOCX, OCR JSON) | Built | |
| Structurer and logic graph | Built | |
| Deterministic detectors | Partial | 13 detectors built; missing-target cross-reference detector deferred (feasibility inconclusive) |
| Review and triage (W2) | Built | Edit of finding text or severity not built (backlog B-EDIT) |
| Open a document (W1) | Partial | Interim open dialog built; full `#documents` screen is still a placeholder route |
| AI lane (W3) | Built | Live uploads closed (no D1, no Turnstile) |
| Counsel sheet, gate, DOCX export (W4) | Built | Live AI draft quality not measured |
| Compare versions (W5) | Built | No compare for scanned documents; diff-only rows cannot become counsel questions |
| Structure and investor types (W6) | Built | |
| Logic outline JSON export | Built | |
| Firm memory UI, rules, audit (W7) | Built | Needs D1 live |
| Demo sandbox (W8) | Partial | Built and tested locally; Not live yet |
| Memory API (19 routes) and D1 schema (20 tables) | Built | Not live yet: not applied remotely |
| AI/OCR proxy, limits, spend ledger | Built | Needs D1 for quotas and cache |
| Turnstile | Partial | Worker verify built; widget and secret are Phase 10 |
| CSP and security headers | Planned | Phase 10 |
| CI pipeline | Planned | None today; every gate runs locally |
| Deploy guide, README, demo video, slides | Planned | Phase 10 |

## Live deployment

URL: `https://aduin-transaction-web.giathaowork.workers.dev` (Worker `aduin-transaction-web`, `*.workers.dev` only). Active version `4325e4e4-9aca-4ae8-8985-cc0b73097c3e`, built from commit `2de6749` (Phase 08b).

The deployed Worker has **no D1 binding and no Turnstile secret**. The committed `wrangler.jsonc` still holds a placeholder all-zero database id, so the deploy used a generated config without the D1 section.

| Works on the live site now | Closed on the live site now |
|---|---|
| Opening the 12 HTML samples and the 22-page scan set | Shared firm memory and the demo sandbox (`/api/session` and memory routes answer `memory_unavailable`) |
| Precomputed AI results for samples (zero upstream calls) | Fresh AI on uploads (`/api/ai` fails closed) |
| Precomputed OCR for the scan set | Fresh OCR on uploaded scans (`/api/ocr` fails closed) |
| All deterministic review, structure, investor paths | Server-side quota (`/api/quota` answers `global_ok:false`) |
| Compare versions, counsel drafts from templates, DOCX export | Turnstile bot check |
| Logic outline export, local triage and gate | |
| `/api/health` | |

Live smoke checks from the last deploy: `/` returns 200, `/api/health` ok, the stack Playwright slice passes, the memory page shows its empty state, and zero upstream AI or OCR calls were made.

## What Phase 10 adds

Plan: [Phase 10](../../process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-10-deploy-final_PLAN_17-10-26.md).

| Item | Result |
|---|---|
| Real D1 `aduin-transaction-db` | Migrations 0001-0005 applied remotely; demo seed loaded; real id recorded in `wrangler.jsonc` |
| Turnstile | Widget loader in the app, secret via `wrangler secret put` |
| Security headers and CSP | `_headers` file, verified with zero violations in tests |
| `/api/health` | `no-store` header |
| Live probes | Rows written per day on D1, Worker timing at 10,000 output tokens, header check, quota conformance |
| Quality sweep | One capped live pass over judgment, drift narrative, counsel draft and OCR |
| Accessibility | Fixes for the remaining serious axe items; keyboard test |
| Deliverables | Root README, [DEPLOY.md](../DEPLOY.md), [demo materials](../demo/) |

`docs/DEPLOY.md` and `docs/demo/` are added at final deploy and may not exist yet.

## Known gaps and backlog

| Gap | Where tracked |
|---|---|
| Missing-target cross-reference detector deferred (feasibility inconclusive) | `process/general-plans/backlog/missing-target-xref_17-10-26/` |
| `#documents` screen is a placeholder | Phase 10 and UI notes |
| Edit finding text or severity (B-EDIT) | `process/general-plans/backlog/b-edit_17-10-26/` |
| Diff-only rows cannot become counsel questions | Backlog (version drift questions) |
| No compare for scanned documents | `process/general-plans/backlog/compare-ocr-documents_NOTE_17-10-26.md` |
| OCR ground truth was transcribed by an agent, not a person | `process/general-plans/backlog/ocr-confidence-calibration_NOTE_17-10-26.md` |
| Live OCR confidence is flat (0.95) | same note |
| Live quality of AI counsel drafts and drift summaries untested | `process/general-plans/backlog/drift-narrative-live-quality_NOTE_17-10-26.md` |
| Investor-path detectors lack a human-checked ground truth | `process/general-plans/backlog/investor-path-ground-truth_NOTE_17-10-26.md` |
| D1 daily write capacity must be re-measured remotely | Phase 10 probe |
| Memory page polish items (P8b-1 to P8b-6) | `process/general-plans/backlog/core-followups_17-10-26/` |
| No CI; gates run locally | Planned |

## Test counts

Source: the "Current Execution State" section of the [umbrella plan](../../process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md), recording the closeout runs of Phase 08 and 08b. They were not re-run for this document.

| Suite | Count | Run |
|---|---|---|
| Core (Vitest) | 2,914 | Phase 08b closeout |
| Worker (Vitest, local D1) | 525 | Phase 08 serial run (not repeated in 08b notes) |
| Web unit (Vitest) | 196 | Phase 08b closeout |
| Playwright end-to-end (preview project) | 157, plus 1 opt-in skipped | Phase 08b closeout |
| Stack-memory e2e (Worker plus local D1) | 10 | Phase 08b closeout |

Other gates recorded green at that closeout: typecheck, lint, `guard:cf`, `secrets:scan`, `slice:check`, `seed:check`. There is no CI workflow; run them with the root scripts in [package.json](../../package.json).

Spend on AI to date: $0 (free models only).

## Related

- [README.md](README.md): architecture overview
- [decisions.md](decisions.md): ADR-8 explains why uploads fail closed today
- [components.md](components.md): per-component status
- [docs/README.md](../README.md): start here
