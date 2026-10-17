# Findings v2: UX audit and redesign notes

Design-only mockup: [findings-v2.html](findings-v2.html). The user approved it on 18-10-26 after 9 review rounds. Nothing here is built in the app yet.

## 1. Method

- **What was used:** the repo's UI checklists (`ux-review`, `ui-review`, design-taste `tells.md`) and the visual system in `process/context/ui/all-ui.md` and `design/mockups/app.html`.
- **Tokens:** copied verbatim from `app.html`. Newsreader is used for document text and headings, Geist for the UI, with a 4px radius and no gradients.

## 2. Audit findings (most severe first)

1. **Critical: the result of a click is invisible.** The row only changes a small icon. The real effects land on other screens (gate, Counsel questions, memory), and the toast just says it succeeded. This is why users feel that "nothing happens".
2. **Critical: the actions overlap.** On a blocking finding, Accept and Needs counsel end in the same place: an accepted critical finding becomes a counsel question and the gate stays blocked. "Accept" sounds like "fine" but means "this is a real problem".
3. **Major: duplicates inflate counts.** An AI suggestion that repeats a rule finding adds a second row, a second count and a second counsel question for one issue.
4. **Major: the right panel is too narrow and cluttered.** Text is 13px, titles are truncated, and an expanded row shows about eight kinds of information at once.
5. **Major: no progress, no grouping by state, no done state.**
6. **Minor:** the header stacks three status lines, the Dismiss modal does not say what it changes, and the A/B readings looked like options the analyst could pick.

## 3. Root cause: where each old click really landed

| Click | What really changes | Where it was visible |
|---|---|---|
| Accept (critical) | Status becomes accepted. The finding becomes a counsel question and the gate stays blocked. A memory write happens if a firm is set. | Counsel screen, gate popover, memory screen |
| Accept (non-critical) | Status becomes accepted. A memory write happens if a firm is set. | Nowhere obvious |
| Needs counsel | Status becomes counsel and a counsel question is created. Browser only, no API call. | Counsel badge |
| Dismiss + reason | Status becomes dismissed and the gate is resolved. A memory write happens, and a rule may be proposed after 3 dismissals. | Gate pill, memory screen |

## 4. Final design (approved)

| # | Decision | Rejected alternative (why) |
|---|---|---|
| D1 | **Two equal buttons:** "Ask counsel" (filled near-black) and "Close issue" (outline). No help text under them. | Three buttons; "Keep as issue" / "Keep open" as a second button; a quiet "Not an issue" link (user chose two plain CTAs). |
| D2 | **Close issue opens a reason modal.** Reasons: "Real issue — I'll handle it in the form build" (hidden on blocking findings), "Firm's standard wording", "Does not affect the form", "Tool false alarm", "Other" (note required). | A separate button per outcome (too many buttons). |
| D3 | **One sticky action bar** pinned to the bottom of the panel, full panel width. It acts on the open finding, is disabled when nothing is open, and shows "Move back to review" for a finding already sent or closed. After an action, the next finding opens. | Buttons inside each expanded row (user: they must stay at the bottom). |
| D4 | **Wide, resizable panel:** 40–65% of the screen. Expanded content uses the full panel width. | A fixed 440px panel (too small); a max-width content column (left a blank strip). |
| D5 | **Accordion list:** one-line 36px rows; the detail opens directly under the clicked row, one at a time. | Master–detail split, detail at the bottom of the list, tabs inside the detail (user rejected all three). |
| D6 | **Expanded block, stacked (option A):** severity line + section + "AI agrees"; What's wrong; the quote; "Question for counsel" (auto-open on blocking and A/B findings, A/B shown as plain text that counsel chooses); "Details" (collapsed: where, class, rule, AI review, confidence, why flagged). | Tabs (option B). |
| D7 | **No "Show in document" button.** A row click or J/K scrolls the document and flashes the passage. | A separate button (redundant). |
| D8 | **Groups and progress:** To review / Sent to counsel / Closed; one header row "N of 14 reviewed" with a thin bar and Counsel · Closed · Left counts. | Segmented state tabs (the row vanishes into a hidden tab). |
| D9 | **Filters:** severity chips (Blocks / Fix / Note) plus the app's Filter popover (Class, Status, Sort by, Detector, Reset). | A custom filter (the app's existing one is liked). |
| D10 | **Calm palette:** black, white and warm greys. Color only in the severity icons (red, amber, grey), the yellow quote highlight, the gate pill status, and the **violet AI tags** ("AI", "AI agrees", "AI suggestion"). The open row is a white card with a hairline border and a soft shadow; no colored left bars; hover is a faint grey; focus ring only on keyboard focus. | Colored severity bars, a teal/blue selected tint, grey filled boxes inside the card (user: ugly). |
| D11 | **Dedupe:** an AI suggestion overlapping a rule finding becomes one row with "AI agrees"; acting on it acts on both. AI-only items keep the "AI" tag. The "As today / Merged" toggle in the mockup shows the difference. | Hiding AI duplicates silently (loses the cross-check signal). |
| D12 | **Outcome toast with Undo:** e.g. "Sent to counsel · Counsel questions now 1 · Gate still blocked (1)". | A generic success toast. |
| D13 | **Selection menu in the document:** "Flag this passage" (manual finding) and "Suggest wording" (proposed fix shown in the counsel question). | Rich-text editing (analysts never edit counsel's document). |
| D14 | **Shortcuts:** J/K move, C = Ask counsel, X = Close issue. | — |
| D15 | **Document zoom, Google Docs style:** the whole page scales (font, page width and padding together; 700px page at 100%). Controls on the right of the reading-view toolbar: [−] [100% ▾] [+] [Fit width]; presets 75/90/100/125/150; manual range 75–200% in 10% steps. **Fit width is the default:** the page fills the document area minus a 32px gutter each side, clamped to 85–175%; when the area is too narrow for 85%, the page reflows (its width shrinks to the area minus the gutters) instead of scaling text below 85%, so there is no horizontal scroll (revised 18-10-26: 90% overflowed at 1024/1440, and a 60% fit made 10px text at 1024). Manual zoom floor is 60%; past the area width it scrolls horizontally, never clipped under the panel. Recomputed on window resize, panel resize and panel collapse. Any manual change turns Fit width off. Cmd/Ctrl = / − / 0 (0 = back to Fit width). Saved per viewer in `ui:v1:doczoom`. Scroll-to-finding works at every zoom; above the fit width the document area scrolls horizontally inside itself. Added 18-10-26. | Widening the text column without scaling (at 1900px that gives ~200-character lines); a fixed narrow centered page (wastes the screen). |

## 5. Mapping: new control → same underlying call

| New control | Underlying call | Gate | Memory |
|---|---|---|---|
| Ask counsel on a non-blocking finding | `needsCounsel(id)` | unchanged | no API call |
| Ask counsel on a blocking finding | `accept(id)`; the counsel sheet makes it a question | stays blocked | accepted decision, if a firm is set |
| Close issue → "Real issue — I'll handle it in the form build" (non-blocking only) | `accept(id)` | unchanged | accepted decision, if a firm is set |
| Close issue → any other reason | `dismiss(id, reason, note)` | resolves a blocker | dismissed decision; may propose a rule |
| Undo on the toast | `restoreSnapshot` | recomputed | decision revoked |
| Move back to review | `restore(id)` | recomputed | decision revoked |

## 6. Build split

1. **UI only (first):** sticky action bar, reason modal, accordion rows, groups, progress row, wide resizable panel (new key `ui:v1:fpw`), the expanded block, palette, outcome toast, done state, shortcuts. Rename or alias test ids `action-accept`, `action-counsel`, `action-dismiss`. The "Question for counsel" text must come from the real counsel sheet draft.
2. **Dedupe (second):** merge on overlapping anchor plus the same issue class, in `use-review-view.ts` or core `toView`. The AI twin shares the triage entry so counsel questions are not double counted; its provenance stays in Details.
3. **Flag this passage / Suggest wording (separate plan):** manual findings need `detector_kind: 'manual'`, a selection anchor, no gating and persistence; the proposed fix is a new optional field carried into the counsel question and the DOCX export.

## 7. Open questions

1. Ask counsel calls `accept` on a blocking finding (memory write) but `needsCounsel` on a non-blocking one (no memory write). Should both write memory?
2. Dedupe rule: is "same block, overlapping offsets, same class" right, and does the higher severity win?
3. The sample counsel sentences, the firm names and the 75% confidence threshold are placeholders.

## 8. Verification (design agent)

Headless Chrome at 1440×900 and 1024×768 after every round: no console errors, no horizontal overflow, the action bar stays visible while the list scrolls, Ask counsel and Close issue move rows and open the next one, Undo restores, and Close issue without a reason shows an error.
