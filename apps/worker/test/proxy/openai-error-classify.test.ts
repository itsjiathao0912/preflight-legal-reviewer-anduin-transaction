// AC16 (OpenAI provider plan, M3): 429 insufficient_quota -> budget_cap / provider_balance
// (non-retryable, not consumed); 401 / 403 -> upstream_failed / provider_auth; any other 429 ->
// provider_rate_limited. Error bodies are read at most 4 KB and never echoed or logged.
import { describe, expect, test } from 'vitest';
import { classifyOpenAiError } from '../../src/upstream/openai';
import { bodyText, send } from '../fakes/harness';
import type { OpenAiReply } from '../fakes/openai-stub';
import { makeOpenAiHarness } from '../fakes/openai-harness';

const LEAK = 'OPENAI-ERROR-BODY-MARKER';

async function terminalOf(reply: OpenAiReply) {
  const h = makeOpenAiHarness();
  h.oa.reply(reply);
  const text = await bodyText(await send(h));
  const last = JSON.parse(text.trim().split('\n').at(-1)!) as Record<string, unknown>;
  return { h, text, last };
}

describe('openai-error-classify (AC16)', () => {
  test('should classify insufficient_quota, 401, 403 and rate 429 without echoing bodies', async () => {
    const cases: [OpenAiReply, Record<string, unknown>][] = [
      [
        {
          status: 429,
          json: {
            error: { message: LEAK, type: 'insufficient_quota', code: 'insufficient_quota' },
          },
        },
        { t: 'error', code: 'budget_cap', reason: 'provider_balance' },
      ],
      [
        { status: 401, json: { error: { message: LEAK, code: 'invalid_api_key' } } },
        { t: 'error', code: 'upstream_failed', reason: 'provider_auth' },
      ],
      [
        { status: 403, json: { error: { message: LEAK } } },
        { t: 'error', code: 'upstream_failed', reason: 'provider_auth' },
      ],
      [
        {
          status: 429,
          json: { error: { message: LEAK, code: 'rate_limit_exceeded' } },
          headers: { 'retry-after': '7' },
        },
        { t: 'error', code: 'upstream_failed', reason: 'provider_rate_limited', retry_after_s: 7 },
      ],
    ];
    for (const [reply, expected] of cases) {
      const { h, text, last } = await terminalOf(reply);
      expect(last).toMatchObject(expected);
      expect(text).not.toContain(LEAK);
      expect(h.logs.join('\n')).not.toContain(LEAK);
    }
  });

  test('not-consumed classes refund every claim; a rate limit keeps the global claim', async () => {
    const a = await terminalOf({ status: 401, json: {} });
    for (const c of a.h.platform.claimLog.filter((x) => x.ok))
      expect(a.h.platform.count(c.key)).toBe(0);
    const b = await terminalOf({ status: 429, json: { error: { code: 'rate_limit_exceeded' } } });
    const global = b.h.platform.claimLog.find((c) => c.ok && c.key.scope === 'global_ai')!;
    expect(b.h.platform.count(global.key)).toBe(1);
  });

  test('reads at most 4 KB of a huge error body and never throws', async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        pulled += 1024;
        c.enqueue(new Uint8Array(1024).fill(120));
        if (pulled > 1_000_000) c.close();
      },
    });
    const r = await classifyOpenAiError(new Response(body, { status: 429 }));
    expect(r).toMatchObject({ ok: false, reason: 'provider_rate_limited' });
    expect(pulled).toBeLessThanOrEqual(8 * 1024);
    expect(await classifyOpenAiError(new Response('x', { status: 500 }))).toBeUndefined();
  });
});
