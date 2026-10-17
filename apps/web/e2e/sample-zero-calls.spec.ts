import { expect, test, type Request } from '@playwright/test';
import { limits } from '@aduin/core';
import {
  aiRows,
  blockOpenRouter,
  enableLane,
  expectStage,
  forbidAi,
  interceptQuota,
} from './fixtures/ai';
import { gotoApp, openSample } from './fixtures/app';

// AC34: bundled samples (and identical documents) open with zero new AI calls. Lookup order is
// static /precomputed/{docHash}.{rulesHash8}.json first; samples without a file show an explicit
// "Run AI on this sample" button and never call /api/ai on open.
test.describe('sample-zero-calls', () => {
  test('should make zero /api/ai calls when opening a precomputed sample', async ({ page }) => {
    const order: string[] = [];
    page.on('request', (r: Request) => {
      const u = new URL(r.url());
      if (/^\/(api|precomputed)\//.test(u.pathname)) order.push(u.pathname);
    });
    await gotoApp(page);
    const ai = await forbidAi(page);
    await interceptQuota(page);
    const outbound = await blockOpenRouter(page);
    await enableLane(page);

    await openSample(page, '01');
    await expectStage(page, /^Checks done · AI review from cache/);
    // 3 since review M1 (each AI quote anchors in its own cited candidate; was 2)
    await expect(aiRows(page)).toHaveCount(3);
    await openSample(page, '03');
    await expectStage(page, /^Checks done · AI review from cache/);
    await expect(aiRows(page)).toHaveCount(2);

    expect(ai, 'no /api/ai call on open').toEqual([]);
    expect(outbound, 'no browser request to openrouter.ai').toEqual([]);
    const pre = order.filter((p) => p.startsWith('/precomputed/'));
    expect(pre).toHaveLength(2);
    for (const p of pre) expect(p).toMatch(/^\/precomputed\/[0-9a-f]{64}\.none\.json$/);
    expect(order).not.toContain('/api/ai');
  });

  test('a sample without a saved AI review shows "Run AI on this sample" and never auto-calls', async ({
    page,
  }) => {
    await gotoApp(page);
    const ai = await forbidAi(page);
    await interceptQuota(page);
    await enableLane(page);
    await openSample(page, '05');
    await expectStage(page, /^Checks done · AI review not run/);
    await expect(page.getByTestId('ai-not-precomputed')).toBeVisible();
    await expect(page.getByTestId('ai-run-sample')).toHaveText('Run AI on this sample');
    await expect(aiRows(page)).toHaveCount(0);
    await expect(page.getByTestId('ai-banner')).toHaveCount(0);
    expect(ai).toEqual([]);
  });

  test('should keep the AI lane inert in the preview build until a spec turns it on through the e2e hook', async ({
    page,
  }) => {
    const net: string[] = [];
    page.on('request', (r: Request) => {
      const u = new URL(r.url());
      if (/^\/(api|precomputed)\//.test(u.pathname)) net.push(u.pathname);
    });
    await gotoApp(page);
    await openSample(page, '01');
    await expectStage(page, /^Checks done · AI review not connected/);
    await expect(aiRows(page)).toHaveCount(0);
    await expect(page.getByTestId('ai-banner')).toHaveCount(0);
    await expect(page.getByTestId('ai-not-precomputed')).toHaveCount(0);
    await expect(page.getByTestId('ai-allowance')).toHaveText(
      `${limits.visitorAiDocsPerDay} of ${limits.visitorAiDocsPerDay} fresh-AI documents left today`,
    );
    expect(net, 'no /api or /precomputed request without the hook').toEqual([]);
  });
});

test.describe('sample-zero-calls (firm rules)', () => {
  test('a bundled sample tagged with a firm that has active rules never uses the .none file', async ({
    page,
  }) => {
    const pre: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/precomputed/')) pre.push(new URL(r.url()).pathname);
    });
    await gotoApp(page);
    const ai = await forbidAi(page);
    await interceptQuota(page);
    await page.evaluate(() =>
      (
        window as unknown as { __aduinE2E: { setFirmRules: (t: string[]) => void } }
      ).__aduinE2E.setFirmRules(['Placeholders on the wire FFC line are firm standard wording.']),
    );
    await enableLane(page);
    await openSample(page, '03');
    await expectStage(page, /^Checks done · AI review not run/);
    await expect(page.getByTestId('ai-run-sample')).toBeVisible();
    await expect(aiRows(page)).toHaveCount(0);
    expect(pre).toHaveLength(1);
    expect(pre[0]).toMatch(/^\/precomputed\/[0-9a-f]{64}\.[0-9a-f]{8}\.json$/);
    expect(ai).toEqual([]);
  });
});
