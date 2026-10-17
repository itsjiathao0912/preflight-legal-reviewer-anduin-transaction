// AC3/AC4 + C4: the AI upstream call has an IDLE timeout (no upstream bytes for UPSTREAM_IDLE_MS,
// armed at dispatch, re-armed by any read incl. keepalive comments and reasoning deltas) and a
// CEILING (UPSTREAM_TIMEOUT_MS, never re-armed). OCR has no idle timer; it is cut at
// UPSTREAM_OCR_TIMEOUT_MS. Both end as reason "timeout"; the browser NDJSON stays hb + 1 terminal.
import { parseFrameStream } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { bodyText, makeHarness, send, type Harness } from '../fakes/harness';
import { sseLines, type SseController } from '../fakes/openrouter-stub';
import {
  UPSTREAM_IDLE_MS,
  UPSTREAM_OCR_TIMEOUT_MS,
  UPSTREAM_TIMEOUT_MS,
} from '../../src/proxy/pipeline';
import { HEARTBEAT_MS } from '../../src/proxy/stream';
import { readSse } from '../../src/upstream/sse';

const MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const OK = '{"v":1,"findings":[]}';
const COMMENT = ': OPENROUTER PROCESSING\n\n';
const REASONING = `data: ${JSON.stringify({ model: MODEL, choices: [{ delta: { content: '', reasoning: 'hmm' } }] })}\n\n`;
const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

/** Start a request whose upstream body the test drives; resolves once dispatched. */
async function live(h: Harness, path: '/api/ai' | '/api/ocr' = '/api/ai') {
  let ctl: SseController | undefined;
  h.or.reply({ sseLive: (c) => (ctl = c) });
  const text = bodyText(await send(h, { path }));
  for (let i = 0; i < 20 && !ctl; i++) await flush(1);
  expect(ctl).toBeDefined();
  return { ctl: ctl!, text };
}

describe('upstream-timeouts (AC3, AC4, C4)', () => {
  test('the constants are the probe-chosen values', () => {
    expect(UPSTREAM_IDLE_MS).toBe(60_000);
    expect(UPSTREAM_TIMEOUT_MS).toBe(420_000);
    expect(UPSTREAM_OCR_TIMEOUT_MS).toBe(240_000);
  });

  test('should abort and return reason timeout when no upstream byte arrives for UPSTREAM_IDLE_MS (silent connect)', async () => {
    const h = makeHarness({ fakeTimers: true });
    h.or.reply({ hang: true });
    const text = bodyText(await send(h));
    await flush();
    h.timers!.advance(UPSTREAM_IDLE_MS - 1);
    await flush();
    expect(h.or.aborted).toBe(0);
    h.timers!.advance(1);
    const { terminal, heartbeats } = parseFrameStream(await text);
    expect(terminal).toMatchObject({ t: 'error', code: 'upstream_failed', reason: 'timeout' });
    expect(heartbeats).toBe(1 + UPSTREAM_IDLE_MS / HEARTBEAT_MS);
    expect(h.or.aborted).toBe(1);
    expect(h.logs.some((l) => l.includes('proxy.upstream_idle_timeout'))).toBe(true);
    expect(h.timers!.pending).toBe(0);
  });

  test('a stream that stalls after two chunks times out at UPSTREAM_IDLE_MS', async () => {
    const h = makeHarness({ fakeTimers: true });
    h.or.reply({
      sseStall: { chunks: sseLines({ content: '{"v":', finishReason: null, done: false }) },
    });
    const text = bodyText(await send(h));
    await flush();
    h.timers!.advance(UPSTREAM_IDLE_MS);
    const { terminal } = parseFrameStream(await text);
    expect(terminal).toMatchObject({ t: 'error', reason: 'timeout' });
    expect(h.or.aborted).toBe(1);
    expect(h.timers!.pending).toBe(0);
  });

  test('a keepalive comment every 30 s for 5 minutes re-arms the idle timer; then 60 s of silence times out', async () => {
    const h = makeHarness({ fakeTimers: true });
    const { ctl, text } = await live(h);
    for (let i = 0; i < 10; i++) {
      h.timers!.advance(30_000);
      ctl.push(COMMENT);
      await flush();
    }
    expect(h.or.aborted).toBe(0);
    h.timers!.advance(UPSTREAM_IDLE_MS - 1);
    await flush();
    expect(h.or.aborted).toBe(0);
    h.timers!.advance(1);
    const { terminal } = parseFrameStream(await text);
    expect(terminal).toMatchObject({ t: 'error', reason: 'timeout' });
    expect(h.or.aborted).toBe(1);
    expect(h.timers!.pending).toBe(0);
  });

  test('reasoning deltas every 30 s re-arm the idle timer; the stream then completes normally', async () => {
    const h = makeHarness({ fakeTimers: true });
    const { ctl, text } = await live(h);
    for (let i = 0; i < 10; i++) {
      h.timers!.advance(30_000);
      ctl.push(REASONING);
      await flush();
    }
    for (const l of sseLines({ content: OK, model: MODEL })) ctl.push(l);
    ctl.close();
    const { terminal } = parseFrameStream(await text);
    expect(terminal).toMatchObject({ t: 'result', kind: 'ai', model: MODEL });
    expect(h.or.aborted).toBe(0);
    expect(h.timers!.pending).toBe(0);
  });

  test('should keep a continuously active stream alive until the ceiling then time out', async () => {
    const h = makeHarness({ fakeTimers: true });
    const { ctl, text } = await live(h);
    for (let t = 10_000; t < UPSTREAM_TIMEOUT_MS; t += 10_000) {
      h.timers!.advance(10_000);
      ctl.push(COMMENT);
      await flush();
    }
    expect(h.or.aborted).toBe(0);
    h.timers!.advance(10_000);
    const { terminal, heartbeats } = parseFrameStream(await text);
    expect(terminal).toMatchObject({ t: 'error', code: 'upstream_failed', reason: 'timeout' });
    expect(heartbeats).toBe(1 + UPSTREAM_TIMEOUT_MS / HEARTBEAT_MS);
    expect(h.or.aborted).toBe(1);
    expect(h.logs.some((l) => l.includes('proxy.upstream_ceiling_timeout'))).toBe(true);
    expect(h.timers!.pending).toBe(0);
  });

  test('a stalled read() that ignores abort still ends readSse with an AbortError', async () => {
    const ac = new AbortController();
    const never = () => new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) });
    const p = readSse(new Response(never()), {
      onActivity: () => {},
      maxContentChars: 100,
      maxRawBytes: 100,
      signal: ac.signal,
    });
    await flush();
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    const pre = new AbortController();
    pre.abort();
    await expect(
      readSse(new Response(never()), {
        onActivity: () => {},
        maxContentChars: 100,
        maxRawBytes: 100,
        signal: pre.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('should not idle-time-out an OCR stream but cut it at 240 s; AI idle is still 60 s', async () => {
    const h = makeHarness({ fakeTimers: true });
    const { text } = await live(h, '/api/ocr');
    h.timers!.advance(UPSTREAM_IDLE_MS + 1_000);
    await flush();
    expect(h.or.aborted).toBe(0);
    h.timers!.advance(UPSTREAM_OCR_TIMEOUT_MS - UPSTREAM_IDLE_MS - 2_000);
    await flush();
    expect(h.or.aborted).toBe(0);
    h.timers!.advance(1_000);
    const { terminal } = parseFrameStream(await text);
    expect(terminal).toMatchObject({ t: 'error', code: 'upstream_failed', reason: 'timeout' });
    expect(h.or.aborted).toBe(1);
    expect(h.logs.some((l) => l.includes('proxy.upstream_ceiling_timeout'))).toBe(true);
    expect(h.logs.some((l) => l.includes('proxy.upstream_idle_timeout'))).toBe(false);
    expect(h.timers!.pending).toBe(0);

    // same harness: an AI request still has the 60 s idle timer
    const ai = await live(h);
    h.timers!.advance(UPSTREAM_IDLE_MS);
    const second = parseFrameStream(await ai.text);
    expect(second.terminal).toMatchObject({ t: 'error', reason: 'timeout' });
    expect(h.logs.some((l) => l.includes('proxy.upstream_idle_timeout'))).toBe(true);
    expect(h.timers!.pending).toBe(0);
  });

  test('a makeHarness upstreamIdleMs override is honored', async () => {
    const h = makeHarness({ fakeTimers: true, upstreamIdleMs: 5_000 });
    h.or.reply({ hang: true });
    const text = bodyText(await send(h));
    await flush();
    h.timers!.advance(5_000);
    expect(parseFrameStream(await text).terminal).toMatchObject({ reason: 'timeout' });
  });
});
