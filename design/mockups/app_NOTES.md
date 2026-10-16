# App shell, Findings and the five other screens: design notes (trial)

File: `design/mockups/app.html` (one file, about 254 KB, inline CSS/JS in one IIFE, Google Fonts only). Same :root tokens, icon sprite style, tone steps and 4px radius as `review-workspace.html`. **Type rule: Newsreader (serif) for document and quoted text and for headings (page titles, drawer, dialog and popover headings); Geist for all other UI text.** (Corrects the earlier note that said "document text only".) One very soft shadow only on popovers, the drawer and dialogs.

## Information architecture
- Left sidebar (232px, 56px icon rail when collapsed or below 1200px): brand, document switcher, groups in sentence case (Review: Findings, Counsel questions; Check: Structure, Compare versions; Firm: Hartwell & Crane memory, Documents), gate button, AI switch, analyst name.
- Hash routes: `#findings #counsel #structure #compare #memory #documents`. Sidebar items set the hash; back and forward work. Default on load is `#findings` unless a hash is present. The view is never stored.
- One shared state: `G` (AI on/off, workspace, privacy acceptance, open document) plus the findings array `F` and prior decisions `H`. The gate, the three sidebar counts and the document label are all derived from it, so a change on one screen shows everywhere.
- Native `<dialog>` is used for: counsel export preview, memory Reopen/Review/Add/Edit/Deactivate, privacy notice, upload. Findings keeps its own dismiss modal.

## Screens (page header pattern: title + one short count line, actions on the right)
- **Findings** (approved, behaviour unchanged). Additions: Detector (rule id or AI model) in the Filter menu; a counsel answer shows as an icon on its row. Seed change so the screens connect: F-02 is Accepted and F-03 is Needs counsel (header now reads "4 open · 3 block digitization").
- **Counsel questions.** Compact gate line (links into the sidebar gate popover). One row per question; expand for quote, A/B/C options, provenance, inline wording edit and Record answer. Questions are findings marked Needs counsel plus Accepted blocking findings. A clear A/B/C answer releases the gate for that finding; "unclear" and Accept alone do not. "Already answered (n) · Awaiting counsel (n)" is collapsed. Export DOCX opens a preview of unanswered New/Accepted questions only.
- **Structure.** Segmented sub-views (Sections, Cross-references, Conditions, Option groups, Defined terms, Investor types) with issue counts. Default "Issues only"; the "Show everything" button reveals full lists (and external citations and the optional flow diagram). Row detail opens in a right drawer. Investor types keeps type list + ordered path + inline gap row, Partnership or LLC pre-selected. Sidebar badge is now computed (13 issues: 4 references, 1 condition, 2 option cues, 5 terms, 1 investor gap); it was a hard-coded 9.
- **Compare versions.** One bar `[v1] ⇄ [v2]` + Versions | Siblings (Versions on every load), one row of stat chips as filters, change list left, diff right (side by side at 1280+, inline below). J/K and Esc keep working.
- **Hartwell & Crane memory.** Decisions | Rules | Audit trail as a segmented control in the header; "what memory keeps" is an info popover in the header. Single-line decision rows, one-row rule suggestion strip, append-only audit trail, native-dialog modals that refuse empty reasons.
- **Documents.** Recent documents plus samples grouped by family (Partners Group family #3 to #6 open by default; 12 HTML samples + the 22-page RW Holdings scan set). Upload opens a modal: drop zone, firm combobox with alias resolution (free text refused), fund, version label, privacy acceptance, error states, simulated files. Opening a document returns to Findings. The workspace switch (Demo read-only / My sandbox) is in the sidebar document switcher.

## Persistence (user-confirmed, SPEC AC5/AC38)
Persisted through guarded `try/catch` storage helpers: sidebar collapse, Findings filters (severity, class, status, sort, detector) and AI on/No AI. Never persisted: current view/route, selection, workspace, privacy acceptance, other screens' filters. Everything works with storage disabled.

## Density rules applied
Show what the analyst must act on; detail one click away (row expand, drawer, popover, dialog). At most one or two lines of muted help per screen. Dropped permanent paragraphs and panels (listed in the summary below).

## Dropped on purpose
Counsel: big gate panel (now one line). Structure: lead paragraphs, status chips on references, numbering-scope banner, "Applies to" column (now in drawer). Compare: J/K hint, Omnibus hint outside Siblings. Memory: stats cards, 55% metric panel and legend (now one muted line), footer retention text (now popover). Documents: right rail (workspace to sidebar; analyst chooser dropped, name stays in the sidebar), headline, two-tab panel, long privacy panel (notice in a dialog).

## Verified (headless Chrome, 1440 and 1024, normal and --disable-local-storage)
No uncaught errors on every route; each sidebar item renders its view; back/forward; recording a counsel answer lowers the gate count (3 to 2) and the Counsel badge; Structure Show everything raises rows 4 to 31; Compare default is Versions; Memory Reopen refuses without a reason and then writes an audit entry; Upload modal opens, rejects free text ("Acme Legal Partners"), resolves "HC LLP"; filters and AI mode survive a reload while the route does not; no horizontal overflow.

## Decisions made on the user's behalf (2026-10-17)
1. **Gate follows SPEC AC22.** Critical Awaiting-counsel prior items count as unresolved. "Eligible Investor is defined twice" (asked in Master Fund 2019) is the 4th reason, so the sidebar reads "Blocked · 4". The gate popover labels it "Awaiting counsel (asked in Master Fund 2019)" and links to it in Counsel questions. Recording a clear answer there drops the gate to 3; "unclear" keeps it. The Findings header ("N block digitization") now uses the same gate total.
2. **Structure issue** = any row a deterministic rule flags (warning state): suspicious or unresolved reference, condition with an unclear target, option group with an inferred cue, term that is undefined, used early or defined twice, and an investor-type gap. The badge is computed from the data (13).
3. **Compare "Needs counsel"** creates a counsel question like Findings does: existing drift findings (F-01 to F-07) are set to Needs counsel; other drift items create a "Version drift" finding. The Counsel badge and the gate update; toggling again removes it.
4. **Findings always shows the NGI 2024 example** (mockup limit). Opening a sample or upload only relabels the open document.
5. **Placeholders are acceptable** (see below).
6. Earlier seed change: F-02 is Accepted and F-03 is Needs counsel, so Counsel questions has content (Findings header: "4 open · 4 block digitization").

## Placeholders
Retention periods (24 hours uploads, 30 days sandbox memory), daily AI limits (3 per visitor, 50 shared), firm aliases and the Brightwater Law LLP firm, counsel name "R. Whitlock", analyst "Linh Tran", page numbers, upload dates and rule ids (DIFF-*, SIB-*, XREF-06), the invented content for Sections 7 and 10 and Parts C/D.

## Verified again after these decisions (normal and --disable-local-storage)
No uncaught errors on every route; gate starts at 4 and drops by one when the awaiting item is answered; Compare Needs counsel raises the Counsel badge; all earlier checks pass (persistence check is expected to fail only when storage is disabled).
