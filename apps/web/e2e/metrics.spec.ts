import { expect, test } from '@playwright/test';
import { chooseReasonAndSave, gotoApp, row } from './fixtures/app';
import {
  EXPECT,
  exportDocxText,
  findingByQuote,
  fundFindings,
  gotoCounsel,
  gotoFindings,
  markCounsel,
  openFund,
} from './fixtures/counsel';

// AC64 delivery metrics (first export only): defects found before build = non-AI findings not
// dismissed as a tool false alarm at export time; questions batched = sheet question count (one
// round); time to exportable sheet = export time minus document open time.
const q = (key: string) =>
  findingByQuote(
    'fund-II',
    EXPECT.passages.find((p) => p.key === key && p.fund === 'fund-II')!.quote,
  );

test.describe('metrics', () => {
  test('first export records defects before build, questions batched and time; later exports do not change them', async ({
    page,
  }) => {
    await gotoApp(page);
    // one AI-detector finding: never counted as a defect found before build
    await page.evaluate(() => {
      type F = Record<string, unknown> & { id: string };
      (
        window as unknown as { __aduinE2E: { transform: (fn: unknown) => void } }
      ).__aduinE2E.transform((fs: F[]) => [
        ...fs,
        { ...fs[0]!, id: 'f_ai_extra', severity: 'medium', detector_kind: 'ai' },
      ]);
    });
    await openFund(page, 'fund-II');
    const total = fundFindings('fund-II').length;
    const falseAlarm = q('n2-new-drafting-note');
    const noImpact = q('n1-new-placeholder');
    const p6 = q('p6-edited-section-ref');
    await row(page, falseAlarm.id).click();
    await page.getByTestId('action-dismiss').click();
    await chooseReasonAndSave(page, 'tool_false_alarm');
    await row(page, noImpact.id).click();
    await page.getByTestId('action-dismiss').click();
    await chooseReasonAndSave(page, 'no_form_impact');
    await markCounsel(page, p6.id);
    await gotoCounsel(page);
    await expect(page.getByTestId('metrics-panel')).toHaveCount(0);
    await exportDocxText(page);

    const panel = page.getByTestId('metrics-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('metric-defects')).toHaveText(String(total - 1));
    await expect(page.getByTestId('metric-questions')).toHaveText('1 in one round');
    await expect(page.getByTestId('metric-time')).toHaveText(/^(\d+ s|\d+ min \d{2} s)$/);
    const time = await page.getByTestId('metric-time').textContent();

    // a later export (more questions) never changes the first-export numbers
    await gotoFindings(page);
    await markCounsel(page, q('p4-broken-conditional').id);
    await gotoCounsel(page);
    await exportDocxText(page);
    await expect(page.getByTestId('metric-defects')).toHaveText(String(total - 1));
    await expect(page.getByTestId('metric-questions')).toHaveText('1 in one round');
    await expect(page.getByTestId('metric-time')).toHaveText(time!);
  });
});
