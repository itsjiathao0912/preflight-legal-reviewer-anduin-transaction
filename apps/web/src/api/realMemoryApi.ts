import {
  limits,
  type ActiveDecision,
  type AuditEvent,
  type FindingWire,
  type FirmMemoryResponse,
  type Rule,
} from '@aduin/core';
import type { AppDb } from '../storage/db';
import { apiUrl } from './base';
import { clientHeaders, TURNSTILE_HEADER } from './http';
import {
  FINDINGS_CHUNK,
  AUDIT_PAGE_SIZE,
  MemoryApiError,
  toMemoryApiError,
  type AnswerInput,
  type AuditPage,
  type CreatedQuestion,
  type DecideInput,
  type EnsureRunInput,
  type ExportRunInput,
  type ExportRunResult,
  type MemoryApi,
  type MemoryHealth,
  type QuestionItem,
  type SessionInfo,
} from './memoryApi';

/**
 * Real Worker client for the frozen `MemoryApi` (Phase 08 S1). Every call sends `x-aduin-client: 1`
 * and the same-origin session cookie (`credentials: 'include'`; JS never reads the cookie).
 *
 * Session: `bootstrap(name)` -> POST /api/session; `read_only` comes from that response only. Any
 * other call first makes sure a session exists (bootstrap before the first lookup). A 401
 * `invalid_session` re-bootstraps with the last name and retries the call once.
 *
 * Run lifecycle: `ensureRun` caches `run:{workspace_id}:{law_firm_id|doc_hash|settings_hash}` ->
 * run_id in Dexie `uiState`, and `run:{workspace_id}:#findings:{run_id}` holds the finding ids
 * already stored (duplicates still burn Worker write budget, so they are never re-sent). Every
 * `run:` row is dropped when the session workspace changes, so a foreign run id is never reused.
 */
export interface RealMemoryApiOptions {
  fetch?: typeof fetch;
  /** URL for an API path; null = no API (calls fail as `unavailable`). Default: `apiUrl`. */
  url?: (path: string) => string | null;
  /** Dexie database for the run cache; null keeps the cache in memory only. */
  db?: AppDb | null;
  now?: () => number;
  /** Name used for an automatic bootstrap before the first call (default `Linh Tran`). */
  analystName?: () => string | null;
  /** Turnstile token for POST /api/session when the Worker requires one. */
  turnstileToken?: () => string | null;
  newOpId?: () => string;
}

/** Cache control the outbox uses after `run_required` / `run_not_found` (not in the frozen API). */
export interface RunCacheControl {
  invalidateRun(
    doc: Pick<EnsureRunInput, 'law_firm_id' | 'doc_hash' | 'settings_hash'>,
  ): Promise<void>;
}

export const DEFAULT_ANALYST_NAME = 'Linh Tran';
const PATTERN_KEY_RE = /^[a-z0-9:#>-]{1,80}$/;
const RUN_PREFIX = 'run:';
const WORKSPACE_KEY = 'run:#workspace';
/** `features/counsel/question-ids.ts` key prefix (finding -> question id per document). */
const QUESTIONS_PREFIX = 'questions:';

export function newClientOpId(): string {
  return `op_${crypto.randomUUID().replace(/-/g, '')}`;
}

function runKey(doc: Pick<EnsureRunInput, 'law_firm_id' | 'doc_hash' | 'settings_hash'>): string {
  return `${doc.law_firm_id ?? ''}|${doc.doc_hash}|${doc.settings_hash}`;
}

function bad(reason: string, message = `invalid ${reason}`): MemoryApiError {
  return new MemoryApiError('invalid_request', message, { reason });
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function sessionOf(raw: unknown): SessionInfo {
  if (
    !isObj(raw) ||
    typeof raw['workspace_id'] !== 'string' ||
    typeof raw['analyst_id'] !== 'string' ||
    typeof raw['read_only'] !== 'boolean' ||
    typeof raw['expires_at'] !== 'number'
  ) {
    throw new MemoryApiError('unavailable', 'malformed session response', { reason: 'malformed' });
  }
  return raw as unknown as SessionInfo;
}

function field<T>(raw: unknown, key: string): T {
  if (!isObj(raw) || !(key in raw)) {
    throw new MemoryApiError('unavailable', `malformed response (${key})`, { reason: 'malformed' });
  }
  return raw[key] as T;
}

export class RealMemoryApi implements MemoryApi, RunCacheControl {
  private readonly fetchImpl: typeof fetch;
  private readonly url: (path: string) => string | null;
  private readonly db: AppDb | null;
  private readonly now: () => number;
  private readonly defaultName: () => string | null;
  private readonly turnstile: () => string | null;
  private readonly opId: () => string;
  private session: SessionInfo | null = null;
  private name: string | null = null;
  private booting: Promise<SessionInfo> | null = null;
  /** Memory mirror of the `run:` uiState rows (also the only cache when db is null). */
  private readonly cache = new Map<string, unknown>();
  private readonly sessionListeners = new Set<(s: SessionInfo) => void>();

  constructor(opts: RealMemoryApiOptions = {}) {
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
    this.url = opts.url ?? apiUrl;
    this.db = opts.db ?? null;
    this.now = opts.now ?? Date.now;
    this.defaultName = opts.analystName ?? (() => DEFAULT_ANALYST_NAME);
    this.turnstile = opts.turnstileToken ?? (() => null);
    this.opId = opts.newOpId ?? newClientOpId;
  }

  /** The current session (null before the first bootstrap). */
  currentSession(): SessionInfo | null {
    return this.session;
  }

  /** True when the session response said read-only (the demo workspace). */
  get readOnly(): boolean {
    return this.session?.read_only === true;
  }

  onSession(fn: (s: SessionInfo) => void): () => void {
    this.sessionListeners.add(fn);
    return () => {
      this.sessionListeners.delete(fn);
    };
  }

  // ---------------------------------------------------------------- transport

  private async send(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<{ status: number; ok: boolean; json: unknown }> {
    const url = this.url(path);
    if (url === null) throw new MemoryApiError('unavailable', 'API disabled', { reason: 'no_api' });
    const headers = clientHeaders(
      body !== undefined ? { 'content-type': 'application/json', ...extraHeaders } : extraHeaders,
    );
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers,
        credentials: 'include',
        cache: 'no-store',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new MemoryApiError('unavailable', 'Memory is unreachable.', { reason: 'network' });
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, ok: res.ok, json };
  }

  private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    await this.ensureSession();
    const first = await this.send(method, path, body);
    if (first.ok) return first.json;
    const e = toMemoryApiError(first.status, first.json, this.now());
    if (e.code !== 'unauthorized' || this.name === null) throw e;
    // 401 invalid_session: re-bootstrap with the last name, then retry the same call once
    this.session = null;
    await this.bootstrap(this.name);
    const second = await this.send(method, path, body);
    if (second.ok) return second.json;
    throw toMemoryApiError(second.status, second.json, this.now());
  }

  private async ensureSession(): Promise<void> {
    if (this.session) return;
    if (this.booting) {
      await this.booting;
      return;
    }
    const name = this.name ?? this.defaultName();
    if (name) await this.bootstrap(name);
  }

  // ---------------------------------------------------------------- session

  async bootstrap(name: string): Promise<SessionInfo> {
    const n = typeof name === 'string' ? name.trim() : '';
    if (n.length < 1 || n.length > 80) throw bad('analyst_name', 'analyst name must be 1-80 chars');
    if (this.booting) return this.booting;
    const run = (async () => {
      const token = this.turnstile();
      const r = await this.send(
        'POST',
        '/api/session',
        { analyst_name: n },
        token ? { [TURNSTILE_HEADER]: token } : {},
      );
      if (!r.ok) throw toMemoryApiError(r.status, r.json, this.now());
      const s = sessionOf(r.json);
      await this.adoptWorkspace(s.workspace_id);
      this.session = s;
      this.name = n;
      for (const l of this.sessionListeners) l(s);
      return s;
    })();
    this.booting = run;
    try {
      return await run;
    } finally {
      this.booting = null;
    }
  }

  /** Drop every cached run and stored-finding set when the workspace differs from the last one. */
  private async adoptWorkspace(ws: string): Promise<void> {
    const prev = await this.getCache<string>(WORKSPACE_KEY);
    if (prev === ws) return;
    for (const k of [...this.cache.keys()]) if (k.startsWith(RUN_PREFIX)) this.cache.delete(k);
    if (this.db) {
      try {
        await this.db.uiState.where('key').startsWith(RUN_PREFIX).delete();
        // counsel question ids belong to the old workspace too (review fix F3)
        await this.db.uiState.where('key').startsWith(QUESTIONS_PREFIX).delete();
      } catch {
        /* storage unavailable: memory cache already cleared */
      }
    }
    await this.setCache(WORKSPACE_KEY, ws);
  }

  // ---------------------------------------------------------------- run cache

  private async getCache<T>(key: string): Promise<T | undefined> {
    if (this.cache.has(key)) return this.cache.get(key) as T;
    if (!this.db) return undefined;
    try {
      const row = await this.db.uiState.get(key);
      if (row) this.cache.set(key, row.value);
      return row?.value as T | undefined;
    } catch {
      return undefined;
    }
  }

  private async setCache(key: string, value: unknown): Promise<void> {
    this.cache.set(key, value);
    if (!this.db) return;
    try {
      await this.db.uiState.put({ key, value, updatedAt: this.now() });
    } catch {
      /* memory cache keeps working */
    }
  }

  private async delCache(key: string): Promise<void> {
    this.cache.delete(key);
    if (!this.db) return;
    try {
      await this.db.uiState.delete(key);
    } catch {
      /* ignore */
    }
  }

  private wsKey(rest: string): string {
    return `${RUN_PREFIX}${this.session?.workspace_id ?? '-'}:${rest}`;
  }

  async invalidateRun(
    doc: Pick<EnsureRunInput, 'law_firm_id' | 'doc_hash' | 'settings_hash'>,
  ): Promise<void> {
    await this.ensureSession();
    const k = this.wsKey(runKey(doc));
    const runId = await this.getCache<string>(k);
    await this.delCache(k);
    if (runId) await this.delCache(this.wsKey(`#findings:${runId}`));
  }

  // ---------------------------------------------------------------- memory

  async lookup(lawFirmId: string, fingerprints: string[]): Promise<ActiveDecision[]> {
    const fps = [...new Set(fingerprints)];
    if (fps.length === 0) return [];
    const out: ActiveDecision[] = [];
    for (let i = 0; i < fps.length; i += limits.memoryLookupMax) {
      const raw = await this.request('POST', '/api/memory/lookup', {
        law_firm_id: lawFirmId,
        fingerprints: fps.slice(i, i + limits.memoryLookupMax),
      });
      out.push(...field<ActiveDecision[]>(raw, 'decisions'));
    }
    return out;
  }

  async ensureRun(input: EnsureRunInput): Promise<{ run_id: string }> {
    await this.ensureSession();
    const k = this.wsKey(runKey(input));
    const cached = await this.getCache<string>(k);
    if (typeof cached === 'string') return { run_id: cached };
    const raw = await this.request('POST', '/api/runs', {
      client_op_id: input.client_op_id,
      doc_name: input.doc_name.slice(0, 120) || 'Document',
      doc_hash: input.doc_hash,
      law_firm_id: input.law_firm_id,
      ...(input.fund_name ? { fund_name: input.fund_name.slice(0, 200) } : {}),
      ...(input.version_label ? { version_label: input.version_label.slice(0, 120) } : {}),
      settings_hash: input.settings_hash,
    });
    const run_id = field<string>(raw, 'run_id');
    // the key may belong to a new workspace if a 401 re-bootstrap happened mid-call
    await this.setCache(this.wsKey(runKey(input)), run_id);
    return { run_id };
  }

  async storeFindings(runId: string, findings: FindingWire[]): Promise<{ stored: number }> {
    await this.ensureSession();
    const setKey = this.wsKey(`#findings:${runId}`);
    const done = new Set((await this.getCache<string[]>(setKey)) ?? []);
    const seen = new Set<string>();
    const todo = findings.filter((f) => {
      if (done.has(f.id) || seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
    let stored = 0;
    for (let i = 0; i < todo.length; i += FINDINGS_CHUNK) {
      const chunk = todo.slice(i, i + FINDINGS_CHUNK);
      const raw = await this.request('POST', `/api/runs/${encodeURIComponent(runId)}/findings`, {
        client_op_id: this.opId(),
        findings: chunk,
      });
      stored += Number(field<number>(raw, 'stored')) || 0;
      for (const f of chunk) done.add(f.id);
      await this.setCache(setKey, [...done]);
    }
    return { stored };
  }

  async decide(input: DecideInput): Promise<ActiveDecision> {
    if (!input.run_id) {
      throw new MemoryApiError('run_required', 'a run is required before a decision', {
        reason: 'run_required',
      });
    }
    if (input.pattern_key !== undefined && !PATTERN_KEY_RE.test(input.pattern_key)) {
      throw bad('pattern_key');
    }
    const raw = await this.request('POST', '/api/decisions', {
      client_op_id: input.client_op_id,
      run_id: input.run_id,
      finding_ref: input.finding_ref,
      decision: input.decision,
      ...(input.reason_code ? { reason_code: input.reason_code } : {}),
      ...(input.note ? { note: input.note } : {}),
      quote_text: input.quote_text,
      fingerprint: input.fingerprint,
      issue_class: input.issue_class,
      ...(input.pattern_key !== undefined ? { pattern_key: input.pattern_key } : {}),
      ...(input.fund_name ? { fund_name: input.fund_name } : {}),
      ...(input.doc_version_label ? { doc_version_label: input.doc_version_label } : {}),
    });
    return field<ActiveDecision>(raw, 'decision');
  }

  async createQuestions(_runId: string, items: QuestionItem[]): Promise<CreatedQuestion[]> {
    // validate the whole batch first so a bad item never leaves a half-created batch
    for (const it of items) {
      const ok =
        Array.isArray(it.interpretations) &&
        it.interpretations.length >= 1 &&
        it.interpretations.length <= 6 &&
        it.interpretations.every((s) => typeof s === 'string' && s.length >= 1 && s.length <= 500);
      if (!ok) throw bad('interpretations', 'interpretations must be 1-6 items of 1-500 chars');
    }
    const out: CreatedQuestion[] = [];
    // the Worker derives the run from the persisted finding, so run_id is not on the wire
    for (const it of items) {
      const raw = await this.request('POST', '/api/counsel/questions', {
        client_op_id: it.client_op_id,
        finding_ref: it.finding_ref,
        fingerprint: it.fingerprint,
        interpretations: it.interpretations,
      });
      out.push({ finding_ref: it.finding_ref, question_id: field<string>(raw, 'question_id') });
    }
    return out;
  }

  async answer(input: AnswerInput): Promise<ActiveDecision> {
    if (!input.question_id) throw bad('question_required', 'a counsel question is required');
    if (!input.quote_text) throw bad('quote_text', 'quote_text is required');
    const raw = await this.request('POST', '/api/counsel/answers', {
      client_op_id: input.client_op_id,
      question_id: input.question_id,
      option: input.counsel_option,
      ...(input.counsel_note ? { note: input.counsel_note.slice(0, 1000) } : {}),
      quote_text: input.quote_text,
      fingerprint: input.fingerprint,
    });
    return field<ActiveDecision>(raw, 'decision');
  }

  async exportRun(runId: string, input: ExportRunInput): Promise<ExportRunResult> {
    const raw = await this.request('POST', `/api/runs/${encodeURIComponent(runId)}/export`, {
      client_op_id: input.client_op_id ?? this.opId(),
      question_count: input.question_count,
    });
    if (!isObj(raw) || raw['ok'] !== true) {
      throw new MemoryApiError('unavailable', 'malformed export response', { reason: 'malformed' });
    }
    return raw as unknown as ExportRunResult;
  }

  async revoke(decisionId: string, reason: string): Promise<ActiveDecision | null> {
    const raw = await this.request(
      'POST',
      `/api/decisions/${encodeURIComponent(decisionId)}/revoke`,
      { client_op_id: this.opId(), reason: (reason || 'Revoked').slice(0, 500) },
    );
    return field<ActiveDecision | null>(raw, 'current') ?? null;
  }

  // ---------------------------------------------------------------- firm memory and rules

  async firm(lawFirmId: string): Promise<FirmMemoryResponse> {
    const raw = await this.request(
      'GET',
      `/api/memory/firm?law_firm_id=${encodeURIComponent(lawFirmId)}`,
    );
    field<unknown>(raw, 'rules');
    return raw as FirmMemoryResponse;
  }

  async firmRules(lawFirmId: string): Promise<string[]> {
    const f = await this.firm(lawFirmId);
    return f.rules.filter((r) => r.status === 'active').map((r) => r.text);
  }

  async listRules(lawFirmId: string): Promise<Rule[]> {
    const raw = await this.request(
      'GET',
      `/api/rules?law_firm_id=${encodeURIComponent(lawFirmId)}`,
    );
    return field<Rule[]>(raw, 'rules');
  }

  async createRule(lawFirmId: string, text: string): Promise<Rule> {
    const raw = await this.request(
      'POST',
      `/api/rules?law_firm_id=${encodeURIComponent(lawFirmId)}`,
      { client_op_id: this.opId(), text },
    );
    return field<Rule>(raw, 'rule');
  }

  private async ruleAction(id: string, action: string, text?: string): Promise<Rule> {
    const t = text?.trim().slice(0, 500);
    const raw = await this.request('POST', `/api/rules/${encodeURIComponent(id)}/${action}`, {
      client_op_id: this.opId(),
      ...(t ? { text: t } : {}),
    });
    return field<Rule>(raw, 'rule');
  }

  approveRule(id: string): Promise<Rule> {
    return this.ruleAction(id, 'approve');
  }

  rejectRule(id: string): Promise<Rule> {
    return this.ruleAction(id, 'reject');
  }

  revokeRule(id: string, text: string): Promise<Rule> {
    return this.ruleAction(id, 'revoke', text);
  }

  async audit(cursor?: string): Promise<AuditPage> {
    const q = `limit=${AUDIT_PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const raw = await this.request('GET', `/api/audit?${q}`);
    const events = field<AuditEvent[]>(raw, 'events');
    const next = isObj(raw) && typeof raw['next_cursor'] === 'string' ? raw['next_cursor'] : null;
    return { events, ...(next ? { next_cursor: next } : {}) };
  }

  async health(): Promise<MemoryHealth> {
    // no cookie needed; a 503 still carries the health body (ok: false)
    const r = await this.send('GET', '/api/memory/health', undefined);
    if (isObj(r.json) && typeof r.json['ok'] === 'boolean')
      return r.json as unknown as MemoryHealth;
    throw toMemoryApiError(r.status, r.json, this.now());
  }
}
