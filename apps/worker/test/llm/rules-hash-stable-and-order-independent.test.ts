// AC51 / G3 (Worker side): the same active rules in any order and with whitespace variants give
// the same rules hash and the same forwarded prompt, so the second request is a cache HIT.
import { rulesHash, selectInjectedRules } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { frames, makeHarness, send } from '../fakes/harness';
import { aiReq, cand, workspaceCookie } from './llm-helpers';

const RULES = [
  'Units and Shares are interchangeable.',
  'Part E holds wire instructions.',
  'Cover lists the fund.',
];

describe('rules-hash-stable-and-order-independent (AC51)', () => {
  test('reordered / re-spaced rules hit the same cache entry', async () => {
    const h = makeHarness();
    const cookie = await workspaceCookie('ws1');
    const body = aiReq([cand('Order clause.')], 'firm-x');
    h.platform.setRules('ws1', 'firm-x', RULES);
    h.or.reply(okAi());
    await frames(await send(h, { cookie, body }));
    h.platform.setRules('ws1', 'firm-x', [
      RULES[2]!,
      `  ${RULES[0]!.replace(' ', '   ')} `,
      RULES[1]!,
    ]);
    const { terminal } = await frames(await send(h, { cookie, body }));
    expect(terminal).toMatchObject({ t: 'result', cache: 'hit' });
    expect(h.or.calls).toHaveLength(1);
    expect(h.platform.cacheMap.size).toBe(1);
  });

  test('the injected hash equals core rulesHash when no cap applies', () => {
    expect(selectInjectedRules(RULES).hash).toBe(rulesHash(RULES));
    expect(selectInjectedRules([...RULES].reverse()).hash).toBe(rulesHash(RULES));
    expect(selectInjectedRules([]).hash).toBe('none');
  });
});
