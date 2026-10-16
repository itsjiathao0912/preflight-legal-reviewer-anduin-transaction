import { appDb, spendAllowance } from '../../storage/db';
import { useReview, type DocMeta } from '../../state/review';
import { useSession } from '../../state/session';
import { useShell } from '../../state/shell';
import type { FirmEntry, SampleEntry } from './samples';

function firmName(firms: FirmEntry[], id: string | null): string {
  if (!id) return '';
  return firms.find((f) => f.id === id)?.name ?? id;
}

/** Open a bundled sample (cached: never counts against the fresh-AI allowance). */
export async function openSample(s: SampleEntry, firms: FirmEntry[]): Promise<void> {
  if (!s.file || s.disabled) return;
  const res = await fetch(`/samples/${s.file}`);
  if (!res.ok) throw new Error('sample not found');
  const bytes = new Uint8Array(await res.arrayBuffer());
  useShell.getState().setRoute('findings');
  await useReview.getState().openDocument(bytes, {
    name: s.title,
    firmId: s.firmId,
    firmName: firmName(firms, s.firmId),
    fund: s.fund,
    version: s.version,
    source: 'sample',
    sampleId: s.id,
    ref: s.file,
  });
}

/** Open an uploaded HTML file: stored for 24 h, counts one fresh-AI document when AI is on. */
export async function openUpload(
  file: { name: string; bytes: Uint8Array },
  tag: { firmId: string | null; firmName: string; fund: string; version: string },
): Promise<void> {
  const id = `up_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const db = appDb();
  if (db) {
    try {
      await db.documents.put({
        id,
        name: file.name,
        kind: 'upload',
        bytes: file.bytes,
        ...tag,
        createdAt: Date.now(),
      });
    } catch {
      /* storage unavailable: open without persisting */
    }
  }
  useShell.getState().setRoute('findings');
  await useReview
    .getState()
    .openDocument(file.bytes, { name: file.name, ...tag, source: 'upload', ref: id });
  if (useSession.getState().aiOn && db) {
    try {
      await spendAllowance(db);
      await useSession.getState().refreshAllowance();
    } catch {
      /* display-only stub */
    }
  }
}

/** Reopen a document from the switcher (samples re-fetch; uploads read back from IndexedDB). */
export async function reopenRecent(d: DocMeta): Promise<void> {
  let bytes: Uint8Array | null = null;
  if (d.source === 'sample') {
    const res = await fetch(`/samples/${d.ref}`);
    if (res.ok) bytes = new Uint8Array(await res.arrayBuffer());
  } else {
    const row = await appDb()?.documents.get(d.ref);
    bytes = row?.bytes ?? null;
  }
  if (!bytes) {
    useReview.getState().showToast('This document is no longer stored in this browser.');
    return;
  }
  const { id: _id, ...meta } = d;
  useShell.getState().setRoute('findings');
  await useReview.getState().openDocument(bytes, meta);
}
