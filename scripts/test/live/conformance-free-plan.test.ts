import { describe, expect, it } from 'vitest';
import { CreateRunRequestSchema } from '@aduin/core';
import {
  type Http,
  type HttpResult,
  makeHttp,
  matrixCases,
  runBody,
  runBurst,
  runLimits,
  runMatrix,
  sumRowsWritten,
} from '../../src/conformance/free-plan';

const LIVE = 'https://aduin-transaction-web.giathaowork.workers.dev';
const res = (status: number, body: unknown, h: Record<string, string> = {}): HttpResult => ({
  status,
  body,
  headers: new Headers(h),
});
const err = (code: string) => ({ error: { code, message: 'm' } });

describe('conformance:free-plan matrix (AC39)', () => {
  it('passes when every case is rejected before claim and quota is unchanged', async () => {
    const seen: string[] = [];
    const http: Http = async (path) => {
      seen.push(path);
      if (path === '/api/quota') return res(200, { ai: 8, ocr_pages: 6, global_ok: true });
      if (path === '/api/does-not-exist') return res(404, 'nf');
      if (path === '/api/ai') return res(403, err('invalid_session'));
      if (path === '/api/ocr') return res(415, err('unsupported_type'));
      return res(401, err('invalid_session'));
    };
    expect(await runMatrix(http, 0)).toEqual([]);
    expect(seen.filter((p) => p === '/api/quota')).toHaveLength(2);
    expect(seen.length).toBe(matrixCases().length + 2);
  });
  it('fails when a case is accepted or quota moves; stops on 429', async () => {
    let q = 8;
    const http: Http = async (path) =>
      path === '/api/quota' ? res(200, { ai: q--, ocr_pages: 6, global_ok: true }) : res(200, {});
    const f = await runMatrix(http, 0);
    expect(f.some((x) => x.includes('quota changed'))).toBe(true);
    expect(f.some((x) => x.startsWith('ai-no-session-no-token'))).toBe(true);
    const h429: Http = async (path) =>
      path === '/api/quota'
        ? res(200, { ai: 1, ocr_pages: 1, global_ok: true })
        : res(429, err('rate_limited'));
    expect((await runMatrix(h429, 0))[0]).toMatch(/stop at .*429/);
  });
  it('no matrix case is a well-formed AI/OCR request (cannot reach upstream)', () => {
    for (const c of matrixCases())
      if (c.path === '/api/ai') expect(c.expect.every((s) => s >= 400)).toBe(true);
  });
});

describe('conformance:free-plan limits (AC40)', () => {
  it('accepts exactly one rate_limited 429 with no-store as the safe failure', async () => {
    let n = 0;
    const http: Http = async () =>
      ++n > 5
        ? res(
            429,
            { error: { code: 'rate_limited', retry_after_s: 30 } },
            { 'cache-control': 'no-store' },
          )
        : res(200, { ai: 8, ocr_pages: 6, global_ok: true });
    expect(await runLimits(http, 0)).toEqual([]);
    expect(n).toBe(6);
  });
  it('fails when the 429 is unsafe or never comes', async () => {
    let n = 0;
    const bad: Http = async () =>
      ++n > 2
        ? res(429, { error: { code: 'quota_exhausted' } })
        : res(200, { ai: 1, ocr_pages: 1, global_ok: true });
    expect((await runLimits(bad, 0))[0]).toMatch(/rate_limited/);
    const never: Http = async () => res(200, { ai: 1, ocr_pages: 1, global_ok: true });
    expect((await runLimits(never, 0, 3))[0]).toMatch(/no 429/);
  });
});

describe('conformance:free-plan burst (D4)', () => {
  it('run bodies match the frozen CreateRun contract', () => {
    expect(CreateRunRequestSchema.safeParse(runBody(1)).success).toBe(true);
  });
  it('stops at the first 429 and counts accepted writes', async () => {
    let n = 0;
    const http: Http = async () =>
      ++n > 3 ? res(429, err('memory_write_budget')) : res(200, { run_id: 'r' });
    const r = await runBurst(http, 10, 0);
    expect(r.ok).toBe(3);
    expect(r.failures[0]).toMatch(/429/);
  });
  it('sends the handed-over cookie only to the allowed origin and refuses others', async () => {
    const seen: Array<{ url: string; cookie: string | null }> = [];
    const fake = (async (url: string, init: RequestInit) => {
      seen.push({ url, cookie: new Headers(init.headers).get('cookie') });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    await makeHttp(LIVE, fake, 'v.sig')('/api/runs');
    expect(seen[0]).toEqual({ url: `${LIVE}/api/runs`, cookie: '__Host-aduin_v=v.sig' });
    expect(() => makeHttp('https://evil.workers.dev', fake)).not.toThrow();
    await expect(makeHttp('https://evil.workers.dev', fake)('/api/quota')).rejects.toThrow();
  });
  it('sums rowsWritten from the accountTag-only analytics response', () => {
    const resp = {
      data: {
        viewer: {
          accounts: [
            {
              d1AnalyticsAdaptiveGroups: [
                { sum: { rowsWritten: 40 } },
                { sum: { rowsWritten: 2 } },
              ],
            },
          ],
        },
      },
    };
    expect(sumRowsWritten(resp)).toBe(42);
    expect(sumRowsWritten({})).toBe(0);
  });
});
