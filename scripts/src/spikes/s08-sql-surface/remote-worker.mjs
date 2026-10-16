// Remote spike Worker for Phase 04b (S8 remote, S9, S10, cron on Free). Deployed ONLY as a
// throwaway `aduin-transaction-spike-*` Worker on workers.dev bound to the throwaway
// `aduin-transaction-spike-db`, with NO secrets of any kind: the cookie key used to exercise the real
// session route is generated in memory per isolate and never leaves it. Deleted after the run.
// Runner: scripts/src/spikes/s09-rows-written/run-remote.sh
import {
  quoteHash,
  fingerprint,
  sha256Hex,
  signCookie,
  verifyCookie,
  StoreFindingsRequestSchema,
} from '@aduin/core';
import { createApp } from '../../../../apps/worker/src/app';
import { meteredDb } from '../../../../apps/worker/src/db/meta';
import { claimPurgeSlot } from '../../../../apps/worker/src/memory/repo/purge';
import { LOOKUP_SQL } from '../../../../apps/worker/src/memory/repo/lookup';

const ORIGIN_HDR = (url) => new URL(url).origin;
let keyCache = '';
/** Per-isolate random key, created lazily inside a handler (random values are banned at import). */
function ephemeralKey() {
  if (!keyCache)
    keyCache = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
  return keyCache;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 1), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function errorText(p) {
  try {
    await p;
    return '';
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

function finding(firm, quote, i) {
  return {
    id: `fk-${i}-${Math.floor(Math.random() * 1e9)}`,
    issue_class: 'defined_term_issue',
    severity: 'medium',
    detector_kind: 'rule',
    detector_id: 'undefined-term',
    confidence: 0.9,
    anchor: { docHash: quoteHash('doc'), blockId: `b-${i}`, offsetStart: 0, offsetEnd: 10 },
    section_path: ['Part B'],
    quote_snippet: quote,
    quote_hash: quoteHash(quote),
    fingerprint: fingerprint(firm, 'defined_term_issue', quoteHash(quote)),
    detail: { explanation: 'x', facts: {}, interpretations: [] },
  };
}

/** S9: rows written by the REAL endpoints on remote D1 (session, 200-finding run, a decision). */
async function s9(env, url) {
  const m = meteredDb(env.DB);
  const e = {
    DB: m.db,
    COOKIE_SIGNING_KEYS: JSON.stringify({ k1: ephemeralKey() }),
    COOKIE_SIGNING_KID: 'k1',
  };
  const app = createApp({
    fetch: () => Promise.reject(new Error('no outbound in spike')),
    now: () => Date.now(),
    proxy: { log: () => {} },
  });
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const origin = ORIGIN_HDR(url);
  let cookie = '';
  const call = async (method, path, body) => {
    const headers = {
      'x-aduin-client': '1',
      'cf-connecting-ip': `192.0.2.${Math.floor(Math.random() * 200)}`,
    };
    if (method !== 'GET') Object.assign(headers, { origin, 'content-type': 'application/json' });
    if (cookie) headers.cookie = cookie;
    const res = await app.fetch(
      new Request(`${origin}${path}`, {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(body),
      }),
      e,
      ctx,
    );
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
  const out = {};
  const take = (name, extra = {}) => {
    out[name] = {
      queries: m.stats.queries,
      rows_written: m.stats.rowsWritten,
      rows_read: m.stats.rowsRead,
      ...extra,
    };
    m.reset();
  };
  await claimPurgeSlot(env.DB, Date.now()); // measure the common session path (slot already taken)
  m.reset();
  const s = await call('POST', '/api/session', { analyst_name: 'Spike (simulated analyst)' });
  take('session', { status: s.status });
  const run = await call('POST', '/api/runs', {
    client_op_id: `spike-run-${Date.now()}`,
    doc_name: 'spike.html',
    doc_hash: sha256Hex(`doc-${Math.random()}`),
    law_firm_id: 'firm-x',
    fund_name: 'Spike Fund',
    settings_hash: sha256Hex('settings'),
  });
  take('run', { status: run.status });
  for (let c = 0; c < 4; c++) {
    const findings = Array.from({ length: 50 }, (_, i) =>
      finding('firm-x', `Spike sentence ${c}-${i}.`, c * 50 + i),
    );
    const r = await call('POST', `/api/runs/${run.body.run_id}/findings`, {
      client_op_id: `spike-f-${c}-${Date.now()}`,
      findings,
    });
    if (r.status !== 200) out.findings_error = r.body;
  }
  take('findings_200');
  const quote = 'Spike dismissal quote.';
  const d = await call('POST', '/api/decisions', {
    client_op_id: `spike-d-${Date.now()}`,
    run_id: run.body.run_id,
    finding_ref: 'fk-0',
    decision: 'dismissed',
    reason_code: 'no_form_impact',
    quote_text: quote,
    fingerprint: fingerprint('firm-x', 'defined_term_issue', quoteHash(quote)),
    issue_class: 'defined_term_issue',
    pattern_key: 'spike:key',
  });
  take('decision', { status: d.status });
  const l = await call('POST', '/api/memory/lookup', {
    law_firm_id: 'firm-x',
    fingerprints: Array.from({ length: 200 }, (_, i) =>
      fingerprint('firm-x', 'defined_term_issue', quoteHash(`Spike sentence 0-${i}.`)),
    ),
  });
  take('lookup_200', { status: l.status });
  return out;
}

/** S8 remote: SQL surface facts on the remote D1 engine. */
async function s8(env) {
  const db = env.DB;
  const facts = {};
  facts.foreign_keys = await db.prepare('PRAGMA foreign_keys').first();
  facts.schema_version = await db
    .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
    .first('value');
  const plan = await errorText(
    db
      .prepare(`EXPLAIN QUERY PLAN ${LOOKUP_SQL.lookup}`)
      .bind('w', 'firm-x', '[]')
      .all()
      .then((r) => {
        facts.lookup_plan = r.results.map((x) => x.detail).join(' | ');
      }),
  );
  if (plan) facts.lookup_plan_error = plan;
  const fps = Array.from({ length: 200 }, (_, i) => sha256Hex(`x${i}`));
  facts.json_each_200 = await errorText(
    db.prepare(LOOKUP_SQL.lookup).bind('ws_demo', 'firm-x', JSON.stringify(fps)).all(),
  );
  const q = (n) => `SELECT ${Array.from({ length: n }, (_, i) => `?${i + 1}`).join(' + ')} AS s`;
  facts.params_100 = await errorText(
    db
      .prepare(q(100))
      .bind(...Array(100).fill(1))
      .first(),
  );
  facts.params_101 = await errorText(
    db
      .prepare(q(101))
      .bind(...Array(101).fill(1))
      .first(),
  );
  const ws = `w_spike${Date.now().toString(16)}`;
  await db.batch([
    db
      .prepare(
        "INSERT INTO workspace (id, kind, status, created_at, last_active_at, expires_at) VALUES (?1, 'sandbox', 'active', 1, 1, 9999999999999)",
      )
      .bind(ws),
  ]);
  const audit = (op) =>
    db
      .prepare(
        "INSERT INTO audit_event (workspace_id, id, client_op_id, at, actor_name, action) VALUES (?1, ?2, ?3, 0, 'T', 'decision_recorded')",
      )
      .bind(ws, `ae${Math.random()}`, op);
  await audit('op-remote-1').run();
  facts.op_replay_text = await errorText(audit('op-remote-1').run());
  const dec = (id, fp) =>
    db
      .prepare(
        "INSERT INTO decision (workspace_id, id, law_firm_id, fingerprint, issue_class, quote_hash, quote_snippet, fund_name, decision, decided_by_name, decided_at) VALUES (?1, ?2, 'firm-x', ?3, 'ambiguity', ?3, 's', 'F', 'accepted', 'T', 1)",
      )
      .bind(ws, id, fp);
  const fp = sha256Hex(`fp-${ws}`);
  await dec('d1', fp).run();
  facts.active_conflict_text = await errorText(dec('d2', fp).run());
  facts.trigger_text = await errorText(
    db.prepare('DELETE FROM decision WHERE workspace_id = ?1').bind(ws).run(),
  );
  facts.demo_block_text = await errorText(
    db.prepare("UPDATE decision SET note = 'x' WHERE workspace_id = 'ws_demo'").run(),
  );
  facts.batch_atomic = await errorText(db.batch([dec('d3', sha256Hex('d3')), dec('d4', fp)]));
  facts.batch_atomic_left = await db
    .prepare("SELECT COUNT(*) AS n FROM decision WHERE workspace_id = ?1 AND id = 'd3'")
    .bind(ws)
    .first('n');
  await db.prepare("UPDATE workspace SET status = 'purging' WHERE id = ?1").bind(ws).run();
  facts.purge_delete = await errorText(
    db.batch(
      ['rule_evidence', 'finding_state', 'decision', 'audit_event']
        .map((t) => db.prepare(`DELETE FROM ${t} WHERE workspace_id = ?1`).bind(ws))
        .concat([db.prepare('DELETE FROM workspace WHERE id = ?1').bind(ws)]),
    ),
  );
  return facts;
}

/** S8 remote: do D1 queries and fetches share the per-invocation budget? */
async function budget(env, url) {
  const p = new URL(url).searchParams;
  const nq = Number(p.get('q') ?? 0);
  const nf = Number(p.get('f') ?? 0);
  const nb = Number(p.get('b') ?? 0);
  const res = { q: nq, f: nf, b: nb };
  try {
    for (let i = 0; i < nq; i++) await env.DB.prepare('SELECT ?1 AS i').bind(i).first();
    if (nb)
      await env.DB.batch(
        Array.from({ length: nb }, (_, i) => env.DB.prepare('SELECT ?1 AS i').bind(i)),
      );
    for (let i = 0; i < nf; i++) await (await fetch(`${new URL(url).origin}/ping`)).text();
    res.ok = true;
  } catch (e) {
    res.ok = false;
    res.error = e instanceof Error ? e.message : String(e);
  }
  return res;
}

/** S10: memory-path CPU (HMAC verify, 128 KB JSON parse, @noble sha256, zod vs raw). */
async function s10(request, url) {
  const mode = new URL(url).searchParams.get('mode') ?? 'zod';
  const text = await request.text();
  const now = Math.floor(Date.now() / 1000);
  const cookie = await signCookie(
    { v: 'v1', w: 'w1', a: 'a1', iat: now, exp: now + 60, kid: 'k1' },
    ephemeralKey(),
  );
  const v = await verifyCookie(cookie, { k1: ephemeralKey() }, now);
  const body = JSON.parse(text);
  let hashes = 0;
  for (const f of body.findings ?? []) {
    sha256Hex(f.quote_snippet);
    hashes++;
  }
  let parsed = false;
  if (mode === 'zod') parsed = StoreFindingsRequestSchema.safeParse(body).success;
  return { mode, bytes: text.length, verified: v.ok, hashes, parsed };
}

export default {
  async fetch(request, env) {
    const url = request.url;
    const { pathname } = new URL(url);
    try {
      if (pathname === '/ping') return new Response('pong');
      if (pathname === '/s9') return json(await s9(env, url));
      if (pathname === '/s8') return json(await s8(env));
      if (pathname === '/budget') return json(await budget(env, url));
      if (pathname === '/s10' && request.method === 'POST') return json(await s10(request, url));
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  },
  async scheduled(controller) {
    console.log(
      JSON.stringify({
        event: 'spike-cron-fired',
        cron: controller.cron,
        at: controller.scheduledTime,
      }),
    );
  },
};
