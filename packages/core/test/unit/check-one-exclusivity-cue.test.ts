import { describe, expect, it } from 'vitest';
import { analyzeHtml } from '../../src/engine';
import { EXCLUSIVITY_CUES } from '../../src/adapters/html';

const cueOf = (t: string) => EXCLUSIVITY_CUES.find((re) => re.test(t))?.exec(t)?.[0];

describe('check-one-exclusivity-cue (P2-4)', () => {
  it('"(check one)" and "check one of the following" are exclusivity cues; "check one or more" is not', () => {
    expect(cueOf('Type of Subscriber (check one):')).toBe('(check one)');
    expect(cueOf('Please check one of the following')).toBe('check one');
    expect(cueOf('Check one or more boxes')).toBeUndefined();
    expect(cueOf('check one box only')).toBe('check one box only');
    expect(cueOf('Distribution method (check only one):')).toBe('check only one');
    expect(cueOf('checkbox one')).toBeUndefined();
  });

  it('an option group after "(check one)" is exclusive and carries the stated cue', () => {
    const g = analyzeHtml(
      '<html><body><p>Type of Subscriber (check one):</p><p>☐ Individual ☐ Trust ☐ Corporation</p></body></html>',
    );
    const grp = g.structure.optionGroups[0]!;
    expect(grp.exclusive).toBe(true);
    expect(grp.cue).toBe('(check one)');
  });

  it('"check all that apply" groups stay non-exclusive', () => {
    const g = analyzeHtml(
      '<html><body><p>Sources of funds (check all that apply):</p><p>☐ Salary ☐ Savings</p></body></html>',
    );
    expect(g.structure.optionGroups[0]!.exclusive).toBe(false);
  });
});
