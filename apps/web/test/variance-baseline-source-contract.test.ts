import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackageDocument } from '@aduin/core';

// Variance Phase 02 (AC-V1, B3): the baseline adapter is the single coupling point to Intake.
// Package role first, firm pointer second; same firm only; never its own baseline.
vi.mock('../src/api/client', () => ({ memoryApi: () => null, isRealMemoryApi: () => false }));
vi.mock('../src/features/ai/ai-lane', () => ({
  aiBeginOpen: () => undefined,
  aiHolds: () => false,
  aiReopen: () => null,
  aiOnOpen: async () => ({ findings: [], fresh: false }),
  aiRunFresh: async () => undefined,
  setAiSink: () => undefined,
}));

const bs = await import('../src/features/variance/baseline-source');
const T = await import('../src/features/variance/types');
const { usePackage } = await import('../src/state/package');
const { appDb, RETENTION_MS } = await import('../src/storage/db');
type DocMeta = import('../src/state/review').DocMeta;

const HTML = new TextEncoder().encode(
  '<html><body><h1>Subscription Agreement</h1><p>Text.</p></body></html>',
);
const NOW = Date.UTC(2026, 9, 18, 12);
const hex = (c: string) => c.repeat(64);

async function upload(id: string, firmId: string | null, createdAt: number, name = `${id}.html`) {
  await appDb()!.documents.put({
    id,
    name,
    kind: 'upload',
    bytes: HTML,
    firmId,
    fund: 'Fund',
    version: 'v1',
    createdAt,
  });
}

function doc(over: Partial<DocMeta> = {}): DocMeta {
  return {
    id: hex('d'),
    name: 'current.html',
    firmId: 'firm-x',
    firmName: 'Firm X',
    fund: 'Fund III',
    version: 'v1',
    source: 'upload',
    ref: 'up_current',
    ...over,
  };
}

function pdoc(
  id: string,
  name: string,
  role: PackageDocument['role'],
  format: PackageDocument['format'] = 'html',
): PackageDocument {
  return {
    id,
    name,
    type: 'sub_agreement',
    role,
    confidence: 'high',
    reason: 'r',
    confirmed: true,
    suggestionSource: 'rule',
    needsOcr: false,
    format,
    titleLines: [],
  };
}

/** A current package whose primary is the open document, plus its stored row (bytes by upload id). */
async function withPackage(
  firmId: string | null,
  members: PackageDocument[],
  stored: Record<string, string> = {},
) {
  const primary = pdoc(hex('d'), 'current.html', 'to_digitize');
  const docs = [primary, ...members];
  usePackage.setState({
    current: {
      id: 'pkg_test',
      tag: { firmId, firmName: 'Firm X', fund: 'Fund III', version: 'v1' },
      docs,
      primaryDocId: primary.id,
      confirmedTargets: {},
      createdAt: NOW,
    },
  });
  await appDb()!.packages.put({
    id: 'pkg_test',
    firmId,
    firmName: 'Firm X',
    fund: 'Fund III',
    version: 'v1',
    createdAt: NOW,
    primaryDocId: primary.id,
    confirmedTargets: {},
    docs: docs.map(({ titleLines: _t, ...d }) => ({
      ...d,
      ...(stored[d.id] ? { storedDocId: stored[d.id] } : {}),
    })),
  });
}

beforeEach(async () => {
  usePackage.getState().clear();
  const db = appDb()!;
  await Promise.all([db.documents.clear(), db.uiState.clear(), db.packages.clear()]);
});

describe('variance-baseline-source-contract', () => {
  it('never offers another firm or a null-firm row, even with identical text', async () => {
    await upload('up_x', 'firm-x', NOW - 1000);
    await upload('up_y', 'firm-y', NOW - 2000);
    await upload('up_null', null, NOW - 500);
    // a null-firm row whose id equals the pseudo package id still never matches
    await upload('variance:no-package', null, NOW - 400);
    const cands = await bs.pointerCandidates(doc({ firmId: 'firm-y' }), NOW);
    expect(cands.map((c) => c.docId)).toEqual(['up_y']);
    expect(cands.every((c) => c.path === 'pointer' && c.firmId === 'firm-y')).toBe(true);
    expect(await bs.listBaselineCandidates(doc({ firmId: null }))).toEqual([]);
    expect(await bs.resolveBaseline(doc({ firmId: null }), NOW)).toEqual({
      kind: 'none',
      reason: 'no_firm',
    });
    // a cross-firm pick is refused; a pointer that names another firm's row resolves to none
    expect(await bs.setBaseline(doc({ firmId: 'firm-y' }), 'up_x')).toEqual({
      ok: false,
      reason: 'cross_firm',
    });
    await appDb()!.uiState.put({
      key: T.POINTER_KEY('firm-y'),
      value: { docId: 'up_x', name: 'up_x.html', setAt: NOW },
      updatedAt: NOW,
    });
    expect((await bs.resolveBaseline(doc({ firmId: 'firm-y' }), NOW)).kind).toBe('none');
  });

  it('orders pointer candidates by core eligibleBaselines (createdAt desc, name, docId)', async () => {
    await upload('up_b', 'firm-x', NOW - 1000, 'b.html');
    await upload('up_a', 'firm-x', NOW - 1000, 'a.html');
    await upload('up_new', 'firm-x', NOW - 10, 'z.html');
    await upload('up_a2', 'firm-x', NOW - 1000, 'a.html');
    const c = await bs.pointerCandidates(doc(), NOW);
    expect(c.map((x) => x.docId)).toEqual(['up_new', 'up_a', 'up_a2', 'up_b']);
  });

  it('a document is never its own baseline (reopen and reload restore resolve to none)', async () => {
    await upload('up_current', 'firm-x', NOW - 100, 'current.html');
    expect(await bs.becomeFirmBaseline(doc())).toBe(true);
    const ptr = await bs.readPointer('firm-x');
    expect(ptr).toMatchObject({ docId: 'up_current', docHash: hex('d') });
    // reopen (same ref) and a restore through another stored copy (same content hash)
    expect(await bs.resolveBaseline(doc(), NOW)).toEqual({ kind: 'none', reason: 'self' });
    expect(await bs.resolveBaseline(doc({ ref: 'up_copy' }), NOW)).toEqual({
      kind: 'none',
      reason: 'self',
    });
    expect(await bs.pointerCandidates(doc(), NOW)).toEqual([]);
    // another document of the firm resolves to it
    const other = await bs.resolveBaseline(doc({ id: hex('e'), ref: 'up_other' }), NOW);
    expect(other.kind).toBe('ready');
    // samples and null-firm documents never become the baseline
    expect(await bs.becomeFirmBaseline(doc({ source: 'sample', ref: '05.htm' }))).toBe(false);
    expect(await bs.becomeFirmBaseline(doc({ firmId: null }))).toBe(false);
  });

  it('text gone, expired and scan baselines are unavailable with their lines', async () => {
    await appDb()!.uiState.put({
      key: T.POINTER_KEY('firm-x'),
      value: { docId: 'up_gone', name: 'gone.html', setAt: NOW },
      updatedAt: NOW,
    });
    expect(await bs.resolveBaseline(doc(), NOW)).toMatchObject({
      kind: 'unavailable',
      reason: 'missing',
    });
    await upload('up_gone', 'firm-x', NOW - RETENTION_MS - 1);
    expect(await bs.resolveBaseline(doc(), NOW)).toMatchObject({
      kind: 'unavailable',
      reason: 'missing',
    });
    expect(await bs.pointerCandidates(doc(), NOW)).toEqual([]);
    await upload('up_gone', 'firm-x', NOW - 1, 'page.jpg');
    expect(await bs.resolveBaseline(doc(), NOW)).toMatchObject({
      kind: 'unavailable',
      reason: 'scan',
    });
    expect(T.BYTES_GONE_LINE).toBe('Baseline text is no longer in the browser; add it again.');
    expect(T.SCAN_BASELINE_LINE).toBe('The baseline is a scan; add a text version.');
  });

  it('package path: one baseline by core order, the others are ignored with the exact line', async () => {
    await upload('up_b1', 'firm-x', NOW - 100, 'b-fund-ii.html');
    await withPackage(
      'firm-x',
      [pdoc(hex('b'), 'b-fund-ii.html', 'baseline'), pdoc(hex('a'), 'a-fund-i.html', 'baseline')],
      { [hex('a')]: 'up_b1' },
    );
    const r = await bs.resolveBaseline(doc(), NOW);
    // name order (no createdAt on package members; roleMarkedAt dropped, D-S0-3)
    expect(r.kind).toBe('ready');
    if (r.kind !== 'ready') return;
    expect(r.baseline).toMatchObject({ docId: hex('a'), path: 'package' });
    expect(r.ignored).toBe(1);
    expect(T.ignoredLine(r.ignored)).toBe('1 other baseline(s) ignored (one baseline per review)');
  });

  it('package path: a scan baseline is unavailable (scan); unknown firm means no baseline', async () => {
    await withPackage('firm-x', [pdoc(hex('c'), 'scan.jpg', 'baseline', 'image')]);
    expect(await bs.resolveBaseline(doc(), NOW)).toMatchObject({
      kind: 'unavailable',
      reason: 'scan',
    });
    await withPackage(null, [pdoc(hex('c'), 'b.html', 'baseline')]);
    expect(await bs.resolveBaseline(doc({ firmId: null }), NOW)).toEqual({
      kind: 'none',
      reason: 'no_firm',
    });
  });

  it('package path: choosing a baseline sets the role and returns the others to reference', async () => {
    await withPackage('firm-x', [
      pdoc(hex('b'), 'b.html', 'baseline'),
      pdoc(hex('a'), 'a.html', 'reference'),
    ]);
    expect(await bs.setBaseline(doc(), hex('a'))).toEqual({ ok: true });
    const docs = usePackage.getState().current!.docs;
    expect(docs.find((d) => d.id === hex('a'))?.role).toBe('baseline');
    expect(docs.find((d) => d.id === hex('b'))?.role).toBe('reference');
    expect(await bs.setBaseline(doc(), hex('d'))).toEqual({ ok: false, reason: 'unknown_doc' });
  });
});
