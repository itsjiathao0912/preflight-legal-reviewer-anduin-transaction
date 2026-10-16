# Reusable open-source repos (researched 2026-10-17)

Metadata (stars, last push, license) from the GitHub API on 2026-10-17. READMEs read for key repos; no code run.
Rule: **MIT / BSD / Apache-2.0 → OK to copy (keep notices). AGPL or no LICENSE → reference only.**

## Top picks to start from

| # | Repo | License | Use for |
|---|---|---|---|
| 1 | [JSv4/Docxodus](https://github.com/JSv4/Docxodus) | MIT | Structural DOCX compare with JSON edit script + stable block anchors → version-drift diff and clause citations. **Spike first:** .NET WASM, large bundle, Workers support unverified (may need browser or container). Its wrapper `docxodus-service` is AGPL, so don't use it. |
| 2 | [govind-collab/defined-terms-checker](https://github.com/govind-collab/defined-terms-checker) | MIT | Pure-TS defined-term rules: used but undefined, unused, duplicate, used before definition, lowercase misuse, plus false-positive filters. Brand new and 0 stars, so port it with our own tests. |
| 3 | [Open-Source-Legal/OpenContracts](https://github.com/Open-Source-Legal/OpenContracts) `frontend/` | MIT | PDF viewer + annotation highlight + reference-graph UI patterns; annotation schema. Backend (Django) too heavy, so skip it. |
| 4 | [unjs/unpdf](https://github.com/unjs/unpdf) + [mammoth.js](https://github.com/mwilliamson/mammoth.js) + [react-pdf](https://github.com/wojtekmaj/react-pdf) + [react-pdf-highlighter-extended](https://github.com/DanielArnould/react-pdf-highlighter-extended) | MIT / BSD-2 / MIT / MIT | Edge-friendly parse and view stack with highlights. mammoth drops legal numbering, so it needs a custom pass. |
| 5 | [evolsb/claude-legal-skill](https://github.com/evolsb/claude-legal-skill) | MIT | Prompt text for the LLM judgment step. |

Also useful: [kpdecker/jsdiff](https://github.com/kpdecker/jsdiff) (BSD-3) for word/sentence diff once clauses are aligned; [dolanmiu/docx](https://github.com/dolanmiu/docx) (MIT) to export the counsel query sheet as .docx; [docxjs](https://github.com/VolodymyrBaydalka/docxjs) (Apache-2.0) for DOCX rendering; [PAKTON](https://github.com/petrosrapto/PAKTON) (Apache-2.0) for agent design reference; [eyecite](https://github.com/freelawproject/eyecite) (BSD-2) for its extract-then-resolve reference design.

**Gap:** nothing off-the-shelf checks broken section cross-references, circular skips, unreachable sections, or conditional-instruction logic. We build those ourselves on a section-tree parser.

## Reference only (do NOT copy code)

| Repo | Why |
|---|---|
| LexPredict/lexpredict-lexnlp | AGPL-3.0. Use only as a pattern spec for definition and section-reference extractors. |
| sboghossian/clausebox | AGPL-3.0. `legalCoherence` linter idea. |
| superdoc/docx-editor, docxodus-service | AGPL-3.0 |
| zubair-trabzada/ai-legal-claude, CUAD code, HazyResearch/legalbench, DraftLint/docket | No LICENSE file, so all rights reserved |
| ContraVis (arXiv 2609.27014) | Paper only, no repo. The idea: paragraph graph with cross-reference edges, and the LLM sees linked-clause neighborhoods instead of the whole document. |
| stanfordnlp/contract-nli | CC-BY-4.0 dataset. Eval or few-shot data only, with attribution. |

## Other notes
- Repos that don't exist: a ContraVis code repo, `aaronkjohnson/lexnlp`, `ICLRandD/contract-nli`.
- Low fit / skip: Blackstone (UK case law, spaCy 2), lawglance (Indian law RAG), google/diff-match-patch (archived).
- Python heavyweights only if scanned PDFs matter: docling (MIT); marker (code Apache-2.0, model-weights license not verified).
