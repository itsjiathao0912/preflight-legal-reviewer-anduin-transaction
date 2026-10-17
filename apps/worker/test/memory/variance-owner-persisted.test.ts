// AC-V11 (persistence): owner and owner_source are stored at ask time with zero extra rows; no new
// write path and no new audit action (the question route writes no audit row today).
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { makeMem, session } from './memory-harness';
import { askQuestion } from './variance-harness';

const ownerOf = (ws: string, id: string) =>
  env.DB.prepare(
    'SELECT owner, owner_source FROM counsel_question WHERE workspace_id = ?1 AND id = ?2',
  )
    .bind(ws, id)
    .first<{ owner: string | null; owner_source: string | null }>();

describe('variance-owner-persisted (AC-V11)', () => {
  test('should persist owner and owner_source at ask time with zero extra rows', async () => {
    const h = makeMem();
    const s = await session(h);
    // plain question (pre-variance shape) as the row-count baseline
    const run = (await askQuestion(h, s)).runId;
    h.resetStats();
    const plain = await askQuestion(h, s, { runId: run });
    const plainRows = h.stats.rowsWritten;
    expect(plain.status).toBe(200);
    h.resetStats();
    const owned = await askQuestion(h, s, {
      runId: run,
      extra: { owner: 'gp', owner_source: 'override' },
    });
    expect(owned.status).toBe(200);
    expect(h.stats.rowsWritten).toBe(plainRows);
    expect(await ownerOf(s.workspaceId, owned.questionId)).toEqual({
      owner: 'gp',
      owner_source: 'override',
    });
    expect(await ownerOf(s.workspaceId, plain.questionId)).toEqual({
      owner: null,
      owner_source: null,
    });
  });

  test('owner without owner_source is stored as suggested', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s, { extra: { owner: 'fund_admin' } });
    expect(q.status).toBe(200);
    expect(await ownerOf(s.workspaceId, q.questionId)).toEqual({
      owner: 'fund_admin',
      owner_source: 'suggested',
    });
  });

  test('an unknown owner or owner_source is refused with invalid_request', async () => {
    const h = makeMem();
    const s = await session(h);
    for (const extra of [{ owner: 'lawyer' }, { owner: 'gp', owner_source: 'guessed' }]) {
      const q = await askQuestion(h, s, { extra });
      expect(q.status, JSON.stringify(extra)).toBe(400);
      expect((q.body as { error: { code: string } }).error.code).toBe('invalid_request');
    }
  });

  test('no audit row is written for a question (no new audit action)', async () => {
    const h = makeMem();
    const s = await session(h);
    const count = () =>
      env.DB.prepare(
        "SELECT COUNT(*) AS n FROM audit_event WHERE workspace_id = ?1 AND action <> 'decision_recorded'",
      )
        .bind(s.workspaceId)
        .first<{ n: number }>();
    const before = await count();
    await askQuestion(h, s, { extra: { owner: 'counsel', owner_source: 'suggested' } });
    const after = await count();
    // the helper's accepted decision writes one decision_recorded row; nothing else is added
    expect(after?.n).toBe(before?.n);
  });
});
