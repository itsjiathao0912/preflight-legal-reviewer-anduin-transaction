import type { VarianceView } from '../../engine/types';

/**
 * Variance Phase 02 (web): client types and the fixed copy of the muted lines. Variance runs as a
 * second local pass after deterministic findings render; it never waits on session, Turnstile or
 * memory (render-first, D9).
 */
export type VarianceStatus = 'idle' | 'resolving' | 'running' | 'ready' | 'none' | 'error';

/** One baseline candidate (same firm only). `path` says where it came from. */
export interface BaselineRef {
  /** Package member id (content hash) or stored upload row id. */
  docId: string;
  name: string;
  firmId: string;
  path: 'package' | 'pointer';
  /** ISO time the upload was stored (pointer path), for the tie-break order. */
  createdAt?: string;
}

/** Firm pointer stored in `uiState` (`variance:baseline:{firmId}`). */
export interface FirmPointer {
  /** Stored upload row id. */
  docId: string;
  /** Content hash of the document (never its own baseline). */
  docHash?: string;
  name: string;
  setAt: number;
}

export type { VarianceView };

export const NO_BASELINE_LINE =
  'No earlier document from this firm. Reviewing for errors only. This document becomes the baseline.';
/** Documents that cannot become the baseline (samples): same line without the last sentence. */
export const NO_BASELINE_SHORT_LINE =
  'No earlier document from this firm. Reviewing for errors only.';
export const SCAN_BASELINE_LINE = 'The baseline is a scan; add a text version.';
export const BYTES_GONE_LINE = 'Baseline text is no longer in the browser; add it again.';
export const SCAN_CURRENT_LINE = 'Variance unavailable for scanned documents.';
export const ERROR_LINE = 'Changes could not be checked. Errors still work.';
export const DETERMINISTIC_LINE = 'from the logic graph, deterministic';

export function ignoredLine(n: number): string {
  return `${n} other baseline(s) ignored (one baseline per review)`;
}

/** Pending display never sticks: a pass that runs longer ends as an error with the muted line. */
export const VARIANCE_PENDING_TIMEOUT_MS = 20_000;

export const POINTER_KEY = (firmId: string) => `variance:baseline:${firmId}`;
