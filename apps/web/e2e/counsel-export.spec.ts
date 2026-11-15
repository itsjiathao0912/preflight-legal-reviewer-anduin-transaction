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
// repeated questions across funds) is in memory-prior-answer. Review fix F1: a memory failure
// never blocks the deliverable; the DOCX still downloads. Since the Requests rework (22-10-26) the
// export runs from the counsel request drawer ("Export DOCX"); the preview dialog and its summary,
// gate warning and left-out list are gone.
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

    // 3 questions in the counsel request, 1 already answered: only the 2 open ones are exported
    await expect(page.getByTestId('counsel-row')).toHaveCount(3);
    const { text, filename } = await exportDocxText(page);
    expect(filename).toBe('counsel-questions-demo-fund-ii.docx');
    expect(text).toContain('Questions for Counsel · Demo Fund II');
    expect(text).toContain('Law firm: Firm X');
    expect(text).toContain('2 questions for Counsel');
    expect(text).toContain(n1.quote);
    expect(text).toContain(p6.quote);
    expect(text).toMatch(/^A\. /m);
    expect(text).toMatch(/^B\. /m);
    expect(text).toContain('Answer: ______');
    // the answered question and its recorded answer are app-only (D-1)
    expect(text).not.toContain(n2.quote);
    expect(text).not.toContain('SECRET-NOTE');
    expect(text).not.toContain('Answered: option');
    await expect(page.getByText('Request exported.')).toBeVisible();
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
    const { text } = await exportDocxText(page);
    expect(text).toContain('ABA routing number: #8097');
    expect(text).not.toContain(RAW_NUMBER);
  });

  test('a memory failure (503) on export still downloads the DOCX with a quiet note (F1)', async ({
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
      api['exportRun'] = () =>
        Promise.reject(Object.assign(new Error('HTTP 503'), { code: 'unavailable', status: 503 }));
    });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('request-export').click(),
    ]);
    expect(download.suggestedFilename()).toBe('counsel-questions-demo-fund-ii.docx');
    await expect(page.getByText('Request exported.')).toBeVisible();
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
    await expect(page.getByTestId('request-export')).toBeDisabled();
  });
});
