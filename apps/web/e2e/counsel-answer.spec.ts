import { fingerprintFor } from '@aduin/core';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import {
  answerQuestion,
  counselRow,
  EXPECT,
  findingByQuote,
  gateReason,
  gotoCounsel,
  markAccepted,
  openFund,
  priorItem,
} from './fixtures/counsel';
import { seedMemory } from './fixtures/seedMemory';

// AC21 (record flow + memory write), AC22 (Accept on a blocking finding stays Blocked until counsel
// answers; "unclear" keeps it blocked) and D-3 (an Awaiting-counsel item is answered in the app).
// Fund II alone (no memory) has two critical findings: p4 and p6.
const q = (key: string) =>
  findingByQuote(
    'fund-II',
    EXPECT.passages.find((p) => p.key === key && p.fund === 'fund-II')!.quote,
  );

async function activeDecision(page: Page, fingerprint: string) {
  return page.evaluate(async (fp) => {
    const api = (
      window as unknown as {
        __aduinE2E: {
          memory: () => {
            lookup: (
              f: string,
              fps: string[],
            ) => Promise<{ decision: string; counsel_option?: string; decided_by_name: string }[]>;
          };
        };
      }
    ).__aduinE2E.memory();
    return (await api.lookup('firm-x', [fp]))[0] ?? null;
  }, fingerprint);
}

test.describe('counsel-answer', () => {
  test('Accept on a critical finding keeps the gate Blocked; unclear keeps it; a clear answer opens it and writes memory', async ({
    page,
  }) => {
    await gotoApp(page);
    await openFund(page, 'fund-II');
    const p6 = q('p6-edited-section-ref');
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 2/);
    await markAccepted(page, p6.id);
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 2/);
    await page.getByTestId('gate-button').click();
    await expect(gateReason(page, p6.id)).toHaveAttribute('data-kind', 'unanswered');
    await page.keyboard.press('Escape');

    await gotoCounsel(page);
    await expect(counselRow(page, p6.id)).toHaveAttribute('data-state', 'accepted');
    await answerQuestion(page, p6.id, 'unclear');
    await expect(counselRow(page, p6.id)).toHaveAttribute('data-state', 'unclear');
    await expect(page.getByTestId('counsel-gate-line')).toContainText('2 critical items open');
    await expect(counselRow(page, p6.id).getByTestId('counsel-answer')).toHaveAttribute(
      'data-option',
      'unclear',
    );

    await answerQuestion(page, p6.id, 'A', 'Section 5 is right; Section 4 was renumbered.');
    await expect(counselRow(page, p6.id)).toHaveAttribute('data-state', 'answered');
    await expect(page.getByText('Answer recorded. 1 item')).toBeVisible();
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 1/);
    await expect(page.getByTestId('counsel-meta')).toHaveText('1 question · 0 unanswered');
    const ans = counselRow(page, p6.id).getByTestId('counsel-answer');
    await expect(ans).toHaveAttribute('data-option', 'A');
    await expect(ans).toContainText('Section 5 is right; Section 4 was renumbered.');
    await expect(ans).toContainText('Counsel, Firm X');

    // memory write: the answered decision is the active one for this fingerprint (Firm X)
    const fp = fingerprintFor(p6, 'firm-x')!;
    await expect
      .poll(async () => (await activeDecision(page, fp))?.counsel_option ?? null)
      .toBe('A');
    expect((await activeDecision(page, fp))!.decided_by_name).toBe('Linh Tran');
  });

  test('the answer form needs an option and who answered', async ({ page }) => {
    await gotoApp(page);
    await openFund(page, 'fund-II');
    const p6 = q('p6-edited-section-ref');
    await markAccepted(page, p6.id);
    await gotoCounsel(page);
    const r = counselRow(page, p6.id);
    await r.getByTestId('counsel-row-toggle').click();
    await r.getByTestId('counsel-record').click();
    await page.getByTestId('answer-save').click();
    await expect(page.getByTestId('answer-error')).toContainText('Choose an option or "unclear"');
    await page.locator('[data-testid="answer-option"][value="B"]').check();
    await page.getByTestId('answer-by').fill('');
    await page.getByTestId('answer-save').click();
    await expect(page.getByTestId('answer-error')).toContainText('say who answered');
    await page.getByTestId('answer-cancel').click();
    await expect(r).toHaveAttribute('data-state', 'accepted');
  });

  test('D-3: an Awaiting-counsel item from fund I is answered in the app and leaves the gate', async ({
    page,
  }) => {
    await gotoApp(page);
    const p4 = q('p4-broken-conditional');
    await seedMemory(page, [
      { finding: p4, firmId: 'firm-x', decision: 'accepted', fund: 'Demo Fund I' },
    ]);
    await openFund(page, 'fund-II');
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 2/);
    await page.getByTestId('gate-button').click();
    await expect(gateReason(page, p4.id)).toHaveAttribute('data-kind', 'awaiting_counsel');
    await expect(gateReason(page, p4.id)).toHaveAttribute('data-target', 'counsel');
    await expect(gateReason(page, p4.id)).toContainText('Awaiting counsel (asked in Demo Fund I)');
    await gateReason(page, p4.id).click();
    await expect(page.getByTestId('counsel-view')).toBeVisible();
    const item = priorItem(page, p4.id);
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute('data-kind', 'awaiting');
    await expect(item).toContainText('Counts as unresolved for the gate.');
    await item.getByTestId('counsel-prior-record').click();
    await item.locator('[data-testid="answer-option"][value="B"]').check();
    await item.getByTestId('answer-save').click();
    await expect(item).toHaveAttribute('data-kind', 'answered');
    await expect(item).toContainText('Counsel chose B');
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 1/);
    const fp = fingerprintFor(p4, 'firm-x')!;
    await expect
      .poll(async () => (await activeDecision(page, fp))?.decision ?? null)
      .toBe('answered');
  });
});
