import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { FindingView } from '../src/engine/types';

// No-firm / read-only / memory-down Accept and Dismiss must say the decision was not remembered.
vi.mock('../src/api/client', () => ({ memoryApi: () => null, isRealMemoryApi: () => false }));
vi.mock('../src/features/ai/ai-lane', () => ({
  aiBeginOpen: () => undefined,
  aiHolds: () => false,
  aiReopen: () => null,
  aiOnOpen: async () => ({ findings: [], fresh: false }),
  aiRunFresh: async () => undefined,
  setAiSink: () => undefined,
}));

const { useReview, memoryNotSavedNote } = await import('../src/state/review');
const { useSession } = await import('../src/state/session');

const NO_FIRM = 'Saved for this document only. Pick a law firm to remember this decision.';

function fv(id: string): FindingView {
  return {
    id,
    severity: 'high',
    issue_class: 'broken_cross_reference',
    detector_kind: 'rule',
    detector_id: 'XREF',
    anchor: { docHash: 'd', blockId: 'b0', offsetStart: 0, offsetEnd: 3 },
    section_path: [],
    quote: 'abc',
    quote_snippet: 'abc',
    detail: { explanation: 'x.', facts: {}, interpretations: [] },
    confidence: 1,
    classLabel: 'Cross-reference',
    title: id,
    ref: '',
    loc: '',
    found: null,
    sensitive: [],
    order: 0,
  } as unknown as FindingView;
}

const doc = (firmId: string | null) => ({
  id: 'doc-n',
  name: 'x',
  firmId,
  firmName: '',
  fund: 'F',
  version: 'v',
  source: 'upload' as const,
  ref: 'up_n',
});

describe('memoryNotSavedNote', () => {
  it('no-firm accept and dismiss toasts end with the no-firm note', async () => {
    const findings = [fv('a1'), fv('a2')];
    useReview.setState({
      phase: 'ready',
      doc: doc(null),
      result: {
        docHash: 'doc-n',
        bytes: 1,
        blocks: [{ id: 'b0', kind: 'paragraph', text: 'abc', section: null }],
        sections: [],
        findings,
        stages: [],
        failedStage: null,
      },
      memory: null,
      triage: {},
    } as never);
    await useReview.getState().accept('a1');
    expect(useReview.getState().toast?.msg).toBe(`Finding accepted. ${NO_FIRM}`);
    await useReview.getState().dismiss('a2', 'tool_false_alarm', '');
    const msg = useReview.getState().toast?.msg ?? '';
    expect(msg.startsWith('Dismissed. ')).toBe(true);
    expect(msg.endsWith(` ${NO_FIRM}`)).toBe(true);
  });

  it('read-only session with a firm says not saved', () => {
    useSession.getState().setReadOnly(true);
    try {
      expect(memoryNotSavedNote(doc('firm-1'))).toBe('Read-only demo: not saved to memory.');
    } finally {
      useSession.getState().setReadOnly(false);
    }
  });

  it('firm doc, writable, memory up: no note', () => {
    expect(memoryNotSavedNote(doc('firm-1'))).toBe('');
  });
});
