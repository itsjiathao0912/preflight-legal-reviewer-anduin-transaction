// Shared OpenRouterStub (reused by Phases 05/06): an injectable `fetch` that records every
// outbound request and answers from a queue of scripted responses. Unscripted hosts throw.
export type StubReply =
  | { status: number; json?: unknown; text?: string; headers?: Record<string, string> }
  | { hang: true }
  | { throws: string };

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
    return new Response(r.text ?? JSON.stringify(r.json ?? {}), {
      status: r.status,
      headers: { 'content-type': 'application/json', ...(r.headers ?? {}) },
    });
  }) as typeof fetch;
}
