// OpenRouter SSE reader (plan ai-review-stream-dedup, D2). Reads a `text/event-stream` chat
// completion and assembles `{content, finishReason, model, usage}` for the shared classify tail.
// - Streaming TextDecoder (multibyte chars split across reads), `\n` or `\r\n`, `data:` with or
//   without a space, `:` comment keepalives, blank lines ignored.
// - `onActivity()` runs on EVERY read (the pipeline's idle timer uses it); it must stay cheap.
// - Cheap prefilter (Section A probe): reasoning-only lines are counted, never JSON.parse'd. A
//   line is parsed only if it can carry content, a non-null finish_reason, usage, an error, or
//   the first model id. A false positive only costs one extra parse.
// - Caps: assembled content (chars) and raw bytes; either exceeded -> `malformed`.
// - Upstream text is never echoed: results carry reason names only.
// - Abort: every read is raced against the signal, so a stalled read() still ends; an abort
//   REJECTS with AbortError (the caller maps it to timeout / client_abort).

export interface SseOptions {
  onActivity: () => void;
  /** assembled assistant-message cap, in UTF-16 chars */
  maxContentChars: number;
  /** raw stream cap, in bytes (reasoning deltas count here, not in the content cap) */
  maxRawBytes: number;
  signal?: AbortSignal;
}

export interface SseStats {
  /** `data:` lines (incl. `[DONE]`) */
  lines: number;
  /** lines that went through JSON.parse */
  parsed: number;
  commentLines: number;
}

export type SseResult =
  | {
      ok: true;
      content: string;
      finishReason: string | null;
      model: string | undefined;
      usage: unknown;
      /** `[DONE]` was seen (false = clean EOF after a finish_reason) */
      done: boolean;
      stats: SseStats;
    }
  | { ok: false; reason: 'malformed' | 'provider_error' | 'stream_truncated' };

const CONTENT_RE = /"content":"[^"]/;
const FINISH_RE = /"finish_reason":"/;

function abortError(): DOMException {
  return new DOMException('aborted', 'AbortError');
}

type Terminal = 'done' | Extract<SseResult, { ok: false }>['reason'];
type LineOutcome = 'continue' | Terminal;

export async function readSse(res: Response, opts: SseOptions): Promise<SseResult> {
  const { signal } = opts;
  if (signal?.aborted) throw abortError();
  const body = res.body;
  if (!body) return { ok: false, reason: 'stream_truncated' };
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  const parts: string[] = [];
  const stats: SseStats = { lines: 0, parsed: 0, commentLines: 0 };
  let contentChars = 0;
  let rawBytes = 0;
  let finishReason: string | null = null;
  let model: string | undefined;
  let usage: unknown;
  let buf = '';

  let rejectAbort: ((e: unknown) => void) | undefined;
  const aborted = new Promise<never>((_r, rej) => (rejectAbort = rej));
  aborted.catch(() => {}); // observed only through the race below
  const onAbort = () => rejectAbort?.(abortError());
  signal?.addEventListener('abort', onAbort);

  const line = (raw: string): LineOutcome => {
    const l = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (l === '') return 'continue';
    if (l.startsWith(':')) {
      stats.commentLines++;
      return 'continue';
    }
    if (!l.startsWith('data:')) return 'continue'; // event:/id:/retry: carry nothing we use
    stats.lines++;
    const payload = l.charCodeAt(5) === 32 ? l.slice(6) : l.slice(5);
    if (payload === '[DONE]') return 'done';
    const isContent = CONTENT_RE.test(payload);
    if (
      !isContent &&
      !FINISH_RE.test(payload) &&
      !payload.includes('"usage"') &&
      !payload.includes('"error"') &&
      model !== undefined
    )
      return 'continue'; // reasoning-only / empty delta: activity only
    stats.parsed++;
    let j: unknown;
    try {
      j = JSON.parse(payload);
    } catch {
      return isContent ? 'malformed' : 'continue';
    }
    if (typeof j !== 'object' || j === null) return isContent ? 'malformed' : 'continue';
    const o = j as {
      error?: unknown;
      model?: unknown;
      usage?: unknown;
      choices?: { delta?: { content?: unknown }; finish_reason?: unknown }[];
    };
    if (o.error !== undefined && o.error !== null) return 'provider_error';
    if (model === undefined && typeof o.model === 'string') model = o.model;
    if (typeof o.usage === 'object' && o.usage !== null) usage = o.usage;
    const choice = Array.isArray(o.choices) ? o.choices[0] : undefined;
    const c = choice?.delta?.content;
    if (typeof c === 'string' && c !== '') {
      contentChars += c.length;
      if (contentChars > opts.maxContentChars) return 'malformed';
      parts.push(c);
    }
    if (typeof choice?.finish_reason === 'string') {
      if (choice.finish_reason === 'error') return 'provider_error';
      finishReason = choice.finish_reason;
    }
    return 'continue';
  };

  /** Feed decoded text; returns a terminal outcome or undefined to keep reading. */
  const feed = (text: string): Terminal | undefined => {
    buf += text;
    let from = 0;
    let at = buf.indexOf('\n');
    while (at >= 0) {
      const r = line(buf.slice(from, at));
      from = at + 1;
      if (r !== 'continue') {
        buf = buf.slice(from);
        return r;
      }
      at = buf.indexOf('\n', from);
    }
    buf = buf.slice(from);
    return undefined;
  };

  const ok = (done: boolean): SseResult => ({
    ok: true,
    content: parts.join(''),
    finishReason,
    model,
    usage,
    done,
    stats,
  });
  const stop = (r: Terminal): SseResult => (r === 'done' ? ok(true) : { ok: false, reason: r });

  let finished = false;
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      opts.onActivity();
      if (done) {
        finished = true;
        const tail = feed(decoder.decode());
        if (tail !== undefined) return stop(tail);
        if (buf !== '') {
          const last = line(buf);
          buf = '';
          if (last !== 'continue') return stop(last);
        }
        return finishReason !== null ? ok(false) : { ok: false, reason: 'stream_truncated' };
      }
      rawBytes += value.byteLength;
      if (rawBytes > opts.maxRawBytes) return { ok: false, reason: 'malformed' };
      const r = feed(decoder.decode(value, { stream: true }));
      if (r !== undefined) return stop(r);
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    // never await: a stalled source may never settle its cancel
    if (!finished) reader.cancel().catch(() => {});
  }
}
