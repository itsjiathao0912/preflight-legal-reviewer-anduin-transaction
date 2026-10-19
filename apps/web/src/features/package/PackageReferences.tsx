import { maskAndClamp, maskQuote, type ExternalReference } from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import { usePackage } from '../../state/package';
import { useReview } from '../../state/review';
import type { PackageDocView, PackageView } from './contract';
import { openPackageFile, typeLabel } from './open-file';

const NONE = 'none';

export function locationText(r: ExternalReference): string {
  const section = r.location.sectionPath.at(-1) ?? 'Start of document';
  return `${section}, paragraph ${r.location.blockIndex + 1}`;
}

/** E10: documents of the reference's family; for annexes, every non-primary document. */
export function candidatesFor(r: ExternalReference, docs: PackageDocView[]): PackageDocView[] {
  return docs.filter(
    (d) => !d.isPrimary && (r.targetFamily === 'annex' || d.type === r.targetFamily),
  );
}

function Mention({
  r,
  view,
  onShow,
}: {
  r: ExternalReference;
  view: PackageView;
  onShow: (blockId: string) => void;
}) {
  const blockId = useReview((s) => s.result?.blocks[r.location.blockIndex]?.id ?? null);
  const label = maskAndClamp(r.targetLabel, 80);
  const target = view.documents.find((d) => d.id === r.resolvedDocId);
  const part = r.resolution === 'resolved' && target ? r.resolvedPart : undefined;
  const status =
    r.resolution === 'resolved'
      ? {
          icon: 'check' as const,
          word: part
            ? `Resolved to ${typeLabel(target!.type)} · Section ${maskAndClamp(part.label, 12)}${
                part.title ? ` (${maskAndClamp(part.title, 80)})` : ''
              }`
            : `Resolved to ${target ? maskAndClamp(target.name, 120) : 'a document'}`,
        }
      : r.resolution === 'not_in_package'
        ? { icon: 'stop' as const, word: 'Not in package' }
        : { icon: 'warn' as const, word: 'Needs confirmation' };
  const cands = candidatesFor(r, view.documents);
  return (
    <li
      className="pkg-lens-ref"
      data-testid="package-reference"
      data-resolution={r.resolution}
      data-target-key={r.targetKey}
    >
      <q className="pkg-lens-quote">{maskQuote(r.quote)}</q>
      <div className="mut">{locationText(r)}</div>
      <div className="pkg-lens-row">
        <span className="pkg-lens-st">
          <Icon name={status.icon} />
          {status.word}
        </span>
        {r.resolution === 'unclear' ? (
          <select
            data-testid="package-reference-confirm"
            aria-label={`Confirm the document for ${label}, ${locationText(r)}`}
            value=""
            onChange={(e) => {
              if (e.target.value) usePackage.getState().confirmTarget(r.targetKey, e.target.value);
            }}
          >
            <option value="">Choose a document…</option>
            {cands.map((d) => (
              <option key={d.id} value={d.id}>
                {maskAndClamp(d.name, 120)}
              </option>
            ))}
            <option value={NONE}>None of these</option>
          </select>
        ) : null}
        {blockId ? (
          <button
            type="button"
            className="btn"
            data-testid="package-reference-show"
            aria-label={`Show ${label} reference in the document`}
            onClick={() => onShow(blockId)}
          >
            <Icon name="eye" />
            Show in document
          </button>
        ) : null}
        {part && target ? (
          <button
            type="button"
            className="btn"
            data-testid="package-reference-open"
            aria-label={`Open Section ${maskAndClamp(part.label, 12)} in ${typeLabel(target.type)}`}
            onClick={() => openPackageFile(view, target.id, part.blockIndex)}
          >
            {`Open in ${typeLabel(target.type)} →`}
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function PackageReferences({
  view,
  onShow,
}: {
  view: PackageView;
  onShow: (blockId: string) => void;
}) {
  const groups = new Map<string, ExternalReference[]>();
  for (const r of view.references) {
    const g = groups.get(r.targetKey);
    if (g) g.push(r);
    else groups.set(r.targetKey, [r]);
  }
  return (
    <section
      className="pkg-lens-sec"
      data-testid="package-lens-references"
      aria-label="External references"
    >
      <h3>External references</h3>
      {groups.size === 0 ? <p className="mut">No references to other documents.</p> : null}
      {[...groups].map(([key, refs]) => (
        <div key={key} className="pkg-lens-group">
          <h4>{maskAndClamp(refs[0]!.targetLabel, 80)}</h4>
          <ul className="pkg-lens-list">
            {refs.map((r) => (
              <Mention key={r.id} r={r} view={view} onShow={onShow} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
