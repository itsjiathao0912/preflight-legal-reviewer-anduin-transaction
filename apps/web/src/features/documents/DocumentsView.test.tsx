import { afterEach, describe, expect, it } from 'vitest';
import { useReview } from '../../state/review';
import { render, screen } from '../../test-utils';
import { DocumentsView } from './DocumentsView';

const initial = useReview.getState();
afterEach(() => useReview.setState(initial, true));

describe('DocumentsView', () => {
  it('shows the empty state when nothing was opened', () => {
    const c = render(<DocumentsView />);
    expect(screen.getHeading()).toBe('Documents');
    expect(c.querySelector('[data-testid="documents-empty"]')).not.toBeNull();
  });

  it('lists an uploaded document and marks the current one', () => {
    const d = { id: 'u1', name: 'My upload.pdf', firmName: '', source: 'upload' } as never;
    useReview.setState({ recent: [d], doc: d });
    const c = render(<DocumentsView />);
    const row = c.querySelector('[data-testid="documents-row"]')!;
    expect(row.textContent).toContain('My upload.pdf');
    expect(row.textContent).toContain('No firm');
    expect(row.textContent).toContain('Upload');
    expect(row.getAttribute('aria-current')).toBe('true');
  });
});
