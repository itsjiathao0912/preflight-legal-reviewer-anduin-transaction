// Shared endpoint scenario for the query-budget and rows-written gates (not a gate file).
import { env } from 'cloudflare:test';
import { parseFrameStream } from '@aduin/core';
import { createApp } from '../../src/app';
import { meteredDb } from '../../src/db/meta';
import { capFor } from '../../src/limits/policy';
import { loadConfig } from '../../src/config';
import { createD1Breaker, createD1Platform, withSessionCaps } from '../../src/platform/index';
import { claimPurgeSlot } from '../../src/memory/repo/purge';
import { aiBody, API_KEY, req } from '../fakes/harness';
import { OpenRouterStub, okAi } from '../fakes/openrouter-stub';
import { TS_PASS, TurnstileStub } from '../fakes/turnstile-stub';
import {
  call,
  decide,
  fpOf,
  KEYS,
  makeMem,
  newRun,
  op,
  session,
  wireFinding,
} from './memory-harness';

export interface Measured {
  queries: number;
  rowsWritten: number;
}

export async function measureEndpoints(): Promise<Record<string, Measured>> {
  const out: Record<string, Measured> = {};
  const h = makeMem();
  const take = (name: string) => {
    out[name] = { queries: h.stats.queries, rowsWritten: h.stats.rowsWritten };
    h.resetStats();
  };
  // keep the lazy purge slot claimed so `session` measures the common path
  await claimPurgeSlot(env.DB, h.clock.now + 10_000);
  h.resetStats();
  const s = await session(h);
  take('session');
  const run = await newRun(h, s);
  take('runs');
  const findings = Array.from({ length: 25 }, (_, i) =>
    wireFinding('firm-x', `Budget finding sentence ${i}.`),
  );
  await call(
    h,
    'POST',
    `/api/runs/${run}/findings`,
    { client_op_id: op(), findings },
    { cookie: s.cookie },
  );
  take('findings_25');
  await call(
    h,
    'POST',
    '/api/memory/lookup',
    {
      law_firm_id: 'firm-x',
      fingerprints: findings
        .map((f) => f.fingerprint)
        .concat(Array.from({ length: 175 }, (_, i) => fpOf('firm-x', 'ambiguity', `pad ${i}`))),
    },
    { cookie: s.cookie },
  );
  take('lookup_200');
  for (let i = 0; i < 2; i++)
    await decide(h, s, {
      runId: run,
      quote: `Budget dismissal ${i}.`,
      patternKey: 'budget:key',
      reason: 'no_form_impact',
    });
  h.resetStats();
  const d = await decide(h, s, {
    runId: run,
    quote: 'Budget dismissal 2.',
    patternKey: 'budget:key',
    reason: 'no_form_impact',
  });
  take('decision_dismiss_with_proposal');
  const d2 = await decide(h, s, {
    runId: run,
    quote: 'Budget dismissal 2.',
    patternKey: 'budget:key',
    reason: 'tool_false_alarm',
  });
  take('decision_supersede');
  await call(
    h,
    'POST',
    `/api/decisions/${d2.body.decision.id}/revoke`,
    { client_op_id: op(), reason: 'undo' },
    { cookie: s.cookie },
  );
  take('revoke');
  const quote = 'Budget counsel quote.';
  const fp = fpOf('firm-x', 'ambiguity', quote);
  await decide(h, s, {
    runId: run,
    quote,
    decision: 'accepted',
    cls: 'ambiguity',
    findingRef: 'bq',
  });
  h.resetStats();
  const q = await call(
    h,
    'POST',
    '/api/counsel/questions',
    { client_op_id: op(), finding_ref: 'bq', fingerprint: fp, interpretations: ['a', 'b'] },
    { cookie: s.cookie },
  );
  take('counsel_question');
  await call(
    h,
    'POST',
    '/api/counsel/answers',
    {
      client_op_id: op(),
      question_id: q.body.question_id,
      option: 'A',
      quote_text: quote,
      fingerprint: fp,
    },
    { cookie: s.cookie },
  );
  take('counsel_answer');
  const rules = await call(h, 'GET', '/api/rules?law_firm_id=firm-x', undefined, {
    cookie: s.cookie,
  });
  take('rules_list');
  const proposed = rules.body.rules.find((r: { status: string }) => r.status === 'proposed');
  await call(
    h,
    'POST',
    `/api/rules/${encodeURIComponent(proposed.id)}/approve`,
    { client_op_id: op() },
    { cookie: s.cookie },
  );
  take('rule_approve');
  await call(h, 'GET', '/api/memory/firm?law_firm_id=firm-x', undefined, { cookie: s.cookie });
  take('firm');
  await call(h, 'GET', '/api/audit?limit=50', undefined, { cookie: s.cookie });
  take('audit');
  await call(
    h,
    'POST',
    `/api/runs/${run}/export`,
    { client_op_id: op(), question_count: 1 },
    { cookie: s.cookie },
  );
  take('run_export');
  await call(h, 'GET', '/api/export', undefined, { cookie: s.cookie });
  take('export');
  // session that also claims the lazy purge slot (worst session path)
  await env.DB.prepare("UPDATE app_meta SET value = '0' WHERE key = 'last_purge_at'").run();
  h.resetStats();
  await session(h);
  take('session_with_purge');
  void d;
  return out;
}

/** The AI worst path on the D1 platform (incl. breaker read): D1 queries + outbound fetches. */
export async function measureAi(): Promise<{
  queries: number;
  fetches: number;
  rowsWritten: number;
}> {
  const m = meteredDb(env.DB);
  const or = new OpenRouterStub();
  const ts = new TurnstileStub();
  or.other = ts.handle;
  or.reply(okAi());
  const e = {
    COOKIE_SIGNING_KEYS: JSON.stringify(KEYS),
    COOKIE_SIGNING_KID: 'k1',
    OPENROUTER_API_KEY: API_KEY,
    TURNSTILE_SECRET: TS_PASS,
    DB: m.db,
  };
  let now = Date.UTC(2026, 9, 17, 12);
  const app = createApp({
    fetch: or.fetch,
    now: () => now,
    proxy: {
      platform: createD1Platform(m.db, {
        capFor: withSessionCaps(capFor(loadConfig(e))),
        now: () => now,
      }),
      breaker: createD1Breaker(m.db, () => now),
      log: () => {},
    },
  });
  now += 1000;
  const res = await app.fetch(
    req({ path: '/api/ai', body: aiBody(`Budget AI quote ${Math.random()}`) }),
    e as never,
    { waitUntil() {}, passThroughOnException() {} } as never,
  );
  const frames = parseFrameStream(await res.text());
  if (frames.terminal.t !== 'result')
    throw new Error(`ai path did not complete: ${JSON.stringify(frames.terminal)}`);
  return {
    queries: m.stats.queries,
    fetches: or.calls.length + ts.calls,
    rowsWritten: m.stats.rowsWritten,
  };
}
