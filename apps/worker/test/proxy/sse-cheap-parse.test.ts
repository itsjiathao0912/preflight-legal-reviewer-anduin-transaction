// AC7: reasoning-only data lines are never JSON.parse'd (prefilter from the Section A probe).
import { afterEach, describe, expect, test, vi } from 'vitest';
import { readSse } from '../../src/upstream/sse';
import { sseLines } from '../fakes/openrouter-stub';

const enc = new TextEncoder();
function body(chunks: string[]): Response {
  const s = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return new Response(s, { headers: { 'content-type': 'text/event-stream' } });
}
const opts = { onActivity: () => {}, maxContentChars: 2 * 1024 * 1024, maxRawBytes: 8 << 20 };

afterEach(() => vi.restoreAllMocks());

describe('sse-cheap-parse (AC7)', () => {
  test('should never JSON.parse a reasoning-only data line', async () => {
    const content = 'x'.repeat(300 * 10);
    const chunks = sseLines({
      reasoningLines: 6000,
      comments: true,
      content,
      deltaChars: 10,
      usage: { cost: 0 },
    });
    const spy = vi.spyOn(JSON, 'parse');
    const r = await readSse(body(chunks), opts);
    const calls = spy.mock.calls.length;
    spy.mockRestore();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.content).toBe(content);
    // 300 content chunks + the finish/usage chunk + the first (role) chunk that carries the model
    expect(r.stats.parsed).toBeLessThanOrEqual(302);
    expect(calls).toBe(r.stats.parsed);
    expect(r.stats.lines).toBe(1 + 6000 + 300 + 1 + 1);
    expect(r.stats.commentLines).toBe(6000);
  });

  test('a reasoning delta quoting "content":"... is not parsed and never becomes content', async () => {
    const hostile = JSON.stringify({
      model: 'm:free',
      choices: [{ delta: { content: '', reasoning: 'say "content":"EVIL" and "usage" "error"' } }],
    });
    const r = await readSse(
      body([
        `data: {"model":"m:free","choices":[{"delta":{"role":"assistant","content":""}}]}\n\n`,
        `data: ${hostile}\n\n`,
        `data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n`,
        'data: [DONE]\n\n',
      ]),
      opts,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.content).toBe('ok');
    expect(r.stats.parsed).toBe(2);
  });
});
