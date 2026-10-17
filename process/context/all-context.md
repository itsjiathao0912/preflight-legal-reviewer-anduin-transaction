# aduin-transaction - All Context

Last updated: 2026-10-17 (Phase 06 UPDATE PROCESS; code HEAD feb0acc plus the process commit)

This file is the root context entrypoint for the repo.

Use it for two things:

1. quick routing to the right context pack or root file
2. broad architecture and repository understanding

Start here before loading deeper context files.

## Project Summary (in the user's words, condensed)

**aduin-transaction** is a job-application challenge build for **Anduin Transactions**: a polished
English web app that QA-reviews fund **subscription documents before digitization**. It parses a
sub doc (HTML / PDF / DOCX / scanned via OCR) into a logic graph, runs deterministic checks
(broken cross-references, broken conditional skips, unreachable sections, investor-type gaps,
defined-term issues), uses LLMs only for judgment (ambiguity, contradictions, meaning-changing
typos), diffs related versions (feeder / parallel / prior template), and turns confirmed issues into a
**counsel query sheet** with answer tracking that blocks digitization until critical items clear.
Target user: Anduin's Digitization Service Analyst. Deliverables: live demo, README, video, slides.

Domain knowledge, defect taxonomy, competitors and product decisions: `process/context/product-domain.md`.

**Live demo (Milestone 1, 17-10-26):** https://aduin-transaction-web.giathaowork.workers.dev (Worker `aduin-transaction-web`, version `9dcf2f75-d8ac-419f-b33b-5a2525847ae7`). The Findings screen runs real engine findings on bundled samples. The deployed version predates Phases 04b and 05; AI stays fail-closed on the live site until Phase 10 deploys D1 and the Turnstile widget. Deploy rules and the redeploy recipe: `process/context/worker/all-worker.md`.

---

## How This File Works (the `all-*.md` Convention)

Every `process/context/` directory has one `all-*.md` entrypoint that acts as an attachable quick router for that domain. This root file (`all-context.md`) is the top-level router. Context groups each have their own `all-{group}.md` entrypoint.

**The pattern:**

```
process/context/
  all-context.md                      <-- THIS FILE: root router
  planning/
    all-planning.md                   <-- group router for planning
    example-simple-prd.md             <-- deep doc within the group
    example-complex-prd.md            <-- deep doc within the group
  tests/
    all-tests.md                      <-- group router for tests
    debugging-and-pitfalls.md         <-- deep doc within the group
    e2e-tests.md                      <-- deep doc within the group
  database/
    all-database.md                   <-- group router for database
    schema-guide.md                   <-- deep doc within the group
    migration-procedures.md           <-- deep doc within the group
```

**How agents use it:**

1. Agent reads `all-context.md` first (this file)
2. Finds the relevant context group from the routing tables below
3. Reads that group's `all-{group}.md` entrypoint
4. Only then loads the specific deep doc needed

This layered routing keeps context windows small. Never load the whole `process/context/` tree.

**What each `all-{group}.md` must contain:**

- Scope (what the group covers and does NOT cover)
- Read-when rules (when an agent should load this group)
- Quick procedures or decision rules
- Source paths (list of deeper docs in the group)
- Update triggers (when to refresh this group's content)
- Routing to deeper docs within the group

---

## Quick Start

For most substantial tasks:

1. read this file first
2. choose the smallest relevant root file or context group from the tables below
3. only then load deeper files

---

## Current Root Entry Points

<!-- The two tables below (Root Entry Points + Context Groups) are GENERATED from each
     context doc's frontmatter by `discover-context.mjs --emit-routing`. Do NOT hand-edit
     between the GENERATED markers — your edits will be overwritten on the next rebuild.
     To change a row, edit the owning doc's frontmatter (description / keywords) and re-emit.
     `--check-routing` fails lint if this block drifts from the frontmatter on disk. -->

<!-- GENERATED:routing -->
| File | Read when |
|---|---|
| `process/context/all-context.md` | any substantial planning, research, review, or implementation task |
| `process/context/engine/all-engine.md` | any work in packages/core, detector/threshold changes, API contract changes, or phases 02-09 that extend the engine |
| `process/context/planning/all-planning.md` | creating or reviewing an implementation plan |
| `process/context/tests/all-tests.md` | testing, verification, test fixtures, or test debugging |
| `process/context/ui/all-ui.md` | any UI/UX design, mockup, frontend implementation or UI review task |
| `process/context/worker/all-worker.md` | any work in apps/worker, the /api/* routes, quotas or limits, OpenRouter calls, secrets, or deploying to workers.dev |

## Current Context Groups

| Group | Entry point | Scope |
|---|---|---|
| `engine/` | `process/context/engine/all-engine.md` | Core engine architecture in packages/core (adapters, structure, graph, detectors, findings, memory, session, frozen contracts v1), pinned algorithms H/L/R/U/S with final thresholds, and how later phases extend it additively |
| `planning/` | `process/context/planning/all-planning.md` | Planning conventions and plan-shape examples (SIMPLE vs COMPLEX) for writing implementation plans |
| `tests/` | `process/context/tests/all-tests.md` | Test runners (vitest 4 + cloudflare vitest plugin + Playwright preview/stack projects), real pnpm commands for web and worker gates, no-double-dash and one-token-per-call rules, SLICE_BASE_URL live run, design-probe opt-in, tooling caveats and known gaps for the sub-doc QA tool |
| `ui/` | `process/context/ui/all-ui.md` | UI/UX design direction, design skills, references, tokens and approved mockups for the sub-doc QA web app |
| `worker/` | `process/context/worker/all-worker.md` | Cloudflare Worker (apps/worker) facts for the sub-doc QA tool - AI/OCR proxy pipeline order, refund policy, limits, config and env var names, secret names, error shapes, live deploy rules and redeploy recipe |
<!-- /GENERATED:routing -->

## Task Routing Table

<!-- STUDY: Replace this table with routing entries based on actual context groups created. -->
<!-- The "Load first" column always starts with all-context.md. -->
<!-- The "Then load" column points to the group entrypoint, then optionally a deep doc. -->

<!-- Example of what a filled-in routing table looks like: -->

<!--
| Task type | Load first | Then load |
|---|---|---|
| general repo research | `all-context.md` | domain file named by task |
| implementation planning | `all-context.md`, `planning/all-planning.md` | the relevant grouped PRD example plus active plan |
| test planning or verification | `all-context.md`, `tests/all-tests.md` | the specific detailed testing file |
| debugging | `all-context.md`, `tests/all-tests.md` when tests/runtime are involved | the smallest domain doc explaining the failure |
| UI/UX work | `all-context.md`, `uxui/all-uxui.md` | the canonical grouped UI reference plus feature plan |
| database work | `all-context.md`, `database/all-database.md` | `database/schema-guide.md` or `database/migration-procedures.md` |
| auth work | `all-context.md`, `auth/all-auth.md` | `auth/middleware-guide.md` or `auth/provider-setup.md` |
| infra / deployment | `all-context.md`, `infra/all-infra.md` | the relevant deploy or CI doc |
| context maintenance | `all-context.md` | run `audit-context` after edits |
-->

| If the task involves... | Start with |
|---|---|
| architecture or stack questions | this file |
| product scope, SPEC, UX, prompts, defect types, competitors | `process/context/product-domain.md` |
| test fixtures / sample documents | `samples/sub-docs/README.md` |
| choosing libraries or copying open-source code | `docs/research/reusable-repos.md` (license rules) |
| Cloudflare / OpenRouter calls, secrets | `CLAUDE.md` → Project Rules (credentials table) |
| core engine, detectors, thresholds, frozen API contracts (packages/core) | `process/context/engine/all-engine.md` |
| Worker routes, quotas, OpenRouter proxy, secrets, deploy to workers.dev | `process/context/worker/all-worker.md` |
| testing or verification | `process/context/tests/all-tests.md` |
| creating a new plan | `process/context/planning/all-planning.md` |
| UI/UX design, mockups, frontend look and feel | `process/context/ui/all-ui.md` |

## Context Group Lifecycle

Context groups are durable knowledge domains, not feature folders.

Create a group when:

- a topic has 3+ durable docs
- a single doc exceeds roughly 800 lines with separable subtopics
- multiple agents repeatedly need only one slice of a large context file
- the topic maps to a stable operational domain (tests, infra, database, auth, UI, workflows, etc.)

Do not create a group when:

- the content is a temporary report
- the content is a plan or execution artifact
- the topic is feature-specific and belongs in `process/features/...`

Move or split one group at a time. Use `all-{group}.md` entrypoints. Run the `audit-context` skill after every context organization change.

## Naming Convention

There are no `README.md` files inside `process/context/`.

Canonical entrypoints use `all-*.md`:

- root: `process/context/all-context.md`
- group: `process/context/{group}/all-{group}.md`

Each `all-{group}.md` file should act as the attachable quick router for that domain:

- tell the agent what the group covers
- give quick procedures and decision rules
- route to smaller deeper files

## Context Update Protocol

When durable project knowledge changes:

1. update the smallest relevant context file
2. update this file if routing, ownership, naming, or groups changed
3. update the owning `all-{group}.md` entrypoint when a group exists
4. run `audit-context`

---

## Repository Structure

pnpm monorepo scaffold exists (Phase 00 of the subdoc-qa-mvp program, commit 7d9955b); Phase 01 (6d12628) added the core engine in `packages/core` (see `process/context/engine/all-engine.md`); Phase 03 (833161b) added the web shell and Findings screen; Phase 04a (729e7fd) added the Worker AI/OCR proxy; Milestone 1 closed at 70d320b; Phase 02 (7a7f421 + 1f5dade) added detectors, investor paths, the structure view and fixtures; Phase 04b (7a7f421 + bb83e04 + fb3064f + 59d9831) added the D1 schema, platform ports and the memory API; Phase 05 (2ac1917 + e9c90d9 + 9c9f3b5 + a9732a6 + f0f476c) added the LLM task framework (`packages/core/src/llm`), firm-rules injection in the Worker, the AI lane in the web app and LLM recordings/scripts; Phase 06 (027a450 + 2d198f4 + 6473186 + b9767ac + 69bddd5 + 5c1c25d + 73599b5) added the PDF/DOCX/OCR adapters, scan viewer, OCR queue and precompute for sample #9. Current layout:

```
aduin-transaction/
  CLAUDE.md, AGENTS.md      -- kit-managed orchestrator rules (+ user Project Rules at end of CLAUDE.md)
  .claude/ .codex/ .agents/ -- vibecode-pro-max-kit v3.2.5 agents, skills, hooks
  package.json, pnpm-workspace.yaml, pnpm-lock.yaml -- root scripts, workspaces (packages/*, apps/*, scripts), pnpm@11.13.1
  tsconfig.base.json, eslint.config.js, THIRD_PARTY_NOTICES.md
  packages/core/            -- @aduin/core: parser/graph/detector engine + `src/llm/` LLM task framework + Phase 06 adapters (format-detect, pdf-text, docx via subpath `@aduin/core/docx`, ocr, page-noise, sup-segments) (src/index.ts seam; test/{unit,golden,property,seeded,recorded,security})
  apps/web/                 -- @aduin/web: React 19 + Vite 8 + Tailwind 4 SPA. src/{styles,shell,features,components,state,engine,storage,api,memory}; engine runs in a Comlink Web Worker; e2e/ = 17 Playwright specs + fixtures; test/ = 9 Vitest gates + support/mockupCss.ts; public/samples and firms.json are generated (gitignored). See process/context/ui/all-ui.md
  apps/worker/              -- @aduin/worker: Cloudflare Worker, wrangler.jsonc. src/{config,proxy,limits,upstream,identity,routes/proxy}: POST /api/ai, POST /api/ocr, GET /api/quota (NDJSON hold-open proxy to OpenRouter, quotas, spend cap, Turnstile, breaker); routes/memory, memory/, platform/, migrations/0001-0005 and seed/ are the Phase 04b D1 memory API. See process/context/worker/all-worker.md
  scripts/                  -- @aduin/scripts: guards (guard:cf, secrets:scan), build-samples.ts, slice-check.ts (M1 check), spike runners and spike worker scripts (spikes/s01-s02)
  fixtures/                 -- fixture dirs (fingerprint vectors and memory seeds land in Phases 01/02)
  design/                   -- approved mockups and design assets
  docs/research/            -- reusable-repos.md (open-source candidates + licenses)
  samples/sub-docs/         -- README.md manifest + raw/ real SEC sub docs (13 HTML), ILPA PDF (gitignored),
                               raw/09-rw-holdings-scans/ (22 JPEG pages for OCR), raw/_full-prospectus/ (gitignored)
  process/
    context/                -- this context system (all-context.md, product-domain.md, engine/, planning/, tests/, ui/, worker/)
    general-plans/          -- active/ completed/ backlog/ task folders (subdoc-qa-mvp_17-10-26 = the MVP phase program)
    features/               -- feature-scoped storage (none yet)
    development-protocols/  -- RIPER-5 methodology docs (kit-managed)
```

## Technology Stack

Chosen in INNOVATE and scaffolded in Phase 00 (exact pins in the `package.json` files; spike evidence in the Phase 00 SPIKE-RESULTS REF):

- **Package manager / runtime:** pnpm 11.13.1 (workspaces), Node >=24, TypeScript 6.0.3 (ESM).
- **Core (`@aduin/core`):** htmlparser2 12, unpdf 1.9, mammoth 1.13, diff 9, zod 4.6, @noble/hashes 2.4 (import paths end in `.js`).
- **Web (`@aduin/web`):** React 19.3, Vite 8, Tailwind 4 (`@tailwindcss/vite`), zustand, dexie, comlink, Radix dialog + popover 1.3.1 (behavior only, restyled by tokens), self-hosted @fontsource Geist + Newsreader, pdfjs-dist 6, docx 9 (@tanstack/react-table is installed but unused so far; plan deviation 1).
- **Worker (`@aduin/worker`):** Cloudflare Workers via wrangler 4.151, zod 4.6; tested with `@cloudflare/vitest-plugin` 1.4.4. Free-only OpenRouter models, secrets via `wrangler secret put`.
- **Test / lint:** vitest 4.1.12, Playwright 1.64, fast-check 4.10, eslint 10 + typescript-eslint 8, prettier 3.9. See `process/context/tests/all-tests.md`.
- **Hosting:** Cloudflare (Workers plus static assets; D1/R2/KV as needed), resources named
  `aduin-transaction-*`, default `*.workers.dev` / `*.pages.dev` URLs. **Never touch zone `itsjiathao.com`** (enforced by `pnpm guard:cf`).
- **LLM / OCR:** OpenRouter (OpenAI-compatible API). Free models first, cheap paid fallback, ~$10 total cap. Phase 05 serves one free text model, `nvidia/nemotron-3-super-120b-a12b:free`, with `json_schema` response mode (details: `process/context/worker/all-worker.md`, `process/context/engine/all-engine.md`).
- **a11y:** `@axe-core/playwright` 4.14.0 is installed dev-only (MPL-2.0; decision D-8 recorded in `THIRD_PARTY_NOTICES.md`). Docxodus WASM is still unproven on Workers.
- **Local toolchain:** Node.js v24.22.0, git, gh (logged in as itsjiathao0912).

## Key Patterns and Conventions

- **Deterministic first, LLM second.** Graph checks must be explainable and reproducible. The LLM only judges
  clause neighborhoods selected from the graph. Every finding cites evidence (clause text + location).
- **Cost discipline:** cache all LLM/OCR outputs (content-hash keyed). The app must work in no-LLM mode.
- **Licensing:** copy code only from MIT/BSD/Apache sources and keep their notices. AGPL or no-license repos are reference only.
- **Test data:** real public SEC documents in `samples/sub-docs/`. Add synthetic fixtures with seeded defects
  for guaranteed-coverage tests. Treat sample files as untrusted input (parse, never execute).
- **Git:** solo developer; commit directly on `main` with conventional-commit prefixes (kit hook lints them).
- **Communication:** user chats in Vietnamese; product UI and code are English.

## Environment and Configuration

Secrets live outside the repo (see `CLAUDE.md` credentials table). Env var names only:

- Cloudflare: `CLOUDFLARE_EMAIL`, `CLOUDFLARE_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` (`~/.config/cloudflare/credentials.env`)
- OpenRouter: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL` (`~/.config/openrouter/credentials.env`)
- App runtime: Workers secrets via `wrangler secret put` (live: `COOKIE_SIGNING_KEYS`, `COOKIE_SIGNING_KID`, `OPENROUTER_API_KEY`; `TURNSTILE_SECRET` not yet); plain vars in `apps/worker/wrangler.jsonc`; full list in `process/context/worker/all-worker.md`. Local dev in gitignored `.dev.vars` / `.env`.
- Tests: `SLICE_BASE_URL` (https `*.workers.dev` only) points the Playwright `stack` project at a deployed Worker; `DESIGN_PROBE` enables the opt-in design-probe spec.

## Open Questions and Outstanding Work

- Does Docxodus WASM run on Cloudflare Workers? (spike needed before relying on it for DOCX diff)
- Which free OpenRouter vision model is good enough for OCR on `samples/sub-docs/raw/09-rw-holdings-scans/`?
  The paid fallback is chosen against the ~$10 cap.
- Persistence for counsel-query tracking (D1 vs KV) and whether the demo needs auth.
- OpenRouter credits not yet topped up by the user; paid fallback unavailable until then.
- Next step: Phase 07c is in progress (another session), Phase 09 is committed (feb0acc) awaiting EVL, then 08 and 08b EXECUTE (PVL PASS), then a missing-target cross-reference detector (P1, corpus check required), then 10; see the umbrella `## Current Execution State`. Phases 00-06 (incl. 02, 04a, 04b) are DONE; Milestone 1 is closed and live (the deployed version predates 04b and 05). Phase 08 preconditions (backlog L4/L5/L6/I1): `computeGate` excludes AI findings, mask and clamp draft text, rules-isolation re-verify. Phase 10 also owns CSP and security headers (F10), deploying the Worker before the web bundle (F12; the live Worker still runs the ocr1 OCR contract) and re-seeding the remote demo D1. Phase 10 owns creating and migrating the real D1 (placeholder id in `apps/worker/wrangler.jsonc` stays until then), remote migrations 0001-0005, the Turnstile widget plus `TURNSTILE_SECRET`, the live-model quality sweep/precompute spread over UTC days, the workerd timing probe at `max_tokens` 10000, and the remote D1 rows_written re-measure (`process/context/worker/all-worker.md`).
- Open backlog: AC6 edit text/severity (B-EDIT), UI notes U2-U4 (U1 done), core follow-ups incl. Phase 06 rows (F4, F6-F8, N6-N8, live OCR bbox row-level, concurrent e2e port flake), `/api/health` no-store (`process/general-plans/backlog/`).

## Scan Metadata

- Generated: 2026-10-17
- HEAD: feb0acc (code), process commit follows
- Mode: delta update after Phase 06 (PDF/DOCX/OCR, scan viewer, precompute); earlier deltas: Phases 02, 04b, 05
- Package manager: pnpm 11.13.1 (workspaces: packages/*, apps/*, scripts)
