import { fingerprintFor, type RegressionCheckSummary } from '@aduin/core';
import { memoryApi } from '../../api/client';
import type { MemoryApi } from '../../api/memoryApi';
import { docInputOf, runRegressionInWorker } from '../../engine/client';
import type { FindingView, RegressionCheck } from '../../engine/types';
import { ensureSession, memoryDown } from '../../state/memory-sync';
import type { RegressionSlice } from './select';

/**
 * Variance Phase 04 (E1, H4): the regression arrival path. In the background, after findings are on
 * screen (never blocking first paint), the firm's active regression checks arrive with a memory
 * lookup (`lookupWithChecks`, server-scoped to this workspace AND firm); the engine worker runs them
 * on the open document. A violated check becomes a critical change-kind finding "Regression:
 * confirmed in <fund>" with the check statement as the quote; a held check adds nothing. The finding
 * keeps the core id (`f_<hash>`), is local (never sent as a new finding) and joins memory through
 * its fingerprint like any row.
 */

/** All-zero HEX64: a valid fingerprint that matches no decision (a document with no findings). */
export const ZERO_FINGERPRINT = '0'.repeat(64);

/** Fingerprints sent with the checks lookup (deduplicated); the sentinel when there are none. */
export function regressionFingerprints(findings: readonly FindingView[], firmId: string): string[] {
  const fps = new Set<string>();
  for (const f of findings) {
    const fp = fingerprintFor(f, firmId);
    if (fp) fps.add(fp);
  }
  return fps.size ? [...fps] : [ZERO_FINGERPRINT];
}

/** Wire check summaries -> engine checks (the statement and fund come from the server row). */
export function checksFrom(summaries: readonly RegressionCheckSummary[]): RegressionCheck[] {
  return summaries
    .filter((c) => c.assertion_kind === 'scope_exists' && !!c.assertion_key)
    .map((c) => ({
      kind: 'scope_exists' as const,
      label: c.assertion_key,
      statement: c.statement_text,
      sourceFundName: c.source_fund_name,
    }));
}

export interface RegressionDeps {
  api: MemoryApi | null;
  run: typeof runRegressionInWorker;
  /** Remembered analyze input of a document (re-read after the worker evicted its graph). */
  inputOf: typeof docInputOf;
}

const defaultDeps = (): RegressionDeps => ({
  api: memoryApi(),
  run: runRegressionInWorker,
  inputOf: docInputOf,
});

/**
 * Fetch the firm's checks and run them on the document. Returns the regression slice (possibly
 * empty), or null when nothing could be checked (no firm, no memory, lookup failed, the document
 * graph is gone and no remembered input exists: skipped silently, no finding and no error).
 */
export async function fetchRegression(
  doc: { id: string; firmId: string | null },
  findings: readonly FindingView[],
  deps: RegressionDeps = defaultDeps(),
): Promise<RegressionSlice | null> {
  const firmId = doc.firmId;
  if (!firmId || !deps.api) return null;
  let summaries: RegressionCheckSummary[];
  try {
    const r = await deps.api.lookupWithChecks(firmId, regressionFingerprints(findings, firmId));
    summaries = r.regression_checks;
  } catch {
    return null;
  }
  const checks = checksFrom(summaries);
  if (!checks.length) return { docId: doc.id, findings: [], meta: {} };
  let res = await deps.run({ docHash: doc.id }, checks);
  if (!res.ok && res.code === 'doc_not_retained') {
    const input = deps.inputOf(doc.id);
    if (!input) return null;
    res = await deps.run({ docHash: doc.id, input }, checks);
  }
  if (!res.ok) return null;
  return { docId: doc.id, findings: res.findings, meta: res.meta };
}

/**
 * Background start for the open document (firm documents only). Waits for the memory session
 * (bootstrap is shared with the review store), then hands the slice to `onSlice`.
 */
export async function startRegression(
  doc: { id: string; firmId: string | null },
  findings: readonly FindingView[],
  onSlice: (r: RegressionSlice) => void,
): Promise<void> {
  if (!doc.firmId) return;
  try {
    await ensureSession();
    if (memoryDown()) return;
    const slice = await fetchRegression(doc, findings);
    if (slice) onSlice(slice);
  } catch {
    /* memory never blocks the review */
  }
}
