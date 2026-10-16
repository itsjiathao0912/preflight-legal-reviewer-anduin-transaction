---
name: plan:subdoc-qa-mvp-phase-04a-worker-proxy
description: "Sub-doc QA MVP — Phase 04a: thin Cloudflare Worker (Free): static assets, AI/OCR hold-open proxy, quotas and spend cap over ports, Turnstile, abuse protection; completes Milestone 1"
date: 17-10-26
metadata:
  node_type: memory
  type: plan
  feature: subdoc-qa-mvp
  phase: phase-04a
---

# Phase 04a — Worker Proxy, Limits, Turnstile, Abuse Protection

**Date**: 17-10-26
**Complexity**: COMPLEX
**Status**: ⏳ PLANNED
**Program:** subdoc-qa-mvp
**Umbrella plan:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp-umbrella_PLAN_17-10-26.md
**Phase status:** ⏳ PLANNED
**Milestone:** M1 vertical slice (00 → 01 → 03 → 04a): this phase closes it
**Report destination:** process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04a-worker-proxy_REPORT_17-10-26.md

---

## Overview

The Worker (Free plan) never parses documents. This phase builds the HTTP and policy layer on top of **ports** (interfaces from Phase 01 contracts): static assets serving, `POST /api/ai` and `POST /api/ocr` hold-open streaming proxies to OpenRouter, `GET /api/quota`, a cache-first lookup, spend ledger and cap logic, per-visitor and global limits, Turnstile on the first AI call, request guards (size, type, rate, Origin/CSRF), and fail-closed behavior. SQL lives in Phase 04b (`apps/worker/src/platform/*`); here the ports are implemented by an in-memory fake for tests, then integrated for real in Phase 05. It also owns `pnpm slice:check` (Milestone 1). Context routers: `process/context/all-context.md`, `process/context/tests/all-tests.md`; credentials rules in `CLAUDE.md` Project Rules.

## Phase Completion Rules

- CODE DONE = routes and tests committed.
- VERIFIED = Exit Gate green incl. `pnpm slice:check`, validate-contract written, regression: Phase 01 goldens and Phase 03 slice e2e green, spikes S1/S2/S6 verdicts applied (or fallback adopted).
- Any remote deploy (first deploy to `*.workers.dev`) is allowed unattended per the user's confirmed policy, but only: `aduin-transaction-*` resources, default `workers.dev` URL, secrets via `wrangler secret put`, never zone `itsjiathao.com`, no custom domain or route (hard stop). Phase 04a itself needs no remote deploy: all gates run locally.

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC26 | Quota/budget exhaustion survivable: 429/402/timeout/malformed → fallback, no lost work; cumulative spend tracked; refuse paid calls at the cap | `llm-failure-injection-matrix` (429, 402, timeout, malformed) + `spend-cap-enforced` | Fully-Automated | banner UI closes P05 |
| AC27 | AI/OCR results cached; same input+model+prompt+rules hash never re-calls; cache key includes rules hash | `llm-ocr-cache-hit` (here: cache key derivation + hit path over the cache port) | Fully-Automated | `cache-invalidated-by-firm-rules-change` closes P05 |
| AC32 | Per-visitor AI run limit (default 3 documents/day) with downgrade message and deterministic results intact | `per-visitor-ai-limit-e2e` (server level here: exceed → `quota_exhausted` with reason `visitor_limit`) | Fully-Automated | UI message closes P05 |
| AC33 | Global daily cap = lesser of configured cap and provider allowance; ≤ ~$10 spend; remaining allowance exposed | `global-daily-cap-and-budget` (simulated counters at/below/above caps; UTC midnight reset) | Fully-Automated | UI display closes P05 |
| AC39 | Abuse protection: rate limit, oversize/malformed rejection, no AI call without passing AC32/33, no code execution or internal fetch from uploads | `abuse-protection-matrix` (burst, oversize body, malformed JSON, wrong type, forged cookie, hostile payload text) | Fully-Automated | client hostile-HTML in P03; deployed in P10 |

## Entry Gate

- Phase 01 exit gate passed (contracts, ports, cookie helper); Phase 03 may be done or in progress (disjoint).
- S1, S2, S6 verdicts available from Phase 00 (or their pre-adopted fallbacks).

## Library pins (confirm via vc-docs-seeker in Phase 00)

wrangler, @cloudflare/vitest-pool-workers (`fetchMock` for the OpenRouter stub), Turnstile server verify endpoint and test keys, OpenRouter chat-completions and `models:[]` fallback semantics. No web framework.

## Touchpoints (create)

```
apps/worker/src/
  routes/proxy/{index.ts (fills mountProxyRoutes),ai.ts,ocr.ts,quota.ts,cache.ts}
  proxy/{guards.ts (method, Origin, custom header, content-type, size caps), pipeline.ts, stream.ts (NDJSON heartbeat), errors.ts}
  upstream/{openrouter.ts (fixed base URL, model allowlist, models:[] free-only), classify.ts (429/402/timeout/malformed), models-config.ts (env AI_TEXT_MODELS, AI_VISION_MODELS)}
  limits/{visitor.ts (cookie claim or daily-salted IP hash), policy.ts (visitor + global + rate + spend), clock.ts}
  identity/turnstile.ts (real TurnstilePort impl)
  config.ts (env typing: OPENROUTER_API_KEY, COOKIE_SIGNING_KEY, TURNSTILE_SECRET, PAID_FALLBACK_ENABLED=false, caps)
apps/worker/test/proxy/**           tests
apps/worker/test/fakes/{platform.ts} in-memory Quota/Cache/Ledger/Rules ports (also used by P05 unit tests)
scripts/src/slice-check.ts          orchestrates M1 slice check (wired to root `pnpm slice:check`)
apps/web/e2e/slice.spec.ts          (the only web file touched; owned here, created after P03 is verified)
```
Seam edit (single lines, serialized): `apps/worker/src/app.ts` wires `mountProxyRoutes` and the real `TurnstilePort`.

## Public Contracts

- `POST /api/ai`, `POST /api/ocr`, `GET /api/quota` shapes exactly as `contracts/ai.ts`, `ocr.ts`, `quota.ts` (Phase 01). Streaming responses are NDJSON: `{"t":"hb"}` heartbeats every 10 s, one final `{"t":"result",...}` or `{"t":"error","code":...}` line. The client can resume by re-requesting: the cache key makes the retry a hit.
- The Worker derives the cache key from the payload it actually forwards (hash of final messages), never from client-claimed hashes. Key = `sha256(kind|input_hash|model|prompt_ver|schema_ver|rules_hash)`; `rules_hash='none'` until Phase 05 wires the `RulesPort`.
- Units are claimed before the call and refunded on upstream failure.
- Model lists come from env; free ids only in the `models:[]` array; paid ids never mixed in; the paid call path exists but is disabled (`PAID_FALLBACK_ENABLED=false`) and refuses without credits and without being under the $10 cap.
- PDFs are never accepted by `/api/ocr` (images only); no `file` content type and no `file-parser` plugin are ever emitted.
- Cache hits cause no D1 write (no `hits` update) to protect the rows-written budget.
- Fail-closed: if the platform ports are unreachable, AI/OCR return `quota_exhausted`/`memory_unavailable` style degrade responses and the client runs no-LLM.
- Defaults (locked, see umbrella): visitor 3 AI documents/day (≤ 8 requests/day) and ≤ 6 OCR pages/day; global 35 AI requests/UTC day (configurable; raise only after credits exist); rate limit 30 requests/min per visitor, 6/min for AI; bodies: AI ≤ 128 KB, OCR ≤ 700 KB, others ≤ 64 KB.

## Blast Radius

`apps/worker/src/{routes/proxy,proxy,upstream,limits,identity/turnstile.ts,config.ts}`, `apps/worker/test/{proxy,fakes}`, `scripts/src/slice-check.ts`, `apps/web/e2e/slice.spec.ts`, seam line in `apps/worker/src/app.ts`. Disjoint from Phase 04b (`migrations`, `seed`, `platform`, `memory`, `routes/memory`) and Phase 03 (`apps/web/src`). Registry `## Phase 04a`.

## Data Flow

Browser → `/api/ai` (cookie + custom header + Origin) → guards (size/type/method) → identity (cookie claim or salted IP hash) → Turnstile (first AI call only; token then cached in the signed cookie claim) → policy claims (visitor, global, rate) via `QuotaPort` → cache lookup via `CachePort` → hit: stream result; miss: OpenRouter call (hold open, NDJSON heartbeats) → classify/validate output → cache write → ledger write → final line. Failure: refund claims, return degrade code.

## Failure Modes

429 (honor `Retry-After`, move to next free model in the list), 402 (negative balance: stop paid and free, switch client to no-LLM), timeout (refund + `upstream_failed`), malformed JSON (one repair attempt without a new paid call, else reject), ports down (fail-closed), oversize/forged input (reject before any claim).

## Implementation Checklist

### Step A — Guards and identity
- [ ] A1. `proxy/guards.ts`: method allowlist, `Origin` equals own origin for mutating calls, custom header `x-aduin-client: 1`, content-type allowlist, per-route size caps (reject on `content-length` and on streamed read).
- [ ] A2. `limits/visitor.ts`: verify cookie via core `session/cookie.ts`; otherwise visitor id = HMAC(daily-salt, ip); no D1 read.
- [ ] A3. Test: `abuse-protection-matrix` guard rows (oversize, wrong type, missing header, forged cookie).

### Step B — Policy and ports
- [ ] B1. `limits/policy.ts`: ordered claims (rate → visitor → global → spend) with refund; UTC-day windows via `clock.ts`; tests at, below and above the caps and at UTC midnight (`global-daily-cap-and-budget`).
- [ ] B2. `test/fakes/platform.ts` (in-memory ports implementing the same semantics as the future SQL: claim succeeds iff count+units ≤ cap).
- [ ] B3. Spend: cost accumulates in micro-USD; paid path gated by `PAID_FALLBACK_ENABLED` and the cap (`spend-cap-enforced`).

### Step C — Upstream
- [ ] C1. `upstream/openrouter.ts`: fixed base URL from env, allowlisted models, `temperature: 0`, `models:[free ids]`, strict `json_schema` response format, `max_tokens` bounded (never ~4000 for reasoning models: use 6000 for text per P2 probe, 8000 for vision JSON; confirm in S3).
- [ ] C2. `upstream/classify.ts` and the failure matrix (`llm-failure-injection-matrix`) with `fetchMock`.
- [ ] C3. `proxy/stream.ts`: NDJSON hold-open with heartbeat; abort handling; never relies on `waitUntil`.

### Step D — Routes
- [ ] D1. `routes/proxy/ai.ts`, `ocr.ts`, `quota.ts`, `cache.ts` per contracts; `index.ts` fills `mountProxyRoutes`.
- [ ] D2. `identity/turnstile.ts`: verify via the siteverify endpoint; tests use Cloudflare's documented dummy secret keys; token verified once, then `t` claim set in the session cookie.
- [ ] D3. Cache path: derive key, read via port, hit streams immediately (`llm-ocr-cache-hit`).

### Step E — Slice check (Milestone 1)
- [ ] E1. `scripts/src/slice-check.ts` + root `pnpm slice:check`: run `pnpm --filter @aduin/core test:golden`, build web, start `wrangler dev` (local), run `apps/web/e2e/slice.spec.ts`, call `GET /api/quota` and assert 200 JSON, run guards.
- [ ] E2. `slice.spec.ts`: open sample #1 → finding "this Section 11" listed and highlighted; open #3 → both swapped-reference findings; open #11 → undefined-term finding; no console errors; `/api/quota` reachable through the dev stack.

## Test Gates (commands created in this phase)

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| failure matrix | `pnpm --filter @aduin/worker test -- llm-failure-injection-matrix spend-cap-enforced` | Fully-Automated | AC26 |
| cache | `pnpm --filter @aduin/worker test -- llm-ocr-cache-hit` | Fully-Automated | AC27 (key + hit path) |
| visitor limit | `pnpm --filter @aduin/worker test -- per-visitor-ai-limit` | Fully-Automated | AC32 |
| global cap | `pnpm --filter @aduin/worker test -- global-daily-cap-and-budget` | Fully-Automated | AC33 |
| abuse | `pnpm --filter @aduin/worker test -- abuse-protection-matrix` | Fully-Automated | AC39 |
| query/CPU budget | `pnpm --filter @aduin/worker test -- proxy-budget` (counts port calls ≤ 12 per AI request) | Fully-Automated | AC40 interim |
| slice | `pnpm slice:check` | Fully-Automated | Milestone 1 (supports AC3, AC4, AC11–AC13 end to end) |
| remote CPU | S1/S2/S6 verdict applied | Agent-Probe | AC40 residual (local cannot enforce CPU) |
| regression | `pnpm --filter @aduin/core test:golden && pnpm --filter @aduin/web test:e2e && pnpm guard:cf && pnpm secrets:scan` | Fully-Automated | earlier phases |

Failing stubs for red-first: `should return quota_exhausted when the visitor exceeds the daily AI documents`, `should refuse a paid call at the spend cap`, `should refund claimed units when upstream fails`, `should reject a body over the cap before claiming quota`, `should serve a cache hit without calling upstream`, `should never emit a file content part or file-parser plugin`.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `llm-failure-injection-matrix`, `spend-cap-enforced` | Fully-Automated | AC26 |
| `llm-ocr-cache-hit` | Fully-Automated | AC27 |
| `per-visitor-ai-limit-e2e` (server level) | Fully-Automated | AC32 |
| `global-daily-cap-and-budget` | Fully-Automated | AC33 |
| `abuse-protection-matrix` | Fully-Automated | AC39 |
| `pnpm slice:check` | Fully-Automated | Milestone 1 (AC11, AC12, AC13 visible end to end) |

```bash
pnpm --filter @aduin/worker test && pnpm slice:check
# Expected: exit 0; slice spec shows sample #1 finding highlighted through the local Worker stack
```

## Exit Gate

- All gates green; no secret or zone reference (`guard:cf`, `secrets:scan`); no live OpenRouter call made (all via `fetchMock`).
- Milestone 1 recorded in the report: AC proven so far, screenshots, known gaps.
- Phase report written.

## Risks and Kill Criteria

- S1 fail (hold-open cannot survive): keep the code path but default `AI_UPLOADS_ENABLED=false`; uploads run no-LLM; samples use precomputed results (Phase 05/10).
- S2 fail: shrink images / template body; OCR for visitors capped or off.
- Free-model 429 churn: model list configurable; no gemma-4 default.
- Worker script size (S6): avoid zod in the hot path if gz size > 1 MiB.

## Cost / Secret Hygiene

Tests use `fetchMock` only (no network). No live OpenRouter calls in this phase. Keys are read from `env` only, never logged (log helper redacts `authorization`, `x-api-key`, bodies). Free models only; paid path disabled by config and by default. PDFs never reach OpenRouter. No Cloudflare route or custom domain; zone `itsjiathao.com` untouched (`guard:cf`).

## Rollback

`git revert` phase commits; the stub `mountProxyRoutes` from Phase 00 returns. No data created (ports are fakes).

## Blockers That Would Justify BLOCKED Status

- Ports contract (Phase 01) cannot express a required operation (contract-change note, then re-freeze).
- pool-workers cannot stub outbound fetch as documented (route to Phase 00 REF for alternative).

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical 7-step inner loop `R → I → P → PVL → E → EVL → UP` SKIPS SPEC (SPEC runs once in the outer program loop).

- [ ] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md`
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals: S2 (API/auth surface), S4, S6 (secrets, trust boundary, public endpoint), S7 → 4/7 HIGH. Recommended: sequential (single route/policy subtree) with a read-only security review subagent (vc-security STRIDE pass on guards and identity) before PVL. Sonnet for research/validation/review, opus for code execution.

## Test Infra Improvement Notes

(none identified yet) — candidate: shared `OpenRouterStub` helper reused by Phases 05, 06.

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-04a-worker-proxy_PLAN_17-10-26.md`
- Last completed step: not started
- Validate-contract status: pending
- Next Step: after Phase 01 (and ideally Phase 03) are verified, spawn vc-research-agent. When this phase is VERIFIED, Milestone 1 is complete: run `pnpm slice:check` and report. Next phases: Phase 02 and Phase 04b in parallel.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
