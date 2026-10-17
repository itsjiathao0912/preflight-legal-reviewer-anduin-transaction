import { describe, expect, it } from 'vitest';
import { injectedRulesHash, rulesHash8, selectInjectedRules } from '../../../src/llm/rules';
import { rulesHash } from '../../../src/memory/rulesHash';

const RULES = [
  'We accept "Investor" for "Subscriber" in Section 2.',
  'Signature blocks may omit the title line.',
  'Our standard wording uses "business day" in lower case.',
];

describe('rules-hash-stable-and-order-independent (core, AC51)', () => {
  it('is stable across calls and independent of input order', () => {
    const h = injectedRulesHash(RULES);
    expect(injectedRulesHash([...RULES].reverse())).toBe(h);
    expect(injectedRulesHash([RULES[1]!, RULES[2]!, RULES[0]!])).toBe(h);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('equals the core rulesHash when no cap applies (one function, client and Worker)', () => {
    expect(injectedRulesHash(RULES)).toBe(rulesHash(RULES));
    expect(injectedRulesHash([])).toBe('none');
    expect(rulesHash([])).toBe('none');
  });

  it('rulesHash8 is the first 8 hex chars or the literal none', () => {
    const sel = selectInjectedRules(RULES);
    expect(sel.hash8).toBe(sel.hash.slice(0, 8));
    expect(rulesHash8('none')).toBe('none');
    expect(selectInjectedRules([]).hash8).toBe('none');
  });

  it('changes when a rule changes (cache invalidation input)', () => {
    expect(injectedRulesHash([...RULES, 'New rule.'])).not.toBe(injectedRulesHash(RULES));
  });
});
