// AC42, AC55: a replayed client_op_id returns the ORIGINAL 200 body with no second row; a
// uq_decision_active race returns 409 conflict_active_decision with `current`; the two are told
// apart by the constraint text (S8).
import { env } from 'cloudflare:test';
import { ConflictBodySchema } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { decisionRow, insertDecisionStmt } from './db-fixtures';
import { call, decide, decisionBody, fpOf, makeMem, newRun, op, session } from './memory-harness';

const count = async (sql: string, ...b: unknown[]) =>
  (await env.DB.prepare(sql)
    .bind(...b)
    .first<{ n: number }>())!.n;

describe('idempotent-replay (AC42, AC55)', () => {
  test('should return the original response when a client_op_id is replayed', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const body = decisionBody({ runId: run, quote: 'Replay me exactly.' });
    const first = await call(h, 'POST', '/api/decisions', body, { cookie: s.cookie });
    expect(first.status).toBe(200);
    const nDec = await count(
      'SELECT COUNT(*) AS n FROM decision WHERE workspace_id = ?1',
      s.workspaceId,
    );
    const nAud = await count(
      'SELECT COUNT(*) AS n FROM audit_event WHERE workspace_id = ?1',
      s.workspaceId,
    );
    const replay = await call(h, 'POST', '/api/decisions', body, { cookie: s.cookie });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    expect(
      await count('SELECT COUNT(*) AS n FROM decision WHERE workspace_id = ?1', s.workspaceId),
    ).toBe(nDec);
    expect(
      await count('SELECT COUNT(*) AS n FROM audit_event WHERE workspace_id = ?1', s.workspaceId),
    ).toBe(nAud);
    // revoke and rule ops replay the same way
    const rv = { client_op_id: op(), reason: 'undo' };
    const r1 = await call(h, 'POST', `/api/decisions/${first.body.decision.id}/revoke`, rv, {
      cookie: s.cookie,
    });
    const r2 = await call(h, 'POST', `/api/decisions/${first.body.decision.id}/revoke`, rv, {
      cookie: s.cookie,
    });
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(r2.body).toEqual(r1.body);
    const rule = { client_op_id: op(), text: 'Replayed rule.' };
    const a = await call(h, 'POST', '/api/rules?law_firm_id=firm-x', rule, { cookie: s.cookie });
    const b = await call(h, 'POST', '/api/rules?law_firm_id=firm-x', rule, { cookie: s.cookie });
    expect(b.body).toEqual(a.body);
    expect(
      await count(
        "SELECT COUNT(*) AS n FROM firm_rule WHERE workspace_id = ?1 AND origin = 'manual' AND seed_of IS NULL",
        s.workspaceId,
      ),
    ).toBe(1);
    // an op id reused for a different action is refused
    const reused = await call(
      h,
      'POST',
      '/api/rules?law_firm_id=firm-x',
      { client_op_id: body['client_op_id'], text: 'x' },
      { cookie: s.cookie },
    );
    expect(reused.status).toBe(400);
    expect(reused.body.error.reason).toBe('op_reused');
  });

  test('a uq_decision_active race returns 409 with the current decision', async () => {
    let race: { ws: string; fp: string } | null = null;
    let winnerId = '';
    const racing = {
      prepare: (q: string) => env.DB.prepare(q),
      async batch(stmts: D1PreparedStatement[]) {
        if (race) {
          const row = decisionRow(race.ws, { fingerprint: race.fp, decided_by_name: 'Other tab' });
          winnerId = row.id;
          race = null;
          await insertDecisionStmt(env.DB, row).run(); // another tab wins between our read and our batch
        }
        return env.DB.batch(stmts);
      },
    } as unknown as D1Database;
    const h = makeMem({ db: racing });
    const s = await session(h);
    const run = await newRun(h, s);
    const quote = 'Two tabs decide the same thing.';
    race = { ws: s.workspaceId, fp: fpOf('firm-x', 'defined_term_issue', quote) };
    const r = await decide(h, s, { runId: run, quote });
    expect(r.status).toBe(409);
    const body = ConflictBodySchema.parse(r.body);
    expect(body.error.code).toBe('conflict_active_decision');
    expect(body.current?.id).toBe(winnerId);
    expect(body.current?.decided_by_name).toBe('Other tab');
    // nothing of the losing batch was written (atomic), including its audit row
    expect(
      await count(
        "SELECT COUNT(*) AS n FROM audit_event WHERE workspace_id = ?1 AND action = 'decision_recorded' AND client_op_id NOT LIKE 'seed:%'",
        s.workspaceId,
      ),
    ).toBe(0);
    // a later decision on the same fingerprint supersedes the winner normally
    expect((await decide(h, s, { runId: run, quote, reason: 'other' })).status).toBe(200);
  });
});
