# Start screen mockup: design notes (trial)

File: `design/mockups/start.html` (one file, inline CSS/JS, Google Fonts only). Same tokens, fonts, brand bar, tone steps, 4px radius and icon-sprite style as `review-workspace.html`. All data is invented; samples are the real public SEC files, but their law-firm tags are demo data.

## Layout
- Left: headline, then one panel with two choices (tabs): "Upload a document" and "Try a sample". Right (416px; below the content at 1180px and narrower): Workspace, Analyst, AI review (with allowance) and the Privacy notice.
- Top bar shows the live session summary: workspace, analyst name, AI on or off, AI allowance.

## What works
- Upload: real file input and drag-and-drop, validated on type (HTML, PDF, DOCX, JPG, PNG, TIFF), size (10 MB) and page count (30; known only for image sets). Several files are accepted only if they are all page images.
- Demo control (clearly marked, not product): simulates an accepted DOCX, an accepted 18-page scan, a wrong type, an oversized file and a 41-page scan. Errors say what is wrong, the limit, and that no AI call was spent.
- Law firm combobox: list only. Typing "HC LLP" resolves to Hartwell & Crane LLP; unknown text is refused and reverted with a message; "My firm is not listed" gives the no-firm state. With no firm, a warning says memory will not be applied. Keyboard: arrows, Enter, Escape.
- Fund and version are typeable; Start review validates (file, fund, privacy acceptance) with a linked summary.
- Samples: 12 HTML samples plus the 22-page scan set. Samples 3 to 6 are grouped as one Partners Group template family; each row shows firm, fund, version and a memory tag that changes with the workspace switch.
- Workspace switch (demo is read-only and seeded; sandbox starts empty), analyst chooser (with "Another name"), "Turn AI off for this session" switch.
- Privacy notice with a required acceptance, enforced before any upload or sample opens.
- Loading state names Reading, Structuring, Checks and AI review (OCR page counter for the scan; AI stage is skipped when AI is off or the daily limit is used; samples say "from cache, no allowance used"). It does not navigate; it ends with a link to the review-workspace mockup and a Back button. Uploads decrement the visible allowance.
- State (workspace, analyst, AI, privacy acceptance) persists in localStorage; every access is in try/catch and the page works fully with storage blocked.

## ACs shown
AC1 (types, metadata asked, clear errors), AC2 (firm, fund, version at upload), AC32 and AC33 (per-visitor and shared allowance visible), AC37 (limits stated, rejected before AI), AC38 (privacy notice, retention, third-party AI, memory contents, AI-off switch), AC41 (firm list with aliases, no free text, pre-tagged 3 to 6, no-firm message), AC56 (simulated analyst name on entry), AC57 (seeded read-only demo versus own sandbox).

## Checks
- Headless Chrome, normal and with localStorage throwing: 13 sample rows rendered, no uncaught errors; all flows above exercised by script. No horizontal overflow at 1024.
- `inspect.mjs` (offline): ignored as marketing-only: body-size (running text is 13px help text by design), focal-point, few-pictures, still-page, no-footage. Fixed: button shadow (selected-tab accent now a pseudo-element). Defended: the dashed border, which is a real drop zone.

## Open questions
1. The SPEC and context docs say 13 HTML samples; `samples/sub-docs/README.md` lists 12 `.htm` files (#1 to 8, 10 to 13) plus the scan set and a local-only ILPA PDF. The UI counts from data (12). Which is right?
2. Retention values (uploads 24 hours, sandbox memory 30 days) and the per-visitor limit (3 documents a day) are placeholders pending PLAN.
3. Does opening a sample count against the per-visitor AI limit? Mocked as no (cached results).
4. Should the privacy acceptance be remembered across visits (mocked: yes, in the browser)?
5. Selects and inputs are 16px, but body help text is 13px; fine for desktop-first.
