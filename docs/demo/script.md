# Demo video script

Target length: about 5 minutes (range 4 to 6). Voice: calm, first person, plain English.
Demo input: **package 01, Northgate Infrastructure Fund III** (fictional, law firm Hartwell & Crane LLP). Files: [samples/packages/01-northgate-infrastructure-iii](../../samples/packages/01-northgate-infrastructure-iii/README.md); what each check should find: its [answer key](../../samples/packages/01-northgate-infrastructure-iii/answer-key.md).
Live site: https://aduin-transaction-web.giathaowork.workers.dev (version `493f2501`, Findings v2 on top of Variance; updated 19 Oct 2026).

## Before recording

- Use a normal browser at 1440 px wide, not an automated one. Open the site once and pass the Turnstile check ("Verify you are human"): firm memory and Variance need it.
- Set the sidebar switch to **No AI**. Nothing in this script calls a model.
- Rehearse once, then reload. The package is kept in the browser for 24 hours, so a rehearsal leaves a restorable copy under **Recent packages**. For a clean take, open it again from **Demo packages**.
- Check three numbers during the rehearsal and say what you actually see:
  - the gate count (expected **Blocked · 1** from the Annex F finding);
  - the Coverage line;
  - the Changes count (expected **9 rows**, 2 new and 7 logic; see "Known differences").

## Script

| Time | Segment | On screen | Narration |
|---|---|---|---|
| 0:00-0:25 | Problem | Title, then the empty app | "Before Anduin turns a fund's subscription document into an online form, an analyst reads it for anything that would break the form: references that point nowhere, skips that jump the wrong way, terms nobody defined. It is forty pages, for every fund and every version, by hand. Preflight does that pass first and shows its evidence." |
| 0:25-1:00 | Open the package | Doc switcher → **Open another document…** → **Demo packages** → **Northgate Capital III**. The **Confirm the package** table appears. | "A fund arrives as a package: the sub agreement, the LPA, the PPM, last year's Fund II agreement, an admin checklist and a GP email. Preflight reads each file and proposes a type and a role, with the reason. Two files are both subscription agreements, so it marks them Low and asks me. It does not guess." |
| 1:00-1:20 | Confirm | Row 01: Role **To digitize**. Row 04: Role **Baseline (earlier version)**. Tick **Confirmed** on both. Version label `v1`. **Run checks**. | "01 is the one I digitize; 04, Fund II from the same law firm, is the baseline. Run checks stays disabled until every unsure row is confirmed, and it says why." |
| 1:20-2:05 | Findings | Findings opens. Point at the header: findings count, the **Coverage** line, the gate pill. Click the first row; the document scrolls and flashes the passage. Press **J** to move down. | "Seven findings, every one a deterministic rule, and each one quotes the text. This one: Section 9.1 says 'complete Annex F', and there is no Annex F, in this file or anywhere in the package. That is critical, because it breaks a branch of the form, so the gate says Blocked. The Coverage line is honest about what could not be checked: the tax forms are not in the package." |
| 2:05-2:40 | Triage | On the Annex F row: **Ask counsel**. The toast shows the outcome (with Undo); the next row opens. On the placeholder row "[insert Final Closing Date]": **Close issue** → reason "Real issue — I'll handle it in the form build" → Save. | "Two buttons. Ask counsel turns it into a cited question for counsel. Close issue needs a reason, and the reason is remembered for this law firm. The toast tells me what changed: the question count, and whether the gate is still blocked." |
| 2:40-3:05 | Zoom and layout | Drag the panel edge wider, then narrower. Use **−** / **+**, then **Fit width**. | "The panel resizes, and the document fits the space that is left. The text never shrinks below a readable size; the page reflows instead." |
| 3:05-3:40 | Package lens | Sidebar → **Structure** → lens **Package**. Show **External references** (LPA and PPM resolved; Annex F and the Kestrel Side Letter "Not in package") and **Terms from other documents** ("Defined in LPA"). | "References to other documents are resolved against the package. Terms the LPA defines, like Capital Commitment and Defaulting Partner, are not flagged as undefined. They are marked 'Defined in LPA', so there are no false alarms." |
| 3:40-4:15 | Changes vs Fund II | Back to **Findings** → segment **Changes** (baseline: Fund II, same firm). Scroll the change rows; point at an impact line and an owner chip. | "Law firms reuse templates, so most of Fund III is already known. Against Fund II there are hundreds of raw text changes. Preflight hides the cosmetic ones and shows the few that change the form: a new Source of Funds section, a new Singapore row, a beneficial-owner question that now applies only to non-US entities. Each change says which investors it affects and who must confirm it." |
| 4:15-4:45 | Questions | Sidebar → **Questions**. Tabs **Counsel / GP / Fund admin**; open the group **For the GP** (7 missing documents). **Export request DOCX**. | "Questions are grouped by who answers them. Counsel gets the Annex F question with its quote and readings. The GP gets one request for every missing document, seven here, from the side letter to the W-8 forms, each with the sentence that mentions it. One Word file per owner." |
| 4:45-5:05 | Gate and memory | Click the gate pill: the reasons list. Optional: sidebar → the firm memory item (it carries the firm's name) → Decisions / Audit trail. | "The gate stays Blocked until counsel answers what blocks. Answers and closed issues are saved for this law firm, so on Fund IV the same question is not asked again, and every decision is in the audit trail." |
| 5:05-5:30 | Limits and close | README, Known limits | "What it does not do yet: one undefined form name and a stale minimum across documents are still missed, live AI quality is not proven at scale, and there is no CI. The list is in the README. Rules run in the browser, on free models and Cloudflare's free tier. Catch it once in the template, not in every investor's form. Thank you." |

Total about 5:30 at 150 words per minute. If over 6:00, cut the zoom segment first, then the memory part of "Gate and memory".

## Known differences to expect (do not claim otherwise on camera)

- **Changes count:** package 01 shows **9** change rows (2 new and 7 logic). The answer key expects 7 (3 new and 4 logic), because the engine counts digit changes in operative text as logic. Say "a handful", or say the number you see.
- **Owner of the trust-split change (V7):** the app routes it to the GP; the answer key says Counsel.
- **Not caught:** D7 "Eligible Transferee Certificate" (an undefined form name) and D9 (the $2,500,000 vs $5,000,000 minimum across documents).
- **Unverified on the live site:** the exact gate count for this package and the downloaded request file name. Check them in the rehearsal.
- **Live R-01 regression write path:** not shown in this script; it needs a human Turnstile session and has not been run on the live site.

## Fallbacks

- If memory shows "Memory unavailable", reload and pass the Turnstile check again; the findings themselves never wait for memory.
- If the live site is down, use the screenshots in `docs/demo/img/` and the pitch deck.
