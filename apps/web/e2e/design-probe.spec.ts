import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from '@playwright/test';
import { FINDINGS_V2_HTML, REPO_ROOT } from '../test/support/mockupCss';
import { forceSeverity, gotoApp, openSample, rowsLoc } from './fixtures/app';

/**
 * Visual probe (Agent-Probe tier, not a gate): the findings-v2.html mockup (panel open) and the app
 * at widths 1440 and 1024 with the document zoom at 75, 100 and 150 (seeded through
 * `ui:v1:doczoom`), into the Findings v2 task folder design-probe/. Runs only when the
 * DESIGN_PROBE environment variable is set. External Google Fonts are blocked for parity (the
 * rubric judges type scale, not glyph shapes).
 */
const OUT = resolve(
  REPO_ROOT,
  'process/features/findings-v2/active/findings-v2_18-10-26/design-probe',
);
const WIDTHS = [1440, 1024];
const ZOOMS = [75, 100, 150];
const ENABLED = Boolean(process.env['DESIGN_PROBE']);

test.describe('design-probe', () => {
  test.skip(!ENABLED, 'visual probe runs only on request');
  test('capture findings-v2.html and the app at zoom 75, 100 and 150', async ({ browser }) => {
    test.setTimeout(180_000);
    mkdirSync(OUT, { recursive: true });
    const mock = await browser.newPage();
    await mock.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    for (const w of WIDTHS) {
      await mock.setViewportSize({ width: w, height: 900 });
      await mock.goto(`file://${FINDINGS_V2_HTML}`);
      await mock.waitForTimeout(400);
      // open the first finding so the expanded card and the sticky bar are in the picture
      const first = mock.locator('.li').first();
      if (await first.count()) await first.click();
      await mock.waitForTimeout(300);
      await mock.screenshot({ path: resolve(OUT, `mockup-findings-v2-${w}.png`) });
    }
    await mock.close();

    for (const z of ZOOMS) {
      for (const w of WIDTHS) {
        // the panel percent is chosen at mount from the viewport (E-B16): size before loading
        const page = await browser.newPage({ viewport: { width: w, height: 900 } });
        await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
        await gotoApp(page, { zoom: z });
        await forceSeverity(page, 'critical', 0);
        await openSample(page, '03');
        await rowsLoc(page).first().click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: resolve(OUT, `app-${w}-zoom${z}.png`) });
        await page.close();
      }
    }
  });
});
