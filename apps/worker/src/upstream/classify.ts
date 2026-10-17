// Classify the FINAL OpenRouter result (OpenRouter already tried models[]). Upstream error
// bodies are never echoed: everything maps to an error code + short reason.
// Phase 05 (G2): AI is task-aware. The parsed model JSON (prose/fences tolerated by
// `parseContent`) is validated ONCE by `task.validate`, which wraps it into the envelope (v:1,
// usage, ext.dropped), drops individually invalid findings and runs `AiResultSchema` once.
// A truncated AI reply (finish_reason "length") is malformed (claims kept, nothing cached).
import {
  OcrResultSchema,
  type AiResult,
  type LlmTask,
  type LlmTaskInput,
  type LlmUsage,
  type OcrResult,
} from '@aduin/core';
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

/** AI validation context: the task that built the messages and the input that was sent. */
export interface AiClassifyContext {
  task: LlmTask;
  input: LlmTaskInput;
}

function tokenCount(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined;
}

/** Provider usage (OpenAI shape) -> envelope usage; absent counts are omitted. */
function usageOf(u: unknown): LlmUsage | undefined {
  if (typeof u !== 'object' || u === null) return undefined;
  const r = u as Record<string, unknown>;
  const tin = tokenCount(r['prompt_tokens']);
  const tout = tokenCount(r['completion_tokens']);
  if (tin === undefined && tout === undefined) return undefined;
  return {
    ...(tin !== undefined ? { tokens_in: tin } : {}),
    ...(tout !== undefined ? { tokens_out: tout } : {}),
  };
}

export async function classify(
  kind: ProxyKind,
  res: Response,
  ai?: AiClassifyContext,
): Promise<Classified> {
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
    choices?: { message?: { content?: unknown }; finish_reason?: unknown }[];
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
  const choice = j.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== 'string') return malformed;
  let data: AiResult | OcrResult;
  if (kind === 'ai') {
    // fail closed: the AI path always validates with its task
    if (!ai) return malformed;
    if (choice?.finish_reason === 'length') return malformed;
    const v = ai.task.validate(parseContent(content), ai.input, usageOf(j.usage));
    if (!v.ok) return malformed;
    data = v.result;
  } else {
    const r = OcrResultSchema.safeParse(parseContent(content));
    if (!r.success) return malformed;
    data = r.data;
  }
  const model =
    typeof j.model === 'string' && /^[A-Za-z0-9._/:-]{1,120}$/.test(j.model) ? j.model : 'unknown';
  const cost =
    typeof j.usage?.cost === 'number' && Number.isFinite(j.usage.cost) ? j.usage.cost : 0;
  return { ok: true, kind, data, model, costUsd: Math.max(0, cost) };
}
