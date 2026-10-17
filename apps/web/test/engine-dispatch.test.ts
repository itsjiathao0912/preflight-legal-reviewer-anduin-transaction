import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { api } from '../src/engine/engine.worker';
import type { OcrPageInput } from '../src/engine/types';

// Phase 06 D3: analyze() format dispatch in the engine worker module (jsdom, no Worker needed).
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const fixture = (...p: string[]) => new Uint8Array(readFileSync(join(ROOT, 'fixtures', ...p)));
const noop = () => undefined;

function authoredOcrPage(): OcrPageInput {
  const raw = JSON.parse(
    readFileSync(
      join(ROOT, 'fixtures', 'llm-recordings', 'ocr', 'appa1-pg1.authored.json'),
      'utf8',
    ),
  ) as { result: { pages: { lines: OcrPageInput['lines'] }[] } };
  return { index: 0, state: 'done', lines: raw.result.pages[0]!.lines };
}

describe('engine dispatch (06d)', () => {
  it('bare bytes stay the HTML path (Phase 03 form)', async () => {
    const r = await api.analyze(new TextEncoder().encode('<p>Section 1. Hello.</p>'), {}, noop);
    expect(r.failedStage).toBeNull();
    expect(r.source).toBe('html');
    expect(r.blocks.some((b) => b.text.includes('Hello'))).toBe(true);
  });

  it('DOCX: reconstructed numbering, sections and a labelled cross-reference finding', async () => {
    const r = await api.analyze(
      {
        kind: 'docx',
        bytes: fixture('docx', 'legal-numbering.docx'),
        name: 'legal-numbering.docx',
      },
      {},
      noop,
    );
    expect(r.failedStage).toBeNull();
    expect(r.source).toBe('docx');
    expect(r.reconstructedNumbering).toBe(true);
    expect(r.notice).toMatch(/reconstructed/);
    expect(r.sections.map((s) => s.label)).toContain('2. Subscription');
    const xref = r.findings.filter((f) => f.issue_class === 'broken_cross_reference');
    expect(xref.length).toBeGreaterThanOrEqual(1);
    expect(xref.every((f) => f.numberingNote === 'based on reconstructed numbering')).toBe(true);
  });

  it('OCR pages: one finding with page, region and page confidence on the blocks', async () => {
    const r = await api.analyze(
      { kind: 'ocr', sourceHash: 'b'.repeat(64), pageCount: 1, pages: [authoredOcrPage()] },
      {},
      noop,
    );
    expect(r.failedStage).toBeNull();
    expect(r.source).toBe('ocr');
    expect(r.docHash).toBe('b'.repeat(64));
    expect(r.ocr?.pages).toEqual([
      expect.objectContaining({ index: 0, state: 'done', lowConfidence: false }),
    ]);
    const f = r.findings.filter((x) => /Partnership\/LLC/.test(x.quote));
    expect(f).toHaveLength(1);
    expect(f[0]!.page).toBe(1);
    const b = r.blocks[f[0]!.order]!;
    expect(b.page).toBe(1);
    expect(b.region).toBeDefined();
    expect(typeof b.conf).toBe('number');
    expect(r.blocks.every((x) => !x.text.includes('^{'))).toBe(true);
  });

  it('OCR unavailable: no text, notice, structure and checks skipped, no crash (AC24)', async () => {
    const r = await api.analyze(
      {
        kind: 'ocr',
        sourceHash: 'c'.repeat(64),
        pageCount: 2,
        pages: [
          { index: 0, state: 'unavailable', reason: 'OCR unavailable in this build' },
          { index: 1, state: 'failed', reason: 'The OCR answer could not be read.' },
        ],
      },
      {},
      noop,
    );
    expect(r.failedStage).toBeNull();
    expect(r.blocks).toEqual([]);
    expect(r.notice).toMatch(/Text not extracted for 2 of 2 pages/);
    expect(r.ocr?.pages.map((p) => p.state)).toEqual(['unavailable', 'failed']);
    expect(r.stages.find((s) => s.id === 'checks')?.state).toBe('skipped');
  });

  it('refuses an extension / content mismatch with a clear message', async () => {
    const r = await api.analyze(
      { kind: 'docx', bytes: new TextEncoder().encode('%PDF-1.4 fake'), name: 'x.docx' },
      {},
      noop,
    );
    expect(r.failedStage).toBe('read');
    expect(r.notice).toMatch(/does not match/);
  });

  it('refuses a corrupt DOCX with a clear message (no crash)', async () => {
    const r = await api.analyze(
      { kind: 'docx', bytes: fixture('docx', 'corrupt.docx'), name: 'corrupt.docx' },
      {},
      noop,
    );
    expect(r.failedStage).toBe('read');
    expect(r.notice).toBeTruthy();
  });
});
