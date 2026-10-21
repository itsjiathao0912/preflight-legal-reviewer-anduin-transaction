import { maskAndClamp, type CrossDocTerm, type DefinitionLocation } from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import { TYPE_LABELS } from '../open-document/PackageConfirmTable';
import type { PackageView } from './contract';
import { openPackageFile } from './open-file';
import { quoteText } from './quote-text';
import { useReview } from '../../state/review';
import { findingForTerm, SeeInFindings } from '../structure/SeeInFindings';

/** "Section 1.1, ¶ 4" (numbered part) or "Article I. Definitions, ¶ 12" (block in the file). */
export function definitionLocationText(loc: DefinitionLocation): string {
  if (loc.sectionLabel && loc.paragraph)
    return `Section ${maskAndClamp(loc.sectionLabel, 12)}, ¶ ${loc.paragraph}`;
  const sec = loc.sectionPath.at(-1);
  return `${sec ? `${maskAndClamp(sec, 80)}, ` : ''}¶ ${loc.blockIndex + 1}`;
}

/** Kept for existing callers: the shared package quote display helper. */
export const termQuoteText = quoteText;

const REASON: Record<NonNullable<CrossDocTerm['reason']>, string> = {
  no_reference_document: 'No LPA in the package',
  not_in_reference_documents: 'Not found in the reference documents',
};

export function PackageTerms({ view }: { view: PackageView }) {
  const findings = useReview((s) => s.result?.findings);
  return (
    <section
      className="pkg-lens-sec"
      data-testid="package-lens-terms"
      aria-label="Terms from other documents"
    >
      <div className="sechead pkg-sechead">
        <h3>Terms from other documents</h3>
        <span className="dim">
          Terms the agreement leaves to another file. These explain the checks; they are not
          findings.
        </span>
      </div>
      {view.terms.length === 0 ? <p className="mut">No terms to look up.</p> : null}
      {view.terms.length ? (
        <div className="twrap">
          <table className="t pkg-term-t">
            <caption className="sr">Terms from other documents</caption>
            <thead>
              <tr>
                <th scope="col">Defined in</th>
                <th scope="col">Term</th>
                <th scope="col">Where it is defined</th>
                <th scope="col">Uses</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {view.terms.map((t) => {
                const def = view.documents.find((d) => d.id === t.definingDocId);
                const defined = t.status === 'defined_in_package';
                const where = defined && t.definitionLocation ? t.definitionLocation : null;
                const label = def ? TYPE_LABELS[def.type] : 'a reference document';
                const statusText = defined
                  ? `Defined in ${label}${where ? ` · ${definitionLocationText(where)}` : ''}`
                  : `Unverified: ${t.reason ? REASON[t.reason] : REASON.not_in_reference_documents}`;
                return (
                  <tr key={t.term} data-testid="package-term" data-status={t.status}>
                    <td>
                      <span className="badge b-st">{defined && def ? label : '—'}</span>
                    </td>
                    <td>
                      <strong>{maskAndClamp(t.term, 120)}</strong>
                      {defined && t.quote ? (
                        <q className="pkg-lens-quote">{termQuoteText(t.quote)}</q>
                      ) : null}
                    </td>
                    <td className="dim">
                      {where
                        ? definitionLocationText(where)
                        : defined
                          ? label
                          : 'Not found in any file'}
                    </td>
                    <td className="pkg-ref-n">{t.mentions}</td>
                    <td data-testid="package-term-status">
                      <span className={`badge ${defined ? 'b-ok' : 'b-fix'}`}>
                        <Icon name={defined ? 'check' : 'info'} />
                        {defined ? 'Defined' : 'Unverified'}
                      </span>
                      <span className="sr"> {statusText}</span>
                    </td>
                    <td className="pkg-ref-acts">
                      {defined && def && !def.isPrimary ? (
                        <button
                          type="button"
                          className="btn"
                          data-testid="package-term-open"
                          aria-label={`Open the definition of ${maskAndClamp(t.term, 120)} in ${label}`}
                          onClick={() =>
                            openPackageFile(view, def.id, where ? where.blockIndex : null)
                          }
                        >
                          {`Open in ${label} →`}
                        </button>
                      ) : null}
                      {(() => {
                        const f = findingForTerm(findings, t.term);
                        return f ? <SeeInFindings findingId={f.id} label={t.term} /> : null;
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
