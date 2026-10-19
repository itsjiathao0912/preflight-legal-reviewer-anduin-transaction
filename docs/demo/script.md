# Demo video script

About 3:30, in four parts: today's workflow → the analyst's pain → my solution → live demo.
Demo input: **package 01, Northgate Infrastructure Fund III** (fictional, law firm Hartwell & Crane LLP; [answer key](../../samples/packages/01-northgate-infrastructure-iii/answer-key.md)).
Live site: https://preflight-legal-reviewer.giathaowork.workers.dev

**Before recording:** use a normal browser at 1440 px, pass the Turnstile check once (sharing needs a verified session), click **Start fresh** in the sidebar footer (confirm **Start fresh**) so the workspace is empty, then set the sidebar switch to **No AI**. Open a second browser window (a private window works) for the counsel view. Rehearse once.

## Part 1. Today's workflow (0:00-0:30)

On screen: the pitch deck, Context slide (the 7-step fund timeline).

> "When a fund raises money on Anduin, its law firm drafts the subscription document. A Digitization Service Analyst at Anduin turns that document into an online form: every question, every investor type, every 'if you are X, skip to section Y'. The GP approves the form, investors fill it in and sign, and the fund admin reviews their files.
>
> So the analyst sits at the hand-off point. Whatever is in the document, good or bad, goes into the form logic, and then into every investor's form."

## Part 2. The pain (0:30-1:05)

On screen: Problem slide (what breaks a digital form), then the problem statement slide.

> "The analyst reads fifteen to sixty pages by hand, for every fund and every new version. The defects that hurt are not spelling mistakes. They are a reference to a section that doesn't exist, a skip that jumps the wrong way, an investor type with no path through the form, a term nobody defined.
>
> And even when the analyst spots one, they can't settle it. They don't know what the drafter intended, and they don't have the authority to choose a reading for counsel. So the questions go out in scattered emails, the answers are forgotten, and the next fund from the same law firm raises the same questions again."

## Part 3. My solution (1:05-1:40)

On screen: Solution slide (the review loop and gate states).

> "Preflight is a review step before digitization, built for the analyst. It reads the whole fund package into a logic graph and runs deterministic checks: cross-references, conditional skips, defined terms. AI is used only to judge a few passages, and it never blocks anything on its own.
>
> Every finding quotes the text it is about. The analyst asks the right person, or closes the issue with a reason. A gate keeps the form build blocked until the blocking questions are answered, and counsel can answer through a shared link. The next fund is compared with the last one, so the analyst only reviews what changed."

## Part 4. Demo (1:40-3:30)

| Time | On screen | Narration |
|---|---|---|
| 1:40-2:00 | Sidebar **Open a document** → **Or try a demo package** → **Northgate Capital III**. In the table: 01 **To digitize**, 04 **Baseline (earlier version)**, tick **Confirmed** on each row, version `v1` (pre-filled), **Run checks**. | "Here is a fund package: the sub agreement, the LPA, the PPM and last year's Fund II agreement. Preflight proposes each file's role. Two files are both sub agreements, so it asks me instead of guessing." |
| 2:00-2:25 | Findings: the Annex F row is first (the document scrolls to it). **Ask counsel**. Click the `[insert Final Closing Date]` row → **Close issue** → pick a reason → **Close issue**. Point at the gate pill. | "Section 9 says 'complete Annex F', and there is no Annex F in the package. That breaks a branch of the form. I ask counsel. This placeholder I close with a reason. The gate reads Blocked, 10: this missing annex plus nine changes against Fund II." |
| 2:25-3:00 | Click **Share with counsel** (toast: link copied). Switch to the second window, paste the link: **Open the shared review** → type a name → **Open review**. Counsel sees Findings only. Open Annex F → **Answer** → option B → **Save answer**. Switch back as analyst: the counsel name appears next to the share button (it refreshes about every 20 s), **Questions** shows the answer, the gate count drops from 10 to 9. | "To get the answer, I share the review with counsel. One link, no account. Counsel opens the same document, sees my question, and answers. Back on my side, I see who joined, the question is resolved, and the gate moves. Nobody had to write an email." |
| 3:00-3:15 | Segment **Changes** (vs Fund II): point at one row and its owner chip (Counsel, GP, Fund admin). | "Against Fund II there are dozens of raw edits. Preflight hides the cosmetic ones and shows the nine that change the form, each with who must confirm it." |
| 3:15-3:30 | **Questions**: group **For the GP** (7 missing documents), then the gate pill. | "The GP gets one request listing every missing document, each with the sentence that mentions it. The form build waits until the blocking items are answered. Catch it once in the template, not in every investor's form. Thank you." |

Optional extra beat if time allows (cut by default): **Structure** has three tabs (Sections, Logic, Terms & package); one line: "Everything the checks read is visible here." Do not describe investor-type paths.

**Do not claim on camera:**
- How Anduin works internally is my reading of public material; say "as I understand it" if asked.
- Measured live on package 01 (No AI): 16 findings, 7 under **Errors** and 9 under **Changes**. The gate pill reads **Blocked · 10** (Annex F + the 9 changes). The answer key lists 7 variance items; the app shows 9, so say "nine", not "seven".
- The 7 errors are the answer key's D1-D6 and D10. The "Eligible Transferee Certificate" and the $2.5M vs $5M minimum are still missed.
- Coverage reads "partial: 3 terms unverified, 18 references not in the package". The GP request lists 7 documents.
- **Mark ready to digitize** stays disabled until the gate count is 0. Do not show it unless every item (including the 9 changes) was answered first.
- The Share with counsel flow (link, counsel answer, who joined, gate drop) was not run end to end for this script: it needs a Turnstile-verified session, which headless runs cannot get. Rehearse it once in a real browser before recording, and if any step differs, narrate what you see.
