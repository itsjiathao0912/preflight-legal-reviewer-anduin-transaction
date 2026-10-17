import {
  AuditQuerySchema,
  AuditResponseSchema,
  CreateSessionRequestSchema,
  CreateSessionResponseSchema,
  ErrorBodySchema,
  FirmMemoryResponseSchema,
  LAW_FIRMS,
  MemoryLookupRequestSchema,
  MemoryLookupResponseSchema,
  QuotaResponseSchema,
  RevokeDecisionRequestSchema,
  RevokeDecisionResponseSchema,
  RuleActionRequestSchema,
  RuleActionResponseSchema,
  RulesResponseSchema,
  type ActiveDecision,
  type AuditEvent,
  type Rule,
} from '@aduin/core';
import { expect, type Page, type Request, type Route } from '@playwright/test';

/**
 * Phase 08b fake Worker for the preview memory-ui specs. The preview build keeps the Dexie stub,
 * so a spec opts into the real client (`__aduinE2E.useRealMemory(true)` + `setApiBase('/')`) and
 * this stateful `page.route('/api/**')` handler answers exactly the routes the real client calls
 * (paths as in apps/worker/src/routes/memory/index.ts; /api/quota from routes/proxy; /api/health
 * and /api/memory/health from app.ts / the memory routes). Every request and response body is
 * validated with the core zod schemas. Any other /api request gets an explicit 404 and is
 * recorded in `unexpected`, so a missing route fails loudly instead of hanging.
 */

export interface FakeDecision extends ActiveDecision {
  law_firm_id: string;
}
export interface FakeRule extends Rule {
  law_firm_id: string;
}

export interface FakeInit {
  readOnly?: boolean;
  decisions?: FakeDecision[];
  rules?: FakeRule[];
  /** Pre-existing audit events (any order; served newest first). */
  audit?: AuditEvent[];
}

export interface Recorded {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
}

type Failure = { status: number; body?: unknown } | 'abort';

export interface FakeWorker {
  calls: Recorded[];
  unexpected: string[];
  invalid: string[];
  decisions: FakeDecision[];
  rules: FakeRule[];
  audit: AuditEvent[];
  /** One-shot failure for the next request matching method + path. */
  failNext(method: string, path: RegExp, failure: Failure): void;
  callsTo(method: string, path: RegExp): Recorded[];
  /** Asserts no unexpected route and no schema-invalid request body was seen. */
  expectClean(): void;
}

const FP_RE = /^[0-9a-f]{64}$/;
const FIRMS = new Set(LAW_FIRMS.map((f) => f.id));
const ACTIVE_RULE_CAP = 100;
let idSeq = 0;
const nextId = (p: string) => `${p}_${Date.now().toString(36)}${(++idSeq).toString(36)}`;

export function errorBody(code: string, reason?: string, extra: Record<string, unknown> = {}) {
  const body = { error: { code, message: 'Refused.', ...(reason ? { reason } : {}) } };
  ErrorBodySchema.parse(body);
  return { ...body, ...extra };
}

/** Strip the fake-only `law_firm_id` (the wire ActiveDecision has none). */
function wireDecision(d: FakeDecision): ActiveDecision {
  const { law_firm_id: _f, ...rest } = d;
  return rest;
}
function wireRule(r: FakeRule): Rule {
  const { law_firm_id: _f, ...rest } = r;
  return rest;
}

export async function installFakeWorker(page: Page, init: FakeInit = {}): Promise<FakeWorker> {
  const decisions: FakeDecision[] = [...(init.decisions ?? [])];
  const rules: FakeRule[] = [...(init.rules ?? [])];
  const audit: AuditEvent[] = [...(init.audit ?? [])];
  const calls: Recorded[] = [];
  const unexpected: string[] = [];
  const invalid: string[] = [];
  const failures: { method: string; path: RegExp; failure: Failure }[] = [];
  let actor = 'Linh Tran';
  let clock = Math.max(Date.now(), ...audit.map((e) => e.at + 1));

  const log = (e: Omit<AuditEvent, 'id' | 'at' | 'actor_name'>) => {
    audit.push({ id: nextId('ae'), at: ++clock, actor_name: actor, ...e });
  };

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify(body),
    });

  const parse = <T>(
    schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
    v: unknown,
    label: string,
  ): T | null => {
    const r = schema.safeParse(v);
    if (r.success) return r.data as T;
    invalid.push(`${label}: ${JSON.stringify(v)}`);
    return null;
  };

  const activeCount = (firm: string) =>
    rules.filter((r) => r.law_firm_id === firm && r.status === 'active').length;

  const handler = async (route: Route, req: Request) => {
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const query = Object.fromEntries(url.searchParams.entries());
    let body: unknown = undefined;
    if (method === 'POST') {
      try {
        body = req.postDataJSON();
      } catch {
        body = req.postData();
      }
    }
    calls.push({ method, path, query, body });

    const fi = failures.findIndex((f) => f.method === method && f.path.test(path));
    if (fi >= 0) {
      const [f] = failures.splice(fi, 1);
      if (f!.failure === 'abort') return route.abort('failed');
      return json(route, f!.failure.status, f!.failure.body ?? {});
    }

    const isWrite = method === 'POST' && path !== '/api/session' && path !== '/api/memory/lookup';
    if (isWrite && init.readOnly) return json(route, 403, errorBody('read_only_demo'));

    // ---- session, health, quota
    if (method === 'POST' && path === '/api/session') {
      const r = parse<{ analyst_name: string }>(CreateSessionRequestSchema, body, 'session');
      if (!r) return json(route, 400, errorBody('invalid_request', 'body'));
      actor = r.analyst_name;
      const res = CreateSessionResponseSchema.parse({
        workspace_id: 'ws_fake',
        analyst_id: 'an_fake',
        kind: 'sandbox',
        expires_at: Math.floor(Date.now() / 1000) + 86_400,
        read_only: init.readOnly === true,
      });
      log({ action: 'session_created', entity_type: 'session', entity_id: 'an_fake' });
      return json(route, 200, res);
    }
    if (method === 'GET' && path === '/api/health') return json(route, 200, { ok: true });
    if (method === 'GET' && path === '/api/memory/health')
      return json(route, 200, {
        ok: true,
        schema_version: '5',
        expected_schema_version: '5',
        seed_mode: '0',
      });
    if (method === 'GET' && path === '/api/quota') {
      const resets_at = Math.floor(Date.now() / 1000) + 3600;
      return json(
        route,
        200,
        QuotaResponseSchema.parse({
          ai: { used: 0, limit: 3, resets_at },
          ocr_pages: { used: 0, limit: 30, resets_at },
          global_ok: true,
        }),
      );
    }

    // ---- memory reads
    if (method === 'POST' && path === '/api/memory/lookup') {
      const r = parse<{ law_firm_id: string; fingerprints: string[] }>(
        MemoryLookupRequestSchema,
        body,
        'lookup',
      );
      if (!r) return json(route, 400, errorBody('invalid_request', 'body'));
      const want = new Set(r.fingerprints.filter((f) => FP_RE.test(f)));
      const out = decisions
        .filter((d) => d.law_firm_id === r.law_firm_id && d.status === 'active')
        .filter((d) => want.has(d.fingerprint))
        .map(wireDecision);
      return json(route, 200, MemoryLookupResponseSchema.parse({ decisions: out }));
    }
    if (method === 'GET' && (path === '/api/memory/firm' || path === '/api/rules')) {
      const firm = query['law_firm_id'] ?? '';
      if (!FIRMS.has(firm)) return json(route, 400, errorBody('invalid_request', 'unknown_firm'));
      const firmRules = rules.filter((r) => r.law_firm_id === firm).map(wireRule);
      if (path === '/api/rules')
        return json(route, 200, RulesResponseSchema.parse({ rules: firmRules }));
      const active = decisions
        .filter((d) => d.law_firm_id === firm && d.status === 'active')
        .sort((a, b) => b.decided_at - a.decided_at || (a.id < b.id ? 1 : -1));
      const res = {
        decisions: active.slice(0, 200).map(wireDecision),
        rules: firmRules,
        counts: {
          decisions: active.length,
          dismissed: active.filter((d) => d.decision === 'dismissed').length,
          answered: active.filter((d) => d.decision === 'answered').length,
          awaiting: 0,
          rules_active: firmRules.filter((r) => r.status === 'active').length,
          rules_proposed: firmRules.filter((r) => r.status === 'proposed').length,
        },
      };
      return json(route, 200, FirmMemoryResponseSchema.parse(res));
    }
    if (method === 'GET' && path === '/api/audit') {
      const q = parse<{ limit: number; cursor?: string }>(
        AuditQuerySchema,
        { limit: query['limit'] ?? '100', ...(query['cursor'] ? { cursor: query['cursor'] } : {}) },
        'audit',
      );
      if (!q) return json(route, 400, errorBody('invalid_request', 'query'));
      const sorted = [...audit].sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1));
      const from = q.cursor ? Number(q.cursor.replace(/^c/, '')) || 0 : 0;
      const page = sorted.slice(from, from + q.limit);
      const more = from + q.limit < sorted.length;
      return json(
        route,
        200,
        AuditResponseSchema.parse({
          events: page,
          ...(more ? { next_cursor: `c${from + q.limit}` } : {}),
        }),
      );
    }

    // ---- rule writes
    if (method === 'POST' && path === '/api/rules') {
      const firm = query['law_firm_id'] ?? '';
      const r = parse<{ client_op_id: string; text?: string }>(
        RuleActionRequestSchema,
        body,
        'createRule',
      );
      if (!r || !r.text) return json(route, 400, errorBody('invalid_request', 'body'));
      if (!FIRMS.has(firm)) return json(route, 400, errorBody('invalid_request', 'unknown_firm'));
      if (activeCount(firm) >= ACTIVE_RULE_CAP)
        return json(route, 429, errorBody('quota_exhausted', 'active_rule_cap'));
      const rule: FakeRule = {
        id: nextId('fr'),
        text: r.text,
        status: 'active',
        origin: 'manual',
        evidence_count: 0,
        law_firm_id: firm,
      };
      rules.push(rule);
      log({ action: 'rule_added', law_firm_id: firm, entity_type: 'rule', entity_id: rule.id });
      return json(route, 200, RuleActionResponseSchema.parse({ rule: wireRule(rule) }));
    }
    const ra = /^\/api\/rules\/([^/]+)\/(approve|reject|revoke)$/.exec(path);
    if (method === 'POST' && ra) {
      const id = decodeURIComponent(ra[1]!);
      const action = ra[2] as 'approve' | 'reject' | 'revoke';
      const r = parse<{ client_op_id: string; text?: string }>(
        RuleActionRequestSchema,
        body,
        `rule ${action}`,
      );
      if (!r) return json(route, 400, errorBody('invalid_request', 'body'));
      const rule = rules.find((x) => x.id === id);
      if (!rule) return json(route, 400, errorBody('invalid_request', 'rule_not_found'));
      const from = action === 'revoke' ? 'active' : 'proposed';
      if (rule.status !== from) return json(route, 400, errorBody('invalid_request', 'rule_state'));
      if (action === 'approve') {
        if (activeCount(rule.law_firm_id) >= ACTIVE_RULE_CAP)
          return json(route, 429, errorBody('quota_exhausted', 'active_rule_cap'));
        rule.status = 'active';
        if (r.text) rule.text = r.text;
      }
      if (action === 'reject') rule.status = 'rejected';
      const view = wireRule(rule);
      if (action === 'revoke') rules.splice(rules.indexOf(rule), 1);
      log({
        action:
          action === 'approve'
            ? 'rule_approved'
            : action === 'reject'
              ? 'rule_rejected'
              : 'rule_revoked',
        law_firm_id: rule.law_firm_id,
        entity_type: 'rule',
        entity_id: id,
        ...(action === 'revoke' ? { reason: r.text ?? 'revoked' } : {}),
      });
      return json(
        route,
        200,
        RuleActionResponseSchema.parse({
          rule: action === 'revoke' ? { ...view, status: 'rejected' } : view,
        }),
      );
    }

    // ---- decision revoke (Reopen)
    const dr = /^\/api\/decisions\/([^/]+)\/revoke$/.exec(path);
    if (method === 'POST' && dr) {
      const id = decodeURIComponent(dr[1]!);
      const r = parse<{ client_op_id: string; reason: string }>(
        RevokeDecisionRequestSchema,
        body,
        'revoke decision',
      );
      if (!r) return json(route, 400, errorBody('invalid_request', 'body'));
      const d = decisions.find((x) => x.id === id);
      if (!d) return json(route, 400, errorBody('invalid_request', 'decision_not_found'));
      if (d.status !== 'active')
        return json(
          route,
          409,
          errorBody('conflict_active_decision', undefined, { current: null }),
        );
      d.status = 'revoked';
      log({
        action: 'decision_revoked',
        law_firm_id: d.law_firm_id,
        entity_type: 'decision',
        entity_id: id,
        reason: r.reason,
        detail: { decision: d.decision },
      });
      return json(route, 200, RevokeDecisionResponseSchema.parse({ ok: true, current: null }));
    }

    unexpected.push(`${method} ${path}`);
    return json(route, 404, errorBody('invalid_request', 'no_route'));
  };

  await page.route('**/api/**', handler);

  return {
    calls,
    unexpected,
    invalid,
    decisions,
    rules,
    audit,
    failNext(method, path, failure) {
      failures.push({ method, path, failure });
    },
    callsTo(method, path) {
      return calls.filter((c) => c.method === method && path.test(c.path));
    },
    expectClean() {
      expect(unexpected, 'unexpected /api routes').toEqual([]);
      expect(invalid, 'schema-invalid request bodies').toEqual([]);
    },
  };
}

/** Switch the preview build to the real memory client against the fake Worker (before opening). */
export async function useFakeWorkerClient(page: Page): Promise<void> {
  await page.evaluate(() => {
    const h = (
      window as unknown as {
        __aduinE2E: { useRealMemory: (on: boolean) => void; setApiBase: (b: string) => void };
      }
    ).__aduinE2E;
    h.useRealMemory(true);
    h.setApiBase('/');
  });
}

// ---------------------------------------------------------------- seed builders

export const FIRM = 'partners-group';
const DAY = 86_400_000;
export const T0 = Date.UTC(2026, 1, 3, 11, 0);

export function fakeDecision(id: string, over: Partial<FakeDecision> = {}): FakeDecision {
  return {
    id,
    fingerprint: (id.replace(/[^0-9a-f]/g, '') + '0'.repeat(64)).slice(0, 64),
    status: 'active',
    decision: 'dismissed',
    reason_code: 'firm_standard_wording',
    issue_class: 'placeholder',
    pattern_key: 'flag-placeholder:insert',
    quote_snippet: `…quoted passage for ${id}…`,
    fund_name: 'Partners Group Private Equity (Master Fund)',
    decided_by_name: 'Avery (simulated analyst)',
    decided_at: T0,
    law_firm_id: FIRM,
    ...over,
  };
}

export function recordedEvent(d: FakeDecision, at?: number): AuditEvent {
  return {
    id: `ae_rec_${d.id}`,
    at: at ?? d.decided_at,
    actor_name: d.decided_by_name,
    action: 'decision_recorded',
    law_firm_id: d.law_firm_id,
    entity_type: 'decision',
    entity_id: d.id,
    detail: {
      decision: d.decision,
      issue_class: d.issue_class,
      ...(d.reason_code ? { reason_code: d.reason_code } : {}),
    },
  };
}

/**
 * The demo seed as the stack-memory D1 holds it (fixtures/memory/demo-seed-spec.json): three
 * same-pattern same-reason dismissals sd01-sd03 and the proposed seed rule sr01 (evidence 3, its
 * `rule_proposed` audit row carries only `detail.status`), plus two other decisions.
 */
export function demoSeed(): Required<Pick<FakeInit, 'decisions' | 'rules' | 'audit'>> {
  const decisions = [
    fakeDecision('sd01', { decided_at: T0 }),
    fakeDecision('sd02', {
      decided_at: T0 + DAY,
      fund_name: 'Partners Group Next Generation Infrastructure',
    }),
    fakeDecision('sd03', {
      decided_at: T0 + 2 * DAY,
      fund_name: 'Partners Group Next Generation Infrastructure',
    }),
    fakeDecision('sd04', {
      decided_at: T0 + 3 * DAY,
      issue_class: 'sensitive_data',
      pattern_key: 'flag-sensitive:aba',
      reason_code: 'no_form_impact',
    }),
    fakeDecision('sd05', {
      decided_at: T0 + 4 * DAY,
      issue_class: 'broken_cross_reference',
      pattern_key: 'xref:part-b',
      decision: 'accepted',
      reason_code: undefined,
    }),
  ];
  const rules: FakeRule[] = [
    {
      id: 'sr01',
      text: 'Placeholders for the investor name on the wire "FFC" line are firm standard wording.',
      status: 'proposed',
      origin: 'seed',
      evidence_count: 3,
      law_firm_id: FIRM,
    },
  ];
  const audit: AuditEvent[] = [
    ...decisions.map((d) => recordedEvent(d)),
    {
      id: 'ae_seed_rp',
      at: T0 + 2 * DAY + 1,
      actor_name: 'Rule engine',
      action: 'rule_proposed',
      law_firm_id: FIRM,
      entity_type: 'rule',
      entity_id: 'sr01',
      detail: { status: 'proposed' },
    },
  ];
  return { decisions, rules, audit };
}

/** Bodies the client sent to one route (for field-mapping assertions). */
export function bodiesOf(fw: FakeWorker, method: string, path: RegExp): Record<string, unknown>[] {
  return fw.callsTo(method, path).map((c) => c.body as Record<string, unknown>);
}
