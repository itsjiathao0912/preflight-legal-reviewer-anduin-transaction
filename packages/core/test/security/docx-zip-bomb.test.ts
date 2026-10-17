import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import mammoth from 'mammoth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DOCX_LIMITS,
  DOCX_STYLE_MAP,
  docxToLines,
  guardZip,
  readZipDirectory,
  reconstructNumbering,
  repackZip,
  verifyZipEntries,
} from '../../src/adapters/docx';
import { htmlToLines } from '../../src/adapters/html';
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
    const doc = Buffer.alloc(DOCX_LIMITS.maxEntryBytes + 1024, 0x61);
    expect(DOCX_LIMITS.maxEntryBytes).toBeLessThan(DOCX_LIMITS.maxUncompressedBytes);
    const honest = zip([{ name: 'word/document.xml', data: doc }]);
    expect(await codeOf(guardZip(honest))).toBe('payload_too_large');
    const lying = zip([{ name: 'word/document.xml', data: doc, claim: 10 }]);
    expect(await codeOf(guardZip(lying))).toBe('payload_too_large');
  });
});

// Review F1 cycle 2: PoC-confirmed JSZip parser differentials. Each layout must be refused by
// the guard and mammoth must never run.
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const benignDoc = Buffer.from(
  `<?xml version="1.0"?><w:document ${W}><w:body><w:p><w:r><w:t>hello</w:t></w:r></w:p></w:body></w:document>`,
);
const bombDoc = Buffer.concat([
  Buffer.from(`<?xml version="1.0"?><w:document ${W}><w:body><w:p><w:r><w:t>`),
  Buffer.alloc(DOCX_LIMITS.maxEntryBytes + 1024 * 1024, 0x61),
  Buffer.from('</w:t></w:r></w:p></w:body></w:document>'),
]);
const ctXml = Buffer.from('<?xml version="1.0"?><Types/>');
function lf(name: string, data: Buffer) {
  const comp = deflateRawSync(data);
  const nm = Buffer.from(name);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(8, 8);
  lh.writeUInt32LE(comp.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(nm.length, 26);
  return { bytes: Buffer.concat([lh, nm, comp]), comp: comp.length, size: data.length, nm };
}
function cde(l: ReturnType<typeof lf>, off: number) {
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(8, 10);
  ch.writeUInt32LE(l.comp, 20);
  ch.writeUInt32LE(l.size, 24);
  ch.writeUInt16LE(l.nm.length, 28);
  ch.writeUInt32LE(off, 42);
  return Buffer.concat([ch, l.nm]);
}
function eocdRec(count: number, cdSize: number, cdOff: number, disk = 0) {
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0);
  e.writeUInt16LE(disk, 4);
  e.writeUInt16LE(count, 8);
  e.writeUInt16LE(count, 10);
  e.writeUInt32LE(cdSize, 12);
  e.writeUInt32LE(cdOff, 16);
  return e;
}

/** Bypass A: EOCD disk=0xffff -> JSZip goes ZIP64 and reads the evil CD via locator. */
function bypassA(): Uint8Array {
  const lCt = lf('[Content_Types].xml', ctXml);
  const lBen = lf('word/document.xml', benignDoc);
  const lBomb = lf('word/document.xml', bombDoc);
  const cdBenSize = cde(lCt, 0).length + cde(lBen, 0).length;
  const oCt = cdBenSize;
  const oBen = oCt + lCt.bytes.length;
  const oBomb = oBen + lBen.bytes.length;
  const cdBen = Buffer.concat([cde(lCt, oCt), cde(lBen, oBen)]);
  const locals = Buffer.concat([lCt.bytes, lBen.bytes, lBomb.bytes]);
  const cdEvilOff = cdBen.length + locals.length;
  const cdEvil = Buffer.concat([cde(lCt, oCt), cde(lBomb, oBomb)]);
  const z64Off = cdEvilOff + cdEvil.length;
  const z64 = Buffer.alloc(56);
  z64.writeUInt32LE(0x06064b50, 0);
  z64.writeBigUInt64LE(44n, 4);
  z64.writeUInt16LE(45, 12);
  z64.writeUInt16LE(45, 14);
  z64.writeBigUInt64LE(2n, 24);
  z64.writeBigUInt64LE(2n, 32);
  z64.writeBigUInt64LE(BigInt(cdEvil.length), 40);
  z64.writeBigUInt64LE(BigInt(cdEvilOff), 48);
  const loc = Buffer.alloc(20);
  loc.writeUInt32LE(0x07064b50, 0);
  loc.writeBigUInt64LE(BigInt(z64Off), 8);
  loc.writeUInt32LE(1, 16);
  return new Uint8Array(
    Buffer.concat([cdBen, locals, cdEvil, z64, loc, eocdRec(2, cdBen.length, 0, 0xffff)]),
  );
}

/** Bypass B: gap between the (guard-visible) CD end and the EOCD hides a second CD. */
function bypassB(): Uint8Array {
  const lCt = lf('[Content_Types].xml', ctXml);
  const lBen = lf('word/document.xml', benignDoc);
  const lBomb = lf('word/document.xml', bombDoc);
  const oCt = 0;
  const oBen = lCt.bytes.length;
  const oBomb = oBen + lBen.bytes.length;
  const locals = Buffer.concat([lCt.bytes, lBen.bytes, lBomb.bytes]);
  const cdBen = Buffer.concat([cde(lCt, oCt), cde(lBen, oBen)]);
  const cdEvil = Buffer.concat([cde(lCt, oCt), cde(lBomb, oBomb)]);
  // EOCD points at cdBen, but JSZip reads at eocd - cdSize, where cdEvil sits (same size).
  expect(cdEvil.length).toBe(cdBen.length);
  return new Uint8Array(
    Buffer.concat([locals, cdBen, cdEvil, eocdRec(2, cdBen.length, locals.length)]),
  );
}

describe('docx-zip-bomb F1 cycle 2 (parser differential)', () => {
  afterEach(() => vi.restoreAllMocks());

  for (const [label, build] of [
    ['bypass A (ZIP64 switch via disk 0xffff + locator)', bypassA],
    ['bypass B (gap between CD end and EOCD)', bypassB],
  ] as const) {
    it(`refuses ${label} and never invokes mammoth`, async () => {
      const spy = vi.spyOn(mammoth, 'convertToHtml');
      const z = build();
      expect(z.byteLength).toBeLessThan(DOCX_LIMITS.maxBytes);
      expect(() => readZipDirectory(z)).toThrow(CoreError);
      expect(await codeOf(guardZip(z))).toBe('unsupported_type');
      expect(await codeOf(docxToLines(z))).toBe('unsupported_type');
      expect(spy).not.toHaveBeenCalled();
    });
  }

  it('refuses each sentinel / ZIP64 signature / disk mismatch on its own', async () => {
    const base = zip([{ name: 'word/document.xml', data: Buffer.from('<x/>'), method: 0 }]);
    const e = base.byteLength - 22;
    const mut = (fn: (dv: DataView) => void) => {
      const c = new Uint8Array(base);
      fn(new DataView(c.buffer));
      return c;
    };
    const cases = [
      mut((d) => d.setUint16(e + 4, 1, true)),
      mut((d) => d.setUint16(e + 6, 0xffff, true)),
      mut((d) => d.setUint16(e + 8, 0xffff, true)),
      mut((d) => d.setUint16(e + 8, 0, true)),
      mut((d) => d.setUint32(e + 12, 0xffffffff, true)),
      mut((d) => d.setUint32(e + 16, 0xffffffff, true)),
    ];
    for (const c of cases) expect(await codeOf(guardZip(c))).toBe('unsupported_type');
    const loc = Buffer.alloc(20);
    loc.writeUInt32LE(0x07064b50, 0);
    const withLoc = new Uint8Array(
      Buffer.concat([Buffer.from(base.subarray(0, e)), loc, Buffer.from(base.subarray(e))]),
    );
    expect(await codeOf(guardZip(withLoc))).toBe('unsupported_type');
  });

  it('refuses names that normalize to duplicates', async () => {
    for (const alt of [
      'Word/Document.xml',
      './word/document.xml',
      '/word/document.xml',
      'word//document.xml',
    ]) {
      const z = zip([
        { name: 'word/document.xml', data: Buffer.from('<a/>') },
        { name: alt, data: Buffer.from('<b/>') },
      ]);
      expect(await codeOf(guardZip(z))).toBe('unsupported_type');
    }
  });

  it('applies the per-entry cap to every entry, not only word/document.xml', async () => {
    const big = Buffer.alloc(DOCX_LIMITS.maxEntryBytes + 1024, 0x61);
    const z = zip([
      { name: 'word/document.xml', data: Buffer.from('<w:document/>') },
      { name: 'word/styles.xml', data: big, claim: 10 },
    ]);
    expect(await codeOf(guardZip(z))).toBe('payload_too_large');
  });

  it('repack is canonical: STORE, honest EOCD, re-verifies to the same entries', async () => {
    const z = zip([
      { name: 'word/document.xml', data: Buffer.from('<w:document/>') },
      { name: 'word/styles.xml', data: Buffer.from('<s/>') },
    ]);
    const v = await verifyZipEntries(z);
    const r = repackZip(v);
    const dir = readZipDirectory(r);
    expect(dir.map((d) => [d.name, d.method])).toEqual([
      ['word/document.xml', 0],
      ['word/styles.xml', 0],
    ]);
    const again = await verifyZipEntries(r);
    expect(again.map((e) => Buffer.from(e.data).toString())).toEqual(['<w:document/>', '<s/>']);
  });

  it('a normal fixture DOCX converts identically through the repack', async () => {
    const raw = new Uint8Array(
      readFileSync(new URL('../../../../fixtures/docx/legal-numbering.docx', import.meta.url)),
    );
    const spy = vi.spyOn(mammoth, 'convertToHtml');
    const viaRepack = await docxToLines(raw);
    // The spy seam is live: the same mammoth object docx.ts calls (proves the bypass tests' not-called).
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    const copy = raw.slice();
    const direct = await mammoth.convertToHtml(
      { buffer: copy, arrayBuffer: copy.buffer } as unknown as { arrayBuffer: ArrayBuffer },
      {
        styleMap: [...DOCX_STYLE_MAP],
        convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
      },
    );
    const expected = htmlToLines(reconstructNumbering(direct.value).html);
    expect(viaRepack.lines.map((l) => l.text)).toEqual(expected.lines.map((l) => l.text));
    expect(viaRepack.reconstructedNumbering).toBe(true);
  });
});
