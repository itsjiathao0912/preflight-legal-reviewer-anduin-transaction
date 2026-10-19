// AC14 (OpenAI provider plan, M2): every settle and every refusal emits exactly ONE `proxy.spend`
// operator line (visible in `wrangler tail`) with the running total and the cap. The line never
// carries a key or a body. An OpenAI call stays within 15 port calls.
import { describe, expect, test } from 'vitest';
import { OPENAI_SPEND_KEY } from '../../src/platform/spend';
import { frames, send } from '../fakes/harness';
import { aiAnswer, type OpenAiReply } from '../fakes/openai-stub';
import { events, makeOpenAiHarness, OPENAI_TEST_KEY } from '../fakes/openai-harness';

const FIELDS = [
  'actual_micro_usd',
  'cap_micro_usd',
  'event',
  'kind',
  'outcome',
  'provider',
  'reserved_micro_usd',
  'total_micro_usd',
];

describe('spend-operator-log (AC14)', () => {
  for (const [outcome, reply] of [
    ['actual', { answer: aiAnswer() }],
    ['keep', { answer: aiAnswer(), usage: null }],
    ['release', { status: 401, json: { error: { code: 'invalid_api_key' } } }],
    [
      'overrun',
      { answer: aiAnswer(), usage: { prompt_tokens: 90_000, completion_tokens: 30_000 } },
    ],
  ] as [string, OpenAiReply][]) {
    test(`should log one proxy.spend line with total and cap per settle (${outcome})`, async () => {
      const h = makeOpenAiHarness();
      h.oa.reply(reply);
      const res = await send(h);
      if (res.status === 200) await frames(res);
      const lines = events(h.logs, 'proxy.spend');
      expect(lines).toHaveLength(1);
      const l = lines[0]!;
      expect(Object.keys(l).sort()).toEqual(FIELDS);
      expect(l).toMatchObject({
        kind: 'ai',
        provider: 'openai',
        outcome,
        cap_micro_usd: 10_000_000,
        total_micro_usd: h.platform.spendTotal,
      });
      const all = h.logs.join('\n');
      expect(all).not.toContain(OPENAI_TEST_KEY);
      expect(all).not.toContain('findings');
      expect(h.platform.calls).toBeLessThanOrEqual(15);
    });
  }

  test('a refusal at the cap logs one proxy.spend line (outcome refused)', async () => {
    const h = makeOpenAiHarness();
    h.platform.set(OPENAI_SPEND_KEY, 10_000_000);
    await (await send(h)).arrayBuffer();
    const lines = events(h.logs, 'proxy.spend');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      outcome: 'refused',
      total_micro_usd: 10_000_000,
      actual_micro_usd: 0,
    });
  });
});
