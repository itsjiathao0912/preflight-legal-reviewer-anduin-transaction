// AC4 (OpenAI provider plan, M3): the OpenAI body for every text task and for OCR carries only
// OpenAI fields (no `models`, `provider`, `usage`, `max_tokens`), requests usage in the stream,
// uses gpt-4.1-mini, and its strict json_schema has no length/range keywords.
import { AI_TASK_IDS } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { MAX_TOKENS } from '../../src/upstream/models-config';
import { stripSchemaKeywords } from '../../src/upstream/openai';
import { aiBody, frames, ocrBody, send } from '../fakes/harness';
import { aiAnswer, ocrAnswer } from '../fakes/openai-stub';
import { makeOpenAiHarness, OPENAI_TEST_KEY } from '../fakes/openai-harness';

const FORBIDDEN_KEYWORDS = ['minLength', 'maxLength', 'minimum', 'maximum', 'maxItems'];
const OPENAI_KEYS = [
  'max_completion_tokens',
  'messages',
  'model',
  'response_format',
  'stream',
  'stream_options',
  'temperature',
];

function keywordsIn(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => keywordsIn(x, out));
  else if (typeof v === 'object' && v !== null)
    for (const [k, x] of Object.entries(v)) {
      if (FORBIDDEN_KEYWORDS.includes(k)) out.push(k);
      keywordsIn(x, out);
    }
  return out;
}

async function capture(kind: string) {
  const h = makeOpenAiHarness();
  if (kind === 'ocr') {
    h.oa.reply({ answer: ocrAnswer() });
    await frames(await send(h, { path: '/api/ocr', body: ocrBody() }));
  } else {
    h.oa.reply({ answer: kind === 'clause-judgment' ? aiAnswer() : '{}' });
    await (await send(h, { body: aiBody(undefined, { task: kind }) })).arrayBuffer();
  }
  expect(h.oa.calls).toHaveLength(1);
  return h.oa.calls[0]!;
}

describe('openai-request-shape (AC4)', () => {
  for (const kind of [...AI_TASK_IDS, 'ocr']) {
    test(`should build an OpenAI body without OpenRouter fields and with usage requested (${kind})`, async () => {
      const c = await capture(kind);
      expect(c.url).toBe('https://api.openai.com/v1/chat/completions');
      expect(c.headers['authorization']).toBe(`Bearer ${OPENAI_TEST_KEY}`);
      expect(c.headers['x-title']).toBeUndefined();
      expect(c.redirect).toBe('manual');
      const j = c.json;
      expect(Object.keys(j).sort()).toEqual(OPENAI_KEYS);
      expect(j['model']).toBe('gpt-4.1-mini');
      expect(j['temperature']).toBe(0);
      expect(j['stream']).toBe(true);
      expect(j['stream_options']).toEqual({ include_usage: true });
      expect(j['max_completion_tokens']).toBe(kind === 'ocr' ? MAX_TOKENS.ocr : MAX_TOKENS.ai);
      for (const f of ['models', 'provider', 'usage', 'max_tokens', 'plugins'])
        expect(j).not.toHaveProperty(f);
      const rf = j['response_format'] as {
        type: string;
        json_schema: { strict: boolean; schema: unknown };
      };
      expect(rf.type).toBe('json_schema');
      expect(rf.json_schema.strict).toBe(true);
      expect(keywordsIn(rf.json_schema.schema)).toEqual([]);
      expect(c.body).not.toContain(OPENAI_TEST_KEY);
    });
  }

  test('OCR wire schema: v as enum, bbox/conf required and nullable, no ext', async () => {
    const c = await capture('ocr');
    const s = (c.json['response_format'] as { json_schema: { schema: Record<string, unknown> } })
      .json_schema.schema;
    const text = JSON.stringify(s);
    expect(text).not.toContain('"const"');
    expect(text).not.toContain('"ext"');
    expect((s['properties'] as Record<string, unknown>)['v']).toEqual({
      type: 'integer',
      enum: [1],
    });
    expect(text).toContain('"required":["text","bbox","conf"]');
    // the image travels as a data URL part; the text prompt as a text part
    const msg = (c.json['messages'] as { content: { type: string }[] }[])[0]!;
    expect(msg.content.map((p) => p.type)).toEqual(['text', 'image_url']);
  });

  test('schema transformer: deep copy; property names are never stripped', () => {
    const src = {
      type: 'object',
      properties: { minimum: { type: 'number', minimum: 0 }, s: { type: 'string', maxLength: 3 } },
    };
    const out = stripSchemaKeywords(src) as typeof src;
    expect(out).toEqual({
      type: 'object',
      properties: { minimum: { type: 'number' }, s: { type: 'string' } },
    });
    expect(src.properties.minimum.minimum).toBe(0); // source untouched
  });
});
