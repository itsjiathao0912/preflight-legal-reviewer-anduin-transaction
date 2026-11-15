import { expect, test } from '@playwright/test';
import { gotoApp, openDialog, rowsLoc, uploadSample } from './fixtures/app';
import { engineFindings } from './fixtures/seedMemory';

const HTML = ['01', '02', '03', '04', '05', '06', '07', '08', '10', '11', '12', '13'];

// 0c3a6a2 replaced the single-sample picker with demo packages: each bundled HTML sample is opened
// by uploading its bytes (same doc hash), tagged with the firm the picker used.
test.describe('sample-picker-smoke', () => {
  test('every HTML sample opens through the worker engine, pre-tagged', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoApp(page);
    for (const id of HTML) {
      await uploadSample(page, id);
      await expect(page.getByTestId('open-document-dialog')).toBeHidden();
      await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
        timeout: 30_000,
      });
      await expect(page.getByTestId('doc-pane').locator('.paper p').first()).toBeVisible();
      // an upload is a one-document package, so package checks may add findings on top of the
      // engine's: the engine's findings are the lower bound
      const expected = engineFindings(id).length;
      if (expected) await expect.poll(() => rowsLoc(page).count()).toBeGreaterThanOrEqual(expected);
      const firm = ['03', '04', '05', '06'].includes(id) ? 'Partners Group' : 'No firm';
      await expect(page.getByTestId('doc-switcher')).toContainText(firm);
    }
  });

  // The dialog no longer lists single samples: only demo packages (and no `sample-option` rows).
  test('the dialog lists demo packages and no single-sample options', async ({ page }) => {
    await gotoApp(page);
    await openDialog(page);
    await expect(page.getByTestId('sample-option')).toHaveCount(0);
    await page.getByTestId('demo-toggle').click();
    expect(await page.getByTestId('package-sample-option').count()).toBeGreaterThan(0);
    for (const t of await page.getByTestId('package-sample-option').allTextContents())
      expect(t).not.toContain('NaN');
  });
});
