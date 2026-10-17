import { expect, test } from '@playwright/test';
import { gotoApp, openSample, rowsLoc, sidebarWidth } from './fixtures/app';
import { railMaxWidth, shellWidths } from '../test/support/mockupCss';

const W = shellWidths();
const RAIL_AT = railMaxWidth();

test.describe('app-shell', () => {
  test('groups, labels and vertical nav (no tab bar)', async ({ page }) => {
    await gotoApp(page);
    const nav = page.locator('nav[aria-label="Main"]');
    await expect(nav.locator('.gl')).toHaveText(['Review', 'Check', 'Firm']);
    await expect(nav.locator('.ni .lbl')).toHaveText([
      'Findings',
      'Questions',
      'Structure',
      'Compare versions',
      'Firm memory',
      'Documents',
    ]);
    await expect(page.locator('[role=tablist]')).toHaveCount(0);
  });

  test('nav click switches the view and aria-current', async ({ page }) => {
    await gotoApp(page);
    await expect(page.getByTestId('nav-findings')).toHaveAttribute('aria-current', 'page');
    await page.getByTestId('nav-structure').click();
    await expect(page.getByTestId('nav-structure')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('nav-findings')).not.toHaveAttribute('aria-current', 'page');
    // Phase 02: Structure is a real view (no longer the placeholder)
    await expect(page.getByTestId('structure-view')).toBeVisible();
    await page.getByTestId('nav-findings').click();
    await expect(page.getByTestId('findings-header')).toBeVisible();
  });

  test('should land on Findings after reload regardless of the last route', async ({ page }) => {
    await gotoApp(page);
    for (const r of ['counsel', 'structure', 'compare', 'memory', 'documents']) {
      await page.getByTestId(`nav-${r}`).click();
      await expect(page).toHaveURL(new RegExp(`#${r}$`));
      await page.reload();
      await expect(page.getByTestId('nav-findings')).toHaveAttribute('aria-current', 'page');
      await expect(page.getByTestId('findings-header')).toBeVisible();
      await expect(page).toHaveURL(/#findings$/);
    }
  });

  test('collapse to the rail persists across reload (the only persisted shell state)', async ({
    page,
  }) => {
    await gotoApp(page);
    expect(await sidebarWidth(page)).toBe(W.sidebar);
    await page.getByTestId('sidebar-toggle').click();
    expect(await sidebarWidth(page)).toBe(W.rail);
    await page.reload();
    expect(await sidebarWidth(page)).toBe(W.rail);
    await expect(page.getByTestId('sidebar-toggle')).toHaveAttribute('aria-expanded', 'false');
    await page.getByTestId('sidebar-toggle').click();
    expect(await sidebarWidth(page)).toBe(W.sidebar);
    expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual(['ui:v1:sidebar']);
  });

  test('should force the icon rail below 1200px', async ({ page }) => {
    await page.setViewportSize({ width: RAIL_AT, height: 900 });
    await gotoApp(page);
    expect(await sidebarWidth(page)).toBe(W.rail);
    await expect(page.getByTestId('sidebar-toggle')).toBeHidden();
    await page.setViewportSize({ width: RAIL_AT + 1, height: 900 });
    await expect.poll(() => sidebarWidth(page)).toBe(W.sidebar);
    await expect(page.getByTestId('sidebar-toggle')).toBeVisible();
  });

  test('Findings badge counts open items only and changes after Accept', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '01');
    const n = await rowsLoc(page).count();
    expect(n).toBeGreaterThan(0);
    await expect(page.getByTestId('nav-badge-findings')).toHaveText(new RegExp(`${n}$`));
    await rowsLoc(page).first().click();
    await page.getByTestId('action-accept').click();
    await expect(page.getByTestId('nav-badge-findings')).toHaveText(
      n - 1 ? new RegExp(`${n - 1}$`) : /^$/,
    );
    await expect(page.getByTestId('nav-badge-counsel')).toHaveText('');
  });

  test('gate button, AI switch and analyst name are pinned at the sidebar bottom', async ({
    page,
  }) => {
    await gotoApp(page);
    const side = (await page.getByTestId('sidebar').boundingBox())!;
    const nav = (await page.locator('nav[aria-label="Main"]').boundingBox())!;
    for (const id of ['gate-button', 'ai-on', 'analyst-name']) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.y).toBeGreaterThan(nav.y + nav.height);
      expect(b.y + b.height).toBeLessThanOrEqual(side.y + side.height);
    }
    const name = (await page.getByTestId('analyst-name').boundingBox())!;
    expect(side.y + side.height - (name.y + name.height)).toBeLessThan(40);
    await expect(page.getByTestId('analyst-name')).toHaveText('Linh Tran');
  });

  test('doc switcher menu lists the open document and opens the dialog', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '03');
    await expect(page.getByTestId('doc-switcher')).toContainText('PG Master Fund 2019');
    await expect(page.getByTestId('doc-switcher')).toContainText('Partners Group');
    await expect(page.getByTestId('nav-memory')).toContainText('Partners Group memory');
    await page.getByTestId('doc-switcher').click();
    await expect(page.getByTestId('doc-menu')).toBeVisible();
    await expect(page.getByTestId('doc-menu').locator('.di[aria-current=true]')).toContainText(
      'PG Master Fund 2019',
    );
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('doc-menu')).toBeHidden();
    await expect(page.getByTestId('doc-switcher')).toHaveAttribute('aria-expanded', 'false');
  });
});
