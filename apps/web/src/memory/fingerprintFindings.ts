import {
  fingerprintFor,
  limits,
  mask,
  resolveLabel,
  scopeMismatch,
  sensitiveSpans,
  type ActiveDecision,
  type MemoryLabel,
} from '@aduin/core';
import type { FindingView } from '../engine/types';
import type { MemoryApi } from '../api/memoryApi';

/**
 * Main-thread fingerprint flow (Phase 01 Contracts v1): core fingerprintFor(finding, firmId) per finding,
 * then memoryApi.lookup(firmId, fingerprints[]) in chunks of limits.memoryLookupMax, then resolveLabel.
 * firmId = null -> null fingerprints, no lookup, every label `new`, memory not applied.
 * fundName (Variance D5): when given, a fund-scoped decision of another fund does not apply (label
 * `new`, no prior), exactly as the Worker resolves the persisted label; omitted = legacy behavior.
 */
export interface MemoryAnnotated {
  fingerprint: string | null;
  label: MemoryLabel;
  prior: ActiveDecision | null;
}

export interface MemoryResult {
  byId: Record<string, MemoryAnnotated>;
  applied: boolean;
  unavailable: boolean;
  /** Render-first placeholder: labels are New until the memory lookup settles (no network yet). */
  pending?: boolean;
}

/** Worker `NO_FUND`: the run's fund name when the document has no fund. */
export const NO_FUND_SCOPE = '(no fund)';

/**
 * Variance M2 (H3): the fund scope exactly as the Worker persists it on the run
 * (`maskFree(body.fund_name ?? NO_FUND)`, where `outboxDocFor` sends `fund.slice(0, 200)` only when
 * the document has a fund), so the client label matches the Worker label for fund-scoped decisions.
 */
export function fundScopeName(fund: string | null | undefined): string {
  if (!fund) return NO_FUND_SCOPE;
  const f = fund.slice(0, 200);
  return mask(f, sensitiveSpans(f));
}

export async function fingerprintFindings(
  findings: readonly FindingView[],
  firmId: string | null,
  api: MemoryApi | null,
  fundName?: string | null,
): Promise<MemoryResult> {
  const scope = typeof fundName === 'string' ? { fundName } : undefined;
  const byId: Record<string, MemoryAnnotated> = {};
  if (firmId === null) {
    for (const f of findings) byId[f.id] = { fingerprint: null, label: 'new', prior: null };
    return { byId, applied: false, unavailable: false };
  }
  const fps = findings.map((f) => fingerprintFor(f, firmId));
  findings.forEach(
    (f, i) => (byId[f.id] = { fingerprint: fps[i] ?? null, label: 'new', prior: null }),
  );
  const wanted = [...new Set(fps.filter((x): x is string => typeof x === 'string'))];
  if (!api) return { byId, applied: true, unavailable: true };
  const decisions = new Map<string, ActiveDecision>();
  try {
    for (let i = 0; i < wanted.length; i += limits.memoryLookupMax) {
      const chunk = wanted.slice(i, i + limits.memoryLookupMax);
      for (const d of await api.lookup(firmId, chunk)) decisions.set(d.fingerprint, d);
    }
  } catch {
    return { byId, applied: true, unavailable: true };
  }
  for (const f of findings) {
    const a = byId[f.id]!;
    const found = a.fingerprint ? (decisions.get(a.fingerprint) ?? null) : null;
    const prior = found && !scopeMismatch(found, scope) ? found : null;
    a.prior = prior;
    a.label = resolveLabel({ ...f, fingerprint: a.fingerprint }, prior, scope);
  }
  return { byId, applied: true, unavailable: false };
}
