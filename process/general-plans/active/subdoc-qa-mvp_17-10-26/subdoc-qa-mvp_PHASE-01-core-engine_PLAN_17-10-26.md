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
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
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
  index.ts                                            barrel (append-only)
packages/core/test/{unit,property,golden,seeded}/…
fixtures/fingerprint-vectors.json
fixtures/memory/law-firms.json                        canonical firms + aliases (partners-group, firm-x, firm-y); consumed by web firms.json (P03) and migration 0003 (P04b)
```

## Public Contracts (frozen at Phase 01 exit)

- `Finding` zod schema (fields per DATA-MODEL `finding`: issue_class, severity critical|high|medium|low, detector_kind rule|ai, detector_id, model?, provenance?, confidence 0..1, anchor, section_path, page?, region?, quote_snippet, quote_hash, fingerprint, detail {explanation facts, interpretations[]}). `critical` = blocks digitization. AI-only findings may not exceed `high` (cannot gate unless the analyst promotes).
- `Detector {id, class, severity, explain(), patternKey(), run(graph)}`; registry export `detectors`.
- Fingerprint: `normalize` (NFC; strip U+00AD, U+200B..U+200D, U+FEFF; lowercase; unify curly quotes; collapse Unicode whitespace; keep digits/punctuation), `quote_hash = hex(sha256(normalize(q)))`, `fingerprint = hex(sha256("fp1|"+firmId+"|"+class+"|"+quote_hash))`; quote capped 1000 chars (longer rejected, never truncated); sensitive spans masked before normalization (mask policy: `#####` + last 4 digits; `sensitive_data` severity capped at `medium`, so a last-4 collision can never hide a blocking item).
- `resolveLabel(finding, activeDecision)` per DATA-MODEL 2.3; `answered/unclear` → New.
- API contracts: memory (session, lookup, runs, findings chunk, decisions, revoke, counsel questions/answers, rules, firm memory, audit, export), AI, OCR, quota, error codes (`fingerprint_mismatch`, `read_only_demo`, `rate_limited`, `quota_exhausted`, `budget_cap`, `upstream_failed`, `memory_unavailable`, `payload_too_large`, `unsupported_type`).
- Changes after exit: only through a contract-change note in the phase report plus registry entry; dependent phases re-run their contract tests.

## Blast Radius

`packages/core/**`, `fixtures/fingerprint-vectors.json`, `fixtures/memory/law-firms.json`. Reads (never edits) `samples/sub-docs/raw/*.htm`. Registry: `## Phase 01`.

## Data Flow

HTML bytes → adapter (SAX; cells of a row merged into one logical line) → noise pre-pass → LineStream with cues (bold/caps/position) → structurer (heading candidates scored; numbering scopes restart per Part/Appendix; references parsed incl. "Part B of Section 6", "Section 3 of Appendix A", "this Section N" resolved against enclosing section; statutory cites ("of the … Act/Code", U.S.C., CFR, "1940 Act") excluded) → graph → detectors → findings (stable ids, sorted) → fingerprint per finding (browser lookups use the same function as the Worker).

## Failure Modes

Unknown heading style → block kept as plain paragraph (never a throw); reference to missing target → `unresolved` with expected-target candidates; adapter exceptions return a partial model plus `stage_failed: 'structure'` (AC3 support); quote > 1000 chars → rejected finding logged, not truncated.

## Implementation Checklist

### Step A — Model, adapter, structurer, graph
- [ ] A1. `model/*`: types, LineStream, anchors (hash of content hash + structural position); property test: anchors stable across runs.
- [ ] A2. `adapters/html.ts`: SAX parse, merge `<td>` cells per `<tr>` before heading detection, glyph normalization (☐ ¨ [ ] o ☒), exclusivity-cue capture ("check only one", "select only one", "check one box only", "(circle one)", "check all that apply"), EDGAR noise pre-pass with an auditable rule list (EX-99 wrapper lines, "N of M" counters, "[Logo]", repeating headers).
- [ ] A3. `structure/*`: headings (patterns "N. TITLE", "Part X –", "Appendix X", "4A", plus bold/caps cues), numbering scopes, references, conditionals (whitelist, role routing, skip, negative gate, entity extra part), option groups, defined terms (`(the "X")`, `"X" means`, port ideas from defined-terms-checker, MIT, with own tests), fields, statutory exclusion.
- [ ] A4. `graph/*`: nodes (section, block, option, term, field), edges (ref, conditional, contains, defines/uses); query helpers.
- [ ] A5. Fixtures-in-tests: one seeded HTML per pattern for `graph-extraction-fixtures` (test-local, under `packages/core/test/fixtures/`).

### Step B — Findings and detectors
- [ ] B1. `findings/*`: zod `Finding`, taxonomy (15 codes), stable `ids.ts`, `severity.ts`.
- [ ] B2. `detectors/registry.ts` and the three golden detectors: `ref-this-section` (self-reference vs enclosing section; "expected Section 12"), `ref-label-coherence` (noun before the reference vs target labels; prototype with severity cap `high` until P02 corpus precision is known), `undefined-term` (use of a capitalized term whose defined sibling differs, e.g. Units vs Shares).
- [ ] B3. `engine.ts` + `explain` facts (reference text, found target, expected target).

### Step C — Memory core and session helper
- [ ] C1. `memory/{normalize,fingerprint,mask,label,rulesHash}.ts` per Public Contracts; `rulesHash` = sha256 of sorted normalized rule texts, `'none'` for empty.
- [ ] C2. `fixtures/fingerprint-vectors.json` (case, whitespace, NBSP, curly quotes, "Section 4" vs "Section 5", sensitive mask, firm A vs B, 1000-char boundary).
- [ ] C3. `memory/firms.ts` + `fixtures/memory/law-firms.json`: `resolveFirm(name)` with alias normalization (lowercase, punctuation stripped, "LLP/LLC/Inc" suffix aliases); free text → `null`.
- [ ] C4. `session/cookie.ts` (sign/verify, `kid`, expiry, tamper tests).
- [ ] C5. `config/limits.ts` (locked defaults; single source for web/worker).

### Step D — Contracts v1
- [ ] D1. `contracts/*`: zod schemas and TS types for every request/response in the Public Contracts; `ports.ts` interfaces (`PlatformPort`, `QuotaPort`, `CachePort`, `LedgerPort`, `RulesPort`, `TurnstilePort`) used by Phases 04a/04b/05; `seed-spec.ts` (`DemoSeedSpec`).
- [ ] D2. Contract test: every schema round-trips fixtures; an exhaustive error-code switch compiles.

### Step E — Golden and property tests over real samples
- [ ] E1. `test/golden/*` for AC11–AC13 against `samples/sub-docs/raw/01,03,05,11` (exact location and expected-section assertions).
- [ ] E2. `test/golden/statutory-cite-not-flagged.test.ts` over samples with high "Section X" counts (#1, #2, #10, #12).
- [ ] E3. `test/property/*`: finding-schema-contract, determinism, fingerprint normalization (fast-check), label matrix.
- [ ] E4. `test:corpus` script: run all 12 `.htm` samples, print findings per doc, assert no throw and < 40 high+critical per doc (informational ceiling).
- [ ] E5. Timing note for AC29: log parse+structure ms for #2 into the report (no gate).

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| unit/graph | `pnpm --filter @aduin/core test` | Fully-Automated | AC17 (fixtures), AC9 |
| goldens | `pnpm --filter @aduin/core test:golden` | Fully-Automated | AC11, AC12, AC13, AC17 |
| property | `pnpm --filter @aduin/core test:property` | Fully-Automated | AC7, AC8, AC43, AC46 |
| corpus | `pnpm --filter @aduin/core test:corpus` | Fully-Automated | no-throw over 12 samples (supports AC25, AC29) |
| regression | `pnpm typecheck && pnpm lint && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | Phase 00 surfaces intact |
| conformance | `pnpm --filter @aduin/core test -- fingerprint-vectors` | Fully-Automated | vectors for Node (workerd/browser re-run in P04b/P03) |

Failing stubs for red-first (consumed by execute-agent): `should flag "this Section 11" in Section 12 as expected Section 12`, `should flag Custodian Part B of Section 6 (custodian is Section 4)`, `should flag amount Part B of Section 4 (amount is Section 6 Part B)`, `should flag offered Units as undefined term (defined: Shares)`, `should not flag Section 3(c)(1) of the 1940 Act`, `should label dismissed blocking finding as dismissed_reconfirm`, `should treat Section 4 and Section 5 as different fingerprints`.

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
| `fingerprint-normalization-property`, `fingerprint-vectors` | Fully-Automated | AC46 |

```bash
pnpm --filter @aduin/core test && pnpm --filter @aduin/core test:golden && pnpm --filter @aduin/core test:property && pnpm --filter @aduin/core test:corpus
# Expected: all exit 0; goldens report the exact sections and quotes
```

## Exit Gate

- All gates above green; contracts v1 listed in the phase report with a hash of each schema file; vectors file committed.
- No `document`/`window` reference in `packages/core/src` (lint rule).
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
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S1 (core plus contracts consumed by 3 packages), S2 (API contracts), S4, S6 (identity/cookie, schema), S7 → 5/7 HIGH. Recommended: sequential within the phase (one engine, tightly coupled files); Step C and D could run as a second agent after Step B only if blast radii stay disjoint (they do: `memory/`, `session/`, `contracts/` vs `structure/`). Sonnet for research/validate; opus for code execution.

## Test Infra Improvement Notes

(none identified yet)

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-01-core-engine_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next Step: after Phase 00 is verified, spawn vc-research-agent (re-research: read Phase 00 REF, spike S7 numbers). Next phase after this: Phase 03 (web shell). Phase 04a may start in parallel once contracts are frozen.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
