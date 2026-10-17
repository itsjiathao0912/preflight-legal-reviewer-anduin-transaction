// AC27: changing the active firm rules changes the forwarded prompt and the cache key rules_hash,
// so the next request misses (no stale-rules AI findings are served).
import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { frames, makeHarness, send } from '../fakes/harness';
import { aiReq, cand, rulesIn, workspaceCookie } from './llm-helpers';

describe('cache-invalidated-by-firm-rules-change (AC27)', () => {
  test('should miss the cache after the firm rules change', async () => {
    const h = makeHarness();
    const cookie = await workspaceCookie('ws1');
    const body = aiReq([cand('Rules change clause.')], 'firm-x');
    h.platform.setRules('ws1', 'firm-x', ['Old rule.']);
    h.or.reply(okAi(), okAi(), okAi());
    expect((await frames(await send(h, { cookie, body }))).terminal).toMatchObject({
      cache: 'miss',
    });
    expect((await frames(await send(h, { cookie, body }))).terminal).toMatchObject({
      cache: 'hit',
    });
    h.platform.setRules('ws1', 'firm-x', ['Old rule.', 'New rule.']);
    expect((await frames(await send(h, { cookie, body }))).terminal).toMatchObject({
      cache: 'miss',
    });
    expect(rulesIn(h.or.calls[1]!)).toEqual(['New rule.', 'Old rule.']);
    // removing every rule is a change too (back to rules_hash none)
    h.platform.setRules('ws1', 'firm-x', []);
    expect((await frames(await send(h, { cookie, body }))).terminal).toMatchObject({
      cache: 'miss',
    });
    expect(h.or.calls).toHaveLength(3);
    const keys = [...h.platform.cacheMap.keys()];
    expect(new Set(keys).size).toBe(3);
  });
});
