import type { PackageFacts } from '@aduin/core';
import { appDb, type StoredDocument, type StoredPackage } from '../../storage/db';

/**
 * Intake Phase 2: IndexedDB read/write for packages. Every function is soft: storage failure
 * returns null / false and the package keeps running in memory only. Never awaited before
 * findings render (callers fire and forget).
 */

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
    const m = row?.model as PackageFacts | undefined;
    return m && typeof m === 'object' && m.contentHash === hash ? m : null;
  } catch {
    return null;
  }
}

export async function readPackage(id: string): Promise<StoredPackage | null> {
  const db = appDb();
  if (!db) return null;
  try {
    return (await db.packages.get(id)) ?? null;
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
    return (await db.packages.orderBy('createdAt').reverse().toArray()).slice(0, 10);
  } catch {
    return [];
  }
}

/** Newest stored uploads (baseline candidates; caller filters by firm via eligibleBaselines). */
export async function listUploads(limit = 50): Promise<StoredDocument[]> {
  const db = appDb();
  if (!db) return [];
  try {
    const rows = await db.documents.orderBy('createdAt').reverse().limit(limit).toArray();
    return rows.filter((r) => r.kind === 'upload');
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
