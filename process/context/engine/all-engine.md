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
(commit 6d12628). Read the report for exact golden counts and rationale. Phase 02 (commits 7a7f421 + review fixes 1f5dade) extended it additively; see the Phase 02 section below and `subdoc-qa-mvp_PHASE-02-detectors-fixtures_REPORT_17-10-26.md`.

## Layout (`packages/core/src`)

| Dir / file | Role |
|---|---|
| `model/` | zod frozen shapes: Doc, Block, Line, Anchor, Reference, Region, Cue, LogicGraph; `line-stream`, `anchors`, `hash`, `errors` |
| `adapters/html.ts` | SAX (htmlparser2) parse, row merge per `<tr>`, nearest-declaration bold walk, cp1252 remap, entities, glyph normalization, noise-rule list + repeated running headers, size cap, long-line split, windows-1252 fallback |
| `adapters/{format-detect,pdf-text,docx,ocr,page-noise,sup-segments}.ts`, `ocr/confidence.ts` | Phase 06 input adapters (below): extension + magic-byte detection, text-PDF with positions, DOCX (own subpath `@aduin/core/docx`), OCR result to Doc, shared page-noise rules, superscript segment markers |
| `structure/` | structurer: headings (H), numbering scopes, references, statutory (S), conditionals, option groups, defined terms, fields |
| `graph/` | `graph.ts` + `query.ts` (logic graph over structure) |
| `findings/` | `schema`, `taxonomy`, `ids`, `severity`, `make-finding.ts` (finding builder + `patternKey()` helper) |
| `detectors/` | `registry.ts` (append-only registration, "append below" marker) + golden detectors `ref-this-section` (R), `ref-label-coherence` (L), `undefined-term` (U) |
| `engine.ts` | `analyzeHtml`, `buildDocGraph`, `runDeterministic` |
| `memory/` | `normalize`, `fingerprint`, `mask`, `label`, `rulesHash`, `snap`, `firms` (+ `fixtures/memory/law-firms.json`), `index` |
| `session/cookie.ts` | session cookie helper (claims sign/resign) |
| `llm/` | Phase 05 LLM task framework (below): tasks, registry, rules injection, verify chain, candidates, provenance, recorded-transport types |
| `config/limits.ts` | size/quote limits |
| `contracts/` | frozen API contracts v1 (below) |
| `index.ts` | barrel; Phase 01 block is append-only |

The core has no DOM: root `eslint.config.js` bans `document`/`window` in `packages/core/src/**`.

## Pinned algorithms and final thresholds (all pinned values kept; no tuning)

- **H (headings)**: title max 120 chars, no sentence-final period (abbrev exceptions `No|Inc|Ltd|Co|Corp.`); caps = >=80% uppercase letters (min 3) on the title minus parentheticals and trailing `*`; bold = >=60% of letters bold, measured after the number/`Part X`/`Appendix X`/`Section X` prefix and before the first `(`; gap acceptance prev+2..prev+3 (`gap: true`). Scope openers: `Appendix X`, `Signature Page(s)`, `Terms and/& Conditions`, `Instructions`, document-level `Part X`, and a reset to 1 after a larger number.
- **R (ref-this-section)**: pattern `\bthis\s+Section\s+(\d{1,3}[A-Z]?)((?:\([a-z0-9]{1,6}\)){0,6})(?![.]\d|\d|\s+of\s)`; decimal sections excluded; guards (a) continuation-paragraph before bold "1." then (b); confidence 0.9; severity by routing context (see Severity of broken cross-references below).
- **L (ref-label-coherence)**: window = last 4 raw tokens, strip non-alphanumerics, stopwords `{to,the,of,in,for,as,a,an,and,or,with,by}`, lowercase, singular-fold; fires iff p < 0.25 and t >= 0.5; confidence 0.7; severity by routing context (below). The explanation text never prints the fit scores (`cited_overlap`/`expected_overlap` stay in facts). Label precision on non-golden docs is a Phase 02 item.
- **U (undefined-term)**: offering nouns `{Units, Unit, Interests, Interest, Stock, Common Stock, Shares, Share, Securities}`; fires only when exactly one offering family is defined; carve-out "not defined herein ... meanings given/ascribed/assigned to them in the <Name>" gives severity medium, confidence 0.6, 2 interpretations (0.75 without).
- **S (statutory)**: 40-char marker window, `of the ... Act`, subsection chains `Section 3(c)(1)`, bare-repeat within 400 chars, Rule/U.S.C./C.F.R. are statutory, out-of-range numbers become `external`, decimal `Section 3.10` is internal-unresolved (recorded only).
- Goldens on real samples: #1 = 2, #3 = 2, #5 = 2, #11 = 1 findings; zero extra `broken_cross_reference` on #1, #2, #5, #10, #12.

## Severity of broken cross-references (demo-readiness, 17-10-26)

- **Rule:** `ref-label-coherence` and `ref-this-section` emit **critical** (blocks digitization) when the reference is in a routing context, else **high**. `refRoutingContext(g, blockIndex)` in `detectors/util.ts`, in priority order: `instructions` (block in an `instructions` scope), `answer option` (block kind `option` or member of an option group), `conditional` (block hosts a `structure.conditionals` entry); `null` otherwise. The value is recorded as fact `routing_context` (`none` when null). Detector max severity is `critical`.
- **Why:** a wrong target inside a form instruction, an answer choice or a conditional sends the investor (or the digitized form logic) to the wrong place. A wrong pointer in body/representation text is a drafting error the analyst still flags, but it does not mis-route the form.
- **Corpus effect (12 HTML samples):** only the 4 swapped Part B refs on #3/#5 change (high -> critical, all `instructions` + `answer option`); #1 "this Section 11" (2 findings, body list item in Section 12) stays high. No other sample has a broken cross-reference finding. Fund fixtures (6/8/8, 62.5%), seeded matrix, fingerprints, finding ids, pattern keys, AI candidates and recordings are unchanged (none depend on severity or explanation text).
- AI findings still never gate (cap high, L4) and `computeGate` stays critical-only.

## Frozen Contracts v1 (`contracts/`)

Exports by module: `ai` (AiCandidate/AiFinding/AiRequest/AiResult), `cache-key` (CacheKeyInput + `cacheKey()`), `claims` (SessionClaims, CreateSession req/res, `resign()`), `errors` (ErrorBody/Code/Detail, `errorStatus()`, `errorBody()`), `frames` (NDJSON Frame/Result/Heartbeat/Error, `parseFrameLine/Stream`, `frameLine`), `memory` (decisions, rules, counsel, audit, export, lookup, runs, MemoryLabel, ReasonCode), `ocr`, `quota`, `seed-spec`, `ports` (types only: PlatformPort, QuotaPort, CachePort, LedgerPort, RulesPort, TurnstilePort). Findings and model schemas are exported from `findings/` and `model/`.

- Freeze mechanism: `packages/core/test/__snapshots__/contracts.json-schema.snap` (67 schemas; sha256 `bed258adbbfa03c6...` after the Phase 05 additive change, was `5dba7bee5848b012...`). Regenerate only with an explicit contract-change note.
- `ErrorDetailSchema = {code, message, reason?, retry_after_s?}`; HTTP body is `{error: ErrorDetail}`; the NDJSON error frame is `ErrorDetailSchema.extend({t:'error'})` (one schema). `invalid_request` -> 400 was added additively in Phase 01.
- `MemoryLabel` = `new | previously_dismissed | dismissed_reconfirm | already_answered | awaiting_counsel` (equals the DATA-MODEL `memory_label` CHECK); display aliases live in `MEMORY_LABEL_ALIASES`.
- `Finding` has optional `pattern_key`; `section_path` is `string[]`.

### How later phases extend contracts (additive only)

- Never edit or remove an existing field/enum value; add optional fields, new enum members, new schemas, new files.
- Seams are append-only: `src/index.ts` (append below the Phase 01 block) and `detectors/registry.ts` (append below the marker). Apply as single appended lines, serialized by the orchestrator.
- A new or changed schema requires re-generating the contracts snapshot with a change note, and the `test contracts` gate must stay green.
- Phase ownership (see `phase-blast-radius-registry.md`): P02 adds detectors + `memory/patternKey.ts` + `investor`; P05 `llm/`; P06 pdf/docx/ocr adapters; P07 `diff/`; P08 `counsel/`; P09 `outline/`. P04a/P04b/P03 consume the frozen contracts; they may not edit them in place.

## Phase 02 additions (detectors, investor paths, structure view, fixtures)

- **Detectors** (`detectors/`): `broken-conditional`, `unreachable-flow` (+ `flow.ts`), `option-gap-overlap`, `defined-term-issues`, `footnote-requirement` (reads the TS-only `footnote_marker` option side channel; no schema change), flags `flag-drafting-note`, `flag-placeholder`, `flag-sensitive` (facts = last4 + cue only), `investor-path-dead-end`, `investor-path-missing-item`. Every detector has an `explain()` that is total (>= 3 facts, truthy `expected`) for Phase 02 detectors; the Phase 01 detectors now also use `fact()` fallbacks (P2-3 closed in Phase 05). New findings on #3/#5/#6 (placeholders) and sensitive flags on #1/#7 are legitimate (AC10).
- **Per-detector isolation:** `engine.ts` wraps each `d.run(g)` in try/catch; a throwing detector is recorded as `{stage:'detector', detectorId, code: <error name>}` in the optional `EngineSettings.diagnostics` (never the message or document text) and the other detectors' findings still return.
- **Field clamps** (`findings/make-finding.ts`, `detectors/util.ts`): explanation 1000, facts 1000, interpretations 500 (max 6), expected 300; `maskFacts` clamps strings to 400 after masking; `listLabels` shows the first 5 labels + "and N more" so a 100-option group still yields one schema-valid finding.
- **maskThenClip:** all quote/where/excerpt text is masked BEFORE it is clipped (`maskThenClip(s, n)`; `excerpt()` widens its window to whole sensitive spans). Never slice then mask.
- **Masking** (`memory/mask.ts`): `ACCOUNT_NUMBER_RE` widened (alpha-prefixed `\b[A-Za-z]{1,4}-?\d{6,130}`, digit runs with optional space, dash, en-dash, `.`, `/`, NBSP separators up to 130, IBAN, no word-boundary assertions; all quantifiers bounded, linear). Side effects: `quote_hash` changes for any quote holding a newly masked run (`FP_VERSION` unchanged on purpose, no stored memory existed yet), phone numbers mask (P2-5), and 6+ digit dates with `/` or `.` also mask (e.g. `10/17/2026` becomes `#2026`); decision 17-10-26: keep (privacy-safe), revisit with a date/phone exclusion.
- **EDGAR noise rule** (`adapters/html.ts`): anchored to the wrapper shape only (`EX-...`, `<TAG>...`, `TAG:...`, case-sensitive tags), so lines such as "Type of Subscriber (check one):" are kept. Sample #10 now keeps its "Documentation" line.
- `memory/patternKey.ts` (charset `[a-z0-9:#>-]`, digits to `#`, 80 cap, no `|`; re-exported from `make-finding.ts`), `investor/{extract,paths,types}.ts`, `structure-view/build.ts` (`buildStructureView`, pure; worker wiring in `apps/web/src/engine/engine.worker.ts`, failure logs `console.warn` with the error name only).
- **Fixtures:** `fixtures/html-seeded/*` (clean control + defect per class; `seeded-defect-matrix` precision >= 90%, recall 100%), `fixtures/memory/{fund-I,fund-II,fund-Y}.html` + `fund-expectations.json` / `fund-I-decisions.json` / `fund-I-answers.json`, `fixtures/memory/demo-seed-spec.json`; all built by `scripts/src/fixtures/*` (`pnpm --filter @aduin/scripts fixtures:build` / `fixtures:check`).
- **Open (backlog `core-followups_REF`):** P2-6 defined-term false positives, P2-2 investor-path ground truth, P2-4 residual (inferred-cue weighting for #2/#5). F4, P2-3 and the P2-4 cue were closed in Phase 05.

## Phase 05 additions (LLM tasks, `llm/`; commits 2ac1917 + f0f476c)

Report: `subdoc-qa-mvp_PHASE-05-llm-ai-lane_REPORT_17-10-26.md` (Stage 0 section has the full export table).

- **Contract change (additive, snapshot regenerated with a note):** `AiRequestSchema.task` (enum `clause-judgment | counsel-draft`, default `clause-judgment`, so old requests still parse) and `AiResultSchema.drafts` (optional, max 40 of `{candidate_id, text <= 1500}`). The `frames` result/frame schemas also changed in the snapshot because they embed `AiResultSchema` (byte-identical without `drafts`). `AiTaskId`, `AI_TASK_IDS`, `AiCandidate` are type/tuple exports only.
- **Task registry** (`llm/registry.ts`): `TASKS` (`clause-judgment`, `counsel-draft`), `taskById`, `DEFAULT_TASK_ID`. A task is `{id, promptVersion, schemaVersion, buildMessages(input, rules), modelResultSchema, validate(modelJson, input, usage)}`. Frozen versions (cache key `prompt_ver` / `schema_ver`): `clause-judgment@1` / `clause-judgment.s1`, `counsel-draft@1` / `counsel-draft.s1`. Any prompt text change must bump the version; `llm-task-registry` pins the `inputHash` of a fixed input to catch silent edits.
- **API summary:** `wire.ts` (`responseFormat(task, mode)`, `schemaInstruction`, `inputHash`, `AI_MAX_TOKENS = 10000` single source, `AiResponseMode = 'json_schema' | 'json_object'`), `rules.ts` (`selectInjectedRules`, `injectedRulesHash`, `rulesHash8`, `escapeForTag`, `rulesAppliedNotice` "N of M firm rules applied"), `verify-quote.ts` (`verifyAiResult`, `locateQuote`), `candidates.ts` (`buildAiCandidates`, `buildAiCandidatesWithSites`), `provenance.ts` (`provenanceOf`, "AI suggestion" label), `transport.ts` (`LlmTransport`, `LlmRecordingSchema`, `recordingPath`, `RecordingMissError`).
- **Rules injection:** rules are untrusted context, never instructions or a filter. Selection: NFC, collapse whitespace, trim, drop empties, sort by code unit, skip rules over 500 code points, then add greedily while under 20 rules and within 4096 UTF-8 bytes. Rules and candidates go into `<untrusted_firm_rules>` / `<untrusted_document_excerpts>` blocks with `<`, `>`, `&`, U+2028/9 escaped to `\uXXXX`. The injected hash equals core `rulesHash` whenever nothing is truncated (`none` when empty).
- **Verify chain** (the only way an AI result becomes findings): envelope check, per-finding schema (quote over 1000 chars rejected), the quote must be at least 12 normalized chars and 3 words (`quote_too_short`), tolerant locate (case, whitespace, curly quotes, dashes, soft-hyphen/zero-width, wrapping quotes/ellipsis) scoped to the cited candidate's site only (review M1: a quote can no longer anchor in another candidate's block), then sentence snap, mask, `quoteHash`, severity cap via `maxSeverityFor(class, 'ai')`, `FindingSchema`. Findings carry `detector_id = 'ai:<task>'`, `detector_kind: 'ai'` and facts `{source:'AI suggestion', candidate_id, model, task}`. It never throws. `task.validate` drops items with unknown `candidate_id` or an invalid shape (counted in `ext.dropped`); `wrapEnvelope` validates at most `aiCandidates * 3` items.
- **Candidates:** rule-finding sentences first, then conditionals, defined terms, option-group first lines; masked, deduplicated by sentence, capped at 40, document order, ids `c_` + 16 hex (stable per docHash).
- **Deterministic fixes:** F4 bounded defined-term scan via a word index, P2-3 total `explain()` on sparse facts, P2-4 `check one` exclusivity cue (sample #10 badge 31 to 30; #2 and #5 do not move).
- **Snapshot note:** only the contracts snapshot entries above changed; goldens (#1=2, #3=2, #5=2, #11=1) and `fixtures:check` are unchanged. Recordings live in `fixtures/llm-recordings/{taskId}/{inputHash16}.json`; a changed candidate set or prompt moves the inputHash, so re-run `record:author`, re-record live ones, then `precompute:ai`.
- **Open:** drafts text is not yet masked/clamped for UI (L6), `computeGate` must exclude `detector_kind: 'ai'` (L4), both Phase 08.

## Phase 06 additions (PDF, DOCX, OCR adapters; commits 027a450 .. 73599b5)

Report: `subdoc-qa-mvp_PHASE-06-pdf-docx-ocr_REPORT_17-10-26.md` (closeout section has SPEC achievement and live usage). No frozen contract changed (additive only).

- **format-detect** picks the adapter from extension plus magic bytes and rejects unsupported/corrupt/empty/oversize/encrypted input with a clear `CoreError`. `pdf-text` extracts text with positions and per-page progress (unpdf/pdf.js); `page-noise` holds the shared running-header/footer rules used by PDF and OCR; `sup-segments` turns superscript footnote markers into `^{n}` segments.
- **DOCX** lives in `adapters/docx.ts`, imported as the subpath `@aduin/core/docx` so mammoth never enters the main barrel (`"exports": {".": ..., "./docx": ...}`). Pipeline: `verifyZipEntries` inflates every entry, then `repackZip` rebuilds a canonical STORE zip from exactly those verified entries, then `assertRepackMatches` self-checks the repack, and only the repacked bytes reach mammoth (this removed the parser differential found in review F1). Limits: 20 MB per entry, 64 MB total, 2000 entries, 255-byte entry names; names must be valid UTF-8 (fatal decode), with no control chars, backslashes, `.`/`..`/empty segments, absolute or drive paths. ZIP64 sentinels (0xffff / 0xffffffff), ZIP64 signatures in the directory/tail region, a gap between the central directory and the EOCD, nonzero disk numbers and normalized duplicate names are refused. Suite: `test/security/docx-zip-bomb.test.ts` (31 cases, mammoth spy proves it is never called on refusal).
- **OCR text contract:** `adapters/ocr.ts` turns model OCR pages into a Doc. Footnote markers and checkboxes travel inside line text as `^{n}` and the checkbox glyphs (prompt `ocr2`); the adapter strips the space the model puts before `^{n}`. Every OCR line carries page + region; `finding.region` (additive, optional) lets a finding point at the line box on the scanned page. `ocr/confidence.ts` scores per-page confidence (live model confidence is uninformative at 0.95, so low-confidence marking rests on adapter heuristics).
- **OCR-only footnote branch (AC14):** the footnote-requirement detector has a branch for OCR docs (footnote requirement read from the `^{n}` text), deduped against PATH-04 so the same Account Type finding is reported once. Golden: `golden-09-ocr-footnote2` (13 cases) on recorded OCR output.
- **Render and OCR queue are web, not core:** `apps/web/src/engine/{render-pages,ocr-queue}.ts` run on the main thread (page images, per-page hashing over original bytes, quota call, `/api/ocr` posts). Core only maps results.

## Phase 07 additions (version diff, `diff/`; commits f3f533f + 99c9cee + dca6a45)

Report: `subdoc-qa-mvp_PHASE-07-version-diff_REPORT_17-10-26.md` (07a pinned goldens, 07b Compare, 07c narrative, closeout with SPEC achievement).

- **API:** `diffDocuments({a, b, mode})` in `packages/core/src/diff/index.ts` (barrel append). `mode` is `version` or `sibling`. Each side is a `SideInput` (already read / structured / detected by the caller, so core stays format-free) or a per-side failure; a failure returns `{error:{side, stage, code}}` where `DiffStage` = `read | parse | structure | detect | diff` and `code` matches `^[a-z_]{1,40}$` (never document text, never a message). An internal exception maps to `{error:{side:'a', stage:'diff', code}}`. Result schema `DiffResultSchema` is strict and has no timing field (determinism).
- **Alignment** (`align.ts`): units are scope preambles, sections and parts. Passes in order: exact (structural key plus heading key, made monotone by an O(n log n) LIS step), LCS on heading keys inside unmatched windows (window capped at 250k cells), same structural key (relabel), Jaccard similarity of at least 0.5 on heading plus the first 200 chars. Repeated headers get ordinals (`body:2`, `#n`). Section titles are compared with parentheticals stripped.
- **Text diff** (`diff-text.ts`): sensitive spans are computed once on the whole raw text; each span is one atomic token, then jsdiff `diffArrays` with `maxEditLength` 1500 (no wall-clock option, so output never depends on machine speed). A number is never split across segments (E17). If jsdiff returns `undefined`, the fallback is one `del` plus one `add` with `truncated: true`. Excerpts are raw clipped text plus `sensitiveSpans`; core does no masking, the main thread masks with `mask`.
- **Rename inference** (`rename-inference.ts`): a term pair is a rename when the old term's coverage is at least 0.8, count at least 3, and the new term sits in the same position window (plus or minus 48 chars). Pinned #5 to #6 renames: Member to Shareholder 4/4, Memorandum to Prospectus 8/8, Placement Fee to Sales Load 3/3, Units to Shares 29/35 (0.83), placement agent to distributor 4/4.
- **Possible leftover:** an old term still present in the new document after a rename of its neighbors: co-occurrence at least 0.5, count at least 3, confidence = min(0.4, 0.4 x ratio), severity low, never a blocking finding. #6 yields LLC Agreement 0.31 (11 occurrences, AC16), ERISA 0.24, Plan 0.30.
- **Findings delta** (`findings-delta.ts`): fixed / still present / new, matched by detector plus quote similarity at threshold 0.5 (accepted pairs min 1.0; best rejected same-detector pair 0.231). #5 to #6: fixed 4, still present 3, new 0. Also extracts definitions, fees (`extract-fees.ts`) and requirements (`extract-requirements.ts`); definition and requirement comparisons are rename-aware so a rename alone does not read as a change.
- **Sibling mode** (`sibling.ts`): clause-level common vs differing between feeder / parallel documents.
- **Perf (AC29):** Node 187 ms warm (#5 vs #6), browser 343 ms; budget 3 s. Core limits: no OCR input (OCR runs on the main thread, see backlog `compare-ocr-documents`).
- **Drift narrative task** (`llm/tasks/drift-narrative.v1.ts`, 07c): `drift-narrative@1` / `drift-narrative.s1`, model schema `drift_narrative_v1` = `drafts[{candidate_id, text <= 600}]`. `buildDriftNarrativeCandidates(DiffResult)` makes one candidate per rename (max 8, largest count first) with a masked and clipped sample (mask, then pattern-mask, then clip, E18); `readDriftNarrative(data, candidates)` is the main-thread reader. The validator drops any draft whose candidate was not sent or whose text does not name both terms (`ext.dropped`), so the narrative can state only renames present in `DiffResult.renames`.
- **Contract change (additive, snapshot regenerated):** `AI_TASK_IDS` is now `clause-judgment | counsel-draft | drift-narrative` (3 values); only the `AiRequestSchema.task` enum entry moved in the contracts snapshot. The Worker picks the task up through `TASKS` with no code change. Pairs use request `sample: null` plus `pair`, no `x-aduin-doc` header. The contracts snapshot test uses a hard-coded module list, so `diff/` is covered by `diff-contract` instead.
- **Fixtures:** `fixtures/diff/{sibling-A,sibling-B,empty,single-section}.html`, `identical-pair/`, `expected/*.json`, generated by `buildDiffFixtures()` in `scripts/src/fixtures/build-seeded.ts`; `fixtures:check` scans `fixtures/diff` recursively for stray files. Recordings: `fixtures/llm-recordings/drift-narrative/{5685e20db8f250a9 (live),7252bfe74de14154 (authored hostile)}.json`. After any diff-engine change run `record:author --check` (candidate quotes move the inputHash).

## Phase 09 additions (logic outline export, `outline/`; commit feb0acc)

Report: `subdoc-qa-mvp_PHASE-09-logic-outline_REPORT_17-10-26.md`.

- **API** (`packages/core/src/outline/{version,schema,build,index}.ts`, barrel append): `OutlineSchema` v1 (strict zod objects, fixed key order, no records, no timestamp so output is byte-stable), `OutlineDraft`, `buildOutlineDraft(...)` (takes optional `ocrLowConfidencePages` and `notice`, composes a masked `confidenceNote` clipped to 300 chars, key omitted when neither is present), `maskOutlineName`, `outlineFilename`, `OUTLINE_SCHEMA_ID`, `OUTLINE_DISCLAIMER`. References list internal ones first, then external, each in document order. OCR page numbers are `ocr.pages[].index + 1` (0-based in the engine).
- **Snapshot:** `fixtures/outline/schema.v1.json` is generated from `z.toJSONSchema(OutlineSchema)` and compared by deep equality (not raw bytes). Regenerate only on a deliberate schema version bump.
- **Web side:** optional `EngineResult.outline` built in `engine.worker.ts` right after `result.structure`, in its own try/catch (absent when there is no structure). Export UI: `docs` in `process/context/ui/all-ui.md`.
- **Residuals (backlog):** R1 investor-path ground truth, R2 OCR confidence calibration, R3 `downloadBlob` real-browser revoke.

## Phase 08 additions (counsel, `counsel/`; commit 02c26bf)

- **Files:** `counsel/{gate,sheet,template-draft,metrics}.ts`, re-exported append-only from `src/index.ts`. Tests: `test/unit/counsel/{gate-state-matrix,sheet-contents,metrics}.test.ts` (matrix is 2400 cells plus named stubs).
- **`computeGate`** (also `gateReasonFor`, `isGating`, `findingLink`, `GATE_REASON_TEXT`): critical-only; `detector_kind === 'ai'` never gates (L4); a clear counsel answer A/B/C resolves, including a `dismissed_reconfirm` item (D-2); `unclear` stays `unclear`; Accept alone stays `unanswered` (AC22); Needs counsel is `awaiting_counsel`; a dismissal resolves only with a reason code; an open status falls back to the memory label; a high `dismissed_reconfirm` shows its label but does not gate. The web `gateInterim.ts` is now a thin re-export.
- **Sheet** (`buildCounselSheet`, `includeOnSheet`): D-1, the sheet holds only unanswered New/Accepted questions; answered (A/B/C) or dismissed here are excluded; `unclear` returns as New; labels `already_answered`, `awaiting_counsel`, `previously_dismissed` are excluded; `dismissed_reconfirm` is included only if accepted or sent to counsel here. Quotes are masked (`mask(text, sensitiveSpans(text))`) and clamped to `limits.quoteMaxChars`; interpretations are edited/AI drafts else template, masked, at most 6 of at most 500 chars (valid against `CounselQuestionRequestSchema`). Numbering is 1-based in finding order.
- **Template drafts** (`templateInterpretations`, `templateQuestionText`, `maskAndClamp`, `maskQuote`, `clampInterpretations`): no-AI fallback wording.
- **Metrics** (`computeMetrics`, AC64): `defectsBeforeBuild` = non-AI findings not `dismissed` with `tool_false_alarm`; `questionsBatched` = sheet size; `timeToExportMs` = max(0, exportedAt - t0).
- Gate result: core 76 files / 2914 tests at eb53541; `contracts/` unchanged (snapshot).

## Fund Package Intake additions (`package/`; commits f3928b6 .. 8503cde, review fixes 0784938)

Source of truth: `process/features/fund-package-intake/active/intake-mvp_17-10-26/intake-mvp_PHASE-1-core-package-engine_REPORT_17-10-26.md`. Additive only: frozen contracts v1, the 13 detectors / 15 issue classes and `computeGate` are unchanged; the barrel `src/index.ts` gains one appended block.

- **`packages/core/src/package/`**: `types`, `config` (caps: `PACKAGE_LIMITS` 12 files, 40 MB total, `maxUploadBytes` per file; `REFERENCE_SCAN_LIMITS` 50 references per block, 500 per document; the scan stops at the cap and counts what it skipped), `detect` (rule-based type, role, confidence and stated reason from file name, title line and known phrases; a `DocTypeSuggester` seam with `mergeSuggestion` precedence, no LLM task ships), `facts` (light read, cached by the web worker), `definitions`, `references` (outside-document references with verbatim quote and location), `resolve` (synonym table; unclear match is shown, never guessed), `terms` (cross-document used-term statuses `defined_in_package` and `unverified`), `coverage` (full / partial / blocked per check group), `policy` (gate policy as data: missing sub agreement blocks, missing LPA or PPM warns), `request` (one item per distinct missing target, deduped), `baseline` (`eligibleBaselines`, same firm only), `quote` (verbatim check; failing quotes are dropped and counted), `analyze`.
- **Structurer and conditionals (T14):** `structure/headings.ts` (`sectionCandidate`) accepts `Section N.`, `SECTION N`, `Article N.`, roman `Article I.` and `ARTICLE N`; `structure/conditionals.ts` and `detectors/flow.ts` (`parseTarget`, `checkTarget`) plus `detectors/broken-conditional.ts` resolve `Annex X` and `Question N` targets. No new detector or issue class.
- **Quotes** in `DocumentRequest` are stored unmasked; every render and the request DOCX must route them through `maskAndClamp` / `maskQuote`.
- **Fixtures:** `fixtures/package/**` (generated by `scripts/src/fixtures/make-package.ts`, drift-gated by `fixtures:check`) includes copies of the design-owned `samples/packages/**` (read-only) with `expected.json` from the answer keys.
- **Known gaps:** Schedule/Exhibit targets, per-Part numbering and dash headings (`intake-annex-question-forms`); reference families US Feeder Subscription Agreement, Eligible Transferee Certificate, Tax Form Selection Guide and some used terms (`intake-reference-families`). Stubs live in `process/features/fund-package-intake/backlog/`.
- Gate result: core 3084 tests (+3 opt-in skip: `package-realfacts-local`, Hybrid with `PACKAGE_LOCAL=1`); tokens `package-detect`, `package-type-detection-golden`, `package-reference-*`, `package-quote-verbatim-contract`, `package-crossdoc-terms-golden`, `package-coverage-matrix`, `package-gate-policy-matrix`, `package-request`, `package-baseline-eligibility`, `package-determinism`, `package-suggester-seam`, `package-limits`, `structure-heading-forms`, `broken-conditional-annex-question`, `package-design-goldens`.

## Variance engine (`variance/`; Variance Phase 01, commits 42b3ecb .. 0ee9fca)

Source of truth: `process/features/variance-management/active/variance-mvp_17-10-26/variance-mvp-phase-01-core-engine_REPORT_17-10-26.md`. Compares a new document to a same-firm baseline and classifies every raw change `new`, `changed_logic` or `changed_cosmetic`. Deterministic, no LLM, no network. Additive: frozen contracts v1 and the detector set are unchanged.

- **`packages/core/src/variance/`**: `rules-schema` (zod strict), `variance-rules.json` (rules config, version `2026.10.2`), `rules` (`loadVarianceRules`, `VarianceConfigError`, canonical `rulesHash8`, nested-quantifier regex rejection), `hunks` (jsdiff via `diffText`, merge gap 1, move hunks), `classify` + `cosmetic` (ordered algorithm: renumber/date/page-label digit exemptions, then format, name, rename; display-only cosmetic groups), `impact` (from the logic graph; demo 4.2 line), `audience` + `routing` (owner per class: counsel, GP, fund admin), `adapter` (variance findings as scalar facts; `varianceMetaOf` is the only decoder), `regression` + `label` (`runRegressionChecks`, `normalizeAssertionLabel`), `owners` (question keys), `run` (`runVariance`), `types`.
- **Cosmetic rule `VAR-COS-PAGE-LABEL`** (rules 2026.10.2): accepts a hunk only when each changed side is exactly one `^[A-Z]{1,2}-\d{1,3}$` token alone on its own line; every other guard still wins ("see Annex B-1" -> "B-2" stays logic). Added after EVL strict precision on real #5 -> #6 was 30%; now 6.7% (2.9% overall).
- **Counsel additions (additive):** `computeGate(..., policy?)` takes an optional 4th `VarianceGatePolicy` argument; with it off the output is byte-equal on all 2400 legacy cells. New optional fields `GateFinding.gates`, `GateState.ownerAnswers`, `GateReason.owner`, `SheetFinding.owners` / `change`; per-owner sheet and a `version_drift` template draft in `counsel/template-draft.ts` (not yet in the barrel).
- **Barrel:** `src/index.ts` gains an explicit named export list (no `export *`): `runVariance`, `varianceMetaOf`, `loadVarianceRules`, `questionKey`, `parseQuestionKey`, `runRegressionChecks`, `describeAssertion`, `assertionCandidateOf`, `normalizeAssertionLabel` plus types. Callers pass `firmId` on both `VarianceSide`s and `gates: true` for variance findings.
- **Fixtures:** `fixtures/variance/**` generated by `scripts/src/fixtures/build-variance.ts` (called from `build-seeded.ts`, drift-gated by `fixtures:check`; hand-authored `expected/*.json`). Demo pair Hartwell & Crane Fund II -> III: raw 214, shown 7 (3 new, 4 logic), cosmetic 207 in 5 groups (118 / 41 / 8 / 29 / 11). Package 01 Northgate (from `fixtures/package/design/northgate-iii`): 64 raw, 9 shown (2 new + 7 logic), recall 7/7; its row split differs from the answer key (backlog `variance-package-01-key-divergence_NOTE_17-10-26.md`).
- **Known gaps:** impact precision on real documents is unproven (labelled "uncertain"; backlog `variance-impact-real-sample-ground-truth`).
- Gate result: core 3158 (+3 skip); 18 `variance-*` tokens, see `process/context/tests/all-tests.md`.

## Gate commands (no `--` under pnpm 11.13.1)

`pnpm --filter @aduin/core test` | `test:golden` | `test:property` | `test:corpus` | `test:vectors` | `test security` | `test contracts`, plus `pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan`. Phase 01 results: 217 / 44 / 29 / 13 / 38 / 16 / 34 tests green; after Phase 05 the whole core suite is 51 files / 355 tests; after Phase 07 and 09 it is 73 files / 501 tests (golden 67); `--passWithNoTests` removed so an unmatched token exits 1.

## Known gaps / follow-ups

- Vectors and cookie helper not yet re-run under workerd/browser (owners P04b, P03).
- `memory/patternKey.ts` now exists (Phase 02); `findings/make-finding.ts` re-exports it.
- Dev deps fast-check/typescript/vitest are not in `THIRD_PARTY_NOTICES.md`.
- Independent security review of Phase 01 completed (APPROVE_WITH_FIXES, fixed); Phase 02 review fixes applied in 1f5dade.

## Update triggers

Any change to thresholds, contracts, detector set, adapter behavior, or the gate commands above.
