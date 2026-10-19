import { describe, expect, it } from 'vitest';
import { locateQuote, textRange, useDocFocus } from './doc-focus';

describe('doc focus', () => {
  it('show sets the target and bumps seq; clear removes it', () => {
    const s0 = useDocFocus.getState().seq;
    useDocFocus.getState().show('b1', '“x”');
    expect(useDocFocus.getState().focus).toEqual({ blockId: 'b1', quote: '“x”' });
    expect(useDocFocus.getState().seq).toBe(s0 + 1);
    useDocFocus.getState().show('b1', '  ');
    expect(useDocFocus.getState().focus?.quote).toBeNull();
    useDocFocus.getState().clear();
    expect(useDocFocus.getState().focus).toBeNull();
  });
  it('locates a quote tolerant of quote marks, case and whitespace', () => {
    const text = 'Intro. As defined in the  "Partnership Agreement", the Fund may invest.';
    const at = locateQuote(text, '“partnership agreement”, the fund');
    expect(at && text.slice(at.start, at.end)).toBe('Partnership Agreement", the Fund');
  });
  it('falls back to a leading prefix and returns null when absent', () => {
    const text = 'The Fund may invest in securities of any kind.';
    const at = locateQuote(text, 'The Fund may invest in bonds only…');
    expect(at?.start).toBe(0);
    expect(text.slice(0, at!.end).startsWith('The Fund may inv')).toBe(true);
    expect(locateQuote(text, 'completely unrelated words here')).toBeNull();
  });
  it('builds a DOM range across text nodes', () => {
    const el = document.createElement('p');
    const b = document.createElement('b');
    b.textContent = 'big';
    el.append('Hello ', b, ' world');
    const r = textRange(el, 4, 9);
    expect(r?.toString()).toBe('o big');
  });
});
