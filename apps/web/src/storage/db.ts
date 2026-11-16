import Dexie, { type Table } from 'dexie';
import {
  limits,
  type ActiveDecision,
  type PackageConfidence,
  type PackageDocFormat,
  type PackageDocRole,
  type PackageDocType,
  type SuggestionSource,
} from '@aduin/core';

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
  /** Intake Phase 2 (additive): the package this upload belongs to. */
  packageId?: string;
}
/** Intake Phase 2: one member of a stored package (corrections included). */
export interface StoredPackageDoc {
  id: string;
  name: string;
  type: PackageDocType;
  role: PackageDocRole;
  confidence: PackageConfidence;
  reason: string;
  confirmed: boolean;
  suggestionSource: SuggestionSource;
  needsOcr: boolean;
  format: PackageDocFormat;
  /** `documents` row id holding the bytes (uploads). */
  storedDocId?: string;
  /** Bundled demo member reference instead of bytes (`sample:NN`, `scan:NN` or a public path). */
  sampleRef?: string;
}
/** Intake Phase 2: a fund package (purged with uploads at 24 h). */
export interface StoredPackage {
  id: string;
  firmId: string | null;
  firmName: string;
  fund: string;
  version: string;
  createdAt: number;
  primaryDocId: string;
  docs: StoredPackageDoc[];
  confirmedTargets: Record<string, string>;
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

/** Projects v1 role ids (advisory, client-only). */
export type ProjectRole = 'counsel' | 'analyst' | 'advisor' | 'approver';
export interface ProjectMember {
  name: string;
  /** Personal data: stays in this table only (never in the URL, logs or analytics). */
  email: string;
  role: ProjectRole;
}
export type ProjectGate = 'blocked' | 'ready' | 'not_started';
export interface ProjectSummary {
  gate: ProjectGate;
  openItems: number;
  lastActivity: number;
}
/** Projects v1: a client-only project (purged 30 days after its last update). */
export interface StoredProject {
  id: string;
  name: string;
  description: string;
  members: ProjectMember[];
  createdAt: number;
  updatedAt: number;
  docIds: string[];
  seeded?: boolean;
  /** Seeded projects: the bundled demo package opened on entry. */
  demoPackageId?: string;
  /** Static list summary shown until a real document is opened. */
  summary?: ProjectSummary;
}

/** Notifications v1: the five client-only project events. */
export type NotificationType =
  | 'answers'
  | 'member_added'
  | 'new_version'
  | 'gate_ready'
  | 'marked_ready';
/** Notifications v1: one event row (names only, never emails; read state per View-as role). */
export interface StoredNotification {
  id: string;
  dedupeKey: string;
  type: NotificationType;
  projectId: string;
  forRoles: ProjectRole[];
  actor: { name: string; role?: ProjectRole };
  /** The sentence shown in the row. */
  title: string;
  target: 'questions' | 'findings_changes';
  count?: number;
  /** answers events: the answer keys this batch covered (next batch counts only new ones). */
  answerKeys?: string[];
  createdAt: number;
  readByRole: Partial<Record<ProjectRole, number>>;
  seeded?: boolean;
}

export class AppDb extends Dexie {
  documents!: Table<StoredDocument, string>;
  parsedModels!: Table<ParsedModel, string>;
  uiState!: Table<UiStateRow, string>;
  drafts!: Table<Draft, string>;
  outbox!: Table<OutboxRow, number>;
  allowance!: Table<AllowanceRow, string>;
  decisions!: Table<DecisionRow, string>;
  packages!: Table<StoredPackage, string>;
  projects!: Table<StoredProject, string>;
  notifications!: Table<StoredNotification, string>;

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
    // Intake Phase 2 (additive): packages table and a packageId index on documents.
    this.version(2).stores({
      packages: '&id, firmId, createdAt',
      documents: '&id, createdAt, packageId',
    });
    // Projects v1 (additive): client-only projects table; existing tables untouched.
    this.version(3).stores({
      projects: '&id, updatedAt',
    });
    // Notifications v1 (additive): client-only notifications table; existing tables untouched.
    this.version(4).stores({
      notifications: '&id, &dedupeKey, projectId, createdAt',
    });
  }
}

export const RETENTION_MS = limits.browserUploadRetentionHours * 60 * 60 * 1000;

/** Outbox states purged at the retention age: terminal rows and parked (never-sent) rows (F4). */
const PURGEABLE_OUTBOX = new Set(['synced', 'rejected', 'parked']);

/**
 * Delete packages, uploads, parsed models, drafts and finished/parked outbox rows at or past the retention
 * age. Never touches decisions or still-live outbox rows (queued / sending / retry / deferred).
 */
export async function purgeExpired(db: AppDb, now: number = Date.now()): Promise<number> {
  const cutoff = now - RETENTION_MS;
  let n = 0;
  const tables = [db.documents, db.parsedModels, db.drafts, db.outbox, db.packages];
  await db.transaction('rw', tables, async () => {
    n += await db.packages.where('createdAt').belowOrEqual(cutoff).delete();
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

/** Projects live longer than uploads (separate from the 24 h purge). */
export const PROJECT_RETENTION_DAYS = 30;
export const PROJECT_RETENTION_MS = PROJECT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** Delete projects whose last update is at or past 30 days. Never touches other tables. */
export async function purgeProjectsExpired(db: AppDb, now: number = Date.now()): Promise<number> {
  const cutoff = now - PROJECT_RETENTION_MS;
  return db.projects.where('updatedAt').belowOrEqual(cutoff).delete();
}

/** Delete notifications at or past 30 days and rows whose project no longer exists. */
export async function purgeNotificationsExpired(
  db: AppDb,
  now: number = Date.now(),
): Promise<number> {
  const cutoff = now - PROJECT_RETENTION_MS;
  let n = await db.notifications.where('createdAt').belowOrEqual(cutoff).delete();
  const ids = new Set(await db.projects.toCollection().primaryKeys());
  n += await db.notifications.filter((r) => !ids.has(r.projectId)).delete();
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
