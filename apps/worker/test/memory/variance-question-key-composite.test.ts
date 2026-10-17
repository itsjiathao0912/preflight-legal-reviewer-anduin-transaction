// Variance Phase 04 (H2(d)): the question route accepts a composite `finding_ref`
// (`<findingId>@<owner>`). The finding row, the run and the issue class are resolved from the plain
// finding id; the composite stays the question key, so two owners of one finding give two questions.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import {
  call,
  newRun,
  op,
  session,
  makeMem,
  wireFinding,
  type MemHarness,
  type Session,
} from './memory-harness';

const FIRM = 'firm-x';

async function storedFinding(h: MemHarness, s: Session, runId: string, id: string, quote: string) {
  const w = wireFinding(FIRM, quote, { id, cls: 'ambiguity', severity: 'critical' });
  const r = await call(
    h,
    'POST',
    `/api/runs/${runId}/findings`,
    { client_op_id: op(), findings: [w] },
    { cookie: s.cookie },
  );
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return w;
}

const ask = (
  h: MemHarness,
  s: Session,
  ref: string,
  fp: string,
  extra: Record<string, unknown> = {},
) =>
  call(
    h,
    'POST',
    '/api/counsel/questions',
    {
      client_op_id: op('q'),
      finding_ref: ref,
      fingerprint: fp,
      interpretations: ['a', 'b'],
      ...extra,
    },
    { cookie: s.cookie },
  );

const row = (ws: string, id: string) =>
  env.DB.prepare(
    'SELECT review_run_id, finding_key, issue_class, owner, owner_source FROM counsel_question WHERE workspace_id = ?1 AND id = ?2',
  )
    .bind(ws, id)
    .first<{
      review_run_id: string;
      finding_key: string;
      issue_class: string;
      owner: string | null;
      owner_source: string | null;
    }>();

describe('variance-question-key-composite (H2(d))', () => {
  test("should create a question from a composite finding_ref on the finding's own run with the right issue class", async () => {
    const h = makeMem();
    const s = await session(h);
    const runA = await newRun(h, s, FIRM, 'Fund II');
    const fid = `f_${'a'.repeat(32)}`;
    const w = await storedFinding(h, s, runA, fid, `Composite quote ${Math.random()}.`);
    // a later run in the same workspace: the composite must not fall back to it
    await newRun(h, s, FIRM, 'Fund III');
    const q = await ask(h, s, `${fid}@gp`, w.fingerprint, {
      owner: 'gp',
      owner_source: 'override',
    });
    expect(q.status, JSON.stringify(q.body)).toBe(200);
    const r = await row(s.workspaceId, q.body.question_id);
    expect(r).toEqual({
      review_run_id: runA,
      finding_key: `${fid}@gp`,
      issue_class: 'ambiguity',
      owner: 'gp',
      owner_source: 'override',
    });
  });

  test('two owners of one finding give two questions with different ids', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s, FIRM, 'Fund II');
    const fid = `f_${'b'.repeat(32)}`;
    const w = await storedFinding(h, s, run, fid, `Two owner quote ${Math.random()}.`);
    const gp = await ask(h, s, `${fid}@gp`, w.fingerprint, { owner: 'gp' });
    const counsel = await ask(h, s, `${fid}@counsel`, w.fingerprint, { owner: 'counsel' });
    expect(gp.status).toBe(200);
    expect(counsel.status).toBe(200);
    expect(gp.body.question_id).not.toBe(counsel.body.question_id);
    // idempotent per (run, composite key)
    const again = await ask(h, s, `${fid}@gp`, w.fingerprint, { owner: 'gp' });
    expect(again.body.question_id).toBe(gp.body.question_id);
  });

  test('a plain ref is unchanged', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s, FIRM, 'Fund II');
    const fid = `f_${'c'.repeat(32)}`;
    const w = await storedFinding(h, s, run, fid, `Plain quote ${Math.random()}.`);
    const q = await ask(h, s, fid, w.fingerprint);
    expect(q.status).toBe(200);
    const r = await row(s.workspaceId, q.body.question_id);
    expect(r?.finding_key).toBe(fid);
    expect(r?.review_run_id).toBe(run);
    expect(r?.owner).toBeNull();
  });

  test('a ref with @ and an unknown suffix is treated as plain (refused by the id charset, as before)', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s, FIRM, 'Fund II');
    const fid = `f_${'d'.repeat(32)}`;
    const w = await storedFinding(h, s, run, fid, `Odd quote ${Math.random()}.`);
    for (const ref of [`${fid}@lawyer`, `${fid}@`, `@gp`, `${fid}@gp@gp`]) {
      const q = await ask(h, s, ref, w.fingerprint);
      expect(q.status, ref).toBe(400);
      expect(q.body.error.reason, ref).toBe('id_charset');
    }
    // a composite never loosens other routes: decisions still refuse "@"
    const d = await call(
      h,
      'POST',
      '/api/decisions',
      {
        client_op_id: op('d'),
        run_id: run,
        finding_ref: `${fid}@gp`,
        decision: 'accepted',
        quote_text: 'x',
        fingerprint: w.fingerprint,
        issue_class: 'ambiguity',
      },
      { cookie: s.cookie },
    );
    expect(d.status).toBe(400);
    expect(d.body.error.reason).toBe('id_charset');
  });
  test('a body owner that differs from the key suffix is refused; an absent body owner takes the suffix', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s, FIRM, 'Fund II');
    const fid = `f_${'e'.repeat(32)}`;
    const w = await storedFinding(h, s, run, fid, `Mismatch quote ${Math.random()}.`);
    const bad = await ask(h, s, `${fid}@gp`, w.fingerprint, { owner: 'counsel' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.reason).toBe('owner_key_mismatch');
    const ok = await ask(h, s, `${fid}@fund_admin`, w.fingerprint);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const r = await row(s.workspaceId, ok.body.question_id);
    expect(r?.owner).toBe('fund_admin');
    expect(r?.owner_source).toBe('suggested');
  });
});
