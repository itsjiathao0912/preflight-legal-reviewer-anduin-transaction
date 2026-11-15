import { expect, test } from '@playwright/test';
import {
  aiRows,
  enableLane,
  errorFrame,
  expectStage,
  forbidAi,
  hb,
  interceptAi,
  interceptQuota,
  ndjson,
  type AiReply,
} from './fixtures/ai';
import { gotoApp, openSample } from './fixtures/app';
import { openBundledSample5 } from './fixtures/package';

// AC26/AC32/AC33/AC35/AC3: one banner per reason from terminal NDJSON error frames (the same map
// as HTTP bodies), unusable answers, dropped streams, the real allowance and the AI toggle.
const FRAMES: { reply: AiReply; banner: string }[] = [
  {
    reply: { kind: 'stream', body: ndjson(hb, errorFrame('quota_exhausted', 'visitor_limit')) },
    banner: 'visitor_limit',
  },
  {
    reply: { kind: 'stream', body: ndjson(hb, errorFrame('quota_exhausted', 'global_cap')) },
    banner: 'daily_cap',
  },
  // OpenAI provider plan (4.4): a provider balance problem reads as "not available"; the lifetime
  // spend cap has its own banner that never promises a midnight reset (AC13)
  {
    reply: { kind: 'stream', body: ndjson(hb, errorFrame('budget_cap', 'provider_balance')) },
    banner: 'ai_unavailable',
  },
  {
    reply: { kind: 'stream', body: ndjson(hb, errorFrame('budget_cap', 'spend_cap')) },
    banner: 'spend_limit',
  },
  {
    reply: { kind: 'stream', body: ndjson(hb, errorFrame('budget_cap')) },
    banner: 'budget',
  },
  {
    reply: { kind: 'stream', body: ndjson(hb, errorFrame('budget_cap', 'circuit_breaker')) },
    banner: 'breaker',
  },
  {
    reply: { kind: 'stream', body: ndjson(hb, errorFrame('rate_limited', 'rate', 30)) },
    banner: 'rate',
  },
  {
    reply: { kind: 'stream', body: ndjson(hb, errorFrame('invalid_session', 'turnstile_failed')) },
    banner: 'verification',
  },
  {
    reply: {
      kind: 'stream',
      body: ndjson(hb, errorFrame('upstream_failed', 'provider_rate_limited')),
    },
    banner: 'provider_error',
  },
  {
    reply: { kind: 'stream', body: ndjson(hb, errorFrame('upstream_failed', 'malformed')) },
    banner: 'result_unusable',
  },
  {
    reply: {
      kind: 'stream',
      body: ndjson(hb, errorFrame('memory_unavailable', 'rules_unavailable')),
    },
    banner: 'rules_unavailable',
  },
  // client-side: a frame that is not valid, a stream that ends without a terminal frame
  {
    reply: { kind: 'stream', body: ndjson(hb, { t: 'result', kind: 'ai' }) },
    banner: 'result_unusable',
  },
  { reply: { kind: 'stream', body: ndjson(hb, hb) }, banner: 'provider_error' },
  // a result whose data is not an AI envelope
  {
    reply: {
      kind: 'stream',
      body: ndjson(hb, { t: 'result', kind: 'ai', data: { v: 9 }, cache: 'miss', model: 'm' }),
    },
    banner: 'result_unusable',
  },
];

test.describe('ai-banners', () => {
  test('terminal error frames map to one banner per reason', async ({ page }) => {
    await gotoApp(page);
    await interceptQuota(page);
    let current = FRAMES[0]!;
    await interceptAi(page, () => current.reply);
    await enableLane(page);
    for (const f of FRAMES) {
      current = f;
      await openBundledSample5(page);
      await page.getByTestId('ai-run-sample').click();
      const banner = page.getByTestId('ai-banner');
      await expect(banner, f.banner).toHaveAttribute('data-reason', f.banner);
      await expect(banner).toHaveCount(1);
      await expect(banner).toContainText('AI review skipped');
      await expect(page.getByTestId('finding-row').first()).toBeVisible();
      await expect(aiRows(page)).toHaveCount(0);
    }
  });

  // The allowance line (`ai-allowance`) is no longer rendered anywhere, so only the quota request
  // itself (with the client header) is asserted.
  test('quota is read from /api/quota with the client header', async ({ page }) => {
    await gotoApp(page);
    const q = await interceptQuota(page, { used: 1, limit: 3 });
    await enableLane(page);
    await expect.poll(() => q.calls).toBeGreaterThan(0);
    expect(q.headerOk).toBe(true);
  });

  test('a failing /api/quota shows no banner', async ({ page }) => {
    await gotoApp(page);
    await interceptQuota(page, { status: 500 });
    await forbidAi(page);
    await enableLane(page);
    await openSample(page, '01');
    await expect(page.getByTestId('ai-banner')).toHaveCount(0);
  });

  test('AI toggle off: AI findings leave, the AI stage is skipped and nothing calls the AI', async ({
    page,
  }) => {
    await gotoApp(page);
    await interceptQuota(page);
    const ai = await forbidAi(page);
    const pre: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/precomputed/')) pre.push(r.url());
    });
    await enableLane(page);
    await openSample(page, '01');
    await expect(aiRows(page)).toHaveCount(1); // 1 since ai-review-stream-dedup
    await page.getByTestId('ai-off').click();
    await expect(page.getByTestId('ai-off-banner')).toBeVisible();
    await expect(aiRows(page)).toHaveCount(0);
    await expectStage(page, /^Checks done · AI review off/);
    const seen = pre.length;
    await openBundledSample5(page);
    await expectStage(page, /^Checks done · AI review off/);
    await expect(page.getByTestId('ai-not-precomputed')).toHaveCount(0);
    await expect(page.getByTestId('ai-banner')).toHaveCount(0);
    expect(pre.length).toBe(seen);
    // switching back on (after the privacy notice) brings the lane back for the open document
    await page.getByTestId('ai-on').click();
    // (the notice shows only until it was accepted once: the earlier upload accepted it already)
    if (await page.getByTestId('privacy-accept').isVisible())
      await page.getByTestId('privacy-accept').click();
    await expectStage(page, /^Checks done · AI review not run/);
    await expect(page.getByTestId('ai-run-sample')).toBeVisible();
    expect(ai).toEqual([]);
  });
});
