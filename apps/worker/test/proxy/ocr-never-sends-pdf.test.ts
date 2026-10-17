import { describe, expect, test } from 'vitest';
import { frames, makeHarness, ocrBody, send } from '../fakes/harness';
import { okOcr } from '../fakes/openrouter-stub';

const PDF_B64 = Buffer.from('%PDF-1.7\n%âã\n1 0 obj<<>>endobj\n').toString('base64');

describe('ocr-never-sends-pdf (Phase 06, AC1 support)', () => {
  test('should never send a pdf to the OCR endpoint', async () => {
    for (const mime of ['application/pdf', 'application/x-pdf', 'application/octet-stream']) {
      const h = makeHarness();
      h.or.reply(okOcr());
      const res = await send(h, {
        path: '/api/ocr',
        body: ocrBody({ mime, pages: [{ index: 0, data_b64: PDF_B64 }] }),
      });
      expect(res.status).toBe(415);
      expect(h.or.calls).toHaveLength(0);
    }
  });

  test('a pdf data URL dressed as an image is rejected before any upstream call', async () => {
    const h = makeHarness();
    h.or.reply(okOcr());
    const res = await send(h, {
      path: '/api/ocr',
      body: ocrBody({ pages: [{ index: 0, data_b64: `data:application/pdf;base64,${PDF_B64}` }] }),
    });
    expect(res.status).toBe(400);
    expect(h.or.calls).toHaveLength(0);
  });

  test('a forwarded OCR body only ever carries image_url parts, never a file part or plugin', async () => {
    const h = makeHarness();
    h.or.reply(okOcr());
    await frames(await send(h, { path: '/api/ocr' }));
    const json = h.or.calls[0]!.json;
    expect(json['plugins']).toBeUndefined();
    const parts = (
      json['messages'] as { content: { type: string; image_url?: { url: string } }[] }[]
    )[0]!.content;
    expect(parts.map((p) => p.type).sort()).toEqual(['image_url', 'text']);
    expect(parts.find((p) => p.type === 'image_url')!.image_url!.url).toMatch(
      /^data:image\/(png|jpeg);base64,/,
    );
    expect(JSON.stringify(json)).not.toMatch(/"type":"file"|application\/pdf/);
  });

  // Review F5: the declared mime is caller-controlled; the bytes must really be JPEG/PNG.
  test('pdf bytes labelled image/jpeg (or png) are refused with 415 before any upstream call', async () => {
    for (const mime of ['image/jpeg', 'image/png']) {
      const h = makeHarness();
      h.or.reply(okOcr());
      const res = await send(h, {
        path: '/api/ocr',
        body: ocrBody({ mime, pages: [{ index: 0, data_b64: PDF_B64 }] }),
      });
      expect(res.status).toBe(415);
      expect(h.or.calls).toHaveLength(0);
    }
  });
});
