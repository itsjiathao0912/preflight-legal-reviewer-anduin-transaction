import { expect, test } from '@playwright/test';
import { gotoApp, openDialog } from './fixtures/app';
import { idbCounts } from './fixtures/package';

// Intake Phase 2 H2 (AC-I1): over the package limits a plain message shows and nothing is stored.
const MB = 1024 * 1024;
const html = (n: number) => Buffer.concat([Buffer.from('<p>x</p>'), Buffer.alloc(n - 8, 32)]);

test.describe('intake-limits-refusal', () => {
  test('should refuse 13 files, over 40 MB total and one file over 10 MB and store nothing', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await openDialog(page);
    await expect(page.getByTestId('package-limits-copy')).toHaveText(
      'A package takes up to 12 files and 40 MB in total.',
    );
    const cases: { files: { name: string; mimeType: string; buffer: Buffer }[]; msg: RegExp }[] = [
      {
        files: Array.from({ length: 13 }, (_, i) => ({
          name: `f${i}.html`,
          mimeType: 'text/html',
          buffer: Buffer.from(`<p>File ${i}</p>`),
        })),
        msg: /up to 12 files and 40 MB in total\. You chose 13 files/,
      },
      {
        files: Array.from({ length: 5 }, (_, i) => ({
          name: `big${i}.html`,
          mimeType: 'text/html',
          buffer: html(Math.floor(8.5 * MB)),
        })),
        msg: /40 MB in total\. These files add up to/,
      },
      {
        files: [
          { name: 'huge.html', mimeType: 'text/html', buffer: html(11 * MB) },
          { name: 'small.html', mimeType: 'text/html', buffer: Buffer.from('<p>s</p>') },
        ],
        msg: /Each file can be up to 10 MB/,
      },
    ];
    for (const c of cases) {
      await page.getByTestId('upload-input').setInputFiles(c.files);
      await expect(page.getByTestId('upload-error')).toContainText(c.msg);
      await page.getByTestId('firm-combobox').fill('Other / no firm');
      await page.getByTestId('fund-input').fill('Fund');
      await page.getByTestId('privacy-ack').check();
      await page.getByTestId('open-submit').click();
      await expect(page.getByTestId('upload-error')).toContainText(c.msg);
      await expect(page.getByTestId('package-confirm-table')).toHaveCount(0);
    }
    const counts = await idbCounts(page);
    for (const t of ['packages', 'documents', 'parsedModels']) expect(counts[t] ?? 0, t).toBe(0);
  });
});
