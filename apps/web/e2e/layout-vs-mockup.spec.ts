import { expect, test, type Page } from '@playwright/test';
import {
  compareCss,
  findingsCss,
  fontSizes,
  radii,
  railMaxWidth,
  shellWidths,
} from '../test/support/mockupCss';
import { forceSeverity, gotoApp, openSample, rowsLoc, sidebarWidth } from './fixtures/app';

// Every expected value is derived at test time from the shell + Findings CSS of design/mockups/app.html.
const CSS = findingsCss();
const W = shellWidths(CSS);
const RAIL_AT = railMaxWidth();
const FONTS = fontSizes(CSS);
const RADII = radii(CSS);
// Phase 07: the real Compare view is audited against the Compare vocabulary of app.html
const CMP_FONTS = fontSizes(compareCss());
const CMP_RADII = radii(compareCss());
// Reference values the derivation must yield today (update the plan, never the assertion, if they differ).
const REF_FONTS = [13, 14, 15, 16, 17, 20, 28];
const REF_RADII = [0, 2, 3, 4, 999];

async function columnWidth(page: Page) {
  return (await page.getByTestId('findings-column').boundingBox())!.width;
}

/** Computed font sizes (elements with own text), radii, shadows and gradients across the app. */
async function styleAudit(page: Page) {
  return page.evaluate(() => {
    const fonts = new Set<number>();
    const radii = new Set<string>();
    const shadows: string[] = [];
    const gradients: string[] = [];
    const desc = (e: Element) =>
      `${e.tagName.toLowerCase()}[${e.getAttribute('data-testid') ?? ''}].${String(
        e.getAttribute('class') ?? '',
      )
        .split(' ')
        .join('.')}`;
    for (const e of Array.from(document.querySelectorAll('body *'))) {
      if (e.closest('[data-testid="open-document-dialog"]') || e.closest('svg')) continue;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const ownText = Array.from(e.childNodes).some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0,
      );
      if (ownText) fonts.add(parseFloat(cs.fontSize));
      // native radio/checkbox are UA-drawn (the mockup uses the same native controls)
      const native = e.matches('input[type=radio], input[type=checkbox]');
      if (!native)
        for (const c of [
          cs.borderTopLeftRadius,
          cs.borderTopRightRadius,
          cs.borderBottomRightRadius,
          cs.borderBottomLeftRadius,
        ])
          radii.add(c);
      if (cs.boxShadow !== 'none') {
        const ok =
          e.getAttribute('role') === 'dialog' &&
          (e.classList.contains('pop') || e.classList.contains('modal'));
        if (!ok) shadows.push(desc(e));
      }
      if (/gradient/.test(cs.backgroundImage)) gradients.push(desc(e));
    }
    return { fonts: [...fonts], radii: [...radii], shadows, gradients };
  });
}

function checkAudit(
  a: Awaited<ReturnType<typeof styleAudit>>,
  fonts: number[] = FONTS,
  radiiSet: number[] = RADII,
) {
  for (const f of a.fonts) expect(fonts, `font-size ${f}px`).toContain(f);
  for (const r of a.radii) {
    const px = parseFloat(r);
    expect(radiiSet.includes(px), `radius ${r}`).toBe(true);
  }
  expect(a.shadows).toEqual([]);
  expect(a.gradients).toEqual([]);
}

test.describe('layout-vs-mockup', () => {
  test('the derived font and radius sets equal the plan reference values', () => {
    expect(FONTS).toEqual(REF_FONTS);
    expect(RADII).toEqual(REF_RADII);
    expect([W.sidebar, W.rail, W.column, W.narrowColumn, RAIL_AT, W.narrowMax]).toEqual([
      232, 56, 400, 380, 1199, 1279,
    ]);
  });

  test('should size the sidebar 232px and the findings column 400px at 1440 and use the 56px rail at 1199', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoApp(page);
    await openSample(page, '01');
    expect(await sidebarWidth(page)).toBe(W.sidebar);
    expect(await columnWidth(page)).toBe(W.column);

    await page.setViewportSize({ width: RAIL_AT + 1, height: 900 });
    await expect.poll(() => sidebarWidth(page)).toBe(W.sidebar);
    expect(await columnWidth(page)).toBe(W.narrowColumn);

    await page.setViewportSize({ width: RAIL_AT, height: 900 });
    await expect.poll(() => sidebarWidth(page)).toBe(W.rail);
    await expect(page.getByTestId('sidebar-toggle')).toBeHidden();

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect.poll(() => sidebarWidth(page)).toBe(W.rail);
    expect(await columnWidth(page)).toBe(W.narrowColumn);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test('vertical nav with Review/Check/Firm, no tab bar, bottom-pinned gate', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('[role=tablist]')).toHaveCount(0);
    const nav = page.locator('nav[aria-label="Main"]');
    await expect(nav.locator('.gl')).toHaveText(['Review', 'Check', 'Firm']);
    const xs = await nav
      .locator('.ni')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
    expect(new Set(xs).size).toBe(1);
    const side = (await page.getByTestId('sidebar').boundingBox())!;
    const gate = (await page.getByTestId('gate-button').boundingBox())!;
    expect(gate.y).toBeGreaterThan(side.y + side.height / 2);
  });

  test('only collapse and the open document persist across reload (route, selection, expanded row and popovers reset)', async ({
    page,
  }) => {
    await gotoApp(page);
    await openSample(page, '03');
    await rowsLoc(page).nth(1).click();
    await page.getByTestId('sidebar-toggle').click();
    await page.getByTestId('nav-compare').click();
    await page.reload();
    expect(await sidebarWidth(page)).toBe(W.rail);
    await expect(page.getByTestId('nav-findings')).toHaveAttribute('aria-current', 'page');
    // the last open document is reopened (uploads/samples restore), but selection resets
    await expect(rowsLoc(page).first()).toBeVisible({ timeout: 30_000 });
    await expect(rowsLoc(page).nth(1).locator('xpath=ancestor-or-self::li[1]')).not.toHaveClass(
      /\bsel\b/,
    );
  });

  test('computed styles stay inside the app.html vocabulary on Findings, overlays and Compare', async ({
    page,
  }) => {
    await gotoApp(page);
    await forceSeverity(page, 'critical', 0);
    await openSample(page, '03');
    await rowsLoc(page).first().click();
    checkAudit(await styleAudit(page));

    for (const [btn, pop] of [
      ['stage-status-button', 'stage-popover'],
      ['filter-button', 'filter-menu'],
      ['gate-button', 'gate-popover'],
      ['jump-menu-button', 'jump-menu'],
    ] as const) {
      await page.getByTestId(btn).click();
      await expect(page.getByTestId(pop)).toBeVisible();
      checkAudit(await styleAudit(page));
      await page.keyboard.press('Escape');
    }

    await page.getByTestId('action-dismiss').click();
    await page.getByTestId('dismiss-save').click();
    await expect(page.getByTestId('dismiss-error')).toBeVisible();
    checkAudit(await styleAudit(page));
    expect(
      await page.getByTestId('dismiss-note').evaluate((e) => getComputedStyle(e).fontSize),
    ).toBe('16px');
    await page.keyboard.press('Escape');

    // Phase 07: Compare is a real view; audit it with a diff selected (clause diff, chips, badges)
    await page.getByTestId('nav-compare').click();
    await expect(page.getByTestId('compare-view')).toBeVisible();
    await expect(page.getByTestId('placeholder-view')).toHaveCount(0);
    await page.getByTestId('cmp-base').selectOption({ label: 'PG NGI 2024' });
    await page.getByTestId('cmp-compare').selectOption({ label: 'PG NGI 2026' });
    await page.getByTestId('cmp-item').first().click({ timeout: 30_000 });
    expect(CMP_FONTS).toEqual(expect.arrayContaining([...FONTS, 19]));
    checkAudit(await styleAudit(page), CMP_FONTS, CMP_RADII);
  });
});
