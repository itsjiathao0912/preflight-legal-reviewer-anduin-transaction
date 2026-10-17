// AC-V14 (server part): an answer records option, note, intent and scope; scope firm_template is
// refused without a non-blank intent (non-blank AFTER masking); an assertion needs firm_template
// (N5); intent is masked like `note` (AC58); the audit detail carries scope and the intent length,
// never the text.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { makeMem, session } from './memory-harness';
import { answer, askQuestion, withAssertion } from './variance-harness';

const code = (b: unknown) => (b as { error?: { code?: string } }).error?.code;

describe('variance-answer-intent-rule (AC-V14)', () => {
  test('should refuse a firm_template answer without a non-blank intent and refuse an assertion without firm_template', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s);
    const refused: Record<string, unknown>[] = [
      { scope: 'firm_template' },
      { scope: 'firm_template', intent: '' },
      { scope: 'firm_template', intent: '   \n\t ' },
      // passes the schema trim check, but is empty once masked (only a mask token is left)
      { scope: 'firm_template', intent: ' 021000021 ' },
      { scope: 'fund', intent: 'x', assertion: { kind: 'scope_exists', label: 'Appendix C' } },
      { intent: 'x', assertion: { kind: 'scope_exists', label: 'Appendix C' } },
      { scope: 'firm_template', intent: 'x', assertion: { kind: 'other', label: 'Appendix C' } },
      { scope: 'firm_template', intent: 'x', assertion: { kind: 'scope_exists', label: '' } },
      { scope: 'firm_template', intent: 'x'.repeat(501) },
      { scope: 'everywhere', intent: 'x' },
    ];
    for (const extra of refused) {
      const r = await answer(h, s, q, extra);
      expect(r.status, JSON.stringify(extra)).toBe(400);
      expect(code(r.body), JSON.stringify(extra)).toBe('invalid_request');
    }
    const n = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM counsel_answer WHERE workspace_id = ?1',
    )
      .bind(s.workspaceId)
      .first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  test('stores masked intent and scope on the answer and on the resulting decision', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s);
    const intent = 'Firm standard, see account 12345678 memo.';
    const r = await answer(h, s, q, { scope: 'firm_template', intent, note: 'n' });
    expect(r.status).toBe(200);
    expect(r.body.decision.scope).toBe('firm_template');
    expect(r.body.decision.intent).toBe('Firm standard, see account #5678 memo.');
    const a = await env.DB.prepare(
      'SELECT intent, scope, note, option FROM counsel_answer WHERE workspace_id = ?1 AND id = ?2',
    )
      .bind(s.workspaceId, r.body.answer_id)
      .first();
    expect(a).toEqual({
      intent: 'Firm standard, see account #5678 memo.',
      scope: 'firm_template',
      note: 'n',
      option: 'A',
    });
    const d = await env.DB.prepare(
      'SELECT intent, scope FROM decision WHERE workspace_id = ?1 AND id = ?2',
    )
      .bind(s.workspaceId, r.body.decision.id)
      .first();
    expect(d).toEqual({ intent: 'Firm standard, see account #5678 memo.', scope: 'firm_template' });
    const audit = await env.DB.prepare(
      "SELECT detail_json FROM audit_event WHERE workspace_id = ?1 AND action = 'answer_recorded'",
    )
      .bind(s.workspaceId)
      .first<{ detail_json: string }>();
    const detail = JSON.parse(audit!.detail_json);
    expect(detail.scope).toBe('firm_template');
    expect(detail.intent_len).toBe('Firm standard, see account #5678 memo.'.length);
    expect(audit!.detail_json).not.toContain('Firm standard');
    expect(audit!.detail_json).not.toContain('12345678');
  });

  test('scope fund needs no intent; no scope behaves as before (null columns)', async () => {
    const h = makeMem();
    const s = await session(h);
    const r1 = await answer(h, s, await askQuestion(h, s), { scope: 'fund' });
    expect(r1.status).toBe(200);
    expect(r1.body.decision.scope).toBe('fund');
    expect(r1.body.decision.intent).toBeUndefined();
    const r2 = await answer(h, s, await askQuestion(h, s));
    expect(r2.status).toBe(200);
    expect(r2.body.decision.scope).toBeUndefined();
    const row = await env.DB.prepare(
      'SELECT intent, scope FROM counsel_answer WHERE workspace_id = ?1 AND id = ?2',
    )
      .bind(s.workspaceId, r2.body.answer_id)
      .first();
    expect(row).toEqual({ intent: null, scope: null });
  });

  test('the assertion label is masked before it is normalized (no digit run is stored)', async () => {
    const h = makeMem();
    const s = await session(h);
    const r = await answer(h, s, await askQuestion(h, s), withAssertion('Appendix 1234567890'));
    expect(r.status).toBe(200);
    const c = await env.DB.prepare(
      'SELECT assertion_key, statement_text FROM regression_check WHERE workspace_id = ?1',
    )
      .bind(s.workspaceId)
      .first<{ assertion_key: string; statement_text: string }>();
    expect(c?.assertion_key).not.toMatch(/\d{5,}/);
    expect(c?.statement_text).not.toMatch(/\d{5,}/);
  });
});
