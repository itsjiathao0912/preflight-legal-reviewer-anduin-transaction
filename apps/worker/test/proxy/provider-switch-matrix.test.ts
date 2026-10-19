// AC1 / AC3 (OpenAI provider plan, M1): AI_PROVIDER picks the upstream from config alone (same
// build, env differs). Missing or invalid values turn AI/OCR off with zero port calls and zero
// upstream calls, `loadConfig` never throws for them and memory routes keep working. Cache keys
// carry the provider model, so an answer cached under one provider is a MISS under the other.
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/config';
import { capFor } from '../../src/limits/policy';
import { configFor } from '../../src/proxy/pipeline';
import { describe, expect, test } from 'vitest';
import { baseEnv, bodyText, frames, makeHarness, ocrBody, send, T0 } from '../fakes/harness';
import { aiAnswer, OpenAiStub } from '../fakes/openai-stub';
import { makeOpenAiHarness, openAiEnv } from '../fakes/openai-harness';
import { okAi, OpenRouterStub } from '../fakes/openrouter-stub';
import { FakePlatform } from '../fakes/platform';
import { TurnstileStub } from '../fakes/turnstile-stub';
import { makeMem, session } from '../memory/memory-harness';

const INVALID: Record<string, string | undefined> = {
  missing: undefined,
  empty: '',
  'other case': 'OpenAI',
  unknown: 'anthropic',
  spaced: 'open ai',
};

describe('provider-switch-matrix (AC1, AC3)', () => {
  test('should route by AI_PROVIDER: openrouter -> openrouter.ai', async () => {
    const h = makeHarness({ env: baseEnv({ AI_PROVIDER: 'openrouter' }) });
    h.or.reply(okAi());
    const { terminal } = await frames(await send(h));
    expect(terminal).toMatchObject({ t: 'result', kind: 'ai', cache: 'miss' });
    expect(h.or.calls).toHaveLength(1);
    expect(h.or.calls[0]!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  test('should route by AI_PROVIDER: openai -> api.openai.com (same build, env differs)', async () => {
    const h = makeOpenAiHarness();
    h.oa.reply({ answer: aiAnswer() });
    const { terminal } = await frames(await send(h));
    expect(terminal).toMatchObject({ t: 'result', kind: 'ai', cache: 'miss' });
    expect(h.oa.calls).toHaveLength(1);
    expect(h.oa.calls[0]!.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(h.oa.refused).toEqual([]);
  });

  test('trimmed exact values are accepted', () => {
    expect(loadConfig(baseEnv({ AI_PROVIDER: ' openai ' })).aiProvider).toBe('openai');
    expect(loadConfig(baseEnv({ AI_PROVIDER: 'openrouter' })).aiProvider).toBe('openrouter');
  });

  for (const [label, value] of Object.entries(INVALID)) {
    test(`should fail closed on invalid or missing AI_PROVIDER (${label})`, async () => {
      const env = baseEnv({ AI_PROVIDER: value });
      if (value === undefined) expect(env).not.toHaveProperty('AI_PROVIDER');
      expect(() => loadConfig(env)).not.toThrow();
      expect(loadConfig(env).aiProvider).toBe('invalid');
      expect(() => configFor({ ...env })).not.toThrow();
      const h = makeHarness({ env });
      for (const o of [{}, { path: '/api/ocr' as const, body: ocrBody() }]) {
        const res = await send(h, o);
        expect(res.status).toBe(429);
        expect(await res.json()).toMatchObject({
          error: { code: 'quota_exhausted', reason: 'ai_unavailable' },
        });
      }
      expect(h.or.calls).toHaveLength(0);
      expect(h.ts.calls).toBe(0);
      expect(h.platform.calls).toBe(0); // zero port calls (refused before the cache read)
      expect(h.logs.some((l) => l.includes('proxy.config_invalid_provider'))).toBe(true);
      // the quota route answers, with global_ok false
      const q = await send(h, { path: '/api/quota' });
      expect(q.status).toBe(200);
      expect(((await q.json()) as { global_ok: boolean }).global_ok).toBe(false);
    });
  }

  test('memory routes still answer 200 with an invalid AI_PROVIDER (configFor never throws)', async () => {
    const m = makeMem({ env: { AI_PROVIDER: 'bogus' } });
    const s = await session(m);
    expect(s.cookie).toBeTruthy();
    const m2 = makeMem({ env: {} }); // missing
    expect((await session(m2)).workspaceId).toBeTruthy();
  });

  test('cache isolation: an answer cached under openrouter is a MISS under openai', async () => {
    const platform = new FakePlatform({ capFor: capFor(loadConfig(openAiEnv())) });
    const or = new OpenRouterStub();
    const ts = new TurnstileStub();
    or.other = ts.handle;
    const clock = { now: T0 };
    const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
    const orApp = createApp({
      fetch: or.fetch,
      now: () => clock.now,
      proxy: { platform, log: () => {} },
    });
    const orH = { app: orApp, env: baseEnv(), clock, ctx };
    or.reply(okAi());
    expect((await frames(await send(orH))).terminal).toMatchObject({ cache: 'miss' });
    expect((await frames(await send(orH))).terminal).toMatchObject({ cache: 'hit' });
    expect(platform.cacheMap.size).toBe(1);

    const oa = makeOpenAiHarness({ platform });
    oa.clock.now = clock.now;
    oa.oa.reply({ answer: aiAnswer() });
    const t = (await frames(await send(oa))).terminal;
    expect(t).toMatchObject({ t: 'result', cache: 'miss' });
    expect(oa.oa.calls).toHaveLength(1);
    expect(platform.cacheMap.size).toBe(2);
    // and back: the OpenRouter app still hits its own entry, no new upstream call
    expect((await frames(await send(orH))).terminal).toMatchObject({ cache: 'hit' });
    expect(or.calls).toHaveLength(1);
  });

  test('missing key of the ACTIVE provider fails closed; the other key does not count', async () => {
    const h = makeOpenAiHarness({ env: openAiEnv({ OPENAI_API_KEY: undefined }) });
    const res = await send(h);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: { reason: 'ai_unavailable' } });
    expect(h.oa.calls).toHaveLength(0);
    expect(h.platform.spendTotal).toBe(0);
    const q = await send(h, { path: '/api/quota' });
    expect(((await q.json()) as { global_ok: boolean }).global_ok).toBe(false);

    const r = makeHarness({
      env: baseEnv({ OPENROUTER_API_KEY: undefined, OPENAI_API_KEY: 'x'.repeat(30) }),
    });
    expect((await send(r)).status).toBe(429);
    expect(r.or.calls).toHaveLength(0);
    await bodyText(await send(r, { path: '/api/quota' }));
  });

  test('fingerprint: openrouter unchanged, openai is [openai, model, cap]', () => {
    const or = loadConfig(baseEnv());
    expect(or.fingerprint).toBe(
      JSON.stringify([
        or.textModels,
        or.visionModels,
        or.paidModels,
        or.paidEnabled,
        or.spendCapMicroUsd,
      ]),
    );
    expect(loadConfig(openAiEnv()).fingerprint).toBe(
      JSON.stringify(['openai', 'gpt-4.1-mini', 10_000_000]),
    );
  });

  test('OpenAiStub refuses every host other than api.openai.com', async () => {
    const s = new OpenAiStub();
    await expect(
      s.fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', body: '{}' }),
    ).rejects.toThrow(/unexpected outbound host/);
  });
});
