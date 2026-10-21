import { maskAndClamp } from '@aduin/core';
import '../../styles/package-lens.css';
import type { PackageView } from './contract';
import { PackageCoverageTable } from './PackageCoverageTable';
import { PackageDocuments } from './PackageDocuments';
import { PackageReferences } from './PackageReferences';
import { PackageTerms } from './PackageTerms';

/**
 * The package header (fund · version, firm) and its file list. Shown at the top of the Documents
 * screen while a package is open.
 */
export function PackageSummary({ view }: { view: PackageView }) {
  const firm = view.firmId ? maskAndClamp(view.firmName, 120) : 'Other / no firm';
  return (
    <div className="pkg-lens" data-testid="package-summary">
      <header className="pkg-lens-head">
        <h2 className="pkg-lens-title">
          {maskAndClamp(view.fund, 120)}
          {view.version ? ` · ${maskAndClamp(view.version, 40)}` : ''}
        </h2>
        <p className="mut">{firm}</p>
        <p className="mut" data-testid="package-summary-line">
          {view.coverageLine}
        </p>
      </header>
      <PackageDocuments view={view} />
    </div>
  );
}

/**
 * Intake Phase 3a: the "Package" lens inside Structure (references, terms, coverage; the file list
 * lives on the Documents screen). Reads only the frozen PackageView; edits go
 * through the `usePackage` actions. Never fetches and never writes memory.
 */
export function PackageLens({
  view,
  onShow,
}: {
  view: PackageView;
  onShow: (blockId: string, quote?: string | null) => void;
}) {
  return (
    <div className="pkg-lens" data-testid="package-lens">
      <PackageReferences view={view} onShow={onShow} />
      <PackageTerms view={view} />
      <PackageCoverageTable view={view} />
    </div>
  );
}
