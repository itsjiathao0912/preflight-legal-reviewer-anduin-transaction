---
name: plan:subdoc-qa-mvp-phase-05-llm-ai-lane
description: "Sub-doc QA MVP — Phase 05: LLM task framework, recorded responses, AI lane UI, provenance, quota banners, firm-rule injection and rules_hash cache keys"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-05
---

# Phase 05 — LLM Tasks, Recordings, AI Lane, Rules Injection

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-05-llm-ai-lane_REPORT_17-10-26.md

---

## Overview

Wires AI judgment on top of the deterministic engine without ever making it a dependency. Core gets a typed **LLM task framework** (versioned prompts, strict JSON schema, quote-must-exist verification, snapping to the document's own sentence), two tasks (batched clause judgment over graph-selected candidates; counsel-question draft), and a recorded-response transport so CI makes zero live calls. The web gets the **AI lane**: pending/fresh/from-cache/skipped states, provenance chips, allowance display, automatic downgrade banners with reason and what is skipped, AI toggle effect, streaming client with resume. The Worker (Phase 04a proxy) gets real ports (Phase 04b) and the `RulesPort` so active firm rules are injected by the Worker and `rules_hash` joins the cache key. Lookup order everywhere: static `/precomputed/{docHash}.{rulesHash8}.json` → D1 cache → LLM. Context routers: `process/context/all-context.md`, `process/context/tests/all-tests.md`, `process/context/ui/all-ui.md`.

UI contract: approved mockup `design/mockups/review-workspace.html` already specifies the AI stage, "No AI" state, banner, allowance and provenance chips; this phase implements them with the Phase 03 tokens (no new screen). Step A0 records a mockup check of the banner variants (quota out, daily cap, per-visitor limit, budget, provider error, rules changed) as a small sketch under `design/mockups/ai-states.html` reusing tokens; self-review with minimalist-ui and the tells checklist.

## Phase Completion Rules

- CODE DONE = framework, UI, Worker wiring, tests committed.
- VERIFIED = Exit Gate green, validate-contract written, prompts frozen (`PROMPT_VERSION` per task recorded), regression: Phase 04a/04b suites and Phase 03 e2e green. Any live free-model recording run needs an APPROVED-LIVE line in the validate-contract stating the maximum request count (free models only, no paid calls ever); without it recordings are schema-valid authored fixtures and AC28/AC51 stay Hybrid with the residual named.
- User confirmed: paid LLM calls stay disabled for the whole program (free-only).

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC28 | AI never invents evidence: every AI finding quotes text that literally appears; unlocatable quotes rejected/demoted and logged | `llm-quote-must-exist` over recorded responses (incl. a hallucinated-quote recording) | Hybrid (automated over recorded responses; the live-model behavior is the residual) | — |
| AC34 | Opening a bundled sample (or identical doc) with the same model/prompt makes zero new AI/OCR calls | `sample-open-zero-llm-calls` (call counter = 0 on second open; static→D1→LLM order) | Fully-Automated | all samples pre-warmed closes P10 |
| AC35 | Auto downgrade with banner naming reason and what is skipped; AI resumes after reset without manual action | `auto-downgrade-banner-e2e` (inject each reason) + `ai-resume-after-reset` | Fully-Automated | — |
| AC36 | Fresh vs cached visible per AI finding/draft; rule id for deterministic | `provenance-fresh-vs-cache-ui` | Fully-Automated | — |
| AC51 [P1] | Firm rules go to the AI as context, never as a filter; one firm's rules never given for another | `firm-rule-in-context-recorded-llm` + `firm-rule-isolation` | Hybrid | UI to add rules closes P08b |

Closes verification for: AC26 (banner UI), AC27 (`cache-invalidated-by-firm-rules-change`), AC32/AC33 (messages and allowance visible), AC3 (AI "pending").

## Entry Gate

- Phases 02, 03, 04a, 04b verified (detectors for candidate selection, web shell, proxy, ports and rules read).
- Phase 00 REF: S1 verdict (if hold-open failed, build only the cached/precomputed path and the "AI for your own documents is unavailable" state; the framework and tests stay).

## Library pins (confirm via vc-docs-seeker in Phase 00)

zod (JSON schema conversion for `response_format`; confirm `zod-to-json-schema`-equivalent support for the pinned zod), Comlink, Dexie, Vitest, Playwright. OpenRouter strict `json_schema` format and `models:[]` fallback.

## Touchpoints (create/modify)

```
packages/core/src/llm/{task.ts,transport.ts (LiveTransport via /api/ai, RecordedTransport),verify-quote.ts,snap-sentence.ts,candidates.ts,prompts/{clause-judgment.v1.ts,counsel-draft.v1.ts},schemas.ts,provenance.ts}
packages/core/src/index.ts                       (append exports)
packages/core/test/recorded/**                   task tests over recordings
fixtures/llm-recordings/{clause-judgment,counsel-draft}/*.json   keyed by input hash (+ hostile/malformed/hallucinated-quote cases)
apps/web/src/features/ai/{ai-lane.ts,AiBanner.tsx,Allowance.tsx,Provenance.tsx,stream-client.ts,precomputed.ts}  (registered via registry.ts)
apps/web/src/features/review/** (modify: show AI findings, pending state)   [owned by P03; seam edit documented]
apps/web/e2e/{auto-downgrade,ai-resume,provenance,sample-zero-calls}.spec.ts
apps/worker/src/routes/proxy/ai.ts (modify: wire RulesPort, rules_hash, rules block injection)   [owned by P04a; extension documented]
apps/worker/src/platform/rules.ts (read only; implemented in P04b)
apps/worker/test/proxy/{firm-rule-isolation,cache-invalidated-by-firm-rules-change}.test.ts
scripts/src/record/{record-ai.ts}  (`pnpm record:ai`, live, guarded)
scripts/src/precompute/precompute-ai.ts (`pnpm precompute:ai`, live, guarded; final run in P10)
design/mockups/ai-states.html
```

## Public Contracts

- `LlmTask<I,O> {id, promptVersion, schemaVersion, buildMessages(input, rulesBlock), outputSchema, validate}`; `PROMPT_VERSION` bump invalidates caches and precomputed files by design.
- AI findings: `detector_kind='ai'`, `model` set, `provenance` fresh|cache, severity ≤ `high` (cannot be `critical`), labeled "AI suggestion", never counted by the gate unless the analyst promotes (edits severity to critical or accepts and marks needs counsel with a decision) — the gate stays deterministic-first.
- Quote handling: normalized substring search in the document; located quote is snapped to the document's sentence (fingerprint uses the document sentence, never the model wording); quote > 1000 chars rejected; unlocatable → rejected/demoted and logged in the run.
- Worker injects rules: `RulesPort.activeRuleTexts(firmId)` (≤ 20 rules, ≤ 500 chars each, ≤ 4 KB total) into a delimited block; `rules_hash = sha256(sorted normalized rule texts)` or `'none'`; cache key includes it; a rules change causes a miss and a fresh run within the usual caps; if caps are hit the lane shows "rules changed, AI re-run unavailable" and serves no stale-rules AI findings.
- Models from env: text `nvidia/nemotron-3-super-120b-a12b:free`, vision (Phase 06) `nvidia/nemotron-3.5-super-vl:free`; never `openrouter/free`; gemma-4 ids are not defaults. `PAID_FALLBACK_ENABLED=false`.
- Static precomputed path: `/precomputed/{docHash}.{rulesHash8}.json` (`rulesHash8` of demo/sandbox seed rules is identical, so AC34 holds for samples).
- Client contract: NDJSON stream with heartbeats; on disconnect re-request (cache key makes it a hit); abort supported; deterministic review is usable at all times.

## Blast Radius

`packages/core/src/llm/**`, `packages/core/test/recorded/**`, `fixtures/llm-recordings/**`, `apps/web/src/features/ai/**`, e2e specs, `apps/worker/src/routes/proxy/ai.ts` (extension), `apps/worker/test/proxy/{firm-rule-isolation,cache-invalidated*}`, `scripts/src/{record,precompute/precompute-ai.ts}`, `design/mockups/ai-states.html`. Parallel-safe with Phase 06 and Phase 09 (disjoint except append-only seams). Registry `## Phase 05`.

## Data Flow

Deterministic findings → `candidates.ts` (graph-selected neighborhoods, capped) → one batched request via `/api/ai` (`law_firm_id`, candidates, prompt/schema versions) → Worker: guards → Turnstile (first call) → rules read → `rules_hash` → quota claims → cache lookup (key from forwarded messages) → upstream (free `models:[]`) → validate → cache + ledger → NDJSON result → client verifies quotes against the document → AI findings merged with provenance. Counsel-draft task runs per sheet in Phase 08 through the same path.

## Failure Modes

Upstream 429/402/timeout/malformed → degrade with reason code → banner and no-LLM continuation (deterministic results untouched); Turnstile failure → "verification needed" state, no AI; rules read fails → no AI (never run without the firm's rules once a firm is set); model returns hallucinated quote → demoted and logged; model output schema-invalid after one repair → rejected, banner "AI result unusable".

## Implementation Checklist

### Step A — Framework and tasks
- [ ] A0. Mockup check `design/mockups/ai-states.html` (banner variants and allowance) reusing tokens.
- [ ] A1. `llm/task.ts`, `transport.ts` (Live + Recorded), `schemas.ts`, `provenance.ts`.
- [ ] A2. `verify-quote.ts` + `snap-sentence.ts` with property tests (case/space/quote-style tolerant locate; snaps to document sentence).
- [ ] A3. `candidates.ts` (select clause neighborhoods: unresolved/suspicious references, conditionals, option groups, defined-term anomalies; cap by count and bytes).
- [ ] A4. Prompts `clause-judgment.v1` (strict schema: class, quote, location, explanation, severity ≤ high, confidence, interpretations[]; temperature 0) and `counsel-draft.v1`; freeze `PROMPT_VERSION`.

### Step B — Recordings and recorded tests
- [ ] B1. `RecordedTransport` fixture format `{taskId, inputHash, model, response, meta}`; author schema-valid recordings for samples #1 and #3 plus hostile cases (hallucinated quote, prose around JSON, extra keys).
- [ ] B2. Tests: `llm-quote-must-exist`, schema validation, snapping, severity cap, `sample-open-zero-llm-calls` (call counter).
- [ ] B3. `record-ai.ts` (live; refuses unless `ALLOW_LIVE_LLM=1` and `--max-requests N` ≤ approved count; free models only; prints counts, never keys); run only under APPROVED-LIVE to replace authored recordings with real ones.

### Step C — Worker wiring
- [ ] C1. Wire `RulesPort` into `/api/ai`: injection block, `rules_hash`, key derivation; unit tests with the fake and then with the D1 platform.
- [ ] C2. Tests: `cache-invalidated-by-firm-rules-change`, `firm-rule-in-context-recorded-llm` (rule present in the forwarded messages; a still-flagged item survives), `firm-rule-isolation` (firm A's rules never appear for firm B), proposed rules never injected.
- [ ] C3. Integration test with the real D1 platform: failure matrix from Phase 04a re-run against D1-backed ports.

### Step D — Web AI lane
- [ ] D1. `ai-lane.ts` state machine (pending, fresh, cache, skipped(reason)); stage stepper integration; allowance from `/api/quota`; AI toggle effect.
- [ ] D2. `AiBanner` per reason (quota out, daily cap, per-visitor limit, budget, provider error, rules changed, S1-fallback "AI for your own documents is unavailable") naming what is skipped; auto-resume at next UTC day via quota poll.
- [ ] D3. `Provenance` chips (rule id vs model + fresh/cache) on findings and AI drafts.
- [ ] D4. `precomputed.ts`: static → D1 → LLM order; zero-call guarantee for samples.
- [ ] D5. e2e: `auto-downgrade`, `ai-resume`, `provenance`, `sample-zero-calls` (route interception counts `/api/ai` calls).

### Step E — Precompute scaffolding (final run in Phase 10)
- [ ] E1. `precompute-ai.ts` writes `apps/web/public/precomputed/*.json` from live free-model calls only under APPROVED-LIVE (≈ 13 documents + drafts; split across UTC days when the free 50/day would be exceeded); `--dry-run` lists planned requests.

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| quote/schema | `pnpm --filter @aduin/core test -- llm-quote-must-exist llm-schema` | Hybrid (recorded responses) | AC28 |
| zero calls | `pnpm --filter @aduin/web test:e2e -- sample-zero-calls` | Fully-Automated | AC34 |
| downgrade/resume | `pnpm --filter @aduin/web test:e2e -- auto-downgrade ai-resume` | Fully-Automated | AC35 |
| provenance | `pnpm --filter @aduin/web test:e2e -- provenance` | Fully-Automated | AC36 |
| rules | `pnpm --filter @aduin/worker test -- firm-rule-in-context firm-rule-isolation cache-invalidated-by-firm-rules-change` | Hybrid / Fully-Automated | AC51, AC27 |
| matrix on D1 | `pnpm --filter @aduin/worker test -- llm-failure-injection-matrix spend-cap-enforced per-visitor-ai-limit global-daily-cap-and-budget` | Fully-Automated | AC26, AC32, AC33 closing |
| live recording (optional) | `pnpm --filter @aduin/scripts record:ai -- --max-requests <approved>` | Agent-Probe (APPROVED-LIVE only) | AC28 residual |
| regression | `pnpm --filter @aduin/core test:golden && pnpm --filter @aduin/worker test && pnpm --filter @aduin/web test:e2e -- slice triage-actions && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | earlier phases |

Failing stubs for red-first: `should reject an AI finding whose quote is not in the document`, `should snap the fingerprint quote to the document sentence`, `should not exceed severity high for AI-only findings`, `should make zero /api/ai calls when opening a precomputed sample`, `should show the banner naming the reason and what is skipped when quota is out`, `should miss the cache after the firm rules change`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `llm-quote-must-exist` | Hybrid | AC28 |
| `sample-open-zero-llm-calls` | Fully-Automated | AC34 |
| `auto-downgrade-banner-e2e`, `ai-resume-after-reset` | Fully-Automated | AC35 |
| `provenance-fresh-vs-cache-ui` | Fully-Automated | AC36 |
| `firm-rule-in-context-recorded-llm`, `firm-rule-isolation` | Hybrid | AC51 |
| `cache-invalidated-by-firm-rules-change` | Fully-Automated | AC27 (closing) |
| failure matrix on D1-backed ports | Fully-Automated | AC26 (closing) |

```bash
pnpm --filter @aduin/core test && pnpm --filter @aduin/worker test && pnpm --filter @aduin/web test:e2e -- auto-downgrade ai-resume provenance sample-zero-calls
# Expected: all exit 0; zero network calls to OpenRouter in CI
```

## Exit Gate

- All gates green; prompts frozen and versions recorded; recordings committed; no live call in CI.
- If APPROVED-LIVE was used: request count, models and costs (all `0`) recorded in the report; no key printed anywhere (`secrets:scan`).
- Phase report written.

## Risks and Kill Criteria

- Free-model quality (P2: valid JSON 4/4 but flagged the golden only 3/4, wrong fix 2/4): AI is a second opinion, never the detector; labeled "AI suggestion".
- Latency 28–90 s: streaming with progress; deterministic review is available first.
- S1 fail: build only cached/precomputed path; mark live AI for uploads disabled by config; AC35 behavior shows the permanent-downgrade banner; AC34 unaffected.
- Prompt churn after precompute (M11): freeze here; any later prompt change forces re-precompute and a report note.

## Cost / Secret Hygiene

Free models only; `PAID_FALLBACK_ENABLED=false` (paid path built, disabled, untested live); CI uses `RecordedTransport` and `fetchMock` only; live recording only under APPROVED-LIVE with a request cap (OpenRouter free: 20/min, 50/day without credits); `openrouter/free` never used; PDFs never sent to OpenRouter; keys only in env/`.dev.vars`/Workers secrets, never printed or logged; Cloudflare resources `aduin-transaction-*`, zone untouched.

## Rollback

`git revert` phase commits; the AI lane is gated by the AI toggle and config so no-LLM mode (Phases 03/04) is unaffected; remove precomputed files and recordings by reverting.

## Blockers That Would Justify BLOCKED Status

- Strict JSON schema from the pinned zod cannot be expressed for OpenRouter `json_schema` (route to a hand-written JSON schema).
- Workers cannot hold the stream long enough and S1 fallback is not accepted by the user.

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md` (include APPROVED-LIVE line or its absence)
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S1, S2, S4, S6 (secrets, prompt injection surface via firm rules), S7 → 5/7 HIGH. Recommended: agent team of 2–3 (core/LLM, web lane, worker wiring) sharing a TaskList because the contracts (`rules_hash`, NDJSON shape) must stay aligned; vc-security review of rules injection (delimited block, length caps) before PVL. Sonnet for research/validation/review; opus for the code execution leg.

## Test Infra Improvement Notes

(none identified yet) — candidate: a shared `OpenRouterStub` and `RecordedTransport` helper promoted to `packages/core/test/helpers`.

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-05-llm-ai-lane_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next Step: after Phases 02, 03, 04a, 04b are verified, spawn vc-research-agent. Parallel-safe with Phases 06 and 09. Phase 07 (narrative task) and Phase 08 (counsel draft) depend on this framework.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
