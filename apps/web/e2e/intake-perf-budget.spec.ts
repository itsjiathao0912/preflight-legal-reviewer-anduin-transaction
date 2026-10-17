import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { confirmAllRows, openDemoPackage } from './fixtures/package';

/**
 * Intake Phase 4 B1 (AC29 on the package flow). Timings are measured IN-PAGE (performance.now)
 * from the click that starts the run (`package-sample-option` for an auto-run package, the last
 * `package-run` click after confirmation otherwise) to the stage line reading "Checks done", on the
 * e2e-mode bundle in Desktop Chromium on this machine (same pattern as `perf-budget.spec.ts`).
 * Budgets: demo `hartwell` under 2 s, demo `ngi` (#5 + #6, about 376 KB) under 5 s.
 */
const BUNDLE_LABEL = 'e2e-mode bundle (vite --mode e2e, vite preview, Desktop Chromium)';
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const EXPECTED = JSON.parse(
  readFileSync(resolve(ROOT, 'fixtures', 'package', 'expected.json'), 'utf8'),
) as { hartwell: { files: Record<string, { type: string; finalRole: string }> } };

async function installTimer(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __perf?: { t0?: number; t1?: number } };
    w.__perf = {};
    document.addEventListener(
      'click',
      (e) => {
        const t = e.target as Element | null;
        if (t?.closest('[data-testid="package-sample-option"],[data-testid="package-run"]')) {
          w.__perf!.t0 = performance.now();
          delete w.__perf!.t1;
        }
      },
      { capture: true },
    );
    const mo = new MutationObserver(() => {
      const el = document.querySelector('[data-testid="stage-status-button"]');
      if (
        w.__perf!.t0 !== undefined &&
        w.__perf!.t1 === undefined &&
        !document.querySelector('[data-testid="package-confirm-table"]') &&
        el &&
        /Checks done/.test(el.textContent ?? '')
      )
        w.__perf!.t1 = performance.now();
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });
  });
}

/** Open a demo package, make the draft runnable when it needs confirmation, return ms. */
async function timePackage(
  page: Page,
  id: string,
  files?: Record<string, { type: string; finalRole: string }>,
): Promise<number> {
  await installTimer(page);
  await openDemoPackage(page, id);
  const table = page.getByTestId('package-confirm-table');
  // the draft table mounts inside the dialog; an auto-run package closes the dialog instead
  await expect
    .poll(
      async () =>
        (await table.isVisible()) || !(await page.getByTestId('open-document-dialog').isVisible()),
      { timeout: 30_000 },
    )
    .toBe(true);
  if (await table.isVisible()) {
    const rows = page.getByTestId('package-row');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    if (files)
      for (const [name, f] of Object.entries(files)) {
        const r = rows.filter({ hasText: name });
        await r.getByTestId('package-row-type').selectOption(f.type);
        await r.getByTestId('package-row-role').selectOption(f.finalRole);
      }
    else {
      // generic: keep the first to-digitize row, mark every other to-digitize row baseline
      const n = await rows.count();
      let primary = false;
      for (let i = 0; i < n; i++) {
        const role = rows.nth(i).getByTestId('package-row-role');
        if ((await role.inputValue()) !== 'to_digitize') continue;
        if (primary) await role.selectOption('baseline');
        primary = true;
      }
    }
    await confirmAllRows(page);
    const version = page.getByTestId('package-version-input');
    if (!(await version.inputValue())) await version.fill('v1');
    await expect(page.getByTestId('package-run')).toBeEnabled();
    await page.getByTestId('package-run').click();
  }
  await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
    timeout: 30_000,
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const p = (window as unknown as { __perf: { t0?: number; t1?: number } }).__perf;
        return p.t1 !== undefined;
      }),
    )
    .toBe(true);
  const ms = await page.evaluate(() => {
    const p = (window as unknown as { __perf: { t0?: number; t1?: number } }).__perf;
    return p.t0 !== undefined && p.t1 !== undefined ? p.t1 - p.t0 : NaN;
  });
  expect(Number.isFinite(ms), 'in-page timing captured').toBe(true);
  return ms;
}

test.describe('intake-perf-budget', () => {
  test.describe.configure({ mode: 'serial' });

  test('should finish hartwell under 2 s and ngi under 5 s in the e2e bundle', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    for (const [id, budget, files] of [
      ['hartwell', 2_000, EXPECTED.hartwell.files],
      ['ngi', 5_000, undefined],
    ] as const) {
      await gotoApp(page);
      const ms = await timePackage(page, id, files);
      const line = `[intake-perf-budget] ${BUNDLE_LABEL}: package ${id} run->Checks done ${ms.toFixed(0)} ms (budget ${budget})`;
      console.log(line);
      testInfo.annotations.push({ type: 'perf', description: line });
      expect(ms, id).toBeLessThan(budget);
    }
  });
});
