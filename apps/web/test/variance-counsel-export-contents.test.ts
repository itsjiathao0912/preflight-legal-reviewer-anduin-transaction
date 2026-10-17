// @vitest-environment node
import mammoth from 'mammoth';
import { describe, expect, it } from 'vitest';
import type { FindingView } from '../src/engine/types';
import { buildSheet } from '../src/features/counsel/sheet-model';
import { buildCounselDocx, docxFilename } from '../src/features/counsel/exportDocx';
import { buildRows } from '../src/features/review/model';
import { mergeFindings } from '../src/features/variance/select';

// Variance Phase 04 (AC-V13): one DOCX per owner containing only that owner's unanswered questions,
// each with the quote, old vs new text (in the deterministic options) and the A/B/C options.
async function text(blob: Blob): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(await blob.arrayBuffer()) });
  return value;
}
function fv(id: string, extra: Partial<FindingView> = {}) {
  return {
    id,
    severity: 'critical',
    issue_class: 'broken_cross_reference',
    detector_kind: 'rule',
    detector_id: 'XREF',
    anchor: { docHash: 'd', blockId: 'b0', offsetStart: 0, offsetEnd: 3 },
    section_path: [],
    quote: `Quote of ${id}.`,
    quote_snippet: 'q',
    detail: { explanation: 'x.', facts: {}, interpretations: [] },
    title: id,
    loc: `Section ${id}`,
    order: 0,
    ...extra,
  } as unknown as FindingView;
}
const change = (id: string, oldT: string, newT: string) =>
  fv(id, {
    severity: 'medium',
    kind: 'change',
    issue_class: 'version_drift',
    detector_id: 'variance.x',
    quote: newT,
    detail: {
      explanation: 'x.',
      facts: {},
      interpretations: [
        `The change is intended; digitize the new text: "${newT}".`,
        `The change is a mistake; keep the baseline text: "${oldT}".`,
        'The text needs changes; please provide the intended wording.',
      ],
    },
  });

const ROWS = buildRows(
  mergeFindings(
    [fv('e1')],
    [
      change('sing', 'Domicile: US, UK.', 'Domicile: US, UK, Singapore.'),
      change('min', 'Minimum US$ 250,000.', 'Minimum US$ 500,000.'),
      change('src', 'No source of funds check.', 'Source of Funds Verification.'),
    ],
  ),
  null,
  {
    e1: { status: 'counsel' },
    sing: { status: 'counsel', ownerAnswers: { gp: null, counsel: null } },
    min: { status: 'counsel', ownerAnswers: { gp: null } },
    src: { status: 'counsel', ownerAnswers: { fund_admin: 'A' } }, // answered: off every export
  },
);
const META = {
  title: 'Questions for GP · Fund III',
  firm: 'Hartwell & Crane LLP',
  fund: 'Fund III',
  version: null,
};
const wording = (k: string) => `Question for ${k}`;

describe('variance-counsel-export-contents', () => {
  it("should export one DOCX per owner containing only that owner's unanswered questions", async () => {
    const gp = buildSheet(META, ROWS, 'gp');
    const t = await text(await buildCounselDocx(gp, wording));
    expect(docxFilename(gp.meta)).toBe('gp-questions-fund-iii.docx');
    expect(t).toContain('2 questions for GP');
    expect(t).toContain('Question for sing@gp');
    expect(t).toContain('Question for min@gp');
    // quote + old vs new text + options
    expect(t).toContain('Domicile: US, UK, Singapore.');
    expect(t).toContain('keep the baseline text: "Minimum US$ 250,000."');
    expect(t).toMatch(/A\. The change is intended/);
    expect(t).toMatch(/C\. The text needs changes/);
    // no other owner's items
    expect(t).not.toContain('sing@counsel');
    expect(t).not.toContain('Quote of e1');
    expect(t).not.toContain('Source of Funds');
  });

  it('a two-owner finding appears once in each owner export; an owner with nothing open exports nothing', async () => {
    const counsel = buildSheet(
      { ...META, title: 'Questions for Counsel · Fund III' },
      ROWS,
      'counsel',
    );
    expect(counsel.questions.map((q) => q.findingKey)).toEqual(['e1', 'sing@counsel']);
    const t = await text(await buildCounselDocx(counsel, wording));
    expect(t).toContain('2 questions for Counsel');
    expect(t).not.toContain('min@gp');
    expect(buildSheet(META, ROWS, 'fund_admin').questions).toEqual([]);
    expect(docxFilename({ ...META, owner: 'fund_admin' })).toBe(
      'fund-admin-questions-fund-iii.docx',
    );
  });

  it('the full sheet without an owner keeps the legacy filename', () => {
    const all = buildSheet({ ...META, title: 'Counsel query sheet · Fund III' }, ROWS);
    expect(docxFilename(all.meta)).toBe('counsel-questions-fund-iii.docx');
    expect(all.questions.map((q) => q.findingKey)).toEqual([
      'e1',
      'sing@counsel',
      'sing@gp',
      'min@gp',
    ]);
  });
});
