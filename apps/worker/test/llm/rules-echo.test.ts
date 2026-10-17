// L5 (supports AC20): the AI result frame echoes `meta.rules_hash8` / `meta.rules_applied` /
// `meta.rules_total` on hit and miss; 'none' / 0 without a workspace or firm; never rule text.
import { selectInjectedRules } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { frames, makeHarness, send } from '../fakes/harness';
import { aiReq, cand, workspaceCookie } from './llm-helpers';

const RULES = ['SECRET-RULE-ALPHA wording.', 'SECRET-RULE-BETA wording.'];
const NONE = { rules_hash8: 'none', rules_applied: 0, rules_total: 0 };
const metaOf = (t: unknown) => (t as { meta?: Record<string, unknown> }).meta;

describe('rules-echo (L5)', () => {
  test('should include rules_hash8 in the AI result frame', async () => {
    const h = makeHarness();
    h.platform.setRules('ws1', 'firm-x', RULES);
    const cookie = await workspaceCookie('ws1');
    const body = aiReq([cand('Echo clause.')], 'firm-x');
    const sel = selectInjectedRules(RULES);
    const want = { rules_hash8: sel.hash8, rules_applied: 2, rules_total: 2 };
    expect(sel.hash8).toMatch(/^[0-9a-f]{8}$/);
    h.or.reply(okAi());
    const miss = await frames(await send(h, { cookie, body }));
    expect(miss.terminal).toMatchObject({ t: 'result', kind: 'ai', cache: 'miss' });
    expect(metaOf(miss.terminal)).toEqual(want);
    const hit = await frames(await send(h, { cookie, body }));
    expect(hit.terminal).toMatchObject({ t: 'result', kind: 'ai', cache: 'hit' });
    expect(metaOf(hit.terminal)).toEqual(want);
    expect(h.or.calls).toHaveLength(1);
    for (const t of [miss.terminal, hit.terminal]) {
      const j = JSON.stringify(t);
      expect(j).not.toContain('SECRET-RULE');
    }
  });

  test("echoes 'none' without a workspace (law_firm_id ignored), hit and miss", async () => {
    const h = makeHarness();
    h.platform.setRules('ws1', 'firm-x', RULES);
    const cookie = await workspaceCookie(undefined);
    const body = aiReq([cand('No ws echo.')], 'firm-x');
    h.or.reply(okAi());
    const miss = await frames(await send(h, { cookie, body }));
    expect(metaOf(miss.terminal)).toEqual(NONE);
    const hit = await frames(await send(h, { cookie, body }));
    expect(hit.terminal).toMatchObject({ cache: 'hit' });
    expect(metaOf(hit.terminal)).toEqual(NONE);
  });

  test("echoes 'none' with a workspace but no firm", async () => {
    const h = makeHarness();
    h.platform.setRules('ws1', 'firm-x', RULES);
    const cookie = await workspaceCookie('ws1');
    h.or.reply(okAi());
    const miss = await frames(await send(h, { cookie, body: aiReq([cand('No firm.')], null) }));
    expect(metaOf(miss.terminal)).toEqual(NONE);
  });

  test("echoes 'none' for a firm with no active rules", async () => {
    const h = makeHarness();
    const cookie = await workspaceCookie('ws1');
    h.or.reply(okAi());
    const miss = await frames(await send(h, { cookie, body: aiReq([cand('Empty.')], 'firm-y') }));
    expect(metaOf(miss.terminal)).toEqual(NONE);
  });
});
