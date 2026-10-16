// createApp(deps): tiny hand-rolled route table (no web framework; see INNOVATE).
// Seam rule: the two route-mount calls below are pre-wired by Phase 00 and are never
// edited. Phases 04a/04b fill routes/proxy/index.ts and routes/memory/index.ts; any
// deps-wiring change here is a single-line edit serialized by the orchestrator.
import { mountMemoryRoutes } from './routes/memory/index';
import { mountProxyRoutes } from './routes/proxy/index';

export interface Env {
  ASSETS?: Fetcher;
  DB?: D1Database;
  PAID_FALLBACK_ENABLED?: string;
}

export interface AppDeps {
  /** Outbound fetch, injectable for tests (cloudflare:test has no fetchMock). */
  fetch: typeof fetch;
  now: () => number;
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type Handler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Promise<Response> | Response;

export interface App {
  route(method: Method, path: string, handler: Handler): void;
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function createApp(deps: AppDeps): App {
  const routes = new Map<string, Handler>();

  const app: App = {
    route(method, path, handler) {
      const key = `${method} ${path}`;
      if (routes.has(key)) throw new Error(`Duplicate route: ${key}`);
      routes.set(key, handler);
    },
    async fetch(request, env, ctx) {
      const { pathname } = new URL(request.url);
      const handler = routes.get(`${request.method} ${pathname}`);
      if (handler) {
        try {
          return await handler(request, env, ctx);
        } catch {
          // Never echo error details (may contain upstream bodies or headers).
          return json({ ok: false, error: 'internal_error' }, 500);
        }
      }
      if (pathname.startsWith('/api/')) return json({ ok: false, error: 'not_found' }, 404);
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return json({ ok: false, error: 'not_found' }, 404);
    },
  };

  app.route('GET', '/api/health', () => json({ ok: true }));
  mountProxyRoutes(app, deps);
  mountMemoryRoutes(app, deps);
  return app;
}
