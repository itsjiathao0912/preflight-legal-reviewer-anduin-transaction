import type { AuditEvent } from '@aduin/core';
import { expect, test } from '@playwright/test';
import { gotoApp, openSample } from './fixtures/app';
import {
  demoSeed,
  FIRM,
  installFakeWorker,
  T0,
  useFakeWorkerClient,
} from './fixtures/memory-stub-rules';

// Phase 08b memory page, Audit trail tab (AC55 filters closing; the viewer itself is Phase 08):
// group filter over the loaded pages, "N of M entries, newest first", keyset Load more, firm filter.
test.describe('memory-ui-audit', () => {
  test('should filter the audit list by action group and load the next page', async ({ page }) => {
    const seed = demoSeed();
    // 140 older firm events (decisions + rules) and other-firm / firm-less noise
    const older: AuditEvent[] = Array.from({ length: 140 }, (_, i) => ({
      id: `ae_old_${i}`,
      at: T0 - (i + 1) * 60_000,
      actor_name: 'Duc Pham',
      action: i % 4 === 0 ? 'rule_added' : i % 4 === 1 ? 'decision_revoked' : 'decision_recorded',
      law_firm_id: FIRM,
      entity_type: i % 4 === 0 ? 'rule' : 'decision',
      entity_id: `x${i}`,
      ...(i % 4 === 1 ? { reason: `Reopened ${i}` } : {}),
    }));
    const noise: AuditEvent[] = [
      {
        id: 'ae_other_firm',
        at: T0 + 10,
        actor_name: 'Someone',
        action: 'decision_recorded',
        law_firm_id: 'firm-x',
        entity_type: 'decision',
        entity_id: 'fx1',
      },
      {
        id: 'ae_old_session',
        at: T0 + 20,
        actor_name: 'Someone',
        action: 'session_created',
        entity_type: 'session',
        entity_id: 'an_x',
      },
    ];
    const fw = await installFakeWorker(page, {
      ...seed,
      audit: [...seed.audit, ...older, ...noise],
    });
    await gotoApp(page);
    await useFakeWorkerClient(page);
    await page.getByTestId('ai-off').click();
    await openSample(page, '03');
    await page.getByTestId('nav-memory').click();
    await page.getByTestId('memory-tab-audit').click();
    const list = page.getByTestId('audit-event');
    const shown = page.getByTestId('memory-audit-shown');

    // first page = 100 events (newest first); firm-less session_created and firm-x are excluded
    const firstPage = fw.callsTo('GET', /^\/api\/audit$/);
    expect(firstPage[0]!.query).toEqual({ limit: '100' });
    const n1 = await list.count();
    expect(n1).toBeGreaterThan(90);
    expect(n1).toBeLessThan(100);
    await expect(shown).toHaveText(`${n1} of ${n1} entries, newest first`);
    await expect(
      page.locator('[data-testid="audit-event"][data-action="session_created"]'),
    ).toHaveCount(0);
    await expect(page.getByTestId('memory-audit-note')).toContainText(
      'Filters apply to the loaded entries only',
    );
    // newest first: sd05's decision_recorded is the newest firm event (Target = type + short id)
    await expect(list.first()).toHaveAttribute('data-action', 'decision_recorded');
    await expect(list.first()).toContainText('decision sd05');

    // group filters over the loaded entries
    await page.getByTestId('memory-audit-group').selectOption('reopen');
    const reopenN = await list.count();
    expect(reopenN).toBeGreaterThan(0);
    await expect(shown).toHaveText(`${reopenN} of ${n1} entries, newest first`);
    for (const a of await list.evaluateAll((els) => els.map((e) => e.getAttribute('data-action'))))
      expect(a).toBe('decision_revoked');
    await expect(list.first()).toContainText('Reopened');
    await page.getByTestId('memory-audit-group').selectOption('rule');
    for (const a of await list.evaluateAll((els) => els.map((e) => e.getAttribute('data-action'))))
      expect(a).toMatch(/^rule_/);
    await page.getByTestId('memory-audit-group').selectOption('decision');
    for (const a of await list.evaluateAll((els) => els.map((e) => e.getAttribute('data-action'))))
      expect(['decision_recorded', 'answer_recorded']).toContain(a);
    // Why column shows the reason_code label from detail (X11)
    await expect(
      page
        .locator('[data-testid="audit-event"][data-action="decision_recorded"]')
        .filter({ hasText: "Law firm's standard wording" }),
    ).toHaveCount(3);

    // Load more appends the next keyset page
    await page.getByTestId('memory-audit-group').selectOption('all');
    await page.getByTestId('audit-more').click();
    await expect.poll(() => list.count()).toBeGreaterThan(n1);
    const n2 = await list.count();
    await expect(shown).toHaveText(`${n2} of ${n2} entries, newest first`);
    const pages = fw.callsTo('GET', /^\/api\/audit$/);
    expect(pages.at(-1)!.query['cursor']).toBe('c100');
    await expect(page.getByTestId('audit-more')).toHaveCount(0);
    await expect(
      page.locator('[data-testid="audit-event"][data-action="session_created"]'),
    ).toHaveCount(0);
    // the other firm's event never shows
    expect(await list.count()).toBe(seed.audit.length + older.length);
    fw.expectClean();
  });
});
