import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { baseEnv, frames, makeHarness, send } from '../fakes/harness';
import { keys } from '../../src/limits/policy';
import { loadConfig } from '../../src/config';

const PAID = 'anthropic/claude-haiku-5';
const spendKey = keys('x', 'y', 0).spend;

describe('spend-cap-enforced (AC26)', () => {
  test('should refuse a paid call at the spend cap', async () => {
    const h = makeHarness({
      env: baseEnv({
        PAID_FALLBACK_ENABLED: 'true',
        AI_PAID_MODELS: PAID,
        SPEND_CAP_MICRO_USD: '50000',
      }),
    });
    h.platform.set(spendKey, 40_000); // reserve of 20_000 would exceed 50_000
    h.or.reply({ status: 429, json: {} });
    const { terminal } = await frames(await send(h));
    expect(terminal).toMatchObject({ t: 'error', code: 'budget_cap', reason: 'spend_cap' });
    expect(h.or.calls).toHaveLength(1); // the free call only; no paid call
    expect(h.or.calls.every((c) => String(c.json['model']).endsWith(':free'))).toBe(true);
  });

  test('paid fallback under the cap reserves first, then records serving model and usage.cost', async () => {
    const h = makeHarness({
      env: baseEnv({ PAID_FALLBACK_ENABLED: 'true', AI_PAID_MODELS: PAID }),
    });
    h.or.reply({ status: 429, json: {} }, okAi([], PAID, 0.0012));
    const { terminal } = await frames(await send(h));
    expect(terminal).toMatchObject({ t: 'result', model: PAID });
    expect(h.or.calls[1]!.json['model']).toBe(PAID);
    expect(h.platform.count(spendKey)).toBe(20_000);
    expect(h.platform.ledgerRows[0]).toMatchObject({
      model: PAID,
      cost_usd: 0.0012,
      cache: 'miss',
    });
  });

  for (const flag of ['TRUE', '1', 'yes', 'true ', ' true', 'false', '']) {
    test(`PAID_FALLBACK_ENABLED=${JSON.stringify(flag)} keeps the paid path disabled`, async () => {
      const env = baseEnv({ AI_PAID_MODELS: PAID });
      env['PAID_FALLBACK_ENABLED'] = flag;
      expect(loadConfig(env).paidEnabled).toBe(false);
      const h = makeHarness({ env });
      h.or.reply({ status: 429, json: {} });
      const { terminal } = await frames(await send(h));
      expect(terminal).toMatchObject({ t: 'error', code: 'upstream_failed' });
      expect(h.or.calls).toHaveLength(1);
    });
  }

  test('paid enabled with an empty paid list never makes a paid call', async () => {
    const h = makeHarness({ env: baseEnv({ PAID_FALLBACK_ENABLED: 'true' }) });
    h.or.reply({ status: 429, json: {} });
    await frames(await send(h));
    expect(h.or.calls).toHaveLength(1);
    expect(h.platform.count(spendKey)).toBe(0);
  });

  test('spend cap above $10 is rejected at config load', () => {
    expect(() => loadConfig(baseEnv({ SPEND_CAP_MICRO_USD: '10000001' }))).toThrow(/\$10/);
  });

  test('circuit breaker: non-zero cost while paid is disabled blocks further AI/OCR calls', async () => {
    const h = makeHarness();
    h.or.reply(okAi([], 'nvidia/nemotron-3.5-super-vl:free', 0.0001));
    expect((await frames(await send(h))).terminal.t).toBe('result');
    const res = await send(h, {
      body: {
        v: 1,
        law_firm_id: null,
        candidates: [{ id: 'c2', quote: 'other', section_path: [] }],
        settings: {},
      },
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      error: { code: 'budget_cap', reason: 'circuit_breaker' },
    });
    const ocr = await send(h, { path: '/api/ocr' });
    expect(ocr.status).toBe(503);
    expect(h.or.calls).toHaveLength(1);
  });

  test('circuit breaker resets at the next UTC day', async () => {
    const h = makeHarness();
    h.or.reply(okAi([], 'nvidia/nemotron-3.5-super-vl:free', 0.5), okAi());
    await frames(await send(h));
    h.clock.now += 86_400_000;
    const res = await send(h, {
      body: {
        v: 1,
        law_firm_id: null,
        candidates: [{ id: 'c2', quote: 'next day', section_path: [] }],
        settings: {},
      },
    });
    expect((await frames(res)).terminal.t).toBe('result');
  });

  test('a non-:free serving model while paid is disabled also trips the breaker', async () => {
    const h = makeHarness();
    h.or.reply(okAi([], 'some/paid-model', 0));
    await frames(await send(h));
    const res = await send(h, {
      body: {
        v: 1,
        law_firm_id: null,
        candidates: [{ id: 'c3', quote: 'x', section_path: [] }],
        settings: {},
      },
    });
    expect(res.status).toBe(503);
  });

  const next = (quote: string) => ({
    body: {
      v: 1,
      law_firm_id: null,
      candidates: [{ id: 'cn', quote, section_path: [] }],
      settings: {},
    },
  });

  test('F2: a suffix-less served id of a configured free model does NOT trip the breaker', async () => {
    const h = makeHarness();
    h.or.reply(okAi([], 'nvidia/nemotron-3.5-super-vl', 0), okAi());
    expect((await frames(await send(h))).terminal.t).toBe('result');
    const res = await send(h, next('second'));
    expect(res.status).toBe(200);
    expect((await frames(res)).terminal.t).toBe('result');
    expect(h.logs.some((l) => l.includes('proxy.circuit_breaker'))).toBe(false);
  });

  test('F2: usage.cost > 0 trips the breaker even for a configured :free id', async () => {
    const h = makeHarness();
    h.or.reply(okAi([], 'liquid/lfm-2.5-2.6b:free', 0.00001));
    await frames(await send(h));
    const res = await send(h, next('after cost'));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { reason: 'circuit_breaker' } });
  });

  test('F2: an unknown/unparseable served id with cost 0 does NOT trip (warning logged)', async () => {
    const h = makeHarness();
    h.or.reply(okAi([], 'bad id with spaces!', 0), okAi());
    expect((await frames(await send(h))).terminal).toMatchObject({ t: 'result', model: 'unknown' });
    const res = await send(h, next('after unknown'));
    expect(res.status).toBe(200);
    expect(h.logs.some((l) => l.includes('proxy.served_model_unknown'))).toBe(true);
    expect(h.logs.some((l) => l.includes('"proxy.circuit_breaker"'))).toBe(false);
  });

  test('F2: the breaker goes through BreakerPort (a persisted trip blocks; port errors fail closed)', async () => {
    const trips: string[] = [];
    const port = {
      tripped: async () => trips.length > 0,
      trip: async (day: string) => void trips.push(day),
    };
    const h = makeHarness({ breaker: port });
    h.or.reply(okAi([], 'some/paid-model', 0));
    await frames(await send(h));
    expect(trips).toEqual(['2026-10-17']);
    expect((await send(h, next('blocked'))).status).toBe(503);

    const broken = makeHarness({
      breaker: { tripped: () => Promise.reject(new Error('d1 down')), trip: async () => {} },
    });
    const res = await send(broken);
    expect(res.status).toBe(503);
    expect(broken.or.calls).toHaveLength(0);
  });
});
