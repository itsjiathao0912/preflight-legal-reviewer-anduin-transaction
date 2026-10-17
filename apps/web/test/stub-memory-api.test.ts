// @vitest-environment node
import 'fake-indexeddb/auto';
import { fingerprintFor, type IssueClass } from '@aduin/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryApiError } from '../src/api/memoryApi';
import { StubMemoryApi } from '../src/api/stubMemoryApi';
import { fingerprintFindings } from '../src/memory/fingerprintFindings';
import type { FindingView } from '../src/engine/types';
import { AppDb } from '../src/storage/db';

const QH = 'a'.repeat(64);
const QH2 = 'b'.repeat(64);
const finding = (id: string, qh: string, severity: 'critical' | 'medium' = 'critical') =>
  ({
    id,
    issue_class: 'broken_cross_reference' as IssueClass,
    quote_hash: qh,
    severity,
    quote: 'q',
    quote_snippet: 'q',
  }) as unknown as FindingView;

let db: AppDb;
let api: StubMemoryApi;
let n = 0;
beforeEach(() => {
  db = new AppDb(`stub-test-${++n}`);
  api = new StubMemoryApi(db, () => 1_700_000_000_000);
});
afterEach(async () => {
  db.close();
  await db.delete();
});

function base(fp: string) {
  return {
    client_op_id: 'op_12345678',
    law_firm_id: 'partners-group',
    finding_ref: 'f1',
    quote_text: 'the quote',
    fingerprint: fp,
    issue_class: 'broken_cross_reference' as IssueClass,
    fund_name: 'Fund A',
    decided_by_name: 'Linh Tran',
  };
}

describe('stub-memory-api', () => {
  it('refuses a dismissal without a reason_code', async () => {
    const fp = fingerprintFor(finding('f1', QH), 'partners-group')!;
    await expect(api.decide({ ...base(fp), decision: 'dismissed' })).rejects.toBeInstanceOf(
      MemoryApiError,
    );
    expect(await db.decisions.count()).toBe(0);
  });

  it('keeps one active decision per fingerprint, appends instead of overwriting, revokes instead of deleting', async () => {
    const fp = fingerprintFor(finding('f1', QH), 'partners-group')!;
    const a = await api.decide({ ...base(fp), decision: 'accepted' });
    const d = await api.decide({
      ...base(fp),
      decision: 'dismissed',
      reason_code: 'tool_false_alarm',
    });
    const active = await api.lookup('partners-group', [fp]);
    expect(active.map((x) => x.id)).toEqual([d.id]);
    expect((await db.decisions.get(a.id))?.status).toBe('superseded');
    await api.revoke(d.id, 'Reopened by analyst');
    expect(await api.lookup('partners-group', [fp])).toEqual([]);
    expect(await db.decisions.count()).toBe(2);
    expect((await db.decisions.get(d.id))?.status).toBe('revoked');
    await expect(api.revoke(d.id, '')).rejects.toBeInstanceOf(MemoryApiError);
  });

  it('isolates firms and validates lookup input', async () => {
    const fp = fingerprintFor(finding('f1', QH), 'partners-group')!;
    await api.decide({ ...base(fp), decision: 'accepted' });
    expect(await api.lookup('firm-x', [fp])).toEqual([]);
    await expect(api.lookup('partners-group', [])).rejects.toBeInstanceOf(MemoryApiError);
    await expect(api.lookup('partners-group', ['nothex'])).rejects.toBeInstanceOf(MemoryApiError);
  });

  it('fingerprint flow: null firm -> null fingerprints, no lookup, all new', async () => {
    let called = 0;
    const spy = { ...api, lookup: async () => (called++, []) } as unknown as StubMemoryApi;
    const r = await fingerprintFindings([finding('f1', QH)], null, spy);
    expect(r.applied).toBe(false);
    expect(r.byId.f1).toEqual({ fingerprint: null, label: 'new', prior: null });
    expect(called).toBe(0);
  });

  it('fingerprint flow: firm -> core fingerprintFor + lookup + resolveLabel', async () => {
    const f1 = finding('f1', QH, 'critical');
    const f2 = finding('f2', QH2, 'medium');
    const fp1 = fingerprintFor(f1, 'partners-group')!;
    const fp2 = fingerprintFor(f2, 'partners-group')!;
    await api.decide({ ...base(fp1), decision: 'dismissed', reason_code: 'other' });
    await api.decide({ ...base(fp2), decision: 'dismissed', reason_code: 'other' });
    const r = await fingerprintFindings([f1, f2], 'partners-group', api);
    expect(r.byId.f1?.fingerprint).toBe(fp1);
    expect(r.byId.f1?.label).toBe('dismissed_reconfirm');
    expect(r.byId.f2?.label).toBe('previously_dismissed');
    await api.answer({ ...base(fp1), counsel_option: 'A' });
    expect((await fingerprintFindings([f1], 'partners-group', api)).byId.f1?.label).toBe(
      'already_answered',
    );
  });

  it('memory errors fall back to all new with unavailable', async () => {
    const broken = {
      lookup: async () => {
        throw new Error('down');
      },
    } as unknown as StubMemoryApi;
    const r = await fingerprintFindings([finding('f1', QH)], 'partners-group', broken);
    expect(r.unavailable).toBe(true);
    expect(r.byId.f1?.label).toBe('new');
  });

  it('variance: stub stores owner, enforces the intent rule and the per-firm check cap', async () => {
    const { run_id } = await api.ensureRun({
      client_op_id: 'op_run00001',
      doc_name: 'Doc',
      doc_hash: 'c'.repeat(64),
      law_firm_id: 'partners-group',
      settings_hash: 'd'.repeat(64),
    });
    const fps: string[] = [];
    const qs: string[] = [];
    for (let i = 0; i < 21; i++) {
      const ref = `f${i}`;
      await api.storeFindings(run_id, [{ id: ref } as never]);
      const f = (i + 1).toString(16).padStart(64, '0');
      fps.push(f);
      const [q] = await api.createQuestions(run_id, [
        {
          client_op_id: `op_q${i}xxxxx`,
          finding_ref: ref,
          fingerprint: f,
          interpretations: ['A'],
          ...(i === 0 ? { owner: 'gp' as const } : {}),
        },
      ]);
      qs.push(q!.question_id);
    }
    const stored = (await db.uiState.get(`stub:question:${qs[0]}`))?.value as {
      owner?: string;
      owner_source?: string;
    };
    expect(stored).toMatchObject({ owner: 'gp', owner_source: 'suggested' });
    const ans = (i: number, extra: object) =>
      api.answer({
        client_op_id: `op_a${i}xxxxx`,
        law_firm_id: 'partners-group',
        question_id: qs[i]!,
        fingerprint: fps[i]!,
        issue_class: 'broken_cross_reference',
        counsel_option: 'A',
        decided_by_name: 'Linh Tran',
        fund_name: 'Fund I',
        ...extra,
      });
    await expect(ans(0, { scope: 'firm_template', intent: ' ' })).rejects.toMatchObject({
      reason: 'intent_required',
    });
    await expect(
      ans(0, { scope: 'fund', assertion: { kind: 'scope_exists', label: 'Appendix C' } }),
    ).rejects.toMatchObject({ reason: 'assertion_scope' });
    const withCheck = (i: number) =>
      ans(i, {
        scope: 'firm_template',
        intent: 'Standard.',
        assertion: { kind: 'scope_exists', label: `Appendix ${String.fromCharCode(65 + i)}` },
      });
    for (let i = 0; i < 20; i++) await withCheck(i);
    await expect(withCheck(20)).rejects.toMatchObject({ reason: 'regression_check_cap' });
    const r = await api.lookupWithChecks('partners-group', [fps[0]!]);
    expect(r.regression_checks).toHaveLength(20);
    expect(r.regression_checks[0]).toMatchObject({
      assertion_key: 'appendix a',
      statement_text: 'Appendix A must exist',
      source_fund_name: 'Fund I',
    });
    expect((await api.lookupWithChecks('firm-x', [fps[0]!])).regression_checks).toEqual([]);
  });

  it('variance: fingerprintFindings with a fund name ignores a fund-scoped answer of another fund', async () => {
    const { run_id } = await api.ensureRun({
      client_op_id: 'op_run00002',
      doc_name: 'Doc',
      doc_hash: 'e'.repeat(64),
      law_firm_id: 'partners-group',
      settings_hash: 'd'.repeat(64),
    });
    const f = finding('f1', QH);
    const fp = fingerprintFor(f, 'partners-group')!;
    await api.storeFindings(run_id, [{ id: 'f1' } as never]);
    const [q] = await api.createQuestions(run_id, [
      { client_op_id: 'op_q_scope1', finding_ref: 'f1', fingerprint: fp, interpretations: ['A'] },
    ]);
    await api.answer({
      client_op_id: 'op_a_scope1',
      law_firm_id: 'partners-group',
      question_id: q!.question_id,
      fingerprint: fp,
      issue_class: 'broken_cross_reference',
      counsel_option: 'A',
      decided_by_name: 'Linh Tran',
      fund_name: 'Fund A',
      scope: 'fund',
    });
    const other = await fingerprintFindings([f], 'partners-group', api, 'Fund B');
    expect(other.byId.f1).toMatchObject({ label: 'new', prior: null });
    const same = await fingerprintFindings([f], 'partners-group', api, 'Fund A');
    expect(same.byId.f1?.label).toBe('already_answered');
    const legacy = await fingerprintFindings([f], 'partners-group', api);
    expect(legacy.byId.f1?.label).toBe('already_answered');
  });
});
