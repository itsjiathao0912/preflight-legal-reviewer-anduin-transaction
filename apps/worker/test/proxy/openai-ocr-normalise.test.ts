// AC5 (OpenAI provider plan, M3): the OpenAI OCR reply carries `bbox`/`conf` as null when unknown
// (strict structured output); `normalizeOcr` drops nulls and the frozen OcrResultSchema stays the
// post-parse validator. Invalid replies (bad shape, out-of-range conf) are still malformed.
import { OcrResultSchema } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { normalizeOcr } from '../../src/upstream/openai';
import { frames, ocrBody, send } from '../fakes/harness';
import { ocrAnswer } from '../fakes/openai-stub';
import { makeOpenAiHarness } from '../fakes/openai-harness';

describe('openai-ocr-normalise (AC5)', () => {
  test('should normalise OCR nulls and validate with OcrResultSchema', () => {
    const raw = {
      v: 1,
      pages: [
        {
          index: 0,
          lines: [
            { text: 'a', bbox: null, conf: null },
            { text: 'b', bbox: { x: 0, y: 0.1, w: 0.5, h: 0.02 }, conf: 0.8 },
          ],
        },
      ],
    };
    expect(OcrResultSchema.safeParse(raw).success).toBe(false); // nulls fail the frozen schema
    const n = normalizeOcr(raw);
    expect(n).toEqual({
      v: 1,
      pages: [
        {
          index: 0,
          lines: [{ text: 'a' }, { text: 'b', bbox: { x: 0, y: 0.1, w: 0.5, h: 0.02 }, conf: 0.8 }],
        },
      ],
    });
    expect(OcrResultSchema.safeParse(n).success).toBe(true);
  });

  test('end to end: a null-filled OpenAI OCR reply becomes a valid result frame', async () => {
    const h = makeOpenAiHarness();
    h.oa.reply({ answer: ocrAnswer() });
    const { terminal } = await frames(await send(h, { path: '/api/ocr', body: ocrBody() }));
    expect(terminal).toMatchObject({
      t: 'result',
      kind: 'ocr',
      cache: 'miss',
      data: { v: 1, pages: [{ index: 0, lines: [{ text: 'Section 1' }] }] },
    });
  });

  test('an out-of-range conf is still malformed after normalising', async () => {
    const h = makeOpenAiHarness();
    h.oa.reply({
      answer: JSON.stringify({
        v: 1,
        pages: [{ index: 0, lines: [{ text: 'x', bbox: null, conf: 7 }] }],
      }),
    });
    const { terminal } = await frames(await send(h, { path: '/api/ocr', body: ocrBody() }));
    expect(terminal).toMatchObject({ t: 'error', code: 'upstream_failed', reason: 'malformed' });
  });
});
