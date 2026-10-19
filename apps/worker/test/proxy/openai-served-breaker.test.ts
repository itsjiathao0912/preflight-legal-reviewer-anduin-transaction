// AC15 (OpenAI provider plan, M3): an OpenAI success served by gpt-4.1-mini (bare or a dated
// snapshot) never trips the breaker; any other served id trips it for the OpenAI fingerprint.
import { describe, expect, test } from 'vitest';
import { utcDay } from '../../src/limits/clock';
import { loadConfig } from '../../src/config';
import { memoryBreaker } from '../../src/proxy/ports';
import { checkServedOpenAi } from '../../src/upstream/openai';
import { aiBody, frames, send } from '../fakes/harness';
import { aiAnswer } from '../fakes/openai-stub';
import { makeOpenAiHarness, openAiEnv } from '../fakes/openai-harness';

describe('openai-served-breaker (AC15)', () => {
  test('served-id allow-list', () => {
    expect(checkServedOpenAi('gpt-4.1-mini')).toBe('ok');
    expect(checkServedOpenAi('gpt-4.1-mini-2025-04-14')).toBe('ok');
    for (const id of [
      'gpt-4.1',
      'gpt-4o',
      'gpt-4.1-mini-preview',
      'unknown',
      'gpt-4.1-mini-2025-4-14',
    ])
      expect(checkServedOpenAi(id)).toBe('trip');
  });

  test('should not trip the breaker on a dated gpt-4.1-mini id', async () => {
    const breaker = memoryBreaker();
    const h = makeOpenAiHarness({ breaker });
    for (const [i, model] of ['gpt-4.1-mini-2025-04-14', 'gpt-4.1-mini'].entries()) {
      h.oa.reply({ answer: aiAnswer(), model });
      const { terminal } = await frames(await send(h, { body: aiBody(`q${i}`) }));
      expect(terminal).toMatchObject({ t: 'result', model });
    }
    const fp = loadConfig(openAiEnv()).fingerprint;
    expect(await breaker.tripped(utcDay(h.clock.now), fp)).toBe(false);
    expect(h.logs.some((l) => l.includes('proxy.circuit_breaker'))).toBe(false);
  });

  test('a foreign served id trips the breaker; the next call is refused with no upstream', async () => {
    const breaker = memoryBreaker();
    const h = makeOpenAiHarness({ breaker });
    h.oa.reply({ answer: aiAnswer(), model: 'gpt-4o-2024-08-06' });
    await frames(await send(h, { body: aiBody('qa') }));
    const fp = loadConfig(openAiEnv()).fingerprint;
    expect(await breaker.tripped(utcDay(h.clock.now), fp)).toBe(true);
    const res = await send(h, { body: aiBody('qb') });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      error: { code: 'budget_cap', reason: 'circuit_breaker' },
    });
    expect(h.oa.calls).toHaveLength(1);
  });
});
