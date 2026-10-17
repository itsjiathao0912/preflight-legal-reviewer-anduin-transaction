import { TASKS, responseFormat, schemaInstruction } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import {
  ConfigError,
  loadConfig,
  DEFAULT_TEXT_MODELS,
  DEFAULT_VISION_MODELS,
} from '../../src/config';
import { baseEnv, frames, makeHarness, send } from '../fakes/harness';
import { okAi, okOcr } from '../fakes/openrouter-stub';

describe('free-only-config (AC26)', () => {
  test('should send only :free model ids when paid fallback is disabled', async () => {
    const h = makeHarness();
    h.or.reply(okAi(), okOcr());
    await frames(await send(h));
    await frames(await send(h, { path: '/api/ocr' }));
    expect(h.or.calls).toHaveLength(2);
    for (const c of h.or.calls) {
      expect(String(c.json['model']).endsWith(':free')).toBe(true);
      const models = c.json['models'] as string[];
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.endsWith(':free') && !m.startsWith('openrouter/'))).toBe(true);
    }
  });

  test('should never emit a file content part or file-parser plugin', async () => {
    const h = makeHarness();
    h.or.reply(okAi(), okOcr());
    await frames(await send(h));
    await frames(await send(h, { path: '/api/ocr' }));
    for (const c of h.or.calls) {
      expect(c.json).not.toHaveProperty('plugins');
      expect(c.json).not.toHaveProperty('tools');
      expect(c.json).not.toHaveProperty('provider');
      expect(c.body).not.toContain('"type":"file"');
      expect(c.body).not.toContain('file-parser');
      expect(c.json['temperature']).toBe(0);
      expect((c.json['response_format'] as { type: string }).type).toBe('json_schema');
    }
    expect(h.or.calls[0]!.json['max_tokens']).toBe(10_000);
    expect(h.or.calls[1]!.json['max_tokens']).toBe(8000);
    const ocrContent = (
      h.or.calls[1]!.json['messages'] as {
        content: { type: string; image_url?: { url: string } }[];
      }[]
    )[0]!.content;
    expect(ocrContent.map((p) => p.type)).toEqual(['text', 'image_url']);
    expect(ocrContent[1]!.image_url!.url.startsWith('data:image/png;base64,')).toBe(true);
  });

  test('defaults are free-only', () => {
    const c = loadConfig({});
    expect([...c.textModels, ...c.visionModels].every((m) => m.endsWith(':free'))).toBe(true);
    expect(c.textModels.join(',')).toBe(DEFAULT_TEXT_MODELS);
    expect(c.visionModels.join(',')).toBe(DEFAULT_VISION_MODELS);
    expect(c.paidEnabled).toBe(false);
    expect(c.paidModels).toEqual([]);
  });

  test('Phase 05 defaults: the single free text model and strict json_schema mode', () => {
    const c = loadConfig({});
    expect(DEFAULT_TEXT_MODELS).toBe('nvidia/nemotron-3-super-120b-a12b:free');
    expect(c.textModels).toEqual(['nvidia/nemotron-3-super-120b-a12b:free']);
    expect(c.textModels.some((m) => m.startsWith('openrouter/'))).toBe(false);
    expect(c.aiResponseMode).toBe('json_schema');
    expect(loadConfig({ AI_RESPONSE_MODE: 'json_object' }).aiResponseMode).toBe('json_object');
  });

  test('AI response_format is the core task schema (strict), not the AiResult envelope', async () => {
    const h = makeHarness();
    h.or.reply(okAi());
    await frames(await send(h));
    expect(h.or.calls[0]!.json['response_format']).toEqual(
      responseFormat(TASKS['clause-judgment'], 'json_schema'),
    );
  });

  test('json_object mode: response_format json_object + schema instruction as last system message', async () => {
    const h = makeHarness({ env: baseEnv({ AI_RESPONSE_MODE: 'json_object' }) });
    h.or.reply(okAi());
    const { terminal } = await frames(await send(h));
    expect(terminal).toMatchObject({ t: 'result', cache: 'miss' });
    const c = h.or.calls[0]!;
    expect(c.json['response_format']).toEqual({ type: 'json_object' });
    const msgs = c.json['messages'] as { role: string; content: string }[];
    expect(msgs.at(-1)).toEqual(schemaInstruction(TASKS['clause-judgment']));
  });

  const bad: [string, Record<string, string>][] = [
    ['non-free text id', { AI_TEXT_MODELS: 'meta/llama-4' }],
    ['mixed list', { AI_TEXT_MODELS: 'a/b:free,meta/llama-4' }],
    ['router id', { AI_TEXT_MODELS: 'openrouter/auto' }],
    ['router id with :free', { AI_VISION_MODELS: 'openrouter/free:free' }],
    ['router id in paid list', { AI_PAID_MODELS: 'openrouter/auto' }],
    ['empty after trim', { AI_TEXT_MODELS: ' , ' }],
    ['http base url', { OPENROUTER_BASE_URL: 'http://openrouter.ai/api/v1' }],
    ['other host', { OPENROUTER_BASE_URL: 'https://evil.example/api/v1' }],
    ['lookalike host', { OPENROUTER_BASE_URL: 'https://openrouter.ai.evil.example/api/v1' }],
    ['credentials in url', { OPENROUTER_BASE_URL: 'https://u:p@openrouter.ai/api/v1' }],
    [
      'kid not in map',
      { COOKIE_SIGNING_KEYS: JSON.stringify({ a: 'x'.repeat(40) }), COOKIE_SIGNING_KID: 'b' },
    ],
    [
      'short cookie key',
      { COOKIE_SIGNING_KEYS: JSON.stringify({ a: 'short' }), COOKIE_SIGNING_KID: 'a' },
    ],
    ['uploads flag not exact', { AI_UPLOADS_ENABLED: 'yes' }],
    ['response mode not exact', { AI_RESPONSE_MODE: 'JSON_SCHEMA' }],
    ['unknown response mode', { AI_RESPONSE_MODE: 'text' }],
  ];
  for (const [name, env] of bad) {
    test(`config load throws: ${name}`, () => {
      expect(() => loadConfig(env)).toThrow(ConfigError);
    });
  }

  test('an invalid config fails closed with no upstream call', async () => {
    const h = makeHarness({ env: baseEnv({ AI_TEXT_MODELS: 'meta/llama-4' }) });
    const res = await send(h);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      error: { code: 'quota_exhausted', reason: 'ai_unavailable' },
    });
    expect(h.or.calls).toHaveLength(0);
  });

  test('client settings.model_tier never becomes a model id', async () => {
    const h = makeHarness();
    h.or.reply(okAi());
    await frames(
      await send(h, {
        body: {
          v: 1,
          law_firm_id: null,
          candidates: [{ id: 'c', quote: 'q', section_path: [] }],
          settings: { model_tier: 'openai/gpt-5' },
        },
      }),
    );
    expect(h.or.calls[0]!.body).not.toContain('gpt-5');
  });
});
