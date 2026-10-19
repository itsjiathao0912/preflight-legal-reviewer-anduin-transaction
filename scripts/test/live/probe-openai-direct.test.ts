// OpenAI provider plan (4.7): the stage-1 direct probe, offline with an injected fetch. Proves the
// guards (ALLOW_LIVE_LLM, key present, ledger claim before each call, 3-call ceiling, pinned host,
// redirect 'error'), the Worker-identical request shape with max_completion_tokens 64, and that
// only status / model / usage / cost are printed (never the key).
import { describe, expect, it } from 'vitest';
import {
  PROBE_BASE,
  PROBE_CEILING,
  PROBE_PLAN,
  ProbeRefusal,
  runDirectProbe,
  type ProbeDeps,
} from '../../src/live/probe-openai-direct';

const KEY = ['sk', 'proj', 'OFFLINE0'.repeat(4)].join('-');

function sse(model: string, usage: Record<string, number> | null): string {
  const d = (v: unknown) => `data: ${JSON.stringify(v)}\n\n`;
  return (
    d({
      model,
      choices: [{ index: 0, delta: { content: '{"fin' }, finish_reason: null }],
      usage: null,
    }) +
    d({ model, choices: [{ index: 0, delta: {}, finish_reason: 'length' }], usage: null }) +
    (usage ? d({ model, choices: [], usage }) : '') +
    'data: [DONE]\n\n'
  );
}

function harness(
  over: Partial<ProbeDeps> = {},
  reply = () => sse('gpt-4.1-mini-2025-04-14', { prompt_tokens: 900, completion_tokens: 64 }),
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const claims: string[] = [];
  const printed: string[] = [];
  const deps: ProbeDeps = {
    env: { ALLOW_LIVE_LLM: '1', OPENAI_API_KEY: KEY },
    fetch: (async (u: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(u), init: init ?? {} });
      expect(claims.length).toBe(calls.length); // claimed before the call left
      return new Response(reply(), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }) as typeof fetch,
    ledger: () => ({ claim: (kind, label) => void claims.push(`${kind}:${label}`) }),
    ocrPage: () => 'QUJD',
    print: (l) => printed.push(l),
    ...over,
  };
  return { deps, calls, claims, printed };
}

describe('probe-openai-direct', () => {
  it('should probe OpenAI directly with a 3-call ceiling and a pinned host', async () => {
    const h = harness();
    const r = await runDirectProbe(h.deps);
    expect(r.ok).toBe(true);
    expect(PROBE_CEILING).toBe(3);
    expect(PROBE_PLAN.map((s) => s.task)).toEqual(['clause-judgment', 'counsel-draft', 'ocr']);
    expect(h.calls).toHaveLength(3);
    expect(h.claims).toEqual([
      'ai:probe:openai-direct clause-judgment',
      'ai:probe:openai-direct counsel-draft',
      'ocr:probe:openai-direct ocr',
    ]);
    for (const c of h.calls) {
      expect(c.url).toBe(`${PROBE_BASE}/chat/completions`);
      expect(PROBE_BASE).toBe('https://api.openai.com/v1');
      expect(c.init.redirect).toBe('error');
      const j = JSON.parse(String(c.init.body)) as Record<string, unknown>;
      expect(j['model']).toBe('gpt-4.1-mini');
      expect(j['max_completion_tokens']).toBe(64);
      expect(j['stream_options']).toEqual({ include_usage: true });
      expect(j).not.toHaveProperty('models');
      expect(
        (j['response_format'] as { json_schema: { strict: boolean } }).json_schema.strict,
      ).toBe(true);
    }
    const ocr = JSON.parse(String(h.calls[2]!.init.body)) as {
      messages: { content: { type: string }[] }[];
    };
    expect(ocr.messages[0]!.content.map((p) => p.type)).toEqual(['text', 'image_url']);
    expect(r.results[0]).toEqual({
      task: 'clause-judgment',
      status: 200,
      model: 'gpt-4.1-mini-2025-04-14',
      tokensIn: 900,
      tokensOut: 64,
      costMicroUsd: Math.ceil(900 * 0.4 + 64 * 1.6),
    });
    expect(h.printed.join('\n')).not.toContain(KEY);
    expect(h.printed[0]).toMatch(
      /^clause-judgment status=200 model=gpt-4\.1-mini-2025-04-14 in=900 out=64 cost_micro_usd=\d+$/,
    );
  });

  it('refuses without ALLOW_LIVE_LLM=1 or without a key, before any call or claim', async () => {
    for (const env of [
      { OPENAI_API_KEY: KEY },
      { ALLOW_LIVE_LLM: '1' },
      { ALLOW_LIVE_LLM: 'true', OPENAI_API_KEY: KEY },
    ]) {
      const h = harness({ env });
      await expect(runDirectProbe(h.deps)).rejects.toBeInstanceOf(ProbeRefusal);
      expect(h.calls).toHaveLength(0);
      expect(h.claims).toHaveLength(0);
    }
  });

  it('a ledger refusal stops before the call leaves', async () => {
    const h = harness({
      ledger: () => ({
        claim: () => {
          throw new Error('ai UTC-day cap reached (3 of 3)');
        },
      }),
    });
    await expect(runDirectProbe(h.deps)).rejects.toThrow(/cap reached/);
    expect(h.calls).toHaveLength(0);
  });

  it('aborts on a served model that is not gpt-4.1-mini', async () => {
    const h = harness({}, () =>
      sse('gpt-4o-2024-08-06', { prompt_tokens: 10, completion_tokens: 5 }),
    );
    const r = await runDirectProbe(h.deps);
    expect(r.ok).toBe(false);
    expect(h.calls).toHaveLength(1);
    expect(h.printed.at(-1)).toMatch(/STOP: served model/);
  });

  it('stops after a rejected call (e.g. a 400 schema error); the body is never printed', async () => {
    const h = harness({
      fetch: (async () =>
        new Response('{"error":{"message":"SCHEMA-BODY-MARKER"}}', {
          status: 400,
        })) as typeof fetch,
    });
    const r = await runDirectProbe(h.deps);
    expect(r.ok).toBe(false);
    expect(r.results).toHaveLength(1);
    expect(h.printed.join('\n')).not.toContain('SCHEMA-BODY-MARKER');
  });
});
