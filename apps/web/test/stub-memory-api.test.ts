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
});
