---
name: spec:form-preview
description: "Product requirements for a read-only Form preview inside the Findings screen: preview how the digitized subscription form would behave per investor type, linked to findings"
date: 19-10-26
feature: form-preview
---

# Form Preview inside the Findings Screen: SPEC

Status: written 19-10-26, for user review. Approved UI contract: `design/mockups/form-preview.html` and `design/mockups/form-preview_NOTES.md` (decisions D1 to D12).

## Summary

The analyst has to turn a subscription document into an adaptive smart form. Today the app tells them what is wrong with the document, but not what the form would feel like to an investor. This feature adds a read-only "Form preview" next to the document, in the Findings screen the analyst already uses. They pick an investor type and see which sections apply, which are skipped and why, what the questions look like, and where the document's own rules break (a skip that lands in the wrong place, a path with no exit, a path the tool could not prove, a "check one" question with no cue). Every problem links to the matching finding and back. Nothing the analyst types is saved, no form is generated, and the exported outline does not change.

## User Stories / Jobs To Be Done

- US1. As a Digitization Service Analyst, when I review a sub doc, I want to preview how the form would behave for an Individual, Entity, Benefit Plan Investor or other type, so I can catch logic that only breaks on one path before I build anything.
- US2. As an analyst, when a finding says "Benefit Plan Investors are sent to Part B", I want to see that spot inside the previewed form for that investor type, so I understand the real effect and not just the quote.
- US3. As an analyst, when I look at the form for one investor type, I want skipped sections shown struck through with the reason, so I can check the skip rules match my reading of the document.
- US4. As an analyst, I want to click a problem in the preview and land on its finding, and click a finding and land on its spot in the preview, so I can move between the two without hunting.
- US5. As an analyst, I want to type sample answers into the preview to test the logic, without anything being saved, so I can try it freely.
- US6. As an analyst, I want the preview to say plainly when it is guessing (heuristic paths, scanned documents, no fields found), so I never treat a guess as proof.
- US7. As a reviewer of the gate, I want review progress, counts and the gate to keep covering the whole document no matter which investor type I am previewing, so a blocker cannot hide behind a path.

## What The User Wants (Behavioral Outcomes)

1. In the Findings screen, the document pane has a two-way switch: "Document | Form preview". Document is the default. No new screen, route or sidebar item. The Structure screen is unchanged.
2. In Form preview the analyst sees: a control bar ("Preview as" picker, counts, "Preview only" note), notes that apply to the whole path, a row of section chips, and one collapsible card per shown section.
3. "Preview as" and the form's own "Select one: Individual, Entity or Benefit Plan Investor" radios are the same choice. Changing either changes both. A type the document does not offer (for example Non-US Investor) appears only in the picker, marked "not offered".
4. Chips show every section. Skipped sections are struck through with a visible reason ("Skipped for Benefit Plan Investor: 4 Investor representations (Section 3 says skip Section 4)") and a screen-reader reason. Counts read "N of M sections shown", "N skipped", "N issues on this path".
5. Cards collapse and expand. Inputs are real (type, tick, select) so logic can be tried, but nothing is saved or submitted.
6. Four kinds of issue appear inline, each with icon, word, severity colour, the rule, the label "deterministic" or "uncertain", the location and an "Open finding" link: broken skip target, dead-end path, uncertain path, missing "check one" cue.
7. "Open finding" selects that row in the Findings panel, opens its group, scrolls to it and highlights both the callout and the card. Clicking a finding row (or J and K) while the preview is showing scrolls to and flashes the matching spot.
8. Findings whose spot is not on the chosen path get a dashed "Not on this path" tag. Clicking it explains where the finding does appear. Findings are never filtered out.
9. A "Preview only, not a generated form" note appears at the top and again in the footer, which also says the exported JSON outline is a separate, unchanged file.
10. Switching type or view keeps typed values, collapsed state, scroll context and the open finding.

## Flow / State Diagram

```
Findings screen (existing)
 |
 |-- [Document | Form preview] switch (default: Document)
 |
 +-- Document view (unchanged, zoom controls shown)
 |
 +-- Form preview
       |
       |-- Preview as: [Individual | Entity | BPI | ... | Non-US (not offered)]
       |        ^                                   |
       |        +---- same choice as form radios ---+
       |
       |-- no fields / no paths / scan?  --> limited state with plain message
       |
       |-- chips: S1 S2 S3 ~~S4~~ S5 ... (skipped = struck + reason)
       |
       |-- cards (collapsible, real unsaved inputs)
       |       |
       |       +-- issue callout --[Open finding]--> Findings panel row selected,
       |                                             group opened, card highlighted
       |                                                   |
       |       +<---- click row / J / K  ------------------+
       |
       +-- findings not on this path: row gets "Not on this path" tag
                  click --> status line: "F3 is not on the BPI path. It shows on: Individual, Entity."
                  (list is NOT filtered; counts and gate cover the whole document)

Type change or view switch: values, collapsed state, open finding all kept.
```

## Acceptance Criteria (Testable Outcomes)

Scenario names below are placeholders to be bound to the existing lanes in `process/context/tests/all-tests.md` (core unit, web unit, Playwright preview e2e, stack-memory) at PLAN time. Strategy tags: Fully-Automated, Hybrid, Agent-Probe.

- AC-FP1. The document pane offers a "Document | Form preview" switch that starts on Document, is a two-tab control, and works with Left and Right arrow keys.
  proven by: preview e2e "view switch default and keyboard"; strategy: Fully-Automated
- AC-FP2. No new route, screen or sidebar item exists, and the Structure screen is unchanged.
  proven by: preview e2e "route and nav snapshot unchanged" plus existing Structure specs staying green; strategy: Fully-Automated
- AC-FP3. "Preview as" and the form's type radios always show the same value; a type the document does not offer exists only in the picker and is marked "not offered".
  proven by: web unit "type state sync" plus preview e2e "picker and radios stay in sync"; strategy: Fully-Automated
- AC-FP4. On first open the preview selects the type described in the Open Question 4 decision (recommended: the first type that has an issue, else the engine's preselected type), and later opens keep the last choice in the session.
  proven by: web unit "default type rule"; strategy: Fully-Automated
- AC-FP5. For each type, chips list all sections; skipped ones are struck with a visible reason and a screen-reader reason; the three counts match the underlying path data.
  proven by: core unit "per-type section result" plus preview e2e "chips and counts for samples #1, #7, #10"; strategy: Fully-Automated
- AC-FP6. Cards collapse and expand, inputs accept typing, and nothing is written to storage, memory sync or network; there is no submit.
  proven by: preview e2e "inputs unsaved: storage and request log empty after typing" plus web unit "no form element, no persistence call"; strategy: Fully-Automated
- AC-FP7. Each of the four issue kinds renders on the right type and place, with icon, word, severity matching its finding, rule, "deterministic" or "uncertain" label, location and an "Open finding" link.
  proven by: preview e2e "issue callouts per kind" using a seeded fixture for each kind; strategy: Fully-Automated
- AC-FP8. "Open finding" selects the panel row, opens its group, scrolls and focuses it, and highlights both callout and card; clicking a row or J/K while previewing scrolls to and flashes the matching spot, expanding it if collapsed; in Document view the existing passage behaviour is unchanged.
  proven by: preview e2e "two-way finding link" plus existing Findings v2 specs staying green; strategy: Fully-Automated
- AC-FP9. Findings not on the chosen path carry a "Not on this path" tag with an explanation naming the types where they do appear; rows with no form location show no tag; no finding is hidden; counts, review progress and the gate are identical for every type.
  proven by: web unit "not-on-path mapping" plus preview e2e "tag, explanation, and gate counts constant across types"; strategy: Fully-Automated
- AC-FP10. Switching type or switching between Document and Form preview keeps typed values, collapsed state and the open finding.
  proven by: preview e2e "state survives switches"; strategy: Fully-Automated
- AC-FP11. "Preview only, not a generated form" appears at the top and in the footer, and the exported JSON outline is byte-identical to before this feature for the same document.
  proven by: core unit "outline export snapshot unchanged" plus preview e2e "both notes visible"; strategy: Fully-Automated
- AC-FP12. The preview makes no AI or OCR calls and works fully in no-LLM mode and offline after load.
  proven by: preview e2e "request log has zero /api/ai and /api/ocr during preview use"; strategy: Fully-Automated
- AC-FP13. Investor paths are labelled as rule-based and heuristic; an uncertain path shows a "Not proven" tag and a note instead of a confident skip or show; the preview never states a path as fact when the engine marked it uncertain.
  proven by: core unit "uncertain flag carried to preview data" plus preview e2e "not proven tag on seeded uncertain path"; strategy: Fully-Automated
- AC-FP14. When the engine finds no investor types, no sections with questions, or a scanned/OCR document whose structure is low confidence, the preview shows a plain limited-state message (what is missing and why) instead of a blank or invented form; the document and findings remain usable.
  proven by: preview e2e "limited states: no types, no fields, OCR sample #9"; strategy: Fully-Automated
- AC-FP15. A type with no path (dead end) shows a path-level banner and a "path stops here" marker, and later sections are shown skipped.
  proven by: preview e2e "dead-end path presentation"; strategy: Fully-Automated
- AC-FP16. Accessibility: every input has a label, option groups use fieldset and legend, required items are exposed to assistive tech, counts are a polite status region, focus ring is visible, reduced motion is respected, and the automated a11y gate reports zero critical violations in Form preview.
  proven by: existing axe e2e extended to the preview state; strategy: Hybrid (manual keyboard and screen-reader pass is an operator residual)
- AC-FP17. Layout works at 1440 and 1024 widths with no sideways scroll; zoom controls are hidden in Form preview and restored, with Fit width recomputed, when returning to Document.
  proven by: preview e2e "viewport 1440 and 1024, zoom controls toggle"; strategy: Fully-Automated
- AC-FP18. Changing investor type responds in under 100 ms on the largest demo sample (#10) with no re-parse of the document.
  proven by: web unit or e2e timing probe "type switch budget"; strategy: Hybrid (timing is a soft budget, reported not hard-failed on slow CI)
- AC-FP19. The preview works end to end on demo samples #1 Franklin, #7 Cottonwood and #10 CrowdStreet, and every pre-existing Findings, Compare, Questions and gate test still passes.
  proven by: preview e2e per-sample specs plus the full existing suites; strategy: Fully-Automated
- AC-FP20. The findings the preview links to (including raised severity decisions from Open Question 3) behave identically in the gate, counsel sheet and exports as any other finding.
  proven by: web unit and core unit "severity and gate unchanged by preview"; strategy: Fully-Automated

## Out Of Scope

- Saving or exporting anything the analyst types (no investor data stored, no sessions, no memory sync).
- A form builder, form generator, or any export of a form. The JSON logic outline export stays exactly as is and keeps its "not a generated form" disclaimer. This feature is a preview of rule behaviour, which keeps the earlier product decision (D4, outline does not generate the form) intact.
- A new screen, route, sidebar item or a Structure lens.
- Any LLM or OCR call, and any new AI-derived path or field.
- A "This path only" filter that hides findings (the preview uses a hint instead).
- Editing the document, the form, or findings from the preview.
- Evaluating free-text conditions other than investor type (for example "if the investor is a US taxpayer"); only investor type is machine-evaluable.
- Pixel-matching real competitor forms or claiming the preview equals the final digitized form.
- A full manual keyboard and screen-reader audit (recorded as an operator residual).

## Constraints

- No new screens (user rule: integrate, do not add screens). Lives inside the Findings screen document pane.
- Read-only, no persistence, no network use by the preview itself, no `eval` (CSP), no LLM calls; must work in no-LLM mode.
- Uses the existing look: tokens from `app.html`, Findings v2 focus ring and conventions; desktop only.
- Data comes from rules-only engine output (sections, option groups with cues, conditions, investor paths, gaps), not from the exported outline. The outline and its schema stay unchanged.
- Existing frozen contracts stay compatible; any engine addition must be additive.
- Investor paths are heuristic (10 types in 3 families) with no ground truth; the UI must say so.
- Review progress, counts and gate cover the whole document regardless of preview type.
- Accessibility: zero critical axe violations; labels, fieldset and legend, reduced motion.
- Cloudflare rules in the project CLAUDE.md apply to any deploy; this SPEC adds no deploy requirement.
- Test layout follows the existing lanes (core unit, web unit, preview e2e, stack-memory).

## Open Questions

Each has an owner (user) and a recommended default. Under interactive rules these would block PLAN; the defaults below are what the SPEC and acceptance criteria assume unless the user overrides.

1. Fields and blanks. The engine does not detect blanks or their kinds (text, amount, date) today; only questions and option groups. Recommended default: v1 shows cards with question text and option groups plus plain text inputs for blanks it can see; no kind detection (amount/date) in v1. Owner: user.
2. Meaning of "uncertain". Today it means "no signature section found." The mockup also uses it for "which entity kinds count is not stated." Recommended default: yes, widen to any path the engine cannot prove, labelled "Not proven" with the reason stated. Owner: user.
3. Should a dead end (no path for an offered or expected type) always block the gate? The mockup raised F7 from Note to Blocks. Recommended default: keep it a Note in this feature (no change to gate rules); revisit severity as its own decision. The mockup severity is a demo choice. Owner: user.
4. Which type does the preview open on? Recommended default: first type that has an issue, otherwise the engine's preselected type; later opens remember the last choice in the session. Owner: user.
5. Should "Preview as" change which findings the panel shows? Recommended default: no; hint only ("Not on this path" tag), as in the mockup. Owner: user.
6. "Required" markers. Recommended default: show a required marker only where the document wording says "required" or "must"; otherwise show nothing rather than guess. Owner: user.
7. Reverse link from Document: highlight the passage for the form section last viewed. Recommended default: not in v1 (backlog). Owner: user.
8. Mockup sample findings F15 (missing "check one" cue on Tax residence) and F16 (uncertain path via Section 4(d)) were invented for the mockup. Recommended default: the preview shows only what real detectors produce; if "missing cue" and "uncertain path" are not already real findings on the demo samples, they appear only when the engine raises them, and demo screenshots use real samples. Owner: user.

## Background / Research Findings

- The exported outline (`form-logic-outline/v1`, strict schema) has sections, branches with free-text conditions and investor paths, but no fields, options or finding links, and carries the disclaimer "Reference outline only; not a generated form". An earlier product decision (D4, Anduin platform research) scoped the outline as not generating the form. This feature leaves the export untouched.
- The engine's structure view is richer: option groups (question, options, one or all, whether a "check one" cue is stated, linked finding and block), conditions with target-found flag, and per-investor-type rows (sections, skipped, gaps, reaches completion, uncertain). Core also knows fields (id, label, block index) but does not expose them to the structure view. Blank kinds are not detected.
- Investor paths are heuristic: 10 types in 3 families, no ground truth. Only investor type can be evaluated by machine; other conditions are free text.
- Findings v2 lives in the web review feature (panel, zoom, reason modal, shortcuts, toast). Constraints from the UI context: tokens from the approved app mockup, CSP without eval, zero critical a11y violations, integrate rather than add screens.
- Good demo samples: #1 Franklin, #7 Cottonwood, #10 CrowdStreet.
- The approved mockup (decisions D1 to D12) is the UI contract: segmented switch in document pane, chips instead of a side table of contents, "Preview only" twice, four issue kinds, two-way finding link, "Not on this path" hint instead of a filter, build once and toggle visibility, a11y and 1024 layout rules. The mockup itself lists open questions 1 to 7, carried above; mockup sample findings F15 and F16 are invented and F7 severity was raised for demo.
- User brainstorm: the Structure lens idea was rejected; the preview must live in the Findings screen; competitors' "adaptive field sync" motivates showing form behaviour per investor type.

TL;DR: SPEC written. A read-only Form preview switch in the Findings document pane, per-investor-type sections, skips with reasons, four inline issue kinds, two-way finding link, nothing saved, no LLM, export unchanged; 20 acceptance criteria, mostly fully automated; 8 open questions each with a recommended default.
