// AC51 / G3: caps (20 rules x 500 code points, 4 KB total) applied by the Worker before the rules
// reach the prompt; deterministic truncation, never a silent drop of the count.
import { RULES_CAPS, cacheKey, inputHash, selectInjectedRules, TASKS } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { frames, makeHarness, send } from '../fakes/harness';
import { DEFAULT_TEXT_MODELS } from '../../src/config';
import { aiReq, cand, messagesOf, rulesIn, workspaceCookie, type Msg } from './llm-helpers';

const many = Array.from(
  { length: 30 },
  (_, i) => `Rule ${String(i).padStart(2, '0')} standard wording.`,
);
const overlong = 'x'.repeat(RULES_CAPS.maxRuleCodePoints + 1);

describe('rules-caps (AC51, G3)', () => {
  test('at most 20 rules, none over 500 code points, total within 4 KB', async () => {
    const h = makeHarness();
    h.platform.setRules('ws1', 'firm-x', [overlong, ...many]);
    h.or.reply(okAi());
    await frames(
      await send(h, {
        cookie: await workspaceCookie('ws1'),
        body: aiReq([cand('Caps.')], 'firm-x'),
      }),
    );
    const rules = rulesIn(h.or.calls[0]!);
    expect(rules.length).toBe(RULES_CAPS.maxRules);
    expect(rules).not.toContain(overlong);
    expect(new TextEncoder().encode(rules.join('')).length).toBeLessThanOrEqual(
      RULES_CAPS.maxTotalBytes,
    );
    // deterministic: sorted, first that fit
    expect(rules).toEqual(selectInjectedRules([overlong, ...many]).texts);
  });

  test('the byte cap truncates large rules deterministically', async () => {
    const big = Array.from(
      { length: 12 },
      (_, i) => `${String.fromCharCode(65 + i)}${'y'.repeat(480)}`,
    );
    const h = makeHarness();
    h.platform.setRules('ws1', 'firm-x', big);
    h.or.reply(okAi());
    await frames(
      await send(h, {
        cookie: await workspaceCookie('ws1'),
        body: aiReq([cand('Bytes.')], 'firm-x'),
      }),
    );
    const rules = rulesIn(h.or.calls[0]!);
    const sel = selectInjectedRules(big);
    expect(sel.truncated).toBe(true);
    expect(sel.total).toBe(12);
    expect(rules).toEqual(sel.texts);
    expect(new TextEncoder().encode(rules.join('')).length).toBeLessThanOrEqual(4096);
  });

  test('cache key rules_hash is the hash of the injected (capped) set', async () => {
    const h = makeHarness();
    h.platform.setRules('ws1', 'firm-x', many);
    h.or.reply(okAi());
    await frames(
      await send(h, {
        cookie: await workspaceCookie('ws1'),
        body: aiReq([cand('Key.')], 'firm-x'),
      }),
    );
    const task = TASKS['clause-judgment'];
    const expected = cacheKey({
      kind: 'ai',
      input_hash: inputHash(messagesOf(h.or.calls[0]!) as Msg[] as never),
      model: DEFAULT_TEXT_MODELS,
      prompt_ver: task.promptVersion,
      schema_ver: task.schemaVersion,
      rules_hash: selectInjectedRules(many).hash,
    });
    expect([...h.platform.cacheMap.keys()]).toEqual([expected]);
  });
});
