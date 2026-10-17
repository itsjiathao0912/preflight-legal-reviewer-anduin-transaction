import { describe, expect, it } from 'vitest';
import { htmlToLines } from '../../src/adapters/html';
import type { Line } from '../../src/model/types';
import {
  buildPackageFacts,
  detectDocument,
  extractUsedTerms,
  type PackageFacts,
} from '../../src/package/index';
import { structure } from '../../src/structure/structurer';

const docOfFacts = (f: PackageFacts) =>
  detectDocument({
    name: f.name,
    titleLines: f.titleLines,
    headText: f.headText,
    headings: f.headings,
  });

const H = 'f'.repeat(64);
const lines = (html: string) => htmlToLines(html).lines;

describe('package-facts (G19)', () => {
  it('caps titleLines at 12 x 200, headText at 1500, headings at 200 x 120', () => {
    const paras = [
      `<p>${'T'.repeat(300)}</p>`,
      ...Array.from(
        { length: 260 },
        (_, i) => `<p><b>${i + 1}. HEADING ${'X'.repeat(150)}</b></p>`,
      ),
    ];
    const f = buildPackageFacts({
      contentHash: H,
      name: 'a.html',
      format: 'html',
      bytes: 1,
      lines: lines(`<html><body>${paras.join('')}</body></html>`),
    });
    expect(f.titleLines).toHaveLength(12);
    expect(f.titleLines[0]).toHaveLength(200);
    expect(f.headText.length).toBeLessThanOrEqual(1500);
    expect(f.headings.length).toBeLessThanOrEqual(200);
    expect(f.headings.every((h) => h.length <= 120)).toBe(true);
  });

  it('empty lines give needsOcr: true and empty facts', () => {
    const f = buildPackageFacts({
      contentHash: H,
      name: 'scan.docx',
      format: 'docx',
      bytes: 9,
      lines: [],
    });
    expect(f).toMatchObject({
      needsOcr: true,
      titleLines: [],
      headText: '',
      headings: [],
      definitions: [],
    });
  });

  it('a structurer exception gives empty titles and type other', () => {
    const bad = [
      {
        text: 'SUBSCRIPTION AGREEMENT',
        get cue(): never {
          throw new Error('boom');
        },
      },
    ] as unknown as Line[];
    const f = buildPackageFacts({
      contentHash: H,
      name: 'weird.bin',
      format: 'html',
      bytes: 1,
      lines: bad,
    });
    expect(f.titleLines).toEqual([]);
    expect(docOfFacts(f)).toMatchObject({ type: 'other', confidence: 'low' });
  });

  it('extracts definitions with a verbatim quote', () => {
    const f = buildPackageFacts({
      contentHash: H,
      name: 'lpa.html',
      format: 'html',
      bytes: 1,
      lines: lines(
        '<p>“Units” means the interests.</p><p>Capital Commitment means the promised amount.</p>',
      ),
    });
    expect(f.definitions.map((d) => d.term)).toEqual(['Units', 'Capital Commitment']);
    expect(f.definitions[0]!.quote).toBe('“Units” means the interests.');
  });

  it('extractUsedTerms: used twice, local terms excluded, stoplist applied', () => {
    const html =
      '<p>Pay the Capital Commitment on time and the Capital Commitment again.</p>' +
      '<p>See the Section and the Section. Use the Units and the Units (the "Units").</p>' +
      '<p>Only once for the Lonely Term here.</p>' +
      '<p>We sign the capital call and the Capital Call and the Capital Call.</p>';
    const s = structure(H, lines(html));
    const t = extractUsedTerms(
      s.blocks,
      s.definedTerms.map((d) => d.term),
    ).map((u) => u.term);
    expect(t).toEqual(['Capital Commitment']);
  });
});
