import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Finding } from '@aduin/core';
import { openSample, row } from './fixtures/app';
import { answerQuestion, gotoCounsel, gotoFindings, markCounsel } from './fixtures/counsel';
import { engineFindings } from './fixtures/seedMemory';
import {
  auditEvents,
  expect,
  expectSynced,
  firmDecisions,
  openRouterHits,
  stackHome,
  test,
  uniqueIp,
} from './fixtures/stack-memory';

// Real Worker + seeded local D1 (stack-memory project). Decide -> reload -> lookup -> label:
// a dismissal comes back as previously_dismissed, a counsel answer as already_answered, and the
// export is recorded on the run (sheet_exported_at). The outbox drains and the unsynced chip clears.
const SEED = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '..', '..', '..', 'fixtures', 'memory', 'demo-seed-spec.json'),
    'utf8',
  ),
) as { decisions: { sample_id: string; quote: string }[] };

/** #4 (Partners Group, TEI) findings the demo seed does not touch, non-blocking (medium). */
function fresh04(): Finding[] {
  const seeded = new Set(SEED.decisions.map((d) => d.quote));
  return engineFindings('04').filter((f) => f.severity === 'medium' && !seeded.has(f.quote));
}

const handledItem = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`[data-testid="previously-handled-item"][data-finding-id="${id}"]`);

test.describe('stack-memory roundtrip', () => {
  test('dismiss, answer and export persist through the real Worker and come back after reload', async ({
    page,
    browser,
    baseURL,
  }) => {
    const openrouter = openRouterHits(page);
    const [dismissMe, askMe, sendMe] = fresh04();
    expect(dismissMe?.severity, 'a fresh non-blocking finding in #4').toBe('medium');
    expect(sendMe, 'three fresh findings in #4').toBeTruthy();
    await stackHome(page);
    const session = page.waitForResponse(
      (r) => r.url().endsWith('/api/session') && r.request().method() === 'POST',
    );
    await openSample(page, '04');
    const s = await session;
    expect(s.status()).toBe(200);
    expect(await s.json()).toMatchObject({ kind: 'sandbox', read_only: false });

    // 1) dismiss with a reason
    await row(page, dismissMe!.id).click();
    await page.getByTestId('action-dismiss').click();
    await page.locator('[data-testid="dismiss-reason"][value="no_form_impact"]').check();
    const decided = page.waitForResponse(
      (r) => r.url().endsWith('/api/decisions') && r.request().method() === 'POST',
    );
    await page.getByTestId('dismiss-save').click();
    expect((await decided).status()).toBe(200);
    await expectSynced(page);

    // 2) counsel question -> answer A
    await markCounsel(page, askMe!.id);
    await gotoCounsel(page);
    const answered = page.waitForResponse(
      (r) => r.url().endsWith('/api/counsel/answers') && r.request().method() === 'POST',
    );
    await answerQuestion(page, askMe!.id, 'A', 'Roundtrip answer');
    expect((await answered).status()).toBe(200);
    await expectSynced(page);

    // 3) export a sheet with one unanswered question -> sheet_exported_at on the run
    await gotoFindings(page);
    await markCounsel(page, sendMe!.id);
    await gotoCounsel(page);
    await expectSynced(page);
    const exported = page.waitForResponse(
      (r) => /\/api\/runs\/[^/]+\/export$/.test(r.url()) && r.request().method() === 'POST',
    );
    await page.getByTestId('counsel-export').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-download').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const ex = await exported;
    expect(ex.status()).toBe(200);
    const run = (await ex.json()) as {
      run_id: string;
      sheet_exported_at: number;
      sheet_question_count: number;
    };
    expect(run.sheet_question_count).toBe(1);
    expect(run.sheet_exported_at).toBeGreaterThan(0);
    await expect(page.getByText('Query sheet exported: 1 question.')).toBeVisible();
    await expect(page.getByText('The export is not recorded in memory.')).toHaveCount(0);
    await expectSynced(page);

    // reload: local triage persists and nothing is left unsynced
    await page.reload();
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await openSample(page, '04');
    await expect(row(page, dismissMe!.id)).toHaveCount(0);
    await expect(page.getByTestId('unsynced-chip')).toHaveCount(0);

    // a clean browser profile with the same session cookie: labels come only from the Worker lookup
    const ctx2 = await browser.newContext({
      baseURL: baseURL!,
      storageState: { cookies: (await page.context().storageState()).cookies, origins: [] },
      extraHTTPHeaders: { 'cf-connecting-ip': uniqueIp() },
    });
    const page2 = await ctx2.newPage();
    const openrouter2 = openRouterHits(page2);
    await stackHome(page2);
    const lookup = page2.waitForResponse((r) => r.url().endsWith('/api/memory/lookup'));
    await openSample(page2, '04');
    expect((await lookup).status()).toBe(200);
    await page2.getByTestId('previously-handled-toggle').click();
    await expect(handledItem(page2, dismissMe!.id)).toHaveAttribute(
      'data-memory-label',
      'previously_dismissed',
    );
    await expect(handledItem(page2, dismissMe!.id)).toContainText('Linh Tran');
    await expect(handledItem(page2, askMe!.id)).toHaveAttribute(
      'data-memory-label',
      'already_answered',
    );
    await expect(handledItem(page2, askMe!.id)).toContainText('counsel chose A');
    expect(openrouter2).toEqual([]);
    await ctx2.close();

    const mine = (await firmDecisions(page, 'partners-group')).filter(
      (d) => d.decided_by_name === 'Linh Tran',
    );
    expect(mine.map((d) => d.decision).sort()).toEqual(['answered', 'dismissed']);
    const exportEvents = (await auditEvents(page)).filter(
      (e) => e.action === 'counsel_sheet_exported',
    );
    expect(exportEvents.map((e) => e.entity_id)).toContain(run.run_id);
    await expect(page.getByTestId('unsynced-chip')).toHaveCount(0);
    expect(openrouter).toEqual([]);
  });
});
