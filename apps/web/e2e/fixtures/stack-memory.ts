import { randomBytes } from 'node:crypto';
import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

/**
 * Shared helpers for the Phase 08 `stack-memory` project (real Worker + seeded local D1 on :8788).
 * The Worker caps new sessions at 50 per IP per day and reads the IP only from `cf-connecting-ip`,
 * so every browser context gets its own random 10.x.y.z address through `extraHTTPHeaders`.
 */
export const CLIENT_HEADERS = { 'x-aduin-client': '1' } as const;

export function uniqueIp(): string {
  const [a, b, c] = randomBytes(3);
  return `10.${a}.${b}.${c ?? 1}`;
}

/** Extra browser contexts (e.g. a second sandbox) must also carry a fresh IP. */
export async function newStackContext(browser: Browser, baseURL: string): Promise<BrowserContext> {
  return browser.newContext({ baseURL, extraHTTPHeaders: { 'cf-connecting-ip': uniqueIp() } });
}

/** `test` whose default context (page, page.request) uses a unique IP per test. */
export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use) => {
    await use({ ...extraHTTPHeaders, 'cf-connecting-ip': uniqueIp() });
  },
});

export { expect } from '@playwright/test';

// --- Phase 08 S3 helpers (stack-memory specs: plain production build, no e2e hooks) ---

/** Open the app and switch the AI lane off (no /api/ai calls; the stack has no OpenRouter key). */
export async function stackHome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.getByTestId('ai-off').click();
}

/** Every browser request to openrouter.ai, across the whole context (must stay empty). */
export function openRouterHits(page: Page): string[] {
  const hits: string[] = [];
  page.context().on('request', (r) => {
    if (/openrouter\.ai/i.test(r.url())) hits.push(r.url());
  });
  return hits;
}

/** Same-origin JSON API call with the page's context cookies. */
export async function apiJson<T = unknown>(
  page: Page,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const origin = new URL(page.url()).origin;
  const res = await page.request.fetch(path, {
    method,
    headers: {
      ...CLIENT_HEADERS,
      ...(method === 'POST' ? { origin, 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { data: body } : {}),
  });
  const text = await res.text();
  return { status: res.status(), body: (text ? JSON.parse(text) : null) as T };
}

export interface StackDecision {
  id: string;
  fingerprint: string;
  status: string;
  decision: string;
  decided_by_name: string;
  counsel_option?: string;
  fund_name?: string;
}

export async function firmDecisions(page: Page, firmId: string): Promise<StackDecision[]> {
  const r = await apiJson<{ decisions: StackDecision[] }>(
    page,
    'GET',
    `/api/memory/firm?law_firm_id=${encodeURIComponent(firmId)}`,
  );
  expect(r.status).toBe(200);
  return r.body.decisions;
}

export interface StackAuditEvent {
  id: string;
  at: number;
  action: string;
  actor_name: string;
  entity_id?: string;
  law_firm_id?: string;
}

/** Every audit event of the session's workspace, newest first. */
export async function auditEvents(page: Page): Promise<StackAuditEvent[]> {
  const out: StackAuditEvent[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const r = await apiJson<{ events: StackAuditEvent[]; next_cursor?: string }>(
      page,
      'GET',
      `/api/audit${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    );
    expect(r.status).toBe(200);
    out.push(...r.body.events);
    if (!r.body.next_cursor) break;
    cursor = r.body.next_cursor;
  }
  return out;
}

/** Wait until the outbox has drained (the unsynced chip is gone and no memory write is in flight). */
export async function expectSynced(page: Page): Promise<void> {
  await expect(page.getByTestId('unsynced-chip')).toHaveCount(0, { timeout: 15_000 });
}

/** Findings screen: dismiss with a reason and return the decision the Worker stored. */
export async function dismissSynced(
  page: Page,
  findingId: string,
  reason = 'no_form_impact',
): Promise<StackDecision> {
  await page.locator(`[data-testid="finding-row"][data-finding-id="${findingId}"]`).click();
  await page.getByTestId('action-dismiss').click();
  await page.locator(`[data-testid="dismiss-reason"][value="${reason}"]`).check();
  const res = page.waitForResponse(
    (r) => r.url().endsWith('/api/decisions') && r.request().method() === 'POST',
  );
  await page.getByTestId('dismiss-save').click();
  const r = await res;
  expect(r.status()).toBe(200);
  await expectSynced(page);
  return ((await r.json()) as { decision: StackDecision }).decision;
}

/** A second, clean browser profile that carries the same session cookie (fresh IndexedDB). */
export async function cloneSession(
  browser: Browser,
  baseURL: string,
  from: Page,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({
    baseURL,
    storageState: { cookies: (await from.context().storageState()).cookies, origins: [] },
    extraHTTPHeaders: { 'cf-connecting-ip': uniqueIp() },
  });
  return { ctx, page: await ctx.newPage() };
}
