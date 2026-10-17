import 'fake-indexeddb/auto';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VarianceMeta } from '@aduin/core';

// Findings v2 A2-UI: use-finding-actions glue (AC-2, AC-4, AC-13). Store actions are vi.fn.
vi.mock('../../../api/client', () => ({ memoryApi: () => null, isRealMemoryApi: () => false }));
vi.mock('../../ai/ai-lane', () => ({
  aiBeginOpen: () => undefined,
  aiHolds: () => false,
  aiReopen: () => null,
  aiOnOpen: async () => ({ findings: [], fresh: false }),
  aiRunFresh: async () => undefined,
  setAiSink: () => undefined,
}));

const { useReview, memoryNotSavedNote } = await import('../../../state/review');
const { useOwners } = await import('../../variance/owner-store');
const { useFindingActions } = await import('./use-finding-actions');
const { computeOutcome } = await import('./outcome');
const h = await import('./test-helpers');
type Actions = import('./use-finding-actions').FindingActions;
type View = import('./types').ReviewView;

const DOC = {
  id: 'd1',
  name: 'Doc',
  firmId: null,
  firmName: '',
  fund: 'Fund',
  version: 'v1',
  source: 'sample' as const,
  ref: 'r',
};
const RESULT = { blocks: [{ id: 'b0', text: 'abc' }], findings: [] };

const E1 = h.fv('e1', 'critical', { order: 1 });
const E2 = h.fv('e2', 'high', { order: 2 });
const E3 = h.fv('e3', 'medium', { order: 3 });
const C1 = h.changeFv('c1', { order: 4 });
const META = { c1: { owners: ['gp'], change_type: 'changed_logic' } as unknown as VarianceMeta };

let mounted: { unmount(): void } | null = null;
const out: { current: Actions | null } = { current: null };

function Harness({ view }: { view: View }) {
  out.current = useFindingActions(view);
  return null;
}

function mount(view: View) {
  mounted = h.renderV2(<Harness view={view} />);
  return out.current!;
}

const undoFn = () => undefined;
const withToast = (msg: string) =>
  vi.fn(async () => {
    useReview.setState({ toast: { id: 1, msg, undo: undoFn } });
  });

beforeEach(() => {
  useReview.setState({ phase: 'ready' });
  useReview.setState({
    doc: DOC,
    result: RESULT as never,
    triage: {},
    toast: null,
    selectedId: null,
  });
  useOwners.setState({ docId: 'd1', choices: {} });
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  out.current = null;
});

describe('findings-v2-actions-flow', () => {
  it('should accept a blocking row, open the next To-review row and keep the store undo (AC-2, AC-4, AC-13)', async () => {
    const accept = withToast('Finding accepted.');
    const needsCounsel = vi.fn();
    useReview.setState({ accept, needsCounsel, selectedId: 'e1' });
    const view = h.makeView([E1, E2, E3]);
    const a = mount(view);
    await act(async () => {
      await a.ask('e1');
    });
    expect(accept).toHaveBeenCalledWith('e1');
    expect(needsCounsel).not.toHaveBeenCalled();
    expect(useReview.getState().selectedId).toBe('e2');
    const expected = computeOutcome({
      rows: view.rows,
      id: 'e1',
      action: 'ask-counsel',
      result: RESULT,
      policy: undefined,
    }).text;
    const toast = useReview.getState().toast!;
    expect(toast.msg).toBe(expected);
    expect(toast.msg.startsWith('Sent to counsel · Counsel questions now 1 · Gate')).toBe(true);
    expect(toast.undo).toBe(undoFn);
  });

  it('should keep the store memory note on the outcome toast for a firm-less accept (P-12)', async () => {
    const note = memoryNotSavedNote(DOC);
    expect(note).not.toBe('');
    const accept = withToast(`Finding accepted. ${note}`);
    useReview.setState({ accept, selectedId: 'e1' });
    const view = h.makeView([E1, E2, E3]);
    const a = mount(view);
    await act(async () => {
      await a.ask('e1');
    });
    const base = computeOutcome({
      rows: view.rows,
      id: 'e1',
      action: 'ask-counsel',
      result: RESULT,
      policy: undefined,
    }).text;
    expect(useReview.getState().toast!.msg).toBe(`${base.trimEnd()} ${note}`);
    expect(useReview.getState().toast!.undo).toBe(undoFn);
  });

  it('should not add a memory note when the store toast has none (P-12)', async () => {
    const needsCounsel = withToast('Added to the counsel questions draft.');
    useReview.setState({ needsCounsel });
    const a = mount(h.makeView([E1, E2, E3]));
    await act(async () => {
      await a.ask('e2');
    });
    const msg = useReview.getState().toast!.msg;
    expect(msg.startsWith('Sent to counsel')).toBe(true);
    expect(msg).not.toContain(memoryNotSavedNote(DOC));
  });

  it('should send a non-blocking row with needsCounsel(id) only (AC-2)', async () => {
    const accept = vi.fn();
    const needsCounsel = withToast('Added to the counsel questions draft.');
    useReview.setState({ accept, needsCounsel });
    const a = mount(h.makeView([E1, E2, E3]));
    await act(async () => {
      await a.ask('e2');
    });
    expect(accept).not.toHaveBeenCalled();
    expect(needsCounsel).toHaveBeenCalledTimes(1);
    expect(needsCounsel.mock.calls[0]).toEqual(['e2']);
    expect(useReview.getState().selectedId).toBe('e3');
  });

  it('should ask the suggested owners of a change row (E23)', async () => {
    const needsCounsel = withToast('x');
    useReview.setState({ needsCounsel });
    const a = mount(h.makeView([E2], {}, { changes: [C1], meta: META }));
    await act(async () => {
      await a.ask('c1');
    });
    expect(needsCounsel).toHaveBeenCalledWith('c1', { owners: ['gp'], source: 'suggested' });
  });

  it('should not call the store for a change row routed to You (owner-required)', async () => {
    const needsCounsel = vi.fn();
    useReview.setState({ needsCounsel });
    useOwners.setState({ docId: 'd1', choices: { c1: 'you' } });
    const a = mount(h.makeView([E2], {}, { changes: [C1], meta: META }));
    await act(async () => {
      await a.ask('c1');
    });
    expect(needsCounsel).not.toHaveBeenCalled();
  });

  it('should never toggle an already acted row', async () => {
    const needsCounsel = vi.fn();
    const accept = vi.fn();
    useReview.setState({ needsCounsel, accept });
    const a = mount(h.makeView([E1, E2], { e2: { status: 'counsel' } }));
    await act(async () => {
      await a.ask('e2');
      await a.closeRealIssue('e2');
    });
    expect(needsCounsel).not.toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();
  });

  it('should set busy while in flight and ignore a double click', async () => {
    let release: () => void = () => undefined;
    const accept = vi.fn(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    useReview.setState({ accept });
    mount(h.makeView([E1, E2]));
    let first: Promise<boolean> = Promise.resolve(true);
    await act(async () => {
      first = out.current!.ask('e1');
    });
    expect(out.current!.busy).toBe(true);
    let skipped: boolean | null = null;
    await act(async () => {
      skipped = await out.current!.ask('e1');
    });
    expect(skipped).toBe(false);
    expect(accept).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
      await first;
    });
    expect(out.current!.busy).toBe(false);
  });

  it('should catch a rejected action, show the save error, clear busy and keep selection (R9)', async () => {
    const accept = vi.fn(async () => {
      throw new Error('write failed');
    });
    useReview.setState({ accept, selectedId: 'e1' });
    mount(h.makeView([E1, E2]));
    let ok: boolean | null = null;
    await act(async () => {
      ok = await out.current!.ask('e1');
    });
    expect(ok).toBe(false);
    expect(out.current!.busy).toBe(false);
    expect(useReview.getState().toast?.msg).toBe('Could not save. Try again.');
    expect(useReview.getState().toast?.undo).toBeNull();
    expect(useReview.getState().selectedId).toBe('e1');
  });

  it('should move dismiss to the next To-review row, never a Sent row (R3)', async () => {
    // the store picks the next visible row by index, which here is the Sent row e3
    const dismiss = vi.fn(async () => {
      useReview.setState({ selectedId: 'e3', toast: { id: 5, msg: 'Dismissed. x', undo: undoFn } });
      return 'e3';
    });
    useReview.setState({ dismiss, selectedId: 'e2' });
    const a = mount(h.makeView([E1, E2, E3], { e3: { status: 'counsel' } }));
    await act(async () => {
      await a.closeDismiss('e2', 'tool_false_alarm', '');
    });
    expect(useReview.getState().selectedId).toBe('e1');
  });

  it('should not move selection when the analyst picked another row during the call (R12)', async () => {
    let release: () => void = () => undefined;
    const accept = vi.fn(
      () =>
        new Promise<void>((r) => {
          release = () => {
            useReview.setState({ toast: { id: 7, msg: 'Finding accepted.', undo: undoFn } });
            r();
          };
        }),
    );
    useReview.setState({ accept, selectedId: 'e1' });
    mount(h.makeView([E1, E2, E3]));
    let p: Promise<boolean> = Promise.resolve(true);
    await act(async () => {
      p = out.current!.ask('e1');
    });
    act(() => useReview.getState().select('e3'));
    await act(async () => {
      release();
      await p;
    });
    expect(useReview.getState().selectedId).toBe('e3');
  });

  it('should not reuse an older toast Undo when the store showed no new toast (R13)', async () => {
    const stale = () => undefined;
    const accept = vi.fn(async () => undefined);
    useReview.setState({ accept, toast: { id: 42, msg: 'Older.', undo: stale } });
    const a = mount(h.makeView([E1, E2]));
    await act(async () => {
      await a.closeRealIssue('e2');
    });
    expect(useReview.getState().toast!.undo).toBeNull();
  });

  it('should dismiss with reason and trimmed note, keep the store selection and show "Closed · ..." (P-4)', async () => {
    const dismiss = vi.fn(async () => {
      useReview.setState({
        selectedId: 'e3',
        toast: { id: 2, msg: 'Dismissed. x', undo: undoFn },
      });
      return 'e3';
    });
    useReview.setState({ dismiss, selectedId: 'e2' });
    const a = mount(h.makeView([E1, E2, E3]));
    await act(async () => {
      await a.closeDismiss('e2', 'other', '  why  ');
    });
    expect(dismiss).toHaveBeenCalledWith('e2', 'other', 'why');
    expect(useReview.getState().selectedId).toBe('e3');
    const toast = useReview.getState().toast!;
    expect(toast.msg.startsWith('Closed · Gate')).toBe(true);
    expect(toast.undo).toBe(undoFn);
  });

  it('should close a real issue through accept with the D12 text', async () => {
    const accept = withToast('Finding accepted.');
    useReview.setState({ accept });
    const a = mount(h.makeView([E2, E3]));
    await act(async () => {
      await a.closeRealIssue('e2');
    });
    expect(accept).toHaveBeenCalledWith('e2');
    expect(useReview.getState().toast!.msg.startsWith('Closed as a real issue · Gate')).toBe(true);
    expect(useReview.getState().selectedId).toBe('e3');
  });

  it('should move a sent row back with restore and no Undo (E3)', async () => {
    const restore = vi.fn(async () => {
      useReview.setState({ toast: { id: 3, msg: 'Finding restored.', undo: null } });
    });
    useReview.setState({ restore });
    const a = mount(h.makeView([E1, E2], { e2: { status: 'counsel' } }));
    await act(async () => {
      await a.moveBack('e2');
    });
    expect(restore).toHaveBeenCalledWith('e2');
    const toast = useReview.getState().toast!;
    expect(toast.msg.startsWith('Moved back to review · Counsel questions now 0 · Gate')).toBe(
      true,
    );
    expect(toast.undo).toBeNull();
  });

  it('should refuse to move back a row with a recorded answer (E4)', async () => {
    const restore = vi.fn();
    useReview.setState({ restore });
    const a = mount(h.makeView([E1], { e1: { status: 'accepted', counselAnswer: 'A' } }));
    await act(async () => {
      await a.moveBack('e1');
    });
    expect(restore).not.toHaveBeenCalled();
  });
});
