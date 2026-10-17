import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { confirmAllRows, hartwellFiles, runPackage, uploadPackage } from './fixtures/package';

// Intake Phase 2 H6 (AC-I7 web half, AC25): AI off and no API: the package flow completes with
// rule detection only. Residual: the preview build has no API, so zero requests is observed here
// only; the store test asserts the AI lane is never called with AI off.
test.describe('intake-no-llm-run', () => {
  test('should complete the package flow with AI off and no AI or OCR requests', async ({
    page,
  }) => {
    const seen = { ai: 0, ocr: 0 };
    page.on('request', (r) => {
      if (r.url().includes('/api/ai')) seen.ai++;
      if (r.url().includes('/api/ocr')) seen.ocr++;
    });
    await gotoApp(page);
    await page.getByTestId('ai-off').click();
    await expect(page.getByTestId('ai-off')).toHaveAttribute('aria-pressed', 'true');
    await uploadPackage(page, hartwellFiles(), {
      firm: 'Other / no firm',
      fund: 'Hartwell Fund III',
      version: 'v1',
    });
    const rows = page.getByTestId('package-row');
    await expect(rows).toHaveCount(3);
    for (let i = 0; i < 3; i++)
      await expect(rows.nth(i)).toHaveAttribute('data-suggestion-source', 'rule');
    await confirmAllRows(page);
    await runPackage(page);
    await expect(page.getByTestId('finding-row').first()).toBeVisible();
    expect(seen).toEqual({ ai: 0, ocr: 0 });
  });
});
