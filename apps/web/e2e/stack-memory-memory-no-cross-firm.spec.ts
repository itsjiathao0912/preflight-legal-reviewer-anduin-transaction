import { fingerprintFor } from '@aduin/core';
import { EXPECT, findingByQuote, openFund } from './fixtures/counsel';
import {
  apiJson,
  dismissSynced,
  expect,
  firmDecisions,
  openRouterHits,
  stackHome,
  test,
} from './fixtures/stack-memory';

// AC47 on the real Worker: a Firm X decision never applies to Firm Y (same workspace, identical
// passage), while it still applies to the next Firm X fund.
test.describe('stack-memory no cross-firm', () => {
  test('dismissed for Firm X at fund I: New for Firm Y at fund Y, Previously handled at fund II', async ({
    page,
  }) => {
    const hits = openRouterHits(page);
    const quote = EXPECT.passages.find((p) => p.key === 'p1-placeholder-insert')!.quote;
    const fI = findingByQuote('fund-I', quote);
    const fY = findingByQuote('fund-Y', quote);
    const fII = findingByQuote('fund-II', quote);
    await stackHome(page);
    await openFund(page, 'fund-I');
    const d = await dismissSynced(page, fI.id, 'firm_standard_wording');
    expect(d.fingerprint).toBe(fingerprintFor(fI, 'firm-x'));

    await openFund(page, 'fund-Y');
    await expect(page.getByTestId('doc-switcher')).toContainText('Firm Y');
    await expect(
      page.locator(`[data-testid="finding-row"][data-finding-id="${fY.id}"]`),
    ).toBeVisible();
    await expect(page.getByTestId('previously-handled-count')).toHaveText('0');
    expect(await firmDecisions(page, 'firm-y')).toEqual([]);
    const look = await apiJson<{ decisions: unknown[] }>(page, 'POST', '/api/memory/lookup', {
      law_firm_id: 'firm-y',
      fingerprints: [d.fingerprint, fingerprintFor(fY, 'firm-y')!],
    });
    expect(look.status).toBe(200);
    expect(look.body.decisions).toEqual([]);

    await openFund(page, 'fund-II');
    await page.getByTestId('previously-handled-toggle').click();
    await expect(
      page.locator(`[data-testid="previously-handled-item"][data-finding-id="${fII.id}"]`),
    ).toHaveAttribute('data-memory-label', 'previously_dismissed');
    expect((await firmDecisions(page, 'firm-x')).map((x) => x.id)).toEqual([d.id]);
    expect(hits).toEqual([]);
  });
});
