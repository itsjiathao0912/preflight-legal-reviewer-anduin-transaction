// Spike S5 (local): the guarded atomic claim statement (instruction E1) on real local D1.
import { env } from 'cloudflare:test';
import type { QuotaKey } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { claim, QUOTA_SQL } from '../../src/platform/quota';

let seq = 0;
const key = (): QuotaKey => ({ scope: 'visitor_ai', key: `req|v|s05-${++seq}|2026-10-17` });
const opts = (cap: number) => ({ capFor: () => cap, now: () => 1_000 });

async function count(k: QuotaKey): Promise<number | null> {
  const [base] = k.key.split('|2026-10-17');
  const row = await env.DB.prepare(
    'SELECT count FROM quota_counter WHERE scope = ?1 AND key = ?2 AND window = ?3',
  )
    .bind(k.scope, base, '2026-10-17')
    .first<{ count: number }>();
  return row ? row.count : null;
}

describe('s05-quota-claim-atomicity (S5, local D1)', () => {
  test('20 parallel claims against cap 10 succeed exactly 10 times', async () => {
    const k = key();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => claim(env.DB, opts(10), k, 1)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(10);
    expect(results.filter((r) => !r.ok)).toHaveLength(10);
    expect(await count(k)).toBe(10);
  });

  test('should refuse a first claim whose units exceed the cap', async () => {
    const k = key();
    expect(await claim(env.DB, opts(6), k, 7)).toEqual({ ok: false, code: 'quota_exhausted' });
    expect(await count(k)).toBeNull(); // nothing inserted
  });

  test('a claim exactly at cap succeeds, then one more unit is refused and the row is unchanged', async () => {
    const k = key();
    expect((await claim(env.DB, opts(6), k, 6)).ok).toBe(true);
    expect((await claim(env.DB, opts(6), k, 1)).ok).toBe(false);
    expect(await count(k)).toBe(6);
  });

  test('over-cap after earlier claims is refused without mutating the counter', async () => {
    const k = key();
    expect((await claim(env.DB, opts(10), k, 4)).ok).toBe(true);
    expect((await claim(env.DB, opts(10), k, 4)).ok).toBe(true);
    expect((await claim(env.DB, opts(10), k, 4)).ok).toBe(false);
    expect(await count(k)).toBe(8);
  });

  test('cap 0 refuses the first claim', async () => {
    const k = key();
    expect((await claim(env.DB, opts(0), k, 1)).ok).toBe(false);
    expect(await count(k)).toBeNull();
  });

  test('the statement uses numbered parameters bound once and RETURNING', () => {
    expect(QUOTA_SQL.claim).toMatch(/SELECT \?1, \?2, \?3, \?4, \?6 WHERE \?4 <= \?5/);
    expect(QUOTA_SQL.claim).toMatch(/WHERE count \+ \?4 <= \?5 RETURNING count$/);
  });
});
