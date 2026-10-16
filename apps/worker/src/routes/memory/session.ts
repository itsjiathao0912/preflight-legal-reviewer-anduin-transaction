// POST /api/session — the ONLY memory route that mints/re-signs the cookie. Creates a sandbox
// workspace + analyst (simulated name), copies the demo seed, audits `session_created`, and
// re-signs the single `__Host-aduin_v` cookie with {w, a, exp = workspace expiry}, preserving v/t.
// Abuse caps: `session_new` per IP hash and a global daily cap (D1 quota). Turnstile is enforced
// iff TURNSTILE_SECRET is configured (fail closed). Over the global cap the session degrades to
// the read-only demo (a cookie with a='ro' and no w: reads bind ws_demo, writes get 403).
import {
  CreateSessionRequestSchema,
  CreateSessionResponseSchema,
  resign,
  type QuotaKey,
  type SessionClaims,
} from '@aduin/core';
import { createTurnstile, TURNSTILE_HEADER } from '../../identity/turnstile';
import { utcDay, secondsToReset } from '../../limits/clock';
import {
  resolveVisitor,
  turnstileFresh,
  visitorSetCookie,
  withTurnstilePass,
  type Visitor,
} from '../../limits/visitor';
import { ProxyError, jsonNoStore } from '../../proxy/errors';
import { capFor } from '../../limits/policy';
import { newId } from '../../db/ids';
import type { Db } from '../../db/meta';
import { claim, refund } from '../../platform/quota';
import { withSessionCaps } from '../../platform/index';
import { memoryConfig, memoryDb, READ_ONLY_ANALYST, type MemoryCtx } from '../../memory/ctx';
import { DEMO_WORKSPACE_ID, readHealth } from '../../memory/health';
import { maskFree } from '../../memory/mask';
import { auditStmt } from '../../memory/repo/audit';
import { claimPurgeSlot, runPurge, sandboxExpiry } from '../../memory/repo/purge';
import { createSandboxStmts, WORKSPACE_SQL, type LivenessRow } from '../../memory/repo/workspace';
import { seedCopyStmts } from '../../memory/seed-copy';
import { handle, parseWith, readJsonBody, type MemoryDeps } from '../../memory/http';
import type { Handler } from '../../app';

const sessionKeys = (ipHash: string, nowMs: number): { ip: QuotaKey; global: QuotaKey } => {
  const d = utcDay(nowMs);
  return {
    ip: { scope: 'session_new', key: `snew|ip|${ipHash}|${d}` },
    global: { scope: 'session_new', key: `snew|g|${d}` },
  };
};

async function setCookie(
  visitor: Visitor,
  claims: SessionClaims,
  cfg: ReturnType<typeof memoryConfig>,
): Promise<Record<string, string>> {
  const c = await visitorSetCookie({ ...visitor, claims, dirty: true }, cfg);
  return c ? { 'set-cookie': c } : {};
}

/** The live sandbox bound to the incoming (verified) cookie, if any (review L6). */
async function liveSandbox(
  db: Db,
  claims: SessionClaims,
  now: number,
): Promise<{ expires_at: number } | null> {
  if (!claims.w || !claims.a || claims.a === READ_ONLY_ANALYST) return null;
  const row = await db
    .prepare(WORKSPACE_SQL.liveness)
    .bind(claims.w, claims.a)
    .first<LivenessRow>();
  if (!row || row.kind !== 'sandbox' || row.status !== 'active') return null;
  if (row.expires_at === null || row.expires_at <= now) return null;
  return { expires_at: row.expires_at };
}

export function sessionHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'session', async (request, env) => {
    const raw = await readJsonBody(request);
    const body = parseWith(CreateSessionRequestSchema, raw);
    const cfg = memoryConfig(env);
    const db: Db = memoryDb(env);
    const now = deps.now();
    const nowS = Math.floor(now / 1000);
    let visitor = await resolveVisitor(request, cfg, now);
    if (!visitor) throw new ProxyError('memory_unavailable', 'config');

    // Turnstile iff configured (fail closed); a fresh pass recorded in `t` is reused.
    if (cfg.turnstileSecret && !turnstileFresh(visitor.claims, now, cfg.turnstilePassTtlMs)) {
      const token = body.turnstile ?? request.headers.get(TURNSTILE_HEADER);
      if (!token) throw new ProxyError('invalid_session', 'turnstile_missing');
      const port = deps.turnstile ?? createTurnstile(deps.fetch, cfg.turnstileSecret);
      const passed = await port.verify(token, visitor.ipHash).then(
        (r) => r.ok === true,
        () => false,
      );
      if (!passed) throw new ProxyError('invalid_session', 'turnstile_failed');
      visitor = withTurnstilePass(visitor, now);
    }

    const health = await readHealth(db);
    if (!health.writable) throw new ProxyError('memory_unavailable', 'schema');

    // Review L6 + fix cycle 2 (N6): a browser that already holds a live sandbox keeps it at any
    // cap level, BEFORE the per-IP claim, so a reload never mints and never burns an IP claim.
    // liveSandbox() only accepts kind='sandbox' rows, so a demo-bound cookie is never re-issued.
    const live = await liveSandbox(db, visitor.claims, now);
    if (live) {
      return jsonNoStore(
        CreateSessionResponseSchema.parse({
          workspace_id: visitor.claims.w,
          analyst_id: visitor.claims.a,
          kind: 'sandbox',
          expires_at: live.expires_at,
          read_only: false,
        }),
        await setCookie(visitor, visitor.claims, cfg),
      );
    }

    // Sandbox-minting caps: per IP hash first, the global counter last.
    const qopts = { capFor: withSessionCaps(capFor(cfg)), now: () => now };
    const k = sessionKeys(visitor.ipHash, now);
    const ipClaim = await claim(db, qopts, k.ip, 1);
    if (!ipClaim.ok) throw new ProxyError('rate_limited', 'session_limit', secondsToReset(now));
    const gClaim = await claim(db, qopts, k.global, 1);
    if (!gClaim.ok) {
      // Review L1: the per-IP claim is NOT refunded here, so the IP cap still bounds this loop.
      // Degrade: read-only demo (no workspace is created, no write budget spent).
      const claims = resign(visitor.claims, {
        a: READ_ONLY_ANALYST,
        w: undefined,
        iat: nowS,
        exp: nowS + 86_400,
      });
      return jsonNoStore(
        CreateSessionResponseSchema.parse({
          workspace_id: DEMO_WORKSPACE_ID,
          analyst_id: READ_ONLY_ANALYST,
          kind: 'visitor',
          expires_at: (nowS + 86_400) * 1000,
          read_only: true,
        }),
        await setCookie(visitor, claims, cfg),
      );
    }

    const workspaceId = newId('w', now);
    const analystId = newId('an', now);
    const analystName = maskFree(body.analyst_name);
    const expiresAt = sandboxExpiry(now);
    const ctx: MemoryCtx = { db, workspaceId, analystId, analystName, now, readOnly: false };
    try {
      await db.batch([
        ...createSandboxStmts(db, { workspaceId, analystId, analystName, now, expiresAt }),
        auditStmt(db, ctx, {
          op: `session:${workspaceId}`,
          action: 'session_created',
          entityType: 'workspace',
          entityId: workspaceId,
        }),
        ...seedCopyStmts(db, workspaceId, now),
      ]);
    } catch (e) {
      await refund(db, qopts, gClaim.refundToken).catch(() => {});
      await refund(db, qopts, ipClaim.refundToken).catch(() => {});
      throw e;
    }

    // Lazy retention purge, claimed at most once per hour; never fails the session.
    try {
      if (await claimPurgeSlot(db, now)) await runPurge(db, now);
    } catch {
      deps.logger.log('memory.purge_failed', { trigger: 'session' });
    }

    const expS = Math.floor(expiresAt / 1000);
    const claims = resign(visitor.claims, { w: workspaceId, a: analystId, iat: nowS, exp: expS });
    return jsonNoStore(
      CreateSessionResponseSchema.parse({
        workspace_id: workspaceId,
        analyst_id: analystId,
        kind: 'sandbox',
        expires_at: expiresAt,
        read_only: false,
      }),
      await setCookie(visitor, claims, cfg),
    );
  });
}
