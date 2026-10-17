import { create } from 'zustand';
import {
  analyzePackage,
  checkPackageLimits,
  definitionSources,
  detectDocument,
  eligibleBaselines,
  packageRunReadiness,
  resolveRoles,
  type BaselineCandidate,
  type CrossDocDefinition,
  type PackageAnalysis,
  type PackageDocRole,
  type PackageDocType,
  type PackageDocument,
  type PackageFacts,
  type PackageProblem,
  type PrimaryFacts,
} from '@aduin/core';
import { apiEnabled } from '../api/base';
import { readPackageDocInWorker } from '../engine/client';
import { runOcrQueue, sha256Hex } from '../engine/ocr-queue';
import type { AnalyzeInput, EngineResult } from '../engine/types';
import type {
  PackageActionResult,
  PackageBaselineView,
  PackageTag,
} from '../features/package/contract';
import {
  listPackages,
  listUploads,
  readFacts,
  readMemberBytes,
  readPackage,
  readUpload,
  writeFacts,
  writeMemberDocument,
  writePackage,
} from '../features/package/package-persist';
import { loadManifest, scanPagesOf } from '../features/open-document/samples';
import { appDb, spendAllowance, type StoredPackage, type StoredPackageDoc } from '../storage/db';
import { inputKindOf, useReview, type DocMeta, type ScanSetInput } from './review';
import { useSession } from './session';

/**
 * Intake Phase 2: the fund package store. Two-stage pipeline: light read (facts) -> detection ->
 * analyst confirms -> normal analyze of the to-digitize document with package definitions. Render
 * first: findings render the moment the review store is ready; analysis is computed synchronously
 * afterwards and persistence is fire-and-forget.
 */

/** One member handed to prepareDraft. Bundled demo members carry a `sampleRef`. */
export type PackageMemberInput =
  | { name: string; bytes: Uint8Array; sampleRef?: string; sampleId?: string }
  | { name: string; scan: ScanSetInput; sampleRef: string; sampleId: string };

/** Where a member's content comes from (memory only; bytes are never in zustand state). */
type MemberSource =
  | {
      kind: 'bytes';
      name: string;
      bytes: Uint8Array;
      sampleRef?: string;
      sampleId?: string;
      storedDocId?: string;
      /** Firm of an earlier stored document (baseline guard). */
      firmId?: string | null;
    }
  | { kind: 'scan'; name: string; scan: ScanSetInput; sampleRef: string; sampleId: string };

export interface PackageDraft {
  status: 'reading' | 'ready' | 'running';
  tag: PackageTag;
  rows: PackageDocument[];
  /** Earlier same-firm stored documents (newest 5, via eligibleBaselines). */
  earlier: BaselineCandidate[];
  notice: string | null;
  /** Demo package id when the draft came from the Demo packages list. */
  demoId?: string;
}

export interface CurrentPackage {
  id: string;
  tag: PackageTag;
  docs: PackageDocument[];
  primaryDocId: string;
  confirmedTargets: Record<string, string>;
  createdAt: number;
}

export interface DraftReadiness {
  ok: boolean;
  problems: PackageProblem[];
  noSubAgreement: boolean;
  versionMissing: boolean;
}

export type PrepareResult = { ok: true } | { ok: false; message: string };

export const NO_SUB_LINE = 'No subscription agreement in this package. Checks need one.';
export const UNREADABLE_REASON = 'This file could not be read.';
const IMAGE_REASON = 'Scanned image: text needs OCR. Type detected from the file name only.';

interface PackageState {
  draft: PackageDraft | null;
  current: CurrentPackage | null;
  facts: Record<string, PackageFacts>;
  primary: PrimaryFacts | null;
  analysis: PackageAnalysis | null;
  refreshing: boolean;
  /** Bumped by every draft / run / clear; an older async step writes nothing. */
  seq: number;

  prepareDraft: (
    members: PackageMemberInput[],
    tag: PackageTag,
    opts?: { demoId?: string },
  ) => Promise<PrepareResult>;
  setDraftField: (docId: string, field: 'type' | 'role', value: string) => PackageActionResult;
  setDraftTag: (tag: Partial<PackageTag>) => void;
  confirmDraftRow: (docId: string) => void;
  removeDraftRow: (docId: string) => void;
  addEarlierDocument: (storedDocId: string) => Promise<PackageActionResult>;
  addEarlierToDraft: (storedDocId: string) => Promise<PackageActionResult>;
  draftReadiness: () => DraftReadiness;
  runDraft: () => Promise<void>;
  /** Single-file rule (S3): register a one-document package after findings rendered. */
  registerSingle: (input: {
    name: string;
    bytes: Uint8Array;
    storedDocId: string;
    tag: PackageTag;
    result: EngineResult;
  }) => void;
  restore: (id: string) => Promise<boolean>;
  listRecent: () => Promise<StoredPackage[]>;
  setRole: (docId: string, role: PackageDocRole) => PackageActionResult;
  setType: (docId: string, type: PackageDocType) => PackageActionResult;
  confirmTarget: (targetKey: string, docId: string | 'none') => void;
  baselineDocs: () => PackageBaselineView[];
  clear: () => void;
  clearDraft: () => void;
}

const sources = new Map<string, MemberSource>();

function emptyFacts(
  hash: string,
  name: string,
  format: PackageFacts['format'],
  bytes: number,
): PackageFacts {
  return {
    contentHash: hash,
    name: name.slice(0, 255) || 'file',
    format,
    bytes,
    needsOcr: format === 'image',
    titleLines: [],
    headText: '',
    headings: [],
    definitions: [],
  };
}

/** Scan set hash: the same joined-page-hash rule review.ts uses (equals the OCR sourceHash). */
async function scanHash(scan: ScanSetInput): Promise<string> {
  const pages = scan.pages.filter((p) => /^[0-9a-f]{64}$/.test(p.sourceHash)).slice(0, 30);
  return sha256Hex(pages.map((p) => p.sourceHash).join('|'));
}

/** Light read of one member; never throws (unreadable -> `failed`). */
async function lightRead(
  m: PackageMemberInput,
): Promise<{ facts: PackageFacts; failed: boolean; source: MemberSource }> {
  if ('scan' in m) {
    const hash = await scanHash(m.scan);
    const source: MemberSource = { kind: 'scan', ...m };
    const pages = m.scan.pages.filter((p) => /^[0-9a-f]{64}$/.test(p.sourceHash)).slice(0, 30);
    // precomputed OCR only (AI off: no page image leaves the browser during a light read)
    const ocrPages = await runOcrQueue({
      sourceHash: hash,
      aiOff: () => true,
      freePagesLeft: 0,
      jobs: pages.map((p, i) => ({
        index: i,
        sourceHash: p.sourceHash,
        render: () => Promise.reject(new Error('no render in a light read')),
      })),
    });
    const input: AnalyzeInput = {
      kind: 'ocr',
      sourceHash: hash,
      pageCount: pages.length,
      pages: ocrPages,
    };
    const r = await readPackageDocInWorker(input, { name: m.name });
    if (r.ok) return { facts: { ...r.facts, name: m.name.slice(0, 255) }, failed: false, source };
    return {
      facts: { ...emptyFacts(hash, m.name, 'ocr', 0), needsOcr: true },
      failed: false,
      source,
    };
  }
  const source: MemberSource = { kind: 'bytes', ...m };
  const kind = inputKindOf(m.name);
  if (kind === 'image') {
    const hash = await sha256Hex(m.bytes);
    return { facts: emptyFacts(hash, m.name, 'image', m.bytes.byteLength), failed: false, source };
  }
  const input: AnalyzeInput =
    kind === 'pdf'
      ? { kind: 'pdf', bytes: m.bytes, name: m.name }
      : { kind, bytes: m.bytes, name: m.name };
  const r = await readPackageDocInWorker(input, { name: m.name });
  if (r.ok) return { facts: r.facts, failed: false, source };
  const hash = await sha256Hex(m.bytes);
  const format = kind === 'pdf' ? 'pdf' : kind === 'docx' ? 'docx' : 'html';
  return { facts: emptyFacts(hash, m.name, format, m.bytes.byteLength), failed: true, source };
}

function rowOf(f: PackageFacts, failed: boolean): PackageDocument {
  const base = {
    id: f.contentHash,
    name: f.name,
    confirmed: false,
    suggestionSource: 'rule' as const,
    needsOcr: f.needsOcr,
    format: f.format,
    titleLines: [...f.titleLines],
  };
  if (failed)
    return {
      ...base,
      type: 'other',
      role: 'reference',
      confidence: 'low',
      reason: UNREADABLE_REASON,
    };
  const d = detectDocument({
    name: f.name,
    titleLines: f.titleLines,
    headText: f.headText,
    headings: f.headings,
  });
  if (f.format === 'image')
    return {
      ...base,
      ...d,
      confidence: 'low',
      reason: d.type === 'other' ? d.reason : IMAGE_REASON,
    };
  return { ...base, ...d };
}

/** Definitions of the definition-source documents (LPA / PPM references with text). */
export function packageDefsOf(
  docs: readonly PackageDocument[],
  facts: Readonly<Record<string, PackageFacts>>,
): CrossDocDefinition[] {
  return definitionSources(docs).flatMap((d) => facts[d.id]?.definitions ?? []);
}

function sourceKey(docs: readonly PackageDocument[]): string {
  return definitionSources(docs)
    .map((d) => d.id)
    .sort()
    .join(',');
}

function computeAnalysis(
  current: CurrentPackage,
  facts: Readonly<Record<string, PackageFacts>>,
  primary: PrimaryFacts | null,
): PackageAnalysis {
  return analyzePackage({
    docs: current.docs,
    facts: current.docs.map((d) => facts[d.id]).filter((f): f is PackageFacts => !!f),
    primary,
    confirmedTargets: current.confirmedTargets,
  });
}

function toStored(current: CurrentPackage): StoredPackage {
  return {
    id: current.id,
    firmId: current.tag.firmId,
    firmName: current.tag.firmName,
    fund: current.tag.fund,
    version: current.tag.version,
    createdAt: current.createdAt,
    primaryDocId: current.primaryDocId,
    confirmedTargets: { ...current.confirmedTargets },
    docs: current.docs.map((d): StoredPackageDoc => {
      const s = sources.get(d.id);
      return {
        id: d.id,
        name: d.name,
        type: d.type,
        role: d.role,
        confidence: d.confidence,
        reason: d.reason,
        confirmed: d.confirmed,
        suggestionSource: d.suggestionSource,
        needsOcr: d.needsOcr,
        format: d.format,
        ...(s?.kind === 'bytes' && s.storedDocId ? { storedDocId: s.storedDocId } : {}),
        ...(s?.sampleRef ? { sampleRef: s.sampleRef } : {}),
      };
    }),
  };
}

function newPackageId(): string {
  return `pkg_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

function storedIdFor(pkgId: string, docId: string): string {
  return `pd_${pkgId.slice(4, 16)}_${docId.slice(0, 16)}`;
}

/** Earlier stored uploads offered as baselines: eligibleBaselines BEFORE the newest-5 slice (E2). */
async function earlierFor(
  pkg: { id: string; firmId: string | null },
  exclude: ReadonlySet<string>,
): Promise<BaselineCandidate[]> {
  const rows = await listUploads();
  const candidates: BaselineCandidate[] = rows.map((r) => ({
    docId: r.id,
    name: r.name,
    firmId: r.firmId,
    packageId: r.packageId ?? `single:${r.id}`,
    storedDocId: r.id,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
  return eligibleBaselines(pkg, candidates)
    .filter((c) => !exclude.has(c.docId))
    .slice(0, 5);
}

/** DocMeta + open options of the primary member. */
function primaryOpen(
  current: CurrentPackage,
  doc: PackageDocument,
): {
  bytes: Uint8Array;
  meta: Omit<DocMeta, 'id'>;
  fileName?: string;
  scan?: ScanSetInput;
} | null {
  const s = sources.get(doc.id);
  if (!s) return null;
  const tag = { ...current.tag };
  if (s.kind === 'scan')
    return {
      bytes: new Uint8Array(0),
      meta: {
        name: s.name,
        ...tag,
        source: 'sample',
        sampleId: s.sampleId,
        ref: s.sampleRef,
        packageId: current.id,
      },
      scan: s.scan,
    };
  if (s.sampleId && s.sampleRef)
    return {
      bytes: s.bytes,
      meta: {
        name: s.name,
        ...tag,
        source: 'sample',
        sampleId: s.sampleId,
        ref: s.sampleRef,
        packageId: current.id,
      },
    };
  return {
    bytes: s.bytes,
    meta: {
      name: s.name,
      ...tag,
      source: 'upload',
      ref: s.storedDocId ?? storedIdFor(current.id, doc.id),
      packageId: current.id,
    },
    fileName: s.name,
  };
}

/** Bundled demo file members (public paths) carry the generated URL as sampleRef, no sampleId. */
function isBundled(s: MemberSource | undefined): boolean {
  return !!s?.sampleRef;
}

export const usePackage = create<PackageState>((set, get) => {
  /** OCR-backed members: needsOcr from the primary run's OCR pages (all done = false). */
  const applyOcr = (current: CurrentPackage, result: EngineResult | null): CurrentPackage => {
    const pages = result?.ocr?.pages;
    if (!result || !pages?.length) return current;
    const allDone = pages.every((p) => p.state === 'done');
    return {
      ...current,
      docs: current.docs.map((d) => (d.id === result.docHash ? { ...d, needsOcr: !allDone } : d)),
    };
  };

  /** Open the primary through the normal render-first path; fills primary facts afterwards. */
  const openPrimary = async (reopen: boolean): Promise<void> => {
    const seq = get().seq;
    const current = get().current;
    if (!current) return;
    const doc = current.docs.find((d) => d.id === current.primaryDocId);
    if (!doc) return;
    const o = primaryOpen(current, doc);
    if (!o) return;
    if (reopen) set({ refreshing: true });
    const defs = packageDefsOf(current.docs, get().facts);
    await useReview.getState().openDocument(o.bytes, o.meta, {
      ...(o.fileName ? { fileName: o.fileName } : {}),
      ...(o.scan ? { scan: o.scan } : {}),
      package: { id: current.id, defs, ...(reopen ? { reopen: true } : {}) },
    });
    if (get().seq !== seq) return; // superseded: write nothing
    const r = useReview.getState();
    if (r.phase !== 'ready' || r.doc?.packageId !== current.id) {
      set({ refreshing: false });
      return;
    }
    const latest = get().current;
    if (!latest || latest.id !== current.id) return;
    const next = applyOcr(latest, r.result);
    const primary = r.result?.packageFacts ?? null;
    set({
      current: next,
      primary,
      analysis: computeAnalysis(next, get().facts, primary),
      refreshing: false,
    });
    if (next !== latest) void writePackage(toStored(next));
  };

  /** Persist the row; recompute; re-open when the definition sources changed. */
  const commit = (next: CurrentPackage, prevKey: string) => {
    set({ current: next, analysis: computeAnalysis(next, get().facts, get().primary) });
    void writePackage(toStored(next));
    if (sourceKey(next.docs) !== prevKey) void openPrimary(true);
  };

  const editRow = (rows: PackageDocument[], docId: string, patch: Partial<PackageDocument>) =>
    rows.map((d) =>
      d.id === docId
        ? { ...d, ...patch, confirmed: true, suggestionSource: 'analyst' as const }
        : d,
    );

  return {
    draft: null,
    current: null,
    facts: {},
    primary: null,
    analysis: null,
    refreshing: false,
    seq: 0,

    prepareDraft: async (members, tag, opts) => {
      const limit = checkPackageLimits(
        members.map((m) => ({ name: m.name, size: 'bytes' in m ? m.bytes.byteLength : 0 })),
      );
      if (!limit.ok) return { ok: false, message: limit.message };
      const seq = get().seq + 1;
      set({
        seq,
        draft: {
          status: 'reading',
          tag,
          rows: [],
          earlier: [],
          notice: null,
          ...(opts?.demoId ? { demoId: opts.demoId } : {}),
        },
      });
      const facts: Record<string, PackageFacts> = {};
      const rows: PackageDocument[] = [];
      let dupes = 0;
      // sequential light reads (bounded memory, one file at a time)
      for (const m of members) {
        const r = await lightRead(m);
        if (get().seq !== seq) return { ok: true };
        if (facts[r.facts.contentHash]) {
          dupes++;
          continue;
        }
        facts[r.facts.contentHash] = r.facts;
        sources.set(r.facts.contentHash, r.source);
        rows.push(rowOf(r.facts, r.failed));
      }
      const resolved = resolveRoles(rows);
      const exclude = new Set(resolved.map((d) => d.id));
      const earlier = await earlierFor({ id: `draft:${seq}`, firmId: tag.firmId }, exclude).catch(
        () => [],
      );
      if (get().seq !== seq) return { ok: true };
      set({
        facts: { ...get().facts, ...facts },
        draft: {
          status: 'ready',
          tag,
          rows: resolved,
          earlier,
          notice: dupes
            ? `${dupes} duplicate file${dupes === 1 ? ' was' : 's were'} removed (same content).`
            : null,
          ...(opts?.demoId ? { demoId: opts.demoId } : {}),
        },
      });
      return { ok: true };
    },

    setDraftField: (docId, field, value) => {
      const d = get().draft;
      const row = d?.rows.find((r) => r.id === docId);
      if (!d || !row) return { ok: false, reason: 'unknown_doc' };
      if (field === 'role') {
        const role = value as PackageDocRole;
        if (role === 'to_digitize' && row.type !== 'sub_agreement')
          return { ok: false, reason: 'role_not_allowed' };
        if (role === 'baseline') {
          const s = sources.get(docId);
          const firm = s?.kind === 'bytes' ? s.firmId : undefined;
          if (firm !== undefined && firm !== null && firm !== d.tag.firmId)
            return { ok: false, reason: 'cross_firm' };
        }
        set({ draft: { ...d, rows: editRow(d.rows, docId, { role }) } });
        return { ok: true };
      }
      const type = value as PackageDocType;
      const patch: Partial<PackageDocument> = { type };
      if (type !== 'sub_agreement' && row.role === 'to_digitize') patch.role = 'reference';
      set({ draft: { ...d, rows: editRow(d.rows, docId, patch) } });
      return { ok: true };
    },

    setDraftTag: (tag) => {
      const d = get().draft;
      if (d) set({ draft: { ...d, tag: { ...d.tag, ...tag } } });
    },

    confirmDraftRow: (docId) => {
      const d = get().draft;
      if (!d) return;
      set({
        draft: { ...d, rows: d.rows.map((r) => (r.id === docId ? { ...r, confirmed: true } : r)) },
      });
    },

    removeDraftRow: (docId) => {
      const d = get().draft;
      if (!d) return;
      sources.delete(docId);
      set({ draft: { ...d, rows: d.rows.filter((r) => r.id !== docId) } });
    },

    addEarlierDocument: async (storedDocId) => {
      const d = get().draft;
      if (!d) return { ok: false, reason: 'unknown_doc' };
      const offered = d.earlier.find(
        (c) => c.storedDocId === storedDocId || c.docId === storedDocId,
      );
      if (!offered) {
        const row = await readUpload(storedDocId);
        if (row && row.firmId !== null && row.firmId !== d.tag.firmId)
          return { ok: false, reason: 'cross_firm' };
        return { ok: false, reason: 'unknown_doc' };
      }
      const row = await readUpload(storedDocId);
      if (!row) return { ok: false, reason: 'unknown_doc' };
      if (row.firmId !== null && row.firmId !== d.tag.firmId)
        return { ok: false, reason: 'cross_firm' };
      const seq = get().seq;
      const r = await lightRead({ name: row.name, bytes: row.bytes });
      if (get().seq !== seq) return { ok: false, reason: 'unknown_doc' };
      const cur = get().draft;
      if (!cur) return { ok: false, reason: 'unknown_doc' };
      if (cur.rows.some((x) => x.id === r.facts.contentHash)) return { ok: true };
      sources.set(r.facts.contentHash, {
        kind: 'bytes',
        name: row.name,
        bytes: row.bytes,
        storedDocId: row.id,
        firmId: row.firmId,
      });
      const base = rowOf(r.facts, r.failed);
      const added: PackageDocument = {
        ...base,
        role: 'baseline',
        confirmed: true,
        suggestionSource: 'analyst',
      };
      set({
        facts: { ...get().facts, [r.facts.contentHash]: r.facts },
        draft: {
          ...cur,
          rows: [...cur.rows, added],
          earlier: cur.earlier.filter((c) => c !== offered),
        },
      });
      return { ok: true };
    },

    addEarlierToDraft: (storedDocId) => get().addEarlierDocument(storedDocId),

    draftReadiness: () => {
      const d = get().draft;
      const rows = d?.rows ?? [];
      const r = packageRunReadiness(rows);
      const noSub = !rows.some((x) => x.type === 'sub_agreement');
      const versionMissing = !d?.tag.version.trim();
      return {
        ok: r.ok && !noSub && !versionMissing && d?.status === 'ready',
        problems: r.problems,
        noSubAgreement: noSub,
        versionMissing,
      };
    },

    runDraft: async () => {
      const d = get().draft;
      if (!d || !get().draftReadiness().ok) return;
      const primaryDoc = d.rows.find((x) => x.role === 'to_digitize');
      if (!primaryDoc) return;
      const seq = get().seq + 1;
      const current: CurrentPackage = {
        id: newPackageId(),
        tag: { ...d.tag },
        docs: d.rows.map((x) => ({ ...x, titleLines: [...x.titleLines] })),
        primaryDocId: primaryDoc.id,
        confirmedTargets: {},
        createdAt: Date.now(),
      };
      // member ids are content hashes, known up front: assign stored ids before persisting
      for (const doc of current.docs) {
        const s = sources.get(doc.id);
        if (s?.kind === 'bytes' && !s.storedDocId && !isBundled(s))
          sources.set(doc.id, { ...s, storedDocId: storedIdFor(current.id, doc.id) });
      }
      set({
        seq,
        draft: { ...d, status: 'running' },
        current,
        primary: null,
        analysis: computeAnalysis(current, get().facts, null),
        refreshing: false,
      });
      // E1: persistence is fire-and-forget, concurrent with the open; findings never wait on it
      void (async () => {
        // one macrotask first: a run superseded right away (newer document / clear) writes nothing
        await new Promise((r) => setTimeout(r, 0));
        if (get().seq !== seq) return;
        if (!(await writePackage(toStored(current)))) return;
        for (const doc of current.docs) {
          if (get().seq !== seq) return;
          const s = sources.get(doc.id);
          const f = get().facts[doc.id];
          if (f) void writeFacts(f);
          if (s?.kind !== 'bytes' || !s.storedDocId || isBundled(s)) continue;
          if (s.firmId !== undefined) continue; // an earlier stored document already has its row
          await writeMemberDocument({
            id: s.storedDocId,
            name: s.name,
            kind: 'upload',
            bytes: s.bytes,
            firmId: current.tag.firmId,
            fund: current.tag.fund,
            version: current.tag.version,
            createdAt: current.createdAt,
            packageId: current.id,
          });
        }
      })().catch(() => undefined);
      const opening = openPrimary(false);
      set({ draft: null });
      await opening;
      if (get().seq !== seq) return;
      // one AI allowance per package run (preview stub only, same rule as openUpload)
      const s = sources.get(primaryDoc.id);
      const db = appDb();
      if (
        s?.kind === 'bytes' &&
        !isBundled(s) &&
        useSession.getState().aiOn &&
        db &&
        !apiEnabled()
      ) {
        try {
          await spendAllowance(db);
          await useSession.getState().refreshAllowance();
        } catch {
          /* display-only stub */
        }
      }
    },

    registerSingle: ({ name, bytes, storedDocId, tag, result }) => {
      if (!result.docHash || result.failedStage !== null) return;
      const facts = get().facts;
      const review = useReview.getState();
      if (review.doc?.id !== result.docHash || review.phase !== 'ready') return;
      const primary = result.packageFacts;
      if (!primary) return;
      const lines = result.blocks.map((b) => b.text.trim()).filter((t) => t.length > 0);
      const headText = lines.join('\n').slice(0, 1500);
      const det = detectDocument({
        name,
        titleLines: lines.slice(0, 12).map((t) => t.slice(0, 200)),
        headText,
        headings: result.blocks
          .filter((b) => b.kind === 'heading')
          .slice(0, 200)
          .map((b) => b.text.slice(0, 120)),
      });
      if (det.type !== 'sub_agreement' || det.confidence !== 'high') return;
      const format = (result.source ?? 'html') as PackageFacts['format'];
      const f: PackageFacts = {
        ...emptyFacts(result.docHash, name, format, bytes.byteLength),
        needsOcr: false,
        titleLines: lines.slice(0, 12).map((t) => t.slice(0, 200)),
        headText,
      };
      sources.set(result.docHash, { kind: 'bytes', name, bytes, storedDocId });
      const seq = get().seq + 1;
      const current: CurrentPackage = {
        id: newPackageId(),
        tag: { ...tag },
        docs: [
          {
            id: result.docHash,
            name: name.slice(0, 255),
            ...det,
            role: 'to_digitize',
            confirmed: false,
            suggestionSource: 'rule',
            needsOcr: false,
            format,
            titleLines: [...f.titleLines],
          },
        ],
        primaryDocId: result.docHash,
        confirmedTargets: {},
        createdAt: Date.now(),
      };
      const nextFacts = { ...facts, [result.docHash]: f };
      set({
        seq,
        current,
        facts: nextFacts,
        primary,
        analysis: computeAnalysis(current, nextFacts, primary),
        refreshing: false,
      });
      review.attachPackage(result.docHash, current.id);
      void writePackage(toStored(current));
      void writeFacts(f);
    },

    restore: async (id) => {
      const row = await readPackage(id);
      if (!row) return false;
      const seq = get().seq + 1;
      set({ seq });
      const facts: Record<string, PackageFacts> = {};
      const docs: PackageDocument[] = [];
      for (const sd of row.docs) {
        if (get().seq !== seq) return false;
        let bytes: Uint8Array | null = null;
        if (sd.storedDocId) bytes = await readMemberBytes(sd.storedDocId);
        else if (sd.sampleRef) bytes = await fetchBundled(sd.sampleRef);
        if (sd.sampleRef?.startsWith('scan:')) {
          const scan = await scanOf(sd.sampleRef);
          if (scan)
            sources.set(sd.id, {
              kind: 'scan',
              name: sd.name,
              scan,
              sampleRef: sd.sampleRef,
              sampleId: sd.sampleRef.slice(5),
            });
        } else if (bytes) {
          const sampleId = /^\d{2}-/.exec(sd.sampleRef ?? '')?.[0]?.slice(0, 2);
          sources.set(sd.id, {
            kind: 'bytes',
            name: sd.name,
            bytes,
            ...(sd.storedDocId ? { storedDocId: sd.storedDocId } : {}),
            ...(sd.sampleRef ? { sampleRef: sd.sampleRef } : {}),
            ...(sampleId ? { sampleId } : {}),
          });
        }
        let f = await readFacts(sd.id);
        if (!f && bytes && !sd.sampleRef?.startsWith('scan:')) {
          const r = await lightRead({ name: sd.name, bytes });
          f = r.facts;
        }
        if (f) facts[sd.id] = f;
        docs.push({ ...sd, titleLines: f ? [...f.titleLines] : [] });
      }
      if (get().seq !== seq) return false;
      const current: CurrentPackage = {
        id: row.id,
        tag: { firmId: row.firmId, firmName: row.firmName, fund: row.fund, version: row.version },
        docs,
        primaryDocId: row.primaryDocId,
        confirmedTargets: { ...row.confirmedTargets },
        createdAt: row.createdAt,
      };
      set({
        current,
        facts: { ...get().facts, ...facts },
        primary: null,
        analysis: computeAnalysis(current, { ...get().facts, ...facts }, null),
        draft: null,
      });
      if (!sources.has(row.primaryDocId)) return false;
      await openPrimary(true);
      return true;
    },

    listRecent: () => listPackages(),

    setRole: (docId, role) => {
      const c = get().current;
      const doc = c?.docs.find((d) => d.id === docId);
      if (!c || !doc) return { ok: false, reason: 'unknown_doc' };
      if (docId === c.primaryDocId) return { ok: false, reason: 'primary_locked' };
      if (role === 'to_digitize') return { ok: false, reason: 'role_not_allowed' };
      if (role === 'baseline') {
        if (doc.type !== 'sub_agreement') return { ok: false, reason: 'role_not_allowed' };
        const s = sources.get(docId);
        const firm = s?.kind === 'bytes' ? s.firmId : undefined;
        if (firm !== undefined && firm !== null && firm !== c.tag.firmId)
          return { ok: false, reason: 'cross_firm' };
      }
      const prevKey = sourceKey(c.docs);
      commit({ ...c, docs: editRow(c.docs, docId, { role }) }, prevKey);
      return { ok: true };
    },

    setType: (docId, type) => {
      const c = get().current;
      const doc = c?.docs.find((d) => d.id === docId);
      if (!c || !doc) return { ok: false, reason: 'unknown_doc' };
      if (docId === c.primaryDocId) return { ok: false, reason: 'primary_locked' };
      const patch: Partial<PackageDocument> = { type };
      if (type !== 'sub_agreement' && doc.role === 'baseline') patch.role = 'reference';
      const prevKey = sourceKey(c.docs);
      commit({ ...c, docs: editRow(c.docs, docId, patch) }, prevKey);
      return { ok: true };
    },

    confirmTarget: (targetKey, docId) => {
      const c = get().current;
      if (!c || !targetKey) return;
      if (docId !== 'none' && !c.docs.some((d) => d.id === docId)) return;
      const next = { ...c, confirmedTargets: { ...c.confirmedTargets, [targetKey]: docId } };
      commit(next, sourceKey(c.docs));
    },

    baselineDocs: () =>
      (get().current?.docs ?? [])
        .filter((d) => d.role === 'baseline')
        .map((d) => ({ docId: d.id, name: d.name }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),

    clear: () =>
      set({
        seq: get().seq + 1,
        current: null,
        primary: null,
        analysis: null,
        refreshing: false,
        draft: null,
      }),

    clearDraft: () => set({ seq: get().seq + 1, draft: null }),
  };
});

/** Bundled member bytes by public path (`/samples/...`). */
async function fetchBundled(ref: string): Promise<Uint8Array | null> {
  if (!ref.startsWith('/samples/') && !/^[\w.-]+\.htm$/.test(ref)) return null;
  try {
    const res = await fetch(ref.startsWith('/') ? ref : `/samples/${ref}`);
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Scan set pages of a `scan:NN` reference from the sample manifest. */
async function scanOf(ref: string): Promise<ScanSetInput | null> {
  const entry = (await loadManifest()).find((s) => `scan:${s.id}` === ref);
  if (!entry) return null;
  const pages = scanPagesOf(entry);
  return pages.length
    ? { pages: pages.map((p) => ({ n: p.n, url: `/samples/${p.file}`, sourceHash: p.sourceHash })) }
    : null;
}
