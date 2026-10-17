import { PackageDocumentSchema, PackageFactsSchema, type PackageFacts } from '@aduin/core';
import {
  appDb,
  type StoredDocument,
  type StoredPackage,
  type StoredPackageDoc,
} from '../../storage/db';

/**
 * Intake Phase 2: IndexedDB read/write for packages. Every function is soft: storage failure
 * returns null / false and the package keeps running in memory only. Never awaited before
 * findings render (callers fire and forget).
 */

/** Review Minor 6: one path segment (or `dir/file`) of safe characters; never `..`. */
const SAFE_SEGMENT = /^[A-Za-z0-9._-]{1,120}(\/[A-Za-z0-9._-]{1,120})?$/;

/** A bundled member reference: `scan:NN`, `sample:NN`, a bare `NN-name.htm` or `/samples/...`. */
export function safeSampleRef(ref: string): boolean {
  if (ref.includes('..')) return false;
  const plain = ref.startsWith('/samples/')
    ? ref.slice(9)
    : ref.startsWith('scan:') || ref.startsWith('sample:')
      ? ref.slice(ref.indexOf(':') + 1)
      : ref;
  return SAFE_SEGMENT.test(plain);
}

const isStr = (v: unknown): v is string => typeof v === 'string';

/**
 * Review Minor 6: a stored package row is untrusted input. Members are checked with the core
 * PackageDocumentSchema; a bad row returns null and the caller falls back to the classic path.
 */
export function parseStoredPackage(v: unknown): StoredPackage | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.id) || !SAFE_SEGMENT.test(o.id) || o.id.includes('..')) return null;
  if (o.firmId !== null && !isStr(o.firmId)) return null;
  if (!isStr(o.firmName) || !isStr(o.fund) || !isStr(o.version) || !isStr(o.primaryDocId))
    return null;
  if (typeof o.createdAt !== 'number' || !Number.isFinite(o.createdAt)) return null;
  if (!Array.isArray(o.docs) || o.docs.length === 0 || o.docs.length > 12) return null;
  const ct = o.confirmedTargets;
  if (!ct || typeof ct !== 'object' || Array.isArray(ct)) return null;
  if (!Object.values(ct).every(isStr)) return null;
  const docs: StoredPackageDoc[] = [];
  for (const raw of o.docs as unknown[]) {
    if (!raw || typeof raw !== 'object') return null;
    const { storedDocId, sampleRef, ...rest } = raw as Record<string, unknown>;
    const parsed = PackageDocumentSchema.safeParse({ ...rest, titleLines: [] });
    if (!parsed.success) return null;
    if (storedDocId !== undefined && (!isStr(storedDocId) || !SAFE_SEGMENT.test(storedDocId)))
      return null;
    if (sampleRef !== undefined && (!isStr(sampleRef) || !safeSampleRef(sampleRef))) return null;
    const { titleLines, ...doc } = parsed.data;
    void titleLines;
    docs.push({
      ...doc,
      ...(isStr(storedDocId) ? { storedDocId } : {}),
      ...(isStr(sampleRef) ? { sampleRef } : {}),
    });
  }
  if (!docs.some((d) => d.id === o.primaryDocId)) return null;
  return {
    id: o.id,
    firmId: o.firmId as string | null,
    firmName: o.firmName,
    fund: o.fund,
    version: o.version,
    createdAt: o.createdAt,
    primaryDocId: o.primaryDocId,
    docs,
    confirmedTargets: { ...(ct as Record<string, string>) },
  };
}

/** Light-read facts cache key (the bare hash is the review store's parsedModels key). */
export const factsKey = (hash: string) => `pkgfacts:${hash}`;

export async function writePackage(row: StoredPackage): Promise<boolean> {
  const db = appDb();
  if (!db) return false;
  try {
    await db.packages.put(row);
    return true;
  } catch {
    return false;
  }
}

export async function writeMemberDocument(doc: StoredDocument): Promise<boolean> {
  const db = appDb();
  if (!db) return false;
  try {
    await db.documents.put(doc);
    return true;
  } catch {
    return false;
  }
}

export async function writeFacts(facts: PackageFacts): Promise<void> {
  const db = appDb();
  if (!db) return;
  try {
    await db.parsedModels.put({
      docHash: factsKey(facts.contentHash),
      createdAt: Date.now(),
      model: facts,
    });
  } catch {
    /* soft */
  }
}

export async function readFacts(hash: string): Promise<PackageFacts | null> {
  const db = appDb();
  if (!db) return null;
  try {
    const row = await db.parsedModels.get(factsKey(hash));
    const parsed = PackageFactsSchema.safeParse(row?.model);
    return parsed.success && parsed.data.contentHash === hash ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function readPackage(id: string): Promise<StoredPackage | null> {
  const db = appDb();
  if (!db) return null;
  try {
    return parseStoredPackage(await db.packages.get(id));
  } catch {
    return null;
  }
}

export async function readMemberBytes(storedDocId: string): Promise<Uint8Array | null> {
  const db = appDb();
  if (!db) return null;
  try {
    return (await db.documents.get(storedDocId))?.bytes ?? null;
  } catch {
    return null;
  }
}

/** Stored packages, newest first (24 h retention applies). */
export async function listPackages(): Promise<StoredPackage[]> {
  const db = appDb();
  if (!db) return [];
  try {
    const rows = await db.packages.orderBy('createdAt').reverse().toArray();
    return rows
      .map(parseStoredPackage)
      .filter((r): r is StoredPackage => r !== null)
      .slice(0, 10);
  } catch {
    return [];
  }
}

/**
 * Newest stored uploads (baseline candidates; caller still applies eligibleBaselines). Review
 * Minor 5: with `firmId` given, rows of other firms are filtered out BEFORE the limit, so a busy
 * other firm never pushes this firm's earlier documents out of the window.
 */
export async function listUploads(limit = 50, firmId?: string | null): Promise<StoredDocument[]> {
  const db = appDb();
  if (!db) return [];
  try {
    return await db.documents
      .orderBy('createdAt')
      .reverse()
      .filter(
        (r) =>
          r.kind === 'upload' && (firmId === undefined || r.firmId === null || r.firmId === firmId),
      )
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
}

export async function readUpload(id: string): Promise<StoredDocument | null> {
  const db = appDb();
  if (!db) return null;
  try {
    return (await db.documents.get(id)) ?? null;
  } catch {
    return null;
  }
}
