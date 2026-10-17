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
