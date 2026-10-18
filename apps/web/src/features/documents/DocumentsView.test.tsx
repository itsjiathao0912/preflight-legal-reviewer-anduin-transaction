import 'fake-indexeddb/auto';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useReview } from '../../state/review';
import { render, screen } from '../../test-utils';
import { appDb } from '../../storage/db';
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

  it('lists an upload stored in the browser after a reload (nothing in recent)', async () => {
    const db = appDb()!;
    await db.documents.put({
      id: 'up_stored1',
      name: 'Stored upload.pdf',
      kind: 'upload',
      bytes: new Uint8Array([1]),
      firmId: null,
      fund: 'F',
      version: 'v1',
      createdAt: Date.now(),
    });
    const c = render(<DocumentsView />);
    for (let i = 0; i < 50 && !c.querySelector('[data-testid="documents-row"]'); i++) {
      await act(() => new Promise((r) => setTimeout(r, 10)));
    }
    const row = c.querySelector('[data-testid="documents-row"]')!;
    expect(row.textContent).toContain('Stored upload.pdf');
    expect(row.textContent).toContain('Uploaded');
    expect(row.textContent).toContain('kept until tomorrow');
    expect(row.textContent).toContain('Upload');
    await db.documents.clear();
  });
});
