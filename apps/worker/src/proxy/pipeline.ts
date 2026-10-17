// AI/OCR pipeline (Data Flow, plan Phase 04a; Phase 05 adds the rules step):
// 1a header-only guards -> 1b in-isolate pre-limit -> 1c body read/parse/validate -> 3 identity
// -> 3b AI only: firm rules resolve (only with a workspace claim `w` + law_firm_id, never for a
// read-only `a==='ro'` cookie; read failure = memory_unavailable/rules_unavailable, pre-stream)
// -> build messages from TASKS[task] -> inputHash -> cache key (task prompt/schema versions,
// injected rules hash) -> 4 cache read (HIT: zero claims, zero writes, zero upstream) ->
// 5 Turnstile -> 6 claims -> 7 OpenRouter (hold-open NDJSON) -> classify -> cache write ->
// ledger write -> terminal frame.
// Refunds: refusals before dispatch, pre-dispatch aborts and NON_CONSUMING_STATUS 4xx refund
// everything. A client abort after dispatch keeps ALL claims. Provider-side failures after
// dispatch (network, 5xx/429/402) refund the visitor-scoped claims (request/doc/seen/
// ocr pages, AC26) but KEEP the global counter and spend reservation, since the provider may
// have counted/billed the call (review F1). Malformed output and 200-with-error bodies keep ALL
// claims: a visitor can induce them via prompt injection (review F11). An upstream timeout also
// keeps ALL claims (Phase 05 review M2: a slow reply is visitor-inducible).
// Pre-stream refusals are HTTP via errorStatus; post-open failures are terminal error frames.
import {
  TASKS,
  cacheKey,
  inputHash as messagesHash,
  selectInjectedRules,
  type ErrorCode,
  type Frame,
  type TurnstilePort,
} from '@aduin/core';
import { ConfigError, loadConfig, type ProxyConfig } from '../config';
import { secondsToReset, utcDay } from '../limits/clock';
import { Claims, claimAi, claimOcr, keys, usageKeys, type Refusal } from '../limits/policy';
import type { PreLimiter } from '../limits/prelimit';
import {
  resolveVisitor,
  turnstileFresh,
  visitorSetCookie,
  withTurnstilePass,
  type Visitor,
} from '../limits/visitor';
import { createTurnstile, TURNSTILE_HEADER } from '../identity/turnstile';
import { classify, type AiClassifyContext, type Classified } from '../upstream/classify';
import {
  freeModelsFor,
  paidModelsFor,
  servedTier,
  PROMPT_VER,
  SCHEMA_VER,
  type ProxyKind,
} from '../upstream/models-config';
import {
  aiMessages,
  aiResponseFormat,
  buildBody,
  callOpenRouter,
  digestHex,
  ocrMessages,
  ocrResponseFormat,
} from '../upstream/openrouter';
import { errorResponse, messageFor, ProxyError } from './errors';
import {
  BODY_CAPS,
  checkClientHeader,
  checkJsonContentType,
  checkOrigin,
  parseJsonObject,
  readBodyCapped,
  shapeAi,
  shapeOcr,
  type ShapedAi,
} from './guards';
import type { Logger } from './log';
import { memoryBreaker, type BreakerPort, type ProxyPlatform } from './ports';
import { ndjsonResponse, ndjsonSingle, realTimers, type Timers } from './stream';

export const UPSTREAM_TIMEOUT_MS = 120_000;
export const CACHE_TTL_S = 7 * 86_400;
const DOC_HEADER = 'x-aduin-doc';

/** Optional Phase 04a dependencies (additive on AppDeps; defaults are production-safe). */
export interface ProxyDeps {
  platform?: ProxyPlatform;
  turnstile?: TurnstilePort;
  timers?: Timers;
  log?: (line: string) => void;
  heartbeatMs?: number;
  upstreamTimeoutMs?: number;
  /** Circuit-breaker state (default: per-isolate memory; 04b may persist it). */
  breaker?: BreakerPort;
}

export interface ProxyContext {
  fetch: typeof fetch;
  now: () => number;
  platform: ProxyPlatform;
  turnstile: (cfg: ProxyConfig) => TurnstilePort;
  timers: Timers;
  heartbeatMs: number | undefined;
  upstreamTimeoutMs: number;
  preLimiter: PreLimiter;
  logger: (cfg: ProxyConfig | undefined) => Logger;
  /** Circuit breaker: tripped for (UTC day, config fingerprint). */
  breaker: BreakerPort;
}

const configCache = new WeakMap<object, ProxyConfig | ConfigError>();

export function configFor(env: object): ProxyConfig {
  let c = configCache.get(env);
  if (!c) {
    try {
      c = loadConfig(env as Record<string, unknown>);
    } catch (e) {
      c = e instanceof ConfigError ? e : new ConfigError('invalid config');
    }
    configCache.set(env, c);
  }
  if (c instanceof ConfigError) throw c;
  return c;
}

/** Fails closed: a breaker port error counts as tripped. */
async function breakerTripped(ctx: ProxyContext, cfg: ProxyConfig): Promise<boolean> {
  try {
    return await ctx.breaker.tripped(utcDay(ctx.now()), cfg.fingerprint);
  } catch {
    return true;
  }
}

export { memoryBreaker };

function errFrame(code: ErrorCode, reason?: string, retry_after_s?: number): Frame {
  return {
    t: 'error',
    code,
    message: messageFor(code),
    ...(reason ? { reason } : {}),
    ...(retry_after_s !== undefined ? { retry_after_s } : {}),
  };
}

function refusalError(r: Refusal): ProxyError {
  return new ProxyError(r.code, r.reason, r.retry_after_s);
}

const unavailable = () => new ProxyError('quota_exhausted', 'ai_unavailable');

/** Shaped request (body read and validated); AI messages are built after identity + rules. */
type Prepared =
  | { kind: 'ai'; ai: ShapedAi; units: 1; docHeader: string | undefined }
  | { kind: 'ocr'; messagesJson: string; units: number };

/** What is actually forwarded upstream, plus how to judge the reply. */
interface Forward {
  kind: ProxyKind;
  messagesJson: string;
  responseFormatJson: string;
  /** AI only: task + sent input for the single validation step in classify */
  ai: AiClassifyContext | undefined;
}

/**
 * Firm rules for the AI context (G1/G4). Resolved ONLY when the verified cookie carries a
 * workspace `w`, the cookie is not read-only (`a === 'ro'`) and the request names a firm.
 * Otherwise `law_firm_id` is ignored and no rules are injected (`rules_hash = 'none'`).
 * A missing store or a failed read refuses (never run without the firm's rules).
 */
async function resolveRules(
  ctx: ProxyContext,
  visitor: Visitor | null,
  lawFirmId: string | null,
): Promise<readonly string[]> {
  const w = visitor?.claims.w;
  if (w === undefined || visitor?.claims.a === 'ro' || lawFirmId === null) return [];
  if (!ctx.platform.rulesFor) throw new ProxyError('memory_unavailable', 'rules_unavailable');
  try {
    const r = await ctx.platform.rulesFor(w).activeRules(lawFirmId);
    return r.texts;
  } catch {
    throw new ProxyError('memory_unavailable', 'rules_unavailable');
  }
}

/** Header-only guards: no body read, no port call. */
function headerGuards(request: Request): void {
  checkClientHeader(request);
  checkOrigin(request);
  checkJsonContentType(request);
}

/** Body read (capped), parse and shape validation; runs only after the pre-limit. */
async function prepare(kind: ProxyKind, request: Request): Promise<Prepared> {
  const text = await readBodyCapped(request, BODY_CAPS[kind]);
  const raw = parseJsonObject(text);
  if (kind === 'ai') {
    const s = shapeAi(raw);
    const h = request.headers.get(DOC_HEADER);
    const docHeader = h !== null && /^[a-f0-9]{16,64}$/.test(h) ? h : undefined;
    return { kind, ai: s, units: 1, docHeader };
  }
  const s = shapeOcr(raw);
  return { kind, messagesJson: ocrMessages(s), units: s.pages.length };
}

export async function handleProxy(
  kind: ProxyKind,
  request: Request,
  env: object,
  ctx: ProxyContext,
): Promise<Response> {
  let cfg: ProxyConfig | undefined;
  let visitor: Visitor | null = null;
  const cookieHeaders = async (): Promise<Record<string, string>> => {
    if (!visitor || !cfg) return {};
    try {
      const c = await visitorSetCookie(visitor, cfg);
      return c ? { 'set-cookie': c } : {};
    } catch {
      return {};
    }
  };
  try {
    // 1a. header-only guards (no body read, no claim, no port call)
    headerGuards(request);
    // 1b. cheap pre-limit BEFORE the body is read, so malformed requests are counted too
    const nowMs = ctx.now();
    const ra = ctx.preLimiter.hit(request, true, nowMs);
    if (ra !== null) throw new ProxyError('rate_limited', 'rate', ra);
    // 1c. body read / parse / validate
    const p = await prepare(kind, request);
    // config (fail closed on invalid config)
    try {
      cfg = configFor(env);
    } catch {
      throw unavailable();
    }
    const log = ctx.logger(cfg);
    // 3. identity
    visitor = await resolveVisitor(request, cfg, nowMs);
    const models = freeModelsFor(kind, cfg);
    // 3b. AI: firm rules -> messages from the task registry -> inputHash over those messages
    let fwd: Forward;
    let inputHash: string;
    let promptVer: string;
    let schemaVer: string;
    let rulesHash = 'none';
    if (p.kind === 'ai') {
      const ruleTexts = await resolveRules(ctx, visitor, p.ai.law_firm_id);
      const rules = selectInjectedRules(ruleTexts);
      const task = TASKS[p.ai.task];
      const messages = aiMessages(task, p.ai.candidates, rules, cfg.aiResponseMode);
      inputHash = messagesHash(messages);
      promptVer = task.promptVersion;
      schemaVer = task.schemaVersion;
      rulesHash = rules.hash;
      fwd = {
        kind,
        messagesJson: JSON.stringify(messages),
        responseFormatJson: aiResponseFormat(task, cfg.aiResponseMode),
        ai: { task, input: { candidates: p.ai.candidates } },
      };
    } else {
      inputHash = await digestHex(p.messagesJson);
      promptVer = PROMPT_VER.ocr;
      schemaVer = SCHEMA_VER;
      fwd = {
        kind,
        messagesJson: p.messagesJson,
        responseFormatJson: ocrResponseFormat(),
        ai: undefined,
      };
    }
    // 4. cache read via the key derived from the payload actually forwarded
    const key = cacheKey({
      kind,
      input_hash: inputHash,
      model: models[0]!,
      prompt_ver: promptVer,
      schema_ver: schemaVer,
      rules_hash: rulesHash,
    });
    let hit = null;
    try {
      hit = await ctx.platform.cache.get(key);
    } catch {
      hit = null; // port down: treat as miss; claims below fail closed
    }
    if (hit && hit.kind === kind) {
      const frame = (
        hit.kind === 'ai'
          ? { t: 'result', kind: 'ai', data: hit.data, cache: 'hit', model: hit.model }
          : { t: 'result', kind: 'ocr', data: hit.data, cache: 'hit', model: hit.model }
      ) as Frame;
      return ndjsonSingle(frame, await cookieHeaders());
    }
    // 5. miss: fail-closed preconditions, then Turnstile
    if (!cfg.uploadsEnabled) throw new ProxyError('quota_exhausted', 'ai_disabled');
    if (!cfg.apiKey || !visitor) throw unavailable();
    if (await breakerTripped(ctx, cfg)) throw new ProxyError('budget_cap', 'circuit_breaker');
    if (!turnstileFresh(visitor.claims, nowMs, cfg.turnstilePassTtlMs)) {
      const token = request.headers.get(TURNSTILE_HEADER);
      if (!token) throw new ProxyError('invalid_session', 'turnstile_missing');
      let ok = false;
      try {
        ok = (await ctx.turnstile(cfg).verify(token, visitor.ipHash)).ok === true;
      } catch {
        ok = false;
      }
      if (!ok) throw new ProxyError('invalid_session', 'turnstile_failed');
      visitor = withTurnstilePass(visitor, nowMs);
    }
    // 6. claims (visitor v + ip -> global shared provider counter); refunded on any refusal
    // before dispatch; after dispatch only on a definite non-consuming outcome (see header)
    const k = keys(visitor.claims.v, visitor.ipHash, nowMs);
    const claims = new Claims(
      ctx.platform.quota(usageKeys(visitor.claims.v, visitor.ipHash, nowMs)),
    );
    const resetS = secondsToReset(nowMs);
    let refusal: Refusal | null;
    try {
      refusal =
        kind === 'ai'
          ? await claimAi(
              claims,
              k,
              (p.kind === 'ai' ? p.docHeader : undefined) ?? inputHash,
              resetS,
            )
          : await claimOcr(claims, k, p.units, resetS);
    } catch {
      await claims.refundAll();
      throw unavailable();
    }
    if (refusal) {
      await claims.refundAll();
      throw refusalError(refusal);
    }
    // 7. upstream, hold-open
    const activeCfg = cfg;
    const run = async (signal: AbortSignal): Promise<Frame> => {
      const outcome = await callWithFallback(fwd, models, activeCfg, ctx, claims, k, signal);
      if (!outcome.ok) {
        if (outcome.consumed && outcome.providerFault) {
          await claims.refundVisitorScoped();
          log.log('proxy.visitor_claims_refunded', { kind, reason: outcome.reason });
        } else if (outcome.consumed) {
          // client abort after dispatch, malformed output, 200-with-error: keep everything
          log.log('proxy.claims_kept', { kind, reason: outcome.reason });
        } else {
          await claims.refundAll();
        }
        log.log('proxy.upstream_failed', { kind, code: outcome.code, reason: outcome.reason });
        return errFrame(outcome.code, outcome.reason, outcome.retry_after_s);
      }
      if (!activeCfg.paidEnabled) {
        const tier = servedTier(outcome.model, outcome.costUsd, activeCfg);
        if (tier === 'paid') {
          try {
            await ctx.breaker.trip(utcDay(ctx.now()), activeCfg.fingerprint);
          } catch {
            log.log('proxy.circuit_breaker_persist_failed', { kind });
          }
          log.log('proxy.circuit_breaker', { kind, model: outcome.model });
        } else if (tier === 'unknown') {
          log.log('proxy.served_model_unknown', { kind });
        }
      }
      const created_at = ctx.now();
      try {
        await ctx.platform.cache.put(
          key,
          outcome.kind === 'ai'
            ? { kind: 'ai', model: outcome.model, data: outcome.data as never, created_at }
            : { kind: 'ocr', model: outcome.model, data: outcome.data as never, created_at },
          CACHE_TTL_S,
        );
      } catch {
        log.log('proxy.cache_put_failed', { kind });
      }
      try {
        await ctx.platform.ledger.record({
          kind: kind === 'ai' ? 'llm' : 'ocr',
          model: outcome.model,
          units: p.units,
          cost_usd: outcome.costUsd,
          cache: 'miss',
          at: created_at,
        });
      } catch {
        log.log('proxy.ledger_failed', { kind });
      }
      return {
        t: 'result',
        kind: outcome.kind,
        data: outcome.data,
        cache: 'miss',
        model: outcome.model,
      } as Frame;
    };
    return ndjsonResponse({
      timers: ctx.timers,
      ...(ctx.heartbeatMs !== undefined ? { heartbeatMs: ctx.heartbeatMs } : {}),
      run,
      // Disconnect aborts `run`; `run` decides the refund from the outcome (an abort before
      // dispatch refunds, an abort after dispatch keeps the claims).
      onCancel: () => {
        log.log('proxy.client_disconnect', { kind });
      },
      headers: await cookieHeaders(),
    });
  } catch (e) {
    if (e instanceof ProxyError) return errorResponse(e, await cookieHeaders());
    ctx.logger(cfg).log('proxy.internal_error', { kind });
    return errorResponse(new ProxyError('upstream_failed', 'internal'), await cookieHeaders());
  }
}

/** Abortable upstream call with the 120 s timeout. */
async function once(
  fwd: Forward,
  models: readonly string[],
  cfg: ProxyConfig,
  ctx: ProxyContext,
  signal: AbortSignal,
): Promise<Classified> {
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  signal.addEventListener('abort', onAbort);
  let timedOut = false;
  const timer = ctx.timers.setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, ctx.upstreamTimeoutMs);
  // An abort that lands before the request leaves the Worker is the only abort we refund.
  if (signal.aborted) {
    ctx.timers.clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
    return {
      ok: false,
      code: 'upstream_failed',
      reason: 'client_abort',
      retryable: false,
      consumed: false,
    };
  }
  let dispatched = false;
  try {
    dispatched = true;
    const res = await callOpenRouter(
      ctx.fetch,
      cfg,
      buildBody(fwd.kind, models, fwd.messagesJson, fwd.responseFormatJson),
      ac.signal,
    );
    return await classify(fwd.kind, res, fwd.ai);
  } catch {
    return {
      ok: false,
      code: 'upstream_failed',
      reason: timedOut ? 'timeout' : signal.aborted ? 'client_abort' : 'network',
      retryable: false,
      // dispatched: the provider may have accepted (and counted) it -> keep the claims
      consumed: dispatched,
      // network only: a timeout keeps the visitor claims too (review M2: a slow-to-answer prompt
      // is visitor-inducible, so refunding it would let a visitor loop free upstream calls)
      ...(!timedOut && !signal.aborted ? { providerFault: true } : {}),
    };
  } finally {
    ctx.timers.clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

/**
 * One free request (OpenRouter falls back through models[] itself). The paid path runs only
 * when PAID_FALLBACK_ENABLED is exactly "true", a paid list is configured, the free result is
 * retryable, and the estimated max cost can be reserved under the spend cap.
 */
async function callWithFallback(
  fwd: Forward,
  freeModels: readonly string[],
  cfg: ProxyConfig,
  ctx: ProxyContext,
  claims: Claims,
  k: ReturnType<typeof keys>,
  signal: AbortSignal,
): Promise<Classified> {
  const first = await once(fwd, freeModels, cfg, ctx, signal);
  if (first.ok || !first.retryable || signal.aborted) return first;
  const paid = paidModelsFor(cfg);
  if (paid.length === 0) return first;
  const mark = claims.mark();
  let reserve: Refusal | null;
  try {
    reserve = await claims.take(k.spend, cfg.paidMaxCostMicroUsd, 'spend_cap');
  } catch {
    reserve = { code: 'budget_cap', reason: 'spend_cap' };
  }
  if (reserve) {
    await claims.refundFrom(mark); // nothing reserved is held for a refused reservation
    return {
      ok: false,
      code: 'budget_cap',
      reason: 'spend_cap',
      retryable: false,
      consumed: first.consumed,
      ...(first.providerFault ? { providerFault: true } : {}),
    };
  }
  const second = await once(fwd, paid, cfg, ctx, signal);
  if (second.ok) return second;
  // the paid call did not consume: release just the spend reservation
  if (!second.consumed) await claims.refundFrom(mark);
  // visitor refund only when every consuming attempt was a provider fault
  const fault = (!first.consumed || first.providerFault) && second.providerFault;
  return { ...second, consumed: first.consumed || second.consumed, providerFault: !!fault };
}

export function defaultTurnstile(fetchFn: typeof fetch): (cfg: ProxyConfig) => TurnstilePort {
  return (cfg) => createTurnstile(fetchFn, cfg.turnstileSecret);
}

export { realTimers };
