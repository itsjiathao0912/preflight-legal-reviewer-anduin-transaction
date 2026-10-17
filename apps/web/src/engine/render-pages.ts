/**
 * Main-thread page rendering for OCR (Phase 06 D3/D4): only scan pages are rendered.
 *  - PDF scan pages: pdfjs-dist canvas render, downscaled so the long side is ~1600 px
 *  - JPEG / PNG uploads: size read from the file header BEFORE decode (decompression-bomb guard),
 *    then createImageBitmap + canvas downscale
 * Every page is re-encoded as JPEG quality 0.8, which also strips EXIF / GPS metadata before the
 * image leaves the browser. The PDF itself never leaves the browser: only these JPEGs do.
 * No @aduin/core values are imported here (import-graph rule).
 */

/** Long side of the image sent to OCR (D5: ~1600 px). */
export const RENDER_MAX_PX = 1600;
export const RENDER_JPEG_QUALITY = 0.8;
/** Refuse images whose header says more pixels than this (decode would be a memory bomb). */
export const MAX_SOURCE_PIXELS = 60_000_000;
/** Cache-key parameter string for the render settings (Public Contracts: params(width,quality)). */
export const RENDER_PARAMS = `w${RENDER_MAX_PX}q${Math.round(RENDER_JPEG_QUALITY * 100)}`;

export interface RenderedPage {
  /** 0-based page index. */
  index: number;
  /** Re-encoded JPEG (EXIF stripped). */
  jpeg: Blob;
  width: number;
  height: number;
}

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderError';
  }
}

/** Downscale factor so the long side fits RENDER_MAX_PX (never upscales). */
export function fitScale(width: number, height: number, max = RENDER_MAX_PX): number {
  const long = Math.max(width, height);
  return long > max ? max / long : 1;
}

export type ImageKind = 'jpeg' | 'png';

/** Magic bytes of a JPEG or PNG; null for anything else (PDF, SVG, ...). */
export function imageKindOf(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 8 && png.every((v, i) => b[i] === v)) return 'png';
  return null;
}

/** Image size from the file header (PNG IHDR / JPEG SOFn) without decoding; null if unreadable. */
export function imageSizeOf(b: Uint8Array): { width: number; height: number } | null {
  const kind = imageKindOf(b);
  if (kind === 'png') {
    if (b.length < 24) return null;
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (kind === 'jpeg') {
    let i = 2;
    // bounded scan over marker segments
    for (let steps = 0; i + 9 < b.length && steps < 10_000; steps++) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1]!;
      if (marker === 0xff) {
        i++;
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = (b[i + 2]! << 8) | b[i + 3]!;
      const sof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (sof) {
        return { height: (b[i + 5]! << 8) | b[i + 6]!, width: (b[i + 7]! << 8) | b[i + 8]! };
      }
      if (len < 2) return null;
      i += 2 + len;
    }
  }
  return null;
}

interface Canvas2D {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}

function makeCanvas(width: number, height: number): Canvas2D {
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d') as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new RenderError('This browser cannot draw page images.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

async function toJpeg(c: Canvas2D): Promise<Blob> {
  if ('convertToBlob' in c.canvas) {
    return c.canvas.convertToBlob({ type: 'image/jpeg', quality: RENDER_JPEG_QUALITY });
  }
  const el = c.canvas;
  return new Promise<Blob>((resolve, reject) =>
    el.toBlob(
      (b) => (b ? resolve(b) : reject(new RenderError('The page image could not be encoded.'))),
      'image/jpeg',
      RENDER_JPEG_QUALITY,
    ),
  );
}

/** Downscale + re-encode one JPEG/PNG upload (one page). */
export async function renderImage(bytes: Uint8Array, index = 0): Promise<RenderedPage> {
  const kind = imageKindOf(bytes);
  if (!kind) throw new RenderError('This image is not a JPEG or PNG file.');
  const size = imageSizeOf(bytes);
  if (!size || size.width < 1 || size.height < 1)
    throw new RenderError('This image could not be read.');
  if (size.width * size.height > MAX_SOURCE_PIXELS)
    throw new RenderError('This image is too large to process.');
  const bitmap = await createImageBitmap(
    new Blob([bytes.slice()], { type: kind === 'jpeg' ? 'image/jpeg' : 'image/png' }),
  );
  try {
    const s = fitScale(bitmap.width, bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * s));
    const height = Math.max(1, Math.round(bitmap.height * s));
    const c = makeCanvas(width, height);
    c.ctx.drawImage(bitmap, 0, 0, width, height);
    return { index, jpeg: await toJpeg(c), width, height };
  } finally {
    bitmap.close();
  }
}

interface PdfjsPage {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: {
    canvas: HTMLCanvasElement | OffscreenCanvas | null;
    canvasContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    viewport: unknown;
  }): { promise: Promise<void> };
  cleanup(): void;
}
interface PdfjsDoc {
  numPages: number;
  getPage(n: number): Promise<PdfjsPage>;
  loadingTask?: { destroy(): Promise<void> };
  destroy?: () => Promise<void>;
}

/**
 * Render the given 0-based PDF pages (scan pages only) to downscaled JPEGs, one at a time to
 * bound memory. `onPage` reports each finished page. pdf.js runs in its own worker.
 */
export async function renderPdfPages(
  bytes: Uint8Array,
  pages: readonly number[],
  onPage?: (p: RenderedPage) => void,
): Promise<RenderedPage[]> {
  const [pdfjs, workerUrl] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
    verbosity: 0,
  });
  const doc = (await task.promise) as unknown as PdfjsDoc;
  const out: RenderedPage[] = [];
  try {
    for (const index of pages) {
      if (!Number.isInteger(index) || index < 0 || index >= doc.numPages) continue;
      const page = await doc.getPage(index + 1);
      const base = page.getViewport({ scale: 1 });
      // PDF units are points: always render so the long side is RENDER_MAX_PX (bounded canvas,
      // whatever the declared page size is)
      const long = Math.max(base.width, base.height);
      if (!(long > 0)) continue;
      const viewport = page.getViewport({ scale: RENDER_MAX_PX / long });
      const width = Math.max(1, Math.floor(viewport.width));
      const height = Math.max(1, Math.floor(viewport.height));
      const c = makeCanvas(width, height);
      await page.render({ canvas: null, canvasContext: c.ctx, viewport }).promise;
      const r = { index, jpeg: await toJpeg(c), width, height };
      page.cleanup();
      out.push(r);
      onPage?.(r);
    }
  } finally {
    await task.destroy();
  }
  return out;
}
