import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeHtml } from '../../src/engine';
import { classifyType, typesIn } from '../../src/investor/types';
import { investorModel } from '../../src/investor/paths';
import { analyzed } from '../helpers/samples';

/** AC61: investor types and ordered paths extracted per type (seeded fixtures; real samples informational). */
const seeded = (rel: string) =>
  analyzeHtml(
    readFileSync(new URL(`../../../../fixtures/html-seeded/${rel}`, import.meta.url), 'utf8'),
  );

describe('investor-path-extraction-fixtures (AC61)', () => {
  it('classifies the investor-type vocabulary (IRA before Individual; unknown stays unclassified)', () => {
    expect(classifyType('Individual')).toBe('individual');
    expect(classifyType('Individual Retirement Account (IRA)')).toBe('ira');
    expect(classifyType('Joint Tenants with Right of Survivorship')).toBe('joint');
    expect(classifyType('Revocable trust')).toBe('trust');
    expect(classifyType('Partnership or LLC')).toBe('partnership');
    expect(classifyType('Limited liability company')).toBe('partnership');
    expect(classifyType('Corporation: S-Corp')).toBe('corporation');
    expect(classifyType('Qualified pension plan')).toBe('erisa-plan');
    expect(classifyType('UGMA: State of ____')).toBe('custodial');
    expect(classifyType('Transfer on Death')).toBeNull();
    expect(
      classifyType(
        'it is a natural person with an individual income in excess of $200,000 in each of the two most recent years',
      ),
    ).toBeNull();
    expect(typesIn('If the Subscriber is a trust or an estate')).toEqual(['trust', 'estate']);
  });

  it('extracts the type list and an ordered path per type from a seeded form', () => {
    const m = investorModel(seeded('investor-path-dead-end/clean.html'));
    expect(m.types.map((t) => t.id)).toEqual([
      'individual',
      'joint',
      'trust',
      'corporation',
      'partnership',
      'other-entity',
    ]);
    expect(m.completion).toMatch(/^Section 3 \(SIGNATURE\)/);
    for (const p of m.paths) {
      expect(p.sections).toEqual(['1', '2', '3']);
      expect(p.reachesCompletion).toBe(true);
      expect(p.uncertain).toBe(false);
    }
    const trust = m.paths.find((p) => p.type === 'trust')!;
    expect(trust.required).toEqual(['Section 2']);
    expect(trust.citations[0]!.text).toContain('If the Subscriber is a trust');
  });

  it('skips are removed from the path in document order; heading "only" whitelists apply', () => {
    const html = `<html><body>
      <p><b>1. TYPE OF SUBSCRIBER</b></p><p>Subscriber type (check one):</p>
      <p>☐ Individual ☐ Trust ☐ IRA</p>
      <p>If the Subscriber is an individual, skip Section 2.</p>
      <p><b>2. TRUST INFORMATION</b></p><p>Trustee: ____</p>
      <p><b>3. CUSTODIAN INFORMATION (IRA only)</b></p><p>Custodian: ____</p>
      <p><b>4. SIGNATURE</b></p><p>Signature: ____</p></body></html>`;
    const m = investorModel(analyzeHtml(html));
    const by = (t: string) => m.paths.find((p) => p.type === t)!;
    expect(by('individual').sections).toEqual(['1', '4']);
    expect(by('individual').skipped).toEqual(['2', '3']);
    expect(by('trust').sections).toEqual(['1', '2', '4']);
    expect(by('ira').sections).toEqual(['1', '2', '3', '4']);
  });

  it('no investor-type option group: empty model, never an error', () => {
    const m = investorModel(seeded('flag-placeholder/placeholders.html'));
    expect(m.types).toEqual([]);
    expect(m.paths).toEqual([]);
  });

  it('informational (Agent-Probe residual): real samples #1, #7, #10 parse without dead ends', () => {
    for (const n of [1, 7, 10]) {
      const m = investorModel(analyzed(n).g);
      for (const p of m.paths) expect(p.deadEnd).toBeUndefined();
      console.info(
        `[investor] #${n} types=${m.types.map((t) => t.id).join(',') || '(none)'} completion=${m.completion ?? '(none)'}`,
      );
    }
  });
});
