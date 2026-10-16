import { describe, expect, it } from 'vitest';
import { ACCOUNT_NUMBER_RE, mask, sensitiveSpans } from '../../src/memory/mask';

/** F3: ACCOUNT_NUMBER_RE widened (digit runs over 31, IBAN, alpha-prefixed account); bounded. */
const m = (s: string) => mask(s, sensitiveSpans(s));

describe('mask-widening (F3)', () => {
  it('should mask a 40-digit run and an IBAN', () => {
    const forty = '1234567890'.repeat(4);
    expect(m(`Account ${forty} end`)).toBe('Account #7890 end');
    expect(m('IBAN GB82 WEST 1234 5698 7654 32 please')).toBe('IBAN #5432 please');
    expect(m('IBAN DE89370400440532013000.')).toBe('IBAN #3000.');
  });

  it('masks alpha-prefixed account numbers', () => {
    expect(m('Ref DDA-12345678 for the wire')).toBe('Ref #5678 for the wire');
    expect(m('Acct AC12345678')).toBe('Acct #5678');
  });

  it('keeps the existing behavior for 6..31 digit runs and short numbers', () => {
    expect(m('ABA 990000017 at Example Bank.')).toBe('ABA #0017 at Example Bank.');
    expect(m('Section 12, Rule 506(b), 2024, ZIP 02206')).toBe(
      'Section 12, Rule 506(b), 2024, ZIP 02206',
    );
    expect(m('1010-0069-5')).toBe('#0695');
  });

  it('does not over-mask capitalized words or short codes', () => {
    expect(sensitiveSpans('ERISA plans and IRA accounts under Form W-9 or W-8BEN')).toEqual([]);
    expect(sensitiveSpans('Class A Shares, Part B of Section 6')).toEqual([]);
  });

  it('stays linear on hostile input (100k digits / 100k capitals)', () => {
    for (const s of ['9'.repeat(100_000), 'AB12 '.repeat(20_000), 'A'.repeat(100_000)]) {
      const t0 = performance.now();
      for (const _ of s.matchAll(new RegExp(ACCOUNT_NUMBER_RE.source, 'g')));
      expect(performance.now() - t0).toBeLessThan(500);
    }
  });
});
