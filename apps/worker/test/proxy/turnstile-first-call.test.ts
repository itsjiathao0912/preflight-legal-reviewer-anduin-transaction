import { signCookie, verifyCookie } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { baseEnv, COOKIE_KEY, frames, makeHarness, send, T0, type Harness } from '../fakes/harness';
import { TS_FAIL, TS_SPENT } from '../fakes/turnstile-stub';
import { VISITOR_COOKIE } from '../../src/limits/visitor';
import { createTurnstile, SITEVERIFY_TIMEOUT_MS } from '../../src/identity/turnstile';

const OLD_KEY = 'old-cookie-signing-key-0123456789abcdef';

async function expectClosed(res: Response, h: Harness) {
  expect(res.status).toBe(401);
  expect(await res.json()).toMatchObject({ error: { code: 'invalid_session' } });
  expect(h.platform.claimLog).toHaveLength(0);
  expect(h.or.calls).toHaveLength(0);
}

describe('turnstile-first-call (AC39)', () => {
  test('pass: siteverify once, then t (epoch ms) is set by re-signing, preserving claims', async () => {
    const h = makeHarness();
    h.or.reply(okAi(), okAi());
    const now = Math.floor(T0 / 1000);
    const c0 = await signCookie(
      { v: 'keepme', w: 'w1', a: 'a1', iat: now, exp: now + 7200, kid: 'k0' },
      OLD_KEY,
    );
    const res = await send(h, { cookie: `${VISITOR_COOKIE}=${c0}` });
    await frames(res);
    expect(h.ts.calls).toBe(1);
    const value = res.headers.get('set-cookie')!.split(';')[0]!.split('=').slice(1).join('=');
    const v = await verifyCookie(value, { k0: OLD_KEY, k1: COOKIE_KEY }, now + 20);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.claims).toMatchObject({
      v: 'keepme',
      w: 'w1',
      a: 'a1',
      iat: now,
      exp: now + 7200,
      kid: 'k0',
    });
    expect(v.claims.t).toBe(h.clock.now);
    // fresh t: second call skips siteverify (no token needed)
    const res2 = await send(h, {
      cookie: `${VISITOR_COOKIE}=${value}`,
      turnstile: null,
      body: {
        v: 1,
        law_firm_id: null,
        candidates: [{ id: 'c9', quote: 'other', section_path: [] }],
        settings: {},
      },
    });
    expect((await frames(res2)).terminal.t).toBe('result');
    expect(h.ts.calls).toBe(1);
  });

  test('fail key -> invalid_session 401, zero claims, zero upstream', async () => {
    const h = makeHarness({ env: baseEnv({ TURNSTILE_SECRET: TS_FAIL }) });
    await expectClosed(await send(h), h);
    expect(h.ts.calls).toBe(1);
  });

  test('already-spent key -> invalid_session', async () => {
    const h = makeHarness({ env: baseEnv({ TURNSTILE_SECRET: TS_SPENT }) });
    await expectClosed(await send(h), h);
  });

  test('missing token on a first call -> invalid_session, no siteverify', async () => {
    const h = makeHarness();
    await expectClosed(await send(h, { turnstile: null }), h);
    expect(h.ts.calls).toBe(0);
  });

  test('network error -> fail closed', async () => {
    const h = makeHarness();
    h.ts.networkError = true;
    await expectClosed(await send(h), h);
  });

  test('missing TURNSTILE_SECRET -> fail closed', async () => {
    const h = makeHarness({ env: baseEnv({ TURNSTILE_SECRET: undefined }) });
    await expectClosed(await send(h), h);
    expect(h.ts.calls).toBe(0);
  });

  test('fresh t in ms skips siteverify; one ms past the TTL does not; future t is stale', async () => {
    const now = Math.floor(T0 / 1000);
    const mk = (t: number) =>
      signCookie({ v: 'f', iat: now - 5, exp: now + 3600, kid: 'k1', t }, COOKIE_KEY);
    const sentAt = T0 + 11_000; // send() advances the clock 11 s
    const h = makeHarness();
    h.or.reply(okAi());
    const ok = await send(h, {
      cookie: `${VISITOR_COOKIE}=${await mk(sentAt - 1_800_000)}`,
      turnstile: null,
    });
    expect((await frames(ok)).terminal.t).toBe('result');
    expect(h.ts.calls).toBe(0);
    const h2 = makeHarness();
    await expectClosed(
      await send(h2, {
        cookie: `${VISITOR_COOKIE}=${await mk(sentAt - 1_800_001)}`,
        turnstile: null,
      }),
      h2,
    );
    const h3 = makeHarness();
    await expectClosed(
      await send(h3, { cookie: `${VISITOR_COOKIE}=${await mk(sentAt + 1)}`, turnstile: null }),
      h3,
    );
  });

  test('real TurnstilePort fails closed on non-2xx, malformed and non-boolean success', async () => {
    const mk = (r: () => Response) => (async () => r()) as unknown as typeof fetch;
    const f500 = mk(() => new Response('x', { status: 500 }));
    const fbad = mk(() => new Response('not json', { status: 200 }));
    const fstr = mk(() => new Response('{"success":"true"}', { status: 200 }));
    for (const f of [f500, fbad, fstr])
      expect(await createTurnstile(f, 's').verify('tok', 'h')).toEqual({ ok: false });
    expect(await createTurnstile(f500, undefined).verify('tok', 'h')).toEqual({ ok: false });
    expect(await createTurnstile(f500, 's').verify('x'.repeat(2049), 'h')).toEqual({ ok: false });
  });

  test('F6: a hanging siteverify times out and fails closed (default bound 5 s)', async () => {
    expect(SITEVERIFY_TIMEOUT_MS).toBe(5_000);
    let sawSignal = false;
    const hang = ((_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => {
        sawSignal = init?.signal instanceof AbortSignal;
        init?.signal?.addEventListener('abort', () => rej(new DOMException('t', 'TimeoutError')));
      })) as unknown as typeof fetch;
    const t0 = Date.now();
    expect(await createTurnstile(hang, 's', 30).verify('tok', 'h')).toEqual({ ok: false });
    expect(sawSignal).toBe(true);
    expect(Date.now() - t0).toBeLessThan(2_000);
  });
});
