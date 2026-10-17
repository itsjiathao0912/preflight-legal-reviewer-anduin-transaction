import { describe, expect, test } from 'vitest';
import { buildStructureView, type StructureView } from '../../../src/structure-view/build';
import {
  buildOutlineDraft,
  maskOutlineName,
  outlineFilename,
  OutlineSchema,
  OUTLINE_DISCLAIMER,
  OUTLINE_SCHEMA_ID,
  type Outline,
  type OutlineDraft,
} from '../../../src/outline/index';
import { analyzed } from '../../helpers/samples';

/** AC63: the outline is a faithful, masked, byte-stable projection of the StructureView. */
const HASH = 'a'.repeat(64);
const SEED = '021000021'; // routing-number-shaped seed; masked form is "#0021"
const SEED2 = 'DDA-123456789';

function viewOf(n: number): StructureView {
  const { g, findings } = analyzed(n);
  return buildStructureView(g, findings);
}

function finalize(d: OutlineDraft, name: string): Outline {
  const r = OutlineSchema.safeParse({
    ...d,
    document: { name: maskOutlineName(name), ...d.document },
  });
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}

function walkStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) walkStrings(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) walkStrings(x, out);
  return out;
}

const long = (s: string) => `${s} ${'lorem ipsum '.repeat(40)} ${SEED2}`;

function syntheticView(): StructureView {
  const kinds = ['whitelist', 'role', 'skip', 'negative', 'jump'] as const;
  const statuses = ['ok', 'early', 'twice', 'none', 'unused', 'case'] as const;
  return {
    version: 1,
    badge: 0,
    counts: { sections: 0, crossrefs: 0, conditions: 0, options: 0, terms: 0, investors: 0 },
    totals: { sections: 2, crossrefs: 3, conditions: 5, options: 1, terms: 6, investors: 2 },
    sectionCount: 2,
    referenceCount: 4,
    sections: [
      {
        id: 's:sc0:1',
        number: '1',
        title: `Title ${SEED}`,
        depth: 0,
        restart: false,
        numbering: '1',
        refsIn: 1,
        refsOut: 2,
        flags: 0,
        blockId: 'b0',
      },
      {
        id: 's:sc0:1-A',
        number: 'A',
        title: 'Part A',
        depth: 1,
        restart: true,
        numbering: 'A',
        refsIn: 0,
        refsOut: 0,
        flags: 0,
        blockId: 'b1',
      },
    ],
    crossrefs: (['resolved', 'suspicious', 'unresolved'] as const).map((status, i) => ({
      id: `r:${i}`,
      text: `see Section ${i} ${SEED}`,
      where: long(`Section 1 ${SEED}`),
      target: `Section ${i}`,
      status,
      quote: `quote ${SEED}`,
      expected: status === 'suspicious' ? `Section 9 (${SEED})` : null,
      findingId: null,
      issue: status !== 'resolved',
      blockId: 'b0',
    })),
    external: [
      {
        id: 'x:9',
        text: `Rule 506 ${SEED}`,
        where: `Section 1 ${SEED}`,
        source: 'Outside this document',
        blockId: 'b0',
      },
    ],
    conditions: kinds.map((kind, i) => ({
      id: `c:${i}`,
      kind,
      text: long(`If you are ${SEED}`),
      where: `Section 1 ${SEED}`,
      condition: long(`condition ${SEED}`),
      target: i === 0 ? 'Section 2, Section 3' : `Section ${i}`,
      targetFound: i % 2 === 0,
      findingId: null,
      issue: false,
      blockId: 'b0',
    })),
    options: [
      {
        id: 'o:0',
        question: 'q',
        where: 'w',
        options: ['a'],
        howMany: 'one',
        cueStated: true,
        cueText: null,
        findingId: null,
        issue: false,
        blockId: 'b0',
      },
    ],
    terms: statuses.map((status, i) => ({
      id: `t:${i}`,
      term: `Term${i}`,
      definedAt: `Section 1 ${SEED}`,
      uses: i,
      status,
      note: long(`note ${SEED}`),
      findingId: null,
      issue: false,
      blockId: null,
    })),
    investors: {
      types: [true, false].map((uncertain, i) => ({
        type: i ? 'llc' : 'partnership',
        label: i ? 'LLC' : 'Partnership',
        sections: [{ number: '1', title: `Title ${SEED}` }],
        skipped: [{ number: '2', title: 'Skip' }],
        questions: [{ section: '1', text: `Question ${SEED}` }],
        reachesCompletion: !uncertain,
        uncertain,
        gaps: [],
      })),
      completion: null,
      preselected: 'partnership',
      sectionTotal: 2,
    },
  };
}

const html = { docHash: HASH, source: 'html' } as const;

describe('logic-outline-export-contents (AC63)', () => {
  test('should export sections branches references terms and investor paths', () => {
    const o = finalize(buildOutlineDraft(viewOf(3), html), 'sample.htm');
    expect(o.schema).toBe(OUTLINE_SCHEMA_ID);
    expect(o.sections.length).toBeGreaterThan(0);
    expect(o.references.length).toBeGreaterThan(0);
    expect(o.definedTerms.length).toBeGreaterThan(0);
    // non-vacuity on #3
    expect(o.branches.length).toBeGreaterThan(0);
    expect(o.investorPaths.length).toBeGreaterThan(0);
    // external references present in at least one sample
    const ext = [1, 3, 5].some((n) =>
      buildOutlineDraft(viewOf(n), html).references.some((r) => r.external),
    );
    expect(ext).toBe(true);
  });

  test.each([1, 3, 5])('should match the structure view counts (sample #%i)', (n) => {
    const v = viewOf(n);
    const o = finalize(buildOutlineDraft(v, html), `s${n}.htm`);
    expect(o.counts.sections).toBe(o.sections.length);
    expect(o.counts.sections).toBe(v.totals.sections);
    expect(o.counts.references).toBe(o.references.length);
    expect(o.counts.references).toBe(v.referenceCount);
    expect(o.counts.branches).toBe(o.branches.length);
    expect(o.counts.branches).toBe(v.totals.conditions);
    expect(o.counts.definedTerms).toBe(o.definedTerms.length);
    expect(o.counts.definedTerms).toBe(v.totals.terms);
    expect(o.counts.investorPaths).toBe(o.investorPaths.length);
    expect(o.counts.investorPaths).toBe(v.investors.types.length);
    v.conditions.forEach((c, i) => expect(o.branches[i]!.targets.join(', ')).toBe(c.target));
    // ids unmasked and in document order
    expect(o.sections.map((s) => s.id)).toEqual(v.sections.map((s) => s.id));
    expect(o.branches.map((b) => b.id)).toEqual(v.conditions.map((c) => c.id));
  });

  test('should include the reference-only disclaimer', () => {
    const o = finalize(buildOutlineDraft(viewOf(1), html), 'a.htm');
    expect(o.disclaimer).toBe(OUTLINE_DISCLAIMER);
    expect(o.disclaimer).toBe('Reference outline only; not a generated form.');
    expect('generatedAt' in o).toBe(false);
    expect(JSON.stringify(o)).not.toMatch(/generatedAt/);
  });

  test('should be byte-stable', () => {
    const run = (v: StructureView) =>
      JSON.stringify(finalize(buildOutlineDraft(v, html), 'x.htm'), null, 2);
    const v = viewOf(5);
    expect(run(v)).toBe(run(v));
    expect(run(viewOf(3))).toBe(run(structuredClone(viewOf(3))));
  });

  test('should not leak seeded sensitive values', () => {
    const d = buildOutlineDraft(syntheticView(), { ...html, notice: `Notice ${SEED}` });
    const o = finalize(d, `Fund ${SEED} sub doc.htm`);
    for (const s of walkStrings(o)) {
      expect(s).not.toContain(SEED);
      expect(s).not.toContain('123456789');
      expect(s.length).toBeLessThanOrEqual(300);
    }
    expect(o.document.name).toContain('#0021');
  });

  test('should cover every enum value in the synthetic structure view', () => {
    const v = syntheticView();
    const o = finalize(buildOutlineDraft(v, { docHash: HASH, source: 'pdf', pageCount: 3 }), 'n');
    expect(new Set(o.branches.map((b) => b.kind))).toEqual(
      new Set(['whitelist', 'role', 'skip', 'negative', 'jump']),
    );
    expect(new Set(o.definedTerms.map((t) => t.status))).toEqual(
      new Set(['ok', 'early', 'twice', 'none', 'unused', 'case']),
    );
    const statuses = o.references.flatMap((r) => ('status' in r ? [r.status] : []));
    expect(new Set(statuses)).toEqual(new Set(['resolved', 'suspicious', 'unresolved']));
    expect(o.references.filter((r) => r.external)).toHaveLength(1);
    expect(o.investorPaths.map((p) => p.uncertain)).toEqual([true, false]);
    expect(o.branches[0]!.targets).toEqual(['Section 2', 'Section 3']);
    expect(o.document).toEqual({ name: 'n', format: 'pdf', contentHash: HASH, pageCount: 3 });
    // ids pass through unchanged; free text masked and clipped
    expect(o.branches.map((b) => b.id)).toEqual(v.conditions.map((c) => c.id));
    expect(o.references.map((r) => r.id)).toEqual(['r:0', 'r:1', 'r:2', 'x:9']);
    for (const b of o.branches) {
      expect(b.where).toContain('#0021');
      expect(b.condition.length).toBeLessThanOrEqual(300);
      expect(b.citation.length).toBeLessThanOrEqual(300);
    }
    for (const t of o.definedTerms) expect(t.note!.length).toBeLessThanOrEqual(300);
    // dropped fields never appear
    const json = JSON.stringify(o);
    for (const k of ['quote', 'blockId', 'findingId', 'issue', 'options', 'entity_extra_part'])
      expect(json).not.toContain(`"${k}"`);
  });

  test('should compose a masked clipped confidence note for low-confidence input', () => {
    const notice = `Some pages could not be read ${SEED} ${'x'.repeat(400)}`;
    const d = buildOutlineDraft(syntheticView(), {
      docHash: HASH,
      source: 'ocr',
      pageCount: 4,
      ocrLowConfidencePages: [2, 4],
      notice,
    });
    expect(d.confidenceNote).toBeDefined();
    expect(d.confidenceNote).toContain('pages 2, 4');
    expect(d.confidenceNote).not.toContain(SEED);
    expect(d.confidenceNote).toContain('#0021');
    expect(d.confidenceNote!.length).toBeLessThanOrEqual(300);
    const ok = OutlineSchema.safeParse({ ...d, document: { name: 'n', ...d.document } });
    expect(ok.success).toBe(true);
  });

  test('should omit the confidence note key for clean input', () => {
    const d = buildOutlineDraft(syntheticView(), html);
    expect('confidenceNote' in d).toBe(false);
    expect('pageCount' in d.document).toBe(false);
  });

  test('outlineFilename sanitizes, masks and caps the base name', () => {
    expect(outlineFilename('Fund Sub Doc.htm')).toBe('Fund-Sub-Doc.logic-outline.json');
    expect(outlineFilename(`acct ${SEED}.pdf`)).toBe('acct-0021.logic-outline.json');
    expect(outlineFilename('../../etc/passwd')).toBe('etc-passwd.logic-outline.json');
    expect(outlineFilename('')).toBe('document.logic-outline.json');
    expect(outlineFilename('***.docx')).toBe('document.logic-outline.json');
    expect(outlineFilename('a  //  b')).toBe('a-b.logic-outline.json');
    const base = outlineFilename('x'.repeat(200)).replace('.logic-outline.json', '');
    expect(base.length).toBeLessThanOrEqual(80);
    expect(outlineFilename('report.final.v2.html')).toBe('report.final.v2.logic-outline.json');
    expect(maskOutlineName('')).toBe('document');
    expect(maskOutlineName('n'.repeat(300)).length).toBe(120);
  });
});
