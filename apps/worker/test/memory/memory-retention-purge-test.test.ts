// AC58, AC38 (server): retention 30 d sandbox (D-4), demo exempt, ai_cache 7 d, quota windows 2 d;
// fake clock: day 29 kept, day 31 purged; lazy purge slot at most once per hour.
import { env } from 'cloudflare:test';
import { limits } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { claimPurgeSlot, PURGE_CHILD_TABLES, runPurge } from '../../src/memory/repo/purge';
import { createD1Cache } from '../../src/platform/cache';
import {
  call,
  DAY_MS,
  decide,
  makeMem,
  newRun,
  op,
  session,
  T0,
  wireFinding,
} from './memory-harness';
import { answer, askQuestion, withAssertion } from './variance-harness';

const checksIn = async (ws: string) =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM regression_check WHERE workspace_id = ?1')
    .bind(ws)
    .first<{ n: number }>())!.n;

async function rowsFor(ws: string): Promise<number> {
  let n = 0;
  for (const t of PURGE_CHILD_TABLES)
    n += (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE workspace_id = ?1`)
      .bind(ws)
      .first<{ n: number }>())!.n;
  return (
    n +
    (await env.DB.prepare('SELECT COUNT(*) AS n FROM workspace WHERE id = ?1')
      .bind(ws)
      .first<{ n: number }>())!.n
  );
}

describe('memory-retention-purge-test (AC58, AC38)', () => {
  test('should purge expired sandboxes and keep the demo', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    await call(
      h,
      'POST',
      `/api/runs/${run}/findings`,
      { client_op_id: op(), findings: [wireFinding('firm-x', 'Purge me.')] },
      { cookie: s.cookie },
    );
    const d = await decide(h, s, {
      runId: run,
      quote: 'Purge me too.',
      decision: 'accepted',
      findingRef: 'p1',
    });
    await call(
      h,
      'POST',
      '/api/counsel/questions',
      {
        client_op_id: op(),
        finding_ref: 'p1',
        fingerprint: d.body.decision.fingerprint,
        interpretations: ['x'],
      },
      { cookie: s.cookie },
    );
    const demoBefore = await rowsFor('ws_demo');
    const created = h.clock.now;
    expect(limits.sandboxRetentionDays).toBe(30);
    await runPurge(env.DB, created + 29 * DAY_MS);
    expect(await rowsFor(s.workspaceId)).toBeGreaterThan(10); // day 29: kept
    const r = await runPurge(env.DB, created + 31 * DAY_MS);
    expect(r.workspaces).toBeGreaterThanOrEqual(1);
    expect(await rowsFor(s.workspaceId)).toBe(0); // day 31: every child row and the workspace gone
    expect(await rowsFor('ws_demo')).toBe(demoBefore); // demo exempt
    expect(
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM workspace WHERE status = 'purging'").first<{
        n: number;
      }>())!.n,
    ).toBe(0);
  });

  test('ai_cache rows expire after 7 days; quota windows older than 2 days are deleted', async () => {
    const cache = createD1Cache(env.DB, () => T0);
    await cache.put(
      'k-purge',
      { kind: 'ai', model: 'm:free', data: { v: 1, findings: [] } as never, created_at: T0 },
      limits.aiCacheTtlDays * 86_400,
    );
    expect(await createD1Cache(env.DB, () => T0 + 6 * DAY_MS).get('k-purge')).not.toBeNull();
    expect(await createD1Cache(env.DB, () => T0 + 7 * DAY_MS + 1).get('k-purge')).toBeNull(); // invisible once expired
    const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    for (const [k, w] of [
      ['old', day(T0 - 3 * DAY_MS)],
      ['recent', day(T0 - 1 * DAY_MS)],
      ['spend', 'all'],
    ] as const)
      await env.DB.prepare(
        "INSERT INTO quota_counter (scope, key, window, count, updated_at) VALUES ('visitor_ai', ?1, ?2, 1, 0)",
      )
        .bind(`purge-${k}`, w)
        .run();
    await runPurge(env.DB, T0 + 7 * DAY_MS + 1);
    expect(
      await env.DB.prepare("SELECT key FROM ai_cache WHERE key = 'k-purge'").first(),
    ).toBeNull();
    // windows are judged against the purge time: run again at T0 to check the 2-day boundary exactly
    await runPurge(env.DB, T0);
    const left = await env.DB.prepare(
      "SELECT key FROM quota_counter WHERE key LIKE 'purge-%' ORDER BY key",
    ).all<{ key: string }>();
    expect(left.results.map((x) => x.key)).toEqual(['purge-spend']);
  });

  test('the lazy purge slot is claimed at most once per hour', async () => {
    const t = T0 + 100 * DAY_MS;
    expect(await claimPurgeSlot(env.DB, t)).toBe(true);
    expect(await claimPurgeSlot(env.DB, t + 59 * 60_000)).toBe(false);
    expect(await claimPurgeSlot(env.DB, t + 60 * 60_000)).toBe(true);
  });

  test('F1: a sandbox holding a regression_check is purged without aborting; other workspaces keep theirs', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s, { firm: 'hartwell-crane' });
    expect((await answer(h, s, q, withAssertion())).status).toBe(200);
    expect(await checksIn(s.workspaceId)).toBe(1);
    const created = h.clock.now;
    // a second, younger sandbox with its own check must survive the same purge
    h.clock.now += 5 * DAY_MS;
    const young = await session(h);
    const yq = await askQuestion(h, young, { firm: 'hartwell-crane' });
    expect((await answer(h, young, yq, withAssertion('Appendix D'))).status).toBe(200);
    expect(PURGE_CHILD_TABLES.indexOf('regression_check')).toBeLessThan(
      PURGE_CHILD_TABLES.indexOf('counsel_answer'),
    );
    const r = await runPurge(env.DB, created + 31 * DAY_MS);
    expect(r.workspaces).toBeGreaterThanOrEqual(1);
    expect(await rowsFor(s.workspaceId)).toBe(0);
    expect(await checksIn(s.workspaceId)).toBe(0);
    expect(await checksIn(young.workspaceId)).toBe(1);
    expect(
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM workspace WHERE status = 'purging'").first<{
        n: number;
      }>())!.n,
    ).toBe(0);
  });
});
