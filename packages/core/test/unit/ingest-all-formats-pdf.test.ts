import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectFormat } from '../../src/adapters/format-detect';
import { PDF_MESSAGES, pdfToLines } from '../../src/adapters/pdf';
import { supSegmentsOf } from '../../src/adapters/sup-segments';
import { htmlToLines } from '../../src/adapters/html';
import { limits } from '../../src/config/limits';
import { buildDocGraph, runDeterministic } from '../../src/engine';
import { CoreError } from '../../src/model/errors';

/**
 * ingest-all-formats (PDF half, Phase 06 06c): every PDF fixture from
 * scripts/src/fixtures/make-pdf.ts opens or fails with a clear CoreError, never a crash.
 * The DOCX half lives in ingest-all-formats-docx.test.ts; the browser render/OCR paths are the
 * web e2e `ingest-all-formats` spec (06d/06e).
 */
const ROOT = join(__dirname, '../../../..');
const PDF = (f: string) => new Uint8Array(readFileSync(join(ROOT, 'fixtures/pdf', f)));
const IMG = new Uint8Array(readFileSync(join(ROOT, 'fixtures/pdf/src/appa1-pg1-crop.jpg')));

async function rejection(p: Promise<unknown>): Promise<CoreError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(CoreError);
  return err as CoreError;
}

describe('ingest-all-formats (pdf)', () => {
  it('should open an html text pdf docx scanned pdf and image fixture', async () => {
    // HTML still goes through the Phase 01 adapter.
    const html = new TextEncoder().encode('<p><b>1. Investment</b></p><p>Hello world.</p>');
    expect(detectFormat('a.html', html).format).toBe('html');
    expect(htmlToLines(html).lines.length).toBe(2);

    // Text PDF.
    expect(detectFormat('text.pdf', PDF('text.pdf')).format).toBe('pdf');
    const text = await pdfToLines(PDF('text.pdf'));
    expect(text.pageCount).toBe(3);
    expect(text.scanPages).toEqual([]);
    const texts = text.lines.map((l) => l.text);
    expect(texts).toContain('1. Investment');
    expect(texts).toContain('Name of Investor Subscription Amount');
    expect(texts).toContain('Jane Example USD 250,000');
    expect(texts).toContain('[ ] Individual [ ] Trust [ ] Corporation');
    // Running header and "Page n of 3" footers are page noise, kept in the raw list.
    expect(texts.some((t) => /ACME FUND LP/.test(t) || /^Page \d of 3$/.test(t))).toBe(false);
    for (const p of text.pages) {
      expect(p.dropped.map((d) => d.rule).sort()).toEqual([
        'page-number',
        'repeated-header-footer',
      ]);
    }
    // Page, region and cues.
    const heading = text.lines.find((l) => l.text === '1. Investment')!;
    expect(heading.page).toBe(1);
    expect(heading.cue.bold).toBe(true);
    expect(heading.cue.indent).toBe(0);
    expect(heading.region!.x).toBeCloseTo(72 / 612, 3);
    expect(heading.region!.y).toBeGreaterThan(0);
    expect(heading.region!.y).toBeLessThan(0.15);
    expect(text.lines.find((l) => l.text.startsWith('The undersigned'))!.cue.bold).toBe(false);
    expect(text.lines.find((l) => l.text.startsWith('4. Trust'))!.page).toBe(3);
    // Same engine pipeline as HTML.
    const g = buildDocGraph(text.docHash, text.lines, { bytes: text.bytes }, 'pdf');
    expect(g.doc.source).toBe('pdf');
    expect(g.doc.blocks.length).toBeGreaterThan(5);
    expect(() => runDeterministic(g)).not.toThrow();

    // Scanned PDF: no text layer -> page 0 goes to OCR, no lines.
    const scanned = await pdfToLines(PDF('scanned.pdf'));
    expect(scanned.scanPages).toEqual([0]);
    expect(scanned.lines).toEqual([]);

    // Mixed: page 1 text, page 2 image only.
    const mixed = await pdfToLines(PDF('mixed.pdf'));
    expect(mixed.scanPages).toEqual([1]);
    expect(mixed.lines.every((l) => l.page === 1)).toBe(true);
    expect(mixed.lines.length).toBeGreaterThan(3);

    // Image upload: detected as an OCR image, never parsed as a PDF.
    expect(detectFormat('page.jpg', IMG)).toEqual({
      format: 'jpeg',
      extension: '.jpg',
      image: true,
    });
  });

  it('should reject a corrupt file with a clear message', async () => {
    const corrupt = await rejection(pdfToLines(PDF('corrupt.pdf')));
    expect(corrupt.code).toBe('invalid_request');
    expect(corrupt.message).toBe(PDF_MESSAGES.corrupt);

    const empty = await rejection(pdfToLines(PDF('empty.pdf')));
    expect(empty.code).toBe('invalid_request');
    expect(empty.message).toBe(PDF_MESSAGES.empty);
    expect(() => detectFormat('empty.pdf', PDF('empty.pdf'))).toThrow('The file is empty.');

    const notPdf = await rejection(pdfToLines(IMG));
    expect(notPdf.code).toBe('unsupported_type');
  });

  it('should reject an encrypted pdf with a password message (PasswordException)', async () => {
    const err = await rejection(pdfToLines(PDF('encrypted.pdf')));
    expect(err.code).toBe('unsupported_type');
    expect(err.message).toBe(PDF_MESSAGES.encrypted);
  });

  it('should refuse more than 30 pages and more than 10 MB before parsing pages', async () => {
    let pagesSeen = 0;
    const many = await rejection(pdfToLines(PDF('pages-31.pdf'), { onPage: () => pagesSeen++ }));
    expect(many.code).toBe('payload_too_large');
    expect(many.message).toContain(`limit is ${limits.maxScanPages} pages`);
    expect(pagesSeen).toBe(0);

    const big = new Uint8Array(limits.maxUploadBytes + 1);
    big.set(new TextEncoder().encode('%PDF-1.4\n'));
    expect((await rejection(pdfToLines(big))).code).toBe('payload_too_large');
  });

  it('should report per-page progress and keep the input buffer intact', async () => {
    const bytes = PDF('text.pdf');
    const progress: string[] = [];
    await pdfToLines(bytes, { onPage: (d, t) => progress.push(`${d}/${t}`) });
    expect(progress).toEqual(['1/3', '2/3', '3/3']);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('should be deterministic (same lines, regions and doc hash on every run)', async () => {
    const a = await pdfToLines(PDF('text.pdf'));
    const b = await pdfToLines(PDF('text.pdf'));
    expect(b.docHash).toBe(a.docHash);
    expect(b.lines).toEqual(a.lines);
    expect(a.lines.every((l) => supSegmentsOf(l).length === 0)).toBe(true);
  });
});
