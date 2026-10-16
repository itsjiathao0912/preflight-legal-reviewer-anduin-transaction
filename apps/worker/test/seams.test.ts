import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createApp, type App, type AppDeps } from '../src/app';
import { mountMemoryRoutes } from '../src/routes/memory/index';
import { mountProxyRoutes } from '../src/routes/proxy/index';
import { createD1Platform, NotImplementedError } from '../src/platform/index';

const deps: AppDeps = { fetch: () => Promise.reject(new Error('no network')), now: () => 0 };

function recordingApp(): { app: App; calls: string[] } {
  const calls: string[] = [];
  const app: App = {
    route: (method, path) => void calls.push(`${method} ${path}`),
    fetch: () => Promise.resolve(new Response(null, { status: 500 })),
  };
  return { app, calls };
}

describe('Phase 00 seam stubs', () => {
  it('mountProxyRoutes registers exactly the Phase 04a proxy routes (no /api/cache)', () => {
    const { app, calls } = recordingApp();
    expect(mountProxyRoutes(app, deps)).toBeUndefined();
    expect(calls).toEqual(['POST /api/ai', 'POST /api/ocr', 'GET /api/quota']);
  });

  it('mountMemoryRoutes exists and registers nothing (no-op)', () => {
    const { app, calls } = recordingApp();
    expect(mountMemoryRoutes(app, deps)).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('createD1Platform throws NotImplemented until Phase 04b', () => {
    expect(() => createD1Platform(env.DB)).toThrow(NotImplementedError);
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
