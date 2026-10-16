// Bundled for Chromium by run.ts. Exposes timing probes on window.s07.
import { Parser } from 'htmlparser2';
import * as pdfjs from 'pdfjs-dist';

const TARGET_PX = 1200;

/** SAX parse + table-cell merge: each <tr> becomes one row of merged cell texts. */
function parseMerge(html: string): {
  rows: number;
  cells: number;
  textChars: number;
  mergedRows: number;
} {
  let rows = 0;
  let cells = 0;
  let textChars = 0;
  let inCell = false;
  let cell = '';
  let row: string[] = [];
  const merged: string[] = [];
  const parser = new Parser(
    {
      onopentag(name) {
        if (name === 'tr') row = [];
        if (name === 'td' || name === 'th') {
          inCell = true;
          cell = '';
        }
      },
      ontext(text) {
        textChars += text.length;
        if (inCell) cell += text;
      },
      onclosetag(name) {
        if (name === 'td' || name === 'th') {
          inCell = false;
          cells++;
          const t = cell.replace(/\s+/g, ' ').trim();
          if (t) row.push(t);
        }
        if (name === 'tr') {
          rows++;
          if (row.length) merged.push(row.join(' '));
        }
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  return { rows, cells, textChars, mergedRows: merged.length };
}

async function downscale(source: CanvasImageSource, w: number, h: number): Promise<number> {
  const scale = Math.min(1, TARGET_PX / Math.max(w, h));
  const canvas = new OffscreenCanvas(Math.round(w * scale), Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
  return blob.size;
}

async function renderPdf(url: string, workerSrc: string): Promise<number[]> {
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const doc = await pdfjs.getDocument({ url }).promise;
  const times: number[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const t0 = performance.now();
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: (TARGET_PX / Math.max(base.width, base.height)) * 1.5,
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    await downscale(canvas, canvas.width, canvas.height);
    times.push(performance.now() - t0);
  }
  return times;
}

async function downscaleJpegs(urls: string[]): Promise<number[]> {
  const times: number[] = [];
  for (const url of urls) {
    const blob = await (await fetch(url)).blob();
    const t0 = performance.now();
    const bmp = await createImageBitmap(blob);
    await downscale(bmp, bmp.width, bmp.height);
    bmp.close();
    times.push(performance.now() - t0);
  }
  return times;
}

async function timeParseMerge(url: string): Promise<{ ms: number; bytes: number; rows: number }> {
  const html = await (await fetch(url)).text();
  const t0 = performance.now();
  const r = parseMerge(html);
  return { ms: performance.now() - t0, bytes: html.length, rows: r.rows };
}

(window as unknown as { s07: unknown }).s07 = { timeParseMerge, renderPdf, downscaleJpegs };
