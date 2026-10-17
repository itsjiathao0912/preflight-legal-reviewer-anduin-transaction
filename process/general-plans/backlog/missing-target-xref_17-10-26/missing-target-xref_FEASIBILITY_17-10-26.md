---
slug: missing-target-xref
date: 2026-10-17
verdict: INCONCLUSIVE
originating-phase: innovate
---

# Feasibility probe: missing-target cross-reference detector (backlog P6-1)

TL;DR: A plain filter over `g.structure.references` (F-A, F-B, F-C) is refuted: on the 12 real samples it flags 13 to 49 refs and every one is a false positive. A heavily guarded filter (F-D) has zero false positives on all 15 docs and catches all 6 seeded true-missing refs, but those 6 are already caught by `broken-conditional`, and the 12 real samples contain no true-missing plain reference at all. So precision is achievable, value and recall are unproven. Verdict INCONCLUSIVE, with a safe design constraint below.

## Hypothesis

On the 12 HTML samples (01-08, 10-13) plus `fixtures/memory/fund-{I,II,Y}.html`, a filter over `g.structure.references` can flag true missing targets (plain "Section N" / "Part X of Section N" whose target section does not exist) with near-zero false positives.

## Mechanism Under Test

`extractReferences` in `packages/core/src/structure/references.ts`. For plain `SECTION_RE` refs it yields `internal|unresolved` (number within range, no accepted section) or `external|out-of-range` (number greater than the active scope or doc maximum, lines 257-259). Question: do either of these two outcomes mean "the target is really missing"?

## Probe Family

1 - Local process / Node script (run through the repo's `tsx`; imports `htmlToLines`, `analyzeHtml`, `buildDocGraph`, `runDeterministic` straight from `packages/core/src`).

## Probe Cost Class

cheap-local. Safety gate met: no network, no container, no provider call, no tracked file modified. Temp scripts were created under `scripts/src/_probe-*.ts` and deleted; copies sit in the session scratchpad only.

## Method

1. For each of 15 docs (12 samples, 3 fund fixtures), run the full engine and record every `form` in (`section`, `part_of_section`) ref that is (a) `internal|unresolved` excluding `rule=decimal-section`, or (b) `external|out-of-range`. `this_section` refs are excluded by construction (own detector).
2. For each row capture: ref text, ±120 chars of block text, raw-line heading lookup (`^\s*(Section )?N[.):]\s*\S`), whether the block already holds a `broken-conditional` finding, whether an external-document word sits near the ref, scope titles and accepted section numbers. Then assign a human verdict by reading the raw lines (sub-letter headings, "14." line, etc.).
3. Evaluate four filters, with TP/FP per doc, and overlap with `broken-conditional` findings by block id.
4. Mutation recall test (because the corpus has no true-missing ref): in docs 01, 03-08, 10-13, rewrite up to 6 resolved plain refs per doc to (a) `docMax+3` (out-of-range) or (b) the first numbering gap, rebuild the graph with `buildDocGraph`, and check whether each filter flags the mutated ref. 51 mutations total (45 out-of-range, 6 gap).

Accepted section numbers per doc (from `g.structure.scopes`):

| Doc | Scopes (accepted sections) |
|---|---|
| 01 | Document: 1-13 |
| 02 | Document: none (structurer accepted zero sections; two "1.." lists and a doubled form confuse it) |
| 03 | Signature Pages: 1-12; all other scopes none |
| 04 | Document 1-3; Appendix A 1,3,4,5,6,7; others none |
| 05 | Signature Pages: 1-12; others none |
| 06 | Signature Pages: 1-12; others none |
| 07 | Document: 1-7 |
| 08 | Document: 1-9 |
| 10 | "Part I: Instructions" scope: 2 only; others none |
| 11 | Document: 1-3 |
| 12 | Document: 1,2,3,5,7,8,9,10,11 (4 and 6 missing although "4." and "6." heading lines exist); Terms and Conditions none |
| 13 | Appendix B scope: 1-9; Document none |
| fund-I / II / Y | Document: 1-3 |

## Census table

Candidate rows: 61 over 15 docs (docs 03, 04, 05, 06, 07, 08, 11 produce 0 rows). Doc 02 has 36 rows because the sample text contains the whole application twice (two copies); distinct refs are grouped below. "Head" = heading-like raw line exists for that number. "BC" = block already flagged by `broken-conditional`. "Ext" = names an external document.

| Doc | Ref | Class | Context (shortened) | Head | BC | Ext | Verdict |
|---|---|---|---|---|---|---|---|
| 01 | Sections 311 | oor | "...designated ... under Sections 311 or 312 of the U.S.A. Patriot Act" | no | no | Act | EXTERNAL |
| 01 | Section 4B (x3) | unres | "Additional documentation required in Section 4B" | "4." yes; sub-heading "B. Entity Information" at raw line 126 | no | no | HEADING-MISS (sub-letter of an existing section) |
| 01 | Section 2O | unres | "defined in Section 2O2(a)(22) of the Adviser Act" (source typo: letter O for 0) | no | no | Act | EXTERNAL (also a source typo, not a missing target) |
| 01 | Section 14A / 14B | oor | "14. FINRA-Registered Representatives must complete Section 14A ... 14B" | "14." line yes; "A." / "B." sub-headings yes | no | no | HEADING-MISS (section 14 not accepted; docMax is 13) |
| 02 | Sections 311 (x2 copies) | oor | Patriot Act | no | no | Act | EXTERNAL |
| 02 | Section 2, 3, 4, 5, 7, 9, 11, 13; Sections 11 and 12 (30 rows over both copies) | oor | e.g. "see account minimum in Section 2", "provided in Section 4" | yes for every one ("2. Share Class", "4. Subscriber Information", ... "11. Investor Suitability") | no | no | HEADING-MISS (structurer accepted no sections; docMax is 0) |
| 02 | Section 4C (x6), Sections 4A (x2) | oor | "Additional documentation required in Section 4C" | "4." yes; "A." "B." "C." sub-headings yes | no | no | HEADING-MISS (sub-letter) |
| 10 | Section 13 | oor | "Files reports pursuant to Section 13 or 15(d) of the Securities Exchange Act" | no | no | Act | EXTERNAL (statutory rule missed because "or 15(d)" sits between number and "of the ... Act") |
| 10 | Sections 1956 | oor | "18 U.S.C. Sections 1956 and 1957" | no | no | U.S.C. | EXTERNAL (USC_RE does not match the plural "Sections") |
| 12 | Section 4 (x3) | unres | "See Section 4 ('Contact Information & Interested Parties')" | "4. Contact Information & Interested Parties" yes (not accepted by structurer) | no | no | HEADING-MISS |
| 12 | Section 3A (x2) | unres | "If different than provided in Section 3A ('Subscriber Information')" | "3." and "A. Individual Investors" yes | no | no | HEADING-MISS (sub-letter) |
| 12 | Section 544 | oor | "Code Section 544, as modified by Code Section 856(h)(1)(B)" | no | no | Code | EXTERNAL |
| 13 | Section 3C, Sections 3A, Section 3A (x2) | unres | "Not Available for Louisiana Residents. See Section 3C." | "3." and "A." / "B." / "C." sub-headings yes | no | no | HEADING-MISS (sub-letter) |
| fund-I | Section 7 | oor | "If the Subscriber is a custodial account, complete Section 7." | no (only 1-3) | yes | no | TRUE-MISSING (seeded) |
| fund-I | Section 4 | oor | "If the Subscriber is an IRA, complete Section 4." | no | yes | no | TRUE-MISSING (seeded) |
| fund-II | Section 7, Section 5 | oor | same two "complete Section N" instructions | no | yes | no | TRUE-MISSING (seeded) |
| fund-Y | Section 7, Section 5 | oor | same | no | yes | no | TRUE-MISSING (seeded) |

Census totals (61 rows): TRUE-MISSING 6 (all fund fixtures, all inside conditionals that `broken-conditional` already reports); HEADING-MISS 48 (doc 01: 5, doc 02: 34, doc 12: 5, doc 13: 4); EXTERNAL 7 (doc 01: 311 and 2O2, doc 02: 311 x2, doc 10: 2, doc 12: 544); OTHER 0.

Real-sample rows: 55 (doc 01: 7, doc 02: 36, doc 10: 2, doc 12: 6, doc 13: 4; docs 03-08 and 11: 0), split 48 HEADING-MISS and 7 EXTERNAL. Real-corpus TRUE-MISSING count: 0.

Note on docs 03-06: those multi-scope docs resolve most refs through the "exactly one other scope holds section N" fallback in `resolveScope`, so they never become candidates. That is a possible false-negative surface (not probed beyond the mutation test).

## Filter comparison

Filters (all use `g.structure.references`, `form` in section|part_of_section, `rule != decimal-section`):

- F-A: `internal|unresolved` only.
- F-B: F-A plus `external|out-of-range` when the doc has a single numbering scope and no external-document word ("of/under/in the ... Act|Code|ERISA|Agreement|Memorandum|Prospectus|LPA|Regulation|Rule") within 70 chars after, or "Code|U.S.C.|C.F.R.|Rule|Exhibit|Annex|Schedule" within 25 chars before.
- F-C: F-A but suppressed when a heading-like raw line for the integer part of N exists (`^\s*(Section )?N[.):]\s*\S`).
- F-D (added by me, in-sample tuned from the census): both classes, minus external qualifier (as F-B), minus heading-exists, minus sub-letter refs ("4B"), and only when some scope has at least 3 accepted sections (structurer-failure guard).

Flagged refs per doc on real docs (all flagged refs on real docs are false positives; "TP" on real docs = 0 everywhere):

| Doc | Candidates | F-A | F-B | F-C | F-D |
|---|---|---|---|---|---|
| 01 | 7 | 4 FP | 6 FP | 0 | 0 |
| 02 | 36 | 0 | 34 FP | 0 | 0 |
| 03-06, 07, 08, 11 | 0 each | 0 | 0 | 0 | 0 |
| 10 | 2 | 0 | 0 | 0 | 0 |
| 12 | 6 | 5 FP | 5 FP | 0 | 0 |
| 13 | 4 | 4 FP | 4 FP | 0 | 0 |
| Real total | 55 | 13 FP / 0 TP | 49 FP / 0 TP | 0 / 0 | 0 / 0 |
| fund-I, II, Y | 2 each | 0 TP (seeds are out-of-range, F-A misses all 6) | 6 TP, 0 FP | 0 TP | 6 TP, 0 FP |

Overlap with `broken-conditional` (by block id): every fund-fixture hit (6 of 6, for F-B and F-D) lies in a block that already has a `broken-conditional` finding. Net-new findings from any filter: 0 true, 13 / 49 false for F-A / F-B, 0 for F-D. `ref-label-coherence` findings never touched these blocks.

Mutation recall test (synthetic true-missing refs; 51 mutations):

| Mutation | n | F-A | F-B | F-C | F-D |
|---|---|---|---|---|---|
| out-of-range (docMax+3) | 45 | 0 | 9 | 0 | 22 (49%) |
| gap number | 6 (all doc 12) | 6 | 6 | 0 | 0 |

Reading the mutation result:
- F-A can never detect an out-of-range cite, which is the realistic renumbering case (a section deleted from the end), so it is useless alone.
- F-B only works on single-scope docs (07, 08 fully; 01 not because the doc's numbered investor-status lists run to 22 and the heading guard sees "16."), and loses everything in multi-scope docs.
- F-D recall misses: (1) numbered list items count as "heading exists" (doc 01 list goes to 22), (2) the external-qualifier regex treats the in-doc qualifier "of the Subscription Agreement Signature Pages / of Appendix A" (docs 03-06) as external. Both are fixable in principle but each fix widens the false-positive surface.
- The 6 "gap" mutations in doc 12 are not real defects: they cite "Section 4", which exists as a heading the structurer missed. F-A/F-B flag them, which shows the exact false-positive mechanism seen in the census, not a recall win.

## Verdict

INCONCLUSIVE.

- Refuted: the hypothesis as written (a plain filter over `g.structure.references`, i.e. F-A / F-B / F-C). Zero true positives and 13 to 49 false positives on the 12 real samples; the dominant false-positive causes are structurer misses (docs 02, 12, 01 section 14: heading line exists but the section was not accepted), sub-letter refs ("Section 4B", "3A", "4C" meaning Part B of Section 4), and statutory or external cites the S-rules missed (Patriot Act, "Section 13 or 15(d) ... Exchange Act", "18 U.S.C. Sections 1956", "Code Section 544", "Section 2O2").
- Supported but unproven: F-D reaches 0 false positives on all 15 docs and 6 of 6 seeded true positives. But (a) its guards were derived from this same corpus (in-sample), (b) the 12 real samples contain zero true-missing plain refs so real-world recall and value cannot be measured, (c) all 6 seeded hits duplicate `broken-conditional`, and (d) mutation recall is about 49%.

Why not VIABLE: no real-document true positive exists to show the detector finds anything new. Why not NOT-VIABLE: a conservative guarded variant is demonstrably silent on the current corpus.

## Resulting Design Constraint

- What this licenses: a conservative missing-target detector that fires only when ALL of these hold: ref is `section` or `part_of_section`, not decimal, no statutory or external qualifier nearby; number is a plain integer (no sub-letter); no heading-like line `N.` / `N)` / "Section N" for that integer exists anywhere in the doc text (list items count); at least one scope has 3 or more accepted sections (structurer-failure guard, which silences doc 02); the finding is deduped by block against `broken-conditional`. Run on `internal|unresolved` and `external|out-of-range` alike, since renumbered-away targets are usually out-of-range. Keep severity low to medium, confidence modest, and treat it as an extra "needs a look" signal, never critical.
- What this forbids: do not ship F-A, F-B or F-C, and do not equate `external|out-of-range` or `internal|unresolved` with "missing"; do not flag sub-letter refs ("4B", "3A", "14A"); do not flag any doc where the structurer accepted fewer than 3 sections; do not claim a recall number from the real corpus (there are no true positives to count); do not count it as new coverage for the seeded fund fixtures (they are already covered by `broken-conditional`).
- What remains uncertain (known-gap): real-world value (corpus has 0 true-missing plain refs, so the detector may stay silent forever on real forms); out-of-sample precision of F-D (guards were tuned on these 15 docs, and docs 03-06 hide possible false negatives through the single-other-scope resolve fallback); recall on renumbered forms (about 49% on mutation, lowered by list-item and in-doc "Agreement" guards); whether the missed statutory forms ("Section 13 or 15(d) of the ... Act", "18 U.S.C. Sections N", "Section 2O2") should be fixed in `statutory.ts` first (a smaller, separate hardening that removes false positives from any xref detector); the structurer misses on doc 02 and doc 12 (sections 4 and 6) are separate bugs that this detector would otherwise mask or amplify; no seeded fixture exists for a plain missing xref (a new one is needed before building).

Prior Feasibility line for re-spawn: Does a filter over g.structure.references flag true missing targets with near-zero FPs on the 15-doc corpus? — verdict: INCONCLUSIVE — licenses: a guarded detector (integer-only, no heading-like line for N in the doc, no external or statutory qualifier, at least 3 accepted sections, dedupe by block against broken-conditional) at low or medium severity — forbids: plain unresolved or out-of-range filters (F-A, F-B, F-C), sub-letter refs, and any claim of real-corpus recall — uncertain: real-corpus value (0 true positives exist), out-of-sample precision, recall (about 49% by mutation), and statutory-rule misses to fix first.

## Unresolved questions

- Does the user want the statutory-miss fixes (`Section 13 or 15(d) of the ... Act`, `18 U.S.C. Sections N and M`, `Section 2O2`) tracked as a separate item, since they remove false positives from several detectors?
- Should doc 02 (zero accepted sections) and doc 12 (sections 4 and 6 not accepted) structurer misses be opened as backlog bugs?
- Is a synthetic seeded fixture for a plain missing xref acceptable as the only proof set, given the real corpus has none?
