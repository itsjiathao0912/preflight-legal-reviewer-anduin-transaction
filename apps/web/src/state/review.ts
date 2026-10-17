import { create } from 'zustand';
import {
  templateInterpretations,
  type CounselOption,
  type FindingWire,
  type ReasonCode,
} from '@aduin/core';
import { memoryApi } from '../api/client';
import type { MemoryApi } from '../api/memoryApi';
import { recordOpen } from '../features/metrics/metrics-store';
import { readQuestionIds } from '../features/counsel/question-ids';
import { e2eSettings, e2eTransform } from '../e2e-hook';
import { analyzeInWorker, rememberInput } from '../engine/client';
import { runOcrQueue, sha256Hex, type OcrJob } from '../engine/ocr-queue';
import {
  imageKindOf,
  renderImage,
  renderPdfPages,
  type RenderedPage,
} from '../engine/render-pages';
import { useScan } from '../features/scan/scan-store';
import { aiBeginOpen, aiOnOpen, aiRunFresh, setAiSink } from '../features/ai/ai-lane';
import type {
  AnalyzeInput,
  EngineResult,
  EngineSettings,
  FindingView,
  OcrPageInput,
  StageId,
  StageReport,
} from '../engine/types';
import {
  buildRows,
  computeGate,
  placement,
  visibleRows,
  type Triage,
} from '../features/review/model';
import { fingerprintFindings, type MemoryResult } from '../memory/fingerprintFindings';
import { appDb } from '../storage/db';
import { useFilters } from './filters';
import {
  ensureSession,
  ensureSessionWithin,
  flushOutbox,
  memoryDown,
  onSyncEvent,
  outbox,
  outboxDocFor,
  setFindingsProvider,
  toFindingWire,
  writesDisabled,
} from './memory-sync';
import { useSession } from './session';
import { markUserIntent } from '../features/ai/turnstile';

export interface DocMeta {
  id: string;
  name: string;
  firmId: string | null;
  firmName: string;
  fund: string;
  version: string;
  source: 'sample' | 'upload';
  sampleId?: string;
  /** Sample file or upload id, used to reopen from the document switcher. */
  ref: string;
}

export interface Toast {
  id: number;
  msg: string;
  undo: (() => void) | null;
}

export const STAGE_ORDER: StageId[] = ['read', 'structure', 'checks', 'ai', 'done'];

type Phase = 'empty' | 'loading' | 'ready' | 'error';

interface ReviewState {
  phase: Phase;
  doc: DocMeta | null;
  recent: DocMeta[];
  result: EngineResult | null;
  stages: Partial<Record<StageId, StageReport>>;
  memory: MemoryResult | null;
  triage: Record<string, Triage>;
  selectedId: string | null;
  /** Bumped on every explicit selection so the document pane scrolls even when re-selecting. */
  selectSeq: number;
  revealed: boolean;
  toast: Toast | null;
  error: string | null;
  /**
   * Phase 06: `opts.fileName` selects the adapter by extension (pdf / docx / jpg / jpeg / png);
   * without it the bytes are HTML (Phase 03 behaviour).
   */
  openDocument: (
    bytes: Uint8Array,
    meta: Omit<DocMeta, 'id'>,
    opts?: { fileName?: string; scan?: ScanSetInput },
  ) => Promise<void>;
  select: (id: string | null) => void;
  toggleReveal: () => void;
  accept: (id: string) => Promise<void>;
  needsCounsel: (id: string) => Promise<void>;
  dismiss: (id: string, reason: ReasonCode, note: string) => Promise<string | null>;
  restore: (id: string) => Promise<void>;
  reopen: (id: string) => Promise<void>;
  showToast: (msg: string, undo?: (() => void) | null) => void;
  clearToast: () => void;
  /** E2E seam: set a counsel answer recorded for a finding in this document. */
  setCounselAnswer: (id: string, option: Triage['counselAnswer']) => Promise<void>;
  /**
   * Phase 08: record counsel's answer (A/B/C/unclear + note + who + when) for a finding of this
   * document. Writes counsel_answer + a superseding `answered` decision through the outbox (the
   * question is created at send time when it was not exported yet); undoable.
   */
  recordAnswer: (id: string, answer: RecordedAnswer) => Promise<void>;
  /**
   * Phase 08b (memory page): re-read memory for the open document after a write made elsewhere.
   * When `revokedDecisionId` is given (Reopen), any triage entry of this document whose decisionId
   * equals it is reset to `open`, so the finding is New on this review too (AC50).
   */
  /**
   * Refetch memory labels. With a revoked decision (Firm memory Reopen), local triage that carries
   * it is cleared first: an accepted/dismissed decision returns the finding to open, an answered one
   * drops the local counsel answer so the gate re-evaluates. `match` (fingerprint + kind of the
   * revoked row) also catches entries still holding an optimistic `pending:<op>` id.
   */
  refreshMemory: (
    revokedDecisionId?: string,
    match?: { fingerprint: string; decision: 'dismissed' | 'accepted' | 'answered' },
  ) => Promise<void>;
  /** Phase 05: replace this document's AI findings (verified in the engine worker) and re-label memory. */
  setAiFindings: (docId: string, findings: FindingView[]) => Promise<void>;
  /**
   * "Memory unavailable" Retry: explicit user intent, so a cached verification failure is dropped
   * and the session bootstrap may show an interactive challenge; then memory is read again.
   */
  retryMemory: () => Promise<void>;
}

export interface RecordedAnswer {
  option: CounselOption;
  note?: string;
  /** Who answered (counsel), free text. */
  by: string;
  /** Answer date, epoch ms. */
  at: number;
}

let toastSeq = 0;
let loadSeq = 0;
/** Review F3: one controller per load; a newer openDocument aborts the older OCR queue. */
let loadAbort: AbortController | null = null;

/** The load this analysis belongs to; `live()` is false once a newer document was opened. */
interface LoadToken {
  signal: AbortSignal;
  live: () => boolean;
}

class SupersededError extends Error {}

type InputKind = 'html' | 'pdf' | 'docx' | 'image';

/** Phase 06f: a bundled multi-page scan set (sample #9): page image URLs + original-bytes hashes. */
export interface ScanSetInput {
  pages: { n: number; url: string; sourceHash: string }[];
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Adapter by file extension (the worker re-checks extension + magic bytes). */
export function inputKindOf(fileName: string | undefined): InputKind {
  const m = fileName?.toLowerCase().match(/\.([a-z0-9]{1,10})$/);
  const ext = m?.[1];
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') return 'image';
  return 'html';
}

function ocrProgressSub(pages: readonly OcrPageInput[]): string {
  const done = pages.filter((p) => p.state !== 'queued' && p.state !== 'running').length;
  return `Reading scanned pages · ${done} of ${pages.length}`;
}

/**
 * Phase 06 read dispatch: HTML / DOCX go straight to the engine worker; scanned images and the
 * scan pages of a PDF are rendered here (main thread), OCR'd through the queue, and the OCR lines
 * are analyzed in the worker. Only page images ever go to /api/ocr, never the PDF.
 */
async function analyzeDocument(
  bytes: Uint8Array,
  fileName: string | undefined,
  settings: EngineSettings,
  onStage: (s: StageReport) => void,
  scanSet: ScanSetInput | undefined,
  load: LoadToken,
): Promise<EngineResult> {
  const kind = inputKindOf(fileName);
  const name = fileName ?? '';
  const store = useScan.getState();
  let seq = store.seq;
  /** Throws when a newer document took over, so no scan-store write lands for this one. */
  const ensureLive = () => {
    if (!load.live()) throw new SupersededError();
  };
  // F2: page images leave the browser only while AI review is on (consent re-read before each page, N3)
  const ocrOpts = { signal: load.signal, aiOff: () => !useSession.getState().aiOn };
  const onOcr = (pages: OcrPageInput[]) => {
    if (!load.live()) return;
    store.setProgress(seq, pages);
    onStage({ id: 'read', state: 'running', sub: ocrProgressSub(pages) });
  };
  let input: AnalyzeInput;
  if (scanSet) {
    const pages = scanSet.pages.filter((p) => HEX64.test(p.sourceHash)).slice(0, 30);
    const urls: Record<number, string> = {};
    pages.forEach((p, i) => (urls[i] = p.url));
    ensureLive();
    seq = store.begin(pages.length, urls);
    const sourceHash = await sha256Hex(pages.map((p) => p.sourceHash).join('|'));
    ensureLive();
    const ocrPages = await runOcrQueue({
      ...ocrOpts,
      sourceHash,
      jobs: pages.map((p, i) => ({
        index: i,
        sourceHash: p.sourceHash,
        render: async () => {
          const res = await fetch(p.url);
          if (!res.ok) throw new Error('The page image could not be loaded.');
          return renderImage(new Uint8Array(await res.arrayBuffer()), i);
        },
      })),
      onProgress: onOcr,
    });
    ensureLive();
    input = { kind: 'ocr', sourceHash, pageCount: pages.length, pages: ocrPages };
    rememberInput(bytes, input);
    return analyzeInWorker(input, settings, onStage);
  }
  if (kind === 'html' && fileName === undefined) {
    return analyzeInWorker(bytes, settings, onStage);
  } else if (kind === 'html' || kind === 'docx') {
    input = { kind, bytes, name };
  } else if (kind === 'image' && !imageKindOf(bytes)) {
    // not a JPEG/PNG: the worker's format check refuses it with a clear message (never OCR'd)
    input = { kind: 'html', bytes, name };
  } else if (kind === 'image') {
    ensureLive();
    seq = store.begin(1);
    const mime = imageKindOf(bytes) === 'png' ? 'image/png' : 'image/jpeg';
    // local display only (the bytes never leave the browser; OCR gets the re-encoded JPEG)
    store.setUrl(seq, 0, URL.createObjectURL(new Blob([bytes.slice()], { type: mime })), true);
    const sourceHash = await sha256Hex(bytes);
    ensureLive();
    const pages = await runOcrQueue({
      ...ocrOpts,
      sourceHash,
      jobs: [{ index: 0, render: () => renderImage(bytes, 0) }],
      onProgress: onOcr,
    });
    ensureLive();
    input = { kind: 'ocr', sourceHash, pageCount: 1, pages, bytes: bytes.byteLength };
  } else {
    input = { kind: 'pdf', bytes, name };
    const first = await analyzeInWorker(input, settings, onStage);
    const scan = first.scanPages ?? [];
    if (first.failedStage !== null || scan.length === 0) {
      rememberInput(bytes, input);
      return first;
    }
    ensureLive();
    seq = useScan.getState().begin(first.pageCount ?? 0);
    const renders = new Map<number, Promise<RenderedPage>>();
    const renderOnce = (index: number): Promise<RenderedPage> => {
      let r = renders.get(index);
      if (!r) {
        r = renderPdfPages(bytes, [index]).then(([p]) => {
          if (!p) throw new Error('The page could not be rendered.');
          if (load.live()) useScan.getState().setUrl(seq, index, URL.createObjectURL(p.jpeg), true);
          return p;
        });
        renders.set(index, r);
      }
      return r;
    };
    // page images for the viewer, one page at a time (bounded memory); OCR reuses them
    void (async () => {
      for (const i of scan) {
        if (!load.live() || useScan.getState().seq !== seq) return;
        await renderOnce(i).catch(() => undefined);
      }
    })();
    const jobs: OcrJob[] = scan.map((index) => ({ index, render: () => renderOnce(index) }));
    const ocrPages = await runOcrQueue({
      ...ocrOpts,
      sourceHash: first.docHash,
      jobs,
      onProgress: onOcr,
    });
    ensureLive();
    input = { kind: 'pdf', bytes, name, ocrPages };
  }
  rememberInput(bytes, input);
  return analyzeInWorker(input, settings, onStage);
}

function triageKey(docId: string) {
  return `triage:${docId}`;
}

async function loadTriage(docId: string): Promise<Record<string, Triage>> {
  const db = appDb();
  if (!db) return {};
  try {
    const row = await db.uiState.get(triageKey(docId));
    const v = row?.value;
    return v && typeof v === 'object' ? (v as Record<string, Triage>) : {};
  } catch {
    return {};
  }
}

async function saveTriage(docId: string, triage: Record<string, Triage>): Promise<void> {
  const db = appDb();
  if (!db) return;
  try {
    await db.uiState.put({ key: triageKey(docId), value: triage, updatedAt: Date.now() });
  } catch {
    /* storage unavailable: state stays in memory */
  }
}

function opId(): string {
  return `op_${crypto.randomUUID().replace(/-/g, '')}`;
}

/** Wire findings captured at enqueue time per document (an op may drain after a switch). */
const WIRE_DOCS = 4;
const wireCache = new Map<string, Map<string, FindingWire>>();
function rememberWires(docHash: string, wires: FindingWire[]): void {
  let m = wireCache.get(docHash);
  if (!m) {
    m = new Map();
    wireCache.set(docHash, m);
    while (wireCache.size > WIRE_DOCS) wireCache.delete(wireCache.keys().next().value!);
  }
  for (const w of wires) m.set(w.id, w);
}

export const useReview = create<ReviewState>((set, get) => {
  const findingById = (id: string): FindingView | undefined =>
    get().result?.findings.find((f) => f.id === id);
  const api = (): MemoryApi | null => memoryApi();

  const refreshMemory = async () => {
    const { result, doc } = get();
    if (!result || !doc) return;
    const memory = await fingerprintFindings(result.findings, doc.firmId, api());
    // a newer document (or a newer finding set) owns the labels now
    if (get().result !== result || get().doc !== doc) return;
    set({ memory });
  };

  const writeTriage = async (id: string, t: Triage | null) => {
    const { doc } = get();
    if (!doc) return;
    const triage = { ...get().triage };
    if (t) triage[id] = t;
    else delete triage[id];
    set({ triage });
    await saveTriage(doc.id, triage);
  };

  /** Wire findings for keys of the open document (fingerprinted ones only). */
  const wiresFor = (keys: readonly string[]): FindingWire[] => {
    const { result, memory } = get();
    const want = new Set(keys);
    const out: FindingWire[] = [];
    for (const f of result?.findings ?? []) {
      const fp = want.has(f.id) ? memory?.byId[f.id]?.fingerprint : null;
      if (fp) out.push(toFindingWire(f, fp));
    }
    return out;
  };

  setFindingsProvider((key, keys) => {
    const cached = wireCache.get(key.doc_hash);
    const out = keys.flatMap((k) => {
      const w = cached?.get(k);
      return w ? [w] : [];
    });
    if (out.length === keys.length) return out;
    return get().doc?.id === key.doc_hash ? wiresFor(keys) : out;
  });

  /**
   * Queue a memory decision when the document has a firm (outbox, Phase 08). Returns the optimistic
   * `pending:<op>` id (mapped to the real id when the op drains), or null when nothing is written
   * (no firm, no fingerprint, read-only session, no storage).
   */
  const decide = async (
    id: string,
    decision: 'dismissed' | 'accepted',
    reason?: ReasonCode,
    note?: string,
  ): Promise<string | null> => {
    const { doc, memory } = get();
    const f = findingById(id);
    const fp = memory?.byId[id]?.fingerprint ?? null;
    const box = outbox();
    if (!doc || !f || !doc.firmId || !fp || !box || writesDisabled() || memoryDown()) return null;
    try {
      // explicit write: verification may be interactive, but the write never hangs on it
      markUserIntent();
      await ensureSessionWithin();
      if (writesDisabled() || memoryDown()) return null;
      rememberWires(doc.id, wiresFor([id]));
      const d = await box.enqueueDecide(await outboxDocFor(doc), {
        client_op_id: opId(),
        law_firm_id: doc.firmId,
        finding_ref: f.id,
        decision,
        ...(reason ? { reason_code: reason } : {}),
        ...(note ? { note } : {}),
        quote_text: f.quote,
        fingerprint: fp,
        issue_class: f.issue_class,
        ...(f.pattern_key ? { pattern_key: f.pattern_key } : {}),
        fund_name: doc.fund,
        doc_version_label: doc.version,
        section_path: f.section_path,
        quote_snippet: f.quote_snippet,
        decided_by_name: useSession.getState().analystName,
      });
      void flushOutbox();
      return d;
    } catch {
      return null;
    }
  };

  /** Revoke a decision: a still-pending one is cancelled, a synced one is revoked by its id. */
  const revoke = async (decisionId: string | null | undefined, reason: string) => {
    const box = outbox();
    if (!decisionId || !box || writesDisabled()) return;
    try {
      await box.enqueueRevoke(decisionId, reason);
    } catch {
      /* storage unavailable */
    }
    await flushOutbox();
  };

  /** Queue a counsel answer; returns the optimistic `pending:<op>` id or null when not persisted. */
  const persistAnswer = async (id: string, a: RecordedAnswer): Promise<string | null> => {
    const { doc, memory } = get();
    const f = findingById(id);
    const fp = memory?.byId[id]?.fingerprint ?? null;
    const box = outbox();
    // no firm: the Worker refuses questions and answers (`firm_required`); triage stays local
    if (!doc || !f || !doc.firmId || !fp || !box || writesDisabled() || memoryDown()) return null;
    try {
      // explicit write: verification may be interactive, but the write never hangs on it
      markUserIntent();
      await ensureSessionWithin();
      if (writesDisabled() || memoryDown()) return null;
      rememberWires(doc.id, wiresFor([id]));
      const qid = (await readQuestionIds(doc.id))[id];
      const note = a.note?.trim();
      const pid = await box.enqueueAnswer(
        await outboxDocFor(doc),
        {
          client_op_id: opId(),
          law_firm_id: doc.firmId,
          ...(qid ? { question_id: qid } : {}),
          quote_text: f.quote,
          fingerprint: fp,
          issue_class: f.issue_class,
          counsel_option: a.option,
          ...(note ? { counsel_note: note.slice(0, 1000) } : {}),
          ...(doc.fund ? { fund_name: doc.fund } : {}),
          quote_snippet: f.quote_snippet,
          decided_by_name: useSession.getState().analystName,
        },
        qid
          ? undefined
          : {
              finding_ref: f.id,
              fingerprint: fp,
              interpretations: templateInterpretations(f.issue_class),
            },
      );
      void flushOutbox();
      return pid;
    } catch {
      return null;
    }
  };

  const gateLine = (): string => {
    const n = computeGate(buildRows(get().result?.findings ?? [], get().memory, get().triage))
      .reasons.length;
    return n ? `${n} item${n > 1 ? 's' : ''} left on the gate.` : 'The gate is now Ready.';
  };

  onSyncEvent((e) => {
    // 409: another decision is active for this finding; show the current one
    if (e.type === 'conflict') void refreshMemory();
  });

  /** Restore a previous triage snapshot (undo), re-creating its memory decision when it had one. */
  const restoreSnapshot = async (id: string, prev: Triage | null, created: string | null) => {
    await revoke(created, 'Undone by analyst');
    let next = prev;
    if (prev?.decisionId && (prev.status === 'accepted' || prev.status === 'dismissed')) {
      const again = await decide(
        id,
        prev.status === 'accepted' ? 'accepted' : 'dismissed',
        prev.reasonCode,
        prev.note,
      );
      next = { ...prev, decisionId: again };
    }
    await writeTriage(id, next);
    set({ selectedId: id });
  };

  return {
    phase: 'empty',
    doc: null,
    recent: [],
    result: null,
    stages: {},
    memory: null,
    triage: {},
    selectedId: null,
    selectSeq: 0,
    revealed: false,
    toast: null,
    error: null,

    openDocument: async (bytes, meta, opts) => {
      // AC64: time to an exportable sheet starts when the analyst opens the document
      const t0 = Date.now();
      const seq = ++loadSeq;
      loadAbort?.abort();
      const ctrl = new AbortController();
      loadAbort = ctrl;
      aiBeginOpen();
      useScan.getState().clear();
      set({
        phase: 'loading',
        error: null,
        result: null,
        memory: null,
        triage: {},
        selectedId: null,
        revealed: false,
        stages: { read: { id: 'read', state: 'running', sub: 'Reading the document' } },
      });
      let result: EngineResult;
      try {
        result = await analyzeDocument(
          bytes,
          opts?.fileName,
          { ...(meta.sampleId ? { sampleId: meta.sampleId } : {}), ...e2eSettings() },
          (s) => {
            if (seq === loadSeq) set({ stages: { ...get().stages, [s.id]: s } });
          },
          opts?.scan,
          { signal: ctrl.signal, live: () => seq === loadSeq },
        );
      } catch {
        if (seq === loadSeq) {
          set({
            phase: 'error',
            error: 'The document could not be processed.',
            stages: {
              ...get().stages,
              read: { id: 'read', state: 'failed', sub: 'Failed · the engine stopped' },
            },
          });
        }
        return;
      }
      if (seq !== loadSeq) return;
      result = { ...result, findings: e2eTransform(result.findings, result.blocks) };
      const doc: DocMeta = { ...meta, id: result.docHash || `doc_${seq}` };
      const stages: Partial<Record<StageId, StageReport>> = {};
      for (const s of result.stages) stages[s.id] = s;
      void recordOpen(doc.id, t0);
      const triage = await loadTriage(doc.id);
      if (seq !== loadSeq) return;
      // Render first: deterministic findings never wait on the network or Turnstile. Labels start
      // as New (fingerprints computed locally, no lookup); memory and AI arrive in the background.
      const local = await fingerprintFindings(result.findings, doc.firmId, null);
      if (seq !== loadSeq) return;
      const memory: MemoryResult = doc.firmId
        ? { ...local, unavailable: false, pending: true }
        : local;
      const recent = [doc, ...get().recent.filter((r) => r.id !== doc.id)].slice(0, 6);
      const rows = buildRows(result.findings, memory, triage);
      const first = visibleRows(placement(rows).main, useFilters.getState())[0]?.f.id ?? null;
      set({ phase: 'ready', doc, recent, result, stages, memory, triage, selectedId: first });
      const live = () => seq === loadSeq && get().doc === doc;
      const engineResult = result;
      // Phase 05 AI lane: static precomputed lookup + verify (never /api/ai for samples here)
      void (async () => {
        const ai = await aiOnOpen(bytes, engineResult, {
          id: doc.id,
          docHash: engineResult.docHash,
          source: meta.source,
          firmId: meta.firmId,
        });
        if (!live()) return;
        if (ai.findings.length) await get().setAiFindings(doc.id, ai.findings);
        // uploads only: a fresh AI review starts once the deterministic list is on screen
        if (ai.fresh && live()) void aiRunFresh();
      })().catch(() => undefined);
      // memory: bootstrap (firm documents only: no firm, no memory call), then queued writes land
      // before memory is read back; a failure shows "Memory unavailable" (Retry)
      void (async () => {
        if (doc.firmId) await ensureSession();
        await flushOutbox();
        if (!live() || !doc.firmId) return;
        await refreshMemory();
      })().catch(() => undefined);
      const db = appDb();
      if (db) {
        db.parsedModels
          .put({
            docHash: doc.id,
            createdAt: Date.now(),
            model: { blocks: result.blocks.length, findings: result.findings.length },
          })
          .catch(() => undefined);
      }
    },

    select: (id) => set({ selectedId: id, selectSeq: get().selectSeq + 1 }),
    toggleReveal: () => set({ revealed: !get().revealed }),

    accept: async (id) => {
      const prev = get().triage[id] ?? null;
      const was = prev?.status === 'accepted';
      let created: string | null = null;
      if (was) {
        await revoke(prev?.decisionId, 'Accept removed by analyst');
        await writeTriage(id, { status: 'open' });
      } else {
        created = await decide(id, 'accepted');
        await writeTriage(id, { ...(prev ?? {}), status: 'accepted', decisionId: created });
      }
      get().showToast(
        was ? 'Accept removed.' : 'Finding accepted.',
        () => void restoreSnapshot(id, prev, created),
      );
    },

    needsCounsel: async (id) => {
      const prev = get().triage[id] ?? null;
      const on = prev?.status !== 'counsel';
      await writeTriage(id, { ...(prev ?? {}), status: on ? 'counsel' : 'open' });
      get().showToast(
        on ? 'Added to the counsel questions draft.' : 'Removed from the counsel questions draft.',
        () => void restoreSnapshot(id, prev, null),
      );
    },

    dismiss: async (id, reason, note) => {
      const prev = get().triage[id] ?? null;
      const wasRe = get().memory?.byId[id]?.label === 'dismissed_reconfirm';
      const before = visibleRows(
        placement(buildRows(get().result?.findings ?? [], get().memory, get().triage)).main,
        useFilters.getState(),
      ).map((r) => r.f.id);
      const idx = before.indexOf(id);
      const created = await decide(id, 'dismissed', reason, note);
      await writeTriage(id, {
        status: 'dismissed',
        reasonCode: reason,
        ...(note ? { note } : {}),
        decisionId: created,
      });
      const after = visibleRows(
        placement(buildRows(get().result?.findings ?? [], get().memory, get().triage)).main,
        useFilters.getState(),
      ).map((r) => r.f.id);
      const next = after.length ? after[Math.min(Math.max(idx, 0), after.length - 1)]! : null;
      set({ selectedId: next ?? id, selectSeq: get().selectSeq + 1 });
      const left = computeGate(buildRows(get().result?.findings ?? [], get().memory, get().triage))
        .reasons.length;
      get().showToast(
        (wasRe ? 'Re-confirmed. ' : 'Dismissed. ') +
          (left ? `${left} blocking reason${left > 1 ? 's' : ''} left.` : 'The gate is now Ready.'),
        () => void restoreSnapshot(id, prev, created),
      );
      return next;
    },

    restore: async (id) => {
      const prev = get().triage[id] ?? null;
      await revoke(prev?.decisionId, 'Restored by analyst');
      await writeTriage(id, { status: 'open' });
      set({ selectedId: id });
      get().showToast('Finding restored.');
    },

    reopen: async (id) => {
      const prior = get().memory?.byId[id]?.prior;
      await revoke(prior?.id, 'Reopened by analyst');
      await refreshMemory();
      get().showToast(
        'Decision reopened. It is kept in the audit trail and the finding is New again.',
      );
    },

    showToast: (msg, undo = null) => set({ toast: { id: ++toastSeq, msg, undo } }),
    clearToast: () => set({ toast: null }),

    setCounselAnswer: async (id, option) => {
      const prev = get().triage[id] ?? { status: 'open' as const };
      await writeTriage(id, { ...prev, counselAnswer: option });
    },

    recordAnswer: async (id, a) => {
      const prev = get().triage[id] ?? null;
      const base: Triage = prev ?? { status: 'open' };
      // a changed answer supersedes the earlier one in memory (revoke it first)
      if (prev?.answerId) await revoke(prev.answerId, 'Answer changed by analyst');
      const note = a.note?.trim();
      const next: Triage = {
        ...base,
        counselAnswer: a.option,
        answeredBy: a.by.trim().slice(0, 120),
        answeredAt: a.at,
        answerId: null,
      };
      if (note) next.counselNote = note.slice(0, 1000);
      else delete next.counselNote;
      await writeTriage(id, next);
      const created = await persistAnswer(id, a);
      if (created) await writeTriage(id, { ...next, answerId: created });
      get().showToast(
        (a.option === 'unclear' ? 'Recorded as unclear. ' : 'Answer recorded. ') + gateLine(),
        () =>
          void (async () => {
            await revoke(created, 'Answer undone by analyst');
            await writeTriage(id, prev);
          })(),
      );
    },

    refreshMemory: async (revokedDecisionId, match) => {
      const { doc, triage, memory } = get();
      if (doc && revokedDecisionId) {
        const fpOf = (k: string) => memory?.byId[k]?.fingerprint ?? null;
        const pendingFp = (id: string | null | undefined, k: string) =>
          !!match && !!id && id.startsWith('pending:') && fpOf(k) === match.fingerprint;
        const next = { ...triage };
        let changed = false;
        for (const k of Object.keys(triage)) {
          const t = triage[k];
          if (!t) continue;
          const answered =
            !match || match.decision === 'answered'
              ? t.answerId === revokedDecisionId || pendingFp(t.answerId, k)
              : false;
          const decided =
            !match || match.decision !== 'answered'
              ? t.decisionId === revokedDecisionId || pendingFp(t.decisionId, k)
              : false;
          if (!answered && !decided) continue;
          // keep unrelated fields (an active counsel answer survives a reopened dismissal)
          let e: Triage = { ...t };
          if (decided) e = { ...e, status: 'open', decisionId: undefined };
          if (answered) {
            delete e.counselAnswer;
            delete e.answeredBy;
            delete e.answeredAt;
            delete e.counselNote;
            delete e.answerId;
          }
          next[k] = e;
          changed = true;
        }
        if (changed) {
          set({ triage: next });
          await saveTriage(doc.id, next);
        }
      }
      await refreshMemory();
    },

    setAiFindings: async (docId, findings) => {
      const { doc, result } = get();
      if (!doc || doc.id !== docId || !result) return;
      const kept = result.findings.filter((f) => f.detector_kind !== 'ai');
      if (kept.length === result.findings.length && findings.length === 0) return;
      set({ result: { ...result, findings: [...kept, ...findings] } });
      await refreshMemory();
    },

    retryMemory: async () => {
      markUserIntent();
      await refreshMemory();
    },
  };
});

setAiSink((docId, findings) => void useReview.getState().setAiFindings(docId, findings));
