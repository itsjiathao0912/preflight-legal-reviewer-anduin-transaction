import { limits } from '../config/limits';
import { SessionClaimsSchema, type SessionClaims } from '../contracts/claims';

/**
 * Signed session cookie: base64url(JSON claims) + "." + base64url(HMAC-SHA256).
 * Verification uses crypto.subtle.verify (constant-time); signatures are never compared as strings.
 * Keys are parameters only (never read from files or env here).
 */

export type KeyMaterial = string | Uint8Array | CryptoKey;
export type KeyMap = Readonly<Record<string, KeyMaterial>>;

export type VerifyResult =
  | { ok: true; claims: SessionClaims }
  | {
      ok: false;
      reason:
        | 'malformed'
        | 'oversize'
        | 'unknown_kid'
        | 'bad_signature'
        | 'expired'
        | 'iat_future'
        | 'invalid_claims';
    };

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    // reject non-canonical encodings (non-zero trailing bits) so each value has one encoding
    if (b64urlEncode(out) !== s) return null;
    return out;
  } catch {
    return null;
  }
}

async function importKey(k: KeyMaterial, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  if (typeof k === 'object' && 'type' in k && 'algorithm' in k) return k as CryptoKey;
  const raw = typeof k === 'string' ? enc.encode(k) : (k as Uint8Array);
  if (raw.byteLength < 32) throw new Error('cookie signing key must be at least 32 bytes');
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

/** Sign claims with the key for claims.kid. */
export async function signCookie(claims: SessionClaims, key: KeyMaterial): Promise<string> {
  const c = SessionClaimsSchema.parse(claims);
  const payload = b64urlEncode(enc.encode(JSON.stringify(c)));
  const k = await importKey(key, 'sign');
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', k, enc.encode(payload) as BufferSource),
  );
  const value = `${payload}.${b64urlEncode(sig)}`;
  if (enc.encode(value).byteLength > limits.cookieMaxBytes)
    throw new Error('cookie exceeds max size');
  return value;
}

/**
 * Verify a cookie value. `nowS` is epoch seconds. Rejects: oversize, malformed base64/JSON,
 * unknown kid (only kids in `keys` are accepted: rotation), bad signature, exp <= now,
 * iat beyond the allowed future skew, claims failing the schema.
 */
export async function verifyCookie(
  value: string,
  keys: KeyMap,
  nowS: number,
): Promise<VerifyResult> {
  // fail closed on a non-finite clock (NaN/Infinity would make every exp/iat comparison pass or fail oddly)
  if (!Number.isFinite(nowS)) return { ok: false, reason: 'expired' };
  // UTF-8 bytes >= UTF-16 units: reject huge strings before encoding them
  if (value.length > limits.cookieMaxBytes) return { ok: false, reason: 'oversize' };
  if (enc.encode(value).byteLength > limits.cookieMaxBytes)
    return { ok: false, reason: 'oversize' };
  const dot = value.indexOf('.');
  if (dot <= 0 || dot !== value.lastIndexOf('.')) return { ok: false, reason: 'malformed' };
  const payload = value.slice(0, dot);
  const sigB64 = value.slice(dot + 1);
  const payloadBytes = b64urlDecode(payload);
  const sigBytes = b64urlDecode(sigB64);
  if (!payloadBytes || !sigBytes || sigBytes.byteLength === 0)
    return { ok: false, reason: 'malformed' };
  let raw: unknown;
  try {
    raw = JSON.parse(dec.decode(payloadBytes));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const kid = typeof raw === 'object' && raw !== null ? (raw as { kid?: unknown }).kid : undefined;
  if (typeof kid !== 'string' || !Object.prototype.hasOwnProperty.call(keys, kid))
    return { ok: false, reason: 'unknown_kid' };
  const key = await importKey(keys[kid]!, 'verify');
  // constant-time verification; wrong-length signatures simply fail
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes as BufferSource,
    enc.encode(payload) as BufferSource,
  );
  if (!valid) return { ok: false, reason: 'bad_signature' };
  const parsed = SessionClaimsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid_claims' };
  const c = parsed.data;
  if (c.exp <= nowS) return { ok: false, reason: 'expired' };
  if (c.iat > nowS + limits.cookieIatSkewSeconds) return { ok: false, reason: 'iat_future' };
  return { ok: true, claims: c };
}
