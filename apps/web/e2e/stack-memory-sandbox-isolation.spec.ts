import { openSample } from './fixtures/app';
import { engineFindings } from './fixtures/seedMemory';
import {
  apiJson,
  auditEvents,
  dismissSynced,
  expect,
  firmDecisions,
  newStackContext,
  openRouterHits,
  stackHome,
  test,
} from './fixtures/stack-memory';

// AC56: two browser contexts (two visitors, two IPs) get two separate sandbox workspaces. A decision
// in sandbox A is invisible to sandbox B (lookup, firm memory, audit) and B cannot revoke it.
test.describe('stack-memory sandbox isolation', () => {
  test('two contexts -> two workspaces; no cross reads, no cross writes', async ({
    browser,
    baseURL,
  }) => {
    const target = engineFindings('04').find((f) => f.severity === 'medium')!;
    const ctxA = await newStackContext(browser, baseURL!);
    const ctxB = await newStackContext(browser, baseURL!);
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    const hits = [...openRouterHits(a), ...openRouterHits(b)];
    const sessions: { workspace_id: string; kind: string }[] = [];
    for (const p of [a, b]) {
      const s = p.waitForResponse((r) => r.url().endsWith('/api/session'));
      await stackHome(p);
      await openSample(p, '04');
      const res = await s;
      expect(res.status()).toBe(200);
      sessions.push((await res.json()) as { workspace_id: string; kind: string });
    }
    expect(sessions.map((s) => s.kind)).toEqual(['sandbox', 'sandbox']);
    expect(sessions[0]!.workspace_id).not.toBe(sessions[1]!.workspace_id);

    const d = await dismissSynced(a, target.id);
    expect((await firmDecisions(a, 'partners-group')).map((x) => x.id)).toContain(d.id);

    // B: not in firm memory, not in lookup, not in audit; the finding is still New in B's list
    expect((await firmDecisions(b, 'partners-group')).map((x) => x.id)).not.toContain(d.id);
    const look = await apiJson<{ decisions: { id: string }[] }>(b, 'POST', '/api/memory/lookup', {
      law_firm_id: 'partners-group',
      fingerprints: [d.fingerprint],
    });
    expect(look.status).toBe(200);
    expect(look.body.decisions).toEqual([]);
    expect((await auditEvents(b)).some((e) => e.entity_id === d.id)).toBe(false);
    await b.reload();
    await openSample(b, '04');
    await expect(
      b.locator(`[data-testid="finding-row"][data-finding-id="${target.id}"]`),
    ).toBeVisible();

    // B cannot revoke A's decision; it stays active for A
    const rv = await apiJson(b, 'POST', `/api/decisions/${d.id}/revoke`, {
      client_op_id: `op_iso_${Date.now().toString(16)}`,
      reason: 'cross-sandbox attempt',
    });
    expect(rv.status).toBeGreaterThanOrEqual(400);
    expect(rv.status).toBeLessThan(500);
    const still = (await firmDecisions(a, 'partners-group')).find((x) => x.id === d.id);
    expect(still?.status).toBe('active');
    expect(hits).toEqual([]);
    await ctxA.close();
    await ctxB.close();
  });
});
