import { describe, expect, it } from 'vitest';
import { resolveLabel, scopeMismatch } from '../../src/memory/label';

// Variance D5: a decision with scope `fund` counts for already_answered only in the same fund.
const FP = 'a'.repeat(64);
const finding = { severity: 'high' as const, issue_class: 'ambiguity', fingerprint: FP };
const answered = (over: Record<string, unknown> = {}) => ({
  fingerprint: FP,
  status: 'active' as const,
  decision: 'answered' as const,
  counsel_option: 'A' as const,
  fund_name: 'Fund A',
  ...over,
});

describe('variance-label-scope-rule (D5)', () => {
  it('should count a fund-scoped decision for already_answered only in the same fund', () => {
    const d = answered({ scope: 'fund' });
    expect(resolveLabel(finding, d, { fundName: 'Fund A' })).toBe('already_answered');
    expect(resolveLabel(finding, d, { fundName: 'Fund B' })).toBe('new');
    expect(resolveLabel(finding, d, {})).toBe('new');
  });

  it('a firm_template decision applies in every fund', () => {
    const d = answered({ scope: 'firm_template' });
    expect(resolveLabel(finding, d, { fundName: 'Fund B' })).toBe('already_answered');
  });

  it('scope absent or ctx absent behaves exactly as before', () => {
    expect(resolveLabel(finding, answered(), { fundName: 'Fund B' })).toBe('already_answered');
    expect(resolveLabel(finding, answered({ scope: 'fund' }))).toBe('already_answered');
    expect(resolveLabel(finding, null, { fundName: 'Fund A' })).toBe('new');
  });

  it('a mismatched fund-scoped dismissal is not applied either', () => {
    const d = answered({ decision: 'dismissed', counsel_option: undefined, scope: 'fund' });
    expect(resolveLabel(finding, d, { fundName: 'Fund A' })).toBe('dismissed_reconfirm');
    expect(resolveLabel(finding, d, { fundName: 'Fund B' })).toBe('new');
  });

  it('scopeMismatch is true only for scope fund with a ctx of another fund', () => {
    expect(scopeMismatch({ scope: 'fund', fund_name: 'Fund A' }, { fundName: 'Fund B' })).toBe(
      true,
    );
    expect(scopeMismatch({ scope: 'fund', fund_name: 'Fund A' }, { fundName: 'Fund A' })).toBe(
      false,
    );
    expect(scopeMismatch({ scope: 'fund', fund_name: 'Fund A' })).toBe(false);
    expect(scopeMismatch({ scope: 'firm_template', fund_name: 'Fund A' }, { fundName: 'X' })).toBe(
      false,
    );
    expect(scopeMismatch({ fund_name: 'Fund A' }, { fundName: 'X' })).toBe(false);
  });
});
