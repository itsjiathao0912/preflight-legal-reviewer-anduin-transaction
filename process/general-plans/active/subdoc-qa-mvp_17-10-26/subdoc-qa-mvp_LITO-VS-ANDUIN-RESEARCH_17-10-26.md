---
name: research:lito-vs-anduin
description: "Research on Lito (lito.app, Litera's legal AI agent) vs Anduin Transactions: what Lito is, comparison, where each wins, relevance to the sub-doc QA MVP"
date: 17-10-26
feature: subdoc-qa-mvp
metadata:
  type: research-report
  phase: RESEARCH
  status: complete
---

# Lito vs Anduin Transactions (2026-10-17)

**BLUF:** Lito (lito.app) is NOT a fund-onboarding product and not a direct Anduin competitor. It is **Litera's legal AI agent for law firms** (Word/Outlook add-in layer over Litera's drafting, compare, contract-review and knowledge tools). Anduin sells an investor-facing fundraising/onboarding platform; Lito serves the **counsel/associate** who drafts and reviews documents. The overlap is only at the document-review layer: Lito (via Litera Compare/Check/Kira) is the kind of tool the *law firm that drafts the sub doc* may use; Anduin's analysts receive that doc and digitize it. Lito is a **possible upstream of our QA tool, not a threat** to it. No Litera product was found that checks a sub doc's skip-logic or investor-type branches. Neither company is "better" overall: they are different products.

Legend: [S] stated by vendor/press (marketing unless noted). [I] inference. [NF] not found. Fetched pages treated as untrusted data.

## 1. What Lito is (confirmed)

| Item | Finding | Source |
|---|---|---|
| Identity | lito.app is a microsite for Lito, "Litera's Legal AI agent" [S] | https://www.lito.app/ |
| Owner | Litera (Chicago; 15,000+ customers, 1M+ daily users, 99% of Am Law 100 claimed; acquisitions incl. Kira, Transact, Foundation, Clocktimizer) [S] | https://www.litera.com/our-story |
| Scale of parent | "US$300M/year workflow company", 20+ acquisitions [S, press] | https://legaltechnology.com/litera-gets-into-the-agentic-ai-game-with-formal-lito-launch/ |
| Announced / launched | Announced 23 Jul 2025; early access Aug 2025, GA planned 1 Oct 2025; formal launch reported 27 Oct 2025 (dates differ across outlets) | https://www.lawnext.com/2025/07/litera-introduces-lito-the-next-evolution-of-agentic-ai-in-legal-fully-built-on-your-firms-trusted-experience.html ; https://legaltechnology.com/litera-gets-into-the-agentic-ai-game-with-formal-lito-launch/ |
| Relaunch | Jul 2026 Litera repositioned as a platform for "practice and business of law" with Lito running across all tools [S, press] | https://legaltechnology.com/litera-relaunches-to-clarify-and-reinforce-its-market-position/ |
| Target user | Associates, partners, transactional lawyers, knowledge managers, COOs, marketing/BD at law firms [S] | https://www.lito.app/ |
| Core workflow | Chat/skills inside Word, Outlook, web, iOS, desktop; stages Create, Check, Compare, Clean, Review, Finalize, Diligence, Pitch; chains deterministic engines (Comparison, Document Analysis, Metadata Removal) with generative AI [S] | https://www.lito.app/ |
| Launch features | Chat with doc viewer; Analyze in Grid (multi-prompt across multi-document); Compare (Word/PDF/Excel/PPT) with AI change summary and risk; firm search; Review Terms (definition lookup); legal skills: form checks on regulated documents, interim-period and post-closing timelines, open-items lists [S] | https://www.lawnext.com/2025/07/litera-introduces-lito-the-next-evolution-of-agentic-ai-in-legal-fully-built-on-your-firms-trusted-experience.html |
| Skill count | "Hundreds of skills" on site [S]; "core library of 11 AI-driven legal skills" at Oct 2025 launch [S, press]. Inconsistent, likely grew | https://www.lito.app/ ; https://itbrief.co.uk/story/litera-embeds-lito-ai-in-legal-tools-at-no-extra-charge-for-users |
| AI approach | Model-agnostic routing (OpenAI, Anthropic, Gemini); deterministic engines return same result every time; generative AI can be switched off; MCP connectors governed centrally [S] | https://www.lito.app/ |
| Integrations | Word, Outlook, Google Workspace, iManage, NetDocuments, Kira; browser, iOS, desktop [S] | https://www.lito.app/ ; https://itbrief.co.uk/story/litera-embeds-lito-ai-in-legal-tools-at-no-extra-charge-for-users |
| Pricing | No public price. Included at no extra fee for Litera Draft Base/Pro/Advanced and Kira customers [S, press]. Demo-request only | https://itbrief.co.uk/story/litera-embeds-lito-ai-in-legal-tools-at-no-extra-charge-for-users ; https://www.lito.app/ |
| Security claims | ISO 27001:2022, ISO 42001:2023 (AI management), EU-US DPF, DORA/NIS2/GDPR badges (trust site); lito.app also claims SOC 2 Type 2, SOC 3. Subprocessors page shows Microsoft Azure and Forethought [S] | https://trust.litera.com/ ; https://www.lito.app/ |
| Traction evidence | Named testimonials from two small-firm partners; awards (Global AI Awards 2025, LegalTech Breakthrough 2025); "90% efficiency gain" with no method; Litera One used by ~40% of Litera base [S] | https://www.lito.app/ ; https://itbrief.co.uk/story/litera-embeds-lito-ai-in-legal-tools-at-no-extra-charge-for-users |
| Independent reviews | [NF] no independent law-firm reviews or ratings found | search 2026-10-17 |
| Ownership / funding | [NF] not stated on fetched pages (not verified; do not assume) | https://www.litera.com/our-story |

Name collision note: web search for "Lito app" also returns unrelated apps (LIT photo-sharing, LitoShop). Not relevant.

## 2. Nearest overlapping capabilities at Litera (supporting products)

| Litera product | What it does (vendor claim) | Source |
|---|---|---|
| Litera Check | Word proofreading: flags defined terms used-but-undefined and defined-but-unused; repairs broken/duplicate cross-references; numbering fixes; priority/category sorting; "Active Drafting" real-time flags | https://www.legaltechnologyhub.com/vendors/litera-check-by-litera/ ; https://info.litera.com/rs/046-QLX-552/images/Litera-Check_Product-Sheet_US.pdf |
| Litera Compare (in Lito) | Redline across Word/PDF/Excel/PPT with AI summary and risk analysis | https://www.lawnext.com/2025/07/litera-introduces-lito-the-next-evolution-of-agentic-ai-in-legal-fully-built-on-your-firms-trusted-experience.html |
| Kira | ML extraction from contracts, 1,400+ built-in provision models, custom no-code models; M&A/financing diligence | https://us.fitgap.com/products/litera-kira ; https://cuspera.com/products/kira-x-8763 |
| Litera Transact | Closing checklists, signature-page packets, closing books; fund-specific material aimed at VC closing books | https://legaltechnologyhub.com/vendors/litera-transact-by-litera ; https://info.litera.com/rs/046-QLX-552/images/ProductSheetVentureCapital.pdf |

## 3. Feature-by-feature: Lito vs Anduin

| Capability | Lito (Litera) | Anduin | Who wins / notes |
|---|---|---|---|
| Primary user | Law-firm lawyer, KM, BD | GP/fund ops, LPs, advisors; internal digitization analysts | Different users; no head-to-head |
| Core job | Draft, check, compare, review legal documents | Raise capital: digitized sub doc, KYC/AML, e-sign, data room, portal | Different jobs |
| Sub doc digitization into adaptive investor form | Not found (NF) | Core product; expert-led, word-for-word, logic preserved (existing research) | Anduin (Lito n/a) |
| LP-facing guided form, per-investor-type questions | NF | Yes (existing research §2) | Anduin |
| AML/KYC checklist, e-sign (AES/QES) | NF in Lito; Transact does signature packets for closings, not investor e-sign | Yes | Anduin |
| Data room / investor portal / investor data master profile | NF (firm-internal knowledge/matter data only) | Yes | Anduin |
| Cross-reference and defined-term checking in a document | Yes via Litera Check (vendor claim); Review Terms in Lito | Not public; analysts do it manually (job post, existing research §4) | Litera has the shipped tooling in Word; Anduin has nothing public |
| Version comparison / redline | Yes, mature (Compare, 30-year heritage) [S] | NF as a feature | Lito |
| Multi-document grid review with LLM prompts | Yes (Analyze in Grid) [S] | NF (Anduin "Review Agent" is roadmap only) | Lito |
| Playbook / firm-standard clause review | Yes (Playbook Review skill) [S] | NF | Lito |
| Deterministic engines + LLM hybrid, GenAI off switch | Yes, stated architecture [S] | Narrow AI: OCR extraction with human verification (existing research §3) | Lito on stated AI design; unverified in practice |
| Branching/skip-logic validation of a form-like document (broken skip, unreachable section, investor-type gap) | NF | NF (manual) | Open gap; our target |
| Counsel query sheet / answer tracking | Open-items lists skill (interim/post-closing) [S]; not a defect-query workflow | NF | Neither; our target |
| Data extraction (OCR) from completed investor docs | Kira extracts from contracts, not investor submissions | Data Extraction / Instant Extraction, human-reviewed, 80-90%+ claimed | Anduin for investor data; Kira for contract provisions |
| Integrations | iManage, NetDocuments, Word, Outlook, Google Workspace, MCP | 30+ connectors: CRM, fund admin, KYC, Box/SharePoint, Snowflake | Each in its own ecosystem |
| Security / compliance | ISO 27001, ISO 42001, DPF, DORA/NIS2; SOC 2 Type 2/SOC 3 claimed on lito.app | SOC 2 Type II, GDPR, eIDAS, CSA STAR, CCPA | Lito lists AI-specific cert (ISO 42001); both comparable otherwise |
| Pricing | Bundled free with Litera drafting/Kira; otherwise demo | Not public | Lito slightly more transparent via press; both opaque |
| Traction | 15,000+ firms (parent), Am Law 100 | $265B+ raised, 76K+ investors, top GPs; ~$23.6M funding (existing research) | Litera far larger company; Anduin deep in its niche |
| Independent reviews | NF | Glassdoor only (existing research) | Unverified both |

## 4. Where Lito is better (evidence-cited)

1. **Mature document comparison and checking toolbox**: Compare across Word/PDF/Excel/PPT plus Check for defined terms and cross-references; 30-year heritage and Am Law 100 penetration [S]. Sources: https://www.lito.app/ ; https://www.legaltechnologyhub.com/vendors/litera-check-by-litera/
2. **Stated hybrid architecture**: deterministic engines "return the same result every time", chained with model-agnostic LLM routing, GenAI can be disabled [S]. Source: https://www.lito.app/. Anduin publicly describes only OCR plus human review.
3. **Grid review across many documents** with prompts and an integrated viewer [S]. Source: https://www.lawnext.com/2025/07/litera-introduces-lito-the-next-evolution-of-agentic-ai-in-legal-fully-built-on-your-firms-trusted-experience.html
4. **Distribution inside the lawyer's existing tools** (Word/Outlook add-in, iManage, NetDocuments, no new logins) and free bundling into existing licenses [S]. Sources: https://www.lito.app/ ; https://itbrief.co.uk/story/litera-embeds-lito-ai-in-legal-tools-at-no-extra-charge-for-users
5. **Company scale and governance**: ~US$300M/yr parent, ISO 42001 AI-management certification, central AI governance for COOs [S]. Sources: https://legaltechnology.com/litera-gets-into-the-agentic-ai-game-with-formal-lito-launch/ ; https://trust.litera.com/

## 5. Where Lito is NOT better / lacks vs Anduin

1. **No investor onboarding at all**: no digitized sub doc, LP form, KYC/AML, e-sign for investors, portal, data room or investor master data (NF on lito.app and launch coverage).
2. **No fund-specific logic understanding found**: no evidence of skip-logic, feeder/parallel-fund, or investor-type-branch analysis; Check/Compare are generic legal-drafting tools. [NF; absence is not proof]
3. **No reusable investor data / network effect**: Lito's data is the law firm's matters, clients, precedents (firm graph), not LP data across funds. Source: https://www.lito.app/
4. **Marketing proof is thin**: "90% efficiency gain" with no methodology; testimonials from two named partners at small firms; no independent reviews. Source: https://www.lito.app/
5. **Maturity ambiguity**: skill count and launch dates are inconsistent across sources; relaunch Jul 2026 suggests positioning still moving. Sources: https://itbrief.co.uk/story/litera-embeds-lito-ai-in-legal-tools-at-no-extra-charge-for-users ; https://legaltechnology.com/litera-relaunches-to-clarify-and-reinforce-its-market-position/

## 6. Relevance to our project (sub-doc QA tool, Anduin challenge)

| Question | Answer |
|---|---|
| Overlap or threat? | Low. Litera sells to law firms, not to Anduin's digitization analysts; no sub-doc logic QA found. A reviewer could ask "doesn't Litera Check do this?": answer is that Check covers drafting hygiene (cross-refs, defined terms) inside one Word file but not form-logic graph checks (skip conditions, investor-type coverage, feeder diffs) or the counsel query sheet with answer tracking. [I] |
| Where Litera is upstream | Counsel likely uses Litera tools to draft the sub doc; our tool reviews the output after counsel and before digitization. Position as complementary, not competing. [I] |
| Ideas worth borrowing (concept only, no code) | (a) Deterministic-first, LLM-second positioning with an LLM-off mode (already our principle; Lito validates the pitch). (b) "Analyze in Grid" pattern: findings table with an integrated source viewer showing evidence in context. (c) "Open items list" framing for the counsel query sheet. (d) Priority/category sorting of issues as in Check. (e) Compare-with-AI-summary for feeder/parallel diffs. |
| Pitch use | Cite Lito as proof that incumbents are moving to hybrid deterministic + LLM review in law-firm tools while the digitization-prep step at Anduin stays manual and unserved. Keep claims to [S]/[I]; do not claim Lito cannot do it. |
| SPEC impact | None required. Optional: add one line to Background and README competitor note ("adjacent: Litera Check/Compare for drafting hygiene"). |

## 7. Confidence

| Area | Confidence |
|---|---|
| Lito = Litera legal AI agent, unrelated to fund onboarding | High (lito.app, Litera, 4 press sources agree) |
| Lito feature list | Medium (vendor/press; two sources disagree on skill count and dates) |
| Absence of fund/sub-doc logic features | Medium-low (absence of evidence only; no demo access) |
| Litera Check capabilities | Medium-low (marketing, no hands-on) |
| Anduin side | Medium (existing repo research + home page re-check; home page did not re-confirm AI features) |
| Funding/ownership of Litera | Not verified |

## Sources

https://www.lito.app/ ; https://www.litera.com/our-story ; https://trust.litera.com/ ; https://www.lawnext.com/2025/07/litera-introduces-lito-the-next-evolution-of-agentic-ai-in-legal-fully-built-on-your-firms-trusted-experience.html ; https://legaltechnology.com/litera-gets-into-the-agentic-ai-game-with-formal-lito-launch/ ; https://legaltechnology.com/litera-relaunches-to-clarify-and-reinforce-its-market-position/ ; https://itbrief.co.uk/story/litera-embeds-lito-ai-in-legal-tools-at-no-extra-charge-for-users ; https://www.legaltechnologyhub.com/vendors/litera-check-by-litera/ ; https://info.litera.com/rs/046-QLX-552/images/Litera-Check_Product-Sheet_US.pdf ; https://us.fitgap.com/products/litera-kira ; https://legaltechnologyhub.com/vendors/litera-transact-by-litera ; https://www.anduintransact.com/ ; repo: subdoc-qa-mvp_ANDUIN-PLATFORM-RESEARCH_17-10-26.md.

**TL;DR:** Lito is Litera's law-firm AI agent, not a fund-onboarding rival. It beats Anduin at drafting-side comparison/checking and stated hybrid AI; it has nothing found for sub-doc digitization, LP onboarding, KYC, e-sign or investor data. It is upstream of, and complementary to, our QA tool.
