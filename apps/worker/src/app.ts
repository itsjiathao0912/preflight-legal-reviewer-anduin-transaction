// createApp(deps): tiny hand-rolled route table (no web framework; see INNOVATE).
// Seam rule: the two route-mount calls below are pre-wired by Phase 00 and are never
// edited. Phases 04a/04b fill routes/proxy/index.ts and routes/memory/index.ts; any
// deps-wiring change here is a single-line edit serialized by the orchestrator.
import { mountMemoryRoutes } from './routes/memory/index';
import { mountProxyRoutes } from './routes/proxy/index';
import type { ProxyDeps } from './proxy/pipeline';

export interface Env {
  ASSETS?: Fetcher;
  DB?: D1Database;
  PAID_FALLBACK_ENABLED?: string;
}

export interface AppDeps {
  /** Outbound fetch, injectable for tests (cloudflare:test has no fetchMock). */
  fetch: typeof fetch;
  now: () => number;
  /** Phase 04a (optional, additive): proxy ports, Turnstile, timers, log sink. */
  proxy?: ProxyDeps;
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Path parameters of a `:param` route (Phase 04b; empty for exact routes). */
export type RouteParams = Readonly<Record<string, string>>;

export type Handler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  params?: RouteParams,
) => Promise<Response> | Response;

export interface App {
  /** Exact path, or a pattern with `:name` segments (Phase 04b, additive). Exact routes win. */
  route(method: Method, path: string, handler: Handler): void;
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

interface PatternRoute {
  method: string;
  segments: string[];
  handler: Handler;
}

/** Match `/a/:id/b` against a pathname; params are URI-decoded, never empty, never contain `/`. */
function matchPattern(segments: string[], pathname: string): RouteParams | null {
  const parts = pathname.split('/');
  if (parts.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const part = parts[i]!;
    if (seg.startsWith(':')) {
      if (part.length === 0) return null;
      let v: string;
      try {
        v = decodeURIComponent(part);
      } catch {
        return null;
      }
      if (v.includes('/')) return null;
      params[seg.slice(1)] = v;
    } else if (seg !== part) return null;
  }
  return params;
}

export function createApp(deps: AppDeps): App {
  const routes = new Map<string, Handler>();
  const patterns: PatternRoute[] = [];

  const app: App = {
    route(method, path, handler) {
      const key = `${method} ${path}`;
      if (routes.has(key)) throw new Error(`Duplicate route: ${key}`);
      routes.set(key, handler);
      if (path.includes('/:')) patterns.push({ method, segments: path.split('/'), handler });
    },
    async fetch(request, env, ctx) {
      const { pathname } = new URL(request.url);
      let handler = routes.get(`${request.method} ${pathname}`);
      let params: RouteParams = {};
      if (!handler) {
        for (const p of patterns) {
          if (p.method !== request.method) continue;
          const m = matchPattern(p.segments, pathname);
          if (m) {
            handler = p.handler;
            params = m;
            break;
          }
        }
      }
      if (handler) {
        try {
          return await handler(request, env, ctx, params);
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
