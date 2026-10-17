import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Intake Phase 2 (D5/D7): the frozen PackageView contract (S2 doc.packageId rule, refreshing,
// cleared on classic opens, memoized), E14 attachPackage.
const h = vi.hoisted(() => ({ gate: null as Promise<void> | null }));
vi.mock('../src/api/client', () => ({ memoryApi: () => null, isRealMemoryApi: () => false }));
vi.mock('../src/engine/client', async () => {
  const { api } = await import('../src/engine/engine.worker');
  return {
    analyzeInWorker: async (...a: Parameters<typeof api.analyze>) => {
      if (h.gate) await h.gate;
      return api.analyze(...a);
    },
    readPackageDocInWorker: (...a: Parameters<typeof api.readPackageDoc>) =>
      api.readPackageDoc(...a),
    rememberInput: () => undefined,
  };
});
vi.mock('../src/features/ai/ai-lane', () => ({
  aiBeginOpen: () => undefined,
  aiOnOpen: async () => ({ findings: [], fresh: false }),
  aiRunFresh: async () => undefined,
  setAiSink: () => undefined,
}));

const { usePackage } = await import('../src/state/package');
const { useReview } = await import('../src/state/review');
const { buildPackageView, usePackageView } = await import('../src/features/package/package-view');
const { openSample, openUpload, reopenRecent } =
  await import('../src/features/open-document/open-actions');

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const HART = join(ROOT, 'fixtures', 'package', 'hartwell');
const file = (n: string) => ({ name: n, bytes: new Uint8Array(readFileSync(join(HART, n))) });
const SUB = file('fund-iii-subscription-agreement.html');
const LPA = file('northgate-lpa-definitions.docx');
const PRIOR = file('fund-ii-subscription-agreement-prior.html');
const TAG = { firmId: null, firmName: '', fund: 'Hartwell Fund III', version: 'v1' };

async function run(members = [SUB, LPA, PRIOR]) {
  await usePackage.getState().prepareDraft(members, TAG);
  for (const r of usePackage.getState().draft!.rows) usePackage.getState().confirmDraftRow(r.id);
  await usePackage.getState().runDraft();
}
const viewNow = () => {
  const p = usePackage.getState();
  const r = useReview.getState();
  return buildPackageView({
    current: p.current,
    analysis: p.analysis,
    refreshing: p.refreshing,
    doc: r.doc,
    phase: r.phase,
  });
};

beforeEach(() => {
  h.gate = null;
  usePackage.getState().clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: string) =>
      String(u).includes('05-') ? new Response(SUB.bytes) : new Response(null, { status: 404 }),
    ),
  );
});

describe('package-view', () => {
  it('fills the frozen fields after a package run; identical across two builds', async () => {
    await run();
    const v = viewNow()!;
    expect(v).not.toBeNull();
    expect(Object.keys(v).sort()).toEqual(
      [
        'packageId',
        'firmId',
        'firmName',
        'fund',
        'version',
        'documents',
        'references',
        'terms',
        'coverage',
        'coverageLine',
        'coverageStatus',
        'gateReasons',
        'requests',
        'baselines',
        'refreshing',
      ].sort(),
    );
    expect(v.documents[0]).toMatchObject({ isPrimary: true, editable: false, role: 'to_digitize' });
    expect(v.documents.slice(1).every((d) => d.editable)).toBe(true);
    expect(v.coverage.map((g) => g.id)).toEqual([
      'structure_flow',
      'internal_refs',
      'defined_terms',
      'external_refs',
      'investor_paths',
    ]);
    expect(v.coverageLine).toMatch(/^Coverage: /);
    expect(v.baselines.map((b) => b.name)).toEqual([PRIOR.name]);
    expect(v.refreshing).toBe(false);
    expect(structuredClone(v)).toEqual(v);
    expect(JSON.stringify(viewNow())).toBe(JSON.stringify(v));
  });

  it('gate reasons come from core policy: a package without an LPA warns', async () => {
    await run([SUB, PRIOR]);
    const v = viewNow()!;
    expect(v.gateReasons.map((g) => [g.level, g.docType])).toContainEqual(['warn', 'lpa']);
    expect(v.gateReasons.every((g) => g.level !== 'block')).toBe(true);
  });

  it('null when doc.packageId differs or is absent (classic open of identical bytes)', async () => {
    await run();
    expect(viewNow()).not.toBeNull();
    // same bytes through the classic path: no packageId on the doc -> no package UI
    await useReview
      .getState()
      .openDocument(
        SUB.bytes,
        { name: SUB.name, ...TAG, source: 'upload', ref: 'up_c' },
        { fileName: SUB.name },
      );
    expect(useReview.getState().doc?.packageId).toBeUndefined();
    expect(viewNow()).toBeNull();
  });

  it('openSample, classic openUpload and reopenRecent without packageId clear usePackage.current', async () => {
    await run();
    await openUpload({ name: 'a.htm', bytes: new TextEncoder().encode('<p>Hello</p>') }, TAG);
    expect(usePackage.getState().current).toBeNull();
    await run();
    await openSample(
      {
        id: '05',
        file: '05-x.htm',
        title: 'S',
        firmId: null,
        fund: 'F',
        version: '1',
        kind: 'html',
        disabled: false,
      },
      [],
    );
    expect(usePackage.getState().current).toBeNull();
    expect(viewNow()).toBeNull();
    await run();
    await reopenRecent({ id: 'x', name: 'S', ...TAG, source: 'sample', ref: '05-x.htm' });
    expect(usePackage.getState().current).toBeNull();
  });

  it('non-null for a demo package whose primary is a bundled sample', async () => {
    await usePackage
      .getState()
      .prepareDraft(
        [{ name: '05-x.htm', bytes: SUB.bytes, sampleRef: '05-x.htm', sampleId: '05' }, LPA],
        TAG,
      );
    for (const r of usePackage.getState().draft!.rows) usePackage.getState().confirmDraftRow(r.id);
    await usePackage.getState().runDraft();
    expect(useReview.getState().doc?.source).toBe('sample');
    expect(viewNow()?.documents[0]?.isPrimary).toBe(true);
  });

  it('stale-while-reopen: the previous view stays non-null with refreshing true', async () => {
    await run();
    const before = viewNow()!;
    let release!: () => void;
    h.gate = new Promise<void>((r) => (release = r));
    const lpa = before.documents.find((d) => d.type === 'lpa')!;
    usePackage.getState().setType(lpa.id, 'other');
    await vi.waitFor(() => expect(useReview.getState().phase).toBe('loading'));
    const during = viewNow();
    expect(during).not.toBeNull();
    expect(during!.refreshing).toBe(true);
    expect(during!.packageId).toBe(before.packageId);
    release();
    await vi.waitFor(() => expect(usePackage.getState().refreshing).toBe(false));
    expect(viewNow()!.refreshing).toBe(false);
  });

  it('E14 attachPackage: attaches only to the open document; doc.id never changes', async () => {
    await useReview
      .getState()
      .openDocument(
        SUB.bytes,
        { name: SUB.name, ...TAG, source: 'upload', ref: 'up_a' },
        { fileName: SUB.name },
      );
    const id = useReview.getState().doc!.id;
    useReview.getState().attachPackage('0'.repeat(64), 'pkg_other');
    expect(useReview.getState().doc?.packageId).toBeUndefined();
    useReview.getState().attachPackage(id, 'pkg_one');
    expect(useReview.getState().doc).toMatchObject({ id, packageId: 'pkg_one' });
    expect(useReview.getState().recent[0]?.packageId).toBe('pkg_one');
  });

  it('usePackageView is memoized on store slices (E11)', async () => {
    await run();
    const seen: unknown[] = [];
    function Probe() {
      seen.push(usePackageView());
      return null;
    }
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const el = document.createElement('div');
    const root = createRoot(el);
    act(() => root.render(createElement(Probe)));
    act(() => root.render(createElement(Probe)));
    act(() => useReview.getState().select(null)); // unrelated slice
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).not.toBeNull();
    act(() => root.unmount());
  });
});
