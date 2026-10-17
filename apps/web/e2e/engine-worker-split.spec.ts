import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { gotoApp, openDialog, sample } from './fixtures/app';

const TEXT_PDF = resolve(import.meta.dirname, '..', '..', '..', 'fixtures', 'pdf', 'text.pdf');

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

  // Phase 06 (D3/D4): a text PDF is parsed in the same engine worker with pdfjs-dist injected into
  // unpdf (pdf.js "fake worker" in that thread): no second Worker, and unpdf's own bundled pdf.js
  // chunk is never fetched (one pdf.js at runtime).
  test('parses a text PDF in the same single engine worker', async ({ page }) => {
    test.setTimeout(90_000);
    const workers: string[] = [];
    const scripts: string[] = [];
    page.on('worker', (w) => workers.push(w.url()));
    page.on('request', (r) => {
      if (/\.m?js(\?|$)/.test(r.url())) scripts.push(r.url());
    });
    await gotoApp(page);
    await openDialog(page);
    await page.getByTestId('upload-input').setInputFiles({
      name: 'text.pdf',
      mimeType: 'application/pdf',
      buffer: readFileSync(TEXT_PDF),
    });
    await page.getByTestId('firm-combobox').fill('Other / no firm');
    await page.getByTestId('fund-input').fill('Test Fund');
    await page.getByTestId('privacy-ack').check();
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
      timeout: 60_000,
    });
    expect(workers.length).toBe(1);
    expect(workers[0]).toMatch(/engine\.worker/);
    // non-vacuous: the injected pdfjs-dist chunk WAS fetched, unpdf's bundled copy was not
    expect(scripts.some((u) => /\/assets\/pdf-[^/]*\.js/.test(u))).toBe(true);
    expect(scripts.filter((u) => /\/assets\/pdfjs-[^/]*\.js/.test(u))).toEqual([]);
  });
});
