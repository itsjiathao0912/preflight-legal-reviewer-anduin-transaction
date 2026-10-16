// NDJSON hold-open stream: `{t:'hb'}` at open and every heartbeat interval, then exactly ONE
// terminal frame (result|error). Every line is built from the frozen frame schemas and checked
// with `parseFrameLine` before it is enqueued. Client disconnect aborts the work (the pipeline
// decides the refund: pre-dispatch only). Never uses ctx.waitUntil: the open stream itself
// keeps the request alive.
import { frameLine, limits, parseFrameLine, type Frame } from '@aduin/core';
import { messageFor, NO_STORE } from './errors';

export interface Timers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(h: unknown): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
}

export const realTimers: Timers = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export const HEARTBEAT_MS = limits.heartbeatSeconds * 1000;

/** Serialize + re-parse a frame; an invalid terminal frame degrades to `upstream_failed`. */
export function safeLine(f: Frame): string {
  try {
    const line = frameLine(f);
    parseFrameLine(line.trimEnd());
    return line;
  } catch {
    return frameLine({
      t: 'error',
      code: 'upstream_failed',
      message: messageFor('upstream_failed'),
      reason: 'invalid_frame',
    });
  }
}

export interface StreamOptions {
  timers: Timers;
  heartbeatMs?: number;
  /** Produces the terminal frame. Receives an AbortSignal fired on client disconnect. */
  run: (signal: AbortSignal) => Promise<Frame>;
  /** Called once when the client disconnects before the terminal frame. */
  onCancel: () => void;
  headers?: Record<string, string>;
}

export function ndjsonResponse(opts: StreamOptions): Response {
  const enc = new TextEncoder();
  const abort = new AbortController();
  let closed = false;
  let interval: unknown;
  const stop = () => {
    if (interval !== undefined) opts.timers.clearInterval(interval);
    interval = undefined;
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (f: Frame) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(safeLine(f)));
        } catch {
          closed = true;
        }
      };
      push({ t: 'hb' });
      interval = opts.timers.setInterval(() => push({ t: 'hb' }), opts.heartbeatMs ?? HEARTBEAT_MS);
      opts
        .run(abort.signal)
        .catch((): Frame => ({
          t: 'error',
          code: 'upstream_failed',
          message: messageFor('upstream_failed'),
        }))
        .then((terminal) => {
          stop();
          push(terminal);
          if (!closed) {
            closed = true;
            controller.close();
          }
        });
    },
    cancel() {
      if (closed) return;
      closed = true;
      stop();
      abort.abort();
      opts.onCancel();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': NO_STORE,
      'x-content-type-options': 'nosniff',
      ...opts.headers,
    },
  });
}

/** A complete (non-held) NDJSON body with a single terminal frame, e.g. a cache hit. */
export function ndjsonSingle(f: Frame, headers: Record<string, string> = {}): Response {
  return new Response(safeLine(f), {
    status: 200,
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': NO_STORE,
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}
