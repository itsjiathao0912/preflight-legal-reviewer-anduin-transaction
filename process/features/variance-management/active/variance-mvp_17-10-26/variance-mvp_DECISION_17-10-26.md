[MODE: AUTOPILOT | INNOVATE]

INNOVATE: variance-management slim MVP (V1 + V2). Decisions are locked for PLAN, no files written.

## Decision Summary

### Chosen Approach
**Additive "variance" module in core, with change rows presented as ordinary frozen-v1 Findings through an adapter.**
- Core changes are additive only: no new `issue_class`, no `DiffResultSchema` change, and no Finding contract change.
- Gate and sheet change through optional fields only.
- Memory persistence uses one small migration plus additive contract fields.
- Delivery is a 5-phase program.

Evidence base: SPEC AC-V1..V20, the RESEARCH file, and my own reads of `counsel/gate.ts`, `findings/schema.ts`, `diff/types.ts`, `counsel/types.ts`, `review/model.ts` and the migration list.

**Core assumption challenged:** the RESEARCH framing was "Finding vs parallel row type". A third option wins. The frozen `Finding` schema already fits a change row (`version_drift` is declared and never emitted, severity caps allow it, and `detail.facts` is a free record). So variance metadata can ride inside `detail.facts`, and no contract needs to move.

**Simplest viable option:** reuse Finding, triage, questions, answers, D1 keys and fingerprints as they are, and add only what has no home today:
- the classifier
- impact
- routing
- an assertion check
- one table plus a few columns

---

## D1. "Raw change" and the classification algorithm

**Chosen: a new module `packages/core/src/variance/`. `diff/` stays untouched except possibly one additive export line.**

**Definition of "raw change" (pins the 214):**
- A raw change is one hunk: a maximal contiguous run of non-same word tokens in an aligned unit pair.
- Each wholly added unit or wholly removed unit counts as 1 raw change per block.
- Alignment comes from `diffDocuments` (public output, unchanged).
- Hunks are recomputed with the existing `diff` package (v9) on the full unit text taken from both `Structure`s. They are not taken from `DiffResult.segments`.
  - Reason: segments are clipped at 2000 characters, carry `gap` elisions, and can be a coarse `truncated` replace. Recall of 100% and an exact 214 cannot depend on clipped data.
- Tokenizer and hunk-merge rules are pinned in the rules config.
- The Fund II/III fixture is authored so the count is exactly 214.
- If `buildUnits` or a unit-text helper in `diff/align.ts` is not exported, add an export line to the barrel. No behavior change.
- The metric is exposed as `VarianceResult.summary.raw`.

**Classification algorithm (deterministic, ordered, every rule has an id):**

| Step | Rule | Result |
|---|---|---|
| 0 | Hard guard: both documents' `firmId` must be non-null and equal | else `notice: cross_firm`, no output |
| 1 | Whole unit added (section, definition, requirement, fee) | `new` (VAR-NEW-*) |
| 1 | Whole unit removed | `changed_logic` (VAR-LOGIC-REMOVED) |
| 1 | Pure insertion of at least `new_min_words` words (default 12, one full sentence) | `new` |
| 2 | Logic guards, evaluated on the changed tokens only, not the context: digits/percent/amount, negation, modals (shall, must, may), condition words (if, unless, provided, except, only, subject to), investor-type terms (`typesIn`), jurisdiction words, `truncated` | forces `changed_logic` |
| 3 | Positive cosmetic rules, only if no guard fired: VAR-COS-RENAME, VAR-COS-NAME, VAR-COS-RENUMBER, VAR-COS-DATE, VAR-COS-FORMAT, VAR-COS-MOVED | `changed_cosmetic` |
| 4 | Default | `changed_logic` |

Details of the cosmetic rules:
- **VAR-COS-RENAME:** the hunk equals a `DiffResult.renames` pair (Units→Shares).
- **VAR-COS-NAME:** a repeated proper-noun swap, 2 or more occurrences. Do not rely on `inferRenames` thresholds (count at least 3, coverage at least 0.8), which the research flagged as unreliable for fund names.
- **VAR-COS-RENUMBER:** a reference label changes AND the alignment maps the old target number to the new one. A reference whose target did not move is logic.
- **VAR-COS-DATE:** only for cover or header dates. A date in operative text is logic.
- **VAR-COS-FORMAT:** the two sides are equal after case, whitespace and punctuation normalization.
- **VAR-COS-MOVED:** moved unit with identical text.

Principle: unknown means logic. Cosmetic needs a positive rule. This protects the 100% recall and "logic hidden as cosmetic = 0" targets.

**Shown changes and cosmetic groups:**
- Non-cosmetic hunks cluster per aligned unit into one change row. The cluster class is `new` if the unit was added, else `changed_logic`.
- Cosmetic hunks are never findings. They become display-only groups keyed by rule id (and rename pair), each with a count and examples. These are the "5 grouped rows".

**Rejected:**

| Alternative | Why rejected |
|---|---|
| Extend `DiffResultSchema` or `SectionDiff` | `.strict()` plus `diff-contract` and `diff-determinism` pins make it the highest-risk path, with no benefit |
| Count section units as "raw" | Only about 30 units on #5/#6, so 214 is impossible |
| Count tokens | Inflated and unreadable |
| LLM classification | Violates AC-V9 and AC-V20 |
| Default to cosmetic | Violates the 100% recall target |

**Risks:**
- Clipped or coarse text paths. Mitigation: recompute from `Structure`.
- Hunk merge granularity changes the count. Mitigation: pin it in config and set the fixture to match.
- Renumbering logic needs the alignment's old→new number map. Verify that `DiffResult` exposes it, else derive it from `keyA/keyB`.

## D2. Change rows as Findings vs a parallel type

**Chosen: Findings by adapter, with the frozen v1 `Finding` unchanged.**
- A change finding is built with:
  - `issue_class: 'version_drift'`, `detector_kind: 'rule'`, `detector_id: 'variance.<rule_id>'`, `pattern_key: <rule_id>`
  - severity `medium` for new/logic and `critical` for regression
- All variance metadata lives in `detail.facts`:
  - `kind` (change | regression), `change_type`, `rule_id`
  - `variance_rules_version`, `variance_rules_hash8` (satisfies L6/AC-V19 provenance)
  - `baseline_doc`, `suggested_owners`, `impact_*`, `quote_side` (old | new)
- `quote` is the new clause text. For a removed unit it is the old text with `quote_side: 'old'`.
- The anchor is the nearest block in the new document, or doc start at offset 0 for a removed unit.
- Web `FindingView` gains an optional derived `kind`, taken from the `variance.` prefix. This is a web type, not a frozen contract.
- Counts (13 detectors, 15 classes) stay literally true:
  - variance is a diff-derived producer, not a registered detector
  - `version_drift` finally becomes emitted, which makes the README phrase "1 from version diff" true
  - no README or `docs/**` edit is needed, and Intake's forbidden files stay untouched
- Regression findings use the same adapter, with `detector_id: 'variance.regression.scope_exists'`.
- Fingerprint is the existing `fp1|firm|issue_class|quote_hash`, so reuse needs no change.

**Gate:** `GateFinding` gains optional `gates?: boolean`. `computeGate` gains an optional 4th parameter `policy`.
- `policy` undefined means exact legacy behavior, so `gate-state-matrix` (2400 cells) and the base e2e tests stay green.
- With the variance policy on, a row gates if any of these hold:
  - kind change, untriaged
  - kind regression
  - an asked question is unanswered, for any severity
- The variance policy is on whenever a baseline resolved (variance review active). Errors-only reviews behave exactly as today (L5).
- `detector_kind: 'ai'` stays non-gating even if asked, per L4 and AC-V9.
- Existing reason mapping is reused unchanged:
  - Ask owner = status `counsel` → `awaiting_counsel`
  - "unclear" stays blocking
  - Mark expected = dismissed plus `reasonCode` → resolved
- The policy values live in the rules config (A12 warn-only switch).
- `GateReason` gains an optional `owner` for popover grouping.

**Rejected:**

| Alternative | Why rejected |
|---|---|
| Add `kind` and fields to `Finding` | Moves the contracts snapshot, `FindingWire` and the D1 `finding` table |
| Parallel `ChangeRow` type | Rebuilds triage, questions, sheet, answers, D1 keys and fingerprints (all keyed by `Finding.id`) |
| New issue classes (`change`, `regression`) | Edits the 15-class enum, the D1 `issue_class` FK seed, counts wording in README and docs |
| Severity `critical` for changes | Pollutes the severity chips |

**Risks:**
- Chip counts must exclude change rows. Errors counts only kind=error.
- `finding` D1 table CHECKs on `detector_id` or `pattern_key` need verifying at PLAN. The wire size is small.
- Anchor for a removed unit is approximate.

## D3. Form impact

**Chosen: `variance/impact.ts`, a pure function over data already prepared. No new graph engine.**

`computeImpact(change, A, B)` takes `{structure, graph}` for both sides. It uses `investorModelOf` for each side (cached), `Structure.conditionals`, and `buildStructureView` only for labels.

- **Affected investor types:** the union, over both sides, of paths whose `sections` or `questions` intersect the changed unit's section key, plus `typesIn(hunk text)`.
- **Affected conditional paths:** conditionals whose `blockIndex` or `targets` intersect the changed blocks, shown as old→new trigger/action pairs.
- **"Old form rule reusable" = yes** only when all of these hold:
  - impact sets are empty
  - the unit touches no conditional, question, option or field
  - the baseline and new affected investor sets are equal
- Anything else is **no**. Unknown or `InvestorPath.uncertain` means no, flagged "uncertain".

**Jurisdiction gap (demo 4.2):**
- Add a tiny rules-config dimension `audience_dimensions` (US vs non-US, plus named-country patterns such as Singapore).
- The extractor diffs audience qualifiers between old and new clause text and adds the complement audience when a restriction word is present ("now applies only to").
- It then maps to entity family via `typesIn`.
- Output for 4.2: "entities affected; US entities lose the beneficial-owner question; old rule not reusable". It is labelled "from the logic graph and qualifier rules, deterministic".
- On real samples it may be partial and is labelled uncertain.

**Rejected:**

| Alternative | Why rejected |
|---|---|
| Add a jurisdiction dimension to the frozen investor model | Contract and graph risk, and investor ground truth (P2-2) is unproven |
| LLM-written impact | Violates AC-V9 |
| Impact only from the diff text | Not "from the graph" |

**Risk:** impact precision on real documents is unproven. The deterministic label and the "uncertain" flag are the mitigation. The demo claim is pinned by the authored fixture.

## D4. Owner routing and two-owner questions

**Chosen: routing table in the rules config, and one question per (finding, owner).**
- Rules are ordered. A rule matches on change_type, section-title regex, rule id, keywords and impact flags, and returns 1-2 owners plus a one-line reason. Default is counsel.
- Demo mappings:
  - 7A to fund admin
  - Singapore (named country) to GP and counsel
  - sanctions representation to counsel
  - 4.2 to counsel
  - Class A minimum to GP
  - tax status to counsel (A9)
  - trust split to GP (A9)
  - AML/KYC keywords to fund admin
- Error findings get an owner from an `issue_class` row in the same table, default counsel.
- **Keying:**
  - A change finding's question key is `<findingId>@<owner>`. Error findings keep the plain id, so legacy tests are untouched.
  - `UNIQUE(workspace, review_run, finding_key)` stays as is.
  - Question ids, the sheet map and answers use the composite key.
- **Triage and gate:** the finding keeps one triage status. `GateState` gains an optional `ownerAnswers`. The finding resolves only when every asked owner has A/B/C. Any "unclear" gives `unclear`, and any missing answer gives `awaiting_counsel`.
- **Override:**
  - Stored client-side in the `uiState` key-value table.
  - Persisted server-side at ask time as `counsel_question.owner` plus `owner_source` (`suggested` or `override`).
  - No separate write path and no new audit action.
- **Questions screen:**
  - Group by owner tabs `All · Counsel · GP · Fund admin` with unanswered counts.
  - `CounselSheet.meta` gains an optional `owner`, and `buildSheet` filters per owner.
  - Per-owner DOCX export reuses the existing builder.
  - Counts come from one selector shared with the gate popover.
- Question wording: `template-draft.ts` gets a deterministic `version_drift` plus `change_type` path (old text, new text, A/B/C options). The intent field is human-only.

**Rejected:**

| Alternative | Why rejected |
|---|---|
| One question with two owners | Violates AC-V12 and AC-V13 |
| Change `UNIQUE` to include owner | Needs a destructive D1 migration |
| Separate owner-sheet entity | Needless |
| Server-side owner overrides table | More writes and no extra value |

**Risk:** the composite key must not leak into error flows. Keep one `questionKey()` helper and a matrix test.

## D5. Intent, scope, regression storage and migration

**Chosen: one forward-only migration, additive columns plus one table, additive contract fields.**

**Migration number:** allocate at the start of the memory-backend phase (V3) by listing the migrations folder. Assume 0006 if variance goes first, else 0007. The file slug is `variance`. Never edit a landed migration. The file does the following:
- `ALTER` adds nullable columns:
  - `counsel_question.owner` and `owner_source` (CHECK-ed)
  - `counsel_answer.intent` and `scope`
  - `decision.intent` and `scope`
- **DROP and CREATE** `decision_guard_update` and `answer_guard_update` so the new columns are immutable. This is the research gap: the existing triggers list columns explicitly.
- `CREATE TABLE regression_check`:
  - `id`, `workspace_id`, `law_firm_id`, `source_answer_id`, `source_fund_name`
  - `assertion_kind CHECK = 'scope_exists'`, `assertion_key` (normalized label, at most 80 chars), `statement_text`
  - `status` (active | revoked), `created_at`
- Append-only: delete is blocked, and only the status flip is allowed.
- Add a cap per firm and the same triggers as peers: `demo_ro_regression_check` insert, update and delete.
- Seed `law_firm` and `law_firm_alias` for H&C with `INSERT OR IGNORE`.
- The last result per document (holds / violated / n/a) is derived on the client each review and stored only inside the uploaded regression finding. It gets no D1 column (saves rows_written).

**Contracts (additive, snapshot regenerated with a change note):**
- `CounselQuestionRequest`: `owner?`, `owner_source?`
- `CounselAnswerRequest`:
  - `intent?` (at most 500 chars)
  - `scope?` (`fund` | `firm_template`)
  - `assertion?` (`{kind:'scope_exists', label}`)
  - Server rule: `scope = firm_template` without a non-empty intent is refused (AC-V14, enforced server-side and in the dialog).
- `ActiveDecision`: `intent?`, `scope?`
- `AUDIT_ACTIONS` gains exactly one value: `regression_check_created`
- `answer_recorded` audit detail carries `scope` and the intent length (never text).

**Assertion creation:**
- It is offered only when the answered finding carries `facts.assertion_candidate = {kind:'scope_exists', label}`. For R-01 this is a removed or added appendix unit, producing "Appendix C must exist".
- The preview line is produced by `describeAssertion()`.
- Other firm-template answers store intent and scope and show "no automatic check for this item".

**Regression run (pure core):**
- `runRegressionChecks(structure, checks)` evaluates `scope_exists` against `Structure.scopes` using `scopeLabel` normalization.
- A violation becomes a critical regression finding labelled "Regression: confirmed in <fund>", with the check statement as the quote.
- Checks are fetched inside the existing firm-memory lookup response (an optional `regression_checks` array), not a new route. The SELECT is scoped by both `workspace_id` and `law_firm_id` (AC-V16 cross-firm).

**Scope rule for labels:**
- A decision with `scope = fund` only counts for `already_answered` in the same `fund_name`.
- Implemented as a small deterministic condition in `memory/label.ts`.
- PLAN verifies that `ActiveDecision` exposes `fund_name`.

**Client write path:**
- Dexie outbox kinds `decide|answer|revoke` are unchanged. The answer op carries the new optional fields.
- The stub memory API, the real memory API and `api-contract.test.ts` all change. Stub and real behave the same, and the stub enforces the same intent rule.

**Weights and budget:**
- The answer-with-assertion path adds 2 rows (the check row and its audit row). Add a `MEMORY_WRITE_WEIGHTS` entry and update the `rows-written` test.
- Question creation adds 0 rows.
- The D4 burst remains an operator residual (R2).

**No Dexie version bump:** all variance client state (baseline pointer, change triage, owner overrides) uses the existing `uiState` key-value table, avoiding a collision with Intake's `version(2)`.

**Rejected:**

| Alternative | Why rejected |
|---|---|
| Pack intent into `note` | Not queryable, 1000-character budget shared |
| New `answer_context` table | One more write and more triggers for no gain |
| Reuse `firm_rule` for assertions | Free text injected into prompts, not machine-checkable |
| Store the per-doc regression result in D1 | Needless rows_written and privacy surface |
| Generalized assertion grammar | Cut by L7 |

## D6. Baseline selection and the Intake interface

**Chosen rules:**
- One baseline per review (A8). The input is the package documents with role `baseline`.
- If more than one baseline exists, pick the most recently marked. Tie-break by `createdAt` descending, then document id ascending. A muted line says "N other baseline(s) ignored (one baseline per review)".
- Same firm only. The check is enforced in two places: the baseline-source adapter, and again in `runVariance` (D1 step 0). Unknown firm means no baseline.
- Each to-digitize document is diffed independently against the chosen baseline. There is no pairwise matrix.
- No baseline: the L5 muted line and Errors only. On review completion the document becomes the firm's baseline by writing the pointer.

**Coupling:** one adapter file, `apps/web/src/features/variance/baseline-source.ts`.
- It ships with an interim implementation that works without Intake:
  - candidates are same-firm documents in Dexie `documents` (24 h)
  - the baseline pointer lives in `uiState`
- When Intake lands, only this file swaps to read package roles.
- This removes the build-order block: variance is testable now.

**Assumed Intake interface (assumption list for the Intake dependency):**
1. A way to enumerate the current package's documents with `{docId, lawFirmId, fundName, versionLabel, role, roleMarkedAt, createdAt, bytesAvailable}`.
2. A setter that changes a document's role to `baseline` for the same firm only, and rejects cross-firm.
3. Document bytes are readable from the browser store while within 24 h. `bytesAvailable=false` is surfaced, and the analyst must re-add the document.
4. A package-scoped change event, or a hook, that fires when roles are confirmed. Until then, variance triggers on open-document.
5. The package role UI itself (Upload confirmation table) is Intake's. Variance adds only the Findings header baseline control, which edits the same role.
6. D1 package metadata is Intake's. Variance persists nothing about the baseline server-side.
7. Intake may change `computeGate` for coverage. Variance only appends optional policy fields. Whoever lands second rebases.

**Rejected:**

| Alternative | Why rejected |
|---|---|
| Wait for Intake and bind to its types | Blocks planning, high coupling |
| Variance builds its own package concept | Duplicates Intake U4 |
| Allow multiple baselines | Out of scope (A8) |
| Auto-suggest baseline | Intake U14, P2 |

**Risk:** Intake could land different role semantics. The adapter absorbs that.

## D7. Fixtures and the Hartwell & Crane firm

**Chosen:**
- **Variance owns a seeded corpus `fixtures/variance/`:**
  - H&C Fund II baseline and Fund III documents, authored so raw is exactly 214 (about 118 renumber, 41 fund name, plus dates, Units/Shares, format) and 7 shown changes (3 new, 4 logic, one per owner case in the mockup).
  - Seeded trap pairs for the recall and precision matrices.
  - Real pair #5/#6 (`partners-group`) as the second test.
- **Generator:** a new `scripts/src/fixtures/build-variance.ts`, invoked by a one-line append in `build-seeded.ts`. Intake edits a different file.
- **Firm ownership:**
  - Intake is the preferred owner of the firm record.
  - Variance defines the exact byte-identical entry now so either side can add it: id `hartwell-crane`, name "Hartwell & Crane LLP", aliases "Hartwell & Crane", "H&C".
  - The Variance migration uses `INSERT OR IGNORE` for the D1 rows.
  - The first slice checks `fixtures/memory/law-firms.json`. If the entry is absent, it adds it, in `law-firms.json`, core `LAW_FIRMS` and the generated `firms.json`. An identical addition from Intake is then a no-op merge.
- Record this as an Intake dependency note.
- The demo seed (a pre-recorded R-01 firm-template answer plus check in the demo workspace) is a deploy-slice extra. Tests record the Fund II answer live, so the feature does not depend on the seed.

**Rejected:**

| Alternative | Why rejected |
|---|---|
| Reuse only #5/#6 | Cannot give 214 → 7 or the 7 owner cases |
| Reuse the small `fund-I/II` memory fixtures | Far too small |
| Extend the shared `build-seeded.ts` heavily | Collides with Intake |
| Variance skips the firm | Same-firm tests need it |

**Risk:** the firm appears in 4 mirrors (json, core, web json, D1). Keep one source test (`firms-and-rules`). The `seed:check` demo spec changes only if the demo seed is added.

## D8. LLM use

**Chosen: 0 live calls. Reserve 0 of 6.**
- No new AI task. `AI_TASK_IDS` and the contracts snapshot do not move for this reason.
- `runVariance` takes no AI input, so class, owner, impact and gate cannot depend on AI.
- AC-V9 test:
  - construct AI findings (hand-built or an existing recording) that contradict the rules
  - assert classes, owners, impact and gate are byte-equal with and without them
  - an AI finding never gates, even when asked
- Intent is human-entered. There is no AI intent draft.
- Wording is the deterministic template.
- The live AI sweep stays an operator residual (R2).

**Rejected:**

| Alternative | Why rejected |
|---|---|
| AI change-explanation task | Needs a new registered task, prompt and recording, and uses budget, for no AC |
| AI intent draft | Optional in the SPEC, and risk against AC-V15 |

## D9. Render-first

**Chosen: errors paint exactly as today. Variance is a second local pass in the engine worker.**
- Variance never awaits session, Turnstile or memory.
- It reuses the diff preparation path (two `runDeterministic` passes, about 0.34 s on #5/#6; the budget is under 5 s).
- It returns plain JSON: Finding objects plus a meta record keyed by finding id, and the cosmetic groups. This keeps the main-thread import allow-list (`import-graph.test.ts`) growth minimal (append at most one line).
- While variance is in flight, the gate pill shows a UI-only "Checking changes" pending display, the same treatment as memory-pending (PLAN reuses it). `computeGate` stays exactly two states, so there is no flash of Ready then Blocked.
- Regression checks arrive with the memory lookup, in the background, then append their finding and recompute the gate.
- Determinism: the variance output is a pure function of the two documents and the rules config.

**Rejected:**

| Alternative | Why rejected |
|---|---|
| Block first paint on variance | Breaks the render-first rule |
| Run variance server-side | CPU p99 already 16 ms vs the 10 ms Free limit, and the baseline text lives in the browser |
| Fetch regression checks eagerly before paint | Network on the paint path |

## D10. Slicing and plan shape

**Chosen: a 5-phase program, not a single plan.** The work spans 4 packages and a schema migration, and includes a shared-file collision zone with Intake. Each phase runs the inner loop (R→I→P→PVL→E→EVL→UP).

| Phase | Content | Depends on |
|---|---|---|
| V1 Core engine | rules config + hash, hunker, classifier, cosmetic groups, impact, routing, `scope_exists` check, finding adapter, gate policy + `ownerAnswers`, sheet `owner`, corpus + generator, `variance-*` core tests, run `diff-contract`, `diff-determinism`, `gate-state-matrix`, `sheet-contents`, `record:author --check` | none |
| V2 Web: Findings | engine-worker method, baseline adapter (interim), variance store in `uiState`, change rows, filter All/Errors/Changes, header baseline control and modal, cosmetic groups, no-baseline line, gate pending, count selector | V1 |
| V3 Memory backend | migration, additive contracts + snapshot note, Worker route/repo/weights/triggers, stub + real API + outbox, `memory/label.ts` scope rule, worker tests and `stack-memory` tests | V1, parallel-safe with V2 |
| V4 Owners and answers | owner chips and override, per-owner question keys, Questions grouping and per-owner export, template wording, answer modal intent/scope + preview, regression client wiring | V2, V3 |
| V5 Demo, e2e, deploy | `variance-*` e2e specs, 214-to-7, gate walk, perf and a11y re-runs, remote migration, then Worker deploy before web, demo seed, context docs | V1-V4 |

Notes:
- Keep "no new screens or sidebar items". The baseline modal and the Questions tabs are folded into existing screens.
- Shared single-line append points (barrel `src/index.ts`, `import-graph` ALLOWED, the contracts snapshot) are serialized.
- Playwright runs serially on port 4317. Run one token per call.
- Deploy only to `aduin-transaction-web.giathaowork.workers.dev`.

**Rejected:**

| Alternative | Why rejected |
|---|---|
| One plan | Too many touchpoints and a high-risk class (schema/migration), a poor PVL surface |
| Layer-by-layer (all core, all web, all worker) | Delays the first demonstrable slice |
| Intake-first hard dependency | Needless wait, the adapter covers it |

---

## Risk Predictions (vc-predict, 5 personas)

**Verdict: CAUTION.** Proceed, with the mitigations below.

| Persona | Concern | Mitigation |
|---|---|---|
| Architect | Adapter approach hides variance data in `detail.facts` and the `variance.` prefix | Single typed accessor `varianceMetaOf(finding)` with a zod parse. Contract test that every adapter output is a valid `FindingSchema` |
| Architect | Gate policy flag changes behavior by mode | Default undefined = legacy; a test pins gate matrix equality with policy off |
| Security | Cross-firm leak through a regression check lookup | Query by `workspace_id` AND `law_firm_id`. Server test in `stack-memory`. Server re-normalizes the assertion key, enum kind, label at most 80 chars |
| Security | Client sends a forged `scope`/`assertion` | Validation server-side. A cap on checks per firm. Audit `regression_check_created` |
| Security | New columns unguarded (append-only breach) | Recreate both guard triggers in the migration, covered by the `triggers` tests |
| Ops | Live remote D1 migration | Forward-only, additive, `INSERT OR IGNORE`. Deploy Worker before web (F12 rule). Rollback keeps columns nullable, so old code still works |
| Ops | rows_written budget | New weight and test. Burst stays an operator residual |
| Cost | Free plan CPU | Diff and variance stay in the browser. Server writes add 2 rows only on firm-template answers |
| Cost | LLM budget | 0 live calls, no new AI task |
| User | Too many untriaged changes block the gate | Config policy switch (A12). One-click mark expected with reason. Cosmetic never blocks |
| User | Misclassification | Default to logic, positive cosmetic rules only, "Show cosmetic" always available |
| Devil's Advocate | "Why not just reuse the diff screen?" | The SPEC needs triage, owners, questions and the gate, and Compare stays unchanged |
| Devil's Advocate | 214 is a number we author | Accepted: the metric is defined and pinned, and the real pair #5/#6 validates the algorithm without a magic number |

**Verification gates PLAN must schedule:**
- V1 first task: confirm `buildUnits` or unit-text access and the alignment's number map exist.
- V1 first task: confirm `finding` table CHECKs and `ActiveDecision.fund_name`.
- Gate regression: `gate-state-matrix` with the policy off.
- `record:author --check` after any diff-adjacent change, since candidate quotes move the drift-narrative `inputHash`.

## Key Constraints Accepted

- Frozen v1 contracts stay additive. Only `contracts/memory.ts` moves (intent, scope, owner, assertion, one audit action), with a snapshot regeneration note.
- No new issue class and no new screen. README and docs counts are unchanged.
- Intent is human-only. AI never gates. 0 live AI calls.
- The gate stays two states. The pending indicator is UI-only.
- One baseline per review, same firm only. The interim adapter is replaced by Intake later.
- The only regression kind in the MVP is `scope_exists`.
- Dexie has no version bump. Migration number is allocated at V3 start.
- Free OpenRouter models only. Deploy only to `aduin-transaction-web.giathaowork.workers.dev`.
- Skills the PLAN should surface: `vc-generate-plan`, `vc-generate-phase-program`, `vc-scenario` and `vc-security` (D1 cross-firm and migration), `vc-risk-evidence-pack` (schema/migration is a high-risk class), `vc-test-coverage-plan`.

## Suggested Phase Ordering
```
Phase 1 (V1): Core engine + corpus      - no dependencies
Phase 2 (V2): Web Findings integration  - depends on Phase 1
Phase 3 (V3): Memory backend            - depends on Phase 1, parallel-safe with Phase 2
Phase 4 (V4): Owners, answers, regression UI - depends on Phase 2 and Phase 3
Phase 5 (V5): Demo e2e + deploy         - depends on Phases 1-4
```

## Phase-END Strategy Recommendation (for PLAN)

Signals present: S1 multi-package, S2 schema/API surface, S3 multiple directions, S4 phase program, S6 high-risk (migration), S7 5+ files. Score 6/7.

| Option | Cost | Verdict |
|---|---|---|
| Sequential | low | Never valid for 3+ phase plan creation |
| Parallel subagents | medium | Rejected: phase plans share files (barrel, snapshot, `state/review.ts`) and cannot coordinate |
| Workflow | high setup | Overkill |
| **Agent team (recommended)** | medium-high | 5 plan authors (sonnet), named teammates + shared task list (TeamCreate, TaskCreate/TaskUpdate, Agent with team_name/name, SendMessage, TaskList) to keep blast radii disjoint (V2 vs V3) and declare dependencies |

Model: sonnet for PLAN and all non-EXECUTE phases. Opus only for the vc-execute-agent legs.

## TL;DR
- Reuse Finding: variance changes become frozen-v1 findings (`version_drift`) with metadata in `detail.facts`. This avoids a contract change and avoids a parallel row type.
- A "raw change" is one word-level hunk (recomputed from full unit text), and the fixture is authored to give exactly 214.
- Classification defaults to logic. Cosmetic needs a positive rule, and the algorithm is ordered with rule ids.
- Owners are routed by a config table. Each (finding, owner) gets its own question key (`<id>@<owner>`).
- One migration: additive columns, one `regression_check` table, recreated guard triggers, and one new audit action.
- The baseline comes through a single adapter file, so Intake can land later without touching variance.
- 0 AI calls. Errors render first, and variance and regression arrive in the background.
- 5-phase program, with plan creation by an agent team.

## Unresolved questions for PLAN
1. Does `DiffResult` or `align.ts` expose the old→new section number map and full unit text? If not, one additive export is needed.
2. Do the D1 `finding` table CHECKs constrain `detector_id`/`pattern_key`, and does `ActiveDecision` carry `fund_name`?
3. Exact migration number, depending on whether Intake's migration lands first.
4. Whether the gate has an existing "pending" visual to reuse (memory-pending), or one UI-only flag must be added.

PHASE_COMPLETE: INNOVATE — Decision Summary written

**Status:** DONE
**Summary:** Decided all 10 questions with chosen approaches, rejected alternatives and risks. Wrote the Assumed Intake interface, the 5-phase slicing and the vc-predict result (CAUTION).
**Concerns/Blockers:** Four unresolved items are listed above; they are PLAN-time verifications, not blockers. The Intake data model is still assumed, isolated behind a single adapter file.