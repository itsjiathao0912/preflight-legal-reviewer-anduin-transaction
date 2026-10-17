// Test harness: createApp(deps) with injected fetch (OpenRouterStub + TurnstileStub), the
// in-memory FakePlatform, a manual fake clock/timers, a captured log sink and an
// ExecutionContext whose waitUntil THROWS (proves the proxy never calls it).
import { parseFrameStream } from '@aduin/core';
import { createApp, type App } from '../../src/app';
import { capFor } from '../../src/limits/policy';
import { loadConfig } from '../../src/config';
import type { Timers } from '../../src/proxy/stream';
import type { BreakerPort } from '../../src/proxy/ports';
import { FakePlatform } from './platform';
import { OpenRouterStub } from './openrouter-stub';
import { DUMMY_TOKEN, TS_PASS, TurnstileStub } from './turnstile-stub';

export const API_KEY = 'sk-or-v1-TESTONLY-0123456789abcdef0123456789abcdef';
export const COOKIE_KEY = 'test-cookie-signing-key-0123456789abcdef';
export const ORIGIN = 'https://app.test';
export const T0 = Date.UTC(2026, 9, 17, 12, 0, 0);

export function baseEnv(over: Record<string, string | undefined> = {}): Record<string, string> {
  const env: Record<string, string | undefined> = {
    OPENROUTER_API_KEY: API_KEY,
    COOKIE_SIGNING_KEYS: JSON.stringify({
      k1: COOKIE_KEY,
      k0: 'old-cookie-signing-key-0123456789abcdef',
    }),
    COOKIE_SIGNING_KID: 'k1',
    TURNSTILE_SECRET: TS_PASS,
    ...over,
  };
  return Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined)) as Record<
    string,
    string
  >;
}

export class FakeTimers implements Timers {
  now = 0;
  private seq = 0;
  private readonly tasks = new Map<number, { at: number; every?: number; fn: () => void }>();
  setInterval(fn: () => void, ms: number): unknown {
    const id = ++this.seq;
    this.tasks.set(id, { at: this.now + ms, every: ms, fn });
    return id;
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.seq;
    this.tasks.set(id, { at: this.now + ms, fn });
    return id;
  }
  clearInterval(h: unknown): void {
    this.tasks.delete(h as number);
  }
  clearTimeout(h: unknown): void {
    this.tasks.delete(h as number);
  }
  get pending(): number {
    return this.tasks.size;
  }
  /** Advance virtual time, firing due tasks in order. */
  advance(ms: number): void {
    const end = this.now + ms;
    for (;;) {
      let next: [number, { at: number; every?: number; fn: () => void }] | undefined;
      for (const e of this.tasks) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      const [id, t] = next;
      this.now = t.at;
      if (t.every) t.at += t.every;
      else this.tasks.delete(id);
      t.fn();
    }
    this.now = end;
  }
}

function safeConfig(env: Record<string, string>) {
  try {
    return loadConfig(env);
  } catch {
    return loadConfig({});
  }
}

export interface Harness {
  app: App;
  env: Record<string, string>;
  or: OpenRouterStub;
  ts: TurnstileStub;
  platform: FakePlatform;
  logs: string[];
  timers: FakeTimers | undefined;
  clock: { now: number };
  ctx: ExecutionContext;
  waitUntilCalls: number;
}

export function makeHarness(
  opts: {
    env?: Record<string, string>;
    fakeTimers?: boolean;
    heartbeatMs?: number;
    upstreamTimeoutMs?: number;
    down?: boolean;
    breaker?: BreakerPort;
  } = {},
): Harness {
  const env = opts.env ?? baseEnv();
  const or = new OpenRouterStub();
  const ts = new TurnstileStub();
  or.other = ts.handle;
  const platform = new FakePlatform({ capFor: capFor(safeConfig(env)), down: opts.down ?? false });
  const logs: string[] = [];
  const clock = { now: T0 };
  const timers = opts.fakeTimers ? new FakeTimers() : undefined;
  const h: Harness = {
    app: undefined as unknown as App,
    env,
    or,
    ts,
    platform,
    logs,
    timers,
    clock,
    waitUntilCalls: 0,
    ctx: undefined as unknown as ExecutionContext,
  };
  h.ctx = {
    waitUntil() {
      h.waitUntilCalls++;
      throw new Error('waitUntil must never be called by the proxy');
    },
    passThroughOnException() {},
  } as unknown as ExecutionContext;
  h.app = createApp({
    fetch: or.fetch,
    now: () => clock.now,
    proxy: {
      platform,
      log: (l) => logs.push(l),
      ...(timers ? { timers } : {}),
      ...(opts.breaker ? { breaker: opts.breaker } : {}),
      ...(opts.heartbeatMs !== undefined ? { heartbeatMs: opts.heartbeatMs } : {}),
      ...(opts.upstreamTimeoutMs !== undefined
        ? { upstreamTimeoutMs: opts.upstreamTimeoutMs }
        : {}),
    },
  });
  return h;
}

export function aiBody(
  quote = 'Subject to this Section 11, the Investor agrees.',
  extra: Record<string, unknown> = {},
) {
  return {
    v: 1,
    law_firm_id: null,
    candidates: [{ id: 'c1', quote, section_path: ['1'] }],
    settings: {},
    ...extra,
  };
}

/** 1x1 transparent PNG */
export const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export function ocrBody(extra: Record<string, unknown> = {}) {
  return { v: 1, mime: 'image/png', pages: [{ index: 0, data_b64: PNG_B64 }], ...extra };
}

export interface ReqOpts {
  path?: '/api/ai' | '/api/ocr' | '/api/quota';
  method?: string;
  body?: unknown;
  rawBody?: string | Uint8Array;
  ip?: string;
  cookie?: string;
  turnstile?: string | null;
  headers?: Record<string, string | null>;
}

export function req(o: ReqOpts = {}): Request {
  const path = o.path ?? '/api/ai';
  const method = o.method ?? (path === '/api/quota' ? 'GET' : 'POST');
  const headers = new Headers();
  headers.set('x-aduin-client', '1');
  headers.set('cf-connecting-ip', o.ip ?? '203.0.113.7');
  if (method !== 'GET') {
    headers.set('origin', ORIGIN);
    headers.set('content-type', 'application/json');
  }
  const tok = o.turnstile === undefined ? DUMMY_TOKEN : o.turnstile;
  if (tok !== null && method !== 'GET') headers.set('x-aduin-turnstile', tok);
  if (o.cookie) headers.set('cookie', o.cookie);
  for (const [k, v] of Object.entries(o.headers ?? {})) {
    if (v === null) headers.delete(k);
    else headers.set(k, v);
  }
  const body =
    method === 'GET'
      ? undefined
      : (o.rawBody ?? JSON.stringify(o.body ?? (path === '/api/ocr' ? ocrBody() : aiBody())));
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body } : {}),
  });
}

/** Each send advances the clock 11 s so the 6/min AI pre-limit stays out of quota tests. */
export function send(
  h: Pick<Harness, 'app' | 'env' | 'clock' | 'ctx'>,
  o: ReqOpts = {},
): Promise<Response> {
  h.clock.now += 11_000;
  return h.app.fetch(req(o), h.env as never, h.ctx);
}

export async function bodyText(res: Response): Promise<string> {
  return new TextDecoder().decode(await res.arrayBuffer());
}

export async function frames(res: Response) {
  return parseFrameStream(await bodyText(res));
}

/** `name=value` of the Set-Cookie for reuse as a Cookie header. */
export function cookieOf(res: Response): string | undefined {
  const sc = res.headers.get('set-cookie');
  return sc ? sc.split(';')[0] : undefined;
}

/** Send and return [response, cookie to reuse (new one if issued, else the given)]. */
export async function sendKeep(
  h: Pick<Harness, 'app' | 'env' | 'clock' | 'ctx'>,
  o: ReqOpts = {},
): Promise<[Response, string | undefined]> {
  const res = await send(h, o);
  return [res, cookieOf(res) ?? o.cookie];
}
