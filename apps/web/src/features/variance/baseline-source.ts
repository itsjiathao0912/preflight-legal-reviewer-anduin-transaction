import { eligibleBaselines, type BaselineCandidate } from '@aduin/core';
import type { AnalyzeInput } from '../../engine/types';
import { listUploads, readUpload } from '../package/package-persist';
import { readPackageMemberSource, usePackage } from '../../state/package';
import { inputKindOf, type DocMeta } from '../../state/review';
import { appDb, RETENTION_MS } from '../../storage/db';
import { POINTER_KEY, type BaselineRef, type FirmPointer } from './types';

/**
 * Variance Phase 02: THE single coupling point to Intake (D6). Resolution order: (1) the open
 * document is a package primary with baseline-role members -> those, ordered by core
 * `eligibleBaselines` (createdAt desc, name, docId); (2) otherwise the firm pointer in `uiState`
 * over same-firm stored uploads. Same firm only (core `runVariance` step 0 checks again); unknown
 * firm means no baseline; a document is never its own baseline.
 */

export type TextInput = Exclude<AnalyzeInput, { kind: 'ocr' }>;

export type Resolution =
  | { kind: 'ready'; baseline: BaselineRef; input: TextInput; ignored: number }
  | { kind: 'unavailable'; reason: 'scan' | 'missing'; baseline: BaselineRef; ignored: number }
  | { kind: 'none'; reason: 'no_firm' | 'no_candidate' | 'self' };

export type SetBaselineResult =
  { ok: true } | { ok: false; reason: 'unknown_doc' | 'cross_firm' | 'no_firm' | 'refused' };

/** Pseudo package for the pointer path: no candidate can match it, so the same-firm rule decides. */
const NO_PACKAGE = 'variance:no-package';

const SCAN_NAME = /\.(jpe?g|png)$/i;

/** Ids that stand for the open document itself (content hash and stored upload id). */
function selfIds(doc: DocMeta): Set<string> {
  return new Set([doc.id, doc.ref].filter((x): x is string => !!x));
}

/** The open document's package (only when it is the primary), with its baseline-role members. */
export function packageContext(doc: DocMeta): {
  packageId: string;
  firmId: string | null;
  baselines: { docId: string; name: string }[];
  subs: { docId: string; name: string }[];
} | null {
  const c = usePackage.getState().current;
  if (!c || c.primaryDocId !== doc.id) return null;
  const others = c.docs.filter((d) => d.id !== c.primaryDocId);
  return {
    packageId: c.id,
    firmId: c.tag.firmId,
    baselines: others
      .filter((d) => d.role === 'baseline')
      .map((d) => ({ docId: d.id, name: d.name })),
    subs: others
      .filter((d) => d.type === 'sub_agreement')
      .map((d) => ({ docId: d.id, name: d.name })),
  };
}

/** Package baselines in core order (same firm; unknown firm = none), self excluded. */
function packageBaselines(doc: DocMeta): BaselineRef[] | null {
  const ctx = packageContext(doc);
  if (!ctx || ctx.baselines.length === 0) return null;
  const firm = ctx.firmId;
  if (!firm || firm !== doc.firmId) return [];
  const self = selfIds(doc);
  const cands: BaselineCandidate[] = ctx.baselines
    .filter((b) => !self.has(b.docId))
    .map((b) => ({ docId: b.docId, name: b.name, firmId: firm, packageId: ctx.packageId }));
  return eligibleBaselines({ id: ctx.packageId, firmId: firm }, cands).map((c) => ({
    docId: c.docId,
    name: c.name,
    firmId: firm,
    path: 'package' as const,
  }));
}

function expired(createdAt: number, now: number): boolean {
  return now - createdAt >= RETENTION_MS;
}

/**
 * Pointer-path candidates: same-firm stored uploads whose text is in the browser. Null-firm rows
 * (admitted by `listUploads`) are removed BEFORE the core call; each candidate carries a synthetic
 * `packageId` (its own row id) so it can never match the pseudo package.
 */
export async function pointerCandidates(doc: DocMeta, now = Date.now()): Promise<BaselineRef[]> {
  const firm = doc.firmId;
  if (!firm) return [];
  const self = selfIds(doc);
  const rows = (await listUploads(50, firm)).filter(
    (r) =>
      r.firmId !== null &&
      r.firmId === firm &&
      !self.has(r.id) &&
      !SCAN_NAME.test(r.name) &&
      !expired(r.createdAt, now),
  );
  const cands: BaselineCandidate[] = rows.map((r) => ({
    docId: r.id,
    name: r.name,
    firmId: r.firmId,
    packageId: r.id,
    storedDocId: r.id,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
  return eligibleBaselines({ id: NO_PACKAGE, firmId: firm }, cands).map((c) => ({
    docId: c.docId,
    name: c.name,
    firmId: firm,
    path: 'pointer' as const,
    ...(c.createdAt ? { createdAt: c.createdAt } : {}),
  }));
}

/** Everything the header modal may offer (same firm only, text in the browser, never self). */
export async function listBaselineCandidates(doc: DocMeta): Promise<BaselineRef[]> {
  const ctx = packageContext(doc);
  if (ctx && ctx.baselines.length > 0) {
    if (!ctx.firmId || ctx.firmId !== doc.firmId) return [];
    const self = selfIds(doc);
    const seen = new Set<string>();
    const out: BaselineRef[] = [];
    for (const d of [...ctx.baselines, ...ctx.subs]) {
      if (self.has(d.docId) || seen.has(d.docId)) continue;
      seen.add(d.docId);
      out.push({ docId: d.docId, name: d.name, firmId: ctx.firmId, path: 'package' });
    }
    return out;
  }
  return pointerCandidates(doc);
}

export async function readPointer(firmId: string): Promise<FirmPointer | null> {
  try {
    const row = await appDb()?.uiState.get(POINTER_KEY(firmId));
    const v = row?.value as Partial<FirmPointer> | undefined;
    if (!v || typeof v.docId !== 'string' || typeof v.name !== 'string') return null;
    return {
      docId: v.docId,
      name: v.name,
      setAt: typeof v.setAt === 'number' ? v.setAt : 0,
      ...(typeof v.docHash === 'string' ? { docHash: v.docHash } : {}),
    };
  } catch {
    return null;
  }
}

async function writePointer(firmId: string, p: FirmPointer): Promise<boolean> {
  const db = appDb();
  if (!db) return false;
  try {
    await db.uiState.put({ key: POINTER_KEY(firmId), value: p, updatedAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}

function textInput(name: string, bytes: Uint8Array, format?: string): TextInput | null {
  const kind = format ?? inputKindOf(name);
  if (kind === 'html' || kind === 'pdf' || kind === 'docx') return { kind, bytes, name };
  return null;
}

/** Resolve the one baseline for this review (package role first, firm pointer second). */
export async function resolveBaseline(doc: DocMeta, now = Date.now()): Promise<Resolution> {
  if (!doc.firmId) return { kind: 'none', reason: 'no_firm' };
  const pkg = packageBaselines(doc);
  if (pkg) {
    const first = pkg[0];
    if (!first) return { kind: 'none', reason: 'no_candidate' };
    const ignored = pkg.length - 1;
    const src = await readPackageMemberSource(first.docId);
    if ('unavailable' in src)
      return { kind: 'unavailable', reason: src.reason ?? 'missing', baseline: first, ignored };
    const input = textInput(src.name, src.bytes, src.format);
    if (!input) return { kind: 'unavailable', reason: 'scan', baseline: first, ignored };
    return { kind: 'ready', baseline: first, input, ignored };
  }
  const firm = doc.firmId;
  const ptr = await readPointer(firm);
  if (!ptr) return { kind: 'none', reason: 'no_candidate' };
  const self = selfIds(doc);
  if (self.has(ptr.docId) || (ptr.docHash !== undefined && self.has(ptr.docHash)))
    return { kind: 'none', reason: 'self' };
  const ref: BaselineRef = { docId: ptr.docId, name: ptr.name, firmId: firm, path: 'pointer' };
  const row = await readUpload(ptr.docId);
  if (!row) return { kind: 'unavailable', reason: 'missing', baseline: ref, ignored: 0 };
  // never across firms (and never a null-firm row), even when the pointer says so
  if (row.firmId === null || row.firmId !== firm) return { kind: 'none', reason: 'no_candidate' };
  const named: BaselineRef = {
    ...ref,
    name: row.name,
    createdAt: new Date(row.createdAt).toISOString(),
  };
  if (expired(row.createdAt, now))
    return { kind: 'unavailable', reason: 'missing', baseline: named, ignored: 0 };
  if (SCAN_NAME.test(row.name))
    return { kind: 'unavailable', reason: 'scan', baseline: named, ignored: 0 };
  const input = textInput(row.name, row.bytes);
  if (!input) return { kind: 'unavailable', reason: 'scan', baseline: named, ignored: 0 };
  return { kind: 'ready', baseline: named, input, ignored: 0 };
}

/**
 * Change the baseline (same firm only). Package path: Intake `setRole(docId, 'baseline')` and the
 * other baselines go back to `reference` (one baseline per review). Pointer path: the firm pointer.
 */
export async function setBaseline(doc: DocMeta, docId: string): Promise<SetBaselineResult> {
  if (!doc.firmId) return { ok: false, reason: 'no_firm' };
  if (selfIds(doc).has(docId)) return { ok: false, reason: 'unknown_doc' };
  const ctx = packageContext(doc);
  if (ctx && [...ctx.baselines, ...ctx.subs].some((d) => d.docId === docId)) {
    if (!ctx.firmId || ctx.firmId !== doc.firmId) return { ok: false, reason: 'cross_firm' };
    const store = usePackage.getState();
    const r = store.setRole(docId, 'baseline');
    if (!r.ok) return { ok: false, reason: r.reason === 'cross_firm' ? 'cross_firm' : 'refused' };
    for (const b of ctx.baselines) if (b.docId !== docId) store.setRole(b.docId, 'reference');
    return { ok: true };
  }
  const cand = (await pointerCandidates(doc)).find((c) => c.docId === docId);
  if (!cand) {
    const row = await readUpload(docId);
    return { ok: false, reason: row && row.firmId !== doc.firmId ? 'cross_firm' : 'unknown_doc' };
  }
  const ok = await writePointer(doc.firmId, { docId, name: cand.name, setAt: Date.now() });
  return ok ? { ok: true } : { ok: false, reason: 'refused' };
}

/**
 * After a no-baseline review: an uploaded document with a firm becomes the firm's baseline (its
 * text stays in the browser for 24 h). Samples and null-firm documents never become one.
 */
export async function becomeFirmBaseline(doc: DocMeta): Promise<boolean> {
  if (!doc.firmId || doc.source !== 'upload' || !doc.ref) return false;
  const row = await readUpload(doc.ref);
  if (!row || row.firmId !== doc.firmId || SCAN_NAME.test(row.name)) return false;
  return writePointer(doc.firmId, {
    docId: doc.ref,
    docHash: doc.id,
    name: row.name,
    setAt: Date.now(),
  });
}
