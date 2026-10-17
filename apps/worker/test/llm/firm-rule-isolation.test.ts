// AC51: one firm's rules are never given for another firm, and another workspace's rules for the
// same firm are never given either (SQL scoping on local D1; the cookie `w` binds the workspace).
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

describe('firm-rule-isolation (AC51)', () => {
  test('only the bound workspace + requested firm rules are injected', async () => {
    const a = await mkWorkspace(env.DB);
    const b = await mkWorkspace(env.DB);
    await insertRule(a, 'firm-x', 'active', 'A-X rule.');
    await insertRule(a, 'firm-y', 'active', 'A-Y rule (other firm).');
    await insertRule(b, 'firm-x', 'active', 'B-X rule (other workspace).');
    const h = makeD1Harness();
    h.or.reply(okAi(), okAi(), okAi());
    const body = aiReq([cand('Isolation clause.')], 'firm-x');
    await frames(await send(h, { cookie: await workspaceCookie(a), body, ip: '198.51.100.31' }));
    expect(rulesIn(h.or.calls[0]!)).toEqual(['A-X rule.']);
    const userA = userContent(h.or.calls[0]!);
    expect(userA).not.toContain('A-Y rule');
    expect(userA).not.toContain('B-X rule');
    // workspace B, same firm: only B's rule, so a different prompt and a cache miss
    const r2 = await frames(
      await send(h, { cookie: await workspaceCookie(b), body, ip: '198.51.100.32' }),
    );
    expect(r2.terminal).toMatchObject({ cache: 'miss' });
    expect(rulesIn(h.or.calls[1]!)).toEqual(['B-X rule (other workspace).']);
    // workspace A, firm-y
    await frames(
      await send(h, {
        cookie: await workspaceCookie(a),
        body: aiReq([cand('Isolation clause.')], 'firm-y'),
        ip: '198.51.100.33',
      }),
    );
    expect(rulesIn(h.or.calls[2]!)).toEqual(['A-Y rule (other firm).']);
    expect(h.rulesCalls).toEqual([
      { w: a, firm: 'firm-x' },
      { w: b, firm: 'firm-x' },
      { w: a, firm: 'firm-y' },
    ]);
  });

  test('the workspace comes only from the signed cookie: a forged cookie for another workspace is ignored', async () => {
    const victim = await mkWorkspace(env.DB);
    await insertRule(victim, 'firm-x', 'active', 'Victim secret rule.');
    const h = makeD1Harness();
    h.or.reply(okAi());
    const { signCookie } = await import('@aduin/core');
    const now = Math.floor(h.clock.now / 1000);
    const forged = await signCookie(
      { v: 'attacker', w: victim, a: 'an1', iat: now, exp: now + 3600, kid: 'k1' },
      'attacker-key-0123456789abcdef0123456789',
    );
    await frames(
      await send(h, {
        cookie: `__Host-aduin_v=${forged}`,
        body: aiReq([cand('Forged clause.')], 'firm-x'),
        ip: '198.51.100.34',
      }),
    );
    expect(h.rulesCalls).toHaveLength(0);
    expect(rulesIn(h.or.calls[0]!)).toEqual([]);
  });
});
