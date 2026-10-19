import 'fake-indexeddb/auto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Counsel share link bug (live 03c768e0): counsel joined the Northgate demo package link but
// Findings stayed at "No document open". Root cause: the bundled draft cannot run by itself (three
// low-confidence rows unconfirmed + two subscription agreements both "To digitize"), so openDocRef
// returned false. Fix: the analyst's types/roles travel in the link fragment (`cfg`) and counsel's
// browser applies them and confirms every row. Real engine (worker module in-process), real files.
vi.mock('../src/api/client', () => ({ memoryApi: () => null, isRealMemoryApi: () => false }));
vi.mock('../src/api/base', async (orig) => ({
  ...(await orig<typeof import('../src/api/base')>()),
  apiEnabled: () => false,
}));
vi.mock('../src/engine/client', async () => {
  const { api } = await import('../src/engine/engine.worker');
  return {
    analyzeInWorker: (...a: Parameters<typeof api.analyze>) => api.analyze(...a),
    readPackageDocInWorker: (...a: Parameters<typeof api.readPackageDoc>) =>
      api.readPackageDoc(...a),
    rememberInput: () => undefined,
  };
});

const PUB = resolve(import.meta.dirname, '..', 'public');
vi.stubGlobal('fetch', async (url: string) => {
  const p = join(PUB, url);
  if (!url.startsWith('/') || !existsSync(p)) return new Response('not found', { status: 404 });
  return new Response(readFileSync(p));
});

const { openDemoPackage, runPackageDraft } =
  await import('../src/features/open-document/package-actions');
const { openDocRef, forgetDemoPackagesForTest, docRefOf } =
  await import('../src/features/open-document/doc-ref');
const { applyPackageConfig, decodePackageConfig, encodePackageConfig, packageConfigOf } =
  await import('../src/features/open-document/package-config');
const { usePackage } = await import('../src/state/package');
const { useReview } = await import('../src/state/review');
const { appDb } = await import('../src/storage/db');

const REF = 'package:northgate-iii';
const byName = (n: string) => usePackage.getState().draft!.rows.find((r) => r.name.startsWith(n))!;
const roles = () =>
  Object.fromEntries(
    (usePackage.getState().current?.docs ?? []).map((d) => [d.name, `${d.type}/${d.role}`]),
  );
const findingIds = () => (useReview.getState().result?.findings ?? []).map((f) => f.id).sort();

async function reset() {
  usePackage.getState().clear();
  useReview.setState({ doc: null, phase: 'empty', result: null });
  forgetDemoPackagesForTest();
  const db = appDb()!;
  await Promise.all([db.packages.clear(), db.documents.clear(), db.parsedModels.clear()]);
}

/** The analyst's flow on the live demo: 04 (NG2 2024) set to Baseline, every row confirmed. */
async function analystRun() {
  expect((await openDemoPackage('northgate-iii')).ok).toBe(true);
  const s = usePackage.getState();
  expect(s.setDraftField(byName('04-').id, 'role', 'baseline')).toEqual({ ok: true });
  for (const r of usePackage.getState().draft!.rows) usePackage.getState().confirmDraftRow(r.id);
  usePackage.getState().setDraftTag({ version: 'v1 final' });
  expect(usePackage.getState().draftReadiness().ok).toBe(true);
  await runPackageDraft();
  expect(useReview.getState().phase).toBe('ready');
}

beforeEach(reset);

describe('counsel share link: Northgate package opens for counsel', () => {
  it('root cause: the bundled Northgate draft is not runnable without the analyst', async () => {
    expect((await openDemoPackage('northgate-iii')).ok).toBe(true);
    const r = usePackage.getState().draftReadiness();
    expect(r.ok).toBe(false);
    const codes = r.problems.map((p) => p.code);
    expect(codes.filter((c) => c === 'low_confidence_unconfirmed')).toHaveLength(3);
    expect(codes).toContain('multiple_to_digitize');
  });

  it('opens with the analyst config: same roles, readiness ok, same finding ids', async () => {
    await analystRun();
    const analystRoles = roles();
    const analystIds = findingIds();
    const analystDoc = useReview.getState().doc!;
    expect(docRefOf(analystDoc)).toBe(REF);
    const cfg = packageConfigOf(analystDoc)!;
    expect(cfg.docs).toHaveLength(6);
    expect(cfg.version).toBe('v1 final');
    const encoded = encodePackageConfig(cfg);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(analystIds.length).toBeGreaterThan(0);

    await reset();
    // counsel's browser: a fresh tab with only the link
    expect(await openDocRef(REF, decodePackageConfig(encoded))).toBe(true);
    expect(useReview.getState().phase).toBe('ready');
    expect(roles()).toEqual(analystRoles);
    expect(roles()['04-NG2-Subscription-Agreement-2024.docx']).toBe('sub_agreement/baseline');
    expect(
      usePackage
        .getState()
        .baselineDocs()
        .map((b) => b.name),
    ).toEqual(['04-NG2-Subscription-Agreement-2024.docx']);
    expect(useReview.getState().doc?.version).toBe('v1 final');
    expect(findingIds()).toEqual(analystIds);
    // the run went through runPackageDraft: the demo ref is bound to the new package row
    expect(docRefOf(useReview.getState().doc)).toBe(REF);
  });

  it('carries a removed member and a changed type to counsel', async () => {
    expect((await openDemoPackage('northgate-iii')).ok).toBe(true);
    usePackage.getState().removeDraftRow(byName('06-').id);
    usePackage.getState().setDraftField(byName('05-').id, 'type', 'side_letter');
    usePackage.getState().setDraftField(byName('04-').id, 'role', 'reference');
    for (const r of usePackage.getState().draft!.rows) usePackage.getState().confirmDraftRow(r.id);
    await runPackageDraft();
    const want = roles();
    const enc = encodePackageConfig(packageConfigOf(useReview.getState().doc)!);
    await reset();
    expect(await openDocRef(REF, decodePackageConfig(enc))).toBe(true);
    expect(roles()).toEqual(want);
    expect(Object.keys(roles())).toHaveLength(5);
  });

  it('opens an older link without config: defaults confirmed, extra primary -> baseline', async () => {
    expect(await openDocRef(REF)).toBe(true);
    expect(useReview.getState().phase).toBe('ready');
    const r = roles();
    expect(r['01-NG3-Subscription-Agreement.docx']).toBe('sub_agreement/to_digitize');
    expect(r['04-NG2-Subscription-Agreement-2024.docx']).toBe('sub_agreement/baseline');
  });
});

describe('package config encoding', () => {
  it('round-trips and rejects malformed or hostile values', () => {
    const cfg = {
      docs: [{ h: '0123456789abcdef', t: 'lpa' as const, r: 'reference' as const }],
      version: 'v2 – final',
    };
    expect(decodePackageConfig(encodePackageConfig(cfg))).toEqual(cfg);
    const enc = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    for (const bad of [
      null,
      '',
      'not base64!',
      enc({ v: 2, d: [['0123456789abcdef', 'lpa', 'reference']] }),
      enc({ v: 1, d: [] }),
      enc({ v: 1, d: [['XYZ', 'lpa', 'reference']] }),
      enc({ v: 1, d: [['0123456789abcdef', 'script', 'reference']] }),
      enc({ v: 1, d: [['0123456789abcdef', 'lpa', 'owner']] }),
      enc({ v: 1, ver: 'x'.repeat(81), d: [['0123456789abcdef', 'lpa', 'reference']] }),
      'x'.repeat(5000),
    ])
      expect(decodePackageConfig(bad)).toBeNull();
  });

  it('applyPackageConfig is a no-op without a draft', () => {
    expect(() => applyPackageConfig(null)).not.toThrow();
  });
});
