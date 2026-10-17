import { expect, test } from '@playwright/test';
import { chooseReasonAndSave, gotoApp, row } from './fixtures/app';
import {
  counselRow,
  EXPECT,
  findingByQuote,
  gateReason,
  markCounsel,
  openFund,
} from './fixtures/counsel';
import { seedMemory } from './fixtures/seedMemory';

// AC22 + AC48: the gate pill lists every unresolved critical item with a link (data-target) to where
// it is resolved; AI-detector findings never gate (L4); a HIGH dismissed_reconfirm keeps its label but
// does not gate; a critical one gates until it is re-confirmed. Fund II alone: p4 and p6 are critical.
// (Token `counsel-gate`, not `gate`, which would also match gate-pill.spec.ts.)
const q = (key: string) =>
  findingByQuote(
    'fund-II',
    EXPECT.passages.find((p) => p.key === key && p.fund === 'fund-II')!.quote,
  );

test.describe('counsel-gate', () => {
  test('reasons link to Findings (open item) or Counsel questions (question) via data-target', async ({
    page,
  }) => {
    await gotoApp(page);
    await openFund(page, 'fund-II');
    const p4 = q('p4-broken-conditional');
    const p6 = q('p6-edited-section-ref');
    await markCounsel(page, p6.id);
    await page.getByTestId('gate-button').click();
    await expect(page.getByTestId('gate-reason')).toHaveCount(2);
    await expect(gateReason(page, p4.id)).toHaveAttribute('data-kind', 'open');
    await expect(gateReason(page, p4.id)).toHaveAttribute('data-target', 'findings');
    await expect(gateReason(page, p6.id)).toHaveAttribute('data-kind', 'awaiting_counsel');
    await expect(gateReason(page, p6.id)).toHaveAttribute('data-target', 'counsel');

    await gateReason(page, p6.id).click();
    await expect(page.getByTestId('counsel-view')).toBeVisible();
    await expect(counselRow(page, p6.id).getByTestId('counsel-row-toggle')).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await page.getByTestId('counsel-gate-reasons').click();
    await gateReason(page, p4.id).click();
    await expect(page.getByTestId('nav-findings')).toHaveAttribute('aria-current', 'page');
    await expect(row(page, p4.id)).toHaveAttribute('aria-expanded', 'true');
  });

  test('an AI-detector critical finding never gates (L4)', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      type F = Record<string, unknown> & { id: string; severity: string };
      (
        window as unknown as { __aduinE2E: { transform: (fn: unknown) => void } }
      ).__aduinE2E.transform((fs: F[]) => [
        ...fs,
        { ...fs[0]!, id: 'f_ai_critical', severity: 'critical', detector_kind: 'ai' },
      ]);
    });
    await openFund(page, 'fund-II');
    await expect(row(page, 'f_ai_critical')).toBeVisible();
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 2/);
    await page.getByTestId('gate-button').click();
    await expect(gateReason(page, 'f_ai_critical')).toHaveCount(0);
  });

  test('a HIGH dismissed_reconfirm shows its label but does not gate', async ({ page }) => {
    await gotoApp(page);
    const p5 = q('p5-option-overlap');
    expect(p5.severity).toBe('high');
    await seedMemory(page, [
      {
        finding: p5,
        firmId: 'firm-x',
        decision: 'dismissed',
        fund: 'Demo Fund I',
        reason: 'firm_standard_wording',
      },
    ]);
    await openFund(page, 'fund-II');
    await expect(row(page, p5.id)).toBeVisible();
    await row(page, p5.id).click();
    await expect(page.getByTestId('finding-memory-tag')).toHaveText(
      'Dismissed in Demo Fund I, re-confirm',
    );
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 2/);
    await page.getByTestId('gate-button').click();
    await expect(gateReason(page, p5.id)).toHaveCount(0);
  });

  test('a CRITICAL dismissed_reconfirm gates until re-confirmed with a reason', async ({
    page,
  }) => {
    await gotoApp(page);
    const p4 = q('p4-broken-conditional');
    const p6 = q('p6-edited-section-ref');
    await seedMemory(page, [
      {
        finding: p4,
        firmId: 'firm-x',
        decision: 'dismissed',
        fund: 'Demo Fund I',
        reason: 'no_form_impact',
      },
    ]);
    await openFund(page, 'fund-II');
    await page.getByTestId('gate-button').click();
    await expect(gateReason(page, p4.id)).toHaveAttribute('data-kind', 'reconfirm_required');
    await expect(gateReason(page, p4.id)).toHaveAttribute('data-target', 'findings');
    await expect(gateReason(page, p4.id)).toContainText('Dismissed in Demo Fund I, re-confirm');
    await gateReason(page, p4.id).click();
    await row(page, p4.id).click();
    await expect(page.getByTestId('action-dismiss')).toHaveText(/Re-confirm dismissal/);
    await page.getByTestId('action-dismiss').click();
    await chooseReasonAndSave(page, 'no_form_impact');
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 1/);
    await page.getByTestId('gate-button').click();
    await expect(gateReason(page, p4.id)).toHaveCount(0);
    await expect(gateReason(page, p6.id)).toHaveAttribute('data-kind', 'open');
  });
});
