# Structure view mockup: design notes (trial)

File: `design/mockups/structure.html` (one file, inline CSS/JS, Google Fonts only). Same tokens, fonts, top bar, tabs, icon style and 4px radius as `review-workspace.html`. Serif is used only for document text (quotes, reference text, defined terms, brand mark); headings and UI are Geist. Top tabs are now Review · Structure · Compare · Counsel sheet; Review, Compare and Counsel sheet show a "separate mockup" toast here.

## Decision record
User decision (17 Oct 2026): Investor paths is no longer a separate top tab. It is a sub-view of Structure, "Investor types". The user also rejected the 8x12 "Yes" matrix as the main view (useless, ugly) and the top gap banner. The matrix and the banner were removed; "Compare all types" is omitted (it was optional). The "Investor paths" button was also deleted from the tab bars of `review-workspace.html` and `counsel-sheet.html` (nothing else changed there).

## What it shows
- **Structure sub-views** (arrow keys move between them): Sections (tree with Parts A to D inside Section 6, restart badges), Cross-references (24 internal with status chips; "External, not checked" table of 7 citations), Conditional instructions (whitelist, role routing, skip, negative gate; optional flow diagram, collapsed by default), Option groups (check one / all that apply, cue printed vs inferred), Defined terms (undefined-use flags such as "Units"), Investor types.
- **Swapped references:** "Part B of Section 6" in Section 1 (suspicious, expected Section 4) and "Part B of Section 4" (unresolved, expected Part B of Section 6). "this Section 11" in Section 12 is a third suspicious one.
- **Investor types:** chip shows the gap count ("Investor types ⚠ 1"). Left: one row per type (8) with "N of 12 sections" and a "1 gap" marker. Right: the selected type's path in document order; applying sections and questions are plain rows, consecutive skipped sections collapse into one muted line (Corporation: "Skipped: 4 Custodian, 5 ERISA"). Opens with Partnership or LLC selected. Its gap shows inline under Section 7: "Footnote 2 (attach entity documents) is missing here — Corporation, Trust and Other entity have it", with rule PATH-04 and Show in document.
- **Right panel (448px, 400px at 1024):** same pattern for every sub-view: facts, quote, expected vs found, rule id, "Same result on every run", Show in document (toast).
- Header strip: document counts and a reproducibility line.

## ACs covered
- AC17: sections incl. scoped restarts, references with three statuses, conditionals, option groups with exclusivity cue, defined terms, statutory citations listed separately as not checked.
- AC61 (still covered): per investor type, which sections and questions apply, deterministic (same document, same path on every run).
- AC9: every panel states the rule id and the facts used. AC8: reproducibility line and per-panel note.
- AC30 (partly): visible focus, keyboard-operable lists and rows, non-color cues, reduced motion respected.

## Checks run
- Headless Chrome with `--disable-local-storage`: no Uncaught errors in structure.html, review-workspace.html, counsel-sheet.html. Selected sub-view is stored in localStorage inside try/catch.
- Scripted: Investor types opens with Partnership or LLC selected and the gap row present; switching to Corporation removes the gap and shows the skipped line; Individual works. Tab bar reads Review, Structure, Compare, Counsel sheet.
- `inspect.mjs` (earlier run): only marketing-page rules failed (body-size, few-pictures, focal-point, still-page, no-footage, grey-body); ignored for an app screen. Below 1000px width is unsupported, as in the approved mockup.

## Open questions
1. Should "Some questions" sections (Section 12) list their paragraphs in the path, as the other sections list questions?
2. Is a gap "peers have it, one type does not" (as mocked), or should it also flag types that no section reaches?
3. Defined terms lists 10 terms; keep common-noun hits such as "Board" or hide by default?
4. Content for Sections 7, 10 and Parts C/D is invented to match the review mockup (Hartwell & Crane LLP is fictional).
