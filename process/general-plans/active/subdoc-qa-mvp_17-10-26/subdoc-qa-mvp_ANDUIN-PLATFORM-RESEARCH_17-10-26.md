---
name: research:anduin-platform
description: "Research on Anduin Transactions: products, features, AI, customers, partners, business model, strengths/gaps, and what the Legal Reviewer challenge expects; with SPEC delta recommendations"
date: 17-10-26
feature: subdoc-qa-mvp
metadata:
  type: research-report
  phase: RESEARCH
  status: complete
---

# Anduin Platform Research (2026-10-17)

**BLUF:** Anduin sells private-markets fundraising and investor-onboarding software plus a human services layer. Its edge is word-for-word, logic-preserving digitization of subscription documents and reusable investor data. Its AI is real but narrow (OCR extraction + human verification, data matching, document routing), and all of it is investor-side. No public Anduin feature reviews the SOURCE sub doc before digitization; that step is manual (Digitization Service Analysts in Ho Chi Minh City). This is exactly the gap our tool targets.

Legend: [S] stated by Anduin or a cited source. [I] inference. Pages fetched 2026-10-17; fetched content treated as untrusted data.

## 1. Company

- Founded 2014; Los Altos, CA; large product/engineering presence in Ho Chi Minh City. [S]
- People: co-founders Alin Bui and Binh Nguyen (CTO), backed by Joe Lonsdale / 8VC; CEO Eliot Hodges since 2020. [S]
- Funding: ~$23.6M total; Series B $15.6M (Jul 2023, 8VC lead). No later round found. [S]
- Headcount: 140+ (2024 job post). [S]
- Claimed scale (time series, definitions shift): 2024 job post $205B raised / 1,180 funds / 64K investors; Apr 2026 PR $255B+ / 1,305 funds / 74K+; current site $265B+ / 76K+ investors / $7T client AUM / 400K+ users. [S]

## 2. Products (9, three pillars)

### A. Fundraising and onboarding (core revenue)

1. **Fund Subscription** — workflow:
   1. Counsel supplies sub doc; Anduin analysts digitize it into an adaptive form with internal tools ("expert-led digitization", word-for-word, all conditional logic kept).
   2. GP + counsel review and approve.
   3. GP invites LPs (manual, spreadsheet, CRM; pre-fill up to 90% from past forms / IDM).
   4. LP fills a guided form showing only questions relevant to investor type and jurisdiction, with tooltips and live validation.
   5. Auto AML/KYC checklist per type/jurisdiction.
   6. Anduin e-sign (AES/QES, multi-party).
   7. GP review on Master Dashboard with field-level comments.
   8. Export to CRM, fund admin, IDM.

   Also: parallel funds, multiple closes, feeder structures (Delaware/Cayman/Lux), SPVs, side letters, 10 GP permission switches, multi-currency, custom export templates, "Omnibus" form merging several feeder docs into one (Neuberger Berman case). [S]
2. **Data Room** — permissioned rooms, page-level engagement analytics, audit log, versioning, one-click move from room to subscription. [S]
3. **Advisor Advantage** — siloed workspaces for RIAs/wealth advisors onboarding their clients; GP sees consolidated view. Implicitly competes with iCapital/CAIS. [S/I]

### B. Investor engagement

4. **Investor Portal** — branded portal, document distribution, capital activity, transfers, voting, wire updates; "AI-powered routing" of bulk uploads (K-1s, capital calls) to the right investors. [S]
5. **Engagement Hub** — segment-specific landing pages, newsletters, events. [S]

### C. Data and connectivity

6. **Investor Data Management (IDM)** — one master profile per investor across funds; Onboarding Review compares new submissions to the profile and flags mismatches; AI expiry tracking of IDs/tax forms. [S]
7. **Integration Hub** (GA Mar 2025) — 30+ no-code connectors: Salesforce, DealCloud, Affinity, Dynamics; FIS Investran, Citco, SS&C, IQ-EQ; Box, SharePoint, SFTP; WorldCheck, ACA ComplianceAlpha; Snowflake, Databricks; Slack, Teams; plus REST API. [S]
8. **Data Extraction Service / Instant Extraction** — OCR of completed offline investor submissions; see §3. [S]
9. **E-Sign** — standalone and embedded. [S]

Platform: SOC 2 Type II (one older page still says Type 1), GDPR, eIDAS, CSA STAR, CCPA; white-label; "white-glove" service with Forward Deployed Engineers. [S]

## 3. AI at Anduin

| Feature | What | Human in loop | Claim |
|---|---|---|---|
| Data Extraction Service (Nov 2024) | OCR of offline subs, tax forms | Yes, ops team reviews every extraction | 90%+ precision |
| Instant Extraction (Apr 2026) | Auto OCR on upload, confidence flags, side-by-side review, REST/Excel export | Yes, flagged fields | 80%+ out of the box; single session vs 2-3 days |
| IDM expiry tracking | Reads expiry dates on IDs/tax forms | Alerts only | up to 70% less review time, 98% fewer errors (no method) |
| IDM onboarding review | Submission vs master profile diff | Human decides | same |
| Portal AI routing | Classifies doc type/fund/entity, routes | not stated | none |
| Similarity pre-fill | Picks most similar past form | GP chooses | up to 90% pre-filled |

Roadmap/marketing only: **"Review Agent"** and **"MCPs"** (2026 roadmap labels, undescribed); GP Con 2026 roadmap mentions "AI-assisted review" and "data room intelligence"; CEO: "catching errors before they happen, compressing manual review from days to minutes". No model/LLM vendor named. [S]

[I] AI = OCR + rule matching + human review, applied to investor data. Nothing public touches the source sub doc or its form logic.

## 4. Sub-doc digitization today (our target step)

- Done by Digitization Service Analysts (HCMC). Job post duties: digitize PDF sub docs into web forms with internal tools; analyze documents to determine form logic; talk to customers; implement logic in a "simple programming language"; coordinate engineers; test before delivery; "handle pressure during high-demand periods". [S]
- Customer side: GP and counsel review the digitized form ("a simple review process for us and our legal counsel", Accolade). Anduin "resident legal experts" advised on structuring questions (Neuberger). [S]
- No published SLA ("timelines vary"); Antler launched a fund within two weeks. [S]
- No public mention of pre-digitization QA tooling, defect taxonomy, counsel query sheets or automated logic checks. [S by absence]

## 5. Customers, partners, business model

- Case studies: Neuberger Berman (~3,000 LPs, $5.4B, Delaware/Cayman/Lux omnibus form), Accolade Partners ($1B+), Antler (multiple funds in parallel, onboarding time ~1/3), NXSTEP (95% LP adoption, 10 vs 30-45 min per LP). Homepage logos: Blackstone, KKR, Carlyle, Bain Capital, EQT, CVC, Sequoia, PGIM. [S]
- Partners: law firms (Latham & Watkins, Simpson Thacher, Paul Weiss, Debevoise, Ropes & Gray, Proskauer, Akin Gump) — likely a distribution channel [I]; fund admins / KYC (IQ-EQ, Gen II, TMF, Ultimus, Standish, ACA Group partnership Jan 2026, Fenergo); tech (FIS DDX, Intapp DealCloud, Affinity, Allvue, Salesforce); consultancies (Cutter, Holland Mountain). [S]
- Pricing: not public (/pricing 404, "Book a demo"); no G2/Capterra reviews. [S]
- [I] Revenue likely per fund/closing + per module + services (digitization, extraction, integration); GP pays, LPs free. A tech-enabled service: scaling needs headcount.

## 6. Strengths and gaps

Strengths: subscription fidelity; end-to-end lifecycle on one data set; reusable investor data (network effect); complex structures (feeders, parallel funds, side letters, QES); top-tier law-firm and admin ecosystem; white-glove enterprise service; wealth channel.

Gaps [mostly I]:

1. Digitization is a manual, headcount-bound bottleneck with peak-season pressure and no public QA tooling.
2. AI depth trails competitors' messaging (Juniper Square "JunieAI"); Anduin's "Review Agent" is unannounced.
3. Thin funding vs consolidating competitors (iCapital acquired Passthrough, Feb 2026; Juniper Square acquired Tenor Digital, Oct 2025).
4. No native fund admin / accounting.
5. Opacity: no pricing, no reviews, shifting metrics.
6. Coopetition with channel partners (Allvue, Intapp).
7. High-touch service model is costly to scale.

## 7. What the "Legal Reviewer" challenge expects [I]

- The challenge text describes Anduin's own digitization team: "has to do its own review ... before their work begins"; defects "need to be detected and confirmed with external legal counsel; otherwise the team will waste cycles".
- Pain: rework loops when defects surface after the form is built; slow counsel round-trips (US counsel, VN analysts, time zones); quality depends on individual experience; peak-season load.
- Expected solution: a pre-flight QA tool for the analyst (not a lawyer redlining tool) covering the full defect lifecycle: detect → analyst confirm → counsel question → track answer → unblock digitization. Trust over volume: evidence-cited, low false positives; structural/logic understanding (cross-refs, skip logic, investor-type branches, feeder differences); LLM only for judgment.
- Breakthrough: shift defect discovery left (day 1, before building); one batched counsel round instead of many; standard checklist independent of analyst seniority; the extracted logic graph doubles as a blueprint for building the form (review → automation; aligns with Anduin's "Review Agent" direction).
- Trap: a generic "ChatGPT for contracts" summarizer.

## 8. SPEC delta recommendations

Current SPEC (`subdoc-qa-mvp_SPEC_17-10-26.md`) already matches the core expectation. Proposed small updates:

| # | Proposal | Why (evidence) | Suggested priority |
|---|---|---|---|
| D1 | Refresh Background with Anduin facts (§1-§4 here): scale numbers, AI is investor-side only, "Review Agent" roadmap, manual analyst workflow, competitors' AI moves | Positioning for README/slides; current Background predates this research | Must (doc only) |
| D2 | Investor-type path view: for each investor type (individual, entity, trust, IRA, etc.) show which sections/questions apply and flag types with no path or missing required items | Anduin forms show only questions relevant to investor type/jurisdiction; analysts must derive these branches; "investor-type gaps" is in project summary but not an explicit AC | Should (new US + AC, deterministic) |
| D3 | Feeder / parallel comparison framing in the diff: label common vs differing clauses across sibling documents to support Anduin's "Omnibus" single-form practice | Neuberger case: Delaware/Cayman/Lux merged into one form | Could (reframe US8/AC19; samples lack a true feeder pair, so keep #3-#6 as test set) |
| D4 | Export the logic map (sections, branches, references, defined terms) as JSON/DOCX "form logic outline" for the analyst; explicitly NOT generating the form | Analysts implement logic in an internal scripting tool; review→automation story | Could (does not conflict with Out-of-Scope "generating the digitized form") |
| D5 | Add success metrics: defects found before build per doc; counsel questions batched into one sheet (target: one round); time from upload to exportable counsel sheet | Challenge stresses wasted cycles and counsel confirmation | Should |
| D6 | Update `process/context/product-domain.md` scale figures (2024 → 2026) and competitor facts (iCapital-Passthrough confirmed) | Context accuracy | Must (context) |

Note: INNOVATE (`subdoc-qa-mvp_INNOVATE_17-10-26.md`) already exists. D2-D4 may need an INNOVATE/PLAN check for impact; D1, D5, D6 are documentation-only.

## Sources (selection)

anduintransact.com (home, /about, /security, product pages /anduin-fund-subscription, /anduin-data-room, /anduin-advisor-advantage, /anduin-investor-portal, /anduin-engagement-hub, /anduin-investor-data-management, /anduin-integration-hub, /anduin-data-extraction, /partners, /case-study/{neuberger-berman,accolade,antler,nxstep}, blog posts on pre-fill, SOC 2, GP Con 2026, "building what private markets run on"); PR Newswire releases (Nov 2024 Data Extraction, Mar 2025 Integration Hub, Apr 2026 Instant Extraction); 8VC job board (Digitization Service Analyst); CB Insights; Law360 / Financial IT (Series B); Fintech Global / ACA (Jan 2026); iCapital newsroom and Business Wire (Passthrough, Feb 2026); Glassdoor (4.3/5, 30 reviews).
