---
name: core-followups
description: Follow-ups from the phase 01 security review, the phase 03 visual review (U1-U4) and the phase 04a review plus M1 closure (W1-W9)
date: 2026-10-17
metadata:
  type: backlog
---

# Core follow-ups (phase 01 review)

| # | Item | Owner phase |
|---|---|---|
| F3 | `ACCOUNT_NUMBER_RE` misses digit runs over 31 digits and alpha-prefixed numbers (IBAN, "ACCT123…") — widen or document | 02 |
| F7 | `DATA_MODEL_CHECK` in memory-label-matrix.test.ts is a hard-coded copy — parse it from DATA-MODEL or keep in sync | 04b |
| F8 | THIRD_PARTY_NOTICES.md: add transitive sax (BlueOak-1.0.0), pako (MIT AND Zlib), jszip (MIT OR GPL-3.0 → elect MIT), dev deps fast-check/typescript/vitest | after 03 (seam), must land before 10 |
| R1 | `detail.explanation` / `detail.facts` (noun_window, first_context) carry short unmasked document text — mask or never persist server-side | 03/04b |
| R2 | The future AI-finding path (`contracts/ai.ts`) must apply the same masking before hashing | 05 |
| R3 | Worst-case 10 MB flat input costs ~3.7 s CPU in the browser engine — keep the Worker body cap and per-request budget | 04a |
| R4 | `payload_too_large` used for a nesting rejection — consider a dedicated code in a future contract version (not v1) | later |

## UI follow-ups (phase 03 second visual review, 2026-10-17: PASS_WITH_NOTES)

| # | Item | Owner phase |
|---|---|---|
| U1 | The "§N ¶N" locator chip is missing on the expanded finding header and on some collapsed rows. Check whether the location data is missing or long titles drop the chip | 02 / 05 (next UI touch) |
| U2 | Measure the contrast of small grey captions, locators and rail icons (4.5:1 text, 3:1 icons); adjust tokens if needed | 10 |
| U3 | Add a keyboard-focus screenshot to the design probe set; the manual keyboard pass is in P10 | 10 |
| U4 | The notes underline is thin and relies on colour (icon and chip compensate); rail badges overlap glyphs as in the mockup; 2 serious axe items in the P03 report | 10 |

## Worker follow-ups (phase 04a review + M1 closure, 2026-10-17)

| # | Item | Owner phase |
|---|---|---|
| W1 | `GET /api/health` lacks `cache-control: no-store` (Phase 00 route, static body; minor) | 04b or 10 |
| W2 | Real D1 id: replace the placeholder all-zero `database_id` in `apps/worker/wrangler.jsonc`; until then deploys use a generated no-D1 config (see `process/context/worker/all-worker.md`) | 04b |
| W3 | Review F4: `x-aduin-doc` is client-attested; derive the document id server-side or keep treating it as untrusted | 04b / 05 |
| W4 | Review F5: SQL `QuotaPort.claim` must throw on storage errors and return `ok:false` only for a genuine at-cap refusal (`Claims.marker()` reads `ok:false` as "already seen") | 04b |
| W5 | Review F14: a failed `BreakerPort.trip()` write must also set the in-isolate trip; persist the breaker (D1 row by UTC day + config fingerprint) | 04b |
| W6 | AC40 residual (Agent-Probe): real workerd CPU and hold-open timing, OpenRouter accounting of aborted/4xx requests, served-model string format; needs the live probe | 05 / 10 |
| W7 | Playwright `stack` run leaves the e2e `preview` build in the shared `apps/web/dist`; always rebuild with `pnpm --filter @aduin/web build` before a deploy (consider a separate outDir) | 10 |
| W8 | Main web bundle 568 kB (core barrel not fully tree-shaken on the main thread); code-splitting candidate | 10 |
| W9 | THIRD_PARTY_NOTICES.md rows for Phase 03 dev deps are added; transitive rows (F8 above) still due before 10 | 10 |

## Phase 02 follow-ups (detectors, fixtures, structure view, 2026-10-17)

| # | Item | Owner phase |
|---|---|---|
| P2-1 | Phase 01 adapter bug: the `edgar-exhibit-wrapper` noise rule (`TYPE`/`TEXT`/`DESCRIPTION`/`DOCUMENT`… with the `i` flag) drops any line that starts with "Type", "Text", "Description", "Document", "Sequence" or "Filename", e.g. "Type of Subscriber (check one):". Anchor it to the EDGAR wrapper form (`<TYPE>` or all-caps `TYPE:`), then re-run goldens and the corpus | next core touch (05) |
| P2-2 | Investor paths on real samples #1, #7, #10 have no ground truth (Agent-Probe only): build a ground-truth fixture per sample and assert paths | 09 / 10 |
| P2-3 | Phase 01 detectors (`ref-this-section`, `ref-label-coherence`, `undefined-term`) print "undefined" from `explain()` on sparse facts; the totality check is enforced for Phase 02 detectors only | next core touch |
| P2-4 | `(check one)` / `check one` is not an exclusivity cue in `EXCLUSIVITY_CUES`, so most real option groups read "Cue inferred" and dominate the Structure badge (#2: 38, #5: 23). Add the cue (golden impact check) or weigh option issues differently | 05 / 09 |
| P2-5 | Default masking (Phase 01 `ACCOUNT_NUMBER_RE`, 6+ digits with `-`) also masks phone numbers in quotes ("(844) #2584"); consider a phone-shape exclusion | 10 |
| P2-6 | `used-before-defined` residual false positives on titles, signature captions and headings (#2 "RIA Representative", #7/#10 "Subscription Agreement"); `unused` misses lowercase uses ("net worth", #10) and `capitalization` fires on a heading (#10) | 05 |
| P2-7 | Structure view icons `restart`, `half`, `branch`, `pin`, `radio`, `boxes`, `ext` from app.html are not in the web sprite; substitutes are used (undo, ring, jump, rule, ring, check, doc) | 10 |
| P2-8 | The "Show flow diagram" toggle renders a section/condition list, not the app.html SVG diagram | 09 |
| P2-9 | U1 locator chip: explicitly deferred from Phase 02 to Phase 05 (engine `toView.ref` lacks the paragraph part; Phase 05 touches `features/review/**` next) | 05 |
| F3 | Done in Phase 02 (`mask-widening`: digit runs over 31, IBAN, alpha-prefixed) | done |
