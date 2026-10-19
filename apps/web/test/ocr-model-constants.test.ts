// AC20 (OpenAI provider plan, M4): the browser OCR cache keys on the live model (gpt-4.1-mini),
// while the committed precomputed set for sample #9 keeps its old model id, so its static lookup
// still hits after the provider switch and the two never share a key.
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OCR_MODEL,
  ocrKeyParts,
  ocrPageKey,
  PRECOMPUTED_OCR_MODEL,
  runOcrQueue,
} from '../src/engine/ocr-queue';
import { RENDER_PARAMS } from '../src/engine/render-pages';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const RAW = join(ROOT, 'samples/sub-docs/raw/09-rw-holdings-scans');
const INDEX = join(ROOT, 'apps/web/public/precomputed/ocr/index.json');

function committedKeys(): string[] {
  const idx = JSON.parse(readFileSync(INDEX, 'utf8')) as Record<string, { key: string }[]>;
  return Object.values(idx).flatMap((rows) => rows.map((r) => r.key));
}

function sourceHashes(): string[] {
  return readdirSync(RAW)
    .filter((f) => f.endsWith('.jpg'))
    .map((f) =>
      createHash('sha256')
        .update(readFileSync(join(RAW, f)))
        .digest('hex'),
    );
}

describe('ocr-model-constants (AC20)', () => {
  it('should key live OCR on gpt-4.1-mini and precomputed on the old id', async () => {
    expect(OCR_MODEL).toBe('gpt-4.1-mini');
    expect(PRECOMPUTED_OCR_MODEL).toBe('nvidia/nemotron-3.5-super-vl:free');
    const h = 'c'.repeat(64);
    expect(ocrKeyParts(h, 0)[4]).toBe('gpt-4.1-mini');
    expect(ocrKeyParts(h, 0, RENDER_PARAMS, PRECOMPUTED_OCR_MODEL)[4]).toBe(PRECOMPUTED_OCR_MODEL);
    expect(await ocrPageKey(h, 0)).not.toBe(
      await ocrPageKey(h, 0, RENDER_PARAMS, PRECOMPUTED_OCR_MODEL),
    );
  });

  it('every committed #9 index key is reproduced with PRECOMPUTED_OCR_MODEL, never with the live model', async () => {
    const keys = new Set(committedKeys());
    expect(keys.size).toBeGreaterThan(0);
    const pre = new Set<string>();
    const live = new Set<string>();
    const hashes = sourceHashes();
    for (const sh of hashes)
      for (let i = 0; i < hashes.length; i++) {
        pre.add(await ocrPageKey(sh, i, RENDER_PARAMS, PRECOMPUTED_OCR_MODEL));
        live.add(await ocrPageKey(sh, i));
      }
    for (const k of keys) expect(pre.has(k)).toBe(true);
    for (const k of keys) expect(live.has(k)).toBe(false);
  });

  it('the queue looks up the precomputed set with the old key and caches with the live key', async () => {
    const h = 'd'.repeat(64);
    const preKey = await ocrPageKey(h, 0, RENDER_PARAMS, PRECOMPUTED_OCR_MODEL);
    const liveKey = await ocrPageKey(h, 0);
    const got: string[] = [];
    const fetchFn = (async (u: RequestInfo | URL) => {
      got.push(String(u));
      return new Response(JSON.stringify({ v: 1, pages: [{ index: 0, lines: [{ text: 'A' }] }] }));
    }) as typeof fetch;
    const cacheReads: string[] = [];
    const out = await runOcrQueue({
      sourceHash: h,
      jobs: [
        {
          index: 0,
          render: async () => ({ jpeg: new Uint8Array(), width: 1, height: 1 }) as never,
        },
      ],
      fetchFn,
      cache: {
        get: async (k: string) => {
          cacheReads.push(k);
          return null;
        },
        put: async () => {},
      },
      precomputed: new Map([[preKey, 'p.json']]),
      aiOff: () => true,
    });
    expect(out[0]?.state).toBe('done');
    expect(got).toEqual(['/precomputed/ocr/p.json']);
    expect(cacheReads).toEqual([]);
    // a page not in the static set reads the browser cache under the live key
    const out2 = await runOcrQueue({
      sourceHash: h,
      jobs: [
        {
          index: 0,
          render: async () => ({ jpeg: new Uint8Array(), width: 1, height: 1 }) as never,
        },
      ],
      fetchFn,
      cache: {
        get: async (k: string) => {
          cacheReads.push(k);
          return null;
        },
        put: async () => {},
      },
      precomputed: new Map(),
      aiOff: () => true,
    });
    expect(out2[0]?.state).toBe('unavailable');
    expect(cacheReads).toEqual([liveKey]);
  });
});
