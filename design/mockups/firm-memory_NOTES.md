# Firm memory and audit trail mockup: design notes (trial)

File: `design/mockups/firm-memory.html` (one file, inline CSS/JS, Google Fonts only). Same tokens, fonts, icon style and top-bar pattern as `review-workspace.html`. All data is fictional (Hartwell & Crane LLP, Master Fund 2019, NGI 2024, invented analysts).

## Structure
- **Top bar:** brand, firm name, aliases, funds reviewed, "Back to review" (toast: separate mockup). Tabs: Decisions, Rules (pending-proposal badge), Audit trail.
- **Firm summary (all tabs):** counts (decisions, active rules, pending proposals; update live) and the value metric "55% less work: 6 of 11 findings already handled" with an 11-segment bar plus a text legend of what the other 5 are.
- **Footer (always visible):** data kept (snippets, hashes, metadata only; sensitive values masked) and retention.

## What works (revision 2: modal pattern, scannable Rules)
- **Modals:** one native `<dialog>` (`showModal`, `aria-modal`, dimmed backdrop, no shadow) for Reopen, Review suggested rule, Add rule, Edit rule and Deactivate rule. Focus moves into the dialog, Tab cycles inside it, Esc / Cancel / backdrop click close it, and focus returns to the opener (or the row if the opener is gone). Required reasons are refused with an inline message.
- **Decisions:** one 46px line per row (badge, one-line truncated snippet, class, fund, who, status). The chevron expands full snippet, reason or counsel answer, who/when and revoke details. "Reopen..." opens the modal, writes an audit entry, and the row stays as revoked (struck snippet).
- **Rules:** a compact suggestion strip ("1 suggested rule, from 3 dismissals with the same reason": one-line rule, "3 decisions" link, Review). Review shows the evidence, "No effect until approved", and Approve (note optional) / Reject (reason required). Active rules are a table (rule in sans, added by, date, "..." menu with Edit and Deactivate) with one muted line "AI context only, never a filter. This firm only." and an "Add rule" button that opens a modal. The "Closing Date, 2 of 3" counter-example is one muted line in the strip.
- **Audit trail:** unchanged, no edit or delete controls, one-line banner; new actions append rows tagged New.
- **Footer:** one muted line with an info icon; hover or focus shows what is kept and the 30-day retention.
- Serif is used only for quoted document text, the brand mark and summary headline numbers (same as the approved workspace).

## ACs shown
AC42 (full decision record, revoked not deleted), AC49 (decision details: reason, who, fund, when), AC50 (reopen with reason, kept as revoked, audited), AC51 (firm rules as AI context only, per firm), AC52 (firm page: decisions, rules, class filter, reopen), AC53 (proposal from 3 same-reason dismissals with evidence; 2 dismissals shows no proposal), AC54 (no effect until approved, approve audited, reject stays inactive), AC55 (append-only log with who, when, why, target), AC58 (data kept note, masked value, retention), AC59 (55% value metric).

## Verification
Headless Chrome with `--disable-local-storage`: page renders (11 rows), no uncaught errors. Scripted checks (CDP key events): modal opens with focus in the field; 12 Tab presses stay inside; Reopen with an empty reason is refused (dialog stays open, row not revoked, audit count unchanged); Esc closes and focus returns to the Reopen button; Reopen with a reason revokes the row and adds an audit entry; Reject without a reason is refused; Approve adds an active rule and clears the pending badge; Add rule with empty text is refused. Screenshots checked at 1440 and 1024 (Class column hides at 1024).

## Open questions
1. Retention is shown as "30 days (proposed default)". The SPEC leaves the number to PLAN.
2. The SPEC says Approve is audited but not whether a note is asked; the mockup offers an optional note. Reject requires a reason.
3. A rejected suggestion simply disappears from the strip; confirm whether it can be re-proposed after more dismissals.
4. The three alias strings are placeholders; the data model has a single `law_firm` string today.
5. Reopening a decision cannot be undone (append-only); the analyst would dismiss again, which writes a new decision.
