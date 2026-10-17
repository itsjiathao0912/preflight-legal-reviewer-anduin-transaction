// Proxy configuration: env typing + defaults in code (Phase 04a).
// Validation is strict and fails closed: an invalid value throws ConfigError and the
// proxy routes degrade (no upstream call) instead of running with a weaker policy.
import { limits, type AiResponseMode, type KeyMap } from '@aduin/core';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface ProxyConfig {
  /** Secret. Never logged, never echoed. Absent => AI/OCR fail closed. */
  apiKey: string | undefined;
  baseUrl: string;
  textModels: readonly string[];
  visionModels: readonly string[];
  /** Paid fallback list (default empty). Only used when paidEnabled is true. */
  paidModels: readonly string[];
  uploadsEnabled: boolean;
  paidEnabled: boolean;
  visitorAiDocsPerDay: number;
  visitorAiReqsPerDay: number;
  visitorOcrPagesPerDay: number;
  globalProviderReqsPerDay: number;
  /** Assumed OpenRouter free allowance; the effective global cap is the lesser of the two. */
  providerAllowancePerDay: number;
  spendCapMicroUsd: number;
  /** Reserved before every paid call so concurrent calls cannot overshoot the cap. */
  paidMaxCostMicroUsd: number;
  cookieKeys: KeyMap | undefined;
  cookieKid: string | undefined;
  cookieTtlS: number;
  turnstilePassTtlMs: number;
  turnstileSecret: string | undefined;
  turnstileSiteKey: string | undefined;
  /** AI `response_format` mode (Phase 05 live probe R1: strict `json_schema` accepted). */
  aiResponseMode: AiResponseMode;
  /** Short stable fingerprint of policy-relevant config (circuit-breaker reset on change). */
  fingerprint: string;
}

export const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
/** Phase 05 (G2): the single P2-proven text model; the vision model stays OCR-only (Phase 06). */
export const DEFAULT_TEXT_MODELS = 'nvidia/nemotron-3-super-120b-a12b:free';
export const DEFAULT_VISION_MODELS = 'nvidia/nemotron-3.5-super-vl:free';
/** Phase 05 live probe R1 (Stage 1c): strict json_schema accepted by the free text model. */
export const DEFAULT_AI_RESPONSE_MODE: AiResponseMode = 'json_schema';
/** S1 verdict PASS (Phase 00): hold-open survives, so AI on uploads defaults on. */
export const DEFAULT_UPLOADS_ENABLED = true;

type EnvLike = Readonly<Record<string, unknown>>;

function str(env: EnvLike, name: string): string | undefined {
  const v = env[name];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new ConfigError(`${name} must be a string`);
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function int(env: EnvLike, name: string, def: number, min = 0): number {
  const s = str(env, name);
  if (s === undefined) return def;
  if (!/^\d{1,12}$/.test(s)) throw new ConfigError(`${name} must be a non-negative integer`);
  const n = Number(s);
  if (n < min) throw new ConfigError(`${name} must be >= ${min}`);
  return n;
}

function list(env: EnvLike, name: string, def: string): string[] {
  const raw = str(env, name) ?? def;
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const id of ids) {
    if (!/^[A-Za-z0-9._/:-]{1,120}$/.test(id)) throw new ConfigError(`${name}: invalid model id`);
    if (id.startsWith('openrouter/')) throw new ConfigError(`${name}: router ids are rejected`);
  }
  return ids;
}

/** Free-only rule: every id must end with ":free"; router ids already rejected by list(). */
export function assertFreeOnly(name: string, ids: readonly string[]): void {
  if (ids.length === 0) throw new ConfigError(`${name} must not be empty`);
  for (const id of ids)
    if (!id.endsWith(':free')) throw new ConfigError(`${name}: only :free model ids are allowed`);
}

/** Exact-string flag: enabled only on "true" (never "TRUE", "1", "yes"). */
export function exactTrue(v: unknown): boolean {
  return v === 'true';
}

function bool(env: EnvLike, name: string, def: boolean): boolean {
  const v = env[name];
  if (v === undefined) return def;
  if (v === 'true') return true;
  if (v === 'false') return false;
  throw new ConfigError(`${name} must be "true" or "false"`);
}

function responseMode(env: EnvLike): AiResponseMode {
  const v = str(env, 'AI_RESPONSE_MODE');
  if (v === undefined) return DEFAULT_AI_RESPONSE_MODE;
  if (v === 'json_schema' || v === 'json_object') return v;
  throw new ConfigError('AI_RESPONSE_MODE must be "json_schema" or "json_object"');
}

function baseUrl(env: EnvLike): string {
  const raw = str(env, 'OPENROUTER_BASE_URL') ?? DEFAULT_BASE_URL;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ConfigError('OPENROUTER_BASE_URL is not a URL');
  }
  if (u.protocol !== 'https:') throw new ConfigError('OPENROUTER_BASE_URL must be https');
  if (u.hostname !== 'openrouter.ai')
    throw new ConfigError('OPENROUTER_BASE_URL host must be openrouter.ai');
  if (u.port !== '' || u.username !== '' || u.password !== '' || u.search !== '' || u.hash !== '')
    throw new ConfigError('OPENROUTER_BASE_URL must not carry port, credentials, query or hash');
  return u.origin + u.pathname.replace(/\/+$/, '');
}

function cookieKeys(env: EnvLike): { keys: KeyMap | undefined; kid: string | undefined } {
  const raw = str(env, 'COOKIE_SIGNING_KEYS');
  const kid = str(env, 'COOKIE_SIGNING_KID');
  if (raw === undefined && kid === undefined) return { keys: undefined, kid: undefined };
  if (raw === undefined || kid === undefined)
    throw new ConfigError('COOKIE_SIGNING_KEYS and COOKIE_SIGNING_KID must be set together');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigError('COOKIE_SIGNING_KEYS must be a JSON object');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new ConfigError('COOKIE_SIGNING_KEYS must be a JSON object');
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(k)) throw new ConfigError('COOKIE_SIGNING_KEYS: invalid kid');
    if (typeof v !== 'string' || new TextEncoder().encode(v).byteLength < 32)
      throw new ConfigError('COOKIE_SIGNING_KEYS: each key must be a string of at least 32 bytes');
    keys[k] = v;
  }
  if (!Object.prototype.hasOwnProperty.call(keys, kid))
    throw new ConfigError('COOKIE_SIGNING_KID must exist in COOKIE_SIGNING_KEYS');
  return { keys: Object.freeze(keys), kid };
}

export function loadConfig(env: EnvLike): ProxyConfig {
  const textModels = list(env, 'AI_TEXT_MODELS', DEFAULT_TEXT_MODELS);
  const visionModels = list(env, 'AI_VISION_MODELS', DEFAULT_VISION_MODELS);
  assertFreeOnly('AI_TEXT_MODELS', textModels);
  assertFreeOnly('AI_VISION_MODELS', visionModels);
  const paidModels = list(env, 'AI_PAID_MODELS', '');
  const paidEnabled = exactTrue(env['PAID_FALLBACK_ENABLED']);
  const { keys, kid } = cookieKeys(env);
  const cfg: Omit<ProxyConfig, 'fingerprint'> = {
    apiKey: str(env, 'OPENROUTER_API_KEY'),
    baseUrl: baseUrl(env),
    textModels,
    visionModels,
    paidModels,
    uploadsEnabled: bool(env, 'AI_UPLOADS_ENABLED', DEFAULT_UPLOADS_ENABLED),
    paidEnabled,
    visitorAiDocsPerDay: int(env, 'VISITOR_AI_DOCS_PER_DAY', limits.visitorAiDocsPerDay),
    visitorAiReqsPerDay: int(env, 'VISITOR_AI_REQS_PER_DAY', limits.visitorAiRequestsPerDay),
    visitorOcrPagesPerDay: int(env, 'VISITOR_OCR_PAGES_PER_DAY', limits.visitorOcrPagesPerDay),
    globalProviderReqsPerDay: int(
      env,
      'GLOBAL_PROVIDER_REQS_PER_DAY',
      limits.globalAiRequestsPerDay,
    ),
    providerAllowancePerDay: int(env, 'PROVIDER_ALLOWANCE_PER_DAY', 50),
    spendCapMicroUsd: int(env, 'SPEND_CAP_MICRO_USD', limits.spendCapUsd * 1_000_000),
    paidMaxCostMicroUsd: int(env, 'PAID_MAX_COST_MICRO_USD', 20_000, 1),
    cookieKeys: keys,
    cookieKid: kid,
    cookieTtlS: int(env, 'VISITOR_COOKIE_TTL_S', 86_400, 60),
    turnstilePassTtlMs: int(env, 'TURNSTILE_PASS_TTL_MS', 1_800_000, 1),
    turnstileSecret: str(env, 'TURNSTILE_SECRET'),
    turnstileSiteKey: str(env, 'TURNSTILE_SITE_KEY'),
    aiResponseMode: responseMode(env),
  };
  if (cfg.spendCapMicroUsd > limits.spendCapUsd * 1_000_000)
    throw new ConfigError('SPEND_CAP_MICRO_USD must not exceed the $10 ceiling');
  const fingerprint = JSON.stringify([
    cfg.textModels,
    cfg.visionModels,
    cfg.paidModels,
    cfg.paidEnabled,
    cfg.spendCapMicroUsd,
  ]);
  return Object.freeze({ ...cfg, fingerprint });
}

/** Effective global cap = lesser of the configured cap and the provider allowance. */
export function globalCap(c: ProxyConfig): number {
  return Math.min(c.globalProviderReqsPerDay, c.providerAllowancePerDay);
}
