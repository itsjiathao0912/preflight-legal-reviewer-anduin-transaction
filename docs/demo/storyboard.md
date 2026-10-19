# Demo storyboard

Shot table for the video in [script.md](script.md) (about 3:30). Base URL: https://preflight-legal-reviewer.giathaowork.workers.dev
Capture at 1440x900. Record in a real browser: sharing, memory and the counsel view need a Turnstile-verified session, which automated Chromium cannot obtain. Before shot 4, click **Start fresh** (sidebar footer) for an empty workspace, then switch the sidebar to **No AI**.

Route note: Firm memory and Questions are reached through the sidebar nav, not by URL.

| Shot | URL / state | Action | Caption | Duration | Image |
|---|---|---|---|---|---|
| 1 | Pitch deck, Context slide (slides.html) | Hold | "Review a fund sub doc before it is digitized" | 0:30 | `img/01-title.png` (slide 1; swap in Context slide if wanted) |
| 2 | Problem and problem-statement slides | Hold | "What breaks a digital form" | 0:35 | fresh capture from slides.html |
| 3 | Solution slide | Hold | "Review loop, gate, counsel link" | 0:35 | fresh capture from slides.html |
| 4 | `/`, Open a document modal, **Or try a demo package** expanded | Pick **Northgate Capital III** | "Start from a demo package" | 0:10 | `img/demo-open-demo-packages.png` (matches live) |
| 5 | Confirm the package table | 01 **To digitize**, 04 **Baseline (earlier version)**, tick **Confirmed**, `v1`, **Run checks** | "Preflight proposes roles; the analyst confirms" | 0:10 | `img/demo-package-confirm.png` (matches live; 01 and 04 still show To digitize in the proposal, set 04 to Baseline on camera) |
| 6 | Findings, Annex F row selected | **Ask counsel**; then placeholder row, **Close issue**, reason, **Close issue** | "Ask the owner, or close with a reason" | 0:25 | `img/demo-findings-ask-counsel.png` (matches live, before the click) |
| 7 | Gate popover, **Blocked · 10** | Click the gate pill | "Annex F plus nine changes block the build" | 0:05 | `img/demo-gate-blocked.png` |
| 8 | Findings, **Share with counsel** | Click; toast "Link copied" | "One link, no account" | 0:10 | fresh capture (needs verified session) |
| 9 | Second window, pasted link, **Open the shared review** | Enter a name, **Open review** | "Counsel joins by name" | 0:10 | fresh capture (needs verified session) |
| 10 | Counsel window, Findings only, Annex F row | **Answer**, option B, **Save answer** (comment box: "Add a comment", **Post comment**) | "Counsel answers in the document" | 0:15 | fresh capture (needs verified session) |
| 11 | Analyst window | Counsel name chip next to the share button (refreshes about 20 s), **Questions** shows the answer, gate 10 to 9 | "Who joined, answer in, gate moves" | 0:15 | fresh capture (needs verified session) |
| 12 | Findings, segment **Changes** | Point at one row and its owner chip | "Nine changes vs Fund II, each with an owner" | 0:15 | `img/08-compare.png` shows an older Compare view; re-capture Findings with Changes segment |
| 13 | **Questions**, group **For the GP** (7) | Scroll the list, hold on the gate pill | "One request for every missing document" | 0:15 | `img/demo-questions.png` (matches live, Annex F question asked) |

Old shots dropped to fit 3:30: dismiss modal, stage popover, AI toggle, Structure sub-views, logic outline export, Firm memory and audit list, known-misses slide, closing slide. Their images in `img/` (03-12, 15, 16) remain valid for the README and deck. If a Structure beat is wanted (it now has three tabs: Sections, Logic, Terms & package), use one line and a fresh capture.

Captured 19-10-26 on the live site with headless Chromium (AI, OCR requests aborted, no Turnstile session): shots 4, 5, 6, 7 and 13 are real captures of the current UI; the banner "Memory unavailable" visible in them is an artifact of the missing session, so re-take them in a real browser for the final cut. Shots 8-11 and 12 need a human.

Total about 3:30.
