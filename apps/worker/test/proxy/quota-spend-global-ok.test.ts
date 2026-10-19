// AC14 (OpenAI provider plan, M2 item 2.6): /api/quota turns global_ok off when the remaining
// lifetime OpenAI budget is below one OCR page's worst case. Visitor-facing bodies (quota, health)
// expose no spend numbers and no keys: exactly {ai, ocr_pages, global_ok}.
import { describe, expect, test } from 'vitest';
import { OPENAI_SPEND_KEY } from '../../src/platform/spend';
import { ocrWorstCaseMicroUsd } from '../../src/upstream/provider';
import { bodyText, ORIGIN, send } from '../fakes/harness';
import { makeOpenAiHarness, OPENAI_TEST_KEY, type OpenAiHarness } from '../fakes/openai-harness';

const CAP = 10_000_000;

async function quota(h: OpenAiHarness) {
  const text = await bodyText(await send(h, { path: '/api/quota' }));
  return { text, json: JSON.parse(text) as Record<string, unknown> };
}

describe('quota-spend-global-ok (AC14)', () => {
  test('should turn global_ok off near the cap and expose no spend to visitors', async () => {
    const h = makeOpenAiHarness();
    const W = ocrWorstCaseMicroUsd();
    expect(W).toBeGreaterThan(0);
    const a = await quota(h);
    expect(Object.keys(a.json).sort()).toEqual(['ai', 'global_ok', 'ocr_pages']);
    expect(a.json['global_ok']).toBe(true);

    h.platform.set(OPENAI_SPEND_KEY, CAP - W); // exactly one OCR page left: still on
    expect((await quota(h)).json['global_ok']).toBe(true);
    h.platform.set(OPENAI_SPEND_KEY, CAP - W + 1); // below one page: off
    const b = await quota(h);
    expect(b.json['global_ok']).toBe(false);
    for (const t of [a.text, b.text]) {
      expect(t).not.toContain(String(CAP - W + 1));
      expect(t).not.toContain(String(CAP));
      expect(t).not.toMatch(/spend|micro|openai/i);
      expect(t).not.toContain(OPENAI_TEST_KEY);
    }
    const res = await h.app.fetch(new Request(`${ORIGIN}/api/health`), h.env as never, h.ctx);
    expect(JSON.parse(await bodyText(res))).toEqual({ ok: true });
  });

  test('a spend read error turns global_ok off (fail soft, no throw)', async () => {
    const h = makeOpenAiHarness();
    h.platform.spendDown = true;
    const q = await quota(h);
    expect(q.json['global_ok']).toBe(false);
  });
});
