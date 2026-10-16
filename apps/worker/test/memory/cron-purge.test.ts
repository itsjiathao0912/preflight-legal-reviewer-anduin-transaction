// D5b: scheduled() runs the same purge daily; failures are non-fatal; triggers.crons is configured.
import { createScheduledController, env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import worker from '../../src/index';
import { DAY_MS, makeMem, session } from './memory-harness';

const at = (scheduledTime: number) =>
  createScheduledController({ scheduledTime, cron: '17 3 * * *' });

describe('cron-purge (AC38, AC58)', () => {
  test('scheduled() purges expired sandboxes and keeps the demo', async () => {
    const h = makeMem();
    const s = await session(h);
    const ws = () =>
      env.DB.prepare('SELECT id FROM workspace WHERE id = ?1').bind(s.workspaceId).first();
    await worker.scheduled(at(h.clock.now + 29 * DAY_MS), env as never);
    expect(await ws()).not.toBeNull();
    await worker.scheduled(at(h.clock.now + 31 * DAY_MS), env as never);
    expect(await ws()).toBeNull();
    expect(
      await env.DB.prepare("SELECT id FROM workspace WHERE id = 'ws_demo'").first(),
    ).not.toBeNull();
  });

  test('scheduled() is non-fatal without D1 or on a D1 error', async () => {
    await expect(worker.scheduled(at(Date.now()), {} as never)).resolves.toBeUndefined();
    const broken = {
      prepare() {
        throw new Error('d1 down');
      },
      batch: () => Promise.reject(new Error('d1 down')),
    };
    await expect(
      worker.scheduled(at(Date.now()), { DB: broken } as never),
    ).resolves.toBeUndefined();
  });

  test('wrangler.jsonc declares a daily cron trigger', async () => {
    const cfg = await import('../../wrangler.jsonc?raw');
    expect(String(cfg.default)).toMatch(/"triggers": \{ "crons": \["17 3 \* \* \*"\] \}/);
  });
});
