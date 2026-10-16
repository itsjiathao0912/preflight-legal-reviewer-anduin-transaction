import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import type { Finding } from '../../src/findings/schema';
import { isBlocking } from '../../src/findings/severity';
import { fingerprintFor } from '../../src/memory/fingerprint';
import { resolveLabel } from '../../src/memory/label';

/**
 * memory-fixtures (AC59 / AC60 / AC44 / AC45 / AC47 inputs): engine output on fund I / II / Y equals
 * fixtures/memory/fund-expectations.json. Labels are recomputed here from the fund I decisions and
 * answers (fingerprints checked against fund I engine output), never read back from the file.
 */
const MEM = new URL('../../../../fixtures/memory/', import.meta.url);
const readJson = <T>(f: string): T => JSON.parse(readFileSync(new URL(f, MEM), 'utf8')) as T;

interface Passage {
  key: string;
  fund: 'fund-II' | 'fund-Y';
  firm_id: string;
  quote: string;
  issue_class: string;
  severity: Finding['severity'];
  blocking: boolean;
  quote_hash: string;
  fingerprint: string;
  label: string;
  category: 'previously_dismissed' | 'already_answered' | 'new' | 'edited';
  fund_I_fingerprint?: string;
}
interface Expectations {
  funds: Record<string, { file: string; firm_id: string; fund_name: string; findings: number }>;
  summary: Record<string, number>;
  passages: Passage[];
}
interface Decision {
  id: string;
  law_firm_id: string;
  quote: string;
  quote_hash: string;
  fingerprint: string;
  issue_class: string;
  decision: 'dismissed' | 'answered';
  reason_code?: string;
  counsel_option?: 'A' | 'B' | 'C';
}

const exp = readJson<Expectations>('fund-expectations.json');
const decisions = readJson<{ decisions: Decision[] }>('fund-I-decisions.json').decisions;
const answers = readJson<{ answers: Decision[] }>('fund-I-answers.json').answers;
const engine = (fund: string) =>
  runDeterministic(analyzeHtml(readFileSync(new URL(exp.funds[fund]!.file, MEM), 'utf8')));

function label(f: Finding, firm: string): string {
  const fp = fingerprintFor(f, firm)!;
  const d = [...decisions, ...answers].find((x) => x.law_firm_id === firm && x.fingerprint === fp);
  return resolveLabel(
    { ...f, fingerprint: fp },
    d
      ? {
          fingerprint: d.fingerprint,
          status: 'active',
          decision: d.decision,
          ...(d.counsel_option ? { counsel_option: d.counsel_option } : {}),
        }
      : null,
  );
}

describe('memory-fixtures (AC59 inputs)', () => {
  const fI = engine('fund-I');
  const fII = engine('fund-II');
  const fY = engine('fund-Y');

  it('fund I decisions and answers match real fund I findings (fingerprints recomputed)', () => {
    expect(fI).toHaveLength(exp.funds['fund-I']!.findings);
    for (const d of [...decisions, ...answers]) {
      const f = fI.find((x) => x.quote === d.quote && x.issue_class === d.issue_class);
      expect(f, d.id).toBeDefined();
      expect(f!.quote_hash).toBe(d.quote_hash);
      expect(fingerprintFor(f!, d.law_firm_id)).toBe(d.fingerprint);
      if (d.decision === 'dismissed') expect(d.reason_code).toBeTruthy();
      else expect(d.counsel_option).toMatch(/^[ABC]$/);
    }
    expect(decisions).toHaveLength(3);
    expect(answers).toHaveLength(3);
  });

  it('should label fund II passages exactly as fund-expectations.json states', () => {
    expect(fII).toHaveLength(8);
    const rows = exp.passages.filter((p) => p.fund === 'fund-II');
    expect(rows).toHaveLength(8);
    for (const p of rows) {
      const f = fII.find((x) => x.quote === p.quote && x.issue_class === p.issue_class)!;
      expect(f, p.key).toBeDefined();
      expect(f.quote_hash).toBe(p.quote_hash);
      expect(fingerprintFor(f, p.firm_id)).toBe(p.fingerprint);
      expect(f.severity).toBe(p.severity);
      expect(label(f, p.firm_id)).toBe(p.label);
      // category -> label: edited resolves to "new" through a fingerprint mismatch
      const want = p.category === 'edited' ? 'new' : p.category;
      expect(p.label).toBe(want);
    }
    const cat = (c: string) => rows.filter((p) => p.category === c);
    // AC59 arithmetic: 3 non-blocking previously handled + 2 counsel-answered = 5 handled; 3 need action
    expect(cat('previously_dismissed')).toHaveLength(3);
    expect(cat('previously_dismissed').every((p) => !isBlocking(p.severity))).toBe(true);
    expect(cat('already_answered')).toHaveLength(2);
    expect(cat('new')).toHaveLength(2);
    expect(cat('edited')).toHaveLength(1);
    const handled = rows.filter((p) => p.label !== 'new').length;
    expect(handled).toBe(5);
    expect(rows.length - handled).toBe(3);
    expect((handled / rows.length) * 100).toBe(62.5);
    expect(exp.summary).toMatchObject({ handled: 5, need_action: 3, fewer_to_review_pct: 62.5 });
  });

  it('the edited passage ("Section 4" -> "Section 5") is still a real finding with a different fingerprint', () => {
    const p = exp.passages.find((x) => x.fund === 'fund-II' && x.category === 'edited')!;
    expect(p.quote).toContain('Section 5');
    expect(p.fingerprint).not.toBe(p.fund_I_fingerprint);
    const old = fI.find((x) => x.quote.includes('complete Section 4'))!;
    expect(fingerprintFor(old, 'firm-x')).toBe(p.fund_I_fingerprint);
  });

  it('fund Y: identical quotes, fingerprints differ because the firm differs; firm-x memory never leaks', () => {
    expect(fY).toHaveLength(8);
    const ii = exp.passages.filter((p) => p.fund === 'fund-II');
    const yy = exp.passages.filter((p) => p.fund === 'fund-Y');
    expect(yy.map((p) => p.quote)).toEqual(ii.map((p) => p.quote));
    expect(exp.funds['fund-Y']!.firm_id).not.toBe(exp.funds['fund-II']!.firm_id);
    for (const p of yy) {
      const f = fY.find((x) => x.quote === p.quote)!;
      const twin = ii.find((x) => x.key === p.key)!;
      expect(f.quote_hash).toBe(twin.quote_hash);
      expect(fingerprintFor(f, p.firm_id)).toBe(p.fingerprint);
      expect(p.fingerprint).not.toBe(twin.fingerprint);
      expect(label(f, p.firm_id)).toBe('new');
    }
  });
});
