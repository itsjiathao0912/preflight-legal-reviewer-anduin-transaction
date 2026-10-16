// Decisions are append-only: UPDATE/DELETE of the record fail; a re-decision supersedes (history kept).
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { decisionRow, errorOf, insertDecision, mkWorkspace } from './db-fixtures';
import { decide, makeMem, newRun, session } from './memory-harness';

describe('decision-append-only (AC42)', () => {
  test('should reject UPDATE and DELETE on decision', async () => {
    const ws = await mkWorkspace(env.DB);
    const d = decisionRow(ws);
    await insertDecision(env.DB, d);
    expect(
      await errorOf(
        env.DB.prepare("UPDATE decision SET note = 'x' WHERE workspace_id = ?1 AND id = ?2")
          .bind(ws, d.id)
          .run(),
      ),
    ).toContain('decision_immutable');
    expect(
      await errorOf(
        env.DB.prepare('DELETE FROM decision WHERE workspace_id = ?1 AND id = ?2')
          .bind(ws, d.id)
          .run(),
      ),
    ).toContain('decision_append_only');
    expect(await errorOf(env.DB.prepare('DELETE FROM decision').run())).toContain(
      'decision_append_only',
    );
  });

  test('a second decision on the same fingerprint supersedes; both rows are kept', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const quote = 'Each Investor must complete Part C.';
    const a = await decide(h, s, { runId: run, quote, decision: 'accepted' });
    const b = await decide(h, s, { runId: run, quote, reason: 'no_form_impact' });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const rows = await env.DB.prepare(
      'SELECT id, status, superseded_by_id, supersedes_id FROM decision WHERE workspace_id = ?1 AND id IN (?2, ?3) ORDER BY decided_at',
    )
      .bind(s.workspaceId, a.body.decision.id, b.body.decision.id)
      .all<{
        id: string;
        status: string;
        superseded_by_id: string | null;
        supersedes_id: string | null;
      }>();
    expect(rows.results).toEqual([
      {
        id: a.body.decision.id,
        status: 'superseded',
        superseded_by_id: b.body.decision.id,
        supersedes_id: null,
      },
      {
        id: b.body.decision.id,
        status: 'active',
        superseded_by_id: null,
        supersedes_id: a.body.decision.id,
      },
    ]);
  });
});
