---
name: subdoc-qa-mvp-phase10-evl-iteration-001
description: EVL iteration 001 for phase 10 - confirmation after go-live (38a3b2f) found a live render-blocking bug; fix cycle follows
date: 2026-10-17
metadata:
  type: iteration-report
  domain: tests
  iteration: 001
  phase: "10"
---

# phase10 - EVL iteration 001 (confirmation after go-live at 38a3b2f)

- Commit under test: 38a3b2f (real D1, Turnstile widget, CSP, live script fixes), live version 67c796ff.
- Gates: repo gates and live headers, health, memory health and stack smoke were green. The independent live check on firm samples found a real defect: with the site key compiled in, firm documents (#3-#6) showed no findings until the Turnstile-gated session bootstrap failed (over 172 s on #5). Preview and e2e had no site key, so the suite never saw it.
- Cause: `openDocument` awaited three session bootstraps before `phase: 'ready'`, each a fresh challenge, and failures were not cached.
- Fix cycle: af59da6 (render-first, 60 s cached bootstrap failure, no background interactive challenge, `data-memory-state` attribute and fixture wait). New tests: `turnstile-no-block` unit (9) and e2e (2). Web unit 223, preview e2e 173, stack-memory 10 twice.
- Result: CONTINUE (re-confirm after redeploy; see iteration 002).
