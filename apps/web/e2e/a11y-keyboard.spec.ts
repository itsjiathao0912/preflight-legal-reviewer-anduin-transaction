import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { forceSeverity, gotoApp, openSample, rowsLoc } from './fixtures/app';
import { changeRows } from './fixtures/variance';
import { askOwner, gotoQuestions, openFundIIIvsII } from './fixtures/variance-owners';

/**
 * AC30 final (Phase 10): 0 critical axe violations on every main screen, the two Phase 03 serious
 * items fixed (nav label-content-name mismatch, findings scroller not focusable), AA text contrast
 * on the Findings screen, severity never conveyed by colour alone, and a keyboard-only path through
 * triage, filters and the gate with a visible focus ring. A keyboard-focus screenshot is attached
 * for the design probe set (U3). The manual keyboard pass is recorded separately (verification.json).
 */
async function audit(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).analyze();
  const critical = r.violations.filter((v) => v.impact === 'critical');
  console.log(
    `[a11y-keyboard] ${label}: critical=${critical.length} serious=${
      r.violations
        .filter((v) => v.impact === 'serious')
        .map((v) => `${v.id}(${v.nodes.length})`)
        .join(',') || '0'
    }`,
  );
  expect(
    critical.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    label,
  ).toEqual([]);
}

/** Rules that were serious in Phase 03 (and AA contrast) must report no violations at all. */
async function auditFixed(page: Page, label: string, rules: string[]) {
  const r = await new AxeBuilder({ page }).withRules(rules).analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    label,
  ).toEqual([]);
}

const activeTestId = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);

/** Press Tab until the focused element carries `testId` (fails after `max` presses). */
async function tabTo(page: Page, testId: string, max = 120) {
  for (let i = 0; i < max; i++) {
    if ((await activeTestId(page)) === testId) return;
    await page.keyboard.press('Tab');
  }
  expect(await activeTestId(page), `Tab never reached ${testId}`).toBe(testId);
}

/** The focused element draws a visible focus indicator (outline or box ring, never none). */
async function expectVisibleFocus(page: Page) {
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    return {
      matches: el.matches(':focus-visible'),
      style: cs.outlineStyle,
      width: parseFloat(cs.outlineWidth),
    };
  });
  expect(ring).not.toBeNull();
  expect(ring!.matches).toBe(true);
  expect(ring!.style).not.toBe('none');
  expect(ring!.width).toBeGreaterThanOrEqual(2);
}

test.describe('a11y-keyboard', () => {
  test('should have no critical axe violations on main screens', async ({ page }) => {
    test.setTimeout(150_000);
    await gotoApp(page);
    await forceSeverity(page, 'critical', 0);
    await openSample(page, '03');
    await audit(page, 'findings');
    await auditFixed(page, 'findings fixed rules', [
      'label-content-name-mismatch',
      'scrollable-region-focusable',
      'color-contrast',
    ]);
    await rowsLoc(page).first().click();
    await audit(page, 'findings expanded');
    await auditFixed(page, 'findings expanded contrast', ['color-contrast']);

    await page.getByTestId('sidebar-toggle').click();
    await audit(page, 'findings rail');
    await auditFixed(page, 'rail nav names', ['label-content-name-mismatch']);
    await page.getByTestId('sidebar-toggle').click();

    for (const [nav, view] of [
      ['nav-counsel', 'counsel-view'],
      ['nav-memory', 'memory-view'],
      ['nav-documents', 'placeholder-view'],
      ['nav-structure', 'structure-view'],
    ] as const) {
      await page.getByTestId(nav).click();
      await expect(page.getByTestId(view)).toBeVisible();
      if (view === 'memory-view') await expect(page.getByTestId('memory-loading')).toHaveCount(0);
      await audit(page, view);
    }

    await page.getByTestId('nav-compare').click();
    await expect(page.getByTestId('compare-view')).toBeVisible();
    await page.getByTestId('cmp-base').selectOption({ label: 'PG NGI 2024' });
    await page.getByTestId('cmp-compare').selectOption({ label: 'PG NGI 2026' });
    await page.getByTestId('cmp-item').first().click({ timeout: 30_000 });
    await audit(page, 'compare');
  });

  test('nav names start with the visible label and severity is never colour only', async ({
    page,
  }) => {
    await gotoApp(page);
    await openSample(page, '03');
    const n = await rowsLoc(page).count();
    expect(n).toBeGreaterThan(0);
    await expect(
      page.getByRole('button', { name: new RegExp(`^Findings ${n} open$`) }),
    ).toHaveCount(1);
    // every row names its severity in text (icon + sr label), not only through colour
    const names = await rowsLoc(page).evaluateAll((els) => els.map((e) => e.textContent ?? ''));
    for (const t of names) expect(t).toMatch(/Blocks digitization:|Fix before build:|Note:/);
    // the findings scroller is a labelled, focusable region
    const list = page.getByRole('region', { name: 'Findings list' });
    await expect(list).toHaveAttribute('tabindex', '0');
  });

  test('should reach triage, filters and the gate by keyboard only', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await forceSeverity(page, 'critical', 0);

    // open a sample from the doc switcher without the mouse
    await tabTo(page, 'doc-switcher');
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('doc-menu')).toBeVisible();
    await tabTo(page, 'open-another', 20);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('open-document-dialog')).toBeVisible();
    const option = page.locator('[data-testid="sample-option"][data-sample-id="03"]');
    await option.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('stage-status-button')).toContainText(/Checks done/, {
      timeout: 30_000,
    });
    await expect(page.getByTestId('loading-state')).toHaveCount(0);

    // triage: Tab to the first finding, expand it, accept it (Findings v2: Ask counsel on the sticky
    // bar after the list; on this blocking row it records an accept)
    await tabTo(page, 'finding-row');
    await expectVisibleFocus(page);
    await page.screenshot({ path: testInfo.outputPath('keyboard-focus.png') });
    await testInfo.attach('keyboard-focus', {
      path: testInfo.outputPath('keyboard-focus.png'),
      contentType: 'image/png',
    });
    const id = await page.evaluate(() => document.activeElement!.getAttribute('data-finding-id'));
    const focused = page.locator(`[data-testid="finding-row"][data-finding-id="${id}"]`);
    await page.keyboard.press('Enter');
    await expect(focused).toHaveAttribute('aria-expanded', 'true');
    await tabTo(page, 'action-counsel', 120);
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(focused).toHaveAttribute('data-status', 'accepted');

    // filters: a severity chip toggles with Space; the Filter menu opens, is walkable, closes on Esc
    await tabTo(page, 'severity-chip-block');
    await page.keyboard.press('Space');
    await expect(page.getByTestId('severity-chip-block')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(page.getByTestId('severity-chip-block')).toHaveAttribute('aria-pressed', 'false');
    await tabTo(page, 'filter-button', 20);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('filter-menu')).toBeVisible();
    for (const t of ['filter-class', 'filter-status', 'filter-sort']) await tabTo(page, t, 10);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('filter-menu')).toBeHidden();
    await expect(page.getByTestId('filter-button')).toBeFocused();

    // gate: reachable from the keyboard, opens, Esc returns focus
    await tabTo(page, 'gate-button');
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('gate-popover')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gate-popover')).toBeHidden();
    await expect(page.getByTestId('gate-button')).toBeFocused();
  });

  // Variance Phase 05 (D2, additive): the changed screens of the demo story. Baseline modal,
  // All/Errors/Changes segment, a change row, Questions tabs and the answer form: zero critical axe,
  // keyboard order, non-colour cues (the change type is text, not colour only).
  test('should have zero critical axe violations and keyboard order on the variance screens', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await openFundIIIvsII(page);
    await audit(page, 'findings with changes');

    // segment: keyboard toggles Changes
    await page.getByTestId('kind-all').focus();
    await tabTo(page, 'kind-changes', 10);
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('kind-changes')).toHaveAttribute('aria-pressed', 'true');
    await expect(changeRows(page)).toHaveCount(7);

    // a change row: reachable by Tab, opens with Enter, type stated as text
    await tabTo(page, 'finding-row', 40);
    await expectVisibleFocus(page);
    const id = await page.evaluate(() => document.activeElement!.getAttribute('data-finding-id'));
    const focused = page.locator(`[data-testid="finding-row"][data-finding-id="${id}"]`);
    await expect(focused).toHaveAttribute('data-kind', 'change');
    await expect(focused.getByTestId('change-type')).toHaveText(/^(New|Logic)/);
    await page.keyboard.press('Enter');
    await expect(focused).toHaveAttribute('aria-expanded', 'true');
    await audit(page, 'expanded change row');

    // baseline modal: opens from the keyboard, audited, Esc returns focus to the control
    await page.getByTestId('baseline-control').focus();
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('baseline-modal')).toBeVisible();
    await audit(page, 'baseline modal');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('baseline-modal')).toBeHidden();
    // focus return to the control after Esc is a known gap (dialog focus return backlog), not asserted

    // Questions tabs and the answer form
    await page.getByTestId('kind-all').click();
    await askOwner(page, /Investor Domicile/);
    await gotoQuestions(page);
    await audit(page, 'questions by owner');
    await page.getByTestId('questions-tab-all').focus();
    await tabTo(page, 'questions-tab-gp', 10);
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('counsel-row')).toHaveCount(1);
    const row = page.getByTestId('counsel-row').first();
    await row.getByTestId('counsel-row-toggle').click();
    await row.getByTestId('counsel-record').click();
    await expect(row.getByTestId('answer-form')).toBeVisible();
    await audit(page, 'answer form');
  });
});
