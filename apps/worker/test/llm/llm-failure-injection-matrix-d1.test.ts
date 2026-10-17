// AC26, AC32, AC33 on the D1-backed platform (real SQL quota/cache/ledger/rules ports on local D1):
// every injected failure degrades with a reason code, refunds per the 04a policy and caches
// nothing; partial-invalid model output keeps the valid findings; a truncated reply is malformed.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { okAi, type StubReply } from '../fakes/openrouter-stub';
import { frames, send } from '../fakes/harness';
import { mkWorkspace } from '../memory/db-fixtures';
import { aiReq, cand, insertRule, makeD1Harness, workspaceCookie } from './llm-helpers';

let n = 0;
/** Fresh visitor + IP per scenario (storage is shared by the tests of this file). */
async function visitor() {
  n++;
  const v = `mx${n}${Math.random().toString(36).slice(2, 8)}`;
  return { v, ip: `192.0.2.${n}`, cookie: await workspaceCookie(undefined, { v }) };
}

async function sum(where: string, ...binds: unknown[]): Promise<number> {
  const r = await env.DB.prepare(
    `SELECT COALESCE(SUM(count), 0) AS s FROM quota_counter WHERE ${where}`,
  )
    .bind(...binds)
    .first<{ s: number }>();
  return r?.s ?? 0;
}
const visitorHeld = (v: string) =>
  sum("scope NOT IN ('global_ai','spend') AND key LIKE ?1", `%${v}%`);
const globalHeld = () => sum("scope = 'global_ai'");
async function rows(table: 'ai_cache' | 'spend_ledger'): Promise<number> {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS c FROM ${table}`).first<{ c: number }>();
  return r?.c ?? 0;
}

function content(c: string, finish = 'stop'): StubReply {
  return {
    status: 200,
    json: {
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      choices: [{ message: { content: c }, finish_reason: finish }],
      usage: { cost: 0, prompt_tokens: 10, completion_tokens: 5 },
    },
  };
}

const finding = (over: Record<string, unknown> = {}) => ({
  candidate_id: 'c1',
  issue_class: 'ambiguity',
  severity: 'medium',
  confidence: 0.7,
  quote: 'Matrix clause',
  explanation: 'Two readings.',
  interpretations: [],
  ...over,
});

type Row = [string, StubReply, Record<string, unknown>, 'visitor' | 'kept'];
const rowsMatrix: Row[] = [
  [
    'dispatched 5xx',
    { status: 502, text: 'bad gateway' },
    { code: 'upstream_failed', reason: 'provider_error' },
    'visitor',
  ],
  [
    '429',
    { status: 429, json: {}, headers: { 'retry-after': '7' } },
    { code: 'upstream_failed', reason: 'provider_rate_limited', retry_after_s: 7 },
    'visitor',
  ],
  ['402', { status: 402, json: {} }, { code: 'budget_cap', reason: 'provider_balance' }, 'visitor'],
  ['network', { throws: 'ECONNRESET' }, { code: 'upstream_failed', reason: 'network' }, 'visitor'],
  [
    'prose without JSON',
    content('I cannot help with that.'),
    { code: 'upstream_failed', reason: 'malformed' },
    'kept',
  ],
  [
    'no findings array',
    content('{"result":[]}'),
    { code: 'upstream_failed', reason: 'malformed' },
    'kept',
  ],
  [
    'truncated reply (finish_reason length)',
    content(JSON.stringify({ findings: [finding()] }), 'length'),
    { code: 'upstream_failed', reason: 'malformed' },
    'kept',
  ],
  [
    '200 with error field',
    { status: 200, json: { error: { message: 'boom' } } },
    { code: 'upstream_failed', reason: 'provider_error' },
    'kept',
  ],
];

describe('llm-failure-injection-matrix-d1 (AC26, AC32, AC33)', () => {
  for (const [name, reply, expected, refund] of rowsMatrix) {
    test(`${name} -> degrade frame, ${refund === 'visitor' ? 'visitor refunded, global kept' : 'all claims kept'}, nothing cached`, async () => {
      const h = makeD1Harness();
      const who = await visitor();
      const g0 = await globalHeld();
      const c0 = await rows('ai_cache');
      const l0 = await rows('spend_ledger');
      h.or.reply(reply);
      const res = await send(h, {
        cookie: who.cookie,
        ip: who.ip,
        body: aiReq([cand(`Matrix clause ${name}.`)], null),
      });
      expect(res.status).toBe(200);
      const { terminal } = await frames(res);
      expect(terminal).toMatchObject({ t: 'error', ...expected });
      expect(await globalHeld()).toBe(g0 + 1);
      if (refund === 'visitor') expect(await visitorHeld(who.v)).toBe(0);
      else expect(await visitorHeld(who.v)).toBeGreaterThan(0);
      expect(await rows('ai_cache')).toBe(c0);
      expect(await rows('spend_ledger')).toBe(l0);
      expect(h.or.calls).toHaveLength(1);
    });
  }

  test('should keep valid findings when one finding in the model result is invalid', async () => {
    const h = makeD1Harness();
    const who = await visitor();
    const c0 = await rows('ai_cache');
    const l0 = await rows('spend_ledger');
    h.or.reply(
      content(
        JSON.stringify({
          findings: [
            finding(),
            finding({ severity: 'critical' }),
            finding({ candidate_id: 'unknown' }),
          ],
        }),
      ),
    );
    const { terminal } = await frames(
      await send(h, {
        cookie: who.cookie,
        ip: who.ip,
        body: aiReq([cand('Matrix clause partial.')], null),
      }),
    );
    expect(terminal).toMatchObject({ t: 'result', kind: 'ai', cache: 'miss' });
    const data = (terminal as { data: Record<string, unknown> }).data;
    expect(data['findings']).toHaveLength(1);
    expect(data['ext']).toEqual({ dropped: 2 });
    expect(data['usage']).toEqual({ tokens_in: 10, tokens_out: 5 });
    expect(data['v']).toBe(1);
    expect(await rows('ai_cache')).toBe(c0 + 1);
    expect(await rows('spend_ledger')).toBe(l0 + 1);
  });

  test('zero valid findings in a well-formed reply is a valid empty result, not malformed', async () => {
    const h = makeD1Harness();
    const who = await visitor();
    h.or.reply(content(JSON.stringify({ findings: [finding({ severity: 'critical' })] })));
    const { terminal } = await frames(
      await send(h, {
        cookie: who.cookie,
        ip: who.ip,
        body: aiReq([cand('Matrix clause empty.')], null),
      }),
    );
    expect(terminal).toMatchObject({
      t: 'result',
      cache: 'miss',
      data: { findings: [], ext: { dropped: 1 } },
    });
  });

  test('rules read failure with a firm -> 503 rules_unavailable, zero claims, zero upstream', async () => {
    const ws = await mkWorkspace(env.DB);
    await insertRule(ws, 'firm-x', 'active', 'Matrix rule.');
    const h = makeD1Harness();
    h.rulesDown = true;
    const v = `mxr${Math.random().toString(36).slice(2, 8)}`;
    const g0 = await globalHeld();
    const res = await send(h, {
      cookie: await workspaceCookie(ws, { v }),
      ip: '192.0.2.200',
      body: aiReq([cand('Matrix clause rules.')], 'firm-x'),
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      error: { code: 'memory_unavailable', reason: 'rules_unavailable' },
    });
    expect(h.or.calls).toHaveLength(0);
    expect(await visitorHeld(v)).toBe(0);
    expect(await globalHeld()).toBe(g0);
  });

  test('with rules on D1: miss then hit; the hit changes no quota row', async () => {
    const ws = await mkWorkspace(env.DB);
    await insertRule(ws, 'firm-x', 'active', 'Matrix hit rule.');
    const h = makeD1Harness();
    const v = `mxh${Math.random().toString(36).slice(2, 8)}`;
    const cookie = await workspaceCookie(ws, { v });
    const body = aiReq([cand('Matrix clause hit.')], 'firm-x');
    h.or.reply(okAi());
    expect(
      (await frames(await send(h, { cookie, ip: '192.0.2.201', body }))).terminal,
    ).toMatchObject({ cache: 'miss' });
    const held = await visitorHeld(v);
    const g = await globalHeld();
    expect(
      (await frames(await send(h, { cookie, ip: '192.0.2.201', body, turnstile: null }))).terminal,
    ).toMatchObject({ cache: 'hit' });
    expect(await visitorHeld(v)).toBe(held);
    expect(await globalHeld()).toBe(g);
    expect(h.or.calls).toHaveLength(1);
  });
});
