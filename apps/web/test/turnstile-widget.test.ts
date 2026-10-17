import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryApiError } from '../src/api/memoryApi';
import { RealMemoryApi } from '../src/api/realMemoryApi';
import {
  createTurnstileProvider,
  registerTurnstileWidget,
  type TurnstileApi,
} from '../src/features/ai/turnstile-widget';
import { createFakeMemoryFetch } from './support/fakeMemoryFetch';

type Opts = Record<string, (arg?: unknown) => unknown>;

/** Stub Turnstile API: `execute` answers through the render callbacks with the scripted outcome. */
function stubApi(outcomes: ('token' | 'error' | 'silent')[]) {
  let opts: Opts = {};
  let n = 0;
  const api = {
    render: vi.fn((_el: HTMLElement, o: Record<string, unknown>) => {
      opts = o as Opts;
      return 'w1';
    }),
    execute: vi.fn(() => {
      const o = outcomes[n++] ?? 'token';
      queueMicrotask(() => {
        if (o === 'token') opts['callback']!(`tok-${n}`);
        else if (o === 'error') opts['error-callback']!();
      });
    }),
    reset: vi.fn(),
  } satisfies TurnstileApi;
  return { api, opts: () => opts };
}

const host = () => document.createElement('div');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('turnstile-widget', () => {
  it('should register a Turnstile provider only when the site key is set', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const a = await import('../src/features/ai/turnstile');
    const w = await import('../src/features/ai/turnstile-widget');
    expect(w.registerTurnstileWidget()).toBe(false);
    expect(a.hasTurnstileProvider()).toBe(false);
    expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
    expect(await a.turnstileToken()).toBeNull();

    vi.resetModules();
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '0x4AAAAAAAtestKey');
    const a2 = await import('../src/features/ai/turnstile');
    const w2 = await import('../src/features/ai/turnstile-widget');
    const { api } = stubApi(['token']);
    expect(w2.registerTurnstileWidget({ loadApi: async () => api, container: host })).toBe(true);
    expect(a2.hasTurnstileProvider()).toBe(true);
    // lazy: nothing rendered until the first token request
    expect(api.render).not.toHaveBeenCalled();
    expect(await a2.turnstileToken()).toBe('tok-1');
  });

  it('rejects a malformed site key (no provider)', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'bad key <script>');
    const w = await import('../src/features/ai/turnstile-widget');
    expect(w.turnstileSiteKey()).toBeNull();
    expect(registerTurnstileWidget()).toBe(false);
  });

  it('renders once in managed execute mode and resets after every use', async () => {
    const { api, opts } = stubApi(['token', 'token']);
    const p = createTurnstileProvider('site-key', { loadApi: async () => api, container: host });
    expect(await p()).toBe('tok-1');
    expect(await p()).toBe('tok-2');
    expect(api.render).toHaveBeenCalledTimes(1);
    expect(opts()['sitekey']).toBe('site-key');
    expect(opts()['execution']).toBe('execute');
    expect(api.execute).toHaveBeenCalledTimes(2);
    expect(api.reset).toHaveBeenCalledTimes(2);
  });

  it('yields null (never throws) on widget error, timeout or load failure', async () => {
    const { api } = stubApi(['error', 'silent']);
    const p = createTurnstileProvider('k', {
      loadApi: async () => api,
      container: host,
      timeoutMs: 20,
    });
    expect(await p()).toBeNull();
    expect(await p()).toBeNull();
    expect(api.reset).toHaveBeenCalledTimes(2);
    const broken = createTurnstileProvider('k', {
      loadApi: () => Promise.reject(new Error('offline')),
      container: host,
    });
    expect(await broken()).toBeNull();
  });

  it('serializes concurrent requests on the single widget', async () => {
    const { api } = stubApi(['token', 'token']);
    const p = createTurnstileProvider('k', { loadApi: async () => api, container: host });
    const [a, b] = await Promise.all([p(), p()]);
    expect(new Set([a, b])).toEqual(new Set(['tok-1', 'tok-2']));
  });
});

describe('RealMemoryApi session token (E24)', () => {
  let n = 0;
  let api: RealMemoryApi;
  beforeEach(() => {
    n++;
  });

  function make(token: () => string | null | Promise<string | null>, required: boolean) {
    const fake = createFakeMemoryFetch({ now: () => Date.UTC(2026, 9, 17) });
    api = new RealMemoryApi({
      fetch: fake.fetch,
      url: (p) => p,
      db: null,
      now: () => Date.UTC(2026, 9, 17),
      turnstileToken: token,
      turnstileRequired: () => required,
    });
    return fake;
  }

  it('awaits an async token and sends it on POST /api/session', async () => {
    const fake = make(async () => `async-${n}`, true);
    await api.bootstrap('Linh Tran');
    const s = fake.calls.find((c) => c.path === '/api/session')!;
    expect(s.headers['x-aduin-turnstile']).toBe(`async-${n}`);
  });

  it('keeps the sync token form working', async () => {
    const fake = make(() => 'sync-token', false);
    await api.bootstrap('Linh Tran');
    expect(fake.calls[0]!.headers['x-aduin-turnstile']).toBe('sync-token');
  });

  it('provider registered but no token: no POST /api/session, unauthorized turnstile_missing', async () => {
    const fake = make(async () => null, true);
    const err = await api.bootstrap('Linh Tran').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MemoryApiError);
    expect((err as MemoryApiError).code).toBe('unauthorized');
    expect((err as MemoryApiError).reason).toBe('turnstile_missing');
    expect(fake.calls).toHaveLength(0);
  });

  it('no provider registered: bootstrap posts without a token (unchanged)', async () => {
    const fake = make(() => null, false);
    await api.bootstrap('Linh Tran');
    expect(fake.calls.map((c) => c.path)).toEqual(['/api/session']);
    expect(fake.calls[0]!.headers['x-aduin-turnstile']).toBeUndefined();
  });
});

describe('turnstile-widget interactive challenge (m1)', () => {
  /** Stub whose execute asks for interaction; the test drives the remaining callbacks. */
  function interactiveApi() {
    let opts: Opts = {};
    const api = {
      render: vi.fn((_el: HTMLElement, o: Record<string, unknown>) => {
        opts = o as Opts;
        return 'w1';
      }),
      execute: vi.fn(() => queueMicrotask(() => opts['before-interactive-callback']!())),
      reset: vi.fn(),
    } satisfies TurnstileApi;
    return { api, opts: () => opts };
  }
  const overlay = () => document.getElementById('aduin-turnstile')!;

  beforeEach(() => document.getElementById('aduin-turnstile')?.remove());
  afterEach(() => vi.useRealTimers());

  it('reveals a labelled, interactive overlay and hides it after the challenge', async () => {
    const { api, opts } = interactiveApi();
    const btn = document.body.appendChild(document.createElement('button'));
    btn.focus();
    const p = createTurnstileProvider('site-key', { loadApi: async () => api });
    const tok = p();
    await vi.waitFor(() => expect(overlay().getAttribute('role')).toBe('dialog'));
    const el = overlay();
    expect(el.hasAttribute('aria-hidden')).toBe(false);
    expect(el.style.pointerEvents).toBe('auto');
    expect(el.style.opacity).toBe('1');
    expect(document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent).toBe(
      'Verify you are human to use AI and memory features',
    );
    expect(document.activeElement).toBe(el);
    opts()['after-interactive-callback']!();
    opts()['callback']!('tok-human');
    expect(await tok).toBe('tok-human');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.style.pointerEvents).toBe('none');
    expect(document.activeElement).toBe(btn);
    btn.remove();
  });

  it('extends the time budget once interaction is requested', async () => {
    vi.useFakeTimers();
    const { api, opts } = interactiveApi();
    const p = createTurnstileProvider('site-key', {
      loadApi: async () => api,
      timeoutMs: 1_000,
      interactiveTimeoutMs: 10_000,
    });
    const tok = p();
    await vi.advanceTimersByTimeAsync(0);
    expect(overlay().getAttribute('role')).toBe('dialog');
    await vi.advanceTimersByTimeAsync(5_000); // past the base timeout, still waiting
    opts()['callback']!('late-tok');
    expect(await tok).toBe('late-tok');
    expect(overlay().getAttribute('aria-hidden')).toBe('true');
  });

  it('times out the interactive challenge, hides the overlay and resolves null', async () => {
    vi.useFakeTimers();
    const { api } = interactiveApi();
    const p = createTurnstileProvider('site-key', {
      loadApi: async () => api,
      timeoutMs: 1_000,
      interactiveTimeoutMs: 3_000,
    });
    const tok = p();
    await vi.advanceTimersByTimeAsync(3_001);
    expect(await tok).toBeNull();
    expect(overlay().getAttribute('aria-hidden')).toBe('true');
    expect(api.reset).toHaveBeenCalledTimes(1);
  });

  it('resolves null when the browser is unsupported', async () => {
    let opts: Opts = {};
    const api = {
      render: vi.fn((_el: HTMLElement, o: Record<string, unknown>) => {
        opts = o as Opts;
        return 'w1';
      }),
      execute: vi.fn(() => queueMicrotask(() => opts['unsupported-callback']!())),
      reset: vi.fn(),
    } satisfies TurnstileApi;
    const p = createTurnstileProvider('site-key', { loadApi: async () => api, container: host });
    expect(await p()).toBeNull();
  });
});
