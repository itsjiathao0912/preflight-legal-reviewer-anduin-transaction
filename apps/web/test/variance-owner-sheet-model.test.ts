import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { FindingView } from '../src/engine/types';

// Variance Phase 04 (B1, B3, B4, C1, E3): owner answer states, "You" is local-only, per-owner sheets,
// and no change-kind question ever reaches the AI draft call.
const h = vi.hoisted(() => ({ enqueued: [] as string[] }));
vi.mock('../src/api/client', () => ({ memoryApi: () => null, isRealMemoryApi: () => false }));
vi.mock('../src/features/ai/ai-lane', () => ({
  aiBeginOpen: () => undefined,
  aiHolds: () => false,
  aiReopen: () => null,
  aiOnOpen: async () => ({ findings: [], fresh: false }),
  aiRunFresh: async () => undefined,
  setAiSink: () => undefined,
}));
vi.mock('../src/state/memory-sync', async (orig) => {
  const real = await orig<typeof import('../src/state/memory-sync')>();
  const box = new Proxy(
    {},
    {
      get: (_t, k) => async () => {
        h.enqueued.push(String(k));
        return null;
      },
    },
  );
  return { ...real, outbox: () => box, writesDisabled: () => false, memoryDown: () => false };
});

const { buildRows } = await import('../src/features/review/model');
const { reviewGate, mergeFindings, setVarianceSource } =
  await import('../src/features/variance/select');
const sheet = await import('../src/features/counsel/sheet-model');
const { choiceOwners, questionItems } = await import('../src/features/variance/owner-groups');
const { useReview } = await import('../src/state/review');

const POLICY = {
  untriaged_change_blocks: true,
  asked_unanswered_blocks: true,
  regression_blocks: true,
};
function fv(id: string, extra: Partial<FindingView> = {}) {
  return {
    id,
    severity: 'critical',
    issue_class: 'broken_cross_reference',
    detector_kind: 'rule',
    detector_id: 'XREF',
    anchor: { docHash: 'd', blockId: 'b0', offsetStart: 0, offsetEnd: 3 },
    section_path: ['Section 1'],
    quote: `quote ${id}`,
    quote_snippet: 'q',
    quote_hash: 'b'.repeat(64),
    detail: { explanation: 'x.', facts: {}, interpretations: [] },
    title: id,
    loc: 'Section 1',
    order: 0,
    ...extra,
  } as unknown as FindingView;
}
const change = (id: string) =>
  fv(id, {
    severity: 'medium',
    kind: 'change',
    issue_class: 'version_drift',
    detector_id: 'variance.x',
    detail: {
      explanation: 'x.',
      facts: {},
      interpretations: ['The new text is intended.', 'Remove it.', 'Needs changes.'],
    },
  });
const gateOf = (triage: Record<string, unknown>) =>
  reviewGate(buildRows([change('c1')], null, triage as never), { blocks: [1] }, POLICY);

describe('variance-owner-sheet-model', () => {
  it('asked-unanswered: a present null key blocks with awaiting_counsel for that owner', () => {
    const g = gateOf({ c1: { status: 'counsel', ownerAnswers: { gp: null } } });
    expect(g.reasons).toEqual([
      expect.objectContaining({ findingKey: 'c1', owner: 'gp', kind: 'awaiting_counsel' }),
    ]);
  });

  it('one-of-two answered keeps the finding blocking (awaiting_counsel for the other owner)', () => {
    const g = gateOf({ c1: { status: 'counsel', ownerAnswers: { gp: 'A', counsel: null } } });
    expect(g.status).toBe('blocked');
    expect(g.reasons.map((r) => [r.owner, r.kind])).toEqual([['counsel', 'awaiting_counsel']]);
    // counselAnswer is never the path for change findings: a stray A does not resolve it
    const g2 = gateOf({
      c1: { status: 'counsel', counselAnswer: 'A', ownerAnswers: { gp: 'A', counsel: null } },
    });
    expect(g2.status).toBe('blocked');
  });

  it('"unclear" stays blocking; every owner A/B/C resolves', () => {
    expect(
      gateOf({ c1: { status: 'counsel', ownerAnswers: { gp: 'unclear' } } }).reasons[0]!.kind,
    ).toBe('unclear');
    expect(
      gateOf({ c1: { status: 'counsel', ownerAnswers: { gp: 'B', counsel: 'C' } } }).status,
    ).toBe('ready');
  });

  it('"You" never produces an outbox op or a question key', async () => {
    expect(choiceOwners('you')).toEqual([]);
    const c = change('c1');
    setVarianceSource(() => ({ findings: [c], policy: POLICY }));
    useReview.setState({
      phase: 'ready',
      doc: {
        id: 'd'.repeat(64),
        name: 'x',
        firmId: 'hartwell-crane',
        firmName: 'H',
        fund: 'Fund III',
        version: '',
        source: 'upload',
        ref: 'x',
      },
      result: { findings: [], blocks: [{}] } as never,
      triage: {},
    });
    h.enqueued.length = 0;
    await useReview.getState().needsCounsel('c1', { owners: [], source: 'override' });
    const t = useReview.getState().triage.c1;
    expect(t?.ownerAnswers).toBeUndefined();
    const rows = buildRows(mergeFindings([], [c]), null, useReview.getState().triage);
    expect(questionItems(rows)).toEqual([]);
    expect(h.enqueued).toEqual([]);
    // a real owner writes the asked marker at the click (H5), still no outbox op
    await useReview.getState().needsCounsel('c1', { owners: [], source: 'override' }); // toggle off
    await useReview.getState().needsCounsel('c1', { owners: ['gp'], source: 'override' });
    expect(useReview.getState().triage.c1?.ownerAnswers).toEqual({ gp: null });
    expect(useReview.getState().triage.c1?.ownerSource).toBe('override');
    expect(h.enqueued).toEqual([]);
    setVarianceSource(() => ({ findings: [], policy: undefined }));
  });

  it('per-owner sheet: only that owner, keyed <findingId>@<owner>, deterministic change options', () => {
    const rows = buildRows(mergeFindings([fv('e1')], [change('c1')]), null, {
      e1: { status: 'counsel' },
      c1: { status: 'counsel', ownerAnswers: { gp: null, counsel: null } },
    });
    const meta = { title: 'Q', firm: null, fund: 'Fund III', version: null };
    const gp = sheet.buildSheet(meta, rows, 'gp');
    expect(gp.meta.owner).toBe('gp');
    expect(gp.questions.map((q) => q.findingKey)).toEqual(['c1@gp']);
    expect(gp.questions[0]!.interpretations[0]).toBe('The new text is intended.');
    const counsel = sheet.buildSheet(meta, rows, 'counsel');
    expect(counsel.questions.map((q) => q.findingKey)).toEqual(['e1', 'c1@counsel']);
    expect(sheet.buildSheet(meta, rows, 'fund_admin').questions).toEqual([]);
    const all = sheet.buildSheet(meta, rows);
    expect(all.questions.map((q) => [q.number, q.findingKey])).toEqual([
      [1, 'e1'],
      [2, 'c1@counsel'],
      [3, 'c1@gp'],
    ]);
  });

  it('should never request an AI draft for a change question', () => {
    const rows = buildRows(mergeFindings([fv('e1')], [change('c1')]), null, {
      e1: { status: 'counsel' },
      c1: { status: 'counsel', ownerAnswers: { gp: null } },
    });
    const qs = sheet.questionRows(rows);
    expect(qs.map((r) => r.f.id)).toEqual(['e1', 'c1']);
    // the list handed to fetchAiDrafts (CounselScreen.toggleAi) holds no change-kind question
    const toAi = sheet.aiDraftRows(qs);
    expect(toAi.map((r) => r.f.id)).toEqual(['e1']);
    expect(toAi.some((r) => r.f.kind === 'change')).toBe(false);
    // and an AI draft stored under a change id is never shown (template only)
    const c1 = rows.find((r) => r.f.id === 'c1')!;
    const w = sheet.baseWording(c1, {
      edits: {},
      ai: { c1: 'AI text' },
      aiModel: 'm',
      useAi: true,
    });
    expect(w.source).toBe('template');
  });
});
