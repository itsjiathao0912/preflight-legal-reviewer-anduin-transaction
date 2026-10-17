import type { DiffSideInput } from '../../engine/types';
import { appDb } from '../../storage/db';
import { loadManifest } from '../open-document/samples';

/**
 * Documents the Compare picker offers (E12): bundled HTML samples and stored uploads in the formats
 * the worker prepare helper reads (HTML, PDF text layer, DOCX). Scans / images are not offered:
 * OCR runs on the main thread (backlog compare-ocr-documents).
 */
export interface CompareSource {
  /** `s:<sampleId>` or `u:<uploadId>`. */
  key: string;
  label: string;
}

const COMPARABLE = /\.(html?|pdf|docx)$/i;

export async function listSources(): Promise<CompareSource[]> {
  const samples = (await loadManifest())
    .filter((s) => !s.disabled && s.kind === 'html' && !!s.file)
    .map((s) => ({ key: `s:${s.id}`, label: s.title }));
  let uploads: CompareSource[] = [];
  try {
    const rows = (await appDb()?.documents.orderBy('createdAt').toArray()) ?? [];
    uploads = rows
      .filter((r) => COMPARABLE.test(r.name))
      .map((r) => ({ key: `u:${r.id}`, label: `${r.name.slice(0, 80)} (upload)` }));
  } catch {
    /* storage unavailable: samples only */
  }
  return [...samples, ...uploads];
}

/** Bytes for one picker key, the way open-actions reads samples and uploads. */
export async function loadSide(key: string): Promise<DiffSideInput | null> {
  if (key.startsWith('s:')) {
    const entry = (await loadManifest()).find((s) => `s:${s.id}` === key);
    if (!entry?.file) return null;
    const res = await fetch(`/samples/${entry.file}`);
    if (!res.ok) return null;
    // samples are HTML and open without a file name (no format check), as in openSample
    return { bytes: new Uint8Array(await res.arrayBuffer()), kind: 'html' };
  }
  if (key.startsWith('u:')) {
    const row = await appDb()?.documents.get(key.slice(2));
    if (!row || !COMPARABLE.test(row.name)) return null;
    return { bytes: row.bytes, name: row.name };
  }
  return null;
}
