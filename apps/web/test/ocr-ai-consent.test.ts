import { afterEach, describe, expect, it } from 'vitest';
import { setApiBaseValue } from '../src/api/base';
import { privacyLines } from '../src/features/open-document/privacy-copy';
import {
  OCR_UNAVAILABLE_AI_OFF,
  ocrPageKey,
  PRECOMPUTED_OCR_MODEL,
  runOcrQueue,
  type OcrJob,
} from '../src/engine/ocr-queue';
import { ocrBanner } from '../src/features/scan/scan-model';
import { RENDER_PARAMS, type RenderedPage } from '../src/engine/render-pages';

// Review fix cycle F2 (OCR egress follows the AI consent switch) and F3 (queue abort).
const HASH = 'b'.repeat(64);
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0xff, 0xd9,
]);
const page = (index: number): RenderedPage => ({
  index,
  jpeg: new Blob([JPEG.slice()], { type: 'image/jpeg' }),
  width: 10,
  height: 10,
});
const okFrame = {
  t: 'result',
  kind: 'ocr',
  cache: 'miss',
  model: 'nvidia/nemotron-3.5-super-vl:free',
  data: { v: 1, pages: [{ index: 0, lines: [{ text: 'Trust', conf: 0.9 }] }] },
};

function recorder(onOcr?: () => void) {
  const urls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('/precomputed/ocr/'))
      return new Response(JSON.stringify(okFrame.data), { status: 200 });
    if (url.includes('/api/ocr')) onOcr?.();
    return new Response(`${JSON.stringify(okFrame)}\n`, {
      status: 200,
      headers: { 'content-type': 'application/x-ndjson' },
    });
  }) as typeof fetch;
  return { fn, ocr: () => urls.filter((u) => u.includes('/api/ocr')), urls };
}

const jobs = (n: number): OcrJob[] =>
  Array.from({ length: n }, (_, i) => ({ index: i, render: async () => page(i) }));

afterEach(() => setApiBaseValue('/'));

describe('privacy copy (F2)', () => {
  it('discloses that scanned pages are sent as images to a third-party free AI model', () => {
    const all = privacyLines().join(' ');
    expect(all).toContain(
      'Scanned pages are sent as images to a third-party free AI model to read the text',
    );
    expect(all).toMatch(/page images|as images/);
    expect(all).toContain('AI review sends short snippets of the document to a free AI model.');
  });
});

describe('ocr-ai-consent (F2)', () => {
  it('AI off: zero /api/ocr requests and no quota call for a scanned upload', async () => {
    const r = recorder();
    let rendered = 0;
    const out = await runOcrQueue({
      sourceHash: HASH,
      jobs: jobs(3).map((j) => ({ ...j, render: async () => (rendered++, page(j.index)) })),
      aiOff: () => true,
      fetchFn: r.fn,
      cache: null,
      precomputed: new Map(),
    });
    expect(r.ocr()).toEqual([]);
    expect(r.urls.filter((u) => u.includes('/api/'))).toEqual([]);
    expect(rendered).toBe(0);
    expect(out.map((p) => p.state)).toEqual(['unavailable', 'unavailable', 'unavailable']);
    expect(out[0]).toMatchObject({ reason: OCR_UNAVAILABLE_AI_OFF });
    expect(
      ocrBanner(out.map((p) => ({ index: p.index, state: p.state, reason: p.reason, low: false }))),
    ).toBe('ai_off');
  });

  it('AI off: precomputed static results (sample #9) still read the page', async () => {
    const r = recorder();
    const key = await ocrPageKey(HASH, 0, RENDER_PARAMS, PRECOMPUTED_OCR_MODEL);
    const out = await runOcrQueue({
      sourceHash: HASH,
      jobs: jobs(1),
      aiOff: () => true,
      fetchFn: r.fn,
      cache: null,
      precomputed: new Map([[key, 'p1.json']]),
    });
    expect(out[0]?.state).toBe('done');
    expect(r.ocr()).toEqual([]);
  });

  it('AI on: behaviour unchanged (page image is posted)', async () => {
    const r = recorder();
    await runOcrQueue({
      sourceHash: HASH,
      jobs: jobs(1),
      fetchFn: r.fn,
      cache: null,
      precomputed: new Map(),
      freePagesLeft: 6,
    });
    expect(r.ocr()).toHaveLength(1);
  });
});

describe('ocr aiOff per page (N3)', () => {
  it('switching AI off mid-run stops the remaining pages', async () => {
    let aiOn = true;
    const r = recorder(() => {
      aiOn = false;
    });
    const out = await runOcrQueue({
      sourceHash: HASH,
      jobs: jobs(4),
      concurrency: 1,
      aiOff: () => !aiOn,
      fetchFn: r.fn,
      cache: null,
      precomputed: new Map(),
      freePagesLeft: 6,
    });
    expect(r.ocr()).toHaveLength(1);
    expect(out.slice(1).map((p) => p.state)).toEqual(['unavailable', 'unavailable', 'unavailable']);
    expect(out[1]).toMatchObject({ reason: OCR_UNAVAILABLE_AI_OFF });
  });
});

describe('ocr queue abort (F3)', () => {
  it('stops posting once the load signal aborts', async () => {
    const ctrl = new AbortController();
    const r = recorder(() => ctrl.abort());
    const out = await runOcrQueue({
      sourceHash: HASH,
      jobs: jobs(5),
      concurrency: 1,
      signal: ctrl.signal,
      fetchFn: r.fn,
      cache: null,
      precomputed: new Map(),
      freePagesLeft: 6,
    });
    expect(r.ocr()).toHaveLength(1);
    expect(out.slice(1).every((p) => p.state === 'queued')).toBe(true);
  });
});
