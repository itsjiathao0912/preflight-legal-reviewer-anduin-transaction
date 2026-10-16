import { readFileSync, readdirSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import { FindingSchema, type Finding } from '../../src/findings/schema';
import { ISSUE_CLASSES } from '../../src/findings/taxonomy';
import { quoteHash } from '../../src/memory/fingerprint';
import { mask, sensitiveSpans } from '../../src/memory/mask';
import { analyzed, htmlSamples } from '../helpers/samples';

function allFindings(): Array<{ src: string; f: Finding; text: string }> {
  const out: Array<{ src: string; f: Finding; text: string }> = [];
  for (const file of htmlSamples()) {
    const { g, findings } = analyzed(file);
    for (const f of findings) {
      const b = g.structure.blocks.find((x) => x.id === f.anchor.blockId)!;
      out.push({ src: file, f, text: b.lines.map((l) => l.text).join(' ') });
    }
  }
  const dir = new URL('../fixtures/', import.meta.url);
  for (const file of readdirSync(dir).filter((x) => x.endsWith('.html'))) {
    const g = analyzeHtml(readFileSync(new URL(file, dir), 'utf8'));
    for (const f of runDeterministic(g)) {
      const b = g.structure.blocks.find((x) => x.id === f.anchor.blockId)!;
      out.push({ src: file, f, text: b.lines.map((l) => l.text).join(' ') });
    }
  }
  return out;
}

describe('finding-schema-contract (AC7)', () => {
  const all = allFindings();

  it('there are findings to check (goldens at least)', () => {
    expect(all.length).toBeGreaterThanOrEqual(7);
  });

  it('every finding is complete: class, severity, quote + location, provenance, confidence, interpretations', () => {
    for (const { src, f, text } of all) {
      expect(FindingSchema.safeParse(f).success, `${src} ${f.id}`).toBe(true);
      expect(ISSUE_CLASSES).toContain(f.issue_class);
      expect(f.detector_kind).toBe('rule');
      expect(f.provenance).toBeUndefined();
      expect(f.confidence).toBeGreaterThan(0);
      expect(f.confidence).toBeLessThanOrEqual(1);
      // quote is the document's own sentence at the anchor, masked (A8/E12): identical to the raw
      // slice when no account-like digit run is present
      const slice = text.slice(f.anchor.offsetStart, f.anchor.offsetEnd);
      expect(mask(slice, sensitiveSpans(slice))).toBe(f.quote);
      expect(f.quote.length).toBeLessThanOrEqual(1000);
      expect(f.quote_hash).toBe(quoteHash(f.quote));
      expect(f.fingerprint).toBeUndefined();
      expect(Array.isArray(f.detail.interpretations)).toBe(true);
      if (f.issue_class === 'defined_term_issue')
        expect(f.detail.interpretations.length).toBeGreaterThanOrEqual(2);
      expect(f.section_path).toBeInstanceOf(Array);
    }
  });

  it('schema refinements: AI findings need a model and cannot exceed high; sensitive_data caps at medium', () => {
    // base must not itself be sensitive_data (capped at medium), or the AI-severity property is moot
    const base = all.find((x) => x.f.issue_class !== 'sensitive_data')!.f;
    fc.assert(
      fc.property(
        fc.constantFrom('critical', 'high', 'medium', 'low'),
        fc.boolean(),
        (severity, withModel) => {
          const ai = {
            ...base,
            detector_kind: 'ai',
            severity,
            ...(withModel ? { model: 'm:free', provenance: 'fresh' } : {}),
          };
          const ok = FindingSchema.safeParse(ai).success;
          expect(ok).toBe(withModel && severity !== 'critical');
          const sens = { ...base, issue_class: 'sensitive_data', severity };
          expect(FindingSchema.safeParse(sens).success).toBe(
            severity === 'medium' || severity === 'low',
          );
        },
      ),
    );
  });

  it('quotes over 1000 chars are rejected, never truncated', () => {
    const base = all[0]!.f;
    expect(FindingSchema.safeParse({ ...base, quote: 'x'.repeat(1001) }).success).toBe(false);
    expect(() => quoteHash('x'.repeat(1001))).toThrow(/1000/);
  });
});
