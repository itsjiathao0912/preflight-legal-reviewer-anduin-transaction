import Dexie, { type Table } from 'dexie';
import { limits, type ActiveDecision } from '@aduin/core';

/**
 * Browser storage (Dexie / IndexedDB).
 * Uploads, parsed models and drafts are purged after limits.browserUploadRetentionHours (24 h, D-4).
 * Memory decisions (stub memory API) and UI state are never purged by the upload purge.
 */
export interface StoredDocument {
  id: string;
  name: string;
  kind: 'upload';
  bytes: Uint8Array;
  firmId: string | null;
  fund: string;
  version: string;
  createdAt: number;
}
export interface ParsedModel {
  docHash: string;
  createdAt: number;
  model: unknown;
}
export interface UiStateRow {
  key: string;
  value: unknown;
  updatedAt: number;
}
export interface Draft {
  id: string;
  createdAt: number;
  value: unknown;
}
export interface OutboxRow {
  seq?: number;
  createdAt: number;
  op: unknown;
}
export interface AllowanceRow {
  /** UTC day, YYYY-MM-DD. */
  day: string;
  used: number;
}
/** Stub memory decision row: the contract ActiveDecision plus the firm it belongs to (append-only). */
export interface DecisionRow extends ActiveDecision {
  law_firm_id: string;
  seq: number;
}

export class AppDb extends Dexie {
  documents!: Table<StoredDocument, string>;
  parsedModels!: Table<ParsedModel, string>;
  uiState!: Table<UiStateRow, string>;
  drafts!: Table<Draft, string>;
  outbox!: Table<OutboxRow, number>;
  allowance!: Table<AllowanceRow, string>;
  decisions!: Table<DecisionRow, string>;

  constructor(name = 'aduin-web') {
    super(name);
    this.version(1).stores({
      documents: '&id, createdAt',
      parsedModels: '&docHash, createdAt',
      uiState: '&key',
      drafts: '&id, createdAt',
      outbox: '++seq, createdAt',
      allowance: '&day',
      decisions: '&id, fingerprint, law_firm_id, status, seq',
    });
  }
}

export const RETENTION_MS = limits.browserUploadRetentionHours * 60 * 60 * 1000;

/** Outbox states purged at the retention age: terminal rows and parked (never-sent) rows (F4). */
const PURGEABLE_OUTBOX = new Set(['synced', 'rejected', 'parked']);

/**
 * Delete uploads, parsed models, drafts and finished/parked outbox rows at or past the retention
 * age. Never touches decisions or still-live outbox rows (queued / sending / retry / deferred).
 */
export async function purgeExpired(db: AppDb, now: number = Date.now()): Promise<number> {
  const cutoff = now - RETENTION_MS;
  let n = 0;
  await db.transaction('rw', [db.documents, db.parsedModels, db.drafts, db.outbox], async () => {
    n += await db.documents.where('createdAt').belowOrEqual(cutoff).delete();
    n += await db.parsedModels.where('createdAt').belowOrEqual(cutoff).delete();
    n += await db.drafts.where('createdAt').belowOrEqual(cutoff).delete();
    n += await db.outbox
      .where('createdAt')
      .belowOrEqual(cutoff)
      .filter((r) => {
        const st = (r.op as { state?: unknown } | null)?.state;
        return typeof st === 'string' && PURGEABLE_OUTBOX.has(st);
      })
      .delete();
  });
  return n;
}

export function utcDay(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Fresh-AI documents left today (display-only stub until P05/P04a wire the real quota). */
export async function allowanceLeft(db: AppDb, now: number = Date.now()): Promise<number> {
  const row = await db.allowance.get(utcDay(now));
  return Math.max(0, limits.visitorAiDocsPerDay - (row?.used ?? 0));
}

/** Count one fresh-AI document (non-cached upload with AI on). Opening a cached sample never calls this. */
export async function spendAllowance(db: AppDb, now: number = Date.now()): Promise<number> {
  const day = utcDay(now);
  await db.transaction('rw', db.allowance, async () => {
    const row = await db.allowance.get(day);
    await db.allowance.put({ day, used: (row?.used ?? 0) + 1 });
  });
  return allowanceLeft(db, now);
}

let shared: AppDb | null = null;
/** App-wide database. Returns null when IndexedDB is unavailable (callers fall back to memory-only). */
export function appDb(): AppDb | null {
  if (shared) return shared;
  try {
    if (typeof indexedDB === 'undefined') return null;
    shared = new AppDb();
    return shared;
  } catch {
    return null;
  }
}
