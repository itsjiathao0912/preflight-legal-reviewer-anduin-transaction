// AC5 (D2): an upstream timeout (idle or ceiling, AI or OCR) refunds the visitor-scoped claims and
// keeps the global counter + spend; nothing is cached and no ledger row is written. A client
// abort after dispatch still keeps ALL claims.
import { parseFrameStream } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { bodyText, makeHarness, send, T0, type Harness } from '../fakes/harness';
import type { SseController } from '../fakes/openrouter-stub';
import { keys } from '../../src/limits/policy';
import {
  UPSTREAM_IDLE_MS,
  UPSTREAM_OCR_TIMEOUT_MS,
  UPSTREAM_TIMEOUT_MS,
} from '../../src/proxy/pipeline';

const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};
function heldUnits(h: Harness): number {
  let n = 0;
  for (const v of h.platform.counts.values()) n += v;
  return n;
}

describe('timeout-refund (AC5, D2)', () => {
  test('should refund reqV docV docIp and keep global and spend on upstream timeout (idle)', async () => {
    const h = makeHarness({ fakeTimers: true });
    h.or.reply({ hang: true });
    const text = bodyText(await send(h));
    await flush();
    const taken = h.platform.claimLog.filter((c) => c.ok);
    expect(taken.length).toBeGreaterThan(1); // visitor-scoped claims were taken
    h.timers!.advance(UPSTREAM_IDLE_MS);
    expect(parseFrameStream(await text).terminal).toMatchObject({ reason: 'timeout' });
    await flush();
    expect(h.platform.count(keys('x', 'y', T0).global)).toBe(1);
    expect(heldUnits(h)).toBe(1); // only the global provider counter stays held
    expect(h.platform.refunds.length).toBe(taken.length - 1); // every claim except global
    expect(h.platform.cacheMap.size).toBe(0);
    expect(h.platform.ledgerRows).toHaveLength(0);
    expect(h.logs.some((l) => l.includes('proxy.claims_kept'))).toBe(false);
  });

  test('ceiling timeout refunds the visitor claims too', async () => {
    const h = makeHarness({ fakeTimers: true });
    let ctl!: SseController;
    h.or.reply({ sseLive: (c) => (ctl = c) });
    const text = bodyText(await send(h));
    await flush();
    for (let t = 0; t < UPSTREAM_TIMEOUT_MS; t += 30_000) {
      h.timers!.advance(30_000);
      ctl.push(': OPENROUTER PROCESSING\n\n');
      await flush();
    }
    expect(parseFrameStream(await text).terminal).toMatchObject({ reason: 'timeout' });
    await flush();
    expect(h.platform.count(keys('x', 'y', T0).global)).toBe(1);
    expect(heldUnits(h)).toBe(1);
    expect(h.platform.cacheMap.size).toBe(0);
    expect(h.platform.ledgerRows).toHaveLength(0);
  });

  test('OCR timeout at 240 s refunds visitor OCR page claims, keeps global pages', async () => {
    const h = makeHarness({ fakeTimers: true });
    h.or.reply({ hang: true });
    const text = bodyText(await send(h, { path: '/api/ocr' }));
    await flush();
    h.timers!.advance(UPSTREAM_OCR_TIMEOUT_MS);
    expect(parseFrameStream(await text).terminal).toMatchObject({ reason: 'timeout' });
    await flush();
    expect(h.platform.count(keys('x', 'y', T0).global)).toBe(1);
    expect(heldUnits(h)).toBe(1);
    expect(h.platform.refunds.length).toBe(2);
  });

  test('client abort after dispatch during an SSE stream keeps ALL claims', async () => {
    const h = makeHarness({ fakeTimers: true });
    let ctl!: SseController;
    h.or.reply({ sseLive: (c) => (ctl = c) });
    const res = await send(h);
    const reader = res.body!.getReader();
    await reader.read();
    await flush();
    ctl.push(': OPENROUTER PROCESSING\n\n');
    await flush();
    const before = heldUnits(h);
    await reader.cancel();
    await flush(10);
    expect(h.or.aborted).toBe(1);
    expect(h.platform.refunds).toHaveLength(0);
    expect(heldUnits(h)).toBe(before);
    expect(h.timers!.pending).toBe(0);
  });
});
