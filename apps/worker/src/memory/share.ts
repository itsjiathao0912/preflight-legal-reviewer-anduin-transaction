// Counsel share link signer (19-10-26). Two signed values share one format,
// `base64url(JSON claims) + "." + base64url(HMAC-SHA256(prefix + payload))`, keyed with the session
// cookie keys (COOKIE_SIGNING_KEYS[kid]) but domain-separated by a MAC-input prefix:
//   - share token (`share|v1|`): the link fragment `#counsel=<token>`; claims {w, a, d, r, exp, kid}.
//   - counsel cookie (`counsel|v1|`): `__Host-aduin_c` set by POST /api/counsel/join; claims add n.
// The session cookie MAC has no prefix, so none of the three values verifies as another. MACs are
// checked with crypto.subtle.verify (constant time). Values over SHARE_TOKEN_MAX are refused before
// any decoding. `exp` is epoch seconds; `a` is the analyst who shared (FK-safe decision author);
// `d` is the bundled doc ref (DOC_REF_RE); values without a valid `d` fail as invalid_claims.
import {
  b64urlDecode,
  b64urlEncode,
  DocRefSchema,
  SHARE_TOKEN_MAX,
  type KeyMap,
} from '@aduin/core';
import { z } from 'zod';

export const SHARE_TTL_S = 604_800; // 7 days
export const COUNSEL_COOKIE = '__Host-aduin_c';
export const SHARE_PREFIX = 'share|v1|';
export const COUNSEL_PREFIX = 'counsel|v1|';

const Kid = z.string().min(1).max(32);
const WsId = z.string().min(1).max(64);

export const ShareClaimsSchema = z
  .object({
    w: WsId,
    a: WsId,
    d: DocRefSchema,
    r: z.literal('counsel'),
    exp: z.number().int().positive(),
    kid: Kid,
  })
  .strict();
export type ShareClaims = z.infer<typeof ShareClaimsSchema>;

export const CounselClaimsSchema = z
  .object({
    w: WsId,
    a: WsId,
    d: DocRefSchema,
    r: z.literal('counsel'),
    n: z.string().min(1).max(80),
    exp: z.number().int().positive(),
    kid: Kid,
  })
  .strict();
export type CounselClaims = z.infer<typeof CounselClaimsSchema>;

export type ShareVerifyFailure =
  'oversize' | 'malformed' | 'unknown_kid' | 'bad_signature' | 'invalid_claims' | 'expired';
export type ShareVerify<T> = { ok: true; claims: T } | { ok: false; reason: ShareVerifyFailure };

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });

async function hmacKey(material: unknown, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  if (typeof material !== 'string' && !(material instanceof Uint8Array))
    throw new Error('share signing key must be raw key material');
  const raw = typeof material === 'string' ? enc.encode(material) : material;
  if (raw.byteLength < 32) throw new Error('share signing key must be at least 32 bytes');
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

async function sign(prefix: string, claims: object, keys: KeyMap, kid: string): Promise<string> {
  const material = keys[kid];
  if (material === undefined) throw new Error('unknown signing kid');
  const payload = b64urlEncode(enc.encode(JSON.stringify(claims)));
  const k = await hmacKey(material, 'sign');
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', k, enc.encode(prefix + payload) as BufferSource),
  );
  const value = `${payload}.${b64urlEncode(sig)}`;
  if (value.length > SHARE_TOKEN_MAX) throw new Error('share value exceeds max size');
  return value;
}

async function verify<T extends { exp: number; kid: string }>(
  prefix: string,
  schema: z.ZodType<T>,
  value: string,
  keys: KeyMap,
  nowS: number,
): Promise<ShareVerify<T>> {
  if (!Number.isFinite(nowS)) return { ok: false, reason: 'expired' };
  if (typeof value !== 'string' || value.length > SHARE_TOKEN_MAX)
    return { ok: false, reason: 'oversize' };
  const dot = value.indexOf('.');
  if (dot <= 0 || dot !== value.lastIndexOf('.')) return { ok: false, reason: 'malformed' };
  const payload = value.slice(0, dot);
  const payloadBytes = b64urlDecode(payload);
  const sigBytes = b64urlDecode(value.slice(dot + 1));
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
  let key: CryptoKey;
  try {
    key = await hmacKey(keys[kid], 'verify');
  } catch {
    return { ok: false, reason: 'unknown_kid' };
  }
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes as BufferSource,
    enc.encode(prefix + payload) as BufferSource,
  );
  if (!valid) return { ok: false, reason: 'bad_signature' };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid_claims' };
  if (parsed.data.exp <= nowS) return { ok: false, reason: 'expired' };
  return { ok: true, claims: parsed.data };
}

export function signShare(claims: ShareClaims, keys: KeyMap): Promise<string> {
  return sign(SHARE_PREFIX, ShareClaimsSchema.parse(claims), keys, claims.kid);
}

export function verifyShare(
  value: string,
  keys: KeyMap,
  nowS: number,
): Promise<ShareVerify<ShareClaims>> {
  return verify(SHARE_PREFIX, ShareClaimsSchema, value, keys, nowS);
}

export function signCounselCookie(claims: CounselClaims, keys: KeyMap): Promise<string> {
  return sign(COUNSEL_PREFIX, CounselClaimsSchema.parse(claims), keys, claims.kid);
}

export function verifyCounselCookie(
  value: string,
  keys: KeyMap,
  nowS: number,
): Promise<ShareVerify<CounselClaims>> {
  return verify(COUNSEL_PREFIX, CounselClaimsSchema, value, keys, nowS);
}

/** `Set-Cookie` for the counsel cookie; Max-Age = exp - now (never negative). */
export function counselSetCookie(value: string, expS: number, nowS: number): string {
  const maxAge = Math.max(0, expS - nowS);
  return `${COUNSEL_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

/** Share link expiry (epoch seconds): min(now + 7 d, sandbox expiry). */
export function shareExpiry(nowMs: number, workspaceExpiresAtMs: number): number {
  return Math.floor(Math.min(nowMs + SHARE_TTL_S * 1000, workspaceExpiresAtMs) / 1000);
}
