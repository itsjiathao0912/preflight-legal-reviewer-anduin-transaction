// AC4 security (OpenAI provider plan, M3): the OpenAI host is a code constant with no env
// override, the call never follows a redirect (a 3xx is a failure, its Location never fetched),
// and the test stub refuses every other host.
import { describe, expect, test } from 'vitest';
import { loadConfig } from '../../src/config';
import { callOpenAi, OPENAI_BASE } from '../../src/upstream/openai';
import { bodyText, send } from '../fakes/harness';
import { OpenAiStub } from '../fakes/openai-stub';
import { makeOpenAiHarness, openAiEnv } from '../fakes/openai-harness';

describe('openai-host-pinned (AC4 security)', () => {
  test('should refuse any host other than api.openai.com', async () => {
    expect(OPENAI_BASE).toBe('https://api.openai.com/v1');
    const s = new OpenAiStub();
    for (const url of [
      'https://openrouter.ai/api/v1/chat/completions',
      'https://api.openai.com.evil.example/v1/chat/completions',
      'https://evil.example/?u=https://api.openai.com/',
    ])
      await expect(s.fetch(url, { method: 'POST', body: '{}' })).rejects.toThrow(
        /unexpected outbound host/,
      );
    expect(s.refused).toHaveLength(3);
  });

  test('env cannot move the host (OPENAI_BASE_URL / OPENROUTER_BASE_URL are ignored for OpenAI)', async () => {
    const env = openAiEnv({ OPENAI_BASE_URL: 'https://evil.example/v1' });
    const cfg = loadConfig(env);
    const seen: string[] = [];
    const f = (async (u: RequestInfo | URL) => {
      seen.push(String(u));
      return new Response('{}');
    }) as typeof fetch;
    await callOpenAi(f, cfg, '{}', new AbortController().signal);
    expect(seen).toEqual(['https://api.openai.com/v1/chat/completions']);
  });

  test('a 302 is a failure and its Location is never fetched', async () => {
    const h = makeOpenAiHarness();
    h.oa.reply({ status: 302, text: '', headers: { location: 'https://evil.example/steal' } });
    const text = await bodyText(await send(h));
    expect(text).toContain('"t":"error"');
    expect(h.oa.calls).toHaveLength(1);
    expect(h.oa.calls[0]!.redirect).toBe('manual');
    expect(h.oa.refused).toEqual([]);
  });
});
