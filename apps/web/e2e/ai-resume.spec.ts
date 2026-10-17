import { expect, test } from '@playwright/test';
import {
  aiRows,
  enableLane,
  errorFrame,
  expectStage,
  findingFor,
  hb,
  interceptAi,
  interceptQuota,
  ndjson,
  resultFrame,
} from './fixtures/ai';
import { gotoApp, openSample } from './fixtures/app';

// AC35: after a downgrade with a known reset, AI resumes on its own (timer / tab focus) without any
// click. Failures without a reset (provider error) never auto-retry: only the manual Retry.
test.describe('ai-resume', () => {
  test('AI resumes after the reset without manual action', async ({ page }) => {
    await gotoApp(page);
    await interceptQuota(page);
    const calls = await interceptAi(page, (call, n) =>
      n === 1
        ? {
            kind: 'http',
            status: 429,
            code: 'quota_exhausted',
            reason: 'visitor_limit',
            retry_after_s: 1,
          }
        : { kind: 'stream', body: ndjson(hb, resultFrame([findingFor(call.body.candidates[0]!)])) },
    );
    await enableLane(page);
    await openSample(page, '05');
    await page.getByTestId('ai-run-sample').click();
    await expect(page.getByTestId('ai-banner')).toHaveAttribute('data-reason', 'visitor_limit');
    await expect(page.getByTestId('ai-banner')).toContainText('AI resumes shortly');
    // no click from here on
    await expect(page.getByTestId('ai-banner')).toHaveCount(0, { timeout: 15_000 });
    await expectStage(page, /^Checks done · AI review done/);
    await expect(aiRows(page)).toHaveCount(1);
    expect(calls).toHaveLength(2);
  });

  test('a provider error does not auto-retry; Retry runs it again', async ({ page }) => {
    await gotoApp(page);
    await interceptQuota(page);
    const calls = await interceptAi(page, (call, n) =>
      n === 1
        ? { kind: 'stream', body: ndjson(hb, errorFrame('upstream_failed', 'timeout')) }
        : { kind: 'stream', body: ndjson(hb, resultFrame([findingFor(call.body.candidates[0]!)])) },
    );
    await enableLane(page);
    await openSample(page, '05');
    await page.getByTestId('ai-run-sample').click();
    await expect(page.getByTestId('ai-banner')).toHaveAttribute('data-reason', 'provider_error');
    await expectStage(page, /^Checks done · AI review unavailable/);
    await page.waitForTimeout(2500);
    expect(calls).toHaveLength(1);
    await page.getByTestId('ai-retry').click();
    await expect(page.getByTestId('ai-banner')).toHaveCount(0);
    await expect(aiRows(page)).toHaveCount(1);
    expect(calls).toHaveLength(2);
  });
});
