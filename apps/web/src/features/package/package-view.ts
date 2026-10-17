import { useMemo } from 'react';
import {
  coverageLineText,
  DEFAULT_PACKAGE_POLICY,
  packageGateReasons,
  type CoverageStatus,
  type PackageAnalysis,
} from '@aduin/core';
import { usePackage, type CurrentPackage } from '../../state/package';
import { useReview, type DocMeta } from '../../state/review';
import type { PackageDocView, PackageView } from './contract';

const RANK: Record<CoverageStatus, number> = { full: 0, partial: 1, blocked: 2 };

export interface PackageViewInput {
  current: CurrentPackage | null;
  analysis: PackageAnalysis | null;
  refreshing: boolean;
  doc: DocMeta | null;
  phase: string;
}

/**
 * Pure builder of the frozen PackageView (S2). Non-null only when a package exists AND the open
 * document carries that package id AND the review phase is ready, OR while a store-initiated
 * re-open runs (stale-while-reopen: `refreshing: true`).
 */
export function buildPackageView(input: PackageViewInput): PackageView | null {
  const { current, analysis, refreshing, doc, phase } = input;
  if (!current || !analysis) return null;
  const showing = phase === 'ready' && doc?.packageId === current.id;
  if (!showing && !refreshing) return null;
  const documents: PackageDocView[] = analysis.documents
    .map((d) => {
      const isPrimary = d.id === current.primaryDocId;
      return {
        id: d.id,
        name: d.name,
        type: d.type,
        role: d.role,
        confidence: d.confidence,
        reason: d.reason,
        confirmed: d.confirmed,
        needsOcr: d.needsOcr,
        format: d.format,
        isPrimary,
        editable: !isPrimary,
      };
    })
    .sort((a, b) =>
      a.isPrimary !== b.isPrimary
        ? a.isPrimary
          ? -1
          : 1
        : a.name < b.name
          ? -1
          : a.name > b.name
            ? 1
            : 0,
    );
  let coverageStatus: CoverageStatus = 'full';
  for (const g of analysis.coverage)
    if (RANK[g.status] > RANK[coverageStatus]) coverageStatus = g.status;
  return {
    packageId: current.id,
    firmId: current.tag.firmId,
    firmName: current.tag.firmName,
    fund: current.tag.fund,
    version: current.tag.version,
    documents,
    references: analysis.references.map((r) => ({ ...r, location: { ...r.location } })),
    terms: analysis.terms.map((t) => ({ ...t })),
    coverage: analysis.coverage.map((g) => ({
      ...g,
      missingTypes: [...g.missingTypes],
      reasons: [...g.reasons],
    })),
    coverageLine: coverageLineText(analysis),
    coverageStatus,
    gateReasons: packageGateReasons(analysis, DEFAULT_PACKAGE_POLICY),
    requests: analysis.requests.map((r) => ({ ...r })),
    baselines: documents
      .filter((d) => d.role === 'baseline')
      .map((d) => ({ docId: d.id, name: d.name })),
    refreshing,
  };
}

/** The frozen read hook for Phase 3 (memoized on store slices, E11). Never triggers a network call. */
export function usePackageView(): PackageView | null {
  const current = usePackage((s) => s.current);
  const analysis = usePackage((s) => s.analysis);
  const refreshing = usePackage((s) => s.refreshing);
  const doc = useReview((s) => s.doc);
  const phase = useReview((s) => s.phase);
  return useMemo(
    () => buildPackageView({ current, analysis, refreshing, doc, phase }),
    [current, analysis, refreshing, doc, phase],
  );
}
