// @vitest-environment node
import 'fake-indexeddb/auto';
import type { ActiveDecision, FindingWire } from '@aduin/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryApiError, nextUtcDay, type MemoryApi } from '../src/api/memoryApi';
import {
  MAX_UNAVAILABLE_ATTEMPTS,
  Outbox,
  backoffMs,
  isPendingId,
  type OutboxDoc,
  type OutboxEvent,
} from '../src/api/outbox';
import { RealMemoryApi } from '../src/api/realMemoryApi';
import { AppDb } from '../src/storage/db';
import { createFakeMemoryFetch } from './support/fakeMemoryFetch';

const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);
const FP = 'a'.repeat(64);
const DOC: OutboxDoc = {
  doc_name: 'Sub doc',
  doc_hash: 'c'.repeat(64),
  law_firm_id: 'partners-group',
  settings_hash: 'd'.repeat(64),
};
let n = 0;
const op = () => `op_${String(++n).padStart(8, '0')}`;
const decision = (id: string, extra: Partial<ActiveDecision> = {}): ActiveDecision =>
  ({
    id,
    fingerprint: FP,
    status: 'active',
    decision: 'accepted',
    issue_class: 'broken_cross_reference',
    fund_name: 'Fund I',
    decided_by_name: 'Linh Tran',
    decided_at: NOW,
    ...extra,
  }) as ActiveDecision;
const decideInput = (client_op_id = op()) => ({
  client_op_id,
  law_firm_id: DOC.law_firm_id!,
  finding_ref: 'f1',
  decision: 'accepted' as const,
  quote_text: 'the quote',
  fingerprint: FP,
  issue_class: 'broken_cross_reference' as const,
  decided_by_name: 'Linh Tran',
});

type Call = { m: string; args: unknown[] };
/** Flaky fake MemoryApi: each method pops a scripted outcome (Error = throw), default success. */
function flaky() {
  const calls: Call[] = [];
  const script: Record<string, (unknown | Error)[]> = {};
  let ids = 0;
  const step = async <T>(m: string, args: unknown[], ok: () => T): Promise<T> => {
    calls.push({ m, args });
    const next = script[m]?.shift();
    if (next instanceof Error) throw next;
    return next !== undefined ? (next as T) : ok();
  };
  const api = {
    ensureRun: (i: unknown) => step('ensureRun', [i], () => ({ run_id: 'r_1' })),
    storeFindings: (r: string, f: FindingWire[]) =>
      step('storeFindings', [r, f], () => ({ stored: f.length })),
    decide: (i: unknown) => step('decide', [i], () => decision(`d_${++ids}`)),
    revoke: (id: string, reason: string) => step('revoke', [id, reason], () => null),
    createQuestions: (r: string, items: { finding_ref: string }[]) =>
      step('createQuestions', [r, items], () =>
        items.map((x) => ({ finding_ref: x.finding_ref, question_id: `q_${++ids}` })),
      ),
    answer: (i: unknown) =>
      step('answer', [i], () => decision(`d_${++ids}`, { decision: 'answered' })),
    invalidateRun: (d: unknown) => step('invalidateRun', [d], () => undefined),
  };
  return {
    api: api as unknown as MemoryApi,
    calls,
    script,
    names: () => calls.map((c) => c.m),
  };
}

let db: AppDb;
let dbN = 0;
let clock = NOW;
beforeEach(() => {
  db = new AppDb(`outbox-${++dbN}`);
  clock = NOW;
});
afterEach(async () => {
  db.close();
  await db.delete();
});

function outbox(
  api: MemoryApi | null,
  extra: Partial<ConstructorParameters<typeof Outbox>[0]> = {},
) {
  const events: OutboxEvent[] = [];
  const box = new Outbox({
    db,
    api: () => api,
    now: () => clock,
    findingsFor: (_d, keys) => keys.map((id) => ({ id }) as unknown as FindingWire),
    ...extra,
  });
  box.onEvent((e) => events.push(e));
  return { box, events };
}

describe('outbox', () => {
  it('should map the optimistic pending id to the real decision id on drain', async () => {
    const f = flaky();
    const { box, events } = outbox(f.api);
    const pid = await box.enqueueDecide(DOC, decideInput());
    expect(isPendingId(pid)).toBe(true);
    expect(await box.resolveId(pid!)).toBeNull();
    expect(await box.unsyncedCount()).toBe(1);
    await box.drain();
    expect(await box.resolveId(pid!)).toBe('d_1');
    expect(await box.unsyncedCount()).toBe(0);
    expect(events.map((e) => e.type)).toEqual(['synced']);
  });

  it('resolves run_id at send time, persists findings first, keeps the op client_op_id', async () => {
    const f = flaky();
    const { box } = outbox(f.api);
    const id = op();
    await box.enqueueDecide(DOC, decideInput(id), ['f1', 'f2', 'f1']);
    expect(f.calls).toHaveLength(0); // nothing sent at enqueue (lazy run)
    await box.drain();
    expect(f.names()).toEqual(['ensureRun', 'storeFindings', 'decide']);
    const ensure = f.calls[0]!.args[0] as { client_op_id: string; doc_hash: string };
    expect(ensure.doc_hash).toBe(DOC.doc_hash);
    expect(ensure.client_op_id).not.toBe(id);
    const stored = f.calls[1]!.args[1] as { id: string }[];
    expect(stored.map((x) => x.id)).toEqual(['f1', 'f2']);
    expect(f.calls[2]!.args[0]).toMatchObject({ client_op_id: id, run_id: 'r_1' });
  });

  it('retries with backoff on network failure and keeps the same client_op_id', async () => {
    const f = flaky();
    f.script['decide'] = [new MemoryApiError('unavailable', 'down', { reason: 'network' })];
    const { box, events } = outbox(f.api);
    const id = op();
    await box.enqueueDecide(DOC, decideInput(id));
    await box.drain();
    const [row] = await box.list();
    expect(row!.state).toBe('retry');
    expect(row!.nextAttemptAt).toBe(NOW + backoffMs(1));
    await box.drain(); // not due yet
    expect(f.names().filter((x) => x === 'decide')).toHaveLength(1);
    clock = NOW + backoffMs(1);
    await box.drain();
    const decides = f.calls.filter((c) => c.m === 'decide');
    expect(decides.map((c) => (c.args[0] as { client_op_id: string }).client_op_id)).toEqual([
      id,
      id,
    ]);
    expect((await box.list())[0]!.state).toBe('synced');
    expect(events.map((e) => e.type)).toEqual(['retry', 'synced']);
  });

  it('should defer a 429 memory_write_budget op to the next UTC day', async () => {
    const f = flaky();
    f.script['decide'] = [
      new MemoryApiError('rate_limited', 'budget', {
        reason: 'memory_write_budget',
        retryAfterUtc: nextUtcDay(NOW),
      }),
    ];
    const { box, events } = outbox(f.api);
    await box.enqueueDecide(DOC, decideInput());
    await box.enqueueDecide(DOC, decideInput());
    await box.drain();
    const rows = await box.list();
    expect(rows[0]!.state).toBe('deferred');
    expect(rows[0]!.nextAttemptAt).toBe(Date.parse('2026-10-18T00:00:00.000Z'));
    expect(rows[1]!.state).toBe('queued'); // order preserved: nothing jumps the deferred op
    expect(await box.unsyncedCount()).toBe(2);
    expect(events[0]).toMatchObject({ type: 'deferred' });
    clock = Date.parse('2026-10-18T00:00:00.000Z');
    await box.drain();
    expect((await box.list()).map((r) => r.state)).toEqual(['synced', 'synced']);
  });

  it('defers workspace_* budgets too; a burst 429 is a timed retry', async () => {
    const f = flaky();
    f.script['decide'] = [
      new MemoryApiError('quota_exhausted', 'ws', {
        reason: 'workspace_decisions',
        retryAfterUtc: nextUtcDay(NOW),
      }),
    ];
    const { box } = outbox(f.api);
    await box.enqueueDecide(DOC, decideInput());
    await box.drain();
    expect((await box.list())[0]!.state).toBe('deferred');

    const g = flaky();
    const at = new Date(NOW + 30_000).toISOString();
    g.script['decide'] = [new MemoryApiError('rate_limited', 'burst', { retryAfterUtc: at })];
    await db.outbox.clear();
    const { box: b2 } = outbox(g.api);
    await b2.enqueueDecide(DOC, decideInput());
    await b2.drain();
    const [r] = await b2.list();
    expect(r!.state).toBe('retry');
    expect(r!.nextAttemptAt).toBe(Date.parse(at));
  });

  it('409 rejects the op and emits the current active decision', async () => {
    const f = flaky();
    const current = decision('d_server');
    f.script['decide'] = [new MemoryApiError('conflict', 'c', { current })];
    const { box, events } = outbox(f.api);
    const pid = await box.enqueueDecide(DOC, decideInput());
    await box.enqueueDecide(DOC, decideInput());
    await box.drain();
    expect((await box.list()).map((r) => r.state)).toEqual(['rejected', 'synced']);
    expect(events[0]).toEqual(expect.objectContaining({ type: 'conflict', current }));
    expect(await box.resolveId(pid!)).toBeNull();
  });

  it('422 fingerprint_mismatch is a hard error: rejected, never retried', async () => {
    const f = flaky();
    f.script['decide'] = [new MemoryApiError('fingerprint_mismatch', 'fp')];
    const { box, events } = outbox(f.api);
    await box.enqueueDecide(DOC, decideInput());
    await box.drain();
    clock += 10 * 60_000;
    await box.drain();
    expect(f.names().filter((x) => x === 'decide')).toHaveLength(1);
    const [row] = await box.list();
    expect(row!.state).toBe('rejected');
    expect(row!.error).toMatchObject({ code: 'fingerprint_mismatch' });
    expect(events.map((e) => e.type)).toEqual(['rejected']);
    expect(await box.unsyncedCount()).toBe(0);
  });

  it('run_required / run_not_found drop the cached run and retry once', async () => {
    const f = flaky();
    f.script['decide'] = [
      new MemoryApiError('not_found', 'gone', { reason: 'run_not_found' }),
      new MemoryApiError('run_required', 'again', { reason: 'run_required' }),
    ];
    const { box } = outbox(f.api);
    await box.enqueueDecide(DOC, decideInput());
    await box.drain();
    expect(f.names()).toEqual([
      'ensureRun',
      'storeFindings',
      'decide',
      'invalidateRun',
      'ensureRun',
      'storeFindings',
      'decide',
    ]);
    expect((await box.list())[0]!.state).toBe('rejected');
  });

  it('revoke of a pending op before drain cancels it (never sent)', async () => {
    const f = flaky();
    const { box } = outbox(f.api);
    const pid = await box.enqueueDecide(DOC, decideInput());
    expect(await box.enqueueRevoke(pid!, 'Undone')).toBe('cancelled');
    await box.drain();
    expect(f.calls).toHaveLength(0);
    expect(await box.list()).toEqual([]);
  });

  it('revoke of a pending op while sending queues after it and uses the real id', async () => {
    const f = flaky();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const orig = f.api.decide.bind(f.api);
    (f.api as { decide: MemoryApi['decide'] }).decide = async (i) => {
      await gate;
      return orig(i);
    };
    const { box } = outbox(f.api);
    const pid = await box.enqueueDecide(DOC, decideInput());
    const draining = box.drain();
    // wait until the op is marked sending
    for (let i = 0; i < 50 && (await box.list())[0]!.state !== 'sending'; i++)
      await new Promise((r) => setTimeout(r, 1));
    expect(await box.enqueueRevoke(pid!, 'Undone')).toBe('queued');
    release();
    await draining;
    await box.drain();
    const revoke = f.calls.find((c) => c.m === 'revoke');
    expect(revoke?.args).toEqual(['d_1', 'Undone']);
    expect((await box.list()).map((r) => r.state)).toEqual(['synced', 'synced']);
  });

  it('revoke of a synced pending id revokes the real decision', async () => {
    const f = flaky();
    const { box } = outbox(f.api);
    const pid = await box.enqueueDecide(DOC, decideInput());
    await box.drain();
    expect(await box.enqueueRevoke(pid!, 'Reopened')).toBe('queued');
    await box.drain();
    expect(f.calls.find((c) => c.m === 'revoke')?.args).toEqual(['d_1', 'Reopened']);
  });

  it('drains in enqueue order and a sending row is recovered after a crash', async () => {
    const f = flaky();
    const { box } = outbox(f.api);
    const ids = [op(), op(), op()];
    for (const id of ids) await box.enqueueDecide(DOC, decideInput(id));
    const first = (await db.outbox.orderBy('seq').first())!;
    await db.outbox.update(first.seq!, {
      op: { ...(first.op as object), state: 'sending', attempts: 1 },
    });
    await box.recover();
    await box.drain();
    const sent = f.calls
      .filter((c) => c.m === 'decide')
      .map((c) => (c.args[0] as { client_op_id: string }).client_op_id);
    expect(sent).toEqual(ids);
  });

  it('answer creates its question at send time once, even across a retry', async () => {
    const f = flaky();
    f.script['answer'] = [new MemoryApiError('unavailable', 'down')];
    const { box } = outbox(f.api);
    const id = op();
    await box.enqueueAnswer(
      DOC,
      {
        client_op_id: id,
        law_firm_id: DOC.law_firm_id!,
        quote_text: 'the quote',
        fingerprint: FP,
        issue_class: 'broken_cross_reference',
        counsel_option: 'A',
        decided_by_name: 'Linh Tran',
      },
      { finding_ref: 'f1', fingerprint: FP, interpretations: ['A', 'B'] },
    );
    await box.drain();
    clock += backoffMs(1);
    await box.drain();
    expect(f.names().filter((x) => x === 'createQuestions')).toHaveLength(1);
    const answers = f.calls.filter((c) => c.m === 'answer').map((c) => c.args[0]);
    expect(answers).toHaveLength(2);
    for (const a of answers) expect(a).toMatchObject({ client_op_id: id, question_id: 'q_1' });
    expect((await box.list())[0]!.state).toBe('synced');
  });

  it('read-only sessions skip the outbox entirely', async () => {
    const f = flaky();
    const { box } = outbox(f.api, { readOnly: () => true });
    expect(await box.enqueueDecide(DOC, decideInput())).toBeNull();
    expect(await box.enqueueRevoke('d_1', 'x')).toBe('skipped');
    expect(await db.outbox.count()).toBe(0);
  });

  it('no API client keeps ops queued as retry (Memory unavailable)', async () => {
    const { box } = outbox(null);
    await box.enqueueDecide(DOC, decideInput());
    await box.drain();
    expect((await box.list())[0]!.state).toBe('retry');
  });

  it('drains on online and focus', async () => {
    const f = flaky();
    const { box } = outbox(f.api);
    const handlers: Record<string, () => void> = {};
    const target = {
      addEventListener: (t: string, fn: () => void) => (handlers[t] = fn),
      removeEventListener: (t: string) => delete handlers[t],
    } as unknown as Window;
    const stop = box.start(target);
    expect(Object.keys(handlers).sort()).toEqual(['focus', 'online']);
    await box.drain();
    await box.enqueueDecide(DOC, decideInput());
    handlers['online']!();
    await box.drain();
    expect((await box.list())[0]!.state).toBe('synced');
    stop();
    expect(Object.keys(handlers)).toEqual([]);
  });

  it('end to end over the real client + fake fetch: idempotent sync, run resolved once', async () => {
    const fake = createFakeMemoryFetch({ now: () => NOW });
    const api = new RealMemoryApi({ fetch: fake.fetch, url: (p) => p, db, now: () => NOW });
    const { box } = outbox(api);
    const p1 = await box.enqueueDecide(DOC, decideInput());
    const p2 = await box.enqueueDecide(DOC, { ...decideInput(), finding_ref: 'f2' }, ['f2']);
    await box.drain();
    expect(await box.resolveId(p1!)).toMatch(/^d_/);
    expect(await box.resolveId(p2!)).toMatch(/^d_/);
    expect(fake.calls.filter((c) => c.path === '/api/runs')).toHaveLength(1);
    const stores = fake.calls.filter((c) => c.path.endsWith('/findings'));
    expect(stores.map((c) => (c.body['findings'] as { id: string }[]).map((x) => x.id))).toEqual([
      ['f1'],
      ['f2'],
    ]);
    const ids = fake.calls.map((c) => c.body['client_op_id']).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // ------------------------------------------------------------ review fixes F2 / F4 / F5

  it('F2: stamps the workspace at enqueue and rejects ops after a workspace change', async () => {
    const f = flaky();
    let ws = 'ws_A';
    const { box, events } = outbox(f.api, { workspace: () => ws });
    await box.enqueueDecide(DOC, decideInput());
    expect((await box.list())[0]!.workspace_id).toBe('ws_A');
    ws = 'ws_B';
    await box.drain();
    const [row] = await box.list();
    expect(row!.state).toBe('rejected');
    expect(row!.error?.reason).toBe('workspace_changed');
    expect(f.names()).toEqual([]); // nothing reached the other workspace
    expect(events.map((e) => e.type)).toEqual(['rejected']);
    // a later op in the new workspace still syncs
    await box.enqueueDecide(DOC, { ...decideInput(), finding_ref: 'f2' }, ['f2']);
    await box.drain();
    expect((await box.list())[1]!.state).toBe('synced');
  });

  it('F2: an unknown current workspace keeps a stamped op retrying, never sends it', async () => {
    const f = flaky();
    let ws: string | null = 'ws_A';
    const { box } = outbox(f.api, { workspace: () => ws });
    await box.enqueueDecide(DOC, decideInput());
    ws = null;
    await box.drain();
    expect((await box.list())[0]!.state).toBe('retry');
    expect(f.names()).toEqual([]);
  });

  it('F4: synced and rejected ops drop quote_text, notes and doc_name', async () => {
    const f = flaky();
    f.script['decide'] = [decision('d_1'), new MemoryApiError('fingerprint_mismatch', 'nope')];
    const { box } = outbox(f.api);
    await box.enqueueDecide(DOC, { ...decideInput(), note: 'private note' });
    await box.enqueueDecide(DOC, { ...decideInput(), finding_ref: 'f2', note: 'n2' }, ['f2']);
    await box.enqueueAnswer(DOC, {
      client_op_id: op(),
      law_firm_id: DOC.law_firm_id!,
      question_id: 'q_1',
      quote_text: 'answer quote',
      fingerprint: FP,
      issue_class: 'broken_cross_reference',
      counsel_option: 'A',
      counsel_note: 'counsel secret',
    } as never);
    await box.drain();
    const rows = await box.list();
    expect(rows.map((r) => r.state)).toEqual(['synced', 'rejected', 'synced']);
    const raw = JSON.stringify(await db.outbox.toArray());
    for (const secret of ['the quote', 'private note', 'answer quote', 'counsel secret', 'Sub doc'])
      expect(raw).not.toContain(secret);
    expect(rows[0]!.result?.id).toBe('d_1'); // the pending-id map still works
  });

  it('F4: purgeExpired removes terminal and parked outbox rows after 24 h, keeps live ones', async () => {
    const { purgeExpired, RETENTION_MS } = await import('../src/storage/db');
    const old = NOW - RETENTION_MS - 1;
    for (const state of ['synced', 'rejected', 'parked', 'queued', 'retry', 'deferred'])
      await db.outbox.add({ createdAt: old, op: { state } });
    await db.outbox.add({ createdAt: NOW, op: { state: 'synced' } });
    await purgeExpired(db, NOW);
    const left = (await db.outbox.toArray()).map((r) => (r.op as { state: string }).state);
    expect(left.sort()).toEqual(['deferred', 'queued', 'retry', 'synced']);
  });

  it('F5: unavailable retries are capped, then the op parks until online / reload', async () => {
    const f = flaky();
    f.script['decide'] = Array.from(
      { length: MAX_UNAVAILABLE_ATTEMPTS },
      () => new MemoryApiError('unavailable', 'HTTP 503'),
    );
    const { box, events } = outbox(f.api);
    await box.enqueueDecide(DOC, decideInput());
    for (let i = 0; i < MAX_UNAVAILABLE_ATTEMPTS; i++) {
      await box.drain();
      clock += 10 * 60_000;
    }
    expect((await box.list())[0]!.state).toBe('parked');
    expect(events.at(-1)!.type).toBe('parked');
    expect(await box.unsyncedCount()).toBe(1);
    const sent = f.names().filter((x) => x === 'decide').length;
    expect(sent).toBe(MAX_UNAVAILABLE_ATTEMPTS);
    clock += 60 * 60_000;
    await box.drain(); // parked: never sent again in this page life
    expect(f.names().filter((x) => x === 'decide')).toHaveLength(sent);
    const handlers: Record<string, () => void> = {};
    box.start({
      addEventListener: (t: string, fn: () => void) => (handlers[t] = fn),
      removeEventListener: () => undefined,
    } as unknown as Window);
    await box.recover(); // page load resumes parked rows
    await box.drain();
    expect((await box.list())[0]!.state).toBe('synced');
  });

  it('variance: terminal answer ops drop intent, the assertion label and the question interpretations; the question carries owner', async () => {
    const f = flaky();
    const { box } = outbox(f.api);
    await box.enqueueAnswer(
      DOC,
      {
        client_op_id: op(),
        law_firm_id: DOC.law_firm_id!,
        quote_text: 'answer quote',
        fingerprint: FP,
        issue_class: 'broken_cross_reference',
        counsel_option: 'A',
        decided_by_name: 'Linh Tran',
        scope: 'firm_template',
        intent: 'private intent text',
        assertion: { kind: 'scope_exists', label: 'secret appendix label' },
      },
      {
        finding_ref: 'f1',
        fingerprint: FP,
        interpretations: ['Old text: Cayman only.', 'New text: Singapore too.'],
        owner: 'gp',
        owner_source: 'override',
      },
    );
    await box.drain();
    const sent = f.calls.find((c) => c.m === 'answer')!.args[0];
    expect(sent).toMatchObject({
      scope: 'firm_template',
      intent: 'private intent text',
      assertion: { kind: 'scope_exists', label: 'secret appendix label' },
    });
    const asked = f.calls.find((c) => c.m === 'createQuestions')!.args[1] as unknown[];
    expect(asked[0]).toMatchObject({ owner: 'gp', owner_source: 'override' });
    const rows = await box.list();
    expect(rows[0]!.state).toBe('synced');
    const raw = JSON.stringify(await db.outbox.toArray());
    for (const secret of [
      'private intent text',
      'secret appendix label',
      'answer quote',
      'Cayman only',
      'Singapore too',
    ])
      expect(raw).not.toContain(secret);
    expect(raw).toContain('firm_template'); // scope is an enum, kept
  });
});
