// AC34: the static precomputed lookup is keyed by rulesHash8. Bundled samples carry no firm
// rules in the AI context (no firm / read-only demo -> 'none'), the committed precomputed files are
// keyed `.none.json`, and a sandbox copy of the demo seed injects exactly the demo's active rules
// (same rules hash per firm), so a seed-copied sandbox never diverges from the demo.
import { env } from 'cloudflare:test';
import { rulesHash, rulesHash8, selectInjectedRules } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { okAi } from '../fakes/openrouter-stub';
import { frames, send } from '../fakes/harness';
import { mkWorkspace } from '../memory/db-fixtures';
import { seedCopyStmts } from '../../src/memory/seed-copy';
import { createRulesPort } from '../../src/platform/rules';
import { aiReq, cand, makeD1Harness, rulesIn, workspaceCookie } from './llm-helpers';

const precomputed = import.meta.glob('../../../web/public/precomputed/*.json', {
  eager: true,
  import: 'default',
  query: '?raw',
});

async function seedFirms(): Promise<string[]> {
  const r = await env.DB.prepare(
    "SELECT DISTINCT law_firm_id AS f FROM firm_rule WHERE workspace_id = 'ws_demo' ORDER BY f",
  ).all<{ f: string }>();
  return r.results.map((x) => x.f);
}

describe('rules-hash-seed-parity (AC34)', () => {
  test("the committed precomputed files are keyed 'none' and match the Worker's no-rules hash", () => {
    const names = Object.keys(precomputed).map((p) => p.split('/').pop()!);
    expect(names.length).toBeGreaterThanOrEqual(2);
    for (const n of names) expect(n).toMatch(/^[a-f0-9]{64}\.none\.json$/);
    for (const text of Object.values(precomputed))
      expect(JSON.parse(String(text))).toMatchObject({ rulesHash8: 'none' });
    expect(rulesHash8(selectInjectedRules([]).hash)).toBe('none');
  });

  test("bundled-sample requests (no firm, or a read-only demo cookie) inject no rules -> 'none'", async () => {
    const h = makeD1Harness();
    h.or.reply(okAi(), okAi());
    const sandbox = await mkWorkspace(env.DB);
    await env.DB.batch(seedCopyStmts(env.DB, sandbox, 1_000));
    await frames(
      await send(h, {
        cookie: await workspaceCookie(sandbox),
        body: aiReq([cand('Sample A.')], null),
        ip: '198.51.100.41',
      }),
    );
    await frames(
      await send(h, {
        cookie: await workspaceCookie('ws_demo', { a: 'ro' }),
        body: aiReq([cand('Sample B.')], 'firm-x'),
        ip: '198.51.100.42',
      }),
    );
    expect(h.rulesCalls).toHaveLength(0);
    for (const c of h.or.calls) expect(rulesIn(c)).toEqual([]);
  });

  test('a sandbox copy of the demo seed yields the same rules hash as the demo seed, per firm', async () => {
    const sandbox = await mkWorkspace(env.DB);
    await env.DB.batch(seedCopyStmts(env.DB, sandbox, 1_000));
    const firms = await seedFirms();
    expect(firms.length).toBeGreaterThan(0);
    for (const f of firms) {
      const demo = await createRulesPort(env.DB, 'ws_demo').activeRules(f);
      const copy = await createRulesPort(env.DB, sandbox).activeRules(f);
      expect(copy.rules_hash).toBe(demo.rules_hash);
      expect(rulesHash8(selectInjectedRules(copy.texts).hash)).toBe(
        rulesHash8(selectInjectedRules(demo.texts).hash),
      );
      expect(copy.rules_hash).toBe(rulesHash(demo.texts));
    }
    // and through the Worker: the sandbox injects exactly the demo's active firm-x rules
    const h = makeD1Harness();
    h.or.reply(okAi());
    await frames(
      await send(h, {
        cookie: await workspaceCookie(sandbox),
        body: aiReq([cand('Seed parity.')], 'firm-x'),
        ip: '198.51.100.43',
      }),
    );
    const demoX = await createRulesPort(env.DB, 'ws_demo').activeRules('firm-x');
    expect(rulesIn(h.or.calls[0]!)).toEqual(selectInjectedRules(demoX.texts).texts);
  });
});
