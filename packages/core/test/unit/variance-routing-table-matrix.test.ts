import { describe, expect, it } from 'vitest';
import { loadVarianceRules, routeChange, routeError, runVariance } from '../../src/variance/index';
import { keywordHit } from '../../src/variance/routing';
import { demoPair, expectedDemo } from '../helpers/variance';

/**
 * AC-V11 (core): owners come from the routing table in the rules config. Demo: 7A to fund admin;
 * Singapore to GP and counsel; sanctions to counsel; 4.2 to counsel; Class A minimum to GP; tax
 * status to counsel and trust split to GP (SPEC A9). The package-01 answer key says Counsel for
 * the trust rows: a note for the design session (D-S0-6), not a rule change.
 */
const rules = loadVarianceRules();

describe('variance-routing-table-matrix', () => {
  it('should route the 7 demo changes to the owners in the routing table', () => {
    const r = runVariance(demoPair());
    const byUnit = new Map(Object.values(r.meta).map((m) => [m.unit_key_b, m] as const));
    const want: Record<string, string[]> = {
      '7A': ['fund_admin'],
      singapore: ['gp', 'counsel'],
      sanctions: ['counsel'],
      '4.2': ['counsel'],
      'class-a-minimum': ['gp'],
      'tax-status': ['counsel'],
      'trust-split': ['gp'],
    };
    for (const item of expectedDemo().items) {
      const m = byUnit.get(item.unit_key_b)!;
      expect(m.owners, item.id).toEqual(want[item.id]);
      expect(m.owners, item.id).toEqual(item.owners);
      expect(m.owner_reason.length, item.id).toBeGreaterThan(0);
    }
  });

  it('applies first-match ordering, all-conditions matching and the default owner', () => {
    const base = {
      changeType: 'changed_logic' as const,
      ruleId: 'VAR-LOGIC-DEFAULT' as const,
      audienceRestricted: false,
    };
    // title rule beats a later keyword rule
    expect(
      routeChange({ ...base, title: 'Source of Funds Verification', text: 'sanctions' }, rules)
        .owners,
    ).toEqual(['fund_admin']);
    expect(
      routeChange({ ...base, title: 'Notices', text: 'OFAC sanctions list' }, rules),
    ).toMatchObject({
      owners: ['counsel'],
      routingId: 'sanctions',
    });
    expect(
      routeChange(
        { ...base, title: 'Beneficial Owners', text: 'x', audienceRestricted: true },
        rules,
      ).routingId,
    ).toBe('audience-restriction');
    const none = routeChange({ ...base, title: 'Governing Law', text: 'New York' }, rules);
    expect(none).toEqual({
      owners: ['counsel'],
      reason: rules.config.default_reason,
      routingId: 'default',
    });
  });

  it('matches keywords at word starts only', () => {
    expect(keywordHit('the OFAC sanctions list', 'sanction')).toBe(true);
    expect(keywordHit('unsanctioned', 'sanction')).toBe(false);
    expect(keywordHit('Singapore feeder', 'singapore')).toBe(true);
  });

  it('routes error findings by issue_class row, default counsel', () => {
    expect(routeError('sensitive_data', rules).owners).toEqual(['fund_admin']);
    expect(routeError('broken_cross_reference', rules).owners).toEqual(['counsel']);
    expect(routeError('broken_cross_reference', rules).routingId).toBe(
      'issue_class:broken_cross_reference',
    );
  });
});
