import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
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
});
