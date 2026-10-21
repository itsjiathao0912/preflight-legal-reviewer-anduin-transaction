import type { DocumentRequest, ExternalReference } from '@aduin/core';
import { describe, expect, it } from 'vitest';
import {
  aboutLine,
  groupDocuments,
  isOverdue,
  isoDay,
  locationLine,
  neededByOf,
  requestStatus,
  requestText,
  sentenceQuote,
  waitingOf,
} from './request-model';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 22, 12).getTime();

const req = (over: Partial<DocumentRequest>): DocumentRequest => ({
  id: '0123456789abcdef',
  targetKey: 'annex:f',
  label: 'Annex F',
  targetFamily: 'annex',
  quote: 'If the Investor is a Benefit Plan Investor, please complete Annex F.',
  count: 3,
  firstDocId: 'a'.repeat(64),
  ...over,
});

const ref = (targetKey: string, section: string): ExternalReference =>
  ({
    targetKey,
    location: { blockIndex: 0, start: 0, end: 1, sectionPath: ['Part I', section] },
  }) as unknown as ExternalReference;

describe('request-model: status', () => {
  const c = (total: number, answered: number, documents = 0) => ({ total, answered, documents });

  it('should be none when the owner has nothing to ask', () => {
    expect(requestStatus(c(0, 0), undefined)).toBe('none');
  });

  it('should be Draft until sent, then Sent', () => {
    expect(requestStatus(c(2, 0), undefined)).toBe('draft');
    expect(requestStatus(c(2, 0), { sentAt: NOW })).toBe('sent');
  });

  it('should be Partly answered with some answers, Answered with all', () => {
    expect(requestStatus(c(2, 1), { sentAt: NOW })).toBe('partly');
    expect(requestStatus(c(2, 1), undefined)).toBe('partly');
    expect(requestStatus(c(2, 2), undefined)).toBe('answered');
  });

  it('should keep the GP request open while a document is missing', () => {
    expect(requestStatus(c(0, 0, 2), undefined)).toBe('draft');
    expect(requestStatus(c(1, 1, 2), undefined)).toBe('partly');
    expect(requestStatus(c(1, 1, 0), undefined)).toBe('answered');
    expect(waitingOf(c(3, 1, 2))).toBe(4);
  });

  it('should be Overdue only when Needed by is past and not Answered', () => {
    const past = isoDay(NOW - 2 * DAY);
    expect(isOverdue('sent', past, NOW)).toBe(true);
    expect(isOverdue('partly', past, NOW)).toBe(true);
    expect(isOverdue('draft', past, NOW)).toBe(true);
    expect(isOverdue('answered', past, NOW)).toBe(false);
    expect(isOverdue('none', past, NOW)).toBe(false);
    expect(isOverdue('sent', isoDay(NOW), NOW)).toBe(false);
  });

  it('should default Needed by to 7 days after today, or after sending', () => {
    expect(neededByOf(undefined, NOW)).toBe(isoDay(NOW + 7 * DAY));
    expect(neededByOf({ sentAt: NOW - 3 * DAY }, NOW)).toBe(isoDay(NOW + 4 * DAY));
    expect(neededByOf({ neededBy: '2026-11-01' }, NOW)).toBe('2026-11-01');
    expect(neededByOf({ neededBy: 'nope' }, NOW)).toBe(isoDay(NOW + 7 * DAY));
  });

  it('should build the About line from fund, document and version', () => {
    expect(aboutLine({ fund: 'Fund III', name: 'Sub Agreement', version: 'v1' })).toBe(
      'Fund III · Sub Agreement · v1',
    );
    expect(aboutLine(null)).toBe('Document');
  });
});

describe('request-model: GP documents', () => {
  it('should group by kind in a fixed order with one sentence and the location', () => {
    const g = groupDocuments(
      [
        req({ targetKey: 'w9', label: 'Form W-9', targetFamily: 'tax_form' }),
        req({}),
        req({ targetKey: 'sl', label: 'Kestrel Side Letter', targetFamily: 'side_letter' }),
      ],
      [ref('annex:f', 'Section 9.1'), ref('sl', '6.4'), ref('sl', '14.3'), ref('sl', '6.4')],
    );
    expect(g.map((x) => x.label)).toEqual(['Annex', 'Side letter', 'Tax forms']);
    expect(g[0]!.docs[0]!.location).toBe('Section 9.1');
    expect(g[1]!.docs[0]!.location).toBe('Sections 6.4, 14.3');
    expect(g[2]!.docs[0]!.location).toBe('');
    expect(g[0]!.docs[0]).not.toHaveProperty('count');
  });

  it('should start a cut quote at a word, then at the next full sentence', () => {
    expect(sentenceQuote('p Agreement and the Annex F schedule')).toBe(
      '…Agreement and the Annex F schedule',
    );
    expect(
      sentenceQuote(
        'ver to the Administrator. If the Investor is a Benefit Plan Investor, complete Annex F.',
      ),
    ).toBe('If the Investor is a Benefit Plan Investor, complete Annex F.');
    expect(sentenceQuote('Complete Annex F.')).toBe('Complete Annex F.');
  });

  it('should join section labels', () => {
    expect(locationLine(['Section 8'])).toBe('Section 8');
    expect(locationLine(['Section 6.4', 'Section 14.3'])).toBe('Sections 6.4, 14.3');
    expect(locationLine([])).toBe('');
  });

  it('should write a plain-text request with open questions and documents', () => {
    const t = requestText({
      owner: 'gp',
      to: 'GP of Fund III',
      about: 'Fund III · v1',
      neededBy: '2026-10-29',
      questions: [
        { text: 'Which reading applies?', quote: 'Q', loc: 'Section 1', answer: null },
        { text: 'Done', quote: 'Q2', loc: 'Section 2', answer: 'A' },
      ],
      groups: groupDocuments([req({})]),
    });
    expect(t).toContain('To: GP of Fund III');
    expect(t).toContain('Needed by: 29 Oct 2026');
    expect(t).toContain('1. Which reading applies?');
    expect(t).not.toContain('Done');
    expect(t).toContain('Annex (1)');
    expect(t).toContain('1. Annex F');
    expect(t).not.toMatch(/referenced/i);
  });
});
