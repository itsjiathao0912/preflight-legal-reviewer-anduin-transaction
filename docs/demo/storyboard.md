# Demo storyboard

Shot table for the video in [script.md](script.md). Screenshots are captured later and saved to `docs/demo/img/`
under the planned filenames below. Base URL: https://preflight-legal-reviewer.giathaowork.workers.dev

Route note: Firm memory is reached through the sidebar nav. A direct `#memory` link lands on Findings on first load
(the route is never persisted), so do not open it by URL.

| Shot | URL / state | Action | Caption | Duration | Planned image |
|---|---|---|---|---|---|
| 1 | `/` title card (slide 1 of slides.html) | Hold | "Review a fund sub doc before it is digitized" | 0:20 | `img/01-title.png` |
| 2 | `/` first load, Findings, no document | Show shell and doc switcher | "A calm analyst workspace" | 0:20 | `img/02-shell.png` |
| 3 | `#findings`, sample 5 open | Scroll the document, click a highlight | "Document left, findings right" | 0:25 | `img/03-findings.png` |
| 4 | `#findings`, one row expanded | Expand a broken cross-reference | "Every finding cites its evidence and rule" | 0:15 | `img/04-finding-expanded.png` |
| 5 | Dismiss modal | Press Dismiss, pick a reason, save, show undo toast | "Dismissals need a reason and can be undone" | 0:20 | `img/05-dismiss.png` |
| 6 | Stage status popover | Open the stage button | "Checks done, AI review state shown" | 0:15 | `img/06-stage.png` |
| 7 | AI toggle | Switch AI off, then on | "Rules, memory and the gate work without AI" | 0:20 | `img/07-ai-toggle.png` |
| 8 | `#compare`, 5 against 6 | Pick both versions | "Drift between versions, with a short narrative" | 0:35 | `img/08-compare.png` |
| 9 | `#counsel` | Show the question list, press Export DOCX | "Confirmed issues become a counsel query sheet" | 0:20 | `img/09-counsel.png` |
| 10 | Gate popover ("Blocked · N") | Answer one question, watch the count | "Digitization stays blocked until answered" | 0:20 | `img/10-gate.png` |
| 11 | `#structure`, Investor types sub-view | Switch between tree, graph and paths | "Structure and investor-type paths" | 0:25 | `img/11-structure.png` |
| 12 | Logic outline export | Click export | "Logic outline as JSON" | 0:10 | `img/12-outline.png` |
| 13 | Sidebar then Firm memory | Click the memory nav item (not a URL) | "Firm memory proposes rules after three matches" | 0:25 | `img/13-memory.png` |
| 14 | Memory audit list | Scroll the audit trail | "Every decision is in the audit trail" | 0:10 | `img/14-audit.png` |
| 15 | `docs/` README known-misses section, or slide 11 | Hold | "What it does not do yet" | 0:20 | `img/15-known-misses.png` |
| 16 | Closing slide | Hold | "Free models, free tier, browser-side parsing" | 0:15 | `img/16-close.png` |

Capture status (17-10-26, live version 23612b12, read-only run: AI, OCR and session requests aborted, 1440x900): 14 of 16 captured. Shots 3-12 come from the live site on sample 5 (PG NGI 2024) except shot 5 (sample 1, no firm). Shots 1, 15 and 16 are slides 1, 13 and 14 of slides.html. Live-state notes: AI review shows "skipped" and memory shows "unavailable" because the run had no Turnstile session; shot 7 shows AI off; shot 9 has one question marked from Findings; shot 10 shows the clear gate ("Ready to digitize") because sample 5 has no blocking item without memory; shot 12 shows the Cross-references lens with the Export logic outline button. Capture manually: shots 13 and 14 (`img/13-memory.png`, `img/14-audit.png`) - firm memory and its audit list need a Turnstile-verified session, which automated Chromium cannot obtain. A human can also re-take 8 with the AI narrative and 10 with a "Blocked · N" gate.

Total about 4:35. Capture at 1440x900; also keep a 1024 px set only if a shot looks cramped.
