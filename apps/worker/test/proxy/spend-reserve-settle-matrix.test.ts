// AC10 / AC11 (OpenAI provider plan, M2 item 2.4): every exit path of a metered call settles the
// worst-case reservation exactly once, per the settle table. Pipeline rows run through the
// OpenAI harness; exit paths that need real timing (timeout, client abort before/after dispatch)
// are proven on the single settle rule the pipeline applies.
import { describe, expect, test } from 'vitest';
import { settleRule } from '../../src/proxy/pipeline';
import { costMicroUsd } from '../../src/upstream/openai';
import type { Classified } from '../../src/upstream/classify';
import { frames, ocrBody, send } from '../fakes/harness';
import { aiAnswer, type OpenAiReply } from '../fakes/openai-stub';
import { events, makeOpenAiHarness, openAiEnv } from '../fakes/openai-harness';

async function run(reply: OpenAiReply, path?: '/api/ocr') {
  const h = makeOpenAiHarness();
  h.oa.reply(reply);
  const res = await send(h, path ? { path, body: ocrBody() } : {});
  if (res.status === 200) await frames(res);
  else await res.arrayBuffer();
  const reserve = h.platform.spendLog.find((e) => e.op === 'reserve')!;
  const settles = h.platform.spendLog.filter((e) => e.op === 'settle');
  return { h, W: reserve.units!, settles, total: h.platform.spendTotal };
}

const ACTUAL = costMicroUsd(1000, 200);

describe('spend-reserve-settle-matrix (AC10, AC11)', () => {
  test('success + usage -> settle to actual cost; ledger carries the settled cost', async () => {
    const { h, settles, total, W } = await run({ answer: aiAnswer() });
    expect(ACTUAL).toBe(720);
    expect(W).toBeGreaterThan(ACTUAL);
    expect(settles).toEqual([{ op: 'settle', units: W, with: ACTUAL }]);
    expect(total).toBe(ACTUAL);
    expect(h.platform.ledgerRows).toHaveLength(1);
    expect(h.platform.ledgerRows[0]!.cost_usd).toBeCloseTo(ACTUAL / 1e6, 9);
    expect(h.platform.ledgerRows[0]!.model).toBe('gpt-4.1-mini-2025-04-14');
  });

  test('OCR success + usage -> actual', async () => {
    const r = await run(
      {
        answer: JSON.stringify({
          v: 1,
          pages: [{ index: 0, lines: [{ text: 'x', bbox: null, conf: 0.9 }] }],
        }),
      },
      '/api/ocr',
    );
    expect(r.total).toBe(ACTUAL);
  });

  test('success without usage -> keep worst; logs proxy.usage_missing (AC11)', async () => {
    const { h, settles, total, W } = await run({ answer: aiAnswer(), usage: null });
    expect(settles).toEqual([{ op: 'settle', units: W, with: 'keep' }]);
    expect(total).toBe(W);
    expect(events(h.logs, 'proxy.usage_missing')).toHaveLength(1);
    expect(h.platform.ledgerRows[0]!.cost_usd).toBeCloseTo(W / 1e6, 9);
  });

  test('malformed with usage -> actual; without usage -> worst', async () => {
    const a = await run({ answer: 'not json at all' });
    expect(a.total).toBe(ACTUAL);
    const b = await run({ answer: 'not json at all', usage: null });
    expect(b.total).toBe(b.W);
  });

  test('finish_reason length with usage -> actual', async () => {
    const r = await run({ answer: aiAnswer(), finishReason: 'length' });
    expect(r.settles[0]!.with).toBe(ACTUAL);
    expect(r.total).toBe(ACTUAL);
  });

  for (const [label, reply] of [
    ['400 schema error', { status: 400, json: { error: { message: 'Invalid schema' } } }],
    ['401', { status: 401, json: { error: { code: 'invalid_api_key' } } }],
    ['403', { status: 403, json: { error: { code: 'unsupported_country' } } }],
    [
      '429 insufficient_quota',
      { status: 429, json: { error: { code: 'insufficient_quota', type: 'insufficient_quota' } } },
    ],
  ] as [string, OpenAiReply][]) {
    test(`${label} -> release fully`, async () => {
      const r = await run(reply);
      expect(r.settles[0]!.with).toBe('release');
      expect(r.total).toBe(0);
    });
  }

  for (const [label, reply] of [
    ['500', { status: 500, text: 'oops' }],
    ['503', { status: 503, text: 'oops' }],
    ['429 rate limit', { status: 429, json: { error: { code: 'rate_limit_exceeded' } } }],
    ['network error', { throws: 'connection reset' }],
    ['truncated stream', { answer: aiAnswer(), truncate: true }],
  ] as [string, OpenAiReply][]) {
    test(`${label} -> keep worst`, async () => {
      const r = await run(reply);
      expect(r.settles).toEqual([{ op: 'settle', units: r.W, with: 'keep' }]);
      expect(r.total).toBe(r.W);
    });
  }

  test('actual > reserved -> overrun counted without a cap check; logs proxy.spend_overrun', async () => {
    const { h, total, W } = await run({
      answer: aiAnswer(),
      usage: { prompt_tokens: 50_000, completion_tokens: 20_000 },
    });
    const actual = costMicroUsd(50_000, 20_000);
    expect(actual).toBeGreaterThan(W);
    expect(total).toBe(actual);
    expect(events(h.logs, 'proxy.spend_overrun')).toHaveLength(1);
    expect(events(h.logs, 'proxy.spend')[0]).toMatchObject({ outcome: 'overrun' });
  });

  test('missing key never reaches reserve', async () => {
    const h = makeOpenAiHarness({ env: openAiEnv({ OPENAI_API_KEY: undefined }) });
    await (await send(h)).arrayBuffer();
    expect(h.platform.spendLog).toEqual([]);
  });

  test('settle rule: timeout and client abort exit paths', () => {
    const fail = (o: Partial<Extract<Classified, { ok: false }>>): Classified => ({
      ok: false,
      code: 'upstream_failed',
      reason: 'x',
      retryable: false,
      consumed: true,
      ...o,
    });
    // client abort BEFORE dispatch: once() returns consumed:false -> release
    expect(settleRule(fail({ reason: 'client_abort', consumed: false }))).toBe('release');
    // client abort AFTER dispatch, timeout, network: consumed -> keep worst
    expect(settleRule(fail({ reason: 'client_abort' }))).toBe('keep');
    expect(settleRule(fail({ reason: 'timeout', providerFault: true }))).toBe('keep');
    expect(settleRule(fail({ reason: 'network', providerFault: true }))).toBe('keep');
    expect(settleRule(fail({ reason: 'stream_truncated', providerFault: true }))).toBe('keep');
    // a failure that reports usage but is not malformed keeps the worst case
    expect(settleRule(fail({ reason: 'provider_error', tokens: { in: 1, out: 1 } }))).toBe('keep');
    expect(settleRule(fail({ reason: 'malformed', tokens: { in: 1000, out: 200 } }))).toBe(720);
  });
});
