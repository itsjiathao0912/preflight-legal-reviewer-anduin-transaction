---
name: subdoc-qa-mvp-phase10-pvl-iteration-001
description: Inner PVL cycle 1 report for phase 10 (deploy, sign-off, live probes, deliverables)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 1
  phase: "10"
---

# Phase 10 — inner PVL iteration 001

- First-pass verdict: CONDITIONAL (0 FAIL, 11 CONCERN, 11 gaps). Applied: 11 of 11.
- G1 live smoke `global_ok`: `slice.spec.ts` handed to A5 with an env-aware check (unset keeps false; `SLICE_BASE_URL` set means boolean, observed value recorded), `consoleErrors` stays empty.
- G2 missing scripts: new task A6 (opus, Wave A) owns `scripts/src/{conformance,live,screenshots,deploy}`, `scripts/test/**`, `scripts/package.json` with `conformance:free-plan`, `probe:live-session`, `probe:live-ai`, `shots:live`, `deploy:preflight`, each offline-tested with host allow-list, `/accounts/` only, call ledger cap, stop on cost, no secret echo. B3 replaced by `precompute:ai --from-recordings --check`, `record:author --check`, `fixtures:check` (verified in script sources; `precompute:ocr` has no `--check`, dropped).
- G3 strategy: no agent team; Wave A disjoint parallel subagents running vitest only; Playwright serialized after Wave A; Wave B authoritative for typecheck and lint.
- G4 A1 file set (`features/ai/**`, `api/{client,realMemoryApi}.ts`, `main.tsx` one line, created `.env.example`) and `turnstileToken` widened to Promise.
- G5 A3 set (styles, shell, components, index.css, features except ai; no api, no main.tsx); A2 may edit `engine/render-pages.ts` only on traced pdfjs violation.
- G6 CSP assertion rule: no `unsafe-eval` anywhere, no `unsafe-inline` in script-src/default-src, evidence-based `style-src 'unsafe-inline'` fallback as residual; csp-headers spec parses `_headers` and uses the e2e bundle as proxy; production proof is live; `connect-src` for Turnstile only on live evidence.
- G7 perf-budget labelled e2e-mode bundle, thresholds 5 s and 2 s, in-page measure, serial re-run of flakes.
- G8 live probe ordering and commands, CPU source, AC34 live zero-upstream method, no-token fallback with backlog stubs and CONDITIONAL.
- G9 AI cap day split, forced cache miss via firm rules, planned AI 4 of 6.
- G10 D3 risk evidence pack under `harness/phase-10/` with validator run and gate row.
- G11 health line `app.ts:117` to `jsonNoStore`, C3 "deferred to C7" fixed to C5, registry `## Phase 10` revision note written now, before/after name diff replaces the account listing, output-dir and `_headers` checks through `deploy:preflight`, E10 redeploy note.
- Extra constraint from peer session: Phase 10 must not create or edit `docs/README.md` or `docs/architecture/**`; root README gets a short Documentation section linking both; architecture summary kept brief. Added to A4, blast radius, touchpoints and registry.
- Validate Contract section left untouched for the re-validation pass.
- Next: re-validate from V1.
