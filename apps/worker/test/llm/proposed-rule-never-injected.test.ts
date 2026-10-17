// AC51 / AC47: only `active` rules of the bound workspace and firm reach the AI context;
// proposed, rejected and revoked rules never do (real SQL RulesPort on local D1).
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { frames, send } from '../fakes/harness';
import { mkWorkspace } from '../memory/db-fixtures';
import {
  aiReq,
  cand,
  insertRule,
  makeD1Harness,
  rulesIn,
  userContent,
  workspaceCookie,
} from './llm-helpers';

describe('proposed-rule-never-injected (AC51)', () => {
  test('a proposed (not active) rule is never injected', async () => {
    const ws = await mkWorkspace(env.DB);
    await insertRule(ws, 'firm-x', 'active', 'Active rule is context.');
    await insertRule(ws, 'firm-x', 'proposed', 'PROPOSED rule must never reach the model.');
    await insertRule(ws, 'firm-x', 'rejected', 'REJECTED rule must never reach the model.');
    await insertRule(ws, 'firm-x', 'revoked', 'REVOKED rule must never reach the model.');
    const h = makeD1Harness();
    h.or.reply(okAi());
    const { terminal } = await frames(
      await send(h, {
        cookie: await workspaceCookie(ws),
        body: aiReq([cand('Proposed clause.')], 'firm-x'),
        ip: '198.51.100.21',
      }),
    );
    expect(terminal).toMatchObject({ t: 'result', cache: 'miss' });
    expect(rulesIn(h.or.calls[0]!)).toEqual(['Active rule is context.']);
    const user = userContent(h.or.calls[0]!);
    for (const w of ['PROPOSED', 'REJECTED', 'REVOKED']) expect(user).not.toContain(w);
  });

  test('a firm with only a proposed rule injects nothing (rules_hash none)', async () => {
    const ws = await mkWorkspace(env.DB);
    await insertRule(ws, 'partners-group', 'proposed', 'Only proposed.');
    const h = makeD1Harness();
    h.or.reply(okAi());
    await frames(
      await send(h, {
        cookie: await workspaceCookie(ws),
        body: aiReq([cand('Only proposed clause.')], 'partners-group'),
        ip: '198.51.100.22',
      }),
    );
    expect(h.rulesCalls).toEqual([{ w: ws, firm: 'partners-group' }]);
    expect(rulesIn(h.or.calls[0]!)).toEqual([]);
  });
});
