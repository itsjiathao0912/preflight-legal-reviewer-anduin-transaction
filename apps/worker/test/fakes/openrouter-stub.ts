// Shared OpenRouterStub (reused by Phases 05/06): an injectable `fetch` that records every
// outbound request and answers from a queue of scripted responses. Unscripted hosts throw.
// SSE: a request with `"stream":true` that is answered by a 200 `json` reply with a
// `choices[0].message.content` string is converted to an OpenRouter-shaped SSE body (role chunk,
// 64-char content deltas, finish chunk with usage, `[DONE]`), so every JSON-scripted test keeps
// working against the streaming Worker. A `text` reply is never converted (forces the JSON path).
// `sse` / `sseStall` / `sseLive` give a test full control of the raw SSE bytes and timing.
export interface SseController {
  push(raw: string | Uint8Array): void;
  close(): void;
  error(e?: unknown): void;
}

export type StubReply =
  | { status: number; json?: unknown; text?: string; headers?: Record<string, string> }
  | { hang: true }
  | { throws: string }
  /** raw chunks enqueued as given (one read each), then the body closes */
  | { sse: { chunks: (string | Uint8Array)[] } }
  /** raw chunks enqueued, then the body never closes; abort errors it with AbortError */
  | { sseStall: { chunks: (string | Uint8Array)[] } }
  /** the test drives the body through the controller (handed over right after headers) */
  | { sseLive: (ctl: SseController) => void };

export interface SseLinesOptions {
  model?: string;
  /** reasoning-only data chunks before the content */
  reasoningLines?: number;
  /** keepalive comment lines emitted before every reasoning line */
  comments?: boolean;
  content?: string;
  deltaChars?: number;
  finishReason?: string | null;
  usage?: Record<string, unknown>;
  done?: boolean;
}

/** OpenRouter-shaped SSE chunks (one string per data/comment line, each ending in a blank line). */
export function sseLines(o: SseLinesOptions = {}): string[] {
  const model = o.model ?? 'nvidia/nemotron-3-super-120b-a12b:free';
  const out: string[] = [];
  const data = (v: unknown) => out.push(`data: ${JSON.stringify(v)}\n\n`);
  const chunk = (delta: Record<string, unknown>, finish: string | null = null) => ({
    id: 'gen-1',
    object: 'chat.completion.chunk',
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
  });
  data(chunk({ role: 'assistant', content: '' }));
  for (let i = 0; i < (o.reasoningLines ?? 0); i++) {
    if (o.comments) out.push(': OPENROUTER PROCESSING\n\n');
    data(chunk({ role: 'assistant', content: '', reasoning: `thinking step ${i} ` }));
  }
  const content = o.content ?? '';
  const size = o.deltaChars ?? 64;
  for (let i = 0; i < content.length; i += size)
    data(chunk({ role: 'assistant', content: content.slice(i, i + size) }));
  if (o.finishReason !== null)
    data({
      ...chunk({ role: 'assistant', content: '' }, o.finishReason ?? 'stop'),
      usage: o.usage ?? {},
    });
  if (o.done !== false) out.push('data: [DONE]\n\n');
  return out;
}

/** The SSE equivalent of a JSON chat-completion reply, or undefined when it has no content. */
function sseOf(json: unknown): string[] | undefined {
  if (typeof json !== 'object' || json === null) return undefined;
  const j = json as {
    model?: unknown;
    choices?: { message?: { content?: unknown }; finish_reason?: unknown }[];
    usage?: Record<string, unknown>;
  };
  if (!Array.isArray(j.choices)) return undefined;
  const c = j.choices[0];
  if (typeof c?.message?.content !== 'string') return undefined;
  const finish = typeof c.finish_reason === 'string' ? c.finish_reason : 'stop';
  return sseLines({
    ...(typeof j.model === 'string' ? { model: j.model } : {}),
    content: c.message.content,
    finishReason: finish,
    usage: j.usage ?? {},
  });
}

const SSE_HEADERS = { 'content-type': 'text/event-stream' };
const enc = new TextEncoder();
const bytes = (c: string | Uint8Array) => (typeof c === 'string' ? enc.encode(c) : c);

export interface RecordedCall {
  url: string;
  headers: Record<string, string>;
  body: string;
  json: Record<string, unknown>;
  /** RequestInit.redirect as passed by the Worker */
  redirect: RequestInit['redirect'];
}

export function okAi(
  findings: unknown[] = [],
  model = 'nvidia/nemotron-3.5-super-vl:free',
  cost?: number,
): StubReply {
  return {
    status: 200,
    json: {
      model,
      choices: [{ message: { content: JSON.stringify({ v: 1, findings }) } }],
      usage: cost === undefined ? {} : { cost },
    },
  };
}

export function okOcr(model = 'nvidia/nemotron-3.5-super-vl:free'): StubReply {
  return {
    status: 200,
    json: {
      model,
      choices: [
        {
          message: {
            content: JSON.stringify({
              v: 1,
              pages: [{ index: 0, lines: [{ text: 'Section 1' }] }],
            }),
          },
        },
      ],
      usage: {},
    },
  };
}

export class OpenRouterStub {
  readonly calls: RecordedCall[] = [];
  readonly queue: StubReply[] = [];
  /** extra handler for non-OpenRouter hosts (e.g. Turnstile stub) */
  other?: (url: string, init: RequestInit | undefined) => Promise<Response>;
  aborted = 0;

  reply(...r: StubReply[]): this {
    this.queue.push(...r);
    return this;
  }

  readonly fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('https://openrouter.ai/')) {
      if (this.other) return this.other(url, init);
      throw new Error(`unexpected outbound host: ${new URL(url).host}`);
    }
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    const body = typeof init?.body === 'string' ? init.body : '';
    this.calls.push({
      url,
      headers,
      body,
      json: JSON.parse(body) as Record<string, unknown>,
      redirect: init?.redirect,
    });
    const r = this.queue.shift() ?? { status: 500, text: 'no scripted reply' };
    if ('throws' in r) throw new Error(r.throws);
    if ('hang' in r) {
      return new Promise<Response>((_res, rej) => {
        const sig = init?.signal;
        sig?.addEventListener('abort', () => {
          this.aborted++;
          rej(new DOMException('aborted', 'AbortError'));
        });
      });
    }
    if ('sse' in r) return this.sseResponse(r.sse.chunks, true, init?.signal);
    if ('sseStall' in r) return this.sseResponse(r.sseStall.chunks, false, init?.signal);
    if ('sseLive' in r) {
      let ctl!: SseController;
      const res = this.sseResponse([], false, init?.signal, (c) => (ctl = c));
      r.sseLive(ctl);
      return res;
    }
    const streamed = (this.calls.at(-1)!.json as { stream?: unknown }).stream === true;
    const auto = streamed && r.status === 200 && r.text === undefined ? sseOf(r.json) : undefined;
    if (auto) return this.sseResponse(auto, true, init?.signal);
    return new Response(r.text ?? JSON.stringify(r.json ?? {}), {
      status: r.status,
      headers: { 'content-type': 'application/json', ...(r.headers ?? {}) },
    });
  }) as typeof fetch;

  private sseResponse(
    chunks: (string | Uint8Array)[],
    close: boolean,
    signal: AbortSignal | null | undefined,
    live?: (c: SseController) => void,
  ): Response {
    let ended = false;
    const body = new ReadableStream<Uint8Array>({
      start: (c) => {
        for (const ch of chunks) c.enqueue(bytes(ch));
        if (close) {
          ended = true;
          c.close();
        }
        live?.({
          push: (raw) => {
            if (!ended) c.enqueue(bytes(raw));
          },
          close: () => {
            if (!ended) c.close();
            ended = true;
          },
          error: (e) => {
            if (!ended) c.error(e ?? new Error('stream reset'));
            ended = true;
          },
        });
        signal?.addEventListener('abort', () => {
          if (ended) return;
          ended = true;
          this.aborted++;
          c.error(new DOMException('aborted', 'AbortError'));
        });
      },
    });
    return new Response(body, { status: 200, headers: SSE_HEADERS });
  }
}
