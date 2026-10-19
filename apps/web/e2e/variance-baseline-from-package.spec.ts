import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import {
  confirmAllRows,
  hartwellFile,
  openDemoPackage,
  runPackage,
  uploadPackage,
} from './fixtures/package';
import {
  ageUploads,
  changeRows,
  NGI_2024,
  NGI_2026,
  rawFile,
  scanPage,
  uploadOne,
  varianceSettled,
} from './fixtures/variance';

// Variance Phase 02 (AC-V1): the baseline is the package's baseline-role document (Intake store) or,
// without one, the firm pointer; the header control changes it; a role change re-runs the pass
// without re-opening the primary; the expanded change row shows old above new with non-colour cues,
// impact lines (deterministic) and the rules provenance.
const NGI_2024_NAME = '05-partners-group-ngi-2024.htm';

/** Draft table: set one row's type and role by file name. */
async function setRow(page: Page, name: string, role: string, type?: string) {
  const row = page.getByTestId('package-row').filter({ hasText: name });
  if (type) await row.getByTestId('package-row-type').selectOption(type);
  await row.getByTestId('package-row-role').selectOption(role);
}

async function finishDraft(page: Page) {
  await confirmAllRows(page);
  const version = page.getByTestId('package-version-input');
  if (!(await version.inputValue())) await version.fill('v1');
  await runPackage(page);
  await varianceSettled(page);
}

/** Flag set when the Findings list goes back to "Reading the document" (a re-open). */
async function watchReopen(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __reopened: boolean };
    w.__reopened = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="loading-state"]')) w.__reopened = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
}

test.describe('variance-baseline-from-package', () => {
  test('should use the package baseline role and the firm pointer', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    // --- package path: the Partners Group NGI demo package, 2024 marked baseline
    await openDemoPackage(page, 'ngi');
    await expect(page.getByTestId('package-row')).toHaveCount(2, { timeout: 60_000 });
    await setRow(page, NGI_2024_NAME, 'baseline');
    await finishDraft(page);
    await expect(page.getByTestId('baseline-control')).toContainText(`vs ${NGI_2024_NAME}`);
    const n = await changeRows(page).count();
    expect(n).toBeGreaterThan(0);

    // expanded change row: old above new, strike-through vs bold underline (computed style)
    let found = false;
    for (let i = 0; i < n && !found; i++) {
      await changeRows(page).nth(i).click();
      const body = page.getByTestId('finding-body');
      if ((await body.locator('del').count()) && (await body.locator('ins').count())) found = true;
    }
    expect(found).toBe(true);
    const body = page.getByTestId('finding-body');
    const oldBox = (await body.getByTestId('change-old').boundingBox())!;
    const newBox = (await body.getByTestId('change-new').boundingBox())!;
    expect(oldBox.y).toBeLessThan(newBox.y);
    const del = await body
      .locator('del')
      .first()
      .evaluate((e) => getComputedStyle(e).textDecorationLine);
    expect(del).toContain('line-through');
    const ins = await body
      .locator('ins')
      .first()
      .evaluate((e) => [getComputedStyle(e).textDecorationLine, getComputedStyle(e).fontWeight]);
    expect(ins[0]).toContain('underline');
    expect(Number(ins[1])).toBeGreaterThanOrEqual(600);
    await expect(body.getByTestId('impact-source')).toHaveText(
      'from the logic graph, deterministic',
    );
    await expect(body.getByTestId('impact-investors')).not.toBeEmpty();
    await expect(body.getByTestId('impact-paths')).not.toBeEmpty();
    await expect(body.getByTestId('impact-reusable')).toHaveText(/^(yes|no)$/);
    await expect(body.getByTestId('change-provenance')).toContainText(
      /\d{4}\.\d+\.\d+ \([0-9a-f]{8}\)/,
    );
    await expect(
      body.getByTestId('owner-chip').or(page.getByTestId('owner-chip').first()),
    ).toBeVisible();

    // a role change in the Package lens re-runs the pass WITHOUT re-opening the primary
    await watchReopen(page);
    await page.getByTestId('nav-structure').click();
    await page.getByTestId('structure-lens-terms').click();
    const lensRow = page.getByTestId('package-lens-doc').filter({ hasText: NGI_2024_NAME });
    await lensRow.getByTestId('package-lens-doc-role').selectOption('reference');
    await page.getByTestId('nav-findings').click();
    await varianceSettled(page);
    await expect(changeRows(page)).toHaveCount(0);
    await expect(page.getByTestId('baseline-control')).toContainText('No baseline');
    await page.getByTestId('nav-structure').click();
    await page.getByTestId('structure-lens-terms').click();
    await lensRow.getByTestId('package-lens-doc-role').selectOption('baseline');
    await page.getByTestId('nav-findings').click();
    await varianceSettled(page);
    await expect(changeRows(page)).toHaveCount(n);
    expect(
      await page.evaluate(() => (window as unknown as { __reopened: boolean }).__reopened),
    ).toBe(false);

    // a reload restore re-runs the pass (openDocument completion)
    await page.reload();
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(changeRows(page)).toHaveCount(n, { timeout: 60_000 });

    // --- firm-pointer path: two same-firm uploads; the header modal changes the pointer
    await uploadOne(page, rawFile(NGI_2024, 'ngi-2024.htm'), {
      firm: 'Firm X',
      fund: 'NGI',
      version: '2024',
    });
    await varianceSettled(page);
    await uploadOne(page, hartwellFile('fund-ii-subscription-agreement-prior.html'), {
      firm: 'Firm X',
      fund: 'Hartwell',
      version: 'II',
    });
    await varianceSettled(page);
    await uploadOne(page, rawFile(NGI_2026, 'ngi-2026.htm'), {
      firm: 'Firm X',
      fund: 'NGI',
      version: '2026',
    });
    await varianceSettled(page);
    // the pointer follows the last no-baseline review of the firm (ngi-2024)
    await expect(page.getByTestId('baseline-control')).toContainText('vs ngi-2024.htm');
    const viaPointer = await changeRows(page).count();
    expect(viaPointer).toBeGreaterThan(0);
    await page.getByTestId('baseline-control').click();
    await expect(page.getByTestId('baseline-option')).toHaveCount(2);
    await expect(page.locator('[data-testid="baseline-option"]:checked')).toHaveCount(1);
    await expect(page.getByTestId('baseline-error')).toHaveText('');
    await page
      .getByTestId('baseline-modal')
      .locator('label')
      .filter({ hasText: 'fund-ii-subscription-agreement-prior.html' })
      .locator('input')
      .check();
    await page.getByTestId('baseline-submit').click();
    await expect(page.getByTestId('baseline-modal')).toBeHidden();
    await varianceSettled(page);
    await expect(page.getByTestId('baseline-control')).toContainText(
      'vs fund-ii-subscription-agreement-prior.html',
    );
  });

  test('two package baselines: one is used, the other is ignored with the line', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await uploadPackage(
      page,
      [
        hartwellFile('fund-iii-subscription-agreement.html'),
        hartwellFile('fund-ii-subscription-agreement-prior.html'),
        rawFile(NGI_2024, 'ngi-2024.htm'),
      ],
      { firm: 'Firm X', fund: 'Hartwell Fund III', version: 'v1' },
    );
    await expect(page.getByTestId('package-row')).toHaveCount(3, { timeout: 60_000 });
    await setRow(page, 'fund-iii-subscription-agreement.html', 'to_digitize', 'sub_agreement');
    await setRow(page, 'fund-ii-subscription-agreement-prior.html', 'baseline', 'sub_agreement');
    await setRow(page, 'ngi-2024.htm', 'baseline', 'sub_agreement');
    await finishDraft(page);
    // core eligibleBaselines order: name (no createdAt on members); fund-ii... sorts first
    await expect(page.getByTestId('baseline-control')).toContainText(
      'vs fund-ii-subscription-agreement-prior.html',
    );
    await expect(page.getByTestId('variance-line')).toHaveText(
      '1 other baseline(s) ignored (one baseline per review)',
    );
  });

  test('a scanned baseline shows the scan line; an expired baseline shows the text-gone line', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await uploadPackage(page, [hartwellFile('fund-iii-subscription-agreement.html'), scanPage()], {
      firm: 'Firm X',
      fund: 'Hartwell Fund III',
      version: 'v1',
    });
    await expect(page.getByTestId('package-row')).toHaveCount(2, { timeout: 60_000 });
    await setRow(page, 'fund-iii-subscription-agreement.html', 'to_digitize', 'sub_agreement');
    await setRow(page, 'scanned-page.jpg', 'baseline', 'sub_agreement');
    await finishDraft(page);
    await expect(page.getByTestId('variance-line')).toHaveText(
      'The baseline is a scan; add a text version.',
    );
    await expect(changeRows(page)).toHaveCount(0);

    // expired (pointer path): the stored baseline row is older than 24 h
    await uploadOne(page, rawFile(NGI_2024, 'ngi-2024.htm'), {
      firm: 'Firm Y',
      fund: 'NGI',
      version: '2024',
    });
    await varianceSettled(page);
    await ageUploads(page, 'ngi-2024.htm');
    await uploadOne(page, rawFile(NGI_2026, 'ngi-2026.htm'), {
      firm: 'Firm Y',
      fund: 'NGI',
      version: '2026',
    });
    await varianceSettled(page);
    await expect(page.getByTestId('variance-line')).toHaveText(
      'Baseline text is no longer in the browser; add it again.',
    );
    await expect(changeRows(page)).toHaveCount(0);
  });
});
