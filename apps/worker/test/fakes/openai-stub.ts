// OpenAI-shaped stub (OpenAI provider plan, M3): an injectable `fetch` that records every request
// to https://api.openai.com/ and answers from a queue of scripted replies. A 200 `answer` reply is
// streamed as OpenAI chat-completion SSE (role chunk, content deltas, finish chunk, then the
// `stream_options.include_usage` chunk with `choices: []` and the usage, then `[DONE]`). Every
// chunk carries `"usage":null` like the real API. Turnstile siteverify goes to `other`; ANY other
// host throws, so an unscripted or redirected call can never leave the test.
import type { RecordedCall } from './openrouter-stub';

export const OPENAI_HOST_PREFIX = 'https://api.openai.com/';
export const SERVED_MODEL = 'gpt-4.1-mini-2025-04-14';

export type OpenAiReply =
  | {
      /** assistant message content (JSON text) */
      answer: string;
      model?: string;
      /** prompt/completion tokens; null = no usage chunk */
      usage?: { prompt_tokens: number; completion_tokens: number } | null;
      finishReason?: string;
      /** end the stream without a finish chunk (truncated) */
      truncate?: boolean;
    }
  | { status: number; json?: unknown; text?: string; headers?: Record<string, string> }
  | { throws: string }
  | { hang: true };

export function openAiSse(r: Extract<OpenAiReply, { answer: string }>): string[] {
  const model = r.model ?? SERVED_MODEL;
  const out: string[] = [];
  const data = (v: unknown) => out.push(`data: ${JSON.stringify(v)}\n\n`);
  const chunk = (delta: Record<string, unknown>, finish: string | null = null) => ({
    id: 'chatcmpl-1',
    object: 'chat.completion.chunk',
    created: 1,
    model,
    choices: [{ index: 0, delta, logprobs: null, finish_reason: finish }],
    usage: null,
  });
  data(chunk({ role: 'assistant', content: '', refusal: null }));
  for (let i = 0; i < r.answer.length; i += 48) data(chunk({ content: r.answer.slice(i, i + 48) }));
  if (r.truncate) return out;
  data(chunk({}, r.finishReason ?? 'stop'));
  const usage = r.usage === undefined ? { prompt_tokens: 1000, completion_tokens: 200 } : r.usage;
  if (usage !== null)
    data({
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1,
      model,
      choices: [],
      usage: { ...usage, total_tokens: usage.prompt_tokens + usage.completion_tokens },
    });
  out.push('data: [DONE]\n\n');
  return out;
}

export function aiAnswer(findings: unknown[] = []): string {
  return JSON.stringify({ findings });
}

/** OCR wire reply: nullable bbox/conf filled with null, like strict structured output. */
export function ocrAnswer(): string {
  return JSON.stringify({
    v: 1,
    pages: [{ index: 0, lines: [{ text: 'Section 1', bbox: null, conf: null }] }],
  });
}

export class OpenAiStub {
  readonly calls: RecordedCall[] = [];
  readonly queue: OpenAiReply[] = [];
  other?: (url: string, init: RequestInit | undefined) => Promise<Response>;
  /** hosts that were refused (anything not api.openai.com / turnstile) */
  readonly refused: string[] = [];

  reply(...r: OpenAiReply[]): this {
    this.queue.push(...r);
    return this;
  }

  readonly fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(OPENAI_HOST_PREFIX)) {
      if (this.other && url.startsWith('https://challenges.cloudflare.com/'))
        return this.other(url, init);
      this.refused.push(url);
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
    if ('hang' in r)
      return new Promise<Response>((_res, rej) =>
        init?.signal?.addEventListener('abort', () =>
          rej(new DOMException('aborted', 'AbortError')),
        ),
      );
    if ('answer' in r) {
      const enc = new TextEncoder();
      const chunks = openAiSse(r);
      return new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            for (const ch of chunks) c.enqueue(enc.encode(ch));
            c.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
      );
    }
    return new Response(r.text ?? JSON.stringify(r.json ?? {}), {
      status: r.status,
      headers: { 'content-type': 'application/json', ...(r.headers ?? {}) },
    });
  }) as typeof fetch;
}
