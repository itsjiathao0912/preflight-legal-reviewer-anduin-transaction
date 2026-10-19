import { expect, test } from '@playwright/test';
import { enableLane, expectStage, interceptAi, interceptQuota, type AiReply } from './fixtures/ai';
import { gotoApp, openSample } from './fixtures/app';

// AC35: each downgrade reason shows ONE banner that names the reason and what is skipped; the
// deterministic review keeps working (rule findings stay).
const SKIPPED = 'ambiguity, contradiction and typo passes are skipped';

const CASES: { name: string; reply: AiReply; banner: string; text: RegExp }[] = [
  {
    name: 'per-visitor limit',
    reply: { kind: 'http', status: 429, code: 'quota_exhausted', reason: 'visitor_limit' },
    banner: 'visitor_limit',
    text: /fresh-AI documents for today are used up/,
  },
  {
    name: 'shared daily cap',
    reply: { kind: 'http', status: 429, code: 'quota_exhausted', reason: 'global_cap' },
    banner: 'daily_cap',
    text: /shared AI allowance is used up/,
  },
  {
    name: 'AI disabled on the server',
    reply: { kind: 'http', status: 429, code: 'quota_exhausted', reason: 'ai_disabled' },
    banner: 'ai_disabled',
    text: /AI review is disabled on the server/,
  },
  {
    name: 'AI unavailable',
    reply: { kind: 'http', status: 429, code: 'quota_exhausted', reason: 'ai_unavailable' },
    banner: 'ai_unavailable',
    text: /not available on the server/,
  },
  // OpenAI provider plan (4.4): spend_cap is the lifetime cap, so it gets its own banner (no
  // "for today"); a budget_cap without a known reason keeps the daily budget banner
  {
    name: 'spend limit',
    reply: { kind: 'http', status: 503, code: 'budget_cap', reason: 'spend_cap' },
    banner: 'spend_limit',
    text: /spend limit has been reached/,
  },
  {
    name: 'budget',
    reply: { kind: 'http', status: 503, code: 'budget_cap' },
    banner: 'budget',
    text: /AI budget for today is used up/,
  },
  {
    name: 'circuit breaker',
    reply: { kind: 'http', status: 503, code: 'budget_cap', reason: 'circuit_breaker' },
    banner: 'breaker',
    text: /paused by a safety stop/,
  },
  {
    name: 'rate limited',
    reply: { kind: 'http', status: 429, code: 'rate_limited', reason: 'rate', retry_after_s: 600 },
    banner: 'rate',
    text: /too many AI requests/,
  },
  {
    name: 'verification needed',
    reply: { kind: 'http', status: 401, code: 'invalid_session', reason: 'turnstile_missing' },
    banner: 'verification',
    text: /verification is needed/,
  },
  {
    name: 'provider error',
    reply: { kind: 'http', status: 502, code: 'upstream_failed', reason: 'provider_error' },
    banner: 'provider_error',
    text: /AI provider did not answer/,
  },
  {
    name: 'rules unavailable',
    reply: { kind: 'http', status: 503, code: 'memory_unavailable', reason: 'rules_unavailable' },
    banner: 'rules_unavailable',
    text: /firm rules could not be read/,
  },
];

test.describe('auto-downgrade', () => {
  test('should show the banner naming the reason and what is skipped when quota is out', async ({
    page,
  }) => {
    await gotoApp(page);
    await interceptQuota(page);
    const calls = await interceptAi(page, () => CASES[0]!.reply);
    await enableLane(page);
    await openSample(page, '05');
    const rules = await page.getByTestId('finding-row').count();
    await page.getByTestId('ai-run-sample').click();
    const banner = page.getByTestId('ai-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-reason', 'visitor_limit');
    await expect(banner).toContainText('AI review skipped');
    await expect(banner).toContainText(CASES[0]!.text);
    await expect(banner).toContainText(SKIPPED);
    await expect(banner).toContainText('AI resumes at 00:00 UTC');
    await expectStage(page, /^Checks done · AI review skipped/);
    await expect(page.getByTestId('finding-row')).toHaveCount(rules);
    expect(calls).toHaveLength(1);
  });

  test('every downgrade reason (pre-stream HTTP refusal) has its own banner', async ({ page }) => {
    await gotoApp(page);
    await interceptQuota(page);
    let current = CASES[0]!;
    await interceptAi(page, () => current.reply);
    await enableLane(page);
    for (const c of CASES) {
      current = c;
      await openSample(page, '05');
      await page.getByTestId('ai-run-sample').click();
      const banner = page.getByTestId('ai-banner');
      await expect(banner, c.name).toHaveAttribute('data-reason', c.banner);
      await expect(banner, c.name).toContainText(c.text);
      await expect(banner, c.name).toContainText(SKIPPED);
      await expect(banner).toHaveCount(1);
    }
  });
});
