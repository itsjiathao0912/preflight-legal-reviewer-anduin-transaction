import { expect, test } from '@playwright/test';
import {
  aiRows,
  callsOf,
  isRefTarget,
  noRefTargetFindings,
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
import { gotoApp, uploadSample } from './fixtures/app';

// AC35: after a downgrade with a known reset, AI resumes on its own (timer / tab focus) without any
// click. Failures without a reset (provider error) never auto-retry: only the manual Retry.
// Two-pass lane (F7): sample #5 has reference pairs, so a successful clause-judgment call is
// followed by one reference-target call (answered clean). Re-billing is counted per task: a failed
// clause-judgment call never sends reference-target, and each pass runs once per attempt.
test.describe('ai-resume', () => {
  test('AI resumes after the reset without manual action', async ({ page }) => {
    await gotoApp(page);
    await interceptQuota(page);
    let clause = 0;
    const calls = await interceptAi(page, (call) =>
      isRefTarget(call)
        ? noRefTargetFindings()
        : ++clause === 1
          ? {
              kind: 'http',
              status: 429,
              code: 'quota_exhausted',
              reason: 'visitor_limit',
              retry_after_s: 1,
            }
          : {
              kind: 'stream',
              body: ndjson(hb, resultFrame([findingFor(call.body.candidates[0]!)])),
            },
    );
    await enableLane(page);
    await uploadSample(page, '05');
    // an uploaded document auto-runs AI (no "Run AI on this sample" step)
    await expect(page.getByTestId('ai-banner')).toHaveAttribute('data-reason', 'visitor_limit');
    await expect(page.getByTestId('ai-banner')).toContainText('AI resumes shortly');
    // no click from here on
    await expect(page.getByTestId('ai-banner')).toHaveCount(0, { timeout: 15_000 });
    await expectStage(page, /^Checks done · AI review done/);
    await expect(aiRows(page)).toHaveCount(1);
    expect(callsOf(calls, 'clause-judgment')).toHaveLength(2);
    expect(callsOf(calls, 'reference-target')).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });

  test('a provider error does not auto-retry; Retry runs it again', async ({ page }) => {
    await gotoApp(page);
    await interceptQuota(page);
    let clause = 0;
    const calls = await interceptAi(page, (call) =>
      isRefTarget(call)
        ? noRefTargetFindings()
        : ++clause === 1
          ? { kind: 'stream', body: ndjson(hb, errorFrame('upstream_failed', 'timeout')) }
          : {
              kind: 'stream',
              body: ndjson(hb, resultFrame([findingFor(call.body.candidates[0]!)])),
            },
    );
    await enableLane(page);
    await uploadSample(page, '05');
    // an uploaded document auto-runs AI (no "Run AI on this sample" step)
    await expect(page.getByTestId('ai-banner')).toHaveAttribute('data-reason', 'provider_error');
    await expectStage(page, /^Checks done · AI review unavailable/);
    await page.waitForTimeout(2500);
    expect(calls).toHaveLength(1); // clause-judgment failed: no auto-retry, no reference-target
    await page.getByTestId('ai-retry').click();
    await expect(page.getByTestId('ai-banner')).toHaveCount(0);
    await expect(aiRows(page)).toHaveCount(1);
    expect(callsOf(calls, 'clause-judgment')).toHaveLength(2);
    expect(callsOf(calls, 'reference-target')).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });
});
