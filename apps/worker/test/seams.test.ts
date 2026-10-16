import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createApp, type App, type AppDeps } from '../src/app';
import { MEMORY_ROUTES, mountMemoryRoutes } from '../src/routes/memory/index';
import { mountProxyRoutes } from '../src/routes/proxy/index';
import { createD1Platform } from '../src/platform/index';

const deps: AppDeps = { fetch: () => Promise.reject(new Error('no network')), now: () => 0 };

function recordingApp(): { app: App; calls: string[] } {
  const calls: string[] = [];
  const app: App = {
    route: (method, path) => void calls.push(`${method} ${path}`),
    fetch: () => Promise.resolve(new Response(null, { status: 500 })),
  };
  return { app, calls };
}

describe('Phase 00 seam stubs (updated by Phase 04b)', () => {
  it('mountProxyRoutes registers exactly the Phase 04a proxy routes (no /api/cache)', () => {
    const { app, calls } = recordingApp();
    expect(mountProxyRoutes(app, deps)).toBeUndefined();
    expect(calls).toEqual(['POST /api/ai', 'POST /api/ocr', 'GET /api/quota']);
  });

  it('mountMemoryRoutes registers exactly the Phase 04b memory routes', () => {
    const { app, calls } = recordingApp();
    expect(mountMemoryRoutes(app, deps)).toBeUndefined();
    expect(calls).toEqual([...MEMORY_ROUTES]);
  });

  it('createD1Platform (Phase 04b) returns the quota/cache/ledger ports', () => {
    const p = createD1Platform(env.DB, { capFor: () => 1 });
    expect(typeof p.quota).toBe('function');
    expect(typeof p.cache.get).toBe('function');
    expect(typeof p.ledger.record).toBe('function');
  });

  it('pattern routes: exact routes win, :params are decoded, unknown /api/* stays a JSON 404', async () => {
    const app = createApp(deps);
    const seen: string[] = [];
    app.route('GET', '/api/x/:id/y', (_r, _e, _c, p) => {
      seen.push(p?.['id'] ?? '');
      return new Response('p');
    });
    app.route('GET', '/api/x/fixed/y', () => new Response('exact'));
    const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
    const get = (p: string) => app.fetch(new Request(`https://x${p}`), {}, ctx);
    expect(await (await get('/api/x/fixed/y')).text()).toBe('exact');
    expect(await (await get('/api/x/a%3Ab/y')).text()).toBe('p');
    expect(seen).toEqual(['a:b']);
    expect((await get('/api/x//y')).status).toBe(404);
    expect((await get('/api/x/a/b/y')).status).toBe(404);
    expect(await (await get('/api/health')).json()).toEqual({ ok: true });
  });

  it('createApp pre-wires both mounts and only /api/health is live', async () => {
    const app = createApp(deps);
    const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
    const ok = await app.fetch(new Request('https://x/api/health'), {}, ctx);
    expect(ok.status).toBe(200);
    const miss = await app.fetch(new Request('https://x/api/ai/chat', { method: 'POST' }), {}, ctx);
    expect(miss.status).toBe(404);
  });

  it('rejects duplicate route registration', () => {
    const app = createApp(deps);
    expect(() => app.route('GET', '/api/health', () => new Response())).toThrow(/Duplicate route/);
  });
});
