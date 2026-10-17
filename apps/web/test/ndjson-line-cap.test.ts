// Phase 05 review L3: the NDJSON reader caps its line buffer at 4 MiB -> bad_frame.
import { describe, expect, it } from 'vitest';
import { MAX_LINE_CHARS, postNdjson } from '../src/api/ndjson';
import { rulesTotalLabel } from '../src/features/ai/ai-lane';

function streamOf(chunks: string[]): typeof fetch {
  return (() => {
    const enc = new TextEncoder();
    let i = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (i < chunks.length) c.enqueue(enc.encode(chunks[i++]!));
        else c.close();
      },
    });
    return Promise.resolve(
      new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson' } }),
    );
  }) as unknown as typeof fetch;
}

describe('ndjson-line-cap (review L3)', () => {
  it('refuses a stream that never sends a newline past 4 MiB with bad_frame', async () => {
    const mib = 'x'.repeat(1024 * 1024);
    const out = await postNdjson(
      '/api/ai',
      {},
      {
        headers: {},
        fetchFn: streamOf([mib, mib, mib, mib, mib, '\n']),
      },
    );
    expect(MAX_LINE_CHARS).toBe(4 * 1024 * 1024);
    expect(out).toMatchObject({ kind: 'error', error: { reason: 'bad_frame' } });
  });

  it('still reads normal frames (heartbeat then result)', async () => {
    const out = await postNdjson(
      '/api/ai',
      {},
      {
        headers: {},
        fetchFn: streamOf([
          '{"t":"hb"}\n',
          '{"t":"result","kind":"ai","data":{"v":1,"findings":[]},"cache":"miss","model":"m"}\n',
        ]),
      },
    );
    expect(out).toMatchObject({ kind: 'result', resultKind: 'ai' });
  });
});

describe('rules total label (review M3)', () => {
  it('shows 100+ when the Worker read was truncated at 101 rules', () => {
    expect(rulesTotalLabel(101)).toBe('100+');
    expect(rulesTotalLabel(100)).toBe('100');
    expect(rulesTotalLabel(3)).toBe('3');
  });
});
