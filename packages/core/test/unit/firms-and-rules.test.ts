import { describe, expect, it } from 'vitest';
import { LAW_FIRMS, normalizeFirmAlias, resolveFirm } from '../../src/memory/firms';
import { rulesHash } from '../../src/memory/rulesHash';
import { sha256Hex } from '../../src/model/hash';

describe('firms', () => {
  it('ships the canonical firms', () => {
    expect(LAW_FIRMS.map((f) => f.id)).toEqual(['partners-group', 'firm-x', 'firm-y']);
  });
  it('resolves aliases with LLP/LLC/Inc suffixes, case and punctuation', () => {
    expect(resolveFirm('Firm X LLP')).toBe('firm-x');
    expect(resolveFirm('firm x, llp')).toBe('firm-x');
    expect(resolveFirm('FIRM-X')).toBe('firm-x');
    expect(resolveFirm('Firm Y, L.L.C.')).toBe('firm-y');
    expect(resolveFirm('Partners Group (USA) Inc.')).toBe('partners-group');
    expect(normalizeFirmAlias('Firm X, L.L.P.')).toBe('firm x');
  });
  it('free text and empty input resolve to null (memory not applied)', () => {
    expect(resolveFirm('Some Other Firm LLP')).toBeNull();
    expect(resolveFirm('')).toBeNull();
    expect(resolveFirm(null)).toBeNull();
  });
});

describe('rulesHash', () => {
  it("is 'none' for no rules", () => {
    expect(rulesHash([])).toBe('none');
    expect(rulesHash(['   '])).toBe('none');
  });
  it('is order-insensitive and normalization-insensitive', () => {
    expect(rulesHash(['B rule', 'A  Rule'])).toBe(rulesHash(['a rule', 'b RULE']));
    expect(rulesHash(['a rule', 'b rule'])).toBe(sha256Hex('a rule\nb rule'));
  });
  it('changes when a rule text changes', () => {
    expect(rulesHash(['a rule'])).not.toBe(rulesHash(['a rules']));
  });
});
