// The lookup is ONE query served by uq_decision_active; revoked and superseded rows never match.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { DECISION_SQL } from '../../src/memory/repo/decision';
import { lookupActive, LOOKUP_SQL } from '../../src/memory/repo/lookup';
import { decisionRow, insertDecision, mkWorkspace } from './db-fixtures';

const INDEX_RE = /SEARCH d USING (COVERING )?INDEX uq_decision_active/;

async function plan(sql: string, ...binds: unknown[]): Promise<string> {
  const r = await env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .bind(...binds)
    .all<{ detail: string }>();
  return r.results.map((x) => x.detail).join('\n');
}

describe('explain-lookup (AC43)', () => {
  test('the batch lookup plan searches uq_decision_active (COVERING allowed)', async () => {
    const ws = await mkWorkspace(env.DB);
    for (let i = 0; i < 30; i++) await insertDecision(env.DB, decisionRow(ws));
    expect(await plan(LOOKUP_SQL.lookup, ws, 'firm-x', '[]')).toMatch(INDEX_RE);
    expect(await plan(DECISION_SQL.currentActive, ws, 'firm-x', 'f')).toMatch(INDEX_RE);
  });

  test('revoked and superseded decisions never match a lookup', async () => {
    const ws = await mkWorkspace(env.DB);
    const active = decisionRow(ws);
    const revoked = decisionRow(ws, { status: 'superseded' });
    await insertDecision(env.DB, active);
    await insertDecision(env.DB, revoked);
    const got = await lookupActive(env.DB, ws, 'firm-x', [active.fingerprint, revoked.fingerprint]);
    expect(got.map((d) => d.id)).toEqual([active.id]);
    expect(await lookupActive(env.DB, ws, 'firm-y', [active.fingerprint])).toEqual([]);
  });
});
