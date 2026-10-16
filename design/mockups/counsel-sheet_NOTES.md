# Counsel sheet and gate mockup: design notes (trial)

File: `design/mockups/counsel-sheet.html` (one file, inline CSS/JS, Google Fonts only). Same tokens, fonts, top bar, tabs, gate pill, banner and icon sprite as `review-workspace.html`. Counsel sheet tab is active; Review tab links to the review mockup.

## Layout
- Gate panel at the top (full width): status, "n of N critical items resolved", every reason as a button that jumps to its item (sheet question, or the excluded Awaiting card, which opens the collapsed section). Note under it: Accept does not open the gate.
- Toolbar: title, counts, All / Unanswered filter, Export DOCX.
- Question cards: severity, class, New or Accepted, memory label, editable question, provenance, quote with location, options A/B/C, Record answer.
- Collapsed "Already answered (2) · Awaiting counsel (2)": prior answer, fund, who, when; each marked "Not included in the export".

## What works
- Edit wording: inline textarea, Save, Cancel, Reset, Ctrl/Cmd+Enter, Esc. Saved edits persist in localStorage (try/catch; page works with storage off). Edited cards say "Edited by you" and keep the text across the AI toggle.
- Provenance: "Template draft · from rule XREF-02" or "AI draft · gemma-4 (free) · from cache" (only Q5 has a cached AI draft). No AI switches Q5 to template wording and shows the banner.
- Record answer: A/B/C or "unclear", note, who, date. Needs a choice and a name. Sets the card to Answered, updates gate pill, gate panel and tab count live, with Undo. "Unclear" on a critical item keeps the gate Blocked. Change answer is possible.
- Awaiting counsel items have "Record counsel's answer"; recording moves them to Already answered.
- Gate goes Ready after Q1, Q2, Q3 and the Awaiting "Eligible Investor" item have clear answers (5 critical items total; one already resolved by a prior answer).
- Export DOCX opens a modal preview: all 5 questions with citation, options and recorded answers, plus the list of what is left out. Warns if the gate is still Blocked. Download shows a "mockup only" toast. No CSV or PDF.

## ACs
AC20 (one question per New/Accepted needs-counsel finding, citation, interpretations, editable, persists, template draft), AC21 (DOCX only, answers beside questions, answer sets Answered), AC22 (strict gate, linked reasons incl. Awaiting counsel, unclear, re-confirm), AC45 (prior answers shown with fund and date, absent from export, Awaiting not resent), AC36 (draft provenance, fresh/cache), AC25 (template drafts and gate in No AI). Also AC48 (F-03 label), AC43 labels.

## Checks
- Served locally, headless Chrome with and without `--disable-local-storage`: DOM populated (5 questions, gate "Blocked, 4 reasons"), no uncaught errors. A scripted click-through confirmed: edit persists, empty save refused, gate 4 to 3 to 3 (unclear) to 2 to 1 to Ready, AI toggle swaps Q5 provenance, export modal lists 5 items.
- `inspect.mjs` ran offline: 4 FAIL, all marketing-page rules ignored by design (icon-cards fires on the real list of 5 questions; few-pictures, focal-point, still-page are landing-page rules). Screenshots at 1440 and 1024 reviewed; layout holds at 1024 (gate panel stacks).

## Open questions
1. Do answered questions stay on the sheet with the answer beside them (mocked, AC21), or leave once answered? The export shows all 5 with answers.
2. Does a counsel answer on a "Dismissed in Master Fund 2019, re-confirm" item count as the re-confirmation (mocked: yes)?
3. Should Awaiting items be answerable here (mocked) or only through a re-import?
4. Counsel name "R. Whitlock" and all dates are placeholders.
