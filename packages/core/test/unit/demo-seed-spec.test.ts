import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DemoSeedSpecSchema } from '../../src/contracts/seed-spec';
import { fingerprintFor } from '../../src/memory/fingerprint';
import { isBlocking } from '../../src/findings/severity';
import { analyzed } from '../helpers/samples';

/**
 * demo-seed-spec (D-7 / M7): fixtures/memory/demo-seed-spec.json parses with DemoSeedSpecSchema;
 * every decision quote equals a real engine finding on its sample_id; >= 3 same-pattern
 * same-reason dismissals (M7) and the documented C3 fallback (shared fingerprints + answers).
 */
const spec = DemoSeedSpecSchema.parse(
  JSON.parse(
    readFileSync(
      new URL('../../../../fixtures/memory/demo-seed-spec.json', import.meta.url),
      'utf8',
    ),
  ),
);

describe('demo-seed-spec (M7)', () => {
  it('should match every demo-seed decision to a real engine finding', () => {
    expect(spec.decisions.length).toBeGreaterThanOrEqual(3);
    for (const d of spec.decisions) {
      const f = analyzed(Number(d.sample_id)).findings.find(
        (x) => x.quote === d.quote && x.issue_class === d.issue_class,
      );
      expect(f, `${d.id} on #${d.sample_id}`).toBeDefined();
      if (d.pattern_key) expect(f!.pattern_key).toBe(d.pattern_key);
      expect(d.law_firm_id).toBe('partners-group');
    }
  });

  it('holds >= 3 same-pattern, same-reason dismissals across #3, #5, #6 (M7 expected path)', () => {
    const groups = new Map<string, Set<string>>();
    for (const d of spec.decisions) {
      if (d.decision !== 'dismissed' || !d.pattern_key) continue;
      const k = `${d.pattern_key}|${d.reason_code}`;
      groups.set(k, (groups.get(k) ?? new Set()).add(d.sample_id));
    }
    const m7 = [...groups.entries()].find(([, s]) => s.size >= 3)!;
    expect(m7).toBeDefined();
    expect(m7[0]).toBe('flag-placeholder:insert|firm_standard_wording');
    expect([...m7[1]].sort()).toEqual(['03', '05', '06']);
    expect(spec.rules.some((r) => r.pattern_key === 'flag-placeholder:insert')).toBe(true);
  });

  it('C3 fallback: shared non-blocking dismissals re-appear on a sibling, swapped refs are answered', () => {
    const fp = (n: number, q: string) =>
      analyzed(n)
        .findings.filter((f) => f.quote === q)
        .map((f) => fingerprintFor(f, 'partners-group')!);
    const dismissed = spec.decisions.filter(
      (d) => d.decision === 'dismissed' && d.sample_id === '03',
    );
    const sharedNonBlocking = dismissed.filter((d) => {
      const own = fp(3, d.quote)[0]!;
      return [5, 6].some((n) => fp(n, d.quote).includes(own));
    });
    expect(sharedNonBlocking.length).toBeGreaterThanOrEqual(2);
    for (const d of sharedNonBlocking) {
      const f = analyzed(3).findings.find((x) => x.quote === d.quote)!;
      expect(isBlocking(f.severity)).toBe(false);
    }
    const answered = spec.decisions.filter((d) => d.decision === 'answered');
    expect(answered.length).toBeGreaterThanOrEqual(1);
    for (const d of answered) expect(d.issue_class).toBe('broken_cross_reference');
  });

  it('carries no raw account numbers (quotes are the masked engine quotes)', () => {
    const text = JSON.stringify(
      spec.decisions.map((d) => [d.quote, d.note, d.counsel_note, d.section_path]),
    );
    expect(text).not.toMatch(/\d{5,}/);
  });
});
