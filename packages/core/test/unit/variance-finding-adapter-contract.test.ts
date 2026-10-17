import { describe, expect, it } from 'vitest';
import { FindingSchema, type Finding } from '../../src/findings/schema';
import { quoteHash } from '../../src/memory/fingerprint';
import {
  encodeList,
  runRegressionChecks,
  runVariance,
  varianceMetaOf,
  VARIANCE_DETECTOR_PREFIX,
} from '../../src/variance/index';
import { demoPair, expectedSeeded, sampleVSide, seededPair, vside } from '../helpers/variance';

/**
 * D2 / AC-V19: every adapter output parses with `FindingSchema` and `varianceMetaOf`; every fact
 * value is a scalar; string facts are at most 1000 chars; list and assertion encodings round-trip;
 * a nested array or object in facts fails the schema; `varianceMetaOf` is the only decoder.
 */
function allFindings(): Finding[] {
  const out: Finding[] = [];
  out.push(...runVariance(demoPair()).findings);
  out.push(
    ...runVariance({
      baseline: vside('hartwell-crane/fund-I.html', 'Fund I'),
      current: vside('hartwell-crane/fund-II.html', 'Fund II'),
    }).findings,
  );
  for (const c of expectedSeeded()) out.push(...runVariance(seededPair(c.id)).findings);
  out.push(
    ...runVariance({ baseline: sampleVSide(5, '#5'), current: sampleVSide(6, '#6') }).findings,
  );
  out.push(
    ...runRegressionChecks(vside('hartwell-crane/fund-III.html', 'Fund III').structure, [
      {
        kind: 'scope_exists',
        label: 'Appendix C',
        statement: 'Appendix C must exist',
        sourceFundName: 'Fund II',
      },
    ]),
  );
  return out;
}

describe('variance-finding-adapter-contract', () => {
  const findings = allFindings();

  it('should build change findings with scalar-only facts that parse with FindingSchema and round-trip through varianceMetaOf', () => {
    expect(findings.length).toBeGreaterThan(40);
    for (const f of findings) {
      expect(FindingSchema.safeParse(f).success).toBe(true);
      expect(f.issue_class).toBe('version_drift');
      expect(f.detector_kind).toBe('rule');
      expect(f.detector_id.startsWith(VARIANCE_DETECTOR_PREFIX)).toBe(true);
      expect(f.quote_hash).toBe(quoteHash(f.quote));
      for (const v of Object.values(f.detail.facts)) {
        expect(v === null || ['string', 'number', 'boolean'].includes(typeof v)).toBe(true);
        if (typeof v === 'string') expect(v.length).toBeLessThanOrEqual(1000);
      }
      const m = varianceMetaOf(f)!;
      expect(m).toBeDefined();
      expect(m.owners.join(',')).toBe(f.detail.facts.suggested_owners);
      expect(f.pattern_key).toBe(m.rule_id);
      if (m.kind === 'change') {
        expect(f.severity).toBe('medium');
        expect(f.detector_id).toBe(`variance.${m.rule_id}`);
        expect(JSON.stringify(m.impact!.investor_types)).toBe(f.detail.facts.impact_investor_types);
      } else {
        expect(f.severity).toBe('critical');
        expect(f.detector_id).toBe('variance.regression.scope_exists');
      }
    }
  });

  it('round-trips the assertion candidate and anchors a removed unit at doc start with the old quote', () => {
    const removed = findings.find(
      (f) => f.detail.facts.unit_key_a === 'appendix:c' && f.detail.facts.unit_key_b === null,
    )!;
    expect(removed.detail.facts.assertion_kind).toBe('scope_exists');
    expect(removed.detail.facts.assertion_label).toBe('appendix c');
    const m = varianceMetaOf(removed)!;
    expect(m.assertion_candidate).toEqual({ kind: 'scope_exists', label: 'appendix c' });
    expect(m.quote_side).toBe('old');
    expect(removed.anchor).toMatchObject({ blockId: 'b0', offsetStart: 0, offsetEnd: 0 });
    expect(removed.quote).toContain('APPENDIX C');
    expect(m.old_text).toContain('APPENDIX C');
    expect(m.new_text).toBe('');
  });

  it('clips long lists with a truncation marker that the decoder drops', () => {
    const long = Array.from({ length: 300 }, (_, i) => `item-number-${i}`);
    const enc = encodeList(long);
    expect(enc.length).toBeLessThanOrEqual(1000);
    expect(enc).toContain('__truncated__');
    const f = structuredClone(findings[0]!);
    f.detail.facts.impact_investor_types = enc;
    const m = varianceMetaOf(f)!;
    expect(m.impact!.investor_types.length).toBeGreaterThan(10);
    expect(m.impact!.investor_types).not.toContain('__truncated__');
    expect(long.slice(0, m.impact!.investor_types.length)).toEqual(m.impact!.investor_types);
  });

  it('rejects a nested array or object in facts and throws on malformed variance facts', () => {
    const base = structuredClone(findings[0]!);
    const nested = {
      ...base,
      detail: { ...base.detail, facts: { ...base.detail.facts, impact_x: ['a'] } },
    };
    expect(FindingSchema.safeParse(nested).success).toBe(false);
    const obj = {
      ...base,
      detail: { ...base.detail, facts: { ...base.detail.facts, impact_x: { a: 1 } } },
    };
    expect(FindingSchema.safeParse(obj).success).toBe(false);
    const badOwner = structuredClone(base);
    badOwner.detail.facts.suggested_owners = 'counsel,partner';
    expect(() => varianceMetaOf(badOwner)).toThrow();
    const halfAssertion = structuredClone(base);
    halfAssertion.detail.facts.assertion_kind = 'scope_exists';
    delete halfAssertion.detail.facts.assertion_label;
    expect(() => varianceMetaOf(halfAssertion)).toThrow();
    const notVariance = { ...base, detector_id: 'xref-target-exists' };
    expect(varianceMetaOf(notVariance)).toBeUndefined();
    expect(varianceMetaOf({ ...base, issue_class: 'placeholder' })).toBeUndefined();
  });

  it('keeps every finding id unique per run and stable across runs', () => {
    const a = runVariance(demoPair()).findings.map((f) => f.id);
    expect(new Set(a).size).toBe(a.length);
    expect(runVariance(demoPair()).findings.map((f) => f.id)).toEqual(a);
  });
});
