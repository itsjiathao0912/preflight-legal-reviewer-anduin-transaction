import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Variance D-S0-1: readPackageMemberSource (additive pure accessor on the Intake package store).
// Same harness as package-store.test.ts (engine client delegates to the real worker module).
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

const { usePackage, readPackageMemberSource } = await import('../src/state/package');
const { appDb } = await import('../src/storage/db');
const { useSession } = await import('../src/state/session');

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
const TAG = { firmId: 'firm-x', firmName: 'Firm X', fund: 'Hartwell Fund III', version: 'v1' };

async function clearDb() {
  const db = appDb()!;
  await Promise.all([db.packages.clear(), db.documents.clear(), db.uiState.clear()]);
}

async function runned() {
  const r = await usePackage.getState().prepareDraft([SUB, LPA, PRIOR], TAG);
  expect(r.ok).toBe(true);
  for (const row of usePackage.getState().draft!.rows)
    usePackage.getState().confirmDraftRow(row.id);
  await usePackage.getState().runDraft();
  return usePackage.getState().current!;
}

const settle = () => new Promise((r) => setTimeout(r, 60));
const priorId = () => usePackage.getState().current!.docs.find((d) => d.name === PRIOR.name)!.id;

/** Drop the in-memory sources but keep the current package (forces the persisted path). */
async function persistedOnly() {
  const current = usePackage.getState().current!;
  await settle();
  usePackage.getState().clear();
  usePackage.setState({ current });
  return current;
}

async function editStoredDoc(docId: string, patch: Record<string, unknown>, drop: string[] = []) {
  const db = appDb()!;
  const pkgId = usePackage.getState().current!.id;
  const row = (await db.packages.get(pkgId))!;
  const docs = row.docs.map((d) => {
    if (d.id !== docId) return d;
    const next: Record<string, unknown> = { ...d, ...patch };
    for (const k of drop) delete next[k];
    return next as unknown as typeof d;
  });
  await db.packages.put({ ...row, docs });
}

beforeEach(async () => {
  usePackage.getState().clear();
  useSession.setState({ aiOn: false });
  await clearDb();
  vi.unstubAllGlobals();
});
afterEach(async () => {
  await settle();
  vi.unstubAllGlobals();
});

describe('package-member-source', () => {
  it('reads an in-memory member source with its format and name', async () => {
    await runned();
    const r = await readPackageMemberSource(priorId());
    expect('bytes' in r && r.format).toBe('html');
    expect('bytes' in r && r.name).toBe(PRIOR.name);
    expect('bytes' in r && r.bytes.byteLength).toBe(PRIOR.bytes.byteLength);
  });

  it('reads a stored-upload member when the in-memory source is gone', async () => {
    await runned();
    const id = priorId();
    await persistedOnly();
    const r = await readPackageMemberSource(id);
    expect('bytes' in r).toBe(true);
    expect('bytes' in r && r.bytes.byteLength).toBe(PRIOR.bytes.byteLength);
  });

  it('reads a bundled sampleRef member through fetch (stubbed)', async () => {
    await runned();
    const id = priorId();
    await persistedOnly();
    await editStoredDoc(id, { sampleRef: '/samples/packages/hartwell/prior.html' }, [
      'storedDocId',
    ]);
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => {
      calls.push(String(u));
      return new Response(PRIOR.bytes.slice(), { status: 200 });
    });
    const r = await readPackageMemberSource(id);
    expect(calls).toEqual(['/samples/packages/hartwell/prior.html']);
    expect('bytes' in r && r.bytes.byteLength).toBe(PRIOR.bytes.byteLength);
  });

  it('a scan member is unavailable with reason scan', async () => {
    await runned();
    const id = priorId();
    await persistedOnly();
    await editStoredDoc(id, { sampleRef: 'scan:09' }, ['storedDocId']);
    expect(await readPackageMemberSource(id)).toEqual({ unavailable: true, reason: 'scan' });
  });

  it('a purged member and an unknown id are unavailable (missing)', async () => {
    await runned();
    const id = priorId();
    const current = await persistedOnly();
    const row = (await appDb()!.packages.get(current.id))!;
    const stored = row.docs.find((d) => d.id === id)!.storedDocId!;
    await appDb()!.documents.delete(stored);
    expect(await readPackageMemberSource(id)).toEqual({ unavailable: true, reason: 'missing' });
    expect(await readPackageMemberSource('f'.repeat(64))).toEqual({
      unavailable: true,
      reason: 'missing',
    });
  });

  it('refuses a hostile sampleRef containing ".." without fetching', async () => {
    await runned();
    const id = priorId();
    await persistedOnly();
    await editStoredDoc(id, { sampleRef: '/samples/../secret.html' }, ['storedDocId']);
    let fetched = 0;
    vi.stubGlobal('fetch', async () => {
      fetched++;
      return new Response('x', { status: 200 });
    });
    const r = await readPackageMemberSource(id);
    expect(fetched).toBe(0);
    expect('unavailable' in r).toBe(true);
  });
});
