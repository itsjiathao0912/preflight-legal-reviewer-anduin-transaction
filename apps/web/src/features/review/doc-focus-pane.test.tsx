import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDocFocus } from '../../state/doc-focus';
import { useReview } from '../../state/review';
import { render } from '../../test-utils';
import { DocPane } from './components/DocPane';

// "Show in document" without a finding: the block is scrolled to and stays highlighted.
const blocks = [
  { id: 'b0', kind: 'paragraph', text: 'Intro text.', section: [] },
  {
    id: 'b1',
    kind: 'paragraph',
    text: 'As set out in the Partnership Agreement, the Fund.',
    section: [],
  },
];

afterEach(() => useDocFocus.setState({ focus: null }));

describe('DocPane show-in-document focus', () => {
  it('marks the focused block (no finding needed) and clears on the next finding selection', () => {
    useReview.setState({
      result: { blocks, sections: [], source: 'html' },
      doc: { id: 'd1', name: 'x.html' },
    } as never);
    useDocFocus.getState().show('b1', 'the Partnership Agreement');
    const el = render(<DocPane rows={[]} />);
    const b1 = el.querySelector('#blk-b1')!;
    expect(b1.classList.contains('doc-focus')).toBe(true);
    expect(el.querySelector('#blk-b0')!.classList.contains('doc-focus')).toBe(false);
    act(() => useReview.getState().select('f1'));
    expect(useDocFocus.getState().focus).toBeNull();
    expect(b1.classList.contains('doc-focus')).toBe(false);
  });

  it('scrolls to the focused block and the stale selected finding does not override it', () => {
    const calls: string[] = [];
    const proto = Element.prototype as { scrollIntoView?: unknown };
    const orig = proto.scrollIntoView;
    proto.scrollIntoView = vi.fn(function (this: Element) {
      calls.push(this.id || this.getAttribute('data-finding-id') || '?');
    });
    try {
      useReview.setState({
        result: { blocks, sections: [], source: 'html' },
        doc: { id: 'd2', name: 'y.html' },
        selectedId: 'f0',
        selectSeq: 3,
      } as never);
      useDocFocus.getState().show('b1', null);
      render(<DocPane rows={[]} />);
      expect(calls).toContain('blk-b1');
      expect(calls.at(-1)).toBe('blk-b1');
    } finally {
      proto.scrollIntoView = orig;
    }
  });
});
