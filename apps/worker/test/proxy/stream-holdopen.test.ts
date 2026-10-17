import { parseFrameLine, parseFrameStream } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { createApp } from '../../src/app';
import { okAi } from '../fakes/openrouter-stub';
import { baseEnv, bodyText, makeHarness, req, T0, type Harness } from '../fakes/harness';
import { keys } from '../../src/limits/policy';
import { UPSTREAM_TIMEOUT_MS } from '../../src/proxy/pipeline';
import { HEARTBEAT_MS } from '../../src/proxy/stream';

const flush = () => new Promise((r) => setTimeout(r, 0));
const run = (h: Harness) => h.app.fetch(req(), h.env as never, h.ctx);

describe('stream-holdopen (AC26)', () => {
  test('should hold the stream open with heartbeats and never call waitUntil', async () => {
    const h = makeHarness({ fakeTimers: true });
    h.or.reply({ hang: true });
    const res = await run(h);
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = bodyText(res);
    await flush();
    h.timers!.advance(UPSTREAM_TIMEOUT_MS); // reaches the upstream timeout
    const body = await text;
    const lines = body.split('\n').filter(Boolean);
    for (const l of lines) parseFrameLine(l); // every emitted line is a valid frame
    const { heartbeats, terminal } = parseFrameStream(body); // exactly one terminal, last
    expect(heartbeats).toBe(1 + UPSTREAM_TIMEOUT_MS / HEARTBEAT_MS); // at open + every interval through the timeout (hb is due just before the timeout)
    expect(terminal).toMatchObject({ t: 'error', code: 'upstream_failed', reason: 'timeout' });
    expect(h.or.aborted).toBe(1);
    expect(h.waitUntilCalls).toBe(0);
    expect(h.timers!.pending).toBe(0); // heartbeat interval and timeout cleared
  });

  test('heartbeats, then exactly one result frame when upstream answers at 54 s', async () => {
    const h = makeHarness({ fakeTimers: true });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    h.or.reply(okAi());
    const app = createApp({
      fetch: (async (i: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof i === 'string' ? i : i instanceof URL ? i.href : i.url;
        if (url.startsWith('https://challenges.cloudflare.com/')) return h.ts.handle(url, init);
        await gate;
        return h.or.fetch(i, init);
      }) as typeof fetch,
      now: () => h.clock.now,
      proxy: { platform: h.platform, timers: h.timers!, log: (l) => h.logs.push(l) },
    });
    const res = await app.fetch(req(), h.env as never, h.ctx);
    const text = bodyText(res);
    await flush();
    h.timers!.advance(54_000);
    release();
    const { heartbeats, terminal } = parseFrameStream(await text);
    expect(heartbeats).toBe(1 + 5); // open + 10..50 s
    expect(terminal).toMatchObject({ t: 'result', kind: 'ai', cache: 'miss' });
    expect(h.waitUntilCalls).toBe(0);
    expect(h.timers!.pending).toBe(0);
  });

  test('abort AFTER dispatch (~100 ms): upstream aborted, claims kept (counters do not move back)', async () => {
    const h = makeHarness({ fakeTimers: true });
    h.or.reply({ hang: true });
    const res = await run(h);
    const reader = res.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe('{"t":"hb"}\n');
    await flush();
    expect(h.or.calls).toHaveLength(1); // dispatched
    const before = new Map(h.platform.counts);
    h.timers!.advance(100);
    await reader.cancel();
    for (let i = 0; i < 5; i++) await flush();
    expect(h.or.aborted).toBe(1);
    expect(h.platform.refunds).toHaveLength(0);
    expect(new Map(h.platform.counts)).toEqual(before);
    expect(h.platform.count(keys('x', 'y', T0).global)).toBe(1); // global tracks provider use
    expect(h.platform.ledgerRows).toHaveLength(0);
    expect(h.timers!.pending).toBe(0);
    expect(h.logs.some((l) => l.includes('proxy.claims_kept'))).toBe(true);
  });

  test('abort BEFORE dispatch refunds every claim (incl. the spend reservation)', async () => {
    const h = makeHarness({
      fakeTimers: true,
      env: baseEnv({ PAID_FALLBACK_ENABLED: 'true', AI_PAID_MODELS: 'anthropic/claude-haiku-5' }),
    });
    // free call is a definite non-consuming 400; the paid call is gated on the spend reservation
    h.or.reply({ status: 400, json: { error: { message: 'bad' } } }, okAi());
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let gated = false;
    const quota = h.platform.quota.bind(h.platform);
    h.platform.quota = (k) => {
      const q = quota(k);
      return {
        ...q,
        claim: async (key, units) => {
          if (key.scope === 'spend') {
            gated = true;
            await gate;
          }
          return q.claim(key, units);
        },
      };
    };
    const res = await run(h);
    const reader = res.body!.getReader();
    await reader.read();
    for (let i = 0; i < 5 && !gated; i++) await flush();
    expect(gated).toBe(true);
    await reader.cancel(); // client leaves before the paid request is dispatched
    release();
    for (let i = 0; i < 10; i++) await flush();
    expect(h.or.calls).toHaveLength(1); // the paid call was never dispatched
    let held = 0;
    for (const v of h.platform.counts.values()) held += v;
    expect(held).toBe(0); // visitor, doc, global and spend all refunded
    expect(h.platform.refunds.length).toBeGreaterThan(0);
    expect(h.platform.ledgerRows).toHaveLength(0);
  });
});
