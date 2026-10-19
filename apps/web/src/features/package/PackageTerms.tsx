import { maskAndClamp, maskQuote, type CrossDocTerm, type DefinitionLocation } from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import { TYPE_LABELS } from '../open-document/PackageConfirmTable';
import type { PackageView } from './contract';
import { openPackageFile } from './open-file';

/** "Section 1.1, ¶ 4" (numbered part) or "Article I. Definitions, ¶ 12" (block in the file). */
export function definitionLocationText(loc: DefinitionLocation): string {
  if (loc.sectionLabel && loc.paragraph)
    return `Section ${maskAndClamp(loc.sectionLabel, 12)}, ¶ ${loc.paragraph}`;
  const sec = loc.sectionPath.at(-1);
  return `${sec ? `${maskAndClamp(sec, 80)}, ` : ''}¶ ${loc.blockIndex + 1}`;
}

const QUOTE_MARKS = /^[\s"'“”‘’«»]+|[\s"'“”‘’«»]+$/g;

/**
 * Display text of a stored term quote inside <q> (which adds its own quote marks): outer quote
 * marks are stripped so they do not double up, and a quote that does not end a sentence was cut
 * by the stored-quote clamp, so it ends at a word boundary with "…".
 */
export function termQuoteText(quote: string): string {
  let s = maskQuote(quote.replace(QUOTE_MARKS, ''));
  if (s.endsWith('…')) s = s.slice(0, -1);
  if (/[.;:!?)]$/.test(s)) return s;
  const cut = s.lastIndexOf(' ');
  if (cut > s.length / 2) s = s.slice(0, cut);
  return `${s.replace(/[\s,;:(–—-]+$/, '')}…`;
}

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
          const where = defined && t.definitionLocation ? t.definitionLocation : null;
          const label = def ? TYPE_LABELS[def.type] : 'a reference document';
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
              <div className="pkg-lens-row">
                <span className="pkg-lens-st" data-testid="package-term-status">
                  <Icon name={defined ? 'check' : 'info'} />
                  {defined
                    ? `Defined in ${label}${where ? ` · ${definitionLocationText(where)}` : ''}`
                    : `Unverified: ${t.reason ? REASON[t.reason] : REASON.not_in_reference_documents}`}
                </span>
                {defined && def && !def.isPrimary ? (
                  <button
                    type="button"
                    className="btn"
                    data-testid="package-term-open"
                    aria-label={`Open the definition of ${maskAndClamp(t.term, 120)} in ${label}`}
                    onClick={() => openPackageFile(view, def.id, where ? where.blockIndex : null)}
                  >
                    {`Open in ${label} →`}
                  </button>
                ) : null}
              </div>
              {defined && t.quote ? (
                <q className="pkg-lens-quote">{termQuoteText(t.quote)}</q>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
