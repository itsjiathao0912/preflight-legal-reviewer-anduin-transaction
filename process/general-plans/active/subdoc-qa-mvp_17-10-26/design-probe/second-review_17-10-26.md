# Second visual review: Phase 03 shell + Findings (read-only)

Method: viewed mockup-{1440,1199,1024}.png vs app-{1440,1199,1024}.png against the plan Step E1 rubric and the implementer's first-pass table. Judged from screenshots only (no CSS/DOM inspection); numeric tokens are covered by `tokens-match-mockup` / `layout-vs-mockup` and not re-verified here.

Verdict: PASS_WITH_NOTES

| # | Rubric item | Result | Reason |
|---|---|---|---|
| 1 | 232px sidebar at 1440 | PASS | Sidebar edge sits at about 232px in both shots; same logo, collapse toggle, doc card, groups. |
| 2 | 56px rail, auto-collapse at 1199 and 1024 | PASS | Both app shots show the icon rail (edge about 56px) matching the mockup; icon order, active teal bar and gate/AI/avatar bottom stack identical. |
| 3 | Reading view + findings column 400 (1440) / 380 (1199, 1024) | PASS | Findings column starts at about 1040 (1440) and about 643 (1024), same as mockup; reading column and paper card match. |
| 4 | No tab bar | PASS | None visible; the header is title + meta + status button only. |
| 5 | Jump to section menu | PASS | Grey "Jump to section" button with chevron, same place, under the "Reading view" caption. |
| 6 | Status button instead of stepper | PASS | "Checks done · AI review pending" pill with spinner and chevron, top right, same as mockup. |
| 7 | Group labels, sentence case (Review / Check / Firm) | PASS | Review (Findings, Counsel questions), Check (Structure, Compare versions), Firm ("<firm> memory", Documents) all match. |
| 8 | Bottom-pinned gate pill + AI switch + analyst | PASS | Red "Blocked · N" pill, "AI on / No AI" segmented switch, allowance line, "LT Linh Tran", pinned at the bottom in all three widths. |
| 9 | Typography: Newsreader for the document and headings per CSS, Geist for UI | PASS | Serif document text, h1 and section headings; sans UI, chips, rows. Weights and sizes look equivalent. |
| 10 | Palette and tone steps (ground, panel, card, paper) | PASS | Sidebar and ground grey, white paper, pale panels for the fields block and quote, same teal accent. |
| 11 | 4px radius family | PASS | Buttons, chips, quote and field panels, highlights all show small radii like the mockup. |
| 12 | Shadows only on popovers and modals; no gradients | PASS | No shadows or gradients visible on any resting surface. Popovers and modal are not in the shots (the first-pass style audit covers them). |
| 13 | Finding row density: one line, expand on select | PASS | Collapsed rows are single-line with ellipsis; selected row expands with the teal left bar, quote, Expected/Found, New chip, rule, "Why it was flagged", Accept / Dismiss... / Needs counsel. |
| 14 | Severity chips + single Filter menu | PASS | Blocks / Fix / Note chips with count and icon, plus one "Filter" button; same position. |
| 15 | Previously handled collapsed row | PASS | Pinned at the bottom of the column with chevron and count; the firm hint on the right is absent when the count is 0, which is reasonable. |

## Differences caused by real content (acceptable, not failed)

- Firm card shows "PG Master Fund 2019 / Partners Group", where the mockup shows "NGI 2024 / Hartwell & Crane LLP". The memory label follows the firm.
- The expanded finding title and quote wrap to more lines (long real sentences), so the expanded card is taller.
- The checkbox glyph appears in the quote and in the document option rows.
- The AI allowance line wraps to two lines ("3 of 3 fresh-AI documents left today"), which follows the plan's wording.
- The document opens scrolled to the selected finding, so the first screen shows the middle of the document.
- Table-like blocks render as grey `.fields` panels, as the mockup does for forms.
- The Structure badge (the "13" warning) is absent. The plan lists "no Structure badge" as an approved deviation.
- Counsel questions shows no badge at 0 (the mockup's "3" is demo data).

## Notes and possible issues (non-blocking)

1. Locator chips ("§1 ¶1") are missing on the expanded row header and on the second collapsed row in app-1440/1199/1024 (the first sample row 1 and the second row show none), where the mockup shows one on every row. The first-pass rubric did not cover this. Check whether paragraph/section data is missing for these samples or the chip is dropped when the title is long; the expanded title also fills the full line width. Low-priority fidelity gap.
2. Accessibility, visible in the screenshots:
   - Small grey captions ("Reading view...", row locators, rail icons, "Expected"/"Found" labels) look low in contrast, about the same as the mockup. They need a measured check (target 4.5:1 for text, 3:1 for icons). Axe flagged no contrast failures, per the report.
   - The amber wavy underline for notes is thin and carries meaning mostly through color. The icon and chip text compensate, as the severity-never-by-color rule intends.
   - No focus ring is visible in any shot (none of them captured keyboard focus). It was not verified visually; keep the manual keyboard pass in P10.
   - Rail badges (black pills over the icons) overlap the icon glyphs at 1199 and 1024, the same as in the mockup. They are legible but crowded.
3. The two serious axe items already in the report (label-content-name-mismatch on the Findings nav item, scrollable-region-focusable on the findings list) remain P10 work.

## Concrete fixes (all optional)

- Investigate and restore the locator chip (section and paragraph) on rows where it is missing, or record it as content-dependent.
- Add a keyboard-focus screenshot (tab to a row, the Accept button and a nav item) to the probe set to confirm the teal focus ring.
- Run a measured contrast check on the caption grey and the rail icon grey against their backgrounds (mockup-inherited, so it is a design-token question, not an implementation bug).

No FAIL items. The shell and Findings screen match the approved mockup at all three widths.
