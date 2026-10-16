---
name: plan:subdoc-qa-mvp-phase-01-core-engine
description: "Sub-doc QA MVP — Phase 01: core document model, HTML adapter, structurer, logic graph, finding schema, golden detectors, memory core module and API contracts"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-01
---

# Phase 01 — Core Engine (HTML slice, golden detectors, memory core, API contracts)

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: 🚧 EXECUTED — awaiting EVL
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** 🚧 EXECUTED — awaiting EVL
**Milestone:** M1 vertical slice (00 → 01 → 03 → 04a)
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-01-core-engine_REPORT_17-10-26.md

---

## Overview

Builds `packages/core`, the single TypeScript engine that runs identically in the browser Web Worker, Node tests and (for memory/contract code only) the Worker. Deliverables: line-stream document model; HTML adapter (htmlparser2); structurer (heading inference without heading tags, scoped numbering, references, conditionals, option groups, defined terms, statutory-cite exclusion, "this Section N"); logic graph; zod finding schema and taxonomy; detector registry with the golden detectors (#1 "this Section 11", #3/#5 swapped Part B references via label-coherence, #11 undefined "Units"); the **memory core** (`normalize`, `fingerprint`, `mask`, `label`, `rulesHash`, firm list, signed-cookie helper) with conformance vectors; and the **frozen API contracts v1** (zod) so Phases 03, 04a, 04b, 05, 06, 08 can proceed in parallel. Context routers: `process/context/all-context.md`, `process/context/product-domain.md`, `process/context/tests/all-tests.md`; sample manifest `samples/sub-docs/README.md`.

## Phase Completion Rules

- CODE DONE = modules and tests committed.
- VERIFIED = Exit Gate green, validate-contract written, golden tests green on the real samples, contracts frozen and listed in the report, regression: Phase 00 smoke (`pnpm test`, guards) green. User confirmed approval is only needed if a contract change is requested later.

## Acceptance Criteria

Owned (primary named proof is in this phase). Each lists `proven by:` and `strategy:`.

| AC | Statement (short) | proven by | strategy | Closing / extra verification |
|---|---|---|---|---|
| AC7 | Every finding complete (class, severity, quote+location, provenance, confidence, interpretations for counsel items) | `finding-schema-contract` (property test over all findings from all samples + fixtures) | Fully-Automated | re-run in every later phase; final P10 |
| AC8 | Deterministic and reproducible | `determinism-repeat-run` (N=5 runs, byte-equal) | Fully-Automated | re-run P02 |
| AC9 | Each finding states rule + facts used | `explanation-present-per-rule` (iterates the detector registry: every rule must supply `explain`) | Fully-Automated | auto-covers P02 rules |
| AC11 | #1 "this Section 11" → expected Section 12 | `golden-01-this-section-11` | Fully-Automated | — |
| AC12 | #3/#5 swapped Part B refs (4 findings across 2 docs) | `golden-03-05-swapped-part-b-refs` | Fully-Automated | — |
| AC13 | #11 "offered Units" vs defined "Shares" | `golden-11-undefined-units` | Fully-Automated | — |
| AC17 | Structure extraction lists sections, refs (resolved/unresolved/suspicious), conditionals, option groups, defined terms; statutory cites not flagged | `graph-extraction-fixtures` + `golden-statutory-cite-not-flagged` | Fully-Automated | view verified in P03 |
| AC43 | Memory label from fingerprint match (New / Previously dismissed / Already answered / Awaiting counsel / reconfirm; revoked never matches) | `memory-label-matrix` (pure `resolveLabel`) | Fully-Automated | server lookup P04b; integrated P08 |
| AC46 | Edited passage is new; case/space/quote variants match | `fingerprint-normalization-property` (fast-check) + `fingerprint-vectors` | Fully-Automated | e2e `memory-edit-is-new-e2e` P08 |

## Entry Gate

- Phase 00 exit gate passed (scaffold, guards, pins, spike S7 baseline).
- S7 result read: if parse+merge on #2 exceeded 1.5 s, step C budgets chunked SAX from the start.

## Library pins (confirm via vc-docs-seeker in Phase 00, recorded in the REF)

htmlparser2, zod, @noble/hashes (sha256 import path), fast-check, Vitest. No DOM library in core (core must run in Workers/Node/Web Worker without `document`).

## Touchpoints (create)

```
packages/core/src/
  model/{types.ts,line-stream.ts,anchors.ts}        Doc, Block, Line, Cue, Anchor (hash of doc + structural position)
  adapters/html.ts                                   htmlparser2 SAX → LineStream; table-cell merge; checkbox glyph normalization; EDGAR-noise pre-pass (auditable list)
  structure/{structurer.ts,headings.ts,numbering-scopes.ts,references.ts,conditionals.ts,option-groups.ts,defined-terms.ts,fields.ts,statutory.ts}
  graph/{graph.ts,query.ts}
  findings/{schema.ts,taxonomy.ts,ids.ts,severity.ts}  zod Finding; 15 issue_class codes (DATA-MODEL 2.1); stable ids (AC8)
  detectors/{registry.ts,ref-this-section.ts,ref-label-coherence.ts,undefined-term.ts}
  memory/{normalize.ts,fingerprint.ts,mask.ts,label.ts,rulesHash.ts,firms.ts,patternKey.ts(interface only),index.ts}
  session/cookie.ts                                  HMAC-SHA256 sign/verify via WebCrypto, kid rotation, SessionClaims
  config/limits.ts                                   locked numeric defaults (umbrella table)
  contracts/{errors.ts,ai.ts,ocr.ts,quota.ts,memory.ts,ports.ts,seed-spec.ts}  API contracts v1 + PlatformPort/QuotaPort/CachePort/LedgerPort types + DemoSeedSpec
  engine.ts                                           runDeterministic(doc, settings) → stable-ordered findings
  memory/snap.ts                                      snapToSentence(text, start, end) → {quote, start, end} (pure, tested)
  contracts/{cache-key.ts,frames.ts,claims.ts}        cacheKey(), NDJSON frame schemas, SessionClaims (see Contracts v1)
  index.ts                                            barrel (append-only)
packages/core/test/{unit,property,golden,seeded,security}/…
packages/core/test/__snapshots__/contracts.json-schema.snap   JSON-schema snapshot of every exported contract schema (freeze artifact)
fixtures/fingerprint-vectors.json
fixtures/memory/law-firms.json                        canonical firms + aliases (partners-group, firm-x, firm-y); consumed by web firms.json (P03) and migration 0003 (P04b)
```

## Public Contracts (frozen at Phase 01 exit)

- `Finding` zod schema (fields per DATA-MODEL `finding`: issue_class, severity critical|high|medium|low, detector_kind rule|ai, detector_id, model?, provenance?, confidence 0..1, anchor, section_path, page?, region?, quote (client-side only, full document sentence, <=1000 chars, never sent to the server except in decisions/counsel writes), quote_snippet (masked, for display/storage), quote_hash, fingerprint? (optional; see firmId rule), detail {explanation facts, interpretations[]}). `critical` = blocks digitization. AI-only findings may not exceed `high` (cannot gate unless the analyst promotes).
- `Detector {id, class, severity, explain(), patternKey(), run(graph)}`; registry export `detectors`.
- Fingerprint: `normalize` (NFC; strip U+00AD, U+200B..U+200D, U+FEFF; lowercase; unify curly quotes; collapse Unicode whitespace; keep digits/punctuation), `quote_hash = hex(sha256(normalize(q)))`, `fingerprint = hex(sha256("fp1|"+firmId+"|"+class+"|"+quote_hash))`; quote capped 1000 chars (longer rejected, never truncated); sensitive spans masked before normalization. **Mask format (single, = DATA-MODEL 2.2):** the flagged span is replaced by `#` + its last 4 digits, no length leak (`021000021` -> `#0021`); `sensitive_data` severity capped at `medium`, so a last-4 collision can never hide a blocking item.
- **firmId=null rule (picked):** `Finding.fingerprint` is OPTIONAL. The engine never computes it (engine has no firm). Exported `fingerprintFor(finding, firmId: string | null): string | null` computes it at lookup time and returns `null` when `firmId` is null ("memory not applied"). `quote_hash` is always present.
- **Sentence snap:** `snapToSentence(blockText, matchStart, matchEnd)` (memory/snap.ts) expands to the enclosing sentence: boundary = `.`/`?`/`!`/`;` followed by whitespace+uppercase/digit/quote, or block start/end, ignoring abbreviations from a closed list (`Inc.`, `Ltd.`, `U.S.`, `No.`, `Sec.`, `e.g.`, `i.e.`, `Corp.`, `Co.`) and decimals; if the snapped sentence exceeds 1000 chars it is cut to the 1000-char window centred on the match at word boundaries (the snap, not the finding, is truncated; a hand-supplied over-limit quote is still rejected). Deterministic, pure; tests: abbreviation, decimal, list item, no-terminator block, over-limit, quote spanning 2 lines.
- `resolveLabel(finding: Pick<Finding,'severity'|'issue_class'|'fingerprint'>, activeDecision: ActiveDecision | null): MemoryLabel` per DATA-MODEL 2.3. `ActiveDecision = {id, fingerprint, status: 'active'|'superseded'|'revoked', decision: 'dismissed'|'accepted'|'answered', counsel_option?: 'A'|'B'|'C'|'unclear', ...}`; `MemoryLabel = 'new'|'dismissed'|'dismissed_reconfirm'|'answered'|'awaiting_counsel'` (enum exported; matches the `memory_label` column enum in DATA-MODEL). Rules: `null` -> new; `status !== 'active'` (revoked/superseded) -> new, never matches; fingerprint mismatch between finding and decision -> new; dismissed+blocking (severity critical|high) -> dismissed_reconfirm; dismissed+non-blocking -> dismissed; answered A/B/C -> answered; answered unclear -> new; accepted without answer -> awaiting_counsel. Exhaustive table test enumerates all (decision x status x blocking x fingerprint-match) combinations.
- API contracts v1: field-level tables in section "Contracts v1 (field-level)" below (endpoints, NDJSON frames, cache key, AI/OCR envelope, SessionClaims, ports), plus error codes (`fingerprint_mismatch`, `read_only_demo`, `rate_limited`, `quota_exhausted`, `budget_cap`, `upstream_failed`, `memory_unavailable`, `payload_too_large`, `unsupported_type`, `invalid_session`, `conflict_active_decision`).
- Frozen model shapes (Doc/Block/Line/Cue/Anchor/Reference/graph) in section "Frozen Model Shapes" below.
- **Freeze mechanism:** JSON-schema snapshot test (`contracts.json-schema.snap`, generated from the zod schemas via `z.toJSONSchema`, key-sorted, stable stringify); any schema change fails the snapshot test and must be accompanied by a contract-change note. Additive-only evolution (new optional fields) for AI/OCR envelope and frames.
- Changes after exit: only through a contract-change note in the phase report plus registry entry; dependent phases re-run their contract tests.

## Blast Radius

Owned by this phase: `packages/core/src/{model,adapters/html.ts,structure,graph,findings,detectors,memory,session,config,contracts,engine.ts}`, `packages/core/test/**`, `fixtures/fingerprint-vectors.json`, `fixtures/memory/law-firms.json`. NOT owned (later phases create these subdirs; Phase 01 never writes them): `packages/core/src/{llm,diff,counsel,outline,investor}/**` and `packages/core/src/adapters/{pdf,docx,ocr}*`. `packages/core/src/index.ts` and `packages/core/src/detectors/registry.ts` are append-only seams (later phases append exports/registrations; no rewrites). Phase-00-owned files touched only through item F0 as serialized seam edits by the orchestrator: `packages/core/package.json`, `packages/core/vitest.config.ts`, root eslint config. Reads (never edits) `samples/sub-docs/raw/*.htm`. Registry: `## Phase 01`.

### Registry follow-up

**Applied** (orchestrator, cycle 2: registry Phase 01 ownership narrowed; umbrella mask row fixed to `#` + last 4). The narrowed claim, for reference (this plan does not edit the registry): add (a) `contracts/{cache-key,frames,claims}.ts`, `memory/snap.ts`, `test/security/**`, `test/__snapshots__/contracts.json-schema.snap`; (b) append-only seams `src/index.ts`, `src/detectors/registry.ts`; (c) F0 seam edits to Phase-00-owned `packages/core/package.json`, `vitest.config.ts`, root eslint config; (d) explicit exclusions for later-phase subdirs (llm, diff, counsel, outline, investor, adapters pdf/docx/ocr). Possible conflicts: Phases 05/06/07/08/09 append to `index.ts`/`registry.ts` only.

## Pinned Algorithms (structurer and detectors)

All rules operate on LineStream + Cues only (never raw HTML), so PDF/DOCX/OCR adapters reuse them. All regexes are linear-time (no nested quantifiers; bounded windows; see Security Hardening ReDoS test).

### H. Heading inference (G2; golden-critical for #1, #3, #5)

1. **Bold cue** (`Cue.bold`) from: `<b>`/`<strong>`; inline CSS on the element or any ancestor up to the row: `font-weight:bold|bolder|[6-9]00`, shorthand `font: ... bold ...`; **the bold cue is the nearest style declaration walking ancestors from the text run to the document root (TABLE, TR, TD, FONT, SPAN, DIV): a nearer `font-weight: normal|400` cancels an outer bold for that run** (in #5 headings 2-9 and 11 are bold only via an enclosing `<TABLE STYLE="font: bold 11pt ...">`, with children such as `<FONT style="font-weight: normal">(if applicable)</FONT>` overriding); CSS parsed from `style=""` attributes only (case-insensitive, whitespace-tolerant; no stylesheet resolution — if a sample uses classes, the adapter records `cue_source: 'class'` unresolved and heading falls back to caps/position cues). `Cue.caps` = >=80% of letters uppercase (min 3 letters), computed on the **title with parenthetical groups `(...)` and a trailing `*` stripped** (so "CUSTODIAN INFORMATION (if applicable)" is caps).
2. **Row merge first:** all `<td>` cells of a `<tr>` are joined (space-separated) into one Line before heading scoring. A row whose first cell matches `^\s*(\d{1,2}[A-Z]?)\.\s*$` or `^\d{1,2}[A-Z]?\.` and whose remaining text is a title (bold or caps, <=120 chars, no sentence-final period) is a **top-level section heading** (`kind: 'section'`, number, title).
3. **Sub-list vs section:** a non-bold "N." line (number then body text, or body of >120 chars, or not bold/caps) is a **sub-list item** (`kind: 'list_item'`), never a section. Only bold/caps "N." + title rows can open a section scope. Other heading shapes: `Part X`, `Part X –/-/:` title, `Appendix X`, `4A`-style numbers (same bold/caps requirement).
4. **Monotonic section numbers per scope:** a candidate section number is accepted only if it equals prev+1, prev (re-statement), or prev+1 with a letter suffix, or is the first section of a new scope; otherwise it is demoted to `list_item`, EXCEPT that **demotion is non-cascading**: a bold/caps heading-shaped candidate numbered prev+2..prev+3 is accepted with `gap: true` (a single missed or mis-cued heading never demotes the following headings). This makes the non-bold 1-22 sub-list inside Section 11 of #1 and the Acknowledgments 1-13 list inert: they are separate **numbering scopes** (a scope = the Part/Appendix/document body/Signature Pages/Instructions/T&C region; a new scope opens at `Part X`, `Appendix X`, "Instructions", "Terms and Conditions", "Signature Pages" headings or when a section number resets to 1 under a bold top-level heading after a larger number). Scope identity is `scopeId = hash(kind|title|ordinal)`.
5. **Enclosing section** of any block = the nearest preceding accepted section heading in the same or ancestor scope.
6. **Assertions:** #1 Qualified Client Status heading is `12` (bold `<B>12.</B>` + `<B>Qualified Client Status ...</B>` in one `<TR>`); both occurrences of "this Section 11" (paragraphs 5 and 6) have enclosing section 12; the 1-22 sub-list yields zero `section` nodes; the duplicate Acknowledgments 1-13 scope in the doc never overwrites main-scope section numbering. #3 and #5: accepted sections 1-12 each with title (4 = CUSTODIAN INFORMATION, 6 = INVESTMENT DETAILS with Parts A and B), asserted by golden `golden-heading-extraction-03-05`. Unknown heading style -> plain paragraph (never a throw).

**Initial-values principle (applies to H, L, U, S):** every threshold, stopword list and token list pinned in this section is an INITIAL value. The golden tests (exact counts plus negative assertions) are the acceptance proof. EXECUTE may tune thresholds/stopwords only if every golden and negative assertion still passes, and must record the final values in the phase report. A golden is never loosened to make a test pass.

### R. ref-this-section (AC11)

Pattern `\bthis Section (\d{1,3}[A-Z]?)(\([a-z0-9]+\))*\b` (not preceded by "of"). Resolve enclosing section N_enc via H.5. If cited N != N_enc -> finding `broken_cross_reference`, severity high, `expected = N_enc`, explain facts {reference text, cited N, enclosing section number+title, expected}. If cited N == N_enc -> no finding. **No-finding guards:** (a) no accepted section encloses the block (N_enc undefined) -> no finding; (b) the citing block is a `list_item` whose own list number equals the cited N -> no finding. #1 contains `this Section 9` twice inside non-bold Acknowledgments list item 9 (before the first bold section "1."): both are covered by guards (a)/(b), 0 findings. #1: exactly 2 findings (both "this Section 11"), both expected 12.

### L. ref-label-coherence (G1; AC12; highest-risk edit)

Input: Reference nodes of the form `[noun-window] (indicated|specified|set forth|described) in Part X of Section N [of the <Scope Name>]`.
1. **Scope resolution:** a Part-qualified ref (`Part X of Section N`) resolves against the **scope whose sections have Parts** (a scope with at least one `Part` child under some section). An explicit qualifier `of the Subscription Agreement Signature Pages` (or `of the <Title Case Phrase> Signature Pages|Agreement|Application`) selects the scope by title match and takes precedence. Otherwise: nearest scope (starting with the ref's own) that contains section N with a Part X; if none, the scope with the closest title token overlap; if still none, status `unresolved`.
2. **Target label set:** Part X label of section N in the resolved scope (the text after `Part X –`), plus all section titles in that scope.
3. **Noun window (order is pinned):** take the last 4 RAW tokens before `indicated in`/`specified in`, THEN strip stopwords `{to, the, of, in, for, as, a, an, and, or, with, by}`, lowercase, singular-fold. (Stripping first and then taking 4 tokens drops both golden scores to t = 0.25 and yields 0 findings.) Part label = text after `Part X –` up to the first `(` or 120 chars. Both golden fires sit exactly on t = 0.5, so this order and list are fixed.
4. **Scoring:** `overlap(window, label) = |window ∩ label| / |window|` (token sets; folded stems). Let `p` = overlap vs the cited Part label, `t` = best overlap vs any section title / Part label in the scope. Fire iff `p < 0.25` AND `t >= 0.5` for a target other than the cited one (the expected target). If the cited target passes (`p >= 0.5`) -> coherent, no finding. Ambiguous band -> no finding (precision over recall; P02 measures).
5. **Emit:** `broken_cross_reference`, severity <= high (cap), confidence 0.7 cap until P02, `expected` = best target (e.g. "Section 4 (Custodian Information)"), explain facts {noun window, cited target label, expected target label, overlaps}; Reference marked `status: 'suspicious'`.
6. **Goldens:** #3 exactly 2 findings: "Custodian indicated in Part B of Section 6" (expected Section 4, which has NO Part B -> expected target is the section itself) and "amount specified in Part B of Section 4" (expected Section 6 Part B "Investment amount"); #5 exactly 2 findings (same two sentences). Total AC12 = 4. Golden explain-fact score assertions: custodian ref window {agreement, custodian} p = 0.00, t = 0.50; amount ref window {amount, equal} p = 0.00, t = 0.50; valid refs p >= 0.50. The strict `Part X of Section N` pattern matches 10 times in each of #3 and #5, of which 8 are valid (the other 2 are the goldens): assert **0** findings on the 8 valid refs (e.g. "Part A of Section 3 and/or Section 5"). Negative assertion: no other `broken_cross_reference` on #3, #5.

### U. undefined-term (G3; AC13)

1. **Closed synonym set** of offering-security nouns: `{Units, Unit, Interests, Interest, Stock, Common Stock, Shares, Share, Securities}` where the doc defines exactly one of them as the offered security via `(the "X")`/`"X" means` (here `Shares`). Context regex: `\b(offered|offering of|purchase of|subscribe(?:d)? for|purchase)\s+(?:the\s+)?(Units|Interests|Stock)\b`, bounded window.
2. Fire iff the used term is in the set, differs from the defined offering term, and is not itself defined in the doc. Finding `defined_term_issue`, severity medium (cap), facts {used term, defined term, contexts}. No other capitalized-term rule exists in Phase 01 ("Company" vs "REIT", "Escrow Agent" stay unflagged).
3. **Carve-out:** if the doc contains "not defined herein ... shall have the meanings given to them in the <Name>" (Circular/Memorandum), the finding severity is capped at `medium` and `detail.interpretations` gets: (a) term is defined in the external <Name>; (b) term is a drafting leftover from a different product. (#11 has this carve-out; finding still fires, as medium.)
4. **Goldens:** #11 exactly 1 `defined_term_issue`, quoting "offered Units". Negative: zero `defined_term_issue` on #5 and #6, and no other `defined_term_issue` on #11.

### S. Statutory / external exclusions (G4; AC17)

A `Section N` reference is `kind: 'statutory'` (never flagged) when any of: followed within 40 chars by `of (the )?(ERISA|Code|Internal Revenue Code|U\.S\. Internal Revenue Code|Securities Act|Exchange Act|Advisers Act|Investment Company Act|1940 Act|1933 Act|1934 Act|Act of \d{4}|Regulation [A-Z])`; followed by `of the [A-Z][A-Za-z ]{0,40} Act`; `Rule \d+[a-z0-9-]*(\([a-z0-9]+\))* under ...`; U.S.C./C.F.R. cites (`\d+ U\.S\.C\. § ?\d+`, `\d+ C\.F\.R\.`); parenthetical subsection shape `Section 3(c)(1)` (`\(\w+\)` chain); a **bare repeat cite**: `Section N` where the same N appeared earlier in the doc within 400 chars of a statutory marker (e.g. "Section 406 of ERISA or Section 4975" -> both statutory); and the **out-of-range rule**: number > max accepted section number in the active scope -> `kind: 'external'`, `status: 'suspicious'` is NOT emitted as a finding (only recorded).

**Concrete assertion table (golden-statutory-cite-not-flagged):**

| Doc | Text | Expected kind | Findings |
|---|---|---|---|
| #5 | "Section 406 of ERISA" | statutory | 0 |
| #5 | "Section 4975" (bare repeat, also "Section 4975 of the U.S. Internal Revenue Code") | statutory | 0 |
| #1 | "Section 3(c)(1) of the 1940 Act" shape and "Rule 506 under ..." shapes | statutory | 0 |
| #2, #10, #12 | every `Section N` followed by `of the ... Act`/`of ERISA`/`of the Code` | statutory | 0 |
| #1 | "this Section 11" x2 | internal | exactly 2 (AC11) |
| #3, #5 | the 8 valid `Part X of Section N` refs per doc (10 matches, 2 are goldens) | internal, resolved | 0 |

The test enumerates every `Section N` match in the 4 samples (#1, #5, #2/#10/#12) and requires each to be classified `internal|statutory|external`, with zero `broken_cross_reference` beyond the goldens. A Reference graph dump per sample is snapshot-tested for the statutory/internal split.

### Encoding (G9)

HTML entity decoding handles cp1252 numeric entities: `&#145;`->U+2018, `&#146;`->U+2019, `&#147;`->U+201C, `&#148;`->U+201D, `&#150;`->U+2013, `&#151;`->U+2014 (the 128-159 range is mapped through cp1252, not treated as C1 controls); curly quotes are normalized by `normalize` (fingerprint vector below).

## Contracts v1 (field-level)

All schemas in `packages/core/src/contracts/*`, zod, exported with inferred TS types. Common: every request body carries nothing secret; every error response is `{error:{code, message, retry_after_s?}}` using the error-code enum.

### Endpoint table

| Method + path | Request (zod fields) | Response (zod fields) | HTTP status mapping |
|---|---|---|---|
| POST `/api/session` | `{analyst_name: string(1..80), turnstile?: string}` | `{workspace_id, analyst_id, kind: 'sandbox'\|'visitor', expires_at: int, read_only: bool}` + `Set-Cookie` | 200; 429 `rate_limited`; 403 `invalid_session` (Turnstile fail) |
| POST `/api/memory/lookup` | `{law_firm_id: string, fingerprints: string(64 hex)[1..200]}` | `{decisions: ActiveDecision[]}` | 200; 400 invalid; 401 `invalid_session`; 503 `memory_unavailable` |
| POST `/api/runs` | `{client_op_id, doc_name, doc_hash, law_firm_id: string\|null, fund_name?, version_label?, settings_hash}` | `{run_id}` | 200; 413 `payload_too_large`; 503 |
| POST `/api/runs/:id/findings` | `{client_op_id, findings: FindingWire[1..50]}` (FindingWire = Finding minus `quote`, plus `fingerprint`) | `{stored: int}` | 200; 422 `fingerprint_mismatch`; 413; 403 `read_only_demo` |
| POST `/api/decisions` | `{client_op_id, run_id?, finding_ref, decision: 'dismissed'\|'accepted', reason_code, note?, quote_text, fingerprint, issue_class, pattern_key?, fund_name?, doc_version_label?}` | `{decision: ActiveDecision}` | 200; **422 `fingerprint_mismatch`** (server recomputes from `quote_text`); **409 `conflict_active_decision`** body `{error, current: ActiveDecision}`; 403 `read_only_demo` |
| POST `/api/decisions/:id/revoke` | `{client_op_id, reason: string(1..500)}` | `{ok: true, current: ActiveDecision\|null}` | 200; 409 `conflict_active_decision` (already superseded/revoked, body has current) |
| POST `/api/counsel/questions` | `{client_op_id, finding_ref, fingerprint, interpretations[]}` | `{question_id}` | 200; 422; 403 |
| POST `/api/counsel/answers` | `{client_op_id, question_id, option: 'A'\|'B'\|'C'\|'unclear', note?, quote_text, fingerprint}` | `{answer_id, decision: ActiveDecision}` | 200; 422 `fingerprint_mismatch`; 409 |
| GET `/api/rules` | query `{law_firm_id}` | `{rules: Rule[]}` (`Rule = {id, text, status: 'proposed'\|'active'\|'rejected', origin, evidence_count}`) | 200 |
| POST `/api/rules/:id/approve` \| `/reject` | `{client_op_id, text?: string (approve only, while proposed)}` | `{rule: Rule}` | 200; 409 (state changed); 403 |
| GET `/api/memory/firm` | query `{law_firm_id}` | `{decisions: ActiveDecision[], rules: Rule[], counts}` | 200 |
| GET `/api/audit` | query `{limit<=100, cursor?}` | `{events: AuditEvent[], next_cursor?}` | 200 |
| GET `/api/export` | none | `{export_version: 1, decisions, rules, audit}` | 200 |
| POST `/api/ai` | AI envelope below | NDJSON frames | 200 stream; 429; `quota_exhausted` (429) / `budget_cap` (503) per `errorStatus`, delivered as terminal `error` frame (optional `reason`) |
| POST `/api/ocr` | OCR envelope below | NDJSON frames | as above; 413; 415 `unsupported_type` |
| GET `/api/quota` | none | `{ai: {used, limit, resets_at}, ocr_pages: {used, limit, resets_at}, global_ok: bool}` | 200 |

Status map is one exported `errorStatus(code)` function: `fingerprint_mismatch`->422, `conflict_active_decision`->409, `read_only_demo`->403, `invalid_session`->401, `rate_limited`->429, `quota_exhausted`->429, `budget_cap`->503, `upstream_failed`->502, `memory_unavailable`->503, `payload_too_large`->413, `unsupported_type`->415 (switch is exhaustive; compile-time check).

### NDJSON frame schema (`contracts/frames.ts`)

Discriminated union on `t`: `{t:'hb'}` (heartbeat every 10 s); `{t:'result', kind:'ai'|'ocr', data: AiResult|OcrResult, cache: 'hit'|'miss', model: string, meta?: Record<string,unknown>}`; `{t:'error', code: ErrorCode, message: string, retry_after_s?: number, reason?: string}` (`reason` is an additive optional machine-readable detail, e.g. `visitor_limit` per 04a AC32; frozen at exit). Exactly one terminal frame (`result` or `error`), any number of `hb` before it. `parseFrameLine(line)` rejects unknown `t` and extra terminal frames.

### Cache key (`contracts/cache-key.ts`)

Exported `cacheKey({kind: 'ai'|'ocr', input_hash, model, prompt_ver, schema_ver, rules_hash}): string` = `hex(sha256([kind,input_hash,model,prompt_ver,schema_ver,rules_hash].join('|')))`. Components must not contain `|` (rejected). `rules_hash` is `'none'` when no rules. Vectors in `fixtures/cache-key-vectors.json` (added to the vectors gate); Phases 04a/05 import this function, never re-implement it.

### AI/OCR envelope (`contracts/ai.ts`, `ocr.ts`)

AI request: `{v: 1, law_firm_id: string|null, candidates: {id, quote, section_path, issue_class_hint?}[1..N<=limits.aiCandidates], settings: {model_tier?: string}, ext?: Record<string,unknown>}`; AI result: `{v: 1, findings: AiFinding[], usage?: {...}, ext?: Record<string,unknown>}`. OCR request: `{v: 1, mime: 'image/png'|'image/jpeg'|'application/pdf', pages: {index, data_b64}[1..limits.ocrPagesPerRequest], ext?}`; result `{v: 1, pages: {index, lines: {text, bbox?, conf?}[]}[], ext?}`. **Additive-only rule:** the server and client schemas are `.passthrough()`-tolerant on `ext` and ignore unknown top-level optional fields; removing/retyping a field or bumping `v` requires a contract-change note; new fields must be optional.

### SessionClaims (`contracts/claims.ts`, used by `session/cookie.ts`)

Frozen: `SessionClaims = {v: string (random visitor id, always present — used for per-visitor limits), w?: string (workspace id), a?: string (analyst id; never overloaded as a visitor id), iat: int (epoch s), exp: int (epoch s), kid: string, t?: int (epoch **ms** of the last successful Turnstile siteverify)}`. Compact names follow DATA-MODEL (`v` added by orchestrator decision 2026-10-17 so `a` keeps its audit meaning). Contract notes: (1) Phase 04a issues its own signed `__Host-` visitor cookie in Milestone 1 carrying `{v, iat, exp, kid, t?}` and no `w`/`a`; (2) Phase 04b's sandbox session adds `w` and `a` to the same cookie format (same signer, same `kid` map); (3) **re-signing must preserve existing claims**: `resign(claims, patch)` merges the patch (e.g. setting `t`) over the verified claims and keeps `w`, `a`, `iat`, `exp`, `kid` unless explicitly patched; tested (set `t` on a sandbox cookie keeps `w`/`a`). Refinement: `w` requires `a`. Cookie value = `base64url(JSON claims) + '.' + base64url(HMAC-SHA256)`; max 512 bytes. This resolves Phase 04a's contract-change note (it depends on `t`).

### Ports (`contracts/ports.ts`)

```
PlatformPort { now(): number; randomId(): string; sha256Hex(s: string): Promise<string> }
QuotaPort   { claim(key: QuotaKey, units: number): Promise<{ok: true; refundToken: string} | {ok: false; code: 'quota_exhausted'|'budget_cap'|'rate_limited'; retry_after_s?: number}>;
              refund(refundToken: string): Promise<void>; usage(): Promise<QuotaUsage> }
CachePort   { get(key: string): Promise<CachedResult | null>; put(key: string, value: CachedResult, ttl_s: number): Promise<void> }
LedgerPort  { record(entry: LedgerEntry): Promise<void> }       // {kind, model, units, cost_usd?, cache, at}
RulesPort   { activeRules(law_firm_id: string): Promise<{texts: string[]; rules_hash: string}> }
TurnstilePort { verify(token: string, ip_hash: string): Promise<{ok: boolean}> }   // fail closed
```
All methods return Promises (sync fakes wrap); fakes live in Phase 04a/05, Phase 01 ships only the types plus a type-level conformance test.

## Frozen Model Shapes (minimum; G7)

- `Doc = {id: string (content hash), source: 'html'|'pdf'|'docx'|'ocr', blocks: Block[], graph?: LogicGraph, stage_failed?: 'adapter'|'structure', meta: {bytes: number, adapter_ms?: number}}`
- `Block = {id: string, kind: 'heading'|'paragraph'|'list_item'|'table_row'|'field'|'option', lines: Line[], section_path: string[], scopeId: string, anchor: Anchor}`
- `Line = {text: string, cue: Cue, page?: number, region?: {x: number, y: number, w: number, h: number}}`
- `Cue = {bold: boolean, caps: boolean, indent: number, position: 'left'|'center'|'right'|'unknown', page?: number, region?: Region, cue_source?: 'tag'|'inline_css'|'class'|'ocr'}`
- `Anchor = {docHash: string, blockId: string, offsetStart: number, offsetEnd: number}`; anchor id = `hex(sha256(docHash|blockId|offsetStart|offsetEnd))`.
- `LineStream = AsyncIterable<Line> | Line[]`: **contract note:** the HTML adapter and the future PDF, DOCX and OCR adapters (Phase 06) MUST all emit the same `LineStream` of `Line` with `Cue` populated (bold/caps/indent/position; `page`/`region` set for PDF/OCR); the structurer consumes only `LineStream`, never adapter-specific types.
- `Reference = {id: string, text: string, kind: 'internal'|'statutory'|'external', target?: {sectionNumber: string, part?: string, scopeId: string}, status: 'resolved'|'unresolved'|'suspicious', expected?: {sectionNumber: string, part?: string, label: string}, anchor: Anchor}`
- Graph: node types `section|block|option|term|field|part`; edge types `ref|conditional|contains|defines|uses`; `GraphNode = {id, type, label?, anchor?}`, `GraphEdge = {from, to, type, meta?}`.
- All shapes are zod-backed where they cross a package boundary (Phases 03/05/06/07/09); JSON-schema snapshot covers them.

## Security Hardening (STRIDE: tamper, DoS)

- **Cookie verify:** `session/cookie.ts` uses `crypto.subtle.verify('HMAC', key, sigBytes, dataBytes)` (constant-time); never compares signature strings with `===`. Tests: valid; tampered payload; tampered signature; wrong-length signature; unknown `kid` -> reject; `exp <= now` -> reject; `iat` in the future beyond 60 s skew -> reject; malformed base64/JSON -> reject; oversize (>512 B) -> reject; `kid` rotation (old kid accepted only if in the supplied key map). Keys are parameters only.
- **Adapter input size cap:** `adapters/html.ts` rejects input larger than `limits.maxHtmlBytes` (single source in `config/limits.ts`; typed error `payload_too_large`, partial model never returned for oversize) and a max line length (`limits.maxLineChars`, longer lines are split at whitespace, not rejected).
- **ReDoS test:** `test/security/redos.test.ts` runs every heading, reference, statutory and detector regex over (a) the largest sample and (b) adversarial 1 MB single-line inputs (e.g. `"Section ".repeat(...)`, 1 MB of digits, 1 MB `"(a)"`, 1 MB of spaces, unterminated quote/paren) and asserts each completes under a wall-clock budget (< 2 s per regex on the largest input; test timeout 10 s) with no throw.

## Data Flow

HTML bytes → adapter (SAX; cells of a row merged into one logical line) → noise pre-pass → LineStream with cues (bold/caps/position) → structurer (heading candidates scored; numbering scopes restart per Part/Appendix; references parsed incl. "Part B of Section 6", "Section 3 of Appendix A", "this Section N" resolved against enclosing section; statutory cites ("of the … Act/Code", U.S.C., CFR, "1940 Act") excluded) → graph → detectors → findings (stable ids, sorted) → fingerprint per finding (browser lookups use the same function as the Worker).

## Failure Modes

Unknown heading style → block kept as plain paragraph (never a throw); reference to missing target → `unresolved` with expected-target candidates; adapter exceptions return a partial model plus `stage_failed: 'structure'` (AC3 support); quote > 1000 chars → rejected finding logged, not truncated.

## Implementation Checklist

### Step F — Phase-00-owned manifests and lint (serialized seam edits by the orchestrator)
- [x] F0. Seam edit (orchestrator applies; executor supplies exact diff) to Phase-00-owned `packages/core/package.json`, `packages/core/vitest.config.ts` and root eslint config: add deps `htmlparser2`, `zod`, `@noble/hashes`, `fast-check` (versions per Phase 00 REF); **vitest stays on the Phase 00 pin (4.x, the major `@cloudflare/vitest-pool-workers` peers; do not use 5.x)**; add scripts `test:golden`, `test:property`, `test:corpus`, `test:vectors`; add ESLint `no-restricted-globals` (`document`, `window`) scoped to `packages/core/src/**`. Gate: `pnpm --filter @aduin/core test:vectors` resolves and `pnpm lint` fails on a seeded `document` reference in a scratch test file. F0 runs before Step A.

### Step A — Model, adapter, structurer, graph
- [x] A1. `model/*`: types per Frozen Model Shapes (Doc, Block, Line, Cue, Anchor, Reference, graph), LineStream, anchors; property test: anchors stable across runs; zod shapes in the JSON-schema snapshot.
- [x] A2. `adapters/html.ts`: SAX parse, merge `<td>` cells per `<tr>` before heading detection, glyph normalization (☐ ¨ [ ] o ☒), exclusivity-cue capture ("check only one", "select only one", "check one box only", "(circle one)", "check all that apply"), EDGAR noise pre-pass with an auditable rule list (EX-99 wrapper lines, "N of M" counters, "[Logo]", repeating headers); inline-CSS bold cue parsing (`font-weight`, `font: bold`) plus `<b>`/`<strong>`; cp1252 numeric entity mapping (`&#147;`/`&#146;` etc.); input size cap and max line length from `config/limits.ts`.
- [x] A3. `structure/*`: headings per Pinned Algorithms H (bold-number+title row, sub-list demotion, monotonic numbers per scope, enclosing section), numbering scopes, references (scope resolution per L.1), conditionals (whitelist, role routing, skip, negative gate, entity extra part), option groups, defined terms (`(the "X")`, `"X" means`, port ideas from defined-terms-checker, MIT, with own tests), fields, statutory exclusion per Pinned Algorithms S (full pattern list, bare repeat cites, out-of-range rule).
- [x] A4. `graph/*`: nodes (section, block, option, term, field), edges (ref, conditional, contains, defines/uses); query helpers.
- [x] A5. Fixtures-in-tests: one seeded HTML per pattern for `graph-extraction-fixtures` (test-local, under `packages/core/test/fixtures/`).

### Step B — Findings and detectors
- [x] B1. `findings/*`: zod `Finding`, taxonomy (15 codes), stable `ids.ts`, `severity.ts`.
- [x] B2. `detectors/registry.ts` and the three golden detectors: `ref-this-section` (algorithm R), `ref-label-coherence` (algorithm L: scope resolution, <=4-token noun window, overlap thresholds 0.25/0.5, expected target; severity cap `high`, confidence <= 0.7 until P02 precision is known), `undefined-term` (algorithm U: closed offering-security synonym set, Circular carve-out caps severity at medium and adds an interpretation).
- [x] B3. `engine.ts` + `explain` facts (reference text, found target, expected target).

### Step C — Memory core and session helper
- [x] C1. `memory/{normalize,fingerprint,mask,label,rulesHash}.ts` per Public Contracts; `rulesHash` = sha256 of sorted normalized rule texts, `'none'` for empty; `memory/snap.ts` `snapToSentence` per Public Contracts; `fingerprintFor(finding, firmId|null)`; `resolveLabel` typed per Public Contracts.
- [x] C2. `fixtures/fingerprint-vectors.json` (case, whitespace, NBSP, curly quotes, "Section 4" vs "Section 5", firm A vs B, 1000-char boundary, **sensitive mask vector**: `"Routing number 021000021"` -> masked `"Routing number #0021"` (no length leak; `"021000021"` and `"1021000021"` (both end `0021`) both mask to `#0021`, never an added `#####` run), **cp1252 vector**: raw HTML `&#147;Shares&#148;` and `&#146;` decode to U+201C/U+201D/U+2019 and normalize to `"shares"` / `'` so the fingerprint equals that of the straight-quote form; curly-quote variants match straight-quote variants). Plus `fixtures/cache-key-vectors.json`.
- [x] C3. `memory/firms.ts` + `fixtures/memory/law-firms.json`: `resolveFirm(name)` with alias normalization (lowercase, punctuation stripped, "LLP/LLC/Inc" suffix aliases); free text → `null`.
- [x] C4. `session/cookie.ts` (sign/verify via `crypto.subtle.verify`, `kid`, expiry, SessionClaims incl. `t`, full tamper test matrix from Security Hardening).
- [x] C5. `config/limits.ts` (locked defaults; single source for web/worker).

### Step D — Contracts v1
- [x] D1. `contracts/*`: zod schemas and TS types for every row of the Endpoint table, frames, `cacheKey`, AI/OCR envelope, SessionClaims, `errorStatus`; `ports.ts` interfaces (`PlatformPort`, `QuotaPort`, `CachePort`, `LedgerPort`, `RulesPort`, `TurnstilePort`) used by Phases 04a/04b/05; `seed-spec.ts` (`DemoSeedSpec`).
- [x] D2. Contract test: every schema round-trips fixtures; exhaustive error-code switch compiles; `contracts.json-schema.snap` snapshot test (replaces schema-file hashing); frame parser rejects unknown `t` and double-terminal; cache-key vectors pass; port types conformance (type-level).

### Step E — Golden and property tests over real samples
- [x] E1. `test/golden/*` for AC11–AC13 against `samples/sub-docs/raw/01,03,05,11`: exact counts (#1 = 2 `broken_cross_reference`, both expected Section 12 with enclosing section 12; #3 = 2; #5 = 2; #11 = exactly 1 `defined_term_issue` = Units) and **negative assertions**: zero other `broken_cross_reference` / `defined_term_issue` on #1, #3, #5, #11 beyond the goldens; zero findings on the 8 valid `Part X of Section N` refs per doc (10 matches, 2 goldens); `golden-heading-extraction-03-05` (sections 1-12 with titles on #3 and #5); #1 zero findings for both `this Section 9` cites; zero `defined_term_issue` on #5/#6.
- [x] E2. `test/golden/statutory-cite-not-flagged.test.ts`: the concrete assertion table in Pinned Algorithms S over #1, #2, #5, #10, #12 ("Section 406 of ERISA", bare "Section 4975" repeat cite, "Section 3(c)(1)", out-of-range rule).
- [x] E2b. `test/security/redos.test.ts` and `test/security/cookie.test.ts` per Security Hardening; `test/unit/snap.test.ts`; `test/unit/heading-inference.test.ts` (inline-CSS bold, `<b>`, sub-list 1-22 inert, Acknowledgments 1-13 scope).
- [x] E3. `test/property/*`: finding-schema-contract, determinism, fingerprint normalization (fast-check), label matrix.
- [x] E4. `test:corpus` script: run all 12 `.htm` samples, print findings per doc, assert no throw and < 40 high+critical per doc (informational ceiling).
- [x] E5. Timing note for AC29: log parse+structure ms for #2 into the report (no gate).

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| unit/graph | `pnpm --filter @aduin/core test` | Fully-Automated | AC17 (fixtures), AC9 |
| goldens | `pnpm --filter @aduin/core test:golden` | Fully-Automated | AC11, AC12, AC13, AC17 (exact counts + negative assertions) |
| property | `pnpm --filter @aduin/core test:property` | Fully-Automated | AC7, AC8, AC43, AC46 |
| corpus | `pnpm --filter @aduin/core test:corpus` | Fully-Automated | no-throw over 12 samples (supports AC25, AC29) |
| regression | `pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | Phase 00 surfaces intact |
| conformance | `pnpm --filter @aduin/core test:vectors` | Fully-Automated | AC46 vectors (fingerprint, mask, cp1252, cache-key) for Node (workerd/browser re-run in P04b/P03) |
| security | `pnpm --filter @aduin/core test security` | Fully-Automated | cookie constant-time verify matrix, ReDoS budget, size cap (supports AC25; no AC owner) |
| contract-freeze | `pnpm --filter @aduin/core test contracts` | Fully-Automated | JSON-schema snapshot, frames, errorStatus, cache-key (consumer contract basis for AC27) |

Failing stubs for red-first (consumed by execute-agent): `should flag "this Section 11" in Section 12 as expected Section 12`, `should flag Custodian Part B of Section 6 (custodian is Section 4)`, `should flag amount Part B of Section 4 (amount is Section 6 Part B)`, `should flag offered Units as undefined term (defined: Shares)`, `should not flag Section 3(c)(1) of the 1940 Act`, `should label dismissed blocking finding as dismissed_reconfirm`, `should treat Section 4 and Section 5 as different fingerprints`, `should mask routing number to #last4`, `should normalize &#147; cp1252 entities and curly quotes to the straight-quote fingerprint`, `should reject cookie with unknown kid / expired / tampered`, `should not flag Section 406 of ERISA or bare Section 4975`, `should flag only Units as defined_term_issue on sample 11`, `should complete regex scans on a 1 MB single line within budget`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `finding-schema-contract` | Fully-Automated | AC7 |
| `determinism-repeat-run` | Fully-Automated | AC8 |
| `explanation-present-per-rule` | Fully-Automated | AC9 |
| `golden-01-this-section-11` | Fully-Automated | AC11 |
| `golden-03-05-swapped-part-b-refs` | Fully-Automated | AC12 |
| `golden-11-undefined-units` | Fully-Automated | AC13 |
| `graph-extraction-fixtures`, `golden-statutory-cite-not-flagged` | Fully-Automated | AC17 |
| `memory-label-matrix` | Fully-Automated | AC43 |
| `fingerprint-normalization-property`, `fingerprint-vectors` (`test:vectors`: mask, cp1252, curly quotes, 1000-char) | Fully-Automated | AC46 |
| `contracts-json-schema-snapshot`, `cache-key-vectors`, `frames-parse` | Fully-Automated | AC27 (key derivation consumed by P04a/P05), AC7 (finding shape) |
| `cookie-security-matrix`, `redos-budget`, `adapter-size-cap` | Fully-Automated | hardening for AC25/AC29 (no new AC) |

```bash
pnpm --filter @aduin/core test && pnpm --filter @aduin/core test:golden && pnpm --filter @aduin/core test:property && pnpm --filter @aduin/core test:corpus && pnpm --filter @aduin/core test:vectors
# Expected: all exit 0; goldens report the exact sections and quotes
```

## Exit Gate

- All gates above green; contracts v1 listed in the phase report by exported schema name with the committed `contracts.json-schema.snap` (JSON-schema snapshot, not file hashes); vectors files committed.
- No `document`/`window` reference in `packages/core/src` (`no-restricted-globals` lint rule added in F0, proven by a seeded violation).
- Phase report written.

## Risks and Kill Criteria

- Heading inference without tags is the highest technical risk (precision of structure). Kill/fallback: if goldens #3/#5 cannot be resolved by label-coherence within the step, ship `ref-label-coherence` as `high` severity with confidence ≤ 0.7 and record the miss; AC12 then moves to CONDITIONAL with a backlog stub (never silent Known-Gap).
- Label-coherence false positives: severity cap until P02 corpus precision measured.
- Contract churn: frozen at exit; changes need a registry note.

## Cost / Secret Hygiene

No network, no LLM, no OpenRouter. The cookie helper takes keys as parameters only (never read from files); no key material in vectors or logs.

## Rollback

`git revert` the phase commits; later phases have not started, no data to migrate.

## Blockers That Would Justify BLOCKED Status

- Golden #3/#5 cannot be detected deterministically at all (then reclassify via user decision).
- Contract design cannot satisfy both Worker and browser (e.g. a validator that exceeds S6 size limits) → coordinate with S10 decision.

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [x] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented) — 2026-10-17, report `subdoc-qa-mvp_PHASE-01-core-engine_REPORT_17-10-26.md` (8/8 gates exit 0; gaps: patternKey.ts registry-owned by P02, workerd/browser conformance P04b/P03)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S1 (core plus contracts consumed by 3 packages), S2 (API contracts), S4, S6 (identity/cookie, schema), S7 → 5/7 HIGH. Recommended: sequential within the phase (one engine, tightly coupled files); Step C and D could run as a second agent after Step B only if blast radii stay disjoint (they do: `memory/`, `session/`, `contracts/` vs `structure/`). Sonnet for research/validate; opus for code execution.

## Test Infra Improvement Notes

(none identified yet)

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-01-core-engine_PLAN_17-10-26.md`
- Last completed step: 5. EXECUTE (2026-10-17); uncommitted, orchestrator commits after EVL
- Validate-contract status: PASS (inline)
- Next Step: after Phase 00 is verified, spawn vc-research-agent (re-research: read Phase 00 REF, spike S7 numbers). Next phase after this: Phase 03 (web shell). Phase 04a may start in parallel once contracts are frozen.

## Deviations

Recorded during EXECUTE (all within blast radius; /goal document-and-continue). Full rationale in the phase report.
- `memory/patternKey.ts` not created: registry `## Phase 02` owns it (contested file, not touched); pattern keys are covered by `Detector.patternKey()` + `findings/make-finding.ts` `patternKey()`.
- Error code `invalid_request` (400) added (endpoint table says "400 invalid" without a code); additive.
- Finding builder lives at `findings/make-finding.ts` (naming; shell hook blocks "build" paths).
- `test:corpus` re-pointed from the Phase 00 placeholder `test/recorded` to `test/corpus`.
- `Finding.pattern_key?` added (needed by decisions / DATA-MODEL 2.4); `QuotaClaimResult` refusal gained optional `reason?`.
- R pattern: "not preceded by of" read as "not followed by `of`" (golden text is "of this Section 11"); decimal `Section 3.10` excluded.
- TDD red-first shown by a guard-(a) mutation check instead of per-stub red runs.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: outer-pvl
supersedes: 2026-10-17 (outer-pvl) — re-validate after supplement cycle 2 (N1-N4 + gate-form fixes applied) has current evidence

Parallel strategy: sequential
Rationale: 5/7 signals (S1, S2, S4, S6, S7), dominant signal = tightly coupled single engine plus frozen contracts consumed by 03/04a/04b; Step C/D may be split to a second agent only after Step B (disjoint subdirs). Sonnet for validate/research, opus for code execution.

Re-validate result (PVL cycle 3 for this phase, after supplement cycle 2): N1-N4 are closed in the plan text, the gate commands use the no-`--` form, structural validator reports 0 failures / 0 warnings, and the spot-checks of H, L and R against the real HTML reproduce the pinned golden numbers. Umbrella (decision row 3 `#` + last 4; `## Execution Holds`; program-wide no-`--` rule) and registry (`## Phase 01` narrowed) are consistent with the plan. Consumers checked: 04a (`v`, `t` epoch ms, `resign`, `cacheKey`, `parseFrameLine`, `errorStatus`, additive `reason?` on the error frame and body) matches Contracts v1; 03 (on hold, `design/mockups/app.html` approval) consumes `contracts/memory.ts` and the firmId=null rule, its deferred G5 text is a P03 supplement item, not a Phase 01 defect.

Verification of N1-N4 and the gate-form fixes (plan text): N1 closed (H.1 nearest-declaration bold walk with `font-weight: normal` override; caps computed on the title minus parentheticals and trailing `*`; non-cascading demotion with `gap: true`; golden `golden-heading-extraction-03-05` in E1 and in the failing stubs); N2 closed (L.3 pins raw-4-tokens-then-stopword-strip with the stopword list, Part label up to first `(`, golden explain-fact score assertions, "8 valid refs" wording); N3 closed (R no-finding guards (a)/(b), golden-01 exact count 2 plus zero for `this Section 9`); N4 closed (C2 vector `021000021` / `1021000021` both -> `#0021`; `reason?` added to the error frame; "402-class" wording gone). The "Initial-values principle" paragraph states every H/L/U/S threshold, stopword and token list is an initial value and the goldens are the acceptance proof (tune only if every golden and negative assertion still passes; record final values; never loosen a golden). No double-dash argument separator occurs in any plan command.

Spot-check of pinned algorithms against the real samples (read-only, untrusted data; throwaway scripts in the session scratchpad, nothing written to the repo; approximate extraction, not the real adapter):
- **H on #5 and #3:** section candidates `N.` + title were extracted with a nearest-style-declaration bold walk. #5: sections 1-12 all present as bold-or-caps title rows (1 TYPE OF ACCOUNT, 2 INVESTOR INFORMATION, 3 ADDRESS, 4 CUSTODIAN INFORMATION (if applicable), 5 FINANCIAL ADVISOR INFORMATION*, 6 INVESTMENT DETAILS, 7 DISTRIBUTIONS, 8 DELIVERY OF DOCUMENTS, 9 INTERNAL REVENUE CODE CERTIFICATION, 10 QUALIFIED INVESTOR DETERMINATION, 11 COST BASIS ELECTION, 12 ACKNOWLEDGEMENT AND SIGNATURE). Section 4 on #5 is bold only through the enclosing `<TABLE STYLE="font: bold 11pt ...">` (row bold ratio 0.57) and caps passes once the lowercase "(if applicable)" is stripped, so both N1 fixes are individually sufficient and together robust. #3 is the same shape. The non-bold Acknowledgments 1-15, Instructions 1-4 (long bodies / sentence-final period / not bold-caps) and appendix lists 1-13 are all list items (inert). Sections 1-12 are monotonic; the Instructions and Acknowledgments lists precede section 1 and cannot overwrite main-scope numbering.
- **H and R on #1:** bold rows 1-14 (12 = Qualified Client Status, one TR, bold via `<B>`); the non-bold 1-22 and 1-6 sub-lists are list items; `this Section 11` occurs exactly twice (sub-list items 5 and 6 under section 12), enclosing section 12, expected 12 -> 2 findings. `this Section 9` occurs twice (lines 66 and 68 of the extracted stream) in continuation paragraphs of Acknowledgments item 9, BEFORE the first bold section "1." (line 78): guard (a) (no accepted enclosing section) is the operative guard; guard (b) alone would not cover them because they are continuation paragraphs, not the "9." list item itself (instruction E8).
- **L on #3/#5:** exactly 4 L-form refs per doc; windows (last 4 raw tokens, then stopwords stripped) reproduce the pinned scores: "Agreement to the Custodian" -> {agreement, custodian}: p = 0.00 vs Part B "Investment amount", t = 0.50 vs Section 4 "CUSTODIAN INFORMATION" -> fires (expected Section 4, which has no Part B); "equal to the amount" -> {equal, amount}: p = 0.00 vs Section 4 (no Part B), t = 0.50 vs Section 6 Part B "Investment amount" -> fires; "amount subscribed for (as" -> {amount, subscribed}: p = 0.50 and "with the subscription amount" -> {subscription, amount}: p = 0.50 -> no finding. The strict `Part X of Section N` pattern matches 10 per doc (8 valid, 2 golden); the 8 valid refs ("Please complete Part A of Section 2", "Part A of Section 10", ...) carry no L-form verb, so no scored fire. No tie at t = 0.5: no other section title or Part label shares `agreement`/`custodian`/`amount`.
- **U:** #11 has exactly 1 context hit ("offered Units"), defines `(the “Shares”)` and carries the "not defined herein" carve-out -> 1 medium finding; #5 defines `(“Units”)` and uses "purchase of Units" (no fire); #6 defines Shares and has no Units hit. S and R unchanged since cycle 1 (verified then).
- **Achievability judgement:** the pinned rules plus the initial-values principle make the goldens achievable without loosening: every expected output is a pinned number that the real HTML reproduces, the inputs to L sit exactly on t = 0.5 but are fixed by pinned order and list, and the heading goldens catch a mis-specified cue before the detector goldens run. The residual risks are three under-pinned implementation details with one natural resolution each, recorded as E1-E4 below; none requires loosening a golden.

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC7 | every finding complete (class, severity, quote+location, provenance, confidence, interpretations) | Fully-Automated | `pnpm --filter @aduin/core test:property` (`finding-schema-contract`) | B |
| AC8 | deterministic, reproducible findings | Fully-Automated | `pnpm --filter @aduin/core test:property` (`determinism-repeat-run`, N=5 byte-equal) | B |
| AC9 | each rule supplies `explain` facts | Fully-Automated | `pnpm --filter @aduin/core test` (`explanation-present-per-rule`) | B |
| AC11 | #1 "this Section 11" in Section 12, expected Section 12 (exactly 2 findings; 0 for the two "this Section 9" cites) | Fully-Automated | `pnpm --filter @aduin/core test:golden` (`golden-01-this-section-11`) | B |
| AC12 | #3/#5 swapped Part B refs, 4 findings across 2 docs, zero extra ref findings, explain-fact scores (p 0.00 / t 0.50; valid refs p >= 0.50) | Fully-Automated | `pnpm --filter @aduin/core test:golden` (`golden-03-05-swapped-part-b-refs`) | B |
| AC12/AC17 | heading extraction on #3 and #5: accepted sections 1-12 with titles (4 = CUSTODIAN INFORMATION, 6 = INVESTMENT DETAILS with Parts A/B) | Fully-Automated | `pnpm --filter @aduin/core test:golden` (`golden-heading-extraction-03-05`) | B |
| AC13 | #11 "offered Units" vs defined "Shares"; zero `defined_term_issue` on #5/#6 | Fully-Automated | `pnpm --filter @aduin/core test:golden` (`golden-11-undefined-units`) | B |
| AC17 | structure extraction + statutory cites not flagged | Fully-Automated | `pnpm --filter @aduin/core test` (`graph-extraction-fixtures`) + `pnpm --filter @aduin/core test:golden` (`golden-statutory-cite-not-flagged`) | B |
| AC43 | memory label matrix (revoked/superseded never match) | Fully-Automated | `pnpm --filter @aduin/core test:property` (`memory-label-matrix`) | B |
| AC46 | edited passage is new; case/space/quote variants match; mask `#`+last4; cp1252; cache-key vectors | Fully-Automated | `pnpm --filter @aduin/core test:property` (`fingerprint-normalization-property`) + `pnpm --filter @aduin/core test:vectors` | B |
| hardening | cookie tamper matrix, ReDoS budget, adapter size cap | Fully-Automated | `pnpm --filter @aduin/core test security` | B |
| contract-freeze | JSON-schema snapshot, frames, errorStatus, cache-key | Fully-Automated | `pnpm --filter @aduin/core test contracts` | B |
| regression | Phase 00 surfaces intact | Fully-Automated | `pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan` | A |
| corpus | no throw over all 12 `.htm` samples (supports AC25, AC29) | Fully-Automated | `pnpm --filter @aduin/core test:corpus` | B |

Failing stub: should flag "this Section 11" in Section 12 as expected Section 12
test("should flag \"this Section 11\" in Section 12 as expected Section 12", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should flag \"this Section 11\" in Section 12 as expected Section 12") })
Failing stub: should not flag "this Section 9" inside Acknowledgments item 9 on sample 1
test("should not flag \"this Section 9\" inside Acknowledgments item 9 on sample 1", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should not flag \"this Section 9\" inside Acknowledgments item 9 on sample 1") })
Failing stub: should flag Custodian Part B of Section 6 (custodian is Section 4)
test("should flag Custodian Part B of Section 6 (custodian is Section 4)", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should flag Custodian Part B of Section 6 (custodian is Section 4)") })
Failing stub: should flag amount Part B of Section 4 (amount is Section 6 Part B)
test("should flag amount Part B of Section 4 (amount is Section 6 Part B)", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should flag amount Part B of Section 4 (amount is Section 6 Part B)") })
Failing stub: should accept sections 1-12 with titles on samples 3 and 5 (table-level bold, parenthetical caps)
test("should accept sections 1-12 with titles on samples 3 and 5 (table-level bold, parenthetical caps)", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should accept sections 1-12 with titles on samples 3 and 5 (table-level bold, parenthetical caps)") })
Failing stub: should flag offered Units as undefined term (defined: Shares)
test("should flag offered Units as undefined term (defined: Shares)", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should flag offered Units as undefined term (defined: Shares)") })
Failing stub: should flag only Units as defined_term_issue on sample 11
test("should flag only Units as defined_term_issue on sample 11", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should flag only Units as defined_term_issue on sample 11") })
Failing stub: should not flag Section 3(c)(1) of the 1940 Act
test("should not flag Section 3(c)(1) of the 1940 Act", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should not flag Section 3(c)(1) of the 1940 Act") })
Failing stub: should not flag Section 406 of ERISA or bare Section 4975
test("should not flag Section 406 of ERISA or bare Section 4975", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should not flag Section 406 of ERISA or bare Section 4975") })
Failing stub: should label dismissed blocking finding as dismissed_reconfirm
test("should label dismissed blocking finding as dismissed_reconfirm", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should label dismissed blocking finding as dismissed_reconfirm") })
Failing stub: should treat Section 4 and Section 5 as different fingerprints
test("should treat Section 4 and Section 5 as different fingerprints", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should treat Section 4 and Section 5 as different fingerprints") })
Failing stub: should mask routing number to #last4
test("should mask routing number to #last4", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should mask routing number to #last4") })
Failing stub: should normalize &#147; cp1252 entities and curly quotes to the straight-quote fingerprint
test("should normalize &#147; cp1252 entities and curly quotes to the straight-quote fingerprint", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should normalize &#147; cp1252 entities and curly quotes to the straight-quote fingerprint") })
Failing stub: should reject cookie with unknown kid / expired / tampered
test("should reject cookie with unknown kid / expired / tampered", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should reject cookie with unknown kid / expired / tampered") })
Failing stub: should complete regex scans on a 1 MB single line within budget
test("should complete regex scans on a 1 MB single line within budget", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should complete regex scans on a 1 MB single line within budget") })

Legacy line form:
- core engine: [Fully-automated: `pnpm --filter @aduin/core test && pnpm --filter @aduin/core test:golden && pnpm --filter @aduin/core test:property && pnpm --filter @aduin/core test:corpus && pnpm --filter @aduin/core test:vectors`]
- security + contracts: [Fully-automated: `pnpm --filter @aduin/core test security && pnpm --filter @aduin/core test contracts`]
- regression: [Fully-automated: `pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan`]
- conformance (workerd/browser re-run): [known-gap: documented — re-run in P04b / P03; the vectors file is the shared contract; named residual with backlog stub via gap-resolution C, not a silent pass]

Final gate commands (no-`--` form; every filter is a file-name token, none uses a `--` separator):
1. `pnpm --filter @aduin/core test`
2. `pnpm --filter @aduin/core test:golden`
3. `pnpm --filter @aduin/core test:property`
4. `pnpm --filter @aduin/core test:corpus`
5. `pnpm --filter @aduin/core test:vectors`
6. `pnpm --filter @aduin/core test security`
7. `pnpm --filter @aduin/core test contracts`
8. `pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan`

Execute-agent instructions (minor, resolvable inside EXECUTE; none requires loosening a golden; record the final choices in the phase report):
- E1. Line-level bold for heading scoring is evaluated on the text before the first `(` (after the number / `Part X` prefix), mirroring the caps rule. Reason (verified on real #3/#5): "Part B – Investment amount (please consult ...)" is `<P STYLE="font: bold ...">` with the long parenthetical in `<FONT STYLE="font-weight: normal">`, so a majority-of-characters rule gives bold ratio 0.18 and silently drops Part B of Section 6; the amount golden (AC12, both docs) then cannot fire. `golden-heading-extraction-03-05` must assert Parts A and B under Section 6 and will catch this red-first.
- E2. Heading shapes: the separator after `Part X` is optional (`&ndash;` / `–` / `-` / `:` / whitespace, per the H "other heading shapes" list); the Part label is the text after it up to the first `(` or 120 chars. A `Part X` heading inside a section is a `part` child of the current section, not a scope opener; `Part X` opens a new numbering scope only when it appears before any accepted section in its region (document-level Parts). Reason: H.4's scope-opener list and L.1's "scope with a Part child under some section" must both hold for #3/#5.
- E3. Tokenization for L: strip non-alphanumeric characters from each raw token before the stopword test (so `(as` becomes `as` and is a stopword). Otherwise the valid ref "amount subscribed for (as" gets p = 0.33 and the explain-fact assertion "valid refs p >= 0.50" fails (no false finding results, only the assertion).
- E4. CSS and entities: a nearer `font:` shorthand without `bold` resets weight to normal (same as `font-weight: normal`) in the nearest-declaration walk; entity decoding uses htmlparser2's default named-entity decoding (real #3/#5 contain `&ndash;`, `&ldquo;`, `&rdquo;`, `&nbsp;`) plus the cp1252 remap for numeric 128-159 (the Encoding section lists only the numeric ones).
- E5. `MemoryLabel` enum values must equal the DATA-MODEL `memory_label` CHECK list: `new`, `previously_dismissed`, `dismissed_reconfirm`, `already_answered`, `awaiting_counsel` (Phase 08 and the D1 CHECK constraint use these names). The plan's short names `dismissed` / `answered` in Public Contracts are display aliases for `previously_dismissed` / `already_answered`; export the DATA-MODEL values, have `memory-label-matrix` assert every emitted label is in that list, and list the enum in the contract report. Fix before the contract freeze at exit, because freezing the short names would fail the 04b CHECK on insert.
- E6. Gate filters: name test files so the filters match (`test/security/*` for `test security`; `test/unit/contracts*.test.ts` or `test/contracts/*` for `test contracts`). A token that matches no file must fail the gate (vitest `No test files found`; do not set `passWithNoTests`).
- E7. Initial-values principle: record the final H/L/U/S thresholds, stopword and token lists in the phase report; tune only if every golden and negative assertion still passes; never loosen a golden.
- E8. R guard order: implement guard (a) (no accepted enclosing section) first; the two `this Section 9` cites in #1 are continuation paragraphs of Acknowledgments item 9, not the `9.` list item, so guard (b) alone does not cover them.

Dimension findings:
- Infra fit: PASS — F0 seam edit (deps, `test:golden|property|corpus|vectors`, `no-restricted-globals` for `document`/`window`) with vitest on the Phase 00 4.x pin; registry `## Phase 01` narrowed and consistent with the plan's owned/not-owned lists; no worker/container surface.
- Test coverage: PASS — exact counts plus negatives for all goldens, heading-extraction golden for #3/#5, `this Section 9` negative, 8-valid-ref assertion, mask vector corrected, all gates Fully-Automated in the no-`--` form; workerd/browser re-run is a named residual (known-gap) with a stated owner phase, not a silent pass.
- Breaking changes: PASS — field-level endpoint table, frames with additive `reason?`, `cacheKey`, AI/OCR envelope (additive rule), SessionClaims `{v,w?,a?,iat,exp,kid,t?}` (`t` epoch ms), ports, frozen model shapes, JSON-schema snapshot freeze; consumers 04a (checked field by field) and 03 align. Advisory folded into E5: `MemoryLabel` short names vs DATA-MODEL CHECK list.
- Security surface: PASS — constant-time `crypto.subtle.verify`, kid/exp/iat-skew/size rejection matrix, adapter size cap, ReDoS budget test, mask-before-hash with `sensitive_data` capped medium, keys as parameters only; no network, no LLM. vc-security STRIDE: no FAIL.
- Section A feasibility (model/adapter/structurer/graph): PASS — N1 and N3 pinned and reproduced on real #1/#3/#5; highest-risk edit: heading cue aggregation (E1, E2).
- Section B feasibility (findings/detectors): PASS — L pinned order, list and scores reproduced on real #3/#5 (both fires exactly on t = 0.50, no ties); U exact on #11/#5/#6; highest-risk edit remains `ref-label-coherence` (E3).
- Section C feasibility (memory core/session): PASS — snap, firmId=null, mask `#`+last4 (= DATA-MODEL 2.2 and umbrella row 3), `resolveLabel` rules pinned; enum naming handled by E5.
- Section D feasibility (contracts v1): PASS — consistent with 04a/03 consumers and the registry; freeze via JSON-schema snapshot.
- Section E feasibility (golden/property/corpus tests): PASS — goldens, negatives and the heading golden are mechanically checkable; filter naming handled by E6.
- Blast radius vs 00/03/04a: PASS — Phase 00 runs first (PASS recorded); owned vs not-owned subdirs explicit; append-only seams named; registry updated; no overlap with 03/04a.
- Net: 0 FAIL / 0 CONCERN — remaining items E1-E8 are execute-agent instructions (minor, resolvable in EXECUTE, none golden-loosening).

Open gaps: none
Known gap (pre-classified, not counted): conformance re-run in workerd/browser — known-gap: documented, re-run in P04b / P03 (gap-resolution C).
What this coverage does NOT prove:
- Goldens/vectors prove detection on the 4 named real samples only (#1, #3, #5, #11 plus the statutory/negative checks on #2, #6, #10, #12); they do not prove precision on the other documents (P02 measures label-coherence precision) nor recall on unseen drafting styles.
- Fingerprint, mask, cp1252 and cache-key vectors run in Node only; workerd and browser-bundle equivalence is not proven until P04b/P03 re-run them.
- `test:corpus` proves no-throw and an informational finding ceiling, not structure correctness on documents without goldens.
- Property tests prove schema completeness and determinism, not that contract shapes satisfy 04a/04b/05/06 consumers (consumer contract tests live in those phases).
- The H/L/R/U spot-checks above used an approximate text extraction, not the real adapter; real token scores may differ at the t = 0.50 boundary and the golden tests are the proof.
- No gate proves heading inference on scanned/PDF/DOCX line streams (Phase 06) or real-browser parse timing (Phase 00 S7 baseline only).
Gate: PASS (0 FAIL, 0 CONCERN; N1-N4 and the gate-form fixes verified closed; E1-E8 recorded as execute-agent instructions; BRANCH B: umbrella `## Stable Program Goal` governs, no goal block written to this plan)
Accepted by: session (autonomous autopilot, standing EXECUTE consent) — no concerns to accept; E1-E8 are execute-agent instructions, not accepted concerns
