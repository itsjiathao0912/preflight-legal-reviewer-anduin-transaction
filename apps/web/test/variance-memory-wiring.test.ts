import 'fake-indexeddb/auto';
import { fingerprintFor, questionKey, type ActiveDecision, type FindingWire } from '@aduin/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryApiError,
  type AnswerInput,
  type MemoryApi,
  type QuestionItem,
} from '../src/api/memoryApi';
import type { FindingView } from '../src/engine/types';
import type { DocMeta } from '../src/state/review';

// Variance Phase 04 (H1, H2(b), H3, H4 sentinel, H8, H9): change rows reach memory with a local
// fingerprint, the composite question key survives the outbox and export, the client label matches
// the Worker rule for fund scope (M2), intent '' is never sent, and finding_too_large is non-fatal.
type Enq = { input: AnswerInput; question?: Omit<QuestionItem, 'client_op_id'> };
const h = vi.hoisted(() => ({
  answers: [] as Enq[],
  decides: [] as unknown[],
  throwAnswer: null as Error | null,
  provider: null as null | ((key: { doc_hash: string }, keys: string[]) => FindingWire[]),
  api: null as MemoryApi | null,
  downloads: [] as string[],
  resolved: {} as Record<string, string>,
}));
vi.mock('../src/api/client', () => ({ memoryApi: () => h.api, isRealMemoryApi: () => false }));
vi.mock('../src/lib/download', () => ({ downloadBlob: (n: string) => void h.downloads.push(n) }));
vi.mock('../src/features/metrics/metrics-store', () => ({
  recordExport: async () => null,
  recordOpen: async () => undefined,
}));
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
  const box = {
    enqueueAnswer: async (_d: unknown, input: AnswerInput, question?: Enq['question']) => {
      if (h.throwAnswer) throw h.throwAnswer;
      h.answers.push({ input, ...(question ? { question } : {}) });
      return `pending:${input.client_op_id}`;
    },
    enqueueDecide: async (...a: unknown[]) => {
      h.decides.push(a);
      return 'pending:d';
    },
    enqueueRevoke: async () => 'skipped',
    resolveId: async (id: string) => h.resolved[id] ?? null,
  };
  return {
    ...real,
    outbox: () => box,
    writesDisabled: () => false,
    memoryDown: () => false,
    ensureSession: async () => undefined,
    ensureSessionWithin: async () => undefined,
    flushOutbox: async () => undefined,
    setFindingsProvider: (fn: typeof h.provider) => {
      h.provider = fn;
    },
  };
});

const { useReview } = await import('../src/state/review');
const { setVarianceSource, mergeFindings } = await import('../src/features/variance/select');
const { buildRows } = await import('../src/features/review/model');
const { fingerprintFindings, fundScopeName, NO_FUND_SCOPE } =
  await import('../src/memory/fingerprintFindings');
const { fetchRegression, regressionFingerprints, ZERO_FINGERPRINT } =
  await import('../src/features/variance/regression-client');
const { intentError, INTENT_MASKED_TEXT } = await import('../src/features/counsel/AnswerForm');
const { buildSheet } = await import('../src/features/counsel/sheet-model');
const { exportCounselSheet, NOT_RECORDED_NOTE } =
  await import('../src/features/counsel/export-flow');
const { Outbox } = await import('../src/api/outbox');
const { AppDb } = await import('../src/storage/db');

const FIRM = 'hartwell-crane';
const DOC: DocMeta = {
  id: 'd'.repeat(64),
  name: 'Fund III.html',
  firmId: FIRM,
  firmName: 'Hartwell & Crane LLP',
  fund: 'Fund III',
  version: '',
  source: 'upload',
  ref: 'u1',
};
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
    anchor: { docHash: DOC.id, blockId: 'b0', offsetStart: 0, offsetEnd: 3 },
    section_path: ['Section 2'],
    quote: `Quote ${id}.`,
    quote_snippet: `Quote ${id}.`,
    quote_hash: (id.charCodeAt(0) % 10).toString().repeat(64),
    detail: { explanation: 'x.', facts: {}, interpretations: [] },
    confidence: 1,
    classLabel: 'x',
    title: id,
    ref: '',
    loc: 'Section 2',
    found: null,
    sensitive: [],
    order: 0,
    ...extra,
  } as unknown as FindingView;
}
const CHANGE = fv('f_change', {
  severity: 'medium',
  kind: 'change',
  issue_class: 'version_drift',
  detector_id: 'variance.add',
  quote: 'Singapore is also accepted as a domicile.',
  quote_hash: 'c'.repeat(64),
  detail: {
    explanation: 'x.',
    facts: {},
    interpretations: ['Keep it.', 'Remove it.', 'Change it.'],
  },
});
const ERROR = fv('f_err');

function ready(triage = {}) {
  setVarianceSource(() => ({ findings: [CHANGE], policy: POLICY }));
  useReview.setState({
    phase: 'ready',
    doc: DOC,
    result: { docHash: DOC.id, findings: [ERROR], blocks: [{}] } as never,
    memory: {
      byId: { f_err: { fingerprint: fingerprintFor(ERROR, FIRM), label: 'new', prior: null } },
      applied: true,
      unavailable: false,
    },
    triage,
  });
}
const answer = (extra = {}) => ({ option: 'A' as const, note: '', by: 'GP desk', at: 1, ...extra });

beforeEach(() => {
  h.answers.length = 0;
  h.decides.length = 0;
  h.throwAnswer = null;
  h.api = null;
  h.resolved = {};
});

describe('variance-memory-wiring', () => {
  it('should fingerprint and wire a change row for an answer, send the composite finding_ref with plain finding_keys, and keep dismissals of change rows local', async () => {
    ready({ f_change: { status: 'counsel', ownerAnswers: { gp: null }, ownerSource: 'override' } });
    await useReview.getState().recordAnswer('f_change', answer({ scope: 'fund' }), 'gp');
    expect(h.answers).toHaveLength(1);
    const { input, question } = h.answers[0]!;
    const fp = fingerprintFor(CHANGE, FIRM)!;
    expect(input.fingerprint).toBe(fp);
    expect(input.issue_class).toBe('version_drift');
    expect(question).toMatchObject({
      finding_ref: questionKey('f_change', 'gp'),
      fingerprint: fp,
      owner: 'gp',
      owner_source: 'override',
      interpretations: ['Keep it.', 'Remove it.', 'Change it.'],
    });
    // the change row's wire is available to the outbox by its PLAIN id (H1)
    const wires = h.provider!({ doc_hash: DOC.id }, ['f_change']);
    expect(wires.map((w) => [w.id, w.fingerprint])).toEqual([['f_change', fp]]);
    // per-owner state: ownerAnswers authoritative, counselAnswer untouched, id per owner
    const t = useReview.getState().triage.f_change!;
    expect(t.ownerAnswers).toEqual({ gp: 'A' });
    expect(t.counselAnswer).toBeUndefined();
    expect(t.ownerAnswerIds?.gp).toMatch(/^pending:/);
    // "Mark as expected" on a change row stays local: no outbox op (decide unchanged)
    await useReview.getState().dismiss('f_change', 'expected_variation' as never, '');
    expect(h.decides).toEqual([]);
  });

  it('the outbox stores the plain finding id in finding_keys for a composite question key', async () => {
    const db = new AppDb(`wiring-${Math.random()}`);
    const box = new Outbox({ db, api: () => null, findingsFor: async () => [] });
    await box.enqueueAnswer(
      { doc_name: 'x', doc_hash: DOC.id, law_firm_id: FIRM, settings_hash: 'e'.repeat(64) },
      {
        client_op_id: 'op_aaaaaaaaaaaaaaaa',
        law_firm_id: FIRM,
        fingerprint: 'c'.repeat(64),
        issue_class: 'version_drift',
        counsel_option: 'A',
        decided_by_name: 'x',
      },
      {
        finding_ref: questionKey('f_change', 'gp'),
        fingerprint: 'c'.repeat(64),
        interpretations: ['a'],
      },
    );
    const rows = await db.outbox.toArray();
    const op = rows[0]!.op as { finding_keys: string[]; question?: { finding_ref: string } };
    expect(op.finding_keys).toEqual(['f_change']);
    expect(op.question?.finding_ref).toBe('f_change@gp');
    db.close();
  });

  it('should compute the same label as the Worker for a fund-scoped decision recorded in another fund', async () => {
    const fp = fingerprintFor(ERROR, FIRM)!;
    const dec = (o: Partial<ActiveDecision>): ActiveDecision => ({
      id: 'dec_1',
      fingerprint: fp,
      status: 'active',
      decision: 'answered',
      counsel_option: 'A',
      fund_name: 'Fund II',
      decided_by_name: 'x',
      decided_at: 1,
      ...o,
    });
    const label = async (d: ActiveDecision, fund: string) => {
      const api = { lookup: async () => [d] } as unknown as MemoryApi;
      const m = await fingerprintFindings([ERROR], FIRM, api, fundScopeName(fund));
      return [m.byId.f_err!.label, m.byId.f_err!.prior ? 'linked' : 'unlinked'];
    };
    // Worker cases (variance-label-call-sites): fund scope in another fund = new, not linked
    expect(await label(dec({ scope: 'fund', fund_name: 'Fund II' }), 'Fund III')).toEqual([
      'new',
      'unlinked',
    ]);
    expect(await label(dec({ scope: 'fund', fund_name: 'Fund III' }), 'Fund III')).toEqual([
      'already_answered',
      'linked',
    ]);
    expect(await label(dec({ scope: 'firm_template', fund_name: 'Fund II' }), 'Fund III')).toEqual([
      'already_answered',
      'linked',
    ]);
    // empty-fund document: the Worker run name is the literal "(no fund)"
    expect(NO_FUND_SCOPE).toBe('(no fund)');
    expect(fundScopeName('')).toBe('(no fund)');
    expect(await label(dec({ scope: 'fund', fund_name: '(no fund)' }), '')).toEqual([
      'already_answered',
      'linked',
    ]);
    // masked and clamped exactly like the Worker (maskFree(fund.slice(0, 200)))
    expect(fundScopeName('x'.repeat(250))).toHaveLength(200);
  });

  it('should send intent undefined instead of an empty string and refuse a masked-blank firm-template intent', async () => {
    ready({ f_change: { status: 'counsel', ownerAnswers: { counsel: null } } });
    await useReview
      .getState()
      .recordAnswer('f_change', answer({ intent: '   ', scope: 'fund' }), 'counsel');
    expect(h.answers[0]!.input).not.toHaveProperty('intent');
    expect(h.answers[0]!.input.scope).toBe('fund');
    await useReview
      .getState()
      .recordAnswer('f_change', answer({ intent: ' Firm standard. ', scope: 'fund' }), 'counsel');
    expect(h.answers[1]!.input.intent).toBe('Firm standard.');
    // all-sensitive intent: masked form is blank -> refused client-side (Worker intentIsBlank)
    expect(intentError('021000021', 'firm_template')).toBe(INTENT_MASKED_TEXT);
    expect(intentError('021000021', 'fund')).toBeNull();
  });

  it('should keep the local answer and the gate when storeFindings throws finding_too_large', async () => {
    // (1) the answer path: an invalid_request at enqueue never throws to the UI; triage is kept
    ready({ f_change: { status: 'counsel', ownerAnswers: { gp: null, counsel: null } } });
    h.throwAnswer = new MemoryApiError('invalid_request', 'too large', {
      reason: 'finding_too_large',
    });
    await expect(
      useReview.getState().recordAnswer('f_change', answer(), 'gp'),
    ).resolves.toBeUndefined();
    const t = useReview.getState().triage.f_change!;
    expect(t.ownerAnswers).toEqual({ gp: 'A', counsel: null });
    // (2) the export path: storeFindings throws, the file still downloads with the quiet note
    const calls: string[] = [];
    h.api = {
      ensureRun: async () => ({ run_id: 'r_1' }),
      storeFindings: async () => {
        calls.push('storeFindings');
        throw new MemoryApiError('invalid_request', 'too large', { reason: 'finding_too_large' });
      },
      createQuestions: async () => {
        calls.push('createQuestions');
        return [];
      },
      exportRun: async () => ({
        ok: true,
        run_id: 'r_1',
        sheet_exported_at: 1,
        sheet_question_count: 1,
      }),
    } as unknown as MemoryApi;
    const rows = buildRows(mergeFindings([ERROR], [CHANGE]), null, useReview.getState().triage);
    const sheet = buildSheet(
      { title: 'Q', firm: 'H', fund: 'Fund III', version: null },
      rows,
      'counsel',
    );
    expect(sheet.questions.map((q) => q.findingKey)).toEqual(['f_change@counsel']);
    const out = await exportCounselSheet({
      doc: DOC,
      sheet,
      rows,
      findings: rows.map((r) => r.f),
      memory: null,
      wording: () => 'Q?',
    });
    expect(out.recorded).toBe(false);
    expect(out.memoryNote).toBe(NOT_RECORDED_NOTE);
    expect(calls).toEqual(['storeFindings']);
    expect(useReview.getState().triage.f_change!.ownerAnswers).toEqual({ gp: 'A', counsel: null });
  });

  it('should re-block only the revoked owner when an owner answer on a change row is reopened from firm memory', async () => {
    ready({ f_change: { status: 'counsel', ownerAnswers: { gp: null, counsel: null } } });
    await useReview.getState().recordAnswer('f_change', answer(), 'gp');
    await useReview.getState().recordAnswer('f_change', answer({ option: 'B' }), 'counsel');
    const ids = useReview.getState().triage.f_change!.ownerAnswerIds!;
    h.resolved[ids.gp!] = 'dec-gp';
    h.resolved[ids.counsel!] = 'dec-counsel';
    const fp = fingerprintFor(CHANGE, FIRM)!;
    await useReview.getState().refreshMemory('dec-gp', { fingerprint: fp, decision: 'answered' });
    const t = useReview.getState().triage.f_change!;
    expect(t.ownerAnswers).toEqual({ gp: null, counsel: 'B' });
    expect(t.ownerAnswerIds?.gp).toBeUndefined();
    expect(t.ownerAnswerIds?.counsel).toBe(ids.counsel);
  });

  it('should fall back to the computed change-row fingerprint when the pending id is not synced yet', async () => {
    ready({ f_change: { status: 'counsel', ownerAnswers: { gp: null } } });
    await useReview.getState().recordAnswer('f_change', answer(), 'gp');
    const fp = fingerprintFor(CHANGE, FIRM)!;
    await useReview.getState().refreshMemory('dec-x', { fingerprint: fp, decision: 'answered' });
    expect(useReview.getState().triage.f_change!.ownerAnswers).toEqual({ gp: null });
    // a different fingerprint leaves the answer alone
    await useReview.getState().recordAnswer('f_change', answer(), 'gp');
    await useReview
      .getState()
      .refreshMemory('dec-y', { fingerprint: 'f'.repeat(64), decision: 'answered' });
    expect(useReview.getState().triage.f_change!.ownerAnswers).toEqual({ gp: 'A' });
  });

  it('should fetch regression checks for a document with no fingerprinted finding using the sentinel fingerprint', async () => {
    expect(regressionFingerprints([], FIRM)).toEqual([ZERO_FINGERPRINT]);
    expect(ZERO_FINGERPRINT).toMatch(/^0{64}$/);
    const seen: string[][] = [];
    const api = {
      lookupWithChecks: async (_f: string, fps: string[]) => {
        seen.push(fps);
        return { decisions: [], regression_checks: [] };
      },
    } as unknown as MemoryApi;
    await fetchRegression(DOC, [], { api, run: vi.fn(), inputOf: () => undefined });
    expect(seen).toEqual([[ZERO_FINGERPRINT]]);
    // with findings: their fingerprints (error findings and change rows)
    seen.length = 0;
    await fetchRegression(DOC, [ERROR, CHANGE], { api, run: vi.fn(), inputOf: () => undefined });
    expect(seen[0]).toEqual([fingerprintFor(ERROR, FIRM), fingerprintFor(CHANGE, FIRM)]);
  });
});
