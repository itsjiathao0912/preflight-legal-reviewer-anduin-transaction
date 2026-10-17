---
name: subdoc-qa-mvp-phase10-pvl-iteration-002
description: Inner PVL cycle 2 report for phase 10 (deploy, sign-off, live probes, deliverables)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 2
  phase: "10"
---

# Phase 10 — inner PVL iteration 002

- Cycle 2 verdict: CONDITIONAL (0 FAIL, 8 CONCERN, 8 gaps G12-G19). G1-G11 verified closed. Applied: 8 of 8.
- G12 A6 guard: REST `/accounts/**` plus exactly one read-only `POST /client/v4/graphql` with an accountTag-only template (D4 `rowsWritten`, CPU fallback); offline test rejects any `/zones` path or "zone" query text; `wrangler d1 insights` named as alternative.
- G13 timing probe removed from `conformance:free-plan` (no AI call there); CPU/duration measured on the first counted AI call (AC51 on #1) in `probe:live-ai` via `wrangler tail`; cap block says "4 of 6, timing measured on call 1".
- G14 D4 burst reuses the cookie from the real-browser sessions (in-process or mode-600 scratchpad file, never printed); no token means named residual, backlog stub, CONDITIONAL.
- G15 session ledger (5 per IP per UTC day): smoke 1 per run, live-session 2, live-ai 1, screenshots one context; stop and defer at 4 used.
- G16 live smoke with compiled site key: no token means no failing POST; headless then `--headed`; residual R2 extended to smoke; console filter narrowed only to challenges.cloudflare.com with evidence, else CONDITIONAL.
- G17 turnstile e2e site key: widget reads `VITE_TURNSTILE_SITE_KEY` or, under `IS_E2E`, a window global via `addInitScript` (inside `turnstile-widget.ts`); spec uses `__aduinE2E.setApiBase('/')`, `useRealMemory(true)`, `page.route` fake Worker.
- G18 `app.ts` edited in two places (route line 117 plus one `jsonNoStore` import from `./proxy/errors`); Touchpoints, Blast Radius A5 row and A5 step fixed.
- G19 new serialized step A-e2e after Wave A and before Wave B: one opus agent per owner (A1, A2, A3, A5 slice), own file set only, one Playwright command at a time.
- Validate Contract section left untouched (it already holds E16-E23).
- Next: re-validate from V1.
