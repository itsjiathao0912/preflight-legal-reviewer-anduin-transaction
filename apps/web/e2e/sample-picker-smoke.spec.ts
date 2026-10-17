import { expect, test } from '@playwright/test';
import { gotoApp, openDialog, rowsLoc, sample } from './fixtures/app';
import { engineFindings } from './fixtures/seedMemory';

const HTML = ['01', '02', '03', '04', '05', '06', '07', '08', '10', '11', '12', '13'];

test.describe('sample-picker-smoke', () => {
  test('every HTML sample opens in one click through the worker engine, pre-tagged', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    for (const id of HTML) {
      await openDialog(page);
      await sample(page, id).click();
      await expect(page.getByTestId('open-document-dialog')).toBeHidden();
      await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
        timeout: 30_000,
      });
      await expect(page.getByTestId('doc-pane').locator('.paper p').first()).toBeVisible();
      const expected = engineFindings(id).length;
      if (expected) await expect(rowsLoc(page)).toHaveCount(expected);
      else await expect(page.getByTestId('empty-state')).toContainText('No findings');
      const firm = ['03', '04', '05', '06'].includes(id) ? 'Partners Group' : 'No firm';
      await expect(page.getByTestId('doc-switcher')).toContainText(firm);
    }
  });

  // Phase 06f (deliberate flip): #9 is enabled and opens in the scan viewer. Variance Phase 05 (B1,
  // derived): 13 original options + 4 Hartwell & Crane variance-demo documents = 17.
  test('the 22-page scan set (#9) is listed and enabled; ILPA #14 is not listed', async ({
    page,
  }) => {
    await gotoApp(page);
    await openDialog(page);
    await expect(page.getByTestId('sample-option')).toHaveCount(13 + 4);
    const vd = page.locator('[data-testid="sample-option"][data-sample-id^="vh-"]');
    await expect(vd).toHaveCount(4);
    for (const t of await vd.allTextContents()) {
      expect(t).toContain('(variance demo)');
      expect(t).toContain('Hartwell & Crane LLP');
      expect(t).not.toContain('NaN');
    }
    await expect(sample(page, '09')).toBeEnabled();
    await expect(sample(page, '09')).toContainText('22 pages');
    await expect(sample(page, '14')).toHaveCount(0);
  });
});
