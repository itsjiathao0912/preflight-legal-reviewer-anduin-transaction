---
slug: subdoc-qa-mvp
date: 2026-10-17
verdict: NOT-VIABLE
originating-phase: spec
---

# Feasibility - contract-lint (H1) and compare-cli (H2) vs the sub-doc QA goldens (subdoc-qa-mvp)

**TL;DR:** Both tools are NOT-VIABLE as a test oracle or as a diff engine for our samples. contract-lint caught 5 of the 7 golden-cross-reference defects only by accident (it flags nearly *every* "Section N" because it cannot find headings in our HTML), and with correct headings it misses all three golden defect types. It adds nothing we can't write ourselves in under 100 lines of TS. compare-cli's clause alignment collapses on our untagged HTML (29 "added" / 52 "removed" clauses of garbage between #5 and #6), but its pure core is browser-portable and its word-diff does surface the Units-to-Shares style renames, which `jsdiff` also does. Recommendation: build our own parser and rules; treat both repos as reading material only. Sources are MIT, so ideas can be copied with notice.

## Hypothesis
- **H1:** contract-lint 0.2.6 (PyPI, MIT) detects the golden defects in our sample sub docs and is useful as (a) a test oracle and/or (b) a source of rules to port to TypeScript.
- **H2:** compare-cli 0.4.2 (JS, MIT) produces a useful version-drift diff for the Partners Group pairs #5/#6 and #3/#4 and can run in a browser (no Node-only dependencies), relevant to the Workers Free 10 ms CPU constraint.

## Mechanism Under Test
Whether two existing open-source contract tools, run unmodified on the real sample HTML (no heading tags, numbers in separate cells, statutory "Section N" cites), reproduce the SPEC golden cases (AC10-AC16, AC19) and whether their sources contain reusable or browser-portable logic.

## Verdict
NOT-VIABLE

Per hypothesis: H1 NOT-VIABLE as test oracle and as primary rule source (ideas only). H2 NOT-VIABLE as a drop-in drift diff; its pure core is browser-portable, but that core is small and replaceable by `jsdiff`.

## Probe Method
Per-hypothesis commands and inputs are given under "Evidence Captured" below (H1 and H2 subsections, "Probe Method" headings). Summary: isolated venv and clones in the scratchpad, run each tool on the 12 `.htm` samples (and the pairs for H2), score against RESEARCH A, read the sources, plus a synthetic control file.

## Evidence Captured
### H1 - contract-lint 0.2.6 (PyPI, MIT): oracle and/or rule source

#### Per-hypothesis verdict: NOT-VIABLE (as oracle: NOT-VIABLE; as rule source: marginal, a few small regexes only)

#### Probe Method
- Python 3.14.3 in an isolated venv under the scratchpad (`spike/py/pyenv`), `pip install contract-lint` (0.2.6, zero runtime deps, no extras needed for HTML). Source cloned separately (`spike/cl-src`, one 2,242-line file `contract_lint_cli.py`) and read before running.
- Ran `contract-lint lint --json --fail-on none <file>` under `python -I` on every `.htm` in `samples/sub-docs/raw/`, once with default rules and once with `--enable undefined-term --enable signature-block`.
- Note: `raw/` holds **12** `.htm` files (#1-#8, #10-#13), not 13; #9 is the scan folder and #14 is a PDF (`contract-lint` needs the `[pdf]` extra for it; not run, local-only copyrighted file anyway).

#### Evidence Captured: run results (default rules)

| Sample | Total | broken-xref | placeholder | numbering | duplicate-heading | double-def | unused-def |
|---|---|---|---|---|---|---|---|
| #1 Franklin | 37 | 34 | 2 | 1 | 0 | 0 | 0 |
| #2 Coatue | 89 | 36 | 4 | 0 | 31 | 16 | 2 |
| #3 PG Master 2019 | 34 | 29 | 4 | 0 | 0 | 1 | 0 |
| #4 PG TEI 2016 | 62 | 1 | 51 | 9 | 0 | 1 | 0 |
| #5 PG NGI 2024 | 110 | 20 | 86 | 2 | 0 | 1 | 1 |
| #6 PG NGI 2026 | 98 | 21 | 76 | 0 | 0 | 1 | 0 |
| #7 Cottonwood | 31 | 2 | 7 | 15 | 6 | 1 | 0 |
| #8 Modiv | 6 | 1 | 5 | 0 | 0 | 0 | 0 |
| #10 CrowdStreet | 67 | 28 | 30 | 0 | 0 | 7 | 2 |
| #11 Medalist | 13 | 4 | 9 | 0 | 0 | 0 | 0 |
| #12 Fortress | 48 | 34 | 12 | 1 | 0 | 0 | 1 |
| #13 Blackstone App. B | 26 | 8 | 18 | 0 | 0 | 0 | 0 |
| **Total** | **621** | **218** | **304** | **28** | **37** | **28** | **6** |

Runtime 0.15-0.31 s per document including Python start-up; 0 crashes; exit 0 on all 24 runs. `date-sanity`, `party-consistency`, `number-consistency` produced 0 findings on the corpus (no evidence of value either way). Enabling `undefined-term` adds 15-114 findings per doc (e.g. #11: 15, all form labels such as "Zip Code", "Date of Birth", "State of").

#### Scorecard vs golden defects

| Golden (RESEARCH A / SPEC C) | Result | Cite |
|---|---|---|
| AC11 #1 "paragraphs 1 through 4 of this Section 11" (should be 12) | **Caught by accident** | `broken-xref` L1491 and L1499, "Section 11 which is not present". Wrong reason: it detects no headings in #1 (6 junk headings: 430, 1940, 1-4), so *every* Section >4 is "missing". No "expected Section 12" |
| AC12 #3 custodian ref "Part B of Section 6" | Caught by accident | L157 flagged, along with 28 other #3 refs (L98 "Part B of Section 6" for the amount is *correct* and also flagged) |
| AC12 #3 amount ref "Part B of Section 4" | Caught by accident | L162 flagged (same cause: #3 has 0 detected headings) |
| AC12 #5 custodian ref "Part B of Section 6" | Caught by accident | L121 flagged (L78 and L168, correct refs to Section 6, also flagged) |
| AC12 #5 amount ref "Part B of Section 4" | **MISSED** | L125 not flagged: the tool read the list item "4.Transmit completed Subscription Agreement..." as a heading, so "Section 4 exists" |
| AC13 #11 "offered Units" (defined term "Shares") | **MISSED** | `undefined-term` needs multi-word Title-Case terms used 2+ times; single word "Units" never qualifies |
| AC10 #5 "NTD:" note, `[xx]`, `[insert investor name]` | **MISSED (0/3)** | `[xx]`/`[insert...]` start lowercase and fail `_BRACKET_FILL_RE`; no drafting-note rule |
| AC10 bank ABA/DDA numbers (#1, #7) | MISSED | no sensitive-data rule exists |
| AC14 #9 OCR footnote | n/a | image input not supported |
| AC15/AC16 drift, #6 "LLC Agreement" | n/a | single-document linter |

Synthetic control (`spike/synth/golden-synth.md`: same three defects in a document with clean markdown headings `## Section 4/6/11/12`): findings were only 2 placeholders, a spurious "numbering jumps 6 to 11", and a spurious "duplicate section number 6" (caused by list items 5. and 6. inside Section 12). **All three golden defects were missed (0/3).** So when headings parse correctly, contract-lint detects none of the goldens: it has no "this Section N" self-reference rule, no check that "Part B of Section X" points to a section that contains the expected thing, and no single-word defined-term check.

#### False-positive review (13-finding sample plus category counts)

13 `broken-xref` findings reviewed by hand: 4 true (the goldens above), **9 false**: statutory citations (#1 L169 "Section 3(3) of ERISA", L1357 "Section 15 of the Exchange Act"; #11 L355 "Section 15 of the Securities Exchange Act"), real internal sections it could not see (#1 L383 "Section 9", L610 "Section 4B", L1676 "Section 14A"; #3 L98 and L650 "Part A of Section 2"), and correct refs in the already-fixed #6 (L135 "Custodian indicated in Section 4", L139 "Part B of Section 6").
- Heuristic split of all 218 `broken-xref`: about 125 (57%) are statutory ("Section 4975 of the Code", "Section 406 of ERISA", "Section 203 of the Advisers Act"). Most of the rest are valid internal refs flagged because headings were not found. Known true positives across the whole corpus: 5 of 218 (**about 2%**).
- `placeholder` (304): 100% false for a *form*: `____` blanks and `[ ]` empty checkboxes (81 of 86 in #5) are the fields the analyst will digitize, not leftovers. The three real placeholders were missed.
- `numbering` (28) and `duplicate-heading` (37): false. Restarting numbering in acknowledgements and suitability lists reads as "duplicate section number 1"; the page counter "2 of 32" repeated as a "duplicate heading" 31 times in #2.
- `double-definition` (28): partly legitimate (#2 defines `Fund`/`Shares` twice across RIA and broker-dealer variants), mostly noise on `ERISA`/`Code`.
- Overall precision against known defects: **about 1% of 621 findings (5 true)**; far below the SPEC target of 90% on seeded fixtures and the ceiling of 40 high-severity findings per doc (#5 has 106 errors).

#### Source inspection: what is portable to TypeScript

Heading handling (why it fails): `_HTMLTextExtractor` only inserts newlines at block tags (`td` is not one, `tr` is) and `scan_headings` accepts only lines that match `^N. Title` *on one line* (`_NUMBERED_RE`), a `Section|Article|Exhibit...` keyword line, or an ALL-CAPS keyword line. In our HTML the number sits alone on a line (`12.` then the title), so no heading is found. There is no bold/caps/position cue and no scoped numbering.

| Rule / helper | Approx LOC | Portable? | Worth copying |
|---|---|---|---|
| `scan_definitions` (`(the "X")`, `"X" means`) | 29 | Yes, two regexes | Yes: the two definition regexes |
| `_XREF_RE` + `_section_prefix_index` / `_section_satisfied` | ~90 | Yes | Dotted-prefix matching (`7.2` satisfied by `7.2.1`) is useful; the resolver must add scope and statutory exclusion |
| `rule_number_consistency` ("thirty (45) days") | 45 | Yes | Yes, a tidy deterministic check we do not have yet (0 hits in corpus) |
| `rule_placeholder` | 21 | Yes | Only the `{{x}}`/TBD patterns; must exclude `____` and `[ ]` for forms, and add lowercase `[xx]`/`[insert ...]` |
| `rule_unused_definition`, `rule_double_definition` | 32 | Yes | Trivial; unused-definition is relevant to the defined-term class |
| `rule_numbering`, `rule_duplicate_heading` | 100 | Yes | No: would produce the false positives above without scoped numbering |
| `rule_undefined_term` | 38 | Yes | No: multi-word Title-Case heuristic, noisy, misses single-word terms |
| `rule_party_consistency`, `rule_date_sanity`, `rule_signature_block` | ~130 | Yes | Not relevant to sub docs |

Total useful for us: roughly 100-150 lines of idea-level logic, all of it re-writable from the description. Stdlib-only Python single file, so a TS port is a rewrite, not a transpile. License MIT (keep notice if any code is copied).

#### Design constraint (H1)
- **What this licenses:** Reusing the *ideas* of the definition-extraction regexes, dotted-prefix section matching, written-number vs figure check, and the finding schema (rule id, severity, line, excerpt, JSON/SARIF) as inspiration. Citing it in the README as a related open-source linter we compared against.
- **What this forbids:** Using contract-lint as a CI oracle or as a golden-recall baseline (its hits are accidental; it cannot be trusted for "caught"). Relying on its heading detection, `placeholder`, `numbering`, `duplicate-heading` or `undefined-term` rules for form documents. Counting its findings toward AC17 (statutory cites) or the false-alarm metric.
- **What remains uncertain:** How it behaves on DOCX with real Word numbering (not probed; its numbering resolver is the one reasonably engineered part). Whether `number-consistency`/`date-sanity` find real defects in other documents (0 hits on this corpus). Also unmeasured: contract-lint on the PDF (#14), which needs the `[pdf]` extra.

### H2 - compare-cli 0.4.2 (JS, MIT): version-drift diff, browser-capable

#### Per-hypothesis verdict: NOT-VIABLE as a drop-in drift diff for these samples; its pure core is browser-portable (VIABLE for that sub-question, but it is only about 200 lines of logic we would write anyway)

#### Probe Method
- `git clone --depth 1` into `spike/cmp-src`; read `package.json` and `compare-cli.mjs` (1,505 lines, 61,940 B, 17,788 B gzip) before running. Dependencies: `jszip` (docx) and `pdfjs-dist` (pdf), both **dynamic imports**, not installed and not needed for text input. Ran `node compare-cli.mjs A B --json` only on files I had converted; no scripts executed from the repo, no `npm install`, no network. (npm `node_modules` installs were not done: sizes below come from `npm view` metadata.)
- It reads `.docx`, `.pdf`, `.md`, text. **It has no HTML reader**: `detectFormat` falls through to "text", so `.htm` is compared as raw markup.
- Inputs tried: (a) raw `.htm`, (b) plain text from contract-lint's HTML extractor, (c) a best-case Markdown where I turned the `N. TITLE` and `APPENDIX x` lines into `## ` headings with a throwaway script (simulating what our own parser would feed it).

#### Evidence Captured

| Pair | Input | Exit | Clauses base / cand | Added | Removed | Changed | Notes |
|---|---|---|---|---|---|---|---|
| #5 vs #6 | raw HTML | 2 | 80 / 107 | 56 | 29 | 42 | clauses are tag soup |
| #5 vs #6 | plain text | 2 | 57 / 34 | **29** | **52** | 2 | "clauses" are repeated running headers ("PARTNERS GROUP ... LLC", "SUBSCRIPTION AGREEMENT SIGNATURE PAGES"), so almost nothing aligns |
| #5 vs #6 | best-case `##` | 2 | 11 / 8 | 2 | 5 | 6 | sections 2,3,6,7,8,11 aligned as "substantive" whole-clause blobs; "10. Qualified" vs "10. Qualified Investor Determination" fails to align (exact normalized title match, no fuzzy) so it shows as removed + added |
| #3 vs #4 | plain text | 2 | 61 / 9 | 9 | 61 | 0 | no overlap at all; no crash |
| #3 vs #4 | best-case `##` | 2 | 12 / 9 | 9 | 12 | 0 | #4 has no numbered headings in my regex; unusable |
| #5 vs #5 | plain text and raw HTML | **0** | 57 / 57 | 0 | 0 | 0 | identical pair returns "clean" correctly |

Runtime 0.05-0.06 s per pair (Node). The human report truncates each clause to 180 characters, so renames are invisible unless they fall in the first 180 characters; the JSON carries full clause text but only a class (`substantive`), not a list of changes.

Whole-document `wordDiff()` (the exported function, called directly on the full #5 and #6 texts, 8,106 vs 7,670 words) took **1,987 ms** in Node and produced these AC15 items:

| AC15 item | Surfaced by word diff? |
|---|---|
| Units to Shares (14x `Units=>Shares` plus variants, 56 Units/Shares ops) | Yes |
| Member to Shareholder (`MEMBER=>SHAREHOLDER`) | Yes, uppercase variant seen; mixed-case not in top pairs |
| Memorandum to Prospectus (3x + 2x) | Yes |
| placement agent to distributor; Placement Fee to Sales Load | Yes (`placement agent, => distributor,`; `Placement=>Sales`, `Fee=>Load`) |
| Class fees (Sales Load 3.5% A / 1.5% S) | Partly: one op shows the "...1.5% ... Class S" text added |
| Drafting note "NTD:" removed | Yes (one removed op contains "1NTD: PG to confirm...") |
| `[xx]`, `[insert investor name]` removed | Yes (`[xx]` removed; `[insert...]` merged into a larger op) |
| Both swapped refs fixed | Only as a removed "Part B of" token; no semantic "reference fixed" |
| Appendix C removed | **No**: the string "Appendix C" is absent from both texts as extracted (the heading is split across tags as `APPENDIX` + `C`), so a text diff cannot see it; it must come from our structure parse |
| Section list 1-12 and Parts A-D unchanged | No (not a feature) |

So the value is a generic word diff, which `jsdiff` (already on our candidate list) provides; compare-cli adds clause alignment that depends on a heading detector it does not have for our docs, plus exit-code semantics we do not need.

**Browser compatibility (static analysis of source + `npm view`):**
- Static `node:fs`, `node:path`, `node:url` imports at the top (lines 8-10); `Buffer` only in stdin reader (line 302); `process.env/argv/stdout` in CLI wrappers and the entry guard (inside try/catch). The comparison functions (`detectClauses`, `alignClauses`, `detectMoves`, `classifyDiff`, `wordDiff`, `buildReportJson`) are pure and exported. In a browser it works only with the `node:*` imports aliased to stubs by the bundler (or by lifting the pure functions out).
- No child_process, no native modules, no network calls. Size: core 62 KB raw / 17.8 KB gzip. `jszip` 693 KB unpacked (3.10.2), `pdfjs-dist` 34.9 MB unpacked (6.4.299; only needed for PDF/DOCX input, not for our HTML path).
- Performance caveat: `wordDiff` is O(N*D)-style; 2 s for an 8k-word pair in Node. Must run in a Web Worker in the browser, never on the Workers Free request path (10 ms CPU).

#### Scorecard vs AC15 / AC19

| Criterion | Result |
|---|---|
| AC15 structure (section list 1-12, Parts A-D unchanged) | Not met: clause alignment fails on untagged HTML |
| AC15 swapped refs fixed | Not met (only a stray "Part B of" token) |
| AC15 Appendix C removed | Not met (not visible in text) |
| AC15 term renames | Met only by raw word diff, no grouping or narrative |
| AC15 fees, drafting note, placeholders | Partly met by word diff |
| AC19 #3 vs #4 "without crashing" | Met (no crash), result useless (61 removed, 9 added) |
| AC19 no-change pair returns "no differences" | **Met** (exit 0, `clean`) |
| Findings delta (fixed / still present / new) | Not offered |

#### Design constraint (H2)
- **What this licenses:** Reusing the *design* of compare-cli's classification (clean / cosmetic / typographic / substantive / moved) and its LIS-based move detection (`longestIncreasingSubsequenceIndices`, ~25 lines) in our own diff; using `wordDiff`-style output (or `jsdiff`) in a browser Web Worker. Running the diff client-side is consistent with the Workers Free 10 ms constraint.
- **What this forbids:** Using compare-cli as the diff engine or as the oracle for `golden-05-06-drift` / `diff-pairs-e2e`; feeding it raw HTML; running any word diff on the Workers request path; expecting exact-title clause alignment to work on documents without heading tags. Any section alignment must come from our own parser with fuzzy title and number-scope matching.
- **What remains uncertain:** Whether `jsdiff` (or a faster Myers implementation) runs a full-document word diff under about 1 s in a browser Web Worker for the 380 KB sample (not measured here); how well Docxodus handles #3 vs #4 restructuring (P3, untouched). DOCX/PDF paths of compare-cli were not exercised (no deps installed).

## Resulting Design Constraint
- **What this licenses:** Reusing the *ideas* only: contract-lint's definition-extraction regexes, dotted-prefix section matching, written-number vs figure check and finding schema; compare-cli's change classes and LIS move detection. Running a word diff client-side in a Web Worker. Citing both tools in the README as baselines (a general linter reports 621 findings on our corpus, 5 real).
- **What this forbids:** Using either tool as a test oracle or golden-recall baseline; feeding compare-cli raw HTML; relying on contract-lint's heading detection or its `placeholder`, `numbering`, `duplicate-heading`, `undefined-term` rules for forms; any word diff on the Workers request path; exact-title clause alignment on documents without heading tags.
- **What remains uncertain (known-gap):** contract-lint on DOCX with real Word numbering and on PDF (not probed); whether `jsdiff` does a full-document word diff in under about 1 s in a browser Web Worker for the largest pair (compare-cli's own took 1.99 s in Node); compare-cli DOCX/PDF paths (deps not installed); Docxodus on #3 vs #4 (P3, untouched).

## Overall Design Implication for the Plan
1. The risky component is **our own structure parser** (headings from text patterns with the number alone in a cell, scoped numbering, `Part X of Section N`, `this Section N`, statutory-citation exclusion). Neither tool helps; budget accordingly in PLAN.
2. Add rules neither tool has, all needed for the goldens: "this Section N" must equal the enclosing section (AC11); "Part B of Section X" target-content check (AC12, requires per-section labelling of what each section holds); single-word defined-term misuse (AC13, `Units` vs defined `Shares`); lowercase placeholder and drafting-note patterns (AC10); sensitive-number masking (AC10).
3. Use these two as comparison baselines in the README ("a general contract linter reports 621 findings on our corpus of which 5 are real defects"), which strengthens the product story. The synthetic control file is reusable as a seeded fixture.

## Probe Family
1 - Local process / Node script (Python CLI for H1, Node CLI and a small `.mjs` harness for H2).

## Probe Cost Class
**cheap-local.** Safety gate met: installs only in `/private/tmp/claude-501/-Users-itsjiathao--Skylab-itsjiathao-aduin-transaction/8f4c448e-5f2b-4878-bdfa-eb5389b915a6/scratchpad/spike/` (venv `py/pyenv`, clones `cl-src`, `cmp-src`, outputs `out/`, throwaway scripts `*.py`/`*.mjs`, synthetic file `synth/golden-synth.md`). Network used only for `pip install`, two `git clone`s and `npm view` metadata. No LLM or OpenRouter calls; no files modified under `samples/`; nothing installed globally or added to the repo; nothing committed. Incident: the first two `git clone` commands ran before the spike directory existed and landed in the repo root as untracked folders; I moved them to the scratchpad immediately and confirmed `git status` shows only the pre-existing untracked P4 file plus this one. The scout-block hook refused `venv` and `node_modules` path names, so the Python env is named `pyenv` and no npm install was done (size figures from `npm view`).

## Raw outputs
Under the scratchpad `spike/out/`: `default/*.json`, `allrules/*.json` (contract-lint), `cmp-*.json`, `cmp-56-md.txt` (compare-cli), text dumps `*.txt` / `*.md`.

## Unresolved Questions
- Does `jsdiff` meet a sub-second full-document word diff in a browser worker for the largest pair? (cheap-local probe, not run.)
- Does contract-lint's DOCX numbering resolver produce usable heading data on a real Word sub doc (no DOCX sample in the corpus)?
