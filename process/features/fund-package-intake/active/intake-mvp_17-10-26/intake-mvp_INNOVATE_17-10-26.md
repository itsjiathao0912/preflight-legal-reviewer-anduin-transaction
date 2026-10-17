---
name: report:intake-mvp-innovate
description: "INNOVATE Decision Summary for fund package intake (U1-U9): package as a pure core module with a two-stage browser pipeline; 4-phase program; orchestrator rulings T1-T4 and the PLAN strategy deviation (LOCKED)"
date: 17-10-26
feature: fund-package-intake
metadata:
  node_type: memory
  type: report
  phase: INNOVATE
  status: locked
---

# INNOVATE Decision Summary — Fund Package Intake (vc-innovate-agent, 17-10-26)

Status: DONE_WITH_CONCERNS (PHASE_COMPLETE: INNOVATE). vc-predict verdict: CAUTION (no STOP).

## Code findings that shape the design
1. `undefined-term` detector (packages/core/src/detectors/undefined-term.ts) only fires on offering nouns (Units, Interests, Shares...) — the #11 "Units" case. `defined-term-issues` has no generic "used but undefined" rule. So intake value = "defined in LPA"/"unverified" LISTING in the Package lens + coverage count + suppression of the offering-noun finding when the package defines the term. Do NOT add a generic undefined-term error (would break base goldens). P1 first task: baseline the undefined-term goldens.
2. `CARVE_OUT_RE` (not defined herein ... meanings given ... in the <Name>) already captures the A6 "defined elsewhere" sentence and target name; exported; reuse/extend.
3. Seams: `engine.runDeterministic(g, settings, list)`, `EngineSettings`; web worker has `prepare`, LRU of graphs, render-first `analyze`.
4. D1 `document` already stores firm, fund, content_hash, version_label; no role/type; not needed for MVP.
5. Upload modal = `OpenDocumentDialog` (single input; testids upload-input, open-submit, firm-combobox, fund-input, version-input) -> `openUpload` -> `useReview.openDocument`.
6. #9 scans (22 JPEG pages) exist only as manifest-backed samples; 22 pages > 12-file limit.

## Chosen approach
"Package as a pure core module, with a two-stage browser pipeline."
- Stage 1 light read: each file -> `lines -> structure()` only (no graph, no detectors) -> titles, headings, definitions.
- Analyst confirms types/roles.
- Stage 2: to-digitize doc goes through normal `analyze` with package definitions injected via `EngineSettings`; result also carries package facts (references, used terms).
- Pure `buildPackageAnalysis` -> coverage, requests, Package-lens data.

## Decisions
1. Delivery: 4-phase program (umbrella + 4 phase plans, inner loop skips SPEC).
   - P1 Core package engine + fixtures: packages/core/src/package/*, policy data, defined-term consumer (post-filter), barrel append, goldens/property tests, scripts/src/fixtures/build-package.ts, fixtures/package/**, committed real-doc facts. No deps.
   - P2 Web data plane: worker methods (readPackageDoc, packageDefs setting, packageFacts in result), engine/{types,client,engine.worker}.ts, Dexie v2, state/package.ts store, Upload modal multi-file + confirmation table + limits + demo-package samples, firm tagging, unit tests + upload e2e. Depends P1.
   - P3 Web surfaces, 3 disjoint tracks: 3a Package lens (features/package/PackageLens + tab in StructureScreen); 3b coverage line in FindingsScreen header + GateButton popover + features/gate; 3c Questions GP group + request DOCX (CounselScreen, new exportRequestDocx.ts). Depends P2 store shape.
   - P4 Closeout + deploy: full preview e2e regression, a11y/perf/privacy re-run (AC29/30/40/58), no-llm/determinism re-run, build, redeploy Worker assets, live smoke, context docs. Depends P1-P3.
2. Data model in `packages/core/src/package/` (outside contracts/; frozen v1 untouched): types.ts (zod strict), detect.ts, references.ts, definitions.ts, terms.ts, resolve.ts, coverage.ts, policy.ts, request.ts, baseline.ts, analyze.ts, config.ts, index.ts; one append line in src/index.ts.
   - PackageDocType: sub_agreement | lpa | ppm | tax_form | side_letter | other (prospectus = ppm).
   - PackageDocRole: to_digitize | reference | baseline.
   - PackageDocument: id from contentHash, type, role, confidence (high|low), reason, confirmed, suggestionSource (rule|analyst|ai), needsOcr, format, titleLines.
   - ExternalReference: quote, location {blockIndex,start,end,sectionPath,page?}, targetLabel, targetFamily, resolution (resolved|not_in_package|unclear), resolvedDocId?, confirmedByAnalyst.
   - CrossDocDefinition: term, docId, quote, location. CoverageGroup: id, label, status (full|partial|blocked), missingTypes[], reasons[]. DocumentRequest: label, quote, count, firstDocId. PackageAnalysis: all above, sorted.
   - Determinism: inputs sorted by (contentHash, name); fixed output order; no timestamps/ids/timings inside analysis (computedAt/exportedAt live in IndexedDB row). Own snapshot fixtures/package/schema.v1.json (deep-equal). Limits 12 files/40 MB/10 MB in package/config.ts (not the frozen `limits`).
3. Type/role detection, rules only. Signals: first-page title/heading lines (3 pts) — "subscription agreement/booklet", "(amended and restated) limited partnership agreement", "limited liability company agreement", "private placement memorandum", "prospectus", "offering memorandum", "form W-8BEN-E/W-9", "side letter"; file name tokens (2 pts) lpa, ppm, sub, w-8, side-letter, annex; body phrases in first ~1500 chars (1 pt). high = top score >=3 AND margin >=2, else low. Reasons are fixed templates. Role defaults: sub_agreement -> to_digitize, others -> reference; baseline never auto-assigned (filename hints prior/previous/baseline propose it at low). Two sub agreements in one package -> role low for both, held until analyst picks. No LLM task ships: seam only (suggestionSource 'ai' + precedence: confirmed analyst > high rule > low rule > AI suggestion), AC-I7 covered by injected fake suggester unit test + intake-no-llm-run. Fallback: only if P1 real-doc golden shows a rule miss, add optional doc-type-suggest@1 task (<=6 free calls).
4. References: pattern families on to-digitize blocks — (1) definitional (reuse/extend CARVE_OUT_RE): "as defined in the X", "have the meanings given in the X"; (2) governing: "pursuant to / in accordance with / subject to the terms of the X"; (3) named docs: Limited Partnership/Partnership/LP/LLC/Operating/Fund Agreement, Memorandum/Prospectus/PPM/Offering Memorandum, Side Letter, Form W-8BEN(-E)/W-9, Annex/Schedule/Exhibit/Appendix <label>. Exclusions: self-reference ("this Subscription Agreement"), statutory names (Act/Code/Rule — S detector owns), labelled internal sections (Annex/Schedule/Appendix external only if doc has no heading/scope with that label). Synonym table as data DOC_SYNONYMS. Resolution: resolved (exactly one doc of family), not_in_package (zero), unclear (2+ or weak) -> analyst confirms, persisted as confirmedTargets. Quotes verbatim substring of block text, <=240 chars, verified before masking; failing quote dropped and counted in `dropped`. Mask at render/export edges. AC-I13 = fast-check property test.
5. Cross-doc terms: do NOT edit undefined-term detector. Pure post-filter `applyPackageDefinitions(findings, defs)` inside the web worker before analyze returns (no flicker; render-first holds). Package ref doc defines the term -> offering-noun finding suppressed, shown "defined in LPA" + quote (AC-I14). Nobody defines -> unchanged (AC-I15, base AC13 #11). No LPA -> terms covered by A6 sentence listed `unverified` (AC-I16), counted in coverage; carve-out finding kept as today. Unverified list = capitalized terms used mid-sentence >=2 times, not locally defined, minus stoplist; produces no findings. No new detector/issue class: "13 detectors / 15 issue classes" stays true, plus wording "plus package-level checks (references, cross-document terms, coverage)". Definitions from reference docs via extractDefinedTerms + bounded "X means" scan (L8).
6. Coverage groups as data: Structure and flow, Internal cross-references, Defined terms, External references, Investor paths; each has requires/recommends types. blocked if a required type missing; partial if a recommended type missing, a required/recommended doc needsOcr, any reference not_in_package/unclear, or terms unverified; else full. DEFAULT_PACKAGE_POLICY (zod-validated const) with missingDocGate {sub_agreement:'block', lpa:'warn', ppm:'warn', side_letter:'warn', tax_form:'warn'}. Pure `packageGateReasons(analysis, policy)` merged by the web view-model; core computeGate + its 2400-cell matrix untouched. AC-I19 tested with modified policy row. Coverage computed synchronously on main thread from analyze output; coverage line/Package lens appear after findings render; nothing awaits session/Turnstile/memory.
7. Persistence: browser only, no D1 migration 0006. Dexie version(2) adds `packages` table (id, firmId, firmName, fund, version, createdAt + per-doc type/role/confidence/reason/confirmed/hash/needsOcr + confirmedTargets); `documents` rows gain optional packageId. Light-read facts cached in existing parsedModels keyed by content hash. purgeExpired covers packages (24 h). Variance reads baseline role from the package store; pure `eligibleBaselines(packageFirmId, candidates)` in package/baseline.ts returns same-firm only (AC-I9). apps/worker: no code change; P4 redeploys static assets.
8. UI: Upload modal input `multiple` + drop zone, existing testids kept. Exactly one high-confidence sub agreement auto-runs (no table) so existing single-file e2e unchanged. 2+ files or any low row -> confirmation table (file, type, role, confidence, reason, editable type/role, baseline checkbox, Run checks disabled until low rows confirmed). Limits plain copy; refusal stores nothing. Samples list gains one-click demo-package entries (Hartwell & Crane, NGI #5+#6, #9/#13 where bundled). Structure: "Package" lens tab only when a package exists; web-local `LensId | 'package'` (core LensId untouched). Shared CoverageLine component in Findings header + gate popover, only for package uploads. Questions: "For the GP" group, one item per missing document with referencing quote and "referenced N times"; new exportRequestDocx.ts sibling of buildCounselDocx (lazy docx import, docxFilename-style naming, maskAndClamp); counsel export unchanged. Requests are not Findings (no taxonomy/fingerprint/memory/gate-finding change).
9. Fixtures: bundled, built by scripts/src/fixtures/build-package.ts into fixtures/package/hartwell/: Fund III sub (seeded refs to LPA, Annex F, Side Letter, W-8BEN-E + A6 sentence), LPA definitions excerpt (DOCX via make-docx), Fund II sub (baseline). Also NGI #5 + #6 (refs "LLC Agreement", "Memorandum"/"Prospectus" -> not_in_package), #13 Appendix B, #9 scans as sample-backed member (precomputed OCR). Local-only opt-in PACKAGE_LOCAL=1: _full-prospectus #9/#13 and ILPA PDF (never bundled/committed). Script `package:facts-extract` (local) writes committed short facts fixtures/package/real-facts/*.json; golden runs on facts in CI; opt-in local test checks facts still match real files. #9 page set only via sample members; reference-role scans flagged needs OCR (OCR quota 6 pages/day); to-digitize scan uses existing OCR (AC-I3).
10. Tests (0 live model calls; budget 6 in reserve): I1-I3 Playwright preview (intake-multi-upload, intake-limits-refusal, intake-firm-tagging, intake-scan-ocr-or-flag OCR stubbed); I4/I5 core unit+golden on real-facts + synthetic; I6/I8/I9 Playwright (low-confidence gate, correction persists after reload, baseline same firm two firms same text) + eligibleBaselines unit; I7 core unit fake suggester + intake-no-llm-run e2e; I10-I12 core golden/matrix; I13 fast-check property; I14-I16 Playwright + core unit; I17-I19 core matrix + Playwright; I20 Playwright export DOCX parsed with mammoth (Annex F + Side Letter present, no duplicates). Determinism: run twice + shuffled input order, byte-compare. Re-run base AC8, AC25, AC29, AC30, AC40, AC58. Package schema deep-equal snapshot; contracts snapshot must stay unchanged.

## Rejected alternatives
| Alternative | Why rejected |
|---|---|
| Multi-document Doc/DocGraph | Touches core model used by 13 detectors, diff, outline, goldens |
| New cross-doc detector + issue class | Changes counts, taxonomy, memory fingerprints; post-filter enough |
| Missing docs as Findings via computeGate | New class/fingerprint/memory semantics; breaks gate matrix |
| D1 migration 0006 | Nothing reads it; adds worker/CPU/privacy surface for no AC |
| LLM type fallback task now | Rules target 100%; task = registry + contract snapshot + recordings for a "may" AC |
| One COMPLEX plan | 3+ dependent phases, 3 packages, trust-boundary class |
| Always show confirmation table | Breaks existing single-file e2e; extra click |

## Risks (vc-predict)
| Risk | Sev | Mitigation |
|---|---|---|
| Wrong high-confidence type | High | Conservative threshold; multi-sub roles always low; golden on real facts |
| Cross-firm baseline leak | High | eligibleBaselines same-firm filter; e2e two firms identical text; null-firm packages -> within-package candidates only |
| Coverage line breaks header-sensitive specs | Med | Only for package uploads; keep testids; full serial preview e2e in P4 |
| "False errors today" premise wrong | Med | P1 baselines undefined-term goldens; ACs re-scoped to listing + suppression |
| AC-I5 100% ambiguous for two-sub roles | Med | Defined in plan (see orchestrator rulings) |
| Reference recall <100% on real cases | Med | Seeded matrix in P1; AI seam only if rules miss |
| Browser memory/time 12 files/40 MB | Med | Sequential light reads, up-front refusal, cache facts; AC29 perf spec |
| Dexie v2 upgrade | Low | Additive store; migration test |
| Suppressed finding moves AI inputHash for package runs | Low | Samples unaffected; no prompt/task change |
| Reference-role scans not OCR'd | Low | needs OCR flag, coverage partial, documented |

## Constraints accepted
Frozen contracts v1 + snapshot unmodified; no new Finding class, detector, taxonomy value, memory label, LLM task, prompt change, D1 migration or Worker route; barrel append-only; detectors/registry.ts untouched; computeGate untouched; parsing in browser worker; render-first; single high-confidence sub auto-runs; samples never show package UI; 24 h purge; variance interface = usePackage store (setRole, baseline docs) + pure eligibleBaselines.

## Strategy recommendations (vc-agent-strategy-compare)
Signal score 6/7. PLAN: agent team recommended (4 planners). EXECUTE: P1 sequential opus; P2 sequential opus; P3 agent team of 3 opus with disjoint blast radii; P4 sequential + vc-tester EVL.

## Spec tensions -> ORCHESTRATOR RULINGS (autopilot, 17-10-26)
- T1 (AC-I5): "100%" = type correct on every demo file; no wrong high-confidence value of type or role; ambiguous roles (two sub agreements) flagged low and resolved by the analyst. Record as an interpretation in the umbrella plan.
- T2 (AC-I7): seam only, no live LLM task; fake-suggester unit test + no-LLM e2e prove the AC. Live calls: 0 planned.
- T3 (AC-I20): "once per package" = one request item per distinct missing target label (deduped), one DOCX per export click.
- T4: corrections persist across reload within the 24 h browser window (L7); documented limitation.
- PLAN strategy deviation: TeamCreate machinery is not available in this session, so PLAN runs as ONE sonnet vc-plan-agent writing the umbrella + all 4 phase plans in one pass (single author keeps the seams — barrel, usePackage store shape, EngineApi additions — consistent; this is the reason the team was recommended). P3 EXECUTE will use parallel opus subagents with strictly disjoint file sets and a frozen store contract from P2 instead of an agent team.
