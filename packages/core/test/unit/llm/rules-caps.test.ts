import { describe, expect, it } from 'vitest';
import { RULES_CAPS, rulesAppliedNotice, selectInjectedRules } from '../../../src/llm/rules';
import { rulesHash } from '../../../src/memory/rulesHash';

const rule = (i: number, len = 20) => `Rule ${String(i).padStart(3, '0')} ` + 'x'.repeat(len);

describe('rules-caps (AC51, G3)', () => {
  it('caps at 20 rules, deterministically (sorted, first that fit) and reports N of M', () => {
    const texts = Array.from({ length: 25 }, (_, i) => rule(i));
    const sel = selectInjectedRules([...texts].reverse());
    expect(sel.applied).toBe(RULES_CAPS.maxRules);
    expect(sel.total).toBe(25);
    expect(sel.truncated).toBe(true);
    expect(sel.texts).toEqual(texts.slice(0, 20));
    expect(rulesAppliedNotice(sel)).toBe('20 of 25 firm rules applied');
    expect(sel.hash).toBe(rulesHash(texts.slice(0, 20)));
    expect(sel.hash).not.toBe(rulesHash(texts));
  });

  it('skips a rule over 500 code points (counted, never silently dropped)', () => {
    const long = 'A' + '\u{1F600}'.repeat(500); // 501 code points, 1001 UTF-16 units
    const ok = 'B' + 'y'.repeat(499); // exactly 500 code points
    const sel = selectInjectedRules([long, ok]);
    expect(sel.texts).toEqual([ok]);
    expect(rulesAppliedNotice(sel)).toBe('1 of 2 firm rules applied');
  });

  it('keeps the injected texts within 4 KB (UTF-8)', () => {
    const texts = Array.from({ length: 15 }, (_, i) => rule(i, 480)); // ~490 bytes each
    const sel = selectInjectedRules(texts);
    const bytes = sel.texts.reduce((n, t) => n + new TextEncoder().encode(t).length, 0);
    expect(bytes).toBeLessThanOrEqual(RULES_CAPS.maxTotalBytes);
    expect(sel.applied).toBe(8);
    expect(sel.total).toBe(15);
  });

  it('normalizes NFC / whitespace and drops empty rules before counting', () => {
    const sel = selectInjectedRules(['  Cafe\u0301   rule\n\tone ', '', '   ', '\u200b']);
    expect(sel.texts).toEqual(['Café rule one']);
    expect(sel.total).toBe(1);
    expect(sel.truncated).toBe(false);
  });
});
