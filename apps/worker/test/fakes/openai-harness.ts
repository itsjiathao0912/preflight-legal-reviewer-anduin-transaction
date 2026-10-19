// Harness for the OpenAI provider (AI_PROVIDER=openai): same shape as `makeHarness`, but the
// injected fetch is the OpenAiStub (refuses every host except api.openai.com and Turnstile) and
// the FakePlatform carries the in-memory lifetime spend counter.
import { createApp, type App } from '../../src/app';
import { capFor } from '../../src/limits/policy';
import { loadConfig } from '../../src/config';
import type { BreakerPort, ProxyPlatform } from '../../src/proxy/ports';
import { baseEnv, T0 } from './harness';
import { OpenAiStub } from './openai-stub';
import { FakePlatform } from './platform';
import { TurnstileStub } from './turnstile-stub';

/** Key-shaped test value built at runtime (never a literal key in the tree). */
export const OPENAI_TEST_KEY = ['sk', 'proj', 'TESTONLY0123456789abcdefABCDEF0123456789'].join('-');

export function openAiEnv(over: Record<string, string | undefined> = {}): Record<string, string> {
  return baseEnv({ AI_PROVIDER: 'openai', OPENAI_API_KEY: OPENAI_TEST_KEY, ...over });
}

export interface OpenAiHarness {
  app: App;
  env: Record<string, string>;
  oa: OpenAiStub;
  ts: TurnstileStub;
  platform: FakePlatform;
  logs: string[];
  clock: { now: number };
  ctx: ExecutionContext;
}

export function makeOpenAiHarness(
  opts: {
    env?: Record<string, string>;
    platform?: FakePlatform;
    /** override the platform handed to the app (e.g. one without `spend`) */
    appPlatform?: ProxyPlatform;
    breaker?: BreakerPort;
  } = {},
): OpenAiHarness {
  const env = opts.env ?? openAiEnv();
  const oa = new OpenAiStub();
  const ts = new TurnstileStub();
  oa.other = ts.handle;
  const platform = opts.platform ?? new FakePlatform({ capFor: capFor(loadConfig(env)) });
  const logs: string[] = [];
  const clock = { now: T0 };
  const app = createApp({
    fetch: oa.fetch,
    now: () => clock.now,
    proxy: {
      platform: opts.appPlatform ?? platform,
      log: (l) => logs.push(l),
      ...(opts.breaker ? { breaker: opts.breaker } : {}),
    },
  });
  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
  return { app, env, oa, ts, platform, logs, clock, ctx };
}

/** Parsed log lines with a given event name. */
export function events(logs: string[], event: string): Record<string, unknown>[] {
  return logs
    .map((l) => JSON.parse(l) as Record<string, unknown>)
    .filter((l) => l['event'] === event);
}
