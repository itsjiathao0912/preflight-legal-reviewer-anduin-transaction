import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { confirmAllRows, openDemoPackage, runPackage } from './fixtures/package';
import { changeRows, errorRows, varianceSettled } from './fixtures/variance';

// Variance Phase 05 (B2, AC-V1 on package inputs): the three design demo packages (Intake's demo
// package list, never samples/packages directly) with the right baseline roles. Northgate (firm
// Hartwell & Crane after the D-S0-7 retag) against its Fund II subscription agreement: recall of the
// 7 answer-key passages (measured 64 raw / 9 shown; no 7-row count). Lotus Bay against its v1 draft:
// the meaning change "shall not" -> "shall" (answer key V6) is surfaced. Redwood Ridge (no baseline
// document, no firm): errors only, no change rows.

/** Answer key section B passages (samples/packages/01-northgate-infrastructure-iii/answer-key.md). */
const NORTHGATE_KEY = [
  'Source of Funds Verification',
  'Singapore',
  'Sanctions',
  'formed or organized outside',
  '$2,500,000',
  'select all that apply',
  'Revocable trust',
];

/** Draft table: one to-digitize primary, one optional baseline by file name, the rest reference. */
async function setRoles(page: Page, primary: string, baseline: string | null) {
  const rows = page.getByTestId('package-row');
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    const text = (await row.textContent()) ?? '';
    const role = row.getByTestId('package-row-role');
    if (text.includes(primary)) {
      await row.getByTestId('package-row-type').selectOption('sub_agreement');
      await role.selectOption('to_digitize');
    } else if (baseline !== null && text.includes(baseline)) {
      await role.selectOption('baseline');
    } else if (['to_digitize', 'baseline'].includes(await role.inputValue())) {
      await role.selectOption('reference');
    }
  }
  await confirmAllRows(page);
  const version = page.getByTestId('package-version-input');
  if (!(await version.inputValue())) await version.fill('v1');
  await runPackage(page);
  await varianceSettled(page);
}

/** Old and new text of every change row (expanding each row once). */
async function changeTexts(page: Page): Promise<string[]> {
  const n = await changeRows(page).count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    await changeRows(page).nth(i).click();
    const body = page.getByTestId('finding-body');
    await expect(body).toBeVisible();
    // non-colour cue labels ("removed:", "added:") are dropped; whitespace collapsed
    const text = ((await changeRows(page).nth(i).textContent()) ?? '') + (await body.innerText());
    out.push(text.replace(/\b(removed|added):\s*/g, '').replace(/\s+/g, ' '));
  }
  return out;
}

test.describe('variance-package-samples', () => {
  test('should review the Northgate, Lotus Bay and Redwood Ridge packages with the right baseline roles', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await gotoApp(page);

    // --- Northgate (Hartwell & Crane): Fund II subscription agreement is the baseline role
    await openDemoPackage(page, 'northgate-iii');
    await setRoles(page, '01-NG3-Subscription-Agreement', '04-NG2-Subscription-Agreement-2024');
    await expect(page.getByTestId('baseline-control')).toContainText(
      'vs 04-NG2-Subscription-Agreement-2024',
    );
    await expect(page.getByTestId('doc-switcher')).toContainText('Hartwell & Crane LLP');
    const ng = await changeTexts(page);
    expect(ng.length).toBeGreaterThan(0);
    for (const passage of NORTHGATE_KEY)
      expect(
        ng.some((t) => t.includes(passage)),
        `Northgate answer-key passage "${passage}" in a shown change row`,
      ).toBe(true);
    console.log(`[variance-package-samples] Northgate shown change rows: ${ng.length}`);

    // --- Lotus Bay (Ostrander & Pell): the v1 draft is the baseline (prior draft role)
    await openDemoPackage(page, 'lotus-bay-asia-ii');
    await setRoles(
      page,
      '01-LB2-Subscription-Agreement-Offshore-v2',
      '04-LB2-Subscription-Agreement-Offshore-v1-draft',
    );
    await expect(page.getByTestId('baseline-control')).toContainText('vs 04-LB2');
    const lb = await changeTexts(page);
    expect(lb.length).toBeGreaterThan(0);
    // answer key V6: "shall not unreasonably withhold" became "shall unreasonably withhold"
    expect(
      lb.some(
        (t) =>
          t.includes('shall not unreasonably withhold') &&
          t.includes('shall unreasonably withhold'),
      ),
      'Lotus Bay V6 meaning change surfaced as a change row',
    ).toBe(true);

    // --- Redwood Ridge (no firm, no baseline document): errors only
    await openDemoPackage(page, 'redwood-ridge-i');
    await setRoles(page, '01-RR1-Subscription-Agreement', null);
    await expect(changeRows(page)).toHaveCount(0);
    // no firm: no baseline control and no Changes segment (the classic errors-only view)
    await expect(page.getByTestId('baseline-control')).toHaveCount(0);
    await expect(page.getByTestId('kind-changes')).toHaveCount(0);
    expect(await errorRows(page).count()).toBeGreaterThan(0);
  });
});
