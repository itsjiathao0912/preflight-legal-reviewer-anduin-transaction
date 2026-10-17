// AC6: every SSE failure shape maps to its reason and refund class (DV10):
// provider_error (mid-stream error chunk / finish_reason "error") keeps ALL claims (inducible);
// stream_truncated (EOF without finish_reason) and network (reset) refund the visitor claims;
// finish_reason "length" and the 2 MiB content / 8 MiB raw caps are malformed (all kept).
import { describe, expect, test } from 'vitest';
import { frames, makeHarness, send, T0 } from '../fakes/harness';
import { sseLines, type StubReply } from '../fakes/openrouter-stub';
import { keys } from '../../src/limits/policy';

const MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const OK = '{"v":1,"findings":[]}';
const flush = () => new Promise((r) => setTimeout(r, 0));

function heldUnits(h: ReturnType<typeof makeHarness>): number {
  let n = 0;
  for (const v of h.platform.counts.values()) n += v;
  return n;
}
function expectVisitorRefundedGlobalKept(h: ReturnType<typeof makeHarness>): void {
  expect(h.platform.count(keys('x', 'y', T0).global)).toBe(1);
  expect(heldUnits(h)).toBe(1);
  expect(h.platform.refunds.length).toBeGreaterThan(0);
}
function expectAllKept(h: ReturnType<typeof makeHarness>): void {
  expect(h.platform.count(keys('x', 'y', T0).global)).toBe(1);
  expect(heldUnits(h)).toBeGreaterThan(1);
  expect(h.platform.refunds).toHaveLength(0);
}

const data = (v: unknown) => `data: ${JSON.stringify(v)}\n\n`;
const chunk = (delta: Record<string, unknown>, finish: string | null = null) =>
  data({ model: MODEL, choices: [{ index: 0, delta, finish_reason: finish }] });

const rows: [string, StubReply, Record<string, unknown>, 'visitor' | 'none'][] = [
  [
    'mid-stream {error} chunk',
    {
      sse: {
        chunks: [chunk({ content: '{"v"' }), data({ error: { code: 502, message: 'boom' } })],
      },
    },
    { code: 'upstream_failed', reason: 'provider_error' },
    'none',
  ],
  [
    'finish_reason "error"',
    { sse: { chunks: [chunk({ content: OK }), chunk({}, 'error'), 'data: [DONE]\n\n'] } },
    { code: 'upstream_failed', reason: 'provider_error' },
    'none',
  ],
  [
    'EOF without finish_reason and without [DONE]',
    { sse: { chunks: [chunk({ role: 'assistant', content: '' }), chunk({ content: OK })] } },
    { code: 'upstream_failed', reason: 'stream_truncated' },
    'visitor',
  ],
  [
    'finish_reason "length"',
    { sse: { chunks: sseLines({ content: OK, finishReason: 'length' }) } },
    { code: 'upstream_failed', reason: 'malformed' },
    'none',
  ],
  [
    'non-JSON content line',
    { sse: { chunks: ['data: {"choices":[{"delta":{"content":"x"}}\n\n', 'data: [DONE]\n\n'] } },
    { code: 'upstream_failed', reason: 'malformed' },
    'none',
  ],
  [
    'content over 2 MiB',
    { sse: { chunks: sseLines({ content: 'a'.repeat(2 * 1024 * 1024 + 10), deltaChars: 65536 }) } },
    { code: 'upstream_failed', reason: 'malformed' },
    'none',
  ],
  [
    'raw stream over 8 MiB (reasoning only)',
    {
      sse: {
        chunks: Array.from({ length: 140 }, () =>
          chunk({ content: '', reasoning: 'r'.repeat(65536) }),
        ),
      },
    },
    { code: 'upstream_failed', reason: 'malformed' },
    'none',
  ],
  [
    'JSON 200 error body (not SSE)',
    { status: 200, text: JSON.stringify({ error: { message: 'upstream boom' } }) },
    { code: 'upstream_failed', reason: 'provider_error' },
    'none',
  ],
];

describe('sse-failure-shapes (AC6)', () => {
  for (const [name, reply, expected, refund] of rows) {
    test(`should map ${name} to its reason and refund class`, async () => {
      const h = makeHarness();
      h.or.reply(reply);
      const { terminal } = await frames(await send(h));
      expect(terminal).toMatchObject({ t: 'error', ...expected });
      if (refund === 'visitor') expectVisitorRefundedGlobalKept(h);
      else expectAllKept(h);
      expect(h.platform.cacheMap.size).toBe(0);
      expect(h.platform.ledgerRows).toHaveLength(0);
    });
  }

  test('finish_reason without [DONE] is accepted (clean EOF)', async () => {
    const h = makeHarness();
    h.or.reply({ sse: { chunks: sseLines({ content: OK, done: false }) } });
    const { terminal } = await frames(await send(h));
    expect(terminal).toMatchObject({ t: 'result', kind: 'ai', model: MODEL });
  });

  test('a connection reset mid-stream is a network fault: visitor refunded, global kept', async () => {
    const h = makeHarness();
    let ctl!: Parameters<Extract<StubReply, { sseLive: unknown }>['sseLive']>[0];
    h.or.reply({ sseLive: (c) => (ctl = c) });
    const pending = send(h).then(frames);
    for (let i = 0; i < 20 && !ctl; i++) await flush();
    ctl.push(chunk({ content: '{"v":' }));
    await flush();
    ctl.error(new Error('ECONNRESET'));
    const { terminal } = await pending;
    expect(terminal).toMatchObject({ t: 'error', code: 'upstream_failed', reason: 'network' });
    expectVisitorRefundedGlobalKept(h);
  });

  test('upstream text never reaches the error frame or the logs', async () => {
    const h = makeHarness();
    h.or.reply({ sse: { chunks: [data({ error: { message: 'SECRET-UPSTREAM-TEXT' } })] } });
    const res = await send(h);
    const text = await res.text();
    expect(text).not.toContain('SECRET-UPSTREAM-TEXT');
    expect(h.logs.join('\n')).not.toContain('SECRET-UPSTREAM-TEXT');
  });
});
