import { CreateSessionResponseSchema } from '@aduin/core';
import { CLIENT_HEADERS, expect, newStackContext, test } from './fixtures/stack-memory';

// Phase 08 S1.e2e-infra smoke: the seeded local stack is up and a sandbox session mints.
test('memory health is ok on the seeded local D1', async ({ page }) => {
  const res = await page.request.get('/api/memory/health', { headers: CLIENT_HEADERS });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { ok: boolean; schema_version: string; seed_mode: string };
  expect(body).toMatchObject({ ok: true, schema_version: '6', seed_mode: '0' });
});

test('POST /api/session mints a writable sandbox session', async ({ page, baseURL }) => {
  const res = await page.request.post('/api/session', {
    headers: { ...CLIENT_HEADERS, origin: baseURL!, 'content-type': 'application/json' },
    data: { analyst_name: 'Linh Tran' },
  });
  expect(res.status()).toBe(200);
  const session = CreateSessionResponseSchema.parse(await res.json());
  expect(session.kind).toBe('sandbox');
  expect(session.read_only).toBe(false);
  expect(res.headers()['set-cookie'] ?? '').toContain('__Host-aduin_v=');
});

test('per-context unique IPs allow more than 5 sessions in one run', async ({
  browser,
  baseURL,
}) => {
  for (let i = 0; i < 6; i++) {
    const ctx = await newStackContext(browser, baseURL!);
    const res = await ctx.request.post('/api/session', {
      headers: { ...CLIENT_HEADERS, origin: baseURL!, 'content-type': 'application/json' },
      data: { analyst_name: `Probe ${i}` },
    });
    expect(res.status(), `session ${i}`).toBe(200);
    expect(CreateSessionResponseSchema.parse(await res.json()).read_only).toBe(false);
    await ctx.close();
  }
});
