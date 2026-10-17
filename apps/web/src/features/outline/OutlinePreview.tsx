import type { OutlineDraft } from '@aduin/core';

/** Counts-only preview of the logic outline (read from the same `counts` the file carries). */
export function OutlinePreview({ outline }: { outline: OutlineDraft }) {
  const c = outline.counts;
  const items: Array<[string, string, number]> = [
    ['sections', 'sections incl. parts', c.sections],
    ['references', 'references', c.references],
    ['branches', 'branches', c.branches],
    ['definedTerms', 'defined terms', c.definedTerms],
    ['investorPaths', 'investor paths', c.investorPaths],
  ];
  return (
    <p className="mut outline-preview" data-testid="outline-preview" aria-label="Outline contents">
      {items.map(([key, label, n], i) => (
        <span key={key} data-testid={`outline-preview-${key}`} data-count={n}>
          {i > 0 ? ' · ' : ''}
          {n} {label}
        </span>
      ))}
    </p>
  );
}
