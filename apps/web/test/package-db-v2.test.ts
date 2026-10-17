// @vitest-environment node
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppDb, purgeExpired, RETENTION_MS, type StoredPackage } from '../src/storage/db';

// Intake Phase 2 (Step C2): additive Dexie v2 (packages table, documents.packageId) and 24 h purge.
const T0 = Date.UTC(2026, 9, 17, 6, 0, 0);
let n = 0;
let name = '';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  name = `pkg-v2-${++n}`;
});
afterEach(async () => {
  vi.useRealTimers();
  await Dexie.delete(name);
});

function pkgRow(id: string, createdAt: number): StoredPackage {
  return {
    id,
    firmId: 'firm-x',
    firmName: 'Firm X',
    fund: 'Fund III',
    version: 'v1',
    createdAt,
    primaryDocId: 'a'.repeat(64),
    docs: [],
    confirmedTargets: {},
  };
}

describe('package-db-v2', () => {
  it('a v1 database with rows opens as v2 with rows intact', async () => {
    const v1 = new Dexie(name);
    v1.version(1).stores({
      documents: '&id, createdAt',
      parsedModels: '&docHash, createdAt',
      uiState: '&key',
      drafts: '&id, createdAt',
      outbox: '++seq, createdAt',
      allowance: '&day',
      decisions: '&id, fingerprint, law_firm_id, status, seq',
    });
    await v1.table('documents').put({
      id: 'd1',
      name: 'a.htm',
      kind: 'upload',
      bytes: new Uint8Array([60]),
      firmId: null,
      fund: 'F',
      version: 'v1',
      createdAt: T0,
    });
    await v1
      .table('decisions')
      .put({ id: 'x1', fingerprint: 'f', law_firm_id: 'firm-x', status: 'open', seq: 1 });
    v1.close();

    const db = new AppDb(name);
    await db.open();
    expect(db.verno).toBe(2);
    expect((await db.documents.get('d1'))?.name).toBe('a.htm');
    expect(await db.decisions.count()).toBe(1);
    await db.packages.put(pkgRow('p1', T0));
    await db.documents.put({ ...(await db.documents.get('d1'))!, id: 'd2', packageId: 'p1' });
    expect(await db.documents.where('packageId').equals('p1').count()).toBe(1);
    db.close();
  });

  it('packages and package documents purge at the 24 h boundary; decisions and live outbox stay', async () => {
    const db = new AppDb(name);
    await db.packages.put(pkgRow('old', T0 - RETENTION_MS));
    await db.packages.put(pkgRow('fresh', T0 - RETENTION_MS + 1));
    await db.documents.put({
      id: 'm1',
      name: 'm.htm',
      kind: 'upload',
      bytes: new Uint8Array([60]),
      firmId: 'firm-x',
      fund: 'F',
      version: 'v1',
      createdAt: T0 - RETENTION_MS,
      packageId: 'old',
    });
    await db.decisions.put({
      id: 'k1',
      fingerprint: 'f',
      law_firm_id: 'firm-x',
      status: 'open',
      seq: 1,
    } as never);
    await db.outbox.put({ createdAt: T0 - RETENTION_MS, op: { state: 'queued' } });
    await purgeExpired(db, T0);
    expect((await db.packages.toArray()).map((p) => p.id)).toEqual(['fresh']);
    expect(await db.documents.count()).toBe(0);
    expect(await db.decisions.count()).toBe(1);
    expect(await db.outbox.count()).toBe(1);
    db.close();
  });
});
