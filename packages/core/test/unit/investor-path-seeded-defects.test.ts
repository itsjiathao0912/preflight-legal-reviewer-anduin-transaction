import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import type { Finding } from '../../src/findings/schema';
import { investorModel } from '../../src/investor/paths';

/** AC62: dead-end and missing-item (Part C and PATH-04 peer item) flagged with the clause cited. */
const html = (rel: string) =>
  readFileSync(new URL(`../../../../fixtures/html-seeded/${rel}`, import.meta.url), 'utf8');
const findings = (rel: string): Finding[] => runDeterministic(analyzeHtml(html(rel)));
const of = (fs: Finding[], cls: string) => fs.filter((f) => f.issue_class === cls);

describe('investor-path-seeded-defects (AC62)', () => {
  it('should flag an investor type with no path to the signature section', () => {
    const f = of(findings('investor-path-dead-end/skips-signature.html'), 'investor_path_dead_end');
    expect(f).toHaveLength(1);
    expect(f[0]!.severity).toBe('critical');
    expect(f[0]!.detail.facts.investor_type).toBe('Trust');
    expect(f[0]!.detail.facts.clause).toContain('skip Section 3');
    expect(f[0]!.quote).toContain('If the Subscriber is a trust, skip Section 3.');
    expect(f[0]!.detail.explanation).toContain('never reaches the signature');
  });

  it('flags "must also complete Part C" when Part C does not exist (clause cited)', () => {
    const fs = findings('investor-path-missing-item/part-c.html');
    const f = of(fs, 'investor_path_missing_item');
    expect(f).toHaveLength(1);
    expect(f[0]!.severity).toBe('high');
    expect(f[0]!.detail.facts.kind).toBe('part-c');
    expect(f[0]!.detail.facts.item).toBe('Part C of Section 2');
    expect(f[0]!.quote).toContain('must also complete Part C of Section 2');
    expect(of(fs, 'broken_conditional')).toHaveLength(1);
  });

  it('flags the app.html PATH-04 peer item: peers carry footnote 2, Partnership or LLC does not', () => {
    const f = of(
      findings('investor-path-missing-item/peer-item.html'),
      'investor_path_missing_item',
    );
    expect(f).toHaveLength(1);
    expect(f[0]!.detail.facts.kind).toBe('peer-item');
    expect(f[0]!.detail.facts.investor_type).toBe('Partnership or LLC');
    expect(f[0]!.detail.facts.item).toBe('footnote 2');
    expect(f[0]!.detail.facts.peers).toBe('Trust, Corporation, Other entity');
    expect(f[0]!.detail.interpretations).toHaveLength(2);
  });

  it('clean controls are silent (peers all marked; every type reaches the signature)', () => {
    for (const rel of [
      'investor-path-missing-item/clean.html',
      'investor-path-dead-end/clean.html',
    ]) {
      const fs = findings(rel);
      expect(of(fs, 'investor_path_missing_item'), rel).toHaveLength(0);
      expect(of(fs, 'investor_path_dead_end'), rel).toHaveLength(0);
    }
  });

  it('uncertain paths are never asserted (no completion node: no dead end even when a type skips)', () => {
    const rel = 'investor-path-dead-end/uncertain.html';
    const m = investorModel(analyzeHtml(html(rel)));
    expect(m.completion).toBeNull();
    expect(
      m.paths.every((p) => p.uncertain && !p.reachesCompletion && p.deadEnd === undefined),
    ).toBe(true);
    expect(of(findings(rel), 'investor_path_dead_end')).toHaveLength(0);
  });
});
