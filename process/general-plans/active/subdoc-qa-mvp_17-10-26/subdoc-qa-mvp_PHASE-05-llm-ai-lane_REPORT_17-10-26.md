---
name: report:subdoc-qa-mvp-phase-05-llm-ai-lane
description: "Sub-doc QA MVP Phase 05 execution report (LLM task framework, AI lane, rules injection). Stage 0 core-llm section first; Stage 1/2 sections appended by later agents."
date: 17-10-26
metadata:
  node_type: memory
  type: report
  feature: subdoc-qa-mvp
  phase: phase-05
---

# Phase 05 Report — LLM Tasks, Recordings, AI Lane, Rules Injection

Plan: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-05-llm-ai-lane_PLAN_17-10-26.md`

## Stage 0 — core-llm (opus, 2026-10-17)

Status: COMPLETE. S0.1-S0.4 ticked. Not committed (orchestrator commits). No live model calls.

### Contract change note (S0.1, E9)

- Fields changed: exactly two, both additive.
  - `AiRequestSchema.task`: enum `clause-judgment | counsel-draft`, default `clause-judgment` (requests without `task` still parse).
  - `AiResultSchema.drafts`: optional array (max 40) of `{candidate_id (1-64), text (1-1500)}`.
- G9: the enum schema (`AiTask`) and draft shape (`AiDraft`) are module-private. New non-schema exports in `contracts/ai.ts`: the tuple `AI_TASK_IDS`, types `AiTaskId` and `AiCandidate` (types and a plain array add no snapshot entries).
- Regenerated with `pnpm --filter @aduin/core exec vitest run -u contracts` (this form works). Snapshot still 67 entries; new sha256 `bed258adbbfa03c6...`.
- Diff review: 4 entries changed. `ai.AiRequestSchema` (+`task`) and `ai.AiResultSchema` (+`drafts`) are the direct changes. `frames.ResultFrameSchema` and `frames.FrameSchema` also changed because they embed `AiResultSchema` as the result-frame `data`; with `drafts` stripped they are byte-identical to before (checked by script). No other entry changed.

### What was built (S0.2)

New `packages/core/src/llm/` (re-exported through `llm/index.ts`, one appended block in `src/index.ts`):

| File | Exports |
|---|---|
| `task.ts` | types `LlmMessage {role:'system'\|'user', content}`, `LlmTaskInput {candidates: readonly AiCandidate[]}`, `LlmUsage {tokens_in?, tokens_out?}`, `TaskValidation = {ok:true,result:AiResult,dropped:number} \| {ok:false,reason:'malformed'}`, `LlmTask {id: AiTaskId; promptVersion; schemaVersion; requestKind:'ai'; buildMessages(input, rules: InjectedRules): LlmMessage[]; modelResultSchema: ModelResultSchema; validate(modelJson: unknown, input, usage?): TaskValidation}` |
| `schemas.ts` | `JsonSchema`, `ModelResultSchema {name, schema}`, `CLAUSE_JUDGMENT_MODEL_SCHEMA` (name `clause_judgment_v1`), `COUNSEL_DRAFT_MODEL_SCHEMA` (name `counsel_draft_v1`): hand-written strict JSON, every key required, `additionalProperties:false`, no `v`/`usage`/`ext` |
| `wire.ts` | `type AiResponseMode = 'json_schema' \| 'json_object'`; `responseFormat(task, mode='json_schema'): unknown`; `schemaInstruction(task): LlmMessage` (json_object mode); `inputHash(messages): string` (sha256 hex of `JSON.stringify([{role,content}...])`); `inputHash16(hash): string` |
| `rules.ts` | `RULES_CAPS {maxRules:20, maxRuleCodePoints:500, maxTotalBytes:4096}`; `UNTRUSTED_RULES_TAG='untrusted_firm_rules'`, `UNTRUSTED_DOCUMENT_TAG='untrusted_document_excerpts'`; `InjectedRules {texts, applied, total, truncated, hash, hash8}`; `normalizeRuleText(t)`; `selectInjectedRules(ruleTexts): InjectedRules`; `injectedRulesHash(ruleTexts): string`; `rulesHash8(hash): string`; `escapeForTag(json): string`; `untrustedBlock(tag, value): string`; `rulesBlock(sel): string`; `rulesAppliedNotice(sel): string` ("N of M firm rules applied") |
| `registry.ts` | `TASKS: Readonly<Record<AiTaskId, LlmTask>>`; `DEFAULT_TASK_ID = 'clause-judgment'`; `taskById(id: string): LlmTask \| undefined` |
| `tasks/clause-judgment.v1.ts` | `clauseJudgmentV1`, `CLAUSE_JUDGMENT_PROMPT_VERSION`, `CLAUSE_JUDGMENT_SCHEMA_VERSION` |
| `tasks/counsel-draft.v1.ts` | `counselDraftV1`, `COUNSEL_DRAFT_PROMPT_VERSION`, `COUNSEL_DRAFT_SCHEMA_VERSION` |
| `tasks/shared.ts` | `UNTRUSTED_NOTICE` (exported); internal `candidatesBlock`, `userMessage`, `wrapEnvelope` |
| `verify-quote.ts` | `normalizeForLocate(s)`, `locateQuote(g, quote): QuoteLocation \| null`, `verifyAiResult(g, result: unknown, ctx: {model, provenance:'fresh'\|'cache', task?}): VerifyAiOutcome`; types `QuoteLocation`, `AiRejectReason`, `RejectedAiFinding`, `VerifyAiOutcome`, `VerifyAiContext` |
| `candidates.ts` | `buildAiCandidates(g: DocGraph, findings: readonly Finding[], max = limits.aiCandidates): AiCandidate[]` |
| `provenance.ts` | `AI_SUGGESTION_LABEL='AI suggestion'`, `AiSource`, `Provenance`, `provenanceOf(f)`, `provenanceText(p)` ("Rule <id>" / "AI suggestion · fresh\|from cache") |
| `transport.ts` | `TransportRequest`, `TransportResponse`, `LlmTransport`, `RecordingMissError`, `LlmRecordingSchema` + `LlmRecording` (`{taskId, promptVersion, inputHash, model, messagesDigest, response{raw,parsed}, meta{source:'authored'\|'live', served_model, tokens?{in,out}, recordedAt}}`), `recordingPath(taskId, inputHash)` = `{taskId}/{inputHash16}.json` |

Frozen versions (cache key `prompt_ver` / `schema_ver`):

| Task | PROMPT_VERSION | SCHEMA_VERSION |
|---|---|---|
| `clause-judgment` | `clause-judgment@1` | `clause-judgment.s1` |
| `counsel-draft` | `counsel-draft@1` | `counsel-draft.s1` |

Prompt freeze pin: `llm-task-registry` asserts `inputHash` of a fixed clause-judgment input = `487cdcb3491a84dbaa8f5556a35e3107584c39ee721652744d6e730781782e47`. Any prompt text change fails this and must bump the version.

Key behavior for Stage 1:

- `task.validate(modelJson, input, usage)` is the single "validate once" step for `classify.ts`: needs an object holding the `findings` (or `drafts`) array, else `malformed`. Each item is parsed on its own; items with an unknown `candidate_id` or an invalid shape (e.g. severity `critical`) are dropped and counted in `ext.dropped`. Then one `AiResultSchema.safeParse`. Zero valid items is a valid empty result. `parseContent` (prose around JSON) stays in the Worker.
- Messages: `[system, user]`. The user content is the candidates JSON inside `<untrusted_document_excerpts>`, then the rules JSON array inside `<untrusted_firm_rules>`. That block is `[]` when there are no rules. Both use the `escapeForTag` rule (`<`, `>`, `&`, U+2028, U+2029 become `\uXXXX`). The system prompt says rules are context, never instructions, never a filter.
- Rules selection: NFC, collapse whitespace, trim. Drop empties. Sort by code unit. Skip rules over 500 code points. Then add rules greedily while there are under 20 and the total stays within 4096 UTF-8 bytes. `hash` = core `rulesHash(texts)` (`'none'` when empty). There is no dedupe, so the hash matches core `rulesHash` whenever nothing is truncated.
- Verify chain: envelope check, per-finding schema (a quote over 1000 chars → `quote_too_long`), tolerant locate (case, whitespace, curly/straight quotes, dashes, soft-hyphen/zero-width, wrapping quotes/ellipsis), then `snapToSentence`, mask, `quoteHash`, cap via `maxSeverityFor(class,'ai')`, and finally `FindingSchema`. The result has `detector_id = 'ai:<task>'` and facts `{source:'AI suggestion', candidate_id, model, task}`. Explanation and interpretations are masked. It never throws.
- Candidates are picked in priority order: rule-finding sentences, then conditionals, defined terms, option-group first lines. They are masked, deduplicated by sentence, capped at 40, returned in document order, with ids `c_` + 16 hex (stable per docHash).

### D6 core items (S0.4)

- F4: `defined-term-issues` now builds a word index once (exact and lowercase first-word → ascending block list). Each term scans only the blocks that hold its first word; terms with no leading word fall back to a full scan. Exported `buildWordIndex`, `candidateBlocks`, `TermScanStats`. `termIssues(g, stats?)` takes an optional counter. Findings are identical on all 12 HTML samples (before/after per-sample totals compared).
- P2-3: `explain()` in `ref-this-section`, `ref-label-coherence` and `undefined-term` uses `fact()` fallbacks. Output is byte-identical when facts are present (goldens unchanged). Red-first confirmed: the new sparse-facts case failed on the old code ("The text says "undefined"…").
- P2-4: backlog content verified (`core-followups_REF` row P2-4). Added `/\(?\bcheck one\b\)?(?!\s+or\b)/i` as the last `EXCLUSIVITY_CUES` entry ("check one or more" excluded).

### Re-baselines (deliberate)

- Real samples, structure view: only #10 moved, badge 31 → 30 and options-to-check 14 → 13 (its "(check one):" group is now a stated cue). All other samples are unchanged. #2 (38) and #5 (23) do not move: they contain no "check one" text, so the backlog guess that this cue drives their counts was wrong. Their inferred-cue count needs the other P2-4 option ("weigh option issues differently"), which stays open in the backlog. Finding totals are unchanged on every sample. Goldens #1=2, #3=2, #5=2, #11=1 hold.
- `test/unit/structure-view-build.test.ts`: the seeded `option-gap-overlap/clean.html` has "Annual income (check one):". So the first stated group is now `(check one)`, not `check only one`. I updated the expectation and added an assertion that both groups are stated.
- Web e2e `structure-view` computes the badge from the view model (no hard-coded count), so no spec change is expected. Web `structure-view`/`status-stages` e2e were not run in Stage 0 (Stage 1 web-lane / EVL).

### Gate outcomes (Stage 0)

| Command | Result |
|---|---|
| `pnpm --filter @aduin/core exec vitest run -u contracts` | regenerated (diff reviewed above) |
| `pnpm --filter @aduin/core test contracts` | 1 file, 34 tests pass |
| `... test llm-quote-must-exist` | 6 pass |
| `... test ai-severity-cap` | 3 pass |
| `... test ai-mask-before-storage` | 2 pass |
| `... test rules-injection-delimited-hostile` | 4 pass |
| `... test rules-caps` | 4 pass |
| `... test rules-hash-stable-and-order-independent` | 4 pass |
| `... test defined-term-scan-bounded` | 3 pass |
| `... test explanation-present-per-rule` | 3 pass (extended for P2-3) |
| `... test check-one-exclusivity-cue` | 3 pass |
| `... test llm-task-registry` (extra) | 9 pass |
| `... test llm-rules-and-quote` (S0.3 property file) | 5 pass |
| `pnpm --filter @aduin/core test` | 47 files, 335 tests pass (was 37 / 291) |
| `pnpm --filter @aduin/core test:golden` / `test:seeded` / `test:corpus` / `test:property` | 44 / 2 / 13 / 34 pass |
| `pnpm --filter @aduin/scripts fixtures:check` | OK (46 files match) |
| `pnpm typecheck` | exit 0 (all packages) |
| `pnpm lint` | exit 0 (eslint + prettier) |
| `pnpm guard:cf`, `pnpm secrets:scan` | OK |
| regression extra: `pnpm --filter @aduin/worker test`, `pnpm --filter @aduin/web test` | 445 / 38 pass |

### Deviations (within blast radius)

1. The snapshot diff touches 4 entries, not 2. The 2 extra are the `frames` result/frame schemas that embed `AiResultSchema` (drafts-only, verified). Unavoidable without changing frames.
2. Extra helper file `llm/tasks/shared.ts` and barrel `llm/index.ts` (not in the touchpoint list). They hold shared prompt and envelope code so the two tasks do not duplicate it.
3. Added the export type `AiCandidate` in `contracts/ai.ts` (type only, no snapshot impact).
4. The test token names `rules-injection-delimited-hostile`, `rules-caps` and `rules-hash-stable-and-order-independent` now also exist in core (`packages/core/test/unit/llm/`). The plan's gates for these tokens are `@aduin/worker`. Package filtering keeps them separate, and the Worker files are still Stage 1a's job.
5. `llm-quote-must-exist` uses inline authored AI results over a synthetic document (`test/helpers/llm-docs.ts`), not `fixtures/llm-recordings/`. Stage 1c F1 adds the recording-backed cases (incl. the hallucinated-quote recording) and the `llm-schema` gate.
6. An over-cap single rule (>500 code points) is skipped whole, not cut. It is counted in "N of M", so this is never a silent drop.

### Test infra gaps found

- None blocking. Known-gap stays as the plan names it: live free-model behavior (AC28/AC51 residual).

CONTEXT_PARTIAL: none.

### Forward Preview

- Test infra found: core vitest token filter (`vitest run <token>`). New helper `packages/core/test/helpers/llm-docs.ts` (synthetic doc + `aiFinding()`).
- Blast radius changes: `packages/core/src/{llm/**, contracts/ai.ts, adapters/html.ts (EXCLUSIVITY_CUES), detectors/{defined-term-issues,ref-this-section,ref-label-coherence,undefined-term}.ts, index.ts}`, contracts snapshot, two existing core tests.
- Commands to stay green: `pnpm --filter @aduin/core test`, `test contracts`, `test:golden`, `pnpm --filter @aduin/scripts fixtures:check`, `pnpm typecheck`, `pnpm lint`.
- Dependency changes: none.
- Follow-up stubs: none created. The P2-4 residual (#2/#5 inferred-cue weighting) stays in `core-followups_REF`. Its row should be updated at UPDATE PROCESS.

## Stage 1c — core-fixtures-scripts (opus, 2026-10-17)

Status: COMPLETE. F1-F4 ticked. Not committed. Orchestration deviation: TeamCreate is unavailable, so 1c ran first and this section replaces the F1 SendMessage (G7/E8). Stages 1a and 1b must read it before W4 / V5.

### Coordination contract for 1a (worker-wiring) and 1b (web-lane)

**Recording files** — `fixtures/llm-recordings/{taskId}/{inputHash16}.json`, pretty JSON (2 spaces + newline), excluded from prettier. Keys (in this order):
`case` (casebook id), `taskId`, `promptVersion`, `inputHash` (64 hex), `model`, `messagesDigest` (= inputHash), `request`, `response {raw, parsed}`, `meta {source 'authored'|'live', served_model, tokens? {in,out}, recordedAt, cost_usd? (live), response_mode? (live)}`.
- `LlmRecordingSchema.parse(file)` passes. It strips `case` and `request`, so read the raw JSON when you need them.
- `request` = `{task, sample ('01'|'03'), candidates: AiCandidate[] (exact engine output), rule_texts: string[], mode: 'json_schema'}`. To replay through the Worker, POST `/api/ai` with `{v:1, task: request.task, law_firm_id, candidates: request.candidates, settings:{}}`. Then answer the upstream fetchMock with an OpenRouter completion whose `choices[0].message.content = response.raw` (and `model = meta.served_model`, `usage.cost = 0`).
- The forwarded messages are `TASKS[task].buildMessages({candidates}, selectInjectedRules(rule_texts))`. In `json_object` mode, `schemaInstruction(task)` is appended as the last system message (no current recording uses this mode). `inputHash` is taken over exactly those messages.

| case | task | file | source | expected behavior |
|---|---|---|---|---|
| sample-01 | clause-judgment | `clause-judgment/37dbea6ce6ecfe4b.json` | live | 3 findings. After the verify chain, 2 are kept (two findings cite the same document quote and dedupe to one id), 0 rejected |
| sample-03 | clause-judgment | `clause-judgment/e7e3ad45fe791fe5.json` | live | 4 findings. 2 kept, 2 rejected `quote_not_found` (one quote is mojibake `â€œU.S. personâ€`, one is paraphrased). This is a real-model AC28 case |
| counsel-draft-03 | counsel-draft | `counsel-draft/2e7df78bf60f8d26.json` | live | 2 drafts. Quality is poor: the model echoed the clause text |
| firm-rules-in-context-03 | clause-judgment | `clause-judgment/8ae2bdc4b8f87c12.json` | authored | 1 placeholder finding. rule_texts = [`Placeholders for the investor name on the wire "FFC" line are firm standard wording.`] (synthetic active rule) — for 1a `firm-rule-in-context-recorded-llm` |
| hostile-hallucinated-quote | clause-judgment | `clause-judgment/b4345a3f9db36f5a.json` | authored | validates. Verify rejects `quote_not_found` |
| hostile-prose-around-json | clause-judgment | `clause-judgment/ea32e6ea25cb04cc.json` | authored | raw = prose + fenced JSON. Worker `parseContent` succeeds, so expect success |
| hostile-extra-keys | clause-judgment | `clause-judgment/71d8dabe64fc9f40.json` | authored | top-level `reasoning` and per-finding `suggested_fix`/`severity_override` are stripped, so the result is valid |
| hostile-severity-critical | clause-judgment | `clause-judgment/29dab8deebe21a5c.json` | authored | 1 dropped (`critical`), 1 kept, `ext.dropped = 1` |
| hostile-oversized-quote | clause-judgment | `clause-judgment/e03165c146a430c9.json` | authored | dropped at task.validate, so the result has 0 findings. Direct verify gives `quote_too_long` |

Hostile cases send one candidate each, so each has its own inputHash.

**Worker JSON import (W4 probe):** these are plain JSON files. 1a's `import.meta.glob` probe should glob `fixtures/llm-recordings/**/*.json`.

**Body parity:** `scripts/src/record/ai-request.ts` `upstreamBody()` uses the Worker `buildBody` template and key order: `{"model":M,"models":[M],"messages":<JSON.stringify(messages)>,"temperature":0,"max_tokens":6000,"response_format":<responseFormat(TASKS[task], mode)>}`. The messages are serialized as `[{role,content}]`. 1a's `aiMessages` must emit `JSON.stringify(TASKS[task].buildMessages(...))` with the same key order, and the Worker `response_format` must become core `responseFormat(task, AI_RESPONSE_MODE)`, not `z.toJSONSchema(AiResultSchema)`. With that, the Worker-side `record-body-parity` can assert byte equality against `request` plus this template.

**RecordedTransport:** `packages/core/test/helpers/recorded-transport.ts` exports:
- `RecordedTransport` (implements `LlmTransport`; reads `recordingPath(taskId, inputHash)` from disk; rejects with `RecordingMissError` when the file is missing, or when `inputHash`, `taskId` or `promptVersion` differ; never calls fetch; records `calls`)
- `loadRecordings()`, `recordingByCase(id)`, `messagesFor(request)`, `transportRequest(request, model)`, `RECORDINGS_DIR`, type `RecordedRequest`

It is core-test-local, because the web and worker packages cannot import core test files. They should replay the JSON directly.

**Precomputed files (for 1b V3/V5, G6):** `apps/web/public/precomputed/{docHash}.{rulesHash8}.json`, committed (not gitignored).
- `44d13ec6b132c5eac32211014d095a32719e3b14547474d65b32e5d10dea4d66.none.json` (sample #1)
- `4fa88f277183a9a03161ba3201840eeb60577b4a326c4767aeb74af540980aa8.none.json` (sample #3)
- docHash = core docHash (sha256 of the raw sample bytes, the same as the engine `g.doc.id`).
- rulesHash8 = `none`. Bundled samples carry no active firm rules, and the demo seed rule `sr01` is `proposed`, so it is never injected. This is E18(e) option "[] / none": the web stub `firmRules` should return `[]` for the sample path. The 1a `rules-hash-seed-parity` test should agree: the active demo seed rules give `none`.
- Body: `{v:1, kind:'aduin-precomputed-ai', docHash, sample, rulesHash8, task:'clause-judgment', promptVersion:'clause-judgment@1', schemaVersion:'clause-judgment.s1', inputHash, model, served_model, source:'authored'|'live', result: AiResult}`.
- `result` has already been through `task.validate`, and `AiResultSchema` passes. The web must still run it through `verifyAi` with provenance `cache` on open.
- Expected after verify: #1 gives 2 findings and 0 rejected; #3 gives 2 findings and 2 rejected (`quote_not_found`).

### Scripts (F2/F3)

| Command | Behavior |
|---|---|
| `pnpm --filter @aduin/scripts record:author` / `record:author --check` | Writes or checks the authored recordings, deterministically and offline. Keeps live files. `--check` exits 1 on a missing, stale or orphan file |
| `pnpm --filter @aduin/scripts record:ai --dry-run` | Plan only, no key, no network |
| `ALLOW_LIVE_LLM=1 pnpm --filter @aduin/scripts record:ai --max-requests N [--cases a,b] [--mode json_object] [--space-ms N]` (or env `RECORD_MAX_REQUESTS`) | Live run. In-code ceiling `LIVE_REQUEST_CEILING = 8` (the cap can only lower it). Allow-list `nvidia/nemotron-3-super-120b-a12b:free` only. Base URL pinned to `https://openrouter.ai`, `redirect:'error'`. Stops at the first `usage.cost > 0` (nothing written) or at a non-free served model. Every fetch counts (no retries). Error bodies are redacted and truncated to 200 chars. The key is never printed or stored |
| `pnpm --filter @aduin/scripts precompute:ai --from-recordings [--dry-run] [--check]` | Offline, deterministic bytes. `--dry-run` writes nothing, `--check` exits 1 on a stale file. Without `--from-recordings` it records live first through `record-ai`, with the same guards |

### Live run (F4, APPROVED-LIVE 8)

- Live requests used: **3 of 8**. No retries, no failures, `usage.cost = 0` on all three.
  1. R1 probe = `counsel-draft-03`, strict `json_schema`. HTTP 200, raw is pure JSON, valid.
  2. `sample-01`: 2229 tokens in, 3674 out.
  3. `sample-03`: 4217 tokens in, 5783 out.
- R2 (`json_object`) was not needed.
- Served model id on all three: `nvidia/nemotron-3-super-120b-a12b:free`.
- Strict-mode verdict: ACCEPTED. **Recommendation for 1a: `AI_RESPONSE_MODE = json_schema`.**
- Note for the Worker `MAX_TOKENS.ai = 6000`: sample #3 used 5783 output tokens, close to the cap. A larger document may truncate the output, which would be classified as malformed. Flagged for 1a/EVL, not changed here (Worker scope).
- Key sourced only with the approval marker. `pnpm secrets:scan` is OK after recording. No secrets file was written under `apps/worker/`.

### Gate outcomes (Stage 1c)

| Command | Result |
|---|---|
| `pnpm --filter @aduin/core test llm-quote-must-exist` | 2 files, 11 pass (Stage 0 inline + new recorded file) |
| `pnpm --filter @aduin/core test llm-schema` | 1 file, 9 pass |
| `pnpm --filter @aduin/scripts test precompute-ai` | 5 pass |
| `pnpm --filter @aduin/scripts test record-body-parity` | 10 pass (scripts side) |
| `pnpm --filter @aduin/scripts test record-ai` | 9 pass (guards: ALLOW_LIVE_LLM, cap required, ceiling 8, free allow-list, pinned host, redact, abort at cost > 0, cap stop, key never in output) |
| `pnpm --filter @aduin/core test` | 49 files, 349 pass |
| `pnpm --filter @aduin/scripts test` | 8 files, 46 pass |
| `pnpm --filter @aduin/scripts fixtures:check` | OK (46 files) |
| `record:author --check`, `precompute:ai --from-recordings --check` | OK |
| `pnpm typecheck`, `pnpm lint`, `pnpm secrets:scan`, `pnpm guard:cf` | exit 0 / OK |

Not mine (Stage 1a): the `@aduin/worker` gates `record-body-parity` and `rules-hash-seed-parity`.

### Deviations (within blast radius; also in the plan `## Deviations`)

1. No TeamCreate, so the run was sequenced 1c → (1a ∥ 1b), and this section is the handoff.
2. `.prettierignore` += `fixtures/llm-recordings/`, `apps/web/public/precomputed/` (generated byte-deterministic JSON).
3. Extra files `scripts/src/record/{ai-request,casebook,author-recordings}.ts`, script `record:author`, test `scripts/test/record-ai.test.ts`.
4. The recorded-quote test asserts the AC28 property (kept quotes exist, unlocatable quotes are rejected), not "zero rejected", because live sample #3 contains two unlocatable quotes.
5. Precomputed files are keyed `none`.

### Test infra gaps found

- None blocking.
- Known-gap (unchanged): live model quality. The live #3 run had 2 of 4 quotes unlocatable, the counsel drafts only echo the clause text, and #1 cited the same quote for two candidates. AC28/AC51 stay Hybrid with this residual. Backlog: Phase 10 live-quality sweep (prompt tuning would need a promptVersion bump).

CONTEXT_PARTIAL: none.

### Forward Preview

- Test infra found: `RecordedTransport` + `loadRecordings` (core test helper); casebook + `record:author --check` as the drift detector after any prompt or candidate change.
- Blast radius changes: `packages/core/test/{helpers/recorded-transport.ts, recorded/*}`, `fixtures/llm-recordings/**`, `scripts/src/{record,precompute}/**`, `scripts/test/{precompute-ai,record-ai,record-body-parity}.test.ts`, `scripts/package.json`, `apps/web/public/precomputed/*.none.json`, `.prettierignore`.
- Commands to stay green: the gates above, plus `record:author --check` and `precompute:ai --from-recordings --check` after any `llm/` or detector change. A changed candidate set moves the inputHash, so the authored files must be re-authored, live ones re-recorded, and precompute re-run.
- Dependency changes: none.
- Follow-up stubs: none created. The Phase 10 live-quality sweep is already named in the plan.
