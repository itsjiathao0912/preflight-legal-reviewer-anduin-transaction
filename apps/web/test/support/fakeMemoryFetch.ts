/**
 * Shared in-process fake `fetch` for the Worker memory routes (Phase 08 S0 fixture). It mirrors the
 * Worker's status codes and `{error:{code,message,reason?,retry_after_s?}}` bodies so
 * `realMemoryApi.ts` (S1) can run the same `api-contract` cases as the Dexie stub without a Worker.
 * It is NOT a re-implementation of the Worker: only the behaviour the contract cases assert.
 */
type Json = Record<string, unknown>;

export interface FakeMemoryOptions {
  readOnly?: boolean;
  now?: () => number;
  /** Force the next write to fail with this wire error (one-shot). */
  failNextWrite?: { status: number; code: string; reason?: string; retry_after_s?: number };
  /** Workspace id minted by POST /api/session (S1: lets tests switch workspaces). */
  workspaceId?: () => string;
}

/** One recorded request (S1: lets realMemoryApi tests assert the exact wire shape). */
export interface FakeCall {
  method: string;
  path: string;
  search: string;
  headers: Record<string, string>;
  credentials: RequestCredentials | undefined;
  body: Json;
}

interface Run {
  id: string;
  law_firm_id: string | null;
  stored: Set<string>;
}

const HEX64 = /^[0-9a-f]{64}$/;
const PATTERN_KEY_RE = /^[a-z0-9:#>-]{1,80}$/;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
function err(status: number, code: string, reason?: string, extra: Json = {}): Response {
  return json(status, {
    error: { code, message: reason ?? code, ...(reason ? { reason } : {}) },
    ...extra,
  });
}

export function createFakeMemoryFetch(opts: FakeMemoryOptions = {}) {
  const now = opts.now ?? (() => 1_700_000_000_000);
  let n = 0;
  const id = (p: string) => `${p}_${String(++n).padStart(8, '0')}`;
  const ops = new Set<string>();
  const runs = new Map<string, Run>();
  const runKeys = new Map<string, string>();
  const decisions: Json[] = [];
  const questions = new Map<string, { fingerprint: string; law_firm_id: string }>();
  const rules = new Map<string, Json & { law_firm_id: string }>();
  const audit: Json[] = [];
  const calls: FakeCall[] = [];
  let session = false;
  const record = (action: string, law_firm_id?: unknown) =>
    audit.unshift({
      id: id('ev'),
      at: now(),
      actor_name: 'Fake Analyst',
      action,
      ...(typeof law_firm_id === 'string' ? { law_firm_id } : {}),
    });

  const fetchImpl = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://fake.local');
    const method = (init.method ?? 'GET').toUpperCase();
    const body = (init.body ? JSON.parse(String(init.body)) : {}) as Json;
    const path = url.pathname;
    calls.push({
      method,
      path,
      search: url.search,
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      credentials: init.credentials,
      body,
    });

    if (path === '/api/memory/health') {
      return json(200, {
        ok: true,
        schema_version: '5',
        expected_schema_version: '5',
        seed_mode: '0',
        seed_version: null,
      });
    }
    if (method === 'POST' && path === '/api/session') {
      const name = String(body.analyst_name ?? '').trim();
      if (name.length < 1 || name.length > 80) return err(400, 'invalid_request', 'analyst_name');
      session = true;
      return json(200, {
        workspace_id: opts.workspaceId ? opts.workspaceId() : 'ws_fake0001',
        analyst_id: 'an_fake0001',
        kind: opts.readOnly ? 'visitor' : 'sandbox',
        expires_at: now() + 86_400_000,
        read_only: !!opts.readOnly,
      });
    }
    if (!session) return err(401, 'invalid_session');

    // lookup is a read on the Worker (`write: false`), so read-only sessions may call it
    if (method === 'POST' && path !== '/api/memory/lookup') {
      if (opts.readOnly) return err(403, 'read_only_demo');
      if (opts.failNextWrite) {
        const f = opts.failNextWrite;
        opts.failNextWrite = undefined;
        return json(f.status, {
          error: {
            code: f.code,
            message: f.code,
            ...(f.reason ? { reason: f.reason } : {}),
            ...(f.retry_after_s !== undefined ? { retry_after_s: f.retry_after_s } : {}),
          },
        });
      }
      const op = body.client_op_id;
      if (typeof op === 'string') {
        if (ops.has(op)) return err(400, 'invalid_request', 'op_reused');
        ops.add(op);
      }
    }

    if (method === 'POST' && path === '/api/runs') {
      const key = `${String(body.law_firm_id ?? '')}|${String(body.doc_hash)}|${String(body.settings_hash)}`;
      const existing = runKeys.get(key);
      if (existing) return json(200, { run_id: existing });
      const run: Run = {
        id: id('r'),
        law_firm_id: (body.law_firm_id as string | null) ?? null,
        stored: new Set(),
      };
      runs.set(run.id, run);
      runKeys.set(key, run.id);
      return json(200, { run_id: run.id });
    }
    let m = /^\/api\/runs\/([^/]+)\/(findings|export)$/.exec(path);
    if (method === 'POST' && m) {
      const run = runs.get(m[1]!);
      if (!run) return err(400, 'invalid_request', 'run_not_found');
      if (m[2] === 'findings') {
        const list = (body.findings as { id: string }[]) ?? [];
        if (list.length < 1 || list.length > 25) return err(400, 'invalid_request', 'findings');
        let stored = 0;
        for (const f of list) {
          if (run.stored.has(f.id)) continue;
          run.stored.add(f.id);
          stored++;
        }
        return json(200, { stored });
      }
      record('counsel_sheet_exported', run.law_firm_id);
      return json(200, {
        ok: true,
        run_id: run.id,
        sheet_exported_at: now(),
        sheet_question_count: Number(body.question_count ?? 0),
      });
    }
    if (method === 'POST' && path === '/api/decisions') {
      if (!body.run_id) return err(400, 'invalid_request', 'run_required');
      if (body.pattern_key !== undefined && !PATTERN_KEY_RE.test(String(body.pattern_key)))
        return err(400, 'invalid_request', 'pattern_key');
      const run = runs.get(String(body.run_id));
      if (!run) return err(400, 'invalid_request', 'run_not_found');
      if (!run.law_firm_id) return err(400, 'invalid_request', 'firm_required');
      if (!HEX64.test(String(body.fingerprint))) return err(400, 'invalid_request', 'fingerprint');
      if (body.decision === 'dismissed' && !body.reason_code)
        return err(400, 'invalid_request', 'reason_code');
      const d = {
        id: id('d'),
        fingerprint: body.fingerprint,
        status: 'active',
        decision: body.decision,
        ...(body.reason_code ? { reason_code: body.reason_code } : {}),
        issue_class: body.issue_class,
        fund_name: body.fund_name ?? '',
        decided_by_name: 'Fake Analyst',
        decided_at: now(),
      };
      for (const p of decisions)
        if (p.fingerprint === d.fingerprint && p.status === 'active') p.status = 'superseded';
      decisions.push({ ...d, law_firm_id: run.law_firm_id });
      record('decision_recorded', run.law_firm_id);
      return json(200, { decision: d });
    }
    m = /^\/api\/decisions\/([^/]+)\/revoke$/.exec(path);
    if (method === 'POST' && m) {
      const d = decisions.find((x) => x.id === m![1]);
      if (!d) return err(400, 'invalid_request', 'decision_not_found');
      d.status = 'revoked';
      record('decision_revoked', d.law_firm_id);
      return json(200, { ok: true, current: null });
    }
    if (method === 'POST' && path === '/api/counsel/questions') {
      const run = [...runs.values()].find((r) => r.stored.has(String(body.finding_ref)));
      if (!run) return err(400, 'invalid_request', 'finding_ref');
      if (!run.law_firm_id) return err(400, 'invalid_request', 'firm_required');
      const q = id('q');
      questions.set(q, { fingerprint: String(body.fingerprint), law_firm_id: run.law_firm_id });
      return json(200, { question_id: q });
    }
    if (method === 'POST' && path === '/api/counsel/answers') {
      const q = questions.get(String(body.question_id));
      if (!q) return err(400, 'invalid_request', 'question_not_found');
      if (q.fingerprint !== body.fingerprint) return err(422, 'fingerprint_mismatch');
      record('answer_recorded', q.law_firm_id);
      return json(200, {
        answer_id: id('ans'),
        decision: {
          id: id('d'),
          fingerprint: body.fingerprint,
          status: 'active',
          decision: 'answered',
          counsel_option: body.option,
          fund_name: '',
          decided_by_name: 'Fake Analyst',
          decided_at: now(),
        },
      });
    }
    if (method === 'POST' && path === '/api/memory/lookup') {
      const fps = new Set((body.fingerprints as string[]) ?? []);
      return json(200, {
        decisions: decisions
          .filter(
            (d) =>
              d.law_firm_id === body.law_firm_id &&
              d.status === 'active' &&
              fps.has(String(d.fingerprint)),
          )
          .map(({ law_firm_id: _f, ...d }) => d),
      });
    }
    if (method === 'GET' && path === '/api/audit') {
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '50')));
      const from = Number(url.searchParams.get('cursor') ?? '0') || 0;
      const events = audit.slice(from, from + limit);
      return json(200, {
        events,
        ...(from + limit < audit.length ? { next_cursor: String(from + limit) } : {}),
      });
    }
    const firmQ = url.searchParams.get('law_firm_id');
    const ruleOut = ({ law_firm_id: _f, ...r }: Json) => r;
    const firmRules = (firm: string) =>
      [...rules.values()].filter((r) => r.law_firm_id === firm && r.status !== 'revoked');
    if (path === '/api/rules' && method === 'GET') {
      if (!firmQ) return err(400, 'invalid_request', 'law_firm_id');
      return json(200, { rules: firmRules(firmQ).map(ruleOut) });
    }
    if (path === '/api/rules' && method === 'POST') {
      if (!firmQ) return err(400, 'invalid_request', 'law_firm_id');
      if (!body.text) return err(400, 'invalid_request', 'text_required');
      const r = {
        id: id('fr'),
        text: String(body.text),
        status: 'active',
        origin: 'manual',
        evidence_count: 0,
        law_firm_id: firmQ,
      };
      rules.set(r.id, r);
      record('rule_added', firmQ);
      return json(200, { rule: ruleOut(r) });
    }
    m = /^\/api\/rules\/([^/]+)\/(approve|reject|revoke)$/.exec(path);
    if (method === 'POST' && m) {
      const r = rules.get(m[1]!);
      if (!r) return err(400, 'invalid_request', 'rule_not_found');
      const from = m[2] === 'revoke' ? 'active' : 'proposed';
      if (r.status !== from) return err(400, 'invalid_request', 'rule_state');
      r.status = m[2] === 'approve' ? 'active' : m[2] === 'reject' ? 'rejected' : 'revoked';
      record(
        `rule_${m[2] === 'approve' ? 'approved' : m[2] === 'reject' ? 'rejected' : 'revoked'}`,
        r.law_firm_id,
      );
      const out = ruleOut(r);
      return json(200, {
        rule: { ...out, status: r.status === 'revoked' ? 'rejected' : r.status },
      });
    }
    if (method === 'GET' && path === '/api/memory/firm') {
      if (!firmQ) return err(400, 'invalid_request', 'law_firm_id');
      const ds = decisions
        .filter((d) => d.law_firm_id === firmQ && d.status === 'active')
        .map(({ law_firm_id: _f, ...d }) => d);
      const rs = firmRules(firmQ).map(ruleOut);
      return json(200, {
        decisions: ds,
        rules: rs,
        counts: {
          decisions: ds.length,
          dismissed: ds.filter((d) => d.decision === 'dismissed').length,
          answered: ds.filter((d) => d.decision === 'answered').length,
          awaiting: ds.filter((d) => d.decision === 'accepted').length,
          rules_active: rs.filter((r) => r.status === 'active').length,
          rules_proposed: rs.filter((r) => r.status === 'proposed').length,
        },
      });
    }
    return err(404, 'invalid_request', 'not_found');
  };
  return { fetch: fetchImpl as typeof fetch, calls };
}
