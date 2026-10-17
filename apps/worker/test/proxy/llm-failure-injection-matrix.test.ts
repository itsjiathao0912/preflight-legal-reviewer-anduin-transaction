import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { bodyText, frames, makeHarness, send, T0 } from '../fakes/harness';
import { FakePlatform } from '../fakes/platform';
import { UPSTREAM_IDLE_MS } from '../../src/proxy/pipeline';
import { Claims, claimAi, claimOcr, keys, usageKeys } from '../../src/limits/policy';

function heldUnits(h: ReturnType<typeof makeHarness>): number {
  let n = 0;
  for (const v of h.platform.counts.values()) n += v;
  return n;
}

/** Provider-side failure after dispatch: visitor/doc claims refunded, only global kept. */
function expectVisitorRefundedGlobalKept(h: ReturnType<typeof makeHarness>): void {
  expect(h.platform.count(keys('x', 'y', T0).global)).toBe(1);
  expect(heldUnits(h)).toBe(1); // only the global provider counter stays held
  expect(h.platform.refunds.length).toBeGreaterThan(0);
}

/** Attacker-inducible failure (malformed / 200+error): nothing refunded (review F11). */
function expectAllKept(h: ReturnType<typeof makeHarness>): void {
  expect(h.platform.count(keys('x', 'y', T0).global)).toBe(1);
  expect(heldUnits(h)).toBeGreaterThan(1); // visitor claims stay held too
  expect(h.platform.refunds).toHaveLength(0);
}

describe('llm-failure-injection-matrix (AC26)', () => {
  test('dispatched 5xx refunds visitor/doc claims, keeps the global counter', async () => {
    const h = makeHarness();
    h.or.reply({ status: 500, text: 'internal provider stack trace sk-or-v1-leak' });
    const { terminal } = await frames(await send(h));
    expect(terminal).toMatchObject({ t: 'error', code: 'upstream_failed' });
    expect(h.platform.claimLog.some((c) => c.ok)).toBe(true);
    expectVisitorRefundedGlobalKept(h);
    expect(h.platform.ledgerRows).toHaveLength(0); // no cost recorded
  });

  for (const status of [400, 401, 403, 413, 415, 422]) {
    test(`definite non-consuming ${status} -> every claimed unit refunded`, async () => {
      const h = makeHarness();
      h.or.reply({ status, json: { error: { message: 'rejected' } } });
      const { terminal } = await frames(await send(h));
      expect(terminal).toMatchObject({
        t: 'error',
        code: 'upstream_failed',
        reason: 'provider_error',
      });
      expect(h.platform.claimLog.some((c) => c.ok)).toBe(true);
      expect(heldUnits(h)).toBe(0);
      expect(h.platform.cacheMap.size).toBe(0);
    });
  }

  const rows: [
    string,
    Parameters<ReturnType<typeof makeHarness>['or']['reply']>[0],
    Record<string, unknown>,
    'visitor' | 'none',
  ][] = [
    [
      '429',
      { status: 429, json: { error: { message: 'rate' } }, headers: { 'retry-after': '12' } },
      { code: 'upstream_failed', reason: 'provider_rate_limited', retry_after_s: 12 },
      'visitor',
    ],
    [
      '402',
      { status: 402, json: { error: { message: 'negative balance' } } },
      { code: 'budget_cap', reason: 'provider_balance' },
      'visitor',
    ],
    [
      'malformed body',
      { status: 200, text: '{not json' },
      { code: 'upstream_failed', reason: 'malformed' },
      'none',
    ],
    [
      'malformed content',
      {
        status: 200,
        json: { model: 'x:free', choices: [{ message: { content: 'sorry, no JSON here' } }] },
      },
      { code: 'upstream_failed', reason: 'malformed' },
      'none',
    ],
    [
      'schema-invalid content',
      { status: 200, json: { model: 'x:free', choices: [{ message: { content: '{"v":2}' } }] } },
      { code: 'upstream_failed', reason: 'malformed' },
      'none',
    ],
    [
      '200 with error field',
      { status: 200, json: { error: { message: 'upstream boom' } } },
      { code: 'upstream_failed', reason: 'provider_error' },
      'none',
    ],
    [
      'network error',
      { throws: 'ECONNRESET' },
      { code: 'upstream_failed', reason: 'network' },
      'visitor',
    ],
  ];
  for (const [name, reply, expected, refund] of rows) {
    const what = refund === 'visitor' ? 'visitor refunded, global kept' : 'nothing refunded';
    test(`${name} -> degrade frame, ${what}, nothing cached`, async () => {
      const h = makeHarness();
      h.or.reply(reply);
      const res = await send(h);
      expect(res.status).toBe(200);
      const { terminal } = await frames(res);
      expect(terminal).toMatchObject({ t: 'error', ...expected });
      if (refund === 'visitor') expectVisitorRefundedGlobalKept(h);
      else expectAllKept(h);
      expect(h.platform.cacheMap.size).toBe(0);
      expect(h.or.calls).toHaveLength(1); // the Worker never loops models itself
    });
  }

  test('upstream timeout aborts upstream and refunds visitor claims, keeps global (D2)', async () => {
    const h = makeHarness({ fakeTimers: true });
    h.or.reply({ hang: true });
    const res = await send(h);
    const text = bodyText(res);
    await new Promise((r) => setTimeout(r, 0));
    h.timers!.advance(UPSTREAM_IDLE_MS);
    const { terminal } = await (async () => {
      const { parseFrameStream } = await import('@aduin/core');
      return parseFrameStream(await text);
    })();
    expect(terminal).toMatchObject({ t: 'error', code: 'upstream_failed', reason: 'timeout' });
    expect(h.or.aborted).toBe(1);
    await new Promise((r) => setTimeout(r, 0));
    expectVisitorRefundedGlobalKept(h);
    expect(h.platform.ledgerRows).toHaveLength(0);
    expect(h.platform.cacheMap.size).toBe(0);
  });

  test('OCR provider 5xx refunds visitor OCR page claims, keeps global pages', async () => {
    const h = makeHarness();
    h.or.reply({ status: 503, text: 'unavailable' });
    const { terminal } = await frames(await send(h, { path: '/api/ocr' }));
    expect(terminal).toMatchObject({ t: 'error', code: 'upstream_failed' });
    const k = keys('x', 'y', T0);
    expect(h.platform.claimLog.some((c) => c.ok && c.key.scope === 'visitor_ocr')).toBe(true);
    expect(h.platform.count(k.global)).toBe(1); // 1 page held on the shared counter
    expect(heldUnits(h)).toBe(1); // ocr|v and ocr|ip page claims refunded
    expect(h.platform.refunds.length).toBe(2);
  });

  test('INVARIANT: global is the last claim of a successful claimAi / claimOcr (F12)', async () => {
    const p = new FakePlatform({ capFor: () => 100 });
    const k = keys('v1', 'ip1', T0);
    const ai = new Claims(p.quota(usageKeys('v1', 'ip1', T0)));
    expect(await claimAi(ai, k, 'doc1', 60)).toBeNull();
    expect(ai.scopes().at(-1)).toBe('global_ai');
    expect(ai.scopes().filter((s) => s === 'global_ai')).toHaveLength(1);
    const ocr = new Claims(p.quota(usageKeys('v1', 'ip1', T0)));
    expect(await claimOcr(ocr, k, 3, 60)).toBeNull();
    expect(ocr.scopes()).toEqual(['visitor_ocr', 'visitor_ocr', 'global_ai']);
    await ocr.refundVisitorScoped();
    expect(ocr.scopes()).toEqual(['global_ai']);
  });

  test('one repair attempt for fenced JSON content, without a new call', async () => {
    const h = makeHarness();
    h.or.reply({
      status: 200,
      json: {
        model: 'm:free',
        choices: [{ message: { content: '```json\n{"v":1,"findings":[]}\n```' } }],
      },
    });
    const { terminal } = await frames(await send(h));
    expect(terminal).toMatchObject({ t: 'result', kind: 'ai', cache: 'miss', model: 'm:free' });
    expect(h.or.calls).toHaveLength(1);
  });

  test('a retry after failure is a normal request; success then caches (no lost work)', async () => {
    const h = makeHarness();
    h.or.reply({ status: 429, json: {} }, okAi());
    await bodyText(await send(h));
    const second = await frames(await send(h));
    expect(second.terminal).toMatchObject({ t: 'result', cache: 'miss' });
    const third = await frames(await send(h));
    expect(third.terminal).toMatchObject({ t: 'result', cache: 'hit' });
  });

  test('platform down -> fail closed before any upstream call', async () => {
    const h = makeHarness({ down: true });
    const res = await send(h);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      error: { code: 'quota_exhausted', reason: 'ai_unavailable' },
    });
    expect(h.or.calls).toHaveLength(0);
  });
});
