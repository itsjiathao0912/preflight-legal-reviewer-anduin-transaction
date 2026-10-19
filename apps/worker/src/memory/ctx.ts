// Memory request context. The workspace and analyst come ONLY from the verified signed cookie
// (`verifyCookie`, never `resolveVisitor`: memory routes never mint). Liveness (workspace exists,
// kind='sandbox', active, unexpired, analyst present) and schema/seed health are checked in the
// FIRST query of every request; a stale or purged workspace gives 401 invalid_session.
import { verifyCookie } from '@aduin/core';
import type { ProxyConfig } from '../config';
import { readCookie, VISITOR_COOKIE } from '../limits/visitor';
import { ProxyError } from '../proxy/errors';
import { configFor } from '../proxy/pipeline';
import type { Db } from '../db/meta';
import { DEMO_WORKSPACE_ID, readHealth, writable } from './health';
import { WORKSPACE_SQL, type LivenessRow } from './repo/workspace';
import { claim, QUOTA_SQL, splitWindow } from '../platform/quota';
import {
  MEMORY_WRITE_CAPS,
  MEMORY_WRITE_WEIGHTS,
  rowBudgetKey,
  withSessionCaps,
  writeKey,
  type WriteKind,
} from '../platform/index';
import { secondsToReset } from '../limits/clock';
import { COUNSEL_COOKIE, verifyCounselCookie } from './share';

/** Analyst marker of a read-only demo session (no `w`): reads bind ws_demo, writes get 403. */
export const READ_ONLY_ANALYST = 'ro';

export interface MemoryCtx {
  db: Db;
  workspaceId: string;
  analystId: string;
  analystName: string;
  now: number;
  readOnly: boolean;
}

export function memoryConfig(env: object): ProxyConfig {
  try {
    const cfg = configFor(env);
    if (!cfg.cookieKeys || !cfg.cookieKid) throw new Error('no cookie keys');
    return cfg;
  } catch {
    throw new ProxyError('memory_unavailable', 'config');
  }
}

export function memoryDb(env: { DB?: D1Database }): Db {
  if (!env.DB) throw new ProxyError('memory_unavailable', 'no_db');
  return env.DB;
}

/** A cookie whose signature (and exp) verified; no DB query has been made yet. */
export interface VerifiedSession {
  db: Db;
  w: string | undefined;
  a: string | undefined;
  now: number;
  write: boolean;
}

/**
 * Step 1 (no DB, review L5): verify the signed cookie BEFORE any body read/parse, so a forged or
 * missing cookie never costs body parsing CPU. A read-only ('ro') cookie on a write is refused here.
 */
export async function verifySession(
  request: Request,
  env: { DB?: D1Database },
  now: number,
  opts: { write: boolean },
): Promise<VerifiedSession> {
  const cfg = memoryConfig(env);
  const db = memoryDb(env);
  const raw = readCookie(request, VISITOR_COOKIE);
  if (!raw) throw new ProxyError('invalid_session', 'no_session');
  const v = await verifyCookie(raw, cfg.cookieKeys!, Math.floor(now / 1000));
  if (!v.ok) throw new ProxyError('invalid_session', 'bad_cookie');
  const { w, a } = v.claims;
  if (!w || !a) {
    if (!w && a === READ_ONLY_ANALYST) {
      if (opts.write) throw new ProxyError('read_only_demo');
      return { db, w: undefined, a, now, write: false };
    }
    throw new ProxyError('invalid_session', 'no_workspace');
  }
  return { db, w, a, now, write: opts.write };
}

/**
 * Step 2: liveness + health in the first query; for writes, the per-workspace daily
 * mutating-request claim (review M1) is taken right after liveness, then the global weighted
 * daily write-row budget claim (review fix cycle 2, N1) of `weight` units. A refusal writes nothing.
 */
export async function resolveSession(
  s: VerifiedSession,
  weight: number = MEMORY_WRITE_WEIGHTS.other,
): Promise<MemoryCtx> {
  const { db, w, a, now } = s;
  if (!w) {
    const h = await readHealth(db);
    if (h.schema_version === null) throw new ProxyError('memory_unavailable', 'schema');
    return {
      db,
      workspaceId: DEMO_WORKSPACE_ID,
      analystId: READ_ONLY_ANALYST,
      analystName: 'Read-only visitor',
      now,
      readOnly: true,
    };
  }
  const row = await db.prepare(WORKSPACE_SQL.liveness).bind(w, a).first<LivenessRow>();
  if (!row) throw new ProxyError('invalid_session', 'stale_session');
  if (row.kind !== 'sandbox' || row.status !== 'active')
    throw new ProxyError('invalid_session', 'stale_session');
  if (row.expires_at === null || row.expires_at <= now)
    throw new ProxyError('invalid_session', 'expired');
  if (s.write && !writable(row.schema_version, row.seed_mode))
    throw new ProxyError('memory_unavailable', 'schema');
  const ctx: MemoryCtx = {
    db,
    workspaceId: w,
    analystId: a!,
    analystName: row.display_name,
    now,
    readOnly: false,
  };
  if (s.write) {
    await precheckRowBudget(ctx, weight);
    await claimWrite(ctx, 'req', 1);
    await claimRowBudget(ctx, weight);
  }
  return ctx;
}

export async function memoryCtx(
  request: Request,
  env: { DB?: D1Database },
  now: number,
  opts: { write: boolean },
): Promise<MemoryCtx> {
  return resolveSession(await verifySession(request, env, now, opts));
}

/**
 * Per-workspace daily write caps (review M1), claimed through the guarded quota_counter UPSERT
 * (one row written per claim; a refusal writes nothing and maps to 429 rate_limited).
 */
export async function claimWrite(ctx: MemoryCtx, kind: WriteKind, units: number): Promise<void> {
  const qopts = { capFor: withSessionCaps(() => 0), now: () => ctx.now };
  const r = await claim(ctx.db, qopts, writeKey(ctx.workspaceId, kind, ctx.now), units);
  if (!r.ok) throw new ProxyError('rate_limited', WRITE_REASON[kind], secondsToReset(ctx.now));
}

/**
 * Global weighted daily write-row budget (review fix cycle 2, N1): bounds total memory D1 writes
 * across all sandboxes. Refusal -> 429 rate_limited `memory_write_budget`, retry-after = next UTC day.
 */
export async function claimRowBudget(ctx: MemoryCtx, weight: number): Promise<void> {
  if (!Number.isInteger(weight) || weight < 1) throw new Error(`bad write weight: ${weight}`);
  const qopts = { capFor: withSessionCaps(() => 0), now: () => ctx.now };
  const r = await claim(ctx.db, qopts, rowBudgetKey(ctx.now), weight);
  if (!r.ok) throw new ProxyError('rate_limited', 'memory_write_budget', secondsToReset(ctx.now));
}

/**
 * Review fix cycle 3 (N8): 0-row read of the global budget BEFORE the per-workspace request claim,
 * so a request that the budget would refuse never burns a `mw|req` row. Advisory only: the guarded
 * claim in claimRowBudget stays the authority (a race past this read is still refused there).
 */
export async function precheckRowBudget(ctx: MemoryCtx, weight: number): Promise<void> {
  const { base, window } = splitWindow(rowBudgetKey(ctx.now).key);
  const row = await ctx.db
    .prepare(QUOTA_SQL.peek)
    .bind('rate', base, window)
    .first<{ count: number }>();
  if (row && Number(row.count) + weight > MEMORY_WRITE_CAPS.rowBudgetPerDay)
    throw new ProxyError('rate_limited', 'memory_write_budget', secondsToReset(ctx.now));
}

const WRITE_REASON: Record<WriteKind, string> = {
  req: 'workspace_write_limit',
  run: 'workspace_run_limit',
  fnd: 'workspace_findings_limit',
};

/** Who is acting on a counsel-sheet route (19-10-26 counsel share link). */
export type CounselActor = 'analyst' | 'counsel';

export interface CounselMemoryCtx extends MemoryCtx {
  actor: CounselActor;
  /** Self-declared counsel name from the counsel cookie (masked at join); counsel actor only. */
  counselName?: string;
  /** Bundled doc ref from the counsel cookie (`d`); counsel actor only. */
  docRef?: string;
}

export interface VerifiedActor {
  s: VerifiedSession;
  actor: CounselActor;
  counselName?: string;
  docRef?: string;
}

/**
 * Step 1 for the four counsel-accepting routes (sheet, answers, comments GET/POST): a valid counsel
 * cookie (`__Host-aduin_c`) wins; otherwise the analyst cookie is verified exactly as `verifySession`.
 * An invalid/expired counsel cookie is ignored (falls back to the analyst cookie). No DB query.
 * The workspace always comes from the verified cookie, never from the body or URL.
 */
export async function verifyActor(
  request: Request,
  env: { DB?: D1Database },
  now: number,
  opts: { write: boolean },
): Promise<VerifiedActor> {
  const raw = readCookie(request, COUNSEL_COOKIE);
  if (raw) {
    const cfg = memoryConfig(env);
    const db = memoryDb(env);
    const v = await verifyCounselCookie(raw, cfg.cookieKeys!, Math.floor(now / 1000));
    if (v.ok)
      return {
        s: { db, w: v.claims.w, a: v.claims.a, now, write: opts.write },
        actor: 'counsel',
        counselName: v.claims.n,
        docRef: v.claims.d,
      };
  }
  return { s: await verifySession(request, env, now, opts), actor: 'analyst' };
}

/**
 * Step 2: the same liveness/health/claim path as `resolveSession` (a counsel cookie names the
 * sharing analyst, whose row must still exist). Counsel acts under the name `Counsel: <n>`.
 */
export async function resolveActor(
  v: VerifiedActor,
  weight: number = MEMORY_WRITE_WEIGHTS.other,
): Promise<CounselMemoryCtx> {
  const ctx = await resolveSession(v.s, weight);
  if (v.actor === 'counsel') {
    if (ctx.readOnly || !v.counselName) throw new ProxyError('invalid_session', 'bad_cookie');
    return {
      ...ctx,
      analystName: `Counsel: ${v.counselName}`,
      actor: 'counsel',
      counselName: v.counselName,
      ...(v.docRef ? { docRef: v.docRef } : {}),
    };
  }
  return { ...ctx, actor: 'analyst' };
}

export async function counselCtx(
  request: Request,
  env: { DB?: D1Database },
  now: number,
  opts: { write: boolean; weight?: number },
): Promise<CounselMemoryCtx> {
  return resolveActor(await verifyActor(request, env, now, opts), opts.weight);
}
