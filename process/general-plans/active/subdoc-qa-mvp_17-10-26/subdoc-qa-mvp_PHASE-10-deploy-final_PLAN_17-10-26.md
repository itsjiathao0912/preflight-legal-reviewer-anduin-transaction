---
name: plan:subdoc-qa-mvp-phase-10-deploy-final
description: "Sub-doc QA MVP — Phase 10: real D1 + Turnstile + CSP deploy to workers.dev, a11y/perf sign-off, fund II finals, live probes and quality sweep under a capped APPROVED-LIVE block, README/DEPLOY/slides/script/storyboard"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-10
---

# Phase 10 — Deploy, Sign-off, Live Probes, Deliverables

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ✅ PVL PASS (cycle 2 re-validate, 17-10-26); ready for EXECUTE
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PVL PASS (cycle 2); EXECUTE next
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-10-deploy-final_REPORT_17-10-26.md

---

## Inner Loop Refresh Note

Date: 2026-10-17. Inner-loop steps 1-3 (RESEARCH, INNOVATE, PLAN-SUPPLEMENT) ran; this body was rewritten coherently, not patched. Sections changed: Overview, Entry Gate, Acceptance Criteria, Touchpoints, Public Contracts, Blast Radius (now per wave), Data Flow, Failure Modes, Implementation Checklist (new Waves A-D), Test Gates (corrected command forms), Verification Evidence, APPROVED-LIVE cap block (new), Risks, Rollback, Resume handoff. Corrections of stale items: entry gate (08b and 09 are DONE; P6-1 missing-target detector DEFERRED to backlog, feasibility INCONCLUSIVE, so no detector lands and no AI inputHash drift is expected); `precompute:all` does not exist (only `precompute:ai` and `precompute:ocr`); secret name is `COOKIE_SIGNING_KEYS` plus `COOKIE_SIGNING_KID` (already set, never re-put); `--` gate forms and `BASE_URL` replaced by the repo's `SLICE_BASE_URL` rule; schema version is read from `/api/memory/health` (`/api/health` is static); deploy is a two-step (temp config without `d1_databases` until the real id exists); the cron `17 3 * * *` is not relied on; fund-two specs reuse `fixtures/memory/fund-expectations.json`; no slide tool is installed, so slides are self-contained HTML. New scope: CSP and security headers (F10), Turnstile widget plus site key, `/api/health` no-store, a plain web build preflight, rows_written re-measure, AC51 echo probe, live quality sweep, THIRD_PARTY_NOTICES rows, the #memory deep-link demo note (P8b-6). PVL must re-run.

## Overview

Final integration and delivery of the sub-doc QA tool. One Worker (`aduin-transaction-web`: static SPA plus `/api/*`) is already live at `https://aduin-transaction-web.giathaowork.workers.dev` (version 4325e4e4-9aca-4ae8-8985-cc0b73097c3e, code 2de6749). This phase:

1. Ships the last code: Turnstile widget (D1 below), CSP and security headers via `_headers`, `/api/health` no-store, `downloadBlob` revoke delay, a11y fixes, perf, a11y-keyboard and final fund-two specs.
2. Creates the real D1 `aduin-transaction-db`, records its id in `apps/worker/wrangler.jsonc`, applies remote migrations 0001-0005 and the demo seed, creates the Turnstile widget and sets `TURNSTILE_SECRET`, and deploys.
3. Probes the live deployment (headers, health, memory health, stack slice, real-browser Turnstile session, AC40 conformance, AC51 echo, D1 rows_written burst, capped quality sweep with the workerd CPU/duration timing measured on the first counted AI call) and tunes caps if measured.
4. Delivers README.md, docs/DEPLOY.md, docs/demo/{slides.html,script.md,storyboard.md}, screenshots, THIRD_PARTY_NOTICES rows, and the final report.

Context routers: `process/context/all-context.md`, `process/context/worker/all-worker.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`; project rules in `CLAUDE.md`.

Deploy policy (user confirmed): unattended deploys to `*.workers.dev` / `*.pages.dev` only, `aduin-transaction-*` resources only, secrets only via `wrangler secret put`. **Hard stops:** `git push`; any route or custom domain; any touch of the protected Cloudflare zone named in `CLAUDE.md` Project Rules (its name and id must never appear in repo text, since `pnpm guard:cf` fails on them); any paid call; any non-`aduin-transaction-*` resource name; any prompt change. Marketing surfaces (README, slides) use `design-taste-frontend`; app screens never do.

## Phase Completion Rules

- CODE DONE = code, specs and docs committed; local gates green.
- VERIFIED = Exit Gate green against the live URL, validate-contract written, full regression green, zone-untouched checklist signed. Deliverables are Agent-Probe items recorded with paths; video narration that needs the human is a user action (script and storyboard and screenshots are produced regardless).
- Known-Gap is never a proving strategy; any residual gets a backlog stub and keeps its gate CONDITIONAL.

## Acceptance Criteria

Each row names `proven by` and `strategy`; each gate in Test Gates back-references the AC id.

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC29 | Largest sample (~380 KB) deterministic results < 5 s; ~50 KB < 2 s; 22-page scan set shows per-page progress | `perf-budget-corpus` (e2e `perf-budget.spec.ts`, e2e-mode bundle, Chromium) | Fully-Automated | also bundle-size note (568 kB chunk) |
| AC30 | Keyboard-only triage/filters/gate; visible focus; AA contrast; severity not by color alone; no critical axe violations | `a11y-scan-and-keyboard-e2e` (`a11y-keyboard.spec.ts` + axe on every main screen) plus one recorded manual keyboard pass | Hybrid | fixes: nav label-content-name mismatch, findings scroller focusable, U2 contrast, U3 focus, U4 underline/badge overlap |
| AC31 | Live demo end to end with a sample (no account); README explains reasoning; video script/slides exist; nothing changed in the protected zone | `deployed-smoke-e2e` (`slice.spec.ts` on `--project=stack` against the live URL; `global_ok` check is env-aware) + deliverables checklist + before/after account resource name diff | Fully-Automated (smoke) + Agent-Probe (deliverables, zone-untouched) | |
| AC34 | Bundled samples open with zero AI/OCR calls | `sample-open-zero-llm-calls` (`sample-zero-calls.spec.ts`, all samples) + live zero-upstream check (`wrangler tail` or counter read before and after the smoke) = 0 | Fully-Automated | closing |
| AC25 | No-LLM mode complete over the corpus | `no-llm-full-corpus-run` (`no-llm-corpus.spec.ts`) | Fully-Automated | closing |
| AC39 | Public-endpoint abuse protection | `abuse-protection-matrix` run against the live Worker (reject-before-claim cases only, no AI spend) | Fully-Automated | closing; Turnstile now live |
| AC40 | Within Workers Free limits (10 ms CPU, 50 subrequests, 100k req/day) with no paid feature; exceeding a limit fails safely | `free-plan-limits-conformance` + `limit-exceeded-safe-failure` (live; `wrangler tail` cpuTime/outcome) + workerd CPU/duration measured on the first counted AI call (AC51 on #1) inside `probe:live-ai` via `wrangler tail` (not in `conformance:free-plan`, which makes no AI call) | Fully-Automated + Hybrid (tail precondition) | D4 rows_written re-measure |
| AC51 | Firm rules are context, never a filter | live `rules_hash8` echo probe: add a rule for firm A in `#memory`, run one AI review, assert echoed hash equals hash of active rule texts, second firm does not echo it | Hybrid | closes backlog stub `memory-ui-ai-rules-echo-browser`; counts against the APPROVED-LIVE AI cap |
| AC59 | Fund II fixture shows ≥ 50% fewer findings needing action than without memory | `fund-two-memory-reduction-e2e` (final spec reusing `fixtures/memory/fund-expectations.json`) | Fully-Automated | interim: `memory-prior-answer`, `memory-no-reflag` |
| AC60 | Fund II: 0 of the new defects and the edited passage in Previously handled; 0 already-answered questions in the counsel sheet; blocking dismissals stay in the main list | `fund-two-zero-hidden-zero-repeat-e2e` (final spec; interim `memory-blocking-never-hidden`) | Fully-Automated | |

Closing verification carried (no new code): AC1 (stack smoke), AC7 (schema contract, core tests in regression), AC14 (README states the #9 footnote outcome; soft), AC18 (seeded matrix in regression), AC38 and AC58 (retention stated in notice and README), AC41-AC58 deployed smoke via the stack slice.

## Entry Gate

- Phases 00-07, 08, 08b, 09 DONE (08b at 54ddaae + 2de6749). P6-1 deferred to backlog (no detector, no AI inputHash drift expected; if `precompute:ai --check` reports drift anyway, stop and report).
- Prompts frozen; any prompt change is a stop-and-ask.
- Credentials outside the repo: `~/.config/cloudflare/credentials.env` and `~/.config/openrouter/credentials.env`, loaded only as `set -a; source <file>; set +a # APPROVED:credentials.env`; never printed.
- Live usage so far: AI 3 of 8, OCR 27 of 30, all $0 (see APPROVED-LIVE block for the Phase 10 cap).

## Library pins (confirm via vc-docs-seeker before the step that uses them)

wrangler 4.151 (`d1 create`, `d1 migrations apply --remote`, `d1 execute --remote --file`, `secret put` via stdin, `deploy`, `tail`, `rollback`), Cloudflare Turnstile client API (`turnstile.render`, `execute`, `reset`, `execution: 'execute'`) and widget-create endpoint (`/accounts/{account}/challenges/widgets`), @axe-core/playwright 4.14.0, Playwright 1.64, vite 8 preview, D1 analytics GraphQL (`d1AnalyticsAdaptiveGroups`: rowsWritten). No slide tool is installed: slides are one self-contained HTML file.

## Decisions Adopted (from INNOVATE)

- **D1 Turnstile:** public `VITE_TURNSTILE_SITE_KEY` read at build time; new `apps/web/src/features/ai/turnstile-widget.ts` registers a provider through the existing `setTurnstileProvider`; the script loads lazily on the first token request; managed mode, `execution: 'execute'`, small hidden container; reset after use; unset key means no provider (e2e unchanged). `realMemoryApi` session bootstrap gets the same token hook. `/api/quota` stays frozen v1; no new route.
- **D2 CSP and headers** in `apps/web/public/_headers` (static assets bypass the Worker, `run_worker_first` is `/api/*` only): `default-src 'self'; script-src 'self' https://challenges.cloudflare.com` (`'wasm-unsafe-eval'` only if proven needed; never `unsafe-eval` or `unsafe-inline`); `style-src 'self'; img-src 'self' blob: data:; font-src 'self'; worker-src 'self' blob:; connect-src 'self'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`; plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` denying camera, microphone, geolocation, payment, `Cross-Origin-Opener-Policy: same-origin`. No HSTS. Enforced only after a local report-only trial shows zero violations. Worker: `/api/health` answers `cache-control: no-store` by switching the route line at `apps/worker/src/app.ts:117` to the existing `jsonNoStore` helper (plus one import from `./proxy/errors`) (no wrapper; no nosniff-on-`/api` clause). CSP assertion rule (G6): the headers-file test asserts no `unsafe-eval` anywhere and no `unsafe-inline` in `script-src`/`default-src`; the only allowed evidence-based fallback is `style-src 'self' 'unsafe-inline'` (Radix `react-remove-scroll`/`react-style-singleton` inject a `<style>` element), recorded as a named residual with the trial evidence. `connect-src https://challenges.cloudflare.com` is added only on live evidence after vc-docs-seeker confirms the Turnstile CSP needs.
- **D3 Live-quality sweep** under the APPROVED-LIVE cap block; deterministic or post-processing fixes only.
- **D4 rows_written:** measure-then-tune; if projected > 60k/day lower `SESSION_CAPS.globalPerDay` 300 to 150 and `MEMORY_WRITE_CAPS.rowBudgetPerDay` 30000 to 20000 in `apps/worker/src/platform/index.ts` and redeploy.
- **D5 Deliverables:** README.md, docs/DEPLOY.md, docs/demo/slides.html, docs/demo/script.md, docs/demo/storyboard.md, screenshots in docs/demo/img/ via Playwright against the live URL (read-only, no AI/OCR calls).
- **D6 Scope:** IN a11y fixes for AC30, perf-budget spec, fund-two finals, `/api/health` no-store, `downloadBlob` revoke delay; IN-if-time the bundle split of the 568 kB chunk after the CSP spec is green. OUT (README or backlog): masking, structure icons, O22-O24 rest, B-EDIT, core follow-ups.

## APPROVED-LIVE (cap block for the validate-contract)

- Scope: live free-model calls against the deployed Worker only.
- Cap: at most 6 free AI calls and at most 6 free OCR calls in total for the phase, at most 3 of each per UTC day.
- Models: free models only (the Phase 05/06 configured models); `PAID_FALLBACK_ENABLED=false` stays.
- Planned use: AI = AC51 echo run on #1 (doubles as the #1 judgment), a second rules run on #3, one drift narrative, one counsel draft (4 of 6, timing measured on call 1; 2 spare; day 1 at most 3, day 2 the rest or a backlog stub); OCR = one row-level recheck on one scan page (spare 5).
- Stop immediately on `usage.cost > 0`, any 429 or breaker-open response, or a cap reached. Record every call (task, UTC time, model, cost) in the report.
- Not in the cap: Turnstile verification, deterministic API calls, the D4 burst (memory API and `session_new` only, no upstream calls), screenshots, and the stack slice (zero upstream calls by design).
- Cache-miss rule: force a miss per counted call (a firm rule changes the rules hash) and assert the result is labelled fresh.
- Any prompt change, any extra call, any paid model: stop and ask the user.

## Touchpoints (create/modify)

```
apps/web/src/features/ai/turnstile-widget.ts          (new)  provider via setTurnstileProvider, lazy script, reset
apps/web/src/features/ai/**, apps/web/src/api/{client,realMemoryApi}.ts, apps/web/src/main.tsx (one additive registration line)  (modify) provider registration; RealMemoryApi turnstileToken option widened to accept a Promise and awaited in bootstrap (sync form keeps working; existing realMemoryApi unit test stays green)
apps/web/.env.example                                  (new)  VITE_TURNSTILE_SITE_KEY name only
apps/web/public/_headers                               (new)  CSP + security headers
apps/web/e2e/csp-headers.spec.ts                       (new)  prod bundle on vite preview with header-injection shim, zero securitypolicyviolation
apps/web/e2e/turnstile-widget.spec.ts                  (new)  page.route stub of the challenges script
apps/web/test/turnstile-widget.test.ts                 (new)  Vitest with stub provider
apps/web/test/headers-file.test.ts                     (new)  _headers exists and holds the required directives (no unsafe-eval/unsafe-inline)
apps/web/src/{styles,shell,components,index.css}, apps/web/src/features/** except features/ai/**  (modify) a11y fixes AC30 (no api/**, no main.tsx)
apps/web/src/engine/render-pages.ts                    (conditional, A2) isEvalSupported:false only if the CSP trial traces a violation to pdfjs new Function
apps/web/e2e/slice.spec.ts                             (modify, A5) env-aware global_ok check (G1)
apps/web/e2e/{a11y-keyboard,perf-budget,fund-two-memory-reduction,fund-two-zero-hidden-zero-repeat}.spec.ts  (new)
apps/web/src/lib/download.ts                           (modify) delay URL.revokeObjectURL; test in apps/web/test/download-blob.test.ts
apps/worker/src/app.ts (seam, two places)             (modify) route line 117 uses jsonNoStore plus one added import of jsonNoStore from ./proxy/errors; test apps/worker/test/health.test.ts
apps/worker/src/platform/index.ts                      (conditional, D4) SESSION_CAPS.globalPerDay, MEMORY_WRITE_CAPS.rowBudgetPerDay
apps/worker/wrangler.jsonc                             (modify) real D1 database_id; still no routes/custom domain; cron "17 3 * * *" kept, not relied on
scripts/src/conformance/**                             (new, A6) `conformance:free-plan`: AC39 live matrix, AC40 limits, D4 burst (no AI call, no timing probe)
scripts/src/live/**                                    (new, A6) `probe:live-session`, `probe:live-ai` (incl. workerd CPU/duration timing on the first counted AI call via `wrangler tail`)
scripts/src/screenshots/**                             (new, A6) `shots:live` read-only screenshots to docs/demo/img/
scripts/src/deploy/**                                  (new, A6) `deploy:preflight` (build output, `_headers`, site key, no e2e marker); no secret echo
scripts/test/**, scripts/package.json                  (new/modify, A6) offline unit test per script; new script keys only
README.md, docs/DEPLOY.md, docs/demo/{slides.html,script.md,storyboard.md,img/*}  (new)
THIRD_PARTY_NOTICES.md                                 (modify) transitive rows incl. sax BlueOak-1.0.0, pako, jszip
process/context/{worker,tests,ui,all-context}.md       (UPDATE-PROCESS only)
```

Not created or edited by Phase 10 (peer-session ownership): `docs/README.md` and anything under `docs/architecture/**`. Root `README.md` carries a short "Documentation" section linking `docs/README.md` and `docs/architecture/README.md` and keeps its architecture summary brief, linking to `docs/architecture` for detail.

Not touched: the umbrella plan (another agent edits it), any prompt, `packages/core` detectors, `/api/quota` contract.

## Public Contracts

- Resources (account-level): Worker `aduin-transaction-web`, D1 `aduin-transaction-db`, Turnstile widget named `aduin-transaction-*` with hostname `aduin-transaction-web.giathaowork.workers.dev` only, managed mode. No KV/R2/DO, no routes, no custom domain.
- Secrets via `wrangler secret put` only: already set `COOKIE_SIGNING_KEYS`, `COOKIE_SIGNING_KID`, `OPENROUTER_API_KEY` (DO NOT re-put them; rotation invalidates cookies); to add `TURNSTILE_SECRET` (stdin, never echoed). The Turnstile site key is public config (`VITE_TURNSTILE_SITE_KEY`).
- `/api/health` stays static plus `cache-control: no-store` (via `jsonNoStore`); schema version is read from `/api/memory/health`. `/api/quota`, `/api/ai`, `/api/ocr` frozen v1; no new route.
- `PAID_FALLBACK_ENABLED=false`.
- Security scan (STRIDE, quick): spoofing (Turnstile hostname-pinned widget, cookie signing unchanged), tampering (CSP `script-src 'self'`, no inline), repudiation (audit trail unchanged), information disclosure (no-store health, `no-referrer`, secrets never printed, snippets/hashes only), denial of service (caps and breaker retained, D4 tuning), elevation (Turnstile secret server-side only). Residual: CSP `'wasm-unsafe-eval'` decision recorded by the trial.
- README states: deterministic-first, what AI does and does not do, known misses (P6-1a-d structurer/statutory/sub-letter misses, Compare cannot diff OCR documents, B-EDIT, #9 footnote outcome), privacy and retention values, Free-plan design, cost and limits, "production not built" list (tenant isolation, encryption, no-training, regional hosting, retention controls, audit), third-party notices, and that `#memory` is reached through the nav, not a deep link (P8b-6).

## Blast Radius

Per wave; waves A tasks have disjoint file sets (no shared file between A1-A5).

| Wave | Task | Files | Model |
|---|---|---|---|
| A1 | Turnstile widget | `apps/web/src/features/ai/**`, `apps/web/src/api/{client,realMemoryApi}.ts`, `apps/web/src/main.tsx` (one additive line), created `apps/web/.env.example`, its two specs and one unit test | opus |
| A2 | `_headers` + CSP | `apps/web/public/_headers`, `csp-headers.spec.ts`, `headers-file.test.ts`, `apps/web/src/engine/render-pages.ts` only if the CSP trial traces a pdfjs `new Function` violation | opus |
| A3 | a11y + perf + fund-two | `apps/web/src/{styles,shell,components,index.css}`, `apps/web/src/features/**` except `features/ai/**` (no `api/**`, no `main.tsx`), `a11y-keyboard`, `perf-budget`, `fund-two-*` specs | opus |
| A4 | Docs drafts | `README.md`, `docs/DEPLOY.md`, `docs/demo/**`, `THIRD_PARTY_NOTICES.md` (NOT `docs/README.md`, NOT `docs/architecture/**`) | sonnet |
| A5 | Health + download + slice | `apps/worker/src/app.ts` (two places: the health route line 117 and one added `jsonNoStore` import from `./proxy/errors`, since `app.ts` lacks it) and `apps/worker/test/health.test.ts`, `apps/web/src/lib/download.ts` and its test, `apps/web/e2e/slice.spec.ts` | opus |
| A6 | Live/ops scripts | `scripts/src/{conformance,live,screenshots,deploy}/**`, `scripts/test/**`, `scripts/package.json` | opus |
| B | Local gate | read-only runs | sonnet (vc-tester) |
| C | Live | `apps/worker/wrangler.jsonc`, remote D1, Turnstile widget, secret, deploy, probes, conditional `apps/worker/src/platform/index.ts` | opus for state changes |
| D | Screenshots, README finalize, closeout | `docs/demo/img/*`, README, report | sonnet |

Overlap note: A1 and A3 both live in `apps/web/src`; A3 must not edit `features/ai/**`, `api/**` or `main.tsx`, and A1 must not edit styles/shell/components/index.css or other features. No shared file between A1-A6. The orchestrator appends a `## Phase 10` revision note to `phase-blast-radius-registry.md` before Wave A (written 2026-10-17 in this cycle). Phase 10 must NOT create or edit `docs/README.md` or `docs/architecture/**` (owned by another session); Phase 10 owns root `README.md`, `docs/DEPLOY.md`, `docs/demo/**`, `THIRD_PARTY_NOTICES.md`. Remote effects: creates D1 and the Turnstile widget, sets one secret, deploys the Worker; nothing else.

## Data Flow

Local code and specs (Wave A) → local gate (B) → real D1 created, id into `wrangler.jsonc` → remote migrations 0001-0005 → `/api/memory/health` reports the schema version → `seed/demo.sql` applied → Turnstile widget created, site key to build env, secret to stdin → plain web build with `VITE_TURNSTILE_SITE_KEY` (always a fresh plain `pnpm --filter @aduin/web build` before deploy, because e2e builds share the output directory) → `wrangler deploy` (one Worker serves web and API, so the F12 order is satisfied by a single deploy) → live probes from the local machine: `curl -sI` for headers, health, memory health, stack slice, real-browser session with Turnstile, conformance with `wrangler tail`, D4 burst (cookie reused from the browser sessions) and the accountTag-only GraphQL rows_written read → conditional cap patch and redeploy → screenshots and docs. Static assets bypass the Worker, which is why headers live in `_headers`.

## Failure Modes

- Remote migration failure: stop before seed; report; D1 is disposable and can be re-created.
- Deploy with the placeholder all-zero D1 id: forbidden; use a temp config without `d1_databases` only while the real id does not exist (before D1 creation).
- CSP breaks a feature (workers, blob PDF, wasm): the report-only trial catches it first; relax one directive with evidence, never `unsafe-eval`.
- Turnstile script blocked or key unset: no provider, AI stays fail-closed with the existing banner; deterministic review unaffected.
- Secret rotation by mistake: invalidates cookies; the plan forbids re-putting existing secrets.
- Free quota exhausted or `usage.cost > 0`: stop the sweep, record, continue with docs.
- Web build output stale after an e2e run (including after a Playwright stack run): any redeploy needs a fresh plain web build first, checked by `deploy:preflight` (W7, E10).
- rows_written projected high: D4 tune and redeploy.
- Cron `scheduled()` skips without DB: not relied on for correctness; retention is also enforced on read paths.

## Implementation Checklist

### Wave A — parallel, disjoint files
- [ ] A1. Turnstile widget (D1): create `turnstile-widget.ts`, register the provider from `apps/web/src/main.tsx` (one additive line), lazy script load, managed `execution: 'execute'`, hidden container, reset after use, unset key means no provider; widen the `RealMemoryApi` `turnstileToken` option (`apps/web/src/api/realMemoryApi.ts`) to accept a Promise and await it in bootstrap, keep the sync form working, and have `memoryApi()` in `api/client.ts` pass the provider; the existing `realMemoryApi` unit test stays green; create `apps/web/.env.example` with the name only; a real-browser session needs the analyst-name flow, so the e2e goes through it; Vitest with stub provider and a Playwright spec stubbing `challenges.cloudflare.com` via `page.route`. The `--mode e2e` bundle has no site key, so the widget (inside `features/ai/turnstile-widget.ts`) reads `VITE_TURNSTILE_SITE_KEY` and, only under `IS_E2E`, a window global set by `addInitScript`; the spec calls `__aduinE2E.setApiBase('/')` and `useRealMemory(true)` and fakes the Worker with `page.route`. Gates: `pnpm --filter @aduin/web test turnstile-widget`; `pnpm --filter @aduin/web test:e2e turnstile-widget`. Proves AC39 (client leg) and AC31.
- [ ] A2. `_headers` + CSP (D2): write the file under `/*` (each line under 2000 characters, under 100 rules); run a local report-only trial under `vite preview` with a header-injection shim; `csp-headers.spec.ts` parses `apps/web/public/_headers` and injects exactly that header string on the `--mode e2e` bundle as a proxy (same chunking; the spec header comment says the production-shape proof is live: `curl -sI`, zero console errors in the live smoke, the violation listener in `probe:live-session`) and asserts zero `securitypolicyviolation` events across load, sample open (Radix dialog), scan viewer/PDF render, DOCX export, Compare and outline export; `headers-file.test.ts` asserts no `unsafe-eval` anywhere and no `unsafe-inline` in `script-src`/`default-src`. Expected first finding: `style-src` blocked by the Radix `<style>` injection; the only allowed relaxation is `style-src 'self' 'unsafe-inline'`, recorded as a named residual with the trial evidence. If a violation traces to pdfjs `new Function`, set `isEvalSupported: false` in `apps/web/src/engine/render-pages.ts` (the only A2 edit outside its set). Decide `'wasm-unsafe-eval'` by evidence. Add `connect-src https://challenges.cloudflare.com` only on live evidence after vc-docs-seeker confirms. Gates: `pnpm --filter @aduin/web test headers-file`; `pnpm --filter @aduin/web test:e2e csp-headers`.
- [ ] A3. a11y and specs: fix nav label-content-name mismatch, make the findings scroller focusable, U2 contrast, U3 focus, U4 underline/badge overlap; add `a11y-keyboard.spec.ts` (axe 0 critical on every main screen plus scripted keyboard path through triage, filters, gate), `perf-budget.spec.ts` (labelled e2e-mode bundle; thresholds largest sample under 5 s and ~50 KB sample under 2 s, measured in-page from open to "Checks done"; a flake is re-run serially and the numbers recorded), and the two final fund-two specs reusing `fixtures/memory/fund-expectations.json` (the interim `memory-prior-answer`, `memory-no-reflag`, `memory-blocking-never-hidden` specs stay). A3 may edit only `apps/web/src/{styles,shell,components,index.css}` and `apps/web/src/features/**` except `features/ai/**`; never `api/**` or `main.tsx`; keep existing test ids. IN-if-time: split the 568 kB chunk after A2 is green. Gates: `pnpm --filter @aduin/web test:e2e a11y-keyboard`, `... perf-budget`, `... fund-two`.
- [ ] A4. Docs drafts (sonnet): README.md (what/why, live URL, quick tour, brief architecture summary linking to `docs/architecture` for detail, a short "Documentation" section linking `docs/README.md` and `docs/architecture/README.md`, deterministic-first, tests and gates, cost and limits, deploy link, known misses, privacy/retention, production-not-built, third-party notices, `#memory` via nav note); docs/DEPLOY.md (exact commands, resource names, rollback; no zone name or id literal); docs/demo/slides.html (self-contained, keyboard navigation, no CDN, print CSS); docs/demo/script.md (narration with timings); docs/demo/storyboard.md (shot table); THIRD_PARTY_NOTICES rows incl. sax BlueOak-1.0.0, pako, jszip. A4 must not create or edit `docs/README.md` or anything under `docs/architecture/**` (peer-session owned). Gate: `pnpm guard:cf` and `pnpm secrets:scan` (no zone literal, no secret).
- [ ] A5. Worker `/api/health`: edit two places in `apps/worker/src/app.ts`: add one import of the existing `jsonNoStore` from `./proxy/errors` and switch the route line at 117 to it (no wrapper, no other seam edit) and extend `apps/worker/test/health.test.ts` (`pnpm --filter @aduin/worker test health`); `downloadBlob` delayed `revokeObjectURL` with a Vitest case (`pnpm --filter @aduin/web test download-blob`); `apps/web/e2e/slice.spec.ts` (04a-owned): replace `expect(body.global_ok).toBe(false)` with an env-aware check (`SLICE_BASE_URL` unset keeps `false`; set means `typeof boolean` and the observed value is recorded), keep `consoleErrors` empty, and on a live session-bootstrap or Turnstile console error fix the cause rather than weaken the assertion (G1).
- [ ] A6. Live/ops scripts (opus, Wave A): own `scripts/src/{conformance,live,screenshots,deploy}`, `scripts/test/**`, `scripts/package.json`. Create the script keys `conformance:free-plan`, `probe:live-session`, `probe:live-ai`, `shots:live`, `deploy:preflight`, each with an offline unit test (`pnpm --filter @aduin/scripts test <token>`) and these guards: https `*.workers.dev` host allow-list, Cloudflare API allow-list: REST `/accounts/**` plus exactly one read-only `POST /client/v4/graphql` whose query template is accountTag-only (source of D4 `rowsWritten` via `d1AnalyticsAdaptiveGroups` and of the CPU fallback `workersInvocationsAdaptive`); the offline test rejects any request path under `/zones` and any query text containing `zone` (alternative source: `wrangler d1 insights`, named if GraphQL proves unusable), a call ledger with a cap, stop on `usage.cost > 0`, no secret echo. `deploy:preflight` checks the web build output (present `_headers`, compiled site key, no e2e hook marker) so no shell command needs the output-dir word. `probe:live-session` runs headless Chromium first, then headed Chromium, with a `securitypolicyviolation` listener. `conformance:free-plan` sections: AC39 matrix (reject-before-claim only), AC40 limits and over-limit safe failure, D4 burst (no AI call, so no timing probe here; the `max_tokens` 10000 CPU/duration timing is measured in `probe:live-ai` on the first counted AI call, G13). CPU source is `wrangler tail` cpuTime, fallback the accountTag-only GraphQL `workersInvocationsAdaptive` quantiles. The D4 burst reuses the session cookie handed over by the real-browser sessions (G14): in-process from `probe:live-session` or via a mode-600 scratchpad file, never printed, never in the repo; no token available means a named residual with a backlog stub and a CONDITIONAL gate (once `TURNSTILE_SECRET` is set a script cannot mint sessions). A6 also owns the session ledger (G15) and the live-smoke guard (G16) described in C6. Wave A runs vitest gates only (see Execution Strategy).

### A-e2e — serialized Playwright first-green, after Wave A and before Wave B (G19)
- [ ] AE. One opus agent per owner in turn (A1, A2, A3, A5 slice), each fixing only its own file set, one Playwright command at a time (shared port 4317, `test-results`, web build output): A1 `turnstile-widget`; A2 `csp-headers`; A3 `a11y-keyboard`, `perf-budget`, `fund-two`; A5 slice `slice.spec.ts` (preview project). Wave B starts only after all four are green.

### Wave B — local gate (vc-tester, sequential, one token per call)
- [ ] B1. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm guard:cf`, `pnpm secrets:scan`, `pnpm seed:check`, `pnpm slice:check`.
- [ ] B2. `pnpm --filter @aduin/web test:e2e` (Playwright serial, preview project), then `pnpm --filter @aduin/web test:e2e:stack-memory`.
- [ ] B3. Final offline checks, no live calls (verified present in `scripts/package.json` and the script sources; `precompute:ocr` has no `--check`, so OCR is covered by `seed:check` and `slice:check`): `pnpm --filter @aduin/scripts precompute:ai --from-recordings --check`, `pnpm --filter @aduin/scripts record:author --check`, `pnpm --filter @aduin/scripts fixtures:check`. Any drift: stop and report (P6-1 is deferred, none expected).
- [ ] B4. Preflight: a plain `pnpm --filter @aduin/web build` immediately before deploy (never reuse e2e output); run `pnpm --filter @aduin/scripts deploy:preflight` for the output-dir, `_headers` and no-e2e-marker checks (not a raw shell command); `pnpm guard:cf`; working tree report.

### Wave C — live, sequential (opus for state changes)
- [ ] C1. Load credentials with the APPROVED marker; verify the account id; record the current Worker version (4325e4e4) as the rollback target; record the before list of Workers, D1 databases and Turnstile widgets (names only, `/accounts/` paths, never `/zones`).
- [ ] C2. `wrangler d1 create aduin-transaction-db`; write the real `database_id` into `apps/worker/wrangler.jsonc`; no routes.
- [ ] C3. `wrangler d1 migrations apply aduin-transaction-db --remote` (0001-0005); the Worker deploy happens at C5, so verify migrations now with a `wrangler d1 execute --remote` schema query, then `/api/memory/health` after C5. Apply `apps/worker/seed/demo.sql` with `d1 execute --remote --file` (run `pnpm seed:check` first).
- [ ] C4. Create the Turnstile widget through the account API (name `aduin-transaction-*`, hostname `aduin-transaction-web.giathaowork.workers.dev` only, managed); keep the site key for the web env; pipe the secret to `wrangler secret put TURNSTILE_SECRET` over stdin; never print either.
- [ ] C5. Plain web build with `VITE_TURNSTILE_SITE_KEY` set (fresh, after B4 rules), then `wrangler deploy` with the plain config (two-step: a temp config without `d1_databases` is used only if the real id still does not exist, which should not occur after C2). Record the new version id and the workers.dev URL. Run `deploy:preflight` on the fresh plain build first. Any later redeploy (C7 cap patch) needs a fresh plain web build first, because the Playwright `stack` run rebuilds the e2e bundle into the same output (E10).
- [ ] C6. Live probes in this order: `curl -sI https://aduin-transaction-web.giathaowork.workers.dev/` shows the D2 headers and the CSP; `/api/health` ok with no-store; `/api/memory/health` shows schema version 5 (0005); stack slice `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` (AC34 live zero-upstream: `wrangler tail` or a counter read before and after the smoke); then browser sessions via `pnpm --filter @aduin/scripts probe:live-session` (headless first, then headed Chromium; token obtained, session created, zero violations) BEFORE the over-limit and burst cases because sessions are capped at 5 per IP per UTC day. Session ledger (G15, kept by A6 and the orchestrator): smoke 1 per run, live-session 2 (headless + headed), live-ai 1, screenshots one browser context; once 4 are used, stop and defer the rest to the next UTC day. Live smoke (G16): the site key is compiled in, so with no token there must be no failing POST; run the stack smoke headless, then `--headed`; residual R2 (no token obtainable) extends to the smoke; the console-error filter may be narrowed only to `challenges.cloudflare.com` messages with recorded evidence, otherwise the gate is CONDITIONAL. D4 burst (C7) reuses the cookie from these real-browser sessions; then the AC39 matrix and AC40 conformance via `pnpm --filter @aduin/scripts conformance:free-plan` paced under 30 req/min and 6 AI req/min; then the over-limit and burst sections. After C6, the after list of Workers, D1 databases and Turnstile widgets; the before/after name diff (C1 vs C6, never `/zones`) must show only the D1, the widget and a new Worker version. If no Turnstile token is obtainable, the AC51 echo and the live AI/OCR sweep are skipped with backlog stubs and the gate is CONDITIONAL.
- [ ] C7. D4: bounded burst of memory writes against the live Worker (no upstream calls), reusing the session cookie from the C6 real-browser sessions (in-process or a mode-600 scratchpad file, never printed; no minting from a script once `TURNSTILE_SECRET` is set; no token means a named residual, backlog stub and CONDITIONAL gate), read `rowsWritten` from the accountTag-only GraphQL read (G12), project per day; if > 60k/day patch the two caps in `apps/worker/src/platform/index.ts`, run `pnpm --filter @aduin/worker test` and redeploy, then re-measure.
- [ ] C8. Under the APPROVED-LIVE cap (day 1 at most 3 AI calls, day 2 the rest, otherwise a backlog stub and the gate stays CONDITIONAL): AC51 echo probe via `probe:live-ai` (a firm rule changes the rules hash and forces a cache miss: the AC51 run on #1 and a second rules run on #3 double as the #1/#3 judgment sweep; assert each result is labelled fresh), workerd CPU/duration timing at `max_tokens` 10000 measured on the first counted AI call (the AC51 run on #1, via `wrangler tail` inside `probe:live-ai`), one drift narrative, one counsel draft, one OCR row-level recheck. Fix only deterministic or post-processing defects, each with a regression test; no prompt change. Record known misses for the README.

### Wave D — closeout
- [ ] D1. Screenshots via `pnpm --filter @aduin/scripts shots:live` (read-only, no AI/OCR) into `docs/demo/img/`.
- [ ] D2. Finalize README, DEPLOY, slides, script, storyboard with measured numbers (perf, rows_written, conformance, spend $0) and the live URL and version id.
- [ ] D3. High-risk evidence pack: write `process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-10/{risk-gate,context-snippets,verification,review-decision,adversarial-validation}.json` using the validator's required fields (risk-gate: task, planPath, riskLevel, riskClasses, mustStopBeforeFinalize, humanApprovalRequired, why; verification: task, commands, manualChecks, result; review-decision: task, decision, blockingFindings, nonBlockingFindings, notes), run `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-10`, and record the reviewer decision before the phase is called verified. Then the full regression (Test Gates last row), the phase report with the final metrics, deliverables checklist, call ledger, and user actions (video narration, push approval).

## Test Gates (commands as created in this phase)

Command rules (`process/context/tests/all-tests.md`): `pnpm --filter <pkg> test <token>`, no `--` separator, one token per call, Playwright serial, `SLICE_BASE_URL` only an https `*.workers.dev` origin and only with `--project=stack`.

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| turnstile unit | `pnpm --filter @aduin/web test turnstile-widget` | Fully-Automated | AC39 (client), AC31 |
| live scripts unit | `pnpm --filter @aduin/scripts test` (offline tests for conformance, live, screenshots, deploy) | Fully-Automated | AC31, AC39, AC40 |
| deploy preflight | `pnpm --filter @aduin/scripts deploy:preflight` | Fully-Automated | AC31 |
| turnstile e2e | `pnpm --filter @aduin/web test:e2e turnstile-widget` | Fully-Automated | AC39, AC31 |
| headers file | `pnpm --filter @aduin/web test headers-file` | Fully-Automated | AC31 (CSP, F10) |
| CSP e2e | `pnpm --filter @aduin/web test:e2e csp-headers` | Fully-Automated | AC31 |
| perf | `pnpm --filter @aduin/web test:e2e perf-budget` | Fully-Automated | AC29 |
| a11y + keyboard | `pnpm --filter @aduin/web test:e2e a11y-keyboard` plus one manual keyboard pass | Hybrid | AC30 |
| fund II | `pnpm --filter @aduin/web test:e2e fund-two` | Fully-Automated | AC59, AC60 |
| health no-store | `pnpm --filter @aduin/worker test health` | Fully-Automated | AC31 |
| download revoke | `pnpm --filter @aduin/web test download-blob` | Fully-Automated | AC31 (R3) |
| zero calls | `pnpm --filter @aduin/web test:e2e sample-zero-calls` | Fully-Automated | AC34 |
| no-LLM corpus | `pnpm --filter @aduin/web test:e2e no-llm-corpus` | Fully-Automated | AC25 |
| preflight | `pnpm guard:cf` then `pnpm secrets:scan` | Fully-Automated | AC31 zone rule |
| live smoke | `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` (headless, then `--headed`; valid after the A5 `global_ok` env-aware fix; no token means no failing POST; counts 1 session per run in the ledger) | Fully-Automated | AC31, AC1, AC34 |
| live headers/health | `curl -sI` on `/`, `/api/health`, `/api/memory/health` | Hybrid (live precondition) | AC31 |
| live session | `pnpm --filter @aduin/scripts probe:live-session` (headless then headed) | Hybrid | AC31, AC39 |
| risk evidence pack | `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-10` plus recorded reviewer decision | Fully-Automated (validator) | AC31 (high-risk) |
| Free-plan conformance + abuse | `pnpm --filter @aduin/scripts conformance:free-plan` (needs `wrangler tail`) | Fully-Automated + Hybrid | AC40, AC39 |
| AC51 echo | `pnpm --filter @aduin/scripts probe:live-ai`, AI call from the cap | Hybrid | AC51 |
| deliverables | checklist: README (with Documentation section), DEPLOY, slides, script, storyboard, screenshots; before/after account resource name diff shows only the D1, the widget and a new Worker version | Agent-Probe | AC31 |
| full regression | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @aduin/web test:e2e`, `pnpm --filter @aduin/web test:e2e:stack-memory`, `pnpm slice:check`, `pnpm seed:check`, `pnpm guard:cf`, `pnpm secrets:scan` (one per call) | Fully-Automated | all phases |

Failing stubs for red-first: `should register a Turnstile provider only when the site key is set`, `should ship a _headers file with no unsafe-eval or unsafe-inline`, `should raise zero securitypolicyviolation events on the production bundle`, `should have no critical axe violations on main screens`, `should reach triage, filters and the gate by keyboard only`, `should open the largest sample within five seconds`, `should show at least 50 percent fewer findings needing action at fund II`, `should place none of the new defects in Previously handled`, `should serve /api/health with no-store`, `should delay revoking the object URL`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `perf-budget-corpus` | Fully-Automated | AC29 |
| `a11y-scan-and-keyboard-e2e` | Hybrid | AC30 |
| `deployed-smoke-e2e` + deliverables checklist + before/after account resource name diff | Fully-Automated + Agent-Probe | AC31 |
| `sample-open-zero-llm-calls` | Fully-Automated | AC34 |
| `no-llm-full-corpus-run` | Fully-Automated | AC25 |
| `abuse-protection-matrix` (live) | Fully-Automated | AC39 |
| `free-plan-limits-conformance`, `limit-exceeded-safe-failure`, workerd timing measured on call 1 of `probe:live-ai` | Fully-Automated + Hybrid | AC40 |
| live `rules_hash8` echo probe | Hybrid | AC51 |
| `fund-two-memory-reduction-e2e` | Fully-Automated | AC59 |
| `fund-two-zero-hidden-zero-repeat-e2e` | Fully-Automated | AC60 |
| `risk-evidence-pack-validator` + recorded reviewer decision | Fully-Automated | AC31 (high-risk) |

Residuals (named, never proving): live-model quality on #1/#3 and drift narrative is Hybrid with a capped sweep; anything not exercised within the cap gets a backlog stub and stays CONDITIONAL.

## Exit Gate

- Live URL works end to end with a sample; headers curl shows CSP and security headers; Turnstile session works in a real browser; remote D1 migrated 0001-0005 and seeded; Free-plan conformance clean; a11y no critical violations; perf within targets; fund II meets AC59/AC60; zero-call samples confirmed; AC51 echo confirmed or backlogged; risk evidence pack validates with a recorded reviewer decision.
- The protected zone untouched (before/after name diff of Workers, D1 and Turnstile widgets shows only the D1, the widget and a new Worker version; no `/zones` call); no route or custom domain; no secret in repo or logs; no push; spend $0.
- README, DEPLOY, slides, script, storyboard, screenshots exist; report written with final metrics and user actions.

## Risks and Kill Criteria

- Free-model quota or cost: the cap block stops the sweep on `usage.cost > 0`, 429 or breaker; the app ships with authored/recorded fallbacks stated plainly.
- CSP regressions: report-only trial first; relax a single directive only with evidence.
- Turnstile misconfiguration: AI stays fail-closed; deterministic app works.
- D1 rows_written: D4 measure-then-tune; kill criterion: projected > 60k/day after tuning means ship read-only demo fallback and record it.
- workerd CPU at `max_tokens` 10000: if the timing measured on the first counted AI call exceeds the Free limit, lower `max_tokens` (a config change, not a prompt change) and record.
- Shared build output directory: always run a fresh plain web build before deploy.
- Video narration needs the human: a user action, not a blocker for VERIFIED of code gates.
- Risk Predictions (vc-predict summary): highest risks are secret rotation by mistake (mitigated: do not re-put), CSP breaking blob/PDF/worker paths (mitigated: trial plus spec), and deploying with the placeholder D1 id (mitigated: C2 before C5, preflight check).

## Cost / Secret Hygiene

Free models only; no paid calls; e2e uses recorded data; live AI/OCR only inside the APPROVED-LIVE cap; PDFs never sent to OpenRouter; keys only via credential files and `wrangler secret put` over stdin, never printed, logged or committed (`secrets:scan` in the regression); resources `aduin-transaction-*` only; default workers.dev URL; the protected zone never touched or named in repo text; no custom domain or route; no git push.

## Rollback

`wrangler rollback` to version 4325e4e4-9aca-4ae8-8985-cc0b73097c3e (or redeploy the previous code) for the Worker; `wrangler secret delete TURNSTILE_SECRET` and delete the Turnstile widget by id to undo C4 (AI then fails closed); remote D1 can be dropped and re-created because demo data is regenerated; cap changes revert by commit and redeploy; `docs/DEPLOY.md` lists teardown by resource name (`aduin-transaction-web`, `aduin-transaction-db`). Revert commits for code and docs.

## Blockers That Would Justify BLOCKED Status

- Credentials not approved or available for `wrangler` or the account API (user action).
- A Free-limit violation that no config change fixes.
- A deploy step that would require a route, custom domain, the protected zone, a paid call, or a prompt change (hard stop: ask the user).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [x] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked (17-10-26: gap report delivered; live version 4325e4e4, placeholder D1 id, secrets state, precompute scripts, headers and plan staleness found)
- [x] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written (17-10-26: D1-D7 adopted, see Decisions Adopted)
- [x] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note written (17-10-26: body rewritten, see Inner Loop Refresh Note)
- [x] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md` (include the APPROVED-LIVE cap block above)
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S1, S2, S4, S6 (secrets, deploy, public API), S7 → 5/7 HIGH. Recommended: no agent team (TeamCreate is unavailable). Wave A = six disjoint parallel subagents (A1-A6) that run vitest gates only; blast radii are made disjoint by the file ownership above. Playwright first-green runs are serialized in a step A-e2e after Wave A and before Wave B: one opus agent per owner in turn (A1, A2, A3, A5 slice), each fixing only its own file set, one Playwright command at a time (shared port 4317, `test-results` and the web build output). Wave B is authoritative for typecheck and lint (scoped runs during Wave A can fail on a sibling's half-written file); Wave B sequential vc-tester; Wave C sequential (ordered, state-changing, opus); Wave D sonnet docs. Models: sonnet for research, validation, review and docs (A4); opus only for A1, A2, A3, A5, A6 code and Wave C state changes.

## Test Infra Improvement Notes

(none identified yet) — candidates: A6 adds offline-tested live/ops scripts; a `precompute:all` wrapper is intentionally not added (only `precompute:ai` and `precompute:ocr` exist); a header-injection shim for preview-served CSP is added inside `csp-headers.spec.ts` and may be promoted to a fixture; the live conformance script is remote-only by design.

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-10-deploy-final_PLAN_17-10-26.md`
- Last completed step: 4 PVL (17-10-26); supplement cycle 2 applied (G12-G19) and re-validated: PASS
- Validate-contract status: written 2026-10-17, Gate: PASS (cycle 2 re-validate; 0 FAIL, 0 CONCERN; G1-G19 closed; residuals R1-R4 named with backlog-stub fallbacks; E1-E26 binding)
- Next Step: EXECUTE (Wave A subagents A1-A6, then serialized A-e2e, Wave B, Wave C, Wave D) with the validate-contract and the APPROVED-LIVE cap block. After EXECUTE, ask the user before any `git push`. Do not touch the umbrella plan from this file's tasks other than via update-process.
- Validators: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <plan>` and `node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs <plan>`.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: inner-pvl: phase-10
supersedes: 2026-10-17 (inner-pvl: phase-10, cycle-1 re-validate CONDITIONAL, gaps G12-G19) — inner PVL cycle 2 re-validate (after PVL supplement cycle 2) has current evidence

PVL cycle: 2 (re-validate after supplement cycle 2). Trend: 11 gaps (cycle 0) -> 8 gaps (cycle 1) -> 0 gaps (this pass). G1-G11 re-verified closed; G12-G19 verified closed against the plan text, E16-E23 and the code; no new gap that an execute agent following the plan literally would turn into something unsafe, impossible or vacuous. 0 FAIL, 0 CONCERN. Structural validator `validate-plan-artifact.mjs`: 0 failures, 0 warnings (465 lines). Protected-zone scan of the plan file (literal name and id): 0 hits. The existing contract was CONDITIONAL, so no auto-proceed applied; the Inner Loop Refresh Note (2026-10-17) was already covered by the earlier cycles.

Parallel strategy: parallel-subagents (Wave A, six disjoint file sets, NO team machinery), then serialized Playwright per owner, then sequential waves
Rationale: score 5/7 (S1 multi-package, S2 secrets/public-API surface, S4 phase program, S6 high-risk classes, S7 more than 5 files); dominant signals S6 and S7. No agent team: TeamCreate is not available and the Wave A tasks are file-disjoint with vitest-only gates, so fire-and-forget subagents suffice and need no mid-run talk. Models: sonnet for A4, Wave B vc-tester and Wave D; opus only for A1, A2, A3, A5, A6, the serialized e2e step and the Wave C live chain (source edits, builds, state changes). Agent count: Wave A 6 (A1, A2, A3, A5, A6 opus; A4 sonnet) + AE up to 4 owner turns, serialized (opus, one at a time; 1 if everything is green on the first run, 4 if every owner needs a fix) + Wave B 1 sonnet vc-tester + Wave C 1 opus (ordered chain) + Wave D 1 sonnet = about 10 to 13. Cost guard: not triggered (under 30 agents). Playwright is never run concurrently (port 4317, `test-results` and the web build output are shared).

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC39 (client) / AC31 | Turnstile provider registered only when the site key is set; token reaches `/api/ai`, `/api/ocr` and `POST /api/session`; widget reset after use; unset key = no provider | Fully-Automated | `pnpm --filter @aduin/web test turnstile-widget` ; `pnpm --filter @aduin/web test:e2e turnstile-widget` | B |
| AC31 (CSP, F10) | `_headers` holds the required directives, no `unsafe-eval` anywhere, no `unsafe-inline` in `script-src`/`default-src` | Fully-Automated | `pnpm --filter @aduin/web test headers-file` | B |
| AC31 (CSP, F10) | Zero `securitypolicyviolation` events across load, sample open (Radix dialog), scan viewer/PDF render, DOCX export, Compare, outline export under the header string parsed from `public/_headers` | Fully-Automated | `pnpm --filter @aduin/web test:e2e csp-headers` | B |
| AC29 | Largest sample deterministic result < 5 s, ~50 KB sample < 2 s; scan set shows per-page progress | Fully-Automated | `pnpm --filter @aduin/web test:e2e perf-budget` ; existing `scan-set-smoke` | B |
| AC30 | 0 critical axe violations on every main screen; keyboard-only triage, filters, gate; visible focus; severity not by color alone | Hybrid | `pnpm --filter @aduin/web test:e2e a11y-keyboard` plus one recorded manual keyboard pass in `harness/phase-10/verification.json` `manualChecks` | B |
| AC59, AC60 | Fund II: at least 50% fewer findings needing action; 0 new defects or edited passage in Previously handled; 0 repeated counsel questions; blocking dismissals stay in the main list | Fully-Automated | `pnpm --filter @aduin/web test:e2e fund-two` (matches both new fund-two specs) | B |
| AC31 | `/api/health` answers `cache-control: no-store` | Fully-Automated | `pnpm --filter @aduin/worker test health` | B |
| AC31 (R3) | `downloadBlob` revokes the object URL after a delay, not before the click | Fully-Automated | `pnpm --filter @aduin/web test download-blob` | B |
| AC34 | Bundled samples open with zero AI/OCR calls | Fully-Automated | `pnpm --filter @aduin/web test:e2e sample-zero-calls` | A |
| AC25 | No-LLM mode complete over the corpus | Fully-Automated | `pnpm --filter @aduin/web test:e2e no-llm-corpus` ; `pnpm --filter @aduin/core test:corpus` | A |
| AC31 zone rule | No zone literal, no route/custom domain, no secret | Fully-Automated | `pnpm guard:cf` then `pnpm secrets:scan` | A |
| AC31 | Deploy artifact preflight: `_headers` present, no e2e hook marker in the real build output, site key compiled in | Fully-Automated | `pnpm --filter @aduin/scripts deploy:preflight` (created by A6; the vitest token `no-e2e-hook-in-d` builds into a temp dir and does NOT inspect the deploy output) | B |
| AC31, AC1, AC34 | Live smoke: sample #1 end to end on the deployed Worker, zero console errors, zero openrouter.ai browser requests | Fully-Automated | `SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev pnpm --filter @aduin/web exec playwright test --project=stack` (only valid after the `global_ok` fix in G1) | B |
| AC31 | Live headers and health | Hybrid (live precondition) | `curl -sI https://aduin-transaction-web.giathaowork.workers.dev/` shows the CSP and security headers; `/api/health` shows no-store; `/api/memory/health` shows `schema_version` 5 | B |
| AC39 (live), AC40 | Reject-before-claim abuse cases and one over-limit safe failure against the live Worker; CPU/outcome from `wrangler tail` or analytics; no paid feature | Fully-Automated + Hybrid (tail precondition) | `pnpm --filter @aduin/scripts conformance:free-plan` (created by A6); offline twins stay in regression: `pnpm --filter @aduin/worker test abuse-protection-matrix` | B |
| AC31 / AC39 | Real-browser Turnstile session on the live site: token obtained, `POST /api/session` 200, zero `securitypolicyviolation` | Hybrid | `pnpm --filter @aduin/scripts probe:live-session` (created by A6; headless first, headed Chromium fallback) | B |
| AC51 | Live `rules_hash8` echo equals the hash of the active rule texts; the second firm does not echo it | Hybrid | `pnpm --filter @aduin/scripts probe:live-ai` (created by A6; counts against the APPROVED-LIVE AI cap) | B / D if not reachable |
| AC40 (D4) | Remote `rows_written` projection per day from a bounded burst | Hybrid | `pnpm --filter @aduin/scripts conformance:free-plan` burst section plus D1 analytics read; tune caps only if projected above 60k/day | B |
| AC31 | Deliverables exist: README, docs/DEPLOY.md, docs/demo/{slides.html,script.md,storyboard.md}, screenshots; before/after account resource diff shows only the resources this phase created | Agent-Probe | checklist recorded in the phase report | B |
| High-risk evidence | Risk evidence pack exists and validates | Fully-Automated (validator) | `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-10` | B (after G10) |
| Regression | All earlier phases intact | Fully-Automated | one per call: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @aduin/web test:e2e`, `pnpm --filter @aduin/web test:e2e:stack-memory`, `pnpm slice:check`, `pnpm seed:check`, `pnpm guard:cf`, `pnpm secrets:scan` | A |

Failing stubs (red-first; Fully-Automated rows only; the plan's stub list already carries them, copied here by row):
- turnstile: `test("should register a Turnstile provider only when the site key is set", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should register a Turnstile provider only when the site key is set") })`
- headers-file: `test("should ship a _headers file with no unsafe-eval or unsafe-inline in script-src", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should ship a _headers file with no unsafe-eval or unsafe-inline in script-src") })`
- csp-headers: `test("should raise zero securitypolicyviolation events on the bundle under the _headers policy", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should raise zero securitypolicyviolation events on the bundle under the _headers policy") })`
- perf-budget: `test("should open the largest sample within five seconds", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should open the largest sample within five seconds") })`
- a11y-keyboard: `test("should have no critical axe violations on main screens", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should have no critical axe violations on main screens") })` and `test("should reach triage, filters and the gate by keyboard only", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should reach triage, filters and the gate by keyboard only") })`
- fund-two: `test("should show at least 50 percent fewer findings needing action at fund II", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should show at least 50 percent fewer findings needing action at fund II") })` and `test("should place none of the new defects in Previously handled", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should place none of the new defects in Previously handled") })`
- health: `test("should serve /api/health with no-store", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should serve /api/health with no-store") })`
- download-blob: `test("should delay revoking the object URL", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should delay revoking the object URL") })`
- deploy:preflight: `test("should fail when the build output carries an e2e hook marker", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should fail when the build output carries an e2e hook marker") })`

gap-resolution legend: A proven now; B gate added by this plan's checklist; C deferred to a named later phase; D backlog test-building stub (named residual). C-4: the strategy column carries only Fully-Automated / Hybrid / Agent-Probe; Known-Gap is never a strategy.

Named residuals (gap-resolution D; none is the sole proof of a developed behavior; each carries a backlog-stub fallback and CONDITIONAL-gate behavior if it materializes at EXECUTE time):
- R1 Live-model quality on #1/#3 judgments, the drift narrative and the counsel draft is Hybrid inside the capped sweep; whatever is not exercised inside the cap gets a backlog stub and the phase gate stays CONDITIONAL.
- R2 Real-browser Turnstile token in headless Chromium may be refused by the managed challenge; fallback is headed Chromium on the dev machine; if no token is obtainable, the AC51 echo, the D4 burst (no cookie) and the live AI/OCR sweep are not run (AI stays fail-closed, deterministic app unaffected) and each gets a backlog stub. R2 extends to the live smoke (E20).
- R3 AC40 CPU numbers depend on the measurement source (`wrangler tail` may not carry `cpuTime`; fallback GraphQL `workersInvocationsAdaptive` quantiles, accountTag-only); if neither yields a number, the timing is a named residual, not a silent pass.
- R4 CSP evidence for the real Turnstile iframe exists only live (the e2e stub cannot exercise it); `connect-src https://challenges.cloudflare.com` is added only on live evidence.

Legacy line form:
- Turnstile/CSP/health/download (Wave A): [Fully-automated: `pnpm --filter @aduin/web test turnstile-widget`, `pnpm --filter @aduin/web test:e2e turnstile-widget`, `pnpm --filter @aduin/web test headers-file`, `pnpm --filter @aduin/web test:e2e csp-headers`, `pnpm --filter @aduin/worker test health`, `pnpm --filter @aduin/web test download-blob`]
- Perf/a11y/fund II: [Fully-automated: `pnpm --filter @aduin/web test:e2e perf-budget`, `pnpm --filter @aduin/web test:e2e fund-two`] | [hybrid: `pnpm --filter @aduin/web test:e2e a11y-keyboard` + manual keyboard pass]
- Live (Wave C): [Fully-automated: stack smoke with `SLICE_BASE_URL` and `--project=stack`, `pnpm --filter @aduin/scripts conformance:free-plan`] | [hybrid: `curl -sI`, `probe:live-session`, `probe:live-ai`, rows_written burst + analytics] | [agent-probe: deliverables checklist, before/after account resource diff] | [known-gap: live-model quality beyond the cap (R1), headless Turnstile token (R2), CPU measurement source (R3), live Turnstile iframe CSP (R4) — documented above]
- Regression: [Fully-automated: the one-per-call list in the Regression row]

Dimension findings:
- Infra fit: PASS — verified on disk this pass: `apps/worker/src/app.ts` line 117 is the `GET /api/health` route and the file imports only `./routes/memory/index`, `./routes/proxy/index`, `./proxy/pipeline` (no `jsonNoStore`, so the two-place edit of G18 is exactly right); `jsonNoStore(body, extraHeaders)` exists at `apps/worker/src/proxy/errors.ts:54`; `SESSION_CAPS` (`perIpPerDay` 5, `globalPerDay` 300) at `platform/index.ts:21` and `rowBudgetPerDay` 30_000 at `:41` match D4; `wrangler.jsonc` still carries the placeholder D1 id and the cron trigger (C2 replaces the id before C5); `features/ai/turnstile.ts` already exports `setTurnstileProvider` (`() => Promise<string | null>`) and `realMemoryApi.ts:53` has the sync `turnstileToken?: () => string | null` option (A1 widening is additive); `e2e-hook.ts` exposes `setApiBase` and `useRealMemory` under `IS_E2E`; `playwright.config.ts` accepts `SLICE_BASE_URL` only as an https `*.workers.dev` origin and its `stack` project regex matches `--project=stack`; `slice.spec.ts:72` is the `global_ok` false assertion that A5 makes env-aware; `scripts/package.json` has none of the five new keys yet but already depends on `@playwright/test` and `wrangler`; the vitest include covers `scripts/test/**`; `apps/web/public/_headers` and the web env example file do not exist yet (A2 / A1 create them); A1-A6 file sets are disjoint. G12, G17, G18 closed.
- Test coverage: PASS — C3 table back-references every AC and every row carries one of the three proving strategies; no developed behavior rests on Known-Gap alone (vacuous-green ban satisfied; R1-R4 are named residuals with backlog-stub fallbacks and are never the sole proof); G13 (timing probe moved into `probe:live-ai` call 1, cap "4 of 6, timing measured on call 1"), G15 (session ledger), G16 (smoke with site key compiled in: no token means no failing POST; headless then headed; R2 extended; filter narrowing only on evidence), G19 (serialized A-e2e step) closed and consistent with E17, E19, E20, E21 and the Execution Strategy section.
- Breaking changes: PASS — `/api/quota`, `/api/ai`, `/api/ocr` frozen v1; `/api/health` gains a header only; `turnstileToken` widening is additive and the sync form keeps working; `_headers` applies to static assets only (`run_worker_first` is `/api/*`); no migration edit; CSP assertion wording is consistent across D2, A2, E2, E3 and the Test Gates.
- Security surface: PASS — high-risk classes: secrets, trust boundary (Turnstile), deploy/runtime, CSP, remote schema/data, public contract (health header). Verified: the plan carries no literal protected-zone name or id; `PAID_FALLBACK_ENABLED=false`; no routes or custom domain; existing secrets never re-put; widget hostname pinned; the G12 allow-list is fixed in the plan (REST `/accounts/**` plus exactly one read-only accountTag-only `POST /client/v4/graphql`; the offline test rejects any `/zones` path and any query text containing `zone`); the G14 cookie handoff is never printed (in-process or a mode-600 scratchpad file deleted after); the D3 evidence pack and validator path exist. R2 and R4 are live-environment unknowns with named fallbacks.
- Section A (Wave A code and specs) feasibility: PASS — mechanically feasible; highest-risk edit: making `RealMemoryApi.bootstrap` await an async token without breaking sync callers (mitigation: widen the option type, keep the sync form working, keep the existing `realMemoryApi` unit test green); see E24 for the no-token behavior.
- Section A-e2e (serialized Playwright) feasibility: PASS — one owner at a time on shared port 4317, `test-results` and the web build output; Wave B starts only after all four owners are green.
- Section B (local gate) feasibility: PASS — commands verified; B3 flags exist; B4 uses `deploy:preflight`.
- Section C (live) feasibility: PASS — ordering sound (D1 before deploy, secret before widget use, plain build with site key before deploy, sessions before burst); highest-risk step: widget create (the response carries the secret): parse in-process, pipe to `wrangler secret put` over stdin, never print.
- Section D (closeout) feasibility: PASS — D3 pack and validator, screenshots read-only; root README created by A4; `docs/README.md` and `docs/architecture/**` are peer-owned (E22).

G1-G19 closure table (verified this pass): G1 slice `global_ok` env-aware (A5, E7); G2 A6 scripts and corrected B3 flags; G3 no team, vitest-only Wave A; G4 A1 file set and Promise-widened token; G5 A3 set, A2 conditional `render-pages.ts`; G6 CSP assertion rule; G7 perf label and thresholds; G8 live ordering and CPU source; G9 AI day split and forced cache miss; G10 D3 evidence pack; G11 health line, C3 fix, registry note, name diff, preflight; G12 GraphQL allow-list (E16); G13 timing probe placement (E17); G14 cookie handoff and no-token fallback (E18); G15 session ledger (E19); G16 smoke without token (E20); G17 e2e site key inside `turnstile-widget.ts` (E21); G18 two-place `app.ts` edit (E6, E21); G19 A-e2e step (E21).

Plan updates applied: none to the plan body (0 gaps found); this agent updated only the status lines (header, Phase Loop Progress step 4, Resume handoff) to record this PASS. Wave A subagents must treat E1-E26 below as binding.

Execute-agent instructions (binding on EXECUTE):
- E1. Run only vitest gates inside Wave A subagents. Run every Playwright gate serially, one agent at a time, after Wave A code has landed (Wave B2 or a single serialized A-e2e step). Scoped `typecheck`/`lint` during Wave A can fail transiently on a sibling's half-written file; Wave B is the authority.
- E2. `_headers`: put the policy under `/*`; keep each line under 2000 characters and the file under 100 rules. Run the report-only trial first (Radix modal open, scan viewer, DOCX export, Compare, outline export). Expected first finding: `style-src` blocked by the react-style-singleton `<style>` tag. If confirmed, the only allowed relaxation is `style-src 'self' 'unsafe-inline'` (style only), recorded with the trial evidence as a named residual; never `unsafe-eval`, never `unsafe-inline` in `script-src`. If a violation traces to pdfjs `new Function`, set `isEvalSupported: false` in `apps/web/src/engine/render-pages.ts` (A2 owns that single edit). Add `'wasm-unsafe-eval'` only if the trial proves a wasm load needs it. `connect-src https://challenges.cloudflare.com` is added only on live evidence (confirm Turnstile CSP needs via vc-docs-seeker).
- E3. `csp-headers.spec` must read and parse `public/_headers` and inject exactly that header string; it may use the `--mode e2e` bundle served by the preview project as a proxy (same chunking), because the production-shape proof is live (`curl -sI`, zero console errors in the live smoke, `probe:live-session` violation listener). State this in the spec header comment.
- E4. A1: edit only `apps/web/src/features/ai/**`, `apps/web/src/api/{client,realMemoryApi}.ts`, `apps/web/src/main.tsx` (one additive registration line), `apps/web/.env.example` (create, name only), and its tests. Token never logged; reset after use; unset key means no provider and no script load.
- E5. A3 may edit `apps/web/src/{styles,shell,components,index.css}` and any `apps/web/src/features/**` except `features/ai/**`; it must not touch `api/**` or `main.tsx`. Keep existing test ids.
- E6. `/api/health`: change the single route line in `apps/worker/src/app.ts` to the existing `jsonNoStore` helper from `./proxy/errors`; extend `apps/worker/test/health.test.ts`; no other edit to the seam file.
- E7. `slice.spec.ts` (04a-owned): replace `expect(body.global_ok).toBe(false)` with an env-aware check (`SLICE_BASE_URL` unset keeps `false`; set means `typeof boolean`, and record the observed value). Keep `consoleErrors` empty. If the first live run fails on a session-bootstrap or Turnstile console error, do not weaken the assertion silently: record the cause and fix the cause (the app bootstraps a session lazily before the first memory call).
- E8. Wave C command forms: run wrangler as `pnpm --filter @aduin/worker exec wrangler ...` from the repo; load credentials only as `set -a; source ~/.config/cloudflare/credentials.env; set +a # APPROVED:credentials.env`; never `echo` env values. `d1 create` may offer to edit the config: write the real `database_id` into `apps/worker/wrangler.jsonc` by hand, keep one `d1_databases` entry and the comments, then run `pnpm guard:cf`. Migrations: `... wrangler d1 migrations apply aduin-transaction-db --remote`; seed: `... wrangler d1 execute aduin-transaction-db --remote --file seed/demo.sql` after `pnpm seed:check`; then run row-count queries and `GET /api/memory/health` (expect `schema_version` 5) after the C5 deploy.
- E9. Turnstile widget: call only `POST /accounts/{id}/challenges/widgets` and listing endpoints under `/accounts/`; never any `/zones` path (script allow-list). Name `aduin-transaction-*`, domain `aduin-transaction-web.giathaowork.workers.dev` only, managed. Parse the response in-process; write widget id and site key (public) to the scratchpad for rollback; secret to stdin only. Do NOT re-put `COOKIE_SIGNING_KEYS`, `COOKIE_SIGNING_KID`, `OPENROUTER_API_KEY`. If the API rejects the hostname, stop the Turnstile steps, record it, leave AI fail-closed, and use no route or custom domain workaround.
- E10. Plain build for deploy: `VITE_TURNSTILE_SITE_KEY=<public key> pnpm --filter @aduin/web build` (inline env, per command; never exported in the shell session and never written to a committed file, so the local `stack-memory` project stays token-less). Run `pnpm --filter @aduin/scripts deploy:preflight` on that output, then `pnpm guard:cf`, `pnpm secrets:scan`, then deploy. Any redeploy (C7 cap patch) needs a fresh plain build first, because the Playwright `stack` run rebuilds the e2e bundle into the same output.
- E11. Live ordering: token-less local specs first (B2); then deploy; headers and health; the stack smoke; browser sessions (`probe:live-session`) BEFORE the over-limit and burst cases, because sessions are capped at 5 per IP per UTC day; AC39 matrix paced under the in-isolate pre-limit (30 req/min, 6 AI req/min per IP) and limited to reject-before-claim cases (no AI spend). Record the before/after list of Workers, D1 databases and Turnstile widgets (names only); the diff must be exactly the D1, the widget and a new Worker version.
- E12. Live AI under the APPROVED-LIVE cap: day 1 at most 3 AI calls, day 2 the rest; if the run cannot cross a UTC midnight, defer the remainder to a backlog stub and keep the gate CONDITIONAL. Force a cache miss for each counted quality call (a firm rule changes the rules hash, so the AC51 run on #1 and a second run on #3 double as the judgment sweep); assert the result is labeled fresh, otherwise it did not exercise the model. Ledger every call (task, UTC time, model, cost) in the report; stop on `usage.cost > 0`, any 429, breaker-open or the cap.
- E13. High-risk evidence pack: at D3 write `harness/phase-10/{risk-gate,context-snippets,verification,review-decision,adversarial-validation}.json` in the task folder using the validator's required fields (`risk-gate`: task, planPath, riskLevel, riskClasses, mustStopBeforeFinalize, humanApprovalRequired, why; `verification`: task, commands, manualChecks, result; `review-decision`: task, decision, blockingFindings, nonBlockingFindings, notes), run the validator, and record the reviewer decision before the phase is called verified. Risk classes: secret/trust-boundary (TURNSTILE_SECRET, CSP, cookie signing untouched), deploy/runtime, schema/data (remote migrations and seed), public contract (health header).
- E14. Registry: before Wave A the orchestrator appends a `## Phase 10` revision note to `phase-blast-radius-registry.md` (append-only seam) naming the real file sets (A1-A6 below) and replacing the stale line that lists `precompute-all.ts` and `deployed-smoke`/`free-plan-limits` specs, which this plan does not create.
- E15. If a gate cannot be made green, record the gap in the phase report; do not mark Phase 10 verified on a Known-Gap. `git push` is never run; the user is asked after EXECUTE.
- E16 (G12). Cloudflare API allow-list in A6: REST only under `/accounts/**` (reads, plus the single widget create); plus exactly one read-only analytics call `POST /client/v4/graphql` whose query is built from a fixed template filtered by `accountTag` (never `zoneTag`, never a `zones` selection); the offline test asserts that a query containing `zone` and any `/zones` path are rejected. Alternative: `pnpm --filter @aduin/worker exec wrangler d1 insights aduin-transaction-db` if it returns `rowsWritten`. Never loosen the allow-list ad hoc; record which source produced each number.
- E17 (G13). The workerd timing probe at `max_tokens` 10000 is NOT a section of `conformance:free-plan` (that script makes zero upstream calls). Measure CPU and duration of the first counted AI call (the AC51 run on #1) inside `probe:live-ai` under `wrangler tail`; no separate call; AI use stays 4 of 6 (a fifth call is allowed only inside the cap, on day 2, and ledgered).
- E18 (G14). D4 reuses the signed workspace cookie of the real-browser sessions made by `probe:live-session` (passed in-process or via a mode-600 scratchpad file, never printed, deleted after), measures rows per `session_new` from those 1-2 sessions and rows per memory write from bounded writes on that workspace (within the 600 per-workspace cap), and projects per day against `SESSION_CAPS` and the 30,000 row budget. No token obtainable (R2): D4 is a named residual with a backlog stub and the gate stays CONDITIONAL.
- E19 (G15). Keep a session ledger against 5 per IP per UTC day: stack smoke 1 per run (a rerun counts), `probe:live-session` 2, `probe:live-ai` 1, screenshots reuse one browser context per run. At 4 used, stop and defer the rest to the next UTC day or a backlog stub; never work around the cap.
- E20 (G16). When the provider obtains no token, the client keeps triage local and must NOT issue a failing `POST /api/session` (no console error from our code). Run the live smoke headless first, then `--headed` once; if only third-party Turnstile console messages from `challenges.cloudflare.com` fail `consoleErrors`, record R2 with the evidence and narrow the filter to exactly those messages, never a blanket filter; otherwise the smoke gate is CONDITIONAL.
- E21 (G17, G18, G19). A1 supplies the e2e site key inside `features/ai/turnstile-widget.ts` only (read `VITE_TURNSTILE_SITE_KEY`, or under `IS_E2E` a window global set by the spec's `addInitScript`; stripped from production; `no-e2e-hook-in-d` stays green; no edit to `e2e-hook.ts` or `playwright.config.ts`). A5 edits `apps/worker/src/app.ts` in exactly two places: the route line and one `import { jsonNoStore } from './proxy/errors'` line. After Wave A lands, run a serialized e2e step: one opus agent per owner in turn (A1 specs, A2 specs, A3 specs, then A5 slice locally), each fixing only its own file set, one Playwright command at a time, before Wave B.
- E22 (docs). At D2 verify that the README links to `docs/README.md` and `docs/architecture/README.md` resolve; if the peer session has not produced `docs/README.md`, keep the link as a note and report it; never create it.
- E23 (live order). Live ordering as in E11: curl, health, memory health, stack smoke, `probe:live-session`, then conformance and burst, then the AI sweep (day 1 at most 3 AI calls, the rest on day 2).
- E24 (client no-token behavior, A1). When a Turnstile provider is registered (site key compiled in) and it returns no token, `RealMemoryApi` must NOT issue `POST /api/session` (no failing request, so no browser console error from our code); triage stays local and AI shows the existing "verification needed" banner. When no provider is registered (key unset, e.g. the `stack-memory` project and the preview e2e), behavior is unchanged: bootstrap posts without a token. Add a Vitest case for both branches in the existing realMemoryApi or turnstile-widget tests. This is the cause-level fix that E20 and the A5 slice step refer to; if it is discovered only live, the Wave C opus agent applies it in A1's files with a regression test, then redeploys from a fresh plain build.
- E25 (ledger arithmetic). Per-IP sessions are 5 per UTC day. If the stack smoke (headless and headed) and `probe:live-session` (headless and headed) have used 4 by the time `probe:live-ai` is due, the AC51/AI sweep is deferred to the next UTC day (this also satisfies the AI cap of at most 3 per UTC day) or becomes a backlog stub; never work around a cap, never mint a session from a script once `TURNSTILE_SECRET` is set.
- E26 (registry note). `phase-blast-radius-registry.md` `## Phase 10 revision` still describes A5's `app.ts` edit as a "single line"; the plan's two-place edit (route line plus one `jsonNoStore` import) does not change disjointness. The orchestrator may append a one-line correction before Wave A; this is not a gate.

What This Coverage Does NOT Prove:
- `turnstile-widget` unit/e2e: prove provider registration and token flow against a stub script; do not prove the real Cloudflare challenge, the real iframe under the real CSP (R4), or token acceptance by siteverify.
- `headers-file` and `csp-headers`: prove the file's directives and zero violations on the e2e-mode bundle under header injection; do not prove the headers are served by the deployed Workers static assets (live `curl -sI`) or that the real Turnstile iframe is allowed.
- `perf-budget`: proves timings on this machine's Chromium against the NFR thresholds on the e2e-mode bundle; does not prove timings on the deployed edge or slow client hardware.
- `a11y-keyboard`: axe finds a subset of WCAG issues; it does not prove AA contrast everywhere or screen-reader behavior; the manual keyboard pass is one recorded session.
- `fund-two`: proves the seeded fund II fixture only; does not prove real firms' documents behave the same.
- `health`, `download-blob`: prove header and call sequence with stubs; not real-browser object-URL revoke timing (existing backlog R3).
- Live smoke (`--project=stack`): proves sample #1 on the deployed Worker with zero browser openrouter.ai requests; does not prove Worker-side zero upstream calls (that needs the tail or counter check) and does not exercise AI, OCR, memory writes or Turnstile.
- `conformance:free-plan`: proves selected reject-before-claim and limit cases and the measured CPU/outcome during the probe window; does not prove behavior under real traffic bursts or every limit.
- `probe:live-session` and `probe:live-ai`: prove one real-browser session and a handful of capped free-model calls; do not prove model quality in general or availability of free models on other days.
- `deploy:preflight`: proves the build output has `_headers`, the site key and no e2e marker; does not prove the uploaded assets match it (the live `curl` and smoke do).
- Regression gates: static or screen-level; they do not prove live remote D1 behavior beyond the stack-memory local D1.

Open gaps: none. (Residuals R1-R4 are named known limits with backlog-stub fallbacks, not open gaps; if one materializes at EXECUTE time it is recorded in the phase report and the phase stays CONDITIONAL rather than VERIFIED.)

SUPPLEMENT REQUEST: none (Gate PASS).

Gate: PASS (cycle 2 re-validate; 0 FAIL, 0 CONCERN; G1-G19 closed; 4 named residuals R1-R4, none is the sole proof of a developed behavior)
Accepted by: not required for a PASS gate with no open concerns; the named residuals R1-R4 are carried as documented known limits (accepted by session, autonomous /goal execution, under the APPROVED-LIVE cap and backlog-stub rule). E1-E26 are binding on EXECUTE.

### APPROVED-LIVE (carried verbatim from the plan; binding on EXECUTE)

- Scope: live free-model calls against the deployed Worker `aduin-transaction-web` on workers.dev only.
- Cap: at most 6 free AI calls and at most 6 free OCR calls in total for the phase, at most 3 of each per UTC day. Free models only (Phase 05/06 configured models); `PAID_FALLBACK_ENABLED=false` stays.
- Planned use: AI = AC51 echo on #1 (doubles as the #1 judgment), a run on #3, one drift narrative, one counsel draft (4 of 6; 2 spare, never more than 3 on one UTC day); OCR = one row-level recheck on one scan page (5 spare).
- Stop immediately on `usage.cost > 0`, any 429 or breaker-open response, or a cap reached. Record every call (task, UTC time, model, cost) in the report.
- Not in the cap: Turnstile verification, deterministic API calls, the D4 burst (memory API and `session_new`, no upstream calls), screenshots, the stack slice and the AC39 reject-before-claim matrix.
- Any prompt change, extra call, paid model: stop and ask the user.

### Hard stops (verbatim intent)

`git push`; any route or custom domain; any touch of the protected Cloudflare zone from `CLAUDE.md` Project Rules (name and id never appear in repo text; `pnpm guard:cf` fails on them; no `/zones` API call); any paid call; any resource not named `aduin-transaction-*`; any prompt change; re-putting existing secrets; printing or committing a secret or the Turnstile secret.

### Execution waves and file ownership (what the contract expects; EXECUTE strategy recommendation)

- Wave A (parallel subagents, vitest gates only, disjoint files, no team machinery): A1 opus (`features/ai/**`, `api/{client,realMemoryApi}.ts`, `main.tsx` one line, the web env example file, its tests); A2 opus (`public/_headers`, `e2e/csp-headers.spec.ts`, `test/headers-file.test.ts`, `engine/render-pages.ts` only if the trial requires); A3 opus (`styles`, `shell`, `components`, `index.css`, `features/**` except `features/ai`, e2e specs `a11y-keyboard`, `perf-budget`, `fund-two-*`); A4 sonnet (`README.md`, `docs/DEPLOY.md`, `docs/demo/**`, `THIRD_PARTY_NOTICES.md`; never `docs/README.md` or `docs/architecture/**`); A5 opus (`apps/worker/src/app.ts` health route line plus one import line, `apps/worker/test/health.test.ts`, `apps/web/src/lib/download.ts` plus its test, `apps/web/e2e/slice.spec.ts`); A6 opus (`scripts/src/{conformance,live,screenshots,deploy}`, `scripts/test/**`, `scripts/package.json`).
- Then the serialized Playwright step AE (E21; after Wave A, before Wave B; one opus agent per owner in turn), Wave B (one sonnet vc-tester, one token per call, serial), Wave C (one opus, ordered, state-changing), Wave D (sonnet).
- Phase 10 EVL: independent vc-tester re-run of the validate-contract gate commands; the live steps are re-run only as read-only checks (headers, health, smoke).
