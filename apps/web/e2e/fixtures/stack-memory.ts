import { randomBytes } from 'node:crypto';
import { test as base, type Browser, type BrowserContext } from '@playwright/test';

/**
 * Shared helpers for the Phase 08 `stack-memory` project (real Worker + seeded local D1 on :8788).
 * The Worker caps new sessions at 5 per IP per day and reads the IP only from `cf-connecting-ip`,
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
