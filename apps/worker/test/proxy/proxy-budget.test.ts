import { describe, expect, test } from 'vitest';
import { okAi, okOcr } from '../fakes/openrouter-stub';
import { frames, makeHarness, send, T0 } from '../fakes/harness';
import { keys } from '../../src/limits/policy';

const BUDGET = 12;

describe('proxy-budget (AC40 interim): <= 12 port calls per AI request', () => {
  test('AI miss for a new document stays within budget', async () => {
    const h = makeHarness();
    h.or.reply(okAi());
    await frames(await send(h));
    expect(h.platform.calls).toBeLessThanOrEqual(BUDGET);
    expect(h.or.calls).toHaveLength(1);
  });

  test('AI refusal at the global cap (claims + refunds) stays within budget', async () => {
    const h = makeHarness();
    h.platform.set(keys('v', 'ip', T0).global, 35);
    await (await send(h)).arrayBuffer();
    expect(h.platform.calls).toBeLessThanOrEqual(BUDGET);
  });

  test('AI upstream failure (claims + refunds) stays within budget', async () => {
    const h = makeHarness();
    h.or.reply({ status: 500, text: 'x' });
    await frames(await send(h));
    expect(h.platform.calls).toBeLessThanOrEqual(BUDGET);
  });

  test('a cache hit is a single port call; an OCR miss stays within budget', async () => {
    const h = makeHarness();
    h.or.reply(okAi(), okOcr());
    await frames(await send(h));
    const before = h.platform.calls;
    await frames(await send(h));
    expect(h.platform.calls - before).toBe(1);
    const b2 = h.platform.calls;
    await frames(await send(h, { path: '/api/ocr' }));
    expect(h.platform.calls - b2).toBeLessThanOrEqual(BUDGET);
  });
});
