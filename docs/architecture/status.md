# Status

As of 18 Oct 2026 (live version `493f2501-8920-43b5-95fd-e0878877ab1f`, code `b00241f`; Variance first live in `d9aaddd9`): Phases 00-10, Fund Package Intake, Variance Management and the Findings v2 redesign are done and the site is live with its real database (schema 6), Turnstile and an enforced CSP. Variance lives inside the existing Findings and Questions screens; no new screen. Live AI review works end to end but is slow (about 3-4 minutes), so demo with No AI or precomputed samples. A human-operator live AI sweep, the AC51 echo, the D4 burst and the live Variance write path are still pending.

Status key: **Built / Partial / Planned / Not live yet**. Live in the table means built and running on the deployed Worker.

## Status by area

| Area | Status | Notes |
|---|---|---|
| Format adapters (HTML, text PDF, DOCX, OCR JSON) | Built | |
| Structurer and logic graph | Built | |
| Deterministic detectors | Partial | 13 detectors built; missing-target cross-reference detector deferred (feasibility inconclusive) |
| Review and triage (W2) | Built | Edit of finding text or severity not built (backlog B-EDIT) |
| Open a document or package (W1) | Partial | Upload takes many files (12 files, 40 MB, 10 MB each) and shows a type and role confirmation table; interim open dialog built; full `#documents` screen is still a placeholder route |
| AI lane (W3) | Built | Live on the Worker; live AI sweep pending a human-operator run |
| Questions (was Counsel questions), gate, DOCX export (W4) | Built | Owner tabs Counsel / GP / Fund admin with per-owner export; answers carry intent and scope; live AI draft quality not measured |
| Compare versions (W5) | Built | No compare for scanned documents; diff-only rows cannot become counsel questions |
| Structure and investor types (W6) | Built | |
| Logic outline JSON export | Built | |
| Firm memory UI, rules, audit (W7) | Built | Live on D1 |
| Demo sandbox (W8) | Built | Live. `ws_demo` is Partners Group: 7 decisions plus rule `sr01` (proposed); includes counsel answer A on the two swapped refs (`sd06`, `sd07`) |
| Memory API (19 routes) and D1 schema | Built | Live: real D1 `aduin-transaction-db`, schema 6 (migration 0006) |
| AI/OCR proxy, limits, spend ledger | Built | Live with D1 quotas and cache |
| Turnstile | Built | Managed widget live; automated browsers cannot pass it |
| CSP and security headers | Built | Enforced; `style-src 'unsafe-inline'` residual |
| Fund Package Intake | Built; live | 4 phases, 20 of 20 acceptance criteria met by passing automated gates (3 with a gap note). Multi-file upload with confirmation table, Package lens in Structure, coverage line in the Findings header and gate popover, "For the GP" group plus request DOCX, browser-only storage (24 h, restored on reload). No new screens, no new Worker route, no D1 change, no LLM task (0 live model calls, $0). Gaps: see Known gaps. [process/features/fund-package-intake/](../../process/features/fund-package-intake/); demo inputs in [samples/packages/](../../samples/packages/) |
| Variance management | Built; live | 5 phases, all acceptance criteria AC-V1 to AC-V20 met by passing automated gates; live write path of AC-V14/V16 is an operator residual. Changes segment in Findings (baseline from the same firm only, cosmetic changes hidden and grouped, impact lines from the logic graph, owner chip), owner tabs in Questions, answer intent and scope, R-01 regression check, gate counts changes. 13 detectors and 15 issue classes unchanged (uses `version_drift`). 0 LLM calls. [process/features/variance-management/](../../process/features/variance-management/) |
| Findings v2 redesign | Built; live | Findings screen rebuilt from the approved mockup [design/mockups/findings-v2.html](../../design/mockups/findings-v2.html): wide resizable panel, accordion rows, To review / Sent to counsel / Closed groups with progress, one sticky Ask counsel / Close issue bar with a reason modal, outcome toast with Undo, J/K/C/X shortcuts, document zoom with Fit width (text never below 85%; the page reflows when narrow). Backlog: header status chips instead of the two banners, Flag passage / Suggest wording. [process/features/findings-v2/](../../process/features/findings-v2/) |
| CI pipeline | Planned | None today; every gate runs locally |
| Deploy guide, README, demo script and slides | Built | [DEPLOY.md](../DEPLOY.md), root README, [demo](../demo/); 13-memory and 14-audit screenshots need manual capture |

## Live deployment

URL: `https://aduin-transaction-web.giathaowork.workers.dev` (Worker `aduin-transaction-web`, `*.workers.dev` only). Version `493f2501-8920-43b5-95fd-e0878877ab1f` (Findings v2, code `b00241f`). Variance went live in `d9aaddd9-a62f-4850-8ff2-89889c8ef652`, built from `main` at `0c6312e`. D1 migration `0006_variance.sql` is applied (`schema_version` 6). It includes the AI review streaming, idle-timeout and no-duplicate-AI-findings fixes first shipped in `8a82ead2`, and a Preflight rename. Version chain: `493f2501`, `f54aa9f6`, `cd06402a`, `d6f88c56`, `7db9e602`, `d9aaddd9`, `8a82ead2`, `b04f1a8c`, `3d2c7301`, `cde74507`, `328ca295`, `09e7a579`, `47d98295`, `23612b12`.

**Rollback caveat:** after migration 0006, `8a82ead2` refuses memory writes because it pins schema 5. A rollback therefore means rolling forward to a fixed build or restoring D1 (Time Travel); `b04f1a8c` and older have the same limit.

A live probe on 17 Oct 2026 (before Variance): `/` returns 200, `/api/health` returns 200, and `/api/quota` with the `x-aduin-client` header returns `global_ok:true`. Response headers include `content-security-policy` with `script-src 'self' https://challenges.cloudflare.com` and a `style-src 'unsafe-inline'` residual, plus `referrer-policy: no-referrer`.

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
| Database | No D1 binding, placeholder id | Real D1 `aduin-transaction-db`, schema 5, demo seed (schema 6 since Variance, 18 Oct) |
| Turnstile | Worker verify only | Managed widget live |
| Headers and CSP | None | CSP enforced, `referrer-policy: no-referrer` |
| Memory and demo sandbox | `memory_unavailable` | Live |
| Quotas | `/api/quota` answered `global_ok:false` | `global_ok:true` |
| Documents | Findings waited on memory | Findings first, memory and AI in the background |
| Deliverables | Planned | Root README, DEPLOY.md, demo materials |

## What version d9aaddd9 adds (Variance Management)

All inside existing screens. No new screen, no new sidebar item.

- **Firms:** the memory now has Hartwell & Crane LLP (aliases Hartwell & Crane, HC LLP, H&C), Ostrander Pell LLP and Calder Reyes. Sutter Lane & Abernathy is not seeded.
- **Demo packages:** 01 Northgate is tagged Hartwell & Crane, 02 Lotus Bay is tagged Ostrander Pell, 03 Redwood Ridge has no firm (first review).
- **Findings, Changes segment:** change rows and a "vs <baseline>" control limited to the same firm. Picker samples never act as a baseline. Cosmetic changes are hidden and grouped (demo: 214 raw changes shown as 7: 3 new + 4 logic). Impact lines come from the logic graph. Each row has an owner chip (Counsel, GP, Fund admin).
- **Questions (renamed from Counsel questions):** owner tabs Counsel / GP / Fund admin with per-owner export. The answer dialog records intent and scope. A firm-template answer such as "Appendix C must exist" creates an R-01 regression check; a later fund without it shows "Regression: confirmed in Fund II".
- **Gate:** still two-state (Blocked / Ready); it counts changes, regressions and unanswered owner questions.
- **Cost:** Variance makes 0 LLM calls. Still 13 detectors and 15 issue classes; variance adds no class (it uses `version_drift`).
- **Demo path:** upload Fund II, then Fund III, with firm Hartwell & Crane. Steps in the [Vietnamese walkthrough](../walkthrough/demo-walkthrough.vi.md).

## What version 3d2c7301 adds (Fund Package Intake)

- Upload modal takes many files and shows a confirmation table (type, role, high or low confidence, reason). Run checks stays disabled until the low-confidence rows are confirmed. The baseline is chosen with the role select (same firm only).
- A high-confidence subscription agreement uploaded alone opens as a one-document package with coverage. Bundled samples show no package UI.
- Structure has a "Package" lens: documents, external references (Resolved, Not in package, Needs confirmation), cross-document terms ("Defined in LPA", "Unverified") and coverage per check group.
- A coverage line appears in the Findings header and the gate popover. A missing subscription agreement blocks the gate; a missing LPA or PPM only warns (the policy is data).
- Questions (then called Counsel questions) has a "For the GP" group, one item per missing document with its quote, and one request DOCX.
- The structurer reads "Section N." and "Article I." headings; `broken-conditional` resolves Annex X and Question N targets. Redwood Ridge I now catches "skip to Question 15" (F1).
- Live checks on the demo packages: Northgate III shows 7 GP items matching the expected list, and its document 01 has 7 findings. The live package smoke passes 8 of 8 checks and runs to findings in about 229 ms.
- Counts wording: 13 detectors and 15 issue classes, plus package-level checks (references, cross-document terms, coverage).

## What version cde74507 adds (code `1f5cfa5` + `994ea54`)

- Worker AI upstream timeout raised from 120 s to 240 s (`994ea54`): a live AI review now works end to end (4 AI findings in about 199 s). No Intake commits are live.
- Carried from 328ca295 (code `1f5cfa5`): worker AI redirect fix, so live AI reaches OpenRouter.
- `ref-label-coherence` label-window fix.
- Phone 375 px layout, dialog outside-click and upload-error fixes.
- No-text documents are never "Ready to digitize"; the last document is restored after reload.
- Intake Phase 1 core: "Section N." and "Article" headings are detected, and Annex X / Question N conditional targets are resolved (this also makes package 01 D6 caught, commit 28fe3d4). Core only; the UI is not wired yet.

## Demo-readiness fixes (live since `47d98295`, code `0a67dc4`)

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
| Headings such as "Section N." / "Article I." and Annex / Question conditional targets | Fixed in core and wired in the UI (Intake, live 3d2c7301); packages 02 and 03 re-measured, see [samples/packages/README.md](../../samples/packages/README.md) |
| Intake: Lotus Bay II yields 2 of 3 GP requests ("US Feeder Subscription Agreement" not extracted) | `process/features/fund-package-intake/backlog/` |
| Intake term misses: Excused Investor, Key Person Event, Plan Assets, Significant Participation, Hurdle Amount; some proper nouns listed as unverified | same folder |
| Intake: Schedule and Exhibit targets and dash-style headings are not handled | same folder |
| Intake: the package Blocked path (no subscription agreement) is proven by unit tests only | same folder |
| Intake: two subscription agreements in one package always need the analyst to pick roles | By design |
| Intake: the AI document-type suggester is a seam only (no model task ships) | same folder |
| Intake: bundle grew by about 270 kB; Package lens has 1 serious contrast item and 4 label mismatches (axe) | same folder |
| Intake operator residuals: live AI/OCR on packages, real-session memory writes, a manual keyboard pass | `intake-operator-live-sweep` stub; 12 backlog stubs in total |
| Variance: live probe re-run deferred | Variance program report |
| Variance: live R-01 write path is an operator run (needs a human Turnstile session) | Variance program report |
| Variance: no manual keyboard pass | Variance program report |
| Variance: package 01 shows 9 change rows (2 new + 7 logic), not the answer key's 3 + 4, because digit changes in operative text count as logic | Variance program report |
| Variance: V7 trust-split change is owned by the GP (SPEC A9); the answer key says Counsel | Variance program report |
| Variance: fund-scoped answers can supersede across funds | Variance program report |
| Variance: the change chip overlaps the row title | UI note |
| Rollback after 0006: `8a82ead2` refuses memory writes (pins schema 5); roll forward or restore D1 | Live deployment above |
| Live AI is slow: a fresh review takes about 3-4 minutes (free model, 100-157 s of reasoning) | Known; timeout raised to 240 s, so it completes |
| No CI; gates run locally | Planned |

## Test counts (Variance, at `0c6312e`)

| Suite | After Variance |
|---|---|
| Core (Vitest) | 3,190 (plus 3 opt-in skips) |
| Worker (Vitest, local D1) | 608 |
| Web unit (Vitest) | 518 |
| Playwright preview e2e | 242 (plus 1 opt-in skip) |
| Stack-memory e2e | 12 |
| Scripts | 183 |

Total 4,753. Source: the Variance program report (`process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp_REPORT_17-10-26.md`). The table below is the earlier Fund Package Intake record.

### Earlier counts (Fund Package Intake)

Source: the Fund Package Intake program report (`process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_REPORT_17-10-26.md`), as reported to this session; not re-run for this document. Total of the six suites below: 4,298.

| Suite | Before Intake | After Intake |
|---|---|---|
| Core (Vitest) | 2,914 | 3,084 (plus 3 opt-in skips) |
| Worker (Vitest, local D1) | 526 | 526 |
| Web unit (Vitest) | 226 | 298 |
| Playwright preview e2e | 175 | 217 (plus 1 opt-in skip) |
| Stack-memory e2e (Worker plus local D1) | 10 | 11 |
| Scripts | 152 | 162 |

Live smoke on 3d2c7301: health, CSP (byte-identical to `_headers`) and the stack slice pass; the package smoke passes 8 of 8.

Performance: largest sample 169 ms, a ~50 KB sample 104 ms. There is no CI workflow; run the gates with the root scripts in [package.json](../../package.json).

Spend on AI to date: $0 (free models only).

## Related

- [README.md](README.md): architecture overview
- [decisions.md](decisions.md): ADR-8 explains why uploads fail closed without D1 or Turnstile
- [components.md](components.md): per-component status
- [docs/README.md](../README.md): start here
