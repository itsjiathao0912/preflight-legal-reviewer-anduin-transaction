import {
  ActiveDecisionSchema,
  limits,
  REASON_CODES,
  type ActiveDecision,
  type AuditEvent,
  type FindingWire,
  type FirmMemoryResponse,
  type Rule,
} from '@aduin/core';
import { e2eFirmRules } from '../e2e-hook';
import type { AppDb, DecisionRow } from '../storage/db';
import {
  AUDIT_PAGE_SIZE,
  MemoryApiError,
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

const HEX64 = /^[0-9a-f]{64}$/;
const PATTERN_KEY_RE = /^[a-z0-9:#>-]{1,80}$/;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Stub-internal uiState rows (prefixed `stub:` so they never collide with client cache rows). */
interface StubRun {
  run_id: string;
  law_firm_id: string | null;
  stored: string[];
  sheet_exported_at?: number;
  sheet_question_count?: number;
}
interface StubQuestion {
  question_id: string;
  finding_ref: string;
  fingerprint: string;
  law_firm_id: string;
  interpretations: string[];
}
interface StubRule extends Rule {
  law_firm_id: string;
}
const K = {
  runKey: (i: EnsureRunInput) =>
    `stub:runkey:${i.law_firm_id ?? ''}|${i.doc_hash}|${i.settings_hash}`,
  run: (id: string) => `stub:run:${id}`,
  question: (id: string) => `stub:question:${id}`,
  rules: 'stub:rules',
  audit: 'stub:audit',
  session: 'stub:session',
} as const;

const rid = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

function strip(row: DecisionRow): ActiveDecision {
  const { law_firm_id: _f, seq: _s, ...rest } = row;
  return ActiveDecisionSchema.parse(rest);
}

/** Dexie-backed stub with the Worker semantics (append-only, one active per fingerprint, revoke not delete). */
export class StubMemoryApi implements MemoryApi {
  constructor(
    private readonly db: AppDb,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async lookup(lawFirmId: string, fingerprints: string[]): Promise<ActiveDecision[]> {
    if (!lawFirmId) throw new MemoryApiError('invalid_request', 'law_firm_id required');
    if (fingerprints.length === 0 || fingerprints.length > limits.memoryLookupMax) {
      throw new MemoryApiError(
        'invalid_request',
        `1..${limits.memoryLookupMax} fingerprints per lookup`,
      );
    }
    if (fingerprints.some((f) => !HEX64.test(f)))
      throw new MemoryApiError('invalid_request', 'bad fingerprint');
    const rows = await this.db.decisions.where('fingerprint').anyOf(fingerprints).toArray();
    return rows
      .filter((r) => r.law_firm_id === lawFirmId && r.status === 'active')
      .sort((a, b) => a.seq - b.seq)
      .map(strip);
  }

  private async append(
    lawFirmId: string,
    d: Omit<ActiveDecision, 'id' | 'status' | 'decided_at'>,
  ): Promise<ActiveDecision> {
    let created: DecisionRow | null = null;
    await this.db.transaction('rw', this.db.decisions, async () => {
      const prior = await this.db.decisions.where('fingerprint').equals(d.fingerprint).toArray();
      const maxSeq = (await this.db.decisions.orderBy('seq').last())?.seq ?? 0;
      for (const p of prior) {
        if (p.law_firm_id === lawFirmId && p.status === 'active') {
          await this.db.decisions.update(p.id, { status: 'superseded' });
        }
      }
      const row: DecisionRow = {
        ...d,
        id: rid('d'),
        status: 'active',
        decided_at: this.now(),
        law_firm_id: lawFirmId,
        seq: maxSeq + 1,
      };
      ActiveDecisionSchema.parse(strip(row));
      await this.db.decisions.add(row);
      created = row;
    });
    return strip(created!);
  }

  async decide(input: DecideInput): Promise<ActiveDecision> {
    if (!input.law_firm_id) throw new MemoryApiError('invalid_request', 'law_firm_id required');
    if (!HEX64.test(input.fingerprint))
      throw new MemoryApiError('invalid_request', 'bad fingerprint');
    if (input.decision === 'dismissed') {
      if (!input.reason_code || !(REASON_CODES as readonly string[]).includes(input.reason_code)) {
        throw new MemoryApiError('invalid_request', 'dismissed requires reason_code');
      }
    }
    if (input.quote_text.length === 0 || input.quote_text.length > limits.quoteMaxChars) {
      throw new MemoryApiError('invalid_request', 'quote_text length');
    }
    if (input.pattern_key !== undefined && !PATTERN_KEY_RE.test(input.pattern_key)) {
      throw new MemoryApiError('invalid_request', 'bad pattern_key', { reason: 'pattern_key' });
    }
    if (input.run_id !== undefined) {
      const run = await this.run_(input.run_id);
      if (!run.law_firm_id)
        throw new MemoryApiError('invalid_request', 'run has no law firm', {
          reason: 'firm_required',
        });
    }
    const d = await this.append(input.law_firm_id, {
      fingerprint: input.fingerprint,
      decision: input.decision,
      ...(input.reason_code ? { reason_code: input.reason_code } : {}),
      ...(input.note ? { note: input.note.slice(0, 500) } : {}),
      issue_class: input.issue_class,
      ...(input.quote_snippet
        ? { quote_snippet: input.quote_snippet.slice(0, limits.snippetMaxChars) }
        : {}),
      ...(input.section_path ? { section_path: input.section_path.slice(0, 8) } : {}),
      ...(input.pattern_key ? { pattern_key: input.pattern_key } : {}),
      fund_name: input.fund_name ?? '',
      ...(input.doc_version_label ? { doc_version_label: input.doc_version_label } : {}),
      decided_by_name: input.decided_by_name,
    });
    await this.audit_(input.decided_by_name, 'decision_recorded', input.law_firm_id, d.id);
    return d;
  }

  async answer(input: AnswerInput): Promise<ActiveDecision> {
    let firm = input.law_firm_id;
    if (input.question_id !== undefined) {
      const q = await this.get<StubQuestion>(K.question(input.question_id));
      if (!q)
        throw new MemoryApiError('not_found', 'question not found', {
          reason: 'question_not_found',
        });
      if (q.fingerprint !== input.fingerprint)
        throw new MemoryApiError('fingerprint_mismatch', 'fingerprint does not match the question');
      firm = q.law_firm_id;
    }
    if (!firm) throw new MemoryApiError('invalid_request', 'law_firm_id required');
    if (!HEX64.test(input.fingerprint))
      throw new MemoryApiError('invalid_request', 'bad fingerprint');
    if (input.counsel_note !== undefined && input.counsel_note.length > 1000)
      throw new MemoryApiError('invalid_request', 'note length');
    const d = await this.append(firm, {
      fingerprint: input.fingerprint,
      decision: 'answered',
      counsel_option: input.counsel_option,
      ...(input.counsel_note ? { counsel_note: input.counsel_note } : {}),
      issue_class: input.issue_class,
      ...(input.quote_snippet
        ? { quote_snippet: input.quote_snippet.slice(0, limits.snippetMaxChars) }
        : {}),
      fund_name: input.fund_name ?? '',
      decided_by_name: input.decided_by_name,
    });
    await this.audit_(input.decided_by_name, 'answer_recorded', firm, d.id);
    return d;
  }

  /**
   * Bundled samples carry no active firm rules (the demo seed rule is `proposed`), so the stub returns
   * [] and the rules hash is 'none', matching the committed `{docHash}.none.json` precomputed files
   * (E18(e) option "[] / none").
   */
  async firmRules(lawFirmId: string): Promise<string[]> {
    if (!lawFirmId) throw new MemoryApiError('invalid_request', 'law_firm_id required');
    const hook = e2eFirmRules();
    if (hook) return [...hook];
    return (await this.rules_())
      .filter((r) => r.law_firm_id === lawFirmId && r.status === 'active')
      .map((r) => r.text);
  }

  async revoke(decisionId: string, reason: string): Promise<ActiveDecision | null> {
    if (!reason.trim()) throw new MemoryApiError('invalid_request', 'revoke requires a reason');
    const row = await this.db.decisions.get(decisionId);
    if (!row) throw new MemoryApiError('not_found', 'decision not found');
    if (row.status === 'active') {
      await this.db.decisions.update(decisionId, { status: 'revoked' });
      await this.audit_(
        row.decided_by_name,
        'decision_revoked',
        row.law_firm_id,
        decisionId,
        reason,
      );
    }
    return null;
  }

  // --- Phase 08 S0: full frozen interface (preview / offline behaviour) ---

  private async get<T>(key: string): Promise<T | undefined> {
    return (await this.db.uiState.get(key))?.value as T | undefined;
  }
  private async put(key: string, value: unknown): Promise<void> {
    await this.db.uiState.put({ key, value, updatedAt: this.now() });
  }
  private async rules_(): Promise<StubRule[]> {
    return (await this.get<StubRule[]>(K.rules)) ?? [];
  }
  private async actor(): Promise<string> {
    return (await this.get<string>(K.session)) ?? 'Analyst';
  }
  private async audit_(
    actor: string,
    action: AuditEvent['action'],
    lawFirmId?: string | null,
    entityId?: string,
    reason?: string,
  ): Promise<void> {
    const events = (await this.get<AuditEvent[]>(K.audit)) ?? [];
    events.push({
      id: rid('a'),
      at: this.now(),
      actor_name: actor,
      action,
      ...(lawFirmId ? { law_firm_id: lawFirmId } : {}),
      ...(entityId ? { entity_id: entityId } : {}),
      ...(reason ? { reason: reason.slice(0, 500) } : {}),
    });
    await this.put(K.audit, events);
  }

  async bootstrap(name: string): Promise<SessionInfo> {
    const n = name.trim();
    if (n.length < 1 || n.length > 80)
      throw new MemoryApiError('invalid_request', 'analyst_name 1-80 chars');
    const first = (await this.get<string>(K.session)) === undefined;
    await this.put(K.session, n);
    if (first) await this.audit_(n, 'session_created');
    return {
      workspace_id: 'ws_local',
      analyst_id: 'an_local',
      kind: 'sandbox',
      expires_at: this.now() + SESSION_TTL_MS,
      read_only: false,
    };
  }

  async ensureRun(input: EnsureRunInput): Promise<{ run_id: string }> {
    if (!HEX64.test(input.doc_hash) || !HEX64.test(input.settings_hash))
      throw new MemoryApiError('invalid_request', 'bad hash');
    if (!input.doc_name || input.doc_name.length > 120)
      throw new MemoryApiError('invalid_request', 'doc_name length');
    const existing = await this.get<string>(K.runKey(input));
    if (existing) return { run_id: existing };
    const run: StubRun = { run_id: rid('r'), law_firm_id: input.law_firm_id, stored: [] };
    await this.put(K.run(run.run_id), run);
    await this.put(K.runKey(input), run.run_id);
    return { run_id: run.run_id };
  }

  private async run_(runId: string): Promise<StubRun> {
    const run = await this.get<StubRun>(K.run(runId));
    if (!run) throw new MemoryApiError('not_found', 'run not found', { reason: 'run_not_found' });
    return run;
  }

  /** INSERT OR IGNORE semantics: duplicate ids are not re-stored and not counted. */
  async storeFindings(runId: string, findings: FindingWire[]): Promise<{ stored: number }> {
    const run = await this.run_(runId);
    if (findings.length === 0) throw new MemoryApiError('invalid_request', 'no findings');
    const have = new Set(run.stored);
    let stored = 0;
    for (const f of findings) {
      if (have.has(f.id)) continue;
      have.add(f.id);
      stored++;
    }
    await this.put(K.run(runId), { ...run, stored: [...have] });
    return { stored };
  }

  async createQuestions(runId: string, items: QuestionItem[]): Promise<CreatedQuestion[]> {
    const run = await this.run_(runId);
    if (!run.law_firm_id)
      throw new MemoryApiError('invalid_request', 'run has no law firm', {
        reason: 'firm_required',
      });
    const out: CreatedQuestion[] = [];
    for (const it of items) {
      if (!run.stored.includes(it.finding_ref))
        throw new MemoryApiError('invalid_request', 'finding not stored', {
          reason: 'finding_ref',
        });
      if (!HEX64.test(it.fingerprint))
        throw new MemoryApiError('invalid_request', 'bad fingerprint');
      if (
        it.interpretations.length < 1 ||
        it.interpretations.length > 6 ||
        it.interpretations.some((t) => t.length < 1 || t.length > 500)
      )
        throw new MemoryApiError('invalid_request', '1-6 interpretations of 1-500 chars');
      const q: StubQuestion = {
        question_id: rid('q'),
        finding_ref: it.finding_ref,
        fingerprint: it.fingerprint,
        law_firm_id: run.law_firm_id,
        interpretations: [...it.interpretations],
      };
      await this.put(K.question(q.question_id), q);
      out.push({ finding_ref: q.finding_ref, question_id: q.question_id });
    }
    return out;
  }

  async exportRun(runId: string, input: ExportRunInput): Promise<ExportRunResult> {
    const run = await this.run_(runId);
    if (
      !Number.isInteger(input.question_count) ||
      input.question_count < 0 ||
      input.question_count > 500
    )
      throw new MemoryApiError('invalid_request', 'question_count 0-500');
    const at = this.now();
    await this.put(K.run(runId), {
      ...run,
      sheet_exported_at: at,
      sheet_question_count: input.question_count,
    });
    await this.audit_(await this.actor(), 'counsel_sheet_exported', run.law_firm_id, runId);
    return {
      ok: true,
      run_id: runId,
      sheet_exported_at: at,
      sheet_question_count: input.question_count,
    };
  }

  async firm(lawFirmId: string): Promise<FirmMemoryResponse> {
    if (!lawFirmId) throw new MemoryApiError('invalid_request', 'law_firm_id required');
    const decisions = (await this.db.decisions.where('law_firm_id').equals(lawFirmId).toArray())
      .filter((r) => r.status === 'active')
      .sort((a, b) => b.decided_at - a.decided_at || b.seq - a.seq)
      .slice(0, 200)
      .map(strip);
    const rules = await this.listRules(lawFirmId);
    return {
      decisions,
      rules,
      counts: {
        decisions: decisions.length,
        dismissed: decisions.filter((d) => d.decision === 'dismissed').length,
        answered: decisions.filter((d) => d.decision === 'answered').length,
        awaiting: 0,
        rules_active: rules.filter((r) => r.status === 'active').length,
        rules_proposed: rules.filter((r) => r.status === 'proposed').length,
      },
    };
  }

  async listRules(lawFirmId: string): Promise<Rule[]> {
    if (!lawFirmId) throw new MemoryApiError('invalid_request', 'law_firm_id required');
    return (await this.rules_())
      .filter((r) => r.law_firm_id === lawFirmId)
      .map(({ law_firm_id: _f, ...r }) => r);
  }

  async createRule(lawFirmId: string, text: string): Promise<Rule> {
    if (!lawFirmId) throw new MemoryApiError('invalid_request', 'law_firm_id required');
    const t = text.trim();
    if (t.length < 1 || t.length > 500) throw new MemoryApiError('invalid_request', 'text 1-500');
    const rule: StubRule = {
      id: rid('ru'),
      text: t,
      status: 'active',
      origin: 'manual',
      evidence_count: 0,
      law_firm_id: lawFirmId,
    };
    await this.put(K.rules, [...(await this.rules_()), rule]);
    await this.audit_(await this.actor(), 'rule_added', lawFirmId, rule.id);
    const { law_firm_id: _f, ...out } = rule;
    return out;
  }

  private async transition(
    id: string,
    from: Rule['status'],
    to: Rule['status'],
    action: AuditEvent['action'],
    reason?: string,
  ): Promise<Rule> {
    const rules = await this.rules_();
    const i = rules.findIndex((r) => r.id === id);
    if (i < 0)
      throw new MemoryApiError('not_found', 'rule not found', { reason: 'rule_not_found' });
    const r = rules[i]!;
    if (r.status !== from)
      throw new MemoryApiError('invalid_request', `rule is ${r.status}`, { reason: 'rule_state' });
    const next: StubRule = { ...r, status: to };
    rules[i] = next;
    await this.put(K.rules, rules);
    await this.audit_(await this.actor(), action, r.law_firm_id, id, reason);
    const { law_firm_id: _f, ...out } = next;
    return out;
  }

  approveRule(id: string): Promise<Rule> {
    return this.transition(id, 'proposed', 'active', 'rule_approved');
  }
  rejectRule(id: string): Promise<Rule> {
    return this.transition(id, 'proposed', 'rejected', 'rule_rejected');
  }
  /** Revoked rules are reported as `rejected` (Worker rule mapping). */
  async revokeRule(id: string, text: string): Promise<Rule> {
    if (!text.trim()) throw new MemoryApiError('invalid_request', 'revoke requires a reason');
    return this.transition(id, 'active', 'rejected', 'rule_revoked', text);
  }

  /** Newest first, AUDIT_PAGE_SIZE per page; the cursor is an opaque offset. */
  async audit(cursor?: string): Promise<AuditPage> {
    const all = [...((await this.get<AuditEvent[]>(K.audit)) ?? [])].reverse();
    const start = cursor === undefined ? 0 : Number(cursor);
    if (!Number.isInteger(start) || start < 0)
      throw new MemoryApiError('invalid_request', 'bad cursor', { reason: 'cursor' });
    const events = all.slice(start, start + AUDIT_PAGE_SIZE);
    const next = start + AUDIT_PAGE_SIZE;
    return { events, ...(next < all.length ? { next_cursor: String(next) } : {}) };
  }

  health(): Promise<MemoryHealth> {
    return Promise.resolve({
      ok: true,
      schema_version: 'stub',
      expected_schema_version: 'stub',
      seed_mode: '0',
      seed_version: null,
    });
  }
}
