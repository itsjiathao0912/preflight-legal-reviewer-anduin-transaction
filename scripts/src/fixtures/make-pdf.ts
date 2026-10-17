/**
 * make-pdf (Phase 06 D6): hand-built PDF fixtures, no PDF library.
 *
 * Writes fixtures/pdf/:
 *  - text.pdf       3 pages, Helvetica / Helvetica-Bold positioned text, a 2-column table,
 *                   a repeated running header and "Page n of 3" footers (page-noise input)
 *  - scanned.pdf    1 page, only a DCT (JPEG) image of a committed crop of
 *                   samples/sub-docs/raw/09-rw-holdings-scans/appa1-pg1.jpg; no text layer
 *  - mixed.pdf      page 1 text, page 2 image only (per-page OCR routing)
 *  - encrypted.pdf  text page with a Standard-handler /Encrypt dict whose /U entry does not
 *                   match the empty user password, so pdf.js throws PasswordException
 *  - pages-31.pdf   31 short text pages (one over limits.maxScanPages)
 *  - corrupt.pdf    text.pdf truncated to its first 300 bytes
 *  - empty.pdf      0 bytes
 *
 * Output is a pure function of the committed crop (no dates, no random ids), so
 * `fixtures:check` can rebuild it in memory and compare bytes.
 * Run: pnpm --filter @aduin/scripts exec tsx src/fixtures/make-pdf.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PDF_DIR = 'fixtures/pdf';
/** Committed source image (not generated). */
export const PDF_CROP = `${PDF_DIR}/src/appa1-pg1-crop.jpg`;
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

const enc = new TextEncoder();
const latin1 = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

/** PDF literal string escaping. */
const lit = (s: string) => `(${s.replace(/[\\()]/g, (c) => `\\${c}`)})`;

type Obj = string | Uint8Array | { dict: string; stream: Uint8Array };

/** Assemble objects 1..n into a PDF with a correct xref table. Object 1 must be the catalog. */
export function assemble(objs: Obj[], trailerExtra = ''): Uint8Array {
  const parts: Uint8Array[] = [];
  let len = 0;
  const push = (b: Uint8Array) => {
    parts.push(b);
    len += b.byteLength;
  };
  push(latin1('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(len);
    push(latin1(`${i + 1} 0 obj\n`));
    if (typeof o === 'string') push(latin1(o));
    else if (o instanceof Uint8Array) push(o);
    else {
      push(latin1(`<< ${o.dict} /Length ${o.stream.byteLength} >>\nstream\n`));
      push(o.stream);
      push(latin1('\nendstream'));
    }
    push(latin1('\nendobj\n'));
  });
  const xref = len;
  let x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) x += `${String(off).padStart(10, '0')} 00000 n \n`;
  x += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R ${trailerExtra}>>\nstartxref\n${xref}\n%%EOF\n`;
  push(latin1(x));
  const out = new Uint8Array(len);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

interface TextRun {
  x: number;
  y: number;
  text: string;
  bold?: boolean;
  size?: number;
}

const contentFor = (runs: TextRun[]) =>
  runs
    .map(
      (r) =>
        `BT /${r.bold ? 'F2' : 'F1'} ${r.size ?? 11} Tf 1 0 0 1 ${r.x} ${r.y} Tm ${lit(r.text)} Tj ET`,
    )
    .join('\n');

const W = 612;
const H = 792;
const FONTS = '/Font << /F1 3 0 R /F2 4 0 R >>';
const HEADER: TextRun = { x: 72, y: 760, text: 'ACME FUND LP SUBSCRIPTION AGREEMENT', size: 9 };
const footer = (n: number, of: number): TextRun => ({
  x: 280,
  y: 30,
  text: `Page ${n} of ${of}`,
  size: 9,
});

/** The three text pages of text.pdf (also reused by mixed.pdf and encrypted.pdf). */
export const TEXT_PAGES: TextRun[][] = [
  [
    HEADER,
    { x: 72, y: 700, text: '1. Investment', bold: true, size: 12 },
    { x: 72, y: 680, text: 'The undersigned subscribes for limited partnership interests in' },
    { x: 72, y: 666, text: 'the Fund in the amount set out below.' },
    { x: 72, y: 640, text: 'Name of Investor', bold: true },
    { x: 320, y: 640, text: 'Subscription Amount', bold: true },
    { x: 72, y: 624, text: 'Jane Example' },
    { x: 320, y: 624, text: 'USD 250,000' },
    { x: 72, y: 600, text: '2. Account Type', bold: true, size: 12 },
    { x: 90, y: 580, text: '[ ] Individual' },
    { x: 260, y: 580, text: '[ ] Trust' },
    { x: 420, y: 580, text: '[ ] Corporation' },
    footer(1, 3),
  ],
  [
    HEADER,
    { x: 72, y: 700, text: '3. Investor Information', bold: true, size: 12 },
    { x: 72, y: 680, text: 'If you checked Trust in Section 2, complete Section 4.' },
    footer(2, 3),
  ],
  [
    HEADER,
    { x: 72, y: 700, text: '4. Trust Information', bold: true, size: 12 },
    { x: 72, y: 680, text: 'Please attach the trust agreement and list all trustees.' },
    footer(3, 3),
  ],
];

const CATALOG = '<< /Type /Catalog /Pages 2 0 R >>';
const HELV = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
const HELV_B =
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

type PageSpec = { kind: 'text'; runs: TextRun[] } | { kind: 'image' };

/**
 * Objects: 1 catalog, 2 pages, 3/4 fonts, 5 image (if any), then per page: page + content.
 */
function pdfOf(pages: PageSpec[], jpeg: Uint8Array | null, trailerExtra = '', extra: Obj[] = []) {
  const objs: Obj[] = [CATALOG, '', HELV, HELV_B];
  let imgRef = '';
  if (jpeg) {
    // JPEG SOF0/SOF2 dimensions (the committed crop is baseline or progressive).
    const { width, height } = jpegSize(jpeg);
    objs.push({
      dict: `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      stream: jpeg,
    });
    imgRef = `${objs.length} 0 R`;
  }
  const kids: string[] = [];
  for (const p of pages) {
    const pageNo = objs.length + 1;
    const contentNo = pageNo + 1;
    kids.push(`${pageNo} 0 R`);
    const res = p.kind === 'text' ? `<< ${FONTS} >>` : `<< /XObject << /Im1 ${imgRef} >> >>`;
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${res} /Contents ${contentNo} 0 R >>`,
    );
    const body =
      p.kind === 'text'
        ? contentFor(p.runs)
        : `q ${W - 72} 0 0 ${Math.round(((W - 72) * 413) / 900)} 36 300 cm /Im1 Do Q`;
    objs.push({ dict: '', stream: enc.encode(body) });
  }
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  objs.push(...extra);
  return assemble(objs, trailerExtra);
}

/** Width/height from the first SOFn marker of a JPEG. */
export function jpegSize(b: Uint8Array): { width: number; height: number } {
  let i = 2;
  while (i + 9 < b.byteLength) {
    if (b[i] !== 0xff) throw new Error('bad JPEG marker');
    const m = b[i + 1]!;
    const segLen = (b[i + 2]! << 8) | b[i + 3]!;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { height: (b[i + 5]! << 8) | b[i + 6]!, width: (b[i + 7]! << 8) | b[i + 8]! };
    }
    i += 2 + segLen;
  }
  throw new Error('no SOF marker in JPEG');
}

/** Build every fixture in memory: relative path -> bytes. */
export function buildPdfFixtures(root = ROOT): Map<string, Uint8Array> {
  const jpeg = new Uint8Array(readFileSync(join(root, PDF_CROP)));
  const text = pdfOf(
    TEXT_PAGES.map((runs) => ({ kind: 'text', runs })),
    null,
  );
  const scanned = pdfOf([{ kind: 'image' }], jpeg);
  const mixed = pdfOf([{ kind: 'text', runs: TEXT_PAGES[0]! }, { kind: 'image' }], jpeg);
  // Standard security handler, RC4 40-bit. /O and /U are fixed 32-byte strings that do not
  // correspond to any password, so opening with the empty user password fails.
  const pad = (c: string) => `<${c.repeat(64)}>`;
  const encryptNo = 4 + 2 * 1 + 1; // catalog, pages, 2 fonts, 1 page + content, then /Encrypt
  const encrypted = pdfOf(
    [{ kind: 'text', runs: TEXT_PAGES[0]! }],
    null,
    `/Encrypt ${encryptNo} 0 R /ID [<00112233445566778899aabbccddeeff> <00112233445566778899aabbccddeeff>] `,
    [`<< /Filter /Standard /V 1 /R 2 /O ${pad('a')} /U ${pad('b')} /P -44 >>`],
  );
  const pages31 = pdfOf(
    Array.from({ length: 31 }, (_, i) => ({
      kind: 'text' as const,
      runs: [{ x: 72, y: 700, text: `Page body text for page number ${i + 1}.` }],
    })),
    null,
  );
  return new Map<string, Uint8Array>([
    [`${PDF_DIR}/text.pdf`, text],
    [`${PDF_DIR}/scanned.pdf`, scanned],
    [`${PDF_DIR}/mixed.pdf`, mixed],
    [`${PDF_DIR}/encrypted.pdf`, encrypted],
    [`${PDF_DIR}/pages-31.pdf`, pages31],
    [`${PDF_DIR}/corrupt.pdf`, text.slice(0, 300)],
    [`${PDF_DIR}/empty.pdf`, new Uint8Array(0)],
  ]);
}

function main() {
  for (const [rel, bytes] of buildPdfFixtures()) {
    const abs = join(ROOT, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, bytes);
    console.log(`wrote ${rel} (${bytes.byteLength} bytes)`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
