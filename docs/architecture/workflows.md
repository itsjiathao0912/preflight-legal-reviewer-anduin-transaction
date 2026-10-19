# Workflows and personas

Eight workflows (W1-W8) serve four personas. Each section gives the flow diagram, what it does, its status and the code that implements it.

Status key: **Built** (works on `main` and in the local stack), **Partial**, **Planned**, **Not live yet** (built, but needs the real D1 or Turnstile on the live Worker; see [status.md](status.md)).

## Personas

| Persona | Who | Job in the app | Workflows | Spec refs |
|---|---|---|---|---|
| Digitization analyst | Anduin employee who turns a sub doc into a form | Reviews a document before the form build, triages findings, turns unclear items into counsel questions | W1-W6 | US1-US12, US14-US17, US20-US21 |
| Team lead | Analyst with approval rights | Approves or rejects firm rules the tool proposes, audits who decided what, reopens decisions | W7 | US18, US19, AC53-AC55 |
| Challenge reviewer | The Anduin panel or any anonymous visitor | Tries a sample, sees memory working in a seeded demo, works in a private sandbox | W8 | US13, US22, AC56-AC60 |
| Law-firm counsel | External | Never opens the app. Receives the exported DOCX query sheet by email and replies A, B, C or unclear. The analyst records the reply | W4 only, outside the app | none |

The spec ids refer to the [SPEC](../../process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_SPEC_17-10-26.md).

## Overall workflow map

Two loops matter. Decisions feed memory, which labels the next fund. Counsel answers clear the gate.

```mermaid
flowchart LR
  A(["Analyst"]):::who
  L(["Team lead"]):::who
  R(["Demo reviewer"]):::who
  C(["Counsel, outside app"]):::ext

  W1["W1 Open document or package"]:::b
  W2["W2 Review and triage"]:::b
  W3["W3 AI lane"]:::b
  W4["W4 Counsel loop"]:::b
  W5["W5 Compare versions"]:::b
  W6["W6 Structure"]:::b
  W7["W7 Firm memory"]:::b
  W8["W8 Demo session"]:::p
  G{{"Gate: Blocked or Ready"}}:::gate
  M[("Firm memory in D1")]:::store

  A --> W1 --> W2
  R --> W8 --> W1
  W2 -- "candidates" --> W3
  W3 -- "AI suggestions" --> W2
  W2 -- "needs counsel" --> W4
  W5 -- "drift findings" --> W2
  W6 -- "same engine run" --> W2
  W1 -- "package: missing documents" --> W4
  W4 -- "DOCX sheet" --> C
  C -- "A / B / C answer" --> W4
  W2 -- "accept, dismiss" --> M
  W4 -- "answers" --> M
  M -- "labels next fund" --> W2
  M -- "3 same dismissals" --> W7
  L --> W7
  W7 -- "approved rules as AI context" --> W3
  W2 --> G
  W4 --> G

  classDef who fill:#1D5C57,stroke:#1D5C57,color:#ffffff
  classDef ext fill:#E2E6EA,stroke:#8A949C,color:#38454F,stroke-dasharray:4 3
  classDef b fill:#DAEEDF,stroke:#5E9A72,color:#1B5632
  classDef p fill:#F5E8C8,stroke:#B98A2E,color:#6E4100
  classDef gate fill:#F7E2DF,stroke:#B5554A,color:#8A1C1C
  classDef store fill:#E2E6EA,stroke:#8A949C,color:#38454F
```

Green workflows are built. W8 is amber because the demo session needs D1, which is not bound on the live Worker. The gate reads from both review (W2) and counsel (W4).

## W1. Open a document or a fund package (Partial)

The analyst picks a bundled sample, a demo package, or uploads one or many files. One file takes the classic path. Several files take the package path: each file is typed and given a role, the analyst confirms the uncertain rows, and the package is analyzed before the checks run. Scans take the OCR branch and then join the same engine as every other format.

```mermaid
flowchart TD
  S(["Doc switcher"]) --> Q{"Sample, demo package or upload?"}
  Q -- "sample" --> SM["Fetch /samples file, pre-tagged firm, fund, version"]
  Q -- "demo package" --> DP["Load the package files from /samples/packages"]
  Q -- "upload" --> PV["Privacy notice, accept once"]
  PV --> UP["Upload dialog: one or more files, firm from list, fund, version"]
  UP --> VL{"Type, 10 MB per file, 12 files, 40 MB, 30 pages OK?"}
  VL -- "no" --> ER["Clear error, no AI spent"]
  VL -- "yes" --> N{"How many files?"}
  N -- "one" --> DX["Keep bytes 24 h in IndexedDB"]
  N -- "many" --> LR["Light read of each file: type and role by rules, reason shown"]
  DP --> LR
  LR --> CT["Confirmation table: type, role, high or low confidence, why"]
  CT --> CF{"Low-confidence rows confirmed, one sub agreement to digitize?"}
  CF -- "no" --> HOLD["Run checks stays disabled"]
  HOLD --> CT
  CF -- "yes" --> RUN["Run checks"]
  RUN --> PA["Package analysis: references, cross-document terms, coverage"]
  PA --> DX
  SM --> FT{"Format?"}
  DX --> FT
  FT -- "HTML, text PDF, DOCX" --> EN["Engine Web Worker: read, structure, checks"]
  FT -- "scan or image" --> PC{"Precomputed OCR?"}
  PC -- "yes, sample 09" --> OJ["Load OCR JSON, 0 API calls"]
  PC -- "no" --> RP["Render pages, POST /api/ocr per page"]
  RP --> OJ
  OJ --> EN
  EN --> F(["W2 Findings with coverage line"])
  PA -. "missing documents" .-> GP(["W4 For the GP request"])
  PA -. "Package lens" .-> W6(["W6 Structure"])
  classDef d fill:#F5E8C8,stroke:#B98A2E,color:#6E4100
  class UP d
```

- Upload checks: type (`.htm .html .pdf .docx .jpg .jpeg .png`), 10 MB per file, 30 scan pages. A package takes up to 12 files and 40 MB in total. Failures show a clear error and spend no AI.
- Package path: type and role are chosen by a rule table (file name and text), never by a model; every row shows its confidence and the reason. A low-confidence row must be confirmed before Run checks enables. The baseline is chosen with the role select, and only an earlier document of the same firm is offered (a package with no firm sees only its own files). A package with no subscription agreement holds the run.
- A single high-confidence subscription agreement uploaded alone opens as a one-document package, so it also gets a coverage line. Bundled samples show no package UI.
- The package is kept in IndexedDB for 24 hours and is restored on reload ("Recent packages" in the Upload dialog). Nothing about a package goes to the server.
- Samples open with zero calls to `/api/ai` or `/api/ocr`; precomputed AI and OCR JSON ship as static files.
- Uploaded bytes stay in IndexedDB for 24 hours and are never sent to the server except scan page images for OCR.
- Partial because the interim open-document dialog is built, but the full `#documents` screen from the mockup is still a placeholder route. Live OCR on uploads waits for a human-solved Turnstile challenge.
- Key code: [open-actions.ts](../../apps/web/src/features/open-document/open-actions.ts), [package-actions.ts](../../apps/web/src/features/open-document/package-actions.ts), [PackageConfirmTable.tsx](../../apps/web/src/features/open-document/PackageConfirmTable.tsx), [validate-upload.ts](../../apps/web/src/features/open-document/validate-upload.ts), [detect.ts](../../packages/core/src/package/detect.ts), [analyze.ts](../../packages/core/src/package/analyze.ts), [state/package.ts](../../apps/web/src/state/package.ts), [engine.worker.ts](../../apps/web/src/engine/engine.worker.ts), [render-pages.ts](../../apps/web/src/engine/render-pages.ts), [ocr-queue.ts](../../apps/web/src/engine/ocr-queue.ts), [adapters](../../packages/core/src/adapters/format-detect.ts)

### Package intake: from upload to GP request

| Step | What the analyst sees | Code |
|---|---|---|
| 1. Upload | Several files, firm, fund | [OpenDocumentDialog.tsx](../../apps/web/src/features/open-document/OpenDocumentDialog.tsx) |
| 2. Type and role confirm | Table of file, type, role, confidence, reason; confirm low rows | [PackageConfirmTable.tsx](../../apps/web/src/features/open-document/PackageConfirmTable.tsx), [detect.ts](../../packages/core/src/package/detect.ts) |
| 3. Package map | Structure > Package lens: documents, external references (Resolved, Not in package, Needs confirmation), cross-document terms ("Defined in LPA", "Unverified") | [PackageLens.tsx](../../apps/web/src/features/package/PackageLens.tsx), [references.ts](../../packages/core/src/package/references.ts), [terms.ts](../../packages/core/src/package/terms.ts) |
| 4. Coverage | One coverage line in the Findings header and the gate popover; a table per check group in the lens; a missing sub agreement blocks, a missing LPA or PPM only warns | [coverage.ts](../../packages/core/src/package/coverage.ts), [policy.ts](../../packages/core/src/package/policy.ts), [CoverageLine.tsx](../../apps/web/src/features/gate/CoverageLine.tsx) |
| 5. GP request | Questions > "For the GP": one item per missing document with its quote, and one request DOCX | [request.ts](../../packages/core/src/package/request.ts), [GpRequestGroup.tsx](../../apps/web/src/features/counsel/GpRequestGroup.tsx), [exportRequestDocx.ts](../../apps/web/src/features/counsel/exportRequestDocx.ts) |

## W2. Review and triage (Built)

Deterministic results show first, memory labels each finding, and every decision is written back.

```mermaid
flowchart TD
  E["Engine: read, structure, 13 detectors"] --> FP["Fingerprint each finding: firm + class + quote hash"]
  FP --> FM{"Firm known?"}
  FM -- "no" --> NB["Banner: memory not applied, all New"]
  FM -- "yes" --> LK["POST /api/memory/lookup"]
  LK --> LB{"Exact match?"}
  LB -- "none" --> N["New"]
  LB -- "dismissed" --> BL{"Blocks digitization?"}
  BL -- "no" --> PH["Previously handled, collapsed"]
  BL -- "yes" --> RC["Stays in list: re-confirm"]
  LB -- "answered" --> AA["Already answered + prior answer"]
  LB -- "asked, no answer" --> AW["Awaiting counsel"]
  N --> T["Findings list: one row each"]
  RC --> T
  AA --> T
  AW --> T
  T --> ACT{"Analyst action"}
  ACT -- "Accept" --> D["Decision via outbox, POST /api/decisions"]
  ACT -- "Dismiss + required reason" --> D
  ACT -- "Needs counsel" --> W4(["W4 Counsel"])
  D --> G{{"Gate recomputed"}}
  W4 --> G
  classDef gate fill:#F7E2DF,stroke:#B5554A,color:#8A1C1C
  class G gate
```

- Matching is exact, never fuzzy. Changing "Section 4" to "Section 5" produces a new finding.
- A dismissed finding of severity `critical` or `high` is never hidden: it stays in the list as "re-confirm".
- Dismiss requires a reason code. Accept alone does not release a critical item from the gate.
- Edit of finding text or severity (AC6) is not built (backlog B-EDIT).
- In a package, a coverage line sits in the Findings header next to the gate pill, and a partial package never looks fully checked. A term defined in the package LPA is not flagged as undefined; with no LPA it is listed as "Unverified" and counted in coverage.
- Key code: [engine.ts](../../packages/core/src/engine.ts), [fingerprintFindings.ts](../../apps/web/src/memory/fingerprintFindings.ts), [label.ts](../../packages/core/src/memory/label.ts), [FindingsScreen.tsx](../../apps/web/src/features/review/FindingsScreen.tsx), [outbox.ts](../../apps/web/src/api/outbox.ts), [decisions route](../../apps/worker/src/routes/memory/decisions.ts)

## W3. AI lane (Built; uploads closed on the live site)

AI judges only candidates the rules picked, must quote real text, and can never block digitization.

```mermaid
flowchart TD
  ST(["Candidates from W2"]) --> ON{"AI switch on?"}
  ON -- "off" --> NL["No-LLM mode: banner names what was skipped"]
  ON -- "on" --> PC{"Static /precomputed file?"}
  PC -- "yes" --> V
  PC -- "no, sample" --> BT["Show 'Run AI on this sample'"]
  PC -- "no, upload" --> API["POST /api/ai"]
  BT --> API
  API --> CH{"D1 cache hit?"}
  CH -- "hit" --> V
  CH -- "miss" --> TS{"Turnstile, visitor quota, daily cap, spend cap"}
  TS -- "refused" --> BN["Banner: limit reason, deterministic work untouched"]
  TS -- "ok" --> OR["OpenRouter free model, streamed, firm rules as context"]
  OR --> CS["Classify, cache, ledger"]
  CS --> V["verifyAi: quote must exist in document"]
  V -- "quote missing" --> DR["Dropped and logged"]
  V -- "ok" --> SG["'AI suggestion' rows: model, fresh or cache, never gates"]
  classDef r fill:#F7E2DF,stroke:#B5554A,color:#8A1C1C
  class API,CH,TS r
```

- Tasks: `clause-judgment@1`, `counsel-draft@1`, `drift-narrative@1` and the OCR prompt `ocr2`. The client never sends prompts; the Worker builds them from the shared registry.
- Red steps need D1 and Turnstile on the live Worker, so they fail closed today. Precomputed results exist for two samples and the 22-page scan set.
- Active firm rules are sent as context. They change the rules hash and so the cache key.
- Key code: [ai-lane.ts](../../apps/web/src/features/ai/ai-lane.ts), [stream-client.ts](../../apps/web/src/features/ai/stream-client.ts), [verify-quote.ts](../../packages/core/src/llm/verify-quote.ts), [pipeline.ts](../../apps/worker/src/proxy/pipeline.ts), [openrouter.ts](../../apps/worker/src/upstream/openrouter.ts)

## W4. Counsel loop (Built)

The only workflow that leaves the app. The gate opens when every critical item has a clear answer.

```mermaid
flowchart LR
  NC(["Needs counsel or Accepted"]) --> SH["Counsel sheet: unanswered only"]
  SH --> DW{"AI on?"}
  DW -- "no" --> TP["Template draft"]
  DW -- "yes" --> AD["AI draft, counsel-draft@1"]
  TP --> ED["Analyst edits wording"]
  AD --> ED
  ED --> EX["Export DOCX, downloads first"]
  EX --> MR["Record export to memory, best effort"]
  EX --> CO(["Counsel replies A / B / C / unclear"])
  CO --> RA["Analyst records answer"]
  RA --> ANS{"Answer"}
  ANS -- "A, B or C" --> OK["Answered, stored, no longer gates"]
  ANS -- "unclear" --> NX["Back on next sheet, still blocks"]
  OK --> G{{"Gate"}}
  NX --> G
  G -- "all critical resolved" --> RDY(["Ready to digitize"])
  classDef gate fill:#F7E2DF,stroke:#B5554A,color:#8A1C1C
  classDef ok fill:#DAEEDF,stroke:#5E9A72,color:#1B5632
  class G gate
  class RDY ok
```

- The DOCX contains only unanswered New and Accepted questions (decision D-1). Answers are shown in the app.
- Awaiting-counsel items can be answered in the app (D-3). An answer on a "re-confirm" item counts as the re-confirmation (D-2).
- `unclear` keeps the item blocking and re-includes it in the next sheet.
- With a package open, the sheet gains a **For the GP** group: one item per document the sub agreement cites but the package lacks, each with the quote, plus one request DOCX. These are requests, not findings: they never touch memory or the gate.
- Key code: [sheet.ts](../../packages/core/src/counsel/sheet.ts), [template-draft.ts](../../packages/core/src/counsel/template-draft.ts), [gate.ts](../../packages/core/src/counsel/gate.ts), [CounselScreen.tsx](../../apps/web/src/features/counsel/CounselScreen.tsx), [exportDocx.ts](../../apps/web/src/features/counsel/exportDocx.ts), [counsel route](../../apps/worker/src/routes/memory/counsel.ts)

## W5. Compare versions (Built)

```mermaid
flowchart LR
  P["Pick v1 and v2"] --> MD{"Mode"}
  MD -- "Versions, default" --> DF["diffDocuments in engine worker"]
  MD -- "Siblings: feeder or parallel" --> SB["Label clauses common or differing"]
  DF --> OUT["Sections, renames, fees, requirements"]
  DF --> DL["Findings delta: fixed, still present, new"]
  SB --> DL
  OUT --> NC{"Needs counsel?"}
  NC -- "maps to open-doc finding" --> W4(["W4 Counsel"])
  NC -- "diff-only row" --> BK["Disabled, backlog"]
  OUT -. "Summarize changes button" .-> AI["drift-narrative@1 via /api/ai"]
```

- Versions mode is the default on every load (D-6). Siblings mode labels clauses common or differing for feeder and parallel funds.
- Sample 5 against sample 6 gives 4 fixed, 3 still present, 0 new.
- Scanned documents cannot be compared yet (backlog). Diff-only rows cannot become counsel questions yet (backlog).
- **Variance (Built, live 18 Oct 2026)** is the baseline view inside Findings, not part of Compare. With a firm set, the analyst picks a baseline from the same firm ("vs <baseline>"; picker samples never qualify). The **Changes** segment lists meaningful changes only: cosmetic ones are hidden and grouped (demo: 214 raw changes shown as 7, 3 new + 4 logic), each row has an impact line computed from the logic graph and an owner chip (Counsel, GP, Fund admin). No model call is made.
- Variance questions land in **Questions** (the former Counsel questions screen) under owner tabs Counsel, GP and Fund admin, with one export per owner. The answer dialog records intent and scope (fund or firm template). A firm-template answer such as "Appendix C must exist" creates an R-01 regression check; a later fund of the same firm that lacks it shows "Regression: confirmed in Fund II". The gate stays Blocked or Ready and counts changes, regressions and unanswered owner questions.
- Key code: [variance](../../packages/core/src/variance/index.ts), [diff](../../packages/core/src/diff/index.ts), [findings-delta.ts](../../packages/core/src/diff/findings-delta.ts), [sibling.ts](../../packages/core/src/diff/sibling.ts), [CompareScreen.tsx](../../apps/web/src/features/compare/CompareScreen.tsx)

## W6. Structure and investor types (Built)

```mermaid
flowchart LR
  G["Logic graph from the engine run"] --> IS["Issues only, default"]
  G --> ALL["Show everything"]
  IS --> LN["Lenses: sections, references, conditions, options, terms, investor types"]
  ALL --> LN
  LN --> DR["Row drawer: rule id and facts used"]
  LN --> IT["Investor types: pick a type, see its ordered path"]
  IT --> GP["Gap row, e.g. LLC lacks footnote 2"]
  GP --> F(["Same finding in W2"])
  G --> OX["Export logic outline JSON"]
```

- Structure is a reading aid on the same engine output. It creates no separate state.
- With a package open, a seventh **Package** lens appears: the documents, external references with their quote and location, cross-document terms and coverage per check group. It is not a new screen or sidebar item, and it disappears when the open document has no package.
- "Issues only" is the default; "Show everything" reveals full lists.
- Investor paths: pick a type, see its ordered path through the form and any gap. Gaps feed the same findings list.
- Key code: [structure-view/build.ts](../../packages/core/src/structure-view/build.ts), [investor](../../packages/core/src/investor/paths.ts), [outline/build.ts](../../packages/core/src/outline/build.ts), [StructureScreen.tsx](../../apps/web/src/features/structure/StructureScreen.tsx), [InvestorTypesLens.tsx](../../apps/web/src/features/investor-paths/InvestorTypesLens.tsx)

## W7. Firm memory, rules and audit (Built; needs D1 live)

```mermaid
flowchart TD
  DS["Dismissals with the same reason"] --> CNT{"3 or more for one firm and pattern?"}
  CNT -- "no, or reason 'other'" --> NO["No proposal"]
  CNT -- "yes" --> PR["Suggested rule, no effect yet"]
  PR --> RV{"Team lead reviews evidence"}
  RV -- "approve" --> AR["Active firm rule"]
  RV -- "reject" --> RJ["Inactive, may return with new evidence"]
  AR --> CTX["Sent to AI as context, never a filter"]
  CTX --> KEY["Changes rules hash, so old AI cache is not served"]
  DEC["Decisions tab"] --> RO["Reopen with reason"]
  RO --> RVK["Decision revoked, kept"]
  RVK --> NEW["Finding returns as New, gate re-blocks"]
  PR --> AU[("Append-only audit trail")]
  AR --> AU
  RJ --> AU
  RVK --> AU
```

- Rules are scoped to one law firm and never shown for another.
- A rejected proposal may return when new same-reason dismissals arrive (D-5). Reason `other` never proposes.
- Rules are AI context only, never a filter on findings.
- Decisions, rule changes and reopens write append-only audit events; database triggers block edits and deletes.
- Key code: [proposal.ts](../../apps/worker/src/memory/proposal.ts), [rules route](../../apps/worker/src/routes/memory/rules.ts), [audit route](../../apps/worker/src/routes/memory/audit.ts), [rulesHash.ts](../../packages/core/src/memory/rulesHash.ts), [MemoryView.tsx](../../apps/web/src/features/memory/MemoryView.tsx)

## W8. Demo reviewer (Partial: built locally, Not live yet)

```mermaid
flowchart LR
  V(["Visitor opens URL"]) --> SPA["Static app loads"]
  SPA --> SS["First memory call: POST /api/session"]
  SS --> SB["Private sandbox + copy of demo seed"]
  SB --> PK["Open sample #5 or #6"]
  PK --> MEM["Shows 'Previously handled' from decisions seeded on #3"]
  MEM --> TRY["Try triage and counsel in own sandbox"]
  TRY --> PUR["Purged after 30 days, demo seed kept"]
```

- Limits: 50 sessions per IP and 300 per day, 3 fresh-AI documents per visitor per day (D-4).
- Writes to the shared demo workspace are blocked by database triggers; nobody holds a cookie bound to it.
- Sandbox data is purged after 30 days; the demo seed is never purged.
- Key code: [session.ts](../../apps/worker/src/routes/memory/session.ts), [seed-copy.ts](../../apps/worker/src/memory/seed-copy.ts), [demo.sql](../../apps/worker/seed/demo.sql), [purge.ts](../../apps/worker/src/memory/repo/purge.ts)

## Cross-workflow links

| Link | From to | How it works |
|---|---|---|
| Memory loop | W2, W4 to W7 and back to W2 | Decisions and counsel answers are stored by fingerprint. The next document for the same firm gets each finding labeled New, Previously handled, Already answered or Awaiting counsel. Three same-reason dismissals for one pattern propose a rule (W7). |
| Counsel loop | W2 to W4 to gate | "Needs counsel" and Accepted critical findings become sheet questions. A clear A, B or C answer resolves the item; the gate recomputes in W2 and W4. |
| Rules to AI context to cache key | W7 to W3 | Approved rules are injected into the AI prompt as context. `rules_hash` (sha256 of sorted normalized active rule texts) is part of the cache key, so a rule change never serves stale AI output. |
| Structure feeds review | W6 to W2 | Investor-path and structure detectors emit ordinary findings, so they get labels, triage and gate treatment like any other finding. |
| Variance feeds questions and gate | W5 to W4 to gate | Meaningful changes get an owner and become questions; firm-template answers become regression checks for the firm's later funds; the gate counts changes, regressions and unanswered owner questions. |
| Drift feeds review | W5 to W2 | Findings delta marks each finding fixed, still present or new between two versions; mapped rows can become counsel questions. |

## Related

- [README.md](README.md): architecture overview and runtime map
- [components.md](components.md): the components these workflows use
- [data-model.md](data-model.md): where decisions, answers and rules are stored
- [decisions.md](decisions.md): why the workflows are shaped this way
- [app.html](../../design/mockups/app.html): approved UI prototype
