import { apiUrl } from './base';
import { clientHeaders } from './http';

/** GET /api/quota allowance (fields `{ai, ocr_pages, global_ok}`; no Turnstile site key). */
export interface Allowance {
  used: number;
  limit: number;
  /** epoch seconds of the next reset */
  resetsAt: number;
}
export interface QuotaView {
  ai: Allowance;
  ocrPages: Allowance;
  globalOk: boolean;
}

function bucket(v: unknown): Allowance | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const n = (k: string) => {
    const x = o[k];
    return typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : null;
  };
  const used = n('used');
  const limit = n('limit');
  const resetsAt = n('resets_at');
  if (used === null || limit === null || resetsAt === null) return null;
  return { used, limit, resetsAt };
}

/**
 * Fetch the allowance. Returns null (never throws, never logs) when the API base is '' or the call
 * fails in any way, so callers keep the stub allowance silently (G14, E21c).
 */
export async function fetchQuota(fetchFn: typeof fetch = fetch): Promise<QuotaView | null> {
  const url = apiUrl('api/quota');
  if (!url) return null;
  try {
    const res = await fetchFn(url, { credentials: 'same-origin', headers: clientHeaders() });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    const ai = bucket(j['ai']);
    const ocrPages = bucket(j['ocr_pages']);
    if (!ai || !ocrPages || typeof j['global_ok'] !== 'boolean') return null;
    return { ai, ocrPages, globalOk: j['global_ok'] };
  } catch {
    return null;
  }
}
