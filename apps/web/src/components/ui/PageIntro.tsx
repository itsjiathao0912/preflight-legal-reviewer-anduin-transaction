import type { ReactNode } from 'react';
import { Icon } from './icon';

/** One-line explanation under a page title (existing calm "banner note" style). */
export function PageIntro({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <div className="banner on note page-intro" role="note" data-testid={testId}>
      <Icon name="info" />
      <span>{children}</span>
    </div>
  );
}
