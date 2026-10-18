import { appDb, RETENTION_MS, type AppDb } from '../storage/db';
import { parseLastDoc } from './last-doc';
import type { DocMeta } from './review';

/**
 * Restore-on-reload for the document switcher: the recent list (max 6) is kept in Dexie uiState
 * `session:recent`. Uploads whose bytes are gone or older than the retention window are dropped.
 */
export const RECENT_KEY = 'session:recent';
const MAX_RECENT = 6;

/** Validate one stored entry (untrusted input): last-doc shape plus a string id. */
export function parseRecentDoc(v: unknown): DocMeta | null {
  const meta = parseLastDoc(v);
  const id = (v as Record<string, unknown> | null)?.id;
  if (!meta || typeof id !== 'string' || !id || id.length > 200) return null;
  return { id, ...meta };
}

export async function saveRecent(list: DocMeta[], db: AppDb | null = appDb()): Promise<void> {
  if (!db) return;
  try {
    await db.uiState.put({
      key: RECENT_KEY,
      value: list.slice(0, MAX_RECENT),
      updatedAt: Date.now(),
    });
  } catch {
    /* storage unavailable: the switcher starts empty next time */
  }
}

/** Load the stored list: valid, deduped, and uploads only while their bytes are still kept. */
export async function loadRecent(db: AppDb | null = appDb(), now = Date.now()): Promise<DocMeta[]> {
  if (!db) return [];
  let raw: unknown;
  try {
    raw = (await db.uiState.get(RECENT_KEY))?.value;
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: DocMeta[] = [];
  for (const item of raw.slice(0, MAX_RECENT * 2)) {
    const d = parseRecentDoc(item);
    if (!d || out.some((r) => r.id === d.id)) continue;
    if (d.source === 'upload') {
      const row = await db.documents.get(d.ref).catch(() => undefined);
      if (!row || !(row.bytes instanceof Uint8Array) || row.createdAt <= now - RETENTION_MS)
        continue;
    }
    out.push(d);
  }
  return out.slice(0, MAX_RECENT);
}

/** Current entries stay first; stored ones fill in behind them (dedupe by id, max 6). */
export function mergeRecent(current: DocMeta[], stored: DocMeta[]): DocMeta[] {
  const out = [...current];
  for (const d of stored) if (!out.some((r) => r.id === d.id)) out.push(d);
  return out.slice(0, MAX_RECENT);
}
