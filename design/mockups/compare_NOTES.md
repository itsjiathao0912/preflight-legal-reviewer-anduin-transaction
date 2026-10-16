# Compare mockup: design notes (trial)

File: `design/mockups/compare.html` (one file, inline CSS/JS, Google Fonts only). Same tokens, fonts, top bar, tabs (Compare active), icon-sprite style and tone-step language as `review-workspace.html`. All data is fictional (Hartwell & Crane LLP). Sibling-mode data is a seeded fixture, because the samples contain no true feeder pair.

## Layout
- Tabs read Review, Structure, Compare, Counsel sheet (Investor paths merged into Structure).
- One comparison bar (about 96px with the stats row): `[2024 template · Units wording] <swap> [2026 template · Shares wording]` on the left, a short `Versions | Siblings` toggle on the right. Version meta (firm, fund, upload date, sections) is in each picker's tooltip, not printed. No field labels; pickers carry aria-labels.
- One stats row, two groups split by a tone-step divider: Changes (0 added, 1 removed, 5 renamed, 3 changed) and Earlier findings (4 fixed, 3 still present, 1 new). Each stat is a filter chip with a selected state; a Clear link appears while a filter is on. Sibling mode swaps the groups to Clauses (common, differing, only in one) and Findings delta.
- Low-confidence item sits at the end of the list as a muted group, "Low confidence, not counted (1)".
- Default mode is always Versions on load (mode is no longer persisted; only the diff layout is).
- Left list 440px (360px at 1024); right is the clause diff, side by side or inline.

## Non-color signals
Added = underline plus "+" marker and screen-reader text "[added: ]". Removed = strikethrough plus "-" marker and "[removed: ]". Flagged = dotted underline. Every kind badge is icon plus words. The missing side shows "Not in {version}".

## What works
- Version scenario (2024 "Units" vs 2026 "Shares"): Appendix C removed (references 2 to 0); 5 renames with counts; Sales Load 3.5% Class A / 1.5% Class S; NTD and 3 placeholders removed; "Section list 1 to 12 and Parts A to D unchanged" (opens a comparison table); both swapped references shown as Fixed; findings delta 4 fixed / 3 still / 1 new.
- Low-confidence item: "LLC Agreement" kept 10 times, dashed badge, muted end group, "Low confidence, not asserted", excluded from totals, no finding raised, occurrence list per section.
- Swap reverses direction: ins/del flip, Removed becomes Added, Fixed becomes New. Picking the same document on both sides shows "No differences".
- Sibling mode: Onshore vs Offshore feeder, each clause labeled Common or Differing (or Only in one), findings delta (in both / only in one), Omnibus hint. Common clauses show identical text on both sides.
- `J` / `K` move through changes, `Esc` clears the filter. localStorage (mode, layout) is guarded; the page renders with storage disabled.

## ACs shown
AC15 (all listed drift items), AC16 (low confidence, labeled, not asserted), AC19 (added/removed/renamed/changed, findings delta fixed/still/new, sibling common vs differing, no-differences state). Also supports AC30 partly (focus ring, keyboard, non-color cues).

## Verification
Re-verified after the bar rebuild by script (CDP, with and without storage; a stale stored "sibling" mode was ignored): default Versions, swap reverses direction (Removed becomes Added), toggle to Siblings and back, a stat filter narrows the list and Clear restores it, no errors. Screenshots at 1440 and 1024 checked. Earlier: served over `python3 -m http.server`; headless Chrome loaded it normally and with `--disable-local-storage`: DOM populated both times, no Uncaught errors. `inspect.mjs` ran offline; its 5 FAILs (icon-cards, body-size, few-pictures, focal-point, still-page) and 1 WARN (no-footage) are marketing-page rules and were ignored. Looked at screenshots at 1440 and 1024.

## Open questions
1. "Fixed" for findings closed by an edit that is also listed as a change (NTD, Units): keep the duplicate row, or merge?
2. Should the swap button be allowed, or should direction always be older to newer?
3. Sibling findings delta only lists differing findings; "in both" is a count only. Enough?
4. Selects and small controls are 13 to 14px; raise under 900px in build.
5. Page numbers, upload dates, rule ids (DIFF-*, SIB-*) and the XREF-06 finding are placeholders.
