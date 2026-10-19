// D1 platform (Phase 04b): SQL implementations of the frozen Phase 01 ports used by the 04a proxy.
// `createD1Platform(db, {capFor})` returns `{quota(keys), cache, ledger}`; rules are NOT part of
// the bundle because the RulesPort is workspace-bound (`createRulesPort(db, workspaceId)`).
import type { QuotaKey } from '@aduin/core';
import { utcDay } from '../limits/clock';
import type { ProxyPlatform } from '../proxy/ports';
import type { Db } from '../db/meta';
import { createD1Cache } from './cache';
import { createD1Ledger } from './ledger';
import { createD1Quota } from './quota';
import { createD1Spend } from './spend';

export { createD1Breaker } from './breaker';
export { createRulesPort } from './rules';

/**
 * Sandbox-creation caps (`session_new` scope; pinned at S9): per IP hash per UTC day and global
 * per UTC day. S9 measured 84 rows written per session on remote D1 (the demo-seed copy), so
 * 300 sessions/day stay near 25% of the 100k/day D1 Free write budget. Over the global cap the
 * session degrades to the read-only demo.
 */
export const SESSION_CAPS = Object.freeze({ perIpPerDay: 5, globalPerDay: 300 });

/**
 * Per-workspace daily memory write caps (review M1; `rate` scope, `mw|<kind>|<workspace>|<day>`):
 * mutating requests, persisted review runs (POST /api/runs) and persisted findings. Sized to a
 * realistic demo session: 600 requests stays ~1-2k rows/day/workspace worst case on top of the
 * capped run/finding rows, so one sandbox can no longer exhaust the 100k/day D1 write budget.
 */
export const MEMORY_WRITE_CAPS = Object.freeze({
  requestsPerDay: 600,
  runsPerDay: 40,
  findingsPerDay: 2_000,
  /**
   * Global (all workspaces) weighted daily write-row budget (review fix cycle 2, N1/M1). Every
   * memory write claims `memoryWriteWeight(...)` units from `mw|rows|<day>`; at the cap memory
   * writes get 429 `memory_write_budget` until the next UTC day. Sessions, AI and OCR are NOT
   * charged here. Fix cycle 3 (N9): lowered 40k -> 30k for purge headroom. Worst case/day:
   * 30k (memory) + 300 x 130 (sessions incl. lazy purge slot) = 39k + AI/OCR + refused claims
   * + cron purge DELETEs stays under the 100k rows/day D1 Free write budget (phase 04b report).
   */
  rowBudgetPerDay: 30_000,
});

/**
 * Write-row weights per memory route (units claimed from the global budget). Derived from the
 * rows-written test bounds (test/memory/rows-written.test.ts) so units >= rows actually written:
 * decision 32, run 12, counsel answer 18 (bound 18 > the 10 default), findings chunk n + 5
 * (n finding rows + run recount + claim rows), every other write 10.
 * Fix cycle 3 (N7): the decision weight was 25 against a 3-evidence proposal; the worst case is
 * now a re-proposal linking the capped EVIDENCE_LINK_MAX (10) evidence rows, measured at 26 rows
 * (rows-written N7 loop test), plus a margin of 6 for a superseding re-proposal -> 32.
 * Run export's drafted-question UPDATE is amortised: each counsel question (weight 10, <= 9 rows)
 * pays for its own single later export row.
 */
export const MEMORY_WRITE_WEIGHTS = Object.freeze({
  decision: 32,
  run: 12,
  counselAnswer: 18,
  /**
   * Variance (Phase 03): answer that also creates a regression check. Derived from a measurement
   * (rows-written variance test, local D1): plain answer 13 rows, answer + check 18 rows, delta +5
   * (check row + PK and ix_regression_check_scope entries + its audit row and indexes) -> 18 + 5.
   */
  counselAnswerWithAssertion: 23,
  findingsBase: 5,
  other: 10,
});

/** Counsel answer weight: an `assertion` (non-null object) also writes a check + audit row. */
export function counselAnswerWeight(raw: Record<string, unknown>): number {
  const a = raw['assertion'];
  return a !== null && typeof a === 'object'
    ? MEMORY_WRITE_WEIGHTS.counselAnswerWithAssertion
    : MEMORY_WRITE_WEIGHTS.counselAnswer;
}

export type WriteKind = 'req' | 'run' | 'fnd';

/** The global weighted daily write-row budget key (`rate` scope; review fix cycle 2, N1). */
export function rowBudgetKey(nowMs: number): QuotaKey {
  return { scope: 'rate', key: `mw|rows|${utcDay(nowMs)}` };
}

export function writeKey(workspaceId: string, kind: WriteKind, nowMs: number): QuotaKey {
  return { scope: 'rate', key: `mw|${kind}|${workspaceId}|${utcDay(nowMs)}` };
}

const WRITE_CAP: Record<string, number> = {
  req: MEMORY_WRITE_CAPS.requestsPerDay,
  run: MEMORY_WRITE_CAPS.runsPerDay,
  fnd: MEMORY_WRITE_CAPS.findingsPerDay,
  rows: MEMORY_WRITE_CAPS.rowBudgetPerDay,
};

const PROXY_KINDS = new Set(['req', 'doc', 'seen', 'ocr', 'g', 'spend']);

/**
 * Wrap the 04a `capFor` so `session_new` keys have caps and an unknown key kind THROWS (the claim
 * then throws and the caller fails closed) instead of silently refusing with cap 0.
 */
export function withSessionCaps(base: (key: QuotaKey) => number): (key: QuotaKey) => number {
  return (key) => {
    const [kind, sub] = key.key.split('|');
    if (kind === 'mw') {
      const cap = sub !== undefined ? WRITE_CAP[sub] : undefined;
      if (cap === undefined) throw new Error(`unknown memory write kind: ${sub ?? ''}`);
      return cap;
    }
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
    spend: createD1Spend(db, qopts),
  };
}
