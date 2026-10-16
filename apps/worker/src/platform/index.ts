// D1 platform (Phase 04b): SQL implementations of the frozen Phase 01 ports used by the 04a proxy.
// `createD1Platform(db, {capFor})` returns `{quota(keys), cache, ledger}`; rules are NOT part of
// the bundle because the RulesPort is workspace-bound (`createRulesPort(db, workspaceId)`).
import type { QuotaKey } from '@aduin/core';
import type { ProxyPlatform } from '../proxy/ports';
import type { Db } from '../db/meta';
import { createD1Cache } from './cache';
import { createD1Ledger } from './ledger';
import { createD1Quota } from './quota';

export { createD1Breaker } from './breaker';
export { createRulesPort } from './rules';

/**
 * Sandbox-creation caps (`session_new` scope; pinned at S9): per IP hash per UTC day and global
 * per UTC day. S9 measured 84 rows written per session on remote D1 (the demo-seed copy), so
 * 300 sessions/day stay near 25% of the 100k/day D1 Free write budget. Over the global cap the
 * session degrades to the read-only demo.
 */
export const SESSION_CAPS = Object.freeze({ perIpPerDay: 5, globalPerDay: 300 });

const PROXY_KINDS = new Set(['req', 'doc', 'seen', 'ocr', 'g', 'spend']);

/**
 * Wrap the 04a `capFor` so `session_new` keys have caps and an unknown key kind THROWS (the claim
 * then throws and the caller fails closed) instead of silently refusing with cap 0.
 */
export function withSessionCaps(base: (key: QuotaKey) => number): (key: QuotaKey) => number {
  return (key) => {
    const [kind, sub] = key.key.split('|');
    if (kind === 'snew') return sub === 'ip' ? SESSION_CAPS.perIpPerDay : SESSION_CAPS.globalPerDay;
    if (!kind || !PROXY_KINDS.has(kind)) throw new Error(`unknown quota key kind: ${kind ?? ''}`);
    return base(key);
  };
}

export interface D1PlatformOptions {
  capFor: (key: QuotaKey) => number;
  now?: () => number;
}

export function createD1Platform(db: Db, opts: D1PlatformOptions): ProxyPlatform {
  if (!db) throw new Error('createD1Platform requires a D1 binding');
  const now = opts.now ?? (() => Date.now());
  const qopts = { capFor: opts.capFor, now };
  return {
    quota: (keys) => createD1Quota(db, qopts, keys),
    cache: createD1Cache(db, now),
    ledger: createD1Ledger(db),
  };
}
