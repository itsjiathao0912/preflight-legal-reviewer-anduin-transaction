import { expect, test } from '@playwright/test';
import { chooseReasonAndSave, forceSeverity, gotoApp, openSample, row } from './fixtures/app';
import { engineFindings, seedMemory } from './fixtures/seedMemory';

const FIRM = 'partners-group';

test.describe('previously-handled-section', () => {
  test('real flow: dismissed in #3 (fund A) is labelled re-confirm in #5 (fund B, same firm) and stays in the main list', async ({
    page,
  }) => {
    await gotoApp(page);
    await openSample(page, '03');
    const [f3] = engineFindings('03');
    const f5 = engineFindings('05').find((f) => f.quote_hash === f3!.quote_hash)!;
    await row(page, f3!.id).click();
    await page.getByTestId('action-dismiss').click();
    await chooseReasonAndSave(page, 'firm_standard_wording');
    await openSample(page, '05');
    await expect(row(page, f5.id)).toBeVisible();
    await row(page, f5.id).click();
    await expect(page.getByTestId('finding-memory-tag')).toHaveText(
      'Dismissed in Partners Group Private Equity (Master Fund), re-confirm',
    );
    await expect(page.getByTestId('action-dismiss')).toHaveText(/Re-confirm dismissal/);
    await expect(page.getByTestId('previously-handled-count')).toHaveText('0');
  });

  test('should keep a critical dismissed item in the main list labelled re-confirm and count it as unresolved', async ({
    page,
  }) => {
    await gotoApp(page);
    const [a] = engineFindings('05');
    await seedMemory(page, [
      {
        finding: a!,
        firmId: FIRM,
        decision: 'dismissed',
        fund: 'Master Fund 2019',
        reason: 'firm_standard_wording',
      },
    ]);
    await forceSeverity(page, 'critical');
    await openSample(page, '05');
    await expect(row(page, a!.id)).toBeVisible();
    await row(page, a!.id).click();
    await expect(page.getByTestId('finding-memory-tag')).toHaveText(
      'Dismissed in Master Fund 2019, re-confirm',
    );
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 2/);
    await page.getByTestId('gate-button').click();
    await expect(
      page.locator(`[data-testid="gate-reason"][data-finding-id="${a!.id}"]`),
    ).toHaveAttribute('data-kind', 'reconfirm_required');
  });

  test('complete, collapsible list with reason/who/fund/when; Reopen revokes and the item returns as New', async ({
    page,
  }) => {
    await gotoApp(page);
    const [a, b] = engineFindings('05');
    const ids = await seedMemory(page, [
      {
        finding: a!,
        firmId: FIRM,
        decision: 'dismissed',
        fund: 'Master Fund 2019',
        who: 'Duc Pham',
        reason: 'firm_standard_wording',
      },
      {
        finding: b!,
        firmId: FIRM,
        decision: 'answered',
        fund: 'TEI 2016',
        who: 'Minh Anh Nguyen',
        option: 'A',
      },
    ]);
    await forceSeverity(page, 'medium', 0);
    await openSample(page, '05');
    await expect(page.getByTestId('previously-handled-count')).toHaveText('2');
    await expect(page.getByTestId('previously-handled-item').first()).toBeHidden();
    await expect(row(page, a!.id)).toHaveCount(0);
    await page.getByTestId('previously-handled-toggle').click();
    await expect(page.getByTestId('previously-handled-toggle')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const items = page.getByTestId('previously-handled-item');
    await expect(items).toHaveCount(2);
    const dismissed = page.locator(
      `[data-testid="previously-handled-item"][data-finding-id="${a!.id}"]`,
    );
    await expect(dismissed).toHaveAttribute('data-memory-label', 'previously_dismissed');
    await expect(dismissed).toContainText('Previously dismissed · Duc Pham · Master Fund 2019 ·');
    await expect(dismissed).toContainText(new RegExp(String(new Date().getFullYear())));
    await expect(dismissed).toContainText("Reason: Law firm's standard wording");
    const answered = page.locator(
      `[data-testid="previously-handled-item"][data-finding-id="${b!.id}"]`,
    );
    await expect(answered).toHaveAttribute('data-memory-label', 'already_answered');
    await expect(answered).toContainText('counsel chose A');

    await dismissed.getByTestId('reopen-decision').click();
    await expect(page.getByTestId('previously-handled-count')).toHaveText('1');
    await expect(row(page, a!.id)).toBeVisible();
    await row(page, a!.id).click();
    await expect(page.getByTestId('finding-memory-tag')).toHaveText('New');
    const status = await page.evaluate(async (id) => {
      const api = (
        window as unknown as {
          __aduinE2E: {
            memory: () => { lookup: (f: string, fps: string[]) => Promise<{ id: string }[]> };
          };
        }
      ).__aduinE2E.memory();
      void api;
      const req = indexedDB.open('aduin-web');
      const db: IDBDatabase = await new Promise((res) => (req.onsuccess = () => res(req.result)));
      const tx = db.transaction('decisions').objectStore('decisions').get(id);
      return new Promise<string>(
        (res) => (tx.onsuccess = () => res((tx.result as { status: string }).status)),
      );
    }, ids[0]!);
    expect(status).toBe('revoked');
  });

  test('no firm: memory not applied and no lookup call', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const w = window as unknown as {
        __aduinE2E: { memory: () => { lookup: (...a: unknown[]) => unknown } };
        __lookups: number;
      };
      const api = w.__aduinE2E.memory();
      const orig = api.lookup.bind(api);
      w.__lookups = 0;
      api.lookup = (...a: unknown[]) => {
        w.__lookups++;
        return orig(...a);
      };
    });
    await openSample(page, '01');
    await expect(page.getByTestId('memory-not-applied')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __lookups: number }).__lookups)).toBe(
      0,
    );
    await openSample(page, '05');
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __lookups: number }).__lookups))
      .toBe(1);
  });
});
