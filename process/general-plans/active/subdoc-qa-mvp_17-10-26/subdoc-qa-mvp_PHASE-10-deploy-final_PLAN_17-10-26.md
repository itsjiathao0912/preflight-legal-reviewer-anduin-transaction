---
name: plan:subdoc-qa-mvp-phase-10-deploy-final
description: "Sub-doc QA MVP — Phase 10: deploy to workers.dev, a11y and perf sign-off, final precompute, fund II proofs, Free-plan conformance, README, demo video and slides"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-10
---

# Phase 10 — Deploy, Sign-off, Final Precompute, Deliverables

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-10-deploy-final_REPORT_17-10-26.md

---

## Overview

Final integration and delivery: create the real `aduin-transaction-*` resources, apply migrations and the demo seed remotely, set secrets with `wrangler secret put`, deploy one Worker (`aduin-transaction-web`: static SPA + `/api/*`) to the default `*.workers.dev` URL, then prove Free-plan conformance, performance, accessibility, the fund II memory results, the zero-call sample opening, and ship the README (reasoning, known misses, production requirements), demo video and slides. It also performs the **final precompute** (OCR and AI results for all bundled samples, with prompts frozen) and regenerates the demo seed. Context routers: `process/context/all-context.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`; project rules in `CLAUDE.md`.

Deploy policy (user confirmed): unattended deploys are allowed to `*.workers.dev` / `*.pages.dev` only, with `aduin-transaction-*` resources, secrets only via `wrangler secret put`, and never zone `itsjiathao.com` (id 894bc9f93640fab260bf1580b5b48cb7). **Hard stops:** attaching any custom domain or route; any `git push` (needs the user's OK); any paid LLM call (free models only; paid path stays disabled). Marketing surfaces (README banner, slides, optional intro) use `design-taste-frontend`; app screens never do.

## Phase Completion Rules

- CODE DONE = deploy scripts, docs, tests committed.
- VERIFIED = Exit Gate green against the live URL, validate-contract written, regression: full suite (all phases) green, zone-untouched checklist signed. Deliverables (README, video, slides) are Agent-Probe items: recorded as done with paths; the video's narration/screen recording that needs the human is listed as a user action if it cannot be produced headlessly (Playwright screen capture draft + script are produced regardless).
- User confirmed: deploy policy above. Anything outside it is a hard stop.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC29 | Deterministic results for the largest sample (~380 KB) within targets (< 5 s; typical ~50 KB < 2 s); 22-page scan set shows per-page progress | `perf-budget-corpus` (timed corpus run in Chromium; thresholds from NFR table and S7) | Fully-Automated | — |
| AC30 | Keyboard-only triage/filters/gate; visible focus; WCAG AA contrast; severity never by color alone; no critical axe violations | `a11y-scan-and-keyboard-e2e` | Hybrid (automated scan + one manual keyboard pass recorded) | — |
| AC31 | Live demo works end to end with a sample (no account); README explains reasoning; short demo video and slides exist; nothing created in or changing zone `itsjiathao.com` | `deployed-smoke-e2e` (against the live URL) + deliverables checklist | Fully-Automated (smoke) + Agent-Probe (deliverables; zone-untouched check by listing account resources) | — |
| AC40 | Deployed app operates within Workers Free limits (10 ms CPU, 50 subrequests, 100k req/day) with no paid feature; exceeding a limit fails safely | `free-plan-limits-conformance` (every corpus doc and the scan set against the deployed Worker; `wrangler tail` cpuTime/outcome) + `limit-exceeded-safe-failure` | Fully-Automated + Hybrid (remote tail precondition) | interim: 04a/04b budget tests |
| AC59 | Fund II fixture shows ≥ 50% fewer findings needing action than without memory | `fund-two-memory-reduction-e2e` | Fully-Automated | interim in P08 |
| AC60 | Fund II: 0 of the 2 new defects and the edited passage placed in Previously handled; 0 already-answered questions in the counsel sheet; blocking dismissals stay in the main list | `fund-two-zero-hidden-zero-repeat-e2e` | Fully-Automated | interim in P08 |

Closing verification for: AC1 (deployed smoke for every format), AC7 (schema contract over the final corpus), AC14 (README outcome of the #9 footnote case; soft), AC18 (seeded matrix), AC25 (final no-LLM corpus run), AC34 (all bundled samples open with zero AI/OCR calls), AC39 (abuse matrix against the deployed Worker), AC38/AC58 (retention stated in the notice and README), AC41–AC58 deployed smoke.

## Entry Gate

- Phases 00–08 verified; Phase 08b and Phase 09 verified or recorded `SKIPPED (P1 cut)` with their ACs marked DEFERRED.
- Prompts frozen (Phase 05/06/07 versions recorded); credentials available outside the repo (`~/.config/cloudflare/credentials.env`, `~/.config/openrouter/credentials.env`; loading requires the user's APPROVED marker for `.env` files per `CLAUDE.md`).

## Library pins (confirm via vc-docs-seeker in Phase 00)

wrangler (`d1 create`, `d1 migrations apply --remote`, `d1 execute --remote --file`, `secret put`, `deploy`, `tail`), @axe-core/playwright, Playwright (video/trace), Marp CLI (MIT) or equivalent for slides (confirm), design-taste-frontend skill for marketing surfaces.

## Touchpoints (create/modify)

```
apps/worker/wrangler.jsonc                 (modify: real D1 database_id; still no routes/custom_domain)
scripts/src/deploy/{preflight.ts,create-resources.ts,apply-remote.ts,set-secrets.ts,deploy.ts,teardown-guard.ts}   `pnpm deploy:*` (preflight always first)
scripts/src/precompute/{precompute-all.ts}  final OCR + AI precompute orchestrator (uses P05/P06 scripts)
apps/web/public/precomputed/**             final files named by docHash and rulesHash8
apps/worker/seed/demo.sql                  regenerated
apps/web/e2e/{perf-budget,a11y-keyboard,deployed-smoke,fund-two,free-plan-limits}.spec.ts  (deployed runs use BASE_URL)
scripts/src/conformance/{free-plan-limits.ts}   drives the deployed Worker and reads tail output
README.md                                  reasoning, architecture, known misses, limits, production requirements (not built)
docs/demo/{script.md,video/*,slides/*}     demo script, captured video, slide deck (marketing surfaces: design-taste-frontend)
docs/DEPLOY.md                             exact commands, resource names, rollback
```

## Public Contracts

- Resources (account-level, named): Worker `aduin-transaction-web`, D1 `aduin-transaction-db`; no KV/R2/DO. Default URL `https://aduin-transaction-web.<account>.workers.dev` (exact host recorded in the report).
- Secrets only via `wrangler secret put`: `OPENROUTER_API_KEY`, `COOKIE_SIGNING_KEY`, `TURNSTILE_SECRET` (site key is public config). No secret in repo, logs, CI output or the README.
- `PAID_FALLBACK_ENABLED=false` in production config; global AI cap defaults stay at the umbrella's locked values.
- `pnpm deploy:preflight` must pass before any remote command: guard-cf (no zone/routes/custom domains), secrets scan, correct account id, resource-name prefix check, clean working tree report, spike resources absent.
- README states: why deterministic first, what AI does and does not do, known misses (including the #9 footnote outcome and `[***]`/#2 variant limitations), privacy and retention values, Free-plan design, and what production would need (tenant isolation, encryption, no-training, regional hosting, retention controls, audit).

## Blast Radius

Deploy scripts, final precomputed files, seed regeneration, e2e specs, docs. Source behavior is not changed except fixes found by sign-off (each fix is a minimal commit with a regression test and a registry note). Remote effects: creates D1 `aduin-transaction-db`, deploys Worker `aduin-transaction-web`, sets secrets. Registry `## Phase 10`.

## Data Flow

Precompute scripts (local, free models only) → `public/precomputed/*` → build web → `wrangler deploy` (assets + Worker) → remote D1 migrated and seeded → live smoke and conformance runs from the local machine against the Worker URL → `wrangler tail` outcome/cpuTime captured → report.

## Failure Modes

Remote migration failure → stop, do not seed, report; deploy failure → previous version stays; limit exceeded in conformance → fix (reduce work/batch) or degrade design per spike fallbacks; Turnstile misconfiguration → AI disabled with banner (deterministic review unaffected); daily free quota exhausted during precompute → resume next UTC day.

## Implementation Checklist

### Step A — Sign-off inputs (local)
- [ ] A1. Full local suite: `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @aduin/web test:e2e && pnpm slice:check && pnpm seed:check && pnpm guard:cf && pnpm secrets:scan`.
- [ ] A2. `perf-budget-corpus` (Chromium, all samples, scan set per-page progress) against S7 thresholds; record numbers.
- [ ] A3. `a11y-scan-and-keyboard-e2e` (axe on every main screen + scripted keyboard path through triage, filters, gate) plus one manual keyboard pass recorded; fix findings.
- [ ] A4. Interim fund II proofs re-run: `fund-two-memory-reduction-e2e`, `fund-two-zero-hidden-zero-repeat-e2e`.

### Step B — Final precompute (free models only)
- [ ] B1. Confirm prompt versions frozen; run `pnpm precompute:all -- --dry-run` and record the planned request list and counts (OCR ≤ 35, AI ≈ 13 documents + drafts, split across UTC days to stay within the free 50/day).
- [ ] B2. Run for real under APPROVED-LIVE (free models only, request cap in the contract); resumable; never print keys; verify every bundled sample opens with zero calls (`sample-open-zero-llm-calls` over all samples).
- [ ] B3. Regenerate `demo.sql` (`pnpm seed:gen && pnpm seed:check`).

### Step C — Deploy (unattended allowed within policy)
- [ ] C1. `pnpm deploy:preflight` (hard gate).
- [ ] C2. `create-resources.ts`: `wrangler d1 create aduin-transaction-db` (record id into `wrangler.jsonc`), no routes.
- [ ] C3. `apply-remote.ts`: `wrangler d1 migrations apply aduin-transaction-db --remote`, apply `seed/demo.sql` remotely; verify `schema_version` through `/api/health`.
- [ ] C4. `set-secrets.ts`: `wrangler secret put` for the three secrets from the credential files (values never echoed; privacy hook approval marker where required).
- [ ] C5. `deploy.ts`: build web, `wrangler deploy`; record the workers.dev URL; run `deployed-smoke-e2e`.
- [ ] C6. Hard stops: do not add routes/custom domains; do not push to GitHub.

### Step D — Conformance and abuse on the live URL
- [ ] D1. `free-plan-limits-conformance`: run every corpus document and the scan set through the deployed app; read `wrangler tail --format json` for `cpuTime`, outcome, subrequest counts; assert no limit errors; run `limit-exceeded-safe-failure` (oversize body, simulated limit path) and `abuse-protection-matrix` against the live URL (small, no AI spend: guards reject before claims).
- [ ] D2. `deployed-smoke-e2e`: open a sample, review, draft the counsel sheet, see the gate in under 3 minutes (timed; success metric), export DOCX, record answer, open the next sample to see Previously handled.
- [ ] D3. Zone-untouched check: list account resources (Workers scripts, D1, domains attached to the Worker) via the account-level API and assert only `aduin-transaction-*` resources exist and no custom domain/route is attached; never call zone endpoints for `itsjiathao.com`.

### Step E — Deliverables
- [ ] E1. `README.md` (reasoning, architecture, golden results table, known misses, honest AC14 outcome, limits, privacy/retention, production requirements not built, how to run tests).
- [ ] E2. `docs/demo/script.md` (≤ 3 minutes), screen capture draft via Playwright video, slide deck (≈ 8 slides) built with the marketing skill; list user actions required for narration/recording if not headless.
- [ ] E3. `docs/DEPLOY.md` with resource names and rollback.
- [ ] E4. Deliverables checklist recorded in the report with paths.

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| perf | `pnpm --filter @aduin/web test:e2e -- perf-budget` | Fully-Automated | AC29 |
| a11y | `pnpm --filter @aduin/web test:a11y -- a11y-keyboard` | Hybrid | AC30 |
| fund II | `pnpm --filter @aduin/web test:e2e -- fund-two` | Fully-Automated | AC59, AC60 |
| preflight | `pnpm deploy:preflight` | Fully-Automated | AC31 (zone rule), secret hygiene |
| live smoke | `BASE_URL=<workers.dev url> pnpm --filter @aduin/web test:e2e -- deployed-smoke` | Fully-Automated | AC31, AC1 (deployed), AC41–AC58 smoke |
| Free-plan conformance | `BASE_URL=<url> pnpm --filter @aduin/scripts conformance:free-plan` | Fully-Automated + Hybrid (tail) | AC40 |
| zero calls | `pnpm --filter @aduin/web test:e2e -- sample-zero-calls` (all samples) | Fully-Automated | AC34 (closing) |
| final no-LLM | `pnpm --filter @aduin/web test:e2e -- no-llm-corpus` | Fully-Automated | AC25 (closing) |
| deliverables | checklist (README, video, slides, zone-untouched listing) | Agent-Probe | AC31 (deliverables) |
| full regression | `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @aduin/web test:e2e && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | all phases |

Failing stubs for red-first: `should open the live demo sample and show the gate within three minutes`, `should show 50 percent fewer findings needing action at fund II`, `should place none of the new defects in Previously handled`, `should have no critical axe violations on main screens`, `should record no cpu limit error for every corpus document on the live worker`, `should list only aduin-transaction resources and no custom domain`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `perf-budget-corpus` | Fully-Automated | AC29 |
| `a11y-scan-and-keyboard-e2e` | Hybrid | AC30 |
| `deployed-smoke-e2e` + deliverables checklist | Fully-Automated + Agent-Probe | AC31 |
| `free-plan-limits-conformance`, `limit-exceeded-safe-failure` | Fully-Automated + Hybrid | AC40 |
| `fund-two-memory-reduction-e2e` | Fully-Automated | AC59 |
| `fund-two-zero-hidden-zero-repeat-e2e` | Fully-Automated | AC60 |

```bash
pnpm deploy:preflight && BASE_URL=<workers.dev url> pnpm --filter @aduin/web test:e2e -- deployed-smoke fund-two perf-budget
# Expected: exit 0; conformance report shows no limit errors
```

## Exit Gate

- Live URL works end to end with a sample; Free-plan conformance clean; a11y no critical violations; fund II metrics meet AC59/AC60; zero-call samples confirmed; README, video draft and slides exist.
- Zone `itsjiathao.com` untouched (preflight, account listing); no custom domain/route; no secret in repo or logs; no push.
- Program report written (final metrics: golden recall, seeded precision/recall, false-alarm ceiling, spend = $0, #9 outcome).

## Risks and Kill Criteria

- Free-model quota during precompute: split across days; if credits are never added the plan still ships (authored/recorded fallbacks stated plainly in the README).
- S1 failure: uploads run no-LLM live; samples keep precomputed AI; README states it.
- D1 rows-written budget on the live demo (M1): read-only demo fallback and per-IP `session_new` limits are on; monitor via tail.
- Turnstile or secrets misconfiguration: AI disabled with banner; deterministic app still works.
- Video narration requires the human: listed as a user action, not a blocker for VERIFIED of code gates.

## Cost / Secret Hygiene

Free models only; no paid calls (paid path disabled by config); CI and e2e use recorded data except the explicit live precompute under APPROVED-LIVE with a request cap; PDFs never sent to OpenRouter; keys only via credential files and `wrangler secret put`, never printed, logged or committed (`secrets:scan` in preflight and regression); Cloudflare resources `aduin-transaction-*` only; default workers.dev URL; zone `itsjiathao.com` never touched; no custom domain/route; no git push.

## Rollback

`wrangler rollback` (or redeploy the previous version) for the Worker; remote D1 can be re-migrated from scratch because demo data is regenerated and sandboxes are disposable; `docs/DEPLOY.md` lists teardown by resource name (`aduin-transaction-web`, `aduin-transaction-db`). Revert commits for scripts/docs.

## Blockers That Would Justify BLOCKED Status

- Credentials not approved/available for `wrangler` (user action).
- Conformance shows a Free-limit violation that no spike fallback fixes.
- A deploy would require touching the zone, a route or a custom domain (hard stop: ask the user).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md` (include APPROVED-LIVE line for the final precompute)
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S1, S2, S4, S6 (secrets, deploy, public API), S7 → 5/7 HIGH. Recommended: sequential for deploy steps (ordered, irreversible-ish), parallel read-only subagents for Step A sign-off checks (perf, a11y, fund II) and a vc-security review before the first deploy; deliverables (README/slides) can run as a parallel subagent. Sonnet for research/validation/review/docs, opus only for deploy-script code execution.

## Test Infra Improvement Notes

(none identified yet) — candidate: a CI-friendly wrapper that runs conformance against a local `wrangler dev --remote` is intentionally not added (remote only).

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-10-deploy-final_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next Step: after all earlier phases are verified (or P1 phases recorded as skipped), spawn vc-research-agent. Report the live URL, final metrics and deliverable paths; ask the user before any `git push`.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
