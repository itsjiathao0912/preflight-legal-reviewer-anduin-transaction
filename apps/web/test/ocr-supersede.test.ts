import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OcrQueueOptions } from '../src/engine/ocr-queue';

// Review fix cycle F3: a newer openDocument aborts the older OCR queue and the older load never
// writes the scan store again. F2: the queue gets aiOff from the AI consent switch.
const h = vi.hoisted(() => ({
  queue: [] as { opts: OcrQueueOptions; resolve: (v: unknown[]) => void }[],
  analyze: [] as { input: unknown; resolve: (v: unknown) => void }[],
}));

vi.mock('../src/engine/ocr-queue', async (orig) => ({
  ...(await orig<typeof import('../src/engine/ocr-queue')>()),
  runOcrQueue: (opts: OcrQueueOptions) => new Promise((resolve) => h.queue.push({ opts, resolve })),
}));
vi.mock('../src/engine/client', () => ({
  analyzeInWorker: (input: unknown) => new Promise((resolve) => h.analyze.push({ input, resolve })),
  rememberInput: () => undefined,
}));
vi.mock('../src/features/ai/ai-lane', () => ({
  aiBeginOpen: () => undefined,
  aiHolds: () => false,
  aiReopen: () => null,
  aiOnOpen: async () => ({ findings: [], fresh: false }),
  aiRunFresh: async () => undefined,
  setAiSink: () => undefined,
}));

const { useReview } = await import('../src/state/review');
const { useScan } = await import('../src/features/scan/scan-store');
const { useSession } = await import('../src/state/session');

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 0xff, 0xd9]);
const PDF = new TextEncoder().encode('%PDF-1.4\n%%EOF');
const meta = { name: 'x', source: 'upload', firmId: null } as never;
const flush = () => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
  h.queue.length = 0;
  h.analyze.length = 0;
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
  useSession.getState().setAi(true);
});

describe('ocr-supersede (F3)', () => {
  it('opening a second document aborts the first OCR queue', async () => {
    void useReview.getState().openDocument(JPEG, meta, { fileName: 'a.jpg' });
    await flush();
    expect(h.queue).toHaveLength(1);
    const first = h.queue[0]!;
    expect(first.opts.signal?.aborted).toBe(false);
    void useReview.getState().openDocument(JPEG, meta, { fileName: 'b.jpg' });
    await flush();
    expect(first.opts.signal?.aborted).toBe(true);
    expect(h.queue).toHaveLength(2);
    expect(h.queue[1]!.opts.signal?.aborted).toBe(false);
    first.resolve([{ index: 0, state: 'queued' }]);
    await flush();
    expect(h.analyze).toHaveLength(0); // the superseded load never reaches the engine
  });

  it('a superseded PDF load does not overwrite the scan store or start its OCR', async () => {
    void useReview.getState().openDocument(PDF, meta, { fileName: 'a.pdf' });
    await flush();
    expect(h.analyze).toHaveLength(1);
    void useReview.getState().openDocument(JPEG, meta, { fileName: 'b.jpg' });
    await flush();
    const seq = useScan.getState().seq;
    expect(useScan.getState().pageCount).toBe(1);
    h.analyze[0]!.resolve({
      failedStage: null,
      scanPages: [0, 1, 2],
      pageCount: 3,
      docHash: 'c'.repeat(64),
      findings: [],
      blocks: [],
      stages: [],
    });
    await flush();
    expect(useScan.getState().pageCount).toBe(1);
    expect(useScan.getState().seq).toBe(seq);
    expect(h.queue).toHaveLength(1); // only the second document's queue
  });

  it('passes aiOff to the queue when AI review is off (F2)', async () => {
    useSession.getState().setAi(false);
    void useReview.getState().openDocument(JPEG, meta, { fileName: 'c.jpg' });
    await flush();
    expect(h.queue.at(-1)!.opts.aiOff?.()).toBe(true);
  });
});
