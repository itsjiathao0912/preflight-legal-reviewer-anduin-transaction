import { describe, expect, it } from 'vitest';
import { headerKey, isPageNumberLine, stripPageNoise } from '../../src/adapters/page-noise';
import type { Line, Region } from '../../src/model/types';

const line = (text: string, page: number, region?: Region): Line => ({
  text,
  cue: { bold: false, caps: false, indent: 0, position: 'left', page, region },
  page,
  region,
});
const TOP: Region = { x: 0.1, y: 0.03, w: 0.5, h: 0.02 };
const MID: Region = { x: 0.1, y: 0.5, w: 0.5, h: 0.02 };
const BOTTOM: Region = { x: 0.45, y: 0.94, w: 0.1, h: 0.02 };

describe('page-noise', () => {
  it('recognizes page-number shapes, including the scan footer "1/8"', () => {
    for (const t of ['1/8', ' 1 / 8 ', 'Page 2 of 9', '2 of 9', 'PAGE 3', '- 3 -', '-3', '12']) {
      expect(isPageNumberLine(t), t).toBe(true);
    }
    for (const t of [
      '1. Investment',
      'Section 2 of the Agreement',
      'USD 250,000',
      '2020-2021',
      '',
    ]) {
      expect(isPageNumberLine(t), t).toBe(false);
    }
  });

  it('digit-normalizes header keys', () => {
    expect(headerKey('Fund  LP — Page 2')).toBe(headerKey('fund lp — page 13'));
  });

  it('drops band page numbers and headers repeated on >= 3 pages and >= 50% of pages', () => {
    const pages = [1, 2, 3, 4].map((p) => [
      line(`ACME FUND LP - Subscription Booklet ${p}`, p, TOP),
      line(`Body text of page ${p}.`, p, MID),
      line(`${p}/4`, p, BOTTOM),
    ]);
    const r = stripPageNoise(pages);
    expect(r.pages.map((ls) => ls.map((l) => l.text))).toEqual([
      ['Body text of page 1.'],
      ['Body text of page 2.'],
      ['Body text of page 3.'],
      ['Body text of page 4.'],
    ]);
    expect(r.dropped[0]!.map((d) => [d.line.text, d.rule])).toEqual([
      ['ACME FUND LP - Subscription Booklet 1', 'repeated-header-footer'],
      ['1/4', 'page-number'],
    ]);
  });

  it('keeps a header seen on only 2 pages, and a number in the middle of a page', () => {
    const pages = [1, 2, 3, 4].map((p) => [
      line(p <= 2 ? 'Draft header' : `Unique ${'x'.repeat(p)}`, p, TOP),
      line('7', p, MID),
    ]);
    const r = stripPageNoise(pages);
    expect(r.pages[0]!.map((l) => l.text)).toEqual(['Draft header', '7']);
    expect(r.dropped.flat()).toEqual([]);
  });

  it('needs >= 50% of pages when the document is long', () => {
    const pages = Array.from({ length: 10 }, (_, i) => [
      line(i < 4 ? 'Confidential' : `Other ${'y'.repeat(i)}`, i + 1, TOP),
      line('Body', i + 1, MID),
    ]);
    // 4 of 10 pages: below the 50% share, kept.
    expect(stripPageNoise(pages).dropped.flat()).toEqual([]);
  });

  it('falls back to the first/last lines as the band when lines have no region', () => {
    const pages = [1, 2, 3].map((p) => [
      line('Running Head', p),
      line(`a${'x'.repeat(p)}`, p),
      line(`b${'x'.repeat(p)}`, p),
      line(`c${'x'.repeat(p)}`, p),
      line(`d${'x'.repeat(p)}`, p),
      line(`Page ${p} of 3`, p),
    ]);
    const r = stripPageNoise(pages);
    expect(r.pages[0]!.map((l) => l.text)).toEqual(['ax', 'bx', 'cx', 'dx']);
  });

  it('counts empty (scan) pages toward the page total', () => {
    const pages: Line[][] = [
      [line('Head', 1, TOP)],
      [line('Head', 2, TOP)],
      [line('Head', 3, TOP)],
      [],
      [],
      [],
      [],
      [],
    ];
    // 3 of 8 pages < 50%: kept.
    expect(stripPageNoise(pages).pages[0]!.map((l) => l.text)).toEqual(['Head']);
  });
});
