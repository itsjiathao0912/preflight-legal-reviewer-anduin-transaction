// Throwaway spike Worker `aduin-transaction-spike` (S1/S2/S6 remote). Deleted after the run.
// GET  /hold?secs=N&upstream=0|1  stream a heartbeat chunk every 10 s for N s; optionally one
//                                  free-model OpenRouter call after the heartbeat (S1).
// POST /body?mode=pass|parse      ~400 KB base64 JSON body: stream pass-through vs JSON parse +
//                                  string-template re-serialize (S2).
interface SpikeEnv {
  OPENROUTER_API_KEY?: string;
  SPIKE_MODEL?: string;
}

const enc = new TextEncoder();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function upstreamCall(env: SpikeEnv): Promise<string> {
  if (!env.OPENROUTER_API_KEY || !env.SPIKE_MODEL?.endsWith(':free')) return 'upstream:skipped';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env.SPIKE_MODEL,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
    }),
  });
  await res.arrayBuffer(); // drain; never echo the body
  return `upstream:${res.status}`;
}

function hold(secs: number, withUpstream: boolean, env: SpikeEnv, ctx: ExecutionContext): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const run = async () => {
    const t0 = Date.now();
    let beats = 0;
    while (Date.now() - t0 < secs * 1000) {
      await writer.write(enc.encode(`hb ${beats++} ${Math.round((Date.now() - t0) / 1000)}s\n`));
      await sleep(Math.min(10_000, secs * 1000 - (Date.now() - t0)));
    }
    const up = withUpstream
      ? await upstreamCall(env).catch(() => 'upstream:error')
      : 'upstream:none';
    await writer.write(enc.encode(`done ${Math.round((Date.now() - t0) / 1000)}s ${up}\n`));
    await writer.close();
  };
  ctx.waitUntil(run().catch(() => writer.abort()));
  return new Response(readable, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

async function body(request: Request, mode: string): Promise<Response> {
  if (mode === 'pass') {
    let bytes = 0;
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, c) {
        bytes += chunk.byteLength;
        c.enqueue(chunk);
      },
    });
    // Pass-through: stream the body without buffering or parsing (as a proxy would forward it).
    const forwarded = new Response(request.body?.pipeThrough(counter) ?? null);
    await forwarded.arrayBuffer();
    return Response.json({ mode, bytes });
  }
  const text = await request.text();
  const parsed = JSON.parse(text) as { image: string; prompt: string };
  const out = `{"model":"x:free","messages":[{"role":"user","content":[{"type":"text","text":${JSON.stringify(parsed.prompt)}},{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,${parsed.image}"}}]}]}`;
  return Response.json({ mode, bytes: text.length, outBytes: out.length });
}

export default {
  async fetch(request: Request, env: SpikeEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/hold') {
      const secs = Math.min(95, Math.max(1, Number(url.searchParams.get('secs') ?? '54')));
      return hold(secs, url.searchParams.get('upstream') === '1', env, ctx);
    }
    if (request.method === 'POST' && url.pathname === '/body') {
      return body(request, url.searchParams.get('mode') ?? 'pass');
    }
    return new Response('not found', { status: 404 });
  },
};
