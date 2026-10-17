import { describe, expect, it } from 'vitest';
import { FAMILY, INVESTOR_TYPES } from '../../src/investor/types';
import { diffAudience, loadVarianceRules, runVariance } from '../../src/variance/index';
import { demoPair } from '../helpers/variance';

/**
 * AC-V10 demo: Section 4.2 now applies only to entities formed or organized outside the United
 * States: entities are affected, US entities lose the beneficial-owner question, and the old form
 * rule is not reusable. Deterministic (audience qualifier rules + logic graph).
 */
describe('variance-impact-demo-4-2', () => {
  it('should report entities affected, US entities lose the beneficial-owner question and old rule not reusable for 4.2', () => {
    const r = runVariance(demoPair());
    const m = Object.values(r.meta).find((x) => x.unit_key_b === 'body:1/s4')!;
    expect(m.change_type).toBe('changed_logic');
    const impact = m.impact!;
    expect(impact.audience).toEqual({
      restricted: true,
      kept: ['non-us'],
      excluded: ['us'],
      families: ['entity'],
      line: 'entities affected; US entities lose the beneficial owners question; old rule not reusable',
    });
    expect(impact.reusable).toBe('no');
    expect(impact.line).toBe(impact.audience!.line);
    const entityTypes = INVESTOR_TYPES.filter((t) => FAMILY[t] === 'entity');
    for (const t of entityTypes) expect(impact.investor_types).toContain(t);
  });

  it('adds no audience restriction when the clause only names a new country', () => {
    const rules = loadVarianceRules();
    const a = diffAudience(
      'The Investor must be domiciled in the United States or Luxembourg.',
      'The Investor must be domiciled in the United States, Luxembourg or Singapore.',
      rules,
      'investor domicile',
    );
    expect(a).toEqual({
      restricted: false,
      kept: ['singapore'],
      excluded: [],
      families: [],
      line: null,
    });
    expect(diffAudience('same text', 'same text', rules, 'x')).toBeNull();
  });
});
