# aduin-transaction - All Context

Last updated: 2026-10-17 (vc-setup, pre-code)

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
| `process/context/planning/all-planning.md` | creating or reviewing an implementation plan |
| `process/context/tests/all-tests.md` | testing, verification, test fixtures, or test debugging |
| `process/context/ui/all-ui.md` | any UI/UX design, mockup, frontend implementation or UI review task |

## Current Context Groups

| Group | Entry point | Scope |
|---|---|---|
| `planning/` | `process/context/planning/all-planning.md` | Planning conventions and plan-shape examples (SIMPLE vs COMPLEX) for writing implementation plans |
| `tests/` | `process/context/tests/all-tests.md` | Test strategy, runners, commands and known gaps for the sub-doc QA tool (pre-code: planned shape only) |
| `ui/` | `process/context/ui/all-ui.md` | UI/UX design direction, design skills, references, tokens and approved mockups for the sub-doc QA web app |
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

No application code yet (pre-SPEC). Current layout:

```
aduin-transaction/
  CLAUDE.md, AGENTS.md      -- kit-managed orchestrator rules (+ user Project Rules at end of CLAUDE.md)
  .claude/ .codex/ .agents/ -- vibecode-pro-max-kit v3.2.5 agents, skills, hooks
  docs/research/            -- reusable-repos.md (open-source candidates + licenses)
  samples/sub-docs/         -- README.md manifest + raw/ real SEC sub docs (13 HTML), ILPA PDF (gitignored),
                               raw/09-rw-holdings-scans/ (22 JPEG pages for OCR), raw/_full-prospectus/ (gitignored)
  process/
    context/                -- this context system (all-context.md, product-domain.md, planning/, tests/)
    general-plans/          -- active/ completed/ backlog/ task folders
    features/               -- feature-scoped storage (none yet)
    development-protocols/  -- RIPER-5 methodology docs (kit-managed)
```

## Technology Stack

**Not chosen yet.** Final stack is decided in INNOVATE. Working assumptions from the user's setup:

- **Hosting:** Cloudflare (Workers and/or Pages, plus D1/R2/KV as needed), account-level resources named
  `aduin-transaction-*`, default `*.workers.dev` / `*.pages.dev` URLs. **Never touch zone `itsjiathao.com`.**
- **Language:** TypeScript preferred (edge-friendly). A Python service is allowed only if a library clearly earns it.
- **LLM / OCR:** OpenRouter (OpenAI-compatible API). Free models first, cheap paid fallback, ~$10 total cap.
- **Candidate libraries (permissive):** unpdf, pdf.js / react-pdf, mammoth.js, docxjs, jsdiff, docx (export),
  Docxodus WASM (needs a Workers spike), defined-terms-checker rules, OpenContracts frontend patterns.
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
- App runtime (planned): Workers secrets via `wrangler secret put`; local dev in gitignored `.dev.vars` / `.env`.

## Open Questions and Outstanding Work

- Stack choice (Workers vs Pages Functions vs container; React framework) is decided in INNOVATE.
- Does Docxodus WASM run on Cloudflare Workers? (spike needed before relying on it for DOCX diff)
- Which free OpenRouter vision model is good enough for OCR on `samples/sub-docs/raw/09-rw-holdings-scans/`?
  The paid fallback is chosen against the ~$10 cap.
- Persistence for counsel-query tracking (D1 vs KV) and whether the demo needs auth.
- OpenRouter credits not yet topped up by the user; paid fallback unavailable until then.
- Next step: RESEARCH → SPEC for the MVP.

## Scan Metadata

- Generated: 2026-10-17
- HEAD: 33669f5
- Mode: refresh (kit protocols present; context/plans/features scaffolded fresh)
- Package manager: none yet (no package.json)
