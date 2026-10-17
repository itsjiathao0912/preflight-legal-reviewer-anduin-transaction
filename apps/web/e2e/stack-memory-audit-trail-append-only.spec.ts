import { openSample } from './fixtures/app';
import { engineFindings } from './fixtures/seedMemory';
import {
  auditEvents,
  cloneSession,
  dismissSynced,
  expect,
  firmDecisions,
  openRouterHits,
  stackHome,
  test,
} from './fixtures/stack-memory';

// AC55: decide -> revoke leaves an append-only audit trail (session_created, decision_recorded,
// decision_revoked, in order); nothing is deleted: earlier events survive unchanged and the revoked
// decision is no longer active.
test.describe('stack-memory audit trail', () => {
  test('decide then revoke: audit events in order, earlier events never change', async ({
    page,
    browser,
    baseURL,
  }) => {
    const hits = openRouterHits(page);
    const target = engineFindings('04').find((f) => f.severity === 'medium')!;
    await stackHome(page);
    await openSample(page, '04');
    const d = await dismissSynced(page, target.id, 'firm_standard_wording');
    const before = await auditEvents(page);
    const actions = [...before].reverse().map((e) => e.action);
    expect(actions).toContain('session_created');
    expect(actions).toContain('decision_recorded');
    expect(before.find((e) => e.action === 'decision_recorded')!.entity_id).toBe(d.id);

    // revoke through the UI: a clean profile shows it in Previously handled -> Reopen
    const { ctx, page: p2 } = await cloneSession(browser, baseURL!, page);
    hits.push(...openRouterHits(p2));
    await stackHome(p2);
    await openSample(p2, '04');
    await p2.getByTestId('previously-handled-toggle').click();
    const item = p2.locator(
      `[data-testid="previously-handled-item"][data-finding-id="${target.id}"]`,
    );
    const revoked = p2.waitForResponse((r) => /\/api\/decisions\/[^/]+\/revoke$/.test(r.url()));
    await item.getByTestId('reopen-decision').click();
    expect((await revoked).status()).toBe(200);
    await expect(
      p2.locator(`[data-testid="finding-row"][data-finding-id="${target.id}"]`),
    ).toBeVisible();

    const after = await auditEvents(page);
    // append-only: every earlier event is still there, unchanged
    for (const e of before) expect(after).toContainEqual(e);
    expect(after.length).toBeGreaterThan(before.length);
    const chrono = [...after].reverse();
    const iRec = chrono.findIndex((e) => e.action === 'decision_recorded' && e.entity_id === d.id);
    const iRev = chrono.findIndex((e) => e.action === 'decision_revoked' && e.entity_id === d.id);
    // the seeded demo history (copied at session start) comes first, then this session's events
    const iSes = chrono.findIndex((e) => e.action === 'session_created');
    expect(iSes).toBeGreaterThanOrEqual(0);
    expect(iRec).toBeGreaterThan(iSes);
    expect(iRev).toBeGreaterThan(iRec);
    expect(chrono[iRev]!.at).toBeGreaterThanOrEqual(chrono[iRec]!.at);
    // the decision is revoked, not deleted from history, and no longer active
    expect((await firmDecisions(page, 'partners-group')).some((x) => x.id === d.id)).toBe(false);
    expect(hits).toEqual([]);
    await ctx.close();
  });
});
