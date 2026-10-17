import { errorDetailOf, errorFromResponse, type ApiErrorDetail } from './http';

/**
 * Generic NDJSON hold-open client for the Worker proxy (`/api/ai`, Phase 06 `/api/ocr`).
 * Frames: any number of `{t:'hb'}` (ignored), then exactly ONE terminal `result` or `error` frame.
 * The first terminal frame wins and the read stops. A stream that ends without a terminal frame is
 * `upstream_failed / stream_dropped`. NO auto-retry: callers show a manual Retry. Aborts resolve to
 * `{kind:'aborted'}`. Tiny local frame parser on purpose: the main thread imports no core values (G12).
 */
export interface ResultTerminal {
  kind: 'result';
  /** Frame `kind` ('ai' | 'ocr'). */
  resultKind: string;
  data: unknown;
  cache: 'hit' | 'miss';
  model: string;
  meta?: Record<string, unknown>;
}
export interface ErrorTerminal {
  kind: 'error';
  error: ApiErrorDetail;
}
export type StreamTerminal = ResultTerminal | ErrorTerminal | { kind: 'aborted' };

export interface PostStreamOptions {
  headers: Record<string, string>;
  signal?: AbortSignal;
  fetchFn?: typeof fetch;
}

type Parsed = { t: 'hb' } | ResultTerminal | ErrorTerminal | null;

/** Max NDJSON line held in memory (4 MiB of text, review L3); longer -> `bad_frame`. */
export const MAX_LINE_CHARS = 4 * 1024 * 1024;

const malformed = (reason: string): ErrorTerminal => ({
  kind: 'error',
  error: { code: 'upstream_failed', reason, message: 'The AI answer could not be read.' },
});

const dropped = (): ErrorTerminal => ({
  kind: 'error',
  error: { code: 'upstream_failed', reason: 'stream_dropped', message: 'The connection dropped.' },
});

/** Parse one NDJSON line into a frame; null for a line that is not a known frame. */
export function parseFrame(line: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o['t'] === 'hb') return { t: 'hb' };
  if (o['t'] === 'error') {
    const d = errorDetailOf(o);
    return d ? { kind: 'error', error: d } : null;
  }
  if (o['t'] === 'result') {
    const cache = o['cache'];
    const model = o['model'];
    const data = o['data'];
    if (
      typeof o['kind'] !== 'string' ||
      (cache !== 'hit' && cache !== 'miss') ||
      typeof model !== 'string' ||
      model.length === 0 ||
      !data ||
      typeof data !== 'object'
    )
      return null;
    const r: ResultTerminal = {
      kind: 'result',
      resultKind: o['kind'],
      data,
      cache,
      model: model.slice(0, 120),
    };
    const meta = o['meta'];
    if (meta && typeof meta === 'object' && !Array.isArray(meta))
      r.meta = meta as Record<string, unknown>;
    return r;
  }
  return null;
}

function isAbort(e: unknown): boolean {
  return (e instanceof Error || e instanceof DOMException) && e.name === 'AbortError';
}

/** POST a JSON body and read the NDJSON frames until the single terminal frame. */
export async function postNdjson(
  url: string,
  body: unknown,
  opts: PostStreamOptions,
): Promise<StreamTerminal> {
  const f = opts.fetchFn ?? fetch;
  let res: Response;
  try {
    res = await f(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...opts.headers },
      body: JSON.stringify(body),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
  } catch (e) {
    if (isAbort(e) || opts.signal?.aborted) return { kind: 'aborted' };
    return {
      kind: 'error',
      error: { code: 'upstream_failed', reason: 'network', message: 'The server is unreachable.' },
    };
  }
  if (!res.ok) return { kind: 'error', error: await errorFromResponse(res) };
  if (!/ndjson/i.test(res.headers.get('content-type') ?? '') || !res.body) {
    return malformed('not_a_stream');
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const handle = (line: string): StreamTerminal | null => {
    if (line.length > MAX_LINE_CHARS) return malformed('bad_frame');
    if (line.trim().length === 0) return null;
    const fr = parseFrame(line);
    if (fr === null) return malformed('bad_frame');
    if ('t' in fr) return null;
    return fr;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) buf += dec.decode(value, { stream: true });
      // review L3: a server that never sends a newline cannot grow the buffer without bound
      if (buf.length > MAX_LINE_CHARS && buf.indexOf('\n') < 0) {
        void reader.cancel().catch(() => undefined);
        return malformed('bad_frame');
      }
      let nl = buf.indexOf('\n');
      while (nl >= 0) {
        const t = handle(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
        if (t) {
          void reader.cancel().catch(() => undefined);
          return t;
        }
        nl = buf.indexOf('\n');
      }
      if (done) break;
    }
    const tail = handle(buf + dec.decode());
    if (tail) return tail;
  } catch (e) {
    if (isAbort(e) || opts.signal?.aborted) return { kind: 'aborted' };
    return dropped();
  }
  if (opts.signal?.aborted) return { kind: 'aborted' };
  return dropped();
}
