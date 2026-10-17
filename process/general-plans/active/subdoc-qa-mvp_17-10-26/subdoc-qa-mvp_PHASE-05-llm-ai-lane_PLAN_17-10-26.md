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

UI contract (source: `design/mockups/app.html` + `app_NOTES.md`, NOT review-workspace.html): the approved mockup already specifies the AI stage, "No AI" state, banner, allowance and provenance chips; this phase implements them with the Phase 03 tokens (no new screen). Step A0 (optional, not a gate) records a mockup check of the banner variants (quota out, daily cap, per-visitor limit, budget, provider error, rules changed) as a small sketch under `design/mockups/ai-states.html` reusing tokens; self-review with minimalist-ui and the tells checklist.

## Phase Completion Rules

- CODE DONE = framework, UI, Worker wiring, tests committed.
- VERIFIED = Exit Gate green, validate-contract written, prompts frozen (`PROMPT_VERSION` per task recorded), regression: Phase 04a/04b suites and Phase 03 e2e green. Any live free-model recording run needs an APPROVED-LIVE line in the validate-contract stating the maximum request count (free models only, no paid calls ever); without it recordings are schema-valid authored fixtures and AC28/AC51 stay Hybrid with the residual named.
- User confirmed: paid LLM calls stay disabled for the whole program (free-only).

## Acceptance Criteria

| AC | Statement (short) | proven by | strategy | Closing / extra |
|---|---|---|---|---|
| AC28 | AI never invents evidence: every AI finding quotes text that literally appears; unlocatable quotes rejected/demoted and logged | `llm-quote-must-exist`, `ai-severity-cap`, `ai-mask-before-storage` over recorded responses (incl. a hallucinated-quote recording) | Hybrid (automated over recorded responses; the live-model behavior is the residual) | — |
| AC34 | Opening a bundled sample (or identical doc) with the same model/prompt makes zero new AI/OCR calls | `sample-zero-calls` (call counter = 0 on open of #1 and #3; static→/api/ai order; bundled samples show `not_precomputed` + explicit "Run AI on this sample" button, never auto-call) | Fully-Automated | all samples pre-warmed closes P10 |
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
packages/core/src/llm/{task.ts,transport.ts (LiveTransport via /api/ai + RecordedTransport types),verify-quote.ts,candidates.ts,schemas.ts,provenance.ts,rules.ts,wire.ts,registry.ts}
packages/core/src/llm/tasks/{clause-judgment.v1.ts,counsel-draft.v1.ts}     (renamed from llm/prompts; registry.ts exports TASKS)
  - NO llm/snap-sentence.ts: reuse existing packages/core/src/memory/snap.ts snapToSentence
  - rules.ts: normalize/sort/cap/delimit rules block + `injectedRulesHash` (G3: reuses existing core `memory/rulesHash.ts` `rulesHash` over the INJECTED set under a distinct export name; NO second `rulesHash` in the barrel; also used client-side for rulesHash8)
  - wire.ts: model-facing hand-written strict JSON schema builders + inputHash helper (sha256 hex of exact forwarded messages JSON)
packages/core/src/contracts/ai.ts                (additive: AiRequestSchema optional `task` enum default clause-judgment; AiResultSchema optional `drafts:[{candidate_id,text<=1500}]`; contracts snapshot regenerated with a change note naming exactly these two fields; G9: the `task` enum and draft shape stay module-private in contracts/ai.ts, no new exported `*Schema`)
packages/core/src/index.ts                       (append exports)
packages/core/src/detectors/** (F4: bounded defined-term scan via index; P2-3 explain() total on sparse facts; P2-4 "(check one)" exclusivity cue -- VERIFY exact backlog content)
packages/core/test/recorded/**, packages/core/test/helpers/recorded-transport.ts (throws on miss, no network)
fixtures/llm-recordings/{clause-judgment,counsel-draft}/{inputHash16}.json   {taskId,promptVersion,inputHash,model,messagesDigest,response{raw,parsed},meta{authored|live,served_model,tokens,recordedAt}}; authored #1, #3, hostile set, one counsel-draft sample
apps/worker/src/proxy/pipeline.ts (order: identity -> rules resolve -> build messages -> inputHash -> cacheKey(rules_hash) -> cache read -> miss only: Turnstile, claims, upstream)
apps/worker/src/proxy/guards.ts (shapeAi passes `task`)
apps/worker/src/proxy/ports.ts (G1: additive per-request factory `ProxyPlatform.rulesFor?(workspaceId)` returning a RulesPort; the unbound `ProxyPlatform.rules` seam stays unused)
apps/worker/src/index.ts (G1: buildApp wires `rulesFor` via `createRulesPort(env.DB, workspaceId)`; buildApp caches the platform per D1 binding, so the workspace-bound port MUST be built per request)
apps/worker/src/upstream/classify.ts (G2: task-aware; wraps model JSON into the envelope adding v:1 and usage, validates ONCE, drops invalid findings individually)
apps/worker/src/config.ts (G2: new DEFAULT_TEXT_MODELS = nvidia/nemotron-3-super-120b-a12b:free; AI_RESPONSE_MODE parsing)
apps/worker/test/fakes/platform.ts (G1: count the rules call in platform.calls)
apps/worker/test/proxy/{free-only-config.test.ts (update if it pins the old list),proxy-budget.test.ts (BUDGET 13 + workspace+firm miss scenario),llm-failure-injection-matrix-d1.test.ts (NEW)}
apps/worker/src/upstream/{openrouter.ts (aiMessages -> TASKS),models-config.ts}
apps/worker/src/routes/proxy/ai.ts, apps/worker/wrangler.jsonc (AI_TEXT_MODELS = nvidia/nemotron-3-super-120b-a12b:free only; AI_RESPONSE_MODE constant)
apps/worker/src/platform/rules.ts (read only; ProxyPlatform.rules seam, createRulesPort(db,w) active rules only)
apps/worker/test/** (rules-injection-delimited-hostile, rules-caps, proposed-rule-never-injected, rules-hash-stable-and-order-independent, rules-read-fail-refuses-no-upstream, no-workspace-ignores-law-firm-id, cache-hit-zero-claims-with-rules, cache-invalidated-by-firm-rules-change, firm-rule-isolation, firm-rule-in-context-recorded-llm, record-body-parity, port-call-budget update)
apps/web/src/api/** (G7: directory ALREADY EXISTS with client.ts, memoryApi.ts, stubMemoryApi.ts: EXTEND with the generic NDJSON/cookie/header stream client, do not recreate; ALSO reused by Phase 06 OCR; G13: `memoryApi.ts` gains `MemoryApi.firmRules(firmId)` (real client backed by existing GET /api/memory/firm) and `stubMemoryApi.ts` gains its stub; G14: quota/API-base detection lives in the stream/quota client here)
apps/web/public/precomputed/{docHash}.{rulesHash8}.json (G6: committed, NOT gitignored, NOT generated at build; samples #1 and #3 only; Phase 06 owns public/precomputed/ocr, untouched here)
apps/web/src/features/ai/{ai-lane.ts,stream-client.ts,turnstile.ts (token-provider seam only),AiBanner.tsx,Allowance.tsx,Provenance.tsx,precomputed.ts}
apps/web/src/features/review/** (seam: AI findings, pending, U1 locator chip render), apps/web/src/engine/engine.worker.ts (additive toView: section path + paragraph; G12/G13: new EngineApi method `verifyAi(result, docHash, injectedRuleTexts: string[])` runs the AI verify chain in the worker and returns verified FindingViews plus `rulesHash8`; `analyze` additionally returns optional `aiCandidates` built by `llm/candidates.ts` from the DocGraph, and the worker retains the last 2 analyzed graphs keyed by docHash (bounded LRU of 2)), apps/web/src/engine/{types.ts,client.ts} (G12: EngineApi/FindingView additive types and the Comlink client method)
apps/web/test/import-graph.test.ts (G12: MUST-STAY-GREEN gate, assertions unchanged, ALLOWED list NOT extended)
apps/web/test/engine-ai-api.test.ts (G13: NEW gate, token `engine-ai-api`: analyze returns aiCandidates, verifyAi with retained/evicted docHash, rule-text hash parity)
apps/web/e2e/status-stages.spec.ts (G11: assertion update to the new AI-stage strings)
apps/web/src/{state/session.ts,shell/AiSwitch.tsx,features/processing/StageStatus.tsx,storage/db.ts}
apps/web/e2e/{auto-downgrade,ai-resume,provenance,sample-zero-calls,ai-banners (incl. AI toggle-off case),locator-chip}.spec.ts
scripts/src/record/record-ai.ts, scripts/src/precompute/precompute-ai.ts (--from-recordings offline, --dry-run), scripts/test/precompute-ai.test.ts, scripts/package.json
apps/worker/test/proxy/rules-hash-seed-parity.test.ts; packages/core/test/**/{explanation-present-per-rule (extend),check-one-exclusivity-cue (NEW)}.test.ts
process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-05/ (G8: 5-artifact evidence pack)
apps/web/vite.config.ts (G16: `define` VITE_API_BASE '/' for non-e2e modes, '' for --mode e2e), apps/web/src/e2e-hook.ts (G16: IS_E2E-guarded `setApiBase(base)`; absent from the production bundle, `no-e2e-hook-in-dist` stays green)
design/mockups/ai-states.html (optional state sheet)
```

## Public Contracts

- `LlmTask {id, promptVersion, schemaVersion, requestKind, buildMessages(input, rulesBlock), modelResultSchema, validate}`; shared versioned registry `TASKS` in `packages/core/src/llm/registry.ts`. The Worker imports TASKS to build messages; the client never sends prompts. Cache key `prompt_ver` = `task.promptVersion` (replaces `PROMPT_VER.ai` 'p1'; ocr untouched). A version bump invalidates caches and precomputed files by design.
- Additive wire contract only: `AiRequestSchema` optional `task` enum (default `clause-judgment`); `AiResultSchema` optional `drafts: [{candidate_id, text<=1500}]`. G9: `task` enum and draft shape are module-private in `contracts/ai.ts` (no new exported `*Schema`, otherwise extra snapshot entries appear). Snapshot regenerated with `pnpm --filter @aduin/core exec vitest run -u contracts` (verify the form; if `pnpm --filter @aduin/core test contracts -u` forwards `-u` it is equivalent), then a REQUIRED diff review limited to the `ai.AiRequestSchema` and `ai.AiResultSchema` entries; change note names exactly these two fields; no other contract change.
- Model-facing schema is hand-written strict JSON (all keys required; no ext/usage/v); Worker wraps into the full envelope and validates with AiResultSchema + task validator. `strict:true`, NO `provider.require_parameters`, NO repair retry. Worker constant `AI_RESPONSE_MODE` (`json_schema` | `json_object` + schema in prompt) chosen by live probe R1/R2.
- Models: `AI_TEXT_MODELS` = `nvidia/nemotron-3-super-120b-a12b:free` only (P2-proven); `nemotron-3.5-super-vl:free` stays vision-only (Phase 06); never `openrouter/free`; `PAID_FALLBACK_ENABLED=false`.
- AI findings: `detector_kind='ai'`, `model` set, `provenance` fresh|cache, severity capped at `high` (AI-only can never gate), labeled "AI suggestion"; counted by the gate only if the analyst promotes.
- G12 import-graph rule (strict, orchestrator decision): the main thread imports no core values beyond the existing `apps/web/test/import-graph.test.ts` allow-list (ALLOWED is NOT extended). The whole verify chain below (quote locate, `snapToSentence`, severity cap, masking, `injectedRulesHash`/`rulesHash8`, `AiResultSchema` validation) runs inside `engine.worker.ts`, which already holds the parsed document, via the additive `EngineApi.verifyAi(result, docHash)` returning verified FindingViews; `rulesHash8` is computed in the worker and returned with the analysis result for the precomputed lookup path. The main-thread `stream-client.ts` only parses NDJSON frames with a tiny local frame parser (or type-only imports).
- G13 engine-worker AI API (orchestrator decision): the main thread never holds the DocGraph, so candidate selection and verification both live in the engine worker. `EngineApi.analyze` additionally returns optional `aiCandidates` (built in the worker by `llm/candidates.ts` from the DocGraph). The worker retains the last 1-2 analyzed graphs keyed by docHash (bounded LRU of 2; documented memory bound of at most two graphs; a third analysis evicts the least recently used; cleared on dispose). `EngineApi.verifyAi(result, docHash, injectedRuleTexts: string[])` and `rulesHash8(ruleTexts: string[])` take rule texts as plain strings (no core values cross the main thread); `verifyAi` returns a clear typed error (`doc_not_retained`) if the docHash is not retained, and the UI re-runs analyze. `MemoryApi.firmRules(firmId)` returns the active firm rule texts (real client: existing GET /api/memory/firm; stub in `stubMemoryApi.ts`), so the main thread passes plain strings to the worker. `EngineSettings` is unchanged. Gate: `apps/web/test/engine-ai-api.test.ts` (token `engine-ai-api`).
- G14 web regression invariants: (1) the stage-status button keeps the `Checks done` prefix in every AI state, so `e2e/fixtures/app.ts` `openSample` and the seven specs `hostile-html`, `investor-path-view`, `sample-picker-smoke`, `upload-limits`, `engine-worker-split`, `upload-firm-tagging`, `slice` keep passing unmodified (only `status-stages.spec.ts` assertions change, V3). (2) In the preview project (no Worker) the AI lane fails soft: the existing stub allowance string stays (the `privacy-notice` and `upload-limits` assertions are unchanged), no banner is shown, and no `/api/ai` call is made. G16: the lane enable is a RUNTIME API base with a defined default per build. `apps/web/vite.config.ts` `define` sets `VITE_API_BASE` to `'/'` (same origin) for non-e2e modes (production and the stack project) and to `''` for `--mode e2e` (the preview project); the client reads it once at startup into a runtime store value. `apps/web/src/e2e-hook.ts` gains an IS_E2E-guarded `__aduinE2E.setApiBase(base)` that ONLY the five V5 specs (`sample-zero-calls`, `auto-downgrade`, `ai-resume`, `provenance`, `ai-banners`) call before opening a document; route interception then serves `/api/ai` and `/api/quota`. When the base is `''` the lane fails soft (stub allowance string, lane `idle`/`not_precomputed`, no banner, no `/api/ai`, no `/api/quota`), so `upload-firm-tagging` and every other existing spec that never calls the hook is unaffected. When the base is non-empty the client fetches `/api/quota` and on any failure falls back to the stub allowance silently (no banner). Real `/api/quota` allowance renders only when the base is non-empty and the fetch succeeds. `no-e2e-hook-in-dist`, the whole-suite web gates and `slice.spec.ts` (stack project, production default `'/'`) stay green.
- Client verify order (executes inside the engine worker, G12): schema validate -> locate quote (case/space/quote-style tolerant) -> reject/demote + log if unlocatable -> `snapToSentence` (memory/snap.ts) -> severity cap -> mask (R2) before hashing/outbox; fingerprint from the document sentence, never model wording; quote > 1000 chars rejected; cached results re-verified on open.
- Rules injection (Worker, `llm/rules.ts` shared): resolved only when the signed cookie carries a workspace id (VERIFY claim field name in `limits/visitor.ts`) AND `law_firm_id !== null`, via `createRulesPort(db, w)` active rules only (1 read, 0 writes) through the `ProxyPlatform.rules` seam. No workspace cookie -> `law_firm_id` ignored, `rules_hash='none'`, client shows "firm rules not applied". Rules read fails with firm set -> `ProxyError('memory_unavailable', 'rules_unavailable')` (G4: a reason under the existing code, HTTP 503, pre-stream, NO new ERROR_CODES entry), zero claims, no upstream. Normalization NFC/trim/collapse, sort, caps 20 rules x 500 code points, 4 KB total, JSON array inside a delimited untrusted-rules tag; system prompt states rules are context, never instructions and never a filter. `injectedRulesHash` = core `rulesHash` (memory/rulesHash.ts) applied to the injected set (equals core `rulesHash` whenever no cap applies; property-tested), `'none'` when empty; `rulesHash8` = first 8 hex chars or the literal `none`; the same function yields client `rulesHash8`. G3 over-cap: deterministic truncation (sorted, first that fit) and the client shows "N of M firm rules applied"; never a silent drop and never stale-rules findings. Rules block escape rule (G8): a JSON array inside the untrusted tag with `<`, `>`, `&`, U+2028 and U+2029 escaped as `\uXXXX`, so no literal closing tag can appear from hostile rule text or document text.
- Pipeline order and budget: identity -> rules resolve -> build messages -> inputHash -> cacheKey (rules_hash replaces hard-coded 'none') -> cache read -> (miss only) Turnstile, claims, upstream. Port-call budget <=12 -> <=13 (update budget test + `process/context/worker/all-worker.md`). HIT stays 0 claims / 0 writes / 0 upstream.
- Client lane contract: states `off|idle|pending|fresh|cache|skipped(reason)|unavailable(reason)|not_precomputed`; headers `x-aduin-client:1`, `x-aduin-doc`, optional Turnstile header; ignore `hb` frames; exactly one terminal result/error; abort supported; NO auto-retry, manual Retry button (recorded deviation from the earlier "re-request on disconnect" wording). One banner per reason (quota, daily cap, per-visitor, budget, breaker, provider error, AI result unusable, verification needed, rules changed, rules unavailable, AI disabled) from BOTH pre-stream HTTP error bodies and terminal error frames; resume on reset timer / tab focus. Allowance from GET `/api/quota` (fields resolved: `{ai,ocr_pages,global_ok}`, no site key). Banner mapping `(code, reason)` -> banner (G4): `quota_exhausted` (visitor_limit, global_cap, ai_unavailable, ai_disabled); `budget_cap` (spend_cap, circuit_breaker, provider_balance); `rate_limited`; `invalid_session` (turnstile_missing, turnstile_failed); `upstream_failed` (provider_error, provider_rate_limited, timeout, network, malformed); `memory_unavailable` (rules_unavailable); plus client-side "rules changed", "N of M firm rules applied" notice and "AI disabled".
- Lookup order: static `/precomputed/{docHash}.{rulesHash8}.json` -> `/api/ai`; bundled samples never call `/api/ai` on open (`not_precomputed` + explicit "Run AI on this sample" button). `rulesHash8` of demo/sandbox seed rules identical so AC34 holds.
- Forward contracts: Phase 07 later appends `llm/tasks/drift-narrative.v1.ts` + one registry entry with no Worker edit; Phase 08 uses `counsel-draft` through the same path (Phase 08 UI out of scope here); Phase 06 OCR reuses `apps/web/src/api/` stream client.

## Blast Radius

`packages/core/src/{llm/**,contracts/ai.ts,detectors/** (F4, P2-3, P2-4),index.ts}`, `packages/core/test/{recorded,helpers}/**`, contracts snapshot, `fixtures/llm-recordings/**`, `apps/web/src/{api,features/ai,features/review (seam),engine/{engine.worker.ts,types.ts,client.ts} (additive, G12),state/session.ts,shell/AiSwitch.tsx,features/processing/StageStatus.tsx,storage/db.ts}`, `apps/web/e2e/**` (incl. `status-stages.spec.ts` assertion update, G11), `apps/web/test/import-graph.test.ts` (gate, unchanged, G12), `apps/web/test/engine-ai-api.test.ts` (G13, new), `apps/web/src/api/{memoryApi,stubMemoryApi}.ts` (G13 `firmRules`), the existing e2e specs named in G14 (must pass unmodified), `apps/worker/src/{proxy/pipeline.ts,proxy/guards.ts,proxy/ports.ts (G1),index.ts (G1),config.ts (G2),upstream/{openrouter,models-config,classify (G2)}.ts,routes/proxy/ai.ts}`, `apps/worker/wrangler.jsonc`, `apps/worker/test/{**,fakes/platform.ts (G1)}`, `apps/web/public/precomputed/*.json` (G6, samples #1/#3 only; `public/precomputed/ocr` is Phase 06 and untouched), `process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-05/` (G8), `scripts/src/{record,precompute/precompute-ai.ts}`, `scripts/package.json`, `design/mockups/ai-states.html`, `apps/web/vite.config.ts` and `apps/web/src/e2e-hook.ts` (G16). Parallel-safe with Phase 06 (shared `apps/web/src/api/` already exists and is EXTENDED here; Phase 06 consumes after Phase 05 EXECUTE commits). Registry changes are listed under `### Registry update request (Phase 05, PVL cycle 1)` below. Phase 07 must not touch the Worker. Registry `## Phase 05`.

## Data Flow

Deterministic findings -> `candidates.ts` (graph-selected neighborhoods, capped) -> client stream-client POST `/api/ai` (`task`, `law_firm_id`, candidates; headers x-aduin-client, x-aduin-doc) -> Worker: identity -> rules resolve (only with workspace cookie + firm id) -> `TASKS[task].buildMessages(input, rulesBlock)` -> `inputHash` -> cacheKey(`prompt_ver`=promptVersion, `rules_hash`) -> cache read; HIT = result with 0 claims/0 writes/0 upstream; MISS = Turnstile -> claims -> upstream (nemotron-3-super free, strict JSON) -> envelope + AiResultSchema + task validate -> cache + ledger -> NDJSON result (hb ignored by client) -> client verifies (schema, locate quote, snap, severity cap, mask) -> merged AI findings with provenance. Counsel-draft goes through the same path (Phase 08 UI later). Architecture note (sequential-thinking): the single choke point is `inputHash` of the exact forwarded messages; recordings, cache key and body-parity test all key off that one core function.

## Failure Modes

Upstream 429/402/timeout/malformed -> degrade with reason code -> banner and no-LLM continuation (deterministic untouched); Turnstile missing/failed -> "verification needed", no call; rules read fails with firm set -> refuse `rules_unavailable`, no upstream (never run without the firm's rules); no workspace cookie -> firm id ignored, "firm rules not applied"; hallucinated quote -> demoted and logged; schema-invalid output -> rejected, banner "AI result unusable" (no repair retry; manual Retry); stream drops -> `unavailable(reason)` + manual Retry (no auto-retry); prompt-injection via rules or document text -> rules in delimited untrusted tag, severity cap, quote must exist, mask before storage; rules change -> cache miss, and if caps block re-run: "rules changed" banner, no stale-rules AI findings; hostile fixtures: prose around JSON, extra keys, severity 'critical', oversized quote.

## Implementation Checklist

Execution (D7): Stage 0 single opus `core-llm` freezes contracts first; then AGENT TEAM (TeamCreate + TaskCreate/TaskUpdate + Agent(team_name,name) + SendMessage, tracked by TaskList; NOT bare parallel subagents): `worker-wiring` (opus), `web-lane` (opus), `core-fixtures-scripts` (opus); then `security-reviewer` (sonnet, read-only STRIDE on rules injection + record scripts). EVL by vc-tester (sonnet). Phase 05 EXECUTE commits before Phase 06 EXECUTE.

### Stage 0 - core-llm (opus, runs alone, contracts frozen before others start)
- [x] S0.1 `contracts/ai.ts` additive: optional `task` enum (default clause-judgment) on AiRequestSchema; optional `drafts` on AiResultSchema; keep the enum and draft shape module-private (G9); regenerate with `pnpm --filter @aduin/core exec vitest run -u contracts` (verify the form), review the snapshot diff limited to `ai.AiRequestSchema` and `ai.AiResultSchema`, write the change note naming exactly these two fields.
- [x] S0.2 `llm/{task,schemas,provenance,transport,wire,rules,registry,verify-quote,candidates}.ts` and `llm/tasks/{clause-judgment.v1,counsel-draft.v1}.ts`; reuse `memory/snap.ts` snapToSentence (no snap-sentence.ts); `rules.ts` exports `injectedRulesHash` built on the existing `memory/rulesHash.ts` `rulesHash` (G3, distinct name, no barrel collision) plus the escape rule for the rules block (G8); append exports in `index.ts`.
- [x] S0.3 Property tests: verify-quote tolerance, rules normalization/caps/hash order independence, `injectedRulesHash` equals core `rulesHash` when no cap applies, `rulesHash8` = first 8 hex or `none`, over-cap truncation is deterministic and reports "N of M"; freeze promptVersion per task.
- [x] S0.4 D6 core items: F4 bounded defined-term scan (index; goldens #1=2,#3=2,#5=2,#11=1 stay; `fixtures:check`); P2-3 explain() total on sparse facts; P2-4 (VERIFY backlog content) + "(check one)" exclusivity cue.

### Stage 1a - worker-wiring (opus)
- [x] W1 `proxy/ports.ts` add `ProxyPlatform.rulesFor?(workspaceId)` (undefined in `unavailablePlatform()`), wire in `apps/worker/src/index.ts` via `createRulesPort(env.DB, workspaceId)` per request (G1), extend `test/fakes/platform.ts` to count the rules call; `proxy/pipeline.ts` new order; rules resolve via `rulesFor` only with `visitor.claims.w` set + law_firm_id and never for `a==='ro'`; `ProxyError('memory_unavailable','rules_unavailable')` refusal (G4); HIT path unchanged (0 claims/0 writes/0 upstream; no-firm HIT = 1 port call, workspace+firm HIT = 2).
- [x] W2 `proxy/guards.ts` shapeAi passes `task`; `upstream/openrouter.ts` aiMessages -> TASKS; `models-config.ts` + `wrangler.jsonc` AI_TEXT_MODELS single model, `AI_RESPONSE_MODE`; G2 `config.ts` new `DEFAULT_TEXT_MODELS` (nvidia/nemotron-3-super-120b-a12b:free) + `AI_RESPONSE_MODE` parsing, update `test/proxy/free-only-config.test.ts` if it pins the old list; `upstream/classify.ts` task-aware: wrap parsed model JSON into the envelope (v:1, usage), validate once with `AiResultSchema` + task validator, drop invalid findings individually (valid ones kept), no double validation in the pipeline.
- [x] W3 `test/proxy/proxy-budget.test.ts`: `BUDGET = 13` plus a NEW workspace+firm MISS scenario (G5e); assert workspace+firm HIT = 2 port calls (rules read + cache get), no-firm HIT = 1, 0 claims/0 writes; update `process/context/worker/all-worker.md` at UPDATE PROCESS.
- [x] W4 Tests: rules-injection-delimited-hostile, rules-caps, proposed-rule-never-injected, rules-hash-stable-and-order-independent, rules-read-fail-refuses-no-upstream, no-workspace-ignores-law-firm-id, cache-hit-zero-claims-with-rules, cache-invalidated-by-firm-rules-change, firm-rule-isolation (incl. another workspace's rule), firm-rule-in-context-recorded-llm, record-body-parity; D1-backed failure matrix in the NEW file `test/proxy/llm-failure-injection-matrix-d1.test.ts` (G5c: unique token), `rules-hash-seed-parity`. FIRST W4 task (G7): the JSON-import probe (eager `import.meta.glob` of `fixtures/llm-recordings/**`; fallback `readFileSync` binding in `vitest.config.ts`, the `DEMO_SEED_SQL` pattern). Recordings via existing fetchMock/fakes. W4 recorded-LLM tests do not start until `core-fixtures-scripts` SendMessage confirms F1 recordings.

### Stage 1b - web-lane (opus)
- [x] V1 EXTEND existing `apps/web/src/api/` (already has client.ts, memoryApi.ts, stubMemoryApi.ts; G7) with the generic NDJSON/cookie/header stream client (Phase 06 reuses); add `MemoryApi.firmRules(firmId)` to `memoryApi.ts` (real client over GET /api/memory/firm) and its stub in `stubMemoryApi.ts` (G13); `features/ai/stream-client.ts` (no auto-retry, manual Retry, abort, ignore hb, one terminal frame).
- [x] V2 `ai-lane.ts` state machine; `turnstile.ts` token-provider seam only (no key -> "verification needed", no call; widget loader -> backlog Phase 10); `Allowance.tsx` from `/api/quota` only when the runtime API base (G16: `VITE_API_BASE` default `'/'` for production/stack, `''` for `--mode e2e`, overridable only via the IS_E2E-guarded `__aduinE2E.setApiBase`) is non-empty and the fetch succeeds, otherwise the existing stub allowance string with no banner and no `/api/ai` call (G14); `Provenance.tsx`; `AiBanner.tsx` all reasons from HTTP error bodies and terminal frames; resume on reset/focus.
- [x] V3 `precomputed.ts` lookup order (uses the worker-returned `rulesHash8`, G12); sample open = `not_precomputed` + "Run AI on this sample" button; replace StageStatus 'ai' stub and AiSwitch/allowance stubs; `state/session.ts`, `storage/db.ts` as needed. G11 sub-item: deliberately update `apps/web/e2e/status-stages.spec.ts` assertions ("Checks done · AI review pending" and `[data-stage=ai]` "Pending") to the new AI-stage strings and record the old -> new strings in the phase report.
- [x] V4 Verify chain runs in the engine worker (G12/G13): extend `EngineApi.analyze` to also return optional `aiCandidates` (built by `llm/candidates.ts`), retain the last 2 graphs by docHash (LRU 2, cleared on dispose), and add `EngineApi.verifyAi(result, docHash, injectedRuleTexts: string[])` plus `rulesHash8(ruleTexts: string[])` in `engine/{types,client}.ts` + `engine.worker.ts` (typed `doc_not_retained` error when the docHash was evicted; UI re-runs analyze); write `apps/web/test/engine-ai-api.test.ts` first (token `engine-ai-api`); the verify step doing schema validate, quote locate, `snapToSentence`, severity cap, mask before hashing/outbox (R2 mask path test), cached results re-verified on open, returning verified FindingViews and `rulesHash8`; main thread keeps `import-graph` green (no ALLOWED extension); U1 locator chip (`engine.worker.ts` toView additive section path + paragraph; `features/review` render).
- [x] V5 e2e via Playwright route interception of `/api/ai` and `/api/quota` from recordings; abort any openrouter.ai request: `sample-zero-calls`, `auto-downgrade`, `ai-resume`, `provenance`, `ai-banners` (incl. AI toggle-off case), `locator-chip`. G16: the five AI specs (not `locator-chip`) call `__aduinE2E.setApiBase('/')` before opening a document; specs that never call it stay fail-soft. V5 does not start until `core-fixtures-scripts` SendMessage confirms F1 recordings and F3 precomputed files (G7).

### Stage 1c - core-fixtures-scripts (opus)
- [x] F1 (deliver FIRST; then SendMessage to `worker-wiring` and `web-lane` before their W4/V5 start, G7) `packages/core/test/helpers/recorded-transport.ts` (throws on miss); `fixtures/llm-recordings/{task}/{inputHash16}.json` authored for #1, #3, hostile set, one counsel-draft sample; tests `llm-quote-must-exist`, `llm-schema`, `ai-severity-cap`, `ai-mask-before-storage`, `defined-term-scan-bounded`.
- [x] F2 `scripts/src/record/record-ai.ts` (refuses without `ALLOW_LIVE_LLM=1` and `--max-requests`; G8: in-code ceiling of 8 requests (CLI value may only lower it), allow-list of `:free` model ids only, aborts at the first `usage.cost > 0`, redacts error bodies; never prints or stores the Authorization header or keys).
- [x] F3 `scripts/src/precompute/precompute-ai.ts` with `--from-recordings` (offline, deterministic bytes) and `--dry-run` (writes nothing); ship `apps/web/public/precomputed/{docHash}.{rulesHash8}.json` for #1/#3 COMMITTED (G6; not gitignored, `public/precomputed/ocr` untouched); test `pnpm --filter @aduin/scripts test precompute-ai`; docs 13-26 deferred to Phase 10.
- [x] F4 Live under APPROVED-LIVE (see Live Budget) to replace authored recordings; direct to OpenRouter with local key sourced with the approval marker.

### Stage 2 - security-reviewer (sonnet, read-only)
- [ ] R1 STRIDE on rules injection (delimiter breakout, oversize, cross-workspace) and record scripts (key leakage, cap bypass); findings to phase report.
- [ ] R2 (G8) high-risk evidence pack: create `harness/phase-05/` with the 5 artifacts using the validator's exact schema (G15; precedent `harness/phase-04b/*.json`): `risk-gate.json` {task, planPath, riskLevel, riskClasses, mustStopBeforeFinalize, humanApprovalRequired, why}; `context-snippets.json` {task, snippets}; `verification.json` {task, commands, manualChecks, result}; `review-decision.json` {task, decision EXACTLY one of `approved`|`approved-with-concerns`|`rejected` (lowercase; NOT APPROVE/REJECT), blockingFindings, nonBlockingFindings, notes} from `security-reviewer`; `adversarial-validation.json` {task, method, scenarios} and run `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-05` (G10); not ready to finalize until it passes.

Out of scope (explicit notes): W3 x-aduin-doc and W10 claim-order (Phase 10), P2-6 (stays backlog, recorded known-gap), Turnstile widget (Phase 10), Phase 08 counsel-draft UI. Live recording (APPROVED-LIVE 8, F4) is OPTIONAL: if skipped, AC28/AC51 stay Hybrid with the residual named.

## Test Gates (commands created in this phase)

All commands use the form `pnpm --filter <pkg> test <token>` (NO `--`, one token per call, each token must match >0 files).

| Gate | Command | Tier | Proves AC |
|---|---|---|---|
| quote | `pnpm --filter @aduin/core test llm-quote-must-exist` | Hybrid (recorded) | AC28 |
| schema | `pnpm --filter @aduin/core test llm-schema` | Hybrid (recorded) | AC28 |
| severity cap | `pnpm --filter @aduin/core test ai-severity-cap` | Fully-Automated | AC28 |
| mask | `pnpm --filter @aduin/core test ai-mask-before-storage` | Fully-Automated | AC28 |
| defined-term bound | `pnpm --filter @aduin/core test defined-term-scan-bounded` | Fully-Automated | F4 |
| rules hash | `pnpm --filter @aduin/worker test rules-hash-stable-and-order-independent` | Fully-Automated | AC51 |
| rules caps/hostile | `pnpm --filter @aduin/worker test rules-caps` then `rules-injection-delimited-hostile` | Fully-Automated | AC51 |
| proposed rule | `pnpm --filter @aduin/worker test proposed-rule-never-injected` | Fully-Automated | AC51 |
| rules read fail | `pnpm --filter @aduin/worker test rules-read-fail-refuses-no-upstream` | Fully-Automated | AC51 |
| no workspace | `pnpm --filter @aduin/worker test no-workspace-ignores-law-firm-id` | Fully-Automated | AC51 |
| cache hit | `pnpm --filter @aduin/worker test cache-hit-zero-claims-with-rules` | Fully-Automated | AC34 |
| rules change | `pnpm --filter @aduin/worker test cache-invalidated-by-firm-rules-change` | Fully-Automated | AC27 |
| isolation | `pnpm --filter @aduin/worker test firm-rule-isolation` | Hybrid | AC51 |
| in-context | `pnpm --filter @aduin/worker test firm-rule-in-context-recorded-llm` | Hybrid | AC51 |
| body parity | `pnpm --filter @aduin/worker test record-body-parity` | Fully-Automated | AC28 |
| matrix on D1 | `pnpm --filter @aduin/worker test llm-failure-injection-matrix-d1` (NEW file; the old token also matches the 04a FakePlatform file) | Fully-Automated | AC26, AC32, AC33 |
| budget | `pnpm --filter @aduin/worker test proxy-budget` (BUDGET 13; workspace+firm MISS scenario; workspace+firm HIT = 2, no-firm HIT = 1) | Fully-Automated | AC34 |
| seed-hash parity | `pnpm --filter @aduin/worker test rules-hash-seed-parity` | Fully-Automated | AC34 |
| locator chip | `pnpm --filter @aduin/web test:e2e locator-chip` | Fully-Automated | U1 |
| explain totality | `pnpm --filter @aduin/core test explanation-present-per-rule` (extended for P2-3) | Fully-Automated | P2-3 |
| check-one cue | `pnpm --filter @aduin/core test check-one-exclusivity-cue` (with golden impact check via `test:golden` and `fixtures:check`) | Fully-Automated | P2-4 |
| precompute | `pnpm --filter @aduin/scripts test precompute-ai` | Fully-Automated | AC34 |
| zero calls | `pnpm --filter @aduin/web test:e2e sample-zero-calls` | Fully-Automated | AC34 |
| downgrade | `pnpm --filter @aduin/web test:e2e auto-downgrade` | Fully-Automated | AC35 |
| resume | `pnpm --filter @aduin/web test:e2e ai-resume` | Fully-Automated | AC35 |
| banners/provenance | `pnpm --filter @aduin/web test:e2e ai-banners` then `provenance` | Fully-Automated | AC35, AC36 |
| live recording | `pnpm --filter @aduin/scripts record:ai` with `ALLOW_LIVE_LLM=1` and `--max-requests 8` (APPROVED-LIVE only) | Agent-Probe | AC28 residual |
| evidence pack (G10) | `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-05` | Fully-Automated | AC28, AC51 (high-risk evidence) |
| engine AI API (G13) | `pnpm --filter @aduin/web test engine-ai-api` (analyze returns `aiCandidates`; `verifyAi` ok when docHash retained, `doc_not_retained` when evicted beyond LRU 2; rule-text `rulesHash8` equals core hash) | Fully-Automated | AC28, AC51 (verify chain wiring) |
| import graph (G12) | `pnpm --filter @aduin/web test import-graph` (assertions unchanged, ALLOWED not extended) | Fully-Automated | earlier phase (Phase 03 guard) |
| web regression (G11) | `pnpm --filter @aduin/web test:e2e status-stages`; `pnpm --filter @aduin/web test:e2e structure-view`; `pnpm --filter @aduin/web test source-guard`; `pnpm --filter @aduin/web test smoke` (status-stages assertions deliberately updated per V3); whole-suite `pnpm --filter @aduin/web test` and `pnpm --filter @aduin/web test:e2e` (no token; G14: all existing specs incl. `hostile-html`, `investor-path-view`, `sample-picker-smoke`, `upload-limits`, `engine-worker-split`, `upload-firm-tagging`, `slice` stay green; `Checks done` prefix kept; preview-project AI lane fails soft) | Fully-Automated | earlier phases (03) |
| regression | `pnpm --filter @aduin/core test:golden`; `pnpm --filter @aduin/worker test`; `pnpm slice:check` (replaces `test:e2e slice`, which can never match; it is local, not deploy-dependent: needs port 8787 free and no local secrets file in `apps/worker/`); `pnpm guard:cf`; `pnpm secrets:scan`; `pnpm --filter @aduin/scripts fixtures:check` | Fully-Automated | earlier phases |

Failing stubs for red-first: `should reject an AI finding whose quote is not in the document`, `should snap the fingerprint quote to the document sentence`, `should not exceed severity high for AI-only findings`, `should make zero /api/ai calls when opening a precomputed sample`, `should show the banner naming the reason and what is skipped when quota is out`, `should miss the cache after the firm rules change`, `should refuse with rules_unavailable and make no upstream call when the rules read fails`, `should ignore law_firm_id when the cookie has no workspace`.

TEST-SCENARIO-DISCOVERY: loaded `process/context/tests/all-tests.md` router; existing blast-radius suites (core golden, worker fakes/fetchMock, web preview e2e) are the base; PVL re-confirms the chain. Known-Gap: live free-model behavior beyond recorded cases stays the named residual of AC28/AC51 (backlog stub: live-model quality sweep in Phase 10 precompute); those gates stay CONDITIONAL, never PASS on Known-Gap alone.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `llm-quote-must-exist`, `llm-schema`, `ai-severity-cap`, `ai-mask-before-storage` | Hybrid (recorded) / Fully-Automated | AC28 |
| `sample-zero-calls` (#1, #3) | Fully-Automated | AC34 |
| `cache-hit-zero-claims-with-rules` | Fully-Automated | AC34 |
| `auto-downgrade`, `ai-resume`, `ai-banners` | Fully-Automated | AC35 |
| `provenance` | Fully-Automated | AC36 |
| `firm-rule-in-context-recorded-llm`, `firm-rule-isolation`, `rules-*`, `proposed-rule-never-injected`, `no-workspace-ignores-law-firm-id` | Hybrid / Fully-Automated | AC51 |
| `cache-invalidated-by-firm-rules-change` | Fully-Automated | AC27 (closing) |
| `llm-failure-injection-matrix-d1` on D1-backed ports | Fully-Automated | AC26 (closing) |
| `proxy-budget` (13), `rules-hash-seed-parity`, `precompute-ai` | Fully-Automated | AC34 |
| `locator-chip`, `explanation-present-per-rule`, `check-one-exclusivity-cue`, `ai-banners` toggle-off | Fully-Automated | U1 / P2-3 / P2-4 / AC3 |
| live recording R1/R2/#1/#3 | Agent-Probe | AC28 residual |
| `engine-ai-api` (G13), `no-e2e-hook-in-dist` + `slice.spec.ts` with runtime API base (G16), whole-suite `pnpm --filter @aduin/web test` and `test:e2e` (G14) | Fully-Automated | AC28/AC51 wiring; Phase 03 regressions |
| evidence pack validator (G10, schema G15), `import-graph` (G12), web regression `status-stages`/`structure-view`/`source-guard`/`smoke` (G11) | Fully-Automated | AC28/AC51 evidence; Phase 03 regressions |

```bash
pnpm --filter @aduin/core test llm-quote-must-exist
pnpm --filter @aduin/worker test firm-rule-isolation
pnpm --filter @aduin/web test:e2e sample-zero-calls
# Expected: each exits 0; zero network calls to OpenRouter in CI
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

- [x] 1. RESEARCH — research-agent: prior phase reports read; test context loaded; plan drift checked
- [x] 2. INNOVATE — innovate-agent: approach decided; Decision Summary written
- [x] 3. PLAN-SUPPLEMENT — plan-agent: existing phase plan updated; Inner Loop Refresh Note if sections changed (or "n/a — research clean")
- [ ] 4. PVL — vc-validate-agent: full V1-V7; validate-contract written per `.claude/skills/vc-validate-findings/references/example-validate-output.md` (include APPROVED-LIVE line or its absence)
- [ ] 5. EXECUTE — all checklist items done; per-section test gates run and green (or gaps documented)
- [ ] 6. EVL — all EVL gates green; follow-up stubs registered; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report written, umbrella state updated, commit done

**Validate-contract required before execute.** If step 4 (PVL) is unchecked or `## Validate Contract` reads "(placeholder — vc-validate-agent writes this section before EXECUTE)", orchestrator must spawn vc-validate-agent first. A partial contract missing Plan updates applied / Execute-agent instructions / Test gates sections is treated as a placeholder.

## Execution Strategy (vc-agent-strategy-compare, applied inline)

Signals S1, S2, S4, S6 (secrets, prompt-injection surface via firm rules), S7 = 5/7 HIGH. Recommended: Stage 0 single opus `core-llm` (contracts frozen first), then an AGENT TEAM with the full machinery (TeamCreate + TaskCreate/TaskUpdate + Agent(team_name,name) + SendMessage, TaskList): `worker-wiring` opus, `web-lane` opus, `core-fixtures-scripts` opus, all with disjoint blast radii; then `security-reviewer` sonnet read-only STRIDE; EVL vc-tester sonnet. Parallel subagents rejected: the contracts (`rules_hash`, NDJSON shape, recording format) must stay aligned mid-run. Phase 05 EXECUTE commits before Phase 06 EXECUTE.

## Live Budget (APPROVED-LIVE)

APPROVED-LIVE: 8 free requests (orchestrator, autopilot free-only policy)

Allocation: R1 strict-schema probe (also records served model id and `usage.cost`) 1; R2 `json_object` fallback probe 0-1 only if R1 fails; record sample #1 1; record sample #3 1; reserve <=4 including one counsel-draft sample. Stop at 8 requests or at the first `usage.cost > 0`. Calls go direct to OpenRouter with the local key (sourced with the `# APPROVED:credentials.env` marker; never printed). Space calls (20/min). Precompute of docs 13-26 is deferred to Phase 10.

## PVL Verify Items

1. Visitor-cookie claim field name for workspace id (`limits/visitor.ts`).
2. `/api/quota` response fields; whether the Turnstile site key is exposed.
3. Whether `upstream/classify.ts` already validates the AI envelope (avoid double validation).
4. P2-4 exact backlog content (`process/general-plans/backlog/`).
5. Worker vitest pool can import recording JSON (no fs access).
6. `rules_unavailable` fits the existing error-code family.

## Inner Loop Refresh Note

Date: 2026-10-17. Inner-loop Step 3 PLAN-SUPPLEMENT applied after INNOVATE decisions D1-D7. Sections changed: Overview (UI source), Acceptance Criteria (proven-by names), Touchpoints, Public Contracts, Blast Radius, Data Flow, Failure Modes, Implementation Checklist (restructured into Stage 0/1a/1b/1c/2), Test Gates (no-`--` single-token form), Verification Evidence, Execution Strategy, Live Budget, PVL Verify Items, Resume. Key deltas: llm/prompts renamed llm/tasks with shared TASKS registry; snap-sentence.ts dropped (reuse memory/snap.ts); additive contract fields `task` and `drafts`; rules injection gated on workspace cookie; port budget 12 -> 13; single text model; no auto-retry (deviation); bundled samples never auto-call /api/ai; D6 items in scope (U1, R2 mask test, F4, P2-3, P2-4).

### PVL supplement cycle 1 (2026-10-17)

PVL-supplement mode applied the V7 gap list (0 FAIL, 9 CONCERN) to Touchpoints, Public Contracts, Blast Radius, Implementation Checklist, Test Gates and Verification Evidence; no Inner Loop Refresh Note rewrite.
- G1: per-request `ProxyPlatform.rulesFor?(workspaceId)` in `proxy/ports.ts`, wired in `src/index.ts`, `test/fakes/platform.ts` counts the call.
- G2: `upstream/classify.ts` (task-aware envelope wrap, validate once, per-finding drop) and `config.ts` (DEFAULT_TEXT_MODELS = nemotron-3-super-120b-a12b:free, AI_RESPONSE_MODE) added; `free-only-config` test updated if it pins the old list.
- G3: `injectedRulesHash` reuses core `rulesHash`; property test equals core hash when no cap; `rulesHash8` first 8 hex or `none`; over-cap = deterministic truncation + "N of M rules applied".
- G4: `rules_unavailable` is a reason under `memory_unavailable` (503, pre-stream); `(code, reason)` -> banner table added to Public Contracts.
- G5: gates corrected (`pnpm --filter @aduin/scripts fixtures:check`, `pnpm slice:check`, `llm-failure-injection-matrix-d1` unique token, new gates locator-chip, explanation-present-per-rule, check-one-exclusivity-cue, ai-banners toggle-off, precompute-ai, rules-hash-seed-parity, proxy-budget BUDGET 13 with workspace+firm miss/hit). Token filtering verified from package.json: core/worker/scripts use `vitest run <token>` (unmatched token exits 1), web uses `playwright test --project=preview <token>`; each new token lives in a uniquely named file.
- G6: committed `apps/web/public/precomputed/{docHash}.{rulesHash8}.json` for #1/#3; Phase 06 `public/precomputed/ocr` untouched.
- G7: `apps/web/src/api/` is extended, not created; F1 recordings reach worker-wiring and web-lane via SendMessage before W4/V5; first W4 task is the JSON-import probe.
- G8: escape rule for the rules block (JSON array inside the untrusted tag, `<`, `>`, `&`, U+2028, U+2029 as `\uXXXX`) with a no-literal-closing-tag test; `record-ai.ts` ceiling 8, `:free` allow-list, abort at first `usage.cost > 0`; evidence pack step R2 added.
- G9: `task` enum and draft shape module-private; snapshot diff review limited to `ai.AiRequestSchema` and `ai.AiResultSchema`; regenerate via `pnpm --filter @aduin/core exec vitest run -u contracts`.
- Recorded: P2-6 stays backlog (known-gap); live recording (APPROVED-LIVE 8) is optional, and if skipped AC28/AC51 stay Hybrid with the residual named (gates CONDITIONAL, never PASS on Known-Gap alone).

### PVL supplement cycle 2 (2026-10-17)

Applied V7 gap list G10-G12 (0 FAIL, 3 CONCERN) to Touchpoints, Public Contracts, Blast Radius, Checklist (V3, V4, R2), Test Gates and Verification Evidence.
- G10: R2 evidence-pack command now targets `harness/phase-05`; evidence-pack row added to Test Gates.
- G11: web regression gates added (`status-stages`, `structure-view`, `source-guard`, `smoke`); `pnpm slice:check` stays (local; port 8787 free, no local secrets file in `apps/worker/`); V3 sub-item updates `status-stages.spec.ts` assertions to the new AI-stage strings, recorded in the phase report.
- G12: import-graph guard kept strict (ALLOWED not extended); AI verify chain moves into `engine.worker.ts` via new `EngineApi.verifyAi(result, docHash)` (engine `types.ts`/`client.ts` added); `rulesHash8` computed in the worker and returned with the analysis result; main-thread stream client parses NDJSON frames only; `import-graph` added as a must-stay-green gate.

### PVL supplement cycle 3 (2026-10-17)

Applied V7 gap list G13-G15 (0 FAIL, 3 CONCERN) to Touchpoints, Public Contracts, Blast Radius, Checklist (V1, V3, V4, R2), Test Gates and Verification Evidence.
- G13: engine-worker AI API: `analyze` also returns optional `aiCandidates`; worker retains last 2 graphs by docHash (LRU 2); `verifyAi(result, docHash, injectedRuleTexts: string[])` and `rulesHash8(ruleTexts: string[])` take plain strings; `doc_not_retained` error when evicted; `MemoryApi.firmRules(firmId)` plus stub; `EngineSettings` unchanged; new gate `engine-ai-api`.
- G14: whole-suite web unit and e2e runs added to the regression row; invariants: `Checks done` prefix kept in every AI state; preview project (no Worker) fails soft with the stub allowance, no banner, no `/api/ai` call, real `/api/quota` only when `VITE_API_BASE` is set and the fetch succeeds.
- G15: R2 evidence pack uses the validator's exact schema (`decision` in approved|approved-with-concerns|rejected; blockingFindings, nonBlockingFindings, notes), precedent `harness/phase-04b/*.json`.

### PVL supplement cycle 4 (2026-10-17)

Applied V7 gap G16 (0 FAIL, 1 CONCERN) to Touchpoints, Blast Radius, Public Contracts (G14 paragraph invariant 2), Checklist (V2, V5), Test Gates regression row and Verification Evidence.
- G16: AI lane enable is a runtime API base with a per-build default: `vite.config.ts` `define` sets `VITE_API_BASE` to `'/'` for non-e2e modes and `''` for `--mode e2e`; client reads it once into a runtime store value; IS_E2E-guarded `__aduinE2E.setApiBase(base)` in `e2e-hook.ts` is called only by the five V5 specs before opening a document; base `''` = fail-soft (stub allowance, no banner, no `/api/ai`). `no-e2e-hook-in-dist`, whole-suite web gates and `slice.spec.ts` stay green. Registry additions: `apps/web/vite.config.ts`, `apps/web/src/e2e-hook.ts`.

### Registry update request (Phase 05, PVL cycle 1; extended in cycle 2)

Cycle 4 additions: `apps/web/vite.config.ts`, `apps/web/src/e2e-hook.ts` (G16).

Cycle 3 additions: `apps/web/test/engine-ai-api.test.ts` (new), `apps/web/src/api/stubMemoryApi.ts`, `apps/web/src/api/memoryApi.ts` (`firmRules`).

Cycle 2 additions: `apps/web/test/import-graph.test.ts` (gate, unchanged), `apps/web/e2e/status-stages.spec.ts` (assertion update), `apps/web/src/engine/{types.ts,client.ts}` (additive).

For the orchestrator to append to `phase-blast-radius-registry.md` `## Phase 05` (the plan does not edit the registry): add `apps/worker/src/proxy/ports.ts`, `apps/worker/src/index.ts`, `apps/worker/src/upstream/classify.ts`, `apps/worker/src/config.ts`, `apps/worker/test/fakes/platform.ts`, `apps/worker/test/proxy/{proxy-budget,free-only-config,llm-failure-injection-matrix-d1,rules-hash-seed-parity}.test.ts`, `apps/web/public/precomputed/{docHash}.{rulesHash8}.json` (samples #1/#3, committed), `apps/web/e2e/locator-chip.spec.ts`, `scripts/test/precompute-ai.test.ts`, `process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-05/`. Phase 06 keeps `apps/web/public/precomputed/ocr`; Phase 07 must not touch the Worker files above.

## Deviations

Stage 1c (core-fixtures-scripts, 2026-10-17), all within blast radius:
- Orchestration: TeamCreate is unavailable in this session, so Stage 1 runs as 1c first, then 1a worker-wiring and 1b web-lane in parallel on disjoint directories. The F1 SendMessage handoff (G7/E8) is replaced by the Stage 1c section of the phase report (recording format, RecordedTransport, precompute format), which 1a/1b read before W4/V5.
- `.prettierignore` gains `fixtures/llm-recordings/` and `apps/web/public/precomputed/` (byte-deterministic generated JSON; prettier would reformat it and break `record:author --check` / `precompute:ai --check`). One-line root config edit outside the listed touchpoints.
- Extra script files `scripts/src/record/{ai-request,casebook,author-recordings}.ts` (shared request builder, case list, authored-recording writer; scripts `record:author`).
- `record-body-parity` also exists on the scripts side (`scripts/test/record-body-parity.test.ts`); the plan's gate `pnpm --filter @aduin/worker test record-body-parity` stays Stage 1a's. `rules-hash-seed-parity` is a Worker test (1a).
- Recording files carry two extra keys beyond `LlmRecordingSchema` (`case`, `request`) and live ones carry `meta.cost_usd` / `meta.response_mode`; the schema is non-strict, so they parse.
- Precomputed files are keyed `rulesHash8 = none` (bundled samples carry no active firm rules; E18(e) option "none").

## Test Infra Improvement Notes

`RecordedTransport` promoted to `packages/core/test/helpers` in this phase; candidate: shared OpenRouter fetchMock helper for worker tests.

## Resume and Execution Handoff

- Selected plan file path: `process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_PHASE-05-llm-ai-lane_PLAN_17-10-26.md`
- Last completed step: inner-loop Step 3 PLAN-SUPPLEMENT (2026-10-17)
- Validate-contract status: CONDITIONAL (first pass); PVL supplement cycle 1 applied 2026-10-17, re-validate from V1
- Next Step: spawn vc-validate-agent (inner PVL re-run from V1); copy the APPROVED-LIVE line into the contract. Phase 07 (drift-narrative task) and Phase 08 (counsel draft) depend on this framework.

## Validate Contract

Status: PASS
Date: 17-10-26
date: 2026-10-17
generated-by: inner-pvl: phase-05
supersedes: 2026-10-17 (inner-pvl: phase-05, cycle-3 re-validate CONDITIONAL, gap G16) — inner PVL cycle 4 re-validate (after PVL supplement cycle 4) has current evidence

Cycle: PVL re-validate after supplement cycle 4 (results.tsv rows: baseline, cycle 1, cycle 2, cycle 3, cycle 4; gap trend 9 -> 3 -> 3 -> 1 -> 0). Result: G16 is verified RESOLVED in plan text and against code; G1-G15 stay closed (not re-opened); no new gap raised. 0 FAIL, 0 CONCERN. Named residuals (live free-model behavior beyond recorded cases, P2-6, Turnstile widget, counsel-draft UI) are documented known-gaps carried by Hybrid / Agent-Probe rows with gap-resolution D, not the sole proof of any developed behavior, so the net gate is PASS (no vacuous green). Structural validation: `validate-plan-artifact.mjs` 0 failures, 0 warnings.

Parallel strategy: agent team for EXECUTE (named teammates + shared task list: TeamCreate + TaskCreate/TaskUpdate + Agent(team_name, name) + SendMessage, tracked by TaskList; NOT bare parallel subagents), after a Stage 0 single `core-llm` agent that freezes the contracts. Models: `core-llm` opus, `worker-wiring` opus, `web-lane` opus, `core-fixtures-scripts` opus (all four write source code), `security-reviewer` sonnet (read-only STRIDE), EVL `vc-tester` sonnet. Agent count: 1 (Stage 0) + 3 (team) x up to 3 rounds + 1 reviewer + 1 tester = at most 12, under the 30-agent cost guard.
Rationale: 5/7 signals HIGH (S1 four packages, S2 public API contract plus secrets, S4 phase program, S6 trust boundary via firm-rule prompt injection, S7 more than 5 files); dominant signal S6. A team is required because the shared recording format, `rules_hash`, the NDJSON shape and the engine-worker AI API must stay aligned mid-run (parallel subagents cannot coordinate). V2 fan-out for this pass was run sequentially by the validate agent itself against the real code (fire-and-forget, no spawn tool); every Layer 1 dimension and every Layer 2 stage was assessed.

Autonomous Goal Block: not written here (BRANCH B: umbrella `subdoc-qa-mvp-umbrella_PLAN_17-10-26.md` has `## Stable Program Goal`; the umbrella's /goal governs).

### G16 re-verification (plan text and code; G1-G15 stay closed from earlier contracts)

| Check | Plan text now | Code evidence | Verdict |
|---|---|---|---|
| Value per bundle mode | Touchpoints (`apps/web/vite.config.ts` `define` VITE_API_BASE '/' for non-e2e modes, '' for `--mode e2e`), Public Contracts G14 paragraph, V2 | `vite.config.ts` already defines the e2e flag keyed on `mode` (`mode === 'e2e' ? '1' : ''`), so the same pattern gives `VITE_API_BASE` a defined value in every mode; `package.json`: the preview bundle is the `build:e2e` script (`vite` with `--mode e2e`: base `''`, lane off), production and stack use the plain `build` script (mode production: base `'/'`, lane on); `playwright.config.ts` preview webServer runs `pnpm build:e2e`; `dev:stack` and `slice-check.ts` run the plain web `build` | RESOLVED |
| Runtime opt-in | `__aduinE2E.setApiBase(base)`, IS_E2E-guarded, called only by the five V5 specs (`sample-zero-calls`, `auto-downgrade`, `ai-resume`, `provenance`, `ai-banners`) before opening a document | `e2e-hook.ts` `installE2eHook` already merges IS_E2E-guarded methods (`failStage`, `transform`) onto `window.__aduinE2E`, installed from `main.tsx`; `setApiBase` has the same shape | RESOLVED |
| Production output stays clean | `no-e2e-hook-in-dist` stays green | `test/no-e2e-hook-in-dist.test.ts` bundles `production` and asserts neither `__aduinE2E` nor `e2eFailStage` is present, plus an e2e positive control; `IS_E2E` is a compile-time `false` outside `--mode e2e` (`e2e-flag.ts`), so a `setApiBase` added inside `installE2eHook` is stripped | RESOLVED (see E21 on keeping the assignment inside the guard) |
| Unmodified specs stay fail-soft | base `''` = stub allowance, lane `idle`/`not_precomputed`, no banner, no `/api/ai`, no `/api/quota`; specs that never call the hook are unaffected | `upload-firm-tagging.spec.ts` uploads with the default AI setting (`aiOn: safeGet(KEYS.ai) !== 'off'` => on) in the preview bundle, where the base is `''`, so no `/api/ai` call; `privacy-notice` and `upload-limits` keep the stub `N of N fresh-AI documents left today` string (`session.ts` `allowance` default, `AiSwitch.tsx`) | RESOLVED |
| Stack / slice | `slice.spec.ts` (stack project, production default `'/'`) stays green | `slice.spec.ts` opens bundled sample #1 (cached/precomputed path: `not_precomputed` plus button, never an auto call), asserts no browser request to `openrouter.ai` and no console errors, and calls `/api/quota` through the Playwright request fixture (global_ok false, 200); the lane quota fetch in that bundle returns 200, so no console error as long as the client sends `x-aduin-client: 1` (see E21) | RESOLVED |
| Registry | `apps/web/vite.config.ts`, `apps/web/src/e2e-hook.ts` | registry `## Phase 05` revision line (PVL cycles 1-4) lists both; no other active phase plan references either file (Phase 03 is completed) | RESOLVED |

G13-G15 remain resolved as recorded in the cycle-3 contract (engine-worker AI API with LRU 2 and plain-string rule texts; whole-suite web gates with the `Checks done` prefix invariant; evidence-pack schema equals the validator's keys). No plan text or code changed under them in cycle 4.

### Specific checks requested by the orchestrator

- `apps/web/vite.config.ts` define/mode handling incl. the `VITE_E2E` precedent: verified (define by `mode`; vitest uses mode `test`, so unit tests see `'/'`, see E21).
- `apps/web/src/e2e-hook.ts` IS_E2E guard: verified (every body and the hook install are inside `if (IS_E2E)`).
- `no-e2e-hook-in-dist`: verified; an explicit gate row is added below (token matches `test/no-e2e-hook-in-dist.test.ts`).
- `slice.spec.ts` / stack mode: verified (production mode, base `'/'`; lane on; sample open never auto-calls `/api/ai`).
- `upload-firm-tagging` AI default: verified (AI default on, preview base `''`, fail-soft, no `/api/ai`).
- `pnpm slice:check`, snapshot regenerate form, token filtering, Phase 06 ordering: unchanged from earlier contracts (slice:check LOCAL, port 8787 free, no local secrets file in `apps/worker/`; core/worker/scripts `test` = `vitest run <token>`; web `test:e2e` = `playwright test --project=preview <token>`; unmatched token exits 1).

### PVL Verify Items resolved in code

1. Workspace-id claim is `w` (`SessionClaims` in `packages/core/src/contracts/claims.ts`: `v`, `w`, `a`, `iat`, `exp`, `kid`, `t`; `w` requires `a`). `resolveVisitor` never mints `w`; `POST /api/session` (Phase 04b) adds it. A read-only demo cookie carries `a: 'ro'` and no `w`. Rule: rules resolve only when `visitor.claims.w !== undefined` AND `law_firm_id !== null`, never for `a === 'ro'`. A purged workspace returns 0 rows, so `rules_hash = 'none'` (safe).
2. `GET /api/quota` returns exactly `{ai:{used,limit,resets_at}, ocr_pages:{used,limit,resets_at}, global_ok}`; `ai` counts fresh-AI documents per visitor per UTC day (limit 3). The Turnstile site key is NOT exposed; `QuotaResponseSchema` is frozen, so Phase 05 keeps only the `turnstile.ts` token-provider seam (Phase 10 widget).
3. `classify.ts` already validates the AI envelope once; it must wrap the parsed model JSON (add `v:1`, `usage`) BEFORE `AiResultSchema` and drop invalid findings individually (validate once there, not again in the pipeline).
4. Backlog P2-4 (`process/general-plans/backlog/core-followups_17-10-26/core-followups_REF_17-10-26.md`): `(check one)` is not in `EXCLUSIVITY_CUES`, so most option groups read "Cue inferred" and dominate the Structure badge (#2: 38, #5: 23). P2-3 (`explain()` totality on sparse facts) and F4 (quadratic defined-term scan) are in scope; P2-6 stays backlog as a recorded known-gap.
5. Worker vitest pool can import JSON (precedents in `llm-ocr-cache-hit.test.ts`, `memory/fingerprint-vectors.test.ts`, `memory/firm-list-parity.test.ts`); `import.meta.glob` is typed in `test/env.d.ts`; `test/setup.ts` makes `fetch` throw. Fallback: `readFileSync` binding in `vitest.config.ts`. Probe first in W4.
6. `rules_unavailable` is a `reason`, not a new code (`ERROR_CODES` frozen, `errorStatus` exhaustive).
7. (cycle 2) Client-side source of active firm rules: `MemoryApi` had none; resolved by G13 (`MemoryApi.firmRules` over the existing `GET /api/memory/firm`, active rules only).
8. (cycle 4) `VITE_API_BASE` source and lane opt-in: resolved by G16 (per-mode `define` default plus IS_E2E-guarded `__aduinE2E.setApiBase`); precedents: the e2e flag in `vite.config.ts` and `window.__aduinE2E` in `src/e2e-hook.ts`.

### Test gates

Command form (program-wide rule): `pnpm --filter <pkg> test <token>`, NO `--`, ONE token per call, each token must match at least one file (an unmatched token exits 1). A call with NO token runs the whole suite of that package/project and is allowed for the full-suite regression rows.

| criterion id | behavior | strategy | proving test | gap-resolution |
|---|---|---|---|---|
| AC28 | a quote that is not in the document is rejected or demoted and logged (incl. a hallucinated-quote recording); locating tolerates case, spacing and quote style | Hybrid | `pnpm --filter @aduin/core test llm-quote-must-exist` (precondition: authored recordings in `fixtures/llm-recordings/`) | D (live free-model behavior is the named residual) |
| AC28 | model-result schema validation over the hostile set (prose around JSON, extra keys, severity `critical`, oversized quote) | Hybrid | `pnpm --filter @aduin/core test llm-schema` | D |
| AC28 | AI-only findings never exceed `high` and are labeled "AI suggestion" | Fully-Automated | `pnpm --filter @aduin/core test ai-severity-cap` | B |
| AC28 | mask (R2 path) runs before hashing and outbox | Fully-Automated | `pnpm --filter @aduin/core test ai-mask-before-storage` | B |
| F4 | bounded defined-term scan; goldens #1=2, #3=2, #5=2, #11=1 stay | Fully-Automated | `pnpm --filter @aduin/core test defined-term-scan-bounded` then `pnpm --filter @aduin/core test:golden` | B |
| AC51 | rules hash stable and order independent; equals core `rulesHash` when no cap applies | Fully-Automated | `pnpm --filter @aduin/worker test rules-hash-stable-and-order-independent` | B |
| AC51 | caps (20 x 500 code points, 4 KB) and hostile rule text cannot break the delimited block; no literal closing tag | Fully-Automated | `pnpm --filter @aduin/worker test rules-caps` then `pnpm --filter @aduin/worker test rules-injection-delimited-hostile` | B |
| AC51 | a proposed (not active) rule is never injected | Fully-Automated | `pnpm --filter @aduin/worker test proposed-rule-never-injected` | B |
| AC51 | rules read fails with a firm set -> `memory_unavailable`/`rules_unavailable`, zero upstream, zero claims | Fully-Automated | `pnpm --filter @aduin/worker test rules-read-fail-refuses-no-upstream` | B |
| AC51 | no workspace claim -> `law_firm_id` ignored, `rules_hash='none'` | Fully-Automated | `pnpm --filter @aduin/worker test no-workspace-ignores-law-firm-id` | B |
| AC34 | cache HIT with rules: 0 claims, 0 writes, 0 upstream | Fully-Automated | `pnpm --filter @aduin/worker test cache-hit-zero-claims-with-rules` | B |
| AC27 | changing the firm rules misses the cache | Fully-Automated | `pnpm --filter @aduin/worker test cache-invalidated-by-firm-rules-change` | B |
| AC51 | one firm's (or another workspace's) rules are never given for another | Hybrid | `pnpm --filter @aduin/worker test firm-rule-isolation` (precondition: local D1 from `test/setup.ts`) | A |
| AC51 | firm rules arrive as context (delimited block in the forwarded messages), never as a filter | Hybrid | `pnpm --filter @aduin/worker test firm-rule-in-context-recorded-llm` (precondition: recorded response) | D (live model use of rules stays the residual) |
| AC28 | the recorded request body equals the forwarded body (single `inputHash` choke point) | Fully-Automated | `pnpm --filter @aduin/worker test record-body-parity` | B |
| AC26, AC32, AC33 | failure matrix on the D1-backed platform | Fully-Automated | `pnpm --filter @aduin/worker test llm-failure-injection-matrix-d1` (NEW file) | B |
| AC34 | budget: BUDGET 13; workspace+firm MISS scenario; workspace+firm HIT = 2 port calls; no-firm HIT = 1; 0 claims, 0 writes on HIT | Fully-Automated | `pnpm --filter @aduin/worker test proxy-budget` | B |
| AC34 | a sandbox copy of the demo seed rules yields the same `rulesHash8` as the demo seed | Fully-Automated | `pnpm --filter @aduin/worker test rules-hash-seed-parity` | B |
| AC34 | precompute is offline and deterministic; `--dry-run` writes nothing | Fully-Automated | `pnpm --filter @aduin/scripts test precompute-ai` | B |
| AC34 | opening bundled samples #1 and #3 makes zero `/api/ai` and zero openrouter.ai calls; other samples show `not_precomputed` + explicit "Run AI on this sample" | Fully-Automated | `pnpm --filter @aduin/web test:e2e sample-zero-calls` (lane switched on through the G16 opt-in) | B |
| AC35 | each downgrade reason shows a banner naming the reason and what is skipped | Fully-Automated | `pnpm --filter @aduin/web test:e2e auto-downgrade` (G16 opt-in) | B |
| AC35 | AI resumes after the reset without manual action | Fully-Automated | `pnpm --filter @aduin/web test:e2e ai-resume` (G16 opt-in) | B |
| AC35, AC36, AC26, AC32, AC33, AC3 | one banner per reason from HTTP error bodies AND terminal frames; allowance visible; AI toggle-off case; fresh vs cached chip | Fully-Automated | `pnpm --filter @aduin/web test:e2e ai-banners` then `pnpm --filter @aduin/web test:e2e provenance` (G16 opt-in) | B |
| U1 | locator chip (section path + paragraph) on a finding | Fully-Automated | `pnpm --filter @aduin/web test:e2e locator-chip` | B |
| P2-3 | `explain()` total on sparse facts (existing file extended) | Fully-Automated | `pnpm --filter @aduin/core test explanation-present-per-rule` | B |
| P2-4 | `(check one)` exclusivity cue; golden impact checked | Fully-Automated | `pnpm --filter @aduin/core test check-one-exclusivity-cue` then `pnpm --filter @aduin/core test:golden`, `pnpm --filter @aduin/scripts fixtures:check` | B |
| contracts | additive `task`/`drafts` only; snapshot diff limited to `ai.AiRequestSchema` and `ai.AiResultSchema` | Fully-Automated | `pnpm --filter @aduin/core test contracts` (after regenerate + diff review) | B |
| G13 worker boundary | the engine worker exposes the AI-lane surface (candidates, verify, `rulesHash8`) so the main thread imports no new core value | Fully-Automated | `pnpm --filter @aduin/web test import-graph` (assertions unchanged); `pnpm --filter @aduin/web test engine-ai-api` (NEW file `apps/web/test/engine-ai-api.test.ts`: `aiCandidates` returned, `verifyAi` ok when retained and `doc_not_retained` when evicted beyond LRU 2, rule-text `rulesHash8` equals the core hash) | B (resolved in plan text, cycle 3) |
| AC28 residual | live free-model recording R1 and samples #1/#3/counsel-draft | Agent-Probe | `pnpm --filter @aduin/scripts record:ai` with `ALLOW_LIVE_LLM=1` and `--max-requests 8` (script created by F2; APPROVED-LIVE only) | D (backlog stub: live-model quality sweep in the Phase 10 precompute) |
| regression (core/worker/slice) | earlier phases stay green | Fully-Automated | `pnpm --filter @aduin/core test`; `pnpm --filter @aduin/core test:golden`; `pnpm --filter @aduin/worker test`; `pnpm slice:check` (LOCAL, no deployed Worker needed); `pnpm --filter @aduin/scripts fixtures:check`; `pnpm guard:cf`; `pnpm secrets:scan`; `pnpm typecheck` | A |
| regression (web named, G11/G12) | Phase 03 web gates stay green after the AI stage, `features/ai/**` and P2-4 changes | Fully-Automated | `pnpm --filter @aduin/web test import-graph`; `pnpm --filter @aduin/web test source-guard`; `pnpm --filter @aduin/web test smoke`; `pnpm --filter @aduin/web test:e2e status-stages`; `pnpm --filter @aduin/web test:e2e structure-view` | A |
| regression (web full, G14, G16) | every existing preview spec and web unit test still passes after the stage text, allowance and AI-default change (shared `openSample` helper, `privacy-notice`, `upload-limits`, `hostile-html`, `investor-path-view`, `sample-picker-smoke`, `engine-worker-split`, `upload-firm-tagging`, `a11y-smoke`, `layout-vs-mockup`, `no-e2e-hook-in-dist`) | Fully-Automated | `pnpm --filter @aduin/web test` (whole vitest suite, no token) and `pnpm --filter @aduin/web test:e2e` (whole preview project, no token) | B (resolved in plan text, cycle 3; G16 resolved in cycle 4: runtime API base default per build plus IS_E2E-guarded `setApiBase`, only the five V5 specs opt in, `no-e2e-hook-in-dist` and `slice.spec.ts` stay green) |
| G16 hook stays out of production | the production output contains neither `__aduinE2E` nor `e2eFailStage` after the `setApiBase` addition; positive control: the e2e output still contains the marker | Fully-Automated | `pnpm --filter @aduin/web test no-e2e-hook-in-dist` (existing file `apps/web/test/no-e2e-hook-in-dist.test.ts`; two Vite bundles, up to 180 s each) | A |
| high-risk evidence (G10, G15) | risk pack for trust boundary (prompt injection via rules), secrets, public API contract | Hybrid | `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-05` (the five files carry the validator's required keys and `decision` in `approved|approved-with-concerns|rejected`, see E12) plus the recorded review decision | B |

Known-Gap is never a `strategy:` value. Named residuals (gap-resolution D, not proving strategies): live free-model quality and behavior beyond the recorded cases (AC28, AC51); real Turnstile widget (Phase 10); P2-6 (backlog, kept); counsel-draft UI (Phase 08).

Legacy line form:
- core LLM framework: [Fully-automated: `pnpm --filter @aduin/core test ai-severity-cap`, `ai-mask-before-storage`, `defined-term-scan-bounded`, `check-one-exclusivity-cue`, `explanation-present-per-rule`, `contracts`] | [hybrid: `llm-quote-must-exist`, `llm-schema` + authored recordings] | [agent-probe: `record:ai` under APPROVED-LIVE] | [known-gap: live model behavior beyond recorded cases, documented]
- worker rules/injection/cache: [Fully-automated: `rules-hash-stable-and-order-independent`, `rules-caps`, `rules-injection-delimited-hostile`, `proposed-rule-never-injected`, `rules-read-fail-refuses-no-upstream`, `no-workspace-ignores-law-firm-id`, `cache-hit-zero-claims-with-rules`, `cache-invalidated-by-firm-rules-change`, `record-body-parity`, `llm-failure-injection-matrix-d1`, `proxy-budget`, `rules-hash-seed-parity`] | [hybrid: `firm-rule-isolation`, `firm-rule-in-context-recorded-llm` + local D1 + recorded response] | [known-gap: real model obeying "context never instructions", documented]
- web AI lane: [Fully-automated: `test:e2e sample-zero-calls`, `auto-downgrade`, `ai-resume`, `ai-banners`, `provenance`, `locator-chip`; `test import-graph`, `source-guard`, `smoke`, `engine-ai-api`; full `test` and full `test:e2e`] | [known-gap: real Turnstile widget (Phase 10), documented]
- scripts: [Fully-automated: `pnpm --filter @aduin/scripts test precompute-ai`] | [agent-probe: `record:ai`]

Failing stubs (red-first; Fully-Automated rows only; copy verbatim into the test files):
- `test("should reject an AI finding whose quote is not in the document", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should reject an AI finding whose quote is not in the document") })`
- `test("should snap the fingerprint quote to the document sentence", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should snap the fingerprint quote to the document sentence") })`
- `test("should not exceed severity high for AI-only findings", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should not exceed severity high for AI-only findings") })`
- `test("should make zero /api/ai calls when opening a precomputed sample", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should make zero /api/ai calls when opening a precomputed sample") })`
- `test("should show the banner naming the reason and what is skipped when quota is out", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should show the banner naming the reason and what is skipped when quota is out") })`
- `test("should miss the cache after the firm rules change", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should miss the cache after the firm rules change") })`
- `test("should refuse with rules_unavailable and make no upstream call when the rules read fails", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should refuse with rules_unavailable and make no upstream call when the rules read fails") })`
- `test("should ignore law_firm_id when the cookie has no workspace", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should ignore law_firm_id when the cookie has no workspace") })`
- `test("should keep a closing delimiter inside rule text from appearing literally in the forwarded messages", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should keep a closing delimiter inside rule text from appearing literally in the forwarded messages") })`
- `test("should keep valid findings when one finding in the model result is invalid", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should keep valid findings when one finding in the model result is invalid") })`
- `test("should verify an AI result inside the engine worker and return findings the main thread can render without importing core values", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should verify an AI result inside the engine worker and return findings the main thread can render without importing core values") })`
- `test("should keep the AI lane inert in the preview build until a spec turns it on through the e2e hook", () => { throw new Error("NOT IMPLEMENTED — TDD stub: should keep the AI lane inert in the preview build until a spec turns it on through the e2e hook") })`

APPROVED-LIVE: 8 free requests (orchestrator, autopilot free-only policy)
Stop rule (binding on F4 and any live run): stop at 8 requests or at the first response with `usage.cost > 0`, whichever comes first; free `:free` models only (the single text model `nvidia/nemotron-3-super-120b-a12b:free`); NEVER a paid call; never `openrouter/free`; space calls to stay under 20 per minute (50 per day without credits); keys are never printed, logged or written to recordings; credentials are sourced only with the `# APPROVED:credentials.env` marker. Provenance note: this grant comes from the orchestrator under the autopilot free-only policy recorded in `unattended-run-hard-stops`; it is not a separate user opt-in. F4 is therefore OPTIONAL: if there is any doubt, skip it, keep the schema-valid authored recordings, and leave AC28 and AC51 as Hybrid with the named residual (the gate then stays CONDITIONAL, never PASS on Known-Gap alone).

Dimension findings:
- Infra fit: PASS — G1, G2, G6, G10 stay verified; the engine-worker boundary (single-file `WORKER` constant in `import-graph.test.ts`, `limits.aiCandidates = 40`, existing `GET /api/memory/firm`) fits G13; the per-mode `define` for `VITE_API_BASE` follows the existing e2e-flag pattern in `vite.config.ts` and the modes already used by `build:e2e`, `dev:stack` and `slice-check.ts`.
- Test coverage: PASS — G16 resolved: the five V5 specs opt in at runtime through the IS_E2E-guarded `setApiBase`; unmodified preview specs stay fail-soft; `no-e2e-hook-in-dist` has an explicit gate row; whole-suite web gates (G14) and the validator schema (G15) stay resolved.
- Breaking changes: PASS — additive `EngineApi`/`EngineResult` fields, `MemoryApi.firmRules` on the interface plus its only implementer `StubMemoryApi`, additive `task`/`drafts` contract fields; no contract-version break; G3 and G9 stay resolved.
- Security surface: PASS — high-risk classes (trust boundary via firm rules and document text, secrets in the record script, public API contract); controls specified: escape rule, caps with deterministic truncation and "N of M" notice, `rules_unavailable` refusal, record-ai ceiling 8 / free allow-list / abort on cost > 0; cross-workspace isolation enforced in SQL; verify and masking stay in the worker that holds the document; the e2e API-base override is compile-time dead code in production. Evidence pack REQUIRED (E12, validator-exact schema).
- Stage 0 core-llm feasibility: PASS — targets exist (`contracts/ai.ts`, `memory/snap.ts` `snapToSentence`, `memory/rulesHash.ts`, barrel); `llm/` is new; highest-risk edit is the snapshot (bounded); P2-4 shifts badge counts (E13); `candidates.ts` must be a pure function of the `DocGraph` plus findings (E18).
- Stage 1a worker-wiring feasibility: PASS — pipeline order, `rulesFor`, `shapeAi` `task` passthrough, classify wrap, budget 13 specified; highest-risk edit is the `pipeline.ts` reorder (keep refunds and HIT = 0 claims / 0 writes / 0 upstream; cache-read errors still count as a miss).
- Stage 1b web-lane feasibility: PASS — lane enable is a runtime API base with a per-mode default and a single e2e override; highest-risk edit remains the `(code, reason)` banner mapping from both HTTP bodies and terminal frames; second is replacing the stage/allowance stubs without changing the `Checks done` prefix (E14, E21).
- Stage 1c core-fixtures-scripts feasibility: PASS — `scripts/package.json` gets `record:ai` and `precompute:ai`; recordings first (SendMessage); highest-risk edit is `record-ai.ts` (live key handling, cap enforcement).
- Stage 2 security-reviewer feasibility: PASS — R2 matches the validator keys and the lowercase `decision` enum.

Open gaps: none (G1-G16 CLOSED; no architectural flaw; no new gap raised in cycle 4).
- P2-6: known-gap: documented in backlog (`process/general-plans/backlog/core-followups_17-10-26/core-followups_REF_17-10-26.md`); the plan defers it explicitly; no new note needed.
- Live free-model quality beyond recorded cases: known-gap: documented (AC28/AC51 residual; backlog stub is the Phase 10 precompute quality sweep); Hybrid and Fully-Automated gates still prove the developed behavior, so this is a named residual, not the sole proof.

### What This Coverage Does NOT Prove

What this coverage does NOT prove:
- `llm-quote-must-exist`, `llm-schema`, `firm-rule-in-context-recorded-llm`: recordings are authored (schema-valid) unless F4 ran; they do not prove that the real free model returns locatable quotes, follows the strict JSON schema, or treats the delimited rules as context and not instructions. Real prompt-injection resistance of nemotron is NOT proven; only the delimiting, escaping, caps and the client-side quote/severity/mask chain are.
- `ai-severity-cap`, `ai-mask-before-storage`: do not prove masking of sensitive values in text the model paraphrases outside the located quote, nor sensitive data already inside a cached result before re-verification.
- `rules-*`, `cache-*`, `no-workspace-*`, `record-body-parity`, `proxy-budget`: run on fakes and local D1 (Miniflare), not remote D1 or the deployed Worker; they do not prove latency, remote rows-written budget, or concurrent-isolate cache races.
- `llm-failure-injection-matrix-d1`: injected failures only; real provider outage shapes (HTML error pages, partial streams) are not proven.
- `sample-zero-calls`, `auto-downgrade`, `ai-resume`, `ai-banners`, `provenance`, `locator-chip`: run in the Playwright `preview` project with `/api/ai` and `/api/quota` intercepted and the lane switched on by the e2e-only `setApiBase` hook; they do not prove the real Worker stream, the real Turnstile widget, or behavior on the deployed workers.dev origin. The production default base `'/'` is exercised only by `slice.spec.ts` (stack project, local Worker, sample open path; it does not drive a fresh `/api/ai` call) and `no-e2e-hook-in-dist` (absence of the hook); a deployed-lane AI call on workers.dev is not proven until Phase 10. `pnpm slice:check` covers the M1 slice locally, not the AI lane.
- `import-graph`, `source-guard`, `engine-ai-api`: prove module-boundary, style rules and the engine-worker functions in isolation, not the full Comlink round trip in a real browser worker (covered only by the e2e specs).
- Full `pnpm --filter @aduin/web test:e2e`: proves the existing preview specs still pass on the stub memory API and the e2e build; it does not prove behavior against a real Worker or real D1 rules (the `stack` project runs only `slice.spec.ts`).
- `validate-risk-artifacts.mjs`: proves the five JSON files exist with the required keys and a valid decision value; it does not prove the review itself was sound.
- `record:ai` (Agent-Probe): at most 8 free requests; proves only the sampled responses, not model quality in general or cost beyond the observed `usage.cost`.
- Not proven at all: P2-6 residual false positives, Phase 08 counsel-draft UI, Phase 10 precompute of docs 13-26, how the client obtains firm rules from a live workspace end to end (the real fetch client is only exercised against intercepted responses until Phase 08b and Phase 10).
- `no-e2e-hook-in-dist`: proves the two marker strings are absent from the production output; it does not prove that no other code path overrides the API base in production (E21 keeps the override assignment inside `installE2eHook`).

Gate: PASS (0 FAILs, 0 CONCERNs; G1-G16 closed; plan updated by PVL supplement cycles 1-4; named residuals are documented known-gaps carried by Hybrid/Agent-Probe rows, not a vacuous green)
Accepted by: not required (Gate PASS; no concern accepted). Named residuals recorded for the phase report: live free-model behavior beyond recorded cases (AC28/AC51), P2-6, Turnstile widget (Phase 10), counsel-draft UI (Phase 08).

### Execute-agent instructions

- E1 Order and team: Stage 0 `core-llm` (opus) alone, contracts frozen before anyone else starts; then the agent team with the full machinery (TeamCreate, TaskCreate/TaskUpdate, Agent with team_name and name, SendMessage, TaskList): `worker-wiring` opus, `web-lane` opus, `core-fixtures-scripts` opus, disjoint blast radii; then `security-reviewer` sonnet read-only; EVL by `vc-tester` sonnet. State the model on every spawn. Phase 05 EXECUTE commits before Phase 06 EXECUTE (Phase 06 owns `apps/web/src/engine`; Phase 05 edits there are additive only); Phase 07 must not touch the Worker. Seam files (`packages/core/src/index.ts`, `detectors/registry.ts`, `features/registry.ts`) are append-only and serialized by the orchestrator.
- E2 Rules seam (G1): additive `ProxyPlatform.rulesFor?: (workspaceId: string) => RulesPort` in `apps/worker/src/proxy/ports.ts`, wired in `apps/worker/src/index.ts` `buildApp` via `createRulesPort(env.DB, w)` PER REQUEST (the app and platform are cached per D1 binding); undefined in `unavailablePlatform()`; `test/fakes/platform.ts` counts the call in `platform.calls`. Rules resolve only with `visitor.claims.w` set AND `law_firm_id !== null`; never for `a === 'ro'`.
- E3 classify and config (G2): `classify` becomes task-aware: wrap the parsed model JSON into the envelope (`v:1`, `usage`; drop count in `ext`), validate ONCE with `AiResultSchema` plus the task validator, drop individually invalid findings (parse each finding with the finding schema first) instead of failing the whole result; a non-empty valid response with zero valid findings is a valid empty result. `parseContent` keeps tolerating prose around JSON, so the hostile "prose around JSON" case expects success; pin expectations accordingly. Update `config.ts` `DEFAULT_TEXT_MODELS`, `wrangler.jsonc` `AI_TEXT_MODELS` and add `AI_RESPONSE_MODE` parsing; `free-only-config.test.ts` imports the constant so it follows automatically (re-run it). `SCHEMA_VER` = task `schemaVersion`; `prompt_ver` = `task.promptVersion`. `classify.ts` and `config.ts` are 04a-owned; Phase 05 is their only live editor.
- E4 rulesHash (G3): do NOT export a second `rulesHash`; expose `injectedRulesHash` over the core `rulesHash`; property test: equals core `rulesHash` when no cap applies. `rulesHash8` = first 8 hex chars or the literal `none`. Over the caps (20 x 500 code points, 4 KB): deterministic truncation (sorted, first that fit) and "N of M firm rules applied" computed client-side by the same shared function (inside the engine worker, E18); never a silent drop, never stale-rules findings. `rules-hash-seed-parity` makes the AC34 precomputed lookup valid.
- E5 rules_unavailable (G4): `ProxyError('memory_unavailable', 'rules_unavailable')`, pre-stream HTTP 503, zero claims, zero upstream; no `ERROR_CODES` change. Banner mapping covers: `quota_exhausted` (visitor_limit, global_cap, ai_unavailable, ai_disabled), `budget_cap` (spend_cap, circuit_breaker, provider_balance), `rate_limited`, `invalid_session` (turnstile_missing, turnstile_failed), `upstream_failed` (provider_error, provider_rate_limited, timeout, network, malformed), `memory_unavailable` (rules_unavailable), plus "rules changed", "N of M firm rules applied" and "AI disabled".
- E6 Gate hygiene (G5): every new token lives in a distinctly named file that contains it; the D1 matrix is the NEW file `llm-failure-injection-matrix-d1.test.ts`; `proxy-budget.test.ts` gets `BUDGET = 13` (also the describe title) plus a workspace+firm MISS scenario; the no-firm HIT stays exactly 1 port call, the workspace+firm HIT is 2 (rules read + cache get), 0 claims and 0 writes.
- E7 Precomputed files (G6): `apps/web/public/precomputed/{docHash}.{rulesHash8}.json` for #1 and #3, COMMITTED, not generated at build; `precompute-ai.ts --from-recordings` offline and deterministic; `--dry-run` writes nothing; do not touch `public/precomputed/ocr`.
- E8 Team ordering (G7): `core-fixtures-scripts` delivers F1 recordings and sends a SendMessage to `worker-wiring` and `web-lane` before W4 recorded-LLM tests and V5 e2e start; extend `apps/web/src/api/`; first W4 task is the JSON-import probe.
- E9 Contracts (G9): keep the `task` enum and draft shape module-private; regenerate with `pnpm --filter @aduin/core exec vitest run -u contracts`, review that ONLY `ai.AiRequestSchema` and `ai.AiResultSchema` changed, write the change note, then `pnpm --filter @aduin/core test contracts`; freeze note in `process/context/engine/all-engine.md` is an UPDATE PROCESS item.
- E10 Security (G8): rules block = JSON array inside the delimited untrusted tag with `<`, `>`, `&`, U+2028, U+2029 escaped as `\uXXXX`; the system prompt states rules are context, never instructions, never a filter; `rules-injection-delimited-hostile` asserts no literal closing tag from rule text. `record-ai.ts`: in-code ceiling 8 (CLI may only lower it), refuses without `ALLOW_LIVE_LLM=1`, `:free` allow-list, aborts at the first `usage.cost > 0`, redacts error bodies, never prints or stores `Authorization`; run `pnpm secrets:scan` after any recording.
- E11 Live run (F4): only after Stage 1c is green; one R1 strict-schema probe first, R2 only if R1 fails, then #1, #3, one counsel-draft; stop rule above; record request count, models and costs in the phase report; never leave a local secrets file in `apps/worker/` afterwards (`pnpm slice:check` refuses to start with one). If skipped, say so and keep AC28/AC51 Hybrid with the named residual.
- E12 High-risk evidence pack (vc-risk-evidence-pack; EXACT validator schema, re-read from `.claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs` in cycle 3; precedent `harness/phase-04b/*.json`): create `process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-05/` and write five UTF-8 JSON files (a malformed file makes the script throw). The validator checks KEY PRESENCE (extra keys allowed) plus three value rules. Required keys: `risk-gate.json` {task, planPath, riskLevel, riskClasses, mustStopBeforeFinalize, humanApprovalRequired, why} with `riskLevel` EXACTLY one of `low`, `medium`, `high` (use `high`) and `riskClasses` an ARRAY (for example "permission, secret, or trust-boundary logic", "public API or external contract changes"); `context-snippets.json` {task} (add `snippets` with file:line citations for the pipeline reorder, rules block builder, classify wrap, engine-worker verify chain, record script ceiling); `verification.json` {task, commands, manualChecks, result} with `commands` and `manualChecks` ARRAYS (cover hostile rule text, rules read failure, cross-workspace rule, over-cap rules); `review-decision.json` {task, decision, blockingFindings, nonBlockingFindings, notes} with `decision` EXACTLY one of `approved`, `approved-with-concerns`, `rejected` (lowercase; the skill doc's APPROVE/REJECT wording FAILS the script); may also carry reviewer (the sonnet `security-reviewer`), rationale, timestamp. `adversarial-validation.json` has NO required keys, but when `riskLevel` is `high` its absence is a WARNING; write it as {task, method, scenarios} (delimiter breakout, oversize rules, cross-workspace read, key leakage via the record script, cap bypass, cache poisoning by crafted rules text). Run `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-05` from the repo root (the `phase-05` directory, NOT the parent `harness`; a missing directory fails with 4 "missing or invalid JSON object" failures); success = exit 0 and the printed JSON has `"failures": []` and `"warnings": []`. Do not call the phase ready to finalize until it passes and the decision is recorded.
- E13 Core detector items (D6): F4 bounded scan (goldens stay), P2-3 totality extended to Phase 01 detectors, P2-4 `(check one)` cue; P2-4 changes option-issue and Structure-badge counts (#2: 38, #5: 23 before): run full `pnpm --filter @aduin/core test`, `test:seeded`, `test:corpus`, `pnpm --filter @aduin/scripts fixtures:check` and web e2e `structure-view` and `status-stages`; update expectations deliberately and record every changed number in the phase report.
- E14 Web regression (G11, G14): V3 replaces the StageStatus 'ai' stub, so update `apps/web/e2e/status-stages.spec.ts` assertions deliberately (the "AI review pending" button text and the `[data-stage=ai]` "Pending" expectation) and record old -> new strings in the phase report. Keep these invariants so unmodified specs stay green: the stage button text keeps the `Checks done` prefix in every AI state (the shared `openSample` helper waits for `/Checks done|failed/`); `ai-allowance` keeps the exact `N of N fresh-AI documents left today` string and the stub decrement behavior whenever the lane is off or `/api/quota` is unreachable (the preview project has no Worker); the AI lane fails soft in the preview project (no banner, no `/api/ai` call) for every spec that has not switched the lane on through the e2e hook (E20). Run the named gates one token per call (`status-stages`, `structure-view`, `import-graph`, `source-guard`, `smoke`) AND the whole suites `pnpm --filter @aduin/web test` and `pnpm --filter @aduin/web test:e2e` (no token). Any other spec that must change is changed deliberately and listed in the phase report with the reason.
- E15 Import graph (G12, DECIDED): route the AI-lane chain through `engine.worker.ts`; do NOT extend `ALLOWED` in `apps/web/test/import-graph.test.ts` and do not edit its assertions (it may be re-run only). Main-thread files under `src/features/ai/**`, `src/api/**`, `src/state/**`, `src/shell/**` import `@aduin/core` only as `import type` or the existing allow-listed values; the stream client parses NDJSON frames with a small local parser. Never import `@aduin/core/src/*` deep paths outside the worker. The test treats ONLY `engine/engine.worker.ts` as the worker, so do not move core-value logic into a helper module under `src/engine/`.
- E16 `pnpm slice:check`: LOCAL gate, no deployed Worker required; it needs port 8787 free, takes several minutes (web production build, local wrangler, Playwright stack project), and must keep the `/api/ai` fail-closed codes within {quota_exhausted, invalid_session, budget_cap} for a `law_firm_id: null` request. Do not move it to Phase 10; `SLICE_BASE_URL` stays an optional live override only.
- E17 UPDATE PROCESS follow-ups (not EXECUTE): `process/context/worker/all-worker.md` (budget 13, rules step in the pipeline order, `rules_unavailable`, models), `process/context/engine/all-engine.md` (`llm/` section, snapshot freeze note), `process/context/tests/all-tests.md` (new tokens incl. `engine-ai-api`, full-suite web gates), `process/context/ui/all-ui.md` (AI lane states, engine-worker AI API, `VITE_API_BASE` default per build and the e2e opt-in hook), `process/context/all-context.md` (Phase 05 state), registry `## Phase 05` extension (`classify.ts`, `config.ts`, `proxy/ports.ts`, `src/index.ts`, `test/fakes/platform.ts`, `apps/web/public/precomputed/*.json`, `apps/web/src/engine/{engine.worker,types,client}.ts`, `apps/web/src/api/{memoryApi,stubMemoryApi}.ts`, `apps/web/test/{import-graph,engine-ai-api}.test.ts`, `apps/web/e2e/{status-stages,locator-chip}.spec.ts`, `apps/web/vite.config.ts` and `apps/web/src/e2e-hook.ts` (G16), `harness/phase-05/`; at the time of this validation the registry `## Phase 05` entry still carries only revision 1).
- E18 Engine-worker AI API (G13; the plan text is now supplemented, this stays the execution checklist): the worker computes, the main thread only carries plain data. In `engine.worker.ts`: (a) `analyze` additionally returns optional `aiCandidates` built by core `candidates.ts` from the retained `DocGraph` and the deterministic findings (capped by `limits.aiCandidates` = 40); (b) retain the last two `DocGraph`s keyed by `docHash` in a module-level LRU map (cleared on dispose); `verifyAi` for an unknown `docHash` returns the typed `doc_not_retained` error, never throws across Comlink; (c) `verifyAi(result, docHash, injectedRuleTexts)` runs schema validate -> quote locate -> `snapToSentence` -> severity cap -> mask and returns verified `FindingView`s (reusing `toView`) plus `rulesHash8` and the "N of M firm rules applied" counts; `EngineApi.rulesHash8(ruleTexts)` exposes the same function for the precomputed lookup; (d) rule texts travel as plain strings (never a firm id in `EngineSettings`; no workspace or no rules gives `none` with no network call); (e) add `MemoryApi.firmRules(lawFirmId)` to the interface, filter the `GET /api/memory/firm` `rules` to `status === 'active'`, implement it in the Dexie stub (the stub may return the rule texts from `fixtures/memory/demo-seed-spec.json` `rules` so the AC34 hash matches `rules-hash-seed-parity`, or `[]` with hash `none` when the precomputed files are keyed `none`; pick one and record it) and keep `StubMemoryApi` the only implementer; (f) testability: `api` in `engine.worker.ts` is not exported today, so export it (or the pure functions) for `apps/web/test/engine-ai-api.test.ts`; vitest runs the web package in jsdom, so prove `Comlink.expose` at module load is harmless in the first red run, and if it is not, move only non-core-value glue out and keep core imports in `engine.worker.ts` (E15). Run `import-graph` after every edit to `engine/*` or `features/ai/*`.
- E19 Preview-project behavior (G14; binding fallback): see E14 invariants; V5 specs intercept `/api/ai` and `/api/quota` per spec and abort any `openrouter.ai` request; specs that do not intercept must see no AI network activity.
- E20 Lane opt-in and API base (G16; plan text supplemented in cycle 4, this is the execution checklist): `VITE_API_BASE` has a defined value in every mode: `apps/web/vite.config.ts` `define` keyed on `mode` exactly like the e2e flag (`''` for `--mode e2e`, `'/'` for every other mode, including `production`, the stack bundle and vitest mode `test`). The client reads it ONCE at startup into a runtime store value. `apps/web/src/e2e-hook.ts` `installE2eHook` gains an IS_E2E-guarded `setApiBase(base: string)` (same shape as `failStage` and `transform`); only the five V5 specs (`sample-zero-calls`, `auto-downgrade`, `ai-resume`, `provenance`, `ai-banners`) call it, before opening a document, together with their `/api/ai` and `/api/quota` interceptions. Base `''`: lane fails soft (stub allowance string, lane `idle`/`not_precomputed`, no banner, no `/api/quota`, no `/api/ai`). Base non-empty: fetch `/api/quota`; on any failure fall back to the stub allowance silently (no banner). Unmodified specs never call the hook (`upload-firm-tagging`, `privacy-notice`, `upload-limits`, `locator-chip`, all others). Keep `no-e2e-hook-in-dist` green and confirm `slice.spec.ts` passes with the production default.
- E21 Execution notes from the G16 verification (not gaps): (a) keep the override assignment INSIDE `installE2eHook`'s `if (IS_E2E)` block (the production-output test only searches `__aduinE2E` and `e2eFailStage`, so a second code path that writes the base would not be caught); the store setter the hook calls may live in production code but must not be attached to `window` outside the hook. (b) `setApiBase` must make the lane pick up the new base (re-read the store and fetch `/api/quota` on the next document open, or on set), because the app is already loaded when a spec calls it. (c) The quota fetch must send `x-aduin-client: 1` and degrade without a `console.error`: `slice.spec.ts` asserts zero console errors in the stack project, and a 4xx on `/api/quota` would be logged by the browser. (d) vitest mode is `test`, so the base is `'/'` in jsdom unit tests: any unit test that mounts the lane must stub `fetch` or set the base explicitly; a unit test must never reach the network. (e) run `pnpm --filter @aduin/web test no-e2e-hook-in-dist` alone once after the V2/V5 edits.
- E22 EXECUTE kickoff, Stage 0 (`core-llm`, opus, runs alone): files: `packages/core/src/contracts/ai.ts` (additive `task` enum on `AiRequestSchema`, optional `drafts` on `AiResultSchema`, both module-private) and the contracts snapshot; new `packages/core/src/llm/{task,schemas,provenance,transport,wire,rules,registry,verify-quote,candidates}.ts` and `llm/tasks/{clause-judgment.v1,counsel-draft.v1}.ts`; append-only `packages/core/src/index.ts`; D6 core items in `packages/core/src/detectors/**` (F4 bounded defined-term scan, P2-3 `explain()` totality, P2-4 `(check one)` cue) with their tests. Gates before Stage 1 starts: `pnpm --filter @aduin/core exec vitest run -u contracts`, then diff review limited to `ai.AiRequestSchema` and `ai.AiResultSchema`, then `pnpm --filter @aduin/core test contracts`; `pnpm --filter @aduin/core test defined-term-scan-bounded`; `pnpm --filter @aduin/core test explanation-present-per-rule`; `pnpm --filter @aduin/core test check-one-exclusivity-cue`; `pnpm --filter @aduin/core test:golden`; `pnpm --filter @aduin/scripts fixtures:check`; `pnpm typecheck`; plus the S0.3 property tests (verify-quote tolerance, rules normalization/caps/hash order independence, `injectedRulesHash` equals core `rulesHash` when no cap applies). Evidence-pack path (created at Stage 2 R2): `process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-05/`, validated with `node .claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs process/general-plans/active/subdoc-qa-mvp_17-10-26/harness/phase-05`. After Stage 0 is green: freeze `PROMPT_VERSION` per task, then start the agent team (E1).
