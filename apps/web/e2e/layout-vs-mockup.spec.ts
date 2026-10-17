import { expect, test, type Page } from '@playwright/test';
import {
  compareCss,
  findingsCss,
  findingsV2ShadowSelectors,
  findingsV2Widths,
  fontSizes,
  mockupCss,
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
// Findings v2 (Phase B): panel geometry and the shadow allow-list come from design/mockups/findings-v2.html.
const V2 = findingsV2Widths();
const V2_SHADOWS = findingsV2ShadowSelectors();
/** findings-v2.html shadow selector -> the v2 class that implements it (E-B7). */
const V2_SHADOW_CLASS: Record<string, string> = {
  '.li.open': 'fv2-row-open',
  '.btn.out': 'fv2-btn-outline',
  '.pop': 'fv2-zoom-menu',
};
// Invalid-field inset: app.html `input[aria-invalid=true]` (the v2 modal textarea follows it).
const INVALID_INSET = /\[aria-invalid=true\]\{box-shadow:inset/.test(mockupCss());
const ALLOWED_SHADOW_CLASSES = Object.keys(V2_SHADOW_CLASS)
  .filter((sel) => V2_SHADOWS.includes(sel))
  .map((sel) => V2_SHADOW_CLASS[sel]!);

async function boxWidth(page: Page, testId: string) {
  return (await page.getByTestId(testId).boundingBox())!.width;
}

/** Expected findings panel width: percent of the real `.work` content width (E-B8). */
async function expectedPanelWidth(page: Page, pct: number) {
  const work = await page.locator('.work.fv2-work').evaluate((e) => {
    const cs = getComputedStyle(e);
    return e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  });
  return (work * pct) / 100;
}

/** Computed font sizes (elements with own text), radii, shadows and gradients across the app. */
async function styleAudit(page: Page) {
  return page.evaluate(
    ([allowed, invalidInset]) => {
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
            (e.getAttribute('role') === 'dialog' &&
              (e.classList.contains('pop') || e.classList.contains('modal'))) ||
            allowed.some((c) => e.classList.contains(c)) ||
            (invalidInset && e.getAttribute('aria-invalid') === 'true');
          if (!ok) shadows.push(desc(e));
        }
        if (/gradient/.test(cs.backgroundImage)) gradients.push(desc(e));
      }
      return { fonts: [...fonts], radii: [...radii], shadows, gradients };
    },
    [ALLOWED_SHADOW_CLASSES, INVALID_INSET] as const,
  );
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
    expect([V2.wideMin, V2.wide, V2.narrow, V2.min, V2.max, V2.handle]).toEqual([
      1280, 50, 55, 40, 65, 8,
    ]);
    // every allow-listed v2 shadow maps to a shadow the mockup really draws (E-B7)
    for (const sel of Object.keys(V2_SHADOW_CLASS)) expect(V2_SHADOWS).toContain(sel);
    expect(INVALID_INSET).toBe(true);
  });

  test('should size the sidebar 232px, the findings panel 50% at 1440 and 55% below 1280, and use the 56px rail at 1199', async ({
    page,
  }) => {
    // The panel percent is chosen once at mount (E-B16): set each viewport BEFORE the app loads.
    const cases = [
      { width: 1440, height: 900, sidebar: W.sidebar, pct: V2.wide },
      { width: RAIL_AT + 1, height: 900, sidebar: W.sidebar, pct: V2.narrow },
      { width: RAIL_AT, height: 900, sidebar: W.rail, pct: V2.narrow },
      { width: 1024, height: 768, sidebar: W.rail, pct: V2.narrow },
    ];
    for (const [i, c] of cases.entries()) {
      expect(c.width >= V2.wideMin).toBe(c.pct === V2.wide);
      await page.setViewportSize({ width: c.width, height: c.height });
      if (i === 0) {
        await gotoApp(page);
        await openSample(page, '01');
      } else {
        await page.reload();
        await expect(rowsLoc(page).first()).toBeVisible({ timeout: 30_000 });
      }
      await expect.poll(() => sidebarWidth(page)).toBe(c.sidebar);
      if (c.sidebar === W.rail) await expect(page.getByTestId('sidebar-toggle')).toBeHidden();
      const want = await expectedPanelWidth(page, c.pct);
      expect(
        Math.abs((await boxWidth(page, 'findings-column')) - want),
        `panel at ${c.width}`,
      ).toBeLessThanOrEqual(1);
      expect(Math.abs((await boxWidth(page, 'panel-resizer')) - V2.handle)).toBeLessThanOrEqual(1);
    }
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
    await expect(rowsLoc(page).nth(1)).toHaveAttribute('aria-expanded', 'false');
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
