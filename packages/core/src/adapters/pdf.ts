import { limits } from '../config/limits';
import { CoreError } from '../model/errors';
import { sha256Hex } from '../model/hash';
import {
  pdfPagesToLines,
  type PdfLinesResult,
  type PdfTextItem,
  type PdfTextPage,
} from './pdf-text';
import { MIN_TEXT_CHARS, nonSpaceChars } from './pdf-text';

/**
 * PDF adapter (Phase 06 D4): unpdf (pdf.js 6.4.299) -> positioned text items -> pdf-text.ts.
 * Runs in Node and in a Web Worker (no DOM). Never renders pages; the core pdf.js API has no
 * scripting sandbox, so embedded PDF JavaScript is never run (pdf.js 6 has no
 * `isEvalSupported` option any more), and XFA forms stay disabled. PDFs never leave this process: scan pages are only
 * reported by index (`scanPages`) so the web app can render and OCR them as images.
 *
 * Checks, in order, before any page is parsed: empty, size (limits.maxUploadBytes), %PDF-
 * magic, open (encrypted / corrupt), page count 1..limits.maxScanPages.
 */

export interface PdfAdapterOptions {
  /**
   * Optional pdf.js module loader handed to unpdf's `definePDFJSModule` (e.g. the web bundle's
   * `() => import('pdfjs-dist')`, so only one pdf.js ships). Default: unpdf's bundled pdf.js.
   */
  pdfjs?: () => Promise<unknown>;
  /** Per-page progress (pages done, total). */
  onPage?: (done: number, total: number) => void;
}

export interface PdfAdapterResult extends PdfLinesResult {
  docHash: string;
  bytes: number;
  pageCount: number;
  adapter_ms: number;
}

const PDF_MAGIC = '%PDF-';

export const PDF_MESSAGES = {
  empty: 'The PDF file is empty.',
  notPdf: 'The file is not a PDF.',
  encrypted: 'This PDF is password-protected. Remove the password and upload it again.',
  corrupt: 'This PDF is damaged or not a valid PDF file.',
  noPages: 'The PDF has no pages.',
} as const;

function tooManyPages(n: number) {
  return new CoreError(
    'payload_too_large',
    `The PDF has ${n} pages; the limit is ${limits.maxScanPages} pages.`,
  );
}

/** Minimal structural view of what this adapter reads from pdf.js (keeps the seam explicit). */
interface PdfPage {
  getViewport(o: { scale: number }): {
    width: number;
    height: number;
    convertToViewportPoint(x: number, y: number): number[];
  };
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<unknown>;
  commonObjs: { has(id: string): boolean; get(id: string): unknown };
  cleanup(): unknown;
}
interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  /** pdf.js 6: the document is released through its loading task. */
  loadingTask: { destroy(): Promise<void> };
}

interface RawItem {
  str?: unknown;
  transform?: unknown;
  width?: unknown;
  height?: unknown;
  fontName?: unknown;
}

function isBoldFont(page: PdfPage, fontName: string, cache: Map<string, boolean>): boolean {
  const hit = cache.get(fontName);
  if (hit !== undefined) return hit;
  let bold = false;
  try {
    if (page.commonObjs.has(fontName)) {
      const f = page.commonObjs.get(fontName) as { bold?: unknown; name?: unknown } | null;
      bold = f?.bold === true || (typeof f?.name === 'string' && /bold|black|heavy/i.test(f.name));
    }
  } catch {
    bold = false;
  }
  cache.set(fontName, bold);
  return bold;
}

function toItems(page: PdfPage, raw: unknown[], withFonts: boolean): PdfTextItem[] {
  const vp = page.getViewport({ scale: 1 });
  const fonts = new Map<string, boolean>();
  const out: PdfTextItem[] = [];
  for (const r of raw as RawItem[]) {
    if (typeof r.str !== 'string' || !Array.isArray(r.transform)) continue;
    const t = r.transform as number[];
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = t;
    const size = typeof r.height === 'number' && r.height > 0 ? r.height : Math.hypot(c, d);
    // Map the run's origin and its advance end through the viewport (handles rotation/offsets).
    const [x, y] = vp.convertToViewportPoint(e, f) as [number, number];
    const width = typeof r.width === 'number' ? r.width : 0;
    const len = Math.hypot(a, b) || 1;
    const [x2] = vp.convertToViewportPoint(e + (a / len) * width, f + (b / len) * width) as [
      number,
    ];
    out.push({
      str: r.str,
      x: Math.min(x, x2),
      y,
      w: Math.abs(x2 - x),
      h: size,
      bold:
        withFonts && typeof r.fontName === 'string' ? isBoldFont(page, r.fontName, fonts) : false,
    });
  }
  return out;
}

function classifyOpenError(err: unknown): CoreError {
  const name = (err as { name?: unknown } | null)?.name;
  if (name === 'PasswordException')
    return new CoreError('unsupported_type', PDF_MESSAGES.encrypted);
  return new CoreError('invalid_request', PDF_MESSAGES.corrupt);
}

/** Open a PDF and return its lines plus the 0-based indices of pages that need OCR. */
export async function pdfToLines(
  bytes: Uint8Array,
  opts: PdfAdapterOptions = {},
): Promise<PdfAdapterResult> {
  const t0 = Date.now();
  if (bytes.byteLength === 0) throw new CoreError('invalid_request', PDF_MESSAGES.empty);
  if (bytes.byteLength > limits.maxUploadBytes) {
    throw new CoreError(
      'payload_too_large',
      `The PDF is larger than ${limits.maxUploadBytes / (1024 * 1024)} MB.`,
    );
  }
  for (let i = 0; i < PDF_MAGIC.length; i++) {
    if (bytes[i] !== PDF_MAGIC.charCodeAt(i))
      throw new CoreError('unsupported_type', PDF_MESSAGES.notPdf);
  }
  const docHash = sha256Hex(bytes);

  // Lazy: HTML-only consumers never load pdf.js.
  const unpdf = await import('unpdf');
  if (opts.pdfjs)
    await unpdf.definePDFJSModule(opts.pdfjs as Parameters<typeof unpdf.definePDFJSModule>[0]);

  let doc: PdfDoc;
  try {
    // pdf.js may transfer (detach) the buffer it is given: hand it a copy.
    doc = (await unpdf.getDocumentProxy(bytes.slice(), {
      verbosity: 0,
      disableFontFace: true,
      useSystemFonts: false,
      enableXfa: false,
    })) as unknown as PdfDoc;
  } catch (err) {
    throw classifyOpenError(err);
  }

  try {
    const total = doc.numPages;
    if (!Number.isInteger(total) || total < 1)
      throw new CoreError('invalid_request', PDF_MESSAGES.noPages);
    if (total > limits.maxScanPages) throw tooManyPages(total);
    const pages: PdfTextPage[] = [];
    for (let n = 1; n <= total; n++) {
      let page: PdfPage;
      let raw: unknown[];
      try {
        page = await doc.getPage(n);
        raw = (await page.getTextContent()).items;
      } catch {
        throw new CoreError('invalid_request', PDF_MESSAGES.corrupt);
      }
      const vp = page.getViewport({ scale: 1 });
      let items = toItems(page, raw, false);
      if (nonSpaceChars(items) >= MIN_TEXT_CHARS) {
        // Fonts (bold) resolve only after the operator list is built; text pages only.
        try {
          await page.getOperatorList();
          items = toItems(page, raw, true);
        } catch {
          /* keep the items without bold cues */
        }
      }
      pages.push({ index: n - 1, width: vp.width, height: vp.height, items });
      page.cleanup();
      opts.onPage?.(n, total);
    }
    const result = pdfPagesToLines(pages);
    return {
      ...result,
      docHash,
      bytes: bytes.byteLength,
      pageCount: total,
      adapter_ms: Date.now() - t0,
    };
  } finally {
    await doc.loadingTask.destroy().catch(() => undefined);
  }
}
