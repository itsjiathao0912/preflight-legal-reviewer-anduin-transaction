// AC50: reopen revokes the decision (kept, audited) and the finding reappears as New.
import { env } from 'cloudflare:test';
import { resolveLabel } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import {
  call,
  decide,
  fpOf,
  lookup,
  makeMem,
  newRun,
  op,
  session,
  wireFinding,
} from './memory-harness';

describe('memory-reopen-integration (AC50)', () => {
  test('dismiss -> previously dismissed; revoke -> New; history and audit kept; state reopened', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const quote = 'Reopen this dismissal please.';
    const fp = fpOf('firm-x', 'defined_term_issue', quote);
    const f = wireFinding('firm-x', quote, { id: 'fk-reopen' });
    await call(
      h,
      'POST',
      `/api/runs/${run}/findings`,
      { client_op_id: op(), findings: [f] },
      { cookie: s.cookie },
    );
    const d = await decide(h, s, { runId: run, quote, findingRef: 'fk-reopen' });
    const before = (await lookup(h, s, 'firm-x', [fp])).body.decisions[0];
    expect(
      resolveLabel(
        { severity: 'medium', issue_class: 'defined_term_issue', fingerprint: fp },
        before,
      ),
    ).toBe('previously_dismissed');
    const st1 = await env.DB.prepare(
      'SELECT status, current_decision_id FROM finding_state WHERE workspace_id = ?1 AND finding_key = ?2',
    )
      .bind(s.workspaceId, 'fk-reopen')
      .first();
    expect(st1).toEqual({ status: 'dismissed', current_decision_id: d.body.decision.id });

    const rv = await call(
      h,
      'POST',
      `/api/decisions/${d.body.decision.id}/revoke`,
      { client_op_id: op(), reason: 'undo' },
      { cookie: s.cookie },
    );
    expect(rv.status).toBe(200);
    const after = (await lookup(h, s, 'firm-x', [fp])).body.decisions;
    expect(after).toEqual([]);
    expect(
      resolveLabel(
        { severity: 'medium', issue_class: 'defined_term_issue', fingerprint: fp },
        after[0] ?? null,
      ),
    ).toBe('new');
    const row = await env.DB.prepare(
      'SELECT status, revoke_reason, revoked_by_name FROM decision WHERE workspace_id = ?1 AND id = ?2',
    )
      .bind(s.workspaceId, d.body.decision.id)
      .first();
    expect(row).toEqual({
      status: 'revoked',
      revoke_reason: 'undo',
      revoked_by_name: 'Dana (simulated analyst)',
    });
    const st2 = await env.DB.prepare(
      'SELECT status, current_decision_id FROM finding_state WHERE workspace_id = ?1 AND finding_key = ?2',
    )
      .bind(s.workspaceId, 'fk-reopen')
      .first();
    expect(st2).toEqual({ status: 'open', current_decision_id: null });
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_event WHERE workspace_id = ?1 AND action = 'decision_revoked' AND entity_id = ?2",
    )
      .bind(s.workspaceId, d.body.decision.id)
      .first<{ n: number }>();
    expect(audit!.n).toBe(1);
  });

  test('revoking a non-active decision is 409 with the current state; a superseded predecessor is not resurrected', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const quote = 'Two decisions then a reopen.';
    const a = await decide(h, s, { runId: run, quote, decision: 'accepted' });
    const b = await decide(h, s, { runId: run, quote, reason: 'tool_false_alarm' });
    const again = await call(
      h,
      'POST',
      `/api/decisions/${a.body.decision.id}/revoke`,
      { client_op_id: op(), reason: 'x' },
      { cookie: s.cookie },
    );
    expect(again.status).toBe(409);
    expect(again.body.current.id).toBe(b.body.decision.id);
    await call(
      h,
      'POST',
      `/api/decisions/${b.body.decision.id}/revoke`,
      { client_op_id: op(), reason: 'reopen' },
      { cookie: s.cookie },
    );
    expect(
      (await lookup(h, s, 'firm-x', [fpOf('firm-x', 'defined_term_issue', quote)])).body.decisions,
    ).toEqual([]);
    const twice = await call(
      h,
      'POST',
      `/api/decisions/${b.body.decision.id}/revoke`,
      { client_op_id: op(), reason: 'again' },
      { cookie: s.cookie },
    );
    expect(twice.status).toBe(409);
    expect(twice.body.current).toBeNull();
  });
});
