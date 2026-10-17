import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openSample } from './fixtures/app';
import { engineFindings } from './fixtures/seedMemory';
import {
  dismissSynced,
  expect,
  firmDecisions,
  newStackContext,
  openRouterHits,
  stackHome,
  test,
} from './fixtures/stack-memory';

// AC57: every new sandbox starts from the seeded demo memory (copied, so its effects show at once)
// and writes in one sandbox never pollute the demo seed seen by the next visitor. A read-only demo
// session (read_only from the session response) disables writes: nothing is sent to memory.
const SEED = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '..', '..', '..', 'fixtures', 'memory', 'demo-seed-spec.json'),
    'utf8',
  ),
) as { decisions: { id: string; sample_id: string; quote: string; decided_by_name: string }[] };
const seededPg = SEED.decisions.filter((d) => d.decided_by_name.startsWith('Avery'));

test.describe('stack-memory demo workspace', () => {
  test('a new sandbox shows the seeded effects; another sandbox writing does not pollute the seed', async ({
    page,
    browser,
    baseURL,
  }) => {
    const hits = openRouterHits(page);
    await stackHome(page);
    await openSample(page, '03');
    // seeded effects: #3 opens with the demo dismissals and answers already handled
    await page.getByTestId('previously-handled-toggle').click();
    const handled = page.getByTestId('previously-handled-item');
    await expect(handled.first()).toBeVisible();
    await expect(handled.filter({ hasText: 'Avery (simulated analyst)' }).first()).toBeVisible();
    const base = await firmDecisions(page, 'partners-group');
    expect(base.length).toBe(seededPg.length);
    expect(base.every((d) => d.decided_by_name === 'Avery (simulated analyst)')).toBe(true);

    // this sandbox writes
    await openSample(page, '04');
    const target = engineFindings('04').find((f) => f.severity === 'medium')!;
    const d = await dismissSynced(page, target.id);
    expect((await firmDecisions(page, 'partners-group')).length).toBe(base.length + 1);

    // the next visitor still gets exactly the seed
    const ctx = await newStackContext(browser, baseURL!);
    const p2 = await ctx.newPage();
    hits.push(...openRouterHits(p2));
    await stackHome(p2);
    await openSample(p2, '04');
    const fresh = await firmDecisions(p2, 'partners-group');
    expect(fresh.map((x) => x.fingerprint).sort()).toEqual(base.map((x) => x.fingerprint).sort());
    expect(fresh.some((x) => x.id === d.id || x.decided_by_name === 'Linh Tran')).toBe(false);
    await expect(
      p2.locator(`[data-testid="finding-row"][data-finding-id="${target.id}"]`),
    ).toBeVisible();
    expect(hits).toEqual([]);
    await ctx.close();
  });

  test('read-only demo session: the UI says so and no memory write is sent', async ({ page }) => {
    const hits = openRouterHits(page);
    const writes: string[] = [];
    page.on('request', (r) => {
      if (
        r.method() === 'POST' &&
        /\/api\/(decisions|runs|counsel)/.test(new URL(r.url()).pathname)
      )
        writes.push(r.url());
    });
    // the client trusts only the session response for read_only (never the cookie)
    await page.route('**/api/session', async (route) => {
      const res = await route.fetch();
      const body = (await res.json()) as Record<string, unknown>;
      await route.fulfill({
        response: res,
        json: { ...body, kind: 'visitor', workspace_id: 'ws_demo', read_only: true },
      });
    });
    await stackHome(page);
    await openSample(page, '03');
    await page.getByTestId('previously-handled-toggle').click();
    await expect(
      page
        .getByTestId('previously-handled-item')
        .filter({ hasText: 'Avery (simulated analyst)' })
        .first(),
    ).toBeVisible();
    await openSample(page, '04');
    const target = engineFindings('04').find((f) => f.severity === 'medium')!;
    await page.locator(`[data-testid="finding-row"][data-finding-id="${target.id}"]`).click();
    await page.getByTestId('action-counsel').click();
    await page.getByTestId('nav-counsel').click();
    await expect(page.getByTestId('counsel-read-only')).toContainText(
      'This demo workspace is read-only',
    );
    await expect(page.getByTestId('unsynced-chip')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(writes).toEqual([]);
    expect(hits).toEqual([]);
  });
});
