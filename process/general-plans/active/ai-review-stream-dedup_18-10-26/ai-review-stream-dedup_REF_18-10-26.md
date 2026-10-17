---
name: ref:ai-review-stream-dedup-probe
description: "Section A streaming probe results (OpenRouter SSE shape on the free text model) and the constants chosen for the Worker stream reader"
date: 18-10-26
metadata:
  node_type: memory
  type: references
  plan: process/general-plans/active/ai-review-stream-dedup_18-10-26/ai-review-stream-dedup_PLAN_18-10-26.md
---

# AI review streaming probe (Section A)

**Answer first:** streaming works on `nvidia/nemotron-3-super-120b-a12b:free` with strict `json_schema`. The longest silence in a real full-size review was 1.1 s, so the idle timeout stays at **60 s**. Reasoning arrives in `delta.reasoning` / `delta.reasoning_details` with no content, so the cheap prefilter works: it picked exactly 3 of 1,285 data lines to parse and missed none. Cost was $0 on both calls. No STOP row applies.

Probe: `scripts/src/spikes/ai-stream-probe/probe.ts`, run with `pnpm --filter @aduin/scripts exec tsx src/spikes/ai-stream-probe/probe.ts --probe p1a|p1b`. Ledger outside the repo (`~/.cache/aduin-transaction-live/ai-stream-probe/`). Two calls used (cap 3); optional P1c (OCR) skipped as instructed.

## Baseline (A1, before any edit)

| Check | Result |
|---|---|
| HEAD | `84d26d5` |
| `pnpm --filter @aduin/worker test record-body-parity` | 1 file, 21 passed |
| `pnpm --filter @aduin/core test llm-schema` | 1 file, 9 passed |
| `pnpm --filter @aduin/scripts record:author --check` | recordings OK (11 cases) |
| `pnpm --filter @aduin/scripts precompute:ai --from-recordings --check` | all precomputed files up to date |

## Probe P1a

Tiny prompt, production `response_format` (`responseFormat(TASKS['clause-judgment'], 'json_schema')`, strict), `max_tokens` 400, `stream:true`.

| Item | Value |
|---|---|
| HTTP / content-type | 200, `text/event-stream` |
| Headers / first byte | 1,394 ms / 1,395 ms |
| Total | 11.1 s, 28,113 bytes, 72 reads, 160 lines |
| Line kinds | 14 `: OPENROUTER PROCESSING` comments, 80 blank, 62 reasoning-only data, 1 content data, 2 finish/usage data, 1 `[DONE]` |
| Comment cadence | about 0.7 s (comments arrive before and between deltas) |
| Delta keys seen | `role`, `content`, `reasoning`, `reasoning_details` |
| Reasoning key path | `choices[0].delta.reasoning` (string) plus `choices[0].delta.reasoning_details` (array); `content` empty |
| Content key path | `choices[0].delta.content` (whole JSON object arrived in one delta) |
| `finish_reason` | `"stop"`, in `choices[0].finish_reason` of line 157 |
| Usage | in the SAME chunk as the finish (line 157), before `[DONE]` (line 159). `usage.cost: 0` present; `prompt_tokens` 60, `completion_tokens` 305 (`reasoning_tokens` 160); `cost_details.upstream_inference_cost` 0 |
| `model` per chunk | every data chunk carries `nvidia/nemotron-3-super-120b-a12b:free` (one distinct value) |
| Max gap | 1,395 ms (the wait before the first byte); 423 ms after the first byte; p95 422 ms |
| Content | single JSON object: yes. Prefix: `{"findings": [{"candidate_id": "c1", "issue_class": "ambiguity", "severity": "medium", ...` |
| First 5 raw lines | `: OPENROUTER PROCESSING`, blank, `: OPENROUTER PROCESSING`, blank, `: OPENROUTER PROCESSING` |

## Probe P1b

Real sample-03 recording body (`upstreamBody(caseRequest(caseById('sample-03')))`, old 36-candidate set) plus `"stream":true`, `max_tokens` as production.

| Item | Value |
|---|---|
| HTTP / content-type | 200, `text/event-stream` |
| Headers / first byte | 953 ms / 955 ms |
| **Total duration** | **112.0 s** (the earlier non-stream measurement was 199 s; provider timing varies) |
| Bytes total | 540,942 (about 0.54 MB raw) |
| Reads / lines | 1,149 reads, 2,748 lines |
| Data lines | 1,285 |
| **Reasoning-only lines** | **1,282** (116,763 reasoning chars) |
| Content | 1,901 chars, single JSON object: yes. Prefix: `{"findings": [{"candidate_id": "c_01c7b93e2d274052", "issue_class": "ambiguity", ...` |
| Keepalive comments | 88 `: OPENROUTER PROCESSING`, mean spacing about 1.3 s |
| **Max inter-read gap** | **1,131 ms** (p95 417 ms); the wait before the first byte was 955 ms |
| `finish_reason` | `"stop"`, line 2,745 |
| Usage | same chunk as the finish (line 2,745), before `[DONE]` (line 2,747); `reasoning_tokens` 4,322; `cost_details.upstream_inference_cost` 0; the probe's hard stop on `usage.cost > 0` did not fire, so `usage.cost` was 0 |
| Served model | the hard stop on a non-free served model did not fire (free model served) |
| Mid-stream error | none |
| Prefilter | 3 hits, 0 missed lines (every line with content, a finish reason, usage or error matched) |

Capture gap (honest note): the P1b console summary was shown through a filter that hid indented fields, so the exact `prompt_tokens` / `completion_tokens`, the per-kind line map and the delta-key list for P1b were not kept. A third call was not made (user cap: 2 calls). The P1a values for the same fields and the P1b line totals above cover the decisions; nothing in the decision table depends on the missing fields.

## Constants Chosen

| Constant | Value | Basis |
|---|---|---|
| `UPSTREAM_IDLE_MS` (AI only) | **60_000** | Max silent gap 1.13 s (P1b), 1.40 s (P1a), both far under 15 s; keepalive comments every 0.7-1.3 s |
| `UPSTREAM_TIMEOUT_MS` (AI ceiling) | **420_000** (C2, unchanged) | P1b 112 s; earlier non-stream 199 s |
| `UPSTREAM_OCR_TIMEOUT_MS` | 240_000 (C4, unchanged, no idle timer) | OCR not probed (K1) |
| Raw-stream cap | 8 MiB (C5) | P1b raw 0.54 MB, about 15x headroom |
| Assembled-content cap | 2 MiB (C5) | P1b content 1.9 KB |
| Prefilter (parse a `data:` line only if any matches) | `"content":"` followed by a non-quote char (`/"content":"[^"]/`), OR `/"finish_reason":"/` (non-null), OR `/"usage"/`, OR `/"error"/` | P1b: 3 of 1,285 parsed, 0 missed. False positives (reasoning text quoting these words) only cost an extra parse |
| Reader end rule | read until `[DONE]` or EOF; never stop at the finish chunk | usage sits in the finish chunk here, but the table row keeps the reader safe if it moves |
| Model source | first chunk that has `model`; fall back to `'unknown'` | every chunk carries it |

## Decision Table Outcome

| Row | Applies? | Action taken |
|---|---|---|
| Keepalive comments present; max silent gap <= 15 s | **Yes** | Keep idle 60 s |
| Max silent gap > 15 s | No (1.13 s) | - |
| Reasoning in `delta.reasoning` / `reasoning_details` with content empty | **Yes** | Use the prefilter above; `sse-cheap-parse` gate asserts reasoning-only lines are never parsed |
| Reasoning and content share a shape the prefilter cannot separate | No | - |
| No `usage` in stream | No (usage present, `cost: 0`) | `usageOf` reads it from the finish chunk |
| Usage after `[DONE]` / after finish with empty `choices` | No (usage in the finish chunk) | Reader still reads to `[DONE]`/EOF |
| Model id only in later chunks | No (every chunk) | First-chunk-with-model rule kept |
| Free model refuses `stream:true` + `json_schema` | **No** (200, valid JSON) | No STOP |
| `usage.cost > 0` or non-free served model | **No** | No abort |

TL;DR: streaming is viable as planned; idle 60 s, ceiling 420 s, prefilter as written in the plan; no STOP row; $0 spent.

## Section C - Vanished Candidate Ids (C2b) and Re-points (C3)

Candidate sets after Section B (rule-flagged sentences excluded): sample-01 22 -> 18, sample-03 36 -> 31. Surviving candidates keep id, quote and hint (checked for every survivor).

| Sample | Vanished ids |
|---|---|
| 01 | `c_cfc36abe07ac9c19`, `c_c9fcc048467d841c`, `c_a3a1fd5641d412c0`, `c_bbfb16d50ab9577f` |
| 03 | `c_fcfcb4a816686edb`, `c_54cd421d8bdba4af`, `c_ab71d8f803a229c5`, `c_c37d56d9973e94fc`, `c_53ded8db41297f0a` |

Still present (checked): `c_b30f291dff2535b6`, `c_624f0f476f804afb`, `c_439057b9bc027023`, `c_777504f5f99ae768`, `c_9b07218f8183451e`, `c_7eff7dd7e95bd2d8`, `c_06828a091f0ab7cf`.

| Case | Old pick | New pick | Why |
|---|---|---|---|
| `hostile-hallucinated-quote` | `c_a3a1fd5641d412c0` | `c_a603f23420e703bd` | lowest-index survivor of sample-01; its block has no rule finding |
| `firm-rules-in-context-03` | `c_53ded8db41297f0a` | `c_11be0ae0434514ea` | lowest-index survivor of sample-03; its block has no rule finding (the placeholder sentence the rule talks about is rule-flagged, so it is no longer a candidate) |
| `counsel-draft-03` | pick of 2 engine ids | `fixedCandidates` (`scripts/src/record/fixed-candidates/counsel-draft-03.json`) | live file and hash unchanged |
| `ai-duplicate-of-rule` (new) | - | `c_439057b9bc027023`, `c_b30f291dff2535b6` | two picks: a one-pick `c_b30f...` request has the same inputHash as `hostile-severity-critical` |

Derived recordings: sample-01 kept 1 of 3 live findings (`c_624f0f476f804afb`), sample-03 kept 3 of 4. In the app: sample-01 shows 1 AI row (was 3), sample-03 shows 1 verified + 2 rejected (was 2 + 2).

## Section H - Deploy Record (18-10-26)

- **New live version:** `8a82ead2-07ed-4b06-ad60-226d3f4734c8` (Worker + web in one `wrangler deploy`), https://aduin-transaction-web.giathaowork.workers.dev. **Rollback target:** `b04f1a8c-41f5-4c20-92dc-196d6e7d252a` (was live, confirmed with `wrangler deployments list` before the deploy).
- **Base (changed vs plan H1):** the plan named `3d2c7301` / `a4d7a34`. The live base was the hotfix `b04f1a8c`, built from local branch `hotfix/intake-readiness-msg` (= `a4d7a34` + `c7fcb17`, a cherry-pick of `8db9245`). Worker code at that base = `994ea54`.
- **Deploy tree:** worktree `.claude/worktrees/deploy-ai-stream`, branch `deploy/ai-stream-dedup` (local only, not pushed). Cherry-picks (`-x`), in order: `fd144b1` -> `a2a7047`, `685574d` -> `a737a51`, `fc86b1c` -> `372bb7d`, `01e7a10` -> `d7b7756` (UI fix approved by the user). Skipped: `8d94529` (probe spike), `e5b8443`, `ac13287` (docs/process).
- **Conflict (01e7a10):** `apps/web/test/variance-counts-selector.test.ts` was removed from the pick because it does not exist at the base. In `apps/web/src/state/review.ts`, the Dismiss toast at the base uses the older gate text (`N blocking reasons left.` / `The gate is now Ready.`); the fix wraps it with `withNote(..., created, get().doc)` and does not bring in the variance helpers `dismissGateText`/`gateNow`. Prettier reformat amended into the same commit.
- **Gates in the deploy tree (all green):** diff vs `c7fcb17` = exactly the files of the 4 picks (minus the variance test), 0 extra; migrations 0001-0005 only, no `0006`/`variance` in wrangler/migrations; `pnpm install --frozen-lockfile`; `pnpm typecheck`; `pnpm lint`; worker 563/563 (70 files); core `llm` 82/82 (15 files); web unit 305/305 (43 files); scripts 167/167 (18 files); `record:author --check` (12 cases); `precompute:ai --from-recordings --check`; preview e2e 13/13 (ai-no-duplicates, provenance, ai-banners, upload-firm-tagging, intake-low-confidence-gate); `guard:cf`; `secrets:scan`; `deploy:preflight` 13/13 (plain build, public site key taken from the live bundle; one site key found).
- **CPU before deploy (E8, `workerCpu` GraphQL template, 24 h to 2026-10-17T18:49Z):** 342 requests, 0 errors, cpu p50 4.1 ms, p99 35.0 ms; wall p50 60 ms, p99 2.7 s. (The p99 is higher than the old 16 ms observation; the window held no streamed review.)
- **Post-deploy checks:** `/api/health` 200 `cache-control: no-store` `{ok:true}`; `/api/memory/health` `schema_version` 5 (0006 not shipped); CSP header byte-identical to before (md5 match) plus security headers present; headless Chromium load of `/`: title "Sub-doc QA", 0 page errors, only `GET /api/quota`, 0 AI/OCR calls. The Playwright `stack` project could not run because local port 4317 was held by another session (left untouched), so the direct headless smoke replaced it.
- **Not done here:** Section I (live NG3 upload with human Turnstile, AC17/AC18, CPU after).
