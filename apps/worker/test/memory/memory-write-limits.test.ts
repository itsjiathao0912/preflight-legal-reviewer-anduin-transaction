// Review fix cycle 1: M1 per-workspace daily write caps (requests / runs / findings, guarded
// quota_counter UPSERT, 429 rate_limited, nothing written on refusal), L2 safe-charset ids,
// L4 conditional rule-transition audit, L5 server-side 25-finding chunk cap.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { MEMORY_WRITE_CAPS, writeKey } from '../../src/platform/index';
import { splitWindow } from '../../src/platform/quota';
import { AUDIT_SQL } from '../../src/memory/repo/audit';
import { FINDINGS_CHUNK_MAX } from '../../src/routes/memory/runs';
import {
  call,
  decide,
  dumpWorkspace,
  makeMem,
  newRun,
  op,
  session,
  wireFinding,
  type MemHarness,
  type Session,
} from './memory-harness';

async function setCounter(ws: string, kind: 'req' | 'run' | 'fnd', nowMs: number, n: number) {
  const k = writeKey(ws, kind, nowMs);
  const { base, window } = splitWindow(k.key);
  await env.DB.prepare(
    'INSERT INTO quota_counter (scope, key, window, count, updated_at) VALUES (?1, ?2, ?3, ?4, 0) ' +
      'ON CONFLICT(scope, key, window) DO UPDATE SET count = excluded.count',
  )
    .bind(k.scope, base, window, n)
    .run();
}

const findings = (n: number, tag: string) =>
  Array.from({ length: n }, (_, i) => wireFinding('firm-x', `Limit finding ${tag} ${i}.`));

const storeFindings = (h: MemHarness, s: Session, run: string, list: unknown[]) =>
  call(
    h,
    'POST',
    `/api/runs/${run}/findings`,
    { client_op_id: op(), findings: list },
    {
      cookie: s.cookie,
    },
  );

describe('memory write limits (review M1)', () => {
  test('caps are code defaults sized to a demo session', () => {
    expect(MEMORY_WRITE_CAPS).toEqual({ requestsPerDay: 600, runsPerDay: 5, findingsPerDay: 2000 });
  });

  test('at the per-workspace request cap every write is 429 and writes nothing; reads still work', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const other = await session(h);
    await setCounter(s.workspaceId, 'req', h.clock.now, MEMORY_WRITE_CAPS.requestsPerDay);
    const before = await dumpWorkspace(env.DB, s.workspaceId);
    h.resetStats();
    const r = await decide(h, s, { runId: run, quote: 'Flood attempt.' });
    expect(r.status).toBe(429);
    expect(r.body.error).toMatchObject({ code: 'rate_limited', reason: 'workspace_write_limit' });
    expect(r.res.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(h.stats.rowsWritten).toBe(0);
    expect(await dumpWorkspace(env.DB, s.workspaceId)).toBe(before);
    expect(
      (await call(h, 'GET', '/api/audit?limit=1', undefined, { cookie: s.cookie })).status,
    ).toBe(200);
    // per workspace: another sandbox is unaffected
    const run2 = await newRun(h, other);
    expect((await decide(h, other, { runId: run2, quote: 'Other ws ok.' })).status).toBe(200);
  });

  test('write-flood scenario: a loop of writes in one sandbox stops at the cap', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    await setCounter(s.workspaceId, 'req', h.clock.now, MEMORY_WRITE_CAPS.requestsPerDay - 3);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++)
      statuses.push((await decide(h, s, { runId: run, quote: `Flood ${i}.` })).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429, 429]);
  });

  test('the per-workspace run cap refuses the next run with 429 workspace_run_limit', async () => {
    const h = makeMem();
    const s = await session(h);
    for (let i = 0; i < MEMORY_WRITE_CAPS.runsPerDay; i++) await newRun(h, s);
    const n = async () =>
      (
        await env.DB.prepare('SELECT COUNT(*) AS n FROM review_run WHERE workspace_id = ?1')
          .bind(s.workspaceId)
          .first<{ n: number }>()
      )?.n;
    const runsBefore = await n();
    await expect(newRun(h, s)).rejects.toThrow(/429.*workspace_run_limit/);
    expect(await n()).toBe(runsBefore);
  });

  test('the per-workspace findings cap refuses a chunk that would cross it (no rows stored)', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    await setCounter(s.workspaceId, 'fnd', h.clock.now, MEMORY_WRITE_CAPS.findingsPerDay - 10);
    const r = await storeFindings(h, s, run, findings(11, 'over'));
    expect(r.status).toBe(429);
    expect(r.body.error).toMatchObject({
      code: 'rate_limited',
      reason: 'workspace_findings_limit',
    });
    const stored = await env.DB.prepare('SELECT COUNT(*) AS n FROM finding WHERE workspace_id = ?1')
      .bind(s.workspaceId)
      .first<{ n: number }>();
    expect(stored?.n).toBe(0);
    expect((await storeFindings(h, s, run, findings(10, 'fits'))).status).toBe(200);
  });

  test('caps reset on the next UTC day', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    await setCounter(s.workspaceId, 'req', h.clock.now, MEMORY_WRITE_CAPS.requestsPerDay);
    expect((await decide(h, s, { runId: run, quote: 'Day one.' })).status).toBe(429);
    h.clock.now += 86_400_000;
    expect((await decide(h, s, { runId: run, quote: 'Day two.' })).status).toBe(200);
  });
});

describe('findings chunk cap (review L5, S10)', () => {
  test(`more than ${FINDINGS_CHUNK_MAX} findings is 413 findings_chunk; ${FINDINGS_CHUNK_MAX} is accepted`, async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const big = await storeFindings(h, s, run, findings(FINDINGS_CHUNK_MAX + 1, 'big'));
    expect(big.status).toBe(413);
    expect(big.body.error).toMatchObject({ code: 'payload_too_large', reason: 'findings_chunk' });
    const okr = await storeFindings(h, s, run, findings(FINDINGS_CHUNK_MAX, 'ok'));
    expect(okr.status).toBe(200);
    expect(okr.body.stored).toBe(FINDINGS_CHUNK_MAX);
  });
});

describe('safe-charset client ids (review L2)', () => {
  test('client_op_id and finding_ref outside the Id charset are 400 id_charset', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    for (const extra of [
      { clientOpId: 'op <script>x</script>' },
      { findingRef: 'f "quoted" ref' },
      { findingRef: 'f\nnewline' },
    ]) {
      const r = await decide(h, s, { runId: run, quote: 'Charset check.', ...extra });
      expect(r.status).toBe(400);
      expect(r.body.error).toMatchObject({ code: 'invalid_request', reason: 'id_charset' });
    }
  });

  test('a finding id outside the Id charset is refused; blockId/detector_id/model are masked', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const bad = await storeFindings(h, s, run, [
      wireFinding('firm-x', 'Bad id.', { id: 'fk <img>' }),
    ]);
    expect(bad.status).toBe(400);
    expect(bad.body.error.reason).toBe('id_charset');
    const f = {
      ...wireFinding('firm-x', 'Masked fields.', { severity: 'low' }),
      detector_kind: 'ai',
      provenance: 'fresh',
      detector_id: 'det 021000021998',
      model: 'model 021000021998',
    };
    f.anchor = { ...f.anchor, blockId: 'b 021000021998' };
    expect((await storeFindings(h, s, run, [f])).status).toBe(200);
    const dump = await dumpWorkspace(env.DB, s.workspaceId);
    expect(dump).not.toContain('021000021998');
  });
});

describe('rule transitions are audited once (review L4)', () => {
  async function proposedRule(ws: string, id: string): Promise<void> {
    await env.DB.prepare(
      "INSERT INTO firm_rule (workspace_id, id, law_firm_id, origin, status, rule_text, created_by_name, created_at) VALUES (?1, ?2, 'firm-x', 'proposed', 'proposed', 'Proposed rule text', 'T', 1)",
    )
      .bind(ws, id)
      .run();
  }
  const approvedEvents = async (ws: string, id: string) =>
    (
      await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM audit_event WHERE workspace_id = ?1 AND entity_id = ?2 AND action = 'rule_approved'",
      )
        .bind(ws, id)
        .first<{ n: number }>()
    )?.n;

  test('a concurrent double-approve with different ops writes ONE rule_approved event', async () => {
    const h = makeMem();
    const s = await session(h);
    await proposedRule(s.workspaceId, 'fr_race1');
    const approve = () =>
      call(
        h,
        'POST',
        '/api/rules/fr_race1/approve',
        { client_op_id: op('apr') },
        {
          cookie: s.cookie,
        },
      );
    const rs = await Promise.all([approve(), approve()]);
    const statuses = rs.map((r) => r.status).sort();
    expect(statuses[0]).toBe(200);
    expect([400, 409]).toContain(statuses[1]);
    expect(await approvedEvents(s.workspaceId, 'fr_race1')).toBe(1);
  });

  test('the conditional audit insert writes nothing when the rule left the expected status', async () => {
    const h = makeMem();
    const s = await session(h);
    await proposedRule(s.workspaceId, 'fr_race2');
    const first = await call(
      h,
      'POST',
      '/api/rules/fr_race2/approve',
      { client_op_id: op('apr') },
      { cookie: s.cookie },
    );
    expect(first.status).toBe(200);
    // the losing batch of a race: same statement shape, prior status 'proposed' no longer true
    const r = await env.DB.prepare(AUDIT_SQL.insertIfRuleStatus)
      .bind(
        s.workspaceId,
        'ae_race2',
        'op-race2-lost',
        2,
        s.analystId,
        'T',
        'rule_approved',
        'firm-x',
        'rule',
        'fr_race2',
        null,
        null,
        null,
        'proposed',
      )
      .run();
    expect(r.meta.changes).toBe(0);
    expect(await approvedEvents(s.workspaceId, 'fr_race2')).toBe(1);
  });
});
