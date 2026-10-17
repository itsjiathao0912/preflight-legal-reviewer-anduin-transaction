import { appDb, RETENTION_MS, type AppDb } from '../storage/db';
import type { DocMeta } from './review';

/**
 * Restore-on-reload: the last opened document (upload or sample) is remembered in Dexie uiState
 * `session:lastDoc` and reopened when the app starts. Uploads come back from the `documents` store
 * while it still holds them (24 h retention); samples are re-fetched from /samples.
 */
export const LAST_DOC_KEY = 'session:lastDoc';

export type LastDoc = Omit<DocMeta, 'id'>;

const SAFE_REF = /^[A-Za-z0-9._-]{1,120}(\/[A-Za-z0-9._-]{1,120})?$/;

/** Validate a stored row (IndexedDB content is treated as untrusted input). */
export function parseLastDoc(v: unknown): LastDoc | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const str = (k: string) => typeof o[k] === 'string';
  if (!str('name') || !str('firmName') || !str('fund') || !str('version') || !str('ref'))
    return null;
  if (o.firmId !== null && typeof o.firmId !== 'string') return null;
  if (o.source !== 'sample' && o.source !== 'upload') return null;
  if (o.sampleId !== undefined && typeof o.sampleId !== 'string') return null;
  const ref = o.ref as string;
  const plainRef = ref.startsWith('scan:') ? ref.slice(5) : ref;
  if (!SAFE_REF.test(plainRef) || plainRef.includes('..')) return null;
  return {
    name: o.name as string,
    firmId: (o.firmId as string | null) ?? null,
    firmName: o.firmName as string,
    fund: o.fund as string,
    version: o.version as string,
    source: o.source,
    ref,
    ...(typeof o.sampleId === 'string' ? { sampleId: o.sampleId } : {}),
  };
}

export async function saveLastDoc(meta: LastDoc, db: AppDb | null = appDb()): Promise<void> {
  if (!db) return;
  try {
    await db.uiState.put({ key: LAST_DOC_KEY, value: meta, updatedAt: Date.now() });
  } catch {
    /* storage unavailable: nothing to restore later */
  }
}

export async function loadLastDoc(db: AppDb | null = appDb()): Promise<LastDoc | null> {
  if (!db) return null;
  try {
    return parseLastDoc((await db.uiState.get(LAST_DOC_KEY))?.value);
  } catch {
    return null;
  }
}

async function clearLastDoc(db: AppDb): Promise<void> {
  try {
    await db.uiState.delete(LAST_DOC_KEY);
  } catch {
    /* ignore */
  }
}

export interface RestoreDeps {
  db: AppDb | null;
  now?: number;
  fetchBytes: (path: string) => Promise<Uint8Array | null>;
  /** Scan sample page list for a sample id (null when the manifest no longer has it). */
  scanPages: (sampleId: string) => Promise<{ n: number; url: string; sourceHash: string }[] | null>;
  /** Only restore while nothing else was opened. */
  isEmpty: () => boolean;
  open: (
    bytes: Uint8Array,
    meta: LastDoc,
    opts?: {
      fileName?: string;
      scan?: { pages: { n: number; url: string; sourceHash: string }[] };
    },
  ) => Promise<void>;
}

/** Reopen the remembered document. Returns true when a document was reopened. */
export async function restoreLastDocument(deps: RestoreDeps): Promise<boolean> {
  const { db } = deps;
  if (!db) return false;
  const last = await loadLastDoc(db);
  if (!last) return false;
  const now = deps.now ?? Date.now();
  if (last.source === 'upload') {
    let row;
    try {
      row = await db.documents.get(last.ref);
    } catch {
      row = undefined;
    }
    if (!row || !(row.bytes instanceof Uint8Array) || row.createdAt <= now - RETENTION_MS) {
      await clearLastDoc(db);
      return false;
    }
    if (!deps.isEmpty()) return false;
    await deps.open(row.bytes, last, { fileName: last.name });
    return true;
  }
  if (last.ref.startsWith('scan:')) {
    const pages = await deps.scanPages(last.ref.slice(5));
    if (!pages?.length || !deps.isEmpty()) return false;
    await deps.open(new Uint8Array(0), last, { scan: { pages } });
    return true;
  }
  const bytes = await deps.fetchBytes(`/samples/${last.ref}`);
  if (!bytes || !deps.isEmpty()) return false;
  await deps.open(bytes, last);
  return true;
}
