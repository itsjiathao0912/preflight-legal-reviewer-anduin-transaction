import { describe, expect, it } from 'vitest';
import { htmlToLines } from '../../src/adapters/html';
import type { Detector } from '../../src/detectors/registry';
import { detectors } from '../../src/detectors/registry';
import { analyzeHtml, runDeterministic, type DetectorFailure } from '../../src/engine';
import { FindingSchema } from '../../src/findings/schema';
import { mask, sensitiveSpans } from '../../src/memory/mask';
import { buildStructureView } from '../../src/structure-view/build';
import { readSample } from '../helpers/samples';

/** Phase 02 review fix cycle: F1 (long groups / isolation), F2 (mask-then-clip), F3 (mask gaps), P2-1. */

describe('F1: long option groups never throw and one detector cannot sink the run', () => {
  const opts = Array.from(
    { length: 100 },
    (_, i) =>
      `<p>☐ Delivery option number ${i + 1} for the notice${i === 0 ? '<sup>1</sup>' : ''}</p>`,
  ).join('');
  const html = `<p>1. Notices</p><p>Select the delivery method (check one):</p>${opts}<p>Text after.</p>`;

  it('a 100-option group with one footnote yields a bounded, schema-valid finding', () => {
    const g = analyzeHtml(html);
    expect(g.structure.optionGroups[0]?.options).toHaveLength(100);
    const diagnostics: DetectorFailure[] = [];
    const findings = runDeterministic(g, { diagnostics });
    expect(diagnostics).toEqual([]);
    const f = findings.find((x) => x.detector_id === 'footnote-requirement');
    expect(f).toBeDefined();
    expect(FindingSchema.safeParse(f).success).toBe(true);
    expect(f!.detail.explanation).toContain('and 94 more');
    for (const v of Object.values(f!.detail.facts))
      if (typeof v === 'string') expect(v.length).toBeLessThanOrEqual(400);
  });

  it('records a throwing detector as a diagnostic (no text) and keeps the others', () => {
    const g = analyzeHtml(html);
    const boom: Detector = {
      ...detectors[0]!,
      id: 'boom',
      run: () => {
        throw new TypeError('secret 990000017 text');
      },
    };
    const diagnostics: DetectorFailure[] = [];
    const findings = runDeterministic(g, { diagnostics }, [boom, ...detectors]);
    expect(diagnostics).toEqual([{ stage: 'detector', detectorId: 'boom', code: 'TypeError' }]);
    expect(findings.some((x) => x.detector_id === 'footnote-requirement')).toBe(true);
  });
});

describe('F2: a clip boundary never leaks a raw digit tail', () => {
  const NUM = '990000017';
  const windows = Array.from({ length: NUM.length - 3 }, (_, i) => NUM.slice(i, i + 4));
  const leaks = (s: string) => {
    // drop the mask token and hash-like ids/anchors (hex runs of 12+), then look for raw windows
    const t = s.replaceAll('#0017', '').replace(/[0-9a-f]{12,}/g, '');
    return windows.filter((w) => t.includes(w));
  };

  it('drafting note, conditional, option, title and excerpt clips all mask first', () => {
    for (let r = 0; r < 5; r++)
      for (let k = 0; k < 52; k++) {
        const a = 'w'.repeat(r) + ' ' + 'word '.repeat(k);
        const html = [
          '<p>1. Notices</p>',
          `<p>NTD: ${a}${NUM} end of note.</p>`,
          `<p>If you are an individual ${a}${NUM}, skip to Section 9.</p>`,
          `<p>Select the delivery method ${a}${NUM} (check one):</p>`,
          `<p>☐ Option ${a}${NUM} x<sup>1</sup></p>`,
          '<p>☐ Option two</p>',
          `<p>2. Title ${a}${NUM} more</p>`,
          `<p>${a}${NUM} as described in Section 7 of this Agreement ${a}${NUM}.</p>`,
        ].join('');
        const g = analyzeHtml(html);
        const findings = runDeterministic(g);
        const out = JSON.stringify(findings) + JSON.stringify(buildStructureView(g, findings));
        expect(leaks(out), `r=${r} k=${k}`).toEqual([]);
      }
  });
});

describe('F3: account-number mask gaps', () => {
  const m = (s: string) => mask(s, sensitiveSpans(s));
  it.each([
    ['alpha prefix + 40 digits', `Acct AB${'1234567890'.repeat(4)} end`, 'Acct #7890 end'],
    ['lowercase prefix', 'ref acct12345678 ok', 'ref #5678 ok'],
    ['digits glued to a letter', 'ABA 021000021x ok', 'ABA #0021x ok'],
    ['dot separators', 'No. 1234.5678.90 ok', 'No. #7890 ok'],
    ['slash separators', 'No. 1234/5678/90 ok', 'No. #7890 ok'],
    ['en-dash separators', 'No. 1234–5678–90 ok', 'No. #7890 ok'],
    ['NBSP separators', 'No. 1234 5678 90 ok', 'No. #7890 ok'],
    ['grouped run over 32 digits', `No. ${'1234 '.repeat(12)}ok`, 'No. #1234 ok'],
    ['run over the 131-digit bound', `No. ${'9'.repeat(300)}1234 ok`, 'No. #1234 ok'],
  ])('%s', (_, input, expected) => {
    expect(m(input)).toBe(expected);
  });
});

describe('P2-1: EDGAR wrapper noise rule is anchored', () => {
  it('keeps real lines that start with a wrapper word and drops the EDGAR shapes', () => {
    const r = htmlToLines(
      [
        'Type of Subscriber (check one):',
        'Documentation ☐ For entity investors, attach documents',
        'Text of Section 4',
        'EX-99.(P)(2)',
        '&lt;TYPE&gt;10-K',
        'TYPE: 10-K',
      ]
        .map((t) => `<p>${t}</p>`)
        .join(''),
    );
    expect(r.lines.map((l) => l.text)).toEqual([
      'Type of Subscriber (check one):',
      'Documentation ☐ For entity investors, attach documents',
      'Text of Section 4',
    ]);
    expect(r.noise.map((n) => n.rule)).toEqual([
      'edgar-exhibit-wrapper',
      'edgar-exhibit-wrapper',
      'edgar-exhibit-wrapper',
    ]);
  });

  it('sample #10 reports no wrapper noise and keeps its "Documentation" line', () => {
    const r = htmlToLines(readSample(10));
    expect(r.noise.filter((n) => n.rule === 'edgar-exhibit-wrapper')).toEqual([]);
    expect(r.lines.some((l) => l.text.startsWith('Documentation'))).toBe(true);
  });
});
