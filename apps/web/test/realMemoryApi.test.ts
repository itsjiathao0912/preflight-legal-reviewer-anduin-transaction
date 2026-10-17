// @vitest-environment node
import 'fake-indexeddb/auto';
import type { FindingWire } from '@aduin/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setApiBaseValue } from '../src/api/base';
import { memoryApi } from '../src/api/client';
import { MemoryApiError, nextUtcDay } from '../src/api/memoryApi';
import { RealMemoryApi } from '../src/api/realMemoryApi';
import { StubMemoryApi } from '../src/api/stubMemoryApi';
import { AppDb } from '../src/storage/db';
import { createFakeMemoryFetch, type FakeCall } from './support/fakeMemoryFetch';

const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);
const FIRM = 'partners-group';
const HASH = 'c'.repeat(64);
const SETTINGS = 'd'.repeat(64);
const FP = 'a'.repeat(64);
const wire = (id: string) => ({ id }) as unknown as FindingWire;
let n = 0;
const op = () => `op_${String(++n).padStart(8, '0')}`;

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let db: AppDb;
let dbN = 0;
beforeEach(() => {
  db = new AppDb(`real-memory-${++dbN}`);
});
afterEach(async () => {
  db.close();
  await db.delete();
});

function make(opts: Parameters<typeof createFakeMemoryFetch>[0] = {}) {
  const fake = createFakeMemoryFetch({ now: () => NOW, ...opts });
  const api = new RealMemoryApi({ fetch: fake.fetch, url: (p) => p, db, now: () => NOW });
  const paths = () => fake.calls.map((c) => `${c.method} ${c.path}`);
  return { api, fake, paths };
}

const runInput = (law_firm_id: string | null = FIRM) => ({
  client_op_id: op(),
  doc_name: 'Sub doc',
  doc_hash: HASH,
  law_firm_id,
  settings_hash: SETTINGS,
});

describe('realMemoryApi transport', () => {
  it('sends x-aduin-client: 1, credentials include and JSON bodies', async () => {
    const { api, fake } = make();
    await api.lookup(FIRM, [FP]);
    for (const c of fake.calls) {
      expect(c.headers['x-aduin-client']).toBe('1');
      expect(c.credentials).toBe('include');
    }
    expect(fake.calls.find((c) => c.path === '/api/memory/lookup')?.headers['content-type']).toBe(
      'application/json',
    );
  });

  it('bootstraps the session before the first lookup', async () => {
    const { api, paths } = make();
    await api.lookup(FIRM, [FP]);
    expect(paths()).toEqual(['POST /api/session', 'POST /api/memory/lookup']);
    expect(api.currentSession()?.workspace_id).toBe('ws_fake0001');
  });

  it('bootstrap trims the name, rejects empty/over-long names without a request', async () => {
    const { api, fake } = make();
    await api.bootstrap('  Linh Tran  ');
    expect(fake.calls[0]!.body).toEqual({ analyst_name: 'Linh Tran' });
    await expect(api.bootstrap(' ')).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(api.bootstrap('x'.repeat(81))).rejects.toMatchObject({ code: 'invalid_request' });
    expect(fake.calls).toHaveLength(1);
  });

  it('read_only comes from the session response', async () => {
    const { api } = make({ readOnly: true });
    const s = await api.bootstrap('Visitor');
    expect(s.read_only).toBe(true);
    expect(api.readOnly).toBe(true);
    await expect(api.ensureRun(runInput())).rejects.toMatchObject({
      code: 'read_only',
      status: 403,
    });
  });

  it('401 invalid_session re-bootstraps and retries once', async () => {
    const calls: string[] = [];
    let sessions = 0;
    let lookups = 0;
    const f = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input);
      calls.push(`${init.method} ${path}`);
      if (path === '/api/session') {
        sessions++;
        return jsonRes(200, {
          workspace_id: 'ws_a',
          analyst_id: 'an_a',
          kind: 'sandbox',
          expires_at: NOW + 1,
          read_only: false,
        });
      }
      lookups++;
      if (lookups === 1) return jsonRes(401, { error: { code: 'invalid_session', message: 'x' } });
      return jsonRes(200, { decisions: [] });
    }) as typeof fetch;
    const api = new RealMemoryApi({ fetch: f, url: (p) => p, db, now: () => NOW });
    expect(await api.lookup(FIRM, [FP])).toEqual([]);
    expect(sessions).toBe(2);
    expect(calls).toEqual([
      'POST /api/session',
      'POST /api/memory/lookup',
      'POST /api/session',
      'POST /api/memory/lookup',
    ]);
  });

  it('a second 401 surfaces as unauthorized (no loop)', async () => {
    let lookups = 0;
    const f = (async (input: RequestInfo | URL) => {
      if (String(input) === '/api/session')
        return jsonRes(200, {
          workspace_id: 'ws_a',
          analyst_id: 'an_a',
          kind: 'sandbox',
          expires_at: NOW + 1,
          read_only: false,
        });
      lookups++;
      return jsonRes(401, { error: { code: 'invalid_session', message: 'x' } });
    }) as typeof fetch;
    const api = new RealMemoryApi({ fetch: f, url: (p) => p, db, now: () => NOW });
    await expect(api.lookup(FIRM, [FP])).rejects.toMatchObject({ code: 'unauthorized' });
    expect(lookups).toBe(2);
  });

  it('a network failure is unavailable; no API base is unavailable without fetching', async () => {
    const f = (async () => {
      throw new TypeError('offline');
    }) as typeof fetch;
    const api = new RealMemoryApi({ fetch: f, url: (p) => p, db });
    await expect(api.lookup(FIRM, [FP])).rejects.toMatchObject({
      code: 'unavailable',
      reason: 'network',
    });
    let called = 0;
    const off = new RealMemoryApi({
      fetch: (async () => {
        called++;
        return jsonRes(200, {});
      }) as typeof fetch,
      url: () => null,
      db,
    });
    await expect(off.health()).rejects.toMatchObject({ code: 'unavailable' });
    expect(called).toBe(0);
  });
});

describe('realMemoryApi wire codes', () => {
  const cases: [number, Record<string, unknown>, string, string | undefined][] = [
    [403, { code: 'read_only_demo' }, 'read_only', undefined],
    [409, { code: 'conflict_active_decision' }, 'conflict', undefined],
    [400, { code: 'invalid_request', reason: 'run_required' }, 'run_required', 'run_required'],
    [400, { code: 'invalid_request', reason: 'firm_required' }, 'invalid_request', 'firm_required'],
    [400, { code: 'invalid_request', reason: 'op_reused' }, 'invalid_request', 'op_reused'],
    [400, { code: 'invalid_request', reason: 'question_not_found' }, 'not_found', undefined],
    [422, { code: 'fingerprint_mismatch' }, 'fingerprint_mismatch', undefined],
    [429, { code: 'rate_limited', reason: 'memory_write_budget' }, 'rate_limited', undefined],
    [429, { code: 'quota_exhausted', reason: 'workspace_decisions' }, 'quota_exhausted', undefined],
    [503, { code: 'memory_unavailable' }, 'unavailable', undefined],
  ];
  it.each(cases)('%i %j -> %s', async (status, error, code, reason) => {
    const { api, fake } = make({
      failNextWrite: { status, code: String(error['code']), reason: error['reason'] as string },
    });
    await api.bootstrap('Linh Tran');
    // failNextWrite applies to the next POST after the session
    const e = await api.ensureRun(runInput()).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(MemoryApiError);
    expect(e).toMatchObject({ code, status });
    if (reason) expect((e as MemoryApiError).reason).toBe(reason);
    if (status === 429 && code === 'rate_limited')
      expect((e as MemoryApiError).retryAfterUtc).toBe(nextUtcDay(NOW));
    expect(fake.calls.length).toBe(2);
  });

  it('409 carries the current active decision', async () => {
    const current = { id: 'd_1', fingerprint: FP, status: 'active', decision: 'accepted' };
    const f = (async (input: RequestInfo | URL) =>
      String(input) === '/api/session'
        ? jsonRes(200, {
            workspace_id: 'ws_a',
            analyst_id: 'an_a',
            kind: 'sandbox',
            expires_at: 1,
            read_only: false,
          })
        : jsonRes(409, {
            error: { code: 'conflict_active_decision', message: 'x' },
            current,
          })) as typeof fetch;
    const api = new RealMemoryApi({ fetch: f, url: (p) => p, db });
    const e = (await api
      .decide({
        client_op_id: op(),
        law_firm_id: FIRM,
        run_id: 'r_1',
        finding_ref: 'f1',
        decision: 'accepted',
        quote_text: 'q',
        fingerprint: FP,
        issue_class: 'broken_cross_reference',
        decided_by_name: 'Linh Tran',
      })
      .catch((x: unknown) => x)) as MemoryApiError;
    expect(e.code).toBe('conflict');
    expect(e.current).toEqual(current);
  });
});

describe('realMemoryApi request bodies (exact Worker field names)', () => {
  const bodyOf = (calls: FakeCall[], path: string) => calls.filter((c) => c.path === path);

  it('decide drops stub-only keys and needs run_id + a valid pattern_key', async () => {
    const { api, fake } = make();
    const { run_id } = await api.ensureRun(runInput());
    const base = {
      law_firm_id: FIRM,
      finding_ref: 'f1',
      decision: 'dismissed' as const,
      reason_code: 'false_positive' as never,
      quote_text: 'the quote',
      fingerprint: FP,
      issue_class: 'broken_cross_reference' as const,
      section_path: ['1'],
      quote_snippet: 'snip',
      decided_by_name: 'Linh Tran',
      fund_name: 'Fund I',
      pattern_key: 'xref:section>4',
    };
    await expect(api.decide({ ...base, client_op_id: op() })).rejects.toMatchObject({
      code: 'run_required',
    });
    await expect(
      api.decide({ ...base, client_op_id: op(), run_id, pattern_key: 'Bad Key' }),
    ).rejects.toMatchObject({ code: 'invalid_request', reason: 'pattern_key' });
    expect(bodyOf(fake.calls, '/api/decisions')).toHaveLength(0);
    const id = op();
    await api.decide({ ...base, client_op_id: id, run_id }).catch(() => null);
    const [sent] = bodyOf(fake.calls, '/api/decisions');
    expect(sent!.body).toEqual({
      client_op_id: id,
      run_id,
      finding_ref: 'f1',
      decision: 'dismissed',
      reason_code: 'false_positive',
      quote_text: 'the quote',
      fingerprint: FP,
      issue_class: 'broken_cross_reference',
      pattern_key: 'xref:section>4',
      fund_name: 'Fund I',
    });
  });

  it('answer maps counsel_option/counsel_note to option/note and requires question_id + quote_text', async () => {
    const { api, fake } = make();
    const { run_id } = await api.ensureRun(runInput());
    await api.storeFindings(run_id, [wire('f1')]);
    const [q] = await api.createQuestions(run_id, [
      { client_op_id: op(), finding_ref: 'f1', fingerprint: FP, interpretations: ['A', 'B'] },
    ]);
    const qBody = bodyOf(fake.calls, '/api/counsel/questions')[0]!.body;
    expect(Object.keys(qBody).sort()).toEqual([
      'client_op_id',
      'finding_ref',
      'fingerprint',
      'interpretations',
    ]);
    const base = {
      law_firm_id: FIRM,
      fingerprint: FP,
      issue_class: 'broken_cross_reference' as const,
      counsel_option: 'B' as const,
      counsel_note: 'per counsel',
      decided_by_name: 'Linh Tran',
    };
    await expect(
      api.answer({ ...base, client_op_id: op(), quote_text: 'q' }),
    ).rejects.toMatchObject({ reason: 'question_required' });
    await expect(
      api.answer({ ...base, client_op_id: op(), question_id: q!.question_id }),
    ).rejects.toMatchObject({ reason: 'quote_text' });
    const id = op();
    const d = await api.answer({
      ...base,
      client_op_id: id,
      question_id: q!.question_id,
      quote_text: 'the quote',
    });
    expect(d.decision).toBe('answered');
    expect(bodyOf(fake.calls, '/api/counsel/answers')[0]!.body).toEqual({
      client_op_id: id,
      question_id: q!.question_id,
      option: 'B',
      note: 'per counsel',
      quote_text: 'the quote',
      fingerprint: FP,
    });
  });

  it('export sends {client_op_id, question_count}; ids are never reused across actions', async () => {
    const { api, fake } = make();
    const { run_id } = await api.ensureRun(runInput(null));
    await api.storeFindings(run_id, [wire('f1')]);
    const r = await api.exportRun(run_id, { question_count: 2 });
    expect(r).toMatchObject({ ok: true, run_id, sheet_question_count: 2 });
    await api.revoke('d_missing', 'x').catch(() => null);
    const exp = bodyOf(fake.calls, `/api/runs/${run_id}/export`)[0]!.body;
    expect(Object.keys(exp).sort()).toEqual(['client_op_id', 'question_count']);
    const ids = fake.calls.map((c) => c.body['client_op_id']).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rules, firm and audit use the documented paths and query params', async () => {
    const { api, fake } = make();
    const rule = await api.createRule(FIRM, 'House style');
    await api.listRules(FIRM);
    await api.revokeRule(rule.id, 'stale');
    await api.firm(FIRM);
    await api.audit('5');
    const seen = fake.calls.slice(1).map((c) => `${c.method} ${c.path}${c.search}`);
    expect(seen).toEqual([
      `POST /api/rules?law_firm_id=${FIRM}`,
      `GET /api/rules?law_firm_id=${FIRM}`,
      `POST /api/rules/${rule.id}/revoke`,
      `GET /api/memory/firm?law_firm_id=${FIRM}`,
      'GET /api/audit?limit=100&cursor=5',
    ]);
  });

  it('health returns the 503 body (ok: false) instead of throwing', async () => {
    const f = (async () =>
      jsonRes(503, { ok: false, expected_schema_version: '5', reason: 'no_db' })) as typeof fetch;
    const api = new RealMemoryApi({ fetch: f, url: (p) => p, db });
    expect(await api.health()).toMatchObject({ ok: false, reason: 'no_db' });
  });
});

describe('realMemoryApi run lifecycle', () => {
  it('ensureRun caches run:{workspace_id}:{key} and does not POST again', async () => {
    const { api, fake } = make();
    const a = await api.ensureRun(runInput());
    const b = await api.ensureRun(runInput());
    expect(b.run_id).toBe(a.run_id);
    expect(fake.calls.filter((c) => c.path === '/api/runs')).toHaveLength(1);
    const row = await db.uiState.get(`run:ws_fake0001:${FIRM}|${HASH}|${SETTINGS}`);
    expect(row?.value).toBe(a.run_id);
  });

  it('storeFindings sends chunks of 25 and skips ids already stored (delta only)', async () => {
    const { api, fake } = make();
    const { run_id } = await api.ensureRun(runInput());
    const ids = Array.from({ length: 60 }, (_, i) => wire(`f${i}`));
    expect((await api.storeFindings(run_id, ids)).stored).toBe(60);
    const posts = fake.calls.filter((c) => c.path === `/api/runs/${run_id}/findings`);
    expect(posts.map((c) => (c.body['findings'] as unknown[]).length)).toEqual([25, 25, 10]);
    // re-analysis: 60 old + 2 late AI findings -> only the 2 new ids are sent
    const again = [...ids, wire('ai1'), wire('ai2'), wire('ai1')];
    expect((await api.storeFindings(run_id, again)).stored).toBe(2);
    const last = fake.calls.at(-1)!;
    expect((last.body['findings'] as { id: string }[]).map((f) => f.id)).toEqual(['ai1', 'ai2']);
    const before = fake.calls.length;
    expect((await api.storeFindings(run_id, ids)).stored).toBe(0);
    expect(fake.calls.length).toBe(before);
  });

  it('a workspace change clears the run cache and stored-finding sets', async () => {
    let ws = 'ws_one';
    const fake = createFakeMemoryFetch({ workspaceId: () => ws });
    const api = new RealMemoryApi({ fetch: fake.fetch, url: (p) => p, db });
    const a = await api.ensureRun(runInput());
    await api.storeFindings(a.run_id, [wire('f1')]);
    expect((await db.uiState.where('key').startsWith('run:ws_one').count()) > 0).toBe(true);
    ws = 'ws_two';
    await api.bootstrap('Linh Tran');
    expect(await db.uiState.where('key').startsWith('run:ws_one').count()).toBe(0);
    // a fresh client on the same db (page reload) with the same workspace keeps the cache
    const b = await api.ensureRun(runInput());
    expect(fake.calls.filter((c) => c.path === '/api/runs')).toHaveLength(2);
    expect(b.run_id).toBe(a.run_id); // the fake dedupes by key; the client still asked again
    const reload = new RealMemoryApi({ fetch: fake.fetch, url: (p) => p, db });
    await reload.ensureRun(runInput());
    expect(fake.calls.filter((c) => c.path === '/api/runs')).toHaveLength(2);
  });

  it('F3: a workspace change clears counsel question ids (questions:{docId}) too', async () => {
    let ws = 'ws_one';
    const fake = createFakeMemoryFetch({ workspaceId: () => ws });
    const api = new RealMemoryApi({ fetch: fake.fetch, url: (p) => p, db });
    await api.bootstrap('Linh Tran');
    await db.uiState.put({ key: `questions:${HASH}`, value: { f1: 'q_old' }, updatedAt: NOW });
    await db.uiState.put({ key: 'session:analystName', value: 'Linh Tran', updatedAt: NOW });
    await api.bootstrap('Linh Tran'); // same workspace: kept
    expect(await db.uiState.get(`questions:${HASH}`)).toBeDefined();
    ws = 'ws_two';
    await api.bootstrap('Linh Tran');
    expect(await db.uiState.get(`questions:${HASH}`)).toBeUndefined();
    expect(await db.uiState.get('session:analystName')).toBeDefined();
  });

  it('invalidateRun drops the cached run so the next ensureRun asks the Worker', async () => {
    const { api, fake } = make();
    await api.ensureRun(runInput());
    await api.invalidateRun({ law_firm_id: FIRM, doc_hash: HASH, settings_hash: SETTINGS });
    await api.ensureRun(runInput());
    expect(fake.calls.filter((c) => c.path === '/api/runs')).toHaveLength(2);
  });
});

describe('client.ts selection', () => {
  afterEach(() => setApiBaseValue('/'));
  it('uses the real client when the API base is set and re-evaluates on base change', () => {
    setApiBaseValue('/');
    const a = memoryApi();
    expect(a).toBeInstanceOf(RealMemoryApi);
    expect(memoryApi()).toBe(a);
    setApiBaseValue('');
    expect(memoryApi()).toBeInstanceOf(StubMemoryApi);
    setApiBaseValue('/');
    const b = memoryApi();
    expect(b).toBeInstanceOf(RealMemoryApi);
    expect(b).not.toBe(a);
  });
});
