# Demo video script

Target length: about 4 minutes 15 seconds (range 3 to 5). Voice: calm, first person, plain English.
Screen: the live site, 1440 px wide. Screenshots in `docs/demo/img/` are fallbacks (see storyboard).

Notes for the recorder:
- Firm memory is reached through the sidebar nav. A direct `#memory` link lands on Findings on first load by design.
- Use sample 5 and sample 6 (Partners Group NGI 2024 and 2026). Samples use precomputed AI, so no wait.
- D1 and the Turnstile widget are live (version 67c796ff). A human must pass the Turnstile check for the memory and upload segments.

| Time | Segment | Narration |
|---|---|---|
| 0:00-0:20 | Problem | "Before Anduin digitizes a fund subscription document, an analyst has to find the errors that would break the online form: references that point nowhere, skips that jump the wrong way, sections no investor can reach. Reading forty pages by hand, for every version, is slow." |
| 0:20-0:40 | What it is | "This is a review tool for exactly that step. It reads the document into a logic graph, checks it with deterministic rules, and uses a language model only to judge a few passages. Everything it flags shows its evidence." |
| 0:40-1:20 | Findings | "I open sample 5. The document is on the left, findings on the right. Each row says which rule fired, or which model, and quotes the text. Severity is an icon and a word, never just a color. I expand one: a broken cross-reference, with what the text says and what was expected." |
| 1:20-1:50 | Triage | "Triage works from the keyboard. Accept, dismiss with a required reason, or send to counsel. Dismissals are remembered, and a blocking finding is never hidden by a remembered decision." |
| 1:50-2:25 | AI lane | "The AI lane is labeled and pending until it finishes. Here the results are precomputed, so nothing is sent anywhere. Turn AI off and the rules, memory and gate still work. If a visitor limit or the daily cap is hit, a banner says why." |
| 2:25-3:00 | Compare | "Compare sample 5 with sample 6. The tool lines up sections and shows drift: what changed, whether the meaning changed, plus a short narrative. Diff-only rows are shown but do not become counsel questions yet." |
| 3:00-3:35 | Counsel and gate | "Confirmed items become counsel questions. I export the sheet as a Word document. The gate pill at the bottom says Blocked until every blocking question has an answer. I record an answer and watch the count drop." |
| 3:35-3:55 | Structure | "Structure shows the section tree, the cross-reference graph and the investor-type paths. The logic outline exports as JSON for whoever builds the digital form." |
| 3:55-4:15 | Memory | "Firm memory is under the firm group in the sidebar. After three matching dismissals it proposes a rule for the firm, and every change is in the audit trail." |
| 4:15-4:35 | Honesty and close | "What it does not do yet: edit finding text, compare scanned documents, or catch every statutory citation. The list is in the README. It runs on free models and Cloudflare's free tier, with documents parsed in the browser. Thank you." |

Total about 4:35 at 150 words per minute; trim the Structure and Memory segments first if over 5:00.
