import { maskAndClamp } from '@aduin/core';
import '../../styles/package-lens.css';
import type { PackageView } from './contract';
import { PackageCoverageTable } from './PackageCoverageTable';
import { PackageDocuments } from './PackageDocuments';
import { PackageReferences } from './PackageReferences';
import { PackageTerms } from './PackageTerms';

/**
 * Intake Phase 3a: the "Package" lens inside Structure. Reads only the frozen PackageView; edits go
 * through the `usePackage` actions. Never fetches and never writes memory.
 */
export function PackageLens({
  view,
  onShow,
}: {
  view: PackageView;
  onShow: (blockId: string, quote?: string | null) => void;
}) {
  const firm = view.firmId ? maskAndClamp(view.firmName, 120) : 'Other / no firm';
  return (
    <div className="pkg-lens" data-testid="package-lens">
      <header className="pkg-lens-head">
        <h2 className="pkg-lens-title">
          {maskAndClamp(view.fund, 120)}
          {view.version ? ` · ${maskAndClamp(view.version, 40)}` : ''}
        </h2>
        <p className="mut">{firm}</p>
      </header>
      <PackageDocuments view={view} />
      <PackageReferences view={view} onShow={onShow} />
      <PackageTerms view={view} />
      <PackageCoverageTable view={view} />
    </div>
  );
}
