import type { FindingWire } from '@aduin/core';
import { create } from 'zustand';
import { isRealMemoryApi, memoryApi } from '../api/client';
import { MemoryApiError } from '../api/memoryApi';
import { Outbox, type OutboxDoc, type OutboxEvent } from '../api/outbox';
import { sha256Hex } from '../engine/ocr-queue';
import type { FindingView } from '../engine/types';
import { appDb } from '../storage/db';
import { cleanAnalystName, DEFAULT_ANALYST_NAME, useSession } from './session';

/**
 * Phase 08 S2: wiring between the review state and the memory write path.
 *
 * - One app-wide `Outbox` (Dexie `outbox` table) over the current `memoryApi()` (real Worker client
 *   or the Dexie stub); started once (drains on `online` / `focus`).
 * - Session bootstrap: the stored analyst name (Dexie uiState `session:analystName`, default
 *   `Linh Tran`) feeds `bootstrap(name)` before the first lookup; `read_only` comes from the session
 *   response and disables writes (the outbox is skipped).
 * - The quiet "unsynced" chip reads `useSync`.
 */
const NAME_KEY = 'session:analystName';
/** Engine settings identity for the run dedupe key; a different value creates a new run. */
const SETTINGS_ID = 'aduin-web/settings@1';

export interface SyncState {
  /** queued + sending + retry + deferred outbox ops. */
  unsynced: number;
  /** At least one op waits for the next UTC day (daily write budget). */
  deferred: boolean;
  /** At least one op hit the retry cap while memory was unavailable (resumes on reload/online). */
  parked: boolean;
  /** Last terminal refusal shown to the analyst (cleared on the next success). */
  lastError: string | null;
}

export const useSync = create<SyncState>(() => ({
  unsynced: 0,
  deferred: false,
  parked: false,
  lastError: null,
}));

let box: Outbox | null = null;
let findingsProvider: (doc: OutboxDoc, keys: string[]) => FindingWire[] = () => [];
const eventListeners = new Set<(e: OutboxEvent) => void>();

/** Review state registers how to turn finding keys of the open document into wire findings. */
export function setFindingsProvider(fn: (doc: OutboxDoc, keys: string[]) => FindingWire[]): void {
  findingsProvider = fn;
}

export function onSyncEvent(fn: (e: OutboxEvent) => void): () => void {
  eventListeners.add(fn);
  return () => {
    eventListeners.delete(fn);
  };
}

/** True when memory writes are disabled (read-only demo session). */
export function writesDisabled(): boolean {
  return useSession.getState().readOnly;
}

const WORKSPACE_CHANGED =
  'A queued decision belonged to an earlier memory session. It stays in this browser only.';
const REFUSED: Record<string, string> = {
  fingerprint_mismatch: 'Memory refused a decision: the quote no longer matches.',
  read_only: 'This demo workspace is read-only. Decisions stay in this browser.',
  invalid_request: 'Memory refused a decision. It stays in this browser only.',
  not_found: 'Memory refused a decision. It stays in this browser only.',
};

/** The app-wide outbox (null when IndexedDB is unavailable: writes stay local). */
export function outbox(): Outbox | null {
  if (box) return box;
  const db = appDb();
  if (!db) return null;
  box = new Outbox({
    db,
    api: () => memoryApi(),
    readOnly: writesDisabled,
    workspace: currentWorkspace,
    findingsFor: (doc, keys) => findingsProvider(doc, keys),
  });
  box.onEvent((e) => {
    if (e.type === 'rejected')
      useSync.setState({
        lastError:
          e.error.reason === 'workspace_changed'
            ? WORKSPACE_CHANGED
            : (REFUSED[e.error.code] ?? REFUSED['invalid_request']!),
      });
    if (e.type === 'synced') useSync.setState({ lastError: null });
    for (const l of eventListeners) {
      try {
        l(e);
      } catch {
        /* a listener must not break the outbox */
      }
    }
    void refreshUnsynced();
  });
  box.start();
  return box;
}

export async function refreshUnsynced(): Promise<void> {
  const b = box;
  if (!b) return;
  try {
    const ops = await b.list();
    const open = ops.filter((o) => o.state !== 'synced' && o.state !== 'rejected');
    useSync.setState({
      unsynced: open.length,
      deferred: open.some((o) => o.state === 'deferred'),
      parked: open.some((o) => o.state === 'parked'),
    });
  } catch {
    /* storage unavailable: keep the last count */
  }
}

/** Drain the outbox now (bounded: stops at the first op that is not due). Never throws. */
export async function flushOutbox(): Promise<void> {
  const b = outbox();
  if (!b) return;
  try {
    await b.drain();
  } catch {
    /* ops stay queued */
  }
  await refreshUnsynced();
}

let settings: Promise<string> | null = null;
export function settingsHash(): Promise<string> {
  settings ??= sha256Hex(SETTINGS_ID);
  return settings;
}

/** Outbox / ensureRun document key for an open document. */
export async function outboxDocFor(doc: {
  id: string;
  name: string;
  firmId: string | null;
  fund: string;
  version: string;
}): Promise<OutboxDoc> {
  return {
    doc_name: (doc.name || 'Untitled document').slice(0, 120),
    doc_hash: doc.id,
    law_firm_id: doc.firmId,
    settings_hash: await settingsHash(),
    ...(doc.fund ? { fund_name: doc.fund.slice(0, 200) } : {}),
    ...(doc.version ? { version_label: doc.version.slice(0, 120) } : {}),
  };
}

/** Wire form of a displayed finding: display-only fields and the full `quote` never leave. */
export function toFindingWire(f: FindingView, fingerprint: string): FindingWire {
  const {
    quote: _quote,
    classLabel: _classLabel,
    title: _title,
    ref: _ref,
    loc: _loc,
    found: _found,
    sensitive: _sensitive,
    order: _order,
    locator: _locator,
    numberingNote: _numberingNote,
    ...rest
  } = f;
  return { ...rest, fingerprint };
}

// ------------------------------------------------------------------ session bootstrap

let nameLoad: Promise<string> | null = null;

/** Stored analyst name (default `Linh Tran`); loaded once and pushed into the session store. */
export function loadAnalystName(): Promise<string> {
  nameLoad ??= (async () => {
    let name = DEFAULT_ANALYST_NAME;
    const db = appDb();
    if (db) {
      try {
        const row = await db.uiState.get(NAME_KEY);
        const v = typeof row?.value === 'string' ? cleanAnalystName(row.value) : null;
        if (v) name = v;
      } catch {
        /* keep the default */
      }
    }
    useSession.getState().setAnalystName(name);
    return name;
  })();
  return nameLoad;
}

const booted = new WeakMap<object, Promise<void>>();

/**
 * True when the last session bootstrap failed with `unavailable` (e.g. 503: no D1 on the demo).
 * Memory writes are then skipped (triage stays local) instead of piling up in the outbox (F5).
 * Cleared by the next successful bootstrap.
 */
let bootUnavailable = false;
export function memoryDown(): boolean {
  return bootUnavailable;
}

/** Test seam: clear the bootstrap-unavailable flag. */
export function resetMemorySyncForTest(): void {
  bootUnavailable = false;
}

/**
 * Workspace of the current real session (bootstraps first); null for the Dexie stub or when the
 * session cannot be established. Used to stamp and check outbox ops (F2).
 */
export async function currentWorkspace(): Promise<string | null> {
  const a = memoryApi();
  if (!isRealMemoryApi(a)) return null;
  await ensureSession();
  return a.currentSession()?.workspace_id ?? null;
}

/**
 * Bootstrap the memory session once per client (real Worker client only; the stub needs none).
 * Always awaited before the first lookup. Failures are silent: the client bootstraps itself again
 * on its first call and a lookup failure shows "Memory unavailable".
 */
export function ensureSession(): Promise<void> {
  const a = memoryApi();
  if (!isRealMemoryApi(a)) return loadAnalystName().then(() => undefined);
  let p = booted.get(a);
  if (!p) {
    p = (async () => {
      const name = await loadAnalystName();
      a.onSession((s) => useSession.getState().setReadOnly(s.read_only === true));
      try {
        const s = await a.bootstrap(name);
        bootUnavailable = false;
        useSession.getState().setReadOnly(s.read_only === true);
      } catch (e) {
        /* the client retries on its first call; a 503 keeps writes local (F5) */
        bootUnavailable = e instanceof MemoryApiError && e.code === 'unavailable';
      }
    })();
    booted.set(a, p);
  }
  return p;
}

/** Inline badge edit: store the new name and re-bootstrap the session with it. */
export async function changeAnalystName(name: string): Promise<boolean> {
  const n = cleanAnalystName(name);
  if (!n) return false;
  useSession.getState().setAnalystName(n);
  nameLoad = Promise.resolve(n);
  const db = appDb();
  if (db) {
    try {
      await db.uiState.put({ key: NAME_KEY, value: n, updatedAt: Date.now() });
    } catch {
      /* the name stays for this session */
    }
  }
  const a = memoryApi();
  if (isRealMemoryApi(a)) {
    try {
      const s = await a.bootstrap(n);
      bootUnavailable = false;
      useSession.getState().setReadOnly(s.read_only === true);
    } catch {
      /* the next call bootstraps again */
    }
  }
  return true;
}
