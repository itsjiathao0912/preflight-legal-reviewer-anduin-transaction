// AC2: the Worker assembles the same terminal result from an SSE body as from the JSON reply:
// arbitrary chunk boundaries (incl. mid multibyte char and mid `\r\n`), comments, `data:` with or
// without a space, a usage-only final chunk, `[DONE]`; model, finish_reason and cost are read.
import { describe, expect, test } from 'vitest';
import { readSse, type SseResult } from '../../src/upstream/sse';
import { okAi, okOcr, sseLines } from '../fakes/openrouter-stub';
import { frames, makeHarness, send } from '../fakes/harness';

const enc = new TextEncoder();
const MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

function body(chunks: (string | Uint8Array)[]): Response {
  const s = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(typeof ch === 'string' ? enc.encode(ch) : ch);
      c.close();
    },
  });
  return new Response(s, { headers: { 'content-type': 'text/event-stream' } });
}

const opts = { onActivity: () => {}, maxContentChars: 2 * 1024 * 1024, maxRawBytes: 8 << 20 };

function ok(r: SseResult): Extract<SseResult, { ok: true }> {
  expect(r.ok).toBe(true);
  return r as Extract<SseResult, { ok: true }>;
}

describe('sse-assemble (AC2)', () => {
  const content = '{"v":1,"note":"Prix 12 € — naïve 日本 \u{1F600} end"}';
  const raw = sseLines({
    content,
    deltaChars: 7,
    reasoningLines: 2,
    comments: true,
    usage: { prompt_tokens: 60, completion_tokens: 305, cost: 0 },
  })
    .join('')
    .replace(/\n/g, '\r\n');
  const all = enc.encode(raw);

  test('should assemble identical content when the SSE body is split at every byte boundary', async () => {
    for (let i = 1; i < all.length; i++) {
      const r = ok(await readSse(body([all.slice(0, i), all.slice(i)]), opts));
      expect(r.content).toBe(content);
      expect(r.finishReason).toBe('stop');
      expect(r.model).toBe(MODEL);
      expect(r.done).toBe(true);
      expect(r.usage).toEqual({ prompt_tokens: 60, completion_tokens: 305, cost: 0 });
    }
  });

  test('one byte per read still assembles, and onActivity fires on every read up to [DONE]', async () => {
    let reads = 0;
    const chunks = [...all].map((b) => new Uint8Array([b]));
    const r = ok(await readSse(body(chunks), { ...opts, onActivity: () => reads++ }));
    expect(r.content).toBe(content);
    // reading stops at the `data: [DONE]` line end; only the trailing blank line (2 bytes) is unread
    expect(reads).toBe(chunks.length - 2);
  });

  test('data: without a space, comments, blank lines and a usage-only final chunk', async () => {
    const r = ok(
      await readSse(
        body([
          ': OPENROUTER PROCESSING\n\n',
          `data:{"model":"m:free","choices":[{"delta":{"content":"{\\"v\\":"}}]}\n\n`,
          `data: {"model":"m:free","choices":[{"delta":{"content":"1}"},"finish_reason":"stop"}]}\n\n`,
          `data: {"model":"m:free","choices":[],"usage":{"cost":0.25}}\n\n`,
          'data: [DONE]\n\n',
          'data: {"choices":[{"delta":{"content":"IGNORED AFTER DONE"}}]}\n\n',
        ]),
        opts,
      ),
    );
    expect(r.content).toBe('{"v":1}');
    expect(r.model).toBe('m:free');
    expect(r.usage).toEqual({ cost: 0.25 });
    expect(r.stats.commentLines).toBe(1);
  });

  test('only choices[0] is read; null content is skipped', async () => {
    const r = ok(
      await readSse(
        body([
          `data: {"model":"m:free","choices":[{"delta":{"content":"A"}},{"delta":{"content":"B"}}]}\n\n`,
          `data: {"choices":[{"delta":{"content":null},"finish_reason":"stop"}]}\n\n`,
          'data: [DONE]\n\n',
        ]),
        opts,
      ),
    );
    expect(r.content).toBe('A');
  });

  test('an "error" string inside the content is content, not a provider error', async () => {
    const r = ok(
      await readSse(
        body([
          `data: {"choices":[{"delta":{"content":"{\\"error\\":\\"usage\\"}"},"finish_reason":"stop"}]}\n\n`,
          'data: [DONE]\n\n',
        ]),
        opts,
      ),
    );
    expect(r.content).toBe('{"error":"usage"}');
  });

  test('through the Worker: body ends with "stream":true, accept is SSE, result and cost match', async () => {
    const h = makeHarness();
    h.or.reply(okAi([], 'nvidia/nemotron-3-super-120b-a12b:free', 0.0125));
    const { terminal } = await frames(await send(h));
    expect(terminal).toMatchObject({
      t: 'result',
      kind: 'ai',
      cache: 'miss',
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      data: { v: 1, findings: [] },
    });
    const call = h.or.calls[0]!;
    expect(call.body.endsWith(',"stream":true}')).toBe(true);
    expect(call.headers['accept']).toBe('text/event-stream');
    expect(h.platform.ledgerRows).toHaveLength(1);
    expect(h.platform.ledgerRows[0]).toMatchObject({ cost_usd: 0.0125 });
  });

  test('a JSON reply to a streaming request still goes through the JSON path', async () => {
    const h = makeHarness();
    h.or.reply({
      status: 200,
      text: JSON.stringify({
        model: 'm:free',
        choices: [{ message: { content: '{"v":1,"findings":[]}' } }],
      }),
    });
    const { terminal } = await frames(await send(h));
    expect(terminal).toMatchObject({ t: 'result', kind: 'ai', model: 'm:free' });
  });

  test('OCR: the SSE body assembles into the OCR result (K1 stub coverage)', async () => {
    const h = makeHarness();
    h.or.reply(okOcr());
    const { terminal } = await frames(await send(h, { path: '/api/ocr' }));
    expect(terminal).toMatchObject({ t: 'result', kind: 'ocr' });
    expect(h.or.calls[0]!.json['stream']).toBe(true);
  });
});
