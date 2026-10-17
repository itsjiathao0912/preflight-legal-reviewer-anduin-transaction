// @vitest-environment node
import 'fake-indexeddb/auto';
import { fingerprintFor, type FindingWire, type IssueClass } from '@aduin/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryApiError, nextUtcDay, toMemoryApiError, type MemoryApi } from '../src/api/memoryApi';
import { StubMemoryApi } from '../src/api/stubMemoryApi';
import type { FindingView } from '../src/engine/types';
import { AppDb } from '../src/storage/db';
import { createFakeMemoryFetch } from './support/fakeMemoryFetch';

/**
 * Shared MemoryApi contract (Phase 08 S0). The same behavioural cases run against every
 * implementation: the Dexie stub now; S1 appends the real client (`realMemoryApi.ts`) over
 * `createFakeMemoryFetch()` to IMPLS below.
 */
interface Impl {
  name: string;
  make(): Promise<{ api: MemoryApi; dispose(): Promise<void> }>;
}

let dbN = 0;
const IMPLS: Impl[] = [
  {
    name: 'stub',
    async make() {
      const db = new AppDb(`api-contract-${++dbN}`);
      return {
        api: new StubMemoryApi(db, () => 1_700_000_000_000),
        async dispose() {
          db.close();
          await db.delete();
        },
      };
    },
  },
];

const FIRM = 'partners-group';
const HASH = 'c'.repeat(64);
const SETTINGS = 'd'.repeat(64);
const fp = (qh: string) =>
  fingerprintFor(
    {
      id: 'f1',
      issue_class: 'broken_cross_reference' as IssueClass,
      quote_hash: qh,
      severity: 'critical',
      quote: 'q',
      quote_snippet: 'q',
    } as unknown as FindingView,
    FIRM,
  )!;
const wire = (id: string) => ({ id }) as unknown as FindingWire;
let op = 0;
const opId = () => `op_${String(++op).padStart(8, '0')}`;

describe.each(IMPLS)('api-contract ($name)', (impl) => {
  let api: MemoryApi;
  let dispose: () => Promise<void>;
  beforeEach(async () => {
    ({ api, dispose } = await impl.make());
    await api.bootstrap('Linh Tran');
  });
  afterEach(() => dispose());

  const run = (law_firm_id: string | null = FIRM) =>
    api.ensureRun({
      client_op_id: opId(),
      doc_name: 'Sub doc',
      doc_hash: HASH,
      law_firm_id,
      settings_hash: SETTINGS,
    });

  it('bootstrap returns a writable sandbox session and trims the name', async () => {
    const s = await api.bootstrap('  Linh Tran  ');
    expect(s.kind).toBe('sandbox');
    expect(s.read_only).toBe(false);
    expect(s.expires_at).toBeGreaterThan(0);
    await expect(api.bootstrap('   ')).rejects.toBeInstanceOf(MemoryApiError);
  });

  it('ensureRun dedupes on firm + doc_hash + settings_hash', async () => {
    const a = await run();
    const b = await run();
    expect(b.run_id).toBe(a.run_id);
    const c = await api.ensureRun({
      client_op_id: opId(),
      doc_name: 'Sub doc',
      doc_hash: HASH,
      law_firm_id: FIRM,
      settings_hash: 'e'.repeat(64),
    });
    expect(c.run_id).not.toBe(a.run_id);
  });

  it('storeFindings is idempotent on duplicate ids (lower stored count)', async () => {
    const { run_id } = await run();
    expect((await api.storeFindings(run_id, [wire('f1'), wire('f2')])).stored).toBe(2);
    expect((await api.storeFindings(run_id, [wire('f2'), wire('f3')])).stored).toBe(1);
  });

  it('decide with a run, lookup, revoke never deletes', async () => {
    const { run_id } = await run();
    const f = fp('a'.repeat(64));
    const d = await api.decide({
      client_op_id: opId(),
      law_firm_id: FIRM,
      run_id,
      finding_ref: 'f1',
      decision: 'accepted',
      quote_text: 'the quote',
      fingerprint: f,
      issue_class: 'broken_cross_reference',
      decided_by_name: 'Linh Tran',
    });
    expect(d.status).toBe('active');
    expect((await api.lookup(FIRM, [f])).map((x) => x.id)).toEqual([d.id]);
    expect(await api.revoke(d.id, 'Reopened')).toBeNull();
    expect(await api.lookup(FIRM, [f])).toEqual([]);
  });

  it('decide refuses a bad pattern_key and a firm-less run', async () => {
    const base = {
      client_op_id: opId(),
      law_firm_id: FIRM,
      finding_ref: 'f1',
      decision: 'accepted' as const,
      quote_text: 'q',
      fingerprint: fp('a'.repeat(64)),
      issue_class: 'broken_cross_reference' as IssueClass,
      decided_by_name: 'Linh Tran',
    };
    const { run_id } = await run();
    await expect(api.decide({ ...base, run_id, pattern_key: 'BAD KEY' })).rejects.toMatchObject({
      code: 'invalid_request',
      reason: 'pattern_key',
    });
    const noFirm = await run(null);
    await expect(
      api.decide({ ...base, client_op_id: opId(), run_id: noFirm.run_id }),
    ).rejects.toMatchObject({ code: 'invalid_request', reason: 'firm_required' });
  });

  it('createQuestions then answer resolves through the question row', async () => {
    const { run_id } = await run();
    await api.storeFindings(run_id, [wire('f1')]);
    const f = fp('a'.repeat(64));
    const [q] = await api.createQuestions(run_id, [
      { client_op_id: opId(), finding_ref: 'f1', fingerprint: f, interpretations: ['A', 'B'] },
    ]);
    expect(q!.finding_ref).toBe('f1');
    const d = await api.answer({
      client_op_id: opId(),
      law_firm_id: FIRM,
      question_id: q!.question_id,
      quote_text: 'the quote',
      fingerprint: f,
      issue_class: 'broken_cross_reference',
      counsel_option: 'A',
      decided_by_name: 'Linh Tran',
    });
    expect(d.decision).toBe('answered');
    expect(d.counsel_option).toBe('A');
  });

  it('createQuestions refuses a firm-less run and bad interpretations', async () => {
    const noFirm = await run(null);
    await api.storeFindings(noFirm.run_id, [wire('f1')]);
    await expect(
      api.createQuestions(noFirm.run_id, [
        {
          client_op_id: opId(),
          finding_ref: 'f1',
          fingerprint: fp('a'.repeat(64)),
          interpretations: ['A'],
        },
      ]),
    ).rejects.toMatchObject({ reason: 'firm_required' });
    const { run_id } = await run();
    await api.storeFindings(run_id, [wire('f1')]);
    await expect(
      api.createQuestions(run_id, [
        {
          client_op_id: opId(),
          finding_ref: 'f1',
          fingerprint: fp('a'.repeat(64)),
          interpretations: [],
        },
      ]),
    ).rejects.toBeInstanceOf(MemoryApiError);
  });

  it('exportRun records the sheet export', async () => {
    const { run_id } = await run(null);
    const r = await api.exportRun(run_id, { question_count: 3 });
    expect(r).toMatchObject({ ok: true, run_id, sheet_question_count: 3 });
    expect(r.sheet_exported_at).toBeGreaterThan(0);
  });

  it('firm rules lifecycle, firmRules returns active texts, audit pages', async () => {
    const r = await api.createRule(FIRM, 'Treat "Section" references as firm standard');
    expect(r.status).toBe('active');
    expect(await api.firmRules(FIRM)).toEqual([r.text]);
    expect((await api.listRules(FIRM)).map((x) => x.id)).toEqual([r.id]);
    expect(await api.listRules('other-firm')).toEqual([]);
    const revoked = await api.revokeRule(r.id, 'no longer applies');
    expect(revoked.status).toBe('rejected');
    await expect(api.approveRule(r.id)).rejects.toMatchObject({ reason: 'rule_state' });
    await expect(api.rejectRule('ru_missing')).rejects.toMatchObject({ code: 'not_found' });
    const firm = await api.firm(FIRM);
    expect(firm.counts.rules_active).toBe(0);
    const page = await api.audit();
    expect(page.events.length).toBeGreaterThan(0);
    expect(page.events.length).toBeLessThanOrEqual(100);
  });

  it('health reports writable', async () => {
    expect((await api.health()).ok).toBe(true);
  });
});

describe('api-contract error mapping (frozen table)', () => {
  const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);
  const body = (code: string, reason?: string, extra: Record<string, unknown> = {}) => ({
    error: { code, message: code, ...(reason ? { reason } : {}) },
    ...extra,
  });
  it.each([
    [403, body('read_only_demo'), 'read_only'],
    [401, body('invalid_session'), 'unauthorized'],
    [400, body('invalid_request', 'run_required'), 'run_required'],
    [400, body('invalid_request', 'run_not_found'), 'not_found'],
    [400, body('invalid_request', 'pattern_key'), 'invalid_request'],
    [400, body('invalid_request', 'op_reused'), 'invalid_request'],
    [422, body('fingerprint_mismatch'), 'fingerprint_mismatch'],
    [503, body('memory_unavailable'), 'unavailable'],
    [500, {}, 'unavailable'],
  ])('%i %j -> %s', (status, b, code) => {
    const e = toMemoryApiError(status, b, NOW);
    expect(e.code).toBe(code);
    expect(e.status).toBe(status);
  });
  it('409 carries current', () => {
    const e = toMemoryApiError(409, body('conflict_active_decision', undefined, { current: null }));
    expect(e.code).toBe('conflict');
    expect(e.current).toBeNull();
  });
  it('429 daily budgets defer to the next UTC day; burst limits use retry_after_s', () => {
    const daily = toMemoryApiError(429, body('rate_limited', 'memory_write_budget'), NOW);
    expect(daily.retryAfterUtc).toBe(nextUtcDay(NOW));
    expect(daily.retryAfterUtc).toBe('2026-10-18T00:00:00.000Z');
    const ws = toMemoryApiError(429, body('quota_exhausted', 'workspace_decisions'), NOW);
    expect(ws.code).toBe('quota_exhausted');
    expect(ws.retryAfterUtc).toBe('2026-10-18T00:00:00.000Z');
    const burst = toMemoryApiError(
      429,
      { error: { code: 'rate_limited', message: 'x', retry_after_s: 30 } },
      NOW,
    );
    expect(burst.retryAfterUtc).toBe(new Date(NOW + 30_000).toISOString());
  });
});

describe('api-contract fake fetch fixture mirrors Worker statuses', () => {
  it('401 before session, run_required, op_reused, read_only', async () => {
    const f = createFakeMemoryFetch().fetch;
    const post = (path: string, b: unknown) => f(path, { method: 'POST', body: JSON.stringify(b) });
    expect((await post('/api/decisions', {})).status).toBe(401);
    expect((await post('/api/session', { analyst_name: 'Linh' })).status).toBe(200);
    const r = await post('/api/decisions', { client_op_id: 'op_aaaaaaaa' });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: { reason: string } }).error.reason).toBe('run_required');
    const again = await post('/api/decisions', { client_op_id: 'op_aaaaaaaa' });
    expect(((await again.json()) as { error: { reason: string } }).error.reason).toBe('op_reused');
    const ro = createFakeMemoryFetch({ readOnly: true }).fetch;
    await ro('/api/session', { method: 'POST', body: JSON.stringify({ analyst_name: 'V' }) });
    expect((await ro('/api/runs', { method: 'POST', body: '{}' })).status).toBe(403);
  });
});
