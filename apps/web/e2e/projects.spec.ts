import { expect, test, type Page } from '@playwright/test';
import { EXPECT, FIRM_NAME, fundHtml } from './fixtures/counsel';
import { confirmAllRows, runPackage, uploadPackage, waitForChecks } from './fixtures/package';

// Projects v1: the Projects page is the first page. The e2e build lands in the app shell unless a
// spec opts in with the `e2e.projects` key (existing specs stay unchanged).
async function gotoProjects(page: Page) {
  await page.addInitScript(() => localStorage.setItem('e2e.projects', '1'));
  await page.goto('/');
  await expect(page.getByTestId('projects-page')).toBeVisible();
  await expect(page.getByTestId('project-row').first()).toBeVisible({ timeout: 15_000 });
}

/** Enter a seeded project and run its demo package through the unchanged intake flow. */
async function enterSeeded(page: Page, id: string) {
  await page.locator(`[data-testid="project-row"][data-project-id="${id}"] .pj-main`).click();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(page.getByTestId('project-context-name')).toBeVisible();
  const table = page.getByTestId('package-confirm-table');
  const status = page.getByTestId('stage-status-button');
  // the dialog's confirmation table, or an auto-run that already reached the checks stage
  await expect
    .poll(
      async () =>
        (await table.isVisible()) || /Checks done|failed/.test((await status.textContent()) ?? ''),
      { timeout: 60_000 },
    )
    .toBe(true);
  if (await table.isVisible()) {
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
    await runPackage(page);
  } else {
    await waitForChecks(page);
  }
  await expect(page.getByTestId('stage-status-button')).toContainText('Checks done');
}

test.describe('projects', () => {
  test('should create a project in the modal and list it', async ({ page }) => {
    await gotoProjects(page);
    await page.getByTestId('new-project').click();
    await page.getByTestId('create-project-submit').click();
    await expect(page.getByTestId('create-project-error')).toHaveText('Enter a project name.');
    await page.getByTestId('project-name-input').fill('Fund IV review');
    await page.getByTestId('project-description-input').fill('Fourth fund sub docs');
    await page.getByTestId('member-name').fill('Ann Lee');
    await page.getByTestId('member-email').fill('ann.lee@example.com');
    await page.getByTestId('member-role').selectOption('approver');
    await page.getByTestId('create-project-submit').click();
    await expect(page.getByTestId('create-project-dialog')).toBeHidden();
    const row = page.getByTestId('project-row').filter({ hasText: 'Fund IV review' });
    await expect(row.getByTestId('project-description')).toHaveText('Fourth fund sub docs');
    await expect(row.getByTestId('project-gate')).toContainText('Not started');
    expect(page.url()).not.toContain('example.com');
    // persisted locally across a reload
    await page.reload();
    await expect(
      page.getByTestId('project-row').filter({ hasText: 'Fund IV review' }),
    ).toBeVisible();
  });

  test('should enter a seeded project and reach Findings through the demo package', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await gotoProjects(page);
    await enterSeeded(page, 'seed-northgate-iii');
    await expect(page.getByTestId('nav-findings')).toHaveAttribute('aria-current', 'page');
    expect(page.url()).not.toContain('example.com');
    await page.getByTestId('back-to-projects').click();
    await expect(page.getByTestId('projects-page')).toBeVisible();
  });

  test('should keep back-to-projects and View as usable in the icon rail, and survive a reload', async ({
    page,
  }) => {
    // below 1200px the shell is forced into the 56px icon rail
    await page.setViewportSize({ width: 1100, height: 800 });
    await gotoProjects(page);
    await page.getByTestId('new-project').click();
    await page.getByTestId('project-name-input').fill('Rail check');
    await page.getByTestId('create-project-submit').click();
    await page
      .getByTestId('project-row')
      .filter({ hasText: 'Rail check' })
      .locator('.pj-main')
      .click();
    await expect(page.getByTestId('open-document-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('open-document-dialog')).toHaveCount(0);
    await expect(page.getByTestId('project-context-name')).toHaveAttribute('title', 'Rail check');
    const viewAs = page.getByTestId('view-as');
    await expect(viewAs).toBeVisible();
    await viewAs.selectOption('counsel');
    await expect(viewAs).toHaveValue('counsel');
    // a reload stays inside the project
    await page.reload();
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.getByTestId('project-context-name')).toHaveAttribute('title', 'Rail check');
    await page.keyboard.press('Escape');
    const back = page.getByRole('button', { name: 'All projects' });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.getByTestId('projects-page')).toBeVisible();
  });

  test('should gate Mark ready to digitize on the View as role', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoProjects(page);
    // no findings: the gate is green, so only the role decides
    await page.evaluate(() => {
      (
        window as unknown as { __aduinE2E: { transform: (fn: unknown) => void } }
      ).__aduinE2E.transform(() => []);
    });
    // a new project opens the unchanged upload dialog; upload one sub doc into it
    await page.getByTestId('new-project').click();
    await page.getByTestId('project-name-input').fill('Role gate check');
    await page.getByTestId('create-project-submit').click();
    await page
      .getByTestId('project-row')
      .filter({ hasText: 'Role gate check' })
      .locator('.pj-main')
      .click();
    await expect(page.getByTestId('open-document-dialog')).toBeVisible();
    const meta = EXPECT.funds['fund-II'];
    await uploadPackage(page, [{ name: meta.file, buffer: fundHtml('fund-II') }], {
      firm: FIRM_NAME[meta.firm_id]!,
      fund: meta.fund_name,
      version: '2026',
    });
    await waitForChecks(page);
    await page.getByTestId('nav-counsel').click();
    const ready = page.getByTestId('counsel-mark-ready');
    await expect(ready).toBeEnabled();
    await page.getByTestId('view-as').selectOption('counsel');
    await expect(ready).toBeDisabled();
    await expect(page.getByTestId('counsel-ready-role-reason')).toHaveText(
      'Only the Approver can mark ready.',
    );
    await page.getByTestId('view-as').selectOption('approver');
    await expect(page.getByTestId('counsel-ready-role-reason')).toHaveCount(0);
    await expect(ready).toBeEnabled();
  });
});
