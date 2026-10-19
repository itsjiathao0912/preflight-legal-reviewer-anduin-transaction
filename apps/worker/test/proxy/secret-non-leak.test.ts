import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { API_KEY, baseEnv, bodyText, makeHarness, send } from '../fakes/harness';
import { NET_GUARD_MESSAGE } from '../setup';
import { createLogger } from '../../src/proxy/log';
import { configFor } from '../../src/proxy/pipeline';
import proxyRoutesSrc from '../../src/routes/proxy/index.ts?raw';
import { aiAnswer } from '../fakes/openai-stub';
import { makeOpenAiHarness, openAiEnv, OPENAI_TEST_KEY } from '../fakes/openai-harness';

/** The production logger wiring (routes/proxy/index.ts) for an OpenAI config. */
function createLoggerFor(lines: string[]) {
  const cfg = configFor(openAiEnv());
  return createLogger((l) => lines.push(l), [cfg.apiKey, cfg.turnstileSecret, cfg.openaiApiKey]);
}

const LEAK = 'UPSTREAM-ERROR-BODY-MARKER';

describe('secret-non-leak (AC26/AC39)', () => {
  test('should never include the api key in any response, header or log line', async () => {
    const h = makeHarness();
    h.or.reply(
      okAi(),
      { status: 500, text: `${LEAK} key=${API_KEY}` },
      { status: 429, json: { error: { message: `${LEAK} ${API_KEY}` } } },
      { status: 200, text: `{"error":"${LEAK} ${API_KEY}"}` },
      { throws: `${LEAK} ${API_KEY}` },
    );
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await send(h, {
        body: {
          v: 1,
          law_firm_id: null,
          candidates: [{ id: `c${i}`, quote: `q${i}`, section_path: [] }],
          settings: {},
        },
      });
      res.headers.forEach((v, k) => seen.push(`${k}: ${v}`));
      seen.push(await bodyText(res));
    }
    seen.push(await bodyText(await send(h, { path: '/api/quota' })));
    const all = [...seen, ...h.logs].join('\n');
    expect(all).not.toContain(API_KEY);
    expect(all).not.toContain(LEAK); // upstream error bodies are never echoed
    expect(h.logs.length).toBeGreaterThan(0);
    // the key is sent upstream only, as a bearer header
    expect(h.or.calls[0]!.headers['authorization']).toBe(`Bearer ${API_KEY}`);
    expect(h.or.calls.every((c) => !c.body.includes(API_KEY))).toBe(true);
  });

  test('all proxy responses carry cache-control no-store and no CORS headers', async () => {
    const h = makeHarness();
    h.or.reply(okAi());
    const rs = [
      await send(h),
      await send(h), // cache hit
      await send(h, { headers: { origin: 'https://evil.example' } }),
      await send(h, { path: '/api/quota' }),
    ];
    for (const r of rs) {
      expect(r.headers.get('cache-control')).toBe('no-store');
      r.headers.forEach((_v, k) => expect(k.startsWith('access-control-')).toBe(false));
      await r.arrayBuffer();
    }
    const pre = await send(h, { method: 'OPTIONS' });
    expect(pre.status).toBe(404); // no CORS preflight handling
    pre.headers.forEach((_v, k) => expect(k.startsWith('access-control-')).toBe(false));
  });

  test('missing key fails closed (degrade) with no upstream call', async () => {
    const h = makeHarness({ env: baseEnv({ OPENROUTER_API_KEY: undefined }) });
    const res = await send(h);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      error: { code: 'quota_exhausted', reason: 'ai_unavailable' },
    });
    expect(h.or.calls).toHaveLength(0);
  });

  test("F6: the OpenRouter call never follows redirects (redirect: 'manual')", async () => {
    const h = makeHarness();
    h.or.reply(okAi());
    await bodyText(await send(h));
    expect(h.or.calls).toHaveLength(1);
    expect(h.or.calls[0]!.redirect).toBe('manual');
  });

  test('F6: an upstream 302 is a failure and the Location is never fetched', async () => {
    const h = makeHarness();
    h.or.reply({ status: 302, text: '', headers: { location: 'https://openrouter.ai/elsewhere' } });
    const text = await bodyText(await send(h));
    expect(text).toContain('upstream_failed');
    expect(h.or.calls).toHaveLength(1);
  });

  test('base URL must be https with host openrouter.ai (else fail closed, no call)', async () => {
    const h = makeHarness({
      env: baseEnv({ OPENROUTER_BASE_URL: 'https://attacker.example/api/v1' }),
    });
    expect((await send(h)).status).toBe(429);
    expect(h.or.calls).toHaveLength(0);
  });

  test('redactor drops sensitive fields and scrubs secret values', () => {
    const lines: string[] = [];
    const log = createLogger((l) => lines.push(l), [API_KEY]);
    log.log(`evt ${API_KEY}`, {
      authorization: `Bearer ${API_KEY}`,
      'x-api-key': API_KEY,
      body: 'raw-body',
      note: `k=${API_KEY}`,
      nested: { cookie: 'c', ok: 1 },
    });
    const out = lines.join('');
    expect(out).not.toContain(API_KEY);
    expect(out).not.toContain('raw-body');
    expect(JSON.parse(lines[0]!).nested.ok).toBe(1);
  });

  test('OPENAI_API_KEY never appears in any response, header or log line (AC17, AC18)', async () => {
    const h = makeOpenAiHarness();
    h.oa.reply(
      { answer: aiAnswer() },
      { status: 500, text: `${LEAK} key=${OPENAI_TEST_KEY}` },
      { status: 401, json: { error: { message: `${LEAK} ${OPENAI_TEST_KEY}` } } },
      {
        status: 429,
        json: { error: { message: `${LEAK} ${OPENAI_TEST_KEY}`, code: 'insufficient_quota' } },
      },
      { answer: `${LEAK} ${OPENAI_TEST_KEY}` },
      { throws: `${LEAK} ${OPENAI_TEST_KEY}` },
    );
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await send(h, {
        body: {
          v: 1,
          law_firm_id: null,
          candidates: [{ id: `c${i}`, quote: `q${i}`, section_path: [] }],
          settings: {},
        },
      });
      res.headers.forEach((v, k) => seen.push(`${k}: ${v}`));
      seen.push(await bodyText(res));
    }
    seen.push(await bodyText(await send(h, { path: '/api/quota' })));
    // the logger scrubs the key even when a log field carries it (secret list includes it)
    const lines: string[] = [];
    createLoggerFor(lines).log('probe', { note: `k=${OPENAI_TEST_KEY}` });
    expect(proxyRoutesSrc).toContain('cfg?.openaiApiKey'); // the real logger secret list
    const all = [...seen, ...h.logs, ...lines].join('\n');
    expect(h.logs.length).toBeGreaterThan(0);
    expect(all).not.toContain(OPENAI_TEST_KEY);
    expect(all).not.toContain(LEAK);
    expect(h.oa.calls[0]!.headers['authorization']).toBe(`Bearer ${OPENAI_TEST_KEY}`);
    expect(h.oa.calls.every((c) => !c.body.includes(OPENAI_TEST_KEY))).toBe(true);
  });

  test('net guard: an unmocked global fetch throws (no live network in tests)', () => {
    expect(() => fetch('https://openrouter.ai/api/v1/models')).toThrow(NET_GUARD_MESSAGE);
  });
});
