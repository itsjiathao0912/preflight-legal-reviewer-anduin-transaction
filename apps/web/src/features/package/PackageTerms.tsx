import { maskAndClamp, maskQuote, type CrossDocTerm } from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import { TYPE_LABELS } from '../open-document/PackageConfirmTable';
import type { PackageView } from './contract';

const REASON: Record<NonNullable<CrossDocTerm['reason']>, string> = {
  no_reference_document: 'No LPA in the package',
  not_in_reference_documents: 'Not found in the reference documents',
};

export function PackageTerms({ view }: { view: PackageView }) {
  return (
    <section
      className="pkg-lens-sec"
      data-testid="package-lens-terms"
      aria-label="Terms from other documents"
    >
      <h3>Terms from other documents</h3>
      <p className="mut">These lists explain the checks. They are not findings.</p>
      {view.terms.length === 0 ? <p className="mut">No terms to look up.</p> : null}
      <ul className="pkg-lens-list">
        {view.terms.map((t) => {
          const def = view.documents.find((d) => d.id === t.definingDocId);
          const defined = t.status === 'defined_in_package';
          return (
            <li
              key={t.term}
              className="pkg-lens-term"
              data-testid="package-term"
              data-status={t.status}
            >
              <strong>{maskAndClamp(t.term, 120)}</strong>{' '}
              <span className="mut">
                ({t.mentions} {t.mentions === 1 ? 'mention' : 'mentions'})
              </span>
              <div className="pkg-lens-st">
                <Icon name={defined ? 'check' : 'info'} />
                {defined
                  ? `Defined in ${def ? TYPE_LABELS[def.type] : 'a reference document'}`
                  : `Unverified: ${t.reason ? REASON[t.reason] : REASON.not_in_reference_documents}`}
              </div>
              {defined && t.quote ? <q className="pkg-lens-quote">{maskQuote(t.quote)}</q> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
