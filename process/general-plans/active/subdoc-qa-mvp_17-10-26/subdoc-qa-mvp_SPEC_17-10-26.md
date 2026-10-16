---
name: spec:subdoc-qa-mvp
description: "Product SPEC for the MVP of a pre-digitization QA web app for fund subscription documents (parse to logic graph, checks, LLM judgment, version diff, counsel query sheet with digitization gate, OCR, per-law-firm Review Memory, investor-type path view)"
date: 17-10-26
feature: subdoc-qa-mvp
metadata:
  type: spec
  phase: SPEC
  status: draft-for-user-review
---

# SPEC: Sub-Doc QA MVP (pre-digitization review tool)

**BLUF:** We are building a polished English web app that lets an Anduin Digitization Service Analyst
load a fund subscription document, see every defect that would corrupt the digitized form (with the
exact clause quoted), compare it to a related version, and send a short question sheet to counsel.
The app refuses to say "Ready to digitize" until the critical questions are answered. It remembers every
analyst decision and counsel answer per law firm, so the next fund from the same firm does not re-flag handled
items or re-ask counsel (and never hides a real defect). It must still work with zero AI calls. Success is
measured against real defects we already verified in public SEC documents.

## Summary

Anduin turns a fund's subscription document into a guided online form. If the source document has a
wrong cross-reference, an undefined term, or a skip instruction that points nowhere, the team builds the
wrong form and loses cycles. Today the analyst finds these by reading. This tool reads first, shows what
it found with evidence, and turns the unclear items into counsel questions. Its edge over generic legal
proofreaders: it understands the document's form logic (who must complete what, and where "skip to
Section 7" really lands), and it turns problems into a tracked counsel workflow that gates digitization.

Law firms reuse templates across funds, so without memory the analyst re-dismisses the same false alarms
and counsel is asked the same question twice. **Review Memory** records each decision and each counsel answer
per law firm and uses them on the next document from that firm: handled items move to a "Previously handled"
section (never deleted), already-answered questions are not sent to counsel again, and any edited passage is
treated as new. Memory is strict (exact matches only) and safe (a defect that blocks digitization is never
hidden). The tool can also propose a firm rule after repeated identical dismissals, but only an analyst can
approve it. The app also shows, per investor type, which sections apply and which types have no valid path.

## User Stories / Jobs To Be Done

| ID | As a... | I want... | So that... |
|---|---|---|---|
| US1 | Analyst | to upload a document (linking it to a law firm chosen from a list, a fund name and a version/template label) or pick one from the bundled real sample set | I can start reviewing in seconds, memory knows whose template this is, and a reviewer can try the demo with no files of their own |
| US2 | Analyst | to see processing progress and what stage failed, if any | I know if a result is complete or partial |
| US3 | Analyst | findings listed next to the document, with the cited clause highlighted | I can verify each finding without hunting through the document |
| US4 | Analyst | to filter and sort findings by severity, class and detector | I can start with what blocks digitization |
| US5 | Analyst | to accept, dismiss (with a required reason) or edit a finding, and mark it "needs counsel" | the final list reflects my judgment, not just the tool's, and the reason is on record |
| US6 | Analyst | every finding to say what kind of defect it is, how bad, what proves it, who found it (rule or AI model) and how sure | I can trust or challenge it |
| US7 | Analyst | to inspect the document's structure: sections, references, skip instructions, option groups, defined terms | I can see why a reference was flagged (expected target vs found target) |
| US8 | Analyst | to compare two related documents: two versions of one fund's form (for example 2024 and 2026), or sibling feeder/parallel documents of one fund family | I see what quietly changed or differs, which clauses are common vs differing, and which earlier problems were fixed or newly introduced |
| US9 | Analyst | a drafted, short counsel query sheet with clause citation and the possible readings, which I can edit and export | I can send counsel precise questions instead of writing them by hand |
| US10 | Analyst | to record counsel's answers and see a gate: Ready or Blocked, with reasons | I never start digitizing while a critical question is open |
| US11 | Analyst | scanned PDFs and photos to become reviewable text, with the page image beside it and a confidence shown | scanned source documents are not second-class |
| US12 | Analyst | the app to keep working when AI quota or budget is gone | a demo or a real review never hard-fails |
| US13 | Challenge reviewer (Anduin) | to try the app live, read the reasoning, and see measured results | I can judge product thinking and engineering quality quickly |
| US14 | Analyst | to record counsel's answer (chosen option plus note) on the matching finding | the next fund from that firm shows the answer instead of asking counsel again |
| US15 | Analyst | to see which findings memory moved aside, and why, and to be sure a digitization-blocking defect is never hidden | I can check memory's work and trust that it never buries a real defect |
| US16 | Analyst | to reopen a past decision I now think was wrong | memory never keeps a wrong decision forever |
| US17 | Analyst (new or experienced) | to see and add per-law-firm rules and browse a firm's past decisions, filtered by issue class | firm-specific know-how lives in the tool, not in one colleague's head |
| US18 | Analyst / team lead | the tool to propose a firm rule when I keep dismissing the same pattern the same way, with the evidence shown, taking effect only after I approve | the system gets smarter from decisions while a human stays in control (no model training) |
| US19 | Team lead | an audit trail of who decided, reopened or approved what, when and why | I can investigate an incident and check quality |
| US20 | Analyst | an investor-type path view: for each investor type in the document (individual, joint, trust, IRA, entity, ERISA plan and so on) which sections and questions apply, with types that have no valid path or miss required items flagged | I catch form-logic dead ends before I build the form |
| US21 | Analyst | to export the document's logic (sections, branches, references, defined terms, investor-type paths) as a "form logic outline" file | I can use it as a starting reference while building, without the tool building the form |
| US22 | Challenge reviewer (Anduin) | a seeded demo workspace that already holds decisions on a sample, while my own uploads stay in my private sandbox | I see memory working the moment I open the next sample, and nobody can spoil the shared demo |

## What The User Wants (Behavioral Outcomes)

1. **Start fast.** One screen offers "Upload a document" and "Try a sample" (the real SEC documents). Accepted inputs: SEC-style HTML, text PDF, DOCX, scanned PDF, image files. At upload the analyst links the document to a law firm (picked from a list that knows aliases, never free text), a fund name and a version/template label. The bundled Partners Group samples #3 to #6 come pre-tagged as one firm and template family.
2. **See progress.** After choosing a document the analyst sees named stages (reading, structuring, checks, AI review, done). Deterministic results appear first; AI results arrive later and are visibly labeled "pending" until they land.
3. **Review side by side.** Left: the document (or page image for scans). Right: findings. Selecting a finding scrolls to and highlights the cited clause.
4. **Triage.** Filter and sort by severity, class, detector, status (open, confirmed, dismissed, needs counsel). Counts update live.
5. **Judge.** Per finding: Accept (confirm), Dismiss, or Answered. Dismiss requires a reason from a fixed list (law firm's standard wording, does not affect the form, tool false alarm, other) plus an optional note; without a reason the save is refused with a message. The analyst can also edit text and severity and flag "needs counsel". Every change is remembered and reversible.
6. **Understand the finding.** Each finding shows class, severity, quoted clause with location, detector (rule id, or AI model name and "fresh" or "from cache"), confidence, and for counsel items the possible interpretations.
7. **Inspect the structure.** A structure view lists sections, cross-references (resolved, unresolved, suspicious), conditional instructions, option groups, and defined terms. A flagged reference shows "expected" vs "found".
8. **Compare versions.** Choose two documents; see added/removed/renamed sections, changed definitions, changed requirements and fees, and a table of earlier findings: fixed, still present, newly introduced.
9. **Ask counsel.** Counsel items become a draft question sheet (one short question each, clause cited, interpretations listed). The analyst edits, exports, records answers.
10. **Gate.** A status banner shows **Ready** or **Blocked**, with the specific open critical items. It never shows Ready while a critical item is unresolved.
11. **Degrade gracefully.** With no AI (switched off, no key, quota or budget exhausted) all deterministic checks, structure view, diff and counsel sheet still work; AI-dependent areas say plainly what is skipped and why.
12. **Remember counsel's answers.** The analyst records counsel's answer (option A/B/C plus a note) on the matching finding; its status becomes Answered and it is written to memory.
13. **Look up memory before showing results.** Every finding is matched against the firm's memory using a fingerprint: law firm + issue class + the normalized quoted passage (lowercase, whitespace collapsed, quote marks unified; numbers and section numbers are kept, so "Section 4" is not "Section 5"). Only exact matches count. Each finding is labeled **New**, **Previously dismissed**, **Already answered** (showing the prior answer) or **Awaiting counsel**. A new law firm behaves as if there were no memory.
14. **Handled findings are moved, never deleted.** Previously handled findings go to a collapsible "Previously handled (n)" section showing the reason, who decided, which fund and when. A digitization-blocking finding that matches a dismissed decision is never hidden: it stays in the main list labeled "Dismissed in [old fund], re-confirm". Already answered and Awaiting counsel findings are left out of the exported counsel sheet (only New and Accepted findings go in); the prior answer is shown in the app.
15. **Reopen and govern.** The analyst can reopen a past decision (it is marked revoked, never deleted, and the finding reappears as New). The analyst can add per-law-firm rules (for example "Firm X uses Subscriber instead of Investor, not an error"); rules are given to the AI as context when reviewing that firm's documents and are never a filter, so the AI may still flag. A per-firm memory page lists decisions and rules, filterable by issue class, with reopen. When the same finding pattern is dismissed three or more times with the same reason for one firm, the tool proposes a rule showing the evidence decisions; it takes effect only after an analyst approves. All decisions, reopenings and rule approvals go to a viewable audit trail (who, when, why).
16. **Private by default.** Each public visitor works in their own sandbox workspace. A seeded, read-only-by-default demo workspace holds prior decisions on sample #3 so opening #5 or #6 shows memory at work. Memory never crosses law firms or workspaces, and visitors cannot change the shared demo memory. The server keeps only short quoted snippets, hashes and metadata for memory, never the full document.
17. **See investor-type paths.** For each investor type found in the document's option groups, a view shows which sections and questions apply and flags types with no valid path or with missing required items. The logic (sections, branches, references, defined terms, investor-type paths) can be exported as a JSON form logic outline.
18. **Measure the value.** Each document shows defects found before build, how many counsel questions were batched into one sheet (aim: one counsel round per document), and time from upload to an exportable counsel sheet.

## Flow / State Diagram

Analyst journey (memory steps marked MEM):

```
 [Home] --upload (pick law firm + fund + version label) / pick sample--> [Processing]
                                      |  stages: read -> structure -> deterministic checks -> (AI review) -> done
                                      |  failure at any stage -> partial result + clear message (never a blank screen)
                                      v
                          MEM: look up every finding in this firm's memory
                                      v
                           [Review workspace]
        main list: New / "Dismissed in [old fund], re-confirm" (blocking)    document pane <--highlight--> findings
        collapsed: "Previously handled (n)"  (dismissed / already answered / awaiting counsel)
                                      |
        accept / dismiss (reason required) / edit  /  "needs counsel"
                                      |  MEM: write-back of every decision (append-only)
                                      v
                [Counsel query sheet]  contains New + Accepted only
                     --edit--> --export DOCX--> (counsel replies)
                                      |
                                      v  record answer (A/B/C + note) -> status Answered
                                      |  MEM: write-back of the answer
                                      v
                           [Digitization gate]
                      Blocked (critical open) <--> Ready (all critical resolved)

 Side views: [Structure view]  [Investor-type path view]  [Version / sibling diff: pick 2 docs]
             [Form logic outline export (JSON)]  [Firm memory page + rules]  [Audit trail]
```

Memory label decision (per finding, same law firm and same workspace only):

```
 finding -> fingerprint = firm + issue class + hash(normalized quote)
     |
     +-- no exact match in memory ------------------------------> New  (shown in main list)
     +-- match: dismissed ---- blocks digitization? --yes--------> main list, "Dismissed in [fund], re-confirm"
     |                              |no
     |                              +--------------------------> Previously dismissed (collapsed section)
     +-- match: answered ---------------------------------------> Already answered + prior answer (collapsed; not in counsel sheet)
     +-- match: accepted, no answer yet ------------------------> Awaiting counsel (collapsed; not sent again)
     +-- match is revoked --------------------------------------> New
     (passage changed by even one character or number, other firm, other workspace --> New)
```

Finding lifecycle:

```
 detected --(memory lookup)--> open --+--> accepted ------------+--> (needs counsel?) --> query drafted --> asked --> answered
                                      +--> dismissed (reason)   |                                                      |
                                      +--> edited --> open      |            critical + answered  => stops blocking <--+
                                                                +--> stays critical + unanswered => gate = Blocked
 dismissed / answered --(reopen)--> decision revoked (kept in audit trail) --> finding reappears as New
 same pattern dismissed 3+ times, same reason, same firm --> rule proposed --> analyst approves --> firm rule active
```

AI availability states:

```
 AI on, quota ok --> full mode
 free quota out  --> cheaper paid fallback (within spend cap) --> else --> no-LLM mode (banner shown)
 spend cap hit / key missing / user toggle --> no-LLM mode: deterministic only, nothing breaks
 (memory lookup, labels, Previously handled and audit trail work in no-LLM mode too)
```

## Acceptance Criteria (Testable Outcomes)

Strategy tags: **FA** = Fully-Automated, **H** = Hybrid (automated plus recorded AI responses or human spot-check), **AP** = Agent-Probe (residual where automation is not possible). Test scenarios come from the planned test shape in `process/context/tests/all-tests.md` (unit/property, golden-corpus, seeded-defect, recorded-LLM, E2E browser). Named scenario ids are provisional and finalized in PLAN.

### A. Ingest, status, workspace

**AC1. Every supported input type opens.** HTML, text PDF, DOCX, and scanned PDF or image each load and reach a reviewable state; a corrupt or unsupported file gives a clear message, no crash. The upload step also asks for law firm, fund name and version/template label (see AC41).
- proven by: `ingest-all-formats` (one fixture per format plus corrupt and empty files); strategy: FA

**AC2. The bundled sample set is selectable and works end to end.** All 12 HTML samples (01–08, 10–13) and the 22-page scan set (09; the ILPA PDF #14 is local-only) [corrected 2026-10-17, user-approved] can be opened from the picker in one click, already tagged with law firm, fund and version (samples #3 to #6 as one firm and template family).
- proven by: `sample-picker-smoke` (loops every sample through parse); strategy: FA

**AC3. Progress is visible and honest.** Named stages are shown; a stage failure yields a partial result with the failing stage named; AI results show "pending" until done.
- proven by: `status-stages-and-partial-failure` (E2E with an injected stage failure); strategy: FA

**AC4. Findings sit beside the document with the cited clause highlighted.** Selecting a finding scrolls to and highlights its quoted text; for scans, highlights the page and region.
- proven by: `finding-highlight-e2e`; strategy: FA

**AC5. Filter and sort work.** By severity, class, detector, status; counts match the visible list; state survives a page reload.
- proven by: `filter-sort-e2e`; strategy: FA

**AC6. Analyst decisions persist, and Dismiss requires a reason.** Accept, dismiss, answered, edit, and "needs counsel" are saved and survive reload; each change can be undone. Dismiss is refused, with a message asking for a reason, unless a reason from the fixed list (law firm's standard wording, does not affect the form, tool false alarm, other) is chosen; a note is optional. (Changed in revision R6: the reason is no longer optional.)
- proven by: `triage-actions-persist-e2e` plus `dismiss-requires-reason-e2e`; strategy: FA

### B. Finding quality and explainability

**AC7. Every finding is complete.** Each carries: class (from the taxonomy), severity (blocks digitization or not), quoted evidence with location, detector provenance (rule id, or model name plus fresh/cache), and confidence. Counsel items also list possible interpretations. A finding missing any field fails validation.
- proven by: `finding-schema-contract` (property test over all findings from all samples and fixtures); strategy: FA

**AC8. Deterministic detection is reproducible.** Re-running the same document and settings yields identical findings (same ids, order, evidence) on repeated runs.
- proven by: `determinism-repeat-run` (N runs, byte-equal findings); strategy: FA

**AC9. Findings can be explained.** Each deterministic finding states the rule and the facts it used (for a broken reference: the reference text, the target it points at, the target that was expected).
- proven by: `explanation-present-per-rule` (one assertion per rule); strategy: FA

**AC10. Sensitive and incomplete-document flags.** The tool flags drafting notes (for example "NTD:"), placeholder brackets (for example `[xx]`, `[insert investor name]`), and sensitive data such as bank account or routing numbers (for example the ABA/DDA numbers in samples #1 and #7). Sensitive values are masked by default in the findings list, with a reveal control.
- proven by: `flags-ntd-placeholder-sensitive` (samples #5, #1, #7 plus fixtures); strategy: FA

### C. Golden acceptance cases (must be detected)

The tool must detect each verified real defect and cite its location. Source of truth: RESEARCH section A.

**AC11. Sample #1 (Franklin Lexington 2024).** "paragraphs 1 through 4 of this Section 11" inside Section 12 (Qualified Client), paragraphs 5 and 6, flagged as a broken cross-reference with "expected Section 12".
- proven by: `golden-01-this-section-11`; strategy: FA (deterministic)

**AC12. Samples #3 and #5 (Partners Group Master 2019, NGI 2024).** Both swapped instruction references flagged: "Custodian ... in Part B of Section 6" (custodian is Section 4) and "amount ... in Part B of Section 4" (amount is Section 6 Part B). Four findings total across the two documents.
- proven by: `golden-03-05-swapped-part-b-refs`; strategy: FA (deterministic)

**AC13. Sample #11 (Medalist 2016).** "the offered Units will not be..." flagged as use of an undefined term (the defined term is "Shares").
- proven by: `golden-11-undefined-units`; strategy: FA (deterministic)

**AC14. Sample #9 (RW Holdings scan A-1 p.1) (OCR and AI dependent).** The Account Type grid is flagged: Partnership/LLC lacks footnote 2 (attach entity documents) while Corporation, Trust and Other carry it.
- proven by: `golden-09-ocr-footnote2` using recorded OCR output (CI) plus one live-model run recorded as a result (not a CI gate); strategy: H. Residual: whether a free vision model preserves the footnote marker is unverified (see Feasibility Probes P1). If no free model keeps it, ONE capped paid OCR attempt is made on the key page(s) (result cached, counted against the ~$10 cap, never repeated); if that also misses, the case is reported as a known limitation in the README rather than hidden. A documented miss is an acceptable outcome for this criterion (soft).

**AC15. Samples #5 to #6 drift.** The diff reports: both swapped references fixed; Appendix C removed; terminology renames (Units to Shares, Member to Shareholder, Memorandum to Prospectus, placement agent to distributor, Placement Fee to Sales Load); class-specific fees (Sales Load 3.5% for A, 1.5% for S); drafting note and placeholders removed; section list 1 to 12 and Parts A to D unchanged.
- proven by: `golden-05-06-drift`; strategy: FA for structure, fees, Appendix C and fixed references; H for the terminology-rename narrative (AI summary uses recorded responses)

**AC16. Low-confidence items are labeled, not asserted.** "LLC Agreement" retained 10 times in #6 after Units-to-Shares is shown as low confidence, if reported at all.
- proven by: `golden-06-llc-agreement-lowconf`; strategy: H

### D. Logic graph visibility

**AC17. Structure view lists the document's logic.** Sections (including scoped numbering restarts), cross-references with resolved/unresolved/suspicious status, conditional instructions (whitelist, role routing, skip, negative gate), option groups with exclusivity cue (check one / all that apply), and defined terms. Statutory citations ("Section 3(c)(1) of the 1940 Act") are not treated as internal references.
- proven by: `graph-extraction-fixtures` (seeded fixtures per pattern) plus `golden-statutory-cite-not-flagged` (samples with high "Section X" counts); strategy: FA

**AC18. Seeded-defect coverage per class.** For every deterministic class (broken reference, broken conditional, unreachable or circular flow, option gap or overlap, defined-term issues, inconsistent footnote or requirement, version drift) at least one synthetic fixture exists and is detected.
- proven by: `seeded-defect-matrix` (one row per class and detector); strategy: FA

### E. Version diff

**AC19. Diff of two related documents, including sibling feeder/parallel documents.** Added/removed/renamed sections, changed definitions, changed requirements and fees, plus a findings delta (fixed, still present, new). For sibling documents of one fund family (for example onshore and offshore feeders) the diff labels each clause as common or differing, supporting an "Omnibus" single-form practice. Also works for #3 vs #4 (reorganized structure) without crashing. The samples contain no true feeder pair, so #3 to #6 are the test set; sibling labeling is demonstrated on them (and a seeded sibling fixture).
- proven by: `diff-pairs-e2e` (#5/#6 and #3/#4, a pair with no changes returning "no differences") plus `sibling-clause-common-vs-differing` (seeded sibling pair); strategy: FA

### F. Counsel query sheet and gate

**AC20. Counsel sheet is drafted and editable.** Each New, Accepted "needs counsel" finding yields one short question with clause citation and interpretations; findings labeled Already answered or Awaiting counsel are not included (the prior answer is shown in the app instead). The analyst can edit wording; changes persist. Without AI, a template-based draft is produced; with AI, a recorded or cached draft is used.
- proven by: `counsel-sheet-draft-edit-e2e` (both modes); strategy: FA (no-LLM) and H (AI draft)

**AC21. Export and answer tracking.** The sheet exports to DOCX (the one mandatory format; CSV and PDF are out of scope for the MVP); the export contains every question, citation and interpretation. Recorded answers (chosen option A/B/C, note, who, when) are shown beside each question; recording an answer sets the matching finding to Answered and writes it to memory. The exported sheet contains only New and Accepted findings; Already answered and Awaiting counsel findings are excluded (see AC45).
- proven by: `counsel-export-contents` (parse the exported DOCX and compare, including exclusion of Already answered and Awaiting counsel) plus `counsel-answer-record-e2e`; strategy: FA

**AC22. The gate is strict.** Status is Blocked, with a list of reasons, whenever any critical item is not resolved (open, unanswered, or answered "unclear"); Ready only when all are resolved or dismissed with reason. Reasons link to the items. A critical item resolved by a prior counsel answer counts as answered; a critical item that is Awaiting counsel, or a blocking item marked "Dismissed in [old fund], re-confirm" that has not been re-confirmed, counts as unresolved.
- proven by: `gate-state-matrix` (all state combinations) plus `gate-e2e`; strategy: FA

### G. OCR

**AC23. Scans become reviewable text with positions.** Each extracted line has a page and a region so findings can cite "page 1, region ..."; the page image shows next to the extracted text; per-page confidence is displayed; low-confidence pages are visibly marked.
- proven by: `ocr-position-and-confidence-e2e` on recorded OCR output; plus `ocr-accuracy-vs-transcript` against a hand-made ground-truth transcript for 3 to 5 pages (character error rate reported, not gated in CI); strategy: H

**AC24. OCR failure is graceful.** If no OCR model is available (quota out, budget hit, no key), scanned documents still open as page images with a clear "text not extracted" notice; nothing else breaks.
- proven by: `ocr-unavailable-mode-e2e`; strategy: FA

### H. Modes, cost, quota

**AC25. No-LLM mode is complete and error-free.** With AI disabled, every sample document processes, the structure view, deterministic findings, diff, counsel sheet (template drafts) and gate all work, with zero uncaught errors. AI-only areas show "not run" messages.
- proven by: `no-llm-full-corpus-run` (all samples, assert zero hard failures); strategy: FA

**AC26. Quota and budget exhaustion are survivable.** Simulated 429, 402 and "cap reached" responses cause fallback (free to cheap paid, then no-LLM), a visible banner and no lost work. Cumulative spend is tracked and refuses new paid calls at the cap (about $10 total).
- proven by: `llm-failure-injection-matrix` (429, 402, timeout, malformed output) plus `spend-cap-enforced`; strategy: FA

**AC27. AI results are cached, but never stale against the rules.** Same document, model, prompt version and law-firm rules version never triggers a second paid or quota-consuming call; cached results are labeled "from cache" in provenance. A cached result computed without the firm's current rules is never served; changing the firm's rules triggers a fresh run (within the usual caps).
- proven by: `llm-ocr-cache-hit` plus `cache-invalidated-by-firm-rules-change`; strategy: FA

**AC28. AI never invents evidence.** Every AI finding quotes text that literally appears in the document; findings whose quote cannot be located are rejected or demoted and logged.
- proven by: `llm-quote-must-exist` over recorded responses; strategy: H

**AC32. Per-visitor AI run limit.** Each visitor (anonymous, identified by a non-account signal such as network address or browser token) can start only a stated number of fresh AI runs per day (default proposal: 3 documents/day; tuned in PLAN). Beyond it, the visitor gets deterministic results plus a clear message; they are not blocked from the app.
- proven by: `per-visitor-ai-limit-e2e` (exceed limit, assert downgrade message and deterministic results intact); strategy: FA

**AC33. Global daily AI cap respects quotas and budget.** Total fresh AI requests per UTC day never exceed the lesser of the configured daily cap and the provider's free-tier allowance (50/day, or 1000/day only after credits are bought); cumulative paid spend never exceeds about $10 total. Remaining daily allowance is visible in the UI.
- proven by: `global-daily-cap-and-budget` (simulated counters at, below and above the caps; UTC midnight reset); strategy: FA

**AC34. Cached results are reused for samples.** Opening a bundled sample (or any identical document) with the same model and prompt version makes zero new AI or OCR calls; the result appears immediately from cache.
- proven by: `sample-open-zero-llm-calls` (call counter equals 0 on second open and on all bundled samples once pre-warmed); strategy: FA

**AC35. Automatic downgrade with a clear banner.** When free quota, daily cap, per-visitor limit or budget is exhausted (or the provider errors), the app switches to no-LLM mode without losing work and shows a banner naming the reason and what is skipped. When allowance returns (next UTC day), AI resumes without manual action.
- proven by: `auto-downgrade-banner-e2e` (inject each exhaustion reason) plus `ai-resume-after-reset`; strategy: FA

**AC36. Fresh vs cached is visible per finding.** Every AI-derived finding and AI draft shows "fresh" or "from cache" next to the model name; deterministic findings show the rule id.
- proven by: `provenance-fresh-vs-cache-ui` (also covered by the AC7 schema contract); strategy: FA

### I. Non-functional and delivery

**AC29. Performance on the sample corpus.** Deterministic results (structure plus checks) for the largest sample (about 380 KB HTML) appear within the targets below; the 22-page scan set shows per-page progress.
- proven by: `perf-budget-corpus` (timed run on the sample set; thresholds in NFR table); strategy: FA

**AC30. Accessibility basics.** Keyboard-only operation of triage, filters and gate; visible focus; text contrast meets WCAG AA; severity is never conveyed by color alone; automated accessibility scan reports no critical violations on main screens.
- proven by: `a11y-scan-and-keyboard-e2e`; strategy: H (automated scan plus one manual keyboard pass)

**AC31. Live demo and deliverables exist.** A public demo URL works end to end with a sample (no account needed), the README explains reasoning (why deterministic first, what AI does, known misses), plus a short demo video and slides. No resource is created in or changes the zone `itsjiathao.com`.
- proven by: `deployed-smoke-e2e` (run against the live URL) and a deliverables checklist; strategy: FA (smoke) and AP (deliverables, zone-untouched check by listing resources)

**AC37. Upload limits are enforced and stated.** The upload screen states maximum file size, page count and accepted types (default proposal: 10 MB, 30 pages per scan; tuned in PLAN against the sample sizes of about 50 to 380 KB HTML and 22 scan pages). Oversized, over-length or wrong-type files are rejected with a clear message before any AI call is spent.
- proven by: `upload-limits-e2e` (boundary files: at limit, over limit, wrong type, empty); strategy: FA

**AC38. Privacy notice before upload and before AI use.** Before the first upload the visitor sees a notice that the demo is not for confidential documents, how long data is kept, and that document text is sent to a third-party AI provider while AI is on; the visitor can turn AI off for their session. Stored uploads are deleted after the stated retention period. The notice also states what memory keeps (short quoted snippets, hashes and metadata, never the full document) and for how long (see AC58).
- proven by: `privacy-notice-and-ai-toggle-e2e` plus `retention-purge-test`; strategy: FA

**AC39. Public-endpoint abuse protection.** The public processing endpoints resist basic abuse: request-rate limiting per visitor, rejection of oversized or malformed requests, no AI call without passing the limits in AC32 and AC33, and no way for an uploaded file to run code or fetch internal resources. Abuse attempts return clear errors, never a crash, and never consume the AI budget.
- proven by: `abuse-protection-matrix` (rate-limit burst, oversize body, malformed upload, hostile HTML with scripts and external references); strategy: FA

**AC40. Fits Workers Free limits.** The deployed app operates within Cloudflare Workers Free limits (10 ms CPU per request, 50 subrequests per request, 100k requests per day) with no paid-plan feature required; a request that would exceed a limit fails safely with a message and does not corrupt saved data.
- proven by: `free-plan-limits-conformance` (run the deployed or local-equivalent app under Free limits for each corpus document and the largest scan set; assert no limit errors) plus `limit-exceeded-safe-failure`; strategy: FA

### J. Review Memory: setup and decisions

**AC41. [P0] Documents are linked to a law firm, fund and version.** At upload the analyst picks the law firm from a list (aliases such as "Firm X LLP" and "Firm X" resolve to the same firm; free-text firm names are not accepted), enters a fund name and a version/template label. The bundled Partners Group samples #3 to #6 are pre-tagged as one firm and template family. Without a firm, memory is not applied and the app says so.
- proven by: `upload-firm-tagging-e2e` (alias resolves to one firm; free text rejected; samples #3 to #6 share one firm tag); strategy: FA

**AC42. [P0] Every decision is stored with its full record.** Accept, Dismiss and Answered each store: law firm, fund, issue class, location, quoted snippet, decision, reason (required for Dismiss, see AC6), counsel answer and note when present, who decided and when. Decisions are only added or marked revoked, never deleted.
- proven by: `decision-record-contract` (property test over all decision types) plus `decision-append-only`; strategy: FA

### K. Review Memory: matching, labels and safety

**AC43. [P0] Findings are labeled from memory before results are shown.** Each finding is looked up by fingerprint (law firm + issue class + hash of the normalized quote: lowercase, whitespace collapsed, quote marks unified, numbers and section numbers kept) and labeled New, Previously dismissed, Already answered (with prior answer) or Awaiting counsel. Only exact matches count; there is no fuzzy matching. A firm with no memory gives all findings as New. Revoked decisions never match.
- proven by: `memory-label-matrix` (every label state, new firm, revoked decision); strategy: FA

**AC44. [P0] Handled findings are not re-flagged (PRD criterion 1).** Given a finding dismissed at fund I of Firm X, when fund II of Firm X contains the identical passage, then it appears in "Previously handled (n)" with the reason and the fund I name, not in the main list as New.
- proven by: `memory-no-reflag-e2e` (seeded fund I decisions, fund II fixture); strategy: FA

**AC45. [P0] Prior counsel answers are shown, not asked again (PRD criterion 2).** Given counsel answered a finding at fund I, when fund II is reviewed, then the finding is labeled Already answered with the prior answer and note, and is absent from the exported counsel sheet; Awaiting counsel findings are also not sent again.
- proven by: `memory-prior-answer-not-reasked-e2e` (parse exported DOCX: zero repeated questions); strategy: FA

**AC46. [P0] An edited passage is a new finding (PRD criterion 3).** Given a dismissed finding, when fund II changes "Section 4" to "Section 5" in that passage, then it is reported as New. Differences in case, spacing or quote marks only still match.
- proven by: `memory-edit-is-new-e2e` plus `fingerprint-normalization-property` (case, whitespace and quote variants match; changed numbers do not); strategy: FA

**AC47. [P0] Memory never crosses law firms or workspaces (PRD criterion 4).** Given a dismissal for Firm X, a document from Firm Y with an identical passage gets it as New; a decision made in one workspace never affects another.
- proven by: `memory-no-cross-firm-or-workspace-e2e`; strategy: FA

**AC48. [P0] Blocking defects are never hidden (PRD criterion 5).** A finding that blocks digitization and matches a dismissed decision stays in the main list, labeled "Dismissed in [old fund], re-confirm"; the gate treats it as unresolved until re-confirmed.
- proven by: `memory-blocking-never-hidden-e2e` plus `gate-with-reconfirm-state`; strategy: FA

**AC49. [P0] "Previously handled (n)" is complete and collapsible.** The section shows the correct count, opens to show for each item the reason, who decided, which fund and when, and nothing in memory is ever removed by being shown there.
- proven by: `previously-handled-section-e2e`; strategy: FA

### L. Review Memory: reopen, firm rules and learning

**AC50. [P1] A past decision can be reopened.** Reopening marks the decision revoked (kept, with who/when/why in the audit trail) and the finding reappears as New on the next lookup.
- proven by: `memory-reopen-e2e`; strategy: FA

**AC51. [P1] Firm rules are context, never a filter.** An analyst-entered rule for a law firm (for example "Firm X uses Subscriber instead of Investor, not an error") is given to the AI as context when reviewing that firm's documents; the AI may still flag an item. Rules for one firm are never given for another firm.
- proven by: `firm-rule-in-context-recorded-llm` (recorded responses; rule present in context; a still-flagged item survives) plus `firm-rule-isolation`; strategy: H

**AC52. [P1] Per-law-firm memory page.** One page lists a firm's decisions and rules, can filter by issue class and can reopen a decision.
- proven by: `firm-memory-page-e2e`; strategy: FA

**AC53. [P1] The tool proposes a firm rule from repeated dismissals.** When the same finding pattern has been dismissed three or more times with the same reason for one firm, the tool proposes a rule and shows the evidence decisions. Two dismissals, or three with different reasons, produce no proposal.
- proven by: `rule-proposal-threshold-matrix` (2, 3, 3-with-different-reasons, other firm); strategy: FA

**AC54. [P1] A proposed rule has no effect until approved.** Before approval the proposal does not change findings or AI context; after an analyst approves it becomes an active firm rule and is recorded in the audit trail; a rejected proposal stays inactive.
- proven by: `rule-proposal-needs-approval-e2e`; strategy: FA

### M. Review Memory: audit, isolation, privacy and measured value

**AC55. [P0] Audit trail.** An append-only, viewable log records every decision, reopening and rule approval with who, when and why; entries cannot be edited or removed through the app.
- proven by: `audit-trail-append-only-e2e`; strategy: FA

**AC56. [P0] Each visitor works in a private sandbox workspace.** Decisions, rules and uploads made by one visitor are not visible to, and do not affect, any other visitor or the shared demo. The analyst identity is a simulated name chosen on entry (no real accounts).
- proven by: `sandbox-isolation-e2e` (two visitor sessions); strategy: FA

**AC57. [P0] The seeded demo workspace shows memory at work and is protected.** The demo workspace holds prior decisions on sample #3, so opening #5 or #6 immediately shows Previously handled items and prior answers. It is read-only by default: visitor actions in it are not saved to the shared memory (they apply only to the visitor's own sandbox copy).
- proven by: `demo-workspace-seeded-effects-e2e` plus `demo-workspace-not-polluted-e2e`; strategy: FA

**AC58. [P0] Memory keeps only snippets, hashes and metadata.** The server stores for memory only short quoted snippets, hashes and metadata, never the full document; sensitive values (for example bank account or routing numbers) are masked in stored snippets; the memory retention period is stated in the privacy notice (AC38) and expired memory in sandbox workspaces is purged. The seeded demo workspace is exempt from purge.
- proven by: `memory-storage-contract` (inspect stored records: no full text, masked sensitive values) plus `memory-retention-purge-test`; strategy: FA

**AC59. [P0] The "fund II" fixture reduces the work by at least half.** A seeded fund II fixture (same firm template as fund I; about three unchanged, previously handled passages; two new defects; one passage edited from "Section 4" to "Section 5") shows at least 50% fewer findings needing action than the same review without memory.
- proven by: `fund-two-memory-reduction-e2e` (count with and without memory); strategy: FA

**AC60. [P0] Memory hides no real defect and repeats no question.** On the fund II fixture: zero of the two new defects and the edited passage are placed in Previously handled; zero questions already answered appear in the counsel sheet. Any blocking finding matching a dismissal stays in the main list (AC48).
- proven by: `fund-two-zero-hidden-zero-repeat-e2e`; strategy: FA

### N. Investor-type paths, logic outline and delivery metrics

**AC61. [P0] Investor-type path view.** For each investor type found in the document's option groups (individual, joint, trust, IRA, entity, ERISA plan and so on) the view lists which sections and questions apply to that type. The result is deterministic: the same document gives the same view on every run.
- proven by: `investor-path-extraction-fixtures` (seeded fixtures per type plus samples) plus `investor-path-determinism`; strategy: FA

**AC62. [P0] Investor types with no valid path or missing required items are flagged.** An investor type with no path to completion, or whose path omits an item the document requires of it, is flagged with the clause cited.
- proven by: `investor-path-seeded-defects` (dead-end type, missing required item, clean control); strategy: FA

**AC63. [P1] Form logic outline export.** The analyst can export the logic map (sections, branches, references, defined terms, investor-type paths) as a JSON "form logic outline". It is a reference outline only; the tool does not generate the form.
- proven by: `logic-outline-export-contents` (parse exported JSON against the structure view); strategy: FA

**AC64. [P0] Delivery metrics are shown per document.** For each reviewed document the app shows defects found before build, number of counsel questions batched into the one sheet (target: one counsel round per document), and time from upload to an exportable counsel sheet.
- proven by: `document-metrics-panel-e2e` (counts and elapsed time match the known sample results); strategy: FA

## Non-Functional Requirements

| Area | Requirement | Target / note |
|---|---|---|
| Reproducibility | Deterministic checks give identical output run to run | exact match; AI output is allowed to vary but is cached per document+model+prompt version |
| Explainability | Every finding shows rule or model, evidence, confidence | see AC7, AC9 |
| Cost | Free OpenRouter models first, automatic fallback to cheap paid, total spend cap | about $10 total; every call logged with cost; hard stop at cap; AI is on by default in the live demo, so per-visitor and global daily limits apply (AC32, AC33) |
| Quota | Handle free-tier limits (20 requests/min, 50/day; 1000/day only after credits are bought) | queue and back off; show remaining-quota state; fall back to no-LLM mode |
| Performance (deterministic) | Structure plus checks on the largest sample | target: under 5 s after the file is available, under 2 s for typical (about 50 KB) docs; confirmed in PLAN once the stack is chosen |
| Performance (OCR/AI) | Long operations never block the UI | progress shown per page; 22-page scan set targets under 5 min total on free models; deterministic review of a text document usable before AI finishes |
| Reliability | No hard failure in no-LLM mode | zero uncaught errors across the corpus |
| Privacy (demo) | Visitors may upload their own documents; the bundled samples are public SEC documents. Uploads are processed, not shared; retention is limited and stated; the UI warns not to upload confidential documents; document text goes to a third-party AI provider while AI is on (the default), with a visible notice and a per-session off switch | AC37, AC38; stated in UI and README |
| Abuse protection | Public upload and AI endpoints need basic protection: rate limits, size and type limits, no AI spend without passing limits | AC32, AC33, AC39 |
| Memory privacy and isolation | Memory keeps only short snippets, hashes and metadata; stated retention; per-visitor sandbox workspaces; memory never crosses law firms or workspaces; shared demo workspace read-only by default | AC47, AC56, AC57, AC58 |
| Memory safety | Exact-match only; blocking defects never hidden; nothing deleted, only revoked; every decision auditable | AC43 to AC50, AC55 |
| Privacy (production, not built) | Real subscription documents are confidential: would need tenant isolation, encryption, no training on data, regional hosting, retention controls, audit log | documented as out of scope, described in README |
| Accessibility | Keyboard use, contrast, non-color severity cues, labeled controls | WCAG 2.1 AA as the aim for main flows |
| Security | Input files are untrusted: parsed, never executed; no script from a document runs in the app; size and type limits | stated limits shown to user |
| UI language | English only | polished, consistent visual design |
| Quality bar | Full automated test suite (unit/property, golden corpus, seeded defects, recorded AI responses, E2E browser); no live AI calls in CI | required deliverable |

### Platform constraints (from research, stated as constraints, not design)

| Constraint | Effect on requirements |
|---|---|
| **HARD CONSTRAINT (decided by user):** Cloudflare Workers FREE plan only: 10 ms CPU per request, 50 subrequests per request, 100k requests per day, 128 MB memory | Heavy work (parsing, diffing, OCR preparation) must not depend on per-request server CPU, and AI calls must be batched or otherwise kept within the subrequest cap. How this is met is decided in INNOVATE. AC29 and AC40 must pass under these limits |
| Cloudflare Workers Paid ($5/mo) | NOT approved (Resolved Decision R1); no requirement may rely on it |
| LLM wait time is not CPU time; background work is capped (about 30 s after response; queues up to 15 min) | Long AI/OCR jobs need progress and resumability (AC3, AC23) |
| OpenRouter free models rotate; free tier 20 requests/min and 50/day; negative balance gives 402 even for free models | Model list must be configurable; AC26 |
| PDF input via OpenRouter: if no engine is set it may silently use a paid OCR engine ($2 per 1000 pages) | The app must never trigger a paid engine implicitly; spend only through tracked calls (AC26) |
| Storage on free tiers: KV allows 1,000 writes/day | Caching and counsel tracking need storage that fits free limits (decided later) |
| Never touch zone `itsjiathao.com`; resources named `aduin-transaction-*` | AC31 |

## Out Of Scope

| Item | Why |
|---|---|
| Real authentication, real user accounts, roles and permissions, production multi-tenancy | Demo and challenge only. IN scope: a simulated analyst identity chosen on entry and per-visitor sandbox workspaces (AC56, AC57) |
| Editing or fixing the source document (no redlining back to the file) | The tool reports; the drafting lawyer fixes |
| Generating the digitized online form itself | This is the step the gate protects, not part of it. The JSON form logic outline (AC63) is a reference, not a generated form |
| Fuzzy or embedding-based matching of memory | Only exact matches after normalization; near matches risk hiding real defects |
| Sharing memory across law firms | Memory is per firm only |
| Decision expiry or "needs recheck" after N months or a law change | Backlog (PRD R10); decision dates are shown instead |
| A second person approving a decision before it enters memory | Not in the MVP; the audit trail covers accountability |
| E-signature, investor-facing forms, investor submissions review | Different product area (post-digitization) |
| Emailing counsel directly or integrating with email/CRM | Export only |
| Counsel-sheet export to CSV or PDF | DOCX is the one mandatory format; others are nice-to-have after the MVP |
| Paid Cloudflare Workers plan features | User decision: Free plan only |
| Legal advice or legal conclusions | Findings are review aids; counsel decides |
| Production compliance (SOC 2, data residency, DPA) | Documented in README as production requirements only |
| Supporting languages other than English documents or UI | English only |
| Full RIA vs broker-dealer variant splitting for #2 (single file, no delimiter) | Reported as a limitation unless time allows |
| Handwriting recognition, handwritten annotations | Scans are printed forms |
| Fine-tuning or training models | Use off-the-shelf models only |
| Redistributing copyrighted ILPA model document (#14) | Local test use only; not in the live demo |

## Constraints

| Source | Constraint |
|---|---|
| User | MVP includes all six capabilities: parse to logic graph, deterministic checks, AI judgment checks, version diff, counsel sheet with gate, OCR |
| User | Inputs: SEC-style HTML, text PDF, DOCX, scanned PDF/images |
| User | Web app, English UI, polished; full automated test suite is a requirement |
| User | Deliverables: live demo on Cloudflare, README explaining reasoning, short demo video, slides |
| User | LLM policy: free OpenRouter models first (including free vision for OCR), fallback to cheap paid, about $10 total, cache everything, fully works without AI |
| User | Solo developer; quality over speed; no hard deadline |
| Process | Deterministic first; AI only judges clause neighborhoods and must cite quotable evidence |
| Process | Copy open-source code only from MIT/BSD/Apache sources, keep notices; sample files are untrusted input |
| Research | No headings tags in sample HTML; numbering restarts inside a document; "Section X" also appears in statutory citations; checkbox glyphs vary (so extraction must be tolerant) |
| Research | Sample #9 scans are 1200 DPI with no text layer; difficulty is layout (checkbox grids, footnote markers), not legibility |
| Research | No true onshore/offshore feeder pair exists in samples; Partners Group pairs (#3-#6) are the diff test set |
| User (resolved) | Cloudflare Workers Free plan only; paid plan not approved (R1) |
| User (resolved) | Live demo accepts visitor uploads and has AI on by default, protected by per-visitor and global caps (R2, R3) |
| User (resolved) | Counsel sheet export: DOCX only (R4) |
| User (resolved) | Review Memory is in the MVP, scoped per law firm, exact-match only, with the safety rules of AC48; sources: the user's PRD (`subdoc-qa-mvp_PRD-REVIEW-MEMORY_17-10-26.md`) (R6) |
| Process | Memory must work with zero AI calls and fit the Workers Free limits (AC25, AC40) |
| Platform | See Platform constraints table above |

## Success Metrics (for the challenge)

| Metric | Target | How measured |
|---|---|---|
| Golden recall (deterministic goldens: #1, #3, #5, #11, #5-to-#6 drift) | 100% (all found, correct location) | `golden-*` tests |
| Golden recall including OCR case (#9 footnote 2) | reported honestly; goal: found by at least one configured model, otherwise documented miss | live run recorded in README |
| Precision on seeded-defect fixtures | at least 90% of reported deterministic findings are true seeded defects | `seeded-defect-matrix` |
| Recall on seeded-defect fixtures | 100% for deterministic classes | same |
| False-alarm rate on real corpus | reported per document, with the top false-positive causes explained | corpus run; target: no document shows an unreviewable flood (suggested ceiling: under 40 high-severity findings per document) |
| Demo end-to-end time | open sample, review, draft counsel sheet, see gate in under 3 minutes | timed script / E2E |
| No-LLM mode | zero hard failures across all samples | AC25 |
| Cost | total spend at or under cap; most runs at $0 | spend log |
| Test suite | all green in CI with no live AI calls | CI |
| Reviewer comprehension | an Anduin reviewer can follow the flow with no instructions | README and video walkthrough check |
| Memory: work saved on second review | fund II of the same firm needs at least 50% fewer findings to action than without memory | AC59 |
| Memory: real defects hidden | 0 | AC60 |
| Memory: repeated questions to counsel | 0 | AC45, AC60 |
| Defects found before build, per document | reported per document | AC64 |
| Counsel questions batched | one counsel sheet (one round) per document | AC64 |
| Time from upload to an exportable counsel sheet | reported per document; within the 3-minute demo script | AC64 |

## Feasibility Probes (acceptance depends on these; not run in SPEC)

| # | Question | Criteria that depend on it | Cost class |
|---|---|---|---|
| P1 | Do free vision models (nemotron-3.5-super-vl, gemma-4) preserve the footnote-2 gap on #9 Partnership/LLC; if not, does the single capped paid OCR attempt (R5) preserve it? | AC14, AC23, success metric on OCR recall | needs-live-provider |
| P2 | Do free models honor strict JSON output; what are real latency and concurrency? | AC20, AC26, AC28 | needs-live-provider |
| P3 | Does the DOCX diff library (WASM) fit platform size/start-up/memory limits? | AC1 (DOCX), AC19 for DOCX | needs-cf |
| P4 | PDF text extraction CPU cost per page vs the Workers Free 10 ms CPU limit | AC1 (PDF), AC29, AC40 | needs-cf |
| P5 | Does the free Cloudflare PDF engine do any OCR on scanned pages? | AC23, AC24 | needs-live-provider |

Status: provisional thresholds in AC14, AC23, AC29, AC32, AC37 are targets until P1, P2 and P4 return; this SPEC does not guess their results. If PLAN needs a hard number first, the orchestrator should dispatch these probes before PLAN begins.

## Resolved Decisions (2026-10-17)

User answers to the original open questions. These are locked inputs, not open.

| # | Question | Decision | Encoded in |
|---|---|---|---|
| R1 (was Q1) | Is $5/month Workers Paid acceptable? | **No.** Everything must fit Workers FREE limits (10 ms CPU, 50 subrequests, 100k requests/day). Stated as a hard constraint; heavy work must not depend on server CPU | Platform constraints, Constraints, AC40, AC29 |
| R2 (was Q2) | Do visitors upload their own documents in the live demo? | **Yes**, with a privacy notice and upload size/page limits | AC37, AC38, Privacy NFR |
| R3 (was Q4) | Is AI on by default in the live demo? | **Yes** (user chose this over the recommended AI-off default). Mandatory protections: per-visitor limit, global daily cap within the ~$10 budget and OpenRouter quotas, cached reuse for samples, automatic downgrade with banner, fresh-vs-cached label, abuse protection | AC32 to AC36, AC39 |
| R4 (was Q3) | Which counsel-sheet export is mandatory? | **DOCX only.** CSV and PDF are out of scope for the MVP | AC21, Out Of Scope |
| R5 (was Q5) | OCR golden case #9 if free models miss the footnote-2 gap? | Run **one capped paid OCR attempt** on the key page(s), cache it; if still missed, document honestly in the README as a known limitation. AC14 stays soft | AC14, probe P1 |
| R6 | Add Review Memory (user PRD) and Anduin-platform findings D1 to D5? | **Yes**, as approved by the user in chat: M1 to M15 (memory) and D1 to D5 (investor-type path view, sibling diff, logic outline, delivery metrics, refreshed background). Recommended defaults taken for PRD open items: memory is scoped per law firm (template label kept as metadata); no second-person approval in the MVP; rule proposal (PRD R9) raised from P2 to P1 with mandatory analyst approval | AC41 to AC64, modified AC1, AC2, AC6, AC19 to AC22, AC27, AC38 |

Revision log: 2026-10-17 R6: Review Memory (user PRD) + Anduin research D1-D5 added, approved by user.

## Open Questions

None that change WHAT is built. Numeric tuning (per-visitor run limit, daily cap value, upload size and page ceilings, retention period) is proposed as defaults in AC32, AC33, AC37 and AC38 and is finalized in PLAN, not asked here. The same applies to the memory retention period and the fixed dismiss-reason wording. Priorities on AC41 to AC64 are P0 (must be in the demo) or P1 (if time allows; cut P1 first if late). PRD questions for Anduin (share of documents that reuse templates, who contacts counsel) are assumptions to confirm with Anduin, not blockers.

## Background / Research Findings

Key facts that shaped this SPEC (full detail in `subdoc-qa-mvp_RESEARCH_17-10-26.md`):

- **Target user:** Anduin Digitization Service Analyst, whose real question is "can this document become unambiguous form logic, and what must counsel confirm first?" Generic proofreaders do not model form logic; sub-doc platforms review investor submissions after the fact, not the source document. Steps 4 (precedent diff) and 5 (counsel sheet with gate) are the differentiators.
- **Verified real defects (golden set):** #1 "this Section 11" (should be 12); #3 and #5 swapped "Part B of Section 6 / 4" references (fixed in #6); #11 "Units" vs defined "Shares"; #9 scan A-1 p.1 Partnership/LLC missing footnote 2; #6 "LLC Agreement" retained after rename (low confidence). Also drafting note "NTD:", placeholders, sensitive bank numbers (#1, #7), `[***]` redactions (#12).
- **Version-drift pairs:** #5 to #6 (terminology, class fees, Appendix C removed, references fixed); #3 vs #4 (restructured); #2 holds two variants in one file without a delimiter.
- **Parser facts affecting expectations:** no heading tags, numbering restarts, statutory citations that look like internal references, varied checkbox glyphs, one document that hides text under images, scans where layout rather than legibility is the challenge.
- **Platform facts:** Workers Free limits (10 ms CPU, 50 subrequests) vs Paid; OpenRouter free limits and rotating free models; implicit paid OCR engine risk; no canvas on Workers for PDF page rendering.
- **Anduin platform facts (refreshed, 2026-10-17; see `subdoc-qa-mvp_ANDUIN-PLATFORM-RESEARCH_17-10-26.md`):** Anduin's AI is investor-side only (OCR extraction with human review, data matching, document routing). "Review Agent" is only a 2026 roadmap label. Sub-doc digitization is manual work by Digitization Service Analysts in Ho Chi Minh City, with no public pre-digitization QA tooling. 2026 scale: about $265B+ raised, 1,305+ funds (April 2026 press release), 76K+ investors. Competitors are consolidating: iCapital acquired Passthrough (February 2026); Juniper Square acquired Tenor Digital (October 2025). Anduin's "Omnibus" form merges several feeder documents into one, which motivates the sibling-document diff (AC19) and the investor-type path view (AC61, AC62).
- **Review Memory source:** the user's own PRD, `subdoc-qa-mvp_PRD-REVIEW-MEMORY_17-10-26.md` (Vietnamese), is the authority for memory behavior (requirements R1 to R10, matching and safety rules, acceptance criteria 1 to 6, success metrics). Adaptations: "email to counsel" is the DOCX counsel sheet export; storage and code details in the PRD are implementation notes left to INNOVATE and PLAN. The PRD's stated assumption (law firms reuse templates across funds) is unconfirmed by Anduin; the demo depends on it.
- **User brainstorm (condensed):** all six capabilities in the MVP, polished English web app, full test suite, live demo plus README plus video plus slides, cheap and cached AI with no-LLM fallback, solo developer, quality over speed.

## TL;DR

- Build a web app where an analyst loads a sub doc (tagged with law firm, fund and version), reviews cited findings side by side, diffs versions or sibling documents, sees which sections apply to each investor type, drafts and exports a counsel sheet, and is gated from digitizing until critical items clear. OCR included.
- Review Memory: every decision and counsel answer is remembered per law firm. On the next fund from that firm, handled items move to "Previously handled", answered questions are not asked again, edited passages are new, and a blocking defect is never hidden. Rules can be added; repeated identical dismissals produce a proposed rule that needs analyst approval.
- 64 testable acceptance criteria (AC1 to AC40 original, AC41 to AC64 added in revision R6, marked P0/P1); the real golden defects (#1, #3/#5, #11, #5-to-#6 drift) are hard requirements; the OCR golden case (#9) is a measured target pending probe P1; memory is proven on a seeded "fund II" fixture (at least 50% fewer items to act on, 0 hidden real defects, 0 repeated questions).
- It must work with no AI at all, cache all AI, stay within about $10, and stay within Cloudflare Workers Free limits (Paid ruled out).
- Live demo: each visitor gets a private sandbox plus a seeded read-only demo workspace; visitor uploads allowed, AI on by default, protected by per-visitor and global caps, cached reuse, auto-downgrade banner and abuse protection. Export is DOCX only. No open questions remain.
