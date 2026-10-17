import { expect, test, type Page } from '@playwright/test';
import { chooseReasonAndSave, gotoApp } from './fixtures/app';
import {
  askOwner,
  changeRow,
  gotoQuestions,
  openFundIIIvsII,
  ownerRows,
  questionRow,
  recordAnswer,
} from './fixtures/variance-owners';

// Variance Phase 05 (AC-V18, demo gate walk): from Blocked, the analyst resolves their own items
// (Mark as expected with a reason), asks the owners, exports one DOCX per owner, records each
// owner's answer, and the gate reaches Ready to digitize. At every step the Questions tab counts
// equal the gate popover owner groups, and the popover groups sum to Blocked N (N read from the
// page, never hard-coded). No horizontal overflow, no console errors.
const OWNERS = ['counsel', 'gp', 'fund_admin'] as const;

/** Blocked N from the gate button (0 when Ready to digitize). */
async function blockedN(page: Page): Promise<number> {
  const gate = page.getByTestId('gate-button');
  const text = (await gate.locator('.lbl').textContent()) ?? '';
  if (/Ready to digitize/.test(text)) return 0;
  const m = /Blocked · (\d+)/.exec(text);
  expect(m, `gate text "${text}"`).not.toBeNull();
  // the label count and the reasons badge agree
  await expect(gate.locator('.gn')).toHaveText(m![1]!);
  return Number(m![1]);
}

/** Popover group counts (absent group = 0). */
async function popoverGroups(page: Page): Promise<Record<string, number>> {
  await page.getByTestId('gate-button').click();
  const out: Record<string, number> = {};
  const groups = page.getByTestId('gate-group');
  const n = await groups.count();
  for (let i = 0; i < n; i++) {
    const g = groups.nth(i);
    out[(await g.getAttribute('data-group'))!] = Number(await g.getAttribute('data-count'));
  }
  out.__reasons = await page.getByTestId('gate-reason').count();
  await page.keyboard.press('Escape');
  return out;
}

/** The counts-agree invariant at one step; returns Blocked N. */
async function countsAgree(page: Page, step: string): Promise<number> {
  await gotoQuestions(page);
  const n = await blockedN(page);
  const groups = n ? await popoverGroups(page) : { __reasons: 0 };
  const { __reasons, ...byGroup } = groups as Record<string, number>;
  const sum = Object.values(byGroup).reduce((a, b) => a + b, 0);
  expect(sum, `${step}: popover groups sum to Blocked N`).toBe(n);
  expect(__reasons, `${step}: gate reasons equal Blocked N`).toBe(n);
  let asked = 0;
  for (const o of OWNERS) {
    const tab = page.getByTestId(`questions-tab-${o}`);
    const tabCount = (await tab.count()) ? Number(await tab.getAttribute('data-count')) : 0;
    expect(tabCount, `${step}: Questions tab ${o} equals popover group`).toBe(byGroup[o] ?? 0);
    asked += tabCount;
  }
  const all = page.getByTestId('questions-tab-all');
  if (await all.count()) expect(Number(await all.getAttribute('data-count'))).toBe(asked);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${step}: no horizontal overflow`).toBeLessThanOrEqual(0);
  await page.getByTestId('nav-findings').click();
  return n;
}

test.describe('variance-demo-gate-walk', () => {
  test('should reach Ready to digitize from Blocked with matching counts at every step', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    await gotoApp(page);
    await openFundIIIvsII(page);

    // step 0: Blocked, every change is the analyst's own item
    const n0 = await countsAgree(page, 'blocked');
    expect(n0).toBeGreaterThan(0);

    // step 1: the analyst's own items (Mark as expected with a reason)
    for (const t of [/Minimum Subscription/, /Beneficial Owners/]) {
      await changeRow(page, t).click();
      await page.getByTestId('action-dismiss').click();
      await chooseReasonAndSave(page, 'firm_standard_wording');
    }
    const n1 = await countsAgree(page, 'own items resolved');
    expect(n1).toBe(n0 - 2);

    // step 2: ask the owners (Domicile goes to two owners: one question each)
    for (const t of [
      /Investor Domicile/,
      /Investor Type/,
      /Source of Funds/,
      /Tax Status/,
      /Representations of the Subscriber/,
    ])
      await askOwner(page, t);
    const n2 = await countsAgree(page, 'owners asked');
    expect(n2).toBeGreaterThan(0);

    // step 3: one DOCX per owner
    await gotoQuestions(page);
    for (const o of OWNERS) {
      const group = page.locator(`[data-testid="questions-owner-group"][data-owner="${o}"]`);
      await group.getByTestId('questions-export-owner').click();
      const dlg = page.getByTestId('export-dialog');
      await expect(dlg).toBeVisible();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        dlg.getByTestId('export-download').click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/-questions-fund-iii\.docx$/);
      await expect(dlg).toBeHidden();
    }
    await page.getByTestId('nav-findings').click();
    expect(await countsAgree(page, 'exported')).toBe(n2);

    // step 4: each owner answers; the gate drops by one per answer until Ready
    let prev = n2;
    for (const o of OWNERS) {
      await gotoQuestions(page);
      const keys = await ownerRows(page, o).evaluateAll((els) =>
        els.map((e) => e.getAttribute('data-key')!),
      );
      expect(keys.length, `${o} has questions`).toBeGreaterThan(0);
      for (const key of keys) {
        const row = questionRow(page, key);
        await recordAnswer(page, row, { option: 'A' });
        await expect(row.getByTestId('counsel-answer')).toBeVisible();
      }
      await page.getByTestId('nav-findings').click();
      const n = await countsAgree(page, `${o} answered`);
      expect(n).toBeLessThan(prev);
      prev = n;
    }
    await expect(page.getByTestId('gate-button')).toHaveText(/Ready to digitize/);
    await expect(page.getByTestId('gate-button')).not.toContainText('Blocked');
    expect(consoleErrors).toEqual([]);
  });
});
