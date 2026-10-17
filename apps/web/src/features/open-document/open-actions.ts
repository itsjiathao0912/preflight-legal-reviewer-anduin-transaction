import { apiEnabled } from '../../api/base';
import { appDb, spendAllowance } from '../../storage/db';
import { usePackage } from '../../state/package';
import { useReview, type DocMeta } from '../../state/review';
import { useSession } from '../../state/session';
import { useShell } from '../../state/shell';
import { loadManifest, scanPagesOf, type FirmEntry, type SampleEntry } from './samples';

function firmName(firms: FirmEntry[], id: string | null): string {
  if (!id) return '';
  return firms.find((f) => f.id === id)?.name ?? id;
}

/** Open a bundled sample (cached: never counts against the fresh-AI allowance). */
export async function openSample(s: SampleEntry, firms: FirmEntry[]): Promise<void> {
  if (s.disabled) return;
  usePackage.getState().clear(); // intake: a sample open never shows package UI
  if (s.kind === 'scan') {
    // Phase 06f: multi-page scan set; pages come from the manifest page list (precomputed OCR first)
    const pages = scanPagesOf(s);
    if (!pages.length) throw new Error('scan set has no pages');
    useShell.getState().setRoute('findings');
    await useReview.getState().openDocument(
      new Uint8Array(0),
      {
        name: s.title,
        firmId: s.firmId,
        firmName: firmName(firms, s.firmId),
        fund: s.fund,
        version: s.version,
        source: 'sample',
        sampleId: s.id,
        ref: `scan:${s.id}`,
      },
      {
        scan: {
          pages: pages.map((p) => ({
            n: p.n,
            url: `/samples/${p.file}`,
            sourceHash: p.sourceHash,
          })),
        },
      },
    );
    return;
  }
  if (!s.file) return;
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

/**
 * Open an uploaded file (HTML, PDF, DOCX, JPEG/PNG; Phase 06): stored for 24 h, counts one fresh-AI
 * document when AI is on. The file name selects the adapter; the worker re-checks the content.
 */
export async function openUpload(
  file: { name: string; bytes: Uint8Array },
  tag: { firmId: string | null; firmName: string; fund: string; version: string },
): Promise<void> {
  usePackage.getState().clear(); // intake: classic single-file path
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
    .openDocument(
      file.bytes,
      { name: file.name, ...tag, source: 'upload', ref: id },
      { fileName: file.name, packageFacts: true },
    );
  // intake S3: a high-confidence subscription agreement becomes a one-document package AFTER
  // findings render (coverage appears after findings, never before)
  const r = useReview.getState();
  if (r.phase === 'ready' && r.result && r.doc?.ref === id)
    usePackage.getState().registerSingle({
      name: file.name,
      bytes: file.bytes,
      storedDocId: id,
      tag,
      result: r.result,
    });
  // Stub allowance only without an API (preview build); with an API the real quota is refetched
  // after the fresh AI call.
  if (useSession.getState().aiOn && db && !apiEnabled()) {
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
  // intake: a package primary restores its package; anything else clears package UI
  if (d.packageId && (await usePackage.getState().restore(d.packageId))) {
    useShell.getState().setRoute('findings');
    return;
  }
  usePackage.getState().clear();
  let bytes: Uint8Array | null = null;
  if (d.source === 'sample' && d.ref.startsWith('scan:')) {
    const entry = (await loadManifest()).find((s) => `scan:${s.id}` === d.ref);
    if (entry) return openSample(entry, []);
  }
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
  const { id: _id, packageId: _pkg, ...meta } = d;
  useShell.getState().setRoute('findings');
  await useReview
    .getState()
    .openDocument(bytes, meta, d.source === 'upload' ? { fileName: d.name } : undefined);
}
