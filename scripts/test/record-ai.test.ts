import { describe, expect, it } from 'vitest';
import {
  LIVE_REQUEST_CEILING,
  RecordRefusal,
  baseUrlFrom,
  isAllowedModel,
  recordLive,
  redact,
  resolveOptions,
  type FetchLike,
} from '../src/record/record-ai';
import { caseById } from '../src/record/casebook';

// Fake key assembled at runtime; never commit a literal key prefix.
const KEY = ['sk', 'or', 'v1', 'f'.repeat(40)].join('-');
const LIVE = { ALLOW_LIVE_LLM: '1' };

describe('record-ai guards (G8)', () => {
  it('refuses without ALLOW_LIVE_LLM=1', () => {
    expect(() => resolveOptions(['--max-requests', '2'], {})).toThrow(RecordRefusal);
  });

  it('refuses without a request cap (flag or env)', () => {
    expect(() => resolveOptions([], LIVE)).toThrow(/max-requests/);
    expect(resolveOptions([], { ...LIVE, RECORD_MAX_REQUESTS: '3' }).maxRequests).toBe(3);
  });

  it('the cap can only lower the in-code ceiling of 8', () => {
    expect(LIVE_REQUEST_CEILING).toBe(8);
    expect(resolveOptions(['--max-requests', '50'], LIVE).maxRequests).toBe(8);
    expect(resolveOptions(['--max-requests=2'], LIVE).maxRequests).toBe(2);
    expect(() => resolveOptions(['--max-requests', '0'], LIVE)).toThrow(RecordRefusal);
  });

  it('allows only :free models on the allow-list', () => {
    expect(isAllowedModel('nvidia/nemotron-3-super-120b-a12b:free')).toBe(true);
    expect(isAllowedModel('openrouter/free')).toBe(false);
    expect(isAllowedModel('openai/gpt-4o')).toBe(false);
    expect(() => resolveOptions(['--max-requests', '1', '--model', 'openai/gpt-4o'], LIVE)).toThrow(
      /allow-list/,
    );
  });

  it('pins the base URL to https://openrouter.ai', () => {
    expect(baseUrlFrom({})).toBe('https://openrouter.ai/api/v1');
    expect(() => baseUrlFrom({ OPENROUTER_BASE_URL: 'https://evil.example/api/v1' })).toThrow(
      RecordRefusal,
    );
  });

  it('redacts key-like strings from error bodies', () => {
    expect(redact(`bad key ${KEY} Bearer abc`)).not.toContain(KEY);
    expect(redact('x'.repeat(500)).length).toBeLessThanOrEqual(200);
  });

  function completion(cost: number, model = 'nvidia/nemotron-3-super-120b-a12b:free'): Response {
    return new Response(
      JSON.stringify({
        model,
        choices: [{ message: { content: '{"drafts":[]}' } }],
        usage: { cost, prompt_tokens: 1, completion_tokens: 1 },
      }),
      { status: 200 },
    );
  }

  it('aborts at the first usage.cost > 0 and writes nothing for it', async () => {
    let calls = 0;
    const f: FetchLike = () => {
      calls++;
      return Promise.resolve(completion(0.001));
    };
    const opts = {
      ...resolveOptions(['--max-requests', '5'], LIVE),
      cases: [caseById('counsel-draft-03'), caseById('sample-01')],
      spaceMs: 0,
    };
    const out = await recordLive(opts, { OPENROUTER_API_KEY: KEY }, f, () => {});
    expect(calls).toBe(1);
    expect(out.aborted).toMatch(/cost/);
    expect(out.outcomes[0]!.wrote).toBeUndefined();
  });

  it('stops at the request cap and never prints the key', async () => {
    const seen: string[] = [];
    let auth = '';
    const f: FetchLike = (_u, init) => {
      auth = String((init.headers as Record<string, string>)['authorization']);
      return Promise.resolve(
        new Response(`{"error":{"message":"rate limited ${KEY}"}}`, { status: 429 }),
      );
    };
    const opts = {
      ...resolveOptions(['--max-requests', '1'], LIVE),
      cases: [caseById('counsel-draft-03'), caseById('sample-01')],
      spaceMs: 0,
    };
    const out = await recordLive(opts, { OPENROUTER_API_KEY: KEY }, f, (s) => seen.push(s));
    expect(out.requests).toBe(1);
    expect(out.aborted).toBe('request cap reached');
    expect(auth).toBe(`Bearer ${KEY}`);
    expect(JSON.stringify(out) + seen.join('\n')).not.toContain(KEY);
  });

  it('refuses when the key is missing', async () => {
    const opts = resolveOptions(['--max-requests', '1'], LIVE);
    await expect(recordLive(opts, {}, () => Promise.reject(new Error('no')))).rejects.toThrow(
      RecordRefusal,
    );
  });
});
