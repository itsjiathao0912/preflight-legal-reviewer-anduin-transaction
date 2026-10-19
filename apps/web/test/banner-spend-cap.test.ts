// AC13 (OpenAI provider plan, M4): at the lifetime spend cap the Worker answers budget_cap /
// spend_cap. The AI lane shows the `spend_limit` banner (never "budget for today", never a
// midnight resume), a provider balance problem reads as "not available", a provider auth error as
// a provider error, and OCR pages get the spend-limit reason.
import { describe, expect, it } from 'vitest';
import { BANNERS, bannerFor, resumeAt } from '../src/features/ai/banner-map';
import { OCR_UNAVAILABLE_SPEND, runOcrQueue } from '../src/engine/ocr-queue';

const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0xff, 0xd9,
]);

describe('banner-spend-cap (AC13)', () => {
  it('should show the spend_limit banner and OCR spend reason at the cap', async () => {
    expect(bannerFor({ code: 'budget_cap', reason: 'spend_cap' })).toBe('spend_limit');
    expect(BANNERS.spend_limit).toEqual({
      reason: 'the spend limit has been reached, so AI review is switched off',
      short: 'spend limit reached',
      resume: 'none',
      lane: 'skipped',
    });
    expect(resumeAt('spend_limit', undefined, Date.UTC(2026, 9, 19))).toBeNull();

    let calls = 0;
    const fetchFn = (async (input: RequestInfo | URL) => {
      if (String(input).includes('/precomputed/')) return new Response('nf', { status: 404 });
      calls++;
      const frame = {
        t: 'error',
        code: 'budget_cap',
        message: 'AI budget reached. Deterministic results are unaffected.',
        reason: 'spend_cap',
      };
      return new Response(`${JSON.stringify(frame)}\n`, {
        status: 200,
        headers: { 'content-type': 'application/x-ndjson' },
      });
    }) as typeof fetch;
    const out = await runOcrQueue({
      sourceHash: 'e'.repeat(64),
      jobs: [0, 1].map((index) => ({
        index,
        render: async () => ({
          index,
          jpeg: new Blob([JPEG.slice()], { type: 'image/jpeg' }),
          width: 10,
          height: 10,
        }),
      })),
      fetchFn,
      cache: null,
      precomputed: new Map(),
      freePagesLeft: 6,
      concurrency: 1,
    });
    expect(out.map((p) => p.state)).toEqual(['unavailable', 'unavailable']);
    expect(out.map((p) => p.reason)).toEqual([OCR_UNAVAILABLE_SPEND, OCR_UNAVAILABLE_SPEND]);
    expect(calls).toBe(1); // the first refusal stops the queue from calling again
  });

  it('other budget_cap reasons keep their banners', () => {
    expect(bannerFor({ code: 'budget_cap', reason: 'provider_balance' })).toBe('ai_unavailable');
    expect(bannerFor({ code: 'budget_cap', reason: 'circuit_breaker' })).toBe('breaker');
    expect(bannerFor({ code: 'budget_cap' })).toBe('budget');
    expect(bannerFor({ code: 'upstream_failed', reason: 'provider_auth' })).toBe('provider_error');
  });
});
