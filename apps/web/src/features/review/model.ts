import type { ActiveDecision, CounselOption, MemoryLabel, ReasonCode } from '@aduin/core';
import type { FindingView } from '../../engine/types';
import type { MemoryResult } from '../../memory/fingerprintFindings';
import type { Filters } from '../../state/filters';
import { gateInterim, type GateResult, type TriageStatus } from './gateInterim';
import { isPreviouslyHandled } from './memory-labels';
import { SEV, sevKey, type SevKey } from './severity';

/** Pure review derivations shared by the Findings screen, the sidebar badges and the gate. */
export interface Triage {
  status: TriageStatus;
  reasonCode?: ReasonCode;
  note?: string;
  counselAnswer?: CounselOption | null;
  /** Memory decision created in this document for this finding (revoked on undo/restore). */
  decisionId?: string | null;
}

export interface Row {
  f: FindingView;
  sev: SevKey;
  status: TriageStatus;
  triage: Triage | null;
  label: MemoryLabel;
  prior: ActiveDecision | null;
  fingerprint: string | null;
  detector: string;
}

export function detectorOf(f: FindingView): string {
  return f.detector_kind === 'ai' ? (f.model ?? 'AI') : f.detector_id;
}

export function buildRows(
  findings: readonly FindingView[],
  memory: MemoryResult | null,
  triage: Readonly<Record<string, Triage>>,
): Row[] {
  return findings.map((f) => {
    const m = memory?.byId[f.id];
    const t = triage[f.id] ?? null;
    return {
      f,
      sev: sevKey(f.severity),
      status: t?.status ?? 'open',
      triage: t,
      label: m?.label ?? 'new',
      prior: m?.prior ?? null,
      fingerprint: m?.fingerprint ?? null,
      detector: detectorOf(f),
    };
  });
}

/** Main list vs "Previously handled (n)": dismissed_reconfirm stays in the main list (it blocks). */
export function placement(rows: readonly Row[]): { main: Row[]; previous: Row[] } {
  const main: Row[] = [];
  const previous: Row[] = [];
  for (const r of rows) {
    if (r.status === 'open' && isPreviouslyHandled(r.label)) previous.push(r);
    else main.push(r);
  }
  return { main, previous };
}

export function passes(r: Row, s: Filters): boolean {
  if (s.sev !== 'all' && r.sev !== s.sev) return false;
  if (s.cls !== 'all' && r.f.issue_class !== s.cls) return false;
  if (s.det !== 'all' && r.detector !== s.det) return false;
  if (s.status === 'active') return r.status !== 'dismissed';
  if (s.status === 'all') return true;
  return r.status === s.status;
}

export function sortRows(list: readonly Row[], sort: Filters['sort']): Row[] {
  const a = [...list];
  if (sort === 'sev') a.sort((x, y) => SEV[x.sev].rank - SEV[y.sev].rank || x.f.order - y.f.order);
  else if (sort === 'doc')
    a.sort((x, y) => x.f.order - y.f.order || x.f.anchor.offsetStart - y.f.anchor.offsetStart);
  else a.sort((x, y) => x.f.classLabel.localeCompare(y.f.classLabel) || x.f.order - y.f.order);
  return a;
}

export function visibleRows(main: readonly Row[], s: Filters): Row[] {
  return sortRows(
    main.filter((r) => passes(r, s)),
    s.sort,
  );
}

/** Severity chip counts: active (not dismissed) main-list findings. */
export function chipCounts(main: readonly Row[]): Record<SevKey, number> {
  const c: Record<SevKey, number> = { block: 0, fix: 0, note: 0 };
  for (const r of main) if (r.status !== 'dismissed') c[r.sev]++;
  return c;
}

/** Findings badge = open items only (user-confirmed default). */
export function openCount(main: readonly Row[]): number {
  return main.filter((r) => r.status === 'open').length;
}

export function counselCount(rows: readonly Row[]): number {
  return rows.filter((r) => r.status === 'counsel').length;
}

export function computeGate(rows: readonly Row[]): GateResult {
  const states: Record<
    string,
    { status: TriageStatus; reasonCode?: string | null; counselAnswer?: CounselOption | null }
  > = {};
  const labels: Record<string, MemoryLabel> = {};
  for (const r of rows) {
    states[r.f.id] = {
      status: r.status,
      reasonCode: r.triage?.reasonCode ?? null,
      counselAnswer: r.triage?.counselAnswer ?? null,
    };
    labels[r.f.id] = r.label;
  }
  return gateInterim(
    rows.map((r) => ({ id: r.f.id, severity: r.f.severity })),
    states,
    labels,
  );
}

/** Filter-menu option lists derived from the loaded findings. */
export function classOptions(rows: readonly Row[]): { value: string; label: string }[] {
  const m = new Map<string, string>();
  for (const r of rows) m.set(r.f.issue_class, r.f.classLabel);
  return [...m].map(([value, label]) => ({ value, label }));
}

export function detectorOptions(rows: readonly Row[]): string[] {
  return [...new Set(rows.map((r) => r.detector))];
}
