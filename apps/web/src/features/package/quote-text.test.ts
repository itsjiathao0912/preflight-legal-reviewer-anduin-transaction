import { QUOTE_MAX } from '@aduin/core';
import { describe, expect, it } from 'vitest';
import { quoteText } from './quote-text';

describe('quoteText', () => {
  it('strips doubled leading quote marks', () => {
    expect(quoteText('““Interests” means the units.')).toBe('Interests” means the units.');
  });
  it('starts a clamped quote cut mid-word at a word boundary with "…"', () => {
    const body = 'sdiction, and that its investment policy is ' + 'y'.repeat(QUOTE_MAX);
    const q = (body.slice(0, QUOTE_MAX - 1) + '.').slice(0, QUOTE_MAX);
    const out = quoteText(q);
    expect(out.startsWith('…and that its investment policy')).toBe(true);
  });
  it('leaves a short lowercase quote unchanged', () => {
    expect(quoteText('and that its policy.')).toBe('and that its policy.');
  });
});
