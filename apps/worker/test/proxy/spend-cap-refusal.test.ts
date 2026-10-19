// AC12 (OpenAI provider plan, M2): at the cap a call is refused with budget_cap / spend_cap and a
// plain message, ZERO upstream fetches, and every earlier claim (visitor + global) refunded.
import { describe, expect, test } from 'vitest';
import { messageFor } from '../../src/proxy/errors';
import { OPENAI_SPEND_KEY } from '../../src/platform/spend';
import { ocrBody, send } from '../fakes/harness';
import { makeOpenAiHarness } from '../fakes/openai-harness';

describe('spend-cap-refusal (AC12)', () => {
  for (const kind of ['ai', 'ocr'] as const) {
    test(`should refuse at the cap with zero upstream calls (${kind})`, async () => {
      const h = makeOpenAiHarness();
      h.platform.set(OPENAI_SPEND_KEY, 10_000_000 - 10);
      const res = await send(h, kind === 'ocr' ? { path: '/api/ocr', body: ocrBody() } : {});
      expect(res.status).toBe(503);
      const j = (await res.json()) as { error: Record<string, unknown> };
      expect(j.error).toEqual({
        code: 'budget_cap',
        message: messageFor('budget_cap'),
        reason: 'spend_cap',
      });
      expect(h.oa.calls).toHaveLength(0);
      // earlier claims all refunded: every non-spend counter is back at 0
      const taken = h.platform.claimLog.filter((c) => c.ok);
      expect(taken.length).toBeGreaterThan(0);
      for (const c of taken) expect(h.platform.count(c.key)).toBe(0);
      expect(h.platform.spendTotal).toBe(10_000_000 - 10);
      const refused = h.platform.spendLog.filter((e) => e.op === 'reserve');
      expect(refused).toHaveLength(1);
      expect(refused[0]!.ok).toBe(false);
    });
  }

  test('a spend port error before dispatch fails closed (no upstream, claims refunded)', async () => {
    const h = makeOpenAiHarness();
    h.platform.spendDown = true;
    const res = await send(h);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      error: { code: 'quota_exhausted', reason: 'ai_unavailable' },
    });
    expect(h.oa.calls).toHaveLength(0);
    for (const c of h.platform.claimLog.filter((x) => x.ok))
      expect(h.platform.count(c.key)).toBe(0);
  });

  test('a platform without a spend port never dispatches a metered call', async () => {
    const base = makeOpenAiHarness();
    const h = makeOpenAiHarness({
      platform: base.platform,
      appPlatform: {
        quota: (k) => base.platform.quota(k),
        cache: base.platform.cache,
        ledger: base.platform.ledger,
      },
    });
    const res = await send(h);
    expect(res.status).toBe(429);
    expect(h.oa.calls).toHaveLength(0);
  });
});
