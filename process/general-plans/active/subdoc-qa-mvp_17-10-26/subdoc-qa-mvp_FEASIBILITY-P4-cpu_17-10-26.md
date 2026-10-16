---
slug: subdoc-qa-mvp
date: 2026-10-17
verdict: NOT-VIABLE
originating-phase: spec
---

# Feasibility P4 - Server-side parsing CPU vs Workers Free 10 ms (subdoc-qa-mvp)

**TL;DR:** NOT-VIABLE. Extracting text from the 25-page sample PDF costs about 90 ms of CPU even when warm (about 390 ms on a cold start), roughly 9x to 39x the 10 ms Workers Free limit. The largest HTML sample (380 KB) costs 5 to 35 ms for just a *text strip or SAX-level parse*, before any structure rules or checks run. Parsing must be client-side (browser). Small server-side work (hashing, JSON validation, cache lookup) fits easily (under 0.3 ms each).

### Hypothesis
P4: "Server-side document parsing can run inside Cloudflare Workers FREE limits (10 ms CPU per request, 128 MB, 1 s startup, 64 MiB bundle)"; complement: "therefore parsing must run in the browser."

### Mechanism Under Test
CPU cost of `unpdf` (serverless pdf.js build) text extraction on a real PDF, and of HTML text/structure extraction (regex strip, `htmlparser2`, `linkedom`) on the largest and smallest HTML samples, measured as process CPU (user + system) in Node, used as a proxy for a Workers V8 isolate request.

### Probe Family
1 - Local process / Node script (the "8 - Cloudflare worker runtime" family was considered and not used; see Probe Cost Class).

### Probe Cost Class
**cheap-local** (actual). The SPEC listed P4 as `needs-cf`. Safety gate: none required for cheap-local; no Cloudflare account, no network LLM calls, no deploys, no repo files modified. The Cloudflare-runtime run (`wrangler dev`) was deliberately skipped (see Method step 5), so the verdict rests on a Node proxy, with the assumption stated below.

### Probe Method
Disposable dir: `/private/tmp/claude-501/-Users-itsjiathao--Skylab-itsjiathao-aduin-transaction/08d15510-3fa2-4a03-add1-62cb1b9c2eeb/scratchpad/probes/p4/` (`npm init -y`; nothing installed in the repo). Scripts there: `bench.mjs`, `light.mjs`, `summarize.mjs`, `sz.mjs`, raw output `results.jsonl`.

Versions (exact-pinned, `npm install --save-exact`): Node v24.22.0 (darwin 24.6.0), `unpdf@1.9.0` (MIT), `htmlparser2@12.0.0` (MIT), `linkedom@0.18.13` (ISC).

1. Each case run in a **fresh Node process 5 times** (`bench.mjs <case> 9`). Per process: module import timed; **first call** timed (cold: JIT + lazy module init); then 9 further runs, the first 2 discarded as warm-up, **median of the remaining 7** taken. Table reports median across the 5 processes, with min-max range.
2. CPU = `process.cpuUsage()` delta (user + system); wall = `performance.now()`.
3. PDF: `getDocumentProxy(new Uint8Array(buf))` then `extractText(pdf, {mergePages:true})`, file `14-ilpa-model-subscription-agreement-2018.pdf` (184,947 B). Sample treated as untrusted data (read-only bytes, parsed only).
4. HTML: `02-coatue-innovation-fund-2025.htm` (378,698 B, the largest) and `07-cottonwood-multifamily-reit-ii-2016.htm` (47,793 B, the smallest). Variants: (a) regex strip (drop script/style, map `</tr></p><br>` to newlines, `</td>` to ` | `, strip tags); (b1) `htmlparser2` text-only SAX; (b2) `htmlparser2` with row/cell merging (merges `<td>` cells into one logical line per `<tr>`, as RESEARCH parser-implication 2 requires); (c1) `linkedom` `parseHTML` + `textContent`; (c2) `linkedom` + per-`<tr>` cell merge.
5. `wrangler dev`: **skipped**. Reasons: (i) installing wrangler plus the workerd binary is not "quick" and needs network; (ii) local `wrangler dev` does not enforce the 10 ms CPU limit, and Workers freezes `Date.now()`/`performance.now()` between I/O, so in-isolate CPU cannot be read from inside the worker anyway; (iii) the margin is large (see below). **Assumption stated explicitly:** a Workers V8 isolate runs the same V8 on server-class cores, so CPU for the same JS is of the same order of magnitude as Node on this laptop (no assumption of exact parity). Even a 3x faster isolate leaves the PDF at about 30 ms warm and about 130 ms cold.
6. Light checks (`light.mjs`): 21 timed runs after 20 warm-up runs each, median CPU.
7. Bundle: sizes read from the installed package and gzip/brotli-compressed with node `zlib`.

### Evidence Captured

**Results table (CPU ms; median of 5 fresh processes; [min-max])**

| Case | Input | Import CPU (startup proxy) | Cold first call CPU | Warm CPU (median of 7) | Warm wall | Peak RSS / heap | Output |
|---|---|---|---|---|---|---|---|
| unpdf `extractText` | PDF 185 KB | 2.4 (index only; pdf.js loads lazily, see below) | **393.7** [388-399] | **90.5** [89-99] | 63.0 | 196 MB / 71 MB | 25 pages, 42,924 chars |
| unpdf, per page | same | - | 15.8 | **3.6** | 2.5 | - | (90.5 / 25, 393.7 / 25) |
| regex strip | HTML 380 KB | 0.8 | 5.19 [5.16-5.31] | 2.70 [2.48-2.89] | 2.6 | 67 / 16 MB | 130,879 chars |
| regex strip | HTML 48 KB | 0.8 | 1.60 | 0.40 | 0.4 | 49 / 6 MB | 23,432 chars |
| htmlparser2 text SAX | HTML 380 KB | 23.3 | **31.2** [30.5-32.3] | 6.73 [5.5-6.8] | 4.6 | 64 / 8 MB | 127,544 chars |
| htmlparser2 text SAX | HTML 48 KB | 23.0 | 16.0 | 1.33 | 0.7 | 60 / 6 MB | 23,495 chars |
| htmlparser2 + row/cell merge | HTML 380 KB | 23.0 | **34.4** [33.7-35.2] | 6.05 [5.6-6.5] | 5.1 | 65 / 7 MB | 1,219 lines |
| htmlparser2 + row/cell merge | HTML 48 KB | 23.4 | 17.4 | 1.62 | 0.8 | 60 / 6 MB | 342 lines |
| linkedom DOM + textContent | HTML 380 KB | 98.3 | **55.7** [54.8-56.4] | **25.0** [24.2-26.1] | 14.5 | 139 / 56 MB | 127,543 chars |
| linkedom DOM + textContent | HTML 48 KB | 96.5 | 26.3 | 4.04 | 2.2 | 77 / 19 MB | 23,494 chars |
| linkedom + `<tr>` merge | HTML 380 KB | 96.6 | 62.7 | 24.0 | 14.7 | 145 / 64 MB | 530 `<tr>` lines (not comparable to htmlparser2 count: the latter also counts loose text lines) |
| linkedom + `<tr>` merge | HTML 48 KB | 101.4 | 29.1 | 4.53 | 2.4 | 77 / 18 MB | 8 `<tr>` lines |

Notes on the table:
- "Cold" CPU can exceed wall time because Node adds JIT/GC helper threads. A Workers CPU meter may not count helper threads, so use wall as a lower bound for cold: unpdf cold wall was about 204 ms (single early sample), still about 20x the limit.
- unpdf's `index.mjs` import is cheap because it loads pdf.js lazily; importing the serverless pdf.js module itself (`unpdf/pdfjs`) costs **about 56 ms CPU** (5 runs: 54.4-59.6 ms) once, then about 2 ms to resolve. That is startup/global-scope cost, against the 1 s startup limit (passes), but if the import is done lazily inside the handler it is billed to that request's CPU.
- Cold 394 ms = about 56 ms pdf.js module evaluation + JIT warm-up + the 25-page extraction.

**Light server-side operations (median CPU, warm, Node)**

| Operation | CPU ms |
|---|---|
| SHA-256 (WebCrypto) of 380 KB HTML (cache key) | 0.29 |
| SHA-256 of 185 KB PDF | 0.16 |
| `JSON.parse` + shape check of 33 KB / 200-finding payload | 0.07 |
| UTF-8 decode of 380 KB | 0.07 |

**Bundle size (item 4)**

| Artifact | Uncompressed | gzip -9 | brotli |
|---|---|---|---|
| `unpdf` serverless pdf.js build (`pdfjs.mjs`, the module a Worker imports) | 1,696,514 B (about 1.62 MiB) | 503,310 B (about 0.48 MiB) | 404,984 B |
| `unpdf` `index.mjs` | 14,947 B | 4,627 B | 3,991 B |
| package total on disk (incl. type definitions, both builds) | 2,127 KB | - | - |
| `htmlparser2` package total | 230 KB | - | - |
| `linkedom` package total | 2,249 KB | - | - |

Bundle fits the stated 64 MiB uncompressed limit by a factor of about 39, and fits the 1 s startup (about 56 ms module eval). Caveat: from my own knowledge (not verified here, no network), Cloudflare has historically documented a **compressed** script-size limit of 3 MB on Free (10 MB Paid) rather than 64 MiB. unpdf at about 0.5 MiB gzip fits either way; confirm the figure before PLAN adds more dependencies (e.g. a DOCX WASM library, probe P3).

### Verdict
**NOT-VIABLE** (for the hypothesis as stated: parsing server-side within Workers Free).

Decision logic from the brief: "if per-request CPU for realistic documents (largest HTML, full PDF) is clearly > 10 ms -> NOT-VIABLE."
- Full PDF: 90 ms warm and 394 ms cold vs 10 ms. Clearly > 10 ms. The best-case input (warm, every run) is 9x over.
- Largest HTML (380 KB): a plain regex strip passes only when warm (2.7 ms; 5.2 ms cold) and produces no structure. A real parser exceeds or sits on the limit: `htmlparser2` 6.0-6.7 ms warm (no headroom) and 31-34 ms cold; `linkedom` 24-25 ms warm and 56-63 ms cold. The parse is only step one: AC29 requires structure **plus checks** (heading inference, reference resolution, checkbox/exclusivity rules, version diff) on about 130K characters; those add CPU on top. Realistically it exceeds 10 ms on the largest sample.
- Even smallest HTML (48 KB) with a real DOM parser: 26-29 ms cold, 4-4.5 ms warm. Passes only when warm.
- Workers reuses isolates, but a Free-plan request lands on a cold isolate often enough (and a deployment's first request always) that cold numbers matter for AC40 "fails safely"; AC40 conformance would also need to hold per request, not on average.

The complement ("therefore parsing must run in the browser") is **supported as the default design direction**, with the caveat below that other off-Worker options (Workers AI `toMarkdown`, chunked requests) were not probed.

### Resulting Design Constraint

**What this licenses:**
- PLAN/INNOVATE may depend on **browser-side parsing** (pdf.js/unpdf in the browser, HTML parsing via the native `DOMParser`) as the single parsing location. The 128 MB RSS/heap figures are not a problem: warm peak RSS of 196 MB for the PDF is Node baseline inclusive (about 50 MB is Node itself) and is browser-side anyway.
- Workers Free may be used for **light server-side steps**: SHA-256 cache keys (under 0.3 ms for 380 KB), JSON parse and validation of findings payloads (about 0.07 ms for 33 KB), D1 cache lookups/writes, rate-limit checks, request-size rejection, and forwarding batched LLM calls (LLM wait is not CPU). These sit 30x or more below the 10 ms limit.
- Sending the client-extracted text/structure (not the raw file) to the Worker for hashing and caching is within budget.
- unpdf's serverless build bundle size (about 1.6 MiB raw, 0.48 MiB gzip) is compatible with size/startup limits, if a later decision needs it in a Worker for a non-CPU-bound purpose.

**What this forbids:**
- Any design where the Worker parses an uploaded PDF (unpdf/pdf.js), or builds a DOM (`linkedom`/`jsdom`-class) from, or runs the full structure-and-checks pipeline over, a corpus-size HTML/PDF inside a single Free-plan request. Do not treat AC29/AC40 as satisfiable by server-side parsing.
- Relying on warm-isolate timing: numbers for AC40 must be cold-isolate-safe.
- Lazy-importing pdf.js inside a request handler (adds about 56 ms CPU to that request).
- Running the deterministic checks (AC29's "structure plus checks") server-side over a full document without separately measuring them; parse cost alone consumes the budget on the largest sample.
- Treating the SPEC's P4 as closed for the *checks* stage: this probe measured extraction only, not rule evaluation.

**What remains uncertain (known-gap):**
- **Real Workers numbers.** This is a Node-on-laptop proxy (assumption: same order of magnitude). Nothing was run in workerd, and no CPU limit was enforced. The margin (9x to 39x for the PDF) makes a change of verdict implausible; the HTML warm `htmlparser2` figure (6 to 7 ms) is the only near-threshold datum, and it is below the point where checks are added.
- **Chunking (per-page or per-slice requests)** was not measured. 3.6 ms/page warm and 15.8 ms/page cold suggests about 2 pages per request warm and under 1 cold, plus per-request document-open cost (not measured) and a need to re-send the file each request; judged impractical but not proven.
- **Workers AI `toMarkdown`** (RESEARCH lists it as free PDF text extraction): CPU is spent by the AI service rather than the Worker, so it could sidestep P4 for PDFs; quality/OCR behavior is SPEC probe P5 (live-provider), not covered here. Quotas (10k neurons/day) unchecked.
- **Browser-side cost** of the same parse (e.g. pdf.js in a mobile browser, 25-page PDF; the 22-page scan set needs rendering/OCR, out of scope) was not measured; AC29 targets for the client need their own timing.
- **Image-only PDFs** produce no text from unpdf; this probe only covers the text-layer PDF (sample 14). Scans are OCR (P1/P5).
- The 64 MiB vs historic 3 MB compressed script-size limit discrepancy (see Bundle size).

VC-FEASIBILITY-VERDICT-READY: NOT-VIABLE
