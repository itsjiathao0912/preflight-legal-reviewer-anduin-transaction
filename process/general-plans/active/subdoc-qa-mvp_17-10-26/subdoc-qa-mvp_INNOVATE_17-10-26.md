---
name: subdoc-qa-mvp-innovate
description: INNOVATE Decision Summary for the sub-doc QA MVP (browser-first engine + thin Cloudflare Worker proxy)
date: 2026-10-17
metadata:
  type: report
  phase: INNOVATE
  status: pending user approval
---

# Sub-doc QA MVP: INNOVATE Decision Summary (17-10-26)

Inputs: the SPEC (R1–R5, 40 ACs), the RESEARCH report, and feasibility verdicts P1 (OCR VIABLE), P2 (JSON VIABLE, narrow) and P4 (server parse NOT-VIABLE).
vc-predict verdict: **CAUTION, proceed**. Every risk has a mitigation or a no-LLM fallback.

## Chosen approach: A. Browser-first engine + thin Cloudflare Worker proxy

| # | Decision | Choice |
|---|---|---|
| 1 | Split | **Browser Web Worker:** parse, structure, graph, deterministic checks, diff, template counsel drafts, gate, DOCX export, PDF page rendering for OCR. **Worker (Free):** `/api/ai`, `/api/ocr`, `/api/quota`, `/api/cache`, limits, spend ledger; it never parses. **Static assets:** app, samples, `/precomputed/{hash}.json`. Lookup order: static → D1 cache → LLM. The proxy holds the browser request open during 20–90 s LLM calls (streaming) and never relies on `waitUntil`. |
| 2 | Frontend | React + Vite SPA served as Workers static assets (one deploy, `aduin-transaction-web`); Tailwind + shadcn/ui (Radix); Zustand; TanStack Table. The reading view is rendered from the document model and never injects raw HTML. Scans: page image with a region overlay. |
| 3 | Document model | Every adapter (HTML via htmlparser2, PDF text via pdf.js/unpdf, DOCX via mammoth→HTML, OCR JSON) emits a **line stream with cues**. One shared structurer builds blocks with stable anchors (hash of doc + structural position), a scoped section tree, references, conditionals, option groups, defined terms and fields. The structurer also handles: table-cell merge before heading detection; numbering-restart scopes; statutory-cite exclusion (`of the … Act/Code`, U.S.C., CFR); "this Section N" resolved against the enclosing section; checkbox glyph normalization; an auditable EDGAR-noise pre-pass. |
| 4 | Detectors | Pure, deterministic `Detector {id, class, severity, run(graph)}` registry with a zod finding schema. A new **label-coherence** rule covers the #3/#5 swaps: compare the noun before a reference with the target's labels. It needs a prototype and a severity cap. LLM role: one batched strict-schema call per doc that judges graph-selected candidates. AI-only findings are labeled "AI suggestion" and cannot gate. A quote must literally exist in the document. Temperature 0, versioned prompts, cached by hash. |
| 5 | Version diff | Section alignment (scope path + heading/body similarity) + jsdiff + extractors (terms, fees %, must/required lines) + rename inference (Units→Shares, …) + a findings delta (fixed / still present / new). Same pipeline for every format. **No Docxodus.** |
| 6 | OCR | The browser renders and downscales (≈1500–2000 px, JPEG 0.8) and calls `/api/ocr` with `nvidia/nemotron-3.5-super-vl:free` (strict JSON). Cache key: page hash + params + model + prompt/schema version. Up to 3 pages run in parallel; checks stream as pages arrive. **PDFs are never sent to OpenRouter**, which avoids the implicit paid mistral-ocr default. The 22-page sample set is precomputed and shipped. Visitor OCR pages are capped. |
| 7 | State | **IndexedDB (Dexie):** analyst decisions, counsel answers, undo log, JSON export/import. **D1:** AI/OCR cache (≈7-day TTL), counters via atomic `UPDATE … WHERE count < cap RETURNING`, spend ledger. No R2, KV or Durable Objects. Identity: signed cookie + daily-salted IP hash. Limits are counted in **requests** (e.g. ~35 of 50/day for visitors, the rest held in reserve). Turnstile runs on the first AI call. Paid ids are never mixed into the free `models:[]` array; paid fallback is a separate, spend-capped call that stays dormant until credits exist. Units are claimed before the call and refunded on failure. |
| 8 | DOCX | Export: `docx` (MIT), lazy-loaded, verified by parsing the output back. Input: mammoth (BSD-2); numbering is reconstructed and labeled as such. |
| 9 | Tests | Vitest on core (Node = browser code via htmlparser2), fast-check, golden-corpus + seeded fixtures, recorded LLM responses (no live calls in CI), `@cloudflare/vitest-pool-workers` with local D1 + an OpenRouter stub (429/402/timeout/malformed), Playwright + axe-core. AC40 is checked against the deployed Free Worker. |
| 10 | Layout | pnpm workspaces: `packages/core`, `apps/web`, `apps/worker`, `scripts/` (precompute, fixture builders), `fixtures/`. |

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| B. Server-centric (Next/Remix on Workers, or a Worker-side parser) | P4: parsing costs 31–394 ms of CPU, far over the 10 ms limit; Queues/DO on Free are unverified. Violates R1. |
| C. Static site with precomputed results only | No visitor uploads, so it violates R2. Its precompute idea is reused in A. |
| Docxodus WASM diff | Large bundle, unverified startup, DOCX-only. |
| PDF viewer + highlighter for MVP | The model-based reading view gives uniform, testable highlights. A PDF text-layer view is a stretch goal. |
| R2 / Durable Objects / KV | No uploads are stored; D1 conditional updates suffice; KV allows only 1k writes/day. |
| LLM as free discovery engine | P2 showed inconsistent output. The LLM only verifies and interprets graph-selected candidates. |

## Phase-0 spikes (kill criteria, non-blocking for PLAN)

| # | Question | If it fails |
|---|---|---|
| S1 | Does a streaming hold-open proxy survive 54–90 s on workers.dev within 10 ms CPU? | Uploads go no-LLM; samples keep precomputed AI. |
| S2 | Can a ~400 KB image body be proxied within the CPU limit? | Shrink images further; use string templating. |
| S3 | Do 2 OCR pages per request preserve the footnote markers? | One page per request; tighter visitor OCR cap. |
| S4 | Does the model return usable region coordinates? | Page-level highlight only. |
| S5 | Do D1 Free quotas, `UPDATE…RETURNING` and cron on Free work? | Lazy purge only. |
| S6 | Real workerd CPU on the proxy path; confirm the script size limit. | — |
| S7 | Browser timing for the largest sample and a 22-page PDF (AC29). | Tune the adapters. |

Other risks:
- Free model ids rotate, so the model list must be configurable.
- Prompts must be frozen before the final precompute.
- DOCX numbering loss.
- No OCR ground-truth transcript exists yet.
- PLAN must confirm library APIs via vc-docs-seeker.

## Suggested phase order (PLAN validates)

| Phase | Scope | Depends on |
|---|---|---|
| 0 | Scaffold + spikes S1–S7 | — |
| 1 | Core model, HTML adapter, structurer, graph, finding schema, golden detectors (#1, #3/#5, #11), test harness | 0 |
| 2 | Remaining detectors, flags (NTD, placeholders, sensitive data), terms, seeded fixtures | 1 |
| 3 | Web shell: reading view, findings, triage, persistence, structure view | 1 |
| 4 | Worker: proxy, limits, D1, Turnstile, abuse tests | 0 |
| 5 | LLM tasks, recordings, AI lane UI, provenance, quota banners | 2, 3, 4 |
| 6 | PDF/DOCX adapters, OCR pipeline, precompute | 1, 4 |
| 7 | Version diff | 2 |
| 8 | Counsel sheet, answers, gate, DOCX export | 3, 5, 7 |
| 9 | Deploy, a11y, perf, final precompute, README/video/slides | all |

Phases 3 and 4 can run in parallel.

---

## Revision R6 (2026-10-17): Review Memory + investor paths + outline export

SPEC R6 (user-approved) added Review Memory (user PRD), investor-type paths, a JSON logic outline and sibling-doc diff framing.
**Approach A still holds.** Full delta, D1 data model (19 tables), lookup SQL, flows, migrations and new risks:
`subdoc-qa-mvp_DATA-MODEL_17-10-26.md`.

| Area | Change |
|---|---|
| D1 role | Becomes the **system of record** for workspaces, analysts, firms, funds, document metadata, runs, findings (best-effort), append-only decisions, counsel Q&A, firm rules, rule evidence and audit. Cache, counters and ledger stay. |
| Worker | Adds session, memory lookup, runs/findings, decisions (+ revoke), counsel, rules (+ approve/reject/revoke), firm memory, audit and export endpoints. Still no parsing. Worst endpoint is ~20 D1 queries, ~1–3 ms CPU (estimated). |
| AI | The Worker injects the active firm rules into the prompt. The cache key adds `rules_hash`. |
| IndexedDB | Shrinks to document bytes, parsed-model cache, UI state, drafts and the decision outbox. |
| Fingerprint | `sha256("fp1|"+firm+"|"+class+"|"+sha256(normalize(quote)))`, one core implementation (`@noble/hashes`). The browser uses it for lookups; the Worker re-checks on writes. |
| Isolation | Signed cookie `{workspace, analyst}`, composite `(workspace_id, id)` keys + FKs, every query binds `workspace_id`. The demo seed is copied into each sandbox, and no cookie is ever bound to the demo workspace. |
| Learning | Rule proposal is computed on write (≥3 same-reason dismissals per `pattern_key`). It takes effect only after an analyst approves it. |
| Retention | Lazy purge from new sessions, at most once per hour. Cron is unverified on Free, so it is not relied on. |
| New risks | **D1 Free 100k rows written/day** (main risk) and sandbox-minting abuse; spikes S8–S10 cover them. Phases 4b (D1/memory) and 8b (memory UI, P1) are added. |

Rejected for memory:
- IndexedDB-only: no shared audit, and it breaks the server-snippet rule.
- KV: write limit.
- Durable Objects: Free plan.
- Read-only demo overlay: breaks isolation.
- Per-row INSERTs: exceed the 50-query limit.
