import 'fake-indexeddb/auto';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryApi } from '../../../api/memoryApi';
import { StubMemoryApi } from '../../../api/stubMemoryApi';
import type { EngineResult, FindingView } from '../../../engine/types';
import { appDb } from '../../../storage/db';

// Findings v2 AC-13, AC-B3: the simulated D12 outcome (computed BEFORE the store action) equals the
// real recompute AFTER the real store action (real useReview, real useReviewView, stub memory API;
// pattern test/review-sync.test.ts). Nothing in the store is mocked.
const holder = vi.hoisted(() => ({ api: null as MemoryApi | null }));
vi.mock('../../../api/client', () => ({
  memoryApi: () => holder.api,
  isRealMemoryApi: () => false,
}));
vi.mock('../../ai/ai-lane', () => ({
  aiBeginOpen: () => undefined,
  aiHolds: () => false,
  aiReopen: () => null,
  aiOnOpen: async () => ({ findings: [], fresh: false }),
  aiRunFresh: async () => undefined,
  setAiSink: () => undefined,
}));

const { useReview } = await import('../../../state/review');
const { flushOutbox, resetMemorySyncForTest } = await import('../../../state/memory-sync');
const { useSession } = await import('../../../state/session');
const { useReviewView } = await import('../use-review-view');
const { useFindingActions } = await import('./use-finding-actions');
const { computeOutcome } = await import('./outcome');
const { questionRows } = await import('../../counsel/sheet-model');
const h = await import('./test-helpers');
type Actions = import('./use-finding-actions').FindingActions;
type View = import('./types').ReviewView;
type Triage = import('../model').Triage;

const FIRM = 'partners-group';
const DOC_HASH = 'c'.repeat(64);
const fp = (n: number) => String(n).repeat(64).slice(0, 64);

function load(findings: FindingView[], triage: Record<string, Triage> = {}, firmId = FIRM) {
  const byId: Record<string, { fingerprint: string | null; label: 'new'; prior: null }> = {};
  findings.forEach((f, i) => (byId[f.id] = { fingerprint: fp(i + 1), label: 'new', prior: null }));
  useReview.setState({
    phase: 'ready',
    doc: {
      id: DOC_HASH,
      name: 'PG NGI 2026',
      firmId,
      firmName: firmId ? 'Partners Group' : '',
      fund: 'Next Generation Infrastructure',
      version: '2026',
      source: 'sample',
      ref: '05',
    },
    result: {
      docHash: DOC_HASH,
      findings,
      blocks: [{ id: 'b0', kind: 'paragraph', text: 'x', section: null }],
      stages: [],
    } as unknown as EngineResult,
    memory: { byId, applied: true, unavailable: false },
    triage,
    selectedId: findings[0]?.id ?? null,
    toast: null,
  });
}

const live: { view: View | null; actions: Actions | null } = { view: null, actions: null };
function Harness() {
  const view = useReviewView();
  live.view = view;
  live.actions = useFindingActions(view);
  return null;
}

let mounted: { unmount(): void } | null = null;
let stub: StubMemoryApi;

beforeEach(async () => {
  h.installDomStubs();
  const db = appDb()!;
  await Promise.all([db.outbox.clear(), db.decisions.clear(), db.uiState.clear()]);
  stub = new StubMemoryApi(db);
  holder.api = stub;
  resetMemorySyncForTest();
  useSession.setState({ readOnly: false, analystName: 'Linh Tran' });
});
afterEach(async () => {
  mounted?.unmount();
  mounted = null;
  live.view = null;
  live.actions = null;
  await flushOutbox();
});

type Act =
  | { action: 'ask-counsel' }
  | { action: 'close-real-issue' }
  | { action: 'close-dismiss'; reason: 'tool_false_alarm' | 'no_form_impact' }
  | { action: 'move-back' };

/** Simulate on the live view, run the real action, then recompute from the real post-action state. */
async function parity(id: string, a: Act) {
  mounted = h.renderV2(<Harness />);
  const before = live.view!;
  const sim = computeOutcome({
    rows: before.rows,
    id,
    action: a.action,
    ...(a.action === 'close-dismiss' ? { reason: a.reason } : {}),
    result: useReview.getState().result,
    policy: before.variance?.gatePolicy,
  });
  await act(async () => {
    const x = live.actions!;
    if (a.action === 'ask-counsel') await x.ask(id);
    else if (a.action === 'close-real-issue') await x.closeRealIssue(id);
    else if (a.action === 'close-dismiss') await x.closeDismiss(id, a.reason, '');
    else await x.moveBack(id);
  });
  const after = live.view!;
  expect(after).not.toBe(before);
  // the real recompute (same selectors as the pill and the counsel sheet)
  expect({
    questionCount: questionRows(after.rows).length,
    gateAfter: after.gate.status,
    gateReasons: after.gate.reasons.length,
    unreadable: after.gate.unreadable,
  }).toEqual({
    questionCount: sim.questionCount,
    gateAfter: sim.gateAfter,
    gateReasons: sim.gateReasons,
    unreadable: sim.unreadable,
  });
  // the simulated row status equals the status the store wrote
  const simRow = after.rows.find((r) => r.f.id === id)!;
  expect(simRow.status).toBe(useReview.getState().triage[id]?.status ?? 'open');
  // the toast shows exactly the simulated D12 text (a firm doc with memory carries no note)
  expect(useReview.getState().toast?.msg).toBe(sim.text);
  return { sim, after };
}

describe('findings-v2-store-parity', () => {
  it('ask counsel on a blocking row: accepted, one question, gate still blocked', async () => {
    load([h.fv('f1', 'critical', { order: 1 }), h.fv('f2', 'high', { order: 2 })]);
    const { sim, after } = await parity('f1', { action: 'ask-counsel' });
    expect(useReview.getState().triage['f1']?.status).toBe('accepted');
    expect(sim.text).toBe('Sent to counsel · Counsel questions now 1 · Gate still blocked (1)');
    expect(after.gate.status).toBe('blocked');
  });

  it('ask counsel on a non-blocking row: Needs counsel, one question, gate unchanged', async () => {
    load([h.fv('f1', 'high', { order: 1 }), h.fv('f2', 'medium', { order: 2 })]);
    const { sim } = await parity('f1', { action: 'ask-counsel' });
    expect(useReview.getState().triage['f1']?.status).toBe('counsel');
    expect(sim.questionCount).toBe(1);
  });

  it('close as a real issue on a non-blocking row: accepted, no question', async () => {
    load([h.fv('f1', 'high', { order: 1 }), h.fv('f2', 'critical', { order: 2 })]);
    const { sim } = await parity('f1', { action: 'close-real-issue' });
    expect(useReview.getState().triage['f1']?.status).toBe('accepted');
    expect(sim.questionCount).toBe(0);
    expect(sim.text).toBe('Closed as a real issue · Gate still blocked (1)');
  });

  it('dismiss the last blocker: the gate turns ready', async () => {
    load([h.fv('f1', 'critical', { order: 1 }), h.fv('f2', 'medium', { order: 2 })]);
    const { sim, after } = await parity('f1', {
      action: 'close-dismiss',
      reason: 'tool_false_alarm',
    });
    expect(sim.text).toBe('Closed · Gate now ready');
    expect(after.gate.status).toBe('ready');
  });

  it('dismiss one of two blockers: gate still blocked with one reason', async () => {
    load([h.fv('f1', 'critical', { order: 1 }), h.fv('f2', 'critical', { order: 2 })]);
    const { sim } = await parity('f1', { action: 'close-dismiss', reason: 'no_form_impact' });
    expect(sim.text).toBe('Closed · Gate still blocked (1)');
  });

  it('move back a sent blocking row: the question goes, the gate is recomputed', async () => {
    load([h.fv('f1', 'critical', { order: 1 })], { f1: { status: 'accepted' } });
    const { sim } = await parity('f1', { action: 'move-back' });
    expect(useReview.getState().triage['f1']?.status).toBe('open');
    expect(sim.text).toBe(
      'Moved back to review · Counsel questions now 0 · Gate still blocked (1)',
    );
  });

  it('move back a dismissed blocker: the gate turns blocked again', async () => {
    load([h.fv('f1', 'critical', { order: 1 })], {
      f1: { status: 'dismissed', reasonCode: 'tool_false_alarm' },
    });
    const { sim } = await parity('f1', { action: 'move-back' });
    expect(sim.gateBefore).toBe('ready');
    expect(sim.text).toBe('Moved back to review · Counsel questions now 0 · Gate now blocked (1)');
  });

  it('dismiss lands on the next To-review row, not on the Sent row the store picked (R3)', async () => {
    load(
      [
        h.fv('f1', 'high', { order: 1 }),
        h.fv('f2', 'high', { order: 2 }),
        h.fv('f3', 'high', { order: 3 }),
      ],
      { f3: { status: 'counsel' } },
    );
    useReview.setState({ selectedId: 'f2' });
    await parity('f2', { action: 'close-dismiss', reason: 'tool_false_alarm' });
    expect(useReview.getState().triage['f2']?.status).toBe('dismissed');
    expect(useReview.getState().selectedId).toBe('f1');
  });
});
