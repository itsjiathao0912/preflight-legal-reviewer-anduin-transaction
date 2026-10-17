import mammoth from 'mammoth';
import { Parser } from 'htmlparser2';
import { limits } from '../config/limits';
import { CoreError } from '../model/errors';
import { sha256Hex } from '../model/hash';
import { htmlToLines, MAX_FRAME_DEPTH, type HtmlAdapterResult } from './html';

/**
 * DOCX adapter (Phase 06, D4): mammoth `convertToHtml` -> numbering pre-pass -> HTML adapter.
 *
 * Word list numbers live in numbering.xml and are rendered by Word, so mammoth emits nested
 * `<ol>/<ul><li>` with the literal "1." / "(a)" text lost. The pre-pass re-creates a legal-style
 * label per `<ol>` depth (1. / 1.1 / (a) / (i) / (A) / (n)) and prefixes it to each `<li>`. The
 * labels are a RECONSTRUCTION: callers must show `reconstructedNumbering` and label xref findings
 * with `RECONSTRUCTED_NUMBERING_LABEL`.
 *
 * Boundaries: 10 MB input cap, then a bounded zip inspection (central directory parse + streamed
 * inflate with a running byte budget) BEFORE mammoth/JSZip ever inflates the archive, so a zip
 * bomb is refused whatever sizes its headers claim. Empty / non-zip / corrupt -> CoreError.
 */

export const RECONSTRUCTED_NUMBERING_LABEL = 'based on reconstructed numbering';

/** Zip guard caps (a real sub-doc DOCX is a few MB uncompressed and < 200 entries). */
export const DOCX_LIMITS = {
  maxBytes: limits.maxUploadBytes,
  maxEntries: 2000,
  maxUncompressedBytes: 64 * 1024 * 1024,
} as const;

/** Word style names -> HTML so headings survive (mammoth's defaults cover "Heading N"). */
export const DOCX_STYLE_MAP: readonly string[] = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='List Number'] => ol > li:fresh",
  "p[style-name='List Bullet'] => ul > li:fresh",
];

export interface DocxAdapterResult extends HtmlAdapterResult {
  /** True when at least one list item got a reconstructed label. */
  reconstructedNumbering: boolean;
  /** Number of `<li>` items seen (ol + ul). */
  listItems: number;
  /** Human-readable notice (dropped content / poor heading+list coverage), if any. */
  notice?: string;
  /** mammoth warnings/errors, message text only (bounded). */
  messages: string[];
}

const ZIP_ERR = 'This DOCX file is empty or not a valid Word document (corrupt zip).';

function u16(b: Uint8Array, o: number): number {
  return b[o]! | (b[o + 1]! << 8);
}
function u32(b: Uint8Array, o: number): number {
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
}

interface ZipEntry {
  name: string;
  method: number;
  compressed: number;
  uncompressed: number;
  localOffset: number;
}

/** Bounded central-directory parse. Throws CoreError on any malformed or out-of-bounds field. */
export function readZipDirectory(b: Uint8Array): ZipEntry[] {
  if (b.byteLength < 22) throw new CoreError('unsupported_type', ZIP_ERR);
  // EOCD lives in the last 22 + 65535 (max comment) bytes.
  const stop = Math.max(0, b.byteLength - 22 - 0xffff);
  let eocd = -1;
  for (let i = b.byteLength - 22; i >= stop; i--) {
    if (u32(b, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new CoreError('unsupported_type', ZIP_ERR);
  const count = u16(b, eocd + 10);
  const cdSize = u32(b, eocd + 12);
  const cdOff = u32(b, eocd + 16);
  if (count === 0xffff || cdOff === 0xffffffff) {
    throw new CoreError('unsupported_type', 'ZIP64 DOCX archives are not supported.');
  }
  if (count > DOCX_LIMITS.maxEntries) {
    throw new CoreError(
      'payload_too_large',
      `DOCX archive has ${count} entries (limit ${DOCX_LIMITS.maxEntries}).`,
    );
  }
  if (cdOff + cdSize > eocd) throw new CoreError('unsupported_type', ZIP_ERR);
  const entries: ZipEntry[] = [];
  let p = cdOff;
  let declared = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > eocd || u32(b, p) !== 0x02014b50) throw new CoreError('unsupported_type', ZIP_ERR);
    const method = u16(b, p + 10);
    const compressed = u32(b, p + 20);
    const uncompressed = u32(b, p + 24);
    const nameLen = u16(b, p + 28);
    const extraLen = u16(b, p + 30);
    const commentLen = u16(b, p + 32);
    const localOffset = u32(b, p + 42);
    if (p + 46 + nameLen > eocd) throw new CoreError('unsupported_type', ZIP_ERR);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    declared += uncompressed;
    if (declared > DOCX_LIMITS.maxUncompressedBytes) {
      throw new CoreError(
        'payload_too_large',
        `DOCX content expands beyond ${DOCX_LIMITS.maxUncompressedBytes} bytes.`,
      );
    }
    entries.push({ name, method, compressed, uncompressed, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflatedSize(data: Uint8Array, budget: number): Promise<number> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  // Errors surface through reader.read(); swallow the duplicate writer rejections.
  writer.write(data as Uint8Array<ArrayBuffer>).catch(() => {});
  writer.close().catch(() => {});
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return total;
      total += value.byteLength;
      if (total > budget) {
        await reader.cancel().catch(() => {});
        return total;
      }
    }
  } catch {
    throw new CoreError('unsupported_type', ZIP_ERR);
  }
}

/**
 * Zip-bomb guard: inflate every entry with a streaming decoder and a shared byte budget, so the
 * archive is refused on what it ACTUALLY expands to, not on the (forgeable) header sizes.
 * Returns the real total uncompressed size.
 */
export async function guardZip(b: Uint8Array): Promise<number> {
  const entries = readZipDirectory(b);
  if (!entries.some((e) => e.name === 'word/document.xml')) {
    throw new CoreError('unsupported_type', 'This file is a zip but not a Word document.');
  }
  let total = 0;
  for (const e of entries) {
    const lo = e.localOffset;
    if (lo + 30 > b.byteLength || u32(b, lo) !== 0x04034b50) {
      throw new CoreError('unsupported_type', ZIP_ERR);
    }
    const start = lo + 30 + u16(b, lo + 26) + u16(b, lo + 28);
    const end = start + e.compressed;
    if (end > b.byteLength) throw new CoreError('unsupported_type', ZIP_ERR);
    const budget = DOCX_LIMITS.maxUncompressedBytes - total;
    if (e.method === 0) total += e.compressed;
    else if (e.method === 8) total += await inflatedSize(b.subarray(start, end), budget);
    else
      throw new CoreError('unsupported_type', `Unsupported DOCX compression method ${e.method}.`);
    if (total > DOCX_LIMITS.maxUncompressedBytes) {
      throw new CoreError(
        'payload_too_large',
        `DOCX content expands beyond ${DOCX_LIMITS.maxUncompressedBytes} bytes.`,
      );
    }
  }
  return total;
}

function roman(n: number): string {
  const t: Array<[number, string]> = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];
  let out = '';
  for (const [v, s] of t) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}
function letters(n: number): string {
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

/** Legal-style label for the n-th item (1-based) at ordered-list depth d (0-based). */
export function numberLabel(counters: readonly number[]): string {
  const d = counters.length - 1;
  const n = counters[d]!;
  if (d === 0) return `${n}.`;
  if (d === 1) return `${counters[0]}.${n}`;
  if (d === 2) return `(${letters(n)})`;
  if (d === 3) return `(${roman(n)})`;
  if (d === 4) return `(${letters(n).toUpperCase()})`;
  return `(${n})`;
}

const VOID = new Set(['br', 'img', 'hr']);
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s: string): string {
  return esc(s).replace(/"/g, '&quot;');
}

/**
 * Numbering pre-pass: re-serialize mammoth HTML, prefixing each `<li>` of an `<ol>` with its
 * reconstructed label. List nesting beyond MAX_FRAME_DEPTH gets no label (bounded state).
 */
export function reconstructNumbering(html: string): {
  html: string;
  labelled: number;
  items: number;
} {
  const out: string[] = [];
  /** One entry per open list: counter for ol, null for ul. */
  const lists: Array<number | null> = [];
  let labelled = 0;
  let items = 0;
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        const a = Object.entries(attrs)
          .map(([k, v]) => ` ${k}="${escAttr(v)}"`)
          .join('');
        out.push(`<${name}${a}>`);
        if (name === 'ol' || name === 'ul') {
          if (lists.length < MAX_FRAME_DEPTH) lists.push(name === 'ol' ? 0 : null);
          else lists.push(null);
        } else if (name === 'li') {
          items++;
          const top = lists.length - 1;
          if (top >= 0 && lists[top] !== null) {
            lists[top] = lists[top]! + 1;
            const counters = lists.filter((c): c is number => c !== null);
            out.push(`${esc(numberLabel(counters))} `);
            labelled++;
          }
        }
      },
      ontext(text) {
        out.push(esc(text));
      },
      onclosetag(name) {
        if (VOID.has(name)) return;
        out.push(`</${name}>`);
        if (name === 'ol' || name === 'ul') lists.pop();
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );
  parser.write(html);
  parser.end();
  return { html: out.join(''), labelled, items };
}

function toBytes(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

/** DOCX bytes -> Line stream via mammoth + numbering pre-pass + HTML adapter. */
export async function docxToLines(input: Uint8Array | ArrayBuffer): Promise<DocxAdapterResult> {
  const t0 = Date.now();
  const bytes = toBytes(input);
  if (bytes.byteLength === 0) throw new CoreError('unsupported_type', 'This DOCX file is empty.');
  if (bytes.byteLength > DOCX_LIMITS.maxBytes) {
    throw new CoreError('payload_too_large', `DOCX input exceeds ${DOCX_LIMITS.maxBytes} bytes`);
  }
  await guardZip(bytes);

  let converted: { value: string; messages: Array<{ type: string; message: string }> };
  try {
    // Node entry reads `buffer`; the browser entry (package.json "browser" field) reads
    // `arrayBuffer`. Pass both so one call works in vitest, the web worker and workerd.
    const copy = bytes.slice();
    const opts = { buffer: copy, arrayBuffer: copy.buffer } as unknown as {
      arrayBuffer: ArrayBuffer;
    };
    converted = await mammoth.convertToHtml(opts, {
      styleMap: [...DOCX_STYLE_MAP],
      // Drop embedded images (no base64 blow-up; alt text is kept).
      convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
    });
  } catch (e) {
    if (e instanceof CoreError) throw e;
    throw new CoreError('unsupported_type', ZIP_ERR);
  }

  const pre = reconstructNumbering(converted.value);
  const base = htmlToLines(pre.html);
  const messages = converted.messages
    .slice(0, 50)
    .map((m) => `${m.type}: ${m.message}`.slice(0, 300));
  const notices: string[] = [];
  const dropped = converted.messages.filter((m) => m.type === 'warning' || m.type === 'error');
  if (dropped.length) {
    notices.push(
      `${dropped.length} DOCX element(s) could not be converted and may be missing from the review.`,
    );
  }
  const headings = (pre.html.match(/<h[1-6][\s>]/g) ?? []).length;
  if (base.lines.length >= 20 && headings === 0 && pre.items === 0) {
    notices.push(
      'No Word headings or lists were found; section structure is inferred from text only.',
    );
  }
  if (pre.labelled > 0) {
    notices.push(
      'List numbering was reconstructed from the Word list structure and may differ from the original.',
    );
  }
  return {
    ...base,
    docHash: sha256Hex(bytes),
    bytes: bytes.byteLength,
    adapter_ms: Date.now() - t0,
    reconstructedNumbering: pre.labelled > 0,
    listItems: pre.items,
    ...(notices.length ? { notice: notices.join(' ') } : {}),
    messages,
  };
}
