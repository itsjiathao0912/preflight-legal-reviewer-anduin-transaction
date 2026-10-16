---
phase: phase-01-core-engine
date: 2026-10-17
status: COMPLETE_WITH_GAPS
feature: subdoc-qa-mvp
plan: process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-01-core-engine_PLAN_17-10-26.md
name: report:subdoc-qa-mvp-phase-01-core-engine
description: "Sub-doc QA MVP Phase 01 EXECUTE exit summary: core engine, golden detectors, memory core, frozen contracts v1, gate outputs, final thresholds"
metadata:
  node_type: memory
  type: report
  feature: subdoc-qa-mvp
  phase: phase-01
---

# Phase 01 — Core Engine: EXECUTE report

## TL;DR

`packages/core` now holds the full Phase 01 engine. It has the HTML adapter, the structurer, the logic graph, the finding schema, the three golden detectors, the memory core, the session cookie helper, and the frozen API contracts v1. All golden counts and negative checks pass on the real samples **without tuning any pinned threshold**: #1 = 2, #3 = 2, #5 = 2, #11 = 1. All 8 contract gate commands exit 0 locally. The status is COMPLETE_WITH_GAPS only because of three items: workerd/browser conformance is a pre-classified known gap, `memory/patternKey.ts` was not created (registry conflict with Phase 02), and red-first was not demonstrated test by test (a mutation check stands in for it). Nothing is committed (the orchestrator commits after EVL).

## What Was Done

- **F0 seam edits** (applied by me, as the orchestrator delegated):
  - `packages/core/package.json` scripts: `test:golden` → `vitest run test/golden`, `test:property` → `vitest run test/property`, `test:corpus` → `vitest run test/corpus`, plus a new `test:vectors` → `vitest run test/vectors`. `--passWithNoTests` was removed from all four (E6). `test:seeded` was left as is (Phase 02).
  - Deps were already pinned in Phase 00 (htmlparser2 12.0.0, zod 4.6.7, @noble/hashes 2.4.0, fast-check 4.10.2). Vitest stays on 4.1.12. No new dependency was added.
  - Root `eslint.config.js`: `no-restricted-globals` for `document` and `window`, scoped to `packages/core/src/**/*.ts`.
- **Step A**:
  - `model/{types,line-stream,anchors,hash,errors}.ts` (zod frozen shapes).
  - `adapters/html.ts`. SAX parse; row merge per `<tr>`; nearest-declaration bold walk; bold measured on the text before the first `(` (E1); a `font:` shorthand without `bold` resets the weight (E4); cp1252 remap; named entities; glyph normalization that works across split text events; an auditable noise rule list plus repeated running headers; size cap; long-line split; windows-1252 fallback decode.
  - `structure/{structurer,headings,numbering-scopes,references,statutory,conditionals,option-groups,defined-terms,fields,types}.ts`.
  - `graph/{graph,query}.ts`.
- **Step B**:
  - `findings/{schema,taxonomy,ids,severity,make-finding}.ts`.
  - `detectors/{registry,ref-this-section,ref-label-coherence,undefined-term}.ts`.
  - `engine.ts` (`analyzeHtml`, `buildDocGraph`, `runDeterministic`).
- **Step C**:
  - `memory/{normalize,fingerprint,mask,label,rulesHash,snap,firms,index}.ts`, `session/cookie.ts`, `config/limits.ts`.
  - `fixtures/fingerprint-vectors.json`, `fixtures/cache-key-vectors.json`, `fixtures/memory/law-firms.json`. The expected vector values were computed independently in Python (hashlib/unicodedata), not by core.
- **Step D**: `contracts/{errors,claims,frames,cache-key,ai,ocr,quota,memory,ports,seed-spec}.ts`, plus the JSON-schema freeze `packages/core/test/__snapshots__/contracts.json-schema.snap` (67 schemas, sha256 `5dba7bee5848b012…`).
- **Step E**: tests under `packages/core/test/{unit,golden,property,vectors,security,contracts,corpus,fixtures,helpers}`. `test/unit/smoke.test.ts` was updated: the barrel is no longer "marker only".
- Barrel `src/index.ts`: append-only block added below the Phase 00 marker. The registry has an "append below" marker.
- `THIRD_PARTY_NOTICES.md`: added a line saying the defined-terms-checker (MIT) ideas were ported without copying code, and that no new deps were added.
- Evidence pack `harness/phase-01/` covers risk-gate, context-snippets, verification, review-decision and adversarial-validation. The validator reports 0 failures and 0 warnings.

## Frozen contracts v1 (by exported schema name)

- **ai**: AiCandidateSchema, AiFindingSchema, AiRequestSchema, AiResultSchema
- **cacheKey**: CacheKeyInputSchema (+ `cacheKey()`)
- **claims**: CreateSessionRequestSchema, CreateSessionResponseSchema, SessionClaimsSchema (+ `resign()`)
- **errors**: ErrorBodySchema, ErrorCodeSchema, ErrorDetailSchema (+ `errorStatus()`, `errorBody()`)
- **findings**: FactValueSchema, FindingDetailSchema, FindingSchema, FindingWireSchema (+ `toWire()`)
- **frames**: ErrorFrameSchema, FrameSchema, HeartbeatFrameSchema, ResultFrameSchema (+ `parseFrameLine()`, `parseFrameStream()`, `frameLine()`)
- **memory**: ActiveDecisionSchema, AuditEventSchema, AuditQuerySchema, AuditResponseSchema, ConflictBodySchema, CounselAnswerRequest/ResponseSchema, CounselOptionSchema, CounselQuestionRequest/ResponseSchema, CreateDecisionRequest/ResponseSchema, CreateRunRequest/ResponseSchema, DecisionKindSchema, DecisionStatusSchema, ExportResponseSchema, FirmMemoryResponseSchema, LawFirmQuerySchema, MemoryLabelSchema, MemoryLookupRequest/ResponseSchema, ReasonCodeSchema, RevokeDecisionRequest/ResponseSchema, RuleActionRequest/ResponseSchema, RuleSchema, RulesResponseSchema, StoreFindingsRequest/ResponseSchema
- **model**: AnchorSchema, BlockKindSchema, BlockSchema, CueSchema, DocSchema, GraphEdgeSchema, GraphNodeSchema, LineSchema, LogicGraphSchema, ReferenceSchema, RegionSchema
- **ocr**: OcrRequestSchema, OcrResultSchema
- **quota**: QuotaKeySchema, QuotaResponseSchema
- **seed**: DemoSeedDecisionSchema, DemoSeedSpecSchema
- **ports (types only)**: PlatformPort, QuotaPort, CachePort, LedgerPort, RulesPort, TurnstilePort, QuotaClaimResult, CachedResult, LedgerEntry

**MemoryLabel enum (E5)** = `new`, `previously_dismissed`, `dismissed_reconfirm`, `already_answered`, `awaiting_counsel`. This equals the DATA-MODEL `memory_label` CHECK list. The display aliases (`dismissed`, `answered`) are exported separately as `MEMORY_LABEL_ALIASES`.

**Shared error schema (orchestrator instruction / 04a E15)**: `ErrorDetailSchema = {code, message, reason?, retry_after_s?}`. The HTTP body is `{error: ErrorDetail}`. The NDJSON error frame is `ErrorDetailSchema.extend({t:'error'})`, so it is one schema. A test proves that `reason` parses on both.

## Test Gate Outcomes (exact local outputs, 2026-10-17)

| # | Command | Result |
|---|---|---|
| 1 | `pnpm --filter @aduin/core test` | Test Files 23 passed (23), Tests 217 passed (217), exit 0 |
| 2 | `pnpm --filter @aduin/core test:golden` | Test Files 5 passed (5), Tests 44 passed (44), exit 0 |
| 3 | `pnpm --filter @aduin/core test:property` | Test Files 4 passed (4), Tests 29 passed (29), exit 0 |
| 4 | `pnpm --filter @aduin/core test:corpus` | Test Files 1 passed (1), Tests 13 passed (13), exit 0 |
| 5 | `pnpm --filter @aduin/core test:vectors` | Test Files 2 passed (2), Tests 38 passed (38), exit 0 |
| 6 | `pnpm --filter @aduin/core test security` | Test Files 3 passed (3), Tests 16 passed (16), exit 0 |
| 7 | `pnpm --filter @aduin/core test contracts` | Test Files 1 passed (1), Tests 34 passed (34), exit 0 |
| 8 | `pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan` | exit 0 (`guard:cf: OK`, `secrets:scan: OK`, Prettier clean) |
| — | root `pnpm test` (Phase 00 smoke regression) | scripts 22, core 217, web 2, worker 7 tests passed, exit 0 |
| — | E6 check: `pnpm --filter @aduin/core test nosuchtoken` | exit 1 (`No test files found`), so an unmatched token fails |
| — | F0 lint proof: a seeded `document.title + String(window)` in `packages/core/src/__seeded_violation.ts` | eslint reported 2 `no-restricted-globals` errors; the file was removed; clean run exits 0 |

Goldens, with exact counts and negatives:
- **#1 (AC11)**: 2 `broken_cross_reference`, both quoting "this Section 11", enclosing section 12 = "Qualified Client Status", expected 12. The two "this Section 9" cites sit in continuation paragraphs before bold "1.", so guard (a) applies and there are 0 findings. The 1-22 accredited list and the Acknowledgments 1-13 list are all `list_item`. #1 has 2 findings in total.
- **#3 and #5 (AC12)**: 2 each, 4 in total.
  - Custodian ref: window `{agreement, custodian}`, p 0.00, t 0.50, expected "Section 4 (CUSTODIAN INFORMATION)".
  - Amount ref: window `{equal, amount}`, p 0.00, t 0.50, expected "Section 6 Part B (Investment amount)".
  - The strict `Part X of Section N` pattern matches exactly 10 times per doc: 8 resolved, valid refs score p ≥ 0.50, and none fire.
  - Each doc has exactly 2 findings.
- **Heading extraction (#3 and #5)**: Signature Pages scope sections 1-12 with titles. 4 = CUSTODIAN INFORMATION with no parts. 6 = INVESTMENT DETAILS with Parts A and B ("Investment amount"). No other scope has sections.
- **#11 (AC13)**: exactly 1 `defined_term_issue` ("offered Units", defined term "Shares"), with the Circular carve-out: medium severity and 2 interpretations. There are 0 `defined_term_issue` findings on #5 and #6.
- **Statutory**: "Section 406 of ERISA" and both "Section 4975" forms are statutory (bare-repeat rule fires on "Section 406 or Section 4975"). "Section 3(c)(1) of the 1940 Act" and the Rule cites are statutory. On #1, #2, #5, #10 and #12 every `Section N` match is internal, statutory or external, with 0 `broken_cross_reference` beyond the goldens. A reference dump snapshot exists per sample (`test/golden/__snapshots__/statutory-cite-not-flagged.test.ts.snap`).

Red-first evidence (E8 mutation check): I replaced guard (a) with a fallback enclosing section. `golden-01` then went red (3 of 5 tests failed: the "this Section 11" count, the "this Section 9" negative, and the total). After restoring the guard it went green again (5 of 5).

## Final thresholds, stopwords and token lists (E7): all unchanged from the pinned initial values

- **H**:
  - Max title 120 chars; no sentence-final period (closed abbreviation exceptions `No|Inc|Ltd|Co|Corp.`).
  - Caps = ≥ 80% uppercase letters (at least 3), measured on the title minus parentheticals and a trailing `*`.
  - Line bold = ≥ 60% of letters bold, measured on the text after the number / `Part X` / `Appendix X` / `Section X` prefix and before the first `(`. This is E1; the 0.6 ratio is my pick, the plan does not pin it.
  - Gap acceptance prev+2..prev+3 (`gap: true`).
  - Scope openers (bold or caps, ≤ 120 chars, not numbered, no trailing `.;:`): `Appendix X`, `Signature Page(s)`, `Terms and/& Conditions`, `Instructions`. A document-level `Part X` (before any accepted section) also opens a scope. A reset to 1 after a larger number opens a new body scope.
- **R**:
  - Pattern `\bthis\s+Section\s+(\d{1,3}[A-Z]?)((?:\([a-z0-9]{1,6}\)){0,6})(?![.]\d|\d|\s+of\s)`.
  - I read "not preceded by 'of'" as "not followed by `of`" (e.g. "this Section 2 of the Code"). The golden text is "of this Section 11", which must fire.
  - Decimal sections ("this Section 3.10", #10) are excluded.
  - Guards (a) then (b). Confidence 0.9, severity high.
- **L**:
  - Window = last 4 raw tokens, then strip non-alphanumerics (E3), then stopwords `{to, the, of, in, for, as, a, an, and, or, with, by}`, lowercase, singular-fold (`ies→y`, drop trailing `s` except `ss|us|is`).
  - Cited label = Part label, or the section title when that Part does not exist.
  - Fire iff p < 0.25 and t ≥ 0.5. Confidence 0.7, severity high (cap).
- **U**:
  - Nouns `{Units, Unit, Interests, Interest, Stock, Common Stock, Shares, Share, Securities}`.
  - Context `\b(offered|offering of|purchase of|subscribed for|subscribe for|purchase)\s+(?:the\s+)?(Units|Interests|Stock)\b`.
  - Fires only when exactly one offering family is defined.
  - Carve-out `not defined herein … meanings given/ascribed/assigned to them in the <Name>`.
  - Severity medium; confidence 0.6 with the carve-out, 0.75 without.
- **S**: as pinned.
  - 40-char marker window.
  - `of the … Act`.
  - Subsection chain `Section 3(c)(1)`.
  - Bare repeat within 400 chars after a statutory cite of the same N.
  - Out-of-range: above the active scope max, or above the doc max when the scope has no sections → `external`.
  - Rule / U.S.C. / C.F.R. are statutory references.
  - Decimal `Section 3.10` → internal unresolved (recorded only).

## Timing note for AC29 (E5, no gate)

Sample #2 (378,698 B, 587 lines): adapter + structure was 68.8 ms cold and 34.9-42.6 ms warm over 5 runs (adapter about 25 ms, structure about 10 ms) on the dev Mac in Node. The full analyze plus detectors per sample ranged 7-60 ms. The Phase 00 S7 baseline was 10 ms for SAX parse+merge alone.

## What Was Skipped or Deferred

- `memory/patternKey.ts` ("interface only") was **not created**. The registry `## Phase 02` owns `memory/patternKey.ts`, so I did not touch the contested file. The pattern-key need is covered without it: `Detector.patternKey()` is in `detectors/registry.ts`, and the `patternKey()` helper (spec `<detector_id>[:<shape>]`, digits → `#`, ≤ 80 chars) is in `findings/make-finding.ts`. The orchestrator should confirm Phase 02 creates it.
- workerd/browser re-run of the vectors and the cookie helper: known gap, pre-classified, owners P04b/P03.
- Precision of `ref-label-coherence` on the other docs: P02.

## Plan Deviations (all within blast radius; documented and continued under /goal)

1. Added error code `invalid_request` → 400. The endpoint table has "400 invalid" but no code for it, and quote-cap and fingerprint-input errors need one. This is additive and covered by the exhaustive `errorStatus`.
2. The finding builder file is `findings/make-finding.ts`, not a file under `detectors/`. Reason: the shell scout hook blocks paths containing "build"; this is a naming deviation only.
3. `test:corpus` now points to `test/corpus` (Phase 00 had a placeholder `test/recorded`).
4. `Finding` gained an optional `pattern_key`, needed by `CreateDecisionRequest.pattern_key` and DATA-MODEL 2.4. `section_path` is `string[]`, the same as `Block.section_path`; the server joins it to TEXT.
5. R pattern interpretation ("not followed by of") and the decimal exclusion are recorded above.
6. TDD Mode A: implementation was explored against the real samples before the golden files were written, so red-first was not shown per stub. A mutation check (guard (a) removed) stands in for it. The failing-stub names are used verbatim as test titles.
7. `contracts/ports.ts` `QuotaClaimResult` has an additive optional `reason?` on the refusal branch, so 04a can carry `visitor_limit` and similar.

## Test Infra Gaps Found

- Vitest hides `console.info` for passing tests in this config, so the per-doc corpus line is not printed by `test:corpus`. Per-doc counts are in this report.
- The scout-block hook rejects Bash commands that contain "build" in a path (for example `findings/build.ts`).
- Prettier rewrote some `\uXXXX` escapes in sources to literal characters. Literal invisible characters had to be re-escaped for `no-irregular-whitespace`.

## Closeout Packet

- Selected plan: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-01-core-engine_PLAN_17-10-26.md`.
- Finished: all touchpoints except `memory/patternKey.ts` (registry-owned by P02); contracts frozen with the snapshot; all 8 gates green.
- Verified: every gate above, run locally by the implementing agent. These are unconfirmed until the EVL independent re-run.
- Unverified: workerd/browser conformance (P04b/P03); label-coherence precision on the other docs (P02).
- Remaining cleanup: EVL; the orchestrator commit; UPDATE PROCESS context capture (core engine shape, frozen contracts list, gate tokens).
- Next valid state: EVL for Phase 01. Then Phase 04a (contracts are frozen) and Phase 03 per `## Execution Holds`.
- Closeout classification: **Keep in active/testing** until EVL confirms. The evidence pack has `mustStopBeforeFinalize: true` and only a self-review decision.
- Follow-up stubs created: none (the patternKey item is a registry question for the orchestrator, not a new plan).
- CONTEXT_PARTIAL: none.

## Forward Preview

### Test Infra Found
- Core gates: `test` (all), `test:golden`, `test:property`, `test:corpus`, `test:vectors`, plus filename-token gates `test security` and `test contracts` (no `--`).
- `test/helpers/samples.ts` caches analysis per sample.
- Fixtures: `packages/core/test/fixtures/*.html`.
- Snapshots: `test/__snapshots__/contracts.json-schema.snap` (a file snapshot; regenerate only with a contract-change note) and `test/golden/__snapshots__/`.

### Blast Radius Changes
- New dirs under `packages/core/src`: `model`, `adapters/html.ts`, `structure`, `graph`, `findings`, `detectors`, `memory`, `session`, `config`, `contracts`, `engine.ts`.
- Seams: `src/index.ts` (append below the Phase 01 block) and `detectors/registry.ts` (append below the marker).
- F0 touched `packages/core/package.json` and `eslint.config.js`.

### Commands to Stay Green
`pnpm --filter @aduin/core test && pnpm --filter @aduin/core test:golden && pnpm --filter @aduin/core test:property && pnpm --filter @aduin/core test:corpus && pnpm --filter @aduin/core test:vectors && pnpm --filter @aduin/core test security && pnpm --filter @aduin/core test contracts && pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan`

### Dependency Changes
None added. `fixtures/memory/law-firms.json` is new and imported by `memory/firms.ts` through a JSON import attribute.
