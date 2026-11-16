import { expect, test, type Page } from '@playwright/test';
import { confirmAllRows } from './fixtures/package';

// Notifications v1: the bell lives only in the Projects UI (opt-in `e2e.projects`).
async function gotoProjects(page: Page) {
  await page.addInitScript(() => localStorage.setItem('e2e.projects', '1'));
  await page.goto('/');
  await expect(page.getByTestId('projects-page')).toBeVisible();
  await expect(page.getByTestId('project-row').first()).toBeVisible({ timeout: 15_000 });
}

/**
 * After entering a seeded project from a notification: confirm and run its demo package through
 * the unchanged intake flow. The notification target screen replaces Findings once the document
 * is ready, so this does not wait on the Findings-only stage button.
 */
async function finishSeededEntry(page: Page) {
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('project-context-name')).toBeVisible();
  const table = page.getByTestId('package-confirm-table');
  const counsel = page.getByTestId('nav-counsel');
  await expect
    .poll(
      async () =>
        (await table.isVisible()) || (await counsel.getAttribute('aria-current')) === 'page',
      { timeout: 60_000 },
    )
    .toBe(true);
  if (!(await table.isVisible())) return;
  const rows = page.getByTestId('package-row');
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  let primary = false;
  for (let i = 0; i < (await rows.count()); i++) {
    const role = rows.nth(i).getByTestId('package-row-role');
    if ((await role.inputValue()) !== 'to_digitize') continue;
    if (primary) await role.selectOption('baseline');
    primary = true;
  }
  await confirmAllRows(page);
  const version = page.getByTestId('package-version-input');
  if (!(await version.inputValue())) await version.fill('v1');
  await expect(page.getByTestId('package-run')).toBeEnabled();
  await page.getByTestId('package-run').click();
  await expect(page.getByTestId('open-document-dialog')).toBeHidden();
}

test.describe('notifications', () => {
  test('should show 3 unread seeded notifications for the Approver', async ({ page }) => {
    await gotoProjects(page);
    await expect(page.getByTestId('notif-badge')).toHaveText('3');
    await page.getByTestId('notif-bell').click();
    const pop = page.getByTestId('notif-popover');
    await expect(pop.getByTestId('notif-heading')).toHaveText('Notifications (3)');
    await expect(pop.getByTestId('notif-row')).toHaveCount(3);
    await expect(pop.locator('[data-testid="notif-row"][data-unread="true"]')).toHaveCount(3);
    await expect(pop).not.toContainText('@');
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
    await expect(page.getByTestId('notif-bell')).toBeFocused();
  });

  test('should open the project at Questions from an answers row', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoProjects(page);
    await page.getByTestId('notif-bell').click();
    await page.locator('[data-testid="notif-row"][data-type="answers"]').click();
    await finishSeededEntry(page);
    await expect(page.getByTestId('project-context-name')).toHaveText('Northgate Capital Fund III');
    await expect(page.getByTestId('nav-counsel')).toHaveAttribute('aria-current', 'page', {
      timeout: 60_000,
    });
    await expect(page.getByTestId('notif-badge')).toHaveText('2');
    expect(page.url()).not.toContain('example.com');
    expect(page.url()).not.toContain('notif');
  });

  test('should clear the badge with Mark all read', async ({ page }) => {
    await gotoProjects(page);
    await page.getByTestId('notif-bell').click();
    await page.getByTestId('notif-mark-all').click();
    const pop = page.getByTestId('notif-popover');
    await expect(pop.getByTestId('notif-heading')).toHaveText('Notifications (0)');
    await expect(pop.locator('[data-testid="notif-row"][data-unread="true"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('notif-badge')).toHaveCount(0);
  });

  test('should change the feed with View as', async ({ page }) => {
    await gotoProjects(page);
    await page.getByTestId('view-as').selectOption('counsel');
    await expect(page.getByTestId('notif-badge')).toHaveText('1');
    await page.getByTestId('view-as').selectOption('approver');
    await expect(page.getByTestId('notif-badge')).toHaveText('3');
  });
});
