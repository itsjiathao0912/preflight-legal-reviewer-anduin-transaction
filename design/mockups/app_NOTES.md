# App shell and Findings mockup: design notes (trial)

File: `design/mockups/app.html` (one file, inline CSS/JS in one IIFE, Google Fonts only). Same :root tokens, Newsreader (document text only) + Geist (UI), icon sprite style, tone steps, 4px radius as `review-workspace.html`. One very soft shadow only on popovers and the dismiss modal.

## Information architecture
- Left sidebar (232px, collapses to a 56px icon rail; below 1200px it is forced to the rail). Top: brand, collapse toggle, document switcher (NGI 2024 / Hartwell & Crane LLP, menu with other documents and "Open another document…").
- Groups in sentence case (the tells registry bans tracked uppercase labels): Review (Findings, Counsel questions), Check (Structure, Compare versions), Firm (Hartwell & Crane memory, Documents).
- Pinned bottom: gate button "Blocked · N" (opens the reasons popover), AI on / No AI demo switch with the daily allowance, analyst name. No horizontal tab bar anywhere.
- Only Findings is built. The other five items open a placeholder ("X — coming in next iteration") with a link to the existing standalone mockup.

## Findings screen
- One-line header: "Findings" + "6 open · 3 block digitization"; the stage stepper is one small status button ("Checks done · AI review pending") that opens the full stepper in a popover.
- Reading view (center) + 400px findings column (380px at 1024). No outline column; "Jump to section" menu in the document header shows blocking counts per section.
- List: severity chips (Blocks 3 · Fix 2 · Note 2, toggle filters) + one "Filter" menu (class, status, sort, J/K hint, reset). Each finding is one row: severity icon + title + location. Selecting expands the row in place (quote, expected/found, provenance, "Why it was flagged" disclosure, Accept / Dismiss / Needs counsel). "Previously handled (3)" is a collapsed row pinned at the bottom.
- Dismiss opens a modal: fixed reasons + optional note, refuses without a reason, traps focus (rest of the app is inert), closes on Esc, then moves to the next finding. Undo toast on every change.
- Kept from the approved mockup: quote highlight + scroll on select, J/K, "Dismissed in Master Fund 2019, re-confirm" stays in the main list and blocking, routing number masked with Reveal, No-AI banner (2 lines), gate and counts update live.

## Density rules applied
- Default view shows rows and one status line; evidence, rule facts, confidence and memory detail appear only for the selected row or behind a click.
- Muted help text: one line per screen (the "Reading view" caption). No explanatory paragraphs.
- Only the sidebar collapse preference is stored (guarded try/catch). Filters, view, selection and AI mode reset on load (the earlier persisted-state bug).

## Verified (headless Chrome 1440 and 1024, normal and --disable-local-storage)
No uncaught errors, DOM populated (7 rows). Scripted checks passed: nav switches views; collapse to 56px rail and persists; row expands on select; J/K; Dismiss without a reason refused; Esc closes the modal; focus stays trapped over 12 Tab presses; gate drops from Blocked 3 to 2 on a reasoned dismissal and returns on Undo; No-AI banner; popovers close on Esc; auto-rail at 1024 with no horizontal overflow.

## Open questions
1. Should Structure's issue count (9) and the Findings count (open only, excluding Accepted/counsel) follow other definitions?
2. Keep group labels as plain "Review / Check / Firm", or drop labels in favour of spacing?
3. Counts: Findings badge shows open items only; should it show all active findings instead?
4. Analyst name "Linh Tran" is a placeholder.
