import { fingerprintFor } from '@aduin/core';
import { expect, test, type Page } from '@playwright/test';
import { forceSeverity, gotoApp, openSample, row } from './fixtures/app';
import {
  bodiesOf,
  demoSeed,
  errorBody,
  fakeDecision,
  FIRM,
  installFakeWorker,
  recordedEvent,
  useFakeWorkerClient,
  type FakeInit,
  type FakeWorker,
} from './fixtures/memory-stub-rules';
import { engineFindings } from './fixtures/seedMemory';

// Phase 08b memory page, Decisions tab (AC52) and Reopen (AC50 closing), against the page.route
// fake Worker through the real memory client.
const goldens = (id: string) =>
  engineFindings(id).filter((f) => f.detector_id === 'ref-label-coherence');

const decisionRow = (page: Page, id: string) =>
  page.locator(`[data-testid="memory-decision"][data-decision-id="${id}"]`);

async function setup(page: Page, init: FakeInit): Promise<FakeWorker> {
  const fw = await installFakeWorker(page, init);
  await gotoApp(page);
  await useFakeWorkerClient(page);
  await page.getByTestId('ai-off').click();
  return fw;
}

async function gotoMemory(page: Page) {
  await page.getByTestId('nav-memory').click();
  await expect(page.getByTestId('memory-view')).toBeVisible();
  await expect(page.getByTestId('memory-loading')).toHaveCount(0);
}

async function reopen(page: Page, id: string, reason: string) {
  await decisionRow(page, id).getByTestId('memory-reopen').click();
  const dlg = page.getByTestId('memory-dialog');
  await expect(dlg).toHaveAttribute('data-kind', 'reopen');
  await dlg.getByTestId('memory-dialog-reason').fill(reason);
  await dlg.getByTestId('memory-dialog-submit').click();
}

test.describe('memory-ui-decisions', () => {
  test("should list a firm's decisions filtered by issue class", async ({ page }) => {
    const fw = await setup(page, demoSeed());
    await openSample(page, '03');
    await gotoMemory(page);
    await expect(page.getByTestId('memory-view').locator('h1')).toHaveText('Partners Group memory');
    await expect(page.getByTestId('memory-meta')).toHaveText(
      '5 decisions (5 active) · 0 rules · 1 suggested',
    );
    await expect(page.getByTestId('memory-tab-decisions')).toHaveAttribute('aria-selected', 'true');
    const rows = page.getByTestId('memory-decision');
    await expect(rows).toHaveCount(5);
    await expect(decisionRow(page, 'sd01')).toContainText('Avery (simulated analyst)');
    await expect(decisionRow(page, 'sd01')).toContainText('quoted passage for sd01');

    // issue-class filter
    await page.getByTestId('memory-filter-class').selectOption('sensitive_data');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-decision-id', 'sd04');
    await expect(page.getByTestId('memory-decisions-shown')).toHaveText('1 of 5');
    await page.getByTestId('memory-filter-class').selectOption('placeholder');
    await expect(rows).toHaveCount(3);
    await page.getByTestId('memory-filter-class').selectOption('all');

    // status filter (nothing reopened yet)
    await page.locator('[data-testid="memory-filter-status"][data-value="reopened"]').click();
    await expect(rows).toHaveCount(0);
    await expect(page.getByTestId('memory-decisions-empty')).toBeVisible();
    await page.locator('[data-testid="memory-filter-status"][data-value="active"]').click();
    await expect(rows).toHaveCount(5);

    // segmented control: arrow keys move the selection
    await page.getByTestId('memory-tab-decisions').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('memory-tab-rules')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('memory-tab-rules')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('memory-tab-decisions')).toHaveAttribute('aria-selected', 'true');

    // info popover
    await page.getByTestId('memory-info').click();
    await expect(page.getByTestId('memory-kept')).toContainText('What memory keeps');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('memory-kept')).toHaveCount(0);
    fw.expectClean();
  });

  test('Reopen refuses an empty reason, writes an audit row and moves the row to Reopened', async ({
    page,
  }) => {
    const fw = await setup(page, demoSeed());
    await openSample(page, '03');
    await gotoMemory(page);
    await decisionRow(page, 'sd04').getByTestId('memory-reopen').click();
    const dlg = page.getByTestId('memory-dialog');
    await dlg.getByTestId('memory-dialog-submit').click();
    await expect(dlg.getByTestId('memory-dialog-error')).toHaveText(
      'Enter a reason before reopening. The audit trail needs one.',
    );
    await dlg.getByTestId('memory-dialog-reason').fill('   ');
    await dlg.getByTestId('memory-dialog-submit').click();
    await expect(dlg).toBeVisible();
    expect(fw.callsTo('POST', /\/revoke$/)).toEqual([]);

    await dlg.getByTestId('memory-dialog-reason').fill('Counsel changed their answer');
    await dlg.getByTestId('memory-dialog-submit').click();
    await expect(page.getByTestId('memory-dialog')).toHaveCount(0);
    await expect(page.getByTestId('undo-toast')).toContainText('Decision reopened');

    // Reopen body = {client_op_id, reason} exactly (G13 / E3)
    const bodies = bodiesOf(fw, 'POST', /^\/api\/decisions\/sd04\/revoke$/);
    expect(bodies).toHaveLength(1);
    expect(Object.keys(bodies[0]!).sort()).toEqual(['client_op_id', 'reason']);
    expect(bodies[0]!['reason']).toBe('Counsel changed their answer');

    // the row is now Reopened (from the decision_revoked audit event; full row kept this session)
    const r = decisionRow(page, 'sd04');
    await expect(r).toHaveAttribute('data-status', 'reopened');
    await expect(r).toContainText('Reopened');
    await expect(r.getByTestId('memory-reopen')).toHaveCount(0);
    await page.locator('[data-testid="memory-filter-status"][data-value="reopened"]').click();
    await expect(page.getByTestId('memory-decision')).toHaveCount(1);
    await page.locator('[data-testid="memory-filter-status"][data-value="active"]').click();
    await expect(page.getByTestId('memory-decision')).toHaveCount(4);
    expect(fw.audit.filter((e) => e.action === 'decision_revoked').map((e) => e.entity_id)).toEqual(
      ['sd04'],
    );
    await page.getByTestId('memory-tab-audit').click();
    await expect(
      page.locator('[data-testid="audit-event"][data-action="decision_revoked"]'),
    ).toContainText('Counsel changed their answer');
    fw.expectClean();
  });

  test('a lean Reopened row comes from the audit trail with who, when, why; unknown class is hidden under a class filter', async ({
    page,
  }) => {
    const seed = demoSeed();
    const gone = fakeDecision('fd0a', { status: 'revoked', issue_class: 'defined_term_issue' });
    const lean = fakeDecision('fd0b', { status: 'revoked' });
    seed.decisions.push(gone, lean);
    seed.audit.push(recordedEvent(gone), {
      id: 'ae_rv_a',
      at: Date.UTC(2026, 9, 9, 9, 30),
      actor_name: 'Linh Tran',
      action: 'decision_revoked',
      law_firm_id: FIRM,
      entity_type: 'decision',
      entity_id: 'fd0a',
      reason: 'The 2024 template renamed Units to Shares',
      detail: { decision: 'dismissed' },
    });
    seed.audit.push({
      id: 'ae_rv_b',
      at: Date.UTC(2026, 9, 10, 9, 30),
      actor_name: 'Duc Pham',
      action: 'decision_revoked',
      law_firm_id: FIRM,
      entity_type: 'decision',
      entity_id: 'fd0b',
      reason: 'Template changed',
      detail: { decision: 'dismissed' },
    });
    const fw = await setup(page, seed);
    await openSample(page, '03');
    await gotoMemory(page);
    await expect(page.getByTestId('memory-decision')).toHaveCount(7);
    const a = decisionRow(page, 'fd0a');
    await expect(a).toHaveAttribute('data-status', 'reopened');
    await expect(a).toContainText(
      'Reopened by Linh Tran on 9 Oct 2026: The 2024 template renamed Units to Shares',
    );
    await expect(a).toHaveAttribute('data-class', 'defined_term_issue');
    const b = decisionRow(page, 'fd0b');
    await expect(b).toContainText('Reopened by Duc Pham');
    await expect(b).toContainText('—');
    await page.getByTestId('memory-filter-class').selectOption('placeholder');
    await expect(b).toHaveCount(0);
    await page.getByTestId('memory-filter-class').selectOption('all');
    await expect(b).toHaveCount(1);
    fw.expectClean();
  });

  test('should reopen a decision and show the finding as New', async ({ page }) => {
    // AC50 case (a): a prior-fund decision of the firm labels the finding previously_dismissed
    const [a] = goldens('05');
    const dec = fakeDecision('fdpa', {
      fingerprint: fingerprintFor(a!, FIRM)!,
      issue_class: a!.issue_class,
      quote_snippet: a!.quote_snippet,
      fund_name: 'Master Fund 2019',
      decided_by_name: 'Duc Pham',
    });
    const fw = await setup(page, { decisions: [dec], audit: [recordedEvent(dec)] });
    await forceSeverity(
      page,
      'medium',
      engineFindings('05').findIndex((f) => f.id === a!.id),
    );
    await openSample(page, '05');
    await page.getByTestId('previously-handled-toggle').click();
    await expect(
      page.locator(`[data-testid="previously-handled-item"][data-finding-id="${a!.id}"]`),
    ).toHaveAttribute('data-memory-label', 'previously_dismissed');
    await expect(row(page, a!.id)).toHaveCount(0);

    await gotoMemory(page);
    await reopen(page, 'fdpa', 'Counsel changed their answer');
    await expect(page.getByTestId('undo-toast')).toContainText('the finding is New again');
    await expect(decisionRow(page, 'fdpa')).toHaveAttribute('data-status', 'reopened');

    await page.getByTestId('nav-findings').click();
    await expect(row(page, a!.id)).toBeVisible();
    await row(page, a!.id).click();
    await expect(page.getByTestId('finding-memory-tag')).toHaveText('New');
    fw.expectClean();
  });

  test('AC50 (b): the same-document triage entry with the revoked decisionId resets to open', async ({
    page,
  }) => {
    const [, b] = goldens('05');
    const dec = fakeDecision('fdpb', {
      fingerprint: fingerprintFor(b!, FIRM)!,
      issue_class: b!.issue_class,
      quote_snippet: b!.quote_snippet,
      fund_name: 'Partners Group Next Generation Infrastructure',
      decided_by_name: 'Linh Tran',
    });
    const fw = await setup(page, { decisions: [dec], audit: [recordedEvent(dec)] });
    await openSample(page, '05');
    const docId = await page.evaluate(
      () =>
        (
          window as unknown as { __aduinE2E: { review: () => { doc: { id: string } } } }
        ).__aduinE2E.review().doc.id,
    );
    // E13: seed the triage row directly in Dexie uiState (no UI dismiss), then reopen the document
    await page.evaluate(
      async ([key, fid]) => {
        const req = indexedDB.open('aduin-web');
        const db: IDBDatabase = await new Promise((res) => (req.onsuccess = () => res(req.result)));
        await new Promise<void>((res, rej) => {
          const tx = db.transaction('uiState', 'readwrite');
          tx.objectStore('uiState').put({
            key,
            value: {
              [fid]: {
                status: 'dismissed',
                reasonCode: 'firm_standard_wording',
                decisionId: 'fdpb',
              },
            },
            updatedAt: Date.now(),
          });
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
        db.close();
      },
      [`triage:${docId}`, b!.id] as const,
    );
    await openSample(page, '05');
    const triageOf = () =>
      page.evaluate(
        (fid) =>
          (
            window as unknown as {
              __aduinE2E: { review: () => { triage: Record<string, { status: string }> } };
            }
          ).__aduinE2E.review().triage[fid]?.status ?? null,
        b!.id,
      );
    expect(await triageOf()).toBe('dismissed');
    await expect(row(page, b!.id)).toHaveCount(0);

    await gotoMemory(page);
    await reopen(page, 'fdpb', 'Reopened for the next review');
    await expect(decisionRow(page, 'fdpb')).toHaveAttribute('data-status', 'reopened');
    await expect.poll(triageOf).toBe('open');

    await page.getByTestId('nav-findings').click();
    await expect(row(page, b!.id)).toHaveAttribute('data-status', 'open');
    await row(page, b!.id).click();
    await expect(page.getByTestId('finding-memory-tag')).toHaveText('New');
    fw.expectClean();
  });

  test('a lost race (409 or 400 decision_not_found) refetches, closes the dialog and toasts "Already changed"', async ({
    page,
  }) => {
    const fw = await setup(page, demoSeed());
    await openSample(page, '03');
    await gotoMemory(page);
    for (const [status, body] of [
      [409, errorBody('conflict_active_decision', undefined, { current: null })],
      [400, errorBody('invalid_request', 'decision_not_found')],
    ] as const) {
      const before = fw.callsTo('GET', /^\/api\/memory\/firm$/).length;
      fw.failNext('POST', /^\/api\/decisions\/sd01\/revoke$/, { status, body });
      await reopen(page, 'sd01', 'Race');
      await expect(page.getByTestId('memory-dialog')).toHaveCount(0);
      await expect(page.getByTestId('undo-toast')).toContainText('Already changed');
      await expect
        .poll(() => fw.callsTo('GET', /^\/api\/memory\/firm$/).length)
        .toBeGreaterThan(before);
      await page.evaluate(() =>
        (
          window as unknown as { __aduinE2E: { review: () => { clearToast: () => void } } }
        ).__aduinE2E
          .review()
          .clearToast(),
      );
      await expect(page.getByTestId('undo-toast')).toHaveCount(0);
    }
    fw.expectClean();
  });

  test('a network error keeps the dialog open; Try again sends a fresh client_op_id', async ({
    page,
  }) => {
    const fw = await setup(page, demoSeed());
    await openSample(page, '03');
    await gotoMemory(page);
    fw.failNext('POST', /^\/api\/decisions\/sd02\/revoke$/, 'abort');
    await reopen(page, 'sd02', 'Retry me');
    const dlg = page.getByTestId('memory-dialog');
    await expect(dlg.getByTestId('memory-dialog-error')).toHaveText(
      'Could not reach memory. Try again',
    );
    await dlg.getByTestId('memory-dialog-submit').click();
    await expect(dlg).toHaveCount(0);
    const ops = bodiesOf(fw, 'POST', /^\/api\/decisions\/sd02\/revoke$/).map(
      (b) => b['client_op_id'],
    );
    expect(ops).toHaveLength(2);
    expect(ops[0]).not.toBe(ops[1]);
    await expect(decisionRow(page, 'sd02')).toHaveAttribute('data-status', 'reopened');
    fw.expectClean();
  });

  test('no firm: empty state and no firm() call', async ({ page }) => {
    const fw = await setup(page, demoSeed());
    await gotoMemory(page);
    await expect(page.getByTestId('memory-no-firm')).toHaveText(
      'Open a document for a law firm to see its memory.',
    );
    await openSample(page, '01');
    await gotoMemory(page);
    await expect(page.getByTestId('memory-no-firm')).toBeVisible();
    expect(fw.callsTo('GET', /^\/api\/memory\/firm$/)).toEqual([]);
    expect(fw.callsTo('GET', /^\/api\/rules$/)).toEqual([]);
    fw.expectClean();
  });

  test('more than 200 active decisions shows the truncation note', async ({ page }) => {
    const decisions = Array.from({ length: 205 }, (_, i) =>
      fakeDecision(`fd${(1000 + i).toString(16)}`, {
        decided_at: Date.UTC(2026, 0, 1) + i * 60_000,
      }),
    );
    const fw = await setup(page, { decisions });
    await openSample(page, '03');
    await gotoMemory(page);
    await expect(page.getByTestId('memory-decision')).toHaveCount(200);
    await expect(page.getByTestId('memory-decisions-truncated')).toHaveText(
      'Showing the newest 200 decisions (of 205 active).',
    );
    fw.expectClean();
  });

  test('503 memory_unavailable shows the unavailable state with Retry', async ({ page }) => {
    const fw = await setup(page, demoSeed());
    await openSample(page, '03');
    fw.failNext('GET', /^\/api\/memory\/firm$/, {
      status: 503,
      body: errorBody('memory_unavailable'),
    });
    await page.getByTestId('nav-memory').click();
    await expect(page.getByTestId('memory-unavailable')).toContainText(
      'Memory unavailable. Findings are shown as New.',
    );
    await expect(page.getByTestId('memory-decision')).toHaveCount(0);
    await expect(page.getByTestId('memory-reopen')).toHaveCount(0);
    await page.getByTestId('memory-retry').click();
    await expect(page.getByTestId('memory-decision')).toHaveCount(5);
    fw.expectClean();
  });

  test('read-only demo session: Reopen is disabled with a tooltip and nothing is written', async ({
    page,
  }) => {
    const fw = await setup(page, { ...demoSeed(), readOnly: true });
    await openSample(page, '03');
    await gotoMemory(page);
    await expect(page.getByTestId('memory-read-only')).toBeVisible();
    const btn = decisionRow(page, 'sd01').getByTestId('memory-reopen');
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveAttribute('title', 'This demo workspace is read-only.');
    const writes = fw.calls.filter(
      (c) => c.method === 'POST' && c.path !== '/api/session' && c.path !== '/api/memory/lookup',
    );
    expect(writes).toEqual([]);
    fw.expectClean();
  });
});
