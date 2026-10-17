---
name: spec:variance-mvp
description: "SPEC delta for slim variance management (V1 baseline diff vs same-firm prior funds with change classification; V2 form impact, owner routing, per-owner questions, answer intent/scope, one regression check) folded into the existing sub-doc QA app"
date: 17-10-26
feature: variance-management
metadata:
  type: spec
  phase: SPEC
  status: draft-for-user-review
  extends: subdoc-qa-mvp (AC1-AC64 stay in force; new ACs are AC-V1 onward)
---

# SPEC delta: Variance management, slim MVP (V1 + V2)

**BLUF:** Today the app finds defects inside one document. This delta adds the question the analyst really asks
on every new fund: "what is different from what we already know, what does it do to the form, and who must
confirm it?" It compares a new document to the same law firm's earlier fund, hides cosmetic noise (214 raw changes
become 7 that matter), shows the form impact computed from the logic graph, routes each change to counsel, GP or
fund admin, groups questions per owner, and remembers the answer with its intent. One regression example proves
memory can re-check an old answer. No new screens: everything folds into Findings, Questions, Record-answer and the gate pill.

Reads with the base SPEC `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_SPEC_17-10-26.md`.
Sources: the user's PRD "Legal Reviewer" (sections 3, 6.2, 8, 9, 11, 12), the UI notes
`design/mockups/app-variance_NOTES.md`, and the current architecture docs.

## Locked Decisions (user, 17-10-26)

| # | Decision |
|---|---|
| L1 | Slim MVP = V1 + V2 only. V1: baseline is prior funds or prior versions of the SAME law firm only (Tier 1); each change is `new`, `changed_logic` or `changed_cosmetic`; cosmetic hidden by default. V2: deterministic impact (investor types, conditional paths, "old form rule reusable yes/no"), owner routing from a configurable table (analyst can override), questions grouped per owner with one export per owner, answer capture = option + note + intent + scope (this fund only / firm template) |
| L2 | Exactly ONE regression example, the R-01 pattern: a firm-template answer ("Appendix C must exist") is re-checked on the new document; violated gives a blocking finding labelled "Regression: confirmed in <fund>" |
| L3 | Gate stays 2 states: Blocked · N / Ready to digitize. Unanswered asked questions count as blocking |
| L4 | No new screens or sidebar items. Findings gets an All / Errors / Changes filter, change rows and a baseline control in its header. "Counsel questions" is renamed "Questions" with owner grouping. Record-answer modal gets intent and scope. The gate pill stays where it is |
| L5 | No baseline available: the review runs Errors only, and that document becomes the firm's baseline. One muted line in the UI |
| L6 | Rules config (routing table, cosmetic-vs-logic criteria, gate policy) lives in a versioned, schema-validated config file. Its version/hash is recorded in finding provenance. No UI for it in the MVP |
| L7 | Cut as future work: market-standard template baseline (Tier 2) and "Unusual vs market"; first-review logic groups; cross-doc mismatch; rules-in-effect UI; generalized regression checks; 3-state gate; adversarial investor personas (PRD F13); multi-document cross-check (PRD F14) |
| L8 | Carried constraints: free models only; AI never gates and must quote real text; memory never crosses law firms or workspaces; other firms' documents are never a baseline; deterministic results reproducible; Cloudflare Workers Free + D1; TypeScript stack (the PRD's Python/Streamlit suggestion is NOT adopted) |
| L9 | Demo: Hartwell & Crane LLP, Northgate Infrastructure Fund III vs Fund II baseline. Second real-data test: public samples #5 to #6 |

## Summary

Anduin's analysts see only the final text of each document. They cannot tell whether a changed clause is a
deliberate policy change, a drafting habit or a mistake, and they may not decide it themselves. Finding the
differences, judging their effect on the form and asking the right person is manual, scattered and forgotten.
This delta lets the analyst pick a baseline from the same firm's history, see only the changes that matter, see what each
does to the form, send each owner one short question sheet, and have the answer and its reason stored for the next fund.

## Problem (PRD section 3, condensed)

| What the analyst lacks | Meaning | Example |
|---|---|---|
| Intent | Does not know why a clause was written that way | Is the new wording in 4.2 deliberate or a slip? |
| Authority | Not allowed to pick a reading for counsel or the GP | Can guess, still cannot decide |
| Visibility | Does not see side letters, emails, fund-admin policy | Why did the minimum change? |

Result: forms are built on unclear input and redone. Differences come from six sources (law, fund structure, policy, side
agreements, drafting habit, version timing); this MVP covers the ones visible by comparing to the same firm's earlier fund.

## Job To Be Done

When I receive a new fund's (or new version's) subscription document, I want to see at once what differs from what Anduin
already knows for this firm, what it does to the form, and who must confirm it, so I build the form right the first time
without guessing for the lawyer or the GP.

## User Stories

| ID | As a... | I want... | So that... |
|---|---|---|---|
| VS1 | Analyst | to pick a baseline from this firm's earlier funds or versions of this fund | the app compares against the right precedent |
| VS2 | Analyst | cosmetic changes hidden by default, shown on request, grouped | I read 7 changes, not 214 |
| VS3 | Analyst | each change labelled new / changed logic with old and new text and the quoted clause | I can verify it without hunting |
| VS4 | Analyst | the effect on the form: affected investor types, affected conditional paths, whether the old form rule can be reused | I know the build impact before asking anyone |
| VS5 | Analyst | a suggested owner per change (counsel, GP, fund admin) that I can override | I ask the person with authority |
| VS6 | Analyst | questions grouped per owner, one export per owner | each person gets one short sheet |
| VS7 | Analyst | to record the answer with option, note, the intent ("why is it written this way") and scope (this fund only / firm template) | the reason is kept, not just the choice |
| VS8 | Analyst | a firm-template answer re-checked on the next fund, with a blocking finding if violated | an old confirmed answer is not silently broken |
| VS9 | Analyst | the gate to count untriaged changes and unanswered asked questions | I never start the build with open questions |
| VS10 | Analyst (new firm) | a plain line saying no baseline exists, with Errors-only review, and that this document becomes the baseline | the first review is still useful and seeds the next |
| VS11 | GP (question recipient) | short questions about thresholds, policy, new jurisdictions, with quote and options | I can answer in one line |
| VS12 | Counsel (question recipient) | drafting and meaning questions with quote, old vs new text, options | I answer once, with intent |
| VS13 | Fund admin (question recipient) | only AML/KYC questions | I do not read what is not mine |
| VS14 | Team lead | to see which rules config version produced each finding, and the owner and intent behind each answer | I can audit and trust results |

## What The User Wants (Behavioral Outcomes)

1. **Choose a baseline.** A baseline control in the Findings header lists only this firm's earlier documents (prior funds, prior versions). Documents of other firms never appear. One or more may be ticked.
2. **See what changed, quietly.** Findings has a filter All / Errors / Changes. Changes shows only `new` and `changed_logic` rows. Cosmetic rows are off by default; a filter option reveals them as a few grouped rows with counts.
3. **Read each change.** Expanding a change row shows old text above new text with removed and added words marked in text, not by colour alone, plus the quoted clause and location.
4. **See the impact.** The row says which investor types are affected, which conditional paths are affected, and "old form rule reusable: yes/no". It is labelled "from the logic graph, deterministic".
5. **See the suggested owner.** An owner chip on the row; the analyst can change it before asking. A change with two owners becomes two questions (for example Singapore: GP and counsel).
6. **Decide.** Per change: ask the owner (existing "Needs counsel" action renamed on change rows) or mark "expected" with a required reason. Untriaged New or Logic changes keep the gate Blocked.
7. **Questions per owner.** The Questions screen groups by Counsel / GP / Fund admin with unanswered counts and one export per owner (DOCX).
8. **Record the answer.** The Record-answer dialog captures option, note, intent and scope. Scope "firm template" requires an intent and shows a one-line preview of the check it will create.
9. **Regression.** A firm-template answer of the supported form ("X must exist") is checked on the next document of the same firm. If violated: a blocking finding "Regression: confirmed in <fund>".
10. **No baseline.** Muted line: "No earlier document from this firm. Reviewing for errors only. This document becomes the baseline." Changes filter is empty; errors work as today.
11. **Gate.** The pill stays: Blocked · N, or Ready to digitize. N counts open blocking errors, untriaged New/Logic changes, and asked questions without a clear answer (answer "unclear" keeps it blocking).

## Flow / State Diagram

Analyst journey (new steps marked V):

```
 [Open document: firm + fund + version] --> checks as today (Errors)
        |
        V: does this firm have an earlier document?
        |--no--> "Errors only; this becomes the baseline" (muted line) ------------------+
        |--yes--> pick baseline (Tier 1 only) --> raw diff (e.g. 214 changes)            |
                         |                                                              |
                         V: classify each: new | changed_logic | changed_cosmetic        |
                         V: cosmetic hidden (filter reveals, grouped)                    |
                         V: impact from logic graph (types, paths, old rule reusable?)   |
                         V: owner from routing table (analyst may override)              |
                         V: regression checks from firm-template answers (R-01)          |
                         v                                                              v
                 [Findings: All / Errors / Changes (7 + R-01)] <------------------------+
                         | per change: Ask owner  |  Mark expected (reason required)
                         v
        [Questions: Counsel n | GP n | Fund admin n] --export per owner (DOCX)--> owner replies
                         |
                         v  Record answer: option + note + intent + scope
                         |  scope = firm template --> regression check saved to firm memory
                         v
        [Gate]  Blocked · N  <------------------------->  Ready to digitize
```

Change lifecycle:

```
 raw diff item --classify--> changed_cosmetic --> hidden (counted, shown on request, never blocks)
                         |--> new / changed_logic --> untriaged (blocks)
                                   |--Ask owner--> asked (blocks until clear answer)
                                   |                  |--answered A/B/C--> resolved (stops blocking)
                                   |                  '--"unclear"------> stays blocking
                                   '--Mark expected (reason)--> resolved
 regression check --run on new doc--> holds (no finding) | violated (blocking finding) | not applicable
```

## Acceptance Criteria (Testable Outcomes)

Strategy tags as in the base SPEC: **FA** Fully-Automated, **H** Hybrid, **AP** Agent-Probe. Scenario names are provisional and finalized in PLAN; they extend the existing test shape in `process/context/tests/all-tests.md` (golden corpus, seeded defects, recorded-LLM, E2E browser). Priorities: P0 = needed in the demo.

### A. Baseline and classification (V1)

**AC-V1. [P0] The baseline list contains only this firm's documents.** The baseline control offers prior funds and versions of the same law firm and workspace; documents of another firm or workspace are never offered or used, even if the text is identical.
- proven by: `variance-baseline-same-firm-only-e2e` (two firms, same text); strategy: FA

**AC-V2. [P0] Every change is classified.** Each raw change is exactly one of `new`, `changed_logic`, `changed_cosmetic`, with the matched old and new passages and the rule that decided it.
- proven by: `variance-classification-contract` (property test: one class per change, evidence present); strategy: FA

**AC-V3. [P0] Cosmetic changes are hidden by default and countable.** Default view shows only new and logic changes; the cosmetic count is stated; a filter option reveals them as grouped rows (for example renumbering, fund name, dates, Units to Shares).
- proven by: `variance-cosmetic-hidden-default-e2e`; strategy: FA

**AC-V4. [P0] Demo reduction.** Hartwell & Crane Fund III vs Fund II fixture: 214 raw changes yield exactly 7 shown changes (3 new, 4 logic) plus the R-01 regression; the other 207 are cosmetic or grouped away.
- proven by: `variance-demo-214-to-7-e2e`; strategy: FA

**AC-V5. [P0] Recall on seeded variances is 100%.** Every seeded new and logic change in the fixtures is shown with correct class and location; none is classified cosmetic.
- proven by: `variance-seeded-recall-matrix` (one row per seeded change, including the 7 demo items); strategy: FA

**AC-V6. [P0] Cosmetic misclassified as logic stays within the precision target.** On the seeded corpus plus real pair #5 to #6, at most 10% of items shown as logic are in fact cosmetic (target to confirm, see Assumptions).
- proven by: `variance-precision-measure` (seeded cosmetic traps plus #5/#6 Units to Shares); strategy: FA

**AC-V7. [P0] Real-data case #5 to #6.** Units to Shares is cosmetic (hidden); class-specific fees are `changed_logic`; Appendix C removed is shown as a change; both swapped references fixed stay in the existing diff.
- proven by: `variance-golden-05-06` (extends `golden-05-06-drift`); strategy: FA for classification, H for any AI wording

**AC-V8. [P0] No baseline means Errors only.** A firm with no earlier document gets the muted line, an empty Changes filter and normal errors; after review that document is offered as the firm's baseline for the next one.
- proven by: `variance-no-baseline-errors-only-e2e` (new firm, then second document finds the first as baseline); strategy: FA

**AC-V9. [P0] Changes are never AI-gated.** Classification and the gate use deterministic results only; AI text appears only as labelled suggestions that quote real document text, and never changes class, owner or gate.
- proven by: `variance-ai-never-gates-e2e` (recorded AI that contradicts the rules; class and gate unchanged); strategy: H

### B. Impact, routing and questions (V2)

**AC-V10. [P0] Impact is computed from the logic graph.** Each new/logic change lists affected investor types, affected conditional paths and "old form rule reusable yes/no", reproducibly. Demo: 4.2 now applies only to entities formed outside the US: entities affected, US entities lose the beneficial-owner question, old rule not reusable.
- proven by: `variance-impact-from-graph-fixtures` (per change type) plus `variance-impact-demo-4-2`; strategy: FA

**AC-V11. [P0] Owner is suggested by the routing table and can be overridden.** Owners come from the rules config. Demo: 7A to fund admin; Singapore to GP and counsel; sanctions representation to counsel; 4.2 to counsel; Class A minimum to GP. An override is saved and recorded.
- proven by: `variance-routing-table-matrix` plus `variance-owner-override-e2e`; strategy: FA

**AC-V12. [P0] A two-owner change becomes two questions.** Singapore yields one GP question and one counsel question, each answerable alone.
- proven by: `variance-two-owner-two-questions-e2e`; strategy: FA

**AC-V13. [P0] Questions are grouped per owner with one export per owner.** The Questions screen shows owner groups with unanswered counts; each export contains only that owner's questions, with quote, old vs new text and options. Equal counts appear in the gate reasons.
- proven by: `variance-questions-by-owner-export-e2e` (parse each DOCX; no other owner's items); strategy: FA

**AC-V14. [P0] An answer records option, note, intent and scope.** The dialog saves option, note, intent and scope (this fund only / firm template). Scope "firm template" is refused without an intent. The record shows who and when, and is kept (append-only).
- proven by: `variance-answer-record-intent-scope-e2e` plus `variance-answer-append-only`; strategy: FA

**AC-V15. [P0] Intent is human-entered.** The tool never writes or edits the intent text; an AI suggestion, if present, is a clearly labelled draft the analyst must accept.
- proven by: `variance-intent-human-only-e2e`; strategy: FA

### C. Regression, gate, reproducibility

**AC-V16. [P0] The R-01 regression check works.** After a "firm template" answer "Appendix C must exist" at Fund II, reviewing Fund III with Appendix C missing yields a blocking finding "Regression: confirmed in Fund II" with the quote of the check; with Appendix C present there is no finding. A check recorded for another firm or workspace never runs.
- proven by: `variance-regression-r01-e2e` (violated, held, other firm) plus `variance-regression-no-cross-firm`; strategy: FA

**AC-V17. [P0] The gate counts untriaged changes and unanswered questions.** Blocked · N includes open blocking errors, untriaged new/logic changes, regression findings and asked questions without a clear answer ("unclear" stays blocking); Ready only at N = 0. Cosmetic changes never block. The gate has exactly two states.
- proven by: `variance-gate-state-matrix` (extends `gate-state-matrix`) plus `variance-gate-two-states-e2e`; strategy: FA

**AC-V18. [P0] Demo gate walk-through.** From Blocked, resolving the analyst's own items and then the owners' answers leads to Ready to digitize, with per-owner counts on the Questions screen matching the gate reasons.
- proven by: `variance-demo-gate-walk-e2e`; strategy: FA

**AC-V19. [P0] Rules config is versioned, validated and recorded.** Routing table, cosmetic-vs-logic criteria and gate policy load from one versioned config; an invalid config fails fast with a clear message and never produces findings; each variance finding records the config version/hash.
- proven by: `variance-rules-config-schema-and-provenance` (valid, invalid, hash in finding provenance); strategy: FA

**AC-V20. [P0] Variance results are reproducible and work with no AI.** Same inputs and config give identical changes, classes, impacts, owners and gate across repeated runs; in no-LLM mode all of this still works.
- proven by: `variance-determinism-repeat-run` plus `variance-no-llm-full-run`; strategy: FA

## Non-Functional Requirements

| Area | Requirement | Target |
|---|---|---|
| Recall | Seeded new/logic changes found | 100% (AC-V5) |
| Precision | Cosmetic shown as logic | at most 10% of logic rows (AC-V6); logic hidden as cosmetic = 0 |
| Reproducibility | Deterministic classification, impact, owner, gate | byte-equal across runs (AC-V20) |
| Safety | AI never gates; quotes must exist; no cross-firm or cross-workspace use of memory or baselines | AC-V1, AC-V9, AC-V16 |
| Cost | Free models only; no paid calls added; works at $0 | unchanged from base SPEC |
| Platform | Workers Free (10 ms CPU, 50 subrequests) and D1; diff must not break the base limits | base AC29 and AC40 re-run with variance on the demo pair |
| Performance | Fund III vs Fund II demo diff and impact | appears within the base deterministic target (under 5 s for the largest document; confirm in PLAN) |
| UI | No new screens or sidebar items; non-colour cues; keyboard operable | base AC30 re-run on changed screens |
| Privacy | Server stores snippets, hashes, metadata only | base AC58 extended to variance records |
| Language and stack | English UI; TypeScript | locked |

## Data Model Delta (required data, not a schema design)

| Needed data | Why |
|---|---|
| Finding gains a **kind** (error / change / regression) | Filter All / Errors / Changes; gate policy |
| Change finding: **change type** (new / changed_logic / changed_cosmetic), old and new quote, matched baseline document, deciding rule id | AC-V2, AC-V3 |
| Change impact: affected investor types, affected conditional paths, old rule reusable (yes/no) | AC-V10 |
| Finding **owner** (counsel / GP / fund admin), suggested owner and analyst override with who and when | AC-V11 |
| Question **owner** and link to its finding; one finding may have two questions | AC-V12, AC-V13 |
| Answer gains **intent** (text) and **scope** (this fund only / firm template) | AC-V14 |
| **Regression assertion** record: firm, source answer, source fund, the statement checked, last result per document (holds / violated / not applicable) with quote | AC-V16 |
| Per-firm **baseline marker** on a document (earlier funds and versions of the firm; the first document of a firm) | AC-V1, AC-V8 |
| **Rules config version and hash** on every variance finding | AC-V19 |
| Append-only: nothing deleted, only revoked (as today) | base AC42 |

## Out Of Scope

| Item | Why |
|---|---|
| Market-standard template baseline (Tier 2) and "Unusual vs market" | Future work (L7); only same-firm baselines |
| First-review logic groups and group confirmation | Future work (L7) |
| Cross-document mismatch (PRD `cross_doc_mismatch`), multi-document cross-check (F14) | Future work |
| Rules-in-effect UI or any UI to edit the config | Config file only (L6) |
| Generalized regression checks (more than the R-01 pattern) | Future work; the saved scope field enables it later |
| 3-state gate (Not ready / Waiting / Ready) | Gate stays 2 states (L3) |
| Adversarial investor personas (F13) | Future work |
| New screens, sidebar items or a variance dashboard | Locked (L4) |
| Using another firm's documents as baseline; sharing memory across firms | Locked (L8) |
| Multiple baselines at once with "also in Fund I" markers | One baseline per review in the MVP (see A8) |
| Legal advice or judging a clause right or wrong in law | Tool reports; owners decide |
| Python / Streamlit stack from the PRD | Not adopted (L8) |
| Anything the base SPEC already excludes (real auth, form generation, email integration, paid Workers plan) | Unchanged |

## Constraints

| Source | Constraint |
|---|---|
| User | Free models only; Cloudflare Workers Free + D1; TypeScript; English UI |
| User | AI never gates and must quote real text; deterministic results reproducible |
| User | Memory and baselines never cross law firms or workspaces |
| User | Fold into existing screens: add no screens or sidebar items |
| Base SPEC | Everything works with zero AI calls; work within the ~$10 cap (this feature adds no paid calls) |
| Base SPEC | All base ACs (AC1 to AC64) keep passing; this delta extends, never weakens, them |
| Process | Demo and test data: Hartwell & Crane fixture (seeded) plus real samples #5 and #6; sample files are untrusted input |
| Process | The UI mockup is a guide; where it shows cut features (Tier 2/3, first review, 3-state gate), this SPEC governs |

## Assumptions To Confirm With Anduin (PRD section 12, answered)

| # | PRD question / assumption | Assumption used here | Effect if wrong |
|---|---|---|---|
| A1 | Law firms reuse templates across funds | Yes; the baseline is the same firm's prior fund | Changes view shows mostly "new"; value drops, nothing breaks |
| A2 | Analyst can pick the right baseline | Yes; the app pre-checks the firm's most recent earlier document and the analyst can change it | Wrong baseline gives noisy changes; baseline shown in the header |
| A3 | Some questions belong to GP or fund admin | Yes; routing table: drafting/ambiguity/meaning to counsel; thresholds/policy/investor types to GP; new structure or country to GP + counsel; AML/KYC to fund admin | Change table values; no code change |
| A4 | How does the analyst find changes today? | Manually reading both versions | None; we target that pain |
| A5 | Who contacts counsel? | The analyst, by sending the exported sheet | If the account manager or GP sends it, the export is still the artifact |
| A6 | Rounds and wait per fund | Unknown; we measure counts of questions per owner, not time | Success metrics use counts |
| A7 | Does Anduin get the full package (PPM, LPA, side letters) or only the sub doc? | Only the subscription document | Cross-doc work stays future |
| A8 | Several baselines at once | One baseline per review | Add later |
| A9 | Owner for demo items not named (tax status select-all, trust split) | Routing table default (tax status: counsel; trust split: GP); analyst can override | Change two table rows |
| A10 | Precision target | At most 10% of logic rows are cosmetic; logic hidden as cosmetic 0 | Tune the number in PLAN |
| A11 | Intent mandatory for firm-template answers | Required (empty intent refused) | Relax later |
| A12 | An untriaged new/logic change blocks the gate | Yes (user decision L3 plus mockup) | Switch to warn-only by gate policy config |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Wrong section matching between baseline and new document | False changes or missed changes | Show old and new side by side in the row; matching by number then title then content; seeded tests |
| Cosmetic vs logic misjudged by rules | Analyst loses trust or misses a real change | Deterministic criteria in config; recall 100% tests; precision measured; "show cosmetic" always available |
| Impact computed from an incomplete logic graph | Understated impact | Label "from the logic graph"; graph gaps already reported by base detectors; never claim legal effect |
| Too many untriaged changes block the gate | Analyst fatigue | Owner chips and bulk "mark expected" with reason are within one click per row; gate policy in config |
| Regression check wrongly fires or misses | False block or silent miss | Only the "must exist" form; deterministic check; violated shows the quote; other firms never run it |
| Free-plan CPU cost of diff on large documents | Request exceeds limits | Re-run base AC29 and AC40 on the demo pair; PLAN decides where diff runs |
| Template reuse assumption (A1) is false | Little to compare | Fall back to Errors only (AC-V8) |
| Scope creep from the mockup (Tier 2/3, first review) | Slips the slim MVP | Out Of Scope table; SPEC governs |

## Success Metrics

| Metric | Target | Source |
|---|---|---|
| Changes shown vs raw on demo | 214 raw to 7 shown plus R-01 | AC-V4 |
| Recall on seeded variances | 100% | AC-V5 |
| Cosmetic misclassified as logic | at most 10% of logic rows | AC-V6 |
| Logic changes hidden as cosmetic | 0 | AC-V5 |
| Questions asked of the wrong owner on the demo | 0 (matches table, unless analyst overrides) | AC-V11 |
| Repeated questions (answered firm-template item asked again) | 0 | AC-V16 plus base AC45 |
| Regression caught on seeded case | 100% | AC-V16 |
| Reproducibility | identical output across repeated runs | AC-V20 |
| Demo walk (open, baseline, 7 changes, ask owners, answer, Ready) | under 3 minutes | AC-V18 |
| New screens or sidebar items added | 0 | Locked L4 |

## How This Maps To Existing ACs

| Existing AC | Status | What changes |
|---|---|---|
| AC5 (filter and sort) | Extended | Adds All / Errors / Changes filter; state survives reload |
| AC6 (decisions, dismiss needs reason) | Extended | "Mark expected" on change rows uses the same required reason |
| AC7 (finding complete) | Extended | Change findings also carry kind, change type, old/new quote, owner, config hash |
| AC8 (determinism), AC25 (no-LLM) | Extended | Cover variance output (AC-V20) |
| AC19 (version diff) | Extended | Variance reuses the diff; adds classification and baseline; Compare screen unchanged |
| AC20 (counsel sheet), AC21 (export, answers) | Extended | Per-owner grouping and export; answer gains intent and scope; DOCX stays the only format |
| AC22 (strict gate), AC48 (blocking never hidden) | Extended | Gate also counts untriaged changes, regression findings and asked questions |
| AC41 to AC47 (firm tagging, labels, memory isolation) | Extended | Baselines and regression checks follow the same per-firm, per-workspace isolation |
| AC42, AC55, AC58 (records, audit, snippets only) | Extended | New records are append-only, audited, snippets/hashes only |
| AC29, AC30, AC40 (performance, a11y, Workers Free) | Re-run | Run on the changed screens and the demo pair |
| AC1 to AC4, AC9 to AC18, AC23 to AC24, AC26 to AC28, AC31 to AC39, AC49 to AC54, AC56, AC57, AC59 to AC64 | Untouched | Must keep passing |

## Open Questions

None that change WHAT is built. Items A1 to A12 are explicit assumptions to confirm with Anduin or tune in PLAN (precision number, owner of two demo items, intent required). Mockup questions about 3-state gate, Tier 2/3, first review, cross-doc and multiple baselines are closed by the locked cuts (L3, L7, A8).

## Background / Research Findings

- **What exists today** (docs/architecture, 17-10-26): format adapters, logic graph, 13 deterministic detectors, AI lane, counsel sheet with strict gate, Compare versions (diff of two documents), firm memory with decisions, rules and audit, D1 database live. Answers are A/B/C/unclear plus note. Issue findings are labelled from memory by fingerprint; per-owner questions, change classification, owner routing, answer intent/scope and regression checks do not exist yet.
- **PRD mapping:** this delta covers PRD F4 (baseline, same-firm only), F5, F6, F7, F9, part of F10 and F11 (intent, scope), and F12 for one example. Not covered: F13, F14, F15, F16, 3-state gate, Tier 2.
- **Existing product decisions reused:** D-1 (counsel export only unanswered), D-2 (answer on re-confirm item counts as re-confirmation), D-3 (awaiting items answerable in-app), D-6 (Compare opens in Versions mode).
- **UI spec:** `design/mockups/app-variance.html` plus notes (zero new screens table, change rows, owner chip, Questions grouping, answer modal). Cut parts (Tier 2/3, first review, 3-state gate, rules-in-effect, cross-doc) are not requirements.
- **Test data:** Hartwell & Crane LLP fictional fixture (Fund III vs Fund II: 7 shown changes plus R-01); real samples #5 to #6 (Partners Group NGI 2024 to 2026: Units to Shares cosmetic, class fees logic, Appendix C removed, swapped references fixed).
- **User brainstorm (condensed):** slim MVP, integrate not add screens, gate stays two states, no baseline means errors only and seeds the baseline, one regression example, config file with hash in provenance, everything else future work.

## TL;DR

- The app will compare a new document to the same firm's earlier fund, hide cosmetic noise (214 changes become 7 plus one regression), show form impact from the logic graph, route each change to counsel, GP or fund admin (overridable), group questions per owner with one export each, and store each answer with its intent and scope.
- One regression example (R-01, "Appendix C must exist") shows an old firm-template answer being re-checked on the new document.
- Two-state gate; unanswered questions and untriaged changes block. No new screens. Free models, Workers Free, TypeScript; AI never gates; nothing crosses firms.
- 20 acceptance criteria (AC-V1 to AC-V20), mostly fully automated; targets: recall 100% on seeded variances, cosmetic-as-logic at most 10%, reproducible output.
- 12 assumptions listed for Anduin (A1 to A12); no blocking open questions.
