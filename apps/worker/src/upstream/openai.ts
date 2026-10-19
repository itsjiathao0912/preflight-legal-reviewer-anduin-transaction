// OpenAI (direct) chat-completions provider: request builder, caller, cost maths, schema
// transformer, OCR wire schema + null normaliser, served-model check and error classifier.
// The host is a code constant (no env override) and the call never follows a redirect, so the
// bearer key can only ever reach api.openai.com. Upstream error bodies are read (at most 4 KB)
// only to tell `insufficient_quota` from a rate limit; they are never echoed or logged.
import { responseFormat, type AiResponseMode, type LlmTask } from '@aduin/core';
import type { ProxyConfig } from '../config';
import type { Classified } from './classify';
import { MAX_TOKENS, type ProxyKind } from './models-config';

export const OPENAI_BASE = 'https://api.openai.com/v1';
export const OPENAI_MODEL = 'gpt-4.1-mini';
/**
 * µUSD per 1M tokens. Launch price of gpt-4.1-mini ($0.40 in / $1.60 out per 1M tokens), as of
 * 19-10-26 NOT re-checked on the live pricing page (EXECUTE could not browse): launch price, to
 * confirm in M5.3 probe (compare the probe's usage x these constants with the OpenAI dashboard).
 */
export const OPENAI_PRICES_MICRO_USD_PER_MTOK = Object.freeze({
  'gpt-4.1-mini': Object.freeze({ in: 400_000, out: 1_600_000 }),
});
/** Served ids that count as the configured model (bare or dated snapshot). */
export const OPENAI_SERVED_RE = /^gpt-4\.1-mini(-\d{4}-\d{2}-\d{2})?$/;
/** Worst-case input tokens charged per image part (base64 bytes are never counted). */
export const IMAGE_TOKENS_WORST = 3000;
/** Worst-case per-message overhead tokens. */
export const MESSAGE_TOKENS_WORST = 16;
const ERROR_BODY_MAX = 4096;

/** Exact cost in µUSD (ceil) for token counts; the cached-input discount is ignored. */
export function costMicroUsd(inTok: number, outTok: number): number {
  const p = OPENAI_PRICES_MICRO_USD_PER_MTOK[OPENAI_MODEL];
  return Math.ceil((inTok * p.in + outTok * p.out) / 1_000_000);
}

const utf8 = (s: string): number => new TextEncoder().encode(s).byteLength;

/** Replace every `"data:..."` string (base64 image URLs) by `""` without parsing the payload. */
function stripDataUrls(json: string): string {
  let out = '';
  let from = 0;
  for (;;) {
    const at = json.indexOf('"data:', from);
    if (at < 0) return out + json.slice(from);
    const end = json.indexOf('"', at + 1);
    if (end < 0) return out + json.slice(from);
    out += json.slice(from, at) + '""';
    from = end + 1;
  }
}

/**
 * Worst-case cost of a request in µUSD: input = UTF-8 bytes of every text part + UTF-8 bytes of
 * the response_format JSON (structured-output schemas are billed as input) + IMAGE_TOKENS_WORST
 * per image part + MESSAGE_TOKENS_WORST per message; output = max_completion_tokens. One byte
 * is at least one token's worth, so this never under-counts.
 */
export function worstCaseMicroUsd(
  kind: ProxyKind,
  messagesJson: string,
  responseFormatJson: string,
): number {
  let inTok = utf8(responseFormatJson);
  let msgs: unknown;
  try {
    msgs = JSON.parse(stripDataUrls(messagesJson));
  } catch {
    msgs = undefined;
  }
  if (!Array.isArray(msgs)) inTok += utf8(messagesJson);
  else
    for (const m of msgs) {
      inTok += MESSAGE_TOKENS_WORST;
      const c = (m as { content?: unknown }).content;
      if (typeof c === 'string') inTok += utf8(c);
      else if (Array.isArray(c))
        for (const part of c) {
          const p = part as { type?: unknown; text?: unknown };
          if (p.type === 'image_url') inTok += IMAGE_TOKENS_WORST;
          else if (typeof p.text === 'string') inTok += utf8(p.text);
        }
    }
  return costMicroUsd(inTok, MAX_TOKENS[kind]);
}

/** Request body (string template so the OCR base64 is never re-serialized). */
export function buildOpenAiBody(
  kind: ProxyKind,
  messagesJson: string,
  responseFormatJson: string,
): string {
  return (
    `{"model":${JSON.stringify(OPENAI_MODEL)},"messages":${messagesJson},"temperature":0,` +
    `"max_completion_tokens":${MAX_TOKENS[kind]},"response_format":${responseFormatJson},` +
    `"stream":true,"stream_options":{"include_usage":true}}`
  );
}

export function callOpenAi(
  fetchFn: typeof fetch,
  cfg: ProxyConfig,
  body: string,
  signal: AbortSignal,
): Promise<Response> {
  if (!cfg.openaiApiKey) return Promise.reject(new Error('missing api key'));
  return fetchFn(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cfg.openaiApiKey}`,
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body,
    signal,
    // never follow a redirect (see callOpenRouter): a 3xx fails in classify's `!res.ok`
    redirect: 'manual',
  });
}

/** Breaker verdict for a served id: the configured model (bare or dated) is ok, anything else trips. */
export function checkServedOpenAi(model: string): 'ok' | 'trip' {
  return OPENAI_SERVED_RE.test(model) ? 'ok' : 'trip';
}

const STRIP = new Set(['minLength', 'maxLength', 'minimum', 'maximum', 'maxItems']);

/** Deep copy of a JSON schema without the length/range keywords OpenAI strict mode rejects. */
export function stripSchemaKeywords(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(stripSchemaKeywords);
  if (typeof schema !== 'object' || schema === null) return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (STRIP.has(k)) continue;
    if (k === 'properties' && typeof v === 'object' && v !== null && !Array.isArray(v)) {
      // property NAMES are data, never keywords: copy the map, transform each property schema
      const props: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(v as Record<string, unknown>))
        props[pk] = stripSchemaKeywords(pv);
      out[k] = props;
    } else out[k] = stripSchemaKeywords(v);
  }
  return out;
}

/** AI response_format for OpenAI: core format, schema keywords stripped, strict on. */
export function openAiResponseFormat(task: LlmTask, mode: AiResponseMode): string {
  const rf = responseFormat(task, mode) as {
    type: string;
    json_schema?: { name: string; schema: unknown };
  };
  if (rf.type !== 'json_schema' || !rf.json_schema) return JSON.stringify(rf);
  return JSON.stringify({
    type: 'json_schema',
    json_schema: {
      name: rf.json_schema.name,
      strict: true,
      schema: stripSchemaKeywords(rf.json_schema.schema),
    },
  });
}

const num = { type: 'number' } as const;
/**
 * Hand-written OCR wire schema (OpenAI strict): every property required, `bbox`/`conf` nullable,
 * `additionalProperties:false` everywhere, `v` as an enum (not `const`), no `ext`, no
 * length/range keywords. Replies go through `normalizeOcr` and then the frozen OcrResultSchema.
 */
export const OPENAI_OCR_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['v', 'pages'],
  properties: {
    v: { type: 'integer', enum: [1] },
    pages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'lines'],
        properties: {
          index: { type: 'integer' },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'bbox', 'conf'],
              properties: {
                text: { type: 'string' },
                bbox: {
                  anyOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      required: ['x', 'y', 'w', 'h'],
                      properties: { x: num, y: num, w: num, h: num },
                    },
                    { type: 'null' },
                  ],
                },
                conf: { type: ['number', 'null'] },
              },
            },
          },
        },
      },
    },
  },
});

let ocrFormat: string | undefined;
export function openAiOcrResponseFormat(): string {
  ocrFormat ??= JSON.stringify({
    type: 'json_schema',
    json_schema: { name: 'ocr_result', strict: true, schema: OPENAI_OCR_SCHEMA },
  });
  return ocrFormat;
}

/** Drop null-valued object fields (deep) so the nullable wire fields become optional again. */
export function normalizeOcr(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw.map(normalizeOcr);
  if (typeof raw !== 'object' || raw === null) return raw;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>))
    if (v !== null) out[k] = normalizeOcr(v);
  return out;
}

/** Read at most ERROR_BODY_MAX bytes of an error body, then cancel the rest. Never throws. */
async function readErrorHead(res: Response): Promise<string> {
  const body = res.body;
  if (!body) return '';
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  try {
    while (n < ERROR_BODY_MAX) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      n += value.byteLength;
    }
  } catch {
    // unreadable body: treat as empty
  } finally {
    reader.cancel().catch(() => {});
  }
  const all = new Uint8Array(Math.min(n, ERROR_BODY_MAX));
  let at = 0;
  for (const p of parts) {
    if (at >= all.length) break;
    const take = p.subarray(0, all.length - at);
    all.set(take, at);
    at += take.byteLength;
  }
  return new TextDecoder().decode(all);
}

function isInsufficientQuota(text: string): boolean {
  try {
    const j = JSON.parse(text) as { error?: { code?: unknown; type?: unknown } };
    return j.error?.code === 'insufficient_quota' || j.error?.type === 'insufficient_quota';
  } catch {
    return false;
  }
}

/**
 * OpenAI-specific error classes (checked before the shared classifier). Returns undefined for
 * statuses the shared `classify` handles unchanged.
 * - 429 `insufficient_quota` -> budget_cap / provider_balance, non-retryable, not consumed.
 * - 401 / 403 -> upstream_failed / provider_auth, not consumed.
 * - any other 429 -> provider_rate_limited (same shape as the shared classifier).
 */
export async function classifyOpenAiError(res: Response): Promise<Classified | undefined> {
  if (res.status !== 401 && res.status !== 403 && res.status !== 429) return undefined;
  const text = await readErrorHead(res);
  if (res.status === 401 || res.status === 403)
    return {
      ok: false,
      code: 'upstream_failed',
      reason: 'provider_auth',
      retryable: false,
      consumed: false,
    };
  if (isInsufficientQuota(text))
    return {
      ok: false,
      code: 'budget_cap',
      reason: 'provider_balance',
      retryable: false,
      consumed: false,
    };
  const h = res.headers.get('retry-after');
  const ra = h !== null && /^\d{1,6}$/.test(h.trim()) ? Number(h.trim()) : undefined;
  return {
    ok: false,
    code: 'upstream_failed',
    reason: 'provider_rate_limited',
    ...(ra !== undefined ? { retry_after_s: ra } : {}),
    retryable: false,
    consumed: true,
    providerFault: true,
  };
}
