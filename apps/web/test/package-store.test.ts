import 'fake-indexeddb/auto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Intake Phase 2 (D5/D6): usePackage store. Harness (E9): engine client and AI lane mocked like
// turnstile-no-block; the engine client delegates to the real worker module so facts are real.
const h = vi.hoisted(() => ({
  aiRunFresh: 0,
  aiOnOpen: 0,
  spend: 0,
  analyzeGate: null as Promise<void> | null,
  /** docHash the mocked AI lane holds (null = fresh page, e.g. after a reload) */
  held: null as string | null,
  reopenKept: 0,
}));
vi.mock('../src/api/client', () => ({ memoryApi: () => null, isRealMemoryApi: () => false }));
vi.mock('../src/api/base', async (orig) => ({
  ...(await orig<typeof import('../src/api/base')>()),
  apiEnabled: () => false,
}));
vi.mock('../src/engine/client', async () => {
  const { api } = await import('../src/engine/engine.worker');
  return {
    analyzeInWorker: async (...a: Parameters<typeof api.analyze>) => {
      if (h.analyzeGate) await h.analyzeGate;
      return api.analyze(...a);
    },
    readPackageDocInWorker: (...a: Parameters<typeof api.readPackageDoc>) =>
      api.readPackageDoc(...a),
    rememberInput: () => undefined,
  };
});
vi.mock('../src/features/ai/ai-lane', async () => {
  const { useSession } = await import('../src/state/session');
  return {
    aiBeginOpen: () => {
      h.held = null;
    },
    aiHolds: (docHash: string | null | undefined) => !!docHash && docHash === h.held,
    aiReopen: (_b: Uint8Array, result: { docHash: string }) => {
      if (result.docHash !== h.held) return null;
      h.reopenKept++;
      return { findings: [], fresh: false };
    },
    aiOnOpen: async (_b: Uint8Array, result: { docHash: string }) => {
      h.held = result.docHash;
      h.aiOnOpen++;
      return { findings: [], fresh: useSession.getState().aiOn };
    },
    aiRunFresh: async () => {
      h.aiRunFresh++;
    },
    setAiSink: () => undefined,
  };
});
vi.mock('../src/storage/db', async (orig) => {
  const real = await orig<typeof import('../src/storage/db')>();
  return {
    ...real,
    spendAllowance: async (...a: Parameters<typeof real.spendAllowance>) => {
      h.spend++;
      return real.spendAllowance(...a);
    },
  };
});

const { usePackage, NO_SUB_LINE, UNREADABLE_REASON, packageSourceCount } =
  await import('../src/state/package');
const persist = await import('../src/features/package/package-persist');
const { useReview } = await import('../src/state/review');
const { useSession } = await import('../src/state/session');
const { appDb } = await import('../src/storage/db');

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const read = (...p: string[]) => new Uint8Array(readFileSync(join(ROOT, ...p)));
const HART = ['fixtures', 'package', 'hartwell'];
const SUB = {
  name: 'fund-iii-subscription-agreement.html',
  bytes: read(...HART, 'fund-iii-subscription-agreement.html'),
};
const LPA = {
  name: 'northgate-lpa-definitions.docx',
  bytes: read(...HART, 'northgate-lpa-definitions.docx'),
};
const PRIOR = {
  name: 'fund-ii-subscription-agreement-prior.html',
  bytes: read(...HART, 'fund-ii-subscription-agreement-prior.html'),
};
const TAG = { firmId: null, firmName: '', fund: 'Hartwell Fund III', version: 'v1' };

async function clearDb() {
  const db = appDb()!;
  await Promise.all([
    db.packages.clear(),
    db.documents.clear(),
    db.parsedModels.clear(),
    db.uiState.clear(),
    db.allowance.clear(),
  ]);
}

async function ready3() {
  const r = await usePackage.getState().prepareDraft([SUB, LPA, PRIOR], TAG);
  expect(r.ok).toBe(true);
  const d = usePackage.getState().draft!;
  for (const row of d.rows) usePackage.getState().confirmDraftRow(row.id);
  return usePackage.getState().draft!;
}

async function runned() {
  await ready3();
  expect(usePackage.getState().draftReadiness().ok).toBe(true);
  await usePackage.getState().runDraft();
  return usePackage.getState().current!;
}

const settle = () => new Promise((r) => setTimeout(r, 30));

beforeEach(async () => {
  usePackage.getState().clear();
  h.aiRunFresh = 0;
  h.aiOnOpen = 0;
  h.spend = 0;
  h.analyzeGate = null;
  h.held = null;
  h.reopenKept = 0;
  useSession.setState({ aiOn: false });
  await clearDb();
});
afterEach(async () => {
  await settle();
});

describe('package-store: limits and draft', () => {
  it('refuses 13 files, over 40 MB total and one file over 10 MB; stores nothing', async () => {
    const tiny = (i: number) => ({ name: `f${i}.html`, bytes: new Uint8Array([60, 112, 62]) });
    const big = (n: number) => ({ name: 'big.html', bytes: new Uint8Array(n) });
    const MB = 1024 * 1024;
    const cases = [
      Array.from({ length: 13 }, (_, i) => tiny(i)),
      [big(9 * MB), big(9 * MB), big(9 * MB), big(9 * MB), big(9 * MB)],
      [big(11 * MB)],
    ];
    for (const c of cases) {
      const r = await usePackage.getState().prepareDraft(c, TAG);
      expect(r.ok).toBe(false);
      expect(usePackage.getState().draft).toBeNull();
    }
    const db = appDb()!;
    for (const t of [db.packages, db.documents, db.parsedModels, db.drafts, db.outbox])
      expect(await t.count()).toBe(0);
  });

  it('collapses duplicates by content hash with a notice', async () => {
    await usePackage.getState().prepareDraft([SUB, { ...SUB, name: 'copy.html' }, LPA], TAG);
    const d = usePackage.getState().draft!;
    expect(d.rows).toHaveLength(2);
    expect(d.notice).toMatch(/1 duplicate file was removed/);
  });

  it('readiness: low rows hold the run; two subs; no sub agreement', async () => {
    await usePackage.getState().prepareDraft([SUB, PRIOR], TAG);
    let d = usePackage.getState().draft!;
    expect(d.rows.some((r) => r.confidence === 'low')).toBe(true);
    expect(usePackage.getState().draftReadiness().ok).toBe(false);
    // edit the prior one to baseline (edit confirms) and confirm the other
    const prior = d.rows.find((r) => r.name === PRIOR.name)!;
    const sub = d.rows.find((r) => r.name === SUB.name)!;
    expect(usePackage.getState().setDraftField(prior.id, 'role', 'baseline')).toEqual({ ok: true });
    usePackage.getState().confirmDraftRow(sub.id);
    usePackage.getState().setDraftField(sub.id, 'role', 'to_digitize');
    d = usePackage.getState().draft!;
    expect(d.rows.find((r) => r.id === prior.id)).toMatchObject({
      confirmed: true,
      suggestionSource: 'analyst',
    });
    expect(usePackage.getState().draftReadiness().ok).toBe(true);

    await usePackage.getState().prepareDraft([LPA], TAG);
    const r = usePackage.getState().draftReadiness();
    expect(r.ok).toBe(false);
    expect(r.noSubAgreement).toBe(true);
    expect(NO_SUB_LINE).toBe('No subscription agreement in this package. Checks need one.');
  });

  it('version label is required for a package', async () => {
    await usePackage.getState().prepareDraft([SUB, LPA], { ...TAG, version: '' });
    for (const row of usePackage.getState().draft!.rows)
      usePackage.getState().confirmDraftRow(row.id);
    expect(usePackage.getState().draftReadiness()).toMatchObject({
      ok: false,
      versionMissing: true,
    });
    usePackage.getState().setDraftTag({ version: 'v2' });
    expect(usePackage.getState().draftReadiness().ok).toBe(true);
  });

  it('an unreadable member is other/low with the fixed reason; removal re-checks readiness', async () => {
    const bad = { name: 'broken.docx', bytes: new Uint8Array([1, 2, 3, 4]) };
    await usePackage.getState().prepareDraft([SUB, bad], TAG);
    const row = usePackage.getState().draft!.rows.find((r) => r.name === 'broken.docx')!;
    expect(row).toMatchObject({ type: 'other', confidence: 'low', reason: UNREADABLE_REASON });
    expect(usePackage.getState().draftReadiness().ok).toBe(false);
    usePackage.getState().removeDraftRow(row.id);
    for (const r of usePackage.getState().draft!.rows) usePackage.getState().confirmDraftRow(r.id);
    expect(usePackage.getState().draftReadiness().ok).toBe(true);
  });
});

describe('package-store: run, guards, restore', () => {
  it('render first: the review phase is ready before package analysis fills; persistence never awaited', async () => {
    const db = appDb()!;
    const put = vi
      .spyOn(db.packages, 'put')
      .mockImplementation(() => new Promise(() => undefined) as never);
    await ready3();
    const order: string[] = [];
    const un = useReview.subscribe((s) => {
      if (s.phase === 'ready' && !order.includes('ready'))
        order.push(usePackage.getState().primary ? 'ready-after-analysis' : 'ready');
    });
    await usePackage.getState().runDraft();
    un();
    expect(order[0]).toBe('ready');
    expect(useReview.getState().phase).toBe('ready');
    expect(usePackage.getState().primary).not.toBeNull();
    expect(usePackage.getState().analysis?.schema).toBe('package-analysis.v1');
    await settle();
    expect(put).toHaveBeenCalled(); // started, never resolved, never blocked findings
    put.mockRestore();
  });

  it('package definitions suppress the LPA-defined offering noun in the primary run', async () => {
    await runned();
    const used = useReview
      .getState()
      .result!.findings.filter((f) => f.detector_id === 'undefined-term')
      .map((f) => f.detail.facts.used_term);
    expect(used).not.toContain('Units');
    expect(usePackage.getState().primary?.suppressed.map((s) => s.term)).toContain('Units');
    expect(useReview.getState().doc?.packageId).toBe(usePackage.getState().current!.id);
  });

  it('role and type guards: primary_locked, role_not_allowed, unknown_doc', async () => {
    const c = await runned();
    const lpa = c.docs.find((d) => d.type === 'lpa')!;
    const s = usePackage.getState();
    expect(s.setRole(c.primaryDocId, 'reference')).toEqual({ ok: false, reason: 'primary_locked' });
    expect(s.setType(c.primaryDocId, 'other')).toEqual({ ok: false, reason: 'primary_locked' });
    expect(s.setRole(lpa.id, 'to_digitize')).toEqual({ ok: false, reason: 'role_not_allowed' });
    expect(s.setRole(lpa.id, 'baseline')).toEqual({ ok: false, reason: 'role_not_allowed' });
    expect(s.setRole('f'.repeat(64), 'reference')).toEqual({ ok: false, reason: 'unknown_doc' });
    expect(s.baselineDocs().map((b) => b.name)).toEqual([PRIOR.name]);
  });

  it('cross-firm: an earlier document of another firm is never offered and never accepted', async () => {
    const db = appDb()!;
    await db.documents.put({
      id: 'up_other',
      name: PRIOR.name,
      kind: 'upload',
      bytes: PRIOR.bytes,
      firmId: 'firm-b',
      fund: 'F',
      version: 'v1',
      createdAt: Date.now(),
    });
    await db.documents.put({
      id: 'up_same',
      name: PRIOR.name,
      kind: 'upload',
      bytes: PRIOR.bytes,
      firmId: 'firm-a',
      fund: 'F',
      version: 'v1',
      createdAt: Date.now() - 1000,
    });
    await usePackage
      .getState()
      .prepareDraft([SUB, LPA], { ...TAG, firmId: 'firm-a', firmName: 'A' });
    const d = usePackage.getState().draft!;
    expect(d.earlier.map((e) => e.docId)).toEqual(['up_same']);
    expect(await usePackage.getState().addEarlierDocument('up_other')).toEqual({
      ok: false,
      reason: 'cross_firm',
    });
    expect(await usePackage.getState().addEarlierDocument('up_same')).toEqual({ ok: true });
    const added = usePackage.getState().draft!.rows.find((r) => r.role === 'baseline');
    expect(added).toMatchObject({ name: PRIOR.name, confirmed: true });
  });

  it('restore keeps corrections and confirmedTargets', async () => {
    const c = await runned();
    const prior = c.docs.find((d) => d.name === PRIOR.name)!;
    expect(usePackage.getState().setType(prior.id, 'other')).toEqual({ ok: true });
    usePackage.getState().confirmTarget('ppm', 'none');
    await settle();
    await vi.waitFor(async () => {
      const row = await appDb()!.packages.get(c.id);
      expect(row?.confirmedTargets).toEqual({ ppm: 'none' });
    });
    usePackage.getState().clear();
    expect(await usePackage.getState().restore(c.id)).toBe(true);
    const r = usePackage.getState().current!;
    expect(r.docs.find((d) => d.id === prior.id)).toMatchObject({
      type: 'other',
      confirmed: true,
      suggestionSource: 'analyst',
    });
    expect(r.confirmedTargets).toEqual({ ppm: 'none' });
    expect(useReview.getState().doc?.packageId).toBe(c.id);
  });

  it('a superseded run writes nothing', async () => {
    await ready3();
    let release!: () => void;
    h.analyzeGate = new Promise<void>((r) => (release = r));
    const run = usePackage.getState().runDraft();
    usePackage.getState().clear();
    release();
    await run;
    await settle();
    expect(usePackage.getState().current).toBeNull();
    expect(usePackage.getState().primary).toBeNull();
    expect(await appDb()!.packages.count()).toBe(0);
  });
});

describe('package-store: AI lane and allowance (S4, E10)', () => {
  it('a package re-open sets reopen and never calls aiRunFresh; one allowance per package run', async () => {
    useSession.setState({ aiOn: true });
    const c = await runned();
    expect(h.aiRunFresh).toBe(1);
    expect(h.spend).toBe(1);
    const open = vi.spyOn(useReview.getState(), 'openDocument');
    useReview.setState({ openDocument: open });
    const lpa = c.docs.find((d) => d.type === 'lpa')!;
    usePackage.getState().setType(lpa.id, 'other'); // definition sources change -> re-open
    await vi.waitFor(() => expect(usePackage.getState().refreshing).toBe(false));
    await vi.waitFor(() => expect(open).toHaveBeenCalled());
    expect(open.mock.calls.at(-1)?.[2]?.package?.reopen).toBe(true);
    await settle();
    expect(h.aiRunFresh).toBe(1);
    expect(h.spend).toBe(1);
    // restore is a re-open as well
    usePackage.getState().clear();
    await usePackage.getState().restore(c.id);
    expect(open.mock.calls.at(-1)?.[2]?.package?.reopen).toBe(true);
    await settle();
    expect(h.aiRunFresh).toBe(1);
    expect(h.spend).toBe(1);
    expect(h.reopenKept).toBe(2); // both re-opens kept the lane (no abort, no reset)
    open.mockRestore();
  });

  it('review Major 1: a restore after reload (lane holds nothing) starts AI like a classic restore', async () => {
    useSession.setState({ aiOn: true });
    const c = await runned();
    expect(h.aiRunFresh).toBe(1);
    usePackage.getState().clear();
    h.held = null; // a reload: the lane state is gone
    expect(await usePackage.getState().restore(c.id)).toBe(true);
    await settle();
    // never stuck on "pending": the classic path runs the lookup and one fresh call (server cache)
    expect(h.aiRunFresh).toBe(2);
    expect(h.reopenKept).toBe(0);
    expect(h.spend).toBe(1); // allowance count unchanged: one per package run
  });

  it('with AI off the package flow never starts the AI lane or spends an allowance', async () => {
    useSession.setState({ aiOn: false });
    await runned();
    await settle();
    expect(h.aiRunFresh).toBe(0);
    expect(h.spend).toBe(0);
  });
});

describe('package-store: classic-path corpus guard (S3)', () => {
  function walk(d: string): string[] {
    return readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  }
  async function single(name: string, bytes: Uint8Array) {
    usePackage.getState().clear();
    await useReview
      .getState()
      .openDocument(
        bytes,
        { name, ...TAG, source: 'upload', ref: 'up_x' },
        { fileName: name, packageFacts: true },
      );
    const r = useReview.getState();
    usePackage
      .getState()
      .registerSingle({ name, bytes, storedDocId: 'up_x', tag: TAG, result: r.result! });
    return usePackage.getState().current;
  }

  it('tiny snippets, hostile HTML, seeded fixtures and fund I/II/Y stay on the classic path', async () => {
    const files = [
      ...walk(join(ROOT, 'fixtures', 'html-seeded')),
      ...['fund-I.html', 'fund-II.html', 'fund-Y.html'].map((f) =>
        join(ROOT, 'fixtures', 'memory', f),
      ),
      join(ROOT, 'fixtures', 'diff', 'empty.html'),
      join(ROOT, 'fixtures', 'diff', 'single-section.html'),
    ].filter((f) => /\.html?$/.test(f));
    const inline: [string, Uint8Array][] = [
      ['a.htm', new TextEncoder().encode('<p>Hello</p>')],
      [
        'hostile.html',
        new TextEncoder().encode('<script>alert(1)</script><p onclick="x()">Hi</p>'),
      ],
      ['tagged.htm', new TextEncoder().encode('<p>Section 1. Tagged.</p>')],
    ];
    for (const [name, bytes] of [
      ...inline,
      ...files.map(
        (f) => [f.split('/').pop()!, read(f.replace(ROOT + '/', ''))] as [string, Uint8Array],
      ),
    ]) {
      expect(await single(name, bytes), name).toBeNull();
      expect(useReview.getState().doc?.packageId, name).toBeUndefined();
    }
  }, 60_000);

  it('measured: these upload fixtures are high-confidence sub agreements and become one-document packages after render', async () => {
    const pkgs = [
      ['sections-parts.html', read('packages', 'core', 'test', 'fixtures', 'sections-parts.html')],
      [
        '03-partners-group-pe-master-2019.htm',
        read('samples', 'sub-docs', 'raw', '03-partners-group-pe-master-2019.htm'),
      ],
      ['sibling-A.html', read('fixtures', 'diff', 'sibling-A.html')],
    ] as const;
    for (const [name, bytes] of pkgs) {
      const c = await single(name, bytes);
      expect(c?.docs, name).toHaveLength(1);
      expect(useReview.getState().doc?.packageId, name).toBe(c?.id);
    }
  }, 60_000);
});

describe('package-store: review fixes (Minor 3-7)', () => {
  it('Minor 3: member sources are released on clear, clearDraft and an abandoned draft', async () => {
    await usePackage.getState().prepareDraft([SUB], TAG);
    await usePackage.getState().prepareDraft([LPA], TAG); // the first draft is abandoned
    expect(packageSourceCount()).toBe(1);
    usePackage.getState().clearDraft();
    expect(packageSourceCount()).toBe(0);
    await runned();
    expect(packageSourceCount()).toBe(3);
    await usePackage.getState().prepareDraft([LPA], TAG);
    usePackage.getState().clearDraft();
    expect(packageSourceCount()).toBe(3); // the current package keeps its members
    usePackage.getState().clear();
    expect(packageSourceCount()).toBe(0);
  });

  it('Minor 4: an earlier document that is not a sub agreement cannot be added as a baseline', async () => {
    await appDb()!.documents.put({
      id: 'up_lpa',
      name: LPA.name,
      kind: 'upload',
      bytes: LPA.bytes,
      firmId: 'firm-a',
      fund: 'F',
      version: 'v1',
      createdAt: Date.now(),
    });
    await usePackage.getState().prepareDraft([SUB], { ...TAG, firmId: 'firm-a', firmName: 'A' });
    expect(usePackage.getState().draft!.earlier.map((e) => e.docId)).toEqual(['up_lpa']);
    expect(await usePackage.getState().addEarlierDocument('up_lpa')).toEqual({
      ok: false,
      reason: 'role_not_allowed',
    });
    expect(usePackage.getState().draft!.rows.some((r) => r.role === 'baseline')).toBe(false);
  });

  it("Minor 5: more than 50 newer uploads of another firm never hide this firm's earlier document", async () => {
    const db = appDb()!;
    const now = Date.now();
    await db.documents.bulkPut(
      Array.from({ length: 60 }, (_, i) => ({
        id: `up_b${i}`,
        name: `b${i}.html`,
        kind: 'upload' as const,
        bytes: new Uint8Array([1]),
        firmId: 'firm-b',
        fund: 'F',
        version: 'v1',
        createdAt: now - i,
      })),
    );
    await db.documents.put({
      id: 'up_same',
      name: PRIOR.name,
      kind: 'upload',
      bytes: PRIOR.bytes,
      firmId: 'firm-a',
      fund: 'F',
      version: 'v1',
      createdAt: now - 10_000,
    });
    const rows = await persist.listUploads(50, 'firm-a');
    expect(rows.map((r) => r.id)).toEqual(['up_same']);
    await usePackage.getState().prepareDraft([SUB], { ...TAG, firmId: 'firm-a', firmName: 'A' });
    expect(usePackage.getState().draft!.earlier.map((e) => e.docId)).toEqual(['up_same']);
  });

  it('Minor 6: invalid stored rows fail safe (restore false, list skips them); unsafe refs refused', async () => {
    const c = await runned();
    await vi.waitFor(async () => expect(await appDb()!.packages.get(c.id)).toBeTruthy());
    const good = (await appDb()!.packages.get(c.id))!;
    expect(persist.parseStoredPackage(good)).not.toBeNull();
    const demoRef = '/samples/packages/northgate-iii/01-NG3-Subscription-Agreement.docx';
    expect(
      persist.parseStoredPackage({
        ...good,
        docs: good.docs.map((d) => ({ ...d, sampleRef: demoRef })),
      }),
    ).not.toBeNull();
    const pad = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        i < good.docs.length
          ? good.docs[i]!
          : { ...good.docs[0]!, id: String(i).padStart(64, 'a') },
      );
    expect(persist.parseStoredPackage({ ...good, docs: pad(17) })).not.toBeNull();
    expect(persist.parseStoredPackage({ ...good, docs: pad(18) })).toBeNull();
    const bad = [
      { ...good, docs: [{ ...good.docs[0]!, id: '../etc' }] },
      { ...good, docs: good.docs.map((d) => ({ ...d, sampleRef: '/samples/../secret.htm' })) },
      { ...good, docs: good.docs.map((d) => ({ ...d, role: 'owner' })) },
      { ...good, primaryDocId: 'f'.repeat(64) },
      { ...good, confirmedTargets: { ppm: 7 } },
      { ...good, docs: 'x' },
    ];
    for (const b of bad) expect(persist.parseStoredPackage(b)).toBeNull();
    await appDb()!.packages.put({ ...bad[0], id: 'pkg_bad' } as never);
    usePackage.getState().clear();
    expect(await usePackage.getState().restore('pkg_bad')).toBe(false);
    expect((await usePackage.getState().listRecent()).map((r) => r.id)).toEqual([c.id]);
    expect(persist.safeSampleRef('/samples/01-a.htm')).toBe(true);
    expect(persist.safeSampleRef('scan:09')).toBe(true);
    expect(persist.safeSampleRef('/samples/../x')).toBe(false);
    expect(persist.safeSampleRef('a/b/c')).toBe(false);
    expect(persist.safeSampleRef('..')).toBe(false);
    expect(
      persist.safeSampleRef('/samples/packages/northgate-iii/01-NG3-Subscription-Agreement.docx'),
    ).toBe(true);
    expect(persist.safeSampleRef('/samples/packages/x/../y')).toBe(false);
    expect(persist.safeSampleRef('/samples/packages/x/a\\b')).toBe(false);
    expect(persist.safeSampleRef('/samples/packages/x/y/z')).toBe(false);
    expect(persist.MAX_STORED_PACKAGE_DOCS).toBe(17);
  });

  it('Minor 7: a superseded re-open never clears refreshing while a newer re-open loads', async () => {
    const c = await runned();
    const lpa = c.docs.find((d) => d.type === 'lpa')!;
    const phases: string[] = [];
    const off = usePackage.subscribe((s, prev) => {
      if (prev.refreshing && !s.refreshing) phases.push(useReview.getState().phase);
    });
    let release!: () => void;
    h.analyzeGate = new Promise<void>((r) => (release = r));
    usePackage.getState().setType(lpa.id, 'other'); // re-open 1
    usePackage.getState().setType(lpa.id, 'lpa'); // re-open 2 (sources changed back)
    release();
    await vi.waitFor(() => expect(usePackage.getState().refreshing).toBe(false));
    await settle();
    off();
    expect(phases).toEqual(['ready']);
    expect(useReview.getState().doc?.packageId).toBe(c.id);
  });
});
