import { limits } from '@aduin/core';
import {
  OCR_UNAVAILABLE_AI_OFF,
  OCR_UNAVAILABLE_BUILD,
  OCR_UNAVAILABLE_LIMIT,
  OCR_UNAVAILABLE_SERVICE,
} from '../../engine/ocr-queue';
import type { BlockView, EngineResult, FindingView, OcrPageState } from '../../engine/types';
import type { ScanProgressPage } from './scan-store';

/** Pure view helpers for the scan viewer (Phase 06e). */

export const STATE_LABEL: Record<OcrPageState, string> = {
  queued: 'Queued',
  running: 'Reading',
  done: 'Done',
  failed: 'Failed',
  unavailable: 'No text',
};

/** True when the open document has scanned pages (OCR source, or a PDF with scan pages). */
export function isScanResult(r: EngineResult | null): boolean {
  if (!r) return false;
  return r.source === 'ocr' || (r.source === 'pdf' && (r.scanPages?.length ?? 0) > 0);
}

/** Pages the viewer lists: every page for OCR sources, only the scan pages of a PDF. */
export function viewerPages(r: EngineResult | null, pageCount: number): number[] {
  if (r?.source === 'pdf' && r.scanPages?.length) return [...r.scanPages];
  const n = r?.pageCount ?? pageCount;
  return Array.from({ length: n }, (_, i) => i);
}

export interface PageStatus {
  index: number;
  state: OcrPageState;
  reason?: string;
  conf?: number;
  low: boolean;
}

/** Merge the engine's final page views with the live queue progress (engine wins once present). */
export function pageStatuses(
  r: EngineResult | null,
  progress: readonly ScanProgressPage[],
): Map<number, PageStatus> {
  const m = new Map<number, PageStatus>();
  for (const p of progress)
    m.set(p.index, {
      index: p.index,
      state: p.state,
      ...(p.reason ? { reason: p.reason } : {}),
      low: false,
    });
  for (const v of r?.ocr?.pages ?? []) {
    const low = v.lowConfidence ?? (v.conf !== undefined && v.conf < limits.ocrLowConfidence);
    m.set(v.index, {
      index: v.index,
      state: v.state,
      ...(v.reason ? { reason: v.reason } : {}),
      ...(v.conf !== undefined ? { conf: v.conf } : {}),
      low,
    });
  }
  return m;
}

/** Text blocks read from one page (1-based block.page). */
export function blocksOnPage(blocks: readonly BlockView[], index: number): BlockView[] {
  return blocks.filter((b) => b.page === index + 1);
}

export type Highlight =
  { kind: 'region'; x: number; y: number; w: number; h: number } | { kind: 'page' } | null;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Region (or whole-page) highlight of the selected finding on the shown page (AC4). */
export function highlightFor(f: FindingView | undefined, index: number): Highlight {
  if (!f || f.page !== index + 1) return null;
  const g = f.region;
  if (!g || !(g.w > 0) || !(g.h > 0)) return { kind: 'page' };
  const whole = g.x <= 0 && g.y <= 0 && g.w >= 1 && g.h >= 1;
  if (whole) return { kind: 'page' };
  const x = clamp01(g.x);
  const y = clamp01(g.y);
  return { kind: 'region', x, y, w: clamp01(g.w), h: clamp01(g.h) };
}

export type OcrBanner = 'build' | 'service' | 'limit' | 'ai_off' | null;

/** Which "OCR unavailable" banner applies (first match by severity of cause). */
export function ocrBanner(pages: Iterable<PageStatus>): OcrBanner {
  let out: OcrBanner = null;
  for (const p of pages) {
    if (p.state !== 'unavailable') continue;
    if (p.reason === OCR_UNAVAILABLE_BUILD) return 'build';
    if (p.reason === OCR_UNAVAILABLE_SERVICE) out = 'service';
    else if (p.reason === OCR_UNAVAILABLE_LIMIT && (out === null || out === 'ai_off'))
      out = 'limit';
    else if (p.reason === OCR_UNAVAILABLE_AI_OFF && out === null) out = 'ai_off';
  }
  return out;
}

export function confLabel(conf: number): string {
  return conf.toFixed(2);
}
