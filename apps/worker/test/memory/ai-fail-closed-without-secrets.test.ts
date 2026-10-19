// AC26/AC39 fence (kill criterion): with the production wiring (lazy buildApp), AI stays
// unreachable before Phase 05 REGARDLESS of OPENROUTER_API_KEY: (a) DB missing -> /api/quota
// global_ok:false and /api/ai, /api/ocr refuse with zero claims and zero upstream; (b) D1 wired and
// TURNSTILE_SECRET missing -> refusals before any claim (invalid_session when a key is set),
// zero claims, zero upstream. /api/quota keeps the 04a rule and is not the fence for (b).
import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { buildApp } from '../../src/index';
import { aiBody, ocrBody, req, API_KEY } from '../fakes/harness';
import { KEYS } from './memory-harness';

let outbound: string[] = [];
const realFetch = globalThis.fetch;
beforeEach(() => {
  outbound = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    outbound.push(String(input instanceof Request ? input.url : input));
    throw new Error('outbound blocked in test');
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const quotaRows = async () =>
  (await env.DB.prepare('SELECT COALESCE(SUM(count), 0) AS n FROM quota_counter').first<{
    n: number;
  }>())!.n;
const vars = (apiKey: boolean) => ({
  AI_PROVIDER: 'openrouter',
  COOKIE_SIGNING_KEYS: JSON.stringify(KEYS),
  COOKIE_SIGNING_KID: 'k1',
  ...(apiKey ? { OPENROUTER_API_KEY: API_KEY } : {}),
});

describe.each([true, false])(
  'ai-fail-closed-without-secrets (OPENROUTER_API_KEY set: %s)',
  (apiKey) => {
    test('should keep AI fail closed when D1 is wired but no secrets are set', async () => {
      const e = { ...vars(apiKey), DB: env.DB };
      const app = buildApp(e as never);
      const before = await quotaRows();
      for (const [path, body] of [
        ['/api/ai', aiBody()],
        ['/api/ocr', ocrBody()],
      ] as const) {
        for (const turnstile of [null, 'XXXX.DUMMY.TOKEN.XXXX']) {
          const res = await app.fetch(req({ path, body, turnstile }), e as never, ctx);
          expect(res.status, `${path} ${turnstile}`).toBeGreaterThanOrEqual(400);
          const j = (await res.json()) as { error: { code: string; reason?: string } };
          if (apiKey) {
            expect(j.error.code).toBe('invalid_session');
            expect(j.error.reason).toBe(turnstile ? 'turnstile_failed' : 'turnstile_missing');
          }
        }
      }
      expect(await quotaRows()).toBe(before); // zero claims
      expect(outbound).toEqual([]); // zero upstream (Turnstile has no secret, so not even siteverify)
    });

    test('DB missing: /api/quota global_ok:false; /api/ai and /api/ocr refuse with zero upstream', async () => {
      const e = vars(apiKey);
      const app = buildApp(e as never);
      const q = await app.fetch(req({ path: '/api/quota' }), e as never, ctx);
      expect(q.status).toBe(200);
      expect(((await q.json()) as { global_ok: boolean }).global_ok).toBe(false);
      for (const [path, body] of [
        ['/api/ai', aiBody()],
        ['/api/ocr', ocrBody()],
      ] as const) {
        const res = await app.fetch(req({ path, body }), e as never, ctx);
        expect(res.status).toBeGreaterThanOrEqual(400);
      }
      expect(outbound).toEqual([]);
      // memory routes also fail closed without D1
      const s = await app.fetch(
        new Request('https://app.test/api/session', {
          method: 'POST',
          headers: {
            origin: 'https://app.test',
            'x-aduin-client': '1',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ analyst_name: 'A' }),
        }),
        e as never,
        ctx,
      );
      expect(s.status).toBe(503);
      expect(((await s.json()) as { error: { code: string } }).error.code).toBe(
        'memory_unavailable',
      );
    });
  },
);
