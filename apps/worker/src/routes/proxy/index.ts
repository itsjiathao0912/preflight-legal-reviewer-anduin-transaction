import type { App, AppDeps } from '../../app';
import { createPreLimiter } from '../../limits/prelimit';
import { createLogger } from '../../proxy/log';
import {
  defaultTurnstile,
  memoryBreaker,
  realTimers,
  UPSTREAM_IDLE_MS,
  UPSTREAM_OCR_TIMEOUT_MS,
  UPSTREAM_TIMEOUT_MS,
  type ProxyContext,
} from '../../proxy/pipeline';
import { unavailablePlatform } from '../../proxy/ports';
import { aiHandler } from './ai';
import { ocrHandler } from './ocr';
import { quotaHandler } from './quota';

/** Phase 04a: fills the Phase 00 pre-wired stub. No /api/cache route (cache is internal). */
export function mountProxyRoutes(app: App, deps: AppDeps): void {
  const p = deps.proxy ?? {};
  const sink = p.log ?? ((line: string) => console.log(line));
  const turnstile = p.turnstile;
  const ctx: ProxyContext = {
    fetch: deps.fetch,
    now: deps.now,
    platform: p.platform ?? unavailablePlatform(),
    turnstile: turnstile ? () => turnstile : defaultTurnstile(deps.fetch),
    timers: p.timers ?? realTimers,
    heartbeatMs: p.heartbeatMs,
    upstreamTimeoutMs: p.upstreamTimeoutMs ?? UPSTREAM_TIMEOUT_MS,
    upstreamIdleMs: p.upstreamIdleMs ?? UPSTREAM_IDLE_MS,
    upstreamOcrTimeoutMs: p.upstreamOcrTimeoutMs ?? UPSTREAM_OCR_TIMEOUT_MS,
    preLimiter: createPreLimiter(),
    logger: (cfg) => createLogger(sink, [cfg?.apiKey, cfg?.turnstileSecret, cfg?.openaiApiKey]),
    breaker: p.breaker ?? memoryBreaker(),
  };
  app.route('POST', '/api/ai', aiHandler(ctx));
  app.route('POST', '/api/ocr', ocrHandler(ctx));
  app.route('GET', '/api/quota', quotaHandler(ctx));
}
