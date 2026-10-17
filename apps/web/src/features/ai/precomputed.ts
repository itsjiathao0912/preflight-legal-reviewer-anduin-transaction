/**
 * Static precomputed AI results (first step of the lookup order: static -> /api/ai).
 * File: `/precomputed/{docHash}.{rulesHash8}.json` (committed for bundled samples #1 and #3).
 * The result is NOT trusted: the lane re-verifies it in the engine worker on every open.
 * A missing file (404, or the SPA fallback page) is simply a miss; nothing is logged.
 */
export interface PrecomputedAi {
  docHash: string;
  rulesHash8: string;
  model: string;
  result: unknown;
}

const HEX64 = /^[0-9a-f]{64}$/;
const HASH8 = /^(?:[0-9a-f]{8}|none)$/;

export function precomputedPath(docHash: string, rulesHash8: string): string | null {
  if (!HEX64.test(docHash) || !HASH8.test(rulesHash8)) return null;
  return `precomputed/${docHash}.${rulesHash8}.json`;
}

export async function loadPrecomputed(
  base: string,
  docHash: string,
  rulesHash8: string,
  opts: { signal?: AbortSignal; fetchFn?: typeof fetch } = {},
): Promise<PrecomputedAi | null> {
  const path = precomputedPath(docHash, rulesHash8);
  if (!path || base === '') return null;
  const url = `${base.replace(/\/+$/, '')}/${path}`;
  try {
    const res = await (opts.fetchFn ?? fetch)(url, {
      credentials: 'same-origin',
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    if (!res.ok || !/json/i.test(res.headers.get('content-type') ?? '')) return null;
    const j = (await res.json()) as Record<string, unknown>;
    if (
      j['kind'] !== 'aduin-precomputed-ai' ||
      j['docHash'] !== docHash ||
      j['rulesHash8'] !== rulesHash8 ||
      typeof j['model'] !== 'string' ||
      !j['result']
    )
      return null;
    return { docHash, rulesHash8, model: j['model'].slice(0, 120), result: j['result'] };
  } catch {
    return null;
  }
}
