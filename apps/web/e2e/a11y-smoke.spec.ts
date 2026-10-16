import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { forceSeverity, gotoApp, openDialog, openSample, rowsLoc } from './fixtures/app';

/** AC30 interim: zero CRITICAL axe violations; serious ones are printed for the report (not gate-fail). */
async function audit(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).analyze();
  const critical = r.violations.filter((v) => v.impact === 'critical');
  const serious = r.violations.filter((v) => v.impact === 'serious');
  console.log(
    `[a11y] ${label}: critical=${critical.length} serious=${serious.map((v) => `${v.id}(${v.nodes.length})`).join(',') || '0'}`,
  );
  expect(
    critical.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
}

test.describe('a11y-smoke', () => {
  test('shell, Findings (expanded and rail), placeholder, Structure and every overlay have no critical violations', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await forceSeverity(page, 'critical', 0);
    await openSample(page, '03');
    await rowsLoc(page).first().click();
    await audit(page, 'findings expanded');

    for (const [btn, pop] of [
      ['stage-status-button', 'stage-popover'],
      ['filter-button', 'filter-menu'],
      ['jump-menu-button', 'jump-menu'],
      ['gate-button', 'gate-popover'],
      ['doc-switcher', 'doc-menu'],
    ] as const) {
      await page.getByTestId(btn).click();
      await expect(page.getByTestId(pop)).toBeVisible();
      await expect(page.getByTestId(btn)).toHaveAttribute('aria-expanded', 'true');
      await audit(page, pop);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId(pop)).toBeHidden();
    }

    await page.getByTestId('previously-handled-toggle').click();
    await audit(page, 'previously handled expanded');

    await page.getByTestId('action-dismiss').click();
    await expect(page.getByTestId('dismiss-modal')).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(
        await page.getByTestId('dismiss-modal').evaluate((m) => m.contains(document.activeElement)),
      ).toBe(true);
    }
    await expect(page.locator('#app')).toHaveAttribute('inert', '');
    await audit(page, 'dismiss modal');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('action-dismiss')).toBeFocused();

    await openDialog(page);
    await audit(page, 'open a document dialog');
    await page.keyboard.press('Escape');

    await page.getByTestId('sidebar-toggle').click();
    await audit(page, 'findings rail');

    // Phase 02: Structure is a real view now; the placeholder audit moves to Compare versions
    await page.getByTestId('nav-compare').click();
    await audit(page, 'placeholder');

    await page.getByTestId('nav-structure').click();
    await expect(page.getByTestId('structure-view')).toBeVisible();
    await audit(page, 'structure');
    await page.getByTestId('structure-toggle-everything').click();
    await page.getByTestId('structure-row').first().click();
    await expect(page.getByTestId('structure-drawer')).toBeVisible();
    await audit(page, 'structure drawer');
    await page.getByTestId('structure-lens-investors').click();
    await audit(page, 'structure investor types');
  });
});
