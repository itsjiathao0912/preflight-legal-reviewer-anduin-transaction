// C4: the same port cases run over FakePlatform (04a fake) and the D1 implementation (F5).
import { env } from 'cloudflare:test';
import type { QuotaKey } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import type { ProxyPlatform, UsageKeys } from '../../src/proxy/ports';
import { createD1Platform } from '../../src/platform/index';
import { claim, refund } from '../../src/platform/quota';
import { toMicroUsd } from '../../src/platform/ledger';
import { FakePlatform } from '../fakes/platform';

const T = Date.UTC(2026, 9, 17, 12);
const capFor = (k: QuotaKey) => (k.key.startsWith('g|') ? 4 : k.key.startsWith('doc|') ? 3 : 10);
let seq = 0;
function keys(): UsageKeys & { req: QuotaKey } {
  const v = `pc${++seq}`;
  return {
    ai: [
      { scope: 'visitor_ai', key: `doc|v|${v}|2026-10-17` },
      { scope: 'visitor_ai', key: `doc|ip|${v}|2026-10-17` },
    ],
    ocr: [
      { scope: 'visitor_ocr', key: `ocr|v|${v}|2026-10-17` },
      { scope: 'visitor_ocr', key: `ocr|ip|${v}|2026-10-17` },
    ],
    global: { scope: 'global_ai', key: `g|global-${v}|2026-10-17` },
    req: { scope: 'visitor_ai', key: `req|v|${v}|2026-10-17` },
  };
}

const IMPLS: [string, () => ProxyPlatform][] = [
  ['FakePlatform', () => new FakePlatform({ capFor })],
  ['D1', () => createD1Platform(env.DB, { capFor, now: () => T })],
];

describe.each(IMPLS)('platform-contract: %s', (_name, make) => {
  test('claim succeeds until the cap, then ok:false quota_exhausted (never throws at cap)', async () => {
    const p = make();
    const k = keys();
    const q = p.quota(k);
    expect((await q.claim(k.ai[0]!, 2)).ok).toBe(true);
    expect((await q.claim(k.ai[0]!, 1)).ok).toBe(true);
    expect(await q.claim(k.ai[0]!, 1)).toEqual({ ok: false, code: 'quota_exhausted' });
    expect(await q.claim(k.ai[1]!, 4)).toEqual({ ok: false, code: 'quota_exhausted' }); // first claim > cap
  });

  test('refund releases units; usage reports max per bucket and global_ok', async () => {
    const p = make();
    const k = keys();
    const q = p.quota(k);
    const a = await q.claim(k.ai[0]!, 2);
    await q.claim(k.ai[1]!, 1);
    await q.claim(k.ocr[0]!, 5);
    expect(a.ok).toBe(true);
    let u = await q.usage();
    expect(u.ai.used).toBe(2);
    expect(u.ai.limit).toBe(3);
    expect(u.ocr_pages.used).toBe(5);
    expect(u.global_ok).toBe(true);
    if (a.ok) await q.refund(a.refundToken);
    u = await q.usage();
    expect(u.ai.used).toBe(1);
    for (let i = 0; i < 4; i++) await q.claim(k.global, 1);
    expect((await q.usage()).global_ok).toBe(false);
  });

  test('cache round-trips a result; a miss is null; the ledger accepts an entry', async () => {
    const p = make();
    const key = `cache-${++seq}`;
    expect(await p.cache.get(key)).toBeNull();
    const value = {
      kind: 'ai' as const,
      model: 'm:free',
      data: { v: 1, findings: [] } as never,
      created_at: T,
    };
    await p.cache.put(key, value, 3600);
    expect(await p.cache.get(key)).toEqual(value);
    await expect(
      p.ledger.record({
        kind: 'llm',
        model: 'm:free',
        units: 1,
        cost_usd: 0,
        cache: 'miss',
        at: T,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('platform-contract: D1 specifics (F5)', () => {
  const broken = {
    prepare() {
      return {
        bind() {
          return this;
        },
        first: () => Promise.reject(new Error('D1_ERROR: storage down')),
        run: () => Promise.reject(new Error('D1_ERROR')),
        all: () => Promise.reject(new Error('D1_ERROR')),
      };
    },
    batch: () => Promise.reject(new Error('D1_ERROR')),
  } as unknown as D1Database;

  test('should throw on a storage error instead of returning ok false', async () => {
    const k = keys();
    await expect(claim(broken, { capFor, now: () => T }, k.req, 1)).rejects.toThrow(/D1_ERROR/);
    const fake = new FakePlatform({ capFor, down: true });
    await expect(fake.quota(k).claim(k.req, 1)).rejects.toThrow(); // same contract as the fake
    await expect(createD1Platform(broken, { capFor }).quota(k).usage()).rejects.toThrow();
    await expect(createD1Platform(broken, { capFor }).cache.get('x')).rejects.toThrow();
  });

  test('refund clamps at 0 and ignores a forged token', async () => {
    const k = keys();
    const opts = { capFor, now: () => T };
    const a = await claim(env.DB, opts, k.req, 3);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    await refund(env.DB, opts, a.refundToken);
    await refund(env.DB, opts, a.refundToken); // double refund cannot go negative
    const row = await env.DB.prepare(
      'SELECT count FROM quota_counter WHERE scope = ?1 AND key = ?2',
    )
      .bind('visitor_ai', k.req.key.replace('|2026-10-17', ''))
      .first<{ count: number }>();
    expect(row?.count).toBe(0);
    await expect(refund(env.DB, opts, 'q1.!!!forged')).resolves.toBeUndefined();
    await expect(refund(env.DB, opts, 'nope')).resolves.toBeUndefined();
  });

  test('a key without a day suffix uses window "all"; cost becomes integer micro-USD', async () => {
    const opts = { capFor: () => 1_000_000, now: () => T };
    const spend = { scope: 'spend' as const, key: `spend|pc${++seq}` };
    expect((await claim(env.DB, opts, spend, 20_000)).ok).toBe(true);
    const row = await env.DB.prepare('SELECT window, count FROM quota_counter WHERE key = ?1')
      .bind(spend.key)
      .first();
    expect(row).toEqual({ window: 'all', count: 20_000 });
    expect(toMicroUsd(0.0123)).toBe(12_300);
    expect(toMicroUsd(undefined)).toBe(0);
  });

  test('withSessionCaps: session_new keys have caps and unknown key kinds throw', async () => {
    const { withSessionCaps, SESSION_CAPS } = await import('../../src/platform/index');
    const c = withSessionCaps(() => 7);
    expect(c({ scope: 'session_new', key: 'snew|ip|h|2026-10-17' })).toBe(SESSION_CAPS.perIpPerDay);
    expect(c({ scope: 'session_new', key: 'snew|g|2026-10-17' })).toBe(SESSION_CAPS.globalPerDay);
    expect(c({ scope: 'visitor_ai', key: 'req|v|x|2026-10-17' })).toBe(7);
    expect(() => c({ scope: 'rate', key: 'mystery|x' })).toThrow(/unknown quota key kind/);
  });
});
