---
name: report:variance-mvp-research
description: "RESEARCH findings for variance management slim MVP (V1+V2): reusable diff/graph/counsel/memory machinery, Intake dependency (observed vs assumed), collision map, test gates, risks"
date: 17-10-26
metadata:
  node_type: memory
  type: report
  feature: variance-management
  phase: RESEARCH
---

# RESEARCH: Variance management slim MVP (V1 + V2)

```yaml
context-envelope:
  feature: variance-management
  phase: RESEARCH
  session-goal: Findings for INNOVATE/PLAN of SPEC AC-V1..AC-V20 (variance-mvp, planning only, no EXECUTE)
  branch: main
  worktree: main
  context-group: engine, worker, tests, ui (all-context routing)
  blast-radius-packages: packages/core (diff/, counsel/, contracts/memory, memory/), apps/web (review, counsel, compare, gate, state, api, storage), apps/worker (migrations, routes/memory, memory/repo), scripts (fixtures), fixtures/
  active-plan: none (SPEC only)
  test-runner: vitest | playwright
  validate-contract: none
```

## BLUF

- Reusable: the diff engine already aligns sections and gives word-level old/new text, rename-aware definitions/fees/requirements, and runs in the engine worker. It has **no change classification (new / changed_logic / changed_cosmetic), no owner, no impact, and no "raw change = 214" notion**. All four are new, additive code.
- The gate, counsel sheet, triage, answers and the D1 memory model are **all keyed by a `Finding` (id, issue_class, severity, fingerprint)** and a frozen 15-value `issue_class` enum. Variance change rows are not findings today. This is the central integration decision for INNOVATE.
- Answer **intent and scope, owner, regression assertion** have no storage anywhere (browser Dexie, D1, frozen contracts). Persisting them needs a migration 0006, additive contract changes (snapshot regeneration with note), stub + real memory API + outbox changes, and new audit actions.
- **Intake has produced no code and no INNOVATE/PLAN yet** (only SPEC and a goal block, HEAD 025d589, clean tree). Its package/role data model is therefore unobserved; the baseline-role API Variance consumes is entirely assumed.
- **The demo fixtures do not exist.** There is no Hartwell & Crane Fund II/III fixture, and no `hartwell-crane` law firm (only `partners-group`, `firm-x`, `firm-y`). The "214 raw → 7 shown" number exists only in the HTML mockup. A same-firm real pair does exist: samples #5/#6 (and #3/#4), firm `partners-group`.
- No LLM is required by the SPEC (all variance output is deterministic); AC-V9 / AC-V15 only need a recorded-AI contradiction test and an optional labelled intent draft. Live budget (6 calls, 3/UTC day) can stay at 0.

## Scope and Blast Radius

In scope (read): SPEC AC-V1..V20, L1-L10; UI notes + mockup; Intake SPEC/goal block; core diff/graph/investor/structure-view/counsel/findings/contracts/memory; web review/counsel/compare/gate/state/api/storage; worker migrations 0001-0005 and memory routes; test/context docs.

Likely touched by Variance (for PLAN): `packages/core/src/diff/` (or new `variance/` dir, barrel append in `src/index.ts`), `contracts/memory.ts` (additive), `counsel/{gate,sheet,types}.ts`, `findings/{schema,taxonomy}` (only if change rows become findings), `config/` (rules config), `memory/firms.ts` + `fixtures/memory/law-firms.json` + migration 0003-style seed (firm), `apps/worker/migrations/0006_*`, `apps/worker/src/{memory/repo,routes/memory,platform}`, `apps/web/src/{state/review.ts,features/review/*,features/counsel/*,features/compare/*,features/gate/*,api/*,storage/db.ts,engine/*}`, `scripts/src/fixtures/build-seeded.ts`, `fixtures/`.

Out of scope: Tier 2 baselines, first-review groups, cross-doc mismatch, config UI, generalized regression checks, 3-state gate, new screens (SPEC L7/L4).

## Key Facts

1. **Core diff output** (`packages/core/src/diff/types.ts:204-218`): strict `DiffResultSchema` with `sections[]` (status added/removed/renamed/moved/changed/same, `segments` word-level `same/del/add/gap`, `a`/`b` raw excerpts + `sensitiveSpans`, `truncated`), `definitions`, `requirements`, `fees`, `renames`, `possibleLeftovers`, `findingsDelta {fixed,stillPresent,new}`. No timing field. `diffDocuments` (`diff/index.ts:212`) is pure and deterministic.
2. **Alignment unit** = scope preamble / section / part (`align.ts:20-34`, `buildUnits` `align.ts:51`). Granularity is section-level. #5 vs #6 yields only 32 units (changed 21, removed 1, renamed 1, same 9; `all-engine.md` Phase 07 table). "214 raw changes" therefore cannot be a unit count; it must be a token/segment/paragraph metric that PLAN has to define.
3. **Rename inference** (`rename-inference.ts`; `all-engine.md:108`) already isolates term swaps (Member→Shareholder 4/4, Memorandum→Prospectus 8/8, Units→Shares 29/35, Placement Fee→Sales Load 3/3). `diffDefinitions/diffRequirements` are rename-aware so a rename alone does not read as a change (`diff/index.ts:150-151`). This is the natural cosmetic signal for AC-V7 (Units→Shares).
4. **Fees** (`extract-fees.ts`): #5→#6 gives 0.85% A same, 0.25% S same, 3.5% (no class)→3.5% Class A changed, 1.5% Class S added: the natural `changed_logic` signal for "class-specific fees".
5. **Appendix C removal** is already `sections[].status='removed'` key `appendix:c` (`all-engine.md` pinned goldens).
6. **Frozen-contract rules**: additive only; `packages/core/test/__snapshots__/contracts.json-schema.snap` (67 schemas) regenerated only with a change note (`all-engine.md:53-63`). The snapshot's module list does **not** include `diff/` (covered by `diff-contract`), so new diff/variance types do not move the snapshot; changes to `contracts/memory.ts` do.
7. **Gate** (`counsel/gate.ts:43-51`): iterates findings; `isGating` = `severity==='critical' && detector_kind!=='ai'` (`gate.ts:35`); reasons kinds `open|unanswered|unclear|awaiting_counsel|reconfirm_required`. Only critical findings gate today. Untriaged changes / asked-without-answer for non-critical rows are **not** representable.
8. **Everything keys on `Finding.id`**: `Triage` in Dexie `uiState` `triage:{docId}` (`state/review.ts:313-337`), question ids `questions:{docId}` (`counsel/question-ids.ts`), counsel drafts `counsel:{docId}` (`counsel-store.ts:27`), `computeGate(rows)` (`review/model.ts:113`), `buildSheet` (`counsel/sheet-model.ts:97`), the gate popover (`gate/GateReasons.tsx`).
9. **Memory fingerprint** = `sha256("fp1|firm|issue_class|quote_hash")` (`memory/fingerprint.ts:27`), exact-text matching; decisions have one active row per (workspace, firm, fingerprint) (`uq_decision_active`, migration 0002).
10. **Counts wording**: README says "13 detectors covering 15 issue classes" (11 from detectors, 3 AI-only, 1 from version diff). Detector registry has exactly 13 (`detectors/registry.ts:43-57`); taxonomy has 15 (`taxonomy.ts:4-20`); `version_drift` is declared but emitted by nothing in `packages/core/src`, `apps/web/src`, `apps/worker/src` (grep).

## Q1. Existing diff machinery and what V1 can reuse

| Need (SPEC) | Existing | Gap |
|---|---|---|
| Section alignment baseline vs new (A8 "matching by number then title then content") | `alignUnits`: exact key, LCS on headings, structural relabel, Jaccard >= 0.5 (`align.ts`; `all-engine.md:106`) | Matches the SPEC risk mitigation already; reuse as is |
| Old/new text with word marks (AC "old above new", non-colour cue) | `segments` + `excerptOf` (`diff-text.ts`); Compare screen renders them (`compare/CompareScreen.tsx`, masks via core `mask`) | Variance row needs its own render; mask-then-clip contract (E5/E18) applies |
| `new` class | `sections[].status==='added'`, `definitions[].status==='added'`, `requirements` added, `fees` added | Need a rule list mapping these to `new` (VAR-01 in mockup) |
| `changed_logic` vs `changed_cosmetic` | Nothing. Closest signals: `renames` (term swap), `definitions/requirements/fees` deltas, `Segment` tokens, `normText` (`normalize-key.ts`) | New deterministic classifier + rules config (L6) with rule ids; "numbers, negations, modals, conditions" detection absent |
| Renumbering noise (mockup K-01: 118) | `status:'moved'/'renamed'` plus `normalize-key.ts:numbering()` | Not summarised as grouped cosmetic rows |
| Fund-name swap (mockup K-02: 41) | `inferRenames` needs count >= 3 and coverage >= 0.8 inside aligned text; fund names are free text | Fund name is not an inferred rename on its own for every case; verify on fixture |
| AI narrative | `drift-narrative@1` (`llm/tasks/drift-narrative.v1.ts`): one candidate per rename (max 8); drafts must name both terms | Not needed by SPEC; usable only as optional wording (AC-V7 "H for any AI wording") |

Facts that constrain reuse:
- `diffDocuments` needs two prepared sides (`SideInput {structure, graph, findings}`); the web `prepare()` runs the **full `runDeterministic`** on both sides (`engine.worker.ts:395-428`). Impact computation can use the already-built graphs (`compute(sa,sb,fa,fb)` has both, `diff/index.ts:59`).
- `DiffResultSchema` is `.strict()` (`types.ts:204-218`). Adding variance output means either a new sibling result type or an additive optional field (test `diff-contract` and `diff-determinism` pin the shape; run them).
- Compare sources exclude scans/OCR (`compare/sources.ts:7-9`, "OCR runs on the main thread"); samples are bundled HTML, uploads are in Dexie `documents` for 24 h (`storage/db.ts:7-16, RETENTION_MS`). So a baseline from "package" is only comparable if its bytes are in the browser (matches SPEC L10/Depends On).
- "Open in Compare" already exists as a Findings-row action in the mockup; Compare itself is unchanged by SPEC (D-6: opens in Versions mode).
- Perf evidence for the NFR: #5 vs #6 Node 187 ms warm, browser 343 ms (`all-engine.md:112`), budget 3 s; SPEC says under 5 s.
- `fixtures/diff/expected/*.json` hold pinned diff outputs (`identical-pair`, `not-enough-structure`, `sibling-A-vs-B`); `fixtures:check` scans `fixtures/diff` recursively for stray files, so any new fixture there must be registered in `scripts/src/fixtures/build-seeded.ts`.

## Q2. Form impact from the logic graph

Available APIs:
- `investorModelOf(g)` / `investorModel(g)` (`investor/paths.ts:37, 222`): `InvestorModel {types[], paths[], completion}`; each `InvestorPath` has `sections[]`, `skipped[]`, `questions[{section,text}]`, `required[]`, `reachesCompletion`, `uncertain`, `citations`, `gaps`, `deadEnd` (`investor/types.ts:110-128`).
- Vocabulary: 10 `INVESTOR_TYPES` (individual, joint, trust, ira, custodial, corporation, partnership, other-entity, erisa-plan, estate) with `FAMILY` person/entity/retirement (`investor/types.ts:6-33`); `typesIn(text)` extracts types named in free text (`:78`).
- Conditionals: `Structure.conditionals[{trigger, action complete|skip|proceed|provide|see, negative, targets[], role}]` (`structure/types.ts:79-90`); graph `conditional` edges to `target:<n>` (`graph/graph.ts:75+`).
- View layer: `buildStructureView(g, findings)` (`structure-view/build.ts:243`) already derives conditions (kinds whitelist/role/skip/negative/jump), option rows, term rows, investor view for the Structure screen.
- `question`/`field`/`option` nodes: `Structure.optionGroups`, `fields` (labels).

Gaps against SPEC AC-V10:
- "Affected investor types" can be derived by intersecting a changed unit's section number with `InvestorPath.sections/questions` of each side. This is new glue (no existing function).
- "Affected conditional paths": intersect changed block ids with `Conditional.blockIndex/targets`. New glue.
- **"Old form rule reusable yes/no" has no existing concept** (needs a definition in rules config).
- **Demo case 4.2 ("formed outside the United States")**: the investor vocabulary has no US/non-US or jurisdiction dimension; `typesIn` would yield 'corporation/partnership/other-entity' (entity family) only. "US entities lose the beneficial-owner question" is a conditional-semantics statement the current extractor cannot produce; it would have to come from the authored fixture plus diffing the conditional trigger text, not from existing graph APIs.
- `InvestorPath.uncertain` / gaps exist; SPEC risk "incomplete graph" is handled by reporting uncertainty (consistent with AC9-style wording "from the logic graph, deterministic").
- Investor-path ground truth is an open backlog item (P2-2/R1), so impact precision on real samples is unproven.

## Q3. Questions, counsel sheet, answers, memory, regression

Current shapes (evidence):
- Triage per document: `{status open|accepted|counsel|dismissed, reasonCode, note, counselAnswer A|B|C|unclear, counselNote, answeredBy, answeredAt, decisionId, answerId}` (`review/model.ts:10-23`), persisted in Dexie `uiState` (`state/review.ts`).
- Question = findings marked Needs counsel, or Accepted critical (`counsel/sheet-model.ts:26-28`); `needsAnswer`, `questionState` new/accepted/answered/unclear; prior-memory items collapsed (`priorItems`). Sheet inclusion rules D-1 (`counsel/sheet.ts:27-36`).
- Sheet shape `CounselSheet {meta {title, firm, fund, version}, questions[{number, findingKey, link, location, quote, interpretations[1-6 x <=500]}]}` (`counsel/types.ts:56-76`). **No owner field; one sheet.** Export is DOCX (`counsel/exportDocx.ts`, `export-flow.ts`) using the `docx` lib; export creates questions in the Worker in a batch then audits `counsel_sheet_exported`.
- Template wording is keyed by `issue_class` (`counsel/template-draft.ts:35-67`): change/regression rows need either an `issue_class` or a new wording path (an unknown class falls back to GENERIC, `templateQuestionText` label "Issue").
- Answer form: option A/B/C/unclear + note + by + date (`counsel/AnswerForm.tsx`). No intent, no scope.
- Worker contracts (`contracts/memory.ts`): `CounselQuestionRequest{finding_ref, fingerprint, interpretations}`, `CounselAnswerRequest{question_id, option, note<=1000, quote_text, fingerprint}`; `ActiveDecision` has `counsel_option`, `counsel_note`; **no intent/scope/owner fields**. `AUDIT_ACTIONS` is a closed 10-value enum (`:208-219`).
- D1 (migration 0002): `counsel_question` UNIQUE(workspace, review_run, finding_key), FK `issue_class` to the `issue_class` table; `counsel_answer` (option, note, status active/revoked); `decision` (immutable columns guarded by trigger `decision_guard_update`, which lists columns explicitly, so any NEW column is unguarded unless the trigger is recreated); `finding`, `finding_state`, `firm_rule`, `rule_evidence`, `audit_event`; `demo_ro_*` triggers block writes to demo workspace for every table (new tables need the same). Migrations 0001-0005 are applied to the live remote D1 (schema version 5; `all-worker.md`).
- Write budgets: each new write path needs a `MEMORY_WRITE_WEIGHTS` entry and a `rows-written` assertion (`all-worker.md`, "Any new write path needs a weight").
- Client write path: Dexie outbox (`api/outbox.ts`) kinds `decide|answer|revoke`; `MemoryApi` interface is shared by `stubMemoryApi.ts` and `realMemoryApi.ts`, with `test/api-contract.test.ts` running one suite against both. New op kinds/fields touch outbox, both APIs, the Worker route and the contract test.
- Where owner routing could fold in: a routing table is pure config + a deterministic function over change type/section text; storage needs a per-change owner (+ override who/when). Two-owner change = two question records; the existing UNIQUE(workspace, run, finding_key) and the `findingKey`-keyed sheet/question-ids/gate maps do **not** allow two questions per finding key, so a key scheme like `<changeId>:<owner>` is implied (observation, not a decision).
- Existing "regression-like" behavior: memory labels (`already_answered`, `dismissed_reconfirm`, ...) re-surface old decisions on **exact fingerprint** only (`memory/label.ts`). A "firm-template answer re-checked on a new doc" is a different mechanism (a statement checked against document structure), so nothing reusable except the firm/workspace isolation, append-only, and audit plumbing.
- Firm rules (`firm_rule`, `rules` route) are free-text LLM-injected rules (<=500 chars; `rulesHash`), "untrusted context", not machine-checkable assertions. Not a fit for deterministic R-01 (observation).
- R-01 mechanics: scopes of kind `appendix` carry a label via `scopeLabel(title)` (`normalize-key.ts:55`), so "Appendix C exists" is checkable from `Structure.scopes`. Real data: #5 has Appendix C, #6 does not (0 mentions, `Phase 07` table), a natural second case. The **missing-target cross-reference detector is deferred** (feasibility INCONCLUSIVE, `process/general-plans/backlog/missing-target-xref_17-10-26/`), so "Appendix C is referenced but missing" as a base finding does not exist; the SPEC's R-01 only needs "Appendix C must exist".
- Gate in the mockup counts: untriaged New/Logic changes + asked questions without clear answer + regression findings + critical errors. The core `computeGate` must be extended or wrapped; core `gate-state-matrix` (2400 cells + named stubs, `all-engine.md:128`) is the extension point per AC-V17.

## Q4. Findings screen, render-first, frozen contracts

- `FindingsScreen.tsx:34-181`: header (`h1`, `meta` line "N open · M block digitization"), `fhead` severity chips + `FilterMenu`, list `findings-list` of `FindingRow`, `PreviouslyHandledRow`, `DocPane`/`ScanPane`. Filters in `state/filters.ts` (`sev`, `cls`, `status`, `sort`, `det`; persisted ui:v1:filters). An "All / Errors / Changes" segment, a baseline control, and change rows fit in the existing header/list; filter schema is validated field by field (`loadFilters`), so adding a field is safe if given a default.
- Rows derive from `buildRows(findings, memory, triage)` (`review/model.ts:40`); `Row.f` is a `FindingView` (needs `classLabel, title, ref, loc, found, order, quote`). Change rows need a parallel row type or a FindingView adaptation; the AI lane and memory refresh also operate on the same `result.findings` array (`review.ts:801-808`).
- **Render-first** (`all-worker.md` Deploy Rules): deterministic findings must never await session/Turnstile; memory/AI run in background (`openDocument`, `state/review.ts:600-633`). Variance (diff) is deterministic and local, so it can render with the findings; regression checks need firm memory (network) and therefore must arrive in the background (consistent with the mockup hiding R-01 in the no-history case). The baseline text is browser-side, so no server read is required for V1.
- Frozen v1: `Finding` schema (`findings/schema.ts`): `issue_class` is `z.enum` of 15 (`taxonomy.ts`), `FindingBase` is not strict-additive to changes without snapshot move; `detector_kind` enum rule/ai with refine rules (`schema.ts:47-72`); `maxSeverityFor` caps. Adding `kind`, `change_type`, `owner`, etc. to `Finding` is "optional field" additive, but it also changes `FindingWire` (stored via `/api/runs/:id/findings`, server column set fixed in the `finding` table CHECKs). Adding issue classes also requires the D1 `issue_class` table seed (FK from `counsel_question`, `decision`, `finding`).
- Web `test/import-graph.test.ts` allow-lists the **value** imports the main thread may take from `@aduin/core` (list above); any new core runtime function used on the main thread must be appended to `ALLOWED` or the gate fails.

## Q5. LLM framework and Worker /api/ai

- Tasks: `TASKS` registry `clause-judgment@1`, `counsel-draft@1`, `drift-narrative@1` (`llm/registry.ts`; `AI_TASK_IDS` 3 values). A new task needs `promptVersion`, `schemaVersion`, `buildMessages`, validator; `llm-task-registry` pins an `inputHash` so edits are caught; adding to `AI_TASK_IDS` moves the contracts snapshot (enum entry in `AiRequestSchema.task`).
- Every AI finding goes through the verify chain (quote >= 12 chars / 3 words, located in the cited candidate, masked, severity cap; `all-engine.md:85`); AI findings never gate (`gate.ts:35`, L4). That is already the AC-V9 invariant; the recorded-transport harness (`packages/core/test/helpers/recorded-transport.ts`, `fixtures/llm-recordings/{task}/{inputHash16}.json`) supports "recorded AI contradicts rules" tests at $0.
- Worker free model only: `nvidia/nemotron-3-super-120b-a12b:free`, `json_schema`; limits 3 fresh-AI docs, 8 AI req, 6 OCR pages per visitor/day; AI needs Turnstile token (human browser only, `all-worker.md`). Live AI budget used so far: Phase 05 3 of 8, Phase 07 1 of 3, Phase 10 0; OpenRouter credits not topped up.
- SPEC use of AI: none required. Question wording = template draft by default (`templateQuestionText`), AI draft only where cached (existing counsel-draft). Intent is human-only (AC-V15). The mockup keeps "ambiguity/contradiction (existing, labelled)" as the only AI. So V1+V2 can be built and fully tested with 0 live calls; the SPEC/goal constraint of <= 6 live calls (<= 3/UTC day) is not consumed unless INNOVATE adds an AI task (an AI change-explanation task would be a new registered task with a new prompt and recording).

## Q6. Samples and fixtures

- Same-firm real pairs (manifest `firmId`): #3 (PG PE Master 2019) / #4 (PG PE TEI 2016) and **#5 (NGI 2024) / #6 (NGI 2026)**, all `firmId: partners-group` (`apps/web/public/samples/manifest.json`). #5→#6 pinned goldens: removed `appendix:c`, class-fee changes, renames, 4 fixed findings (`golden-05-06-drift`, `diff-pairs`).
- Memory fixtures: `fixtures/memory/{fund-I,fund-II,fund-Y}.html` (709-832 bytes, tiny), `firm-x` for I/II, `firm-y` for Y; `fund-expectations.json`, `fund-I-decisions.json`, `fund-I-answers.json`, `demo-seed-spec.json` (8 decisions, partners-group). Fund I/II are too small to exercise 214→7.
- **Hartwell & Crane does not exist as data**: appears only in `design/mockups/*`, the two SPECs and a PLAN row (`X7`, `subdoc-qa-mvp_PHASE-08b-memory-ui_PLAN`: "mockup copy is invented"). `law-firms.json` has 3 firms; they are mirrored in `apps/worker/migrations/0003_reference_seed.sql` (INSERTs for `law_firm`, `law_firm_alias`), core `LAW_FIRMS`, and the generated web `firms.json`. A new firm requires: JSON + new migration insert on the remote D1 + seed spec + tests that enumerate firms (`firms-and-rules`, `demo-seed-spec`, `seed:check`). The firm name also alters demo seed/`seed:check` if the demo workspace is extended.
- Fixture generation convention: `scripts/src/fixtures/build-seeded.ts` writes fixtures + expectations; `pnpm --filter @aduin/scripts fixtures:build` / `fixtures:check`. Real data cases also available: #1/#2 are unpaired; no real feeder pair (`samples/sub-docs/README.md` Gaps).
- The precision/recall tests (AC-V5/V6) need an authored seeded variance corpus (cosmetic traps: renumbering, fund name, dates, Units→Shares; logic items: 7 demo items) plus the real #5/#6; none exists. A same-firm package test for L10 needs both documents in the browser: `samples` are bundled; uploads sit in Dexie.

## Q7. Test commands and gates

From `process/context/tests/all-tests.md` (verbatim rules): pnpm 11.13.1, **no `--` token**; select tests as `pnpm --filter <pkg> test <token>`; **one token per call** (`for t in ...; do pnpm --filter <pkg> test "$t" || exit 1; done`); unmatched token must exit 1; Playwright `preview` project uses port 4317 and shared `test-results` (serial only); `--project=stack` is the `=` form; rebuild plain (`pnpm --filter @aduin/web build`) before any deploy; run tools through `pnpm exec`; web import-graph allow-list.

| Area | Command (examples) | Likely spec/test home |
|---|---|---|
| core unit/property | `pnpm --filter @aduin/core test <token>` (e.g. `diff-contract`, `diff-determinism`, `diff-pairs`, `gate-state-matrix`, `sheet-contents`, `contracts`, `security`) | `packages/core/test/{unit,golden,property}/...`; new: `variance-classification-contract`, `variance-seeded-recall-matrix`, `variance-impact-from-graph-fixtures`, `variance-routing-table-matrix`, `variance-rules-config-schema-and-provenance`, `variance-determinism-repeat-run`, `variance-gate-state-matrix`, `variance-golden-05-06` |
| core golden | `pnpm --filter @aduin/core test:golden` (67), `test:corpus` (13 no-LLM) | `golden-05-06-drift` extension |
| web unit | `pnpm --filter @aduin/web test <token>` (e.g. `gate-interim`, `import-graph`, `api-contract`, `counsel-export-contents`, `export-flow`) | `apps/web/test/*` |
| web e2e (preview) | `pnpm --filter @aduin/web test:e2e <token>` (each token rebuilds the e2e preview 3-6 s): `counsel-gate`, `counsel-sheet`, `counsel-answer`, `counsel-export`, `gate-pill`, `diff-pairs`, `memory-no-cross-firm`, `a11y-keyboard`, `perf-budget`, `no-llm-corpus`, `layout-vs-mockup`, `fund-two` | new `apps/web/e2e/variance-*.spec.ts` for the `-e2e` ACs |
| web e2e (stack-memory) | `pnpm --filter @aduin/web test:e2e:stack-memory` then token (`stack-memory-memory-no-cross-firm`, `sandbox-isolation`, `roundtrip`, `stack-memory-smoke`) | server-side cross-firm assertion for AC-V16 |
| worker | `pnpm --filter @aduin/worker test <token>` (`migrations`, `triggers`, `rows-written`, `memory-write-limits`, `memory-guards-matrix`, `memory-storage-contract`, `demo-workspace-not-polluted`) | `apps/worker/test/memory/` |
| scripts | `pnpm --filter @aduin/scripts fixtures:build`, `fixtures:check`; `pnpm seed:check` | `scripts/src/fixtures/` |
| repo gates | `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm guard:cf && pnpm secrets:scan`; `pnpm slice:check`; `pnpm test:a11y` (web) | |

Regenerating the contracts snapshot is required after any `contracts/*` change (`test contracts`). After any diff-engine change run `record:author --check` because candidate quotes move the drift-narrative `inputHash` (`all-engine.md:115`).

## Q8. Dependencies on Intake (observed vs assumed)

OBSERVED (read at HEAD 025d589, `git status` clean except an untracked goal file):
- `git log --oneline -15` shows no Intake code commits; the tree has no uncommitted Intake code. `process/features/fund-package-intake/active/intake-mvp_17-10-26/` holds exactly two files: `intake-mvp_SPEC_17-10-26.md` and the untracked `intake-mvp_AUTOPILOT_GOAL_17-10-26.md` (entry phase INNOVATE, no INNOVATE/PLAN artifact yet; TEST GATES TBD).
- Intake SPEC data delta (`intake-mvp_SPEC:215-225`): Package {firm, fund, version label, created time, file count}; Document gains type, role (to digitize / reference / baseline), confidence, detection reason, analyst-confirmed flag, content hash, needs-OCR flag; references; cross-doc definitions; coverage; document request. Text stays in the browser 24 h, D1 stores package metadata, hashes, short quotes, coverage only (L7). Roles are set at intake U4; AC-I9: one or more documents may carry role "baseline", same firm only; "variance consumes this role". Package limits proposed 12 files / 40 MB / 10 MB each (A8).
- UI placement (Intake L2): Upload modal with confirmation table; Structure "Package" lens; gate popover coverage; Findings header coverage line; Questions: missing-documents request is the **GP owner group** export.
- Goal block lock: "design baseline role for Variance (L10) to consume, don't build Variance"; Intake may not edit `README.md`, `docs/README.md`, `docs/architecture/**`, `design/mockups/**`; it will deploy, push main and notify the design session.

ASSUMED (nothing exists to read; PLAN must not depend on exact shapes):
- Package/Document TypeScript types, store (Dexie table names, whether `documents` gains `role`/`packageId` columns or a new table), id scheme, how many "to digitize" documents a package may hold (Variance diff is pairwise; "one or more baselines" vs "one baseline per review", A8, is unreconciled).
- Whether "baseline" documents' bytes are guaranteed in the browser at review time (Dexie `documents` 24 h retention); the SPEC says older funds must be re-added.
- D1 persistence of package/role (Intake adds tables and migrations; numbering of migrations 0006/0007 collides with Variance's need, see collision map).
- The type/role confirmation event (when "Run checks" fires, where Variance diff is triggered), `DocMeta`/`openDocument` signature changes (`state/review.ts:57,98`), how a package-level review is represented (single `result`, or several).
- GP owner group wiring in Questions (Intake U9) vs Variance's Counsel/GP/Fund admin grouping and two-owner questions: both rewrite the Questions screen grouping and the sheet builder.
- Whether Intake changes `computeGate` (coverage blocks gate when the sub agreement is missing, AC-I19, "policy configurable data") and where that config lives; Variance's gate policy config (L6, A12) is a second config in the same gate.

NOT YET DECIDED (flag for orchestration): Intake INNOVATE (storage of roles, package scope in Findings), PLAN, test-gate names; the shared migration numbering; who owns the gate/Questions refactor first.

## Collision map with Intake (likely overlapping files)

| File / module | Intake touch (SPEC) | Variance touch (SPEC) | Sequencing note |
|---|---|---|---|
| `apps/web/src/state/review.ts` (`DocMeta`, `openDocument`) | package, many docs, run-checks gate | baseline pointer, run variance diff, change triage, intent/scope answer | Intake first; Variance adds on top of its package state |
| `apps/web/src/storage/db.ts` (Dexie version(1) only) | new package/role store (needs `version(2)`) | change triage, owner overrides, maybe cache | Dexie version bump must be serialized (one `version(2)` stores map) |
| `apps/web/src/features/open-document/*` | multi-file Upload modal + confirmation table | none directly (baseline control is in Findings header) | Intake only |
| `apps/web/src/features/review/FindingsScreen.tsx`, `use-review-view.ts`, `model.ts`, `Banners.tsx` | coverage line in header | All/Errors/Changes filter, baseline control, change rows, muted no-baseline line | Same header; both add elements |
| `apps/web/src/state/filters.ts` | none | new filter field | Variance only (low risk) |
| `apps/web/src/features/gate/GateReasons.tsx`, `shell/GateButton.tsx`, `counsel/gate.ts` (`computeGate`) | coverage + missing-doc gate policy (AC-I19) | untriaged changes, asked questions, regression findings; owner grouping in popover | Core gate matrix is shared; sequence: Intake first, Variance extends |
| `packages/core/src/counsel/{gate,sheet,types}.ts` | maybe coverage reason kinds | change reasons, per-owner sheet | Same `GateReasonKind` union additive; contract tests `gate-state-matrix` |
| `apps/web/src/features/counsel/*` (CounselScreen, QuestionRow, sheet-model, export-flow, exportDocx) | GP group item per missing document; one export | owner groups, 3 owners, per-owner export, answer intent/scope | Heaviest overlap; Intake adds GP group, Variance generalizes to all owners |
| `apps/web/src/features/structure/*`, `StructureLenses.tsx` | "Package" lens | none (uses graph via core, not the screen) | no overlap |
| `packages/core/src/detectors/defined-term-issues.ts`, `undefined-term.ts` (+ structure `definedTerms`) | cross-document definitions | none | Intake only |
| `packages/core/src/index.ts` (append-only barrel), `apps/web/test/import-graph.test.ts` ALLOWED | new exports | new exports | Both append at the end; serialize (orchestrator rule: single appended lines) |
| `packages/core/src/contracts/memory.ts` + snapshot `contracts.json-schema.snap` | package/doc metadata persistence (probably new schemas) | intent/scope/owner/regression schemas | Snapshot is one file: serialize regenerations |
| `apps/worker/migrations/` (0006+), `routes/memory`, `memory/repo`, `platform` weights, `demo_ro_*` triggers | package tables (D1 metadata) | owner, intent/scope, regression table | Number collision risk: Intake first claims 0006; Variance 0007 (or one bundled) |
| `apps/web/src/api/{memoryApi,stubMemoryApi,realMemoryApi,outbox}.ts` | package metadata writes (likely) | answer intent/scope, regression record | `api-contract.test.ts` shared |
| `fixtures/memory/law-firms.json`, migration 0003-style seed, `demo-seed-spec.json`, `firms.json` | demo package "Hartwell & Crane" firm (SPEC L9: synthetic H&C package) | same Hartwell & Crane firm and Fund II/III | **Both SPECs name H&C; one of them must create the firm and fixtures** (unassigned) |
| `scripts/src/fixtures/build-seeded.ts`, `fixtures:check` | synthetic H&C package fixtures | H&C Fund III vs Fund II fixtures | Same generator; possible shared fixture set |
| `README.md`, `docs/architecture/**`, `design/mockups/**` | forbidden by Intake goal block | n/a | Counts wording below is read-only here |
| `process/context/*` docs | UPDATE PROCESS | UPDATE PROCESS | Serialize |

## Q9. "13 detectors / 15 issue classes" wording locations

If a new detector or issue class is added (SPEC does not require one: change/regression are described as findings of kind change/regression, not new classes):
- `README.md:26`, `:101` (full sentence incl. "11 classes from detectors, 3 AI-only, 1 from version diff"), `:165`
- `docs/README.md:8`, `docs/architecture/README.md:58`, `docs/architecture/components.md:115,133`, `docs/architecture/status.md:13`, `docs/architecture/data-model.md:38`, `docs/demo/slides.html:97`
- Code: `packages/core/src/findings/taxonomy.ts:3-20` (comment + enum), `detectors/registry.ts:43-57`, `apps/web/src/features/review/issue-classes.ts`, D1 `issue_class` table (migration 0001/0003 seed), `packages/core/test/__snapshots__/contracts.json-schema.snap` (IssueClass enum is inside several schemas)
- Process docs: `process/context/all-context.md`, `process/context/engine/all-engine.md`
- Note: `version_drift` is a declared class that no code emits; a variance finding class could reuse it without changing counts (observation only). Intake's goal block forbids editing README and `docs/**`, so any counts change in those files is a conflict surface.

## Test Gap Analysis

1. Files in blast radius with zero test coverage (new): all variance code (classifier, impact, routing, rules config, regression check, per-owner export, answer intent/scope, change rows); no `variance-*` tests exist (`find` of `packages/core/test`, `apps/web/test`, `apps/web/e2e` shows none). Existing coverage on reused code: `diff-*`, `golden-05-06-drift`, `gate-state-matrix`, `sheet-contents`, `counsel-*` e2e, `memory-*` e2e, `api-contract`.
2. Behaviors with no asserting test: AC-V1 to AC-V20 all (provisional scenario names in SPEC). Closest existing assertions: AC-V7 partly via `golden-05-06-drift` (removed Appendix C, fees, renames) but with no classification; AC-V17 via `gate-state-matrix` (2400 cells) without change/question states; AC-V13/V14 via `counsel-export-contents` and `counsel-answer` without owner/intent/scope; AC-V19/V20 none.
3. Preliminary tiers: AC-V1,V2,V3,V4,V5,V6,V7(det),V8,V10,V11,V12,V13,V14,V15,V16,V17,V18,V19,V20 Fully-Automated (need authored fixtures + core/web/e2e specs); AC-V9 Hybrid (recorded AI); AC-V7 AI wording Hybrid; real-browser Turnstile/live AI residuals are Known-Gap (operator-run, carried from Phase 10 R2). Cross-firm guard AC-V16 needs the `stack-memory` project (Fully-Automated locally). Performance/limits re-runs (base AC29/AC40) need the Free-plan conformance script and are Agent-Probe/operator.

## Infra Improvement Suggestions

- A shared fixture builder for Hartwell & Crane (used by Intake and Variance) would avoid two diverging generators in `scripts/src/fixtures/build-seeded.ts`.
- Concurrent Playwright on port 4317 is an existing known flake (backlog P6-2); a parallel Intake/Variance EXECUTE would hit it (serial rule in `all-tests.md`).
- `import-graph` ALLOWED list and the contracts snapshot are single-file merge points for both features.

## Open Questions / Risks

1. What exactly is a "raw change" (214 on the demo)? Section-level units are ~30; the count must be a defined metric (segments? paragraphs? tokens?) or AC-V4 is unfalsifiable.
2. Do change rows become `Finding`s (Finding schema + wire + D1 `finding` table + issue_class FK + gate/sheet/fingerprint reuse) or a parallel row type with its own gate/question plumbing? The SPEC's Data Model Delta says "Finding gains a kind"; this determines how much of Phase 08 can be reused versus rewritten.
3. Two-owner questions vs `UNIQUE(workspace, review_run, finding_key)` and the `findingKey`-keyed maps in the client.
4. Regression check storage and a deterministic assertion grammar ("X must exist") that works with `Structure` (scope/appendix labels); where it lives (new table vs `decision.scope`), and cross-firm isolation proof (AC-V16 asks a server-side/stack test).
5. Intent/scope persistence needs migration 0006 + contract snapshot regeneration; the existing `decision_guard_update` trigger will not protect new columns unless recreated.
6. Migration number and remote application: Intake and Variance both likely want 0006; live D1 is real, so deploy ordering matters (deploy Worker before web, `all-worker.md` F12 rule).
7. The baseline role in Intake is "one or more documents"; Variance is one baseline per review (A8). Pairwise diff of a multi-document package (several "to digitize" or several baselines) is undefined.
8. "Impact" for the demo 4.2 case has no jurisdiction vocabulary; "old form rule reusable" is undefined.
9. Hartwell & Crane firm/fixtures are unowned (both SPECs reference them) and the firm needs a D1 reference insert.
10. D1 rows_written: new tables/writes (owner overrides, regression records, intent) need weights and the budget re-measure (N11 still open, Phase 10 D4 burst not run).
11. Rules config (L6): where it lives (core JSON like `law-firms.json`, validated by zod), how its hash is recorded in provenance (existing `rulesHash8`/`rules_hash` concerns firm rules, a different thing), and whether `Finding` provenance can carry it without a contract change.
12. Free-plan CPU: the diff already costs two full `runDeterministic` passes in the browser worker (fine) but any server-side variance write must fit 10 ms CPU (p99 already 16 ms, observation).
13. Docs say "13 deterministic detectors / 15 classes"; a new issue class or detector forces edits in files Intake is forbidden to touch.

## TL;DR

- Reusable: section alignment, word-level old/new text, rename/fee/definition deltas, investor paths, counsel DOCX export, memory append-only/firm isolation. New: classifier, impact, routing, rules config, intent/scope/owner storage, regression check, per-owner gate/questions.
- Biggest unknowns for INNOVATE: change rows as `Finding` vs parallel type; two questions per change; where intent/scope/regression live (migration 0006 + contract change).
- Intake: SPEC + goal block only, no code or INNOVATE/PLAN yet; its baseline role/package model is entirely assumed. Hartwell & Crane firm and fixtures do not exist and both SPECs depend on them.
- No AI needed; live budget stays 0 of 6. Gates: one token per call, no `--`, serial Playwright on port 4317.
