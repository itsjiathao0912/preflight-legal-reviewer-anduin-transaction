# Review workspace mockup: design notes (trial)

File: `design/mockups/review-workspace.html` (open directly in a browser; one file, inline CSS/JS, Google Fonts only).
Status: design trial for approval, not production code. All data is invented in the style of samples #3/#5.

## Visual direction
- **Idea:** a calm reading room, not a dashboard. The document is the hero (a paper page in a serif); findings are a quiet, filled list beside it.
- **Palette:** cool low-chroma stone ground (#E9ECE9) with panels one tone step lighter. One accent only: deep teal (#1D5C57) for selection, focus, counts. Severity colors are desaturated tints with dark text, always paired with an icon and words.
- **Type:** Newsreader (serif) for the document and quoted evidence; Geist for UI, with tabular figures. Five working sizes (13 / 14 / 16 / 20 / 28). No monospace, no tracked uppercase labels.
- **Structure:** separation by tone steps and space, not outlined boxes or hairlines. Radius is 4px everywhere; only the gate pill is fully round. No gradients, no card shadows (one soft shadow on the floating gate popover only).
- **Layout:** top bar (document, law firm, fund, version, AI-mode demo switch, gate pill), tabs, stage stepper with allowance, then split view: section outline + reading page on the left, 448px findings panel on the right (400px at 1024, where the outline rail hides).

## What works (click through it)
- Click a finding card or a highlighted passage: the card opens, the quote is highlighted and scrolled into view. `J` / `K` move through findings.
- Severity chips, class / status / sort selects update counts and the list live; filter state persists across reload.
- Accept, Needs counsel toggle; Dismiss opens an inline reason picker (4 fixed reasons plus optional note). Saving without a reason is refused with a message. Undo toast on every change.
- Gate pill shows "Blocked — N reasons"; opening it lists reasons that jump to the item. Dismissing blocking items live-updates it to "Ready to digitize".
- "No AI" switch (top right) shows the degraded state: banner with reason and what is skipped, AI stage "Skipped", allowance 0 of 50, the cached AI finding stays and says so.
- Previously handled (3) collapses and expands, shows reason / prior answer / who / fund / when, with Reopen (moves out of memory as New, never deleted).
- Routing number is masked in both document and finding, with a Reveal control. Other tabs show a "separate mockup" toast.

## ACs shown
AC3 (stages, AI review pending, partial AI), AC4 (highlight and scroll), AC5 (filter/sort/counts, persists), AC6 (dismiss needs reason, undo), AC7 (class, severity, quote and location, provenance, confidence, interpretations on AI item), AC9 (expected vs found plus rule facts), AC10 (NTD, masked routing number with reveal), AC22 (strict gate with linked reasons), AC25 (No-AI state), AC35 (banner naming reason and what is skipped; auto-resume note), AC36 (rule id vs model plus fresh/cache), AC43 (New / re-confirm labels), AC48 (blocking dismissed item stays in main list, counts as unresolved until re-confirmed), AC49 (Previously handled count, collapsible, details), AC33 (allowance visible). AC30 partly: visible focus ring, keyboard operation, non-color severity cues, `prefers-reduced-motion` honored; contrast chosen to AA but not formally audited.

## Taste-skill checks applied
- Minimalist skill: no Inter/Roboto, no heavy shadows, no gradients, no emoji, no pure black, custom SVG icon sprite (no Lucide), realistic content, plain copy.
- Tells registry (checklist only): removed monospace labels, index numbering, eyebrows, hairline-boxed tiles, gradients, glass, shadows; avoided cream + terracotta (swapped the warm bone ground for a cool stone and a near-white paper). `inspect.mjs` ran offline: gradient, shadow, small-text, and cream findings were fixed. Four findings remain by design because they are marketing-page rules that do not fit an app screen: focal-point, few-pictures, still-page, and icon-cards (the findings list is a real list of 7 items).
- Judgment call: the minimalist skill's 1px borders and pill tags conflict with the tells registry, so tone steps won; tags are 3px-radius.

## Open questions
1. Should "Accept" on a blocking item keep it blocking until counsel answers (as mocked), or does Accept mean "will fix in source"?
2. Is "Fix first" the right short label for the middle severity (full name: "Fix before build")?
3. Keep the outline rail with blocking counts, or give the width back to the page?
4. Selects are 13px, below the 16px mobile no-zoom rule; fine for desktop-first, to be raised under 900px in build.
5. Law firm name (Hartwell & Crane LLP (fictional)), people and dates are placeholders, not from the samples.
6. Finding F-02 (Section 11 vs 12) really comes from sample #1 and F-04 from #11; they are placed in one fictional document for the demo.
