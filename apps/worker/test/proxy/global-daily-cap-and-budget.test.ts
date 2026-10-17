import { QuotaResponseSchema } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { okAi, okOcr } from '../fakes/openrouter-stub';
import { aiBody, baseEnv, frames, makeHarness, PNG_B64, send, T0 } from '../fakes/harness';
import { keys } from '../../src/limits/policy';
import { globalCap, loadConfig } from '../../src/config';
import { nextUtcMidnightS, utcDay } from '../../src/limits/clock';

const g = (now: number) => keys('v', 'ip', now).global;

describe('global-daily-cap-and-budget (AC33)', () => {
  test('global cap = lesser of configured cap and provider allowance', () => {
    expect(globalCap(loadConfig({}))).toBe(35);
    expect(globalCap(loadConfig({ GLOBAL_PROVIDER_REQS_PER_DAY: '80' }))).toBe(50);
    expect(
      globalCap(
        loadConfig({ GLOBAL_PROVIDER_REQS_PER_DAY: '80', PROVIDER_ALLOWANCE_PER_DAY: '1000' }),
      ),
    ).toBe(80);
  });

  test('below cap passes, at cap refuses with reason global_cap (pre-stream HTTP)', async () => {
    const h = makeHarness();
    h.platform.set(g(T0), 33);
    h.or.reply(okAi());
    expect((await frames(await send(h))).terminal.t).toBe('result'); // 34 -> 35 used? 33+1=34
    h.or.reply(okAi());
    expect((await frames(await send(h, { body: aiBody('b') }))).terminal.t).toBe('result'); // 35
    const res = await send(h, { body: aiBody('c') });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      error: { code: 'quota_exhausted', reason: 'global_cap' },
    });
    expect(h.or.calls).toHaveLength(2);
  });

  test('above cap (counter beyond the cap) refuses and refunds the visitor claims', async () => {
    const h = makeHarness();
    h.platform.set(g(T0), 40);
    const res = await send(h);
    expect(res.status).toBe(429);
    const held = [...h.platform.counts.entries()]
      .filter(([k]) => !k.startsWith('global_ai'))
      .reduce((a, [, v]) => a + v, 0);
    expect(held).toBe(0);
  });

  test('UTC midnight resets the global window', async () => {
    const h = makeHarness();
    h.platform.set(g(T0), 35);
    expect((await send(h)).status).toBe(429);
    h.clock.now = Date.UTC(2026, 9, 18, 0, 0, 5);
    expect(utcDay(h.clock.now)).toBe('2026-10-18');
    h.or.reply(okAi());
    expect((await frames(await send(h))).terminal.t).toBe('result');
  });

  test('AI requests and OCR pages share ONE provider counter', async () => {
    const h = makeHarness();
    h.platform.set(g(T0), 33);
    h.or.reply(okOcr(), okAi());
    expect((await frames(await send(h, { path: '/api/ocr' }))).terminal.t).toBe('result');
    expect(h.platform.count(g(T0))).toBe(34);
    expect((await frames(await send(h))).terminal.t).toBe('result');
    expect(h.platform.count(g(T0))).toBe(35);
    const ocr = await send(h, {
      path: '/api/ocr',
      body: { v: 1, mime: 'image/jpeg', pages: [{ index: 1, data_b64: PNG_B64 }] },
    });
    expect(await ocr.json()).toMatchObject({ error: { reason: 'global_cap' } });
  });

  test('one claim per Worker request (OpenRouter models[] fallback is not re-claimed)', async () => {
    const h = makeHarness();
    h.or.reply(okAi());
    await frames(await send(h));
    expect(h.platform.count(g(T0))).toBe(1);
  });

  test('OCR pages limit per visitor (6/day) refuses with reason ocr_pages', async () => {
    const env = baseEnv({ VISITOR_OCR_PAGES_PER_DAY: '1' });
    const h2 = makeHarness({ env });
    h2.or.reply(okOcr());
    const [first] = [await send(h2, { path: '/api/ocr' })];
    await frames(first);
    const res = await send(h2, {
      path: '/api/ocr',
      body: { v: 1, mime: 'image/png', pages: [{ index: 3, data_b64: PNG_B64 }] },
      cookie: first.headers.get('set-cookie')!.split(';')[0],
    });
    expect(await res.json()).toMatchObject({
      error: { code: 'quota_exhausted', reason: 'ocr_pages' },
    });
    expect(h2.or.calls).toHaveLength(1); // only the first (allowed) OCR call reached upstream
  });

  test('GET /api/quota returns {ai, ocr_pages, global_ok} and performs zero port writes', async () => {
    const h = makeHarness();
    h.or.reply(okAi());
    const r1 = await send(h);
    await frames(r1);
    const cookie = r1.headers.get('set-cookie')!.split(';')[0];
    const writes = h.platform.writes;
    const claims = h.platform.claimLog.length;
    const res = await send(h, { path: '/api/quota', cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const q = QuotaResponseSchema.parse(await res.json());
    expect(q.ai).toEqual({ used: 1, limit: 3, resets_at: nextUtcMidnightS(h.clock.now) });
    expect(q.ocr_pages.limit).toBe(6);
    expect(q.global_ok).toBe(true);
    expect(h.platform.writes - writes).toBe(0);
    expect(h.platform.claimLog.length - claims).toBe(0);
  });

  test('GET /api/quota with the platform unavailable answers 200, used 0, global_ok false', async () => {
    const h = makeHarness({ down: true });
    const res = await send(h, { path: '/api/quota' });
    expect(res.status).toBe(200);
    const q = QuotaResponseSchema.parse(await res.json());
    expect(q.ai.used).toBe(0);
    expect(q.global_ok).toBe(false);
  });

  test('GET /api/quota global_ok is false when the global counter is at the cap', async () => {
    const h = makeHarness();
    h.platform.set(g(T0), 35);
    const q = QuotaResponseSchema.parse(await (await send(h, { path: '/api/quota' })).json());
    expect(q.global_ok).toBe(false);
  });
});
