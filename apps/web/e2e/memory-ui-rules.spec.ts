import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openSample } from './fixtures/app';
import {
  bodiesOf,
  demoSeed,
  errorBody,
  installFakeWorker,
  useFakeWorkerClient,
  type FakeInit,
  type FakeWorker,
} from './fixtures/memory-stub-rules';

// Phase 08b memory page, Rules tab (AC53 UI, AC54). The AI-context half of AC54 (a proposed rule is
// never injected) is proven by the Worker gate `proposed-rule-never-injected`; this spec proves the
// UI side and the request-body field mapping (approve/reject send only client_op_id).
async function openRules(page: Page, init: FakeInit): Promise<FakeWorker> {
  const fw = await installFakeWorker(page, init);
  await gotoApp(page);
  await useFakeWorkerClient(page);
  await page.getByTestId('ai-off').click();
  await openSample(page, '03');
  await page.getByTestId('nav-memory').click();
  await expect(page.getByTestId('memory-loading')).toHaveCount(0);
  await page.getByTestId('memory-tab-rules').click();
  await expect(page.getByTestId('memory-rules')).toBeVisible();
  return fw;
}

const suggestion = (page: Page, id: string) =>
  page.locator(`[data-testid="memory-suggestion"][data-rule-id="${id}"]`);
const activeRule = (page: Page, id: string) =>
  page.locator(`[data-testid="memory-rule"][data-rule-id="${id}"]`);

async function review(page: Page, id: string) {
  await suggestion(page, id).getByTestId('memory-review').click();
  await expect(page.getByTestId('memory-dialog')).toHaveAttribute('data-kind', 'review');
}

test.describe('memory-ui-rules', () => {
  test('should not change AI context before a proposal is approved', async ({ page }) => {
    const fw = await openRules(page, demoSeed());
    // the proposed rule is only in the Suggested strip, never in the Active table
    await expect(suggestion(page, 'sr01')).toContainText('Suggested:');
    await expect(suggestion(page, 'sr01')).toContainText('3 matching dismissals');
    await expect(activeRule(page, 'sr01')).toHaveCount(0);
    await expect(page.getByTestId('memory-no-rules')).toBeVisible();
    await expect(page.getByTestId('memory-ai-info')).toContainText(
      'The AI receives at most 20 active rules (4096 bytes) per request',
    );
    await expect(page.getByTestId('memory-tab-rules')).toContainText('1');

    await review(page, 'sr01');
    const dlg = page.getByTestId('memory-dialog');
    await expect(dlg).toContainText('No effect until approved.');
    await expect(dlg.getByTestId('memory-matching-count')).toHaveText('Matching dismissals: 3');
    await expect(dlg.getByTestId('memory-matching-item')).toHaveCount(3);
    await expect(
      dlg
        .getByTestId('memory-matching-item')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-decision-id')).sort()),
    ).resolves.toEqual(['sd01', 'sd02', 'sd03']);
    // matching dismissals are the client cross-match, never evidence_count
    await expect(dlg).not.toContainText('evidence');
    await expect(dlg.getByTestId('memory-reject-note')).toHaveText(
      'A rejected suggestion can return only if new matching dismissals arrive.',
    );
    // no note / reason field on Approve or Reject (X2/X3)
    await expect(dlg.locator('textarea, input[type="text"]')).toHaveCount(0);

    await dlg.getByTestId('memory-approve').click();
    await expect(dlg).toHaveCount(0);
    await expect(activeRule(page, 'sr01')).toBeVisible();
    await expect(activeRule(page, 'sr01')).toContainText('Linh Tran');
    await expect(suggestion(page, 'sr01')).toHaveCount(0);
    await expect(page.getByTestId('memory-no-suggestions')).toContainText(
      'A rule is suggested after 3 or more dismissals of the same pattern with the same reason (not Other).',
    );
    expect(fw.audit.filter((e) => e.action === 'rule_approved').map((e) => e.entity_id)).toEqual([
      'sr01',
    ]);
    await page.getByTestId('memory-tab-audit').click();
    await page.getByTestId('memory-audit-group').selectOption('rule');
    await expect(
      page.locator('[data-testid="audit-event"][data-action="rule_approved"]'),
    ).toHaveCount(1);
    fw.expectClean();
  });

  test('should send no text on approve or reject', async ({ page }) => {
    const seed = demoSeed();
    seed.rules.push({
      id: 'fr_p2',
      text: 'Findings matching "flag-sensitive:aba" are usually no impact on the digital form (proposed from repeated dismissals).',
      status: 'proposed',
      origin: 'proposal',
      evidence_count: 3,
      law_firm_id: 'partners-group',
    });
    const fw = await openRules(page, seed);
    await review(page, 'sr01');
    await page.getByTestId('memory-approve').click();
    await expect(activeRule(page, 'sr01')).toBeVisible();
    await review(page, 'fr_p2');
    await page.getByTestId('memory-reject').click();
    await expect(page.getByTestId('memory-dialog')).toHaveCount(0);

    for (const action of ['approve', 'reject']) {
      const bodies = bodiesOf(fw, 'POST', new RegExp(`^/api/rules/[^/]+/${action}$`));
      expect(bodies).toHaveLength(1);
      expect(Object.keys(bodies[0]!)).toEqual(['client_op_id']);
    }
    // the approved rule keeps its text (approve `text` would replace it)
    expect(fw.rules.find((r) => r.id === 'sr01')!.text).toBe(seed.rules[0]!.text);
    fw.expectClean();
  });

  test('should keep a rejected proposal inactive until new matching dismissals arrive', async ({
    page,
  }) => {
    const fw = await openRules(page, demoSeed());
    await review(page, 'sr01');
    await page.getByTestId('memory-reject').click();
    await expect(page.getByTestId('memory-dialog')).toHaveCount(0);
    await expect(suggestion(page, 'sr01')).toHaveCount(0);
    await expect(activeRule(page, 'sr01')).toHaveCount(0);
    const rejected = page.locator('[data-testid="memory-rejected-rule"][data-rule-id="sr01"]');
    await expect(rejected).toBeVisible();
    await expect(page.getByTestId('memory-rejected')).toContainText(
      'A rejected suggestion can return only if new matching dismissals arrive.',
    );
    expect(fw.audit.filter((e) => e.action === 'rule_rejected')).toHaveLength(1);
    // no new dismissal: after a full reload the suggestion does not come back
    await page.reload();
    await useFakeWorkerClient(page);
    await page.getByTestId('ai-off').click();
    await openSample(page, '03');
    await page.getByTestId('nav-memory').click();
    await page.getByTestId('memory-tab-rules').click();
    await expect(rejected).toBeVisible();
    await expect(page.getByTestId('memory-suggestion')).toHaveCount(0);
    await expect(page.getByTestId('memory-rule')).toHaveCount(0);
    fw.expectClean();
  });

  test('Add rule and Deactivate with a required reason; field mapping; no Edit control', async ({
    page,
  }) => {
    const fw = await openRules(page, demoSeed());
    await expect(page.getByTestId('memory-rules').getByText(/^Edit/)).toHaveCount(0);

    await page.getByTestId('memory-add-rule').click();
    const dlg = page.getByTestId('memory-dialog');
    await expect(dlg).toHaveAttribute('data-kind', 'add');
    await dlg.getByTestId('memory-dialog-submit').click();
    await expect(dlg.getByTestId('memory-dialog-error')).toHaveText('Enter the rule text first.');
    expect(fw.callsTo('POST', /^\/api\/rules$/)).toEqual([]);
    const text = '“Subscriber” is used instead of “Investor”. Not an error.';
    await dlg.getByTestId('memory-dialog-text').fill(text);
    await dlg.getByTestId('memory-dialog-submit').click();
    await expect(dlg).toHaveCount(0);
    await expect(page.getByTestId('undo-toast')).toContainText('Rule added');
    const create = fw.callsTo('POST', /^\/api\/rules$/);
    expect(create).toHaveLength(1);
    expect(create[0]!.query).toEqual({ law_firm_id: 'partners-group' });
    expect(Object.keys(create[0]!.body as object).sort()).toEqual(['client_op_id', 'text']);
    expect((create[0]!.body as { text: string }).text).toBe(text);
    const added = fw.rules.find((r) => r.text === text)!;
    await expect(activeRule(page, added.id)).toContainText(text);
    await expect(activeRule(page, added.id)).toContainText('Linh Tran');

    await activeRule(page, added.id).getByTestId('memory-deactivate').click();
    await expect(dlg).toHaveAttribute('data-kind', 'deactivate');
    await dlg.getByTestId('memory-dialog-submit').click();
    await expect(dlg.getByTestId('memory-dialog-error')).toHaveText(
      'Enter a reason before deactivating.',
    );
    expect(fw.callsTo('POST', /\/revoke$/)).toEqual([]);
    await dlg.getByTestId('memory-dialog-reason').fill('No longer the firm standard');
    await dlg.getByTestId('memory-dialog-submit').click();
    await expect(dlg).toHaveCount(0);
    await expect(activeRule(page, added.id)).toHaveCount(0);
    const revoke = bodiesOf(fw, 'POST', /^\/api\/rules\/[^/]+\/revoke$/);
    expect(revoke).toHaveLength(1);
    expect(Object.keys(revoke[0]!).sort()).toEqual(['client_op_id', 'text']);
    expect(revoke[0]!['text']).toBe('No longer the firm standard');
    fw.expectClean();
  });

  test('429 active_rule_cap keeps the dialog open with the cap message', async ({ page }) => {
    const fw = await openRules(page, demoSeed());
    fw.failNext('POST', /^\/api\/rules$/, {
      status: 429,
      body: errorBody('quota_exhausted', 'active_rule_cap'),
    });
    await page.getByTestId('memory-add-rule').click();
    const dlg = page.getByTestId('memory-dialog');
    await dlg.getByTestId('memory-dialog-text').fill('One rule too many');
    await dlg.getByTestId('memory-dialog-submit').click();
    await expect(dlg.getByTestId('memory-dialog-error')).toHaveText(
      'This firm already has 100 active rules. Deactivate one first.',
    );
    await expect(dlg).toBeVisible();
    await expect(page.getByTestId('memory-rule')).toHaveCount(0);
    // approve hits the same cap
    await dlg.getByTestId('memory-dialog-cancel').click();
    fw.failNext('POST', /^\/api\/rules\/sr01\/approve$/, {
      status: 429,
      body: errorBody('quota_exhausted', 'active_rule_cap'),
    });
    await review(page, 'sr01');
    await page.getByTestId('memory-approve').click();
    await expect(page.getByTestId('memory-dialog-error')).toHaveText(
      'This firm already has 100 active rules. Deactivate one first.',
    );
    await expect(suggestion(page, 'sr01')).toBeVisible();
    fw.expectClean();
  });

  test('a 400 rule_state race closes the dialog with "Already changed"', async ({ page }) => {
    const fw = await openRules(page, demoSeed());
    const before = fw.callsTo('GET', /^\/api\/rules$/).length;
    fw.failNext('POST', /^\/api\/rules\/sr01\/approve$/, {
      status: 400,
      body: errorBody('invalid_request', 'rule_state'),
    });
    await review(page, 'sr01');
    await page.getByTestId('memory-approve').click();
    await expect(page.getByTestId('memory-dialog')).toHaveCount(0);
    await expect(page.getByTestId('undo-toast')).toContainText('Already changed');
    await expect.poll(() => fw.callsTo('GET', /^\/api\/rules$/).length).toBeGreaterThan(before);
    fw.expectClean();
  });

  test('read-only demo: the suggestion is visible but Approve, Reject, Add and Deactivate are not', async ({
    page,
  }) => {
    const seed = demoSeed();
    seed.rules.push({
      id: 'fr_on',
      text: 'An active rule',
      status: 'active',
      origin: 'manual',
      evidence_count: 0,
      law_firm_id: 'partners-group',
    });
    const fw = await openRules(page, { ...seed, readOnly: true });
    await expect(page.getByTestId('memory-add-rule')).toBeDisabled();
    await expect(page.getByTestId('memory-add-rule')).toHaveAttribute(
      'title',
      'This demo workspace is read-only.',
    );
    await expect(activeRule(page, 'fr_on').getByTestId('memory-deactivate')).toBeDisabled();
    await review(page, 'sr01');
    await expect(page.getByTestId('memory-review-read-only')).toBeVisible();
    await expect(page.getByTestId('memory-approve')).toHaveCount(0);
    await expect(page.getByTestId('memory-reject')).toHaveCount(0);
    const writes = fw.calls.filter(
      (c) => c.method === 'POST' && c.path !== '/api/session' && c.path !== '/api/memory/lookup',
    );
    expect(writes).toEqual([]);
    fw.expectClean();
  });
});
