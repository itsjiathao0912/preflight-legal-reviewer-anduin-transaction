import 'fake-indexeddb/auto';
import type { IssueClass, Severity } from '@aduin/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryApi } from '../src/api/memoryApi';
import { isPendingId } from '../src/api/outbox';
import { StubMemoryApi } from '../src/api/stubMemoryApi';
import type { EngineResult, FindingView } from '../src/engine/types';
import { buildRows, computeGate } from '../src/features/review/model';
import { appDb } from '../src/storage/db';

// The review store reads the memory client through api/client: serve the Dexie stub here.
const holder = vi.hoisted(() => ({ api: null as MemoryApi | null, real: false }));
vi.mock('../src/api/client', () => ({
  memoryApi: () => holder.api,
  isRealMemoryApi: () => holder.real,
}));

const { useReview } = await import('../src/state/review');
const { flushOutbox, memoryDown, outbox, resetMemorySyncForTest, toFindingWire } =
  await import('../src/state/memory-sync');
const { cleanAnalystName } = await import('../src/state/session');
const { MemoryApiError } = await import('../src/api/memoryApi');
const { useSession } = await import('../src/state/session');

const FIRM = 'partners-group';
const DOC_HASH = 'c'.repeat(64);
const fp = (n: number) => String(n).repeat(64).slice(0, 64);

function finding(id: string, severity: Severity = 'critical', extra: Partial<FindingView> = {}) {
  return {
    id,
    issue_class: 'broken_cross_reference' as IssueClass,
    severity,
    detector_kind: 'rule',
    detector_id: 'XREF-02',
    confidence: 0.9,
    anchor: { blockId: 'b1', offsetStart: 0, offsetEnd: 10 },
    section_path: ['Section 1'],
    quote_snippet: 'See Part B of Section 6.',
    quote_hash: 'e'.repeat(64),
    detail: { explanation: 'x', facts: {}, interpretations: [] },
    quote: 'See Part B of Section 6.',
    classLabel: 'Broken cross-reference',
    title: `Finding ${id}`,
    ref: '§1',
    loc: 'Section 1',
    found: null,
    sensitive: [],
    order: Number(id.replace(/\D/g, '')) || 0,
    ...extra,
  } as FindingView;
}

function load(firmId: string | null, findings: FindingView[]) {
  const byId: Record<string, { fingerprint: string | null; label: 'new'; prior: null }> = {};
  findings.forEach(
    (f, i) => (byId[f.id] = { fingerprint: firmId ? fp(i + 1) : null, label: 'new', prior: null }),
  );
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
    result: { docHash: DOC_HASH, findings, blocks: [], stages: [] } as unknown as EngineResult,
    memory: { byId, applied: firmId !== null, unavailable: false },
    triage: {},
    toast: null,
  });
}

let stub: StubMemoryApi;
beforeEach(async () => {
  const db = appDb()!;
  await Promise.all([db.outbox.clear(), db.decisions.clear(), db.uiState.clear()]);
  stub = new StubMemoryApi(db);
  holder.api = stub;
  holder.real = false;
  resetMemorySyncForTest();
  useSession.setState({ readOnly: false, analystName: 'Linh Tran' });
});
afterEach(async () => {
  await flushOutbox();
});

describe('review-sync', () => {
  it('should queue Accept through the outbox with an optimistic pending id and persist it on drain', async () => {
    load(FIRM, [finding('f1'), finding('f2')]);
    await useReview.getState().accept('f1');
    const t = useReview.getState().triage['f1']!;
    expect(t.status).toBe('accepted');
    expect(isPendingId(t.decisionId)).toBe(true);
    await flushOutbox();
    const [d] = await stub.lookup(FIRM, [fp(1)]);
    expect(d?.decision).toBe('accepted');
    expect(d?.decided_by_name).toBe('Linh Tran');
    expect(await outbox()!.resolveId(t.decisionId!)).toBe(d!.id);
    // Accept alone keeps a critical finding unresolved (AC22)
    const s = useReview.getState();
    expect(computeGate(buildRows(s.result!.findings, s.memory, s.triage)).reasons).toContainEqual(
      expect.objectContaining({ findingKey: 'f1', kind: 'unanswered' }),
    );
  });

  it('should revoke the decision when Accept is undone', async () => {
    load(FIRM, [finding('f1')]);
    await useReview.getState().accept('f1');
    useReview.getState().toast!.undo!();
    await vi.waitFor(async () => {
      await flushOutbox();
      expect(useReview.getState().triage['f1']).toBeUndefined();
      expect(await stub.lookup(FIRM, [fp(1)])).toEqual([]);
    });
  });

  it('should use the stored session name as decided_by_name', async () => {
    useSession.getState().setAnalystName('  Duc   Pham ');
    load(FIRM, [finding('f1')]);
    await useReview.getState().dismiss('f1', 'tool_false_alarm', '');
    await flushOutbox();
    const [d] = await stub.lookup(FIRM, [fp(1)]);
    expect(d).toMatchObject({ decision: 'dismissed', decided_by_name: 'Duc Pham' });
  });

  it('should keep triage local and write nothing for a document without a law firm', async () => {
    load(null, [finding('f1')]);
    await useReview.getState().accept('f1');
    await useReview.getState().recordAnswer('f1', { option: 'A', by: 'Counsel', at: 1 });
    expect(useReview.getState().triage['f1']).toMatchObject({
      status: 'accepted',
      decisionId: null,
      counselAnswer: 'A',
    });
    expect(await outbox()!.list()).toEqual([]);
  });

  it('F5: a 503 session bootstrap keeps triage local and enqueues nothing', async () => {
    const down = {
      onSession: () => () => undefined,
      bootstrap: () => Promise.reject(new MemoryApiError('unavailable', 'HTTP 503')),
      currentSession: () => null,
    };
    holder.api = down as unknown as MemoryApi;
    holder.real = true;
    load(FIRM, [finding('f1')]);
    await useReview.getState().accept('f1');
    expect(memoryDown()).toBe(true);
    expect(useReview.getState().triage['f1']).toMatchObject({
      status: 'accepted',
      decisionId: null,
    });
    await useReview.getState().recordAnswer('f1', { option: 'A', by: 'Counsel', at: 1 });
    expect(useReview.getState().triage['f1']?.counselAnswer).toBe('A');
    expect(await outbox()!.list()).toEqual([]);
    holder.api = stub;
    holder.real = false;
  });

  it('F6: analyst names lose control and bidi characters', () => {
    expect(cleanAnalystName('Linh\u202E Tran')).toBe('Linh Tran');
    expect(cleanAnalystName('\u200FDuc\u0000Pham\u2066')).toBe('Duc Pham');
    expect(cleanAnalystName('\u202E\u200B')).toBeNull();
    expect(cleanAnalystName('Nguyễn Văn A')).toBe('Nguyễn Văn A');
  });

  it('should skip the outbox for a read-only session', async () => {
    useSession.getState().setReadOnly(true);
    load(FIRM, [finding('f1')]);
    await useReview.getState().accept('f1');
    expect(useReview.getState().triage['f1']?.decisionId).toBeNull();
    expect(await outbox()!.list()).toEqual([]);
  });

  it('should record a clear counsel answer: question created at send time, gate resolved', async () => {
    load(FIRM, [finding('f1')]);
    await useReview.getState().accept('f1');
    await useReview
      .getState()
      .recordAnswer('f1', { option: 'B', note: ' use Section 4 ', by: 'R. Whitlock', at: 5 });
    await flushOutbox();
    const t = useReview.getState().triage['f1']!;
    expect(t).toMatchObject({
      counselAnswer: 'B',
      counselNote: 'use Section 4',
      answeredBy: 'R. Whitlock',
    });
    expect(isPendingId(t.answerId)).toBe(true);
    const ops = await outbox()!.list();
    const ans = ops.find((o) => o.kind === 'answer')!;
    expect(ans.state).toBe('synced');
    expect(ans.answer?.question_id).toMatch(/\S/);
    const [d] = await stub.lookup(FIRM, [fp(1)]);
    expect(d).toMatchObject({ decision: 'answered', counsel_option: 'B' });
    const s = useReview.getState();
    expect(computeGate(buildRows(s.result!.findings, s.memory, s.triage)).status).toBe('ready');
    expect(useReview.getState().toast?.msg).toBe('Answer recorded. The gate is now Ready.');
  });

  it('M1: reopening an answered decision from Firm memory clears the counsel answer and re-blocks the gate', async () => {
    load(FIRM, [finding('f1')]);
    await useReview.getState().accept('f1');
    await useReview.getState().recordAnswer('f1', { option: 'B', by: 'R. Whitlock', at: 5 });
    await flushOutbox();
    const gate = () => {
      const s = useReview.getState();
      return computeGate(buildRows(s.result!.findings, s.memory, s.triage));
    };
    expect(gate().status).toBe('ready');
    // triage still holds the optimistic pending id; the Memory page lists the real one
    expect(isPendingId(useReview.getState().triage['f1']!.answerId)).toBe(true);
    const [d] = await stub.lookup(FIRM, [fp(1)]);
    expect(d?.decision).toBe('answered');
    await stub.revoke(d!.id, 'counsel changed their answer');
    await useReview
      .getState()
      .refreshMemory(d!.id, { fingerprint: d!.fingerprint, decision: d!.decision });
    const t = useReview.getState().triage['f1']!;
    expect(t.counselAnswer).toBeUndefined();
    expect(t.answeredBy).toBeUndefined();
    expect(t.answerId).toBeUndefined();
    // the separate Accept is not the revoked decision: it stays
    expect(t.status).toBe('accepted');
    expect(gate().status).not.toBe('ready');
    expect(gate().reasons).toContainEqual(
      expect.objectContaining({ findingKey: 'f1', kind: 'unanswered' }),
    );
  });

  it('m1: reopening a dismissal keeps an unrelated counsel answer on the entry', async () => {
    load(FIRM, [finding('f1')]);
    useReview.setState({
      triage: {
        f1: {
          status: 'dismissed',
          decisionId: 'dec-1',
          counselAnswer: 'A',
          answeredBy: 'C',
          answerId: 'ans-1',
        },
      },
    });
    await useReview
      .getState()
      .refreshMemory('dec-1', { fingerprint: fp(1), decision: 'dismissed' });
    const t = useReview.getState().triage['f1']!;
    expect(t.status).toBe('open');
    expect(t.decisionId).toBeUndefined();
    expect(t).toMatchObject({ counselAnswer: 'A', answeredBy: 'C', answerId: 'ans-1' });
  });

  it('should keep the gate blocked for an unclear answer', async () => {
    load(FIRM, [finding('f1')]);
    await useReview.getState().needsCounsel('f1');
    await useReview.getState().recordAnswer('f1', { option: 'unclear', by: 'Counsel', at: 5 });
    const s = useReview.getState();
    expect(computeGate(buildRows(s.result!.findings, s.memory, s.triage)).reasons).toEqual([
      { findingKey: 'f1', kind: 'unclear', link: '#findings/f1' },
    ]);
    expect(s.toast?.msg).toBe('Recorded as unclear. 1 item left on the gate.');
  });

  it('should never gate on an AI-detector finding, even when critical', () => {
    load(FIRM, [finding('f1', 'critical', { detector_kind: 'ai', model: 'gemma' })]);
    const s = useReview.getState();
    expect(computeGate(buildRows(s.result!.findings, s.memory, s.triage)).status).toBe('ready');
  });

  it('should send wire findings without the full quote or display fields', () => {
    const w = toFindingWire(finding('f1'), fp(1)) as unknown as Record<string, unknown>;
    expect(w['fingerprint']).toBe(fp(1));
    for (const k of ['quote', 'classLabel', 'title', 'ref', 'loc', 'found', 'sensitive', 'order'])
      expect(w).not.toHaveProperty(k);
    expect(w['quote_snippet']).toBe('See Part B of Section 6.');
  });
});
