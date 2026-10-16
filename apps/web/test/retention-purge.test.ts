// @vitest-environment node
import 'fake-indexeddb/auto';
import { fingerprintFor, limits } from '@aduin/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StubMemoryApi } from '../src/api/stubMemoryApi';
import {
  allowanceLeft,
  AppDb,
  purgeExpired,
  RETENTION_MS,
  spendAllowance,
} from '../src/storage/db';

const T0 = Date.UTC(2026, 9, 17, 6, 0, 0);
const H = 60 * 60 * 1000;
let db: AppDb;
let n = 0;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = new AppDb(`purge-test-${++n}`);
});
afterEach(async () => {
  vi.useRealTimers();
  db.close();
  await db.delete();
});

async function seedUpload(id: string) {
  await db.documents.put({
    id,
    name: `${id}.htm`,
    kind: 'upload',
    bytes: new Uint8Array([60]),
    firmId: null,
    fund: 'F',
    version: 'v1',
    createdAt: Date.now(),
  });
  await db.parsedModels.put({ docHash: `h-${id}`, createdAt: Date.now(), model: {} });
  await db.drafts.put({ id: `d-${id}`, createdAt: Date.now(), value: {} });
}

describe('retention-purge', () => {
  it('uses the 24 h retention from core limits (D-4)', () => {
    expect(limits.browserUploadRetentionHours).toBe(24);
    expect(RETENTION_MS).toBe(limits.browserUploadRetentionHours * H);
  });

  it('keeps an upload at 23h59 and purges it at 24h; memory decisions survive', async () => {
    await seedUpload('u1');
    const api = new StubMemoryApi(db);
    const fp = fingerprintFor(
      { issue_class: 'broken_cross_reference', quote_hash: 'c'.repeat(64) },
      'partners-group',
    )!;
    await api.decide({
      client_op_id: 'op_12345678',
      law_firm_id: 'partners-group',
      finding_ref: 'f1',
      decision: 'dismissed',
      reason_code: 'firm_standard_wording',
      quote_text: 'quote',
      fingerprint: fp,
      issue_class: 'broken_cross_reference',
      fund_name: 'Fund A',
      decided_by_name: 'Linh Tran',
    });

    vi.setSystemTime(T0 + limits.browserUploadRetentionHours * H - 60_000);
    expect(await purgeExpired(db, Date.now())).toBe(0);
    expect(await db.documents.count()).toBe(1);

    vi.setSystemTime(T0 + limits.browserUploadRetentionHours * H);
    expect(await purgeExpired(db, Date.now())).toBe(3);
    expect(await db.documents.count()).toBe(0);
    expect(await db.parsedModels.count()).toBe(0);
    expect(await db.drafts.count()).toBe(0);
    expect((await api.lookup('partners-group', [fp])).length).toBe(1);
  });

  it('allowance: 3 fresh-AI documents per UTC day; resets next day', async () => {
    expect(await allowanceLeft(db)).toBe(limits.visitorAiDocsPerDay);
    expect(await spendAllowance(db)).toBe(limits.visitorAiDocsPerDay - 1);
    vi.setSystemTime(T0 + 24 * H);
    expect(await allowanceLeft(db)).toBe(limits.visitorAiDocsPerDay);
  });
});
