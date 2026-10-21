# Form preview mockup: design notes (proposal, not approved)

File: `design/mockups/form-preview.html`. It is a copy of the approved `findings-v2.html` (same shell, sidebar, findings panel, accordion groups, sticky action bar, zoom, splitter, shortcuts) with one addition: a view switch in the document pane header. Tokens are unchanged (same values as `app.html`). Opens standalone; `?view=doc` starts on Document, `?type=ind|ent|bpi|nus` starts on another investor type. It opens on Form preview, Benefit Plan Investor, with finding F1 open.

Sample content is the Northgate Fund III document from `findings-v2.html`. The form fields, section reasons and the three added findings are invented for the mockup.

## Decisions

- **D1. The Form preview lives in the Findings screen, in the document pane.** A segmented control "Document | Form preview" sits at the left of the document-pane header. The analyst reviews findings and previews the form in one place, with the panel always visible on the right. The Structure lens proposed earlier is dropped; Structure is unchanged. Default view in the product stays Document; the mockup opens on Form preview so it is visible.
- **D2. The switch is a two-tab tablist** (`role=tablist`, `aria-selected`, `aria-controls`, Left and Right arrow keys). Each pane is a `tabpanel`. Zoom controls (zoom out, level, zoom in, Fit width) are hidden in Form preview because they only apply to the document page; the hide-panel button stays. Switching back restores the page and recomputes Fit width.
- **D3. One driver, two controls.** "Preview as" (select) and the form's own "Select one: Individual, Entity or Benefit Plan Investor" radios are the same state. "Non-US Investor (not offered)" exists only in the select: the document offers no such option, which is the point of that finding.
- **D4. Form pane anatomy** (one 700 px column, same as the paper): control bar (Preview as, counts, "Preview only" note) -> path-level notes -> compact section chips -> collapsible cards. The chips replace the earlier side TOC because the pane is only about 600 px wide at 1440 and 400 px at 1024. Skipped sections are struck through with a visible reason in a muted line in the form flow ("Skipped for Benefit Plan Investor: 4 Investor representations (Section 3 says skip Section 4)") and a screen-reader "(skipped: reason)" on the chip. Counts: "N of 10 sections shown", "N skipped", "N issues on this path". Section 11 has no fields and is not shown (stated in the footer).
- **D5. Preview only, stated twice.** A "Preview only" badge with one sentence ("Not a generated form ... nothing you type is saved") and a footer line separating this from the exported JSON outline. Fields are real inputs for testing logic; there is no `<form>`, no submit, no storage.
- **D6. Source of data = `StructureView`, not the exported outline.** Sections, investor-type paths, option groups (cue stated or missing), conditions and gaps come from the engine's `StructureView` (rules only, no AI), the same source as the Structure lenses. The exported JSON outline stays a "not a generated form" export and gets no new fields. The Findings panel keeps its own finding list; the preview only links to it.
- **D7. Four issue kinds, tone matches the finding's severity, icon plus word.** Each callout shows rule, "deterministic", location and "Open finding".

| Kind | Finding | Severity and tone | Shown on |
|---|---|---|---|
| Broken skip target | F1 (existing): "Benefit Plan Investors are sent to Part B, which holds tax forms" | Blocks (red) | Benefit Plan Investor, inside Section 3 under the skip sentence |
| Dead-end path | F7 (existing, severity raised from Note to Blocks for this mockup): "Non-US Investors have no path" | Blocks (red) | Non-US Investor: banner at the top plus a "path stops here" marker after Section 3; Sections 4 to 10 skipped |
| Uncertain path | F16 (new): "The path for Entity through Section 4(d) could not be proven" | Note (grey-blue) | Entity: note at the top plus a "Not proven" tag on Section 4 |
| Missing "check one" cue | F15 (new): "Tax residence has no “check one” cue" | Fix (amber) | All four types, under the Tax residence group in Section 2 |

  F15 and F16 also appear in the document text (two added lines in Sections 2 and 4) and in the Findings panel, so the list is now 16 findings and the gate reads "Blocked · 2".
- **D8. Two-way link with the Findings panel.**
  - "Open finding" in a callout selects that row in the panel, opens its group, scrolls the panel to it and focuses it. The callout and the form card that belong to the open finding are highlighted (outline, plus the app's yellow mark colour on the card).
  - Clicking a finding row, or J and K, while Form preview is active scrolls the form to the callout or card for that finding, flashes it and expands it if collapsed. In Document view the same action scrolls and flashes the passage, as in Findings v2.
  - Section chips scroll to their card. Switching view or investor type keeps the open finding.
- **D9. Findings that are not on the current path: a hint, not a filter.** Rows whose form location is not shown for the chosen type carry a dashed "Not on this path" tag (same style as the existing "Repeat" tag); clicking one explains it in a status line above the form ("F3 is not on the Benefit Plan Investor path. It shows on: Individual, Entity."). Rows with no form location (for example a drafting note) show no tag. Why not a "This path only" filter: review progress, counts and the gate cover the whole document, so a filter that hides findings could hide a blocker; a path is a way to look at the form, not a way to triage. A filter can be added later without changing the hint.
- **D10. Build once, toggle visibility.** Changing type hides and shows nodes; typed values, collapsed state and focus survive. Only chips, counts, skip lines and the panel rows (for the tag) are refreshed.
- **D11. Accessibility.** Labels on every input, `aria-required` plus "(required)" for screen readers, option groups are `fieldset` plus `legend`, callouts are labelled groups, counts are a polite status region, focus ring is the Findings v2 ink outline, reduced motion respected. Input text is 14 px (desktop only app).
- **D12. Layout at 1024.** Header controls wrap to a second row; callout links move under the text; the card body drops its left indent. Works at 1440 and 1024 without sideways scroll.

## States shown

| Type | Sections shown | Callouts | Not-on-path rows |
|---|---|---|---|
| Individual | 9 of 10 (6 ERISA skipped) | F15 | 5 |
| Entity | 9 of 10 (6 ERISA skipped) | F15, F16 (note and Not proven tag) | 4 |
| Benefit Plan Investor (default) | 9 of 10 (4 Investor representations skipped) | F15, F1 | 3 |
| Non-US Investor (not offered) | 3 of 10 (7 skipped: Sections 4 to 10) | F15, F7 banner and marker | 11 |

Also shown: Document view with the full document page and zoom controls; the open-finding to callout highlight; the row to card scroll and flash; collapsed cards; a "not on this path" explanation line.

Checked in headless Chrome at 1440 and 1024: no script errors; per-type section counts, callouts and tag counts as above; Open finding selects the row and highlights callout and card; a row click highlights the matching card or shows the hint; the view switch works both ways and restores zoom. Not tested: real keyboard navigation and screen readers.

## Implementation notes (not part of this task)

- Add a `view` state (`document | form`) to the Findings screen next to the zoom state; the panel, selection and shortcuts already live in the Findings store, so the preview only reads the selected finding id and sets it.
- Needs from the engine: field and blank content for the cards is not in `StructureView` today (sections, option groups with cues, conditions and investor paths exist; fields and blanks do not). A small additive `StructureView.form` contract is needed, plus a finding-id to section and investor-type map (`FMAP` in the mockup). The three issue kinds other than the cue already exist as PATH and COND findings.
- Test ids if built: `pane-view-document`, `pane-view-form`, `form-preview`, `form-type`, `form-section` (`data-section`), `form-issue` (`data-finding-id`), `finding-not-on-path`.

## Open questions

1. Field and blank detection: does the engine detect blanks and their kinds (text, amount, date)? If not, is a card with option groups and question text enough for v1?
2. "Uncertain" today means "no signature section found; nothing flagged". The mock also uses it for "which entity kinds count is not stated". Is that wider meaning wanted?
3. F7 (no Non-US path) is a Note in Findings v2 and Blocks here. Should a dead end always block the gate?
4. Which investor type should the preview open on: the first type with an issue, the one the engine preselects, or the last used?
5. Should "Preview as" also change which findings the panel shows by default (the rejected "This path only" filter), or stay a hint?
6. Required markers: derived from "required" or "must" wording, or from blanks in sections the type must complete? Needs a rule before it shows as fact.
7. Should the Document view highlight the passage for the section the analyst last looked at in the form (reverse of the current link)?
