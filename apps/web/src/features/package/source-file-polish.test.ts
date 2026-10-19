import { describe, expect, it } from 'vitest';
import { titleCase } from './open-file';
import { termQuoteText } from './PackageTerms';

describe('Source File polish', () => {
  it('strips a stored leading quote mark so <q> does not double it', () => {
    expect(termQuoteText('“Capital Commitment” means the amount.')).toBe(
      'Capital Commitment” means the amount.',
    );
  });
  it('ends a clamped quote at a word boundary with an ellipsis', () => {
    expect(termQuoteText('“Fees” means (a) all costs, (b) taxes and (c) any oth')).toBe(
      'Fees” means (a) all costs, (b) taxes and (c) any…',
    );
  });
  it('title-cases the back label', () => {
    expect(titleCase('Subscription agreement')).toBe('Subscription Agreement');
    expect(titleCase('LPA')).toBe('LPA');
  });
});
