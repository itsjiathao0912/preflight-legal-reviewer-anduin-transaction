// AC2 (OpenAI provider plan, M1): with AI_PROVIDER=openrouter the request body the Worker sends
// upstream is byte-identical to the body sent BEFORE the provider seam existed. The goldens are
// sha256 digests captured from the pre-change pipeline (commit 2772b69) for each AI task and OCR.
import { describe, expect, test } from 'vitest';
import { okAi, okOcr } from '../fakes/openrouter-stub';
import { aiBody, bodyText, makeHarness, ocrBody, send } from '../fakes/harness';
import { digestHex } from '../../src/upstream/openrouter';

const GOLDEN: Record<string, string> = {
  'clause-judgment': '5cce545ba1c541cf965adb61c7c01d41fc307d698240b7da00bb604a444020df',
  'counsel-draft': 'b47c6cd8806113735b2d8a8e039ec16f1310e3f14efed5fa481d52b9f5d04ff0',
  'drift-narrative': '18aecd14a901e5ff28ac2661778c8672fc21523b9b2918580a2345975af554d7',
  ocr: '71d49977c940a15012c3184c191e7b9bc1cf86aceaa8d1f21729e5a66e5639d0',
};

async function capture(kind: string): Promise<string> {
  const h = makeHarness();
  if (kind === 'ocr') {
    h.or.reply(okOcr());
    await bodyText(await send(h, { path: '/api/ocr', body: ocrBody() }));
  } else {
    h.or.reply(okAi());
    await bodyText(await send(h, { body: aiBody(undefined, { task: kind }) }));
  }
  expect(h.or.calls).toHaveLength(1);
  return digestHex(h.or.calls[0]!.body);
}

describe('openrouter-body-byte-parity (AC2)', () => {
  for (const kind of Object.keys(GOLDEN)) {
    test(`should send a byte-identical OpenRouter body (${kind})`, async () => {
      const d = await capture(kind);
      expect(d).toBe(GOLDEN[kind]);
    });
  }
});
