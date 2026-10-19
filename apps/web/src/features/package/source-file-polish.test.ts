import { QUOTE_MAX } from '@aduin/core';
import { describe, expect, it } from 'vitest';
import { titleCase } from './open-file';
import { termQuoteText } from './PackageTerms';

describe('Source File polish', () => {
  it('strips a stored leading quote mark so <q> does not double it', () => {
    expect(termQuoteText('“Capital Commitment” means the amount.')).toBe(
      'Capital Commitment” means the amount.',
    );
  });
  it('ends a clamped quote (stored at QUOTE_MAX) at a word boundary with an ellipsis', () => {
    const head = '“Fees” means (a) all costs, (b) taxes and (c) any ';
    const quote = `${head}${'x'.repeat(QUOTE_MAX - head.length - 4)} oth`;
    expect(quote).toHaveLength(QUOTE_MAX);
    expect(termQuoteText(quote)).toBe(`${quote.slice(1, -4)}…`);
  });
  it('leaves a quote shorter than the clamp unchanged, even without end punctuation', () => {
    expect(termQuoteText('“Fees” means (a) all costs, (b) taxes and (c) any oth')).toBe(
      'Fees” means (a) all costs, (b) taxes and (c) any oth',
    );
  });
  it('title-cases the back label', () => {
    expect(titleCase('Subscription agreement')).toBe('Subscription Agreement');
    expect(titleCase('LPA')).toBe('LPA');
  });
});
