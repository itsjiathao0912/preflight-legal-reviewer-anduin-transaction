// AC9 (OpenAI provider plan, M2): the reservation is taken BEFORE dispatch with one guarded atomic
// statement, so parallel calls near the cap can never push the lifetime counter above $10, and a
// refused call never reaches the upstream.
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, test } from 'vitest';
import { loadConfig } from '../../src/config';
import { capFor } from '../../src/limits/policy';
import { withSessionCaps } from '../../src/platform/index';
import { createD1Spend, OPENAI_SPEND_KEY } from '../../src/platform/spend';
import { aiBody, frames, send } from '../fakes/harness';
import { aiAnswer } from '../fakes/openai-stub';
import { makeOpenAiHarness, openAiEnv } from '../fakes/openai-harness';

const CAP = 10_000_000;
const roomy = openAiEnv({
  VISITOR_AI_REQS_PER_DAY: '1000',
  VISITOR_AI_DOCS_PER_DAY: '1000',
  GLOBAL_PROVIDER_REQS_PER_DAY: '1000',
  PROVIDER_ALLOWANCE_PER_DAY: '1000',
});

beforeEach(async () => {
  await env.DB.prepare(
    "DELETE FROM quota_counter WHERE scope = 'spend' AND key = 'spend|openai'",
  ).run();
});

describe('spend-cap-concurrency (AC9)', () => {
  test('should never let parallel calls push spend above the cap (D1 guarded claim)', async () => {
    const s = createD1Spend(env.DB, {
      capFor: withSessionCaps(capFor(loadConfig(roomy))),
      now: () => Date.UTC(2026, 9, 19),
    });
    const W = 25_000;
    const pre = await s.reserve(CAP - 3 * W - 1);
    expect(pre.ok).toBe(true);
    const results = await Promise.all(Array.from({ length: 12 }, () => s.reserve(W)));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(await s.peek()).toBeLessThanOrEqual(CAP);
    expect(await s.peek()).toBe(CAP - 1);
  });

  test('pipeline: N parallel requests near the cap; refused calls make 0 fetches', async () => {
    const h = makeOpenAiHarness({ env: roomy });
    // learn the worst case W of one request (usage missing -> the reservation is kept)
    h.oa.reply({ answer: aiAnswer(), usage: null });
    await frames(await send(h, { body: aiBody('quote-00') }));
    const W = h.platform.spendLog.find((e) => e.op === 'reserve')!.units!;
    expect(h.platform.spendTotal).toBe(W);
    h.platform.set(OPENAI_SPEND_KEY, CAP - 3 * W);
    const N = 8;
    for (let i = 0; i < N; i++) h.oa.reply({ answer: aiAnswer(), usage: null });
    const calls0 = h.oa.calls.length;
    const res = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        send(h, {
          body: aiBody(`quote-${String(i + 1).padStart(2, '0')}`),
          ip: `198.51.100.${i + 1}`,
        }),
      ),
    );
    const statuses = await Promise.all(
      res.map(async (r) => (r.status === 200 ? (await frames(r)).terminal.t : r.status)),
    );
    const ok = statuses.filter((s) => s === 'result').length;
    expect(ok).toBe(3);
    expect(statuses.filter((s) => s === 503)).toHaveLength(N - 3);
    expect(h.oa.calls.length - calls0).toBe(ok); // refused calls never reached the upstream
    expect(h.platform.spendTotal).toBeLessThanOrEqual(CAP);
  });
});
