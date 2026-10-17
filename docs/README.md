# Start here

A reviewer's guide to this repository. Pick a reading path by time budget, then use the tables to find any doc, folder or sample.

## What this is

- A web app that QA-reviews fund subscription documents before Anduin digitizes them into online forms.
- It parses a document (HTML, text PDF, DOCX or scanned pages) into a logic graph, runs 13 deterministic checks, and uses free LLMs only to judge a few graph-selected passages.
- It compares related versions, turns open items into a counsel query sheet (DOCX), tracks answers, and blocks digitization until every critical item is clear. A firm memory remembers earlier decisions.
- Fund Package Intake: upload several documents of one fund (sub agreement, LPA, PPM, baseline, side letters). The app types each file, resolves references across them, reports which checks were not possible (coverage) and drafts one request for the missing documents. It adds no new screen: it lives in the Upload dialog, the Structure "Package" lens, the Findings header and the Counsel "For the GP" group.

Live site: `https://aduin-transaction-web.giathaowork.workers.dev`. It runs with its real D1 database, Turnstile and an enforced CSP; shared memory is live and precomputed samples make zero upstream calls. Details in [architecture/status.md](architecture/status.md).

## Reading path

| Time | Read | You get |
|---|---|---|
| 5 min | This page, then [architecture/README.md](architecture/README.md) | The problem, five design principles, the runtime map |
| 5 min | Open the live site or [design/mockups/app.html](../design/mockups/app.html), pick sample 5, then Compare 5 against 6 | The product in use |
| 5 min | On the live site open Upload and pick the demo package "Northgate Capital III", then see Structure > Package and Counsel questions > For the GP | Fund Package Intake in use; steps in the [Vietnamese walkthrough](walkthrough/demo-walkthrough.vi.md) |
| 20 min | [architecture/workflows.md](architecture/workflows.md), [architecture/status.md](architecture/status.md) | Who uses it, how each workflow runs, what is real today |
| 20 min | [architecture/decisions.md](architecture/decisions.md) | Why it is built this way, and what was rejected |
| Deep dive | [architecture/components.md](architecture/components.md), [architecture/data-model.md](architecture/data-model.md) | Components, routes, detectors, prompts, schema, fingerprints |
| Deep dive | [packages/core/src](../packages/core/src/index.ts), [apps/worker/src](../apps/worker/src/index.ts), [apps/web/src](../apps/web/src/main.tsx) | The code, in that order |
| Deep dive | The planning trail under [process/](#how-the-project-was-planned) | How decisions were made, phase by phase |

## Documents

| Doc | One line |
|---|---|
| [architecture/README.md](architecture/README.md) | Overview: problem, principles, runtime map, what runs where |
| [architecture/workflows.md](architecture/workflows.md) | Personas and workflows W1-W8 with diagrams and code paths |
| [architecture/components.md](architecture/components.md) | Component table, request flows, Worker routes, detectors, AI prompt registry |
| [architecture/data-model.md](architecture/data-model.md) | D1 schema (20 tables), fingerprint formula, retention, browser storage |
| [architecture/decisions.md](architecture/decisions.md) | Decision log with rejected alternatives and the D-1 to D-9 defaults |
| [architecture/status.md](architecture/status.md) | Built, partial and planned by area; live deployment; test counts |
| [DEPLOY.md](DEPLOY.md) | Deploy guide (added at final deploy; may not exist yet) |
| [demo/](demo/) | Demo script, storyboard and slides (added at final deploy; may not exist yet) |
| [research/reusable-repos.md](research/reusable-repos.md) | Open-source candidates and licence rules for copied code |
| [../design/mockups/app.html](../design/mockups/app.html) | Approved UI prototype (single file; open in a browser). Notes: [app_NOTES.md](../design/mockups/app_NOTES.md) |
| [../samples/sub-docs/README.md](../samples/sub-docs/README.md) | The real public SEC sub docs used as test inputs, with known defects per file |
| [../samples/packages/README.md](../samples/packages/README.md) | Three fictional fund packages (Northgate III, Lotus Bay II, Redwood Ridge I) used as demo inputs for Fund Package Intake, each with an answer key |
| [walkthrough/demo-walkthrough.vi.md](walkthrough/demo-walkthrough.vi.md) | Vietnamese click-by-click demo guide, including the package demo |
| [../THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) | Licences of code and data used |

## How the project was planned

The project followed a spec-driven trail: RESEARCH, SPEC, INNOVATE, PLAN, VALIDATE, EXECUTE, then a process update per phase. Every artifact is kept under [process/](../process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md).

| Step | File | Why read it |
|---|---|---|
| Product and domain | [product-domain.md](../process/context/product-domain.md) | The challenge, the analyst, the defect taxonomy, competitors |
| SPEC | [SPEC](../process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_SPEC_17-10-26.md) | Requirements and numbered acceptance criteria |
| INNOVATE | [Decision summary](../process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_INNOVATE_17-10-26.md) | Chosen approach and rejected alternatives |
| Data model | [DATA-MODEL](../process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_DATA-MODEL_17-10-26.md) | Original schema design for review memory |
| PLAN | [Umbrella plan](../process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md) | Phase order, user-decided defaults, current execution state |
| EXECUTE | `subdoc-qa-mvp_PHASE-NN-*_REPORT_*.md` in the same folder | One report per phase with evidence and closeout |

The `process/` folder is working history, not product documentation. The architecture docs above are the reviewer-facing summary.

## Repository layout

```text
aduin-transaction/
  apps/
    web/        React 19 + Vite SPA: screens, engine Web Worker client, IndexedDB, e2e tests
    worker/     Cloudflare Worker: static assets, AI/OCR proxy, memory API, D1 migrations and seed
  packages/
    core/       Shared pure TypeScript: adapters, structurer, graph, detectors, diff, package intake, memory, gate, LLM tasks
  scripts/      Sample builder, fixture builders, precompute and record tools, repo guards
  fixtures/     Seeded-defect HTML, DOCX/PDF cases, memory seeds, recorded LLM responses, test vectors
  samples/      Real public subscription documents (SEC filings), the 22-page scan set, and fictional fund packages (samples/packages)
  design/       Approved HTML mockups and design notes
  docs/         This documentation
  process/      Planning trail, context docs, development protocols
```

| Folder | Entry point |
|---|---|
| `apps/web` | [src/main.tsx](../apps/web/src/main.tsx), [engine.worker.ts](../apps/web/src/engine/engine.worker.ts) |
| `apps/worker` | [src/index.ts](../apps/worker/src/index.ts), [wrangler.jsonc](../apps/worker/wrangler.jsonc), [migrations](../apps/worker/migrations/0001_reference_and_workspace.sql) |
| `packages/core` | [src/engine.ts](../packages/core/src/engine.ts), [detectors/registry.ts](../packages/core/src/detectors/registry.ts) |
| `scripts` | [build-samples.ts](../scripts/src/build-samples.ts), [guard-cf.ts](../scripts/src/guards/guard-cf.ts) |
| `fixtures` | [html-seeded](../fixtures/html-seeded/broken-conditional), [llm-recordings](../fixtures/llm-recordings/clause-judgment) |

## Run it locally

Needs Node 24 and pnpm 11 ([package.json](../package.json)).

```bash
pnpm install
pnpm test                # core, worker and web unit tests
pnpm typecheck
pnpm dev:stack           # build the web app and run the Worker locally
```

## Related

- [architecture/README.md](architecture/README.md): the architecture entry point
- [../CLAUDE.md](../CLAUDE.md) and [../AGENTS.md](../AGENTS.md): agent workflow rules used to build the project
