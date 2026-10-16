// Visitor identity: client IP from `cf-connecting-ip` ONLY (never x-forwarded-for), IPv6
// truncated to /64, hashed with a daily salt; plus the signed `__Host-` visitor cookie
// (frozen Phase 01 claims + cookie helper). Limits key on claim `v` (never `a`).
import { resign, signCookie, verifyCookie, type SessionClaims } from '@aduin/core';
import type { ProxyConfig } from '../config';
import { utcDay } from './clock';

export const VISITOR_COOKIE = '__Host-aduin_v';

/** Normalize an IP: IPv4 as-is, IPv6 expanded and truncated to its /64 prefix. */
export function ipPrefix(raw: string | null): string {
  const ip = (raw ?? '').trim().toLowerCase();
  if (ip.length === 0 || ip.length > 64) return 'unknown';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
  if (!/^[0-9a-f:.]+$/.test(ip) || !ip.includes(':')) return 'unknown';
  const v4tail = ip.includes('.') ? ip.slice(ip.lastIndexOf(':') + 1) : null;
  const body = v4tail ? ip.slice(0, ip.lastIndexOf(':') + 1) + '0:0' : ip;
  const halves = body.split('::');
  if (halves.length > 2) return 'unknown';
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return 'unknown';
  const groups = [...head, ...Array<string>(fill).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return 'unknown';
  return (
    groups
      .slice(0, 4)
      .map((g) => g.replace(/^0+(?=.)/, ''))
      .join(':') + '::/64'
  );
}

async function sha256HexAsync(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Daily-salted IP hash. The salt mixes the UTC day with server-side secret material. */
export async function ipHash(request: Request, saltSecret: string, nowMs: number): Promise<string> {
  const prefix = ipPrefix(request.headers.get('cf-connecting-ip'));
  return (await sha256HexAsync(`ip|${utcDay(nowMs)}|${saltSecret}|${prefix}`)).slice(0, 32);
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header || header.length > 8192) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

export interface Visitor {
  claims: SessionClaims;
  /** true when the cookie must be (re)issued in the response. */
  dirty: boolean;
  ipHash: string;
}

function newVisitorId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolve the visitor. A valid cookie (any kid in the map) yields its claims; anything else
 * (absent, forged, expired, unknown kid) mints fresh claims `{v, iat, exp, kid}`. Minting gives
 * no extra allowance because limits also key on the IP hash (stricter of the two).
 */
export async function resolveVisitor(
  request: Request,
  cfg: ProxyConfig,
  nowMs: number,
): Promise<Visitor | null> {
  if (!cfg.cookieKeys || !cfg.cookieKid) return null;
  const salt = String(cfg.cookieKeys[cfg.cookieKid]);
  const hash = await ipHash(request, salt, nowMs);
  const nowS = Math.floor(nowMs / 1000);
  const raw = readCookie(request, VISITOR_COOKIE);
  if (raw) {
    const r = await verifyCookie(raw, cfg.cookieKeys, nowS);
    if (r.ok) return { claims: r.claims, dirty: false, ipHash: hash };
  }
  const claims: SessionClaims = {
    v: newVisitorId(),
    iat: nowS,
    exp: nowS + cfg.cookieTtlS,
    kid: cfg.cookieKid,
  };
  return { claims, dirty: true, ipHash: hash };
}

/** Record a Turnstile pass as `t` (epoch ms), preserving every other claim. */
export function withTurnstilePass(v: Visitor, nowMs: number): Visitor {
  return { ...v, claims: resign(v.claims, { t: nowMs }), dirty: true };
}

/** Fresh iff `now - t <= ttl`; a future `t` is stale (forces a new siteverify). */
export function turnstileFresh(claims: SessionClaims, nowMs: number, ttlMs: number): boolean {
  if (claims.t === undefined) return false;
  if (claims.t > nowMs) return false;
  return nowMs - claims.t <= ttlMs;
}

export async function visitorSetCookie(v: Visitor, cfg: ProxyConfig): Promise<string | null> {
  if (!v.dirty || !cfg.cookieKeys) return null;
  const key = cfg.cookieKeys[v.claims.kid];
  if (key === undefined) return null;
  const value = await signCookie(v.claims, key);
  const maxAge = Math.max(0, v.claims.exp - v.claims.iat);
  return `${VISITOR_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}
