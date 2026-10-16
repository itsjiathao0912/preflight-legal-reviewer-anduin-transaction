// AC56: stale, purged, expired, w-less or tampered cookies get 401 invalid_session; memory routes
// never mint a cookie; a fresh POST /api/session recovers.
import { env } from 'cloudflare:test';
import { signCookie } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { VISITOR_COOKIE } from '../../src/limits/visitor';
import { runPurge } from '../../src/memory/repo/purge';
import { call, COOKIE_KEY, DAY_MS, makeMem, session } from './memory-harness';

const audit = (h: ReturnType<typeof makeMem>, cookie?: string) =>
  call(h, 'GET', '/api/audit?limit=1', undefined, { cookie });

async function expect401(r: Awaited<ReturnType<typeof audit>>) {
  expect(r.status).toBe(401);
  expect(r.body.error.code).toBe('invalid_session');
  expect(r.res.headers.get('set-cookie')).toBeNull(); // never mints
}

describe('stale-cookie-invalid-session (AC56)', () => {
  test('should return invalid_session for a cookie whose workspace was purged', async () => {
    const h = makeMem();
    const s = await session(h);
    expect((await audit(h, s.cookie)).status).toBe(200);
    await runPurge(env.DB, h.clock.now + 31 * DAY_MS);
    await expect401(await audit(h, s.cookie));
    // recovery: a fresh session works
    const s2 = await session(h);
    expect((await audit(h, s2.cookie)).status).toBe(200);
  });

  test('an expired workspace (cookie still signed) is invalid', async () => {
    const h = makeMem();
    const s = await session(h);
    await env.DB.prepare('UPDATE workspace SET expires_at = ?2 WHERE id = ?1')
      .bind(s.workspaceId, h.clock.now - 1)
      .run();
    await expect401(await audit(h, s.cookie));
  });

  test('missing, w-less, malformed and tampered cookies are invalid', async () => {
    const h = makeMem();
    await expect401(await audit(h));
    const nowS = Math.floor(h.clock.now / 1000);
    const visitorOnly = await signCookie(
      { v: 'v1', iat: nowS, exp: nowS + 3600, kid: 'k1' },
      COOKIE_KEY,
    );
    await expect401(await audit(h, `${VISITOR_COOKIE}=${visitorOnly}`));
    await expect401(await audit(h, `${VISITOR_COOKIE}=garbage.value`));
    const s = await session(h);
    await expect401(
      await audit(h, s.cookie.slice(0, -2) + (s.cookie.endsWith('AA') ? 'BB' : 'AA')),
    );
    const unknown = await signCookie(
      { v: 'v1', w: 'w_nope', a: 'an_nope', iat: nowS, exp: nowS + 3600, kid: 'k1' },
      COOKIE_KEY,
    );
    await expect401(await audit(h, `${VISITOR_COOKIE}=${unknown}`));
  });
});
