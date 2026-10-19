// POST /api/session/reset ("Start fresh", 19-10-26): clears both cookies, no D1 queries.
import { describe, expect, test } from 'vitest';
import { call, makeMem, session } from './memory-harness';

describe('POST /api/session/reset', () => {
  test('clears __Host-aduin_v and __Host-aduin_c with Max-Age=0 and no D1 query', async () => {
    const h = makeMem();
    const s = await session(h);
    h.resetStats();
    const r = await call(h, 'POST', '/api/session/reset', {}, { cookie: s.cookie });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
    expect(r.res.headers.get('cache-control')).toBe('no-store');
    const cookies = r.res.headers.getSetCookie();
    expect(cookies).toEqual([
      '__Host-aduin_v=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
      '__Host-aduin_c=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
    ]);
    expect(h.stats.queries).toBe(0);
  });

  test('works without a cookie and still enforces the client header', async () => {
    const h = makeMem();
    expect((await call(h, 'POST', '/api/session/reset', {})).status).toBe(200);
    const bad = await call(
      h,
      'POST',
      '/api/session/reset',
      {},
      { headers: { 'x-aduin-client': null } },
    );
    expect(bad.status).toBe(400);
    expect(bad.res.headers.get('set-cookie')).toBeNull();
  });
});
