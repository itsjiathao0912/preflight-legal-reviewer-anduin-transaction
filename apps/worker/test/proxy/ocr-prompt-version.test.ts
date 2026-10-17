import { OcrResultSchema, cacheKey } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { okOcr } from '../fakes/openrouter-stub';
import { frames, makeHarness, ocrBody, send } from '../fakes/harness';
import { PROMPT_VER, SCHEMA_VER } from '../../src/upstream/models-config';
import { ocrMessages, ocrResponseFormat } from '../../src/upstream/openrouter';
import { digestHex } from '../../src/upstream/openrouter';
import { DEFAULT_VISION_MODELS } from '../../src/config';

/** The prompt text sent upstream (first text part of the OCR user message). */
function promptText(): string {
  const msgs = JSON.parse(
    ocrMessages({ mime: 'image/png', pages: [{ index: 0, data_b64: 'AAAA' }] }),
  ) as { content: { type: string; text?: string }[] }[];
  return msgs[0]!.content.find((c) => c.type === 'text')!.text!;
}

describe('ocr-prompt-version (Phase 06 D1)', () => {
  test('should request ocr2 and stay inside the frozen OCR schema', () => {
    expect(PROMPT_VER.ocr).toBe('ocr2');
    const p = promptText();
    // D1 prompt rules
    expect(p).toMatch(/one line per visual row/i);
    expect(p).toContain('☐');
    expect(p).toContain('☒');
    expect(p).toContain('^{n}');
    expect(p).toMatch(/report only what is visibly printed/i);
    expect(p).toMatch(/untrusted DATA/);
    // only fields that exist in the frozen schema are requested
    const line = (
      OcrResultSchema.shape.pages.element.shape.lines.element as unknown as {
        shape: Record<string, unknown>;
      }
    ).shape;
    expect(Object.keys(line).sort()).toEqual(['bbox', 'conf', 'text']);
    for (const f of ['bbox', 'conf', 'text']) expect(p).toContain(f);
    // no field names outside the frozen schema (D1 deleted options[]/footnotes[])
    for (const forbidden of ['options', 'footnotes', 'checkbox_state', 'markers:', 'set markers'])
      expect(p).not.toContain(forbidden);
    // response format is still generated from the frozen schema
    const rf = JSON.parse(ocrResponseFormat()) as {
      json_schema: { name: string; strict: boolean };
    };
    expect(rf.json_schema).toMatchObject({ name: 'ocr_result', strict: true });
    // the free Nvidia vision grammar rejects `propertyNames` (Phase 06a live probe)
    expect(ocrResponseFormat()).not.toContain('propertyNames');
  });

  test('the OCR cache key carries prompt_ver ocr2', async () => {
    const h = makeHarness();
    h.or.reply(okOcr());
    await frames(await send(h, { path: '/api/ocr' }));
    const forwarded = JSON.stringify(h.or.calls[0]!.json['messages']);
    const expected = cacheKey({
      kind: 'ocr',
      input_hash: await digestHex(forwarded),
      model: DEFAULT_VISION_MODELS.split(',')[0]!,
      prompt_ver: 'ocr2',
      schema_ver: SCHEMA_VER,
      rules_hash: 'none',
    });
    expect([...h.platform.cacheMap.keys()]).toEqual([expected]);
    expect(ocrBody().mime).toBe('image/png');
  });
});
