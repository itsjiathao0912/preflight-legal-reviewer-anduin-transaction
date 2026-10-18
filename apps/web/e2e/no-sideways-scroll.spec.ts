import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openSample, rowsLoc } from './fixtures/app';

// S17: windows 768-959 px wide must not scroll sideways (the desktop .app has min-width 960).
const SHOTS = process.env.S17_SHOTS;

async function noSidewaysScroll(page: Page) {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(sw).toBeLessThanOrEqual(iw);
}

for (const width of [768, 900]) {
  test.describe(`no sideways scroll at ${width}`, () => {
    test.use({ viewport: { width, height: 1024 } });

    test(`S17: no sideways scroll at ${width} on Findings`, async ({ page }) => {
      await gotoApp(page);
      await openSample(page, '05');
      await expect(rowsLoc(page).first()).toBeInViewport();
      await noSidewaysScroll(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/findings-${width}.png` });
    });

    for (const [nav, view, name] of [
      ['nav-counsel', 'counsel-view', 'Counsel questions'],
      ['nav-memory', 'memory-view', 'Firm memory'],
    ] as const) {
      test(`S17: no sideways scroll at ${width} on ${name}`, async ({ page }) => {
        await gotoApp(page);
        await openSample(page, '05');
        await page.getByTestId(nav).click();
        await expect(page.getByTestId(view)).toBeVisible();
        await noSidewaysScroll(page);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${nav}-${width}.png` });
      });
    }
  });
}
