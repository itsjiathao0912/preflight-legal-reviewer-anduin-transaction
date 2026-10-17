import { create } from 'zustand';
import { e2eVarianceSettings } from '../../e2e-hook';
import { runVarianceInWorker } from '../../engine/client';
import type { EngineResult } from '../../engine/types';
import { usePackage } from '../../state/package';
import { useReview, type DocMeta } from '../../state/review';
import {
  becomeFirmBaseline,
  listBaselineCandidates,
  packageContext,
  resolveBaseline,
  setBaseline,
  type SetBaselineResult,
} from './baseline-source';
import { setVarianceSource, type VarianceSlice } from './select';
import {
  BYTES_GONE_LINE,
  ERROR_LINE,
  ignoredLine,
  NO_BASELINE_LINE,
  NO_BASELINE_SHORT_LINE,
  SCAN_BASELINE_LINE,
  SCAN_CURRENT_LINE,
  VARIANCE_PENDING_TIMEOUT_MS,
  type BaselineRef,
  type VarianceStatus,
  type VarianceView,
} from './types';

/**
 * Variance Phase 02 store. A second local pass that starts only after deterministic findings are
 * set (render-first): `resolving` is set in the SAME synchronous update that sets the findings, so
 * the pill never flashes Ready then Blocked. Results of a superseded run are dropped by run id.
 * Persisted client state lives only in `uiState` (the firm pointer, `variance:baseline:{firmId}`);
 * change-row triage uses the existing review triage store (D4). No Dexie version bump.
 */
export interface VarianceState {
  status: VarianceStatus;
  docId: string | null;
  runId: number;
  baseline: BaselineRef | null;
  /** Other baselines ignored (one baseline per review). */
  ignored: number;
  /** The one muted line under the segment (no baseline, scan, text gone, error). */
  line: string | null;
  result: VarianceView | null;
  candidates: BaselineRef[];
  /** Start a pass for the open document (normally called by the review subscription). */
  run: (doc: DocMeta, result: EngineResult) => Promise<void>;
  /** Change the baseline from the header modal, then re-run. */
  choose: (docId: string) => Promise<SetBaselineResult>;
  /** Re-read the modal's candidates. */
  loadCandidates: () => Promise<BaselineRef[]>;
  reset: () => void;
}

let runSeq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

export function isPending(s: Pick<VarianceState, 'status'>): boolean {
  return s.status === 'resolving' || s.status === 'running';
}

/** Only an uploaded document with a firm becomes the firm's baseline after its review. */
function noBaselineLine(doc: DocMeta): string {
  return doc.source === 'upload' ? NO_BASELINE_LINE : NO_BASELINE_SHORT_LINE;
}

function isScanResult(r: EngineResult): boolean {
  return r.source === 'ocr' || (r.scanPages?.length ?? 0) > 0;
}

const IDLE = {
  status: 'idle' as VarianceStatus,
  docId: null,
  baseline: null,
  ignored: 0,
  line: null,
  result: null,
  candidates: [] as BaselineRef[],
};

export const useVariance = create<VarianceState>((set, get) => {
  const live = (id: number) => get().runId === id;

  const refreshCandidates = async (id: number, doc: DocMeta) => {
    const candidates = await listBaselineCandidates(doc).catch(() => []);
    if (live(id)) set({ candidates });
  };

  return {
    ...IDLE,
    runId: 0,

    run: async (doc, engineResult) => {
      const id = ++runSeq;
      clearTimer();
      // unknown firm means no baseline: settle synchronously (no pending display at all)
      if (!doc.firmId) {
        set({ ...IDLE, runId: id, docId: doc.id, status: 'none' });
        return;
      }
      if (isScanResult(engineResult) || engineResult.blocks.length === 0) {
        set({ ...IDLE, runId: id, docId: doc.id, status: 'none', line: SCAN_CURRENT_LINE });
        return;
      }
      set({ ...IDLE, runId: id, docId: doc.id, status: 'resolving' });
      timer = setTimeout(() => {
        if (live(id) && isPending(get())) {
          runSeq++;
          set({ status: 'error', line: ERROR_LINE, runId: runSeq });
        }
      }, VARIANCE_PENDING_TIMEOUT_MS);
      try {
        const res = await resolveBaseline(doc);
        if (!live(id)) return;
        void refreshCandidates(id, doc);
        if (res.kind === 'none') {
          set({ status: 'none', line: noBaselineLine(doc), baseline: null });
          clearTimer();
          // after a no-baseline review the document becomes the firm's baseline (uploads only)
          if (res.reason === 'no_candidate') await becomeFirmBaseline(doc).catch(() => false);
          return;
        }
        if (res.kind === 'unavailable') {
          set({
            status: 'none',
            baseline: res.baseline,
            ignored: res.ignored,
            line: res.reason === 'scan' ? SCAN_BASELINE_LINE : BYTES_GONE_LINE,
          });
          clearTimer();
          return;
        }
        set({ status: 'running', baseline: res.baseline, ignored: res.ignored });
        const out = await runVarianceInWorker(
          {
            baseline: res.input,
            baselineSide: { firmId: res.baseline.firmId, label: res.baseline.name },
            current: { docHash: doc.id },
            currentSide: {
              firmId: doc.firmId,
              label: [doc.fund, doc.version].filter(Boolean).join(' ') || doc.name,
            },
          },
          { ...e2eVarianceSettings() },
        );
        if (!live(id)) return;
        clearTimer();
        if (!out.ok) {
          set({
            status: out.side === 'baseline' && out.code === 'scanned_document' ? 'none' : 'error',
            line:
              out.side === 'baseline' && out.code === 'scanned_document'
                ? SCAN_BASELINE_LINE
                : ERROR_LINE,
          });
          return;
        }
        const { ok: _ok, ...view } = out;
        if (view.notice === 'cross_firm') {
          set({ status: 'none', line: noBaselineLine(doc), baseline: null });
          return;
        }
        set({ status: 'ready', result: view, line: null });
      } catch {
        if (!live(id)) return;
        clearTimer();
        set({ status: 'error', line: ERROR_LINE });
      }
    },

    choose: async (docId) => {
      const { doc, result, phase } = useReview.getState();
      if (!doc || !result || phase !== 'ready') return { ok: false, reason: 'unknown_doc' };
      const viaPackage = get().candidates.find((c) => c.docId === docId)?.path === 'package';
      const r = await setBaseline(doc, docId);
      // the package path re-runs through the package subscription; the pointer path re-runs here
      if (r.ok && !viaPackage) void get().run(doc, result);
      return r;
    },

    loadCandidates: async () => {
      const doc = useReview.getState().doc;
      if (!doc) return [];
      const candidates = await listBaselineCandidates(doc).catch(() => []);
      set({ candidates });
      return candidates;
    },

    reset: () => {
      runSeq++;
      clearTimer();
      set({ ...IDLE, runId: runSeq });
    },
  };
});

/** The muted line under the segment, with the ignored-baselines note when it applies. */
export function varianceLines(s: Pick<VarianceState, 'line' | 'ignored'>): string[] {
  const out: string[] = [];
  if (s.line) out.push(s.line);
  if (s.ignored > 0) out.push(ignoredLine(s.ignored));
  return out;
}

function slice(): VarianceSlice {
  const s = useVariance.getState();
  const doc = useReview.getState().doc;
  if (s.status !== 'ready' || !s.result || !doc || s.docId !== doc.id)
    return { findings: [], policy: undefined };
  return { findings: s.result.findings, policy: s.result.gatePolicy };
}
setVarianceSource(slice);

/** Baseline-role member ids of the open document's package ('' when none). */
function baselineKey(): string {
  const doc = useReview.getState().doc;
  const ctx = doc ? packageContext(doc) : null;
  return ctx ? ctx.baselines.map((b) => b.docId).join('|') : '';
}

let lastBaselineKey = '';

// D-S0-2: re-run on openDocument completion (open, re-open, reload restore) ...
useReview.subscribe((next, prev) => {
  if (next.phase === 'loading' && prev.phase !== 'loading') {
    useVariance.getState().reset();
    return;
  }
  if (next.phase === 'ready' && prev.phase !== 'ready' && next.doc && next.result) {
    lastBaselineKey = baselineKey();
    void useVariance.getState().run(next.doc, next.result);
  }
});

// ... and on a baseline role change in the package (Package lens or the header control), without
// re-opening the primary.
usePackage.subscribe((next, prev) => {
  if (next.current === prev.current) return;
  const key = baselineKey();
  if (key === lastBaselineKey) return;
  lastBaselineKey = key;
  const { doc, result, phase } = useReview.getState();
  if (phase === 'ready' && doc && result && !next.refreshing)
    void useVariance.getState().run(doc, result);
});
