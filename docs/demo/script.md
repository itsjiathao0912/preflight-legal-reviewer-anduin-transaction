# Demo video script

About 4 minutes, in four parts: today's workflow → the analyst's pain → my solution → live demo.
Demo input: **package 01, Northgate Infrastructure Fund III** (fictional, law firm Hartwell & Crane LLP; [answer key](../../samples/packages/01-northgate-infrastructure-iii/answer-key.md)).
Live site: https://preflight-legal-reviewer.giathaowork.workers.dev

**Before recording:** use a normal browser at 1440 px, pass the Turnstile check once, set the sidebar switch to **No AI**, and rehearse once to see the real gate count and Changes count.

## Part 1. Today's workflow (0:00-0:40)

On screen: the pitch deck, Context slide (the 7-step fund timeline).

> "When a fund raises money on Anduin, its law firm drafts the subscription document. A Digitization Service Analyst at Anduin turns that document into an online form: every question, every investor type, every 'if you are X, skip to section Y'. The GP approves the form, investors fill it in and sign, and the fund admin reviews their files.
>
> So the analyst sits at the hand-off point. Whatever is in the document, good or bad, goes into the form logic, and then into every investor's form."

## Part 2. The pain (0:40-1:20)

On screen: Problem slide (what breaks a digital form), then the problem statement slide.

> "The analyst reads fifteen to sixty pages by hand, for every fund and every new version. The defects that hurt are not spelling mistakes. They are a reference to a section that doesn't exist, a skip that jumps the wrong way, an investor type with no path through the form, a term nobody defined.
>
> And even when the analyst spots one, they can't settle it. They don't know what the drafter intended, they don't have the authority to choose a reading for counsel, and they don't see the side letters or the GP's emails. So the questions go out in scattered emails, the answers are forgotten, and the next fund from the same law firm raises the same questions again. A defect missed here comes back later as a rebuilt form, a form sent back by the GP, or an investor stuck halfway."

## Part 3. My solution (1:20-2:00)

On screen: Solution slide (the review loop and gate states).

> "Preflight is a review step before digitization, built for the analyst. It reads the whole fund package into a logic graph and runs deterministic checks: cross-references, conditional skips, investor paths, defined terms. AI is used only to judge a few passages, like ambiguity or a contradiction, and it never blocks anything on its own.
>
> Every finding quotes the text it is about. The analyst either asks the right person, counsel, the GP or the fund admin, or closes the issue with a reason. A gate keeps the form build blocked until the blocking questions are answered. Answers are remembered per law firm, and the next fund is compared with the last one, so the analyst only reviews what actually changed."

## Part 4. Demo (2:00-4:00)

| Time | On screen | Narration |
|---|---|---|
| 2:00-2:25 | **Open a document → Demo packages → Northgate Capital III**. In the table: 01 **To digitize**, 04 **Baseline**, tick **Confirmed**, version `v1`, **Run checks**. | "Here is a fund package: the sub agreement, the LPA, the PPM and last year's Fund II agreement. Preflight proposes each file's role. Two files are both sub agreements, so it asks me instead of guessing." |
| 2:25-3:00 | Findings: click the Annex F row (the document scrolls to it). **Ask counsel**. On the placeholder row: **Close issue** → reason → Save. | "Section 9.1 says 'complete Annex F', and there is no Annex F anywhere in the package. That breaks a branch of the form, so the gate is blocked. I send it to counsel. This placeholder I close with a reason, and that is remembered for this law firm." |
| 3:00-3:25 | Segment **Changes** (vs Fund II): point at one impact line and its owner chip. | "Against Fund II there are hundreds of raw edits. Preflight hides the cosmetic ones and shows the few that change the form, which investors they affect, and who must confirm each." |
| 3:25-3:45 | **Questions**: tabs Counsel / GP / Fund admin, group **For the GP** (7 missing documents), **Export request DOCX**. | "Questions are grouped by who answers them. The GP gets one request listing every missing document, each with the sentence that mentions it." |
| 3:45-4:00 | Click the gate pill. | "The form build waits until counsel answers. Catch it once in the template, not in every investor's form. Thank you." |

**Do not claim on camera:**
- How Anduin works internally is my reading of public material; say "as I understand it" if asked.
- Package 01 shows 9 change rows, not the answer key's 7. Say "a few", or the number you see.
- The "Eligible Transferee Certificate" and the $2.5M vs $5M minimum are still missed.
- The live gate count for this package is unverified; say what you see.
