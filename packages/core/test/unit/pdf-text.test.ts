import { describe, expect, it } from 'vitest';
import { MIN_TEXT_CHARS, pdfPagesToLines, type PdfTextItem } from '../../src/adapters/pdf-text';
import { supSegmentsOf } from '../../src/adapters/sup-segments';
import { limits } from '../../src/config/limits';

const it_ = (str: string, x: number, y: number, h = 10, bold = false): PdfTextItem => ({
  str,
  x,
  y,
  w: str.length * h * 0.5,
  h,
  bold,
});
const page = (items: PdfTextItem[], index = 0) => ({ index, width: 600, height: 800, items });

describe('pdf-text (pure y-clustering)', () => {
  it('clusters by baseline, orders by x, inserts spaces at gaps and keeps a row as one line', () => {
    const r = pdfPagesToLines([
      page([
        it_('Corporation', 400, 200),
        it_('Trust', 250, 201),
        it_('Individual', 100, 199.5),
        it_('1. Investment', 100, 100, 12, true),
        it_('Hello', 100, 300),
        it_('world', 126, 300), // tiny gap (1 unit < 0.2 em): no space
      ]),
    ]);
    expect(r.lines.map((l) => l.text)).toEqual([
      '1. Investment',
      'Individual Trust Corporation',
      'Helloworld',
    ]);
    expect(r.lines[0]!.cue.bold).toBe(true);
    expect(r.lines[1]!.cue.bold).toBe(false);
    expect(r.lines.every((l) => l.page === 1 && l.cue.page === 1)).toBe(true);
  });

  it('normalizes regions to 0..1 with a top-left origin', () => {
    const r = pdfPagesToLines([page([it_('A heading of the page here', 60, 100, 20)])]);
    const reg = r.lines[0]!.region!;
    expect(reg.x).toBeCloseTo(0.1, 4);
    expect(reg.y).toBeCloseTo(80 / 800, 4);
    expect(reg.h).toBeCloseTo(25 / 800, 3);
    expect(reg.w).toBeCloseTo((26 * 10) / 600, 4);
    expect(r.lines[0]!.cue.region).toEqual(reg);
  });

  it('measures indent from the leftmost text edge and detects centered lines', () => {
    const r = pdfPagesToLines([
      page([
        it_('Left margin line of text', 72, 100),
        it_('Indented', 108, 120),
        it_('TITLE', 287.5, 60),
      ]),
    ]);
    const by = Object.fromEntries(r.lines.map((l) => [l.text, l.cue]));
    expect(by['Left margin line of text']!.indent).toBe(0);
    expect(by['Indented']!.indent).toBe(36);
    expect(by['TITLE']!.position).toBe('center');
    expect(by['TITLE']!.caps).toBe(true);
  });

  it('records a raised small digit as a superscript segment', () => {
    const r = pdfPagesToLines([
      page([
        it_('Trust', 100, 200),
        it_('2', 126, 196, 6),
        it_('Corporation', 160, 200),
        it_('Account type options', 100, 100),
      ]),
    ]);
    const l = r.lines[1]!;
    // A tight superscript joins its label, as `Trust<sup>2</sup>` does in the HTML adapter.
    expect(l.text).toBe('Trust2 Corporation');
    expect(supSegmentsOf(l)).toEqual([{ start: 5, end: 6, text: '2' }]);
    // Same size and baseline: an ordinary digit, not a superscript.
    const plain = pdfPagesToLines([
      page([it_('Trust', 100, 200), it_('2', 126, 200), it_('Account type options', 100, 100)]),
    ]);
    expect(supSegmentsOf(plain.lines[1]!)).toEqual([]);
  });

  it('routes pages under MIN_TEXT_CHARS non-space characters to OCR', () => {
    const tiny = 'x'.repeat(MIN_TEXT_CHARS - 1);
    const r = pdfPagesToLines([
      page([it_('A full text page with enough characters', 72, 100)], 0),
      page([it_(tiny, 72, 100)], 1),
      page([], 2),
    ]);
    expect(r.scanPages).toEqual([1, 2]);
    expect(r.pages.map((p) => p.scan)).toEqual([false, true, true]);
    expect(r.lines).toHaveLength(1);
  });

  it('splits over-long rows at whitespace (never rejects)', () => {
    const words = Array.from({ length: 1200 }, (_, i) => `w${i}`).join(' ');
    const r = pdfPagesToLines([page([{ str: words, x: 0, y: 100, w: 500, h: 10 }])]);
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.lines.every((l) => l.text.length <= limits.maxLineChars)).toBe(true);
    expect(r.lines.map((l) => l.text).join(' ')).toBe(words);
  });

  it('ignores whitespace-only and non-finite items', () => {
    const r = pdfPagesToLines([
      page([
        it_('Real text on this page, long enough', 72, 100),
        { str: '   ', x: 0, y: 50, w: 5, h: 0 },
        { str: 'bad', x: Number.NaN, y: 10, w: 1, h: 1 },
      ]),
    ]);
    expect(r.lines.map((l) => l.text)).toEqual(['Real text on this page, long enough']);
  });
});
