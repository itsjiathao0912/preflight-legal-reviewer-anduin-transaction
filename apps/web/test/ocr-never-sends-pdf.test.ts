import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { setApiBaseValue } from '../src/api/base';
import {
  buildOcrBody,
  NotAnImageError,
  OCR_CONCURRENCY,
  OCR_UNAVAILABLE_BUILD,
  OCR_UNAVAILABLE_LIMIT,
  ocrKeyParts,
  ocrPageKey,
  runOcrQueue,
  type OcrCache,
  type OcrJob,
  type OcrLines,
} from '../src/engine/ocr-queue';
import {
  imageKindOf,
  imageSizeOf,
  RENDER_PARAMS,
  type RenderedPage,
} from '../src/engine/render-pages';

// Phase 06 (web side of AC1 support): the render/OCR path only ever posts page images.
const PDF = new TextEncoder().encode('%PDF-1.4\n1 0 obj << >> endobj\n%%EOF');
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0xff, 0xd9,
]);
const HASH = 'a'.repeat(64);

const page = (index: number, bytes: Uint8Array, type = 'image/jpeg'): RenderedPage => ({
  index,
  jpeg: new Blob([bytes.slice()], { type }),
  width: 10,
  height: 10,
});

function memCache(): OcrCache & { map: Map<string, OcrLines> } {
  const map = new Map<string, OcrLines>();
  return {
    map,
    get: async (k) => map.get(k) ?? null,
    put: async (k, v) => void map.set(k, v),
  };
}

interface Call {
  url: string;
  body: unknown;
}

function fakeFetch(calls: Call[], opts: { delayMs?: number; frame?: unknown } = {}) {
  let inFlight = 0;
  let maxInFlight = 0;
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/precomputed/')) return new Response('not found', { status: 404 });
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    await new Promise((r) => setTimeout(r, opts.delayMs ?? 0));
    inFlight--;
    const frame = opts.frame ?? {
      t: 'result',
      kind: 'ocr',
      cache: 'miss',
      model: 'nvidia/nemotron-3.5-super-vl:free',
      data: { v: 1, pages: [{ index: 0, lines: [{ text: '☐ Trust ^{2}', conf: 0.9 }] }] },
    };
    return new Response(`${JSON.stringify({ t: 'hb' })}\n${JSON.stringify(frame)}\n`, {
      status: 200,
      headers: { 'content-type': 'application/x-ndjson' },
    });
  }) as typeof fetch;
  return { fn, max: () => maxInFlight };
}

afterEach(() => setApiBaseValue('/'));

describe('ocr-never-sends-pdf', () => {
  it('should never send a pdf to the OCR endpoint', async () => {
    await expect(buildOcrBody(0, new Blob([PDF.slice()]))).rejects.toBeInstanceOf(NotAnImageError);
    const calls: Call[] = [];
    const { fn } = fakeFetch(calls);
    const out = await runOcrQueue({
      sourceHash: HASH,
      jobs: [{ index: 0, render: async () => page(0, PDF, 'image/jpeg') }],
      fetchFn: fn,
      cache: null,
      precomputed: new Map(),
      freePagesLeft: 6,
    });
    expect(calls.filter((c) => c.url.includes('/api/ocr'))).toEqual([]);
    expect(out[0]).toMatchObject({ index: 0, state: 'failed' });
  });

  it('posts only a JPEG data payload with the client header, never PDF bytes', async () => {
    const calls: Call[] = [];
    const { fn } = fakeFetch(calls);
    const cache = memCache();
    const out = await runOcrQueue({
      sourceHash: HASH,
      jobs: [{ index: 4, render: async () => page(4, JPEG) }],
      fetchFn: fn,
      cache,
      precomputed: new Map(),
      freePagesLeft: 6,
    });
    const ocr = calls.filter((c) => c.url.endsWith('/api/ocr'));
    expect(ocr).toHaveLength(1);
    const body = ocr[0]!.body as {
      v: number;
      mime: string;
      pages: { index: number; data_b64: string }[];
    };
    expect(body.mime).toBe('image/jpeg');
    expect(body.pages).toHaveLength(1);
    expect(body.pages[0]!.index).toBe(4);
    expect(body.pages[0]!.data_b64.startsWith('JVBER')).toBe(false); // base64 of "%PDF"
    expect(
      imageKindOf(Uint8Array.from(atob(body.pages[0]!.data_b64), (c) => c.charCodeAt(0))),
    ).toBe('jpeg');
    expect(out[0]).toMatchObject({ index: 4, state: 'done' });
    expect(out[0]!.lines![0]!.text).toBe('☐ Trust ^{2}');
    expect(cache.map.size).toBe(1);

    // resume: a second run is served from the cache (no request, no render)
    let rendered = 0;
    const again = await runOcrQueue({
      sourceHash: HASH,
      jobs: [{ index: 4, render: async () => (rendered++, page(4, JPEG)) }],
      fetchFn: fn,
      cache,
      precomputed: new Map(),
      freePagesLeft: 6,
    });
    expect(again[0]!.state).toBe('done');
    expect(rendered).toBe(0);
    expect(calls.filter((c) => c.url.endsWith('/api/ocr'))).toHaveLength(1);
  });

  it('fails soft with no API base: pages unavailable, nothing rendered or posted', async () => {
    setApiBaseValue('');
    const calls: Call[] = [];
    const { fn } = fakeFetch(calls);
    let rendered = 0;
    const out = await runOcrQueue({
      sourceHash: HASH,
      jobs: [0, 1].map((index) => ({ index, render: async () => (rendered++, page(index, JPEG)) })),
      fetchFn: fn,
      cache: null,
      precomputed: new Map(),
    });
    expect(out.map((p) => [p.state, p.reason])).toEqual([
      ['unavailable', OCR_UNAVAILABLE_BUILD],
      ['unavailable', OCR_UNAVAILABLE_BUILD],
    ]);
    expect(rendered).toBe(0);
    expect(calls).toEqual([]);
  });

  it('respects the visitor OCR page cap and runs at most 3 pages at once', async () => {
    const calls: Call[] = [];
    const { fn, max } = fakeFetch(calls, { delayMs: 20 });
    const progress: number[] = [];
    const jobs: OcrJob[] = Array.from({ length: 8 }, (_, index) => ({
      index,
      render: async () => page(index, JPEG),
    }));
    const out = await runOcrQueue({
      sourceHash: HASH,
      jobs,
      fetchFn: fn,
      cache: null,
      precomputed: new Map(),
      freePagesLeft: 6,
      onProgress: (p) => progress.push(p.filter((x) => x.state === 'done').length),
    });
    expect(max()).toBeLessThanOrEqual(OCR_CONCURRENCY);
    expect(out.filter((p) => p.state === 'done')).toHaveLength(6);
    expect(out.filter((p) => p.state === 'unavailable').map((p) => p.reason)).toEqual([
      OCR_UNAVAILABLE_LIMIT,
      OCR_UNAVAILABLE_LIMIT,
    ]);
    expect(Math.max(...progress)).toBe(6);
  });

  it('marks pages unavailable on a quota / budget error frame (fail soft)', async () => {
    const calls: Call[] = [];
    const { fn } = fakeFetch(calls, {
      frame: { t: 'error', code: 'budget_cap', message: 'AI budget reached.' },
    });
    const out = await runOcrQueue({
      sourceHash: HASH,
      jobs: [0, 1].map((index) => ({ index, render: async () => page(index, JPEG) })),
      fetchFn: fn,
      cache: null,
      precomputed: new Map(),
      freePagesLeft: 6,
      concurrency: 1,
    });
    expect(out.map((p) => p.state)).toEqual(['unavailable', 'unavailable']);
    expect(calls.filter((c) => c.url.endsWith('/api/ocr'))).toHaveLength(1);
  });

  it('cache key = sha256 of the original-source key parts (WebCrypto equals node:crypto)', async () => {
    const parts = ocrKeyParts(HASH, 3);
    expect(parts).toEqual([
      'ocr',
      HASH,
      '3',
      RENDER_PARAMS,
      'nvidia/nemotron-3.5-super-vl:free',
      'ocr2',
      's1',
    ]);
    expect(RENDER_PARAMS).toBe('w1600q80');
    const expected = createHash('sha256').update(parts.join('|')).digest('hex');
    expect(await ocrPageKey(HASH, 3)).toBe(expected);
  });

  it('reads image size from the header without decoding', () => {
    expect(
      imageSizeOf(new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0x04, 0xb0, 0x06, 0x40, 3])),
    ).toEqual({
      width: 1600,
      height: 1200,
    });
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(png.buffer).setUint32(16, 70000);
    new DataView(png.buffer).setUint32(20, 70000);
    expect(imageSizeOf(png)).toEqual({ width: 70000, height: 70000 });
    expect(imageKindOf(PDF)).toBeNull();
  });
});
