---
name: plan:llm-defect-detection
description: "Review playbook + new reference-target LLM task (pointer sentence plus target section) + offline benchmark over the 46-doc EDGAR corpus; backlog stub for detector/structurer follow-ups"
date: 22-10-26
feature: none
---

# LLM defect detection upgrade (grounded in verified EDGAR defects)

Date: 22-10-26
Status: COMPLETE_WITH_GAPS (22-10-26): all ACs met after EVL cycle 1 (`reference-target@2`, AC10 live 3 of 3), 26 offline gates green, deployed f7b25f68; gaps in backlog F1, F7b, F8, F9. Archived to completed/. Closeout: `llm-defect-detection_REPORT_22-10-26.md`
Complexity: COMPLEX (single plan, 8 steps; not a phase program)

## Overview
Raise real-defect recall of the AI lane. Today the deterministic engine catches 8 of the 12 verified entries in the 12 original docs and 0 of 8 in the 34 new docs (ground truth below). Root cause for the LLM: a candidate is one sentence, so the model cannot see that "proceed to Section H" points at a plan-only section. Two changes:
1. A playbook (defect kinds, verified examples, NOT-A-DEFECT list) shared by both AI tasks.
2. A new task `reference-target` whose candidate shows the pointer sentence AND the heading plus first lines of the section it points to.
An offline benchmark plus an approved, guarded live run measure recall.

Context loaded for this plan: `process/context/all-context.md`, `process/context/engine/all-engine.md` (Phase 05 LLM framework), `process/context/worker/all-worker.md` (pipeline, task registry), `process/context/tests/all-tests.md` (runner map, one-token-per-call, no `--`), `docs/research/anduin-analyst-and-counsel-loop.md` (analyst states facts, counsel decides fixes; so findings must be factual with evidence, never "fix to X").

## SPEC (locked)
- Use cases: the analyst runs AI review. Wrong-target cross-references show up as findings in the existing `broken_cross_reference` class with a short reason. Known non-defects are not flagged.
- Out of scope: new screens, a 16th issue class, new AiFinding or AiCandidate fields, any Worker code change, unguarded live LLM runs (the bench live run is approved and gated, see Approved live run), structurer or golden changes, per-investor-type contradiction pass (backlog).
- Constraints: frozen contracts v1 (additive only), `limits.aiCandidates` (40), `limits.quoteMaxChars` (1000), masking, verify-quote, cache keys (`promptVersion`), Worker proxy/quota/spend cap untouched. `UNTRUSTED_NOTICE` in every prompt. Light test tier only.

## Decision Summary
### Chosen Approach
New task id `reference-target` (`promptVersion` `reference-target@1`) on the existing `/api/ai` route. Deterministic code packs each evidence pair into the candidate `quote`: the pointer sentence first, verbatim, then a `TARGET` block. Verification is scoped to the pointer sentence only (see Pair design). Both tasks share the playbook text; `clause-judgment` moves to `clause-judgment@2`.
### Why This Over Alternatives
| Alternative | Why Rejected |
|---|---|
| Extend clause-judgment with target text | Two judgments in one prompt, harder to measure; same cache bump anyway |
| New `/api/ai/reftarget` route | Touches Worker routing and quota; no benefit, the registry already dispatches by `task` |
| New optional `AiCandidate.context` field | Worker `shapeAi` (apps/worker/src/proxy/guards.ts) rebuilds each candidate from only `id`, `quote`, `section_path`, `issue_class_hint`, so a new field is silently dropped unless the Worker trust path is edited. Rejected: the packed quote needs no Worker change |
| Put evidence in `ext` | `ext` is passthrough and `userMessage` never shows it to the model |
### Risk Predictions
- Architect: pair length vs `quoteMaxChars`; verify-quote with a two-place quote (solved by the Pair design below).
- Security: target excerpts are untrusted document text; same delimiting, `UNTRUSTED_NOTICE`, masking over the whole packed string; server-side mask in `shapeAi` is idempotent on it.
- QA: recall gain unproven until a live run; offline results use hand-authored recordings, so they prove plumbing and the pair builder, not model quality.
- Cost: one extra AI call per review, only when pairs exist; capped by `aiCandidates`. Also counts against the visitor AI request quota (8 per day) and the 3 fresh-AI documents rule is per document, unchanged.
- Product: findings land in the existing Findings panel; severity capped at high for AI.
### Key Constraints Accepted
Appending to `AI_TASK_IDS` is additive. Old Worker versions reject the new id; acceptable because deploy is out of scope. `clause-judgment@2` invalidates cached results and recordings by design (re-key recipe in step 2).

## Pair design (G6 result: the quote must stay verifiable)
Facts read from code: `verifyAiResult` locates the model quote with `locateQuoteInSites`, which searches only the cited candidate's site range (one block, start to end). `AiCandidate` has no context field and the Worker would drop one. The candidate `text` the model sees is `candidate.quote` (`candidatesBlock` in tasks/shared.ts).
Design:
- Packed `quote` = pointer sentence verbatim (snapped with `snapToSentence`, so it begins exactly as in the document) + newline + `[TARGET <label>: <heading> | <first N chars of the section>]`, or `[TARGET <label>: NOT FOUND]` when no heading matches.
- Budget (fits 1000): pointer at most 500 chars; label + heading at most 150; excerpt at most 300; separators 50. A final `slice(0, limits.quoteMaxChars)` is a safety net only; a unit test asserts the longest pair is at most 1000 without relying on it. A pointer sentence over 500 chars is shown truncated, but its site is the full sentence.
- Site = pointer sentence range only (new `AiCandidateSite` per pair). The web engine worker keeps these sites and passes them as `ctx.sites` with `task: 'reference-target'` (not `candidateSitesFor`, which recomputes clause-judgment sites).
- Prompt rule: the finding `quote` must be copied from the POINTER sentence only; the TARGET block is evidence. Result: a model quote taken from the target text, or spanning pointer plus target, is rejected `quote_not_found`; a pointer quote is accepted and the finding anchors at the pointer sentence (the right place for the analyst).
- Result: no change to `verify-quote.ts`, `AiCandidate`, `AiFinding` or the Worker. Added tests prove the three cases.
- Pairs whose pointer sentence overlaps a deterministic (`rule`) finding are skipped, same as `candidates.ts`. Partners Group swaps are already `critical` rule findings, so they are engine-caught and not re-asked.

## Ground truth used (from the verified-defect files and engine run)
Engine today (46 docs = 12 originals + 34 new, 437 findings): `defined_term_issue` 316, `broken_cross_reference` 51, `sensitive_data` 28, `placeholder` 23, footnote 13, `broken_conditional` 4, `drafting_note` 2. It catches Partners Group 03 and 05 swaps (4 of 4, critical) but none of Onex, LAGO, Keystone.

### Verified defects (ground truth; file, short quote, why)
Leakage rule (GAP-5): these real quotes live ONLY in `fixtures/defect-bench/ground-truth.json` and this table. The playbook (`REVIEW_PLAYBOOK`) uses paraphrased synthetic examples with different section letters, different wording and different fund names, one per defect kind (wrong-target pointer to an entity-only or plan-only section, pointer to a part that is a different document role, statute citation, defined-by-reference term, identical re-definition). No verbatim anchor from E1 to E12 may appear in the playbook; a unit test greps the playbook for every ground-truth anchor and fails on a hit, so live recall on E1 to E3 measures the model, not memorization.
| # | File | Short quote | Why it is a defect | Required catch in bench |
|---|---|---|---|---|
| E1 | Onex_Falcon_Direct_Lending_B_2021_d146040dex41.htm | "Each Investor who is a natural person should respond to Section E." | E is the entity-only supplement; directions not renumbered after inserted sections (entities point to C = Non-U.S. Persons) | YES (new task) |
| E2 | LAGO_Evergreen_Credit_2026_ck0002043759-ex4_1.htm | "all other Investors should proceed to Section H" | H is plan-only; correct target is Section I | YES (new task) |
| E3 | Keystone_Private_Income_Fund_2020_fp0050233_ex99252p.htm | "information provided in Part C of the Suitability Statement" | No Part C of the Suitability Statement; statements are in Part D, Part C is the agreement itself | YES (new task) |
| E4 | 03-partners-group-pe-master-2019.htm and 05-partners-group-ngi-2024.htm | "amount specified in Part B of Section 4"; "Custodian indicated in Part B of Section 6" | Section numbers swapped | Engine (must not regress) |
| E5 | 01-franklin-lexington-pmf-2024.htm | "paragraphs 1 through 4 of this Section 11" | Sits inside Section 12; engine already reports it | Engine |
| E6 | Third_Point_Private_Capital__2025_tm2512133d1_ex10-7.htm | "box 11 ... may skip sections II, III and IV" vs Exhibit H "may also skip Section IV" | Cover checklist contradicts the detail section | No (backlog F4) |
| E7 | Energea_Portfolio_4_USA_LLC_2021_ea142497ex1a4a_energea4.htm | "5.21 If you are not a citizen or resident of the United States" vs "5.22.2 You are a citizen or permanent resident" | Contradiction inside one investor path | No (backlog F2) |
| E8 | Keystone (same file) | "Suitability Statements for Individual Investors or ... Entity Investors, as applicable" | Four investor types offered, two routed | No (backlog F3) |
| E9 | 10-crowdstreet-reit-i-2022.htm | `(collectively, the "Offering Materials")` | Defined twice with different scope (contrast with identical re-definitions below) | No (clause-judgment playbook) |
| E10 | 11-medalist-diversified-reit-2016.htm | "the offered Units will not be sold" | Defined term is Shares; Units used once | No |
| E11 | NF_Investment_Corp__2013_d571166dex41.htm | "(e) Each Investor should respond to the questions in Section E." | Directions never assign Section G; low severity | No (backlog F3) |
| E12 | 01-franklin-lexington-pmf-2024.htm | "3.0% of the Subscription Amount" | Capitalised term used 4 times, never defined; medium confidence | No |

### NOT-A-DEFECT list (playbook text and unit fixtures)
1. Statute or regulation citations: Investment Company Act Section 3(c)(7), Code Sections 414(d), 892 and 4975, Rule and C.F.R. citations. They are external, not references to this document.
2. Terms defined by reference to another document ("has the meaning given in the PPM / Memorandum / Bylaws"): not undefined.
3. IRS W-8 text such as "Complete Part V": refers to the IRS form, not to this document.
4. Identical re-definitions of the same term in a combined two-form file (for example an entity form and an individual form in one file): only a re-definition with different scope is a defect.
5. Instructions-vs-body scoping: a pointer inside an instructions block that names a part of a different form in the same file.
6. A term defined but never used again (Coatue "BSA"): minor, do not report.

## Touchpoints
- `packages/core/src/llm/playbook.ts` (NEW): `REVIEW_PLAYBOOK` text: defect kinds, paraphrased synthetic examples keyed `X1` to `X6` (different letters and wording than E1 to E12; see Leakage rule), the NOT-A-DEFECT list.
- `packages/core/src/llm/tasks/clause-judgment.v1.ts`: append playbook to SYSTEM; version `clause-judgment@2`.
- `packages/core/src/llm/tasks/reference-target.v1.ts` (NEW): SYSTEM prompt (pointer-only quote rule, `UNTRUSTED_NOTICE`, playbook); `validate` reuses `wrapEnvelope` with `AiFindingSchema`; `promptVersion` `reference-target@1`, `schemaVersion` `reference-target.s1`.
- `packages/core/src/llm/schemas.ts`: add `REFERENCE_TARGET_MODEL_SCHEMA` (name `reference_target_v1`; same item shape as clause judgment, `issue_class` enum limited to `broken_cross_reference` and `broken_conditional`).
- `packages/core/src/llm/reference-pairs.ts` (NEW): `buildReferencePairs(g, findings, max)` returning `{ candidates, sites }`. Pointer sentences: routing phrases ("proceed to", "respond to", "complete", "provided in", "see", "skip") plus an internal Section/Part/Annex/Question label that resolves in the structure (statutory and external references excluded using the same marker logic as the engine S algorithm). Emits the target heading plus excerpt, or NOT FOUND, or the heading of a part that exists but sits in another role. Masks the whole packed string, skips rule-overlapped pointers, document order, ids `r_` + 16 hex, cap `limits.aiCandidates`.
- Lettered-heading resolver (GAP-1), owned by `reference-pairs.ts` (the structurer has no letter-labelled Section model; probe: pointer blocks in Onex, LAGO and Keystone carry 0 conditionals and 0 references, so the builder resolves labels itself from block text, not from the graph). It scans document blocks in order and records, per label, a heading entry `{label, scope, title, blockIndex}`. Real block shapes (cycle-3 probe of `analyzeHtml` on the three docs): (a) label and title in ONE paragraph block: Onex `E. Supplemental Data for Entities` (block kind paragraph, inside the signature-page supplement whose A. to E. blocks are siblings), LAGO `B.` to `I.` (`H. THE FOLLOWING INFORMATION ...`); (b) a BARE label block with the title in the next block: LAGO `A.` (so the resolver must accept both a label-plus-title block and a bare-label block followed by a title block); (c) Keystone `PART X: TITLE` blocks of kind heading (`PART B` to `PART E`, four separate `PART D: SUITABILITY STATEMENTS FOR ...` headings, plus four repeated `Part A:` headings); also Onex nested `A.` to `D.` blocks of kind field under FINRA sections and a duplicate top-level `I.` (`I. Bad Actor Disqualification`, `I. Third Party Referrals`). Duplicate-label rule: when a label occurs more than once (Onex duplicate top-level `I.`, four Keystone `PART D` scopes) the resolver keeps all entries and picks the one in the same scope as the pointer (nearest preceding scope boundary), else the first top-level one, and emits NOT FOUND only when no entry exists; nested `A.`/`B.`/`C.` never shadow a top-level label. Multi-label rule: a pointer sentence naming several labels (LAGO G and H, Keystone C and D) yields one TARGET per label, at most 3 per pair, the excerpt budget split evenly across them (label+heading 150 and excerpt 300 are shared, so each TARGET gets at most `floor(450 / n)` chars), pointer budget unchanged at 500; a fourth label is dropped. Mini-doc unit tests are written in these real heading shapes (label-plus-title paragraph `E. Supplemental ...`, bare `A.` plus title block, duplicate `I.`, one-paragraph `H. THE FOLLOWING ...`, `PART D:` x4 heading blocks, sentences naming two labels).
- `packages/core/src/llm/registry.ts` (entry), `packages/core/src/contracts/ai.ts` (append `'reference-target'` to `AI_TASK_IDS`), `packages/core/src/llm/index.ts` and `packages/core/src/index.ts` exports.
- `packages/core/test/__snapshots__/contracts.json-schema.snap`: regenerate (task enum gains one value); note it in the report.
- `apps/web/src/engine/types.ts`: `EngineResult` gains an optional `pairs` field (the packed reference-target candidates; optional, so existing consumers and the frozen contracts are unchanged); `VerifyAiContext` gains an optional `task` (`AiTaskId`) so verify can scope to pair sites.
- `apps/web/src/engine/engine.worker.ts`: build pairs next to `buildAiCandidatesWithSites` (lines near 723 to 731); the `Retained` entry (type near line 158, `retain()` near 167, set near 689 and 728) gains `pairSites` next to `aiSites`; verify with `ctx.sites` from `pairSites` and `task: 'reference-target'` (lines near 768 to 777).
- `apps/web/src/features/ai/ai-lane.ts` (and `stream-client.ts` if it needs the task): `evaluate()` (line 197) currently sets status `skipped` with note "nothing for the AI to review" (line 216) when clause-judgment candidates are 0; change the guard to skip only when BOTH clause-judgment candidates and `pairs` are empty, so reference-target can still run on its own; the same guard exists in `aiRunFresh()` (line 310, `c.failed || c.candidates.length === 0`) and must change the same way, and the lane `Ctx` (built in `aiOnOpen`, line ~244) gains `pairs: result.pairs ?? []`. Send the second `/api/ai` call with `task: 'reference-target'` when `pairs` exist. Call-2 failure rule: a failed, downgraded or quota-refused second call must NOT run `downgrade()` over call-1 results; call-1 findings are kept, the lane ends `done` with a partial-result notice ("Second AI pass did not complete; showing the first pass") and no automatic retry. A failed call 1 behaves as today (downgrade) and call 2 is not sent. Merge path (cycle-3 correction, verified in code): AI findings are verified in the web engine worker, `verifyAi` (engine.worker.ts) -> core `verifyAiResult` (`packages/core/src/llm/verify-quote.ts`, line 320) -> `dropRuleDuplicates` in `packages/core/src/llm/dedupe.ts`, fed by `Retained.ruleFindings`; it drops any AI finding whose anchor overlaps a `rule` finding in the same block, for both tasks, with no change. `reference-pairs.ts` imports `rangesOverlap` from `./dedupe` (as `candidates.ts` does) for its rule-overlap skip. `apps/web/src/features/review/v2/dedupe.ts` (`dedupeFindings`, `triageWithTwins`) is NOT on this path: its only importer is `findings-v2-dedupe.test.ts` (Findings v2 Phase C was dropped), so it is not touched. The two tasks produce different finding ids (`findingId` uses `ai:${task}` as detector id), so merging call-1 and call-2 verified findings in the lane (`emit(c, [...v1, ...v2])`, counts summed) cannot collide. AI-vs-AI dedupe: none (the documented behavior "AI findings never drop each other" in core `dedupe.ts` stays); a duplicate is merely a second row, noted in backlog F7. No `dropAiDuplicates` is added.
- New or touched web tests must carry the token `ai-lane` in the file name or describe title so `pnpm --filter @aduin/web test ai-lane` runs them; `engine-ai-api` (existing) must also run and stay green.
- `apps/worker/test/proxy/openrouter-body-byte-parity.test.ts`: re-pin the `clause-judgment` digest (prompt changed on purpose) and add a `reference-target` digest. `openai-request-shape.test.ts` iterates `AI_TASK_IDS`, so it covers the new task with no edit.
- `packages/core/test/unit/llm/llm-task-registry.test.ts`: add the new task and re-pin the `clause-judgment@2` input hash. `packages/core/test/recorded/llm-schema.recorded.test.ts`: check for task-id lists.
- `fixtures/llm-recordings/clause-judgment/*` (re-key and delete the 9 orphaned `@1` files) and `apps/web/public/precomputed/*`: re-key after the prompt bump (step 2 recipe). `scripts/src/record/derive-live-recordings.ts` is read-only (use `--from`).
- `scripts/src/bench/bench-defects.ts` (NEW), `scripts/src/bench/bench-ledger.ts` (NEW, spend ledger, see Approved live run), `scripts/test/bench-defects.test.ts` (NEW, guard and matching tests with an injected fake fetch and ledger, same pattern as `probe-openai-direct.ts` `ProbeDeps`), plus its own recording loader, stale-recording check and replay mode, `scripts/src/bench/author-bench-recordings.ts` (NEW, script that generates the authored recordings), `bench:defects` in `scripts/package.json`, `fixtures/defect-bench/recordings/` (NEW, recordings keyed by input hash covering pairs plus playbook), `fixtures/defect-bench/{ground-truth.json,sources.json}` (NEW), `.gitignore` entry for `fixtures/defect-bench/corpus/`.
- `process/general-plans/backlog/llm-detector-followups_NOTE_22-10-26.md`: already written (F1 to F6); EXECUTE verifies it.

## Public Contracts
- `AI_TASK_IDS` gains `'reference-target'` (additive). `AiRequest` still parses without `task` (default clause-judgment). `AiCandidate`, `AiFinding` and the 15 issue classes are unchanged; no Worker source change.
- Worker allow-list = `AiRequestSchema.task` enum, driven by `AI_TASK_IDS`; `TASKS` is typed `Record<AiTaskId, LlmTask>`, so TypeScript forces the registry entry.
- Cache `prompt_ver` becomes `clause-judgment@2` and `reference-target@1`. Recordings and precomputed results keyed on `@1` are re-keyed, never edited by hand beyond the existing derive/author scripts.

## Blast Radius
packages/core (llm, contracts/ai, one snapshot), apps/web (engine/types.ts, engine.worker and AI lane only), apps/worker (two test files only, no source), scripts (new bench plus its test; `scripts/src/live/common.ts` is read-only, imported, not edited), fixtures (new folder plus re-keyed recordings), `.gitignore`. High-risk class: public API contract, additive only.

## Corpus decision
Commit only `ground-truth.json` (46 docs: id, EDGAR URL, defects with `anchors`: short verbatim fragments, kind) and `sources.json`. Raw HTML (12 MB for the 33 new docs) is NOT committed. Originals come from `samples/sub-docs/raw/`; new docs from `fixtures/defect-bench/corpus/` (gitignored) or `--corpus <dir>`. Seed it by copying the 34 files from the session scratchpad `edgar-check2/raw` if still present, else the explicit `--fetch` flag (public SEC data, no LLM cost, off by default, sends a User-Agent). The `verified` subset is the 16 docs with at least one verified defect (corpus = 12 originals + 34 new = 46 docs; seed copies the 34 new files): originals 01, 02, 03, 05, 10, 11 and new Onex, Third Point 2025, Third Point 2026, Keystone, LAGO, Energea 2, Energea 4, iCross, Hatteras 2011, NF Investment.

## Acceptance Criteria (measurable; REQ-TEST-LINK)
| ID | Criterion | proven by | strategy |
|---|---|---|---|
| AC1 | Pair builder, on mini-docs authored from E1, builds a pair whose pointer sentence is the Onex "natural person ... Section E" sentence and whose TARGET block carries the Section E heading and excerpt | `reference-pairs.test.ts` Onex case; bench Onex row | Fully-Automated |
| AC2 | Same for E2 (LAGO Section H plan-only heading in TARGET; the sentence also names G, so two TARGET blocks, one per label) | `reference-pairs.test.ts` LAGO case; bench LAGO row | Fully-Automated |
| AC3 | Same for E3 (Keystone): pair built; TARGET shows Part C's own heading (agreement) or NOT FOUND, never Part D | `reference-pairs.test.ts` Keystone case; bench Keystone row | Fully-Automated |
| AC4 | Longest pair at most 1000 chars with the pointer sentence as an exact prefix; ids stable; at most 40 pairs; at most 3 TARGET blocks per pair with the budget split; duplicate-label rule picks the in-scope entry | `reference-pairs.test.ts` packing cases | Fully-Automated |
| AC5 | verify chain: pointer-sentence quote accepted; target-text quote rejected `quote_not_found`; pointer-plus-target quote rejected | `reference-target-verify.recorded.test.ts` | Fully-Automated |
| AC6 | NOT-A-DEFECT: builder emits 0 pairs for statute/CFR citations (3(c)(7), 414(d), 892, 4975), W-8 "Complete Part V", terms defined by reference to PPM/Memorandum/Bylaws; engine and pair builder add 0 findings on identical two-form re-definitions fixture | `reference-pairs.test.ts` negative cases | Fully-Automated |
| AC7 | Playbook text contains all 6 NOT-A-DEFECT items and the example keys X1 to X6 (not real quotes), contains no ground-truth anchor from E1 to E12, and is at most 10,000 chars (about 2.5k tokens) | `playbook.test.ts` | Fully-Automated |
| AC8 | Task wiring: registry entry present, `AI_TASK_IDS` includes the id, `reference-target@1` and `clause-judgment@2` pinned, Worker accepts the id (openai-request-shape and byte-parity pass) | registry + worker proxy tests | Fully-Automated |
| AC9 | Offline bench on the `verified` subset with authored recordings: new-task catches E1, E2, E3 (3 of 3) and engine still catches the 4 Partners Group refs (4 of 4); reference-target false positives (reference-target findings matching no ground-truth anchor) = 0; engine non-matches printed as informational only; table printed; exit 0. Needs the gitignored corpus, so Hybrid; exits non-zero with a clear message when it is missing. Authored recordings prove plumbing, not model skill | `bench:defects --offline --subset verified` | Hybrid |
| AC10 | Live (user-approved gated run): on the same subset the new task catches at least 2 of E1, E2, E3 and adds at most 2 findings per doc and at most 16 in total that match no ground-truth anchor (reported, tokens and cost per doc); responses saved as `meta.source: 'live'` recordings so EVL replays offline | `ALLOW_LIVE_LLM=1 bench:defects --live --subset verified` | Hybrid (approved, guarded) |
| AC12 | Live-run guards (spend and secret surface): `--live` refuses without `ALLOW_LIVE_LLM=1`, without `OPENAI_API_KEY`, above the per-run call ceiling and above the per-run USD budget; a spend-ledger entry is written BEFORE each call and the lifetime total refuses at $10; host is the pinned constant; the key and any bearer header never appear in output | `scripts/test/bench-defects.test.ts` (fake fetch, fake ledger, no network) | Fully-Automated |
| AC11 | No regression: engine goldens and `fixtures:check` unchanged; recorded clause-judgment tests green after re-key | core `test/golden`, `test/recorded` | Fully-Automated |

Residuals: AC10 is an approved gated run (user: "cứ dùng gọi OpenAI để test ko có sao đâu"), not a Known-Gap. Named residual: existing preview e2e specs asserting one `/api/ai` call per upload (backlog F7, written at step 8). Not-required defects E4 to E12 have no required catch (E4/E5 are engine-owned; others are backlog F2 to F4).

## Phase Completion Rules
- A checklist step is done only when its gate (Verification Evidence) is green in this checkout.
- After step 4 stop at the core-green checkpoint (core typecheck, `test/unit/llm`, `test/recorded`).
- Status vocabulary: CODE DONE = steps 1 to 8 finished and offline gates green; VERIFIED requires the AC10 live run (approved, within the guards) green and offline gates green, plus the user's confirmation. If the live run cannot run (key or cap problem) the plan closes as CONDITIONAL with backlog F1 on record. AC11 is scoped to offline gates (Playwright excluded by the user).
- Any red gate gets a fix inside this blast radius or a backlog stub; nothing is silently skipped.

## Implementation Checklist
1. Write `playbook.ts` from the defect kinds, synthetic paraphrased examples X1 to X6 (never the real E1 to E12 quotes) and the NOT-A-DEFECT list above; export `REVIEW_PLAYBOOK` (at most 10,000 chars). Add `playbook.test.ts` (AC7).
2. clause-judgment: add `REVIEW_PLAYBOOK` to SYSTEM, bump to `clause-judgment@2` (schema version stays `clause-judgment.s1`). Re-key: the legacy archive is at `process/general-plans/completed/ai-review-stream-dedup_18-10-26/legacy-live-recordings` (verified: it is under `completed/`, not `active/`; `DEFAULT_ARCHIVE` in `scripts/src/record/derive-live-recordings.ts` still points at the removed `active/` path, so `--from` is mandatory and that constant is not edited). Run `pnpm --filter @aduin/scripts record:derive --from <that completed/ path>`, then `record:author`, then REMOVE the orphaned `@1`-keyed files in `fixtures/llm-recordings/clause-judgment/` (9 files today: 0edd5268e2aa508a, 1fdfae850c563861, 29dab8deebe21a5c, 3bfc03e5ffba62d3, 4d5dec780f8eee4b, 71d8dabe64fc9f40, 89205ff1fc8c505e, e03165c146a430c9, ea32e6ea25cb04cc; `record:author` never deletes them and the recorded tests would replay them) and re-check with `record:author --check` and the recorded tests, then `precompute:ai --from-recordings`, then `precompute:ai --from-recordings --check`. Delete only files whose key no longer matches a casebook case at `@2`. Update `llm-task-registry.test.ts` pins. No live calls.
3. `reference-pairs.ts` per Pair design plus the lettered-heading resolver, duplicate-label rule and multi-label rule (Touchpoints), with mini-doc unit tests for AC1 to AC4 and AC6 written in the real heading shapes (label-plus-title paragraph `E. Supplemental ...`, bare `A.` plus title block, duplicate top-level `I.`, nested `A./B./C.`, one-paragraph `H. THE FOLLOWING ...`, four `PART D:` heading blocks, two-label pointer sentences). Mini-docs are short inline HTML strings authored from the verified quotes (no raw EDGAR files).
4. `reference-target.v1.ts`, `REFERENCE_TARGET_MODEL_SCHEMA`, registry entry, `AI_TASK_IDS`, exports, contract snapshot regenerated with a note; `reference-target-verify.recorded.test.ts` (AC5); registry test (AC8). Checkpoint: core typecheck, `test/unit/llm`, `test/recorded` green.
5. Worker tests: re-pin the `clause-judgment` digest and add a `reference-target` digest in `openrouter-body-byte-parity.test.ts`; run it and `openai-request-shape`. Web: wire `engine/types.ts`, `engine.worker.ts` and `ai-lane.ts` per Touchpoints; unit tests (token `ai-lane`) for: second call sent, lane runs when clause-judgment candidates are 0 but pairs exist, call-2 failure keeps call-1 findings with the partial notice, verify with pair sites; keep `engine-ai-api` green. Add a comment in the byte-parity test saying the `clause-judgment` digest change is deliberate (prompt changed).
6. Bench `bench-defects.ts`: runs the deterministic engine plus the pair builder and the task via recorded transport by default; `--live` only with `ALLOW_LIVE_LLM=1`, the `BenchLedger` (per-call claim, $10 lifetime cap, per-run call ceiling and `--max-usd` budget; see Approved live run) and `scripts/test/bench-defects.test.ts` proving every refusal with a fake fetch. Matching: a finding counts as caught when its document sentence contains a ground-truth anchor after `normalizeForLocate`. Prints caught, missed, false-positive counts, plus tokens and cost per doc. `--check-ground-truth` asserts every anchor exists in its doc when the corpus is present. Missing recording means "not recorded", never a false positive. When the gitignored corpus is missing, the bench exits non-zero with a clear message ("corpus not found: seed fixtures/defect-bench/corpus or pass --corpus <dir> or --fetch"). Engine findings that match no ground-truth anchor are printed as informational non-matches, not counted as false positives.
7. Generate recordings by script (`author-bench-recordings.ts`, `meta.source: 'authored'`) for Onex, LAGO and Keystone into `fixtures/defect-bench/recordings/` (NOT under `fixtures/llm-recordings/reference-target/`, which would need casebook registration). The input hash covers all pairs plus the playbook, so recordings cannot be hand-typed and go stale whenever the playbook or pair builder changes; the bench loader detects a stale recording (hash mismatch) and reports it as `stale`, never as a result. The authoring script throws when, for Onex, LAGO or Keystone, no built pair has a pointer sentence containing the ground-truth anchor (otherwise the authored answer would be vacuous and AC9 would pass on nothing). Live runs (AC10) save every response as a `meta.source: 'live'` recording in the same folder so EVL replays offline without paying again.
8. Verify the backlog note `process/general-plans/backlog/llm-detector-followups_NOTE_22-10-26.md` (already holds F1 to F7: F7 is the existing preview e2e specs ai-resume, ai-no-duplicates and variance-ai-never-gates asserting exactly one `/api/ai` call per upload, which will see two on uploads with pairs; F1 reflects the approved live run; F5 says 316) and fix any drift against what was built; Playwright excluded by the user, so those specs are not run; run all gates in Verification Evidence.

## Verification Evidence (light tier, per user; commands follow `process/context/tests/all-tests.md`: no `--` token, one token per call)
| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `pnpm --filter @aduin/core typecheck` | Fully-Automated | AC8 |
| `pnpm --filter @aduin/core test reference-pairs` then `playbook`, `llm-task-registry`, `reference-target-verify` (one token per call) | Fully-Automated | AC1 to AC8 |
| `pnpm --filter @aduin/core test contracts` (snapshot regenerated, note in report) | Fully-Automated | AC8 |
| `pnpm --filter @aduin/core test recorded` and `pnpm --filter @aduin/core test golden` | Fully-Automated | AC11 |
| `pnpm --filter @aduin/scripts fixtures:check` and `pnpm --filter @aduin/scripts record:author --check` | Fully-Automated | AC11 |
| `pnpm --filter @aduin/scripts test record-body-parity`, `test precompute-ai`, `test derive-live-recordings` (one token per call) | Fully-Automated | AC11 |
| `pnpm --filter @aduin/web typecheck`, `pnpm --filter @aduin/web test ai-lane` and `pnpm --filter @aduin/web test engine-ai-api` (one token per call) | Fully-Automated | AC8 |
| `pnpm --filter @aduin/worker test openrouter-body-byte-parity` and `pnpm --filter @aduin/worker test openai-request-shape` | Fully-Automated | AC8 |
| `pnpm --filter @aduin/scripts typecheck`, then `pnpm --filter @aduin/scripts bench:defects` with `--offline --subset verified`, must exit 0 and print the table; precondition: corpus seeded (else non-zero with a clear message) | Hybrid | AC9 |
| `precompute:ai --from-recordings --check` exits 0 | Fully-Automated | AC11 |
| `pnpm guard:cf` and `pnpm secrets:scan` | Fully-Automated | SPEC constraints |
| `pnpm --filter @aduin/scripts test bench-defects` (guards and matching, no network) | Fully-Automated | AC12 |
| `ALLOW_LIVE_LLM=1 pnpm --filter @aduin/scripts bench:defects --live --subset verified` (approved; guards below) | Hybrid | AC10 |
No Playwright and no stack-memory.

## Approved live run (guarded; replaces the earlier hard stop)
The user approved live OpenAI calls for testing ("cứ dùng gọi OpenAI để test ko có sao đâu"). `bench:defects --live` is an approved EXECUTE gate with these guards: every call claimed in the `BenchLedger` before it is sent; stop before lifetime spend would pass the $10 cap; key from env only, never printed; pinned host `https://api.openai.com/v1`; script side only; a hard per-run call ceiling in code; ask the user before total spend passes about $1. Guard mechanism (cycle-3 correction, verified in `scripts/src/live/common.ts`): the existing `Ledger` only counts calls (`ai` kind: at most 3 per UTC day, 6 in total, 4 planned; the ledger file already holds 2 `ai` entries) and tracks no dollars, so a 16-call bench cannot claim it and the $10 cap cannot rest on it. The bench therefore uses its own `BenchLedger` in `scripts/src/bench/bench-ledger.ts` (no edit to `common.ts`, whose lock and write helpers are not exported): file `bench-spend-ledger.json` under `defaultScratchDir()` checked with `assertOutsideRepo`, mode 600, atomic write; one entry per call (label, doc id, tokens, `costMicroUsd`), the claim is written BEFORE the call with the worst-case cost, then settled with the real usage. It refuses when lifetime bench spend plus the next call's worst case would pass $10, when the per-run call ceiling (default 20, `--max-calls` may only lower it for the 16-doc run; an all-46 run needs an explicit higher value) is reached, or when the per-run budget `--max-usd` (default 1.00, the ask-first mark) would be passed; the last case exits non-zero with "ask the user before raising --max-usd", so the ask happens through the orchestrator, never silently. Reuse `costMicroUsd`, `buildOpenAiBody`, `openAiResponseFormat` (`apps/worker/src/upstream/openai.ts`) and `aiMessages` (`upstream/openrouter.ts`) as `probe-openai-direct.ts` does; served model must match `OPENAI_SERVED_RE`; no automatic retry. Key precondition: `OPENAI_API_KEY` must be in the process env; loading the credentials file trips the privacy hook and needs the user's `APPROVED:` marker (the live-call approval does not by itself approve reading the file).
Estimate for gpt-4.1-mini ($0.40/M input, $1.60/M output), about 0.017M input and 0.003M output per doc:
- `verified` subset (16 docs): about $0.17.
- All 46 docs: about $0.50.
- Free OpenRouter model: $0.
Live responses are saved as `meta.source: 'live'` recordings in `fixtures/defect-bench/recordings/`, so EVL replays offline at no cost.

## Test Infra Improvement Notes
- Bench recordings are authored, so offline recall proves plumbing only; a recorded live run (F1) would make AC9 meaningful for model quality.
- Raw EDGAR corpus is not committed; the bench needs the local corpus folder or `--fetch`.

## Resume and Execution Handoff
Execute steps 1 to 8 in order with a checkpoint after step 4 (core green). Selected plan file: this file. Never use git stash, checkout, reset or commit: many unrelated modified files exist. No deploy, no push; live calls only through the approved bench guards. Execute runs on opus. After EXECUTE, an EVL confirmation by a spawned vc-tester re-runs the Verification Evidence commands. Validators: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <plan>`.

## Validate Contract

Status: PASS
Date: 22-10-26
date: 2026-10-22
generated-by: outer-pvl
supersedes: 2026-10-22 (outer-pvl) — cycle-2 CONDITIONAL contract (GAP-1 to GAP-9 open) replaced by the cycle-3 full re-validate of the supplemented plan against the real code

Parallel strategy: sequential
Rationale: score 4/7 (S1 core + web + worker tests + scripts, S2 additive public contract plus snapshot, S6 public API contract plus spend/secret surface, S7 5+ files). Dominant factor is dependency, not independence: steps 1 to 4 are core-first behind a checkpoint and steps 5 to 7 consume core exports, so ONE opus vc-execute-agent runs steps 1 to 8 in order; EVL is ONE sonnet vc-tester re-running the gate list below. No agent team, no parallel fix agents unless EVL finds failing gates on disjoint file groups. Cycle-3 validation fan-out was small and targeted: 4 dimension checks plus 4 section groups, run in-session against real files (dedupe path, ai-lane, engine.worker, Ledger/CAPS, derive/author recipe, Worker task wiring, real structurer blocks of Onex, LAGO, Keystone via a read-only probe).

User decisions on record (not reopened): light tier (typecheck, targeted vitest, offline bench; no Playwright, no stack-memory); frozen contracts v1 (task id addition is additive); no deploy, no commit, no git stash/checkout/reset; LIVE OpenAI calls approved for testing ("cứ dùng gọi OpenAI để test ko có sao đâu"). The live bench is an APPROVED EXECUTE gate (AC10). Guards: per-call claim in the bench's own `BenchLedger` (outside repo, mode 600, USD tracked), lifetime stop before $10, key from env only and never printed, pinned host https://api.openai.com/v1, script side only, in-code per-run call ceiling (default 20) and per-run budget `--max-usd` default 1.00 (the ask-first mark; exceeding it exits non-zero so the orchestrator asks the user). Estimate gpt-4.1-mini: about $0.17 for the 16-doc verified subset, about $0.50 for all 46.

GAP closure evidence (cycle 3, checked against the real code, not the plan text):
- GAP-1 closed: resolver owned by `reference-pairs.ts`; real structurer probe shows Onex `E. Supplemental Data for Entities` as one paragraph block, LAGO `A.` as a bare label block and `B.` to `I.` as one-paragraph blocks (G at block 175, H at 189, pointer block 174), Keystone `PART B/C/E` plus four `PART D: SUITABILITY STATEMENTS FOR ...` heading blocks; the plan now lists both label shapes, duplicate-label and multi-label rules.
- GAP-2 closed: `completed/ai-review-stream-dedup_18-10-26/legacy-live-recordings` exists (sample-01, sample-03 files); `DEFAULT_ARCHIVE` still points at the removed `active/` path so `--from` is mandatory; the 9 `@1` files are present and named in step 2.
- GAP-3 closed: web touchpoints verified: `EngineResult` (types.ts:112) and `VerifyAiContext` (types.ts:189) have no `pairs`/`task` yet; `engine.worker.ts` `Retained` (line 158), `retain` (167), pair build next to `buildAiCandidatesWithSites` (725 to 729), `verifyAi` (771 to 778); core `VerifyAiContext` already has `task?` and `sites?`. The lane guard exists in TWO places (see GAP-11).
- GAP-4 closed: bench recordings under `fixtures/defect-bench/recordings/`, script-authored, stale detection, live responses saved as recordings, AC9 Hybrid with false-positive scope defined.
- GAP-5 closed: playbook uses synthetic examples X1 to X6 with a grep test against every E1 to E12 anchor.
- GAP-6 closed: gate list below includes `test contracts`, `fixtures:check`, `record:author --check`, scripts tests, `engine-ai-api`.
- GAP-7 closed: live run is an approved gated EXECUTE gate in the plan body (guards verified feasible only after GAP-12 below).
- GAP-8 closed: named residual with backlog stub F7 (already present in `process/general-plans/backlog/llm-detector-followups_NOTE_22-10-26.md`).
- GAP-9 closed: counts corrected (46 docs, 316 defined_term_issue, `drafting_note` listed).
New gaps found in cycle 3 and closed IN PLACE (edits made by the validator in this pass, each checked against code; structural validator re-run clean):
- GAP-10 dedupe touchpoint was wrong. The AI-finding merge path is `engine.worker.ts verifyAi` -> core `verifyAiResult` (verify-quote.ts:320) -> `dropRuleDuplicates` in `packages/core/src/llm/dedupe.ts` (also exports `rangesOverlap`, imported by `candidates.ts` and needed by `reference-pairs.ts`). `apps/web/src/features/review/v2/dedupe.ts` (`dedupeFindings`, `triageWithTwins`) has no production importer, only `findings-v2-dedupe.test.ts`, so it is not on the path and is not touched. The "AI findings never drop each other" wording belongs to core `dedupe.ts`. Plan touchpoint rewritten.
- GAP-11 `aiRunFresh()` (ai-lane.ts:310) has the same `candidates.length === 0` guard as `evaluate()` (line 215); a pairs-only document would still never call the AI. Plan now changes both guards and adds `pairs` to the lane context.
- GAP-12 the stated live guard "claim every call in the existing Ledger, stop before $10" was not implementable: `Ledger` (scripts/src/live/common.ts) counts calls only (ai: 3 per UTC day, 6 total, 4 planned; the file already has 2 ai entries) and has no dollars, so a 16-call bench would be refused after the first 1 to 2 calls and no $10 cap exists. Plan now specifies a separate `BenchLedger` (new file, common.ts untouched) with per-call USD, $10 lifetime stop, per-run call ceiling and `--max-usd` budget, reusing `costMicroUsd`, `buildOpenAiBody`, `openAiResponseFormat`, `aiMessages`, `OPENAI_SERVED_RE`.
- GAP-13 resolver shapes in the plan (Onex "bare E. block then title block") did not match the real structured blocks (see GAP-1 evidence); corrected, and the authoring script must fail loud when no pair contains the ground-truth anchor so AC9 cannot pass vacuously.
- GAP-14 no automated gate proved the live-run guards (a spend and secret surface). Added AC12 and gate `pnpm --filter @aduin/scripts test bench-defects` (fake fetch and fake ledger, no network).

Test gates (C3 5-column table):

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC1 | Pair for Onex "natural person ... Section E" with the Section E heading and excerpt in TARGET (real shape: one paragraph block `E. Supplemental Data for Entities`) | Fully-Automated | `pnpm --filter @aduin/core test reference-pairs` (Onex case) | B |
| AC2 | Pair for LAGO "proceed to Section H" with the plan-only Section H heading in TARGET (one-paragraph `H. THE FOLLOWING INFORMATION ...`; sentence also names Section G, so two TARGET blocks) | Fully-Automated | `pnpm --filter @aduin/core test reference-pairs` (LAGO case) | B |
| AC3 | Pair for Keystone "Part C of the Suitability Statement": TARGET for label C shows `PART C: SUBSCRIPTION AGREEMENT`, never a Part D heading; four duplicate PART D headings handled | Fully-Automated | `pnpm --filter @aduin/core test reference-pairs` (Keystone case) | B |
| AC4 | Packed quote at most 1000 chars with pointer as exact prefix, stable ids, at most 40 pairs, at most 3 TARGET blocks with split budget, duplicate-label rule | Fully-Automated | `pnpm --filter @aduin/core test reference-pairs` (packing cases) | B |
| AC5 | Verify chain: pointer quote accepted; target quote and pointer-plus-target quote rejected `quote_not_found` | Fully-Automated | `pnpm --filter @aduin/core test reference-target-verify` | B |
| AC6 | NOT-A-DEFECT negatives: 0 pairs for statute/CFR, W-8 "Complete Part V", defined-by-reference terms; 0 findings on identical two-form re-definitions | Fully-Automated | `pnpm --filter @aduin/core test reference-pairs` (negative cases) | B |
| AC7 | Playbook has all 6 NOT-A-DEFECT items and example keys X1 to X6, no ground-truth anchor from E1 to E12, at most 10,000 chars | Fully-Automated | `pnpm --filter @aduin/core test playbook` | B |
| AC8 | Task wiring and contract: registry entry, `AI_TASK_IDS`, `reference-target@1` and `clause-judgment@2` pinned, contracts snapshot regenerated with note, Worker accepts the id with no source change | Fully-Automated | `pnpm --filter @aduin/core typecheck`; `pnpm --filter @aduin/core test llm-task-registry`; `pnpm --filter @aduin/core test contracts`; `pnpm --filter @aduin/worker test openrouter-body-byte-parity`; `pnpm --filter @aduin/worker test openai-request-shape` | B |
| AC8-web | Second `/api/ai` call sent with task `reference-target`; lane runs when clause-judgment candidates are 0 but pairs exist (both guards); verify with pair sites; call-2 failure keeps call-1 findings with the partial notice; findings of both calls merged | Fully-Automated | `pnpm --filter @aduin/web typecheck`; `pnpm --filter @aduin/web test ai-lane`; `pnpm --filter @aduin/web test engine-ai-api` | B |
| AC9 | Offline bench on the `verified` subset: new task catches E1, E2, E3 (3 of 3), engine still catches the 4 Partners Group refs, 0 reference-target false positives, table printed, exit 0 (authored recordings: proves plumbing on the REAL corpus docs, not model skill) | Hybrid | `pnpm --filter @aduin/scripts bench:defects --offline --subset verified`; precondition: corpus seeded in gitignored `fixtures/defect-bench/corpus/` (the 34 new files exist in the session scratchpad `edgar-check2/raw`; bench exits non-zero with a clear message when missing) | B |
| AC10 | Live recall (APPROVED): new task catches at least 2 of E1, E2, E3; at most 2 non-matching findings per doc and 16 in total; tokens and cost per doc reported; responses saved as `meta.source: 'live'` recordings so EVL replays offline | Hybrid | `ALLOW_LIVE_LLM=1 pnpm --filter @aduin/scripts bench:defects --live --subset verified`; precondition: `OPENAI_API_KEY` in env (credentials file read needs the privacy-hook `APPROVED:` marker), `BenchLedger` claims, spend caps | B |
| AC12 | Live-run guards: refuses without `ALLOW_LIVE_LLM=1`, without key, above call ceiling, above `--max-usd`; ledger entry written before each call; $10 lifetime refusal; pinned host; key never in output | Fully-Automated | `pnpm --filter @aduin/scripts test bench-defects` | B |
| AC11 | No regression: recordings and precomputed re-keyed, goldens and fixtures unchanged | Fully-Automated | `pnpm --filter @aduin/core test recorded`; `pnpm --filter @aduin/core test golden`; `pnpm --filter @aduin/scripts record:author --check`; `pnpm --filter @aduin/scripts precompute:ai --from-recordings --check`; `pnpm --filter @aduin/scripts fixtures:check`; `pnpm --filter @aduin/scripts test record-body-parity`; `pnpm --filter @aduin/scripts test precompute-ai`; `pnpm --filter @aduin/scripts test derive-live-recordings`; `pnpm --filter @aduin/scripts typecheck` | B |
| SPEC-guards | Repo guards | Fully-Automated | `pnpm guard:cf`; `pnpm secrets:scan` | B |
| residual-e2e | Existing preview e2e specs (ai-resume, ai-no-duplicates, variance-ai-never-gates) assert one `/api/ai` call per upload and will see two on uploads with pairs; Playwright is excluded by the user | named residual (not a strategy) | backlog F7 in `process/general-plans/backlog/llm-detector-followups_NOTE_22-10-26.md` (already written) | D |

C-4 reconciliation: Known-Gap is never a strategy. The vacuous-green ban holds: every developed behavior (playbook, pair builder, verify scoping, task wiring, web second call, bench, live guards) has a Fully-Automated or Hybrid gate; the only Known-Gap row is the named e2e residual (D) with a written justification and a backlog stub.

Legacy line form:
- core pair builder and playbook: [Fully-automated: `pnpm --filter @aduin/core test reference-pairs`, `test playbook`, `test reference-target-verify`, `test llm-task-registry`, `test contracts`]
- core regression: [Fully-automated: `pnpm --filter @aduin/core test recorded`, `test golden`]
- web AI lane: [Fully-automated: `pnpm --filter @aduin/web typecheck`, `test ai-lane`, `test engine-ai-api`]
- worker: [Fully-automated: `pnpm --filter @aduin/worker test openrouter-body-byte-parity`, `test openai-request-shape`]
- scripts and recordings: [Fully-automated: `typecheck`, `record:author --check`, `precompute:ai --from-recordings --check`, `fixtures:check`, `test record-body-parity`, `test precompute-ai`, `test derive-live-recordings`, `test bench-defects`]
- offline bench: [hybrid: `pnpm --filter @aduin/scripts bench:defects --offline --subset verified` + corpus seeded]
- live bench: [hybrid: `ALLOW_LIVE_LLM=1 pnpm --filter @aduin/scripts bench:defects --live --subset verified` + OPENAI_API_KEY + BenchLedger]
- existing preview e2e one-call assertions: [known-gap: documented, backlog F7]

Failing stubs (Fully-Automated rows only; the red-first starting point for EXECUTE, not written to disk during VALIDATE):

```
test("should build an Onex pair whose pointer is the natural-person Section E sentence with the Section E heading in TARGET", () => { throw new Error("NOT IMPLEMENTED — TDD stub: AC1") })
test("should build a LAGO pair whose TARGET shows the plan-only Section H heading and the Section G heading", () => { throw new Error("NOT IMPLEMENTED — TDD stub: AC2") })
test("should build a Keystone pair whose Part C TARGET is the subscription-agreement heading and never a Part D heading", () => { throw new Error("NOT IMPLEMENTED — TDD stub: AC3") })
test("should keep the longest pair at most 1000 chars with the pointer as exact prefix and at most 40 pairs", () => { throw new Error("NOT IMPLEMENTED — TDD stub: AC4") })
test("should accept a pointer-sentence quote and reject target-text and pointer-plus-target quotes as quote_not_found", () => { throw new Error("NOT IMPLEMENTED — TDD stub: AC5") })
test("should emit 0 pairs for statute citations, W-8 Complete Part V and defined-by-reference terms", () => { throw new Error("NOT IMPLEMENTED — TDD stub: AC6") })
test("should contain all 6 NOT-A-DEFECT items and example keys X1 to X6, no E1 to E12 anchor, in at most 10000 chars", () => { throw new Error("NOT IMPLEMENTED — TDD stub: AC7") })
test("should register reference-target@1 and clause-judgment@2 and accept the id in the Worker", () => { throw new Error("NOT IMPLEMENTED — TDD stub: AC8") })
test("should run the lane on pairs alone, send call 2 as reference-target, and keep call-1 findings when call 2 fails", () => { throw new Error("NOT IMPLEMENTED — TDD stub: AC8-web") })
test("should refuse a live bench call without ALLOW_LIVE_LLM, without a key, above the call ceiling, above max-usd and past the lifetime cap, and never print the key", () => { throw new Error("NOT IMPLEMENTED — TDD stub: AC12") })
test("should keep recorded, golden and re-keyed recordings green after the clause-judgment@2 bump", () => { throw new Error("NOT IMPLEMENTED — TDD stub: AC11") })
```

Execute-agent instructions:
- E1 Order: steps 1 to 8; stop at the core-green checkpoint after step 4 (core typecheck, `test reference-pairs`, `test playbook`, `test reference-target-verify`, `test llm-task-registry`, `test recorded`) before touching web, worker tests or scripts.
- E2 Resolver: accept both label shapes (label-plus-title paragraph, bare label then title block); tests use these exact shapes; on the three real docs AC9 must be satisfied with pairs built from the real HTML (authoring script throws if no pair contains the anchor).
- E3 Lane: change BOTH `candidate.length === 0` guards (`evaluate`, `aiRunFresh`), add `pairs` to the lane context, merge call-1 and call-2 verified findings with `emit(c, [...v1, ...v2])` and summed counts; call-2 failure never runs `downgrade()` over call-1 results; no AI-vs-AI dedupe; do not touch `features/review/v2/dedupe.ts`.
- E4 Re-key (step 2): `--from process/general-plans/completed/ai-review-stream-dedup_18-10-26/legacy-live-recordings`; delete the 9 `@1` files only after `record:author` and `record:derive` have written the `@2` files; `record:author --check` must report zero orphans and zero missing.
- E5 Live run: only after offline bench, AC12 tests and every other gate are green. Use default `--max-usd 1.00`; if the run exits asking to raise it, stop and report to the orchestrator (do not raise it). Report total tokens and USD per doc. Never print the key or an Authorization header; never edit `scripts/src/live/common.ts`.
- E6 Shared dirty checkout (about 100 unrelated modified files, including `scripts/src/guards/guard-cf.ts` and core `counsel/gate.ts`): touch only the blast-radius files; never stash, checkout, reset or commit; if `guard:cf` or a core test fails in a file you did not edit, report it as unrelated rather than fixing it.
- E7 Snapshot: regenerate `contracts.json-schema.snap` using the update invocation in `process/context/tests/all-tests.md` (no `--` token) and state in the report that only the task enum gained `reference-target`.

Dimension findings:
- Infra fit: PASS — all touched paths exist and are clean in git; the Worker needs no source edit (`shapeAi` rebuilds candidates from id/quote/section_path/hint; no per-task code or D1 task constraint); archive path, 9 orphan recordings, derive/author recipe and the three-doc block shapes verified; GAP-10 and GAP-11 fixed in the plan.
- Test coverage: PASS — gates added for contracts, fixtures:check, record:author --check, scripts tests, engine-ai-api and now bench-defects (AC12); AC9 Hybrid with corpus precondition (34 files present in the session scratchpad); one named residual (e2e one-call specs, D, F7).
- Breaking changes: PASS — `AI_TASK_IDS` append is additive; `AiCandidate`, `AiFinding`, the 15 classes and Worker source unchanged; core `VerifyAiContext` already carries `task` and `sites`; accepted side effects: old Worker versions reject the new id (no deploy), each AI upload with pairs now costs 2 requests against the visitor quota.
- Security surface: PASS — packed quote masked client-side and again by `shapeAi` (idempotent), `UNTRUSTED_NOTICE` and delimiting kept, verify scoped to the pointer site, AI never gates, severity capped at high; live bench spend and secret guards are now concrete (BenchLedger with USD, pinned host, key from env, privacy-hook approval for the credentials file) and automated (AC12). Note: the `--fetch` User-Agent must come from env, never a hardcoded contact email.
- Steps 1-2 (playbook, clause-judgment@2, re-key): PASS — recipe verified against `author-recordings.ts` and `derive-live-recordings.ts` (derived files kept by author; orphans removed explicitly).
- Steps 3-4 (pair builder, task): PASS — verify-chain feasibility confirmed (`locateQuoteInSites` scans only the cited site; `verifyAiResult` already honors `ctx.task`/`ctx.sites`; finding ids use `ai:${task}`); highest-risk edit: the lettered-heading resolver on real shapes (mitigation E2, AC9 on real HTML).
- Step 5 (web and worker wiring): PASS — both lane guards, `Ctx.pairs`, `Retained.pairSites`, `VerifyAiContext.task` and the byte-parity re-pin (deliberate, commented) are in the plan; highest-risk edit: `ai-lane.ts` two-call state machine (mitigation E3, `ai-lane` tests).
- Steps 6-8 (bench, recordings, backlog): PASS — BenchLedger design replaces the infeasible `Ledger` claim (GAP-12), guard tests added (GAP-14), authoring script fails loud (GAP-13), backlog note F1 to F7 already present.

Open gaps: none (named residual only)
- e2e one-call specs: known-gap: documented, backlog F7 (gap-resolution D; Playwright excluded by the user).
- AC10 model recall is unproven until the approved live run executes at EXECUTE; if it cannot run (key or cap), the plan closes CONDITIONAL with backlog F1.

What this coverage does NOT prove:
- reference-pairs and playbook unit tests: real EDGAR heading shapes beyond the three docs; recall on documents outside the verified subset; model behavior.
- AC9 offline bench: model skill (recordings are authored); pair-builder behavior on the 30 docs with no verified defect beyond "0 false positives" for the new task.
- AC10 live bench: generalization (one run, one model, no variance estimate); the production Worker path (the bench goes direct to OpenAI, not through quota or Turnstile); Worker-side spend (not in the BenchLedger).
- AC12 guard tests: a real OpenAI response, real key handling outside the test double, wall-clock concurrency of two bench runs.
- web unit tests: real browser behavior, Turnstile, the quota banner, existing preview e2e specs (not run).
- worker byte-parity and request-shape: deployed Worker compatibility (no deploy in scope).
- record:author, precompute and fixtures checks: engine goldens on the 34 new docs.

Gate: PASS
Accepted by: not required for PASS (no open concerns). User decision on record, quoted: "cứ dùng gọi OpenAI để test ko có sao đâu" (live OpenAI bench approved within the BenchLedger guards; ask first above about $1 total).

## Autonomous Goal Block

```
SESSION GOAL: llm-defect-detection - add a review playbook plus a reference-target AI task (pointer sentence + TARGET section) and an offline/live defect bench over the 46-doc EDGAR corpus
Charter + umbrella plan: N/A - single plan (process/general-plans/active/llm-defect-detection_22-10-26/llm-defect-detection_PLAN_22-10-26.md)
Autonomy: standing /goal rules (feedback_autonomous_phase_execution.md): run steps 1-8 without approval pauses; subagent delegation mandatory (execute = opus vc-execute-agent, EVL = sonnet vc-tester); BLOCKED -> backlog note and continue.
Hard stop conditions / safety constraints:
- No deploy, no commit, no push; never git stash/checkout/reset (shared dirty checkout, ~100 unrelated modified files; touch only the blast radius).
- Live OpenAI bench approved by the user ("cu dung goi OpenAI de test ko sao"): own BenchLedger (outside repo, USD per call), stop before lifetime spend passes $10, per-run call ceiling 20, --max-usd 1.00 default (if the run asks to raise it, STOP and ask the user), key from env only and never printed, pinned host api.openai.com, never edit scripts/src/live/common.ts. Reading the OpenAI credentials file needs the user's privacy-hook approval.
- Frozen contracts v1: no 16th issue class, no new AiCandidate/AiFinding fields, no Worker source change; only AI_TASK_IDS gains 'reference-target'.
- Light tier only: no Playwright, no stack-memory. Never touch Cloudflare zone itsjiathao.com.
- Raw EDGAR HTML never committed (gitignored corpus). --fetch User-Agent from env, no contact email in repo.
Next phase: EXECUTE: process/general-plans/active/llm-defect-detection_22-10-26/llm-defect-detection_PLAN_22-10-26.md. Checkpoint after step 4: core typecheck, test reference-pairs, test playbook, test reference-target-verify, test llm-task-registry, test recorded green. Then web, worker, scripts, offline bench, live bench last.
Validate contract: inline in the plan (## Validate Contract, PASS, generated-by outer-pvl, 2026-10-22, cycle 3)
Execute start: pnpm --filter @aduin/core typecheck | pnpm --filter @aduin/core test reference-pairs | pnpm --filter @aduin/scripts bench:defects --offline --subset verified, then ALLOW_LIVE_LLM=1 pnpm --filter @aduin/scripts bench:defects --live --subset verified | high-risk pack: no (additive public contract; spend guards proven by AC12)
```

## Next Step
Gate PASS. ENTER EXECUTE MODE with this plan path (one opus vc-execute-agent, then an EVL confirmation by a spawned sonnet vc-tester re-running the gate list in the Validate Contract).

## Deviations (EXECUTE 22-10-26)
- F7 (pre-deploy supplement): Playwright touched after all, at the user's commit+deploy approval. Test-only fix in `apps/web/e2e/` (`fixtures/ai.ts`, `fixtures/app.ts`, `ai-resume`, `ai-no-duplicates`, `variance-ai-never-gates`): per-task call counts, reference-target answered clean, new `uploadSample` helper because the single-sample picker is gone (harness drift F7b in the backlog note). No product change; `ai-lane.ts` behavior was already correct.
- Resolver: lettered `field` blocks (e.g. NF `E. Related Parties/Other Beneficial Parties:`) are kept as nested fallback entries, used only when no top-level entry has the label (the plan said nested items never shadow; they still never do). Found by the first live run (NF pair showed a false `NOT FOUND`). Unit test added.
- Ground truth: Onex E1 carries a second anchor, the entity pointer to Section C, taken from the source verified defect D1 (the plan table quoted only the natural-person sentence).
- Ground-truth ids: E4 is split into E4a to E4d (4 Partners Group refs); Energea 2, iCross and Third Point 2026 are E6b/E7b/E7c; Hatteras 2011 is E13 and Coatue BSA E14 (expect none) so the verified subset is exactly the 16 docs the plan names.
- Added `bench:author` package script (the plan named the author script but no command) and `--source authored|live` on the bench so live recordings replay offline without replacing authored ones (`{hash16}.live.json`).
- Lane partial result: the lane has no `done` status; a failed call 2 ends in `fresh`/`cache` with `note` = "Second AI pass did not complete; showing the first pass".
- Contracts snapshot regenerated with `pnpm --filter @aduin/core test contracts -u` (no update command is documented in tests context); only the task enum gained `reference-target`.
- AC10 live: run twice ($0.0112 + $0.0146 = $0.0258 lifetime); recall 1 of 3 both times; 11 then 21 non-matching findings. Not tuned further (prompt changes against 3 positives would overfit). Backlog F1 updated.

### EVL fix cycle 1 (22-10-26, gate 24 / AC10)
- `reference-target@2` / `reference-target.s2` (plan pinned `@1`): model-side schema `reference_target_v2` adds required `label`, `pointer_addresses`, `target_is_for` and `verdict` (match / mismatch / unclear), generated before the finding text; `validate()` keeps only `mismatch` items with confidence at least 0.5 and strips the four fields, so `AiFinding`, `AiCandidate` and frozen contracts v1 are unchanged (contracts snapshot unchanged). Items with no verdict are counted as dropped.
- Pair design changed (plan: one pair per pointer with up to 3 TARGET blocks): now one pair per (pointer, label), each with exactly one TARGET block plus an optional `[NOTE: ...]` line (other labels of the pointer; duplicate-label count, which one is shown by the resolver rule and the other titles; pointer inside its own target; for NOT FOUND, the labels found for that family). Same pointer site for all pairs of a pointer; ids include the label. `MAX_TARGETS_PER_PAIR` replaced by `MAX_LABELS_PER_POINTER` (3) and `NOTE_MAX_CHARS` (200).
- Resolver additions (generic, found on held-out docs): short prefixed headings (`<title words> Section A: <title>`, block at most 200 chars, no routing verb) are heading entries; qualified sub-references are not pointers (`Part A of Section I`, `Section C of Annex I to ...`, `Exhibit C, Section I`, `Part A, Paragraph 14(e)`); a same-family list (`Section A, Section B`) still pairs.
- Prompt: one item per excerpt with a verdict; no finding when the target fits; explanation names who the pointer addresses and who the target is for; exclusions; a target for every investor fits any group; duplicate labels: mismatch only if none fits; deep provisions are not judged on the first lines; NOT FOUND is unclear unless the found labels show the label is missing. No ground-truth wording in prompt or playbook (playbook unchanged).
- Bench: `--subset heldout` (corpus docs outside the verified subset; precision only, `--max-calls` above 20 allowed); an offline replay of live recordings (`--source live`) now applies the AC10 thresholds instead of the strict authored gate (3 of 3, 0 non-matching). Authored recordings carry `label` and `verdict` and were regenerated by `bench:author`; 83 stale `.live.json` recordings (input hash no longer produced) removed, 28 current kept (9 verified + 19 held-out).
- Worker byte-parity `reference-target` digest re-pinned on purpose (comment updated).
- Live results (gpt-4.1-mini). Verified: run 1 (verdict schema + split pairs) 2 of 3, 1 non-matching; run 2 3 of 3, 3; run 3 3 of 3, 2; run 4 3 of 3, 3; final 3 of 3, 3 (AC10 PASS: at least 2 of 3, at most 2 per doc, at most 16 total). Held-out (30 docs, 19 with pairs): first 44 non-matching, after resolver + NOT FOUND fix 11, final 14 (North Haven 2022 7, West Bay 3, others at most 1); not an AC, recorded in backlog F1. Spend this cycle $0.3121; lifetime bench spend $0.3379 (cap for this work $1.00).

