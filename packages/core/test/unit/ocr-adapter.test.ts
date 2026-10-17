import { describe, expect, it } from 'vitest';
import {
  normalizeRegion,
  OCR_MAX_LINES_PER_PAGE,
  ocrToLines,
  stripMarkers,
} from '../../src/adapters/ocr';
import { supSegmentsOf } from '../../src/adapters/sup-segments';
import { OcrResultSchema, type OcrResult } from '../../src/contracts/ocr';
import { limits } from '../../src/config/limits';
import {
  isLowConfidence,
  longestRepeatRun,
  pageConfidence,
  structuralScore,
} from '../../src/ocr/confidence';

const page = (index: number, lines: OcrResult['pages'][number]['lines']): OcrResult =>
  OcrResultSchema.parse({ v: 1, pages: [{ index, lines }] });

describe('ocr adapter (06d)', () => {
  it('strips ^{n} markers (with a leading space) into zero-width sup segments', () => {
    const r = stripMarkers('☐ Trust ^{2} ☐ Corporation ^{2} ☐ Partnership/LLC');
    expect(r.text).toBe('☐ Trust ☐ Corporation ☐ Partnership/LLC');
    expect(r.sups).toEqual([
      { start: 7, end: 7, text: '2' },
      { start: 21, end: 21, text: '2' },
    ]);
    expect(r.text.slice(0, r.sups[0]!.start)).toBe('☐ Trust');
  });

  it('keeps unbounded or malformed markers as text (no injection of 4+ digit markers)', () => {
    expect(stripMarkers('Label^{1234}').text).toBe('Label^{1234}');
    expect(stripMarkers('Label ^{x}').text).toBe('Label ^{x}');
  });

  it('emits one Line per OCR line with page, normalized region and cue_source ocr', () => {
    const r = ocrToLines(
      page(2, [
        { text: '☒ Individual ^{1}', bbox: { x: 0.1, y: 0.2, w: 0.5, h: 0.03 }, conf: 0.9 },
        { text: 'Second row', bbox: { x: -0.2, y: 0.5, w: 2, h: 0.05 } },
      ]),
    );
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatchObject({
      text: '☒ Individual',
      page: 3,
      region: { x: 0.1, y: 0.2, w: 0.5, h: 0.03 },
      cue: { cue_source: 'ocr' },
    });
    expect(supSegmentsOf(r.lines[0])).toEqual([{ start: 12, end: 12, text: '1' }]);
    expect(r.lines[1]!.region).toEqual({ x: 0, y: 0.5, w: 1, h: 0.05 });
  });

  it('drops the "1/8" scan footer as page noise and keeps it in the dropped list', () => {
    const r = ocrToLines(
      page(0, [
        { text: 'Account Type', bbox: { x: 0.05, y: 0.3, w: 0.9, h: 0.02 } },
        { text: '1/8', bbox: { x: 0.45, y: 0.96, w: 0.1, h: 0.02 } },
      ]),
    );
    expect(r.lines.map((l) => l.text)).toEqual(['Account Type']);
    expect(r.pages[0]!.dropped.map((d) => [d.line.text, d.rule])).toEqual([['1/8', 'page-number']]);
  });

  it('orders pages by index, skips empty lines and caps lines per page', () => {
    const many = Array.from({ length: OCR_MAX_LINES_PER_PAGE + 50 }, (_, i) => ({
      text: `Row ${i} of the form`,
    }));
    const r = ocrToLines([
      { index: 1, lines: [{ text: 'page two' }] },
      { index: 0, lines: [{ text: '   ' }, ...many] },
    ]);
    expect(r.pages.map((p) => p.index)).toEqual([0, 1]);
    expect(r.pages[0]!.truncated).toBe(true);
    expect(r.pages[0]!.lines.length).toBeLessThanOrEqual(OCR_MAX_LINES_PER_PAGE);
    expect(r.lines.at(-1)!.text).toBe('page two');
  });

  it('clamps a bbox into the unit square', () => {
    expect(normalizeRegion({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 })).toEqual({
      x: 0.9,
      y: 0.9,
      w: 0.09999999999999998,
      h: 0.09999999999999998,
    });
  });
});

describe('ocr confidence (06d)', () => {
  it('uses the 0.6 threshold from limits', () => {
    expect(limits.ocrLowConfidence).toBe(0.6);
    expect(isLowConfidence(0.59)).toBe(true);
    expect(isLowConfidence(0.6)).toBe(false);
  });

  it('page confidence = min(self-reported ?? 0.7, structural)', () => {
    const good = [{ text: 'Subscriber Name and Address' }, { text: 'Account Type' }];
    expect(structuralScore(good)).toBe(1);
    expect(pageConfidence(good)).toBe(0.7);
    expect(pageConfidence(good.map((l) => ({ ...l, conf: 0.95 })))).toBe(0.95);
    expect(pageConfidence(good.map((l) => ({ ...l, conf: 0.4 })))).toBeCloseTo(0.4);
  });

  it('should mark a page below 0.6 confidence as low confidence', () => {
    const loop = [{ text: Array.from({ length: 40 }, () => 'the').join(' '), conf: 0.95 }];
    expect(longestRepeatRun(loop[0]!.text.split(' '))).toBe(40);
    expect(isLowConfidence(pageConfidence(loop))).toBe(true);
    const digits = [{ text: '12 34 56 78 90 11 22 %% ## $$', conf: 0.95 }];
    expect(isLowConfidence(pageConfidence(digits))).toBe(true);
    expect(pageConfidence([])).toBe(0);
    const r = ocrToLines(page(0, loop));
    expect(r.pages[0]!.lowConfidence).toBe(true);
  });
});
