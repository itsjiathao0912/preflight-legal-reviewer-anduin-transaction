import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from '@playwright/test';
import { APP_HTML, REPO_ROOT } from '../test/support/mockupCss';
import { forceSeverity, gotoApp, openSample, rowsLoc } from './fixtures/app';

/**
 * Visual probe (Agent-Probe tier, not a gate): screenshots of app.html and the app at 1440/1199/1024 into
 * the task folder design-probe/. Runs only when the DESIGN_PROBE environment variable is set.
 * External Google Fonts are blocked for parity (the rubric judges type scale, not glyph shapes).
 */
const OUT = resolve(REPO_ROOT, 'process/general-plans/active/subdoc-qa-mvp_17-10-26/design-probe');
const WIDTHS = [1440, 1199, 1024];
const ENABLED = Boolean(process.env['DESIGN_PROBE']);

test.describe('design-probe', () => {
  test.skip(!ENABLED, 'visual probe runs only on request');
  test('capture app.html and the app', async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(`file://${APP_HTML}`);
      await page.waitForTimeout(400);
      await page.screenshot({ path: resolve(OUT, `mockup-${w}.png`) });
    }
    await gotoApp(page);
    await forceSeverity(page, 'critical', 0);
    await openSample(page, '03');
    await rowsLoc(page).first().click();
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: resolve(OUT, `app-${w}.png`) });
    }
  });
});
