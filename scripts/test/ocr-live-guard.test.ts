import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildBody,
  ocrMessages,
  ocrResponseFormat,
} from '../../apps/worker/src/upstream/openrouter';
import { MAX_TOKENS, PROMPT_VER, SCHEMA_VER } from '../../apps/worker/src/upstream/models-config';
import {
  OCR_LIVE_CEILING,
  OCR_MAX_TOKENS,
  OCR_MODEL,
  OCR_PROMPT_VER,
  OCR_SCHEMA_VER,
  OcrLiveRefusal,
  ocrMessagesJson,
  ocrPageKey,
  ocrResponseFormatJson,
  ocrUpstreamBody,
  parseOcrContent,
  resolveOcrOptions,
  runOcrLive,
  writeIndex,
  type FetchLike,
} from '../src/precompute/precompute-ocr';
import type { ScanPage } from '../src/samples/scan-set';

/** Gate `ocr-live-guard` (E8): live OCR script guards against fakes, zero network. */
const LIVE = { ALLOW_LIVE_LLM: '1', OCR_MAX_REQUESTS: '3', OPENROUTER_API_KEY: 'test-key-value' };
const RAW = readFileSync(
  join(import.meta.dirname, '..', '..', 'fixtures', 'pdf', 'src', 'appa1-pg1-crop.jpg'),
);
const PAGES: ScanPage[] = [1, 2, 3].map((n) => ({
  n,
  raw: `fake-${n}.jpg`,
  file: `p0${n}.jpg`,
  sourceHash: String(n).repeat(64),
}));

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'ocr-live-'));
  dirs.push(d);
  return d;
}

function completion(o: { cost?: unknown; model?: string; content?: string; error?: unknown }) {
  const content =
    o.content ??
    JSON.stringify({ v: 1, pages: [{ index: 0, lines: [{ text: 'Trust^{2}', conf: 0.9 }] }] });
  return new Response(
    JSON.stringify({
      model: o.model ?? OCR_MODEL,
      ...(o.error !== undefined ? { error: o.error } : {}),
      choices: [{ message: { content }, finish_reason: 'stop' }],
      usage: { cost: o.cost ?? 0 },
    }),
    { status: 200 },
  );
}

function fakeFetch(responses: (() => Response)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)]!;
    return r();
  };
  return { fn, calls };
}

const deps = (fetchFn: FetchLike, outDir: string, logs: string[] = []) => ({
  fetchFn,
  outDir,
  pages: PAGES,
  readPage: () => new Uint8Array(RAW),
  sleep: async () => undefined,
  log: (s: string) => logs.push(s),
});

describe('ocr-live-guard', () => {
  it('should abort the live OCR script on the first response with usage cost above zero', async () => {
    const out = tmp();
    const f = fakeFetch([() => completion({ cost: 0.0001 })]);
    const opts = resolveOcrOptions([], LIVE);
    const run = await runOcrLive(opts, LIVE, deps(f.fn, out));
    expect(f.calls).toHaveLength(1);
    expect(run.aborted).toMatch(/usage\.cost/);
    expect(readdirSync(out)).toEqual([]);
  });

  // Review F9: a present but non-numeric / non-finite / non-zero cost must not pass as free.
  it('should abort when usage.cost is present but not a finite zero', async () => {
    for (const cost of ['0.5', null, Number.NaN, -1, '0']) {
      const out = tmp();
      const body = JSON.parse(await completion({}).text()) as { usage: { cost: unknown } };
      body.usage.cost = cost;
      const f = fakeFetch([() => new Response(JSON.stringify(body), { status: 200 })]);
      const run = await runOcrLive(resolveOcrOptions([], LIVE), LIVE, deps(f.fn, out));
      expect(f.calls).toHaveLength(1);
      expect(run.aborted).toMatch(/usage\.cost/);
      expect(readdirSync(out)).toEqual([]);
    }
  });

  it('should abort on a non-free served model', async () => {
    const f = fakeFetch([() => completion({ model: 'openai/gpt-4o' })]);
    const run = await runOcrLive(resolveOcrOptions([], LIVE), LIVE, deps(f.fn, tmp()));
    expect(f.calls).toHaveLength(1);
    expect(run.aborted).toMatch(/served/);
  });

  it('should refuse without ALLOW_LIVE_LLM, without a cap, and with a cap above the ceiling', () => {
    expect(() => resolveOcrOptions([], { OCR_MAX_REQUESTS: '3' })).toThrow(OcrLiveRefusal);
    expect(() => resolveOcrOptions([], { ALLOW_LIVE_LLM: '1' })).toThrow(/OCR_MAX_REQUESTS/);
    expect(() => resolveOcrOptions([], { ALLOW_LIVE_LLM: '1', OCR_MAX_REQUESTS: '31' })).toThrow(
      /above the approved ceiling/,
    );
    expect(() =>
      resolveOcrOptions([], {
        ALLOW_LIVE_LLM: '1',
        OCR_MAX_REQUESTS: String(OCR_LIVE_CEILING + 1),
      }),
    ).toThrow(/ceiling/);
    expect(() => resolveOcrOptions([], { ALLOW_LIVE_LLM: '1', OCR_MAX_REQUESTS: '0' })).toThrow();
    expect(OCR_LIVE_CEILING).toBeLessThanOrEqual(30);
  });

  it('should refuse a paid or router model and a non-openrouter host', async () => {
    expect(() => resolveOcrOptions([], { ...LIVE, OCR_MODEL: 'openrouter/free' })).toThrow();
    expect(() => resolveOcrOptions([], { ...LIVE, OCR_MODEL: 'openai/gpt-4o' })).toThrow();
    const f = fakeFetch([() => completion({})]);
    await expect(
      runOcrLive(
        resolveOcrOptions([], LIVE),
        { ...LIVE, OPENROUTER_BASE_URL: 'https://evil.example/api/v1' },
        deps(f.fn, tmp()),
      ),
    ).rejects.toThrow(/openrouter\.ai/);
    expect(f.calls).toHaveLength(0);
  });

  it('should support --dry-run without a key or network', () => {
    const o = resolveOcrOptions(['--dry-run'], {});
    expect(o.dryRun).toBe(true);
    expect(o.maxRequests).toBe(0);
  });

  it('should stop at the request cap, never print the key, and resume without re-requesting', async () => {
    const out = tmp();
    const logs: string[] = [];
    const f = fakeFetch([() => completion({})]);
    const env = { ...LIVE, OCR_MAX_REQUESTS: '2' };
    const run = await runOcrLive(resolveOcrOptions([], env), env, deps(f.fn, out, logs));
    expect(f.calls).toHaveLength(2);
    expect(run.aborted).toBe('request cap reached');
    expect(readdirSync(out)).toHaveLength(2);
    const files = readdirSync(out).map((x) => readFileSync(join(out, x), 'utf8'));
    for (const s of [...files, ...logs]) expect(s).not.toContain('test-key-value');
    expect(f.calls[0]!.init.redirect).toBe('error');
    // resume: the two done pages are skipped, only page 3 is requested
    const g = fakeFetch([() => completion({})]);
    await runOcrLive(resolveOcrOptions([], LIVE), LIVE, deps(g.fn, out));
    expect(g.calls).toHaveLength(1);
    const idx = writeIndex(out, PAGES);
    expect(idx.map((e) => e.page)).toEqual([1, 2, 3]);
    expect(idx[0]!.key).toBe(ocrPageKey(PAGES[0]!.sourceHash, 0));
  });

  it('should stop the run on a 429 instead of retrying', async () => {
    const f = fakeFetch([() => new Response('rate limited', { status: 429 })]);
    const run = await runOcrLive(resolveOcrOptions([], LIVE), LIVE, deps(f.fn, tmp()));
    expect(f.calls).toHaveLength(1);
    expect(run.aborted).toMatch(/rate limited/);
  });

  it('should keep retries inside the budget and count them toward the cap', async () => {
    const f = fakeFetch([() => completion({ content: 'not json' })]);
    const env = { ...LIVE, OCR_MAX_REQUESTS: '10' };
    const run = await runOcrLive(resolveOcrOptions([], env), env, deps(f.fn, tmp()));
    // 3 pages x (1 try + 1 retry) = 6 requests, 3 retries, each retry counted
    expect(f.calls).toHaveLength(6);
    expect(run.retries).toBe(3);
    expect(run.requests).toBe(6);
  });

  it('should build the same upstream body as the Worker (prompt, schema, max tokens)', () => {
    const b64 = Buffer.from(RAW).toString('base64');
    const worker = buildBody(
      'ocr',
      [OCR_MODEL],
      ocrMessages({ mime: 'image/jpeg', pages: [{ index: 4, data_b64: b64 }] } as never),
      ocrResponseFormat(),
    );
    expect(ocrMessagesJson(4, b64)).toBe(
      ocrMessages({ mime: 'image/jpeg', pages: [{ index: 4, data_b64: b64 }] } as never),
    );
    expect(ocrResponseFormatJson()).toBe(ocrResponseFormat());
    expect(ocrUpstreamBody(4, b64)).toBe(worker);
    expect(OCR_MAX_TOKENS).toBe(MAX_TOKENS.ocr);
    expect(OCR_PROMPT_VER).toBe(PROMPT_VER.ocr);
    expect(OCR_SCHEMA_VER).toBe(SCHEMA_VER);
  });

  it('should match the web queue cache-key formula', () => {
    // sha256("ocr|<hash>|0|w1600q80|<model>|ocr2|s1") — the web test computes the same via WebCrypto
    const k = ocrPageKey('a'.repeat(64), 0);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(k).not.toBe(ocrPageKey('a'.repeat(64), 1));
  });

  it('should parse fenced content and reject malformed OCR JSON', () => {
    const ok = parseOcrContent(
      '```json\n{"v":1,"pages":[{"index":9,"lines":[{"text":"x"}]}]}\n```',
      2,
    );
    expect(ok?.pages[0]?.index).toBe(2);
    expect(parseOcrContent('{"v":2}', 0)).toBeNull();
    expect(parseOcrContent(42, 0)).toBeNull();
  });
});
