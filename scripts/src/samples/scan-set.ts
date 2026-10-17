/**
 * Sample #9 scan set (Phase 06f, D5): the 22 raw JPEG pages of `samples/sub-docs/raw/09-rw-holdings-scans/`
 * downscaled so the long side is 1600 px (JPEG quality 80) into `apps/web/public/samples/09-rw-holdings-scans/pNN.jpg`.
 *
 * - Page order: Appendix A-1 pages 1-8, Appendix A-2 pages 1-10, Appendix B pages 1-4 (numeric).
 * - `sourceHash` = sha256 of the ORIGINAL raw bytes (canvas / encoder output is not a stable key).
 * - Downscale uses jpeg-js (BSD-3-Clause) with an area-average filter; output is deterministic.
 * - Idempotent: a stamp file records the params + source hashes, and unchanged pages are skipped.
 *
 * Raw pages are untrusted input: decoded with a memory cap, never executed.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import jpeg from 'jpeg-js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const SCAN_SET_ID = '09';
export const SCAN_RAW_DIR = join(ROOT, 'samples', 'sub-docs', 'raw', '09-rw-holdings-scans');
export const SCAN_OUT_DIR = join(ROOT, 'apps', 'web', 'public', 'samples', '09-rw-holdings-scans');
/** Public URL prefix of the downscaled pages. */
export const SCAN_URL_PREFIX = '09-rw-holdings-scans';
export const SCAN_MAX_PX = 1600;
export const SCAN_JPEG_QUALITY = 80;
/** Same params string as the web render path (`render-pages.ts` RENDER_PARAMS). */
export const SCAN_PARAMS = `w${SCAN_MAX_PX}q${SCAN_JPEG_QUALITY}`;
const STAMP = '.stamp.json';
const MAX_DECODE_MB = 512;
const RAW_NAME_RE = /^(appa1|appa2|appb)-pg(\d{1,2})\.jpg$/;
const GROUP_ORDER = ['appa1', 'appa2', 'appb'];

export interface ScanPage {
  /** 1-based page number in the set. */
  n: number;
  /** Raw file name. */
  raw: string;
  /** Downscaled file name, e.g. p01.jpg. */
  file: string;
  /** sha256 hex of the original raw bytes. */
  sourceHash: string;
}

export function hashHex(b: Uint8Array): string {
  return createHash('sha256').update(b).digest('hex');
}

/** Ordered page list with original-bytes hashes. */
export function scanPages(rawDir: string = SCAN_RAW_DIR): ScanPage[] {
  const names = readdirSync(rawDir).filter((f) => RAW_NAME_RE.test(f));
  names.sort((a, b) => {
    const ma = RAW_NAME_RE.exec(a)!;
    const mb = RAW_NAME_RE.exec(b)!;
    const g = GROUP_ORDER.indexOf(ma[1]!) - GROUP_ORDER.indexOf(mb[1]!);
    return g !== 0 ? g : Number(ma[2]) - Number(mb[2]);
  });
  return names.map((raw, i) => ({
    n: i + 1,
    raw,
    file: `p${String(i + 1).padStart(2, '0')}.jpg`,
    sourceHash: hashHex(new Uint8Array(readFileSync(join(rawDir, raw)))),
  }));
}

/** Area-average downscale of RGBA pixels so the long side is at most `maxPx` (never upscales). */
export function downscaleRgba(
  src: Uint8Array,
  w: number,
  h: number,
  maxPx: number = SCAN_MAX_PX,
): { data: Uint8Array; width: number; height: number } {
  const long = Math.max(w, h);
  if (long <= maxPx) return { data: src, width: w, height: h };
  const s = maxPx / long;
  const ow = Math.max(1, Math.round(w * s));
  const oh = Math.max(1, Math.round(h * s));
  const out = new Uint8Array(ow * oh * 4);
  for (let oy = 0; oy < oh; oy++) {
    const y0 = Math.floor((oy * h) / oh);
    const y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * h) / oh));
    for (let ox = 0; ox < ow; ox++) {
      const x0 = Math.floor((ox * w) / ow);
      const x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * w) / ow));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        let i = (y * w + x0) * 4;
        for (let x = x0; x < x1; x++, i += 4) {
          r += src[i]!;
          g += src[i + 1]!;
          b += src[i + 2]!;
          n++;
        }
      }
      const o = (oy * ow + ox) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  }
  return { data: out, width: ow, height: oh };
}

/** Decode a JPEG (memory-capped), downscale, re-encode (metadata is not carried over). */
export function downscaleJpeg(
  bytes: Uint8Array,
  maxPx: number = SCAN_MAX_PX,
  quality: number = SCAN_JPEG_QUALITY,
): { jpeg: Uint8Array; width: number; height: number } {
  const img = jpeg.decode(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxMemoryUsageInMB: MAX_DECODE_MB,
    maxResolutionInMP: 60,
  });
  const d = downscaleRgba(img.data, img.width, img.height, maxPx);
  const enc = jpeg.encode({ data: d.data, width: d.width, height: d.height }, quality);
  return { jpeg: new Uint8Array(enc.data), width: d.width, height: d.height };
}

interface Stamp {
  params: string;
  pages: Record<string, string>;
}

/** Write the downscaled pages (skips pages whose source hash and params are unchanged). */
export function buildScanSet(
  outDir: string = SCAN_OUT_DIR,
  rawDir: string = SCAN_RAW_DIR,
): { pages: ScanPage[]; written: number; totalBytes: number } {
  const pages = scanPages(rawDir);
  mkdirSync(outDir, { recursive: true });
  const stampPath = join(outDir, STAMP);
  let stamp: Stamp = { params: SCAN_PARAMS, pages: {} };
  try {
    const s = JSON.parse(readFileSync(stampPath, 'utf8')) as Stamp;
    if (s && s.params === SCAN_PARAMS && s.pages && typeof s.pages === 'object') stamp = s;
  } catch {
    /* no stamp yet */
  }
  let written = 0;
  let totalBytes = 0;
  for (const p of pages) {
    const out = join(outDir, p.file);
    if (!(existsSync(out) && stamp.pages[p.file] === p.sourceHash)) {
      const r = downscaleJpeg(new Uint8Array(readFileSync(join(rawDir, p.raw))));
      writeFileSync(out, r.jpeg);
      stamp.pages[p.file] = p.sourceHash;
      written++;
    }
    totalBytes += readFileSync(out).byteLength;
  }
  writeFileSync(stampPath, JSON.stringify(stamp, null, 2) + '\n');
  return { pages, written, totalBytes };
}
