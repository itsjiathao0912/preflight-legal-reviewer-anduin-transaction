import { create } from 'zustand';
import type { ReasonCode } from '@aduin/core';
import { memoryApi } from '../api/client';
import type { MemoryApi } from '../api/memoryApi';
import { e2eSettings, e2eTransform } from '../e2e-hook';
import { analyzeInWorker, rememberInput } from '../engine/client';
import { runOcrQueue, sha256Hex, type OcrJob } from '../engine/ocr-queue';
import { imageKindOf, renderImage, renderPdfPages } from '../engine/render-pages';
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
import { ANALYST_NAME } from './session';

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
    opts?: { fileName?: string },
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
  /** Phase 05: replace this document's AI findings (verified in the engine worker) and re-label memory. */
  setAiFindings: (docId: string, findings: FindingView[]) => Promise<void>;
}

let toastSeq = 0;
let loadSeq = 0;

type InputKind = 'html' | 'pdf' | 'docx' | 'image';

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
): Promise<EngineResult> {
  const kind = inputKindOf(fileName);
  const name = fileName ?? '';
  const onOcr = (pages: OcrPageInput[]) =>
    onStage({ id: 'read', state: 'running', sub: ocrProgressSub(pages) });
  let input: AnalyzeInput;
  if (kind === 'html' && fileName === undefined) {
    return analyzeInWorker(bytes, settings, onStage);
  } else if (kind === 'html' || kind === 'docx') {
    input = { kind, bytes, name };
  } else if (kind === 'image' && !imageKindOf(bytes)) {
    // not a JPEG/PNG: the worker's format check refuses it with a clear message (never OCR'd)
    input = { kind: 'html', bytes, name };
  } else if (kind === 'image') {
    const sourceHash = await sha256Hex(bytes);
    const pages = await runOcrQueue({
      sourceHash,
      jobs: [{ index: 0, render: () => renderImage(bytes, 0) }],
      onProgress: onOcr,
    });
    input = { kind: 'ocr', sourceHash, pageCount: 1, pages, bytes: bytes.byteLength };
  } else {
    input = { kind: 'pdf', bytes, name };
    const first = await analyzeInWorker(input, settings, onStage);
    const scan = first.scanPages ?? [];
    if (first.failedStage !== null || scan.length === 0) {
      rememberInput(bytes, input);
      return first;
    }
    const jobs: OcrJob[] = scan.map((index) => ({
      index,
      render: async () => {
        const [p] = await renderPdfPages(bytes, [index]);
        if (!p) throw new Error('The page could not be rendered.');
        return p;
      },
    }));
    const ocrPages = await runOcrQueue({ sourceHash: first.docHash, jobs, onProgress: onOcr });
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

export const useReview = create<ReviewState>((set, get) => {
  const findingById = (id: string): FindingView | undefined =>
    get().result?.findings.find((f) => f.id === id);
  const api = (): MemoryApi | null => memoryApi();

  const refreshMemory = async () => {
    const { result, doc } = get();
    if (!result || !doc) return;
    const memory = await fingerprintFindings(result.findings, doc.firmId, api());
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

  /** Write a memory decision when the document has a firm; returns the decision id (or null). */
  const decide = async (
    id: string,
    decision: 'dismissed' | 'accepted',
    reason?: ReasonCode,
    note?: string,
  ): Promise<string | null> => {
    const { doc, memory } = get();
    const f = findingById(id);
    const fp = memory?.byId[id]?.fingerprint ?? null;
    const a = api();
    if (!doc || !f || !doc.firmId || !fp || !a) return null;
    try {
      const d = await a.decide({
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
        decided_by_name: ANALYST_NAME,
      });
      return d.id;
    } catch {
      return null;
    }
  };

  const revoke = async (decisionId: string | null | undefined, reason: string) => {
    const a = api();
    if (!decisionId || !a) return;
    try {
      await a.revoke(decisionId, reason);
    } catch {
      /* already revoked or unavailable */
    }
  };

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
      const seq = ++loadSeq;
      aiBeginOpen();
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
      // Phase 05 AI lane: static precomputed lookup + verify before the list shows (never /api/ai here)
      const ai = await aiOnOpen(bytes, result, {
        id: doc.id,
        docHash: result.docHash,
        source: meta.source,
        firmId: meta.firmId,
      });
      if (seq !== loadSeq) return;
      if (ai.findings.length)
        result = { ...result, findings: [...result.findings, ...ai.findings] };
      const stages: Partial<Record<StageId, StageReport>> = {};
      for (const s of result.stages) stages[s.id] = s;
      const triage = await loadTriage(doc.id);
      const memory = await fingerprintFindings(result.findings, doc.firmId, api());
      if (seq !== loadSeq) return;
      const recent = [doc, ...get().recent.filter((r) => r.id !== doc.id)].slice(0, 6);
      const rows = buildRows(result.findings, memory, triage);
      const first = visibleRows(placement(rows).main, useFilters.getState())[0]?.f.id ?? null;
      set({ phase: 'ready', doc, recent, result, stages, memory, triage, selectedId: first });
      // uploads only: a fresh AI review starts once the deterministic list is on screen
      if (ai.fresh) void aiRunFresh();
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

    setAiFindings: async (docId, findings) => {
      const { doc, result } = get();
      if (!doc || doc.id !== docId || !result) return;
      const kept = result.findings.filter((f) => f.detector_kind !== 'ai');
      if (kept.length === result.findings.length && findings.length === 0) return;
      set({ result: { ...result, findings: [...kept, ...findings] } });
      await refreshMemory();
    },
  };
});

setAiSink((docId, findings) => void useReview.getState().setAiFindings(docId, findings));
