// AC8 (OpenAI provider plan, M2): the OpenAI spend counter is ONE lifetime row (scope 'spend',
// key 'spend|openai', window 'all') on real local D1: it survives a UTC-midnight clock advance,
// the cron/lazy purge and a re-created platform on the same database. It never resets.
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, test } from 'vitest';
import { loadConfig } from '../../src/config';
import { capFor } from '../../src/limits/policy';
import { runPurge, PURGE_SQL } from '../../src/memory/repo/purge';
import { createD1Platform, withSessionCaps } from '../../src/platform/index';
import { createD1Spend, OPENAI_SPEND_KEY } from '../../src/platform/spend';
import { splitWindow } from '../../src/platform/quota';
import { openAiEnv } from '../fakes/openai-harness';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 19, 23, 59, 0);
const caps = withSessionCaps(capFor(loadConfig(openAiEnv())));
const row = () =>
  env.DB.prepare(
    "SELECT window, count FROM quota_counter WHERE scope = 'spend' AND key = 'spend|openai'",
  ).all<{ window: string; count: number }>();

beforeEach(async () => {
  await env.DB.prepare(
    "DELETE FROM quota_counter WHERE scope = 'spend' AND key = 'spend|openai'",
  ).run();
});

describe('spend-lifetime-counter (AC8)', () => {
  test('should keep the lifetime spend counter across midnight, purge and restart', async () => {
    let now = T0;
    const a = createD1Spend(env.DB, { capFor: caps, now: () => now });
    expect(splitWindow(OPENAI_SPEND_KEY.key).window).toBe('all');
    const r1 = await a.reserve(1_234);
    expect(r1).toMatchObject({ ok: true, total: 1_234 });
    // cross UTC midnight: no day suffix, so the same row keeps counting
    now += 2 * 60_000;
    const r2 = await a.reserve(766);
    expect(r2).toMatchObject({ ok: true, total: 2_000 });
    // purge (cron path and lazy path share runPurge) never deletes window 'all'
    expect(PURGE_SQL['deleteQuota']).toContain("window <> 'all'");
    now += 40 * DAY;
    await runPurge(env.DB, now);
    expect(await a.peek()).toBe(2_000);
    // a re-created platform on the same D1 (new isolate / redeploy) sees the same total
    const p = createD1Platform(env.DB, { capFor: caps, now: () => now });
    expect(await p.spend!.peek()).toBe(2_000);
    const rows = (await row()).results;
    expect(rows).toEqual([{ window: 'all', count: 2_000 }]);
    expect(a.cap()).toBe(10_000_000);
  });

  test('settle moves the reservation: down, release, keep and overrun (no cap on overrun)', async () => {
    const s = createD1Spend(env.DB, { capFor: caps, now: () => T0 });
    const r = await s.reserve(1_000);
    if (!r.ok) throw new Error('reserve refused');
    expect(await s.settle(r.token, 400)).toEqual({ outcome: 'actual', settled: 400, total: 400 });
    const k = await s.reserve(500);
    if (!k.ok) throw new Error('reserve refused');
    expect(await s.settle(k.token, 'keep')).toEqual({ outcome: 'keep', settled: 500, total: 900 });
    const rel = await s.reserve(700);
    if (!rel.ok) throw new Error('reserve refused');
    expect(await s.settle(rel.token, 'release')).toEqual({
      outcome: 'release',
      settled: 0,
      total: 900,
    });
    // overrun past the cap is still counted (never under-count)
    await env.DB.prepare(
      "UPDATE quota_counter SET count = 9999000 WHERE scope = 'spend' AND key = 'spend|openai' AND window = 'all'",
    ).run();
    const o = await s.reserve(1_000);
    if (!o.ok) throw new Error('reserve refused');
    expect(await s.settle(o.token, 5_000)).toEqual({
      outcome: 'overrun',
      settled: 5_000,
      total: 10_004_000,
    });
    expect((await s.reserve(1)).ok).toBe(false); // over the cap: every new reserve refused
  });
});
