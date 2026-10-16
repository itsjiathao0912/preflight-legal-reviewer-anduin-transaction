import { expect, test } from '@playwright/test';
import { gotoApp, openDialog, sample } from './fixtures/app';

/** Main-thread long-task budget while sample #2 (largest HTML sample) is parsed: no single task over 200 ms. */
const MAX_LONG_TASK_MS = 200;

test.describe('engine-worker-split', () => {
  test('should run document parsing in a dedicated worker', async ({ page }) => {
    const workers: string[] = [];
    page.on('worker', (w) => workers.push(w.url()));
    await gotoApp(page);
    expect(workers).toEqual([]);
    await page.evaluate(() => {
      const w = window as unknown as { __long: number[] };
      w.__long = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__long.push(e.duration);
      }).observe({ type: 'longtask', buffered: false });
    });
    await openDialog(page);
    await sample(page, '02').click();
    await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
      timeout: 30_000,
    });
    expect(workers.length).toBe(1);
    expect(workers[0]).toMatch(/engine\.worker/);
    const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
    console.log(`long tasks during #2: ${JSON.stringify(long.map((x) => Math.round(x)))}`);
    expect(Math.max(0, ...long)).toBeLessThan(MAX_LONG_TASK_MS);
  });
});
