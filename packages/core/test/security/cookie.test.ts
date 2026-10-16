import { describe, expect, it } from 'vitest';
import { resign, type SessionClaims } from '../../src/contracts/claims';
import { b64urlDecode, b64urlEncode, signCookie, verifyCookie } from '../../src/session/cookie';

/** cookie-security-matrix. Test-only keys generated per run (no key material in fixtures). */
const k1 = crypto.getRandomValues(new Uint8Array(32));
const k2 = crypto.getRandomValues(new Uint8Array(32));
const NOW = 1_800_000_000;
const claims: SessionClaims = { v: 'vis_abc123', iat: NOW - 10, exp: NOW + 3600, kid: 'k1' };
const keys = { k1 };

const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1);

describe('cookie-security-matrix', () => {
  it('valid cookie verifies and round-trips claims', async () => {
    const c = await signCookie(claims, k1);
    expect(await verifyCookie(c, keys, NOW)).toEqual({ ok: true, claims });
  });

  it('should reject cookie with unknown kid / expired / tampered', async () => {
    const c = await signCookie(claims, k1);
    const [p, s] = c.split('.') as [string, string];
    expect(await verifyCookie(c, { k2 }, NOW)).toEqual({ ok: false, reason: 'unknown_kid' });
    expect(await verifyCookie(c, keys, NOW + 3600)).toEqual({ ok: false, reason: 'expired' });
    expect(await verifyCookie(c, keys, NOW + 7200)).toEqual({ ok: false, reason: 'expired' });
    // tampered payload (re-encoded with a different visitor id, original signature)
    const forged = b64urlEncode(
      new TextEncoder().encode(JSON.stringify({ ...claims, v: 'vis_evil' })),
    );
    expect(await verifyCookie(`${forged}.${s}`, keys, NOW)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
    // tampered signature
    expect((await verifyCookie(`${p}.${flip(s, 3)}`, keys, NOW)).ok).toBe(false);
  });

  it('rejects wrong-length signatures', async () => {
    const c = await signCookie(claims, k1);
    const [p, s] = c.split('.') as [string, string];
    expect(await verifyCookie(`${p}.${s.slice(0, 20)}`, keys, NOW)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
    expect(await verifyCookie(`${p}.${s}AAAA`, keys, NOW)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('rejects iat in the future beyond 60 s skew, accepts within skew', async () => {
    const future = await signCookie({ ...claims, iat: NOW + 61, exp: NOW + 4000 }, k1);
    expect(await verifyCookie(future, keys, NOW)).toEqual({ ok: false, reason: 'iat_future' });
    const near = await signCookie({ ...claims, iat: NOW + 60, exp: NOW + 4000 }, k1);
    expect((await verifyCookie(near, keys, NOW)).ok).toBe(true);
  });

  it('rejects malformed base64 / JSON / shape', async () => {
    for (const bad of [
      '',
      '.',
      'abc',
      'a.b.c',
      '!!!.sig',
      `${b64urlEncode(new TextEncoder().encode('not json'))}.AAAA`,
      'abcde.AAAA',
    ]) {
      const r = await verifyCookie(bad, keys, NOW);
      expect(r.ok).toBe(false);
    }
    expect(b64urlDecode('a')).toBeNull();
  });

  it('rejects claims failing the schema even with a valid signature', async () => {
    const payload = b64urlEncode(
      new TextEncoder().encode(JSON.stringify({ ...claims, w: 'ws_1' })),
    );
    const key = await crypto.subtle.importKey('raw', k1, { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ]);
    const sig = b64urlEncode(
      new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))),
    );
    expect(await verifyCookie(`${payload}.${sig}`, keys, NOW)).toEqual({
      ok: false,
      reason: 'invalid_claims',
    });
  });

  it('rejects oversize values (> 512 bytes) before any crypto', async () => {
    expect(await verifyCookie('a'.repeat(513), keys, NOW)).toEqual({
      ok: false,
      reason: 'oversize',
    });
  });

  it('kid rotation: the old kid is accepted only while it is in the supplied key map', async () => {
    const old = await signCookie(claims, k1);
    const fresh = await signCookie({ ...claims, kid: 'k2' }, k2);
    expect((await verifyCookie(old, { k1, k2 }, NOW)).ok).toBe(true);
    expect((await verifyCookie(fresh, { k1, k2 }, NOW)).ok).toBe(true);
    expect((await verifyCookie(old, { k2 }, NOW)).ok).toBe(false);
    // a cookie signed with k2 but claiming kid k1 fails
    const lie = await signCookie(claims, k2);
    expect(await verifyCookie(lie, { k1, k2 }, NOW)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('resign preserves w/a/iat/exp/kid when setting t (epoch ms)', async () => {
    const sandbox: SessionClaims = { ...claims, w: 'ws_1', a: 'an_1' };
    const patched = resign(sandbox, { t: NOW * 1000 });
    expect(patched).toEqual({ ...sandbox, t: NOW * 1000 });
    const c = await signCookie(patched, k1);
    expect(await verifyCookie(c, keys, NOW)).toEqual({ ok: true, claims: patched });
    expect(() => resign(claims, { w: 'ws_only' })).toThrow();
  });

  it('rejects short signing keys', async () => {
    await expect(signCookie(claims, 'short')).rejects.toThrow(/32 bytes/);
  });
});

describe('cookie clock + encoding hardening', () => {
  it('fails closed on a non-finite nowS', async () => {
    const c = await signCookie(claims, k1);
    for (const n of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])
      expect((await verifyCookie(c, keys, n)).ok).toBe(false);
  });
  it('rejects non-canonical base64url and huge strings', async () => {
    expect(b64urlDecode('QR')).toBeNull(); // canonical is "QQ"
    expect(b64urlDecode('QQ')).not.toBeNull();
    expect(await verifyCookie('a'.repeat(1_000_000), keys, NOW)).toEqual({
      ok: false,
      reason: 'oversize',
    });
  });
});
