---
name: report:subdoc-qa-mvp-phase-06-pdf-docx-ocr
description: "Sub-doc QA MVP Phase 06 execution report (per sub-step: 06a worker OCR prompt + probes, 06b core seams, later 06c-06f)"
date: 17-10-26
phase: phase-06-pdf-docx-ocr
status: IN_PROGRESS
feature: subdoc-qa-mvp
plan: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-06-pdf-docx-ocr_PLAN_17-10-26.md
metadata:
  node_type: memory
  type: report
  feature: subdoc-qa-mvp
  phase: phase-06
---

# Phase 06 Report: PDF, DOCX, OCR and Precompute

Status: IN PROGRESS. Sub-steps 06a and 06b done (not committed). 06c to 06f and Step F come next.

## 06a: Worker OCR prompt ocr2 + live probes

**TL;DR:** prompt `ocr2` is in, and the cache key carries it. The first live request found a real bug: the free Nvidia model rejected the strict OCR schema. I fixed it by leaving `ext` out of the schema sent to the model. With that fix, page 1 came back correct: the right footnote markers and a box around every line. 2 live requests used, cost 0.

### What was done
| File | Change |
|---|---|
| `apps/worker/src/upstream/openrouter.ts` | `OCR_PROMPT` rewritten (one line per visual row, ☐/☒, `^{n}` right after its label, "report only what is visibly printed", optional normalized `bbox {x,y,w,h}` + `conf`, keeps "untrusted DATA"). Neutral example `Label^{3}` so the golden answer is not primed. `ocrResponseFormat()` now sends `OcrResultSchema.omit({ ext: true })` (see Deviations). |
| `apps/worker/src/upstream/models-config.ts` | `PROMPT_VER.ocr` `ocr1` -> `ocr2`. `PROMPT_VER.ai` handling untouched. |
| `apps/worker/test/proxy/ocr-prompt-version.test.ts` (new) | Checks `ocr2`, the prompt rules, that the prompt only asks for `text`/`bbox`/`conf`, that the strict format has no `propertyNames`, and that the cache key uses `prompt_ver: 'ocr2'`. |
| `apps/worker/test/proxy/ocr-never-sends-pdf.test.ts` (new) | `application/pdf`, `x-pdf` and `octet-stream` get 415 with 0 upstream calls. A PDF data URL dressed as an image gets 400 with 0 upstream calls. The forwarded body only has `text` + `image_url` (`data:image/...`) parts: no `file` part and no plugins. |
| `apps/worker/test/llm/llm-helpers.ts` | Recording glob narrowed to `{clause-judgment,counsel-draft}/*.json` (see Deviations). |

`OcrResultSchema` and the contract snapshot are unchanged. `max_tokens` stays 8000.

### Live probes (APPROVED-LIVE, Phase 06 cap 30)
| # | Purpose | Result | Cost |
|---|---|---|---|
| 1 | S4 + marker fidelity, page `appa1-pg1` (downscaled to 1600 px, JPEG q80, 135 KB) | HTTP 200 with `error: Upstream error from Nvidia: Grammar error: Unimplemented keys: ["propertyNames"]`. The strict schema from `z.toJSONSchema(OcrResultSchema)` carries `propertyNames` from the `ext` record. **The deployed `/api/ocr` would fail the same way with the default model.** | 0 |
| 2 | Same page, schema without `ext` | HTTP 200, 47 s, `nvidia/nemotron-3.5-super-vl:free`, 3656 completion tokens (2255 reasoning) | 0 |

- **Used: 2 of 3 allowed here (2 of 30 for the phase). 28 left** (S4 ≤ 2 used up; precompute 22 + retries ≤ 4 still fit).
- **S3 (two pages per request): SKIPPED** to save quota. Adopted: 1 page per request (`ocrPagesPerRequest` stays 1).
- **S4 (bbox): VIABLE, row-level.** 22/22 lines have a bbox, in normalized 0..1 page coordinates. The boxes are coarse: they cover the whole row, and many share x = 0.05 / w = 0.9. That is good enough for a row highlight, not for a single word. `conf` was 0.95 on every line, so the model's own score tells us nothing; `confidence.ts` must rely on the structural score (06d).
- **Marker fidelity on the golden page: CORRECT.** `☐ Trust ^{2} ☐ Corporation ^{2} ☐ Partnership/LLC`, `Other ^{2}`, Pension/Profit Sharing/KEOGH `^{2}`, Joint/Tenants in Common/Community Property `^{1}`. Partnership/LLC has no marker, as printed. Shape notes for 06d: the model puts a space before `^{n}`, and it emits **3 grid options per line** (a visual row), which `structure/option-groups.ts` already handles. It also emitted the footer `1/8`, which is page-noise.
- The response content only (no headers, no key) is saved as `fixtures/llm-recordings/ocr/appa1-pg1.ocr2.recorded.json`.
- Probe guard (scratch script, not committed): in-code ceiling of 3, `:free` model check, refuses without `OCR_MAX_REQUESTS`, 700 KB body cap, stops on `usage.cost > 0`, never prints the key, `redirect: 'error'`. The committed `record-ocr.ts` / `ocr-live-guard` come in 06f.

### Gates (06a)
| Gate | Result |
|---|---|
| `pnpm --filter @aduin/worker test ocr-prompt-version` | red first (2 failed), then 2/2 pass |
| `pnpm --filter @aduin/worker test ocr-never-sends-pdf` | 3/3 pass. Already green on first run: the worker already blocks PDFs at `guards.ts`, so this is a guard test. |
| `pnpm --filter @aduin/worker test` (full) | 64 files / 520 tests pass (after 06b too) |
| worker typecheck, eslint, prettier on touched files | clean |

## 06b: Core seams

**TL;DR:** the superscript seam now lives in one shared module. Findings carry a region. **Probe-first D2 result: PATH-04 does NOT fire on OCR**, so the planned fallback was applied: `footnote-requirement` checks OCR-only investor groups with the PATH-04 peer rule, deduped against PATH-04. AC14 golden is green with exactly one finding. All HTML goldens and contracts are unchanged.

### What was done
| File | Change |
|---|---|
| `packages/core/src/adapters/sup-segments.ts` (new) | The single `WeakMap<Line, SupSegment[]>`, plus `supSegmentsOf` and `setSupSegments`. |
| `packages/core/src/adapters/html.ts` | The map moved out. It re-exports `supSegmentsOf` and `SupSegment` (existing imports still work) and calls `setSupSegments`. |
| `packages/core/src/structure/option-groups.ts` | Imports `supSegmentsOf` from `sup-segments.ts` (allowed by E2 iv). |
| `packages/core/src/findings/make-finding.ts` | New exported `evidenceRegion(lines, matchStart)`: `finding.region` = region of the line containing the match, else the whole page `{0,0,1,1}` when a page is known, else nothing. HTML has no page, so HTML findings are unchanged. |
| `packages/core/src/investor/extract.ts` | New exported peer helper `peerMarkerGaps(group, {distinctPeers?})`. Individual is never a peer (families). |
| `packages/core/src/investor/paths.ts` | PATH-04 loop now calls `peerMarkerGaps(group)` in the default mode, with the same iteration order. Behavior is byte-identical: all prior goldens, seeded tests and investor tests pass. |
| `packages/core/src/detectors/footnote-requirement.ts` | Stale "OCR carries no markers yet" comment replaced. New branch for investor groups whose every line has `cue_source: 'ocr'`: peer rule with `distinctPeers` (at least 2 *different* types must carry the marker, and an option whose own type already carries it is skipped). Options PATH-04 already reports are dropped, and the group gives at most 1 finding (confidence 0.6, facts include `provenance: 'ocr'`). |
| `packages/core/test/golden/golden-09-ocr-footnote2.test.ts` (new) | 13 tests over 2 fixtures (see below). |
| `fixtures/llm-recordings/ocr/appa1-pg1.authored.json` (new) | Agent-authored A-1 grid in `^{n}` form, labelled "human spot-check recommended". |
| `fixtures/llm-recordings/ocr/appa1-pg1.ocr2.recorded.json` (new) | Live page-1 result from 06a. |

`buildDocGraph` already had the optional `source` argument (`source: Doc['source'] = 'html'`, `engine.ts:26`). No edit was needed, and existing `analyzeHtml` callers are unchanged. `index.ts` was not edited, because nothing outside core needs the seam yet.

### Probe-first D2 outcome (AC14), and which detector fires
1. With only the seam, the `^{n}` markers reached the option group correctly (Trust 2, Corporation 2, Other 2, Partnership/LLC none). But **PATH-04 produced nothing**. Root cause: OCR lines have no bold or heading cues. So `1. Investment` / `2. Account Type` become `list_item` blocks, the page has no numbered main scope, and `investorModel()` returns `paths: []` before PATH-04 runs (`investor/paths.ts`, the `!scope` early return).
2. Fallback per D2/E2: relax `footnote-requirement` for OCR-provenance investor groups only, with dedupe.
3. A first naive relaxation (the exact PATH-04 rule) over-fired. Pension/Profit Sharing are both `erisa-plan` and KEOGH is `ira`, all carrying `^{2}`, so the plain IRAs were flagged. `distinctPeers` fixes this: at least 2 distinct carrier types are required, and a type that itself carries the marker on another option is option-specific, not a type-level gap.
4. **Firing detector for AC14: `footnote-requirement`** (`inconsistent_footnote_requirement`, high, confidence 0.6), facts `marker: "2"`, `marked: "Trust", "Corporation"`, `unmarked: "Partnership/LLC"`, `provenance: ocr`, `page: 1`, region = the row's bbox. It is the **only** finding on the page for both the authored and the live-recorded fixture.
5. Dedupe proven: with bold numbered headings added (so PATH-04 has a scope), the same grid yields exactly 1 finding, from `investor-path-missing-item`, and the OCR branch stays silent. Lines without `cue_source: 'ocr'` never take the OCR branch.

`golden-09` uses a small test-local `ocrToLines` (strip `^{n}`, zero-width sup segment at the label end on the cleaned text, page = index + 1, region = bbox, one Line per OCR line). **06d must switch the golden to the real `adapters/ocr.ts`** and keep these 13 tests green.

### Gates (06b)
| Gate | Result |
|---|---|
| `pnpm --filter @aduin/core test golden-09-ocr-footnote2` | red first (8 failed: probe showed no finding), then 13/13 pass |
| `pnpm --filter @aduin/core test:golden` | 6 files / 57 tests pass (prior 5 files unchanged) |
| `pnpm --filter @aduin/core test contracts` | 1 / 34 pass, snapshot unchanged |
| `pnpm --filter @aduin/core test security` | 6 / 27 pass |
| `pnpm --filter @aduin/core test` (full) | 52 files / 368 tests pass (baseline before 06b: 51 / 355; +1 file / +13 tests, no other change) |
| `pnpm --filter @aduin/scripts fixtures:check` | OK (46 files) |
| `pnpm --filter @aduin/scripts test`, `pnpm --filter @aduin/web test` | 8/49 and 12/47 pass |
| typecheck core, worker, web, scripts | clean |
| eslint + prettier on all touched files | clean |
| `pnpm guard:cf`, `pnpm secrets:scan` | OK |

## Plan Deviations (06a/06b)
1. **`ocrResponseFormat` sends the schema without `ext`** (`apps/worker/src/upstream/openrouter.ts`, OCR path, inside the blast radius). Why: live probe 1 proved the default free model rejects `propertyNames`. Impact: replies are still parsed with the frozen `OcrResultSchema` (`ext` is optional), so the contract and snapshot are unchanged. The forwarded `response_format` bytes change, but cache entries are already separated by `prompt_ver` `ocr2`. This also fixes a latent bug in the deployed Worker (`/api/ocr` with the default model), which takes effect only on the next deploy.
2. **`apps/worker/test/llm/llm-helpers.ts` glob narrowed** to the AI task folders. Why: the plan places OCR recordings in `fixtures/llm-recordings/ocr/`, and the old `**/*.json` glob parsed them as AI recordings (2 worker files failed). Test-only change. E10 said "no other worker file changes"; this is test infrastructure needed because of the plan's own fixture location.
3. **`ocr-never-sends-pdf` is a worker test**, as the orchestrator's 06a task asked. The contract names it as a web vitest file. The web-side "render path never posts a PDF" assertion belongs with `render-pages`/`ocr-queue` in 06d; it is recommended there under the same token, in `apps/web/test/`.
4. **D2 relaxation was needed** (the plan expected PATH-04 to fire). It follows the plan's own fallback: OCR-only, deduped, 1 finding. It adds the `distinctPeers` refinement so IRAs are not flagged; PATH-04's default mode is unchanged.
5. `index.ts` and `buildDocGraph` were not edited: there was no need, since `source` was already optional.

## Test Infra Gaps Found
- The `fixtures/llm-recordings/**` glob collision (fixed above). Any new loader should list task folders explicitly.
- `golden-09` depends on a test-local OCR-to-lines helper until 06d lands the adapter.

## What Was Skipped or Deferred
- S3 live probe (skipped, record-only). 06c to 06f and Step F evidence pack (next agents). A0 mockup (optional). Ground-truth transcripts A2 (06d/06f).

## Forward Preview
### Test Infra Found
- Worker OCR tests use `makeHarness` / `ocrBody` / `okOcr` (`apps/worker/test/fakes`). The core golden can build Lines directly and call `buildDocGraph(..., 'ocr')`.
### Blast Radius Changes
- Touched beyond the planned list: `apps/worker/test/llm/llm-helpers.ts` (test glob). Core: `investor/paths.ts` (PATH-04 now uses the shared helper).
### Commands to Stay Green
- `pnpm --filter @aduin/worker test ocr-prompt-version`; `pnpm --filter @aduin/worker test ocr-never-sends-pdf`; `pnpm --filter @aduin/worker test`; `pnpm --filter @aduin/core test golden-09-ocr-footnote2`; `pnpm --filter @aduin/core test:golden`; `pnpm --filter @aduin/core test contracts`; `pnpm --filter @aduin/core test`; `pnpm --filter @aduin/scripts fixtures:check`.
### Dependency Changes
- None. No manifest or lockfile edits.
### Notes for 06d
- OCR adapter: strip `[ \t]{0,8}\^\{(\d{1,3})\}` (the model adds a space before the marker), zero-width sup segment at the cleaned label end, one Line per OCR line, `cue.cue_source = 'ocr'`, page = index + 1, region = bbox. Drop the `1/8` footer through page-noise. `conf` is uninformative (always 0.95).
- Deployed Worker: redeploy is needed for the ocr2 prompt and the schema fix (Phase 10 or when 06 lands; not done here).

CONTEXT_PARTIAL: none.
Follow-up stubs created: none (the gaps are tracked as 06d notes above).
