// AC56: per-visitor sandbox isolation with a simulated analyst name; cookie binds w and a.
import { env } from 'cloudflare:test';
import { signCookie, verifyCookie } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { VISITOR_COOKIE } from '../../src/limits/visitor';
import {
  call,
  COOKIE_KEY,
  cookieValue,
  decide,
  fpOf,
  KEYS,
  lookup,
  makeMem,
  newRun,
  session,
  T0,
} from './memory-harness';

describe('sandbox-isolation (AC56)', () => {
  test('two sessions get two sandboxes; each sees only its own writes', async () => {
    const h = makeMem();
    const a = await session(h, 'Ann (simulated analyst)');
    const b = await session(h, 'Ben (simulated analyst)');
    expect(a.workspaceId).not.toBe(b.workspaceId);
    for (const s of [a, b]) {
      const v = await verifyCookie(cookieValue(s.cookie), KEYS, Math.floor(h.clock.now / 1000));
      expect(v.ok && v.claims.w).toBe(s.workspaceId);
      expect(v.ok && v.claims.a).toBe(s.analystId);
      expect(s.workspaceId).not.toBe('ws_demo');
    }
    const run = await newRun(h, a);
    const quote = 'Only Ann made this decision.';
    const d = await decide(h, a, { runId: run, quote });
    expect(d.body.decision.decided_by_name).toBe('Ann (simulated analyst)');
    const fp = fpOf('firm-x', 'defined_term_issue', quote);
    expect((await lookup(h, b, 'firm-x', [fp])).body.decisions).toEqual([]);
    // the seed copy uses per-sandbox ids
    const seeds = await env.DB.prepare(
      "SELECT workspace_id, id FROM decision WHERE seed_of = 'sd01' AND workspace_id IN (?1, ?2) ORDER BY workspace_id",
    )
      .bind(a.workspaceId, b.workspaceId)
      .all<{ id: string }>();
    expect(seeds.results.map((r) => r.id).sort()).toEqual(
      [`${a.workspaceId}:sd01`, `${b.workspaceId}:sd01`].sort(),
    );
  });

  test("a cookie re-signed with another sandbox's w by a wrong key is rejected (401)", async () => {
    const h = makeMem();
    const a = await session(h);
    const b = await session(h);
    const nowS = Math.floor(T0 / 1000);
    const forged = await signCookie(
      { v: 'attacker', w: a.workspaceId, a: a.analystId, iat: nowS, exp: nowS + 3600, kid: 'k1' },
      'wrong-key-0123456789abcdef0123456789abcd',
    );
    const r = await lookup(h, { ...b, cookie: `${VISITOR_COOKIE}=${forged}` }, 'firm-x', [
      fpOf('firm-x', 'ambiguity', 'x'),
    ]);
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('invalid_session');
  });

  test('a valid cookie whose analyst does not belong to the workspace is rejected', async () => {
    const h = makeMem();
    const a = await session(h);
    const b = await session(h);
    const nowS = Math.floor(h.clock.now / 1000);
    const mixed = await signCookie(
      { v: 'v1', w: a.workspaceId, a: b.analystId, iat: nowS, exp: nowS + 3600, kid: 'k1' },
      COOKIE_KEY,
    );
    const r = await call(h, 'GET', '/api/audit?limit=1', undefined, {
      cookie: `${VISITOR_COOKIE}=${mixed}`,
    });
    expect(r.status).toBe(401);
  });
});
