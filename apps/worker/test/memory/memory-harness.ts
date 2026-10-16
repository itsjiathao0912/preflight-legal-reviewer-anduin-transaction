// HTTP-level harness for the Phase 04b memory routes (not a gate file). createApp with an injected
// fetch (Turnstile stub; any other host throws), a manual clock, a metered D1 binding and a captured
// log sink. Cookie keys are test-only. No secret of any kind is real.
import { env } from 'cloudflare:test';
import { fingerprint, quoteHash, type IssueClass } from '@aduin/core';
import { createApp, type App } from '../../src/app';
import { meteredDb, type DbStats } from '../../src/db/meta';
import { VISITOR_COOKIE } from '../../src/limits/visitor';
import { TurnstileStub } from '../fakes/turnstile-stub';

export const ORIGIN = 'https://app.test';
export const COOKIE_KEY = 'test-cookie-signing-key-0123456789abcdef';
export const KEYS = { k1: COOKIE_KEY };
export const T0 = Date.UTC(2026, 9, 17, 12, 0, 0);
export const DAY_MS = 86_400_000;

export interface MemHarness {
  app: App;
  env: Record<string, unknown>;
  clock: { now: number };
  stats: DbStats;
  resetStats(): void;
  logs: string[];
  ts: TurnstileStub;
  ctx: ExecutionContext;
}

export function makeMem(
  opts: { env?: Record<string, string | undefined>; db?: D1Database | null } = {},
): MemHarness {
  const m = meteredDb(opts.db === undefined ? env.DB : (opts.db ?? env.DB));
  const ts = new TurnstileStub();
  const logs: string[] = [];
  const clock = { now: T0 };
  const vars: Record<string, string | undefined> = {
    COOKIE_SIGNING_KEYS: JSON.stringify(KEYS),
    COOKIE_SIGNING_KID: 'k1',
    ...opts.env,
  };
  const e: Record<string, unknown> = Object.fromEntries(
    Object.entries(vars).filter(([, v]) => v !== undefined),
  );
  if (opts.db !== null) e['DB'] = m.db;
  const app = createApp({
    fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
      ts.handle(String(input), init)) as typeof fetch,
    now: () => clock.now,
    proxy: { log: (l) => logs.push(l) },
  });
  return {
    app,
    env: e,
    clock,
    stats: m.stats,
    resetStats: m.reset,
    logs,
    ts,
    ctx: { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext,
  };
}

export interface CallOpts {
  cookie?: string | undefined;
  ip?: string;
  headers?: Record<string, string | null>;
  raw?: string;
}

export function request(method: string, path: string, body?: unknown, o: CallOpts = {}): Request {
  const h = new Headers();
  h.set('x-aduin-client', '1');
  h.set('cf-connecting-ip', o.ip ?? '198.51.100.7');
  if (method !== 'GET') {
    h.set('origin', ORIGIN);
    h.set('content-type', 'application/json');
  }
  if (o.cookie) h.set('cookie', o.cookie);
  for (const [k, v] of Object.entries(o.headers ?? {})) {
    if (v === null) h.delete(k);
    else h.set(k, v);
  }
  const payload = method === 'GET' ? undefined : (o.raw ?? JSON.stringify(body ?? {}));
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: h,
    ...(payload !== undefined ? { body: payload } : {}),
  });
}

export async function call(
  h: MemHarness,
  method: string,
  path: string,
  body?: unknown,
  o: CallOpts = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test bodies are asserted ad hoc
): Promise<{ status: number; body: any; res: Response }> {
  h.clock.now += 1_000;
  const res = await h.app.fetch(request(method, path, body, o), h.env as never, h.ctx);
  const text = await res.text();
  const parsed: unknown = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  })();
  return { status: res.status, body: parsed, res };
}

export function cookieOf(res: Response): string | undefined {
  const sc = res.headers.get('set-cookie');
  return sc ? sc.split(';')[0] : undefined;
}

export function cookieValue(cookie: string): string {
  return cookie.slice(`${VISITOR_COOKIE}=`.length);
}

export interface Session {
  cookie: string;
  workspaceId: string;
  analystId: string;
}

let ipSeq = 0;
/** A fresh sandbox; each call uses a distinct IP so the per-IP session cap stays out of the way. */
export async function session(
  h: MemHarness,
  name = 'Dana (simulated analyst)',
  ip?: string,
): Promise<Session> {
  ipSeq++;
  const r = await call(
    h,
    'POST',
    '/api/session',
    { analyst_name: name },
    { ip: ip ?? `203.0.113.${ipSeq % 250}` },
  );
  if (r.status !== 200) throw new Error(`session failed: ${r.status} ${JSON.stringify(r.body)}`);
  const cookie = cookieOf(r.res);
  if (!cookie) throw new Error('no cookie');
  return { cookie, workspaceId: r.body.workspace_id, analystId: r.body.analyst_id };
}

let docSeq = 0;
export async function newRun(
  h: MemHarness,
  s: Session,
  firm: string | null = 'firm-x',
  fund = 'Fund I',
): Promise<string> {
  docSeq++;
  const r = await call(
    h,
    'POST',
    '/api/runs',
    {
      client_op_id: `run-op-${docSeq}-xxxx`,
      doc_name: `Doc ${docSeq}.html`,
      doc_hash: quoteHash(`doc-${docSeq}-${Math.random()}`),
      law_firm_id: firm,
      fund_name: fund,
      version_label: 'v1',
      settings_hash: quoteHash('settings'),
    },
    { cookie: s.cookie },
  );
  if (r.status !== 200) throw new Error(`run failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.run_id;
}

export function fpOf(firm: string, cls: IssueClass, quote: string): string {
  return fingerprint(firm, cls, quoteHash(quote));
}

let opSeq = 0;
export const op = (tag = 'op') => `${tag}-${++opSeq}-${Math.floor(Math.random() * 1e9)}`;

export interface DecideOpts {
  runId: string;
  quote: string;
  decision?: 'dismissed' | 'accepted';
  reason?: 'firm_standard_wording' | 'no_form_impact' | 'tool_false_alarm' | 'other';
  cls?: IssueClass;
  patternKey?: string;
  note?: string;
  fundName?: string;
  firm?: string;
  findingRef?: string;
  clientOpId?: string;
  extra?: Record<string, unknown>;
}

export function decisionBody(o: DecideOpts): Record<string, unknown> {
  const cls = o.cls ?? 'defined_term_issue';
  const decision = o.decision ?? 'dismissed';
  return {
    client_op_id: o.clientOpId ?? op('dec'),
    run_id: o.runId,
    finding_ref: o.findingRef ?? `f-${Math.floor(Math.random() * 1e9)}`,
    decision,
    ...(decision === 'dismissed' ? { reason_code: o.reason ?? 'firm_standard_wording' } : {}),
    ...(o.note !== undefined ? { note: o.note } : {}),
    quote_text: o.quote,
    fingerprint: fpOf(o.firm ?? 'firm-x', cls, o.quote),
    issue_class: cls,
    ...(o.patternKey ? { pattern_key: o.patternKey } : {}),
    ...(o.fundName ? { fund_name: o.fundName } : {}),
    ...(o.extra ?? {}),
  };
}

export async function decide(h: MemHarness, s: Session, o: DecideOpts) {
  return call(h, 'POST', '/api/decisions', decisionBody(o), { cookie: s.cookie });
}

export async function lookup(h: MemHarness, s: Session, firm: string, fps: string[]) {
  return call(
    h,
    'POST',
    '/api/memory/lookup',
    { law_firm_id: firm, fingerprints: fps },
    { cookie: s.cookie },
  );
}

/** Every row of every workspace-scoped table for one workspace, as JSON text (storage scans). */
export async function dumpWorkspace(db: D1Database, ws: string): Promise<string> {
  const tables = [
    'analyst',
    'fund',
    'document',
    'review_run',
    'finding',
    'finding_state',
    'decision',
    'counsel_question',
    'counsel_answer',
    'firm_rule',
    'rule_evidence',
    'audit_event',
  ];
  const out: Record<string, unknown[]> = {};
  for (const t of tables) {
    out[t] = (
      await db.prepare(`SELECT * FROM ${t} WHERE workspace_id = ?1`).bind(ws).all()
    ).results;
  }
  return JSON.stringify(out);
}

/** A FindingWire for POST /api/runs/:id/findings (detail carries canary text that must never persist). */
export function wireFinding(
  firm: string,
  quote: string,
  o: {
    id?: string;
    cls?: IssueClass;
    severity?: 'critical' | 'high' | 'medium' | 'low';
    facts?: Record<string, string | number | boolean | null>;
    explanation?: string;
    patternKey?: string;
  } = {},
) {
  const cls = o.cls ?? 'defined_term_issue';
  return {
    id: o.id ?? `fk-${Math.floor(Math.random() * 1e9)}`,
    issue_class: cls,
    severity: o.severity ?? 'medium',
    detector_kind: 'rule',
    detector_id: 'undefined-term',
    confidence: 0.9,
    anchor: { docHash: quoteHash('doc'), blockId: 'b-1', offsetStart: 0, offsetEnd: 10 },
    section_path: ['Part B'],
    quote_snippet: quote.slice(0, 300),
    quote_hash: quoteHash(quote),
    fingerprint: fpOf(firm, cls, quote),
    ...(o.patternKey ? { pattern_key: o.patternKey } : {}),
    detail: {
      explanation: o.explanation ?? 'The term is used but never defined.',
      facts: o.facts ?? { term: 'Units' },
      interpretations: [],
    },
  };
}
