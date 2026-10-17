/**
 * FROZEN P2 -> P3 contract (intake Phase 2). Phase 3 tracks consume ONLY these types, the
 * `usePackageView()` hook (package-view.ts), the `usePackage` store actions (state/package.ts) and
 * the Playwright helpers (e2e/fixtures/package.ts). Type declarations only.
 */
import type {
  CoverageGroup,
  CoverageStatus,
  CrossDocTerm,
  DocumentRequest,
  ExternalReference,
  PackageConfidence,
  PackageDocFormat,
  PackageDocRole,
  PackageDocType,
  PackageGateReason,
} from '@aduin/core';

export interface PackageDocView {
  id: string;
  name: string;
  type: PackageDocType;
  role: PackageDocRole;
  confidence: PackageConfidence;
  reason: string;
  confirmed: boolean;
  needsOcr: boolean;
  format: PackageDocFormat;
  isPrimary: boolean;
  /** False for the primary (to-digitize) document. */
  editable: boolean;
}

export interface PackageBaselineView {
  docId: string;
  name: string;
}

/** Plain data, structured-clone safe. */
export interface PackageView {
  packageId: string;
  firmId: string | null;
  firmName: string;
  fund: string;
  version: string;
  /** Primary first, then by name. */
  documents: PackageDocView[];
  /** Document order. */
  references: ExternalReference[];
  terms: CrossDocTerm[];
  /** Fixed order: structure_flow, internal_refs, defined_terms, external_refs, investor_paths. */
  coverage: CoverageGroup[];
  /** From core `coverageLineText`; never re-derived by Phase 3. */
  coverageLine: string;
  /** The worst group. */
  coverageStatus: CoverageStatus;
  /** From core `packageGateReasons` with `DEFAULT_PACKAGE_POLICY`; the ONLY package gate source. */
  gateReasons: PackageGateReason[];
  requests: DocumentRequest[];
  /** Documents with role baseline. */
  baselines: PackageBaselineView[];
  /** True only while a store-initiated re-open of the primary runs. */
  refreshing: boolean;
}

export type PackageActionRefusal =
  'unknown_doc' | 'primary_locked' | 'cross_firm' | 'role_not_allowed';
export type PackageActionResult = { ok: true } | { ok: false; reason: PackageActionRefusal };

/** Firm / fund / version tag of a package (firm null = "Other / no firm": memory not applied). */
export interface PackageTag {
  firmId: string | null;
  firmName: string;
  fund: string;
  version: string;
}
