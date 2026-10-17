// AC51 / G4: with a workspace and a firm, a failed rules read refuses pre-stream with
// memory_unavailable/rules_unavailable (503): zero claims, zero upstream, no cache read.
import { errorStatus } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { makeHarness, send } from '../fakes/harness';
import { aiReq, cand, workspaceCookie } from './llm-helpers';

describe('rules-read-fail-refuses-no-upstream (AC51, G4)', () => {
  test('should refuse with rules_unavailable and make no upstream call when the rules read fails', async () => {
    const h = makeHarness();
    h.platform.rulesDown = true;
    const res = await send(h, {
      cookie: await workspaceCookie('ws1'),
      body: aiReq([cand('Refuse clause.')], 'firm-x'),
    });
    expect(res.status).toBe(errorStatus('memory_unavailable'));
    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toMatchObject({
      error: { code: 'memory_unavailable', reason: 'rules_unavailable' },
    });
    expect(h.or.calls).toHaveLength(0);
    expect(h.ts.calls).toBe(0); // no Turnstile siteverify
    expect(h.platform.claimLog).toHaveLength(0);
    expect(h.platform.writes).toBe(0);
    expect(h.platform.calls).toBe(1); // only the failed rules read (no cache read)
  });

  test('a platform without a rules store refuses the same way (never runs without the rules)', async () => {
    const h = makeHarness();
    (h.platform as unknown as { rulesFor?: unknown }).rulesFor = undefined;
    const res = await send(h, {
      cookie: await workspaceCookie('ws1'),
      body: aiReq([cand('No store.')], 'firm-x'),
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { reason: 'rules_unavailable' } });
    expect(h.or.calls).toHaveLength(0);
    expect(h.platform.claimLog).toHaveLength(0);
  });

  test('a failing rules store does not affect requests without a firm', async () => {
    const h = makeHarness();
    h.platform.rulesDown = true;
    h.or.reply({
      status: 200,
      json: { model: 'm:free', choices: [{ message: { content: '{"findings":[]}' } }] },
    });
    const res = await send(h, {
      cookie: await workspaceCookie('ws1'),
      body: aiReq([cand('No firm.')], null),
    });
    expect(res.status).toBe(200);
    expect(h.platform.rulesCalls).toHaveLength(0);
  });
});
