import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import type { Block } from '../../src/model/types';
import { REFERENCE_SCAN_LIMITS } from '../../src/package/config';
import { escapeRegExp } from '../../src/package/resolve';
import {
  extractExternalReferences,
  extractUsedTerms,
  resolveReferences,
  type PackageDocument,
  type RawReference,
} from '../../src/package/index';

const block = (text: string): Block =>
  ({
    id: 'b0',
    kind: 'paragraph',
    lines: [{ text, cue: { bold: false, caps: false, indent: 0, position: 'unknown' } }],
    section_path: [],
    scopeId: 's',
    anchor: { docHash: 'h', blockId: 'b0', offsetStart: 0, offsetEnd: text.length },
  }) as Block;

const FIVE_MB = 5 * 1024 * 1024;
const ctx = { docId: 'a'.repeat(64), scopeLabels: [] };

describe('package-hostile-bounded (review Major 2)', () => {
  it('5 MB of "PPM " respects the per-block cap and finishes fast', () => {
    const text = 'PPM '.repeat(FIVE_MB / 4);
    const t0 = performance.now();
    const r = extractExternalReferences([block(text)], ctx);
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(r.references.length).toBe(REFERENCE_SCAN_LIMITS.maxPerBlock);
    expect(r.truncated).toBeGreaterThan(0);
  });

  it('many blocks respect the per-document cap', () => {
    const blocks = Array.from({ length: 200 }, () => block('See the PPM and Annex Z. '.repeat(10)));
    const r = extractExternalReferences(blocks, ctx);
    expect(r.references.length).toBe(REFERENCE_SCAN_LIMITS.maxPerDocument);
    expect(r.truncated).toBeGreaterThan(0);
  });

  it('5 MB of capitalized words finishes fast and stays bounded', () => {
    const words = Array.from(
      { length: 900 },
      (_, i) => `the Alpha${String.fromCharCode(97 + (i % 26))}${i} Term `,
    );
    let text = '';
    while (text.length < FIVE_MB) text += words.join('');
    const t0 = performance.now();
    const terms = extractUsedTerms([block(text)], []);
    expect(performance.now() - t0).toBeLessThan(6000);
    expect(terms.length).toBeLessThanOrEqual(200);
  });

  it('lower-case use still demotes a term (same result as the per-term regex)', () => {
    const t =
      'the Capital Call is due. the Capital Call again. the Excused Unit and the Excused Unit.';
    const terms = extractUsedTerms([block(`${t} a capital call was made.`)], []).map((x) => x.term);
    expect(terms).toEqual(['Excused Unit']);
  });

  it('many Annex and Question targets: findings stay correct and fast', () => {
    const paras = [
      ...Array.from({ length: 400 }, (_, i) => `If item ${i} applies, complete Annex Z.`),
      ...Array.from({ length: 400 }, (_, i) => `If item ${i} applies, complete Question 99.`),
      'Annex A. Investor Questionnaire',
      ...Array.from({ length: 20 }, (_, i) => `Question ${i + 1}. State item ${i + 1} here`),
      ...Array.from({ length: 2000 }, (_, i) => `Filler paragraph ${i}.`),
    ];
    const g = analyzeHtml(`<html><body>${paras.map((p) => `<p>${p}</p>`).join('')}</body></html>`);
    const t0 = performance.now();
    const f = runDeterministic(g).filter((x) => x.detector_id === 'broken-conditional');
    expect(performance.now() - t0).toBeLessThan(4000);
    expect(f.some((x) => x.detail.facts.missing === 'Annex Z')).toBe(true);
  });
});

describe('resolve carriesLabel escapes the label (review Minor 8)', () => {
  it('escapeRegExp makes metacharacters literal', () => {
    expect(new RegExp(escapeRegExp('Annex (A)+.')).test('Annex (A)+.')).toBe(true);
    expect(new RegExp(`^${escapeRegExp('A.B')}$`).test('AxB')).toBe(false);
  });

  it('a label with metacharacters does not throw and matches only literally', () => {
    const d = (name: string): PackageDocument => ({
      id: name.charCodeAt(0).toString(16).padStart(64, '0'),
      name,
      type: 'other',
      role: 'reference',
      confidence: 'high',
      reason: 'x',
      confirmed: false,
      suggestionSource: 'rule',
      needsOcr: false,
      format: 'pdf',
      titleLines: [],
    });
    const raw: RawReference = {
      quote: 'See Annex A(1).',
      location: { blockIndex: 0, start: 4, end: 14, sectionPath: [] },
      targetLabel: 'Annex A(1',
      targetKey: 'annex:annex a(1',
      targetFamily: 'annex',
    };
    const out = resolveReferences(
      [raw],
      [d('Annex A(1 terms.pdf'), d('Zannex A1.pdf')],
      [],
      {},
      '0'.repeat(64),
    );
    expect(out[0]!.resolution).toBe('resolved');
  });
});
