import type { ComponentType } from 'react';
import { useReview } from '../../state/review';

const NOTES: Record<string, string> = {
  counsel: 'Questions for counsel, their answers and the DOCX export',
  structure:
    'Sections, cross-references, conditions, option groups, defined terms and the Investor types view',
  compare: 'Version and sibling comparison',
  memory: 'Decisions, rule suggestions and the audit trail kept for this firm',
  documents: 'Recent documents, samples and uploads',
};

/** Routed placeholder: h1 + "coming in a later build" empty state (real views arrive in later UI phases). */
export function PlaceholderView({ route, title }: { route: string; title: string }) {
  const firmName = useReview((s) => s.doc?.firmName ?? '');
  const heading = route === 'memory' && firmName ? `${firmName} memory` : title;
  return (
    <section
      className="view"
      aria-labelledby={`h-${route}`}
      data-testid="placeholder-view"
      data-route={route}
    >
      <header className="pagehead">
        <div className="tt">
          <h1 id={`h-${route}`} tabIndex={-1}>
            {heading}
          </h1>
        </div>
      </header>
      <div className="pgbody">
        <div className="empty2">
          <p className="ph-t">{NOTES[route] ?? title}: coming in a later build.</p>
        </div>
      </div>
    </section>
  );
}

export function placeholder(route: string, title: string): ComponentType {
  const C = () => <PlaceholderView route={route} title={title} />;
  C.displayName = `Placeholder(${route})`;
  return C;
}
