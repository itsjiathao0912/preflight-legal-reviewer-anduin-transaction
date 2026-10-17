// AC34: a cache HIT with firm rules applied makes 0 claims, 0 writes, 0 upstream calls and no
// Turnstile check; the only port calls are the rules read and the cache get.
import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { frames, makeHarness, send } from '../fakes/harness';
import { aiReq, cand, workspaceCookie } from './llm-helpers';

describe('cache-hit-zero-claims-with-rules (AC34)', () => {
  test('HIT with rules: 0 claims, 0 writes, 0 upstream, 2 port calls', async () => {
    const h = makeHarness();
    h.platform.setRules('ws1', 'firm-x', ['Firm standard wording rule.']);
    const cookie = await workspaceCookie('ws1');
    const body = aiReq([cand('Cached clause.')], 'firm-x');
    h.or.reply(
      okAi([
        {
          candidate_id: 'c1',
          issue_class: 'ambiguity',
          severity: 'low',
          confidence: 0.5,
          quote: 'Cached clause.',
          explanation: 'x',
        },
      ]),
    );
    const first = await frames(await send(h, { cookie, body }));
    expect(first.terminal).toMatchObject({ t: 'result', cache: 'miss' });
    // exhaust every counter and drop the Turnstile token: a hit must still be served
    for (const id of [...h.platform.counts.keys()]) h.platform.counts.set(id, 999);
    const calls = h.platform.calls;
    const writes = h.platform.writes;
    const claims = h.platform.claimLog.length;
    const ts = h.ts.calls;
    const second = await frames(await send(h, { cookie, body, turnstile: null }));
    expect(second.terminal).toMatchObject({ t: 'result', kind: 'ai', cache: 'hit' });
    expect((second.terminal as { data: { findings: unknown[] } }).data.findings).toHaveLength(1);
    expect(h.or.calls).toHaveLength(1);
    expect(h.platform.claimLog.length - claims).toBe(0);
    expect(h.platform.writes - writes).toBe(0);
    expect(h.platform.calls - calls).toBe(2);
    expect(h.ts.calls - ts).toBe(0);
  });
});
