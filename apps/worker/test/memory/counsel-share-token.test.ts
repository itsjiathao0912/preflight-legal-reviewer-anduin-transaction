// Counsel share link token + counsel cookie (19-10-26): valid token joins; tampered MAC, expired,
// wrong prefix (session cookie as token, share token as either cookie), unknown kid -> refused;
// expiry capped by the sandbox expiry; join of a dead workspace refused.
import { env } from 'cloudflare:test';
import {
  CounselJoinResponseSchema,
  CounselShareResponseSchema,
  SHARE_TOKEN_MAX,
} from '@aduin/core';
import { describe, expect, test } from 'vitest';
import {
  COUNSEL_COOKIE,
  SHARE_TTL_S,
  signShare,
  verifyCounselCookie,
  verifyShare,
} from '../../src/memory/share';
import { VISITOR_COOKIE } from '../../src/limits/visitor';
import { counselCookieOf, DOC_REF, joinAsCounsel, shareToken } from './counsel-harness';
import { call, cookieValue, DAY_MS, KEYS, makeMem, session } from './memory-harness';

const sheet = (h: ReturnType<typeof makeMem>, cookie?: string) =>
  call(h, 'GET', '/api/counsel/sheet', undefined, cookie ? { cookie } : {});

describe('counsel-share-token', () => {
  test('a valid token joins: HttpOnly __Host- cookie, 7-day expiry, workspace from the token', async () => {
    const h = makeMem();
    const s = await session(h);
    const r = await call(
      h,
      'POST',
      '/api/counsel/share',
      { doc_ref: DOC_REF },
      { cookie: s.cookie },
    );
    expect(r.status).toBe(200);
    const share = CounselShareResponseSchema.parse(r.body);
    expect(r.res.headers.get('cache-control')).toBe('no-store');
    expect(r.res.headers.get('set-cookie')).toBeNull();
    expect(share.expires_at).toBe(Math.floor((h.clock.now + SHARE_TTL_S * 1000) / 1000) * 1000);
    const j = await call(
      h,
      'POST',
      '/api/counsel/join',
      { token: share.token, name: ' Rita Okafor ' },
      { ip: '192.0.2.9' },
    );
    expect(j.status).toBe(200);
    expect(CounselJoinResponseSchema.parse(j.body)).toEqual({
      workspace_id: s.workspaceId,
      counsel_name: 'Rita Okafor',
      expires_at: share.expires_at,
      doc_ref: DOC_REF,
    });
    const sc = j.res.headers.get('set-cookie')!;
    expect(sc.startsWith(`${COUNSEL_COOKIE}=`)).toBe(true);
    for (const attr of ['Path=/', 'Secure', 'HttpOnly', 'SameSite=Lax']) expect(sc).toContain(attr);
    const maxAge = Number(/Max-Age=(\d+)/.exec(sc)![1]);
    expect(maxAge).toBeGreaterThan(SHARE_TTL_S - 5);
    expect(maxAge).toBeLessThanOrEqual(SHARE_TTL_S);
    const cookie = counselCookieOf(j.res)!;
    const v = await verifyCounselCookie(
      cookie.slice(COUNSEL_COOKIE.length + 1),
      KEYS,
      Math.floor(h.clock.now / 1000),
    );
    expect(v.ok && v.claims).toMatchObject({
      w: s.workspaceId,
      d: DOC_REF,
      r: 'counsel',
      n: 'Rita Okafor',
    });
    const sh = await sheet(h, cookie);
    expect(sh.status).toBe(200);
    expect(sh.body.role).toBe('counsel');
    expect(sh.body.doc_ref).toBe(DOC_REF);
  });

  test('expiry is capped by the sandbox expiry', async () => {
    const h = makeMem();
    const s = await session(h);
    const wsExp = h.clock.now + 2 * DAY_MS;
    await env.DB.prepare('UPDATE workspace SET expires_at = ?2 WHERE id = ?1')
      .bind(s.workspaceId, wsExp)
      .run();
    const { token, expiresAt } = await shareToken(h, s);
    expect(expiresAt).toBe(Math.floor(wsExp / 1000) * 1000);
    const j = await joinAsCounsel(h, token);
    expect(j.body.expires_at).toBe(expiresAt);
  });

  test('tampered MAC, tampered payload, oversize and garbage tokens are refused (401 / 400), no cookie', async () => {
    const h = makeMem();
    const s = await session(h);
    const { token } = await shareToken(h, s);
    const [payload, sig] = token.split('.') as [string, string];
    const flip = (x: string) => (x[0] === 'A' ? 'B' : 'A') + x.slice(1);
    for (const bad of [
      `${payload}.${flip(sig)}`,
      `${flip(payload)}.${sig}`,
      'x.y',
      'nodot',
      `${token}.x`,
    ]) {
      const r = await call(h, 'POST', '/api/counsel/join', { token: bad, name: 'Eve' });
      expect(r.status, bad).toBe(401);
      expect(r.body.error.code).toBe('invalid_session');
      expect(r.res.headers.get('set-cookie')).toBeNull();
    }
    const big = await call(h, 'POST', '/api/counsel/join', {
      token: 'a'.repeat(SHARE_TOKEN_MAX + 1),
      name: 'Eve',
    });
    expect(big.status).toBe(400);
    const noName = await call(h, 'POST', '/api/counsel/join', { token, name: '   ' });
    expect(noName.status).toBe(400);
  });

  test('an expired token is refused', async () => {
    const h = makeMem();
    const s = await session(h);
    const { token } = await shareToken(h, s);
    h.clock.now += SHARE_TTL_S * 1000 + 1_000;
    const r = await call(h, 'POST', '/api/counsel/join', { token, name: 'Late Counsel' });
    expect(r.status).toBe(401);
    expect(r.body.error.reason).toBe('share_expired');
  });

  test('domain separation: a session cookie is not a token; a share token is not a cookie', async () => {
    const h = makeMem();
    const s = await session(h);
    const { token } = await shareToken(h, s);
    // the analyst session cookie value used as a share token
    const asToken = await call(h, 'POST', '/api/counsel/join', {
      token: cookieValue(s.cookie),
      name: 'Eve',
    });
    expect(asToken.status).toBe(401);
    expect(asToken.body.error.reason).toBe('share_bad_signature');
    // the share token used as the counsel cookie, and as the analyst cookie
    expect((await sheet(h, `${COUNSEL_COOKIE}=${token}`)).status).toBe(401);
    expect((await sheet(h, `${VISITOR_COOKIE}=${token}`)).status).toBe(401);
    // a counsel cookie value used as the analyst cookie, and as a share token
    const { cookie } = await joinAsCounsel(h, token);
    const cv = cookie.slice(COUNSEL_COOKIE.length + 1);
    expect((await sheet(h, `${VISITOR_COOKIE}=${cv}`)).status).toBe(401);
    const asJoin = await call(h, 'POST', '/api/counsel/join', { token: cv, name: 'Eve' });
    expect(asJoin.status).toBe(401);
    // verifier level: each prefix only accepts its own values
    const nowS = Math.floor(h.clock.now / 1000);
    expect((await verifyShare(cv, KEYS, nowS)).ok).toBe(false);
    expect((await verifyCounselCookie(token, KEYS, nowS)).ok).toBe(false);
  });

  test('an unknown kid is refused', async () => {
    const h = makeMem();
    const s = await session(h);
    const other = { k9: 'another-test-signing-key-0123456789abcdef' };
    const forged = await signShare(
      {
        w: s.workspaceId,
        a: s.analystId,
        d: DOC_REF,
        r: 'counsel',
        exp: Math.floor(h.clock.now / 1000) + 3600,
        kid: 'k9',
      },
      other,
    );
    const r = await call(h, 'POST', '/api/counsel/join', { token: forged, name: 'Eve' });
    expect(r.status).toBe(401);
    expect(r.body.error.reason).toBe('share_unknown_kid');
  });

  test('share needs the analyst cookie; a dead workspace cannot be joined', async () => {
    const h = makeMem();
    const noCookie = await call(h, 'POST', '/api/counsel/share', { doc_ref: DOC_REF });
    expect(noCookie.status).toBe(401);
    const s = await session(h);
    const { token } = await shareToken(h, s);
    await env.DB.prepare('UPDATE workspace SET expires_at = ?2 WHERE id = ?1')
      .bind(s.workspaceId, h.clock.now - 1)
      .run();
    const r = await call(h, 'POST', '/api/counsel/join', { token, name: 'Eve' });
    expect(r.status).toBe(401);
    expect(r.body.error.reason).toBe('stale_session');
  });

  test('share needs a valid doc_ref; bad refs are 400 reason doc_ref', async () => {
    const h = makeMem();
    const s = await session(h);
    for (const body of [{}, { doc_ref: 'upload:x' }, { doc_ref: 'package:../x' }, { doc_ref: 7 }]) {
      const r = await call(h, 'POST', '/api/counsel/share', body, { cookie: s.cookie });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('invalid_request');
      expect(r.body.error.reason).toBe('doc_ref');
    }
    const { token } = await shareToken(h, s, 'sample:09');
    const v = await verifyShare(token, KEYS, Math.floor(h.clock.now / 1000));
    expect(v.ok && v.claims.d).toBe('sample:09');
    const j = await joinAsCounsel(h, token);
    expect(j.body.doc_ref).toBe('sample:09');
  });

  test('a validly signed token without d (old shape) or with a bad d is refused as share_bad', async () => {
    const h = makeMem();
    const s = await session(h);
    const exp = Math.floor(h.clock.now / 1000) + 3600;
    // sign the raw claims with the same format as signShare but bypassing its schema
    const { b64urlEncode } = await import('@aduin/core');
    const enc = new TextEncoder();
    const raw = async (claims: object) => {
      const payload = b64urlEncode(enc.encode(JSON.stringify(claims)));
      const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(KEYS.k1),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const sig = new Uint8Array(
        await crypto.subtle.sign('HMAC', key, enc.encode(`share|v1|${payload}`)),
      );
      return `${payload}.${b64urlEncode(sig)}`;
    };
    const base = { w: s.workspaceId, a: s.analystId, r: 'counsel', exp, kid: 'k1' };
    for (const claims of [base, { ...base, d: 'upload:secret' }]) {
      const r = await call(h, 'POST', '/api/counsel/join', { token: await raw(claims), name: 'E' });
      expect(r.status).toBe(401);
      expect(r.body.error.reason).toMatch(/^share_/);
      expect(r.body.error.reason).toBe('share_invalid_claims');
    }
    // sanity: the same helper with a valid d joins (the MAC format matches)
    const okJoin = await call(h, 'POST', '/api/counsel/join', {
      token: await raw({ ...base, d: DOC_REF }),
      name: 'E',
    });
    expect(okJoin.status).toBe(200);
  });
});
