# Decision log

Thirteen architecture decisions in ADR form: what was chosen, why, what was rejected, and what it costs. Sources: the [INNOVATE decision summary](../../process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_INNOVATE_17-10-26.md), the umbrella plan, the [mockup notes](../../design/mockups/app_NOTES.md) and measured spike results. All decisions below are in force in the code on `main`.

| # | Decision | Status |
|---|---|---|
| ADR-1 | Browser-first engine with a thin Worker proxy | Built |
| ADR-2 | Deterministic detectors, LLM judges graph-selected candidates | Built |
| ADR-3 | No Docxodus; one diff pipeline for every format | Built |
| ADR-4 | Free OpenRouter models, precomputed results, no-LLM mode | Built |
| ADR-5 | Cloudflare Workers Free plus D1, no R2, KV or Durable Objects | Built; D1 live (update 17 Oct 2026) |
| ADR-6 | Exact-match memory fingerprints, no fuzzy matching | Built |
| ADR-7 | AI suggestions cannot gate | Built |
| ADR-8 | AI fails closed when the platform is unavailable | Built |
| ADR-9 | Per-visitor sandbox workspaces plus a read-only seeded demo | Built; live (update 17 Oct 2026) |
| ADR-10 | Vertical sidebar and "show less by default" UI | Built |
| ADR-11 | Counsel stays outside the app (DOCX out, answer recorded in) | Built |
| ADR-12 | Product defaults D-1 to D-9 | Built |
| ADR-13 | Fund package intake folds into existing screens; browser-only package storage; rule-based type detection; LLM suggester deferred | Built; live (17 Oct 2026, version 3d2c7301) |
| ADR-14 | Variance folds into Findings and Questions; deterministic, same-firm baseline, owners and regression checks; additive migration 0006 | Built; live (18 Oct 2026, version d9aaddd9) |

## ADR-1. Browser-first engine with a thin Worker proxy

- **Decision.** Parsing, structuring, checks, diff, template drafts, the gate and DOCX export run in a browser Web Worker. The Cloudflare Worker serves static assets and guards `/api/*`; it never parses a document.
- **Context.** Uploads must work for anonymous visitors on a free hosting plan. A feasibility probe (P4) measured server-side parsing at 31-394 ms CPU against the 10 ms Workers Free limit. Containers and Queues were not verified on the free plan.
- **Alternatives rejected.** Server-centric app (Next or Remix on Workers, or a Worker-side parser): over the CPU limit and breaks the free-hosting constraint. Static site with precomputed results only: no visitor uploads.
- **Consequences.** Documents never leave the browser (privacy is structural, not a promise). The same TypeScript runs in the browser and in Node tests. The cost is that the browser does heavier work, and the engine must be written as pure, portable code in [packages/core](../../packages/core/src/index.ts).

## ADR-2. Deterministic detectors, LLM judges graph-selected candidates

- **Decision.** Every document becomes a logic graph. Pure detectors produce findings with a rule id and the facts used. The LLM receives only candidate passages the graph selected, in one batched strict-schema call.
- **Context.** A spike (P2) showed an LLM used as a free discovery engine gives inconsistent output on long legal text. Analysts need explainable, reproducible results.
- **Alternatives rejected.** LLM reads the whole document and finds issues. Regex-only with no AI (loses ambiguity and contradiction cases).
- **Consequences.** Core defects (broken references, skips, unreachable sections, investor-path gaps) are found with no AI and no cost. AI adds judgment on ambiguity, contradiction and typos only. The detector set is limited to what the parser can prove; unparsed text is ignored, never asserted. See [components.md](components.md#detectors).

## ADR-3. No Docxodus; one diff pipeline for every format

- **Decision.** Version comparison aligns sections (scope path plus heading and body similarity), runs a word diff (jsdiff), extracts terms, fees and requirements, infers renames, and computes a findings delta. The same pipeline serves HTML, PDF, DOCX and OCR input.
- **Context.** Docxodus (a WASM DOCX differ) was a candidate. It adds a large bundle, an unverified Workers startup, and works for DOCX only.
- **Alternatives rejected.** Docxodus WASM. A PDF viewer with highlighting for the MVP (the model-based reading view gives uniform, testable highlights).
- **Consequences.** One code path to test. Format-specific loss (for example reconstructed DOCX numbering) is labeled in the UI. Scanned documents cannot be compared yet.

## ADR-4. Free OpenRouter models, precomputed results, no-LLM mode

- **Decision.** Only `:free` OpenRouter model ids are allowed (checked on every use). Samples ship precomputed AI and OCR JSON. A D1 cache serves repeats. A no-LLM mode keeps all deterministic features and says what it skipped.
- **Context.** Total budget is about $10 and the account has no credits. Free model ids rotate.
- **Alternatives rejected.** Paid models by default. Live LLM calls for every sample open. Mixing paid ids into the free model list (a paid fallback exists as a separate, spend-capped call and is off).
- **Consequences.** $0 spent so far. The model list is configuration, not code. Quality depends on free models, so AI output is always labeled and verified (ADR-7). Per-visitor and global caps (3 fresh-AI documents per visitor per day, 35 AI requests per day globally) protect the shared free quota. PDFs are never sent to OpenRouter, which avoids an implicit paid OCR default; only rendered page images go out.

## ADR-5. Cloudflare Workers Free plus D1, no R2, KV or Durable Objects

- **Decision.** One Worker (`preflight-legal-reviewer`) serves the app and API on `*.workers.dev`. D1 is the system of record for memory, cache, counters and the spend ledger. Atomic counters use `UPDATE ... WHERE count < cap`.
- **Context.** Free hosting, no stored uploads, a need for a shared audit trail and concurrent-safe quotas.
- **Alternatives rejected.** R2 (nothing to store). Durable Objects (not on the free plan). KV (1,000 writes a day). IndexedDB-only memory (no shared audit trail, and breaks the snippets-on-server rule). No custom domain; the owner's personal domain is never touched, and only `*.workers.dev` is used.
- **Consequences.** D1 Free allows 100k rows written a day, which is the main capacity risk; session minting is capped (5 per IP, 300 per day) to stay near a quarter of that. A daily cron purge exists, and a lazy purge from new sessions is the baseline. Free-plan CPU of 10 ms is why the Worker never parses.

Update 17 Oct 2026: D1 + Turnstile live (version 23612b12); real D1 `aduin-transaction-db`, schema 5.

## ADR-6. Exact-match memory fingerprints, no fuzzy matching

- **Decision.** A finding matches a past decision only if `sha256("fp1|firm|class|sha256(normalize(quote))")` is identical.
- **Context.** A wrong "previously handled" label could hide a real defect. A legal edit from "Section 4" to "Section 5" is exactly the kind of change that must resurface.
- **Alternatives rejected.** Fuzzy or embedding similarity. Matching across law firms.
- **Consequences.** Safe and explainable; small harmless rewordings create new findings. A critical or high finding that matches a dismissal is never hidden: it stays in the list as "re-confirm". Rules are scoped to one firm. See [data-model.md](data-model.md#fingerprint-formula).

## ADR-7. AI suggestions cannot gate

- **Decision.** The gate counts only `critical` findings not detected by AI. AI findings are labeled "AI suggestion", capped at `high`, and must quote a passage that exists in the document, else they are dropped and logged.
- **Context.** Free models hallucinate. A gate that a model can raise or lower would be untrustworthy.
- **Alternatives rejected.** Letting high-confidence AI findings block. Letting AI close findings.
- **Consequences.** The gate is reproducible from rules and human decisions alone. An analyst can still triage AI suggestions like any other row. See [gate.ts](../../packages/core/src/counsel/gate.ts) and [verify-quote.ts](../../packages/core/src/llm/verify-quote.ts).

## ADR-8. AI fails closed when the platform is unavailable

- **Decision.** If D1 or config is missing, `/api/ai` and `/api/ocr` refuse with a limit reason, `/api/quota` answers `global_ok:false`, and memory routes answer `memory_unavailable`. The UI shows a banner; deterministic work continues.
- **Context.** Without quota counters and a spend ledger, any AI call could be unbounded.
- **Alternatives rejected.** Fail open with in-isolate counters. Hide AI controls.
- **Consequences.** This is the live state today: no D1 binding means shared memory and fresh AI or OCR on uploads are closed, while precomputed samples work. Fail-closed was chosen over any chance of an unmetered call. Code: `unavailablePlatform()` in [ports.ts](../../apps/worker/src/proxy/ports.ts) and the lazy build in [index.ts](../../apps/worker/src/index.ts).

## ADR-9. Per-visitor sandbox workspaces plus a read-only seeded demo

- **Decision.** The first memory call mints a signed-cookie sandbox that is a copy of the demo seed. Nobody holds a cookie bound to the demo workspace; database triggers block writes to it.
- **Context.** Reviewers must see memory working immediately, and must not be able to damage or leak into each other's data.
- **Alternatives rejected.** A shared writable demo. A read-only overlay on shared data (breaks isolation). Accounts and logins.
- **Consequences.** Isolation by composite keys, so every query binds `workspace_id`. Sandboxes expire after 30 days. Session creation is rate limited. Needs D1, so it is not live yet.

Update 17 Oct 2026: D1 + Turnstile live (version 23612b12); the sandbox and demo seed run on the live Worker.

## ADR-10. Vertical sidebar and "show less by default" UI

- **Decision.** One left sidebar (232 px, icon rail below 1200 px) with Review, Check and Firm groups, hash routes, and a gate button always visible. Each screen shows what the analyst must act on and keeps detail one click away (row expand, drawer, popover, dialog). Structure opens on "Issues only"; Compare opens in Versions mode; at most one or two lines of muted help per screen.
- **Context.** The user's design review of the first mockups found panels and permanent explanatory text crowding the work. Notes and dropped elements are listed in [app_NOTES.md](../../design/mockups/app_NOTES.md).
- **Alternatives rejected.** Top tabs with many panels. Always-on legends, stat cards and help paragraphs.
- **Consequences.** A calm review screen and one shared state, so the gate, counts and document label stay consistent. Only filters, sidebar collapse and AI on/off persist (in guarded browser storage); the route never does. Prototype: [app.html](../../design/mockups/app.html).

## ADR-11. Counsel stays outside the app

- **Decision.** The app exports a DOCX of unanswered questions. Counsel replies by email with A, B, C or unclear. The analyst records the reply.
- **Context.** Real counsel will not log into a vendor tool for a pre-digitization query. A sheet matches today's practice.
- **Alternatives rejected.** A counsel portal or login. Email integration.
- **Consequences.** No external identity system to build or secure. The answer step is manual by design.

## ADR-12. Product defaults D-1 to D-9

Approved by the user in the design session (D-8 and D-9 were orchestrator decisions, reversible). Full text in the [umbrella plan](../../process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md).

| # | Decision | Effect |
|---|---|---|
| D-1 | Counsel DOCX contains only unanswered New and Accepted questions | Sheet stays short; answers are viewed in the app |
| D-2 | An answer on a "re-confirm" item counts as the re-confirmation | One step clears it |
| D-3 | Awaiting-counsel items can be answered in the app | No need to re-export |
| D-4 | Retention: uploads 24 h in the browser, sandbox memory 30 days, demo never purged; 3 fresh-AI documents per visitor per day; opening a cached sample does not count | Bounds privacy exposure and free quota |
| D-5 | A rejected rule proposal can return when new same-reason dismissals arrive | Learning stays open without nagging |
| D-6 | Compare opens in Versions mode by default | Most common job first |
| D-7 | Sample corpus is 12 HTML files plus the 22-page scan set; the ILPA PDF stays local-only (copyright) | Only redistributable public filings are shipped |
| D-8 | `axe-core` (MPL-2.0) allowed as a dev-only test dependency, not shipped | Accessibility checks without licence risk |
| D-9 | Worker tests use `@cloudflare/vitest-plugin` instead of the deprecated pool package | Supported test runner |

## ADR-13. Fund package intake folds into existing screens, browser-only storage, rule-based detection

- **Decision.** A fund package (sub agreement plus LPA, PPM, baseline, side letters, tax forms) is handled with no new screen and no new sidebar item. Upload takes many files and shows a confirmation table; Structure gains a "Package" lens; the Findings header and gate popover gain a coverage line; Counsel questions gains a "For the GP" group with one request DOCX. A package is stored only in the browser (IndexedDB, 24 hours) and restored on reload. Document type and role are chosen by a rule table that shows its reason and confidence; low-confidence rows need the analyst's confirmation. An LLM document-type suggester exists only as a seam (it can propose, never override) and no model task ships. The missing-document gate policy is data: a missing sub agreement blocks, a missing LPA or PPM only warns.
- **Context.** A sub doc cites an LPA, annexes, side letters and tax forms that are often not uploaded with it. Without them the tool either flags terms the LPA defines (false errors) or silently skips checks (false confidence). The product rule is to integrate new features into existing screens and keep the engine deterministic and free.
- **Alternatives rejected.** Four separate screens as in the original PRD (intake, package map, coverage, requests): adds navigation the analyst does not need and fragments one flow. Server-side package storage (a D1 migration and a Worker route): nothing needs it, it adds privacy surface (full documents on the server) and Worker CPU, and the free D1 write budget is the known capacity risk. LLM classification of document type: rules reach the demo set with no wrong high-confidence type, a model call costs quota and adds a nondeterministic step in front of every check, and a wrong type would silently change coverage. Missing documents as ordinary findings: would need a new issue class, fingerprint and memory semantics and would change the gate matrix.
- **Consequences.** Everything runs offline in the browser and costs $0 (0 live model calls). The gate, the 13 detectors and the 15 issue classes are unchanged; package-level checks sit beside them. Known costs: type detection is rules only, so two subscription agreements in one package always need the analyst to pick roles; reference and term extraction miss some forms (for example the "US Feeder Subscription Agreement" on package 02, and Schedule and Exhibit targets); the bundle grew by about 270 kB. See [status.md](status.md) and [data-model.md](data-model.md#fund-packages-are-browser-only).

## ADR-14. Variance Management folds into Findings and Questions

- **Decision.** Change review against a baseline lives inside existing screens: a Changes segment in Findings with a "vs <baseline>" control, owner tabs in Questions (the former Counsel questions), and the existing two-state gate. The baseline must come from the same law firm; picker samples never act as a baseline. Cosmetic changes are hidden and grouped; each meaningful change gets an impact line from the logic graph and an owner (Counsel, GP or Fund admin). An answer records intent and scope; a firm-template answer becomes an R-01 regression check that is tested against later funds of the same firm. No new screen, no new issue class (changes use `version_drift`), no model call.
- **Context.** Analysts compare each new fund with the firm's earlier one. Raw diffs are mostly noise (the demo pair has 214 raw changes, 7 of which matter), and a change is useless unless someone owns the follow-up. The product rule is to integrate, not add screens.
- **Alternatives rejected.** A separate Compare-style screen for variance (extra navigation, a second gate); LLM classification of changes (cost, non-determinism, breaks the deterministic-first principle); cross-firm baselines (different drafting conventions make the diff meaningless); a three-state gate (kept two-state: Blocked or Ready).
- **Consequences.** Cost $0 and fully reproducible. Migration 0006 is additive and forward-only (nullable owner, intent and scope columns plus `regression_check`), but the previous Worker 8a82ead2 refuses memory writes afterwards, so rollback means roll forward or a D1 restore. Known costs: digit changes in operative text count as logic (package 01 shows 9 rows, not 7), the V7 trust-split change is owned by the GP (SPEC A9), and fund-scoped answers can supersede across funds.

## Related

- [README.md](README.md): principles these decisions implement
- [components.md](components.md): the resulting components
- [data-model.md](data-model.md): ADR-5, ADR-6 and ADR-9 in schema form
- [status.md](status.md): which decisions are live
- [product-domain.md](../../process/context/product-domain.md): domain background
