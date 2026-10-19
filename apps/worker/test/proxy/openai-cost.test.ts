// AC7 (OpenAI provider plan, M3): cost = usage x price, in exact integer µUSD (ceil), and the
// worst case counts text bytes, the response_format bytes, 3000 per image and 16 per message.
import { describe, expect, test } from 'vitest';
import { MAX_TOKENS } from '../../src/upstream/models-config';
import {
  costMicroUsd,
  IMAGE_TOKENS_WORST,
  MESSAGE_TOKENS_WORST,
  OPENAI_PRICES_MICRO_USD_PER_MTOK,
  worstCaseMicroUsd,
} from '../../src/upstream/openai';

describe('openai-cost (AC7)', () => {
  test('should compute exact micro-USD from token usage', () => {
    expect(OPENAI_PRICES_MICRO_USD_PER_MTOK['gpt-4.1-mini']).toEqual({
      in: 400_000,
      out: 1_600_000,
    });
    expect(costMicroUsd(0, 0)).toBe(0);
    expect(costMicroUsd(1_000_000, 0)).toBe(400_000);
    expect(costMicroUsd(0, 1_000_000)).toBe(1_600_000);
    expect(costMicroUsd(1000, 200)).toBe(720);
    expect(costMicroUsd(1, 0)).toBe(1); // 0.4 -> ceil 1
    expect(costMicroUsd(3, 1)).toBe(3); // 1.2 + 1.6 = 2.8 -> 3
    expect(costMicroUsd(12_345, 6_789)).toBe(Math.ceil(12_345 * 0.4 + 6_789 * 1.6));
  });

  test('worst case: text bytes + response_format bytes + 16/message; out = max_completion_tokens', () => {
    const msgs = JSON.stringify([
      { role: 'system', content: 'abc' },
      { role: 'user', content: 'é' }, // 2 UTF-8 bytes
    ]);
    const rf = '{"type":"json_object"}';
    const inTok = rf.length + 2 * MESSAGE_TOKENS_WORST + 3 + 2;
    expect(worstCaseMicroUsd('ai', msgs, rf)).toBe(costMicroUsd(inTok, MAX_TOKENS.ai));
  });

  test('worst case: an image part counts 3000 tokens, never its base64 bytes', () => {
    const big = 'A'.repeat(500_000);
    const msgs = `[{"role":"user","content":[{"type":"text","text":"read"},{"type":"image_url","image_url":{"url":"data:image/png;base64,${big}"}}]}]`;
    const inTok = 2 + MESSAGE_TOKENS_WORST + 4 + IMAGE_TOKENS_WORST;
    expect(worstCaseMicroUsd('ocr', msgs, '{}')).toBe(costMicroUsd(inTok, MAX_TOKENS.ocr));
  });

  test('the $10 cap holds at least ~600 worst-case AI calls of a small request', () => {
    const w = worstCaseMicroUsd('ai', JSON.stringify([{ role: 'user', content: 'x' }]), '{}');
    expect(Math.floor(10_000_000 / w)).toBeGreaterThan(500);
  });
});
