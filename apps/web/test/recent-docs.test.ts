// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDb, RETENTION_MS } from '../src/storage/db';
import { loadRecent, mergeRecent, RECENT_KEY, saveRecent } from '../src/state/recent-docs';
import type { DocMeta } from '../src/state/review';

let db: AppDb;
let n = 0;
const NOW = Date.UTC(2026, 9, 18, 6, 0, 0);
const base = { firmId: null, firmName: '', fund: 'F', version: 'v1' };
const sample: DocMeta = { ...base, id: 's1', name: 'S', source: 'sample', ref: '01-a.html' };
const up = (id: string, ref: string): DocMeta => ({ ...base, id, name: id, source: 'upload', ref });
const putDoc = (id: string, createdAt: number) =>
  db.documents.put({ id, bytes: new Uint8Array([1]), createdAt } as never);

beforeEach(() => {
  db = new AppDb(`recent-${++n}`);
});
afterEach(async () => {
  db.close();
  await db.delete();
});

describe('recent documents persistence', () => {
  it('keeps samples and fresh uploads, drops expired and missing uploads', async () => {
    await putDoc('up_fresh', NOW - 1000);
    await putDoc('up_old', NOW - RETENTION_MS - 1);
    await saveRecent([up('a', 'up_fresh'), up('b', 'up_old'), up('c', 'up_missing'), sample], db);
    expect((await loadRecent(db, NOW)).map((d) => d.id)).toEqual(['a', 's1']);
  });

  it('ignores malformed rows and non-array values', async () => {
    await db.uiState.put({
      key: RECENT_KEY,
      value: [null, { ...sample, id: 5 }, { ...sample, ref: '../x' }, sample, sample],
      updatedAt: NOW,
    });
    expect((await loadRecent(db, NOW)).map((d) => d.id)).toEqual(['s1']);
    await db.uiState.put({ key: RECENT_KEY, value: 'junk', updatedAt: NOW });
    expect(await loadRecent(db, NOW)).toEqual([]);
  });

  it('merge keeps current first, dedupes by id, caps at 6', () => {
    const cur = [{ ...sample, id: 'x' }];
    const stored = ['x', 'a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ ...sample, id }));
    expect(mergeRecent(cur, stored).map((d) => d.id)).toEqual(['x', 'a', 'b', 'c', 'd', 'e']);
  });
});
