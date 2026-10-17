---
name: note:variance-render-first-live-turnstile
description: "Render-first with a human-solved Turnstile session on the live site for Variance Phase 02 (token-less proof exists, token-present path unevidenced)"
date: 17-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
---

# Render-first on live with a real Turnstile session (Phase 02)

**Context:** Phase 02 e2e and Phase 05 `probe:live-variance` prove variance findings and changes render WITHOUT a Turnstile token. They do not prove the same render path with a human-solved challenge present (widget iframe, CSP, session bootstrap racing the render). Phase 10 showed render paths gated on Turnstile only appear with the site key compiled in.
**Why deferred:** automated Chromium gets no token (R2); needs a human in a real browser.
**Owner:** the user. **Trigger:** with the live-regression operator run (variance-live-regression-operator_NOTE_17-10-26.md).
**Steps:** real browser, solve the challenge, open Fund III vs Fund II (variance demo); confirm findings and 7 changes render in about 1 s without waiting for the token or session POST; confirm no CSP violations in the console. Record in a REPORT.

