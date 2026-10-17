import { describe, expect, test } from 'vitest';
import { okAi, okOcr } from '../fakes/openrouter-stub';
import { frames, makeHarness, send, T0 } from '../fakes/harness';
import { aiReq, cand, workspaceCookie } from '../llm/llm-helpers';
import { keys } from '../../src/limits/policy';

// Phase 05: <= 12 -> <= 13 (the workspace-bound firm-rules read joins the AI path).
const BUDGET = 13;

describe('proxy-budget (AC40 interim, AC34): BUDGET = 13 port calls per AI request', () => {
  test('AI miss for a new document stays within budget', async () => {
    const h = makeHarness();
    h.or.reply(okAi());
    await frames(await send(h));
    expect(h.platform.calls).toBeLessThanOrEqual(BUDGET);
    expect(h.or.calls).toHaveLength(1);
  });

  test('workspace + firm AI miss (rules read + claims + writes) stays within budget', async () => {
    const h = makeHarness();
    h.platform.setRules('ws1', 'firm-x', ['Rule A.', 'Rule B.']);
    const cookie = await workspaceCookie('ws1');
    h.or.reply(okAi());
    const { terminal } = await frames(
      await send(h, { cookie, body: aiReq([cand('Budget clause.')], 'firm-x') }),
    );
    expect(terminal).toMatchObject({ t: 'result', cache: 'miss' });
    expect(h.platform.rulesCalls).toEqual([{ w: 'ws1', firm: 'firm-x' }]);
    expect(h.platform.calls).toBeLessThanOrEqual(BUDGET);
    // measured 2026-10-17: 9 port calls (1 rules read + 1 cache get + claims + cache put + ledger)
  });

  test('AI refusal at the global cap (claims + refunds) stays within budget', async () => {
    const h = makeHarness();
    h.platform.set(keys('v', 'ip', T0).global, 35);
    await (await send(h)).arrayBuffer();
    expect(h.platform.calls).toBeLessThanOrEqual(BUDGET);
  });

  test('AI upstream failure (claims + refunds) stays within budget', async () => {
    const h = makeHarness();
    h.or.reply({ status: 500, text: 'x' });
    await frames(await send(h));
    expect(h.platform.calls).toBeLessThanOrEqual(BUDGET);
  });

  test('no-firm cache hit = exactly 1 port call; an OCR miss stays within budget', async () => {
    const h = makeHarness();
    h.or.reply(okAi(), okOcr());
    await frames(await send(h));
    const before = h.platform.calls;
    await frames(await send(h));
    expect(h.platform.calls - before).toBe(1);
    const b2 = h.platform.calls;
    await frames(await send(h, { path: '/api/ocr' }));
    expect(h.platform.calls - b2).toBeLessThanOrEqual(BUDGET);
  });

  test('workspace + firm cache hit = exactly 2 port calls (rules read + cache get), 0 claims, 0 writes', async () => {
    const h = makeHarness();
    h.platform.setRules('ws1', 'firm-x', ['Rule A.']);
    const cookie = await workspaceCookie('ws1');
    const body = aiReq([cand('Hit clause.')], 'firm-x');
    h.or.reply(okAi());
    await frames(await send(h, { cookie, body }));
    const calls = h.platform.calls;
    const writes = h.platform.writes;
    const claims = h.platform.claimLog.length;
    const { terminal } = await frames(await send(h, { cookie, body }));
    expect(terminal).toMatchObject({ t: 'result', cache: 'hit' });
    expect(h.platform.calls - calls).toBe(2);
    expect(h.platform.writes - writes).toBe(0);
    expect(h.platform.claimLog.length - claims).toBe(0);
    expect(h.or.calls).toHaveLength(1);
  });
});
