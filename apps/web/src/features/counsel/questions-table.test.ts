import { describe, expect, it } from 'vitest';
import type { QuestionItem } from '../variance/owner-groups';
import {
  activeFilterCount,
  matchesFilters,
  NO_FILTERS,
  shortTitle,
  snipQuote,
} from './questions-table';

const item = (over: { change?: boolean; issue_class?: string; title?: string; loc?: string }) =>
  ({
    change: over.change ?? false,
    owner: 'counsel',
    row: {
      sev: 'block',
      f: {
        issue_class: over.issue_class ?? 'ambiguity',
        title: over.title ?? 'Ambiguous wording in the eligibility clause',
        loc: over.loc ?? 'Section 4 · ¶2',
      },
    },
  }) as unknown as QuestionItem;

describe('questions-table', () => {
  it('should build the short titles', () => {
    expect(shortTitle(item({ change: true }), 'Fund II v3')).toBe(
      'Changed since Fund II v3 · Section 4 · ¶2',
    );
    expect(shortTitle(item({ change: true }), null)).toBe(
      'Changed since last version · Section 4 · ¶2',
    );
    expect(shortTitle(item({ issue_class: 'broken_cross_reference' }), null)).toBe(
      'Broken cross-reference · Section 4 · ¶2',
    );
    const long = 'word '.repeat(40).trim();
    const t = shortTitle(item({ title: long }), null);
    expect(t.length).toBeLessThanOrEqual(80);
    expect(t.endsWith('…')).toBe(true);
  });

  it('should start a snippet at a word boundary', () => {
    expect(snipQuote('p Agreement shall govern')).toBe('…Agreement shall govern');
    expect(snipQuote('ver to the Administrator')).toBe('…to the Administrator');
    expect(snipQuote('The Partnership Agreement')).toBe('The Partnership Agreement');
    expect(snipQuote('"Annex F"')).toBe('"Annex F"');
    expect(snipQuote('word')).toBe('word');
  });

  it('should combine the filters with AND and count active ones', () => {
    const x = { owner: 'gp' as const, sev: 'fix' as const, waiting: true };
    expect(matchesFilters(x, NO_FILTERS)).toBe(true);
    expect(matchesFilters(x, { status: 'open', who: 'gp', sev: 'fix' })).toBe(true);
    expect(matchesFilters(x, { status: 'answered', who: 'gp', sev: 'fix' })).toBe(false);
    expect(matchesFilters(x, { status: 'open', who: 'counsel', sev: 'all' })).toBe(false);
    expect(matchesFilters(x, { status: 'all', who: 'all', sev: 'block' })).toBe(false);
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount({ status: 'open', who: 'gp', sev: 'all' })).toBe(2);
  });
});
