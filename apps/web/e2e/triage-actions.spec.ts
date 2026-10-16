import { expect, test } from '@playwright/test';
import { chooseReasonAndSave, gotoApp, openSample, row, rowsLoc } from './fixtures/app';

test.describe('triage-actions', () => {
  test('accept and needs-counsel persist across reload and are undoable', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '03');
    const [a, b] = await rowsLoc(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-finding-id')!),
    );
    await row(page, a!).click();
    await page.getByTestId('action-accept').click();
    await expect(row(page, a!)).toHaveAttribute('data-status', 'accepted');
    await expect(page.getByTestId('undo-toast')).toContainText('Finding accepted.');
    await page.getByTestId('undo-button').click();
    await expect(row(page, a!)).toHaveAttribute('data-status', 'open');
    await page.getByTestId('action-accept').click();
    await expect(row(page, a!)).toHaveAttribute('data-status', 'accepted');

    await row(page, b!).click();
    await page.getByTestId('action-counsel').click();
    await expect(row(page, b!)).toHaveAttribute('data-status', 'counsel');
    await expect(page.getByTestId('nav-badge-counsel')).toContainText('1');

    await page.reload();
    await openSample(page, '03');
    await expect(row(page, a!)).toHaveAttribute('data-status', 'accepted');
    await expect(row(page, b!)).toHaveAttribute('data-status', 'counsel');
  });

  test('dismiss with a reason, then restore', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '01');
    const id = (await rowsLoc(page).first().getAttribute('data-finding-id'))!;
    await row(page, id).click();
    await page.getByTestId('action-dismiss').click();
    await chooseReasonAndSave(page, 'no_form_impact');
    await expect(row(page, id)).toHaveCount(0);
    await expect(page.getByTestId('undo-toast')).toContainText('Dismissed.');
    await page.getByTestId('filter-button').click();
    await page.getByTestId('filter-status').selectOption('dismissed');
    await page.keyboard.press('Escape');
    await row(page, id).click();
    await expect(page.getByTestId('finding-body')).toContainText(
      'Reason: Does not affect the form',
    );
    await page.getByTestId('action-restore').click();
    await expect(row(page, id)).toHaveCount(0);
    await page.getByTestId('filter-button').click();
    await page.getByTestId('filter-reset').click();
    await expect(row(page, id)).toHaveAttribute('data-status', 'open');
  });

  test('masked sensitive value: masked in the row and the document; Reveal shows it (AC10 control)', async ({
    page,
  }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      type F = Record<string, unknown> & { anchor: Record<string, unknown> };
      type B = { id: string; kind: string; text: string };
      (
        window as unknown as { __aduinE2E: { transform: (fn: unknown) => void } }
      ).__aduinE2E.transform((fs: F[], blocks: B[]) => {
        const b = blocks.find((x) => x.kind === 'paragraph' && x.text.length > 40)!;
        const tail = ' ABA routing number: 264158097.';
        const start = b.text.length + 1;
        b.text = b.text + tail;
        const s = start + ' ABA routing number: '.length - 1;
        const base = fs[0]!;
        return [
          ...fs,
          {
            ...base,
            id: 'f_seeded_sensitive',
            issue_class: 'sensitive_data',
            classLabel: 'Sensitive data',
            severity: 'medium',
            detector_id: 'sensitive-number',
            title: 'Bank routing number appears in the document',
            anchor: { ...base.anchor, blockId: b.id, offsetStart: start, offsetEnd: b.text.length },
            quote: 'ABA routing number: #8097.',
            quote_snippet: 'ABA routing number: #8097.',
            sensitive: [{ start: s, end: s + 9 }],
            found: '9-digit routing number',
          },
        ];
      });
    });
    await openSample(page, '01');
    await row(page, 'f_seeded_sensitive').click();
    const q = page.getByTestId('finding-quote');
    await expect(q).toContainText('#8097');
    await expect(q).not.toContainText('264158097');
    const mark = page.locator(
      '[data-testid="doc-highlight"][data-finding-id="f_seeded_sensitive"]',
    );
    await expect(mark.first()).toBeVisible();
    await expect(page.getByTestId('doc-pane')).not.toContainText('264158097');
    // Phase 02: #1 now also masks its own ABA/DDA flags, so scope to the seeded value's mask
    await expect(page.getByTestId('doc-pane').locator('.mask', { hasText: '#8097' })).toHaveText(
      '#8097',
    );
    await page.getByTestId('reveal-toggle').click();
    await expect(q).toContainText('264158097');
    await expect(page.getByTestId('doc-pane')).toContainText('264158097');
    await expect(page.getByTestId('reveal-toggle')).toHaveText(/Hide/);
    await page.getByTestId('reveal-toggle').click();
    await expect(q).not.toContainText('264158097');
  });
});
