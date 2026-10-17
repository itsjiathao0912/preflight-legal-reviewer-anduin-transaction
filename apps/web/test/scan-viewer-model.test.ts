import { afterEach, describe, expect, it, vi } from 'vitest';
import { highlightFor, ocrBanner, pageStatuses } from '../src/features/scan/scan-model';
import { ownedUrlCount, useScan } from '../src/features/scan/scan-store';
import { OCR_UNAVAILABLE_BUILD, OCR_UNAVAILABLE_SERVICE } from '../src/engine/ocr-queue';
import { MAX_SOURCE_PIXELS, renderImage } from '../src/engine/render-pages';
import type { EngineResult, FindingView } from '../src/engine/types';

describe('scan viewer model (06e)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('revokes every owned page URL when the next document opens (bounded memory)', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const s = useScan.getState();
    const seq = s.begin(30);
    for (let i = 0; i < 30; i++) useScan.getState().setUrl(seq, i, `blob:page-${i}`, true);
    useScan.getState().setUrl(seq, 0, '/samples/x/p01.jpg', false);
    expect(ownedUrlCount()).toBe(30);
    useScan.getState().begin(1);
    expect(ownedUrlCount()).toBe(0);
    expect(revoke).toHaveBeenCalledTimes(30);
    // a late URL for an older document is revoked immediately, never kept
    useScan.getState().setUrl(seq, 3, 'blob:late', true);
    expect(revoke).toHaveBeenLastCalledWith('blob:late');
    useScan.getState().clear();
    expect(useScan.getState().pageCount).toBe(0);
  });

  it('highlights the region of a finding on its page, else the whole page', () => {
    const f = { page: 1, region: { x: 0.05, y: 0.42, w: 0.9, h: 0.03 } } as FindingView;
    expect(highlightFor(f, 0)).toEqual({ kind: 'region', x: 0.05, y: 0.42, w: 0.9, h: 0.03 });
    expect(highlightFor(f, 1)).toBeNull();
    expect(highlightFor({ page: 1 } as FindingView, 0)).toEqual({ kind: 'page' });
    expect(highlightFor({ page: 1, region: { x: 0, y: 0, w: 1, h: 1 } } as FindingView, 0)).toEqual(
      { kind: 'page' },
    );
    expect(
      highlightFor({ page: 1, region: { x: -3, y: 2, w: 9, h: 0.1 } } as FindingView, 0),
    ).toEqual({ kind: 'region', x: 0, y: 1, w: 1, h: 0.1 });
  });

  it('marks pages below 0.6 as low confidence and picks the right OCR banner', () => {
    const r = {
      ocr: {
        pages: [
          { index: 0, state: 'done', conf: 0.42 },
          { index: 1, state: 'done', conf: 0.9 },
          { index: 2, state: 'unavailable', reason: OCR_UNAVAILABLE_SERVICE },
        ],
      },
    } as unknown as EngineResult;
    const m = pageStatuses(r, []);
    expect(m.get(0)?.low).toBe(true);
    expect(m.get(1)?.low).toBe(false);
    expect(ocrBanner(m.values())).toBe('service');
    expect(
      ocrBanner([{ index: 0, state: 'unavailable', reason: OCR_UNAVAILABLE_BUILD, low: false }]),
    ).toBe('build');
  });

  it('refuses an image decompression bomb from its header, before any decode', async () => {
    const png = new Uint8Array(33);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    const v = new DataView(png.buffer);
    v.setUint32(16, 20_000);
    v.setUint32(20, 20_000); // 400 MP declared
    expect(20_000 * 20_000).toBeGreaterThan(MAX_SOURCE_PIXELS);
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    await expect(renderImage(png)).rejects.toThrow(/too large/);
    expect(decode).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
