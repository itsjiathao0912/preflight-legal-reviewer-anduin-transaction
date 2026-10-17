import { openFund } from './fixtures/counsel';
import { apiJson, expect, openRouterHits, stackHome, test } from './fixtures/stack-memory';

// Phase 08b AC51 (browser to Worker, Hybrid): a rule added through the memory page is stored for
// the open document's firm only (real local Worker, seeded D1); another firm sees none. No AI call:
// the AI-context half of AC51 is proven by the Worker gates firm-rule-in-context-recorded-llm and
// firm-rule-isolation. Also asserts the A0 seed precondition (sd01-sd03 + proposed sr01).
interface WireRule {
  id: string;
  text: string;
  status: string;
}

test.describe('stack-memory firm rules', () => {
  test('a rule added in the memory page is listed for its firm only; no AI call', async ({
    page,
  }) => {
    const hits = openRouterHits(page);
    const aiCalls: string[] = [];
    page.on('request', (r) => {
      if (/\/api\/(ai|ocr)\b/.test(new URL(r.url()).pathname)) aiCalls.push(r.url());
    });
    await stackHome(page);
    await openFund(page, 'fund-I');
    await expect(page.getByTestId('doc-switcher')).toContainText('Firm X');

    // A0 seed precondition: the sandbox copy of the demo seed holds sd01-sd03 and proposed sr01
    // (seed-copy.ts ids are `<sandbox>:<seed id>`)
    const seedId = (id: string) => id.replace(/^.*:/, '');
    const seedRules = await apiJson<{ rules: WireRule[] }>(
      page,
      'GET',
      '/api/rules?law_firm_id=partners-group',
    );
    expect(seedRules.status).toBe(200);
    expect(seedRules.body.rules.find((r) => seedId(r.id) === 'sr01')?.status).toBe('proposed');
    const seedFirm = await apiJson<{ decisions: { id: string }[] }>(
      page,
      'GET',
      '/api/memory/firm?law_firm_id=partners-group',
    );
    expect(seedFirm.body.decisions.map((d) => seedId(d.id))).toEqual(
      expect.arrayContaining(['sd01', 'sd02', 'sd03']),
    );

    await page.getByTestId('nav-memory').click();
    await expect(page.getByTestId('memory-view').locator('h1')).toHaveText('Firm X memory');
    await expect(page.getByTestId('memory-loading')).toHaveCount(0);
    await page.getByTestId('memory-tab-rules').click();
    // letters-only nonce: the Worker masks long digit runs in free text (maskFree)
    const nonce = Array.from({ length: 8 }, () =>
      String.fromCharCode(97 + Math.floor(Math.random() * 26)),
    ).join('');
    const text = `Firm X wording rule ${nonce}: "Subscriber" means "Investor". Not an error.`;
    await page.getByTestId('memory-add-rule').click();
    await page.getByTestId('memory-dialog-text').fill(text);
    const created = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/rules' && r.request().method() === 'POST',
    );
    await page.getByTestId('memory-dialog-submit').click();
    expect((await created).status()).toBe(200);
    await expect(page.getByTestId('memory-dialog')).toHaveCount(0);
    await expect(page.getByTestId('memory-rule').filter({ hasText: text })).toHaveCount(1);

    const rulesOf = async (firm: string) => {
      const r = await apiJson<{ rules: WireRule[] }>(page, 'GET', `/api/rules?law_firm_id=${firm}`);
      expect(r.status).toBe(200);
      return r.body.rules;
    };
    const firmRulesOf = async (firm: string) => {
      const r = await apiJson<{ rules: WireRule[] }>(
        page,
        'GET',
        `/api/memory/firm?law_firm_id=${firm}`,
      );
      expect(r.status).toBe(200);
      return r.body.rules;
    };
    expect((await rulesOf('firm-x')).filter((r) => r.text === text).map((r) => r.status)).toEqual([
      'active',
    ]);
    expect((await firmRulesOf('firm-x')).some((r) => r.text === text)).toBe(true);
    for (const other of ['firm-y', 'partners-group']) {
      expect((await rulesOf(other)).some((r) => r.text === text)).toBe(false);
      expect((await firmRulesOf(other)).some((r) => r.text === text)).toBe(false);
    }
    expect(await rulesOf('firm-y')).toEqual([]);

    // Firm Y's memory page shows none of it
    await openFund(page, 'fund-Y');
    await page.getByTestId('nav-memory').click();
    await expect(page.getByTestId('memory-view').locator('h1')).toHaveText('Firm Y memory');
    await expect(page.getByTestId('memory-loading')).toHaveCount(0);
    await page.getByTestId('memory-tab-rules').click();
    await expect(page.getByTestId('memory-rule')).toHaveCount(0);
    await expect(page.getByTestId('memory-rules')).not.toContainText(text);

    expect(aiCalls).toEqual([]);
    expect(hits).toEqual([]);
  });
});
