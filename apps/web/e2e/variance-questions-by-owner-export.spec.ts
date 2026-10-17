import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import mammoth from 'mammoth';
import { gotoApp } from './fixtures/app';
import { askOwner, gotoQuestions, openFundIIIvsII } from './fixtures/variance-owners';

// Variance Phase 04 (AC-V13, counts agree): Questions grouped per owner with unanswered counts; one
// DOCX per owner with only that owner's questions (quote, old vs new text, options); the tab counts
// equal the gate popover owner groups and the gate reasons.
async function exportOwner(page: Page, owner: string): Promise<{ name: string; text: string }> {
  await page
    .locator(`[data-testid="questions-owner-group"][data-owner="${owner}"]`)
    .getByTestId('questions-export-owner')
    .click();
  const dlg = page.getByTestId('export-dialog');
  await expect(dlg).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dlg.getByTestId('export-download').click(),
  ]);
  await expect(dlg).toBeHidden();
  const { value } = await mammoth.extractRawText({ buffer: readFileSync(await download.path()) });
  return { name: download.suggestedFilename(), text: value };
}

test.describe('variance-questions-by-owner-export', () => {
  test("should export one DOCX per owner containing only that owner's unanswered questions", async ({
    page,
  }) => {
    await gotoApp(page);
    await openFundIIIvsII(page);
    // Counsel + GP (Domicile), GP (Investor Type), Fund admin (7A), Counsel (Tax Status)
    for (const t of [/Investor Domicile/, /Investor Type/, /Source of Funds/, /Tax Status/])
      await askOwner(page, t);

    // sidebar badge: one per asked owner
    await expect(page.getByTestId('nav-badge-counsel')).toContainText('5');
    await gotoQuestions(page);
    const tab = (k: string) => page.getByTestId(`questions-tab-${k}`);
    await expect(tab('counsel')).toHaveAttribute('data-count', '2');
    await expect(tab('gp')).toHaveAttribute('data-count', '2');
    await expect(tab('fund_admin')).toHaveAttribute('data-count', '1');
    await expect(tab('all')).toHaveAttribute('data-count', '5');
    await expect(page.getByTestId('questions-owner-group')).toHaveCount(3);

    // counts agree: tabs == popover owner groups; groups sum to the gate reasons (Blocked N)
    await page.getByTestId('gate-button').click();
    const group = (g: string) => page.locator(`[data-testid="gate-group"][data-group="${g}"]`);
    await expect(group('counsel')).toHaveAttribute('data-count', '2');
    await expect(group('gp')).toHaveAttribute('data-count', '2');
    await expect(group('fund_admin')).toHaveAttribute('data-count', '1');
    await expect(group('you')).toHaveAttribute('data-count', '3'); // three untriaged changes
    const reasons = await page.getByTestId('gate-reason').count();
    expect(reasons).toBe(8);
    await expect(page.getByTestId('gate-button')).toContainText('8');
    await page.keyboard.press('Escape');

    // one DOCX per owner, only that owner's questions
    const gp = await exportOwner(page, 'gp');
    expect(gp.name).toBe('gp-questions-fund-iii.docx');
    expect(gp.text).toContain('2 questions for GP');
    expect(gp.text).toContain('Singapore');
    expect(gp.text).toMatch(/A\. .+\n/);
    expect(gp.text).not.toContain('Source of Funds');
    expect(gp.text).not.toContain('select all that apply');

    const fa = await exportOwner(page, 'fund_admin');
    expect(fa.name).toBe('fund-admin-questions-fund-iii.docx');
    expect(fa.text).toContain('1 question for Fund admin');
    expect(fa.text).toContain('Source of Funds');
    expect(fa.text).not.toContain('Singapore');

    const counsel = await exportOwner(page, 'counsel');
    expect(counsel.text).toContain('2 questions for Counsel');
    expect(counsel.text).toContain('Singapore'); // the two-owner finding is in each owner's export
    expect(counsel.text).not.toContain('Source of Funds');

    // owner tab: the header export is per owner
    await tab('gp').click();
    await expect(page.getByTestId('counsel-row')).toHaveCount(2);
    await expect(page.locator('header [data-testid="questions-export-owner"]')).toHaveText(
      /Export for GP \(DOCX\)/,
    );
  });
});
