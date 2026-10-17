import { parseQuestionKey, type ActiveDecision, type FindingWire } from '@aduin/core';
import type { AppDb, OutboxRow } from '../storage/db';
import { newClientOpId, type RunCacheControl } from './realMemoryApi';
import {
  isDailyBudgetReason,
  MemoryApiError,
  type AnswerInput,
  type DecideInput,
  type EnsureRunInput,
  type MemoryApi,
  type OutboxState,
  type QuestionItem,
} from './memoryApi';

/**
 * Memory write outbox (Phase 08 S1). Writes are queued in the Dexie `outbox` table (schema v1,
 * `++seq, createdAt`; state, attempts and `nextAttemptAt` live inside `op`, no version bump) and
 * drained strictly in order:
 *
 *   queued -> sending -> synced | retry (backoff) | deferred (daily budget) | rejected (terminal)
 *
 * - Every op keeps its own idempotent `client_op_id`; helper calls made at send time (ensureRun,
 *   storeFindings, createQuestions) get fresh ids, so an id is never reused across actions.
 * - Ops store the document key and the finding keys; the run id is resolved at send time
 *   (`ensureRun` is lazy, findings are persisted before the decision, already stored ids skipped).
 * - 409 -> rejected + `conflict` event carrying the server's active decision (UI refreshes).
 * - 422 / 400 / 403 -> rejected, never retried. `run_required` / `run_not_found` -> the run cache
 *   entry is dropped and the op retried once.
 * - 429 with a daily/workspace budget reason -> deferred until the next UTC day; other 429 ->
 *   retry at `retryAfterUtc`. Network / 5xx / 401 -> retry with exponential backoff.
 * - `decide` returns an optimistic `pending:<client_op_id>` id, mapped to the real id on drain.
 *   Revoking a pending decision cancels it when not yet sent, or queues after it while sending.
 * - A read-only session never enqueues (writes are disabled up front).
 * - Review fixes: every op is stamped with the session `workspace_id` at enqueue; an op whose
 *   workspace differs from the current session at drain is rejected (`workspace_changed`) so it is
 *   never written into another workspace (F2). Terminal ops drop `quote_text`, `note`,
 *   `counsel_note` and `doc_name` (F4). `unavailable` / `unauthorized` retries are capped at
 *   `MAX_UNAVAILABLE_ATTEMPTS`; the op is then `parked` until the next page load or `online` (F5).
 */
export type OutboxKind = 'decide' | 'answer' | 'revoke';

/** Document key: everything `ensureRun` needs except the op id. */
export type OutboxDoc = Omit<EnsureRunInput, 'client_op_id'>;

export interface OutboxError {
  code: string;
  reason?: string;
  message: string;
}

export interface OutboxOp {
  client_op_id: string;
  kind: OutboxKind;
  state: OutboxState;
  attempts: number;
  nextAttemptAt: number;
  doc?: OutboxDoc;
  finding_keys: string[];
  decide?: Omit<DecideInput, 'run_id'>;
  answer?: AnswerInput;
  /** Question to create at send time when the answer has no `question_id` yet. */
  question?: Omit<QuestionItem, 'client_op_id'>;
  revoke?: { decision_id?: string; target_op?: string; reason: string };
  result?: ActiveDecision | null;
  error?: OutboxError;
  /** True once a run_required / run_not_found retry was used. */
  runRetried?: boolean;
  /** Session workspace at enqueue (null = no real session, e.g. the Dexie stub: not checked). */
  workspace_id?: string | null;
}

export type OutboxEvent =
  | { type: 'synced'; op: OutboxOp; decision: ActiveDecision | null }
  | { type: 'conflict'; op: OutboxOp; current: ActiveDecision | null }
  | { type: 'rejected'; op: OutboxOp; error: OutboxError }
  | { type: 'deferred'; op: OutboxOp; until: number }
  | { type: 'retry'; op: OutboxOp; at: number }
  | { type: 'parked'; op: OutboxOp };

export interface OutboxDeps {
  db: AppDb;
  api: () => MemoryApi | null;
  /** From the session response; read-only sessions skip the outbox. */
  readOnly?: () => boolean;
  /** Current session workspace id (null when unknown / stub). Awaited at enqueue and at drain. */
  workspace?: () => string | null | Promise<string | null>;
  /** Wire findings for these keys (persisted before a decision/question); default: none. */
  findingsFor?: (doc: OutboxDoc, keys: string[]) => FindingWire[] | Promise<FindingWire[]>;
  now?: () => number;
  newOpId?: () => string;
}

export const PENDING_PREFIX = 'pending:';
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 5 * 60_000;
/** Terminal rows older than this are pruned on drain (the pending-id map only needs recent rows). */
const KEEP_TERMINAL_MS = 7 * 24 * 60 * 60_000;

export function pendingId(clientOpId: string): string {
  return `${PENDING_PREFIX}${clientOpId}`;
}

export function isPendingId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id.startsWith(PENDING_PREFIX);
}

export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
}

/** `unavailable` / `unauthorized` attempts before an op is parked (F5). */
export const MAX_UNAVAILABLE_ATTEMPTS = 6;

const TERMINAL: ReadonlySet<OutboxState> = new Set(['synced', 'rejected']);
const UNSYNCED: ReadonlySet<OutboxState> = new Set([
  'queued',
  'sending',
  'retry',
  'deferred',
  'parked',
]);

export function isTerminalState(s: OutboxState): boolean {
  return TERMINAL.has(s);
}

/** Terminal ops keep only what the pending-id map and revoke need: free text is dropped (F4). */
export function scrubTerminal(op: OutboxOp): OutboxOp {
  const out: OutboxOp = { ...op };
  if (out.decide) {
    const { quote_text: _q, note: _n, ...rest } = out.decide;
    out.decide = { ...rest, quote_text: '' };
  }
  if (out.answer) {
    const { quote_text: _q, counsel_note: _n, intent: _i, assertion, ...rest } = out.answer;
    // Variance: intent and the assertion label are free text too (kind kept for the record)
    out.answer = assertion ? { ...rest, assertion: { kind: assertion.kind, label: '' } } : rest;
  }
  // Variance: the interpretations carry old/new document text
  if (out.question) out.question = { ...out.question, interpretations: [] };
  if (out.doc) out.doc = { ...out.doc, doc_name: '' };
  return out;
}

interface Row extends OutboxRow {
  seq: number;
  op: OutboxOp;
}

function errorOf(e: unknown): OutboxError {
  if (e instanceof MemoryApiError) {
    return { code: e.code, message: e.message, ...(e.reason ? { reason: e.reason } : {}) };
  }
  return { code: 'unavailable', message: e instanceof Error ? e.message : 'unknown error' };
}

export class Outbox {
  private readonly db: AppDb;
  private readonly api: () => MemoryApi | null;
  private readonly readOnly: () => boolean;
  private readonly workspace: NonNullable<OutboxDeps['workspace']>;
  private readonly findingsFor: NonNullable<OutboxDeps['findingsFor']>;
  private readonly now: () => number;
  private readonly opId: () => string;
  private readonly listeners = new Set<(e: OutboxEvent) => void>();
  private draining: Promise<void> | null = null;
  private again = false;

  constructor(deps: OutboxDeps) {
    this.db = deps.db;
    this.api = deps.api;
    this.readOnly = deps.readOnly ?? (() => false);
    this.workspace = deps.workspace ?? (() => null);
    this.findingsFor = deps.findingsFor ?? (() => []);
    this.now = deps.now ?? Date.now;
    this.opId = deps.newOpId ?? newClientOpId;
  }

  onEvent(fn: (e: OutboxEvent) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(e: OutboxEvent): void {
    for (const l of this.listeners) {
      try {
        l(e);
      } catch {
        /* a listener must not break the drain */
      }
    }
  }

  // ---------------------------------------------------------------- enqueue

  private async add(op: Omit<OutboxOp, 'state' | 'attempts' | 'nextAttemptAt'>): Promise<void> {
    const workspace_id = await this.workspace();
    const now = this.now();
    const full: OutboxOp = {
      ...op,
      state: 'queued',
      attempts: 0,
      nextAttemptAt: now,
      workspace_id,
    };
    await this.db.outbox.add({ createdAt: now, op: full });
  }

  /** Queue a decision; returns the optimistic `pending:<op>` id, or null for read-only sessions. */
  async enqueueDecide(
    doc: OutboxDoc,
    input: Omit<DecideInput, 'run_id'>,
    findingKeys: string[] = [input.finding_ref],
  ): Promise<string | null> {
    if (this.readOnly()) return null;
    await this.add({
      client_op_id: input.client_op_id,
      kind: 'decide',
      doc,
      finding_keys: [...new Set(findingKeys)],
      decide: input,
    });
    return pendingId(input.client_op_id);
  }

  /** Queue a counsel answer (creating its question at send time when `question_id` is absent). */
  async enqueueAnswer(
    doc: OutboxDoc,
    input: AnswerInput,
    question?: Omit<QuestionItem, 'client_op_id'>,
  ): Promise<string | null> {
    if (this.readOnly()) return null;
    if (!input.question_id && !question) {
      throw new MemoryApiError('invalid_request', 'an answer needs a question', {
        reason: 'question_required',
      });
    }
    await this.add({
      client_op_id: input.client_op_id,
      kind: 'answer',
      doc,
      // Variance P04 (H2(b)): a question key `<findingId>@<owner>` persists the plain finding
      finding_keys: question ? [parseQuestionKey(question.finding_ref).findingId] : [],
      answer: input,
      ...(question ? { question } : {}),
    });
    return pendingId(input.client_op_id);
  }

  /**
   * Revoke a decision. A pending decision that was never sent is cancelled (row removed, nothing
   * reaches the Worker); one that may have reached the Worker (sending, or retrying after an
   * attempt) gets a revoke queued after it; a synced one is revoked by its real id.
   */
  async enqueueRevoke(
    decisionId: string,
    reason: string,
  ): Promise<'cancelled' | 'queued' | 'skipped'> {
    if (this.readOnly()) return 'skipped';
    if (!isPendingId(decisionId)) {
      await this.add({
        client_op_id: this.opId(),
        kind: 'revoke',
        finding_keys: [],
        revoke: { decision_id: decisionId, reason },
      });
      void this.drain();
      return 'queued';
    }
    const target = await this.rowFor(decisionId.slice(PENDING_PREFIX.length));
    if (!target || target.op.state === 'rejected') return 'skipped';
    if (target.op.state === 'synced') {
      const real = target.op.result?.id;
      if (!real) return 'skipped';
      return this.enqueueRevoke(real, reason);
    }
    // cancel only what the Worker cannot have recorded: never attempted, or refused by a budget
    if (target.op.attempts > 0 && target.op.state !== 'deferred') {
      await this.add({
        client_op_id: this.opId(),
        kind: 'revoke',
        finding_keys: [],
        revoke: { target_op: target.op.client_op_id, reason },
      });
      return 'queued';
    }
    await this.db.outbox.delete(target.seq);
    return 'cancelled';
  }

  // ---------------------------------------------------------------- queries

  private async rows(): Promise<Row[]> {
    return (await this.db.outbox.orderBy('seq').toArray()) as Row[];
  }

  private async rowFor(clientOpId: string): Promise<Row | undefined> {
    return (await this.rows()).find((r) => r.op.client_op_id === clientOpId);
  }

  async list(): Promise<OutboxOp[]> {
    return (await this.rows()).map((r) => r.op);
  }

  /** queued + sending + retry + deferred (the quiet "unsynced" chip). */
  async unsyncedCount(): Promise<number> {
    return (await this.rows()).filter((r) => UNSYNCED.has(r.op.state)).length;
  }

  /** Map an optimistic `pending:<op>` id to the real decision id (null until synced / if lost). */
  async resolveId(id: string): Promise<string | null> {
    if (!isPendingId(id)) return id;
    const row = await this.rowFor(id.slice(PENDING_PREFIX.length));
    return row?.op.state === 'synced' ? (row.op.result?.id ?? null) : null;
  }

  // ---------------------------------------------------------------- drain

  /**
   * Drain on `online` and window `focus`; resets rows stuck in `sending` (crash recovery) and
   * resumes parked rows (page load). `online` resumes parked rows too.
   */
  start(
    target: Pick<Window, 'addEventListener' | 'removeEventListener'> | null = globalThis.window ??
      null,
  ): () => void {
    void this.recover().then(() => this.drain());
    if (!target) return () => {};
    const kick = () => {
      void this.drain();
    };
    const online = () => {
      void this.unpark().then(() => this.drain());
    };
    target.addEventListener('online', online);
    target.addEventListener('focus', kick);
    return () => {
      target.removeEventListener('online', online);
      target.removeEventListener('focus', kick);
    };
  }

  async recover(): Promise<void> {
    for (const r of await this.rows()) {
      if (r.op.state === 'sending') await this.save(r, { ...r.op, state: 'queued' });
    }
    await this.unpark();
  }

  /** Parked rows go back to `queued` with a fresh attempt budget. */
  async unpark(): Promise<void> {
    const now = this.now();
    for (const r of await this.rows()) {
      if (r.op.state === 'parked')
        await this.save(r, { ...r.op, state: 'queued', attempts: 0, nextAttemptAt: now });
    }
  }

  /** Send due ops in order; stops at the first op that is not due yet (order is preserved). */
  drain(): Promise<void> {
    if (this.draining) {
      this.again = true;
      return this.draining;
    }
    this.draining = (async () => {
      try {
        do {
          this.again = false;
          await this.drainOnce();
        } while (this.again);
      } finally {
        this.draining = null;
      }
    })();
    return this.draining;
  }

  private async drainOnce(): Promise<void> {
    const now = this.now();
    for (const r of await this.rows()) {
      if (TERMINAL.has(r.op.state)) {
        if (r.createdAt < now - KEEP_TERMINAL_MS) await this.db.outbox.delete(r.seq);
        continue;
      }
      if (r.op.state === 'parked') return; // order preserved: nothing after it is sent
      if (r.op.nextAttemptAt > this.now()) return;
      const fresh = (await this.db.outbox.get(r.seq)) as Row | undefined;
      if (!fresh || TERMINAL.has(fresh.op.state)) continue; // cancelled meanwhile
      const ok = await this.sendOne(fresh);
      if (!ok) return;
    }
  }

  private async save(r: Row, op: OutboxOp): Promise<void> {
    const next = TERMINAL.has(op.state) ? scrubTerminal(op) : op;
    r.op = next;
    await this.db.outbox.update(r.seq, { op: next });
  }

  /** Returns false when the queue must stop (op not sent successfully and not terminal). */
  private async sendOne(r: Row): Promise<boolean> {
    const api = this.api();
    const op: OutboxOp = { ...r.op, state: 'sending', attempts: r.op.attempts + 1 };
    if (!api) return this.fail(r, op, new MemoryApiError('unavailable', 'memory API unavailable'));
    if (typeof r.op.workspace_id === 'string') {
      let current: string | null;
      try {
        current = await this.workspace();
      } catch {
        current = null;
      }
      if (current === null) {
        return this.fail(r, op, new MemoryApiError('unavailable', 'no memory session'));
      }
      if (current !== r.op.workspace_id) {
        return this.fail(
          r,
          op,
          new MemoryApiError('invalid_request', 'op belongs to another workspace', {
            reason: 'workspace_changed',
          }),
        );
      }
    }
    await this.save(r, op);
    try {
      const decision = await this.perform(api, r, op);
      const done: OutboxOp = { ...r.op, state: 'synced', result: decision };
      delete done.error;
      await this.save(r, done);
      this.emit({ type: 'synced', op: done, decision });
      return true;
    } catch (e) {
      return this.fail(r, r.op, e);
    }
  }

  private async runFor(api: MemoryApi, doc: OutboxDoc, keys: string[]): Promise<string> {
    const { run_id } = await api.ensureRun({ ...doc, client_op_id: this.opId() });
    if (keys.length > 0) {
      const wires = await this.findingsFor(doc, keys);
      if (wires.length > 0) await api.storeFindings(run_id, wires);
    }
    return run_id;
  }

  private async perform(api: MemoryApi, r: Row, op: OutboxOp): Promise<ActiveDecision | null> {
    switch (op.kind) {
      case 'decide': {
        if (!op.doc || !op.decide) throw new MemoryApiError('invalid_request', 'bad op');
        const run_id = await this.runFor(api, op.doc, op.finding_keys);
        return api.decide({ ...op.decide, run_id });
      }
      case 'answer': {
        if (!op.answer) throw new MemoryApiError('invalid_request', 'bad op');
        let answer = op.answer;
        if (!answer.question_id) {
          if (!op.doc || !op.question) throw new MemoryApiError('invalid_request', 'bad op');
          const run_id = await this.runFor(api, op.doc, op.finding_keys);
          const [q] = await api.createQuestions(run_id, [
            { ...op.question, client_op_id: this.opId() },
          ]);
          if (!q) throw new MemoryApiError('unavailable', 'question not created');
          answer = { ...answer, question_id: q.question_id };
          // persist the question id so a retry never creates a second question
          await this.save(r, { ...op, answer });
        }
        return api.answer(answer);
      }
      case 'revoke': {
        if (!op.revoke) throw new MemoryApiError('invalid_request', 'bad op');
        let id = op.revoke.decision_id;
        if (!id && op.revoke.target_op) {
          const t = await this.rowFor(op.revoke.target_op);
          if (!t || t.op.state === 'rejected') return null; // nothing was recorded: no-op
          if (t.op.state !== 'synced') {
            throw new MemoryApiError('unavailable', 'target not synced yet', { reason: 'waiting' });
          }
          id = t.op.result?.id;
          if (!id) return null;
        }
        if (!id) return null;
        return api.revoke(id, op.revoke.reason);
      }
    }
  }

  private async fail(r: Row, op: OutboxOp, e: unknown): Promise<boolean> {
    const err = errorOf(e);
    const now = this.now();
    const me = e instanceof MemoryApiError ? e : null;
    const runGone =
      err.code === 'run_required' || (err.code === 'not_found' && err.reason === 'run_not_found');
    if (runGone && op.doc && !op.runRetried) {
      const api = this.api() as (MemoryApi & Partial<RunCacheControl>) | null;
      try {
        await api?.invalidateRun?.(op.doc);
      } catch {
        /* the retry still resolves a run */
      }
      await this.save(r, {
        ...op,
        state: 'queued',
        runRetried: true,
        nextAttemptAt: now,
        error: err,
      });
      return this.sendOne(r);
    }
    if (err.code === 'conflict') {
      const next: OutboxOp = { ...op, state: 'rejected', error: err };
      await this.save(r, next);
      this.emit({ type: 'conflict', op: next, current: me?.current ?? null });
      return true;
    }
    if (err.code === 'rate_limited' || err.code === 'quota_exhausted') {
      const at = me?.retryAfterUtc ? Date.parse(me.retryAfterUtc) : now + backoffMs(op.attempts);
      const daily = isDailyBudgetReason(err.reason);
      const next: OutboxOp = {
        ...op,
        state: daily ? 'deferred' : 'retry',
        nextAttemptAt: Number.isFinite(at) ? at : now + backoffMs(op.attempts),
        error: err,
      };
      await this.save(r, next);
      if (daily) this.emit({ type: 'deferred', op: next, until: next.nextAttemptAt });
      else this.emit({ type: 'retry', op: next, at: next.nextAttemptAt });
      return false;
    }
    if (err.code === 'unavailable' || err.code === 'unauthorized') {
      if (Math.max(op.attempts, 1) >= MAX_UNAVAILABLE_ATTEMPTS) {
        const parked: OutboxOp = { ...op, state: 'parked', error: err };
        await this.save(r, parked);
        this.emit({ type: 'parked', op: parked });
        return false;
      }
      const next: OutboxOp = {
        ...op,
        state: 'retry',
        attempts: Math.max(op.attempts, 1),
        nextAttemptAt: now + backoffMs(Math.max(op.attempts, 1)),
        error: err,
      };
      await this.save(r, next);
      this.emit({ type: 'retry', op: next, at: next.nextAttemptAt });
      return false;
    }
    // fingerprint_mismatch (422), invalid_request, not_found, read_only, run_required twice
    const next: OutboxOp = { ...op, state: 'rejected', error: err };
    await this.save(r, next);
    this.emit({ type: 'rejected', op: next, error: err });
    return true;
  }
}
