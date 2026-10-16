import { describe, expect, it } from 'vitest';
import { analyzed, blockText } from '../helpers/samples';
import type { RefInfo } from '../../src/structure/types';
import type { DocGraph } from '../../src/graph/graph';

/** golden-statutory-cite-not-flagged (AC17, Pinned Algorithm S). */
const ctx = (g: DocGraph, r: RefInfo, after = 60) =>
  blockText(g, r.blockIndex).slice(r.start, r.end + after);
const sectionRefs = (g: DocGraph) =>
  g.structure.references.filter(
    (r) => r.form === 'section' || r.form === 'this_section' || r.form === 'part_of_section',
  );

describe('golden-statutory-cite-not-flagged', () => {
  it('should not flag Section 406 of ERISA or bare Section 4975', () => {
    const { g, findings } = analyzed(5);
    const s406 = g.structure.references.filter(
      (r) => r.form === 'section' && r.sectionNumber === '406',
    );
    expect(s406.length).toBeGreaterThanOrEqual(2);
    for (const r of s406) expect(r.ref.kind).toBe('statutory');
    expect(s406.some((r) => ctx(g, r, 20).includes('Section 406 of ERISA'))).toBe(true);
    const s4975 = g.structure.references.filter(
      (r) => r.form === 'section' && r.sectionNumber === '4975',
    );
    for (const r of s4975) expect(r.ref.kind).toBe('statutory');
    const bare = s4975.filter((r) => r.rule === 'bare-repeat');
    expect(bare.length).toBeGreaterThanOrEqual(1);
    expect(
      s4975.some((r) => /^Section 4975 of the U\.S\. Internal Revenue Code/.test(ctx(g, r))),
    ).toBe(true);
    expect(
      findings.some(
        (f) =>
          /Section (406|4975)/.test(f.quote) &&
          f.issue_class === 'broken_cross_reference' &&
          f.detector_id !== 'ref-label-coherence',
      ),
    ).toBe(false);
  });

  it('should not flag Section 3(c)(1) of the 1940 Act', () => {
    const { g } = analyzed(1);
    const s3 = g.structure.references.filter(
      (r) => r.form === 'section' && r.sectionNumber === '3' && ctx(g, r, 0).includes('3(c)(1)'),
    );
    expect(s3.length).toBeGreaterThanOrEqual(2);
    for (const r of s3) expect(r.ref.kind).toBe('statutory');
    expect(s3.some((r) => ctx(g, r).includes('of the 1940 Act'))).toBe(true);
  });

  it('classifies "Rule 506 ... under" style cites as statutory', () => {
    for (const n of [1, 2, 5, 10, 12]) {
      const { g } = analyzed(n);
      for (const r of g.structure.references.filter(
        (x) => x.form === 'rule' || x.form === 'usc_cfr',
      ))
        expect(r.ref.kind).toBe('statutory');
    }
    const { g } = analyzed(1);
    expect(g.structure.references.some((r) => r.form === 'rule')).toBe(true);
  });

  it.each([2, 10, 12])(
    '#%i: every "Section N of the ... Act / of ERISA / of the Code" is statutory',
    (n) => {
      const { g } = analyzed(n);
      const marked = g.structure.references.filter(
        (r) =>
          r.form === 'section' &&
          /^Sections?\s+\d{1,4}[A-Z]?(\([A-Za-z0-9]{1,6}\))*\s+of\s+(the\s+)?([A-Z][A-Za-z.' ]{0,40}\sAct\b|ERISA\b|Code\b)/.test(
            ctx(g, r, 60),
          ),
      );
      expect(marked.length).toBeGreaterThan(0);
      for (const r of marked) expect(r.ref.kind).toBe('statutory');
    },
  );

  it.each([1, 2, 5, 10, 12])(
    '#%i: every Section N match is classified and no broken_cross_reference beyond the goldens',
    (n) => {
      const { g, findings } = analyzed(n);
      for (const r of sectionRefs(g))
        expect(['internal', 'statutory', 'external']).toContain(r.ref.kind);
      const xref = findings.filter((f) => f.issue_class === 'broken_cross_reference');
      const expected = n === 1 ? 2 : n === 5 ? 2 : 0;
      expect(xref).toHaveLength(expected);
      if (n === 1) for (const f of xref) expect(f.quote).toContain('this Section 11');
    },
  );

  it('out-of-range rule: a Section number above the active scope maximum is external, never a finding', () => {
    const { g, findings } = analyzed(1);
    const ext = g.structure.references.filter((r) => r.rule === 'out-of-range');
    expect(ext.length).toBeGreaterThan(0);
    for (const r of ext) expect(r.ref.kind).toBe('external');
    expect(
      findings.every((f) =>
        ext.every((r) => !f.quote.includes(r.ref.text) || f.quote.includes('this Section 11')),
      ),
    ).toBe(true);
  });

  it.each([1, 2, 5, 10, 12])('#%i: reference graph statutory/internal split (snapshot)', (n) => {
    const { g } = analyzed(n);
    const dump = sectionRefs(g).map(
      (r) => `${r.ref.kind}|${r.ref.status}|${r.rule ?? '-'}|${r.ref.text}`,
    );
    const counts: Record<string, number> = {};
    for (const d of dump) {
      const k = d.split('|')[0]!;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    expect({ counts, refs: dump }).toMatchSnapshot();
  });
});
