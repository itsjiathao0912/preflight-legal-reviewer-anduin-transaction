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
 * Boundaries: 10 MB input cap, then a bounded zip inspection (strict central directory parse +
 * streamed inflate under a 20 MB per-entry and 64 MB total budget). The verified entries are
 * re-packed into a canonical STORE zip and ONLY that is handed to mammoth/JSZip, so no ZIP64,
 * gap or duplicate trick can make JSZip read different entries. Empty / corrupt -> CoreError.
 */

export const RECONSTRUCTED_NUMBERING_LABEL = 'based on reconstructed numbering';

/**
 * Issue classes whose evidence depends on section/list numbers. On a DOCX with reconstructed
 * numbering these findings carry RECONSTRUCTED_NUMBERING_LABEL on the finding view (additive
 * view field in the web engine worker; the frozen Finding contract is unchanged).
 */
export const NUMBERING_DEPENDENT_CLASSES: readonly string[] = [
  'broken_cross_reference',
  'broken_conditional',
  'unreachable_or_circular_flow',
];

/** The label to show on a finding from a DOCX with reconstructed numbering, if any. */
export function numberingLabelFor(
  issueClass: string,
  reconstructedNumbering: boolean,
): string | undefined {
  return reconstructedNumbering && NUMBERING_DEPENDENT_CLASSES.includes(issueClass)
    ? RECONSTRUCTED_NUMBERING_LABEL
    : undefined;
}

/** Zip guard caps (a real sub-doc DOCX is a few MB uncompressed and < 200 entries). */
export const DOCX_LIMITS = {
  maxBytes: limits.maxUploadBytes,
  maxEntries: 2000,
  maxUncompressedBytes: 64 * 1024 * 1024,
  /** Per-entry cap for EVERY part (mammoth/JSZip load each one whole into memory). */
  maxEntryBytes: 20 * 1024 * 1024,
  /** @deprecated alias of maxEntryBytes (the cap now applies to every entry). */
  maxDocumentXmlBytes: 20 * 1024 * 1024,
} as const;

const DOCUMENT_XML = 'word/document.xml';

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

/** ZIP64 / multi-disk signatures: a canonical DOCX never needs them and JSZip honours them. */
const ZIP64_SIGS = [0x06064b50, 0x07064b50] as const;

/** Name normalization used for duplicate detection (what any reader might treat as "the same"). */
export function normalizeEntryName(name: string): string {
  let n = name.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  for (;;) {
    if (n.startsWith('./')) n = n.slice(2);
    else if (n.startsWith('/')) n = n.slice(1);
    else break;
  }
  return n.toLowerCase();
}

function perEntryCapError(name: string): CoreError {
  return new CoreError(
    'payload_too_large',
    name === DOCUMENT_XML
      ? `The DOCX main document expands beyond ${DOCX_LIMITS.maxEntryBytes} bytes.`
      : `A DOCX part expands beyond ${DOCX_LIMITS.maxEntryBytes} bytes.`,
  );
}
function totalCapError(): CoreError {
  return new CoreError(
    'payload_too_large',
    `DOCX content expands beyond ${DOCX_LIMITS.maxUncompressedBytes} bytes.`,
  );
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
  const disk = u16(b, eocd + 4);
  const cdDisk = u16(b, eocd + 6);
  const onDisk = u16(b, eocd + 8);
  const count = u16(b, eocd + 10);
  const cdSize = u32(b, eocd + 12);
  const cdOff = u32(b, eocd + 16);
  // Review F1 bypass A: any 0xffff / 0xffffffff sentinel or a ZIP64 record switches JSZip into
  // ZIP64 mode and it reads a central directory this guard never saw. Refuse them all.
  if (
    count === 0xffff ||
    onDisk === 0xffff ||
    disk === 0xffff ||
    cdDisk === 0xffff ||
    cdSize === 0xffffffff ||
    cdOff === 0xffffffff
  ) {
    throw new CoreError('unsupported_type', 'ZIP64 DOCX archives are not supported.');
  }
  // JSZip looks for the ZIP64 locator right before the EOCD; the directory region and the
  // tail are scanned (not compressed data, where 4 random bytes could false-positive).
  const scanFrom = Math.min(cdOff, Math.max(0, eocd - 20));
  for (let i = scanFrom; i + 4 <= b.byteLength; i++) {
    const sig = u32(b, i);
    if (sig === ZIP64_SIGS[0] || sig === ZIP64_SIGS[1]) {
      throw new CoreError('unsupported_type', 'ZIP64 DOCX archives are not supported.');
    }
  }
  if (disk !== 0 || cdDisk !== 0 || onDisk !== count) {
    throw new CoreError('unsupported_type', 'Multi-disk DOCX archives are not supported.');
  }
  if (count > DOCX_LIMITS.maxEntries) {
    throw new CoreError(
      'payload_too_large',
      `DOCX archive has ${count} entries (limit ${DOCX_LIMITS.maxEntries}).`,
    );
  }
  // Review F1 bypass B: the central directory must end exactly at the EOCD. A gap makes JSZip
  // shift every offset and read a hidden directory at eocd - cdSize.
  if (cdOff + cdSize !== eocd) throw new CoreError('unsupported_type', ZIP_ERR);
  const entries: ZipEntry[] = [];
  const names = new Set<string>();
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
    // Duplicate names (after normalization) let another reader pick a different entry.
    const norm = normalizeEntryName(name);
    if (names.has(norm)) {
      throw new CoreError('unsupported_type', 'This DOCX archive has duplicate entry names.');
    }
    names.add(norm);
    if (uncompressed > DOCX_LIMITS.maxEntryBytes) throw perEntryCapError(name);
    declared += uncompressed;
    if (declared > DOCX_LIMITS.maxUncompressedBytes) throw totalCapError();
    entries.push({ name, method, compressed, uncompressed, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  // The EOCD count must describe the WHOLE central directory.
  if (p !== eocd) throw new CoreError('unsupported_type', ZIP_ERR);
  return entries;
}

/** Inflate fully, refusing past `budget` bytes. Returns null when the budget is exceeded. */
async function inflateBounded(data: Uint8Array, budget: number): Promise<Uint8Array | null> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  // Errors surface through reader.read(); swallow the duplicate writer rejections.
  writer.write(data as Uint8Array<ArrayBuffer>).catch(() => {});
  writer.close().catch(() => {});
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > budget) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    throw new CoreError('unsupported_type', ZIP_ERR);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

export interface VerifiedEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Zip-bomb guard: inflate every entry with a streaming decoder under a per-entry cap and a
 * shared total budget, so the archive is refused on what it ACTUALLY expands to. Returns the
 * verified entries (name -> bytes) in central-directory order; total bytes <= 64 MB.
 */
export async function verifyZipEntries(b: Uint8Array): Promise<VerifiedEntry[]> {
  const entries = readZipDirectory(b);
  if (!entries.some((e) => e.name === DOCUMENT_XML)) {
    throw new CoreError('unsupported_type', 'This file is a zip but not a Word document.');
  }
  const out: VerifiedEntry[] = [];
  let total = 0;
  for (const e of entries) {
    const lo = e.localOffset;
    if (lo + 30 > b.byteLength || u32(b, lo) !== 0x04034b50) {
      throw new CoreError('unsupported_type', ZIP_ERR);
    }
    const start = lo + 30 + u16(b, lo + 26) + u16(b, lo + 28);
    const end = start + e.compressed;
    if (end > b.byteLength) throw new CoreError('unsupported_type', ZIP_ERR);
    const remaining = DOCX_LIMITS.maxUncompressedBytes - total;
    const budget = Math.min(remaining, DOCX_LIMITS.maxEntryBytes);
    let data: Uint8Array | null;
    if (e.method === 0) {
      data = e.compressed <= budget ? b.slice(start, end) : null;
    } else if (e.method === 8) {
      data = await inflateBounded(b.subarray(start, end), budget);
    } else {
      throw new CoreError('unsupported_type', `Unsupported DOCX compression method ${e.method}.`);
    }
    if (data === null) {
      throw remaining < DOCX_LIMITS.maxEntryBytes ? totalCapError() : perEntryCapError(e.name);
    }
    total += data.byteLength;
    if (total > DOCX_LIMITS.maxUncompressedBytes) throw totalCapError();
    out.push({ name: e.name, data });
  }
  return out;
}

/** Back-compat wrapper: verify and return the real total uncompressed size. */
export async function guardZip(b: Uint8Array): Promise<number> {
  const entries = await verifyZipEntries(b);
  return entries.reduce((n, e) => n + e.data.byteLength, 0);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.byteLength; i++) c = CRC_TABLE[(c ^ d[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Re-pack verified entries into a canonical zip: STORE only, fresh local headers + central
 * directory + EOCD, CRC-32, no ZIP64, no extra fields, no comments, input order preserved.
 * mammoth/JSZip only ever see these bytes, so no parser differential with the guard remains.
 * Size <= 64 MB of content + small per-entry headers (entries <= 2000).
 */
export function repackZip(entries: readonly VerifiedEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const names = entries.map((e) => enc.encode(e.name));
  let size = 22;
  entries.forEach((e, i) => (size += 30 + 46 + 2 * names[i]!.byteLength + e.data.byteLength));
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  const offsets: number[] = [];
  const crcs: number[] = [];
  let p = 0;
  entries.forEach((e, i) => {
    const nm = names[i]!;
    const crc = crc32(e.data);
    offsets.push(p);
    crcs.push(crc);
    dv.setUint32(p, 0x04034b50, true);
    dv.setUint16(p + 4, 20, true); // version needed
    dv.setUint16(p + 6, 0x0800, true); // UTF-8 names
    dv.setUint16(p + 8, 0, true); // STORE
    dv.setUint32(p + 14, crc, true);
    dv.setUint32(p + 18, e.data.byteLength, true);
    dv.setUint32(p + 22, e.data.byteLength, true);
    dv.setUint16(p + 26, nm.byteLength, true);
    out.set(nm, p + 30);
    out.set(e.data, p + 30 + nm.byteLength);
    p += 30 + nm.byteLength + e.data.byteLength;
  });
  const cdOff = p;
  entries.forEach((e, i) => {
    const nm = names[i]!;
    dv.setUint32(p, 0x02014b50, true);
    dv.setUint16(p + 4, 20, true);
    dv.setUint16(p + 6, 20, true);
    dv.setUint16(p + 8, 0x0800, true);
    dv.setUint16(p + 10, 0, true);
    dv.setUint32(p + 16, crcs[i]!, true);
    dv.setUint32(p + 20, e.data.byteLength, true);
    dv.setUint32(p + 24, e.data.byteLength, true);
    dv.setUint16(p + 28, nm.byteLength, true);
    dv.setUint32(p + 42, offsets[i]!, true);
    out.set(nm, p + 46);
    p += 46 + nm.byteLength;
  });
  dv.setUint32(p, 0x06054b50, true);
  dv.setUint16(p + 8, entries.length, true);
  dv.setUint16(p + 10, entries.length, true);
  dv.setUint32(p + 12, p - cdOff, true);
  dv.setUint32(p + 16, cdOff, true);
  return out;
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

/** Top-level list items up to this many characters (label excluded) may be headings. */
export const HEADING_ITEM_MAX_CHARS = 80;
/** A heading-like item has no terminal sentence punctuation. */
export const TERMINAL_PUNCT_RE = /[.;:!?,]\s{0,8}$/;

/**
 * Short top-level numbered item ("1. Definitions") with no terminal sentence punctuation: Word
 * often numbers section titles with the list engine instead of a Heading style. mammoth drops
 * the bold run formatting of the list paragraph, so the structurer would see a plain list item.
 */
export function isHeadingLikeItem(text: string): boolean {
  const t = text.replace(/\s{1,4000}/g, ' ').trim();
  return t.length > 0 && t.length <= HEADING_ITEM_MAX_CHARS && !TERMINAL_PUNCT_RE.test(t);
}

/**
 * Numbering pre-pass: re-serialize mammoth HTML, prefixing each `<li>` of an `<ol>` with its
 * reconstructed label. List nesting beyond MAX_FRAME_DEPTH gets no label (bounded state).
 * Heading-like top-level `<ol>` items (isHeadingLikeItem on the item's own text, before any
 * nested list) are wrapped in `<strong>` so the HTML adapter gives them a bold cue and the
 * structurer opens a section for them (06d xref fix; numbering still labelled "reconstructed").
 */
export function reconstructNumbering(html: string): {
  html: string;
  labelled: number;
  items: number;
  headings: number;
} {
  const out: string[] = [];
  /** One entry per open list: counter for ol, null for ul. */
  const lists: Array<number | null> = [];
  let labelled = 0;
  let items = 0;
  let headings = 0;
  /** Open top-level ol item being considered as a heading: output index + its own text. */
  let pending: { at: number; text: string; blocked: boolean } | null = null;
  const finalize = () => {
    if (!pending) return;
    if (!pending.blocked && isHeadingLikeItem(pending.text)) {
      out[pending.at] = `<strong>${out[pending.at]!}`;
      out.push('</strong>');
      headings++;
    }
    pending = null;
  };
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (pending && (name === 'ol' || name === 'ul' || name === 'li')) finalize();
        else if (pending && name !== 'strong' && name !== 'b' && name !== 'em' && name !== 'i')
          pending.blocked = true;
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
            if (lists.length === 1) pending = { at: out.length - 1, text: '', blocked: false };
          }
        }
      },
      ontext(text) {
        if (pending) {
          if (pending.text.length <= HEADING_ITEM_MAX_CHARS * 4) pending.text += text;
          else pending.blocked = true;
        }
        out.push(esc(text));
      },
      onclosetag(name) {
        if (VOID.has(name)) return;
        if (pending && (name === 'li' || name === 'ol' || name === 'ul')) finalize();
        out.push(`</${name}>`);
        if (name === 'ol' || name === 'ul') lists.pop();
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );
  parser.write(html);
  parser.end();
  finalize();
  return { html: out.join(''), labelled, items, headings };
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
  // Review F1: mammoth never sees the uploaded bytes, only a canonical re-pack of the entries
  // the guard actually inflated and measured (no parser differential possible).
  const canonical = repackZip(await verifyZipEntries(bytes));

  let converted: { value: string; messages: Array<{ type: string; message: string }> };
  try {
    // Node entry reads `buffer`; the browser entry (package.json "browser" field) reads
    // `arrayBuffer`. Pass both so one call works in vitest, the web worker and workerd.
    const copy = canonical;
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
