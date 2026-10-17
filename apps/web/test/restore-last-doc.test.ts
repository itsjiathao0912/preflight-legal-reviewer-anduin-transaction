// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppDb, RETENTION_MS } from '../src/storage/db';
import {
  loadLastDoc,
  parseLastDoc,
  restoreLastDocument,
  saveLastDoc,
  type LastDoc,
  type RestoreDeps,
} from '../src/state/last-doc';

let db: AppDb;
let n = 0;
const NOW = Date.UTC(2026, 9, 17, 6, 0, 0);
const upload: LastDoc = {
  name: 'Tax-Forms.docx',
  firmId: null,
  firmName: '',
  fund: 'RR1',
  version: 'v1',
  source: 'upload',
  ref: 'up_abc123',
};

function deps(over: Partial<RestoreDeps> = {}): RestoreDeps & { open: ReturnType<typeof vi.fn> } {
  const open = vi.fn(async () => undefined);
  return {
    db,
    now: NOW,
    fetchBytes: async () => new Uint8Array([60, 104]),
    scanPages: async () => [{ n: 1, url: '/samples/s/p01.jpg', sourceHash: 'a'.repeat(64) }],
    isEmpty: () => true,
    open,
    ...over,
  } as RestoreDeps & { open: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  db = new AppDb(`last-doc-${++n}`);
});
afterEach(async () => {
  db.close();
  await db.delete();
});

describe('restore last document on reload', () => {
  it('round-trips the last doc meta', async () => {
    await saveLastDoc(upload, db);
    expect(await loadLastDoc(db)).toEqual(upload);
  });

  it('reopens a stored upload with its bytes and file name', async () => {
    await db.documents.put({
      id: 'up_abc123',
      name: upload.name,
      kind: 'upload',
      bytes: new Uint8Array([1, 2, 3]),
      firmId: null,
      fund: 'RR1',
      version: 'v1',
      createdAt: NOW - 1000,
    });
    await saveLastDoc(upload, db);
    const d = deps();
    expect(await restoreLastDocument(d)).toBe(true);
    expect(d.open).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), upload, {
      fileName: upload.name,
    });
  });

  it('does not reopen an expired or purged upload and forgets it', async () => {
    await db.documents.put({
      id: 'up_abc123',
      name: upload.name,
      kind: 'upload',
      bytes: new Uint8Array([1]),
      firmId: null,
      fund: 'RR1',
      version: 'v1',
      createdAt: NOW - RETENTION_MS - 1,
    });
    await saveLastDoc(upload, db);
    const d = deps();
    expect(await restoreLastDocument(d)).toBe(false);
    expect(d.open).not.toHaveBeenCalled();
    expect(await loadLastDoc(db)).toBeNull();
  });

  it('re-fetches a sample and reopens a scan sample from the manifest', async () => {
    const sample: LastDoc = { ...upload, source: 'sample', ref: '03-fund.html', sampleId: '03' };
    await saveLastDoc(sample, db);
    const fetchBytes = vi.fn(async () => new Uint8Array([9]));
    const d = deps({ fetchBytes });
    expect(await restoreLastDocument(d)).toBe(true);
    expect(fetchBytes).toHaveBeenCalledWith('/samples/03-fund.html');
    await saveLastDoc({ ...sample, ref: 'scan:09' }, db);
    const d2 = deps();
    expect(await restoreLastDocument(d2)).toBe(true);
    expect(d2.open.mock.calls[0]![2]).toMatchObject({ scan: { pages: [{ n: 1 }] } });
  });

  it('never overrides a document the analyst already opened', async () => {
    await saveLastDoc({ ...upload, source: 'sample', ref: 'x.html' }, db);
    const d = deps({ isEmpty: () => false });
    expect(await restoreLastDocument(d)).toBe(false);
    expect(d.open).not.toHaveBeenCalled();
  });

  it('rejects malformed or path-escaping rows', () => {
    expect(parseLastDoc(null)).toBeNull();
    expect(parseLastDoc({ ...upload, source: 'evil' })).toBeNull();
    expect(parseLastDoc({ ...upload, ref: '../secret' })).toBeNull();
    expect(parseLastDoc({ ...upload, ref: 'https://x.y/a' })).toBeNull();
  });
});

describe('restore a remembered fund package on reload (intake R2)', () => {
  const pkgDoc: LastDoc = { ...upload, packageId: 'pkg_0123456789abcdef0123' };

  it('keeps a valid packageId and drops an invalid one without rejecting the row', () => {
    expect(parseLastDoc(pkgDoc)?.packageId).toBe('pkg_0123456789abcdef0123');
    for (const bad of ['single:up_abc123', '../etc', 'a b', 42, '']) {
      const parsed = parseLastDoc({ ...upload, packageId: bad });
      expect(parsed).toEqual(upload);
      expect(parsed && 'packageId' in parsed).toBe(false);
    }
  });

  it('uses the package branch when restorePackage returns true', async () => {
    await saveLastDoc(pkgDoc, db);
    const restorePackage = vi.fn(async () => true);
    const d = deps({ restorePackage });
    expect(await restoreLastDocument(d)).toBe(true);
    expect(restorePackage).toHaveBeenCalledWith('pkg_0123456789abcdef0123');
    expect(d.open).not.toHaveBeenCalled();
  });

  it('falls back to the classic path when restorePackage returns false', async () => {
    await db.documents.put({
      id: 'up_abc123',
      name: upload.name,
      kind: 'upload',
      bytes: new Uint8Array([7]),
      firmId: null,
      fund: 'RR1',
      version: 'v1',
      createdAt: NOW - 1000,
    });
    await saveLastDoc(pkgDoc, db);
    const restorePackage = vi.fn(async () => false);
    const d = deps({ restorePackage });
    expect(await restoreLastDocument(d)).toBe(true);
    expect(restorePackage).toHaveBeenCalledTimes(1);
    // the classic open never carries the stale package id
    expect(d.open).toHaveBeenCalledWith(new Uint8Array([7]), upload, { fileName: upload.name });
  });

  it('does not call restorePackage when something is already open', async () => {
    await saveLastDoc(pkgDoc, db);
    const restorePackage = vi.fn(async () => true);
    expect(await restoreLastDocument(deps({ restorePackage, isEmpty: () => false }))).toBe(false);
    expect(restorePackage).not.toHaveBeenCalled();
  });
});
