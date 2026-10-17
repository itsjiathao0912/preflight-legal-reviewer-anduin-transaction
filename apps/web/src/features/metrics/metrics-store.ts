import { computeMetrics, type DocumentMetrics, type MetricsInput } from '@aduin/core';
import { appDb } from '../../storage/db';

/**
 * Per-document delivery metrics (AC64), Dexie uiState `metrics:{docHash}`.
 * - `t0` is captured at the top of `openDocument` and rewritten on each open until an export is
 *   recorded; only the FIRST export is measured (later exports never change the numbers).
 * - Browser clock for the local display; the server `sheet_exported_at` is kept beside it.
 */
export interface MetricsRow {
  t0: number;
  exportedAt?: number;
  serverExportedAt?: number;
  metrics?: DocumentMetrics;
}

const HEX64 = /^[0-9a-f]{64}$/;
export const metricsKey = (docHash: string) => `metrics:${docHash}`;

function isRow(v: unknown): v is MetricsRow {
  return !!v && typeof v === 'object' && typeof (v as MetricsRow).t0 === 'number';
}

export async function readMetrics(docHash: string): Promise<MetricsRow | null> {
  const db = appDb();
  if (!db || !HEX64.test(docHash)) return null;
  try {
    const row = await db.uiState.get(metricsKey(docHash));
    return isRow(row?.value) ? row.value : null;
  } catch {
    return null;
  }
}

/** Document opened: (re)write t0 unless the first export is already recorded. */
export async function recordOpen(docHash: string, t0: number): Promise<void> {
  const db = appDb();
  if (!db || !HEX64.test(docHash)) return;
  try {
    const prev = await readMetrics(docHash);
    if (prev?.exportedAt !== undefined) return;
    await db.uiState.put({ key: metricsKey(docHash), value: { t0 }, updatedAt: Date.now() });
  } catch {
    /* metrics are best effort */
  }
}

/** First export only: compute and store the metrics; later exports return the stored row. */
export async function recordExport(
  docHash: string,
  input: Omit<MetricsInput, 't0'>,
  serverExportedAt?: number,
): Promise<MetricsRow | null> {
  const db = appDb();
  if (!db || !HEX64.test(docHash)) return null;
  try {
    const prev = await readMetrics(docHash);
    if (prev?.exportedAt !== undefined) return prev;
    const t0 = prev?.t0 ?? input.exportedAt;
    const row: MetricsRow = {
      t0,
      exportedAt: input.exportedAt,
      ...(serverExportedAt !== undefined ? { serverExportedAt } : {}),
      metrics: computeMetrics({ ...input, t0 }),
    };
    await db.uiState.put({ key: metricsKey(docHash), value: row, updatedAt: Date.now() });
    return row;
  } catch {
    return null;
  }
}

/** "4 min 05 s" style duration (never negative). */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m) return `${m} min ${String(sec).padStart(2, '0')} s`;
  return `${sec} s`;
}
