import { createApp, type App, type Env } from './app';
import { capFor } from './limits/policy';
import { createLogger } from './proxy/log';
import { configFor } from './proxy/pipeline';
import { unavailablePlatform, type BreakerPort, type ProxyPlatform } from './proxy/ports';
import { createD1Breaker, createD1Platform, withSessionCaps } from './platform/index';
import { runPurge } from './memory/repo/purge';

// Phase 04b (E9): the app is built lazily on the first request (env is only available then) and
// cached per D1 binding; never at import. A config error or a missing env.DB falls back to
// `unavailablePlatform()` (AI/OCR fail closed); memory routes then answer memory_unavailable.
let cached: { app: App; db: D1Database | undefined } | null = null;

export function buildApp(env: Env): App {
  let platform: ProxyPlatform = unavailablePlatform();
  let breaker: BreakerPort | undefined;
  try {
    if (env.DB) {
      const cfg = configFor(env);
      platform = createD1Platform(env.DB, { capFor: withSessionCaps(capFor(cfg)) });
      breaker = createD1Breaker(env.DB);
    }
  } catch {
    platform = unavailablePlatform();
    breaker = undefined;
  }
  return createApp({
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    proxy: { platform, ...(breaker ? { breaker } : {}) },
  });
}

function appFor(env: Env): App {
  if (!cached || cached.db !== env.DB) cached = { app: buildApp(env), db: env.DB };
  return cached.app;
}

export default {
  fetch(request, env, ctx) {
    return appFor(env).fetch(request, env, ctx);
  },
  /** Daily retention purge (D5b): same purge as the lazy path; failures are non-fatal. */
  async scheduled(controller, env) {
    const log = createLogger((l) => console.log(l), []);
    if (!env.DB) {
      log.log('memory.cron_purge_skipped', { reason: 'no_db' });
      return;
    }
    try {
      const r = await runPurge(env.DB, controller.scheduledTime);
      log.log('memory.cron_purge', {
        workspaces: r.workspaces,
        cache: r.cacheRows,
        quota: r.quotaRows,
      });
    } catch {
      log.log('memory.cron_purge_failed', {});
    }
  },
} satisfies ExportedHandler<Env>;
