import { describe, expect, it } from 'vitest';
import { LAW_FIRMS, normalizeFirmAlias, resolveFirm } from '../../src/memory/firms';
import { rulesHash } from '../../src/memory/rulesHash';
import { sha256Hex } from '../../src/model/hash';

describe('firms', () => {
  it('ships the canonical firms', () => {
    expect(LAW_FIRMS.map((f) => f.id)).toEqual([
      'partners-group',
      'firm-x',
      'firm-y',
      'hartwell-crane',
      'ostrander-pell',
      'calder-reyes',
    ]);
  });
  it('resolves every alias of the three Variance reference firms to its own firm', () => {
    for (const a of ['Hartwell & Crane LLP', 'Hartwell & Crane', 'HC LLP', 'H&C', 'hartwell-crane'])
      expect(resolveFirm(a), a).toBe('hartwell-crane');
    for (const a of ['Ostrander Pell LLP', 'Ostrander Pell', 'ostrander-pell'])
      expect(resolveFirm(a), a).toBe('ostrander-pell');
    for (const a of ['Calder Reyes', 'calder-reyes'])
      expect(resolveFirm(a), a).toBe('calder-reyes');
    expect(normalizeFirmAlias('H&C')).toBe('h and c');
    expect(normalizeFirmAlias('HC LLP')).toBe('hc');
  });
  it('Sutter Lane & Abernathy LLP stays unknown (sample package 03 is the new-firm case)', () => {
    expect(resolveFirm('Sutter Lane & Abernathy LLP')).toBeNull();
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
