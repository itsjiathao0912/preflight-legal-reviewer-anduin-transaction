---
name: ref:subdoc-qa-mvp-spike-results
description: "Sub-doc QA MVP — Phase 00 spike ledger: confirmed pins, platform facts, S1-S10 verdicts, fallbacks and plan impact"
date: 17-10-26
metadata:
  node_type: memory
  type: reference
  feature: subdoc-qa-mvp
  phase: phase-00
---

# Spike Results and Confirmed Facts (Phase 00)

Machine-checked by `pnpm --filter @aduin/scripts spike:check` (section `## Spike verdicts`).
Measured 2026-10-17. Local runs on a dev Mac (Chromium 156 headless shell); remote on account workers.dev subdomain, Worker `aduin-transaction-spike` (deleted afterwards; account listing and secret listing confirmed empty).

## Spike verdicts

| Spike | Verdict | Measured | Fallback adopted | Owner phase |
|---|---|---|---|---|
| S1 | PASS | 10/10 hold-open runs completed (5x54 s, 5x90 s), outcome ok, 0 exceptions; cpuTime max 6 ms (1-6 ms); 2 live free-model calls (liquid/lfm-2.5-2.6b:free) after heartbeat, both HTTP 200, cpuTime 5 ms (54 s) and 4 ms (90 s) | none | 00 |
| S2 | PASS-WITH-RISK | 400,045 B base64 JSON body, 5 runs each: JS-transform pass-through cpuTime 4/5/6/9/10 ms (avg 6.8, 2 of 5 in the 7-10 ms grey zone); parse + string-template cpuTime 1 ms in 5/5 | none (kill not fired); recommendation: use parse + string-template body, avoid per-chunk JS TransformStream on the image path | 00 |
| S3 | DEFERRED(06) | | pre-adopted: one page per request; visitor OCR cap 6 pages/day | 06 |
| S4 | DEFERRED(06) | | pre-adopted: page-level highlight; location text "page N, line M" | 06 |
| S5 | DEFERRED(04b) | | pre-adopted: two-statement claim inside db.batch; lazy purge only | 04b |
| S6 | PASS | local: spike entry (route table + zod + @noble/hashes) via `wrangler deploy --dry-run`: 791 KiB raw, 123 KiB gzip; remote CPU on S1 route max 6 ms | none | 00 |
| S7 | PASS | #2 (378,698 B, 530 rows) SAX parse+merge 10 ms; ILPA PDF 25 pages render+downscale avg 40 ms, max 356 ms; 22 scan JPEGs downscale avg 36 ms, max 47 ms | none | 00 |
| S8 | DEFERRED(04b) | | pre-adopted: chunked IN of 90; app-layer enforcement instead of triggers; child-first deletes; lazy purge | 04b |
| S9 | DEFERRED(04b) | | pre-adopted: findings persistence opt-in; session seed copy skipped (read-only demo) | 04b |
| S10 | DEFERRED(04b) | | pre-adopted: lighter validator; chunk size 25 | 04b |

Notes on method:
- S1 and S6-remote CPU were read from `wrangler tail --format json` top-level `cpuTime` / `wallTime` / `outcome` (20 events captured). Heartbeat every 10 s via `TransformStream` + `ctx.waitUntil`.
- S2 "pass-through" streamed the request body through a JS `TransformStream` byte counter (no real upstream, to avoid a third-party sink). A native `fetch(upstream, { body: request.body })` pipe was not measured; it may be cheaper than the JS transform. The parse variant does `JSON.parse` + a string-template rebuild of the OpenRouter body (no re-stringify of the base64).
- S6 CPU was measured on the spike Worker (no zod on that route), not on the full app bundle; the full proxy path CPU is re-measured in Phase 04a.
- S7 timings are one warm run on a fast dev machine; visitor hardware will be slower (not proven).

## Deferred spike specs (copied from the Phase 00 plan; run at owner phase step A)

| # | Question | Method | Pass | Kill criterion | Fallback | Class | Runs in |
|---|---|---|---|---|---|---|---|
| S3 | Do 2 OCR pages per request keep footnote markers? | `appa1-pg1` plus `appa1-pg2` in one prompt, strict JSON, nemotron-3.5-super-vl:free, 3 runs (≤ 4 requests) | markers kept 3/3 | marker lost in ≥ 2 of 3 | One page per request; visitor OCR cap 6 pages/day | live | 06 (step A) |
| S4 | Does the model return usable region coordinates? | Same pages, normalized boxes per line vs hand-drawn boxes for 3 lines (≤ 3 requests) | IoU ≥ 0.3 on ≥ 50% of lines | coordinates absent or IoU < 0.3 on ≥ 50% | Page-level highlight; "page N, line M" | live | 06 (step A) |
| S5 | D1 Free quota facts, `INSERT … ON CONFLICT DO UPDATE … WHERE … RETURNING` atomic counter, Cron on Free | docs + local concurrency test (20 parallel claims, cap 10) + one remote read | exactly 10 succeed locally | atomicity violated or RETURNING unsupported | Two-statement claim in `db.batch`; lazy purge only | local (+needs-cf) | 04b (step A) |
| S8 | D1 SQL surface (`json_each` one param, 100-param cap, partial unique index EXPLAIN, triggers with RAISE, WITHOUT ROWID + composite FK, defer FK, trigger vs purge DELETE, batch+fetch share 50, Cron on Free) | tests with real migrations + one remote check of the shared-50 budget | all as designed | any differs | Chunked `IN (?,…)` of 90; app-layer enforcement; child-first deletes; lazy purge | local (+needs-cf) | 04b (step A) |
| S9 | Rows-written calibration | remote throwaway D1: 200-finding run, a decision, a session; read `meta.rows_written` | run ≤ ~250, decision ≤ ~15, session ≤ ~60 | estimate > 2x | Findings persistence opt-in; session seed copy skipped | needs-cf | 04b (step A) |
| S10 | Cold-start CPU of the memory path (HMAC verify, 128 KB JSON parse, @noble/hashes, validator) | spike route + tail, zod vs zod/mini | ≤ 5 ms | > 8 ms | Lighter validator; chunk size 25 | needs-cf | 04b (step A) |

Owner-phase step A references confirmed: Phase 04b plan lines 60, 110-111 (S5, S8, S9, S10); Phase 06 plan line 49 (S3, S4).

## Pins

Confirmed against the npm registry on 2026-10-17 (`npm view <pkg> version license peerDependencies`) and by a clean `pnpm install`. Exact pins in the package manifests.

| Library | Pinned | License | API notes confirmed |
|---|---|---|---|
| react / react-dom | 19.3.1 | MIT | `createRoot`, `act` from `react` |
| vite | 8.3.4 | MIT | `@vitejs/plugin-react` 6.1.2 peers `vite ^8` |
| tailwindcss + @tailwindcss/vite | 4.3.3 | MIT | CSS `@import 'tailwindcss'` |
| @radix-ui/react-slot (shadcn base) | 1.5.0 | MIT | further Radix primitives added by Phase 03 (registry note) |
| zustand | 5.0.15 | MIT | |
| @tanstack/react-table | 9.3.1 | MIT | major 9 (check API in Phase 03) |
| htmlparser2 | 12.0.0 | MIT | `new Parser({ onopentag, ontext, onclosetag }, { decodeEntities: true })`, `write`/`end` (used in S7) |
| unpdf | 1.9.0 | MIT | |
| pdfjs-dist | 6.4.299 | Apache-2.0 | `GlobalWorkerOptions.workerSrc`, `getDocument({url}).promise`, `page.render({ canvas, viewport })` (v6 takes `canvas`), worker file `pdfjs-dist/build/pdf.worker.mjs` (used in S7) |
| mammoth | 1.13.0 | BSD-2-Clause | |
| diff (jsdiff) | 9.0.0 | BSD-3-Clause | |
| docx | 9.11.0 | MIT | lazy-load in web |
| dexie | 4.4.6 | Apache-2.0 | |
| comlink | 4.4.2 | Apache-2.0 | |
| zod | 4.6.7 | MIT | `z.object`, `safeParse` (used in S6 entry); zod/mini choice in S10 |
| @noble/hashes | 2.4.0 | MIT | import paths need `.js`: `@noble/hashes/sha2.js` (`sha256`), `@noble/hashes/utils.js` (`bytesToHex`) |
| vitest | 4.1.12 | MIT | latest is 5.0.5; kept on 4.x per plan |
| @cloudflare/vitest-plugin | 1.4.4 | MIT | **replaces deprecated @cloudflare/vitest-pool-workers 0.23.0** (see decision below). Config: `plugins: [cloudflareTest({ wrangler: { configPath } })]` from `@cloudflare/vitest-plugin`; types `@cloudflare/vitest-plugin/types`. `cloudflare:test` exports: `SELF, env, applyD1Migrations, createExecutionContext, waitOnExecutionContext, createScheduledController, createMessageBatch, getQueueResult, reset, runInDurableObject, ...`; **no `fetchMock`**. `readD1Migrations` is exported from `@cloudflare/vitest-plugin` (config side). |
| fast-check | 4.10.2 | MIT | |
| @playwright/test | 1.64.1 | Apache-2.0 | Chromium headless shell 156.0.8078.4 installed |
| @axe-core/playwright | NOT INSTALLED | MPL-2.0 | outside the MIT/BSD/Apache/ISC rule; user decision needed (see Plan impact) |
| typescript | 6.0.3 | Apache-2.0 | typescript-eslint 8.71.2 peers `>=4.8.4 <6.1.0` (TS 7.0.2 is latest but out of range) |
| typescript-eslint / eslint / @eslint/js | 8.71.2 / 10.13.0 / 10.0.1 | MIT | flat config `tseslint.config(...)` |
| prettier | 3.9.10 | MIT | |
| tsx | 4.23.15 | MIT | scripts runner |
| jsdom | 30.1.3 | MIT | vitest `environment: 'jsdom'` |
| @cloudflare/workers-types | 5.20261016.1 | MIT OR Apache-2.0 | chosen over `wrangler types` for a stable checked-in typing |
| wrangler | 4.151.1 | MIT OR Apache-2.0 | `assets.run_worker_first: ["/api/*"]` array form accepted by deploy/dev; `deploy --dry-run --outdir` works without auth |
| esbuild | 0.28.2 | MIT | added to @aduin/scripts (S7 browser bundle) |
| pnpm | 11.13.1 | MIT | `allowBuilds: { esbuild, workerd }` sufficient: install exit 0, no ERR_PNPM_IGNORED_BUILDS; pnpm also auto-added `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml` |

Runner decision (A1, contract advisory E2): migrated to `@cloudflare/vitest-plugin` 1.4.4. Reason: 0.23.0 is deprecated with no future updates; the plugin peers `vitest ^4.1.0 || ^5.0.0` and the same `cloudflareTest` config helper; worker health and seam tests pass on it.

## Facts

| Fact | Confirmed value (source) | Matches plan? |
|---|---|---|
| Workers Free CPU | 10 ms per HTTP request and per Cron invocation; wait on fetch/D1 not counted (developers.cloudflare.com/workers/platform/limits) | yes |
| Workers Free subrequests | 50 per request | yes |
| Workers Free requests | 100,000/day | yes |
| Workers memory | 128 MB per isolate | yes |
| Worker size | 64 MiB **uncompressed**, "There is no compressed size limit" | differs from plan wording ("compressed script size limit 3 MB historic") — size risk lower than assumed |
| Worker startup time | 1 s | n/a (new) |
| Cron Triggers on Free | available, 5 per account | yes |
| Static asset requests | "free and unlimited" (pricing page); 20,000 files/version, 25 MiB per file on Free | yes |
| D1 Free | 5M rows read/day, 100k rows written/day, 500 MB per DB, 5 GB per account, 100 bound params per query, 50 queries per invocation (Free) | yes |
| D1 batch vs 50-query budget | per-statement limits apply inside `db.batch()`; whether a batch counts as one query against the 50 is not stated: S8 remote check (04b) | open (owner 04b) |
| Turnstile | Free plan exists | yes |
| OpenRouter free limits | Tiered by "credits purchased (all time)" with per-minute and per-day ceilings for `:free` ids; `GET /api/v1/key` returns `free_model_daily_requests`. Numeric values are rendered client-side and were NOT confirmed (plan's 20/min, 50/day, 1000/day carried as unconfirmed) | partially |
| Free model ids listed | 16 `:free` ids with 0 prompt/completion price on 17-10-26, incl. `nvidia/nemotron-3.5-super-vl:free` (S3/S4) and `liquid/lfm-2.5-2.6b:free` (used in S1) | yes |

## Plan impact

- Phases 01, 04a, 04b: the Workers test runner is `@cloudflare/vitest-plugin` 1.4.4 (not `@cloudflare/vitest-pool-workers`). Same `cloudflareTest` helper; `readD1Migrations` imports from `@cloudflare/vitest-plugin`; `applyD1Migrations` from `cloudflare:test`. Phase 04b plan line 56 and Phase 01 F0 wording ("the major pool-workers peers") should be read as the plugin; vitest stays 4.1.12.
- Phases 04a, 06: `fetchMock` is not available in `cloudflare:test`; inject `fetch` via `createApp(deps)` (already pre-wired: `AppDeps.fetch`).
- Phase 01 F0: `htmlparser2`, `zod`, `@noble/hashes`, `fast-check`, and scripts `test:golden`/`test:property`/`test:corpus` are already in `packages/core/package.json`; F0 only adds `test:vectors` and the ESLint rule.
- Phases 03, 10 (a11y): `@axe-core/playwright`/`axe-core` are MPL-2.0, outside the project license rule; not installed. User decision needed: allow MPL-2.0 as a dev-only test tool, or replace the axe scan with a different approach. `@aduin/web` `test:a11y` currently runs Playwright with `--grep @a11y --pass-with-no-tests`.
- Phase 04a / 05: S2 recommends building the OCR upstream body by string template after parsing (1 ms), not a per-chunk JS stream transform (up to 10 ms).
- Phase 04a S6 note: script size limit is 64 MiB uncompressed; the 1 MiB / 2.5 MiB gz thresholds are conservative.
- Phase 04b: `apps/worker/wrangler.jsonc` already has `vars.PAID_FALLBACK_ENABLED = "false"`; cron (`triggers.crons`) not yet present (04b adds it as a one-key edit).
