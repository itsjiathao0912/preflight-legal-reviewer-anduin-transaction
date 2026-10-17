import { describe, expect, it } from 'vitest';
import { ocrToLines } from '../../src/adapters/ocr';
import { buildDocGraph, runDeterministic } from '../../src/index';
import { isLowConfidence, pageConfidence } from '../../src/ocr/confidence';

/**
 * AC24 core side: with no OCR text (quota / budget / no key / every page failed) the core adapter
 * yields no lines and nothing throws, so the web worker can show page images with a "text not
 * extracted" notice. A partial set keeps the pages that were read, in page order.
 */
describe('ocr-unavailable (core)', () => {
  it('should show text not extracted when OCR is unavailable', () => {
    const r = ocrToLines([]);
    expect(r.lines).toEqual([]);
    expect(r.pages).toEqual([]);
  });

  it('treats a page that came back empty as no text and low confidence', () => {
    const r = ocrToLines([{ index: 0, lines: [] }]);
    expect(r.lines).toHaveLength(0);
    expect(pageConfidence([])).toBe(0);
    expect(isLowConfidence(pageConfidence([]))).toBe(true);
  });

  it('keeps the pages that were read when others are missing (partial OCR)', () => {
    const r = ocrToLines([
      { index: 2, lines: [{ text: '2. Account Type' }] },
      { index: 0, lines: [{ text: '1. Investment' }] },
    ]);
    expect(r.lines.map((l) => l.page)).toEqual([1, 3]);
    const g = buildDocGraph('a'.repeat(64), r.lines, { bytes: 0, adapter_ms: 0 }, 'ocr');
    expect(() => runDeterministic(g)).not.toThrow();
  });
});
