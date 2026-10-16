---
name: product-domain
description: Anduin challenge brief, subscription-document domain knowledge, defect taxonomy, competitors, and product decisions for the sub-doc QA tool
keywords: anduin, subscription document, sub doc, digitization, defect taxonomy, counsel query, investor type, accredited investor, qualified purchaser, feeder, version drift, competitors, ocr
metadata:
  node_type: context
  type: domain
  read_when: any product, SPEC, INNOVATE, PLAN, UX, prompt-design, or test-fixture work on the QA tool
---

# Product and Domain Context

## The challenge (Anduin Transactions, verbatim intent)

A company that digitizes complex legal agreements must review them before work begins. Typos,
missing references, contradictions, and term ambiguities must be detected and confirmed with
external legal counsel; otherwise the team wastes cycles digitizing flawed inputs.
"Build a tool to handle this review process." Interpretation is up to us.

## Who the user is

**Digitization Service Analyst at Anduin.** Anduin's Fund Subscription product turns a fund's own
subscription documents (from GP law firms) into guided, validated online forms that keep every
clause and conditional structure. The analyst works out the form logic, so the analyst's real question is:
**"Can this document be turned into unambiguous form logic, and what must counsel confirm first?"**
The tool is built for this analyst, not for the drafting lawyer.
Scale context: 1,180+ funds, 64,000+ investors, $205B+ raised.

## Defect taxonomy (what the tool must find)

| Class | Example | Primary detector |
|---|---|---|
| Broken cross-reference | "see Section 11" but the content is Section 12 (real case: sample #1 Franklin Lexington) | deterministic graph check |
| Broken conditional instruction | "If you checked 3(b), skip to Section 7" but 3(b) doesn't exist or 7 is the wrong destination | deterministic graph check |
| Unreachable / circular flow | a section no path reaches; skip loops | deterministic graph check |
| Option gaps / overlaps | investor-type checkboxes not mutually exclusive, or an investor type with no valid path; "Check One Box Only" violated by the structure | deterministic plus LLM |
| Defined-term issues | used but undefined, defined twice, unused, inconsistent capitalization | deterministic |
| Inconsistent footnote/requirement | e.g. Corporation/Trust carry footnote 2 (attach resolution) but Partnership/LLC doesn't (sample #9 p.1) | deterministic pattern plus LLM confirm |
| Logic contradiction | one section requires Annex B, another exempts that investor type | LLM on graph-linked clauses |
| Ambiguity changing form behavior | a sentence readable two ways, so two different branching logics | LLM |
| Meaning-changing typo | "shall" vs "shall not", wrong section letter | LLM plus deterministic heuristics |
| Version drift | feeder / parallel / jurisdiction / year versions where definitions or required sections quietly differ | structural diff |

Every finding needs: severity (blocks digitization or not), evidence (cited clause text + location),
detector (rule id or LLM model), confidence, and for counsel items the possible interpretations.

## Product decisions (2026-10-17, from the user)

- **MVP = all five parts:** (1) parse → logic graph, (2) deterministic checks, (3) LLM judgment,
  (4) version diff against a related/prior doc, (5) counsel query sheet: each confirmed issue
  becomes a short answerable question with clause citation and interpretations; track answers;
  block digitization until critical items are cleared. **Plus OCR** for scanned documents.
- **Inputs:** SEC-style HTML, text PDF, DOCX, scanned PDF/images (OCR).
- **Form factor:** web app, English UI, polished, with a full test suite.
- **Deliverables:** live demo (Cloudflare), README explaining the reasoning, short demo video, slides.
- **LLM policy:** free OpenRouter models first (including free vision models for OCR), auto-fallback to
  cheap paid models, total spend cap ~$10. Cache every LLM/OCR result. Must also run in
  **no-LLM mode** (deterministic only) so the demo never hard-fails.
- **Pitch line:** "Litera-style proofreading plus form-logic validation, built for the digitization
  analyst rather than the drafting lawyer."

## Competitive landscape (why this is differentiated)

- Generic legal proofreaders (Word add-ins for lawyers): Litera Check / Contract Companion,
  Definely Proof, Spellbook. They catch cross-refs, undefined terms, inconsistent phrases. They don't model form logic.
- Sub-doc platforms: Anduin, Passthrough (iCapital), Juniper Square (manual doc review + JunieAI
  on investor PDFs). Their review tools check **investor submissions after the fact**, not the source document's logic.
- Gap: nobody validates a sub doc's conditional logic *before* digitization and turns problems
  into a counsel query workflow. Steps 4–5 (precedent diff + counsel sheet) are the differentiators.

## Reference material

- Sample corpus (14 real docs + 22 OCR scan pages): `samples/sub-docs/README.md`
- Reusable open-source code and licenses: `docs/research/reusable-repos.md`
  (copy only MIT/BSD/Apache; AGPL/no-license = reference only)
- Architecture idea to borrow: ContraVis paper. Paragraph graph with cross-reference edges; the LLM sees
  linked-clause neighborhoods, not the whole document.
