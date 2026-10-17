---
phase: phase-10-deploy-final
date: 2026-10-17
status: COMPLETE_WITH_GAPS
feature: subdoc-qa-mvp
plan: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-10-deploy-final_PLAN_17-10-26.md
name: report:subdoc-qa-mvp-phase-10-deploy-final
description: "Phase 10 EXECUTE report (in progress): step AE serialized Playwright first-green for Wave A owners A1, A2, A3, A5 — all green; Waves B-D pending"
---

# Phase 10 deploy-final — EXECUTE report

Status above is for the phase so far: step AE is complete; Waves B, C and D have not run yet.

## AE results

All four owners are green. Playwright ran one command at a time on port 4317, with no concurrent runs and stack-memory never run alongside.

| Owner | Spec(s) | First run | Final |
|---|---|---|---|
| A1 | `turnstile-widget` | 1 failed / 1 passed | 2/2 passed |
| A2 | `csp-headers` (report-only trial, then enforced) | 3 failed (trial) | 3/3 passed (report-only and enforced); `headers-file` unit 4/4 |
| A3 | `a11y-keyboard` | 1 failed / 2 passed | 3/3 passed |
| A3 | `perf-budget` | 2/2 passed | 2/2 passed (no flake) |
| A3 | `fund-two` | 4/4 passed | 4/4 passed |
| A3 regressions | app-shell 8, structure-view 4, layout-vs-mockup 5, a11y-smoke 1, filter-sort 4, triage-actions 3, dismiss-requires-reason 2 | all passed | all passed |
| A5 | `slice.spec.ts` (local `--project=stack`, SLICE_BASE_URL unset) | 1/1 passed | 1/1 passed |

Final whole-suite runs:
- `pnpm --filter @aduin/web test:e2e` (preview): **171 passed, 1 skipped** (design-probe, opt-in only), 0 failed, 1.3 min.
- `pnpm --filter @aduin/web test`: 29 files, **210/210 passed**.
- `pnpm typecheck`: green (all packages).
- `pnpm lint`: **fails on Prettier for 11 files, all under `scripts/**`** (owned by A6, which is still being edited concurrently). No web or worker file is flagged; `eslint apps/web/{src,e2e}` exits 0. Wave B is the authoritative lint gate.

### A1 fix
- Cause: test 2 (E24) assumed that opening Memory triggers the session bootstrap. With no document open, Memory shows "Open a document for a law firm" (`noFirm`) and never calls `ensureSession`. This was a test defect, not a product defect.
- Fix: test 2 now uses the same deterministic trigger as test 1, an analyst-name edit (`changeAnalystName` re-bootstraps). The E24 assertion is unchanged: execute is called and no POST /api/session is sent.
- `.gitignore`: added `!apps/web/.env.example` so the example file can be committed.

### A2 CSP trial evidence (`CSP_REPORT_ONLY=1`)
`[csp-trial]` lines came from 3 steps: load, scan viewer / pdf render, docx export. They showed three violation sources:
1. `font-src` blocked `data:` (5 per page load, 15 total). Vite inlined the small @fontsource woff2 subsets as data: URIs.
2. `script-src` blocked `eval` at `index-*.js:11`. Traced to Zod 4's JIT capability probe (`try { Function('') }`) and not to pdfjs, so `render-pages.ts` was not touched.
3. `style-src-elem` blocked `inline` at `index-*.js:77`. Traced to react-style-singleton (`document.createElement('style')`, used by Radix dialog/popover scroll-lock).

Fixes:
1. `vite.config.ts`: `build.assetsInlineLimit` now returns `false` for font files, so fonts are emitted as files and `font-src 'self'` holds. This file is outside A2's listed set (deviation D1).
2. New `src/zod-jitless.ts`, imported first in `main.tsx`, pre-seeds `globalThis.__zod_globalConfig = { jitless: true }`. Zod reads this at module load, so the probe never runs. This is also outside A2's listed set (deviation D2). No unsafe-eval was added.
3. Allowed fallback `style-src 'self' 'unsafe-inline'` (named residual R-CSP-STYLE, evidence = trial line 3 above).

Final CSP (enforced, `apps/web/public/_headers`):
```
default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; worker-src 'self' blob:; connect-src 'self'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```
After the fixes, both the report-only run and the enforced run had 0 violations and 0 CSP console messages. No unsafe-eval was added and script-src has no unsafe-inline (headers-file unit test enforces this).

### A3 fixes (two Phase 03 serious axe items)
- `label-content-name-mismatch` on `.docsw`: the aria-label now starts with the visible text (`"{name} {firm}, switch document"`). A whitespace node was added between the name and firm spans so the visible text and the accessible name match with a space. Strict color-contrast passed with no relaxation.
- `scrollable-region-focusable` on `.docscroll` (DocPane): `tabIndex={0}`, `role="region"`, `aria-label="Document text"`. This mirrors ScanPane.

### Perf numbers (e2e-mode bundle, vite preview, Desktop Chromium)
- Sample 02 (378,698 B), open to Checks done: **169 ms** (budget 5000).
- Sample 11 (49,868 B): **104 ms** (budget 2000).

### Files changed in AE
- `.gitignore` (+1 line)
- `apps/web/e2e/turnstile-widget.spec.ts` (A1)
- `apps/web/public/_headers` (A2)
- `apps/web/vite.config.ts` (A2, deviation D1)
- `apps/web/src/zod-jitless.ts` (new), `apps/web/src/main.tsx` (first import) (A2, deviation D2)
- `apps/web/src/shell/DocSwitcher.tsx`, `apps/web/src/features/review/components/DocPane.tsx` (A3)

## Plan Deviations
- D1, D2: the A2 CSP fixes landed in `vite.config.ts` and a new `src/zod-jitless.ts` with a `main.tsx` import, not in A2's listed files. The plan's allowed fallbacks did not cover these evidence-backed causes. Both alternatives were worse: `font-src data:` is forbidden by the headers-file unit test, and unsafe-eval is banned. Both changes are within the phase blast radius (`apps/web`), and `vite.config.ts` is already a registry-listed web file.
- D3: the plan says A5 runs the slice spec in the "preview project", but `playwright.config.ts` ignores `slice.spec.ts` in preview. It was run with `--project=stack` locally (wrangler dev, SLICE_BASE_URL unset) as E21 says ("A5 slice locally"). No live calls were made.

## What Was Skipped or Deferred
- Waves B, C and D are not started (out of AE scope).

## Test Infra Gaps Found
- The `stack` project's webServer runs a plain web build into the shared output directory. Any later preview run rebuilds with `--mode e2e` (observed), so there is no stale-bundle risk. Keep the runs serialized.

## Closeout Packet
- AE: complete, all four owners green. Next step: Wave B (sonnet vc-tester, serial).
- Residuals: R-CSP-STYLE (`style-src 'unsafe-inline'` for Radix scroll-lock styles); root lint is red only from `scripts/**` Prettier, pending A6.

## Forward Preview
### Test Infra Found
- `slice.spec.ts` runs only under `--project=stack`.
### Blast Radius Changes
- Added `apps/web/src/zod-jitless.ts`; `vite.config.ts` now sets `assetsInlineLimit`.
### Commands to Stay Green
- `pnpm --filter @aduin/web test:e2e csp-headers`, `pnpm --filter @aduin/web test headers-file`, `env -u SLICE_BASE_URL pnpm --filter @aduin/web exec playwright test --project=stack`.
### Dependency Changes
- None.
