import { describe, expect, it } from 'vitest';
import { htmlToLines, remapCp1252 } from '../../src/adapters/html';
import { limits } from '../../src/config/limits';

describe('HTML adapter', () => {
  it('maps cp1252 numeric entities 128-159 to their characters', () => {
    const r = htmlToLines('<p>&#147;Shares&#148; &#146; &#150; &#151;</p>');
    expect(r.lines[0]!.text).toBe('“Shares” ’ – —');
    expect(remapCp1252('\u0093x\u0094')).toBe('“x”');
  });
  it('decodes named entities (&ndash; &ldquo; &rdquo; &nbsp;)', () => {
    expect(htmlToLines('<p>Part&nbsp;B &ndash; &ldquo;x&rdquo;</p>').lines[0]!.text).toBe(
      'Part B – “x”',
    );
  });
  it('normalizes checkbox glyphs, including split text events ("[" "&nbsp;" "]")', () => {
    const r = htmlToLines('<p>[&nbsp;] Wire</p><p>&#168; Check</p><p>[X] Done</p><p>☐ Box</p>');
    expect(r.lines.map((l) => l.text)).toEqual(['☐ Wire', '☐ Check', '☒ Done', '☐ Box']);
  });
  it('drops EDGAR noise with an auditable rule id', () => {
    const r = htmlToLines('<p>EX-99.(P)(2)</p><p>3 of 12</p><p>[Logo]</p><p>7</p><p>Real text</p>');
    expect(r.lines.map((l) => l.text)).toEqual(['Real text']);
    expect(r.noise.map((n) => n.rule)).toEqual([
      'edgar-exhibit-wrapper',
      'page-counter-n-of-m',
      'logo-placeholder',
      'bare-page-number',
    ]);
  });
  it('drops repeated running headers after the first occurrence', () => {
    const r = htmlToLines(
      '<p><b>SUBSCRIPTION AGREEMENT SIGNATURE PAGES</b></p><p>a</p><p><b>SUBSCRIPTION AGREEMENT SIGNATURE PAGES</b></p><p>b</p>',
    );
    expect(r.lines.map((l) => l.text)).toEqual([
      'SUBSCRIPTION AGREEMENT SIGNATURE PAGES',
      'a',
      'b',
    ]);
  });
  it('skips script/style/head content', () => {
    expect(
      htmlToLines(
        '<head><title>T</title><style>p{}</style></head><script>x()</script><p>ok</p>',
      ).lines.map((l) => l.text),
    ).toEqual(['ok']);
  });
  it('splits lines longer than maxLineChars at whitespace (not rejected)', () => {
    const long = Array.from({ length: limits.maxLineChars / 5 + 50 }, () => 'abcd').join(' ');
    const r = htmlToLines(`<p>${long}</p>`);
    expect(r.lines.length).toBeGreaterThan(1);
    for (const l of r.lines) expect(l.text.length).toBeLessThanOrEqual(limits.maxLineChars);
  });
  it('decodes windows-1252 bytes when the input is not valid UTF-8', () => {
    const bytes = new Uint8Array([0x3c, 0x70, 0x3e, 0x93, 0x78, 0x94, 0x3c, 0x2f, 0x70, 0x3e]);
    expect(htmlToLines(bytes).lines[0]!.text).toBe('“x”');
  });
  it('captures position and indent cues', () => {
    const r = htmlToLines('<p align="center">Title</p><p style="margin-left: 36pt">Indented</p>');
    expect(r.lines[0]!.cue.position).toBe('center');
    expect(r.lines[1]!.cue.indent).toBe(36);
  });
});
