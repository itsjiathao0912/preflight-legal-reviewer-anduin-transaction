// Classify the FINAL OpenRouter result (OpenRouter already tried models[]). Upstream error
// bodies are never echoed: everything maps to an error code + short reason.
import { AiResultSchema, OcrResultSchema, type AiResult, type OcrResult } from '@aduin/core';
import type { ProxyKind } from './models-config';

const MAX_UPSTREAM_BYTES = 2 * 1024 * 1024;

export type Classified =
  | {
      ok: true;
      kind: ProxyKind;
      data: AiResult | OcrResult;
      model: string;
      /** usage.cost in USD (0 when absent). */
      costUsd: number;
    }
  | {
      ok: false;
      code: 'upstream_failed' | 'budget_cap';
      reason: string;
      retry_after_s?: number;
      /** true when a paid fallback may be attempted */
      retryable: boolean;
      /**
       * false ONLY when the provider definitely did not consume the request (never dispatched,
       * or rejected with a non-billing 4xx before generation). Claims are refunded only then.
       */
      consumed: boolean;
      /**
       * true ONLY for provider-side faults (upstream 5xx, 429, 402, timeout, network): the
       * visitor-scoped claims are refunded, global + spend kept. Malformed output and
       * 200-with-error bodies (inducible via prompt injection) leave it unset -> keep all.
       */
      providerFault?: boolean;
    };

/** Upstream statuses rejected before generation (OpenRouter does not bill these). */
export const NON_CONSUMING_STATUS: ReadonlySet<number> = new Set([400, 401, 403, 413, 415, 422]);

function retryAfter(res: Response): number | undefined {
  const h = res.headers.get('retry-after');
  if (h === null || !/^\d{1,6}$/.test(h.trim())) return undefined;
  return Number(h.trim());
}

/** One repair attempt without a new call: strip code fences / take the outer JSON object. */
export function parseContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const fenced = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const a = fenced.indexOf('{');
    const b = fenced.lastIndexOf('}');
    if (a < 0 || b <= a) return undefined;
    try {
      return JSON.parse(fenced.slice(a, b + 1));
    } catch {
      return undefined;
    }
  }
}

async function readCapped(res: Response): Promise<string | undefined> {
  const text = await res.text();
  return text.length > MAX_UPSTREAM_BYTES ? undefined : text;
}

export async function classify(kind: ProxyKind, res: Response): Promise<Classified> {
  if (res.status === 429) {
    await res.body?.cancel().catch(() => {});
    const ra = retryAfter(res);
    return {
      ok: false,
      code: 'upstream_failed',
      reason: 'provider_rate_limited',
      ...(ra !== undefined ? { retry_after_s: ra } : {}),
      retryable: true,
      consumed: true, // conservative: not in the definite non-consuming set
      providerFault: true,
    };
  }
  if (res.status === 402) {
    await res.body?.cancel().catch(() => {});
    return {
      ok: false,
      code: 'budget_cap',
      reason: 'provider_balance',
      retryable: false,
      consumed: true,
      providerFault: true,
    };
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return {
      ok: false,
      code: 'upstream_failed',
      reason: 'provider_error',
      retryable: true,
      consumed: !NON_CONSUMING_STATUS.has(res.status),
      providerFault: res.status >= 500,
    };
  }
  const malformed: Classified = {
    ok: false,
    code: 'upstream_failed',
    reason: 'malformed',
    retryable: false,
    consumed: true,
  };
  const text = await readCapped(res);
  if (text === undefined) return malformed;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return malformed;
  }
  if (typeof json !== 'object' || json === null) return malformed;
  const j = json as {
    error?: unknown;
    model?: unknown;
    choices?: { message?: { content?: unknown } }[];
    usage?: { cost?: unknown };
  };
  if (j.error !== undefined)
    return {
      ok: false,
      code: 'upstream_failed',
      reason: 'provider_error',
      retryable: true,
      consumed: true,
    };
  const content = j.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return malformed;
  const parsed = parseContent(content);
  const schema = kind === 'ai' ? AiResultSchema : OcrResultSchema;
  const r = schema.safeParse(parsed);
  if (!r.success) return malformed;
  const model =
    typeof j.model === 'string' && /^[A-Za-z0-9._/:-]{1,120}$/.test(j.model) ? j.model : 'unknown';
  const cost =
    typeof j.usage?.cost === 'number' && Number.isFinite(j.usage.cost) ? j.usage.cost : 0;
  return { ok: true, kind, data: r.data, model, costUsd: Math.max(0, cost) };
}
