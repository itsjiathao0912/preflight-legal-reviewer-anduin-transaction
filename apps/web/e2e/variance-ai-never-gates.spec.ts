import { expect, test, type Page } from '@playwright/test';
import {
  aiRows,
  blockOpenRouter,
  enableLane,
  expectStage,
  hb,
  interceptAi,
  interceptQuota,
  ndjson,
  resultFrame,
} from './fixtures/ai';
import { gotoApp } from './fixtures/app';
import { confirmAllRows, openDemoPackage, runPackage } from './fixtures/package';
import { changeRows, varianceSettled } from './fixtures/variance';

// Variance Phase 02 (AC-V9 web part, Hybrid): an AI finding that contradicts the rules (says the
// change is cosmetic, names another owner, asks to block) changes no class, owner, impact or gate.
// /api/ai is answered by a stubbed result frame; no live call; openrouter.ai is aborted.
const NGI_2024_NAME = '05-partners-group-ngi-2024.htm';

async function snapshot(page: Page) {
  const rows = changeRows(page);
  const n = await rows.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = rows.nth(i);
    out.push(
      [
        await r.getAttribute('data-finding-id'),
        await r.getAttribute('data-change-type'),
        await r.getByTestId('change-type').innerText(),
        await r.getByTestId('owner-chip').innerText(),
      ].join('|'),
    );
  }
  return out;
}

test.describe('variance-ai-never-gates', () => {
  test('a contradicting AI finding changes no class, owner, impact or gate, even when it asks to block', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const hits = await blockOpenRouter(page);
    await gotoApp(page);
    await interceptQuota(page);
    await page.route('**/precomputed/**', (r) => r.fulfill({ status: 404, body: '' }));
    let changeText = '';
    const calls = await interceptAi(page, (call) => {
      const words = changeText
        .split(/\s+/)
        .filter((w) => w.length > 5)
        .slice(0, 6);
      const c =
        call.body.candidates.find((x) => words.some((w) => x.quote.includes(w))) ??
        call.body.candidates[0]!;
      return {
        kind: 'stream',
        body: ndjson(
          hb,
          resultFrame([
            {
              candidate_id: c.id,
              issue_class: 'ambiguity',
              severity: 'high', // the highest an AI finding may claim (schema caps AI at high)
              confidence: 0.9,
              quote: c.quote,
              explanation:
                'This change is only cosmetic and belongs to the fund admin, not counsel; it must block digitization.',
            },
          ]),
        ),
      };
    });
    await enableLane(page);
    await openDemoPackage(page, 'ngi');
    await expect(page.getByTestId('package-row')).toHaveCount(2, { timeout: 60_000 });
    await page
      .getByTestId('package-row')
      .filter({ hasText: NGI_2024_NAME })
      .getByTestId('package-row-role')
      .selectOption('baseline');
    await confirmAllRows(page);
    const version = page.getByTestId('package-version-input');
    if (!(await version.inputValue())) await version.fill('v1');
    await runPackage(page);
    await varianceSettled(page);
    expect(await changeRows(page).count()).toBeGreaterThan(0);
    // capture the deterministic state before AI
    await changeRows(page).first().click();
    const body = page.getByTestId('finding-body');
    changeText = await body.getByTestId('change-new').innerText();
    const impactBefore = await body.getByTestId('change-impact').innerText();
    const before = await snapshot(page);
    const gate = page.getByTestId('gate-button');
    const gateBefore = await gate.innerText();
    const stateBefore = await gate.getAttribute('data-gate-state');

    // the AI run (stubbed): a verified AI finding arrives and contradicts the rules
    await expectStage(page, /AI review not run/);
    await page.getByTestId('ai-run-sample').click();
    await expectStage(page, /AI review done/);
    await expect(aiRows(page)).toHaveCount(1);
    expect(calls).toHaveLength(1);

    // nothing deterministic moved: classes, owners, impact and the gate count
    expect(await snapshot(page)).toEqual(before);
    await changeRows(page).first().click();
    expect(await page.getByTestId('finding-body').getByTestId('change-impact').innerText()).toBe(
      impactBefore,
    );
    expect(await gate.innerText()).toBe(gateBefore);
    await expect(gate).toHaveAttribute('data-gate-state', stateBefore!);
    // the AI row never appears among the gate reasons
    const aiId = await aiRows(page).first().getAttribute('data-finding-id');
    await gate.click();
    const pop = page.getByTestId('gate-popover');
    await expect(pop).toBeVisible();
    await expect(pop.getByTestId('gate-reason').first()).toBeVisible();
    await expect(pop.locator(`[data-testid="gate-reason"][data-finding-id="${aiId}"]`)).toHaveCount(
      0,
    );
    // change rows ARE gate reasons under the variance policy (untriaged changes block)
    const firstChange = await changeRows(page).first().getAttribute('data-finding-id');
    await expect(
      pop.locator(`[data-testid="gate-reason"][data-finding-id="${firstChange}"]`),
    ).toHaveCount(1);
    await page.keyboard.press('Escape');
    expect(hits).toEqual([]);
  });
});
