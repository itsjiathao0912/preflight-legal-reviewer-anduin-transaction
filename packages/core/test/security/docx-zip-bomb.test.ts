import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { DOCX_LIMITS, docxToLines, guardZip, readZipDirectory } from '../../src/adapters/docx';
import { CoreError } from '../../src/model/errors';

/** Minimal zip writer for adversarial archives (sizes in headers are caller-controlled). */
function zip(
  files: Array<{ name: string; data: Buffer; method?: number; claim?: number }>,
  eocdCount = files.length,
): Uint8Array {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let off = 0;
  for (const f of files) {
    const method = f.method ?? 8;
    const comp = method === 8 ? deflateRawSync(f.data) : f.data;
    const name = Buffer.from(f.name);
    const size = f.claim ?? f.data.length;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(size, 22);
    lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(size, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(off, 42);
    locals.push(lh, name, comp);
    central.push(ch, name);
    off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(eocdCount, 8);
  eocd.writeUInt16LE(eocdCount, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, eocd]));
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(CoreError);
    return (e as CoreError).code;
  }
  throw new Error('expected a CoreError');
}

const bomb = Buffer.alloc(DOCX_LIMITS.maxUncompressedBytes + 1024 * 1024); // zeros: deflates to ~65 KB

describe('docx-zip-bomb guard', () => {
  it('refuses an archive whose declared uncompressed size exceeds the cap', async () => {
    const z = zip([
      { name: 'word/document.xml', data: Buffer.from('<w:document/>') },
      { name: 'word/media/big.bin', data: bomb },
    ]);
    expect(z.byteLength).toBeLessThan(DOCX_LIMITS.maxBytes);
    expect(await codeOf(docxToLines(z))).toBe('payload_too_large');
  });
  it('refuses a bomb that LIES about its size in the headers (streamed inflate budget)', async () => {
    const z = zip([
      { name: 'word/document.xml', data: Buffer.from('<w:document/>') },
      { name: 'word/media/big.bin', data: bomb, claim: 10 },
    ]);
    expect(() => readZipDirectory(z)).not.toThrow();
    expect(await codeOf(guardZip(z))).toBe('payload_too_large');
  });
  it('refuses too many entries', async () => {
    const files = Array.from({ length: DOCX_LIMITS.maxEntries + 1 }, (_, i) => ({
      name: i === 0 ? 'word/document.xml' : `x/${i}`,
      data: Buffer.from('a'),
      method: 0,
    }));
    expect(await codeOf(docxToLines(zip(files)))).toBe('payload_too_large');
  });
  it('refuses input over 10 MB before touching the zip', async () => {
    expect(await codeOf(docxToLines(new Uint8Array(DOCX_LIMITS.maxBytes + 1)))).toBe(
      'payload_too_large',
    );
  });
  it('refuses a zip that is not a Word document', async () => {
    expect(await codeOf(docxToLines(zip([{ name: 'a.txt', data: Buffer.from('hi') }])))).toBe(
      'unsupported_type',
    );
  });
  it('refuses out-of-bounds offsets and unknown compression methods', async () => {
    const z = zip([{ name: 'word/document.xml', data: Buffer.from('<x/>'), method: 0 }]);
    const bad = new Uint8Array(z);
    const cd = bad.byteLength - 22 - 46 - 'word/document.xml'.length;
    new DataView(bad.buffer).setUint32(cd + 42, 0x7fffffff, true);
    expect(await codeOf(guardZip(bad))).toBe('unsupported_type');
    const m = new Uint8Array(z);
    new DataView(m.buffer).setUint16(cd + 10, 12, true);
    expect(await codeOf(guardZip(m))).toBe('unsupported_type');
  });
  // Review F1 PoC: EOCD declares fewer entries than the central directory holds, hiding a
  // trailing duplicate word/document.xml that JSZip would read (last-wins) and inflate unguarded.
  it('refuses an EOCD count lower than the real central directory (hidden trailing entry)', async () => {
    const big = Buffer.alloc(30 * 1024 * 1024, 0x61);
    const files = [
      { name: '[Content_Types].xml', data: Buffer.from('<Types/>') },
      { name: 'word/document.xml', data: Buffer.from('<w:document/>') },
      { name: 'word/media/x.bin', data: big },
    ];
    const z = zip(files, 2);
    expect(z.byteLength).toBeLessThan(DOCX_LIMITS.maxBytes);
    expect(() => readZipDirectory(z)).toThrow(CoreError);
    expect(await codeOf(guardZip(z))).toBe('unsupported_type');
    expect(await codeOf(docxToLines(z))).toBe('unsupported_type');
  });
  it('refuses duplicate entry names (EOCD count honest)', async () => {
    const z = zip([
      { name: 'word/document.xml', data: Buffer.from('<w:document/>') },
      { name: 'word/document.xml', data: Buffer.from('<w:document>evil</w:document>') },
    ]);
    expect(await codeOf(guardZip(z))).toBe('unsupported_type');
    expect(await codeOf(docxToLines(z))).toBe('unsupported_type');
  });
  it('refuses a word/document.xml that inflates past the per-entry cap, even when it lies', async () => {
    const doc = Buffer.alloc(DOCX_LIMITS.maxDocumentXmlBytes + 1024, 0x61);
    expect(DOCX_LIMITS.maxDocumentXmlBytes).toBeLessThan(DOCX_LIMITS.maxUncompressedBytes);
    const honest = zip([{ name: 'word/document.xml', data: doc }]);
    expect(await codeOf(guardZip(honest))).toBe('payload_too_large');
    const lying = zip([{ name: 'word/document.xml', data: doc, claim: 10 }]);
    expect(await codeOf(guardZip(lying))).toBe('payload_too_large');
  });
});
