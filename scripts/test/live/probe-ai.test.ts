import { describe, expect, it } from 'vitest';
import { injectedRulesHash, rulesHash8 } from '@aduin/core';
import { activeRuleTexts, expectedHash8, findEcho, parseTailEvent } from '../../src/live/probe-ai';

describe('probe:live-ai', () => {
  it('finds the L5 echo meta in NDJSON frames', () => {
    const frames = [
      { type: 'progress' },
      { type: 'result', meta: { rules_hash8: 'abcd1234', rules_applied: 1, rules_total: 1 } },
    ];
    expect(findEcho(frames)).toEqual({ rules_hash8: 'abcd1234', rules_applied: 1, rules_total: 1 });
    expect(findEcho([{ type: 'x' }])).toBeNull();
  });
  it('expected hash = core rulesHash8 over the active rule texts only', () => {
    const body = {
      rules: [
        { text: 'Always flag X', status: 'active' },
        { text: 'proposed', status: 'proposed' },
      ],
    };
    const texts = activeRuleTexts(body);
    expect(texts).toEqual(['Always flag X']);
    expect(expectedHash8(texts)).toBe(rulesHash8(injectedRulesHash(texts)));
    expect(expectedHash8([])).toBe('none');
  });
  it('parses wrangler tail timing for the first /api/ai POST only', () => {
    const ev = (url: string, method = 'POST') =>
      JSON.stringify({
        outcome: 'ok',
        cpuTime: 12,
        wallTime: 3400,
        event: { request: { url, method } },
      });
    expect(
      parseTailEvent(ev('https://aduin-transaction-web.giathaowork.workers.dev/api/ai')),
    ).toEqual({ cpuTimeMs: 12, wallTimeMs: 3400, outcome: 'ok' });
    expect(
      parseTailEvent(ev('https://aduin-transaction-web.giathaowork.workers.dev/api/aix')),
    ).toBeNull();
    expect(
      parseTailEvent(ev('https://aduin-transaction-web.giathaowork.workers.dev/api/ai', 'GET')),
    ).toBeNull();
    expect(parseTailEvent('not json')).toBeNull();
  });
});
