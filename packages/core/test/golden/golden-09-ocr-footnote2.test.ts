import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { setSupSegments, supSegmentsOf, type SupSegment } from '../../src/adapters/sup-segments';
import { supSegmentsOf as htmlSupSegmentsOf } from '../../src/adapters/html';
import { OcrResultSchema, type OcrResult } from '../../src/contracts/ocr';
import { buildDocGraph, runDeterministic } from '../../src/engine';
import type { Line } from '../../src/model/types';

/**
 * AC14 (Hybrid, recorded OCR, no live call): sample #9 A-1 p.1 Account Type grid. Trust,
 * Corporation and Other carry footnote 2; Partnership/LLC does not. Probe-first D2 outcome
 * (2026-10-17): the sup segments reach the option group, but PATH-04 (`investor-path-missing-item`)
 * does NOT fire: OCR lines have no heading cues, so the page has no numbered main scope and
 * `investorModel` returns no paths. The planned fallback applies: `footnote-requirement` checks
 * OCR-provenance investor groups with the PATH-04 peer rule (distinct peer types), deduped
 * against PATH-04. Firing detector: `footnote-requirement` (inconsistent_footnote_requirement).
 *
 * `ocrToLines` is a minimal test-local stand-in for the Phase 06d OCR adapter (`adapters/ocr.ts`):
 * one Line per OCR line (one visual row), `^{n}` stripped, zero-width sup segment at the label end
 * on the cleaned text, page = index + 1, region = bbox. 06d swaps this for the real adapter.
 */
const MARKER = /[ \t]{0,8}\^\{(\d{1,3})\}/g;

function ocrToLines(r: OcrResult): Line[] {
  const out: Line[] = [];
  for (const p of r.pages) {
    for (const l of p.lines) {
      let text = '';
      let last = 0;
      const sups: SupSegment[] = [];
      for (const m of l.text.matchAll(MARKER)) {
        text += l.text.slice(last, m.index);
        sups.push({ start: text.length, end: text.length, text: m[1]! });
        last = m.index + m[0].length;
      }
      text += l.text.slice(last);
      const line: Line = {
        text,
        cue: { bold: false, caps: false, indent: 0, position: 'unknown', cue_source: 'ocr' },
        page: p.index + 1,
      };
      if (l.bbox) line.region = l.bbox;
      setSupSegments(line, sups);
      out.push(line);
    }
  }
  return out;
}

function load(name: string): OcrResult {
  const raw = JSON.parse(
    readFileSync(
      new URL(`../../../../fixtures/llm-recordings/ocr/${name}`, import.meta.url),
      'utf8',
    ),
  ) as { result: unknown };
  return OcrResultSchema.parse(raw.result);
}

function run(name: string) {
  const lines = ocrToLines(load(name));
  const g = buildDocGraph('ocr-' + name, lines, { bytes: 0, adapter_ms: 0 }, 'ocr');
  return { g, lines, findings: runDeterministic(g) };
}

describe('golden-09-ocr-footnote2 (AC14, Hybrid on recorded OCR)', () => {
  for (const name of ['appa1-pg1.authored.json', 'appa1-pg1.ocr2.recorded.json']) {
    describe(name, () => {
      const { g, lines, findings } = run(name);
      const fn2 = findings.filter(
        (f) =>
          /Partnership\/LLC/.test(f.quote) && /footnote 2|\b2\b/.test(JSON.stringify(f.detail)),
      );

      it('should flag Partnership/LLC missing footnote 2 from recorded OCR output', () => {
        expect(fn2).toHaveLength(1);
      });

      it('the finding comes from footnote-requirement (OCR peer rule), not PATH-04', () => {
        const f = fn2[0]!;
        expect(f.detector_id).toBe('footnote-requirement');
        expect(f.issue_class).toBe('inconsistent_footnote_requirement');
        expect(f.detail.facts).toMatchObject({
          marker: '2',
          unmarked: '"Partnership/LLC"',
          marked: '"Trust", "Corporation"',
          provenance: 'ocr',
        });
      });

      it('exactly one finding on the page: no IRA, Individual or double report', () => {
        expect(findings).toHaveLength(1);
        expect(findings.filter((f) => f.detector_id === 'investor-path-missing-item')).toHaveLength(
          0,
        );
      });

      it('carries page and the evidence-line region (D3)', () => {
        const f = fn2[0]!;
        expect(f.page).toBe(1);
        const row = lines.find((l) => l.text.includes('Partnership/LLC'))!;
        expect(f.region).toEqual(row.region);
      });

      it('the same Line object reaches block.lines[0] with its sup segments (D2 seam)', () => {
        const b = g.structure.blocks.find((x) => x.lines[0]?.text.includes('Partnership/LLC'))!;
        expect(b.lines).toHaveLength(1);
        expect(supSegmentsOf(b.lines[0]).map((s) => s.text)).toEqual(['2', '2']);
        expect(b.lines[0]!.text).not.toContain('^{');
      });
    });
  }

  it('html.ts re-exports the single sup map (one WeakMap)', () => {
    expect(htmlSupSegmentsOf).toBe(supSegmentsOf);
  });

  it('dedupe: when PATH-04 can run (numbered scope), it owns the gap and the OCR branch is silent', () => {
    const bold = (text: string): Line => ({
      text,
      cue: { bold: true, caps: false, indent: 0, position: 'left', cue_source: 'ocr' },
      page: 1,
    });
    const r = load('appa1-pg1.authored.json');
    const grid = ocrToLines(r).filter((l) => l.text.includes('☐'));
    const lines = [
      bold('1. Investment'),
      bold('2. Account Type'),
      ...grid,
      bold('3. Investor Information'),
      bold('4. Signatures'),
    ];
    const g = buildDocGraph('ocr-dedupe', lines, { bytes: 0, adapter_ms: 0 }, 'ocr');
    const fs = runDeterministic(g).filter((f) => /Partnership\/LLC/.test(f.quote));
    expect(fs).toHaveLength(1);
    const ids = fs.map((f) => f.detector_id);
    expect(ids).toEqual(['investor-path-missing-item']);
  });

  it('HTML lines (no cue_source ocr) never take the OCR branch', () => {
    const lines = ocrToLines(load('appa1-pg1.authored.json')).map((l) => {
      const { cue_source: _c, ...cue } = l.cue;
      const html: Line = { text: l.text, cue };
      setSupSegments(html, supSegmentsOf(l));
      return html;
    });
    const g = buildDocGraph('html-like', lines, { bytes: 0, adapter_ms: 0 });
    expect(
      runDeterministic(g).filter((f) => f.detector_id === 'footnote-requirement'),
    ).toHaveLength(0);
  });
});
