import { describe, expect, it } from 'vitest';
import {
  BENCH_BASE,
  inSubset,
  lookupRecording,
  parseBenchArgs,
  runBench,
  sentenceHasAnchor,
  type BenchDeps,
  type BenchRecording,
  type GroundTruth,
} from '../src/bench/bench-defects';
import {
  BenchRefusal,
  benchLimits,
  LIFETIME_CAP_MICRO_USD,
  type BenchLedgerState,
} from '../src/bench/bench-ledger';

// AC12: live-run guards of the defect bench, proven with a fake fetch and an in-memory ledger.
const KEY = 'sk-test-SECRET-KEY-0123456789';
const DOC = `<html><body><ol><li>(e) Each Investor who is a natural person should respond to Section E.</li></ol>
<h2>SIGNATURE PAGE</h2><p>E. Supplemental Data for Entities</p><p>1. Entities furnish the following data.</p></body></html>`;
const gt: GroundTruth = {
  v: 1,
  docs: ['a.htm', 'b.htm', 'c.htm'].map((file) => ({
    file,
    origin: 'corpus' as const,
    url: 'https://www.sec.gov/x.htm',
    verified: true,
    defects: [
      {
        id: 'E1',
        kind: 'wrong_target',
        expect: 'reference-target' as const,
        anchors: ['natural person should respond to Section E'],
        why: 'x',
      },
    ],
  })),
};

function sse(content: string, model = 'gpt-4.1-mini-2025-04-14'): Response {
  const lines = [
    { model, choices: [{ delta: { content } }] },
    { model, choices: [{ delta: {}, finish_reason: 'stop' }] },
    { model, choices: [], usage: { prompt_tokens: 1000, completion_tokens: 100 } },
  ];
  const body = lines.map((l) => `data: ${JSON.stringify(l)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function harness(
  over: Partial<BenchDeps> = {},
  initial: BenchLedgerState = { version: 1, entries: [] },
) {
  let state: BenchLedgerState = JSON.parse(JSON.stringify(initial));
  const urls: string[] = [];
  const headers: Record<string, string>[] = [];
  const entriesAtCall: number[] = [];
  const printed: string[] = [];
  const written: BenchRecording[] = [];
  const deps: BenchDeps = {
    env: { ALLOW_LIVE_LLM: '1', OPENAI_API_KEY: KEY },
    fetch: (async (url: string, init: RequestInit) => {
      urls.push(String(url));
      headers.push(init.headers as Record<string, string>);
      entriesAtCall.push(state.entries.length);
      const id = (JSON.parse(String(init.body)).messages[1].content as string).match(
        /"id":"(r_[0-9a-f]+)"/,
      )![1];
      return sse(
        JSON.stringify({
          findings: [
            {
              candidate_id: id,
              label: 'Section E',
              verdict: 'mismatch',
              issue_class: 'broken_cross_reference',
              severity: 'high',
              confidence: 0.9,
              quote: `natural person should respond to Section E ${KEY}`.replace(` ${KEY}`, ''),
              explanation: `Section E is for entities (echo ${KEY}).`,
              interpretations: [],
            },
          ],
        }),
      );
    }) as unknown as typeof fetch,
    ledgerStore: () => ({
      read: () => JSON.parse(JSON.stringify(state)),
      write: (s) => {
        state = JSON.parse(JSON.stringify(s));
      },
    }),
    recordings: { list: () => [], write: (_n, r) => void written.push(r) },
    readDoc: () => new TextEncoder().encode(DOC),
    print: (l) => void printed.push(l),
    gt,
    clock: () => new Date('2026-10-22T00:00:00Z'),
    ...over,
  };
  return { deps, urls, headers, entriesAtCall, printed, written, state: () => state };
}
const live = {
  mode: 'live' as const,
  subset: 'verified' as const,
  source: 'authored' as const,
  checkGroundTruth: false,
};

describe('bench-defects live guards (AC12)', () => {
  it('refuses without ALLOW_LIVE_LLM=1 and without a key, before any network call', async () => {
    const h = harness({ env: { OPENAI_API_KEY: KEY } });
    await expect(runBench(live, h.deps)).rejects.toThrow(/ALLOW_LIVE_LLM=1/);
    const h2 = harness({ env: { ALLOW_LIVE_LLM: '1' } });
    await expect(runBench(live, h2.deps)).rejects.toThrow(/OPENAI_API_KEY/);
    expect(h.urls).toEqual([]);
    expect(h2.urls).toEqual([]);
  });

  it('claims a ledger entry BEFORE each call, settles it, uses the pinned host, saves live recordings', async () => {
    const h = harness();
    const r = await runBench(live, h.deps);
    expect(r.ok).toBe(true);
    expect(h.urls).toHaveLength(3);
    for (const u of h.urls) expect(u).toBe(`${BENCH_BASE}/chat/completions`);
    expect(BENCH_BASE).toBe('https://api.openai.com/v1');
    expect(h.entriesAtCall).toEqual([1, 2, 3]);
    expect(h.state().entries.every((e) => e.settled && e.tokensIn === 1000)).toBe(true);
    expect(r.scores.every((s) => s.caught.includes('E1'))).toBe(true);
    expect(h.written).toHaveLength(3);
    expect(h.written[0]!.meta.source).toBe('live');
  });

  it('refuses above the per-run call ceiling', async () => {
    const h = harness();
    await expect(runBench({ ...live, maxCalls: '2' }, h.deps)).rejects.toThrow(/call ceiling of 2/);
    expect(h.urls).toHaveLength(2);
    expect(() => benchLimits('21', undefined)).toThrow(BenchRefusal);
    expect(benchLimits('40', undefined, true).maxCalls).toBe(40);
  });

  it('refuses when the per-run --max-usd budget would be passed and asks for the user', async () => {
    const h = harness();
    await expect(runBench({ ...live, maxUsd: '0.0001' }, h.deps)).rejects.toThrow(
      /ask the user before raising --max-usd/,
    );
    expect(h.urls).toEqual([]);
  });

  it('refuses past the $10 lifetime cap', async () => {
    const h = harness(
      {},
      {
        version: 1,
        entries: [
          {
            label: 'old',
            doc: 'x',
            at: 'y',
            costMicroUsd: LIFETIME_CAP_MICRO_USD - 10,
            settled: true,
          },
        ],
      },
    );
    await expect(runBench(live, h.deps)).rejects.toThrow(/\$10 cap/);
    expect(h.urls).toEqual([]);
  });

  it('never prints the key or an Authorization header', async () => {
    const h = harness();
    await runBench(live, h.deps);
    expect(h.headers[0]!['authorization']).toBe(`Bearer ${KEY}`);
    const out = h.printed.join('\n');
    expect(out).not.toContain(KEY);
    expect(out.toLowerCase()).not.toContain('bearer');
  });

  it('stops on a served model that is not gpt-4.1-mini', async () => {
    const h = harness({
      fetch: (async () => sse('{"findings":[]}', 'gpt-5')) as unknown as typeof fetch,
    });
    const r = await runBench(live, h.deps);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/not gpt-4.1-mini/);
    expect(h.state().entries).toHaveLength(1);
  });
});

describe('bench-defects matching and replay', () => {
  it('anchor matching is case, quote and whitespace tolerant', () => {
    expect(
      sentenceHasAnchor(
        '(e) Each Investor who is a natural  person should respond to Section E.',
        'natural person should respond to Section E',
      ),
    ).toBe(true);
    expect(sentenceHasAnchor('the “ Offering Materials ”)', 'the "Offering Materials")')).toBe(
      true,
    );
    expect(sentenceHasAnchor('respond to Section D.', 'respond to Section E')).toBe(false);
  });

  it('missing recording = not_recorded (never a false positive); hash mismatch = stale', async () => {
    const h = harness();
    const off = await runBench({ ...live, mode: 'offline' }, h.deps);
    expect(off.scores.every((s) => s.replay === 'not_recorded' && s.falsePositives === 0)).toBe(
      true,
    );
    expect(off.reasons.join()).toMatch(/reference-target missed/);
    const rec = {
      doc: 'a.htm',
      inputHash: 'f'.repeat(64),
      meta: { source: 'authored' },
    } as BenchRecording;
    expect(lookupRecording([rec], 'a.htm', 'e'.repeat(64), 'authored').kind).toBe('stale');
    expect(lookupRecording([rec], 'a.htm', 'f'.repeat(64), 'authored').kind).toBe('hit');
    expect(lookupRecording([rec], 'b.htm', 'f'.repeat(64), 'authored').kind).toBe('not_recorded');
  });

  it('offline replay of live recordings uses the AC10 thresholds; authored replay stays strict', async () => {
    const h = harness();
    expect((await runBench(live, h.deps)).ok).toBe(true);
    // replay only two of the three live answers: 2 of 3 caught passes AC10, fails the authored gate
    const two = h.written.slice(0, 2);
    const h2 = harness({ recordings: { list: () => two, write: () => {} } });
    const rLive = await runBench({ ...live, mode: 'offline', source: 'live' }, h2.deps);
    expect(rLive.ok).toBe(true);
    const asAuthored = two.map((r) => ({ ...r, meta: { ...r.meta, source: 'authored' as const } }));
    const h3 = harness({ recordings: { list: () => asAuthored, write: () => {} } });
    const rAuth = await runBench({ ...live, mode: 'offline' }, h3.deps);
    expect(rAuth.ok).toBe(false);
    expect(rAuth.reasons.join()).toMatch(/reference-target missed/);
  });

  it('exits with a clear message when the corpus is missing', async () => {
    const h = harness({ readDoc: () => null });
    const r = await runBench({ ...live, mode: 'offline' }, h.deps);
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(
      /corpus not found: seed fixtures\/defect-bench\/corpus or pass --corpus <dir> or --fetch/,
    );
  });

  it('parses flags strictly', () => {
    expect(parseBenchArgs(['--offline', '--subset', 'verified'])).toMatchObject({
      mode: 'offline',
      subset: 'verified',
    });
    expect(() => parseBenchArgs(['--offline', '--live'])).toThrow(BenchRefusal);
    expect(() => parseBenchArgs(['--bogus'])).toThrow(BenchRefusal);
    expect(parseBenchArgs(['--subset', 'heldout']).subset).toBe('heldout');
    expect(() => parseBenchArgs(['--subset', 'some'])).toThrow(BenchRefusal);
  });

  it('heldout = docs outside the verified subset; all = every doc', () => {
    const v = { verified: true } as Parameters<typeof inSubset>[0];
    const h = { verified: false } as Parameters<typeof inSubset>[0];
    expect([inSubset(v, 'verified'), inSubset(h, 'verified')]).toEqual([true, false]);
    expect([inSubset(v, 'heldout'), inSubset(h, 'heldout')]).toEqual([false, true]);
    expect([inSubset(v, 'all'), inSubset(h, 'all')]).toEqual([true, true]);
  });
});
