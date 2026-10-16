---
name: context:all-engine
description: Core engine architecture in packages/core (adapters, structure, graph, detectors, findings, memory, session, frozen contracts v1), pinned algorithms H/L/R/U/S with final thresholds, and how later phases extend it additively
keywords: core engine, packages/core, html adapter, structurer, logic graph, detector, golden, broken cross reference, ref-this-section, ref-label-coherence, undefined term, defined term, statutory, finding schema, memory fingerprint, cache key, contracts v1, frozen contracts, zod, ndjson frames, error code, memory label, thresholds, analyzeHtml
related: [context:tests]
date: 17-10-26
metadata:
  node_type: group-entrypoint
  type: context
  read_when: any work in packages/core, detector/threshold changes, API contract changes, or phases 02-09 that extend the engine
---

# aduin-transaction - Core Engine (packages/core, Phase 01)

Source of truth: the code under `packages/core/src` plus the Phase 01 report
`process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-01-core-engine_REPORT_17-10-26.md`
(commit 6d12628). Read the report for exact golden counts and rationale.

## Layout (`packages/core/src`)

| Dir / file | Role |
|---|---|
| `model/` | zod frozen shapes: Doc, Block, Line, Anchor, Reference, Region, Cue, LogicGraph; `line-stream`, `anchors`, `hash`, `errors` |
| `adapters/html.ts` | SAX (htmlparser2) parse, row merge per `<tr>`, nearest-declaration bold walk, cp1252 remap, entities, glyph normalization, noise-rule list + repeated running headers, size cap, long-line split, windows-1252 fallback |
| `structure/` | structurer: headings (H), numbering scopes, references, statutory (S), conditionals, option groups, defined terms, fields |
| `graph/` | `graph.ts` + `query.ts` (logic graph over structure) |
| `findings/` | `schema`, `taxonomy`, `ids`, `severity`, `make-finding.ts` (finding builder + `patternKey()` helper) |
| `detectors/` | `registry.ts` (append-only registration, "append below" marker) + golden detectors `ref-this-section` (R), `ref-label-coherence` (L), `undefined-term` (U) |
| `engine.ts` | `analyzeHtml`, `buildDocGraph`, `runDeterministic` |
| `memory/` | `normalize`, `fingerprint`, `mask`, `label`, `rulesHash`, `snap`, `firms` (+ `fixtures/memory/law-firms.json`), `index` |
| `session/cookie.ts` | session cookie helper (claims sign/resign) |
| `config/limits.ts` | size/quote limits |
| `contracts/` | frozen API contracts v1 (below) |
| `index.ts` | barrel; Phase 01 block is append-only |

The core has no DOM: root `eslint.config.js` bans `document`/`window` in `packages/core/src/**`.

## Pinned algorithms and final thresholds (all pinned values kept; no tuning)

- **H (headings)**: title max 120 chars, no sentence-final period (abbrev exceptions `No|Inc|Ltd|Co|Corp.`); caps = >=80% uppercase letters (min 3) on the title minus parentheticals and trailing `*`; bold = >=60% of letters bold, measured after the number/`Part X`/`Appendix X`/`Section X` prefix and before the first `(`; gap acceptance prev+2..prev+3 (`gap: true`). Scope openers: `Appendix X`, `Signature Page(s)`, `Terms and/& Conditions`, `Instructions`, document-level `Part X`, and a reset to 1 after a larger number.
- **R (ref-this-section)**: pattern `\bthis\s+Section\s+(\d{1,3}[A-Z]?)((?:\([a-z0-9]{1,6}\)){0,6})(?![.]\d|\d|\s+of\s)`; decimal sections excluded; guards (a) continuation-paragraph before bold "1." then (b); confidence 0.9, severity high.
- **L (ref-label-coherence)**: window = last 4 raw tokens, strip non-alphanumerics, stopwords `{to,the,of,in,for,as,a,an,and,or,with,by}`, lowercase, singular-fold; fires iff p < 0.25 and t >= 0.5; confidence 0.7, severity high (cap). Label precision on non-golden docs is a Phase 02 item.
- **U (undefined-term)**: offering nouns `{Units, Unit, Interests, Interest, Stock, Common Stock, Shares, Share, Securities}`; fires only when exactly one offering family is defined; carve-out "not defined herein ... meanings given/ascribed/assigned to them in the <Name>" gives severity medium, confidence 0.6, 2 interpretations (0.75 without).
- **S (statutory)**: 40-char marker window, `of the ... Act`, subsection chains `Section 3(c)(1)`, bare-repeat within 400 chars, Rule/U.S.C./C.F.R. are statutory, out-of-range numbers become `external`, decimal `Section 3.10` is internal-unresolved (recorded only).
- Goldens on real samples: #1 = 2, #3 = 2, #5 = 2, #11 = 1 findings; zero extra `broken_cross_reference` on #1, #2, #5, #10, #12.

## Frozen Contracts v1 (`contracts/`)

Exports by module: `ai` (AiCandidate/AiFinding/AiRequest/AiResult), `cache-key` (CacheKeyInput + `cacheKey()`), `claims` (SessionClaims, CreateSession req/res, `resign()`), `errors` (ErrorBody/Code/Detail, `errorStatus()`, `errorBody()`), `frames` (NDJSON Frame/Result/Heartbeat/Error, `parseFrameLine/Stream`, `frameLine`), `memory` (decisions, rules, counsel, audit, export, lookup, runs, MemoryLabel, ReasonCode), `ocr`, `quota`, `seed-spec`, `ports` (types only: PlatformPort, QuotaPort, CachePort, LedgerPort, RulesPort, TurnstilePort). Findings and model schemas are exported from `findings/` and `model/`.

- Freeze mechanism: `packages/core/test/__snapshots__/contracts.json-schema.snap` (67 schemas, sha256 `5dba7bee5848b012...`). Regenerate only with an explicit contract-change note.
- `ErrorDetailSchema = {code, message, reason?, retry_after_s?}`; HTTP body is `{error: ErrorDetail}`; the NDJSON error frame is `ErrorDetailSchema.extend({t:'error'})` (one schema). `invalid_request` -> 400 was added additively in Phase 01.
- `MemoryLabel` = `new | previously_dismissed | dismissed_reconfirm | already_answered | awaiting_counsel` (equals the DATA-MODEL `memory_label` CHECK); display aliases live in `MEMORY_LABEL_ALIASES`.
- `Finding` has optional `pattern_key`; `section_path` is `string[]`.

### How later phases extend contracts (additive only)

- Never edit or remove an existing field/enum value; add optional fields, new enum members, new schemas, new files.
- Seams are append-only: `src/index.ts` (append below the Phase 01 block) and `detectors/registry.ts` (append below the marker). Apply as single appended lines, serialized by the orchestrator.
- A new or changed schema requires re-generating the contracts snapshot with a change note, and the `test contracts` gate must stay green.
- Phase ownership (see `phase-blast-radius-registry.md`): P02 adds detectors + `memory/patternKey.ts` + `investor`; P05 `llm/`; P06 pdf/docx/ocr adapters; P07 `diff/`; P08 `counsel/`; P09 `outline/`. P04a/P04b/P03 consume the frozen contracts; they may not edit them in place.

## Gate commands (no `--` under pnpm 11.13.1)

`pnpm --filter @aduin/core test` | `test:golden` | `test:property` | `test:corpus` | `test:vectors` | `test security` | `test contracts`, plus `pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan`. Phase 01 results: 217 / 44 / 29 / 13 / 38 / 16 / 34 tests green; `--passWithNoTests` removed so an unmatched token exits 1.

## Known gaps / follow-ups

- Vectors and cookie helper not yet re-run under workerd/browser (owners P04b, P03).
- `memory/patternKey.ts` is created by Phase 02; the helper currently lives in `findings/make-finding.ts` and `Detector.patternKey()`.
- Dev deps fast-check/typescript/vitest are not in `THIRD_PARTY_NOTICES.md`.
- Independent security review of Phase 01 (`harness/phase-01/`) was pending at closeout.

## Update triggers

Any change to thresholds, contracts, detector set, adapter behavior, or the gate commands above.
