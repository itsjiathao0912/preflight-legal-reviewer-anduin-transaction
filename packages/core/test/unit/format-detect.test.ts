import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectFormat, indexOfBytes, sniffMagic } from '../../src/adapters/format-detect';
import { limits } from '../../src/config/limits';
import { CoreError } from '../../src/model/errors';

const ROOT = join(__dirname, '../../../..');
const file = (rel: string) => new Uint8Array(readFileSync(join(ROOT, rel)));
const bytes = (...parts: (string | number[] | Uint8Array)[]) => {
  const chunks = parts.map((p) =>
    typeof p === 'string'
      ? new TextEncoder().encode(p)
      : p instanceof Uint8Array
        ? p
        : Uint8Array.from(p),
  );
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
};
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const DOCX = bytes(ZIP, '....[Content_Types].xml....', ZIP, 'word/document.xml....');

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(CoreError);
    return (e as CoreError).code;
  }
  throw new Error('expected a CoreError');
}

describe('format-detect', () => {
  it('accepts each supported format when extension and magic agree', () => {
    expect(detectFormat('a.HTML', bytes('<html><p>x</p></html>')).format).toBe('html');
    expect(detectFormat('a.htm', bytes('plain text sub doc')).format).toBe('html');
    expect(detectFormat('text.pdf', file('fixtures/pdf/text.pdf')).format).toBe('pdf');
    expect(detectFormat('a.docx', DOCX).format).toBe('docx');
    expect(detectFormat('a.jpeg', bytes(JPEG, 'rest')).format).toBe('jpeg');
    expect(detectFormat('a.png', bytes(PNG, 'rest'))).toEqual({
      format: 'png',
      extension: '.png',
      image: true,
    });
    expect(sniffMagic(file('fixtures/pdf/src/appa1-pg1-crop.jpg'))).toBe('jpeg');
  });

  it('rejects unknown extensions, including SVG and no extension', () => {
    for (const name of ['a.svg', 'a.doc', 'a.txt', 'noext', 'a.pdf.exe']) {
      expect(
        codeOf(() => detectFormat(name, bytes('<svg/>'))),
        name,
      ).toBe('unsupported_type');
    }
  });

  it('rejects empty and oversize files', () => {
    expect(codeOf(() => detectFormat('a.pdf', new Uint8Array(0)))).toBe('invalid_request');
    const big = new Uint8Array(limits.maxUploadBytes + 1);
    big.set(bytes('%PDF-1.4'));
    expect(codeOf(() => detectFormat('a.pdf', big))).toBe('payload_too_large');
  });

  it('rejects a mismatch between extension and content', () => {
    expect(codeOf(() => detectFormat('a.pdf', bytes(PNG)))).toBe('unsupported_type');
    expect(codeOf(() => detectFormat('a.png', bytes('%PDF-1.4')))).toBe('unsupported_type');
    expect(codeOf(() => detectFormat('a.jpg', bytes('<svg onload=x>')))).toBe('unsupported_type');
    expect(codeOf(() => detectFormat('a.html', bytes(JPEG)))).toBe('unsupported_type');
    expect(codeOf(() => detectFormat('a.html', bytes('text', [0], 'more')))).toBe(
      'unsupported_type',
    );
    // A plain ZIP is not a Word package.
    expect(codeOf(() => detectFormat('a.docx', bytes(ZIP, 'other.xml')))).toBe('unsupported_type');
    expect(codeOf(() => detectFormat('a.html', bytes(ZIP, 'x')))).toBe('unsupported_type');
  });

  it('rejects polyglots (a PDF or image that also carries a Word package, HTML with %PDF)', () => {
    expect(codeOf(() => detectFormat('a.pdf', bytes('%PDF-1.4\n', DOCX)))).toBe('unsupported_type');
    expect(codeOf(() => detectFormat('a.jpg', bytes(JPEG, DOCX)))).toBe('unsupported_type');
    expect(codeOf(() => detectFormat('a.html', bytes('<p>x</p>\n%PDF-1.7')))).toBe(
      'unsupported_type',
    );
  });

  it('error messages are human readable', () => {
    try {
      detectFormat('a.pdf', bytes(PNG));
    } catch (e) {
      expect((e as Error).message).toBe(
        'The file content is not a PDF (it does not match the ".pdf" extension).',
      );
    }
  });

  it('indexOfBytes finds needles and handles edges', () => {
    expect(indexOfBytes(bytes('abcabc'), [0x63, 0x61])).toBe(2);
    expect(indexOfBytes(bytes('ab'), [0x61, 0x62, 0x63])).toBe(-1);
    expect(indexOfBytes(new Uint8Array(0), [1])).toBe(-1);
  });
});
