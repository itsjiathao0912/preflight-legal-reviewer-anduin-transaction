---
name: plan:subdoc-qa-mvp-phase-06-pdf-docx-ocr
description: "Sub-doc QA MVP — Phase 06: PDF text and DOCX adapters, browser OCR pipeline over /api/ocr, scan viewer with positions and confidence, OCR precompute"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-06
---

# Phase 06 — PDF, DOCX, OCR and Precompute

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-06-pdf-docx-ocr_REPORT_17-10-26.md

---

## Overview

Adds the remaining input formats, all browser-side (Phase P4 verdict: server parsing is NOT-VIABLE on Workers Free): text PDF via pdf.js/unpdf, DOCX via mammoth→HTML into the existing HTML adapter (numbering reconstructed and labeled as such), and scanned PDF/images via a browser OCR pipeline: render and downscale (≈1500–2000 px, JPEG 0.8), call `/api/ocr` (Phase 04a) with `nvidia/nemotron-3.5-super-vl:free` strict JSON, up to 3 pages in parallel, per-page cache, results stream in as pages arrive, line stream gets `page` and `region`, per-page confidence shown, low-confidence pages marked. A scan viewer shows the page image beside the extracted text. OCR unavailable (quota, budget, no key, S1 fail) degrades to page images with a "text not extracted" notice. The 22-page sample #9 set is precomputed and shipped. Context routers: `process/context/all-context.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`; feasibility P1 (OCR VIABLE): free vision model read the Account Type grid 3/3, latency 17–88 s/page.

UI contract: scan viewer reuses the approved review-workspace tokens and layout; Step A0 sketches the scan viewer (page image + text lines + confidence badge + region highlight) as `design/mockups/scan-viewer.html` before building.

## Phase Completion Rules

- CODE DONE = adapters, OCR pipeline, viewer, tests committed.
- VERIFIED = Exit Gate green, validate-contract written, spike S3/S4 verdicts recorded, ground-truth transcript and CER report recorded (not gated), regression: Phase 01 goldens, Phase 03 e2e, Phase 04a suites. The precompute live run needs an APPROVED-LIVE line (free model, max requests) — unattended is allowed for free models only up to that cap, split across UTC days; without it the scan set uses recorded authored fixtures and AC14 stays Hybrid with the residual named.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC1 | HTML, text PDF, DOCX, scanned PDF/image all open; corrupt/unsupported → clear message, no crash | `ingest-all-formats` (one fixture per format + corrupt + empty) | Fully-Automated | deployed smoke P10 |
| AC14 | #9 A-1 p.1 Account Type grid: Partnership/LLC lacks footnote 2 while Corporation/Trust/Other carry it (soft) | `golden-09-ocr-footnote2` on recorded OCR output (CI) + one live-model run recorded as a result (not a CI gate) | Hybrid | README outcome in P10; documented miss is acceptable (R5) |
| AC23 | Scans become reviewable text with page+region per line; page image beside text; per-page confidence; low-confidence pages marked | `ocr-position-and-confidence-e2e` (recorded OCR) + `ocr-accuracy-vs-transcript` (CER on 3–5 pages, reported not gated) | Hybrid | — |
| AC24 | OCR failure graceful: page images + "text not extracted" notice; nothing else breaks | `ocr-unavailable-mode-e2e` | Fully-Automated | — |

Closing verification for: AC2 (22-page scan set row in `sample-picker-smoke`), AC4 (page/region highlight), AC37 (page-count boundary: 30 pages), AC3 (per-page progress).

## Entry Gate

- Phases 01, 03, 04a verified (04a provides `/api/ocr`); S2 verdict known (body size); S1 verdict known (hold-open).
- Step A runs S3 and S4 (live free calls, ≤ 7 requests in total) under APPROVED-LIVE; if not approved, use the pre-adopted fallbacks (one page per request; page-level highlight).

## Library pins (confirm via vc-docs-seeker in Phase 00)

unpdf and/or pdfjs-dist (text extraction, page render to canvas), mammoth (`convertToHtml`, `extractRawText`), Dexie, Comlink, htmlparser2 (via the Phase 01 adapter), Playwright. OpenRouter vision input as image data URL.

## Touchpoints (create)

```
packages/core/src/adapters/{pdf-text.ts,docx.ts,ocr.ts (OCR JSON → LineStream with page+region+confidence),format-detect.ts}
packages/core/src/ocr/{schema.ts (strict JSON schema for vision output),confidence.ts,prompts/ocr-page.v1.ts}
packages/core/test/{unit,recorded}/adapters/**
fixtures/{docx,pdf}/** (synthetic DOCX with numbering, text PDF, scanned PDF/image samples, corrupt/empty files)
fixtures/llm-recordings/ocr/*.json
fixtures/scans-ground-truth/{appa1-pg1.txt,appa1-pg6.txt,...}   3–5 hand-made transcripts (agent reads the page image; human spot-check recommended)
apps/web/src/engine/{render-pages.ts (pdf.js render + downscale), ocr-queue.ts (concurrency 3, progress, resume)}
apps/web/src/features/scan/**       viewer, confidence badge, region highlight, unavailable notice (registered via registry.ts)
apps/web/e2e/{ingest-all-formats,ocr-position-confidence,ocr-unavailable,scan-set-smoke}.spec.ts
scripts/src/ocr/{cer.ts}            character error rate (reported)
scripts/src/spikes/{s03-two-pages,s04-regions}/
scripts/src/record/record-ocr.ts    (`pnpm record:ocr`, live, guarded)
scripts/src/precompute/precompute-ocr.ts   (`pnpm precompute:ocr`, live, guarded)
apps/web/public/precomputed/ocr/*   shipped OCR results for the 22-page set (final regeneration in P10 only if prompts change)
design/mockups/scan-viewer.html
```
Modified (documented extension): `packages/core/src/index.ts` (append), `apps/web/src/features/home/**` (accept formats; owned by P03).

## Public Contracts

- `/api/ocr` request/response per `contracts/ocr.ts`; images only, ≤ 700 KB body; PDFs are never sent to OpenRouter; no `file` content type and no `file-parser` plugin.
- OCR output schema: `{pages:[{page, lines:[{text, box?:[x0,y0,x1,y1] normalized, confidence?, footnote_marker?}], footnotes:[{marker,text}], options:[{label, footnote_marker|null}]}]}`; the adapter maps it to the same `LineStream` as HTML (options become option groups so the Phase 02 `footnote-requirement` detector works on OCR output).
- `page_confidence = min(model_self_reported ?? 0.7, structural_score)`; structural score from JSON validity, non-empty lines, absence of repeated-token loops, alphabetic ratio; `< 0.6` is low-confidence and visibly marked (proposed defaults).
- Cache key per page: `sha256(kind=ocr | pageHash | params(width,quality) | model | promptVer | schemaVer | rules_hash='none')`; precomputed static file name uses the page hash.
- Limits: 10 MB, 30 pages per scan (`limits.ts`); visitor OCR ≤ 6 pages/day (tightened if S3/S2 fail); no OCR call before limits pass.
- DOCX numbering is reconstructed from mammoth output and labeled "reconstructed numbering" in the structure view; documents with heavy loss show a notice.
- `max_tokens` for vision JSON is 8000 (reasoning models returned empty content at 4000 in the P1 probe); never use gemma-4/dots-3 as defaults.

## Blast Radius

`packages/core/src/{adapters,ocr}`, tests, `fixtures/{docx,pdf,scans-ground-truth}`, `fixtures/llm-recordings/ocr`, `apps/web/src/{engine,features/scan}`, e2e specs, `scripts/src/{ocr,spikes/s03*,s04*,record/record-ocr.ts,precompute/precompute-ocr.ts}`, `apps/web/public/precomputed/ocr`, `design/mockups/scan-viewer.html`. Does not edit `apps/worker` (config-only model list via env, already in 04a). Parallel-safe with Phases 05 and 09 (disjoint; append-only seams). Registry `## Phase 06`.

## Data Flow

File → format detect → (HTML: Phase 01 adapter) | (text PDF: pdf.js text with positions → lines) | (DOCX: mammoth→HTML→HTML adapter) | (scanned PDF/image: render pages → downscale → page hash → static precomputed? → `/api/ocr` queue (3 parallel) → OCR JSON → adapter → LineStream with page+region+confidence) → structurer/detectors (same pipeline) → findings with `page`/`region`. Text PDFs with no text layer (< 20 chars/page) are routed to OCR.

## Failure Modes

Corrupt/encrypted/empty file → clear message, partial state none; OCR 429/402/budget/no key → page images only with notice (AC24); per-page failure → that page marked failed with retry; model returns no coordinates (S4) → page-level highlight; low confidence → marked, findings from those pages labeled lower confidence.

## Implementation Checklist

### Step A — Spikes and ground truth
- [ ] A0. Mockup sketch `design/mockups/scan-viewer.html` reusing tokens.
- [ ] A1. S3 (two pages per request) and S4 (region coordinates) per Phase 00 definitions; verdicts and adopted fallbacks written to the REF and this plan's refresh note.
- [ ] A2. Hand-made ground-truth transcripts for 3–5 pages of `samples/sub-docs/raw/09-rw-holdings-scans/` (including `appa1-pg1`); mark as agent-transcribed, spot-check recommended.

### Step B — Adapters
- [ ] B1. `format-detect.ts` (extension + magic bytes; reject unsupported); `pdf-text.ts` (pdf.js text with positions, per-page progress, no-text-layer detection); `docx.ts` (mammoth → HTML adapter; reconstructed numbering label).
- [ ] B2. Fixtures per format plus corrupt/empty/oversize/encrypted; `ingest-all-formats` test (Node for HTML/PDF/DOCX; browser e2e for render paths).

### Step C — OCR pipeline
- [ ] C1. `ocr/schema.ts`, `prompts/ocr-page.v1.ts` (strict JSON, "report only what is visibly printed; null if no superscript"), `confidence.ts`, `adapters/ocr.ts`.
- [ ] C2. `render-pages.ts` (pdf.js render, downscale to ≈ 1600 px JPEG 0.8, page hashing) and `ocr-queue.ts` (concurrency 3, progress per page, resume from cache).
- [ ] C3. Recorded OCR fixtures for `appa1-pg1` (and 2–3 more pages); `golden-09-ocr-footnote2` runs the Phase 02 `footnote-requirement` detector on recorded OCR output (Partnership/LLC lacks footnote 2).
- [ ] C4. `ocr-position-and-confidence` tests (recorded), `ocr-accuracy-vs-transcript` via `cer.ts` (reported, not gated).

### Step D — Viewer and degraded mode
- [ ] D1. `features/scan/**`: page image beside extracted lines, region/page highlight when a finding is selected, confidence badge, low-confidence marker, "text not extracted" notice, per-page progress.
- [ ] D2. `ocr-unavailable-mode-e2e`: inject quota/budget/no-key states; assert page images remain and everything else works.
- [ ] D3. Extend `sample-picker-smoke` (22-page set) and `upload-limits` (30-page boundary) specs owned by Phase 03 (documented additions).

### Step E — Precompute and live probe
- [ ] E1. `precompute-ocr.ts` for the 22 pages (free model only; resumable; ~22 requests plus retries ≤ 35; stays within the free 50/day by running on its own UTC day; credit top-up is the user's option, never assumed). Needs APPROVED-LIVE; `--dry-run` lists the plan.
- [ ] E2. One live-model run for the golden page recorded as a result (not a CI gate); if the footnote marker is missed, record it as a known limitation (README in Phase 10); the single capped paid OCR attempt (SPEC R5) is NOT used because paid calls are disabled for this program; the miss is documented honestly.

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| adapters | `pnpm --filter @aduin/core test -- adapters ingest-all-formats` | Fully-Automated | AC1 |
| golden 09 | `pnpm --filter @aduin/core test -- golden-09-ocr-footnote2` | Hybrid (recorded OCR output) | AC14 |
| ocr e2e | `pnpm --filter @aduin/web test:e2e -- ingest-all-formats ocr-position-confidence scan-set-smoke` | Hybrid (recorded OCR) / Fully-Automated | AC1, AC23, AC2 (closing), AC4 (scan) |
| unavailable | `pnpm --filter @aduin/web test:e2e -- ocr-unavailable` | Fully-Automated | AC24 |
| CER | `pnpm --filter @aduin/scripts ocr:cer` | Hybrid (reported, not gated) | AC23 |
| limits | `pnpm --filter @aduin/web test:e2e -- upload-limits` | Fully-Automated | AC37 (closing) |
| live probe (optional) | `pnpm --filter @aduin/scripts record:ocr -- --max-requests <approved>` | Agent-Probe (APPROVED-LIVE) | AC14 residual |
| regression | `pnpm --filter @aduin/core test:golden && pnpm --filter @aduin/worker test -- proxy && pnpm --filter @aduin/web test:e2e -- slice && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | earlier phases |

Failing stubs for red-first: `should open an html text pdf docx scanned pdf and image fixture`, `should reject a corrupt file with a clear message`, `should flag Partnership/LLC missing footnote 2 from recorded OCR output`, `should show text not extracted when OCR is unavailable`, `should mark a page below 0.6 confidence as low confidence`, `should never send a pdf to the OCR endpoint`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `ingest-all-formats` | Fully-Automated | AC1 |
| `golden-09-ocr-footnote2` | Hybrid | AC14 |
| `ocr-position-and-confidence-e2e`, `ocr-accuracy-vs-transcript` | Hybrid | AC23 |
| `ocr-unavailable-mode-e2e` | Fully-Automated | AC24 |
| `sample-picker-smoke` (scan set), `upload-limits-e2e` (pages) | Fully-Automated | AC2, AC37 (closing) |

```bash
pnpm --filter @aduin/core test && pnpm --filter @aduin/web test:e2e -- ingest-all-formats ocr-position-confidence ocr-unavailable scan-set-smoke
# Expected: all exit 0; no OpenRouter calls in CI
```

## Exit Gate

- All gates green; S3/S4 verdicts and fallbacks recorded; CER report for 3–5 pages in the phase report; scan viewer screenshots attached.
- Precompute either done under APPROVED-LIVE (counts recorded) or deferred with recorded authored fixtures, stated plainly.
- Phase report written.

## Risks and Kill Criteria

- Free vision model latency 17–88 s/page and 50/day free quota: precompute split across days; visitor OCR cap 6 pages/day; progress per page.
- S3 fail → one page per request. S4 fail → page-level highlight only.
- No ground-truth transcript exists today (known gap in `all-tests.md`): created here; label as agent-transcribed.
- Privacy: free provider may retain uploaded images (P1 uncertainty): stated in the privacy notice (AC38).
- DOCX numbering loss: labeled reconstructed.

## Cost / Secret Hygiene

Free vision model only (`nvidia/nemotron-3.5-super-vl:free`); no paid OCR; PDFs never sent to OpenRouter (so the implicit paid `mistral-ocr` default can never trigger); CI uses recorded responses; live calls only under APPROVED-LIVE with a max request count (S3/S4 ≤ 7, precompute ≤ 35); keys from env only, never printed or logged; images are downscaled before leaving the browser; Cloudflare `aduin-transaction-*`, zone untouched.

## Rollback

`git revert` phase commits; web falls back to HTML-only (Phase 03 behavior); remove `public/precomputed/ocr`.

## Blockers That Would Justify BLOCKED Status

- pdf.js cannot render pages in the pinned build/browsers (route to alternative render path).
- Free vision models are all unavailable at execution time (record, ship page-image-only mode, keep recorded fixtures).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md` (include APPROVED-LIVE line or its absence)
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S3 (three adapters), S4, S6 (untrusted file input, provider data egress), S7 → 4/7 HIGH. Recommended: parallel subagents for Step B adapters (disjoint files), sequential for OCR pipeline and viewer. Sonnet for research/validation, opus for code execution.

## Test Infra Improvement Notes

(none identified yet) — candidate: shared Playwright fixture to inject OCR availability states.

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-06-pdf-docx-ocr_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next Step: after Phases 01, 03, 04a are verified, spawn vc-research-agent (may run parallel with Phases 05 and 09). Run S3/S4 first (Step A1).

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
