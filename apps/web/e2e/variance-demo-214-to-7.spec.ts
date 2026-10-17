import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { changeRows, chooseBaseline } from './fixtures/variance';
import {
  askOwner,
  changeRow,
  gotoQuestions,
  HC,
  openHc,
  recordFirmTemplateAnswer,
} from './fixtures/variance-owners';

// Variance Phase 05 (AC-V4, demo story L9): Hartwell & Crane, Fund III against the Fund II baseline
// through the upload route. 214 raw changes become 7 shown (3 New, 4 Logic); 207 cosmetic changes
// stay hidden in 5 groups; the 4.2 impact line; the owner chips per the routing table; then the
// Fund II firm-template answer "Appendix C must exist" makes Fund III show the R-01 regression.
// All numbers come from the pinned expected file, never from the engine.
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const EXPECTED = JSON.parse(
  readFileSync(join(ROOT, 'fixtures', 'variance', 'expected', 'hartwell-crane.json'), 'utf8'),
) as {
  raw: number;
  shown: number;
  new: number;
  changed_logic: number;
  cosmetic: number;
  groups: Record<string, number>;
  r01: { statement: string; source_fund: string };
};

/** Change row title (real fixture wording) -> owners of the routing table (expected file items). */
const OWNERS: [RegExp, string[]][] = [
  [/Source of Funds Verification/, ['fund_admin']], // 7A
  [/Investor Domicile/, ['counsel', 'gp']], // Singapore
  [/Representations of the Subscriber/, ['counsel']], // sanctions 8(f)
  [/Beneficial Owners/, ['counsel']], // 4.2
  [/Minimum Subscription/, ['gp']], // Class A minimum
  [/Tax Status/, ['counsel']], // select all that apply
  [/Investor Type/, ['gp']], // trust split
];

test.describe('variance-demo-214-to-7', () => {
  test('should reduce 214 raw changes to 7 shown (3 new, 4 logic) with 207 cosmetic in 5 groups', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    await gotoApp(page);
    // demo order: Fund I, then Fund II (the Fund II vs Fund I change "Appendix C removed" gets the
    // firm-template answer "Appendix C must exist"), then Fund III against the Fund II baseline
    await openHc(page, 'fund-I.html', 'Fund I');
    await openHc(page, 'fund-II.html', 'Fund II');
    await askOwner(page, /Appendix C/i);
    await gotoQuestions(page);
    await recordFirmTemplateAnswer(
      page,
      page.getByTestId('counsel-row').first(),
      'Every fund keeps the Appendix C questionnaire.',
    );
    await page.getByTestId('nav-findings').click();
    await openHc(page, 'fund-III.html', 'Fund III');
    // the firm pointer is the first document (Fund I): the presenter picks Fund II in the control
    await chooseBaseline(page, 'fund-II.html');
    const reg = changeRows(page).filter({
      hasText: `Regression: confirmed in ${EXPECTED.r01.source_fund}`,
    });
    await expect(reg).toHaveCount(1, { timeout: 20_000 });
    const shown = changeRows(page).filter({ hasNotText: 'Regression: confirmed' });

    // header control and the 7 shown changes (3 New, 4 Logic)
    await expect(page.getByTestId('baseline-control')).toContainText('vs fund-II.html');
    expect(EXPECTED.raw).toBe(214);
    expect(EXPECTED.shown).toBe(7);
    await expect(shown).toHaveCount(EXPECTED.shown);
    await expect(page.getByTestId('kind-changes')).toContainText(`Changes${EXPECTED.shown + 1}`);
    await expect(shown.and(page.locator('[data-change-type="new"]'))).toHaveCount(EXPECTED.new);
    await expect(shown.and(page.locator('[data-change-type="changed_logic"]'))).toHaveCount(
      EXPECTED.changed_logic,
    );

    // 207 cosmetic changes: hidden by default, 5 groups on request, never rows
    const toggle = page.getByTestId('show-cosmetic');
    await expect(toggle).not.toBeChecked();
    await expect(page.getByTestId('cosmetic-groups').locator('label')).toHaveText(
      `Show cosmetic changes (${EXPECTED.cosmetic})`,
    );
    await expect(page.getByTestId('cosmetic-group')).toHaveCount(0);
    await toggle.check();
    const groups = page.getByTestId('cosmetic-group');
    await expect(groups).toHaveCount(5);
    await expect(page.getByTestId('cosmetic-more')).toHaveCount(0);
    const counts = (await groups.allTextContents()).map((t) =>
      Number(/· (\d+) changes?/.exec(t)![1]),
    );
    expect([...counts].sort((a, b) => a - b)).toEqual(
      Object.values(EXPECTED.groups).sort((a, b) => a - b),
    ); // renumber 118, fund name 41, rename 29, format 11, date 8
    expect(counts.reduce((a, b) => a + b, 0)).toBe(EXPECTED.cosmetic);
    await expect(shown).toHaveCount(EXPECTED.shown);
    await toggle.uncheck();

    // owner chips per the routing table
    for (const [title, owners] of OWNERS) {
      const chip = changeRow(page, title).getByTestId('owner-chip');
      await expect(chip, String(title)).toHaveCount(1);
      const got = ((await chip.getAttribute('data-owners')) ?? '').split(',').sort();
      expect(got, String(title)).toEqual(owners);
    }

    // impact line for 4.2 (deterministic, from the logic graph)
    await changeRow(page, /Beneficial Owners/).click();
    const body = page.getByTestId('finding-body');
    await expect(body.getByTestId('impact-source')).toHaveText(
      'from the logic graph, deterministic',
    );
    await expect(body.getByTestId('impact-reusable')).toHaveText('no');
    await expect(body.getByTestId('change-impact')).toContainText(
      'US entities lose the beneficial owners question; old rule not reusable',
    );

    // R-01: the blocking regression finding with the check statement
    await expect(reg.getByTestId('change-type')).toContainText('Regression');
    await reg.click();
    await expect(page.getByTestId('finding-body')).toContainText(EXPECTED.r01.statement);
    await expect(changeRows(page)).toHaveCount(EXPECTED.shown + 1);
    await expect(page.getByTestId('doc-switcher')).toContainText(HC);
    expect(consoleErrors).toEqual([]);
  });
});
