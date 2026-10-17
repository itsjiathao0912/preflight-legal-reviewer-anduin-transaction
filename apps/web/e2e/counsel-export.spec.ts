import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import {
  answerQuestion,
  EXPECT,
  exportDocxText,
  findingByQuote,
  gotoCounsel,
  markAccepted,
  markCounsel,
  openFund,
  counselRow,
} from './fixtures/counsel';

// AC21 + D-1: the DOCX lists only UNANSWERED New/Accepted questions with citation (masked quote)
// and interpretations; recorded answers stay in the app. Parsed back with mammoth. AC45 (zero
// repeated questions across funds) is in memory-prior-answer. A failed export leaves the sheet
// editable and nothing is marked exported.
const q = (key: string) =>
  findingByQuote(
    'fund-II',
    EXPECT.passages.find((p) => p.key === key && p.fund === 'fund-II')!.quote,
  );

const RAW_NUMBER = '264158097';

test.describe('counsel-export', () => {
  test('DOCX: only unanswered New/Accepted questions, citations and readings; no recorded answers', async ({
    page,
  }) => {
    await gotoApp(page);
    await openFund(page, 'fund-II');
    const n1 = q('n1-new-placeholder');
    const n2 = q('n2-new-drafting-note');
    const p6 = q('p6-edited-section-ref');
    await markCounsel(page, n1.id);
    await markCounsel(page, n2.id);
    await markAccepted(page, p6.id);
    await gotoCounsel(page);
    await answerQuestion(page, n2.id, 'B', 'SECRET-NOTE counsel prefers option B');

    await page.getByTestId('counsel-export').click();
    await expect(page.getByTestId('export-summary')).toHaveText(
      '2 unanswered questions go to counsel: 1 New, 1 Accepted. Law firm: Firm X.',
    );
    await expect(page.getByTestId('export-item')).toHaveCount(2);
    await expect(page.getByTestId('export-gate-warning')).toContainText(
      'The gate is still Blocked',
    );
    await expect(page.getByTestId('export-left-out')).toContainText('Left out of this export (1)');
    await page.getByTestId('export-close').click();

    const { text, filename } = await exportDocxText(page);
    expect(filename).toBe('counsel-questions-demo-fund-ii.docx');
    expect(text).toContain('Counsel query sheet · Demo Fund II');
    expect(text).toContain('Law firm: Firm X');
    expect(text).toContain('2 questions for counsel');
    expect(text).toContain(n1.quote);
    expect(text).toContain(p6.quote);
    expect(text).toMatch(/^A\. /m);
    expect(text).toMatch(/^B\. /m);
    expect(text).toContain('Answer: ______');
    // the answered question and its recorded answer are app-only (D-1)
    expect(text).not.toContain(n2.quote);
    expect(text).not.toContain('SECRET-NOTE');
    expect(text).not.toContain('Answered: option');
    await expect(page.getByText('Query sheet exported: 2 questions.')).toBeVisible();
  });

  test('sensitive numbers in a quote are masked in the preview and the DOCX', async ({ page }) => {
    await gotoApp(page);
    const n1 = q('n1-new-placeholder');
    await page.evaluate(
      ([id, num]) => {
        (
          window as unknown as { __aduinE2E: { transform: (fn: unknown) => void } }
        ).__aduinE2E.transform((fs: { id: string; quote: string }[]) =>
          fs.map((f) =>
            f.id === id ? { ...f, quote: `${f.quote} Wire to ABA routing number: ${num}.` } : f,
          ),
        );
      },
      [n1.id, RAW_NUMBER] as const,
    );
    await openFund(page, 'fund-II');
    await markCounsel(page, n1.id);
    await gotoCounsel(page);
    await counselRow(page, n1.id).getByTestId('counsel-row-toggle').click();
    await expect(counselRow(page, n1.id).getByTestId('counsel-quote')).toContainText('#8097');
    await expect(counselRow(page, n1.id).getByTestId('counsel-quote')).not.toContainText(
      RAW_NUMBER,
    );
    await page.getByTestId('counsel-export').click();
    await expect(page.getByTestId('export-preview')).not.toContainText(RAW_NUMBER);
    await page.getByTestId('export-close').click();
    const { text } = await exportDocxText(page);
    expect(text).toContain('ABA routing number: #8097');
    expect(text).not.toContain(RAW_NUMBER);
  });

  test('a failed export shows the message, downloads nothing and leaves the sheet editable', async ({
    page,
  }) => {
    await gotoApp(page);
    await openFund(page, 'fund-II');
    const n1 = q('n1-new-placeholder');
    await markCounsel(page, n1.id);
    await gotoCounsel(page);
    await page.evaluate(() => {
      const w = window as unknown as {
        __aduinE2E: { memory: () => Record<string, unknown> };
        __origExport?: unknown;
      };
      const api = w.__aduinE2E.memory();
      w.__origExport = api['exportRun'];
      api['exportRun'] = () => Promise.reject(new Error('boom'));
    });
    let downloads = 0;
    page.on('download', () => downloads++);
    await page.getByTestId('counsel-export').click();
    await page.getByTestId('export-download').click();
    await expect(page.getByTestId('export-error')).toContainText(
      'Nothing was marked as exported; try again.',
    );
    await expect(page.getByTestId('export-dialog')).toBeVisible();
    await expect(page.getByTestId('export-download')).toBeEnabled();
    await page.getByTestId('export-close').click();
    expect(downloads).toBe(0);
    await expect(page.getByTestId('metrics-panel')).toHaveCount(0);
    // still editable: answer the question after the failure
    await answerQuestion(page, n1.id, 'A');
    await expect(counselRow(page, n1.id)).toHaveAttribute('data-state', 'answered');
    // restore and export the (now empty) sheet path: Download is disabled with nothing to send
    await page.evaluate(() => {
      const w = window as unknown as {
        __aduinE2E: { memory: () => Record<string, unknown> };
        __origExport?: unknown;
      };
      w.__aduinE2E.memory()['exportRun'] = w.__origExport;
    });
    await page.getByTestId('counsel-export').click();
    await expect(page.getByTestId('export-summary')).toHaveText(
      'Nothing to send: every question has an answer.',
    );
    await expect(page.getByTestId('export-download')).toBeDisabled();
  });
});
