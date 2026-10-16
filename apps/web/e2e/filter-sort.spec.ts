import { expect, test } from '@playwright/test';
import { forceSeverity, gotoApp, openSample, rowsLoc } from './fixtures/app';
import { engineFindings } from './fixtures/seedMemory';

// Phase 02 (E9): #3 now also carries AC10 flags (placeholder, sensitive). Every chip count, row
// count and order below is derived from engine output with the same forced severity.
type Sev = 'critical' | 'high' | 'medium' | 'low';
const KEY: Record<Sev, 'block' | 'fix' | 'note'> = {
  critical: 'block',
  high: 'fix',
  medium: 'note',
  low: 'note',
};
const RANK = { block: 0, fix: 1, note: 2 } as const;
function forced(sampleId: string, sev: Sev) {
  const fs = engineFindings(sampleId);
  const golden = fs.find((f) => f.detector_id === 'ref-label-coherence')!;
  const idx = fs.findIndex((f) => f.id === golden.id);
  const keys = fs.map((f, i) => KEY[(i === idx ? sev : f.severity) as Sev]);
  const count = (k: string) => keys.filter((x) => x === k).length;
  const blockNo = (id: string) => Number(id.replace(/\D/g, ''));
  const docOrder = fs
    .map((f, i) => ({ k: keys[i]!, b: blockNo(f.anchor.blockId), o: f.anchor.offsetStart }))
    .sort((x, y) => x.b - y.b || x.o - y.o)
    .map((x) => x.k);
  const bySeverity = [...keys].sort((x, y) => RANK[x] - RANK[y]);
  return { idx, total: fs.length, count, docOrder, bySeverity };
}

test.describe('filter-sort', () => {
  test('severity chips filter and their counts match the rows', async ({ page }) => {
    await gotoApp(page);
    const e = forced('03', 'critical');
    await forceSeverity(page, 'critical', e.idx);
    await openSample(page, '03');
    await expect(page.getByTestId('severity-chip-block')).toContainText(
      `Blocks ${e.count('block')}`,
    );
    await expect(page.getByTestId('severity-chip-fix')).toContainText(`Fix ${e.count('fix')}`);
    await expect(page.getByTestId('severity-chip-note')).toContainText(`Note ${e.count('note')}`);
    await page.getByTestId('severity-chip-block').click();
    await expect(page.getByTestId('severity-chip-block')).toHaveAttribute('aria-pressed', 'true');
    await expect(rowsLoc(page)).toHaveCount(e.count('block'));
    await expect(rowsLoc(page).first()).toHaveAttribute('data-severity', 'block');
    await page.getByTestId('severity-chip-block').click();
    await expect(rowsLoc(page)).toHaveCount(e.total);
  });

  test('class, detector, status and sort live in the single Filter menu', async ({ page }) => {
    await gotoApp(page);
    const e = forced('03', 'medium');
    await forceSeverity(page, 'medium', e.idx);
    await openSample(page, '03');
    await expect(rowsLoc(page)).toHaveCount(e.total);
    const ids = await rowsLoc(page).evaluateAll((els) =>
      els.map((x) => x.getAttribute('data-severity')),
    );
    expect(ids).toEqual(e.bySeverity);
    await page.getByTestId('filter-button').click();
    await expect(page.getByTestId('filter-menu')).toBeVisible();
    await page.getByTestId('filter-sort').selectOption('doc');
    expect(
      await rowsLoc(page).evaluateAll((els) => els.map((x) => x.getAttribute('data-severity'))),
    ).toEqual(e.docOrder);
    await page.getByTestId('filter-detector').selectOption('ref-label-coherence');
    await expect(rowsLoc(page)).toHaveCount(2);
    await page.getByTestId('filter-class').selectOption('broken_cross_reference');
    await expect(rowsLoc(page)).toHaveCount(2);
    await page.getByTestId('filter-status').selectOption('accepted');
    await expect(rowsLoc(page)).toHaveCount(0);
    await expect(page.getByTestId('empty-state')).toContainText('No findings match these filters.');
    await expect(page.getByTestId('filter-count')).toContainText('4');
    await page.getByTestId('filter-reset').click();
    await expect(page.getByTestId('filter-count')).toHaveCount(0);
    await expect(rowsLoc(page)).toHaveCount(e.total);
  });

  test('should keep filter state after reload', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '03');
    await page.getByTestId('severity-chip-fix').click();
    await page.getByTestId('filter-button').click();
    await page.getByTestId('filter-status').selectOption('open');
    await page.getByTestId('filter-sort').selectOption('cls');
    await page.getByTestId('filter-detector').selectOption('ref-label-coherence');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByTestId('severity-chip-fix')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('filter-count')).toContainText('3');
    await openSample(page, '03');
    await page.getByTestId('filter-button').click();
    await expect(page.getByTestId('filter-status')).toHaveValue('open');
    await expect(page.getByTestId('filter-sort')).toHaveValue('cls');
    await expect(page.getByTestId('filter-detector')).toHaveValue('ref-label-coherence');
    await expect(rowsLoc(page)).toHaveCount(2);
  });

  test('J/K move the selection through the visible list', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '03');
    const ids = await rowsLoc(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-finding-id')),
    );
    await page.locator('body').click({ position: { x: 600, y: 20 } });
    await page.keyboard.press('j');
    await expect(
      page.locator(`[data-testid=finding-row][data-finding-id="${ids[1]}"]`),
    ).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('k');
    await expect(
      page.locator(`[data-testid=finding-row][data-finding-id="${ids[0]}"]`),
    ).toHaveAttribute('aria-expanded', 'true');
  });
});
