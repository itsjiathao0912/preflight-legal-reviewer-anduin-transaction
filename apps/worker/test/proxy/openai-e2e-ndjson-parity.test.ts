// AC6 (OpenAI provider plan, M3): for an equivalent answer the OpenAI path streams the same
// NDJSON frames as the OpenRouter path; only the served `model` differs.
import { describe, expect, test } from 'vitest';
import { bodyText, frames, makeHarness, ocrBody, send } from '../fakes/harness';
import { aiAnswer, ocrAnswer, SERVED_MODEL } from '../fakes/openai-stub';
import { makeOpenAiHarness } from '../fakes/openai-harness';
import { okAi, okOcr } from '../fakes/openrouter-stub';

const FINDING = {
  candidate_id: 'c1',
  issue_class: 'ambiguity',
  severity: 'medium',
  confidence: 0.7,
  quote: 'Subject to this Section 11, the Investor agrees.',
  explanation: 'Section 11 is not defined in this document.',
  interpretations: ['Section 11 of the LPA', 'Section 11 of this agreement'],
};

/** every NDJSON frame of a response, with the provider-specific model and usage masked */
async function strip(res: Response) {
  const lines = (await bodyText(res)).split('\n').filter((l) => l.trim().length > 0);
  return lines.map((l) => {
    const f = JSON.parse(l) as Record<string, unknown>;
    return f['t'] === 'result' ? { ...f, model: 'X', data: dropUsage(f['data']) } : f;
  });
}

/** token usage legitimately differs by provider; everything else must match */
function dropUsage(d: unknown): unknown {
  if (typeof d !== 'object' || d === null) return d;
  const { usage: _u, ...rest } = d as Record<string, unknown>;
  void _u;
  return rest;
}

describe('openai-e2e-ndjson-parity (AC6)', () => {
  test('should stream the same NDJSON frames as the OpenRouter path (AI)', async () => {
    const or = makeHarness();
    or.or.reply(okAi([FINDING]));
    const a = await strip(await send(or));
    const oa = makeOpenAiHarness();
    oa.oa.reply({ answer: aiAnswer([FINDING]) });
    const raw = await send(oa);
    const b = await strip(raw.clone());
    expect((await frames(raw)).terminal).toMatchObject({
      t: 'result',
      kind: 'ai',
      model: SERVED_MODEL,
    });
    expect(a.at(-1)).toMatchObject({ t: 'result', kind: 'ai' });
    expect((a.at(-1)!['data'] as { findings: unknown[] }).findings).toHaveLength(1);
    expect(b).toEqual(a);
  });

  test('should stream the same NDJSON frames as the OpenRouter path (OCR)', async () => {
    const or = makeHarness();
    or.or.reply(okOcr());
    const a = await strip(await send(or, { path: '/api/ocr', body: ocrBody() }));
    const oa = makeOpenAiHarness();
    oa.oa.reply({ answer: ocrAnswer() });
    const b = await strip(await send(oa, { path: '/api/ocr', body: ocrBody() }));
    expect(a.at(-1)).toMatchObject({ t: 'result', kind: 'ocr' });
    expect(b).toEqual(a);
  });

  test('error frames match too (provider 5xx -> terminal error frame)', async () => {
    const or = makeHarness();
    or.or.reply({ status: 500, text: 'x' });
    const a = await bodyText(await send(or));
    const oa = makeOpenAiHarness();
    oa.oa.reply({ status: 500, text: 'x' });
    const b = await bodyText(await send(oa));
    expect(b).toBe(a);
  });
});
