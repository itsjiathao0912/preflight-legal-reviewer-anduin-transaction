import { describe, expect, it } from 'vitest';
import { snapToSentence } from '../../src/memory/snap';

const snap = (text: string, needle: string) => {
  const i = text.indexOf(needle);
  return snapToSentence(text, i, i + needle.length).quote;
};

describe('snapToSentence', () => {
  it('expands to the enclosing sentence', () => {
    expect(snap('First one. The offered Units will not be sold. Third.', 'offered Units')).toBe(
      'The offered Units will not be sold.',
    );
  });
  it('ignores closed-list abbreviations', () => {
    expect(snap('Wire to Acme Inc. Holdings for the U.S. account now. Next one.', 'Holdings')).toBe(
      'Wire to Acme Inc. Holdings for the U.S. account now.',
    );
    expect(snap('See e.g. Section 4 here. Done.', 'Section 4')).toBe('See e.g. Section 4 here.');
  });
  it('ignores decimals', () => {
    expect(snap('A fee of 3.5 percent applies to Class D. Other.', 'fee')).toBe(
      'A fee of 3.5 percent applies to Class D.',
    );
  });
  it('handles list items (semicolon boundaries and numbered starts)', () => {
    expect(snap('5. A corporation; 6. A dealer in securities; 7. A merchant.', 'dealer')).toBe(
      '6. A dealer in securities;',
    );
  });
  it('a block with no terminator is one sentence', () => {
    expect(snap('Name of Custodian Custodian Tax ID', 'Tax')).toBe(
      'Name of Custodian Custodian Tax ID',
    );
  });
  it('over-limit sentences are cut to a 1000-char window centred on the match at word boundaries', () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
    const text = `${words} TARGET ${words}.`;
    const q = snap(text, 'TARGET');
    expect(q.length).toBeLessThanOrEqual(1000);
    expect(q).toContain('TARGET');
    expect(q.startsWith('word')).toBe(true);
    expect(/\bword\d+$/.test(q) || q.endsWith('.')).toBe(true);
  });
  it('a quote spanning two lines (joined block text) stays whole', () => {
    const text = [
      'Capitalized terms used but not defined herein shall have the meanings',
      'given to them in the Circular. Next sentence.',
    ].join(' ');
    expect(snap(text, 'meanings given')).toBe(
      'Capitalized terms used but not defined herein shall have the meanings given to them in the Circular.',
    );
  });
  it('is pure and deterministic', () => {
    const t = 'One. Two three. Four.';
    expect(snapToSentence(t, 5, 8)).toEqual(snapToSentence(t, 5, 8));
  });
});
