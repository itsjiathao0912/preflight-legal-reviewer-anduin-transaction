// AC51: without a workspace claim (or with a read-only demo cookie) the law_firm_id is ignored:
// no rules read, an empty rules block, rules_hash 'none' (the same cache entry as a null firm).
import { UNTRUSTED_RULES_TAG } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { frames, makeHarness, send } from '../fakes/harness';
import { aiReq, cand, rulesIn, userContent, workspaceCookie } from './llm-helpers';

describe('no-workspace-ignores-law-firm-id (AC51)', () => {
  test('should ignore law_firm_id when the cookie has no workspace', async () => {
    const h = makeHarness();
    h.platform.setRules('ws1', 'firm-x', ['Never injected without a workspace.']);
    h.or.reply(okAi());
    const cookie = await workspaceCookie(undefined);
    await frames(await send(h, { cookie, body: aiReq([cand('No ws.')], 'firm-x') }));
    expect(h.platform.rulesCalls).toHaveLength(0);
    expect(rulesIn(h.or.calls[0]!)).toEqual([]);
    expect(userContent(h.or.calls[0]!)).toContain(
      `<${UNTRUSTED_RULES_TAG}>\n[]\n</${UNTRUSTED_RULES_TAG}>`,
    );
    // the same candidates with a null firm reuse that entry (rules_hash none)
    const { terminal } = await frames(
      await send(h, { cookie, body: aiReq([cand('No ws.')], null) }),
    );
    expect(terminal).toMatchObject({ cache: 'hit' });
  });

  test('a fresh visitor (no cookie at all) is treated the same', async () => {
    const h = makeHarness();
    h.or.reply(okAi());
    await frames(await send(h, { body: aiReq([cand('Fresh.')], 'firm-x') }));
    expect(h.platform.rulesCalls).toHaveLength(0);
    expect(rulesIn(h.or.calls[0]!)).toEqual([]);
  });

  test("a read-only demo cookie (a === 'ro') never resolves rules", async () => {
    const h = makeHarness();
    h.platform.setRules('ws_demo', 'firm-x', ['Demo rule.']);
    h.or.reply(okAi());
    const cookie = await workspaceCookie('ws_demo', { a: 'ro' });
    await frames(await send(h, { cookie, body: aiReq([cand('RO.')], 'firm-x') }));
    expect(h.platform.rulesCalls).toHaveLength(0);
    expect(rulesIn(h.or.calls[0]!)).toEqual([]);
  });
});
